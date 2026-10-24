/**
 * Diablo II 1.13c Client-Side Monster/NPC Motion State Machine (`src/client/motion/npc-motion.ts`, Refs #808).
 *
 * Ports the 1.13c `D2Client.dll` (ImageBase `0x6FAB0000`) + `D2Common.dll` (ImageBase `0x6FD50000`)
 * client-side monster movement, drift correction, command dispatch, and per-tick stepping:
 * - Drift check & snap: `0x6FADA1B0` (`#10906` = `D2Common_10230`).
 * - Monster command dispatcher: `0x6FAFDC70` (`cmd` `0x00..0x1D`, table `0x6FB82E68`, velocity tail `0x6FAFEB18`).
 * - Mode change & velocity/anim-rate update: `0x6FADA6C0` -> `#11090` (`0x6FD83920`) -> `#10595` (`0x6FD835F0`)
 *   -> `#10819` (`0x6FD83110` `UNITS_UpdateAnimRateAndVelocity`) + `#10054` (`0x6FD84EE0`).
 * - Per-tick monster step: `0x6FAFF4A0` (`0x6FAFBFF0` entry table `0x6FBA21A8` / alt `0x6FBA2268`,
 *   `0x6FADA700` -> `0x6FADA0B0` -> `#10342` `D2Common_10226`, `NU` resume `#10340` `D2Common_10213`,
 *   anim advance `0x6FAFEE40`, turn step `#10603` `D2COMMON_10193_PATH_AdjustDirection`,
 *   mode-end `0x6FAFDA60` with `dwFlagEx & 0x2000` hold and `SplClientEnd` `0x6FAFDBF4`).
 * - Per-unit packet queue: `0x6FB5C630` enqueue / `0x6FB5BC20` drain (`0x6FADB333`).
 */

import {
  type DynamicPath,
  type PathRoom,
  type PathUnit,
  D2COMMON_10160_PathUpdateDirection,
  D2COMMON_10170_PathSetTargetPos,
  D2COMMON_10190_PATH_SetDistance,
  D2COMMON_10193_PATH_AdjustDirection,
  D2COMMON_10212_PATH_SetMoveFlags,
  D2Common_10142,
  D2Common_10153,
  D2Common_10213,
  D2Common_10214,
  D2Common_10216,
  D2Common_10226,
  D2Common_10228,
  D2Common_10229,
  D2Common_10230,
  D2Common_10231,
  D2Common_10399,
  D2Common_10434_FaceSubtile,
  DUNGEON_GetRoomAtPosition,
  MONMODE_ATTACK1,
  MONMODE_ATTACK2,
  MONMODE_BLOCK,
  MONMODE_CAST,
  MONMODE_DEAD,
  MONMODE_DEATH,
  MONMODE_GETHIT,
  MONMODE_KNOCKBACK,
  MONMODE_NEUTRAL,
  MONMODE_RUN,
  MONMODE_SEQUENCE,
  MONMODE_SKILL1,
  MONMODE_SKILL2,
  MONMODE_SKILL3,
  MONMODE_SKILL4,
  MONMODE_WALK,
  MONSTATSFLAGINDEX_INTERACT,
  MONSTATSFLAGINDEX_NPC,
  PATHTYPE_KNOCKBACK_CLIENT,
  PATHTYPE_TOWARD,
  PATH_AllocDynamicPath,
  PATH_FreeDynamicPath,
  PATH_GetDirection,
  PATH_GetNewDirection,
  PATH_GetNumberOfPathPoints,
  PATH_GetTargetTypeAndGUID,
  PATH_GetTargetUnit,
  PATH_GetVelocity,
  PATH_GetXPosition,
  PATH_GetYPosition,
  PATH_RecacheRoomIfNeeded,
  PATH_ResetToPreviousType,
  PATH_SetDirection,
  PATH_SetNewDistance,
  PATH_SetStepNum,
  PATH_SetTargetUnit,
  PATH_SetType,
  PATH_SetUnitAliveCollision,
  PATH_SetUnitDeadCollision,
  PATH_SetVelocity,
  UNITFLAGEX_UNK_PATH_RELATED,
  UNITFLAG_DOUPDATE,
  UNITFLAG_ISASYNC,
  UNITFLAG_ISDEAD,
  UNITS_GetRoom,
  UNIT_MONSTER,
  buildAdjacentRoomLists,
  getMonsterPathRecord,
  i32,
  u16,
  u32,
} from '../../common/path/index.ts'
import { MONSTATS_TXT_RECORD_COUNT } from '../../common/path/monster-path-data.ts'
import type { NpcCommandPayload113c } from '../../netproto/index.ts'

// ---------------------------------------------------------------------------
// 1.13c Tables & Constants
// ---------------------------------------------------------------------------

/**
 * `cmd -> mode` table (`D2Client.dll` `0x6FB82E68`, 30 entries `0x00..0x1D`, 8 bytes `{mode, flag}` each).
 * Mode `16` means "no mode change" (`cmd` `2, 3, 0x13`).
 */
export const NPC_CMD_TO_MODE_113C: readonly number[] = [
  MONMODE_WALK, // 0x00: walk to target unit
  MONMODE_WALK, // 0x01: walk to (x, y)
  16, // 0x02: none
  16, // 0x03: none
  MONMODE_CAST, // 0x04: SC at (x, y)
  MONMODE_CAST, // 0x05: SC at target unit
  MONMODE_GETHIT, // 0x06: GH
  MONMODE_NEUTRAL, // 0x07: NU (stop)
  MONMODE_DEATH, // 0x08: DT
  MONMODE_DEAD, // 0x09: DD
  MONMODE_ATTACK1, // 0x0A: A1 at target unit
  MONMODE_ATTACK1, // 0x0B: A1 at (x, y)
  MONMODE_SKILL1, // 0x0C: S1 at (x, y)
  MONMODE_SKILL1, // 0x0D: S1 at target unit
  MONMODE_SKILL2, // 0x0E: S2 at (x, y)
  MONMODE_SKILL2, // 0x0F: S2 at target unit
  MONMODE_ATTACK2, // 0x10: A2 at target unit
  MONMODE_ATTACK2, // 0x11: A2 at (x, y)
  MONMODE_BLOCK, // 0x12: BL
  16, // 0x13: KB overlay (no mode change)
  MONMODE_KNOCKBACK, // 0x14: KB path
  MONMODE_SEQUENCE, // 0x15: SQ
  MONMODE_SEQUENCE, // 0x16: SQ
  MONMODE_RUN, // 0x17: run to (x, y)
  MONMODE_RUN, // 0x18: run to target unit
  MONMODE_SKILL1, // 0x19: S1
  MONMODE_SKILL3, // 0x1A: S3 at (x, y)
  MONMODE_SKILL3, // 0x1B: S3 at target unit
  MONMODE_SKILL4, // 0x1C: S4 at (x, y)
  MONMODE_SKILL4, // 0x1D: S4 at target unit
]

/** Mode step entry `{ move, anim, end }` from `D2Client.dll` `0x6FBA21A8` / `0x6FBA2268`. */
export interface NpcModeStepEntry {
  readonly move: 0 | 1 | 2
  readonly anim: 0 | 1 | 2 | 3
  readonly end: 0 | 1 | 2 | 3 | 4
}

/** Normal mode step table (`D2Client.dll` `0x6FBA21A8`, 16 entries for modes `0..15`). */
export const NPC_MODE_TABLE_NORMAL_113C: readonly NpcModeStepEntry[] = [
  { move: 0, anim: 2, end: 0 }, // 0 DT
  { move: 0, anim: 0, end: 0 }, // 1 NU
  { move: 1, anim: 0, end: 1 }, // 2 WL
  { move: 0, anim: 1, end: 2 }, // 3 GH
  { move: 2, anim: 1, end: 3 }, // 4 A1
  { move: 2, anim: 1, end: 3 }, // 5 A2
  { move: 0, anim: 1, end: 2 }, // 6 BL
  { move: 0, anim: 1, end: 2 }, // 7 SC
  { move: 0, anim: 1, end: 2 }, // 8 S1
  { move: 0, anim: 1, end: 2 }, // 9 S2
  { move: 0, anim: 2, end: 0 }, // 10 S3
  { move: 0, anim: 0, end: 0 }, // 11 S4
  { move: 0, anim: 2, end: 0 }, // 12 DD
  { move: 1, anim: 2, end: 2 }, // 13 KB
  { move: 2, anim: 1, end: 2 }, // 14 SQ
  { move: 1, anim: 0, end: 1 }, // 15 RN
]

/** Alternate mode step table (`D2Client.dll` `0x6FBA2268`, used when `MonStats2` `*mv` bit is set). */
export const NPC_MODE_TABLE_ALT_113C: readonly NpcModeStepEntry[] = [
  { move: 1, anim: 2, end: 0 }, // 0 DT (sandleaper)
  { move: 0, anim: 1, end: 2 }, // 1 NU
  { move: 0, anim: 1, end: 2 }, // 2 WL
  { move: 0, anim: 1, end: 2 }, // 3 GH
  { move: 1, anim: 0, end: 4 }, // 4 A1 (A1mv)
  { move: 1, anim: 0, end: 4 }, // 5 A2 (A2mv)
  { move: 2, anim: 1, end: 3 }, // 6 BL (Diablo S4 special)
  { move: 1, anim: 0, end: 4 }, // 7 SC (SCmv / Baal S3 special)
  { move: 1, anim: 0, end: 4 }, // 8 S1 (S1mv)
  { move: 1, anim: 0, end: 4 }, // 9 S2 (S2mv)
  { move: 0, anim: 2, end: 0 }, // 10 S3
  { move: 1, anim: 2, end: 0 }, // 11 S4
  { move: 0, anim: 2, end: 0 }, // 12 DD
  { move: 0, anim: 1, end: 2 }, // 13 KB
  { move: 0, anim: 1, end: 2 }, // 14 SQ
  { move: 0, anim: 1, end: 2 }, // 15 RN
]

/**
 * `0x6FAFBFF0` (edi = unit): selects the `{move, anim, end}` entry for a monster's current mode.
 *
 * - `hcIdx` 243 (`diablo`) or 333 (`diabloclone`) in `S4(11)` -> `{2, 1, 3}` (`0x6FBA22B0`).
 * - `hcIdx` 543 (`baalthrone`), 544 (`baalcrab`), or 570 (`baalclone`) in `S3(10)` -> `{1, 0, 4}` (`0x6FBA22BC`).
 * - Else if `MonStats2.nModeEnabledWhenMovingFlags` (`+0x104`) has bit `mode` set -> `NPC_MODE_TABLE_ALT_113C[mode]`.
 * - Else if `mode === DT(0)` and `MonStats.nBaseId === 78` (`sandleaper1..7`, `#10707`) -> `{1, 2, 0}` (`0x6FBA2268`).
 * - Else -> `NPC_MODE_TABLE_NORMAL_113C[mode]`.
 */
