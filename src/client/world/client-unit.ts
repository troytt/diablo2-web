/**
 * Client Unit Mirror (`src/client/world/client-unit.ts`).
 *
 * Represents a single authoritative entity (player, monster, object, missile, item, tile)
 * tracked by `ClientWorld`.
 */

import { SEED_InitSeed, type D2SeedStrc } from '../../common/rng/d2-rng.ts'
import type { Traj3dZ } from './quest-fx-horadric-113c.ts'
import {
  TURN_STEP_TABLE_113C,
  advanceUnitTurnByDtMs,
  advanceUnitTurnByTicks,
  assertDir64,
  createUnitTurnState,
  setUnitTargetDirection,
  snapUnitTurnDirection,
  targetUnitTurnTowardPoint,
  type UnitTurnState,
} from '../../common/units/direction.ts'
import { resolveMonsterUModIds } from '../../common/units/monster-death-fx.ts'
import {
  getLocalizedNpcName,
  getTownNpcDescriptorByHcIdx,
  isTownNpcHcIdx,
} from '../../common/units/npc-table.ts'
import {
  CANONICAL_113C_OBJECTS,
  getObjectHitBox113c,
  type CanonicalObjectMeta,
} from '../../common/world/objects-meta.ts'
import { resolveLvlWarpBounds } from '../../common/world/level-warps-meta.ts'
import {
  unitTypeFromId,
  type ItemData,
  type Pt,
  type ServerEvent,
  type UnitRef,
  type UnitSnapshot,
  type UnitType,
  type UnitTypeName,
} from '../../netproto/index.ts'
import {
  NO_GFX_HIT_BOXES_113C,
  type NoGfxHitBox113c,
} from '../input/generated/input-tables-113c.ts'
import type { ObjectAnim113c, ObjectLight113c } from './object-light.ts'
import { StatList } from './stat-list.ts'
import { UnitStateSet } from './states.ts'

const NO_GFX_HIT_BOX_BY_CLASS_ID_113C: ReadonlyMap<number, NoGfxHitBox113c> = new Map(
  NO_GFX_HIT_BOXES_113C,
)

export interface ClientUnitOverlay {
  readonly overlayId: number
  readonly token: string
  frame: number
  readonly totalFrames: number
  readonly animRate: number
  readonly loop: boolean
  /** Overlay.txt `Trans` draw level (mapped to a drawable blend by `overlayTransToBlendMode`). */
  readonly blendMode: number
  readonly xOffset?: number | undefined
  readonly yOffset: number
  readonly preDraw?: boolean | undefined
  readonly startedAtMs: number
  ageTicks: number
  readonly maxTicks: number
  readonly lightRadius: number
  readonly lightColor: readonly [number, number, number]
  /**
   * 1.13c overlay completion chain (D2Client overlay update `0x6FB1C1D7` completion switch): when this
   * one-shot overlay finishes, it is removed and these Overlay.txt rows are created in its place (type 4
   * "cast → follow-ups" and type 7 "delay → cast" overlays, e.g. Bone Armor `0x6FB23230`).
   */
  readonly onExpire?: readonly ClientUnitOverlayChainStep[] | undefined
  /**
   * Set on a States.txt `castoverlay` played by the state-on routine (D2Client `0x6FB22C80`): while it lives the
   * state's overlay1/2 loop is held back (LOOPEX/AURAEX hand-over), and StateEnd removes it (Issue #1063).
   */
  readonly castForStateId?: number | undefined
}

/** One overlay created when a chained overlay completes (see {@link ClientUnitOverlay.onExpire}). */
export interface ClientUnitOverlayChainStep {
  /** Overlay.txt row index. */
  readonly overlayIndex: number
  readonly loop: boolean
  readonly onExpire?: readonly ClientUnitOverlayChainStep[] | undefined
}

