/**
 * Seed-independent DT1 tile library & runtime DRLG asset packer (Feature F11).
 *
 * Reads all `LvlTypes.txt` DT1 libraries across Acts 1–5 plus the 3 mandatory
 * universal DT1s (`Blank.dt1`, `InvisWal.dt1` with `style=49 sequence=7` collision
 * floor, `Warp.dt1`) and hardcoded Act DT1s (`DRLG_HARDCODED_DT1_FILES`) from the
 * mounted MPQ archives, decodes every tile's 5x5 sub-tile collision flags and pixel
 * blocks, packs all tile frames into per-act 2048x2048 R8 & indexed-PNG atlas pages,
 * and writes:
 *   - `public/act-packs/tiles/act1..act5/{palette.bin, tiles-*.r8, tiles-*.png, index.json}`
 *   - `public/act-packs/tiles/index.json` (complete seed-independent tile library catalog)
 *   - `public/act-packs/tiles/{drlg-bundle.json, drlg-bundle.bin}` (compiled `.bin` tables,
 *     `.ds1` files, header-only `.dt1` files, and level/warp metadata for `map-worker.ts`)
 *
 * Usage:
 *   npx tsx scripts/pack-tiles.ts [archive-dir] [output-dir]
 */

import { existsSync } from 'node:fs'
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { decodeDt1, type Dt1Tile } from '../../common/formats/dt1.ts'
import {
  DEFAULT_CHAMPION_TRANSFORM_113C,
  DEFAULT_UNIQUE_TRANSFORM_113C,
  RAND_TRANSFORMS_113C,
  decodePl2,
  encodePaletteBin,
  type Pl2Transform,
} from '../../common/formats/pl2.ts'
import { cell, loadActTables } from '../../common/world/acts.ts'
import { DRLG_UNIVERSAL_DT1 } from '../../common/drlg/drlg-map.ts'
import {
  DRLG_TABLE_NAMES,
  drlgReferencedDs1Files,
  memoryDrlgSource,
  normalizeDrlgPath,
} from '../../common/drlg/drlg-source.ts'
import { loadDrlgTables, type DrlgTableName } from '../../common/drlg/drlg-tables.ts'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import {
  DRLG_HARDCODED_DT1_FILES,
  drlgActDt1Files,
  drlgSuperUniqueIds,
} from '../io/drlg-mpq-source.ts'
import { encodeIndexedPng } from '../io/png.ts'

const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const
const PAGE_SIZE = 2048
const DT1_TILE_HEADER_SIZE = 96

import {
  type PackedTilePlacement,
  type PackedDt1TileEntry,
  type PackedDt1LibraryEntry,
  type PackedActAtlasSummary,
  type PackedLevelMetaEntry,
  type PackedWarpMetaEntry,
  type PackedDrlgBundleManifest,
  type PackedTileCatalogIndex,
  validatePackManifest,
} from '../../common/pack-contract/index.ts'

export type {
  PackedTilePlacement,
  PackedDt1TileEntry,
  PackedDt1LibraryEntry,
  PackedActAtlasSummary,
  PackedLevelMetaEntry,
  PackedWarpMetaEntry,
  PackedDrlgBundleManifest,
  PackedTileCatalogIndex,
}
export { validatePackManifest }

interface ShelfPage {
  readonly pixels: Uint8Array
  frames: number
  maxUsedY: number
}

export class AtlasPagePacker {
  private readonly pages: ShelfPage[] = []
  private cursorX = 0
  private shelfY = 0
  private shelfHeight = 0
  private maxUsedY = 0

  add(frame: { readonly width: number; readonly height: number; readonly indices: Uint8Array }): {
    readonly page: number
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  } {
    const width = Math.max(1, Math.min(frame.width, PAGE_SIZE))
    const height = Math.max(1, Math.min(frame.height, PAGE_SIZE))
    if (this.cursorX + width > PAGE_SIZE) {
      this.shelfY += this.shelfHeight
      this.shelfHeight = 0
      this.cursorX = 0
    }
    if (this.pages.length === 0 || this.shelfY + height > PAGE_SIZE) {
      this.pages.push({ pixels: new Uint8Array(PAGE_SIZE * PAGE_SIZE), frames: 0, maxUsedY: 0 })
      this.shelfY = 0
      this.shelfHeight = 0
      this.cursorX = 0
      this.maxUsedY = 0
    }
    const pageIndex = this.pages.length - 1
    const page = this.pages[pageIndex]!
    const x = this.cursorX
    const y = this.shelfY
    for (let row = 0; row < height; row += 1) {
      const srcOffset = row * frame.width
      const dstOffset = (y + row) * PAGE_SIZE + x
      page.pixels.set(frame.indices.subarray(srcOffset, srcOffset + width), dstOffset)
    }
    this.cursorX += width
    this.shelfHeight = Math.max(this.shelfHeight, height)
    this.maxUsedY = Math.max(this.maxUsedY, this.shelfY + this.shelfHeight)
    page.maxUsedY = this.maxUsedY
    page.frames += 1
    return { page: pageIndex, x, y, width, height }
  }

