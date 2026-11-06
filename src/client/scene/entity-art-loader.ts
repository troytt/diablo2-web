import type { Palette } from '../../common/formats/pal.ts'
import type { D2DrawModeBlend } from '../../common/gfx/draw-mode.ts'
import type {
  EntityAtlasPage,
  MonsterIndexEntry,
  ObjectIndexEntry,
  PackedEntityCatalogIndex,
} from '../../common/pack-contract/index.ts'
import type { AnimClipMeta } from '../../common/units/unit-types.ts'
import { ADDITIVE_MONSTER_TOKENS, type CofLayerDrawBlendMode, type LoadedMonsterArt } from '../render/monster-art.ts'
import { resolveMonsterArtSpec } from '../../common/units/monster-mapping.ts'
import { resolveMonsterComponentVariantKey113c } from '../../common/units/monster-component-variants-113c.ts'
import type { AtlasFrame } from '../render/atlas.ts'
import type { AtlasHandle, SpriteRenderer } from '../render/renderer.ts'
import { reportMissingArt, resolvePreloadMiss } from './missing-art.ts'
import { normalizeHeroToken } from '../../common/world/scene-population.ts'

export { ADDITIVE_MONSTER_TOKENS }
export type { MonsterIndexEntry, ObjectIndexEntry, PackedEntityCatalogIndex }

/** Base locations tried in order when `?base=` is absent. */
export const DEFAULT_BASES = ['samples/d2', '/diablo2/data']

export type ObjectClipArt = AnimClipMeta

/** A composited map/interactive object uploaded as an indexed R8 atlas page. */
export interface LoadedObjectArt {
  readonly token: string
  readonly slug: string
  readonly handle: AtlasHandle
  readonly groups: readonly (readonly AtlasFrame[])[]
  readonly glowGroups?: readonly (readonly AtlasFrame[])[]
  readonly blendMode: CofLayerDrawBlendMode
  readonly directions: number
  readonly standOffset: number
  readonly standFrames: number
  readonly clips: Readonly<Record<string, AnimClipMeta>>
  readonly glowClips?: Readonly<Record<string, AnimClipMeta>>
  readonly start?: readonly number[]
  readonly frameCnt?: readonly number[]
  readonly frameDelta?: readonly number[]
  readonly cycleAnim?: readonly boolean[]
  readonly trans?: number
  readonly xOffset?: number
  readonly yOffset?: number
}

export type ObjectArtEntry = LoadedObjectArt

/** A composited character, uploaded as its own atlas page. */
export interface LoadedCharacter {
  readonly handle: AtlasHandle
  /** `atlas.groups[direction][frame]`, ready to draw. */
  readonly groups: readonly (readonly AtlasFrame[])[]
  readonly directions: number
  readonly walk: number
  readonly stand: number
  readonly members: number
  readonly clips?: Readonly<Record<string, AnimClipMeta>>
}

export interface PackedMonsterJson {
  readonly schema?: number
  readonly token: string
  readonly weapon?: string
  readonly file: string
  readonly width: number
  readonly height: number
  readonly blendMode?: CofLayerDrawBlendMode | D2DrawModeBlend | undefined
  readonly directions: number
  readonly walkOffset?: number
  readonly standOffset: number
  readonly walkFrames?: number
  readonly standFrames: number
  readonly clips?: Readonly<Record<string, AnimClipMeta>>
  readonly modes?: Readonly<Record<string, AnimClipMeta>>
  readonly glowClips?: Readonly<Record<string, AnimClipMeta>>
  /** Multi-page packs only (issue #921); `pages[0]` mirrors `file` / `width` / `height`. */
  readonly pages?: readonly EntityAtlasPage[] | undefined
  readonly groups: readonly (readonly [number, number, number, number, number?, number?, number?])[][]
  readonly glowGroups?: readonly (readonly [number, number, number, number, number?, number?, number?])[][] | undefined
  readonly anchorZeroed?: boolean | undefined
}

export type PackedObjectJson = PackedMonsterJson

export interface PackedCharJson {
  readonly schema?: number
  readonly file: string
  readonly width: number
  readonly height: number
  readonly directions: number
  readonly walk: number
  readonly stand: number
  readonly members: number
  readonly clips?: Readonly<Record<string, AnimClipMeta>>
  readonly groups: readonly (readonly [number, number, number, number, number?, number?])[][]
}

const OPAQUE_MONSTER_TOKENS: ReadonlySet<string> = new Set([
  'DC', // Deckard Cain (cain1..4, cain6)
  'XS', // Anya / Drehya (drehya, drehyaiced)
  '0J', // Nihlathak (town)
  'IP', // Demon Imp (imp1..8)
  'HK', // Druid Hawk
  'ST', // Flying Scimitar
])

export function normalizeMonsterBlendMode(
  token: string,
  rawBlendMode: CofLayerDrawBlendMode | D2DrawModeBlend | undefined,
): CofLayerDrawBlendMode {
  const upper = token.trim().toUpperCase()
  if (OPAQUE_MONSTER_TOKENS.has(upper)) {
    return 'normal'
  }
  if (
    rawBlendMode === 'additive' ||
    rawBlendMode === 'trans25' ||
    rawBlendMode === 'trans50' ||
    rawBlendMode === 'trans75' ||
    rawBlendMode === 'burn'
  ) {
    return rawBlendMode
  }
  return 'normal'
}

/**
 * What a monster-art load produced, including what it failed to produce.
 */
export interface MonsterArtLoad {
  /** Monster id (lower case) to its atlas. */
  readonly map: Map<string, LoadedMonsterArt>
  /** Monster ids left with no atlas: every one of these draws as a red box. */
  readonly missing: string[]
  /** Loads that threw — a per-spec failure, or the whole function. */
  readonly errors: number
  /** COF layers dropped inside the art that *did* load: monsters missing limbs. */
  readonly layerFailures: number
}

/**
 * The monster ids that got no atlas.
 *
 * @param monsterIds - the ids the level asked for.
 * @param loaded - the ids that loaded, lower case.
 * @returns the missing ids, lower case and deduplicated, in request order.
 */
export function missingMonsterArtIds(
  monsterIds: readonly string[],
  loaded: ReadonlySet<string>,
): string[] {
  const missing: string[] = []
  for (const id of monsterIds) {
    const key = id.toLowerCase()
    if (!loaded.has(key) && !missing.includes(key)) missing.push(key)
  }
  return missing
}

/**
 * Load monster atlases on-demand for all monster types present in the scene.
 * Prefers pre-baked indexed PNG + JSON from the act pack when available (< 200ms),
 * falling back to runtime MPQ HTTP Range extraction only if pre-packed assets are missing.
 */