export interface UnitCastState {
  readonly skillId: number
  targetX: number
  targetY: number
  readonly mode: number
  startedAtMs: number
  untilMs: number
  readonly castOverlayToken?: string | undefined
  durationMs?: number | undefined
  elapsedMs?: number | undefined
  readonly stepSpeed256?: number | undefined
  readonly frames?: number | undefined
  readonly baseSpeed?: number | undefined
  readonly effRate?: number | undefined
  /**
   * Action-frame scheduling (1.13c AnimData frame events): when set, the cast's
   * missiles must not spawn at cast start but once the animation reaches its
   * first event frame. `missileSpawned` latches the one-shot trigger.
   */
  missileFireDelayMs?: number | undefined
  missileSkillLevel?: number | undefined
  missileSpawned?: boolean | undefined
  secondMissileFireDelayMs?: number | undefined
  secondMissileSpawned?: boolean | undefined
  /**
   * 1.13c Strafe (#26, CltSt13 / CltDo20) sequence event-frame volley state:
   * emits 1 arrow/bolt per event frame until `strafeShotsFired === strafeTotalShots`.
   */
  strafeTotalShots?: number | undefined
  strafeShotsFired?: number | undefined
  strafeIntervalTicks?: number | undefined
  strafeNextShotTick?: number | undefined
  strafeTargetX?: number | undefined
  strafeTargetY?: number | undefined
  strafeSkillLevel?: number | undefined
  /**
   * 1.13c Whirlwind (#151, CltDoFunc 45 `0x6FB764B0` / `PLR_SEQUENCE_TABLE_113C[10]` `0x6FDEBE20`):
   * initial facing direction when Whirlwind starts (`whirlwindBaseDir64`), stepped at 25Hz across
   * the spinning sequence frames `3..7`.
   */
  whirlwindBaseDir64?: number | undefined
  /**
   * 1.13c Leap (#132, CltDoFunc 46 `0x6FB765B0`) & Leap Attack (#143, CltDoFunc 47 `0x6FB76AA0`)
   * 3D parabolic vertical trajectory state (`D2LeapSetupTableStrc` at `0x6FB85F54`,
   * `UNIT_SetTrajectoryTargetZ` `0x6FB77C80`, `UNIT_Step3DTrajectory` `0x6FB77FB0`).
   */
  leapStartX?: number | undefined
  leapStartY?: number | undefined
  leapTotalDist?: number | undefined
  leapSizeIdx?: number | undefined
  leapVelMag?: number | undefined
  leapPeakZ?: number | undefined
  leapTotalTicks?: number | undefined
  leapTick?: number | undefined
  leapPosZ?: number | undefined
  leapVelZ?: number | undefined
  leapAccelZ?: number | undefined
  /**
   * 1.13c Paladin Charge (#107, CltSt25 `0x6FADBF40` / CltDo37 `0x6FADB6E0` & SrvSt31 `0x6FCB9620` / SrvDo67 `0x6FCB9D20`):
   * dwVelocity / 4096 sub-tiles/tick step speed, or in-place melee attack flag when target is already within melee range.
   */
  chargeStepSpeed?: number | undefined
  chargeVelocity?: number | undefined
  chargeInPlaceAttack?: boolean | undefined
}

export function makeUnitKey(unitType: UnitType, id: number): string {
  return `${unitTypeFromId(unitType)}:${id}`
}

export class ClientUnit {
  readonly key: string
  readonly unitType: UnitTypeName
  readonly id: number
  classId: number
  isNpc: boolean
  name?: string | undefined
  nameZh?: string | undefined
  itemCode?: string | undefined
  itemQuality?: number | undefined
  itemColor?: string | undefined
  goldAmount?: number | undefined
  flippyFile?: string | undefined
  invFile?: string | undefined
  invtransform?: string | undefined
  x: number
  y: number
  targetX?: number | undefined
  targetY?: number | undefined
  targetUnit?: UnitRef | undefined
  moveMode?: 'walk' | 'run' | 'knockback' | 'stop' | undefined
  velocityPercent?: number | undefined
  pathType?: number | undefined
  mode: number
  private readonly _turnState: UnitTurnState

  get direction(): number {
    return this._turnState.dir64
  }

  set direction(v: number) {
    this.setDirection(v)
  }

  get targetDirection(): number {
    return this._turnState.targetDir64
  }

