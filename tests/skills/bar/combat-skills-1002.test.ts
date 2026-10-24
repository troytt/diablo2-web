import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { computeCombatStats } from '../../../src/client/ui-model/combat-stats.ts'
import { aggregateUnit, itemCodeIsA } from '../../../src/client/ui-model/stat-engine.ts'
import { StatList } from '../../../src/client/world/stat-list.ts'
import { spawnMissilesForSkillImpl } from '../../../src/client/world/world-skill-missiles.ts'
import { SKILLS_BY_ID } from '../../../src/common/data/skills-catalog.ts'
import { getSkillManaCost } from '../../../src/common/skills/missiles-data.ts'
import { FIXED_ONE, UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import {
  calculateBashStats,
  calculateBerserkStats,
  calculateConcentrateStats,
  calculateDoubleSwingStats,
  calculateDoubleThrowStats,
  calculateFrenzyStackState,
  calculateFrenzyStats,
  calculateLeapAttackStats,
  calculateLeapStats,
  calculateStunStats,
  calculateWhirlwindHitFrames,
  calculateWhirlwindStats,
  validateBarbarianLeapDestination,
  validateBarbarianSkillEquipment,
} from '../../../src/server/skills/barbarian-combat.ts'
import { evaluateSkillCore113c, executeSkillCore113c } from '../../../src/server/skills/registry.ts'

describe('Issue #1002: Barbarian Combat Skills (#126-#152) 4-Layer 1.13c Fidelity', () => {
  describe('Layer 1: Client Stat Engine, Combat Stats & Skills Catalog', () => {
    it('populates canonical synergy metadata in SKILLS_BY_ID for #126-#152', () => {
      expect(SKILLS_BY_ID[126]?.synergiesReceived?.map(s => s.providerId)).toEqual([139, 144])
      expect(SKILLS_BY_ID[132]?.synergiesGiven?.map(s => s.targetId)).toContain(143)
      expect(SKILLS_BY_ID[133]?.synergiesReceived?.map(s => s.providerId)).toEqual([126])
      expect(SKILLS_BY_ID[139]?.synergiesReceived?.map(s => s.providerId)).toEqual([126, 144, 154])
      expect(SKILLS_BY_ID[140]?.synergiesReceived?.map(s => s.providerId)).toEqual([133])
      expect(SKILLS_BY_ID[143]?.synergiesReceived?.map(s => s.providerId)).toEqual([132])
      expect(SKILLS_BY_ID[144]?.synergiesReceived?.map(s => s.providerId)).toEqual([126, 149, 145, 152])
      expect(SKILLS_BY_ID[147]?.synergiesReceived?.map(s => s.providerId)).toEqual([133, 137, 141, 152])
      expect(SKILLS_BY_ID[152]?.synergiesReceived?.map(s => s.providerId)).toEqual([130, 138])
    })

    it('converts 100% physical damage to magic damage for #152 Berserk in computeCombatStats', () => {
      const swordArm = {
        weapon: {
          code: 'lsd',
          minDam: 20,
          maxDam: 40,
          twoHandMinDam: 0,
          twoHandMaxDam: 0,
          minMisDam: 0,
          maxMisDam: 0,
          strBonus: 100,
          dexBonus: 0,
          twoHanded: false,
          oneOrTwoHanded: false,
          throwable: false,
          weaponClass: '1hs',
        },
        component: 5,
        ethereal: false,
        canBeEquipped: true,
        isType: (tc: string) => itemCodeIsA('lsd', tc),
        localRaw: () => 0,
      }
      const berserkSkill = {
        id: 152,
        level: 5,
        weapSel: 0,
        kick: false,
        srcDam: 128,
        itypeA1: 'mele',
        itypeA1IsThrown: false,
        range: 'h2h' as const,
        toHitPercent: 160,
        damagePercent: 210,
        skillPhysical256: { min: 0, max: 0 },
        spellDamage: null,
        magicConversionPct: 100,
      }
      const out = computeCombatStats({
        charClass: 'bar',
        clvl: 30,
        toHitFactor: 20,
        strength: 100,
        dexterity: 80,
        dexterityWithoutStates: 80,
        lists: [],
        rightArm: swordArm as any,
        leftArm: null,
        primaryArm: 'right',
        boots: null,
        masteries: [],
        isDamageRelated: () => false,
        hasStateColorFlag: () => false,
        leftSkill: berserkSkill,
        rightSkill: berserkSkill,
      })
      expect(out.left.damage.physMin).toBe(0)
      expect(out.left.damage.physMax).toBe(0)
      expect(out.left.damage.magicMin).toBeGreaterThan(20)
      expect(out.left.damage.magicMax).toBeGreaterThan(40)
    })

    it('zeros total defense (stat 31) when Berserk state 95 is active in aggregateUnit', () => {
      const stats = new StatList()
      stats.set(12, 30)
      stats.set(31, 500) // base defense
      stats.set(2, 100) // dex
      const emptyContainers = {
        equipmentBySlot: new Map(),
        mercBySlot: new Map(),
        inventory: new Map(),
        socketedByHost: new Map(),
        byId: new Map(),
      } as any
      const hardLevels = new Map<number, number>([[152, 5]])

      const normal = aggregateUnit({
        kind: 'player',
        classId: 4,
        level: 30,
        stats,
        containers: emptyContainers,
        activeStates: new Set(),
        hardSkillLevels: hardLevels,
      })
      expect(normal.total(31, 0)).toBeGreaterThan(0)

      const berserk = aggregateUnit({
        kind: 'player',
        classId: 4,
        level: 30,
        stats,
        containers: emptyContainers,
        activeStates: new Set([95]),
        hardSkillLevels: hardLevels,
      })
      expect(berserk.total(31, 0)).toBe(0)
    })

    it('computes exact mana costs via getSkillManaCost for #126-#152', () => {
      expect(getSkillManaCost(126, 1)).toBe(2)
      expect(getSkillManaCost(132, 1)).toBe(2)
      expect(getSkillManaCost(133, 1)).toBe(1) // (8*32)/256 = 1
      expect(getSkillManaCost(133, 9)).toBe(0) // reaches 0 at slvl 9
      expect(getSkillManaCost(139, 1)).toBe(2)
      expect(getSkillManaCost(140, 1)).toBe(1)
      expect(getSkillManaCost(143, 1)).toBe(9)
      expect(getSkillManaCost(144, 1)).toBe(2)
      expect(getSkillManaCost(147, 1)).toBe(1.5)
      expect(getSkillManaCost(151, 1)).toBe(12.5)
      expect(getSkillManaCost(152, 1)).toBe(4)
    })
  })

  describe('Layer 2: Server Skill Formula Calculators & Equipment/Leap Validators', () => {
    it('calculates #126 Bash with +5%/blvl Stun ED and +5%/blvl Concentrate AR', () => {
      const stats = calculateBashStats(5, 10, 8)
      expect(stats.damageBonusPct).toBe(50 + 4 * 5 + 10 * 5) // 120%
      expect(stats.flatPhysicalMin).toBe(1 + 4 * 1) // +5
      expect(stats.flatPhysicalMax).toBe(1 + 4 * 1) // +5
      expect(stats.toHitBonusPct).toBe(20 + 4 * 5 + 8 * 5) // 80%
      expect(stats.knockbackChancePct).toBe(100)
    })

    it('calculates #132 Leap knockback radius and diminishing-returns jump distance', () => {
      const s1 = calculateLeapStats(1)
      const s10 = calculateLeapStats(10)
      expect(s1.knockbackRadiusSubtiles).toBe(4)
      expect(s10.knockbackRadiusSubtiles).toBe(13)
      expect(s1.leapDistanceSubtiles).toBeGreaterThanOrEqual(4)
      expect(s10.leapDistanceSubtiles).toBeGreaterThan(s1.leapDistanceSubtiles)
    })

    it('calculates #133 Double Swing mana cost reaching 0 at slvl 9 and +10%/blvl Bash ED', () => {
      expect(calculateDoubleSwingStats(1, 0).manaCost256).toBe(256)
      expect(calculateDoubleSwingStats(9, 5).manaCost256).toBe(0)
      expect(calculateDoubleSwingStats(9, 5).damageBonusPct).toBe(50)
    })

    it('calculates #139 Stun 3-band piecewise duration capped at 250 frames', () => {
      const s1 = calculateStunStats(1, 0, 0, 0)
      expect(s1.stunDurationFrames).toBe(30) // 1.2s
      const s10 = calculateStunStats(10, 5, 4, 6)
      // Base @ slvl 10 = 30 + 7*5 + 2*5 = 75; * (1 + 20/100) = 90
      expect(s10.stunDurationFrames).toBe(90)
      expect(s10.damageBonusPct).toBe(40)
      expect(s10.toHitBonusPct).toBe(15 + 9 * 5 + 30)
      const sMax = calculateStunStats(30, 0, 20, 0)
      expect(sMax.stunDurationFrames).toBe(250)
    })

    it('calculates #140 Double Throw with +8%/blvl Double Swing ED', () => {
      const s = calculateDoubleThrowStats(5, 10)
      expect(s.damageBonusPct).toBe(80)
      expect(s.toHitBonusPct).toBe(20 + 4 * 10)
      expect(s.manaCost256).toBe(256)
    })

    it('calculates #143 Leap Attack and allows in-melee-range fallback strike', () => {
      const s = calculateLeapAttackStats(5, 10)
      expect(s.damageBonusPct).toBe(100 + 4 * 30 + 10 * 10)
      const check = validateBarbarianLeapDestination(143, {
        isInMeleeRange: true,
      })
      expect(check.valid).toBe(true)
      expect(check.meleeFallback).toBe(true)
    })

    it('calculates #144 Concentrate with Bash/BO/Berserk synergies', () => {
      const s = calculateConcentrateStats(5, 10, 8, 5)
      expect(s.damageBonusPct).toBe(70 + 4 * 5 + 10 * 5 + 8 * 10)
      expect(s.magicConversionPct).toBe(5)
      expect(s.isUninterruptible).toBe(true)
    })

    it('calculates #147 Frenzy per-hit stack scaling dm(0,50,nValue) IAS and dm(20,200,nValue) FRW', () => {
      const s = calculateFrenzyStats(10, 5, 5, 2)
      expect(s.damageBonusPct).toBe(90 + 9 * 5 + 40 + 40)
      expect(s.magicConversionPct).toBe(2)
      const st1 = calculateFrenzyStackState(0, 1, 10, 0, 10)
      const st2 = calculateFrenzyStackState(st1.activeStacks, 1, 10, 10, 20)
      expect(st1.activeStacks).toBe(1)
      expect(st2.activeStacks).toBe(2)
      expect(st2.currentAttackSpeedBonusPct).toBeGreaterThan(st1.currentAttackSpeedBonusPct)
      expect(st2.currentRunSpeedBonusPct).toBeGreaterThan(st1.currentRunSpeedBonusPct)
    })

    it('calculates #151 Whirlwind 1H/2H Sword vs 2H Non-Sword breakpoints and frame 0+4 initial checks', () => {
      const s1 = calculateWhirlwindStats(1)
      expect(s1.damageBonusPct).toBe(-50)
      const fFast = calculateWhirlwindHitFrames(12, 34, 0, false, false)
      expect(fFast.hitInterval).toBe(4)
      expect(fFast.hitFrames).toEqual([0, 4, 8, 12])
      const f2hNonSword = calculateWhirlwindHitFrames(12, 34, 0, false, true)
      expect(f2hNonSword.hitInterval).toBe(8)
      expect(f2hNonSword.hitFrames).toEqual([0, 4, 12])
    })

    it('calculates #152 Berserk 100% magic conversion and defense zeroing duration', () => {
      const s = calculateBerserkStats(5, 10, 10)
      expect(s.damageBonusPct).toBe(150 + 4 * 15 + 100 + 100)
      expect(s.magicConversionPct).toBe(100)
      expect(s.zeroDefenseDurationFrames).toBeGreaterThanOrEqual(25)
    })

    it('validates dual-wield and throwing equipment constraints for #133, #140, #147', () => {
      expect(
        validateBarbarianSkillEquipment(133, {
          hasDualWield: false,
        }).valid,
      ).toBe(false)
      expect(
        validateBarbarianSkillEquipment(140, {
          hasDualThrow: false,
        }).valid,
      ).toBe(false)
    })
  })

  describe('Layer 3: Server Core Registry Execution & Combat Pipeline', () => {
    it('evaluates and executes #126 Bash, #139 Stun, #140 Double Throw, #147 Frenzy, #151 Whirlwind, and #152 Berserk', async () => {
      const registry = await getSharedDataRegistry()
      const casterStats = new UnitStatList()
      casterStats.setBaseStat('level', 80)
      casterStats.setBaseStat('tohit', 10000)
      casterStats.setBaseStat('mana', 500 * FIXED_ONE)
      casterStats.setBaseStat('maxmana', 500 * FIXED_ONE)
      casterStats.setBaseStat('mindamage', 10)
      casterStats.setBaseStat('maxdamage', 20)
      const caster = {
        id: 'bar-caster',
        name: 'bar-caster',
        unitType: 'player' as const,
        charClass: 'bar' as const,
        x: 100,
        y: 100,
        statList: casterStats,
        stateBus: new StateBus(casterStats, registry),
        weaponMinPhys: 20,
        weaponMaxPhys: 40,
      }
      const monStats = new UnitStatList()
      monStats.setBaseStat('level', 10)
      monStats.setBaseStat('armorclass', 10)
      monStats.setBaseStat('hitpoints', 20000 * FIXED_ONE)
      monStats.setBaseStat('maxhp', 20000 * FIXED_ONE)
      const mon = {
        id: 'mon-1',
        name: 'mon-1',
        unitType: 'monster' as const,
        x: 102,
        y: 100,
        statList: monStats,
        stateBus: new StateBus(monStats, registry),
      }

      // 1. #126 Bash: flat physical damage bonus (ln34 = +5 at slvl 5) + melee hit
      const bashSkill = registry.getSkillById(126)!
      const bashEval = evaluateSkillCore113c({
        registry,
        skill: bashSkill,
        slvl: 5,
        blvl: 5,
        statList: casterStats,
      })
      expect(bashEval.minPhysDmg).toBe(5)
      const bashOut = executeSkillCore113c({
        registry,
        skill: bashSkill,
        evalResult: bashEval,
        caster,
        targets: [mon],
        corpses: [],
        targetX: 102,
        targetY: 100,
      } as any)
      expect(bashOut.totalDamageDealt).toBeGreaterThan(0)
      expect(bashOut.notes).toContain('melee_hits:1')

      // 2. #139 Stun: 250f cap with War Cry synergy
      casterStats.setBaseSkillLevel(154, 20)
      const stunSkill = registry.getSkillById(139)!
      const stunEval = evaluateSkillCore113c({
        registry,
        skill: stunSkill,
        slvl: 30,
        blvl: 20,
        statList: casterStats,
      })
      expect(stunEval.durationFrames).toBe(250)

      // 3. #140 Double Throw: Throwing Mastery (#135) + dual missiles
      casterStats.setBaseSkillLevel(135, 10)
      const dtSkill = registry.getSkillById(140)!
      const dtEval = evaluateSkillCore113c({
        registry,
        skill: dtSkill,
        slvl: 5,
        blvl: 5,
        statList: casterStats,
      })
      const dtOut = executeSkillCore113c({
        registry,
        skill: dtSkill,
        evalResult: dtEval,
        caster,
        targets: [mon],
        corpses: [],
        targetX: 110,
        targetY: 100,
      } as any)
      expect(dtOut.missilesSpawned.length).toBe(2)

      // 4. #147 Frenzy: incremental stack counter nValue on each connecting hit
      const frenzySkill = registry.getSkillById(147)!
      const frenzyEval = evaluateSkillCore113c({
        registry,
        skill: frenzySkill,
        slvl: 5,
        blvl: 5,
        statList: casterStats,
      })
      executeSkillCore113c({
        registry,
        skill: frenzySkill,
        evalResult: frenzyEval,
        caster,
        targets: [mon],
        corpses: [],
        targetX: 102,
        targetY: 100,
      } as any)
      expect(caster.stateBus.getState('frenzy')?.stats?.frenzy_stacks).toBeGreaterThanOrEqual(2)

      // 5. #151 Whirlwind: suppress_ctc + frame-breakpoint hit count
      const wwSkill = registry.getSkillById(151)!
      const wwEval = evaluateSkillCore113c({
        registry,
        skill: wwSkill,
        slvl: 5,
        blvl: 5,
        statList: casterStats,
      })
      const wwOut = executeSkillCore113c({
        registry,
        skill: wwSkill,
        evalResult: wwEval,
        caster,
        targets: [mon],
        corpses: [],
        targetX: 108,
        targetY: 100,
      } as any)
      expect(wwOut.notes).toContain('suppress_ctc')
      expect(wwOut.statesApplied).toContain('whirlwind')

      // 6. #152 Berserk: 100% magic conversion + state berserk with armor_override_percent = -100
      const zerkSkill = registry.getSkillById(152)!
      const zerkEval = evaluateSkillCore113c({
        registry,
        skill: zerkSkill,
        slvl: 5,
        blvl: 5,
        statList: casterStats,
      })
      const zerkOut = executeSkillCore113c({
        registry,
        skill: zerkSkill,
        evalResult: zerkEval,
        caster,
        targets: [mon],
        corpses: [],
        targetX: 102,
        targetY: 100,
      } as any)
      expect(zerkOut.statesApplied).toContain('berserk')
      expect(caster.stateBus.getState('berserk')?.stats?.armor_override_percent).toBe(-100)
    })
  })

  describe('Layer 4: Client World Visuals, Overlays & States', () => {
    it('attaches canonical overlays (bash, stun, dust, frenzy, whirlwind, berserkfront/back) and states', () => {
      const attachedOverlays: Array<{ target: any; key: string }> = []
      const monsterUnit = {
        unitType: 'monster',
        id: 201,
        x: 102,
        y: 100,
        dead: false,
        states: new Set<number>(),
      }
      const casterUnit = {
        unitType: 'player',
        id: 1,
        x: 100,
        y: 100,
        dead: false,
        states: new Set<number>(),
      }
      const mockClientWorld: any = {
        selfId: 1,
        _self: { states: new Set<number>() },
        _units: new Map([[1, casterUnit], [201, monsterUnit]]),
        _monsters: new Map([[201, monsterUnit]]),
        getUnit: () => casterUnit,
        spawnMissileByKey: () => ({ vx: 0, vy: 0 }),
        attachUnitOverlay: (target: any, key: string) => {
          attachedOverlays.push({ target, key })
        },
        ensureUnit: () => ({ states: new Set<number>() }),
        isFriendlyOrNonHostileMonster: (m: any) => m.unitType !== 'monster' || m.dead === true,
      }

      // #126 Bash -> no target overlay ('bash' belongs to #143 Leap Attack srvoverlay)
      spawnMissilesForSkillImpl.call(mockClientWorld, casterUnit as any, 126, 102, 100, 1)
      expect(attachedOverlays.some(o => o.target === monsterUnit && o.key === 'bash')).toBe(false)

      // #139 Stun -> state 21 on target monster (STATE_OVERLAYS[21] renders 'stun', no duplicate attachUnitOverlay)
      spawnMissilesForSkillImpl.call(mockClientWorld, casterUnit as any, 139, 102, 100, 1)
      expect(monsterUnit.states.has(21)).toBe(true)
      expect(attachedOverlays.some(o => o.target === monsterUnit && o.key === 'stun')).toBe(false)

      // #132 Leap -> attaches 'dust' on caster; displacement & knockback are server-authoritative (Issue #1167),
      // so the client never teleports the caster or pushes nearby monsters.
      const prevCasterX = casterUnit.x
      const prevMonX = monsterUnit.x
      spawnMissilesForSkillImpl.call(mockClientWorld, casterUnit as any, 132, 101, 100, 1)
      expect(casterUnit.x).toBe(prevCasterX)
      expect(attachedOverlays.some(o => o.target === casterUnit && o.key === 'dust')).toBe(true)
      expect(monsterUnit.x).toBe(prevMonX)

      // #144 Concentrate -> state 15 on caster + srvoverlay 'doubledamage1' on target monster
      spawnMissilesForSkillImpl.call(mockClientWorld, casterUnit as any, 144, monsterUnit.x, monsterUnit.y, 1)
      expect(casterUnit.states.has(15)).toBe(true)
      expect(attachedOverlays.some(o => o.target === monsterUnit && o.key === 'doubledamage1')).toBe(true)

      // #147 Frenzy -> state 94 + 'frenzy' overlay
      spawnMissilesForSkillImpl.call(mockClientWorld, casterUnit as any, 147, 102, 100, 1)
      expect(casterUnit.states.has(94)).toBe(true)
      expect(attachedOverlays.some(o => o.target === casterUnit && o.key === 'frenzy')).toBe(true)

      // #151 Whirlwind -> state 174 + 'whirlwind' overlay
      spawnMissilesForSkillImpl.call(mockClientWorld, casterUnit as any, 151, 105, 100, 1)
      expect(casterUnit.states.has(174)).toBe(true)
      expect(attachedOverlays.some(o => o.target === casterUnit && o.key === 'whirlwind')).toBe(true)

      // #152 Berserk -> state 95 + 'berserkfront' & 'berserkback' overlays
      spawnMissilesForSkillImpl.call(mockClientWorld, casterUnit as any, 152, 102, 100, 1)
      expect(casterUnit.states.has(95)).toBe(true)
      expect(attachedOverlays.some(o => o.target === casterUnit && o.key === 'berserkfront')).toBe(true)
      expect(attachedOverlays.some(o => o.target === casterUnit && o.key === 'berserkback')).toBe(true)
    })
  })
})
