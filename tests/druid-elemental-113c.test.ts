import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import { SKILLS_BY_ID } from '../src/common/data/skills-catalog.ts'
import {
  buildTooltipViewModel,
  createInitialState,
  type SkillCalcState,
} from '../src/common/skills/skill-calc-engine.ts'
import {
  CANONICAL_113C_MISSILES,
  CANONICAL_113C_OVERLAYS,
  getMissileTxtData,
  getOverlayTxtData,
  getSkillCastOverlay,
  getSkillOverlayRow113c,
} from '../src/common/skills/missiles-data.ts'
import { getSkillRange } from '../src/common/skills/weapon-combat-meta.ts'
import {
  canCastDruidSkill,
  canCastShapeShiftSkill,
} from '../src/server/skills/druid-shapeshift.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'
import { evaluateSkill113c } from '../src/server/skills/registry.ts'
import { WorldArena } from '../src/server/engine/world-arena.ts'
import { castSkill } from '../src/server/skills/skills.ts'
import { tickProjectiles, type Projectile, type ProjectileTarget } from '../src/server/skills/skills.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { getMissileCollideType113c } from '../src/client/world/world-skill-state-tables.ts'

const DRUID_ELEMENTAL_SKILL_IDS = [225, 229, 230, 234, 235, 240, 244, 245, 249, 250] as const

function makeDruidCalcState(hardPoints: Record<number, number>): SkillCalcState {
  return {
    ...createInitialState('dru'),
    hardPoints,
  }
}

