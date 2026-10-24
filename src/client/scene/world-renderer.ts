import { CANONICAL_113C_OVERLAYS } from '../../common/skills/missiles-data.ts'
import { resolveSkillSequenceFrame } from '../../common/skills/skill-anim-modes.ts'
import {
  computeAnimFrameIndex,
  computeLocomotionStepSpeed256,
  computeMoveVelocityPercent113c,
  computeStepSpeed256,
  getCharAnimClip113c,
  resolvePlayerLocomotionBaseSpeed256,
} from '../../common/units/char-anim-speed.ts'
import { getMonsterPathRecord } from '../../common/path/units.ts'
import {
  resolveMonsterSequenceFrame113c,
  type ResolvedMonsterSequenceFrame113c,
} from '../../common/path/monster-anim-metrics-113c.ts'
import {
  appearanceKey,
  PLAYER_CLASS_TOKENS,
  SorceressLayerCompositor,
  type CharLayerAssetLoader,
  type PlayerClassToken,
  type SorceressAppearanceSpec,
} from '../../common/units/char-appearance.ts'
import { getSharedClassLayerCompositor } from '../frontend/avatar-compositor.ts'
import { dir64ToClipDirection } from '../../common/units/direction.ts'
import { PLR_MODES } from '../../common/units/plr-mode.ts'
import type { AtlasFrame } from '../render/atlas.ts'
import { ADDITIVE_MONSTER_TOKENS, type LoadedMonsterArt } from '../render/monster-art.ts'
import { CAMERA_Y_OFFSET, subTileToWorldOrtho } from '../view/viewport-profile.ts'
import { npcDisplayName } from '../../common/units/npc-table.ts'
import type { AtlasHandle, SpriteRenderer } from '../render/renderer.ts'
import {
  resolveAutomapShrineBadge,
  type AutomapEntityMarker,
  type AutomapShrineDescriptor,
  type Minimap,
  type MinimapLevel,
} from '../ui/minimap.ts'
import type { GroundItemBeamDescriptor, HudManager } from '../ui/hud-manager.ts'
import { resolveOverheadBubbleText113c } from '../../common/chat/chat-113c.ts'
import { getTblLang, lookupTbl } from '../i18n/lang.ts'
import { AUTHENTIC_113C_OVERLAYS } from '../render/overlays-meta.ts'
import { missileTransToDrawBlend, overlayTransToDrawBlend } from '../../common/gfx/draw-mode.ts'
import { celFileArtKey, resolveArtByCelFile } from '../render/cel-file-key.ts'
import {
  CANONICAL_113C_OBJECTS,
  isObjectSelectableInMode,
  resolveObjectDisplayName,
  resolveShrineOverlays113c,
} from '../../common/world/objects-meta.ts'
import { isTownLevel } from '../../common/world/scene-population.ts'
import { hasMonStats2Flag, MONSTATS2_FLAGINDEX } from '../../common/units/monstats2-flags.ts'
import { getMonsterKindByClassId, getSuperUniqueByIndex } from '../../common/units/monsters-data.ts'
import { MONSTER_CLASS_TO_PET_TYPE_IDX } from '../../common/units/pet-type-table.ts'
import {
  normalizeMonsterBlendMode,
  type EntityArtCache,
  type LoadedCharacter,
  type LoadedObjectArt,
} from './entity-art-loader.ts'
import type { LightingPreset } from './lighting-presets.ts'
import { WallFadeTracker113c, wallFadeKey, wallOccludesPlayer113c } from './wall-fade-113c.ts'
import {
  drawTownPortal,
  type LoadedMissileArt,
  type LoadedOverlayArt,
} from './missile-overlay-renderer.ts'

/** Player feet footprint height (scene px), used to anchor sprite baselines. */
const FEET_HEIGHT = 10

import type { AutomapView } from '../automap/automap-view.ts'
import type {
  SceneFrameSnapshot,
  SceneSource,
  SceneTileQuad,
} from '../view/scene-source.ts'
import type {
  SceneEntityDrawable,
  SceneMissileDrawable,
  SceneOverlayDrawable,
  SceneUnitDrawable,
} from '../view/unit-drawables.ts'
import { sceneEntityCellDepth } from '../view/unit-drawables.ts'
import type { SceneWeatherPass } from '../weather/weather-render-pass.ts'
import { MONSTER_ART_MAP } from '../../common/units/monster-mapping.ts'
import {
  getNpcDisplayNameByHcIdx,
  getTownNpcDescriptorByHcIdx,
  isTownNpcHcIdx,
} from '../../common/units/npc-table.ts'
import { BAKED_UI_MANIFEST, type SpriteRect } from '../../common/items/baked-ui-meta.ts'
import {
  CANONICAL_QUEST_ITEM_CODES,
  layoutGroundItemLabels,
  resolveGroundItemMetadata,
  resolveItemQualityString,
  type GroundItemLabelInput,
} from '../../common/items/ground-items.ts'
import { resolveGroundItemFlippyKey, resolveGroundItemSpriteRect } from '../ui/inventory.ts'
import { spriteOutlines } from '../guide/sprite-outline.ts'
import {
  applyLightingInputs,
  unitFlatLightInto,
  wallColumnTintsInto113c,
  type LightingPassTargets,
  type MutableWallColumnTints,
} from './lighting-presets.ts'
import type { LightGrid } from '../../common/drlg/light-grid.ts'

export {
  computeAnimFrameIndex,
  computeStepSpeed256,
  getCharAnimClip113c,
  layoutGroundItemLabels,
}

import {
  reportMissingArt,
  getMissingArtEntries,
  clearMissingArtEntries as clearMissingArtRegistry,
  type MissingArtEntry,
} from './missing-art.ts'

export { reportMissingArt, getMissingArtEntries }
export type { MissingArtEntry }

interface TrackedOneShotState {
  readonly clipKey: string
  readonly rawStartedAtMs: number | undefined
  readonly effectiveStartMs: number
}

const dropStartMsByItemId = new Map<number, number>()
const oneShotStartMsByUnitKey = new Map<string, TrackedOneShotState>()
/** 1.13c wall occlusion-fade state per scene source, reset when the level changes. */
const wallFadeTrackers = new WeakMap<object, { levelId: number; tracker: WallFadeTracker113c }>()
const scratchWallColumnTints: MutableWallColumnTints = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
]
const scratchUnitLight: [number, number, number] = [0, 0, 0]

function resolveOneShotStartMs(
  unitKey: string,
  clipKey: string,
  rawStartedAtMs: number | undefined,
  nowMs: number,
): number {
  if (rawStartedAtMs !== undefined && Number.isFinite(rawStartedAtMs) && rawStartedAtMs <= nowMs) {
    oneShotStartMsByUnitKey.set(unitKey, {
      clipKey,
      rawStartedAtMs,
      effectiveStartMs: rawStartedAtMs,
    })
    return rawStartedAtMs
  }
  const prev = oneShotStartMsByUnitKey.get(unitKey)
  if (
    prev !== undefined &&
    prev.clipKey === clipKey &&
    prev.rawStartedAtMs === rawStartedAtMs &&
    nowMs >= prev.effectiveStartMs
  ) {
    return prev.effectiveStartMs
  }
  oneShotStartMsByUnitKey.set(unitKey, {
    clipKey,
    rawStartedAtMs,
    effectiveStartMs: nowMs,
  })
  return nowMs
}

export function clearMissingArtEntries(): void {
  clearMissingArtRegistry()
  dropStartMsByItemId.clear()
  oneShotStartMsByUnitKey.clear()
}

/**
 * Compute 0-based animation frame index from elapsed time `nowMs` and 1.13c 8.8 fixed-point
 * animation speed (`speed256`, where `256 = 1.0` frame per 25Hz / 40ms game tick;
 * `D2Common.dll` `0x6FDBE510` / `0x6FDBEFF0`).
 */
export function computeAnimDataFrameIndex(
  nowMs: number,
  speed256: number,
  frameCount: number,
  loop = true,
): number {
  if (frameCount <= 1) return 0
  const safeTicks = Math.max(0, nowMs) / 40
  const rawFrame = Math.floor((safeTicks * speed256) / 256)
  if (!loop) {
    return Math.min(frameCount - 1, Math.max(0, rawFrame))
  }
  return ((rawFrame % frameCount) + frameCount) % frameCount
}

const MONSTER_MODE_TO_CLIP: Readonly<Record<number, string>> = {
  0: 'dt',
  1: 'nu',
  2: 'wl',
  3: 'gh',
  4: 'a1',
  5: 'a2',
  6: 'bl',
  7: 'sc',
  8: 's1',
  9: 's2',
  10: 's3',
  11: 's4',
  12: 'dd',
  13: 'gh',
  14: 'xx',
  15: 'rn',
}

const OBJECT_MODE_TO_CLIP: Readonly<Record<number, string>> = {
  0: 'nu',
  1: 'op',
  2: 'on',
  3: 's1',
  4: 's2',
  5: 's3',
  6: 's4',
  7: 's5',
}

/**
 * Asynchronous GPU cache uploading packed Act 1..5 R8 tile pages and 768-byte ACT palettes
 * to WebGL2 `SpriteRenderer`.
 */
export class TileAtlasGpuCache {
  private readonly renderer: SpriteRenderer
  private readonly pageHandles = new Map<string, AtlasHandle>()
  private readonly inflightPages = new Set<string>()
  private readonly requestedPalettes = new Set<number>()
  private readonly paletteBytesByAct = new Map<number, Uint8Array>()
  private activePaletteAct = 0
  /** Page keys required by the active level plus its connected neighbours. */
  private retainedPageKeys: ReadonlySet<string> | null = null
  private evictTimer: ReturnType<typeof setTimeout> | null = null

  constructor(renderer: SpriteRenderer) {
    this.renderer = renderer
  }

  get loadedPageCount(): number {
    return this.pageHandles.size
  }

  ensureActPalette(actId: number): void {
    const normalizedAct = Math.max(1, Math.min(5, Math.floor(actId || 1)))
    const existing = this.paletteBytesByAct.get(normalizedAct)
    if (existing) {
      if (this.activePaletteAct !== normalizedAct) {
        this.renderer.setPalette(existing)
        this.activePaletteAct = normalizedAct
      }
      return
    }
    if (this.requestedPalettes.has(normalizedAct) || typeof fetch === 'undefined') {
      return
    }
    this.requestedPalettes.add(normalizedAct)
    const urls = [`/act-packs/tiles/act${normalizedAct}/palette.bin`]
    void (async () => {
      for (const url of urls) {
        try {
          const res = await fetch(url)
          if (!res.ok) continue
          const bytes = new Uint8Array(await res.arrayBuffer())
          if (bytes.byteLength >= 768) {
            this.paletteBytesByAct.set(normalizedAct, bytes)
            if (this.activePaletteAct === 0 || this.activePaletteAct === normalizedAct) {
              this.renderer.setPalette(bytes)
              this.activePaletteAct = normalizedAct
            }
            return
          }
        } catch {
          // try fallback url
        }
      }
      reportMissingArt(
        'tile-palette',
        `act${normalizedAct}`,
        `Failed to load act${normalizedAct} palette.bin from ${urls.join(', ')}`,
      )
    })()
  }

  private pageKey(actId: number, pageIndex: number): string {
    const normalizedAct = Math.max(1, Math.min(5, Math.floor(actId || 1)))
    return `${normalizedAct}:${pageIndex}`
  }

  getPageHandle(actId: number, pageIndex: number): AtlasHandle | undefined {
    const normalizedAct = Math.max(1, Math.min(5, Math.floor(actId || 1)))
    const key = this.pageKey(normalizedAct, pageIndex)
    const cached = this.pageHandles.get(key)
    if (cached !== undefined) {
      return cached
    }
    if (this.inflightPages.has(key) || typeof fetch === 'undefined') {
      return undefined
    }
    this.inflightPages.add(key)
    const urls = [`/act-packs/tiles/act${normalizedAct}/tiles-${pageIndex}.r8`]
    void (async () => {
      try {
        for (const url of urls) {
          try {
            const res = await fetch(url)
            if (!res.ok) continue
            const r8 = new Uint8Array(await res.arrayBuffer())
            if (r8.byteLength === 0) continue
            const width = 2048
            const height = Math.max(1, Math.floor(r8.byteLength / width))
            const handle = this.renderer.addIndexedAtlas(r8, width, height)
            // The area may have changed while this page was streaming. Do not
            // keep a page the latest retain set already dropped.
            if (this.retainedPageKeys !== null && !this.retainedPageKeys.has(key)) {
              this.renderer.deleteAtlas(handle)
              return
            }
            this.pageHandles.set(key, handle)
            return
          } catch {
            // try fallback url
          }
        }
        reportMissingArt(
          'tile-page',
          `act${normalizedAct}:${pageIndex}`,
          `Failed to load act${normalizedAct} tiles-${pageIndex}.r8 from ${urls.join(', ')}`,
        )
      } finally {
        // An evicted page must be streamable again when the player returns.
        this.inflightPages.delete(key)
      }
    })()
    return undefined
  }

  hasPageHandle(actId: number, pageIndex: number): boolean {
    const key = this.pageKey(actId, pageIndex)
    return this.pageHandles.has(key) || this.inflightPages.has(key)
  }

  /**
   * Pre-warm R8 tile atlas pages in the background without changing the active act palette (#1025).
   */
  preloadPages(pages: Iterable<{ readonly act: number; readonly page: number }>): void {
    for (const p of pages) {
      this.getPageHandle(p.act, p.page)
    }
  }

  /**
   * Declare the pages the active level and its connected neighbours need and
   * release every other GPU page after `graceMs` (#1316). The grace period lets
   * transition frames finish drawing the previous level before its textures go.
   */
  retainPages(
    pages: Iterable<{ readonly act: number; readonly page: number }>,
    graceMs = 2_000,
  ): void {
    const keep = new Set<string>()
    for (const p of pages) keep.add(this.pageKey(p.act, p.page))
    this.retainedPageKeys = keep
    if (this.evictTimer !== null) {
      clearTimeout(this.evictTimer)
      this.evictTimer = null
    }
    this.evictTimer = setTimeout(() => {
      this.evictTimer = null
      this.releaseUnretainedPages()
    }, Math.max(0, graceMs))
  }

  private releaseUnretainedPages(): void {
    const keep = this.retainedPageKeys
    if (keep === null) return
    for (const [key, handle] of [...this.pageHandles]) {
      if (keep.has(key)) continue
      this.renderer.deleteAtlas(handle)
      this.pageHandles.delete(key)
    }
  }
}

export class PlayerPaperdollGpuCache {
  private readonly renderer: SpriteRenderer
  private readonly packBaseOrLoader: string | CharLayerAssetLoader
  private readonly compositorsByClass = new Map<string, SorceressLayerCompositor>()
  private readonly loadedByKey = new Map<string, LoadedCharacter>()
  private readonly inflightByKey = new Map<string, Promise<LoadedCharacter | null>>()
  private readonly failedKeys = new Set<string>()
  private readonly lastActiveByUnitId = new Map<number, LoadedCharacter>()
  private readonly lastKeyByUnitId = new Map<number, string>()

  constructor(
    renderer: SpriteRenderer,
    packBaseOrLoader: string | CharLayerAssetLoader = '',
  ) {
    this.renderer = renderer
    this.packBaseOrLoader = packBaseOrLoader
  }

  private getCompositor(classToken: PlayerClassToken): SorceressLayerCompositor {
    const token = classToken.toLowerCase() as PlayerClassToken
    let comp = this.compositorsByClass.get(token)
    if (!comp) {
      comp =
        this.packBaseOrLoader === ''
          ? getSharedClassLayerCompositor(token)
          : new SorceressLayerCompositor(this.packBaseOrLoader, token)
      this.compositorsByClass.set(token, comp)
    }
    return comp
  }

