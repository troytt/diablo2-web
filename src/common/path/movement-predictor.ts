/**
 * Local Player Movement Predictor (`src/common/path/movement-predictor.ts`, Feature F12).
 *
 * Shared by the client (`src/client/motion/predictor.ts` re-exports it) and the server
 * (`GameInstance.stepPlayerMovement`, issue #1329), so both sides step a player with the same
 * D2Common 1.13c velocity, waypoint and collision rules.
 *
 * Steps the local player along an A* / string-pulled waypoint path at 25Hz (40ms per tick)
 * or arbitrary `dtMs` frame deltas, and applies the D2Client 1.13c rules for authoritative
 * server positions:
 *   - `0x15 ReassignPlayer` repositions the player and drops its path
 *     ({@link LocalMovementPredictor.setPosition}; D2Client 0x6FB5F640 → 0x6FB57E20, no
 *     tolerance check).
 *   - `0x18` / `0x95` / `0x96` (`LifeMana` with a position) and `0x0D` go through the
 *     position tolerance gate D2Client 0x6FADA1B0
 *     ({@link LocalMovementPredictor.verifyServerPosition}). The client never moves the local
 *     player toward such a position; when the drift is out of tolerance it asks the server to
 *     resynchronise with C2S `0x5F`, and the server answers with `0x15` if it disagrees.
 *
 * The target facing is a dir64 (`common/units/direction.ts`), set when a segment starts — on
 * {@link LocalMovementPredictor.setPath} and on each waypoint advance — like the engine's
 * D2Common 0x6FD5D240, and `dir64` rotates toward `targetDir64` at 25Hz (D2Common #10603,
 * D2Client 0x6FACC507).
 */

import {
  advanceUnitTurnByDtMs,
  createUnitTurnState,
  setUnitTargetDirection,
  snapUnitTurnDirection,
  targetUnitTurnTowardPoint,
  type UnitTurnState,
} from '../units/direction.ts'
import {
  findPathWorld,
  type PathfindOptions,
  type SubTilePoint,
  type SubTileWalkabilityGrid,
} from './pathfind.ts'

export const D2_TICK_MS = 40 // 25Hz D2 game tick
export const D2_BASE_WALK_SUBTILES_PER_SEC = 9.0 // 6 yards/s * 1.5 sub-tiles/yard
export const D2_BASE_RUN_SUBTILES_PER_SEC = 13.5 // 9 yards/s * 1.5 sub-tiles/yard

/**
 * D2Client 0x6FADA1B0 tolerance when the caller passes flag 1 (the `0x0D` mode handler
 * D2Client 0x6FAC9830, e.g. its get-hit case at 0x6FAC99FB).
 */
const GATE_FLAG1_THRESHOLD = 10

/**
 * D2Client 0x6FADA1B0 skips the "client is ahead of the server" exemption once the client is
 * this far from the server position, as a squared distance (D2Common #10769, 0x6FD84580,
 * returns `dx² + dy²` without a square root): 100 = 10 sub-tiles.
 */
const GATE_LEAD_MAX_DIST_SQ = 100

export interface PredictorConfig {
  readonly initialX?: number
  readonly initialY?: number
  readonly initialDir64?: number
  readonly walkSpeedSubTilesPerSec?: number
  readonly runSpeedSubTilesPerSec?: number
  readonly fasterRunWalkPercent?: number
  readonly skillVelocityPercent?: number
  readonly armorSpeedPenaltyPercent?: number
  readonly slowPercent?: number
  readonly staminaExhausted?: boolean
  readonly plrMode?: number | undefined
}

/** Which D2Client 0x6FADA1B0 caller is checking an authoritative position. */
export type ServerPositionSource =
  /**
   * `0x18` / `0x95` / `0x96` (callers 0x6FB5ED53 / 0x6FB5EC73 / 0x6FB5D9B8): gate flag 0 and
   * target = position + (vx, vy), the server unit's motion vector.
   */
  | { readonly kind: 'life-mana'; readonly vx: number; readonly vy: number }
  /**
   * `0x0D` for the local player: gate flag 1. D2Game sends the owner `0x0D` only for the
   * death, get-hit, block and dead modes (and message mode 0x13); its stand / walk / run
   * senders skip the owning client (D2MOO `PlrMsg.cpp`, `stru_6FD30708`).
   */
  | { readonly kind: 'player-stop' }

