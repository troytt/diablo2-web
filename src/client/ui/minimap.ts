/**
 * Diablo II v1.13c Isometric Sprite Automap & Minimap Renderer (`src/ui/minimap.ts`).
 *
 * Ground-truth implementation of `D2Client.dll` `0x6fb0f080..0x6fb12c28`:
 * - `AUTOMAP_LoadSprites` (`0x6fb11cc0`) & `AUTOMAP_DrawCell` (`0x6fb0f240`):
 *   8 DC6 sprite sheets (`MaxiMap`, `MaxiMapS`, `Act2Map`, `Act2MapS`, `Act4Map`, `Act4MapS`,
 *   `ExTnMap`, `ExTnMapS`) indexed by `AutomapAtlasSlot` (`0..3`) and `bMinimap` (`false`/`true`).
 * - `AUTOMAP_SetupViewportAndRender` (`0x6fae9e20`) & `AUTOMAP_RenderLayer` (`0x6fb10489`):
 *   Isometric projection with `nDivisor = bMinimap ? 20 : 10`, DC6 baseline anchor
 *   `drawLeft = screenX + frame.offsetX - (bMinimap ? 4 : 8)`,
 *   `drawTop = screenY - frame.height + frame.offsetY`,
 *   rendered in strict 4-layer order: `floors -> walls -> objects -> extras`.
 * - Dual Viewport Modes (`0x6fae9e20..0x6fb104d1`):
 *   - Corner Minimap (`bMinimap = true`, `nDivisor = 20`, default on start):
 *     Clipped `279×225` viewport at top-right `(screenWidth - 281, 57)`, shifting to
 *     top-left `(0, 75)` when a right-dock panel (Inventory/Skill Tree) is open.
 *   - Full-Screen Automap (`bMinimap = false`, `nDivisor = 10`):
 *     Covers `[0, 0, screenWidth, screenHeight]`, shifts center by `+(screenWidth >> 2)` when left
 *     panel is open or `-(screenWidth >> 2)` when right panel is open, and supports arrow-key panning
 *     (`±8px` per step) + `Home` reset.
 * - `AUTOMAP_UpdateVisibility` (`0x6fb12af0`) & `AUTOMAP_RevealRoom` (`0x6fb12580`):
 *   Octile distance threshold `max(|dx|, |dy|) * 2 + min(|dx|, |dy|) >= 160` sub-units,
 *   revealing the player's current room and adjacent 3×3 rooms into fog-of-war state.
 * - `AUTOMAP_DrawCrosshair` (`0x6fb11490`) & `AUTOMAP_CrosshairColors` (`0x6fabd390`):
 *   12-segment closed directional polygon crosshairs for Player (0x210), Party (0x213),
 *   Pets/Mercenaries (0x214/0x215), Friendly NPCs (0x216), and Player Corpses (0x212),
 *   plus active town portal sprites (`306`/`307`/`300`), warp destination
 *   `Font6` labels, and top-right right-aligned gold `Font16` Level Name + Difficulty readout.
 */

import type { AtlasFrame } from '../render/atlas.ts'
import type { AtlasHandle, SpriteRenderer } from '../render/renderer.ts'
import {
  AUTOMAP_UI_MANIFEST,
  type AutomapSpriteAtlasMeta,
  type AutomapSpriteFrameMeta,
  type AutomapSpriteKey,
} from '../../common/items/baked-ui-meta.ts'
import {
  type AutomapAtlasSlot,
  type AutomapCell,
  type AutomapLayerData,
  computeAutomapObjectPixelCoords,
  computeAutomapTilePixelCoords,
  getCrosshairSegments,
} from '../../common/formats/automap-table.ts'

export type { AutomapLayerData }
import { lookupTbl } from '../i18n/lang.ts'
import { reportMissingArt } from '../scene/world-renderer.ts'
import type { D2ColorCode, D2FontRenderer } from './font.ts'

