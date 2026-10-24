/**
 * Remote Entity Movement Interpolator (`src/client/motion/interpolate.ts`, Feature F12).
 *
 * Smoothly advances remote monsters, NPCs, mercenaries, and other players along
 * server-issued movement segments:
 *   - `0x0F PlayerMove` / `0x10 PlayerMoveToUnit`
 *   - `0x0D PlayerStop`
 *   - `0x67 NPCMove` (`{ unitId, moveType, x, y, targetX, targetY, ... }`)
 *   - `0x68 NPCMoveToTarget` (`{ unitId, moveType, x, y, targetUnitType, targetId, ... }`)
 *   - `0x6D NPCStop` (`{ unitId, x, y, life }`)
 *
 * Facings are 64-direction values (`common/units/direction.ts`): movement segments and skill/attack
 * casts set `targetDir64` via `D2Common.#10425` (`bInstant = 0`), while `update(dtMs)` steps
 * `dir64` toward `targetDir64` at 25Hz (`D2Common.#10603`).
 */

import {
  advanceUnitTurnByDtMs,
  assertDir64,
  createUnitTurnState,
  setUnitTargetDirection,
  snapUnitTurnDirection,
  targetUnitTurnTowardPoint,
  type UnitTurnState,
} from '../../common/units/direction.ts'
import { MONSTATS_TXT_RECORD_COUNT, getMonsterPathRecord } from '../../common/path/index.ts'
import { type SubTilePoint } from './pathfind.ts'
import {
  D2_BASE_RUN_SUBTILES_PER_SEC,
  D2_BASE_WALK_SUBTILES_PER_SEC,
  D2_TICK_MS,
} from './predictor.ts'

/** Default drift (sub-tiles) beyond which a remote monster/NPC snaps to the server position (`D2Client.dll 0x6FADA2CF`). */
const DEFAULT_REMOTE_SNAP_THRESHOLD = 5.0

/**
 * Per-axis drift tolerance (sub-tiles) for remote players (`unitType === 0`, `pUnit != gpPlayerUnit`)
 * in 1.13c (`D2Client.dll 0x6FADA1B0` at `0x6FADA25D..0x6FADA2B4`: `mov ecx, 0xf`).
 */
export const D2_REMOTE_PLAYER_SNAP_THRESHOLD = 15.0

export type RemoteCollisionChecker = (x: number, y: number) => boolean

export interface RemoteEntityMotionState {
  readonly unitType: number
  readonly unitId: number
  readonly classId?: number | undefined
  readonly x: number
  readonly y: number
  readonly targetX: number
  readonly targetY: number
  readonly speedSubTilesPerSec: number
  readonly moving: boolean
  readonly running: boolean
  readonly dead?: boolean | undefined
  /** Current facing in the engine's 64-direction space (`D2DynamicPathStrc+0x38`). */
  readonly dir64: number
  /** Target facing in the engine's 64-direction space (`D2DynamicPathStrc+0x39`). */
  readonly targetDir64: number
  /** Cached turn step per 25Hz tick (`D2DynamicPathStrc` `+0x66` `nStepDir`: 0, ±1, ±4, ±8). */
  readonly stepDir: number
}

export type RemoteEntityState = RemoteEntityMotionState

export interface RemoteMoveCommand {
  readonly unitType: number
  readonly unitId: number
  readonly classId?: number | undefined
  readonly currentX?: number | undefined
  readonly currentY?: number | undefined
  readonly fromX?: number | undefined
  readonly fromY?: number | undefined
  readonly targetX?: number | undefined
  readonly targetY?: number | undefined
  readonly toX?: number | undefined
  readonly toY?: number | undefined
  readonly running?: boolean | undefined
  readonly moveType?: number | undefined
  readonly speedSubTilesPerSec?: number | undefined
  readonly velocityPercent?: number | undefined
  readonly nVelocity?: number | undefined
  readonly pathType?: number | undefined
  readonly hardSnapThreshold?: number | undefined
}

export interface RemoteStopCommand {
  readonly unitType: number
  readonly unitId: number
  readonly x: number
  readonly y: number
  readonly hardSnapThreshold?: number | undefined
}

