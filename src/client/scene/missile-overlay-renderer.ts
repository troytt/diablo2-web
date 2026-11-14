import {
  getMissileTxtData,
} from '../../common/skills/missiles-data.ts'
import type { AtlasFrame } from '../render/atlas.ts'
import {
  MISSILE_METAS,
  velocityToDccDirection,
  type MissileFrameTuple,
  type MissileMeta,
} from '../render/missiles-meta.ts'
import {
  OVERLAY_METAS,
  type OverlayMeta,
} from '../render/overlays-meta.ts'
import type {
  AtlasHandle,
  SpriteRenderer,
} from '../render/renderer.ts'
import { reportMissingArt, reportPreloadMiss, resolvePreloadMiss } from './missing-art.ts'
import { celFileArtKey } from '../render/cel-file-key.ts'

export {
  MISSILE_METAS,
  OVERLAY_METAS,
  getMissileTxtData,
  velocityToDccDirection,
  type MissileFrameTuple,
  type MissileMeta,
  type OverlayMeta,
}

/**
 * Packed missile animation asset loaded into GPU memory.
 */
export interface LoadedMissileArt {
  readonly meta: MissileMeta
  readonly handle: AtlasHandle
  readonly frames: AtlasFrame[][]
}

/**
 * Packed overlay animation asset loaded into GPU memory.
 */
export interface LoadedOverlayArt {
  readonly meta: OverlayMeta
  readonly handle: AtlasHandle
  readonly frames: AtlasFrame[][]
}

interface PackedSpriteMetaBase {
  readonly name: string
  readonly celFile?: string | undefined
  readonly width: number
  readonly height: number
  readonly groups: readonly (readonly MissileFrameTuple[])[]
}

export interface LoadSpriteArtMapOptions {
  /**
   * When true, only `preloadStems` are fetched eagerly at boot; all remaining
   * missile/overlay atlases are fetched on demand on first `get()` / `has()` access.
   * Defaults to `false` for backward compatibility with eager callers/tests.
   */
  readonly lazy?: boolean | undefined
  readonly preloadStems?: readonly string[] | undefined
}

const DEFAULT_LAZY_PRELOAD_MISSILES: readonly string[] = [
  'arrow',
  'javelin',
  'firebolt',
  'fireball',
  'fireexplode',
  'icebolt',
  'iceexplode',
  'chargedbolt',
  'townportal',
]

const DEFAULT_LAZY_PRELOAD_OVERLAYS: readonly string[] = [
  'town_portal_op_tr',
  'town_portal_op_hd',
  'town_portal_on_tr',
  'town_portal_on_hd',
  'fire_cast_1',
  'ice_cast_1',
  'lightning_cast_1',
  'shrine_shimmer00',
  'objsb',
  'levelup',
]

/**
 * `Map` subclass that supports on-demand background loading of packed sprite atlases
 * when an unloaded key (`name` or normalised `celFileArtKey`) is queried via `get()` or `has()`.
 */
export class LazySpriteArtMap<V> extends Map<string, V> {
  private readonly lazyLoaders = new Map<string, () => Promise<V | undefined>>()
  private readonly inflight = new Map<string, Promise<V | undefined>>()
  private readonly inflightLoaders = new Set<() => Promise<V | undefined>>()
  private readonly failedLoaders = new Set<() => Promise<V | undefined>>()

  registerLazyKey(key: string, loader: () => Promise<V | undefined>, overwrite = true): void {
    if (!key) return
    if (overwrite || !this.lazyLoaders.has(key)) {
      this.lazyLoaders.set(key, loader)
    }
    const lower = key.toLowerCase()
    if (overwrite || !this.lazyLoaders.has(lower)) {
      this.lazyLoaders.set(lower, loader)
    }
  }

  hasRegisteredLazyKey(key: string): boolean {
    return this.lazyLoaders.has(key) || this.lazyLoaders.has(key.toLowerCase())
  }

  isKeyLoading(key: string): boolean {
    if (!key) return false
    if (super.has(key) || super.has(key.toLowerCase())) return false
    const normKey = key.toLowerCase()
    if (this.inflight.has(normKey)) return true
    const loader = this.lazyLoaders.get(key) ?? this.lazyLoaders.get(normKey)
    return loader !== undefined && this.inflightLoaders.has(loader)
  }

