/**
 * Runtime Character Skin Service, IndexedDB Custom Archive Store, & WebGL2 RGBA Atlas Cache
 * (`src/client/render/character-skin-cache.ts`).
 *
 * - Zero network requests and zero GPU allocations while disabled (`enabled: false`).
 * - Hot-deployable `/skins/index.json` catalog discovery (`INTENTIONALLY_UNCACHED_PUBLIC_DIRS`).
 * - Zero-dependency `.d2skin.zip` extraction and browser IndexedDB persistence.
 * - Multi-page 32-bit RGBA `AtlasHandle` + optional additive `glow` `AtlasHandle` management.
 */

import { extractZipArchive } from '../../common/formats/zip-reader.ts'
import { PLAYER_CLASS_TOKENS, type PlayerClassToken } from '../../common/units/char-appearance.ts'
import {
  DEFAULT_CHARACTER_SKIN_CONFIG,
  isValidSkinRelativeFile,
  resolveSkinClipKey,
  validateCharacterSkinIndex,
  validateCharacterSkinManifest,
  type CharacterSkinCatalogEntry,
  type CharacterSkinFrameTuple,
  type CharacterSkinManifest,
  type CharacterSkinMeshClip,
  type CharacterSkinMeshSpec,
  type CharacterSkinMinionSpec,
  type CharacterSkinMorphPolicy,
  type CharacterSkinRuntimeConfig,
  type CharacterSkinScope,
} from '../../common/units/character-skin.ts'
import { parseMeshSkinModel, type MeshSkinClip, type MeshSkinModel } from '../../common/units/mesh-skin-model.ts'
import type { AnimClipMeta } from '../../common/units/unit-types.ts'
import { getGameLang, type GameLang } from '../i18n/lang.ts'
import { closeModalDomOverlay, openModalDomOverlay } from '../ui/dom-overlay.ts'
import type { AtlasFrame } from './atlas.ts'
import { MeshSkinAnimator } from './mesh-skin-animator.ts'
import { MeshSkinRenderer, type MeshSkinGpuModel, type MeshSkinTextureSource } from './mesh-skin-renderer.ts'
import type { AtlasHandle, PagedAtlasFrame, SpriteRenderer } from './renderer.ts'

export type MinionPortraitDrawable = CanvasImageSource & {
  readonly width: number
  readonly height: number
}

export interface DecodedSkinImage {
  readonly source: ImageBitmap | { readonly pixels: Uint8Array; readonly width: number; readonly height: number }
  readonly width: number
  readonly height: number
  close?(): void
}

export interface LoadedCharacterSkinArt {
  readonly id: string
  readonly manifest: CharacterSkinManifest
  readonly handle: AtlasHandle
  readonly pageHandles: readonly AtlasHandle[]
  readonly glowPageHandles?: readonly AtlasHandle[] | undefined
  readonly groups: readonly (readonly PagedAtlasFrame[])[]
  readonly glowGroups?: readonly (readonly PagedAtlasFrame[])[] | undefined
  readonly clips: Readonly<Record<string, AnimClipMeta>>
  readonly glowClips?: Readonly<Record<string, AnimClipMeta>> | undefined
  readonly renderScale: number
  readonly shadowOffsetY: number
  readonly shadowScale: number
}

export interface LoadedMinionSkinArt {
  readonly skinId: string
  readonly minionKey: string
  readonly spec: CharacterSkinMinionSpec
  readonly handle: AtlasHandle
  readonly pageHandles: readonly AtlasHandle[]
  readonly glowPageHandles?: readonly AtlasHandle[] | undefined
  readonly groups: readonly (readonly PagedAtlasFrame[])[]
  readonly glowGroups?: readonly (readonly PagedAtlasFrame[])[] | undefined
  readonly clips: Readonly<Record<string, AnimClipMeta>>
  readonly glowClips?: Readonly<Record<string, AnimClipMeta>> | undefined
  readonly renderScale: number
  readonly shadowOffsetY: number
  readonly shadowScale: number
}

/** One Diablo II mode token resolved to a playable animation of a loaded mesh skin model. */
export interface LoadedMeshSkinClip {
  readonly meta: CharacterSkinMeshClip
  readonly clip: MeshSkinClip
}

/** A mesh skin unit (hero or one summon) whose model and textures are uploaded to one renderer. */
export interface LoadedMeshSkinUnit {
  readonly skinId: string
  /** `'hero'` or the minion key. */
  readonly unitKey: string
  readonly spec: CharacterSkinMeshSpec
  readonly model: MeshSkinModel
  readonly gpu: MeshSkinGpuModel
  readonly clips: Readonly<Record<string, LoadedMeshSkinClip>>
  readonly floating: boolean
  readonly shadowOffsetY: number
  readonly shadowScale: number
}

/** One weapon model of a shared weapon pack, uploaded to one renderer. */
export interface LoadedMeshSkinWeapon {
  readonly gpu: MeshSkinGpuModel
  /** The hand that holds it as the main weapon (bows sit in the left hand). */
  readonly hand: 'right' | 'left'
}

/** `weapons.json` of a weapon pack: `UniqueItems.txt` row id -> model file and main hand. */
type WeaponPackIndex = ReadonlyMap<number, { readonly file: string; readonly hand: 'right' | 'left' }>

const WEAPON_PACK_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/

function parseWeaponPackIndex(raw: unknown): WeaponPackIndex {
  const weapons = (raw as { weapons?: unknown } | null)?.weapons
  if (typeof weapons !== 'object' || weapons === null || Array.isArray(weapons)) {
    throw new Error('weapons.json has no "weapons" object')
  }
  const out = new Map<number, { file: string; hand: 'right' | 'left' }>()
  for (const [key, value] of Object.entries(weapons as Record<string, unknown>)) {
    const entry = value as { file?: unknown; hand?: unknown } | null
    const file = entry?.file
    const hand = entry?.hand
    if (!/^\d{1,4}$/.test(key) || typeof file !== 'string' || !isValidSkinRelativeFile(file) || (hand !== 'right' && hand !== 'left')) {
      throw new Error(`weapons.json entry "${key}" is invalid`)
    }
    out.set(Number(key), { file, hand })
  }
  return out
}

/** Mesh skin runtime owned by one sprite renderer. */
export interface MeshSkinRuntime {
  readonly meshRenderer: MeshSkinRenderer
  readonly animator: MeshSkinAnimator
}

export const MESH_SKIN_HERO_UNIT_KEY = 'hero'
/** Unit key prefix of a skin's shape-shift models (`morph:40`, `morph:tg`, ...). */
export const MESH_SKIN_MORPH_UNIT_PREFIX = 'morph:'

export interface SkinAvatarCompositeFrame {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly drawW: number
  readonly drawH: number
  readonly anchorX: number
  readonly anchorY: number
}

export interface SkinAvatarComposite {
  readonly skinId: string
  readonly sheet: HTMLCanvasElement
  readonly frames: readonly SkinAvatarCompositeFrame[]
}

export interface StoredCustomSkinPackage {
  readonly id: string
  readonly manifest: CharacterSkinManifest
  readonly files: Readonly<Record<string, Uint8Array>>
}

export interface CharacterSkinServiceOptions {
  readonly skinsBaseUrl?: string | undefined
  readonly fetchFn?: typeof fetch | undefined
  readonly decodeImageBytes?: ((bytes: Uint8Array, expectedW: number, expectedH: number) => Promise<DecodedSkinImage>) | undefined
  /**
   * Decoder for textures embedded in mesh skin models. Must return straight (non-premultiplied)
   * alpha: model textures reuse their alpha channel as a mask over colour that must survive.
   */
  readonly decodeMeshTexture?: ((bytes: Uint8Array, mimeType: string) => Promise<DecodedSkinImage>) | undefined
  readonly disableIndexedDb?: boolean | undefined
}

const IDB_NAME = 'd2web_character_skins_v1'
const IDB_STORE = 'custom_skins'
const SELECTION_STORAGE_KEY = 'd2web_char_skin_map_v1'