interface MutableRemoteEntityMotion {
  unitType: number
  unitId: number
  classId?: number | undefined
  x: number
  y: number
  targetX: number
  targetY: number
  waypoints: SubTilePoint[]
  waypointIndex: number
  detourAttempted: boolean
  pathType?: number | undefined
  speedSubTilesPerSec: number
  moving: boolean
  running: boolean
  dead: boolean
  turnState: UnitTurnState
}

function entityKey(unitType: number, unitId: number): string {
  return `${String(unitType)}:${String(unitId >>> 0)}`
}

function toState(state: MutableRemoteEntityMotion): RemoteEntityMotionState {
  return {
    unitType: state.unitType,
    unitId: state.unitId,
    ...(state.classId !== undefined ? { classId: state.classId } : {}),
    x: state.x,
    y: state.y,
    targetX: state.targetX,
    targetY: state.targetY,
    speedSubTilesPerSec: state.speedSubTilesPerSec,
    moving: state.moving,
    running: state.running,
    dead: state.dead,
    dir64: state.turnState.dir64,
    targetDir64: state.turnState.targetDir64,
    stepDir: state.turnState.stepDir,
  }
}

function isSegmentBlocked(
  checkBlocked: RemoteCollisionChecker,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const dist = Math.hypot(x1 - x0, y1 - y0)
  const samples = Math.max(2, Math.ceil(dist / 0.2))
  for (let i = 1; i <= samples; i++) {
    const t = i / samples
    const sx = x0 + (x1 - x0) * t
    const sy = y0 + (y1 - y0) * t
    if (checkBlocked(sx, sy)) return true
  }
  return false
}

const DETOUR_DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1.0],
  [-1, 0, 1.0],
  [0, 1, 1.0],
  [0, -1, 1.0],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
]

/**
 * Compute a bounded local sub-tile detour (`D2Common.dll` local obstacle avoidance for `nPathType` 2/8)
 * around a short finite obstacle wall between `(startX, startY)` and `(goalX, goalY)`.
 * Returns `null` if the goal is blocked or if the wall spans the entire local search margin.
 */
function findLocalDetourWaypoints(
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  checkBlocked: RemoteCollisionChecker,
): SubTilePoint[] | null {
  if (checkBlocked(goalX, goalY)) return null
  const sx = Math.round(startX)
  const sy = Math.round(startY)
  const gx = Math.round(goalX)
  const gy = Math.round(goalY)
  if (checkBlocked(gx, gy)) return null

  const directDist = Math.hypot(goalX - startX, goalY - startY)
  if (directDist <= 0.25 || directDist > 36) return null

  const margin = 5
  const minX = Math.min(sx, gx) - margin
  const maxX = Math.max(sx, gx) + margin
  const minY = Math.min(sy, gy) - margin
  const maxY = Math.max(sy, gy) + margin
  const width = maxX - minX + 1
  const height = maxY - minY + 1
  const total = width * height
  if (total <= 0 || total > 2500) return null

  const toIdx = (x: number, y: number): number => (y - minY) * width + (x - minX)
  const gScore = new Float64Array(total).fill(Number.POSITIVE_INFINITY)
  const fScore = new Float64Array(total).fill(Number.POSITIVE_INFINITY)
  const parent = new Int32Array(total).fill(-1)
  const closed = new Uint8Array(total)
  const inOpen = new Uint8Array(total)
  const open: number[] = []

  const startIdx = toIdx(sx, sy)
  const goalIdx = toIdx(gx, gy)
  gScore[startIdx] = 0
  fScore[startIdx] = Math.hypot(gx - sx, gy - sy)
  open.push(startIdx)
  inOpen[startIdx] = 1

  const maxAllowedCost = directDist + 8

  while (open.length > 0) {
    let bestPos = 0
    let bestIdx = open[0]!
    let bestF = fScore[bestIdx]!
    for (let i = 1; i < open.length; i++) {
      const idx = open[i]!
      const f = fScore[idx]!
      if (f < bestF) {
        bestF = f
        bestIdx = idx
        bestPos = i
      }
    }
    open.splice(bestPos, 1)
    inOpen[bestIdx] = 0

    if (bestIdx === goalIdx) {
      const raw: SubTilePoint[] = []
      let cur = goalIdx
      while (cur !== -1 && cur !== startIdx) {
        const cx = minX + (cur % width)
        const cy = minY + Math.floor(cur / width)
        raw.push({ x: cx, y: cy })
        cur = parent[cur]!
      }
      raw.reverse()
      if (raw.length > 0) {
        raw[raw.length - 1] = { x: goalX, y: goalY }
      } else {
        raw.push({ x: goalX, y: goalY })
      }
      return raw
    }

    closed[bestIdx] = 1
    const cx = minX + (bestIdx % width)
    const cy = minY + Math.floor(bestIdx / width)
    const curG = gScore[bestIdx]!

    for (const [dx, dy, stepCost] of DETOUR_DIRS) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue
      const nIdx = toIdx(nx, ny)
      if (closed[nIdx] === 1) continue
      const tentativeG = curG + stepCost
      if (tentativeG > maxAllowedCost) continue
      if (checkBlocked(nx, ny)) continue
      const fromX = bestIdx === startIdx ? startX : cx
      const fromY = bestIdx === startIdx ? startY : cy
      if (isSegmentBlocked(checkBlocked, fromX, fromY, nx, ny)) continue

      if (tentativeG < gScore[nIdx]!) {
        parent[nIdx] = bestIdx
        gScore[nIdx] = tentativeG
        fScore[nIdx] = tentativeG + Math.hypot(gx - nx, gy - ny)
        if (inOpen[nIdx] === 0) {
          open.push(nIdx)
          inOpen[nIdx] = 1
        }
      }
    }
  }

  return null
}