export async function loadMonsterArtMap(
  _bases: readonly string[],
  monsterIds: readonly string[],
  _palette: Palette,
  renderer: SpriteRenderer,
  packBase?: string,
  act?: number,
): Promise<MonsterArtLoad> {
  const map = new Map<string, LoadedMonsterArt>()
  let errors = 0
  let layerFailures = 0
  if (monsterIds.length === 0) return { map, missing: [], errors, layerFailures }
  try {
    const tokenSpecs = new Map<string, { token: string; weapon: string }>()
    for (const id of monsterIds) {
      const spec = resolveMonsterArtSpec(id)
      if (spec !== null) {
        const key = `${spec.token}-${spec.weapon}`
        if (!tokenSpecs.has(key)) {
          tokenSpecs.set(key, spec)
        }
      }
    }

    const loadedBySpecKey = new Map<string, LoadedMonsterArt>()
    const fallbackSpecs: Array<[string, { token: string; weapon: string }]> = []

    if (packBase !== undefined) {
      const cleanBase = packBase.replace(/\/+$/, '')
      const candidateEntityPrefixes = [
        ...(cleanBase ? [`${cleanBase}/entities`] : []),
        '/entities',
      ].filter((p, idx, arr) => arr.indexOf(p) === idx)
      const actEntitiesUrl = act !== undefined && cleanBase ? `${cleanBase}/act${String(act)}/entities` : undefined
      await Promise.all(
        [...tokenSpecs.entries()].map(async ([key, spec]) => {
          const slug = `monster-${spec.token.toLowerCase()}-${spec.weapon.toLowerCase()}`
          for (const globalEntitiesUrl of candidateEntityPrefixes) {
            try {
              const [jsonResp, r8Resp] = await Promise.all([
                fetch(`${globalEntitiesUrl}/${slug}.json`),
                fetch(`${globalEntitiesUrl}/${slug}.r8`),
              ])
              if (jsonResp.ok && r8Resp.ok) {
                const meta = (await jsonResp.json()) as PackedMonsterJson
                const indices = new Uint8Array(await r8Resp.arrayBuffer())
                const pageHandles = await uploadEntityAtlasPages(renderer, fetch, globalEntitiesUrl, meta, indices)
                const handle = pageHandles[0]!
                const groups = mapRawGroupsToAtlasFrames(meta.groups, pageHandles)
                const glowGroups: AtlasFrame[][] | undefined = meta.glowGroups !== undefined
                  ? mapRawGroupsToAtlasFrames(meta.glowGroups, pageHandles)
                  : undefined
                const clips = meta.clips ?? meta.modes
                const glowClips = sanitizeGlowClips(clips, meta.glowClips)
                loadedBySpecKey.set(key, {
                  token: spec.token,
                  handle,
                  groups,
                  ...(glowGroups !== undefined ? { glowGroups } : {}),
                  blendMode: normalizeMonsterBlendMode(spec.token, meta.blendMode),
                  directions: meta.directions,
                  walkOffset: meta.walkOffset ?? meta.standOffset,
                  standOffset: meta.standOffset,
                  walkFrames: meta.walkFrames ?? meta.standFrames,
                  standFrames: meta.standFrames,
                  ...(clips !== undefined ? { clips } : {}),
                  ...(glowClips !== undefined ? { glowClips } : {}),
                  layerFailures: [],
                })
                return
              }
            } catch (err) {
              console.warn(`monster art ${slug}: packed r8 unavailable: ${(err as Error).message}`)
            }
          }

          if (actEntitiesUrl !== undefined) {
            try {
              const [jsonResp, pngResp] = await Promise.all([
                fetch(`${actEntitiesUrl}/${slug}.json`),
                fetch(`${actEntitiesUrl}/${slug}.png`),
              ])
              if (jsonResp.ok && pngResp.ok) {
                const meta = (await jsonResp.json()) as PackedMonsterJson
                const bitmap = await createImageBitmap(await pngResp.blob())
                let handle: AtlasHandle
                try {
                  handle = renderer.addAtlas(bitmap, meta.width, meta.height)
                } finally {
                  bitmap.close()
                }
                const groups: AtlasFrame[][] = meta.groups.map(group =>
                  group.map(([x, y, width, height, anchorX, anchorY]) => ({
                    x, y, width, height,
                    ...(anchorX !== undefined ? { anchorX } : {}),
                    ...(anchorY !== undefined ? { anchorY } : {}),
                  })),
                )
                const glowGroups: AtlasFrame[][] | undefined = meta.glowGroups !== undefined
                  ? meta.glowGroups.map(group =>
                      group.map(([x, y, width, height, anchorX, anchorY]) => ({
                        x, y, width, height,
                        ...(anchorX !== undefined ? { anchorX } : {}),
                        ...(anchorY !== undefined ? { anchorY } : {}),
                      })),
                    )
                  : undefined
                const clips = meta.clips ?? meta.modes
                const glowClips = sanitizeGlowClips(clips, meta.glowClips)
                loadedBySpecKey.set(key, {
                  token: spec.token,
                  handle,
                  groups,
                  ...(glowGroups !== undefined ? { glowGroups } : {}),
                  blendMode: normalizeMonsterBlendMode(spec.token, meta.blendMode),
                  directions: meta.directions,
                  walkOffset: meta.walkOffset ?? meta.standOffset,
                  standOffset: meta.standOffset,
                  walkFrames: meta.walkFrames ?? meta.standFrames,
                  standFrames: meta.standFrames,
                  ...(clips !== undefined ? { clips } : {}),
                  ...(glowClips !== undefined ? { glowClips } : {}),
                  layerFailures: [],
                })
                return
              }
            } catch (err) {
              console.warn(`monster art ${slug}: packed png unavailable: ${(err as Error).message}`)
            }
          }
          fallbackSpecs.push([key, spec])
        }),
      )
    } else {
      fallbackSpecs.push(...tokenSpecs.entries())
    }

    if (fallbackSpecs.length > 0) {
      for (const [, spec] of fallbackSpecs) {
        errors += 1
        console.error(`monster art ${spec.token} (${spec.weapon}) unavailable in pre-baked packs`)
      }
    }

    for (const loaded of loadedBySpecKey.values()) layerFailures += loaded.layerFailures.length

    for (const id of monsterIds) {
      const spec = resolveMonsterArtSpec(id)
      if (spec !== null) {
        const key = `${spec.token}-${spec.weapon}`
        const loaded = loadedBySpecKey.get(key)
        if (loaded !== undefined) {
          map.set(id.toLowerCase(), loaded)
        }
      }
    }
  } catch (err) {
    errors += 1
    console.error(`monster art loading error: ${(err as Error).message}`)
  }
  return { map, missing: missingMonsterArtIds(monsterIds, new Set(map.keys())), errors, layerFailures }
}

