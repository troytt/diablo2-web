/**
 * Shared JSON/manifest interfaces for baked asset packs (`public/packs/`).
 *
 * Consumed by both `src/baker/` (packers & verifiers) and `src/client/` (asset loaders).
 */

import type { AutomapLayerData } from '../formats/automap-table.ts'
import type { D2DrawModeBlend } from '../gfx/draw-mode.ts'
import type { ActLayout } from '../world/act-variants.ts'
import type { SceneEntrance, SceneWarp, SceneWaypoint } from '../world/level-links.ts'
import type { MonsterStats } from '../units/unit-types.ts'

export interface PackIndexEntry {
  readonly act: number
  readonly id?: number
  readonly levelId?: number
  readonly kind?: 'preset' | 'maze' | 'wilderness'
  readonly slug: string
  readonly label?: string
  readonly name?: string
  readonly title?: string
  readonly levelName?: string
  readonly path?: string
  readonly pages?: number
  readonly ds1?: string
  readonly actVariant?: number
  readonly fidelity?: 'exact' | 'layout' | 'approximation'
  readonly size?: { readonly width: number; readonly height: number }
}

export interface PackIndex {
  readonly generatedAt?: string
  readonly palettes?: Record<string, number[]>
  readonly levels: readonly PackIndexEntry[]
  readonly actLayouts?: Readonly<Record<string, readonly ActLayout[]>>
}

export interface PackObjectFrame {
  readonly page?: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly offsetX: number
  readonly offsetY: number
}

export interface PackObject {
  readonly id: number
  readonly type: number
  readonly name?: string | null
  readonly token?: string
  readonly mode?: string
  readonly objectsTxtId?: number
  readonly hp?: number
  readonly member?: string | null
  readonly alternatives?: number
  readonly x?: number
  readonly y?: number
  readonly subX?: number
  readonly subY?: number
  readonly orderFlag?: 0 | 1 | 2
  readonly interactive?: boolean
  readonly selectable?: boolean
  readonly operateRange?: number
  readonly frameCnt?: number
  readonly frameCount?: number
  readonly width?: number
  readonly height?: number
  readonly offsetX?: number
  readonly offsetY?: number
  readonly atlasX?: number
  readonly atlasY?: number
  readonly animAtlas?: string
  readonly depth?: number
  readonly frame?: PackObjectFrame | null
  readonly frames?: readonly PackObjectFrame[]
  readonly opFrames?: readonly PackObjectFrame[]
  readonly onFrames?: readonly PackObjectFrame[]
  readonly animatedFrames?: readonly PackObjectFrame[] | null
  readonly frameDelta?: number
  readonly frameDurationMs?: number
  readonly cycleAnim?: boolean
  readonly sync?: boolean
  readonly trans?: number | undefined
  readonly blendMode?: 'normal' | 'additive' | undefined
}

export interface PackSceneJson {
  readonly act: number
  readonly id?: number
  readonly levelId?: number
  readonly slug?: string
  readonly name?: string
  readonly title?: string
  readonly levelName?: string
  readonly ds1?: string
  readonly fidelity?: 'exact' | 'layout' | 'approximation'
  readonly cellsX?: number
  readonly cellsY?: number
  readonly width?: number
  readonly height?: number
  readonly originX: number
  readonly originY: number
  readonly widthPx?: number
  readonly heightPx?: number
  readonly pxWidth?: number
  readonly pxHeight?: number
  readonly pages?: readonly { readonly file: string; readonly width: number; readonly height: number }[]
  readonly objectPages?: readonly { readonly file: string; readonly width: number; readonly height: number }[]
  readonly frames?: readonly (readonly number[])[]
  readonly framePlacement?: readonly (readonly number[])[]
  readonly floors?: readonly (readonly number[])[]
  readonly shadows?: readonly (readonly number[])[]
  readonly walls?: readonly (readonly number[])[]
  readonly roofs?: readonly (readonly number[])[]
  readonly objects: readonly PackObject[]
  readonly npcs?: readonly PackObject[]
  readonly animSpeed?: number | undefined
  readonly frameDurationMs?: number | undefined
  readonly monsters?: {
    readonly types: readonly string[]
    readonly budget: number
    readonly packs: readonly { readonly members: readonly MonsterStats[] }[]
  }
  readonly collision?: { readonly width: number; readonly height: number; readonly runs: readonly (readonly number[])[] }
  readonly spawn: readonly number[] | { readonly subX: number; readonly subY: number } | null
  readonly entrances?: readonly SceneEntrance[]
  readonly warps?: readonly SceneWarp[]
  readonly waypoints?: readonly SceneWaypoint[]
  readonly automap?: AutomapLayerData | undefined
  readonly stats?: { readonly missingTiles: number; readonly walkable: number }
}