export function selectNpcModeStepEntry113c(classId: number, mode: number): NpcModeStepEntry | null {
  if (mode < 0 || mode >= 16) return null
  if (mode === MONMODE_SKILL4 && (classId === 243 || classId === 333)) {
    return NPC_MODE_TABLE_ALT_113C[6]!
  }
  if (mode === MONMODE_SKILL3 && (classId === 543 || classId === 544 || classId === 570)) {
    return NPC_MODE_TABLE_ALT_113C[7]!
  }
  if (classId >= 0 && classId < MONSTATS_TXT_RECORD_COUNT) {
    const rec = getMonsterPathRecord(classId)
    if ((rec.moveInAnimFlags & (1 << mode)) !== 0) {
      return NPC_MODE_TABLE_ALT_113C[mode]!
    }
    if (mode === MONMODE_DEATH && rec.baseId === 78) {
      return NPC_MODE_TABLE_ALT_113C[0]!
    }
  }
  return NPC_MODE_TABLE_NORMAL_113C[mode]!
}

/**
 * `0x6FAFBFA0`: returns true when `selectNpcModeStepEntry113c(classId, mode).move === 1`
 * (i.e. `WL(2)`, `RN(15)`, `KB(13)`, or a mode with `MonStats2.nModeEnabledWhenMovingFlags` `*mv` bit set).
 * Modes with `move === 2` (`A1`, `A2`, `SQ` without `*mv`) turn in place and do NOT move along a path.
 */
export function doesNpcModeMove113c(classId: number, mode: number): boolean {
  const entry = selectNpcModeStepEntry113c(classId, mode)
  return entry !== null && entry.move === 1
}

/**
 * `0x6FAB1C10(classId, mode)`: returns true when `MonStats2.dwModeFlags` (`+0xF0`) enables `mode`.
 */
export function monsterClassHasMode113c(classId: number, mode: number): boolean {
  if (mode < 0 || mode >= 16) return false
  if (classId < 0 || classId >= MONSTATS_TXT_RECORD_COUNT) return true
  const rec = getMonsterPathRecord(classId)
  return (rec.modeFlags & (1 << mode)) !== 0
}

/**
 * `0x6FD823E0`: diminishing-returns bonus `idiv(base * statVal, base + statVal)` (`0x6FDE4608`).
 * - FAR (93), FHR (99), FCR (105), FBR (102): `base = 120`.
 * - FRW (96): `base = 150`.
 */
export function computeAnimStatBonus113c(base: number, statValue: number): number {
  const v = statValue | 0
  if (v <= 0) return 0
  const denom = (base + v) | 0
  if (denom <= 0) return 0
  return Math.trunc(Math.imul(base, v) / denom) | 0
}

/**
 * Mode-dependent per-axis drift tolerance `T` (`D2Client.dll` `0x6FADA1B0` at `0x6FADA2AC..0x6FADA2D6`):
 * - Modes `3..5` (`GH`, `A1`, `A2`) -> `5`
 * - Modes `6..11` (`BL`, `SC`, `S1..S4`) -> `7`
 * - All other living modes (`NU`, `WL`, `KB`, `SQ`, `RN`) -> `15`
 */
export function getMonsterDriftThreshold113c(currentMode: number): number {
  const idx = (currentMode | 0) - 3
  if (idx >= 0 && idx <= 8) {
    return idx < 3 ? 5 : 7
  }
  return 15
}

// ---------------------------------------------------------------------------
// Telemetry & Queued Packet Types
// ---------------------------------------------------------------------------

export interface NpcDriftSnapRecord {
  readonly unitId: number
  readonly classId: number
  readonly modeBefore: number
  readonly threshold: number
  readonly fromX: number
  readonly fromY: number
  readonly toX: number
  readonly toY: number
  readonly errX: number
  readonly errY: number
}

export interface NpcDriftStats {
  checks: number
  snaps: number
  maxErr: number
  lastSnap: NpcDriftSnapRecord | null
}

export type QueuedNpcItem =
  | {
      readonly kind: 'command'
      readonly npc: NpcCommandPayload113c
    }
  | {
      readonly kind: 'getHit'
      readonly mode: number
      readonly lifePct: number
      readonly hitClass?: number | undefined
    }

// ---------------------------------------------------------------------------
// NpcMotionUnit (per-monster state implementing PathUnit)
// ---------------------------------------------------------------------------

export class NpcMotionUnit implements PathUnit {
  readonly dwUnitType = UNIT_MONSTER
  dwClassId: number
  readonly dwUnitId: number
  dwAnimMode: number
  dwFlags: number
  dwFlagEx = 0
  pDynamicPath: DynamicPath | null = null
  pStaticPath = null
  readonly objectTxt = null

  /** Client copy of `STAT_VELOCITYPERCENT` (stat 67); initialized to 75 on `0xAC` (`0x6FAFD1FF`). */
  stat67 = 75
  /** Client copy of `STAT_ATTACKRATE` (stat 68); initialized to 100 on `0xAC`. */
  stat68 = 100
  /** Client copy of `STAT_OTHER_ANIMRATE` (stat 69); initialized to 100 on `0xAC`. */
  stat69 = 100
  /** `STAT_ITEM_FASTERATTACKRATE` (stat 93). */
  stat93 = 0
  /** `STAT_ITEM_FASTERMOVEVELOCITY` (stat 96). */
  stat96 = 0
  /** `STAT_ITEM_FASTERGETHITRATE` (stat 99). */
  stat99 = 0
  /** `STAT_ITEM_FASTERBLOCKRATE` (stat 102). */
  stat102 = 0
  /** `STAT_ITEM_FASTERCASTRATE` (stat 105). */
  stat105 = 0

  /** `unit+0x44`: animation frame in 8-bit fixed-point (`frame << 8`). */
  wFrame = 0
  /** `unit+0x48`: animation frame count in 8-bit fixed-point (`dwFrames << 8`). */
  wFrameCount = 8 << 8
  /** `unit+0x4C`: animation speed per tick (`int16`, 256 = 1 frame/tick). */
  wAnimSpeed = 256
  /** `unit+0x54`: action frame index. */
  wActionFrame = 0
  /** True when `#10595` (`initAnimStartFrame10595`) restarted the animation at frame 0 since the last update. */
  lastAnimRestarted = false

  /** `MonsterData+0x28`: bit 0 = local player is interacting with this town NPC (`0x6FACB0D6`). */
  npcInteractFlags = 0

  /** `unit+0x8C` / `unit+0x8E`: last authoritative server coordinates seen by `0x6FADA1B0`. */
  lastServerX = 0
  lastServerY = 0

  /** `unit+0xB0`: last hit class byte (`s[6]`). */
  hitClass = 0

  /** Latest life byte / percentage (`0..128`) from server packets. */
  lifeByte = 128

  /** Target unit reference stored by `0x6FB56040` (`unit` target fields). */
  targetUnitType = 0
  targetUnitId = 0

  /** Active states (e.g. `1` = `STATE_FREEZE`, `143` = `STATE_ATTACHED`). */
  readonly states = new Set<number>()

  /** Per-unit S2C packet FIFO (`unit+0xD8`, `0x6FB5C630` / `0x6FB5BC20`). */
  readonly queue: QueuedNpcItem[] = []

  constructor(params: {
    readonly unitId: number
    readonly classId: number
    readonly mode: number
    readonly isDead?: boolean | undefined
    readonly isAsync?: boolean | undefined
  }) {
    this.dwUnitId = params.unitId >>> 0
    this.dwClassId = params.classId | 0
    this.dwAnimMode = params.mode | 0
    let flags = 0
    if (params.isDead || params.mode === MONMODE_DEATH || params.mode === MONMODE_DEAD) {
      flags |= UNITFLAG_ISDEAD
    }
    if (params.isAsync) {
      flags |= UNITFLAG_ISASYNC
    }
    this.dwFlags = flags
  }

  /** Sub-tile X position in floating-point (`(dwPrecisionX - 0x8000) / 65536`). */
  get preciseX(): number {
    return this.pDynamicPath ? (this.pDynamicPath.dwPrecisionX - 0x8000) / 65536 : 0
  }

  /** Sub-tile Y position in floating-point (`(dwPrecisionY - 0x8000) / 65536`). */
  get preciseY(): number {
    return this.pDynamicPath ? (this.pDynamicPath.dwPrecisionY - 0x8000) / 65536 : 0
  }

  /** Integer sub-tile X (`PATH_GetXPosition`, `wPosX`). */
  get subtileX(): number {
    return PATH_GetXPosition(this.pDynamicPath)
  }

  /** Integer sub-tile Y (`PATH_GetYPosition`, `wPosY`). */
  get subtileY(): number {
    return PATH_GetYPosition(this.pDynamicPath)
  }

  /** Current 64-direction facing (`pDynamicPath->nDirection`). */
  get direction(): number {
    return this.pDynamicPath ? PATH_GetDirection(this.pDynamicPath) : 0
  }

  /** Target 64-direction facing (`pDynamicPath->nNewDirection`). */
  get targetDirection(): number {
    return this.pDynamicPath ? PATH_GetNewDirection(this.pDynamicPath) : 0
  }

  /** Current turn step (`pDynamicPath->nDiffDirection`, signed `int8`). */
  get turnStepDir(): number {
    return this.pDynamicPath ? (this.pDynamicPath.nDiffDirection << 24) >> 24 : 0
  }

  /** True when the monster is in `WL(2)` or `RN(15)` or has active path points in a moving mode. */
  get moving(): boolean {
    if ((this.dwFlags & UNITFLAG_ISDEAD) !== 0 || this.dwAnimMode === MONMODE_DEATH || this.dwAnimMode === MONMODE_DEAD) {
      return false
    }
    if (this.dwAnimMode === MONMODE_WALK || this.dwAnimMode === MONMODE_RUN) {
      return true
    }
    if (this.pDynamicPath && (this.pDynamicPath.dwFlags & 0x20) !== 0 && this.pDynamicPath.dwPathPoints > 0) {
      return doesNpcModeMove113c(this.dwClassId, this.dwAnimMode)
    }
    return false
  }
}

// ---------------------------------------------------------------------------
// Host World Callbacks & Room Management
// ---------------------------------------------------------------------------

