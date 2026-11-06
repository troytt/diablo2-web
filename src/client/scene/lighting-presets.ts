import type { CollisionGrid } from '../../common/world/d2map.ts'
import type { AmbientLight } from '../../common/world/ambient-light.ts'
import {
  createLightModeState,
  createLightShadowScratch,
  d2Rand,
  LIGHT_GRID_SIZE,
  LIGHT_MAX_RADIUS,
  LIGHT_SEED_HI,
  LightFpsCounter,
  LightList,
  lightPos8,
  PLAYER_LIGHT_RADIUS,
  selectLightMode,
  tileTypeToLightDirection113c,
  unitDrawEntryPos8,
  WALL_LIGHT_OFFSETS_DEFAULT_113C,
  WALL_LIGHT_OFFSETS_FADED_113C,
  WALL_LIGHT_SAMPLE_COUNTS_113C,
  type D2Seed,
  type LightAmbient,
  type LightCollisionAt,
  type LightGrid,
  type LightModeState,
  type LightQuality,
  type LightRecord,
  type LightShadowScratch,
} from '../../common/drlg/light-grid.ts'
import { getTblLang, type TblLang } from '../i18n/lang.ts'

export type ClientLightingPreset =
  | 'auto'
  | 'noon'
  | 'dusk'
  | 'night'
  | 'torch'
  | 'cold'
  | 'fullbright'

export type LightingPreset =
  | ClientLightingPreset
  | 'morning'
  | 'sunset'
  | 'cave'
  | 'hell'
  | 'eclipse'
  | 'off'

/**
 * A lighting preset. `auto` is the 1.13c pipeline. Every other preset is a PORT-ONLY debug override, not 1.13c:
 * `overrideAmbient` replaces the room-ambient prefill of the whole grid (the lights still blend on top), and a disabled
 * preset (`off`, `fullbright`) turns the light grid off.
 */
export interface LightingPresetConfig {
  readonly id: LightingPreset
  readonly labelZh: string
  readonly labelEn: string
  readonly enabled: boolean
  readonly overrideAmbient?: {
    readonly intensity: number
    readonly red: number
    readonly green: number
    readonly blue: number
  }
}

export const CLIENT_LIGHTING_PRESET_ORDER: readonly ClientLightingPreset[] = [
  'auto',
  'noon',
  'dusk',
  'night',
  'torch',
  'cold',
  'fullbright',
] as const

const BASE_LIGHTING_PRESETS = {
  auto: {
    id: 'auto' as const,
    labelZh: '自动 (原版 1.13c)',
    labelEn: 'Auto (Original 1.13c)',
    enabled: true,
  },
  noon: {
    id: 'noon' as const,
    labelZh: '正午 (明亮日光)',
    labelEn: 'Noon (Bright Daylight)',
    enabled: true,
    overrideAmbient: { intensity: 255, red: 255, green: 255, blue: 255 },
  },
  morning: {
    id: 'morning' as const,
    labelZh: '清晨 (晨曦暖金)',
    labelEn: 'Morning (Warm Dawn)',
    enabled: true,
    overrideAmbient: { intensity: 190, red: 225, green: 198, blue: 145 },
  },
  sunset: {
    id: 'sunset' as const,
    labelZh: '黄昏 (暮色紫金)',
    labelEn: 'Sunset (Dusk Purple-Gold)',
    enabled: true,
    overrideAmbient: { intensity: 145, red: 210, green: 155, blue: 198 },
  },
  night: {
    id: 'night' as const,
    labelZh: '午夜 (幽暗蓝月)',
    labelEn: 'Midnight (Moonlit Blue)',
    enabled: true,
    overrideAmbient: { intensity: 38, red: 115, green: 140, blue: 240 },
  },
  cave: {
    id: 'cave' as const,
    labelZh: '深渊地牢 (火炬暗黑)',
    labelEn: 'Deep Dungeon (Torchlight)',
    enabled: true,
    overrideAmbient: { intensity: 5, red: 185, green: 175, blue: 165 },
  },
  hell: {
    id: 'hell' as const,
    labelZh: '地狱血月 (第四幕猩红)',
    labelEn: 'Hell Blood Moon (Act IV Crimson)',
    enabled: true,
    overrideAmbient: { intensity: 72, red: 255, green: 62, blue: 52 },
  },
  eclipse: {
    id: 'eclipse' as const,
    labelZh: '蚀日之咒 (幽蓝暗蚀)',
    labelEn: 'Solar Eclipse (Dark Blue)',
    enabled: true,
    overrideAmbient: { intensity: 28, red: 45, green: 85, blue: 245 },
  },
  off: {
    id: 'off' as const,
    labelZh: '关闭光照 (全亮无光影)',
    labelEn: 'Lighting Off (Full Bright)',
    enabled: false,
  },
}