import type { DrlgTableName } from '../drlg/drlg-tables.ts'

export interface ClipMeta {
  readonly group: number
  readonly directions: number
  readonly frames: number
  readonly framesPerDir?: number
  readonly speed: number
  readonly loop: boolean
  readonly events: readonly { readonly f: number; readonly c: number }[]
  readonly cellW?: number
  readonly cellH?: number
  readonly pivotX?: number
  readonly pivotY?: number
  readonly hitFrame?: number
  readonly frameDurationMs?: number
  readonly animSpeed?: number
  readonly atlasImage?: string
  readonly additiveAtlasImage?: string
}

export interface EntityMeta {
  readonly schema: number
  readonly token?: string
  readonly mode?: string
  readonly weapon?: string
  readonly weaponClass?: string
  readonly file: string
  readonly format?: string
  readonly blendMode?: D2DrawModeBlend
  readonly width: number
  readonly height: number
  readonly directions: number
  readonly framesPerDir?: number
  readonly cellW?: number
  readonly cellH?: number
  readonly pivotX?: number
  readonly pivotY?: number
  readonly hitFrame?: number
  readonly frameDurationMs?: number
  readonly animSpeed?: number
  readonly clips?: Record<string, ClipMeta>
  readonly modes?: Record<string, ClipMeta>
  readonly glowClips?: Record<string, ClipMeta>
  readonly walk?: number
  readonly stand?: number
  readonly walkOffset?: number
  readonly standOffset?: number
  readonly walkFrames?: number
  readonly standFrames?: number
  readonly members?: number
  /**
   * Present only when the frames did not fit into one atlas page of at most
   * {@link ENTITY_ATLAS_MAX_PAGE_HEIGHT} rows (e.g. Diablo `DI`, issue #921).
   * `pages[0]` is always `file` / `width` / `height`; frame tuples then carry
   * a 7th element: the index into this array.
   */
  readonly pages?: readonly EntityAtlasPage[]
  readonly groups: EntityFrameTuple[][]
  readonly glowGroups?: EntityFrameTuple[][]
}

/** `[x, y, width, height, anchorX, anchorY, page?]` — `page` defaults to 0. */
export type EntityFrameTuple = [number, number, number, number, number, number, number?]

/** One raw R8 page of a multi-page entity atlas. */
export interface EntityAtlasPage {
  readonly file: string
  readonly width: number
  readonly height: number
}

/**
 * Tallest entity atlas page the baker may emit. One un-paged pack (Diablo,
 * 4096x27997) exceeded every desktop GPU's `MAX_TEXTURE_SIZE` (16384), so
 * `addIndexedAtlas` threw and the monster was never drawn (issue #921).
 * 4096 is square with the page width and well inside every WebGL2 limit seen
 * in practice.
 */
export const ENTITY_ATLAS_MAX_PAGE_HEIGHT = 4096

export type PackedMonsterJson = EntityMeta
export type PackedCharJson = EntityMeta

export interface PackedEntityIndexEntry {
  readonly key: string
  readonly token: string
  readonly weapon: string
  readonly file: string
  readonly format?: string | undefined
  readonly blendMode?: D2DrawModeBlend | undefined
  readonly width: number
  readonly height: number
  readonly directions: number
}

export interface MonsterIndexEntry {
  readonly hcIdx: number
  readonly classId: number
  readonly id: string
  readonly token: string
  readonly weapon: string
  readonly key: string | null
  readonly slug: string | null
  readonly file: string | null
  readonly metaFile: string | null
  readonly packPath: string | null
  readonly inTown: boolean
  readonly npc: boolean
  readonly isNpc: boolean
  readonly interact: boolean
  readonly align: number
  readonly sizeX: number
  readonly sizeY: number
  readonly velocity: number
  readonly run: number
  readonly directions: number
  readonly dirCount: number
  readonly scale: number
  readonly baseCol: number
  readonly modes: readonly string[]
}