  getLoadedAppearanceKey(unitId: number): string | undefined {
    return this.lastKeyByUnitId.get(unitId)
  }

  hasLoadedAppearance(key: string): boolean {
    return this.loadedByKey.has(key)
  }

  ensureAppearance(
    spec: SorceressAppearanceSpec,
    unitId?: number,
    keyOverride?: string,
  ): Promise<LoadedCharacter | null> {
    const key = keyOverride ?? appearanceKey(spec)
    const existing = this.loadedByKey.get(key)
    if (existing !== undefined) {
      if (unitId !== undefined) {
        this.lastActiveByUnitId.set(unitId, existing)
        this.lastKeyByUnitId.set(unitId, key)
      }
      return Promise.resolve(existing)
    }
    if (this.failedKeys.has(key)) {
      return Promise.resolve(null)
    }
    const inflight = this.inflightByKey.get(key)
    if (inflight !== undefined) {
      return inflight.then(art => {
        if (art !== null && unitId !== undefined) {
          this.lastActiveByUnitId.set(unitId, art)
          this.lastKeyByUnitId.set(unitId, key)
        }
        return art
      })
    }
    const classToken = (spec.classToken ?? 'so').toLowerCase() as PlayerClassToken
    const promise = (async (): Promise<LoadedCharacter | null> => {
      try {
        const compositor = this.getCompositor(classToken)
        const composited = await compositor.composite(spec)
        const handle = this.renderer.addIndexedAtlas(
          composited.r8,
          composited.width,
          composited.height,
        )
        const groups: AtlasFrame[][] = composited.groups.map(group =>
          group.map(([x, y, width, height, anchorX, anchorY]) => ({
            x,
            y,
            width,
            height,
            ...(anchorX !== undefined ? { anchorX } : {}),
            ...(anchorY !== undefined ? { anchorY } : {}),
          })),
        )
        const loaded: LoadedCharacter = {
          handle,
          groups,
          directions: composited.directions,
          walk: composited.walk,
          stand: composited.stand,
          members: composited.members,
          clips: composited.clips,
        }
        this.loadedByKey.set(key, loaded)
        if (unitId !== undefined) {
          this.lastActiveByUnitId.set(unitId, loaded)
          this.lastKeyByUnitId.set(unitId, key)
        }
        return loaded
      } catch (err) {
        this.failedKeys.add(key)
        if (classToken === 'so' || typeof this.packBaseOrLoader !== 'string') {
          reportMissingArt(
            'player-paperdoll',
            key,
            `Failed to composite character (${classToken}) paperdoll (${key}): ${(err as Error).message}`,
          )
        }
        return null
      } finally {
        this.inflightByKey.delete(key)
      }
    })()
    this.inflightByKey.set(key, promise)
    return promise
  }

  getCharacterArt(
    spec: SorceressAppearanceSpec,
    unitId?: number,
    keyOverride?: string,
  ): LoadedCharacter | 'loading' | null {
    const key = keyOverride ?? appearanceKey(spec)
    const cached = this.loadedByKey.get(key)
    if (cached !== undefined) {
      if (unitId !== undefined) {
        this.lastActiveByUnitId.set(unitId, cached)
        this.lastKeyByUnitId.set(unitId, key)
      }
      return cached
    }
    if (this.failedKeys.has(key)) {
      return null
    }
    void this.ensureAppearance(spec, unitId, key)
    if (unitId !== undefined) {
      const prev = this.lastActiveByUnitId.get(unitId)
      if (prev !== undefined) {
        return prev
      }
    }
    return 'loading'
  }
}

const paperdollGpuCacheByRenderer = new WeakMap<SpriteRenderer, PlayerPaperdollGpuCache>()

export function getPlayerPaperdollGpuCache(
  renderer: SpriteRenderer,
  packBaseOrLoader?: string | CharLayerAssetLoader,
): PlayerPaperdollGpuCache {
  let cache = paperdollGpuCacheByRenderer.get(renderer)
  if (!cache || packBaseOrLoader !== undefined) {
    cache = new PlayerPaperdollGpuCache(renderer, packBaseOrLoader)
    paperdollGpuCacheByRenderer.set(renderer, cache)
  }
  return cache
}

export interface SceneSourceRenderContext {
  readonly source: SceneSource
  readonly lightingPreset: LightingPreset
  readonly lightingTargets?: LightingPassTargets | undefined
  readonly renderer?: SpriteRenderer | null | undefined
  readonly tileGpuCache?: TileAtlasGpuCache | null | undefined
  readonly paperdollGpuCache?: PlayerPaperdollGpuCache | null | undefined
  readonly entityArtCache?: EntityArtCache | null | undefined
  readonly characterArt?: LoadedCharacter | null | undefined
  readonly characterArtByToken?: ReadonlyMap<string, LoadedCharacter> | undefined
  /**
   * On-demand loader for `char-<token>.r8` class packs. Called (fire-and-forget,
   * internally deduped) when a player unit or disguised summon renders without
   * its class pack in `characterArtByToken` yet.
   */
  readonly ensureCharacterArt?: ((token: string) => Promise<void>) | undefined
  /**
   * #954 retention signal: fired whenever a draw resolves a class pack from
   * `characterArtByToken`, so the owner can track live use and evict packs no
   * unit has needed for a while (multiplayer: present players stay MRU).
   */
  readonly noteCharacterArtUse?: ((token: string) => void) | undefined
  readonly monsterArtMap?: ReadonlyMap<string, LoadedMonsterArt> | undefined
  readonly objectArtMap?: ReadonlyMap<string, LoadedObjectArt> | undefined
  readonly missileArtMap?: ReadonlyMap<string, LoadedMissileArt> | undefined
  readonly overlayArtMap?: ReadonlyMap<string, LoadedOverlayArt> | undefined
  readonly itemsAtlasHandle?: AtlasHandle | undefined
  readonly minimap?: Minimap | null | undefined
  readonly automapView?: AutomapView | null | undefined
  readonly hudManager?: HudManager | null | undefined
  /** 1.13c weather: updated after the camera is set, drawn after the floors and after the roofs. */
  readonly weather?: SceneWeatherPass | null | undefined
  readonly nowMs?: number | undefined
  readonly onFrameSnapshot?: ((snapshot: SceneFrameSnapshot) => void) | undefined
}

function resolveOnlineMonsterArt(
  unit: SceneUnitDrawable,
  monsterArtMap: ReadonlyMap<string, LoadedMonsterArt> | undefined,
): LoadedMonsterArt | undefined {
  if (!monsterArtMap || monsterArtMap.size === 0) return undefined
  const rawToken = unit.token.trim().toLowerCase()
  const direct =
    monsterArtMap.get(rawToken) ??
    (rawToken ? monsterArtMap.get(`token:${rawToken}`) : undefined)
  if (direct) return direct

  const byHcIdxKey = monsterArtMap.get(`hcidx:${unit.classId}`)
  if (byHcIdxKey) return byHcIdxKey

  const townDesc = getTownNpcDescriptorByHcIdx(unit.classId)
  if (townDesc) {
    const npcKey = townDesc.npcTxtKey.toLowerCase()
    const byNpc = monsterArtMap.get(npcKey) ?? monsterArtMap.get(townDesc.displayName.toLowerCase())
    if (byNpc) return byNpc
    const spec = MONSTER_ART_MAP[npcKey]
    if (spec) {
      const byToken = monsterArtMap.get(`token:${spec.token.toLowerCase()}`)
      if (byToken) return byToken
    }
  }

  return undefined
}

/**
 * D2Client.dll 1.13c @ 0x6fb6d480..0x6fb6db90 (`D2Cmp_10076` -> `D2Gfx_10072` `DrawPerspectiveImage`):
 * Isometric perspective ground shadow tint and quad projection (`scaleY = 0.5`, `shearX = -0.5` towards top-left).
 */
export const SHADOW_TINT: readonly [number, number, number, number] = [0, 0, 0, 0.5]

export function computeUnitShadowQuad(
  drawX: number,
  drawY: number,
  width: number,
  height: number,
): {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly x3: number
  readonly y3: number
  readonly tlX: number
  readonly tlY: number
  readonly trX: number
  readonly trY: number
  readonly blX: number
  readonly blY: number
  readonly brX: number
  readonly brY: number
} {
  const bottomY = drawY + height
  const shadowHeight = height * 0.5
  const topY = bottomY - shadowHeight
  const shearX = -shadowHeight
  const tlX = drawX + shearX
  const trX = drawX + width + shearX
  const blX = drawX
  const brX = drawX + width
  return {
    x0: tlX,
    y0: topY,
    x1: trX,
    y1: topY,
    x2: blX,
    y2: bottomY,
    x3: brX,
    y3: bottomY,
    tlX,
    tlY: topY,
    trX,
    trY: topY,
    blX,
    blY: bottomY,
    brX,
    brY: bottomY,
  }
}

export function drawUnitPerspectiveShadow(
  renderer: SpriteRenderer,
  frame: AtlasFrame,
  drawX: number,
  drawY: number,
  atlas?: AtlasHandle,
): void {
  if (typeof renderer.drawQuad !== 'function') return
  if (frame.width <= 0 || frame.height <= 0 || (frame.width <= 1 && frame.height <= 1)) return
  const q = computeUnitShadowQuad(drawX, drawY, frame.width, frame.height)
  renderer.drawQuad(frame, q.x0, q.y0, q.x1, q.y1, q.x2, q.y2, q.x3, q.y3, {
    ...(atlas !== undefined ? { atlas } : {}),
    tint: SHADOW_TINT,
    blendMode: 'normal',
    elevationY: 0,
  })
}