export type AutomapCrosshairSegment = {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

/** Backward-compatible cell radius around the player. */
export const REVEAL_RADIUS = 9

/** DRLG room size in cells (8×8 tiles = 40×40 sub-tiles). */
export const ROOM_SIZE_CELLS = 8

/**
 * Octile distance threshold in sub-units before `AUTOMAP_UpdateVisibility` (`0x6fb12af0`)
 * triggers a room reveal pass (`>= 160` sub-units, where 1 tile = 5 sub-tiles = 80 sub-units).
 */
export const AUTOMAP_REVEAL_DISTANCE_THRESHOLD = 160

/** Arrow-key pan step in screen pixels when Full Automap (`bMinimap = false`) is open. */
export const AUTOMAP_PAN_STEP_PX = 8

/** 4-state fade alpha cycle (`F9`: `0 -> 1 -> 2 -> 3 -> 0`). */
export const AUTOMAP_FADE_ALPHAS = [1.0, 0.75, 0.5, 0.25] as const

const AUTOMAP_FADE_TINTS: readonly (readonly [number, number, number, number])[] = [
  [1, 1, 1, 1.0],
  [1, 1, 1, 0.75],
  [1, 1, 1, 0.5],
  [1, 1, 1, 0.25],
]

const COLOR_PLAYER = [0.0, 0.0, 1.0, 1.0] as const
const COLOR_RED = [1.0, 0.0, 0.0, 1.0] as const
const COLOR_CORPSE = [1.0, 0.0, 1.0, 1.0] as const
const COLOR_PARTY = [0.0, 1.0, 0.0, 1.0] as const
const COLOR_OWN_PET = [68 / 255, 112 / 255, 116 / 255, 1.0] as const
const COLOR_PARTY_PET = [72 / 255, 160 / 255, 52 / 255, 1.0] as const
const COLOR_NPC = [244 / 255, 244 / 255, 244 / 255, 1.0] as const
const COLOR_NEUTRAL = [128 / 255, 128 / 255, 128 / 255, 1.0] as const
const COLOR_PORTAL = [244 / 255, 244 / 255, 0.0, 1.0] as const

/**
 * Canonical 1.13c crosshair palette colors (`AUTOMAP_DrawCrosshair` @ `0x6fb11490`, `0x6fabd390`).
 */
export const AUTOMAP_CROSSHAIR_COLORS = {
  /** Player crosshair: Palette 0x210 (`RGB(0, 0, 255)`). */
  player: COLOR_PLAYER,
  /** Non-party player crosshair: Palette 0x211 (`RGB(255, 0, 0)`). */
  nonPartyPlayer: COLOR_RED,
  /** Player corpse crosshair: Palette 0x212 (`RGB(255, 0, 255)`). */
  corpse: COLOR_CORPSE,
  /** Party member / Ally crosshair: Palette 0x213 (`RGB(0, 255, 0)`). */
  party: COLOR_PARTY,
  /** Own pet / Mercenary crosshair: Palette 0x214 (`RGB(68, 112, 116)`). */
  ownPet: COLOR_OWN_PET,
  /** Mercenary crosshair alias. */
  mercenary: COLOR_OWN_PET,
  /** Party member pet crosshair: Palette 0x215 (`RGB(72, 160, 52)`). */
  partyPet: COLOR_PARTY_PET,
  /** Friendly Town/Quest NPC crosshair: Palette 0x216 (`RGB(244, 244, 244)`). */
  npc: COLOR_NPC,
  /** Neutral crosshair: Palette 0x217 (`RGB(128, 128, 128)`). */
  neutral: COLOR_NEUTRAL,
  /** Portal crosshair: Palette 0x218 (`RGB(244, 244, 0)`). */
  portal: COLOR_PORTAL,
  /** Valkyrie (357) / Iron Golem (291) crosshair: Palette 0x216 (`RGB(244, 244, 244)`). */
  valkyrieOrIronGolem: COLOR_NPC,
  /** Boss crosshair retained for test backward compatibility: Palette 0x211 (`RGB(255, 0, 0)`). */
  boss: COLOR_RED,
} as const

/**
 * MapHack (`d2hackmap.cfg`) monster tier crosshair colors (Issue #881).
 * Used only when `automapShowMonsters` is enabled via the `automap-reveal` plugin.
 */
export const AUTOMAP_MONSTER_COLORS = {
  /** Normal Monster (`Normal Monster Color` = red): `RGB(255, 0, 0)`. */
  monsterNormal: [1.0, 0.0, 0.0, 1.0] as const,
  /** Minion Monster (`Minion Monster Color` = orange-red): `RGB(255, 80, 0)`. */
  monsterMinion: [1.0, 80 / 255, 0.0, 1.0] as const,
  /** Champion (`Champion Monster Color` = royal blue): `RGB(80, 140, 255)`. */
  monsterChampion: [80 / 255, 140 / 255, 1.0, 1.0] as const,
  /** Unique / Boss (`Boss Monster Color` = unique gold): `RGB(216, 184, 100)`. */
  monsterUnique: [216 / 255, 184 / 255, 100 / 255, 1.0] as const,
  /** SuperUnique / Act Boss (`SuperUnique Color` = magenta/purple): `RGB(255, 64, 255)`. */
  monsterSuperUnique: [1.0, 64 / 255, 1.0, 1.0] as const,
} as const

export interface AutomapShrineBadgeSpec {
  readonly code: number
  readonly shortEn: string
  readonly shortZh: string
  readonly labelColor: D2ColorCode
  readonly markerColor: readonly [number, number, number, number]
  readonly overlayToken?: string | undefined
  readonly isDanger?: boolean | undefined
}

/**
 * MapHack-style shrine type badge specifications (`Shrines.txt` `Code 0..22`, Issue #881).
 */
export const AUTOMAP_SHRINE_BADGES: Readonly<Record<number, AutomapShrineBadgeSpec>> = Object.freeze({
  0: { code: 0, shortEn: 'Shrine', shortZh: '神殿', labelColor: 'yellow', markerColor: [1.0, 0.9, 0.25, 1.0] },
  1: { code: 1, shortEn: 'Refill', shortZh: '全满', labelColor: 'red', markerColor: [1.0, 0.3, 0.3, 1.0] },
  2: { code: 2, shortEn: 'HP', shortZh: '生命', labelColor: 'red', markerColor: [1.0, 0.25, 0.25, 1.0] },
  3: { code: 3, shortEn: 'MP', shortZh: '法力', labelColor: 'blue', markerColor: [0.35, 0.55, 1.0, 1.0] },
  4: { code: 4, shortEn: 'HPEx', shortZh: '换血', labelColor: 'red', markerColor: [0.95, 0.35, 0.55, 1.0] },
  5: { code: 5, shortEn: 'MPEx', shortZh: '换蓝', labelColor: 'blue', markerColor: [0.45, 0.45, 0.95, 1.0] },
  6: { code: 6, shortEn: 'Armor', shortZh: '防御', labelColor: 'blue', markerColor: [0.4, 0.85, 1.0, 1.0], overlayToken: 'shrine_armor' },
  7: { code: 7, shortEn: 'Combat', shortZh: '战斗', labelColor: 'blue', markerColor: [0.3, 0.95, 0.95, 1.0], overlayToken: 'shrine_combat' },
  8: { code: 8, shortEn: 'ResF', shortZh: '火抗', labelColor: 'red', markerColor: [1.0, 0.3, 0.2, 1.0], overlayToken: 'shrine_resist_fire' },
  9: { code: 9, shortEn: 'ResC', shortZh: '冰抗', labelColor: 'blue', markerColor: [0.35, 0.7, 1.0, 1.0], overlayToken: 'shrine_resist_cold' },
  10: { code: 10, shortEn: 'ResL', shortZh: '电抗', labelColor: 'yellow', markerColor: [1.0, 1.0, 0.3, 1.0], overlayToken: 'shrine_resist_lightning' },
  11: { code: 11, shortEn: 'ResP', shortZh: '毒抗', labelColor: 'green', markerColor: [0.2, 1.0, 0.3, 1.0], overlayToken: 'shrine_resist_poison' },
  12: { code: 12, shortEn: 'Skill', shortZh: '技能', labelColor: 'orange', markerColor: [1.0, 0.66, 0.0, 1.0], overlayToken: 'shrine_skill' },
  13: { code: 13, shortEn: 'ManaR', shortZh: '回蓝', labelColor: 'blue', markerColor: [0.45, 0.75, 1.0, 1.0], overlayToken: 'shrine_mana_regen' },
  14: { code: 14, shortEn: 'Stam', shortZh: '耐力', labelColor: 'white', markerColor: [0.95, 0.95, 0.95, 1.0], overlayToken: 'shrine_stamina' },
  15: { code: 15, shortEn: 'Exp', shortZh: '经验', labelColor: 'gold', markerColor: [1.0, 0.85, 0.25, 1.0], overlayToken: 'shrine_experience' },
  16: { code: 16, shortEn: 'Enirhs', shortZh: '辨视', labelColor: 'blue', markerColor: [0.3, 0.95, 0.95, 1.0] },
  17: { code: 17, shortEn: 'Portal', shortZh: '传送', labelColor: 'blue', markerColor: [0.25, 0.95, 1.0, 1.0] },
  18: { code: 18, shortEn: 'Gem', shortZh: '宝石', labelColor: 'purple', markerColor: [0.85, 0.25, 1.0, 1.0] },
  19: { code: 19, shortEn: 'Fire!', shortZh: '火焰!', labelColor: 'orange', markerColor: [1.0, 0.45, 0.0, 1.0], isDanger: true },
  20: { code: 20, shortEn: 'Mon!', shortZh: '怪物!', labelColor: 'orange', markerColor: [1.0, 0.5, 0.1, 1.0], isDanger: true },
  21: { code: 21, shortEn: 'Expl!', shortZh: '爆裂!', labelColor: 'red', markerColor: [1.0, 0.2, 0.1, 1.0], isDanger: true },
  22: { code: 22, shortEn: 'Psn!', shortZh: '剧毒!', labelColor: 'red', markerColor: [0.95, 0.25, 0.25, 1.0], isDanger: true },
})

export function resolveAutomapShrineBadge(shrineCode: number): AutomapShrineBadgeSpec {
  return AUTOMAP_SHRINE_BADGES[shrineCode] ?? AUTOMAP_SHRINE_BADGES[0]!
}

/**
 * Scale factor (`2x`) applied to the native waypoint sprite (`MaxiMap` / `MaxiMapS` frame `307`)
 * when the `automap-reveal` waypoint highlight enhancement (`showWaypoints`) is active.
 */
export const AUTOMAP_WAYPOINT_HIGHLIGHT_SCALE = 2

/**
 * Bright cyan-blue HDR tint (`[1.8, 2.5, 3.2, 1.0]`) applied to the top-layer `2x` waypoint sprite
 * when `showWaypoints` is active, boosting the dark cyan border pixels of frame `307` (`#0084d8`)
 * to vivid luminous cyan-white while preserving the black outline.
 */
export const AUTOMAP_WAYPOINT_HIGHLIGHT_TINT = [1.8, 2.5, 3.2, 1.0] as const

/** Full-scale (`bMinimap = false`) and half-scale (`bMinimap = true`) sheet names per slot `0..3`. */
export const AUTOMAP_SHEET_NAMES: Readonly<
  Record<AutomapAtlasSlot, { readonly full: AutomapSpriteKey; readonly half: AutomapSpriteKey }>
> = {
  0: { full: 'MaxiMap', half: 'MaxiMapS' },
  1: { full: 'Act2Map', half: 'Act2MapS' },
  2: { full: 'Act4Map', half: 'Act4MapS' },
  3: { full: 'ExTnMap', half: 'ExTnMapS' },
}

/**
 * Resolves the exact automap sprite sheet name (`MaxiMap`, `MaxiMapS`, etc.)
 * for an `AutomapAtlasSlot` (`0..3`), sheet name, or special level ID (`47..49`, `52`, `103`, `>= 109`)
 * and viewport mode (`bMinimap`).
 */
export function resolveAutomapSheetName(
  slotOrSheet: AutomapAtlasSlot | AutomapSpriteKey | undefined,
  bMinimap: boolean,
  levelId?: number,
): AutomapSpriteKey {
  if (typeof slotOrSheet === 'number' && slotOrSheet in AUTOMAP_SHEET_NAMES) {
    if (slotOrSheet !== 0) {
      const entry = AUTOMAP_SHEET_NAMES[slotOrSheet]
      return bMinimap ? entry.half : entry.full
    }
  } else if (typeof slotOrSheet === 'string') {
    if (slotOrSheet === 'Act2Map' || slotOrSheet === 'Act2MapS') {
      return bMinimap ? 'Act2MapS' : 'Act2Map'
    }
    if (slotOrSheet === 'Act4Map' || slotOrSheet === 'Act4MapS') {
      return bMinimap ? 'Act4MapS' : 'Act4Map'
    }
    if (slotOrSheet === 'ExTnMap' || slotOrSheet === 'ExTnMapS') {
      return bMinimap ? 'ExTnMapS' : 'ExTnMap'
    }
  }
  if (levelId === 47 || levelId === 48 || levelId === 49) {
    return bMinimap ? 'Act2MapS' : 'Act2Map'
  }
  if (levelId === 52 || (levelId !== undefined && levelId >= 109)) {
    return bMinimap ? 'ExTnMapS' : 'ExTnMap'
  }
  if (levelId === 103) {
    return bMinimap ? 'Act4MapS' : 'Act4Map'
  }
  const entry = AUTOMAP_SHEET_NAMES[0]
  return bMinimap ? entry.half : entry.full
}

/**
 * Computes the octile movement distance `max(|dx|, |dy|) * 2 + min(|dx|, |dy|)`
 * used by `AUTOMAP_UpdateVisibility` (`0x6fb12af0`).
 */
export function computeAutomapRevealDistance(dx: number, dy: number): number {
  const adx = Math.abs(Math.trunc(dx))
  const ady = Math.abs(Math.trunc(dy))
  return Math.max(adx, ady) * 2 + Math.min(adx, ady)
}

export interface AutomapViewportMetrics {
  readonly bMinimap: boolean
  readonly divisor: 10 | 20
  readonly screenWidth: number
  readonly screenHeight: number
  readonly vpX: number
  readonly vpY: number
  readonly vpW: number
  readonly vpH: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly centerX: number
  readonly centerY: number
  readonly centerShiftX: number
  readonly effectivePanX: number
  readonly effectivePanY: number
  readonly panX: number
  readonly panY: number
}

/**
 * Computes viewport bounds, divisor, panel shift, and center anchor per
 * `AUTOMAP_SetupViewportAndRender` (`0x6fae9e20..0x6fb104d1`).
 */
export function computeAutomapViewport(
  screenWidth: number,
  screenHeight: number,
  bMinimap: boolean,
  leftPanelOpen = false,
  rightPanelOpen = false,
  panX = 0,
  panY = 0,
): AutomapViewportMetrics {
  const safeW = Math.max(1, Math.trunc(screenWidth))
  const safeH = Math.max(1, Math.trunc(screenHeight))

  if (bMinimap) {
    const vpW = 279
    const vpH = 225
    const vpX = rightPanelOpen ? 0 : Math.max(0, safeW - 281)
    const vpY = rightPanelOpen ? 75 : 57
    const centerX = rightPanelOpen ? 139 : Math.max(139, safeW - 142)
    const centerY = rightPanelOpen ? 187 : 169
    return {
      bMinimap: true,
      divisor: 20,
      screenWidth: safeW,
      screenHeight: safeH,
      vpX,
      vpY,
      vpW,
      vpH,
      x: vpX,
      y: vpY,
      width: vpW,
      height: vpH,
      centerX,
      centerY,
      centerShiftX: 0,
      effectivePanX: 0,
      effectivePanY: 0,
      panX: 0,
      panY: 0,
    }
  }

  const vpX = 0
  const vpY = 0
  const vpW = safeW
  const vpH = safeH
  const shiftAmount = safeW >> 2
  const centerShiftX =
    leftPanelOpen && !rightPanelOpen
      ? shiftAmount
      : rightPanelOpen && !leftPanelOpen
        ? -shiftAmount
        : 0
  const centerX = Math.trunc(safeW / 2) + centerShiftX
  const centerY = Math.trunc((safeH - 40) / 2)
  const effPanX = Math.trunc(panX)
  const effPanY = Math.trunc(panY)

  return {
    bMinimap: false,
    divisor: 10,
    screenWidth: safeW,
    screenHeight: safeH,
    vpX,
    vpY,
    vpW,
    vpH,
    x: vpX,
    y: vpY,
    width: vpW,
    height: vpH,
    centerX,
    centerY,
    centerShiftX,
    effectivePanX: effPanX,
    effectivePanY: effPanY,
    panX: effPanX,
    panY: effPanY,
  }
}

export interface ProjectedAutomapSpriteRect {
  readonly screenX: number
  readonly screenY: number
  readonly drawLeft: number
  readonly drawTop: number
  readonly width: number
  readonly height: number
}

/**
 * Projects a pre-divided `(xPixel, yPixel)` automap cell and its DC6 frame metadata
 * into screen coordinates per `AUTOMAP_RenderLayer` (`0x6fb10480`) and `AUTOMAP_DrawCell` (`0x6fb0f240`).
 */
export function projectAutomapCellScreenRect(
  cell: { readonly xPixel: number; readonly yPixel: number },
  frame: {
    readonly width: number
    readonly height: number
    readonly offsetX: number
    readonly offsetY: number
  },
  offsetX: number,
  offsetY: number,
  bMinimap: boolean,
): ProjectedAutomapSpriteRect {
  const divisor = bMinimap ? 20 : 10
  const screenX = Math.trunc((cell.xPixel * 10) / divisor) - offsetX
  const screenY = Math.trunc((cell.yPixel * 10) / divisor) - offsetY
  const drawLeft = screenX + frame.offsetX - (bMinimap ? 4 : 8)
  const drawTop = screenY - frame.height + frame.offsetY
  return {
    screenX,
    screenY,
    drawLeft,
    drawTop,
    width: frame.width,
    height: frame.height,
  }
}

/**
 * Recovers the tile coordinate `(cellX, cellY)` from an `AutomapCell`'s pre-divided `(xPixel, yPixel)`.
 */
export function automapPixelToCellCoords(
  xPixel: number,
  yPixel: number,
): { readonly cellX: number; readonly cellY: number } {
  const isoX = (xPixel * 10) / 16
  const isoY = (yPixel * 10) / 8
  const subTileX = Math.round((isoX + isoY) / 2)
  const subTileY = Math.round((isoY - isoX) / 2)
  return {
    cellX: Math.floor(subTileX / 5),
    cellY: Math.floor(subTileY / 5),
  }
}

/** Something worth showing on the map even before or after the player reaches it. */
export interface MinimapMarker {
  /** Position in cells. */
  readonly cellX: number
  readonly cellY: number
  /** Which landmark kind. */
  readonly kind: 'exit' | 'waypoint'
  /** Optional destination area name for entrance/warp labels (`Font6`). */
  readonly targetName?: string
  /** Optional destination level ID (`1..136`). */
  readonly targetLevelId?: number
  /** Optional alias for `targetLevelId`. */
  readonly toLevelId?: number
  /** Optional explicit reveal override for stitched multi-level markers. */
  readonly preRevealed?: boolean
}

/** Dynamic entity marker drawn on the automap (`0x6fb11490` & `0x6fabd390`). */
export interface AutomapEntityMarker {
  /** World X coordinate (or relative to grid origin if `isRelativeToOrigin` is true). */
  readonly x: number
  /** World Y coordinate. */
  readonly y: number
  /** Entity classification for crosshair color and name label rules. */
  readonly kind:
    | 'party'
    | 'npc'
    | 'mercenary'
    | 'summon'
    | 'boss'
    | 'superunique'
    | 'unique'
    | 'player'
    | 'corpse'
    | 'ownPet'
    | 'partyPet'
    | 'nonPartyPlayer'
    | 'monsterNormal'
    | 'monsterMinion'
    | 'monsterChampion'
    | 'monsterUnique'
    | 'monsterSuperUnique'
  /** Optional display name (drawn in `Font6` when `showNames` is true for allies/NPCs/SuperUniques). */
  readonly name?: string
  /** Optional monster class ID (e.g. `357` Valkyrie, `291` Iron Golem -> white `0x216`). */
  readonly classId?: number
  /** Whether the entity is alive (dead monsters are omitted from crosshair rendering). */
  readonly alive?: boolean
}

/** Active Town Portal descriptor for dynamic portal rendering (`0x6fb11490`). */
export interface AutomapPortalDescriptor {
  readonly x: number
  readonly y: number
  readonly active?: boolean
  readonly isLocalPlayerOwner?: boolean
  readonly kind?: 'blue' | 'red'
  readonly label?: string
}

/** Stash position descriptor for `"Stash"` label and icon rendering. */
export interface AutomapStashDescriptor {
  readonly x: number
  readonly y: number
  readonly name?: string
  readonly label?: string
}

/** Dynamic shrine marker descriptor for MapHack-style shrine radar (`Shrines.txt` `Code 0..22`, Issue #881). */
export interface AutomapShrineDescriptor {
  readonly x: number
  readonly y: number
  readonly shrineCode: number
  /** `0` = active/available, `1`/`2` = operating/recharging (depleted). */
  readonly mode: number
  readonly shortLabel?: string | undefined
  readonly labelColor?: D2ColorCode | undefined
  readonly markerColor?: readonly [number, number, number, number] | undefined
  readonly overlayAtlas?: AtlasHandle | undefined
  readonly overlayFrame?: AtlasFrame | undefined
  readonly isWell?: boolean | undefined
}

/** What the minimap needs to know about the level under it. */
export interface MinimapLevel {
  /** A key that changes when the level does; exploration is kept per key. */
  readonly key: string
  readonly cellsX: number
  readonly cellsY: number
  /** One byte per sub-tile, non-zero meaning impassable. */
  readonly blocked: Uint8Array
  /** Sub-tiles across. */
  readonly gridWidth: number
  /** Landmarks to draw once their cell is explored. */
  readonly markers: readonly MinimapMarker[]
  /** Optional world origin X of tile `(0, 0)` (defaults to `0`). */
  readonly originX?: number
  /** Optional world origin Y of tile `(0, 0)` (defaults to `0`). */
  readonly originY?: number
  /** Optional world tile X of local cell `(0, 0)` (`LevelView.tileOriginX`). */
  readonly tileOriginX?: number
  /** Optional world tile Y of local cell `(0, 0)` (`LevelView.tileOriginY`). */
  readonly tileOriginY?: number
  /** Optional layer key shared by all stitched levels in the same Act & `Levels.txt` `dwLayer`. */
  readonly layerKey?: string
  /** Pre-built 4-layer isometric automap data (`floors`, `walls`, `objects`, `extras`). */
  readonly automap: AutomapLayerData
  /** Optional level ID (`1..136`) for portal sprite selection (`300` in Level 4 vs `306`/`307`). */
  readonly levelId?: number
  /** Optional localized or English level name for top-right `Font16` HUD display. */
  readonly levelName?: string
  /** Optional difficulty label (`Normal` / `Nightmare` / `Hell`) for top-right `Font16` HUD display. */
  readonly difficulty?: string
  /** Optional flag for preset town levels (`DRLGPRESET_GenerateLevel` @ `0x6FD886F0`) where all rooms are revealed upon generation. */
  readonly preRevealTown?: boolean
}

/** Optional extended draw parameters for full 1.13c entity, portal, panel, and HUD integration. */
export interface MinimapDrawOptions {
  /** Exact player world X coordinate (for smooth sub-tile centering). */
  readonly playerWorldX?: number
  /** Exact player world Y coordinate (for smooth sub-tile centering). */
  readonly playerWorldY?: number
  /** Whether a left-dock panel (`char`, `quest`, `waypoint`, `stash`, `cube`, `vendor`) is open. */
  readonly leftPanelOpen?: boolean
  /** Whether a right-dock panel (`inv`, `skill`) is open. */
  readonly rightPanelOpen?: boolean
  /** Dynamic entities (NPCs, party members, mercenaries, summons, bosses/SuperUniques, or radar monsters). */
  readonly entities?: readonly AutomapEntityMarker[]
  /** Active town portals in the current level. */
  readonly portals?: readonly AutomapPortalDescriptor[]
  /** Stash entities in the current level. */
  readonly stashes?: readonly AutomapStashDescriptor[]
  /** Dynamic shrine entities with type icons/badges (when shrine radar is enabled). */
  readonly shrines?: readonly AutomapShrineDescriptor[]
  /** Whether to draw an enlarged (2x), bright-tinted top-layer waypoint sprite (`MaxiMap` / `MaxiMapS` `307`). */
  readonly highlightWaypoints?: boolean
  /** Override level ID (`1..136`). */
  readonly levelId?: number
  /** Override level display name for top-right `Font16` HUD readout. */
  readonly levelName?: string
  /** Override difficulty string (`Normal` / `Nightmare` / `Hell`) for top-right `Font16` HUD readout. */
  readonly difficulty?: string
}

export interface AutomapOverlayLabel {
  readonly text: string
  readonly x: number
  readonly y: number
  readonly color: D2ColorCode
  readonly kind: 'warp' | 'stash' | 'entity' | 'portal' | 'shrine'
}

export interface AutomapRenderTelemetry {
  mode: 'minimap' | 'full'
  bMinimap: boolean
  divisor: 10 | 20
  fadeState: 0 | 1 | 2 | 3
  fadeAlpha: number
  showNames: boolean
  panX: number
  panY: number
  viewport: AutomapViewportMetrics
  cellCounts: {
    floors: number
    walls: number
    objects: number
    extras: number
    total: number
  }
  spritesDrawn: {
    floors: number
    walls: number
    objects: number
    extras: number
    portals: number
    shrines: number
    waypoints: number
    total: number
  }
  crosshairsDrawn: {
    player: number
    party: number
    npcs: number
    mercenaries: number
    bosses: number
    monsters: number
    total: number
  }
  revealedRooms: number
  warpLabels: AutomapOverlayLabel[]
  entityLabels: AutomapOverlayLabel[]
  hudText: {
    levelName: string
    difficulty: string
    x: number
    y1: number
    y2: number
  } | null
}

/**
 * The Diablo II v1.13c Isometric Sprite Automap & Minimap renderer.
 */
export class Minimap {
  /** Whether the automap/minimap overlay is visible (`Tab` toggles visibility). */
  visible = true

  /**
   * `true` = Corner Minimap (`nDivisor = 20`, `*S.dc6` half-scale sheets, `279×225` clipped viewport).
   * `false` = Full-Screen Automap (`nDivisor = 10`, full-scale sheets, `[0, 0, screenW, screenH]`).
   */
  bMinimap = true

  /** 4-state fade index (`0` = 100%, `1` = 75%/distance, `2` = 50%, `3` = 25%), cycled by `F9`. */
  fadeState: 0 | 1 | 2 | 3 = 0

  /** Whether ally/NPC names and labels are displayed (`F10` toggles). */
  showNames = true

  /** Manual pan offset X in screen pixels (active only when `!bMinimap`). */
  panX = 0

  /** Manual pan offset Y in screen pixels (active only when `!bMinimap`). */
  panY = 0

  /** Loaded WebGL atlas handles keyed by sheet name (`MaxiMap`, `MaxiMapS`, etc.). */
  private readonly atlases = new Map<AutomapSpriteKey, AtlasHandle>()
  /** Decoded atlas PNG sources kept for 2D compositing of the static-layer cache. */
  private readonly atlasSources = new Map<AutomapSpriteKey, ImageBitmap>()
  /**
   * Static automap-layer cache: while the content-version key (zoom/reveal/mode/
   * viewport) is stable, the automap cells are composited into a padded canvas
   * (`vpW + 512` x `vpH + 512`) anchored at `(anchorOffsetX, anchorOffsetY)` and
   * sampled as ONE translated sub-rectangle quad per frame even while walking.
   */
  private readonly staticCache: {
    key: string
    pendingKey: string | null
    handle: AtlasHandle | null
    anchorOffsetX: number
    anchorOffsetY: number
    w: number
    h: number
    uploading: boolean
    spriteCounts: {
      floors: number
      walls: number
      objects: number
      extras: number
      total: number
    }
    canvas: { w: number; h: number; surface: OffscreenCanvas | HTMLCanvasElement } | null
  } = {
    key: '',
    pendingKey: null,
    handle: null,
    anchorOffsetX: 0,
    anchorOffsetY: 0,
    w: 0,
    h: 0,
    uploading: false,
    spriteCounts: { floors: 0, walls: 0, objects: 0, extras: 0, total: 0 },
    canvas: null,
  }

  /** level key -> one byte per cell, non-zero meaning explored. */
  private readonly explored = new Map<string, Uint8Array>()

  /** layer key -> set of packed world tile coordinates `((worldTileY & 0xffff) << 16) | (worldTileX & 0xffff)`. */
  private readonly exploredWorldTilesByLayer = new Map<string, Set<number>>()

  /** level key -> set of revealed room keys (`"${roomX},${roomY}"`). */
  private readonly revealedRoomsByLevel = new Map<string, Set<string>>()

  /** level key -> last player sub-unit coordinates where `AUTOMAP_UpdateVisibility` triggered. */
  private readonly lastRevealSubPos = new Map<string, { x: number; y: number }>()

  /** level key -> last player cell coordinates where room/radius reveal ran. */
  private readonly lastRevealCellPos = new Map<string, { cellX: number; cellY: number }>()

  /** level keys whose preset town / full-reveal rooms have already been marked in `explored` and `revealedRoomsByLevel`. */
  private readonly preRevealedTownLevels = new Set<string>()

  /** Pre-allocated scratch draw options object reused across `drawLayerCells` and portal draws (`#813`). */
  private readonly scratchDrawOptions: {
    atlas: AtlasHandle
    width: number
    height: number
    tint: readonly [number, number, number, number]
    blendMode: 'normal' | 'additive'
  } = {
    atlas: null as unknown as AtlasHandle,
    width: 0,
    height: 0,
    tint: AUTOMAP_FADE_TINTS[0]!,
    blendMode: 'normal',
  }

  /** Last drawn level/layer key so manual pan resets when switching automap layers (#549). */
  private lastLevelKey: string | null = null

  /** Diagnostic telemetry from the most recent `draw()` invocation. */
  readonly lastRenderStats: AutomapRenderTelemetry = {
    mode: 'minimap',
    bMinimap: true,
    divisor: 20,
    fadeState: 0,
    fadeAlpha: 1.0,
    showNames: true,
    panX: 0,
    panY: 0,
    viewport: computeAutomapViewport(800, 600, true),
    cellCounts: { floors: 0, walls: 0, objects: 0, extras: 0, total: 0 },
    spritesDrawn: { floors: 0, walls: 0, objects: 0, extras: 0, portals: 0, shrines: 0, waypoints: 0, total: 0 },
    crosshairsDrawn: { player: 0, party: 0, npcs: 0, mercenaries: 0, bosses: 0, monsters: 0, total: 0 },
    revealedRooms: 0,
    warpLabels: [],
    entityLabels: [],
    hudText: null,
  }

  constructor() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('d2_automap_fade')
        if (saved !== null) {
          const val = parseInt(saved, 10)
          if (val >= 0 && val <= 3) {
            this.fadeState = val as 0 | 1 | 2 | 3
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private persistFadeState(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('d2_automap_fade', String(this.fadeState))
      }
    } catch {
      // ignore
    }
  }

  /** Current mode (`'minimap'` when `bMinimap === true`, `'full'` when `bMinimap === false`). */
  get mode(): 'minimap' | 'full' {
    return this.bMinimap ? 'minimap' : 'full'
  }

  set mode(value: 'minimap' | 'full') {
    this.bMinimap = value === 'minimap'
    if (this.bMinimap) {
      this.resetPan()
    }
  }

  /** Current projection divisor (`20` for Corner Minimap, `10` for Full Automap). */
  get divisor(): 10 | 20 {
    return this.bMinimap ? 20 : 10
  }

  /** Number of loaded automap sprite sheet atlases (`0..8`). */
  get atlasesLoadedCount(): number {
    return this.atlases.size
  }

  /** Current sprite alpha multiplier from `fadeState`. */
  get fadeAlpha(): number {
    return AUTOMAP_FADE_ALPHAS[this.fadeState]
  }

  /** Alias for `fadeState`. */
  get fadeMode(): 0 | 1 | 2 | 3 {
    return this.fadeState
  }

  /** Revealed DRLG room count for the most recently revealed or drawn level. */
  get revealedRoomsCount(): number {
    return this.lastRenderStats.revealedRooms
  }

  /** Sprites drawn per layer on the most recent frame. */
  get spritesDrawnLastFrame(): AutomapRenderTelemetry['spritesDrawn'] {
    return this.lastRenderStats.spritesDrawn
  }

  /** 12-segment crosshairs drawn on the most recent frame. */
  get crosshairsDrawnLastFrame(): AutomapRenderTelemetry['crosshairsDrawn'] {
    return this.lastRenderStats.crosshairsDrawn
  }

  /** Revealed warp/stash labels on the most recent frame. */
  get warpLabelsLastFrame(): AutomapOverlayLabel[] {
    return this.lastRenderStats.warpLabels
  }

  /** Top-right gold Font16 HUD text on the most recent frame. */
  get hudTextLastFrame(): AutomapRenderTelemetry['hudText'] {
    return this.lastRenderStats.hudText
  }

  /** Active automap viewport metrics on the most recent frame. */
  get viewportLastFrame(): AutomapViewportMetrics {
    return this.lastRenderStats.viewport
  }

  /**
   * Distance-based transparency lookup for fadeState 1 in Full Automap mode (`0x6fb103d5`),
   * returning uniform alpha in other fade states or Corner Minimap mode.
   */
  getCellFadeAlpha(
    screenX: number,
    screenY: number,
    centerX: number,
    centerY: number,
    bMinimap: boolean,
  ): number {
    if (this.fadeState === 0) return 1.0
    if (this.fadeState === 2) return 0.5
    if (this.fadeState === 3) return 0.25
    if (bMinimap) return 0.75
    const dx = Math.abs(screenX - centerX)
    const dy = Math.abs(screenY - centerY)
    if (dx > 140 || dy > 150) return 0.25
    const dist = Math.hypot(dx, dy)
    if (dist < 50) return 1.0
    if (dist < 100) return 0.75
    if (dist < 150) return 0.5
    return 0.25
  }

  /**
   * Toggles automap visibility (`Tab` key).
   */
  toggleVisibility(): boolean {
    this.visible = !this.visible
    if (!this.visible) {
      this.resetPan()
    }
    return this.visible
  }

  /**
   * Alias for `toggleVisibility()` (`Tab` key).
   */
  toggle(): boolean {
    return this.toggleVisibility()
  }

  /**
   * Toggles between Corner Minimap (`bMinimap = true`, `nDivisor = 20`) and
   * Full-Screen Automap (`bMinimap = false`, `nDivisor = 10`) (`V` key or MiniPanel Automap button).
   */
  toggleMode(): 'minimap' | 'full' {
    if (!this.visible) {
      this.visible = true
      return this.mode
    }
    this.bMinimap = !this.bMinimap
    if (this.bMinimap) {
      this.resetPan()
    }
    return this.mode
  }

  /**
   * Alias for `toggleMode()` returning the updated `bMinimap` boolean.
   */
  toggleMinimapMode(): boolean {
    this.toggleMode()
    return this.bMinimap
  }

  /**
   * Cycles automap fade state (`0 -> 1 -> 2 -> 3 -> 0`, `F9` key).
   */
  cycleFade(): 0 | 1 | 2 | 3 {
    this.fadeState = ((this.fadeState + 1) % 4) as 0 | 1 | 2 | 3
    this.persistFadeState()
    return this.fadeState
  }

  /**
   * Toggles party/ally/NPC name display on the automap (`F10` key).
   */
  toggleShowNames(): boolean {
    this.showNames = !this.showNames
    return this.showNames
  }

  /**
   * Alias for `toggleShowNames()`.
   */
  toggleNames(): boolean {
    return this.toggleShowNames()
  }

  /**
   * Pans the Full-Screen Automap by `(dx, dy)` pixels (`ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`).
   * Returns `true` if the pan was applied (`visible && !bMinimap`), `false` otherwise.
   */
  pan(dx: number, dy: number): boolean {
    if (!this.visible || this.bMinimap) return false
    this.panX += Math.trunc(dx)
    this.panY += Math.trunc(dy)
    return true
  }

  /**
   * Pans the Full-Screen Automap by `(stepX * AUTOMAP_PAN_STEP_PX, stepY * AUTOMAP_PAN_STEP_PX)`.
   */
  panBySteps(stepX: number, stepY: number): boolean {
    return this.pan(stepX * AUTOMAP_PAN_STEP_PX, stepY * AUTOMAP_PAN_STEP_PX)
  }

  /**
   * Resets the manual pan offset to `(0, 0)` (`Home` key).
   */
  resetPan(): void {
    this.panX = 0
    this.panY = 0
  }

  /**
   * Registers an `AtlasHandle` for a specific automap sheet name (`MaxiMap`, `MaxiMapS`, etc.).
   */
  setAtlasHandle(sheetName: AutomapSpriteKey, handle: AtlasHandle): void {
    this.atlases.set(sheetName, handle)
  }

  /**
   * Returns the metadata for a specific automap sprite sheet (`MaxiMap`, `MaxiMapS`, etc.).
   */
  getSheetMeta(sheetName: AutomapSpriteKey): AutomapSpriteAtlasMeta {
    return AUTOMAP_UI_MANIFEST.atlases[sheetName]
  }

  /**
   * Loads all 8 baked automap PNG sprite sheets (`AUTOMAP_UI_MANIFEST`) into the `SpriteRenderer`.
   */
  async loadAtlases(renderer: SpriteRenderer, baseUrl = ''): Promise<number> {
    const entries = Object.entries(AUTOMAP_UI_MANIFEST.atlases) as [
      AutomapSpriteKey,
      AutomapSpriteAtlasMeta,
    ][]
    let loadedCount = 0

    await Promise.all(
      entries.map(async ([sheetName, meta]) => {
        const url =
          baseUrl && (!meta.image.startsWith('/') || baseUrl.startsWith('http') || baseUrl.startsWith('/'))
            ? `${baseUrl.replace(/\/+$/, '')}/${meta.image.replace(/^\/+/, '')}`
            : meta.image
        try {
          const res = await fetch(url)
          if (!res.ok) {
            const err = new Error(
              `Failed to load automap atlas ${sheetName} from ${url}: status ${res.status}`,
            )
            reportMissingArt('automap', sheetName, err.message)
            throw err
          }
          const blob = await res.blob()
          const bitmap = await createImageBitmap(blob, {
            premultiplyAlpha: 'none',
            colorSpaceConversion: 'none',
          })
          const handle = renderer.addAtlas(bitmap, meta.atlasWidth, meta.atlasHeight)
          this.atlases.set(sheetName, handle)
          // Keep the decoded source for the static-layer cache compositor.
          this.atlasSources.set(sheetName, bitmap)
          loadedCount += 1
        } catch (err) {
          reportMissingArt('automap', sheetName, String(err))
          throw err
        }
      }),
    )

    return loadedCount
  }

  /**
   * Returns the number of revealed DRLG rooms for the given level key.
   */
  revealedRoomCount(levelKey: string): number {
    return this.revealedRoomsByLevel.get(levelKey)?.size ?? 0
  }

  /**
   * Returns whether a specific DRLG room `(roomX, roomY)` in `levelKey` has been revealed.
   */
  isRoomRevealed(levelKey: string, roomX: number, roomY: number): boolean {
    return this.revealedRoomsByLevel.get(levelKey)?.has(`${roomX},${roomY}`) ?? false
  }

  private packWorldCell(worldCellX: number, worldCellY: number): number {
    return (((worldCellY & 0xffff) << 16) | (worldCellX & 0xffff)) >>> 0
  }

  private getWorldExploredSet(layerKey: string): Set<number> {
    let set = this.exploredWorldTilesByLayer.get(layerKey)
    if (!set) {
      set = new Set<number>()
      this.exploredWorldTilesByLayer.set(layerKey, set)
    }
    return set
  }

  /**
   * Returns whether a specific cell `(cellX, cellY)` in `level` has been revealed.
   */
  isCellExplored(level: MinimapLevel, cellX: number, cellY: number): boolean {
    if (cellX >= 0 && cellY >= 0 && cellX < level.cellsX && cellY < level.cellsY) {
      const seen = this.seenFor(level)
      if (seen[cellY * level.cellsX + cellX] !== 0) return true
    }
    if (level.layerKey !== undefined) {
      const worldSet = this.exploredWorldTilesByLayer.get(level.layerKey)
      if (worldSet !== undefined && worldSet.size > 0) {
        const tileOriginX = level.tileOriginX ?? 0
        const tileOriginY = level.tileOriginY ?? 0
        return worldSet.has(this.packWorldCell(tileOriginX + cellX, tileOriginY + cellY))
      }
    }
    return false
  }

  /**
   * Marks the player's current room and adjacent 3×3 rooms as explored once the player
   * has moved at least `AUTOMAP_REVEAL_DISTANCE_THRESHOLD` (`160` sub-units) in octile distance
   * (`AUTOMAP_UpdateVisibility` @ `0x6fb12af0` & `AUTOMAP_RevealRoom` @ `0x6fb12580`).
   *
   * @param level - the level being walked.
   * @param cellX - the player's cell X.
   * @param cellY - the player's cell Y.
   * @param playerWorldX - optional exact sub-unit X (defaults to `cellX * 80`).
   * @param playerWorldY - optional exact sub-unit Y (defaults to `cellY * 80`).
   * @param force - if true, bypasses the octile distance threshold check.
   * @returns `true` if a reveal pass was executed, `false` if skipped by the octile threshold.
   */
  reveal(
    level: MinimapLevel,
    cellX: number,
    cellY: number,
    playerWorldX?: number,
    playerWorldY?: number,
    force = false,
  ): boolean {
    const subX = playerWorldX !== undefined ? Math.trunc(playerWorldX) : Math.trunc(cellX * 80)
    const subY = playerWorldY !== undefined ? Math.trunc(playerWorldY) : Math.trunc(cellY * 80)

    const lastPos = this.lastRevealSubPos.get(level.key)
    if (!force && lastPos !== undefined && level.preRevealTown !== true) {
      const dist = computeAutomapRevealDistance(subX - lastPos.x, subY - lastPos.y)
      if (dist < AUTOMAP_REVEAL_DISTANCE_THRESHOLD) {
        return false
      }
    }
    if (lastPos !== undefined) {
      lastPos.x = subX
      lastPos.y = subY
    } else {
      this.lastRevealSubPos.set(level.key, { x: subX, y: subY })
    }

    const seen = this.seenFor(level)
    let roomSet = this.revealedRoomsByLevel.get(level.key)
    if (!roomSet) {
      roomSet = new Set<string>()
      this.revealedRoomsByLevel.set(level.key, roomSet)
    }

    const roomX = Math.floor(cellX / ROOM_SIZE_CELLS)
    const roomY = Math.floor(cellY / ROOM_SIZE_CELLS)
    const maxRoomX = Math.max(0, Math.ceil(level.cellsX / ROOM_SIZE_CELLS) - 1)
    const maxRoomY = Math.max(0, Math.ceil(level.cellsY / ROOM_SIZE_CELLS) - 1)
    const tileOriginX = level.tileOriginX ?? 0
    const tileOriginY = level.tileOriginY ?? 0
    const worldSet =
      level.layerKey !== undefined ? this.getWorldExploredSet(level.layerKey) : null

    // Per D2Common.dll DRLGPRESET_GenerateLevel (0x6FD886F0 lines 1803-1823),
    // preset town levels (1, 40, 75, 103, 109) invoke pfAutomap across all rooms upon generation.
    // Also triggered when automap-reveal plugin mode is 'level' or 'act' (#789).
    if (level.preRevealTown === true) {
      if (!this.preRevealedTownLevels.has(level.key)) {
        seen.fill(1)
        for (let ry = 0; ry <= maxRoomY; ry += 1) {
          for (let rx = 0; rx <= maxRoomX; rx += 1) {
            roomSet.add(`${rx},${ry}`)
          }
        }
        if (worldSet !== null) {
          for (let y = 0; y < level.cellsY; y += 1) {
            for (let x = 0; x < level.cellsX; x += 1) {
              worldSet.add(this.packWorldCell(tileOriginX + x, tileOriginY + y))
            }
          }
        }
        this.preRevealedTownLevels.add(level.key)
      }
      if (worldSet !== null) {
        // Also reveal the 3x3 room neighborhood and REVEAL_RADIUS in worldSet so adjacent
        // outdoor level tiles right outside the town gate are smoothly revealed as the player approaches.
        for (let ry = roomY - 1; ry <= roomY + 1; ry += 1) {
          for (let rx = roomX - 1; rx <= roomX + 1; rx += 1) {
            const startX = rx * ROOM_SIZE_CELLS
            const endX = startX + ROOM_SIZE_CELLS
            const startY = ry * ROOM_SIZE_CELLS
            const endY = startY + ROOM_SIZE_CELLS
            for (let y = startY; y < endY; y += 1) {
              for (let x = startX; x < endX; x += 1) {
                worldSet.add(this.packWorldCell(tileOriginX + x, tileOriginY + y))
              }
            }
          }
        }
      }
      this.lastRenderStats.revealedRooms = roomSet.size
      return true
    }

    const prevCell = this.lastRevealCellPos.get(level.key)
    if (prevCell !== undefined && prevCell.cellX === cellX && prevCell.cellY === cellY) {
      this.lastRenderStats.revealedRooms = roomSet.size
      return true
    }
    if (prevCell !== undefined) {
      prevCell.cellX = cellX
      prevCell.cellY = cellY
    } else {
      this.lastRevealCellPos.set(level.key, { cellX, cellY })
    }

    // Reveal the player's room and adjacent 3×3 rooms (`AUTOMAP_RevealRoom` @ `0x6fb12580`)
    for (let ry = Math.max(0, roomY - 1); ry <= Math.min(maxRoomY, roomY + 1); ry += 1) {
      for (let rx = Math.max(0, roomX - 1); rx <= Math.min(maxRoomX, roomX + 1); rx += 1) {
        roomSet.add(`${rx},${ry}`)
        const startX = rx * ROOM_SIZE_CELLS
        const endX = Math.min(level.cellsX, startX + ROOM_SIZE_CELLS)
        const startY = ry * ROOM_SIZE_CELLS
        const endY = Math.min(level.cellsY, startY + ROOM_SIZE_CELLS)
        for (let y = startY; y < endY; y += 1) {
          const rowOffset = y * level.cellsX
          for (let x = startX; x < endX; x += 1) {
            seen[rowOffset + x] = 1
          }
        }
      }
    }

    if (worldSet !== null) {
      for (let ry = roomY - 1; ry <= roomY + 1; ry += 1) {
        for (let rx = roomX - 1; rx <= roomX + 1; rx += 1) {
          const startX = rx * ROOM_SIZE_CELLS
          const endX = startX + ROOM_SIZE_CELLS
          const startY = ry * ROOM_SIZE_CELLS
          const endY = startY + ROOM_SIZE_CELLS
          for (let y = startY; y < endY; y += 1) {
            for (let x = startX; x < endX; x += 1) {
              worldSet.add(this.packWorldCell(tileOriginX + x, tileOriginY + y))
            }
          }
        }
      }
    }

    // Also ensure the circular REVEAL_RADIUS neighborhood is marked for boundary continuity
    for (let dy = -REVEAL_RADIUS; dy <= REVEAL_RADIUS; dy += 1) {
      const y = cellY + dy
      for (let dx = -REVEAL_RADIUS; dx <= REVEAL_RADIUS; dx += 1) {
        if (dx * dx + dy * dy > REVEAL_RADIUS * REVEAL_RADIUS) continue
        const x = cellX + dx
        if (x >= 0 && x < level.cellsX && y >= 0 && y < level.cellsY) {
          seen[y * level.cellsX + x] = 1
        }
        if (worldSet !== null) {
          worldSet.add(this.packWorldCell(tileOriginX + x, tileOriginY + y))
        }
      }
    }

    this.lastRenderStats.revealedRooms = roomSet.size
    return true
  }

  /**
   * Immediately reveals all cells and rooms for `level` without requiring movement or level change (#789).
   */
  revealAllCurrentLevel(level: MinimapLevel): void {
    const seen = this.seenFor(level)
    let roomSet = this.revealedRoomsByLevel.get(level.key)
    if (!roomSet) {
      roomSet = new Set<string>()
      this.revealedRoomsByLevel.set(level.key, roomSet)
    }
    if (!this.preRevealedTownLevels.has(level.key)) {
      seen.fill(1)
      const maxRoomX = Math.max(0, Math.ceil(level.cellsX / ROOM_SIZE_CELLS) - 1)
      const maxRoomY = Math.max(0, Math.ceil(level.cellsY / ROOM_SIZE_CELLS) - 1)
      for (let ry = 0; ry <= maxRoomY; ry += 1) {
        for (let rx = 0; rx <= maxRoomX; rx += 1) {
          roomSet.add(`${rx},${ry}`)
        }
      }
      if (level.layerKey !== undefined) {
        const worldSet = this.getWorldExploredSet(level.layerKey)
        const tileOriginX = level.tileOriginX ?? 0
        const tileOriginY = level.tileOriginY ?? 0
        for (let y = 0; y < level.cellsY; y += 1) {
          for (let x = 0; x < level.cellsX; x += 1) {
            worldSet.add(this.packWorldCell(tileOriginX + x, tileOriginY + y))
          }
        }
      }
      this.preRevealedTownLevels.add(level.key)
    }
    this.lastRenderStats.revealedRooms = roomSet.size
  }

  /**
   * How much of a level has been seen (`0..1`).
   */
  exploredFraction(level: MinimapLevel): number {
    const seen = this.seenFor(level)
    let count = 0
    for (const value of seen) count += value
    return seen.length === 0 ? 0 : count / seen.length
  }

  /**
   * Draws the authentic 1.13c Isometric Sprite Automap or Corner Minimap.
   *
   * Call between `renderer.begin` and `renderer.flush`.
   * Applies hardware WebGL scissor clipping (`gl.SCISSOR_TEST`) for the active viewport,
   * renders the 4 isometric sprite layers in strict order (`floors -> walls -> objects -> extras`),
   * renders dynamic town portals (`MaxiMap` / `MaxiMapS` `306`/`307`/`300`), and draws the
   * 12-segment closed directional crosshair polygons (`0x6fb107f0`).
   */
  draw(
    renderer: SpriteRenderer,
    level: MinimapLevel,
    playerCellX: number,
    playerCellY: number,
    view: { readonly x: number; readonly y: number; readonly zoom: number },
    viewport: { readonly width: number; readonly height: number },
    options?: MinimapDrawOptions,
  ): void {
    const panKey = level.layerKey ?? level.key
    if (this.lastLevelKey !== null && this.lastLevelKey !== panKey) {
      this.resetPan()
    }
    this.lastLevelKey = panKey

    const screenW = Math.max(1, Math.trunc(viewport.width))
    const screenH = Math.max(1, Math.trunc(viewport.height))
    const vp = computeAutomapViewport(
      screenW,
      screenH,
      this.bMinimap,
      options?.leftPanelOpen ?? false,
      options?.rightPanelOpen ?? false,
      this.panX,
      this.panY,
    )

    const automapLayer = level.automap
    if (!automapLayer) {
      throw new Error(
        `[Minimap] Missing authentic automap layer data for level ${String(level.levelId ?? level.key)}`,
      )
    }
    this.lastRenderStats.mode = this.mode
    this.lastRenderStats.bMinimap = this.bMinimap
    this.lastRenderStats.divisor = vp.divisor
    this.lastRenderStats.fadeState = this.fadeState
    this.lastRenderStats.fadeAlpha = this.fadeAlpha
    this.lastRenderStats.showNames = this.showNames
    this.lastRenderStats.panX = this.panX
    this.lastRenderStats.panY = this.panY
    this.lastRenderStats.viewport = vp
    this.lastRenderStats.cellCounts.floors = automapLayer.floors.length
    this.lastRenderStats.cellCounts.walls = automapLayer.walls.length
    this.lastRenderStats.cellCounts.objects = automapLayer.objects.length
    this.lastRenderStats.cellCounts.extras = automapLayer.extras.length
    this.lastRenderStats.cellCounts.total =
      automapLayer.floors.length +
      automapLayer.walls.length +
      automapLayer.objects.length +
      automapLayer.extras.length
    this.lastRenderStats.spritesDrawn.floors = 0
    this.lastRenderStats.spritesDrawn.walls = 0
    this.lastRenderStats.spritesDrawn.objects = 0
    this.lastRenderStats.spritesDrawn.extras = 0
    this.lastRenderStats.spritesDrawn.portals = 0
    this.lastRenderStats.spritesDrawn.shrines = 0
    this.lastRenderStats.spritesDrawn.waypoints = 0
    this.lastRenderStats.spritesDrawn.total = 0
    this.lastRenderStats.crosshairsDrawn.player = 0
    this.lastRenderStats.crosshairsDrawn.party = 0
    this.lastRenderStats.crosshairsDrawn.npcs = 0
    this.lastRenderStats.crosshairsDrawn.mercenaries = 0
    this.lastRenderStats.crosshairsDrawn.bosses = 0
    this.lastRenderStats.crosshairsDrawn.monsters = 0
    this.lastRenderStats.crosshairsDrawn.total = 0
    this.lastRenderStats.revealedRooms = this.revealedRoomCount(level.key)
    this.lastRenderStats.warpLabels = []
    this.lastRenderStats.entityLabels = []
    this.lastRenderStats.hudText = null

    if (!this.visible) return

    const seen = this.seenFor(level)
    const originX = level.originX ?? 0
    const originY = level.originY ?? 0
    const playerClientX =
      options?.playerWorldX !== undefined
        ? Math.round(options.playerWorldX - originX)
        : Math.round((playerCellX - playerCellY) * 80)
    const playerClientY =
      options?.playerWorldY !== undefined
        ? Math.round(options.playerWorldY - originY)
        : Math.round((playerCellX + playerCellY) * 40)

    const offsetX = Math.trunc(playerClientX / vp.divisor) - vp.centerX + vp.effectivePanX
    const offsetY = Math.trunc(playerClientY / vp.divisor) - vp.centerY + vp.effectivePanY

    const zoom = view.zoom > 0 ? view.zoom : 1
    const invZoom = 1 / zoom
    const halfScreenW = screenW / 2
    const halfScreenH = screenH / 2
    const toWorldX = (sx: number): number => view.x + (sx - halfScreenW) * invZoom
    const toWorldY = (sy: number): number => view.y + (sy - halfScreenH) * invZoom

    // Enable hardware WebGL scissor clipping for the automap viewport (`0x6fb102a0`)
    const gl = (renderer as unknown as { gl?: WebGL2RenderingContext | null }).gl
    if (gl && typeof gl.enable === 'function' && typeof gl.scissor === 'function') {
      renderer.flush()
      gl.enable(gl.SCISSOR_TEST)
      const pixelScale = renderer.pixelScale ?? 1
      const scissorX = Math.max(0, Math.round(vp.vpX * pixelScale))
      const scissorY = Math.max(0, Math.round((screenH - (vp.vpY + vp.vpH)) * pixelScale))
      const scissorW = Math.max(1, Math.round(vp.vpW * pixelScale))
      const scissorH = Math.max(1, Math.round(vp.vpH * pixelScale))
      gl.scissor(scissorX, scissorY, scissorW, scissorH)
    }

    const isDistanceFade = this.fadeState === 1 && !this.bMinimap
    const uniformTint = AUTOMAP_FADE_TINTS[this.fadeState]!
    const divisor = this.bMinimap ? 20 : 10
    const halfAnchorX = this.bMinimap ? 4 : 8
    const vpRight = vp.vpX + vp.vpW
    const vpBottom = vp.vpY + vp.vpH
    const drawOptions = this.scratchDrawOptions

    const drawLayerCells = (
      cells: readonly AutomapCell[],
      layerKey: 'floors' | 'walls' | 'objects' | 'extras',
      ignoreFogOfWar: boolean,
    ): void => {
      for (const cell of cells) {
        const sheetName = resolveAutomapSheetName(cell.fSaved ?? 0, this.bMinimap)
        const sheetMeta = AUTOMAP_UI_MANIFEST.atlases[sheetName]
        const atlasHandle = this.resolveAtlasHandle(renderer, sheetName, sheetMeta)
        if (!sheetMeta || !atlasHandle) continue
        if (cell.cellNo < 0 || cell.cellNo >= sheetMeta.frames.length) continue
        if ((!ignoreFogOfWar || cell.preRevealed === false) && !this.isAutomapCellRevealed(level, seen, cell)) continue
        const frame = sheetMeta.frames[cell.cellNo]
        if (!frame || frame.width <= 0 || frame.height <= 0) continue

        const screenX = Math.trunc((cell.xPixel * 10) / divisor) - offsetX
        const screenY = Math.trunc((cell.yPixel * 10) / divisor) - offsetY
        const drawLeft = screenX + frame.offsetX - halfAnchorX
        const drawTop = screenY - frame.height + frame.offsetY
        // Frustum cull against active viewport `[vpX, vpY, vpX + vpW, vpY + vpH]`
        if (
          drawLeft + frame.width < vp.vpX ||
          drawLeft > vpRight ||
          drawTop + frame.height < vp.vpY ||
          drawTop > vpBottom
        ) {
          continue
        }

        let tint = uniformTint
        if (isDistanceFade) {
          const alpha = this.getCellFadeAlpha(
            screenX,
            screenY,
            vp.centerX,
            vp.centerY,
            this.bMinimap,
          )
          tint =
            alpha === 1.0
              ? AUTOMAP_FADE_TINTS[0]!
              : alpha === 0.75
                ? AUTOMAP_FADE_TINTS[1]!
                : alpha === 0.5
                  ? AUTOMAP_FADE_TINTS[2]!
                  : AUTOMAP_FADE_TINTS[3]!
        }

        drawOptions.atlas = atlasHandle
        drawOptions.width = frame.width * invZoom
        drawOptions.height = frame.height * invZoom
        drawOptions.tint = tint
        renderer.draw(
          frame,
          toWorldX(drawLeft),
          toWorldY(drawTop),
          drawOptions,
        )
        this.lastRenderStats.spritesDrawn[layerKey] += 1
        this.lastRenderStats.spritesDrawn.total += 1
      }
    }

    // Strict 1.13c 4-layer draw order (`0x6fb10489`):
    if (automapLayer) {
      // Static-layer cache: when `!isDistanceFade`, composite a padded window
      // (`vpW + 512` x `vpH + 512`) around `(offsetX, offsetY)` so continuous
      // player movement translates the UV sample window within the cached atlas
      // and emits ONE quad per frame instead of ~500-1000 individual cell quads.
      const cachePad = isDistanceFade ? 0 : 256
      const cacheKey = isDistanceFade
        ? [
            level.key,
            this.bMinimap ? 1 : 0,
            this.fadeState,
            zoom,
            offsetX,
            offsetY,
            vp.vpX,
            vp.vpY,
            vp.vpW,
            vp.vpH,
            this.lastRenderStats.revealedRooms,
          ].join('|')
        : [
            level.key,
            this.bMinimap ? 1 : 0,
            this.fadeState,
            zoom,
            vp.vpX,
            vp.vpY,
            vp.vpW,
            vp.vpH,
            this.lastRenderStats.revealedRooms,
          ].join('|')
      const cacheUsable =
        this.atlasSources.size > 0 && // atlas PNG sources retained for 2D compositing
        this.canCreateCacheCanvas()
      const relX = offsetX - this.staticCache.anchorOffsetX
      const relY = offsetY - this.staticCache.anchorOffsetY
      const withinPaddedWindow =
        this.staticCache.key === cacheKey &&
        this.staticCache.handle !== null &&
        relX >= 0 &&
        relY >= 0 &&
        relX + vp.vpW <= this.staticCache.w &&
        relY + vp.vpH <= this.staticCache.h
      if (cacheUsable && withinPaddedWindow && this.staticCache.handle) {
        drawOptions.atlas = this.staticCache.handle
        drawOptions.width = vp.vpW * invZoom
        drawOptions.height = vp.vpH * invZoom
        drawOptions.tint = AUTOMAP_FADE_TINTS[0]!
        renderer.draw(
          { x: relX, y: relY, width: vp.vpW, height: vp.vpH },
          toWorldX(vp.vpX),
          toWorldY(vp.vpY),
          drawOptions,
        )
        this.lastRenderStats.spritesDrawn.floors = this.staticCache.spriteCounts.floors
        this.lastRenderStats.spritesDrawn.walls = this.staticCache.spriteCounts.walls
        this.lastRenderStats.spritesDrawn.objects = this.staticCache.spriteCounts.objects
        this.lastRenderStats.spritesDrawn.extras = this.staticCache.spriteCounts.extras
        this.lastRenderStats.spritesDrawn.total += this.staticCache.spriteCounts.total
      } else {
        // 1. Layer 0 (`floors`)
        drawLayerCells(automapLayer.floors, 'floors', false)
        // 2. Layer 1 (`walls`)
        drawLayerCells(automapLayer.walls, 'walls', false)
        // 3. Layer 2 (`objects`)
        drawLayerCells(automapLayer.objects, 'objects', false)
        // 4. Layer 3 (`extras` — pre-revealed town entrances/crosses + revealed warps/waypoints/shrines)
        drawLayerCells(automapLayer.extras, 'extras', true)
        if (cacheUsable && !this.staticCache.uploading) {
          if (!isDistanceFade || this.staticCache.pendingKey === cacheKey) {
            this.buildStaticLayerCache(
              renderer,
              cacheKey,
              automapLayer,
              level,
              seen,
              vp,
              divisor,
              halfAnchorX,
              offsetX,
              offsetY,
              cachePad,
            )
          } else {
            this.staticCache.pendingKey = cacheKey
          }
        }
      }
    }

    // 5. Dynamic active Town Portals (`0x6fb11490`: `MaxiMap` / `MaxiMapS` frame 300 in Level 4, else 306/307)
    const maxiSheetName = resolveAutomapSheetName(0, this.bMinimap)
    const maxiMeta = AUTOMAP_UI_MANIFEST.atlases[maxiSheetName]
    const maxiAtlas = this.resolveAtlasHandle(renderer, maxiSheetName, maxiMeta)
    const effectiveLevelId = options?.levelId ?? level.levelId ?? 0
    if (options?.portals && maxiMeta && maxiAtlas) {
      for (const portal of options.portals) {
        if (portal.active === false) continue
        if (
          portal.kind === 'red' &&
          (effectiveLevelId === 111 ||
            effectiveLevelId === 112 ||
            effectiveLevelId === 117 ||
            (effectiveLevelId >= 125 && effectiveLevelId <= 127))
        ) {
          continue
        }
        const pClientX = Math.round(portal.x - originX)
        const pClientY = Math.round(portal.y - originY)
        const xPixel = Math.trunc(pClientX / 10)
        const yPixel = Math.trunc(pClientY / 10)
        const cellNo =
          effectiveLevelId === 4 ? 300 : portal.isLocalPlayerOwner === false ? 307 : 306
        const frame = maxiMeta.frames[cellNo]
        if (!frame || frame.width <= 0 || frame.height <= 0) continue
        const screenX = Math.trunc((xPixel * 10) / divisor) - offsetX
        const screenY = Math.trunc((yPixel * 10) / divisor) - offsetY
        const drawLeft = screenX + frame.offsetX - halfAnchorX
        const drawTop = screenY - frame.height + frame.offsetY
        if (
          drawLeft + frame.width < vp.vpX ||
          drawLeft > vpRight ||
          drawTop + frame.height < vp.vpY ||
          drawTop > vpBottom
        ) {
          continue
        }
        drawOptions.atlas = maxiAtlas
        drawOptions.width = frame.width * invZoom
        drawOptions.height = frame.height * invZoom
        drawOptions.tint = uniformTint
        renderer.draw(
          frame,
          toWorldX(drawLeft),
          toWorldY(drawTop),
          drawOptions,
        )
        this.lastRenderStats.spritesDrawn.portals += 1
        this.lastRenderStats.spritesDrawn.total += 1
        if (portal.label) {
          this.lastRenderStats.warpLabels.push({
            text: portal.label,
            x: screenX,
            y: screenY - 8,
            color: 'blue',
            kind: 'portal',
          })
        }
      }
    }

    // 5a. Top-layer enlarged (2x) & highlighted Waypoint icon (`MaxiMap` / `MaxiMapS` frame 307)
    if (options?.highlightWaypoints && maxiMeta && maxiAtlas) {
      const wpFrame = maxiMeta.frames[307]
      if (wpFrame && wpFrame.width > 0 && wpFrame.height > 0) {
        const scaledW = wpFrame.width * AUTOMAP_WAYPOINT_HIGHLIGHT_SCALE
        const scaledH = wpFrame.height * AUTOMAP_WAYPOINT_HIGHLIGHT_SCALE
        const shiftLeft = wpFrame.width * (AUTOMAP_WAYPOINT_HIGHLIGHT_SCALE - 1) * 0.5
        const shiftTop = wpFrame.height * (AUTOMAP_WAYPOINT_HIGHLIGHT_SCALE - 1) * 0.75

        const drawHighlightedWaypointAt = (xPixel: number, yPixel: number): void => {
          const screenX = Math.trunc((xPixel * 10) / divisor) - offsetX
          const screenY = Math.trunc((yPixel * 10) / divisor) - offsetY
          const drawLeft = screenX + wpFrame.offsetX - halfAnchorX
          const drawTop = screenY - wpFrame.height + wpFrame.offsetY
          const scaledLeft = drawLeft - shiftLeft
          const scaledTop = drawTop - shiftTop
          if (
            scaledLeft + scaledW < vp.vpX ||
            scaledLeft > vpRight ||
            scaledTop + scaledH < vp.vpY ||
            scaledTop > vpBottom
          ) {
            return
          }
          const alpha = isDistanceFade
            ? this.getCellFadeAlpha(screenX, screenY, vp.centerX, vp.centerY, this.bMinimap)
            : uniformTint[3]
          drawOptions.atlas = maxiAtlas
          drawOptions.width = scaledW * invZoom
          drawOptions.height = scaledH * invZoom
          drawOptions.tint = [
            AUTOMAP_WAYPOINT_HIGHLIGHT_TINT[0],
            AUTOMAP_WAYPOINT_HIGHLIGHT_TINT[1],
            AUTOMAP_WAYPOINT_HIGHLIGHT_TINT[2],
            alpha,
          ]
          renderer.draw(
            wpFrame,
            toWorldX(scaledLeft),
            toWorldY(scaledTop),
            drawOptions,
          )
          this.lastRenderStats.spritesDrawn.waypoints += 1
          this.lastRenderStats.spritesDrawn.total += 1
        }

        for (const cell of automapLayer.floors) {
          if ((cell.fSaved ?? 0) !== 0) continue
          if (cell.cellNo !== 307 && cell.cellNo !== 618) continue
          if (!this.isAutomapCellRevealed(level, seen, cell)) continue
          drawHighlightedWaypointAt(cell.xPixel, cell.yPixel)
        }
        for (const cell of automapLayer.objects) {
          if ((cell.fSaved ?? 0) !== 0) continue
          if (cell.cellNo !== 307) continue
          if (!this.isAutomapCellRevealed(level, seen, cell)) continue
          drawHighlightedWaypointAt(cell.xPixel, cell.yPixel)
        }
        for (const marker of level.markers) {
          if (marker.kind !== 'waypoint') continue
          const isRevealed =
            marker.preRevealed === true ||
            (marker.preRevealed === undefined && level.preRevealTown === true) ||
            this.isCellExplored(level, marker.cellX, marker.cellY)
          if (!isRevealed) continue
          const coords = computeAutomapObjectPixelCoords(
            marker.cellX * 5 + 2,
            marker.cellY * 5 + 2,
          )
          drawHighlightedWaypointAt(coords.xPixel, coords.yPixel)
        }
      }
    }

    // 5b. Dynamic Shrine Radar Icons & Badges (Issue #881)
    if (options?.shrines) {
      for (const shrine of options.shrines) {
        const sClientX = Math.round(shrine.x - originX)
        const sClientY = Math.round(shrine.y - originY)
        const sx = Math.trunc(sClientX / vp.divisor) - offsetX
        const sy = Math.trunc(sClientY / vp.divisor) - offsetY - 8
        if (sx < vp.vpX || sx > vpRight || sy < vp.vpY || sy > vpBottom) {
          continue
        }
        const badge = resolveAutomapShrineBadge(shrine.shrineCode)
        const isActive = shrine.mode === 0
        const alpha = isActive ? 1.0 : 0.35
        const baseMarkerColor = shrine.markerColor ?? badge.markerColor
        const tintedMarkerColor: readonly [number, number, number, number] = [
          baseMarkerColor[0],
          baseMarkerColor[1],
          baseMarkerColor[2],
          baseMarkerColor[3] * alpha,
        ]
        this.drawCrosshairPolygon(
          renderer,
          sx,
          sy,
          this.bMinimap,
          tintedMarkerColor,
          toWorldX,
          toWorldY,
          zoom,
          isActive,
        )
        if (
          shrine.overlayAtlas &&
          shrine.overlayFrame &&
          shrine.overlayFrame.width > 0 &&
          shrine.overlayFrame.height > 0
        ) {
          const iconScale = this.bMinimap ? 0.35 : 0.55
          const iconW = Math.max(4, Math.round(shrine.overlayFrame.width * iconScale))
          const iconH = Math.max(4, Math.round(shrine.overlayFrame.height * iconScale))
          const iconLeft = sx - Math.round(iconW / 2)
          const iconTop = sy - iconH - 2
          drawOptions.atlas = shrine.overlayAtlas
          drawOptions.width = iconW * invZoom
          drawOptions.height = iconH * invZoom
          drawOptions.tint = [1.0, 1.0, 1.0, alpha]
          drawOptions.blendMode = 'additive'
          renderer.draw(
            shrine.overlayFrame,
            toWorldX(iconLeft),
            toWorldY(iconTop),
            drawOptions,
          )
          drawOptions.blendMode = 'normal'
        }
        this.lastRenderStats.spritesDrawn.shrines += 1
        this.lastRenderStats.spritesDrawn.total += 1
        if (isActive) {
          const labelText = shrine.shortLabel ?? badge.shortEn
          const labelColor = shrine.labelColor ?? badge.labelColor
          this.lastRenderStats.warpLabels.push({
            text: labelText,
            x: sx,
            y: sy - 10,
            color: labelColor,
            kind: 'shrine',
          })
        }
      }
    }

    // 6. Dynamic Entity Crosshairs (`AUTOMAP_DrawCrosshair` @ `0x6fb11490` & `0x6fabd390`)
    if (options?.entities) {
      for (const entity of options.entities) {
        if (entity.kind !== 'corpse' && entity.alive === false) continue
        if (entity.classId === 537 || entity.classId === 538 || entity.classId === 539) continue

        const eClientX = Math.round(entity.x - originX)
        const eClientY = Math.round(entity.y - originY)
        const ex = Math.trunc(eClientX / vp.divisor) - offsetX
        const ey = Math.trunc(eClientY / vp.divisor) - offsetY - 8
        if (ex < vp.vpX || ex > vp.vpX + vp.vpW || ey < vp.vpY || ey > vp.vpY + vp.vpH) {
          continue
        }

        let color: readonly [number, number, number, number] = AUTOMAP_CROSSHAIR_COLORS.npc
        let isBold = false
        if (entity.kind === 'player') {
          color = AUTOMAP_CROSSHAIR_COLORS.player
          this.lastRenderStats.crosshairsDrawn.player += 1
        } else if (entity.kind === 'party') {
          color = AUTOMAP_CROSSHAIR_COLORS.party
          this.lastRenderStats.crosshairsDrawn.party += 1
        } else if (entity.kind === 'nonPartyPlayer') {
          color = AUTOMAP_CROSSHAIR_COLORS.nonPartyPlayer
        } else if (entity.kind === 'corpse') {
          color = AUTOMAP_CROSSHAIR_COLORS.corpse
        } else if (entity.kind === 'npc') {
          color = AUTOMAP_CROSSHAIR_COLORS.npc
          this.lastRenderStats.crosshairsDrawn.npcs += 1
        } else if (entity.kind === 'ownPet' || entity.kind === 'mercenary') {
          color = AUTOMAP_CROSSHAIR_COLORS.ownPet
          this.lastRenderStats.crosshairsDrawn.mercenaries += 1
        } else if (entity.kind === 'partyPet') {
          color = AUTOMAP_CROSSHAIR_COLORS.partyPet
          this.lastRenderStats.crosshairsDrawn.mercenaries += 1
        } else if (entity.kind === 'summon') {
          color =
            entity.classId === 357 || entity.classId === 291
              ? AUTOMAP_CROSSHAIR_COLORS.valkyrieOrIronGolem
              : AUTOMAP_CROSSHAIR_COLORS.ownPet
          this.lastRenderStats.crosshairsDrawn.mercenaries += 1
        } else if (entity.kind === 'monsterNormal') {
          color = AUTOMAP_MONSTER_COLORS.monsterNormal
          this.lastRenderStats.crosshairsDrawn.monsters += 1
        } else if (entity.kind === 'monsterMinion') {
          color = AUTOMAP_MONSTER_COLORS.monsterMinion
          this.lastRenderStats.crosshairsDrawn.monsters += 1
        } else if (entity.kind === 'monsterChampion') {
          color = AUTOMAP_MONSTER_COLORS.monsterChampion
          this.lastRenderStats.crosshairsDrawn.monsters += 1
        } else if (entity.kind === 'monsterUnique' || entity.kind === 'unique') {
          color = AUTOMAP_MONSTER_COLORS.monsterUnique
          isBold = true
          this.lastRenderStats.crosshairsDrawn.monsters += 1
          this.lastRenderStats.crosshairsDrawn.bosses += 1
        } else if (entity.kind === 'monsterSuperUnique' || entity.kind === 'superunique') {
          color = AUTOMAP_MONSTER_COLORS.monsterSuperUnique
          isBold = true
          this.lastRenderStats.crosshairsDrawn.monsters += 1
          this.lastRenderStats.crosshairsDrawn.bosses += 1
        } else {
          color = AUTOMAP_CROSSHAIR_COLORS.boss
          this.lastRenderStats.crosshairsDrawn.bosses += 1
        }

        this.drawCrosshairPolygon(
          renderer,
          ex,
          ey,
          this.bMinimap,
          color,
          toWorldX,
          toWorldY,
          zoom,
          isBold,
        )
        this.lastRenderStats.crosshairsDrawn.total += 1

        if (
          this.showNames &&
          entity.name &&
          (entity.kind === 'party' ||
            entity.kind === 'npc' ||
            entity.kind === 'monsterSuperUnique' ||
            entity.kind === 'superunique')
        ) {
          this.lastRenderStats.entityLabels.push({
            text: entity.name,
            x: ex,
            y: ey - 10,
            color:
              entity.kind === 'npc'
                ? 'gold'
                : entity.kind === 'party'
                  ? 'green'
                  : 'purple',
            kind: 'entity',
          })
        }
      }
    }

    // 7. Player 12-segment closed directional polygon crosshair (`AUTOMAP_DrawDynamicUnit` @ `0x6fb119e0` -> `0x6fb0f1c0`)
    const playerScreenX = Math.trunc(playerClientX / vp.divisor) - offsetX
    const playerScreenY = Math.trunc(playerClientY / vp.divisor) - offsetY - 8
    if (
      playerScreenX >= vp.vpX &&
      playerScreenX <= vp.vpX + vp.vpW &&
      playerScreenY >= vp.vpY &&
      playerScreenY <= vp.vpY + vp.vpH
    ) {
      this.drawCrosshairPolygon(
        renderer,
        playerScreenX,
        playerScreenY,
        this.bMinimap,
        AUTOMAP_CROSSHAIR_COLORS.player,
        toWorldX,
        toWorldY,
        zoom,
      )
      this.lastRenderStats.crosshairsDrawn.player += 1
      this.lastRenderStats.crosshairsDrawn.total += 1
    }

    // Disable WebGL scissor test after flushing the automap batch
    if (gl && typeof gl.disable === 'function') {
      renderer.flush()
      gl.disable(gl.SCISSOR_TEST)
    }

    // 8. Collect revealed Warp destination labels & Stash labels (`Font6`)
    for (const marker of level.markers) {
      if (marker.kind !== 'exit' || !marker.targetName) continue
      const markerRevealed =
        marker.preRevealed === true ||
        (marker.preRevealed === undefined && level.preRevealTown === true) ||
        this.isCellExplored(level, marker.cellX, marker.cellY)
      if (!markerRevealed) continue
      const subTileX = marker.cellX * 5 + 2
      const subTileY = marker.cellY * 5 + 2
      const coords = computeAutomapObjectPixelCoords(subTileX, subTileY)
      const lx = Math.trunc((coords.xPixel * 10) / vp.divisor) - offsetX
      const ly = Math.trunc((coords.yPixel * 10) / vp.divisor) - offsetY - 8
      if (lx >= vp.vpX && lx <= vp.vpX + vp.vpW && ly >= vp.vpY && ly <= vp.vpY + vp.vpH) {
        this.lastRenderStats.warpLabels.push({
          text: marker.targetName,
          x: lx,
          y: ly,
          color: 'white',
          kind: 'warp',
        })
      }
    }

    if (options?.stashes) {
      for (const stash of options.stashes) {
        const sClientX = Math.round(stash.x - originX)
        const sClientY = Math.round(stash.y - originY)
        const sx = Math.trunc(sClientX / vp.divisor) - offsetX
        const sy = Math.trunc(sClientY / vp.divisor) - offsetY - 8
        if (sx >= vp.vpX && sx <= vp.vpX + vp.vpW && sy >= vp.vpY && sy <= vp.vpY + vp.vpH) {
          this.lastRenderStats.warpLabels.push({
            text: stash.label || stash.name || 'Stash',
            x: sx,
            y: sy,
            color: 'gold',
            kind: 'stash',
          })
        }
      }
    }

    // 9. Top-Right right-aligned gold `Font16` HUD text (Line 1: Level Name, Line 2: Difficulty)
    const levelName = options?.levelName ?? level.levelName ?? ''
    const difficulty = options?.difficulty ?? level.difficulty ?? 'Normal'
    if (levelName) {
      this.lastRenderStats.hudText = {
        levelName,
        difficulty,
        x: 800 - 16,
        y1: 16,
        y2: 34,
      }
    }
  }

  /**
   * Renders the automap 2D text overlays onto the HUD canvas:
   * - Revealed warp destination area names and `"Stash"` labels (`Font6`, centered)
   * - Friendly NPC / party member names when `showNames` is true (`Font6`, centered at `(x, y - 6)`)
   * - Top-right right-aligned gold `Font16` Level Name (Line 1) and Difficulty (Line 2)
   */
  drawHudOverlay(
    ctx: CanvasRenderingContext2D,
    font: D2FontRenderer,
    logicalWidth = 800,
    logicalHeight = 600,
  ): number | null {
    if (!this.visible) return null

    const vp = this.lastRenderStats.viewport
    const scaleX = vp.screenWidth > 0 && logicalWidth > 0 ? logicalWidth / vp.screenWidth : 1
    const scaleY = vp.screenHeight > 0 && logicalHeight > 0 ? logicalHeight / vp.screenHeight : 1

    // 1. Warp & Stash labels (`Font6`)
    for (const label of this.lastRenderStats.warpLabels) {
      const lx = Math.round(label.x * scaleX)
      const ly = Math.round(label.y * scaleY)
      font.drawText(ctx, label.text, lx, ly, {
        font: 'font6',
        color: label.color,
        align: 'center',
        shadow: true,
      })
    }

    // 2. Friendly NPC / Party member name labels (`Font6`) when `showNames` is enabled
    if (this.showNames) {
      for (const label of this.lastRenderStats.entityLabels) {
        const lx = Math.round(label.x * scaleX)
        const ly = Math.round(label.y * scaleY)
        font.drawText(ctx, label.text, lx, ly, {
          font: 'font6',
          color: label.color,
          align: 'center',
          shadow: true,
        })
      }
    }

    // 3. Top-right right-aligned gold `Font16` Level Name (Line 1) & Difficulty (Line 2)
    const hudText = this.lastRenderStats.hudText
    if (hudText && hudText.levelName) {
      const rightX = logicalWidth - 16
      font.drawText(ctx, hudText.levelName, rightX, hudText.y1, {
        font: 'font16',
        color: 'gold',
        align: 'right',
        shadow: true,
      })
      if (hudText.difficulty) {
        font.drawText(ctx, hudText.difficulty, rightX, hudText.y2, {
          font: 'font16',
          color: 'gold',
          align: 'right',
          shadow: true,
        })
      }
      return rightX - font.measureText(hudText.levelName, 'font16')
    }
    return null
  }

  /**
   * Draws the 12-segment closed directional polygon crosshair (`AUTOMAP_DrawCrosshair` @ `0x6fb11490`).
   */
  private drawCrosshairPolygon(
    renderer: SpriteRenderer,
    cx: number,
    cy: number,
    bMinimap: boolean,
    color: readonly [number, number, number, number],
    toWorldX: (sx: number) => number,
    toWorldY: (sy: number) => number,
    zoom: number,
    bold = false,
  ): readonly AutomapCrosshairSegment[] {
    const segments = getCrosshairSegments(cx, cy, bMinimap)
    const hasQuad = typeof (renderer as { drawSolidQuad?: unknown }).drawSolidQuad === 'function'
    const halfThickness = (bold ? 1.35 : 0.75) / zoom
    const minStroke = (bold ? 2 : 1) / zoom

    for (const seg of segments) {
      const x1 = toWorldX(seg.x0)
      const y1 = toWorldY(seg.y0)
      const x2 = toWorldX(seg.x1)
      const y2 = toWorldY(seg.y1)
      if (hasQuad) {
        const dx = x2 - x1
        const dy = y2 - y1
        const len = Math.hypot(dx, dy) || 1
        const nx = (-dy / len) * halfThickness
        const ny = (dx / len) * halfThickness
        renderer.drawSolidQuad(
          x1 + nx,
          y1 + ny,
          x2 + nx,
          y2 + ny,
          x2 - nx,
          y2 - ny,
          x1 - nx,
          y1 - ny,
          color,
        )
      } else {
        const left = Math.min(x1, x2)
        const top = Math.min(y1, y2)
        const w = Math.max(minStroke, Math.abs(x2 - x1))
        const h = Math.max(minStroke, Math.abs(y2 - y1))
        renderer.drawSolid(left, top, w, h, color)
      }
    }
    return segments
  }

  /**
   * Checks whether an `AutomapCell` lies in an explored tile of `level`.
   */
  private isAutomapCellRevealed(
    level: MinimapLevel,
    seen: Uint8Array,
    cell: AutomapCell,
  ): boolean {
    if (level.cellsX <= 0 || level.cellsY <= 0) return false
    if (cell.preRevealed === true) return true
    if (cell.preRevealed === undefined && level.preRevealTown === true) return true
    let cellX = cell.cellX
    let cellY = cell.cellY
    if (typeof cellX !== 'number' || !Number.isFinite(cellX) || typeof cellY !== 'number' || !Number.isFinite(cellY)) {
      const isoX = (cell.xPixel * 10) / 16
      const isoY = (cell.yPixel * 10) / 8
      cellX = Math.floor(Math.round((isoX + isoY) / 2) / 5)
      cellY = Math.floor(Math.round((isoY - isoX) / 2) / 5)
    }
    if (cellX >= 0 && cellX < level.cellsX && cellY >= 0 && cellY < level.cellsY) {
      if (seen[cellY * level.cellsX + cellX] !== 0) return true
    }
    if (level.layerKey !== undefined) {
      const worldSet = this.exploredWorldTilesByLayer.get(level.layerKey)
      if (worldSet !== undefined && worldSet.size > 0) {
        const tileOriginX = level.tileOriginX ?? 0
        const tileOriginY = level.tileOriginY ?? 0
        return worldSet.has(this.packWorldCell(tileOriginX + cellX, tileOriginY + cellY))
      }
    }
    return false
  }

  /**
   * Resolves the `AtlasHandle` for `sheetName`.
   */
  canCreateCacheCanvas(): boolean {
    return typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined'
  }

  /**
   * Composite the 4 static automap layers into the cache canvas at 1:1 screen
   * pixels (cell iteration mirrors `drawLayerCells`, fog-of-war and distance
   * fade included — fade tints are alpha-only, so `globalAlpha` reproduces
   * them exactly), then re-upload it into the persistent cache texture slot.
   * Async: the blit path activates once the upload lands (`staticCache.key`).
   */
  private buildStaticLayerCache(
    renderer: SpriteRenderer,
    key: string,
    automapLayer: MinimapLevel['automap'],
    level: MinimapLevel,
    seen: Uint8Array,
    vp: {
      readonly vpX: number
      readonly vpY: number
      readonly vpW: number
      readonly vpH: number
      readonly centerX: number
      readonly centerY: number
    },
    divisor: number,
    halfAnchorX: number,
    offsetX: number,
    offsetY: number,
    pad = 0,
  ): void {
    const w = Math.max(1, Math.round(vp.vpW)) + pad * 2
    const h = Math.max(1, Math.round(vp.vpH)) + pad * 2
    const anchorOffsetX = offsetX - pad
    const anchorOffsetY = offsetY - pad
    if (this.staticCache.canvas === null || this.staticCache.canvas.w !== w || this.staticCache.canvas.h !== h) {
      if (this.staticCache.handle !== null) {
        renderer.deleteAtlas(this.staticCache.handle)
        this.staticCache.handle = null
      }
      const surface: OffscreenCanvas | HTMLCanvasElement =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(w, h)
          : document.createElement('canvas')
      surface.width = w
      surface.height = h
      this.staticCache.canvas = { w, h, surface }
    }
    const surface = this.staticCache.canvas.surface
    const c2d = surface.getContext('2d')
    if (!c2d) return
    c2d.imageSmoothingEnabled = false
    c2d.clearRect(0, 0, w, h)
    const isDistanceFade = this.fadeState === 1 && !this.bMinimap
    const uniformAlpha = AUTOMAP_FADE_TINTS[this.fadeState]![3]

    const composeCells = (
      cells: readonly AutomapCell[],
      ignoreFogOfWar: boolean,
    ): void => {
      for (const cell of cells) {
        const sheetName = resolveAutomapSheetName(cell.fSaved ?? 0, this.bMinimap)
        const bitmap = this.atlasSources.get(sheetName)
        const sheetMeta = AUTOMAP_UI_MANIFEST.atlases[sheetName]
        if (!bitmap || !sheetMeta) continue
        if (cell.cellNo < 0 || cell.cellNo >= sheetMeta.frames.length) continue
        if ((!ignoreFogOfWar || cell.preRevealed === false) && !this.isAutomapCellRevealed(level, seen, cell)) continue
        const frame = sheetMeta.frames[cell.cellNo]!
        if (frame.width <= 0 || frame.height <= 0) continue
        const screenX = Math.trunc((cell.xPixel * 10) / divisor) - anchorOffsetX
        const screenY = Math.trunc((cell.yPixel * 10) / divisor) - anchorOffsetY
        const drawLeft = screenX + frame.offsetX - halfAnchorX
        const drawTop = screenY - frame.height + frame.offsetY
        const canvasX = Math.round(drawLeft - vp.vpX)
        const canvasY = Math.round(drawTop - vp.vpY)
        if (canvasX + frame.width < 0 || canvasX > w || canvasY + frame.height < 0 || canvasY > h) {
          continue
        }
        c2d.globalAlpha = isDistanceFade
          ? this.getCellFadeAlpha(screenX, screenY, vp.centerX, vp.centerY, this.bMinimap)
          : uniformAlpha
        c2d.drawImage(
          bitmap,
          frame.x,
          frame.y,
          frame.width,
          frame.height,
          canvasX,
          canvasY,
          frame.width,
          frame.height,
        )
      }
    }
    composeCells(automapLayer.floors, false)
    composeCells(automapLayer.walls, false)
    composeCells(automapLayer.objects, false)
    composeCells(automapLayer.extras, true)
    c2d.globalAlpha = 1

    const spriteCounts = {
      floors: this.lastRenderStats.spritesDrawn.floors,
      walls: this.lastRenderStats.spritesDrawn.walls,
      objects: this.lastRenderStats.spritesDrawn.objects,
      extras: this.lastRenderStats.spritesDrawn.extras,
      total:
        this.lastRenderStats.spritesDrawn.floors +
        this.lastRenderStats.spritesDrawn.walls +
        this.lastRenderStats.spritesDrawn.objects +
        this.lastRenderStats.spritesDrawn.extras,
    }
    this.staticCache.uploading = true
    void this.uploadStaticLayerCache(
      renderer,
      key,
      surface,
      anchorOffsetX,
      anchorOffsetY,
      w,
      h,
      spriteCounts,
    )
  }

  private async uploadStaticLayerCache(
    renderer: SpriteRenderer,
    key: string,
    surface: OffscreenCanvas | HTMLCanvasElement,
    anchorOffsetX: number,
    anchorOffsetY: number,
    w: number,
    h: number,
    spriteCounts: {
      floors: number
      walls: number
      objects: number
      extras: number
      total: number
    },
  ): Promise<void> {
    try {
      if (typeof createImageBitmap !== 'function') return
      const bmp = await createImageBitmap(surface)
      if (
        this.staticCache.handle !== null &&
        this.staticCache.handle.width === bmp.width &&
        this.staticCache.handle.height === bmp.height
      ) {
        renderer.updateAtlas(this.staticCache.handle, bmp)
      } else {
        if (this.staticCache.handle !== null) {
          renderer.deleteAtlas(this.staticCache.handle)
        }
        this.staticCache.handle = renderer.addAtlas(bmp, bmp.width, bmp.height)
      }
      bmp.close()
      this.staticCache.anchorOffsetX = anchorOffsetX
      this.staticCache.anchorOffsetY = anchorOffsetY
      this.staticCache.w = w
      this.staticCache.h = h
      this.staticCache.spriteCounts = spriteCounts
      this.staticCache.key = key
    } catch {
      // Keep the direct per-cell path on any compositing/upload failure.
    } finally {
      this.staticCache.uploading = false
    }
  }

  private resolveAtlasHandle(
    _renderer: SpriteRenderer,
    sheetName: AutomapSpriteKey,
    _meta: AutomapSpriteAtlasMeta | undefined,
  ): AtlasHandle | null {
    return this.atlases.get(sheetName) ?? null
  }

  /**
   * The explored bytes for a level, created on first use.
   */
  private seenFor(level: MinimapLevel): Uint8Array {
    let seen = this.explored.get(level.key)
    if (seen === undefined || seen.length !== level.cellsX * level.cellsY) {
      seen = new Uint8Array(level.cellsX * level.cellsY)
      this.explored.set(level.key, seen)
      this.preRevealedTownLevels.delete(level.key)
      this.lastRevealCellPos.delete(level.key)
    }
    return seen
  }
}
