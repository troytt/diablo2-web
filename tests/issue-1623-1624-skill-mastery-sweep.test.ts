import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { formatCharacterDamageTooltipLines } from '../src/client/ui/character-sheet.ts'
import { computeHudSkillDamageString } from '../src/client/ui/hud-viewport-layout.ts'
import { SKILLS_BY_ID } from '../src/common/data/skills-catalog.ts'
import {
  calculateDetailedDamage,
  createInitialState,
  evaluateSkillEffects,
} from '../src/common/skills/skill-calc-engine.ts'

describe('Issue #1623 & #1624: Blessed Hammer Concentration single-multiplication & 210-skill mastery sweep', () => {
  it('Issue #1623: Blessed Hammer (#112) does not double-multiply Concentration (#113) as both Mastery and Aura (6691-6776 vs 18200-18430)', () => {
    // 1. Direct calculateDetailedDamage on Lv29 Blessed Hammer (20 hard + 9 bonus)
    //    with Lv20 Vigor (#115) + Lv20 Blessed Aim (#108) (+560% synergy) and Lv27 Concentration (#113, 20 hard + 7 bonus)
    const palState = createInitialState('pal')
    palState.hardPoints[112] = 20
    palState.hardPoints[115] = 20
    palState.hardPoints[108] = 20
    palState.hardPoints[113] = 20
    palState.specificSoftPoints[112] = 9
    palState.specificSoftPoints[113] = 7

    const hammerDef = SKILLS_BY_ID[112]!
    const dmg = calculateDetailedDamage(palState, hammerDef, 29)
    expect(dmg.baseMin).toBe(312)
    expect(dmg.baseMax).toBe(316)
    expect(dmg.synergyBonusPct).toBe(560)
    expect(dmg.withSynergyMin).toBe(2059)
    expect(dmg.withSynergyMax).toBe(2085)
    // Concentration (#113) is an active aura, NOT a passive elemental mastery in D2Common.#10121
    expect(dmg.masteryBonusPct).toBe(0)
    expect(dmg.masteryMultiplier).toBe(1)
    expect(dmg.finalMin).toBe(2059)
    expect(dmg.finalMax).toBe(2085)

    // 2. ClientWorld + HudModel Character Sheet & HUD skill damage text when Concentration is INACTIVE vs ACTIVE
    const world = new ClientWorld()
    world.selfId = 1
    ;(world.self as any).charClass = 3 // Paladin ('pal')
    ;(world.self as any).level = 85
    ;(world.self as any).leftSkill = 112 // Blessed Hammer
    ;(world.self as any).rightSkill = 124 // Redemption (Concentration NOT active)
    ;(world.self as any).skillEntries.set(112, { skillId: 112, level: 29, baseLevel: 20, bonus: 9 })
    ;(world.self as any).skillEntries.set(115, { skillId: 115, level: 20, baseLevel: 20, bonus: 0 })
    ;(world.self as any).skillEntries.set(108, { skillId: 108, level: 20, baseLevel: 20, bonus: 0 })
    ;(world.self as any).skillEntries.set(113, { skillId: 113, level: 27, baseLevel: 20, bonus: 7 })
    ;(world.self as any).skillEntries.set(124, { skillId: 124, level: 1, baseLevel: 1, bonus: 0 })

    const hud = new HudManager()
    const model = new HudModel({ world, hudManager: hud })
    model.syncFromWorld()

    // Without Concentration active: 2059-2085
    expect(hud.charSheet.attrs.leftSkillDmg).toBe('2059-2085')
    expect(hud.charSheet.attrs.leftSkillDmgColor).toBe('white')
    expect(computeHudSkillDamageString(112, hud, world.self.skillEntries as any, world.self.states)).toBe('2059-2085')

    const inactiveZh = formatCharacterDamageTooltipLines('left', hud.charSheet.attrs, 'CHI').map((l) => l.text)
    expect(inactiveZh).toEqual([
      '祝福之鎚 伤害',
      '技能基础伤害: 312~316',
      '技能协同增伤: +560% (→ 2059~2085)',
      '法术增伤 (+0%): 法术精通 +0% + 装备法伤 +0%',
      '公式: 312~316 × (1+560%) = 2059~2085',
    ])

    // Activate Concentration on right hand (#113, Lv27 -> +450% phys ED, 50% for Blessed Hammer = +225%)
    ;(world.self as any).rightSkill = 113
    ;(world.self.states as Set<number>).add(42)
    model.syncFromWorld()

    // With Concentration active: floor(2059 * 3.25) = 6691, floor(2085 * 3.25) = 6776 (NOT 18200-18430)
    expect(hud.charSheet.attrs.leftSkillDmg).toBe('6691-6776')
    expect(hud.charSheet.attrs.leftSkillDmgColor).toBe('blue')
    expect(computeHudSkillDamageString(112, hud, world.self.skillEntries as any, world.self.states)).toBe('6691-6776')

    const activeZh = formatCharacterDamageTooltipLines('left', hud.charSheet.attrs, 'CHI').map((l) => l.text)
    expect(activeZh).toEqual([
      '祝福之鎚 伤害',
      '技能基础伤害: 312~316',
      '技能协同增伤: +560% (→ 2059~2085)',
      '法术增伤 (+225%): 法术精通 +0% + 装备法伤 +0% + 光环 +225%',
      '公式: ⌊312~316 × (1+560%)⌋ × (1+225%) = 6691~6776',
    ])

    const activeEn = formatCharacterDamageTooltipLines('left', hud.charSheet.attrs, 'ENG').map((l) => l.text)
    expect(activeEn).toEqual([
      'Blessed Hammer Damage',
      'Skill Base Damage: 312~316',
      'Synergy Bonus: +560% (→ 2059~2085)',
      'Spell Bonus (+225%): Mastery +0% + Equip +0% + Aura +225%',
      'Formula: ⌊312~316 × (1+560%)⌋ × (1+225%) = 6691~6776',
    ])
  })

  it('Issue #1624: Assassin elemental martial arts (#259 Fists of Fire, #269 Claws of Thunder, #274 Blades of Ice) are not multiplied by Claw Mastery (#252) physical %ED', () => {
    const assState = createInitialState('ass')
    assState.hardPoints[252] = 20 // Claw Mastery Lv20 (+106% physical claw ED)
    assState.hardPoints[259] = 20 // Fists of Fire Lv20
    assState.hardPoints[269] = 20 // Claws of Thunder Lv20
    assState.hardPoints[274] = 20 // Blades of Ice Lv20

    for (const skillId of [259, 269, 274]) {
      const def = SKILLS_BY_ID[skillId]!
      const dmg = calculateDetailedDamage(assState, def, 20)
      expect(dmg.masteryBonusPct).toBe(0)
      expect(dmg.masteryMultiplier).toBe(1)
      expect(dmg.finalMin).toBe(dmg.withSynergyMin)
      expect(dmg.finalMax).toBe(dmg.withSynergyMax)
    }

    // Character Sheet weapon skill elemental bonus for Fists of Fire (#259) must not include Claw Mastery (#252)
    const world = new ClientWorld()
    world.selfId = 1
    ;(world.self as any).charClass = 6 // Assassin ('ass')
    ;(world.self as any).level = 60
    ;(world.self as any).leftSkill = 259 // Fists of Fire
    ;(world.self as any).stats.set(0, 50)
    ;(world.self as any).stats.set(2, 50)
    ;(world.self as any).skillEntries.set(259, { skillId: 259, level: 10, baseLevel: 10, bonus: 0 })
    ;(world.self as any).skillEntries.set(252, { skillId: 252, level: 20, baseLevel: 20, bonus: 0 })

    const katar = {
      id: 2001,
      code: 'ktr',
      name: 'Katar',
      quality: 2,
      identified: true,
      bodyLoc: 4,
      equippedSlot: 4,
      container: 'equipped',
      stats: [],
      runewordStats: [],
      setBonusStats: [],
      flags: { identified: true },
    } as any
    ;(world.containers.equipment as Map<number, any>).set(2001, katar)
    ;(world.containers.equipmentBySlot as Map<number, any>).set(4, katar)

    const hud = new HudManager()
    const model = new HudModel({ world, hudManager: hud })
    model.syncFromWorld()

    const fofDmg10 = calculateDetailedDamage(createInitialState('ass'), SKILLS_BY_ID[259]!, 10)
    const leftFormula = hud.charSheet.attrs.leftDamageFormula!
    expect(leftFormula.kind).toBe('weapon')
    expect(leftFormula.skillElemMin).toBe(fofDmg10.withSynergyMin)
    expect(leftFormula.skillElemMax).toBe(fofDmg10.withSynergyMax)
    // Meanwhile, physical claw weapon damage DOES receive Claw Mastery (35 + 4*19 = +111% ED at Lv20)
    expect(leftFormula.masteryEdPct).toBe(111)
  })

  it('Issue #1624: Sorceress weapon elemental skill (#52 Enchant) includes soft points on Fire Mastery (#61) in hud-world-sync', () => {
    const world = new ClientWorld()
    world.selfId = 1
    ;(world.self as any).charClass = 1 // Sorceress ('sor')
    ;(world.self as any).level = 60
    ;(world.self as any).leftSkill = 52 // Enchant (weapon-flagged elemental skill with eType='fire')
    ;(world.self as any).skillEntries.set(52, { skillId: 52, level: 20, baseLevel: 20, bonus: 0 })
    // Fire Mastery (#61): 10 hard + 10 soft = effective Lv20 (+163% fire mastery)
    ;(world.self as any).skillEntries.set(61, { skillId: 61, level: 20, baseLevel: 10, bonus: 10 })

    const hud = new HudManager()
    const model = new HudModel({ world, hudManager: hud })
    model.syncFromWorld()

    const enchantBase = calculateDetailedDamage(createInitialState('sor'), SKILLS_BY_ID[52]!, 20)
    const leftFormula = hud.charSheet.attrs.leftDamageFormula!
    // Effective Lv20 Fire Mastery = +163% (not Lv10 = +93%)
    expect(leftFormula.skillElemMin).toBe(Math.floor((enchantBase.withSynergyMin * 263) / 100))
    expect(leftFormula.skillElemMax).toBe(Math.floor((enchantBase.withSynergyMax * 263) / 100))
  })

  it('Issue #1624: evaluateSkillEffects supports descline 48 (Blessed Hammer #112) and descline 47 (Holy Bolt #101 heal range)', () => {
    const palState = createInitialState('pal')
    palState.hardPoints[112] = 20
    palState.hardPoints[115] = 20
    palState.hardPoints[108] = 20
    palState.hardPoints[113] = 20

    const bhEffects = evaluateSkillEffects(palState, SKILLS_BY_ID[112]!, 29)
    const line48 = bhEffects.find((e) => e.lineType === 48)
    expect(line48).toBeDefined()
    expect(line48?.textEn).toBe('Magic Damage: 2059-2085')
    expect(line48?.textZh).toBe('魔法傷害：2059 - 2085')

    const hbEffects = evaluateSkillEffects(palState, SKILLS_BY_ID[101]!, 10)
    const line47 = hbEffects.find((e) => e.lineType === 47)
    expect(line47).toBeDefined()
    expect(line47?.textEn).toMatch(/^Heals: \d+-\d+$/)
    expect(line47?.textZh).toMatch(/^治療：\d+ - \d+$/)
  })
})