export interface NpcMotionHostCallbacks {
  /** Resolve a target unit (`unitType: 0` player or `1` monster) as a `PathUnit` for `0x6FADA070` / `0x6FADA0B0`. */
  resolveTargetUnit?(unitType: number, unitId: number): PathUnit | null
  /** Query whether sub-tile `(x, y)` is blocked when creating a synthetic room in unit tests without a LevelView. */
  isSubTileBlocked?(x: number, y: number): boolean
  /** Monotonically increasing revision counter for static/synthetic collision changes; avoids rescanning unchanged rooms every tick. */
  getCollisionRevision?(): number
  /** Query default frame count and AnimData speed for `(classId, mode)` when available. */
  getAnimMetrics?(
    classId: number,
    mode: number,
    unitId?: number,
  ): { readonly frameCount: number; readonly animSpeed: number } | undefined
  /** Called whenever a monster's position, mode, direction, target, or life changes. */
  onUnitUpdated?(unit: NpcMotionUnit, prevMode: number, animRestarted?: boolean): void
}

const SYNTH_ROOM_SIZE = 40
const MAX_SYNTH_ROOMS_BEFORE_PRUNE = 100

/**
 * Manages the 160x160 (or 40x40) `PathRoom` grid used by `NpcMotion`.
 * - When rooms are registered from `LevelView` (`setRoomsFromLevel` / `addRevealedRoom`), uses their
 *   real collision masks.
 * - When a unit spawns or moves without explicit rooms, lazily creates a connected 5x5 neighborhood
 *   of 40x40 `PathRoom`s around `(x, y)` and samples `isSubTileBlocked` lazily per queried sub-tile
 *   keyed by `terrainRevision`, avoiding eager 1,600-cell scans across all historical rooms (#882).
 */
class NpcRoomStore {
  private readonly roomsByKey = new Map<string, PathRoom>()
  private readonly populatedCenters = new Set<string>()
  private hasExplicitRooms = false
  private isSubTileBlocked: ((x: number, y: number) => boolean) | undefined
  private getCollisionRevision: (() => number) | undefined
  private readonly getActiveAnchors: (() => Iterable<{ readonly x: number; readonly y: number }>) | undefined
  private lastRefreshedRevision = -1
  private terrainRevision = 1

  constructor(
    isSubTileBlocked?: (x: number, y: number) => boolean,
    getCollisionRevision?: () => number,
    getActiveAnchors?: () => Iterable<{ readonly x: number; readonly y: number }>,
  ) {
    this.isSubTileBlocked = isSubTileBlocked
    this.getCollisionRevision = getCollisionRevision
    this.getActiveAnchors = getActiveAnchors
  }

  get size(): number {
    return this.roomsByKey.size
  }

  setCollisionFallback(
    fn: ((x: number, y: number) => boolean) | undefined,
    getCollisionRevision?: (() => number) | undefined,
  ): void {
    this.isSubTileBlocked = fn
    this.getCollisionRevision = getCollisionRevision
    this.lastRefreshedRevision = -1
    this.terrainRevision++
  }

  clear(): void {
    this.roomsByKey.clear()
    this.populatedCenters.clear()
    this.hasExplicitRooms = false
    this.lastRefreshedRevision = -1
    this.terrainRevision++
  }

  /** Replace all rooms with a list of explicit rooms (and wire `adjacentRooms`). */
  setExplicitRooms(rooms: readonly PathRoom[]): void {
    this.roomsByKey.clear()
    this.populatedCenters.clear()
    this.hasExplicitRooms = rooms.length > 0
    this.lastRefreshedRevision = -1
    this.terrainRevision++
    for (const r of rooms) {
      this.roomsByKey.set(this.roomKey(r.subX, r.subY), r)
    }
    this.relinkAdjacentRooms()
  }

  /** Add or update a revealed room (`0x07`) and re-link `adjacentRooms`. */
  upsertRoom(room: PathRoom): void {
    this.hasExplicitRooms = true
    this.roomsByKey.set(this.roomKey(room.subX, room.subY), room)
    this.relinkAdjacentRooms()
  }

  /** Remove a hidden room (`0x08`) and re-link `adjacentRooms`. */
  removeRoomAt(subX: number, subY: number): void {
    if (this.roomsByKey.delete(this.roomKey(subX, subY))) {
      this.relinkAdjacentRooms()
    }
  }

  private relinkAdjacentRooms(): void {
    const adj = buildAdjacentRoomLists([...this.roomsByKey.values()])
    for (const [room, list] of adj) {
      ;(room as { adjacentRooms: readonly PathRoom[] }).adjacentRooms = list
    }
  }

  /**
   * Mark synthetic rooms' base terrain masks (`0x0001`) for lazy re-sampling from `isSubTileBlocked`
   * when unit tests or area updates toggle sub-tile walls dynamically (#882).
   */
  refreshSyntheticObstacles(force = false): void {
    if (this.hasExplicitRooms || !this.isSubTileBlocked) return
    if (force) {
      if (this.getCollisionRevision) {
        this.lastRefreshedRevision = this.getCollisionRevision()
      }
      this.terrainRevision++
      return
    }
    if (this.getCollisionRevision) {
      const rev = this.getCollisionRevision()
      if (rev === this.lastRefreshedRevision) return
      const hadPreviousRevision = this.lastRefreshedRevision !== -1
      this.lastRefreshedRevision = rev
      this.terrainRevision++
      if (hadPreviousRevision && this.getActiveAnchors) {
        for (const pos of this.getActiveAnchors()) {
          const sx = Math.floor(pos.x)
          const sy = Math.floor(pos.y)
          const baseRx = Math.floor(sx / SYNTH_ROOM_SIZE) * SYNTH_ROOM_SIZE
          const baseRy = Math.floor(sy / SYNTH_ROOM_SIZE) * SYNTH_ROOM_SIZE
          const room = this.roomsByKey.get(this.roomKey(baseRx, baseRy))
          room?.grid?.get(sx, sy)
        }
      }
      return
    }
    this.terrainRevision++
  }

  /**
   * Find the `PathRoom` containing `(x, y)` (`0x6FAB1400` + `#11010`).
   * If no explicit rooms are loaded, lazily creates a 5x5 neighborhood of synthetic `PathRoom`s.
   */
  findOrCreateRoomAt(x: number, y: number, hintRoom: PathRoom | null = null): PathRoom | null {
    const sx = Math.floor(x)
    const sy = Math.floor(y)
    if (!this.hasExplicitRooms) {
      this.refreshSyntheticObstacles()
      if (sx >= 0 && sy >= 0) {
        const baseRx = Math.floor(sx / SYNTH_ROOM_SIZE) * SYNTH_ROOM_SIZE
        const baseRy = Math.floor(sy / SYNTH_ROOM_SIZE) * SYNTH_ROOM_SIZE
        const centerKey = this.roomKey(baseRx, baseRy)
        if (this.populatedCenters.has(centerKey)) {
          const existing = this.roomsByKey.get(centerKey)
          if (existing) {
            return existing
          }
        }
        return this.ensureSyntheticNeighborhood(sx, sy)
      }
    }
    if (hintRoom) {
      const found = DUNGEON_GetRoomAtPosition(hintRoom, sx, sy)
      if (found) return found
    }
    for (const r of this.roomsByKey.values()) {
      if (sx >= r.subX && sx < r.subX + r.subW && sy >= r.subY && sy < r.subY + r.subH) {
        return r
      }
    }
    if (this.hasExplicitRooms) {
      return null
    }
    return this.ensureSyntheticNeighborhood(sx, sy)
  }

  private pruneDistantSyntheticRooms(focusRx: number, focusRy: number): boolean {
    if (this.hasExplicitRooms || this.roomsByKey.size < MAX_SYNTH_ROOMS_BEFORE_PRUNE) {
      return false
    }
    const anchorRooms: Array<{ readonly rx: number; readonly ry: number }> = [
      { rx: focusRx, ry: focusRy },
    ]
    if (this.getActiveAnchors) {
      for (const pos of this.getActiveAnchors()) {
        const ax = Math.floor(pos.x / SYNTH_ROOM_SIZE) * SYNTH_ROOM_SIZE
        const ay = Math.floor(pos.y / SYNTH_ROOM_SIZE) * SYNTH_ROOM_SIZE
        anchorRooms.push({ rx: ax, ry: ay })
      }
    }
    const maxDist = SYNTH_ROOM_SIZE * 2
    let removed = false
    for (const [key, room] of this.roomsByKey) {
      let keep = false
      for (let i = 0; i < anchorRooms.length; i++) {
        const a = anchorRooms[i]!
        if (
          Math.abs(room.subX - a.rx) <= maxDist &&
          Math.abs(room.subY - a.ry) <= maxDist
        ) {
          keep = true
          break
        }
      }
      if (!keep) {
        this.roomsByKey.delete(key)
        removed = true
      }
    }
    if (removed) {
      this.populatedCenters.clear()
    }
    return removed
  }

  private ensureSyntheticNeighborhood(sx: number, sy: number): PathRoom {
    this.refreshSyntheticObstacles()
    const baseRx = Math.floor(sx / SYNTH_ROOM_SIZE) * SYNTH_ROOM_SIZE
    const baseRy = Math.floor(sy / SYNTH_ROOM_SIZE) * SYNTH_ROOM_SIZE
    let changed = this.pruneDistantSyntheticRooms(baseRx, baseRy)
    const store = this
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const rx = baseRx + dx * SYNTH_ROOM_SIZE
        const ry = baseRy + dy * SYNTH_ROOM_SIZE
        if (rx < 0 || ry < 0) continue
        const key = this.roomKey(rx, ry)
        if (!this.roomsByKey.has(key)) {
          const mask = new Uint16Array(SYNTH_ROOM_SIZE * SYNTH_ROOM_SIZE)
          const sampledRev = new Int32Array(SYNTH_ROOM_SIZE * SYNTH_ROOM_SIZE)
          if (dx === 0 && dy === 0 && store.isSubTileBlocked && store.getCollisionRevision) {
            const rev = store.terrainRevision
            for (let ly = 0; ly < SYNTH_ROOM_SIZE; ly++) {
              const wy = ry + ly
              const rowOffset = ly * SYNTH_ROOM_SIZE
              for (let lx = 0; lx < SYNTH_ROOM_SIZE; lx++) {
                const idx = rowOffset + lx
                sampledRev[idx] = rev
                if (store.isSubTileBlocked(rx + lx, wy)) {
                  mask[idx] = 0x0001
                }
              }
            }
          }
          const grid = {
            get(wx: number, wy: number): number {
              const lx = wx - rx
              const ly = wy - ry
              if (lx < 0 || lx >= SYNTH_ROOM_SIZE || ly < 0 || ly >= SYNTH_ROOM_SIZE) return 0
              const idx = ly * SYNTH_ROOM_SIZE + lx
              if (store.isSubTileBlocked && sampledRev[idx] !== store.terrainRevision) {
                sampledRev[idx] = store.terrainRevision
                if (store.isSubTileBlocked(wx, wy)) {
                  mask[idx] = (mask[idx]! | 0x0001) & 0xffff
                } else {
                  mask[idx] = mask[idx]! & ~0x0001 & 0xffff
                }
              }
              return mask[idx]!
            },
            set(wx: number, wy: number, val: number): void {
              const lx = wx - rx
              const ly = wy - ry
              if (lx < 0 || lx >= SYNTH_ROOM_SIZE || ly < 0 || ly >= SYNTH_ROOM_SIZE) return
              const idx = ly * SYNTH_ROOM_SIZE + lx
              sampledRev[idx] = store.terrainRevision
              mask[idx] = val & 0xffff
            },
          }
          this.roomsByKey.set(key, {
            subX: rx,
            subY: ry,
            subW: SYNTH_ROOM_SIZE,
            subH: SYNTH_ROOM_SIZE,
            isTown: false,
            grid,
            adjacentRooms: [],
          })
          changed = true
        }
      }
    }
    this.populatedCenters.add(this.roomKey(baseRx, baseRy))
    if (changed) {
      this.relinkAdjacentRooms()
    }
    return this.roomsByKey.get(this.roomKey(baseRx, baseRy))!
  }

  private roomKey(subX: number, subY: number): string {
    return `${subX},${subY}`
  }
}

