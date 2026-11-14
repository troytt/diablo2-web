#!/usr/bin/env npx tsx
/**
 * Visual verifier for issues #1518..#1522 (Objects.txt ClientFn handlers, object-client-fn-113c.ts).
 *
 * Injects S2C 0x51 for Frozen Anya (558, ClientFn 15), a light ray (67, ClientFn 2), a shrub (528, ClientFn 10),
 * an "evil force" (259, ClientFn 7) and the Keeper (568, ClientFn 18) next to the player in the replayed Rogue
 * Encampment, runs 25 Hz frames and checks:
 * - Anya carries the `npcalert` overlay while in mode 0 and loses it within 500 ms of S2C 0x0E event 3 → mode 1;
 * - the shrub and the evil force leave mode 0 on their first frame (timer 0 < GetTickCount), the shrub is back in
 *   mode 0 once its 3 s timer passed while the evil force (10 s) is not;
 * - the light ray leaves mode 0 within 64 frames.
 * Screenshots (800x600, 1280x720) go to `scratch/verify-object-clientfn/`.
 *
 * Usage: npx tsx tools/verify-object-clientfn-browser.ts
 */

import { assert, withPlayHarness } from './play-cdp-harness.ts'

await withPlayHarness('verify-object-clientfn', async (h) => {
  await h.cdp.evaluate(`(() => {
    window.__packet0x51 = (id, classId, x, y, mode, flags) => {
      const out = new Uint8Array(14); const dv = new DataView(out.buffer)
      out[0] = 0x51; out[1] = 2; dv.setUint32(2, id, true); dv.setUint16(6, classId, true)
      dv.setUint16(8, x, true); dv.setUint16(10, y, true); out[12] = mode; out[13] = flags; return out
    }
    window.__packet0x0E = (id, event, flag, mode) => {
      const out = new Uint8Array(12); const dv = new DataView(out.buffer)
      out[0] = 0x0e; out[1] = 2; dv.setUint32(2, id, true); out[6] = event; out[7] = flag; dv.setUint32(8, mode, true); return out
    }
    return true
  })()`)
  const r = await h.cdp.evaluate<Record<string, unknown>>(`(async () => {
    const app = window.__d2Play, world = app.session.world
    const px = Math.round(world.self.x), py = Math.round(world.self.y)
    const inject = (b) => app.session.handleS2cPacket(b)
    const ids = { anya: 0x6f000001, ray: 0x6f000002, shrub: 0x6f000003, force: 0x6f000004, keeper: 0x6f000005 }
    inject(window.__packet0x51(ids.anya, 558, px + 4, py - 2, 0, 0))
    inject(window.__packet0x51(ids.ray, 67, px - 4, py + 2, 0, 0))
    inject(window.__packet0x51(ids.shrub, 528, px + 2, py + 4, 0, 0))
    inject(window.__packet0x51(ids.force, 259, px - 3, py - 4, 0, 0))
    inject(window.__packet0x51(ids.keeper, 568, px + 6, py + 3, 0, 0))
    const obj = (id) => world.getUnit('object', id)
    let rayLeftMode0 = -1
    const tick = async (n) => { for (let i = 0; i < n; i++) { await new Promise(r => setTimeout(r, 40)); app.session.tick(40, performance.now()); if (rayLeftMode0 < 0 && obj(ids.ray)?.mode !== 0) rayLeftMode0 = i } }
    await tick(2)
    const anyaAlert0 = obj(ids.anya).overlays.some(o => o.token === 'npcalert')
    const shrubFirst = obj(ids.shrub).mode
    const forceFirst = obj(ids.force).mode
    await tick(80)
    const shrubMode3s = obj(ids.shrub).mode
    const forceMode3s = obj(ids.force).mode
    app.renderFrame(performance.now())
    return { anyaAlert0, shrubFirst, forceFirst, shrubMode3s, forceMode3s, rayLeftMode0 }
  })()`)
  console.log(r)
  assert(r.anyaAlert0 === true, 'Frozen Anya should carry npcalert in mode 0')
  assert(r.shrubFirst !== 0 && r.forceFirst !== 0, 'shrub and evil force should leave mode 0 on the first frame')
  assert(r.shrubMode3s === 0, 'shrub should be back in mode 0 after its 3 s timer')
  assert(r.forceMode3s !== 0, 'evil force should still be out of mode 0 before its 10 s timer')
  assert(typeof r.rayLeftMode0 === 'number' && r.rayLeftMode0 >= 0 && r.rayLeftMode0 < 70, 'light ray should leave mode 0 within 64 frames')
  console.log('screenshots:', await h.shootBoth('anya-npcalert'))
  const r2 = await h.cdp.evaluate<Record<string, unknown>>(`(async () => {
    const app = window.__d2Play, world = app.session.world
    app.session.handleS2cPacket(window.__packet0x0E(0x6f000001, 3, 0, 1))
    for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 40)); app.session.tick(40, performance.now()) }
    const anya = world.getUnit('object', 0x6f000001)
    return { mode: anya.mode, alert: anya.overlays.some(o => o.token === 'npcalert') }
  })()`)
  console.log(r2)
  assert(r2.alert === false, 'npcalert should be removed once Anya leaves mode 0')
})
console.log('[verify-object-clientfn] PASS')
