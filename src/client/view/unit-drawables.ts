import {
  CANONICAL_113C_MISSILES,
  CANONICAL_113C_OVERLAYS,
  MISSILE_CLASS_ID_TO_KEY,
  getMissileTxtData,
  getOverlayTxtData,
  getSkillCastOverlay,
} from '../../common/skills/missiles-data.ts'
import { BAKED_UI_MANIFEST } from '../../common/items/baked-ui-meta.ts'
import { d2Rand, LIGHT_SEED_HI, lightPos8, PLAYER_LIGHT_RADIUS } from '../../common/drlg/light-grid.ts'
import {
  DEFAULT_AMAZON_APPEARANCE,
  VALKYRIE_113C_APPEARANCE,
  appearanceKey,
  applyStateItemTransToAppearance,
  type SorceressAppearanceSpec,
} from '../../common/units/char-appearance.ts'
import {
  MISSILE_LIGHT_113C,
  missileLight113c,
  monsterLight113c,
  skillCastLight113c,
} from '../../common/units/light-sources-113c.ts'
import { resolveMonsterColormap113c } from '../../common/units/monster-colormap-113c.ts'
import { isMonsterSubmergedMode113c } from '../../common/units/monai-113c.ts'
import {
  MONSTATS2_FLAGINDEX,
  computeOverlayYOffset113c,
  hasMonStats2Flag,
} from '../../common/units/monstats2-flags.ts'
import { DEFAULT_RED_TRANSFORM_113C, DEFAULT_REVIVE_TRANSFORM_113C } from '../../common/formats/pl2.ts'
import { colormapPaletteRow } from '../render/colormap-rows.ts'
import { assertDir64, dir64FromPoints, dir64ToClipDirection, dir64ToDcc } from '../../common/units/direction.ts'
import { reportMissingArt } from '../../client/scene/missing-art.ts'
import type { OverlayTxtRow } from '../../common/data/overlay-txt-row-type.ts'
import type { UnitKind, UnitSnapshot } from '../../netproto/index.ts'
import type { LightEmitterInput, PointLightInput } from '../../client/scene/lighting-presets.ts'
export type { LightEmitterInput, PointLightInput }
import type { StatListReaderLike } from '../../common/units/char-anim-speed.ts'
import type { ClientUnitOverlay, UnitCastState } from '../world/client-unit.ts'
import { INNATE_LOOP_MONSTER_OVERLAY_BY_CLASS_113C } from '../world/monster-overlays-113c.ts'
import { isStateCastOverlayPlaying113c } from '../world/state-cast-overlay-113c.ts'
import {
  OBJECT_LIGHT_INTENSITY,
  OBJECT_LIGHT_MAX_RADIUS,
  type RenderableObjectLight,
} from '../world/object-light.ts'
import {
  AUTHENTIC_113C_OVERLAYS,
  OVERLAY_METAS,
  STATE_OVERLAYS,
  STATE_PGSV_OVERLAYS,
} from '../render/overlays-meta.ts'
import { OVERLAY_TXT_ROWS } from '../render/overlay-txt-rows.ts'
import { subTileToWorldOrtho } from './viewport-profile.ts'
import { missileTransToDrawBlend, overlayTransToDrawBlend } from '../../common/gfx/draw-mode.ts'

type MissileTxtEntry = NonNullable<ReturnType<typeof getMissileTxtData>>

export type DrawableBlendMode =
  | 'normal'
  | 'additive'
  | 'trans25'
  | 'trans50'
  | 'trans75'
  | 'modulate'
  | 'burn'
  | 'transhighlight'
  | 'highlight'

/**
 * Missiles.txt `Trans` -> {@link DrawableBlendMode}.
 *
 * D2Client 0x6FB1CF32-0x6FB1CF4C remaps the column to a D2gfx eDrawMode (0/empty -> 5 NORMAL, 1 -> 3 additive
 * ONE/ONE, 2 -> 4 multiply ZERO/SRC_COLOR, D2MOO name BURN) before D2gfx #10041; see
 * {@link missileTransToDrawMode} and kb/render/d2gfx-draw-mode-113c.md.
 */
export function transToBlendMode(trans: number | undefined): DrawableBlendMode {
  return missileTransToDrawBlend(trans ?? 0)
}

/**
 * Overlay.txt `Trans` -> {@link DrawableBlendMode}.
 *
 * The column IS the D2gfx eDrawMode: D2Client 0x6FB1B11D `movzx ecx, byte [ebx+0x7C]` -> 0x6FB1B12E `push ecx` ->
 * D2gfx #10041 (same at 0x6FB1B2B2/0x6FB1B2D0). 0 trans25, 1 trans50, 2 trans75, 3 additive, 4 multiply ('burn'),
 * 5 normal (energyshield, fetishdeath1, durieldead_*), 6/7/>=8 normal (tentacleheadbloodripple = 8).
 */
export function overlayTransToBlendMode(trans: number): DrawableBlendMode {
  return overlayTransToDrawBlend(trans)
}

/**
 * 1.13c D2Client overlay frame stepping with `LoopWaitTime` pause (#1717):
 * - `OVERLAY_Create` (`0x6FB1B300`) sets `inst+0x14 = AnimRate << 4` (`0x6FB1B558`) and `inst+0x28 = LoopWaitTime` (`0x6FB1B57B`).
 * - Each 25 Hz tick advances the 8.8 frame counter by `AnimRate << 4` (`AnimRate / 16` frames per tick).
 * - When `LoopWaitTime > 0`, wrapping at `totalFrames << 8` (`0x6FB1C321`) clears the active flag (`inst+0x08 = 0`)
 *   and records `GetTickCount()` (`inst+0x30`); `0x6FB1C1FF` pauses for `LoopWaitTime` ms (`waitTicks = round(loopWaitTimeMs / 40)`)
 *   while `OVERLAY_Draw` (`0x6FB1B062` / `0x6FB1B1EC`) hides the overlay (`returns null`).
 */
export function computeOverlayLoopFrame113c(
  tick: number,
  totalFrames: number,
  animRate: number,
  loopWaitTimeMs = 0,
): number | null {
  const frames = Math.max(1, totalFrames)
  const rate = Math.max(1, animRate)
  const intTick = Math.floor(tick)
  if (!(loopWaitTimeMs > 0)) {
    const rawFrame = Math.floor((intTick * rate) / 16)
    return ((rawFrame % frames) + frames) % frames
  }
  const playTicks = Math.max(1, Math.ceil((frames * 16) / rate))
  const waitTicks = Math.max(0, Math.round(loopWaitTimeMs / 40))
  const cycleTicks = playTicks + waitTicks
  const cyclePos = ((intTick % cycleTicks) + cycleTicks) % cycleTicks
  if (cyclePos >= playTicks) {
    return null
  }
  return Math.min(frames - 1, Math.max(0, Math.floor((cyclePos * rate) / 16)))
}

export type SceneUnitKind = UnitKind | 'warp'

/**
 * One overlay of a unit. Its light (if any) is not an input: it is the compiled overlay.bin row of `token`
 * (InitRadius → Radius and Red/Green/Blue, created by 0x6fb1b4ca), see {@link buildSceneDrawables}.
 */
export interface UnitOverlayState {
  readonly overlayId: number
  readonly token?: string | undefined
  readonly frame?: number | undefined
  readonly totalFrames?: number | undefined
  readonly blendMode?: DrawableBlendMode | number | undefined
  readonly xOffset?: number | undefined
  readonly yOffset?: number | undefined
  readonly preDraw?: boolean | undefined
  readonly loop?: boolean | undefined
}

/**
 * Structural unit input compatible with both `UnitSnapshot` (from `src/netproto`)
 * and `ClientUnit` (from `src/client/world/unit-table.ts`).
 */
