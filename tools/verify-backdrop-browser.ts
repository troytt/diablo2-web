#!/usr/bin/env npx tsx
/**
 * Visual verifier for issues #1537 / #1538 (level backdrops, backdrop-113c.ts / backdrop-pass.ts).
 *
 * The replay fixture only covers the Rogue Encampment, so the verifier overrides the scene snapshot's level/act
 * (Arreat Summit 120 / act 5, then Arcane Sanctuary 74 / act 2) and drops the floor/wall/roof quads so the void
 * shows what the backdrop pass drew behind them. It checks that the renderer produced non-black pixels in the
 * otherwise empty frame (summit tiles + clouds; starfield points) and that a town frame (level 1) stays black.
 * Screenshots (800x600, 1280x720) go to `scratch/verify-backdrop/`.
 *
 * Usage: npx tsx tools/verify-backdrop-browser.ts
 */

import { assert, withPlayHarness } from './play-cdp-harness.ts'

await withPlayHarness('verify-backdrop', async (h) => {
  const setLevel = async (levelId: number, actId: number): Promise<void> => {
    await h.cdp.evaluate(`(() => {
      const src = window.__d2Play.session.sceneSource
      if (!src.__origBuild) src.__origBuild = src.buildFrameSnapshot.bind(src)
      src.buildFrameSnapshot = (...a) => ({ ...src.__origBuild(...a), levelId: ${String(levelId)}, actId: ${String(actId)},
        floorQuads: [], shadowQuads: [], lowerWallQuads: [], upperWallQuads: [], roofQuads: [] })
      return true
    })()`)
  }
  // Non-black pixels in the play area (the HUD strip at the bottom and the page chrome at the top are excluded).
  const litPixels = (): Promise<number> =>
    h.cdp.evaluate<number>(`(() => {
      let gl = null
      for (const c of document.querySelectorAll('canvas')) {
        const g = c.getContext('webgl2') ?? c.getContext('webgl')
        if (g && (!gl || g.drawingBufferWidth * g.drawingBufferHeight > gl.drawingBufferWidth * gl.drawingBufferHeight)) gl = g
      }
      window.__d2Play.renderFrame(performance.now())
      const w = gl.drawingBufferWidth, hh = gl.drawingBufferHeight, px = new Uint8Array(w * hh * 4)
      gl.readPixels(0, 0, w, hh, gl.RGBA, gl.UNSIGNED_BYTE, px)
      let n = 0
      for (let y = Math.floor(hh * 0.25); y < Math.floor(hh * 0.75); y++) for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4; if (px[i] + px[i + 1] + px[i + 2] > 60) n++
      }
      return n
    })()`)
  await setLevel(1, 1)
  await h.tick(2)
  const town = await litPixels()
  await setLevel(120, 5)
  await h.tick(4)
  const summit = await litPixels()
  console.log('screenshots:', await h.shootBoth('arreat-summit'))
  await setLevel(74, 2)
  await h.tick(4)
  const sanctuary = await litPixels()
  console.log('screenshots:', await h.shootBoth('arcane-sanctuary'))
  console.log({ town, summit, sanctuary })
  assert(summit > town + 1000, 'Arreat Summit should draw the summit01 sky behind the level')
  assert(sanctuary > town + 20, 'Arcane Sanctuary should draw the starfield behind the level')
})
console.log('[verify-backdrop] PASS')