  ensureKeyLoaded(key: string): Promise<V | undefined> {
    const existing = super.get(key) ?? super.get(key.toLowerCase())
    if (existing !== undefined) return Promise.resolve(existing)
    const normKey = key.toLowerCase()
    const active = this.inflight.get(normKey)
    if (active !== undefined) return active
    const loader = this.lazyLoaders.get(key) ?? this.lazyLoaders.get(normKey)
    if (loader === undefined || this.failedLoaders.has(loader)) {
      return Promise.resolve(undefined)
    }
    this.inflightLoaders.add(loader)
    const promise = loader()
      .then((res) => {
        if (res === undefined) {
          this.failedLoaders.add(loader)
        }
        return res
      })
      .finally(() => {
        this.inflightLoaders.delete(loader)
        this.inflight.delete(normKey)
      })
    this.inflight.set(normKey, promise)
    return promise
  }

  async waitForInflight(): Promise<void> {
    while (this.inflight.size > 0) {
      await Promise.allSettled(Array.from(this.inflight.values()))
    }
  }

  override get(key: string): V | undefined {
    const hit = super.get(key)
    if (hit !== undefined) return hit
    const lowerHit = super.get(key.toLowerCase())
    if (lowerHit !== undefined) return lowerHit
    if (this.lazyLoaders.has(key) || this.lazyLoaders.has(key.toLowerCase())) {
      void this.ensureKeyLoaded(key)
    }
    return undefined
  }

  override has(key: string): boolean {
    if (super.has(key) || super.has(key.toLowerCase())) return true
    if (this.lazyLoaders.has(key) || this.lazyLoaders.has(key.toLowerCase())) {
      void this.ensureKeyLoaded(key)
    }
    return false
  }
}

export function isLazySpriteArtLoading<V>(
  map: ReadonlyMap<string, V> | undefined,
  keys: readonly (string | undefined)[],
): boolean {
  if (!(map instanceof LazySpriteArtMap)) return false
  for (const key of keys) {
    if (key && map.isKeyLoading(key)) return true
  }
  return false
}

function hasBundledSpriteMeta<M extends PackedSpriteMetaBase>(
  metaHint: M | undefined,
  name: string,
  stem: string,
): metaHint is M {
  if (metaHint === undefined) return false
  if (metaHint.width <= 0 || metaHint.height <= 0) return false
  if (!Array.isArray(metaHint.groups) || metaHint.groups.length === 0) return false
  const lowerStem = stem.toLowerCase()
  return (
    lowerStem === name.toLowerCase() ||
    (metaHint.celFile !== undefined && lowerStem === metaHint.celFile.toLowerCase())
  )
}

