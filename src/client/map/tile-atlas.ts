/**
 * Seed-independent DT1 Tile Atlas (`src/client/map/tile-atlas.ts`, Feature F11 & F12).
 *
 * Indexes all DT1 libraries across Acts 1–5 by normalized library path, tile index,
 * and `(style, sequence, type)`, supporting:
 *   - Direct DRLG-pinned tile lookup (`(dt1Library, dt1Tile)`)
 *   - Cell-masked (`dt1MaskAllows`) candidate resolution with SplitMix64 `pickVariant` fallback
 *   - Reconstruction of `Dt1` / `Dt1Tile` structures (including 25-byte `subTileFlags`,
 *     `roofHeight`, `minBlockY`, `bitmapHeight`, and optional R8 pixel slices) so
 *     `buildDrlgLevelMap`, `auditDrlgDt1Ambiguity`, and `buildIsoMapScene` run identically
 *     against packed atlases or raw MPQ DT1s.
 */

import {
  decodeDt1,
  isAnimatedTile,
  subTileFlagsOf,
  type Dt1,
  type Dt1Block,
  type Dt1Tile,
} from '../../common/formats/dt1.ts'
import { dt1MaskAllows, pickVariant, type PoolTile } from '../../common/world/d2map.ts'
import { DRLG_UNIVERSAL_DT1 } from '../../common/drlg/drlg-map.ts'
import { normalizeDrlgPath } from '../../common/drlg/drlg-source.ts'
import type {
  PackedDt1LibraryEntry,
  PackedDt1TileEntry,
  PackedTileCatalogIndex,
  PackedTilePlacement,
} from '../../common/pack-contract/index.ts'

export type {
  PackedDt1LibraryEntry,
  PackedDt1TileEntry,
  PackedTileCatalogIndex,
  PackedTilePlacement,
}

export interface TileAtlasFrameEntry {
  readonly libraryPath: string
  readonly index: number
  readonly direction: number
  readonly roofHeight: number
  readonly materialFlags: number
  readonly animated: number
  readonly height: number
  readonly width: number
  readonly type: number
  readonly style: number
  readonly sequence: number
  readonly rarityFrameIndex: number
  readonly minBlockY: number
  readonly bitmapHeight: number
  readonly blockCount: number
  /** 25 sub-tile flag bytes in normalized top-to-bottom order (`subY * 5 + subX`). */
  readonly subTileFlags: readonly number[]
  /** 25 sub-tile flag bytes in raw DT1 file bottom-to-top order (`(4 - subY) * 5 + subX`). */
  readonly rawSubTileFlags: readonly number[]
  readonly placement: PackedTilePlacement | null
}

export interface ResolvedTileAtlasCandidate {
  readonly libraryIndex: number
  readonly libraryPath: string
  readonly dt1Path: string
  readonly tileIndex: number
  readonly entry: TileAtlasFrameEntry
  readonly animatedEntries?: readonly TileAtlasFrameEntry[]
  readonly pinned: boolean
  readonly matchKind: 'pinned' | 'fallback'
}

export interface UniversalDt1Verification {
  readonly blankFound: boolean
  readonly invisWalFound: boolean
  readonly invisWalFloor49_7Found: boolean
  readonly warpFound: boolean
  readonly allValid: boolean
}

export interface R8AtlasPage {
  readonly act: number
  readonly page: number
  readonly width: number
  readonly height: number
  readonly r8: Uint8Array
}

/**
 * #942: shared zero-length pixel buffer for tiles materialized without a backing
 * R8 page (the runtime path — see `toDt1`). Every pixel read of a zero-filled
 * `new Uint8Array(w*h)` returns 0, so the empty buffer is behavior-identical.
 */
const EMPTY_TILE_PIXELS = new Uint8Array(0)

/**
 * #942: lazily materializing `ReadonlyMap<string, Dt1>` view over the atlas.
 * `buildDrlgLevelMap` / `buildLevelView` only ever `get()` the handful of
 * libraries one level uses, so the view decodes on first access instead of the
 * old `toDt1Map()` eager decode of every catalog library (all five acts).
 * Key/size/has queries are served from catalog metadata without decoding.
 */