  finalize(palette: Uint8Array): {
    readonly page: number
    readonly width: number
    readonly height: number
    readonly frames: number
    readonly r8: Uint8Array
    readonly png: Uint8Array
  }[] {
    return this.pages.map((page, index) => {
      const usedHeight = Math.max(1, this.measureUsedHeight(page))
      const r8 = page.pixels.subarray(0, PAGE_SIZE * usedHeight)
      const png = encodeIndexedPng({
        width: PAGE_SIZE,
        height: usedHeight,
        pixels: r8,
        palette,
        transparentIndex: 0,
        compressionLevel: 1,
      })
      return {
        page: index,
        width: PAGE_SIZE,
        height: usedHeight,
        frames: page.frames,
        r8,
        png,
      }
    })
  }

  private measureUsedHeight(page: ShelfPage): number {
    const startRow = Math.min(PAGE_SIZE, page.maxUsedY) - 1
    for (let row = startRow; row >= 0; row -= 1) {
      const base = row * PAGE_SIZE
      for (let x = 0; x < PAGE_SIZE; x += 1) {
        if (page.pixels[base + x] !== 0) return row + 1
      }
    }
    return 1
  }
}

function fnv1aHex(bytes: Uint8Array): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < bytes.byteLength; i += 1) {
    hash ^= bytes[i]!
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function compositeDt1Tile(tile: Dt1Tile): {
  readonly width: number
  readonly height: number
  readonly indices: Uint8Array
  readonly nonEmptyPixels: number
} {
  const width = Math.max(tile.width, 1)
  const height = Math.max(tile.bitmapHeight, 1)
  const indices = new Uint8Array(width * height)
  let nonEmptyPixels = 0
  for (const block of tile.blocks) {
    const limit = Math.min(indices.length, block.pixels.length)
    for (let at = 0; at < limit; at += 1) {
      const val = block.pixels[at]!
      if (val === 0) continue
      if (indices[at] === 0) nonEmptyPixels += 1
      indices[at] = val
    }
  }
  return { width, height, indices, nonEmptyPixels }
}

function resolveDefaultArchiveDir(argDir?: string): string {
  if (argDir && existsSync(argDir)) return argDir
  if (process.env.D2_DATA_DIR && existsSync(process.env.D2_DATA_DIR)) return process.env.D2_DATA_DIR
  if (existsSync('samples/d2')) return 'samples/d2'
  return argDir ?? 'samples/d2'
}

function extractDt1HeaderSlice(rawBytes: Uint8Array, path: string): Uint8Array {
  if (rawBytes.byteLength < 0x114) {
    throw new Error(`${path}: truncated DT1 header (${rawBytes.byteLength} bytes)`)
  }
  const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength)
  const nTiles = view.getInt32(0x10c, true)
  const nTileStart = view.getInt32(0x110, true)
  const end = nTileStart + nTiles * DT1_TILE_HEADER_SIZE
  if (nTiles < 0 || nTileStart < 0 || end > rawBytes.byteLength) {
    throw new Error(`${path}: invalid DT1 header bounds (nTiles=${nTiles}, nTileStart=${nTileStart})`)
  }
  return rawBytes.subarray(0, end)
}

function inferOwnerActFromPath(normalizedPath: string, acts: readonly number[]): number {
  const match = /[\\/]act([1-5])[\\/]/i.exec(normalizedPath)
  if (match) return Number(match[1])
  return acts[0] ?? 1
}

