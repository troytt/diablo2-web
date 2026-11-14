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
import {
  clearMissingArtEntries,
  clearPreloadMissEntries,
  getMissingArtEntries,
  getPreloadMissEntries,
} from '../src/client/scene/missing-art.ts'
import {
  drawSceneMissileDrawable,
  drawSceneOverlayDrawable,
} from '../src/client/scene/world-renderer.ts'
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

  it('4. lazy missile/overlay draw records PreloadMiss while loading and only emits reportMissingArt on genuine 404', async () => {
    clearMissingArtEntries()
    clearPreloadMissEntries()
    const renderer = {
      addAtlas: () => ({ texture: null, width: 8, height: 8, indexed: false }),
      draw: () => {},
      setBlendMode: () => {},
    } as never
    const missileArtMap = await loadMissileArtMap(renderer, undefined, {
      lazy: true,
      preloadStems: [],
    })
    const overlayArtMap = await loadOverlayArtMap(renderer, undefined, {
      lazy: true,
      preloadStems: [],
    })

    // Frame 0: `spike1` (`SpikeFiendMissle`) and `fire_cast_1` are valid on disk, but lazy-loaded on demand.
    drawSceneMissileDrawable(
      renderer,
      {
        kind: 'missile',
        missileId: 1,
        missileClassId: 7,
        missileKey: 'spike1',
        celFile: 'SpikeFiendMissle',
        worldX: 0,
        worldY: 0,
        subX: 0,
        subY: 0,
        direction: 0,
        frame: 0,
        loopAnim: true,
      } as never,
      { missileArtMap } as never,
      0,
    )
    drawSceneOverlayDrawable(
      renderer,
      {
        kind: 'overlay',
        overlayKey: 'ov1',
        overlayId: 1,
        token: 'fire_cast_1',
        worldX: 0,
        worldY: 0,
        subX: 0,
        subY: 0,
        frame: 0,
        loop: false,
        blendMode: 'additive',
      } as never,
      { overlayArtMap } as never,
      0,
    )

    expect(getMissingArtEntries()).toHaveLength(0)
    expect(getPreloadMissEntries().map((e) => `${e.category}:${e.id}`)).toEqual([
      'missile:spike1',
      'overlay:fire_cast_1',
    ])

    await missileArtMap.waitForInflight()
    await overlayArtMap.waitForInflight()

    // Frame 1: after lazy load settles, sprites draw and preload misses resolve cleanly.
    drawSceneMissileDrawable(
      renderer,
      {
        kind: 'missile',
        missileId: 1,
        missileClassId: 7,
        missileKey: 'spike1',
        celFile: 'SpikeFiendMissle',
        worldX: 0,
        worldY: 0,
        subX: 0,
        subY: 0,
        direction: 0,
        frame: 0,
        loopAnim: true,
      } as never,
      { missileArtMap } as never,
      16,
    )
    drawSceneOverlayDrawable(
      renderer,
      {
        kind: 'overlay',
        overlayKey: 'ov1',
        overlayId: 1,
        token: 'fire_cast_1',
        worldX: 0,
        worldY: 0,
        subX: 0,
        subY: 0,
        frame: 0,
        loop: false,
        blendMode: 'additive',
      } as never,
      { overlayArtMap } as never,
      16,
    )
    expect(getMissingArtEntries()).toHaveLength(0)
    expect(getPreloadMissEntries().every((e) => e.resolvedAt !== undefined)).toBe(true)

    // Genuine 404 (`horadricstaff` is stubbed missing in `beforeEach`): must report [D2MissingArt] once settled!
    drawSceneMissileDrawable(
      renderer,
      {
        kind: 'missile',
        missileId: 2,
        missileClassId: 200,
        missileKey: 'horadricstaff',
        celFile: 'horadriclight',
        worldX: 0,
        worldY: 0,
        subX: 0,
        subY: 0,
        direction: 0,
        frame: 0,
        loopAnim: true,
      } as never,
      { missileArtMap } as never,
      32,
    )
    await missileArtMap.waitForInflight()
    expect(getMissingArtEntries().some((e) => e.category === 'missile')).toBe(true)
  })
})
