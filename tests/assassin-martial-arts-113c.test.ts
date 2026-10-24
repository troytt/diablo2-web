import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import { SKILLS_BY_ID } from '../src/common/data/skills-catalog.ts'
import {
  buildTooltipViewModel,
  compileSkillDescFormula,
  createInitialState,
  type SkillCalcState,
} from '../src/common/skills/skill-calc-engine.ts'
import {
  getSkillCooldownTicks,
  getSkillManaCost,
} from '../src/common/skills/missiles-data.ts'
import { getSkillRange } from '../src/common/skills/weapon-combat-meta.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'
import { executeSUnitDmg, type CombatUnitContext } from '../src/server/engine/combat-pipeline.ts'
import { evaluateSkill113c, executeSkill113c } from '../src/server/skills/registry.ts'
import {
  evaluateBladesOfIceStats,
  evaluateClawsOfThunderStats,
  evaluateCobraStrikeStats,
  evaluateDragonClawStats,
  evaluateDragonFlightStats,
  evaluateDragonTailStats,
  evaluateDragonTalonStats,
  evaluateFistsOfFireStats,
  evaluatePhoenixStrikeStats,
  evaluateTigerStrikeStats,
  getCobraStrikeLeechBonus,
  resolveFinisherDischarge,
} from '../src/server/skills/assassin-martial-arts.ts'
import {
  getCobraStrikeLeechBonus as getCobraStrikeLeechBonusFromMod,
  skillModule as cobraStrikeModule,
} from '../src/server/skills/impl/ass/skill-265-cobra-strike.ts'
import { castSkill } from '../src/server/skills/skills.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import type { ItemData } from '../src/netproto/index.ts'

const MARTIAL_ARTS_SKILL_IDS = [254, 255, 259, 260, 265, 269, 270, 274, 275, 280] as const

function makeAssCalcState(hardPoints: Record<number, number>): SkillCalcState {
  return {
    ...createInitialState('ass'),
    hardPoints,
  }
}

function makeCombatUnit(
  id: string,
  overrides: Partial<CombatUnitContext> = {},
): CombatUnitContext {
  const statList = overrides.statList ?? new UnitStatList()
  const stateBus = overrides.stateBus ?? new StateBus(statList)
  if (!overrides.statList) {
    statList.setBaseStat('strength', 60)
    statList.setBaseStat('dexterity', 60)
    statList.setBaseStat('vitality', 60)
    statList.setBaseStat('energy', 40)
    statList.setBaseStat('level', 60)
    statList.setBaseStat('tohit', 5000)
    statList.setBaseStat('armorclass', 100)
    statList.setBaseStat('maxhp', 2000 * FIXED_ONE)
    statList.setBaseStat('hitpoints', 1000 * FIXED_ONE)
    statList.setBaseStat('maxmana', 500 * FIXED_ONE)
    statList.setBaseStat('mana', 250 * FIXED_ONE)
  }
  return {
    id,
    name: id,
    charClass: 'ass',
    statList,
    stateBus,
    x: 100,
    y: 100,
    weaponMinPhys: 30,
    weaponMaxPhys: 50,
    ...overrides,
  }
}