  set targetDirection(v: number) {
    this.setTargetDirection(v)
  }

  get turnState(): Readonly<UnitTurnState> {
    return { ...this._turnState }
  }
  lifePct: number
  hitClass?: number | undefined
  hidden: boolean = false
  flags: number
  warpId?: number | undefined
  objectState?: number | undefined
  interactType?: number | undefined
  isChampion?: boolean | undefined
  isUnique?: boolean | undefined
  isSuperUnique?: boolean | undefined
  isMinion?: boolean | undefined
  superUniqueId?: number | undefined
  bossMods?: readonly number[] | undefined
  monUMods?: readonly (number | string)[] | undefined
  aip1?: number | undefined
  corpseSuppressed?: boolean | undefined
  deathFxTriggered?: boolean | undefined
  diedAtMs?: number | undefined
  tempSummonExpireTick?: number | undefined
  nameSeed?: number | undefined
  compVariants?: readonly number[] | undefined
  ownerType?: UnitTypeName | undefined
  ownerId?: number | undefined
  overheadText?: string | undefined
  /** 1.13c `0x6fb2b4f2` (`CMP EDX, 0x2710`): world clock ms when unit overhead speech expires (createdAt + 10000 ms). */
  overheadExpireMs?: number | undefined
  /** Optional 1.13c color index (`0..12`) for unit overhead speech. */
  overheadColor?: number | undefined
  itemData?: ItemData | undefined
  castState?: UnitCastState | undefined
  lastSkillId?: number | undefined
  overlays: ClientUnitOverlay[] = []
  wantsInteract?: boolean | undefined
  // Missile simulation fields (populated when unitType === 'missile')
  missileKey?: string | undefined
  vx?: number | undefined
  vy?: number | undefined
  accel?: number | undefined
  ageTicks?: number | undefined
  maxTicks?: number | undefined
  frame?: number | undefined
  initialFrame?: number | undefined
  totalFrames?: number | undefined
  animSpeed?: number | undefined
  loopAnim?: boolean | undefined
  subLoop?: number | undefined
  subStart?: number | undefined
  subStop?: number | undefined
  subLoops?: number | undefined
  numDirections?: number | undefined
  explosionMissile?: string | undefined
  alwaysExplode?: boolean | undefined
  pierce?: boolean | undefined
  canPierce?: boolean | undefined
  pierceRemaining?: number | undefined
  pierceCount?: number | undefined
  hitUnitIds?: Set<number> | undefined
  piercedTargets?: Set<number> | undefined
  altitude?: number | undefined
  verticalDescentPerTick?: number | undefined
  /**
   * z axis of the D2Client 3D trajectory record (gfx+0x30) when a CltDoFunc set it explicitly; stepped by
   * `stepTraj3dZ` (0x6fb77fb0) and drawn as `altitude = z >> 11`. Generic altitude rules skip such missiles.
   */
  traj3d?: Traj3dZ | undefined
  /**
   * Missile data `+0x28` ("TargetX", D2Common #10637 set / #11018 get) when a CltDoFunc uses it as a frame
   * countdown (MissCltDoFunc 21 `brdeathcontrol`, 26 `mephistodeathcontrol`, 61 `overseercontrol`), or as a count
   * (MissCltHitFunc 33 `mephistoflyingrocksbig`: number of CltHitSubMissile1 bursts).
   */
  cltCountdown?: number | undefined
  /** Missile data "TargetY" (#10019 set / 0x6fabc4ba get) used as MissCltDoFunc 26's second countdown. */
  cltCountdownY?: number | undefined
  /**
   * The missile's path direction was pinned (PATH_SetDirection #10706 + #10520 rotate flag 0): render with
   * `direction` instead of the velocity / target heading.
   */
  fixedDirection?: boolean | undefined
  cairnPrevStoneId?: number | undefined
  missileSeed?: { lo: number; hi: number } | undefined
  /** `cursecenter` (#191) data set by SKILLS_CltDo30_Curse (0x6fabcc76 / 0x6fabcc7c): wCltMissileA key + nVisualRadius. */
  curseSubMissileKey?: string | undefined
  curseVisualRadius?: number | undefined
  /**
   * Radius of an immediate SetRadius on the missile's light right after its CreateLight (the meteor-centre client hit
   * sets 12 on its light missile, 0x6fb66702); absent → Missiles.txt `Light`.
   */
  missileLightRadius?: number | undefined
  /** Missile created with param flag 0x4000: 0x6FB630F0 skips its CreateLight (0x6FB6365B). */
  missileNoLight?: boolean | undefined
  originX?: number | undefined
  originY?: number | undefined
  spiralAngle?: number | undefined
  spiralRadius?: number | undefined
  jitterIndex?: number | undefined
  /**
   * 1.13c SKILLS_CltDo18 (D2Client 0x6FAC5C40) tracking target: set (mode 1) when the caster had a target
   * unit; MISSMODE_CltDo07 (0x6FB62EB0) re-paths toward it. Absent for a ground cast (mode 2, no client homing).
   */
  homingTarget?: UnitRef | undefined
  pathWaypoints?: readonly { readonly x: number; readonly y: number }[] | undefined
  pathWaypointIndex?: number | undefined
  emitterKind?: 'frozenorb' | 'meteor_controller' | 'blizzard_controller' | undefined
  subMissileIdx?: number | undefined
  startedAtMs?: number | undefined
  startedAtTick?: number | undefined
  sourceSkillId?: number | undefined
  skillLevel?: number | undefined
  lastBlazeX?: number | undefined
  lastBlazeY?: number | undefined
  blazeUntilTick?: number | undefined
  blazeSkillLevel?: number | undefined
  armageddonUntilTick?: number | undefined
  armageddonSkillLevel?: number | undefined
  hurricaneUntilTick?: number | undefined
  hurricaneSkillLevel?: number | undefined
  /**
   * Client-predicted timed states (stateId -> frameCount at which it ends). Only states the client set itself
   * live here; a server 0xA8 / 0xA9 for the same state drops the entry (server owns the lifetime).
   */
  predictedStateUntilTick?: Map<number, number> | undefined
  modeStartedAtMs?: number | undefined
  animStartedAtMs?: number | undefined
  modeUntilMs?: number | undefined
  modeDurationMs?: number | undefined
  modeElapsedMs?: number | undefined
  animStepSpeed256?: number | undefined
  animEffRate?: number | undefined
  lastSoundTick?: number | undefined
  initSoundPlayed?: boolean | undefined
  /** Objects: unit `+0x70`/`+0x74` of D2Client 0x6fad37e0 — last mode the object sound handler saw. */
  objectSoundMode?: number | undefined
  /** Objects: unit `+0x78` active looping mode-bound sound ID (0x6fad37e0 / 0x6fad3070, #998). */
  objectLoopSoundId?: number | undefined
  /**
   * 1.13c `pUnit->pSeed` (`+0x20`, `{ dwLowSeed, dwHighSeed }`) and `pUnit->dwInitSeed` (`+0x1c`).
   * Allocated at `{ lo: 1, hi: 666 }` via `SEED_InitSeed` (`0x6fd85e10` -> `0x6fd51010`), then
   * re-seeded from the active client room (`pRoom1->pSeed` `[+0x6c, +0x70]`) via `SEED_InitLowSeed`
   * in `0x6fb57400` / `0x6fb57630` / `0x6fb57780`.
   */
  readonly seed: D2SeedStrc = { lo: 1, hi: 666 }
  initSeed = 1
  /**
   * 1.13c `pUnit+0xd8`: per-unit FIFO packet queue (`0x6fb5c630` enqueue on `S2C 0x0E`,
   * `0x6fb5bc20` -> `0x6fb5f560` -> `0x6fada750` -> `0x6fad5ce0` -> `0x6fad59f0` drain at the end
   * of the unit's 25 Hz tick `0x6fadb1e0`).
   */
  readonly queuedPackets: Array<Extract<ServerEvent, { readonly type: 'UnitMode' }>> = []
  /**
   * Objects: unit+0x64, the type-2 light owned by the object. Only SetObjectLight 0x6fad4920
   * (`world/object-light.ts`) writes it; a unit removal drops it with the unit. `null` = no light.
   */
  objectLight: ObjectLight113c | null = null
  /** Objects: animation frame (unit+0x44, 8.8) and speed (unit+0x4C) as D2Common #10595 sets them. */
  objectAnim?: ObjectAnim113c | undefined
  readonly stats = new StatList()
  readonly states = new UnitStateSet()