class LazyDt1MapView implements ReadonlyMap<string, Dt1> {
  constructor(private readonly atlas: TileAtlas) {}

  get size(): number {
    return this.atlas.libraryCount
  }

  get(key: string): Dt1 | undefined {
    return this.atlas.hasLibrary(key) ? this.atlas.toDt1(key) : undefined
  }

  has(key: string): boolean {
    return this.atlas.hasLibrary(key)
  }

  forEach(callbackfn: (value: Dt1, key: string, map: ReadonlyMap<string, Dt1>) => void, thisArg?: unknown): void {
    for (const [key, value] of this.entries()) callbackfn.call(thisArg, value, key, this)
  }

  *keys(): IterableIterator<string> {
    for (const p of this.atlas.getLibraryPaths()) yield p
  }

  *entries(): IterableIterator<[string, Dt1]> {
    for (const key of this.atlas.getLibraryPaths()) yield [key, this.atlas.toDt1(key)]!
  }

  [Symbol.iterator](): IterableIterator<[string, Dt1]> {
    return this.entries()
  }

  *values(): IterableIterator<Dt1> {
    for (const [, value] of this.entries()) yield value
  }
}

export class TileAtlas {
  private readonly librariesByPath = new Map<string, PackedDt1LibraryEntry>()
  private readonly framesByPath = new Map<string, readonly TileAtlasFrameEntry[]>()
  private readonly styleSeqTypeIndex = new Map<string, readonly TileAtlasFrameEntry[]>()
  private readonly dt1Cache = new Map<string, Dt1>()
  private readonly palettesByAct = new Map<number, Uint8Array>()
  private readonly r8Pages = new Map<string, R8AtlasPage>()

  constructor(libraries: Iterable<PackedDt1LibraryEntry>) {
    for (const lib of libraries) {
      const key = normalizeDrlgPath(lib.path)
      this.librariesByPath.set(key, lib)
      const entries: TileAtlasFrameEntry[] = lib.tiles.map(t => ({
        libraryPath: key,
        index: t.index,
        direction: t.direction,
        roofHeight: t.roofHeight,
        materialFlags: t.materialFlags,
        animated: t.animated,
        height: t.height,
        width: t.width,
        type: t.type,
        style: t.style,
        sequence: t.sequence,
        rarityFrameIndex: t.rarityFrameIndex,
        minBlockY: t.minBlockY,
        bitmapHeight: t.bitmapHeight,
        blockCount: t.blockCount,
        subTileFlags: t.subTileFlags,
        rawSubTileFlags: t.rawSubTileFlags,
        placement: t.placement,
      }))
      this.framesByPath.set(key, entries)

      const byTuple = new Map<string, TileAtlasFrameEntry[]>()
      for (const entry of entries) {
        const tupleKey = `${key}|${String(entry.style)}:${String(entry.sequence)}:${String(entry.type)}`
        let list = byTuple.get(tupleKey)
        if (!list) {
          list = []
          byTuple.set(tupleKey, list)
        }
        list.push(entry)
      }
      for (const [tupleKey, list] of byTuple) {
        this.styleSeqTypeIndex.set(tupleKey, list)
      }
    }
  }

  /**
   * Construct a {@link TileAtlas} from a parsed `PackedTileCatalogIndex` (`public/act-packs/tiles/index.json`).
   */
  static fromCatalogIndex(index: PackedTileCatalogIndex): TileAtlas {
    return new TileAtlas(Object.values(index.libraries))
  }