export interface ObjectIndexEntry {
  readonly id: number
  readonly classId: number
  readonly name: string
  readonly description: string
  readonly token: string
  readonly slug: string | null
  readonly file: string | null
  readonly metaFile: string | null
  readonly packPath: string | null
  readonly actTokens: Readonly<Record<number, string>>
  readonly actSlugs: Readonly<Record<number, string>>
  readonly baseIsMonsters: boolean
  readonly draw: boolean
  readonly isDoor: boolean
  readonly subClass: number
  readonly sizeX: number
  readonly sizeY: number
  readonly xOffset: number
  readonly yOffset: number
  readonly operateRange: number
  readonly selectable: readonly boolean[]
  readonly frameCnt: readonly number[]
  readonly frameCounts: readonly number[]
  readonly frameDelta: readonly number[]
  readonly frameDeltas: readonly number[]
  readonly cycleAnim: readonly boolean[]
  readonly start: readonly number[]
  readonly directions: number
  readonly dirCount: number
  readonly modes: readonly string[]
  readonly blendMode?: D2DrawModeBlend | undefined
  readonly trans?: number | undefined
}

export interface ObjectLookupIndexEntry {
  readonly act: number
  readonly type: number
  readonly ds1Id: number
  readonly id: number
  readonly objectsTxtId: number
  readonly classId: number
  readonly token: string
  readonly mode: string
  readonly direction: number
  readonly baseIsMonsters: boolean
  readonly slug: string | null
  readonly file: string | null
  readonly metaFile: string | null
  readonly packPath: string | null
}

export interface PackedEntityCatalogIndex {
  readonly schema: number
  readonly character: string
  readonly characters?: readonly string[] | undefined
  readonly entities: readonly PackedEntityIndexEntry[]
  readonly monsterByClassId?: Readonly<Record<string, MonsterIndexEntry>> | undefined
  readonly monstersByHcIdx?: Readonly<Record<string, MonsterIndexEntry>> | undefined
  readonly objectByClassId?: Readonly<Record<string, ObjectIndexEntry>> | undefined
  readonly objectsByClassId?: Readonly<Record<string, ObjectIndexEntry>> | undefined
  readonly objectLookupByActTypeId?: Readonly<Record<string, ObjectLookupIndexEntry>> | undefined
}

export interface PackedTilePlacement {
  readonly act: number
  readonly page: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly nonEmptyPixels: number
  readonly hash: string
}

export interface PackedDt1TileEntry {
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

export interface PackedDt1LibraryEntry {
  readonly path: string
  readonly archivePath: string
  readonly ownerAct: number
  readonly acts: readonly number[]
  readonly versionMajor: number
  readonly versionMinor: number
  readonly tileCount: number
  readonly tiles: readonly PackedDt1TileEntry[]
}

export interface PackedActAtlasSummary {
  readonly act: number
  readonly paletteBytes: number
  readonly missingFiles?: number
  readonly missingTiles?: number
  readonly pages: readonly {
    readonly page: number
    readonly r8File: string
    readonly pngFile: string
    readonly width: number
    readonly height: number
    readonly frames: number
    readonly r8Bytes: number
    readonly pngBytes: number
  }[]
  readonly libraries: readonly string[]
}

export interface PackedLevelMetaEntry {
  readonly id: number
  readonly name: string
  readonly act: number
  readonly drlgType: number
  readonly levelType: number
  readonly layer: number
  readonly waypoint: number
  readonly vis: readonly number[]
  readonly warp: readonly number[]
}

export interface PackedWarpMetaEntry {
  readonly id: number
  readonly selectX: number
  readonly selectY: number
  readonly selectDX: number
  readonly selectDY: number
  readonly exitWalkX: number
  readonly exitWalkY: number
  readonly offsetX: number
  readonly offsetY: number
  readonly litVersion: boolean
  readonly tiles: number
  readonly direction: string
}

export interface PackedDrlgBundleManifest {
  readonly schema: 1
  readonly binaryFile: string
  readonly totalBytes: number
  readonly tables: Readonly<Record<DrlgTableName, { readonly offset: number; readonly length: number }>>
  readonly ds1Files: Readonly<Record<string, { readonly offset: number; readonly length: number }>>
  readonly dt1HeaderFiles: Readonly<Record<string, { readonly offset: number; readonly length: number }>>
  readonly superUniqueIds: readonly string[]
  readonly levels: readonly PackedLevelMetaEntry[]
  readonly warps: readonly PackedWarpMetaEntry[]
}

export interface PackedTileCatalogIndex {
  readonly schema: 1
  readonly totalLibraries: number
  readonly totalTiles: number
  readonly totalPlacedFrames: number
  readonly missingFiles: readonly string[]
  readonly universalDt1s: readonly string[]
  readonly hardcodedDt1s: readonly string[]
  readonly invisWalFloorVerified: boolean
  readonly acts: Readonly<Record<string, PackedActAtlasSummary>>
  readonly libraries: Readonly<Record<string, PackedDt1LibraryEntry>>
  readonly drlgBundle: {
    readonly manifestFile: string
    readonly binaryFile: string
    readonly totalBytes: number
  }
}

export interface SpriteRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly offsetX?: number | undefined
  readonly offsetY?: number | undefined
}