// ---------------------------------------------------------------------------
// NpcMotion Engine
// ---------------------------------------------------------------------------

export class NpcMotion {
  private readonly units = new Map<number, NpcMotionUnit>()
  private readonly roomStore: NpcRoomStore
  private callbacks: NpcMotionHostCallbacks
  private readonly driftStats: NpcDriftStats = {
    checks: 0,
    snaps: 0,
    maxErr: 0,
    lastSnap: null,
  }

  constructor(callbacks: NpcMotionHostCallbacks = {}) {
    this.callbacks = callbacks
    this.roomStore = new NpcRoomStore(
      callbacks.isSubTileBlocked,
      callbacks.getCollisionRevision,
      () => this.iterActiveUnitPositions(),
    )
  }

  private *iterActiveUnitPositions(): Iterable<{ readonly x: number; readonly y: number }> {
    for (const u of this.units.values()) {
      if (!u.pDynamicPath) continue
      yield { x: u.subtileX, y: u.subtileY }
      if (u.pDynamicPath.dwPathPoints > 0) {
        yield { x: u.pDynamicPath.tFinalTargetCoord.X, y: u.pDynamicPath.tFinalTargetCoord.Y }
      }
    }
  }

  getSyntheticRoomCount(): number {
    return this.roomStore.size
  }

  findOrCreateRoomAt(x: number, y: number, hintRoom: PathRoom | null = null): PathRoom | null {
    return this.roomStore.findOrCreateRoomAt(x, y, hintRoom)
  }

  setCallbacks(callbacks: NpcMotionHostCallbacks): void {
    this.callbacks = callbacks
    this.roomStore.setCollisionFallback(callbacks.isSubTileBlocked, callbacks.getCollisionRevision)
  }

  getDriftStats(): Readonly<NpcDriftStats> {
    return {
      checks: this.driftStats.checks,
      snaps: this.driftStats.snaps,
      maxErr: this.driftStats.maxErr,
      lastSnap: this.driftStats.lastSnap ? { ...this.driftStats.lastSnap } : null,
    }
  }

  getUnit(unitId: number): NpcMotionUnit | undefined {
    return this.units.get(unitId >>> 0)
  }

  getAllUnits(): IterableIterator<NpcMotionUnit> {
    return this.units.values()
  }

  clear(): void {
    for (const u of this.units.values()) {
      D2Common_10228(u)
      if (u.pDynamicPath) {
        PATH_FreeDynamicPath(u.pDynamicPath)
      }
      u.queue.length = 0
    }
    this.units.clear()
    this.roomStore.clear()
  }

  // -------------------------------------------------------------------------
  // Room Management
  // -------------------------------------------------------------------------

  setExplicitRooms(rooms: readonly PathRoom[]): void {
    this.roomStore.setExplicitRooms(rooms)
    for (const u of this.units.values()) {
      if (u.pDynamicPath) {
        const room = this.roomStore.findOrCreateRoomAt(u.subtileX, u.subtileY, null)
        u.pDynamicPath.pRoom = room
      }
    }
  }

  upsertRoom(room: PathRoom): void {
    this.roomStore.upsertRoom(room)
    for (const u of this.units.values()) {
      if (u.pDynamicPath && !u.pDynamicPath.pRoom) {
        const found = this.roomStore.findOrCreateRoomAt(u.subtileX, u.subtileY, room)
        if (found) u.pDynamicPath.pRoom = found
      }
    }
  }

  removeRoomAt(subX: number, subY: number): void {
    this.roomStore.removeRoomAt(subX, subY)
  }

  refreshSyntheticObstacles(force = true): void {
    this.roomStore.refreshSyntheticObstacles(force)
  }

  // -------------------------------------------------------------------------
  // Unit Lifecycle: 0xAC Assign, 0x0A Remove, 0x15 Reassign
  // -------------------------------------------------------------------------

  /**
   * Create or re-assign a monster unit on `0xAC AssignNPC` (`D2Client.dll` `0x6FB5E420` -> `0x6FB57780` -> `0x6FAFD160`).
   * - Allocates `DynamicPath` with `bSetFlag = 1` (`PATH_UNKNOWN_FLAG_0x00010` = `0x10`, client unit).
   * - Sets initial stats `stat68 = 100`, `stat67 = 75`, `stat69 = 100` (`0x6FAFD1FF..0x6FAFD21E`).
   * - Sets initial direction instantaneously (`#10706` `PATH_SetDirection`, `0x6FAFD59C`).
   * - Runs `#10595` (`UNITS_SetAnimStartFrame`) -> `#10819` (`UNITS_UpdateAnimRateAndVelocity`).
   */
  spawnMonster(params: {
    readonly unitId: number
    readonly classId: number
    readonly x: number
    readonly y: number
    readonly mode: number
    readonly direction?: number | undefined
    readonly lifePct?: number | undefined
    readonly isDead?: boolean | undefined
    readonly isAsync?: boolean | undefined
    readonly stat67?: number | undefined
    readonly stat96?: number | undefined
  }): NpcMotionUnit {
    const id = params.unitId >>> 0
    const existing = this.units.get(id)
    if (existing) {
      D2Common_10228(existing)
      if (existing.pDynamicPath) {
        PATH_FreeDynamicPath(existing.pDynamicPath)
      }
      existing.queue.length = 0
      this.units.delete(id)
    }

    const sx = Math.floor(params.x)
    const sy = Math.floor(params.y)
    const room = this.roomStore.findOrCreateRoomAt(sx, sy, null)
    const unit = new NpcMotionUnit({
      unitId: id,
      classId: params.classId,
      mode: params.mode,
      isDead: params.isDead,
      isAsync: params.isAsync,
    })
    if (params.stat67 !== undefined) unit.stat67 = params.stat67 | 0
    if (params.stat96 !== undefined) unit.stat96 = params.stat96 | 0
    if (params.lifePct !== undefined) unit.lifeByte = params.lifePct | 0
    unit.lastServerX = sx
    unit.lastServerY = sy

    const path = PATH_AllocDynamicPath(room, sx, sy, unit, 1)
    if (params.direction !== undefined) {
      PATH_SetDirection(path, params.direction & 63)
    }

    if (unit.dwAnimMode === MONMODE_DEATH || unit.dwAnimMode === MONMODE_DEAD || (unit.dwFlags & UNITFLAG_ISDEAD) !== 0) {
      unit.dwFlags = u32(unit.dwFlags | UNITFLAG_ISDEAD)
      PATH_SetUnitDeadCollision(unit, 0)
    }

    this.initAnimStartFrame10595(unit)
    this.units.set(id, unit)
    this.callbacks.onUnitUpdated?.(unit, unit.dwAnimMode)
    return unit
  }

  /**
   * Remove a monster on `0x0A RemoveGroundUnit` (`D2Common_10228` + drop queue).
   */
  removeMonster(unitId: number): boolean {
    const id = unitId >>> 0
    const unit = this.units.get(id)
    if (!unit) return false
    D2Common_10228(unit)
    if (unit.pDynamicPath) {
      PATH_FreeDynamicPath(unit.pDynamicPath)
    }
    unit.queue.length = 0
    this.units.delete(id)
    return true
  }

  /**
   * `0x15 Reassign` (`D2Client.dll` `0x6FB5F640` -> `0x6FB57E20(unit, x, y, b0A)`):
   * - Early exit if `ISDEAD` or `mode === DT(0)` or `mode === DD(12)`.
   * - Teleports unconditionally via `#10533` (`D2Common_10229`), falling back to `#10075` (`D2Common_10231`).
   */
  reassignMonster(unitId: number, x: number, y: number): NpcMotionUnit | null {
    const unit = this.units.get(unitId >>> 0)
    if (!unit || !unit.pDynamicPath) return null
    if ((unit.dwFlags & UNITFLAG_ISDEAD) !== 0 || unit.dwAnimMode === MONMODE_DEATH || unit.dwAnimMode === MONMODE_DEAD) {
      return unit
    }
    this.roomStore.refreshSyntheticObstacles()
    const sx = Math.floor(x)
    const sy = Math.floor(y)
    const room = this.roomStore.findOrCreateRoomAt(sx, sy, UNITS_GetRoom(unit))
    if (room) {
      if (!D2Common_10229(unit.pDynamicPath, unit, room, sx, sy)) {
        D2Common_10231(unit.pDynamicPath, unit, room, sx, sy)
      }
    }
    unit.lastServerX = sx
    unit.lastServerY = sy
    this.callbacks.onUnitUpdated?.(unit, unit.dwAnimMode)
    return unit
  }

  // -------------------------------------------------------------------------
  // NPC Interaction Lock (0x6FAB1E40: C2S 0x59 set / C2S 0x30 clear)
  // -------------------------------------------------------------------------

  /**
   * Set or clear `MonsterData+0x28` bit 0 (`0x6FACB0D6` on `C2S 0x59`, `0x6FAF7C1F` on `C2S 0x30`).
   * On start interaction (`locked = true`), also stops the path via `#10159` (`D2Common_10153`).
   */
  setNpcInteractionLock(unitId: number, locked: boolean): void {
    const unit = this.units.get(unitId >>> 0)
    if (!unit) return
    if (locked) {
      if (unit.pDynamicPath) {
        D2Common_10153(unit.pDynamicPath)
      }
      unit.npcInteractFlags |= 1
    } else {
      unit.npcInteractFlags &= ~1
    }
    this.callbacks.onUnitUpdated?.(unit, unit.dwAnimMode)
  }

  // -------------------------------------------------------------------------
  // Per-Unit Packet Queue (0x6FB5C630 / 0x6FB5BC20) & Immediate Application
  // -------------------------------------------------------------------------