/**
 * Convert D2 S2C `0x67` / `0x68` / `0x0F` `moveType` byte and unit stats into `{ running, speedSubTilesPerSec }`.
 *
 * 1.13c Ground Truth:
 * - Base velocity: players use CharStats.txt WalkVelocity (6) / RunVelocity (9);
 *   monsters use MonStats.txt Velocity / Run (D2Common Units.cpp:1288-1299).
 * - S2C 0x67 / 0x68 transmits nVelocity (STAT_VELOCITYPERCENT total).
 * - Speed floor is 25% of base speed (Units.cpp:1678).
 */
export function resolveRemoteMoveSpeed(options: {
  readonly running?: boolean | undefined
  readonly moveType?: number | undefined
  readonly speedSubTilesPerSec?: number | undefined
  readonly unitType?: number | undefined
  readonly classId?: number | undefined
  readonly velocityPercent?: number | undefined
  readonly nVelocity?: number | undefined
}): { readonly running: boolean; readonly speedSubTilesPerSec: number } {
  const running =
    options.running ??
    (options.moveType !== undefined
      ? options.moveType === 0x17 ||
        options.moveType === 0x18 ||
        (options.moveType & 0x02) !== 0
      : false)
  if (options.speedSubTilesPerSec !== undefined && options.speedSubTilesPerSec > 0) {
    return { running, speedSubTilesPerSec: options.speedSubTilesPerSec }
  }

  const velPct = options.velocityPercent ?? options.nVelocity

  // If monster / NPC (unitType === 1) with known classId (1.13c #10819 at 0x6FD83331):
  // Never route remote players (`unitType === 0`, classId 0..6 = Amazon..Assassin) into MonStats.txt!
  if (
    options.unitType !== 0 &&
    options.classId !== undefined &&
    options.classId >= 0 &&
    options.classId < MONSTATS_TXT_RECORD_COUNT
  ) {
    const rec = getMonsterPathRecord(options.classId)
    const pct = Math.max(25, velPct !== undefined && velPct !== 0 ? velPct : 75)
    const dwVelocity = Math.trunc((pct * (rec.velocity << 8)) / 100)
    return { running, speedSubTilesPerSec: (25 * dwVelocity) / 4096 }
  }

  // Remote player or generic unit:
  let baseSpeed = running ? D2_BASE_RUN_SUBTILES_PER_SEC : D2_BASE_WALK_SUBTILES_PER_SEC
  if (velPct !== undefined && velPct !== 0) {
    // 25% minimum speed floor per 1.13c ground truth (Units.cpp:1678)
    const effectivePct = Math.max(25, velPct)
    baseSpeed = (D2_BASE_WALK_SUBTILES_PER_SEC * effectivePct) / 100
  }
  return {
    running,
    speedSubTilesPerSec: baseSpeed,
  }
}

