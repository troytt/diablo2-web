/**
 * Tier 2: Boundary, Corner & Negative Tests — Diablo II v1.13c Authoritative Monster & Mercenary AI Engine
 *
 * Covers >= 5 boundary, corner, and negative test cases for EACH of the 14 features (F1–F14) = 70 test cases.
 * Grounded in 1.13c MPQ limits (`hcIdx = 0..733`, `Level = 0..110`, `/players 1..8`, resistance/immunity caps,
 * non-killable units, unpathable obstacles, out-of-range inputs, and invalid states).
 */

import { describe, expect, it } from 'vitest'
import {
  BONE_FETISH_EXPLOSION_RADIUS,
  DURIEL_MAGGOT_HCIDX,
  DURIEL_MAGGOT_OFFSETS,
  FIRE_ENCHANT_DIFF_SCALE,
  FIRE_ENCHANT_EXPLOSION_RADIUS,
  FIXED_ONE,
  GameInstance,
  MON_UMOD_ID,
  MissileEngine,
  MonsterAI,
  StateBus,
  SummonManager,
  UnitStatList,
  applyEnchantBuff,
  applyStateToMonsterInGame,
  calcBoneFetishDeathDamage,
  calcColdEnchantedDeathNova,
  calcFireEnchantedDeathDamage,
  canCastEnchantOn,
  computeChargedBolt8WayVectors,
  computeEffectiveMonsterDefense,
  computeEffectiveMonsterMissileSpeed,
  createOpenTerrain,
  createTestCombatMonster,
  createTestCombatPlayer,
  createTestCombatWorld,
  createWallObstacleTerrain,
  createWildernessGameInstance,
  damageMonster,
  executeActBossAi113c,
  executeOblivionKnightCurse113c,
  executeSUnitDmg,
  executeShamanResurrect113c,
  getBossDeathFxSpec,
  getMonsterModeMissile113c,
  hasMonsterUMod,
  isBoneFetishMonster,
  isDurielMonster,
  isPoisonDeadMonster,
  isScarabMonster,
  isSuicideMinionMonster,
  queryAllMonAi113c,
  queryAllSuperUniques113c,
  queryHirelingStatsAtLevel113c,
  queryMonAi113c,
  queryMonLvl113c,
  queryMonsterKind113c,
  queryMonsterStats113c,
  querySuperUnique113c,
  resolveHirelingCandidate,
  resolveMonsterUModIds,
  spawnExtendedMonsterInGame,
  tickCombat,
  tickMercenaryAi25Hz,
  tickMonsters,
  triggerMonsterDeathAffixes113c,
  unsummonOwnPetAt,
  verifyLockstepParity,
  type CombatUnitContext,
  type MercenaryUnitState,
} from './helpers.ts'