  /**
   * Construct a {@link TileAtlas} directly from decoded `Dt1` libraries (e.g. in tests or MPQ mode).
   */
  static fromDt1Map(dt1ByPath: ReadonlyMap<string, Dt1>): TileAtlas {
    const libs: PackedDt1LibraryEntry[] = []
    for (const [rawPath, dt1] of dt1ByPath) {
      const key = normalizeDrlgPath(rawPath)
      const match = /[\\/]act([1-5])[\\/]/i.exec(key)
      let ownerAct: number
      if (match) {
        ownerAct = Number(match[1])
      } else if (/[\\/]expansion[\\/]/i.test(key)) {
        ownerAct = 5
      } else {
        throw new Error(
          `[TileAtlas.fromDt1Map] Failed to determine act (1..5) for DT1 library path: "${rawPath}"`,
        )
      }
      const tiles: PackedDt1TileEntry[] = dt1.tiles.map((t, index) => {
        const subTileFlags = t.subTileFlags.map(f => f.raw)
        const rawSubTileFlags = new Array<number>(25).fill(0)
        for (let sy = 0; sy < 5; sy += 1) {
          for (let sx = 0; sx < 5; sx += 1) {
            rawSubTileFlags[(4 - sy) * 5 + sx] = subTileFlags[sy * 5 + sx] ?? 0
          }
        }
        return {
          index,
          direction: t.direction,
          roofHeight: t.roofHeight,
          materialFlags: t.materialFlags,
          animated: t.animated,
          height: t.height,
          width: t.width,
          type: t.type,
          style: t.style,
          sequence: t.sequence,
          rarityFrameIndex: t.rarityFrameIndex,
          minBlockY: t.minBlockY,
          bitmapHeight: t.bitmapHeight,
          blockCount: t.blocks.length,
          subTileFlags,
          rawSubTileFlags,
          placement:
            t.blocks.length > 0 && t.width > 0 && t.bitmapHeight > 0
              ? {
                  act: ownerAct,
                  page: 0,
                  x: 0,
                  y: 0,
                  width: t.width,
                  height: t.bitmapHeight,
                  nonEmptyPixels: 1,
                  hash: '00000000',
                }
              : null,
        }
      })
      libs.push({
        path: key,
        archivePath: rawPath,
        ownerAct,
        acts: [ownerAct],
        versionMajor: dt1.versionMajor,
        versionMinor: dt1.versionMinor,
        tileCount: tiles.length,
        tiles,
      })
    }
    const atlas = new TileAtlas(libs)
    for (const [rawPath, dt1] of dt1ByPath) {
      atlas.dt1Cache.set(normalizeDrlgPath(rawPath), dt1)
    }
    return atlas
  }

  /**
   * Load a {@link TileAtlas} over HTTP `fetch` from `/act-packs/tiles/index.json` (or custom base URL).
   */
  static async fetch(baseUrl = '/act-packs/tiles'): Promise<TileAtlas> {
    const cleanBase = baseUrl.replace(/\/+$/, '')
    const res = await fetch(`${cleanBase}/index.json`)
    if (!res.ok) {
      throw new Error(`TileAtlas.fetch: HTTP ${String(res.status)} loading ${cleanBase}/index.json`)
    }
    const index = (await res.json()) as PackedTileCatalogIndex
    return TileAtlas.fromCatalogIndex(index)
  }

  get libraryCount(): number {
    return this.librariesByPath.size
  }

  /**
   * #942: lazily decoding `ReadonlyMap` view over the catalog — the runtime
   * replacement for `toDt1Map()`, which eagerly materialized every library of
   * every act at init.
   */
  toLazyDt1Map(): ReadonlyMap<string, Dt1> {
    return new LazyDt1MapView(this)
  }

  hasLibrary(libraryPath: string): boolean {
    return this.librariesByPath.has(normalizeDrlgPath(libraryPath))
  }

  getLibrary(libraryPath: string): PackedDt1LibraryEntry | null {
    return this.librariesByPath.get(normalizeDrlgPath(libraryPath)) ?? null
  }

  getLibraryPaths(): string[] {
    return [...this.librariesByPath.keys()]
  }