function loadPersistedSelectionMap(): Partial<Record<PlayerClassToken, string | null>> {
  try {
    if (typeof globalThis.localStorage === 'undefined') return {}
    const raw = globalThis.localStorage.getItem(SELECTION_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Partial<Record<PlayerClassToken, string | null>> = {}
    for (const cls of PLAYER_CLASS_TOKENS) {
      const v = (parsed as Record<string, unknown>)[cls]
      if (typeof v === 'string' && v.trim().length > 0) {
        out[cls] = v.trim()
      } else if (v === null) {
        out[cls] = null
      }
    }
    return out
  } catch {
    return {}
  }
}

function savePersistedSelectionMap(map: Readonly<Partial<Record<PlayerClassToken, string | null>>>): void {
  try {
    if (typeof globalThis.localStorage === 'undefined') return
    globalThis.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore restricted storage contexts
  }
}

const BUILTIN_FALLBACK_SKINS: readonly CharacterSkinCatalogEntry[] = Object.freeze([
  Object.freeze({
    id: 'ne-kelthuzad',
    name: Object.freeze({ zh: '巫妖克尔苏加德', en: "Kel'Thuzad (Archlich)" }),
    description: Object.freeze({
      zh: '浮空巫妖大法师外观，含寒冰王冠、霜魂符文锁链自发光层与护命匣阵亡形态。',
      en: 'Floating Archlich appearance with glowing Frost Crown, rune chains, and Phylactery death form.',
    }),
    targetClass: 'ne',
    source: 'builtin',
    manifestPath: 'ne-kelthuzad/skin.json',
    previewPath: 'ne-kelthuzad/preview.png',
  }),
  Object.freeze({
    id: 'ne-wow-undead',
    name: Object.freeze({ zh: '亡灵死灵法师（随装备换装）', en: 'Undead Necromancer (follows equipment)' }),
    targetClass: 'ne',
    source: 'builtin',
    manifestPath: 'ne-wow-undead/skin.json',
  }),
  Object.freeze({
    id: 'so-jaina',
    name: Object.freeze({ zh: '吉安娜·普罗德摩尔', en: 'Jaina Proudmoore' }),
    description: Object.freeze({
      zh: '《魔兽争霸3》吉安娜·普罗德摩尔实时 3D 骨骼模型。',
      en: 'Real-time Warcraft III model of Jaina Proudmoore.',
    }),
    targetClass: 'so',
    source: 'builtin',
    manifestPath: 'so-jaina/skin.json',
  }),
  Object.freeze({
    id: 'so-wow-human-mage',
    name: Object.freeze({ zh: '人类女法师（随装备换装）', en: 'Human Mage (follows equipment)' }),
    targetClass: 'so',
    source: 'builtin',
    manifestPath: 'so-wow-human-mage/skin.json',
  }),
  Object.freeze({
    id: 'am-sylvanas',
    name: Object.freeze({ zh: '黑暗游侠希尔瓦娜斯', en: 'Sylvanas (Dark Ranger)' }),
    targetClass: 'am',
    source: 'builtin',
    manifestPath: 'am-sylvanas/skin.json',
  }),
  Object.freeze({
    id: 'am-wow-bloodelf',
    name: Object.freeze({ zh: '血精灵游侠（随装备换装）', en: 'Blood Elf Ranger (follows equipment)' }),
    targetClass: 'am',
    source: 'builtin',
    manifestPath: 'am-wow-bloodelf/skin.json',
  }),
  Object.freeze({
    id: 'pa-arthas',
    name: Object.freeze({ zh: '阿尔萨斯王子', en: 'Arthas (Paladin)' }),
    targetClass: 'pa',
    source: 'builtin',
    manifestPath: 'pa-arthas/skin.json',
  }),
  Object.freeze({
    id: 'pa-wow-dwarf',
    name: Object.freeze({ zh: '矮人圣骑士（随装备换装）', en: 'Dwarf Paladin (follows equipment)' }),
    targetClass: 'pa',
    source: 'builtin',
    manifestPath: 'pa-wow-dwarf/skin.json',
  }),
  Object.freeze({
    id: 'ba-grom',
    name: Object.freeze({ zh: '格罗姆·地狱咆哮', en: 'Grom Hellscream' }),
    targetClass: 'ba',
    source: 'builtin',
    manifestPath: 'ba-grom/skin.json',
  }),
  Object.freeze({
    id: 'ba-wow-orc',
    name: Object.freeze({ zh: '兽人战士（随装备换装，可双持）', en: 'Orc Warrior (follows equipment, dual wield)' }),
    targetClass: 'ba',
    source: 'builtin',
    manifestPath: 'ba-wow-orc/skin.json',
  }),
  Object.freeze({
    id: 'dz-malfurion',
    name: Object.freeze({ zh: '玛法里奥·怒风', en: 'Malfurion Stormrage' }),
    targetClass: 'dz',
    source: 'builtin',
    manifestPath: 'dz-malfurion/skin.json',
  }),
  Object.freeze({
    id: 'dz-wow-nightelf',
    name: Object.freeze({ zh: '暗夜精灵德鲁伊（随装备换装）', en: 'Night Elf Druid (follows equipment)' }),
    targetClass: 'dz',
    source: 'builtin',
    manifestPath: 'dz-wow-nightelf/skin.json',
  }),
  Object.freeze({
    id: 'ai-maiev',
    name: Object.freeze({ zh: '守望者玛维', en: 'Maiev Shadowsong (Warden)' }),
    targetClass: 'ai',
    source: 'builtin',
    manifestPath: 'ai-maiev/skin.json',
  }),
  Object.freeze({
    id: 'ai-wow-draenei',
    name: Object.freeze({ zh: '德莱尼刺客（随装备换装，可双持）', en: 'Draenei Assassin (follows equipment, dual wield)' }),
    targetClass: 'ai',
    source: 'builtin',
    manifestPath: 'ai-wow-draenei/skin.json',
  }),
])

/** Built-in skin a class gets by default when the skin plugin is switched on. */
export const BUILTIN_DEFAULT_SKIN_BY_CLASS: Readonly<Partial<Record<PlayerClassToken, string>>> = Object.freeze({
  am: 'am-wow-bloodelf',
  so: 'so-wow-human-mage',
  ne: 'ne-wow-undead',
  pa: 'pa-wow-dwarf',
  ba: 'ba-wow-orc',
  dz: 'dz-wow-nightelf',
  ai: 'ai-wow-draenei',
})

const CLASS_DISPLAY_NAMES: Readonly<Record<PlayerClassToken, { readonly zh: string; readonly en: string }>> = {
  am: { zh: '亚马逊 (Amazon)', en: 'Amazon' },
  so: { zh: '法师 (Sorceress)', en: 'Sorceress' },
  ne: { zh: '死灵法师 (Necromancer)', en: 'Necromancer' },
  pa: { zh: '圣骑士 (Paladin)', en: 'Paladin' },
  ba: { zh: '野蛮人 (Barbarian)', en: 'Barbarian' },
  dz: { zh: '德鲁伊 (Druid)', en: 'Druid' },
  ai: { zh: '刺客 (Assassin)', en: 'Assassin' },
}

function mapTuplesToPagedFrames(
  groups: readonly (readonly CharacterSkinFrameTuple[])[],
  pageHandles: readonly AtlasHandle[],
): readonly (readonly PagedAtlasFrame[])[] {
  return groups.map((group) =>
    group.map((tuple) => {
      const [x, y, width, height, anchorX, anchorY, pageIndex] = tuple
      const handle = pageHandles[pageIndex ?? 0] ?? pageHandles[0]!
      return {
        x,
        y,
        width,
        height,
        ...(anchorX !== undefined ? { anchorX } : {}),
        ...(anchorY !== undefined ? { anchorY } : {}),
        atlas: handle,
      }
    }),
  )
}

async function defaultDecodeImageBytes(bytes: Uint8Array): Promise<DecodedSkinImage> {
  if (typeof createImageBitmap !== 'function' || typeof Blob !== 'function') {
    throw new Error('createImageBitmap is not available in this environment')
  }
  const safeCopy = new Uint8Array(bytes.byteLength)
  safeCopy.set(bytes)
  const bitmap = await createImageBitmap(new Blob([safeCopy]))
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    close: () => bitmap.close(),
  }
}

async function defaultDecodeMeshTexture(bytes: Uint8Array, mimeType: string): Promise<DecodedSkinImage> {
  if (typeof createImageBitmap !== 'function' || typeof Blob !== 'function') {
    throw new Error('createImageBitmap is not available in this environment')
  }
  const safeCopy = new Uint8Array(bytes.byteLength)
  safeCopy.set(bytes)
  const bitmap = await createImageBitmap(new Blob([safeCopy], { type: mimeType }), {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  })
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    close: () => bitmap.close(),
  }
}

/** Models, textures and playback state of mesh skins for one sprite renderer. */
/** Anything the per-renderer mesh cache holds: it owns one uploaded model. */
interface MeshSkinCacheEntry {
  readonly gpu: MeshSkinGpuModel
}

/** Cache key namespace of weapon pack models (`weapon::<pack>::<id>`); never a skin id. */
const MESH_SKIN_WEAPON_KEY_PREFIX = 'weapon::'

class PerRendererMeshSkinCache implements MeshSkinRuntime {
  readonly meshRenderer: MeshSkinRenderer
  readonly animator = new MeshSkinAnimator()
  private readonly renderer: SpriteRenderer
  private readonly loaded = new Map<string, MeshSkinCacheEntry>()
  private readonly inflight = new Map<string, Promise<MeshSkinCacheEntry | null>>()
  private readonly failed = new Set<string>()
  /** Bumped by every eviction so loads that were in flight at that moment are discarded. */
  private generation = 0

  constructor(renderer: SpriteRenderer) {
    this.renderer = renderer
    this.meshRenderer = new MeshSkinRenderer(renderer)
  }

  /** The entry under `cacheKey`; the key's namespace fixes its type (units vs. pack weapons). */
  getReady<T extends MeshSkinCacheEntry = LoadedMeshSkinUnit>(cacheKey: string): T | undefined {
    const existing = this.loaded.get(cacheKey)
    if (existing && this.renderer.isDisposed) {
      this.loaded.clear()
      return undefined
    }
    return existing as T | undefined
  }

  hasFailed(cacheKey: string): boolean {
    return this.failed.has(cacheKey)
  }

  ensureLoaded<T extends MeshSkinCacheEntry = LoadedMeshSkinUnit>(
    cacheKey: string,
    loadFn: (meshRenderer: MeshSkinRenderer) => Promise<T | null>,
  ): Promise<T | null> {
    const existing = this.getReady<T>(cacheKey)
    if (existing) return Promise.resolve(existing)
    if (this.failed.has(cacheKey) || this.renderer.isDisposed) return Promise.resolve(null)
    const pending = this.inflight.get(cacheKey)
    if (pending) return pending as Promise<T | null>
    const generation = this.generation
    const p = (async (): Promise<T | null> => {
      try {
        const unit = await loadFn(this.meshRenderer)
        // An eviction while loading (plugin disabled, skin replaced) makes this result stale.
        if (generation !== this.generation || this.renderer.isDisposed) {
          if (unit !== null) this.meshRenderer.disposeModel(unit.gpu)
          return null
        }
        if (unit === null) {
          this.failed.add(cacheKey)
          return null
        }
        this.loaded.set(cacheKey, unit)
        return unit
      } catch (err) {
        if (generation === this.generation) this.failed.add(cacheKey)
        console.warn(`[CharacterSkinService] Failed to load mesh skin "${cacheKey}": ${(err as Error).message}`)
        return null
      } finally {
        if (generation === this.generation) this.inflight.delete(cacheKey)
      }
    })()
    this.inflight.set(cacheKey, p)
    return p
  }

  /** Evict units whose cache key passes `match`; frees the shared targets once nothing is left. */
  evictWhere(match: (cacheKey: string) => boolean): void {
    this.generation += 1
    this.inflight.clear()
    for (const key of [...this.failed]) if (match(key)) this.failed.delete(key)
    for (const [key, unit] of [...this.loaded.entries()]) {
      if (!match(key)) continue
      this.loaded.delete(key)
      this.meshRenderer.disposeModel(unit.gpu)
    }
    if (this.loaded.size === 0) {
      this.meshRenderer.dispose()
      this.animator.clear()
    }
  }
}

class CustomSkinIdbRepository {
  private readonly disabled: boolean
  private dbPromise: Promise<IDBDatabase | null> | null = null

  constructor(disabled = false) {
    this.disabled = disabled
  }