  get objectMeta(): CanonicalObjectMeta | undefined {
    return this.unitType === 'object' ? CANONICAL_113C_OBJECTS[this.classId] : undefined
  }

  constructor(snapshot: UnitSnapshot) {
    SEED_InitSeed(this.seed)
    this.unitType = unitTypeFromId(snapshot.unitType)
    this.id = snapshot.id
    this.key = `${this.unitType}:${this.id}`
    this.classId = snapshot.classId >= 0 ? snapshot.classId : 0
    this.isNpc = this.unitType === 'monster' && isTownNpcHcIdx(this.classId)
    const npcDesc = this.isNpc ? getTownNpcDescriptorByHcIdx(this.classId) : undefined
    this.name =
      snapshot.name && snapshot.name.length > 0
        ? snapshot.name
        : (npcDesc?.displayName ?? snapshot.name)
    if (npcDesc && !this.nameZh) {
      this.nameZh = getLocalizedNpcName(npcDesc, 'CHI')
    }
    this.x = snapshot.x
    this.y = snapshot.y
    this.lifePct = snapshot.lifePct ?? 128
    const defaultMode =
      this.unitType === 'monster'
        ? this.lifePct <= 0
          ? 12
          : 1
        : this.unitType === 'player'
          ? 1
          : 0
    this.mode = snapshot.mode ?? defaultMode
    const initialDir = snapshot.direction ?? 0
    this._turnState = createUnitTurnState(initialDir)
    this.flags = snapshot.flags ?? 0
    this.hidden = Boolean(snapshot.hidden)
    this.warpId = snapshot.warpId ?? (this.unitType === 'tile' ? this.classId : undefined)
    this.objectState = snapshot.objectState
    this.interactType = snapshot.interactType
    this.isChampion = snapshot.isChampion ?? ((this.flags & 0x04) !== 0 ? true : undefined)
    this.isUnique = snapshot.isUnique ?? ((this.flags & 0x08) !== 0 ? true : undefined)
    this.isSuperUnique = snapshot.isSuperUnique ?? ((this.flags & 0x02) !== 0 ? true : undefined)
    this.isMinion = snapshot.isMinion ?? ((this.flags & 0x10) !== 0 ? true : undefined)
    this.superUniqueId = snapshot.superUniqueId
    this.bossMods = snapshot.bossMods
    if (snapshot.monUMods !== undefined) {
      this.monUMods = snapshot.monUMods
      if (!this.bossMods) {
        this.bossMods = Array.from(resolveMonsterUModIds(snapshot.monUMods))
      }
    }
    const snapAip1 = (snapshot as { aip1?: unknown }).aip1
    if (typeof snapAip1 === 'number') {
      this.aip1 = snapAip1
    }
    this.tempSummonExpireTick = snapshot.tempSummonExpireTick
    this.nameSeed = snapshot.nameSeed
    this.compVariants = snapshot.compVariants
    this.ownerType = snapshot.ownerType !== undefined ? unitTypeFromId(snapshot.ownerType) : undefined
    this.ownerId = snapshot.ownerId
    if (snapshot.states) {
      this.states.replaceAll(snapshot.states)
    }
  }

