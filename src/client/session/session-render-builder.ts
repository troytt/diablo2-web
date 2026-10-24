/**
 * Session Frame Tick, Scene Snapshot Adapter, & Renderable Entity List Builder
 * (`src/client/session/session-render-builder.ts`).
 *
 * Extracted from `src/client/session/online-session.ts` (Phase 3 — Step 3.5, Refs #985).
 * Strict import boundary: imports only from `src/netproto/index.ts` (never `bncs/mcp/d2gs/crypto`).
 */

import { unitTypeToId, type UnitType } from '../../netproto/index.ts'
import { resolveGroundItemMetadata } from '../../common/items/ground-items.ts'
import type { ItemData } from '../../common/items/item-bridge.ts'
import {
  DEFAULT_AMAZON_APPEARANCE,
  VALKYRIE_113C_APPEARANCE,
  appearanceKey,
  resolveCharacterAppearance,
  resolveEquipmentSlotsToAppearanceInput,
} from '../../common/units/char-appearance.ts'
import { resolveLevelAmbient } from '../../common/world/ambient-light.ts'
import type { Environment } from '../../common/world/environment.ts'
import { levelDisplayName } from '../../common/world/level-names-zh.ts'
import { resolveLevelWarpName, resolveLvlWarpBounds } from '../../common/world/level-warps-meta.ts'
import { CANONICAL_LEVEL_LIGHTING } from '../../common/world/levels-meta.ts'
import {
  getNpcPlaceholderHcIdx,
  isObjectSelectableInMode,
  resolveObjectDisplayName,
} from '../../common/world/objects-meta.ts'
import type { AudioRuntime113c } from '../audio/audio-runtime-113c.ts'
import { periodOfDayToSoundEnvironTod113c } from '../audio/sound-environ-113c.ts'
import { getActForArea, type AutomapView } from '../automap/automap-view.ts'
import type { CameraLike, CommandMapper } from '../input/command-mapper.ts'
import type { LevelView } from '../map/level-view.ts'
import type { MapService } from '../map/map-service.ts'
import type { RemoteEntityInterpolator } from '../motion/interpolate.ts'
import type { LocalMovementPredictor } from '../motion/predictor.ts'
import type { HudManager } from '../ui/hud-manager.ts'
import type { HudModel } from '../ui-model/hud-model.ts'
import type { ClientSceneWorldAdapter, SceneAmbientState } from '../view/scene-source.ts'
import type { RenderableUnitInput } from '../view/unit-drawables.ts'
import { computePanelCameraShift, panelDockWidth } from '../view/viewport-profile.ts'
import type { WeatherController } from '../weather/weather-controller.ts'
import type { ClientWorld } from '../world/client-world.ts'
import type { EnvEffectController } from '../world/env-effect.ts'
import { easeObjectLight, objectLightRenderInput } from '../world/object-light.ts'
import { DEN_OF_EVIL_LEVEL_ID, type QuestFxLight } from '../world/quest-fx-light.ts'

export interface SelfAppearanceCacheEntry {
  revision: number
  weaponSet: 0 | 1
  helm: ItemData | undefined
  armor: ItemData | undefined
  weapon1: ItemData | undefined
  weapon2: ItemData | undefined
  hasHolyShield: boolean
  appearance: ReturnType<typeof resolveCharacterAppearance>
  key: string
}

export interface SessionRenderBuilderHost {
  readonly world: ClientWorld
  readonly hudManager: HudManager
  readonly hudModel: HudModel
  readonly camera: CameraLike
  readonly mapService: MapService | null
  readonly automapView: AutomapView
  readonly predictor: LocalMovementPredictor
  readonly interpolator: RemoteEntityInterpolator
  readonly commandMapper: CommandMapper
  readonly weather: WeatherController
  readonly audioRuntime: AudioRuntime113c
  levelView?: LevelView | null | undefined
  environmentValue: Environment
  clientActLoaded: boolean
  readonly envEffects: EnvEffectController
  readonly questFx: QuestFxLight
  lastObjectLightBuildFrame: number
  selfAppearanceCache: SelfAppearanceCacheEntry | null
  tickCounter: number
  syncActiveAreaFromPlayerPosition(options?: { readonly emitHudSync?: boolean }): LevelView | null
  resolveNeighbourLevelViews(primaryView: LevelView | null | undefined): readonly LevelView[]
  resolveSceneAmbient(
    levelView: LevelView,
    playerSubX: number,
    playerSubY: number,
  ): SceneAmbientState
  buildRenderableUnits(nowMs?: number): RenderableUnitInput[]
  getCandidateAreaIds(): number[]
  isSubTileInTown(subX: number, subY: number): boolean
  drainWorldSoundRequests(): void
  resolveTargetUnitWorldPos(
    unitType: UnitType,
    unitId: number,
  ): { readonly x: number; readonly y: number } | null
  enforceActiveInteractionRange113c(): void
}