export class RemoteEntityInterpolator {
  private readonly entities = new Map<string, MutableRemoteEntityMotion>()
  private readonly snapThreshold: number
  private readonly customSnapThreshold: number | undefined
  private collisionChecker: RemoteCollisionChecker | undefined

  constructor(
    options: {
      readonly snapThreshold?: number
      readonly collisionChecker?: RemoteCollisionChecker | undefined
    } = {},
  ) {
    this.customSnapThreshold = options.snapThreshold
    this.snapThreshold = options.snapThreshold ?? DEFAULT_REMOTE_SNAP_THRESHOLD
    this.collisionChecker = options.collisionChecker
  }

  setCollisionChecker(checker: RemoteCollisionChecker | undefined): void {
    this.collisionChecker = checker
  }

  /**
   * Register or hard-snap an entity at `(x, y)`. Without `dir64` a known entity keeps its
   * facing/turn state (a `0x15` reassign carries no direction); a new one faces dir64 0.
   * When `dir64` is explicitly provided (`UnitAssign` spawn), snaps both `dir64` and `targetDir64` (`bInstant = 1`).
   */
  spawnOrSnap(params: {
    readonly unitType: number
    readonly unitId: number
    readonly x: number
    readonly y: number
    readonly dir64?: number | undefined
    readonly classId?: number | undefined
    readonly dead?: boolean | undefined
  }): RemoteEntityMotionState {
    if (params.dir64 !== undefined) assertDir64(params.dir64, 'dir64')
    const key = entityKey(params.unitType, params.unitId)
    const previous = this.entities.get(key)
    const turnState: UnitTurnState =
      params.dir64 !== undefined
        ? createUnitTurnState(params.dir64)
        : previous
          ? { ...previous.turnState }
          : createUnitTurnState(0)
    const classId = params.classId ?? previous?.classId
    const { speedSubTilesPerSec } = resolveRemoteMoveSpeed({
      running: false,
      unitType: params.unitType,
      classId,
    })
    const state: MutableRemoteEntityMotion = {
      unitType: params.unitType,
      unitId: params.unitId >>> 0,
      classId,
      x: params.x,
      y: params.y,
      targetX: params.x,
      targetY: params.y,
      waypoints: [],
      waypointIndex: 0,
      detourAttempted: false,
      speedSubTilesPerSec,
      moving: false,
      running: false,
      dead: params.dead ?? false,
      turnState,
    }
    this.entities.set(key, state)
    return toState(state)
  }

  /**
   * Freeze an entity immediately upon entering death/corpse state (`DT` mode 0 / `DD` mode 12):
   * snaps `(x, y)` and `(targetX, targetY)` to the authoritative death coordinates (if provided),
   * halts movement (`moving = false`), and freezes facing (`targetDir64 = dir64`, `stepDir = 0`)
   * without turning toward the death coordinate.
   */
  freezeEntityAt(params: {
    readonly unitType: number
    readonly unitId: number
    readonly x?: number | undefined
    readonly y?: number | undefined
    readonly dir64?: number | undefined
    readonly classId?: number | undefined
  }): RemoteEntityMotionState {
    if (params.dir64 !== undefined) assertDir64(params.dir64, 'dir64')
    const key = entityKey(params.unitType, params.unitId)
    const existing = this.entities.get(key)
    const hasCoords =
      params.x !== undefined &&
      params.y !== undefined &&
      (params.x !== 0 || params.y !== 0)
    if (!existing) {
      const created = this.spawnOrSnap({
        unitType: params.unitType,
        unitId: params.unitId,
        x: hasCoords ? params.x! : 0,
        y: hasCoords ? params.y! : 0,
        ...(params.dir64 !== undefined ? { dir64: params.dir64 } : {}),
        ...(params.classId !== undefined ? { classId: params.classId } : {}),
        dead: true,
      })
      return created
    }
    if (params.classId !== undefined) {
      existing.classId = params.classId
    }
    if (hasCoords) {
      existing.x = params.x!
      existing.y = params.y!
    }
    existing.targetX = existing.x
    existing.targetY = existing.y
    existing.moving = false
    existing.running = false
    existing.dead = true
    snapUnitTurnDirection(existing.turnState, params.dir64 ?? existing.turnState.dir64)
    return toState(existing)
  }