export type AutomapSpriteKey =
  | 'MaxiMap'
  | 'MaxiMapS'
  | 'Act2Map'
  | 'Act2MapS'
  | 'Act4Map'
  | 'Act4MapS'
  | 'ExTnMap'
  | 'ExTnMapS'

export interface AutomapSpriteFrameMeta {
  readonly width: number
  readonly height: number
  readonly offsetX: number
  readonly offsetY: number
  readonly x: number
  readonly y: number
}

export interface AutomapSpriteAtlasMeta {
  readonly image: string
  readonly atlasWidth: number
  readonly atlasHeight: number
  readonly columns: number
  readonly cellWidth: number
  readonly cellHeight: number
  readonly frameCount: number
  readonly frames: readonly AutomapSpriteFrameMeta[]
}

export interface AutomapUiManifest {
  readonly atlases: Readonly<Record<AutomapSpriteKey, AutomapSpriteAtlasMeta>>
}

export interface QuestAssetInfo {
  readonly activeIcon: string
  readonly doneIcon: string
  readonly doneFrame: number
}

export interface BakedUiManifest {
  readonly version: string
  readonly decodedDc6Count: number
  readonly dc6DecodeFailures: number
  readonly atlasWidth: number
  readonly atlasHeight: number
  readonly questsAtlasWidth: number
  readonly questsAtlasHeight: number
  readonly codeToInvFile: Record<string, string>
  readonly codeToFlippyFile: Record<string, string>
  readonly itemRects: Record<string, SpriteRect>
  readonly flippyRects: Record<string, SpriteRect>
  readonly flippyFrames?: Readonly<Record<string, readonly SpriteRect[]>> | undefined
  readonly itemClassIdToCode?: Readonly<Record<number, string>> | undefined
  readonly questRects: Record<string, SpriteRect>
  readonly images: Record<string, string>
  readonly automapAtlases?: Readonly<Record<AutomapSpriteKey, AutomapSpriteAtlasMeta>>
}

/**
 * Ground Truth (`DRLGROOM_LoadDt1Files` @ `0x6fdb8400` in `D2Common.dll` v1.13c):
 * The 3 universal DT1 libraries unconditionally prepended to every level's tile table.
 */
export const UNIVERSAL_DT1_PATHS = [
  'data\\global\\tiles\\Act1\\Outdoors\\Blank.dt1',
  'data\\global\\tiles\\Act1\\Barracks\\InvisWal.dt1',
  'data\\global\\tiles\\Act1\\Barracks\\Warp.dt1',
] as const

export interface UniversalDt1TileLike {
  readonly type?: number | undefined
  readonly orientation?: number | undefined
  readonly style?: number | undefined
  readonly mainIndex?: number | undefined
  readonly sequence?: number | undefined
  readonly subIndex?: number | undefined
}

export interface UniversalDt1LibraryLike {
  readonly path?: string | undefined
  readonly archivePath?: string | undefined
  readonly name?: string | undefined
  readonly tiles?: readonly UniversalDt1TileLike[] | undefined
}