  /**
   * Enqueue a packet for a monster (`0x6FB5C630`), dropping packets for unknown units (`0x6FB5CE20`).
   */
  enqueueCommand(unitId: number, npc: NpcCommandPayload113c): boolean {
    const unit = this.units.get(unitId >>> 0)
    if (!unit) return false
    unit.queue.push({ kind: 'command', npc })
    return true
  }

  /**
   * Drain a monster's queued packets in FIFO order (`0x6FB5BC20`).
   */
  drainUnitQueue(unit: NpcMotionUnit): void {
    while (unit.queue.length > 0) {
      const item = unit.queue.shift()!
      if (!this.units.has(unit.dwUnitId)) return
      if (item.kind === 'command') {
        this.applyNpcCommand(unit, item.npc)
      } else {
        this.applyGetHit0x0C(unit, item.mode, item.lifePct, item.hitClass)
      }
    }
  }

  /**
   * Apply a `0x67..0x6D` `NpcCommandPayload113c` immediately to `unitId` (drops if unknown unit per `0x6FB5CE20`).
   * Runs:
   * 1. Drift check `0x6FADA1B0` if `npc.driftCheckAt !== null`.
   * 2. For `0x6D` (`cmd === 7`), increments stat `0x148` (`0x6FB5F313..0x6FB5F320`).
   * 3. Monster command handler `0x6FAFDC70(unit, npc.cmd, npc.s)`.
   */
  applyCommandForUnit(unitId: number, npc: NpcCommandPayload113c): NpcMotionUnit | null {
    const unit = this.units.get(unitId >>> 0)
    if (!unit) return null
    this.applyNpcCommand(unit, npc)
    return unit
  }

  /**
   * Apply `0x0C NPCGetHit` (`0x6FB5F5F0`): NO drift check (`0x6FADA1B0` is NOT called),
   * updates life / hitClass and switches mode (`GH` or `DT`/`DD`).
   */
  applyGetHitForUnit(
    unitId: number,
    mode: number,
    lifePct: number,
    hitClass?: number,
  ): NpcMotionUnit | null {
    const unit = this.units.get(unitId >>> 0)
    if (!unit) return null
    this.applyGetHit0x0C(unit, mode, lifePct, hitClass)
    return unit
  }

  private applyGetHit0x0C(
    unit: NpcMotionUnit,
    mode: number,
    lifePct: number,
    hitClass?: number,
  ): void {
    const prevMode = unit.dwAnimMode
    unit.lastAnimRestarted = false
    unit.lifeByte = lifePct & 0x7f
    unit.hitClass = hitClass !== undefined ? hitClass & 0xff : 0
    if (mode === MONMODE_DEATH || mode === MONMODE_DEAD) {
      unit.dwFlags = u32(unit.dwFlags | UNITFLAG_ISDEAD)
      if (unit.pDynamicPath) {
        D2Common_10153(unit.pDynamicPath)
      }
      PATH_SetUnitDeadCollision(unit, 0)
      this.changeAnimMode0x6FADA6C0(unit, mode)
    } else {
      D2COMMON_10212_PATH_SetMoveFlags(unit, 0)
      if (unit.pDynamicPath) {
        PATH_RecacheRoomIfNeeded(unit.pDynamicPath)
      }
      this.changeAnimMode0x6FADA6C0(unit, mode, true)
    }
    const restarted = unit.lastAnimRestarted
    unit.lastAnimRestarted = false
    this.callbacks.onUnitUpdated?.(unit, prevMode, restarted)
  }

  // -------------------------------------------------------------------------
  // §3. Drift Check 0x6FADA1B0(unit, x, y, 0, 0, 0)
  // -------------------------------------------------------------------------

  /**
   * `0x6FADA1B0(unit, x, y, 0, 0, 0)`:
   * - Early exit if `x === 0 || y === 0`, `UNITFLAG_ISDEAD`, or `dwAnimMode` is `DT(0)` / `DD(12)`.
   * - Stores `(x, y)` to `lastServerX / lastServerY` (`unit+0x8C/+0x8E`).
   * - Computes `T` from the monster's current mode BEFORE the command:
   *   `3..5 -> 5`, `6..11 -> 7`, else `15`.
   * - Per-axis Chebyshev check against integer sub-tiles `PATH_GetXPosition` / `PATH_GetYPosition`:
   *   if `|X - x| > T || |Y - y| > T`, snaps via `#10906` (`D2Common_10230`).
   */
  runDriftCheck0x6FADA1B0(unit: NpcMotionUnit, x: number, y: number): boolean {
    const sx = x | 0
    const sy = y | 0
    if (sx === 0 || sy === 0) return false
    if ((unit.dwFlags & UNITFLAG_ISDEAD) !== 0) return false
    if (unit.dwAnimMode === MONMODE_DEATH || unit.dwAnimMode === MONMODE_DEAD) return false
    const path = unit.pDynamicPath
    if (!path) return false

    unit.lastServerX = sx
    unit.lastServerY = sy

    const curX = PATH_GetXPosition(path)
    const curY = PATH_GetYPosition(path)
    const errX = Math.abs(sx - curX)
    const errY = Math.abs(sy - curY)
    const maxAxisErr = Math.max(errX, errY)
    const threshold = getMonsterDriftThreshold113c(unit.dwAnimMode)

    this.driftStats.checks += 1
    if (maxAxisErr > this.driftStats.maxErr) {
      this.driftStats.maxErr = maxAxisErr
    }

    if (errX <= threshold && errY <= threshold) {
      return false
    }

    this.roomStore.refreshSyntheticObstacles()
    const destRoom = this.roomStore.findOrCreateRoomAt(sx, sy, UNITS_GetRoom(unit))
    if (!destRoom) {
      return false
    }

    D2Common_10230(path, unit, destRoom, sx, sy)
    this.driftStats.snaps += 1
    this.driftStats.lastSnap = {
      unitId: unit.dwUnitId,
      classId: unit.dwClassId,
      modeBefore: unit.dwAnimMode,
      threshold,
      fromX: curX,
      fromY: curY,
      toX: sx,
      toY: sy,
      errX,
      errY,
    }
    return true
  }

  // -------------------------------------------------------------------------
  // §4. Monster Command Handler 0x6FAFDC70(unit, cmd, s[7])
  // -------------------------------------------------------------------------

  private applyNpcCommand(unit: NpcMotionUnit, npc: NpcCommandPayload113c): void {
    const prevMode = unit.dwAnimMode
    unit.lastAnimRestarted = false
    this.roomStore.refreshSyntheticObstacles()

    if (npc.driftCheckAt !== null && npc.driftCheckAt !== undefined) {
      this.runDriftCheck0x6FADA1B0(unit, npc.driftCheckAt.x, npc.driftCheckAt.y)
    }

    this.executeCmd0x6FAFDC70(unit, npc.cmd, npc.s)
    const restarted = unit.lastAnimRestarted
    unit.lastAnimRestarted = false
    this.callbacks.onUnitUpdated?.(unit, prevMode, restarted)
  }