export interface UnitHitBox {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface RenderableUnitInput {
  readonly kind: SceneUnitKind
  readonly id: number
  readonly unitId?: number | undefined
  readonly classId: number
  readonly areaId?: number | undefined
  /** Sub-tile coordinates (may be fractional when interpolated by MotionPredictor). */
  readonly x: number
  readonly y: number
  readonly lightX?: number | undefined
  readonly lightY?: number | undefined
  /** Target sub-tile for moving units / missiles. */
  readonly targetX?: number | undefined
  readonly targetY?: number | undefined
  readonly mode?: number | undefined
  /**
   * Facing. Players, monsters, objects and items: a dir64 (`common/units/direction.ts`), kept
   * by the motion layer; 0 (south) when absent. Missiles: the 16-direction index or dir64 used when no
   * target is given.
   */
  readonly direction?: number | undefined
  readonly frame?: number | undefined
  readonly totalFrames?: number | undefined
  readonly loopAnim?: boolean | undefined
  readonly missileKey?: string | undefined
  readonly vx?: number | undefined
  readonly vy?: number | undefined
  readonly altitude?: number | undefined
  /** Missiles: path direction pinned by PATH_SetDirection + #10520(path, 0); draw `direction`, not the heading. */
  readonly fixedDirection?: boolean | undefined
  readonly ageTicks?: number | undefined
  readonly maxTicks?: number | undefined
  readonly lifePct?: number | undefined
  readonly name?: string | undefined
  readonly nameZh?: string | undefined
  readonly code?: string | undefined
  readonly itemQuality?: number | undefined
  readonly itemColor?: string | undefined
  readonly goldAmount?: number | undefined
  readonly token?: string | undefined
  readonly equipmentAppearance?: SorceressAppearanceSpec | undefined
  readonly appearanceKey?: string | undefined
  readonly overlays?: readonly UnitOverlayState[] | undefined
  readonly states?: ReadonlySet<number> | readonly number[] | Iterable<number> | undefined
  readonly isHovered?: boolean | undefined
  readonly isCorpse?: boolean | undefined
  /** True when the monster shattered (STATE_FREEZE / shatter_on_death) or exploded (goboom / suicideminion_explode). */
  readonly corpseSuppressed?: boolean | undefined
  /** True when D2Client UNITFLAG_DONOTDRAW (0x40000) is set (e.g. mephistodonotdraw MissCltHitFunc[34] 0x6FB607E0, nihlithak1). */
  readonly clientNoDraw?: boolean | undefined
  readonly quality?: number | undefined
  readonly isLocalPlayer?: boolean | undefined
  readonly hpRatio?: number | undefined
  readonly isChampion?: boolean | undefined
  readonly isUnique?: boolean | undefined
  readonly isSuperUnique?: boolean | undefined
  readonly superUniqueId?: number | undefined
  readonly warpId?: number | undefined
  readonly toLevelId?: number | undefined
  readonly radiusX?: number | undefined
  readonly radiusY?: number | undefined
  readonly itemCode?: string | undefined
  readonly flippyFile?: string | undefined
  readonly invFile?: string | undefined
  readonly invtransform?: string | undefined
  readonly castState?: UnitCastState | undefined
  readonly lastSkillId?: number | undefined
  readonly animMode?: string | undefined
  readonly animStartedAtMs?: number | undefined
  readonly animStepSpeed256?: number | undefined
  readonly animEffRate?: number | undefined
  /**
   * Objects: the light the object currently carries (unit+0x64 after SetObjectLight 0x6fad4920 and LightUpdate
   * 0x6fb59b50 easing; see `world/object-light.ts`), or absent when it has none. Nothing else makes an object light.
   */
  readonly objectPointLight?: RenderableObjectLight | undefined
  /** Complete STAT_VELOCITYPERCENT (67) total as tracked for the unit (locomotion anim scaling). */
  readonly velocityPercent?: number | undefined
  /**
   * Objects: identity of the object's light allocation (the #827 `ClientUnit.objectLight` object). A new identity is
   * SetObjectLight's Free + CreateLight, which re-creates the type-2 record at the head of the light list.
   */
  readonly objectLightAllocation?: object | undefined
  /** Monsters: MonUMod ids of the 0xAC packet (up to 9, zero-terminated and trimmed); drives the umod-3 light. */
  readonly bossMods?: readonly number[] | undefined
  /** Monsters: S2C 0xAC component bytes (HD..S8), selecting per-unit MonStats2 variants such as Skeletal Mage hands. */
  readonly compVariants?: readonly number[] | undefined
  /**
   * Missiles: radius set by an immediate SetRadius right after the missile's CreateLight (the meteor-centre client hit
   * spawns its light missile and calls SetRadius(12), 0x6fb66702). Absent → Missiles.txt `Light`.
   */
  readonly missileLightRadius?: number | undefined
  /** Missiles: created with param flag 0x4000, so 0x6FB630F0 made no light for it (0x6FB6365B `test ah,0x40`). */
  readonly missileNoLight?: boolean | undefined
  readonly portalOwnerName?: string | undefined
  readonly portalAreaId?: number | undefined
  readonly isPartyMember?: boolean | undefined
  /** Stat 89 item_lightradius of the player: radius 13 + v, ≤ 0 → unchanged (0x6fac8bc0). */
  readonly playerLightRadiusBonus?: number | undefined
  /** Stat 90 item_lightcolor of the player: 0 → white, else 0xRRGGBB (0x6fac89a0). */
  readonly playerLightColor?: number | undefined
  /** Unit stats accessor for resolving stats on remote players if bonus is not precalculated. */
  readonly stats?: StatListReaderLike | ReadonlyMap<number, number> | Record<number, number> | undefined
  readonly hitBox?: UnitHitBox | undefined
  readonly isSel?: boolean | undefined
  readonly noSel?: boolean | undefined
  readonly corpseSel?: boolean | undefined
  readonly paletteRow?: number | undefined
  /** Monsters: create-time palette index (gfx+0x38, `ClientUnit.paletteIndex`). */
  readonly paletteIndex?: number | undefined
  readonly sync?: number | boolean | undefined
  readonly isNpc?: boolean | undefined
  readonly wantsInteract?: boolean | undefined
  readonly interactType?: number | undefined
  readonly shrineType?: number | undefined
  readonly flags?: number | undefined
  readonly ownerType?: string | undefined
  readonly ownerId?: number | undefined
  readonly objectToken?: string | undefined
  readonly subtileX?: number | undefined
  readonly subtileY?: number | undefined
  readonly activeStates?: ReadonlySet<number> | readonly number[] | Iterable<number> | undefined
  readonly overheadText?: string | undefined
  readonly overheadColor?: number | undefined
  readonly isFaded?: boolean | undefined
  readonly hasInvisState?: boolean | undefined
  readonly chargeCounts?: ReadonlyMap<number, number> | Record<number, number> | undefined
  readonly maulCharges?: number | undefined
  readonly feralRageCharges?: number | undefined
}

export type RenderableUnit = RenderableUnitInput

export interface SceneUnitDrawable {
  readonly drawableKind: 'unit'
  readonly unitKind: SceneUnitKind
  readonly id: number
  readonly unitId: number
  readonly classId: number
  readonly token: string
  readonly code?: string | undefined
  readonly itemQuality?: number | undefined
  readonly itemColor?: string | undefined
  readonly goldAmount?: number | undefined
  readonly mode: number
  /** Facing as a dir64; the renderer picks the clip direction with `dir64ToClipDirection`. */
  readonly direction: number
  readonly frame: number
  readonly subX: number
  readonly subY: number
  readonly lightSubX?: number | undefined
  readonly lightSubY?: number | undefined
  readonly worldX: number
  readonly worldY: number
  readonly sortY: number
  readonly altitude?: number | undefined
  readonly blendMode: DrawableBlendMode
  readonly lifePct: number
  readonly name: string | undefined
  readonly nameZh?: string | undefined
  readonly isHovered: boolean
  readonly isCorpse: boolean
  readonly tintColor: readonly [number, number, number] | null
  readonly equipmentAppearance?: SorceressAppearanceSpec | undefined
  readonly appearanceKey?: string | undefined
  readonly overlays: readonly SceneOverlayDrawable[]
  readonly warpId?: number | undefined
  readonly toLevelId?: number | undefined
  readonly radiusX?: number | undefined
  readonly radiusY?: number | undefined
  readonly itemCode?: string | undefined
  readonly flippyFile?: string | undefined
  readonly invFile?: string | undefined
  readonly invtransform?: string | undefined
  readonly castState?: UnitCastState | undefined
  readonly lastSkillId?: number | undefined
  readonly animMode?: string | undefined
  readonly animStartedAtMs?: number | undefined
  readonly animStepSpeed256?: number | undefined
  readonly animEffRate?: number | undefined
  /** Complete STAT_VELOCITYPERCENT (67) total as tracked for the unit (locomotion anim scaling). */
  readonly velocityPercent?: number | undefined
  /** Monsters: S2C 0xAC component bytes (see `RenderableUnitInput.compVariants`). */
  readonly compVariants?: readonly number[] | undefined
  readonly isLocalPlayer?: boolean | undefined
  readonly portalOwnerName?: string | undefined
  readonly portalAreaId?: number | undefined
  readonly isPartyMember?: boolean | undefined
  readonly hitBox?: UnitHitBox | undefined
  readonly isSel?: boolean | undefined
  readonly noSel?: boolean | undefined
  readonly corpseSel?: boolean | undefined
  readonly paletteRow?: number | undefined
  readonly sync?: number | boolean | undefined
  readonly isNpc?: boolean | undefined
  readonly wantsInteract?: boolean | undefined
  readonly interactType?: number | undefined
  readonly shrineType?: number | undefined
  readonly flags?: number | undefined
  readonly isChampion?: boolean | undefined
  readonly isUnique?: boolean | undefined
  readonly isSuperUnique?: boolean | undefined
  readonly superUniqueId?: number | undefined
  readonly ownerType?: string | undefined
  readonly ownerId?: number | undefined
  readonly overheadText?: string | undefined
  readonly overheadColor?: number | undefined
  readonly isFaded?: boolean | undefined
  readonly hasInvisState?: boolean | undefined
  readonly states?: ReadonlySet<number> | readonly number[] | Iterable<number> | undefined
  readonly chargeCounts?: ReadonlyMap<number, number> | Record<number, number> | undefined
  readonly maulCharges?: number | undefined
  readonly feralRageCharges?: number | undefined
}

export interface SceneMissileDrawable {
  readonly drawableKind: 'missile'
  readonly unitId: number
  readonly missileClassId: number
  readonly missileKey: string
  readonly celFile: string
  readonly direction: number
  readonly frame: number
  readonly totalFrames?: number | undefined
  readonly loopAnim?: boolean | undefined
  readonly vx?: number | undefined
  readonly vy?: number | undefined
  readonly altitude?: number | undefined
  readonly subX: number
  readonly subY: number
  readonly lightSubX?: number | undefined
  readonly lightSubY?: number | undefined
  /**
   * 1.13c path (DrawGrid cell) sub-tile when it differs from the projected draw position `subX/subY`: the Meteor
   * family's `meteor`/`meteortail` are spawned AT the target sub-tile and only their screen projection is offset by
   * `UNIT_Set3DTrajectory` (0x6FB77E30, xOffset/zOffset), so DrawGrid buckets them into the target cell (#1340).
   * Absent = the path position is `subX/subY`.
   */
  readonly pathSubX?: number | undefined
  readonly pathSubY?: number | undefined
  readonly worldX: number
  readonly worldY: number
  readonly sortY: number
  readonly blendMode: DrawableBlendMode
  readonly trans: number
  /** Radius of the missile's light in sub-tiles (Missiles.txt `Light` or the SetRadius override); 0 = no light. */
  readonly lightRadius: number
  /** Missiles.txt Red/Green/Blue of the light. */
  readonly lightColor: readonly [number, number, number]
}

export interface SceneOverlayDrawable {
  readonly drawableKind: 'overlay'
  readonly ownerUnitId: number
  readonly overlayId: number
  readonly token: string
  readonly frame: number
  readonly totalFrames: number
  readonly loop?: boolean | undefined
  readonly preDraw?: boolean | undefined
  readonly xOffset?: number | undefined
  readonly subX?: number | undefined
  readonly subY?: number | undefined
  readonly worldX: number
  readonly worldY: number
  readonly sortY: number
  readonly blendMode: DrawableBlendMode
}

export type SceneEntityDrawable =
  | SceneUnitDrawable
  | SceneMissileDrawable
  | SceneOverlayDrawable

/**
 * 1.13c `Missiles.txt` row id (D2GS missile unit classId) -> missile key, derived from
 * `CANONICAL_113C_MISSILES` (exactly the Missiles.txt rows).
 * Ids without art data are absent: callers must treat them as unknown, never substitute another missile.
 */
export const MISSILE_ID_TO_KEY: Readonly<Record<number, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(CANONICAL_113C_MISSILES).map(([key, m]) => [m.id, key] as const),
  ),
)

export interface OverlayMeta {
  readonly overlayId: number
  readonly token: string
  readonly totalFrames: number
  readonly yOffset: number
}

/**
 * Canonical 1.13c `Overlay.txt` / `States.txt` visual metadata for common combat/buff overlays.
 * State 1 (Freeze) and State 2 (Poison) only apply STATE_COLOR_SHIFTS and have NO overlays.
 * Overlay lights are not here: they are the overlay.bin row of the token (`overlayLightRow`).
 */
export const OVERLAY_METADATA: Readonly<Record<number, OverlayMeta>> = {
  3: { overlayId: 3, token: 'aura_resistfire', totalFrames: 20, yOffset: 0 },
  4: { overlayId: 4, token: 'aura_resistcold', totalFrames: 20, yOffset: 0 },
  5: { overlayId: 5, token: 'aura_resistlight', totalFrames: 20, yOffset: 0 },
  8: { overlayId: 8, token: 'aura_resistall_front', totalFrames: 20, yOffset: 0 },
  9: { overlayId: 9, token: 'curseamplifydamage', totalFrames: 24, yOffset: -60 },
  10: { overlayId: 10, token: 'frozenarmor', totalFrames: 24, yOffset: 0 },
  19: { overlayId: 19, token: 'curseweaken', totalFrames: 24, yOffset: -60 },
  20: { overlayId: 20, token: 'chillarmor', totalFrames: 24, yOffset: 0 },
  23: { overlayId: 23, token: 'cursedimvision', totalFrames: 24, yOffset: -60 },
  28: { overlayId: 28, token: 'convictionback', totalFrames: 21, yOffset: 0 },
  30: { overlayId: 30, token: 'energyshield', totalFrames: 8, yOffset: 0 },
  32: { overlayId: 32, token: 'battleorders', totalFrames: 20, yOffset: 0 },
  33: { overlayId: 33, token: 'aura_might_front', totalFrames: 15, yOffset: 0 },
  49: { overlayId: 49, token: 'fanaticismfront', totalFrames: 30, yOffset: -1 },
  51: { overlayId: 51, token: 'battlecommand', totalFrames: 20, yOffset: 0 },
  55: { overlayId: 55, token: 'curseironmaiden', totalFrames: 29, yOffset: -60 },
  56: { overlayId: 56, token: 'curseterror', totalFrames: 20, yOffset: -60 },
  57: { overlayId: 57, token: 'curseattract', totalFrames: 24, yOffset: -60 },
  58: { overlayId: 58, token: 'cursereversevampire', totalFrames: 24, yOffset: -60 },
  59: { overlayId: 59, token: 'curseconfuse', totalFrames: 24, yOffset: -60 },
  60: { overlayId: 60, token: 'cursedecrepify', totalFrames: 24, yOffset: -60 },
  61: { overlayId: 61, token: 'curselowerresist', totalFrames: 29, yOffset: -60 },
  88: { overlayId: 88, token: 'shiverarmor', totalFrames: 24, yOffset: 0 },
  134: { overlayId: 134, token: 'energyshield', totalFrames: 8, yOffset: 0 },
}

export interface StatesTxtColorShiftRow113c {
  readonly stateId: number
  readonly state: string
  readonly colorpri: number
  readonly colorshift: number
  readonly lightRgb: readonly [number, number, number]
}

/**
 * 1.13c `States.txt` / `states.bin` rows with non-zero `colorshift` (`states.bin +0x20 colorpri`,
 * `+0x21 colorshift`, `+0x22..+0x24 light-r/g/b`), resolved by `D2Client 0x6FB22130` and drawn via
 * `D2Client 0x6FB1C5F8` -> `D2Win #10164` (`0x6F8EEE50`, `hueVariations[colorshift - 1]`).
 */
export const STATES_TXT_COLOR_SHIFT_ROWS_113C: readonly StatesTxtColorShiftRow113c[] = [
  { stateId: 1, state: 'freeze', colorpri: 100, colorshift: 108, lightRgb: [150, 215, 255] },
  { stateId: 2, state: 'poison', colorpri: 95, colorshift: 104, lightRgb: [128, 255, 128] },
  { stateId: 11, state: 'cold', colorpri: 100, colorshift: 108, lightRgb: [150, 215, 255] },
  { stateId: 44, state: 'holywindcold', colorpri: 100, colorshift: 108, lightRgb: [150, 215, 255] },
  { stateId: 90, state: 'blue', colorpri: 100, colorshift: 108, lightRgb: [150, 215, 255] },
  { stateId: 91, state: 'red', colorpri: 70, colorshift: 100, lightRgb: [255, 255, 255] },
  { stateId: 96, state: 'revive', colorpri: 85, colorshift: 73, lightRgb: [255, 255, 255] },
]