function normalizeDt1Path(p: string): string {
  return p.trim().replace(/\//g, '\\').toLowerCase()
}

/**
 * Validates that a level's DT1 library list includes the 3 universal DT1s
 * (`Blank.dt1`, `InvisWal.dt1`, `Warp.dt1`) and, when decoded tile objects are
 * provided, that `InvisWal.dt1` provides the canonical `style=49, sequence=7`
 * collision floor tile. Fails fast on any violation.
 */
export function validateUniversalDt1Libraries(
  libraries:
    | readonly (UniversalDt1LibraryLike | string)[]
    | { readonly dt1Names: readonly string[] },
  context?: string,
): void {
  const list: readonly (UniversalDt1LibraryLike | string)[] = Array.isArray(libraries)
    ? libraries
    : libraries && typeof libraries === 'object' && 'dt1Names' in libraries
      ? libraries.dt1Names
      : []

  const prefix = context ? `Universal DT1 validation failed (${context})` : 'Universal DT1 validation failed'

  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(
      `${prefix}: missing Blank.dt1, InvisWal.dt1, Warp.dt1 (empty libraries array)`,
    )
  }

  for (const requiredPath of UNIVERSAL_DT1_PATHS) {
    const reqNorm = normalizeDt1Path(requiredPath)
    const fileName = requiredPath.split('\\').pop()!
    const fileNorm = fileName.toLowerCase()

    const match = list.find(lib => {
      const raw =
        typeof lib === 'string'
          ? lib
          : (lib?.path ?? lib?.archivePath ?? lib?.name ?? '')
      const norm = normalizeDt1Path(raw)
      return norm === reqNorm || norm.endsWith(`\\${fileNorm}`) || norm === fileNorm
    })

    if (!match) {
      throw new Error(`${prefix}: missing required library ${fileName} (${requiredPath})`)
    }

    if (typeof match !== 'string') {
      if (!Array.isArray(match.tiles) || match.tiles.length === 0) {
        throw new Error(`${prefix}: ${fileName} has 0 decoded tiles`)
      }

      if (fileNorm === 'inviswal.dt1') {
        const hasCollisionFloor = match.tiles.some((t: UniversalDt1TileLike) => {
          const style = t.style ?? t.mainIndex
          const sequence = t.sequence ?? t.subIndex
          const orientation = t.type ?? t.orientation ?? 0
          return orientation === 0 && style === 49 && sequence === 7
        })
        if (!hasCollisionFloor) {
          throw new Error(
            `${prefix}: InvisWal.dt1 is missing canonical collision floor tile (style=49, sequence=7)`,
          )
        }
      }
    }
  }
}

export interface PackManifestStatsLike {
  readonly missingFiles?: number | readonly string[] | undefined
  readonly missingTiles?: number | undefined
  readonly invisWalFloorVerified?: boolean | undefined
  readonly libraries?: Readonly<Record<string, UniversalDt1LibraryLike>> | undefined
}

/**
 * Fails fast if a baked pack manifest reports any `missingFiles` or `missingTiles`,
 * or if a `PackedTileCatalogIndex` is missing universal DT1s / `invisWalFloorVerified`.
 */
export function validatePackManifest<T extends PackManifestStatsLike>(manifest: T): T {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Invalid pack manifest: expected object')
  }
  if (typeof manifest.missingFiles === 'number' && manifest.missingFiles > 0) {
    throw new Error(`Pack manifest validation failed: missingFiles=${manifest.missingFiles} (must be 0)`)
  }
  if (Array.isArray(manifest.missingFiles) && manifest.missingFiles.length > 0) {
    throw new Error(
      `Pack manifest validation failed: missingFiles=${manifest.missingFiles.length} (${manifest.missingFiles.join(', ')})`,
    )
  }
  if (typeof manifest.missingTiles === 'number' && manifest.missingTiles > 0) {
    throw new Error(`Pack manifest validation failed: missingTiles=${manifest.missingTiles} (must be 0)`)
  }
  if ('invisWalFloorVerified' in manifest && manifest.invisWalFloorVerified === false) {
    throw new Error('Pack manifest validation failed: invisWalFloorVerified is false')
  }
  if (manifest.libraries && typeof manifest.libraries === 'object') {
    validateUniversalDt1Libraries(Object.values(manifest.libraries))
  }
  return manifest
}

export interface AssetManifest {
  readonly schema: 1
  readonly version: string
  readonly generatedAt: string
  readonly totalFiles: number
  readonly totalBytes: number
  /**
   * Map from canonical relative asset path (e.g. "act-packs/tiles/index.json",
   * "packs/entities/char-so.r8", "missiles/arrow.png", "ui/manifest.json")
   * to its 16-hex-char SHA-256 content hash prefix.
   */
  readonly files: Readonly<Record<string, string>>
  readonly assets?: Readonly<Record<string, AssetManifestAssetValue>> | undefined
}