async function loadPackedSpriteArtMap<M extends PackedSpriteMetaBase>(options: {
  readonly label: string
  readonly subdir: 'missiles' | 'overlays'
  readonly metas: Readonly<Record<string, M>>
  readonly renderer: SpriteRenderer
  readonly packBase?: string | undefined
  readonly lazy?: boolean | undefined
  readonly preloadStems?: readonly string[] | undefined
  readonly filterTarget?: ((meta: M) => boolean) | undefined
  readonly extraStems?: ((name: string, metaHint: M | undefined) => readonly string[]) | undefined
  readonly overrideNameOnStemMismatch?: boolean | undefined
  readonly fallbackAliasKey?: ((meta: M, map: ReadonlyMap<string, { readonly meta: M; readonly handle: AtlasHandle; readonly frames: AtlasFrame[][] }>) => { readonly meta: M; readonly handle: AtlasHandle; readonly frames: AtlasFrame[][] } | undefined) | undefined
}): Promise<LazySpriteArtMap<{ readonly meta: M; readonly handle: AtlasHandle; readonly frames: AtlasFrame[][] }>> {
  type ArtEntry = { readonly meta: M; readonly handle: AtlasHandle; readonly frames: AtlasFrame[][] }
  const map = new LazySpriteArtMap<ArtEntry>()
  if (typeof fetch === 'undefined' || typeof createImageBitmap === 'undefined') return map
  const allMetas = Object.values(options.metas)
  const filteredMetas = options.filterTarget ? allMetas.filter(options.filterTarget) : allMetas
  const metaByName = new Map(filteredMetas.map(m => [m.name.toLowerCase(), m]))
  const targets = Array.from(new Set(filteredMetas.map(m => m.name.toLowerCase())))
  const cleanBase = options.packBase ? options.packBase.replace(/\/+$/, '') : ''
  const baseCandidates = [
    `/${options.subdir}`,
    cleanBase ? `${cleanBase}/${options.subdir}` : '',
  ].filter(Boolean)

  const aliasesByTarget = new Map<string, { alias: string; meta: M }[]>()
  for (const [alias, meta] of Object.entries(options.metas)) {
    const tName = meta.name.toLowerCase()
    const list = aliasesByTarget.get(tName) ?? []
    list.push({ alias, meta })
    aliasesByTarget.set(tName, list)
  }

  const failures: string[] = []
  const targetLoaderCache = new Map<string, Promise<ArtEntry | undefined>>()

  const loadSingleTarget = (name: string, recordFailure: boolean): Promise<ArtEntry | undefined> => {
    const cached = targetLoaderCache.get(name)
    if (cached !== undefined) return cached

    const promise = (async (): Promise<ArtEntry | undefined> => {
      let lastReason = ''
      const metaHint = options.metas[name] ?? metaByName.get(name)
      const extra = options.extraStems ? options.extraStems(name, metaHint) : []
      const candidateStems = Array.from(
        new Set(
          [name.toLowerCase(), metaHint?.celFile?.toLowerCase() ?? '', ...extra].filter(
            (s): s is string => Boolean(s) && s !== 'null',
          ),
        ),
      )
      for (const base of baseCandidates) {
        for (const stem of candidateStems) {
          try {
            const useBundledMeta = hasBundledSpriteMeta(metaHint, name, stem)
            const [jsonResp, pngResp] = await Promise.all([
              useBundledMeta ? Promise.resolve(undefined) : fetch(`${base}/${stem}.json`),
              fetch(`${base}/${stem}.png`),
            ])
            if ((useBundledMeta || jsonResp?.ok) && pngResp.ok) {
              const rawMeta: M = useBundledMeta
                ? metaHint
                : ((await jsonResp!.json()) as M)
              const meta: M =
                options.overrideNameOnStemMismatch && metaHint && stem !== name
                  ? { ...rawMeta, name }
                  : rawMeta
              const blob = await pngResp.blob()
              const bitmap = await createImageBitmap(blob)
              let handle: AtlasHandle
              try {
                handle = options.renderer.addAtlas(bitmap, meta.width, meta.height)
              } finally {
                bitmap.close()
              }
              const frames: AtlasFrame[][] = meta.groups.map((group: readonly MissileFrameTuple[]) =>
                group.map(([x, y, width, height, anchorX, anchorY]: MissileFrameTuple) => ({
                  x,
                  y,
                  width,
                  height,
                  ...(anchorX !== undefined ? { anchorX } : {}),
                  ...(anchorY !== undefined ? { anchorY } : {}),
                })),
              )
              const art: ArtEntry = { meta, handle, frames }
              map.set(name, art)
              map.set(name.toLowerCase(), art)
              if (extra.includes(stem)) {
                map.set(stem, art)
                map.set(stem.toLowerCase(), art)
              }
              if (meta.celFile) {
                // Missiles.txt / Overlay.txt name the DCC with '\' (Issue #1043): one normalised key for both sides.
                const celKey = celFileArtKey(meta.celFile)
                if (superGetOrUndefined(map, celKey) === undefined || name === meta.celFile.toLowerCase()) {
                  map.set(celKey, art)
                }
                if (superGetOrUndefined(map, meta.celFile) === undefined) {
                  map.set(meta.celFile, art)
                }
                if (superGetOrUndefined(map, meta.celFile.toLowerCase()) === undefined) {
                  map.set(meta.celFile.toLowerCase(), art)
                }
              }
              for (const { alias, meta: aliasMeta } of aliasesByTarget.get(name) ?? []) {
                map.set(alias, art)
                map.set(alias.toLowerCase(), art)
                if (aliasMeta.celFile) {
                  const aliasCelKey = celFileArtKey(aliasMeta.celFile)
                  if (superGetOrUndefined(map, aliasCelKey) === undefined) {
                    map.set(aliasCelKey, art)
                  }
                  if (superGetOrUndefined(map, aliasMeta.celFile) === undefined) {
                    map.set(aliasMeta.celFile, art)
                  }
                  if (superGetOrUndefined(map, aliasMeta.celFile.toLowerCase()) === undefined) {
                    map.set(aliasMeta.celFile.toLowerCase(), art)
                  }
                }
              }
              return art
            }
            lastReason = useBundledMeta
              ? `${base}/${stem}.png (HTTP ${pngResp.status})`
              : `${base}/${stem}.json (HTTP ${jsonResp?.status ?? 0}), ${base}/${stem}.png (HTTP ${pngResp.status})`
          } catch (err) {
            lastReason = `${base}/${stem}: ${err instanceof Error ? err.message : String(err)}`
          }
        }
      }
      if (recordFailure) {
        failures.push(`${name} [${lastReason || `tried: ${baseCandidates.join(', ')}`}]`)
      } else {
        reportMissingArt(
          options.subdir === 'missiles' ? 'missile' : 'overlay',
          name,
          lastReason || `tried: ${baseCandidates.join(', ')}`,
        )
      }
      return undefined
    })()

    targetLoaderCache.set(name, promise)
    return promise
  }

  if (options.lazy) {
    const preloadSet = new Set(
      (options.preloadStems ?? []).map(s => s.toLowerCase()),
    )
    const eagerTargets: string[] = []
    for (const name of targets) {
      const metaHint = options.metas[name] ?? metaByName.get(name)
      const extra = options.extraStems ? options.extraStems(name, metaHint) : []
      const loader = (): Promise<ArtEntry | undefined> => loadSingleTarget(name, false)
      map.registerLazyKey(name, loader, true)
      for (const stem of extra) {
        map.registerLazyKey(stem, loader, false)
      }
      if (metaHint?.celFile && metaHint.celFile.toLowerCase() !== 'null') {
        const isCanonicalCelOwner = name === metaHint.celFile.toLowerCase()
        map.registerLazyKey(celFileArtKey(metaHint.celFile), loader, isCanonicalCelOwner)
        map.registerLazyKey(metaHint.celFile, loader, false)
      }
      for (const { alias, meta: aliasMeta } of aliasesByTarget.get(name) ?? []) {
        map.registerLazyKey(alias, loader, false)
        if (aliasMeta.celFile && aliasMeta.celFile.toLowerCase() !== 'null') {
          map.registerLazyKey(celFileArtKey(aliasMeta.celFile), loader, false)
          map.registerLazyKey(aliasMeta.celFile, loader, false)
        }
      }
      if (preloadSet.has(name)) {
        eagerTargets.push(name)
      }
    }
    await Promise.all(eagerTargets.map(name => loadSingleTarget(name, true)))
  } else {
    await Promise.all(targets.map(name => loadSingleTarget(name, true)))
  }

  if (failures.length > 0) {
    console.error(
      `[${options.label}] ${failures.length} ${options.subdir.slice(0, -1)} atlas(es) unavailable (loaded ${map.size} keys): ${failures.slice(0, 8).join('; ')}`,
    )
  }

  for (const [alias, meta] of Object.entries(options.metas)) {
    const art =
      (meta.celFile ? superGetOrUndefined(map, celFileArtKey(meta.celFile)) : undefined) ??
      superGetOrUndefined(map, meta.name) ??
      superGetOrUndefined(map, meta.name.toLowerCase()) ??
      options.fallbackAliasKey?.(meta, map)
    if (art) {
      map.set(alias, art)
      map.set(alias.toLowerCase(), art)
    }
  }

  for (const meta of Object.values(options.metas)) {
    if (!meta.celFile) continue
    const art = superGetOrUndefined(map, celFileArtKey(meta.celFile))
    if (art) {
      if (superGetOrUndefined(map, meta.celFile) === undefined) map.set(meta.celFile, art)
      if (superGetOrUndefined(map, meta.celFile.toLowerCase()) === undefined) map.set(meta.celFile.toLowerCase(), art)
    }
  }

  return map
}