export interface ServerPositionCheck {
  /** Server sub-tile X (u16). */
  readonly x: number
  /** Server sub-tile Y (u16). */
  readonly y: number
  readonly source: ServerPositionSource
  /** Latest `0x8F` pong round trip in ms (D2Client `[0x6FBC9804]`). */
  readonly rttMs: number
  /**
   * Whether the player's room is in town (D2Client `DUNGEON_IsRoomInTown`), which makes the
   * player stand in TN instead of NU.
   */
  readonly inTown: boolean
  /**
   * Optional authoritative player mode (PlrMode enum / integer from D2Client).
   */
  readonly plrMode?: number | undefined
}

export type ServerPositionVerdictReason =
  /** X or Y is 0: the gate returns before comparing anything. */
  | 'no-position'
  /** Both axes within the tolerance. */
  | 'within-threshold'
  /** Out of tolerance, but the client is ahead along the server unit's motion. */
  | 'leading-server'
  /** Out of tolerance: the client asks for a resync. */
  | 'exceeded'

export interface ServerPositionVerdict {
  /** `request-resync`: send C2S `0x5F` with (`clientX`, `clientY`). The position is untouched. */
  readonly action: 'none' | 'request-resync'
  readonly reason: ServerPositionVerdictReason
  /** The player's integer sub-tile X the gate compared (and reports in `0x5F`). */
  readonly clientX: number
  /** The player's integer sub-tile Y the gate compared (and reports in `0x5F`). */
  readonly clientY: number
  /** Per-axis tolerance in sub-tiles; 0 when the gate returned before computing it. */
  readonly threshold: number
}

export interface PredictorSnapshot {
  /** Predicted logical sub-tile X. */
  readonly logicalX: number
  /** Predicted logical sub-tile Y. */
  readonly logicalY: number
  /** Drawn sub-tile X; always `logicalX` (1.13c draws the simulated position). */
  readonly x: number
  /** Drawn sub-tile Y; always `logicalY`. */
  readonly y: number
  /** True if currently moving along a waypoint path. */
  readonly moving: boolean
  /** True if running (false if walking). */
  readonly running: boolean
  /** Current stepped facing (`D2DynamicPathStrc` `+0x64` `nDirection`, 0..63). */
  readonly dir64: number
  /** Target facing (`D2DynamicPathStrc` `+0x65` `nNewDirection`, 0..63). */
  readonly targetDir64: number
  /** Cached turn step per 25Hz tick (`D2DynamicPathStrc` `+0x66` `nStepDir`: 0, ±1, ±4, ±8). */
  readonly stepDir: number
  /** Current active target waypoint, or null if idle. */
  readonly currentWaypoint: SubTilePoint | null
  /** Remaining waypoints including current target. */
  readonly remainingWaypoints: readonly SubTilePoint[]
}

function assertSubTile(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`${what} must be a u16 sub-tile coordinate, got ${String(value)}`)
  }
}