/**
 * Maps `States.txt` `colorshift` (`1..128`) to its hardware palette row (`D2Win #10164` `0x6F8EEE50`:
 * `hueVariations[colorshift - 1]`).
 */
export function resolveStateColorshiftPaletteRow113c(colorshift: number): number {
  switch (colorshift) {
    case 108:
      return 1 // hueVariations[107] (pre-baked in palette.bin row 1)
    case 104:
      return 2 // hueVariations[103] (pre-baked in palette.bin row 2)
    case 100:
      return colormapPaletteRow(DEFAULT_RED_TRANSFORM_113C) // hueVariations[99]
    case 73:
      return colormapPaletteRow(DEFAULT_REVIVE_TRANSFORM_113C) // hueVariations[72]
    default:
      return 0
  }
}

export interface StateColorShift {
  readonly stateId: number
  readonly priority: number
  readonly colorShift: number
  readonly lightRgb: readonly [number, number, number]
  readonly paletteRow: number
}

export const STATE_COLOR_SHIFTS: Readonly<Record<number, StateColorShift>> = Object.freeze(
  Object.fromEntries(
    STATES_TXT_COLOR_SHIFT_ROWS_113C.map((row) => [
      row.stateId,
      {
        stateId: row.stateId,
        priority: row.colorpri,
        colorShift: row.colorshift,
        lightRgb: row.lightRgb,
        paletteRow: resolveStateColorshiftPaletteRow113c(row.colorshift),
      },
    ]),
  ),
)

/**
 * Resolves the highest-priority active `States.txt` colorshift row (`D2Client 0x6FB22130`:
 * ascending `stateId` scan with strict `>` priority tie-breaking).
 */
export function resolveHighestStateColorShiftRow113c(
  hasState: (stateId: number) => boolean,
): StatesTxtColorShiftRow113c | undefined {
  let bestRow: StatesTxtColorShiftRow113c | undefined
  let bestPriority = -1
  for (const row of STATES_TXT_COLOR_SHIFT_ROWS_113C) {
    if (hasState(row.stateId) && row.colorpri > bestPriority) {
      bestRow = row
      bestPriority = row.colorpri
    }
  }
  return bestRow
}

/**
 * Resolves the local player's state-driven light colour (`0xRRGGBB`) per `D2Client 0x6FB221E3..0x6FB22203`,
 * or `undefined` when no colorshift state is active (`D2Client 0x6FB22225` resets to `255, 255, 255`).
 */
