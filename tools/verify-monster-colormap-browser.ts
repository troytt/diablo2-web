#!/usr/bin/env npx tsx
/**
 * Visual verifier for issues #1516 / #1517 (monster palette index → palshift.dat / RandTransforms.dat colormap).
 *
 * Injects S2C 0xAC for Fallen 1..5 (MonStats 19..23, token FA, TransLvl 0..4), a unique and a champion Fallen and
 * Andariel (156, Utrans 2/3/4) next to the player in the replayed Rogue Encampment, then checks each drawable's
 * palette row against `resolveMonsterPaletteIndex113c` / `resolveMonsterColormap113c` and screenshots the group at
 * 800x600 and 1280x720 into `scratch/verify-monster-colormap/`.
 *
 * Usage: npx tsx tools/verify-monster-colormap-browser.ts
 */

import { assert, withPlayHarness } from './play-cdp-harness.ts'

await withPlayHarness('verify-monster-colormap', async (h) => {
  const result = await h.cdp.evaluate<{ rows: { id: number; classId: number; paletteIndex: number | null; paletteRow: number | null; expectShift: boolean }[] }>(`(async () => {
    const app = window.__d2Play
    const world = app.session.world
    const px = Math.round(world.self.x), py = Math.round(world.self.y)
    const H = window.__unitsHarness
    const specs = [
      { id: 0x7f000001, classId: 19 }, { id: 0x7f000002, classId: 20 }, { id: 0x7f000003, classId: 21 },
      { id: 0x7f000004, classId: 22 }, { id: 0x7f000005, classId: 23 },
      { id: 0x7f000006, classId: 19, flags: 0x08, nameSeed: 0x1234, bossMods: [5] },
      { id: 0x7f000007, classId: 19, flags: 0x0c, nameSeed: 0x0077, bossMods: [5] },
      { id: 0x7f000008, classId: 156 },
    ]
    specs.forEach((s, i) => H.inject(H.packet0xAC({ ...s, x: px + 3 + (i % 4) * 3, y: py - 3 + Math.floor(i / 4) * 4 })))
    for (let i = 0; i < 25; i++) app.session.tick(40, performance.now())
    // Let the on-demand monster art finish loading.
    for (let i = 0; i < 60; i++) { app.renderFrame(performance.now()); await new Promise(r => setTimeout(r, 100)) }
    const { buildSceneDrawables } = await import('/src/client/view/unit-drawables.ts')
    const { resolveMonsterColormap113c } = await import('/src/common/units/monster-colormap-113c.ts')
    const scene = buildSceneDrawables(app.session.buildRenderableUnits(), { originX: 0, originY: 0, tick: 0 })
    const rows = specs.map(s => {
      const u = world.getUnit('monster', s.id)
      const d = scene.unitDrawables.find(x => x.id === s.id)
      const idx = u?.paletteIndex ?? null
      return { id: s.id, classId: s.classId, paletteIndex: idx, paletteRow: d?.paletteRow ?? null,
        expectShift: idx !== null && resolveMonsterColormap113c(s.classId, idx) !== null }
    })
    return { rows }
  })()`)
  console.table(result.rows)
  for (const r of result.rows) {
    assert(r.paletteIndex !== null, `unit ${String(r.id)} has no palette index`)
    if (r.expectShift) assert((r.paletteRow ?? 0) >= 17, `unit ${String(r.id)} should draw through an extra colormap row`)
    else assert((r.paletteRow ?? 0) === 0, `unit ${String(r.id)} should draw without colormap`)
  }
  const fallen = result.rows.slice(0, 5).map((r) => r.paletteIndex)
  assert(JSON.stringify(fallen) === JSON.stringify([2, 3, 4, 5, 6]), `Fallen 1..5 palette indices ${JSON.stringify(fallen)}`)
  console.log('screenshots:', await h.shootBoth('fallen-variants'))
})
console.log('[verify-monster-colormap] PASS')