Object.defineProperties(BASE_LIGHTING_PRESETS, {
  dusk: {
    enumerable: false,
    configurable: false,
    writable: false,
    value: {
      id: 'dusk',
      labelZh: '黄昏 (暮色暖紫)',
      labelEn: 'Dusk (Twilight Gold)',
      enabled: true,
      overrideAmbient: { intensity: 145, red: 210, green: 155, blue: 198 },
    } satisfies LightingPresetConfig,
  },
  torch: {
    enumerable: false,
    configurable: false,
    writable: false,
    value: {
      id: 'torch',
      labelZh: '火炬 (地牢暖火)',
      labelEn: 'Torch (Dungeon Warmth)',
      enabled: true,
      overrideAmbient: { intensity: 14, red: 220, green: 175, blue: 120 },
    } satisfies LightingPresetConfig,
  },
  cold: {
    enumerable: false,
    configurable: false,
    writable: false,
    value: {
      id: 'cold',
      labelZh: '寒冰 (幽蓝冰窟)',
      labelEn: 'Cold (Icy Cavern)',
      enabled: true,
      overrideAmbient: { intensity: 48, red: 95, green: 160, blue: 255 },
    } satisfies LightingPresetConfig,
  },
  fullbright: {
    enumerable: false,
    configurable: false,
    writable: false,
    value: {
      id: 'fullbright',
      labelZh: '全亮 (无阴影)',
      labelEn: 'Fullbright (No Shadows)',
      enabled: false,
      overrideAmbient: { intensity: 255, red: 255, green: 255, blue: 255 },
    } satisfies LightingPresetConfig,
  },
})

export const LIGHTING_PRESETS = BASE_LIGHTING_PRESETS as unknown as Readonly<
  Record<LightingPreset, LightingPresetConfig>
>

export function lightingLabel(
  cfg: LightingPresetConfig,
  lang: TblLang = getTblLang(),
): string {
  return lang === 'ENG' ? cfg.labelEn : cfg.labelZh
}

export function normalizeLightingPreset(raw: string | null | undefined): LightingPreset {
  const clean = (raw ?? '').trim().toLowerCase()
  if (clean === '0' || clean === 'false' || clean === 'off' || clean === 'none') return 'off'
  if (clean === 'fullbright' || clean === 'full') return 'fullbright'
  if (clean === '1' || clean === 'true' || clean === 'auto' || clean === '') return 'auto'
  if (clean in LIGHTING_PRESETS) return clean as LightingPreset
  return 'auto'
}

/**
 * An object light as #827 reports it: the drawn radius and colour at the object's sub-tile. It is the scene's
 * object-light snapshot (`BuildSceneDrawablesResult.pointLights`); the light grid consumes {@link LightEmitterInput}.
 */
export interface PointLightInput {
  readonly subTileX: number
  readonly subTileY: number
  readonly radius: number
  readonly intensity: number
  readonly r: number
  readonly g: number
  readonly b: number
}

/**
 * One light record the scene wants this frame (SPEC #830 §6). The lighting pass keeps a persistent 1.13c light list
 * and reconciles it with these inputs by `(unitType, unitId, slot)`:
 * - a new key → CreateLight 0x6fb58c20 (inserted at the list head), then SetTargetRadius 0x6fb58be0 if given;
 * - every build → the record takes the emitter position (LightUpdate's owner lookup, 0x6fb59b50);
 * - a vanished key → Kill 0x6fb585f0 (`fadeOnRemove`: fades 8 per build at its last position) or Free 0x6fb58630.
 */