  /**
   * `0x6FAFDC70(unit, cmd, s)`:
   * Dispatches `cmd` (`0x00..0x1D`) using the 7-dword parameter block `s = [s0, s1, s2, s3, s4, s5, s6]`.
   */
  executeCmd0x6FAFDC70(
    unit: NpcMotionUnit,
    cmd: number,
    s: readonly [number, number, number, number, number, number, number | null] | null,
  ): void {
    if (cmd < 0 || cmd > 0x1d) return
    const path = unit.pDynamicPath
    if (!path) return

    const s0 = s ? s[0] | 0 : 0
    const s1 = s ? s[1] | 0 : 0
    const s2 = s ? s[2] | 0 : 0
    const s3 = s ? s[3] | 0 : 0
    const s4 = s ? s[4] | 0 : 0
    const s5 = s ? s[5] | 0 : 0
    const s6 = s && s[6] !== null ? s[6] | 0 : 0

    // Prologue (0x6FAFDD0E..0x6FAFDD55): runs when s != null and cmd not in {0x13, 0x15, 0x16}.
    let applyVel = false
    if (s !== null && cmd !== 0x13 && cmd !== 0x15 && cmd !== 0x16) {
      applyVel = true
      if (s3 > 0) {
        PATH_SetType(path, s3)
      }
      if (cmd === 0x14) {
        PATH_SetNewDistance(path, s5)
        PATH_SetStepNum(path, s2)
      }
    }

    // Living footprint refresh (#11011 = D2Common_10214) & corpse-to-alive restore (#10938)
    const isDeadOrDying =
      (unit.dwFlags & UNITFLAG_ISDEAD) !== 0 ||
      unit.dwAnimMode === MONMODE_DEATH ||
      unit.dwAnimMode === MONMODE_DEAD
    if (!isDeadOrDying) {
      D2Common_10214(unit)
    }
    if (cmd !== 0x08 && cmd !== 0x09) {
      unit.dwFlags = u32(unit.dwFlags & ~UNITFLAG_ISDEAD)
      PATH_SetUnitAliveCollision(unit, 0)
    }

    // Town NPC fixed-direction overrides in KB/RN (0x6FAFDF43..0x6FAFDFC6)
    const mappedMode = NPC_CMD_TO_MODE_113C[cmd]!
    if (mappedMode === MONMODE_KNOCKBACK || mappedMode === MONMODE_RUN) {
      if (unit.dwClassId === 154) D2COMMON_10160_PathUpdateDirection(path, 0x38)
      else if (unit.dwClassId === 155) D2COMMON_10160_PathUpdateDirection(path, 0x34)
      else if (unit.dwClassId === 178) D2COMMON_10160_PathUpdateDirection(path, 0x30)
      else if (unit.dwClassId === 405) D2COMMON_10160_PathUpdateDirection(path, 0x04)
    }

    switch (cmd) {
      // cmd 1 (WL to x,y) / cmd 0x17 (RN to x,y) — 0x6FAFDDF2
      case 0x01:
      case 0x17: {
        D2COMMON_10212_PATH_SetMoveFlags(unit, 1)
        if ((unit.npcInteractFlags & 1) !== 0) {
          this.goNeutralAndStop0x6FAFEB6C(unit)
          break
        }
        if (!this.pathToCoords0x6FADA040(unit, s0, s1)) {
          const currX = PATH_GetXPosition(path)
          const currY = PATH_GetYPosition(path)
          if (
            (s0 !== 0 || s1 !== 0) &&
            ((currX === 0 && currY === 0) ||
              Math.abs(currX - s0) > 25 ||
              Math.abs(currY - s1) > 25)
          ) {
            this.runDriftCheck0x6FADA1B0(unit, s0, s1)
          }
          this.goNeutral0x6FAFDC30(unit)
          break
        }
        this.changeAnimMode0x6FADA6C0(unit, cmd === 0x01 ? MONMODE_WALK : MONMODE_RUN)
        break
      }

      // cmd 0 (WL to target unit) / cmd 0x18 (RN to target unit) — 0x6FAFDE52
      case 0x00:
      case 0x18: {
        D2COMMON_10212_PATH_SetMoveFlags(unit, 1)
        unit.targetUnitType = s0
        unit.targetUnitId = s1 >>> 0
        if ((unit.npcInteractFlags & 1) !== 0) {
          this.goNeutralAndStop0x6FAFEB6C(unit)
          break
        }
        if (!this.pathToTargetUnit0x6FADA070(unit, s0, s1 >>> 0)) {
          this.goNeutral0x6FAFDC30(unit)
          break
        }
        this.changeAnimMode0x6FADA6C0(unit, cmd === 0x00 ? MONMODE_WALK : MONMODE_RUN)
        break
      }

      // cmd 7 (NU / NPCStop) — 0x6FAFE8E6
      case 0x07: {
        D2COMMON_10212_PATH_SetMoveFlags(unit, 0)
        if (s2 !== 0) {
          unit.lifeByte = s2 & 0x7f
        }
        this.runDriftCheck0x6FADA1B0(unit, s0, s1)
        const dx = Math.abs(PATH_GetXPosition(path) - s0)
        const dy = Math.abs(PATH_GetYPosition(path) - s1)
        if (dx <= 1 && dy <= 1) {
          this.goNeutralAndStop0x6FAFEB6C(unit)
          break
        }
        if ((unit.npcInteractFlags & 1) !== 0) {
          this.goNeutralAndStop0x6FAFEB6C(unit)
          break
        }
        if (
          !this.pathToCoords0x6FADA040(unit, s0, s1) ||
          unit.states.has(0x8f) ||
          !monsterClassHasMode113c(unit.dwClassId, MONMODE_WALK)
        ) {
          this.goNeutralAndStop0x6FAFEB6C(unit)
          break
        }
        this.changeAnimMode0x6FADA6C0(unit, MONMODE_WALK)
        break
      }

      // cmd 8 (DT / death) — 0x6FAFE298: ignores s0/s1 completely; dies in place!
      case 0x08: {
        unit.hitClass = s6 & 0xff
        unit.lifeByte = 0
        unit.dwFlags = u32(unit.dwFlags | UNITFLAG_ISDEAD)
        D2Common_10153(path)
        PATH_SetUnitDeadCollision(unit, 0)
        this.changeAnimMode0x6FADA6C0(unit, MONMODE_DEATH)
        break
      }

      // cmd 9 (DD / corpse) — 0x6FAFE79C: ignores s0/s1 completely; corpse in place!
      case 0x09: {
        unit.lifeByte = 0
        unit.dwFlags = u32(unit.dwFlags | UNITFLAG_ISDEAD)
        D2Common_10153(path)
        PATH_SetUnitDeadCollision(unit, 0)
        this.changeAnimMode0x6FADA6C0(unit, MONMODE_DEAD)
        break
      }

      // cmd 6 (GH / get-hit) — 0x6FAFE095: ignores s0/s1; reads s2 (life) and s6 (hitClass)
      case 0x06: {
        let life = s2 & 0x7f
        if (life > 1) life = (life + 1) | 0
        unit.lifeByte = life
        unit.hitClass = s6 & 0xff
        D2COMMON_10212_PATH_SetMoveFlags(unit, 0)
        PATH_RecacheRoomIfNeeded(path)
        this.changeAnimMode0x6FADA6C0(unit, MONMODE_GETHIT, true)
        break
      }

      // Target-unit attack/skill group: 5 (SC), 0xA (A1), 0xD (S1), 0xF (S2), 0x10 (A2), 0x1B (S3), 0x1D (S4) — 0x6FAFDED6
      case 0x05:
      case 0x0a:
      case 0x0d:
      case 0x0f:
      case 0x10:
      case 0x1b:
      case 0x1d: {
        D2COMMON_10212_PATH_SetMoveFlags(unit, 0)
        unit.targetUnitType = s0
        unit.targetUnitId = s1 >>> 0
        const target = this.callbacks.resolveTargetUnit?.(s0, s1 >>> 0) ?? null
        if (target) {
          const tx = target.pDynamicPath
            ? PATH_GetXPosition(target.pDynamicPath)
            : target.pStaticPath
              ? target.pStaticPath.x
              : 0
          const ty = target.pDynamicPath
            ? PATH_GetYPosition(target.pDynamicPath)
            : target.pStaticPath
              ? target.pStaticPath.y
              : 0
          if ((tx !== 0 || ty !== 0) && (tx !== PATH_GetXPosition(path) || ty !== PATH_GetYPosition(path))) {
            D2Common_10434_FaceSubtile(unit, tx, ty)
          }
        }
        this.changeAnimMode0x6FADA6C0(unit, mappedMode, true)
        if (doesNpcModeMove113c(unit.dwClassId, unit.dwAnimMode)) {
          this.pathToTargetUnit0x6FADA070(unit, s0, s1 >>> 0)
        } else {
          D2Common_10153(path)
        }
        break
      }

      // XY attack/skill group: 4 (SC), 0xB (A1), 0xC (S1), 0xE (S2), 0x11 (A2), 0x19 (S1), 0x1A (S3), 0x1C (S4) — 0x6FAFE006
      case 0x04:
      case 0x0b:
      case 0x0c:
      case 0x0e:
      case 0x11:
      case 0x19:
      case 0x1a:
      case 0x1c: {
        D2COMMON_10212_PATH_SetMoveFlags(unit, 0)
        if (
          (s0 !== 0 || s1 !== 0) &&
          (s0 !== PATH_GetXPosition(path) || s1 !== PATH_GetYPosition(path))
        ) {
          D2Common_10434_FaceSubtile(unit, s0, s1)
        }
        this.changeAnimMode0x6FADA6C0(unit, mappedMode, true)
        if (doesNpcModeMove113c(unit.dwClassId, unit.dwAnimMode)) {
          this.pathToCoords0x6FADA040(unit, s0, s1)
        } else {
          D2Common_10153(path)
        }
        break
      }

      // cmd 0x12 (BL / block) — 0x6FAFE253
      case 0x12: {
        D2COMMON_10212_PATH_SetMoveFlags(unit, 0)
        unit.targetUnitType = s0
        unit.targetUnitId = s1 >>> 0
        D2Common_10153(path)
        this.changeAnimMode0x6FADA6C0(unit, MONMODE_BLOCK, true)
        break
      }

      // cmd 0x13 (KB overlay without path) — 0x6FAFE14D
      case 0x13: {
        let life = s2 & 0x7f
        if (life > 1) life = (life + 1) | 0
        unit.lifeByte = life
        unit.hitClass = s6 & 0xff
        break
      }

      // cmd 0x14 (KB / knockback path) — 0x6FAFE1D8
      case 0x14: {
        let life = s5 & 0x7f
        if (life > 1) life = (life + 1) | 0
        unit.lifeByte = life
        unit.hitClass = s6 & 0xff
        D2COMMON_10212_PATH_SetMoveFlags(unit, 0)
        PATH_RecacheRoomIfNeeded(path)
        PATH_SetType(path, PATHTYPE_KNOCKBACK_CLIENT)
        D2COMMON_10190_PATH_SetDistance(path, s2)
        D2COMMON_10170_PathSetTargetPos(path, s0, s1)
        D2Common_10142(path, unit, 0)
        this.changeAnimMode0x6FADA6C0(unit, MONMODE_KNOCKBACK, true)
        break
      }

      // cmd 0x15 / 0x16 (SQ / sequence) — 0x6FAFEA16 / 0x6FAFEA9F
      case 0x15:
      case 0x16: {
        D2COMMON_10212_PATH_SetMoveFlags(unit, 0)
        if (!doesNpcModeMove113c(unit.dwClassId, MONMODE_SEQUENCE)) {
          D2Common_10153(path)
        }
        this.changeAnimMode0x6FADA6C0(unit, MONMODE_SEQUENCE, true)
        break
      }

      default:
        break
    }

    // Velocity tail (0x6FAFEB18): when applyVel && s4 != 0, update stat67 and call #10819
    if (applyVel && s4 !== 0) {
      if (unit.stat67 !== s4) {
        unit.stat67 = s4 | 0
      }
      this.updateAnimRateAndVelocity10819(unit)
    }
  }

  /**
   * `0x6FADA040`: `PATH_SetTargetPos(pPath, x, y)` + `#10334` (`D2Common_10142(pPath, unit, isAsync)`).
   */
  private pathToCoords0x6FADA040(unit: NpcMotionUnit, targetX: number, targetY: number): boolean {
    const path = unit.pDynamicPath
    if (!path) return false
    const currRoom = this.roomStore.findOrCreateRoomAt(
      PATH_GetXPosition(path),
      PATH_GetYPosition(path),
      path.pRoom,
    )
    if (!path.pRoom) {
      path.pRoom = currRoom
    }
    this.roomStore.findOrCreateRoomAt(targetX, targetY, path.pRoom)
    D2COMMON_10170_PathSetTargetPos(path, targetX, targetY)
    const isAsync = (unit.dwFlags & UNITFLAG_ISASYNC) !== 0 ? 1 : 0
    return D2Common_10142(path, unit, isAsync) !== 0
  }

  /**
   * `0x6FADA070`: resolve `(targetType, targetId)` in client unit table, `PATH_SetTargetUnit(pPath, target)`,
   * and if found run `D2Common_10142(pPath, unit, 0)`.
   */
  private pathToTargetUnit0x6FADA070(unit: NpcMotionUnit, targetType: number, targetId: number): boolean {
    const path = unit.pDynamicPath
    if (!path) return false
    const currRoom = this.roomStore.findOrCreateRoomAt(
      PATH_GetXPosition(path),
      PATH_GetYPosition(path),
      path.pRoom,
    )
    if (!path.pRoom) {
      path.pRoom = currRoom
    }
    const target = this.callbacks.resolveTargetUnit?.(targetType, targetId) ?? null
    PATH_SetTargetUnit(path, target)
    if (!target) return false
    const tx = target.pDynamicPath
      ? PATH_GetXPosition(target.pDynamicPath)
      : target.pStaticPath
        ? target.pStaticPath.x
        : 0
    const ty = target.pDynamicPath
      ? PATH_GetYPosition(target.pDynamicPath)
      : target.pStaticPath
        ? target.pStaticPath.y
        : 0
    this.roomStore.findOrCreateRoomAt(tx, ty, path.pRoom)
    return D2Common_10142(path, unit, 0) !== 0
  }

  private goNeutral0x6FAFDC30(unit: NpcMotionUnit): void {
    D2COMMON_10212_PATH_SetMoveFlags(unit, 0)
    if (unit.pDynamicPath) {
      D2Common_10153(unit.pDynamicPath)
    }
    this.changeAnimMode0x6FADA6C0(unit, MONMODE_NEUTRAL)
  }