export async function runPackTiles(
  archiveDirInput?: string,
  outDirInput = 'public/act-packs/tiles',
): Promise<PackedTileCatalogIndex> {
  const archiveDir = resolveDefaultArchiveDir(archiveDirInput)
  const outDir = resolve(outDirInput)

  const archives = new MountedArchives()
  for (const name of MOUNTS) {
    archives.add(name, await MpqArchive.open(await fileSource(join(archiveDir, name))))
  }
  const actTables = await loadActTables(archives)

  // 1. Load DRLG compiled `.bin` tables
  const tableBytes = new Map<DrlgTableName, Uint8Array>()
  for (const name of DRLG_TABLE_NAMES) {
    tableBytes.set(name, await archives.read(`data\\global\\excel\\${name}.bin`))
  }
  const tables = loadDrlgTables(memoryDrlgSource(tableBytes, new Map()))
  const superUniqueIds = drlgSuperUniqueIds(actTables.superuniques, tables)

  // 2. Collect all DT1 files across Acts 1..5 + all LvlTypes rows + universal/hardcoded DT1s
  const dt1ArchivePathByKey = new Map<string, string>()
  const actsByDt1Key = new Map<string, Set<number>>()

  const registerDt1 = (archivePath: string, act1Based: number): void => {
    const key = normalizeDrlgPath(archivePath)
    if (!dt1ArchivePathByKey.has(key)) {
      dt1ArchivePathByKey.set(key, archivePath)
    }
    let set = actsByDt1Key.get(key)
    if (!set) {
      set = new Set<number>()
      actsByDt1Key.set(key, set)
    }
    set.add(act1Based)
  }

  for (let act = 1; act <= 5; act += 1) {
    for (const f of drlgActDt1Files(tables, act)) {
      registerDt1(f, act)
    }
  }
  for (let typeId = 0; typeId < tables.lvlTypes.length; typeId += 1) {
    const rec = tables.lvlTypes[typeId]!
    const act = rec.nAct >= 1 && rec.nAct <= 5 ? rec.nAct : 1
    for (const f of rec.szFile) {
      if (f.length > 1) registerDt1(f, act)
    }
  }
  for (const u of DRLG_UNIVERSAL_DT1) {
    for (let act = 1; act <= 5; act += 1) registerDt1(u, act)
  }
  for (const h of DRLG_HARDCODED_DT1_FILES) {
    for (let act = 1; act <= 5; act += 1) registerDt1(h, act)
  }

  // 3. Load Act palettes (act1..act5) and 1.13c color variation tables
  const palettes = new Map<number, Uint8Array>()
  const paletteBins = new Map<number, Uint8Array>()
  const packers = new Map<number, AtlasPagePacker>()
  for (let act = 1; act <= 5; act += 1) {
    const pl2Bytes = await archives.read(`data\\global\\palette\\act${String(act)}\\pal.pl2`)
    const pl2 = decodePl2(pl2Bytes)
    palettes.set(act, pl2.rgb)
    const variations: Pl2Transform[] = [
      pl2.hueVariations[107] ?? pl2.blueTones,
      pl2.hueVariations[103] ?? pl2.greenTones,
      DEFAULT_UNIQUE_TRANSFORM_113C,
      DEFAULT_CHAMPION_TRANSFORM_113C,
      RAND_TRANSFORMS_113C[0]!,
      RAND_TRANSFORMS_113C[1]!,
      RAND_TRANSFORMS_113C[2]!,
      RAND_TRANSFORMS_113C[3]!,
      RAND_TRANSFORMS_113C[5]!,
      RAND_TRANSFORMS_113C[6]!,
      RAND_TRANSFORMS_113C[9]!,
      RAND_TRANSFORMS_113C[12]!,
      RAND_TRANSFORMS_113C[15]!,
      RAND_TRANSFORMS_113C[18]!,
      RAND_TRANSFORMS_113C[21]!,
      RAND_TRANSFORMS_113C[27]!,
    ]
    paletteBins.set(act, encodePaletteBin(pl2.rgb, variations))
    packers.set(act, new AtlasPagePacker())
  }

  // 4. Read and decode every DT1 library, verifying 0 missing files
  const sortedDt1Keys = [...dt1ArchivePathByKey.keys()].sort((a, b) => a.localeCompare(b))
  const missingFiles: string[] = []
  const libraries: Record<string, PackedDt1LibraryEntry> = {}
  const dt1HeaderSlices = new Map<string, Uint8Array>()
  let totalTiles = 0
  let totalPlacedFrames = 0
  let invisWalFloorVerified = false

  for (const key of sortedDt1Keys) {
    const archivePath = dt1ArchivePathByKey.get(key)!
    let rawBytes: Uint8Array
    try {
      rawBytes = await archives.read(archivePath)
    } catch {
      missingFiles.push(archivePath)
      continue
    }

    dt1HeaderSlices.set(key, extractDt1HeaderSlice(rawBytes, key))
    const decoded = decodeDt1(rawBytes)
    const acts = [...(actsByDt1Key.get(key) ?? [1])].sort((a, b) => a - b)
    const ownerAct = inferOwnerActFromPath(key, acts)
    const packer = packers.get(ownerAct)!

    const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength)
    const tileDataStart = view.getInt32(0x110, true)

    const packedTiles: PackedDt1TileEntry[] = decoded.tiles.map((tile, index) => {
      const headerAt = tileDataStart + index * DT1_TILE_HEADER_SIZE
      const rawSubTileFlags: number[] = []
      for (let i = 0; i < 25; i += 1) {
        rawSubTileFlags.push(rawBytes[headerAt + 0x28 + i] ?? 0)
      }
      const subTileFlags = tile.subTileFlags.map(f => f.raw)

      if (
        key === DRLG_UNIVERSAL_DT1[1] &&
        tile.style === 49 &&
        tile.sequence === 7 &&
        tile.type === 0
      ) {
        invisWalFloorVerified = true
      }

      let placement: PackedTilePlacement | null = null
      if (tile.blocks.length > 0 && tile.width > 0 && tile.bitmapHeight > 0) {
        const composited = compositeDt1Tile(tile)
        if (composited.nonEmptyPixels > 0) {
          const rect = packer.add(composited)
          placement = {
            act: ownerAct,
            page: rect.page,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            nonEmptyPixels: composited.nonEmptyPixels,
            hash: fnv1aHex(composited.indices),
          }
          totalPlacedFrames += 1
        }
      }

      return {
        index,
        direction: tile.direction,
        roofHeight: tile.roofHeight,
        materialFlags: tile.materialFlags,
        animated: tile.animated,
        height: tile.height,
        width: tile.width,
        type: tile.type,
        style: tile.style,
        sequence: tile.sequence,
        rarityFrameIndex: tile.rarityFrameIndex,
        minBlockY: tile.minBlockY,
        bitmapHeight: tile.bitmapHeight,
        blockCount: tile.blocks.length,
        subTileFlags,
        rawSubTileFlags,
        placement,
      }
    })

    totalTiles += packedTiles.length
    libraries[key] = {
      path: key,
      archivePath,
      ownerAct,
      acts,
      versionMajor: decoded.versionMajor,
      versionMinor: decoded.versionMinor,
      tileCount: packedTiles.length,
      tiles: packedTiles,
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(`pack-tiles: ${String(missingFiles.length)} DT1 files missing: ${missingFiles.join(', ')}`)
  }
  if (!invisWalFloorVerified) {
    throw new Error('pack-tiles: InvisWal.dt1 style=49 sequence=7 floor tile was not found')
  }

  // 5. Write per-act atlas pages (.r8, .png, palette.bin, index.json)
  await mkdir(outDir, { recursive: true })
  const actSummaries: Record<string, PackedActAtlasSummary> = {}

  for (let act = 1; act <= 5; act += 1) {
    const actDir = join(outDir, `act${String(act)}`)
    await mkdir(actDir, { recursive: true })
    for (const existing of await readdir(actDir)) {
      if (existing.endsWith('.png') || existing.endsWith('.r8')) {
        await unlink(join(actDir, existing))
      }
    }

    const palette = palettes.get(act)!
    const paletteBin = paletteBins.get(act) ?? encodePaletteBin(palette)
    await writeFile(join(actDir, 'palette.bin'), paletteBin)

    const finalizedPages = packers.get(act)!.finalize(palette)
    const pageMeta: {
      readonly page: number
      readonly r8File: string
      readonly pngFile: string
      readonly width: number
      readonly height: number
      readonly frames: number
      readonly r8Bytes: number
      readonly pngBytes: number
    }[] = []

    for (const p of finalizedPages) {
      const r8File = `tiles-${String(p.page)}.r8`
      const pngFile = `tiles-${String(p.page)}.png`
      await writeFile(join(actDir, r8File), p.r8)
      await writeFile(join(actDir, pngFile), p.png)
      pageMeta.push({
        page: p.page,
        r8File,
        pngFile,
        width: p.width,
        height: p.height,
        frames: p.frames,
        r8Bytes: p.r8.byteLength,
        pngBytes: p.png.byteLength,
      })
    }

    const actLibKeys = sortedDt1Keys.filter(k => libraries[k]!.acts.includes(act))
    const actSummary: PackedActAtlasSummary = {
      act,
      paletteBytes: paletteBin.byteLength,
      missingFiles: 0,
      missingTiles: 0,
      pages: pageMeta,
      libraries: actLibKeys,
    }
    actSummaries[`act${String(act)}`] = actSummary

    const actLibraries: Record<string, PackedDt1LibraryEntry> = {}
    for (const k of actLibKeys) {
      actLibraries[k] = libraries[k]!
    }
    await writeFile(
      join(actDir, 'index.json'),
      // Compact JSON: the per-act tile index ships to the browser verbatim
      // (no-store dev fetch), pretty-printing triples its transfer size.
      JSON.stringify({ schema: 1, ...actSummary, librariesByPath: actLibraries }),
    )
  }

  // 6. Pack DRLG runtime bundle (`drlg-bundle.bin` + `drlg-bundle.json`)
  const ds1FilesList = drlgReferencedDs1Files(tables)
  const ds1BytesByKey = new Map<string, Uint8Array>()
  for (const ds1Path of ds1FilesList) {
    const key = normalizeDrlgPath(ds1Path)
    if (!ds1BytesByKey.has(key)) {
      ds1BytesByKey.set(key, await archives.read(ds1Path))
    }
  }

  const chunks: Uint8Array[] = []
  let currentOffset = 0
  const appendChunk = (bytes: Uint8Array): { readonly offset: number; readonly length: number } => {
    const offset = currentOffset
    const length = bytes.byteLength
    chunks.push(bytes)
    currentOffset += length
    return { offset, length }
  }

  const bundleTables = {} as Record<DrlgTableName, { readonly offset: number; readonly length: number }>
  for (const name of DRLG_TABLE_NAMES) {
    bundleTables[name] = appendChunk(tableBytes.get(name)!)
  }

  const bundleDs1Files: Record<string, { readonly offset: number; readonly length: number }> = {}
  for (const [key, bytes] of [...ds1BytesByKey.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    bundleDs1Files[key] = appendChunk(bytes)
  }

  const bundleDt1Headers: Record<string, { readonly offset: number; readonly length: number }> = {}
  for (const key of sortedDt1Keys) {
    bundleDt1Headers[key] = appendChunk(dt1HeaderSlices.get(key)!)
  }

  const bundleBinary = new Uint8Array(currentOffset)
  let writeCursor = 0
  for (const chunk of chunks) {
    bundleBinary.set(chunk, writeCursor)
    writeCursor += chunk.byteLength
  }

  const levelsMeta: PackedLevelMetaEntry[] = []
  for (const row of actTables.levels.rows) {
    const id = Number(cell(actTables.levels, row, 'Id'))
    if (!Number.isFinite(id) || id <= 0) continue
    const name = cell(actTables.levels, row, 'LevelName') || cell(actTables.levels, row, 'Name')
    const act = Number(cell(actTables.levels, row, 'Act')) + 1
    const drlgType = Number(cell(actTables.levels, row, 'DrlgType'))
    const levelType = Number(cell(actTables.levels, row, 'LevelType'))
    const layer = Number(cell(actTables.levels, row, 'Layer'))
    const wpRaw = cell(actTables.levels, row, 'Waypoint')
    const waypoint = wpRaw === '' ? 255 : Number(wpRaw)
    const vis: number[] = []
    const warp: number[] = []
    for (let s = 0; s < 8; s += 1) {
      vis.push(Number(cell(actTables.levels, row, `Vis${String(s)}`) || '0'))
      warp.push(Number(cell(actTables.levels, row, `Warp${String(s)}`) || '-1'))
    }
    levelsMeta.push({ id, name, act, drlgType, levelType, layer, waypoint, vis, warp })
  }

  const warpsMeta: PackedWarpMetaEntry[] = []
  for (const row of actTables.lvlwarp.rows) {
    const id = Number(cell(actTables.lvlwarp, row, 'Id'))
    if (!Number.isFinite(id)) continue
    warpsMeta.push({
      id,
      selectX: Number(cell(actTables.lvlwarp, row, 'SelectX') || '0'),
      selectY: Number(cell(actTables.lvlwarp, row, 'SelectY') || '0'),
      selectDX: Number(cell(actTables.lvlwarp, row, 'SelectDX') || '0'),
      selectDY: Number(cell(actTables.lvlwarp, row, 'SelectDY') || '0'),
      exitWalkX: Number(cell(actTables.lvlwarp, row, 'ExitWalkX') || '0'),
      exitWalkY: Number(cell(actTables.lvlwarp, row, 'ExitWalkY') || '0'),
      offsetX: Number(cell(actTables.lvlwarp, row, 'OffsetX') || '0'),
      offsetY: Number(cell(actTables.lvlwarp, row, 'OffsetY') || '0'),
      litVersion: Number(cell(actTables.lvlwarp, row, 'LitVersion') || '0') !== 0,
      tiles: Number(cell(actTables.lvlwarp, row, 'Tiles') || '0'),
      direction: cell(actTables.lvlwarp, row, 'Direction'),
    })
  }

  const bundleManifest: PackedDrlgBundleManifest = {
    schema: 1,
    binaryFile: 'drlg-bundle.bin',
    totalBytes: bundleBinary.byteLength,
    tables: bundleTables,
    ds1Files: bundleDs1Files,
    dt1HeaderFiles: bundleDt1Headers,
    superUniqueIds,
    levels: levelsMeta,
    warps: warpsMeta,
  }

  await writeFile(join(outDir, 'drlg-bundle.bin'), bundleBinary)
  await writeFile(join(outDir, 'drlg-bundle.json'), JSON.stringify(bundleManifest))

  const catalogIndex: PackedTileCatalogIndex = {
    schema: 1,
    totalLibraries: sortedDt1Keys.length,
    totalTiles,
    totalPlacedFrames,
    missingFiles,
    universalDt1s: [...DRLG_UNIVERSAL_DT1],
    hardcodedDt1s: DRLG_HARDCODED_DT1_FILES.map(normalizeDrlgPath),
    invisWalFloorVerified,
    acts: actSummaries,
    libraries,
    drlgBundle: {
      manifestFile: 'drlg-bundle.json',
      binaryFile: 'drlg-bundle.bin',
      totalBytes: bundleBinary.byteLength,
    },
  }

  // Compact JSON: this catalog is fetched in full by MapService.fromPackedUrl
  // at boot; the pretty-printed variant was 21.7MB vs ~6.5MB compact.
  await writeFile(join(outDir, 'index.json'), JSON.stringify(catalogIndex))

  return catalogIndex
}

function parseTilesCliArgs(argv: readonly string[]): { archiveArg?: string; outArg?: string } {
  let archiveArg: string | undefined
  let outArg: string | undefined
  const positional: string[] = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!
    if (arg === '--mpq-dir' && argv[i + 1]) {
      archiveArg = argv[++i]!
    } else if (arg.startsWith('--mpq-dir=')) {
      archiveArg = arg.slice('--mpq-dir='.length)
    } else if (arg === '--out-dir' && argv[i + 1]) {
      const base = argv[++i]!
      outArg = base.endsWith('tiles') ? base : join(base, 'act-packs', 'tiles')
    } else if (arg.startsWith('--out-dir=')) {
      const base = arg.slice('--out-dir='.length)
      outArg = base.endsWith('tiles') ? base : join(base, 'act-packs', 'tiles')
    } else if (!arg.startsWith('--')) {
      positional.push(arg)
    }
  }
  if (positional[0]) archiveArg = positional[0]
  if (positional[1]) outArg = positional[1]
  return { ...(archiveArg ? { archiveArg } : {}), ...(outArg ? { outArg } : {}) }
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  const { archiveArg, outArg } = parseTilesCliArgs(process.argv.slice(2))
  const t0 = performance.now()
  const result = await runPackTiles(archiveArg, outArg)
  const elapsedSec = ((performance.now() - t0) / 1000).toFixed(2)
  console.log(
    `[pack-tiles] Packed ${String(result.totalLibraries)} DT1 libraries (${String(result.totalTiles)} tiles, ` +
      `${String(result.totalPlacedFrames)} atlas frames) + DRLG bundle (${String(result.drlgBundle.totalBytes)} bytes) ` +
      `in ${elapsedSec}s — missingFiles=${String(result.missingFiles.length)}, invisWalFloorVerified=${String(result.invisWalFloorVerified)}`,
  )
}

