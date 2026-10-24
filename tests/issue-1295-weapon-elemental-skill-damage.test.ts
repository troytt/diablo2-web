import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'

function parseDamageRange(dmgText: string | undefined): [number, number] {
  const m = (dmgText ?? '').match(/(\d+)-(\d+)/)
  return m ? [Number(m[1]), Number(m[2])] : [0, 0]
}

function setSkill(world: ClientWorld, id: number, lvl: number): void {
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

function equipSlot4(world: ClientWorld, id: number, code: string, name: string): void {
  const rawContainers = world.containers as unknown as {
    equipment: Map<number, any>
    equipmentBySlot: Map<number, any>
  }
  const item = {
    id,
    code,
    name,
    quality: 2,
    identified: true,
    bodyLoc: 4,
    stats: [],
    runewordStats: [],
    setBonusStats: [],
    flags: { identified: true },
  }
  rawContainers.equipment.set(id, item)
  rawContainers.equipmentBySlot.set(4, item)
}

describe('Issue #1295: weapon elemental/poison skill damage & SrcDam in character-sheet combat stats', () => {
  it('adds Power Strike (#14) lightning damage and AR bonus on top of physical javelin damage', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 1
    ;(world.self as any).charClass = 0 // Amazon ('ama')
    ;(world.self as any).level = 20
    ;(world.self as any).leftSkill = 0 // Normal Attack
    ;(world.self as any).rightSkill = 14 // Power Strike
    ;(world.self as any).stats.set(0, 20) // Strength 20
    ;(world.self as any).stats.set(2, 25) // Dexterity 25
    ;(world.self as any).stats.set(12, 20) // Level 20
    setSkill(world, 0, 1)
    // Power Strike lvl 1: 1-16 lightning damage, +20% AR
    setSkill(world, 14, 1)

    // Equip a Javelin ('jav': 1H melee 1-5, throw 6-14) in right arm (slot 4)
    equipSlot4(world, 1001, 'jav', 'Javelin')

    const hud = new HudManager()
    const hudModel = new HudModel({ world, hudManager: hud })
    hudModel.syncFromWorld()
    const attrs = hud.charSheet.attrs

    const [normMin, normMax] = parseDamageRange(attrs.leftSkillDmg)
    const [psMin, psMax] = parseDamageRange(attrs.rightSkillDmg)

    // Power Strike lvl 1 adds +1-16 lightning damage on top of normal melee attack
    expect(psMin).toBe(normMin + 1)
    expect(psMax).toBe(normMax + 16)
    // Power Strike lvl 1 adds +20% AR over normal attack
    expect(attrs.rightAttackRating).toBeGreaterThan(attrs.attackRating ?? 0)

    // Add 10 hard points in Charged Strike (#24) -> +100% lightning synergy (2-32 lightning damage)
    setSkill(world, 24, 10)
    hudModel.syncFromWorld()
    const [psSynMin, psSynMax] = parseDamageRange(hud.charSheet.attrs.rightSkillDmg)
    expect(psSynMin).toBe(normMin + 2)
    expect(psSynMax).toBe(normMax + 32)
  })

  it('handles Amazon bow & javelin skills (#6 Magic Arrow, #7 Fire Arrow, #11 Cold Arrow, #12 Multiple Shot, #15 Poison Javelin, #20 Lightning Bolt, #26 Strafe, #30 Fend, #35 Lightning Fury)', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 1
    ;(world.self as any).charClass = 0 // Amazon
    ;(world.self as any).level = 30
    ;(world.self as any).stats.set(0, 50)
    ;(world.self as any).stats.set(2, 100) // Dexterity 100 -> +100% bow ED
    ;(world.self as any).stats.set(12, 30)

    // Equip Hunter's Bow ('hbw': 2-6 base damage)
    equipSlot4(world, 1002, 'hbw', "Hunter's Bow")

    setSkill(world, 0, 1)
    for (const id of [6, 7, 10, 11, 12, 15, 19, 20, 22, 26, 30, 31, 35]) {
      setSkill(world, id, 5)
    }

    const hud = new HudManager()
    const hudModel = new HudModel({ world, hudManager: hud })

    // Normal Attack (#0) vs Magic Arrow (#6, lvl 5: +5 flat phys) vs Multiple Shot (#12, srcDam=96 = 3/4)
    ;(world.self as any).leftSkill = 0
    ;(world.self as any).rightSkill = 6
    hudModel.syncFromWorld()
    const [bowNormMin, bowNormMax] = parseDamageRange(hud.charSheet.attrs.leftSkillDmg)
    const [magicArrMin, magicArrMax] = parseDamageRange(hud.charSheet.attrs.rightSkillDmg)
    // Hunter's Bow (2-6) with 100 Dex (+100% ED) -> 4-12; Magic Arrow lvl 5 adds +5 flat -> 9-17
    expect(bowNormMin).toBe(4)
    expect(bowNormMax).toBe(12)
    expect(magicArrMin).toBe(9)
    expect(magicArrMax).toBe(17)

    // Multiple Shot (#12): 3/4 weapon damage -> 3-9
    ;(world.self as any).rightSkill = 12
    hudModel.syncFromWorld()
    const [msMin, msMax] = parseDamageRange(hud.charSheet.attrs.rightSkillDmg)
    expect(msMin).toBe(3)
    expect(msMax).toBe(9)

    // Cold Arrow (#11, lvl 5: +11-12 cold damage)
    ;(world.self as any).rightSkill = 11
    hudModel.syncFromWorld()
    const [coldArrMin, coldArrMax] = parseDamageRange(hud.charSheet.attrs.rightSkillDmg)
    expect(coldArrMin).toBeGreaterThan(bowNormMin)
    expect(coldArrMax).toBeGreaterThan(bowNormMax)

    // Strafe (#26, lvl 5: +25% ED -> 2-6 * 2.25 = 4.5..13.5, then 3/4 SrcDam -> 3-10)
    ;(world.self as any).rightSkill = 26
    hudModel.syncFromWorld()
    const [strafeMin, strafeMax] = parseDamageRange(hud.charSheet.attrs.rightSkillDmg)
    expect(strafeMin).toBe(3)
    expect(strafeMax).toBe(10)
  })

  it('includes elemental/poison bonus damage for Druid (#238 Rabies, #239 Fire Claws) and Assassin (#259 Fists of Fire, #269 Claws of Thunder, #274 Blades of Ice, #280 Phoenix Strike)', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 1
    ;(world.self as any).charClass = 6 // Assassin ('ass')
    ;(world.self as any).level = 30
    ;(world.self as any).stats.set(0, 50)
    ;(world.self as any).stats.set(2, 50)
    ;(world.self as any).stats.set(12, 30)

    equipSlot4(world, 1003, 'ktr', 'Katar')

    setSkill(world, 0, 1)
    for (const id of [259, 269, 274, 280]) {
      setSkill(world, id, 5)
    }

    const hud = new HudManager()
    const hudModel = new HudModel({ world, hudManager: hud })

    ;(world.self as any).leftSkill = 0
    ;(world.self as any).rightSkill = 259 // Fists of Fire
    hudModel.syncFromWorld()
    const [normMin, normMax] = parseDamageRange(hud.charSheet.attrs.leftSkillDmg)
    const [fofMin, fofMax] = parseDamageRange(hud.charSheet.attrs.rightSkillDmg)
    expect(fofMin).toBeGreaterThan(normMin)
    expect(fofMax).toBeGreaterThan(normMax)

    for (const maId of [269, 274, 280]) {
      ;(world.self as any).rightSkill = maId
      hudModel.syncFromWorld()
      const [maMin, maMax] = parseDamageRange(hud.charSheet.attrs.rightSkillDmg)
      expect(maMin).toBeGreaterThan(normMin)
      expect(maMax).toBeGreaterThan(normMax)
    }

    // Druid Fire Claws (#239) and Rabies (#238)
    ;(world.self as any).charClass = 5 // Druid ('dru')
    setSkill(world, 238, 5)
    setSkill(world, 239, 5)
    for (const druId of [238, 239]) {
      ;(world.self as any).rightSkill = druId
      hudModel.syncFromWorld()
      const [druMin, druMax] = parseDamageRange(hud.charSheet.attrs.rightSkillDmg)
      expect(druMin).toBeGreaterThan(normMin)
      expect(druMax).toBeGreaterThan(normMax)
    }
  })
})
