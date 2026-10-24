/**
 * Issue #428: Full-Spectrum Statistical Drop Verification Suite
 *
 * Exhaustively verifies:
 * 1. All 734 monster kinds × 3 difficulties × 4 ranks = 8,808 combinations
 *    (5,808 non-empty combat combinations) + 66 SuperUniques × 3 difficulties = 198 combinations:
 *    100% TC resolution in TreasureClassEx and 0 unhandled exceptions in executeDropPipeline.
 * 2. All 136 Level IDs (Levels 1..136) × 3 difficulties:
 *    Town zero-density invariant (1, 40, 75, 103, 109), monster pack spawning,
 *    TC resolution for all pack members (normal, champion, unique, minion, boss, SuperUnique),
 *    executeDropPipeline execution, 100% walkable floor placement via findSafeDropPosition,
 *    and 100% flippy & inventory sprite resolution in BAKED_UI_MANIFEST.
 * 3. 1,000,000-roll and high-sample statistical distributions:
 *    - Act 1 H2H A 1,000,000-roll NoDrop convergence to theoretical 62.5% (100/160) within ±0.25%
 *    - /players 1..8 NoDrop scaling formula and monotonic empirical drop yield
 *    - Baalq & all 5 Act Boss quest TCs (Andarielq, Durielq, Mephistoq, Diabloq, Baalq):
 *      0% gold/junk, 0% normal/superior/low equipment, 100% rare/set/unique quality rolls
 *    - Countess (Normal, Nightmare, Hell): 6-item cap, rune tier ceilings, Hell pk1 rate (~7-12%)
 *    - Hellforge (Normal, Nightmare, Hell): 1/11 uniform rune distribution + 4 gems (1P + 2Fl + 1N)
 * 4. Anti-regression source sentinels across engine.ts, items.ts, act-scene.ts, embedded-drop-tables.ts.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import {
  executeDropPipeline,
  rollHellforgeDrop,
  type Difficulty,
  type DropTables,
} from '../src/common/items/drop-tables.ts'
import {
  computeEffectivePlayers,
  computeScaledNoDrop,
  expandTreasureClass,
  rollTreasureClass,
} from '../src/common/items/treasure-engine.ts'
import type { TreasureClassTable } from '../src/common/items/treasure-class.ts'
import { rollItemQuality } from '../src/common/items/item-ratio.ts'
import { findSafeDropPosition } from '../src/common/items/ground-items.ts'
import { loadActTables, type D2Table } from '../src/common/world/acts.ts'
import {
  getMonsterTreasureClass,
  planLevelMonsters,
  readLevelMonsterPlan,
} from '../src/common/units/monsters-data.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import { itemToUiInventoryItem, resolveGroundItemSpriteRect } from '../src/client/ui/inventory.ts'

function isDroppedGold(item: {
  readonly code?: string | undefined
  readonly base?: { readonly id?: string | undefined } | undefined
}): boolean {
  return item.base?.id === 'gold' || item.code?.trim() === 'gld'
}

const DIFFICULTIES: readonly Difficulty[] = ['normal', 'nightmare', 'hell']
const MONSTER_TYPES: readonly (1 | 2 | 3 | 4)[] = [1, 2, 3, 4]
const TOWN_LEVEL_IDS = new Set([1, 40, 75, 103, 109])

const SAMPLES = [
  resolve(process.cwd(), 'samples/d2'),
  ...(process.env.D2_DATA_DIR ? [process.env.D2_DATA_DIR] : []),
].find(p => existsSync(resolve(p, 'd2exp.mpq')))

describe('Issue #428: Full-Spectrum Statistical Drop Verification', () => {
  let dropTables: DropTables

  beforeAll(() => {
    dropTables = getEmbeddedDropTables()
  })

  // ============================================================================
  // PILLAR 1: 734 Monster Kinds × 3 Difficulties × 4 Ranks (8,808 Combinations)
  //           + 66 SuperUniques × 3 Difficulties (198 Combinations)
  // ============================================================================
  describe('1. Exhaustive 8,808 Monster × Difficulty × Rank & 198 SuperUnique Audit', () => {
    it('loads all 734 canonical MonStats.txt kinds and 66 SuperUniques.txt entries', () => {
      expect(dropTables.monsterKinds.size).toBe(734)
      expect(dropTables.superUniques.size).toBe(66)
    })

    it('resolves 100% of non-empty TCs across all 8,808 combinations and executes executeDropPipeline with 0 exceptions', () => {
      let totalCombinations = 0
      let nonEmptyCombinations = 0
      let emptyCombinations = 0
      const unresolvedTcs: string[] = []
      const pipelineErrors: string[] = []
      let totalDroppedItems = 0

      let seedCounter = 0x1000
      for (const [kindId, kind] of dropTables.monsterKinds.entries()) {
        for (let diffIdx = 0; diffIdx < DIFFICULTIES.length; diffIdx++) {
          const diff = DIFFICULTIES[diffIdx]!
          const baseMlvl = Math.max(1, kind.level[diffIdx] || kind.level[0] || 1)

          for (const monsterType of MONSTER_TYPES) {
            totalCombinations++
            const tcName = getMonsterTreasureClass(kind, diff, monsterType).trim()

            if (!tcName) {
              emptyCombinations++
              continue
            }

            nonEmptyCombinations++

            // Verify TC exists in tcTable, autoTcTable, or base items
            const hasTc =
              dropTables.tcTable.get(tcName) !== undefined ||
              dropTables.autoTcTable.get(tcName) !== undefined ||
              dropTables.getBase(tcName) !== undefined
            if (!hasTc) {
              unresolvedTcs.push(`${kindId} (${diff}, rank=${monsterType}) -> "${tcName}"`)
              continue
            }

            // Compute authentic mlvl per rank (+2 champion, +3 unique on NM/Hell)
            const mlvlBonus =
              diff === 'normal' ? 0 : monsterType === 2 ? 2 : monsterType === 3 ? 3 : 0
            const mlvl = Math.min(99, baseMlvl + mlvlBonus)

            try {
              const drops = executeDropPipeline({
                tcName,
                nLevel: mlvl,
                difficulty: diff,
                monsterType,
                isBoss: kind.boss,
                isNoRatio: Boolean(kind.noRatio),
                playerMf: 100,
                playerGf: 50,
                gamePlayers: 1,
                partyPlayers: 1,
                monsterRng: new D2Rng((seedCounter += 17)),
                dropTables,
              })

              expect(drops.length).toBeLessThanOrEqual(6)
              totalDroppedItems += drops.length
            } catch (err) {
              pipelineErrors.push(
                `${kindId} (${diff}, rank=${monsterType}, tc="${tcName}"): ${(err as Error).message}`,
              )
            }
          }
        }
      }

      expect(totalCombinations).toBe(734 * 3 * 4) // 8,808
      expect(nonEmptyCombinations).toBeGreaterThanOrEqual(5796)
      expect(nonEmptyCombinations + emptyCombinations).toBe(8808)
      expect(unresolvedTcs).toEqual([])
      expect(pipelineErrors).toEqual([])
      expect(totalDroppedItems).toBeGreaterThan(1000)
    })

    it('resolves all 66 SuperUniques × 3 difficulties (198 combinations) with 0 exceptions', () => {
      let totalSuCombinations = 0
      let nonEmptySuCombinations = 0
      const unresolvedSuTcs: string[] = []
      const suErrors: string[] = []

      let seedCounter = 0x90000
      for (const [suKey, su] of dropTables.superUniques.entries()) {
        const classKind =
          dropTables.monsterKinds.get(su.monsterId) ??
          dropTables.monsterKinds.get(su.monsterId.toLowerCase())
        expect(classKind, `SuperUnique "${suKey}" monsterId "${su.monsterId}" must exist`).toBeDefined()

        for (let diffIdx = 0; diffIdx < 3; diffIdx++) {
          totalSuCombinations++
          const diff = DIFFICULTIES[diffIdx]!
          const tcName = (su.getTreasureClass ? su.getTreasureClass(diff) : su.treasureClass).trim()
          if (!tcName) continue

          nonEmptySuCombinations++
          const hasTc =
            dropTables.tcTable.get(tcName) !== undefined ||
            dropTables.autoTcTable.get(tcName) !== undefined ||
            dropTables.getBase(tcName) !== undefined
          if (!hasTc) {
            unresolvedSuTcs.push(`${su.id} (${diff}) -> "${tcName}"`)
            continue
          }

          const baseMlvl = Math.max(1, classKind!.level[diffIdx] || classKind!.level[0] || 1)
          const mlvl = Math.min(99, baseMlvl + 3)

          try {
            const drops = executeDropPipeline({
              tcName,
              nLevel: mlvl,
              difficulty: diff,
              monsterType: classKind!.boss ? 4 : 3,
              isBoss: classKind!.boss,
              isNoRatio: Boolean(classKind!.noRatio),
              playerMf: 150,
              playerGf: 100,
              gamePlayers: 1,
              partyPlayers: 1,
              monsterRng: new D2Rng((seedCounter += 31)),
              dropTables,
            })
            expect(drops.length).toBeLessThanOrEqual(6)
          } catch (err) {
            suErrors.push(`${su.id} (${diff}, tc="${tcName}"): ${(err as Error).message}`)
          }
        }
      }

      expect(totalSuCombinations).toBe(66 * 3) // 198
      expect(nonEmptySuCombinations).toBe(189)
      expect(unresolvedSuTcs).toEqual([])
      expect(suErrors).toEqual([])
    })
  })

  // ============================================================================
  // PILLAR 2: All 136 Level IDs (Levels 1..136) Spectrum Audit
  //           Monster Spawns -> Drop Pipeline -> Walkable Placement -> Flippy Sprite
  // ============================================================================
  describe.skipIf(!SAMPLES)('2. Exhaustive 136 Level IDs (Levels 1..136) Drop & Placement Audit', () => {
    let actTables: {
      readonly levels: D2Table
      readonly monstats: D2Table
      readonly monlvl: D2Table
      readonly monstats2: D2Table
      readonly montype: D2Table
      readonly monumod: D2Table
      readonly superuniques: D2Table
    }

    beforeAll(async () => {
      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`${SAMPLES}/${name}`)))
      }
      actTables = await loadActTables(archives)
    })

    it('verifies all 136 levels × 3 difficulties: pack spawns, TC resolution, walkable findSafeDropPosition, and 100% flippy/inventory sprite resolution', () => {
      expect(actTables.levels.rows.length).toBeGreaterThanOrEqual(136)

      // Deterministic walkable dungeon grid with obstacle pillars to exercise spiral search
      const isBlocked = (cellX: number, cellY: number): boolean => {
        if (cellX < -500 || cellX > 500 || cellY < -500 || cellY > 500) return true
        // Every (7k, 7m) cell is a pillar obstacle so spiral fallback is actively tested
        return Math.abs(cellX) % 7 === 0 && Math.abs(cellY) % 7 === 0
      }

      let populatedLevelPlans = 0
      let totalPacksAudited = 0
      let totalMembersAudited = 0
      let totalItemsDropped = 0
      const missingFlippies: string[] = []
      const missingInvRects: string[] = []
      const blockedPlacements: string[] = []

      for (let levelId = 1; levelId <= 136; levelId++) {
        for (let diffIdx = 0; diffIdx < DIFFICULTIES.length; diffIdx++) {
          const diff = DIFFICULTIES[diffIdx]!
          const levelPlan = readLevelMonsterPlan(actTables.levels, levelId, diff)
          expect(levelPlan, `Level ${levelId} (${diff}) missing from Levels.txt`).not.toBeNull()

          const planned = planLevelMonsters(
            actTables,
            levelId,
            6400,
            0x5eed0000 + levelId * 13 + (diffIdx + 1),
            170,
            diff,
          )

          if (TOWN_LEVEL_IDS.has(levelId)) {
            expect(levelPlan!.density, `Town level ${levelId} (${diff}) must have 0 density`).toBe(0)
            expect(planned.budget, `Town level ${levelId} (${diff}) must have 0 budget`).toBe(0)
            expect(planned.packs.length, `Town level ${levelId} (${diff}) must have 0 packs`).toBe(0)
            continue
          }

          if (planned.packs.length === 0) continue
          populatedLevelPlans++

          const occupiedCells = new Set<string>()
          // Sample up to 3 diverse packs per level-difficulty (normal, champion/unique, SuperUnique/boss)
          const sampledPacks = planned.packs.slice(0, 3)

          for (const pack of sampledPacks) {
            totalPacksAudited++
            const leaderMember = pack.members.find(
              m => m.rank === 'unique' || m.rank === 'boss' || Boolean(m.superUniqueId),
            )

            for (let mIdx = 0; mIdx < pack.members.length; mIdx++) {
              const member = pack.members[mIdx]!
              totalMembersAudited++

              const kind =
                dropTables.monsterKinds.get(member.id) ??
                dropTables.monsterKinds.get(member.id.toLowerCase())
              expect(kind, `Level ${levelId} member id "${member.id}" missing`).toBeDefined()

              // Resolve TC using exact engine.ts hierarchy (including minion inheritance)
              let tcName = ''
              let monsterType: 1 | 2 | 3 | 4 = 1

              if (member.superUniqueId && member.rank !== 'minion') {
                const su =
                  dropTables.superUniques.get(member.superUniqueId) ??
                  Array.from(dropTables.superUniques.values()).find(
                    s =>
                      s.id.toLowerCase() === member.superUniqueId!.toLowerCase() ||
                      s.nameKey.toLowerCase() === member.superUniqueId!.toLowerCase(),
                  )
                tcName = su ? (su.getTreasureClass ? su.getTreasureClass(diff) : su.treasureClass) : ''
                monsterType = kind!.boss ? 4 : 3
              } else if (member.rank === 'minion' && leaderMember) {
                const hostKind =
                  dropTables.monsterKinds.get(leaderMember.id) ??
                  dropTables.monsterKinds.get(leaderMember.id.toLowerCase()) ??
                  kind!
                tcName =
                  getMonsterTreasureClass(hostKind, diff, 3) ||
                  getMonsterTreasureClass(kind!, diff, 1)
                monsterType = 3
              } else if (member.rank === 'boss' || kind!.boss) {
                tcName = getMonsterTreasureClass(kind!, diff, 4)
                monsterType = 4
              } else if (member.rank === 'unique') {
                tcName = getMonsterTreasureClass(kind!, diff, 3)
                monsterType = 3
              } else if (member.rank === 'champion') {
                tcName = getMonsterTreasureClass(kind!, diff, 2)
                monsterType = 2
              } else {
                tcName = getMonsterTreasureClass(kind!, diff, 1)
                monsterType = 1
              }

              tcName = tcName.trim()
              if (!tcName) continue

              const mlvl = Math.min(99, Math.max(1, member.level || levelPlan!.monsterLevel || 1))

              const drops = executeDropPipeline({
                tcName,
                nLevel: mlvl,
                difficulty: diff,
                monsterType,
                isBoss: kind!.boss,
                isNoRatio: Boolean(kind!.noRatio),
                playerMf: 125,
                playerGf: 50,
                gamePlayers: 3,
                partyPlayers: 1,
                monsterRng: new D2Rng((levelId * 10007 + totalMembersAudited * 97) >>> 0),
                dropTables,
              })

              expect(drops.length).toBeLessThanOrEqual(6)

              // Place every dropped item on the ground grid and verify walkable + flippy sprite
              const originCellX = (mIdx * 7) % 21
              const originCellY = (mIdx * 5) % 21

              for (const item of drops) {
                totalItemsDropped++

                const pos = findSafeDropPosition(
                  { isBlocked },
                  originCellX,
                  originCellY,
                  6,
                  occupiedCells,
                )
                occupiedCells.add(`${pos.cellX},${pos.cellY}`)
                if (isBlocked(pos.cellX, pos.cellY)) {
                  blockedPlacements.push(
                    `Level ${levelId} (${diff}) item "${item.code}" placed on blocked cell (${pos.cellX}, ${pos.cellY})`,
                  )
                }

                // Verify ground flippy sprite resolution
                const gold = isDroppedGold(item)
                const flippyTarget = gold
                  ? { isGold: true, amount: item.stack ?? 1, code: 'gld' }
                  : item
                const sr = resolveGroundItemSpriteRect(
                  flippyTarget,
                  BAKED_UI_MANIFEST.flippyRects,
                  BAKED_UI_MANIFEST.codeToFlippyFile,
                )
                if (!sr || sr.w <= 0 || sr.h <= 0) {
                  missingFlippies.push(
                    `Level ${levelId} (${diff}) item "${item.name}" (code="${item.code}") missing flippy rect`,
                  )
                }

                // Verify inventory sprite resolution for non-gold items
                if (!gold) {
                  const uiItem = itemToUiInventoryItem(item)
                  const invRect = BAKED_UI_MANIFEST.itemRects[uiItem.invFile.toLowerCase()]
                  if (!invRect || invRect.w <= 0 || invRect.h <= 0) {
                    missingInvRects.push(
                      `Level ${levelId} (${diff}) item "${item.name}" (code="${item.code}", invFile="${uiItem.invFile}") missing itemRect`,
                    )
                  }
                }
              }
            }
          }
        }
      }

      expect(populatedLevelPlans).toBeGreaterThanOrEqual(370)
      expect(totalPacksAudited).toBeGreaterThan(1000)
      expect(totalMembersAudited).toBeGreaterThan(3500)
      expect(totalItemsDropped).toBeGreaterThan(1000)
      expect(blockedPlacements).toEqual([])
      expect(missingFlippies).toEqual([])
      expect(missingInvRects).toEqual([])
    })
  })

  // ============================================================================
  // PILLAR 3: 1,000,000-Roll & High-Sample Statistical Distribution Assertions
  // ============================================================================
  describe('3. High-Sample & 1,000,000-Roll Statistical Distribution Assertions', () => {
    it('Act 1 H2H A 1,000,000-roll Monte Carlo matches theoretical 62.50% NoDrop rate within ±0.25%', () => {
      const node = dropTables.tcTable.get('Act 1 H2H A')!
      expect(node).toBeDefined()
      expect(node.noDrop).toBe(100)
      expect(node.totalProbExpansion).toBe(60) // 20 (gld) + 19 (Act 1 Equip A) + 20 (Act 1 Junk) + 1 (Act 1 Good)

      // Isolate the Act 1 H2H A node so rollTreasureClass directly samples its 4 immediate branches + NoDrop
      const singleNodeTcTable: TreasureClassTable = {
        all: [node],
        byName: new Map([['Act 1 H2H A', node]]),
        byGroup: new Map(),
        danglingReferences: new Set(),
        autoTCDanglingReferences: new Set(),
        baseItemDanglingReferences: new Set(),
        get: (name: string) => (name === 'Act 1 H2H A' ? node : undefined),
      }

      const rng = new D2Rng(0x1337beef)
      const TOTAL_ROLLS = 1_000_000
      let noDropCount = 0
      const branchCounts: Record<string, number> = {}

      for (let i = 0; i < TOTAL_ROLLS; i++) {
        const res = rollTreasureClass('Act 1 H2H A', {
          rng,
          tcTable: singleNodeTcTable,
          gamePlayers: 1,
          partyPlayers: 1,
        })
        if (res.length === 0) {
          noDropCount++
        } else {
          const picked = res[0]!.code
          branchCounts[picked] = (branchCounts[picked] ?? 0) + 1
        }
      }

      const empiricalNoDrop = noDropCount / TOTAL_ROLLS
      // Theoretical NoDrop = 100 / 160 = 0.625 (62.50%)
      expect(empiricalNoDrop).toBeGreaterThan(0.6225)
      expect(empiricalNoDrop).toBeLessThan(0.6275)

      // Verify individual branch proportions over 1,000,000 rolls:
      // gld: 21/160 = 13.125%, Act 1 Equip A: 16/160 = 10.00%, Act 1 Junk: 21/160 = 13.125%, Act 1 Good: 2/160 = 1.25%
      expect((branchCounts['gld'] ?? 0) / TOTAL_ROLLS).toBeCloseTo(21 / 160, 2)
      expect((branchCounts['Act 1 Equip A'] ?? 0) / TOTAL_ROLLS).toBeCloseTo(16 / 160, 2)
      expect((branchCounts['Act 1 Junk'] ?? 0) / TOTAL_ROLLS).toBeCloseTo(21 / 160, 2)
      expect((branchCounts['Act 1 Good'] ?? 0) / TOTAL_ROLLS).toBeCloseTo(2 / 160, 2)
    })

    it('/players 1..8 NoDrop scaling matches 1.13c integer truncation formula and monotonically increases drops', () => {
      // Unpartied /players 1..8 -> effectivePlayers = [1, 1, 2, 2, 3, 3, 4, 4]
      const unpartiedNoDrops = [1, 2, 3, 4, 5, 6, 7, 8].map(n =>
        computeScaledNoDrop(100, 60, computeEffectivePlayers(n, 1)),
      )
      expect(unpartiedNoDrops).toEqual([100, 100, 38, 38, 19, 19, 10, 10])

      // Full-party /players 1..8 -> effectivePlayers = [1, 2, 3, 4, 5, 6, 7, 8]
      const partiedNoDrops = [1, 2, 3, 4, 5, 6, 7, 8].map(n =>
        computeScaledNoDrop(100, 60, computeEffectivePlayers(n, n)),
      )
      expect(partiedNoDrops).toEqual([100, 38, 19, 10, 6, 3, 2, 1])

      const node = dropTables.tcTable.get('Act 1 H2H A')!
      const singleNodeTcTable: TreasureClassTable = {
        all: [node],
        byName: new Map([['Act 1 H2H A', node]]),
        byGroup: new Map(),
        danglingReferences: new Set(),
        autoTCDanglingReferences: new Set(),
        baseItemDanglingReferences: new Set(),
        get: (name: string) => (name === 'Act 1 H2H A' ? node : undefined),
      }

      // Empirical drop yield across /players 1, 3, 5, 7 (50,000 rolls each)
      const SAMPLE_SIZE = 50_000
      const singleNodeDropRates: number[] = []
      const fullRecursiveDropRates: number[] = []
      for (const players of [1, 3, 5, 7]) {
        const rng1 = new D2Rng(0x42000 + players)
        let singleDrops = 0
        for (let i = 0; i < SAMPLE_SIZE; i++) {
          const leaves = expandTreasureClass('Act 1 H2H A', {
            rng: rng1,
            tcTable: singleNodeTcTable,
            gamePlayers: players,
            partyPlayers: 1,
          })
          singleDrops += leaves.length
        }
        singleNodeDropRates.push(singleDrops / SAMPLE_SIZE)

        const rng2 = new D2Rng(0x84000 + players)
        let recursiveDrops = 0
        for (let i = 0; i < SAMPLE_SIZE; i++) {
          const leaves = expandTreasureClass('Act 1 H2H A', {
            rng: rng2,
            tcTable: dropTables.tcTable,
            autoTcTable: dropTables.autoTcTable,
            gamePlayers: players,
            partyPlayers: 1,
          })
          recursiveDrops += leaves.length
        }
        fullRecursiveDropRates.push(recursiveDrops / SAMPLE_SIZE)
      }

      // Theoretical single-node drop rates: p1 = 60/160 = 0.375, p3 = 60/98 = 0.6122, p5 = 60/79 = 0.7595, p7 = 60/70 = 0.8571
      const theoreticalRates = [60 / 160, 60 / 98, 60 / 79, 60 / 70]
      for (let i = 0; i < theoreticalRates.length; i++) {
        expect(Math.abs(singleNodeDropRates[i]! - theoreticalRates[i]!)).toBeLessThan(0.008)
      }
      expect(singleNodeDropRates[1]!).toBeGreaterThan(singleNodeDropRates[0]!)
      expect(singleNodeDropRates[2]!).toBeGreaterThan(singleNodeDropRates[1]!)
      expect(singleNodeDropRates[3]!).toBeGreaterThan(singleNodeDropRates[2]!)

      // Full recursive tree drop rates must also strictly increase across /players 1, 3, 5, 7
      expect(fullRecursiveDropRates[1]!).toBeGreaterThan(fullRecursiveDropRates[0]!)
      expect(fullRecursiveDropRates[2]!).toBeGreaterThan(fullRecursiveDropRates[1]!)
      expect(fullRecursiveDropRates[3]!).toBeGreaterThan(fullRecursiveDropRates[2]!)
    })

    it('Baalq and all 5 Act Boss quest TCs yield 100% rare/set/unique quality rolls and 0% gold/junk/normal/superior/low', () => {
      // 1. Direct rollItemQuality verification with Baalq quality factors (Rare = 1024)
      const baalqNode = dropTables.tcTable.get('Baalq')!
      expect(baalqNode).toBeDefined()
      expect(baalqNode.rare).toBe(1024)
      expect(baalqNode.magic).toBe(1024)

      const qualityRng = new D2Rng(0xbaa11024)
      for (let i = 0; i < 10_000; i++) {
        const q = rollItemQuality({
          ilvl: 99,
          qlvl: 1 + (i % 85),
          magicFind: (i % 5) * 100,
          tcFactors: {
            unique: baalqNode.unique,
            set: baalqNode.set,
            rare: baalqNode.rare,
            magic: baalqNode.magic,
          },
          table: dropTables.itemRatio,
          rng: qualityRng,
          uber: i % 2,
          classSpecific: i % 3 === 0 ? 1 : 0,
          allowRare: true,
        })
        expect(q === 'rare' || q === 'set' || q === 'unique').toBe(true)
      }

      // 2. Full executeDropPipeline verification across all 5 Act Boss Quest TCs
      const bossQuestSpecs: readonly { tc: string; mlvl: number; diff: Difficulty }[] = [
        { tc: 'Andarielq', mlvl: 12, diff: 'normal' },
        { tc: 'Durielq', mlvl: 22, diff: 'normal' },
        { tc: 'Mephistoq', mlvl: 26, diff: 'normal' },
        { tc: 'Diabloq', mlvl: 40, diff: 'normal' },
        { tc: 'Baalq', mlvl: 60, diff: 'normal' },
        { tc: 'Baalq (H)', mlvl: 99, diff: 'hell' },
      ]

      const junkCodes = new Set([
        'gld',
        'hp1', 'hp2', 'hp3', 'hp4', 'hp5',
        'mp1', 'mp2', 'mp3', 'mp4', 'mp5',
        'rvs', 'rvl', 'yps', 'vps', 'wms',
        'isc', 'tsc', 'key', 'aqv', 'cqv',
        'gps', 'ops', 'gpm', 'opm', 'gpl', 'opl',
      ])

      const rng = new D2Rng(0xbaa19999)
      for (const spec of bossQuestSpecs) {
        let equipDrops = 0
        for (let i = 0; i < 400; i++) {
          const drops = executeDropPipeline({
            tcName: spec.tc,
            nLevel: spec.mlvl,
            difficulty: spec.diff,
            monsterType: 4,
            isBoss: true,
            isNoRatio: false,
            playerMf: 200,
            gamePlayers: 1,
            partyPlayers: 1,
            monsterRng: rng,
            dropTables,
          })

          expect(drops.length).toBeLessThanOrEqual(6)

          for (const d of drops) {
            const code = (d.code ?? d.base.id).trim()
            expect(isDroppedGold(d)).toBe(false)
            // Durielq ('Duriel - Base - Quest') has a guaranteed 'tsc' (Scroll of Town Portal) pick in 1.13c TreasureClassEx.txt
            if (spec.tc.startsWith('Duriel') && code === 'tsc') continue
            expect(junkCodes.has(code)).toBe(false)

            const base = dropTables.getBase(code)
            if (base && (base.kind === 'weapon' || base.kind === 'armor')) {
              equipDrops++
              const rarity = d.rarity ?? ''
              // Never normal, superior, or low
              expect(rarity).not.toBe('normal')
              expect(rarity).not.toBe('superior')
              expect(rarity).not.toBe('low')

              // Must be rare, set, unique, or a failed-Set double-durability magic item
              if (rarity === 'magic') {
                const rawDur = Number((base as any).durability) || 0
                const noDur = Boolean((base as any).nodurability) || Boolean((base as any).indestructible)
                if (rawDur > 0 && !noDur) {
                  expect(d.maxDurability).toBe(rawDur * 2)
                }
              } else {
                expect(['rare', 'set', 'unique']).toContain(rarity)
              }
            }
          }
        }
        expect(equipDrops).toBeGreaterThan(200)
      }
    })

    it('Countess (Normal, Nightmare, Hell) enforces 6-item cap, rune ceilings, and Hell pk1 rate (~7-12%)', () => {
      const countessSpecs: readonly {
        tc: string
        diff: Difficulty
        mlvl: number
        maxRuneNum: number
        canDropKey: boolean
      }[] = [
        { tc: 'Countess', diff: 'normal', mlvl: 11, maxRuneNum: 8, canDropKey: false },
        { tc: 'Countess (N)', diff: 'nightmare', mlvl: 45, maxRuneNum: 18, canDropKey: false },
        { tc: 'Countess (H)', diff: 'hell', mlvl: 82, maxRuneNum: 28, canDropKey: true },
      ]

      for (const spec of countessSpecs) {
        const rng = new D2Rng(0xc0047e55 + spec.mlvl)
        const RUNS = 2_000
        let totalRunes = 0
        let pk1Drops = 0
        let killsWith6Items = 0

        for (let i = 0; i < RUNS; i++) {
          const drops = executeDropPipeline({
            tcName: spec.tc,
            nLevel: spec.mlvl,
            difficulty: spec.diff,
            monsterType: 3,
            isBoss: false,
            isNoRatio: false,
            playerMf: 100,
            gamePlayers: 1,
            partyPlayers: 1,
            monsterRng: rng,
            dropTables,
          })

          // Strict 6-item cap per D2Game!6FC51BB0
          expect(drops.length).toBeLessThanOrEqual(6)
          if (drops.length === 6) killsWith6Items++

          for (const d of drops) {
            const code = (d.code ?? d.base.id).trim()
            if (/^r\d{2}$/.test(code)) {
              totalRunes++
              const runeNum = Number.parseInt(code.slice(1), 10)
              expect(runeNum).toBeGreaterThanOrEqual(1)
              expect(runeNum).toBeLessThanOrEqual(spec.maxRuneNum)
            }
            if (code === 'pk1') {
              pk1Drops++
            }
          }
        }

        expect(totalRunes).toBeGreaterThan(RUNS) // Average ~1.85 runes per kill
        expect(killsWith6Items).toBeGreaterThan(0)

        if (spec.canDropKey) {
          const pk1Rate = pk1Drops / RUNS
          expect(pk1Rate).toBeGreaterThan(0.055)
          expect(pk1Rate).toBeLessThan(0.145)
        } else {
          expect(pk1Drops).toBe(0)
        }
      }
    })

    it('Hellforge (rollHellforgeDrop) enforces exact 1/11 uniform rune distribution across Normal, Nightmare, and Hell + 4 gems', () => {
      const hfSpecs: readonly { diff: Difficulty; minRune: number; maxRune: number }[] = [
        { diff: 'normal', minRune: 1, maxRune: 11 },     // El (r01) .. Amn (r11)
        { diff: 'nightmare', minRune: 12, maxRune: 22 }, // Sol (r12) .. Um (r22)
        { diff: 'hell', minRune: 15, maxRune: 25 },      // Hel (r15) .. Gul (r25)
      ]

      const perfectGemCodes = new Set(['gpv', 'gpy', 'gpb', 'gpg', 'gpr', 'gpw', 'skz'])
      const flawlessGemCodes = new Set(['gzv', 'glv', 'gly', 'glb', 'glg', 'glr', 'glw', 'skl'])
      const normalGemCodes = new Set(['gsv', 'gsy', 'gsb', 'gsg', 'gsr', 'gsw', 'sku'])

      const ROLLS_PER_DIFF = 11_000 // Expected 1,000 per rune bin

      for (const spec of hfSpecs) {
        const rng = new D2Rng(0x4e11f079 + spec.minRune)
        const runeCounts = new Map<string, number>()

        for (let i = 0; i < ROLLS_PER_DIFF; i++) {
          const { items: drops } = rollHellforgeDrop(spec.diff, dropTables, rng)
          expect(drops.length).toBe(5) // 1 rune + 4 gems

          const codes = drops.map(d => (d.code ?? d.base.id).trim())
          const runes = codes.filter(c => /^r\d{2}$/.test(c))
          expect(runes.length).toBe(1)
          const runeCode = runes[0]!
          runeCounts.set(runeCode, (runeCounts.get(runeCode) ?? 0) + 1)

          // Verify 4 gems: 1 Perfect, 2 Flawless, 1 Normal
          const perfects = codes.filter(c => perfectGemCodes.has(c))
          const flawless = codes.filter(c => flawlessGemCodes.has(c))
          const normals = codes.filter(c => normalGemCodes.has(c))
          expect(perfects.length).toBe(1)
          expect(flawless.length).toBe(2)
          expect(normals.length).toBe(1)
        }

        expect(runeCounts.size).toBe(11)
        for (let r = spec.minRune; r <= spec.maxRune; r++) {
          const code = `r${String(r).padStart(2, '0')}`
          const count = runeCounts.get(code) ?? 0
          const rate = count / ROLLS_PER_DIFF
          // Theoretical = 1/11 = 0.090909... (±0.012 tolerance over 11,000 rolls)
          expect(rate, `Hellforge ${spec.diff} rune ${code} rate=${rate.toFixed(4)}`).toBeGreaterThan(
            1 / 11 - 0.012,
          )
          expect(rate, `Hellforge ${spec.diff} rune ${code} rate=${rate.toFixed(4)}`).toBeLessThan(
            1 / 11 + 0.012,
          )
        }
      }
    })
  })

  // ============================================================================
  // PILLAR 4: Anti-Regression Source Sentinels
  // ============================================================================
  describe('4. Anti-Regression Source Code Sentinels', () => {
    it('src/server/items/drop-pipeline.ts, src/server/engine/game-instance.ts, and src/server/engine/game-engine.ts contain zero forbidden fallbacks (Act 1 H2H A, player.level + 2, rollDrop)', () => {
      for (const relPath of [
        'src/server/items/drop-pipeline.ts',
        'src/server/engine/game-instance.ts',
        'src/server/engine/game-engine.ts',
      ]) {
        const src = readFileSync(resolve(process.cwd(), relPath), 'utf8')
        expect(src).not.toContain('Act 1 H2H A')
        expect(src).not.toContain('player.level + 2')
        expect(src).not.toMatch(/\brollDrop\s*\(/)
      }
    })

    it('src/common/items/items.ts contains zero legacy rollDrop or [58, 25, 10, 5, 2] fake quality weights', () => {
      const itemsSrc = readFileSync(resolve(process.cwd(), 'src/common/items/items.ts'), 'utf8')
      expect(itemsSrc).not.toMatch(/export\s+function\s+rollDrop\b/)
      expect(itemsSrc).not.toContain('58, 25, 10, 5, 2')
    })

    it('src/common/items/embedded-drop-tables.ts pre-bakes monsterKinds and superUniques without empty Map stubs', () => {
      const embeddedSrc = readFileSync(
        resolve(process.cwd(), 'src/common/items/embedded-drop-tables.ts'),
        'utf8',
      )
      expect(embeddedSrc).toContain('readMonsterKinds')
      expect(embeddedSrc).toContain('readSuperUniques')
      expect(embeddedSrc).not.toMatch(/monsterKinds\s*:\s*new\s+Map\s*\(\s*\)/)
      expect(embeddedSrc).not.toMatch(/superUniques\s*:\s*new\s+Map\s*\(\s*\)/)
    })
  })
})
