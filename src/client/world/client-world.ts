/**
 * Headless ClientWorld Authoritative Server Mirror (`src/client/world/client-world.ts`, Feature F9).
 *
 * Consumes protocol-neutral `ServerEvent`s and maintains a zero-DOM, deterministic
 * mirror of the server world state (act, mapSeed, difficulty, areaId, self player,
 * units, item containers, revealed rooms, waypoints, quests, party, trade, chat).
 */

import {
  unitTypeFromId,
  type ClientCommand,
  type ItemData,
  type ItemStat,
  type ServerEvent,
  type UnitRef,
  type UnitType,
} from '../../netproto/index.ts'
import { type CharsiImbueOptions } from '../../common/items/item-bridge.ts'
import { computeSetBonusStats, resolveSetItemIdByCodeOrName } from '../ui-model/set-bonuses.ts'
import {
  isInMeleeRange113c,
  isMeleeSkill113c,
  resolveEquippedWeaponRangeAdder,
} from '../../common/skills/weapon-combat-meta.ts'
import {
  CHAR_ANIM_CLIPS_113C,
  computeActionFrameTicks,
  computeAnimFrameIndex,
  computeDiminishingRate113c,
  computeEffectiveFcr,
  computeEffectiveFhr,
  computeEffectiveIas,
  computeOneShotDurationMs,
  computeOneShotTicks,
  computeSequenceDurationMs,
  computeSequenceTicks,
  computeStepSpeed256,
  getCharAnimClip113c,
  MORPH_ANIM_CLIPS_113C,
  resolveArmorSpeed113c,
  resolveCharacterAnimSpeedParams,
  resolveCharacterStatTotal,
  resolveEquippedWeaponClass,
  resolveEquippedWeaponWsm,
  resolveWeaponWsm,
  STAT_FASTERATTACKRATE,
  STAT_FASTERBLOCKRATE,
  STAT_FASTERCASTRATE,
  STAT_FASTERHITRECOVERY,
  STAT_FASTERMOVEVELOCITY,
  STAT_LIGHTCOLOR,
  STAT_LIGHTRADIUS,
  STAT_SKILL_IAS,
  STAT_VELOCITYPERCENT,
  type CharacterAnimSpeedParams,
} from '../../common/units/char-anim-speed.ts'
import { getMonsterSizeXByHcIdx } from '../../common/units/monster-mapping.ts'
import {
  MONMODE_DEAD,
  MONMODE_DEATH,
  MONMODE_KNOCKBACK,
  MONMODE_RUN,
  PATH_AllocDynamicPath,
  PATH_SetPrecisionX,
  PATH_SetPrecisionY,
  PATH_UpdateClientCoords,
  UNIT_PLAYER,
  getMonsterModeBaseAnimSpeed256,
  getMonsterModeBaseFrameCount113c,
  type PathUnit,
} from '../../common/path/index.ts'
import { NpcMotion, type NpcMotionUnit } from '../motion/npc-motion.ts'
import { isTownLevel } from '../../common/world/scene-population.ts'
import { CANONICAL_113C_OBJECTS, getNpcPlaceholderHcIdx } from '../../common/world/objects-meta.ts'
import {
  ClientUnit,
  makeUnitKey,
  type ClientUnitOverlay,
} from './client-unit.ts'
import { ClientInventoryManager, type ClientItemContainers } from './inventory.ts'
import { MutableSelfPlayerState, type SelfPlayerState } from './self.ts'
import { QuestLogState } from './quest-log-state.ts'
import { SKILLS_BY_ID } from '../../common/data/skills-catalog.ts'
import {
  SEED_InitLowSeed,
  SEED_InitSeed,
  SEED_RollRandomNumber,
  type D2SeedStrc,
} from '../../common/rng/d2-rng.ts'
import { LIGHT_SEED_HI, type D2Seed } from '../../common/drlg/light-grid.ts'
import { type HoradricStaffSpawn } from './quest-fx-horadric-113c.ts'
import { getTblLang } from '../i18n/lang.ts'
import { type WorldSoundRequest } from '../audio/d2gs-play-sound-113c.ts'

import {
  UnitMap,
  getMonsterOneShotDefaultFrames,
  isMonsterOneShotMode,
  type ChatLogEntry,
  type ClientWorldInternal,
  type MercHireEntry,
  type MercenaryState,
  type NpcInteractionState,
  type NpcTransactionRecord,
  type PartyMemberState,
  type PortalState,
  type RosterPetState,
  type ScreenShakeState,
  type SpawnMissileOptions,
  type TradeSessionState,
} from './world-skill-state-tables.ts'
import {
  spawnCairnSkyBoltImpl,
  spawnCairnStonesControllerImpl,
  spawnCompellingOrbMistImpl,
  spawnDenOfEvilLightsInRoomImpl,
  spawnDiabloAppearsControllerImpl,
  spawnHoradricStaffAtOrificeImpl,
  spawnHoradricStaffChildImpl,
  startScreenShakeImpl,
  triggerMonsterDeathFxImpl,
  triggerMonsterGetHitFxImpl,
  updateScreenShakeImpl,
} from './world-quest-fx.ts'
import {
  applySkillCastToUnitImpl,
  attachServerOverlayImpl,
  attachUnitOverlayImpl,
  emitMissileImpactSoundImpl,
  emitMissileSpawnSoundImpl,
  emitMonsterModeSoundImpl,
  emitSkillCastSoundImpl,
  emitSkillKeyframeSoundImpl,
  emitUnitDeathSoundImpl,
  findHostileMeleeTargetMonster113c,
  isCrossbowEquippedImpl,
  pushSoundRequestImpl,
  removePaladinAuraStatesAndOverlaysImpl,
  resolveCastActionFrameDelayMsImpl,
  resolveRangedAttackMissileKey113c,
  resolveThrowMissileKeyForCasterImpl,
  spawnMissileByKeyImpl,
  spawnMissilesForSkillImpl,
  spawnMonsterModeMissileImpl,
  syncSelfRightHandAuraStateImpl,
} from './world-skill-missiles.ts'
import {
  addLocalSystemMessageImpl,
  expireChatAndOverheadImpl,
  isPlayerIgnoredImpl,
  isPlayerSquelchedImpl,
  setPlayerIgnoredImpl,
  setPlayerSquelchedImpl,
} from './world-chat-social.ts'
import {
  expireCastStatesImpl,
  isFriendlyOrNonHostileMonsterImpl,
  stepDiscreteSimulationTickImpl,
  stepMissileUnitImpl,
  syncPlayerTownModesImpl,
  tickWorldImpl,
  triggerMissileImpactImpl,
} from './world-missile-stepper.ts'
import {
  applyUnitModeImmediateImpl,
  applyWorldEventImpl,
  executeCharsiImbueImpl,
  noteOutgoingCommandImpl,
} from './world-event-applier.ts'

export * from './world-skill-state-tables.ts'
export { findHostileMeleeTargetMonster113c, resolveRangedAttackMissileKey113c }
export type { WorldSoundRequest }

export {
  CHAR_ANIM_CLIPS_113C,
  computeActionFrameTicks,
  computeAnimFrameIndex,
  computeDiminishingRate113c,
  computeEffectiveFcr,
  computeEffectiveFhr,
  computeEffectiveIas,
  computeOneShotDurationMs,
  computeOneShotTicks,
  computeSequenceDurationMs,
  computeSequenceTicks,
  computeStepSpeed256,
  getCharAnimClip113c,
  MORPH_ANIM_CLIPS_113C,
  resolveArmorSpeed113c,
  resolveCharacterAnimSpeedParams,
  resolveCharacterStatTotal,
  resolveEquippedWeaponClass,
  resolveEquippedWeaponWsm,
  resolveWeaponWsm,
  STAT_FASTERATTACKRATE,
  STAT_FASTERBLOCKRATE,
  STAT_FASTERCASTRATE,
  STAT_FASTERHITRECOVERY,
  STAT_LIGHTRADIUS,
  STAT_SKILL_IAS,
  type CharacterAnimSpeedParams,
}

export class ClientWorld {
  act = 0
  mapSeed = 0
  objectSeed = 0
  difficulty: 0 | 1 | 2 = 0
  hardcore = false
  expansion = true
  ladder = false
  private _areaId = 0
  loading = true
  selfId = 0

  get localPlayerId(): number {
    return this.selfId
  }

  get areaId(): number {
    return this._areaId
  }

  set areaId(value: number) {
    if (this._areaId !== 0 && value !== 0 && this._areaId !== value) {
      this._waypointOpen = false
      this._waypointUnitId = null
    }
    this._areaId = value
  }
  frameCount = 0
  lastRttMs: number | null = null
  /** When true, `tick()` skips stepping turn transitions on `selfId` (e.g. driven by `OnlineSession` predictor). */
  skipSelfTurnStep = false
  /** When true, `tick()` skips stepping remote unit positions (driven authoritatively by `OnlineSession.interpolator`). */
  skipRemoteUnitStep = false

  private readonly _self = new MutableSelfPlayerState()
  private _isSelfDead = false
  private readonly _units = new UnitMap()
  private readonly _monsters = new Map<number, ClientUnit>()
  private readonly _containers = new ClientInventoryManager()
  private readonly _revealedRooms = new Set<string>()
  private readonly _revealedRoomSeeds = new Map<
    string,
    {
      readonly areaId: number
      readonly tileX: number
      readonly tileY: number
      subX: number
      subY: number
      subW: number
      subH: number
      readonly seed: D2SeedStrc
      seededFromDrlg: boolean
    }
  >()
  private readonly _waypoints = new Set<number>()
  /** Unit id of the waypoint object whose menu was last opened (`0x63 WaypointMenu`); `null` when none. */
  private _waypointUnitId: number | null = null
  private _waypointMenuSeq = 0
  private _waypointOpen = false
  private _quests = new Uint16Array(48)
  private _hasQuestInfo = false
  private _gameQuestLog = new Uint16Array(48)
  private _questItemState = new Uint16Array(7)
  private _questHistory = new Uint8Array(41)
  private _gameQuestAvailability = new Uint8Array(37)
  private _questStatus: {
    readonly questId: number
    readonly alertFlags: number
    readonly filterStatus: number
    readonly extra: number
  } | null = null
  private _specialQuestEvent = 0
  private readonly _canGoToAct = new Set<number>()
  private _gameQuests = new Uint16Array(48)
  private readonly _questLog = new QuestLogState()
  private _hasPlayerQuests = false
  private readonly _party = new Map<number, PartyMemberState>()
  private readonly _corpses = new Map<number, number>()
  private readonly _trade: TradeSessionState = {
    active: false,
    lastAction: 0,
    pendingModal: null,
    partnerGold: 0,
    selfGold: 0,
    selfAccepted: false,
    partnerAccepted: false,
    acceptDisabled: false,
  }
  private _merc: MercenaryState | null = null
  private readonly _mercHireList: MercHireEntry[] = []
  private readonly _pets = new Map<number, RosterPetState>()
  private readonly _chatLog: ChatLogEntry[] = []
  private readonly _activeChatStream: ChatLogEntry[] = []
  private _nextChatEntryId = 1
  private _lastWhisperTarget: string | null = null
  private _lang: 'CHI' | 'ENG' | null = null
  private readonly _squelchedPlayerIds = new Set<number>()
  private readonly _ignoredPlayerIds = new Set<number>()
  private readonly _squelchedPlayerNames = new Set<string>()
  private readonly _ignoredPlayerNames = new Set<string>()
  private readonly _portals = new Map<number, PortalState>()
  private _npcInteraction: NpcInteractionState = {
    npcId: null,
    window: 'none',
    activeWindow: 'none',
    stashOpen: false,
    cubeOpen: false,
  }
  private _awaitingArtisanConfirmNpcId: number | null = null
  private readonly _npcTalkFlagsByAct = new Map<number, Uint16Array>()
  private readonly _npcIntroPlayedKeys = new Set<string>()
  private readonly _npcInfoByUnitId = new Map<
    number,
    {
      readonly npcInfoRaw?: Uint8Array | undefined
      readonly messages?: readonly { readonly menu: number; readonly stringId: number }[] | undefined
      readonly allMessages?: readonly { readonly menu: number; readonly stringId: number }[] | undefined
    }
  >()
  private readonly _pendingWantsInteractUnitIds = new Set<number>()
  private _lastNpcTransaction: NpcTransactionRecord | null = null

  getNpcMessages(npcId: number): readonly { readonly menu: number; readonly stringId: number }[] | undefined {
    return this._npcInfoByUnitId.get(npcId)?.messages ?? (this._npcInteraction.npcId === npcId ? this._npcInteraction.messages : undefined)
  }