  private goNeutralAndStop0x6FAFEB6C(unit: NpcMotionUnit): void {
    if (unit.pDynamicPath) {
      D2Common_10153(unit.pDynamicPath)
    }
    this.changeAnimMode0x6FADA6C0(unit, MONMODE_NEUTRAL)
  }

  // -------------------------------------------------------------------------
  // §14 D/E. Mode Change (0x6FADA6C0 -> #11090 -> #10595 -> #10819)
  // -------------------------------------------------------------------------

  /**
   * `0x6FADA6C0` -> `#11090` (`UNITS_ChangeAnimMode`, `0x6FD83920`):
   * - If `unit.dwAnimMode === newMode`, returns `false` without resetting the animation frame!
   * - Otherwise sets `dwAnimMode = newMode`, sets `UNITFLAG_DOUPDATE`, and calls `#10595` (`initAnimStartFrame10595`).
   */
  changeAnimMode0x6FADA6C0(unit: NpcMotionUnit, newMode: number, forceRestart = false): boolean {
    if (newMode < 0 || newMode >= 16) return false
    let resolvedMode = newMode
    if (
      (resolvedMode === MONMODE_ATTACK2 || resolvedMode === MONMODE_CAST) &&
      !monsterClassHasMode113c(unit.dwClassId, resolvedMode) &&
      monsterClassHasMode113c(unit.dwClassId, MONMODE_ATTACK1)
    ) {
      resolvedMode = MONMODE_ATTACK1
    }
    unit.dwFlags = u32(unit.dwFlags & ~0x40)
    if (unit.dwAnimMode === resolvedMode) {
      if (forceRestart) {
        unit.dwFlags = u32(unit.dwFlags | UNITFLAG_DOUPDATE)
        this.initAnimStartFrame10595(unit)
        return true
      }
      if (resolvedMode !== MONMODE_NEUTRAL) {
        unit.dwFlags = u32(unit.dwFlags | UNITFLAG_DOUPDATE)
      }
      return false
    }
    unit.dwFlags = u32(unit.dwFlags | UNITFLAG_DOUPDATE)
    unit.dwAnimMode = resolvedMode
    this.initAnimStartFrame10595(unit)
    return true
  }

  /**
   * `#10595` (`UNITS_SetAnimStartFrame`, `0x6FD835F0`):
   * Resets `wActionFrame = 0`, `wFrame = 0`, queries `frameCount` for `(dwClassId, dwAnimMode)`,
   * and runs `#10819` (`updateAnimRateAndVelocity10819`).
   */
  initAnimStartFrame10595(unit: NpcMotionUnit): void {
    unit.lastAnimRestarted = true
    unit.wActionFrame = 0
    unit.wFrame = 0
    const metrics = this.callbacks.getAnimMetrics?.(unit.dwClassId, unit.dwAnimMode, unit.dwUnitId)
    const frames = metrics && metrics.frameCount > 0 ? metrics.frameCount : 8
    unit.wFrameCount = frames << 8
    this.updateAnimRateAndVelocity10819(unit, metrics)
  }

  /**
   * `#10819` (`UNITS_UpdateAnimRateAndVelocity`, `D2Common.dll` `0x6FD83110`):
   * Computes `wAnimSpeed` (`unit+0x4C`) and (for `KB`, `WL`, `RN` only) updates `DynamicPath` velocity:
   * 1. `SC(7)`: `animSpeed = idiv(baseSpeed * min(175, 100 + FCR'), 100)`; path velocity unchanged.
   * 2. `BL(6)`: `animSpeed = max(1, idiv(baseSpeed * (50 + FBR'), 100))`; path velocity unchanged.
   * 3. `GH(3)`: `animSpeed = max(0, idiv(baseSpeed * (50 + FHR'), 100))`; path velocity unchanged.
   * 4. `KB(13)`: `animSpeed = clamp(MonStats.WalkAnimSpeed, 0, 0x7FFF)`; `PATH_SetVelocity(pPath, 0x1000)` (`4096`).
   * 5. `WL(2)` / `RN(15)`:
   *    - `FRW' = computeAnimStatBonus113c(150, unit.stat96)`
   *    - `pct = max(25, unit.stat67 + FRW')`
   *    - `baseVel = MonStats.Velocity << 8` (WALK velocity for every mode per `0x6FD80D50`!)
   *    - `pathVel = idiv(pct * baseVel, 100)` -> `PATH_SetVelocity(pPath, pathVel)`
   *    - `baseAnim = (mode === RN ? MonStats.RunAnimSpeed : MonStats.WalkAnimSpeed)`
   *    - `animSpeed = clamp(idiv(pct * baseAnim, 100), 0, 0x7FFF)`
   * 6. `A1(4)` / `A2(5)`: `animSpeed = idiv(baseSpeed * clamp(stat68 + FAR', 15, 175), 100)`; path velocity unchanged.
   * 7. `DT(0)` / `DD(12)`: `animSpeed = baseSpeed`; path velocity unchanged.
   * 8. Default (`NU`, `S1..S4`, `SQ`): `animSpeed = idiv(baseSpeed * clamp(stat69, 15, 175), 100)`; path velocity unchanged.
   */
  updateAnimRateAndVelocity10819(
    unit: NpcMotionUnit,
    precomputedMetrics?: { readonly frameCount: number; readonly animSpeed: number } | undefined,
  ): void {
    const mode = unit.dwAnimMode
    const rec =
      unit.dwClassId >= 0 && unit.dwClassId < MONSTATS_TXT_RECORD_COUNT
        ? getMonsterPathRecord(unit.dwClassId)
        : null
    const metrics =
      precomputedMetrics !== undefined
        ? precomputedMetrics
        : this.callbacks.getAnimMetrics?.(unit.dwClassId, mode, unit.dwUnitId)
    const defaultBaseSpeed = metrics && metrics.animSpeed > 0 ? metrics.animSpeed : 256

    if (mode === MONMODE_CAST) {
      const fcr = computeAnimStatBonus113c(120, unit.stat105)
      const pct = Math.min(175, 100 + fcr)
      unit.wAnimSpeed = clampAnimSpeed(Math.trunc((defaultBaseSpeed * pct) / 100))
      return
    }
    if (mode === MONMODE_BLOCK) {
      const fbr = computeAnimStatBonus113c(120, unit.stat102)
      const speed = Math.trunc((defaultBaseSpeed * (50 + fbr)) / 100)
      unit.wAnimSpeed = clampAnimSpeed(Math.max(1, speed))
      return
    }
    if (mode === MONMODE_GETHIT) {
      const fhr = computeAnimStatBonus113c(120, unit.stat99)
      const speed = Math.trunc((defaultBaseSpeed * (50 + fhr)) / 100)
      unit.wAnimSpeed = speed <= 0 ? 0 : clampAnimSpeed(speed)
      return
    }
    if (mode === MONMODE_KNOCKBACK) {
      const walkAnim = rec ? rec.walkAnimSpeed : defaultBaseSpeed
      unit.wAnimSpeed = clampAnimSpeed(walkAnim)
      PATH_SetVelocity(unit.pDynamicPath, 0x1000, 'npc-motion.ts', 0x6fd8330c)
      return
    }
    if (mode === MONMODE_WALK || mode === MONMODE_RUN) {
      const frw = computeAnimStatBonus113c(150, unit.stat96)
      const pct = Math.max(25, (unit.stat67 | 0) + frw)
      const walkVel = rec ? rec.velocity : 6
      const baseVel = walkVel << 8
      const pathVel = Math.trunc(Math.imul(pct, baseVel) / 100) | 0
      PATH_SetVelocity(unit.pDynamicPath, pathVel, 'npc-motion.ts', 0x6fd833cf)
      const baseAnim = rec
        ? mode === MONMODE_RUN
          ? rec.runAnimSpeed
          : rec.walkAnimSpeed
        : defaultBaseSpeed
      unit.wAnimSpeed = clampAnimSpeed(Math.trunc(Math.imul(pct, baseAnim) / 100))
      return
    }
    if (mode === MONMODE_ATTACK1 || mode === MONMODE_ATTACK2) {
      const far = computeAnimStatBonus113c(120, unit.stat93)
      const pct = Math.max(15, Math.min(175, (unit.stat68 | 0) + far))
      unit.wAnimSpeed = clampAnimSpeed(Math.trunc((defaultBaseSpeed * pct) / 100))
      return
    }
    if (mode === MONMODE_DEATH || mode === MONMODE_DEAD) {
      unit.wAnimSpeed = clampAnimSpeed(defaultBaseSpeed)
      return
    }
    const pct = Math.max(15, Math.min(175, unit.stat69 | 0))
    unit.wAnimSpeed = clampAnimSpeed(Math.trunc((defaultBaseSpeed * pct) / 100))
  }

  // -------------------------------------------------------------------------
  // §2 & §14. Per-Tick Step (0x6FB58110 -> 0x6FADB1E0 -> 0x6FAFF4A0 + 0x6FB5BC20)
  // -------------------------------------------------------------------------

  /**
   * Advance all monster units by one 40 ms game tick (`0x6FB58110` -> `0x6FADB1E0`):
   * For each monster:
   * 1. Run `stepMonster0x6FAFF4A0(unit)`.
   * 2. Drain `unit.queue` in FIFO order (`0x6FB5BC20`).
   */
  tick(): void {
    this.roomStore.refreshSyntheticObstacles()
    const snapshot = [...this.units.values()]
    for (const unit of snapshot) {
      if (!this.units.has(unit.dwUnitId)) continue
      this.stepMonster0x6FAFF4A0(unit)
      if (this.units.has(unit.dwUnitId) && unit.queue.length > 0) {
        this.drainUnitQueue(unit)
      }
    }
  }