  /**
   * Resolve the deduplicated list of packed R8 atlas pages (`{ act, page }`) referenced by
   * the given DT1 library paths (#1025).
   */
  getPagesForLibraries(
    libraryPaths: Iterable<string>,
  ): Array<{ readonly act: number; readonly page: number }> {
    const seen = new Set<string>()
    const out: Array<{ readonly act: number; readonly page: number }> = []
    for (const rawPath of libraryPaths) {
      if (!rawPath || rawPath.length <= 1) continue
      const lib = this.librariesByPath.get(normalizeDrlgPath(rawPath))
      if (!lib) continue
      for (const tile of lib.tiles) {
        const placement = tile.placement
        if (!placement) continue
        const key = `${String(placement.act)}:${String(placement.page)}`
        if (!seen.has(key)) {
          seen.add(key)
          out.push({ act: placement.act, page: placement.page })
        }
      }
    }
    return out
  }

  /**
   * Verify that the 3 mandatory universal DT1s (`Blank.dt1`, `InvisWal.dt1` with `style=49 sequence=7`,
   * `Warp.dt1`) are present in this atlas.
   */
  verifyUniversalDt1s(): UniversalDt1Verification {
    const blankFound = this.hasLibrary(DRLG_UNIVERSAL_DT1[0]!)
    const invisWalFound = this.hasLibrary(DRLG_UNIVERSAL_DT1[1]!)
    const warpFound = this.hasLibrary(DRLG_UNIVERSAL_DT1[2]!)
    const invisFloors = this.getFramesByStyleSeqType(
      DRLG_UNIVERSAL_DT1[1]!,
      49,
      7,
      0,
    )
    const invisWalFloor49_7Found = invisFloors.length > 0
    return {
      blankFound,
      invisWalFound,
      invisWalFloor49_7Found,
      warpFound,
      allValid: blankFound && invisWalFound && invisWalFloor49_7Found && warpFound,
    }
  }

  setActPalette(act: number, rgb768: Uint8Array): void {
    this.palettesByAct.set(act, rgb768)
  }

  getActPalette(act: number): Uint8Array | undefined {
    return this.palettesByAct.get(act)
  }

  setActR8Page(page: R8AtlasPage): void {
    this.r8Pages.set(`${String(page.act)}:${String(page.page)}`, page)
    this.dt1Cache.clear()
  }

  getActR8Page(act: number, page: number): R8AtlasPage | undefined {
    return this.r8Pages.get(`${String(act)}:${String(page)}`)
  }

  /**
   * Look up a single tile entry by normalized DT1 library path and tile index (`0 .. N-1`).
   */
  getFrameByLibraryTile(libraryPath: string, tileIndex: number): TileAtlasFrameEntry | undefined {
    const entries = this.framesByPath.get(normalizeDrlgPath(libraryPath))
    return entries?.[tileIndex]
  }

  /**
   * Look up all tile entries in `libraryPath` matching `(style, sequence, type)`.
   */
  getFramesByStyleSeqType(
    libraryPath: string,
    style: number,
    sequence: number,
    type: number,
  ): readonly TileAtlasFrameEntry[] {
    const key = `${normalizeDrlgPath(libraryPath)}|${String(style)}:${String(sequence)}:${String(type)}`
    return this.styleSeqTypeIndex.get(key) ?? []
  }

