import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { formatCharacterDamageTooltipLines } from '../src/client/ui/character-sheet.ts'

describe('Issue #1296: Character-sheet damage formula tooltip includes weapon skill elemental bonus', () => {
  it('populates skillElemMin/Max in buildFormulaBreakdown and renders Skill Elemental line in CHI and ENG tooltips', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 1
    ;(world.self as any).charClass = 0 // Amazon ('ama')
    ;(world.self as any).level = 20
    ;(world.self as any).leftSkill = 0 // Attack
    ;(world.self as any).rightSkill = 14 // Power Strike
    ;(world.self as any).stats.set(0, 20)
    ;(world.self as any).stats.set(2, 25)
    ;(world.self as any).stats.set(12, 20)

    ;(world.self as any).skills.set(0, 1)
    ;(world.self as any).skills.set(14, 1)
    ;(world.self as any).skillEntries.set(14, {
      skillId: 14,
      baseLevel: 1,
      bonus: 0,
      level: 1,
      charges: 0,
      ownerType: 0,
      ownerId: 1,
    })

    const rawContainers = world.containers as unknown as {
      equipment: Map<number, any>
      equipmentBySlot: Map<number, any>
    }
    const javelin = {
      id: 1001,
      code: 'jav',
      name: 'Javelin',
      quality: 2,
      identified: true,
      bodyLoc: 4,
      stats: [],
      runewordStats: [],
      setBonusStats: [],
      flags: { identified: true },
    }
    rawContainers.equipment.set(1001, javelin)
    rawContainers.equipmentBySlot.set(4, javelin)

    const hud = new HudManager()
    const hudModel = new HudModel({ world, hudManager: hud })
    hudModel.syncFromWorld()

    const attrs = hud.charSheet.attrs
    const rightFormula = attrs.rightDamageFormula!
    expect(rightFormula).toBeDefined()
    expect(rightFormula.kind).toBe('weapon')
    expect(rightFormula.skillElemMin).toBe(1)
    expect(rightFormula.skillElemMax).toBe(16)
    expect(rightFormula.skillElemType).toBe('ltng')
    // Equipment lightning should remain 0 (not double-counted)
    expect(rightFormula.lightMin).toBe(0)
    expect(rightFormula.lightMax).toBe(0)
    expect(rightFormula.finalMin).toBe(rightFormula.physMin + 1)
    expect(rightFormula.finalMax).toBe(rightFormula.physMax + 16)

    const zhLines = formatCharacterDamageTooltipLines('right', attrs, 'CHI').map((l) => l.text)
    expect(zhLines.some((line) => line.includes('技能元素附加: +1-16'))).toBe(true)
    expect(zhLines[zhLines.length - 1]).toContain('+ (1-16)')
    expect(zhLines[zhLines.length - 1]).toContain(`= ${rightFormula.finalMin}~${rightFormula.finalMax}`)

    const enLines = formatCharacterDamageTooltipLines('right', attrs, 'ENG').map((l) => l.text)
    expect(enLines.some((line) => line.includes('Skill Elemental: +1-16'))).toBe(true)
    expect(enLines[enLines.length - 1]).toContain('+ (1-16)')
    expect(enLines[enLines.length - 1]).toContain(`= ${rightFormula.finalMin}~${rightFormula.finalMax}`)
  })
})