  /**
   * `0x6FAFF4A0(unit)`: advances one monster by one 40 ms tick.
   */
  stepMonster0x6FAFF4A0(unit: NpcMotionUnit): void {
    const prevMode = unit.dwAnimMode
    unit.lastAnimRestarted = false
    if (unit.dwAnimMode < 0 || unit.dwAnimMode >= 16) return
    if (unit.states.has(1)) return // STATE_FREEZE (1) skips step (0x6FAFF4B8)

    const entry = selectNpcModeStepEntry113c(unit.dwClassId, unit.dwAnimMode)
    if (!entry) return

    // Move switch (0x6FAFF540):
    // - move == 1: 0x6FADA700(unit) -> 0x6FADA0B0 (validate target unit) -> #10342 D2Common_10226(unit, 0)
    // - move == 2: special callback -> pathDone = false
    // - move == 0: in NU(1), when NPC interaction lock bit 0 is clear, run #10340 D2Common_10213(unit)
    let pathContinued = false
    let pathDone = false
    if (entry.move === 1) {
      pathContinued = this.stepPath0x6FADA700(unit)
      pathDone = !pathContinued
    } else if (entry.move === 0) {
      if (unit.dwAnimMode === MONMODE_NEUTRAL && (unit.npcInteractFlags & 1) === 0) {
        if (unit.pDynamicPath) {
          const currRoom = this.roomStore.findOrCreateRoomAt(
            PATH_GetXPosition(unit.pDynamicPath),
            PATH_GetYPosition(unit.pDynamicPath),
            unit.pDynamicPath.pRoom,
          )
          if (!unit.pDynamicPath.pRoom) {
            unit.pDynamicPath.pRoom = currRoom
          }
        }
        this.recheckTargetUnit0x6FADA0B0(unit)
        if (D2Common_10213(unit)) {
          this.changeAnimMode0x6FADA6C0(unit, MONMODE_WALK)
        }
      }
    }

    // Anim advance (0x6FAFEE40)
    const animDone = this.advanceAnim0x6FAFEE40(unit, entry, pathContinued)

    // Facing turn step (#10603 = D2COMMON_10193_PATH_AdjustDirection, 0x6FD84D70)
    if (unit.pDynamicPath) {
      D2COMMON_10193_PATH_AdjustDirection(unit.pDynamicPath)
    }

    // Mode-end check (0x6FAFF6E4 -> 0x6FAFDA60)
    let done = false
    if (entry.end === 1) {
      done = pathDone
    } else if (entry.end === 2 || entry.end === 3) {
      done = animDone
    } else if (entry.end === 4) {
      done = pathDone && this.isAnimAtEnd10426(unit)
    }

    if (done) {
      this.handleModeEnd0x6FAFDA60(unit)
    }

    const restarted = unit.lastAnimRestarted
    unit.lastAnimRestarted = false
    this.callbacks.onUnitUpdated?.(unit, prevMode, restarted)
  }

  /**
   * `0x6FADA0B0(unit)`: if `pDynamicPath->pTargetUnit` is set, verifies that `(TargetType, dwTargetId)`
   * still resolves to the same unit in the client unit table; if not, calls `PATH_SetTargetUnit(pPath, null)`.
   */
  private recheckTargetUnit0x6FADA0B0(unit: NpcMotionUnit): void {
    const path = unit.pDynamicPath
    if (!path) return
    const currentTarget = PATH_GetTargetUnit(path)
    if (!currentTarget) return
    const { nTargetType, nTargetGUID } = PATH_GetTargetTypeAndGUID(path)
    const resolved = this.callbacks.resolveTargetUnit?.(nTargetType, nTargetGUID) ?? null
    if (resolved !== currentTarget) {
      PATH_SetTargetUnit(path, null)
    } else if (resolved) {
      const tx = resolved.pDynamicPath
        ? PATH_GetXPosition(resolved.pDynamicPath)
        : resolved.pStaticPath
          ? resolved.pStaticPath.x
          : 0
      const ty = resolved.pDynamicPath
        ? PATH_GetYPosition(resolved.pDynamicPath)
        : resolved.pStaticPath
          ? resolved.pStaticPath.y
          : 0
      if (tx > 0 || ty > 0) {
        this.roomStore.findOrCreateRoomAt(tx, ty, path.pRoom)
      }
    }
  }

  /**
   * `0x6FADA700(unit)`: runs `0x6FADA0B0(unit)` then `#10342` (`D2Common_10226(unit, 0)`).
   * Returns `true` when the path continued (`res !== 0`), `false` when the path finished (`res === 0`).
   */
  private stepPath0x6FADA700(unit: NpcMotionUnit): boolean {
    if (unit.pDynamicPath) {
      const currRoom = this.roomStore.findOrCreateRoomAt(
        PATH_GetXPosition(unit.pDynamicPath),
        PATH_GetYPosition(unit.pDynamicPath),
        unit.pDynamicPath.pRoom,
      )
      if (!unit.pDynamicPath.pRoom) {
        unit.pDynamicPath.pRoom = currRoom
      }
    }
    this.recheckTargetUnit0x6FADA0B0(unit)
    return D2Common_10226(unit, 0) !== 0
  }

  /**
   * `#10426` (`0x6FD7EF30`): returns true when `wFrame + wAnimSpeed >= wFrameCount` (or `wFrameCount <= 0`).
   */
  private isAnimAtEnd10426(unit: NpcMotionUnit): boolean {
    if (unit.wFrameCount <= 0) return true
    return unit.wFrame + unit.wAnimSpeed >= unit.wFrameCount
  }

  /**
   * `0x6FAFEE40(unit, entry)`: advances the monster's animation frame according to `entry.anim`:
   * - Pre-step: if `MonStats.nSplEndDeath === 1` (`fetishshaman1..8`) and `mode === DT(0)` and `#10426`,
   *   forces `cmd 9` (`DD`) via `0x6FAFDC70`.
   * - `anim === 0`: loops via `#10853` (`wFrame = (wFrame + wAnimSpeed) % wFrameCount`); returns `false`.
   * - `anim === 1`: advances once; when `#10426` is reached, returns `true` (`animDone`).
   * - `anim === 2`: advances until `wFrame >= wFrameCount`, then clamps to `wFrameCount - 256` and
   *   sets `wAnimSpeed = 0`; **always returns `false`** (so `KB(13)` never auto-ends on the client!).
   * - `anim === 3`: sets `wFrame = 256`, `wAnimSpeed = 0`; returns `false`.
   */
  private advanceAnim0x6FAFEE40(
    unit: NpcMotionUnit,
    entry: NpcModeStepEntry,
    pathContinued: boolean,
  ): boolean {
    if (
      unit.dwAnimMode === MONMODE_DEATH &&
      unit.dwClassId >= 0 &&
      unit.dwClassId < MONSTATS_TXT_RECORD_COUNT &&
      getMonsterPathRecord(unit.dwClassId).splEndDeath === 1 &&
      this.isAnimAtEnd10426(unit)
    ) {
      this.executeCmd0x6FAFDC70(unit, 0x09, null)
    }

    switch (entry.anim) {
      case 0: {
        unit.wActionFrame = 0
        if (unit.wFrameCount > 0) {
          unit.wFrame += unit.wAnimSpeed
          let wrapped = false
          while (unit.wFrame >= unit.wFrameCount) {
            unit.wFrame -= unit.wFrameCount
            wrapped = true
          }
          if (
            wrapped &&
            (unit.dwAnimMode === MONMODE_NEUTRAL ||
              (pathContinued && (unit.dwAnimMode === MONMODE_WALK || unit.dwAnimMode === MONMODE_RUN)))
          ) {
            unit.dwFlags = u32(unit.dwFlags | UNITFLAG_DOUPDATE)
          }
        }
        return false
      }
      case 1: {
        if (this.isAnimAtEnd10426(unit)) {
          return true
        }
        unit.wActionFrame = 0
        unit.wFrame += unit.wAnimSpeed
        return this.isAnimAtEnd10426(unit)
      }
      case 2: {
        if (!this.isAnimAtEnd10426(unit)) {
          unit.wActionFrame = 0
          unit.wFrame += unit.wAnimSpeed
        } else {
          unit.wFrame = Math.max(0, unit.wFrameCount - 0x100)
          unit.wAnimSpeed = 0
        }
        return false
      }
      case 3: {
        unit.wFrame = 0x100
        unit.wAnimSpeed = 0
        return false
      }
    }
  }

  /**
   * `0x6FAFDA60(unit)`: mode-end handler called when `done` is true in `0x6FAFF4A0`.
   * - Checks `MonStats.nSplClientEnd` (`+0x1A7`) jump table `0x6FAFDBF4[mode - 2]` (using `MonStats.nBaseId`).
   * - Default (`0x6FAFDBBA`):
   *   - If `(unit.dwFlags & UNITFLAG_ISASYNC) === 0 && (unit.dwFlagEx & UNITFLAGEX_UNK_PATH_RELATED) !== 0`:
   *     **keeps current mode (`WL` / `RN`) motionless at path end** waiting for the server's next packet!
   *   - Otherwise switches to `MONMODE_NEUTRAL (1)` and calls `#10595`.
   */
  private handleModeEnd0x6FAFDA60(unit: NpcMotionUnit): void {
    const mode = unit.dwAnimMode
    if (unit.dwClassId >= 0 && unit.dwClassId < MONSTATS_TXT_RECORD_COUNT) {
      const rec = getMonsterPathRecord(unit.dwClassId)
      if (rec.splClientEnd !== 0) {
        const baseId = rec.baseId
        if (mode === MONMODE_WALK && (baseId === 231 || baseId === 118)) {
          return // iceglobe / willowisp: keep WL
        }
        if (
          (mode === MONMODE_ATTACK1 || mode === MONMODE_ATTACK2 || mode === MONMODE_SKILL2) &&
          (baseId === 403 || baseId === 404)
        ) {
          this.changeAnimMode0x6FADA6C0(unit, MONMODE_SKILL1)
          this.initAnimStartFrame10595(unit)
          return
        }
        if (mode === MONMODE_SKILL1) {
          if (baseId === 110) return // vulture: keep S1
          if (baseId === 403 || baseId === 404) {
            this.changeAnimMode0x6FADA6C0(unit, MONMODE_SKILL1)
            this.initAnimStartFrame10595(unit)
            return
          }
        }
        if (mode === MONMODE_SKILL3 && baseId === 136) {
          this.changeAnimMode0x6FADA6C0(unit, MONMODE_SKILL4)
          this.initAnimStartFrame10595(unit)
          return
        }
        if (mode === MONMODE_SKILL4 && baseId === 136) {
          return // batdemon: keep S4
        }
        if (mode === MONMODE_DEAD && baseId === 284) {
          return // maggotqueen: keep DD
        }
        if (mode === MONMODE_SEQUENCE && baseId === 247) {
          return // frogdemon: keep SQ
        }
      }
    }

    // Default (0x6FAFDBBA): server-ordered walk/run holds WL/RN at path end when dwFlagEx & 0x2000!
    if ((unit.dwFlags & UNITFLAG_ISASYNC) === 0 && (unit.dwFlagEx & UNITFLAGEX_UNK_PATH_RELATED) !== 0) {
      return
    }
    this.changeAnimMode0x6FADA6C0(unit, MONMODE_NEUTRAL)
    this.initAnimStartFrame10595(unit)
  }
}

function clampAnimSpeed(speed: number): number {
  const s = speed | 0
  if (s < 0) return 0
  if (s > 0x7fff) return 0x7fff
  return s
}

export {
  D2Common_10216,
  D2Common_10399,
  MONSTATSFLAGINDEX_INTERACT,
  MONSTATSFLAGINDEX_NPC,
  PATH_GetNumberOfPathPoints,
  PATH_GetVelocity,
  PATH_ResetToPreviousType,
  i32,
  u16,
  u32,
}
