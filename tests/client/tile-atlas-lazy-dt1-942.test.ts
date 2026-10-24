/**
 * Issue #942 — TileAtlas lazy Dt1 map + zero-pixel runtime decode.
 *
 * Ground truth measured live: `toDt1Map()` at init eagerly materialized every
 * catalog library of all five acts (~366.6MB of per-tile pixel buffers), while
 * the runtime never registers R8 pages (`setActR8Page` has no runtime caller —
 * the GPU renderer streams `tiles-N.r8` into textures directly), so every one
 * of those buffers was zero-filled dead weight. The lazy view decodes only the
 * libraries a level actually references, and without a backing page the block
 * pixels share one empty buffer (behavior-identical: every pixel read sees 0).
 */
import { describe, expect, it } from 'vitest'
import { TileAtlas, type R8AtlasPage } from '../../src/client/map/tile-atlas.ts'
import type { PackedTileCatalogIndex, PackedDt1LibraryEntry, PackedDt1TileEntry } from '../../src/common/pack-contract/index.ts'

function makeLib(path: string, tiles: number, ownerAct: number): PackedDt1LibraryEntry {
  const entries: PackedDt1TileEntry[] = []
  for (let i = 0; i < tiles; i += 1) {
    entries.push({
      index: i,
      direction: 0,
      roofHeight: 0,
      materialFlags: 0,
      animated: 0,
      height: 5,
      width: 80,
      type: i % 2 === 0 ? 0 : 1,
      style: 1,
      sequence: i,
      rarityFrameIndex: 0,
      minBlockY: 0,
      bitmapHeight: 40,
      blockCount: 1,
      subTileFlags: new Array<number>(25).fill(0),
      rawSubTileFlags: new Array<number>(25).fill(0),
      placement: { act: ownerAct, page: 0, x: i, y: 0, width: 80, height: 40, nonEmptyPixels: 1, hash: '00000000' },
    })
  }
  return {
    path,
    archivePath: path,
    ownerAct,
    acts: [ownerAct],
    versionMajor: 7,
    versionMinor: 0,
    tileCount: entries.length,
    tiles: entries,
  }
}

const catalog: PackedTileCatalogIndex = {
  libraries: {
    'data\\global\\tiles\\act1\\town\\floor.dt1': makeLib('data\\global\\tiles\\act1\\town\\floor.dt1', 4, 1),
    'data\\global\\tiles\\act1\\barracks\\invismal.dt1': makeLib('data\\global\\tiles\\act1\\barracks\\invismal.dt1', 2, 1),
    'data\\global\\tiles\\act2\\sewer\\floor.dt1': makeLib('data\\global\\tiles\\act2\\sewer\\floor.dt1', 3, 2),
  },
} as unknown as PackedTileCatalogIndex

describe('[#942 lazy Dt1 map]', () => {
  it('1. serves metadata queries without decoding any library', () => {
    const atlas = TileAtlas.fromCatalogIndex(catalog)
    const lazy = atlas.toLazyDt1Map()
    expect(lazy.size).toBe(3)
    expect(lazy.has('data\\global\\tiles\\act2\\sewer\\floor.dt1')).toBe(true)
    expect(lazy.has('data\\global\\tiles\\act3\\nope.dt1')).toBe(false)
    expect([...lazy.keys()]).toHaveLength(3)
    // metadata-only: nothing decoded yet
    expect((atlas as unknown as { dt1Cache: ReadonlyMap<string, unknown> }).dt1Cache.size).toBe(0)
  })

  it('2. get() decodes the referenced library once and caches it; untouched libraries stay undecoded', () => {
    const atlas = TileAtlas.fromCatalogIndex(catalog)
    const lazy = atlas.toLazyDt1Map()
    const a = lazy.get('data\\global\\tiles\\act2\\sewer\\floor.dt1')
    const b = lazy.get('DATA\\GLOBAL\\TILES\\ACT2\\SEWER\\FLOOR.DT1')
    expect(a).toBeDefined()
    expect(b).toBe(a)
    expect((atlas as unknown as { dt1Cache: ReadonlyMap<string, unknown> }).dt1Cache.size).toBe(1)
    expect(lazy.get('missing.dt1')).toBeUndefined()
  })

  it('3. runtime decode (no R8 page registered) shares one empty pixel buffer — no per-tile allocation', () => {
    const atlas = TileAtlas.fromCatalogIndex(catalog)
    const lib = atlas.toDt1('data\\global\\tiles\\act1\\town\\floor.dt1')
    const pixels = new Set<Uint8Array>()
    for (const tile of lib.tiles) {
      for (const block of tile.blocks) pixels.add(block.pixels)
    }
    expect(pixels.size).toBe(1)
    for (const p of pixels) expect(p.byteLength).toBe(0)
  })

  it('4. a registered R8 page still produces real per-tile pixels (bake/MPQ-mode parity)', () => {
    const atlas = TileAtlas.fromCatalogIndex(catalog)
    const page: R8AtlasPage = { act: 1, page: 0, width: 256, height: 256, r8: new Uint8Array(256 * 256).fill(7) }
    atlas.setActR8Page(page)
    const lib = atlas.toDt1('data\\global\\tiles\\act1\\town\\floor.dt1')
    for (const tile of lib.tiles) {
      for (const block of tile.blocks) {
        expect(block.pixels.byteLength).toBeGreaterThan(0)
      }
    }
  })
})