export async function loadCharacterArt(
  _bases: readonly string[],
  _palette: Palette | null,
  renderer: SpriteRenderer,
  packBase?: string,
  act?: number,
  token?: string,
): Promise<LoadedCharacter | null> {
  if (!token || !token.trim()) {
    throw new Error(
      '[entity-art-loader] Missing character token in loadCharacterArt (fail-fast, no silent "so" fallback)',
    )
  }
  const heroToken = normalizeHeroToken(token)
  if (packBase !== undefined) {
    const cleanBase = packBase.replace(/\/+$/, '')
    const r8CandidatePrefixes = [
      ...(cleanBase ? [`${cleanBase}/entities`] : []),
      '/entities',
    ]
    const seenPrefixes = new Set<string>()
    for (const prefix of r8CandidatePrefixes) {
      if (seenPrefixes.has(prefix)) continue
      seenPrefixes.add(prefix)
      try {
        const [jsonResp, r8Resp] = await Promise.all([
          fetch(`${prefix}/char-${heroToken}.json`),
          fetch(`${prefix}/char-${heroToken}.r8`),
        ])
        if (jsonResp.ok && r8Resp.ok) {
          const meta = (await jsonResp.json()) as PackedCharJson
          const indices = new Uint8Array(await r8Resp.arrayBuffer())
          const handle = renderer.addIndexedAtlas(indices, meta.width, meta.height)
          const groups: AtlasFrame[][] = meta.groups.map(group =>
            group.map(([x, y, width, height, anchorX, anchorY]) => ({
              x, y, width, height,
              ...(anchorX !== undefined ? { anchorX } : {}),
              ...(anchorY !== undefined ? { anchorY } : {}),
            })),
          )
          return {
            handle,
            groups,
            directions: meta.directions,
            walk: meta.walk,
            stand: meta.stand,
            members: meta.members,
            ...(meta.clips !== undefined ? { clips: meta.clips } : {}),
          }
        }
      } catch {
        // try next candidate prefix
      }
    }

    if (act !== undefined && cleanBase) {
      const entitiesUrl = `${cleanBase}/act${String(act)}/entities`
      try {
        const [jsonResp, pngResp] = await Promise.all([
          fetch(`${entitiesUrl}/char-${heroToken}.json`),
          fetch(`${entitiesUrl}/char-${heroToken}.png`),
        ])
        if (jsonResp.ok && pngResp.ok) {
          const meta = (await jsonResp.json()) as PackedCharJson
          const bitmap = await createImageBitmap(await pngResp.blob())
          let handle: AtlasHandle
          try {
            handle = renderer.addAtlas(bitmap, meta.width, meta.height)
          } finally {
            bitmap.close()
          }
          const groups: AtlasFrame[][] = meta.groups.map(group =>
            group.map(([x, y, width, height, anchorX, anchorY]) => ({
              x, y, width, height,
              ...(anchorX !== undefined ? { anchorX } : {}),
              ...(anchorY !== undefined ? { anchorY } : {}),
            })),
          )
          return {
            handle,
            groups,
            directions: meta.directions,
            walk: meta.walk,
            stand: meta.stand,
            members: meta.members,
            ...(meta.clips !== undefined ? { clips: meta.clips } : {}),
          }
        }
      } catch {
        // failed to load pack character
      }
    }
  }

  console.warn(`character art unavailable for ${heroToken} in pre-baked packs`)
  reportMissingArt('player', heroToken, `character art unavailable for ${heroToken} in pre-baked packs`)
  return null
}

function mapRawGroupsToAtlasFrames(
  rawGroups: readonly (readonly [number, number, number, number, number?, number?, number?])[][],
  pageHandles?: readonly AtlasHandle[],
): AtlasFrame[][] {
  return rawGroups.map(group =>
    group.map(([x, y, width, height, anchorX, anchorY, page]) => ({
      x,
      y,
      width,
      height,
      ...(anchorX !== undefined ? { anchorX } : {}),
      ...(anchorY !== undefined ? { anchorY } : {}),
      ...resolveFramePage(page, pageHandles),
    })),
  )
}

/**
 * Bind a packed frame to its atlas page (7th tuple element). Single-page packs
 * carry no page index and keep drawing from `art.handle`.
 */
function resolveFramePage(
  page: number | undefined,
  pageHandles: readonly AtlasHandle[] | undefined,
): { atlas?: AtlasHandle } {
  if (page === undefined) return {}
  const handle = pageHandles?.[page]
  if (handle === undefined) {
    throw new Error(`entity frame references atlas page ${String(page)} but only ${String(pageHandles?.length ?? 0)} page(s) were uploaded`)
  }
  return { atlas: handle }
}

/**
 * Upload every R8 page of a baked entity pack. `page0` is the `<slug>.r8`
 * bytes already fetched alongside the JSON; extra pages listed in
 * `meta.pages` are fetched from the same directory. Any missing or
 * mis-sized page throws — a half-uploaded pack would draw garbage.
 */
export async function uploadEntityAtlasPages(
  renderer: Pick<SpriteRenderer, 'addIndexedAtlas'>,
  fetchFn: typeof fetch,
  dirUrl: string,
  meta: Pick<PackedMonsterJson, 'file' | 'width' | 'height' | 'pages'>,
  page0: Uint8Array,
): Promise<AtlasHandle[]> {
  const pages = meta.pages ?? [{ file: meta.file, width: meta.width, height: meta.height }]
  const bytes: Uint8Array[] = [page0]
  if (pages.length > 1) {
    const rest = await Promise.all(
      pages.slice(1).map(async p => {
        const resp = await fetchFn(`${dirUrl}/${p.file}`)
        if (!resp.ok) throw new Error(`entity atlas page ${p.file} unavailable (HTTP ${String(resp.status)})`)
        return new Uint8Array(await resp.arrayBuffer())
      }),
    )
    bytes.push(...rest)
  }
  return pages.map((p, i) => {
    const b = bytes[i]!
    if (pages.length > 1 && b.byteLength !== p.width * p.height) {
      throw new Error(`entity atlas page ${p.file} is ${String(b.byteLength)} bytes, expected ${String(p.width)}x${String(p.height)}`)
    }
    return renderer.addIndexedAtlas(b, p.width, p.height)
  })
}

function dirOf(url: string): string {
  const cut = url.lastIndexOf('/')
  return cut >= 0 ? url.slice(0, cut) : ''
}

export function sanitizeGlowClips(
  clips: Readonly<Record<string, AnimClipMeta>> | undefined,
  glowClips: Readonly<Record<string, AnimClipMeta>> | undefined,
): Readonly<Record<string, AnimClipMeta>> | undefined {
  if (!glowClips) return undefined
  if (!clips) return glowClips
  const out: Record<string, AnimClipMeta> = {}
  for (const [k, glowClip] of Object.entries(glowClips)) {
    const baseClip = clips[k]
    if (baseClip === undefined || glowClip.group === baseClip.group) {
      out[k] = glowClip
    }
  }
  return out
}

function buildLoadedObjectArt(
  meta: PackedObjectJson,
  cleanSlug: string,
  handle: AtlasHandle,
  groups: AtlasFrame[][],
  glowGroups: AtlasFrame[][] | undefined,
  indexEntry: ObjectIndexEntry | undefined,
): LoadedObjectArt {
  const clips = meta.clips ?? meta.modes ?? {}
  const glowClips = sanitizeGlowClips(clips, meta.glowClips)
  return {
    token: meta.token || cleanSlug.toUpperCase(),
    slug: cleanSlug,
    handle,
    groups,
    ...(glowGroups !== undefined ? { glowGroups } : {}),
    blendMode:
      meta.blendMode === 'trans25' || meta.blendMode === 'trans50' || meta.blendMode === 'trans75'
        ? meta.blendMode
        : indexEntry?.blendMode === 'trans25' || indexEntry?.blendMode === 'trans50' || indexEntry?.blendMode === 'trans75'
          ? indexEntry.blendMode
          : meta.blendMode === 'additive' ||
            indexEntry?.blendMode === 'additive' ||
            indexEntry?.trans === 1 ||
            indexEntry?.trans === 2
            ? 'additive'
            : 'normal',
    directions: Math.max(1, meta.directions || 1),
    standOffset: meta.standOffset ?? 0,
    standFrames: Math.max(1, meta.standFrames || 1),
    clips,
    ...(glowClips !== undefined ? { glowClips } : {}),
    ...(indexEntry?.start !== undefined ? { start: indexEntry.start } : {}),
    ...(indexEntry?.frameCnt !== undefined ? { frameCnt: indexEntry.frameCnt } : {}),
    ...(indexEntry?.frameDelta !== undefined ? { frameDelta: indexEntry.frameDelta } : {}),
    ...(indexEntry?.cycleAnim !== undefined ? { cycleAnim: indexEntry.cycleAnim } : {}),
    ...(indexEntry?.trans !== undefined ? { trans: indexEntry.trans } : {}),
    ...(indexEntry?.xOffset !== undefined ? { xOffset: indexEntry.xOffset } : {}),
    ...(indexEntry?.yOffset !== undefined ? { yOffset: indexEntry.yOffset } : {}),
  }
}

