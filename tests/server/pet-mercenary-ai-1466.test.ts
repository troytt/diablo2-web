/**
 * Issue #1466 — 1.13c Pet & Mercenary AI Parameters & Weighted Skill Selection
 *
 * Ground truth references (`samples/d2/D2Game.dll`, image base `0x6FC20000`, `kb/monsters/d2game-pet-hireable-ai-113c.md`):
 * - `gpMonsterAiFunctionTable` (`0x6FD2E788`):
 *   - `#57 Hireable` (`0x6FC3DD40`), `#58 NecroPet` (`0x6FC9CBE0`), `#96 AssassinSentry` (`0x6FC898C0`),
 *   - `#99 DeathSentry` (`0x6FC89C40`), `#101 ShadowWarrior` (`0x6FC8A150`), `#102 ShadowMaster` (`0x6FC89ED0`),
 *   - `#107 DruidWolf` (`0x6FC3CA00`), `#109 Raven` (`0x6FC3DA60`), `#110 Totem` (`0x6FC3DC10`),
 *   - `#112 DruidBear` (`0x6FC3CB90`), `#113 Vines` (`0x6FC3D140`), `#114 CycleOfLife` (`0x6FC3D3A0`),
 *   - `#41 Hydra` (`0x6FC5E220`), `#35 Idle` (`0x6FC5C150`).
 * - `AIMERC_ChooseSkill_6FC3C4E0` (`0x6FC3C4E0`): weighted skill roll over `DefaultChance` and
 *   `Chance_i + floor((mlvl - Lvl_i) * ChancePerLvl_i / 4)`.
 */

import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import { resolveHirelingStatsAtLevel } from '../../src/common/units/hireling-table.ts'
import {
  HIREABLE_AI_113C,
  selectMercenarySkill113c,
  tickMercenaryAi25Hz,
  type MercenaryUnitState,
} from '../../src/server/ai/monster-ai.ts'
import {
  SUBTILE_PIXELS_113C,
  SummonManager,
  resolvePetAiProfile113c,
} from '../../src/server/ai/summon-manager.ts'
import { AuraScanner } from '../../src/server/engine/aura-scanner.ts'
import type { CombatUnitContext } from '../../src/server/engine/combat-pipeline.ts'
import { MissileEngine } from '../../src/server/engine/missile-engine.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import { createTestGame, spawnPlayerInGame, stepFrames } from '../e2e/monster-ai/helpers.ts'

