import { describe, expect, it } from 'vitest'
import { SKILLS_BY_ID } from '../src/common/data/skills-catalog.ts'
import { buildTooltipViewModel, createInitialState } from '../src/common/skills/skill-calc-engine.ts'
import { getMissileTxtData } from '../src/common/skills/missiles-data.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import {
  calculateWerewolfStats,
  calculateWerebearStats,
  calculateFeralRageStats,
  calculateMaulStats,
  calculateRabiesStats,
  calculateFireClawsStats,
  calculateHungerStats,
  calculateShockWaveStats,
  calculateFuryStats,
  canCastDruidSkill,
  simulateRabiesContagion,
} from '../src/server/skills/druid-shapeshift.ts'
import { evaluateSkillCore113c, executeSkillCore113c } from '../src/server/skills/registry.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'
import { AnimDispatcher } from '../src/server/engine/anim-dispatcher.ts'
import { MissileEngine } from '../src/server/engine/missile-engine.ts'
import type { CombatUnitContext } from '../src/server/engine/combat-pipeline.ts'

describe('Issue #1018: Druid Shape Shifting (#223-#248) 4-Layer 1.13c Fidelity', () => {
  describe('Layer 1: Skill Catalog & Tooltip Calc Engine (skills-catalog.ts & skill-calc-engine.ts)', () => {
    it('aligns all 10 Druid Shape Shifting Chinese names and descriptions (no misaligned names)', () => {
      const expectedNames: Record<number, string> = {
        223: '狼人变化',
        224: '变形术',
        228: '熊人变化',
        232: '野性狂暴',
        233: '撞击',
        238: '狂犬病',
        239: '焰爪',
        242: '饥饿',
        243: '震波',
        248: '狂怒',
      }
      for (const [idStr, nameZh] of Object.entries(expectedNames)) {
        const skill = SKILLS_BY_ID[Number(idStr)]
        expect(skill).toBeDefined()
        expect(skill!.nameZh).toBe(nameZh)
      }

      // Verify cross-tree synergy targetNameZh alignment
      const creeperSyn = SKILLS_BY_ID[222]!.synergiesGiven?.find(s => s.targetId === 238)
      expect(creeperSyn?.targetNameZh).toBe('狂犬病')
      for (const fireSkillId of [225, 229, 234, 244]) {
        const fcSyn = SKILLS_BY_ID[fireSkillId]!.synergiesGiven?.find(s => s.targetId === 239)
        expect(fcSyn?.targetNameZh).toBe('焰爪')
      }
    })

    it('computes 1.13c tooltip lines for Werewolf (#223), Lycanthropy (#224), and Werebear (#228)', () => {
      const state = createInitialState('dru')
      state.hardPoints = { 223: 5, 224: 5, 228: 5 }

      const wolfVm = buildTooltipViewModel(state, 223)!
      const wolfLines = wolfVm.current.effects.map(e => e.textEn)
      expect(wolfLines.some(l => l.includes('25%'))).toBe(true)
      // Duration: 40s base + (40 + 4*20) = 160s
      expect(wolfLines.some(l => l.includes('160'))).toBe(true)

      // Lycanthropy (#224): lt === 57 converts frames to seconds (+40 + (slvl-1)*20s = +120s)
      const lycVm = buildTooltipViewModel(state, 224)!
      const lycLines = lycVm.current.effects.map(e => e.textEn)
      expect(lycLines.some(l => l.includes('+120 seconds'))).toBe(true)
      expect(lycLines.some(l => l.includes('40%'))).toBe(true)

      // Werebear (#228): par1=50 (+50% + 8%/lvl = +82% damage), par5=50 (+50% base + 40% Lycanthropy = +90% life)
      const bearVm = buildTooltipViewModel(state, 228)!
      const bearLines = bearVm.current.effects.map(e => e.textEn)
      expect(bearLines.some(l => l.includes('90%'))).toBe(true)
      expect(bearLines.some(l => l.includes('82%'))).toBe(true)
      expect(bearLines.some(l => l.includes('49%'))).toBe(true)
    })

    it('computes progressive charge ranges (lt=52) for Feral Rage (#232) and Maul (#233)', () => {
      const state = createInitialState('dru')
      state.hardPoints = { 232: 1, 233: 1 }

      const frVm = buildTooltipViewModel(state, 232)!
      const frLines = frVm.current.effects.map(e => e.textEn)
      // At slvl=1 (maxCharges=3): Life steal +4-12%, Walk/Run speed +19-32%
      expect(frLines.some(l => l.includes('+4-12%'))).toBe(true)
      expect(frLines.some(l => l.includes('+19-32%'))).toBe(true)
      expect(frLines.some(l => l.includes('20'))).toBe(true)

      const maulVm = buildTooltipViewModel(state, 233)!
      const maulLines = maulVm.current.effects.map(e => e.textEn)
      // At slvl=1 (maxCharges=3): Damage +20-60%
      expect(maulLines.some(l => l.includes('+20-60%'))).toBe(true)

      // At slvl=2 (maxCharges=4): Life steal +4-16%, Walk/Run speed +19-36%, Maul Damage +20-80%
      state.hardPoints = { 232: 2, 233: 2 }
      const frVm2 = buildTooltipViewModel(state, 232)!
      const frLines2 = frVm2.current.effects.map(e => e.textEn)
      expect(frLines2.some(l => l.includes('+4-16%'))).toBe(true)
      expect(frLines2.some(l => l.includes('+19-36%'))).toBe(true)

      const maulVm2 = buildTooltipViewModel(state, 233)!
      const maulLines2 = maulVm2.current.effects.map(e => e.textEn)
      expect(maulLines2.some(l => l.includes('+20-80%'))).toBe(true)
    })

    it('computes Shock Wave (#243) 10.0s stun cap (lt=12) and Fury (#248) hit count (lt=7)', () => {
      const state = createInitialState('dru')
      state.hardPoints = { 233: 10, 243: 20, 248: 1 }

      const swVm = buildTooltipViewModel(state, 243)!
      const swLines = swVm.current.effects.map(e => e.textEn)
      expect(swLines.some(l => l.includes('10 seconds'))).toBe(true)

      const furyLvl1Vm = buildTooltipViewModel(state, 248)!
      expect(furyLvl1Vm.current.effects.some(e => e.textEn.includes('2 hits'))).toBe(true)

      state.hardPoints[248] = 5
      const furyLvl5Vm = buildTooltipViewModel(state, 248)!
      expect(furyLvl5Vm.current.effects.some(e => e.textEn.includes('5 hits'))).toBe(true)
    })
  })

  describe('Layer 2: Character Panel C & HUD World Sync (stat-engine.ts & hud-world-sync.ts)', () => {
    it('applies Werewolf (139), Werebear (140), Feral Rage (120), and Maul (117) state bonuses and active skills in HudModel', () => {
      const world = new ClientWorld()
      world.selfId = 1
      world.areaId = 1
      ;(world.self as any).charClass = 5 // Druid ('dru')
      ;(world.self as any).level = 30
      ;(world.self as any).stats.set(0, 100) // Str 100
      ;(world.self as any).stats.set(2, 100) // Dex 100
      ;(world.self as any).stats.set(3, 100) // Vit 100
      ;(world.self as any).stats.set(1, 50)  // Ene 50
      ;(world.self as any).stats.set(12, 30) // Level 30
      ;(world.self as any).stats.set(7, 200 << 8) // MaxHP
      ;(world.self as any).stats.set(6, 200 << 8) // HP

      for (const [id, lvl] of [
        [0, 1],
        [223, 5],
        [224, 5],
        [228, 5],
        [232, 5],
        [233, 5],
        [242, 5],
        [248, 5],
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

      // 1. Human form baseline
      hudModel.syncFromWorld()
      const humanAr = hud.charSheet.attrs.attackRating
      const humanDef = hud.charSheet.attrs.defense

      // 2. Werewolf (139) + Feral Rage (120) -> higher AR
      ;(world.self.states as Set<number>).add(139)
      ;(world.self.states as Set<number>).add(120)
      hudModel.syncFromWorld()
      const wolfAr = hud.charSheet.attrs.attackRating
      expect(wolfAr).toBeGreaterThan(humanAr)

      // 3. Left-click Fury (#248) vs Hunger (#242) in Werewolf form
      ;(world.self as any).leftSkill = 248
      hudModel.syncFromWorld()
      const furyAr = hud.charSheet.attrs.attackRating
      expect(furyAr).toBeGreaterThan(wolfAr)

      ;(world.self as any).leftSkill = 242 // Hunger (+90% AR at slvl 5)
      hudModel.syncFromWorld()
      expect(hud.charSheet.attrs.attackRating).toBeGreaterThan(wolfAr)

      // 4. Werebear (140) + Maul (117) -> higher Defense
      ;(world.self.states as Set<number>).delete(139)
      ;(world.self.states as Set<number>).delete(120)
      ;(world.self.states as Set<number>).add(140)
      ;(world.self.states as Set<number>).add(117)
      ;(world.self as any).leftSkill = 233 // Maul
      hudModel.syncFromWorld()
      expect(hud.charSheet.attrs.defense).toBeGreaterThan(humanDef)
    })
  })

  describe('Layer 3: Server Execution & State Machine (druid-shapeshift.ts, registry.ts, state-bus.ts, anim-dispatcher.ts)', () => {
    it('calculates exact 1.13c stats for all 10 Shape Shifting skills', () => {
      // Werewolf + Lycanthropy
      const ww = calculateWerewolfStats(5, 5)
      expect(ww.maxHpBonusPct).toBe(25 + 40) // 25% base + 40% Lycanthropy
      expect(ww.durationFrames).toBe(1000 + (1000 + 4 * 500)) // 4000 frames (160s)
      expect(ww.toHitBonusPct).toBe(50 + 4 * 15) // 110%

      // Werebear
      const wb = calculateWerebearStats(5, 5)
      expect(wb.maxHpBonusPct).toBe(50 + 40) // 50% base + 40% Lycanthropy
      expect(wb.damageBonusPct).toBe(50 + 4 * 8) // +82%
      expect(wb.defenseBonusPct).toBe(25 + 4 * 6) // +49%

      // Feral Rage progressive charges: maxCharges = floor(slvl/2) + 3
      const fr1 = calculateFeralRageStats(4, 1)
      const frMax = calculateFeralRageStats(4, 5)
      expect(fr1.maxCharges).toBe(5)
      expect(fr1.lifeLeechPct).toBe(4)
      expect(frMax.lifeLeechPct).toBe(20)
      expect(frMax.velocityBonusPct).toBeGreaterThan(fr1.velocityBonusPct)

      // Maul progressive charges: maxCharges = floor(slvl/2) + 3, +20% ED per charge
      const maul1 = calculateMaulStats(4, 1)
      const maulMax = calculateMaulStats(4, 5)
      expect(maul1.damageBonusPct).toBe(20)
      expect(maulMax.damageBonusPct).toBe(100)

      // Rabies: HitShift=3 poison + 7 subtiles contagion
      const rab = calculateRabiesStats(1, 0)
      expect(rab.contagionRadiusSubtiles).toBe(7)
      expect(rab.poisonDurationFrames).toBe(100)
      expect(rab.minPoisonDamage).toBe(Math.floor((6 * 8 * 100) / 256))

      // Fire Claws: +22%/blvl synergy
      const fc0 = calculateFireClawsStats(1, 0, 0, 0, 0)
      const fc10 = calculateFireClawsStats(1, 5, 5, 0, 0)
      expect(fc0.minFireDamage).toBe(15)
      expect(fc10.minFireDamage).toBe(Math.trunc((15 * (100 + 220)) / 100))

      // Hunger: -75% damage, dm(50, 200, slvl) leech (73% at slvl 1)
      const hg = calculateHungerStats(1)
      expect(hg.damagePenaltyPct).toBe(-75)
      expect(hg.lifeLeechPct).toBe(73)
      expect(hg.manaLeechPct).toBe(73)

      // Shock Wave: stun capped at 250 frames (10s)
      const sw20 = calculateShockWaveStats(20, 10)
      expect(sw20.stunDurationFrames).toBe(250)

      // Fury: min(5, max(2, 1 + slvl)) hits
      expect(calculateFuryStats(1).attackCount).toBe(2)
      expect(calculateFuryStats(4).attackCount).toBe(5)
      expect(calculateFuryStats(20).attackCount).toBe(5)
    })

    it('enforces 1.13c form restrictions in canCastDruidSkill and AnimDispatcher.validateRestriction', async () => {
      // Wolf-only (#232, #238, #248), Bear-only (#233, #243), Both morphs (#239, #242), Armageddon (#249 restrict=1)
      expect(canCastDruidSkill('human', 232)).toBe(false)
      expect(canCastDruidSkill('wolf', 232)).toBe(true)
      expect(canCastDruidSkill('bear', 232)).toBe(false)

      expect(canCastDruidSkill('human', 233)).toBe(false)
      expect(canCastDruidSkill('wolf', 233)).toBe(false)
      expect(canCastDruidSkill('bear', 233)).toBe(true)

      expect(canCastDruidSkill('wolf', 239)).toBe(true)
      expect(canCastDruidSkill('bear', 239)).toBe(true)
      expect(canCastDruidSkill('human', 239)).toBe(false)

      // Armageddon (#249) is allowed while morphed (restrict=1), Hurricane (#250) is blocked
      expect(canCastDruidSkill('wolf', 249)).toBe(true)
      expect(canCastDruidSkill('bear', 249)).toBe(true)
      expect(canCastDruidSkill('wolf', 250)).toBe(false)

      const registry = await getSharedDataRegistry()
      const statList = new UnitStatList()
      const stateBus = new StateBus(statList, registry)
      const anim = new AnimDispatcher({ registry, statList, stateBus, charToken: 'DR' })

      const skill232 = registry.getSkillById(232)!
      const skill233 = registry.getSkillById(233)!
      const skill239 = registry.getSkillById(239)!
      const skill249 = registry.getSkillById(249)!
      const skill225 = registry.getSkillById(225)!

      // Human form: cannot cast Feral Rage (232) or Maul (233)
      expect(anim.validateRestriction(skill232).ok).toBe(false)
      expect(anim.validateRestriction(skill233).ok).toBe(false)

      // Morph to Werewolf: can cast Feral Rage (232), Fire Claws (239), Armageddon (249); cannot cast Maul (233) or Firestorm (225)
      stateBus.applyState({ stateNameOrId: 'wolf', durationFrames: 1000, slvl: 1 })
      expect(anim.validateRestriction(skill232).ok).toBe(true)
      expect(anim.validateRestriction(skill239).ok).toBe(true)
      expect(anim.validateRestriction(skill249).ok).toBe(true)
      expect(anim.validateRestriction(skill233).ok).toBe(false)
      expect(anim.validateRestriction(skill225).ok).toBe(false)
    })

    it('handles morph toggle-off with 0 mana cost (nocostinstate=1), charge orb eviction, and survival HP clamp', async () => {
      const registry = await getSharedDataRegistry()
      const skill223 = registry.getSkillById(223)!
      const statList = new UnitStatList()
      statList.setBaseSkillLevel(223, 5)
      statList.setBaseSkillLevel(224, 5)
      statList.setBaseStat('maxhp', 100 * FIXED_ONE)
      statList.setHp256(100 * FIXED_ONE)
      statList.setBaseStat('maxmana', 100 * FIXED_ONE)
      statList.setMana256(50 * FIXED_ONE)
      const stateBus = new StateBus(statList, registry)

      const caster: CombatUnitContext = {
        id: 'dru-1',
        name: 'Druid',
        charClass: 'druid',
        statList,
        stateBus,
        unitType: 'player',
      }

      const evalRes = evaluateSkillCore113c({
        registry,
        skill: skill223,
        slvl: 5,
        blvl: 5,
        statList,
        difficulty: 'normal',
      })

      // 1. Cast Werewolf -> applies state 'wolf', boosts MaxHP & HP
      const morphRes = executeSkillCore113c({
        registry,
        skill: skill223,
        evalResult: evalRes,
        caster,
        targets: [],
        targetPositions: new Map(),
        corpses: [],
        missileEngine: new MissileEngine(registry),
        auraScanner: {} as any,
        summonManager: {} as any,
        currentTick: 1,
        targetX: 100,
        targetY: 100,
        difficulty: 'normal',
      })
      expect(morphRes.executed).toBe(true)
      expect(stateBus.hasState('wolf')).toBe(true)

      // 2. Apply Feral Rage charge orb (coexists with 'wolf' in group 3)
      stateBus.applyState({
        stateNameOrId: 'feralrage',
        durationFrames: 500,
        slvl: 5,
        stats: { item_normaldamage_percent: 50, nCharge: 2 },
      })
      expect(stateBus.hasState('wolf')).toBe(true)
      expect(stateBus.hasState('feralrage')).toBe(true)

      // 3. Damage player to 1 HP (256 fixed-point) and set mana to 0
      statList.setHp256(256)
      statList.setMana256(0)

      // 4. Cast Werewolf again to toggle off: costs 0 mana, evicts 'feralrage', clamps HP >= 256 (never dies)
      const unshiftRes = executeSkillCore113c({
        registry,
        skill: skill223,
        evalResult: evalRes,
        caster,
        targets: [],
        targetPositions: new Map(),
        corpses: [],
        missileEngine: new MissileEngine(registry),
        auraScanner: {} as any,
        summonManager: {} as any,
        currentTick: 2,
        targetX: 100,
        targetY: 100,
        difficulty: 'normal',
      })
      expect(unshiftRes.executed).toBe(true)
      expect(unshiftRes.manaSpent256).toBe(0)
      expect(stateBus.hasState('wolf')).toBe(false)
      expect(stateBus.hasState('feralrage')).toBe(false)
      expect(statList.getHp256()).toBeGreaterThanOrEqual(256)
    })

    it('executes Shock Wave (#243) piercing fan missiles with non-boss stun and boss immunity', async () => {
      const registry = await getSharedDataRegistry()
      const skill243 = registry.getSkillById(243)!
      const statList = new UnitStatList()
      statList.setBaseSkillLevel(243, 10)
      statList.setBaseSkillLevel(233, 10)
      statList.setMana256(100 * FIXED_ONE)
      const stateBus = new StateBus(statList, registry)
      stateBus.applyState({ stateNameOrId: 'bear', durationFrames: 1000, slvl: 5 })

      const caster: CombatUnitContext = {
        id: 'dru-bear',
        name: 'Druid',
        charClass: 'druid',
        statList,
        stateBus,
        unitType: 'player',
      }

      const normalStats = new UnitStatList()
      normalStats.setHp256(500 * FIXED_ONE)
      const normalMob: CombatUnitContext = {
        id: 'mob-normal',
        name: 'Zombie',
        statList: normalStats,
        stateBus: new StateBus(normalStats, registry),
        unitType: 'monster',
      }

      const bossStats = new UnitStatList()
      bossStats.setHp256(5000 * FIXED_ONE)
      const bossMob: CombatUnitContext = {
        id: 'mob-boss',
        name: 'Diablo',
        statList: bossStats,
        stateBus: new StateBus(bossStats, registry),
        unitType: 'monster',
        isBoss: true,
        rank: 'boss',
      }

      const evalRes = evaluateSkillCore113c({
        registry,
        skill: skill243,
        slvl: 10,
        blvl: 10,
        statList,
        difficulty: 'normal',
      })

      const res = executeSkillCore113c({
        registry,
        skill: skill243,
        evalResult: evalRes,
        caster,
        targets: [normalMob, bossMob],
        targetPositions: new Map([
          ['mob-normal', { x: 120, y: 100 }],
          ['mob-boss', { x: 140, y: 100 }],
        ]),
        corpses: [],
        missileEngine: new MissileEngine(registry),
        auraScanner: {} as any,
        summonManager: {} as any,
        currentTick: 1,
        targetX: 150,
        targetY: 100,
        difficulty: 'normal',
      })

      expect(res.executed).toBe(true)
      expect(res.missilesSpawned.length).toBe(5)
      expect(normalMob.stateBus.hasState('stun')).toBe(true)
      expect(bossMob.stateBus.hasState('stun')).toBe(false)
    })

    it('spreads Rabies (#238) contagion within 7 subtiles (140px)', () => {
      const newlyInfectedIds = simulateRabiesContagion(
        [{ id: 'host', x: 100, y: 100 }],
        [
          { id: 'mob-1', x: 150, y: 100 }, // 50px <= 140px -> infected
          { id: 'mob-2', x: 235, y: 100 }, // 135px <= 140px -> infected
          { id: 'mob-3', x: 260, y: 100 }, // 160px > 140px -> out of range
        ],
        140,
      )
      expect(newlyInfectedIds).toEqual(['mob-1', 'mob-2'])
    })
  })

  describe('Layer 4: Client World Missiles & Visuals (world-skill-missiles.ts & missiles-data.ts)', () => {
    it('configures shockwave and rabiesplague in missiles-data to match 1.13c Missiles.txt', () => {
      expect(getMissileTxtData('shockwave')?.pierce).toBeUndefined()
      expect(getMissileTxtData('rabiesplague')?.alwaysExplode).toBeUndefined()
    })

    it('manages Werewolf/Werebear morph states and clears Feral Rage / Maul charge orbs on form change', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 5, name: 'Druid', x: 100, y: 100 })
      const selfUnit = world.getUnit('player', 1)!
      expect(selfUnit).toBeDefined()

      // Cast Werewolf (#223) -> adds state 139
      ;(world as any).applySkillCastToUnit(selfUnit, 223, 100, 100, 5)
      expect(selfUnit.states.has(139)).toBe(true)

      // Cast Feral Rage (#232) -> adds state 120 and increments feralRageCharges (drawn via state setfunc 16 as feralrage1/feralrage1back)
      ;(world as any).spawnMissilesForSkill(selfUnit, 232, selfUnit.x + 1, selfUnit.y, 5)
      expect(selfUnit.states.has(120)).toBe(true)
      expect((selfUnit as any).feralRageCharges).toBe(1)

      // Switch to Werebear (#228) -> removes state 139 and state 120 + resets feralRageCharges, adds state 140
      ;(world as any).applySkillCastToUnit(selfUnit, 228, 100, 100, 5)
      expect(selfUnit.states.has(139)).toBe(false)
      expect(selfUnit.states.has(120)).toBe(false)
      expect((selfUnit as any).feralRageCharges ?? 0).toBe(0)
      expect(selfUnit.states.has(140)).toBe(true)
    })
  })
})