  /**
   * Unfreeze a previously dead entity when legitimately resurrected (e.g. Fallen `S1` mode 8).
   */
  unfreezeEntity(unitType: number, unitId: number): RemoteEntityMotionState | null {
    const state = this.entities.get(entityKey(unitType, unitId))
    if (!state) return null
    state.dead = false
    return toState(state)
  }

  /**
   * Apply a remote movement command (`0x0F PlayerMove`, `0x67 NPCMove`, `0x68 NPCMoveToTarget`).
   */
  startMove(cmd: RemoteMoveCommand): RemoteEntityMotionState {
    const key = entityKey(cmd.unitType, cmd.unitId)
    let state = this.entities.get(key)
    if (state?.dead) {
      return toState(state)
    }
    const classId = cmd.classId ?? state?.classId
    const { running, speedSubTilesPerSec } = resolveRemoteMoveSpeed({
      ...cmd,
      classId,
    })

    const targetX = cmd.targetX ?? cmd.toX ?? state?.targetX ?? 0
    const targetY = cmd.targetY ?? cmd.toY ?? state?.targetY ?? 0
    const currentX = cmd.currentX ?? cmd.fromX
    const currentY = cmd.currentY ?? cmd.fromY

    const startX = currentX ?? state?.x ?? targetX
    const startY = currentY ?? state?.y ?? targetY

    let snapped = false
    let effectiveSpeed = speedSubTilesPerSec
    const sameTarget =
      state !== undefined &&
      Math.hypot(targetX - state.targetX, targetY - state.targetY) <= 1e-4

    if (!state) {
      state = {
        unitType: cmd.unitType,
        unitId: cmd.unitId >>> 0,
        classId,
        x: startX,
        y: startY,
        targetX,
        targetY,
        waypoints: [{ x: targetX, y: targetY }],
        waypointIndex: 0,
        detourAttempted: false,
        pathType: cmd.pathType,
        speedSubTilesPerSec,
        moving: false,
        running,
        dead: false,
        turnState: createUnitTurnState(0),
      }
      this.entities.set(key, state)
      snapped = true
    } else {
      if (classId !== undefined) {
        state.classId = classId
      }
      if (cmd.pathType !== undefined) {
        state.pathType = cmd.pathType
      }
      if (currentX !== undefined && currentY !== undefined) {
        // D2Client.dll 0x6FADA1B0 per-axis tolerance gate:
        // - Remote player (unitType === 0, pUnit != gpPlayerUnit): 15 sub-tiles (0x6FADA2AF: mov ecx, 0xf)
        // - Monster / self: WL=5, RN=7 (0x6FADA2CF / 0x6FADA2D6)
        const defaultLimit =
          cmd.unitType === 0
            ? D2_REMOTE_PLAYER_SNAP_THRESHOLD
            : running
              ? 7
              : this.snapThreshold
        const snapLimit =
          cmd.hardSnapThreshold ??
          this.customSnapThreshold ??
          defaultLimit
        const maxAxisDrift = Math.max(Math.abs(currentX - state.x), Math.abs(currentY - state.y))
        if (maxAxisDrift > snapLimit) {
          state.x = currentX
          state.y = currentY
          snapped = true
        } else if (cmd.unitType === 0 && maxAxisDrift > 1.5) {
          const serverRemDist = Math.hypot(targetX - currentX, targetY - currentY)
          const clientRemDist = Math.hypot(targetX - state.x, targetY - state.y)
          if (serverRemDist > 1.5 && clientRemDist > 1e-4) {
            const ratio = Math.max(0.8, Math.min(1.25, clientRemDist / serverRemDist))
            effectiveSpeed = speedSubTilesPerSec * ratio
          }
        }
      }
    }

    state.targetX = targetX
    state.targetY = targetY
    if (snapped || !sameTarget || !state.moving || state.waypoints.length === 0) {
      state.waypoints = [{ x: targetX, y: targetY }]
      state.waypointIndex = 0
      state.detourAttempted = false
    }
    state.running = running
    state.speedSubTilesPerSec = effectiveSpeed

    const dx = state.targetX - state.x
    const dy = state.targetY - state.y
    const dist = Math.hypot(dx, dy)
    if (dist > 1e-4) {
      state.moving = true
      targetUnitTurnTowardPoint(state.turnState, state.x, state.y, state.targetX, state.targetY, false)
      // 1.13c Parity (Issue #598): Units advance cleanly along waypoints at authentic velocity without synthetic 1.5x acceleration
    } else {
      state.x = state.targetX
      state.y = state.targetY
      state.waypoints = []
      state.moving = false
    }

    return toState(state)
  }