describe('Issue #1466: 1.13c Pet & Mercenary AI Parameters (D2Game.dll + MonStats.txt + Hireling.txt)', () => {
  it('1. HIREABLE_AI_113C matches AITHINK_Fn057_Hireable (0x6FC3DD40) and MonStats.txt (#271, #338, #359, #560, #561)', () => {
    expect(HIREABLE_AI_113C.SUBTILE_PIXELS).toBe(16)
    expect(HIREABLE_AI_113C.TELEPORT_SUBTILES).toBe(100)
    expect(HIREABLE_AI_113C.LEASH_RUN_SUBTILES).toBe(24)
    expect(HIREABLE_AI_113C.FOLLOW_WALK_SUBTILES).toBe(16)
    expect(HIREABLE_AI_113C.IDLE_STOP_SUBTILES).toBe(5)
    expect(HIREABLE_AI_113C.AGGRO_SUBTILES).toBe(24)
    expect(HIREABLE_AI_113C.SELF_DEFENSE_SUBTILES).toBe(6)
    expect(HIREABLE_AI_113C.ACT1_RANGED_REACH_SUBTILES).toBe(20)
    expect(HIREABLE_AI_113C.ACT2_MELEE_REACH_SUBTILES).toBe(3)
    expect(HIREABLE_AI_113C.ACT3_RANGED_REACH_SUBTILES).toBe(20)
    expect(HIREABLE_AI_113C.ACT5_MELEE_REACH_SUBTILES).toBe(2)
    expect(HIREABLE_AI_113C.ACT123_VELOCITY).toBe(11)
    expect(HIREABLE_AI_113C.ACT123_RUN).toBe(16)
    expect(HIREABLE_AI_113C.ACT5_VELOCITY).toBe(14)
    expect(HIREABLE_AI_113C.ACT5_RUN).toBe(19)
    expect(HIREABLE_AI_113C.AI_DELAY_FRAMES).toBe(15)
  })

  it('2. tickMercenaryAi25Hz enforces 100-subtile (1600 px) teleport, 16-subtile (256 px) follow, and 24-subtile (384 px) aggro radius', () => {
    const owner = { x: 100, y: 100, hp: 500, maxHp: 500, alive: true } as any
    const makeMerc = (x: number, y: number, act = 2): MercenaryUnitState => ({
      unitId: 101,
      act,
      difficulty: 1,
      subType: act === 1 ? 0 : act === 2 ? 7 : act === 3 ? 16 : 24,
      level: 30,
      x,
      y,
      hp: 500,
      maxHp: 500,
      alive: true,
    })

    // Within 16 subtiles (256 px): stays idle (e.g., 200 px = 12.5 subtiles)
    const idleMerc = makeMerc(300, 100)
    const idleRes = tickMercenaryAi25Hz(
      { player: owner, monsters: [], events: [], tick: 1 } as any,
      idleMerc,
      owner,
    )
    expect(idleRes.teleportedToOwner).toBe(false)
    expect(idleMerc.state).toBe('idle')
    expect(idleMerc.x).toBe(300)

    // Between 16 subtiles (256 px) and 100 subtiles (1600 px): follows owner without teleporting (e.g., 500 px > 480 px old constant!)
    const followMerc = makeMerc(600, 100)
    const followRes = tickMercenaryAi25Hz(
      { player: owner, monsters: [], events: [], tick: 1 } as any,
      followMerc,
      owner,
    )
    expect(followRes.teleportedToOwner).toBe(false)
    expect(followMerc.state).toBe('follow')
    expect(followMerc.x).toBeLessThan(600)

    // Beyond 100 subtiles (1600 px): teleports to owner (e.g., 1601 px)
    const farMerc = makeMerc(1701, 100)
    const teleRes = tickMercenaryAi25Hz(
      { player: owner, monsters: [], events: [], tick: 1 } as any,
      farMerc,
      owner,
    )
    expect(teleRes.teleportedToOwner).toBe(true)
    expect(farMerc.x).toBe(100)
    expect(farMerc.y).toBe(100)

    // Target acquisition: monster at 25 subtiles (400 px > 384 px aggroRadius) is ignored; monster at 24 subtiles (384 px) is chased
    const outOfRangeMonster = { index: 1, x: 500, y: 100, hp: 200, maxHp: 200, state: 'idle' } as any
    const inRangeMerc = makeMerc(100, 100)
    tickMercenaryAi25Hz(
      { player: owner, monsters: [outOfRangeMonster], events: [], tick: 1 } as any,
      inRangeMerc,
      owner,
    )
    expect(inRangeMerc.state).toBe('idle')

    const inRangeMonster = { index: 2, x: 484, y: 100, hp: 200, maxHp: 200, state: 'idle' } as any
    tickMercenaryAi25Hz(
      { player: owner, monsters: [inRangeMonster], events: [], tick: 1 } as any,
      inRangeMerc,
      owner,
    )
    expect(inRangeMerc.state).toBe('chase')
  })

  it('3. AIMERC_ChooseSkill_6FC3C4E0 (selectMercenarySkill113c) matches Hireling.txt Chance weights within ±2% over 10,000 trials (including Frozen Armor)', () => {
    const cases: { subType: number; act: 1 | 2 | 3 | 5; diff: 1 | 2 | 3; level: number }[] = [
      { subType: 0, act: 1, diff: 1, level: 25 }, // Act 1 Rogue Scout (Fire Arrow + Inner Sight)
      { subType: 7, act: 2, diff: 1, level: 25 }, // Act 2 Desert Mercenary (Jab + Defiance aura)
      { subType: 16, act: 3, diff: 1, level: 25 }, // Act 3 Iron Wolf Cold (Ice Blast + Glacial Spike + Frozen Armor)
      { subType: 24, act: 5, diff: 1, level: 25 }, // Act 5 Barbarian (Bash + Stun)
    ]

    const trials = 10000
    for (const c of cases) {
      const stats = resolveHirelingStatsAtLevel(c.subType, c.act, c.diff, c.level, true)!
      expect(stats).toBeDefined()
      const activeAura = stats.skills.find((s) => s.mode === 1)?.skillName

      const expectedWeights = new Map<string, number>()
      expectedWeights.set('Attack', stats.defaultChance)
      let totalWeight = stats.defaultChance
      for (const s of stats.skills) {
        if (s.effectiveLevel <= 0) continue
        if (s.mode === 1 && activeAura === s.skillName) continue
        expectedWeights.set(s.skillName, s.chance)
        totalWeight += s.chance
      }

      const counts = new Map<string, number>()
      for (let t = 0; t < trials; t++) {
        const picked = selectMercenarySkill113c(stats, t, { activeAura })
        counts.set(picked, (counts.get(picked) ?? 0) + 1)
      }

      for (const [skillName, weight] of expectedWeights.entries()) {
        const expectedRatio = weight / totalWeight
        const observedRatio = (counts.get(skillName) ?? 0) / trials
        expect(Math.abs(observedRatio - expectedRatio)).toBeLessThanOrEqual(0.02)
      }
    }

    // Specifically verify Act 3 Cold Iron Wolf casts Frozen Armor according to its Hireling.txt Chance weight instead of filtering it out
    const act3Cold = resolveHirelingStatsAtLevel(16, 3, 1, 25, true)!
    const faSkill = act3Cold.skills.find((s) => s.skillName === 'Frozen Armor')!
    expect(faSkill).toBeDefined()
    let frozenArmorCount = 0
    for (let t = 0; t < trials; t++) {
      if (selectMercenarySkill113c(act3Cold, t) === 'Frozen Armor') {
        frozenArmorCount++
      }
    }
    expect(frozenArmorCount).toBeGreaterThan(0)
  })

  it('4. Mercenary damage rolls across [minDmg, maxDmg], never falls back to Might aura, and throws on invalid Hireling.txt lookup', () => {
    const owner = { x: 100, y: 100, hp: 500, maxHp: 500, alive: true } as any
    const stats = resolveHirelingStatsAtLevel(24, 5, 1, 35, true)!
    expect(stats.maxDmg).toBeGreaterThan(stats.minDmg)

    const observedDamages = new Set<number>()
    for (let t = 0; t < 60; t++) {
      const target = { index: 1, x: 110, y: 100, hp: 1000, maxHp: 1000, state: 'idle' } as any
      const merc: MercenaryUnitState = {
        unitId: 202,
        act: 5,
        difficulty: 1,
        subType: 24,
        level: 35,
        x: 100,
        y: 100,
        hp: 500,
        maxHp: 500,
        alive: true,
      }
      const res = tickMercenaryAi25Hz(
        { player: owner, monsters: [target], events: [], tick: t } as any,
        merc,
        owner,
      )
      expect(res.activeAura).toBeUndefined()
      const dealt = 1000 - target.hp
      expect(dealt).toBeGreaterThanOrEqual(stats.minDmg)
      expect(dealt).toBeLessThanOrEqual(stats.maxDmg)
      observedDamages.add(dealt)
    }
    // Must not collapse to a single constant average value
    expect(observedDamages.size).toBeGreaterThan(1)

    // Invalid subType / act must throw instead of silently falling back to fake stats or 'Might'
    expect(() =>
      tickMercenaryAi25Hz(
        { player: owner, monsters: [], events: [], tick: 1 } as any,
        {
          unitId: 999,
          act: 2,
          difficulty: 1,
          subType: 9999,
          level: 30,
          x: 100,
          y: 100,
          hp: 400,
          maxHp: 400,
          alive: true,
        },
        owner,
      ),
    ).toThrow(/missing Hireling\.txt record/)
  })

  it('5. resolvePetAiProfile113c & SummonManager.tickPets enforce 1.13c per-AI-function leash/teleport, follow, and finite aggro thresholds', () => {
    expect(SUBTILE_PIXELS_113C).toBe(16)

    // Verify 1.13c AI profiles across all pet families
    expect(resolvePetAiProfile113c({ kind: 'skeleton' }, 2)).toMatchObject({
      aiName: 'NecroPet',
      teleportSubtiles: 50,
      leashRunSubtiles: 25,
      followWalkSubtiles: 13,
      aggroSubtiles: 15,
      meleeReachSubtiles: 2,
      velocity: 11,
      aiDelayFrames: 15,
      isStationary: false,
      canMeleeAttack: true,
    })
    expect(resolvePetAiProfile113c({ kind: 'skeleton' }, 6).followWalkSubtiles).toBe(15)
    expect(resolvePetAiProfile113c({ kind: 'skeleton' }, 12).followWalkSubtiles).toBe(20)

    expect(resolvePetAiProfile113c({ kind: 'spirit_wolf' })).toMatchObject({
      aiName: 'DruidWolf',
      teleportSubtiles: 50,
      leashRunSubtiles: 21,
      followWalkSubtiles: 13,
      aggroSubtiles: 20,
      meleeReachSubtiles: 2,
      velocity: 11,
      runVelocity: 15,
      aiDelayFrames: 13,
    })
    expect(resolvePetAiProfile113c({ kind: 'grizzly' })).toMatchObject({
      aiName: 'DruidBear',
      teleportSubtiles: 50,
      leashRunSubtiles: 21,
      followWalkSubtiles: 13,
      aggroSubtiles: 20,
      meleeReachSubtiles: 2,
      velocity: 9,
      aiDelayFrames: 14,
    })
    expect(resolvePetAiProfile113c({ kind: 'raven' })).toMatchObject({
      aiName: 'Raven',
      teleportSubtiles: 50,
      followWalkSubtiles: 12,
      aggroSubtiles: 25,
      meleeReachSubtiles: 1,
      velocity: 13,
      aiDelayFrames: 15,
    })
    expect(resolvePetAiProfile113c({ petType: 'totem', kind: 'oak_sage' })).toMatchObject({
      aiName: 'Totem',
      teleportSubtiles: 30,
      followWalkSubtiles: 12,
      aggroSubtiles: 0,
      velocity: 9,
      isStationary: false,
      canMeleeAttack: false,
    })
    expect(resolvePetAiProfile113c({ petType: 'vine', kind: 'poison_creeper' })).toMatchObject({
      aiName: 'Vines',
      teleportSubtiles: 35,
      followWalkSubtiles: 13,
      aggroSubtiles: 15,
      velocity: 8,
      isStationary: false,
      canMeleeAttack: false,
    })
    expect(resolvePetAiProfile113c({ petType: 'vine', kind: 'carrion_vine' })).toMatchObject({
      aiName: 'CycleOfLife',
      teleportSubtiles: 35,
      followWalkSubtiles: 13,
      aggroSubtiles: 10,
      velocity: 8,
      isStationary: false,
      canMeleeAttack: false,
    })
    expect(resolvePetAiProfile113c({ kind: 'shadow_warrior' })).toMatchObject({
      aiName: 'ShadowWarrior',
      teleportSubtiles: 50,
      leashRunSubtiles: 25,
      followWalkSubtiles: 20,
      aggroSubtiles: 20,
      velocity: 9,
      runVelocity: 13,
      aiDelayFrames: 10,
    })
    expect(resolvePetAiProfile113c({ kind: 'shadow_master' })).toMatchObject({
      aiName: 'ShadowMaster',
      teleportSubtiles: 50,
      leashRunSubtiles: 25,
      followWalkSubtiles: 20,
      aggroSubtiles: 20,
      velocity: 9,
      runVelocity: 13,
      aiDelayFrames: 5,
    })

    // Verify SummonManager.tickPets:
    // - At 600 px (37.5 subtiles <= 50 subtiles = 800 px), NecroPet does NOT teleport (walks/runs toward owner)
    // - At 850 px (> 50 subtiles = 800 px), NecroPet teleports to owner
    // - Enemy at 400 px (25 subtiles > 15 subtiles = 240 px NecroPet aggro) is NOT targeted
    const registry = getSharedDataRegistry()
    const mgr = new SummonManager(registry)
    const missileEngine = new MissileEngine(registry)
    const auraScanner = new AuraScanner(registry)

    const makeCtx = (id: string, x: number, y: number): CombatUnitContext => {
      const statList = new UnitStatList(registry)
      statList.setBaseStat('level', 30)
      statList.setBaseStat('maxhp', 500 * FIXED_ONE)
      statList.setBaseStat('hitpoints', 500 * FIXED_ONE)
      return {
        id,
        name: id,
        unitType: id.startsWith('player') ? 'player' : 'monster',
        statList,
        stateBus: new StateBus(statList, registry),
        x,
        y,
      }
    }

    const owner = makeCtx('player-1', 100, 100)
    const golem = mgr.createPet({
      owner,
      skillId: 75,
      slvl: 10,
      x: 700, // 600 px from owner (<= 800 px teleport threshold)
      y: 100,
    }).pet!

    const farEnemy = makeCtx('enemy-far', 1100, 100) // 400 px from golem (> 240 px NecroPet aggro)
    mgr.tickPets({
      currentTick: 1,
      owner,
      enemies: [farEnemy],
      enemyPositions: new Map([['enemy-far', { x: 1100, y: 100 }]]),
      missileEngine,
      auraScanner,
    })
    expect(golem.targetId).toBeUndefined()

    // With no targetable enemies, golem at 600 px runs toward owner without teleporting
    mgr.tickPets({
      currentTick: 2,
      owner,
      enemies: [],
      enemyPositions: new Map(),
      missileEngine,
      auraScanner,
    })
    expect(golem.x).toBeLessThan(700)
    expect(golem.x).toBeGreaterThan(600)

    // Move owner to > 800 px away -> golem teleports to owner
    const farOwner = makeCtx('player-1', 1600, 100)
    mgr.tickPets({
      currentTick: 3,
      owner: farOwner,
      enemies: [],
      enemyPositions: new Map(),
      missileEngine,
      auraScanner,
    })
    expect(golem.x).toBe(1600)
    expect(golem.y).toBe(100)
  })

  it('6. GameInstance.hireMercenary sets 1.13c MonStats/Hireable reach, aggroRadius, speed, and cooldownTicks', () => {
    const game = createTestGame({ mapSeed: 0x113c1466 })
    const pid = spawnPlayerInGame(game, { x: 100, y: 100 })

    game.hireMercenary(pid, { act: 2, difficulty: 1, subType: 7, level: 30, x: 102, y: 100 })
    const mercState = game.getMercenaryState(pid)!
    expect(mercState).toBeDefined()
    expect(mercState.activeAura).toBe('Defiance')

    // At 60 subtiles from owner (<= 100 subtiles teleport threshold), mercenary does NOT teleport
    game.movePlayer(pid, 162, 100)
    stepFrames(game, 2)
    expect(game.getMercenaryState(pid)!.x).toBeLessThan(162)

    // At > 100 subtiles from owner, mercenary teleports to owner
    game.movePlayer(pid, 300, 100)
    stepFrames(game, 2)
    expect(game.getMercenaryState(pid)!.x).toBe(300)
  })
})