export interface LightEmitterInput {
  /** 1.13c owner unit type: 0 player, 1 monster, 2 object, 3 missile, 4 item, 5 tile. */
  readonly unitType: number
  readonly unitId: number
  /** Distinguishes several lights of one unit (`unit`, `ov:<overlayId>`, `state:<stateId>:<token>`, …). */
  readonly slot: string
  /** 0: shadowed in mode 2; 1: never shadowed; 2: cached occlusion (objects). */
  readonly lightType: 0 | 1 | 2
  /** Position in x8 units: `lightPos8(precise)` for dynamic units, `sub * 8 + 4` for static ones. */
  readonly x8: number
  readonly y8: number
  /**
   * CreateLight radius in sub-tiles (≤ 0 → no light). Type 2 records also mirror it on every build: #827 already
   * eases an object light's radius once per game frame exactly like LightUpdate, so a changed value is applied with
   * SetRadius (which invalidates the occlusion cache, like every LightUpdate step of a type-2 light).
   */
  readonly radius: number
  /** SetTargetRadius right after CreateLight (overlays: InitRadius → Radius, 0x6fb1b4e0). */
  readonly targetRadius?: number | undefined
  readonly red: number
  readonly green: number
  readonly blue: number
  /** Missiles.txt Flicker (0x6fb60df0): once `r >> 3 >= radius`, target = radius + RAND(seed, flicker) per update. */
  readonly flicker?: number | undefined
  /** Kill instead of Free when the emitter disappears (missile end, 0x6fb616c9 / 0x6fb6177b). */
  readonly fadeOnRemove?: boolean | undefined
  /** Created only at Light Quality 2 (missile units, 0x6fb63647); never created later for the same key. */
  readonly requiresHighQuality?: boolean | undefined
  /**
   * Identity of the owner's light allocation (#827 `ClientUnit.objectLight`): a new identity frees the record and
   * creates a new one (SetObjectLight's Free + CreateLight), which moves it to the list head.
   */
  readonly allocation?: object | undefined
  /** Stat 89 item_lightradius of the player: radius 13 + v, ≤ 0 → unchanged (0x6fac8bc0). */
  readonly playerLightRadiusBonus?: number | undefined
  /** Stat 90 item_lightcolor of the player: 0 → white, else 0xRRGGBB (0x6fac89a0). */
  readonly playerLightColor?: number | undefined
}

/** One near room's ambient light, in level-local sub-tiles (0x6fb59c90 near-room fill). */
export interface AmbientRoomRect {
  readonly subX: number
  readonly subY: number
  readonly subW: number
  readonly subH: number
  readonly ambient: AmbientLight
}

/** Ambient light of the local player's room and of its revealed near rooms (D2Client 0x6fb59c90). */
export interface LightingAmbientInputs {
  readonly playerRoom: AmbientLight
  /** Near rooms of the player's room, in list order, without the player's room itself. */
  readonly nearRooms: readonly AmbientRoomRect[]
}

/**
 * Engine-decoupled lighting inputs for online D2GS scenes. All positions are level-local sub-tiles.
 */
export interface LightingInputs {
  readonly preset: LightingPreset
  readonly levelId: number
  readonly collisionGrid: CollisionGrid
  /**
   * Local player position in the port convention (N.0 = centre of sub-tile N, i.e. D2 precise − 0.5). The grid
   * origin is its path sub-tile `floor(x + 0.5)` − 24 (0x6fb59e8e).
   */
  readonly playerSubTile: { readonly x: number; readonly y: number }
  /** `g_player->dwUnitId`. The local player light (type 0, 0x6fac92f5) exists only once it is known. */
  readonly playerUnitId?: number | undefined
  /** The lights of all other units (SPEC §6), in scene order. */
  readonly lightEmitters: readonly LightEmitterInput[]
  /** Client game frame (25 Hz). The grid is rebuilt at most once per new value (0x6fb3b1ac). */
  readonly tick: number
  /** Stat 89 item_lightradius of the local player: radius 13 + v, ≤ 0 → unchanged (0x6fac8bc0). */
  readonly playerLightRadiusBonus?: number | undefined
  /** Stat 90 item_lightcolor of the local player: 0 → white, else 0xRRGGBB (0x6fac89a0). */
  readonly playerLightColor?: number | undefined
  /**
   * Room ambient light for the grid prefill, or `null` when the local player has no room (1.13c
   * then fills the whole grid with zeros, 0x6fb59e13).
   */
  readonly ambient: LightingAmbientInputs | null
}

/** What `SpriteRenderer.setLighting` receives. */
export interface LightingRendererParams {
  /** Sub-tile of texel (0, 0): the grid origin. */
  readonly originSubX: number
  readonly originSubY: number
  /** Scene pixel origin of the level (the collision grid's `originX` / `originY`). */
  readonly sceneOriginX: number
  readonly sceneOriginY: number
  /** RGBA8 48×48 grid texture ({@link LightGrid.exportTextureBuffer}); omitted when nothing changed since the upload. */
  readonly lightmap?: Uint8Array | undefined
}

export interface LightingPassTargets {
  readonly lightGrid: LightGrid
  readonly renderer: {
    setLighting(params: LightingRendererParams | null): void
  }
  /** The "Light Quality" option (registry string 0x6fb851f8): 0 low, 1 medium, 2 high (default, SPEC §11 Q7). */
  readonly lightQuality?: LightQuality | undefined
  /** Clock of the FPS counter and the mode hysteresis, in ms (`performance.now()` when omitted). */
  readonly nowMs?: number | undefined
}

export { LIGHT_SEED_HI, PLAYER_LIGHT_RADIUS }