export function drawSceneUnitDrawable(
  renderer: SpriteRenderer,
  unit: SceneUnitDrawable,
  ctx: SceneSourceRenderContext,
  nowMs: number,
  actId: number,
): void {
  if (unit.unitKind === 'player') {
    const tokenLower = unit.token.toLowerCase()
    const isTransformedMorph =
      tokenLower === '40' || tokenLower === 'tg' || tokenLower === 'va' || tokenLower === 'fk'
    if (isTransformedMorph) {
      const morphClassId =
        tokenLower === '40' ? 430 : tokenLower === 'tg' ? 431 : tokenLower === 'fk' ? 212 : 135
      let art: LoadedMonsterArt | undefined
      if (ctx.entityArtCache) {
        const cacheRes = ctx.entityArtCache.getMonsterArt(morphClassId, actId)
        if (cacheRes === 'loading') {
          return
        }
        if (cacheRes !== 'missing') {
          art = cacheRes
        }
      }
      if (art === undefined) {
        art = resolveOnlineMonsterArt({ ...unit, classId: morphClassId }, ctx.monsterArtMap)
      }
      if (art !== undefined) {
        const isMoving = unit.mode === 2 || unit.mode === 3 || unit.mode === 6
        // Per D2Common.dll #11013 PlayerToMonsterMode (0x6FD9F780, lookup table @ 0x6FDE3088):
        // PLRMODE_CAST (10) -> MONMODE_CAST ('sc', fallback 's3'/'a1'),
        // PLRMODE_BLOCK (9) -> MONMODE_BLOCK ('bl', fallback 'a1'),
        // PLRMODE_KICK (12) -> MONMODE_SKILL4 ('s4', fallback 'a1'),
        // PLRMODE_SEQUENCE (18) -> MONMODE_ATTACK1 ('a1'),
        // PLRMODE_RUN (3) -> MONMODE_RUN ('rn', fallback 'wl').
        const morphClip =
          unit.mode === 7 || unit.mode === 18
            ? 'a1'
            : unit.mode === 8
              ? (art.clips?.a2 ? 'a2' : 'a1')
              : unit.mode === 10
                ? (art.clips?.sc ? 'sc' : art.clips?.s3 ? 's3' : 'a1')
                : unit.mode === 13
                  ? (art.clips?.s1 ? 's1' : art.clips?.sc ? 'sc' : 'a1')
                  : unit.mode === 14
                    ? (art.clips?.s2 ? 's2' : art.clips?.s1 ? 's1' : 'a1')
                    : unit.mode === 15
                      ? (art.clips?.s3 ? 's3' : art.clips?.s1 ? 's1' : 'a1')
                      : unit.mode === 16 || unit.mode === 12
                        ? (art.clips?.s4 ? 's4' : art.clips?.s1 ? 's1' : 'a1')
                        : unit.mode === 9
                          ? (art.clips?.bl ? 'bl' : 'a1')
                          : unit.mode === 4 || unit.mode === 19
                            ? 'gh'
                            : unit.mode === 0 || unit.mode === 17
                              ? 'dt'
                              : unit.mode === 3
                                ? (art.clips?.rn ? 'rn' : 'wl')
                                : isMoving
                                  ? 'wl'
                                  : 'nu'
        const requestedClipKey = unit.isCorpse
          ? (art.clips?.dt ? 'dt' : art.clips?.dd ? 'dd' : 'nu')
          : (art.clips?.[morphClip] ? morphClip : (isMoving ? 'wl' : 'nu'))
        const clip = art.clips?.[requestedClipKey] ?? art.clips?.nu ?? art.clips?.wl
        if (clip) {
          const dirCount = Math.max(1, clip.directions || art.directions)
          const direction = dir64ToClipDirection(unit.direction, dirCount)
          const baseGroup = clip.group
          const groupIndex = baseGroup + direction
          const group = art.groups[groupIndex] ?? art.groups[0]
          const frameCount = Math.max(1, group?.length ?? 1)
          const unitKey = `player:${unit.unitId}`
          const shouldLoop = (requestedClipKey as string) === 'nu' || (requestedClipKey as string) === 'wl' || (requestedClipKey as string) === 'rn'
          // Shapeshifted players animate via the MONSTER branch of #10819 (0x6FD83331):
          // base = MonStats Run/WalkAnimSpeed, scaled by the move velocity percent — the
          // engine still posts the +50% run temp stat for shapeshifted RUN
          // (UNITS_SetAnimStartFrame, Units.cpp:751-754). AnimData clip speeds are not used
          // for locomotion (issue #869 Diff 5).
          const morphMoving = unit.mode === 2 || unit.mode === 3 || unit.mode === 6
          const morphPathRec = morphMoving ? getMonsterPathRecord(morphClassId) : null
          const morphStepSpeed256 = morphPathRec
            ? computeLocomotionStepSpeed256(
                unit.mode === 3 ? morphPathRec.runAnimSpeed : morphPathRec.walkAnimSpeed,
                computeMoveVelocityPercent113c({
                  stat67: unit.velocityPercent,
                  running: unit.mode === 3,
                }),
              )
            : computeStepSpeed256(clip.speed || 16, unit.animEffRate ?? unit.castState?.effRate ?? 0)
          // If `unit.animStepSpeed256` was resolved by `ClientWorld` with `morphMonsterClassId`
          // (including local equipment FRW & armor speed penalty), prefer it; if a caller
          // passed an unmorphed human locomotion speed (213 walk / 151 naked run when no FRW)
          // or left `animStepSpeed256` unset, use `morphStepSpeed256`.
          const humanLocomotionStepSpeed = morphMoving
            ? computeLocomotionStepSpeed256(
                unit.mode === 3 ? 101 : 213,
                computeMoveVelocityPercent113c({
                  stat67: unit.velocityPercent,
                  running: unit.mode === 3,
                }),
              )
            : undefined
          const resolvedMorphAnimStepSpeed =
            morphMoving &&
            unit.animStepSpeed256 !== undefined &&
            unit.animStepSpeed256 === humanLocomotionStepSpeed &&
            unit.animStepSpeed256 !== morphStepSpeed256
              ? morphStepSpeed256
              : unit.animStepSpeed256
          const stepSpeed256 = morphMoving
            ? (resolvedMorphAnimStepSpeed ?? morphStepSpeed256)
            : (unit.animStepSpeed256 ?? unit.castState?.stepSpeed256 ?? morphStepSpeed256)
          let frameIndex = 0
          if (shouldLoop) {
            oneShotStartMsByUnitKey.delete(unitKey)
            frameIndex = computeAnimFrameIndex({
              frameCount,
              stepSpeed256,
              loop: true,
              nowMs,
              minStepSpeed256: morphMoving ? 0 : 32,
            })
          } else {
            const startedAtMs = resolveOneShotStartMs(
              unitKey,
              requestedClipKey,
              unit.animStartedAtMs ?? unit.castState?.startedAtMs,
              nowMs,
            )
            const morphCanonicalClip = getCharAnimClip113c(unit.classId, requestedClipKey, {
              morphMonsterClassId: morphClassId,
            })
            frameIndex = computeAnimFrameIndex({
              frameCount,
              stepSpeed256,
              loop: false,
              nowMs,
              startedAtMs,
              skillId: unit.castState?.skillId,
              actionFrame: morphCanonicalClip?.actionFrame,
            })
          }
          const frame = group?.[frameIndex] ?? group?.[0]
          if (frame !== undefined) {
            const altitude = unit.altitude ?? 0
            const drawX =
              frame.anchorX !== undefined
                ? unit.worldX + frame.anchorX
                : unit.worldX - frame.width / 2
            const groundDrawY =
              frame.anchorY !== undefined
                ? unit.worldY + frame.anchorY
                : unit.worldY - frame.height + FEET_HEIGHT / 2
            const drawY = groundDrawY - altitude
            const isFaded =
              Boolean(unit.isFaded) ||
              unit.blendMode === 'trans50' ||
              unit.overlays.some((o) => o.token.toLowerCase() === 'fade')
            const baseAlpha = isFaded ? 0.55 : 1.0
            const tint = unit.tintColor
              ? ([
                  unit.tintColor[0] / 255,
                  unit.tintColor[1] / 255,
                  unit.tintColor[2] / 255,
                  baseAlpha,
                ] as const)
              : isFaded
                ? ([1.0, 1.0, 1.0, baseAlpha] as const)
                : undefined
            if (!unit.isCorpse && !(unit as { dead?: boolean }).dead && unit.mode !== 0 && unit.mode !== 17) {
              drawUnitPerspectiveShadow(renderer, frame, drawX, groundDrawY, art.handle)
            }
            renderer.draw(frame, drawX, drawY, {
              atlas: art.handle,
              elevationY: Math.max(0, frame.height - 16),
              ...(tint ? { tint } : {}),
              ...(isFaded ? { blendMode: 'trans50' } : {}),
            })
            return
          }
        }
      }
    }

    let charArt: LoadedCharacter | null = null
    const unitTokenLower = unit.token.toLowerCase()
    if (
      (PLAYER_CLASS_TOKENS as readonly string[]).includes(unitTokenLower) &&
      unit.equipmentAppearance !== undefined
    ) {
      const effectiveSpec: SorceressAppearanceSpec =
        unit.equipmentAppearance.classToken !== undefined
          ? unit.equipmentAppearance
          : { ...unit.equipmentAppearance, classToken: unitTokenLower as PlayerClassToken }
      const paperdollCache = ctx.paperdollGpuCache ?? getPlayerPaperdollGpuCache(renderer)
      const dynamicArt = paperdollCache.getCharacterArt(
        effectiveSpec,
        unit.unitId,
        unit.appearanceKey,
      )
      if (dynamicArt !== 'loading' && dynamicArt !== null) {
        charArt = dynamicArt
      }
    }
    if (charArt === null) {
      charArt =
        ctx.characterArtByToken?.get(unit.token.toLowerCase()) ??
        ctx.characterArtByToken?.get(unit.token.toUpperCase()) ??
        ctx.characterArt ??
        null
      if (charArt !== null && ctx.noteCharacterArtUse !== undefined) {
        ctx.noteCharacterArtUse(unitTokenLower)
      }
      if (
        charArt === null &&
        ctx.ensureCharacterArt !== undefined &&
        (PLAYER_CLASS_TOKENS as readonly string[]).includes(unitTokenLower)
      ) {
        // Transient miss: the class pack streams in via ensureCharacterArt,
        // which itself fail-fast reports permanently missing packs (no audit
        // false-positives for the loading window).
        void ctx.ensureCharacterArt(unitTokenLower)
        return
      }
    }
    if (charArt !== null) {
      const isMoving = unit.mode === 2 || unit.mode === 3 || unit.mode === 6
      const modeToken = PLR_MODES[unit.mode]?.token.toLowerCase()
      const unitKey = `player:${unit.unitId}`
      let resolvedSeq: ReturnType<typeof resolveSkillSequenceFrame> = null
      let requestedClipKey = unit.isCorpse && modeToken !== 'dt' ? 'dd' : modeToken
      if (!unit.isCorpse && modeToken === 'sq') {
        const seqSkillId = unit.castState?.skillId ?? (unit.classId === 1 ? 49 : 0)
        const seqWClass = unit.equipmentAppearance?.wclass ?? 'hth'
        const prelimStepSpeed256 =
          unit.animStepSpeed256 ?? unit.castState?.stepSpeed256 ?? 256
        const seqStartedAtMs = resolveOneShotStartMs(
          unitKey,
          `sq:${seqSkillId}`,
          unit.animStartedAtMs ?? unit.castState?.startedAtMs,
          nowMs,
        )
        const elapsedTicks = Math.floor(Math.max(0, nowMs - seqStartedAtMs) / 40)
        resolvedSeq = resolveSkillSequenceFrame(
          seqSkillId,
          seqWClass,
          elapsedTicks,
          prelimStepSpeed256,
        )
        requestedClipKey = resolvedSeq?.clipKey ?? (unit.classId === 1 ? 's1' : 'a1')
        if (!charArt.clips?.[requestedClipKey]) {
          if (unit.classId === 1 && charArt.clips?.sc) {
            requestedClipKey = 'sc'
          } else if (charArt.clips?.a1) {
            requestedClipKey = 'a1'
          }
        }
      }
      if (!requestedClipKey) {
        reportMissingArt(
          'player-mode',
          `${unit.token}:${unit.mode}`,
          `Invalid player mode=${unit.mode} for token=${unit.token}`,
        )
        return
      }
      const clip = charArt.clips?.[requestedClipKey]
      const canonicalClip = getCharAnimClip113c(unit.classId, requestedClipKey)
      // Engine hardcode for player locomotion (D2Common UNITS_GetBaseAnimSpeed,
      // issue #852/#869): wl/tw=213, rn=101 — baked/composited manifest speeds carry
      // the AnimData value (e.g. 256) and must be overridden for walk/run; the run
      // velocity bonus (+50%) is applied via the move velocity percent, not baked in.
      const baseSpeed = resolvePlayerLocomotionBaseSpeed256(
        requestedClipKey,
        (clip?.speed && clip.speed > 0 ? clip.speed : canonicalClip?.speed) ?? 0,
      )
      if (!clip || !(baseSpeed > 0)) {
        reportMissingArt(
          'player-clip',
          `${unit.token}:${requestedClipKey}`,
          `Missing player clip or AnimData.d2 speed for token=${unit.token} clip=${requestedClipKey} mode=${unit.mode}`,
        )
        return
      }
      const dirCount = Math.max(1, clip.directions || charArt.directions)
      const direction = dir64ToClipDirection(unit.direction, dirCount)
      const groupIndex = clip.group + direction
      const group = charArt.groups[groupIndex]
      const frameCount = Math.max(1, group?.length ?? 1)
      let frameIndex = 0
      if ((unit.isCorpse && requestedClipKey !== 'dt') || requestedClipKey === 'dd') {
        oneShotStartMsByUnitKey.delete(unitKey)
        frameIndex = frameCount - 1
      } else if (resolvedSeq) {
        frameIndex = Math.max(0, Math.min(frameCount - 1, resolvedSeq.frameIndex))
      } else {
        const shouldLoop =
          !unit.isCorpse &&
          requestedClipKey !== 'dd' &&
          requestedClipKey !== 'dt' &&
          (clip.loop !== undefined
            ? clip.loop
            : (canonicalClip?.loop ??
              (requestedClipKey === 'nu' ||
                requestedClipKey === 'tn' ||
                requestedClipKey === 'wl' ||
                requestedClipKey === 'tw' ||
                requestedClipKey === 'rn')))
        const isLocomotionClip =
          requestedClipKey === 'wl' || requestedClipKey === 'tw' || requestedClipKey === 'rn'
        // Locomotion fallback when no animStepSpeed256 is cached: the naked-engine cadence
        // (walk 213 / run 151), per UNITS_UpdateRunWalkAnimRateAndVelocity (0x6FD83331).
        const fallbackStepSpeed256 = isLocomotionClip
          ? computeLocomotionStepSpeed256(
              baseSpeed,
              computeMoveVelocityPercent113c({
                stat67: unit.velocityPercent,
                running: requestedClipKey === 'rn',
              }),
            )
          : computeStepSpeed256(baseSpeed, unit.animEffRate ?? unit.castState?.effRate ?? 0)
        const stepSpeed256 =
          unit.animStepSpeed256 ?? unit.castState?.stepSpeed256 ?? fallbackStepSpeed256
        if (shouldLoop) {
          oneShotStartMsByUnitKey.delete(unitKey)
          frameIndex = computeAnimFrameIndex({
            frameCount,
            stepSpeed256,
            loop: true,
            nowMs,
            minStepSpeed256: isLocomotionClip ? 0 : 32,
          })
        } else {
          const startedAtMs = resolveOneShotStartMs(
            unitKey,
            requestedClipKey,
            unit.animStartedAtMs ?? unit.castState?.startedAtMs,
            nowMs,
          )
          frameIndex = computeAnimFrameIndex({
            frameCount,
            stepSpeed256,
            loop: false,
            nowMs,
            startedAtMs,
            skillId: unit.castState?.skillId,
            actionFrame: canonicalClip?.actionFrame,
          })
        }
      }
      const frame = group?.[frameIndex] ?? group?.[0]
      if (frame !== undefined) {
        const altitude = unit.altitude ?? 0
        const drawX =
          frame.anchorX !== undefined
            ? unit.worldX + frame.anchorX
            : unit.worldX - frame.width / 2
        const groundDrawY =
          frame.anchorY !== undefined
            ? unit.worldY + frame.anchorY
            : unit.worldY - frame.height + FEET_HEIGHT / 2
        const drawY = groundDrawY - altitude
        const isFaded =
          Boolean(unit.isFaded) ||
          unit.blendMode === 'trans50' ||
          unit.overlays.some((o) => o.token.toLowerCase() === 'fade')
        const baseAlpha = isFaded ? 0.55 : 1.0
        // Issue #1369: Do not multiply RGB tintColor on top of an active palette row shift (double tinting)
        const hasActivePaletteShift = unit.paletteRow !== undefined && unit.paletteRow > 0
        const tint = (unit.tintColor && !hasActivePaletteShift)
          ? ([
              unit.tintColor[0] / 255,
              unit.tintColor[1] / 255,
              unit.tintColor[2] / 255,
              baseAlpha,
            ] as const)
          : isFaded
            ? ([1.0, 1.0, 1.0, baseAlpha] as const)
            : undefined
        if (!unit.isCorpse && !(unit as { dead?: boolean }).dead && unit.mode !== 0 && unit.mode !== 17) {
          drawUnitPerspectiveShadow(renderer, frame, drawX, groundDrawY, charArt.handle)
        }
        renderer.draw(frame, drawX, drawY, {
          atlas: charArt.handle,
          elevationY: Math.max(0, frame.height - 16),
          ...(tint ? { tint } : {}),
          ...(isFaded ? { blendMode: 'trans50' } : {}),
          ...(unit.paletteRow !== undefined ? { paletteRow: unit.paletteRow } : {}),
        })
        return
      }
    }
    reportMissingArt(
      'player',
      unit.token || String(unit.classId),
      `Missing player character art for token=${unit.token} classId=${unit.classId}`,
    )
    return
  }

  if (unit.unitKind === 'monster') {
    // 1.13c Parity: Dopplezon (356) and Valkyrie (357) disguise as Amazon player (AM, char-am) while alive (States.txt 63/93 disguise=1, gfxtype=2, gfxclass=0)
    // Shadow Warrior (417) and Shadow Master (418) disguise as Assassin player (AI, char-ai) while alive (States.txt 119 gfxtype=2, gfxclass=6)
    // When dead (dt/dd/corpse), they fall through to monster-vk-hth to play the authentic 25-frame VK death and corpse animations
    const isAmazonDisguiseSummon = unit.classId === 356 || unit.classId === 357
    const isAssassinDisguiseSummon = unit.classId === 417 || unit.classId === 418
    const isSummonAlive = !unit.isCorpse && !(unit as { dead?: boolean }).dead && unit.mode !== 0 && unit.mode !== 12
    if ((isAmazonDisguiseSummon || isAssassinDisguiseSummon) && isSummonAlive) {
      const charToken = isAmazonDisguiseSummon ? 'am' : 'ai'
      const charClassId = isAmazonDisguiseSummon ? 0 : 6
      let charArt: LoadedCharacter | null = null
      if (unit.equipmentAppearance !== undefined) {
        const effectiveSpec: SorceressAppearanceSpec =
          unit.equipmentAppearance.classToken !== undefined
            ? unit.equipmentAppearance
            : { ...unit.equipmentAppearance, classToken: charToken as PlayerClassToken }
        const paperdollCache = ctx.paperdollGpuCache ?? getPlayerPaperdollGpuCache(renderer)
        const dynamicArt = paperdollCache.getCharacterArt(
          effectiveSpec,
          unit.unitId,
          unit.appearanceKey,
        )
        if (dynamicArt !== 'loading' && dynamicArt !== null) {
          charArt = dynamicArt
        }
      }
      if (charArt === null) {
        charArt =
          ctx.characterArtByToken?.get(charToken) ??
          ctx.characterArtByToken?.get(charToken.toUpperCase()) ??
          (ctx.characterArtByToken === undefined ? (ctx.characterArt ?? null) : null)
        if (charArt !== null && ctx.noteCharacterArtUse !== undefined) {
          ctx.noteCharacterArtUse(charToken)
        }
        if (charArt === null && ctx.ensureCharacterArt !== undefined) {
          void ctx.ensureCharacterArt(charToken)
          return
        }
      }
      if (charArt !== null) {
        const modeClip = MONSTER_MODE_TO_CLIP[unit.mode] ?? 'nu'
        const requestedClipKey = charArt.clips?.[modeClip]
          ? modeClip
          : (modeClip === 'a2' || modeClip === 'sc' || modeClip === 'xx') && charArt.clips?.a1
            ? 'a1'
            : 'nu'
        const clip = charArt.clips?.[requestedClipKey]
        const canonicalClip = getCharAnimClip113c(charClassId, requestedClipKey)
        const baseSpeed =
          (clip?.speed && clip.speed > 0 ? clip.speed : canonicalClip?.speed) ?? 16
        if (clip && baseSpeed > 0) {
          const dirCount = Math.max(1, clip.directions || charArt.directions)
          const direction = dir64ToClipDirection(unit.direction, dirCount)
          const baseGroup = clip.group
          const groupIndex = baseGroup + direction
          const group =
            charArt.groups[groupIndex] ??
            charArt.groups[0]
          const frameCount = Math.max(1, group?.length ?? 1)
          const unitKey = `monster:${unit.unitId}`
          const shouldLoop = requestedClipKey === 'nu' || requestedClipKey === 'wl' || requestedClipKey === 'rn'
          const stepSpeed256 =
            unit.animStepSpeed256 ??
            unit.castState?.stepSpeed256 ??
            computeStepSpeed256(baseSpeed, unit.animEffRate ?? unit.castState?.effRate ?? 0)
          let frameIndex = 0
          if (shouldLoop) {
            oneShotStartMsByUnitKey.delete(unitKey)
            frameIndex = computeAnimFrameIndex({
              frameCount,
              stepSpeed256,
              loop: true,
              nowMs,
            })
          } else {
            const startedAtMs = resolveOneShotStartMs(
              unitKey,
              requestedClipKey,
              unit.animStartedAtMs ?? unit.castState?.startedAtMs,
              nowMs,
            )
            frameIndex = computeAnimFrameIndex({
              frameCount,
              stepSpeed256,
              loop: false,
              nowMs,
              startedAtMs,
            })
          }
          const frame = group?.[frameIndex] ?? group?.[0]
          if (frame !== undefined) {
            const drawX =
              frame.anchorX !== undefined
                ? unit.worldX + frame.anchorX
                : unit.worldX - frame.width / 2
            const drawY =
              frame.anchorY !== undefined
                ? unit.worldY + frame.anchorY
                : unit.worldY - frame.height + FEET_HEIGHT / 2
            // 1.13c: Decoy (356) blue-white sheen; Valkyrie (357) golden sheen; Shadow Warrior (417) dark shadow sheen; Shadow Master (418) ethereal violet sheen
            const isFaded = unit.overlays.some((o) => o.token === 'fade')
            const baseAlpha = isFaded ? 0.55 : isAmazonDisguiseSummon && unit.classId === 356 ? 0.85 : isAssassinDisguiseSummon ? 0.8 : 1.0
            const hasActivePaletteShift = unit.paletteRow !== undefined && unit.paletteRow > 0
            const tint = (unit.tintColor && !hasActivePaletteShift)
              ? ([
                  unit.tintColor[0] / 255,
                  unit.tintColor[1] / 255,
                  unit.tintColor[2] / 255,
                  baseAlpha,
                ] as const)
              : unit.classId === 357
                ? ([1.0, 0.9, 0.5, baseAlpha] as const)
                : unit.classId === 356
                  ? ([0.75, 0.85, 1.0, baseAlpha] as const)
                  : unit.classId === 417
                    ? ([0.6, 0.6, 0.9, baseAlpha] as const)
                    : unit.classId === 418
                      ? ([0.85, 0.7, 1.0, baseAlpha] as const)
                      : isFaded
                        ? ([1.0, 1.0, 1.0, baseAlpha] as const)
                        : undefined
            if (isSummonAlive) {
              drawUnitPerspectiveShadow(renderer, frame, drawX, drawY, charArt.handle)
            }
            renderer.draw(frame, drawX, drawY, {
              atlas: charArt.handle,
              elevationY: Math.max(0, frame.height - 16),
              ...(tint ? { tint } : {}),
            })
            return
          }
        }
      }
    }

    let art: LoadedMonsterArt | undefined
    if (ctx.entityArtCache) {
      const cacheRes = ctx.entityArtCache.getMonsterVariantArt(unit.classId, unit.compVariants, actId)
      if (cacheRes === 'loading') {
        return
      }
      if (cacheRes !== 'missing') {
        art = cacheRes
      }
    }
    if (art === undefined) {
      art = resolveOnlineMonsterArt(unit, ctx.monsterArtMap)
    }
    if (art !== undefined) {
      const unitKey = `monster:${unit.unitId}`
      const isMoving = unit.mode === 2 || unit.mode === 15
      let sequenceStep: ResolvedMonsterSequenceFrame113c | undefined
      if (!unit.isCorpse && unit.mode === 14) {
        const seqStartedAtMs = resolveOneShotStartMs(
          unitKey,
          'sq',
          unit.animStartedAtMs ?? unit.castState?.startedAtMs,
          nowMs,
        )
        const seqSpeed256 =
          unit.animStepSpeed256 ??
          unit.castState?.stepSpeed256 ??
          art.clips?.a1?.speed ??
          art.clips?.nu?.speed ??
          256
        sequenceStep = resolveMonsterSequenceFrame113c(
          unit.classId,
          Math.max(0, nowMs - seqStartedAtMs),
          seqSpeed256,
          unit.castState?.skillId,
        )
      }
      const requestedClipKey = unit.isCorpse
        ? unit.mode === 0 && art.clips?.dt
          ? 'dt'
          : art.clips?.dd
            ? 'dd'
            : art.clips?.dt
              ? 'dt'
              : 'nu'
        : (sequenceStep?.clipKey ?? MONSTER_MODE_TO_CLIP[unit.mode] ?? (isMoving ? 'wl' : 'nu'))
      const clip =
        art.clips?.[requestedClipKey] ??
        (requestedClipKey === 'a2' || requestedClipKey === 'sc' || requestedClipKey === 'xx'
          ? art.clips?.a1
          : undefined) ??
        (isMoving ? art.clips?.wl : undefined) ??
        art.clips?.nu
      if (!clip || !(clip.speed > 0)) {
        reportMissingArt(
          'monster-clip',
          `${unit.classId}:${requestedClipKey}`,
          `Missing monster clip or AnimData.d2 speed for classId=${unit.classId} token=${unit.token} clip=${requestedClipKey}`,
        )
        return
      }
      const dirCount = Math.max(1, clip.directions || art.directions)
      const direction = dir64ToClipDirection(unit.direction, dirCount)
      const baseGroup = clip.group
      const groupIndex = baseGroup + direction
      const group = art.groups[groupIndex] ?? art.groups[art.standOffset + direction] ?? art.groups[0]
      const frameCount = Math.max(1, group?.length ?? 1)
      let frameIndex = 0
      if ((unit.isCorpse && requestedClipKey !== 'dt') || requestedClipKey === 'dd') {
        oneShotStartMsByUnitKey.delete(unitKey)
        frameIndex = frameCount - 1
      } else if (sequenceStep !== undefined) {
        frameIndex = Math.max(0, Math.min(frameCount - 1, sequenceStep.frameIndex))
      } else {
        const shouldLoop =
          !unit.isCorpse &&
          requestedClipKey !== 'dd' &&
          requestedClipKey !== 'dt' &&
          (clip.loop !== undefined
            ? clip.loop
            : requestedClipKey === 'nu' || requestedClipKey === 'wl' || requestedClipKey === 'rn')
        const stepSpeed256 =
          unit.animStepSpeed256 ??
          unit.castState?.stepSpeed256 ??
          clip.speed
        if (shouldLoop) {
          oneShotStartMsByUnitKey.delete(unitKey)
          frameIndex = computeAnimFrameIndex({
            frameCount,
            stepSpeed256,
            loop: true,
            nowMs,
          })
        } else {
          const startedAtMs = resolveOneShotStartMs(
            unitKey,
            requestedClipKey,
            unit.animStartedAtMs ?? unit.castState?.startedAtMs,
            nowMs,
          )
          frameIndex = computeAnimFrameIndex({
            frameCount,
            stepSpeed256,
            loop: false,
            nowMs,
            startedAtMs,
          })
        }
      }
      const frame = group?.[frameIndex] ?? group?.[0]
      if (frame !== undefined) {
        const altitude = unit.altitude ?? 0
        const drawX =
          frame.anchorX !== undefined
            ? unit.worldX + frame.anchorX
            : unit.worldX - frame.width / 2
        const groundDrawY =
          frame.anchorY !== undefined
            ? unit.worldY + frame.anchorY
            : unit.worldY - frame.height + FEET_HEIGHT / 2
        const drawY = groundDrawY - altitude
        const resolvedToken = (art.token || unit.token || '').trim().toUpperCase()
        const isOpaqueTownNpc =
          (unit.isNpc === true || isTownNpcHcIdx(unit.classId)) &&
          !ADDITIVE_MONSTER_TOKENS.has(resolvedToken)
        const baseBlendMode = isOpaqueTownNpc
          ? 'normal'
          : normalizeMonsterBlendMode(resolvedToken, art.blendMode)
        const hasActivePaletteShift = unit.paletteRow !== undefined && unit.paletteRow > 0
        const tint = (unit.tintColor && !hasActivePaletteShift)
          ? ([
              unit.tintColor[0] / 255,
              unit.tintColor[1] / 255,
              unit.tintColor[2] / 255,
              1.0,
            ] as const)
          : undefined
        if (!unit.isCorpse && !(unit as { dead?: boolean }).dead && unit.mode !== 0 && unit.mode !== 12 && baseBlendMode !== 'additive') {
          drawUnitPerspectiveShadow(renderer, frame, drawX, groundDrawY, art.handle)
        }
        renderer.draw(frame, drawX, drawY, {
          atlas: art.handle,
          blendMode: baseBlendMode,
          elevationY: Math.max(0, frame.height - 16),
          ...(tint ? { tint } : {}),
          ...(unit.paletteRow !== undefined ? { paletteRow: unit.paletteRow } : {}),
        })
        if (art.glowGroups !== undefined) {
          const rawGlowClip = art.glowClips?.[requestedClipKey]
          const glowClip =
            rawGlowClip !== undefined && rawGlowClip.group === clip.group
              ? rawGlowClip
              : undefined
          const glowGroupIndex = glowClip !== undefined ? glowClip.group + direction : groupIndex
          const glowGroup = art.glowGroups[glowGroupIndex] ?? art.glowGroups[groupIndex]
          const glowFrame = glowGroup?.[frameIndex] ?? glowGroup?.[0]
          if (glowFrame !== undefined && (glowFrame.width > 1 || glowFrame.height > 1)) {
            renderer.draw(glowFrame, drawX, drawY, {
              atlas: art.handle,
              blendMode: 'additive',
            })
          }
        }
        return
      }
    }
    // 1.13c SkillCltDoFunc[89] / StateCltDoFunc[4] bridge (Issue #1288):
    // Druid vine summons (plaguepoppy #425, cycleoflife #426, vinecreature #427, token 'k9') have no DCC files
    // under data/global/monsters/k9/; their visuals reside in Missiles.txt ('vine beast walk 1' #466,
    // 'vine beast neutral' #468, 'vine beast attack' #469, 'vine beast death' #470).
    if (
      unit.classId === 425 ||
      unit.classId === 426 ||
      unit.classId === 427 ||
      unit.token.trim().toLowerCase() === 'k9'
    ) {
      const isDeadOrCorpse =
        unit.isCorpse ||
        Boolean((unit as { dead?: boolean }).dead) ||
        unit.mode === 0 ||
        unit.mode === 12
      const isMoving = unit.mode === 2 || unit.mode === 15
      const isAttacking =
        unit.mode === 4 ||
        unit.mode === 5 ||
        unit.mode === 7 ||
        unit.mode === 8 ||
        unit.mode === 9 ||
        unit.mode === 10 ||
        unit.mode === 11
      const vineMissileKey = isDeadOrCorpse
        ? 'vine beast death'
        : isMoving
          ? 'vine beast walk 1'
          : isAttacking
            ? 'vine beast attack'
            : 'vine beast neutral'
      const vineCelFile = isDeadOrCorpse
        ? 'expansion/Pod_death_1'
        : isMoving
          ? 'expansion/Pod_walk_1'
          : isAttacking
            ? 'expansion/Pod_attack_1'
            : 'expansion/Pod_neutral_1'
      const vineArt =
        resolveArtByCelFile(ctx.missileArtMap, vineMissileKey, vineCelFile) ??
        ctx.missileArtMap?.get(vineMissileKey)
      if (vineArt !== undefined) {
        const dirCount = Math.max(1, vineArt.meta.directions)
        const direction = dir64ToClipDirection(unit.direction, dirCount)
        const group = vineArt.frames[direction] ?? vineArt.frames[0]
        const frameCount = Math.max(1, group?.length ?? 1)
        const stepSpeed256 = Math.max(1, (vineArt.meta.animSpeed || 16) * 16)
        const shouldLoop = !isDeadOrCorpse && !isAttacking
        const frameIdx =
          isDeadOrCorpse && unit.mode === 12
            ? frameCount - 1
            : computeAnimFrameIndex({
                frameCount,
                stepSpeed256,
                loop: shouldLoop,
                nowMs,
              })
        const frame = group?.[frameIdx] ?? group?.[0]
        if (frame !== undefined) {
          const drawX =
            frame.anchorX !== undefined
              ? unit.worldX + frame.anchorX
              : unit.worldX - frame.width / 2
          const drawY =
            frame.anchorY !== undefined
              ? unit.worldY + frame.anchorY
              : unit.worldY - frame.height + FEET_HEIGHT / 2
          renderer.draw(frame, drawX, drawY, {
            atlas: vineArt.handle,
            blendMode: 'normal',
            elevationY: Math.max(0, frame.height - 16),
          })
        }
      }
      return
    }
    reportMissingArt(
      'monster',
      String(unit.classId),
      `Missing monster/NPC art for classId=${unit.classId} token=${unit.token}`,
    )
    return
  }

  if (unit.unitKind === 'item') {
    const rawCode =
      unit.code?.trim().toLowerCase() ||
      unit.itemCode?.trim().toLowerCase() ||
      (unit.token && !unit.token.startsWith('ITM_') ? unit.token.trim().toLowerCase() : '') ||
      BAKED_UI_MANIFEST.itemClassIdToCode[unit.classId] ||
      ''
    const isGold = rawCode === 'gld'
    const goldAmt = unit.goldAmount ?? 50
    let sr: SpriteRect | null = null

    const itemResolvable = {
      isGold,
      amount: goldAmt,
      code: rawCode,
      ...(unit.name ? { name: unit.name } : {}),
      ...(unit.flippyFile ? { flippyFile: unit.flippyFile } : {}),
      ...(unit.invFile ? { invFile: unit.invFile } : {}),
      ...(unit.invtransform ? { invtransform: unit.invtransform } : {}),
    }

    if (unit.mode === 5 && rawCode) {
      const flippyFile = resolveGroundItemFlippyKey(
        itemResolvable,
        BAKED_UI_MANIFEST.flippyFrames,
        BAKED_UI_MANIFEST.codeToFlippyFile,
      )
      const frames = flippyFile ? BAKED_UI_MANIFEST.flippyFrames?.[flippyFile] : undefined
      if (frames && frames.length > 0) {
        let frameIdx = 0
        if (unit.frame > 0) {
          frameIdx = Math.min(frames.length - 1, unit.frame)
        } else {
          dropStartMsByItemId.delete(unit.unitId)
          const startMs = resolveOneShotStartMs(
            `item:${unit.unitId}`,
            flippyFile ?? rawCode,
            unit.animStartedAtMs,
            nowMs,
          )
          frameIdx = Math.min(
            frames.length - 1,
            Math.floor(Math.max(0, nowMs - startMs) / 40),
          )
        }
        sr = frames[frameIdx] ?? frames[frames.length - 1] ?? null
      }
    } else {
      dropStartMsByItemId.delete(unit.unitId)
      oneShotStartMsByUnitKey.delete(`item:${unit.unitId}`)
    }

    if (!sr && rawCode) {
      sr = resolveGroundItemSpriteRect(
        itemResolvable,
        BAKED_UI_MANIFEST.flippyRects,
        BAKED_UI_MANIFEST.codeToFlippyFile,
      )
    }

    if (sr && ctx.itemsAtlasHandle !== undefined) {
      // D2Client.dll DC6 ground item anchor placement:
      // Each tight-cropped flippy frame carries DC6 anchor offsets (offsetX, offsetY) encoding
      // its parabolic airborne arc (e.g. flpgld_0 offsetY: -63 -> -114 -> -24 -> -3) and
      // resting ground alignment.
      const drawX = Math.round(unit.worldX + (sr.offsetX ?? -sr.w / 2))
      const drawY = Math.round(unit.worldY - sr.h + (sr.offsetY ?? 0))
      renderer.draw(
        { x: sr.x, y: sr.y, width: sr.w, height: sr.h },
        drawX,
        drawY,
        {
          atlas: ctx.itemsAtlasHandle,
          width: sr.w,
          height: sr.h,
        },
      )
      return
    }
    reportMissingArt(
      'item-flippy',
      rawCode || unit.token || String(unit.classId),
      `Missing ground item flippy sprite for code=${rawCode || unit.token} classId=${unit.classId}`,
    )
    return
  }

  if (unit.unitKind === 'warp' || unit.unitKind === 'tile') {
    return
  }

  if (unit.unitKind === 'object') {
    if (unit.classId === 59) {
      const hasPortalOverlay = Boolean(
        ctx.overlayArtMap &&
          (ctx.overlayArtMap.has('town_portal_on_tr') ||
            ctx.overlayArtMap.has('town_portal_op_tr') ||
            ctx.overlayArtMap.has('town_portal_on_hd') ||
            ctx.overlayArtMap.has('town_portal_op_hd')),
      )
      if (ctx.overlayArtMap && hasPortalOverlay) {
        const portalKey = `portal:${unit.unitId}`
        const prevPortal = oneShotStartMsByUnitKey.get(portalKey)
        const keepOpTimeline =
          unit.mode === 2 &&
          prevPortal !== undefined &&
          prevPortal.clipKey === 'portal-op' &&
          nowMs >= prevPortal.effectiveStartMs
        const portalStartMs = keepOpTimeline
          ? prevPortal.effectiveStartMs
          : resolveOneShotStartMs(
              portalKey,
              unit.mode === 2 ? 'portal-on' : 'portal-op',
              unit.animStartedAtMs,
              nowMs,
            )
        const portalElapsedMs = Math.max(0, nowMs - portalStartMs)
        drawTownPortal(
          renderer,
          unit.worldX,
          unit.worldY,
          portalElapsedMs,
          ctx.overlayArtMap,
          keepOpTimeline ? 1 : unit.mode,
        )
        return
      }
    }

    let objArt: LoadedObjectArt | undefined
    if (ctx.entityArtCache) {
      const cacheRes = ctx.entityArtCache.getObjectArt(unit.classId, actId)
      if (cacheRes === 'loading' || cacheRes === 'non-drawable') {
        return
      }
      if (cacheRes !== 'missing') {
        objArt = cacheRes
      }
    }
    if (objArt === undefined && ctx.objectArtMap) {
      const lowerToken = unit.token.trim().toLowerCase()
      objArt =
        ctx.objectArtMap.get(lowerToken) ??
        ctx.objectArtMap.get(`object-${lowerToken}`) ??
        ctx.objectArtMap.get(`classid:${unit.classId}`) ??
        ctx.objectArtMap.get(String(unit.classId))
    }

    if (objArt !== undefined) {
      const objMeta = CANONICAL_113C_OBJECTS[unit.classId]
      const isTownPortalObj = unit.classId === 59 || unit.classId === 60
      const hasLoopingOnMode =
        Boolean(objMeta?.cycleAnim?.[2]) ||
        Boolean(objArt.cycleAnim?.[2]) ||
        Boolean(objArt.clips?.on?.loop)
      const isAutoOpToOnObj =
        isTownPortalObj ||
        (!objMeta?.cycleAnim?.[1] &&
          !objArt.cycleAnim?.[1] &&
          (hasLoopingOnMode || objArt.clips?.on !== undefined))
      let modeIdx = Math.max(0, Math.min(7, unit.mode))
      let portalOpElapsedMs: number | undefined
      let portalOpenDurationMs = 0
      if (isTownPortalObj) {
        if (modeIdx === 2 || !objArt.clips.op) {
          modeIdx = 2
        } else {
          const portalStartMs = resolveOneShotStartMs(
            `portal:${unit.unitId}`,
            'portal-op',
            unit.animStartedAtMs,
            nowMs,
          )
          const opSpeed256 =
            objArt.frameDelta?.[1] || objMeta?.frameDelta?.[1] || objArt.clips.op?.speed || 200
          const opFrames = Math.max(
            1,
            objArt.frameCnt?.[1] || objMeta?.frameCnt?.[1] || objArt.clips.op?.frames || 15,
          )
          portalOpenDurationMs = (opFrames * 256 * 40) / opSpeed256
          portalOpElapsedMs = Math.max(0, nowMs - portalStartMs)
          modeIdx = portalOpElapsedMs < portalOpenDurationMs ? 1 : 2
        }
      } else if (isAutoOpToOnObj && modeIdx === 1) {
        if (!objArt.clips.op) {
          modeIdx = 2
        } else {
          const opStartMs = resolveOneShotStartMs(
            `object:${unit.unitId}`,
            'op',
            unit.animStartedAtMs,
            nowMs,
          )
          const opSpeed256 =
            objArt.frameDelta?.[1] || objMeta?.frameDelta?.[1] || objArt.clips.op?.speed || 200
          const opFrames = Math.max(
            1,
            objArt.frameCnt?.[1] || objMeta?.frameCnt?.[1] || objArt.clips.op?.frames || 15,
          )
          portalOpenDurationMs = (opFrames * 256 * 40) / opSpeed256
          portalOpElapsedMs = Math.max(0, nowMs - opStartMs)
          modeIdx = portalOpElapsedMs < portalOpenDurationMs ? 1 : 2
        }
      }
      const requestedMode = OBJECT_MODE_TO_CLIP[modeIdx] ?? 'nu'
      const clipKey = objArt.clips[requestedMode]
        ? requestedMode
        : objArt.clips.nu
          ? 'nu'
          : (Object.keys(objArt.clips)[0] ?? 'nu')
      const clip = objArt.clips[clipKey]
      const dirCount = Math.max(1, clip?.directions ?? objArt.directions)
      const direction = dir64ToClipDirection(unit.direction, dirCount)
      const groupIndex = (clip?.group ?? objArt.standOffset) + direction
      const group =
        objArt.groups[groupIndex] ?? objArt.groups[objArt.standOffset] ?? objArt.groups[0]
      const frameCount = Math.max(1, group?.length ?? 1)
      const shouldLoop = isTownPortalObj
        ? modeIdx === 2
        : modeIdx === 2 && hasLoopingOnMode
          ? true
          : (objMeta?.cycleAnim?.[modeIdx] ??
            objArt.cycleAnim?.[modeIdx] ??
            clip?.loop ??
            modeIdx !== 1)
      let frameIndex = 0
      if (frameCount > 1) {
        const startFrame = Math.min(
          frameCount - 1,
          Math.max(0, objArt.start?.[modeIdx] ?? objMeta?.start?.[modeIdx] ?? 0),
        )
        const rawModeFrames = objArt.frameCnt?.[modeIdx] ?? objMeta?.frameCnt?.[modeIdx]
        const modeFrameCount = Math.max(
          1,
          Math.min(
            frameCount - startFrame,
            rawModeFrames && rawModeFrames > 0 ? rawModeFrames : frameCount - startFrame,
          ),
        )
        const endFrame = Math.min(frameCount - 1, startFrame + modeFrameCount - 1)
        if (!shouldLoop) {
          const unitKey = isTownPortalObj ? `portal:${unit.unitId}` : `object:${unit.unitId}`
          const startedAtMs = resolveOneShotStartMs(
            unitKey,
            isTownPortalObj ? 'portal-op' : clipKey,
            unit.animStartedAtMs,
            nowMs,
          )
          const stepSpeed256 =
            objArt.frameDelta?.[modeIdx] || objMeta?.frameDelta?.[modeIdx] || clip?.speed || 256
          const elapsedTicks = Math.max(0, nowMs - startedAtMs) / 40
          const framesProgress = Math.floor((elapsedTicks * stepSpeed256) / 256)
          frameIndex =
            !isTownPortalObj && !isAutoOpToOnObj && unit.animStartedAtMs === undefined && modeIdx !== 0
              ? endFrame
              : Math.min(endFrame, startFrame + framesProgress)
        } else if ((isTownPortalObj || isAutoOpToOnObj) && portalOpElapsedMs !== undefined) {
          const onSpeed256 =
            objArt.frameDelta?.[2] || objMeta?.frameDelta?.[2] || clip?.speed || 200
          const onElapsedTicks = Math.max(0, portalOpElapsedMs - portalOpenDurationMs) / 40
          const progress = Math.floor((onElapsedTicks * onSpeed256) / 256)
          frameIndex = startFrame + (progress % modeFrameCount)
        } else {
          const rawSpeed =
            objArt.frameDelta?.[modeIdx] ||
            objMeta?.frameDelta?.[modeIdx] ||
            clip?.speed ||
            (modeIdx === 2 && hasLoopingOnMode ? 160 : 0)
          if (!(rawSpeed > 0)) {
            reportMissingArt(
              'object-clip',
              `${unit.classId}:${clipKey}`,
              `Missing frameDelta/speed for object classId=${unit.classId} mode=${modeIdx}`,
            )
            return
          }
          // Issue #607: Looping map objects evaluate Sync.
          // For Sync == 0, apply 1.13c speed jitter:
          // speed = FrameDelta - (FrameDelta >> 4) + hash(unit.id, FrameDelta >> 3)
          // so torches/flames do not animate in lockstep.
          const isSync =
            unit.sync !== undefined
              ? Boolean(unit.sync)
              : (objArt as any).sync !== undefined
                ? Boolean((objArt as any).sync)
                : false
          let speed = rawSpeed
          if (!isSync) {
            const range = Math.max(1, rawSpeed >> 3)
            const unitHash = ((Math.imul(unit.unitId, 1664525) + 1013904223) >>> 0) % range
            speed = Math.max(1, rawSpeed - (rawSpeed >> 4) + unitHash)
          }
          const progress = computeAnimDataFrameIndex(nowMs, speed, modeFrameCount, true)
          frameIndex = startFrame + (progress % modeFrameCount)
        }
      }
      const frame = group?.[frameIndex] ?? group?.[0]
      if (frame !== undefined) {
        const objMeta = CANONICAL_113C_OBJECTS[unit.classId]
        const objXOffset = objArt.xOffset ?? objMeta?.xOffset ?? 0
        const objYOffset = objArt.yOffset ?? objMeta?.yOffset ?? 0
        const drawX =
          (frame.anchorX !== undefined
            ? unit.worldX + frame.anchorX
            : unit.worldX - frame.width / 2) + objXOffset
        const drawY =
          (frame.anchorY !== undefined
            ? unit.worldY + frame.anchorY
            : unit.worldY - frame.height + FEET_HEIGHT / 2) + objYOffset
        const tint = unit.tintColor
          ? ([
              unit.tintColor[0] / 255,
              unit.tintColor[1] / 255,
              unit.tintColor[2] / 255,
              1.0,
            ] as const)
          : undefined
        renderer.draw(frame, drawX, drawY, {
          atlas: objArt.handle,
          blendMode: objArt.blendMode ?? 'normal',
          elevationY: Math.max(0, frame.height - 16),
          ...(tint ? { tint } : {}),
        })
        spriteOutlines.draw(renderer, unit.unitId, frame, objArt.handle, drawX, drawY)
        if (objArt.glowGroups !== undefined) {
          const rawGlowClip = objArt.glowClips?.[clipKey]
          const glowClip =
            rawGlowClip !== undefined && (clip === undefined || rawGlowClip.group === clip.group)
              ? rawGlowClip
              : undefined
          const glowGroupIndex = glowClip !== undefined ? glowClip.group + direction : groupIndex
          const glowGroup = objArt.glowGroups[glowGroupIndex] ?? objArt.glowGroups[groupIndex]
          const glowFrame = glowGroup?.[frameIndex] ?? glowGroup?.[0]
          if (glowFrame !== undefined && (glowFrame.width > 1 || glowFrame.height > 1)) {
            renderer.draw(glowFrame, drawX, drawY, {
              atlas: objArt.handle,
              blendMode: 'additive',
            })
          }
        }
        if (objMeta?.isShrine && modeIdx === 0) {
          const shrineTypeCode = unit.interactType ?? unit.shrineType
          const shrineOverlays = resolveShrineOverlays113c(
            unit.classId,
            shrineTypeCode,
            unit.flags,
          )
          if (shrineOverlays) {
            for (const shrineOverlayToken of [shrineOverlays.icon, shrineOverlays.shimmer]) {
              const lowerToken = shrineOverlayToken.toLowerCase()
              const celFile =
                AUTHENTIC_113C_OVERLAYS[lowerToken]?.filename ??
                CANONICAL_113C_OVERLAYS[lowerToken]?.filename
              const celKey = celFile ? celFileArtKey(celFile) : undefined
              const shrineOvArt =
                (celKey ? ctx.overlayArtMap?.get(celKey) : undefined) ??
                ctx.overlayArtMap?.get(shrineOverlayToken) ??
                ctx.overlayArtMap?.get(lowerToken)
              const shrineOvGroup = shrineOvArt?.frames[0]
              if (shrineOvArt && shrineOvGroup && shrineOvGroup.length > 0) {
                // 1.13c Overlay.txt rows 57..68 (shrine_shimmer00..shrine_experience):
                // AnimRate = 8 (stepSpeed256 = 8 * 16 = 128), Trans = 3 ('trans50'), Height4 = -60
                const ovAnimRate = 8
                const ovFrameIdx = computeAnimDataFrameIndex(
                  nowMs,
                  ovAnimRate * 16,
                  shrineOvGroup.length,
                  true,
                )
                const ovFrame = shrineOvGroup[ovFrameIdx] ?? shrineOvGroup[0]
                if (ovFrame !== undefined) {
                  const ovYOffset =
                    ('yOffset' in shrineOvArt.meta ? shrineOvArt.meta.yOffset : undefined) ?? -60
                  const ovDrawX =
                    ovFrame.anchorX !== undefined
                      ? unit.worldX + objXOffset + ovFrame.anchorX
                      : unit.worldX + objXOffset - ovFrame.width / 2
                  const ovDrawY =
                    ovFrame.anchorY !== undefined
                      ? unit.worldY + objYOffset + ovYOffset + ovFrame.anchorY
                      : drawY - ovFrame.height - 8
                  renderer.draw(ovFrame, ovDrawX, ovDrawY, {
                    atlas: shrineOvArt.handle,
                    blendMode: overlayTransToDrawBlend(shrineOvArt.meta.trans),
                  })
                }
              }
            }
          }
        }
        return
      }
    }

    reportMissingArt(
      'object',
      String(unit.classId),
      `Missing object art for classId=${unit.classId} token=${unit.token}`,
    )
  }
}