describe('Assassin Martial Arts (#254-#280) — 1.13c 4-Layer Parity (Issue #1003)', () => {
  describe('Layer 1: Catalog, Calc Engine, HUD World Sync & Combat Stats', () => {
    it('aligns nameZh, shortDescZh, longDescZh, and synergiesReceived for #254-#280 in skills-catalog.ts', () => {
      const expectedNamesZh: Record<number, string> = {
        254: '虎击',
        255: '龙爪',
        259: '焰拳',
        260: '双龙爪',
        265: '眼镜蛇攻击',
        269: '雷电爪',
        270: '神龙摆尾',
        274: '寒冰刃',
        275: '龙翔',
        280: '凤凰攻击',
      }
      for (const id of MARTIAL_ARTS_SKILL_IDS) {
        const entry = SKILLS_BY_ID[id]
        expect(entry).toBeDefined()
        expect(entry!.nameZh).toBe(expectedNamesZh[id])
        expect(entry!.shortDescZh.length).toBeGreaterThan(2)
        expect(entry!.longDescZh.length).toBeGreaterThan(4)
      }

      // Verify misaligned descriptions were fixed
      expect(SKILLS_BY_ID[259]!.shortDescZh).toContain('火焰')
      expect(SKILLS_BY_ID[260]!.shortDescZh).toContain('双爪')
      expect(SKILLS_BY_ID[265]!.shortDescZh).toContain('偷取')
      expect(SKILLS_BY_ID[269]!.shortDescZh).toContain('闪电')
      expect(SKILLS_BY_ID[270]!.shortDescZh).toContain('爆炸')
      expect(SKILLS_BY_ID[274]!.shortDescZh).toContain('冰冷')
      expect(SKILLS_BY_ID[275]!.shortDescZh).toContain('瞬移')

      // #260 Dragon Claw: receives +4% damage/blvl from #252 Claw Mastery (par5 = 4)
      const dcEntry = SKILLS_BY_ID[260]!
      expect(dcEntry.params.par5).toBe(4)
      expect(dcEntry.synergiesReceived).toEqual([
        {
          providerName: 'Claw Mastery',
          providerId: 252,
          percentPerLevel: 4,
          type: 'damage',
        },
      ])

      // #280 Phoenix Strike: receives all 4 synergy entries (#259 +10% & +6%, #269 +13%, #274 +10%)
      const psEntry = SKILLS_BY_ID[280]!
      expect(psEntry.synergiesReceived).toHaveLength(4)
      expect(psEntry.synergiesReceived).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ providerId: 259, percentPerLevel: 10 }),
          expect.objectContaining({ providerId: 259, percentPerLevel: 6 }),
          expect.objectContaining({ providerId: 269, percentPerLevel: 13 }),
          expect.objectContaining({ providerId: 274, percentPerLevel: 10 }),
        ]),
      )
    })

    it('supports miss(...) references, m1en..m3ex/edns/edxs tokens, and lineType 24/61/62/66 in skill-calc-engine.ts', () => {
      // #280 Phoenix Strike L1 tooltip: Charge 1 Meteor (20-40), Charge 2 Chain Lightning (1-40), Charge 3 Chaos Ice (16-32)
      const psVm1 = buildTooltipViewModel(makeAssCalcState({ 280: 1 }), 280)
      expect(psVm1).not.toBeNull()
      const psLinesEn = psVm1!.current.effects.map((e) => e.textEn).join('\n')
      expect(psLinesEn).toContain('20-40')
      expect(psLinesEn).toContain('1-40')
      expect(psLinesEn).toContain('16-32')

      // #280 Phoenix Strike L1 with +10 Fists of Fire (+100% meteor, +60% ground fire), +10 Claws of Thunder (+130% CL), +10 Blades of Ice (+100% chaos ice)
      const psVmSyn = buildTooltipViewModel(
        makeAssCalcState({ 280: 1, 259: 10, 269: 10, 274: 10 }),
        280,
      )
      const psSynLinesEn = psVmSyn!.current.effects.map((e) => e.textEn).join('\n')
      expect(psSynLinesEn).toContain('40-80') // 20..40 * 2.0
      expect(psSynLinesEn).toContain('2-92') // floor(1 * 2.3) .. floor(40 * 2.3)
      expect(psSynLinesEn).toContain('32-64') // 16..32 * 2.0
      expect(psSynLinesEn).toContain('22-37 per second') // royalstrikemeteorfire: floor(6*8*1.6)=76, floor(76*75/256)=22 .. floor(10*8*1.6)=128, floor(128*75/256)=37

      // #259 Fists of Fire, #269 Claws of Thunder, #274 Blades of Ice evaluate Charge 1/2/3 lines
      const fofVm = buildTooltipViewModel(makeAssCalcState({ 259: 1 }), 259)
      expect(fofVm!.current.effects.some((e) => e.textEn.includes('6-10'))).toBe(true)

      const cotVm = buildTooltipViewModel(makeAssCalcState({ 269: 1 }), 269)
      expect(cotVm!.current.effects.some((e) => e.textEn.includes('1-80'))).toBe(true)

      const boiVm = buildTooltipViewModel(makeAssCalcState({ 274: 1 }), 274)
      expect(boiVm!.current.effects.some((e) => e.textEn.includes('15-35'))).toBe(true)

      // Direct formula compilation check for miss('royalstrikemeteorfire'.edns)
      const fn = compileSkillDescFormula("miss('royalstrikemeteorfire'.edns)*75/256")
      const val = fn({
        lvl: 1,
        params: { par5: 6 },
        ln12: 0,
        ln34: 0,
        ln56: 0,
        ln78: 0,
        dm12: 0,
        dm34: 0,
        dm56: 0,
        dm78: 0,
        toht: 15,
        len: 0,
        edmn: 0,
        edmx: 0,
        edns: 0,
        edxs: 0,
        m1en: 20,
        m1ex: 40,
        m2en: 1,
        m2ex: 40,
        m3en: 16,
        m3ex: 32,
        m1eo: 768,
        m1ey: 1280,
        mana: 4,
        mps: 0,
        hardPoints: { 259: 10 },
        effLevels: { 259: 10, 280: 1 },
      })
      expect(val).toBe(22)
    })

    it('supports Assassin dual-wielding claws in combat-stats.ts and kick/boots/Martial Arts in hud-world-sync.ts', () => {
      const world = new ClientWorld()
      world.selfId = 1
      world.areaId = 1
      ;(world.self as any).charClass = 6 // Assassin ('ass')
      ;(world.self as any).level = 60
      ;(world.self as any).stats.set(0, 100) // Str 100
      ;(world.self as any).stats.set(2, 100) // Dex 100
      ;(world.self as any).stats.set(3, 100) // Vit 100
      ;(world.self as any).stats.set(1, 50)  // Ene 50
      ;(world.self as any).stats.set(12, 60) // Level 60

      for (const [id, lvl] of [
        [252, 10], // Claw Mastery
        [254, 10], // Tiger Strike
        [255, 10], // Dragon Talon (Kick)
        [259, 10], // Fists of Fire
        [260, 10], // Dragon Claw (Dual-claw finisher)
        [265, 10], // Cobra Strike
        [269, 10], // Claws of Thunder
        [270, 10], // Dragon Tail (Kick)
        [274, 10], // Blades of Ice (NOT a kick!)
        [275, 10], // Dragon Flight (Kick)
        [280, 10], // Phoenix Strike
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

      // Equip two Bartuc's Cut-Throat / Suwayyah claws (code '9tw', h2h) in slots 4 and 5, plus Myrmidon Greaves ('uhb', minDam=83, maxDam=149) in slot 9
      const claw1: ItemData = {
        id: 101,
        code: '9tw',
        name: 'Greater Talons',
        quality: 4,
        identified: true,
        bodyLoc: 4,
        stats: [],
        runewordStats: [],
        setBonusStats: [],
        flags: { identified: true } as any,
      } as any
      const claw2: ItemData = {
        id: 102,
        code: '9tw',
        name: 'Greater Talons',
        quality: 4,
        identified: true,
        bodyLoc: 5,
        stats: [],
        runewordStats: [],
        setBonusStats: [],
        flags: { identified: true } as any,
      } as any
      const boots: ItemData = {
        id: 109,
        code: 'uhb', // Myrmidon Greaves (83-149 kick damage)
        name: 'Myrmidon Greaves',
        quality: 4,
        identified: true,
        bodyLoc: 9,
        defense: 70,
        stats: [],
        runewordStats: [],
        setBonusStats: [],
        flags: { identified: true } as any,
      } as any
      for (const eq of [claw1, claw2, boots]) {
        ;(world.containers.equipment as Map<number, any>).set(eq.id, eq)
        ;(world.containers.equipmentBySlot as Map<number, any>).set(eq.bodyLoc!, eq)
      }

      // Left skill: #260 Dragon Claw (dual-claw finisher), Right skill: #255 Dragon Talon (kick)
      ;(world.self as any).leftSkill = 260
      ;(world.self as any).rightSkill = 255

      const hud = new HudManager()
      const hudModel = new HudModel({ world, hudManager: hud })
      hudModel.syncFromWorld()
      const attrs = hud.charSheet.attrs

      // Kick damage on right click (#255 Dragon Talon) uses Myrmidon Greaves (83-149) + Str/Dex + Kick ED%
      const parseDmgRange = (txt: string): [number, number] => {
        const m = txt.match(/(\d+)-(\d+)/)
        return m ? [Number(m[1]), Number(m[2])] : [0, 0]
      }
      const [kickMin, kickMax] = parseDmgRange(attrs.rightSkillDmg ?? '')
      expect(kickMin).toBeGreaterThan(250)
      expect(kickMax).toBeGreaterThan(400)

      // Switching leftSkill to #274 Blades of Ice must use claw weapon damage (NOT kick damage!)
      ;(world.self as any).leftSkill = 274
      hudModel.syncFromWorld()
      const [boiMin, boiMax] = parseDmgRange(hud.charSheet.attrs.leftSkillDmg ?? '')
      expect(boiMin).toBeGreaterThan(15)
      expect(boiMax).toBeLessThan(kickMax)
    })
  })

  describe('Layer 2: Server Evaluators, Kick Formula, Charge-Up & Finisher Discharge, Missiles Data', () => {
    it('evaluates exact 1.13c stats in assassin-martial-arts.ts and skill-265-cobra-strike.ts', () => {
      // #269 Claws of Thunder: C3 chargedBoltsCount = 16
      const cotDischarge = resolveFinisherDischarge([
        { skillId: 269, count: 3, slvl: 10, expiresAtFrame: 375 },
      ])
      expect(cotDischarge[0]?.ltngDamage?.hasNova).toBe(true)
      expect(cotDischarge[0]?.ltngDamage?.chargedBoltsCount).toBe(16)

      // #280 Phoenix Strike: C2 radial chain lightnings = 7, bounces = 5 + slvl
      const psStats10 = evaluatePhoenixStrikeStats(10, {
        fistsOfFireBlvl: 5,
        clawsOfThunderBlvl: 5,
        bladesOfIceBlvl: 5,
      })
      expect(psStats10.chainLightningBoltsCount).toBe(7)
      expect(psStats10.chainLightningTargets).toBe(15) // 5 + 10
      const psDischargeC2 = resolveFinisherDischarge([
        { skillId: 280, count: 2, slvl: 10, expiresAtFrame: 375 },
      ])
      expect(psDischargeC2[0]?.phoenixPayload?.chainLightningDamage?.boltsCount).toBe(7)
      expect(psDischargeC2[0]?.phoenixPayload?.chainLightningDamage?.maxTargets).toBe(15)

      // #259 Fists of Fire: convertPhysToFirePct = min(100, 3 * slvl), burningGroundFrames = 64
      const fof10 = evaluateFistsOfFireStats(10)
      expect(fof10.convertPhysToFirePct).toBe(30)
      expect(fof10.burningGroundFrames).toBe(64)
      const fof34 = evaluateFistsOfFireStats(34)
      expect(fof34.convertPhysToFirePct).toBe(100)
      expect(fof34.burningGroundFrames).toBe(64)

      // #265 Cobra Strike: getCobraStrikeLeechBonus(chargeCount, slvl) = (40 + 5*(slvl-1)) * chargeCount
      expect(getCobraStrikeLeechBonus(1, 1)).toBe(40)
      expect(getCobraStrikeLeechBonus(2, 1)).toBe(80)
      expect(getCobraStrikeLeechBonus(3, 1)).toBe(120)
      expect(getCobraStrikeLeechBonus(1, 10)).toBe(85)
      expect(getCobraStrikeLeechBonus(2, 10)).toBe(170)
      expect(getCobraStrikeLeechBonus(3, 10)).toBe(255)
      expect(getCobraStrikeLeechBonusFromMod(3, 10)).toBe(255)

      // #255 Dragon Talon: manaCost = 10
      expect(evaluateDragonTalonStats(1).manaCost).toBe(10)
    })

    it('computes SKILLS_CalculateKickDamage (0x6FC9AE10) for #1, #255, #270, #275 without weapon damage, crit, or weapon durability loss', async () => {
      const registry = await getSharedDataRegistry()
      let durabilityDrained = 0
      const statList = new UnitStatList()
      statList.setBaseStat('strength', 100)
      statList.setBaseStat('dexterity', 100)
      statList.setBaseStat('level', 80)
      statList.setBaseStat('tohit', 10000)
      statList.setBaseStat('passive_critical_strike', 100)
      statList.setBaseStat('passive_mastery_crit', 100)
      statList.setBaseStat('item_deadlystrike', 100)
      statList.setBaseSkillLevel(255, 1)
      statList.setBaseSkillLevel(270, 1)
      statList.setBaseSkillLevel(275, 1)
      ;(statList as any).drainEquippedWeaponDurability = () => {
        durabilityDrained += 1
      }

      const caster = makeCombatUnit('ass-kicker', {
        statList,
        weaponMinPhys: 500, // Huge weapon damage that MUST be ignored by kicks
        weaponMaxPhys: 1000,
        bootMinDam: 20,
        bootMaxDam: 30,
      })
      const target = makeCombatUnit('dummy', { x: 105, y: 105 })

      // Verify executeSUnitDmg on kick (#255) ignores weaponMinPhys=500..1000 and cannot crit
      const dmgOut = executeSUnitDmg(caster, target, {
        skillId: 255,
        attackKind: 'melee',
        physDamagePct: 5,
        autoHit: true,
        critRoll100: 0,
      }, { rand: () => 50 })
      // str=100, dex=100 -> attrMin = (200-20)/4 = 45, attrMax = (200-20)/3 = 60
      // bootMin=20, bootMax=30, strBootBonus=120, skillED=5 ->
      // kMin = floor(45*1.05) + floor(20*2.25) = 47 + 45 = 92
      // kMax = floor(60*1.05) + floor(30*2.25) = 63 + 67 = 130 (not 500+ weapon or 2x crit!)
      expect(dmgOut.totalDamage).toBeGreaterThanOrEqual(92)
      expect(dmgOut.totalDamage).toBeLessThanOrEqual(130)

      // Verify executeSkill113c on #1, #255, #270, #275 does not drain weapon durability
      for (const kId of [1, 255, 270, 275]) {
        const skillRec = registry.getSkillById(kId)!
        const out = executeSkill113c({
          registry,
          skill: skillRec,
          caster,
          targets: [makeCombatUnit(`t-${kId}`, { x: 105, y: 105 })],
        } as any)
        expect(out.executed).toBe(true)
        expect(out.notes.some((n) => n.startsWith('kick_damage:'))).toBe(true)
      }
      expect(durabilityDrained).toBe(0)
    })

    it('enforces meleeAppliesSkillElem=false and dual-claw 2-hit charge generation on #259, #269, #274', async () => {
      const registry = await getSharedDataRegistry()
      const caster = makeCombatUnit('ass-dual', {
        isDualClaw: true,
        weaponMinPhys: 20,
        weaponMaxPhys: 20,
        offHandMinPhys: 20,
        offHandMaxPhys: 20,
      })
      caster.statList.setBaseSkillLevel(269, 20)
      const target = makeCombatUnit('mon-phys-only', { x: 102, y: 102 })

      const cotSkill = registry.getSkillById(269)!
      const out = executeSkill113c({
        registry,
        skill: cotSkill,
        caster,
        targets: [target],
      } as any)
      expect(out.executed).toBe(true)
      expect(out.notes).toContain('melee_hits:2')
      // Dual-claw swing adds 2 charges in a single cast!
      const st = caster.stateBus.getState('progressive_lightning')
      expect(st?.stats?.charge).toBe(2)
      // Only normal weapon physical damage (20 * 2 = 40) was dealt; Claws of Thunder lightning (1..780) was NOT applied on charge-up!
      expect(out.totalDamageDealt).toBe(40)
    })

    it('discharges charges on the first successful hit of a multi-hit finisher, converts physical to fire via #259 before #270 Dragon Tail, and includes primary target in #270 AoE', async () => {
      const registry = await getSharedDataRegistry()
      const caster = makeCombatUnit('ass-finisher', {
        isDualClaw: true,
        bootMinDam: 20,
        bootMaxDam: 20,
      })
      caster.statList.setBaseSkillLevel(255, 6) // 2 kicks
      caster.statList.setBaseSkillLevel(270, 10) // 140% fire explosion

      // Apply Charge 3 Phoenix Strike (#280) and Charge 3 Claws of Thunder (#269)
      caster.stateBus.applyState({
        stateNameOrId: 'progressive_other',
        sourceUnitId: caster.id,
        sourceSkillId: 280,
        slvl: 10,
        durationFrames: 375,
        stats: { charge: 3, progressive_charges: 3 },
      })
      caster.stateBus.applyState({
        stateNameOrId: 'progressive_lightning',
        sourceUnitId: caster.id,
        sourceSkillId: 269,
        slvl: 10,
        durationFrames: 375,
        stats: { charge: 3, progressive_charges: 3 },
      })

      const t1 = makeCombatUnit('t1', { x: 102, y: 102 })
      const dtalonRec = registry.getSkillById(255)!
      const dOut = executeSkill113c({
        registry,
        skill: dtalonRec,
        caster,
        targets: [t1],
      } as any)
      expect(dOut.notes).toContain('finisher_discharged')
      expect(dOut.missilesSpawned.filter((m) => m === 'clawsofthunderbolt')).toHaveLength(16)
      expect(dOut.missilesSpawned.filter((m) => m === 'royalstrikechaosice')).toHaveLength(16)
      expect(caster.stateBus.getState('progressive_other')).toBeUndefined()

      // Dragon Tail (#270) includes primary target in Fire AoE
      const primary = makeCombatUnit('dt-primary', { x: 100, y: 100 })
      const dtailRec = registry.getSkillById(270)!
      const dtNormal = executeSkill113c({
        registry,
        skill: dtailRec,
        caster,
        targets: [primary],
      } as any)
      expect(dtNormal.missilesSpawned).toContain('dragontail missile')

      // With slvl 34 Fists of Fire (#259), 100% physical is converted to fire -> Dragon Tail fire explosion is 0!
      caster.stateBus.applyState({
        stateNameOrId: 'progressive_fire',
        sourceUnitId: caster.id,
        sourceSkillId: 259,
        slvl: 34,
        durationFrames: 375,
        stats: { charge: 1, progressive_charges: 1 },
      })
      const primaryFof34 = makeCombatUnit('dt-fof34', { x: 100, y: 100 })
      const dtFof34 = executeSkill113c({
        registry,
        skill: dtailRec,
        caster,
        targets: [primaryFof34],
      } as any)
      expect(dtFof34.notes).toContain('fists_of_fire_phys_to_fire_pct:100')
      expect(dtFof34.missilesSpawned).not.toContain('dragontail missile')
    })

    it('returns exact 1.13c mana costs and cooldowns in missiles-data.ts', () => {
      expect(getSkillManaCost(254, 1)).toBe(1)
      expect(getSkillManaCost(255, 1)).toBe(10)
      expect(getSkillManaCost(259, 1)).toBe(2)
      expect(getSkillManaCost(260, 1)).toBe(2)
      expect(getSkillManaCost(265, 1)).toBe(2)
      expect(getSkillManaCost(269, 1)).toBe(4)
      expect(getSkillManaCost(269, 5)).toBe(5)
      expect(getSkillManaCost(269, 9)).toBe(6)
      expect(getSkillManaCost(270, 1)).toBe(10)
      expect(getSkillManaCost(274, 1)).toBe(3)
      expect(getSkillManaCost(275, 1)).toBe(15)
      expect(getSkillManaCost(280, 1)).toBe(4)

      for (const id of MARTIAL_ARTS_SKILL_IDS) {
        expect(getSkillCooldownTicks(id)).toBe(id === 275 ? 25 : 0)
      }
    })
  })

  describe('Layer 3 & Layer 4: Skill Caster, Weapon Combat Meta & Client World Skill Missiles', () => {
    it('returns 52 melee range for #254-#270, #274, #280 and 450 teleport range for #275 in getSkillRange', () => {
      for (const id of MARTIAL_ARTS_SKILL_IDS) {
        expect(getSkillRange(id)).toBe(id === 275 ? 450 : 52)
      }
    })

    it('executes all 10 Martial Arts skills in skill-caster.ts (dual-claw charge-ups, multi-kick #255, dual-claw #260, explosive #270, teleport #275)', () => {
      const makeCasterEnv = () => {
        const monster: any = {
          index: 0,
          x: 120,
          y: 120,
          hp: 5000,
          maxHp: 5000,
          state: 'idle',
          stats: { id: 'zombie', name: 'Zombie', hp: 5000, level: 10 },
        }
        const player: any = {
          x: 100,
          y: 100,
          hp: 500,
          maxHp: 500,
          mana: 500,
          maxMana: 500,
          cooldown: 0,
          isDualClaw: true,
          strength: 100,
          dexterity: 100,
          bootMinDam: 20,
          bootMaxDam: 35,
        }
        const overlays: any[] = []
        const projectiles: any[] = []
        const explosions: any[] = []
        const engine: any = {
          world: {
            player,
            monsters: [monster],
            events: [],
            tick: 100,
          },
          overlays,
          projectiles,
          explosions,
          metrics: { casts: 0, playerHits: 0, castHits: 0 },
          spawnOverlay(type: string, pos: { x: number; y: number }, target?: string, opts?: any) {
            overlays.push({ type, x: pos.x, y: pos.y, target, ...opts })
          },
        }
        const status = { textContent: '' }
        const hudManager: any = {
          lang: 'ENG',
          getSkillLevel: () => 12,
          getBaseSkillLevel: () => 5,
        }
        return { engine, player, monster, overlays, projectiles, explosions, status, hudManager }
      }

      const env = makeCasterEnv()
      // 1. Dual-claw #269 Claws of Thunder adds 2 charges in one cast and spawns progressive_lightning_2 overlay
      expect(
        castSkill(269, 120, 120, {
          engine: env.engine,
          hudManager: env.hudManager,
          status: env.status,
        } as any),
      ).toBe(true)
      expect(env.player.martialCharges[269].count).toBe(2)
      expect(env.overlays.some((o) => o.type === 'progressive_lightning_2')).toBe(true)

      // 2. Second cast caps #269 at 3 charges (progressive_lightning_3)
      env.player.cooldown = 0
      expect(
        castSkill(269, 120, 120, {
          engine: env.engine,
          hudManager: env.hudManager,
          status: env.status,
        } as any),
      ).toBe(true)
      expect(env.player.martialCharges[269].count).toBe(3)
      expect(env.overlays.some((o) => o.type === 'progressive_lightning_3')).toBe(true)

      // 3. #280 Phoenix Strike (SrvDo034) adds 1 charge per cast -> progressive_other_1, then progressive_other_2
      env.player.cooldown = 0
      castSkill(280, 120, 120, { engine: env.engine, hudManager: env.hudManager, status: env.status } as any)
      expect(env.player.martialCharges[280].count).toBe(1)
      expect(env.overlays.some((o) => o.type === 'progressive_other_1')).toBe(true)
      env.player.cooldown = 0
      castSkill(280, 120, 120, { engine: env.engine, hudManager: env.hudManager, status: env.status } as any)
      expect(env.player.martialCharges[280].count).toBe(2)
      expect(env.overlays.some((o) => o.type === 'progressive_other_2')).toBe(true)

      // 4. Finisher #255 Dragon Talon (slvl 12 -> 3 kicks) discharges CoT C3 (nova + 16 bolts) and PS C2 (7 chain lightnings)
      env.player.cooldown = 0
      expect(
        castSkill(255, 120, 120, {
          engine: env.engine,
          hudManager: env.hudManager,
          status: env.status,
        } as any),
      ).toBe(true)
      expect(env.projectiles.filter((p) => p.missileType === 'clawsofthunderbolt')).toHaveLength(16)
      expect(env.projectiles.filter((p) => p.missileType === 'royalstrikechainlightning')).toHaveLength(7)
      expect(env.player.martialCharges[269]).toBeUndefined()
      expect(env.player.martialCharges[280]).toBeUndefined()

      // 5. #275 Dragon Flight teleports player to distant target (x=300, y=300) and applies 25f cooldown
      env.monster.x = 300
      env.monster.y = 300
      env.player.cooldown = 0
      expect(
        castSkill(275, 300, 300, {
          engine: env.engine,
          hudManager: env.hudManager,
          status: env.status,
        } as any),
      ).toBe(true)
      expect(env.player.x).toBe(300)
      expect(env.player.y).toBe(300)
      expect(env.player.cooldown).toBe(25)
    })

    it('attaches canonical charge-up overlays and spawns finisher discharge missiles (including Normal Attack 0) in ClientWorld', () => {
      const cw = new ClientWorld()
      cw.selfId = 1
      ;(cw.self as any).charClass = 6
      const selfUnit = (cw as any).ensureUnit('player', 1)
      selfUnit.classId = 6
      selfUnit.x = 50
      selfUnit.y = 50

      // Charge #254 Tiger Strike -> progressive_damage_1
      ;(cw as any).applySkillCastToUnit(selfUnit, 254, 52, 52, 1)
      expect(selfUnit.overlays.some((o: any) => o.token === 'progressive_damage_1')).toBe(true)

      // Charge #265 Cobra Strike -> progressive_steal_1
      ;(cw as any).applySkillCastToUnit(selfUnit, 265, 52, 52, 1)
      expect(selfUnit.overlays.some((o: any) => o.token === 'progressive_steal_1')).toBe(true)

      // Charge #259 Fists of Fire -> progressive_fire_1
      ;(cw as any).applySkillCastToUnit(selfUnit, 259, 52, 52, 1)
      expect(selfUnit.overlays.some((o: any) => o.token === 'progressive_fire_1')).toBe(true)

      // Charge #274 Blades of Ice -> progressive_cold_1
      ;(cw as any).applySkillCastToUnit(selfUnit, 274, 52, 52, 1)
      expect(selfUnit.overlays.some((o: any) => o.token === 'progressive_cold_1')).toBe(true)

      // Charge #269 Claws of Thunder 3 times -> progressive_lightning_3
      ;(cw as any).applySkillCastToUnit(selfUnit, 269, 52, 52, 1)
      ;(cw as any).applySkillCastToUnit(selfUnit, 269, 52, 52, 1)
      ;(cw as any).applySkillCastToUnit(selfUnit, 269, 52, 52, 1)
      expect(selfUnit.overlays.some((o: any) => o.token === 'progressive_lightning_3')).toBe(true)

      // Charge #280 Phoenix Strike 2 times -> progressive_other_2
      ;(cw as any).applySkillCastToUnit(selfUnit, 280, 52, 52, 1)
      ;(cw as any).applySkillCastToUnit(selfUnit, 280, 52, 52, 1)
      expect(selfUnit.overlays.some((o: any) => o.token === 'progressive_other_2')).toBe(true)

      // Release with Normal Attack (skillId === 0): must act as Finisher, spawning 16 clawsofthunderbolt + 7 royalstrikechainlightning and clearing overlays!
      const spawnedKeys: string[] = []
      const origSpawn = (cw as any).spawnMissileByKey.bind(cw)
      ;(cw as any).spawnMissileByKey = (key: string, ...rest: any[]) => {
        spawnedKeys.push(key)
        return origSpawn(key, ...rest)
      }
      ;(cw as any).applySkillCastToUnit(selfUnit, 0, 52, 52, 1)
      expect(spawnedKeys).toContain('clawsofthundernova')
      expect(spawnedKeys.filter((k) => k === 'clawsofthunderbolt')).toHaveLength(16)
      expect(spawnedKeys.filter((k) => k === 'royalstrikechainlightning')).toHaveLength(7)
      expect((selfUnit as any).chargeCounts.size).toBe(0)
      expect(
        selfUnit.overlays.some(
          (o: any) => o.token === 'progressive_lightning_3' || o.token === 'progressive_other_2',
        ),
      ).toBe(false)
    })
  })
})