/**
 * The flat light of one unit sprite (D2Client `0x6fb4f120` / `0x6fb4f2b0`): `GetLightAt` of the cell
 * `clamp((entry.x >> 3) − oX, 0, 47)` (likewise y), as the colour `T[I][C] / 255` with `T[I][C] = floor(I·C/255)` that
 * the renderer multiplies into the sprite tint.
 *
 * VERIFIED (SPEC #830 §11 Q1): `0x6fb2a180`, `0x6fb2a260`, and `0x6fb2a500` write `entry.x = pathSubX << 3`,
 * `entry.y = pathSubY << 3`, where `pathSub` is `D2Common.#10867` / `#10750` (`wPosX` / `wPosY`, integer sub-tile,
 * i.e. `floor(sub + 0.5)` in the port convention where `N.0` is D2 precise `N + 0.5`) for dynamic units (`dwUnitType`
 * 0 player, 1 monster, 3 missile) and `pStaticPath->dwPosX` / `dwPosY` (`floor(sub)`) for static units (`dwUnitType`
 * 2 object, 4 item, 5 tile).
 *
 * @param subX - level-local sub-tile position in the port convention.
 * @param dynamic - players, monsters and missiles (continuous positions); objects, items and tiles are static.
 */
export function unitFlatLight(grid: LightGrid, subX: number, subY: number, dynamic: boolean): [number, number, number] {
  const [x8, y8] = unitDrawEntryPos8(subX, subY, dynamic)
  const [i, r, g, b] = grid.getLightAt(x8, y8)
  return [Math.floor((i * r) / 255) / 255, Math.floor((i * g) / 255) / 255, Math.floor((i * b) / 255) / 255]
}

/**
 * Zero-allocation variant of {@link unitFlatLight} that writes the flat RGB tint into `out`.
 */
export function unitFlatLightInto(
  grid: LightGrid,
  subX: number,
  subY: number,
  dynamic: boolean,
  out: [number, number, number],
): [number, number, number] {
  const px = Math.floor(dynamic ? subX + 0.5 : subX)
  const py = Math.floor(dynamic ? subY + 0.5 : subY)
  const k = grid.cellIndexAt(px << 3, py << 3)
  const i = grid.intensity[k]!
  out[0] = Math.floor((i * grid.red[k]!) / 255) / 255
  out[1] = Math.floor((i * grid.green[k]!) / 255) / 255
  out[2] = Math.floor((i * grid.blue[k]!) / 255) / 255
  return out
}

export type MutableWallColumnTints = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
]

/**
 * The 6 vertex colours `[r, g, b]` (`0..1`, `T[I][C] / 255` with `T[I][C] = floor(I·C/255)`) for a wall/roof-decor
 * tile at `(cellX, cellY)` with DT1 orientation `tileType` (`nType` at `[tile+0x1c]`, mapped to `nLightDirection`
 * at `[pTileGfx+0x00]` via {@link tileTypeToLightDirection113c}), matching `0x6fb4e940` / `0x6fb4e970` /
 * `0x6fb4ec10` / `0x6fb4ee90` (`0x6fb80a70` count, `0x6fb8ed18` default / `0x6fb8eef8` faded when `[tile+0x24] & 1`)
 * and the 5-column horizontal Gouraud interpolation (`col = blockPosX >> 5`, left = `col`, right = `col + 1`) in
 * `D2Gdi.dll` (`0x6f875f0c`, `0x6f87602c`), `D2DDraw.dll` (`0x6f8c73dc`, `0x6f8c74fc`), `D2Direct3D.dll`
 * (`0x6f88e643–0x6f88e793`), and `D2Glide.dll` (`0x6f85690c–0x6f856a45`).
 *
 * Returns `null` when `WALL_LIGHT_SAMPLE_COUNTS_113C[lightDirection] === 0` (`nType === 15` roof).
 */
export function wallColumnTints113c(
  grid: LightGrid,
  cellX: number,
  cellY: number,
  tileType: number,
  faded = false,
  lightDirection?: number,
): readonly (readonly [number, number, number])[] | null {
  const lightDir = lightDirection ?? tileTypeToLightDirection113c(tileType)
  const samples = grid.sampleWallLights(cellX, cellY, lightDir, faded)
  if (samples.length === 0) return null
  return samples.map(
    ([i, r, g, b]) =>
      [Math.floor((i * r) / 255) / 255, Math.floor((i * g) / 255) / 255, Math.floor((i * b) / 255) / 255] as const,
  )
}

/**
 * Zero-allocation variant of {@link wallColumnTints113c} that writes the 6 column RGB tints directly into `out`.
 */