export async function loadObjectArt(
  renderer: SpriteRenderer,
  slugOrToken: string,
  packBase = '',
  act?: number,
  indexEntry?: ObjectIndexEntry,
  fetchFn: typeof fetch = fetch,
): Promise<LoadedObjectArt | null> {
  const cleanSlug = slugOrToken.trim().toLowerCase().replace(/^object-/, '')
  if (!cleanSlug) return null

  const cleanBase = packBase.replace(/\/+$/, '')
  const candidateBases = [cleanBase, ''].filter(
    (b, idx, arr) => arr.indexOf(b) === idx,
  )
  for (const base of candidateBases) {
    const prefix = base ? `${base}/entities` : '/entities'
    for (const subPath of [`${prefix}/object-${cleanSlug}`]) {
      try {
        const [jsonResp, r8Resp] = await Promise.all([
          fetchFn(`${subPath}.json`),
          fetchFn(`${subPath}.r8`),
        ])
        if (jsonResp.ok && r8Resp.ok) {
          const meta = (await jsonResp.json()) as PackedObjectJson
          const indices = new Uint8Array(await r8Resp.arrayBuffer())
          const pageHandles = await uploadEntityAtlasPages(renderer, fetchFn, dirOf(subPath), meta, indices)
          const handle = pageHandles[0]!
          const groups = mapRawGroupsToAtlasFrames(meta.groups, pageHandles)
          const glowGroups =
            meta.glowGroups !== undefined
              ? mapRawGroupsToAtlasFrames(meta.glowGroups, pageHandles)
              : undefined
          return buildLoadedObjectArt(meta, cleanSlug, handle, groups, glowGroups, indexEntry)
        }
      } catch {
        // try next candidate
      }
    }
  }

  if (act !== undefined && cleanBase) {
    const actEntitiesUrl = `${cleanBase}/act${String(act)}/entities`
    try {
      const [jsonResp, pngResp] = await Promise.all([
        fetchFn(`${actEntitiesUrl}/object-${cleanSlug}.json`),
        fetchFn(`${actEntitiesUrl}/object-${cleanSlug}.png`),
      ])
      if (jsonResp.ok && pngResp.ok) {
        const meta = (await jsonResp.json()) as PackedObjectJson
        const bitmap = await createImageBitmap(await pngResp.blob())
        let handle: AtlasHandle
        try {
          handle = renderer.addAtlas(bitmap, meta.width, meta.height)
        } finally {
          bitmap.close()
        }
        const groups = mapRawGroupsToAtlasFrames(meta.groups)
        const glowGroups =
          meta.glowGroups !== undefined
            ? mapRawGroupsToAtlasFrames(meta.glowGroups)
            : undefined
        return buildLoadedObjectArt(meta, cleanSlug, handle, groups, glowGroups, indexEntry)
      }
    } catch {
      // fall through
    }
  }

  reportMissingArt('object', cleanSlug, `Failed to load object art for slug=${cleanSlug}`)
  return null
}

export type EntityLoadPriority = 'urgent' | 'preload-current' | 'preload-neighbor'

export const DEFAULT_MAX_BACKGROUND_ENTITY_CONCURRENCY = 2

const ENTITY_PRIORITY_RANK: Readonly<Record<EntityLoadPriority, number>> = {
  urgent: 0,
  'preload-current': 1,
  'preload-neighbor': 2,
}

interface ScheduledEntityFetchTask<T> {
  readonly taskKey: string
  priority: EntityLoadPriority
  started: boolean
  readonly run: () => Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (reason?: unknown) => void
  readonly promise: Promise<T>
}

export interface EntityArtQueueStats {
  readonly activeUrgent: number
  readonly activeBackground: number
  readonly queuedUrgent: number
  readonly queuedBackground: number
}

export interface EntityArtCacheOptions {
  readonly renderer: SpriteRenderer
  readonly packBase?: string | undefined
  readonly act?: number | undefined
  readonly onArtLoaded?: (() => void) | undefined
  readonly fetchFn?: typeof fetch | undefined
  readonly initialCatalog?: PackedEntityCatalogIndex | undefined
  readonly maxBackgroundConcurrency?: number | undefined
}

/**
 * On-demand `classId`-indexed entity art cache for Monsters/Town NPCs (`0xAC` `hcIdx`)
 * and Map/Interactive Objects (`0x51` `Objects.txt` `classId`).
 *
 * Separates high-priority `'urgent'` fetches (live units on screen) from bounded-concurrency
 * background `preloadEntities` fetches (`'preload-current'` ahead of `'preload-neighbor'`),
 * promoting queued background tasks immediately if a matching unit spawns on screen (#1775).
 */
export class EntityArtCache {
  private readonly renderer: SpriteRenderer
  private readonly packBase: string
  private defaultAct: number | undefined
  private readonly onArtLoaded: (() => void) | undefined
  private readonly fetchFn: typeof fetch
  private readonly maxBackgroundConcurrency: number

  private catalog: PackedEntityCatalogIndex | null = null
  private indexState: 'idle' | 'loading' | 'loaded' | 'failed' = 'idle'
  private indexPromise: Promise<PackedEntityCatalogIndex | null> | null = null

  private readonly monsterByClassIdCache = new Map<number, LoadedMonsterArt>()
  private readonly monsterBySpecKeyCache = new Map<string, LoadedMonsterArt>()
  private readonly monsterInflightBySpecKey = new Map<string, Promise<LoadedMonsterArt | null>>()
  private readonly monsterSpecKeyByClassId = new Map<number, string>()
  private readonly inflightMonsters = new Set<number>()
  private readonly failedMonsters = new Set<number>()
  private readonly failedMonsterVariantKeys = new Set<string>()

  private readonly objectByClassIdCache = new Map<string, LoadedObjectArt>()
  private readonly objectBySlugCache = new Map<string, LoadedObjectArt>()
  private readonly objectInflightBySlug = new Map<string, Promise<LoadedObjectArt | null>>()
  private readonly objectSlugByCacheKey = new Map<string, string>()
  private readonly inflightObjects = new Set<string>()
  private readonly failedObjects = new Set<string>()
  private readonly pendingTasksByKey = new Map<string, ScheduledEntityFetchTask<unknown>>()
  private readonly taskQueue: ScheduledEntityFetchTask<unknown>[] = []
  private activeUrgentCount = 0
  private activeBackgroundCount = 0
  private clearGeneration = 0