  /**
   * One-shot read of `NpcInteractionState.hadWantsInteract`: true when the NPC the client just
   * `NpcInit`'d carried the S2C 0x8A overhead `!` flag. Reading clears it so the auto-greeting
   * fires exactly once per interaction.
   */
  consumeNpcInitWantsInteract(): boolean {
    if (this._npcInteraction.hadWantsInteract !== true) return false
    this._npcInteraction = { ...this._npcInteraction, hadWantsInteract: undefined }
    return true
  }
  private _npcTransactionSeq = 0
  private readonly _pendingGambleIdentifyItemIds: number[] = []
  /** Outstanding gamble `0x32 NpcBuy` requests awaiting their purchased item (#1006). */
  private _pendingGambleBuyCount = 0
  private _pendingUseStackableCursor: {
    readonly cursorAction: number
    readonly itemId: number
    readonly skillId: number
  } | null = null
  private _clockMs: number | null = null
  private _clockExplicit = false
  private readonly _changeListeners = new Set<(ev: ServerEvent) => void>()
  private readonly _pendingBeltPickupItemIds = new Set<number>()

  consumePendingGambleIdentifyItems(): number[] {
    if (this._pendingGambleIdentifyItemIds.length === 0) return []
    return this._pendingGambleIdentifyItemIds.splice(0, this._pendingGambleIdentifyItemIds.length)
  }

  consumePendingUseStackableItem(): {
    readonly cursorAction: number
    readonly itemId: number
    readonly skillId: number
  } | null {
    const cur = this._pendingUseStackableCursor
    this._pendingUseStackableCursor = null
    return cur
  }

  private readonly _soundRequests: WorldSoundRequest[] = []
  /**
   * Missiles whose travel sound was started (`missile-spawn`) and not yet stopped (`missile-destroy`).
   * `drainWorldSoundRequests` stops the ones whose unit is gone, whatever path removed it (#991).
   */
  private readonly _soundMissileIds = new Set<number>()
  /**
   * Objects whose mode-bound loop sound was started (`unit-loop-start`) and not yet stopped (`unit-loop-stop`).
   * `drainWorldSoundRequests` / `reset` stop the ones whose unit left the world (0x0A, RoomHide, LoadAct, #998).
   */
  private readonly _soundLoopObjectIds = new Set<number>()
  private readonly _deadSoundUnitIds = new Set<number>()
  private _speechPendingCount = 0

  get speechPendingCount(): number {
    return this._speechPendingCount
  }

  pushSoundRequest(req: WorldSoundRequest): void {
    pushSoundRequestImpl.call(this as unknown as ClientWorldInternal, req)
  }

  queueWorldSoundRequest(req: Record<string, unknown>): void {
    this.pushSoundRequest(req as unknown as WorldSoundRequest)
  }

  emitSkillCastSound(opts: {
    readonly skillId?: number | undefined
    readonly charclass?: string | number | undefined
    readonly x?: number | undefined
    readonly y?: number | undefined
    readonly unitId?: number | undefined
    readonly local?: boolean | undefined
  }): void {
    emitSkillCastSoundImpl.call(this as unknown as ClientWorldInternal, opts)
  }

  emitSkillKeyframeSound(opts: {
    readonly skillId?: number | undefined
    readonly flag?: number | undefined
    readonly x?: number | undefined
    readonly y?: number | undefined
    readonly unitId?: number | undefined
    readonly local?: boolean | undefined
    readonly weaponSoundId?: number | undefined
  }): void {
    emitSkillKeyframeSoundImpl.call(this as unknown as ClientWorldInternal, opts)
  }

  emitMissileSpawnSound(opts: {
    readonly missileId?: number | string | undefined
    readonly entityId?: number | undefined
    readonly x?: number | undefined
    readonly y?: number | undefined
  }): void {
    emitMissileSpawnSoundImpl.call(this as unknown as ClientWorldInternal, opts)
  }

  emitMissileImpactSound(opts: {
    readonly missileId?: number | string | undefined
    readonly entityId?: number | undefined
    readonly x?: number | undefined
    readonly y?: number | undefined
    readonly prog?: boolean | undefined
  }): void {
    emitMissileImpactSoundImpl.call(this as unknown as ClientWorldInternal, opts)
  }

  emitUnitDeathSound(opts: {
    readonly unitType?: number | string | undefined
    readonly unitId?: number | undefined
    readonly classId?: number | undefined
    readonly soundId?: number | undefined
    readonly x?: number | undefined
    readonly y?: number | undefined
  }): void {
    emitUnitDeathSoundImpl.call(this as unknown as ClientWorldInternal, opts)
  }

  private readonly _monsterNextNeutralSoundTick = new Map<number, number>()
  private _lastGlobalNeutralSoundTick = -200

  emitMonsterModeSound(unit: ClientUnit, rawMode: number, skillId?: number): void {
    emitMonsterModeSoundImpl.call(this as unknown as ClientWorldInternal, unit, rawMode, skillId)
  }

  drainWorldSoundRequests(): WorldSoundRequest[] {
    // Stop the travel sound of every missile that left the world through a path without its own
    // missile-destroy (collision, server removal, area cleanup...); a looping travel sound would never end (#991).
    for (const entityId of this._soundMissileIds) {
      if (!this._units.has(makeUnitKey('missile', entityId))) {
        this._soundMissileIds.delete(entityId)
        this._soundRequests.push({ kind: 'missile-destroy', entityId })
      }
    }
    // 0x6fb56d61 -> 0x6fad3120 -> 0x6fb38c20: stop the mode-bound loop sound of every object that left the world (#998).
    for (const objectId of this._soundLoopObjectIds) {
      if (!this._units.has(makeUnitKey('object', objectId))) {
        this._soundLoopObjectIds.delete(objectId)
        this._soundRequests.push({
          kind: 'unit-loop-stop',
          unit: { unitType: 'object', id: objectId },
        })
      }
    }
    if (this._soundRequests.length === 0) return []
    return this._soundRequests.splice(0, this._soundRequests.length)
  }

  private _nextMissileId = 0x70000000
  private _nextOverlayId = 1
  private _questFxSeed: D2Seed = { lo: 1, hi: LIGHT_SEED_HI }
  private _screenShake: ScreenShakeState = {
    active: false,
    startMs: 0,
    rampUpMs: 0,
    sustainMs: 0,
    rampDownMs: 0,
    amplitude: 0,
    offsetX: 0,
    offsetY: 0,
  }
  private _lastLocalCastSkillId = -1
  private _lastLocalCastAtMs = -1000
  private _simTimeMs = 0
  private _timeMs = 0
  private _tickAccumulatorMs = 0
  private _skillDelayUntilMs = 0
  private _skillDelayDurationMs = 0
  private _notedCommands = new WeakSet<object>()
  private readonly _blockedSubTiles = new Set<string>()
  private readonly _missileBlockedSubTiles = new Set<string>()
  private readonly _unblockedSubTiles = new Set<string>()
  /** Object-unit footprints currently stamped into `_blockedSubTiles` (unit key -> stamped sub-tile keys). */
  private readonly _objectCollisionFootprints = new Map<string, readonly string[]>()
  /** Object-unit footprints with `BlockMissile=1` / `BlocksVis=1` stamped into `_missileBlockedSubTiles`. */
  private readonly _objectMissileCollisionFootprints = new Map<string, readonly string[]>()
  /** Open door / bridge footprints that clear static `COLLIDE_DOOR` bits (`UNITS_FreeCollisionPath` `0x6FD818C0`). */
  private readonly _objectUnblockedFootprints = new Map<string, readonly string[]>()
  private _collisionChecker: ((subX: number, subY: number) => boolean) | null = null
  /**
   * D2Common #10754(#10331(unit), UNIT_OBJECT, classId) stand-in: the first object of `classId` in the room containing
   * sub-tile (`subX`, `subY`) or one of its near rooms (the session owns the room layout).
   */
  private _nearRoomObjectFinder: ((subX: number, subY: number, classId: number) => ClientUnit | null) | null = null
  private _missileCollisionChecker:
    | ((subX: number, subY: number, collideType: number) => boolean)
    | null = null
  private _collisionContextGetter: (() => unknown) | null = null
  private _collisionContextKey: unknown = null
  private _collisionRevision = 0
  private _revealedAreaIdsCache: number[] | null = null
  private _pendingMeleeAttack: {
    readonly skillId: number
    readonly hand: 'left' | 'right'
    readonly target: UnitRef
    readonly startedAtMs: number
  } | null = null
  private readonly _playerPathUnits = new Map<number, PathUnit>()
  readonly npcMotion: NpcMotion

  constructor() {
    this.npcMotion = new NpcMotion({
      resolveTargetUnit: (unitType, unitId) => this.resolvePathUnitForNpcMotion(unitType, unitId),
      isSubTileBlocked: (subX, subY) => this.isSubTileBlocked(subX, subY),
      getCollisionRevision: () => this.collisionRevision,
      getAnimMetrics: (classId, mode, unitId) => {
        let unit = unitId !== undefined ? this._monsters.get(unitId) : undefined
        if (!unit || unit.classId !== classId) {
          unit = undefined
          for (const m of this._monsters.values()) {
            if (m.classId === classId) {
              unit = m
              break
            }
          }
        }
        const frameCount =
          unit?.totalFrames && unit.totalFrames > 0
            ? unit.totalFrames
            : getMonsterModeBaseFrameCount113c(
                classId,
                mode,
                unit?.castState?.skillId ?? unit?.lastSkillId,
              )
        // Engine base speed for this monster's CURRENT mode (pAnimData->dwAnimSpeed) —
        // NOT a flat 256 and NOT the previous mode's scaled `unit.animStepSpeed256` (#852).
        const animSpeed =
          unit?.animSpeed && unit.animSpeed > 0
            ? Math.round((unit.animSpeed / 16) * 256)
            : getMonsterModeBaseAnimSpeed256(classId, mode)
        return { frameCount, animSpeed }
      },
      onUnitUpdated: (npcUnit, prevMode, animRestarted) =>
        this.syncClientUnitFromNpcMotion(npcUnit, prevMode, animRestarted),
    })
  }

  /**
   * Monotonically increasing revision counter for map/sub-tile collision state.
   */
  get collisionRevision(): number {
    if (this._collisionContextGetter !== null) {
      const nextKey = this._collisionContextGetter()
      if (nextKey !== this._collisionContextKey) {
        this._collisionContextKey = nextKey
        this._collisionRevision++
      }
    }
    return this._collisionRevision
  }

  /**
   * Explicitly marks the static/synthetic collision state as dirty so `NpcRoomStore` refreshes on next check.
   */
  bumpCollisionRevision(): void {
    this._collisionRevision++
  }

  private resolvePathUnitForNpcMotion(unitType: number, unitId: number): PathUnit | null {
    if (unitType === 1) {
      return this.npcMotion.getUnit(unitId) ?? null
    }
    if (unitType === 0) {
      const playerUnit = this.getUnit('player', unitId)
      const isSelf = unitId === this.selfId || (this.selfId === 0 && unitId === 1)
      let px = playerUnit ? playerUnit.x : 0
      let py = playerUnit ? playerUnit.y : 0
      if (px === 0 && py === 0 && isSelf && (this._self.x !== 0 || this._self.y !== 0)) {
        px = this._self.x
        py = this._self.y
      }
      if (!playerUnit && px === 0 && py === 0) {
        return null
      }
      let pathUnit = this._playerPathUnits.get(unitId)
      if (!pathUnit || !pathUnit.pDynamicPath) {
        const created: PathUnit = {
          dwUnitType: UNIT_PLAYER,
          dwClassId: playerUnit?.classId ?? 0,
          dwUnitId: unitId,
          dwAnimMode: playerUnit?.mode ?? 1,
          dwFlags: playerUnit?.dead ? 0x10000 : 0,
          dwFlagEx: 0,
          pDynamicPath: null,
          pStaticPath: null,
          objectTxt: null,
        }
        const path = PATH_AllocDynamicPath(null, Math.floor(px), Math.floor(py), created, false)
        created.pDynamicPath = path
        this._playerPathUnits.set(unitId, created)
        pathUnit = created
      }
      pathUnit.dwAnimMode = playerUnit?.mode ?? 1
      pathUnit.dwFlags = playerUnit?.dead ? 0x10000 : 0
      if (pathUnit.pDynamicPath) {
        const room = this.npcMotion.findOrCreateRoomAt(Math.floor(px), Math.floor(py), null)
        pathUnit.pDynamicPath.pRoom = room
        PATH_SetPrecisionX(pathUnit.pDynamicPath, Math.round(px * 65536) + 0x8000)
        PATH_SetPrecisionY(pathUnit.pDynamicPath, Math.round(py * 65536) + 0x8000)
        PATH_UpdateClientCoords(pathUnit.pDynamicPath)
      }
      return pathUnit
    }
    return null
  }