export function drawSceneMissileDrawable(
  renderer: SpriteRenderer,
  missile: SceneMissileDrawable,
  ctx: SceneSourceRenderContext,
  nowMs: number,
): void {
  if (
    !missile.celFile ||
    missile.celFile.trim() === '' ||
    missile.celFile.toLowerCase() === 'sqr' ||
    missile.celFile.toLowerCase() === 'null'
  ) {
    return
  }
  // 1.13c draws the DCC named by the row's CelFile; resolve strictly by the normalised CelFile key (Issue #1043).
  const art = resolveArtByCelFile(ctx.missileArtMap, missile.missileKey, missile.celFile)
  if (art !== undefined) {
    const animSpeed = art.meta.animSpeed
    if (!(animSpeed > 0)) {
      reportMissingArt(
        'missile-speed',
        missile.missileKey || missile.celFile || String(missile.missileClassId),
        `Missing animSpeed for missile key=${missile.missileKey}`,
      )
      return
    }
    const dirCount = Math.max(1, art.meta.directions)
    const dir = ((missile.direction % dirCount) + dirCount) % dirCount
    const group = art.frames[dir] ?? art.frames[0]
    const frameCount = Math.max(1, group?.length ?? 1)
    const discreteFrame =
      missile.missileKey === 'volcano' ? Math.round(missile.frame) : Math.floor(missile.frame)
    const frameIdx =
      missile.loopAnim === false || missile.missileKey === 'volcano'
        ? Math.min(frameCount - 1, Math.max(0, discreteFrame))
        : ((discreteFrame % frameCount) + frameCount) % frameCount
    const frame = group?.[frameIdx] ?? group?.[0]
    if (frame !== undefined) {
      const altitude = missile.altitude ?? 0
      const drawX =
        frame.anchorX !== undefined
          ? missile.worldX + frame.anchorX
          : missile.worldX - frame.width / 2
      const drawY =
        (frame.anchorY !== undefined
          ? missile.worldY + frame.anchorY
          : missile.worldY - frame.height / 2) - altitude
      const isTranslucentBlend =
        art.meta.blendMode === 'trans25' ||
        art.meta.blendMode === 'trans50' ||
        art.meta.blendMode === 'trans75'
      const resolvedBlendMode =
        missile.blendMode && missile.blendMode !== 'normal'
          ? missile.blendMode
          : isTranslucentBlend
            ? art.meta.blendMode
            : missile.trans !== undefined && missile.trans !== 0
              ? missileTransToDrawBlend(missile.trans)
              : art.meta.trans !== undefined && art.meta.trans !== 0
                ? missileTransToDrawBlend(art.meta.trans)
                : art.meta.blendMode === 'lighter' || art.meta.blendMode === 'additive'
                  ? 'additive'
                  : art.meta.blendMode === 'burn' || art.meta.blendMode === 'multiply'
                    ? 'burn'
                    : (missile.blendMode ?? 'normal')
      renderer.draw(frame, drawX, drawY, {
        atlas: art.handle,
        blendMode: resolvedBlendMode,
      })
      return
    }
  }
  reportMissingArt(
    'missile',
    missile.missileKey || missile.celFile || String(missile.missileClassId),
    `Missing missile art for key=${missile.missileKey} celFile=${missile.celFile} classId=${missile.missileClassId}`,
  )
}