  constructor(
    rendererOrOptions: SpriteRenderer | EntityArtCacheOptions,
    packBase = '',
    onArtLoaded?: () => void,
  ) {
    if ('addIndexedAtlas' in rendererOrOptions) {
      this.renderer = rendererOrOptions
      this.packBase = packBase
      this.onArtLoaded = onArtLoaded
      this.maxBackgroundConcurrency = DEFAULT_MAX_BACKGROUND_ENTITY_CONCURRENCY
      this.fetchFn = typeof fetch !== 'undefined' ? fetch.bind(globalThis) : (() => Promise.reject(new Error('fetch unavailable'))) as unknown as typeof fetch
    } else {
      this.renderer = rendererOrOptions.renderer
      this.packBase = rendererOrOptions.packBase ?? ''
      this.defaultAct = rendererOrOptions.act
      this.onArtLoaded = rendererOrOptions.onArtLoaded
      this.maxBackgroundConcurrency = Math.max(
        1,
        Math.floor(
          rendererOrOptions.maxBackgroundConcurrency ?? DEFAULT_MAX_BACKGROUND_ENTITY_CONCURRENCY,
        ),
      )
      this.fetchFn =
        rendererOrOptions.fetchFn ??
        (typeof fetch !== 'undefined'
          ? fetch.bind(globalThis)
          : ((() => Promise.reject(new Error('fetch unavailable'))) as unknown as typeof fetch))
      if (rendererOrOptions.initialCatalog) {
        this.catalog = rendererOrOptions.initialCatalog
        this.indexState = 'loaded'
      }
    }
  }

  get isIndexLoaded(): boolean {
    return this.indexState === 'loaded' && this.catalog !== null
  }

  getCatalog(): PackedEntityCatalogIndex | null {
    return this.catalog
  }

  setCatalog(catalog: PackedEntityCatalogIndex): void {
    this.catalog = catalog
    this.indexState = 'loaded'
  }

  setMonsterArt(classId: number, art: LoadedMonsterArt): void {
    this.monsterByClassIdCache.set(classId, art)
    this.failedMonsters.delete(classId)
    this.inflightMonsters.delete(classId)
  }

  setObjectArt(classId: number, art: LoadedObjectArt, act?: number): void {
    this.objectByClassIdCache.set(`${classId}:${act ?? 0}`, art)
    this.objectByClassIdCache.set(`${classId}:0`, art)
    this.failedObjects.delete(`${classId}:${act ?? 0}`)
    this.failedObjects.delete(`${classId}:0`)
  }

  private collectArtHandles(
    art: Pick<LoadedMonsterArt | LoadedObjectArt, 'handle' | 'groups' | 'glowGroups'>,
    into: Set<AtlasHandle>,
  ): void {
    into.add(art.handle)
    for (const group of art.groups) {
      for (const frame of group) {
        const pageAtlas = (frame as { readonly atlas?: AtlasHandle }).atlas
        if (pageAtlas !== undefined) into.add(pageAtlas)
      }
    }
    if (art.glowGroups) {
      for (const group of art.glowGroups) {
        for (const frame of group) {
          const pageAtlas = (frame as { readonly atlas?: AtlasHandle }).atlas
          if (pageAtlas !== undefined) into.add(pageAtlas)
        }
      }
    }
  }

  private deleteArtHandles(handles: Iterable<AtlasHandle>): void {
    const deleteFn = (this.renderer as { deleteAtlas?: (h: AtlasHandle) => void }).deleteAtlas
    if (typeof deleteFn !== 'function') return
    for (const h of handles) {
      deleteFn.call(this.renderer, h)
    }
  }

  /**
   * Release all GPU monster and object atlases uploaded during the game session while keeping
   * the parsed `index.json` catalog metadata warm for the next game.
   */
  clear(): void {
    this.clearGeneration += 1
    const handles = new Set<AtlasHandle>()
    for (const art of this.monsterBySpecKeyCache.values()) {
      this.collectArtHandles(art, handles)
    }
    for (const art of this.monsterByClassIdCache.values()) {
      this.collectArtHandles(art, handles)
    }
    for (const art of this.objectBySlugCache.values()) {
      this.collectArtHandles(art, handles)
    }
    for (const art of this.objectByClassIdCache.values()) {
      this.collectArtHandles(art, handles)
    }
    this.monsterByClassIdCache.clear()
    this.monsterBySpecKeyCache.clear()
    this.monsterInflightBySpecKey.clear()
    this.monsterSpecKeyByClassId.clear()
    this.inflightMonsters.clear()
    this.failedMonsters.clear()
    this.failedMonsterVariantKeys.clear()
    this.objectByClassIdCache.clear()
    this.objectBySlugCache.clear()
    this.objectInflightBySlug.clear()
    this.objectSlugByCacheKey.clear()
    this.inflightObjects.clear()
    this.failedObjects.clear()
    const dropped = this.taskQueue.splice(0, this.taskQueue.length)
    for (const task of dropped) {
      this.pendingTasksByKey.delete(task.taskKey)
      task.resolve(null)
    }
    this.deleteArtHandles(handles)
  }

  getQueueStats(): EntityArtQueueStats {
    let queuedUrgent = 0
    let queuedBackground = 0
    for (const task of this.taskQueue) {
      if (task.priority === 'urgent') queuedUrgent += 1
      else queuedBackground += 1
    }
    return {
      activeUrgent: this.activeUrgentCount,
      activeBackground: this.activeBackgroundCount,
      queuedUrgent,
      queuedBackground,
    }
  }

  private promoteTaskPriority(taskKey: string, priority: EntityLoadPriority): void {
    const task = this.pendingTasksByKey.get(taskKey)
    if (!task || task.started) return
    if (ENTITY_PRIORITY_RANK[priority] < ENTITY_PRIORITY_RANK[task.priority]) {
      task.priority = priority
      this.pumpTaskQueue()
    }
  }

  private schedulePackFetch<T>(
    taskKey: string,
    priority: EntityLoadPriority,
    run: () => Promise<T>,
  ): Promise<T> {
    const existing = this.pendingTasksByKey.get(taskKey) as ScheduledEntityFetchTask<T> | undefined
    if (existing !== undefined) {
      this.promoteTaskPriority(taskKey, priority)
      return existing.promise
    }
    let resolveFn!: (value: T) => void
    let rejectFn!: (reason?: unknown) => void
    const promise = new Promise<T>((resolve, reject) => {
      resolveFn = resolve
      rejectFn = reject
    })
    const task: ScheduledEntityFetchTask<T> = {
      taskKey,
      priority,
      started: false,
      run,
      resolve: resolveFn,
      reject: rejectFn,
      promise,
    }
    this.pendingTasksByKey.set(taskKey, task as ScheduledEntityFetchTask<unknown>)
    this.taskQueue.push(task as ScheduledEntityFetchTask<unknown>)
    this.pumpTaskQueue()
    return promise
  }

