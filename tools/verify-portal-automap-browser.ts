#!/usr/bin/env npx tsx
/**
 * Browser verifier for the automap Town Portal marker (`kb/ui/d2client-automap-portal-crosshair-113c.md`).
 *
 * Replays the town fixture on `play.html`, injects one S2C `0x51` Town Portal (object class `59`) next to the
 * player, opens the automap and checks, for both `ENG` and `CHI` and for both the full automap and the corner
 * minimap:
 * - exactly one miniature portal sprite is drawn and no portal crosshair (the crosshair of `D2Client.dll`
 *   `0x6fb114b9` / `0x6fb11b2a` is only the fallback while the portal art is not loaded),
 * - the portal label text follows the active language,
 * then saves 800x600 and 1280x720 screenshots under `scratch/portal-automap/`.
 *
 * Env: see `tools/play-cdp-harness.ts` (`D2W_PORT`, `D2W_PUBLIC_DIR`, `CHROME_PATH`).
 */

import { assert, withPlayHarness } from './play-cdp-harness.ts'

interface PortalProbe {
  readonly lang: string
  readonly mode: string
  readonly portalCrosshairs: number
  readonly portalSprites: number
  readonly labels: readonly string[]
  readonly automapMode: string
}

await withPlayHarness('portal-automap', async (h) => {
  const setup = await h.cdp.evaluate<Record<string, unknown>>(`(async () => {
    const app = window.__d2Play, world = app.session.world
    const out = new Uint8Array(14); const dv = new DataView(out.buffer)
    const px = Math.round(world.self.x), py = Math.round(world.self.y)
    out[0] = 0x51; out[1] = 2; dv.setUint32(2, 0x6f0000a1, true); dv.setUint16(6, 59, true)
    dv.setUint16(8, px + 22, true); dv.setUint16(10, py - 10, true); out[12] = 2; out[13] = 0
    app.session.handleS2cPacket(out)
    const unit = world.getUnit('object', 0x6f0000a1)
    return { px, py, hasPortal: !!unit, classId: unit ? unit.classId : null }
  })()`)
  console.log(JSON.stringify(setup))
  assert(setup.hasPortal === true && setup.classId === 59, 'Town Portal object (class 59) should exist in the world')

  const probes: PortalProbe[] = []
  for (const lang of ['en', 'zh'] as const) {
    for (const mode of ['full', 'minimap'] as const) {
      const probe = await h.cdp.evaluate<PortalProbe>(`(async () => {
        const app = window.__d2Play
        const langMod = await import('/src/client/i18n/lang.ts')
        langMod.setGameLang(${JSON.stringify(lang)})
        const tick = async (n) => { for (let i = 0; i < n; i++) { await new Promise(r => setTimeout(r, 40)); app.session.tick(40, performance.now()) } }
        const read = () => ({
          portalCrosshairs: app.minimap.lastRenderStats.crosshairsDrawn.portals,
          portalSprites: app.minimap.lastRenderStats.spritesDrawn.portals,
          labels: app.minimap.lastRenderStats.warpLabels.filter(l => l.kind === 'portal').map(l => l.text),
        })
        app.minimap.mode = ${JSON.stringify(mode)}
        await tick(2)
        app.renderFrame(performance.now())
        if (read().portalCrosshairs + read().portalSprites === 0) {
          app.session.hudModel.toggleAutomap()
          await tick(2)
          app.minimap.mode = ${JSON.stringify(mode)}
          app.renderFrame(performance.now())
        }
        // The portal art is loaded lazily; keep rendering until the miniature sprite replaces the crosshair.
        for (let i = 0; i < 100 && read().portalSprites === 0; i++) {
          await tick(2)
          app.renderFrame(performance.now())
        }
        const automapMode = app.session.hudModel.automap ? String(app.session.hudModel.automap.getMode()) : 'none'
        return { lang: ${JSON.stringify(lang)}, mode: app.minimap.mode, automapMode, ...read() }
      })()`)
      console.log(JSON.stringify(probe))
      probes.push(probe)
      console.log('screenshots:', await h.shootBoth(`portal-${lang}-${mode}`))
    }
  }

  for (const p of probes) {
    assert(p.portalSprites === 1, `${p.lang}/${p.mode}: expected exactly 1 miniature portal sprite, got ${String(p.portalSprites)}`)
    assert(p.portalCrosshairs === 0, `${p.lang}/${p.mode}: expected no portal crosshair, got ${String(p.portalCrosshairs)}`)
    assert(p.labels.length === 1, `${p.lang}/${p.mode}: expected exactly 1 portal label, got ${JSON.stringify(p.labels)}`)
  }
  const en = probes.filter((p) => p.lang === 'en').map((p) => p.labels[0]!)
  const zh = probes.filter((p) => p.lang === 'zh').map((p) => p.labels[0]!)
  assert(en.every((t) => /Town Portal/.test(t) && !/[\u4e00-\u9fff]/.test(t)), `ENG label should be English: ${JSON.stringify(en)}`)
  assert(zh.every((t) => /[\u4e00-\u9fff]/.test(t) && !/Town Portal/.test(t)), `CHI label should be Chinese: ${JSON.stringify(zh)}`)
})
console.log('[verify-portal-automap] PASS')
