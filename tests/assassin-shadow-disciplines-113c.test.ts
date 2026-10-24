import { describe, expect, it } from 'vitest'
import { SKILLS_BY_ID } from '../src/common/data/skills-catalog.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { chanceToBlock, COMBAT_STAT } from '../src/client/ui-model/combat-stats.ts'
import { aggregateUnit } from '../src/client/ui-model/stat-engine.ts'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'
import { AuraScanner } from '../src/server/engine/aura-scanner.ts'
import { MissileEngine } from '../src/server/engine/missile-engine.ts'
import { SummonManager } from '../src/server/ai/summon-manager.ts'
import { WorldArena } from '../src/server/engine/world-arena.ts'
import {
  evaluateAvoidanceAndBlock,
  executeSUnitDmg,
  type CombatUnitContext,
} from '../src/server/engine/combat-pipeline.ts'
import {
  evaluateSkillCore113c,
  executeSkillCore113c,
} from '../src/server/skills/registry.ts'
import {
  computePsychicHammerDamage,
  computePsychicHammerKnockbackChance,
  computeVenomPoisonDamage,
  getShadowMasterCastingLevel,
  computeShadowMaxLife,
  computeShadowMlvl,
  generateShadowEquipment,
} from '../src/server/skills/assassin-shadow.ts'