  private syncClientUnitFromNpcMotion(
    npcUnit: NpcMotionUnit,
    prevNpcMode?: number,
    animRestarted?: boolean,
  ): void {
    const unit = this.getUnit('monster', npcUnit.dwUnitId)
    if (!unit) return
    const wasDead = unit.dead
    const prevClientMode = unit.mode
    unit.x = npcUnit.preciseX
    unit.y = npcUnit.preciseY
    unit.mode = npcUnit.dwAnimMode
    unit.hitClass = npcUnit.hitClass
    unit.dead =
      (npcUnit.dwFlags & 0x10000) !== 0 ||
      npcUnit.dwAnimMode === MONMODE_DEATH ||
      npcUnit.dwAnimMode === MONMODE_DEAD
    if (!wasDead && unit.dead) {
      unit.diedAtMs = this._timeMs
    }
    if (!unit.dead && npcUnit.lifeByte > 0) {
      unit.lifePct = npcUnit.lifeByte
    }
    unit.moving = npcUnit.moving
    unit.moveMode =
      npcUnit.dwAnimMode === MONMODE_RUN
        ? 'run'
        : npcUnit.dwAnimMode === MONMODE_KNOCKBACK
          ? 'knockback'
          : npcUnit.moving
            ? 'walk'
            : 'stop'
    unit.syncTurnState(npcUnit.direction, npcUnit.targetDirection, npcUnit.turnStepDir)
    unit.animStepSpeed256 = npcUnit.wAnimSpeed
    const modeChanged =
      (prevNpcMode !== undefined && prevNpcMode !== npcUnit.dwAnimMode) ||
      prevClientMode !== npcUnit.dwAnimMode
    if (modeChanged || animRestarted) {
      const now = this._clockMs !== null ? this._clockMs : this._timeMs
      unit.modeStartedAtMs = now
      if (isMonsterOneShotMode(npcUnit.dwAnimMode) || npcUnit.dwAnimMode === 14) {
        unit.animStartedAtMs = now
      } else {
        unit.animStartedAtMs = undefined
        if (
          npcUnit.dwAnimMode === 0 ||
          npcUnit.dwAnimMode === 2 ||
          npcUnit.dwAnimMode === 12 ||
          npcUnit.dwAnimMode === 15 ||
          (npcUnit.dwAnimMode === 1 && modeChanged)
        ) {
          this.clearUnitCastState(unit)
        }
      }
    }
    if (npcUnit.pDynamicPath && npcUnit.moving) {
      unit.targetX = npcUnit.pDynamicPath.tTargetCoord.X
      unit.targetY = npcUnit.pDynamicPath.tTargetCoord.Y
    } else if (!npcUnit.moving) {
      unit.targetX = unit.x
      unit.targetY = unit.y
    }
    if ((npcUnit.dwFlags & 0x01) !== 0) {
      npcUnit.dwFlags = (npcUnit.dwFlags & ~0x01) >>> 0
      this.emitMonsterModeSound(unit, npcUnit.dwAnimMode)
    }
  }

  /**
   * Returns `true` when `skillId` has a casting delay (`delay > 0` in 1.13c `Skills.txt`)
   * and the player currently has state 121 (`skilldelay`) active.
   */
  isSkillOnCooldown(skillId: number, nowMs?: number): boolean {
    const delayFrames = SKILLS_BY_ID[skillId]?.delay ?? 0
    if (delayFrames <= 0) return false
    const selfUnit = this.selfId !== 0 ? this.getUnit('player', this.selfId) : undefined
    const hasDelayState = this._self.states.has(121) || Boolean(selfUnit?.states.has(121))
    if (!hasDelayState) return false
    if (this._skillDelayUntilMs > 0) {
      const effNow =
        nowMs !== undefined && Number.isFinite(nowMs)
          ? nowMs
          : this._clockMs
      if (effNow !== null && effNow >= this._skillDelayUntilMs) {
        return false
      }
    }
    return true
  }

  getSkillCooldownRemainingMs(skillId: number, nowMs?: number): number {
    if (!this.isSkillOnCooldown(skillId, nowMs)) return 0
    const effNow =
      nowMs !== undefined && Number.isFinite(nowMs)
        ? nowMs
        : (this._clockMs ?? 0)
    if (this._skillDelayUntilMs > effNow) {
      return this._skillDelayUntilMs - effNow
    }
    return this._skillDelayDurationMs || (SKILLS_BY_ID[skillId]?.delay ?? 0) * 40
  }

  get pendingMeleeAttack(): {
    readonly skillId: number
    readonly hand: 'left' | 'right'
    readonly target: UnitRef
    readonly startedAtMs: number
  } | null {
    return this._pendingMeleeAttack
  }

  hasPendingMeleeAttack(): boolean {
    return this._pendingMeleeAttack !== null
  }

  cancelPendingMeleeAttack(): void {
    this._pendingMeleeAttack = null
  }

  isSelfMeleeSkill(skillId: number): boolean {
    if (
      skillId === 107 ||
      skillId === 132 ||
      skillId === 143 ||
      skillId === 151 ||
      skillId === 275
    ) {
      return false
    }
    return isMeleeSkill113c(skillId, this._containers.equipmentBySlot)
  }

  getSelfWeaponRangeAdder(): number {
    return resolveEquippedWeaponRangeAdder(this._containers.equipmentBySlot)
  }

  getUnitSizeX(unit: ClientUnit): number {
    if (unit.unitType === 'player') return 2
    if (unit.unitType === 'monster') return getMonsterSizeXByHcIdx(unit.classId)
    if (unit.unitType === 'object') return CANONICAL_113C_OBJECTS[unit.classId]?.sizeX ?? 2
    return 2
  }

  isTargetInSelfMeleeRange(
    targetUnit: ClientUnit,
    selfXOverride?: number,
    selfYOverride?: number,
  ): boolean {
    const selfUnit = this.selfId !== 0 ? this.getUnit('player', this.selfId) : undefined
    const sx =
      selfXOverride ??
      (selfUnit && (selfUnit.x !== 0 || selfUnit.y !== 0) ? selfUnit.x : this._self.x)
    const sy =
      selfYOverride ??
      (selfUnit && (selfUnit.x !== 0 || selfUnit.y !== 0) ? selfUnit.y : this._self.y)
    const rangeAdder = this.getSelfWeaponRangeAdder()
    const targetSizeX = this.getUnitSizeX(targetUnit)
    const isTargetMoving =
      targetUnit.mode === 2 ||
      targetUnit.mode === 15 ||
      targetUnit.moveMode === 'walk' ||
      targetUnit.moveMode === 'run'
    const collisionFn =
      this._collisionChecker !== null || this._blockedSubTiles.size > 0
        ? (x: number, y: number) => this.isSubTileBlocked(x, y)
        : null
    return isInMeleeRange113c(
      sx,
      sy,
      2,
      targetUnit.x,
      targetUnit.y,
      targetSizeX,
      rangeAdder,
      isTargetMoving,
      collisionFn,
    )
  }

  /**
   * Checks whether a pending walk-to-melee-range chase has reached `UNITS_IsInMeleeRange`
   * (`D2Common_10399`), and if so transitions the local player into the attack animation (`sub_6FC7F780`).
   * Returns `true` when the melee swing is triggered on this check.
   */
  checkPendingMeleeAttack(
    nowMs?: number,
    selfXOverride?: number,
    selfYOverride?: number,
  ): boolean {
    const pending = this._pendingMeleeAttack
    if (!pending) return false
    const targetUnit = this.getUnit(pending.target.unitType, pending.target.id)
    if (
      !targetUnit ||
      targetUnit.dead ||
      (targetUnit.unitType === 'monster' &&
        (targetUnit.mode === 0 || targetUnit.mode === 12 || targetUnit.lifePct <= 0))
    ) {
      this._pendingMeleeAttack = null
      return false
    }
    if (!this.isTargetInSelfMeleeRange(targetUnit, selfXOverride, selfYOverride)) {
      return false
    }
    this._pendingMeleeAttack = null
    const now = this.resolveEventNowMs(nowMs)
    if (this.selfId !== 0) {
      const selfUnit = this.ensureUnit('player', this.selfId)
      if (selfXOverride !== undefined && selfYOverride !== undefined) {
        selfUnit.x = selfXOverride
        selfUnit.y = selfYOverride
      }
      selfUnit.targetX = undefined
      selfUnit.targetY = undefined
      selfUnit.targetUnit = pending.target
      this._lastLocalCastSkillId = pending.skillId
      this._lastLocalCastAtMs = now
      this.applySkillCastToUnit(
        selfUnit,
        pending.skillId,
        targetUnit.x,
        targetUnit.y,
        1,
        true,
        nowMs,
      )
    } else {
      this._lastLocalCastSkillId = pending.skillId
      this._lastLocalCastAtMs = now
    }
    return true
  }

  get npcInteraction(): NpcInteractionState {
    return this._npcInteraction
  }

  get awaitingArtisanConfirmNpcId(): number | null {
    return this._awaitingArtisanConfirmNpcId
  }

  /** Clear an active `UNIT_OBJECT` (`unitType === 2`) `S2C 0x27` quest speech interaction once dismissed. */
  clearObjectNpcInteraction(unitId?: number): void {
    if (
      this._npcInteraction.unitType === 2 &&
      (unitId === undefined || this._npcInteraction.npcId === unitId)
    ) {
      this._npcInteraction = {
        ...this._npcInteraction,
        npcId: null,
        infoNpcId: null,
        unitType: undefined,
        messages: undefined,
        allMessages: undefined,
      }
    }
    if (unitId !== undefined) {
      this._npcInfoByUnitId.delete(unitId)
    }
  }

  get npcTalkFlagsByAct(): ReadonlyMap<number, Uint16Array> {
    return this._npcTalkFlagsByAct
  }

  hasNpcIntroPlayed(act: number, npcIndexOrHcIdx: number): boolean {
    const cleanAct = Math.max(0, Math.floor(act))
    const cleanIdx = Math.max(0, Math.floor(npcIndexOrHcIdx))
    if (this._npcIntroPlayedKeys.has(`${cleanAct}:${cleanIdx}`)) {
      return true
    }
    const flags = this._npcTalkFlagsByAct.get(cleanAct)
    if (!flags) return false
    const wordIdx = Math.floor(cleanIdx / 16)
    const bitIdx = cleanIdx % 16
    if (wordIdx >= 0 && wordIdx < flags.length) {
      return (flags[wordIdx]! & (1 << bitIdx)) !== 0
    }
    return false
  }

  markNpcIntroPlayed(act: number, npcIndexOrHcIdx: number): void {
    const cleanAct = Math.max(0, Math.floor(act))
    const cleanIdx = Math.max(0, Math.floor(npcIndexOrHcIdx))
    this._npcIntroPlayedKeys.add(`${cleanAct}:${cleanIdx}`)
    const flags = this._npcTalkFlagsByAct.get(cleanAct) ?? new Uint16Array(12)
    const wordIdx = Math.floor(cleanIdx / 16)
    const bitIdx = cleanIdx % 16
    if (wordIdx >= 0 && wordIdx < flags.length) {
      flags[wordIdx] = (flags[wordIdx]! | (1 << bitIdx)) & 0xffff
    }
    this._npcTalkFlagsByAct.set(cleanAct, flags)
  }

  /** Last S2C 0x2A NPCTransaction; display-only (gold/items come from stat and item packets). */
  get lastNpcTransaction(): NpcTransactionRecord | null {
    return this._lastNpcTransaction
  }

  get isDead(): boolean {
    return this._isSelfDead || this._self.isDead
  }

  get isSelfDead(): boolean {
    return this._isSelfDead || this._self.isDead
  }

  get mercHireList(): readonly MercHireEntry[] {
    return this._mercHireList
  }

  private resolveEventNowMs(nowMs?: number): number {
    if (nowMs !== undefined && Number.isFinite(nowMs)) {
      this._clockMs = nowMs
      this._clockExplicit = true
      this._timeMs = nowMs
      return nowMs
    }
    if (this._clockExplicit && this._clockMs !== null) {
      return this._clockMs
    }
    const autoNow = typeof performance !== 'undefined' ? performance.now() : Date.now()
    this._clockMs = autoNow
    return autoNow
  }

  private readonly _setBonusStatesByPlayerId = new Map<number, Set<number>>()

  /**
   * Computes active set-bonus stats (`computeSetBonusStats`, `src/client/ui-model/set-bonuses.ts`)
   * for a player (`unitId`) from their active equipped items (bodyLocs 1..10).
   */
  resolvePlayerSetBonusStats(unitId = this.selfId): readonly ItemStat[] {
    const isSelf = unitId === this.selfId || this.selfId === 0
    const rawEquip = this.resolvePlayerActiveEquipment(unitId, isSelf)
    if (!rawEquip) return []
    const normalized: ItemData[] = []
    for (const item of rawEquip) {
      if (!item) continue
      const setItemId =
        item.setItemId ??
        (item.quality === 5 ? resolveSetItemIdByCodeOrName(item) : undefined)
      const bodyLoc =
        item.bodyLoc ||
        item.equippedSlot ||
        (item as { equipSlot?: number }).equipSlot ||
        0
      normalized.push({
        ...item,
        bodyLoc,
        ...(setItemId !== undefined ? { setItemId } : {}),
        setBonusStats: item.setBonusStats ?? [],
      })
    }
    try {
      return computeSetBonusStats(normalized)
    } catch {
      return []
    }
  }