export function buildSceneSnapshot(host: SessionRenderBuilderHost): ClientSceneWorldAdapter {
  // #539: the scene is anchored only on server-provided state (0x03 LoadAct area + 0x07
  // revealed rooms + server player position). No `|| 1` Rogue Encampment default and no
  // "last LevelView MapService happened to build" (AutomapView builds neighbouring levels
  // such as Blood Moor as a side effect of 0x07). The rendered level is the one whose DRLG
  // canvas contains the player's world sub-tile (1.13c: unit → pRoom → pLevel); until such a
  // level exists the scene reports not-ready.
  // #549: resolving the active levelView also keeps `world.areaId` and `automapView` in lockstep.
  const predSnap = host.predictor.getSnapshot()
  const playerSubX = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.x : host.world.self.x
  const playerSubY = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.y : host.world.self.y
  const levelView = host.syncActiveAreaFromPlayerPosition({ emitHudSync: true })
  const neighbourLevelViews = host.resolveNeighbourLevelViews(levelView)
  const levelId = levelView?.areaId ?? (host.world.areaId > 0 ? host.world.areaId : 0)
  const actId = levelId > 0 ? getActForArea(levelId) : undefined
  const tradeState = (host.hudManager as any).trade ?? (host.hudManager.worldPanels as any)?.trade
  const isPendingTradeOnly =
    host.hudManager.leftPanel === 'trade' &&
    !tradeState?.active &&
    (tradeState?.pendingModal === 'wait' || tradeState?.pendingModal === 'request')
  const leftPanelOpen = host.hudManager.leftPanel !== 'none' && !isPendingTradeOnly
  const rightPanelOpen = host.hudManager.rightPanel !== 'none'
  const profile = host.hudManager.viewportProfile ?? host.camera.viewportProfile
  const panelShiftX = computePanelCameraShift(
    leftPanelOpen,
    rightPanelOpen,
    panelDockWidth(profile),
  )
  host.camera.setPanelShiftX?.(panelShiftX)
  return {
    tick: host.world.frameCount,
    ...(levelId > 0 && actId !== undefined ? { actId, levelId } : {}),
    playerSubX,
    playerSubY,
    ...(host.world.selfId !== 0 ? { playerUnitId: host.world.selfId } : {}),
    playerLightRadiusBonus: host.world.resolvePlayerLightRadiusBonus(),
    playerLightColor: host.world.resolvePlayerLightColor(),
    ambient:
      levelView && levelView.areaId > 0
        ? host.resolveSceneAmbient(levelView, playerSubX, playerSubY)
        : null,
    units: host.buildRenderableUnits(),
    levelView,
    neighbourLevelViews,
    tileAtlas: host.mapService?.getTileAtlas() ?? null,
    // Half-screen panel state drives the 1.13c panel camera shift (player
    // centered in the visible half); without these the scene reports no
    // panels and the camera never pans (user-reported vs vanilla).
    leftPanelOpen,
    rightPanelOpen,
    panelShiftX,
    shakeOffsetX: host.world.screenShake.offsetX,
    shakeOffsetY: host.world.screenShake.offsetY,
  }
}

/**
 * Step the session by `dtMs` milliseconds:
 * - Flushes rate-limited movement commands in `CommandMapper`
 * - Steps `LocalMovementPredictor` and `Camera`
 * - Steps `ClientWorld` (including `NpcMotion` at 25 Hz)
 * - Steps `RemoteEntityInterpolator` for non-monster remote entities
 */