  get kind(): UnitTypeName {
    return this.unitType
  }

  get dir(): number {
    return this.direction
  }

  set dir(v: number) {
    this.setDirection(v)
  }

  get turnStepDir(): number {
    return this._turnState.stepDir
  }

  get quality(): number | undefined {
    return this.itemQuality
  }

  set quality(v: number | undefined) {
    this.itemQuality = v
  }

  /**
   * Snap both `direction` and `targetDirection` immediately (`bInstant = 1`).
   */
  setDirection(dir64: number): void {
    snapUnitTurnDirection(this._turnState, dir64)
  }

  /**
   * Set `targetDirection` (`bInstant = 0` by default, or `bInstant = 1` when `instant = true`).
   */
  setTargetDirection(targetDir64: number, instant = false): void {
    setUnitTargetDirection(this._turnState, targetDir64, instant)
  }

  /**
   * Turn toward `(targetX, targetY)` (`bInstant = 0` by default).
   */
  faceToward(targetX: number, targetY: number, instant = false): number {
    targetUnitTurnTowardPoint(this._turnState, this.x, this.y, targetX, targetY, instant)
    return this._turnState.targetDir64
  }

  /**
   * Advance the 25Hz (`40ms`) turn accumulator by `dtMs` milliseconds (`D2Common.#10603`).
   */
  advanceTurn(dtMs: number): number {
    advanceUnitTurnByDtMs(this._turnState, dtMs)
    return this._turnState.dir64
  }