export function wallColumnTintsInto113c(
  grid: LightGrid,
  cellX: number,
  cellY: number,
  tileType: number,
  faded: boolean,
  lightDirection: number | undefined,
  out: MutableWallColumnTints,
): readonly (readonly [number, number, number])[] | null {
  const lightDir = lightDirection ?? tileTypeToLightDirection113c(tileType)
  if (!Number.isInteger(lightDir) || lightDir < 0 || lightDir >= WALL_LIGHT_SAMPLE_COUNTS_113C.length) {
    throw new RangeError(`lightDirection must be an integer 0..9, got ${String(lightDir)}`)
  }
  const count = WALL_LIGHT_SAMPLE_COUNTS_113C[lightDir]!
  if (count === 0) return null
  const entryX = (cellX * 5) << 3
  const entryY = (cellY * 5) << 3
  const offsets = (faded ? WALL_LIGHT_OFFSETS_FADED_113C : WALL_LIGHT_OFFSETS_DEFAULT_113C)[lightDir]!
  const intensity = grid.intensity
  const red = grid.red
  const green = grid.green
  const blue = grid.blue
  for (let s = 0; s < 6; s += 1) {
    const off = offsets[s]!
    const k = grid.cellIndexAt(entryX + off[0], entryY + off[1])
    const i = intensity[k]!
    const slot = out[s]!
    slot[0] = Math.floor((i * red[k]!) / 255) / 255
    slot[1] = Math.floor((i * green[k]!) / 255) / 255
    slot[2] = Math.floor((i * blue[k]!) / 255) / 255
  }
  return out
}

interface TrackedLight {
  rec: LightRecord | null
  allocation: object | undefined
  readonly fadeOnRemove: boolean
  /** Stand-in for the owner's `unit+0x20` seed (flicker RAND). */
  readonly seed: D2Seed
  /** Last radius / colour applied through the stat callbacks (local player only). */
  appliedRadius: number
  appliedColor: number
  seen: boolean
}

/** Persistent state of the lighting pass of one grid (the 1.13c light list and the LIGHTMAP_Build statics). */
export interface LightingPassState {
  readonly lights: LightList
  readonly tracked: Map<string, TrackedLight>
  readonly scratch: LightShadowScratch
  readonly modeState: LightModeState
  readonly fps: LightFpsCounter
  /** Game frame of the last grid build (0x6fb3b1ac compares the frame counter); −1 before the first. */
  lastBuiltTick: number
  /** Light mode used by the last build. */
  lastMode: 0 | 1 | 2
  /** Light quality of the last build (#940 R2 skip-gate input). */
  lastQuality: LightQuality
  levelId: number | null
  collisionMasks: Uint16Array | null
  /** The renderer that holds the current texture (re-upload for a new renderer even without a rebuild). */
  uploadedTo: object | null
  /** #940 R2 skip-gate state: origin / ambient / emitter signature of the last actually-built frame. */
  lastOriginSubX: number | null
  lastOriginSubY: number | null
  lastAmbientSig: string | null
  lastEmitterSig: string | null
  /** #940 R2 obstacle-raster cache key: (masks identity, origin, level). */
  obstacleMasks: Uint16Array | null
  obstacleOriginSubX: number | null
  obstacleOriginSubY: number | null
  obstacleLevelId: number | null
}

const passStates = new WeakMap<LightGrid, LightingPassState>()

/** The persistent pass state of `grid` (created on first use). */
export function getLightingPassState(grid: LightGrid): LightingPassState {
  let st = passStates.get(grid)
  if (st === undefined) {
    st = {
      lights: new LightList(),
      tracked: new Map(),
      scratch: createLightShadowScratch(),
      modeState: createLightModeState(),
      fps: new LightFpsCounter(),
      lastBuiltTick: -1,
      lastMode: 2,
      lastQuality: 2,
      levelId: null,
      collisionMasks: null,
      uploadedTo: null,
      lastOriginSubX: null,
      lastOriginSubY: null,
      lastAmbientSig: null,
      lastEmitterSig: null,
      obstacleMasks: null,
      obstacleOriginSubX: null,
      obstacleOriginSubY: null,
      obstacleLevelId: null,
    }
    passStates.set(grid, st)
  }
  return st
}

/**
 * Collision word reader for the light grid over a level collision grid: `undefined` (no room → blocked) outside it.
 * The obstacle test needs the real collision words (mask 0x22), so a grid without `collisionMasks` is an error.
 */
function collisionReader(grid: CollisionGrid): { readonly masks: Uint16Array; readonly at: LightCollisionAt } {
  const masks = grid.collisionMasks
  if (masks === undefined) {
    throw new Error('light grid obstacles need collision words (#10482, mask 0x22); the collision grid has no collisionMasks')
  }
  const width = grid.gridWidth
  const height = masks.length / width
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height)) {
    throw new RangeError(`collision grid of ${String(masks.length)} words is not ${String(width)} sub-tiles wide`)
  }
  return {
    masks,
    at: (subX, subY) => (subX < 0 || subY < 0 || subX >= width || subY >= height ? undefined : masks[subY * width + subX]),
  }
}