/** D2Common #10769 (0x6FD84580): squared distance, no square root. */
function distanceSquared(x1: number, y1: number, x2: number, y2: number): number {
  return (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
}

export class LocalMovementPredictor {
  private logicalX: number
  private logicalY: number
  private walkSpeed: number
  private runSpeed: number
  private fasterRunWalkPercent: number
  private skillVelocityPercent: number
  private armorSpeedPenaltyPercent: number
  private slowPercent: number
  private staminaExhausted: boolean
  private plrMode?: number | undefined
  private running = true
  private readonly turnState: UnitTurnState
  private waypoints: SubTilePoint[] = []
  private waypointIndex = 0
  private collisionChecker: ((subX: number, subY: number) => boolean) | null = null

  constructor(config: PredictorConfig = {}) {
    this.logicalX = config.initialX ?? 0
    this.logicalY = config.initialY ?? 0
    this.walkSpeed = config.walkSpeedSubTilesPerSec ?? D2_BASE_WALK_SUBTILES_PER_SEC
    this.runSpeed = config.runSpeedSubTilesPerSec ?? D2_BASE_RUN_SUBTILES_PER_SEC
    this.fasterRunWalkPercent = config.fasterRunWalkPercent ?? 0
    this.skillVelocityPercent = config.skillVelocityPercent ?? 0
    this.armorSpeedPenaltyPercent = config.armorSpeedPenaltyPercent ?? 0
    this.slowPercent = config.slowPercent ?? 0
    this.staminaExhausted = config.staminaExhausted ?? false
    this.plrMode = config.plrMode
    this.turnState = createUnitTurnState(config.initialDir64 ?? 0)
  }

  /**
   * Registers a sub-tile walk collision callback (`true` = blocked by wall, object, or closed door)
   * so predicted movement halts immediately if a waypoint segment crosses a blocked sub-tile.
   */
  setCollisionChecker(checker: ((subX: number, subY: number) => boolean) | null): void {
    this.collisionChecker = checker
  }

  /**
   * Effective movement speed in sub-tiles per second.
   *
   * Authentic D2 1.13c kinematics (D2Common/src/Units/Units.cpp:1288-1299, 1672-1693):
   *   - Base walk velocity: 6 yards/s (9.0 sub-tiles/s), run velocity: 9 yards/s (13.5 sub-tiles/s)
   *   - Running bonus: 100 * RunVelocity / WalkVelocity - 100 = 50% (disabled when stamina is exhausted)
   *   - Item FRW: diminishing returns formula `eff = v > 0 ? Math.floor(150 * v / (150 + v)) : v`
   *   - Skill FRW (e.g. Burst of Speed, Vigor): adds directly without diminishing returns
   *   - Armor speed penalty (e.g. Medium armor -5%, Heavy armor -10%): subtracts directly
   *   - Slow/chill: subtracts directly from velocity percent
   *   - Speed floor: minimum 25% of base walk velocity (Units.cpp:1678)
   */
  getEffectiveSpeedSubTilesPerSec(): number {
    const frw = this.fasterRunWalkPercent
    const effItemFrw = frw > 0 ? Math.floor((150 * frw) / (150 + frw)) : frw

    const isRunning = this.running && !this.staminaExhausted
    const runBonus = isRunning
      ? (this.walkSpeed > 0 ? Math.round((100 * this.runSpeed) / this.walkSpeed) - 100 : 50)
      : 0

    const armorPenalty = Math.abs(this.armorSpeedPenaltyPercent)
    const totalPercent =
      100 + effItemFrw + runBonus + this.skillVelocityPercent - armorPenalty - this.slowPercent
    const effectivePercent = Math.max(25, totalPercent)

    return (this.walkSpeed * effectivePercent) / 100
  }

  setRunning(running: boolean): void {
    this.running = running
  }

  setFasterRunWalkPercent(frwPercent: number): void {
    this.fasterRunWalkPercent = frwPercent
  }

  getFasterRunWalkPercent(): number {
    return this.fasterRunWalkPercent
  }

  setSkillVelocityPercent(skillVelocityPercent: number): void {
    this.skillVelocityPercent = skillVelocityPercent
  }

  getSkillVelocityPercent(): number {
    return this.skillVelocityPercent
  }

  setArmorSpeedPenaltyPercent(armorSpeedPenaltyPercent: number): void {
    this.armorSpeedPenaltyPercent = armorSpeedPenaltyPercent
  }

  getArmorSpeedPenaltyPercent(): number {
    return this.armorSpeedPenaltyPercent
  }

  setSlowPercent(slowPercent: number): void {
    this.slowPercent = slowPercent
  }

  getSlowPercent(): number {
    return this.slowPercent
  }

  setStaminaExhausted(exhausted: boolean): void {
    this.staminaExhausted = exhausted
  }

  isStaminaExhausted(): boolean {
    return this.staminaExhausted
  }

  setPlayerMode(plrMode: number | undefined): void {
    this.plrMode = plrMode
  }

  getPlayerMode(): number | undefined {
    return this.plrMode
  }

  setVelocityModifiers(modifiers: {
    readonly fasterRunWalkPercent?: number
    readonly skillVelocityPercent?: number
    readonly armorSpeedPenaltyPercent?: number
    readonly slowPercent?: number
    readonly staminaExhausted?: boolean
  }): void {
    if (modifiers.fasterRunWalkPercent !== undefined) {
      this.fasterRunWalkPercent = modifiers.fasterRunWalkPercent
    }
    if (modifiers.skillVelocityPercent !== undefined) {
      this.skillVelocityPercent = modifiers.skillVelocityPercent
    }
    if (modifiers.armorSpeedPenaltyPercent !== undefined) {
      this.armorSpeedPenaltyPercent = modifiers.armorSpeedPenaltyPercent
    }
    if (modifiers.slowPercent !== undefined) {
      this.slowPercent = modifiers.slowPercent
    }
    if (modifiers.staminaExhausted !== undefined) {
      this.staminaExhausted = modifiers.staminaExhausted
    }
  }

  /**
   * Place the player at `(x, y)` and drop its path, keeping the facing. This is also the
   * `0x15 ReassignPlayer` behaviour: D2Client 0x6FB5F640 → 0x6FB57E20 repositions the unit
   * directly, whatever the packet's flag byte.
   */
  setPosition(x: number, y: number): void {
    this.logicalX = x
    this.logicalY = y
    this.waypoints = []
    this.waypointIndex = 0
  }

  resetTo(x: number, y: number): void {
    this.setPosition(x, y)
  }

  /**
   * Instantaneously set both current `dir64` (`+0x64`) and `targetDir64` (`+0x65`) (`bInstant = 1`),
   * e.g. when the server assigns an explicit initial facing.
   */
  setDirection(dir64: number): void {
    snapUnitTurnDirection(this.turnState, dir64)
  }

  /**
   * Set the target facing (`+0x65`) and cache `stepDir` (`+0x66`) via the 1.13c turn table
   * (`D2Common.#10425` `0x6FD85270`, `bInstant = 0` by default).
   */
  setTargetDirection(targetDir64: number, instant = false): void {
    setUnitTargetDirection(this.turnState, targetDir64, instant)
  }

  /**
   * Face toward world sub-tile `(targetX, targetY)` (`D2Common.#10739` `0x6FD852F0`).
   */
  facePoint(targetX: number, targetY: number, instant = false): void {
    targetUnitTurnTowardPoint(this.turnState, this.logicalX, this.logicalY, targetX, targetY, instant)
  }

  /**
   * Follow `path` (world sub-tiles), as returned by `findPathWorld` from the player's cell.
   *
   * 1.13c path points never include the unit's own position (D2MOO `PathMisc.cpp`:
   * `PathPoints[0]` is the next point, the start lives in `tStartCoord`), while our pathfinder
   * returns the start cell first. Leading points in the player's current cell are therefore
   * dropped; otherwise every re-path while moving would first step back to the cell centre.
   * If nothing is left the player stops and keeps its facing.
   */
  setPath(path: readonly SubTilePoint[], running = this.running): void {
    this.running = running
    const cellX = Math.round(this.logicalX)
    const cellY = Math.round(this.logicalY)
    let start = 0
    while (
      start < path.length &&
      Math.round(path[start]!.x) === cellX &&
      Math.round(path[start]!.y) === cellY
    ) {
      start++
    }
    this.waypoints = path.slice(start).map(p => ({ x: p.x, y: p.y }))
    this.waypointIndex = 0
    this.faceCurrentWaypoint()
  }

  /**
   * Compute an A* + LOS string-pulled path on `grid` (in world sub-tiles) and start
   * moving along it.
   *
   * The path starts from the player's cell, `Math.round` of the logical position, as in
   * `CommandMapper`: `findPathWorld` floors its start, so a raw fractional position of N.5 or
   * more would start the path one cell behind the player, which {@link setPath} cannot drop.
   */
  moveToWorldSubTile(
    grid: SubTileWalkabilityGrid,
    worldGoalX: number,
    worldGoalY: number,
    options: PathfindOptions & { readonly running?: boolean } = {},
  ): readonly SubTilePoint[] {
    if (options.running !== undefined) {
      this.running = options.running
    }
    const result = findPathWorld(
      grid,
      Math.round(this.logicalX),
      Math.round(this.logicalY),
      worldGoalX,
      worldGoalY,
      options,
    )
    this.setPath(result.path, this.running)
    return this.getRemainingWaypoints()
  }

  stop(): void {
    this.waypoints = []
    this.waypointIndex = 0
  }

  getRemainingWaypoints(): readonly SubTilePoint[] {
    return this.waypoints.slice(this.waypointIndex)
  }

  /**
   * Step the predictor by `ticks` 25Hz game ticks (`ticks * 40ms`).
   */
  stepTicks(ticks = 1): PredictorSnapshot {
    if (!Number.isInteger(ticks) || ticks < 0) {
      throw new RangeError(`ticks must be a non-negative integer, got ${String(ticks)}`)
    }
    for (let i = 0; i < ticks; i++) {
      this.update(D2_TICK_MS)
    }
    return this.getSnapshot()
  }

  private clampSegmentAgainstCollision(
    prevX: number,
    prevY: number,
    nextX: number,
    nextY: number,
  ): { readonly x: number; readonly y: number; readonly blocked: boolean } {
    if (!this.collisionChecker) {
      return { x: nextX, y: nextY, blocked: false }
    }
    let cx = Math.round(prevX)
    let cy = Math.round(prevY)
    const tx = Math.round(nextX)
    const ty = Math.round(nextY)
    if (cx === tx && cy === ty) {
      return { x: nextX, y: nextY, blocked: false }
    }
    const dx = Math.abs(tx - cx)
    const dy = Math.abs(ty - cy)
    const stepX = cx < tx ? 1 : -1
    const stepY = cy < ty ? 1 : -1
    let err = dx - dy
    const n = dx + dy
    for (let i = 0; i < n; i++) {
      const e2 = err * 2
      const moveX = e2 > -dy
      const moveY = e2 < dx
      let stepCX = cx
      let stepCY = cy
      if (moveX && moveY) {
        if (
          this.collisionChecker(cx + stepX, cy) &&
          this.collisionChecker(cx, cy + stepY)
        ) {
          return { x: cx, y: cy, blocked: true }
        }
        stepCX += stepX
        stepCY += stepY
        err -= dy
        err += dx
        i++
      } else if (moveX) {
        stepCX += stepX
        err -= dy
      } else if (moveY) {
        stepCY += stepY
        err += dx
      }
      if (this.collisionChecker(stepCX, stepCY)) {
        return { x: cx, y: cy, blocked: true }
      }
      cx = stepCX
      cy = stepCY
      if (cx === tx && cy === ty) break
    }
    return { x: nextX, y: nextY, blocked: false }
  }

  /**
   * Advance predicted movement and 25Hz (`40ms`) turn transitions (`D2Common.#10603` `0x6FD84D70`,
   * `D2Client` `0x6FACC507`) by `dtMs` milliseconds, whether moving or standing.
   */
  update(dtMs: number): PredictorSnapshot {
    if (!Number.isFinite(dtMs)) {
      throw new RangeError(`dtMs must be a finite number, got ${String(dtMs)}`)
    }
    if (dtMs <= 0) return this.getSnapshot()

    const speed = this.getEffectiveSpeedSubTilesPerSec()
    if (speed <= 0) {
      advanceUnitTurnByDtMs(this.turnState, dtMs)
      return this.getSnapshot()
    }

    let remainingTimeMs = dtMs
    while (remainingTimeMs > 0 && this.waypointIndex < this.waypoints.length) {
      const target = this.waypoints[this.waypointIndex]!
      const dx = target.x - this.logicalX
      const dy = target.y - this.logicalY
      const segDist = Math.hypot(dx, dy)
      const segTimeMs = speed > 0 ? (segDist / speed) * 1000 : 0

      if (remainingTimeMs >= segTimeMs - 1e-4) {
        if (segTimeMs > 0) {
          advanceUnitTurnByDtMs(this.turnState, segTimeMs)
        }
        const clamped = this.clampSegmentAgainstCollision(
          this.logicalX,
          this.logicalY,
          target.x,
          target.y,
        )
        this.logicalX = clamped.x
        this.logicalY = clamped.y
        if (clamped.blocked) {
          this.waypoints = []
          this.waypointIndex = 0
          break
        }
        remainingTimeMs = Math.max(0, remainingTimeMs - segTimeMs)
        this.waypointIndex++
        this.faceCurrentWaypoint()
      } else {
        const ratio = segTimeMs > 0 ? remainingTimeMs / segTimeMs : 0
        const nextX = this.logicalX + dx * ratio
        const nextY = this.logicalY + dy * ratio
        const clamped = this.clampSegmentAgainstCollision(
          this.logicalX,
          this.logicalY,
          nextX,
          nextY,
        )
        this.logicalX = clamped.x
        this.logicalY = clamped.y
        advanceUnitTurnByDtMs(this.turnState, remainingTimeMs)
        remainingTimeMs = 0
        if (clamped.blocked) {
          this.waypoints = []
          this.waypointIndex = 0
          break
        }
      }
    }

    if (this.waypointIndex >= this.waypoints.length) {
      this.waypoints = []
      this.waypointIndex = 0
    }

    if (remainingTimeMs > 0) {
      advanceUnitTurnByDtMs(this.turnState, remainingTimeMs)
    }

    return this.getSnapshot()
  }

  /**
   * D2Client 1.13c position tolerance gate 0x6FADA1B0, for the local player.
   *
   *  1. X or Y of 0 → no check.
   *  2. Client position = the player's integer sub-tile (D2Client 0x6FAB1630 / 0x6FAB1660;
   *     logical N.0 is the centre of sub-tile N, so `Math.round`).
   *  3. Tolerance: 10 for flag 1 (`player-stop`); otherwise the player's mode base — NU 3,
   *     RN 7, anything else (WL, TN, TW, …) 5 — plus `(rttMs + 50) >> 7`.
   *  4. Within tolerance on both axes → no correction.
   *  5. Out of tolerance with flag 0 and target X > 0, where target = position + (vx, vy):
   *     if `d²(client, server) < 100` and `d²(client, target) < d²(client, server)` the client
   *     is ahead along the server's motion → no correction.
   *  6. Otherwise the local player sends C2S `0x5F` with its own position and does not move.
   *
   * Both "no correction" outcomes are the gate's soft branch, which only corrects units that are
   * off screen at both positions (sprite test 0x6FB1E860); the local player is the camera target
   * and always on screen. The hard branch also skips units without a room when the server
   * position has none either (0x6FAB1400 / 0x6FABC2E0); callers handle "no room" before calling.
   * The gate's early exit for dead units is not modelled: D2Game ignores `0x5F` from a dead
   * player (D2MOO `PlrMsg.cpp`, 0x6FC88530).
   */
  verifyServerPosition(check: ServerPositionCheck): ServerPositionVerdict {
    assertSubTile(check.x, 'server x')
    assertSubTile(check.y, 'server y')
    if (!Number.isFinite(check.rttMs) || check.rttMs < 0) {
      throw new RangeError(`rttMs must be a finite non-negative number, got ${String(check.rttMs)}`)
    }
    const { source } = check
    if (source.kind === 'life-mana' && (!Number.isInteger(source.vx) || !Number.isInteger(source.vy))) {
      throw new RangeError(`vx/vy must be integers, got ${String(source.vx)}/${String(source.vy)}`)
    }

    const clientX = Math.round(this.logicalX)
    const clientY = Math.round(this.logicalY)
    if (check.x === 0 || check.y === 0) {
      return { action: 'none', reason: 'no-position', clientX, clientY, threshold: 0 }
    }

    const mode = check.plrMode ?? this.plrMode
    const modeBase =
      mode !== undefined ? this.gateModeBase(mode) : this.gateModeBase(check.inTown)
    const threshold =
      source.kind === 'player-stop'
        ? GATE_FLAG1_THRESHOLD
        : modeBase + ((Math.trunc(check.rttMs) + 50) >>> 7)
    const exceeded =
      Math.abs(check.x - clientX) > threshold || Math.abs(check.y - clientY) > threshold
    if (!exceeded) {
      return { action: 'none', reason: 'within-threshold', clientX, clientY, threshold }
    }

    if (source.kind === 'life-mana') {
      const targetX = (check.x + source.vx) & 0xffff
      const targetY = (check.y + source.vy) & 0xffff
      if (targetX > 0) {
        const toServer = distanceSquared(clientX, clientY, check.x, check.y)
        if (
          toServer < GATE_LEAD_MAX_DIST_SQ &&
          distanceSquared(clientX, clientY, targetX, targetY) < toServer
        ) {
          return { action: 'none', reason: 'leading-server', clientX, clientY, threshold }
        }
      }
    }

    return { action: 'request-resync', reason: 'exceeded', clientX, clientY, threshold }
  }

  getSnapshot(): PredictorSnapshot {
    const currentWaypoint =
      this.waypointIndex < this.waypoints.length ? this.waypoints[this.waypointIndex]! : null
    return {
      logicalX: this.logicalX,
      logicalY: this.logicalY,
      x: this.logicalX,
      y: this.logicalY,
      moving: currentWaypoint !== null,
      running: this.running && !this.staminaExhausted,
      dir64: this.turnState.dir64,
      targetDir64: this.turnState.targetDir64,
      stepDir: this.turnState.stepDir,
      currentWaypoint,
      remainingWaypoints: this.waypoints.slice(this.waypointIndex),
    }
  }

  /**
   * Face the current waypoint (`bInstant = 0`). The engine sets the target facing whenever a unit
   * starts a segment toward its next path point (D2Common 0x6FD5D240 at 0x6FD5D370), and steps
   * `dir64` at 25Hz via #10603 (0x6FD84D70).
   */
  private faceCurrentWaypoint(): void {
    const target = this.waypoints[this.waypointIndex]
    if (target === undefined) return
    targetUnitTurnTowardPoint(
      this.turnState,
      this.logicalX,
      this.logicalY,
      target.x,
      target.y,
      false,
    )
  }

  /**
   * The local player's mode tolerance base for D2Client 0x6FADA1B0:
   *   - PlrMode 1 (NU) -> 3
   *   - PlrMode 3 (RN) -> 7
   *   - All other modes (A1, A2, SC, GH, BL, WL, TN, TW, etc.) -> 5.
   *
   * If a numeric mode is not provided:
   *   - Moving: running -> 7 (RN), walking -> 5 (WL)
   *   - Idle/Standing: inTown -> 5 (TN), outside town -> 3 (NU)
   */
  gateModeBase(modeOrInTown?: number | boolean, inTown = false): number {
    if (typeof modeOrInTown === 'number') {
      if (modeOrInTown === 1) return 3 // PlrMode 1 (NU)
      if (modeOrInTown === 3) return 7 // PlrMode 3 (RN)
      return 5 // All other modes
    }
    const town = typeof modeOrInTown === 'boolean' ? modeOrInTown : inTown
    if (this.waypointIndex < this.waypoints.length) {
      return this.running && !this.staminaExhausted ? 7 : 5
    }
    return town ? 5 : 3
  }
}