  /**
   * Recomputes and synchronizes set-granted unit states (`STAT_STATE = 98`, `Properties.txt` `state`
   * func 24: `fullsetgeneric` 175 for Amazon/Sorceress/Paladin/Barbarian/Druid, `monsterset` 176
   * for Necromancer Trang-Oul's Avatar) on the player's `ClientUnit` and `_self.states`.
   */
  syncPlayerSetBonusStates(unitId = this.selfId): void {
    const isSelf = unitId === this.selfId || this.selfId === 0
    const effectiveUnitId = isSelf ? (this.selfId !== 0 ? this.selfId : 1) : unitId
    const mapKey = isSelf ? 0 : effectiveUnitId
    const unit = this.getUnit('player', effectiveUnitId)
    const setStats = this.resolvePlayerSetBonusStats(effectiveUnitId)
    const nextStates = new Set<number>()
    for (const s of setStats) {
      if (s.statId === 98 && s.value > 0 && s.param !== undefined && s.param > 0) {
        nextStates.add(s.param)
      }
    }
    const prevStates = this._setBonusStatesByPlayerId.get(mapKey)
    if (prevStates) {
      for (const oldState of prevStates) {
        if (!nextStates.has(oldState)) {
          unit?.states.remove(oldState)
          if (isSelf) {
            this._self.states.delete(oldState)
          }
        }
      }
    }
    for (const newState of nextStates) {
      unit?.states.add(newState)
      if (isSelf) {
        this._self.states.add(newState)
      }
    }
    if (nextStates.size > 0) {
      this._setBonusStatesByPlayerId.set(mapKey, nextStates)
    } else {
      this._setBonusStatesByPlayerId.delete(mapKey)
    }
  }

  /**
   * Returns whether the player is rendered with 1.13c Fade ethereal translucency:
   * active when Assassin `STATE_FADE` (159) is set OR `STAT_FADE` (`ItemStatCost.txt` ID 181,
   * e.g. Natalya's Odium `FCode7 = fade`) > 0 across unit stats, equipment, or full-set bonus stats.
   */
  isPlayerFaded(unitId = this.selfId): boolean {
    const unit = unitId !== 0 ? this.getUnit('player', unitId) : undefined
    const isSelf = unitId === this.selfId || this.selfId === 0
    if (Boolean(unit?.states.has(159)) || (isSelf && this._self.states.has(159))) {
      return true
    }
    const fadeStat = resolveCharacterStatTotal(181, {
      unitStats: unit?.stats,
      selfStats: isSelf ? this._self.stats : undefined,
      equipment: this.resolvePlayerActiveEquipment(unitId, isSelf),
      sockets: this._containers.sockets,
      setBonusStats: this.resolvePlayerSetBonusStats(unitId),
    })
    return fadeStat > 0
  }

  /**
   * Resolves 1.13c character animation speed parameters (`frames`, `baseSpeed`, `effRate`,
   * `stepSpeed256`, `durationMs`) for `modeOrClipKey` from the unit's stats and equipped items.
   */
  resolvePlayerAnimSpeed(
    modeOrClipKey: number | string,
    unitId = this.selfId,
    skillId?: number,
  ): CharacterAnimSpeedParams {
    const unit = unitId !== 0 ? this.getUnit('player', unitId) : undefined
    const isSelf = unitId === this.selfId || this.selfId === 0
    const classId =
      unit && unit.classId >= 0 && unit.classId <= 6 ? unit.classId : (this._self.charClass ?? 1)
    const hasWolf = Boolean(unit?.states.has(139)) || (isSelf && this._self.states.has(139))
    const hasBear =
      !hasWolf && (Boolean(unit?.states.has(140)) || (isSelf && this._self.states.has(140)))
    const hasVamp =
      !hasWolf &&
      !hasBear &&
      (Boolean(unit?.states.has(176)) || (isSelf && this._self.states.has(176)))
    const hasDelirium =
      !hasWolf &&
      !hasBear &&
      !hasVamp &&
      (Boolean(unit?.states.has(177)) || (isSelf && this._self.states.has(177)))
    const morphMonsterClassId = hasWolf
      ? 430
      : hasBear
        ? 431
        : hasVamp
          ? 135
          : hasDelirium
            ? 212
            : undefined
    let skillVelocityPercent = 0
    if (isSelf) {
      const entry148 = this._self.skillEntries.get(148)
      const base148 = entry148
        ? Math.max(0, Number(entry148.baseLevel ?? entry148.level ?? 0))
        : Math.max(0, Number(this._self.skills.get(148) ?? 0))
      const eff148 =
        base148 > 0
          ? Math.max(
              base148 + Math.max(0, Number(entry148?.bonus ?? 0)),
              Number(this._self.skills.get(148) ?? base148),
            )
          : 0
      if (eff148 > 0) {
        skillVelocityPercent +=
          7 + Math.trunc((43 * Math.trunc((110 * eff148) / (eff148 + 6))) / 100)
      }
    }
    return resolveCharacterAnimSpeedParams(classId, modeOrClipKey, {
      unitStats: unit?.stats,
      selfStats: isSelf ? this._self.stats : undefined,
      equipment: this.resolvePlayerActiveEquipment(unitId, isSelf),
      sockets: isSelf ? this._containers.sockets : undefined,
      setBonusStats: this.resolvePlayerSetBonusStats(unitId),
      stat67VelocityPercent: unit?.velocityPercent ?? undefined,
      skillVelocityPercent,
      morphMonsterClassId,
      skillId,
    })
  }

  private _selfLocomotionAnimSpeed256: number | undefined

  /**
   * Per-tick refresh of the self locomotion animation step speed (WL 2 / RN 3 / TW 6):
   * `resolvePlayerAnimSpeed` reads the live stat list and equipment, so FRW boot swaps,
   * Vigor-style aura toggles and slow states retune the walk/run cadence without waiting
   * for a mode change (issue #869 Diff 3). No-op outside locomotion modes; writes only
   * when the resolved step speed actually changes.
   */
  private refreshSelfLocomotionAnimSpeed(): void {
    const selfUnitId = this.selfId !== 0 ? this.selfId : 1
    const unit = this._units.get(makeUnitKey('player', selfUnitId))
    if (!unit || unit.unitType !== 'player' || unit.dead || unit.castState) {
      return
    }
    if (unit.mode !== 2 && unit.mode !== 3 && unit.mode !== 6) {
      if (this._selfLocomotionAnimSpeed256 !== undefined) {
        this._selfLocomotionAnimSpeed256 = undefined
      }
      return
    }
    const speedInfo = this.resolvePlayerAnimSpeed(unit.mode, unit.id)
    if (speedInfo.stepSpeed256 !== this._selfLocomotionAnimSpeed256) {
      this._selfLocomotionAnimSpeed256 = speedInfo.stepSpeed256
      unit.animStepSpeed256 = speedInfo.stepSpeed256
      unit.animEffRate = speedInfo.effRate
    }
  }

  /**
   * Per-tick velocity modifiers for the local `LocalMovementPredictor` (#1336): the same
   * item FRW / `velocitypercent` / armor penalty / slow inputs the server uses, so client
   * prediction and `GameInstance` advance identically.
   */
  getSelfMoveVelocityModifiers(): {
    readonly fasterRunWalkPercent: number
    readonly skillVelocityPercent: number
    readonly armorSpeedPenaltyPercent: number
    readonly slowPercent: number
    readonly staminaExhausted: boolean
  } {
    const selfUnitId = this.selfId !== 0 ? this.selfId : 1
    const unit = this._units.get(makeUnitKey('player', selfUnitId))
    const stats = unit?.stats
    let armorSpeedPenaltyPercent = 0
    for (const item of this.resolvePlayerActiveEquipment(selfUnitId, true) ?? []) {
      if (!item.broken && !item.inSocket) {
        armorSpeedPenaltyPercent += resolveArmorSpeed113c(item.code)
      }
    }
    const stat67 = unit?.velocityPercent ?? stats?.get(STAT_VELOCITYPERCENT) ?? 0
    const slowRaw = stats?.get(150) ?? 0
    return {
      fasterRunWalkPercent: stats?.get(STAT_FASTERMOVEVELOCITY) ?? 0,
      skillVelocityPercent: Math.max(0, Math.trunc(stat67)),
      armorSpeedPenaltyPercent,
      slowPercent: Math.max(0, -Math.trunc(slowRaw)),
      staminaExhausted: this._self.stamina <= 0,
    }
  }

  private resolvePlayerActiveEquipment(unitId: number, isSelf: boolean): Iterable<ItemData> | undefined {
    if (isSelf) {
      return Array.from(this._containers.equipment.values()).filter(item => {
        const slot = item.bodyLoc ?? item.equippedSlot ?? (item as { equipSlot?: number }).equipSlot ?? 0
        return slot !== 11 && slot !== 12
      })
    }
    if (unitId === 0) return undefined
    const remote = this._containers.remoteEquipmentByPlayerId.get(unitId)
    if (!remote) return undefined
    const items: ItemData[] = []
    for (const [slot, item] of remote.entries()) {
      if (slot !== 11 && slot !== 12) {
        items.push(item)
      }
    }
    return items
  }

  /**
   * Cached player light (radius bonus + colour) resolution across unit stats,
   * self stats, equipped items, socketed items, and set bonuses (local and
   * remote players, issues #879/#938). The scene state asks for these on EVERY
   * rendered frame (self via the state provider, each remote player via
   * `buildRenderableUnits`), yet the values only change on stat/equip updates —
   * recomputing them walked the whole equipment twice per frame per player (a
   * top idle-CPU hotspot). Cache with a cheap mutation signature (container
   * sizes plus the `StatList.revision` stamps of the unit and self stat lists, so
   * an in-place stat write such as STAT_LIGHTRADIUS / STAT_LIGHTCOLOR takes effect
   * immediately) plus a 200ms TTL fallback for in-place item changes.
   */
  private readonly _playerLightCache = new Map<number, { atMs: number; sig: string; radius: number; color: number }>()

  invalidatePlayerLightCache(): void {
    this._playerLightCache.clear()
  }

  private playerLightCacheSignature(unitId: number, isSelf: boolean): string {
    const unit = unitId !== 0 ? this.getUnit('player', unitId) : undefined
    const unitRev = unit ? unit.stats.revision : -1
    if (isSelf) {
      return `s${this._containers.equipment.size},${this._containers.sockets.size},${this._self.stats.revision},${unitRev}`
    }
    const remote = this._containers.remoteEquipmentByPlayerId.get(unitId)
    return `r${remote ? remote.size : 0},${unitRev}`
  }

  private resolvePlayerLightCached(unitId: number): { radius: number; color: number } {
    const now = Date.now()
    const sig = this.playerLightCacheSignature(unitId, unitId === this.selfId || this.selfId === 0)
    const hit = this._playerLightCache.get(unitId)
    if (hit && hit.sig === sig && now - hit.atMs < 200) {
      return { radius: hit.radius, color: hit.color }
    }
    const radius = this.computePlayerLightRadiusBonus(unitId)
    const color = this.computePlayerLightColor(unitId)
    this._playerLightCache.set(unitId, { atMs: now, sig, radius, color })
    return { radius, color }
  }

  private computePlayerLightRadiusBonus(unitId: number): number {
    const unit = unitId !== 0 ? this.getUnit('player', unitId) : undefined
    const isSelf = unitId === this.selfId || this.selfId === 0
    return resolveCharacterStatTotal(STAT_LIGHTRADIUS, {
      unitStats: unit?.stats,
      selfStats: isSelf ? this._self.stats : undefined,
      equipment: this.resolvePlayerActiveEquipment(unitId, isSelf),
      sockets: this._containers.sockets,
      setBonusStats: this.resolvePlayerSetBonusStats(unitId),
    })
  }

  private computePlayerLightColor(unitId: number): number {
    const unit = unitId !== 0 ? this.getUnit('player', unitId) : undefined
    const isSelf = unitId === this.selfId || this.selfId === 0
    return resolveCharacterStatTotal(STAT_LIGHTCOLOR, {
      unitStats: unit?.stats,
      selfStats: isSelf ? this._self.stats : undefined,
      equipment: this.resolvePlayerActiveEquipment(unitId, isSelf),
      sockets: this._containers.sockets,
      setBonusStats: this.resolvePlayerSetBonusStats(unitId),
    })
  }

  /**
   * Resolves the player's 1.13c light radius bonus (`STAT_LIGHTRADIUS = 89` from `ItemStatCost.txt`)
   * across unit stats, self stats, equipped items, and socketed items (local and remote players, issue #879).
   */
  resolvePlayerLightRadiusBonus(unitId = this.selfId): number {
    return this.resolvePlayerLightCached(unitId).radius
  }