export function drawSceneOverlayDrawable(
  renderer: SpriteRenderer,
  overlay: SceneOverlayDrawable,
  ctx: SceneSourceRenderContext,
  nowMs: number,
): void {
  const lowerToken = overlay.token.toLowerCase()
  if (lowerToken === 'null' || lowerToken === '') {
    return
  }
  const authEntry = AUTHENTIC_113C_OVERLAYS[lowerToken]
  const celFile = authEntry?.filename ?? CANONICAL_113C_OVERLAYS[lowerToken]?.filename
  if (celFile === '' || celFile === 'null') {
    return
  }
  const celKey = celFile ? celFileArtKey(celFile) : undefined
  const art =
    (celKey ? ctx.overlayArtMap?.get(celKey) : undefined) ??
    ctx.overlayArtMap?.get(overlay.token) ??
    ctx.overlayArtMap?.get(lowerToken)
  if (art !== undefined) {
    const animRate = authEntry?.animRate ?? art.meta.animRate
    if (!(animRate > 0)) {
      reportMissingArt(
        'overlay-speed',
        overlay.token || String(overlay.overlayId),
        `Missing animRate for overlay token=${overlay.token}`,
      )
      return
    }
    const group = art.frames[0]
    const frameCount = Math.max(1, group?.length ?? 1)
    const frameIdx =
      overlay.loop === false
        ? Math.min(frameCount - 1, Math.max(0, Math.floor(overlay.frame)))
        : ((Math.floor(overlay.frame) % frameCount) + frameCount) % frameCount
    const frame = group?.[frameIdx] ?? group?.[0]
    if (frame !== undefined) {
      const drawX =
        frame.anchorX !== undefined
          ? overlay.worldX + frame.anchorX
          : overlay.worldX - frame.width / 2
      const drawY =
        frame.anchorY !== undefined
          ? overlay.worldY + frame.anchorY
          : overlay.worldY - frame.height / 2
      renderer.draw(frame, drawX, drawY, {
        atlas: art.handle,
        blendMode: overlay.blendMode,
      })
      return
    }
  }
  reportMissingArt(
    'overlay',
    overlay.token || String(overlay.overlayId),
    `Missing overlay art for token=${overlay.token} overlayId=${overlay.overlayId}`,
  )
}

