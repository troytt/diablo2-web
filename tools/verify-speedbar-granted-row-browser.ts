#!/usr/bin/env npx tsx
/**
 * Speedbar granted-skills row browser check (enhancement): equipment `item_aura` (stat 151) auras and non-class
 * `item_nonclassskill` (stat 97) passives are shown in a display-only row above the Speedbar rows.
 * Two Conviction items stack (12 + 10 = 22) and +All Skills never raises the aura; the non-class passive gets
 * +All Skills. Hovering a granted cell shows its level / data tooltip and F1 never binds it. Screenshots at
 * 800x600 and 1280x720 go to `scratch/verify-speedbar-granted-row/`.
 */

import { assert, withPlayHarness } from './play-cdp-harness.ts'

const CONVICTION = 123

const SETUP = `(() => {
  const app = window.__d2Play
  const world = app.session.world
  const passive = world.self.charClass === 0 ? 37 : 9 // non-class passive: Warmth for an Amazon, else Critical Strike
  const eq = world.containers.equipment
  const mk = (id, code, bodyLoc, stats) => ({ id, code, name: 'Item ' + id, quality: 4, identified: true, location: 1,
    bodyLoc, equippedSlot: bodyLoc, x: 0, y: 0, width: 1, height: 1, stats })
  eq.set(0x7b001, mk(0x7b001, 'rin', 6, [{ statId: 151, param: ${CONVICTION}, value: 12 }]))
  eq.set(0x7b002, mk(0x7b002, 'rin', 7, [{ statId: 151, param: ${CONVICTION}, value: 10 }]))
  eq.set(0x7b003, mk(0x7b003, 'amu', 2, [{ statId: 127, param: 0, value: 2 }, { statId: 97, param: passive, value: 3 }]))
  app.hudModel.syncFromWorld()
  const hk = app.hudManager.hotkeys
  hk.openSpeedbar('right')
  return { passive, granted: hk.grantedSkills.map((g) => ({ skillId: g.skillId, level: g.level, kind: g.kind })) }
})()`

function hoverGranted(skillId: number): string {
  return `(() => {
    const hk = window.__d2Play.hudManager.hotkeys
    hk.openSpeedbar('right')
    const cell = hk.getGrantedPopupCells('right').find((c) => c.granted.skillId === ${skillId})
    if (!cell) return null
    hk.handleMouseMove(cell.x + 20, cell.y + 20)
    const before = hk.bindings.get('F1') ?? null
    hk.triggerFunctionKey('F1')
    const after = hk.bindings.get('F1') ?? null
    const lines = hk.formatTooltipLines(${skillId}, 'right', true, hk.lang, undefined, cell.granted).map((l) => l.text)
    const top = hk.getPopupCells('right').reduce((m, c) => Math.max(m, c.visualRow), -1)
    return { hovered: hk.hoveredGrantedSkill, bindingUnchanged: JSON.stringify(before) === JSON.stringify(after),
      lines, rowAbove: cell.visualRow === top + 1 }
  })()`
}

await withPlayHarness('verify-speedbar-granted-row', async (h) => {
  const setup = await h.cdp.evaluate<{ passive: number; granted: { skillId: number; level: number; kind: string }[] }>(SETUP)
  console.log('[granted] row', JSON.stringify(setup))
  const aura = setup.granted.find((g) => g.skillId === CONVICTION)
  const passive = setup.granted.find((g) => g.skillId === setup.passive)
  assert(aura?.kind === 'item-aura' && aura.level === 22, 'Conviction 12 + 10 stacks to 22 and ignores +2 All Skills')
  assert(passive?.kind === 'item-passive' && passive.level >= 5, 'non-class passive = 3 oskill + 2 All Skills (+ state bonuses)')

  for (const [name, id] of [['aura', CONVICTION], ['passive', setup.passive]] as const) {
    const r = await h.cdp.evaluate<{
      hovered: { skillId: number } | null
      bindingUnchanged: boolean
      lines: string[]
      rowAbove: boolean
    } | null>(hoverGranted(id))
    console.log(`[granted] ${name}`, JSON.stringify(r))
    assert(r && r.hovered?.skillId === id, `${name}: granted cell hovered`)
    assert(r.bindingUnchanged, `${name}: F1 over the granted row never binds`)
    assert(r.rowAbove, `${name}: granted row sits above the topmost Speedbar row`)
    assert(r.lines.some((l) => l.includes('不可设置快捷键') || l.includes('Cannot be assigned to a hotkey')), `${name}: no-hotkey line`)
    await h.cdp.evaluate(`(() => { const hk = window.__d2Play.hudManager.hotkeys; hk.openSpeedbar('right'); const c = hk.getGrantedPopupCells('right').find((x) => x.granted.skillId === ${id}); hk.handleMouseMove(c.x + 20, c.y + 20); return true })()`)
    console.log(await h.shootBoth(`granted-${name}`))
  }
  console.log('[granted] OK')
})
