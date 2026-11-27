#!/usr/bin/env npx tsx
/**
 * Issue #289 browser check: an item's charged skill and the player's own learned skill of the same id show up as two
 * separate Speedbar entries (charges only on the item copy), F-keys bound to each select the right owner, and
 * depleting the item's charges removes only the item copy while the learned skill's hotkey keeps working.
 * Replays the town fixture via `play-cdp-harness.ts`, then screenshots the open right Speedbar at 800x600 and
 * 1280x720 before and after depletion into `scratch/verify-charged-skill-split-289/`.
 */

import { assert, withPlayHarness } from './play-cdp-harness.ts'

const TELEPORT = 54
const RING_ID = 0x7a289

interface PageState {
  readonly entries: readonly { readonly itemId: number | null; readonly charges: number | null; readonly level: number | null }[]
  readonly f1: { readonly skillId: number; readonly itemId: number | null } | null
  readonly f2: { readonly skillId: number; readonly itemId: number | null } | null
}

function pageSetup(charges: number): string {
  return `(() => {
    const app = window.__d2Play
    const world = app.session.world
    const hud = app.hudManager
    world.self.skillEntries.set(${TELEPORT}, { skillId: ${TELEPORT}, skill: ${TELEPORT}, level: 12, baseLevel: 12, bonus: 0 })
    world.self.skills.set(${TELEPORT}, 12)
    world.containers.equipment.set(${RING_ID}, {
      id: ${RING_ID}, code: 'rin', name: 'Ring', quality: 4, identified: true, location: 1,
      bodyLoc: 6, equippedSlot: 6, x: 0, y: 0, width: 1, height: 1,
      stats: [{ statId: 204, param: (${TELEPORT} << 6) | 3, value: (11 << 8) | ${charges} }],
    })
    app.hudModel.syncFromWorld()
    hud.hotkeys.openSpeedbar('right')
    return true
  })()`
}

const PAGE_STATE = `(() => {
  const hk = window.__d2Play.hudManager.hotkeys
  const pick = (b) => (b ? { skillId: b.skillId, itemId: b.itemId ?? null } : null)
  const selected = []
  const prev = hk.onSelectSkill
  hk.onSelectSkill = (side, skillId, itemId) => { selected.push({ skillId, itemId: itemId ?? null }) }
  hk.triggerFunctionKey('F1')
  const f1 = selected.at(-1) ?? null
  hk.triggerFunctionKey('F2')
  const f2 = selected.at(-1) ?? null
  hk.onSelectSkill = prev
  return {
    entries: hk.availableSkills.filter((s) => s.skillId === ${TELEPORT}).map((s) => ({
      itemId: s.itemId ?? null, charges: s.charges ?? null, level: s.level ?? null,
    })),
    f1: pick(f1),
    f2: pick(f2),
  }
})()`

await withPlayHarness('verify-charged-skill-split-289', async (h) => {
  await h.cdp.evaluate(pageSetup(11))
  await h.cdp.evaluate(`(() => {
    const hk = window.__d2Play.hudManager.hotkeys
    hk.bindHotkey('F1', 'right', ${TELEPORT})
    hk.bindHotkey('F2', 'right', ${TELEPORT}, ${RING_ID})
    return true
  })()`)
  await h.tick(2)
  await h.cdp.evaluate(`(() => { window.__d2Play.hudManager.hotkeys.openSpeedbar('right'); return true })()`)
  console.log(await h.shootBoth('01-native-and-charged'))
  const before = await h.cdp.evaluate<PageState>(PAGE_STATE)
  console.log('[289] before depletion', JSON.stringify(before))
  assert(before.entries.length === 2, 'two Teleport entries (native + ring)')
  const native = before.entries.find((e) => e.itemId === null)
  const ring = before.entries.find((e) => e.itemId === RING_ID)
  assert(native && native.charges === null && native.level === 12, 'native entry has no charges and level 12')
  assert(ring && ring.charges === 11 && ring.level === 3, 'ring entry carries 11 charges at level 3')
  assert(before.f1?.itemId === null, 'F1 (native) selects the learned skill')
  assert(before.f2?.itemId === RING_ID, 'F2 (ring) selects the ring copy')

  await h.cdp.evaluate(pageSetup(0))
  await h.tick(2)
  await h.cdp.evaluate(`(() => { window.__d2Play.hudManager.hotkeys.openSpeedbar('right'); return true })()`)
  console.log(await h.shootBoth('02-ring-depleted'))
  const after = await h.cdp.evaluate<PageState>(PAGE_STATE)
  console.log('[289] after depletion', JSON.stringify(after))
  assert(after.entries.length === 1 && after.entries[0]?.itemId === null, 'only the native entry remains')
  assert(after.f1?.itemId === null, 'F1 still selects the learned skill')
  assert(after.f2?.skillId === TELEPORT && after.f2.itemId === null, 'F2 falls back to the learned skill')
  console.log('[289] OK')
})