  advanceTurnByDtMs(dtMs: number): number {
    return this.advanceTurn(dtMs)
  }

  /**
   * Advance the unit turn state by one 25Hz tick (`D2Common.#10603`).
   */
  stepTurnTick(): number {
    return this.stepTurnTicks(1)
  }

  /**
   * Advance the unit turn state by `ticks` 25Hz ticks (`D2Common.#10603`).
   */
  stepTurnTicks(ticks = 1): number {
    advanceUnitTurnByTicks(this._turnState, ticks)
    return this._turnState.dir64
  }

  /**
   * Synchronize `direction` and `targetDirection` from external motion state (`RemoteEntityInterpolator` / `LocalMovementPredictor`).
   */
  syncTurnState(dir64: number, targetDir64: number, stepDir?: number): void {
    assertDir64(dir64, 'dir64')
    assertDir64(targetDir64, 'targetDir64')
    if (
      stepDir !== undefined &&
      (!Number.isInteger(stepDir) ||
        (stepDir !== 0 &&
          stepDir !== 1 &&
          stepDir !== -1 &&
          stepDir !== 4 &&
          stepDir !== -4 &&
          stepDir !== 8 &&
          stepDir !== -8))
    ) {
      throw new RangeError(
        `stepDir must be a valid 1.13c turn step (0, ±1, ±4, ±8), got ${String(stepDir)}`,
      )
    }
    if (dir64 === targetDir64) {
      this._turnState.stepDir = 0
      this._turnState.turnTickRemainderMs = 0
    } else if (stepDir !== undefined && stepDir !== 0) {
      this._turnState.stepDir = stepDir
    } else if (this._turnState.targetDir64 !== targetDir64 || this._turnState.stepDir === 0) {
      this._turnState.stepDir = TURN_STEP_TABLE_113C[(targetDir64 - dir64) & 0x3f]!
    }
    this._turnState.dir64 = dir64
    this._turnState.targetDir64 = targetDir64
  }