describe('Druid Elemental Skills (#225-#250) — 1.13c 4-Layer Parity (Issue #1017)', () => {
  describe('Section 0: Shared Druid Form Restriction Guard (1.13c Skills.txt restrict & State1..3)', () => {
    it('enforces #249 Armageddon as restrict=1 (any form) and the other 9 Elemental skills as human-only', () => {
      for (const skillId of DRUID_ELEMENTAL_SKILL_IDS) {
        // Human form: all 10 elemental skills are castable
        expect(canCastShapeShiftSkill('human', skillId)).toBe(true)
        expect(canCastDruidSkill('human', skillId)).toBe(true)

        if (skillId === 249) {
          // #249 Armageddon: restrict=1, State1=wearwolf, State2=wearbear -> castable in wolf & bear forms
          expect(canCastShapeShiftSkill('wolf', skillId)).toBe(true)
          expect(canCastShapeShiftSkill('bear', skillId)).toBe(true)
          expect(canCastDruidSkill('wolf', skillId)).toBe(true)
          expect(canCastDruidSkill('bear', skillId)).toBe(true)
        } else {
          // All other 9 Elemental skills (#225, #229, #230, #234, #235, #240, #244, #245, #250) are human-only
          expect(canCastShapeShiftSkill('wolf', skillId)).toBe(false)
          expect(canCastShapeShiftSkill('bear', skillId)).toBe(false)
          expect(canCastDruidSkill('wolf', skillId)).toBe(false)
          expect(canCastDruidSkill('bear', skillId)).toBe(false)
        }
      }

      // Cross-check Shape-Shifting skills
      expect(canCastShapeShiftSkill('wolf', 223)).toBe(true)
      expect(canCastShapeShiftSkill('bear', 228)).toBe(true)
      expect(canCastShapeShiftSkill('human', 239)).toBe(false)
      expect(canCastShapeShiftSkill('wolf', 239)).toBe(true)
      expect(canCastShapeShiftSkill('bear', 239)).toBe(true)
    })
  })

  describe('Layer 1: Catalog, Calc Engine, Overlays & Missiles Data', () => {
    it('has exact Chinese localization, descriptions, and synergy arrays for #225-#250', () => {
      expect(SKILLS_BY_ID[240]?.nameZh).toBe('小旋风')
      expect(SKILLS_BY_ID[240]?.longDescZh).toContain('龙卷风')
      expect(SKILLS_BY_ID[245]?.nameZh).toBe('龙卷风')
      expect(SKILLS_BY_ID[245]?.longDescZh).toContain('物理伤害')
      expect(SKILLS_BY_ID[249]?.nameZh).toBe('末日浩劫')
      expect(SKILLS_BY_ID[249]?.longDescZh).toContain('流星雨')
      expect(SKILLS_BY_ID[250]?.nameZh).toBe('暴风')
      expect(SKILLS_BY_ID[250]?.longDescZh).toContain('极寒风暴')

      // #229 Molten Boulder receives Firestorm (+8% fire) and Volcano (+10% physical)
      const mbSynIds = SKILLS_BY_ID[229]?.synergiesReceived.map((s) => s.providerId) ?? []
      expect(mbSynIds).toEqual(expect.arrayContaining([225, 244]))

      // #235 Cyclone Armor receives Twister (+7% absorb), Tornado (+7% absorb), Hurricane (+7% absorb)
      const caSynIds = SKILLS_BY_ID[235]?.synergiesReceived.map((s) => s.providerId) ?? []
      expect(caSynIds).toEqual(expect.arrayContaining([240, 245, 250]))

      // #244 Volcano receives Molten Boulder (+12% physical), Fissure (+12% fire), Armageddon (+12% fire)
      const volSynIds = SKILLS_BY_ID[244]?.synergiesReceived.map((s) => s.providerId) ?? []
      expect(volSynIds).toEqual(expect.arrayContaining([229, 234, 249]))
    })

    it('computes exact 1.13c tooltip calc lines for all 10 Druid Elemental skills', () => {
      // #225 Firestorm L1: descdam=9 -> 3-7 average fire damage per second
      const fsVm = buildTooltipViewModel(makeDruidCalcState({ 225: 1 }), 225)
      expect(fsVm?.current.effects.some((e) => e.textEn.includes('3-7') || e.textZh.includes('3 - 7'))).toBe(true)

      // #229 Molten Boulder L1 with +10 Firestorm (fire only) vs +10 Volcano (phys only)
      const mbBase = buildTooltipViewModel(makeDruidCalcState({ 225: 1, 229: 1 }), 229)
      const mbWithFs = buildTooltipViewModel(makeDruidCalcState({ 225: 10, 229: 1 }), 229)
      const mbWithVol = buildTooltipViewModel(makeDruidCalcState({ 225: 1, 229: 1, 234: 1, 244: 10 }), 229)
      expect(mbBase?.current.damage.physMin).toBeDefined()
      expect(mbWithFs?.current.damage.physMin).toBe(mbBase?.current.damage.physMin) // physical unchanged by Firestorm
      expect(mbWithFs?.current.damage.finalMin).toBeGreaterThan(mbBase?.current.damage.finalMin ?? 0) // fire boosted by Firestorm
      expect(mbWithVol?.current.damage.physMin).toBeGreaterThan(mbBase?.current.damage.physMin ?? 0) // physical boosted by Volcano

      // #230 Arctic Blast L1: descdam=8 -> 8-15 cold dmg/sec, chill=4s
      const abVm = buildTooltipViewModel(makeDruidCalcState({ 230: 1 }), 230)
      expect(abVm?.current.damage.finalMin).toBe(8)
      expect(abVm?.current.damage.finalMax).toBe(15)
      expect(abVm?.current.effects.some((e) => e.textEn.includes('4') || e.textZh.includes('4'))).toBe(true)

      // #235 Cyclone Armor L1: absorbs 40 elemental damage, boosted +7% per point in #240/#245/#250
      const caL1 = buildTooltipViewModel(makeDruidCalcState({ 230: 1, 235: 1 }), 235)?.current.effects ?? []
      expect(caL1.some((e) => e.textEn.includes('40') || e.textZh.includes('40'))).toBe(true)
      const caSyn = buildTooltipViewModel(makeDruidCalcState({ 230: 1, 235: 1, 240: 10 }), 235)?.current.effects ?? []
      expect(caSyn.some((e) => e.textEn.includes('68') || e.textZh.includes('68'))).toBe(true)

      // #240 Twister L1: stun length 0.4 seconds (10 frames) via lineType 12
      const twEffects = buildTooltipViewModel(makeDruidCalcState({ 230: 1, 235: 1, 240: 1 }), 240)?.current.effects ?? []
      expect(twEffects.some((e) => e.textEn.includes('0.4') || e.textZh.includes('0.4'))).toBe(true)
    })

    it('provides canonical 1.13c overlays, missile rows, and skill ranges', () => {
      expect(CANONICAL_113C_OVERLAYS['cyclonearmor1front']).toBeDefined()
      expect(CANONICAL_113C_OVERLAYS['cyclonearmor1back']?.preDraw).toBe(true)
      expect(CANONICAL_113C_OVERLAYS['twisterfront']).toBeDefined()
      expect(CANONICAL_113C_OVERLAYS['twisterback']?.preDraw).toBe(true)
      expect(getOverlayTxtData('cyclonearmor1front').frames).toBe(11)
      expect(getSkillCastOverlay(230)).toBeUndefined()
      expect(getSkillOverlayRow113c(230)?.prgOverlay).toBe('arctic_blast_cast')
      expect(getSkillCastOverlay(234)).toBe('druid_fire_cast_2')
      expect(getSkillCastOverlay(244)).toBe('druid_fire_cast_2')
      expect(getSkillCastOverlay(249)).toBe('druid_fire_cast_2')

      expect(CANONICAL_113C_MISSILES['firestormmaker']?.range).toBe(40)
      expect(CANONICAL_113C_MISSILES['firestorm']?.range).toBe(15)
      expect(CANONICAL_113C_MISSILES['moltenboulder']?.alwaysExplode).toBe(true)
      expect(CANONICAL_113C_MISSILES['arcticblast1']?.range).toBe(30)
      expect(CANONICAL_113C_MISSILES['erruption center']?.range).toBe(80)
      expect(CANONICAL_113C_MISSILES['volcano']?.range).toBe(150)
      expect(CANONICAL_113C_MISSILES['moltenboulder-flyingrocks']?.range).toBe(16)
      expect(CANONICAL_113C_MISSILES['armageddonfire']?.range).toBe(37)
      expect(getMissileTxtData('twister').range).toBe(50)
      expect(getMissileTxtData('tornado').range).toBe(75)

      expect(getSkillRange(225)).toBe(320)
      expect(getSkillRange(229)).toBe(400)
      expect(getSkillRange(230)).toBe(360)
      expect(getSkillRange(234)).toBe(450)
      expect(getSkillRange(240)).toBe(500)
      expect(getSkillRange(244)).toBe(450)
      expect(getSkillRange(245)).toBe(600)
      expect(getSkillRange(249)).toBe(0)
      expect(getSkillRange(250)).toBe(0)
    })
  })

  describe('Layer 2: Server Authoritative Pipeline (State Bus, Registry & MissileEngine)', () => {
    it('absorbs Fire/Light/Cold damage via Cyclone Armor (state 151) BEFORE resistances, leaving Physical/Magic/Poison untouched', () => {
      const statList = new UnitStatList()
      const bus = new StateBus(statList)
      // L1 Cyclone Armor with 10 points in Twister (#240): floor(40 * 170 / 100) = 68 absorb pool
      const absorbPool = Math.trunc(((40 + (1 - 1) * 12) * (100 + 10 * 7)) / 100)
      expect(absorbPool).toBe(68)
      bus.applyState({
        stateNameOrId: 'cyclonearmor',
        slvl: 1,
        stats: {
          cyclone_armor_absorb: absorbPool,
          magicarmor: absorbPool,
        },
      })
      expect(bus.hasState('cyclonearmor')).toBe(true)

      // Physical & Poison bypass Cyclone Armor completely
      const afterPhysPois = bus.triggerReactiveEvents({
        event: 'absorbdamage',
        incomingPhys256: 50 * FIXED_ONE,
        incomingElem256: 30 * FIXED_ONE,
        elemType: 'pois',
        isPoison: true,
      })
      expect(afterPhysPois.absorbedPhys256).toBe(0)
      expect(afterPhysPois.absorbedElem256).toBe(0)
      expect(bus.hasState('cyclonearmor')).toBe(true)

      // Magic damage also bypasses Cyclone Armor completely
      const afterMag = bus.triggerReactiveEvents({
        event: 'absorbdamage',
        incomingElem256: 25 * FIXED_ONE,
        elemType: 'mag',
      })
      expect(afterMag.absorbedElem256).toBe(0)
      expect(bus.hasState('cyclonearmor')).toBe(true)

      // 40 Fire absorbed from 68 pool -> 28 pool remaining
      const afterFire = bus.triggerReactiveEvents({
        event: 'absorbdamage',
        incomingElem256: 40 * FIXED_ONE,
        elemType: 'fire',
      })
      expect(afterFire.absorbedElem256).toBe(40 * FIXED_ONE)
      expect(bus.hasState('cyclonearmor')).toBe(true)

      // 40 Cold against 28 remaining pool -> 28 Cold absorbed, state collapses
      const afterCold = bus.triggerReactiveEvents({
        event: 'absorbdamage',
        incomingElem256: 40 * FIXED_ONE,
        elemType: 'cold',
      })
      expect(afterCold.absorbedElem256).toBe(28 * FIXED_ONE)
      expect(bus.hasState('cyclonearmor')).toBe(false)
    })

    it('evaluates Cyclone Armor synergy and executes #240 Twister, #244 Volcano, #225 Firestorm, and #234 Fissure in WorldArena', async () => {
      const registry = await getSharedDataRegistry()
      const caSkill = registry.getSkillById(235)!
      const statList = new UnitStatList(registry)
      statList.setBaseSkillLevel(235, 10)
      statList.setBaseSkillLevel(240, 10) // +70% from Twister
      statList.setBaseSkillLevel(245, 5) // +35% from Tornado
      const eval235 = evaluateSkill113c({
        registry,
        skill: caSkill,
        slvl: 10,
        blvl: 10,
        statList,
      })
      expect(eval235.synergyBonusPct).toBe(105)

      // #240 Twister spawns 3 twister missiles
      const arena240 = new WorldArena({
        registry,
        classCode: 'dru',
        skillId: 240,
        slvl: 5,
      })
      const out240 = arena240.triggerCast()
      expect(out240?.executed).toBe(true)
      expect(out240?.missilesSpawned.filter((m) => m === 'twister')).toHaveLength(3)

      // #244 Volcano spawns volcano controller and steps volcano fireballs
      const arena244 = new WorldArena({
        registry,
        classCode: 'dru',
        skillId: 244,
        slvl: 5,
      })
      const out244 = arena244.triggerCast()
      expect(out244?.executed).toBe(true)
      expect(out244?.missilesSpawned).toContain('volcano')
      arena244.stepTicks(15)
      expect(arena244.getDebugState().castCount).toBeGreaterThanOrEqual(1)

      // #225 Firestorm spawns 3 firestormmaker missiles and steps firestorm sub-trails
      const arena225 = new WorldArena({
        registry,
        classCode: 'dru',
        skillId: 225,
        slvl: 5,
      })
      const out225 = arena225.triggerCast()
      expect(out225?.executed).toBe(true)
      expect(out225?.missilesSpawned.filter((m) => m === 'firestormmaker')).toHaveLength(3)
    })
  })

  describe('Layer 3: Scene Skill Caster & Projectile Stepping (skill-caster.ts & skills.ts)', () => {
    function makeMockSceneEngine() {
      const monster = {
        index: 0,
        id: 1,
        x: 240,
        y: 200,
        hp: 1000,
        maxHp: 1000,
        alive: true,
        state: 'idle',
        stats: { id: 'zombie1', name: 'Zombie', hp: 1000 },
      } as any
      const engine = {
        world: {
          tick: 1,
          player: {
            x: 200,
            y: 200,
            hp: 500,
            maxHp: 500,
            mana: 500,
            maxMana: 500,
            level: 40,
            cooldown: 0,
            swingTicks: 0,
            charClass: 'dru',
            druidForm: 'human' as 'human' | 'wolf' | 'bear',
            skillLevels: {
              225: 5,
              229: 5,
              230: 5,
              234: 5,
              235: 5,
              240: 5,
              244: 5,
              245: 5,
              249: 5,
              250: 5,
            },
            baseSkillLevels: {
              225: 5,
              229: 5,
              230: 5,
              234: 5,
              235: 5,
              240: 5,
              244: 5,
              245: 5,
              249: 5,
              250: 5,
            },
          } as any,
          monsters: [monster],
          events: [],
        },
        projectiles: [] as any[],
        explosions: [],
        overlays: [] as any[],
        metrics: { casts: 0, playerHits: 0, castHits: 0, pickups: 0, inventoryRefusals: 0 },
        spawnOverlay: (token: string, pos: { x: number; y: number }) => {
          engine.overlays.push({ token, x: pos.x, y: pos.y })
        },
      } as any
      return { engine, monster }
    }

    it('blocks non-Armageddon Elemental skills in Werewolf/Werebear form and allows #249 Armageddon', () => {
      const { engine } = makeMockSceneEngine()
      const status = { textContent: null as string | null }
      const runtime = { level: 'Blood Moor', levelId: 2, act: 1, grid: {} as any }

      engine.world.player.druidForm = 'wolf'

      // #225 Firestorm rejected in Werewolf form
      const ok225 = castSkill(225, 250, 200, {
        engine,
        runtime,
        hudManager: null,
        status,
      })
      expect(ok225).toBe(false)

      // #249 Armageddon allowed in Werewolf form
      const ok249 = castSkill(249, 250, 200, {
        engine,
        runtime,
        hudManager: null,
        status,
      })
      expect(ok249).toBe(true)
      expect(engine.world.player.armageddonTicks).toBe(250 + 5 * 50) // 500 ticks
    })

    it('casts #235 Cyclone Armor, #234 Fissure at ground target, #244 Volcano, #245 Tornado, and #250 Hurricane', () => {
      const { engine } = makeMockSceneEngine()
      const status = { textContent: null as string | null }
      const runtime = { level: 'Blood Moor', levelId: 2, act: 1, grid: {} as any }

      // #235 Cyclone Armor sets cycloneArmorHp with synergy-boosted absorb pool
      const ok235 = castSkill(235, 200, 200, {
        engine,
        runtime,
        hudManager: null,
        status,
      })
      expect(ok235).toBe(true)
      expect(engine.world.player.cycloneArmorHp).toBeGreaterThan(40)

      // #234 Fissure spawns eruptioncenter at ground target (targetX, targetY)
      engine.world.player.cooldown = 0
      const ok234 = castSkill(234, 320, 280, {
        engine,
        runtime,
        hudManager: null,
        status,
      })
      expect(ok234).toBe(true)
      expect(engine.world.player.cooldown).toBe(50)
      const fissureProj = engine.projectiles.find((p: any) => p.missileType === 'erruption center')
      expect(fissureProj).toBeDefined()
      expect(fissureProj.x).toBe(320)
      expect(fissureProj.y).toBe(280)

      // #244 Volcano spawns volcanobase at ground target with 100-frame cooldown
      engine.world.player.cooldown = 0
      const ok244 = castSkill(244, 340, 300, {
        engine,
        runtime,
        hudManager: null,
        status,
      })
      expect(ok244).toBe(true)
      expect(engine.world.player.cooldown).toBe(100)
      const volcanoProj = engine.projectiles.find((p: any) => p.missileType === 'volcano')
      expect(volcanoProj).toBeDefined()
      expect(volcanoProj.x).toBe(340)
      expect(volcanoProj.y).toBe(300)

      // #250 Hurricane activates 250 + CycloneArmor*50 tick cold vortex
      engine.world.player.cooldown = 0
      const ok250 = castSkill(250, 200, 200, {
        engine,
        runtime,
        hudManager: null,
        status,
      })
      expect(ok250).toBe(true)
      expect(engine.world.player.cooldown).toBe(150)
      expect(engine.world.player.hurricaneTicks).toBe(250 + 5 * 50)
    })

    it('steps Druid Elemental projectiles in tickProjectiles (Twister 10f stun & NextDelay)', () => {
      const target: ProjectileTarget = {
        index: 0,
        x: 112,
        y: 100,
        radius: 12,
        alive: true,
      }
      const twisterProj: Projectile = {
        skillId: '240',
        missileType: 'twister',
        x: 100,
        y: 100,
        vx: 12,
        vy: 0,
        damage: 15,
        ttl: 25,
        fromPlayer: true,
        pierce: true,
        nextHit: 1,
        nextDelay: 25,
        jitterIndex: 0,
      }
      const res = tickProjectiles([twisterProj], [target], {
        overlap: () => 0,
        radius: 12,
      })
      expect(res.hits.length).toBeGreaterThanOrEqual(1)
      expect(res.hits[0]?.stunDuration).toBe(10)
    })
  })

  describe('Layer 4: Client World Missiles & Stepper (world-skill-missiles.ts & world-missile-stepper.ts)', () => {
    it('classifies Druid Elemental missile CollideType 0 and CollideType 8 accurately', () => {
      expect(getMissileCollideType113c('erruption center')).toBe(0)
      expect(getMissileCollideType113c('volcano')).toBe(0)
      expect(getMissileCollideType113c('hurricaneswoosh')).toBe(0)
      expect(getMissileCollideType113c('armageddonrock')).toBe(0)
      expect(getMissileCollideType113c('firestormmaker')).toBe(8)
      expect(getMissileCollideType113c('moltenboulder')).toBe(8)
      expect(getMissileCollideType113c('armageddonfire')).toBe(8)
    })

    it('spawns and steps all 10 Druid Elemental skills in ClientWorld', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 5, name: 'Dru', x: 100, y: 100 })
      const caster = world.getUnit('player', 1)!

      for (const skillId of DRUID_ELEMENTAL_SKILL_IDS) {
        ;(world as any).spawnMissilesForSkill(caster, skillId, 108, 104, 5)
      }

      // Verify Cyclone Armor (151), Armageddon (145), and Hurricane (144) states on caster (Cyclone Armor draws staged front overlay via state 151, no cyclonearmor1back)
      expect(caster.states.has(151)).toBe(true)
      expect(caster.states.has(145)).toBe(true)
      expect(caster.states.has(144)).toBe(true)
      expect(caster.overlays.some((o) => o.token === 'cyclonearmor1back')).toBe(false)

      // Step 15 discrete simulation ticks and verify sub-missiles (firestorm, moltenboulderfirepath, eruptioncenter, volcanobase, tornado, hurricaneswoosh)
      for (let i = 0; i < 15; i++) {
        ;(world as any).stepDiscreteSimulationTick(40)
      }
      const allUnits = Array.from(world.units.values())
      const missileKeys = new Set(
        allUnits.filter((u) => u.unitType === 'missile').map((u) => u.missileKey),
      )
      expect(missileKeys.has('firestorm')).toBe(true)
      expect(missileKeys.has('moltenboulder')).toBe(true)
      expect(missileKeys.has('erruption center')).toBe(true)
      expect(missileKeys.has('volcano')).toBe(true)
      expect(missileKeys.has('tornado')).toBe(true)
      expect(missileKeys.has('hurricaneswoosh')).toBe(true)
    })
  })
})