  /**
   * Resolve a cell's tile using DRLG's exact pinned `(pinnedLibrary, pinnedTile)` or `(dt1Path, tileIndex)`
   * when available, or falling back to cell-masked (`dt1MaskAllows`) candidate lookup + SplitMix64 `pickVariant`.
   */
  resolveCellTile(options: {
    readonly dt1Names?: readonly string[]
    readonly dt1Path?: string
    readonly tileIndex?: number
    readonly dt1Mask?: number
    readonly style: number
    readonly sequence: number
    readonly type?: number
    readonly tileType?: number
    readonly cellX?: number
    readonly cellY?: number
    readonly x?: number
    readonly y?: number
    readonly seed?: number
    readonly pinnedLibrary?: number
    readonly pinnedTile?: number
  }): ResolvedTileAtlasCandidate | null {
    const dt1Names = options.dt1Names ?? (options.dt1Path ? [options.dt1Path] : [])
    const dt1Mask = options.dt1Mask
    const style = options.style
    const sequence = options.sequence
    const type = options.type ?? options.tileType ?? 0
    const cellX = options.cellX ?? options.x ?? 0
    const cellY = options.cellY ?? options.y ?? 0
    const seed = options.seed ?? 0
    const pinnedLibrary = options.pinnedLibrary ?? (options.dt1Path !== undefined ? 0 : undefined)
    const pinnedTile = options.pinnedTile ?? options.tileIndex

    if (pinnedLibrary !== undefined && pinnedTile !== undefined) {
      const libPath = dt1Names[pinnedLibrary]
      if (libPath !== undefined) {
        const lib = this.getLibrary(libPath)
        if (lib !== null) {
          const entry = this.getFrameByLibraryTile(libPath, pinnedTile)
          if (!entry) {
            throw new Error(
              `[TileAtlas.resolveCellTile] Pinned tile index ${String(pinnedTile)} not found in library "${libPath}"`,
            )
          }
          const normPath = normalizeDrlgPath(libPath)
          const isAnim = isAnimatedTile(entry)
          if (!isAnim) {
            return {
              libraryIndex: pinnedLibrary,
              libraryPath: normPath,
              dt1Path: normPath,
              tileIndex: pinnedTile,
              entry,
              pinned: true,
              matchKind: 'pinned',
            }
          }
          const animCandidates = this.getFramesByStyleSeqType(libPath, style, sequence, type)
            .filter(c => isAnimatedTile(c))
            .slice()
            .sort((a, b) => a.rarityFrameIndex - b.rarityFrameIndex || a.index - b.index)
          return {
            libraryIndex: pinnedLibrary,
            libraryPath: normPath,
            dt1Path: normPath,
            tileIndex: pinnedTile,
            entry,
            ...(animCandidates.length > 1 ? { animatedEntries: animCandidates } : {}),
            pinned: true,
            matchKind: 'pinned',
          }
        }
      }
    }

    // Fallback: gather candidates across dt1Names filtered by dt1MaskAllows
    const allCandidates: { readonly poolTile: PoolTile; readonly entry: TileAtlasFrameEntry; readonly libPath: string }[] = []
    for (let libIdx = 0; libIdx < dt1Names.length; libIdx += 1) {
      const libPath = dt1Names[libIdx]!
      const matches = this.getFramesByStyleSeqType(libPath, style, sequence, type)
      for (const entry of matches) {
        const animated = isAnimatedTile(entry)
        allCandidates.push({
          poolTile: {
            library: libIdx,
            tile: entry.index,
            weight: entry.rarityFrameIndex,
            animated,
            frameIndex: animated ? Math.max(0, entry.rarityFrameIndex) : 0,
          },
          entry,
          libPath: normalizeDrlgPath(libPath),
        })
      }
    }

    if (allCandidates.length === 0) return null
    const active =
      dt1Mask !== undefined
        ? allCandidates.filter(c => dt1MaskAllows(dt1Mask, c.poolTile.library))
        : allCandidates
    if (active.length === 0) return null

    if (active.some(c => c.poolTile.animated)) {
      const sorted = [...active].sort(
        (a, b) => a.poolTile.frameIndex - b.poolTile.frameIndex || a.poolTile.tile - b.poolTile.tile,
      )
      const first = sorted[0]!
      return {
        libraryIndex: first.poolTile.library,
        libraryPath: first.libPath,
        dt1Path: first.libPath,
        tileIndex: first.poolTile.tile,
        entry: first.entry,
        ...(sorted.length > 1 ? { animatedEntries: sorted.map(s => s.entry) } : {}),
        pinned: false,
        matchKind: 'fallback',
      }
    }

    const pickedPool = pickVariant(
      active.map(c => c.poolTile),
      cellX,
      cellY,
      seed,
    )
    if (pickedPool === undefined) return null
    const chosen = active.find(
      c => c.poolTile.library === pickedPool.library && c.poolTile.tile === pickedPool.tile,
    )!
    return {
      libraryIndex: chosen.poolTile.library,
      libraryPath: chosen.libPath,
      dt1Path: chosen.libPath,
      tileIndex: chosen.poolTile.tile,
      entry: chosen.entry,
      pinned: false,
      matchKind: 'fallback',
    }
  }