  private pumpTaskQueue(): void {
    // 1. Dispatch every queued `'urgent'` task immediately with zero queuing delay.
    while (true) {
      const urgentIdx = this.taskQueue.findIndex(t => t.priority === 'urgent')
      if (urgentIdx < 0) break
      const task = this.taskQueue.splice(urgentIdx, 1)[0]!
      task.started = true
      this.activeUrgentCount += 1
      void task
        .run()
        .then(
          val => task.resolve(val),
          err => task.reject(err),
        )
        .finally(() => {
          this.activeUrgentCount = Math.max(0, this.activeUrgentCount - 1)
          if (this.pendingTasksByKey.get(task.taskKey) === task) {
            this.pendingTasksByKey.delete(task.taskKey)
          }
          this.pumpTaskQueue()
        })
    }

    // 2. While no urgent live-unit fetches are competing for bandwidth, drain background
    //    preloads (`preload-current` strictly ahead of `preload-neighbor`) up to the cap.
    while (
      this.activeUrgentCount === 0 &&
      this.activeBackgroundCount < this.maxBackgroundConcurrency &&
      this.taskQueue.length > 0
    ) {
      let bestIdx = 0
      let bestRank = ENTITY_PRIORITY_RANK[this.taskQueue[0]!.priority]
      for (let i = 1; i < this.taskQueue.length; i++) {
        const rank = ENTITY_PRIORITY_RANK[this.taskQueue[i]!.priority]
        if (rank < bestRank) {
          bestRank = rank
          bestIdx = i
        }
      }
      const task = this.taskQueue.splice(bestIdx, 1)[0]!
      task.started = true
      this.activeBackgroundCount += 1
      void task
        .run()
        .then(
          val => task.resolve(val),
          err => task.reject(err),
        )
        .finally(() => {
          this.activeBackgroundCount = Math.max(0, this.activeBackgroundCount - 1)
          if (this.pendingTasksByKey.get(task.taskKey) === task) {
            this.pendingTasksByKey.delete(task.taskKey)
          }
          this.pumpTaskQueue()
        })
    }
  }

  async loadIndex(indexData?: PackedEntityCatalogIndex): Promise<PackedEntityCatalogIndex | null> {
    if (indexData) {
      this.catalog = indexData
      this.indexState = 'loaded'
      return indexData
    }
    if (this.indexState === 'loaded' && this.catalog) {
      return this.catalog
    }
    if (this.indexPromise) {
      return this.indexPromise
    }

    this.indexState = 'loading'
    this.indexPromise = (async (): Promise<PackedEntityCatalogIndex | null> => {
      const cleanBase = this.packBase.replace(/\/+$/, '')
      const candidateBases = [cleanBase, ''].filter(
        (b, idx, arr) => arr.indexOf(b) === idx,
      )
      for (const base of candidateBases) {
        const prefix = base ? `${base}/entities` : '/entities'
        try {
          const resp = await this.fetchFn(`${prefix}/index.json`)
          if (!resp.ok) continue
          const parsed = (await resp.json()) as PackedEntityCatalogIndex
          if (parsed && (parsed.monsterByClassId || parsed.objectByClassId || parsed.entities)) {
            this.catalog = parsed
            this.indexState = 'loaded'
            this.onArtLoaded?.()
            return parsed
          }
        } catch {
          // try next candidate URL
        }
      }
      this.indexState = 'failed'
      reportMissingArt('entity-index', 'index.json', 'Failed to load entity catalog index')
      this.onArtLoaded?.()
      return null
    })()

    return this.indexPromise
  }

  async waitForInflight(): Promise<void> {
    if (this.indexPromise) {
      await this.indexPromise
    }
    while (
      this.taskQueue.length > 0 ||
      this.monsterInflightBySpecKey.size > 0 ||
      this.objectInflightBySlug.size > 0
    ) {
      const pending = [
        ...this.monsterInflightBySpecKey.values(),
        ...this.objectInflightBySlug.values(),
        ...[...this.pendingTasksByKey.values()].map(t => t.promise),
      ]
      if (pending.length === 0) break
      await Promise.allSettled(pending)
    }
  }

  /**
   * Pre-warm monster (`MonStats.txt` `hcIdx`) and object (`Objects.txt` `classId`) atlases
   * for the current level and its 1-hop topological neighbors (#1025, #1775).
   *
   * Runs at bounded background concurrency (`preload-current` ahead of `preload-neighbor`) so
   * background fetches never starve tile pages or urgent on-screen monsters.
   */
  preloadEntities(options: {
    readonly monsterClassIds?: Iterable<number>
    readonly objectClassIds?: Iterable<number>
    readonly act?: number
    readonly priority?: 'current' | 'neighbor' | EntityLoadPriority
  }): void {
    const monsterIds = options.monsterClassIds ? [...options.monsterClassIds] : []
    const objectIds = options.objectClassIds ? [...options.objectClassIds] : []
    if (monsterIds.length === 0 && objectIds.length === 0) return
    const act = options.act ?? this.defaultAct
    const loadPriority: EntityLoadPriority =
      options.priority === 'neighbor' || options.priority === 'preload-neighbor'
        ? 'preload-neighbor'
        : options.priority === 'urgent'
          ? 'urgent'
          : 'preload-current'
    const warmAll = (): void => {
      for (const id of monsterIds) {
        if (id < 0) continue
        const entry = this.getMonsterIndexEntry(id)
        if (!entry || !(entry.key ?? entry.slug)) continue
        this.getMonsterArt(id, act, loadPriority)
      }
      for (const id of objectIds) {
        if (id < 0) continue
        const entry = this.getObjectIndexEntry(id)
        if (!entry || entry.draw === false) continue
        const slug = (act !== undefined ? entry.actSlugs?.[act] : undefined) ?? entry.slug
        if (!slug) continue
        this.getObjectArt(id, act, loadPriority)
      }
    }
    if (this.isIndexLoaded) {
      warmAll()
      return
    }
    void this.loadIndex().then(catalog => {
      if (catalog) {
        warmAll()
      }
    })
  }

  getMonsterIndexEntry(classId: number): MonsterIndexEntry | undefined {
    if (!this.catalog) return undefined
    const key = String(classId)
    return this.catalog.monsterByClassId?.[key] ?? this.catalog.monstersByHcIdx?.[key]
  }

  getObjectIndexEntry(classId: number): ObjectIndexEntry | undefined {
    if (!this.catalog) return undefined
    const key = String(classId)
    return this.catalog.objectByClassId?.[key] ?? this.catalog.objectsByClassId?.[key]
  }