export interface AssetManifestPackEntry {
  readonly sha256: string
  readonly bytes: number
  readonly size?: number | undefined
}

export type AssetManifestAssetValue = string | AssetManifestPackEntry

export interface AssetManifestDiff {
  readonly changedOrRemoved: readonly string[]
  readonly added: readonly string[]
  readonly unchangedCount: number
}

/** First-screen precache URLs (never includes streaming `/sound/music/*.webm` tracks per D16). */
export const PRECACHE_URLS: readonly string[] = Object.freeze(['/sound/packs/sfx-core.bin'])

const HEX_HASH_RE = /^[0-9a-f]{16,64}$/i

export const CACHEABLE_PREFIXES = [
  'packs/',
  'act-packs/',
  'missiles/',
  'missiles-pd2/',
  'overlays/',
  'overlays-pd2/',
  'skills/',
  'ui/',
  'ui-pd2/',
  'items-pd2/',
  'assets/',
  'entities/',
  'characters/',
  'chars/',
  'anim/',
  'weather/',
  'tiles/',
  'sound/',
  'cursor-pd2/',
] as const

/**
 * Explicit allowlist for top-level `public/<dir>/` roots that are intentionally
 * excluded from `asset-manifest.json` and Service Worker `cache-first` caching.
 * Any new `public/<dir>/` directory must be added to either {@link CACHEABLE_PREFIXES}
 * or {@link INTENTIONALLY_UNCACHED_PUBLIC_DIRS}; otherwise `validatePublicAssetRoots`
 * fails fast so new asset roots can never be silently omitted (#1314).
 */
export const INTENTIONALLY_UNCACHED_PUBLIC_DIRS: readonly string[] = [] as const

/**
 * Explicit allowlist for top-level files directly under `public/` that are
 * intentionally excluded from `asset-manifest.json` and Service Worker `cache-first`.
 */
export const INTENTIONALLY_UNCACHED_PUBLIC_FILES: readonly string[] = [
  'asset-manifest.json',
  'manifest.webmanifest',
  'musicbox.html',
  'sw.js',
  'updates.json',
] as const

const CACHEABLE_EXT_RE =
  /\.(?:json|png|r8|bin|d2|txt|dc6|dcc|dt1|ds1|tbl|dat|woff2?|ttf|otf|js|css|webm|opus)$/i

/**
 * Normalizes a URL or relative path into a canonical manifest key:
 * - Strips scheme/origin, query string, and hash fragment
 * - Converts backslashes to forward slashes and collapses duplicate slashes
 * - Strips leading `/` and optional `diablo2/` deployment base prefix
 * - Maps `samples/d2-packs/...` to canonical `packs/...`
 */
export function normalizeAssetManifestPath(urlOrPath: string): string {
  if (typeof urlOrPath !== 'string') return ''
  let clean = urlOrPath.trim()
  if (!clean) return ''

  // Strip scheme + origin if full URL
  clean = clean.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]*/, '')
  // Strip query and hash
  const qIdx = clean.search(/[?#]/)
  if (qIdx >= 0) {
    clean = clean.slice(0, qIdx)
  }

  clean = clean.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '')
  if (clean.startsWith('diablo2/')) {
    clean = clean.slice('diablo2/'.length)
  }
  if (clean.startsWith('samples/d2-packs/')) {
    clean = `packs/${clean.slice('samples/d2-packs/'.length)}`
  }
  return clean
}

/**
 * Returns true if the URL or path is a cacheable art/JSON/static asset.
 * Explicitly excludes `.mpq` archives (cached via OPFS range chunks),
 * `asset-manifest.json` (always fetched fresh), `sw.js`, and WebSocket endpoints.
 */
export function isCacheableAssetPath(urlOrPath: string): boolean {
  const norm = normalizeAssetManifestPath(urlOrPath)
  if (!norm) return false
  const lower = norm.toLowerCase()
  if (
    lower === 'asset-manifest.json' ||
    lower.endsWith('/asset-manifest.json') ||
    lower === 'sw.js' ||
    lower.endsWith('/sw.js') ||
    lower.endsWith('.mpq') ||
    lower.startsWith('d2net/') ||
    lower.startsWith('ws/')
  ) {
    return false
  }
  if (!CACHEABLE_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return false
  }
  return CACHEABLE_EXT_RE.test(lower)
}

