import { describe, expect, it } from 'vitest'

/**
 * Enhancement: a display-only Speedbar row for equipment-granted skills the 1.13c Speedbar never lists.
 * - Item auras (`item_aura`, stat 151): same-aura grants from several items stack, and `+All Skills` never raises them.
 * - Non-class passives (`item_nonclassskill`, stat 97): level includes equipment / state `+All Skills`.
 * - The row can never be selected or bound to an F-key.
 */
describe('Speedbar granted row: item auras and non-class item passives', { timeout: 60_000 }, () => {
  const CONVICTION = 123
  const CRITICAL_STRIKE = 9 // Amazon passive, non-class for a Sorceress
  const WARMTH = 37 // Sorceress passive (own class: never listed in the granted row)

  async function setup(opts: { battleCommand?: boolean } = {}) {
    const { ClientWorld } = await import('../../src/client/world/client-world.ts')
    const { HudManager } = await import('../../src/client/ui/hud-manager.ts')
    const { HudModel } = await import('../../src/client/ui-model/hud-model.ts')

    const world = new ClientWorld()
    world.self.unitId = 1
    world.self.charClass = 1 // Sorceress
    world.self.level = 80
    world.self.weaponSet = 0
    if (opts.battleCommand) (world.self.states as Set<number>).add(51)
    const eq = world.containers.equipment as Map<number, any>
    const item = (id: number, code: string, bodyLoc: number, stats: { statId: number; param: number; value: number }[]) => ({
      id,
      code,
      name: `Item ${id}`,
      quality: 4,
      identified: true,
      location: 1,
      bodyLoc,
      equippedSlot: bodyLoc,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      stats,
    })
    // Two Conviction auras (12 + 10) stack to 22; the amulet's +2 All Skills must not raise it.
    eq.set(9001, item(9001, 'rin', 6, [{ statId: 151, param: CONVICTION, value: 12 }]))
    eq.set(9002, item(9002, 'rin', 7, [{ statId: 151, param: CONVICTION, value: 10 }]))
    eq.set(
      9003,
      item(9003, 'amu', 2, [
        { statId: 127, param: 0, value: 2 },
        { statId: 97, param: CRITICAL_STRIKE, value: 3 },
        { statId: 97, param: WARMTH, value: 2 },
      ]),
    )
    const hudManager = new HudManager()
    const hudModel = new HudModel({ world, hudManager })
    hudModel.syncFromWorld()
    return { world, hudManager, hudModel }
  }

  it('lists stacked item auras at the item level only and non-class passives with +All Skills', async () => {
    const { hudManager } = await setup()
    const granted = hudManager.hotkeys.grantedSkills
    const aura = granted.find(g => g.skillId === CONVICTION)
    const passive = granted.find(g => g.skillId === CRITICAL_STRIKE)
    expect(aura).toMatchObject({ kind: 'item-aura', level: 22 })
    expect(passive).toMatchObject({ kind: 'item-passive', level: 3 + 2 })
    // Own-class passive granted by an oskill is not part of the granted row.
    expect(granted.some(g => g.skillId === WARMTH)).toBe(false)
    // Auras come first.
    expect(granted[0]!.kind).toBe('item-aura')
    // None of them become selectable Speedbar entries.
    expect(hudManager.hotkeys.availableSkills.some(s => s.skillId === CONVICTION || s.skillId === CRITICAL_STRIKE)).toBe(false)
  })

  it('adds state +All Skills (Battle Command) to granted passives but not to item auras', async () => {
    const { hudManager } = await setup({ battleCommand: true })
    const granted = hudManager.hotkeys.grantedSkills
    expect(granted.find(g => g.skillId === CONVICTION)?.level).toBe(22)
    expect(granted.find(g => g.skillId === CRITICAL_STRIKE)?.level).toBe(3 + 2 + 1)
  })

  it('draws the row above the topmost Speedbar row, swallows clicks and never binds an F-key', async () => {
    const { hudManager } = await setup()
    const hk = hudManager.hotkeys
    hk.openSpeedbar('right')
    const normal = hk.getPopupCells('right')
    const grantedCells = hk.getGrantedPopupCells('right')
    expect(grantedCells.map(c => c.granted.skillId)).toEqual(hk.grantedSkills.map(g => g.skillId))
    const topNormalRow = normal.reduce((m, c) => Math.max(m, c.visualRow), -1)
    for (const c of grantedCells) {
      expect(c.visualRow).toBe(topNormalRow + 1)
      for (const n of normal) expect(c.y).toBeLessThan(n.y)
    }

    const target = grantedCells.find(c => c.granted.skillId === CRITICAL_STRIKE)!
    hk.handleMouseMove(target.x + 10, target.y + 10)
    expect(hk.hoveredGrantedSkill).toMatchObject({ skillId: CRITICAL_STRIKE, kind: 'item-passive' })
    expect(hk.hoveredPopupSkill).toBeNull()

    const selected: number[] = []
    hk.onSelectSkill = (_side, skillId) => {
      selected.push(skillId)
    }
    expect(hk.triggerFunctionKey('F1')).toBeNull()
    expect(hk.bindings.has('F1')).toBe(false)
    expect(hk.handleClick(target.x + 10, target.y + 10)).toBe(true)
    expect(hk.openPopup).toBe('right')
    expect(selected).toEqual([])

    const lines = hk
      .formatTooltipLines(CRITICAL_STRIKE, 'right', true, 'CHI', undefined, target.granted)
      .map(l => l.text)
    expect(lines).toContain('不可设置快捷键')
    expect(lines.some(l => l.includes('装备赋予被动技能') && l.includes('5'))).toBe(true)
    expect(lines.some(l => l.includes('5') && l !== lines[1])).toBe(true)

    const auraCell = grantedCells.find(c => c.granted.skillId === CONVICTION)!
    const auraLines = hk
      .formatTooltipLines(CONVICTION, 'right', true, 'ENG', undefined, auraCell.granted)
      .map(l => l.text)
    expect(auraLines).toContain('Cannot be assigned to a hotkey')
    expect(auraLines.some(l => l.includes('Item Aura (Level 22'))).toBe(true)
    // Current level line reflects the stacked aura level.
    expect(auraLines.some(l => /22$/.test(l))).toBe(true)
  })
})