  getMonsterArt(
    classId: number,
    act = this.defaultAct,
    priority: EntityLoadPriority = 'urgent',
  ): LoadedMonsterArt | 'loading' | 'missing' {
    const cached = this.monsterByClassIdCache.get(classId)
    if (cached !== undefined) return cached
    if (this.failedMonsters.has(classId)) return 'missing'
    if (this.inflightMonsters.has(classId)) {
      const inflightSpecKey = this.monsterSpecKeyByClassId.get(classId)
      if (inflightSpecKey !== undefined) {
        this.promoteTaskPriority(`monster:${inflightSpecKey}`, priority)
      }
      return 'loading'
    }

    if (this.indexState === 'idle') {
      void this.loadIndex()
      return 'loading'
    }
    if (this.indexState === 'loading') {
      return 'loading'
    }
    if (this.indexState === 'failed' || !this.catalog) {
      return 'missing'
    }

    const entry = this.getMonsterIndexEntry(classId)
    const specKey = entry?.key ?? entry?.slug ?? null
    if (!entry || !specKey) {
      this.failedMonsters.add(classId)
      return 'missing'
    }

    const existingSpec = this.monsterBySpecKeyCache.get(specKey)
    if (existingSpec) {
      const withScale: LoadedMonsterArt =
        entry.scale !== undefined && entry.scale !== existingSpec.scale
          ? { ...existingSpec, scale: entry.scale }
          : existingSpec
      this.monsterByClassIdCache.set(classId, withScale)
      resolvePreloadMiss('monster', String(classId))
      return withScale
    }

    const gen = this.clearGeneration
    this.inflightMonsters.add(classId)
    this.monsterSpecKeyByClassId.set(classId, specKey)
    const taskKey = `monster:${specKey}`
    let specPromise = this.monsterInflightBySpecKey.get(specKey)
    if (!specPromise) {
      const created = this.schedulePackFetch(taskKey, priority, () =>
        this.fetchMonsterBySpecKey(specKey, entry.token, act),
      )
      specPromise = created
      this.monsterInflightBySpecKey.set(specKey, created)
      void created.finally(() => {
        if (this.monsterInflightBySpecKey.get(specKey) === created) {
          this.monsterInflightBySpecKey.delete(specKey)
        }
      })
    } else {
      this.promoteTaskPriority(taskKey, priority)
    }

    void specPromise
      .then(loaded => {
        if (gen !== this.clearGeneration) {
          if (loaded) {
            const stale = new Set<AtlasHandle>()
            this.collectArtHandles(loaded, stale)
            this.deleteArtHandles(stale)
          }
          return
        }
        this.inflightMonsters.delete(classId)
        this.monsterSpecKeyByClassId.delete(classId)
        if (loaded) {
          this.monsterBySpecKeyCache.set(specKey, loaded)
          const withScale: LoadedMonsterArt =
            entry.scale !== undefined ? { ...loaded, scale: entry.scale } : loaded
          this.monsterByClassIdCache.set(classId, withScale)
          resolvePreloadMiss('monster', String(classId))
        } else {
          this.failedMonsters.add(classId)
          reportMissingArt('monster', specKey, `Failed to load monster art for specKey=${specKey}`)
        }
        this.onArtLoaded?.()
      })
      .catch(err => {
        if (gen !== this.clearGeneration) return
        this.inflightMonsters.delete(classId)
        this.monsterSpecKeyByClassId.delete(classId)
        this.failedMonsters.add(classId)
        reportMissingArt('monster', specKey, String(err))
        this.onArtLoaded?.()
      })

    return 'loading'
  }

  /**
   * Monster art for one unit: classes listed in `MONSTER_COMPONENT_VARIANT_BAKES_113C` (Skeletal Mage #364 S4/S5
   * elemental hands) use the variant pack chosen by the unit's S2C 0xAC component bytes; every other unit (or a
   * unit without component bytes) uses the shared class pack of {@link getMonsterArt}.
   */
  getMonsterVariantArt(
    classId: number,
    compVariants: readonly number[] | undefined,
    act = this.defaultAct,
    priority: EntityLoadPriority = 'urgent',
  ): LoadedMonsterArt | 'loading' | 'missing' {
    const variantKey = resolveMonsterComponentVariantKey113c(classId, compVariants)
    if (variantKey === null) return this.getMonsterArt(classId, act, priority)
    const cached = this.monsterBySpecKeyCache.get(variantKey)
    if (cached !== undefined) {
      resolvePreloadMiss('monster', String(classId))
      return cached
    }
    if (this.failedMonsterVariantKeys.has(variantKey)) return 'missing'
    const taskKey = `monster:${variantKey}`
    if (this.monsterInflightBySpecKey.has(variantKey)) {
      this.promoteTaskPriority(taskKey, priority)
      return 'loading'
    }
    if (this.indexState === 'idle') {
      void this.loadIndex()
      return 'loading'
    }
    if (this.indexState === 'loading') return 'loading'
    if (this.indexState === 'failed' || !this.catalog) return 'missing'
    const entry = this.getMonsterIndexEntry(classId)
    if (!entry) return 'missing'
    const gen = this.clearGeneration
    const specPromise = this.schedulePackFetch(taskKey, priority, () =>
      this.fetchMonsterBySpecKey(variantKey, entry.token, act),
    )
    this.monsterInflightBySpecKey.set(variantKey, specPromise)
    void specPromise
      .then(loaded => {
        if (this.monsterInflightBySpecKey.get(variantKey) === specPromise) {
          this.monsterInflightBySpecKey.delete(variantKey)
        }
        if (gen !== this.clearGeneration) {
          if (loaded) {
            const stale = new Set<AtlasHandle>()
            this.collectArtHandles(loaded, stale)
            this.deleteArtHandles(stale)
          }
          return
        }
        if (loaded) {
          this.monsterBySpecKeyCache.set(
            variantKey,
            entry.scale !== undefined ? { ...loaded, scale: entry.scale } : loaded,
          )
          resolvePreloadMiss('monster', String(classId))
        } else {
          this.failedMonsterVariantKeys.add(variantKey)
          reportMissingArt('monster', variantKey, `Failed to load monster variant art ${variantKey}`)
        }
        this.onArtLoaded?.()
      })
      .catch(err => {
        if (this.monsterInflightBySpecKey.get(variantKey) === specPromise) {
          this.monsterInflightBySpecKey.delete(variantKey)
        }
        if (gen !== this.clearGeneration) return
        this.failedMonsterVariantKeys.add(variantKey)
        reportMissingArt('monster', variantKey, String(err))
        this.onArtLoaded?.()
      })
    return 'loading'
  }