/**
 * Strictly validates an `AssetManifest` payload, failing fast on missing or corrupt fields.
 */
export function validateAssetManifest(raw: unknown): AssetManifest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Asset manifest validation failed: expected JSON object')
  }
  const obj = raw as Record<string, unknown>
  if (obj.schema !== 1) {
    throw new Error(`Asset manifest validation failed: unsupported schema=${String(obj.schema)} (expected 1)`)
  }
  if (typeof obj.version !== 'string' || obj.version.trim().length === 0) {
    throw new Error('Asset manifest validation failed: missing non-empty version string')
  }
  if (typeof obj.generatedAt !== 'string' || obj.generatedAt.trim().length === 0) {
    throw new Error('Asset manifest validation failed: missing non-empty generatedAt timestamp')
  }
  if (typeof obj.totalFiles !== 'number' || !Number.isInteger(obj.totalFiles) || obj.totalFiles < 0) {
    throw new Error(`Asset manifest validation failed: invalid totalFiles=${String(obj.totalFiles)}`)
  }
  if (typeof obj.totalBytes !== 'number' || !Number.isFinite(obj.totalBytes) || obj.totalBytes < 0) {
    throw new Error(`Asset manifest validation failed: invalid totalBytes=${String(obj.totalBytes)}`)
  }
  if (!obj.files || typeof obj.files !== 'object' || Array.isArray(obj.files)) {
    throw new Error('Asset manifest validation failed: files must be a plain object map')
  }

  const filesRec = obj.files as Record<string, unknown>
  for (const [key, val] of Object.entries(filesRec)) {
    if (!key || key.startsWith('/') || key.includes('..') || key.includes('\\')) {
      throw new Error(`Asset manifest validation failed: invalid asset path key "${key}"`)
    }
    if (typeof val !== 'string' || !HEX_HASH_RE.test(val)) {
      throw new Error(`Asset manifest validation failed: invalid sha256 hash "${String(val)}" for "${key}"`)
    }
  }

  const typedFiles = filesRec as Readonly<Record<string, string>>
  const hasEnumerableAssets =
    Object.prototype.hasOwnProperty.call(obj, 'assets') &&
    obj.assets !== null &&
    typeof obj.assets === 'object' &&
    !Array.isArray(obj.assets)
  const typedAssets = hasEnumerableAssets
    ? (obj.assets as Readonly<Record<string, AssetManifestAssetValue>>)
    : typedFiles
  const manifest: AssetManifest = {
    schema: 1,
    version: obj.version,
    generatedAt: obj.generatedAt,
    totalFiles: obj.totalFiles,
    totalBytes: obj.totalBytes,
    files: typedFiles,
    ...(hasEnumerableAssets ? { assets: typedAssets } : {}),
  }
  if (!hasEnumerableAssets) {
    Object.defineProperty(manifest, 'assets', {
      value: typedFiles,
      enumerable: false,
      configurable: false,
      writable: false,
    })
  }
  return manifest
}

/**
 * Computes incremental invalidation between a previously cached manifest and a newly fetched manifest.
 * Only files whose hash changed or that were removed from `next` are marked for cache eviction.
 */
export function diffAssetManifests(
  prev: AssetManifest | null | undefined,
  next: AssetManifest,
): AssetManifestDiff {
  if (!prev) {
    return {
      changedOrRemoved: [],
      added: Object.keys(next.files).sort(),
      unchangedCount: 0,
    }
  }

  const changedOrRemoved: string[] = []
  const added: string[] = []
  let unchangedCount = 0

  for (const [path, prevHash] of Object.entries(prev.files)) {
    const nextHash = next.files[path]
    if (nextHash === undefined || nextHash !== prevHash) {
      changedOrRemoved.push(path)
    } else {
      unchangedCount += 1
    }
  }

  for (const path of Object.keys(next.files)) {
    if (!(path in prev.files)) {
      added.push(path)
    }
  }

  changedOrRemoved.sort()
  added.sort()

  return {
    changedOrRemoved,
    added,
    unchangedCount,
  }
}

export * from './weather-manifest.ts'
