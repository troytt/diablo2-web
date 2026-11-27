import { describe, expect, it, vi } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { formatCharacterDamageTooltipLines } from '../src/client/ui/character-sheet.ts'

function setupPlayerWithSkills(
  charClass: number,
  leftSkillId: number,
  rightSkillId: number,
  skillLevel = 1,
) {
  const world = new ClientWorld()
  world.selfId = 1
  world.areaId = 1
  ;(world.self as any).charClass = charClass
  ;(world.self as any).level = 30
  ;(world.self as any).leftSkill = leftSkillId
  ;(world.self as any).rightSkill = rightSkillId
  ;(world.self as any).stats.set(0, 80) // Str
  ;(world.self as any).stats.set(2, 80) // Dex
  ;(world.self as any).stats.set(12, 30) // Level

  for (const id of [0, leftSkillId, rightSkillId]) {
    const lvl = id === 0 ? 1 : skillLevel
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
  return world
}

function equipWeapon(
  world: ClientWorld,
  slot: 4 | 5,
  code: string,
  name: string,
  extraStats: Array<{ statId: number; value: number; param?: number }> = [],
) {
  const rawContainers = world.containers as unknown as {
    equipment: Map<number, any>
    equipmentBySlot: Map<number, any>
  }
  const item = {
    id: 1000 + slot,
    code,
    name,
    quality: 2,
    identified: true,
    bodyLoc: slot,
    stats: extraStats,
    runewordStats: [],
    setBonusStats: [],
    flags: { identified: true },
  }
  rawContainers.equipment.set(item.id, item)
  rawContainers.equipmentBySlot.set(slot, item)
}

describe('Character Sheet Dual-Wield & Multi-Component Skill Damage Audit (D2Client.dll 0x6FADD3C0 / 0x6FBA5210)', () => {
  it('Category 1: Double Throw (#140) displays both throwing weapons separately (damage & AR) on 2 stacked lines and in formula tooltip', () => {
    // Barbarian (charClass = 4) dual-wielding two different throwing weapons with Double Throw (#140)
    const world = setupPlayerWithSkills(4, 140, 133, 5)
    // Right arm (slot 4): Javelin (throw 6-14) + +50 Attack Rating (stat 19)
    equipWeapon(world, 4, 'jav', 'Javelin', [{ statId: 19, value: 50 }])
    // Left arm (slot 5): Balanced Knife (throw 6-11) + +10-20 Fire Damage (stats 48, 49) + +120 Attack Rating (stat 19)
    equipWeapon(world, 5, 'bkf', 'Balanced Knife', [
      { statId: 48, value: 10 },
      { statId: 49, value: 20 },
      { statId: 19, value: 120 },
    ])

    const hud = new HudManager()
    const hudModel = new HudModel({ world, hudManager: hud })
    hudModel.syncFromWorld()

    const attrs = hud.charSheet.attrs
    // Left skill (#140 Double Throw) must have distinct top & bottom weapon damage lines
    expect(attrs.leftSkillDmgTop).toBeDefined()
    expect(attrs.leftSkillDmgBottom).toBeDefined()
    expect(attrs.leftSkillDmgTop).not.toBe(attrs.leftSkillDmgBottom)

    // Attack Rating must also show both weapons separately
    expect(attrs.leftARTop).toBeDefined()
    expect(attrs.leftARBottom).toBeDefined()
    expect(attrs.leftARTop).not.toBe(attrs.leftARBottom)

    // Right skill (#133 Double Swing) also dual-wields both weapons in melee mode
    expect(attrs.rightSkillDmgTop).toBeDefined()
    expect(attrs.rightSkillDmgBottom).toBeDefined()
    expect(attrs.rightARTop).toBeDefined()
    expect(attrs.rightARBottom).toBeDefined()

    // Tooltip formula breakdown must include both Primary Weapon and Secondary Weapon sections
    const zhLines = formatCharacterDamageTooltipLines('left', attrs, 'CHI').map((l) => l.text)
    expect(zhLines.some((line) => line.includes('主手武器伤害:'))).toBe(true)
    expect(zhLines.some((line) => line.includes('副手武器伤害:'))).toBe(true)

    const enLines = formatCharacterDamageTooltipLines('left', attrs, 'ENG').map((l) => l.text)
    expect(enLines.some((line) => line.includes('Primary Weapon Damage:'))).toBe(true)
    expect(enLines.some((line) => line.includes('Secondary Weapon Damage:'))).toBe(true)

    // Verify CharacterSheetPanel.draw() renders 2 stacked lines for damage (oy+90, oy+100) and AR (oy+148, oy+158)
    hud.charSheet.visible = true
    const drawCalls: Array<{ text: string; x: number; y: number }> = []
    const mockFont = {
      drawText: vi.fn((_ctx: any, text: string, x: number, y: number) => {
        drawCalls.push({ text, x, y })
      }),
      measureText: vi.fn(() => 40),
    } as any
    const mockCtx = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    } as any
    hud.charSheet.draw(
      mockCtx,
      {
        hp: 100,
        maxHp: 100,
        mana: 50,
        maxMana: 50,
        stamina: 100,
        maxStamina: 100,
        leftSkillDmg: attrs.leftSkillDmg ?? '1-2',
        rightSkillDmg: attrs.rightSkillDmg ?? '1-2',
      },
      { borderLeftImg: null, charSheetImg: null, buySellBtnImg: null },
      mockFont,
      true,
    )

    // CHAR_PANEL_ORIGIN is (80, 60) -> ox + 288 = 368, oy + 90 = 150, oy + 100 = 160
    expect(drawCalls.some((c) => c.text === attrs.leftSkillDmgTop && c.x === 368 && c.y === 150)).toBe(true)
    expect(drawCalls.some((c) => c.text === attrs.leftSkillDmgBottom && c.x === 368 && c.y === 160)).toBe(true)
    // Left AR stacked at ox + 290 = 370, oy + 148 = 208, oy + 158 = 218
    expect(drawCalls.some((c) => c.text === String(attrs.leftARTop) && c.x === 370 && c.y === 208)).toBe(true)
    expect(drawCalls.some((c) => c.text === String(attrs.leftARBottom) && c.x === 370 && c.y === 218)).toBe(true)
  })

  it('Category 1: Assassin Dragon Claw (#260) and Claws of Thunder (#269) display both claws separately when dual-wielding', () => {
    // Assassin (charClass = 6) dual-wielding two Katars ('ktr' and 'wrb')
    const world = setupPlayerWithSkills(6, 260, 269, 5)
    equipWeapon(world, 4, 'ktr', 'Katar')
    equipWeapon(world, 5, 'wrb', 'Wrist Blade', [{ statId: 50, value: 5 }, { statId: 51, value: 30 }])

    const hud = new HudManager()
    const hudModel = new HudModel({ world, hudManager: hud })
    hudModel.syncFromWorld()

    const attrs = hud.charSheet.attrs
    expect(attrs.leftSkillDmgTop).toBeDefined()
    expect(attrs.leftSkillDmgBottom).toBeDefined()
    expect(attrs.leftSkillDmgTop).not.toBe(attrs.leftSkillDmgBottom)
    expect(attrs.rightSkillDmgTop).toBeDefined()
    expect(attrs.rightSkillDmgBottom).toBeDefined()
  })

  it('Category 2: Charged Strike (#24) and Lightning Strike (#34) display bolt/chain lightning on top and weapon melee hit on bottom (descdam = 17)', () => {
    // Amazon (charClass = 0) with Javelin ('jav': melee 1-5, throw 6-14)
    const world = setupPlayerWithSkills(0, 24, 0, 1)
    equipWeapon(world, 4, 'jav', 'Javelin')

    const hud = new HudManager()
    const hudModel = new HudModel({ world, hudManager: hud })
    hudModel.syncFromWorld()

    const attrs = hud.charSheet.attrs
    // Charged Strike (#24) lv1 (no synergies): Charged Bolt damage is 1-30 on top, melee weapon hit on bottom
    expect(attrs.leftSkillDmgTop).toBe(`${attrs.leftDamageFormula?.skillElemMin}-${attrs.leftDamageFormula?.skillElemMax}`)
    expect(attrs.leftSkillDmgBottom).toBe(`${attrs.leftDamageFormula?.physMin}-${attrs.leftDamageFormula?.physMax}`)
    expect(attrs.leftDamageFormula?.multiComponentOrder).toBe('elem-first')

    // Formula breakdown tooltip shows both Weapon Hit Damage and Attached Skill Damage
    const zhLines = formatCharacterDamageTooltipLines('left', attrs, 'CHI').map((l) => l.text)
    expect(zhLines.some((line) => line.includes('武器命中伤害:'))).toBe(true)
    expect(zhLines.some((line) => line.includes('附带技能伤害:'))).toBe(true)

    const enLines = formatCharacterDamageTooltipLines('left', attrs, 'ENG').map((l) => l.text)
    expect(enLines.some((line) => line.includes('Weapon Hit Damage:'))).toBe(true)
    expect(enLines.some((line) => line.includes('Attached Skill Damage:'))).toBe(true)
  })

  it('Category 2: Lightning Fury (#35) and Plague Javelin (#25) use throw weapon damage on top and bolt/poison cloud damage on bottom (descdam = 22)', () => {
    // Amazon (charClass = 0) with Javelin ('jav': melee 1-5, throw 6-14)
    const world = setupPlayerWithSkills(0, 35, 25, 1)
    equipWeapon(world, 4, 'jav', 'Javelin')

    const hud = new HudManager()
    const hudModel = new HudModel({ world, hudManager: hud })
    hudModel.syncFromWorld()

    const attrs = hud.charSheet.attrs
    // Javelin throw base is 6-14 (much higher than melee 1-5)
    expect(attrs.leftDamageFormula?.weaponMin).toBe(6)
    expect(attrs.leftDamageFormula?.weaponMax).toBe(14)
    // Lightning Fury (#35) lv1: Top = throw weapon hit, Bottom = 1-40 bolt lightning
    expect(attrs.leftSkillDmgTop).toBe(`${attrs.leftDamageFormula?.physMin}-${attrs.leftDamageFormula?.physMax}`)
    expect(attrs.leftSkillDmgBottom).toBe('1-40')

    // Plague Javelin (#25) lv1: Top = throw weapon hit, Bottom = poison cloud damage
    expect(attrs.rightDamageFormula?.weaponMin).toBe(6)
    expect(attrs.rightDamageFormula?.weaponMax).toBe(14)
    expect(attrs.rightSkillDmgTop).toBe(`${attrs.rightDamageFormula?.physMin}-${attrs.rightDamageFormula?.physMax}`)
    expect(attrs.rightSkillDmgBottom).toBe(`${attrs.rightDamageFormula?.skillElemMin}-${attrs.rightDamageFormula?.skillElemMax}`)
  })

  it('Category 2: Exploding Arrow (#16) and Freezing Arrow (#31) split arrow hit and explosion damage (descdam = 6)', () => {
    const world = setupPlayerWithSkills(0, 16, 31, 1)
    equipWeapon(world, 4, 'sbw', 'Short Bow')

    const hud = new HudManager()
    const hudModel = new HudModel({ world, hudManager: hud })
    hudModel.syncFromWorld()

    const attrs = hud.charSheet.attrs
    // Exploding Arrow (#16) lv1: fire explosion 2-6 on bottom, arrow hit on top
    expect(attrs.leftSkillDmgTop).toBe(`${attrs.leftDamageFormula?.physMin}-${attrs.leftDamageFormula?.physMax}`)
    expect(attrs.leftSkillDmgBottom).toBe('2-6')

    // Freezing Arrow (#31) lv1: cold explosion 40-50 on bottom, arrow hit on top
    expect(attrs.rightSkillDmgTop).toBe(`${attrs.rightDamageFormula?.physMin}-${attrs.rightDamageFormula?.physMax}`)
    expect(attrs.rightSkillDmgBottom).toBe('40-50')
  })

  it('Lightning Bolt (#20, descdam = 21) uses 3/4 throw weapon damage converted 100% to lightning + skill lightning damage', () => {
    const world = setupPlayerWithSkills(0, 20, 0, 1)
    equipWeapon(world, 4, 'jav', 'Javelin')

    const hud = new HudManager()
    const hudModel = new HudModel({ world, hudManager: hud })
    hudModel.syncFromWorld()

    const attrs = hud.charSheet.attrs
    const formula = attrs.leftDamageFormula!
    // Uses throw damage (6-14)
    expect(formula.weaponMin).toBe(6)
    expect(formula.weaponMax).toBe(14)
    // 100% physical converted to lightning -> remaining physical is 0, lightning > skillElemMax (40)
    expect(formula.physMin).toBe(0)
    expect(formula.physMax).toBe(0)
    expect(formula.finalMax).toBeGreaterThan(40)
  })
})