function emitterKey(unitType: number, unitId: number, slot: string): string {
  return `${String(unitType)}:${String(unitId)}:${slot}`
}

/** Frees every record and forgets every owner (a new game: the client frame counter restarted). */
function resetPass(st: LightingPassState): void {
  st.lights.clear()
  st.tracked.clear()
  st.fps.reset()
  st.lastBuiltTick = -1
  st.levelId = null
  st.collisionMasks = null
  st.lastOriginSubX = null
  st.lastOriginSubY = null
  st.lastAmbientSig = null
  st.lastEmitterSig = null
  st.obstacleMasks = null
  st.obstacleOriginSubX = null
  st.obstacleOriginSubY = null
  st.obstacleLevelId = null
}

/** #940 R2: ambient prefill signature (player room + near rooms, values included). */
function ambientSignature(inputs: LightingInputs): string {
  const a = inputs.ambient
  if (a === null) return 'null'
  const room = (r: LightAmbient): string => `${r.intensity},${r.red},${r.green},${r.blue}`
  const near = a.nearRooms.map(r => `${r.subX},${r.subY},${r.subW},${r.subH},${room(r.ambient)}`).join(';')
  return `${room(a.playerRoom)}|${near}`
}

/**
 * #940 R2: stable numeric id for allocation identities (`#827 ClientUnit.objectLight`) so the
 * emitter signature can detect a SetObjectLight swap (Free + CreateLight moves the record to
 * the list head — a real content change even when every value matches).
 */
const allocationIds = new WeakMap<object, number>()
let nextAllocationId = 1
function allocationIdOf(allocation: object | undefined): number {
  if (allocation === undefined) return 0
  let id = allocationIds.get(allocation)
  if (id === undefined) {
    id = nextAllocationId++
    allocationIds.set(allocation, id)
  }
  return id
}

/**
 * #940 R2: static emitter signature — every field that changes the grid content, EXCEPT `flicker`
 * (flicker lights re-target every game frame once converged and are handled by the separate
 * "any flicker present → always rebuild" rule) and `fadeOnRemove` (removal changes the input list
 * itself, which changes this signature).
 */
function emitterStaticSignature(inputs: LightingInputs): string {
  const parts: string[] = []
  if (inputs.playerUnitId !== undefined) {
    parts.push(
      `p:${inputs.playerUnitId},${lightPos8(inputs.playerSubTile.x + 0.5)},${lightPos8(inputs.playerSubTile.y + 0.5)},${inputs.playerLightRadiusBonus ?? 0},${inputs.playerLightColor ?? 0}`,
    )
  }
  for (const e of inputs.lightEmitters) {
    parts.push(
      `${e.unitType}:${e.unitId}:${e.slot}:${e.lightType}:${e.x8},${e.y8}:${e.radius},${e.targetRadius ?? e.radius}:${e.red},${e.green},${e.blue}:${e.playerLightRadiusBonus ?? 0},${e.playerLightColor ?? 0}:a${allocationIdOf(e.allocation)}`,
    )
  }
  return parts.join('|')
}

/**
 * #940 R2 skip test: would rebuilding the grid this game frame change any cell? The rebuild is
 * skipped only when every input is byte-identical to the frame that was last actually built, no
 * flicker emitter exists (they legitimately animate every frame, 0x6fb60df0), and no record is
 * still animating (`LightList.isQuiescent`). This mirrors vanilla visual output exactly: a skip
 * happens precisely when the build would reproduce the identical grid.
 */
function lightGridFrameWouldChange(
  inputs: LightingInputs,
  st: LightingPassState,
  masks: Uint16Array,
  originSubX: number,
  originSubY: number,
  mode: 0 | 1 | 2,
  quality: LightQuality,
): boolean {
  if (st.lastBuiltTick < 0 || st.lastOriginSubX === null || st.lastOriginSubY === null) return true
  if (st.collisionMasks !== masks) return true
  if (st.lastOriginSubX !== originSubX || st.lastOriginSubY !== originSubY) return true
  if (st.lastMode !== mode) return true
  if (st.lastQuality !== quality) return true
  if (ambientSignature(inputs) !== st.lastAmbientSig) return true
  if (emitterStaticSignature(inputs) !== st.lastEmitterSig) return true
  for (const e of inputs.lightEmitters) {
    if ((e.flicker ?? 0) !== 0) return true
  }
  if (!st.lights.isQuiescent()) return true
  return false
}

/**
 * Creates the record of a new key, or re-creates it for a new allocation, and moves every live record to its
 * emitter. Returns the tracking entry.
 */
