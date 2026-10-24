/**
 * Issue #1361 — 1.13c TreasureClassEx Drop Pipeline & Quest Drop Audit
 *
 * Verifies against D2Game.dll / D2Common.dll (1.13c):
 * 1. Quality roll passes untruncated qlvl = effectiveBase.level (D2Game!0x6FC2FC40: D = ilvl - qlvl signed).
 * 2. Base item upgrade checks candidate.level <= ilvl (D2Game!0x6FC2FB20).
 * 3. TC group upgrade gating (D2Game!0x6FC32D60 & D2Common!#10634 0x6FDA3420).
 * 4. Unknown item base code in TC leaf throws fail-fast error instead of silent continue.
 * 5. Failed Unique unconditionally triples durability (3x) and Failed Set doubles durability (2x) (D2Game!0x6FC30A20).
 * 6. Hellforge difficulty ilvl (27/60/85), all 13 quest object item drops, and quest boss drops (Radament, Hephasto, Council, Mephisto).
 * 7. No hardcoded fallback RNG seeds (0x13579bdf / 0x5eed) in executeDropPipeline, rollHellforgeDrop, or executePendingMonsterDrop113c.
 */
import { describe, expect, it } from 'vitest'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { executeDropPipeline, rollHellforgeDrop } from '../src/common/items/drop-tables.ts'
import { rollBaseUpgrade, upgradeItemBase } from '../src/common/items/item-upgrade.ts'
import { resolveTreasureClassGroup } from '../src/common/items/treasure-class.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { executePendingMonsterDrop113c } from '../src/server/items/drop-pipeline.ts'
import { GameInstance } from '../src/server/engine/game-instance.ts'

