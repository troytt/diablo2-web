/**
 * Issue #921 — Diablo (`MonStats.txt` hcIdx 243, token `DI`, `MonStats2.txt` row `diablo`) never rendered.
 *
 * Root cause (verified, not the issue-body hypothesis): the art *was* baked and indexed
 * (`index.json` 243 -> `di-hth` -> `monster-di-hth.{json,r8}`), but the entity packer shelf-packed
 * every composited frame of every mode into ONE 4096-wide page with unbounded height. Diablo's
 * 3006 frames (13 modes x 8 dirs, 142-frame `DT`, plus `sc/s2/s3/dt` glow layers) produced a
 * 4096x27997 R8 page. `SpriteRenderer.addIndexedAtlas` rejects anything above `MAX_TEXTURE_SIZE`
 * (16384 on desktop GPUs), the loaders' `catch {}` swallowed the throw, and the cache marked
 * classId 243 `missing` -> nothing drawn.
 *
 * Fix: the packer pages entity atlases at {@link ENTITY_ATLAS_MAX_PAGE_HEIGHT} rows (`pages` +
 * 7th frame-tuple page index), the loaders upload every page and bind frames to their page, and
 * `SpriteRenderer.draw/drawQuad` prefer a frame's own page handle.
 */
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  entityAtlasPageFileName,
  packSheetToR8,
  packSheetToR8Pages,
} from '../../src/baker/packers/pack-entity-assets.ts'
import { ENTITY_ATLAS_MAX_PAGE_HEIGHT, type EntityMeta } from '../../src/common/pack-contract/index.ts'
import type { SpriteFrame, SpriteSheet } from '../../src/common/formats/sprite.ts'
import {
  EntityArtCache,
  type PackedEntityCatalogIndex,
} from '../../src/client/scene/entity-art-loader.ts'
import type { AtlasHandle, PagedAtlasFrame, SpriteRenderer } from '../../src/client/render/renderer.ts'
import { TARGET_MONSTER_MODES } from '../../src/common/units/monster-art.ts'

/** Desktop WebGL2 `MAX_TEXTURE_SIZE`; the real renderer throws above it. */
const GPU_LIMIT = 16384

function solidFrame(width: number, height: number, value: number): SpriteFrame {
  const indices = new Uint8Array(width * height).fill(value)
  const mask = new Uint8Array(width * height).fill(1)
  return { width, height, indices, mask, anchorX: -width / 2, anchorY: -height }
}

describe('issue #921: entity atlas paging (baker)', () => {
  it('splits a sheet taller than one page into pages that each fit, preserving every pixel', () => {
    // 64 frames of 300x300 on a 4096-wide shelf -> 13 per shelf -> 5 shelves = 1504 rows unpaged.
    const groups = Array.from({ length: 8 }, (_, g) => ({
      frames: Array.from({ length: 8 }, (_, f) => solidFrame(300, 300, 1 + ((g * 8 + f) % 250))),
    }))
    const sheet: SpriteSheet = { groups, width: null }
    const unpaged = packSheetToR8(sheet)
    expect(unpaged.height).toBeGreaterThan(1000)

    const paged = packSheetToR8Pages(sheet, 172, 700)
    expect(paged.pages.length).toBeGreaterThan(1)
    for (const page of paged.pages) {
      expect(page.height).toBeLessThanOrEqual(700)
      expect(page.r8.byteLength).toBe(page.width * page.height)
    }
    for (let g = 0; g < groups.length; g += 1) {
      for (let f = 0; f < groups[g]!.frames.length; f += 1) {
        const [x, y, w, h, ax, ay, page] = paged.groups[g]![f]!
        expect([w, h, ax, ay]).toEqual([300, 300, -150, -300])
        const p = paged.pages[page]!
        expect(y + h).toBeLessThanOrEqual(p.height)
        const expected = 1 + ((g * 8 + f) % 250)
        expect(p.r8[y * p.width + x]).toBe(expected)
        expect(p.r8[(y + h - 1) * p.width + x + w - 1]).toBe(expected)
      }
    }
  })

  it('keeps the legacy single-page layout byte-identical when everything fits', () => {
    const sheet: SpriteSheet = { groups: [{ frames: [solidFrame(40, 50, 7), solidFrame(30, 20, 9)] }], width: null }
    const legacy = packSheetToR8(sheet)
    const paged = packSheetToR8Pages(sheet)
    expect(paged.pages).toHaveLength(1)
    expect(paged.pages[0]!.r8).toEqual(legacy.r8)
    expect(paged.groups[0]!.map(t => t.slice(0, 6))).toEqual(legacy.groups[0])
  })

  it('names page 0 like the historical pack and extra pages .p<N>.r8', () => {
    expect(entityAtlasPageFileName('monster-di-hth', 0)).toBe('monster-di-hth.r8')
    expect(entityAtlasPageFileName('monster-di-hth', 2)).toBe('monster-di-hth.p2.r8')
  })

  it('bakes MonMode BL (MonStats2 diablo mBL=1, DIBLHTH.cof)', () => {
    expect(TARGET_MONSTER_MODES).toContain('bl')
  })
})

function makeLimitedRenderer(): { renderer: SpriteRenderer; uploads: { w: number; h: number }[] } {
  const uploads: { w: number; h: number }[] = []
  const renderer = {
    addIndexedAtlas(_indices: Uint8Array, width: number, height: number): AtlasHandle {
      if (width > GPU_LIMIT || height > GPU_LIMIT) {
        throw new Error(`indexed atlas ${String(width)}x${String(height)} exceeds the ${String(GPU_LIMIT)}px texture limit`)
      }
      uploads.push({ w: width, h: height })
      return { texture: {} as WebGLTexture, width, height, indexed: true }
    },
  } as unknown as SpriteRenderer
  return { renderer, uploads }
}