const HIRELING_CLASS_IDS: ReadonlySet<number> = new Set([271, 338, 359, 560, 561])

/**
 * Classifies a dynamic monster drawable into its 1.13c / MapHack automap marker (`AutomapEntityMarker`),
 * or `null` if it should not be drawn on the automap (Issue #881).
 */
export function classifyAutomapMonsterMarker(
  u: Pick<
    SceneUnitDrawable,
    | 'classId'
    | 'worldX'
    | 'worldY'
    | 'mode'
    | 'lifePct'
    | 'isCorpse'
    | 'isNpc'
    | 'flags'
    | 'isChampion'
    | 'isUnique'
    | 'isSuperUnique'
    | 'superUniqueId'
    | 'ownerType'
    | 'ownerId'
    | 'name'
    | 'nameZh'
  >,
  showMonsters: boolean,
  isEn: boolean,
  localPlayerId?: number,
): AutomapEntityMarker | null {
  if (u.isCorpse || u.mode === 0 || u.mode === 12 || u.lifePct <= 0) {
    return null
  }
  // Unactivated Arreat Ancients statues (hcIdx 537..539) never appear on automap
  if (u.classId >= 537 && u.classId <= 539) {
    return null
  }
  // MonStats2.txt noMap === 1 (0x6fab1510(classId, 1)) suppresses automap crosshair
  if (hasMonStats2Flag(u.classId, MONSTATS2_FLAGINDEX.NOMAP)) {
    return null
  }

  // 1. Town & Friendly NPCs (1.13c white 0x216 crosshair)
  const npcDesc = getTownNpcDescriptorByHcIdx(u.classId)
  if (npcDesc) {
    return {
      x: u.worldX,
      y: u.worldY,
      kind: 'npc',
      classId: u.classId,
      alive: true,
      name: isEn ? npcDesc.displayName : npcDisplayName(npcDesc.displayName),
    }
  }
  const mk = getMonsterKindByClassId(u.classId)
  const tblLang = isEn ? 'ENG' : 'CHI'
  const isDummyName =
    mk?.nameKey?.toLowerCase() === 'dummy' ||
    u.name === 'Dummy' ||
    u.name === 'An Evil Force' ||
    u.name === '一股邪恶力量' ||
    u.name === '一股邪惡力量' ||
    u.nameZh === '一股邪恶力量' ||
    u.nameZh === '一股邪惡力量'
  if (isDummyName) {
    return null
  }
  // 1.13c D2Client 0x6fb11582 & 0x6fb11b6c -> 0x6fab1760(classId, 9):
  // Non-TownNpc monsters only draw an automap NPC crosshair/label when MonStats.txt `interact` (bit 9) is set.
  if (u.isNpc || mk?.interact) {
    const resolvedName = mk?.nameKey ? lookupTbl(mk.nameKey, tblLang) ?? mk.nameKey : undefined
    const fallbackName = isEn ? (u.name ?? resolvedName) : (u.nameZh ?? resolvedName ?? u.name)
    if (
      fallbackName === 'Dummy' ||
      fallbackName === 'An Evil Force' ||
      fallbackName === '一股邪恶力量' ||
      fallbackName === '一股邪惡力量'
    ) {
      return null
    }
    return {
      x: u.worldX,
      y: u.worldY,
      kind: 'npc',
      classId: u.classId,
      alive: true,
      ...(fallbackName ? { name: fallbackName } : {}),
    }
  }

  // 2. Friendly Player Mercenaries & Summons/Pets (1.13c 0x214/0x215/0x216 crosshairs)
  const isHirelingClass = HIRELING_CLASS_IDS.has(u.classId)
  const isPetTypeClass = u.classId in MONSTER_CLASS_TO_PET_TYPE_IDX || u.classId === 356
  if (u.ownerType === 'player' || isHirelingClass || isPetTypeClass) {
    const isForeignPlayerPet =
      u.ownerType === 'player' &&
      localPlayerId !== undefined &&
      u.ownerId !== undefined &&
      u.ownerId !== localPlayerId
    if (isHirelingClass) {
      return {
        x: u.worldX,
        y: u.worldY,
        kind: isForeignPlayerPet ? 'partyPet' : 'mercenary',
        classId: u.classId,
        alive: true,
      }
    }
    return {
      x: u.worldX,
      y: u.worldY,
      kind: isForeignPlayerPet ? 'partyPet' : 'summon',
      classId: u.classId,
      alive: true,
    }
  }

  // 3. Hostile Monsters (only when automapShowMonsters is enabled)
  if (!showMonsters) {
    return null
  }
  if (
    (mk && mk.killable === false) ||
    !hasMonStats2Flag(u.classId, MONSTATS2_FLAGINDEX.ISATT) ||
    (u.classId >= 340 && u.classId <= 344) ||
    (u.classId >= 351 && u.classId <= 353) ||
    (u.classId >= 410 && u.classId <= 416)
  ) {
    return null
  }

  const flags = u.flags ?? 0
  let kind: AutomapEntityMarker['kind'] = 'monsterNormal'
  if (
    u.isSuperUnique === true ||
    (flags & 0x02) !== 0 ||
    u.superUniqueId !== undefined ||
    Boolean(mk?.boss && !u.isUnique && !u.isChampion && (flags & 0x0c) === 0)
  ) {
    kind = 'monsterSuperUnique'
  } else if (u.isUnique === true || (flags & 0x08) !== 0) {
    kind = 'monsterUnique'
  } else if (u.isChampion === true || (flags & 0x04) !== 0) {
    kind = 'monsterChampion'
  } else if ((flags & 0x10) !== 0) {
    kind = 'monsterMinion'
  }

  let displayName: string | undefined
  if (kind === 'monsterSuperUnique') {
    const suSpec = u.superUniqueId !== undefined ? getSuperUniqueByIndex(u.superUniqueId) : undefined
    const suName = suSpec?.nameKey ? lookupTbl(suSpec.nameKey, tblLang) ?? suSpec.nameKey : undefined
    const mkName = mk?.nameKey ? lookupTbl(mk.nameKey, tblLang) ?? mk.nameKey : undefined
    displayName = isEn ? (u.name ?? suName ?? mkName) : (u.nameZh ?? suName ?? u.name ?? mkName)
  }

  return {
    x: u.worldX,
    y: u.worldY,
    kind,
    classId: u.classId,
    alive: true,
    ...(displayName ? { name: displayName } : {}),
  }
}

/**
 * Builds a dynamic shrine radar descriptor (`AutomapShrineDescriptor`) for a shrine object
 * (`CANONICAL_113C_OBJECTS[u.classId]?.isShrine === true`), or `null` if not a shrine (Issue #881).
 */
export function buildAutomapShrineDescriptor(
  u: Pick<
    SceneUnitDrawable,
    'classId' | 'worldX' | 'worldY' | 'mode' | 'interactType' | 'shrineType' | 'flags'
  >,
  isEn: boolean,
  overlayArtMap?: ReadonlyMap<string, LoadedOverlayArt> | null,
): AutomapShrineDescriptor | null {
  const objMeta = CANONICAL_113C_OBJECTS[u.classId]
  // Issue #1371: Require selectableMask !== 0, exclude inactive desert shrine (625) and dummy evil force objects
  if (
    !objMeta?.isShrine ||
    objMeta.selectableMask === 0 ||
    u.classId === 625 ||
    (objMeta.nameEn && objMeta.nameEn.toLowerCase() === 'an evil force')
  ) {
    return null
  }
  const shrineCode =
    u.interactType !== undefined && u.interactType > 0
      ? u.interactType
      : u.shrineType !== undefined && u.shrineType > 0
        ? u.shrineType
        : u.flags !== undefined && u.flags >= 1 && u.flags <= 22
          ? u.flags
          : objMeta.parm0 === 1
            ? 2
            : objMeta.parm0 === 2
              ? 3
              : 0
  const badge = resolveAutomapShrineBadge(shrineCode)

  let overlayAtlas: AtlasHandle | undefined
  let overlayFrame: AtlasFrame | undefined
  if (badge.overlayToken && overlayArtMap) {
    const lowerToken = badge.overlayToken.toLowerCase()
    const celFile =
      AUTHENTIC_113C_OVERLAYS[lowerToken]?.filename ??
      CANONICAL_113C_OVERLAYS[lowerToken]?.filename
    const celKey = celFile ? celFileArtKey(celFile) : undefined
    const shrineOvArt =
      (celKey ? overlayArtMap.get(celKey) : undefined) ??
      overlayArtMap.get(badge.overlayToken) ??
      overlayArtMap.get(lowerToken)
    const shrineOvGroup = shrineOvArt?.frames[0]
    if (shrineOvArt && shrineOvGroup && shrineOvGroup.length > 0) {
      overlayAtlas = shrineOvArt.handle
      overlayFrame = shrineOvGroup[0]
    }
  }

  return {
    x: u.worldX,
    y: u.worldY,
    shrineCode,
    mode: u.mode,
    shortLabel: isEn ? badge.shortEn : badge.shortZh,
    labelColor: badge.labelColor,
    markerColor: badge.markerColor,
    ...(overlayAtlas && overlayFrame ? { overlayAtlas, overlayFrame } : {}),
  }
}

/**
 * Classify whether a ground item drawable qualifies for Unique (quality=7) or Set (quality=5)
 * loot beam and permanent ground label enhancements.
 *
 * Excludes gold (`gld`) and quest items (`CANONICAL_QUEST_ITEM_CODES`, which share gold text color
 * `#c4a060` in 1.13c) so only genuine Unique/Set equipment items receive beams/permanent labels.
 */
export function resolveGroundItemLootBeamQuality(
  u: SceneUnitDrawable,
  rawCode: string,
): 'unique' | 'set' | null {
  if (rawCode === 'gld' || (rawCode.length > 0 && CANONICAL_QUEST_ITEM_CODES.has(rawCode))) {
    return null
  }
  if (u.itemQuality !== undefined) {
    if (u.itemQuality === 7) return 'unique'
    if (u.itemQuality === 5) return 'set'
    return null
  }
  const resolvedQuality = resolveItemQualityString(undefined, rawCode, u)
  if (resolvedQuality === 'unique' || resolvedQuality === 'set') {
    return resolvedQuality
  }
  const normalizedColor = u.itemColor?.trim().toLowerCase()
  if (normalizedColor === '#c4a060') return 'unique'
  if (normalizedColor === '#00fc00' || normalizedColor === '#00ff00') return 'set'
  return null
}

/**
 * Render one frame driven by an engine-decoupled `SceneSource` (e.g. online `ClientWorld` + `LevelView`).
 *
 * Coordinate contract (#539): `SceneSource` already converts absolute D2GS world sub-tiles to
 * level-local sub-tiles (`world - levelView.subOrigin`) for drawables, lighting and the player;
 * this function must not re-normalise them with value-range heuristics. Until the source reports
 * `isWorldReady()` (LevelView loaded + server-assigned player position) only a cleared frame and
 * the HUD are drawn — the camera is never anchored on a guessed position.
 */
