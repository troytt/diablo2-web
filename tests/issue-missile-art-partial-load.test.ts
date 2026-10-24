/**
 * Missile/overlay art maps must degrade per-target, not all-or-nothing.
 *
 * Regression: `loadMissileArtMap`/`loadOverlayArtMap` used to THROW when any
 * single baked atlas 404'd (e.g. tracked MISSILE_METAS entries added by a
 * commit whose local bake had not re-run), which discarded every other loaded
 * atlas — the entire missile FX pipeline went dark for 2 missing files.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  loadMissileArtMap,
  loadOverlayArtMap,
  MISSILE_METAS,
  OVERLAY_METAS,
} from '../src/client/scene/missile-overlay-renderer.ts'
import type { MissileMeta } from '../src/client/render/missiles-meta.ts'

const realFetch = globalThis.fetch
const realCreateImageBitmap = (globalThis as { createImageBitmap?: unknown }).createImageBitmap

function stubArtFetch(missingStems: ReadonlySet<string>): void {
  const g = globalThis as Record<string, unknown>
  g.fetch = async (url: unknown) => {
    const u = String(url)
    const stem = u.split('/').pop()!.replace(/\.(json|png)$/, '')
    const missing = missingStems.has(stem.toLowerCase())
    if (u.endsWith('.json')) {
      if (missing) return { ok: false, status: 404 } as Response
      const meta = {
        name: stem,
        celFile: stem,
        width: 8,
        height: 8,
        directions: 1,
        framesPerDirection: 1,
        animSpeed: 16,
        trans: 0,
        groups: [],
      } satisfies Partial<MissileMeta>
      return { ok: true, status: 200, json: async () => meta } as unknown as Response
    }
    if (missing) return { ok: false, status: 404 } as Response
    return { ok: true, status: 200, blob: async () => ({}) as Blob } as unknown as Response
  }
  g.createImageBitmap = async () => ({ close: () => {} }) as unknown as ImageBitmap
}

describe('missile/overlay art map partial load', () => {
  beforeEach(() => {
    stubArtFetch(new Set(['horadricstaff', 'horadriclight', 'light_jet', 'lightjet']))
  })
  afterEach(() => {
    ;(globalThis as Record<string, unknown>).fetch = realFetch
    ;(globalThis as Record<string, unknown>).createImageBitmap = realCreateImageBitmap
  })

  it('1. loadMissileArtMap resolves with the loaded atlases when some targets 404', async () => {
    const renderer = { addAtlas: () => ({ texture: null, width: 8, height: 8, indexed: false }) } as never
    const map = await loadMissileArtMap(renderer as never)
    // The 240-entry MISSILE_METAS table minus the 2 stubbed-missing stems must load.
    expect(map.size).toBeGreaterThan(100)
    expect(map.has('fireball')).toBe(true)
    expect(map.has('horadricstaff')).toBe(false)
  })

  it('2. loadOverlayArtMap resolves with the loaded overlays when some targets 404', async () => {
    const renderer = { addAtlas: () => ({ texture: null, width: 8, height: 8, indexed: false }) } as never
    const map = await loadOverlayArtMap(renderer as never)
    expect(map.size).toBeGreaterThan(50)
    expect(map.has('light_jet')).toBe(false)
  })

  it('3. MISSILE_METAS still registers the A2Q6 horadric targets (bake must follow)', () => {
    expect(MISSILE_METAS.horadricstaff).toBeDefined()
    expect(OVERLAY_METAS.light_jet).toBeDefined()
  })
})