  private openDb(): Promise<IDBDatabase | null> {
    if (this.disabled || typeof indexedDB === 'undefined') {
      return Promise.resolve(null)
    }
    if (this.dbPromise !== null) return this.dbPromise
    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1)
        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE, { keyPath: 'id' })
          }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
    return this.dbPromise
  }

  async loadAll(): Promise<StoredCustomSkinPackage[]> {
    const db = await this.openDb()
    if (!db) return []
    return new Promise<StoredCustomSkinPackage[]>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly')
        const store = tx.objectStore(IDB_STORE)
        const req = store.getAll()
        req.onsuccess = () => {
          const rawList = Array.isArray(req.result) ? req.result : []
          const valid: StoredCustomSkinPackage[] = []
          for (const item of rawList) {
            try {
              if (!item || typeof item !== 'object') continue
              const rec = item as { id?: unknown; manifest?: unknown; files?: Record<string, unknown> }
              const manifest = validateCharacterSkinManifest(rec.manifest)
              const files: Record<string, Uint8Array> = {}
              if (rec.files && typeof rec.files === 'object') {
                for (const [k, v] of Object.entries(rec.files)) {
                  if (v instanceof Uint8Array) {
                    files[k] = v
                  } else if (v instanceof ArrayBuffer) {
                    files[k] = new Uint8Array(v)
                  }
                }
              }
              valid.push({ id: manifest.id, manifest, files })
            } catch {
              // Skip corrupted record
            }
          }
          resolve(valid)
        }
        req.onerror = () => resolve([])
      } catch {
        resolve([])
      }
    })
  }

  async put(pkg: StoredCustomSkinPackage): Promise<void> {
    const db = await this.openDb()
    if (!db) return
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite')
        tx.objectStore(IDB_STORE).put(pkg)
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }

  async delete(id: string): Promise<void> {
    const db = await this.openDb()
    if (!db) return
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite')
        tx.objectStore(IDB_STORE).delete(id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }
}

class PerRendererSkinAtlasCache {
  private readonly renderer: SpriteRenderer
  private readonly loaded = new Map<string, LoadedCharacterSkinArt>()
  private readonly inflight = new Map<string, Promise<LoadedCharacterSkinArt | null>>()
  private readonly failed = new Set<string>()

  private readonly loadedMinions = new Map<string, LoadedMinionSkinArt>()
  private readonly inflightMinions = new Map<string, Promise<LoadedMinionSkinArt | null>>()
  private readonly failedMinions = new Set<string>()

  constructor(renderer: SpriteRenderer) {
    this.renderer = renderer
  }

  getReady(skinId: string): LoadedCharacterSkinArt | undefined {
    const existing = this.loaded.get(skinId)
    if (existing && this.renderer.isDisposed) {
      this.loaded.clear()
      this.loadedMinions.clear()
      return undefined
    }
    return existing
  }

  hasFailed(skinId: string): boolean {
    return this.failed.has(skinId)
  }

  getReadyMinion(skinId: string, minionKey: string): LoadedMinionSkinArt | undefined {
    const existing = this.loadedMinions.get(`${skinId}::${minionKey}`)
    if (existing && this.renderer.isDisposed) {
      this.loaded.clear()
      this.loadedMinions.clear()
      return undefined
    }
    return existing
  }

  hasFailedMinion(skinId: string, minionKey: string): boolean {
    return this.failedMinions.has(`${skinId}::${minionKey}`)
  }

  evictMinionsForSkin(skinId: string): void {
    const prefix = `${skinId}::`
    for (const key of [...this.failedMinions]) {
      if (key.startsWith(prefix)) this.failedMinions.delete(key)
    }
    for (const key of [...this.inflightMinions.keys()]) {
      if (key.startsWith(prefix)) this.inflightMinions.delete(key)
    }
    for (const [key, mArt] of [...this.loadedMinions.entries()]) {
      if (!key.startsWith(prefix)) continue
      this.loadedMinions.delete(key)
      if (!this.renderer.isDisposed) {
        for (const h of mArt.pageHandles) {
          this.renderer.deleteAtlas(h)
        }
        if (mArt.glowPageHandles) {
          for (const h of mArt.glowPageHandles) {
            this.renderer.deleteAtlas(h)
          }
        }
      }
    }
  }

  evictAllMinions(): void {
    for (const [, mArt] of [...this.loadedMinions.entries()]) {
      if (!this.renderer.isDisposed) {
        for (const h of mArt.pageHandles) {
          this.renderer.deleteAtlas(h)
        }
        if (mArt.glowPageHandles) {
          for (const h of mArt.glowPageHandles) {
            this.renderer.deleteAtlas(h)
          }
        }
      }
    }
    this.loadedMinions.clear()
    this.inflightMinions.clear()
    this.failedMinions.clear()
  }

  evict(skinId: string): void {
    this.evictMinionsForSkin(skinId)
    this.failed.delete(skinId)
    this.inflight.delete(skinId)
    const art = this.loaded.get(skinId)
    if (!art) return
    this.loaded.delete(skinId)
    if (!this.renderer.isDisposed) {
      for (const h of art.pageHandles) {
        this.renderer.deleteAtlas(h)
      }
      if (art.glowPageHandles) {
        for (const h of art.glowPageHandles) {
          this.renderer.deleteAtlas(h)
        }
      }
    }
  }

  evictAll(): void {
    this.evictAllMinions()
    for (const skinId of [...this.loaded.keys()]) {
      this.evict(skinId)
    }
    this.inflight.clear()
    this.failed.clear()
  }

  ensureLoaded(
    skinId: string,
    loadFn: () => Promise<{
      readonly manifest: CharacterSkinManifest
      readonly pages: readonly DecodedSkinImage[]
      readonly glowPages?: readonly DecodedSkinImage[] | undefined
    }>,
  ): Promise<LoadedCharacterSkinArt | null> {
    const existing = this.getReady(skinId)
    if (existing) return Promise.resolve(existing)
    if (this.failed.has(skinId) || this.renderer.isDisposed) return Promise.resolve(null)
    const pending = this.inflight.get(skinId)
    if (pending) return pending

    const p = (async (): Promise<LoadedCharacterSkinArt | null> => {
      let decodedPages: readonly DecodedSkinImage[] = []
      let decodedGlowPages: readonly DecodedSkinImage[] = []
      const allocatedHandles: AtlasHandle[] = []
      try {
        const res = await loadFn()
        decodedPages = res.pages
        decodedGlowPages = res.glowPages ?? []
        if (this.renderer.isDisposed) return null

        const pageHandles = res.manifest.pages.map((spec, idx) => {
          const img = decodedPages[idx]!
          const h = this.renderer.addAtlas(img.source as ImageBitmap, spec.width, spec.height)
          allocatedHandles.push(h)
          return h
        })
        const glowPageHandles =
          res.manifest.glowPages && decodedGlowPages.length === res.manifest.glowPages.length
            ? res.manifest.glowPages.map((spec, idx) => {
                const img = decodedGlowPages[idx]!
                const h = this.renderer.addAtlas(img.source as ImageBitmap, spec.width, spec.height)
                allocatedHandles.push(h)
                return h
              })
            : undefined

        const groups = mapTuplesToPagedFrames(res.manifest.groups, pageHandles)
        const glowGroups =
          res.manifest.glowGroups && glowPageHandles
            ? mapTuplesToPagedFrames(res.manifest.glowGroups, glowPageHandles)
            : undefined

        const loadedArt: LoadedCharacterSkinArt = {
          id: res.manifest.id,
          manifest: res.manifest,
          handle: pageHandles[0]!,
          pageHandles,
          ...(glowPageHandles ? { glowPageHandles } : {}),
          groups,
          ...(glowGroups ? { glowGroups } : {}),
          clips: res.manifest.clips,
          ...(res.manifest.glowClips ? { glowClips: res.manifest.glowClips } : {}),
          renderScale: res.manifest.renderScale ?? 1,
          shadowOffsetY: res.manifest.shadowOffsetY ?? 0,
          shadowScale: res.manifest.shadowScale ?? 1,
        }
        this.loaded.set(skinId, loadedArt)
        return loadedArt
      } catch (err) {
        this.failed.add(skinId)
        if (!this.renderer.isDisposed) {
          for (const h of allocatedHandles) {
            this.renderer.deleteAtlas(h)
          }
        }
        console.warn(`[CharacterSkinService] Failed to load skin "${skinId}": ${(err as Error).message}`)
        return null
      } finally {
        for (const img of decodedPages) img.close?.()
        for (const img of decodedGlowPages) img.close?.()
        this.inflight.delete(skinId)
      }
    })()

    this.inflight.set(skinId, p)
    return p
  }

  ensureMinionLoaded(
    skinId: string,
    minionKey: string,
    loadFn: () => Promise<{
      readonly spec: CharacterSkinMinionSpec
      readonly pages: readonly DecodedSkinImage[]
      readonly glowPages?: readonly DecodedSkinImage[] | undefined
    } | null>,
  ): Promise<LoadedMinionSkinArt | null> {
    const cacheKey = `${skinId}::${minionKey}`
    const existing = this.getReadyMinion(skinId, minionKey)
    if (existing) return Promise.resolve(existing)
    if (this.failedMinions.has(cacheKey) || this.renderer.isDisposed) return Promise.resolve(null)
    const pending = this.inflightMinions.get(cacheKey)
    if (pending) return pending

    const p = (async (): Promise<LoadedMinionSkinArt | null> => {
      let decodedPages: readonly DecodedSkinImage[] = []
      let decodedGlowPages: readonly DecodedSkinImage[] = []
      const allocatedHandles: AtlasHandle[] = []
      try {
        const res = await loadFn()
        if (!res) {
          this.failedMinions.add(cacheKey)
          return null
        }
        decodedPages = res.pages
        decodedGlowPages = res.glowPages ?? []
        if (this.renderer.isDisposed) return null

        const pageHandles = res.spec.pages.map((spec, idx) => {
          const img = decodedPages[idx]!
          const h = this.renderer.addAtlas(img.source as ImageBitmap, spec.width, spec.height)
          allocatedHandles.push(h)
          return h
        })
        const glowPageHandles =
          res.spec.glowPages && decodedGlowPages.length === res.spec.glowPages.length
            ? res.spec.glowPages.map((spec, idx) => {
                const img = decodedGlowPages[idx]!
                const h = this.renderer.addAtlas(img.source as ImageBitmap, spec.width, spec.height)
                allocatedHandles.push(h)
                return h
              })
            : undefined

        const groups = mapTuplesToPagedFrames(res.spec.groups, pageHandles)
        const glowGroups =
          res.spec.glowGroups && glowPageHandles
            ? mapTuplesToPagedFrames(res.spec.glowGroups, glowPageHandles)
            : undefined

        const loadedMinion: LoadedMinionSkinArt = {
          skinId,
          minionKey,
          spec: res.spec,
          handle: pageHandles[0]!,
          pageHandles,
          ...(glowPageHandles ? { glowPageHandles } : {}),
          groups,
          ...(glowGroups ? { glowGroups } : {}),
          clips: res.spec.clips,
          ...(res.spec.glowClips ? { glowClips: res.spec.glowClips } : {}),
          renderScale: res.spec.renderScale ?? 1,
          shadowOffsetY: res.spec.shadowOffsetY ?? 0,
          shadowScale: res.spec.shadowScale ?? 1,
        }
        this.loadedMinions.set(cacheKey, loadedMinion)
        return loadedMinion
      } catch (err) {
        this.failedMinions.add(cacheKey)
        if (!this.renderer.isDisposed) {
          for (const h of allocatedHandles) {
            this.renderer.deleteAtlas(h)
          }
        }
        console.warn(
          `[CharacterSkinService] Failed to load minion skin "${skinId}/${minionKey}": ${(err as Error).message}`,
        )
        return null
      } finally {
        for (const img of decodedPages) img.close?.()
        for (const img of decodedGlowPages) img.close?.()
        this.inflightMinions.delete(cacheKey)
      }
    })()

    this.inflightMinions.set(cacheKey, p)
    return p
  }
}

