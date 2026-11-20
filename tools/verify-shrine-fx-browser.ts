#!/usr/bin/env npx tsx
/**
 * Visual verifier for issues #1523 / #1527 (shrine operate fx, shrine-operate-fx-113c.ts).
 *
 * Injects S2C 0x51 shrines next to the player in the replayed Rogue Encampment (fire = code 19, exploding = 21,
 * Enirhs = 16 in byte 13), then S2C 0x0E event 0x15 with the local player as `pkt[7]`, and checks that the fire
 * shrine spawns 16 `fireball` missiles, the exploding shrine 6 `explosivepotion` missiles, and Enirhs reverses the
 * player name. Screenshots (800x600, 1280x720) go to `scratch/verify-shrine-fx/`.
 *
 * Usage: npx tsx tools/verify-shrine-fx-browser.ts
 */

import { assert, withPlayHarness } from './play-cdp-harness.ts'

await withPlayHarness('verify-shrine-fx', async (h) => {
  const r = await h.cdp.evaluate<Record<string, unknown>>(`(async () => {
    const p51 = (id, classId, x, y, mode, flags) => {
      const out = new Uint8Array(14); const dv = new DataView(out.buffer)
      out[0] = 0x51; out[1] = 2; dv.setUint32(2, id, true); dv.setUint16(6, classId, true)
      dv.setUint16(8, x, true); dv.setUint16(10, y, true); out[12] = mode; out[13] = flags; return out
    }
    const p0e = (id, event, flag, mode) => {
      const out = new Uint8Array(12); const dv = new DataView(out.buffer)
      out[0] = 0x0e; out[1] = 2; dv.setUint32(2, id, true); out[6] = event; out[7] = flag; dv.setUint32(8, mode, true); return out
    }
    const app = window.__d2Play, world = app.session.world
    const px = Math.round(world.self.x), py = Math.round(world.self.y)
    const inject = (b) => app.session.handleS2cPacket(b)
    const missiles = () => { const c = {}; for (const u of world.units.values()) if (u.unitType === 'missile') c[u.missileKey ?? u.classId] = (c[u.missileKey ?? u.classId] ?? 0) + 1; return c }
    const tick = async (n) => { for (let i = 0; i < n; i++) { await new Promise(r => setTimeout(r, 40)); app.session.tick(40, performance.now()) } }
    const before = missiles()
    let spawned = 0
    const origSpawn = world.spawnMissileByKey.bind(world)
    world.spawnMissileByKey = (...a) => { spawned++; return origSpawn(...a) }
    inject(p51(0x6f000011, 2, px + 6, py - 6, 0, 19))
    const shrine = world.getUnit('object', 0x6f000011)
    const diag = { shrine: shrine ? { it: shrine.interactType, flags: shrine.flags, cls: shrine.classId } : null, selfUnit: !!world.getUnit('player', world.selfId) }
    let err = null
    try { inject(p0e(0x6f000011, 0x15, world.selfId, 0)) } catch (e) { err = String(e) }
    // S2C 0x0E is queued on the unit until its 25 Hz tick (0x6fb5c630 / 0x6fb5bc20).
    await tick(1)
    const afterFire = missiles()
    diag.spawned = spawned; diag.err = err
    await tick(4)
    app.renderFrame(performance.now())
    return { px, py, selfId: world.selfId, before, afterFire, name: world.self.name, diag }
  })()`)
  console.log(JSON.stringify(r))
  console.log('screenshots:', await h.shootBoth('fire-shrine'))
  const r2 = await h.cdp.evaluate<Record<string, unknown>>(`(async () => {
    const app = window.__d2Play, world = app.session.world
    const p51 = (id, classId, x, y, mode, flags) => {
      const out = new Uint8Array(14); const dv = new DataView(out.buffer)
      out[0] = 0x51; out[1] = 2; dv.setUint32(2, id, true); dv.setUint16(6, classId, true)
      dv.setUint16(8, x, true); dv.setUint16(10, y, true); out[12] = mode; out[13] = flags; return out
    }
    const p0e = (id, event, flag, mode) => {
      const out = new Uint8Array(12); const dv = new DataView(out.buffer)
      out[0] = 0x0e; out[1] = 2; dv.setUint32(2, id, true); out[6] = event; out[7] = flag; dv.setUint32(8, mode, true); return out
    }
    const px = Math.round(world.self.x), py = Math.round(world.self.y)
    const missiles = () => { const c = {}; for (const u of world.units.values()) if (u.unitType === 'missile') c[u.missileKey ?? u.classId] = (c[u.missileKey ?? u.classId] ?? 0) + 1; return c }
    const before = missiles()
    const keys = []
    const origSpawn = world.spawnMissileByKey
    world.spawnMissileByKey = (k, ...a) => { keys.push(k); return origSpawn(k, ...a) }
    app.session.handleS2cPacket(p51(0x6f000012, 2, px - 6, py + 6, 0, 21))
    app.session.handleS2cPacket(p0e(0x6f000012, 0x15, world.selfId, 0))
    const tick = async (n) => { for (let i = 0; i < n; i++) { await new Promise(r => setTimeout(r, 40)); app.session.tick(40, performance.now()) } }
    await tick(1)
    const afterExpl = missiles()
    const explKeys = keys.slice()
    const name0 = world.self.name
    app.session.handleS2cPacket(p51(0x6f000013, 2, px - 3, py - 6, 0, 16))
    app.session.handleS2cPacket(p0e(0x6f000013, 0x15, world.selfId, 0))
    await tick(1)
    return { before, afterExpl, explKeys, name0, name1: world.self.name }
  })()`)
  console.log(JSON.stringify(r2))
  const total = (a: Record<string, number>): number => Object.values(a).reduce((s, v) => s + v, 0)
  const delta = (a: Record<string, number>, b: Record<string, number>): number => total(b) - total(a)
  assert((r.diag as { spawned: number }).spawned === 16, 'fire shrine should spawn 16 missiles')
  assert(delta(r.before as Record<string, number>, r.afterFire as Record<string, number>) >= 1, 'fire shrine missiles should be in the world')
  const explKeys = r2.explKeys as string[]
  assert(explKeys.slice(0, 6).every((k) => k === 'explosivepotion') && explKeys[6] !== 'explosivepotion', 'exploding shrine should spawn 6 explosivepotion missiles (then their explosions)')
  assert(r2.name1 === String(r2.name0).split('').reverse().join(''), 'Enirhs should reverse the player name')
})
console.log('[verify-shrine-fx] PASS')