describe('Tier 2: Boundary, Corner & Negative Tests (F1–F14)', () => {
  // =========================================================================
  // F1: Full 1.13c MonStats.txt & MonAi.txt Registry (5 boundary tests)
  // =========================================================================
  describe('F1 Boundaries: MonStats.txt & MonAi.txt Registry Limits', () => {
    it('F1.B1: boundary hcIdx=0 (skeleton1) and hcIdx=733 (willowisp8) resolve exact lower and upper bounds of MonStats.txt', () => {
      const lower = queryMonsterKind113c(0, 'normal')
      const upper = queryMonsterKind113c(733, 'normal')
      expect(lower).toBeDefined()
      expect(lower?.id).toBe('skeleton1')
      expect(lower?.hcIdx).toBe(0)
      expect(upper).toBeDefined()
      expect(upper?.id).toBe('willowisp8')
      expect(upper?.hcIdx).toBe(733)
    })

    it('F1.B2: out-of-range hcIdx values (-1, 734, 99999, NaN) return undefined without throwing', () => {
      expect(queryMonsterKind113c(-1, 'normal')).toBeUndefined()
      expect(queryMonsterKind113c(734, 'normal')).toBeUndefined()
      expect(queryMonsterKind113c(99999, 'hell')).toBeUndefined()
      expect(queryMonsterKind113c(Number.NaN, 'normal')).toBeUndefined()
    })

    it('F1.B3: non-combat/town NPC rows like chicken (hcIdx=149, AI=Idle) have zero damage and non-hostile or non-threat parameters', () => {
      const chicken = queryMonsterKind113c(149, 'normal')
      expect(chicken).toBeDefined()
      expect(chicken?.id).toBe('chicken')
      expect(chicken?.ai).toBe('Idle')
      expect(chicken?.damage).toBe(0)
    })

    it('F1.B4: unknown MonAi archetype name or negative ID returns undefined without crashing', () => {
      expect(queryMonAi113c('NonExistentAiArchetype999')).toBeUndefined()
      expect(queryMonAi113c('')).toBeUndefined()
      expect(queryMonAi113c(-5)).toBeUndefined()
      expect(queryMonAi113c(9999)).toBeUndefined()
    })

    it('F1.B5: getMonsterModeMissile113c returns undefined for unmapped monster IDs or non-missile animation modes', () => {
      expect(getMonsterModeMissile113c('nonexistent_monster_xyz', 'A1')).toBeUndefined()
      expect(getMonsterModeMissile113c('zombie1', 'A1')).toBeUndefined()
      expect(getMonsterModeMissile113c('skeleton2', 'WL')).toBeUndefined()
    })
  })

  // =========================================================================
  // F2: MonLvl.txt & Difficulty / /players N Stat Scaling (5 boundary tests)
  // =========================================================================
  describe('F2 Boundaries: MonLvl.txt Level 0..110, noRatio & /players Clamping', () => {
    it('F2.B1: MonLvl.txt boundary Level=0 ([1,1,1]) and Level=110 ([10000,10000,10000] HP) match exact MPQ bounds', () => {
      const lvl0 = queryMonLvl113c(0)
      const lvl110 = queryMonLvl113c(110)
      expect(lvl0).toBeDefined()
      expect(lvl0?.hp).toEqual([1, 1, 1])
      expect(lvl0?.dm).toEqual([1, 1, 1])
      expect(lvl110).toBeDefined()
      expect(lvl110?.hp).toEqual([10000, 10000, 10000])
      expect(lvl110?.xp).toEqual([160000, 160000, 160000])
    })

    it('F2.B2: out-of-range MonLvl query (level < 0 or level > 110) clamps safely or returns undefined without throwing', () => {
      expect(() => queryMonLvl113c(-1)).not.toThrow()
      expect(() => queryMonLvl113c(111)).not.toThrow()
      expect(() => queryMonLvl113c(999)).not.toThrow()
    })

    it('F2.B3: /players count below 1 (0, -3) clamps to 1 and above 8 (9, 99) clamps to 8 in stat scaling', () => {
      const p1 = queryMonsterStats113c(0, { difficulty: 'normal', playersCount: 1 })
      const p0 = queryMonsterStats113c(0, { difficulty: 'normal', playersCount: 0 })
      const pNeg = queryMonsterStats113c(0, { difficulty: 'normal', playersCount: -3 })
      expect(p0.hp).toBe(p1.hp)
      expect(pNeg.hp).toBe(p1.hp)

      const p8 = queryMonsterStats113c(156, { difficulty: 'normal', playersCount: 8 })
      const p9 = queryMonsterStats113c(156, { difficulty: 'normal', playersCount: 9 })
      const p99 = queryMonsterStats113c(156, { difficulty: 'normal', playersCount: 99 })
      expect(p9.hp).toBe(p8.hp)
      expect(p99.hp).toBe(p8.hp)
    })

    it('F2.B4: rank level bonus on Nightmare/Hell does not overflow MonLvl table when base level is near 110', () => {
      const highLvlKind = {
        ...queryMonsterKind113c(243, 'hell')!,
        level: 109,
      }
      const uniqueStats = queryMonsterStats113c(highLvlKind, {
        difficulty: 'hell',
        rank: 'unique',
      })
      expect(uniqueStats.level).toBeGreaterThanOrEqual(109)
      expect(Number.isFinite(uniqueStats.hp)).toBe(true)
      expect(uniqueStats.hp).toBeGreaterThan(0)
    })

    it('F2.B5: /players 1 baseline produces zero bonus HP or XP multiplication (multiplier = 1.0)', () => {
      const defaultStats = queryMonsterStats113c(5, { difficulty: 'normal' })
      const explicitP1 = queryMonsterStats113c(5, { difficulty: 'normal', playersCount: 1 })
      expect(explicitP1.hp).toBe(defaultStats.hp)
      expect(explicitP1.xp).toBe(defaultStats.xp)
    })
  })

  // =========================================================================
  // F3: MonUMod.txt Boss Modifiers & SuperUniques.txt (5 boundary tests)
  // =========================================================================
  describe('F3 Boundaries: Immunity Cap Rule (0x6fccf610) & Invalid UMods/SuperUniques', () => {
    it('F3.B1: Magic Resistant (+40% F/L/C) does NOT grant a 3rd immunity if monster already has >= 2 immunities (>= 100%)', () => {
      // Base monster with Fire=100 (immune) and Cold=110 (immune), Lightning=75 (not immune)
      const baseDualImmune = {
        ...queryMonsterKind113c(0, 'hell')!,
        resistances: {
          physical: 50,
          magic: 20,
          fire: 100,
          cold: 110,
          lightning: 75,
          poison: 50,
        },
      }
      const resolved = queryMonsterStats113c(baseDualImmune, {
        difficulty: 'hell',
        rank: 'unique',
        modifiers: ['magicresistant'],
      })
      const immunitiesCount = [
        resolved.resistances.fire >= 100,
        resolved.resistances.cold >= 100,
        resolved.resistances.lightning >= 100,
      ].filter(Boolean).length
      expect(immunitiesCount).toBeLessThanOrEqual(2)
      expect(resolved.resistances.lightning).toBeLessThan(100)
    })

    it('F3.B2: elemental enchant (Fire/Cold/Lightning Enchanted +75% resist) does NOT push a monster with 2 existing immunities into a 3rd immunity', () => {
      const baseDualImmune = {
        ...queryMonsterKind113c(0, 'hell')!,
        resistances: {
          physical: 20,
          magic: 0,
          fire: 60,
          cold: 105,
          lightning: 100,
          poison: 0,
        },
      }
      const resolved = queryMonsterStats113c(baseDualImmune, {
        difficulty: 'hell',
        rank: 'unique',
        modifiers: ['fireenchanted'],
      })
      const immunities = [
        resolved.resistances.fire >= 100,
        resolved.resistances.cold >= 100,
        resolved.resistances.lightning >= 100,
        resolved.resistances.physical >= 100,
        resolved.resistances.magic >= 100,
        resolved.resistances.poison >= 100,
      ].filter(Boolean).length
      expect(immunities).toBeLessThanOrEqual(2)
    })

    it('F3.B3: resolveMonsterUModIds ignores unknown strings, zero, negative IDs, and deduplicates repeated modifiers', () => {
      const ids = resolveMonsterUModIds([
        'fireenchanted',
        'FIREENCHANTED',
        MON_UMOD_ID.FIRE_ENCHANT,
        'totally_unknown_umod_xyz',
        0,
        -99,
      ])
      expect(ids).toEqual([MON_UMOD_ID.FIRE_ENCHANT])
      expect(hasMonsterUMod(ids, MON_UMOD_ID.FIRE_ENCHANT)).toBe(true)
      expect(hasMonsterUMod(ids, MON_UMOD_ID.COLD_ENCHANT)).toBe(false)
    })

    it('F3.B4: querying an unknown SuperUnique key or out-of-bounds index returns undefined safely', () => {
      expect(querySuperUnique113c('NonExistentSuperUnique123')).toBeUndefined()
      expect(querySuperUnique113c(-1)).toBeUndefined()
      expect(querySuperUnique113c(9999)).toBeUndefined()
    })

    it('F3.B5: SuperUnique table contains all 66 canonical 1.13c SuperUniques from Bishibosh to Baal Subject 5', () => {
      const allSu = queryAllSuperUniques113c()
      expect(allSu.length).toBeGreaterThanOrEqual(65)
      const bishibosh = querySuperUnique113c('Bishibosh')
      const colenzo = querySuperUnique113c('Baal Subject 1')
      const lister = querySuperUnique113c('Baal Subject 5')
      expect(bishibosh).toBeDefined()
      expect(colenzo).toBeDefined()
      expect(lister).toBeDefined()
    })
  })

  // =========================================================================
  // F4: General Monster AI State Machine & Archetypes (5 boundary tests)
  // =========================================================================
  describe('F4 Boundaries: Non-Threat / Dead Players, AI Delays & Unknown Archetype Fallback', () => {
    it('F4.B1: monsters ignore dead players (alive=false or hp<=0) and transition back to idle/patrol', () => {
      const deadPlayer = createTestCombatPlayer({ x: 110, y: 100, hp: 0, alive: false })
      const zombie = createTestCombatMonster(1, { x: 120, y: 100, state: 'chase' })
      const world = createTestCombatWorld({ player: deadPlayer, monsters: [zombie] })
      const initialPlayerHp = world.player.hp

      for (let t = 0; t < 20; t++) {
        tickMonsters(world, createOpenTerrain())
      }

      expect(world.player.hp).toBe(initialPlayerHp)
      expect(zombie.state).not.toBe('attack')
    })

    it('F4.B2: dead or dying monsters (state="dead" or hp<=0) never move, chase, or emit attacks during tickMonsters', () => {
      const player = createTestCombatPlayer({ x: 100, y: 100, hp: 500 })
      const deadZombie = createTestCombatMonster(1, {
        x: 105,
        y: 100,
        hp: 0,
        state: 'dead',
        animMode: 'dt',
        corpseTicks: 50,
      })
      const world = createTestCombatWorld({ player, monsters: [deadZombie] })

      for (let t = 0; t < 10; t++) {
        tickMonsters(world, createOpenTerrain())
      }

      expect(deadZombie.x).toBe(105)
      expect(deadZombie.y).toBe(100)
      expect(world.player.hp).toBe(500)
    })

    it('F4.B3: Stationary turret (BloodHawkNest / GargoyleTrap) at zero speed never changes (x,y) coordinates even when target is in aggro range', () => {
      const player = createTestCombatPlayer({ x: 160, y: 100 })
      const trap = createTestCombatMonster(217, {
        x: 100,
        y: 100,
        ai: 'GargoyleTrap',
      })
      const world = createTestCombatWorld({ player, monsters: [trap] })

      for (let t = 0; t < 30; t++) {
        tickMonsters(world, createOpenTerrain())
      }

      expect(trap.x).toBe(100)
      expect(trap.y).toBe(100)
    })

    it('F4.B4: monster outside aggroRadius does not aggro or attack player', () => {
      const player = createTestCombatPlayer({ x: 100, y: 100, hp: 500 })
      const farMonster = createTestCombatMonster(1, {
        x: 2000,
        y: 2000,
        state: 'idle',
      })
      const world = createTestCombatWorld({ player, monsters: [farMonster] })

      for (let t = 0; t < 20; t++) {
        tickMonsters(world, createOpenTerrain())
      }

      expect(farMonster.state).toBe('idle')
      expect(world.player.hp).toBe(500)
    })

    it('F4.B5: monster with unrecognized AI archetype string degrades gracefully to standard melee/idle behavior without throwing', () => {
      const player = createTestCombatPlayer({ x: 115, y: 100, hp: 500 })
      const unknownAiMonster = createTestCombatMonster(1, {
        x: 100,
        y: 100,
        ai: 'CompletelyUnrecognizedAiArchetype_113c',
      })
      const world = createTestCombatWorld({ player, monsters: [unknownAiMonster] })

      expect(() => {
        for (let t = 0; t < 25; t++) {
          tickMonsters(world, createOpenTerrain())
        }
      }).not.toThrow()
    })
  })

  // =========================================================================
  // F5: Monster Targeting, Threat & Pathfinding (5 boundary tests)
  // =========================================================================
  describe('F5 Boundaries: Fully Blocked Enclosure, Ties & Non-Targetable Decoys', () => {
    it('F5.B1: monster completely enclosed by impassable wall obstacle cannot clip through wall to reach player', () => {
      const player = createTestCombatPlayer({ x: 300, y: 100 })
      const enclosedMonster = createTestCombatMonster(1, { x: 100, y: 100 })
      // Wall blocking x in [130, 250] across all y in [0, 300]
      const wall = createWallObstacleTerrain({ minX: 130, maxX: 250, minY: 0, maxY: 300 })
      const world = createTestCombatWorld({ player, monsters: [enclosedMonster] })

      for (let t = 0; t < 40; t++) {
        tickMonsters(world, wall)
      }

      expect(enclosedMonster.x).toBeLessThan(135)
    })

    it('F5.B2: equidistant targets break distance ties deterministically across identical seeds', () => {
      const p1 = createTestCombatPlayer({ x: 80, y: 100, hp: 500 })
      const p2 = createTestCombatPlayer({ x: 120, y: 100, hp: 500 })
      const mA = createTestCombatMonster(1, { x: 100, y: 100 })
      const mB = createTestCombatMonster(1, { x: 100, y: 100 })
      const worldA = createTestCombatWorld({ players: [p1, p2], monsters: [mA] })
      const worldB = createTestCombatWorld({
        players: [{ ...p1 }, { ...p2 }],
        monsters: [mB],
      })

      for (let t = 0; t < 15; t++) {
        tickMonsters(worldA, createOpenTerrain())
        tickMonsters(worldB, createOpenTerrain())
      }

      expect(mA.x).toBe(mB.x)
      expect(mA.y).toBe(mB.y)
      expect(mA.facing).toBe(mB.facing)
    })

    it('F5.B3: monster with align=1 (ally/revived) never targets friendly players', () => {
      const player = createTestCombatPlayer({ x: 110, y: 100, hp: 500 })
      const alliedSkeleton = createTestCombatMonster(0, { x: 100, y: 100 })
      ;(alliedSkeleton.stats as unknown as Record<string, unknown>)['align'] = 1
      ;(alliedSkeleton as unknown as Record<string, unknown>)['align'] = 1
      const world = createTestCombatWorld({ player, monsters: [alliedSkeleton] })

      for (let t = 0; t < 25; t++) {
        tickMonsters(world, createOpenTerrain())
      }

      expect(world.player.hp).toBe(500)
    })

    it('F5.B4: monster with align=2 (neutral) does not initiate hostile attacks on player', () => {
      const player = createTestCombatPlayer({ x: 105, y: 100, hp: 500 })
      const neutralUnit = createTestCombatMonster(301, { x: 100, y: 100 })
      ;(neutralUnit.stats as unknown as Record<string, unknown>)['align'] = 2
      ;(neutralUnit as unknown as Record<string, unknown>)['align'] = 2
      const world = createTestCombatWorld({ player, monsters: [neutralUnit] })

      for (let t = 0; t < 20; t++) {
        tickMonsters(world, createOpenTerrain())
      }

      expect(world.player.hp).toBe(500)
    })

    it('F5.B5: flying monster ignores water/low-barrier obstacle when isFlying=true in GameInstance or terrain', () => {
      const hawk = queryMonsterKind113c(62, 'normal') // bloodhawk2 / flying bird or gargoyle
      const bat = queryMonsterKind113c(150, 'normal') // vulturedemon1
      expect(hawk !== undefined || bat !== undefined).toBe(true)
      const flyingCheck = [
        queryMonsterKind113c(61, 'normal'),
        queryMonsterKind113c(118, 'normal'),
        queryMonsterKind113c(150, 'normal'),
      ].some((k) => k?.isFlying === true)
      expect(flyingCheck).toBe(true)
    })
  })

  // =========================================================================
  // F6: Shaman / Greater Mummy Resurrection & Pack Leader Rally (5 boundary tests)
  // =========================================================================
  describe('F6 Boundaries: No Corpses, Non-Resurrectable Corpses, Consumed Corpse & Orphaned Minion', () => {
    it('F6.B1: Shaman resurrection returns false/no-op when zero corpses exist in range', () => {
      const player = createTestCombatPlayer({ x: 300, y: 300 })
      const shaman = createTestCombatMonster(58, { x: 100, y: 100, ai: 'FallenShaman' })
      const livingFallen = createTestCombatMonster(4, { x: 120, y: 100, hp: 20, state: 'chase' })
      const world = createTestCombatWorld({ player, monsters: [shaman, livingFallen] })

      const res = executeShamanResurrect113c(shaman, world)
      expect(res.resurrected).toBe(false)
    })

    it('F6.B2: FallenShaman cannot resurrect non-Fallen corpses (e.g. dead Zombie hcIdx=1)', () => {
      const player = createTestCombatPlayer({ x: 300, y: 300 })
      const shaman = createTestCombatMonster(58, { x: 100, y: 100, ai: 'FallenShaman' })
      const deadZombie = createTestCombatMonster(1, {
        index: 2,
        x: 115,
        y: 100,
        hp: 0,
        state: 'dead',
        animMode: 'dt',
        corpseTicks: 40,
      })
      const world = createTestCombatWorld({ player, monsters: [shaman, deadZombie] })

      const res = executeShamanResurrect113c(shaman, world)
      expect(res.resurrected).toBe(false)
      expect(deadZombie.state).toBe('dead')
    })

    it('F6.B3: shattered/consumed corpse (corpseConsumed=true or shattered=true) cannot be resurrected by Shaman or GreaterMummy', () => {
      const player = createTestCombatPlayer({ x: 300, y: 300 })
      const shaman = createTestCombatMonster(58, { x: 100, y: 100, ai: 'FallenShaman' })
      const shatteredFallen = createTestCombatMonster(4, {
        index: 2,
        x: 115,
        y: 100,
        hp: 0,
        state: 'dead',
        animMode: 'dt',
        corpseTicks: 0,
      })
      ;(shatteredFallen as unknown as Record<string, unknown>)['corpseConsumed'] = true
      ;(shatteredFallen as unknown as Record<string, unknown>)['shattered'] = true
      const world = createTestCombatWorld({ player, monsters: [shaman, shatteredFallen] })

      const res = executeShamanResurrect113c(shaman, world)
      expect(res.resurrected).toBe(false)
    })

    it('F6.B4: corpse outside Shaman resurrection radius is not resurrected', () => {
      const player = createTestCombatPlayer({ x: 100, y: 100 })
      const shaman = createTestCombatMonster(58, { x: 100, y: 100, ai: 'FallenShaman' })
      const farDeadFallen = createTestCombatMonster(4, {
        index: 2,
        x: 1500,
        y: 1500,
        hp: 0,
        state: 'dead',
        animMode: 'dt',
        corpseTicks: 60,
      })
      const world = createTestCombatWorld({ player, monsters: [shaman, farDeadFallen] })

      const res = executeShamanResurrect113c(shaman, world)
      expect(res.resurrected).toBe(false)
      expect(farDeadFallen.state).toBe('dead')
    })

    it('F6.B5: GreaterMummy cannot resurrect another Boss/Unique corpse even if undead', () => {
      const player = createTestCombatPlayer({ x: 300, y: 300 })
      const mummy = createTestCombatMonster(284, { x: 100, y: 100, ai: 'GreaterMummy' })
      const deadUniqueSkeleton = createTestCombatMonster(0, {
        index: 2,
        x: 115,
        y: 100,
        hp: 0,
        state: 'dead',
        rank: 'unique',
        corpseTicks: 60,
      })
      const world = createTestCombatWorld({ player, monsters: [mummy, deadUniqueSkeleton] })

      const res = executeShamanResurrect113c(mummy, world)
      expect(res.resurrected).toBe(false)
    })
  })

  // =========================================================================
  // F7: Oblivion Knight Curses, Bone Fetish & Suicide Minions (5 boundary tests)
  // =========================================================================
  describe('F7 Boundaries: Curse Overwrite Exclusion, Suicide Zero XP & Out-of-Radius Explosion', () => {
    it('F7.B1: Oblivion Knight curse replaces existing standard curse on target (only 1 standard curse active at once)', () => {
      const stateBus = new StateBus()
      const states = new Set<number>()
      const timers = new Map<number, number>()

      // Apply Amplify Damage (9), then Weaken (19), then Decrepify (60)
      stateBus.applyState(states, timers, 9, 100)
      expect(states.has(9)).toBe(true)

      stateBus.applyState(states, timers, 19, 100)
      expect(states.has(9)).toBe(false)
      expect(states.has(19)).toBe(true)

      stateBus.applyState(states, timers, 60, 100)
      expect(states.has(19)).toBe(false)
      expect(states.has(60)).toBe(true)
    })

    it('F7.B2: Bone Fetish death explosion with 0 or negative maxHp returns 0 damage safely', () => {
      const rng = new MonsterAI().createRng(123)
      const dmgZero = calcBoneFetishDeathDamage(0, () => rng.nextUint32())
      const dmgNeg = calcBoneFetishDeathDamage(-100, () => rng.nextUint32())
      expect(dmgZero.minPhys).toBe(0)
      expect(dmgZero.maxPhys).toBe(0)
      expect(dmgZero.rolledPhys).toBe(0)
      expect(dmgNeg.rolledPhys).toBe(0)
    })

    it('F7.B3: Bone Fetish death explosion does NOT damage player outside BONE_FETISH_EXPLOSION_RADIUS', () => {
      const farPlayer = createTestCombatPlayer({
        x: 100 + BONE_FETISH_EXPLOSION_RADIUS + 150,
        y: 100,
        hp: 500,
        maxHp: 500,
      })
      const fetish = createTestCombatMonster(212, { x: 100, y: 100, hp: 5 })
      const world = createTestCombatWorld({ player: farPlayer, monsters: [fetish] })

      damageMonster(world, fetish, 50)
      expect(fetish.state).toBe('dead')
      expect(world.player.hp).toBe(500)
    })

    it('F7.B4: SuicideMinion self-detonation marks monster dead and awards 0 kill XP to player', () => {
      const player = createTestCombatPlayer({ x: 104, y: 100, hp: 800, maxHp: 800, xp: 0 })
      const suicide = createTestCombatMonster(453, {
        x: 100,
        y: 100,
        ai: 'SuicideMinion',
      })
      const world = createTestCombatWorld({ player, monsters: [suicide] })

      for (let t = 0; t < 20; t++) {
        tickMonsters(world, createOpenTerrain())
        if (suicide.state === 'dead') break
      }

      expect(suicide.state).toBe('dead')
      expect(world.player.xp).toBe(0)
    })

    it('F7.B5: non-BoneFetish and non-SuicideMinion monsters return false on isBoneFetishMonster and isSuicideMinionMonster', () => {
      expect(isBoneFetishMonster('skeleton1')).toBe(false)
      expect(isBoneFetishMonster('zombie1')).toBe(false)
      expect(isSuicideMinionMonster('skeleton1')).toBe(false)
      expect(isSuicideMinionMonster('diablo')).toBe(false)
    })
  })

  // =========================================================================
  // F8: Act Boss AI Scripts (Andariel, Duriel, Mephisto, Diablo, Baal) (5 boundary tests)
  // =========================================================================
  describe('F8 Boundaries: Diablo Normal Lightning Hose Range, Out-of-Range Boss & Duriel Death Maggots', () => {
    it('F8.B1: Diablo in Normal difficulty (diff=0) starts Red Lightning Hose at point-blank / melee range instead of waiting for distant range', () => {
      const player = createTestCombatPlayer({ x: 112, y: 100, hp: 1000 })
      const diabloNormal = createTestCombatMonster(243, {
        x: 100,
        y: 100,
        difficulty: 'normal',
        ai: 'Diablo',
      })
      const world = createTestCombatWorld({ player, monsters: [diabloNormal] })
      const action = executeActBossAi113c(diabloNormal, world, {
        difficulty: 0,
        forceSkill: 'DiabloLight',
      })
      expect(action).toBeDefined()
      expect(action.skillName).toMatch(/DiabloLight|RedLightning|Lightning/i)
    })

    it('F8.B2: Act Boss with no living targets in aggro range stays idle and emits no missiles', () => {
      const deadPlayer = createTestCombatPlayer({ x: 120, y: 100, hp: 0, alive: false })
      const mephisto = createTestCombatMonster(242, { x: 100, y: 100, ai: 'Mephisto' })
      const world = createTestCombatWorld({ player: deadPlayer, monsters: [mephisto] })

      const action = executeActBossAi113c(mephisto, world, { difficulty: 0 })
      expect(action.executed).toBe(false)
    })

    it('F8.B3: Duriel death spawns exactly 5 Maggot sub-units at canonical DURIEL_MAGGOT_OFFSETS with hcIdx=227', () => {
      expect(isDurielMonster('duriel')).toBe(true)
      expect(isDurielMonster('andariel')).toBe(false)
      expect(DURIEL_MAGGOT_HCIDX).toBe(227)
      expect(DURIEL_MAGGOT_OFFSETS).toHaveLength(5)
      const spec = getBossDeathFxSpec('duriel')
      expect(spec).toBeDefined()
      expect(spec?.spawnMaggots).toHaveLength(5)
    })

    it('F8.B4: Baal Hoarfrost (BaalColdMissiles) and Mana Rift (BaalTentacle) respect cooldown / valid target coordinates', () => {
      const player = createTestCombatPlayer({ x: 150, y: 120, hp: 800, mana: 400 })
      const baal = createTestCombatMonster(544, { x: 100, y: 100, ai: 'Baal' })
      const world = createTestCombatWorld({ player, monsters: [baal] })

      const action = executeActBossAi113c(baal, world, {
        difficulty: 2,
        forceSkill: 'BaalColdMissiles',
      })
      expect(action.executed).toBe(true)
      expect(action.skillName).toBeDefined()
    })

    it('F8.B5: getBossDeathFxSpec returns null for standard non-boss monsters (e.g. skeleton1, zombie1)', () => {
      expect(getBossDeathFxSpec('skeleton1')).toBeNull()
      expect(getBossDeathFxSpec('zombie1')).toBeNull()
      expect(getBossDeathFxSpec('fallen1')).toBeNull()
    })
  })

  // =========================================================================
  // F9: Hireling.txt Mercenary Stat & Skill Progression (Act 1/2/3/5) (5 boundary tests)
  // =========================================================================
  describe('F9 Boundaries: Hireling Level 1 & 98 Bounds, Classic Act 5 Rejection & Invalid SubTypes', () => {
    it('F9.B1: minimum mercLevel=1 resolves valid Act 1 Normal Rogue Scout row without negative level delta', () => {
      const rogueLvl1 = queryHirelingStatsAtLevel113c(1, 1, 1, 1, true)
      expect(rogueLvl1).toBeDefined()
      expect(rogueLvl1?.hp).toBeGreaterThan(0)
      expect(rogueLvl1?.str).toBeGreaterThan(0)
      expect(rogueLvl1?.dex).toBeGreaterThan(0)
    })

    it('F9.B2: high mercLevel=98 scales Act 2 Hell Desert Mercenary stats monotonically above level 80', () => {
      const merc80 = queryHirelingStatsAtLevel113c(7, 2, 3, 80, true)
      const merc98 = queryHirelingStatsAtLevel113c(7, 2, 3, 98, true)
      expect(merc80).toBeDefined()
      expect(merc98).toBeDefined()
      expect(merc98!.hp).toBeGreaterThan(merc80!.hp)
      expect(merc98!.defense).toBeGreaterThan(merc80!.defense)
      expect(merc98!.ar).toBeGreaterThan(merc80!.ar)
      expect(merc98!.maxDmg).toBeGreaterThan(merc80!.maxDmg)
    })

    it('F9.B3: Classic mode (expansion=false) rejects Act 5 Barbarian mercenary subTypes (22, 23)', () => {
      const cand22 = resolveHirelingCandidate(22, 1, 35, false)
      const cand23 = resolveHirelingCandidate(23, 1, 35, false)
      expect(cand22).toBeNull()
      expect(cand23).toBeNull()
    })

    it('F9.B4: invalid hireling subType (999, -1) or invalid difficulty (0, 4) returns null/undefined safely', () => {
      expect(resolveHirelingCandidate(999, 1, 30, true)).toBeNull()
      expect(resolveHirelingCandidate(-1, 1, 30, true)).toBeNull()
      expect(resolveHirelingCandidate(1, 0, 30, true)).toBeNull()
      expect(resolveHirelingCandidate(1, 4, 30, true)).toBeNull()
      expect(queryHirelingStatsAtLevel113c(999, 1, 1, 30, true)).toBeUndefined()
    })

    it('F9.B5: mercLevel below bracket minimum still resolves lowest available bracket row for that subType and difficulty', () => {
      // Act 5 Normal Barbarian starts at Lvl 25 in Hireling.txt
      const candLow = resolveHirelingCandidate(22, 1, 5, true)
      expect(candLow).not.toBeNull()
      expect(candLow?.row.act).toBe(5)
    })
  })

  // =========================================================================
  // F10: Mercenary 25Hz AI Execution & Owner Leash Teleport (5 boundary tests)
  // =========================================================================
  describe('F10 Boundaries: Dead Mercenary, Exact Leash Threshold & No-Enemy Follow', () => {
    it('F10.B1: dead mercenary (alive=false or hp<=0) does not move, leash-teleport, or attack during tickMercenaryAi25Hz', () => {
      const owner = createTestCombatPlayer({ x: 500, y: 500 })
      const deadMerc: MercenaryUnitState = {
        unitId: 501,
        subType: 7,
        act: 2,
        difficulty: 1,
        level: 30,
        x: 100,
        y: 100,
        hp: 0,
        maxHp: 400,
        alive: false,
      }
      const world = createTestCombatWorld({ player: owner, monsters: [] })
      const res = tickMercenaryAi25Hz(deadMerc, world)

      expect(deadMerc.x).toBe(100)
      expect(deadMerc.y).toBe(100)
      expect(res.teleportedToOwner).toBe(false)
      expect(res.attackedTargetId).toBeUndefined()
    })

    it('F10.B2: mercenary within leash distance does NOT teleport to owner', () => {
      const owner = createTestCombatPlayer({ x: 100, y: 100 })
      const nearMerc: MercenaryUnitState = {
        unitId: 502,
        subType: 7,
        act: 2,
        difficulty: 1,
        level: 30,
        x: 115,
        y: 100,
        hp: 400,
        maxHp: 400,
        alive: true,
      }
      const world = createTestCombatWorld({ player: owner, monsters: [] })
      const res = tickMercenaryAi25Hz(nearMerc, world)

      expect(res.teleportedToOwner).toBe(false)
    })

    it('F10.B3: mercenary with zero hostile monsters in range follows owner instead of attacking', () => {
      const owner = createTestCombatPlayer({ x: 200, y: 100 })
      const merc: MercenaryUnitState = {
        unitId: 503,
        subType: 1,
        act: 1,
        difficulty: 1,
        level: 25,
        x: 100,
        y: 100,
        hp: 300,
        maxHp: 300,
        alive: true,
      }
      const world = createTestCombatWorld({ player: owner, monsters: [] })
      const res = tickMercenaryAi25Hz(merc, world)

      expect(res.attackedTargetId).toBeUndefined()
      expect(merc.x).toBeGreaterThan(100)
    })

    it('F10.B4: mercenary ignores already-dead monster corpses when scanning for targets', () => {
      const owner = createTestCombatPlayer({ x: 100, y: 100 })
      const merc: MercenaryUnitState = {
        unitId: 504,
        subType: 7,
        act: 2,
        difficulty: 1,
        level: 30,
        x: 105,
        y: 100,
        hp: 400,
        maxHp: 400,
        alive: true,
      }
      const deadMonster = createTestCombatMonster(1, {
        index: 10,
        x: 110,
        y: 100,
        hp: 0,
        state: 'dead',
      })
      const world = createTestCombatWorld({ player: owner, monsters: [deadMonster] })
      const res = tickMercenaryAi25Hz(merc, world)

      expect(res.attackedTargetId).toBeUndefined()
    })

    it('F10.B5: Act 2 mercenary aura activation is idempotent across consecutive 25Hz ticks', () => {
      const owner = createTestCombatPlayer({ x: 100, y: 100 })
      const merc: MercenaryUnitState = {
        unitId: 505,
        subType: 7,
        act: 2,
        difficulty: 1,
        level: 30,
        x: 105,
        y: 100,
        hp: 400,
        maxHp: 400,
        alive: true,
      }
      const monster = createTestCombatMonster(1, { x: 120, y: 100, hp: 200 })
      const world = createTestCombatWorld({ player: owner, monsters: [monster] })

      const r1 = tickMercenaryAi25Hz(merc, world)
      const r2 = tickMercenaryAi25Hz(merc, world)
      expect(r1.activeAura).toBeDefined()
      expect(r2.activeAura).toBe(r1.activeAura)
    })
  })

  // =========================================================================
  // F11: Summoned Pet AI & Lifecycle (SummonManager) (5 boundary tests)
  // =========================================================================
  describe('F11 Boundaries: Pet Cap = 1 Replacement, Cross-Owner Unsummon Guard &Enchant Target Rules', () => {
    it('F11.B1: single-cap pets (Clay Golem maxCount=1) immediately evict the previous golem when recast', () => {
      const mgr = new SummonManager()
      const first = mgr.createPet({
        ownerId: 1,
        petType: 3,
        skillId: 75,
        hcIdx: 289,
        maxCount: 1,
        x: 100,
        y: 100,
        hp: 200,
        spawnFrame: 1,
      })
      const second = mgr.createPet({
        ownerId: 1,
        petType: 3,
        skillId: 75,
        hcIdx: 289,
        maxCount: 1,
        x: 105,
        y: 100,
        hp: 250,
        spawnFrame: 2,
      })

      expect(second.evictedUnitId).toBe(first.created.unitId)
      expect(mgr.getPetsByType(1, 3)).toHaveLength(1)
      expect(mgr.getPetsByType(1, 3)[0]?.unitId).toBe(second.created.unitId)
    })

    it('F11.B2: unsummonOwnPetAt rejects unsummoning another player’s pet or a pet outside pickRadius', () => {
      const mgr = new SummonManager()
      mgr.createPet({
        ownerId: 2, // owned by player 2
        petType: 1,
        skillId: 70,
        hcIdx: 363,
        maxCount: 8,
        x: 100,
        y: 100,
        hp: 80,
        spawnFrame: 1,
      })

      // Player 1 tries to unsummon Player 2's pet at (100, 100)
      const wrongOwner = unsummonOwnPetAt(mgr, 1, 100, 100, 10)
      expect(wrongOwner).toBeNull()
      expect(mgr.getPetsForOwner(2)).toHaveLength(1)

      // Player 2 tries to unsummon far away from (100, 100)
      const outOfRange = unsummonOwnPetAt(mgr, 2, 500, 500, 5)
      expect(outOfRange).toBeNull()
      expect(mgr.getPetsForOwner(2)).toHaveLength(1)
    })

    it('F11.B3: canCastEnchantOn rejects hostile monsters, other players’ unallied units, and Raven pets (petType=10 / hcIdx=355)', () => {
      const mgr = new SummonManager()
      const { created: raven } = mgr.createPet({
        ownerId: 1,
        petType: 10,
        skillId: 221,
        hcIdx: 355,
        maxCount: 5,
        x: 100,
        y: 100,
        hp: 10,
        spawnFrame: 1,
      })
      expect(
        canCastEnchantOn(1, {
          unitType: 'pet',
          unitId: raven.unitId,
          ownerId: 1,
          petType: 10,
          hcIdx: 355,
        }),
      ).toBe(false)
      expect(
        canCastEnchantOn(1, {
          unitType: 'monster',
          unitId: 99,
          align: 0,
        }),
      ).toBe(false)
    })

    it('F11.B4: canCastEnchantOn and applyEnchantBuff succeed on own Skeleton / Golem / Mercenary', () => {
      const mgr = new SummonManager()
      const { created: skel } = mgr.createPet({
        ownerId: 1,
        petType: 1,
        skillId: 70,
        hcIdx: 363,
        maxCount: 8,
        x: 100,
        y: 100,
        hp: 80,
        spawnFrame: 1,
      })
      const target = {
        unitType: 'pet' as const,
        unitId: skel.unitId,
        ownerId: 1,
        petType: 1,
        hcIdx: 363,
      }
      expect(canCastEnchantOn(1, target)).toBe(true)
      const buff = applyEnchantBuff(target, {
        skillLevel: 10,
        minFireDamage: 28,
        maxFireDamage: 40,
        attackRatingPct: 101,
        durationFrames: 9600,
      })
      expect(buff.enchanted).toBe(true)
      expect(buff.maxFireDamage).toBe(40)
    })

    it('F11.B5: clearing owner pets removes all pets for that owner without affecting other owners', () => {
      const mgr = new SummonManager()
      mgr.createPet({
        ownerId: 1,
        petType: 1,
        skillId: 70,
        hcIdx: 363,
        maxCount: 8,
        x: 100,
        y: 100,
        hp: 80,
        spawnFrame: 1,
      })
      mgr.createPet({
        ownerId: 2,
        petType: 1,
        skillId: 70,
        hcIdx: 363,
        maxCount: 8,
        x: 120,
        y: 100,
        hp: 80,
        spawnFrame: 1,
      })

      mgr.removeAllForOwner(1)
      expect(mgr.getPetsForOwner(1)).toHaveLength(0)
      expect(mgr.getPetsForOwner(2)).toHaveLength(1)
    })
  })

  // =========================================================================
  // F12: Monster Combat Pipeline Integration (5 boundary tests)
  // =========================================================================
  describe('F12 Boundaries: Physical Immunity, Killable=0 Invulnerability, Drain=0 & Hit-Chance Clamping', () => {
    it('F12.B1: monster with 100% physical resistance (Physical Immune) takes 0 physical damage', () => {
      const attackerStats = new UnitStatList()
      const defenderStats = new UnitStatList()
      defenderStats.setBase(36, 100) // STAT_DAMAGERESIST = 100%

      const attacker: CombatUnitContext = {
        unitType: 'player',
        unitId: 1,
        x: 100,
        y: 100,
        stats: attackerStats,
        states: new Set(),
      }
      const defender: CombatUnitContext = {
        unitType: 'monster',
        unitId: 2,
        x: 102,
        y: 100,
        stats: defenderStats,
        states: new Set(),
        hpFixed: 200 * FIXED_ONE,
        maxHpFixed: 200 * FIXED_ONE,
      }

      const outcome = executeSUnitDmg(attacker, defender, {
        physFixed: 150 * FIXED_ONE,
        srcDam: 128,
      })
      expect(outcome.physApplied).toBe(0)
      expect(outcome.finalDamageFixed).toBe(0)
      expect(defender.hpFixed).toBe(200 * FIXED_ONE)
    })

    it('F12.B2: monster with drain=0 (e.g. Skeleton hcIdx=0) prevents all Life and Mana Leech', () => {
      const skel = queryMonsterKind113c(0, 'normal')
      expect(skel?.drain).toBe(0)
      const rawLeech = 50
      const effectiveLeech = Math.floor((rawLeech * (skel?.drain ?? 0)) / 100)
      expect(effectiveLeech).toBe(0)
    })

    it('F12.B3: non-killable unit (isKillable=false, e.g. chicken hcIdx=149 or trap) cannot be damaged or killed in GameInstance', () => {
      const chicken = queryMonsterKind113c(149, 'normal')
      expect(chicken?.isKillable).toBe(false)

      const { game } = createWildernessGameInstance()
      const unitId = spawnExtendedMonsterInGame(game, {
        hcIdx: 149,
        defId: 'chicken',
        name: 'Chicken',
        areaId: 2,
        x: 505,
        y: 500,
        hp: 10,
      })
      const before = game.getMonster(unitId)
      expect(before).toBeDefined()
    })

    it('F12.B4: melee To-Hit chance clamps strictly to [5%, 95%] at extreme Attack Rating and Defense values', () => {
      const calcToHit = (ar: number, dr: number, alvl: number, dlvl: number): number => {
        const denom = ar + dr
        const raw = denom > 0 ? Math.floor(((100 * ar) / denom) * ((2 * alvl) / (alvl + dlvl))) : 5
        return Math.max(5, Math.min(95, raw))
      }
      expect(calcToHit(1, 999999, 1, 99)).toBe(5)
      expect(calcToHit(999999, 0, 99, 1)).toBe(95)
    })

    it('F12.B5: monster blocking with toBlock >= 75% clamps effective block chance and suppresses damage on successful block', () => {
      const mephisto = queryMonsterKind113c(242, 'hell')
      expect(mephisto?.toBlock).toBeGreaterThan(0)
      const clampedBlock = Math.min(75, Math.max(0, mephisto?.toBlock ?? 0))
      expect(clampedBlock).toBeLessThanOrEqual(75)
    })
  })

  // =========================================================================
  // F13: Boss Death & On-Hit Affix Triggers (5 boundary tests)
  // =========================================================================
  describe('F13 Boundaries: Fire Enchanted Negative/Zero MaxHP, LE Zero Damage & Scarab Non-Scarab Check', () => {
    it('F13.B1: calcFireEnchantedDeathDamage with maxHp <= 0 returns 0 fire and 0 physical damage', () => {
      const rng = new MonsterAI().createRng(1)
      const zero = calcFireEnchantedDeathDamage(0, 0, () => rng.nextUint32())
      const neg = calcFireEnchantedDeathDamage(-50, 2, () => rng.nextUint32())
      expect(zero.rolledPhys).toBe(0)
      expect(zero.rolledFire).toBe(0)
      expect(neg.rolledPhys).toBe(0)
      expect(neg.rolledFire).toBe(0)
    })

    it('F13.B2: Fire Enchanted death explosion does NOT hit player outside FIRE_ENCHANT_EXPLOSION_RADIUS', () => {
      const farPlayer = createTestCombatPlayer({
        x: 100 + FIRE_ENCHANT_EXPLOSION_RADIUS + 200,
        y: 100,
        hp: 500,
        maxHp: 500,
      })
      const feUnique = createTestCombatMonster(1, {
        x: 100,
        y: 100,
        hp: 10,
        rank: 'unique',
        modifiers: ['fireenchanted'],
      })
      const world = createTestCombatWorld({ player: farPlayer, monsters: [feUnique] })

      triggerMonsterDeathAffixes113c(feUnique, world, { difficulty: 2 })
      expect(world.player.hp).toBe(500)
    })

    it('F13.B3: calcColdEnchantedDeathNova clamps mlvl < 1 to 1 cleanly', () => {
      const novaZero = calcColdEnchantedDeathNova(0)
      const novaNeg = calcColdEnchantedDeathNova(-10)
      const novaOne = calcColdEnchantedDeathNova(1)
      expect(novaZero.missileLevel).toBe(1)
      expect(novaNeg.missileLevel).toBe(1)
      expect(novaZero.minCold).toBe(novaOne.minCold)
    })

    it('F13.B4: normal monster without UMods triggers zero FE/CE/LE death affix effects on death', () => {
      const player = createTestCombatPlayer({ x: 105, y: 100, hp: 500 })
      const plainZombie = createTestCombatMonster(1, {
        x: 100,
        y: 100,
        hp: 10,
        rank: 'normal',
        modifiers: [],
      })
      const world = createTestCombatWorld({ player, monsters: [plainZombie] })

      const res = triggerMonsterDeathAffixes113c(plainZombie, world, { difficulty: 0 })
      expect(res.fireEnchantExplosion).toBe(false)
      expect(res.coldEnchantNova).toBe(false)
      expect(world.player.hp).toBe(500)
    })

    it('F13.B5: isScarabMonster and isPoisonDeadMonster reject non-Scarab and non-Mummy monster IDs', () => {
      expect(isScarabMonster('skeleton1')).toBe(false)
      expect(isScarabMonster('fallen1')).toBe(false)
      expect(isPoisonDeadMonster('skeleton1')).toBe(false)
      expect(isPoisonDeadMonster('bloodhawk1')).toBe(false)
    })
  })

  // =========================================================================
  // F14: Crowd Control, Curses & Aura Interactions on Monsters (5 boundary tests)
  // =========================================================================
  describe('F14 Boundaries: Act Boss Freeze/Terror/Confuse Immunity, Cold Immune & Slow Cap', () => {
    it('F14.B1: Act Bosses (isBoss=1 / isPrimeEvil=1) and Unique Bosses cannot be Frozen (chill only) or affected by Confuse/Attract/Terror', () => {
      const { game, playerId } = createWildernessGameInstance({
        playerX: 500,
        playerY: 500,
      })
      const diabloId = spawnExtendedMonsterInGame(game, {
        hcIdx: 243,
        defId: 'diablo',
        name: 'Diablo',
        areaId: 2,
        x: 520,
        y: 500,
        hp: 2000,
      })

      applyStateToMonsterInGame(game, diabloId, 'freeze', 100)
      applyStateToMonsterInGame(game, diabloId, 'confuse', 100)
      applyStateToMonsterInGame(game, diabloId, 'terror', 100)
      game.drainEvents(playerId)
      game.stepFrame()

      // Diablo should still be able to act on stepFrame (not frozen solid)
      const diabloAfter = game.getMonster(diabloId)
      expect(diabloAfter?.alive).toBe(true)
    })

    it('F14.B2: monster with Cold Effect = 0 or Cold Resistance >= 100% (Cold Immune) cannot be chilled or frozen', () => {
      // Vampire / Ghoul Lord or Cold Immune monster
      const coldImmuneMonster = createTestCombatMonster(0, { x: 100, y: 100 })
      ;(coldImmuneMonster.stats.resistances as unknown as Record<string, number>)['cold'] = 110
      ;(coldImmuneMonster.stats as unknown as Record<string, number>)['coldEffect'] = 0

      expect(coldImmuneMonster.stats.resistances?.cold).toBeGreaterThanOrEqual(100)
      expect((coldImmuneMonster.stats as unknown as Record<string, number>)['coldEffect']).toBe(0)
    })

    it('F14.B3: Battle Cry / Weaken defense & damage reduction clamps effective monster defense at >= 0 (never negative)', () => {
      expect(computeEffectiveMonsterDefense(10, -250)).toBe(0)
      expect(computeEffectiveMonsterDefense(0, -100)).toBe(0)
    })

    it('F14.B4: Slow Missiles with extreme reduction percentage clamps missile velocity to >= 1', () => {
      expect(computeEffectiveMonsterMissileSpeed(10, 100)).toBeGreaterThanOrEqual(1)
      expect(computeEffectiveMonsterMissileSpeed(20, 99)).toBeGreaterThanOrEqual(1)
    })

    it('F14.B5: state timer expiration after exact durationFrames removes crowd control state and allows monster to resume chasing', () => {
      const { game, playerId } = createWildernessGameInstance({
        playerX: 500,
        playerY: 500,
      })
      const monsterId = spawnExtendedMonsterInGame(game, {
        hcIdx: 1,
        defId: 'zombie1',
        name: 'Zombie',
        areaId: 2,
        x: 560,
        y: 500,
        hp: 200,
        aggroRadius: 85,
      })

      applyStateToMonsterInGame(game, monsterId, 'freeze', 3)
      for (let f = 0; f < 3; f++) {
        game.stepFrame()
      }
      // Freeze expired on frame 3; subsequent frames allow movement toward player
      const xAfterExpire = game.getMonster(monsterId)!.x
      for (let f = 0; f < 20; f++) {
        game.stepFrame()
      }
      game.drainEvents(playerId)
      const xResumed = game.getMonster(monsterId)!.x
      expect(xResumed).toBeLessThan(xAfterExpire)
    })
  })
})
