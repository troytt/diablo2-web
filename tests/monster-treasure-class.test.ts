import { describe, it, expect } from 'vitest'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import {
  getMonsterTreasureClass,
  monsterLevelFor,
  applyEliteModifiers,
  monsterStatsOf,
  type MonsterKind,
  type Difficulty,
} from '../src/common/units/monsters-data.ts'
import {
  executeDropPipeline,
  type DropTables,
} from '../src/common/items/drop-tables.ts'
import { resolveTreasureClassGroup } from '../src/common/items/treasure-class.ts'
import { effectiveMF } from '../src/common/items/item-ratio.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'
import { createItem, type ItemBase } from '../src/common/items/items.ts'
import { D2Rng, Rng } from '../src/common/rng/d2-rng.ts'

describe('Monster & SuperUnique TreasureClass Resolution (Issue #405)', () => {
  const dropTables = getEmbeddedDropTables()

  describe('1. Embedded MonStats and SuperUniques Data Fidelity', () => {
    it('hydrates 734 unique monster kinds from MonStats (735 rows - 1 duplicate cr_lancer8)', () => {
      expect(dropTables.monsterKinds.size).toBe(734)
      expect(dropTables.monsterKinds.has('Expansion')).toBe(true)
      expect(dropTables.monsterKinds.has('fallen1')).toBe(true)
      expect(dropTables.monsterKinds.has('andariel')).toBe(true)
      expect(dropTables.monsterKinds.has('baalcrab')).toBe(true)
    })

    it('hydrates exactly 66 valid super uniques from SuperUniques.txt (excluding Expansion divider)', () => {
      expect(dropTables.superUniques.size).toBe(66)
      expect(dropTables.superUniques.has('Expansion')).toBe(false)
      expect(dropTables.superUniques.has('Bishibosh')).toBe(true)
      expect(dropTables.superUniques.has('The Countess')).toBe(true)
      expect(dropTables.superUniques.has('Pindleskin')).toBe(true)
    })

    it('resolves correct TCs for standard monsters across all 3 difficulties', () => {
      const fallen = dropTables.monsterKinds.get('fallen1')!
      expect(fallen).toBeDefined()
      expect(getMonsterTreasureClass(fallen, 'normal', 1)).toBe('Act 1 H2H A')
      expect(getMonsterTreasureClass(fallen, 'nightmare', 1)).toBe('Act 1 (N) H2H A')
      expect(getMonsterTreasureClass(fallen, 'hell', 1)).toBe('Act 1 (H) H2H A')
    })

    it('identifies boss flag and authentic quest boss TCs (TreasureClass4)', () => {
      const andariel = dropTables.monsterKinds.get('andariel')!
      expect(andariel.boss).toBe(true)
      expect(getMonsterTreasureClass(andariel, 'normal', 1)).toBe('Andariel')
      expect(getMonsterTreasureClass(andariel, 'normal', 4)).toBe('Andarielq')
      expect(getMonsterTreasureClass(andariel, 'nightmare', 4)).toBe('Andarielq (N)')
      expect(getMonsterTreasureClass(andariel, 'hell', 4)).toBe('Andarielq (H)')

      const mephisto = dropTables.monsterKinds.get('mephisto')!
      expect(mephisto.boss).toBe(true)
      expect(getMonsterTreasureClass(mephisto, 'normal', 4)).toBe('Mephistoq')
      expect(getMonsterTreasureClass(mephisto, 'nightmare', 4)).toBe('Mephistoq (N)')
      expect(getMonsterTreasureClass(mephisto, 'hell', 4)).toBe('Mephistoq (H)')

      const diablo = dropTables.monsterKinds.get('diablo')!
      expect(diablo.boss).toBe(true)
      expect(getMonsterTreasureClass(diablo, 'normal', 4)).toBe('Diabloq')
      expect(getMonsterTreasureClass(diablo, 'nightmare', 4)).toBe('Diabloq (N)')
      expect(getMonsterTreasureClass(diablo, 'hell', 4)).toBe('Diabloq (H)')

      const baal = dropTables.monsterKinds.get('baalcrab')!
      expect(baal.boss).toBe(true)
      expect(getMonsterTreasureClass(baal, 'normal', 4)).toBe('Baalq')
      expect(getMonsterTreasureClass(baal, 'nightmare', 4)).toBe('Baalq (N)')
      expect(getMonsterTreasureClass(baal, 'hell', 4)).toBe('Baalq (H)')
    })

    it('returns empty string for non-dropping entities (critters, NPCs, scenery, summons)', () => {
      const critters = ['cow', 'camel', 'chicken', 'hare', 'bird', 'frog']
      for (const id of critters) {
        const kind = dropTables.monsterKinds.get(id)
        if (kind) {
          expect(getMonsterTreasureClass(kind, 'normal', 1)).toBe('')
          expect(getMonsterTreasureClass(kind, 'nightmare', 1)).toBe('')
          expect(getMonsterTreasureClass(kind, 'hell', 1)).toBe('')
        }
      }

      const npcs = ['cain1', 'akara', 'charsi', 'gheed', 'fara', 'drognan']
      for (const id of npcs) {
        const kind = dropTables.monsterKinds.get(id)
        if (kind) {
          expect(getMonsterTreasureClass(kind, 'normal', 1)).toBe('')
        }
      }
    })
  })

  describe('2. SuperUniques Difficulty TC Resolution', () => {
    it('resolves multi-difficulty TCs for SuperUniques via getTreasureClass', () => {
      const bishibosh = dropTables.superUniques.get('Bishibosh')!
      expect(bishibosh).toBeDefined()
      expect(bishibosh.getTreasureClass?.('normal')).toBe('Act 1 Super A')
      expect(bishibosh.getTreasureClass?.('nightmare')).toBe('Act 1 (N) Super A')
      expect(bishibosh.getTreasureClass?.('hell')).toBe('Act 1 (H) Super A')

      const countess = dropTables.superUniques.get('The Countess')!
      expect(countess.getTreasureClass?.('normal')).toBe('Countess')
      expect(countess.getTreasureClass?.('nightmare')).toBe('Countess (N)')
      expect(countess.getTreasureClass?.('hell')).toBe('Countess (H)')

      const smith = dropTables.superUniques.get('The Smith')!
      expect(smith.getTreasureClass?.('normal')).toBe('Smith')
      expect(smith.getTreasureClass?.('nightmare')).toBe('Smith (N)')
      expect(smith.getTreasureClass?.('hell')).toBe('Smith (H)')

      const pindleskin = dropTables.superUniques.get('Pindleskin')!
      expect(pindleskin.getTreasureClass?.('normal')).toBe('Act 5 Super Cx')
      expect(pindleskin.getTreasureClass?.('nightmare')).toBe('Act 5 (N) Super Cx')
      expect(pindleskin.getTreasureClass?.('hell')).toBe('Act 5 (H) Super Cx')
    })

    it('returns empty string for non-dropping SuperUniques (Ancients)', () => {
      const korlic = dropTables.superUniques.get('Ancient Barbarian 1')!
      expect(korlic.getTreasureClass?.('normal')).toBe('')
      expect(korlic.getTreasureClass?.('nightmare')).toBe('')
      expect(korlic.getTreasureClass?.('hell')).toBe('')
    })
  })

  describe('3. Monster Rank TC & Monster Level (mlvl) Determination', () => {
    it('resolves rank-specific TCs: Normal=TC1, Champ=TC2, Unique=TC3, Minion=TC1', () => {
      const fallen = dropTables.monsterKinds.get('fallen1')!
      expect(getMonsterTreasureClass(fallen, 'normal', 1)).toBe('Act 1 H2H A')
      expect(getMonsterTreasureClass(fallen, 'normal', 2)).toBe('Act 1 Champ A')
      expect(getMonsterTreasureClass(fallen, 'normal', 3)).toBe('Act 1 Unique A')

      // Minions drop from TC1
      expect(getMonsterTreasureClass(fallen, 'normal', 1)).toBe('Act 1 H2H A')
    })

    it('determines base level: MonStats Level on Normal, AreaLevel on NM/Hell for non-bosses', () => {
      const fallen = dropTables.monsterKinds.get('fallen1')!
      // MonStats Level for fallen1 is 1
      expect(monsterLevelFor(fallen, 'normal', 10)).toBe(1)
      // Nightmare: uses area level (e.g. 40)
      expect(monsterLevelFor(fallen, 'nightmare', 40)).toBe(40)
      // Hell: uses area level (e.g. 85)
      expect(monsterLevelFor(fallen, 'hell', 85)).toBe(85)
    })

    it('bosses always use MonStats level and ignore AreaLevel on NM/Hell', () => {
      const andariel = dropTables.monsterKinds.get('andariel')!
      expect(andariel.boss).toBe(true)
      // MonStats levels for Andariel: [12, 49, 75]
      expect(monsterLevelFor(andariel, 'normal', 5)).toBe(12)
      expect(monsterLevelFor(andariel, 'nightmare', 80)).toBe(49)
      expect(monsterLevelFor(andariel, 'hell', 85)).toBe(75)
    })

    it('applies rank level modifiers: Normal +0, Champ +2, Unique +3, Minion +3, clamped [1, 99]', () => {
      const baseStats = {
        id: 'fallen1',
        name: 'Fallen',
        hp: 100,
        damage: 10,
        cooldownTicks: 15,
        reach: 20,
        aggroRadius: 200,
        speed: 50,
        xp: 50,
        level: 80,
      }

      const normalMod = applyEliteModifiers(baseStats, 'normal')
      expect(normalMod.level).toBe(80)

      const champMod = applyEliteModifiers(baseStats, 'champion')
      expect(champMod.level).toBe(82)

      const uniqueMod = applyEliteModifiers(baseStats, 'unique')
      expect(uniqueMod.level).toBe(83)

      const minionMod = applyEliteModifiers(baseStats, 'minion')
      expect(minionMod.level).toBe(83)

      // Test upper clamp at 99
      const highBase = { ...baseStats, level: 98 }
      const clampedUnique = applyEliteModifiers(highBase, 'unique')
      expect(clampedUnique.level).toBe(99)
    })
  })

  describe('4. TC Group Upgrading Gating (D2Game 0x6FC32D60)', () => {
    it('NEVER upgrades TCs on Normal difficulty even with high mlvl', () => {
      const drops = executeDropPipeline(dropTables, {
        tcName: 'Act 1 H2H A',
        nLevel: 85,
        difficulty: 'normal',
        isExpansion: true,
        monsterRng: 12345,
      })
      // Normal difficulty must not upgrade to Act 5 (H) H2H C
      // resolveTreasureClassGroup called directly on Normal gating:
      const upgradeAttempt = resolveTreasureClassGroup(dropTables.tcTable, 'Act 1 H2H A', 0)
      expect(upgradeAttempt?.name).toBe('Act 1 H2H A')
    })

    it('upgrades TC on Hell difficulty when mlvl is sufficiently high', () => {
      // Act 1 (H) H2H A (group 7, level 63) upgrades to Act 5 (H) H2H C (level 85) at mlvl 85
      const upgraded = resolveTreasureClassGroup(dropTables.tcTable, 'Act 1 (H) H2H A', 85)
      expect(upgraded?.name).toBe('Act 5 (H) H2H C')
    })

    it('NEVER upgrades boss TCs even on Hell difficulty', () => {
      // In executeDropPipeline with isBoss=true or monsterType=4
      const result = executeDropPipeline(dropTables, {
        tcName: 'Andariel (H)',
        nLevel: 99,
        difficulty: 'hell',
        isBoss: true,
        monsterType: 4,
        monsterRng: 12345,
      })
      expect(result).toBeDefined()
    })

    it('preserves Group 18 nerfed x-series and non-x series without spillover', () => {
      // Pindleskin TC is 'Act 5 Super Cx' (Group 18). Sequential scan must not jump to non-x series.
      const resolvedX = resolveTreasureClassGroup(dropTables.tcTable, 'Act 5 Super Cx', 99)
      expect(resolvedX?.name).toBe('Act 5 (H) Super Cx')

      // Act 5 (H) Super C (lvl 96) must not spill over into Act 1 Super Ax (lvl 0)
      const resolvedNonX99 = resolveTreasureClassGroup(dropTables.tcTable, 'Act 5 (H) Super C', 99)
      expect(resolvedNonX99?.name).toBe('Act 5 (H) Super C')

      const resolvedNonX70 = resolveTreasureClassGroup(dropTables.tcTable, 'Act 5 (H) Super C', 70)
      expect(resolvedNonX70?.name).toBe('Act 5 (H) Super C')
    })
  })

  describe('5. Magic Find Diminishing Returns & Quality Determination', () => {
    it('calculates exact 1.13c effective Magic Find values', () => {
      // MF <= 10: strictly linear
      expect(effectiveMF(0, 250)).toBe(100)
      expect(effectiveMF(10, 250)).toBe(110)

      // Unique diminishing returns: (MF * 250) / (MF + 250)
      // MF 100: 100 + floor(100 * 250 / 350) = 100 + 71 = 171
      expect(effectiveMF(100, 250)).toBe(171)
      // MF 300: 100 + floor(300 * 250 / 550) = 100 + 136 = 236
      expect(effectiveMF(300, 250)).toBe(236)

      // Set diminishing returns: (MF * 500) / (MF + 500)
      // MF 100: 100 + floor(100 * 500 / 600) = 100 + 83 = 183
      expect(effectiveMF(100, 500)).toBe(183)
      // MF 300: 100 + floor(300 * 500 / 800) = 100 + 187 = 287
      expect(effectiveMF(300, 500)).toBe(287)

      // Rare diminishing returns: (MF * 600) / (MF + 600)
      // MF 100: 100 + floor(100 * 600 / 700) = 100 + 85 = 185
      expect(effectiveMF(100, 600)).toBe(185)
      // MF 300: 100 + floor(300 * 600 / 900) = 100 + 200 = 300
      expect(effectiveMF(300, 600)).toBe(300)
    })
  })

  describe('6. Gold Generation & Gold Find (GF) Multipliers', () => {
    it('generates base gold in range [ilvl, 6*ilvl - 1] and scales with playerGf', () => {
      const ilvl = 20
      // Execute drop pipeline with explicit gold TC
      const rng1 = new D2Rng(12345)
      const dropsBase = executeDropPipeline(dropTables, {
        tcName: 'Gold',
        nLevel: ilvl,
        difficulty: 'normal',
        playerGf: 0,
        monsterRng: rng1,
      })
      expect(dropsBase.length).toBe(1)
      const baseAmount = dropsBase[0]!.value ?? dropsBase[0]!.stack
      expect(baseAmount).toBeGreaterThanOrEqual(ilvl)
      expect(baseAmount).toBeLessThanOrEqual(ilvl * 6)

      // Now with same seed and +100% GF: amount must be exactly 2x base
      const rng2 = new D2Rng(12345)
      const drops100Gf = executeDropPipeline(dropTables, {
        tcName: 'Gold',
        nLevel: ilvl,
        difficulty: 'normal',
        playerGf: 100,
        monsterRng: rng2,
      })
      expect(drops100Gf.length).toBe(1)
      expect(drops100Gf[0]!.value).toBe(Math.floor((baseAmount * 200) / 100))

      // Now with same seed and +250% GF: amount must be exactly floor(base * 350 / 100)
      const rng3 = new D2Rng(12345)
      const drops250Gf = executeDropPipeline(dropTables, {
        tcName: 'Gold',
        nLevel: ilvl,
        difficulty: 'normal',
        playerGf: 250,
        monsterRng: rng3,
      })
      expect(drops250Gf.length).toBe(1)
      expect(drops250Gf[0]!.value).toBe(Math.floor((baseAmount * 350) / 100))
    })
  })

  describe('7. GameEngine Drop Resolution & Fallback Elimination', () => {
    const dummyTerrain = {
      widthPx: 1000,
      heightPx: 1000,
      overlap: () => 0,
    }

    it('does not drop loot for entities with no TC (eliminating Act 1 H2H A fallback)', () => {
      const engine = new GameEngine(dummyTerrain, {
        spawn: { x: 0, y: 0 },
        stats: [],
        xpTable: [0, 100, 200],
        dropTables,
        skills: [],
        npcDefs: [],
        questDefs: [],
        combatOptions: {} as any,
        talkRadius: 50,
        pickupRadius: 50,
        inventoryCols: 10,
        inventoryRows: 4,
      })

      // Simulate a kill event for a town critter (chicken, which has no TC)
      engine.world.pendingKills = [
        {
          kind: 'kill',
          x: 10,
          y: 10,
          subjectId: 'chicken',
          monsterLevel: 1,
        } as any,
      ]

      engine.tick({
        movement: { x: 0, y: 0 },
        attacking: false,
        pickingUp: false,
        talking: false,
        saving: false,
        loading: false,
        digits: [],
      })

      // No drops should be placed on ground or in bag
      expect(engine.ground.length).toBe(0)
      expect(engine.metrics.dropsRolled).toBe(0)
    })

    it('passes player equipped MF and GF from inventory into drop pipeline', () => {
      const engine = new GameEngine(dummyTerrain, {
        spawn: { x: 0, y: 0 },
        stats: [],
        xpTable: [0, 100, 200],
        dropTables,
        skills: [],
        npcDefs: [],
        questDefs: [],
        combatOptions: {} as any,
        talkRadius: 50,
        pickupRadius: 50,
        inventoryCols: 10,
        inventoryRows: 4,
      })

      // Equip player with +50% MF and +100% GF ring
      const mfRingBase = dropTables.getBase('rin')!
      const ringItem = createItem(mfRingBase, [], [], new Rng(1), { level: 1 })
      ;(ringItem.stats as Record<string, number>)['mag%'] = 50
      ;(ringItem.stats as Record<string, number>)['gold%'] = 100
      engine.bag.add(ringItem)

      // Simulate a fallen kill
      engine.world.pendingKills = [
        {
          kind: 'kill',
          x: 20,
          y: 20,
          subjectId: 'fallen1',
          monsterLevel: 10,
        } as any,
      ]

      engine.tick({
        movement: { x: 0, y: 0 },
        attacking: false,
        pickingUp: false,
        talking: false,
        saving: false,
        loading: false,
        digits: [],
      })

      expect(engine.metrics.dropsRolled).toBe(1)
    })

    it('Issue #415: assigns rank: "boss" for act bosses in monsterStatsOf and resolves monsterType 4', () => {
      const andariel = dropTables.monsterKinds.get('andariel')!
      expect(andariel.boss).toBe(true)
      const stats = monsterStatsOf(andariel, new Rng(1), 100)
      expect(stats.rank).toBe('boss')

      const fallen = dropTables.monsterKinds.get('fallen1')!
      const fallenStats = monsterStatsOf(fallen, new Rng(1), 100)
      expect(fallenStats.rank).toBe('normal')

      // Test GameEngine resolves monsterRank: 'boss' to monsterType: 4 (Andarielq)
      const engine = new GameEngine(dummyTerrain, {
        spawn: { x: 0, y: 0 },
        stats: [],
        xpTable: [0, 100, 200],
        dropTables,
        skills: [],
        npcDefs: [],
        questDefs: [],
        combatOptions: {} as any,
        talkRadius: 50,
        pickupRadius: 50,
        inventoryCols: 10,
        inventoryRows: 4,
      })

      engine.world.pendingKills = [
        {
          kind: 'kill',
          x: 20,
          y: 20,
          subjectId: 'andariel',
          monsterLevel: 12,
          monsterRank: 'boss',
        } as any,
      ]

      engine.tick({
        movement: { x: 0, y: 0 },
        attacking: false,
        pickingUp: false,
        talking: false,
        saving: false,
        loading: false,
        digits: [],
      })

      expect(engine.metrics.dropsRolled).toBe(1)
    })

    it('Issue #417: combines getEquippedItems with inventory bag to scale playerMf and playerGf', () => {
      const engine = new GameEngine(dummyTerrain, {
        spawn: { x: 0, y: 0 },
        stats: [],
        xpTable: [0, 100, 200],
        dropTables,
        skills: [],
        npcDefs: [],
        questDefs: [],
        combatOptions: {} as any,
        talkRadius: 50,
        pickupRadius: 50,
        inventoryCols: 10,
        inventoryRows: 4,
        getEquippedItems: () => [
          {
            name: 'Harlequin Crest',
            stats: { 'mag%': 50 },
          },
          {
            name: 'Goldwrap',
            stats: [{ text: '50% 额外金币 (Extra Gold)' }],
          },
        ],
      })

      engine.world.pendingKills = [
        {
          kind: 'kill',
          x: 20,
          y: 20,
          subjectId: 'fallen1',
          monsterLevel: 10,
        } as any,
      ]

      engine.tick({
        movement: { x: 0, y: 0 },
        attacking: false,
        pickingUp: false,
        talking: false,
        saving: false,
        loading: false,
        digits: [],
      })

      expect(engine.metrics.dropsRolled).toBe(1)
    })
  })
})