export class CharacterSkinService {
  private readonly skinsBaseUrl: string
  /** Weapon pack indexes by pack id: `'loading'`, the parsed index, or `null` when unavailable. */
  private readonly weaponPackIndexes = new Map<string, WeaponPackIndex | 'loading' | null>()
  private readonly fetchFn: typeof fetch | undefined
  private readonly decodeImageBytes: (bytes: Uint8Array, expectedW: number, expectedH: number) => Promise<DecodedSkinImage>
  private readonly decodeMeshTexture: (bytes: Uint8Array, mimeType: string) => Promise<DecodedSkinImage>
  private readonly idbRepo: CustomSkinIdbRepository

  private config: CharacterSkinRuntimeConfig = DEFAULT_CHARACTER_SKIN_CONFIG
  private readonly builtinCatalog = new Map<string, CharacterSkinCatalogEntry>()
  private readonly customPackages = new Map<string, StoredCustomSkinPackage>()
  private readonly manifestCache = new Map<string, CharacterSkinManifest>()
  private readonly manifestInflight = new Map<string, Promise<CharacterSkinManifest>>()
  private readonly manifestFailed = new Set<string>()

  private readonly gpuCaches = new WeakMap<SpriteRenderer, PerRendererSkinAtlasCache>()
  private readonly meshCaches = new WeakMap<SpriteRenderer, PerRendererMeshSkinCache>()
  private readonly liveRenderers = new Set<SpriteRenderer>()

  private readonly avatarReady = new Map<string, SkinAvatarComposite>()
  private readonly avatarInflight = new Map<string, Promise<SkinAvatarComposite | null>>()
  private readonly previewObjectUrls = new Map<string, string>()

  private readonly portraitReady = new Map<string, { readonly drawable: MinionPortraitDrawable; close?(): void }>()
  private readonly portraitInflight = new Map<string, Promise<MinionPortraitDrawable | null>>()
  private readonly portraitFailed = new Set<string>()

  private catalogInitPromise: Promise<void> | null = null
  private catalogLoaded = false
  private readonly listeners = new Set<() => void>()

  constructor(options: CharacterSkinServiceOptions = {}) {
    this.skinsBaseUrl = (options.skinsBaseUrl ?? '/skins').replace(/\/+$/, '')
    this.fetchFn =
      options.fetchFn ??
      (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined)
    this.decodeImageBytes = options.decodeImageBytes ?? ((bytes) => defaultDecodeImageBytes(bytes))
    this.decodeMeshTexture = options.decodeMeshTexture ?? defaultDecodeMeshTexture
    this.idbRepo = new CustomSkinIdbRepository(options.disableIndexedDb === true)

    for (const entry of BUILTIN_FALLBACK_SKINS) {
      this.builtinCatalog.set(entry.id, entry)
    }
  }

  getConfig(): CharacterSkinRuntimeConfig {
    return this.config
  }

  getPersistedSelections(): Partial<Record<PlayerClassToken, string | null>> {
    return loadPersistedSelectionMap()
  }

  setConfig(patch: Partial<CharacterSkinRuntimeConfig>): void {
    const wasEnabled = this.config.enabled
    const wasMinionsEnabled = this.config.minionsEnabled
    const nextEnabled = patch.enabled ?? wasEnabled
    const nextMinionsEnabled = patch.minionsEnabled ?? wasMinionsEnabled
    const restored = !wasEnabled && nextEnabled ? loadPersistedSelectionMap() : {}
    const nextSelected: Partial<Record<PlayerClassToken, string | null>> = {
      ...restored,
      ...this.config.selectedByClass,
      ...(patch.selectedByClass ?? {}),
    }
    if (!wasEnabled && nextEnabled) {
      // Switching the plugin on asks for the built-in defaults; a custom skin the player had
      // picked for that class before wins over the default.
      for (const [cls, builtinId] of Object.entries(BUILTIN_DEFAULT_SKIN_BY_CLASS) as [PlayerClassToken, string][]) {
        const prev = restored[cls]
        if (prev && prev !== builtinId && patch.selectedByClass?.[cls] === builtinId) {
          nextSelected[cls] = prev
        }
      }
    }
    if (patch.selectedByClass !== undefined) {
      savePersistedSelectionMap(nextSelected)
    }
    const next: CharacterSkinRuntimeConfig = {
      enabled: nextEnabled,
      scope: patch.scope ?? this.config.scope,
      morphPolicy: patch.morphPolicy ?? this.config.morphPolicy,
      minionsEnabled: nextMinionsEnabled,
      selectedByClass: nextSelected,
    }
    const prevJson = JSON.stringify(this.config)
    const nextJson = JSON.stringify(next)
    if (prevJson === nextJson) return

    this.config = next
    if (next.enabled && !this.catalogLoaded) {
      void this.ensureCatalogLoaded()
    }
    if (wasEnabled && !next.enabled) {
      this.releaseAllGpuAtlases()
    } else if (wasMinionsEnabled && !next.minionsEnabled) {
      this.releaseAllMinionGpuAtlases()
    }
    this.notifyListeners()
  }