export function tickSessionFrame(
  host: SessionRenderBuilderHost,
  dtMs = 40,
  nowMs = performance.now(),
): void {
  if (!Number.isFinite(dtMs)) {
    throw new RangeError(`dtMs must be a finite number, got ${String(dtMs)}`)
  }
  if (!Number.isFinite(nowMs)) {
    throw new RangeError(`nowMs must be a finite number, got ${String(nowMs)}`)
  }
  const safeDt = Math.max(0, dtMs)
  const clampedDt = Math.min(200, safeDt)
  host.tickCounter++
  host.commandMapper.tick(nowMs)
  host.commandMapper.assists.tick(nowMs)

  const selfUnit = host.world.getUnit('player', host.world.selfId || 1)
  if (selfUnit) {
    const curSnap = host.predictor.getSnapshot()
    if (selfUnit.castState && curSnap.moving) {
      host.predictor.stop()
    }
    if (
      (!curSnap.moving || selfUnit.castState) &&
      selfUnit.targetDirection !== curSnap.targetDir64
    ) {
      host.predictor.setTargetDirection(
        selfUnit.targetDirection,
        selfUnit.castState?.skillId === 151,
      )
    }
  }

  const activeCastSkillId = selfUnit?.castState?.skillId
  const isMovementSkillCast =
    (activeCastSkillId === 107 && !selfUnit?.castState?.chargeInPlaceAttack) ||
    activeCastSkillId === 132 ||
    activeCastSkillId === 143 ||
    activeCastSkillId === 151

  const selfState = host.world.self
  if (
    selfState.maxStamina > 0 ||
    selfState.stats?.has(10) ||
    selfState.stats?.has(11)
  ) {
    host.predictor.setStaminaExhausted(selfState.stamina <= 0)
  }
  // #1336: FRW / skill velocity / armor penalty / slow, mirrored from the authoritative
  // stats and equipment before the predictor advances, so both sides use one velocity.
  host.predictor.setVelocityModifiers(host.world.getSelfMoveVelocityModifiers())

  const predSnap = host.predictor.update(clampedDt)
  const tickProfile = host.hudManager?.viewportProfile ?? host.camera?.viewportProfile
  if (tickProfile) {
    host.camera.setPanelShiftX?.(
      computePanelCameraShift(
        (host.hudManager?.leftPanel ?? 'none') !== 'none',
        (host.hudManager?.rightPanel ?? 'none') !== 'none',
        panelDockWidth(tickProfile),
      ),
    )
  }
  if (!isMovementSkillCast && (predSnap.x !== 0 || predSnap.y !== 0)) {
    host.camera.update(predSnap.x, predSnap.y)
    if (selfUnit) {
      selfUnit.x = predSnap.x
      selfUnit.y = predSnap.y
    }
    host.world.self.x = predSnap.x
    host.world.self.y = predSnap.y
  }
  if (selfUnit) {
    if (activeCastSkillId !== 151) {
      selfUnit.syncTurnState(predSnap.dir64, predSnap.targetDir64, predSnap.stepDir)
    }
    if (!selfUnit.dead && !selfUnit.castState) {
      const selfInTown = host.isSubTileInTown(predSnap.x, predSnap.y)
      if (predSnap.moving) {
        selfUnit.moveMode = predSnap.running && !selfInTown ? 'run' : 'walk'
        selfUnit.mode = predSnap.running && !selfInTown ? 3 : selfInTown ? 6 : 2
        host.world.self.moving = true
        host.world.self.mode = selfUnit.mode
      } else if (host.world.self.moving || selfUnit.mode === 2 || selfUnit.mode === 3 || selfUnit.mode === 6) {
        const neutralMode = selfInTown ? 5 : 1
        selfUnit.mode = neutralMode
        host.world.self.moving = false
        host.world.self.mode = neutralMode
      }
    }
  }

  for (const unit of host.world.units.values()) {
    if (unit.dead || unit.unitType === 'monster') continue
    if (
      unit.unitType === 'player' &&
      (host.world.selfId === 0 || unit.id === (host.world.selfId || 1))
    ) {
      continue
    }
    const uTypeId = unitTypeToId(unit.unitType)
    const state = host.interpolator.getEntityState(uTypeId, unit.id)

    if (unit.targetUnit && unit.moveMode !== 'stop' && !unit.dead && !unit.castState) {
      const targetPos = host.resolveTargetUnitWorldPos(
        unit.targetUnit.unitType,
        unit.targetUnit.id,
      )
      if (targetPos) {
        const goalX = targetPos.x
        const goalY = targetPos.y
        if (
          !state ||
          !state.moving ||
          Math.hypot(goalX - state.targetX, goalY - state.targetY) > 0.05
        ) {
          const resolvedVelPct =
            unit.velocityPercent ??
            (uTypeId === 0
              ? host.world.resolvePlayerAnimSpeed(unit.mode, unit.id).velocityPercent
              : undefined)
          host.interpolator.startMove({
            unitType: uTypeId,
            unitId: unit.id,
            classId: unit.classId,
            targetX: goalX,
            targetY: goalY,
            running: unit.moveMode === 'run',
            ...(resolvedVelPct !== undefined
              ? { velocityPercent: resolvedVelPct }
              : {}),
            ...(unit.pathType !== undefined ? { pathType: unit.pathType } : {}),
          })
          unit.targetX = goalX
          unit.targetY = goalY
          unit.moving = true
        }
      }
    }

    if (state) {
      if (!state.moving && unit.targetDirection !== state.targetDir64) {
        host.interpolator.setEntityTargetDirection(uTypeId, unit.id, unit.targetDirection, false)
      }
    } else {
      unit.advanceTurn(clampedDt)
    }
  }

  host.world.tick(clampedDt, nowMs)
  if (isMovementSkillCast && selfUnit) {
    if (typeof (host.predictor as { resetTo?: (x: number, y: number) => void }).resetTo === 'function') {
      ;(host.predictor as { resetTo: (x: number, y: number) => void }).resetTo(selfUnit.x, selfUnit.y)
    } else if (typeof host.predictor.setPosition === 'function') {
      host.predictor.setPosition(selfUnit.x, selfUnit.y)
    }
    host.predictor.setTargetDirection(selfUnit.direction, true)
    host.camera.update(selfUnit.x, selfUnit.y)
  }
  host.drainWorldSoundRequests()

  const hasCollisionConstraint =
    host.levelView !== undefined ||
    host.world.getRevealedAreaIds().length > 0 ||
    Boolean(host.mapService) ||
    Boolean(host.automapView.getLevelView()) ||
    host.world.hasExplicitBlockedSubTiles()
  host.interpolator.update(
    clampedDt,
    hasCollisionConstraint ? (x, y) => host.world.isSubTileBlocked(x, y) : () => false,
  )
  for (const state of host.interpolator.getAllStates()) {
    if (state.dead || state.unitType === 1) continue
    const unit = host.world.getUnit(state.unitType as UnitType, state.unitId)
    if (unit && !unit.dead) {
      unit.x = state.x
      unit.y = state.y
      unit.moving = state.moving
      if (unit.castState?.skillId !== 151) {
        unit.syncTurnState(state.dir64, state.targetDir64, state.stepDir)
      }
      if (unit.unitType === 'player' && unit.id !== host.world.selfId) {
        const unitInTown = host.isSubTileInTown(state.x, state.y)
        if (state.moving && unit.moveMode !== 'stop') {
          if (unit.moveMode === 'knockback') {
            unit.mode = 19
          } else if (state.running || unit.mode === 3) {
            unit.mode = 3
          } else if (unit.mode === 2 || unit.mode === 6 || unit.mode === 1 || unit.mode === 5) {
            unit.mode = unitInTown ? 6 : 2
          }
        } else if (
          unit.mode === 2 ||
          unit.mode === 3 ||
          unit.mode === 6 ||
          unit.mode === 19 ||
          unit.mode === 1 ||
          unit.mode === 5
        ) {
          unit.mode = unitInTown ? 5 : 1
          unit.moveMode = 'stop'
        }
      }
    }
  }
  if (host.world.pendingMeleeAttack !== null) {
    host.commandMapper.checkPendingMeleeChaseArrival(nowMs)
  }
  const activeView = host.syncActiveAreaFromPlayerPosition({ emitHudSync: true })
  if (host.clientActLoaded) {
    // 25 Hz frame 0x6faf4a80: the unit update (0x6faf4a93 → 0x6fb58110) runs the ClientFn 14
    // polls, then #10135 UpdatePeriodOfDay(gpAct, GetRoom(player)) (0x6faf4afe) and, when the
    // period changed, the EnvEffect refresh 0x6fb56680.
    const env = host.environmentValue
    const objects = host.world.getUnitsByType('object')
    host.envEffects.poll(objects, env.period, nowMs)
    // Quest-FX tick 0x6fb03720 (@0x6faf4ab1), between the unit update and #10135: the fade samples the
    // player room's base light before this frame's period update.
    host.questFx.tick(
      activeView && activeView.areaId > 0
        ? { levelId: activeView.areaId, base: resolveLevelAmbient(activeView.areaId, env) }
        : null,
      () => {
        // 0x6fb0374c -> 0x6fb036f0: walk all loaded Den of Evil rooms and spawn denofevillight (287).
        const denView =
          host.mapService?.getLoadedLevelView?.(DEN_OF_EVIL_LEVEL_ID) ??
          host.mapService?.peekLevelView?.(DEN_OF_EVIL_LEVEL_ID, 'all') ??
          null
        if (!denView) return
        const hasServerReveals = host.world.revealedRooms.size > 0
        for (const room of denView.rooms) {
          const isRevealed = hasServerReveals
            ? host.world.revealedRooms.has(
                `${DEN_OF_EVIL_LEVEL_ID}:${room.tileX}:${room.tileY}`,
              )
            : room.revealed
          if (!isRevealed) continue
          host.questFx.markDenRoom(room.tileX, room.tileY)
          host.world.spawnDenOfEvilLightsInRoom(
            room.worldSubX,
            room.worldSubY,
            room.subW,
            room.subH,
          )
        }
      },
    )
    if (env.updatePeriodOfDay(activeView?.areaId ?? 0)) {
      host.envEffects.refresh(objects, env.period, nowMs)
      if (!host.hudManager?.tradeHallMode) {
        host.audioRuntime.setTimeOfDay(periodOfDayToSoundEnvironTod113c(env.period))
      }
    }
    if (!host.hudManager?.tradeHallMode) {
      const isRaining = !host.weather.sim.snow && host.weather.sim.intensity > 0
      const rainTargetVol = isRaining ? Math.round(host.weather.sim.intensity * 255) : 0
      host.audioRuntime.setRaining(isRaining, rainTargetVol)
    }
  }
  host.enforceActiveInteractionRange113c()
  if (host.world.npcInteraction.npcId !== null) {
    host.hudModel.syncFromWorld()
  }
}

