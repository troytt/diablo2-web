import { describe, it, expect, beforeAll, vi } from 'vitest'
import * as fs from 'node:fs'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { parseTable } from '../src/common/world/acts.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import {
  loadTreasureClasses,
  parseTreasureClassTable,
  TREASURE_CLASS_EX_TABLE_PATH,
  type TreasureClassTable,
  type TreasureClassNode,
} from '../src/common/items/treasure-class.ts'
import {
  rollTreasureClass,
  computeEffectivePlayers,
  computeScaledNoDrop,
  propagateQualityFactors,
  binarySearchPrefixSum,
  MAX_STACK_DEPTH,
  MAX_STEP_BUDGET,
  type AutoTcNode,
  type DropContext,
  type QualityFactors,
} from '../src/common/items/treasure-engine.ts'
import { handleActSceneChatCommand } from '../src/common/world/chat-commands.ts'

const hasD2 = fs.existsSync('samples/d2/d2data.mpq')

describe('TreasureClassEx Expansion Engine (Issue #101)', () => {
  describe('Mathematical Helper Functions', () => {
    it('verifies computeEffectivePlayers scaling across party and game counts', () => {
      // 1 player
      expect(computeEffectivePlayers(1, 1)).toBe(1)
      expect(computeEffectivePlayers()).toBe(1)
      expect(computeEffectivePlayers(undefined, undefined)).toBe(1)

      // Solo players in multi-player games: n = 1 + trunc((g - 1) / 2)
      expect(computeEffectivePlayers(2, 1)).toBe(1) // /players 2 solo -> n=1
      expect(computeEffectivePlayers(3, 1)).toBe(2) // /players 3 solo -> n=2
      expect(computeEffectivePlayers(4, 1)).toBe(2) // /players 4 solo -> n=2
      expect(computeEffectivePlayers(5, 1)).toBe(3) // /players 5 solo -> n=3
      expect(computeEffectivePlayers(6, 1)).toBe(3) // /players 6 solo -> n=3
      expect(computeEffectivePlayers(7, 1)).toBe(4) // /players 7 solo -> n=4
      expect(computeEffectivePlayers(8, 1)).toBe(4) // /players 8 solo -> n=4

      // Partied players nearby: n = p + trunc((g - p) / 2)
      expect(computeEffectivePlayers(8, 8)).toBe(8)
      expect(computeEffectivePlayers(8, 6)).toBe(7) // 6 + trunc(2/2) = 7
      expect(computeEffectivePlayers(8, 4)).toBe(6) // 4 + trunc(4/2) = 6
      expect(computeEffectivePlayers(8, 2)).toBe(5) // 2 + trunc(6/2) = 5

      // Boundary clamps
      expect(computeEffectivePlayers(0, 0)).toBe(1)
      expect(computeEffectivePlayers(2, 5)).toBe(2) // p clamped to g
    })

    it('verifies computeScaledNoDrop double precision scaling', () => {
      // Act 1 H2H A: NoDrop=100, TotalProb=60
      // 1 player (n=1): NoDrop' = 100
      expect(computeScaledNoDrop(100, 60, 1)).toBe(100)

      // 8 players solo (n=4):
      // r = 100 / 160 = 0.625
      // r^4 = 0.152587890625
      // 60 * r^4 / (1 - r^4) = 10.8037... -> Math.trunc -> 10
      expect(computeScaledNoDrop(100, 60, 4)).toBe(10)

      // 8 players party (n=8):
      // r^8 = 0.023283064365386963
      // 60 * r^8 / (1 - r^8) = 1.43027... -> Math.trunc -> 1
      expect(computeScaledNoDrop(100, 60, 8)).toBe(1)

      // NoDrop = 0 stays 0
      expect(computeScaledNoDrop(0, 60, 8)).toBe(0)

      // TotalProb = 0 returns NoDrop
      expect(computeScaledNoDrop(100, 0, 8)).toBe(100)
    })

    it('verifies propagateQualityFactors formula across frames', () => {
      // Root frame: parent is [0, 0, 0, 0] -> inherits entry factors
      const rootQf = propagateQualityFactors([0, 0, 0, 0], [883, 883, 883, 1024])
      expect(rootQf).toEqual([883, 883, 883, 1024])

      // Child with zero factors inherits parent non-zero factors
      const childQf = propagateQualityFactors([883, 883, 883, 1024], [0, 0, 0, 0])
      expect(childQf).toEqual([883, 883, 883, 1024])

      // Child with non-zero factors uses Math.max(parent, entry)
      const maxQf = propagateQualityFactors([500, 900, 0, 0], [800, 800, 800, 1024])
      expect(maxQf).toEqual([800, 900, 800, 1024])
    })

    it('verifies binarySearchPrefixSum interval mapping', () => {
      // Act 1 H2H A prefix sums: [21, 37, 58, 60] (4 items)
      const cProb = [21, 37, 58, 60]

      // Item 0: target in [0, 20]
      expect(binarySearchPrefixSum(cProb, 0)).toBe(0)
      expect(binarySearchPrefixSum(cProb, 20)).toBe(0)

      // Item 1: target in [21, 36]
      expect(binarySearchPrefixSum(cProb, 21)).toBe(1)
      expect(binarySearchPrefixSum(cProb, 36)).toBe(1)

      // Item 2: target in [37, 57]
      expect(binarySearchPrefixSum(cProb, 37)).toBe(2)
      expect(binarySearchPrefixSum(cProb, 57)).toBe(2)

      // Item 3: target in [58, 59]
      expect(binarySearchPrefixSum(cProb, 58)).toBe(3)
      expect(binarySearchPrefixSum(cProb, 59)).toBe(3)
    })
  })

  describe('Expansion Engine Drops', () => {
    let table: TreasureClassTable

    beforeAll(async () => {
      if (!hasD2) {
        throw new Error(
          '[Preflight] samples/d2 MPQ files (d2data.mpq, d2exp.mpq, Patch_D2.mpq) are required for TreasureClassEx test. ' +
          'Please symlink samples/d2 to your Diablo II 1.13c installation directory.'
        )
      }
      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      const bytes = await archives.read(TREASURE_CLASS_EX_TABLE_PATH)
      table = parseTreasureClassTable(parseTable(bytes))
    })

    describe('NoDrop & Player Scaling Drop Rates (Act 1 H2H A)', () => {
    it('verifies Act 1 H2H A 1-player empty drop rate is 100/160 = 62.5%', () => {
      const act1H2HA = table.get('Act 1 H2H A')!
      expect(act1H2HA.noDrop).toBe(100)
      expect(act1H2HA.totalProbExpansion).toBe(60)

      const rng = new D2Rng(123456789)
      const iterations = 20000
      let emptyCount = 0

      for (let i = 0; i < iterations; i++) {
        const drops = rollTreasureClass('Act 1 H2H A', {
          rng,
          tcTable: table,
          gamePlayers: 1,
          partyPlayers: 1,
        })
        if (drops.length === 0) {
          emptyCount++
        }
      }

      const emptyRate = emptyCount / iterations
      const expectedRate = 100 / 160 // 0.625

      // Within statistical tolerance (+/- 1.5%)
      expect(emptyRate).toBeGreaterThanOrEqual(expectedRate - 0.015)
      expect(emptyRate).toBeLessThanOrEqual(expectedRate + 0.015)
    })

    it('verifies players=8 drops NoDrop significantly (solo: ~14.3%, party: ~1.6%)', () => {
      const iterations = 20000

      // Case A: 8 players solo (effectivePlayers = 4, NoDrop' = 10, total = 70)
      const rngSolo = new D2Rng(987654321)
      let emptySolo = 0
      for (let i = 0; i < iterations; i++) {
        const drops = rollTreasureClass('Act 1 H2H A', {
          rng: rngSolo,
          tcTable: table,
          gamePlayers: 8,
          partyPlayers: 1,
        })
        if (drops.length === 0) {
          emptySolo++
        }
      }
      const soloRate = emptySolo / iterations
      const expectedSoloRate = 10 / 70 // ~0.142857
      expect(soloRate).toBeGreaterThanOrEqual(expectedSoloRate - 0.015)
      expect(soloRate).toBeLessThanOrEqual(expectedSoloRate + 0.015)

      // Case B: 8 players party nearby (effectivePlayers = 8, NoDrop' = 1, total = 61)
      const rngParty = new D2Rng(555666777)
      let emptyParty = 0
      for (let i = 0; i < iterations; i++) {
        const drops = rollTreasureClass('Act 1 H2H A', {
          rng: rngParty,
          tcTable: table,
          gamePlayers: 8,
          partyPlayers: 8,
        })
        if (drops.length === 0) {
          emptyParty++
        }
      }
      const partyRate = emptyParty / iterations
      const expectedPartyRate = 1 / 61 // ~0.016393
      expect(partyRate).toBeGreaterThanOrEqual(expectedPartyRate - 0.01)
      expect(partyRate).toBeLessThanOrEqual(expectedPartyRate + 0.01)

      // Clear monotonic drop: 62.5% -> 14.3% -> 1.6%
      expect(soloRate).toBeLessThan(0.625)
      expect(partyRate).toBeLessThan(soloRate)
    })
  })

  describe('Negative Picks (Picks < 0) Deterministic Enumeration', () => {
    it('drops exact counts deterministically with 0 RNG consumption for leaf items', () => {
      // Mock TC table with deterministic negative picks: picks = -3
      // Item 1: 'swd' (prob: 1), Item 2: 'axe' (prob: 2). TotalProb = 3.
      const mockTable: TreasureClassTable = {
        all: [],
        byName: new Map(),
        byGroup: new Map(),
        danglingReferences: new Set(),
        autoTCDanglingReferences: new Set(),
        baseItemDanglingReferences: new Set(),
        get: (name: string) => {
          if (name === 'TestNeg') {
            return {
              name: 'TestNeg',
              level: 1,
              picks: -3,
              unique: 0,
              set: 0,
              rare: 0,
              magic: 0,
              noDrop: 100, // NoDrop should be completely ignored!
              items: [
                {
                  item: 'swd',
                  prob: 1,
                  kind: 'base-item',
                  isDangling: true,
                  isClassic: true,
                },
                {
                  item: 'axe',
                  prob: 2,
                  kind: 'base-item',
                  isDangling: true,
                  isClassic: true,
                },
              ],
              totalProbClassic: 3,
              totalProbExpansion: 3,
              cumulativeProbExpansion: [1, 3],
            } as TreasureClassNode
          }
          return undefined
        },
      }

      const rng = new D2Rng(0x12345678, 0x87654321)
      const initialSeed = rng.getSeed()

      const drops = rollTreasureClass('TestNeg', {
        rng,
        tcTable: mockTable,
      })

      // Exactly 3 drops in deterministic sequence: 1 swd, 2 axe
      expect(drops.length).toBe(3)
      expect(drops[0]?.code).toBe('swd')
      expect(drops[1]?.code).toBe('axe')
      expect(drops[2]?.code).toBe('axe')

      // 0 RNG consumption: seed is completely unchanged
      expect(rng.getSeed()).toEqual(initialSeed)
    })

    it('verifies Countess (picks = -2) enumerates Countess Item and Countess Rune deterministically', () => {
      const countess = table.get('Countess')!
      expect(countess.picks).toBe(-2)
      expect(countess.items.length).toBe(2)
      expect(countess.items[0]?.item).toBe('Countess Item')
      expect(countess.items[1]?.item).toBe('Countess Rune')

      // Mock sub-TC table where Countess Item and Countess Rune drop leaf items directly
      const mockTable: TreasureClassTable = {
        ...table,
        get: (name: string) => {
          if (name === 'Countess') return table.get('Countess')
          if (name === 'Countess Item') {
            return {
              name: 'Countess Item',
              level: 1,
              picks: 1,
              unique: 0,
              set: 0,
              rare: 0,
              magic: 0,
              noDrop: 0,
              items: [
                { item: 'swd', prob: 1, kind: 'base-item', isDangling: true, isClassic: true },
              ],
              totalProbClassic: 1,
              totalProbExpansion: 1,
              cumulativeProbExpansion: [1],
            } as TreasureClassNode
          }
          if (name === 'Countess Rune') {
            return {
              name: 'Countess Rune',
              level: 1,
              picks: 1,
              unique: 0,
              set: 0,
              rare: 0,
              magic: 0,
              noDrop: 0,
              items: [
                { item: 'r01', prob: 1, kind: 'base-item', isDangling: true, isClassic: true },
              ],
              totalProbClassic: 1,
              totalProbExpansion: 1,
              cumulativeProbExpansion: [1],
            } as TreasureClassNode
          }
          return table.get(name)
        },
      }

      const rng = new D2Rng(11223344)
      const drops = rollTreasureClass('Countess', {
        rng,
        tcTable: mockTable,
      })

      // Must contain both Countess Item output ('swd') and Countess Rune output ('r01')
      expect(drops.length).toBe(2)
      expect(drops[0]?.code).toBe('swd')
      expect(drops[1]?.code).toBe('r01')

      // Countess quality factors [883, 883, 883, 1024] propagated to both items
      expect(drops[0]?.qualityFactors).toEqual([883, 883, 883, 1024])
      expect(drops[1]?.qualityFactors).toEqual([883, 883, 883, 1024])
    })
  })

  describe('Deterministic Replay & Seed Independence', () => {
    it('replays identical drops given a fixed D2Rng seed', () => {
      const seed = 0xdeadbeef
      const rng1 = new D2Rng(seed)
      const rng2 = new D2Rng(seed)

      const drops1 = rollTreasureClass('Act 1 Equip A', {
        rng: rng1,
        tcTable: table,
        gamePlayers: 1,
      })

      const drops2 = rollTreasureClass('Act 1 Equip A', {
        rng: rng2,
        tcTable: table,
        gamePlayers: 1,
      })

      expect(drops1).toEqual(drops2)
      expect(rng1.getSeed()).toEqual(rng2.getSeed())
    })

    it('produces different outcomes with different seeds', () => {
      const rngA = new D2Rng(1001)
      const rngB = new D2Rng(2002)

      // Collect 100 drops from both
      const dropsA = Array.from({ length: 100 }, () =>
        rollTreasureClass('Act 1 H2H A', { rng: rngA, tcTable: table }),
      )
      const dropsB = Array.from({ length: 100 }, () =>
        rollTreasureClass('Act 1 H2H A', { rng: rngB, tcTable: table }),
      )

      expect(dropsA).not.toEqual(dropsB)
    })
  })

  describe('Stack Safety & Step Budget Guards', () => {
    it('throws stack overflow when recursion depth exceeds 64 frames (non-tail calls)', () => {
      // Create a chain of 65 TCs where picks = 2 (so remainingPicks > 0, tail call cannot be reused)
      const chainNodes = new Map<string, TreasureClassNode>()
      for (let i = 0; i < 66; i++) {
        const name = `Chain_${i}`
        const nextName = `Chain_${i + 1}`
        chainNodes.set(name, {
          name,
          level: 1,
          picks: 2,
          unique: 0,
          set: 0,
          rare: 0,
          magic: 0,
          noDrop: 0,
          items: [
            { item: nextName, prob: 1, kind: 'tc', isDangling: false, isClassic: true },
          ],
          totalProbClassic: 1,
          totalProbExpansion: 1,
          cumulativeProbExpansion: [1],
        } as TreasureClassNode)
      }

      const chainTable: TreasureClassTable = {
        all: [],
        byName: chainNodes,
        byGroup: new Map(),
        danglingReferences: new Set(),
        autoTCDanglingReferences: new Set(),
        baseItemDanglingReferences: new Set(),
        get: (name: string) => chainNodes.get(name),
      }

      const rng = new D2Rng(1)
      expect(() =>
        rollTreasureClass('Chain_0', {
          rng,
          tcTable: chainTable,
        }),
      ).toThrowError(/TreasureClass stack overflow: exceeded maximum depth of 64/)
    })

    it('allows deep recursion beyond 64 levels when tail call reuse applies', () => {
      // 100 levels where picks = 1 -> tail call reuse on each frame
      const tailNodes = new Map<string, TreasureClassNode>()
      for (let i = 0; i < 100; i++) {
        const name = `Tail_${i}`
        const nextItem = i === 99 ? 'swd' : `Tail_${i + 1}`
        tailNodes.set(name, {
          name,
          level: 1,
          picks: 1,
          unique: 0,
          set: 0,
          rare: 0,
          magic: 0,
          noDrop: 0,
          items: [
            { item: nextItem, prob: 1, kind: i === 99 ? 'base-item' : 'tc', isDangling: i === 99, isClassic: true },
          ],
          totalProbClassic: 1,
          totalProbExpansion: 1,
          cumulativeProbExpansion: [1],
        } as TreasureClassNode)
      }

      const tailTable: TreasureClassTable = {
        all: [],
        byName: tailNodes,
        byGroup: new Map(),
        danglingReferences: new Set(),
        autoTCDanglingReferences: new Set(),
        baseItemDanglingReferences: new Set(),
        get: (name: string) => tailNodes.get(name),
      }

      const rng = new D2Rng(1)
      const drops = rollTreasureClass('Tail_0', {
        rng,
        tcTable: tailTable,
      })

      // Successfully resolved through 100 frames via tail call slot reuse!
      expect(drops.length).toBe(1)
      expect(drops[0]?.code).toBe('swd')
    })

    it('throws step budget error when custom TC has an infinite circular reference', () => {
      // Circular reference: LoopA -> LoopB -> LoopA
      const loopNodes = new Map<string, TreasureClassNode>()
      loopNodes.set('LoopA', {
        name: 'LoopA',
        level: 1,
        picks: 1,
        unique: 0,
        set: 0,
        rare: 0,
        magic: 0,
        noDrop: 0,
        items: [{ item: 'LoopB', prob: 1, kind: 'tc', isDangling: false, isClassic: true }],
        totalProbClassic: 1,
        totalProbExpansion: 1,
        cumulativeProbExpansion: [1],
      } as TreasureClassNode)
      loopNodes.set('LoopB', {
        name: 'LoopB',
        level: 1,
        picks: 1,
        unique: 0,
        set: 0,
        rare: 0,
        magic: 0,
        noDrop: 0,
        items: [{ item: 'LoopA', prob: 1, kind: 'tc', isDangling: false, isClassic: true }],
        totalProbClassic: 1,
        totalProbExpansion: 1,
        cumulativeProbExpansion: [1],
      } as TreasureClassNode)

      const loopTable: TreasureClassTable = {
        all: [],
        byName: loopNodes,
        byGroup: new Map(),
        danglingReferences: new Set(),
        autoTCDanglingReferences: new Set(),
        baseItemDanglingReferences: new Set(),
        get: (name: string) => loopNodes.get(name),
      }

      const rng = new D2Rng(1)
      expect(() =>
        rollTreasureClass('LoopA', {
          rng,
          tcTable: loopTable,
        }),
      ).toThrowError(/TreasureClass step budget exceeded: 10000 steps/)
    })
  })

  describe('Gold and Multiplier Drops', () => {
    it('handles standard gold drops (gld) with multiplier 1', () => {
      const mockTable: TreasureClassTable = {
        ...table,
        get: (name: string) => {
          if (name === 'GoldTest') {
            return {
              name: 'GoldTest',
              level: 1,
              picks: 1,
              unique: 0,
              set: 0,
              rare: 0,
              magic: 0,
              noDrop: 0,
              items: [{ item: 'gld', prob: 1, kind: 'gold', isDangling: true, isClassic: true }],
              totalProbClassic: 1,
              totalProbExpansion: 1,
              cumulativeProbExpansion: [1],
            } as TreasureClassNode
          }
          return undefined
        },
      }

      const drops = rollTreasureClass('GoldTest', {
        rng: new D2Rng(1),
        tcTable: mockTable,
      })

      expect(drops.length).toBe(1)
      expect(drops[0]?.isGold).toBe(true)
      expect(drops[0]?.code).toBe('gld')
      expect(drops[0]?.goldMultiplier).toBe(1)
    })

    it('handles boss gold multiplier drops (gld,mul=N -> N >> 8)', () => {
      const mockTable: TreasureClassTable = {
        ...table,
        get: (name: string) => {
          if (name === 'BossGold') {
            return {
              name: 'BossGold',
              level: 1,
              picks: 3,
              unique: 0,
              set: 0,
              rare: 0,
              magic: 0,
              noDrop: 0,
              items: [
                { item: 'gld,mul=1280', prob: 1, kind: 'gold-multiplier', multiplier: 1280, isDangling: true, isClassic: true },
                { item: 'gld,mul=1536', prob: 1, kind: 'gold-multiplier', multiplier: 1536, isDangling: true, isClassic: true },
                { item: 'gld,mul=2048', prob: 1, kind: 'gold-multiplier', multiplier: 2048, isDangling: true, isClassic: true },
              ],
              totalProbClassic: 3,
              totalProbExpansion: 3,
              cumulativeProbExpansion: [1, 2, 3],
            } as TreasureClassNode
          }
          return undefined
        },
      }

      // Test negative picks version to deterministically test all 3
      const negMockTable: TreasureClassTable = {
        ...table,
        get: (name: string) => {
          if (name === 'BossGoldNeg') {
            return {
              name: 'BossGoldNeg',
              level: 1,
              picks: -3,
              unique: 0,
              set: 0,
              rare: 0,
              magic: 0,
              noDrop: 0,
              items: [
                { item: 'gld,mul=1280', prob: 1, kind: 'gold-multiplier', multiplier: 1280, isDangling: true, isClassic: true },
                { item: 'gld,mul=1536', prob: 1, kind: 'gold-multiplier', multiplier: 1536, isDangling: true, isClassic: true },
                { item: 'gld,mul=2048', prob: 1, kind: 'gold-multiplier', multiplier: 2048, isDangling: true, isClassic: true },
              ],
              totalProbClassic: 3,
              totalProbExpansion: 3,
              cumulativeProbExpansion: [1, 2, 3],
            } as TreasureClassNode
          }
          return undefined
        },
      }

      const drops = rollTreasureClass('BossGoldNeg', {
        rng: new D2Rng(1),
        tcTable: negMockTable,
      })

      expect(drops.length).toBe(3)
      // 1280 >> 8 = 5
      expect(drops[0]?.isGold).toBe(true)
      expect(drops[0]?.goldMultiplier).toBe(5)
      // 1536 >> 8 = 6
      expect(drops[1]?.isGold).toBe(true)
      expect(drops[1]?.goldMultiplier).toBe(6)
      // 2048 >> 8 = 8
      expect(drops[2]?.isGold).toBe(true)
      expect(drops[2]?.goldMultiplier).toBe(8)
    })
  })

  describe('Forced Quality Flags & Annihilus', () => {
    it('sets forced unique when flags & 1 is present in context', () => {
      const mockTable: TreasureClassTable = {
        ...table,
        get: (name: string) => {
          if (name === 'ForcedTC') {
            return {
              name: 'ForcedTC',
              level: 1,
              picks: 1,
              unique: 0,
              set: 0,
              rare: 0,
              magic: 0,
              noDrop: 0,
              items: [{ item: 'swd', prob: 1, kind: 'base-item', isDangling: true, isClassic: true }],
              totalProbClassic: 1,
              totalProbExpansion: 1,
              cumulativeProbExpansion: [1],
            } as TreasureClassNode
          }
          return undefined
        },
      }

      const drops = rollTreasureClass('ForcedTC', {
        rng: new D2Rng(1),
        tcTable: mockTable,
        flags: 1, // forced unique
      })

      expect(drops.length).toBe(1)
      expect(drops[0]?.forcedUnique).toBe(true)
      expect(drops[0]?.forcedSet).toBe(false)
      expect(drops[0]?.forcedQuality).toBe('unique')
      expect(drops[0]?.flags & 1).toBe(1)
    })

    it('sets forced set when flags & 2 is present in context', () => {
      const mockTable: TreasureClassTable = {
        ...table,
        get: (name: string) => {
          if (name === 'ForcedTC') {
            return {
              name: 'ForcedTC',
              level: 1,
              picks: 1,
              unique: 0,
              set: 0,
              rare: 0,
              magic: 0,
              noDrop: 0,
              items: [{ item: 'cap', prob: 1, kind: 'base-item', isDangling: true, isClassic: true }],
              totalProbClassic: 1,
              totalProbExpansion: 1,
              cumulativeProbExpansion: [1],
            } as TreasureClassNode
          }
          return undefined
        },
      }

      const drops = rollTreasureClass('ForcedTC', {
        rng: new D2Rng(1),
        tcTable: mockTable,
        flags: 2, // forced set
      })

      expect(drops.length).toBe(1)
      expect(drops[0]?.forcedUnique).toBe(false)
      expect(drops[0]?.forcedSet).toBe(true)
      expect(drops[0]?.forcedQuality).toBe('set')
      expect(drops[0]?.flags & 2).toBe(2)
    })

    it('automatically marks Annihilus drops with forced unique quality', () => {
      const mockTable: TreasureClassTable = {
        ...table,
        get: (name: string) => {
          if (name === 'AnniTC') {
            return {
              name: 'AnniTC',
              level: 1,
              picks: 1,
              unique: 1024,
              set: 0,
              rare: 0,
              magic: 0,
              noDrop: 0,
              items: [{ item: 'Annihilus', prob: 1, kind: 'unique-item', isDangling: true, isClassic: false }],
              totalProbClassic: 0,
              totalProbExpansion: 1,
              cumulativeProbExpansion: [1],
            } as TreasureClassNode
          }
          return undefined
        },
      }

      const drops = rollTreasureClass('AnniTC', {
        rng: new D2Rng(1),
        tcTable: mockTable,
      })

      expect(drops.length).toBe(1)
      expect(drops[0]?.code).toBe('Annihilus')
      expect(drops[0]?.forcedUnique).toBe(true)
      expect(drops[0]?.forcedQuality).toBe('unique')
      expect(drops[0]?.flags & 1).toBe(1)
    })
  })

  describe('Auto-TreasureClass Virtual Nodes (autoTcTable)', () => {
    it('expands virtual auto-TC nodes supplied in autoTcTable', () => {
      const autoTcTable = new Map<string, AutoTcNode>()
      autoTcTable.set('weap3', {
        name: 'weap3',
        picks: 1,
        noDrop: 0,
        items: [
          { item: 'sst', prob: 1, kind: 'base-item' },
          { item: 'wnd', prob: 1, kind: 'base-item' },
        ],
        totalProbExpansion: 2,
        cumulativeProbExpansion: [1, 2],
      })

      const mockTable: TreasureClassTable = {
        ...table,
        get: (name: string) => {
          if (name === 'EquipTest') {
            return {
              name: 'EquipTest',
              level: 1,
              picks: 1,
              unique: 0,
              set: 0,
              rare: 0,
              magic: 0,
              noDrop: 0,
              items: [{ item: 'weap3', prob: 1, kind: 'auto-tc', isDangling: true, isClassic: true }],
              totalProbClassic: 1,
              totalProbExpansion: 1,
              cumulativeProbExpansion: [1],
            } as TreasureClassNode
          }
          return undefined
        },
      }

      const drops = rollTreasureClass('EquipTest', {
        rng: new D2Rng(1),
        tcTable: mockTable,
        autoTcTable,
      })

      expect(drops.length).toBe(1)
      expect(['sst', 'wnd']).toContain(drops[0]?.code)
    })

    it('emits auto-TC reference as leaf item if not in autoTcTable', () => {
      const mockTable: TreasureClassTable = {
        ...table,
        get: (name: string) => {
          if (name === 'EquipTest') {
            return {
              name: 'EquipTest',
              level: 1,
              picks: 1,
              unique: 0,
              set: 0,
              rare: 0,
              magic: 0,
              noDrop: 0,
              items: [{ item: 'armo87', prob: 1, kind: 'auto-tc', isDangling: true, isClassic: true }],
              totalProbClassic: 1,
              totalProbExpansion: 1,
              cumulativeProbExpansion: [1],
            } as TreasureClassNode
          }
          return undefined
        },
      }

      const drops = rollTreasureClass('EquipTest', {
        rng: new D2Rng(1),
        tcTable: mockTable,
      })

      expect(drops.length).toBe(1)
      expect(drops[0]?.code).toBe('armo87')
    })
  })

  describe('Non-Existent TreasureClass Handling', () => {
    it('returns empty array when TC name is not found in tcTable or autoTcTable', () => {
      const drops = rollTreasureClass('NoSuchTCExists', {
        rng: new D2Rng(1),
        tcTable: table,
      })

      expect(drops).toEqual([])
    })
  })

  describe('Issue #418: /players N Chat & Console Command Handling', () => {
    it('accepts /players 1 through /players 8 and calls engine.setPlayers', () => {
      const mockEngine = { gamePlayers: 1, setPlayers: vi.fn((n: number) => { mockEngine.gamePlayers = n }) }
      const mockStatus = { textContent: '' }

      expect(handleActSceneChatCommand('/players 8', mockEngine, mockStatus)).toBe(true)
      expect(mockEngine.setPlayers).toHaveBeenCalledWith(8)
      expect(mockStatus.textContent).toBe('Players set to 8')

      expect(handleActSceneChatCommand('/players 1', mockEngine, mockStatus)).toBe(true)
      expect(mockEngine.setPlayers).toHaveBeenCalledWith(1)
      expect(mockStatus.textContent).toBe('Players set to 1')
    })

    it('accepts case-insensitive variations and commands without slash', () => {
      const mockEngine = { gamePlayers: 1, setPlayers: vi.fn((n: number) => { mockEngine.gamePlayers = n }) }
      const mockStatus = { textContent: '' }

      expect(handleActSceneChatCommand('/PLAYERS 5', mockEngine, mockStatus)).toBe(true)
      expect(mockEngine.setPlayers).toHaveBeenCalledWith(5)

      expect(handleActSceneChatCommand('players 4', mockEngine, mockStatus)).toBe(true)
      expect(mockEngine.setPlayers).toHaveBeenCalledWith(4)
    })

    it('rejects out-of-range player counts (e.g. 0, 9, -1) and non-matching commands', () => {
      const mockEngine = { gamePlayers: 1, setPlayers: vi.fn() }
      const mockStatus = { textContent: '' }

      expect(handleActSceneChatCommand('/players 0', mockEngine, mockStatus)).toBe(false)
      expect(mockEngine.setPlayers).not.toHaveBeenCalled()
      expect(mockStatus.textContent).toContain('Invalid players count')

      expect(handleActSceneChatCommand('/players 9', mockEngine, mockStatus)).toBe(false)
      expect(mockEngine.setPlayers).not.toHaveBeenCalled()

      expect(handleActSceneChatCommand('hello world', mockEngine, mockStatus)).toBe(false)
    })

    it('reports current players setting when invoked without a number', () => {
      const mockEngine = { gamePlayers: 3, setPlayers: vi.fn() }
      const mockStatus = { textContent: '' }

      expect(handleActSceneChatCommand('/players', mockEngine, mockStatus)).toBe(true)
      expect(mockStatus.textContent).toBe('Players currently set to 3')
    })
  })
  })
})