  resetToVanilla(): void {
    if (!this.config.enabled && Object.keys(this.config.selectedByClass).length === 0) return
    this.config = DEFAULT_CHARACTER_SKIN_CONFIG
    this.releaseAllGpuAtlases()
    this.notifyListeners()
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private notifyListeners(): void {
    for (const fn of [...this.listeners]) {
      try {
        fn()
      } catch {
        // Isolate subscriber errors
      }
    }
  }

  getCatalog(): readonly CharacterSkinCatalogEntry[] {
    const list: CharacterSkinCatalogEntry[] = [...this.builtinCatalog.values()]
    for (const pkg of this.customPackages.values()) {
      list.push({
        id: pkg.id,
        name: pkg.manifest.name,
        ...(pkg.manifest.description ? { description: pkg.manifest.description } : {}),
        ...(pkg.manifest.author ? { author: pkg.manifest.author } : {}),
        targetClass: pkg.manifest.targetClass,
        source: 'custom',
      })
    }
    return list
  }

  getCatalogForClass(classToken: PlayerClassToken): readonly CharacterSkinCatalogEntry[] {
    const lower = classToken.toLowerCase() as PlayerClassToken
    return this.getCatalog().filter((entry) => entry.targetClass === lower)
  }

  getSelectedSkinId(classToken: PlayerClassToken): string | null {
    if (!this.config.enabled) return null
    const id = this.config.selectedByClass[classToken]
    return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null
  }

  setClassSkin(classToken: PlayerClassToken, skinId: string | null): void {
    const clean = typeof skinId === 'string' && skinId.trim().length > 0 && skinId !== 'none' ? skinId.trim() : null
    const prev = this.config.selectedByClass[classToken] ?? null
    if (prev === clean) return
    this.setConfig({
      selectedByClass: {
        ...this.config.selectedByClass,
        [classToken]: clean,
      },
    })
  }

  async ensureCatalogLoaded(): Promise<readonly CharacterSkinCatalogEntry[]> {
    if (this.catalogLoaded) return this.getCatalog()
    if (this.catalogInitPromise) {
      await this.catalogInitPromise
      return this.getCatalog()
    }
    this.catalogInitPromise = (async () => {
      try {
        const storedCustom = await this.idbRepo.loadAll()
        for (const pkg of storedCustom) {
          this.customPackages.set(pkg.id, pkg)
          this.manifestCache.set(pkg.id, pkg.manifest)
        }
        if (this.fetchFn) {
          try {
            const res = await this.fetchFn(`${this.skinsBaseUrl}/index.json`, { cache: 'no-cache' })
            if (res.ok) {
              const indexJson = validateCharacterSkinIndex(await res.json())
              this.builtinCatalog.clear()
              for (const entry of indexJson.skins) {
                this.builtinCatalog.set(entry.id, entry)
              }
            }
          } catch {
            // Keep built-in fallback catalog when offline or index.json is absent
          }
        }
        this.catalogLoaded = true
        this.notifyListeners()
      } finally {
        this.catalogInitPromise = null
      }
    })()
    await this.catalogInitPromise
    return this.getCatalog()
  }

  async importSkinZip(
    zipBytes: Uint8Array,
    options: { readonly activateForClass?: boolean } = {},
  ): Promise<CharacterSkinCatalogEntry> {
    await this.ensureCatalogLoaded()
    const extracted = await extractZipArchive(zipBytes)
    const manifestBytes = extracted.get('skin.json')
    if (!manifestBytes) {
      throw new Error('Missing "skin.json" at root of .d2skin.zip archive')
    }
    const manifestRaw: unknown = JSON.parse(new TextDecoder('utf-8').decode(manifestBytes))
    const manifest = validateCharacterSkinManifest(manifestRaw)

    const filesRecord: Record<string, Uint8Array> = {}
    for (const [k, v] of extracted.entries()) {
      filesRecord[k] = v
    }
    for (const page of manifest.pages) {
      if (!filesRecord[page.file]) {
        throw new Error(`Missing atlas file "${page.file}" inside .d2skin.zip`)
      }
    }
    if (manifest.mesh && !filesRecord[manifest.mesh.file]) {
      throw new Error(`Missing model file "${manifest.mesh.file}" inside .d2skin.zip`)
    }
    if (manifest.glowPages) {
      for (const page of manifest.glowPages) {
        if (!filesRecord[page.file]) {
          throw new Error(`Missing glow atlas file "${page.file}" inside .d2skin.zip`)
        }
      }
    }
    if (manifest.minions) {
      for (const [mKey, mSpec] of Object.entries(manifest.minions)) {
        for (const page of mSpec.pages) {
          if (!filesRecord[page.file]) {
            throw new Error(`Missing minion "${mKey}" atlas file "${page.file}" inside .d2skin.zip`)
          }
        }
        if (mSpec.glowPages) {
          for (const page of mSpec.glowPages) {
            if (!filesRecord[page.file]) {
              throw new Error(`Missing minion "${mKey}" glow atlas file "${page.file}" inside .d2skin.zip`)
            }
          }
        }
        if (mSpec.mesh && !filesRecord[mSpec.mesh.file]) {
          throw new Error(`Missing minion "${mKey}" model file "${mSpec.mesh.file}" inside .d2skin.zip`)
        }
        if (mSpec.portraitFile && !filesRecord[mSpec.portraitFile]) {
          throw new Error(`Missing minion "${mKey}" portrait file "${mSpec.portraitFile}" inside .d2skin.zip`)
        }
      }
    }

    const pkg: StoredCustomSkinPackage = {
      id: manifest.id,
      manifest,
      files: filesRecord,
    }
    this.evictSkinAssets(manifest.id)
    this.customPackages.set(manifest.id, pkg)
    this.manifestCache.set(manifest.id, manifest)
    await this.idbRepo.put(pkg)

    if (options.activateForClass !== false) {
      this.setClassSkin(manifest.targetClass, manifest.id)
    } else {
      this.notifyListeners()
    }

    return {
      id: manifest.id,
      name: manifest.name,
      ...(manifest.description ? { description: manifest.description } : {}),
      ...(manifest.author ? { author: manifest.author } : {}),
      targetClass: manifest.targetClass,
      source: 'custom',
    }
  }

  async removeCustomSkin(skinId: string): Promise<boolean> {
    await this.ensureCatalogLoaded()
    const pkg = this.customPackages.get(skinId)
    if (!pkg) return false
    this.customPackages.delete(skinId)
    if (!this.builtinCatalog.has(skinId)) {
      this.manifestCache.delete(skinId)
    }
    this.evictSkinAssets(skinId)
    await this.idbRepo.delete(skinId)

    const nextSelected = { ...this.config.selectedByClass }
    let changedSelection = false
    for (const cls of PLAYER_CLASS_TOKENS) {
      if (nextSelected[cls] === skinId && !this.builtinCatalog.has(skinId)) {
        nextSelected[cls] = null
        changedSelection = true
      }
    }
    if (changedSelection) {
      this.config = { ...this.config, selectedByClass: nextSelected }
    }
    this.notifyListeners()
    return true
  }

  getPreviewUrl(skinId: string): string | null {
    const cachedUrl = this.previewObjectUrls.get(skinId)
    if (cachedUrl) return cachedUrl
    const custom = this.customPackages.get(skinId)
    if (custom) {
      const previewName = custom.manifest.previewFile ?? 'preview.png'
      const previewBytes = custom.files[previewName]
      if (previewBytes && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const copy = new Uint8Array(previewBytes.byteLength)
        copy.set(previewBytes)
        const url = URL.createObjectURL(new Blob([copy], { type: 'image/png' }))
        this.previewObjectUrls.set(skinId, url)
        return url
      }
    }
    const builtin = this.builtinCatalog.get(skinId)
    if (builtin?.previewPath) {
      return `${this.skinsBaseUrl}/${builtin.previewPath}`
    }
    return null
  }

  private evictPortraitsForSkin(skinId: string): void {
    const prefix = `${skinId}::`
    for (const key of [...this.portraitFailed]) {
      if (key.startsWith(prefix)) this.portraitFailed.delete(key)
    }
    for (const key of [...this.portraitInflight.keys()]) {
      if (key.startsWith(prefix)) this.portraitInflight.delete(key)
    }
    for (const [key, entry] of [...this.portraitReady.entries()]) {
      if (!key.startsWith(prefix)) continue
      this.portraitReady.delete(key)
      entry.close?.()
    }
  }

  private evictAllPortraits(): void {
    for (const [, entry] of [...this.portraitReady.entries()]) {
      entry.close?.()
    }
    this.portraitReady.clear()
    this.portraitInflight.clear()
    this.portraitFailed.clear()
  }

  private evictSkinAssets(skinId: string): void {
    this.manifestInflight.delete(skinId)
    this.manifestFailed.delete(skinId)
    this.avatarReady.delete(skinId)
    this.avatarInflight.delete(skinId)
    this.evictPortraitsForSkin(skinId)
    const objUrl = this.previewObjectUrls.get(skinId)
    if (objUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(objUrl)
    }
    this.previewObjectUrls.delete(skinId)
    for (const renderer of [...this.liveRenderers]) {
      if (renderer.isDisposed) {
        this.liveRenderers.delete(renderer)
        continue
      }
      this.gpuCaches.get(renderer)?.evict(skinId)
      this.meshCaches.get(renderer)?.evictWhere((key) => key.startsWith(`${skinId}::`))
    }
  }

  releaseAllMinionGpuAtlases(): void {
    this.evictAllPortraits()
    for (const renderer of [...this.liveRenderers]) {
      if (renderer.isDisposed) {
        this.liveRenderers.delete(renderer)
        continue
      }
      this.gpuCaches.get(renderer)?.evictAllMinions()
      this.meshCaches
        .get(renderer)
        ?.evictWhere(
          (key) => !key.endsWith(`::${MESH_SKIN_HERO_UNIT_KEY}`) && !key.includes(`::${MESH_SKIN_MORPH_UNIT_PREFIX}`),
        )
    }
  }

  releaseAllGpuAtlases(): void {
    this.evictAllPortraits()
    for (const renderer of [...this.liveRenderers]) {
      if (renderer.isDisposed) {
        this.liveRenderers.delete(renderer)
        continue
      }
      this.gpuCaches.get(renderer)?.evictAll()
      this.meshCaches.get(renderer)?.evictWhere(() => true)
    }
  }

  private resolveBuiltinDirUrl(skinId: string): string {
    const entry = this.builtinCatalog.get(skinId)
    const manifestRel = entry?.manifestPath ?? `${skinId}/skin.json`
    const slashIdx = manifestRel.lastIndexOf('/')
    const subDir = slashIdx > 0 ? manifestRel.slice(0, slashIdx) : skinId
    return `${this.skinsBaseUrl}/${subDir}`
  }

  private async loadManifest(skinId: string): Promise<CharacterSkinManifest> {
    const custom = this.customPackages.get(skinId)
    if (custom) return custom.manifest
    const cached = this.manifestCache.get(skinId)
    if (cached) return cached
    const pending = this.manifestInflight.get(skinId)
    if (pending) return pending

    const p = (async (): Promise<CharacterSkinManifest> => {
      if (!this.catalogLoaded) {
        await this.ensureCatalogLoaded()
        const customAfterInit = this.customPackages.get(skinId)
        if (customAfterInit) return customAfterInit.manifest
      }
      if (!this.fetchFn) {
        throw new Error('fetch is unavailable')
      }
      const entry = this.builtinCatalog.get(skinId)
      const manifestRel = entry?.manifestPath ?? `${skinId}/skin.json`
      if (!isValidSkinRelativeFile(manifestRel)) {
        throw new Error(`Invalid manifest path "${manifestRel}"`)
      }
      const resp = await this.fetchFn(`${this.skinsBaseUrl}/${manifestRel}`, { cache: 'no-cache' })
      if (!resp.ok) {
        throw new Error(`HTTP ${String(resp.status)} fetching ${manifestRel}`)
      }
      const validated = validateCharacterSkinManifest(await resp.json())
      this.manifestCache.set(skinId, validated)
      this.notifyListeners()
      return validated
    })()

    this.manifestInflight.set(skinId, p)
    try {
      return await p
    } catch (err) {
      this.manifestFailed.add(skinId)
      throw err
    } finally {
      this.manifestInflight.delete(skinId)
    }
  }

  /**
   * Synchronous manifest peek for the render loop: the cached manifest, `'loading'` while it is
   * being fetched (the fetch is started on first miss), or `null` when it cannot be loaded.
   */
  peekSelectedManifest(classToken: PlayerClassToken): CharacterSkinManifest | 'loading' | null {
    const skinId = this.getSelectedSkinId(classToken)
    if (!skinId) return null
    const cached = this.customPackages.get(skinId)?.manifest ?? this.manifestCache.get(skinId)
    if (cached) return cached
    if (this.manifestFailed.has(skinId)) return null
    void this.loadManifest(skinId).catch(() => null)
    return 'loading'
  }

  /** Mesh skin runtimes of every live renderer (diagnostics / verification tooling). */
  listMeshSkinRuntimes(): readonly MeshSkinRuntime[] {
    const out: MeshSkinRuntime[] = []
    for (const renderer of this.liveRenderers) {
      const cache = renderer.isDisposed ? undefined : this.meshCaches.get(renderer)
      if (cache) out.push(cache)
    }
    return out
  }

  /** Mesh skin runtime (impostor renderer + playback state) for `renderer`. */
  getMeshSkinRuntime(renderer: SpriteRenderer): MeshSkinRuntime {
    return this.getOrCreateMeshCache(renderer)
  }

  private getOrCreateMeshCache(renderer: SpriteRenderer): PerRendererMeshSkinCache {
    let cache = this.meshCaches.get(renderer)
    if (!cache) {
      cache = new PerRendererMeshSkinCache(renderer)
      this.meshCaches.set(renderer, cache)
      this.liveRenderers.add(renderer)
    }
    return cache
  }

  /**
   * Synchronous render-loop lookup for a mesh skin unit of the class's selected skin: the hero
   * (`minionKey === null`) or one bundled summon. Downloads and uploads only that unit's model on
   * first miss. Returns `null` for sprite skins, unknown minions and failed loads.
   */
  getMeshSkinUnit(
    renderer: SpriteRenderer,
    classToken: PlayerClassToken,
    minionKey: string | null,
  ): LoadedMeshSkinUnit | 'loading' | null {
    if (!this.config.enabled) return null
    if (minionKey !== null && !this.config.minionsEnabled) return null
    const skinId = this.getSelectedSkinId(classToken)
    if (!skinId) return null
    const manifest = this.peekSelectedManifest(classToken)
    if (manifest === 'loading') return 'loading'
    if (manifest === null || manifest.format !== 'mesh') return null
    const unitKey = minionKey === null ? MESH_SKIN_HERO_UNIT_KEY : minionKey.trim().toLowerCase()
    if (minionKey !== null && !manifest.minions?.[unitKey]?.mesh) return null
    const cache = this.getOrCreateMeshCache(renderer)
    const cacheKey = `${skinId}::${unitKey}`
    const ready = cache.getReady(cacheKey)
    if (ready) return ready
    if (cache.hasFailed(cacheKey)) return null
    void this.ensureMeshSkinUnit(renderer, skinId, minionKey === null ? null : unitKey)
    return 'loading'
  }

  /**
   * The model the selected mesh skin of `classToken` shows for the morph `morphToken` (`40`, `tg`,
   * ...), `'loading'` while it loads, or `null` when the skin has no model for that morph.
   */
  getMeshSkinMorphUnit(
    renderer: SpriteRenderer,
    classToken: PlayerClassToken,
    morphToken: string,
  ): LoadedMeshSkinUnit | 'loading' | null {
    if (!this.config.enabled) return null
    const skinId = this.getSelectedSkinId(classToken)
    if (!skinId) return null
    const manifest = this.peekSelectedManifest(classToken)
    if (manifest === 'loading') return 'loading'
    const token = morphToken.trim().toLowerCase()
    if (manifest === null || manifest.format !== 'mesh' || !manifest.morphs?.[token]) return null
    const unitKey = `${MESH_SKIN_MORPH_UNIT_PREFIX}${token}`
    const cache = this.getOrCreateMeshCache(renderer)
    const cacheKey = `${skinId}::${unitKey}`
    const ready = cache.getReady(cacheKey)
    if (ready) return ready
    if (cache.hasFailed(cacheKey)) return null
    void this.ensureMeshSkinUnit(renderer, skinId, unitKey)
    return 'loading'
  }

  /**
   * Synchronous render-loop lookup for one weapon of a shared weapon pack (`<skins>/<pack>/`):
   * the uploaded model, `'loading'` while its index or file is being fetched (started on first
   * miss), or `null` when the pack has no model for `uniqueId` or it cannot be loaded.
   */
  getMeshSkinWeapon(renderer: SpriteRenderer, pack: string, uniqueId: number): LoadedMeshSkinWeapon | 'loading' | null {
    if (!this.config.enabled || !WEAPON_PACK_ID_PATTERN.test(pack)) return null
    const index = this.weaponPackIndexes.get(pack)
    if (index === undefined) {
      void this.loadWeaponPackIndex(pack)
      return 'loading'
    }
    if (index === 'loading') return 'loading'
    const entry = index?.get(uniqueId)
    if (!entry) return null
    const cache = this.getOrCreateMeshCache(renderer)
    const cacheKey = `${MESH_SKIN_WEAPON_KEY_PREFIX}${pack}::${String(uniqueId)}`
    const ready = cache.getReady<LoadedMeshSkinWeapon>(cacheKey)
    if (ready) return ready
    if (cache.hasFailed(cacheKey)) return null
    void cache.ensureLoaded<LoadedMeshSkinWeapon>(cacheKey, async (meshRenderer) => {
      if (!this.fetchFn) throw new Error('fetch is unavailable')
      const url = `${this.skinsBaseUrl}/${pack}/${entry.file}`
      const resp = await this.fetchFn(url)
      if (!resp.ok) throw new Error(`HTTP ${String(resp.status)} fetching ${url}`)
      const model = parseMeshSkinModel(new Uint8Array(await resp.arrayBuffer()))
      const decoded: DecodedSkinImage[] = []
      try {
        for (const img of model.images) decoded.push(await this.decodeMeshTexture(img.bytes, img.mimeType))
        if (renderer.isDisposed) return null
        const gpu = meshRenderer.uploadModel(
          model,
          decoded.map((d) => d.source as MeshSkinTextureSource),
        )
        return { gpu, hand: entry.hand }
      } finally {
        for (const d of decoded) d.close?.()
      }
    })
    return 'loading'
  }

  private async loadWeaponPackIndex(pack: string): Promise<void> {
    this.weaponPackIndexes.set(pack, 'loading')
    try {
      if (!this.fetchFn) throw new Error('fetch is unavailable')
      const url = `${this.skinsBaseUrl}/${pack}/weapons.json`
      const resp = await this.fetchFn(url, { cache: 'no-cache' })
      if (!resp.ok) throw new Error(`HTTP ${String(resp.status)} fetching ${url}`)
      this.weaponPackIndexes.set(pack, parseWeaponPackIndex(await resp.json()))
    } catch (err) {
      // No pack on this site: players keep the family models (and their quality glow).
      this.weaponPackIndexes.set(pack, null)
      console.warn(`[CharacterSkinService] Weapon pack "${pack}" is unavailable: ${(err as Error).message}`)
    }
  }

  ensureMeshSkinUnit(
    renderer: SpriteRenderer,
    skinId: string,
    minionKey: string | null,
  ): Promise<LoadedMeshSkinUnit | null> {
    const unitKey = minionKey === null ? MESH_SKIN_HERO_UNIT_KEY : minionKey.trim().toLowerCase()
    const cache = this.getOrCreateMeshCache(renderer)
    return cache.ensureLoaded(`${skinId}::${unitKey}`, async (meshRenderer) => {
      const manifest = await this.loadManifest(skinId)
      const morphSpec = unitKey.startsWith(MESH_SKIN_MORPH_UNIT_PREFIX)
        ? manifest.morphs?.[unitKey.slice(MESH_SKIN_MORPH_UNIT_PREFIX.length)]
        : undefined
      const minionSpec = minionKey === null || morphSpec ? undefined : manifest.minions?.[unitKey]
      const spec = minionKey === null ? manifest.mesh : (morphSpec?.mesh ?? minionSpec?.mesh)
      if (!spec) return null
      const model = parseMeshSkinModel(await this.loadSkinFileBytes(skinId, spec.file))
      const clips: Record<string, LoadedMeshSkinClip> = {}
      for (const [key, meta] of Object.entries(spec.clips)) {
        const clip = model.clips[meta.anim]
        if (!clip) {
          throw new Error(`clip "${key}" refers to animation "${meta.anim}" missing from ${spec.file}`)
        }
        clips[key] = { meta, clip }
      }
      const decoded: DecodedSkinImage[] = []
      try {
        for (const img of model.images) {
          decoded.push(await this.decodeMeshTexture(img.bytes, img.mimeType))
        }
        if (renderer.isDisposed) return null
        const gpu = meshRenderer.uploadModel(
          model,
          decoded.map((d) => d.source as MeshSkinTextureSource),
        )
        const owner = minionKey === null ? manifest : (morphSpec ?? minionSpec)
        return {
          skinId,
          unitKey,
          spec,
          model,
          gpu,
          clips,
          floating: owner !== undefined && 'floating' in owner && owner.floating === true,
          shadowOffsetY: owner !== undefined && 'shadowOffsetY' in owner ? (owner.shadowOffsetY ?? 0) : 0,
          shadowScale: owner?.shadowScale ?? 1,
        }
      } finally {
        for (const d of decoded) d.close?.()
      }
    })
  }

  private async loadSkinFileBytes(skinId: string, relFile: string): Promise<Uint8Array> {
    if (!isValidSkinRelativeFile(relFile)) {
      throw new Error(`Invalid skin relative asset file "${relFile}"`)
    }
    const custom = this.customPackages.get(skinId)
    if (custom) {
      const bytes = custom.files[relFile]
      if (!bytes) {
        throw new Error(`Missing custom skin file "${relFile}" in package "${skinId}"`)
      }
      return bytes
    }
    if (!this.fetchFn) {
      throw new Error('fetch is unavailable')
    }
    const baseDirUrl = this.resolveBuiltinDirUrl(skinId)
    const resp = await this.fetchFn(`${baseDirUrl}/${relFile}`)
    if (!resp.ok) {
      throw new Error(`HTTP ${String(resp.status)} fetching ${baseDirUrl}/${relFile}`)
    }
    return new Uint8Array(await resp.arrayBuffer())
  }

  private getOrCreateGpuCache(renderer: SpriteRenderer): PerRendererSkinAtlasCache {
    let cache = this.gpuCaches.get(renderer)
    if (!cache) {
      cache = new PerRendererSkinAtlasCache(renderer)
      this.gpuCaches.set(renderer, cache)
      this.liveRenderers.add(renderer)
    }
    return cache
  }

  /**
   * Synchronous render-loop lookup for an active skin on `(renderer, classToken)`.
   * Triggers background loading on first miss and returns `'loading'` until uploaded.
   */
  getCharacterSkinArt(
    renderer: SpriteRenderer,
    classToken: PlayerClassToken,
  ): LoadedCharacterSkinArt | 'loading' | null {
    const skinId = this.getSelectedSkinId(classToken)
    if (!skinId) return null
    const gpuCache = this.getOrCreateGpuCache(renderer)
    const ready = gpuCache.getReady(skinId)
    if (ready) return ready
    if (gpuCache.hasFailed(skinId)) return null
    void this.ensureCharacterSkinArt(renderer, skinId)
    return 'loading'
  }

  ensureCharacterSkinArt(
    renderer: SpriteRenderer,
    skinId: string,
  ): Promise<LoadedCharacterSkinArt | null> {
    const gpuCache = this.getOrCreateGpuCache(renderer)
    return gpuCache.ensureLoaded(skinId, async () => {
      const manifest = await this.loadManifest(skinId)
      if (manifest.format === 'mesh') {
        throw new Error('mesh skins have no sprite atlas (use getMeshSkinUnit)')
      }
      const pages = await Promise.all(
        manifest.pages.map(async (spec) => {
          const bytes = await this.loadSkinFileBytes(skinId, spec.file)
          return this.decodeImageBytes(bytes, spec.width, spec.height)
        }),
      )
      const glowPages = manifest.glowPages
        ? await Promise.all(
            manifest.glowPages.map(async (spec) => {
              const bytes = await this.loadSkinFileBytes(skinId, spec.file)
              return this.decodeImageBytes(bytes, spec.width, spec.height)
            }),
          )
        : undefined
      return {
        manifest,
        pages,
        ...(glowPages ? { glowPages } : {}),
      }
    })
  }

  /**
   * Synchronous render-loop lookup for a bundled minion skin (`manifest.minions[minionKey]`).
   * Downloads and uploads ONLY the requested minion's atlas pages on first miss.
   */
  getMinionSkinArt(
    renderer: SpriteRenderer,
    classToken: PlayerClassToken,
    minionKey: string,
  ): LoadedMinionSkinArt | 'loading' | null {
    if (!this.config.enabled || !this.config.minionsEnabled) return null
    const skinId = this.getSelectedSkinId(classToken)
    if (!skinId) return null
    const cleanKey = minionKey.trim().toLowerCase()
    const cachedManifest = this.customPackages.get(skinId)?.manifest ?? this.manifestCache.get(skinId)
    if (cachedManifest && !cachedManifest.minions?.[cleanKey]) {
      return null
    }
    const gpuCache = this.getOrCreateGpuCache(renderer)
    const ready = gpuCache.getReadyMinion(skinId, cleanKey)
    if (ready) return ready
    if (gpuCache.hasFailedMinion(skinId, cleanKey)) return null
    void this.ensureMinionSkinArt(renderer, skinId, cleanKey)
    return 'loading'
  }

  ensureMinionSkinArt(
    renderer: SpriteRenderer,
    skinId: string,
    minionKey: string,
  ): Promise<LoadedMinionSkinArt | null> {
    const cleanKey = minionKey.trim().toLowerCase()
    const gpuCache = this.getOrCreateGpuCache(renderer)
    return gpuCache.ensureMinionLoaded(skinId, cleanKey, async () => {
      const manifest = await this.loadManifest(skinId)
      const spec = manifest.minions?.[cleanKey]
      if (!spec || manifest.format === 'mesh') return null
      const pages = await Promise.all(
        spec.pages.map(async (pSpec) => {
          const bytes = await this.loadSkinFileBytes(skinId, pSpec.file)
          return this.decodeImageBytes(bytes, pSpec.width, pSpec.height)
        }),
      )
      const glowPages = spec.glowPages
        ? await Promise.all(
            spec.glowPages.map(async (pSpec) => {
              const bytes = await this.loadSkinFileBytes(skinId, pSpec.file)
              return this.decodeImageBytes(bytes, pSpec.width, pSpec.height)
            }),
          )
        : undefined
      return {
        spec,
        pages,
        ...(glowPages ? { glowPages } : {}),
      }
    })
  }

  /**
   * Synchronous metadata lookup for HUD summon labels & hover monster target bar.
   * Triggers background `skin.json` manifest fetch (without downloading atlas PNGs) on first miss.
   */
  getSelectedMinionSpec(
    classToken: PlayerClassToken,
    minionKey: string,
  ): CharacterSkinMinionSpec | null {
    if (!this.config.enabled || !this.config.minionsEnabled) return null
    const skinId = this.getSelectedSkinId(classToken)
    if (!skinId) return null
    const cleanKey = minionKey.trim().toLowerCase()
    const cachedManifest = this.customPackages.get(skinId)?.manifest ?? this.manifestCache.get(skinId)
    if (!cachedManifest) {
      void this.loadManifest(skinId).catch(() => null)
      return null
    }
    return cachedManifest.minions?.[cleanKey] ?? null
  }

  /**
   * Synchronous lookup for top-left HUD summon portrait image (`46x41` / `92x82`).
   * Lazily fetches and decodes ONLY the requested portrait PNG on first miss.
   */
  getMinionPortraitImage(
    classToken: PlayerClassToken,
    minionKey: string,
  ): MinionPortraitDrawable | null {
    if (!this.config.enabled || !this.config.minionsEnabled) return null
    const skinId = this.getSelectedSkinId(classToken)
    if (!skinId) return null
    const cleanKey = minionKey.trim().toLowerCase()
    const cacheKey = `${skinId}::${cleanKey}`
    const ready = this.portraitReady.get(cacheKey)
    if (ready) return ready.drawable
    if (this.portraitFailed.has(cacheKey)) return null
    void this.ensureMinionPortraitImage(skinId, cleanKey)
    return null
  }

  ensureMinionPortraitImage(
    skinId: string,
    minionKey: string,
  ): Promise<MinionPortraitDrawable | null> {
    const cleanKey = minionKey.trim().toLowerCase()
    const cacheKey = `${skinId}::${cleanKey}`
    const ready = this.portraitReady.get(cacheKey)
    if (ready) return Promise.resolve(ready.drawable)
    if (this.portraitFailed.has(cacheKey)) return Promise.resolve(null)
    const pending = this.portraitInflight.get(cacheKey)
    if (pending) return pending

    const p = (async (): Promise<MinionPortraitDrawable | null> => {
      try {
        const manifest = await this.loadManifest(skinId)
        const spec = manifest.minions?.[cleanKey]
        if (!spec?.portraitFile) {
          this.portraitFailed.add(cacheKey)
          return null
        }
        const bytes = await this.loadSkinFileBytes(skinId, spec.portraitFile)
        const decoded = await this.decodeImageBytes(bytes, 92, 82)
        if ('pixels' in decoded.source) {
          if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
            const canvas = document.createElement('canvas')
            canvas.width = decoded.width
            canvas.height = decoded.height
            const ctx2d = canvas.getContext('2d')
            if (ctx2d) {
              const clamped = new Uint8ClampedArray(decoded.source.pixels.byteLength)
              clamped.set(decoded.source.pixels)
              ctx2d.putImageData(new ImageData(clamped, decoded.width, decoded.height), 0, 0)
            }
            this.portraitReady.set(cacheKey, { drawable: canvas })
            this.notifyListeners()
            return canvas
          }
          const stubDrawable = {
            width: decoded.width,
            height: decoded.height,
          } as unknown as MinionPortraitDrawable
          this.portraitReady.set(cacheKey, {
            drawable: stubDrawable,
            ...(decoded.close ? { close: () => decoded.close?.() } : {}),
          })
          this.notifyListeners()
          return stubDrawable
        }
        const bmp = decoded.source as MinionPortraitDrawable
        this.portraitReady.set(cacheKey, {
          drawable: bmp,
          ...(decoded.close ? { close: () => decoded.close?.() } : {}),
        })
        this.notifyListeners()
        return bmp
      } catch (err) {
        this.portraitFailed.add(cacheKey)
        console.warn(
          `[CharacterSkinService] Failed to load minion portrait "${skinId}/${cleanKey}": ${(err as Error).message}`,
        )
        return null
      } finally {
        this.portraitInflight.delete(cacheKey)
      }
    })()

    this.portraitInflight.set(cacheKey, p)
    return p
  }