function superGetOrUndefined<V>(map: Map<string, V>, key: string): V | undefined {
  return Map.prototype.get.call(map, key) as V | undefined
}

/**
 * Load authentic 1.13c baked missile atlases from /missiles/*.png or packBase.
 */
export async function loadMissileArtMap(
  renderer: SpriteRenderer,
  packBase?: string,
  options?: LoadSpriteArtMapOptions,
): Promise<LazySpriteArtMap<LoadedMissileArt>> {
  return loadPackedSpriteArtMap<MissileMeta>({
    label: 'loadMissileArtMap',
    subdir: 'missiles',
    metas: MISSILE_METAS,
    renderer,
    packBase,
    lazy: options?.lazy,
    preloadStems: options?.preloadStems ?? DEFAULT_LAZY_PRELOAD_MISSILES,
    overrideNameOnStemMismatch: true,
  })
}

/**
 * Load authentic 1.13c baked cast overlay atlases from /overlays/*.png or packBase.
 */
export async function loadOverlayArtMap(
  renderer: SpriteRenderer,
  packBase?: string,
  options?: LoadSpriteArtMapOptions,
): Promise<LazySpriteArtMap<LoadedOverlayArt>> {
  return loadPackedSpriteArtMap<OverlayMeta>({
    label: 'loadOverlayArtMap',
    subdir: 'overlays',
    metas: OVERLAY_METAS,
    renderer,
    packBase,
    lazy: options?.lazy,
    preloadStems: options?.preloadStems ?? DEFAULT_LAZY_PRELOAD_OVERLAYS,
    overrideNameOnStemMismatch: true,
    filterTarget: m => m.celFile?.toLowerCase() !== 'null',
    extraStems: name => (name.toLowerCase() === 'cursecast' ? ['curse_hit'] : []),
    fallbackAliasKey: (meta, map) =>
      meta.name.toLowerCase() === 'cursecast' ? superGetOrUndefined(map as Map<string, LoadedOverlayArt>, 'curse_hit') : undefined,
  })
}