const CATALOG: PackedEntityCatalogIndex = {
  monsterByClassId: {
    '243': { hcIdx: 243, classId: 243, id: 'diablo', token: 'DI', weapon: 'hth', key: 'di-hth', slug: 'di-hth' },
  },
} as unknown as PackedEntityCatalogIndex

function serve(files: Record<string, unknown>): typeof fetch {
  return (async (url: string) => {
    const body = files[url]
    if (body === undefined) return new Response(null, { status: 404 })
    if (body instanceof Uint8Array) return new Response(body as unknown as BodyInit)
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
}

async function loadDiablo(files: Record<string, unknown>, renderer: SpriteRenderer) {
  const cache = new EntityArtCache({ renderer, packBase: '', fetchFn: serve(files), initialCatalog: CATALOG })
  expect(cache.getMonsterArt(243)).toBe('loading')
  await cache.waitForInflight()
  await new Promise(r => setTimeout(r, 0))
  return cache.getMonsterArt(243)
}

describe('issue #921: multi-page entity packs (runtime loader)', () => {
  it('loads every page of a paged pack and binds each frame to its own page handle', async () => {
    const { renderer, uploads } = makeLimitedRenderer()
    const meta: Partial<EntityMeta> = {
      schema: 2, token: 'DI', weapon: 'hth', file: 'monster-di-hth.r8', format: 'r8',
      width: 8, height: 4, directions: 1,
      pages: [
        { file: 'monster-di-hth.r8', width: 8, height: 4 },
        { file: 'monster-di-hth.p1.r8', width: 8, height: 2 },
      ],
      clips: { nu: { group: 0, directions: 1, frames: 2, speed: 96, loop: true, events: [] } },
      standOffset: 0, standFrames: 2,
      groups: [[[0, 0, 4, 4, -2, -4, 0], [0, 0, 3, 2, -1, -2, 1]]],
    }
    const art = await loadDiablo({
      '/entities/monster-di-hth.json': meta,
      '/entities/monster-di-hth.r8': new Uint8Array(32),
      '/entities/monster-di-hth.p1.r8': new Uint8Array(16),
    }, renderer)
    expect(art).not.toBe('missing')
    expect(art).not.toBe('loading')
    if (typeof art === 'string') return
    expect(uploads).toEqual([{ w: 8, h: 4 }, { w: 8, h: 2 }])
    const [f0, f1] = art.groups[0]! as PagedAtlasFrame[]
    expect(f0!.atlas).toBe(art.handle)
    expect(f1!.atlas).not.toBe(art.handle)
    expect(f1!.atlas?.height).toBe(2)
  })

  it('fails fast (missing) when a declared page is absent instead of drawing from the wrong texture', async () => {
    const { renderer } = makeLimitedRenderer()
    const meta = {
      schema: 2, token: 'DI', file: 'monster-di-hth.r8', width: 8, height: 4, directions: 1,
      pages: [{ file: 'monster-di-hth.r8', width: 8, height: 4 }, { file: 'monster-di-hth.p1.r8', width: 8, height: 2 }],
      clips: { nu: { group: 0, directions: 1, frames: 1, speed: 96, loop: true, events: [] } },
      standOffset: 0, standFrames: 1, groups: [[[0, 0, 3, 2, -1, -2, 1]]],
    }
    const art = await loadDiablo({
      '/entities/monster-di-hth.json': meta,
      '/entities/monster-di-hth.r8': new Uint8Array(32),
    }, renderer)
    expect(art).toBe('missing')
  })
})

const DI_META = 'public/entities/monster-di-hth.json'

describe.skipIf(!existsSync(DI_META))('issue #921: baked Diablo pack is uploadable', () => {
  const meta = JSON.parse(readFileSync(DI_META, 'utf8')) as EntityMeta
  const pages = meta.pages ?? [{ file: meta.file, width: meta.width, height: meta.height }]

  it('every page of monster-di-hth fits a GPU texture page', () => {
    for (const p of pages) {
      expect(p.width).toBeLessThanOrEqual(GPU_LIMIT)
      expect(p.height).toBeLessThanOrEqual(ENTITY_ATLAS_MAX_PAGE_HEIGHT)
      expect(existsSync(`public/entities/${p.file}`)).toBe(true)
    }
  })

  it('carries all MonStats2 diablo modes that have COFs (DT NU WL GH A1 A2 BL SC S1-S4 DD RN)', () => {
    const clips = meta.clips ?? {}
    for (const m of ['dt', 'nu', 'wl', 'gh', 'a1', 'a2', 'bl', 'sc', 's1', 's2', 's3', 's4', 'dd', 'rn']) {
      expect(clips[m], m).toBeDefined()
    }
    expect(clips.dt!.frames).toBe(142)
    expect(clips.dt!.directions).toBe(1)
  })

  it('every frame references a declared page and stays inside it', () => {
    for (const group of [...meta.groups, ...(meta.glowGroups ?? [])]) {
      for (const [x, y, w, h, , , page = 0] of group) {
        const p = pages[page]
        expect(p).toBeDefined()
        expect(x + w).toBeLessThanOrEqual(p!.width)
        expect(y + h).toBeLessThanOrEqual(p!.height)
      }
    }
  })
})