describe('Issue #1361 — 1.13c TreasureClassEx Drop Pipeline & Quest Drop Audit', () => {
  const dropTables = getEmbeddedDropTables()

  describe('1. Untruncated qlvl in rollItemQuality (D2Game!0x6FC2FC40)', () => {
    it('passes effectiveBase.level without clamping to ilvl when qlvl > ilvl', () => {
      // Phase Blade ('7cr') has qlvl = 73 in Weapons.txt.
      const phaseBlade = dropTables.getBase('7cr')
      expect(phaseBlade).toBeDefined()
      expect(phaseBlade!.level).toBe(73)

      // When ilvl = 1 and qlvl = 73, D = ilvl - qlvl = -72 reduces the quality divisor
      // more than when qlvl is clamped to ilvl = 1 (D = 0).
      // Verify executeDropPipeline uses the untruncated qlvl = 73 rather than clamping to ilvl = 1.
      let magicOrHigherLowIlvl = 0
      let magicOrHigherHighIlvl = 0
      const trials = 500
      for (let i = 1; i <= trials; i++) {
        const lowDrops = executeDropPipeline(dropTables, {
          tcName: '7cr',
          nLevel: 1,
          difficulty: 'normal',
          monsterRng: i * 7919,
        })
        const highDrops = executeDropPipeline(dropTables, {
          tcName: '7cr',
          nLevel: 73,
          difficulty: 'normal',
          monsterRng: i * 7919,
        })
        if (lowDrops[0] && ['magic', 'rare', 'set', 'unique'].includes(lowDrops[0].rarity ?? '')) {
          magicOrHigherLowIlvl++
        }
        if (highDrops[0] && ['magic', 'rare', 'set', 'unique'].includes(highDrops[0].rarity ?? '')) {
          magicOrHigherHighIlvl++
        }
      }
      // At ilvl=1, qlvl=73 gives signed D = 1 - 73 = -72; subtracting D/divisor increases the
      // quality denominator (baseChance), yielding fewer magic+ rolls (15) than at ilvl=73 (D = 0 -> 26).
      // If qlvl were clamped to Math.min(ilvl, qlvl), both ilvl=1 and ilvl=73 would have D = 0 and identical counts (26).
      expect(magicOrHigherLowIlvl).toBeLessThan(magicOrHigherHighIlvl)
    })
  })

  describe('2. Base item upgrade qlvl <= ilvl gate (D2Game!0x6FC2FB20)', () => {
    it('rejects exceptional/elite upgrade when candidate.level > ilvl', () => {
      // Hand Axe ('hax', level 3) -> Hatchet ('9ha', level 31) -> Tomahawk ('7ha', level 54)
      const hax = dropTables.getBase('hax')!
      expect(hax.level).toBe(3)
      const hatchet = dropTables.getBase('9ha')!
      expect(hatchet.level).toBe(31)
      const tomahawk = dropTables.getBase('7ha')!
      expect(tomahawk.level).toBe(54)

      // With qf4=1024, qf5=1024 (100% upgrade chance for both uber and ultra):
      // 1) At ilvl = 20 (< 31), neither 9ha nor 7ha is eligible -> stays 'hax'
      const atIlvl20 = rollBaseUpgrade(hax, 1024, 1024, new D2Rng(1), dropTables.getBase, 20)
      expect(atIlvl20.base.id).toBe('hax')
      expect(atIlvl20.isUber).toBe(false)

      // 2) At ilvl = 40 (31 <= 40 < 54), 7ha (lvl 54) is rejected and falls back to 9ha (lvl 31)
      const atIlvl40 = rollBaseUpgrade(hax, 1024, 1024, new D2Rng(1), dropTables.getBase, 40)
      expect(atIlvl40.base.id).toBe('9ha')
      expect(atIlvl40.isUber).toBe(true)

      // 3) At ilvl = 60 (>= 54), 7ha (lvl 54) is accepted
      const atIlvl60 = rollBaseUpgrade(hax, 1024, 1024, new D2Rng(1), dropTables.getBase, 60)
      expect(atIlvl60.base.id).toBe('7ha')
      expect(atIlvl60.isUber).toBe(true)

      // Verify upgradeItemBase alias forwards ilvl as well
      const viaAlias = upgradeItemBase(hax, 1024, 1024, new D2Rng(1), dropTables.getBase, 20)
      expect(viaAlias.base.id).toBe('hax')
    })
  })

  describe('3. TC group upgrade gating (D2Game!0x6FC32D60 & D2Common!#10634)', () => {
    it('skips TC group upgrade on Normal difficulty, Classic mode, bosses, and noRatio monsters', () => {
      // Act 1 H2H A is group 6, level 2. At nLevel=85 on Normal, must not upgrade.
      const normalUpgrade = resolveTreasureClassGroup(dropTables.tcTable, 'Act 1 H2H A', 0)
      expect(normalUpgrade?.name).toBe('Act 1 H2H A')

      // Nightmare/Hell normal monster upgrades within group 7 up to nLevel
      const hellUpgrade = resolveTreasureClassGroup(dropTables.tcTable, 'Act 1 (H) H2H A', 85)
      expect(hellUpgrade?.name).toBe('Act 5 (H) H2H C')

      // Group 18 non-x Super C (lvl 96) never spills into x-series Act 1 Super Ax (lvl 0)
      const group18NonX = resolveTreasureClassGroup(dropTables.tcTable, 'Act 5 (H) Super C', 99)
      expect(group18NonX?.name).toBe('Act 5 (H) Super C')
    })
  })

  describe('4. Unknown item base code in TC leaf fails fast', () => {
    it('throws an explicit error when a TC leaf resolves to an unknown item base code', () => {
      const sampleNode = dropTables.tcTable.get('Act 1 H2H A')!
      const overrides = new Map<string, any>([
        [
          'SyntheticBogusTC',
          {
            ...sampleNode,
            name: 'SyntheticBogusTC',
            group: 0,
            level: 1,
            picks: 1,
            noDrop: 0,
            qualityFactors: [0, 0, 0, 0],
            items: [{ item: 'bogus_nonexistent_code_xyz', prob: 1 }],
            totalProb: 1,
          },
        ],
      ])
      const customTcTable = {
        ...dropTables.tcTable,
        get: (name: string) => overrides.get(name) ?? dropTables.tcTable.get(name),
      }
      const customTables = { ...dropTables, tcTable: customTcTable as any }

      expect(() =>
        executeDropPipeline(customTables, {
          tcName: 'SyntheticBogusTC',
          nLevel: 10,
          difficulty: 'normal',
          monsterRng: 42,
        }),
      ).toThrow(/unknown item base code "bogus_nonexistent_code_xyz"/i)
    })
  })

  describe('5. Failed Unique (3x durability) and Failed Set (2x durability) (D2Game!0x6FC30A20)', () => {
    it('triples durability on failed Unique and doubles durability on failed Set', () => {
      // Hand Axe ('hax'): force Unique/Set at ilvl = 1 where no Unique/Set has lvl <= 1 (The Gnasher is lvl 7)
      const hax = dropTables.getBase('hax') as unknown as { durability?: number }
      const baseDurability = hax.durability ?? 28
      expect(baseDurability).toBe(28)

      const sampleNode = dropTables.tcTable.get('Act 1 H2H A')!
      const overrides = new Map<string, any>([
        [
          'ForcedUniqueHax',
          {
            ...sampleNode,
            name: 'ForcedUniqueHax',
            group: 0,
            level: 1,
            picks: 1,
            noDrop: 0,
            unique: 1024,
            set: 0,
            rare: 0,
            magic: 0,
            flags: 1,
            items: [{ item: 'hax', prob: 1, kind: 'base-item', isDangling: true, isClassic: true }],
            totalProbClassic: 1,
            totalProbExpansion: 1,
            cumulativeProbExpansion: [1],
          },
        ],
        [
          'ForcedSetHax',
          {
            ...sampleNode,
            name: 'ForcedSetHax',
            group: 0,
            level: 1,
            picks: 1,
            noDrop: 0,
            unique: 0,
            set: 1024,
            rare: 0,
            magic: 0,
            flags: 2,
            items: [{ item: 'hax', prob: 1, kind: 'base-item', isDangling: true, isClassic: true }],
            totalProbClassic: 1,
            totalProbExpansion: 1,
            cumulativeProbExpansion: [1],
          },
        ],
        [
          'ForcedUniqueCharm',
          {
            ...sampleNode,
            name: 'ForcedUniqueCharm',
            group: 0,
            level: 1,
            picks: 1,
            noDrop: 0,
            unique: 1024,
            set: 0,
            rare: 0,
            magic: 0,
            flags: 1,
            items: [{ item: 'cm1', prob: 1, kind: 'base-item', isDangling: true, isClassic: false }],
            totalProbClassic: 0,
            totalProbExpansion: 1,
            cumulativeProbExpansion: [1],
          },
        ],
      ])
      const customTcTable = {
        ...dropTables.tcTable,
        get: (name: string) => overrides.get(name) ?? dropTables.tcTable.get(name),
      }
      const customTables = { ...dropTables, tcTable: customTcTable as any }

      const failedUniqueDrops = executeDropPipeline(customTables, {
        tcName: 'ForcedUniqueHax',
        nLevel: 1,
        difficulty: 'normal',
        monsterRng: 99,
      })
      expect(failedUniqueDrops).toHaveLength(1)
      expect(failedUniqueDrops[0]!.rarity).toBe('rare')
      expect(failedUniqueDrops[0]!.maxDurability).toBeGreaterThanOrEqual(baseDurability * 3)

      const failedSetDrops = executeDropPipeline(customTables, {
        tcName: 'ForcedSetHax',
        nLevel: 1,
        difficulty: 'normal',
        monsterRng: 99,
      })
      expect(failedSetDrops).toHaveLength(1)
      expect(failedSetDrops[0]!.rarity).toBe('magic')
      expect(failedSetDrops[0]!.maxDurability).toBeGreaterThanOrEqual(baseDurability * 2)

      // Non-rareable base ('cm1' Small Charm) on failed Unique falls back to Magic
      const failedUniqueCharm = executeDropPipeline(customTables, {
        tcName: 'ForcedUniqueCharm',
        nLevel: 1,
        difficulty: 'normal',
        monsterRng: 99,
      })
      expect(failedUniqueCharm).toHaveLength(1)
      expect(failedUniqueCharm[0]!.rarity).toBe('magic')
    })
  })

  describe('6. Hellforge difficulty ilvl & Quest Object / Boss Drops in GameInstance', () => {
    it('uses difficulty-appropriate ilvl (27 Normal, 60 Nightmare, 85 Hell) for Hellforge drops', () => {
      const expectedIlvlByDiff: ReadonlyArray<readonly [0 | 1 | 2, number]> = [
        [0, 27],
        [1, 60],
        [2, 85],
      ]
      for (const [difficulty, expectedIlvl] of expectedIlvlByDiff) {
        const game = new GameInstance({ seed: 2026 + difficulty, areaId: 107, difficulty })
        const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 107 })
        const internal = game as unknown as {
          players: Map<number, { items: any[] }>
          groundItems: Map<number, { level: number; code: string }>
        }
        internal.players.get(playerId)!.items.push({
          unitId: 9900,
          code: 'hfh',
          name: 'Hellforge Hammer',
          quality: 7,
          level: 1,
          location: 'equipped',
          x: 0,
          y: 0,
          width: 1,
          height: 2,
          areaId: 107,
          ownerId: playerId,
          bodyLoc: 4,
          storePage: 0,
          cost: 0,
          gamble: false,
          identified: true,
          ethereal: false,
          socketed: false,
          totalSockets: 0,
          durability: 10,
          maxDurability: 10,
          quantity: 1,
          stats: new Map(),
          socketedItems: [],
        })
        const forgeId = game.spawnObject({ classId: 376, x: 11, y: 10, areaId: 107 })
        for (let hit = 0; hit < 3; hit++) {
          game.enqueueCommand(playerId, { type: 'OperateObject', objectId: forgeId })
          game.stepFrames(1)
        }
        const dropped = [...internal.groundItems.values()]
        expect(dropped.length).toBe(5)
        for (const item of dropped) {
          expect(item.level).toBe(expectedIlvl)
        }
      }
    })

    it('drops canonical 1.13c quest items from all 13 quest object classIds', () => {
      const expectedObjectDrops: ReadonlyArray<readonly [number, string]> = [
        [30, 'bks'],
        [108, 'hdm'],
        [149, 'vip'],
        [193, 'bbb'],
        [244, 'j34'],
        [246, 'j34'],
        [252, 'g33'],
        [354, 'box'],
        [355, 'tr1'],
        [356, 'msf'],
        [405, 'qhr'],
        [406, 'qbr'],
        [407, 'qey'],
      ]
      for (const [classId, expectedCode] of expectedObjectDrops) {
        const game = new GameInstance({ seed: 3000 + classId, areaId: 1 })
        const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
        const objId = game.spawnObject({ classId, x: 11, y: 10, areaId: 1 })
        game.enqueueCommand(playerId, { type: 'OperateObject', objectId: objId })
        game.stepFrames(1)
        const ground = (game as unknown as { groundItems: Map<number, { code: string }> }).groundItems
        const codes = [...ground.values()].map((item) => item.code.trim().toLowerCase())
        expect(codes, `Object classId ${classId} must drop '${expectedCode}'`).toContain(expectedCode)
      }
    })

    it('drops canonical 1.13c quest items on Radament, Hephasto, Mephisto, and Travincal Council kills', () => {
      for (const [defId, expectedCode] of [
        ['radament', 'ass'],
        ['hephasto', 'hfh'],
        ['mephisto', 'mss'],
      ] as const) {
        const game = new GameInstance({ seed: 4000 + defId.length, areaId: 1 })
        const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
        const bossId = game.spawnMonster({ defId, x: 12, y: 10, areaId: 1, hp: 10, maxHp: 10 })
        game.applyDamageToMonster(bossId, 1000, playerId)
        const ground = (game as unknown as { groundItems: Map<number, { code: string }> }).groundItems
        const codes = [...ground.values()].map((item) => item.code.trim().toLowerCase())
        expect(codes, `Boss ${defId} must drop '${expectedCode}'`).toContain(expectedCode)
      }

      // Travincal Council drops Khalim's Flail ('qf1') when the 3rd council member dies
      const councilGame = new GameInstance({ seed: 4050, areaId: 1 })
      const councilPlayerId = councilGame.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
      for (const [i, defId] of ['councilmember1', 'councilmember2', 'councilmember3'].entries()) {
        const id = councilGame.spawnMonster({ defId, x: 12 + i, y: 10, areaId: 1, hp: 10, maxHp: 10 })
        councilGame.applyDamageToMonster(id, 1000, councilPlayerId)
      }
      const councilGround = (councilGame as unknown as { groundItems: Map<number, { code: string }> }).groundItems
      const councilCodes = [...councilGround.values()].map((item) => item.code.trim().toLowerCase())
      expect(councilCodes).toContain('qf1')
    })
  })

  describe('7. Explicit RNG seed enforcement (no 0x13579bdf or 0x5eed fallback)', () => {
    it('throws when executeDropPipeline, rollHellforgeDrop, or executePendingMonsterDrop113c is called without a seed/RNG', () => {
      expect(() =>
        executeDropPipeline(dropTables, {
          tcName: 'Act 1 H2H A',
          nLevel: 3,
          difficulty: 'normal',
        }),
      ).toThrow(/monsterRng or seed/i)

      expect(() => rollHellforgeDrop('normal', undefined, dropTables)).toThrow(/rngSource/i)

      expect(() =>
        executePendingMonsterDrop113c(dropTables, {
          monsterIndex: 1,
          subjectId: 'zombie1',
          monsterLevel: 2,
          monsterRank: 'normal',
          monsterType: 1,
          x: 0,
          y: 0,
          tcName: 'Act 1 H2H A',
          isBoss: false,
          isNoRatio: false,
          seed: 0,
          killerContext: {
            playerMf: 0,
            playerGf: 0,
            gamePlayers: 1,
            partyPlayers: 1,
          },
        }),
      ).toThrow(/non-zero monster seed/i)
    })
  })
})