  /**
   * Apply a server stop packet (`0x0D PlayerStop`, `0x6D NPCStop`).
   *
   * 1.13c Ground Truth (`D2Client.dll` `0x6FB5F2B0` + `0x6FADA1B0`):
   * - If the entity is currently stationary (`!state.moving`, e.g. `MONMODE_NEUTRAL`), tolerance is 0 -> snap immediately with `moving = false`.
   * - If the entity is currently moving, per-axis tolerance is `WL = 5` / `RN = 7` (or `cmd.hardSnapThreshold`).
   *   When within tolerance and unblocked, smoothly walk to `(cmd.x, cmd.y)`; otherwise hard-snap immediately.
   */
  stopEntity(cmd: RemoteStopCommand): RemoteEntityMotionState {
    const key = entityKey(cmd.unitType, cmd.unitId)
    const state = this.entities.get(key)
    if (!state) {
      return this.spawnOrSnap({
        unitType: cmd.unitType,
        unitId: cmd.unitId,
        x: cmd.x,
        y: cmd.y,
      })
    }
    if (state.dead) {
      return toState(state)
    }

    const dx = cmd.x - state.x
    const dy = cmd.y - state.y
    const dist = Math.hypot(dx, dy)
    const maxAxisDrift = Math.max(Math.abs(dx), Math.abs(dy))
    const defaultLimit =
      cmd.unitType === 0
        ? D2_REMOTE_PLAYER_SNAP_THRESHOLD
        : state.running
          ? 7
          : this.snapThreshold
    const snapLimit =
      cmd.hardSnapThreshold ??
      this.customSnapThreshold ??
      defaultLimit
    const blockedSegment =
      this.collisionChecker !== undefined &&
      dist > 0.15 &&
      isSegmentBlocked(this.collisionChecker, state.x, state.y, cmd.x, cmd.y)

    const fwdX = state.targetX - state.x
    const fwdY = state.targetY - state.y
    const dot = dx * fwdX + dy * fwdY
    // D2Client.dll 0x6FADA460 (0x6FADA494..0x6FADA4DF): when a remote player stops within 1 sub-tile
    // on both axes (or has slightly overshot the integer stop coordinate along its current heading),
    // halt in place without snapping backward or turning 180° to walk backward.
    const haltRemotePlayerInPlace =
      cmd.unitType === 0 &&
      cmd.hardSnapThreshold === undefined &&
      (state.x !== 0 || state.y !== 0) &&
      dist > 0.25 &&
      dot <= 0 &&
      (maxAxisDrift <= 1.0 || (state.moving && maxAxisDrift <= 2.5))

    if (haltRemotePlayerInPlace) {
      state.targetX = state.x
      state.targetY = state.y
      state.waypoints = []
      state.waypointIndex = 0
      state.moving = false
    } else if (
      !state.moving ||
      dist <= (cmd.unitType === 0 ? 0.25 : 0.15) ||
      maxAxisDrift > snapLimit ||
      blockedSegment
    ) {
      state.x = cmd.x
      state.y = cmd.y
      state.targetX = cmd.x
      state.targetY = cmd.y
      state.waypoints = []
      state.waypointIndex = 0
      state.moving = false
    } else {
      // Smoothly finish the small remaining glide to the authoritative stop point, turning toward
      // it via D2Common.#10425 (bInstant = 0) so the unit never slides backwards.
      state.targetX = cmd.x
      state.targetY = cmd.y
      state.waypoints = [{ x: cmd.x, y: cmd.y }]
      state.waypointIndex = 0
      state.detourAttempted = false
      state.moving = true
      targetUnitTurnTowardPoint(state.turnState, state.x, state.y, cmd.x, cmd.y, false)
    }

    return toState(state)
  }