export function renderSceneSourceFrame(ctx: SceneSourceRenderContext): SceneFrameSnapshot {
  ctx.source?.beginFrame?.()
  try {
    const anyCtx = ctx as any
    const hudManager: HudManager | null = ctx.hudManager ?? anyCtx.hud ?? null
    const snapshot: SceneFrameSnapshot = ctx.source
      ? ctx.source.buildFrameSnapshot()
      : {
          tick: 0,
          worldReady: true,
          actId: 1,
          levelId: 1,
          viewportProfile: anyCtx.viewportProfile ?? { width: 800, height: 600 },
          playerWorld: { x: anyCtx.cameraX ?? 0, y: (anyCtx.cameraY ?? 0) - CAMERA_Y_OFFSET },
          playerSubTile: { x: 0, y: 0 },
          playerLocalSubTile: { x: 0, y: 0 },
          cameraTopLeft: anyCtx.cameraTopLeft ?? {
            x: (anyCtx.cameraX ?? 0) - (anyCtx.viewportProfile?.width ?? 800) / 2,
            y: (anyCtx.cameraY ?? 0) - (anyCtx.viewportProfile?.height ?? 600) / 2,
          },
          floorQuads: [],
          shadowQuads: [],
          lowerWallQuads: [],
          upperWallQuads: [],
          roofQuads: [],
          entities: {
            unitDrawables: anyCtx.unitDrawables ?? [],
            missileDrawables: anyCtx.missileDrawables ?? [],
            overlayDrawables: anyCtx.overlayDrawables ?? [],
            sortedDrawables:
              anyCtx.sortedDrawables ?? [
                ...(anyCtx.unitDrawables ?? []),
                ...(anyCtx.missileDrawables ?? []),
                ...(anyCtx.overlayDrawables ?? []),
              ],
            pointLights: anyCtx.pointLights ?? [],
            lightEmitters: [],
          },
        }
    const levelView = ctx.source ? ctx.source.getLevelView() : null
    const nowMs = ctx.nowMs ?? performance.now()
    const renderer = ctx.renderer ?? null

    if (!snapshot.worldReady) {
      if (renderer !== null) {
        renderer.begin({ x: 0, y: 0, zoom: 1 }, [0, 0, 0])
        renderer.setLighting(null)
        renderer.flush()
        if (typeof (renderer as { end?: () => void }).end === 'function') {
          renderer.end()
        }
      }
      if (hudManager) {
        hudManager.groundItemLabelBoxes = []
        hudManager.groundItemBeams = []
        hudManager.hoveredNpcLabel = null
        hudManager.render(nowMs)
      }
      ctx.onFrameSnapshot?.(snapshot)
      return snapshot
    }

    const panelShiftX = snapshot.panelShiftX ?? 0
    const effectivePlayerWorld =
      snapshot.playerWorld.x === 0 &&
      snapshot.playerWorld.y === 0 &&
      (snapshot.playerLocalSubTile.x !== 0 || snapshot.playerLocalSubTile.y !== 0)
        ? subTileToWorldOrtho(snapshot.playerLocalSubTile.x, snapshot.playerLocalSubTile.y)
        : snapshot.playerWorld
    const rawCamX = effectivePlayerWorld.x + panelShiftX
    const rawCamY = effectivePlayerWorld.y + CAMERA_Y_OFFSET
    const pixelScale = renderer?.pixelScale ?? 1
    const snapToPixel = (v: number) => Math.round(v * pixelScale) / pixelScale
    const renderCamX = snapToPixel(
      ctx.source && snapshot.cameraTopLeft !== undefined
        ? snapshot.cameraTopLeft.x + snapshot.viewportProfile.width / 2
        : rawCamX + (snapshot.shakeOffsetX ?? 0),
    )
    const renderCamY = snapToPixel(
      ctx.source && snapshot.cameraTopLeft !== undefined
        ? snapshot.cameraTopLeft.y + snapshot.viewportProfile.height / 2
        : rawCamY + (snapshot.shakeOffsetY ?? 0),
    )
    const camX = renderCamX - (snapshot.shakeOffsetX ?? 0)
    const camY = renderCamY - (snapshot.shakeOffsetY ?? 0)

    if (renderer !== null) {
      ctx.tileGpuCache?.ensureActPalette(snapshot.actId)
      renderer.begin({ x: renderCamX, y: renderCamY, zoom: 1 }, [0.02, 0.02, 0.03])

      // The 1.13c light grid of this frame, when the scene is lit (unit sprites take one flat grid light).
      let litGrid: LightGrid | null = null
      if (ctx.lightingTargets && ctx.source) {
        if (applyLightingInputs(ctx.source.buildLightingInputs(ctx.lightingPreset), ctx.lightingTargets)) {
          litGrid = ctx.lightingTargets.lightGrid
        }
      }

      // 1.13c render callback: LoadWeather (when an act load is pending), update, floor pass.
      ctx.weather?.beginFrame({
        levelId: snapshot.levelId,
        tick: snapshot.tick,
        camX: renderCamX,
        camY: renderCamY,
        width: snapshot.viewportProfile.width,
        height: snapshot.viewportProfile.height,
        floorTiles: snapshot.floorQuads,
      })

      const drawTileQuad = (
        q: SceneTileQuad,
        options?: {
          readonly tint?: readonly [number, number, number, number]
          readonly elevationY?: number
          readonly roofHeight?: number
          readonly columnTints?: readonly (readonly [number, number, number])[]
        },
      ): void => {
        const animStep =
          ctx.nowMs !== undefined
            ? Math.floor((ctx.nowMs * 80) / (40 * 200))
            : Math.floor(snapshot.tick / 2.5)
        const p =
          q.animatedPlacements && q.animatedPlacements.length > 1
            ? (q.animatedPlacements[Math.abs(animStep) % q.animatedPlacements.length] ?? q.placement)
            : q.placement
        if (!p || !ctx.tileGpuCache) return
        const pageHandle = ctx.tileGpuCache.getPageHandle(q.act || snapshot.actId, p.page)
        if (pageHandle === undefined) return
        renderer.draw(
          { x: p.x, y: p.y, width: p.width, height: p.height },
          q.worldX,
          q.worldY,
          {
            atlas: pageHandle,
            ...(options?.tint ? { tint: options.tint } : {}),
            ...(options?.elevationY !== undefined ? { elevationY: options.elevationY } : {}),
            ...(options?.roofHeight !== undefined ? { roofHeight: options.roofHeight } : {}),
            ...(options?.columnTints !== undefined ? { columnTints: options.columnTints } : {}),
          },
        )
      }

      const drawWallTileQuad = (w: SceneTileQuad, fade?: { readonly alpha: number; readonly faded: boolean }): void => {
        if (!w.placement && w.blockCount !== 0) {
          reportMissingArt(
            'tile',
            `wall:${w.cellX},${w.cellY}`,
            `Missing wall tile placement at cell (${w.cellX}, ${w.cellY})`,
          )
        }
        // 0x6fb4f07c: the wall is drawn with its fade alpha `[tile+0x28]`.
        const tint: readonly [number, number, number, number] | undefined =
          fade !== undefined && fade.alpha !== 0xff ? [1, 1, 1, fade.alpha / 255] : undefined
        const faded = fade !== undefined ? fade.faded : Boolean(w.faded)
        if (litGrid !== null && (w.type ?? 1) !== 15 && w.lightDirection !== 5) {
          const columnTints = wallColumnTintsInto113c(
            litGrid,
            w.cellX,
            w.cellY,
            w.type ?? 1,
            faded,
            w.lightDirection,
            scratchWallColumnTints,
          )
          drawTileQuad(w, {
            ...(columnTints ? { columnTints } : {}),
            ...(tint !== undefined ? { tint } : {}),
          })
        } else {
          drawTileQuad(w, tint !== undefined ? { tint } : undefined)
        }
      }

      // 1.13c wall occlusion fade (0x6fb29f20 / 0x6fb2a340 / 0x6fb4ee90) and preset POPS
      // (D2Common.#10562 -> DRLGPRESET_UpdatePops 0x6fd5a6a0 / DRLGPRESET_TogglePopsVisibility 0x6fd5a180).
      const fadeOwner: object = ctx.source ?? ctx
      let fadeSlot = wallFadeTrackers.get(fadeOwner)
      if (fadeSlot === undefined || fadeSlot.levelId !== snapshot.levelId) {
        fadeSlot = { levelId: snapshot.levelId, tracker: new WallFadeTracker113c() }
        wallFadeTrackers.set(fadeOwner, fadeSlot)
      }
      const wallFade = fadeSlot.tracker
      const activePops = snapshot.pops ?? levelView?.pops
      wallFade.updatePops(
        activePops,
        Math.floor(snapshot.playerLocalSubTile.x + 0.5),
        Math.floor(snapshot.playerLocalSubTile.y + 0.5),
        nowMs,
      )
      const fadePlayer = snapshot.wallFadePlayer
      const upperWallFade = (w: SceneTileQuad): { readonly alpha: number; readonly faded: boolean } => {
        const key = wallFadeKey(w)
        // 0x6fb2a3a7: walls flagged MAPTILE_TREES skip the test; their state is left untouched.
        if (fadePlayer !== undefined && w.noFade !== true) {
          wallFade.update(key, wallOccludesPlayer113c(w.fadeBox, fadePlayer), nowMs)
        }
        return wallFade.sample(key, nowMs)
      }

      // 0. Lower ("down") walls, nTileType 16..19 — painted before the floor pass (0x6fb3b21f -> 0x6fb4ec10),
      // so the floor covers them and they only show through chasms / void.
      const sortedLowerWalls = snapshot.lowerWallQuads
      for (const w of sortedLowerWalls) {
        const popSample = wallFade.samplePopTile(w, activePops, nowMs)
        if (popSample !== null) {
          if (!popSample.visible) continue
          drawWallTileQuad(w, { alpha: popSample.alpha, faded: false })
        } else {
          drawWallTileQuad(w)
        }
      }

      // 1. Floors (0x6fac4050)
      for (const q of snapshot.floorQuads) {
        drawTileQuad(q)
      }

      // 1.5. Weather splashes and bubbles (DrawCels 0x6fb2fc70, right after the floor pass)
      ctx.weather?.drawGround(renderer)

      // 2. Shadows
      for (const q of snapshot.shadowQuads) {
        drawTileQuad(q, { tint: [1, 1, 1, 0.5] })
      }

      // 3. Depth-interleaved upper walls and entities (units, missiles, overlays; 0x6fb4ee90).
      // 1.13c DrawGrid_DrawAllCells (`0x6fb2a5d0` / `0x6fb4ee90`) interleaves upper walls and units
      // by DrawGrid cell row (`cellX + cellY` vs `floor(subX / 5) + floor(subY / 5)`), breaking ties
      // within the same cell row by intra-cell isometric depth (`w.sortY <= entity.sortY`, #1330).
      const sortedWalls = snapshot.upperWallQuads
      const sortedEntities = snapshot.entities.sortedDrawables
      let wallIdx = 0
      const drawWallsBeforeEntity = (maxCellDepth: number, maxSortY: number): void => {
        while (wallIdx < sortedWalls.length) {
          const w = sortedWalls[wallIdx]!
          const wCellDepth = w.cellX + w.cellY
          if (wCellDepth > maxCellDepth || (wCellDepth === maxCellDepth && w.sortY > maxSortY)) {
            break
          }
          wallIdx += 1
          const popSample = wallFade.samplePopTile(w, activePops, nowMs)
          if (popSample !== null) {
            if (!popSample.visible) continue
            drawWallTileQuad(w, { alpha: popSample.alpha, faded: false })
          } else {
            drawWallTileQuad(w, upperWallFade(w))
          }
        }
      }

      const drawEntity = (entity: SceneEntityDrawable): void => {
        if (entity.drawableKind === 'unit') {
          if (litGrid !== null) {
            const dynamic = entity.unitKind === 'player' || entity.unitKind === 'monster'
            renderer.setUnitLight(unitFlatLightInto(litGrid, entity.lightSubX ?? entity.subX, entity.lightSubY ?? entity.subY, dynamic, scratchUnitLight))
          }
          drawSceneUnitDrawable(renderer, entity, ctx, nowMs, snapshot.actId)
          if (litGrid !== null) renderer.setUnitLight(null)
        } else if (entity.drawableKind === 'missile') {
          if (litGrid !== null) {
            renderer.setUnitLight(unitFlatLightInto(litGrid, entity.lightSubX ?? entity.subX, entity.lightSubY ?? entity.subY, true, scratchUnitLight))
          }
          drawSceneMissileDrawable(renderer, entity, ctx, nowMs)
          if (litGrid !== null) renderer.setUnitLight(null)
        } else if (entity.drawableKind === 'overlay') {
          drawSceneOverlayDrawable(renderer, entity, ctx, nowMs)
        }
      }

      const vpW = snapshot.viewportProfile.width
      const vpH = snapshot.viewportProfile.height
      const minEntityX = camX - vpW / 2 - 320
      const maxEntityX = camX + vpW / 2 + 320
      const minEntityY = camY - vpH / 2 - 360
      const maxEntityY = camY + vpH / 2 + 360

      for (const entity of sortedEntities) {
        const isLocalPlayerUnit = entity.drawableKind === 'unit' && entity.isLocalPlayer === true
        const screenEntityY =
          entity.drawableKind === 'missile' || entity.drawableKind === 'unit'
            ? entity.worldY - (entity.altitude ?? 0)
            : entity.worldY
        if (
          !isLocalPlayerUnit &&
          (entity.worldX < minEntityX ||
            entity.worldX > maxEntityX ||
            (entity.worldY < minEntityY && screenEntityY < minEntityY) ||
            (entity.worldY > maxEntityY && screenEntityY > maxEntityY))
        ) {
          continue
        }
        const entityCellDepth = sceneEntityCellDepth(entity)
        drawWallsBeforeEntity(entityCellDepth, entity.sortY - (levelView?.isoOriginY ?? 0))
        drawEntity(entity)
      }
      drawWallsBeforeEntity(Infinity, Infinity)

      // 4. Roofs (0x6fac3a00 -> D2gfx.#10023: shifted up by wRoofHeight, lit by ground-cell 6x6 grid).
      // 1.13c advances `[tile+0x28]` when `unk0x24 & 2` is set by `DRLGPRESET_TogglePopsVisibility` (`0x6fd5a180`),
      // sets `dwFlags |= 0x400` when `alpha == 0` (`0x6fac3b1e`), and skips drawing when `dwFlags & 0x408` (`0x6fac3b2f`).
      for (const q of snapshot.roofQuads) {
        const popSample = wallFade.samplePopTile(q, activePops, nowMs)
        if (popSample !== null && !popSample.visible) continue
        const roofHeight = q.roofHeight !== undefined && q.roofHeight > 0 ? q.roofHeight : undefined
        const tint: readonly [number, number, number, number] | undefined =
          popSample !== null && popSample.alpha !== 0xff ? [1, 1, 1, popSample.alpha / 255] : undefined
        drawTileQuad(
          q,
          roofHeight !== undefined || tint !== undefined
            ? {
                ...(roofHeight !== undefined ? { roofHeight } : {}),
                ...(tint !== undefined ? { tint } : {}),
              }
            : undefined,
        )
      }

      // Disable world lighting before automap/UI sprites
      renderer.setLighting(null)

      // 4.5. Weather rain / snow lines (DrawParticles 0x6fb2fe80: after the roofs, raw palette
      // indices, so unlit)
      ctx.weather?.drawLines(renderer)

      // 5. Automap / Minimap via WebGL2 SpriteRenderer
      if (ctx.minimap && ctx.automapView) {
        const mode = ctx.automapView.getMode()
        const minimapWithLastMode = ctx.minimap as Minimap & {
          __lastAutomapRevealMode?: string
        }
        const automapWithToggle = ctx.automapView as AutomapView & {
          consumeVisibilityToggleRequest?: () => boolean
        }
        if (typeof automapWithToggle.consumeVisibilityToggleRequest === 'function') {
          if (automapWithToggle.consumeVisibilityToggleRequest()) {
            ctx.minimap.cycleDisplayMode()
          }
        }
        const prevRevealMode = minimapWithLastMode.__lastAutomapRevealMode
        if (prevRevealMode !== mode) {
          minimapWithLastMode.__lastAutomapRevealMode = mode
          if ((mode === 'level' || mode === 'act') && prevRevealMode !== undefined) {
            ctx.minimap.visible = true
          }
        }

        if (ctx.minimap.visible) {
          if (levelView && levelView.areaId > 0) {
            ctx.automapView.syncActiveLevel(levelView.areaId, levelView)
          } else if (snapshot.levelId > 0 && ctx.automapView.getCurrentAreaId() !== snapshot.levelId) {
            ctx.automapView.syncActiveLevel(snapshot.levelId)
          }
          const baseMinimapLevel = ctx.automapView.buildMinimapLevel(
            undefined,
            levelView?.areaId ?? snapshot.levelId,
          )
          const effectiveOriginX = levelView?.isoOriginX ?? baseMinimapLevel.originX ?? 0
          const effectiveOriginY = levelView?.isoOriginY ?? baseMinimapLevel.originY ?? 0
          const effectivePreRevealTown =
            Boolean(baseMinimapLevel.preRevealTown) ||
            isTownLevel(snapshot.levelId) ||
            mode === 'level' ||
            mode === 'act'
          let effectiveAutomap = baseMinimapLevel.automap
          for (const u of snapshot.entities.unitDrawables) {
            if (u.unitKind === 'object' && u.classId === 366 && u.mode === 2) {
              const xClient = u.worldX - effectiveOriginX
              const yClient = u.worldY - effectiveOriginY
              const xPixel = Math.trunc(xClient / 10) + 1
              const yPixel = Math.trunc(yClient / 10) - 3
              const alreadyPresent = effectiveAutomap.objects.some(
                (c) => c.cellNo === 223 && c.xPixel === xPixel && c.yPixel === yPixel,
              )
              if (!alreadyPresent) {
                effectiveAutomap = {
                  ...effectiveAutomap,
                  objects: [
                    ...effectiveAutomap.objects,
                    { cellNo: 223, cellX: u.worldX, cellY: u.worldY, xPixel, yPixel },
                  ],
                }
              }
            }
          }
          const effectiveMinimapLevel: MinimapLevel =
            (baseMinimapLevel.originX ?? 0) === effectiveOriginX &&
            (baseMinimapLevel.originY ?? 0) === effectiveOriginY &&
            Boolean(baseMinimapLevel.preRevealTown) === effectivePreRevealTown &&
            effectiveAutomap === baseMinimapLevel.automap
              ? baseMinimapLevel
              : {
                  ...baseMinimapLevel,
                  originX: effectiveOriginX,
                  originY: effectiveOriginY,
                  preRevealTown: effectivePreRevealTown,
                  automap: effectiveAutomap,
                }
          const localSub = snapshot.playerLocalSubTile
          const playerCellX = Math.floor(localSub.x / 5)
          const playerCellY = Math.floor(localSub.y / 5)
          ctx.minimap.reveal(
            effectiveMinimapLevel,
            playerCellX,
            playerCellY,
            effectivePlayerWorld.x,
            effectivePlayerWorld.y,
            false,
          )

          const isEn = getTblLang() === 'ENG'
          const radar =
            typeof ctx.automapView.getRadarConfig === 'function'
              ? ctx.automapView.getRadarConfig()
              : { automapShowMonsters: false, automapShowShrines: false }
          const highlightWaypoints =
            typeof ctx.automapView.getShowWaypoints === 'function'
              ? ctx.automapView.getShowWaypoints()
              : Boolean(radar.automapShowWaypoints)
          let localPlayerId: number | undefined
          for (const u of snapshot.entities.unitDrawables) {
            if (u.unitKind === 'player' && u.isLocalPlayer) {
              localPlayerId = u.unitId
              break
            }
          }
          const automapEntities: AutomapEntityMarker[] = []
          const automapShrines: AutomapShrineDescriptor[] = []
          const automapPortals: {
            readonly x: number
            readonly y: number
            readonly active: boolean
            readonly kind: 'blue' | 'red'
            readonly label?: string
          }[] = []
          for (const u of snapshot.entities.unitDrawables) {
            if (u.unitKind === 'monster') {
              const marker = classifyAutomapMonsterMarker(
                u,
                radar.automapShowMonsters,
                isEn,
                localPlayerId,
              )
              if (marker) {
                automapEntities.push(marker)
              }
            } else if (u.unitKind === 'object') {
              if (u.classId === 59 || u.classId === 60) {
                automapPortals.push({
                  x: u.worldX,
                  y: u.worldY,
                  active: true,
                  kind: u.classId === 60 ? 'red' : 'blue',
                  ...(u.name !== undefined ? { label: u.name } : {}),
                })
              } else if (radar.automapShowShrines) {
                const shrineDesc = buildAutomapShrineDescriptor(u, isEn, ctx.overlayArtMap)
                if (shrineDesc) {
                  automapShrines.push(shrineDesc)
                }
              }
            } else if (u.unitKind === 'player' && u.isPartyMember) {
              automapEntities.push({
                x: u.worldX,
                y: u.worldY,
                kind: 'party',
                ...(u.name !== undefined ? { name: u.name } : {}),
              })
            }
          }
          ctx.minimap.draw(
            renderer,
            effectiveMinimapLevel,
            playerCellX,
            playerCellY,
            { x: camX, y: camY, zoom: 1 },
            {
              width: snapshot.viewportProfile.width,
              height: snapshot.viewportProfile.height,
            },
            {
              playerWorldX: snapshot.playerWorld.x,
              playerWorldY: snapshot.playerWorld.y,
              leftPanelOpen: Boolean(hudManager && hudManager.leftPanel !== 'none'),
              rightPanelOpen: Boolean(hudManager && hudManager.rightPanel !== 'none'),
              entities: automapEntities,
              portals: automapPortals,
              ...(automapShrines.length > 0 ? { shrines: automapShrines } : {}),
              ...(highlightWaypoints ? { highlightWaypoints: true } : {}),
              levelId: snapshot.levelId,
            },
          )
        } else {
          if (ctx.minimap.lastRenderStats.warpLabels.length > 0) {
            ctx.minimap.lastRenderStats.warpLabels = []
          }
          if (ctx.minimap.lastRenderStats.entityLabels.length > 0) {
            ctx.minimap.lastRenderStats.entityLabels = []
          }
          ctx.minimap.lastRenderStats.hudText = null
        }
      }

      renderer.flush()
      if (typeof (renderer as { end?: () => void }).end === 'function') {
        renderer.end()
      }
    } else if (ctx.lightingTargets && ctx.source) {
      applyLightingInputs(ctx.source.buildLightingInputs(ctx.lightingPreset), ctx.lightingTargets)
    }

    if (hudManager) {
      const vpW = snapshot.viewportProfile.width
      const vpH = snapshot.viewportProfile.height
      const showAll = hudManager.showGroundLabels
      const groundEnhancements =
        typeof hudManager.getGroundItemEnhancements === 'function'
          ? hudManager.getGroundItemEnhancements()
          : { showUniqueSetBeams: false, alwaysShowUniqueSetLabels: false }
      const showBeams = groundEnhancements.showUniqueSetBeams
      const alwaysShowUniqueSetLabels = groundEnhancements.alwaysShowUniqueSetLabels
      const isEn = getTblLang() === 'ENG'
      const labelInputs: GroundItemLabelInput[] = []
      const groundItemBeams: GroundItemBeamDescriptor[] = []
      const overheadBubbles: Array<{
        readonly unitType: string
        readonly unitId: number
        readonly text: string
        readonly color: number
        readonly screenX: number
        readonly screenY: number
      }> = []
      let hoveredNpcLabel: { readonly text: string; readonly screenX: number; readonly screenY: number } | null = null
      const externalHoveredId = anyCtx.hoveredUnit?.id

      for (const u of snapshot.entities.unitDrawables) {
        if (u.overheadText && !u.isCorpse) {
          const resolvedOverhead = resolveOverheadBubbleText113c(
            u.overheadText,
            u.unitKind,
            isEn ? 'ENG' : 'CHI',
          )
          if (resolvedOverhead) {
            const screenX = Math.round(u.worldX - camX + vpW / 2)
            const screenY = Math.round(u.worldY - camY + vpH / 2)
            overheadBubbles.push({
              unitType: u.unitKind,
              unitId: u.unitId,
              text: resolvedOverhead,
              color: u.overheadColor ?? 0,
              screenX,
              screenY,
            })
          }
        }
        const isUnitHovered =
          u.isHovered || (externalHoveredId !== undefined && u.unitId === externalHoveredId)
        if (isUnitHovered) {
          const mk = u.unitKind === 'monster' ? getMonsterKindByClassId(u.classId) : undefined
          const isDummyMonster =
            u.unitKind === 'monster' &&
            !isTownNpcHcIdx(u.classId) &&
            (mk?.nameKey?.toLowerCase() === 'dummy' ||
              u.name === 'Dummy' ||
              u.name === 'An Evil Force' ||
              u.name === '一股邪恶力量' ||
              u.name === '一股邪惡力量' ||
              u.nameZh === '一股邪恶力量' ||
              u.nameZh === '一股邪惡力量')
          if (
            u.unitKind === 'monster' &&
            !u.isCorpse &&
            !isDummyMonster &&
            (u.isNpc || isTownNpcHcIdx(u.classId) || mk?.interact)
          ) {
            const tblLang = isEn ? 'ENG' : 'CHI'
            const resolvedMkName = mk?.nameKey ? lookupTbl(mk.nameKey, tblLang) : undefined
            const npcText =
              getNpcDisplayNameByHcIdx(u.classId, tblLang) ??
              (isEn
                ? (u.name || resolvedMkName || u.nameZh)
                : (u.nameZh || resolvedMkName || u.name)) ??
              ''
            if (
              npcText &&
              npcText !== 'Dummy' &&
              npcText !== 'An Evil Force' &&
              npcText !== '一股邪恶力量' &&
              npcText !== '一股邪惡力量'
            ) {
              const screenX = Math.round(u.worldX - camX + vpW / 2)
              const screenY = Math.round(u.worldY - 72 - camY + vpH / 2)
              hoveredNpcLabel = { text: npcText, screenX, screenY }
            }
          } else if (
            u.unitKind === 'object' &&
            u.isSel !== false &&
            u.noSel !== true &&
            isObjectSelectableInMode(u.classId, u.mode)
          ) {
            const fallbackObjNames =
              (!isEn && !u.nameZh) || (isEn && !u.name)
                ? resolveObjectDisplayName(u.classId, u.mode, undefined, undefined, snapshot.levelId)
                : undefined
            const objText =
              (isEn
                ? (u.name || fallbackObjNames?.name || u.nameZh || fallbackObjNames?.nameZh)
                : (u.nameZh || fallbackObjNames?.nameZh || u.name || fallbackObjNames?.name)) ?? ''
            if (objText) {
              const screenX = Math.round(u.worldX - camX + vpW / 2)
              const screenY = Math.round(u.worldY - 56 - camY + vpH / 2)
              hoveredNpcLabel = { text: objText, screenX, screenY }
            }
          } else if (u.unitKind === 'warp' || u.unitKind === 'tile') {
            const warpText = (isEn ? (u.name || u.nameZh) : (u.nameZh || u.name)) ?? ''
            if (warpText) {
              const offsetX = u.hitBox ? Math.round(u.hitBox.left + u.hitBox.width / 2) : 0
              const topY = u.hitBox ? Math.min(u.hitBox.top - 8, -24) : -40
              const screenX = Math.round(u.worldX + offsetX - camX + vpW / 2)
              const screenY = Math.round(u.worldY + topY - camY + vpH / 2)
              hoveredNpcLabel = { text: warpText, screenX, screenY }
            }
          }
        }
        if (u.unitKind !== 'item') continue
        // D2Client.dll 0x6fb328a5 / 0x6fb327c0: airborne items (ITEMMODE_DROPPING === 5)
        // suppress hover and Alt ground labels until they land in mode 3 (ITEMMODE_ON_GROUND).
        if (u.mode === 5) continue
        const rawCode =
          u.code?.trim().toLowerCase() ||
          u.itemCode?.trim().toLowerCase() ||
          (u.token && !u.token.startsWith('ITM_') ? u.token.trim().toLowerCase() : '') ||
          BAKED_UI_MANIFEST.itemClassIdToCode[u.classId] ||
          ''
        const lootBeamQuality =
          showBeams || alwaysShowUniqueSetLabels
            ? resolveGroundItemLootBeamQuality(u, rawCode)
            : null
        const itemScreenX = Math.round(u.worldX - camX + vpW / 2)
        const itemScreenY = Math.round(u.worldY - camY + vpH / 2)
        if (
          showBeams &&
          lootBeamQuality !== null &&
          itemScreenX >= -60 &&
          itemScreenX <= vpW + 60 &&
          itemScreenY >= -20 &&
          itemScreenY <= vpH + 160
        ) {
          groundItemBeams.push({
            id: u.unitId,
            quality: lootBeamQuality,
            screenX: itemScreenX,
            screenY: itemScreenY,
            isHovered: isUnitHovered,
          })
        }
        const forceUniqueSetLabel = alwaysShowUniqueSetLabels && lootBeamQuality !== null
        if (!isUnitHovered && ((!showAll && !forceUniqueSetLabel) || hudManager.hidesGroundItem(u.unitId))) continue
        const screenX = itemScreenX
        const screenY = Math.round(u.worldY - 14 - camY + vpH / 2)
        if (screenX < -60 || screenX > vpW + 60 || screenY < -10 || screenY > vpH + 20) {
          continue
        }
        const meta =
          !u.itemColor || (!u.name && !u.nameZh)
            ? resolveGroundItemMetadata(
                {
                  code: rawCode,
                  ...(u.itemQuality !== undefined ? { quality: u.itemQuality } : {}),
                  ...(u.goldAmount !== undefined ? { goldAmount: u.goldAmount } : {}),
                  ...(u.name !== undefined ? { name: u.name } : {}),
                },
                u.goldAmount,
              )
            : undefined
        const labelText = isEn
          ? (u.name || meta?.labelEn || rawCode || `Item #${u.unitId}`)
          : (u.nameZh || meta?.labelZh || u.name || meta?.labelEn || rawCode || `Item #${u.unitId}`)
        const color =
          u.itemColor ||
          meta?.color ||
          (lootBeamQuality === 'unique'
            ? '#c4a060'
            : lootBeamQuality === 'set'
              ? '#00fc00'
              : '#ffffff')
        const measuredW = Math.max(40, hudManager.font.measureText(labelText, 'font16') + 14) + hudManager.groundLabelBadgesWidth(u.unitId)
        labelInputs.push({
          id: u.unitId,
          text: labelText,
          label: labelText,
          color,
          screenX,
          screenY,
          width: measuredW,
          height: 18,
          isHovered: isUnitHovered,
        })
      }
      hudManager.overheadSpeechBubbles = overheadBubbles
      hudManager.hoveredNpcLabel = hoveredNpcLabel
      hudManager.groundItemBeams = groundItemBeams
      hudManager.groundItemLabelBoxes =
        labelInputs.length > 0 ? layoutGroundItemLabels(labelInputs, vpW, vpH) : []
      hudManager.render(nowMs)
    }
    ctx.onFrameSnapshot?.(snapshot)
    return snapshot
  } finally {
    ctx.source?.endFrame?.()
  }
}