/**
 * Build `RenderableUnitInput[]` from `ClientWorld` + `LocalMovementPredictor` + `RemoteEntityInterpolator`.
 */
export function buildRenderableUnits(
  host: SessionRenderBuilderHost,
  nowMs?: number,
): RenderableUnitInput[] {
  if (nowMs !== undefined) {
    host.world.expireCastStates(nowMs)
    host.world.expireChatAndOverhead(nowMs)
    host.drainWorldSoundRequests()
  }
  // 0x6fb3b1ac..0x6fb3b1be: the world draw builds the light grid, whose LightUpdate 0x6fb59b50 eases every light, only
  // when at least one new 25 Hz game frame elapsed; the scene builds its units once per rendered frame.
  if (host.world.frameCount > host.lastObjectLightBuildFrame) {
    host.lastObjectLightBuildFrame = host.world.frameCount
    for (const unit of host.world.units.values()) {
      if (unit.unitType === 'object' && unit.objectLight !== null) easeObjectLight(unit.objectLight)
    }
  }
  const out: RenderableUnitInput[] = []
  const predSnap = host.predictor.getSnapshot()
  const selfX = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.x : host.world.self.x
  const selfY = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.y : host.world.self.y

  // Self is not renderable until the server has assigned both its unit id (0x59) and class.
  const selfClass = host.world.self.charClass
  let selfEquipmentAppearance: ReturnType<typeof resolveCharacterAppearance> | undefined
  if (host.world.selfId !== 0 && selfClass !== null) {
    const selfUnit = host.world.getUnit('player', host.world.selfId)
    const isSelfDead = host.world.isSelfDead || host.world.isDead
    const selfCastState = !isSelfDead ? (selfUnit?.castState ?? host.world.self.castState) : undefined
    const selfInTown = host.isSubTileInTown(selfX, selfY)
    const neutralMode = selfInTown ? 5 : 1
    const walkMode = selfInTown ? 6 : 2
    const unitExplicitMode =
      selfUnit?.mode !== undefined &&
      selfUnit.mode !== 0 &&
      selfUnit.mode !== 1 &&
      selfUnit.mode !== 2 &&
      selfUnit.mode !== 3 &&
      selfUnit.mode !== 5 &&
      selfUnit.mode !== 6 &&
      selfUnit.mode !== 17
        ? selfUnit.mode
        : undefined
    const selfMode = isSelfDead
      ? (selfUnit?.mode === 0 ? 0 : 17)
      : selfCastState
        ? selfCastState.mode || 10
        : predSnap.moving
          ? predSnap.running
            ? 3
            : walkMode
          : (unitExplicitMode ?? neutralMode)
    if (selfUnit !== undefined && !selfCastState) {
      selfUnit.mode = selfMode
    }
    const selfDirection =
      selfCastState && selfUnit !== undefined ? selfUnit.direction : predSnap.dir64
    const selfAnimStartedAtMs = selfCastState?.startedAtMs ?? selfUnit?.modeStartedAtMs
    const selfAnimStepSpeed256 = selfCastState?.stepSpeed256 ?? selfUnit?.animStepSpeed256
    const selfAnimEffRate = selfCastState?.effRate ?? selfUnit?.animEffRate
    const selfVelocityPercent = selfUnit?.velocityPercent
    const selfWeaponSet = host.world.self.weaponSet
    const selfHelm = host.world.containers.equipmentBySlot.get(1)
    const selfArmor = host.world.containers.equipmentBySlot.get(3)
    const slot4 = host.world.containers.equipmentBySlot.get(4)
    const slot5 = host.world.containers.equipmentBySlot.get(5)
    const slot11 = host.world.containers.equipmentBySlot.get(11)
    const slot12 = host.world.containers.equipmentBySlot.get(12)
    const useSwapSlots =
      selfWeaponSet === 1 &&
      slot4 === undefined &&
      slot5 === undefined &&
      (slot11 !== undefined || slot12 !== undefined)
    const selfWeapon1 = useSwapSlots ? slot11 : slot4
    const selfWeapon2 = useSwapSlots ? slot12 : slot5
    const selfStates = selfUnit
      ? Array.from(new Set([...selfUnit.states.list(), ...host.world.self.states]))
      : host.world.self.states.size > 0
        ? Array.from(host.world.self.states)
        : undefined
    const hasHolyShield = Boolean(selfStates?.includes(101))
    const containersRevision = host.world.containers.revision ?? Number.NaN
    const cachedAppearance = host.selfAppearanceCache
    const appearanceCacheHit =
      cachedAppearance !== null &&
      cachedAppearance.revision === containersRevision &&
      cachedAppearance.weaponSet === selfWeaponSet &&
      cachedAppearance.helm === selfHelm &&
      cachedAppearance.armor === selfArmor &&
      cachedAppearance.weapon1 === selfWeapon1 &&
      cachedAppearance.weapon2 === selfWeapon2 &&
      cachedAppearance.hasHolyShield === hasHolyShield
    selfEquipmentAppearance = appearanceCacheHit ? cachedAppearance!.appearance : undefined
    let selfAppearanceKey = appearanceCacheHit ? cachedAppearance!.key : undefined
    if (selfEquipmentAppearance === undefined || selfAppearanceKey === undefined) {
      selfEquipmentAppearance = resolveCharacterAppearance(
        selfClass,
        resolveEquipmentSlotsToAppearanceInput(
          host.world.containers.equipmentBySlot,
          selfWeaponSet,
          host.world.containers.sockets,
          undefined,
          hasHolyShield,
        ),
      )
      selfAppearanceKey = appearanceKey(selfEquipmentAppearance)
      host.selfAppearanceCache = {
        revision: containersRevision,
        weaponSet: selfWeaponSet,
        helm: selfHelm,
        armor: selfArmor,
        weapon1: selfWeapon1,
        weapon2: selfWeapon2,
        hasHolyShield,
        appearance: selfEquipmentAppearance,
        key: selfAppearanceKey,
      }
    }
    out.push({
      id: host.world.selfId,
      kind: 'player',
      classId: selfClass,
      name: host.world.self.name,
      x: selfX,
      y: selfY,
      ...(selfCastState?.targetX !== undefined ? { targetX: selfCastState.targetX } : {}),
      ...(selfCastState?.targetY !== undefined ? { targetY: selfCastState.targetY } : {}),
      mode: selfMode,
      direction: selfDirection,
      ...(selfUnit?.altitude !== undefined && selfUnit.altitude !== 0
        ? { altitude: selfUnit.altitude }
        : {}),
      hpRatio: (() => {
        const effMaxLife =
          host.hudManager.maxHp > 0 ? host.hudManager.maxHp : host.world.self.maxLife
        return effMaxLife > 0 ? Math.max(0, Math.min(1, host.world.self.life / effMaxLife)) : 1
      })(),
      isLocalPlayer: true,
      isCorpse: isSelfDead,
      equipmentAppearance: selfEquipmentAppearance,
      appearanceKey: selfAppearanceKey,
      states: selfStates,
      stats: selfUnit?.stats ?? host.world.self.stats,
      ...((selfUnit as any)?.chargeCounts !== undefined
        ? { chargeCounts: (selfUnit as any).chargeCounts }
        : {}),
      ...((selfUnit as any)?.maulCharges !== undefined
        ? { maulCharges: (selfUnit as any).maulCharges }
        : {}),
      ...((selfUnit as any)?.feralRageCharges !== undefined
        ? { feralRageCharges: (selfUnit as any).feralRageCharges }
        : {}),
      ...(selfCastState !== undefined ? { castState: selfCastState } : {}),
      ...(selfUnit && selfUnit.overlays.length > 0 ? { overlays: selfUnit.overlays } : {}),
      ...(selfAnimStartedAtMs !== undefined ? { animStartedAtMs: selfAnimStartedAtMs } : {}),
      ...(selfAnimStepSpeed256 !== undefined ? { animStepSpeed256: selfAnimStepSpeed256 } : {}),
      ...(selfAnimEffRate !== undefined ? { animEffRate: selfAnimEffRate } : {}),
      ...(selfVelocityPercent !== undefined ? { velocityPercent: selfVelocityPercent } : {}),
      ...(selfUnit?.overheadText !== undefined &&
      (nowMs === undefined ||
        selfUnit.overheadExpireMs === undefined ||
        selfUnit.overheadExpireMs > nowMs)
        ? {
            overheadText: selfUnit.overheadText,
            ...(selfUnit.overheadColor !== undefined
              ? { overheadColor: selfUnit.overheadColor }
              : {}),
          }
        : {}),
      ...(host.world.isPlayerFaded() ? { isFaded: true } : {}),
    })
  }

  const cachedNav = host as unknown as {
    readonly cachedCollisionView?: LevelView | null
    readonly cachedCollisionViewAreaId?: number
    readonly cachedCollisionViewSubX?: number
    readonly cachedCollisionViewSubY?: number
  }
  const activeLevelView =
    host.levelView ??
    (host.mapService && host.world.areaId > 0 && (selfX !== 0 || selfY !== 0)
      ? (cachedNav.cachedCollisionView &&
        cachedNav.cachedCollisionViewAreaId === host.world.areaId &&
        cachedNav.cachedCollisionViewSubX === Math.floor(selfX) &&
        cachedNav.cachedCollisionViewSubY === Math.floor(selfY) &&
        (typeof host.mapService.getLoadedLevelView !== 'function' ||
          host.mapService.getLoadedLevelView(cachedNav.cachedCollisionView.areaId) === undefined ||
          host.mapService.getLoadedLevelView(cachedNav.cachedCollisionView.areaId) ===
            cachedNav.cachedCollisionView)
          ? cachedNav.cachedCollisionView
          : host.mapService.findLevelViewAtWorldSubTile(selfX, selfY, host.getCandidateAreaIds()))
      : null) ??
    host.mapService?.getActiveLevelView() ??
    host.automapView.getLevelView()

  const hoveredUnit = host.commandMapper.currentHoveredUnit

  for (const u of host.world.units.values()) {
    if (u.unitType === 'player' && host.world.selfId !== 0 && u.id === host.world.selfId) {
      continue
    }
    if (u.hidden) {
      continue
    }
    if (u.unitType === 'object') {
      const placeholderHcIdx = getNpcPlaceholderHcIdx(u.classId)
      if (placeholderHcIdx !== undefined && host.world.hasActiveMonsterNpc(placeholderHcIdx)) {
        continue
      }
    }
    if (u.unitType === 'missile') {
      if (
        (selfX !== 0 || selfY !== 0) &&
        (u.x !== 0 || u.y !== 0) &&
        (Math.abs((u.x - selfX - (u.y - selfY)) * 16) > 1300 ||
          Math.abs((u.x - selfX + (u.y - selfY)) * 8) > 860)
      ) {
        continue
      }
      out.push({
        id: u.id,
        kind: 'missile',
        classId: u.classId,
        ...(u.name !== undefined ? { name: u.name } : {}),
        ...(u.missileKey !== undefined ? { missileKey: u.missileKey } : {}),
        x: u.x,
        y: u.y,
        ...(u.targetX !== undefined ? { targetX: u.targetX } : {}),
        ...(u.targetY !== undefined ? { targetY: u.targetY } : {}),
        ...(u.vx !== undefined ? { vx: u.vx } : {}),
        ...(u.vy !== undefined ? { vy: u.vy } : {}),
        ...(u.frame !== undefined ? { frame: u.frame } : {}),
        ...(u.totalFrames !== undefined ? { totalFrames: u.totalFrames } : {}),
        ...(u.loopAnim !== undefined ? { loopAnim: u.loopAnim } : {}),
        ...(u.altitude !== undefined ? { altitude: u.altitude } : {}),
        ...(u.fixedDirection === true ? { fixedDirection: true } : {}),
        ...(u.ageTicks !== undefined ? { ageTicks: u.ageTicks } : {}),
        ...(u.maxTicks !== undefined ? { maxTicks: u.maxTicks } : {}),
        ...(u.missileLightRadius !== undefined
          ? { missileLightRadius: u.missileLightRadius }
          : {}),
        ...(u.missileNoLight === true ? { missileNoLight: true } : {}),
        mode: u.mode,
        direction: u.direction,
        hpRatio: 1,
        isCorpse: false,
      })
      continue
    }
    const isHovered = Boolean(
      hoveredUnit && hoveredUnit.unitType === u.unitType && hoveredUnit.id === u.id,
    )
    const interp = host.interpolator.getEntityState(
      u.unitType === 'player'
        ? 0
        : u.unitType === 'monster'
          ? 1
          : u.unitType === 'object'
            ? 2
            : u.unitType === 'item'
              ? 4
              : 5,
      u.id,
    )
    const groundItem = u.unitType === 'item' ? host.world.containers.ground.get(u.id) : undefined
    const isCorpse =
      u.dead ||
      (u.unitType === 'monster' && (u.mode === 0 || u.mode === 12 || u.lifePct <= 0)) ||
      (u.unitType === 'player' && (u.mode === 0 || u.mode === 17))
    const ux = !isCorpse && interp ? interp.x : u.x
    const uy = !isCorpse && interp ? interp.y : u.y
    const dx = ux - selfX
    const dy = uy - selfY
    if (
      u.unitType !== 'player' &&
      (selfX !== 0 || selfY !== 0) &&
      (ux !== 0 || uy !== 0) &&
      (Math.abs((dx - dy) * 16) > 1300 || Math.abs((dx + dy) * 8) > 860)
    ) {
      continue
    }

    if (u.unitType === 'tile') {
      const warpId = u.warpId ?? u.classId
      const pickWarpToLevelId = (
        view: NonNullable<typeof activeLevelView>,
      ): number | undefined => {
        let bestSameIdToLevel: number | undefined
        let bestSameIdDist = Number.POSITIVE_INFINITY
        let bestNearToLevel: number | undefined
        let bestNearDist = 8
        const originX = view.originX ?? 0
        const originY = view.originY ?? 0
        for (const e of view.entrances ?? []) {
          if (!e.warp) continue
          const wx = originX + e.warp.subX
          const wy = originY + e.warp.subY
          const d = Math.hypot(wx - ux, wy - uy)
          if (e.warp.lvlWarpId === warpId && d < bestSameIdDist) {
            bestSameIdDist = d
            bestSameIdToLevel = e.toLevelId
          }
          if (d <= bestNearDist) {
            bestNearDist = d
            bestNearToLevel = e.toLevelId
          }
        }
        if (bestSameIdToLevel !== undefined && bestSameIdDist <= 16) return bestSameIdToLevel
        if (bestNearToLevel !== undefined) return bestNearToLevel
        for (const w of view.warps ?? []) {
          const rawW = w as { readonly subX?: number; readonly subY?: number }
          if (typeof rawW.subX === 'number' && typeof rawW.subY === 'number') {
            const d = Math.hypot(rawW.subX - ux, rawW.subY - uy)
            if (w.lvlWarpId === warpId && d < bestSameIdDist) {
              bestSameIdDist = d
              bestSameIdToLevel = w.toLevelId
            }
          } else if (w.lvlWarpId === warpId && Array.isArray(view.rooms)) {
            const room = view.rooms.find((r) => r.index === w.room)
            if (
              room &&
              ux >= room.worldSubX &&
              ux < room.worldSubX + room.subW &&
              uy >= room.worldSubY &&
              uy < room.worldSubY + room.subH
            ) {
              return w.toLevelId
            }
          }
        }
        if (bestSameIdToLevel !== undefined) return bestSameIdToLevel
        return view.warps?.find((w) => w.lvlWarpId === warpId)?.toLevelId
      }
      let toLevelId = activeLevelView ? pickWarpToLevelId(activeLevelView) : undefined
      if (toLevelId === undefined && activeLevelView) {
        for (const nv of host.resolveNeighbourLevelViews(activeLevelView)) {
          toLevelId = pickWarpToLevelId(nv)
          if (toLevelId !== undefined) break
        }
      }
      const warpNames = toLevelId !== undefined ? resolveLevelWarpName(toLevelId) : undefined
      const bounds = resolveLvlWarpBounds(warpId)
      const warpName =
        u.name && u.name.trim() !== ''
          ? u.name
          : warpNames
            ? warpNames.name
            : `Entrance (${warpId})`
      const warpNameZh = warpNames?.nameZh
      out.push({
        id: u.id,
        kind: 'warp',
        classId: u.classId,
        warpId,
        ...(toLevelId !== undefined ? { toLevelId } : {}),
        name: warpName,
        ...(warpNameZh !== undefined ? { nameZh: warpNameZh } : {}),
        x: ux,
        y: uy,
        mode: u.mode,
        direction: interp ? interp.dir64 : u.direction,
        radiusX: bounds.radiusX,
        radiusY: bounds.radiusY,
        ...(bounds.selectDX > 0 && bounds.selectDY > 0
          ? {
              hitBox: {
                left: bounds.selectX,
                top: bounds.selectY,
                width: bounds.selectDX,
                height: bounds.selectDY,
              },
            }
          : {}),
        isHovered,
      })
      continue
    }

    if (interp?.moving && u.castState) {
      host.world.clearUnitCastState(u)
    }
    const castState = !isCorpse ? u.castState : undefined
    let mode = castState ? castState.mode || u.mode : u.mode
    if (u.unitType === 'player' && !isCorpse && !castState) {
      const unitInTown = host.isSubTileInTown(ux, uy)
      if (interp?.moving && u.moveMode !== 'stop') {
        mode =
          u.moveMode === 'knockback'
            ? 19
            : interp.running || u.mode === 3
              ? 3
              : unitInTown
                ? 6
                : 2
      } else if (
        u.mode === 1 ||
        u.mode === 5 ||
        (interp !== null &&
          interp !== undefined &&
          !interp.moving &&
          (u.mode === 2 || u.mode === 3 || u.mode === 6 || u.mode === 19))
      ) {
        mode = unitInTown ? 5 : 1
      } else if (u.mode === 2 || u.mode === 6) {
        mode = unitInTown ? 6 : 2
      }
      u.mode = mode
    } else if (u.unitType === 'monster') {
      const isActionMode = (u.mode >= 3 && u.mode <= 11) || u.mode === 14
      if (isCorpse) {
        mode = u.mode === 0 ? 0 : 12
      } else if (castState) {
        mode = castState.mode || u.mode || 1
      } else if (isActionMode) {
        mode = u.mode
      } else if (interp?.moving && u.moveMode !== 'stop') {
        mode = u.moveMode === 'knockback' ? 13 : interp.running ? 15 : 2
      } else {
        mode = u.mode || 1
      }
    }
    const targetX = castState?.targetX ?? u.targetX
    const targetY = castState?.targetY ?? u.targetY
    const unitAnimStartedAtMs = castState?.startedAtMs ?? u.animStartedAtMs ?? u.modeStartedAtMs
    // Issue #827: the object's own light (SetObjectLight 0x6fad4920 lifecycle, object-light.ts).
    const objectPointLight =
      u.unitType === 'object' ? objectLightRenderInput(u.objectLight) : undefined

    if (u.unitType === 'object' && (u.classId === 59 || u.classId === 60)) {
      const portal =
        host.world.portals.get(u.id) ??
        Array.from(host.world.portals.values()).find(
          (p) => p.localId === u.id || p.remoteId === u.id,
        )
      const destAreaName = portal?.areaId
        ? CANONICAL_LEVEL_LIGHTING[portal.areaId]?.levelName
        : undefined
      const destAreaNameZh = portal?.areaId
        ? levelDisplayName(portal.areaId, 'CHI')
        : undefined
      const basePortalName = portal?.ownerName
        ? `${portal.ownerName}'s Town Portal`
        : u.name && u.name.trim() !== ''
          ? u.name
          : 'Town Portal'
      const portalName =
        destAreaName && !basePortalName.includes(destAreaName)
          ? `${basePortalName} (${destAreaName})`
          : basePortalName
      const basePortalNameZh = portal?.ownerName
        ? `${portal.ownerName} 的傳送門`
        : u.nameZh && u.nameZh.trim() !== ''
          ? u.nameZh
          : '傳送門'
      const portalNameZh =
        destAreaNameZh && !basePortalNameZh.includes(destAreaNameZh)
          ? `${basePortalNameZh} (${destAreaNameZh})`
          : basePortalNameZh
      out.push({
        id: u.id,
        kind: 'object',
        classId: u.classId,
        name: portalName,
        nameZh: portalNameZh,
        x: ux,
        y: uy,
        mode,
        direction: interp ? interp.dir64 : u.direction,
        hpRatio: Math.max(0, Math.min(1, u.lifePct / 128)),
        isCorpse: false,
        isHovered,
        states: Array.from(u.states.list()),
        ...(unitAnimStartedAtMs !== undefined ? { animStartedAtMs: unitAnimStartedAtMs } : {}),
        ...(portal?.ownerName !== undefined ? { portalOwnerName: portal.ownerName } : {}),
        ...(portal?.areaId !== undefined ? { portalAreaId: portal.areaId } : {}),
        ...(objectPointLight !== undefined
          ? { objectPointLight, objectLightAllocation: u.objectLight ?? undefined }
          : {}),
      })
      continue
    }

    if (u.unitType === 'item') {
      const itemCode =
        u.itemCode ??
        groundItem?.code ??
        u.itemData?.code ??
        (u.name && /^[a-z0-9]{3,4}$/i.test(u.name.trim()) ? u.name.trim() : undefined)
      const itemQuality = u.itemQuality ?? u.quality ?? groundItem?.quality ?? u.itemData?.quality
      const meta = u.itemData
        ? resolveGroundItemMetadata(u.itemData, u.goldAmount ?? groundItem?.goldAmount)
        : itemCode
          ? resolveGroundItemMetadata(
              {
                code: itemCode,
                ...(itemQuality !== undefined ? { quality: itemQuality } : {}),
                ...((u.goldAmount ?? groundItem?.goldAmount) !== undefined
                  ? { goldAmount: u.goldAmount ?? groundItem?.goldAmount }
                  : {}),
                ...(u.name !== undefined ? { name: u.name } : {}),
              },
              u.goldAmount ?? groundItem?.goldAmount,
            )
          : undefined
      const goldAmount =
        u.goldAmount ?? groundItem?.goldAmount ?? (meta?.isGold ? meta.amount : undefined)
      const itemName =
        meta?.isGold && goldAmount !== undefined
          ? `${goldAmount} Gold`
          : u.name && u.name.trim() !== ''
            ? u.name
            : meta?.name
      const itemNameZh =
        meta?.isGold && goldAmount !== undefined
          ? `${goldAmount} 金币`
          : u.nameZh && u.nameZh.trim() !== ''
            ? u.nameZh
            : meta?.nameZh
      const itemColor = u.itemColor ?? meta?.color
      out.push({
        id: u.id,
        kind: 'item',
        classId: u.classId,
        ...(itemName !== undefined ? { name: itemName } : {}),
        ...(itemNameZh !== undefined ? { nameZh: itemNameZh } : {}),
        ...(itemColor !== undefined ? { itemColor } : {}),
        ...(itemCode !== undefined ? { code: itemCode, itemCode } : {}),
        ...(u.flippyFile !== undefined ? { flippyFile: u.flippyFile } : {}),
        ...(u.invFile !== undefined ? { invFile: u.invFile } : {}),
        ...(u.invtransform !== undefined ? { invtransform: u.invtransform } : {}),
        ...(u.animStartedAtMs !== undefined ? { animStartedAtMs: u.animStartedAtMs } : {}),
        x: ux,
        y: uy,
        mode,
        direction: interp ? interp.dir64 : u.direction,
        hpRatio: 1,
        isCorpse: false,
        isHovered,
        ...(goldAmount !== undefined ? { goldAmount } : {}),
        ...(itemQuality !== undefined ? { itemQuality, quality: itemQuality } : {}),
      })
      continue
    }

    const partyMember = u.unitType === 'player' ? host.world.party.get(u.id) : undefined
    const isPartyMember = Boolean(
      partyMember &&
        (partyMember.partyState === 1 ||
          (partyMember.partyId !== undefined && partyMember.partyId !== 0xffff)),
    )
    const remoteEquipSlots =
      u.unitType === 'player'
        ? host.world.containers.remoteEquipmentByPlayerId.get(u.id)
        : undefined
    const remoteHasHolyShield = u.unitType === 'player' && u.states.has(101)
    const remoteEquipmentAppearance =
      u.unitType === 'player'
        ? resolveCharacterAppearance(
            u.classId,
            remoteEquipSlots
              ? resolveEquipmentSlotsToAppearanceInput(
                  remoteEquipSlots,
                  0,
                  host.world.containers.sockets,
                  undefined,
                  remoteHasHolyShield,
                )
              : { hasHolyShield: remoteHasHolyShield },
          )
        : undefined
    const remoteAppearanceKey =
      remoteEquipmentAppearance !== undefined
        ? appearanceKey(remoteEquipmentAppearance)
        : undefined
    const unitAnimStepSpeed256 = castState?.stepSpeed256 ?? u.animStepSpeed256
    const unitAnimEffRate = castState?.effRate ?? u.animEffRate
    const unitVelocityPercent = u.velocityPercent
    const isObjSelectable =
      u.unitType === 'object' ? isObjectSelectableInMode(u.classId, mode) : undefined
    const objNames =
      u.unitType === 'object'
        ? resolveObjectDisplayName(u.classId, mode, u.flags, u.interactType, host.world.areaId)
        : undefined
    const hellGateDestName =
      u.unitType === 'object' && u.classId === 342
        ? (CANONICAL_LEVEL_LIGHTING[103]?.levelName ?? 'The Pandemonium Fortress')
        : undefined
    const resolvedName =
      u.name && u.name.trim() !== ''
        ? u.name
        : hellGateDestName
          ? `Portal to ${hellGateDestName}`
          : objNames?.name
    const resolvedNameZh =
      u.nameZh && u.nameZh.trim() !== ''
        ? u.nameZh
        : hellGateDestName
          ? '傳送到 群魔堡壘'
          : objNames?.nameZh

    const isOwnMerc = Boolean(
      u.unitType === 'monster' && host.world.merc && u.id === host.world.merc.mercId,
    )
    const petState = u.unitType === 'monster' ? host.world.pets.get(u.id) : undefined
    const resolvedOwnerType =
      u.ownerType ?? (isOwnMerc || petState !== undefined ? 'player' : undefined)
    const resolvedOwnerId =
      u.ownerId ??
      (isOwnMerc ? (host.world.merc?.ownerId || host.world.selfId) : petState?.ownerId)

    out.push({
      id: u.id,
      kind: u.unitType,
      classId: u.classId,
      name: resolvedName,
      ...(resolvedNameZh !== undefined ? { nameZh: resolvedNameZh } : {}),
      x: ux,
      y: uy,
      ...(targetX !== undefined ? { targetX } : {}),
      ...(targetY !== undefined ? { targetY } : {}),
      mode,
      direction:
        !isCorpse && interp && castState?.skillId !== 151 ? interp.dir64 : u.direction,
      ...(u.altitude !== undefined && u.altitude !== 0 ? { altitude: u.altitude } : {}),
      lifePct: u.lifePct,
      hpRatio: Math.max(0, Math.min(1, u.lifePct / 128)),
      isCorpse,
      ...(u.corpseSuppressed ? { corpseSuppressed: true } : {}),
      isHovered: isObjSelectable === false ? false : isHovered,
      ...(isObjSelectable !== undefined ? { isSel: isObjSelectable, noSel: !isObjSelectable } : {}),
      ...(hellGateDestName !== undefined ? { portalAreaId: 103 } : {}),
      isChampion: u.isChampion,
      isUnique: u.isUnique,
      isSuperUnique: u.isSuperUnique,
      ...(u.superUniqueId !== undefined ? { superUniqueId: u.superUniqueId } : {}),
      ...(u.unitType === 'monster' && u.bossMods !== undefined ? { bossMods: u.bossMods } : {}),
      ...(u.unitType === 'monster' && u.compVariants !== undefined ? { compVariants: u.compVariants } : {}),
      ...(u.isNpc ? { isNpc: true } : {}),
      ...(u.wantsInteract ? { wantsInteract: true } : {}),
      ...(u.flags !== undefined ? { flags: u.flags } : {}),
      ...(u.interactType !== undefined ? { interactType: u.interactType } : {}),
      ...(resolvedOwnerType !== undefined ? { ownerType: resolvedOwnerType } : {}),
      ...(resolvedOwnerId !== undefined ? { ownerId: resolvedOwnerId } : {}),
      states: Array.from(u.states.list()),
      stats: u.stats,
      ...((u as any).chargeCounts !== undefined ? { chargeCounts: (u as any).chargeCounts } : {}),
      ...((u as any).maulCharges !== undefined ? { maulCharges: (u as any).maulCharges } : {}),
      ...((u as any).feralRageCharges !== undefined
        ? { feralRageCharges: (u as any).feralRageCharges }
        : {}),
      ...(castState !== undefined ? { castState } : {}),
      ...(u.overlays.length > 0 ? { overlays: u.overlays } : {}),
      ...(unitAnimStartedAtMs !== undefined ? { animStartedAtMs: unitAnimStartedAtMs } : {}),
      ...(unitAnimStepSpeed256 !== undefined ? { animStepSpeed256: unitAnimStepSpeed256 } : {}),
      ...(unitAnimEffRate !== undefined ? { animEffRate: unitAnimEffRate } : {}),
      ...(unitVelocityPercent !== undefined ? { velocityPercent: unitVelocityPercent } : {}),
      ...(objectPointLight !== undefined
        ? { objectPointLight, objectLightAllocation: u.objectLight ?? undefined }
        : {}),
      ...(u.overheadText !== undefined &&
      (nowMs === undefined || u.overheadExpireMs === undefined || u.overheadExpireMs > nowMs)
        ? {
            overheadText: u.overheadText,
            ...(u.overheadColor !== undefined ? { overheadColor: u.overheadColor } : {}),
          }
        : {}),
      ...(u.unitType === 'player'
        ? {
            isPartyMember,
            isLocalPlayer: false,
            playerLightRadiusBonus: host.world.resolvePlayerLightRadiusBonus(u.id),
            playerLightColor: host.world.resolvePlayerLightColor(u.id),
            ...(host.world.isPlayerFaded(u.id) ? { isFaded: true } : {}),
            ...(remoteEquipmentAppearance !== undefined
              ? { equipmentAppearance: remoteEquipmentAppearance }
              : {}),
            ...(remoteAppearanceKey !== undefined ? { appearanceKey: remoteAppearanceKey } : {}),
          }
        : u.unitType === 'monster' && u.classId === 356
          ? (() => {
              const decoyAppearance =
                selfEquipmentAppearance !== undefined
                  ? selfEquipmentAppearance.classToken === 'am'
                    ? selfEquipmentAppearance
                    : { ...selfEquipmentAppearance, classToken: 'am' as const, classId: 0 }
                  : DEFAULT_AMAZON_APPEARANCE
              return {
                equipmentAppearance: decoyAppearance,
                appearanceKey: appearanceKey(decoyAppearance),
              }
            })()
          : u.unitType === 'monster' && u.classId === 357
            ? {
                equipmentAppearance: VALKYRIE_113C_APPEARANCE,
                appearanceKey: appearanceKey(VALKYRIE_113C_APPEARANCE),
              }
            : {}),
    })
  }

  return out
}