/**
 * Render an active Diablo II 1.13c Town Portal (`Objects.txt` ID 59, Token `TP`):
 * - Plays 15-frame opening sequence (`OP`: `tptrlitophth` + `tphdlitophth`) at 200/256 * 25 fps (51.2 ms/frame, 768 ms total),
 *   then loops 15-frame operating sequence (`ON`: `tptrlitonhth` + `tphdlitonhth`).
 * - Draws `TR` ground shadow layer with normal blending and `HD` blue vortex layer with additive blending.
 */
export function drawTownPortal(
  renderer: SpriteRenderer,
  x: number,
  y: number,
  elapsedMs: number,
  overlayArtMap: ReadonlyMap<string, LoadedOverlayArt>,
  mode = 1,
): void {
  const frameDurationMs = 51.2 // 1000 / (25 * 200 / 256)
  const openDurationMs = 15 * frameDurationMs // 768 ms
  const isOpening = mode !== 2 && elapsedMs < openDurationMs
  const trArt = overlayArtMap.get(isOpening ? 'town_portal_op_tr' : 'town_portal_on_tr')
  const hdArt = overlayArtMap.get(isOpening ? 'town_portal_op_hd' : 'town_portal_on_hd')
  const onElapsedMs = mode === 2 ? elapsedMs : elapsedMs - openDurationMs
  const rawFrameIdx = isOpening
    ? Math.min(14, Math.max(0, Math.floor(elapsedMs / frameDurationMs)))
    : Math.max(0, Math.floor(onElapsedMs / frameDurationMs)) % 15

  let drewSprite = false
  if (trArt !== undefined) {
    const group = trArt.frames[0]
    const frame = group?.[rawFrameIdx] ?? group?.[0]
    if (frame !== undefined) {
      const drawX = frame.anchorX !== undefined ? x + frame.anchorX : x - frame.width / 2
      const drawY = frame.anchorY !== undefined ? y + frame.anchorY : y - frame.height / 2
      renderer.draw(frame, drawX, drawY, {
        atlas: trArt.handle,
        blendMode: 'trans25',
      })
      drewSprite = true
    }
  }
  if (hdArt !== undefined) {
    const group = hdArt.frames[0]
    const frame = group?.[rawFrameIdx] ?? group?.[0]
    if (frame !== undefined) {
      const drawX = frame.anchorX !== undefined ? x + frame.anchorX : x - frame.width / 2
      const drawY = frame.anchorY !== undefined ? y + frame.anchorY : y - frame.height / 2
      renderer.draw(frame, drawX, drawY, {
        atlas: hdArt.handle,
        blendMode: 'additive',
        elevationY: Math.max(0, frame.height - 16),
      })
      renderer.setBlendMode('normal')
      drewSprite = true
    }
  }
  const tpId = isOpening ? 'town_portal_op' : 'town_portal_on'
  if (drewSprite) {
    resolvePreloadMiss('overlay', tpId)
  } else if (
    isLazySpriteArtLoading(
      overlayArtMap,
      isOpening
        ? ['town_portal_op_tr', 'town_portal_op_hd']
        : ['town_portal_on_tr', 'town_portal_on_hd'],
    )
  ) {
    reportPreloadMiss('overlay', tpId, 'Town portal sprite atlas loading in overlayArtMap')
  } else {
    reportMissingArt(
      'overlay',
      tpId,
      'Missing town portal sprite atlas in overlayArtMap',
    )
  }
}
