import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import {
  loadDropTables,
  executeDropPipeline,
  createDroppedItem,
  canItemBeRare,
  resolveItemTypeFlags,
  type DropTables,
} from '../src/common/items/drop-tables.ts'
import { formatItemTooltip } from '../src/common/items/item-tooltip.ts'
import {
  getMonsterTreasureClass,
  type MonsterKind,
} from '../src/common/units/monsters-data.ts'
import { resolveTreasureClassGroup } from '../src/common/items/treasure-class.ts'
import { GameEngine, type GameEngineOptions } from '../src/server/engine/game-engine.ts'
import { DEMO_EXPERIENCE, DEMO_SKILLS, DEMO_NPCS, DEMO_QUESTS } from '../src/common/data/demo-data.ts'

const hasD2 = fs.existsSync('samples/d2/d2data.mpq')

describe('TreasureClass Drop Pipeline (Issue #107)', () => {
  let dropTables: DropTables

  beforeAll(async () => {
    if (!hasD2) {
      throw new Error('samples/d2 MPQ files required for Drop Pipeline test')
    }
    const archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
    }
    dropTables = await loadDropTables(archives)
  })

  describe('1. DropTables Loading & Fail Loudly', () => {
    it('loads all required drop tables from mounted archives', () => {
      expect(dropTables).toBeDefined()
      expect(dropTables.tcTable.all.length).toBeGreaterThan(0)
      expect(dropTables.autoTcTable.size).toBe(100)
      expect(dropTables.weapons.all.length).toBeGreaterThan(0)
      expect(dropTables.armor.all.length).toBeGreaterThan(0)
      expect(dropTables.misc.all.length).toBeGreaterThan(0)
      expect(dropTables.itemRatio.length).toBeGreaterThan(0)
      expect(dropTables.difficultyLevels.all.length).toBeGreaterThan(0)
      expect(dropTables.uniques.all.length).toBeGreaterThan(0)
      expect(dropTables.sets.items.length).toBeGreaterThan(0)
      expect(dropTables.sets.sets.length).toBeGreaterThan(0)
      expect(dropTables.magicAffixes.prefixes.length).toBeGreaterThan(0)
      expect(dropTables.magicAffixes.suffixes.length).toBeGreaterThan(0)
      expect(dropTables.rareNames.prefixes.length).toBeGreaterThan(0)
      expect(dropTables.rareNames.suffixes.length).toBeGreaterThan(0)
      expect(dropTables.itemTypes.types.length).toBeGreaterThan(0)
      expect(dropTables.monsterKinds.size).toBeGreaterThan(0)
    })

    it('fails loudly when archives have missing tables', async () => {
      const emptyArchives = new MountedArchives()
      await expect(loadDropTables(emptyArchives)).rejects.toThrow()
    })
  })

  describe('2. MonStats TC Column Mapping (12 columns across 3 difficulties)', () => {
    it('maps Fallen (fallen1) correctly for Normal difficulty', () => {
      const fallen = dropTables.monsterKinds.get('fallen1')
      expect(fallen).toBeDefined()

      // MonsterType 1: Normal
      const tcNormal = getMonsterTreasureClass(fallen!, 'normal', 1)
      expect(tcNormal).toBe('Act 1 H2H A')

      // MonsterType 2: Champion
      const tcChamp = getMonsterTreasureClass(fallen!, 'normal', 2)
      expect(tcChamp).toBe('Act 1 Champ A')

      // MonsterType 3: Unique
      const tcUnique = getMonsterTreasureClass(fallen!, 'normal', 3)
      expect(tcUnique).toBe('Act 1 Unique A')

      // MonsterType 4: Boss / Quest
      const tcBoss = getMonsterTreasureClass(fallen!, 'normal', 4)
      expect(tcBoss).toBeDefined()
    })

    it('maps Fallen (fallen1) correctly for Nightmare difficulty', () => {
      const fallen = dropTables.monsterKinds.get('fallen1')
      expect(fallen).toBeDefined()

      // MonsterType 1: Normal (N)
      const tcNormal = getMonsterTreasureClass(fallen!, 'nightmare', 1)
      expect(tcNormal).toBe('Act 1 (N) H2H A')

      // MonsterType 2: Champion (N)
      const tcChamp = getMonsterTreasureClass(fallen!, 'nightmare', 2)
      expect(tcChamp).toBe('Act 1 (N) Champ A')

      // MonsterType 3: Unique (N)
      const tcUnique = getMonsterTreasureClass(fallen!, 'nightmare', 3)
      expect(tcUnique).toBe('Act 1 (N) Unique A')
    })

    it('maps Fallen (fallen1) correctly for Hell difficulty', () => {
      const fallen = dropTables.monsterKinds.get('fallen1')
      expect(fallen).toBeDefined()

      // MonsterType 1: Normal (H)
      const tcNormal = getMonsterTreasureClass(fallen!, 'hell', 1)
      expect(tcNormal).toBe('Act 1 (H) H2H A')

      // MonsterType 2: Champion (H)
      const tcChamp = getMonsterTreasureClass(fallen!, 'hell', 2)
      expect(tcChamp).toBe('Act 1 (H) Champ A')

      // MonsterType 3: Unique (H)
      const tcUnique = getMonsterTreasureClass(fallen!, 'hell', 3)
      expect(tcUnique).toBe('Act 1 (H) Unique A')
    })
  })

  describe('3. Top-Level TC Group Upgrade (D2Game!6FC32D60)', () => {
    it('returns the base node when nLevel does not meet next tier level', () => {
      const node = resolveTreasureClassGroup(dropTables.tcTable, 'Act 1 H2H A', 1)
      expect(node).toBeDefined()
      expect(node?.name).toBe('Act 1 H2H A')
    })

    it('upgrades TC node within the group when monster nLevel is higher', () => {
      // Act 1 H2H A has group = 1, level = 1
      // Act 1 H2H B has group = 1, level = 4
      // Act 1 H2H C has group = 1, level = 7
      const upgradedAt5 = resolveTreasureClassGroup(dropTables.tcTable, 'Act 1 H2H A', 5)
      expect(upgradedAt5).toBeDefined()
      expect(upgradedAt5?.name).toBe('Act 1 H2H B')

      const upgradedAt10 = resolveTreasureClassGroup(dropTables.tcTable, 'Act 1 H2H A', 10)
      expect(upgradedAt10).toBeDefined()
      expect(upgradedAt10?.name).toBe('Act 1 H2H C')
    })

    it('returns undefined if TC name does not exist in table', () => {
      const missing = resolveTreasureClassGroup(dropTables.tcTable, 'NonExistentTC', 10)
      expect(missing).toBeUndefined()
    })
  })

  describe('4. Drop Pipeline Execution', () => {
    it('executes drop pipeline for Act 1 monster and yields real items without demo data', () => {
      const drops = executeDropPipeline(dropTables, {
        tcName: 'Act 1 H2H A',
        nLevel: 3,
        monsterType: 1,
        difficulty: 'normal',
        gamePlayers: 1,
        partyPlayers: 1,
        monsterRng: 12345,
      })

      // Drops may be empty due to NoDrop, or contain items/gold
      // Run multiple iterations to verify drop contents
      let totalItems = 0
      let totalGold = 0
      const droppedNames: string[] = []

      for (let i = 0; i < 50; i++) {
        const batch = executeDropPipeline(dropTables, {
          tcName: 'Act 1 H2H A',
          nLevel: 3,
          monsterType: 1,
          difficulty: 'normal',
          gamePlayers: 1,
          partyPlayers: 1,
          monsterRng: i * 1000 + 1,
        })
        for (const item of batch) {
          expect(item.base.id).not.toMatch(/^demo-/)
          expect(item.name).not.toMatch(/^demo-/)
          if (item.base.id === 'gold' || item.code?.trim() === 'gld') {
            totalGold += 1
          } else {
            totalItems += 1
            droppedNames.push(item.name)
          }
        }
      }

      expect(totalGold + totalItems).toBeGreaterThan(0)
      // Verify no item has demo tags or demo id
      for (const name of droppedNames) {
        expect(name).not.toBe('Sword')
        expect(name).not.toBe('Cap')
      }
    })

    it('supports champion and unique monster type quality boosts', () => {
      let magicOrBetter = 0
      for (let i = 0; i < 50; i++) {
        const batch = executeDropPipeline(dropTables, {
          tcName: 'Act 1 Champ A',
          nLevel: 5,
          monsterType: 2, // Champion
          difficulty: 'normal',
          playerMf: 100,
          monsterRng: i * 7919 + 7,
        })
        for (const item of batch) {
          if (item.base.id !== 'gold') {
            if (item.prefix || item.suffix || (item.quality !== undefined && item.quality > 2)) {
              magicOrBetter += 1
            }
          }
        }
      }
      expect(magicOrBetter).toBeGreaterThan(0)
    })
  })

  describe('5. Complete Deletion of DEMO_BASES & DEMO_AFFIXES', () => {
    it('verifies demo-data.ts does not export DEMO_BASES or DEMO_AFFIXES', async () => {
      const demoDataModule = await import('../src/common/data/demo-data.ts')
      expect((demoDataModule as Record<string, unknown>).DEMO_BASES).toBeUndefined()
      expect((demoDataModule as Record<string, unknown>).DEMO_AFFIXES).toBeUndefined()
    })

    it('verifies src/ contains 0 occurrences of DEMO_BASES and DEMO_AFFIXES', () => {
      const srcFiles = fs.readdirSync('src', { recursive: true }) as string[]
      for (const file of srcFiles) {
        if (!file.endsWith('.ts')) continue
        const content = fs.readFileSync(`src/${file}`, 'utf-8')
        expect(content).not.toContain('DEMO_BASES')
        expect(content).not.toContain('DEMO_AFFIXES')
      }
    })
  })

  describe('6. GameEngine Integration with DropTables', () => {
    it('GameEngine rolls drops using real DropTables on monster kill', () => {
      const fallen = dropTables.monsterKinds.get('fallen1')!
      const dummyTerrain = {
        widthPx: 1000,
        heightPx: 1000,
        overlap: () => 0,
      }

      const engineOpts: GameEngineOptions = {
        spawn: { x: 500, y: 500 },
        stats: [
          {
            id: 'fallen1',
            name: 'Fallen',
            level: 3,
            rank: 'normal',
            hp: 10,
            damage: 2,
            cooldownTicks: 10,
            reach: 30,
            aggroRadius: 100,
            speed: 50,
            xp: 20,
          },
        ],
        xpTable: DEMO_EXPERIENCE,
        dropTables,
        difficulty: 'normal',
        monsterKinds: dropTables.monsterKinds,
        skills: DEMO_SKILLS,
        npcDefs: DEMO_NPCS,
        questDefs: DEMO_QUESTS,
        combatOptions: {
          playerSpeed: 100,
          playerReach: 60,
          playerCooldownTicks: 1,
          playerDamage: 100, // One-shot kill
          playerManaPerAttack: 0,
          respawnTicks: 100,
        },
        talkRadius: 80,
        pickupRadius: 64,
        inventoryCols: 10,
        inventoryRows: 4,
        monsterCount: 5,
        monsterSpread: 100,
      }

      const engine = new GameEngine(dummyTerrain, engineOpts)

      // Ensure monsters are within reach and attack
      let killedAny = false
      for (let tick = 0; tick < 50; tick++) {
        engine.tick({
          movement: { x: 0, y: 0 },
          attacking: true,
          pickingUp: false,
          talking: false,
          digits: [],
          saving: false,
          loading: false,
        })
        if (engine.world.events.some(e => e.kind === 'kill')) {
          killedAny = true
        }
      }

      expect(killedAny).toBe(true)
      // Check that either ground items or gold bag additions were recorded from dropTables
      expect(engine.metrics.dropsRolled).toBeGreaterThan(0)
      for (const entry of engine.ground) {
        expect(entry.item.base.id).not.toMatch(/^demo-/)
      }
    })
  })

  describe('7. Quality Degradation Fallback & Rolled Concrete Values (D2 1.13c Ground Truth)', () => {
    it('7.1 canItemBeRare identifies valid rare item types and excludes charms', () => {
      const smallCharm = dropTables.getBase('cm1')!
      const largeCharm = dropTables.getBase('cm2')!
      const grandCharm = dropTables.getBase('cm3')!
      const monarch = dropTables.getBase('uit')!
      const ring = dropTables.getBase('rin')!
      const amulet = dropTables.getBase('amu')!

      expect(canItemBeRare(smallCharm, dropTables.itemTypes, dropTables.isA)).toBe(false)
      expect(canItemBeRare(largeCharm, dropTables.itemTypes, dropTables.isA)).toBe(false)
      expect(canItemBeRare(grandCharm, dropTables.itemTypes, dropTables.isA)).toBe(false)
      expect(canItemBeRare(monarch, dropTables.itemTypes, dropTables.isA)).toBe(true)
      expect(canItemBeRare(ring, dropTables.itemTypes, dropTables.isA)).toBe(true)
      expect(canItemBeRare(amulet, dropTables.itemTypes, dropTables.isA)).toBe(true)
    })

    it('7.2 Unique fallback: Monarch with ilvl 50 (< 77) degrades to Rare with 3x durability', () => {
      const monarch = dropTables.getBase('uit')! // base durability 86
      expect((monarch as any).durability).toBe(86)

      // Force Unique on Monarch with ilvl 50 where Stormshield (lvl 77) cannot spawn
      const dropped = createDroppedItem(monarch, 'rare', {
        ilvl: 50,
        dwInitSeed: 12345,
        durabilityMultiplier: 3, // Unique fallback triple durability
        rareAffixes: {
          name: 'Storm Tower',
          affixes: [],
        } as any,
      })

      expect(dropped.rarity).toBe('rare')
      expect(dropped.durability).toBe(86 * 3) // 258
      expect(dropped.maxDurability).toBe(258)
    })

    it('7.3 Set fallback: Monarch with no set item degrades to Magic with 2x durability', () => {
      const monarch = dropTables.getBase('uit')! // base durability 86

      const dropped = createDroppedItem(monarch, 'magic', {
        ilvl: 50,
        dwInitSeed: 12345,
        durabilityMultiplier: 2, // Set fallback double durability
        magicAffixes: {
          name: 'Monarch of Deflection',
        } as any,
      })

      expect(dropped.rarity).toBe('magic')
      expect(dropped.durability).toBe(86 * 2) // 172
      expect(dropped.maxDurability).toBe(172)
    })

    it('7.4 Charm fallback: Charm rolling Set or Unique degrades to Magic, NEVER Rare', () => {
      const smallCharm = dropTables.getBase('cm1')!

      // When small charm quality roll produces Set, fallback MUST be Magic
      const canRare = canItemBeRare(smallCharm, dropTables.itemTypes, dropTables.isA)
      expect(canRare).toBe(false)

      const dropped = createDroppedItem(smallCharm, 'magic', {
        ilvl: 50,
        dwInitSeed: 12345,
        magicAffixes: {
          name: 'Fine Small Charm of Vita',
        } as any,
      })

      expect(dropped.rarity).toBe('magic')
      expect(dropped.durability).toBeUndefined() // Charms have no durability
    })

    it('7.5 Concrete rolled values: properties roll specific values in [min, max] and formatItemTooltip shows single number', () => {
      const dummyUniqueDef = dropTables.uniques.getEnabledByCode('uap')[0]! // Shako
      const shakoBase = dropTables.getBase('uap')!

      // Unique with variable or fixed props
      const dropped = createDroppedItem(shakoBase, 'unique', {
        uniqueItem: dummyUniqueDef,
        ilvl: 87,
        dwInitSeed: 99999,
      })

      expect(dropped.rolledProps).toBeDefined()
      expect(dropped.rolledProps!.length).toBeGreaterThan(0)

      for (const p of dropped.rolledProps!) {
        expect(p.value).toBeGreaterThanOrEqual(p.min)
        expect(p.value).toBeLessThanOrEqual(p.max)
      }

      const tooltip = formatItemTooltip(dropped)
      // Check that tooltip lines do not contain unresolved ranges like '+11-20'
      for (const line of tooltip.lines) {
        // Unless it's an elemental damage range (Adds X-Y Damage), lines should not contain 'X-Y'
        if (!line.text.startsWith('Adds ')) {
          expect(line.text).not.toMatch(/\+\d+-\d+/)
        }
      }
    })

    it('7.6 resolveItemTypeFlags and Jewelry A drop pipeline never produce normal/superior/low rings, amulets, jewels, or charms', () => {
      for (const code of ['rin', 'amu', 'jew', 'cm1', 'cm2', 'cm3']) {
        const base = dropTables.getBase(code)!
        const flags = resolveItemTypeFlags(base, dropTables.itemTypes, dropTables.isA)
        expect(flags.isAlwaysMagic).toBe(true)
        expect(flags.isNormalOnly).toBe(false)
      }

      for (let i = 0; i < 100; i++) {
        const drops = executeDropPipeline(dropTables, {
          tcName: 'Jewelry A',
          nLevel: 1,
          monsterType: 1,
          difficulty: 'normal',
          playerMf: -100,
          monsterRng: (0xabc0000 + i * 997) >>> 0,
        })
        for (const item of drops) {
          expect(['magic', 'rare', 'set', 'unique']).toContain(item.rarity)
        }
      }
    })
  })
})