function trackEmitter(st: LightingPassState, quality: LightQuality, e: LightEmitterInput): TrackedLight {
  const key = emitterKey(e.unitType, e.unitId, e.slot)
  let t = st.tracked.get(key)
  if (t !== undefined && t.seen) throw new Error(`two lights claim the owner slot ${key}`)
  if (t !== undefined && t.allocation !== e.allocation) {
    if (t.rec !== null) st.lights.free(t.rec)
    st.tracked.delete(key)
    t = undefined
  }
  if (t === undefined) {
    const skip = e.requiresHighQuality === true && quality !== 2
    const rec = skip
      ? null
      : st.lights.create({ unitType: e.unitType, unitId: e.unitId }, e.lightType, e.radius, 255, e.red, e.green, e.blue, e.x8, e.y8)
    if (rec !== null && e.targetRadius !== undefined) st.lights.setTargetRadius(rec, e.targetRadius)
    t = {
      rec,
      allocation: e.allocation,
      fadeOnRemove: e.fadeOnRemove === true,
      seed: { lo: e.unitId >>> 0, hi: LIGHT_SEED_HI },
      appliedRadius: e.radius,
      appliedColor: 0,
      seen: false,
    }
    st.tracked.set(key, t)
  }
  t.seen = true
  const rec = t.rec
  if (rec === null) return t
  rec.x8 = e.x8
  rec.y8 = e.y8
  if (e.lightType === 2 && rec.r !== Math.min(e.radius, LIGHT_MAX_RADIUS) * 8) st.lights.setRadius(rec, e.radius)
  const flicker = e.flicker ?? 0
  if (flicker !== 0 && rec.r >> 3 >= e.radius) st.lights.setTargetRadius(rec, e.radius + d2Rand(t.seed, flicker))
  return t
}

/** Stat 89 / 90 callbacks of a player (0x6fac8bc0 SetRadius, 0x6fac89a0 SetColor). */
function applyPlayerStats(
  st: LightingPassState,
  t: TrackedLight,
  radiusBonus?: number | undefined,
  lightColor?: number | undefined,
): void {
  const rec = t.rec
  if (rec === null) return
  const radius = PLAYER_LIGHT_RADIUS + (radiusBonus ?? 0)
  if (radius !== t.appliedRadius) {
    st.lights.setRadius(rec, radius > 0 ? radius : 0)
    t.appliedRadius = radius
  }
  const color = (lightColor ?? 0) >>> 0
  if (color !== t.appliedColor) {
    if (color === 0) st.lights.setColor(rec, 255, 255, 255)
    else st.lights.setColor(rec, (color >>> 16) & 0xff, (color >>> 8) & 0xff, color & 0xff)
    t.appliedColor = color
  }
}

/** Light lifecycle for one build: the local player light first, then every emitter; vanished owners lose theirs. */
function reconcileLights(st: LightingPassState, quality: LightQuality, inputs: LightingInputs): void {
  for (const t of st.tracked.values()) t.seen = false
  const playerId = inputs.playerUnitId
  if (playerId !== undefined) {
    const p = inputs.playerSubTile
    const t = trackEmitter(st, quality, {
      unitType: 0,
      unitId: playerId,
      slot: 'unit',
      lightType: 0,
      x8: lightPos8(p.x + 0.5),
      y8: lightPos8(p.y + 0.5),
      radius: PLAYER_LIGHT_RADIUS,
      red: 255,
      green: 255,
      blue: 255,
    })
    applyPlayerStats(st, t, inputs.playerLightRadiusBonus, inputs.playerLightColor)
  }
  for (const e of inputs.lightEmitters) {
    const t = trackEmitter(st, quality, e)
    if (e.unitType === 0 && e.slot === 'unit') {
      applyPlayerStats(st, t, e.playerLightRadiusBonus, e.playerLightColor)
    }
  }
  for (const [key, t] of st.tracked) {
    if (t.seen) continue
    if (t.rec !== null) {
      if (t.fadeOnRemove) st.lights.kill(t.rec)
      else st.lights.free(t.rec)
    }
    st.tracked.delete(key)
  }
}