  /**
   * Set an entity's target direction (`bInstant = 0` by default, or `bInstant = 1` when `instant = true`).
   */
  setEntityTargetDirection(
    unitType: number,
    unitId: number,
    targetDir64: number,
    instant = false,
  ): RemoteEntityMotionState | null {
    assertDir64(targetDir64, 'targetDir64')
    const state = this.entities.get(entityKey(unitType, unitId))
    if (!state) return null
    if (state.dead) return toState(state)
    if (instant) {
      snapUnitTurnDirection(state.turnState, targetDir64)
    } else {
      setUnitTargetDirection(state.turnState, targetDir64, false)
    }
    return toState(state)
  }

  /**
   * Turn an entity toward `(targetX, targetY)` (`bInstant = 0` by default).
   */
  faceEntityToward(
    unitType: number,
    unitId: number,
    targetX: number,
    targetY: number,
    instant = false,
  ): RemoteEntityMotionState | null {
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
      throw new RangeError(
        `Coordinates must be finite numbers, got (${String(targetX)}, ${String(targetY)})`,
      )
    }
    const state = this.entities.get(entityKey(unitType, unitId))
    if (!state) return null
    if (state.dead) return toState(state)
    targetUnitTurnTowardPoint(state.turnState, state.x, state.y, targetX, targetY, instant)
    return toState(state)
  }

  removeEntity(unitType: number, unitId: number): boolean {
    return this.entities.delete(entityKey(unitType, unitId))
  }

  clear(): void {
    this.entities.clear()
  }

  /**
   * Advance all interpolated entities by `dtMs` milliseconds:
   * - Steps every entity's 25Hz turn state (`D2Common.#10603`), whether moving or standing.
   * - Advances position for moving entities, enforcing `COLLIDE_MASK_WALK` terrain collision
   *   when `isBlocked` (or `this.collisionChecker`) is provided.
   */
  update(dtMs: number, isBlocked?: RemoteCollisionChecker): void {
    if (!Number.isFinite(dtMs)) {
      throw new RangeError(`dtMs must be a finite number, got ${String(dtMs)}`)
    }
    if (dtMs <= 0) return
    const dtSec = dtMs / 1000
    const checkBlocked = isBlocked ?? this.collisionChecker

    for (const state of this.entities.values()) {
      if (state.dead) continue
      advanceUnitTurnByDtMs(state.turnState, dtMs)
      if (!state.moving) continue

      let remainingStep = state.speedSubTilesPerSec * dtSec
      if (state.waypoints.length === 0) {
        state.waypoints = [{ x: state.targetX, y: state.targetY }]
        state.waypointIndex = 0
      }

      let guard = 0
      while (remainingStep > 1e-6 && state.moving && guard++ < 8) {
        const wp = state.waypoints[state.waypointIndex] ?? {
          x: state.targetX,
          y: state.targetY,
        }
        const dx = wp.x - state.x
        const dy = wp.y - state.y
        const dist = Math.hypot(dx, dy)

        if (dist <= 1e-5) {
          state.x = wp.x
          state.y = wp.y
          if (state.waypointIndex + 1 < state.waypoints.length) {
            state.waypointIndex++
            const nextWp = state.waypoints[state.waypointIndex]!
            targetUnitTurnTowardPoint(state.turnState, state.x, state.y, nextWp.x, nextWp.y, false)
            continue
          }
          state.x = state.targetX
          state.y = state.targetY
          state.waypoints = []
          state.waypointIndex = 0
          state.moving = false
          break
        }

        const moveDist = Math.min(remainingStep, dist)
        const ux = dx / dist
        const uy = dy / dist

        if (!checkBlocked) {
          if (dist <= remainingStep) {
            state.x = wp.x
            state.y = wp.y
            remainingStep -= dist
            if (state.waypointIndex + 1 < state.waypoints.length) {
              state.waypointIndex++
              const nextWp = state.waypoints[state.waypointIndex]!
              targetUnitTurnTowardPoint(state.turnState, state.x, state.y, nextWp.x, nextWp.y, false)
            } else {
              state.x = state.targetX
              state.y = state.targetY
              state.waypoints = []
              state.waypointIndex = 0
              state.moving = false
              break
            }
          } else {
            state.x += ux * moveDist
            state.y += uy * moveDist
            remainingStep = 0
          }
          continue
        }

        // Collision-aware sub-tile sampling along the step vector:
        const samples = Math.max(1, Math.ceil(moveDist / 0.125))
        let lastSafeX = state.x
        let lastSafeY = state.y
        let hitWall = false

        for (let i = 1; i <= samples; i++) {
          const stepFrac = (moveDist * i) / samples
          const sx = i === samples && dist <= remainingStep ? wp.x : state.x + ux * stepFrac
          const sy = i === samples && dist <= remainingStep ? wp.y : state.y + uy * stepFrac
          if (checkBlocked(sx, sy)) {
            hitWall = true
            break
          }
          lastSafeX = sx
          lastSafeY = sy
        }

        if (hitWall) {
          const advanced = Math.hypot(lastSafeX - state.x, lastSafeY - state.y)
          state.x = lastSafeX
          state.y = lastSafeY
          remainingStep = Math.max(0, remainingStep - advanced)

          if (!state.detourAttempted) {
            state.detourAttempted = true
            const detour = findLocalDetourWaypoints(
              state.x,
              state.y,
              state.targetX,
              state.targetY,
              checkBlocked,
            )
            if (detour && detour.length > 0) {
              state.waypoints = detour
              state.waypointIndex = 0
              const firstWp = detour[0]!
              targetUnitTurnTowardPoint(state.turnState, state.x, state.y, firstWp.x, firstWp.y, false)
              continue
            }
          }

          // Impassable wall or blocked destination: clamp before wall and halt movement
          state.targetX = state.x
          state.targetY = state.y
          state.waypoints = []
          state.waypointIndex = 0
          state.moving = false
          break
        }

        state.x = lastSafeX
        state.y = lastSafeY
        remainingStep -= moveDist
        if (dist <= moveDist + 1e-5) {
          if (state.waypointIndex + 1 < state.waypoints.length) {
            state.waypointIndex++
            const nextWp = state.waypoints[state.waypointIndex]!
            targetUnitTurnTowardPoint(state.turnState, state.x, state.y, nextWp.x, nextWp.y, false)
          } else {
            state.x = state.targetX
            state.y = state.targetY
            state.waypoints = []
            state.waypointIndex = 0
            state.moving = false
            break
          }
        }
      }
    }
  }

  /**
   * Advance all interpolated entities by `ticks` 25Hz ticks (`ticks * 40ms`).
   */
  stepTicks(ticks = 1, isBlocked?: RemoteCollisionChecker): void {
    for (let i = 0; i < ticks; i++) {
      this.update(D2_TICK_MS, isBlocked)
    }
  }

  getEntityState(unitType: number, unitId: number): RemoteEntityMotionState | null {
    const state = this.entities.get(entityKey(unitType, unitId))
    return state ? toState(state) : null
  }

  getAllStates(): RemoteEntityMotionState[] {
    return Array.from(this.entities.values(), s => toState(s))
  }
}