  /**
   * Synchronous peek for character-select 2D campfire rendering (`frontend-renderer.ts`).
   */
  getReadySkinAvatar(classToken: PlayerClassToken): SkinAvatarComposite | undefined {
    const skinId = this.getSelectedSkinId(classToken)
    if (!skinId) return undefined
    return this.avatarReady.get(skinId)
  }

  /**
   * Async 2D campfire avatar builder (composites direction-0 TN/NU + additive glow onto a 2D canvas).
   */
  ensureSkinAvatar(classToken: PlayerClassToken): Promise<SkinAvatarComposite | null> {
    const skinId = this.getSelectedSkinId(classToken)
    if (!skinId) return Promise.resolve(null)
    const existing = this.avatarReady.get(skinId)
    if (existing) return Promise.resolve(existing)
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return Promise.resolve(null)
    }
    const pending = this.avatarInflight.get(skinId)
    if (pending) return pending

    const p = (async (): Promise<SkinAvatarComposite | null> => {
      const decodedMain: DecodedSkinImage[] = []
      const decodedGlow: DecodedSkinImage[] = []
      try {
        const manifest = await this.loadManifest(skinId)
        if (manifest.format === 'mesh') return null
        const clipKey = resolveSkinClipKey(classToken, 'tn', manifest.clips)
        if (!clipKey) return null
        const clip = manifest.clips[clipKey]
        if (!clip) return null
        const group = manifest.groups[clip.group]
        if (!group || group.length === 0) return null

        for (const spec of manifest.pages) {
          const bytes = await this.loadSkinFileBytes(skinId, spec.file)
          decodedMain.push(await this.decodeImageBytes(bytes, spec.width, spec.height))
        }
        if (manifest.glowPages && manifest.glowGroups) {
          for (const spec of manifest.glowPages) {
            const bytes = await this.loadSkinFileBytes(skinId, spec.file)
            decodedGlow.push(await this.decodeImageBytes(bytes, spec.width, spec.height))
          }
        }

        const glowClipKey = manifest.glowClips
          ? resolveSkinClipKey(classToken, clipKey, manifest.glowClips)
          : null
        const glowClip = glowClipKey && manifest.glowClips ? manifest.glowClips[glowClipKey] : null
        const glowGroup =
          glowClip && manifest.glowGroups ? manifest.glowGroups[glowClip.group] : manifest.glowGroups?.[clip.group]

        const maxFrameW = Math.max(1, ...group.map((t) => t[2]))
        const maxFrameH = Math.max(1, ...group.map((t) => t[3]))
        const cols = Math.min(8, group.length)
        const rows = Math.ceil(group.length / cols)
        const sheet = document.createElement('canvas')
        sheet.width = cols * (maxFrameW + 2)
        sheet.height = rows * (maxFrameH + 2)
        const ctx = sheet.getContext('2d')
        if (!ctx) return null

        const scale = manifest.renderScale ?? 1
        const frames: SkinAvatarCompositeFrame[] = []

        for (let i = 0; i < group.length; i += 1) {
          const [sx, sy, sw, sh, ax = -sw / 2, ay = -sh, pageIdx = 0] = group[i]!
          const dstX = (i % cols) * (maxFrameW + 2)
          const dstY = Math.floor(i / cols) * (maxFrameH + 2)
          const mainImg = decodedMain[pageIdx] ?? decodedMain[0]
          if (mainImg && 'width' in mainImg.source && !('pixels' in mainImg.source)) {
            ctx.globalCompositeOperation = 'source-over'
            ctx.drawImage(mainImg.source, sx, sy, sw, sh, dstX, dstY, sw, sh)
          }
          const gTuple = glowGroup?.[i]
          if (gTuple && decodedGlow.length > 0) {
            const [gx, gy, gw, gh, gax = ax, gay = ay, gPageIdx = 0] = gTuple
            const glowImg = decodedGlow[gPageIdx] ?? decodedGlow[0]
            if (glowImg && 'width' in glowImg.source && !('pixels' in glowImg.source)) {
              ctx.save()
              ctx.globalCompositeOperation = 'lighter'
              ctx.drawImage(
                glowImg.source,
                gx,
                gy,
                gw,
                gh,
                dstX + (gax - ax),
                dstY + (gay - ay),
                gw,
                gh,
              )
              ctx.restore()
            }
          }
          frames.push({
            x: dstX,
            y: dstY,
            w: sw,
            h: sh,
            drawW: Math.max(1, Math.round(sw * scale)),
            drawH: Math.max(1, Math.round(sh * scale)),
            anchorX: Math.round(ax * scale),
            anchorY: Math.round(ay * scale),
          })
        }

        const result: SkinAvatarComposite = { skinId, sheet, frames }
        this.avatarReady.set(skinId, result)
        return result
      } catch {
        return null
      } finally {
        for (const img of decodedMain) img.close?.()
        for (const img of decodedGlow) img.close?.()
        this.avatarInflight.delete(skinId)
      }
    })()