/** LIGHTMAP_Build 0x6fb59e30 for one new game frame (mode/origin/collision precomputed by the caller). */
function buildLightGrid(
  inputs: LightingInputs,
  targets: LightingPassTargets,
  st: LightingPassState,
  nowMs: number,
  mode: 0 | 1 | 2,
  collision: { readonly masks: Uint16Array; readonly at: LightCollisionAt },
  originSubX: number,
  originSubY: number,
): void {
  void nowMs
  const grid = targets.lightGrid
  if (st.levelId !== inputs.levelId) {
    // Port coordinates are level-local, so a level change moves the frame: dying records (which keep their last
    // position) are dropped and every occlusion cache is rebuilt.
    if (st.levelId !== null) {
      for (const l of [...st.lights]) if (l.dying) st.lights.free(l)
    }
    st.lights.invalidateOcclusionCaches()
    st.levelId = inputs.levelId
  }
  if (st.collisionMasks !== collision.masks) {
    st.lights.invalidateOcclusionCaches()
    st.collisionMasks = collision.masks
  }
  grid.setOrigin(originSubX, originSubY)
  const override = LIGHTING_PRESETS[inputs.preset].overrideAmbient
  if (override !== undefined) {
    // Port-only debug preset: a fixed prefill instead of the room ambient light.
    grid.fill(0, 0, LIGHT_GRID_SIZE - 1, LIGHT_GRID_SIZE - 1, override.intensity, override.red, override.green, override.blue)
  } else {
    grid.fillAmbient(inputs.ambient?.playerRoom ?? null, inputs.ambient?.nearRooms ?? [])
  }
  st.obstacleMasks = null
  if (
    st.obstacleMasks !== collision.masks ||
    st.obstacleOriginSubX !== originSubX ||
    st.obstacleOriginSubY !== originSubY ||
    st.obstacleLevelId !== inputs.levelId
  ) {
    grid.buildObstacles(collision.at)
    st.obstacleMasks = collision.masks
    st.obstacleOriginSubX = originSubX
    st.obstacleOriginSubY = originSubY
    st.obstacleLevelId = inputs.levelId
  }
  const quality = targets.lightQuality ?? 2
  reconcileLights(st, quality, inputs)
  st.lights.build(grid, mode, { collisionAt: collision.at, localPlayerId: inputs.playerUnitId ?? -1, scratch: st.scratch })
  st.lastMode = mode
}

/**
 * The 1.13c light grid pass from pure `LightingInputs` (SPEC #830 §4, §8.2). Call once per rendered world frame.
 *
 * The grid is rebuilt only when `inputs.tick` is a new game frame: room-ambient prefill (0x6fb59c90), obstacle flags
 * (0x6fb58880), light mode (0x6fb58800, FPS counted here), the light lifecycle, then every record newest first. The
 * texture is uploaded only after a rebuild. A disabled preset turns lighting off (port-only debug feature).
 *
 * @returns whether the scene is lit this frame.
 */
export function applyLightingInputs(inputs: LightingInputs, targets: LightingPassTargets): boolean {
  const presetCfg = LIGHTING_PRESETS[inputs.preset] ?? LIGHTING_PRESETS.auto
  const lightingEnabled = presetCfg.enabled && inputs.preset !== 'fullbright' && inputs.preset !== 'off'
  const { lightGrid, renderer } = targets
  const st = getLightingPassState(lightGrid)
  const nowMs = targets.nowMs ?? performance.now()
  st.fps.onFrameRendered(nowMs)

  if (!lightingEnabled) {
    renderer.setLighting(null)
    return false
  }
  if (!Number.isInteger(inputs.tick) || inputs.tick < 0) {
    throw new RangeError(`light grid tick must be a game frame number, got ${String(inputs.tick)}`)
  }
  if (inputs.tick < st.lastBuiltTick) resetPass(st)
  let rebuilt = false
  if (inputs.tick > st.lastBuiltTick) {
    // #940 R2: mode selection is hoisted above the skip gate (it depends on the
    // always-updated FPS counter and its own 2s hysteresis, not on the build).
    const collision = collisionReader(inputs.collisionGrid)
    const originSubX = Math.floor(inputs.playerSubTile.x + 0.5)
    const originSubY = Math.floor(inputs.playerSubTile.y + 0.5)
    const quality = targets.lightQuality ?? 2
    const mode = selectLightMode(quality, st.fps.fps, nowMs, st.modeState)
    if (lightGridFrameWouldChange(inputs, st, collision.masks, originSubX, originSubY, mode, quality)) {
      buildLightGrid(inputs, targets, st, nowMs, mode, collision, originSubX, originSubY)
      rebuilt = true
      st.lastOriginSubX = originSubX
      st.lastOriginSubY = originSubY
      st.lastAmbientSig = ambientSignature(inputs)
      st.lastEmitterSig = emitterStaticSignature(inputs)
      st.lastQuality = quality
    }
    st.lastBuiltTick = inputs.tick
  }
  const upload = rebuilt || st.uploadedTo !== renderer
  renderer.setLighting({
    originSubX: lightGrid.originSubX,
    originSubY: lightGrid.originSubY,
    sceneOriginX: inputs.collisionGrid.originX,
    sceneOriginY: inputs.collisionGrid.originY,
    ...(upload ? { lightmap: lightGrid.exportTextureBuffer() } : {}),
  })
  if (upload) st.uploadedTo = renderer
  return true
}