  updateFromSnapshot(snapshot: UnitSnapshot): void {
    if (snapshot.classId >= 0) {
      this.classId = snapshot.classId
      this.isNpc = this.unitType === 'monster' && isTownNpcHcIdx(this.classId)
      if (this.isNpc && (!this.name || !this.nameZh)) {
        const npcDesc = getTownNpcDescriptorByHcIdx(this.classId)
        if (npcDesc) {
          if (!this.name) this.name = npcDesc.displayName
          if (!this.nameZh) this.nameZh = getLocalizedNpcName(npcDesc, 'CHI')
        }
      }
    }
    if (snapshot.name !== undefined && snapshot.name.length > 0) {
      this.name = snapshot.name
    }
    if (snapshot.x !== 0 || snapshot.y !== 0) {
      this.x = snapshot.x
      this.y = snapshot.y
    }
    if (snapshot.mode !== undefined) {
      this.mode = snapshot.mode
    }
    if (snapshot.direction !== undefined) {
      this.setDirection(snapshot.direction)
    }
    if (snapshot.lifePct !== undefined) {
      this.lifePct = snapshot.lifePct
      if (snapshot.mode === undefined && this.unitType === 'monster') {
        if (this.lifePct <= 0) {
          this.mode = 12
        } else if (this.mode === 0 || this.mode === 12) {
          this.mode = 1
        }
      }
    }
    if (snapshot.flags !== undefined) {
      this.flags = snapshot.flags
      if ((snapshot.flags & 0x04) !== 0) this.isChampion = true
      if ((snapshot.flags & 0x08) !== 0) this.isUnique = true
      if ((snapshot.flags & 0x02) !== 0) this.isSuperUnique = true
      if ((snapshot.flags & 0x10) !== 0) this.isMinion = true
    }
    if (snapshot.isMinion !== undefined) {
      this.isMinion = snapshot.isMinion
    }
    if (snapshot.warpId !== undefined) {
      this.warpId = snapshot.warpId
    } else if (this.unitType === 'tile' && this.warpId === undefined && this.classId >= 0) {
      this.warpId = this.classId
    }
    if (snapshot.objectState !== undefined) {
      this.objectState = snapshot.objectState
    }
    if (snapshot.interactType !== undefined) {
      this.interactType = snapshot.interactType
    }
    if (snapshot.hidden !== undefined) {
      this.hidden = snapshot.hidden
    }
    if (snapshot.isChampion !== undefined) {
      this.isChampion = snapshot.isChampion
    }
    if (snapshot.isUnique !== undefined) {
      this.isUnique = snapshot.isUnique
    }
    if (snapshot.isSuperUnique !== undefined) {
      this.isSuperUnique = snapshot.isSuperUnique
    }
    if (snapshot.superUniqueId !== undefined) {
      this.superUniqueId = snapshot.superUniqueId
    }
    if (snapshot.bossMods !== undefined) {
      this.bossMods = snapshot.bossMods
    }
    if (snapshot.monUMods !== undefined) {
      this.monUMods = snapshot.monUMods
      if (snapshot.bossMods === undefined) {
        this.bossMods = Array.from(resolveMonsterUModIds(snapshot.monUMods))
      }
    }
    const snapAip1 = (snapshot as { aip1?: unknown }).aip1
    if (typeof snapAip1 === 'number') {
      this.aip1 = snapAip1
    }
    if (snapshot.tempSummonExpireTick !== undefined) {
      this.tempSummonExpireTick = snapshot.tempSummonExpireTick
    }
    if (snapshot.nameSeed !== undefined) {
      this.nameSeed = snapshot.nameSeed
    }
    if (snapshot.compVariants !== undefined) {
      this.compVariants = snapshot.compVariants
    }
    if (snapshot.ownerType !== undefined) {
      this.ownerType = unitTypeFromId(snapshot.ownerType)
    }
    if (snapshot.ownerId !== undefined) {
      this.ownerId = snapshot.ownerId
    }
    if (snapshot.states !== undefined) {
      this.states.replaceAll(snapshot.states)
    }
    if (this.dead) {
      this.moveMode = 'stop'
      this.targetX = this.x
      this.targetY = this.y
      this.setDirection(this.direction)
    }
  }

  applyMove(
    mode: 'walk' | 'run' | 'knockback' | 'stop',
    to: Pt,
    from?: Pt,
    target?: UnitRef,
  ): void {
    if (this.dead) return
    if (from && (from.x !== 0 || from.y !== 0)) {
      this.x = from.x
      this.y = from.y
    }
    if (to.x !== 0 || to.y !== 0) {
      if (mode !== 'stop' || Math.hypot(to.x - this.x, to.y - this.y) > 0.15) {
        this.faceToward(to.x, to.y, false)
      }
    }
    this.moveMode = mode
    if (!this.dead && (this.unitType === 'monster' || this.unitType === 'player')) {
      if (mode === 'stop') {
        this.mode = 1
      } else if (mode === 'run') {
        this.mode = this.unitType === 'monster' ? 15 : 3
      } else if (mode === 'knockback') {
        this.mode = this.unitType === 'monster' ? 13 : 19
      } else {
        this.mode = 2
      }
    }
    this.targetX = to.x
    this.targetY = to.y
    this.targetUnit = target
    if (to.x !== 0 || to.y !== 0) {
      this.x = to.x
      this.y = to.y
    }
  }