    this.avatarInflight.set(skinId, p)
    return p
  }
}

let globalSkinService: CharacterSkinService | null = null

export function getGlobalCharacterSkinService(): CharacterSkinService {
  if (globalSkinService === null) {
    globalSkinService = new CharacterSkinService()
  }
  return globalSkinService
}

export function setGlobalCharacterSkinServiceForTest(service: CharacterSkinService | null): void {
  globalSkinService = service
}

const MODAL_OVERLAY_ID = 'd2-skin-manager-modal-overlay'
let activeModalCleanup: (() => void) | null = null

export function closeCharacterSkinManagerModal(): void {
  if (activeModalCleanup !== null) {
    const fn = activeModalCleanup
    activeModalCleanup = null
    fn()
  }
}

/**
 * Opens an in-page D2-styled modal dialog allowing users to drag-and-drop / select
 * `.d2skin.zip` custom skin packages, assign skins to any of the 7 playable classes,
 * preview thumbnails, and delete custom packages stored in IndexedDB.
 */
export function openCharacterSkinManagerModal(
  service: CharacterSkinService = getGlobalCharacterSkinService(),
  onStatusToast?: (msg: { readonly zh: string; readonly en: string }, isError?: boolean) => void,
): void {
  if (typeof document === 'undefined' || !document.body) return
  closeCharacterSkinManagerModal()
  const existing = document.getElementById(MODAL_OVERLAY_ID)
  if (existing) existing.remove()

  const lang: GameLang = getGameLang()
  const t = (zh: string, en: string): string => (lang === 'en' ? en : zh)

  const overlay = document.createElement('div')
  overlay.id = MODAL_OVERLAY_ID
  overlay.setAttribute('data-d2-modal-overlay', 'skin-manager')
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:10050',
    'background:rgba(0,0,0,0.78)',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:16px',
    'font-family:"D2Formal436",sans-serif',
    'color:#d8ceb8',
  ].join(';')

  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.style.cssText = [
    'width:min(640px,96vw)',
    'max-height:86vh',
    'display:flex',
    'flex-direction:column',
    'background:#110f0c',
    'border:1px solid #6f5a38',
    'box-shadow:0 16px 48px rgba(0,0,0,0.92),inset 0 0 0 1px rgba(199,166,107,0.18)',
    'border-radius:4px',
    'overflow:hidden',
  ].join(';')

  const header = document.createElement('div')
  header.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #3a2f1d;background:#191510;'
  const titleEl = document.createElement('h3')
  titleEl.style.cssText = 'margin:0;font-family:"D2Exocet",serif;font-size:16px;color:#c7b377;letter-spacing:0.5px;'
  titleEl.textContent = t('职业皮肤管理与本地导入 (.d2skin.zip)', 'Character Skins & Local Import (.d2skin.zip)')
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.textContent = t('关闭', 'Close')
  closeBtn.style.cssText =
    'background:#261f16;color:#d8ceb8;border:1px solid #6f5a38;padding:4px 12px;cursor:pointer;border-radius:2px;font-size:12px;'
  header.append(titleEl, closeBtn)

  const body = document.createElement('div')
  body.style.cssText = 'padding:16px;overflow-y:auto;display:flex;flex-direction:column;gap:14px;'

  const dropZone = document.createElement('label')
  dropZone.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:6px',
    'padding:16px',
    'border:1px dashed #8a7046',
    'border-radius:4px',
    'background:#17130e',
    'cursor:pointer',
    'text-align:center',
  ].join(';')
  const dropTitle = document.createElement('div')
  dropTitle.style.cssText = 'color:#e2cf96;font-size:14px;font-weight:600;'
  dropTitle.textContent = t(
    '点击选择或将 .d2skin.zip 皮肤压缩包拖放到此处导入',
    'Click to choose or drag & drop a .d2skin.zip package here',
  )
  const dropHint = document.createElement('div')
  dropHint.style.cssText = 'color:#998c74;font-size:12px;'
  dropHint.textContent = t(
    '仅保存在本地浏览器 IndexedDB，不上传服务器；关闭插件立即恢复 1.13c 原版外观',
    'Saved locally in browser IndexedDB only (never uploaded). Disabling the plugin restores 1.13c vanilla.',
  )
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = '.zip,.d2skin'
  fileInput.style.display = 'none'
  dropZone.append(dropTitle, dropHint, fileInput)

  const feedbackEl = document.createElement('div')
  feedbackEl.style.cssText = 'font-size:12px;min-height:16px;color:#8ad88a;'

  const classSection = document.createElement('div')
  classSection.style.cssText = 'display:flex;flex-direction:column;gap:8px;'

  const customListSection = document.createElement('div')
  customListSection.style.cssText = 'display:flex;flex-direction:column;gap:8px;'

  const renderContent = (): void => {
    classSection.innerHTML = ''
    customListSection.innerHTML = ''
    const secTitle = document.createElement('div')
    secTitle.style.cssText = 'color:#c7b377;font-size:13px;font-weight:600;border-bottom:1px solid #2d2417;padding-bottom:4px;'
    secTitle.textContent = t('各职业当前激活皮肤', 'Active Skin per Class')
    classSection.appendChild(secTitle)

    for (const cls of PLAYER_CLASS_TOKENS) {
      const options = service.getCatalogForClass(cls)
      const current = service.getConfig().selectedByClass[cls] ?? null
      const row = document.createElement('div')
      row.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 8px;background:#16120d;border:1px solid #2b2318;border-radius:3px;'
      const label = document.createElement('span')
      label.style.cssText = 'font-size:13px;color:#d8ceb8;'
      label.textContent = lang === 'en' ? CLASS_DISPLAY_NAMES[cls].en : CLASS_DISPLAY_NAMES[cls].zh

      const rightWrap = document.createElement('div')
      rightWrap.style.cssText = 'display:flex;align-items:center;gap:8px;'
      if (current) {
        const prevUrl = service.getPreviewUrl(current)
        if (prevUrl) {
          const thumb = document.createElement('img')
          thumb.src = prevUrl
          thumb.alt = current
          thumb.style.cssText =
            'width:28px;height:28px;object-fit:contain;background:#0b0907;border:1px solid #4a3b25;border-radius:2px;image-rendering:pixelated;'
          rightWrap.appendChild(thumb)
        }
      }

      const select = document.createElement('select')
      select.setAttribute('data-skin-class-select', cls)
      select.style.cssText =
        'background:#211b13;color:#e6dcc6;border:1px solid #5a482d;padding:4px 8px;border-radius:2px;font-size:12px;min-width:210px;'
      const noneOpt = document.createElement('option')
      noneOpt.value = ''
      noneOpt.textContent = t('原版 1.13c 外观 (Vanilla)', 'Vanilla 1.13c')
      select.appendChild(noneOpt)

      for (const opt of options) {
        const elOpt = document.createElement('option')
        elOpt.value = opt.id
        const tag = opt.source === 'custom' ? t(' [本地导入]', ' [Custom]') : ''
        elOpt.textContent = `${lang === 'en' ? opt.name.en : opt.name.zh}${tag}`
        select.appendChild(elOpt)
      }
      select.value = current ?? ''
      select.addEventListener('change', () => {
        service.setClassSkin(cls, select.value || null)
      })
      rightWrap.appendChild(select)
      row.append(label, rightWrap)
      classSection.appendChild(row)
    }

    const customEntries = service.getCatalog().filter((e) => e.source === 'custom')
    if (customEntries.length > 0) {
      const custTitle = document.createElement('div')
      custTitle.style.cssText =
        'color:#c7b377;font-size:13px;font-weight:600;border-bottom:1px solid #2d2417;padding-bottom:4px;margin-top:4px;'
      custTitle.textContent = t('已导入的本地皮肤包', 'Imported Local Skin Packages')
      customListSection.appendChild(custTitle)

      for (const entry of customEntries) {
        const row = document.createElement('div')
        row.style.cssText =
          'display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:#16120d;border:1px solid #2b2318;border-radius:3px;'
        const info = document.createElement('span')
        info.style.cssText = 'font-size:12px;color:#d8ceb8;'
        info.textContent = `${lang === 'en' ? entry.name.en : entry.name.zh} (${entry.id} · ${entry.targetClass.toUpperCase()})`
        const delBtn = document.createElement('button')
        delBtn.type = 'button'
        delBtn.textContent = t('移除', 'Remove')
        delBtn.style.cssText =
          'background:#3a1818;color:#f2b8b8;border:1px solid #7a3333;padding:2px 10px;cursor:pointer;border-radius:2px;font-size:12px;'
        delBtn.addEventListener('click', () => {
          void service.removeCustomSkin(entry.id)
        })
        row.append(info, delBtn)
        customListSection.appendChild(row)
      }
    }
  }

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    feedbackEl.style.color = '#d8ceb8'
    feedbackEl.textContent = t(`正在解析 ${file.name}...`, `Importing ${file.name}...`)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const entry = await service.importSkinZip(bytes, { activateForClass: true })
      const okZh = `导入成功：${entry.name.zh} (${entry.targetClass.toUpperCase()}) 已立即启用`
      const okEn = `Imported & activated: ${entry.name.en} (${entry.targetClass.toUpperCase()})`
      feedbackEl.style.color = '#8ad88a'
      feedbackEl.textContent = lang === 'en' ? okEn : okZh
      onStatusToast?.({ zh: okZh, en: okEn }, false)
    } catch (err) {
      const errMsg = (err as Error).message
      const failZh = `导入失败：${errMsg}`
      const failEn = `Import failed: ${errMsg}`
      feedbackEl.style.color = '#ff8a8a'
      feedbackEl.textContent = lang === 'en' ? failEn : failZh
      onStatusToast?.({ zh: failZh, en: failEn }, true)
    }
  }

  fileInput.addEventListener('change', () => {
    void handleFile(fileInput.files?.[0])
    fileInput.value = ''
  })
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault()
    dropZone.style.borderColor = '#e2cf96'
  })
  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '#8a7046'
  })
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault()
    dropZone.style.borderColor = '#8a7046'
    void handleFile(e.dataTransfer?.files?.[0])
  })

  const unsub = service.subscribe(() => renderContent())
  const cleanup = (): void => {
    if (activeModalCleanup === cleanup) {
      activeModalCleanup = null
    }
    unsub()
    window.removeEventListener('keydown', onKeyDown, true)
    closeModalDomOverlay(overlay)
    overlay.remove()
  }
  activeModalCleanup = cleanup
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopImmediatePropagation()
      cleanup()
    }
  }
  closeBtn.addEventListener('click', cleanup)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup()
  })
  window.addEventListener('keydown', onKeyDown, true)

  body.append(dropZone, feedbackEl, classSection, customListSection)
  dialog.append(header, body)
  overlay.appendChild(dialog)
  document.body.appendChild(overlay)
  openModalDomOverlay(overlay)

  void service.ensureCatalogLoaded().then(() => renderContent())
  renderContent()
}