  getObjectArt(
    classId: number,
    act = this.defaultAct,
    priority: EntityLoadPriority = 'urgent',
  ): LoadedObjectArt | 'loading' | 'missing' | 'non-drawable' {
    const cacheKey = `${classId}:${act ?? 0}`
    const cached =
      this.objectByClassIdCache.get(cacheKey) ?? this.objectByClassIdCache.get(`${classId}:0`)
    if (cached !== undefined) return cached
    if (this.failedObjects.has(cacheKey)) return 'missing'
    if (this.inflightObjects.has(cacheKey)) {
      const inflightSlug = this.objectSlugByCacheKey.get(cacheKey)
      if (inflightSlug !== undefined) {
        this.promoteTaskPriority(`object:${inflightSlug}`, priority)
      }
      return 'loading'
    }

    if (this.indexState === 'idle') {
      void this.loadIndex()
      return 'loading'
    }
    if (this.indexState === 'loading') {
      return 'loading'
    }
    if (this.indexState === 'failed' || !this.catalog) {
      return 'missing'
    }

    const entry = this.getObjectIndexEntry(classId)
    if (!entry) {
      this.failedObjects.add(cacheKey)
      return 'missing'
    }
    if (entry.draw === false) {
      return 'non-drawable'
    }

    const slug = (act !== undefined ? entry.actSlugs?.[act] : undefined) ?? entry.slug
    if (!slug) {
      this.failedObjects.add(cacheKey)
      return 'missing'
    }

    const existingSlug = this.objectBySlugCache.get(slug)
    if (existingSlug) {
      const merged = this.mergeObjectIndexMetadata(existingSlug, entry)
      this.objectByClassIdCache.set(cacheKey, merged)
      return merged
    }

    const gen = this.clearGeneration
    this.inflightObjects.add(cacheKey)
    this.objectSlugByCacheKey.set(cacheKey, slug)
    const taskKey = `object:${slug}`
    let slugPromise = this.objectInflightBySlug.get(slug)
    if (!slugPromise) {
      const created = this.schedulePackFetch(taskKey, priority, () =>
        loadObjectArt(this.renderer, slug, this.packBase, act, entry, this.fetchFn),
      )
      slugPromise = created
      this.objectInflightBySlug.set(slug, created)
      void created.finally(() => {
        if (this.objectInflightBySlug.get(slug) === created) {
          this.objectInflightBySlug.delete(slug)
        }
      })
    } else {
      this.promoteTaskPriority(taskKey, priority)
    }

    void slugPromise
      .then(loaded => {
        if (gen !== this.clearGeneration) {
          if (loaded) {
            const stale = new Set<AtlasHandle>()
            this.collectArtHandles(loaded, stale)
            this.deleteArtHandles(stale)
          }
          return
        }
        this.inflightObjects.delete(cacheKey)
        this.objectSlugByCacheKey.delete(cacheKey)
        if (loaded) {
          this.objectBySlugCache.set(slug, loaded)
          const merged = this.mergeObjectIndexMetadata(loaded, entry)
          this.objectByClassIdCache.set(cacheKey, merged)
        } else {
          this.failedObjects.add(cacheKey)
          reportMissingArt('object', slug, `Failed to load object art for slug=${slug}`)
        }
        this.onArtLoaded?.()
      })
      .catch(err => {
        if (gen !== this.clearGeneration) return
        this.inflightObjects.delete(cacheKey)
        this.objectSlugByCacheKey.delete(cacheKey)
        this.failedObjects.add(cacheKey)
        reportMissingArt('object', slug, String(err))
        this.onArtLoaded?.()
      })

    return 'loading'
  }

  private mergeObjectIndexMetadata(
    art: LoadedObjectArt,
    entry: ObjectIndexEntry,
  ): LoadedObjectArt {
    const isAdditive =
      entry.blendMode === 'additive' ||
      entry.trans === 1 ||
      entry.trans === 2 ||
      art.blendMode === 'additive'
    return {
      ...art,
      blendMode: isAdditive ? 'additive' : art.blendMode ?? 'normal',
      ...(entry.start !== undefined ? { start: entry.start } : {}),
      ...(entry.frameCnt !== undefined ? { frameCnt: entry.frameCnt } : {}),
      ...(entry.frameDelta !== undefined ? { frameDelta: entry.frameDelta } : {}),
      ...(entry.cycleAnim !== undefined ? { cycleAnim: entry.cycleAnim } : {}),
      ...(entry.trans !== undefined ? { trans: entry.trans } : {}),
      ...(entry.xOffset !== undefined ? { xOffset: entry.xOffset } : {}),
      ...(entry.yOffset !== undefined ? { yOffset: entry.yOffset } : {}),
    }
  }

  private async fetchMonsterBySpecKey(
    specKey: string,
    token: string,
    act?: number,
  ): Promise<LoadedMonsterArt | null> {
    const slug = specKey.startsWith('monster-') ? specKey : `monster-${specKey}`
    const cleanBase = this.packBase.replace(/\/+$/, '')
    const candidateBases = [cleanBase, ''].filter(
      (b, idx, arr) => arr.indexOf(b) === idx,
    )
    for (const base of candidateBases) {
      const prefix = base ? `${base}/entities` : '/entities'
      for (const subPath of [`${prefix}/${slug}`]) {
        try {
          const [jsonResp, r8Resp] = await Promise.all([
            this.fetchFn(`${subPath}.json`),
            this.fetchFn(`${subPath}.r8`),
          ])
          if (jsonResp.ok && r8Resp.ok) {
            const meta = (await jsonResp.json()) as PackedMonsterJson
            const indices = new Uint8Array(await r8Resp.arrayBuffer())
            const pageHandles = await uploadEntityAtlasPages(this.renderer, this.fetchFn, dirOf(subPath), meta, indices)
            const handle = pageHandles[0]!
            const groups = mapRawGroupsToAtlasFrames(meta.groups, pageHandles)
            const glowGroups =
              meta.glowGroups !== undefined ? mapRawGroupsToAtlasFrames(meta.glowGroups, pageHandles) : undefined
            const clips = meta.clips ?? meta.modes
            const glowClips = sanitizeGlowClips(clips, meta.glowClips)
            return {
              token: meta.token || token,
              handle,
              groups,
              ...(glowGroups !== undefined ? { glowGroups } : {}),
              blendMode: normalizeMonsterBlendMode(meta.token || token, meta.blendMode),
              directions: Math.max(1, meta.directions || 1),
              walkOffset: meta.walkOffset ?? meta.standOffset ?? 0,
              standOffset: meta.standOffset ?? 0,
              walkFrames: Math.max(1, meta.walkFrames ?? meta.standFrames ?? 1),
              standFrames: Math.max(1, meta.standFrames ?? 1),
              ...(clips !== undefined ? { clips } : {}),
              ...(glowClips !== undefined ? { glowClips } : {}),
              layerFailures: [],
            }
          }
        } catch (err) {
          // try next candidate, but keep the reason (e.g. a page over MAX_TEXTURE_SIZE, issue #921)
          console.warn(`monster art ${subPath}: ${(err as Error).message}`)
        }
      }
    }

    if (act !== undefined && cleanBase) {
      const actEntitiesUrl = `${cleanBase}/act${String(act)}/entities`
      try {
        const [jsonResp, pngResp] = await Promise.all([
          this.fetchFn(`${actEntitiesUrl}/${slug}.json`),
          this.fetchFn(`${actEntitiesUrl}/${slug}.png`),
        ])
        if (jsonResp.ok && pngResp.ok) {
          const meta = (await jsonResp.json()) as PackedMonsterJson
          const bitmap = await createImageBitmap(await pngResp.blob())
          let handle: AtlasHandle
          try {
            handle = this.renderer.addAtlas(bitmap, meta.width, meta.height)
          } finally {
            bitmap.close()
          }
          const groups = mapRawGroupsToAtlasFrames(meta.groups)
          const glowGroups =
            meta.glowGroups !== undefined ? mapRawGroupsToAtlasFrames(meta.glowGroups) : undefined
          const clips = meta.clips ?? meta.modes
          const glowClips = sanitizeGlowClips(clips, meta.glowClips)
          return {
            token: meta.token || token,
            handle,
            groups,
            ...(glowGroups !== undefined ? { glowGroups } : {}),
            blendMode: normalizeMonsterBlendMode(meta.token || token, meta.blendMode),
            directions: Math.max(1, meta.directions || 1),
            walkOffset: meta.walkOffset ?? meta.standOffset ?? 0,
            standOffset: meta.standOffset ?? 0,
            walkFrames: Math.max(1, meta.walkFrames ?? meta.standFrames ?? 1),
            standFrames: Math.max(1, meta.standFrames ?? 1),
            ...(clips !== undefined ? { clips } : {}),
            ...(glowClips !== undefined ? { glowClips } : {}),
            layerFailures: [],
          }
        }
      } catch {
        // fall through
      }
    }

    return null
  }
}