  /**
   * Reconstruct a `Dt1` object for `libraryPath` so `buildDrlgLevelMap`, `auditDrlgDt1Ambiguity`,
   * and `buildIsoMapScene` can consume this atlas directly.
   */
  toDt1(libraryPath: string): Dt1 {
    const key = normalizeDrlgPath(libraryPath)
    const cached = this.dt1Cache.get(key)
    if (cached !== undefined) return cached

    const lib = this.librariesByPath.get(key)
    if (lib === undefined) {
      throw new Error(`TileAtlas.toDt1: DT1 library "${key}" is not in the atlas`)
    }

    const tiles: Dt1Tile[] = lib.tiles.map(t => {
      const subTileFlags = t.subTileFlags.map(raw => subTileFlagsOf(raw))
      const blocks: Dt1Block[] = []
      if (t.placement !== null) {
        const page = this.getActR8Page(t.placement.act, t.placement.page)
        const width = Math.max(t.width, 1)
        const height = Math.max(t.bitmapHeight, 1)
        // #942: without the backing R8 page (the runtime path — the GPU renderer
        // streams `tiles-N.r8` straight into textures and never registers pages
        // here) the block's pixels are all-zero anyway. Allocate nothing in that
        // case: a shared empty buffer is behavior-identical (every pixel read
        // sees 0) and keeps the per-tile cost at metadata size. This was the
        // 366MB zero-filled allocation measured in issue #942.
        const pixels =
          page !== undefined ? new Uint8Array(width * height) : EMPTY_TILE_PIXELS
        if (page !== undefined) {
          const copyW = Math.min(width, t.placement.width)
          const copyH = Math.min(height, t.placement.height)
          for (let row = 0; row < copyH; row += 1) {
            const srcStart = (t.placement.y + row) * page.width + t.placement.x
            const dstStart = row * width
            pixels.set(page.r8.subarray(srcStart, srcStart + copyW), dstStart)
          }
        }
        blocks.push({
          x: 0,
          y: 0,
          gridX: 0,
          gridY: 0,
          format: 0,
          pixels,
        })
      }
      return {
        direction: t.direction,
        roofHeight: t.roofHeight,
        materialFlags: t.materialFlags,
        animated: t.animated,
        height: t.height,
        width: t.width,
        type: t.type,
        style: t.style,
        sequence: t.sequence,
        rarityFrameIndex: t.rarityFrameIndex,
        subTileFlags,
        minBlockY: t.minBlockY,
        bitmapHeight: t.bitmapHeight,
        blocks,
      }
    })

    const dt1: Dt1 = {
      warnings: [],
      versionMajor: lib.versionMajor,
      versionMinor: lib.versionMinor,
      tiles,
    }
    this.dt1Cache.set(key, dt1)
    return dt1
  }

  /**
   * Build a `Map<string, Dt1>` for a subset (or all) of the libraries in this atlas,
   * suitable for `DrlgMapContext.dt1`.
   */
  toDt1Map(libraryPaths?: Iterable<string>): Map<string, Dt1> {
    const out = new Map<string, Dt1>()
    const paths = libraryPaths ?? this.librariesByPath.keys()
    for (const p of paths) {
      const key = normalizeDrlgPath(p)
      out.set(key, this.toDt1(key))
    }
    return out
  }

  /**
   * Decode raw DT1 bytes and register them into this atlas.
   */
  registerRawDt1(libraryPath: string, rawBytes: Uint8Array): Dt1 {
    const key = normalizeDrlgPath(libraryPath)
    const dt1 = decodeDt1(rawBytes)
    this.dt1Cache.set(key, dt1)
    return dt1
  }
}