describe('Issue #1004: Assassin Shadow Disciplines (#252-#279) 4-Layer 1.13c Fidelity', () => {
  describe('Layer 1: skills-catalog.ts, hud-world-sync.ts, combat-stats.ts & stat-engine.ts', () => {
    it('aligns nameZh / shortDescZh / longDescZh for all 10 Shadow Disciplines skills (#252-#279)', () => {
      const expected: Record<number, { nameZh: string; keywordZh: string }> = {
        252: { nameZh: '爪支配', keywordZh: '爪类武器' },
        253: { nameZh: '心灵战锤', keywordZh: '念力冲击' },
        258: { nameZh: '加速', keywordZh: '攻击与移动速度' },
        263: { nameZh: '武器格挡', keywordZh: '爪类武器' },
        264: { nameZh: '魔影斗篷', keywordZh: '视野与防御' },
        267: { nameZh: '消解', keywordZh: '抗性' },
        268: { nameZh: '暗影战士', keywordZh: '暗影分身' },
        273: { nameZh: '心灵震爆', keywordZh: '转化' },
        278: { nameZh: '毒牙', keywordZh: '毒素伤害' },
        279: { nameZh: '暗影大师', keywordZh: '暗影分身' },
      }

      for (const [idStr, meta] of Object.entries(expected)) {
        const skill = SKILLS_BY_ID[Number(idStr)]
        expect(skill).toBeDefined()
        expect(skill!.nameZh).toBe(meta.nameZh)
        expect(skill!.shortDescZh).toContain(meta.keywordZh)
        expect(skill!.longDescZh.length).toBeGreaterThan(5)
      }
    })

    it('computes dual-claw #263 Weapon Block in chanceToBlock() without Dexterity scaling and drops to 0% while moving', () => {
      const lists = [
        {
          kind: 'other' as const,
          get: (st: number) => (st === COMBAT_STAT.PASSIVE_WEAPONBLOCK ? 50 : 0),
        },
      ]

      // Standing still with dual claws and no shield -> returns passive_weaponblock (50%), unaffected by Dexterity
      expect(
        chanceToBlock(
          { charClass: 'ass', clvl: 30, dexterity: 150, lists, isDualClaw: true },
          { isMoving: false },
        ),
      ).toBe(50)

      // Walking or running with dual claws -> 0% Weapon Block in 1.13c
      expect(
        chanceToBlock(
          { charClass: 'ass', clvl: 30, dexterity: 150, lists, isDualClaw: true },
          { isMoving: true },
        ),
      ).toBe(0)
      expect(
        chanceToBlock(
          { charClass: 'ass', clvl: 30, dexterity: 150, lists, isDualClaw: true },
          { isWalking: true },
        ),
      ).toBe(0)
    })

    it('synthesizes active Burst of Speed (157), Fade (159, including +1%/slvl damageresist), Cloak of Shadows (153), and Weapon Block (348) in StatEngine', () => {
      const world = new ClientWorld()
      ;(world.self as any).charClass = 6 // Assassin
      ;(world.self as any).level = 30
      ;(world.self as any).stats.set(0, 80) // Str
      ;(world.self as any).stats.set(2, 80) // Dex
      ;(world.self as any).stats.set(3, 80) // Vit
      ;(world.self as any).stats.set(1, 50) // Ene
      ;(world.self as any).stats.set(12, 30) // Level
      ;(world.self as any).stats.set(31, 200) // Base Defense

      const hardSkillLevels = new Map<number, number>([
        [252, 5], // Claw Mastery
        [258, 5], // Burst of Speed
        [263, 10], // Weapon Block
        [264, 5], // Cloak of Shadows
        [267, 10], // Fade
        [278, 5], // Venom
      ])

      const baseline = aggregateUnit({
        kind: 'player',
        stats: world.self.stats,
        level: 30,
        activeStates: new Set<number>(),
        classId: 6,
        hardSkillLevels,
        containers: world.containers,
      })

      // Passive Weapon Block (#263) exposed on stat 348 even with no active buff state
      expect(baseline.total(COMBAT_STAT.PASSIVE_WEAPONBLOCK)).toBe(50)

      // Activate Burst of Speed (157), Cloak of Shadows (153), Fade (159), and Venom (31)
      const buffed = aggregateUnit({
        kind: 'player',
        stats: world.self.stats,
        level: 30,
        activeStates: new Set<number>([157, 153, 159, 31]),
        classId: 6,
        hardSkillLevels,
        containers: world.containers,
      })

      // #258 Burst of Speed (State 157): +FRW (stat 67) & +IAS (stat 68)
      expect(buffed.total(67)).toBeGreaterThan(0)
      expect(buffed.total(68)).toBeGreaterThan(0)

      // #267 Fade (State 159): +All Resistances (39, 41, 43, 45) & +1%/slvl Physical Damage Reduction (stat 36 = 10% at slvl 10)
      expect(buffed.total(36)).toBe(10)
      expect(buffed.total(39)).toBeGreaterThan(baseline.total(39))
      expect(buffed.total(41)).toBeGreaterThan(baseline.total(41))

      // #264 Cloak of Shadows (State 153): +Defense% = 10 + 3*(5-1) = 22% (stat 16 & stat 171)
      expect(buffed.total(16)).toBe(22)
      expect(buffed.total(171)).toBe(22)
    })

    it('populates #252 Claw Mastery (AR%, ED%, Crit%) and #278 Venom 10-frame poison damage in HudModel character sheet when wielding claws', () => {
      const world = new ClientWorld()
      world.selfId = 1
      world.areaId = 1
      ;(world.self as any).charClass = 6 // Assassin ('ass')
      ;(world.self as any).level = 30
      ;(world.self as any).stats.set(0, 100) // Str
      ;(world.self as any).stats.set(2, 100) // Dex
      ;(world.self as any).stats.set(3, 100) // Vit
      ;(world.self as any).stats.set(1, 50) // Ene
      ;(world.self as any).stats.set(12, 30) // Level

      // Equip a Katar ('ktr', itemType 'h2h') in right hand (bodyLoc 4)
      ;(world.containers.equipment as Map<number, any>).set(101, {
        id: 101,
        code: 'ktr',
        name: 'Katar',
        itemType: 'h2h',
        bodyLoc: 4,
        equippedSlot: 4,
        quality: 2,
        identified: true,
        stats: [],
      } as any)

      for (const [id, lvl] of [
        [0, 1],
        [252, 5], // Claw Mastery slvl 5: +70% AR, +51% ED, +16% Crit
        [278, 1], // Venom slvl 1: 60-80 poison damage over 10 frames
      ] as const) {
        ;(world.self as any).skills.set(id, lvl)
        ;(world.self as any).skillEntries.set(id, {
          skillId: id,
          baseLevel: lvl,
          bonus: 0,
          level: lvl,
          charges: 0,
          ownerType: 0,
          ownerId: 1,
        })
      }

      ;(world.self as any).leftSkill = 0
      ;(world.self as any).rightSkill = 0

      const hud = new HudManager()
      const hudModel = new HudModel({ world, hudManager: hud })

      hudModel.syncFromWorld()
      const baseFormula = hud.charSheet.attrs.leftDamageFormula!
      expect(baseFormula).toBeDefined()
      expect(baseFormula.masteryEdPct).toBe(51) // 35 + 4*(5-1) = 51% ED from Claw Mastery
      expect(hud.charSheet.attrs.arPctBonus).toBe(70) // 30 + 10*(5-1) = 70% AR from Claw Mastery
      const baseMaxDmg = baseFormula.finalMax

      // Activate Venom State 31 ('venomclaws')
      ;(world.self.states as Set<number>).add(31)
      hudModel.syncFromWorld()
      const venomFormula = hud.charSheet.attrs.leftDamageFormula!

      // Venom slvl 1 adds 60-80 poison damage over 10 frames to character sheet weapon damage
      expect(venomFormula.poisonMin).toBe(60)
      expect(venomFormula.poisonMax).toBe(80)
      expect(venomFormula.finalMax - baseMaxDmg).toBe(80)
    })
  })

  describe('Layer 2: 1.13c Server Engine, Combat Pipeline, Registry & SummonManager', () => {
    it('resolves #278 Venom triple disconnect (venom/venomclaws State 31 alias, no 250 cap, 10-frame total damage & item poison clamp)', async () => {
      const registry = await getSharedDataRegistry()

      // 1. computeVenomPoisonDamage multiplies per-frame damage by ELen=10 frames (slvl 1 -> 60-80 total poison damage)
      const v1 = computeVenomPoisonDamage(1)
      expect(v1.durationFrames).toBe(10)
      expect(v1.minDamage).toBe(60)
      expect(v1.maxDamage).toBe(80)

      // High slvl Venom exceeds 250 damage (no bogus 25 * FIXED_ONE cap)
      const v15 = computeVenomPoisonDamage(15)
      expect(v15.minDamage).toBeGreaterThan(300)
      expect(v15.maxDamage).toBeGreaterThan(320)

      // 2. StateBus unifies 'venom' and 'venomclaws' (State ID 31)
      const statList = new UnitStatList(registry, {
        level: 30,
        maxmana: 200 * FIXED_ONE,
        mana: 200 * FIXED_ONE,
      })
      statList.setBaseSkillLevel(278, 15)
      const stateBus = new StateBus(statList, registry)

      const skill278 = registry.getSkillById(278)!
      const eval278 = evaluateSkillCore113c({
        registry,
        skill: skill278,
        slvl: 15,
        blvl: 15,
        statList,
        difficulty: 'normal',
      })
      executeSkillCore113c({
        registry,
        skill: skill278,
        evalResult: eval278,
        caster: {
          id: 'ass-1',
          name: 'Assassin',
          charClass: 'assassin',
          statList,
          stateBus,
          unitType: 'player',
        },
        targets: [],
        targetPositions: new Map(),
        corpses: [],
        missileEngine: new MissileEngine(registry),
        auraScanner: new AuraScanner(registry),
        summonManager: new SummonManager(registry),
        currentTick: 1,
        targetX: 100,
        targetY: 100,
        difficulty: 'normal',
      })

      expect(stateBus.hasState('venomclaws')).toBe(true)
      expect(stateBus.hasState('venom')).toBe(true)
      expect(stateBus.hasState(31)).toBe(true)
      expect(statList.getAccruedStat('skill_pois_max')).toBeGreaterThan(25 * FIXED_ONE)

      // 3. Combat pipeline clamps long item poison duration (e.g. 250 frames) to 10 frames while preserving per-frame bitrate
      statList.setBaseStat('poisonmindam', 10 * FIXED_ONE)
      statList.setBaseStat('poisonmaxdam', 10 * FIXED_ONE)
      statList.setBaseStat('poisonlength', 250)

      const defStats = new UnitStatList(registry, {
        level: 1,
        maxhp: 5000 * FIXED_ONE,
        hitpoints: 5000 * FIXED_ONE,
      })
      const defStateBus = new StateBus(defStats, registry)
      const combatRes = executeSUnitDmg(
        {
          id: 'ass-1',
          name: 'Assassin',
          statList,
          stateBus,
          weaponItemType: 'h2h',
          weaponMinPhys: 10,
          weaponMaxPhys: 10,
        },
        {
          id: 'mob-1',
          name: 'Zombie',
          statList: defStats,
          stateBus: defStateBus,
        },
        {
          skillId: 0,
          attackKind: 'melee',
          srcDam: 128,
          autoHit: true,
          roll100: 50,
          rng: { rand: () => 50 },
        },
      )

      expect(combatRes.hit).toBe(true)
      expect(combatRes.elemDamage256).toBeGreaterThan(300 * FIXED_ONE)
      const poisonState = defStateBus.getState('poison')
      expect(poisonState).toBeDefined()
      expect(poisonState!.durationFrames).toBe(10)
    })

    it('enforces #263 Weapon Block dual-claw requirement, missile/spell blocking, and 0% block while walking/running', async () => {
      const registry = await getSharedDataRegistry()
      const statList = new UnitStatList(registry, { level: 30 })
      statList.setBaseSkillLevel(263, 10) // slvl 10 -> 50% Weapon Block
      const stateBus = new StateBus(statList, registry)

      const skill263 = registry.getSkillById(263)!
      const eval263 = evaluateSkillCore113c({
        registry,
        skill: skill263,
        slvl: 10,
        blvl: 10,
        statList,
        difficulty: 'normal',
      })
      executeSkillCore113c({
        registry,
        skill: skill263,
        evalResult: eval263,
        caster: {
          id: 'ass-wb',
          name: 'Assassin',
          statList,
          stateBus,
          isDualClaw: true,
        },
        targets: [],
        targetPositions: new Map(),
        corpses: [],
        missileEngine: new MissileEngine(registry),
        auraScanner: new AuraScanner(registry),
        summonManager: new SummonManager(registry),
        currentTick: 1,
        targetX: 100,
        targetY: 100,
        difficulty: 'normal',
      })

      // Unifies passive_weaponblock and weaponblock
      expect(statList.getAccruedStat('passive_weaponblock')).toBe(50)
      expect(statList.getAccruedStat('weaponblock')).toBe(50)

      // 1. Standing still with dual claws -> blocks melee, missile, and spell attacks (except ground fire)
      const baseDef: CombatUnitContext = {
        id: 'ass-wb',
        name: 'Assassin',
        statList,
        stateBus,
        isDualClaw: true,
        isMoving: false,
      }
      expect(
        evaluateAvoidanceAndBlock({
          defender: baseDef,
          attackKind: 'melee',
          roll100: 20, // 20 < 50 -> blocked
          rng: { rand: () => 20 },
        }),
      ).toEqual({ avoided: true, reason: 'weapon_block' })

      expect(
        evaluateAvoidanceAndBlock({
          defender: baseDef,
          attackKind: 'missile',
          roll100: 20,
          rng: { rand: () => 20 },
        }),
      ).toEqual({ avoided: true, reason: 'weapon_block' })

      expect(
        evaluateAvoidanceAndBlock({
          defender: baseDef,
          attackKind: 'spell',
          roll100: 20,
          rng: { rand: () => 20 },
        }),
      ).toEqual({ avoided: true, reason: 'weapon_block' })

      // Ground fire bypasses Weapon Block
      expect(
        evaluateAvoidanceAndBlock({
          defender: baseDef,
          attackKind: 'spell',
          isPersistentGroundFire: true,
          roll100: 20,
          rng: { rand: () => 20 },
        }).avoided,
      ).toBe(false)

      // 2. Single claw (not dual-wielding) -> cannot Weapon Block
      expect(
        evaluateAvoidanceAndBlock({
          defender: { ...baseDef, isDualClaw: false },
          attackKind: 'melee',
          roll100: 20,
          rng: { rand: () => 20 },
        }).avoided,
      ).toBe(false)

      // 3. Walking or running -> 0% Weapon Block
      expect(
        evaluateAvoidanceAndBlock({
          defender: { ...baseDef, isMoving: true },
          attackKind: 'melee',
          roll100: 1,
          rng: { rand: () => 1 },
        }).avoided,
      ).toBe(false)
    })

    it('applies #252 Claw Mastery AR%, ED%, and Critical Strike when wielding h2h/h2h2 claws', async () => {
      const registry = await getSharedDataRegistry()
      const statList = new UnitStatList(registry, {
        level: 30,
        strength: 100,
        dexterity: 100,
        tohit: 100,
      })
      statList.setBaseSkillLevel(252, 10) // Claw Mastery slvl 10
      const stateBus = new StateBus(statList, registry)

      const skill252 = registry.getSkillById(252)!
      const eval252 = evaluateSkillCore113c({
        registry,
        skill: skill252,
        slvl: 10,
        blvl: 10,
        statList,
        difficulty: 'normal',
      })
      executeSkillCore113c({
        registry,
        skill: skill252,
        evalResult: eval252,
        caster: {
          id: 'ass-cm',
          name: 'Assassin',
          statList,
          stateBus,
          weaponItemType: 'h2h',
        },
        targets: [],
        targetPositions: new Map(),
        corpses: [],
        missileEngine: new MissileEngine(registry),
        auraScanner: new AuraScanner(registry),
        summonManager: new SummonManager(registry),
        currentTick: 1,
        targetX: 100,
        targetY: 100,
        difficulty: 'normal',
      })

      expect(statList.getAccruedStat('passive_mastery_melee_th')).toBe(120) // 30 + 10*9 = 120%
      expect(statList.getAccruedStat('passive_mastery_melee_dmg')).toBe(71) // 35 + 4*9 = 71%
      expect(statList.getAccruedStat('passive_mastery_melee_crit')).toBeGreaterThan(0)
      expect(statList.getAccruedStat('passive_mastery_crit')).toBeGreaterThan(0)

      const defStats = new UnitStatList(registry, {
        level: 1,
        maxhp: 5000 * FIXED_ONE,
        hitpoints: 5000 * FIXED_ONE,
      })
      const defStateBus = new StateBus(defStats, registry)

      // Attack with claw ('h2h') and roll100=1 -> triggers mastery Critical Strike (2x physical damage)
      const clawHit = executeSUnitDmg(
        {
          id: 'ass-cm',
          name: 'Assassin',
          statList,
          stateBus,
          weaponItemType: 'h2h',
          weaponMinPhys: 20,
          weaponMaxPhys: 20,
        },
        {
          id: 'mob-1',
          name: 'Zombie',
          statList: defStats,
          stateBus: defStateBus,
        },
        {
          skillId: 0,
          attackKind: 'melee',
          srcDam: 128,
          autoHit: true,
          roll100: 1,
          masteryCritRoll100: 1,
          rng: { rand: () => 1 },
        },
      )

      expect(clawHit.isCritical).toBe(true)
    })

    it('applies HitShift=7 (1-3 phys + 1-3 magic at slvl 1) and tier-based knockback chance for #253 Psychic Hammer', async () => {
      const dmg1 = computePsychicHammerDamage(1)
      expect(dmg1.minPhys).toBe(1)
      expect(dmg1.maxPhys).toBe(3)
      expect(dmg1.minMagic).toBe(1)
      expect(dmg1.maxMagic).toBe(3)

      expect(computePsychicHammerKnockbackChance(1, 'normal')).toBe(100)
      const excChance = computePsychicHammerKnockbackChance(5, 'exceptional')
      const bossChance = computePsychicHammerKnockbackChance(5, 'boss')
      expect(excChance).toBeGreaterThanOrEqual(50)
      expect(excChance).toBeLessThanOrEqual(100)
      expect(bossChance).toBeGreaterThanOrEqual(25)
      expect(bossChance).toBeLessThan(excChance)

      const registry = await getSharedDataRegistry()
      const skill253 = registry.getSkillById(253)!
      const statList = new UnitStatList(registry, { level: 10 })
      const eval253 = evaluateSkillCore113c({
        registry,
        skill: skill253,
        slvl: 1,
        blvl: 1,
        statList,
        difficulty: 'normal',
      })
      expect(eval253.minPhysDmg).toBe(1)
      expect(eval253.maxPhysDmg).toBe(3)
      expect(eval253.minElemDmg).toBe(1)
      expect(eval253.maxElemDmg).toBe(3)
    })

    it('enforces #258 Burst of Speed duration (3000+300*(slvl-1)) and #264 Cloak of Shadows duration (200+25*(slvl-1)), 30-subtile radius, and normal-only blind', async () => {
      const registry = await getSharedDataRegistry()
      const statList = new UnitStatList(registry, {
        level: 30,
        maxmana: 200 * FIXED_ONE,
        mana: 200 * FIXED_ONE,
      })
      statList.setBaseSkillLevel(258, 5)
      statList.setBaseSkillLevel(264, 5)
      const stateBus = new StateBus(statList, registry)

      const caster: CombatUnitContext = {
        id: 'ass-cos',
        name: 'Assassin',
        charClass: 'assassin',
        statList,
        stateBus,
        unitType: 'player',
      }

      // #258 Burst of Speed at slvl 5: duration = 3000 + 300*4 = 4200 frames
      const skill258 = registry.getSkillById(258)!
      const eval258 = evaluateSkillCore113c({
        registry,
        skill: skill258,
        slvl: 5,
        blvl: 5,
        statList,
        difficulty: 'normal',
      })
      executeSkillCore113c({
        registry,
        skill: skill258,
        evalResult: eval258,
        caster,
        targets: [],
        targetPositions: new Map(),
        corpses: [],
        missileEngine: new MissileEngine(registry),
        auraScanner: new AuraScanner(registry),
        summonManager: new SummonManager(registry),
        currentTick: 1,
        targetX: 100,
        targetY: 100,
        difficulty: 'normal',
      })
      expect(stateBus.getState('quickness')?.durationFrames).toBe(4200)

      // #264 Cloak of Shadows at slvl 5: duration = 200 + 25*4 = 300 frames, radius = 30 subtiles
      const normalStats = new UnitStatList(registry, { level: 10 })
      const normalMob: CombatUnitContext = {
        id: 'mob-norm',
        name: 'Fallen',
        statList: normalStats,
        stateBus: new StateBus(normalStats, registry),
        unitType: 'monster',
      }
      const bossStats = new UnitStatList(registry, { level: 10 })
      const bossMob: CombatUnitContext = {
        id: 'mob-boss',
        name: 'Andariel',
        statList: bossStats,
        stateBus: new StateBus(bossStats, registry),
        unitType: 'monster',
        isBoss: true,
        rank: 'boss',
      }
      const farStats = new UnitStatList(registry, { level: 10 })
      const farMob: CombatUnitContext = {
        id: 'mob-far',
        name: 'OutOfRange',
        statList: farStats,
        stateBus: new StateBus(farStats, registry),
        unitType: 'monster',
      }

      const skill264 = registry.getSkillById(264)!
      const eval264 = evaluateSkillCore113c({
        registry,
        skill: skill264,
        slvl: 5,
        blvl: 5,
        statList,
        difficulty: 'normal',
      })
      executeSkillCore113c({
        registry,
        skill: skill264,
        evalResult: eval264,
        caster,
        targets: [normalMob, bossMob, farMob],
        targetPositions: new Map([
          ['ass-cos', { x: 100, y: 100 }],
          ['mob-norm', { x: 125, y: 100 }], // dist 25 <= 30
          ['mob-boss', { x: 120, y: 100 }], // dist 20 <= 30
          ['mob-far', { x: 135, y: 100 }], // dist 35 > 30
        ]),
        corpses: [],
        missileEngine: new MissileEngine(registry),
        auraScanner: new AuraScanner(registry),
        summonManager: new SummonManager(registry),
        currentTick: 2,
        targetX: 100,
        targetY: 100,
        difficulty: 'normal',
      })

      // Caster gets State 153 ('cloak_of_shadows', curse=0) for 300 frames with +22% Defense
      const casterCloak = stateBus.getState('cloak_of_shadows')
      expect(casterCloak).toBeDefined()
      expect(casterCloak!.stateId).toBe(153)
      expect(casterCloak!.curseType).toBe(0)
      expect(casterCloak!.durationFrames).toBe(300)
      expect(casterCloak!.stats.item_armor_percent).toBe(22)

      // Normal monster in 30 subtiles gets State 156 ('cloaked', curse=1) with -Defense% AND ai_blind=1
      const normCloak = normalMob.stateBus.getState('cloaked')
      expect(normCloak).toBeDefined()
      expect(normCloak!.stateId).toBe(156)
      expect(normCloak!.curseType).toBe(1)
      expect(normCloak!.durationFrames).toBe(300)
      expect(normCloak!.stats.item_armor_percent).toBe(-27)
      expect(normCloak!.stats.ai_blind).toBe(1)

      // Boss in 30 subtiles gets -Defense% WITHOUT ai_blind
      const bossCloak = bossMob.stateBus.getState('cloaked')
      expect(bossCloak).toBeDefined()
      expect(bossCloak!.stateId).toBe(156)
      expect(bossCloak!.stats.item_armor_percent).toBe(-27)
      expect(bossCloak!.stats.ai_blind).toBeUndefined()

      // Monster outside 30 subtiles is unaffected
      expect(farMob.stateBus.hasState('cloaked')).toBe(false)
    })

    it('implements #268 Shadow Warrior & #279 Shadow Master stats, mlvl, resistances, MonEquip gear, and AI skill casting in SummonManager', async () => {
      // 1. Shared 1.13c casting level formula: max(1, floor(shadowSlvl/3) + floor(ownerEffectiveSkillLvl/2))
      expect(getShadowMasterCastingLevel(9, 10)).toBe(8) // floor(9/3)=3 + floor(10/2)=5 = 8
      expect(getShadowMasterCastingLevel(1, 0)).toBe(1)

      // 2. HP & mlvl formulas
      expect(computeShadowMaxLife(10)).toBe(Math.floor((376 * (100 + 15 * 10)) / 100)) // 940
      expect(computeShadowMlvl(40, 5)).toBe(35) // min(40, 5 + floor(120/4)) = 35
      expect(computeShadowMlvl(20, 10)).toBe(20) // clamped to clvl=20

      // 3. MonEquip.txt magic/rare equipment generation scaling with slvl
      const swGear = generateShadowEquipment(268, 5)
      expect(swGear.find(g => g.slot === 'torso')?.quality).toBe('magic')
      expect(swGear.find(g => g.slot === 'rarm')?.quality).toBe('magic')
      const smGearHigh = generateShadowEquipment(279, 15)
      expect(smGearHigh.find(g => g.slot === 'torso')?.quality).toBe('rare')
      expect(smGearHigh.find(g => g.slot === 'head')?.quality).toBe('rare')
      expect(smGearHigh.find(g => g.slot === 'rarm')?.quality).toBe('rare')

      // 4. SummonManager.createPet & tickPets
      const registry = await getSharedDataRegistry()
      const summonManager = new SummonManager(registry)
      const auraScanner = new AuraScanner(registry)
      const missileEngine = new MissileEngine(registry)

      const ownerStats = new UnitStatList(registry, { level: 40 })
      ownerStats.setBaseSkillLevel(254, 10) // Tiger Strike
      ownerStats.setBaseSkillLevel(273, 8) // Mind Blast
      const owner: CombatUnitContext = {
        id: 'ass-summon',
        name: 'Assassin',
        statList: ownerStats,
        stateBus: new StateBus(ownerStats, registry),
      }

      // Create Shadow Warrior (#268) at slvl 10
      const swRes = summonManager.createPet({
        owner,
        skillId: 268,
        slvl: 10,
        x: 100,
        y: 100,
        difficulty: 'normal',
      })
      expect(swRes.created).toBe(true)
      const swPet = swRes.pet!
      expect(swPet.mlvl).toBe(40) // min(40, 10 + 30) = 40
      expect(swPet.statList.getAccruedStat('maxhp') >> 8).toBe(940)
      expect(swPet.statList.getAccruedStat('fireresist')).toBe(40) // min(75, 4*10) = 40%
      expect(swPet.shadowEquipment).toBeDefined()
      expect(swPet.shadowSkills?.get(254)).toBe(8) // floor(10/3)=3 + floor(10/2)=5 = 8

      // Summoning Shadow Master (#279) replaces Shadow Warrior (shared petType 16, max 1)
      const smRes = summonManager.createPet({
        owner,
        skillId: 279,
        slvl: 12,
        x: 100,
        y: 100,
        difficulty: 'normal',
      })
      expect(smRes.created).toBe(true)
      expect(smRes.evictedPetUids.length).toBe(1)
      const smPet = smRes.pet!
      // Shadow Master resistance uses dm34(5, 90) -> 60% at slvl 12
      expect(smPet.statList.getAccruedStat('fireresist')).toBeGreaterThanOrEqual(55)
      expect(smPet.statList.getAccruedStat('fireresist')).toBeLessThanOrEqual(90)
      expect(smPet.shadowEquipment?.some(g => g.slot === 'torso' && g.quality === 'rare')).toBe(true)

      // tickPets lets Shadow Master cast its shadowSkills against nearby enemies
      const mobStats = new UnitStatList(registry, {
        level: 10,
        maxhp: 1000 * FIXED_ONE,
        hitpoints: 1000 * FIXED_ONE,
      })
      const mob: CombatUnitContext = {
        id: 'mob-target',
        name: 'Zombie',
        statList: mobStats,
        stateBus: new StateBus(mobStats, registry),
      }
      const tickRes = summonManager.tickPets({
        currentTick: 25,
        owner,
        enemies: [mob],
        enemyPositions: new Map([['mob-target', { x: 105, y: 100 }]]),
        corpses: [],
        missileEngine,
        auraScanner,
      })
      expect(tickRes.subSkillsExecuted.length).toBeGreaterThan(0)
    })
  })

  describe('Layer 3: Authoritative Server Execution across Active Shadow Disciplines Skills (WorldArena & skill-caster.ts)', () => {
    it('executes all 8 active Shadow Disciplines skills (#253, #258, #264, #267, #268, #273, #278, #279) in WorldArena', async () => {
      const registry = await getSharedDataRegistry()
      for (const skillId of [253, 258, 264, 267, 268, 273, 278, 279]) {
        const arena = new WorldArena({
          registry,
          classCode: 'ass',
          skillId,
          slvl: 10,
        })
        const outcome = arena.triggerCast()
        arena.stepTicks(15)
        const dbg = arena.getDebugState()
        expect(dbg.skillId).toBe(skillId)
        expect(outcome?.executed).toBe(true)
      }
    })
  })

  describe('Layer 4: Client World Overlays, States & Radius (world-skill-missiles.ts)', () => {
    it('applies exact 1.13c states and overlays for #258 Burst of Speed, #267 Fade, #278 Venom, #264 Cloak of Shadows, and #273 Mind Blast', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 6, name: 'Assassin', x: 100, y: 100 })
      const selfUnit = world.getUnit('player', 1)!
      expect(selfUnit).toBeDefined()

      // Spawn two hostile monsters: one within 4 sub-tiles (dist=3), one at dist=25 (within 30 for CoS, outside 4 for Mind Blast)
      world.apply({
        type: 'UnitAssign',
        isSelf: false,
        unit: {
          unitType: 'monster',
          id: 101,
          classId: 1, // Fallen
          name: 'CloseFallen',
          x: 103,
          y: 100,
          lifePct: 128,
          mode: 1,
        },
      } as any)
      world.apply({
        type: 'UnitAssign',
        isSelf: false,
        unit: {
          unitType: 'monster',
          id: 102,
          classId: 1,
          name: 'MidFallen',
          x: 125,
          y: 100,
          lifePct: 128,
          mode: 1,
        },
      } as any)
      const closeMob = world.getUnit('monster', 101)!
      const midMob = world.getUnit('monster', 102)!
      expect(closeMob).toBeDefined()
      expect(midMob).toBeDefined()

      // 1. #258 Burst of Speed: State 157 + one-shot 'quickness' overlay (loop: false)
      ;(world as any).applySkillCastToUnit(selfUnit, 258, 100, 100, 5)
      expect(selfUnit.states.has(157)).toBe(true)
      const quickOverlay = selfUnit.overlays.find(o => o.token === 'quickness')
      expect(quickOverlay).toBeDefined()
      expect(quickOverlay!.loop).toBe(false)

      // 2. #267 Fade: removes State 157, adds State 159 (State 159 draws 'fade' via STATE_OVERLAYS[159])
      ;(world as any).applySkillCastToUnit(selfUnit, 267, 100, 100, 5)
      expect(selfUnit.states.has(157)).toBe(false)
      expect(selfUnit.states.has(159)).toBe(true)
      expect(selfUnit.overlays.some(o => o.token === 'fade')).toBe(false)

      // 3. #278 Venom: adds State 31 ('venomclaws') only, never adds bogus State 178 ('antidote')
      ;(world as any).applySkillCastToUnit(selfUnit, 278, 100, 100, 5)
      expect(selfUnit.states.has(31)).toBe(true)
      expect(selfUnit.states.has(178)).toBe(false)

      // 4. #264 Cloak of Shadows: caster gets State 153 ('cloak_of_shadows', no 'cloaked' overlay), monsters in 30 sub-tiles get State 156 ('cloaked', no 'blindaura')
      ;(world as any).applySkillCastToUnit(selfUnit, 264, 100, 100, 5)
      expect(selfUnit.states.has(153)).toBe(true)
      expect(selfUnit.overlays.some(o => o.token === 'cloaked')).toBe(false)
      expect(closeMob.states.has(156)).toBe(true)
      expect(midMob.states.has(156)).toBe(true)
      expect(midMob.overlays.some(o => o.token === 'blindaura')).toBe(false)

      // 5. #273 Mind Blast: radius = 4 sub-tiles, attaches tgtoverlay 'fist_will_cast' + 'stun' + State 21 ('stunned'), no bogus 'mindblast_hit'
      ;(world as any).spawnMissilesForSkill(selfUnit, 273, 100, 100, 5)
      expect(selfUnit.overlays.some(o => o.token === 'fist_will_cast')).toBe(false)
      expect(closeMob.overlays.some(o => o.token === 'fist_will_cast')).toBe(true)
      expect(closeMob.overlays.some(o => o.token === 'mindblast_hit')).toBe(false)
      expect(closeMob.overlays.some(o => o.token === 'stun')).toBe(true)
      expect(closeMob.states.has(21)).toBe(true)
      // midMob at dist 25 (> 4 sub-tiles) is not hit by Mind Blast
      expect(midMob.overlays.some(o => o.token === 'fist_will_cast')).toBe(false)
      expect(midMob.overlays.some(o => o.token === 'mindblast_hit')).toBe(false)
      expect(midMob.states.has(21)).toBe(false)
    })
  })
})