  hitBox?: { left: number; top: number; width: number; height: number } | undefined

  getHitBox(): { left: number; top: number; width: number; height: number } {
    if (this.hitBox) return this.hitBox
    switch (this.unitType) {
      case 'monster': {
        const noGfxBox = NO_GFX_HIT_BOX_BY_CLASS_ID_113C.get(this.classId)
        if (noGfxBox !== undefined) {
          return {
            left: noGfxBox.left,
            top: noGfxBox.top,
            width: noGfxBox.width,
            height: noGfxBox.height,
          }
        }
        return { left: -24, top: -64, width: 48, height: 72 }
      }
      case 'player':
        return { left: -24, top: -64, width: 48, height: 72 }
      case 'object': {
        return getObjectHitBox113c(this.classId, this.mode)
      }
      case 'tile': {
        // 1.13c D2Client 0x6fb56a77..0x6fb56ae5 (D2Common.#10628):
        // UNIT_TILE (5) hit-testing uses LvlWarp.txt SelectX/SelectY/SelectDX/SelectDY.
        const warpId = this.warpId ?? this.classId
        if (typeof warpId === 'number' && warpId >= 0) {
          const bounds = resolveLvlWarpBounds(warpId)
          if (bounds.selectDX > 0 && bounds.selectDY > 0) {
            return {
              left: bounds.selectX,
              top: bounds.selectY,
              width: bounds.selectDX,
              height: bounds.selectDY,
            }
          }
        }
        return { left: -32, top: -32, width: 64, height: 48 }
      }
      case 'item':
        return { left: -16, top: -16, width: 32, height: 24 }
      default:
        return { left: -24, top: -48, width: 48, height: 48 }
    }
  }

  get dead(): boolean {
    if (this.unitType === 'monster') {
      return this.lifePct <= 0 || this.mode === 0 || this.mode === 12
    }
    if (this.unitType === 'player') {
      // D2Client.dll 0x6fb55440 (UNIT_IsDead): UNIT_PLAYER (0) is dead only in PLRMODE_DEATH (0) or PLRMODE_DEAD (17)
      // (or UNITFLAG_DEAD 0x10000, set exclusively by 0x0D codes 0x08/0x09 in 0x6fac9830), never from lifePct <= 0.
      return this.mode === 0 || this.mode === 17
    }
    return false
  }

  set dead(v: boolean) {
    if (v) {
      this.lifePct = 0
      if (this.unitType === 'monster' && this.mode !== 0 && this.mode !== 12) {
        this.mode = 12
      } else if (this.unitType === 'player' && this.mode !== 0 && this.mode !== 17) {
        this.mode = 17
      }
      this.moveMode = 'stop'
      this.targetX = this.x
      this.targetY = this.y
      this.setDirection(this.direction)
    } else {
      if (this.lifePct <= 0) {
        this.lifePct = 128
      }
      if (this.unitType === 'monster' && (this.mode === 0 || this.mode === 12)) {
        this.mode = 1
      } else if (this.unitType === 'player' && (this.mode === 0 || this.mode === 17)) {
        this.mode = 1
      }
    }
  }

  get moving(): boolean {
    if (this.dead) return false
    if (this.moveMode && this.moveMode !== 'stop') return true
    if (this.targetX !== undefined && this.targetY !== undefined) {
      return Math.hypot(this.targetX - this.x, this.targetY - this.y) > 1e-4
    }
    return false
  }

  set moving(v: boolean) {
    if (!v) {
      this.moveMode = 'stop'
      this.targetX = this.x
      this.targetY = this.y
    } else if (!this.moveMode || this.moveMode === 'stop') {
      this.moveMode = 'walk'
    }
  }

  get lifePercent(): number {
    return Math.max(0, Math.min(100, Math.round((this.lifePct / 128) * 100)))
  }
}