export function resolveStateLightColor113c(
  hasState: (stateId: number) => boolean,
): number | undefined {
  const row = resolveHighestStateColorShiftRow113c(hasState)
  if (!row) return undefined
  const [r, g, b] = row.lightRgb
  return (((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)) >>> 0
}

const PLAYER_CLASS_TOKENS: readonly string[] = ['AM', 'SO', 'NE', 'PA', 'BA', 'DZ', 'AI']

/** States.txt `hide=1` states that suppress corpse rendering (`#1 freeze, #99 redeemed, #104 corpse_nodraw, #107 shatter, #154 recycled, #173 corpseexp, #184 uberminion`). */
export const CORPSE_HIDE_STATES_113C: ReadonlySet<number> = new Set([1, 99, 104, 107, 154, 173, 184])
/** States.txt `nooverlays=1` states (`#14 bonearmor, #117 maul, #120 feralrage, #151 cyclonearmor`). */
export const STATE_NOOVERLAYS_113C: ReadonlySet<number> = new Set([14, 117, 120, 151])
/** States.txt `bonearmor` (14): `nooverlays=1` (overlays owned by StateSetFunc[6] 0x6FB23230). */
const STATE_BONEARMOR_NOOVERLAYS = 14

function statesIterHasAny(states: Iterable<number> | undefined, stateSet: ReadonlySet<number>): boolean {
  if (states === undefined) return false
  for (const s of states) {
    if (stateSet.has(s)) return true
  }
  return false
}

export function resolveUnitToken(unit: RenderableUnitInput): string {
  const explicitToken = unit.token ?? unit.objectToken
  if (explicitToken && explicitToken.trim() !== '') {
    return explicitToken.trim()
  }
  if (unit.kind === 'player') {
    const states = unit.states ?? unit.activeStates
    if (states) {
      const hasState = (st: number) => {
        if (states instanceof Set) return states.has(st)
        if (Array.isArray(states)) return states.includes(st)
        if (typeof (states as any)?.has === 'function') return (states as any).has(st)
        for (const s of states as Iterable<number>) {
          if (s === st) return true
        }
        return false
      }
      if (hasState(139)) {
        return '40'
      }
      if (hasState(140)) {
        return 'TG'
      }
      if (hasState(176)) {
        return 'VA'
      }
      if (hasState(177)) {
        return 'FK'
      }
    }
    const token = PLAYER_CLASS_TOKENS[unit.classId]
    if (!token) throw new Error(`resolveUnitToken: unknown player class id ${unit.classId}`)
    return token
  }
  if (unit.kind === 'missile') {
    const key =
      unit.missileKey && CANONICAL_113C_MISSILES[unit.missileKey.toLowerCase()]
        ? unit.missileKey.toLowerCase()
        : (MISSILE_ID_TO_KEY[unit.classId] ?? MISSILE_CLASS_ID_TO_KEY[unit.classId])
    // Unknown missile ids keep an explicit unresolved token (like OBJ_/MON_) instead of borrowing another missile.
    return key ? getMissileTxtData(key).celFile : `MIS_${unit.classId}`
  }
  if (unit.kind === 'tile' || unit.kind === 'warp') {
    return `WRP_${unit.warpId ?? unit.classId}`
  }
  if (unit.kind === 'object') {
    return `OBJ_${unit.classId}`
  }
  if (unit.kind === 'item') {
    const code = unit.code || unit.itemCode || unit.name
    if (code && /^[a-z0-9]{3,4}$/i.test(code.trim())) {
      return code.trim().toLowerCase()
    }
    if (unit.itemCode && unit.itemCode.trim() !== '') {
      return unit.itemCode.trim().toLowerCase()
    }
    const mapped = (BAKED_UI_MANIFEST.itemClassIdToCode as Record<number, string | undefined> | undefined)?.[unit.classId]
    if (mapped) return mapped
    return `ITM_${unit.classId}`
  }
  if (unit.kind === 'monster') {
    if (
      unit.classId === 411 ||
      unit.classId === 412 ||
      unit.classId === 413 ||
      unit.classId === 415 ||
      unit.classId === 416
    ) {
      return '2T'
    }
    if (unit.classId === 417 || unit.classId === 418) {
      return 'AI'
    }
    if (unit.classId === 356 || unit.classId === 357) {
      return 'AM'
    }
    return `MON_${unit.classId}`
  }
  return `MON_${unit.classId}`
}

export function resolveMissileMetadata(
  classId: number,
  explicitToken?: string,
): { readonly key: string; readonly entry: MissileTxtEntry } | null {
  const tokenKey =
    explicitToken && explicitToken.trim() !== '' ? explicitToken.trim().toLowerCase() : undefined
  const key =
    tokenKey && CANONICAL_113C_MISSILES[tokenKey]
      ? tokenKey
      : (MISSILE_ID_TO_KEY[classId] ?? MISSILE_CLASS_ID_TO_KEY[classId])
  if (!key || !CANONICAL_113C_MISSILES[key]) return null
  return {
    key,
    entry: getMissileTxtData(key),
  }
}

export function computeMissileClipDirection(
  unit: RenderableUnitInput,
  numDirs: number,
): number {
  const validDirs = [1, 2, 4, 8, 16, 32, 64].includes(numDirs) ? numDirs : 16
  if (validDirs === 1) return 0
  if (unit.fixedDirection === true) {
    assertDir64(unit.direction ?? -1, `missile ${String(unit.id)} fixed direction`)
    return dir64ToDcc(unit.direction as number, validDirs)
  }
  const fallbackDir64 = Number.isInteger(unit.direction) && (unit.direction ?? 0) >= 0 && (unit.direction ?? 0) < 64
    ? (unit.direction as number)
    : 0
  if (unit.vx !== undefined && unit.vy !== undefined && (Math.abs(unit.vx) > 1e-5 || Math.abs(unit.vy) > 1e-5)) {
    const dir64 = dir64FromPoints(0, 0, unit.vx, unit.vy, fallbackDir64)
    return dir64ToDcc(dir64, validDirs)
  }
  if (unit.targetX !== undefined && unit.targetY !== undefined) {
    const dir64 = dir64FromPoints(unit.x, unit.y, unit.targetX, unit.targetY, fallbackDir64)
    return dir64ToDcc(dir64, validDirs)
  }
  if (Number.isInteger(unit.direction) && (unit.direction ?? 0) >= 0 && (unit.direction ?? 0) < 64) {
    return dir64ToDcc(unit.direction as number, validDirs)
  }
  return (((unit.direction ?? 0) % validDirs) + validDirs) % validDirs
}

/**
 * The dir64 facing of a player, monster, object or item. When `unit.direction` is provided by
 * the motion/world layer (`unit.direction !== undefined`), it is validated and passed through
 * directly so frame-by-frame turn transitions (`D2Common.#10603`) are never overwritten by the
 * destination angle. Only when `unit.direction === undefined` and `targetX`/`targetY` are given
 * does it fall back to `dir64FromPoints`.
 */
function unitFacingDir64(
  unit: RenderableUnitInput,
  targetX: number | undefined,
  targetY: number | undefined,
): number {
  if (unit.direction !== undefined) {
    assertDir64(unit.direction, `unit ${String(unit.id)} direction`)
    return unit.direction
  }
  if (targetX === undefined || targetY === undefined) return 0
  return dir64FromPoints(unit.x, unit.y, targetX, targetY, 0)
}

/** 1.13c unit type of a scene unit: the owner type of its light records (0x6fb58c20 stores it at +0x00). */
function lightOwnerType(kind: SceneUnitKind): number {
  switch (kind) {
    case 'player':
      return 0
    case 'monster':
      return 1
    case 'object':
      return 2
    case 'missile':
      return 3
    case 'item':
      return 4
    case 'tile':
    case 'warp':
      return 5
  }
}

/**
 * Light position of a unit in x8 units. Dynamic units (players, monsters, missiles) keep a continuous position in
 * the port convention (D2 precise − 0.5): `(precise >> 13) + 4` (0x6fb59b9d). Static units stand on their sub-tile
 * (logical N.0), which 1.13c places at `sub * 8 + 4` (#827).
 */
const lightSub = (unit: RenderableUnitInput) => (unit.lightX === undefined || unit.lightY === undefined ? {} : { lightSubX: unit.lightX, lightSubY: unit.lightY })

function unitLightPos8(unit: RenderableUnitInput): { readonly x8: number; readonly y8: number } {
  if (unit.kind === 'player' || unit.kind === 'monster' || unit.kind === 'missile') {
    return { x8: lightPos8((unit.lightX ?? unit.x) + 0.5), y8: lightPos8((unit.lightY ?? unit.y) + 0.5) }
  }
  return { x8: Math.floor(unit.x * 8) + 4, y8: Math.floor(unit.y * 8) + 4 }
}

/** Compiled overlay.bin rows by Overlay.txt name (the names are unique). */
export const OVERLAY_ROW_BY_NAME: ReadonlyMap<string, OverlayTxtRow> = new Map(
  OVERLAY_TXT_ROWS.map((row) => [row.name.trim().toLowerCase(), row] as const),
)

/** Overlay.txt row index (0-based) by lowercase Overlay.txt name. */
const OVERLAY_INDEX_BY_NAME: ReadonlyMap<string, number> = new Map(
  OVERLAY_TXT_ROWS.map((row, idx) => [row.name.trim().toLowerCase(), idx] as const),
)

const PROGRESSIVE_STATE_SKILL_IDS: Readonly<Record<number, number>> = {
  122: 254,
  123: 265,
  124: 280,
  125: 259,
  126: 274,
  127: 269,
}

function readKeyedNumber(bag: unknown, key: number | string): number | undefined {
  if (!bag || typeof bag !== 'object') return undefined
  if (bag instanceof Map) {
    const val = bag.get(key) ?? (typeof key === 'number' ? bag.get(String(key)) : undefined)
    return typeof val === 'number' && Number.isFinite(val) ? val : undefined
  }
  if ('get' in bag && typeof (bag as { get: (k: unknown) => unknown }).get === 'function') {
    const val = (bag as { get: (k: unknown) => unknown }).get(key)
    if (typeof val === 'number' && Number.isFinite(val)) return val
  }
  const rec = bag as Record<string, unknown>
  const direct = rec[String(key)]
  return typeof direct === 'number' && Number.isFinite(direct) ? direct : undefined
}

function readStateStatListValue(unit: RenderableUnitInput, stateId: number, statId?: number): number | undefined {
  const raw = unit as unknown as Record<string, unknown>
  const stateStatsSources = [
    (unit.states as { getStateStats?: (id: number) => unknown } | undefined)?.getStateStats?.(stateId),
    (unit.stats as { getStateStats?: (id: number) => unknown } | undefined)?.getStateStats?.(stateId),
    readKeyedNumber(raw.stateStats, stateId),
  ]
  for (const src of stateStatsSources) {
    if (typeof src === 'number' && Number.isFinite(src)) return src
    if (Array.isArray(src)) {
      for (const entry of src) {
        if (!entry || typeof entry !== 'object') continue
        const e = entry as { id?: number; statId?: number; stat?: number; param?: number; value?: number }
        const id = e.id ?? e.statId ?? e.stat
        if (statId !== undefined && id !== undefined && id !== statId) continue
        if (typeof e.param === 'number' && e.param > 0 && statId === undefined) {
          return e.param & 0x3f
        }
        if (typeof e.value === 'number' && Number.isFinite(e.value)) {
          return e.value
        }
      }
    } else if (src && typeof src === 'object') {
      if (statId !== undefined) {
        const v = readKeyedNumber(src, statId)
        if (v !== undefined) return v
      }
      const c = readKeyedNumber(src, 'charge') ?? readKeyedNumber(src, 'charges') ?? readKeyedNumber(src, 'progressive_charges')
      if (c !== undefined) return c
    }
  }
  return undefined
}

/**
 * Resolves the active overlay token(s) for `stateId` on `unit` per 1.13c `D2Client.dll` state setfuncs:
 * - `setfunc = 16` (`0x6FB22E40`, states `117` `maul` / `120` `feralrage`): picks 1 front (`wOverlay[0] + stage - 1`)
 *   and 1 back (`wOverlay[2] + stage - 1`) in `1..5` instead of all 4 `overlay1..4` endpoints simultaneously (#1071, #1072).
 * - `setfunc = 8` (`0x6FB23000`, state `151` `cyclonearmor`): picks 1 of `cyclonearmor1front..3front` by remaining
 *   absorb thirds (`STAT_BONEARMOR` 132 vs `STAT_BONEARMORMAX` 133) instead of all 3 layers (#1071).
 * - `setfunc = 1` (`0x6FB23410`, states `122..127` `progressive_*`): picks `pgsvoverlay + charges - 1` (`1..3`) (#1071).
 */
export function resolveStateOverlayTokens113c(
  unit: RenderableUnitInput,
  stateId: number,
): readonly string[] {
  const raw = unit as unknown as Record<string, unknown>

  // States 117 (maul) & 120 (feralrage): StateSetFunc[16] 0x6FB22E40 (stage 1..5 front + back)
  if (stateId === 117 || stateId === 120) {
    const skillId = stateId === 117 ? 233 : 232
    const specificStage =
      stateId === 117
        ? (typeof raw.maulStage === 'number' ? raw.maulStage : undefined)
        : (typeof raw.feralRageStage === 'number' ? raw.feralRageStage : undefined)
    const specificCharges =
      stateId === 117
        ? (typeof raw.maulCharges === 'number' ? raw.maulCharges : undefined)
        : (typeof raw.feralRageCharges === 'number' ? raw.feralRageCharges : undefined)
    const genericCharges =
      typeof raw.charges === 'number'
        ? raw.charges
        : typeof raw.charge === 'number'
          ? raw.charge
          : (readKeyedNumber(raw.charges, stateId) ??
            readKeyedNumber(raw.charges, skillId) ??
            readKeyedNumber(raw.chargeCounts, stateId) ??
            readKeyedNumber(raw.chargeCounts, skillId) ??
            readKeyedNumber(raw.stateCharges, stateId) ??
            readStateStatListValue(unit, stateId) ??
            resolveUnitStat(unit.stats, stateId))
    const rawCount = specificStage ?? specificCharges ?? genericCharges ?? 1
    const maxCharges =
      stateId === 117
        ? (typeof raw.maulMaxCharges === 'number' ? raw.maulMaxCharges : undefined)
        : (typeof raw.feralRageMaxCharges === 'number' ? raw.feralRageMaxCharges : undefined)
    let stage: number
    if (specificStage !== undefined) {
      stage = Math.min(5, Math.max(1, Math.floor(specificStage)))
    } else if (rawCount <= 0) {
      stage = 1
    } else if (maxCharges !== undefined && maxCharges > 5 && rawCount > 5) {
      stage = Math.min(5, Math.max(1, Math.trunc(((rawCount - 1) * 5) / maxCharges) + 1))
    } else {
      stage = Math.min(5, Math.max(1, Math.floor(rawCount)))
    }
    const baseTokens = STATE_OVERLAYS[stateId]
    if (!baseTokens || baseTokens.length < 3) return baseTokens ?? []
    const frontBaseIdx = OVERLAY_INDEX_BY_NAME.get(baseTokens[0]!.toLowerCase())
    const backBaseIdx = OVERLAY_INDEX_BY_NAME.get(baseTokens[2]!.toLowerCase())
    const frontName =
      frontBaseIdx !== undefined
        ? OVERLAY_TXT_ROWS[frontBaseIdx + stage - 1]?.name.toLowerCase()
        : undefined
    const backName =
      backBaseIdx !== undefined
        ? OVERLAY_TXT_ROWS[backBaseIdx + stage - 1]?.name.toLowerCase()
        : undefined
    return [frontName ?? baseTokens[0]!, backName ?? baseTokens[2]!]
  }

  // State 151 (cyclonearmor): StateSetFunc[8] 0x6FB23000 (cumulative back+front layers by remaining absorb thirds)
  if (stateId === 151) {
    const stagePairs: ReadonlyArray<readonly [string, string]> = [
      ['cyclonearmor1back', 'cyclonearmor1front'],
      ['cyclonearmor2back', 'cyclonearmor2front'],
      ['cyclonearmor3back', 'cyclonearmor3front'],
    ]
    let idx = 2
    if (typeof raw.cycloneArmorStage === 'number' && Number.isFinite(raw.cycloneArmorStage)) {
      idx = Math.min(2, Math.max(0, Math.floor(raw.cycloneArmorStage) - 1))
    } else {
      const curAbsorb =
        (typeof raw.cycloneArmorAbsorb === 'number' ? raw.cycloneArmorAbsorb : undefined) ??
        (typeof raw.absorb === 'number' ? raw.absorb : undefined) ??
        readStateStatListValue(unit, 151, 132) ??
        resolveUnitStat(unit.stats, 132)
      const maxAbsorb =
        (typeof raw.cycloneArmorMaxAbsorb === 'number' ? raw.cycloneArmorMaxAbsorb : undefined) ??
        (typeof raw.maxAbsorb === 'number' ? raw.maxAbsorb : undefined) ??
        readStateStatListValue(unit, 151, 133) ??
        resolveUnitStat(unit.stats, 133)
      if (curAbsorb !== undefined && maxAbsorb !== undefined && maxAbsorb > 0) {
        const third = Math.trunc(maxAbsorb / 3)
        idx = curAbsorb < third ? 0 : curAbsorb < third * 2 ? 1 : 2
      }
    }
    const out: string[] = []
    for (let s = 0; s <= idx; s++) {
      const pair = stagePairs[s]!
      out.push(pair[0], pair[1])
    }
    return out
  }

  // States 122..127 (progressive_*): StateSetFunc[1] 0x6FB23410 (pgsvoverlay + charges - 1)
  const pgsvBase = STATE_PGSV_OVERLAYS[stateId]
  if (pgsvBase !== undefined) {
    const skillId = PROGRESSIVE_STATE_SKILL_IDS[stateId]
    const statId = stateId + 204 // 326..331
    let chargeCount =
      typeof raw.charges === 'number'
        ? raw.charges
        : typeof raw.charge === 'number'
          ? raw.charge
          : (readKeyedNumber(raw.charges, stateId) ??
            (skillId !== undefined ? readKeyedNumber(raw.charges, skillId) : undefined) ??
            readKeyedNumber(raw.chargeCounts, stateId) ??
            (skillId !== undefined ? readKeyedNumber(raw.chargeCounts, skillId) : undefined) ??
            readKeyedNumber(raw.stateCharges, stateId) ??
            readStateStatListValue(unit, stateId, statId) ??
            readStateStatListValue(unit, stateId) ??
            resolveUnitStat(unit.stats, statId) ??
            resolveUnitStat(unit.stats, stateId))
    if (chargeCount === undefined && unit.overlays) {
      const prefix = pgsvBase.slice(0, -1).toLowerCase()
      for (const ov of unit.overlays) {
        const tok = ov.token?.toLowerCase() ?? ''
        if (tok.startsWith(prefix)) {
          const suffix = Number(tok.slice(prefix.length))
          if (suffix >= 1 && suffix <= 3) {
            chargeCount = suffix
          }
        }
      }
    }
    const stage = Math.min(3, Math.max(1, Math.floor(chargeCount ?? 1)))
    const baseIdx = OVERLAY_INDEX_BY_NAME.get(pgsvBase.toLowerCase())
    if (baseIdx !== undefined) {
      const targetRow = OVERLAY_TXT_ROWS[baseIdx + stage - 1]
      if (targetRow) return [targetRow.name.toLowerCase()]
    }
    return [pgsvBase]
  }

  return STATE_OVERLAYS[stateId] ?? []
}

/**
 * The light of an overlay (0x6fb1b49f–0x6fb1b4e0): only when the overlay.bin `Radius` (+0x74) is non-zero,
 * CreateLight type 1 with `InitRadius` (+0x70), intensity 255 and Red/Green/Blue (+0x7d..+0x7f), then
 * SetTargetRadius(Radius) when it differs.
 *
 * Fault containment (Issue #955): an unknown `token` or a row with `Radius` but no
 * `InitRadius` is reported once via `reportMissingArt` and contributes no light — it must
 * never throw inside the per-frame drawable build, which would abort the entire render loop
 * for the overlay's whole lifetime (SetTargetRadius 0x6fb58be0 asserts server-side only).
 */
export function pushOverlayLight(
  out: LightEmitterInput[],
  unit: RenderableUnitInput,
  slot: string,
  token: string,
): void {
  const row = OVERLAY_ROW_BY_NAME.get(token.trim().toLowerCase())
  if (row === undefined) {
    reportMissingArt('overlay-light', token, `overlay '${token}' not found in overlay.bin`)
    return
  }
  if (row.radius === 0) return
  if (row.initRadius <= 0) {
    reportMissingArt(
      'overlay-light',
      row.name,
      `overlay '${row.name}' has Radius ${String(row.radius)} but InitRadius ${String(row.initRadius)}`,
    )
    return
  }
  const { x8, y8 } = unitLightPos8(unit)
  out.push({
    unitType: lightOwnerType(unit.kind),
    unitId: unit.id,
    slot,
    lightType: 1,
    x8,
    y8,
    radius: row.initRadius,
    ...(row.radius !== row.initRadius ? { targetRadius: row.radius } : {}),
    red: row.red,
    green: row.green,
    blue: row.blue,
  })
}

/**
 * The cast light of a unit casting a skill (0x6fb50f60): when the skill's compiled `cltmissile` (+0xe8)
 * points to a Missiles.txt row with `Light` (+0x130) > 0, CreateLight type 1 with radius 1, intensity 255,
 * and Red/Green/Blue (+0x132..+0x134), with targetRadius min(Light, 18).
 * Stored at unit->pSkills+0x14 (#10327), one per unit (old light freed on new cast).
 */
function pushCastLight(out: LightEmitterInput[], unit: RenderableUnitInput): void {
  const cast = unit.castState
  if (!cast) return
  // 0x6FB521E6: no cast light when the SkillCltStFunc failed.
  if ((cast as { cltStFailed?: boolean }).cltStFailed === true) return
  const [lightRadius, r, g, b] = skillCastLight113c(cast.skillId)
  if (lightRadius <= 0) return
  const { x8, y8 } = unitLightPos8(unit)
  out.push({
    unitType: lightOwnerType(unit.kind),
    unitId: unit.id,
    slot: 'cast',
    lightType: 1,
    x8,
    y8,
    radius: 1,
    targetRadius: Math.min(lightRadius, 18),
    red: r,
    green: g,
    blue: b,
    allocation: cast,
  })
}

/** MonsterData+0x16 type flags as the 0xAC packet carries them. */
const MONFLAG_CHAMPION = 0x04
const MONFLAG_UNIQUE = 0x08
/** MonUMod whose client handler (table 0x6fbaa340, entry 3 = 0x6fad0510) creates the boss light. */
const UMOD_LIGHT = 3
/** Mod bytes the umod dispatcher 0x6fad0f20 walks (`cmp esi,0x9`). */
const UMOD_SLOTS = 9
/** Radius of the umod-3 light (`push 0x7` at 0x6fad05a1 / 0x6fad05dd). */
const UMOD_LIGHT_RADIUS = 7

/**
 * The monster's own light (unit+0x64, type 0).
 * - MonUMods (0x6fad0f20): when the first mod byte is non-zero, the handlers of the fixed list {1, 2, 3, 4}
 *   (0x6fb86d2c) run, then those of the 9 mod bytes. Handler 3 (0x6fad0510) needs the unique type flag (0x08, its
 *   argument), frees the light and creates radius 7: a champion (0x04) takes B, G, R = RAND(unit seed, 256) in that
 *   order on every run (the last run wins), any other monster MonStats2 light-r/g/b.
 * - Otherwise the base light (0x6fafc24e): radius MonStats2 `Light` (+0x11e), none when 0. The 1.13c radius is the
 *   max of that and #11077 (component items' light, not modelled: UNVERIFIED gap).
 * The unit seed is the port's stand-in `{ unitId, 666 }` (SPEC §11 Q8, UNVERIFIED).
 */
function monsterLightEmitter(unit: RenderableUnitInput): LightEmitterInput | null {
  const [baseRadius, red, green, blue] = monsterLight113c(unit.classId)
  const { x8, y8 } = unitLightPos8(unit)
  const owner = { unitType: 1, unitId: unit.id, slot: 'unit', lightType: 0 as const, x8, y8 }
  const flags = unit.flags ?? 0
  const mods = unit.bossMods
  const unique = (flags & MONFLAG_UNIQUE) !== 0 || unit.isUnique === true
  if (mods !== undefined && mods.length > 0 && mods[0] !== 0 && unique) {
    const runs = 1 + mods.slice(0, UMOD_SLOTS).filter((m) => m === UMOD_LIGHT).length
    if ((flags & MONFLAG_CHAMPION) !== 0 || unit.isChampion === true) {
      const seed = { lo: unit.id >>> 0, hi: LIGHT_SEED_HI }
      let r = 0
      let g = 0
      let b = 0
      for (let run = 0; run < runs; run += 1) {
        b = d2Rand(seed, 256)
        g = d2Rand(seed, 256)
        r = d2Rand(seed, 256)
      }
      return { ...owner, radius: UMOD_LIGHT_RADIUS, red: r, green: g, blue: b }
    }
    return { ...owner, radius: UMOD_LIGHT_RADIUS, red, green, blue }
  }
  if (baseRadius <= 0) return null
  return { ...owner, radius: baseRadius, red, green, blue }
}

/**
 * The light of a missile unit (0x6fb63647–0x6fb636a7): type 1, Missiles.txt `Light` at full radius (or the immediate
 * SetRadius override), intensity 255, Red/Green/Blue, `Flicker` (0x6fb60df0). It exists only at Light Quality High
 * and fades out (Kill) when the missile ends. `Light` 0 → none (the `params+0x50` alternative is not modelled).
 *
 * @returns the emitter (or null) and the drawn radius / colour of the missile drawable.
 */
function missileLightEmitter(
  unit: RenderableUnitInput,
  missileId: number,
): { readonly emitter: LightEmitterInput | null; readonly radius: number; readonly color: readonly [number, number, number] } {
  const [light, flicker, red, green, blue] = missileLight113c(missileId)
  const color = [red, green, blue] as const
  if (light <= 0 || unit.missileNoLight === true) return { emitter: null, radius: 0, color }
  const override = unit.missileLightRadius
  if (override !== undefined && (!Number.isInteger(override) || override <= 0)) {
    throw new RangeError(`missile ${String(unit.id)} light radius override ${String(override)} is not a positive integer`)
  }
  const radius = override ?? light
  const { x8, y8 } = unitLightPos8(unit)
  return {
    emitter: {
      unitType: 3,
      unitId: unit.id,
      slot: 'unit',
      lightType: 1,
      x8,
      y8,
      radius,
      red,
      green,
      blue,
      ...(flicker !== 0 ? { flicker } : {}),
      fadeOnRemove: true,
      requiresHighQuality: true,
    },
    radius,
    color,
  }
}

export interface BuildSceneDrawablesResult {
  readonly unitDrawables: readonly SceneUnitDrawable[]
  readonly missileDrawables: readonly SceneMissileDrawable[]
  readonly overlayDrawables: readonly SceneOverlayDrawable[]
  readonly sortedDrawables: readonly SceneEntityDrawable[]
  /** Object lights (#827) at their sub-tile: the scene's object-light snapshot. */
  readonly pointLights: readonly PointLightInput[]
  /**
   * Every light record the scene's units own this frame (SPEC #830 §6), in scene order: monsters, other players,
   * missiles, objects and overlays. The local player's own light is added by the lighting pass.
   */
  readonly lightEmitters: readonly LightEmitterInput[]
}

function resolveUnitStat(
  stats: StatListReaderLike | ReadonlyMap<number, number> | Record<number, number> | undefined,
  statId: number,
): number | undefined {
  if (!stats) return undefined
  if ('get' in stats && typeof (stats as { get: (id: number) => number | undefined }).get === 'function') {
    return (stats as { get: (id: number) => number | undefined }).get(statId)
  }
  if (typeof stats === 'object' && statId in stats) {
    return (stats as Record<number, number>)[statId]
  }
  return undefined
}

/**
 * Meteor-family sub-missiles flown by `MISSMODE_CltDo09_MeteorCenter` (0x6FB68F00): `ClientSubMissile1/2` of
 * `meteorcenter` (101), `vampiremeteorcenter` and `royalstrikemeteorcenter` (same key set as the client stepper's
 * `isMeteor3D`, world-missile-stepper.ts).
 */
const METEOR_3D_TRAJECTORY_KEYS_113C: ReadonlySet<string> = new Set([
  'meteor',
  'meteortail',
  'vampiremeteor',
  'royalstrikemeteor',
  'royalstrikemeteortail',
])
/** `meteorcenter` CltParam3 (sliderate, 1/32 sub-tile per frame) and CltParam2 (fallrate, px per frame). */
const METEOR_SLIDE_RATE_113C = 15
const METEOR_FALL_RATE_113C = 25

/**
 * 1.13c path sub-tile of a Meteor-family sub-missile. CltDo09 spawns `meteor`/`meteortail` AT the target sub-tile
 * and gives them `UNIT_Set3DTrajectory(vx=+15, vz=-25, xOffset=-15*rem, zOffset=+25*rem)` (0x6FB77E30); the
 * offsets only move the screen projection (`D2Common_10132` 0x6FD9DB40), never the path position DrawGrid buckets
 * the unit by (kb/skills/missiles/d2client-meteor-cltdofunc-clthitfunc.md §3). The port stores the projected
 * position (`x = targetX - 15*rem/32`, `altitude = 25*rem`), so the path position is recovered as
 * `x + 15 * (altitude / 25) / 32`, snapped to the 1/32 sub-tile trajectory grid. `null` for every other missile
 * (path position = drawn position).
 */
export function meteor3dPathSubTile(
  missileKey: string,
  x: number,
  y: number,
  altitude: number,
): { readonly x: number; readonly y: number } | null {
  if (!METEOR_3D_TRAJECTORY_KEYS_113C.has(missileKey) || altitude <= 0) return null
  const rem = altitude / METEOR_FALL_RATE_113C
  return { x: Math.round((x + (METEOR_SLIDE_RATE_113C * rem) / 32) * 32) / 32, y }
}

/**
 * DrawGrid cell row (`cellX + cellY`) a scene entity is bucketed into by `DrawGrid_DrawAllCells` (0x6fb4ee90),
 * from its 1.13c path sub-tile. Shared by the entity sort below and the wall/entity interleave in world-renderer.
 */
export function sceneEntityCellDepth(d: SceneEntityDrawable): number {
  if (d.drawableKind === 'missile' && d.pathSubX !== undefined && d.pathSubY !== undefined) {
    return Math.floor(d.pathSubX / 5) + Math.floor(d.pathSubY / 5)
  }
  if ('subX' in d && typeof d.subX === 'number' && typeof d.subY === 'number') {
    return Math.floor(d.subX / 5) + Math.floor(d.subY / 5)
  }
  return Math.floor(d.sortY / 40)
}

/**
 * Convert a collection of `RenderableUnitInput` or `UnitSnapshot` records into depth-sorted
 * scene drawables (`SceneUnitDrawable`, `SceneMissileDrawable`, `SceneOverlayDrawable`) and
 * the 1.13c light emitters of their units for `applyLightingInputs`.
 */
export function buildSceneDrawables(
  unitsOrInput:
    | Iterable<RenderableUnitInput | UnitSnapshot>
    | {
        readonly units: Iterable<RenderableUnitInput | UnitSnapshot>
        readonly originX?: number | undefined
        readonly originY?: number | undefined
        readonly tick?: number | undefined
        readonly elapsedMs?: number | undefined
        readonly selfUnitId?: number | undefined
        readonly softwarePaletteMode?: boolean | undefined
      },
  optionsOrWidth?:
    | {
        readonly originX?: number | undefined
        readonly originY?: number | undefined
        readonly tick?: number | undefined
        readonly selfUnitId?: number | undefined
        readonly softwarePaletteMode?: boolean | undefined
      }
    | number,
  _height?: number,
): BuildSceneDrawablesResult {
  const isWrapper =
    unitsOrInput !== null &&
    typeof unitsOrInput === 'object' &&
    !(Symbol.iterator in unitsOrInput) &&
    'units' in unitsOrInput
  const units: Iterable<RenderableUnitInput | UnitSnapshot> = isWrapper
    ? unitsOrInput.units
    : (unitsOrInput as Iterable<RenderableUnitInput | UnitSnapshot>)
  const options =
    typeof optionsOrWidth === 'object'
      ? optionsOrWidth
      : isWrapper
        ? unitsOrInput
        : undefined
  const originX = options?.originX ?? 0
  const originY = options?.originY ?? 0
  const selfUnitId = options?.selfUnitId ?? (isWrapper ? unitsOrInput.selfUnitId : undefined)
  const softwarePaletteMode =
    options?.softwarePaletteMode ?? (isWrapper ? unitsOrInput.softwarePaletteMode : undefined) ?? false
  const tick =
    options?.tick ??
    (isWrapper && typeof unitsOrInput.elapsedMs === 'number'
      ? Math.floor(unitsOrInput.elapsedMs / 40)
      : 0)

  const unitDrawables: SceneUnitDrawable[] = []
  const missileDrawables: SceneMissileDrawable[] = []
  const overlayDrawables: SceneOverlayDrawable[] = []
  const pointLights: PointLightInput[] = []
  const lightEmitters: LightEmitterInput[] = []

  const rawUnitsList = Array.from(units)
  const playerAppearancesById = new Map<number, SorceressAppearanceSpec>()
  let fallbackAmazonAppearance: SorceressAppearanceSpec | undefined
  for (const rawU of rawUnitsList) {
    const rAny = rawU as Record<string, any>
    const isPlr =
      (rawU as RenderableUnitInput).kind === 'player' ||
      rAny.unitType === 0 ||
      rAny.unitType === 'player'
    if (isPlr && rAny.equipmentAppearance) {
      const uid = Number(rAny.id ?? rAny.unitId ?? 0)
      const spec: SorceressAppearanceSpec =
        rAny.equipmentAppearance.classToken === 'am'
          ? rAny.equipmentAppearance
          : { ...rAny.equipmentAppearance, classToken: 'am', classId: 0 }
      if (uid > 0) {
        playerAppearancesById.set(uid, spec)
      }
      if (rAny.isLocalPlayer === true || rAny.classId === 0 || fallbackAmazonAppearance === undefined) {
        fallbackAmazonAppearance = spec
      }
    }
  }

  for (const rawUnit of rawUnitsList) {
    const rawAny = rawUnit as Record<string, any>
    const resolvedKind: SceneUnitKind =
      (rawUnit as RenderableUnitInput).kind ??
      (rawAny.unitType === 0 || rawAny.unitType === 'player'
        ? 'player'
        : rawAny.unitType === 1 || rawAny.unitType === 'monster'
          ? 'monster'
          : rawAny.unitType === 2 || rawAny.unitType === 'object'
            ? 'object'
            : rawAny.unitType === 3 || rawAny.unitType === 'missile'
              ? 'missile'
              : rawAny.unitType === 4 || rawAny.unitType === 'item'
                ? 'item'
                : rawAny.unitType === 5 || rawAny.unitType === 'tile'
                  ? 'tile'
                  : 'monster')
    const resolvedId = (rawAny.id ?? rawAny.unitId ?? 0) as number
    const hasExplicitSubtileCoords =
      rawAny.x === undefined && typeof rawAny.subtileX === 'number'
    const resolvedX =
      typeof rawAny.x === 'number'
        ? rawAny.x
        : typeof rawAny.subtileX === 'number'
          ? rawAny.subtileX
          : 0
    const resolvedY =
      typeof rawAny.y === 'number'
        ? rawAny.y
        : typeof rawAny.subtileY === 'number'
          ? rawAny.subtileY
          : 0
    const unit: RenderableUnitInput = {
      ...(rawUnit as unknown as RenderableUnitInput),
      kind: resolvedKind,
      id: resolvedId,
      x: resolvedX,
      y: resolvedY,
    }

    const { x: worldX, y: worldY } = hasExplicitSubtileCoords
      ? { x: resolvedX - originX, y: resolvedY - originY }
      : subTileToWorldOrtho(unit.x, unit.y, originX, originY)

    if (unit.kind === 'missile') {
      const resolved = resolveMissileMetadata(unit.classId, unit.missileKey ?? unit.token ?? unit.name)
      // The light is the Missiles.txt row of the unit's class (a client alias carries the row it renders for). A
      // missile without art data still has its light; an id outside Missiles.txt has neither.
      const lightId = resolved !== null ? resolved.entry.id : unit.classId
      const knownRow = resolved !== null || (Number.isInteger(lightId) && lightId >= 0 && lightId < MISSILE_LIGHT_113C.length)
      const missileLight = knownRow ? missileLightEmitter(unit, lightId) : null
      if (missileLight?.emitter) lightEmitters.push(missileLight.emitter)
      if (!resolved || missileLight === null) continue // Unknown Missiles.txt id: not drawn (no substitute art).
      const { key, entry } = resolved
      // No sprite (celFile 'null', e.g. whitelightmissile 154): nothing to draw, the light above still exists.
      if (!entry.celFile || entry.celFile.trim() === '' || entry.celFile.toLowerCase() === 'null') continue
      const blendMode: DrawableBlendMode = transToBlendMode(entry.trans)
      const dir = computeMissileClipDirection(unit, entry.numDirections || 16)
      const totalFrames = Math.max(1, unit.totalFrames ?? entry.animLen ?? 8)
      const loopAnim = unit.loopAnim !== undefined ? unit.loopAnim : entry.loopAnim !== 0
      const rawFrame = unit.frame ?? 0
      const frame = loopAnim
        ? ((Math.floor(rawFrame) % totalFrames) + totalFrames) % totalFrames
        : Math.min(totalFrames - 1, Math.max(0, Math.floor(rawFrame)))
      const altitude = unit.altitude ?? 0
      const isTail = key === 'meteortail' || key === 'royalstrikemeteortail'
      const sortY = altitude > 0 ? worldY + altitude - (isTail ? 0.5 : 0) : worldY
      const pathSub = meteor3dPathSubTile(key, unit.x, unit.y, altitude)

      const missileDrawable: SceneMissileDrawable = {
        drawableKind: 'missile',
        unitId: unit.id,
        missileClassId: unit.classId,
        missileKey: key,
        celFile: entry.celFile,
        direction: dir,
        frame,
        totalFrames,
        loopAnim,
        ...(unit.vx !== undefined ? { vx: unit.vx } : {}),
        ...(unit.vy !== undefined ? { vy: unit.vy } : {}),
        ...(unit.altitude !== undefined ? { altitude: unit.altitude } : {}),
        subX: unit.x,
        subY: unit.y,
        ...lightSub(unit),
        ...(pathSub !== null ? { pathSubX: pathSub.x, pathSubY: pathSub.y } : {}),
        worldX,
        worldY,
        sortY,
        blendMode,
        trans: entry.trans ?? 0,
        lightRadius: missileLight.radius,
        lightColor: missileLight.color,
      }
      missileDrawables.push(missileDrawable)
      continue
    }

    if (unit.kind === 'monster') {
      const light = monsterLightEmitter(unit)
      if (light !== null) lightEmitters.push(light)
    } else if (unit.kind === 'player' && unit.isLocalPlayer === false) {
      // Another player's light (0x6fac92f5): type 1, radius 13, white.
      // Stat 89 SetRadius (0x6fac8bc0): 13 + v, ≤ 0 → unchanged.
      // Stat 90 SetColor (0x6fac89a0): 0 → white, else 0xRRGGBB.
      const { x8, y8 } = unitLightPos8(unit)
      const radiusBonus = unit.playerLightRadiusBonus ?? resolveUnitStat(unit.stats, 89)
      const lightColor = unit.playerLightColor ?? resolveUnitStat(unit.stats, 90)
      lightEmitters.push({
        unitType: 0,
        unitId: unit.id,
        slot: 'unit',
        lightType: 1,
        x8,
        y8,
        radius: PLAYER_LIGHT_RADIUS,
        red: 255,
        green: 255,
        blue: 255,
        ...(radiusBonus !== undefined ? { playerLightRadiusBonus: radiusBonus } : {}),
        ...(lightColor !== undefined ? { playerLightColor: lightColor } : {}),
      })
    }

    if (
      (unit.kind === 'player' || unit.kind === 'monster') &&
      !unit.isCorpse &&
      (unit.lifePct === undefined || unit.lifePct > 0)
    ) {
      pushCastLight(lightEmitters, unit)
    }

    if (unit.kind === 'object' && unit.objectPointLight !== undefined) {
      // Issue #827: an object's light is its unit+0x64 state, created and changed only by SetObjectLight 0x6fad4920
      // (object-light.ts), centred on its sub-tile (1.13c light position = sub-tile * 8 + 4; logical N.0 is the centre
      // of sub-tile N). Intensity 255, colour from Objects.txt, no flicker (not loaded by 1.13c).
      const light = unit.objectPointLight
      const radiusValid =
        Number.isInteger(light.radius) && light.radius >= 1 && light.radius <= OBJECT_LIGHT_MAX_RADIUS
      if (!radiusValid) {
        // Fault containment (Issue #955): one bad server packet must not abort the render
        // loop for every following frame — report once and skip this light.
        reportMissingArt(
          'object-light',
          `${String(unit.id)}/${String(unit.classId)}`,
          `object ${String(unit.id)} (class ${String(unit.classId)}) light radius ${String(light.radius)} is not 1..${String(OBJECT_LIGHT_MAX_RADIUS)}`,
        )
      } else {
      pointLights.push({
        subTileX: unit.x,
        subTileY: unit.y,
        radius: light.radius,
        intensity: OBJECT_LIGHT_INTENSITY,
        r: light.r,
        g: light.g,
        b: light.b,
      })
      // The same light as a type-2 grid record (0x6fad496a): occlusion cached until the radius or the map changes.
      const { x8, y8 } = unitLightPos8(unit)
      lightEmitters.push({
        unitType: 2,
        unitId: unit.id,
        slot: 'unit',
        lightType: 2,
        x8,
        y8,
        radius: light.radius,
        red: light.r,
        green: light.g,
        blue: light.b,
        ...(unit.objectLightAllocation !== undefined ? { allocation: unit.objectLightAllocation } : {}),
      })
      }
    }

    // D2Client unit+0xC8 & 0x40000 (UNITFLAG_DONOTDRAW, set by MissCltHitFunc[34] 0x6FB607E0 on Mephisto or
    // special quest event 17 0x6FB02B51 on Nihlathak): DrawUnit (0x6FADBA00) skips both the unit sprite and
    // all unit overlays (pre-draw and post-draw alike).
    if (rawAny.clientNoDraw === true) {
      continue
    }

    // Collect overlays from explicit `overlays` and active `states`
    const unitOverlays: SceneOverlayDrawable[] = []
    const hasWantsInteract = Boolean(unit.wantsInteract ?? rawAny.wantsInteract)
    if (hasWantsInteract) {
      const npcAlertRow = OVERLAY_ROW_BY_NAME.get('npcalert')
      if (npcAlertRow !== undefined) {
        const npcAlertFrame = computeOverlayLoopFrame113c(
          tick,
          npcAlertRow.frames,
          npcAlertRow.animRate,
          npcAlertRow.loopWaitTime,
        )
        if (npcAlertFrame !== null) {
          const xOffset = npcAlertRow.xOffset
          const yOffset = computeOverlayYOffset113c(npcAlertRow, unit)
          const preDraw = npcAlertRow.preDraw !== 0
          const questAlertOverlay: SceneOverlayDrawable = {
            drawableKind: 'overlay',
            ownerUnitId: unit.id,
            overlayId: 72,
            token: 'npcalert',
            frame: npcAlertFrame,
            totalFrames: npcAlertRow.frames,
            loop: true,
            ...(preDraw ? { preDraw: true } : {}),
            ...(xOffset !== 0 ? { xOffset } : {}),
            worldX: worldX + xOffset,
            worldY: worldY + yOffset - (unit.altitude ?? 0),
            sortY: worldY,
            blendMode: overlayTransToBlendMode(npcAlertRow.trans),
          }
          unitOverlays.push(questAlertOverlay)
          overlayDrawables.push(questAlertOverlay)
          pushOverlayLight(lightEmitters, unit, 'npcalert', 'npcalert')
        }
      }
    }
    if (unit.overlays) {
      for (const ov of unit.overlays) {
        if ((ov as { loopWaiting?: boolean }).loopWaiting === true) {
          continue
        }
        const normOvToken = ov.token?.trim().toLowerCase()
        const ovRow = normOvToken !== undefined ? OVERLAY_ROW_BY_NAME.get(normOvToken) : undefined
        // Overlay.txt rows with Filename=null (e.g. bonearmor_null1/2, type-7 delay overlays) have no art.
        if (ovRow !== undefined && (ovRow.filename === '' || ovRow.filename.toLowerCase() === 'null')) {
          continue
        }
        const ovTxt = normOvToken !== undefined ? CANONICAL_113C_OVERLAYS[normOvToken] : undefined
        const authOv = normOvToken !== undefined ? AUTHENTIC_113C_OVERLAYS[normOvToken] : undefined
        const ovMeta = ov.token
          ? (OVERLAY_METAS[normOvToken!] ?? OVERLAY_METAS[ov.token.trim()])
          : undefined
        const meta = OVERLAY_METADATA[ov.overlayId]
        const totalFrames = Math.max(
          1,
          ov.totalFrames ??
            ovRow?.frames ??
            ovTxt?.frames ??
            authOv?.frames ??
            ovMeta?.frames ??
            meta?.totalFrames ??
            16,
        )
        const isOneShot = ov.loop === false || ((ovRow !== undefined || ovTxt !== undefined) && ov.loop !== true)
        const rawFrame = ov.frame ?? 0
        const frame = isOneShot
          ? Math.min(totalFrames - 1, Math.max(0, Math.floor(rawFrame)))
          : ((Math.floor(rawFrame) % totalFrames) + totalFrames) % totalFrames
        const rowComputedYOffset =
          ovRow !== undefined
            ? computeOverlayYOffset113c(ovRow, unit)
            : authOv !== undefined
              ? computeOverlayYOffset113c(authOv, unit)
              : undefined
        const baseRowYOffset = ovRow?.yOffset ?? authOv?.yOffset ?? ovTxt?.yOffset ?? 0
        const customOvYOffset =
          ov.yOffset !== undefined && (rowComputedYOffset === undefined || ov.yOffset !== baseRowYOffset)
            ? ov.yOffset
            : undefined
        const yOffset =
          customOvYOffset ??
          rowComputedYOffset ??
          ovTxt?.yOffset ??
          ovMeta?.yOffset ??
          meta?.yOffset ??
          0
        const xOffset = ov.xOffset ?? ovRow?.xOffset ?? ovTxt?.xOffset ?? authOv?.xOffset ?? 0
        const preDraw = Boolean(
          ov.preDraw ?? (ovRow !== undefined ? ovRow.preDraw !== 0 : undefined) ?? ovTxt?.preDraw ?? authOv?.preDraw ?? false,
        )
        // Overlay.txt Trans is the D2gfx eDrawMode (0x6FB1B11D); with no Overlay.txt row there is no draw mode, so
        // the overlay is reported and skipped instead of guessing one (Issue #955: never throw per frame).
        const metaRow = meta !== undefined ? OVERLAY_ROW_BY_NAME.get(meta.token.toLowerCase()) : undefined
        const rowTrans =
          typeof ov.blendMode === 'number' ? ov.blendMode : (ovRow?.trans ?? ovTxt?.trans ?? metaRow?.trans)
        if (typeof ov.blendMode !== 'string' && rowTrans === undefined) {
          reportMissingArt('overlay', ov.token ?? `OVL_${String(ov.overlayId)}`, 'no Overlay.txt row: unknown Trans/eDrawMode')
          continue
        }
        const blendMode: DrawableBlendMode =
          typeof ov.blendMode === 'string' ? ov.blendMode : overlayTransToBlendMode(rowTrans!)
        const ovDrawable: SceneOverlayDrawable = {
          drawableKind: 'overlay',
          ownerUnitId: unit.id,
          overlayId: ov.overlayId,
          token: ov.token ?? meta?.token ?? `OVL_${ov.overlayId}`,
          frame,
          totalFrames,
          loop: !isOneShot,
          ...(preDraw ? { preDraw: true } : {}),
          ...(xOffset !== 0 ? { xOffset } : {}),
          subX: unit.x,
          subY: unit.y,
          worldX: worldX + xOffset,
          worldY: worldY + yOffset - (unit.altitude ?? 0),
          sortY: worldY,
          blendMode,
        }
        unitOverlays.push(ovDrawable)
        overlayDrawables.push(ovDrawable)
        if (ov.token !== undefined) pushOverlayLight(lightEmitters, unit, `ov:${String(ov.overlayId)}`, ov.token)
      }
    } else if (unit.kind === 'monster') {
      // Standalone `buildUnitDrawables` callers pass plain RawSceneUnit objects with `unit.overlays === undefined`.
      // Synthesize 1.13c `0x6FB570C0` / `0x6FAFD610` innate looping overlays (e.g. #122 `mephisto` on 242/704,
      // #275 `baal_on_throne` on 543, #227 `ice_cage` on 527) while alive or in MONMODE_DEATH (mode 0 / DT),
      // stopping once MONMODE_DEAD (mode 12 / DD) is reached (`0x6FAFE847` FreeAllUnitOverlays).
      const innateSpec = INNATE_LOOP_MONSTER_OVERLAY_BY_CLASS_113C[unit.classId]
      const isMonsterDyingMode = unit.mode === 0 || unit.animMode === 'DT'
      const isMonsterDeadCorpse =
        unit.mode === 12 ||
        unit.animMode === 'DD' ||
        (Boolean(unit.isCorpse) && !isMonsterDyingMode) ||
        (unit.lifePct !== undefined && unit.lifePct <= 0 && !isMonsterDyingMode)
      if (
        innateSpec !== undefined &&
        !isMonsterDeadCorpse &&
        !hasMonStats2Flag(unit.classId, MONSTATS2_FLAGINDEX.NOOVLY)
      ) {
        const ovRow = OVERLAY_ROW_BY_NAME.get(innateSpec.token)
        if (ovRow !== undefined && ovRow.filename !== '' && ovRow.filename.toLowerCase() !== 'null') {
          const totalFrames = Math.max(1, ovRow.frames)
          const rawFrame = ovRow.animRate > 0 ? Math.floor((tick * ovRow.animRate) / 16) : 0
          const frame = ((rawFrame % totalFrames) + totalFrames) % totalFrames
          const yOffset = computeOverlayYOffset113c(ovRow, unit)
          const xOffset = ovRow.xOffset
          const preDraw = ovRow.preDraw !== 0
          const ovDrawable: SceneOverlayDrawable = {
            drawableKind: 'overlay',
            ownerUnitId: unit.id,
            overlayId: innateSpec.overlayIndex,
            token: innateSpec.token,
            frame,
            totalFrames,
            loop: true,
            ...(preDraw ? { preDraw: true } : {}),
            ...(xOffset !== 0 ? { xOffset } : {}),
            subX: unit.x,
            subY: unit.y,
            worldX: worldX + xOffset,
            worldY: worldY + yOffset - (unit.altitude ?? 0),
            sortY: worldY,
            blendMode: overlayTransToBlendMode(ovRow.trans),
          }
          unitOverlays.push(ovDrawable)
          overlayDrawables.push(ovDrawable)
          pushOverlayLight(lightEmitters, unit, `innate:${String(innateSpec.overlayIndex)}`, innateSpec.token)
        }
      }
    }

    const isCorpse =
      Boolean(unit.isCorpse) ||
      (unit.lifePct !== undefined && unit.lifePct <= 0 && unit.kind === 'monster') ||
      (unit.kind === 'player' && (unit.mode === 0 || unit.mode === 17))
    const isDeadAnim =
      isCorpse ||
      unit.animMode === 'DT' ||
      unit.animMode === 'DD' ||
      (unit.kind === 'player' && unit.mode === 17)

    let tintColor: readonly [number, number, number] | null = (unit as any).tintColor ?? null
    let activePaletteRow: number | undefined = unit.paletteRow
    let hasFadeState = false
    let hasInvisState = false
    const statesIter = unit.states ?? unit.activeStates ?? (rawAny.activeStates as Iterable<number> | undefined)
    if (statesIter) {
      let highestShift: StateColorShift | null = null
      for (const stateId of statesIter) {
        if (stateId === 159) {
          hasFadeState = true
        }
        if (stateId === 146) {
          hasInvisState = true
        }
        const shift = STATE_COLOR_SHIFTS[stateId]
        if (shift) {
          if (
            highestShift === null ||
            shift.priority > highestShift.priority ||
            (shift.priority === highestShift.priority && shift.stateId < highestShift.stateId)
          ) {
            highestShift = shift
          }
        }
        if (isDeadAnim) {
          continue
        }
        // States.txt bonearmor (14) has nooverlays=1: its overlays are owned by StateSetFunc[6]
        // 0x6FB23230 (unit.overlays, see bone-armor-overlays-113c.ts), not the generic state path.
        if (stateId === STATE_BONEARMOR_NOOVERLAYS) {
          continue
        }
        // D2Client 0x6FB22C80 (LOOPEX=4 / AURAEX=9): while a state's one-shot castoverlay is playing,
        // hold back its persistent overlay1..4 loop (Issue #1063).
        if (isStateCastOverlayPlaying113c(unit.overlays as readonly ClientUnitOverlay[] | undefined, stateId)) {
          continue
        }
        const stateTokens = resolveStateOverlayTokens113c(unit, stateId)
        if (stateTokens.length > 0) {
          for (const token of stateTokens) {
            const normToken = token.toLowerCase()
            const isDuplicate = unitOverlays.some((o) => {
              const ot = o.token.toLowerCase()
              if (ot === normToken) return true
              if (
                (ot === 'chillarmor' || ot === 'chillingarmor') &&
                (normToken === 'chillarmor' || normToken === 'chillingarmor')
              ) {
                return true
              }
              return false
            })
            if (isDuplicate) {
              continue
            }
            const ovRow = OVERLAY_ROW_BY_NAME.get(normToken)
            if (ovRow === undefined) {
              // Fault containment (Issue #955): skip the unknown state overlay instead of
              // aborting the whole drawable build every frame.
              reportMissingArt('overlay-state', token, `overlay '${token}' not found in overlay.bin`)
              continue
            }
            pushOverlayLight(lightEmitters, unit, `state:${String(stateId)}:${normToken}`, normToken)
            if (ovRow.filename === '' || ovRow.filename.toLowerCase() === 'null') {
              continue
            }
            const totalFrames = Math.max(1, ovRow.frames)
            const animRate = ovRow.animRate
            const rawFrame = Math.floor((tick * animRate) / 16)
            const frame = ((rawFrame % totalFrames) + totalFrames) % totalFrames
            const yOffset = computeOverlayYOffset113c(ovRow, unit)
            const xOffset = ovRow.xOffset
            const preDraw = ovRow.preDraw !== 0
            const blendMode: DrawableBlendMode = overlayTransToBlendMode(ovRow.trans)

            const ovDrawable: SceneOverlayDrawable = {
              drawableKind: 'overlay',
              ownerUnitId: unit.id,
              overlayId: stateId,
              token,
              frame,
              totalFrames,
              loop: true,
              ...(preDraw ? { preDraw: true } : {}),
              ...(xOffset !== 0 ? { xOffset } : {}),
              subX: unit.x,
              subY: unit.y,
              worldX: worldX + xOffset,
              worldY: worldY + yOffset - (unit.altitude ?? 0),
              sortY: worldY,
              blendMode,
            }
            unitOverlays.push(ovDrawable)
            overlayDrawables.push(ovDrawable)
          }
        }
      }
      if (highestShift) {
        // D2Client 0x6FB1C5F8..0x6FB1C60F: `pal = D2Win#10164(colorshift - 1)` (`hueVariations[colorshift - 1]`).
        // D2Client 0x6FB221B8..0x6FB221D3: when `pUnit == D2Client_GetPlayerUnit()`, `colorshift == 0x68` (104,
        // poison), and `!D2gfx_CheckWindowedOrGlide()` (#10035 == 0, i.e. 3D hardware render mode),
        // `*(BYTE*)(pUnit + 0x6C)` is cleared to 0 so the local player is tinted only by its green light (#1733).
        const isLocalPlayerUnit =
          unit.kind === 'player' &&
          unit.isLocalPlayer !== false &&
          (unit.isLocalPlayer === true || selfUnitId === undefined || unit.id === selfUnitId)
        const suppressLocalPoisonShift =
          isLocalPlayerUnit && highestShift.colorShift === 104 && !softwarePaletteMode
        if (highestShift.paletteRow > 0 && !suppressLocalPoisonShift) {
          activePaletteRow = highestShift.paletteRow
        }
        tintColor = null
      }
    }
    if (activePaletteRow === undefined && unit.kind === 'monster' && unit.paletteIndex !== undefined) {
      // 0x6fb03a30: the monster's colormap from its create-time palette index (gfx+0x38, #1516 / #1517).
      const colormap = resolveMonsterColormap113c(unit.classId, unit.paletteIndex)
      if (colormap !== null) {
        activePaletteRow = colormapPaletteRow(colormap)
        tintColor = null
      }
    }
    if (activePaletteRow !== undefined && activePaletteRow > 0) {
      tintColor = null
    }

    const activeCastState = !isCorpse ? unit.castState : undefined
    const effectiveTargetX = unit.targetX ?? activeCastState?.targetX
    const effectiveTargetY = unit.targetY ?? activeCastState?.targetY
    const defaultCastMode = unit.kind === 'player' ? 10 : 7
    const effectiveMode = activeCastState
      ? (activeCastState.mode ?? unit.mode ?? defaultCastMode)
      : (unit.mode ?? (unit.kind === 'player' || unit.kind === 'monster' ? (isCorpse ? 12 : 1) : 0))
    let derivedAnimMode: string | undefined = undefined
    if (!isCorpse) {
      if (unit.kind === 'player') {
        if (effectiveMode === 7) derivedAnimMode = 'A1'
        else if (effectiveMode === 8) derivedAnimMode = 'A2'
        else if (effectiveMode === 9) derivedAnimMode = 'BL'
        else if (effectiveMode === 10) derivedAnimMode = 'SC'
        else if (effectiveMode === 11) derivedAnimMode = 'TH'
        else if (effectiveMode === 12) derivedAnimMode = 'KK'
        else if (effectiveMode === 13) derivedAnimMode = 'S1'
        else if (effectiveMode === 14) derivedAnimMode = 'S2'
        else if (effectiveMode === 15) derivedAnimMode = 'S3'
        else if (effectiveMode === 16) derivedAnimMode = 'S4'
        else if (effectiveMode === 18) derivedAnimMode = 'SQ'
      } else if (unit.kind === 'monster') {
        if (effectiveMode === 4) derivedAnimMode = 'A1'
        else if (effectiveMode === 5) derivedAnimMode = 'A2'
        else if (effectiveMode === 7) derivedAnimMode = 'SC'
        else if (effectiveMode === 8) derivedAnimMode = 'S1'
        else if (effectiveMode === 9) derivedAnimMode = 'S2'
        else if (effectiveMode === 10) derivedAnimMode = 'S3'
        else if (effectiveMode === 11) derivedAnimMode = 'S4'
        else if (effectiveMode === 14) derivedAnimMode = 'SQ'
      }
    }
    const animMode = unit.animMode ?? derivedAnimMode
    const animStartedAtMs =
      unit.animStartedAtMs ??
      activeCastState?.startedAtMs ??
      (rawAny.modeStartedAtMs as number | undefined)
    const animStepSpeed256 =
      unit.animStepSpeed256 ??
      activeCastState?.stepSpeed256 ??
      (rawAny.animStepSpeed256 as number | undefined)
    const animEffRate =
      unit.animEffRate ??
      activeCastState?.effRate ??
      (rawAny.animEffRate as number | undefined)
    const velocityPercent =
      unit.velocityPercent ?? (rawAny.velocityPercent as number | undefined)

    if (activeCastState) {
      const castOverlayKey =
        activeCastState.castOverlayToken ?? getSkillCastOverlay(activeCastState.skillId)
      if (
        castOverlayKey &&
        !unitOverlays.some((o) => o.token.toLowerCase() === castOverlayKey.toLowerCase())
      ) {
        const normCastKey = castOverlayKey.trim().toLowerCase()
        const ovRow = OVERLAY_ROW_BY_NAME.get(normCastKey)
        const ovTxt =
          CANONICAL_113C_OVERLAYS[normCastKey] ??
          getOverlayTxtData(castOverlayKey)
        if (ovRow || ovTxt) {
          const totalFrames = Math.max(1, ovRow?.frames ?? ovTxt!.frames)
          const animRate = Math.max(1, (ovRow?.animRate ?? ovTxt!.animRate) || 16)
          const elapsedMs = activeCastState.elapsedMs ?? 0
          const elapsedTicks = elapsedMs / 40
          const frame = Math.min(
            totalFrames - 1,
            Math.max(0, Math.floor((elapsedTicks * animRate) / 16)),
          )
          const preDraw = ovRow !== undefined ? ovRow.preDraw !== 0 : Boolean(ovTxt?.preDraw)
          const xOffset = ovRow?.xOffset ?? ovTxt?.xOffset ?? 0
          const yOffset =
            ovRow !== undefined
              ? computeOverlayYOffset113c(ovRow, unit)
              : (ovTxt?.yOffset ?? 0)
          const rawTrans = ovRow?.trans ?? ovTxt!.trans
          const ovDrawable: SceneOverlayDrawable = {
            drawableKind: 'overlay',
            ownerUnitId: unit.id,
            overlayId: activeCastState.skillId || 1000,
            token: castOverlayKey,
            frame,
            totalFrames,
            loop: false,
            ...(preDraw ? { preDraw: true } : {}),
            subX: unit.x,
            subY: unit.y,
            worldX: worldX + xOffset,
            worldY: worldY + yOffset - (unit.altitude ?? 0),
            sortY: worldY,
            blendMode: overlayTransToBlendMode(rawTrans),
          }
          unitOverlays.push(ovDrawable)
          overlayDrawables.push(ovDrawable)
          if (ovRow !== undefined || activeCastState.castOverlayToken !== undefined) {
            pushOverlayLight(
              lightEmitters,
              unit,
              `cast:${String(activeCastState.skillId)}:${String(activeCastState.startedAtMs)}`,
              castOverlayKey,
            )
          }
        }
      }
    }

    const dir = unitFacingDir64(unit, effectiveTargetX, effectiveTargetY)

    const isWarp = unit.kind === 'warp' || unit.kind === 'tile'
    const warpId = isWarp ? (unit.warpId ?? unit.classId) : unit.warpId
    const radiusX = isWarp ? (unit.radiusX ?? 28) : unit.radiusX
    const radiusY = isWarp ? (unit.radiusY ?? 20) : unit.radiusY
    const resolvedName = unit.name && unit.name.trim() !== '' ? unit.name : undefined
    const isFaded =
      Boolean(unit.isFaded ?? rawAny.isFaded) ||
      hasFadeState ||
      (resolveUnitStat(unit.stats, 181) ?? 0) > 0 ||
      unitOverlays.some((o) => o.token.toLowerCase() === 'fade')

    const isMonSubmerged =
      unit.kind === 'monster' &&
      !isCorpse &&
      isMonsterSubmergedMode113c(
        unit.classId,
        effectiveMode,
        activeCastState?.skillId ?? unit.lastSkillId ?? (rawAny.lastSkillId as number | undefined),
      )

    const unitDrawable: SceneUnitDrawable = {
      drawableKind: 'unit',
      unitKind: unit.kind,
      id: unit.id,
      unitId: unit.id,
      classId: unit.classId,
      token: resolveUnitToken(unit),
      code: unit.code ?? unit.itemCode,
      itemQuality: unit.itemQuality ?? unit.quality,
      goldAmount: unit.goldAmount,
      mode: effectiveMode,
      direction: dir,
      frame: unit.frame ?? (unit.kind === 'item' ? 0 : (tick % 8)),
      subX: unit.x,
      subY: unit.y,
      ...lightSub(unit),
      worldX,
      worldY,
      sortY: worldY,
      ...(unit.altitude !== undefined && unit.altitude !== 0 ? { altitude: unit.altitude } : {}),
      blendMode: isFaded ? 'trans50' : 'normal',
      lifePct:
        unit.lifePct ?? (unit.hpRatio !== undefined ? Math.round(unit.hpRatio * 128) : 100),
      name: resolvedName,
      ...(unit.nameZh !== undefined ? { nameZh: unit.nameZh } : {}),
      ...(unit.itemColor !== undefined ? { itemColor: unit.itemColor } : {}),
      isHovered: isMonSubmerged ? false : Boolean(unit.isHovered),
      isCorpse,
      tintColor:
        tintColor ??
        (!isCorpse && unit.kind === 'monster'
          ? unit.classId === 357
            ? ([255, 230, 128] as const)
            : unit.classId === 356
              ? ([191, 217, 255] as const)
              : null
          : null),
      ...(() => {
        const baseAppearance: SorceressAppearanceSpec | undefined =
          unit.equipmentAppearance ??
          (unit.kind === 'monster' && !isCorpse
            ? unit.classId === 356
              ? ((unit.ownerId !== undefined
                  ? playerAppearancesById.get(unit.ownerId)
                  : undefined) ??
                fallbackAmazonAppearance ??
                DEFAULT_AMAZON_APPEARANCE)
              : unit.classId === 357
                ? VALKYRIE_113C_APPEARANCE
                : undefined
            : undefined)
        if (baseAppearance !== undefined) {
          const effAppearance = applyStateItemTransToAppearance(
            baseAppearance,
            statesIter,
          )
          return {
            equipmentAppearance: effAppearance,
            appearanceKey:
              effAppearance !== unit.equipmentAppearance
                ? appearanceKey(effAppearance)
                : (unit.appearanceKey ?? appearanceKey(effAppearance)),
          }
        }
        return unit.appearanceKey !== undefined ? { appearanceKey: unit.appearanceKey } : {}
      })(),
      overlays: unitOverlays,
      ...(warpId !== undefined ? { warpId } : {}),
      ...(unit.toLevelId !== undefined ? { toLevelId: unit.toLevelId } : {}),
      ...(radiusX !== undefined ? { radiusX } : {}),
      ...(radiusY !== undefined ? { radiusY } : {}),
      ...(unit.goldAmount !== undefined ? { goldAmount: unit.goldAmount } : {}),
      ...(unit.itemCode !== undefined ? { itemCode: unit.itemCode } : {}),
      ...(unit.flippyFile !== undefined ? { flippyFile: unit.flippyFile } : {}),
      ...(unit.invFile !== undefined ? { invFile: unit.invFile } : {}),
      ...(unit.invtransform !== undefined ? { invtransform: unit.invtransform } : {}),
      ...(unit.itemQuality !== undefined
        ? { itemQuality: unit.itemQuality }
        : unit.quality !== undefined
          ? { itemQuality: unit.quality }
          : {}),
      ...(activeCastState !== undefined ? { castState: activeCastState } : {}),
      ...(unit.lastSkillId !== undefined ? { lastSkillId: unit.lastSkillId } : {}),
      ...(animMode !== undefined ? { animMode } : {}),
      ...(animStartedAtMs !== undefined ? { animStartedAtMs } : {}),
      ...(animStepSpeed256 !== undefined ? { animStepSpeed256 } : {}),
      ...(animEffRate !== undefined ? { animEffRate } : {}),
      ...(velocityPercent !== undefined ? { velocityPercent } : {}),
      ...(unit.kind === 'monster' && unit.compVariants !== undefined ? { compVariants: unit.compVariants } : {}),
      ...(unit.isLocalPlayer !== undefined ? { isLocalPlayer: unit.isLocalPlayer } : {}),
      ...(unit.portalOwnerName !== undefined ? { portalOwnerName: unit.portalOwnerName } : {}),
      ...(unit.portalAreaId !== undefined ? { portalAreaId: unit.portalAreaId } : {}),
      ...(unit.isPartyMember !== undefined ? { isPartyMember: unit.isPartyMember } : {}),
      ...(unit.hitBox !== undefined ? { hitBox: unit.hitBox } : {}),
      ...(isMonSubmerged
        ? { isSel: false, noSel: true }
        : {
            ...(unit.isSel !== undefined ? { isSel: unit.isSel } : {}),
            ...(unit.noSel !== undefined ? { noSel: unit.noSel } : {}),
          }),
      ...(unit.corpseSel !== undefined ? { corpseSel: unit.corpseSel } : {}),
      ...(activePaletteRow !== undefined ? { paletteRow: activePaletteRow } : {}),
      ...(unit.sync !== undefined ? { sync: unit.sync } : {}),
      ...(unit.isNpc !== undefined ? { isNpc: unit.isNpc } : {}),
      ...(hasWantsInteract ? { wantsInteract: true } : {}),
      ...(unit.interactType !== undefined ? { interactType: unit.interactType } : {}),
      ...(unit.shrineType !== undefined ? { shrineType: unit.shrineType } : {}),
      ...(unit.flags !== undefined ? { flags: unit.flags } : {}),
      ...(unit.isChampion !== undefined ? { isChampion: unit.isChampion } : {}),
      ...(unit.isUnique !== undefined ? { isUnique: unit.isUnique } : {}),
      ...(unit.isSuperUnique !== undefined ? { isSuperUnique: unit.isSuperUnique } : {}),
      ...(unit.superUniqueId !== undefined ? { superUniqueId: unit.superUniqueId } : {}),
      ...(unit.ownerType !== undefined ? { ownerType: unit.ownerType } : {}),
      ...(unit.ownerId !== undefined ? { ownerId: unit.ownerId } : {}),
      ...(unit.overheadText !== undefined ? { overheadText: unit.overheadText } : {}),
      ...(unit.overheadColor !== undefined ? { overheadColor: unit.overheadColor } : {}),
      ...(isFaded ? { isFaded: true } : {}),
      ...(hasInvisState ? { hasInvisState: true } : {}),
      ...(statesIter !== undefined ? { states: statesIter } : {}),
    }
    if (isCorpse && Boolean(unit.corpseSuppressed ?? rawAny.corpseSuppressed)) {
      continue
    }
    // 1.13c States.txt hide=1 corpse states (#1 freeze, #99 redeemed, #104 corpse_nodraw,
    // #107 shatter, #154 recycled, #173 corpseexp, #184 uberminion): consumed/shattered corpses are not drawn.
    if (isCorpse && statesIterHasAny(statesIter, CORPSE_HIDE_STATES_113C)) {
      continue
    }
    unitDrawables.push(unitDrawable)
  }

  const getEntityLayer = (d: SceneEntityDrawable): number => {
    if (d.drawableKind === 'unit') {
      return d.unitKind === 'item' || d.isCorpse ? 0 : 1
    }
    if (d.drawableKind === 'missile') return 1
    if (d.drawableKind === 'overlay') return d.preDraw ? 0 : 2
    return 1
  }

  const sortedDrawables: SceneEntityDrawable[] = [
    ...unitDrawables,
    ...missileDrawables,
    ...overlayDrawables,
  ].sort(
    (a, b) =>
      sceneEntityCellDepth(a) - sceneEntityCellDepth(b) ||
      a.sortY - b.sortY ||
      getEntityLayer(a) - getEntityLayer(b) ||
      a.worldX - b.worldX,
  )

  return {
    unitDrawables,
    missileDrawables,
    overlayDrawables,
    sortedDrawables,
    pointLights,
    lightEmitters,
  }
}