  /**
   * Resolves the player's 1.13c light colour (`STAT_LIGHTCOLOR = 90`, 0xRRGGBB; 0 = white) from the same sources as
   * {@link resolvePlayerLightRadiusBonus}. The stat callback 0x6fac89a0 passes it to SetColor (issue #830, #879).
   */
  resolvePlayerLightColor(unitId = this.selfId): number {
    return this.resolvePlayerLightCached(unitId).color
  }

  clearUnitCastState(unit: ClientUnit): void {
    const prevCastMode = unit.castState?.mode
    const prevCastSkillId = unit.castState?.skillId
    unit.castState = undefined
    unit.altitude = 0
    unit.modeUntilMs = undefined
    unit.modeDurationMs = undefined
    unit.modeElapsedMs = undefined
    unit.animStepSpeed256 = undefined
    unit.animEffRate = undefined
    if (
      prevCastSkillId === 107 ||
      prevCastSkillId === 132 ||
      prevCastSkillId === 143 ||
      prevCastSkillId === 151
    ) {
      unit.states.remove(18)
      if (prevCastSkillId === 151) {
        unit.states.remove(174)
        const isSelfUnit = unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)
        this.pushSoundRequest({
          kind: 'unit-sound-stop',
          soundId: 2531,
          skillId: 151,
          unitId: unit.id,
          unit: {
            unitType: unit.unitType,
            id: unit.id,
            x: unit.x,
            y: unit.y,
            ...(isSelfUnit ? { isLocalPlayer: true } : {}),
          },
          x: unit.x,
          y: unit.y,
          local: isSelfUnit,
        })
      }
      if (unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)) {
        this._self.states.delete(18)
        if (prevCastSkillId === 151) {
          this._self.states.delete(174)
        }
      }
    }
    if (
      !unit.dead &&
      (unit.mode === prevCastMode ||
        (unit.unitType === 'player' &&
          (unit.mode === 4 || (unit.mode >= 7 && unit.mode <= 16) || unit.mode === 18)) ||
        (unit.unitType === 'monster' &&
          (isMonsterOneShotMode(unit.mode) || unit.mode === 14)))
    ) {
      unit.mode = unit.unitType === 'player' && isTownLevel(this.areaId) ? 5 : 1
    }
    if (unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)) {
      this._self.castState = undefined
      this._self.mode = unit.mode
    }
  }

  /**
   * Registers the D2Common #10754 stand-in (room of a sub-tile plus its near rooms) the Compelling Orb death show
   * (0x6fb030d0) uses to find the Durance stairs. `null` unregisters it; the show then fails fast.
   */
  setNearRoomObjectFinder(finder: ((subX: number, subY: number, classId: number) => ClientUnit | null) | null): void {
    this._nearRoomObjectFinder = finder
  }

  /**
   * Registers an optional world sub-tile collision callback (`true` = blocked wall/obstacle).
   */
  setCollisionChecker(
    checker: ((subX: number, subY: number) => boolean) | null,
    contextGetter?: (() => unknown) | null,
  ): void {
    this._collisionChecker = checker
    this._collisionContextGetter = contextGetter ?? null
    this._collisionContextKey = contextGetter ? contextGetter() : null
    this._collisionRevision++
  }

  /**
   * Registers an optional world sub-tile missile collision callback (`true` = missile blocked).
   * In 1.13c (`D2Client.dll` `0x6FB81340` / `D2Game.dll` `0x6FD2A5B0`), flying missiles
   * (`CollideType` 1, 3, 6) check `COLLIDE_MISSILE_BARRIER | COLLIDE_DOOR` (`0x0804`),
   * floor-hugging missiles (`CollideType` 8) check `0x0805`, and `CollideType` 0 checks `0`.
   */
  setMissileCollisionChecker(
    checker: ((subX: number, subY: number, collideType: number) => boolean) | null,
  ): void {
    this._missileCollisionChecker = checker
    this._collisionRevision++
  }

  /**
   * Marks or unmarks an individual sub-tile `(subX, subY)` as blocked for walk and missile collision.
   */
  setSubTileBlocked(subX: number, subY: number, blocked = true): void {
    const key = `${Math.floor(subX)},${Math.floor(subY)}`
    const prevSize = this._blockedSubTiles.size
    if (blocked) {
      this._blockedSubTiles.add(key)
      this._missileBlockedSubTiles.add(key)
    } else {
      this._blockedSubTiles.delete(key)
      this._missileBlockedSubTiles.delete(key)
    }
    if (this._blockedSubTiles.size !== prevSize) {
      this._collisionRevision++
    }
  }

  hasExplicitBlockedSubTiles(): boolean {
    return this._blockedSubTiles.size > 0
  }

  /**
   * 1.13c object & door collision footprint (`D2Common.UNITS_GetCollisionMask` `0x6FD7FF30` +
   * `UNITS_BlockCollisionPath` `0x6FD81850` / `UNITS_FreeCollisionPath` `0x6FD818C0`).
   * - `HasCollision[mode] === 1` stamps `COLLIDE_OBJECT (0x0400)` or `COLLIDE_DOOR (0x0800)`
   *   (`_blockedSubTiles` for walk).
   * - Town portals (`subClass & 0x04`) return `0x8000` (`COLLIDE_CORPSE`), which never blocks
   *   walking (`0x1c09`) or missiles (`0x0804`/`0x0805`).
   * - Objects with `BlockMissile === 1` or doors with `BlocksVis === 1` (`0x0806` / `0x0804` / `0x0404`)
   *   also stamp `_missileBlockedSubTiles`.
   * - Open doors (`isDoor === true && HasCollision[mode] === 0`) and open MephistoBridge/HellGate
   *   (`classId === 341 || 342` in `mode === 2`) record `_unblockedSubTiles` to clear static
   *   `COLLIDE_DOOR` bits (`UNITS_FreeCollisionPath` `0x6FD818C0`).
   */
  private updateObjectCollisionFootprint(unit: ClientUnit): void {
    if (unit.unitType !== 'object') return
    const unitKey = unit.key
    this.clearObjectCollisionFootprint(unitKey)
    if (unit.hidden || unit.dead) return
    if (unit.x === 0 && unit.y === 0) return
    const meta = unit.objectMeta ?? CANONICAL_113C_OBJECTS[unit.classId]
    // 1.13c `UNITS_GetCollisionMask` (0x6fd7ff30): `subClass & OBJSUBCLASS_TOWNPORTAL (0x04)` -> `0x8000`
    if (((meta?.subClass ?? 0) & 0x04) !== 0) return

    if ((unit.classId === 341 || unit.classId === 342) && unit.mode === 2) {
      const halfX = Math.max(3, Math.ceil((meta?.sizeX ?? 11) / 2) + 1)
      const halfY = Math.max(2, Math.ceil((meta?.sizeY ?? 5) / 2) + 1)
      const cx = Math.floor(unit.x)
      const cy = Math.floor(unit.y)
      const unblocked: string[] = []
      for (let sy = cy - halfY; sy <= cy + halfY; sy++) {
        for (let sx = cx - halfX; sx <= cx + halfX; sx++) {
          const k = `${sx},${sy}`
          this._unblockedSubTiles.add(k)
          unblocked.push(k)
        }
      }
      this._objectUnblockedFootprints.set(unitKey, unblocked)
      this._collisionRevision++
      return
    }

    const sizeX = meta?.sizeX ?? 0
    const sizeY = meta?.sizeY ?? 0
    if (sizeX <= 0 || sizeY <= 0) return
    // 1.13c `Objects.txt` `HasCollision0..7`: collision is per anim-mode.
    const hcMask = meta?.hasCollisionMask ?? 0
    const modeBit = unit.mode >= 0 && unit.mode <= 7 ? unit.mode : 0
    const hasCollision = ((hcMask >>> modeBit) & 1) !== 0
    const left = Math.floor(unit.x) - (sizeX >>> 1)
    const bottom = Math.floor(unit.y) - (sizeY >>> 1)
    if (!hasCollision) {
      if (meta?.isDoor === true) {
        const unblocked: string[] = []
        for (let sy = bottom; sy < bottom + sizeY; sy++) {
          for (let sx = left; sx < left + sizeX; sx++) {
            const k = `${sx},${sy}`
            this._unblockedSubTiles.add(k)
            unblocked.push(k)
          }
        }
        this._objectUnblockedFootprints.set(unitKey, unblocked)
        this._collisionRevision++
      }
      return
    }
    const stamped: string[] = []
    const blockMissile =
      meta?.blockMissile === true || (meta?.isDoor === true && meta?.blocksVis === true)
    for (let sy = bottom; sy < bottom + sizeY; sy++) {
      for (let sx = left; sx < left + sizeX; sx++) {
        const k = `${sx},${sy}`
        this._blockedSubTiles.add(k)
        if (blockMissile) {
          this._missileBlockedSubTiles.add(k)
        }
        stamped.push(k)
      }
    }
    this._objectCollisionFootprints.set(unitKey, stamped)
    if (blockMissile) {
      this._objectMissileCollisionFootprints.set(unitKey, stamped)
    }
    this._collisionRevision++
  }

  /** Clears an object unit's stamped collision footprint (unit removal / world reset). */
  private clearObjectCollisionFootprint(unitKey: string): void {
    const prev = this._objectCollisionFootprints.get(unitKey)
    if (prev !== undefined) {
      for (const k of prev) {
        this._blockedSubTiles.delete(k)
      }
      this._objectCollisionFootprints.delete(unitKey)
      this._collisionRevision++
    }
    const prevMissile = this._objectMissileCollisionFootprints.get(unitKey)
    if (prevMissile !== undefined) {
      for (const k of prevMissile) {
        this._missileBlockedSubTiles.delete(k)
      }
      this._objectMissileCollisionFootprints.delete(unitKey)
    }
    const prevUnblocked = this._objectUnblockedFootprints.get(unitKey)
    if (prevUnblocked !== undefined) {
      for (const k of prevUnblocked) {
        this._unblockedSubTiles.delete(k)
      }
      this._objectUnblockedFootprints.delete(unitKey)
      this._collisionRevision++
    }
  }

  /**
   * Returns `true` when sub-tile `(subX, subY)` is blocked by a map wall/obstacle/closed door for walking.
   */
  isSubTileBlocked(subX: number, subY: number): boolean {
    const ix = Math.floor(subX)
    const iy = Math.floor(subY)
    const key = `${ix},${iy}`
    if (this._blockedSubTiles.size > 0 && this._blockedSubTiles.has(key)) return true
    if (this._unblockedSubTiles.size > 0 && this._unblockedSubTiles.has(key)) return false
    if (this._collisionChecker) {
      return Boolean(this._collisionChecker(ix, iy))
    }
    return false
  }

  /**
   * Returns `true` when sub-tile `(subX, subY)` blocks a missile with the given 1.13c `CollideType`.
   * - `CollideType === 0`: never blocked by terrain/walls (`false`).
   * - `CollideType === 8`: floor-hugging missiles blocked by `COLLIDE_WALL | COLLIDE_MISSILE_BARRIER | COLLIDE_DOOR` (`0x0805`).
   * - `CollideType === 1, 3, 6` (default `3`): flying missiles blocked by `COLLIDE_MISSILE_BARRIER | COLLIDE_DOOR` (`0x0804`).
   */
  isSubTileMissileBlocked(subX: number, subY: number, collideType = 3): boolean {
    if (collideType === 0) return false
    const ix = Math.floor(subX)
    const iy = Math.floor(subY)
    const key = `${ix},${iy}`
    if (this._missileBlockedSubTiles.size > 0 && this._missileBlockedSubTiles.has(key)) {
      return true
    }
    if (this._unblockedSubTiles.size > 0 && this._unblockedSubTiles.has(key)) {
      return false
    }
    if (this._missileCollisionChecker) {
      return Boolean(this._missileCollisionChecker(ix, iy, collideType))
    }
    if (this._collisionChecker) {
      return Boolean(this._collisionChecker(ix, iy))
    }
    return false
  }

  attachUnitOverlay(unit: ClientUnit, overlayToken: string, loop = false): ClientUnitOverlay {
    return attachUnitOverlayImpl.call(this as unknown as ClientWorldInternal, unit, overlayToken, loop)
  }

  attachServerOverlay(unit: ClientUnit, overlayIndex: number): ClientUnitOverlay | undefined {
    return attachServerOverlayImpl.call(this as unknown as ClientWorldInternal, unit, overlayIndex)
  }

  spawnMissileByKey(
    missileKey: string,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    opts?: SpawnMissileOptions,
  ): ClientUnit {
    return spawnMissileByKeyImpl.call(
      this as unknown as ClientWorldInternal,
      missileKey,
      startX,
      startY,
      targetX,
      targetY,
      opts,
    )
  }

  triggerMonsterGetHitFx(unit: ClientUnit): void {
    triggerMonsterGetHitFxImpl.call(this as unknown as ClientWorldInternal, unit)
  }

  triggerMonsterDeathFx(unit: ClientUnit): void {
    triggerMonsterDeathFxImpl.call(this as unknown as ClientWorldInternal, unit)
  }

  /** Current 1.13c D2Client screen shake state (`0x6fb3afd0`). */
  get screenShake(): Readonly<ScreenShakeState> {
    return this._screenShake
  }

  /** Override the 1.13c quest FX client RNG seed (`gpPlayer->pSeed` stand-in). */
  setQuestFxSeed(lo: number, hi = LIGHT_SEED_HI): void {
    this._questFxSeed = { lo: lo >>> 0, hi: hi >>> 0 }
  }

  startScreenShake(sustainMs: number, amplitude: number, rampUpMs = 0, rampDownMs = 0): void {
    startScreenShakeImpl.call(this as unknown as ClientWorldInternal, sustainMs, amplitude, rampUpMs, rampDownMs)
  }

  private updateScreenShake(): void {
    updateScreenShakeImpl.call(this as unknown as ClientWorldInternal)
  }

  spawnDenOfEvilLightsInRoom(
    roomSubX: number,
    roomSubY: number,
    roomSubW: number,
    roomSubH: number,
  ): ClientUnit[] {
    return spawnDenOfEvilLightsInRoomImpl.call(
      this as unknown as ClientWorldInternal,
      roomSubX,
      roomSubY,
      roomSubW,
      roomSubH,
    )
  }

  spawnCairnStonesController(stoneX: number, stoneY: number): ClientUnit {
    return spawnCairnStonesControllerImpl.call(this as unknown as ClientWorldInternal, stoneX, stoneY)
  }

  spawnDiabloAppearsController(x: number, y: number): ClientUnit {
    return spawnDiabloAppearsControllerImpl.call(this as unknown as ClientWorldInternal, x, y)
  }

  spawnCompellingOrbMist(orb: ClientUnit): ClientUnit {
    return spawnCompellingOrbMistImpl.call(this as unknown as ClientWorldInternal, orb)
  }

  spawnHoradricStaffAtOrifice(orifice: ClientUnit): ClientUnit {
    return spawnHoradricStaffAtOrificeImpl.call(this as unknown as ClientWorldInternal, orifice)
  }

  private spawnHoradricStaffChild(spawn: HoradricStaffSpawn, staff: ClientUnit): ClientUnit {
    return spawnHoradricStaffChildImpl.call(this as unknown as ClientWorldInternal, spawn, staff)
  }

  private spawnCairnSkyBolt(x: number, y: number, parent: ClientUnit): ClientUnit {
    return spawnCairnSkyBoltImpl.call(this as unknown as ClientWorldInternal, x, y, parent)
  }

  private isCrossbowEquipped(caster: ClientUnit): boolean {
    return isCrossbowEquippedImpl.call(this as unknown as ClientWorldInternal, caster)
  }

  private resolveThrowMissileKeyForCaster(caster: ClientUnit, skillId: number): string {
    return resolveThrowMissileKeyForCasterImpl.call(this as unknown as ClientWorldInternal, caster, skillId)
  }

  private resolveCastActionFrameDelayMs(
    unit: ClientUnit,
    mode: number,
    skillId: number,
    _seqNum: number,
    stepSpeed256: number,
    durationMs: number,
  ): number {
    return resolveCastActionFrameDelayMsImpl.call(
      this as unknown as ClientWorldInternal,
      unit,
      mode,
      skillId,
      _seqNum,
      stepSpeed256,
      durationMs,
    )
  }

  spawnMonsterModeMissile(
    unit: ClientUnit,
    mode?: number,
    targetX?: number,
    targetY?: number,
  ): ClientUnit | undefined {
    return spawnMonsterModeMissileImpl.call(
      this as unknown as ClientWorldInternal,
      unit,
      mode,
      targetX,
      targetY,
    )
  }

  private spawnMissilesForSkill(
    caster: ClientUnit,
    skillId: number,
    targetX: number,
    targetY: number,
    skillLevel = 1,
    isSecondHand = false,
  ): void {
    spawnMissilesForSkillImpl.call(
      this as unknown as ClientWorldInternal,
      caster,
      skillId,
      targetX,
      targetY,
      skillLevel,
      isSecondHand,
    )
  }

  private applySkillCastToUnit(
    unit: ClientUnit,
    skillId: number,
    targetX: number,
    targetY: number,
    skillLevel = 1,
    spawnVisuals = true,
    nowMs?: number,
  ): void {
    applySkillCastToUnitImpl.call(
      this as unknown as ClientWorldInternal,
      unit,
      skillId,
      targetX,
      targetY,
      skillLevel,
      spawnVisuals,
      nowMs,
    )
  }

  private removePaladinAuraStatesAndOverlays(unit?: ClientUnit, isSelf = false): void {
    removePaladinAuraStatesAndOverlaysImpl.call(this as unknown as ClientWorldInternal, unit, isSelf)
  }

  private syncSelfRightHandAuraState(skillId: number): void {
    syncSelfRightHandAuraStateImpl.call(this as unknown as ClientWorldInternal, skillId)
  }

  noteOutgoingCommand(
    cmd: ClientCommand,
    nowMs?: number,
    selfXOverride?: number,
    selfYOverride?: number,
  ): void {
    noteOutgoingCommandImpl.call(
      this as unknown as ClientWorldInternal,
      cmd,
      nowMs,
      selfXOverride,
      selfYOverride,
    )
  }

  onChange(cb: (ev: ServerEvent) => void): () => void {
    this._changeListeners.add(cb)
    return () => {
      this._changeListeners.delete(cb)
    }
  }

  get self(): SelfPlayerState {
    return this._self
  }

  readonly skillHotkeys = new Map<number, { hand: 'left' | 'right'; skill: number; itemId?: number }>()

  assignSkillHotkey(slot: number, hand: 'left' | 'right', skill: number, itemId?: number): void {
    if (skill === 0xffff || skill === 0x7fff || skill < 0) {
      this.skillHotkeys.delete(slot)
      return
    }
    const normItemId = itemId ?? 0xffffffff
    // 1.13c D2Client.dll 0x6faed280..0x6faed2e5: deduplicate any other slot (0..15)
    // previously bound to the same (hand, skill, itemId) tuple.
    for (const [existingSlot, existing] of Array.from(this.skillHotkeys.entries())) {
      if (existingSlot === slot) continue
      const existingItemId = existing.itemId ?? 0xffffffff
      if (existing.hand === hand && existing.skill === skill && existingItemId === normItemId) {
        this.skillHotkeys.delete(existingSlot)
      }
    }
    this.skillHotkeys.set(slot, itemId !== undefined ? { hand, skill, itemId } : { hand, skill })
  }

  get player(): SelfPlayerState {
    return this._self
  }

  get monsters(): Map<number, ClientUnit> {
    return this._monsters
  }

  get merc(): MercenaryState | null {
    return this._merc
  }

  get pets(): ReadonlyMap<number, RosterPetState> {
    return this._pets
  }

  get units(): UnitMap {
    return this._units
  }

  get entities(): UnitMap {
    return this._units
  }

  get containers(): ClientItemContainers {
    return this._containers
  }

  get revealedRooms(): ReadonlySet<string> {
    return this._revealedRooms
  }

  /**
   * Distinct area ids of the rooms currently revealed by the server (`0x07` minus `0x08`), in
   * first-seen order. Used to resolve which level contains the player's server position (#539).
   */
  getRevealedAreaIds(): number[] {
    if (this._revealedAreaIdsCache === null) {
      const out: number[] = []
      for (const key of this._revealedRooms) {
        const areaId = Number(key.slice(0, key.indexOf(':')))
        if (areaId > 0 && !out.includes(areaId)) out.push(areaId)
      }
      this._revealedAreaIdsCache = out
    }
    return this._revealedAreaIdsCache
  }

  /**
   * Resolves the `areaId` of the revealed room (`0x07`) containing world sub-tile `(subX, subY)`.
   * Uses the exact DRLG room rectangle (`subX, subY, subW, subH`) when registered via
   * `setRevealedRoomSeed` (since `LvlMaze.txt` / `LvlPrest.txt` rooms can be 8×8, 12×12, 16×16,
   * 24×24, etc. floor-tiles), falling back to an 8×8 floor-tile (`40×40` sub-tile) box otherwise.
   */
  resolveAreaFromRevealedRooms(subX: number, subY: number): number {
    if (this._revealedRooms.size === 0 || (subX === 0 && subY === 0)) return 0
    const tx = Math.floor(subX / 5)
    const ty = Math.floor(subY / 5)
    for (const key of this._revealedRooms) {
      const seeded = this._revealedRoomSeeds.get(key)
      if (seeded && seeded.areaId > 0) {
        if (
          subX >= seeded.subX &&
          subX < seeded.subX + seeded.subW &&
          subY >= seeded.subY &&
          subY < seeded.subY + seeded.subH
        ) {
          return seeded.areaId
        }
        continue
      }
      const firstColon = key.indexOf(':')
      const secondColon = key.indexOf(':', firstColon + 1)
      if (firstColon <= 0 || secondColon <= firstColon) continue
      const areaId = Number(key.slice(0, firstColon))
      const rx = Number(key.slice(firstColon + 1, secondColon))
      const ry = Number(key.slice(secondColon + 1))
      if (areaId > 0 && tx >= rx && tx < rx + 8 && ty >= ry && ty < ry + 8) {
        return areaId
      }
    }
    return 0
  }

  /**
   * 1.13c `DUNGEON_AllocRoom1` (`0x6fd8c720`) / `DRLGROOM_AllocRoom1` (`0x6fd7e27c`):
   * registers the active client room's `pRoom1->pSeed` (`[+0x6c, +0x70]`, initialized via
   * `SEED_InitLowSeed(&pRoom1->pSeed, roomInitSeed)`) so units spawned inside the room derive
   * their `unit->pSeed` from `pRoom1->pSeed` (`0x6fb57400` / `0x6fb57630` / `0x6fb57780`).
   */
  setRevealedRoomSeed(
    areaId: number,
    tileX: number,
    tileY: number,
    roomInitSeed: number,
    subX = tileX * 5,
    subY = tileY * 5,
    subW = 40,
    subH = 40,
    seededFromDrlg = true,
  ): void {
    const key = `${areaId}:${tileX}:${tileY}`
    const existing = this._revealedRoomSeeds.get(key)
    if (existing && (existing.seededFromDrlg || !seededFromDrlg)) {
      return
    }
    const seed: D2SeedStrc = { lo: 1, hi: 666 }
    SEED_InitLowSeed(seed, roomInitSeed)
    this._revealedRoomSeeds.set(key, {
      areaId,
      tileX,
      tileY,
      subX,
      subY,
      subW,
      subH,
      seed,
      seededFromDrlg,
    })
    if (
      areaId > 0 &&
      areaId !== this.areaId &&
      (this._self.x !== 0 || this._self.y !== 0) &&
      this._self.x >= subX &&
      this._self.x < subX + subW &&
      this._self.y >= subY &&
      this._self.y < subY + subH
    ) {
      this.areaId = areaId
      this.syncPlayerTownModes()
    }
  }

  /**
   * 1.13c client unit creation seed chain:
   * - `UNITS_AllocUnit` (`0x6fd85e10`) sets `SEED_InitSeed(&unit->pSeed)` (`{ lo: 1, hi: 666 }`).
   * - `S2C 0x51` (`0x6fb57400` @ `0x6fb57475..0x6fb574bd`), `S2C 0x59` (`0x6fb57630` @ `0x6fb576ac..0x6fb576fc`),
   *   and `S2C 0xAC` (`0x6fb57780` @ `0x6fb57816..0x6fb5785d`) look up `pRoom1 = DUNGEON_GetRoomAtPosition(gpAct, x, y)`
   *   and, if found, roll `nextLo = SEED_RollRandomNumber(&pRoom1->pSeed)` and call
   *   `SEED_InitLowSeed(&unit->pSeed, nextLo)`.
   */
  private seedUnitFromActiveRoom(unit: ClientUnit, existed: boolean): void {
    // 0x51 (object / tile) always replaces any existing unit with the same (type, id) (0x6fb57360);
    // 0x59 (player) and 0xAC (monster) only allocate and seed a unit when it was not already present.
    if (existed && unit.unitType !== 'object' && unit.unitType !== 'tile') {
      return
    }
    SEED_InitSeed(unit.seed)
    unit.initSeed = 1
    if (unit.x === 0 && unit.y === 0) return
    for (const room of this._revealedRoomSeeds.values()) {
      if (
        unit.x >= room.subX &&
        unit.x < room.subX + room.subW &&
        unit.y >= room.subY &&
        unit.y < room.subY + room.subH
      ) {
        const nextLo = SEED_RollRandomNumber(room.seed) >>> 0
        unit.initSeed = nextLo
        SEED_InitLowSeed(unit.seed, nextLo)
        return
      }
    }
  }

  private isSelfUnit(u: ClientUnit): boolean {
    return u.unitType === 'player' && (u.id === this.selfId || (this.selfId === 0 && u.id === 1))
  }

  /**
   * D2Client.dll 0x6FB5CA40 / 0x6FAD1D60: checks whether a monster unit ID belongs to the local
   * player's living mercenary (`dwPetType == 7` in `g_pRosterPetList`, or active `this._merc`).
   */
  private isOwnMercUnitId(unitId: number): boolean {
    if (unitId === 0) return false
    if (this._merc && !this._merc.isDead && this._merc.mercId === unitId) {
      return true
    }
    const pet = this._pets.get(unitId)
    if (
      pet &&
      pet.petType === 7 &&
      !pet.isDead &&
      (pet.ownerId === this.selfId || (this.selfId === 0 && pet.ownerId === 1))
    ) {
      return true
    }
    return false
  }

  private isOwnMercUnit(u: ClientUnit): boolean {
    return u.unitType === 'monster' && !u.dead && this.isOwnMercUnitId(u.id)
  }

  private isOwnPetUnitId(unitId: number): boolean {
    if (unitId === 0) return false
    const pet = this._pets.get(unitId)
    if (
      pet &&
      !pet.isDead &&
      (pet.ownerId === this.selfId || (this.selfId === 0 && pet.ownerId === 1))
    ) {
      return true
    }
    return false
  }

  /**
   * Resolves a known monster `classId` (`hcIdx`) from the local mercenary / roster pet table
   * (`0x81 AssignMerc` / `g_pRosterPetList`) when a monster unit is created or referenced by ID
   * before `0xAC AssignNPC` arrives.
   */
  private resolveKnownMonsterClassId(id: number): number {
    if (id === 0) return 0
    if (this._merc && this._merc.mercId === id && this._merc.classId > 0) {
      return this._merc.classId
    }
    const pet = this._pets.get(id)
    if (pet && pet.classId > 0) {
      return pet.classId
    }
    return 0
  }

  private removeNonSelfUnit(u: ClientUnit): void {
    if (this.isSelfUnit(u)) return
    if (u.unitType === 'item') {
      this._containers.removeGroundItemById(u.id)
    } else if (u.unitType === 'player') {
      this._containers.removePlayerEquipment(u.id)
      this._playerPathUnits.delete(u.id)
    } else if (u.unitType === 'monster') {
      this._monsters.delete(u.id)
      this.npcMotion.removeMonster(u.id)
    } else if (u.unitType === 'object') {
      this.clearObjectCollisionFootprint(u.key)
      this.clearObjectNpcInteraction(u.id)
    }
    this._units.delete(u.key)
    this._portals.delete(u.id)
  }

  /**
   * Prunes non-self world units, revealed rooms, ground items, and blocked sub-tiles
   * when transitioning from an active area (`this.areaId !== 0`) via `LoadAct` (`0x03`).
   */
  pruneNonSelfUnitsOnAreaTransition(): void {
    this._revealedRooms.clear()
    this._revealedRoomSeeds.clear()
    this._revealedAreaIdsCache = null
    this._portals.clear()
    this._blockedSubTiles.clear()
    this._missileBlockedSubTiles.clear()
    this._unblockedSubTiles.clear()
    this._objectCollisionFootprints.clear()
    this._objectMissileCollisionFootprints.clear()
    this._objectUnblockedFootprints.clear()
    this._collisionRevision++
    this._containers.clearGround()
    for (const u of Array.from(this._units.values())) {
      if (!this.isSelfUnit(u)) {
        this.removeNonSelfUnit(u)
      }
    }
    this._monsters.clear()
    this.npcMotion.clear()
  }

  /**
   * Prunes non-self units (especially dead corpses, monsters, objects, missiles, warps, and ground items)
   * whose sub-tile `(x, y)` lies inside the DRLG room `[tileX * 5, tileX * 5 + subW) × [tileY * 5, tileY * 5 + subH)`
   * (8×8, 12×12, 16×16, etc. floor-tiles) hidden by `RoomHide` (`0x08`) and is no longer
   * covered by any still-revealed room.
   */
  private pruneUnitsInHiddenRoom(
    tileX: number,
    tileY: number,
    subW = 40,
    subH = 40,
  ): void {
    const minSubX = tileX * 5
    const minSubY = tileY * 5
    const maxSubX = minSubX + Math.max(40, subW)
    const maxSubY = minSubY + Math.max(40, subH)
    for (const u of Array.from(this._units.values())) {
      if (this.isSelfUnit(u) || this.isOwnMercUnit(u)) continue
      if (u.x === 0 && u.y === 0) continue
      if (u.x >= minSubX && u.x < maxSubX && u.y >= minSubY && u.y < maxSubY) {
        if (this.resolveAreaFromRevealedRooms(u.x, u.y) === 0) {
          this.removeNonSelfUnit(u)
        }
      }
    }
    for (const item of Array.from(this._containers.ground.values())) {
      if (item.x === 0 && item.y === 0) continue
      if (item.x >= minSubX && item.x < maxSubX && item.y >= minSubY && item.y < maxSubY) {
        if (this.resolveAreaFromRevealedRooms(item.x, item.y) === 0) {
          this._containers.removeItemById(item.id)
          this._units.delete(makeUnitKey('item', item.id))
        }
      }
    }
  }

  /**
   * Prunes stale corpses, far-away transient missiles, ground items, and far-away non-self units
   * left behind in unrevealed rooms when walking/teleporting across area boundaries.
   * Units and items in still-revealed rooms (`unitRoomArea > 0`) within `maxDistanceSubTiles`
   * are preserved across area borders for seamless multi-level rendering.
   */
  pruneStaleUnitsOutsideArea(selfX: number, selfY: number, maxDistanceSubTiles = 180): number {
    let pruned = 0
    for (const u of Array.from(this._units.values())) {
      if (this.isSelfUnit(u) || this.isOwnMercUnit(u)) continue
      const dist = Math.hypot(u.x - selfX, u.y - selfY)
      // Dead monsters only: a player body (dead UNIT_PLAYER, Issue #922) lives on the server until picked up, and the
      // server does not re-send it (0x59 / 0x0D / 0x74) while its room stays active for this client.
      const isDeadMonster =
        u.unitType === 'monster' && (u.dead || u.mode === 0 || u.mode === 12 || u.lifePct <= 0)
      const unitRoomArea =
        this._revealedRooms.size > 0 ? this.resolveAreaFromRevealedRooms(u.x, u.y) : 0
      const unrevealedFar =
        this._revealedRooms.size > 0 &&
        unitRoomArea === 0 &&
        dist > 60 &&
        u.unitType !== 'tile'
      if (
        u.unitType === 'missile' ||
        dist > maxDistanceSubTiles ||
        unrevealedFar ||
        (isDeadMonster && dist > 80)
      ) {
        this.removeNonSelfUnit(u)
        pruned += 1
      }
    }
    for (const item of Array.from(this._containers.ground.values())) {
      const dist = Math.hypot(item.x - selfX, item.y - selfY)
      const itemRoomArea =
        this._revealedRooms.size > 0 ? this.resolveAreaFromRevealedRooms(item.x, item.y) : 0
      const unrevealedFar =
        this._revealedRooms.size > 0 && itemRoomArea === 0 && dist > 60
      if (dist > maxDistanceSubTiles || unrevealedFar) {
        this._containers.removeItemById(item.id)
        this._units.delete(makeUnitKey('item', item.id))
        pruned += 1
      }
    }
    return pruned
  }

  get waypoints(): ReadonlySet<number> {
    return this._waypoints
  }

  /** Waypoint object unit id from the last `0x63 WaypointMenu`, required by `0x49 WaypointGo`. */
  get waypointUnitId(): number | null {
    return this._waypointUnitId
  }

  get lastWaypointUnitId(): number | null {
    return this._waypointUnitId
  }

  get waypointMenuSeq(): number {
    return this._waypointMenuSeq
  }

  get waypointOpen(): boolean {
    return this._waypointOpen
  }

  clearWaypointInteraction(): void {
    this._waypointOpen = false
    this._waypointUnitId = null
  }

  get quests(): Uint16Array {
    return this._quests
  }

  get hasQuestInfo(): boolean {
    return this._hasQuestInfo
  }

  get gameQuestLog(): Uint16Array {
    return this._gameQuestLog
  }

  get questItemState(): Uint16Array {
    return this._questItemState
  }

  get questHistory(): Uint8Array {
    return this._questHistory
  }

  get gameQuestAvailability(): Uint8Array {
    return this._gameQuestAvailability
  }

  canGoToAct(act: number): boolean {
    return this._canGoToAct.has(act) || this._canGoToAct.has(act + 1)
  }

  get canGoToActFlags(): ReadonlySet<number> {
    return this._canGoToAct
  }

  get questStatus(): {
    readonly questId: number
    readonly alertFlags: number
    readonly filterStatus: number
    readonly extra: number
  } | null {
    return this._questStatus
  }

  get specialQuestEvent(): number {
    return this._specialQuestEvent
  }

  get gameQuests(): Uint16Array {
    return this._gameQuests
  }

  get questLog(): QuestLogState {
    return this._questLog
  }

  get questStatusBytes(): Uint8Array {
    return this._questLog.statusBytes
  }

  get denMonstersRemaining(): number {
    return this._questLog.den
  }

  get questBarbsRemaining(): number {
    return this._questLog.barbs
  }

  get questTombOffset(): number {
    return this._questLog.tombOffset
  }

  get party(): ReadonlyMap<number, PartyMemberState> {
    return this._party
  }

  get corpses(): ReadonlyMap<number, number> {
    return this._corpses
  }

  get trade(): Readonly<TradeSessionState> {
    return this._trade
  }

  get chatLog(): readonly ChatLogEntry[] {
    return this._chatLog
  }

  get messageLog(): readonly ChatLogEntry[] {
    return this._chatLog
  }

  get messageLogEntries(): readonly ChatLogEntry[] {
    return this._chatLog
  }

  get activeChatStream(): readonly ChatLogEntry[] {
    return this._activeChatStream
  }

  get activeChatOverlayEntries(): readonly ChatLogEntry[] {
    return this._activeChatStream
  }

  get lang(): 'CHI' | 'ENG' {
    return this._lang ?? getTblLang()
  }

  set lang(value: 'CHI' | 'ENG') {
    this._lang = value
  }

  get lastWhisperTarget(): string | null {
    return this._lastWhisperTarget
  }

  set lastWhisperTarget(target: string | null) {
    this._lastWhisperTarget = target && target.trim() ? target.trim() : null
  }

  expireChatAndOverhead(nowMs?: number): void {
    expireChatAndOverheadImpl.call(this as unknown as ClientWorldInternal, nowMs)
  }

  getActiveChatOverlayEntries(nowMs?: number): readonly ChatLogEntry[] {
    this.expireChatAndOverhead(nowMs)
    return this._activeChatStream
  }

  clearActiveChatOverlay(): void {
    this._activeChatStream.length = 0
  }

  clearActiveScreenMessages(): void {
    this.clearActiveChatOverlay()
  }

  clearMessageLog(): void {
    this._chatLog.length = 0
    this._activeChatStream.length = 0
  }

  addLocalSystemMessage(text: string, color = 4, nowMs?: number): ChatLogEntry {
    return addLocalSystemMessageImpl.call(this as unknown as ClientWorldInternal, text, color, nowMs)
  }

  addSystemChatMessage(text: string, color = 4, nowMs?: number): ChatLogEntry {
    return this.addLocalSystemMessage(text, color, nowMs)
  }

  setPlayerSquelched(unitId: number, squelched: boolean): void {
    setPlayerSquelchedImpl.call(this as unknown as ClientWorldInternal, unitId, squelched)
  }

  togglePlayerSquelched(unitId: number): boolean {
    const next = !this.isPlayerSquelched(unitId, this._party.get(unitId)?.charName)
    this.setPlayerSquelched(unitId, next)
    return next
  }

  setPlayerIgnored(unitId: number, ignored: boolean): void {
    setPlayerIgnoredImpl.call(this as unknown as ClientWorldInternal, unitId, ignored)
  }

  togglePlayerIgnored(unitId: number): boolean {
    const next = !this.isPlayerIgnored(unitId, this._party.get(unitId)?.charName)
    this.setPlayerIgnored(unitId, next)
    return next
  }

  isPlayerSquelched(unitIdOrName?: number | string, charName?: string): boolean {
    return isPlayerSquelchedImpl.call(this as unknown as ClientWorldInternal, unitIdOrName, charName)
  }

  isPlayerIgnored(unitIdOrName?: number | string, charName?: string): boolean {
    return isPlayerIgnoredImpl.call(this as unknown as ClientWorldInternal, unitIdOrName, charName)
  }

  get portals(): ReadonlyMap<number, PortalState> {
    return this._portals
  }

  stepUnitTurns(dtMs = 40): void {
    if (!Number.isFinite(dtMs)) {
      throw new RangeError(`dtMs must be a finite number, got ${String(dtMs)}`)
    }
    for (const unit of this._units.values()) {
      if (unit.dead) continue
      unit.advanceTurn(dtMs)
    }
  }

  private triggerMissileImpact(
    missile: ClientUnit,
    hitX: number,
    hitY: number,
    isWallHit: boolean,
    hitUnit?: ClientUnit,
  ): void {
    triggerMissileImpactImpl.call(
      this as unknown as ClientWorldInternal,
      missile,
      hitX,
      hitY,
      isWallHit,
      hitUnit,
    )
  }

  private isFriendlyOrNonHostileMonster(m: ClientUnit, ignoreDead = false): boolean {
    return isFriendlyOrNonHostileMonsterImpl.call(this as unknown as ClientWorldInternal, m, ignoreDead)
  }

  private syncPlayerTownModes(): void {
    syncPlayerTownModesImpl.call(this as unknown as ClientWorldInternal)
  }

  private stepMissileUnit(unit: ClientUnit): void {
    stepMissileUnitImpl.call(this as unknown as ClientWorldInternal, unit)
  }

  expireCastStates(nowMs?: number, dtMs = 0): void {
    expireCastStatesImpl.call(this as unknown as ClientWorldInternal, nowMs, dtMs)
  }

  tick(dtMs = 40, nowMs?: number): void {
    tickWorldImpl.call(this as unknown as ClientWorldInternal, dtMs, nowMs)
  }

  tickWorld(dtMs = 40, nowMs?: number): void {
    tickWorldImpl.call(this as unknown as ClientWorldInternal, dtMs, nowMs)
  }

  private stepDiscreteSimulationTick(_tickDtMs = 40, nowMs?: number): void {
    stepDiscreteSimulationTickImpl.call(this as unknown as ClientWorldInternal, _tickDtMs, nowMs)
  }

  listUnits(): ClientUnit[] {
    return Array.from(this._units.values())
  }

  getUnit(unitType: UnitType, id: number): ClientUnit | undefined {
    return this._units.get(makeUnitKey(unitType, id))
  }

  getUnitsByType(unitType: UnitType): ClientUnit[] {
    const typeName = unitTypeFromId(unitType)
    const out: ClientUnit[] = []
    for (const u of this._units.values()) {
      if (u.unitType === typeName) {
        out.push(u)
      }
    }
    return out
  }

  /**
   * Returns true if there is an active (non-dead, non-corpse) dynamic monster/NPC with the given hcIdx.
   */
  hasActiveMonsterNpc(hcIdx: number): boolean {
    for (const m of this._monsters.values()) {
      if (m.classId === hcIdx && !m.dead && m.mode !== 12) {
        return true
      }
    }
    return false
  }

  /**
   * Reconciles visibility of static object placeholders (e.g. Objects.txt ID 121/122 for Jerhyn)
   * corresponding to the given dynamic NPC hcIdx (#900).
   */
  reconcileNpcPlaceholderObjects(hcIdx: number): void {
    const hasNpc = this.hasActiveMonsterNpc(hcIdx)
    for (const u of this._units.values()) {
      if (u.unitType === 'object') {
        const placeholderHcIdx = getNpcPlaceholderHcIdx(u.classId)
        if (placeholderHcIdx === hcIdx) {
          if (u.hidden !== hasNpc) {
            u.hidden = hasNpc
            this.updateObjectCollisionFootprint(u)
          }
        }
      }
    }
  }

  private reconcileOwnMercOwnerAndPosition(selfX: number, selfY: number): void {
    if (this.selfId !== 0) {
      if (this._merc && this._merc.ownerId === 0) {
        this._merc.ownerId = this.selfId
      }
      for (const pet of this._pets.values()) {
        if (pet.ownerId === 0) {
          ;(pet as { ownerId: number }).ownerId = this.selfId
        }
      }
    }
    if (selfX === 0 && selfY === 0) return
    const mercId = this._merc?.mercId || this._self.mercId || 0
    if (mercId <= 0 || this._merc?.isDead) return
    const mercUnit = this._units.get(makeUnitKey('monster', mercId))
    if (!mercUnit || mercUnit.dead || mercUnit.mode === 0 || mercUnit.mode === 12) return
    if (
      (mercUnit.x === 0 && mercUnit.y === 0) ||
      Math.hypot(mercUnit.x - selfX, mercUnit.y - selfY) > 60
    ) {
      mercUnit.x = selfX
      mercUnit.y = selfY
      mercUnit.targetX = selfX
      mercUnit.targetY = selfY
      this._monsters.set(mercUnit.id, mercUnit)
      if (!this.npcMotion.getUnit(mercUnit.id)) {
        if (mercUnit.classId > 0) {
          this.npcMotion.spawnMonster({
            unitId: mercUnit.id,
            classId: mercUnit.classId,
            x: selfX,
            y: selfY,
            mode: mercUnit.mode,
            direction: mercUnit.direction,
            lifePct: mercUnit.lifePct,
            isDead: false,
            ...(mercUnit.velocityPercent !== undefined ? { stat67: mercUnit.velocityPercent } : {}),
          })
        }
      } else {
        this.npcMotion.reassignMonster(mercUnit.id, selfX, selfY)
      }
    }
  }

  private ensureUnit(unitType: UnitType, id: number): ClientUnit {
    const key = makeUnitKey(unitType, id)
    let unit = this._units.get(key)
    const typeName = unitTypeFromId(unitType)
    const knownMonsterClassId = typeName === 'monster' ? this.resolveKnownMonsterClassId(id) : 0
    if (!unit) {
      const isOwnMercOrPet =
        typeName === 'monster' && (this.isOwnMercUnitId(id) || this.isOwnPetUnitId(id))
      const initX = isOwnMercOrPet && (this._self.x !== 0 || this._self.y !== 0) ? this._self.x : 0
      const initY = isOwnMercOrPet && (this._self.x !== 0 || this._self.y !== 0) ? this._self.y : 0
      unit = new ClientUnit({
        unitType: typeName,
        id,
        classId: knownMonsterClassId,
        x: initX,
        y: initY,
        ...(typeName === 'player' ? { mode: isTownLevel(this.areaId) ? 5 : 1 } : {}),
      })
      if (typeName === 'monster') {
        const pet = this._pets.get(id)
        if (pet) {
          unit.ownerType = 'player'
          unit.ownerId = pet.ownerId || this.selfId
        }
        if (this._merc && this._merc.mercId === id) {
          for (const [statId, val] of this._merc.stats) {
            unit.stats.set(statId, val)
          }
        }
      }
      this._units.set(key, unit)
      if (typeName === 'monster' && isOwnMercOrPet && knownMonsterClassId > 0) {
        this._monsters.set(id, unit)
        if (!this.npcMotion.getUnit(id) && (initX !== 0 || initY !== 0)) {
          this.npcMotion.spawnMonster({
            unitId: id,
            classId: knownMonsterClassId,
            x: initX,
            y: initY,
            mode: unit.mode,
            direction: unit.direction,
            lifePct: unit.lifePct,
            isDead: unit.dead,
          })
        }
      }
    } else if (typeName === 'monster' && unit.classId === 0 && knownMonsterClassId > 0) {
      unit.classId = knownMonsterClassId
    }
    return unit
  }

  /**
   * Resolves a world unit for generic unit-targeted events (`UnitMode`, `StateSet`, `StateEnd`, etc.).
   * Container-owned items (`!this._containers.ground.has(id)`) reside exclusively in `this._containers`
   * and must never be instantiated as phantom world units at `(0, 0)` in `this._units`.
   */
  private ensureWorldOrGroundUnit(unitType: UnitType, id: number): ClientUnit | undefined {
    if (unitTypeFromId(unitType) === 'item' && !this._containers.ground.has(id)) {
      return this.getUnit(unitType, id)
    }
    return this.ensureUnit(unitType, id)
  }

  applyEvent(ev: ServerEvent | Record<string, any>, nowMs?: number): void {
    this.apply(ev as ServerEvent, nowMs)
  }

  applyServerEvent(ev: ServerEvent | Record<string, any>, nowMs?: number): void {
    this.apply(ev as ServerEvent, nowMs)
  }

  apply(rawEv: ServerEvent | Record<string, any>, nowMs?: number): void {
    applyWorldEventImpl.call(this as unknown as ClientWorldInternal, rawEv, nowMs)
  }

  private applyUnitModeImmediate(
    unit: ClientUnit,
    ev: Extract<ServerEvent, { readonly type: 'UnitMode' }>,
    nowMs?: number,
  ): void {
    applyUnitModeImmediateImpl.call(this as unknown as ClientWorldInternal, unit, ev, nowMs)
  }

  reset(): void {
    this.act = 0
    this.mapSeed = 0
    this.objectSeed = 0
    this.difficulty = 0
    this.hardcore = false
    this.expansion = true
    this.ladder = false
    this.areaId = 0
    this.loading = true
    this.selfId = 0
    this.frameCount = 0
    this.lastRttMs = null
    this._isSelfDead = false
    this._self.reset()
    this._merc = null
    this._mercHireList.length = 0
    this._pets.clear()
    this._units.clear()
    this._monsters.clear()
    this._playerPathUnits.clear()
    this._setBonusStatesByPlayerId.clear()
    this.npcMotion.clear()
    this._containers.clear()
    this._revealedRooms.clear()
    this._revealedRoomSeeds.clear()
    this._revealedAreaIdsCache = null
    this._waypoints.clear()
    this._waypointUnitId = null
    this._waypointMenuSeq = 0
    this._waypointOpen = false
    this._quests = new Uint16Array(48)
    this._hasQuestInfo = false
    this._gameQuestLog = new Uint16Array(48)
    this._questItemState = new Uint16Array(7)
    this._questHistory = new Uint8Array(41)
    this._gameQuestAvailability = new Uint8Array(37)
    this._questStatus = null
    this._specialQuestEvent = 0
    this._gameQuests = new Uint16Array(48)
    this._questLog.reset()
    this._hasPlayerQuests = false
    this._party.clear()
    this._corpses.clear()
    this._trade.active = false
    this._trade.lastAction = 0
    this._trade.pendingModal = null
    this._trade.partnerId = undefined
    this._trade.partnerName = undefined
    this._trade.partnerGold = 0
    this._trade.selfGold = 0
    this._trade.selfAccepted = false
    this._trade.partnerAccepted = false
    this._trade.acceptDisabled = false
    this._npcInteraction = { npcId: null, window: 'none', activeWindow: 'none', stashOpen: false, cubeOpen: false }
    this._awaitingArtisanConfirmNpcId = null
    this._npcInfoByUnitId.clear()
    this._pendingWantsInteractUnitIds.clear()
    this._lastNpcTransaction = null
    this._chatLog.length = 0
    this._activeChatStream.length = 0
    this._nextChatEntryId = 1
    this._lastWhisperTarget = null
    this._squelchedPlayerIds.clear()
    this._ignoredPlayerIds.clear()
    this._squelchedPlayerNames.clear()
    this._ignoredPlayerNames.clear()
    this._portals.clear()
    this._nextMissileId = 0x70000000
    this._nextOverlayId = 1
    this._lastLocalCastSkillId = -1
    this._lastLocalCastAtMs = -1000
    this._simTimeMs = 0
    this._timeMs = 0
    this._tickAccumulatorMs = 0
    this._notedCommands = new WeakSet<object>()
    this._blockedSubTiles.clear()
    this._missileBlockedSubTiles.clear()
    this._unblockedSubTiles.clear()
    this._objectCollisionFootprints.clear()
    this._objectMissileCollisionFootprints.clear()
    this._objectUnblockedFootprints.clear()
    this._collisionRevision++
    this._pendingBeltPickupItemIds.clear()
    this._pendingGambleIdentifyItemIds.length = 0
    this._pendingGambleBuyCount = 0
    this._soundRequests.length = 0
    // Missile ids restart at 0x70000000: stop every running travel sound now so a reused id cannot keep it (#991).
    for (const entityId of this._soundMissileIds) {
      this._soundRequests.push({ kind: 'missile-destroy', entityId })
    }
    this._soundMissileIds.clear()
    for (const objectId of this._soundLoopObjectIds) {
      this._soundRequests.push({
        kind: 'unit-loop-stop',
        unit: { unitType: 'object', id: objectId },
      })
    }
    this._soundLoopObjectIds.clear()
    this._deadSoundUnitIds.clear()
    this._speechPendingCount = 0
    this._clockMs = null
    this._clockExplicit = false
    this._questFxSeed = { lo: 1, hi: LIGHT_SEED_HI }
    this._screenShake = {
      active: false,
      startMs: 0,
      rampUpMs: 0,
      sustainMs: 0,
      rampDownMs: 0,
      amplitude: 0,
      offsetX: 0,
      offsetY: 0,
    }
  }

  executeCharsiImbue(
    itemId?: number,
    _npcId?: number,
    options?: CharsiImbueOptions,
  ): ItemData | null {
    return executeCharsiImbueImpl.call(this as unknown as ClientWorldInternal, itemId, _npcId, options)
  }

  clear(): void {
    this.reset()
  }
}
