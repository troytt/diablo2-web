/**
 * GameInstance Subsystem: 25Hz Frame Stepper, Player Command Router, Skill Resolution & CTC Procs (`src/server/engine/game-instance/frame-and-commands.ts`).
 */

import type { MissileRecord, SkillRecord } from '../../../common/data/data-registry.ts'
import { D2_BASE_WALK_SUBTILES_PER_SEC } from '../../../common/path/movement-predictor.ts'
import { resolveWeaponBase113c } from '../../../common/units/char-anim-speed.ts'
import { getSkillAnimModes } from '../../../common/skills/skill-anim-modes.ts'
import { D2Common_10399_AtSubtiles } from '../../../common/path/step.ts'
import { isObjectInInteractRange113c } from '../../../common/world/objects-meta.ts'
import { WELL_DEFAULT_PARMS_113C, computeWellInitialCharges113c, computeWellModeForCharges113c, getObjectOperatingTicks113c } from '../../../common/world/object-operate-113c.ts'
import { canLootPlayerCorpse113c, canUseWaypointInPvp113c, isPlayerHardcore113c } from '../../combat/pvp-engine-113c.ts'
import { resolveSelfResurrectChancePct113c } from '../../ai/monumod-113c.ts'
import type { ClientCommand, ServerEvent, ItemStat } from '../../../netproto/index.ts'
import { findStandableNear } from '../../world/area-bootstrap.ts'
import { UnitStatList } from '../stat-list.ts'
import { aggregateCtcProcs113c, ELEMENTAL_MASTERY_PIERCE_STATS_113C, isCtcRadialNovaSkill113c, rollCtcProcs113c, type CtcStatId113c } from '../../skills/passives-procs-113c.ts'
import type { StateBus } from '../state-bus.ts'
import { resolveItemMissileTypeId113c } from '../../../common/skills/weapon-combat-meta.ts'
import { normalizeSkillTargetUnitType113c } from '../../skills/martial-dualwield-113c.ts'
import { evaluateCalc } from '../../../common/data/calc-ast.ts'
import { decodeSkillTabParam } from '../../../common/skills/skills-data.ts'
import { evaluateSkill113c } from '../../skills/registry.ts'
import type { TownNpcPlayerContext } from '../../ai/town-npc-ai-113c.ts'
import { questWordIndex113c } from '../quests-113c.ts'
import type { GameInstanceHost } from './host.ts'
import { updatePlayerBreadcrumbs113c } from './hireable-ai-113c.ts'
import { stepOracleNecroPetsEarly113c } from './summoned-pets.ts'
import type { InternalMonsterRecord, InternalPlayerRecord, PlayerSkillCast, QueuedPlayerCommand, ServerItemEntry } from './types.ts'
import { ACT_TOWN_AREAS, BODYLOC_LEFT_ARM, BODYLOC_RIGHT_ARM, NPC_INTRO_BIT_BY_HCIDX_113C, PLAYER_SIZE_X_113C, SKILL_TELEPORT, SRVDOFUNC_MIND_BLAST, SRVDOFUNC_WHIRLWIND, STAT_ITEM_ADDCLASSSKILLS, STAT_ITEM_ADDSKILL_TAB, STAT_ITEM_ALLSKILLS, STAT_ITEM_EXPLOSIVEARROW, STAT_ITEM_MAGICARROW, STAT_ITEM_NONCLASSSKILL, STAT_ITEM_SINGLESKILL, STAT_QUANTITY, TOWN_AREAS, UNIVERSAL_PLAYER_SKILL_IDS, WARP_INTERACT_DISTANCE_SUBTILES, WAYPOINT_AREA_IDS, WAYPOINT_INTERACT_DISTANCE_SUBTILES, areaToAct, collectEquippedItemStats, collectItemStats, computeObjectApproachSearchRadius113c, findBestInteractApproachSubTile113c, findChargedSkill, normalizeMissileElement, resolvePlayerServerMissileName, UNIT_TYPE_113C, type UnitType113c } from './constants-and-helpers.ts'



/** Wire / domain unit type (`0..5` or `UnitTypeName`, `'warp'` = tile) -> 1.13c unit type, else undefined. */
function interactUnitType113c(raw: unknown): UnitType113c | undefined {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 0 && raw <= 5 ? (raw as UnitType113c) : undefined
  }
  if (raw === 'warp') return UNIT_TYPE_113C.tile
  if (typeof raw === 'string' && raw in UNIT_TYPE_113C) {
    return UNIT_TYPE_113C[raw as keyof typeof UNIT_TYPE_113C]
  }
  return undefined
}

function stepFrame(this: GameInstanceHost): Map<number, readonly ServerEvent[]> {
  for (let i = this.pendingObjectSpawns.length - 1; i >= 0; i--) {
    const pending = this.pendingObjectSpawns[i]!
    if (this.currentFrame < pending.frame) continue
    this.pendingObjectSpawns.splice(i, 1)
    const hasLoadedArea = this.loadedAreas.has(pending.areaId)
    const stand = hasLoadedArea
      ? findStandableNear(
          (x, y) => this.isWorldWalkableForPlayer(pending.areaId, x, y),
          pending.x,
          pending.y,
          100,
        )
      : null
    if (hasLoadedArea && stand === null) continue
    const spawnedId = this.spawnObject({
      classId: pending.classId,
      x: stand?.x ?? pending.x,
      y: stand?.y ?? pending.y,
      areaId: pending.areaId,
      mode: 1,
      ...(pending.destAreaId !== undefined ? { destAreaId: pending.destAreaId } : {}),
    })
    const opTicks = getObjectOperatingTicks113c(pending.classId)
    if (opTicks > 0) {
      this.pendingObjectModeTransitions.push({
        frame: this.currentFrame + opTicks,
        unitId: spawnedId,
        mode: 2,
      })
    }
  }
  for (let i = this.pendingObjectModeTransitions.length - 1; i >= 0; i--) {
    const pending = this.pendingObjectModeTransitions[i]!
    if (this.currentFrame < pending.frame) continue
    this.pendingObjectModeTransitions.splice(i, 1)
    const obj = this.objects.get(pending.unitId)
    if (obj !== undefined) {
      this.setObjectMode(obj, pending.mode)
    }
  }
  this.stepPendingHellforgeDrops113c()
  this.stepShenkBombardments113c()
  this.stepTowerChestSpawners113c()

  // Drain queued C2S commands in deterministic FIFO order; control commands
  // (`PauseGame` and `/players N` chat commands) execute even around pause transitions.
  const pending = this.commandQueue.splice(0, this.commandQueue.length)
  const deferredWhilePaused: QueuedPlayerCommand[] = []
  for (const item of pending) {
    const { playerUnitId, command } = item
    const player = this.players.get(playerUnitId)
    if (!player) continue
    if (command.type === 'PauseGame') {
      this.setPaused(Boolean(command.paused))
      continue
    }
    const isPlayersChat =
      command.type === 'Chat' &&
      (/^\s*\/players/i.test(command.text) || /^\s*players set to \d+\s*$/i.test(command.text))
    if (this.pausedState && !isPlayersChat) {
      deferredWhilePaused.push(item)
      continue
    }
    try {
      this.processPlayerCommand(player, command)
    } catch (err) {
      // A malformed command must not abort the whole 25 Hz frame for every player.
      this.emitToPlayer(playerUnitId, {
        type: 'Chat',
        kind: 'system',
        text: `Command failed: ${command.type}`,
      })
    }
  }
  this.stepPendingInteractions()
  if (deferredWhilePaused.length > 0) {
    this.commandQueue.unshift(...deferredWhilePaused)
  }

  if (this.pausedState) {
    const pausedMap = new Map<number, readonly ServerEvent[]>()
    for (const [pid, queue] of this.outbox.entries()) {
      pausedMap.set(pid, [...queue])
    }
    return pausedMap
  }

  this.currentFrame++
  this.rng.nextUint32()
  this.areaPathWorld.syncWorldUnits(
    (id) =>
      this.monsters.has(id) ||
      this.petVisualStates.has(id) ||
      this.mercenaries.get(id)?.alive === true,
    (id) => Boolean(this.monsters.get(id)?.dead),
    (id) => this.objects.has(id),
    (id) => this.players.has(id),
  )

  // 2. Stream wilderness rooms & step player movement
  if (this.drlgRoomPopulator !== null) {
    for (const player of this.players.values()) {
      this.ensureAdjacentAreasLoaded(player.areaId)
      this.drlgRoomPopulator.activateNear(
        this,
        player.act,
        Math.floor(player.x + 0.5),
        Math.floor(player.y + 0.5),
      )
    }
    this.drlgRoomPopulator.updateProgress(this)
  }
  for (const player of this.players.values()) {
    this.ensureAdjacentAreasLoaded(player.areaId)
    this.activatePresetRoomsNearPlayer113c(player)
    this.streamWildernessRoomsForPlayer(player)
    if (player.dead) {
      this.revealAreaRoomsNearPlayer(player, true)
      continue
    }
    this.inStepPlayerMovement = true
    try {
      this.stepPlayerMovement(player)
    } finally {
      this.inStepPlayerMovement = false
    }
    if (this.drlgRoomPopulator !== null) {
      updatePlayerBreadcrumbs113c(player)
    }
    this.revealAreaRoomsNearPlayer(player, true)
    this.stepUnitStates(
      player.states,
      player.stateTimers,
      'player',
      player.unitId,
      player.areaId,
    )
  }

  // 2a. Step per-player 25Hz `AnimDispatcher` windup / keyframe actions / follow-through (#1789, #1862),
  // followed by `EVENTTYPE_STATREGEN` (`stepPlayerVitals`) so mana spent on the action frame ticks regen on the same frame.
  this.stepPlayerAnimations113c()
  for (const player of this.players.values()) {
    if (player.dead) continue
    this.stepPlayerVitals(player)
  }

  // 2b. Persistent combat states (skill buffs / curses / auras), aura pulses, and trade lockout timers
  this.emitTradeEvents(this.tradeManager.tick(this.currentFrame))
  this.stepPersistentCombatStates()
  this.stepPlayerAuras()
  this.stepMercenaryAuras()
  this.stepGrimWards113c()
  this.stepBladeShields113c()
  this.stepBladeFuryChannels113c()
  this.stepPartyMemberPulses()

  // 3. Step missiles & collision
  this.stepMissiles()

  // 3b. Ground item & gold decay timers (`D2Game.dll` `ITEMS_ExpireGroundItem`, #1915):
  // 10 min (15,000 frames) for regular/white/consumables/gold < 10k,
  // 20 min (30,000 frames) for magic & gold >= 10k,
  // 30 min (45,000 frames) for set/rare/unique/crafted/runeword/quest.
  for (const [itemId, gItem] of [...this.groundItems.entries()]) {
    if (gItem.expireFrame !== undefined && this.currentFrame >= gItem.expireFrame) {
      const gArea = gItem.areaId
      this.broadcastToArea(gArea, {
        type: 'UnitRemove',
        unitType: 4,
        id: itemId,
        unitId: itemId,
        areaId: gArea,
      })
      this.groundItems.delete(itemId)
    }
  }

  // 3c. Scheduled Chaos Sanctuary Diablo spawns (`ACT4Q3` 125-frame / 5-second timer, #1928, #2018)
  for (let i = this.pendingDiabloSpawns.length - 1; i >= 0; i--) {
    const pending = this.pendingDiabloSpawns[i]!
    if (this.currentFrame >= pending.frame) {
      this.pendingDiabloSpawns.splice(i, 1)
      const hasLoadedArea = this.loadedAreas.has(pending.areaId)
      const stand = hasLoadedArea
        ? findStandableNear(
            (x, y) => this.isWorldWalkableForPlayer(pending.areaId, x, y),
            pending.x,
            pending.y,
            100,
          )
        : null
      if (!hasLoadedArea || stand !== null) {
        this.spawnMonster({
          defId: 'diablo',
          x: stand?.x ?? pending.x,
          y: stand?.y ?? pending.y,
          areaId: pending.areaId,
        })
      }
    }
  }

  // Shrines return to their idle mode after Shrines.txt ResetTime; water wells regenerate charges via Event 2 (0x6fc89ca0).
  for (const obj of this.objects.values()) {
    if (obj.mode === 2 && obj.shrineResetFrame > 0 && this.currentFrame >= obj.shrineResetFrame) {
      obj.shrineResetFrame = 0
      this.setObjectMode(obj, 0)
    }
    if (obj.wellRegenFrames.length > 0) {
      const maxCharges = computeWellInitialCharges113c(WELL_DEFAULT_PARMS_113C.parm2)
      while (obj.wellRegenFrames.length > 0 && this.currentFrame >= obj.wellRegenFrames[0]!) {
        obj.wellRegenFrames.shift()
        if (obj.wellCharges < maxCharges) {
          obj.wellCharges += 1
          const nextMode = computeWellModeForCharges113c(
            obj.wellCharges,
            WELL_DEFAULT_PARMS_113C.parm2,
          )
          if (nextMode !== undefined) {
            this.setObjectMode(obj, nextMode)
          }
        }
      }
    }
  }

  // 4. Step monster AI & state timers (incl. 1.13c Open Wounds 200-frame bleed #1870)
  this.stepMonsterOpenWounds113c()
  const townDiffIdx = Math.max(0, Math.min(2, this.difficulty))
  const warrivIntroBit = NPC_INTRO_BIT_BY_HCIDX_113C.get(155) ?? 4
  const a1q1WordIdx = questWordIndex113c('a1q1') ?? 1
  const townNpcPlayers: TownNpcPlayerContext[] = []
  for (const p of this.players.values()) {
    if (p.dead) continue
    const introByte = p.npcIntro[4 + townDiffIdx * 8 + (warrivIntroBit >> 3)] ?? 0
    const warrivIntroSet = (introByte & (1 << (warrivIntroBit & 7))) !== 0
    const a1q1Started = (p.questFlags[a1q1WordIdx] ?? 0) !== 0
    townNpcPlayers.push({
      unitId: p.unitId,
      areaId: p.areaId,
      x: Math.round(p.x),
      y: Math.round(p.y),
      activeNpcId: p.activeNpcId,
      warrivGreeted: warrivIntroSet || a1q1Started,
    })
  }
  this.areaPathWorld.stepTownNpcs(
    this.monsters.values(),
    (uid) => this.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${uid}`),
    townNpcPlayers,
    this.currentFrame,
    this.difficulty,
    (mon, prevX, prevY) => {
      this.syncUnitMoveAcrossViewerAoi113c(
        'monster',
        mon.unitId,
        mon.areaId,
        prevX,
        prevY,
        mon.areaId,
        mon.x,
        mon.y,
      )
    },
  )
  if (this.drlgRoomPopulator !== null) {
    for (const monster of this.monsters.values()) {
      if (monster.dead || (monster.despawnAtFrame > 0 && this.currentFrame >= monster.despawnAtFrame)) {
        continue
      }
      this.stepUnitStates(
        monster.states,
        monster.stateTimers,
        'monster',
        monster.unitId,
        monster.areaId,
      )
    }
  }
  if (this.drlgRoomPopulator !== null) stepOracleNecroPetsEarly113c(this)
  const drlgDeferred: InternalMonsterRecord[] = []
  if (this.drlgRoomPopulator !== null) {
    // Events scheduled outside the monster phase (player hits, missiles, pets) get their sequence now.
    for (const monster of this.monsters.values()) refreshMonsterEventSeq113c(this, monster)
  }
  for (const monster of [...this.monsters.values()]) {
    if (monster.dead) {
      if (
        this.drlgRoomPopulator === null &&
        monster.mode === 0 &&
        monster.deathAnimEndFrame !== undefined &&
        monster.deathAnimEndFrame > 0 &&
        this.currentFrame >= monster.deathAnimEndFrame
      ) {
        monster.deathAnimEndFrame = 0
        monster.mode = 12
      }
      if (monster.hcIdx === 544 || monster.hcIdx === 709) {
        this.despawnBaalMinionsOnBossDeath113c(monster)
      }
      this.resolvePendingDeathExplosion(monster)
      if (
        monster.pendingDropItems !== undefined &&
        this.currentFrame >= monster.pendingDropFrame
      ) {
        const items = monster.pendingDropItems
        monster.pendingDropItems = undefined
        this.spawnDroppedItems(items, monster.areaId, monster.x, monster.y)
      }
      // 1.13c `MonUMod #34` (`ai_after_death`, `0x6FC43E20`) & `#293 Self-resurrect` (`0x6FC38A90`, #1901):
      // Act 5 `reanimatedhorde` corpses roll `aip1%` (`30..70%`) to stand back up when unshattered & unconsumed.
      if (
        monster.selfResurrectCheckFrame > 0 &&
        this.currentFrame >= monster.selfResurrectCheckFrame
      ) {
        if (monster.shattered || monster.corpseConsumed) {
          monster.selfResurrectCheckFrame = 0
        } else {
          const chancePct = resolveSelfResurrectChancePct113c(
            monster.hcIdx,
            monster.aiParams[0],
          )
          if (this.rng.rand(100) < chancePct) {
            monster.dead = false
            monster.hp = monster.maxHp
            monster.mode = 1
            monster.alreadyGrantedKillRewards = true
            monster.selfResurrectCheckFrame = 0
            monster.selfResurrectCount += 1
            this.broadcastToArea(monster.areaId, {
              type: 'UnitMode',
              unitType: 1,
              id: monster.unitId,
              mode: 8,
              at: { x: Math.round(monster.x), y: Math.round(monster.y) },
              lifePct: 128,
            })
            this.broadcastToArea(monster.areaId, {
              type: 'UnitMode',
              unitType: 1,
              id: monster.unitId,
              mode: 1,
              at: { x: Math.round(monster.x), y: Math.round(monster.y) },
              lifePct: 128,
            })
            this.broadcastToArea(monster.areaId, {
              type: 'UnitStatUpdate',
              unitType: 'monster',
              unitId: monster.unitId,
              statId: 6,
              value: monster.hp,
            })
          } else {
            monster.selfResurrectCheckFrame = this.currentFrame + 75
          }
        }
      }
      continue
    }
    if (monster.despawnAtFrame > 0 && this.currentFrame >= monster.despawnAtFrame) {
      this.despawnTemporaryMonsterUnit113c(monster)
      continue
    }
    if (this.drlgRoomPopulator === null) {
      this.stepUnitStates(
        monster.states,
        monster.stateTimers,
        'monster',
        monster.unitId,
        monster.areaId,
      )
    }
    if (!monster.states.has(26) && monster.ac !== monster.baseAcBeforeShout) {
      monster.ac = monster.baseAcBeforeShout
    }
    if (monster.frozenTicks > 0) {
      monster.frozenTicks =
        monster.states.has(1) || monster.states.has(29)
          ? Math.max(0, monster.frozenTicks - 1)
          : 0
    }
    if (monster.chillTicks > 0) {
      monster.chillTicks =
        monster.states.has(11) || monster.states.has(44)
          ? Math.max(0, monster.chillTicks - 1)
          : 0
    }
    if (!monster.isNpc) {
      this.stepMonsterPoison(monster)
      if (monster.dead) continue
      if (this.drlgRoomPopulator === null) {
        this.stepMonsterRegen(monster)
      }
      if (monster.auraSkillId !== undefined && this.isMonsterInActiveAoi(monster)) {
        this.applyMonsterAura(monster)
      }
    }
    if (this.drlgRoomPopulator !== null) {
      // Route-2 event order (kb/engine/d2game-event-wheel-and-room-units-113c.md §6): the AI step runs in
      // the ordered monster phase below.
      drlgDeferred.push(monster)
      continue
    }
    stepMonsterAiAndPending113c(this, monster)
  }
  if (this.drlgRoomPopulator !== null) runDrlgMonsterEventPhase113c(this, drlgDeferred)
  if (this.drlgRoomPopulator !== null) {
    const dueEvent3 = [...this.monsters.values()]
      .filter((m) => !m.dead && !m.isNpc && m.nextEvent3Frame113c === this.currentFrame)
      .sort((a, b) => (a.event3Seq113c ?? 0) - (b.event3Seq113c ?? 0))
    for (const monster of dueEvent3) {
      this.stepMonsterRegen(monster)
    }
  }

  // 5. Step mercenaries & summoned pets (F13)
  this.stepMercenaries()
  this.stepSummonedPets()

  // 6. End-of-frame client room sync (`0x6FCBD850` / `0x6FCBD5B0`), 12-frame distant room unload
  // (`0x6FC4E106` -> `0x6FC4CF30`), and 11-frame inactive tick increment (`0x6FC4E11E` -> `0x6FC2B2F4`).
  if (this.drlgRoomPopulator !== null) {
    this.drlgRoomPopulator.syncClientRoomPresence(this)
    if (this.currentFrame > 0 && this.currentFrame % 12 === 0) {
      this.drlgRoomPopulator.deactivateDistantRooms(this)
    }
    if (this.currentFrame > 0 && this.currentFrame % 11 === 0) {
      this.drlgRoomPopulator.incrementInactiveRoomFrames()
    }
  }

  const frameMap = new Map<number, readonly ServerEvent[]>()
  for (const [pid, queue] of this.outbox.entries()) {
    frameMap.set(pid, [...queue])
  }
  return frameMap
}



function stepFrames(this: GameInstanceHost, count: number): void {
  if (!Number.isFinite(count) || count <= 0) return
  const n = Math.floor(count)
  for (let i = 0; i < n; i++) {
    this.stepFrame()
  }
}



function isPlayerInBlockRecovery(this: GameInstanceHost, player: InternalPlayerRecord): boolean {
  return (
    player.blockRecoveryUntilFrame !== undefined &&
    this.currentFrame < player.blockRecoveryUntilFrame
  )
}



function isPlayerInHitRecovery(this: GameInstanceHost, player: InternalPlayerRecord): boolean {
  return (
    (player.hitRecoveryUntilFrame !== undefined &&
      this.currentFrame < player.hitRecoveryUntilFrame) ||
    this.isPlayerInBlockRecovery(player)
  )
}



function processPlayerCommand(this: GameInstanceHost, player: InternalPlayerRecord, cmd: ClientCommand): void {
  switch (cmd.type) {
    case 'Move': {
      if (player.dead) return
      const dx = (cmd.x ?? player.x) - player.x
      const dy = (cmd.y ?? player.y) - player.y
      if (dx * dx + dy * dy > 65536) {
        this.emitToPlayer(player.unitId, { type: 'WalkVerify', stamina: player.stamina || 0, x: player.x, y: player.y, vx: 0, vy: 0 })
        return
      }
      if (this.consumeOrBlockMoveDuringPlayerAnim113c(player)) {
        this.rubberbandPlayer113c(player)
        return
      }
      const tx = cmd.to?.x ?? cmd.x ?? player.x
      const ty = cmd.to?.y ?? cmd.y ?? player.y
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) return
      this.clearPlayerChannelState(player)
      player.queuedSkillOnTarget = undefined
      player.pendingInteraction = undefined
      player.pendingInteractionSteps = 0
      player.pendingNpcGamble = undefined
      player.moveTargetUnitId = undefined
      player.targetX = tx
      player.targetY = ty
      player.run = cmd.run ?? true
      player.animResetFrame = undefined
      player.mode = player.run ? 3 : (TOWN_AREAS.has(player.areaId) ? 6 : 2)
      {
        const motion = this.playerMotion.get(player.unitId)
        if (motion !== undefined) {
          motion.plannedX = Number.NaN
          motion.plannedY = Number.NaN
        }
      }
      break
    }
    case 'WalkToLocation': {
      if (player.dead) return
      if (this.consumeOrBlockMoveDuringPlayerAnim113c(player)) {
        this.rubberbandPlayer113c(player)
        return
      }
      if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) return
      this.clearPlayerChannelState(player)
      player.queuedSkillOnTarget = undefined
      player.pendingInteraction = undefined
      player.pendingInteractionSteps = 0
      player.pendingNpcGamble = undefined
      player.moveTargetUnitId = undefined
      player.targetX = cmd.x
      player.targetY = cmd.y
      player.run = false
      player.animResetFrame = undefined
      player.mode = TOWN_AREAS.has(player.areaId) ? 6 : 2
      {
        const motion = this.playerMotion.get(player.unitId)
        if (motion !== undefined) {
          motion.plannedX = Number.NaN
          motion.plannedY = Number.NaN
        }
      }
      break
    }
    case 'RunToLocation': {
      if (player.dead) return
      if (this.consumeOrBlockMoveDuringPlayerAnim113c(player)) {
        this.rubberbandPlayer113c(player)
        return
      }
      if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) return
      this.clearPlayerChannelState(player)
      player.queuedSkillOnTarget = undefined
      player.pendingInteraction = undefined
      player.pendingInteractionSteps = 0
      player.pendingNpcGamble = undefined
      player.moveTargetUnitId = undefined
      player.targetX = cmd.x
      player.targetY = cmd.y
      player.run = true
      player.animResetFrame = undefined
      player.mode = 3
      {
        const motion = this.playerMotion.get(player.unitId)
        if (motion !== undefined) {
          motion.plannedX = Number.NaN
          motion.plannedY = Number.NaN
        }
      }
      break
    }
    case 'MoveToUnit':
    case 'WalkToTarget':
    case 'RunToTarget': {
      if (player.dead) return
      if (this.consumeOrBlockMoveDuringPlayerAnim113c(player)) {
        this.rubberbandPlayer113c(player)
        return
      }
      this.clearPlayerChannelState(player)
      player.queuedSkillOnTarget = undefined
      player.pendingInteraction = undefined
      player.pendingInteractionSteps = 0
      player.pendingNpcGamble = undefined
      player.moveTargetUnitId = undefined
      const targetId =
        cmd.type === 'MoveToUnit' ? cmd.target.id : cmd.unitId
      // C2S 0x02/0x04 carry the target's unit type; ids are only unique within a type.
      const targetType = interactUnitType113c(
        cmd.type === 'MoveToUnit' ? cmd.target.unitType : cmd.unitKind,
      )
      player.moveTargetUnitId = targetId
      player.moveTargetUnitType = targetType
      const pos = this.findUnitPosition(targetId, player.areaId, targetType)
      if (pos) {
        let targetX = pos.x
        let targetY = pos.y
        const warpTile =
          targetType === undefined || targetType === UNIT_TYPE_113C.tile ? this.warpTiles.get(targetId) : undefined
        if (
          warpTile !== undefined &&
          warpTile.areaId === player.areaId &&
          this.loadedAreas.has(player.areaId) &&
          !this.isWorldWalkableForPlayer(player.areaId, targetX, targetY)
        ) {
          const stand = findBestInteractApproachSubTile113c({
            isWalkable: (x, y) => this.isWorldWalkableForPlayer(player.areaId, x, y),
            canInteractFrom: (x, y) =>
              D2Common_10399_AtSubtiles(
                warpTile.x,
                warpTile.y,
                0,
                x,
                y,
                PLAYER_SIZE_X_113C,
              ) <= WARP_INTERACT_DISTANCE_SUBTILES &&
              this.hasInteractionLineOfSight(player.areaId, x, y, warpTile.x, warpTile.y),
            anchorX: warpTile.x,
            anchorY: warpTile.y,
            playerX: player.x,
            playerY: player.y,
            maxRadius: WARP_INTERACT_DISTANCE_SUBTILES + 2,
          })
          if (stand !== null) {
            targetX = stand.x
            targetY = stand.y
          }
        }
        const targetObj =
          targetType === undefined || targetType === UNIT_TYPE_113C.object ? this.objects.get(targetId) : undefined
        if (
          targetObj !== undefined &&
          targetObj.areaId === player.areaId &&
          this.loadedAreas.has(player.areaId) &&
          !this.isWorldWalkableForPlayer(player.areaId, targetX, targetY)
        ) {
          const stand = findBestInteractApproachSubTile113c({
            isWalkable: (x, y) => this.isWorldWalkableForPlayer(player.areaId, x, y),
            canInteractFrom: (x, y) =>
              isObjectInInteractRange113c(
                x,
                y,
                PLAYER_SIZE_X_113C,
                targetObj.x,
                targetObj.y,
                targetObj.classId,
              ) &&
              this.hasInteractionLineOfSight(
                player.areaId,
                x,
                y,
                targetObj.x,
                targetObj.y,
                targetObj.unitId,
              ),
            anchorX: targetObj.x,
            anchorY: targetObj.y,
            playerX: player.x,
            playerY: player.y,
            maxRadius: computeObjectApproachSearchRadius113c(targetObj.classId),
          })
          if (stand !== null) {
            targetX = stand.x
            targetY = stand.y
          }
        }
        player.targetX = targetX
        player.targetY = targetY
        player.run =
          cmd.type === 'RunToTarget' ||
          (cmd.type === 'MoveToUnit' && cmd.run)
        player.animResetFrame = undefined
        player.mode = player.run ? 3 : (TOWN_AREAS.has(player.areaId) ? 6 : 2)
        const motion = this.playerMotion.get(player.unitId)
        if (motion !== undefined) {
          motion.plannedX = Number.NaN
          motion.plannedY = Number.NaN
        }
      }
      break
    }
    case 'SelectSkill': {
      const skillId = Number(cmd.skill ?? cmd.skillId ?? 0)
      const reqItemId =
        cmd.itemId !== undefined && cmd.itemId !== 0xffffffff ? cmd.itemId : undefined
      if (!this.isPlayerSkillSelectable(player, skillId, cmd.hand, reqItemId)) {
        break
      }
      let resolvedItemId = 0xffffffff
      if (reqItemId !== undefined) {
        resolvedItemId = reqItemId
      } else if (skillId > 0) {
        const skill = this.registry.getSkillById(skillId)
        if (skill !== undefined && this.resolvePlayerSkillLevel(player, skill) <= 0) {
          const charged = findChargedSkill(player.items, skill.id)
          if (charged !== undefined) resolvedItemId = charged.item.unitId
        }
      }
      if (cmd.hand === 'left') {
        player.leftSkill = skillId
        player.leftSkillItemId = resolvedItemId
      } else {
        player.rightSkill = skillId
        player.rightSkillItemId = resolvedItemId
        this.syncPlayerSelectedRightAura113c(player)
      }
      this.emitToPlayer(player.unitId, {
        type: 'ActiveSkill',
        unitId: player.unitId,
        hand: cmd.hand,
        skill: skillId,
        itemId: resolvedItemId,
      })
      break
    }
    case 'AssignSkillHotkey': {
      const slot = Number(cmd.slot ?? -1)
      if (!Number.isInteger(slot) || slot < 0 || slot >= 16) break
      const skillId = Number(cmd.skill ?? 0xffff)
      const isUnbind =
        skillId === 0xffff ||
        (skillId & 0x7fff) === 0x7fff ||
        skillId < 0
      if (!isUnbind && !this.isPlayerSkillSelectable(player, skillId & 0x7fff, cmd.hand)) {
        break
      }
      const encoded = isUnbind
        ? 0xffff
        : (((cmd.hand === 'left' ? 0x8000 : 0) | (skillId & 0x7fff)) & 0xffff)
      const itemId = isUnbind ? 0xffffffff : ((cmd.itemId ?? 0xffffffff) >>> 0)
      if (!isUnbind) {
        for (let i = 0; i < 16; i++) {
          if (i !== slot && player.hotkeys[i] === encoded) {
            player.hotkeys[i] = 0xffff
            player.hotkeyItemIds[i] = 0xffffffff
          }
        }
      }
      player.hotkeys[slot] = encoded
      player.hotkeyItemIds[slot] = itemId
      if (player.d2sTemplate?.hotkeys) {
        const mutableHotkeys = player.d2sTemplate.hotkeys as number[]
        for (let i = 0; i < Math.min(16, mutableHotkeys.length); i++) {
          mutableHotkeys[i] = player.hotkeys[i] ?? 0xffff
        }
      }
      break
    }
    case 'CastSkillAtLocation':
    case 'CastLeftSkillOnLocation':
    case 'CastRightSkillOnLocation':
    case 'SkillAt': {
      if (player.dead) return
      const tx = cmd.type === 'SkillAt' ? cmd.at.x : cmd.x
      const ty = cmd.type === 'SkillAt' ? cmd.at.y : cmd.y
      if (
        this.drlgRoomPopulator !== null &&
        Math.max(
          Math.abs(Math.floor(player.x + 0.5) - Math.floor(tx + 0.5)),
          Math.abs(Math.floor(player.y + 0.5) - Math.floor(ty + 0.5)),
        ) > 50
      ) {
        return
      }
      player.queuedSkillOnTarget = undefined
      const hand =
        cmd.type === 'CastLeftSkillOnLocation'
          ? 'left'
          : cmd.type === 'CastRightSkillOnLocation'
            ? 'right'
            : (cmd.hand ?? 'right')
      const explicitSkillId =
        cmd.type === 'CastSkillAtLocation' ? cmd.skillId : undefined
      const skillId =
        explicitSkillId !== undefined
          ? explicitSkillId
          : hand === 'left'
            ? player.leftSkill
            : player.rightSkill
      if (this.isPlayerInHitRecovery(player) && !this.registry.getSkillById(skillId)?.aura) {
        return
      }
      if (skillId === 90) {
        this.executeIronGolemSkillCast113c(player, { tx, ty })
        break
      }
      const hold = 'hold' in cmd ? Boolean(cmd.hold) : false
      this.executeSkillAtLocation(player, skillId, tx, ty, undefined, { hold })
      break
    }
    case 'CastSkillOnTarget':
    case 'CastLeftSkillOnTarget':
    case 'CastRightSkillOnTarget':
    case 'SkillOn': {
      if (player.dead) return
      const targetId =
        cmd.type === 'SkillOn'
          ? cmd.target.id
          : cmd.type === 'CastSkillOnTarget'
            ? Number(cmd.targetId ?? 0)
            : cmd.unitId
      // #1806: keep the clicked unit type (C2S 0x06/0x07/0x0D/0x0E) so Telekinesis can reach
      // ground items (4) and objects (2), not only monsters.
      const targetType = normalizeSkillTargetUnitType113c(
        cmd.type === 'SkillOn'
          ? cmd.target.unitType
          : cmd.type === 'CastSkillOnTarget'
            ? cmd.targetType
            : cmd.unitKind,
      )
      if (this.drlgRoomPopulator !== null) {
        const targetPos = this.findUnitPosition(targetId, player.areaId, targetType)
        if (
          !targetPos ||
          Math.max(
            Math.abs(Math.floor(player.x + 0.5) - Math.floor(targetPos.x + 0.5)),
            Math.abs(Math.floor(player.y + 0.5) - Math.floor(targetPos.y + 0.5)),
          ) > 50
        ) {
          return
        }
      }
      player.queuedSkillOnTarget = undefined
      const hand =
        cmd.type === 'CastLeftSkillOnTarget'
          ? 'left'
          : cmd.type === 'CastRightSkillOnTarget'
            ? 'right'
            : (cmd.hand ?? 'right')
      const explicitSkillId =
        cmd.type === 'CastSkillOnTarget' ? cmd.skillId : undefined
      const skillId =
        explicitSkillId !== undefined
          ? explicitSkillId
          : hand === 'left'
            ? player.leftSkill
            : player.rightSkill
      if (this.isPlayerInHitRecovery(player) && !this.registry.getSkillById(skillId)?.aura) {
        return
      }
      if (skillId === 90) {
        this.executeIronGolemSkillCast113c(player, { targetItemId: targetId })
        break
      }
      const shift = 'shift' in cmd ? Boolean(cmd.shift) : false
      const hold = 'hold' in cmd ? Boolean(cmd.hold) : false
      this.executeSkillOnTarget(player, skillId, targetId, targetType, { shift, hold })
      break
    }
    case 'Interact':
    case 'InteractEntity':
    case 'OperateObject': {
      if (
        player.dead ||
        this.isPlayerInHitRecovery(player) ||
        this.isPlayerInBlockRecovery(player) ||
        this.isPlayerWhirlwinding113c(player) ||
        this.isPlayerActionAnimLocked113c(player)
      ) {
        return
      }
      const targetId =
        cmd.type === 'OperateObject'
          ? cmd.objectId
          : cmd.type === 'Interact'
            ? cmd.target.id
            : cmd.targetId
      // C2S 0x13 InteractUnit(5, warpId): `UNIT_TILE` warps (D2Client 0x6facafbd).
      const rawTargetType: unknown =
        cmd.type === 'Interact' ? cmd.target.unitType : cmd.type === 'InteractEntity' ? cmd.targetType : 2
      const targetPlayerForInteract =
        rawTargetType === 0 || rawTargetType === 'player'
          ? this.players.get(targetId)
          : undefined
      if (
        targetPlayerForInteract !== undefined &&
        targetId !== player.unitId &&
        !targetPlayerForInteract.dead
      ) {
        this.handlePlayerTradeInteract(player, targetId)
        break
      }
      const isWarpTile = rawTargetType === 5 || rawTargetType === 'tile' || rawTargetType === 'warp'
      if (isWarpTile) {
        this.handleWarpTileInteract(player, targetId)
        break
      }
      this.handleInteract(player, targetId, interactUnitType113c(rawTargetType))
      break
    }
    case 'TakeWarp':
    case 'WarpTo': {
      if (
        player.dead ||
        this.isPlayerInHitRecovery(player) ||
        this.isPlayerInBlockRecovery(player) ||
        this.isPlayerWhirlwinding113c(player) ||
        this.isPlayerActionAnimLocked113c(player)
      ) {
        return
      }
      this.handleWarpTileInteract(player, cmd.warpId)
      break
    }
    case 'Say': {
      if (player.dead) return
      this.broadcastToArea(player.areaId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: cmd.phraseId,
      })
      break
    }
    case 'QuestMessageSound': {
      if (player.dead) return
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: cmd.questId,
      })
      break
    }
    case 'WaypointGo': {
      if (
        player.dead ||
        this.isPlayerInHitRecovery(player) ||
        this.isPlayerInBlockRecovery(player) ||
        this.isPlayerWhirlwinding113c(player) ||
        this.isPlayerActionAnimLocked113c(player)
      ) {
        return
      }
      if (cmd.destAreaId === 0 || cmd.destAreaId === player.areaId) {
        player.activeWaypointUnitId = 0
        if (player.pendingInteraction?.kind === 'waypoint') {
          player.pendingInteraction = undefined
        }
        return
      }
      if (!canUseWaypointInPvp113c(this.currentFrame, player.hostilePortalLockUntilFrame)) {
        player.activeWaypointUnitId = 0
        if (player.pendingInteraction?.kind === 'waypoint') {
          player.pendingInteraction = undefined
        }
        return
      }
      if (!this.canUseWaypoint(player, cmd.destAreaId)) {
        if (player.activeWaypointUnitId !== 0) {
          // D2Game 0x6fcf0de4..0x6fcf0e61: walking away from an opened waypoint or
          // requesting an invalid destination clears the active waypoint session.
          player.activeWaypointUnitId = 0
          return
        }
        // 1.13c accepts a far WaypointGo by walking to the current waypoint.
        if (
          WAYPOINT_AREA_IDS.includes(cmd.destAreaId) &&
          player.waypoints.has(cmd.destAreaId) &&
          areaToAct(cmd.destAreaId) <= player.unlockedAct
        ) {
          const areaWaypoints = [...this.objects.values()].filter(
            (obj) => obj.areaId === player.areaId && obj.isWaypoint,
          )
          const wp =
            areaWaypoints.find((obj) => obj.unitId === cmd.waypointId) ??
            areaWaypoints[0]
          if (
            wp !== undefined &&
            !areaWaypoints.some(
              (obj) =>
                Math.hypot(obj.x - player.x, obj.y - player.y) <=
                WAYPOINT_INTERACT_DISTANCE_SUBTILES,
            )
          ) {
            player.pendingInteraction = {
              kind: 'waypoint',
              id: wp.unitId,
              destAreaId: cmd.destAreaId,
            }
            player.pendingInteractionSteps = 0
          }
        }
        return
      }
      this.transitionPlayerArea(player, cmd.destAreaId, { kind: 'waypoint' })
      break
    }
    case 'TownPortal': {
      if (
        player.dead ||
        this.isPlayerInHitRecovery(player) ||
        this.isPlayerInBlockRecovery(player) ||
        this.isPlayerWhirlwinding113c(player) ||
        this.isPlayerActionAnimLocked113c(player)
      ) {
        return
      }
      this.openTownPortal(player)
      break
    }
    case 'ItemPickup':
    case 'PickUpItem': {
      if (player.dead) return
      this.handleItemPickup(player, cmd.itemId, Boolean(cmd.toCursor))
      break
    }
    case 'ItemToCursor': {
      if (player.dead) return
      this.handleItemToCursor(player, cmd.itemId)
      break
    }
    case 'ItemDrop': {
      if (player.dead) return
      this.handleItemDrop(player, cmd.itemId)
      break
    }
    case 'ItemPlace':
    case 'ItemMove': {
      if (player.dead) return
      const rawContainer =
        cmd.type === 'ItemMove'
          ? (cmd.container ?? 'inventory')
          : cmd.buffer === 4
            ? 'stash'
            : cmd.buffer === 3
              ? 'cube'
              : cmd.buffer === 2
                ? 'trade'
                : 'inventory'
      const container: 'inventory' | 'stash' | 'cube' | 'belt' | 'trade' =
        rawContainer === 'stash' ||
        rawContainer === 'cube' ||
        rawContainer === 'belt' ||
        rawContainer === 'trade'
          ? rawContainer
          : 'inventory'
      this.handleItemMove(player, cmd.itemId, cmd.x, cmd.y, container)
      break
    }
    case 'RunToggle': {
      player.run = Boolean(cmd.run)
      if (player.mode === 2 || player.mode === 3 || player.mode === 6) {
        player.mode = player.run ? 3 : (TOWN_AREAS.has(player.areaId) ? 6 : 2)
      }
      break
    }
    case 'DropGold': {
      if (player.dead) return
      this.handleDropGold(player, cmd.amount)
      break
    }
    case 'SwapContainerItem': {
      if (player.dead) return
      const targetId = Number(cmd.targetItemId ?? cmd.replacedItemId ?? 0)
      this.handleSwapContainerItem(player, cmd.cursorItemId, targetId, cmd.x, cmd.y)
      break
    }
    case 'IdentifyItem': {
      if (player.dead) return
      this.handleIdentifyItem(player, cmd.itemId, cmd.scrollId)
      break
    }
    case 'ScrollToBook': {
      if (player.dead) return
      this.handleScrollToBook(player, cmd.scrollId, cmd.bookId)
      break
    }
    case 'BeltSwap': {
      if (player.dead) return
      this.handleBeltSwap(player, cmd.cursorItemId, cmd.beltItemId)
      break
    }
    case 'ItemToBelt': {
      if (player.dead) return
      this.handleItemToBelt(player, cmd.itemId)
      break
    }
    case 'ItemToCube': {
      if (player.dead) return
      this.handleItemToCube(player, cmd.itemId, cmd.cubeId)
      break
    }
    case 'SocketItem': {
      if (player.dead) return
      this.handleSocketItem(player, cmd.itemId, cmd.targetItemId)
      break
    }
    case 'ItemEquip':
    case 'ItemSwap':
    case 'ItemSwap2Handed':
    case 'ItemSwap2HandedDual': {
      if (player.dead) return
      const slot = Number(cmd.slot ?? (cmd as { bodyLoc?: number }).bodyLoc ?? 1)
      const removeOppositeHand =
        cmd.type === 'ItemSwap2Handed' || cmd.type === 'ItemSwap2HandedDual'
      this.handleItemEquip(player, cmd.itemId, slot, removeOppositeHand)
      break
    }
    case 'ItemUnequip': {
      if (player.dead) return
      this.handleItemUnequip(player, cmd.slot)
      break
    }
    case 'SwapWeapons': {
      if (player.dead) return
      this.handleSwapWeapons(player)
      break
    }
    case 'MercItem': {
      if (player.dead) return
      this.handleMercItem(player, cmd.slot)
      break
    }
    case 'BeltPut': {
      if (player.dead) return
      this.handleBeltPut(player, cmd.itemId, cmd.slot)
      break
    }
    case 'BeltRemove': {
      if (player.dead) return
      this.handleBeltRemoveToCursor(player, cmd.itemId)
      break
    }
    case 'BeltUse': {
      if (player.dead) return
      this.handleBeltUse(player, cmd.itemId, Boolean(cmd.shift || cmd.useOnMerc))
      break
    }
    case 'ItemUse': {
      if (player.dead) return
      this.handleBeltUse(player, cmd.itemId, false)
      break
    }
    case 'StackItems': {
      if (player.dead) return
      this.handleStackItems(player, cmd.cursorItemId, cmd.targetItemId)
      break
    }
    case 'UnstackItems': {
      if (player.dead) return
      this.handleUnstackItems(player, cmd.itemId)
      break
    }
    case 'SelectMainItem':
    case 'ActivateQuestScroll': {
      if (player.dead) return
      this.handleSelectMainItem(player, cmd.itemId)
      break
    }
    case 'RequestQuestData': {
      this.sendQuestLogUpdate113c(player)
      break
    }
    case 'NpcInit':
    case 'NpcHeal': {
      const npcId = cmd.type === 'NpcHeal' ? cmd.npcId : cmd.target.id
      this.handleNpcInteract(player, npcId, cmd.type === 'NpcHeal')
      break
    }
    case 'NpcCancel': {
      player.activeNpcId = undefined
      player.lastNpcInteractHandshakeId = undefined
      player.activeVendorMode = null
      break
    }
    case 'NpcOpenTrade':
    case 'NpcOpenGamble':
    case 'NpcEntityAction':
    case 'NpcAction': {
      const npcId = cmd.npcId
      const complement =
        cmd.type === 'NpcAction'
          ? (cmd.complement ?? cmd.param)
          : cmd.type === 'NpcEntityAction'
            ? cmd.complement
            : undefined
      const travelAction = 'action' in cmd && cmd.action === 0
      if (
        (cmd.type === 'NpcEntityAction' || cmd.type === 'NpcAction') &&
        travelAction &&
        (complement === undefined || complement === 0) &&
        this.handleAkaraRespec(player, npcId)
      ) {
        break
      }
      if (
        (cmd.type === 'NpcEntityAction' || cmd.type === 'NpcAction') &&
        travelAction &&
        complement !== undefined &&
        (this.handleCursorArtisanService(player, npcId, complement) ||
          this.handleArtisanService(player, npcId, complement))
      ) {
        break
      }
      if (
        complement !== undefined &&
        ACT_TOWN_AREAS.includes(complement) &&
        travelAction
      ) {
        this.handleNpcTravel(player, npcId, complement)
        break
      }
      const actionType =
        cmd.type === 'NpcAction' || cmd.type === 'NpcEntityAction'
          ? cmd.action
          : cmd.type === 'NpcOpenGamble'
            ? 'gamble'
            : 'trade'
      if (actionType === 'heal' || actionType === 0) {
        this.handleNpcInteract(player, npcId, actionType === 'heal')
      } else if (actionType === 'hire' || Number(actionType) === 3) {
        this.handleNpcHireList(player, npcId)
      } else {
        const isGamble = actionType === 'gamble' || Number(actionType) === 2
        this.handleNpcAction(player, npcId, isGamble)
      }
      break
    }
    case 'NpcBuy':
    case 'NpcGamble': {
      const isGamble =
        cmd.type === 'NpcGamble' || Boolean(cmd.gamble ?? cmd.buyType === 2)
      const explicitCost = cmd.type === 'NpcBuy' ? cmd.cost : undefined
      const shiftFill = cmd.type === 'NpcBuy' && Boolean(cmd.shiftFill)
      this.handleNpcBuy(player, cmd.npcId, cmd.itemId, isGamble, explicitCost, shiftFill)
      break
    }
    case 'NpcSell': {
      this.handleNpcSell(player, cmd.npcId, cmd.itemId)
      break
    }
    case 'NpcRepairItem': {
      this.handleNpcRepair(player, cmd.npcId, cmd.itemId)
      break
    }
    case 'NpcRepairAll': {
      this.handleNpcRepair(player, cmd.npcId)
      break
    }
    case 'NpcIdentifyAll': {
      this.handleNpcIdentifyAll(player, cmd.npcId)
      break
    }
    case 'NpcIdentifyGamble': {
      this.handleNpcIdentifyItem(player, player.activeNpcId ?? 0, cmd.itemId)
      break
    }
    case 'HireMerc':
    case 'MercHire': {
      this.handleNpcHire(player, cmd.npcId, cmd.mercId)
      break
    }
    case 'NpcResurrectMerc':
    case 'MercResurrect': {
      this.handleMercResurrect(player, cmd.npcId)
      break
    }
    case 'AddStatPoint':
    case 'AllocateStat': {
      const amount =
        cmd.type === 'AllocateStat'
          ? (cmd.amount ?? cmd.count ?? 1)
          : (cmd.count ?? 1)
      this.handleAllocateStat(player, cmd.statId, Math.max(1, amount))
      break
    }
    case 'AddSkillPoint':
    case 'AllocateSkill': {
      this.handleAllocateSkill(player, cmd.skillId)
      break
    }
    case 'ClickButton': {
      const amount =
        cmd.amount !== undefined
          ? cmd.amount
          : cmd.complement !== undefined
            ? ((((cmd.complement & 0xffff) << 16) | ((cmd.complement >>> 16) & 0xffff)) >>> 0)
            : 0
      this.handleClickButton(player, cmd.buttonId ?? cmd.button ?? 0, amount)
      break
    }
    case 'Resurrect':
    case 'Respawn': {
      this.handleRespawn(player)
      break
    }
    case 'Party':
    case 'PartyAction': {
      this.handlePartyCommand(player, cmd.action, cmd.targetPlayerId)
      break
    }
    case 'Hostile': {
      this.handleHostileCommand(player, cmd.targetPlayerId, cmd.hostile, cmd.button)
      break
    }
    case 'Chat': {
      this.handleChatCommand(player, cmd.text, cmd.whisperTo)
      break
    }
    case 'OverheadChat': {
      this.handleOverheadChatCommand(player, cmd.text)
      break
    }
    case 'UpdatePlayerPos': {
      this.handleUpdatePlayerPos(player, cmd.x, cmd.y)
      break
    }
    case 'RequestEntityUpdate': {
      this.handleRequestEntityUpdate(player, cmd.unitType, cmd.unitId)
      break
    }
    case 'MakeEntityMove':
      // Silently accepted to prevent drop
      break
    default:
      break
  }
}



/**
 * Advance one player by one 25Hz tick (issue #1329).
 *
 * Uses the same {@link LocalMovementPredictor} as the client, so the server matches the
 * client's D2Common 1.13c step (walk 9.0 / run 13.5 sub-tiles per second = 0.36 / 0.54 per
 * tick, run bonus dropped when stamina is exhausted) and follows the same `findPathWorld`
 * waypoints (size-2 `+` footprint) against the area collision callback, halting at walls.
 *
 * Broadcast rules: the walk/run `UnitMove` goes to the other players in the area only — D2Game
 * skips the moving player's own client for its stand/walk/run messages (D2MOO `PlrMsg.cpp`,
 * `stru_6FD30708`); the owner predicts locally and is checked through `LifeMana` positions
 * (D2Client tolerance gate 0x6FADA1B0 → C2S `0x5F` → S2C `0x15`).
 */
function stepPlayerMovement(this: GameInstanceHost, player: InternalPlayerRecord): void {
  this.ensureAdjacentAreasLoaded(player.areaId)
  if (this.isPlayerWhirlwinding113c(player)) {
    player.mode = 18
    return
  }
  if (this.isPlayerInBlockRecovery(player)) {
    player.mode = player.blockRecoveryMode113c ?? 9
    return
  }
  if (this.isPlayerInHitRecovery(player)) {
    player.mode = 4
    return
  }
  if (this.isPlayerActionAnimLocked113c(player)) {
    const activeAnim = this.playerAnimDispatchers.get(player.unitId)?.getCurrentAnimation()
    if (activeAnim && !activeAnim.completed) {
      player.mode = getSkillAnimModes(activeAnim.skill.id).playerMode
    }
    player.targetX = player.x
    player.targetY = player.y
    // 1.13c: starting a skill / attack mode ends the walk / run path; when the animation finishes the
    // player is in NU, the old run target is not resumed (oracle `p52-barbarian-warcries`: War Cry cast
    // while running on F=910, NU on F=923 at the cast position).
    if (this.drlgRoomPopulator !== null) {
      const lockedMotion = this.playerMotion.get(player.unitId)
      if (
        lockedMotion !== undefined &&
        (lockedMotion.moving || this.areaPathWorld.isPlayerMoving(player.areaId, player.unitId))
      ) {
        lockedMotion.mover.stop()
        lockedMotion.moving = false
        lockedMotion.plannedX = player.x
        lockedMotion.plannedY = player.y
        this.areaPathWorld.stopPlayer(player.unitId, player.mode)
      }
    }
    return
  }
  const motion = this.getPlayerMotion(player)
  const mover = motion.mover

  // Another system (area change, teleport, respawn, `0x5F` warp, `movePlayer`) moved the
  // player since the last step: restart from the new position.
  if (player.x !== motion.x || player.y !== motion.y) {
    mover.setPosition(player.x, player.y)
    motion.x = player.x
    motion.y = player.y
    motion.moving = false
    motion.plannedX = Number.NaN
    motion.plannedY = Number.NaN
    this.areaPathWorld.spawnOrSyncPlayer(
      player.areaId,
      player.unitId,
      player.classId,
      player.x,
      player.y,
      player.mode,
    )
  }

  if (
    player.moveTargetUnitId !== undefined &&
    !(
      this.drlgRoomPopulator !== null &&
      motion.moving &&
      !Number.isNaN(motion.plannedX) &&
      this.areaPathWorld.isPlayerMoving(player.areaId, player.unitId)
    )
  ) {
    const moveType = player.moveTargetUnitType
    const pos = this.findUnitPosition(player.moveTargetUnitId, player.areaId, moveType)
    if (pos) {
      const isStaticTarget =
        moveType === undefined
          ? this.warpTiles.has(player.moveTargetUnitId) || this.objects.has(player.moveTargetUnitId)
          : moveType === UNIT_TYPE_113C.tile || moveType === UNIT_TYPE_113C.object
      if (!isStaticTarget) {
        player.targetX = pos.x
        player.targetY = pos.y
      }
    } else {
      player.moveTargetUnitId = undefined // Target disappeared or changed area
    }
  }

  // STAT_STAMINA == 0: running degrades to walking (D2Client checks the same stat before
  // sending run, `CommandMapper.isStaminaExhausted`; the predictor drops the run bonus).
  this.applyPlayerVelocityModifiers(player, mover)
  const staminaExhausted =
    player.staminaExhausted || player.stamina <= 0 || player.staminaFixed <= 0
  mover.setStaminaExhausted(staminaExhausted)
  if (staminaExhausted && player.run) {
    player.run = false
    if (motion.moving || player.mode === 3) {
      player.mode = TOWN_AREAS.has(player.areaId) ? 6 : 2
    }
  }
  mover.setRunning(player.run)
  const frw = mover.getFasterRunWalkPercent()
  const effItemFrw = frw > 0 ? Math.floor((150 * frw) / (150 + frw)) : frw
  const velocityPercentBonus =
    effItemFrw +
    mover.getSkillVelocityPercent() -
    Math.abs(mover.getArmorSpeedPenaltyPercent()) -
    mover.getSlowPercent()

  const hasTarget = Math.hypot(player.targetX - player.x, player.targetY - player.y) > 0.01
  const useAreaPath113c =
    this.terrainWalkableCheck &&
    !this.hasLivingBonePrisonInArea(player.areaId) &&
    this.areaPathWorld.hasArea(player.areaId) &&
    this.areaPathWorld.isInBounds(player.areaId, player.x, player.y) &&
    this.areaPathWorld.isInReachableBounds(player.areaId, player.targetX, player.targetY)

  if (useAreaPath113c) {
    const wasMoving = motion.moving
    if (hasTarget && (player.targetX !== motion.plannedX || player.targetY !== motion.plannedY)) {
      motion.plannedX = player.targetX
      motion.plannedY = player.targetY
      const moveMode = player.run ? 3 : (TOWN_AREAS.has(player.areaId) ? 6 : 2)
      let planned = false
      if (
        player.moveTargetUnitId !== undefined &&
        (player.moveTargetUnitType === UNIT_TYPE_113C.monster ||
          player.moveTargetUnitType === UNIT_TYPE_113C.player ||
          (player.moveTargetUnitType === UNIT_TYPE_113C.object &&
            !this.isWorldWalkableForPlayer(player.areaId, player.targetX, player.targetY)))
      ) {
        planned = this.areaPathWorld.planPlayerMoveToUnit(
          player.areaId,
          player.unitId,
          player.classId,
          player.x,
          player.y,
          player.moveTargetUnitType,
          player.moveTargetUnitId,
          player.targetX,
          player.targetY,
          player.run,
          velocityPercentBonus,
          moveMode,
          0,
        )
      } else {
        planned = this.areaPathWorld.planPlayerMoveToLocation(
          player.areaId,
          player.unitId,
          player.classId,
          player.x,
          player.y,
          player.targetX,
          player.targetY,
          player.run,
          velocityPercentBonus,
          moveMode,
        )
      }
      motion.moving = planned
      if (planned) {
        player.mode = moveMode
      }
    }

    if (!this.areaPathWorld.isPlayerMoving(player.areaId, player.unitId)) {
      if (motion.moving || wasMoving) {
        this.finishPlayerMove(player, motion)
      } else {
        player.moveTargetUnitId = undefined
        player.targetX = player.x
        player.targetY = player.y
        motion.plannedX = player.x
        motion.plannedY = player.y
        if (player.animResetFrame === undefined) {
          player.mode = TOWN_AREAS.has(player.areaId) ? 5 : 1
        }
        this.areaPathWorld.stopPlayer(player.unitId, player.mode)
      }
      return
    }

    const prevMoveAreaId = player.areaId
    const prevMoveX = player.x
    const prevMoveY = player.y
    this.drainPlayerRunStamina113c(player)
    mover.setRunning(player.run)
    const tick = this.areaPathWorld.stepPlayerTick(
      player.areaId,
      player.unitId,
      player.run,
      velocityPercentBonus,
    )
    if (!tick) {
      this.finishPlayerMove(player, motion)
      return
    }
    player.x = tick.x
    player.y = tick.y
    motion.x = player.x
    motion.y = player.y
    mover.setPosition(player.x, player.y)
    player.mode = player.run ? 3 : (TOWN_AREAS.has(player.areaId) ? 6 : 2)
    this.maybeSwitchPlayerAreaSeamless(player)
    player.mode = player.run ? 3 : (TOWN_AREAS.has(player.areaId) ? 6 : 2)
    if (player.areaId === prevMoveAreaId && (player.x !== prevMoveX || player.y !== prevMoveY)) {
      this.syncUnitMoveAcrossViewerAoi113c(
        'player',
        player.unitId,
        prevMoveAreaId,
        prevMoveX,
        prevMoveY,
        player.areaId,
        player.x,
        player.y,
        player.unitId,
      )
    }

    const nextWp = tick.stillMoving
      ? this.areaPathWorld.getPlayerNextWaypoint(player.areaId, player.unitId)
      : null
    if (!tick.stillMoving || nextWp === null) {
      this.finishPlayerMove(player, motion)
    } else {
      const toX = Math.round(nextWp.x)
      const toY = Math.round(nextWp.y)
      const velocityPercent = Math.round(
        (mover.getEffectiveSpeedSubTilesPerSec() / D2_BASE_WALK_SUBTILES_PER_SEC) * 100,
      )
      this.broadcastToAreaExcept(player.areaId, player.unitId, {
        type: 'UnitMove',
        unitType: 0,
        id: player.unitId,
        unitId: player.unitId,
        mode: player.run ? 'run' : 'walk',
        from: { x: Math.round(player.x), y: Math.round(player.y) },
        to: { x: toX, y: toY },
        x: Math.round(player.x),
        y: Math.round(player.y),
        currentX: Math.round(player.x),
        currentY: Math.round(player.y),
        targetX: toX,
        targetY: toY,
        velocityPercent,
      })
    }
  } else {
    if (hasTarget && (player.targetX !== motion.plannedX || player.targetY !== motion.plannedY)) {
      motion.plannedX = player.targetX
      motion.plannedY = player.targetY
      const areaId = player.areaId
      mover.setCollisionChecker(
        this.terrainWalkableCheck || this.hasLivingBonePrisonInArea(areaId)
          ? (sx, sy) => this.isPlayerSubTileBlocked(areaId, sx, sy)
          : null,
      )
      mover.setPath(
        this.findPlayerPath(
          areaId,
          Math.round(player.x),
          Math.round(player.y),
          player.targetX,
          player.targetY,
        ),
        player.run,
      )
      motion.moving = true
    }

    if (mover.getRemainingWaypoints().length === 0) {
      if (motion.moving) {
        this.finishPlayerMove(player, motion)
      } else if (!hasTarget) {
        player.mode = TOWN_AREAS.has(player.areaId) ? 5 : 1
      }
      return
    }

    if (this.hasLivingBonePrisonInArea(player.areaId)) {
      const areaId = player.areaId
      mover.setCollisionChecker((sx, sy) => this.isPlayerSubTileBlocked(areaId, sx, sy))
    }
    const prevMoveAreaId = player.areaId
    const prevMoveX = player.x
    const prevMoveY = player.y
    this.drainPlayerRunStamina113c(player)
    mover.setRunning(player.run)
    const snap = mover.stepTicks(1)
    player.x = snap.logicalX
    player.y = snap.logicalY
    motion.x = player.x
    motion.y = player.y
    this.maybeSwitchPlayerAreaSeamless(player)
    if (player.areaId === prevMoveAreaId && (player.x !== prevMoveX || player.y !== prevMoveY)) {
      this.syncUnitMoveAcrossViewerAoi113c(
        'player',
        player.unitId,
        prevMoveAreaId,
        prevMoveX,
        prevMoveY,
        player.areaId,
        player.x,
        player.y,
        player.unitId,
      )
    }

    const segmentEnd = snap.currentWaypoint
    if (segmentEnd === null) {
      this.finishPlayerMove(player, motion)
    } else {
      const toX = Math.round(segmentEnd.x)
      const toY = Math.round(segmentEnd.y)
      const velocityPercent = Math.round(
        (mover.getEffectiveSpeedSubTilesPerSec() / D2_BASE_WALK_SUBTILES_PER_SEC) * 100,
      )
      this.broadcastToAreaExcept(player.areaId, player.unitId, {
        type: 'UnitMove',
        unitType: 0,
        id: player.unitId,
        unitId: player.unitId,
        mode: player.run ? 'run' : 'walk',
        from: { x: Math.round(player.x), y: Math.round(player.y) },
        to: { x: toX, y: toY },
        x: Math.round(player.x),
        y: Math.round(player.y),
        currentX: Math.round(player.x),
        currentY: Math.round(player.y),
        targetX: toX,
        targetY: toY,
        velocityPercent,
      })
    }
  }

  if (
    this.hasLivePrimaryCorpse113c(player) &&
    !player.corpseRequiresClick &&
    (player.corpseAreaId ?? player.areaId) === player.areaId
  ) {
    const cDist = Math.hypot(player.x - player.corpseX, player.y - player.corpseY)
    if (
      cDist <= 3 &&
      this.hasInteractionLineOfSight(player.areaId, player.x, player.y, player.corpseX, player.corpseY)
    ) {
      this.recoverPlayerCorpse(player)
    }
  }

  for (const otherPlayer of this.players.values()) {
    if (otherPlayer.unitId === player.unitId) continue
    if (
      otherPlayer.corpseId !== undefined &&
      otherPlayer.corpseItems.length > 0 &&
      (otherPlayer.corpseAreaId ?? otherPlayer.areaId) === player.areaId
    ) {
      const cDist = Math.hypot(player.x - otherPlayer.corpseX, player.y - otherPlayer.corpseY)
      if (
        cDist <= 3 &&
        this.hasInteractionLineOfSight(player.areaId, player.x, player.y, otherPlayer.corpseX, otherPlayer.corpseY)
      ) {
        if (
          canLootPlayerCorpse113c({
            looterUnitId: player.unitId,
            victimUnitId: otherPlayer.unitId,
            looterIsHardcore: isPlayerHardcore113c(player),
            victimIsHardcore: isPlayerHardcore113c(otherPlayer),
            hasLootPermission: this.partyManager.hasLootPermission(otherPlayer.unitId, player.unitId),
          })
        ) {
          this.lootOtherPlayerCorpse(player, otherPlayer)
        }
      }
    }
  }
}



/**
 * Resolve a player skill cast through the canonical 1.13c skill registry (#1328): the `Skills.txt`
 * row, `evaluateSkill113c` numbers (mana cost, 5-band physical/elemental damage with synergies,
 * `delay` cooldown) and the server `Missiles.txt` row named by `srvmissile` / `srvmissilea`.
 * Returns `null` when D2Game refuses the cast (unknown row, passive skill, `InTown = 0` in town,
 * insufficient mana, `delay` cooldown still running).
 */
function resolvePlayerSkillCast(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  skillId: number,
): PlayerSkillCast | null {
  const isTown = [1, 40, 75, 103, 109].includes(player.areaId);
  const skillConfig = this.registry.getSkillById(skillId);
  if (isTown && skillConfig && !skillConfig.inTown) {
      this.emitToPlayer(player.unitId, { type: 'WalkVerify', stamina: player.stamina || 0, x: player.x, y: player.y, vx: 0, vy: 0 });
      return null;
  }
  if (this.registry.getSkillById(0) === undefined) {
    throw new Error(
      'GameInstance: Skills.txt is not loaded in the data registry; player skill casts cannot be resolved',
    )
  }
  if (this.isPlayerWhirlwinding113c(player)) return null
  const skill = this.registry.getSkillById(skillId)
  // Unknown Skills.txt row (malformed client command) or passive skill: D2Game drops the cast.
  if (skill === undefined || skill.passive) return null
  if (!skill.inTown && TOWN_AREAS.has(player.areaId)) return null
  if (this.animActionWindupEnabled && this.isPlayerActionAnimLocked113c(player, skill)) return null
  if (!this.playerMeetsSkillRestrict(player, skill)) return null
  // 1.13c `#264 Cloak of Shadows` (`Skills.txt` `restrict` / `SKILLS_SrvSt64_CloakOfShadows` `0x6FCB3A30`, #1944):
  // Cannot be recast while `STATE_CLOAK_OF_SHADOWS` (`state 153`) is still active on the caster.
  if (
    skillId === 264 &&
    (player.states.has(153) || Boolean(this.playerCombat.get(player.unitId)?.stateBus.hasState(153)))
  ) {
    return null
  }

  // D2Game only casts skills present in the player's skill list: hard points / +skill items on
  // class skills, `item_nonclassskill` oskills, or the universal default skills. Otherwise an
  // equipped `item_charged_skill` (204) with charges left casts it at the charge level.
  const preferredChargeItemId =
    player.rightSkill === skillId &&
    player.rightSkillItemId !== undefined &&
    player.rightSkillItemId !== 0xffffffff
      ? player.rightSkillItemId
      : player.leftSkill === skillId &&
          player.leftSkillItemId !== undefined &&
          player.leftSkillItemId !== 0xffffffff
        ? player.leftSkillItemId
        : undefined
  let slvl = 0
  let chargeItem: ServerItemEntry | undefined
  if (preferredChargeItemId !== undefined) {
    const charged = findChargedSkill(player.items, skill.id, preferredChargeItemId)
    if (charged !== undefined) {
      slvl = charged.slvl
      chargeItem = charged.item
    }
  }
  if (slvl <= 0) {
    slvl = this.resolvePlayerSkillLevel(player, skill)
  }
  if (slvl <= 0) {
    const charged = findChargedSkill(player.items, skill.id)
    if (charged === undefined) return null
    slvl = charged.slvl
    chargeItem = charged.item
  }
  const statList = new UnitStatList(
    this.registry,
    {
      level: player.level,
      strength: player.strength,
      dexterity: player.dexterity,
      vitality: player.vitality,
      energy: player.energy,
      maxhp: this.getPlayerAccruedMaxHpFixed(player),
      hitpoints: player.hpFixed,
      maxmana: this.getPlayerAccruedMaxManaFixed(player),
      mana: player.manaFixed,
      maxstamina: this.getPlayerAccruedMaxStaminaFixed(player),
      stamina: player.staminaFixed,
      tohit: this.computePlayerBaseToHit113c(player),
      item_tohit_percent: this.computePlayerToHitPctBonus113c(player),
      armorclass: this.computePlayerBaseDefense(player),
    },
    { ownerType: 'player', charClass: player.classCode },
  )
  this.syncPlayerSkillLevelsToStatList113c(player, statList, this.playerCombat.get(player.unitId)?.stateBus)
  const blvl = player.skills.get(skillId) ?? 0
  const syncedLvl = statList.getEffectiveSkillLevel(skillId)
  if (syncedLvl !== slvl && (slvl > blvl || syncedLvl > 0)) {
    // Charged casts (`item_charged_skill` 204) run at the charge slvl; hard points still drive synergies.
    statList.setBonusSkillLevel(skillId, statList.getBonusSkillLevel(skillId) + (slvl - syncedLvl))
  }
  const evalResult = evaluateSkill113c({
    registry: this.registry,
    skill,
    slvl,
    blvl,
    statList,
    difficulty: this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0,
    randFn: (lo: number, hi: number) => (lo >= hi ? lo : lo + this.rng.rand(hi - lo + 1)),
  })
  // 1.13c `D2Game.dll` `SKILLS_ApplySkillDelay` (`0x6FCBFF70`, #1877):
  // `STATE_SKILLDELAY` (`state 121`) is a global per-player cooldown shared across ALL `delay > 0`
  // skills (`Blizzard`, `Frozen Orb`, `Meteor`, `Fire Wall`, `Hydra`, `Fist of the Heavens`,
  // `Volcano`, `Molten Boulder`, `Fissure`, `Armageddon`, `Hurricane`, `Valkyrie`, `Shadow Master`, etc.),
  // while `delay == 0` skills (`Teleport`, `Glacial Spike`, `Fire Ball`, `Static Field`, etc.) remain castable.
  if (evalResult.cooldownFrames > 0 && this.isPlayerSkillDelayActive113c(player)) {
    return null
  }
  // 1.13c `D2Common.dll` `SKILLS_CheckSkillMana` (`0x6FDA0AF0` @ `0x6FDA0BEB`) & `D2Game.dll`
  // `SKILLS_CheckSkillMana` (`0x6FCBEC80` @ `0x6FCBECEF`) / `SKILLS_SrvDo116_Wearwolf_Wearbear` (`0x6FC66210`):
  // `nocostinstate = 1` (`Wearwolf` #223 `aurastate = wolf` #139, `Wearbear` #228 `aurastate = bear` #140)
  // waives mana cost when the player is already in `skill.auraState`.
  const isNoCostInState =
    Boolean(skill.noCostInState || skill.nocostinstate) &&
    skill.auraState !== '' &&
    (() => {
      const rec = this.registry.getStateByName(skill.auraState)
      return rec !== undefined && player.states.has(rec.id)
    })()
  // 1.13c `D2Common.dll` `SKILLS_CheckStartMana` (`0x6FD9FDC0`) & `D2Game.dll` `SkillSrvStFunc[11]` (`0x6FC64550`)
  // / `SkillSrvStFunc[26]` (`0x6FCB5BC0`): `startmana > 0` (`Inferno` #41, `Arctic Blast` #230, `Blade Fury` #266)
  // requires `manaFixed >= (startMana << 8)` on initial cast when not already channeling (`STATE_INFERNO = 12`).
  const isChannelingThisSkill =
    player.states.has(12) &&
    (this.playerChannelSkillId.get(player.unitId) === undefined ||
      this.playerChannelSkillId.get(player.unitId) === skill.id)
  if (chargeItem === undefined && !isNoCostInState) {
    if (
      skill.startMana > 0 &&
      !isChannelingThisSkill &&
      player.manaFixed < (skill.startMana << 8)
    ) {
      return null
    }
    const requiredMana256 = evalResult.rawManaCost256 ?? evalResult.manaCost256
    if (player.manaFixed < requiredMana256) {
      if (player.states.has(12)) {
        this.clearPlayerChannelState(player)
      }
      return null
    }
  }

  const equipped = player.items.filter((i) => i.location === 'equipped')
  const right = equipped.find((i) => i.bodyLoc === BODYLOC_RIGHT_ARM)
  const left = equipped.find((i) => i.bodyLoc === BODYLOC_LEFT_ARM)

  // 1.13c `D2Game.dll` `SkillSrvStFunc[4]` (`0x6FC6C4C0`):
  // - `itypea1 = jave` (`#15 Poison Javelin`, `#20 Lightning Bolt`, `#25 Plague Javelin`, `#35 Lightning Fury`):
  //   requires an equipped javelin/spear with `STAT_QUANTITY > 0` when weapons are equipped.
  // - `itypea1 = miss` (`#7 Fire Arrow`, `#11 Cold Arrow`, `#12 Multiple Shot`, `#16 Exploding Arrow`,
  //   `#21 Ice Arrow`, `#22 Guided Arrow`, `#27 Immolation Arrow`, `#31 Freezing Arrow`):
  //   requires an equipped bow/crossbow (`bow | abow | xbow`) when weapons are equipped (#1873).
  if (skill.srvStFunc === 4 && (right !== undefined || left !== undefined)) {
    const reqWeapType = (skill.raw['itypea1'] ?? '').toLowerCase()
    if (reqWeapType === 'jave') {
      const activeJav = right ?? left
      if (activeJav === undefined) return null
      const javBase = resolveWeaponBase113c(activeJav.code)
      if (
        javBase !== undefined &&
        javBase.type !== 'jave' &&
        javBase.type !== 'ajav' &&
        javBase.type !== 'spea' &&
        javBase.type !== 'aspe'
      ) {
        return null
      }
      const qtyStat = collectItemStats(activeJav).find((s) => s.statId === STAT_QUANTITY)
      if (qtyStat !== undefined && qtyStat.value <= 0) return null
    } else if (reqWeapType === 'miss') {
      const activeBow = right ?? left
      if (activeBow === undefined) return null
      const bowBase = resolveWeaponBase113c(activeBow.code)
      if (
        bowBase !== undefined &&
        bowBase.type !== 'bow' &&
        bowBase.type !== 'abow' &&
        bowBase.type !== 'xbow'
      ) {
        return null
      }
    }
  }

  // 1.13c `D2Game.dll` `SKILLS_SrvSt36_HolyShield` (`0x6FCB6EC0`) & `SKILLS_SrvDo150_Smite` (`0x6FD13220`)
  // (`Skills.txt` `itypea1 = shld`, #1800): when the player has equipped gear, Smite (#97) and Holy Shield (#117)
  // require an active equipped shield (synthetic unarmed test rigs with `equipped.length === 0` are permitted).
  if ((skillId === 97 || skillId === 117) && equipped.length > 0 && !this.hasPlayerEquippedShield(player)) {
    return null
  }

  let missile: MissileRecord | undefined
  let offHandMissile: MissileRecord | undefined
  if (skillId === 2 || skillId === 4 || skillId === 140) {
    // D2Game SKILLS_SrvDo003_Throw (0x6FCC2B40), SKILLS_SrvDo005_LeftHandThrow (0x6FCC2A40),
    // SKILLS_SrvDo074_DoubleThrow (0x6FC47E30) + D2Common #10321 (0x6FD72F50):
    // Resolve missile from the hand's equipped weapon Weapons.txt / Misc.txt `missiletype`.
    // When no throwable weapon is equipped (or quantity <= 0), SrvDo003 / SrvDo005 returns 0.
    const resolveHandThrowMissile = (weapon: ServerItemEntry | undefined): MissileRecord | null => {
      if (weapon === undefined) return null
      const missileTypeId = resolveItemMissileTypeId113c(weapon.code)
      if (missileTypeId <= 0) return null
      const qtyStat = collectItemStats(weapon).find((s) => s.statId === STAT_QUANTITY)
      if (qtyStat !== undefined && qtyStat.value <= 0) return null
      const m = this.registry.getMissileById(missileTypeId)
      if (m === undefined) {
        throw new Error(
          `GameInstance: Weapons.txt item "${weapon.code}" references unknown Missiles.txt Id ${missileTypeId}`,
        )
      }
      return m
    }
    if (skillId === 4) {
      const m = resolveHandThrowMissile(left)
      if (m === null) return null
      missile = m
    } else if (skillId === 2) {
      const m = resolveHandThrowMissile(right ?? left)
      if (m === null) return null
      missile = m
    } else {
      // Double Throw (#140): unarmed class-skill sweep is permitted without spawning missiles;
      // when weapons are equipped, resolve right-hand and left-hand throw missiles independently.
      if (right !== undefined || left !== undefined) {
        const rightM = resolveHandThrowMissile(right ?? left)
        if (rightM === null) return null
        missile = rightM
        if (left !== undefined && right !== undefined) {
          const leftM = resolveHandThrowMissile(left)
          if (leftM === null) return null
          offHandMissile = leftM
        }
      }
    }
  } else if (skillId === 0 || skillId === 5) {
    // D2Game SKILLS_SrvDo001_Attack_LeftHandSwing (0x6FCC2C40) + D2Common #10889 (0x6FD94350)
    // + D2Common #10709 (0x6FDA0D40): bow / crossbow basic attack resolves arrow (#0), bolt (#31),
    // magicarrow (#27), explodingarrow (#41), or quiver missiletype (#10321).
    const activeWeapon = skillId === 5 ? (left ?? right) : (right ?? left)
    const offHand = activeWeapon === right ? left : right
    const weaponBase = activeWeapon ? resolveWeaponBase113c(activeWeapon.code) : undefined
    if (
      weaponBase !== undefined &&
      (weaponBase.type === 'bow' || weaponBase.type === 'abow' || weaponBase.type === 'xbow')
    ) {
      const equippedStats = collectEquippedItemStats(player.items)
      const firesMagic = equippedStats.some((s) => s.statId === STAT_ITEM_MAGICARROW && s.value > 0)
      const firesExplosive = equippedStats.some((s) => s.statId === STAT_ITEM_EXPLOSIVEARROW && s.value > 0)
      const offHandMissileId = offHand ? resolveItemMissileTypeId113c(offHand.code) : 0
      const bowMissileId = firesMagic
        ? 27
        : firesExplosive
          ? 41
          : offHandMissileId > 0
            ? offHandMissileId
            : weaponBase.type === 'xbow'
              ? 31
              : 0
      missile = this.registry.getMissileById(bowMissileId)
    }
  } else {
    const activeWeapon = right ?? left
    const weaponBase = activeWeapon ? resolveWeaponBase113c(activeWeapon.code) : undefined
    const missileName =
      (skillId === 12 || skillId === 26) && weaponBase?.type === 'xbow' && skill.srvMissileB !== ''
        ? skill.srvMissileB
        : resolvePlayerServerMissileName(skill, evalResult)
    if (missileName !== '') {
      missile = this.registry.getMissileByName(missileName)
      if (missile === undefined) {
        throw new Error(
          `GameInstance: Skills.txt row ${skillId} (${skill.name}) references unknown Missiles.txt row "${missileName}"`,
        )
      }
    }
  }
  return {
    skill,
    slvl,
    evalResult,
    missile,
    offHandMissile,
    chargeItem,
    statList,
    blvl,
    isNoCostInState,
  }
}



/**
 * Evaluate a `Skills.txt` calc cell (`calc1..calc4`, `DmgSymPerCalc`, ...) for a resolved cast with
 * the same context as `evaluateSkillCore113c` (`lvl` = cast slvl, `blvl`, caster stats). Empty = 0.
 */
function evaluatePlayerSkillCalc(this: GameInstanceHost, cast: PlayerSkillCast, expr: string): number {
  if (expr.trim() === '') return 0
  const statList = cast.statList
  return evaluateCalc(expr, {
    registry: this.registry,
    activeSkill: cast.skill,
    slvl: Math.max(1, cast.slvl),
    blvl: cast.blvl,
    ulvl: statList.getAccruedStat('level'),
    getBaseSkillLevel: (id: number) => statList.getBaseSkillLevel(id),
    getEffectiveSkillLevel: (id: number) => statList.getEffectiveSkillLevel(id),
    getUnitStat: (statNameOrId: string | number, baseOnly?: boolean) => statList.getAccruedStat(statNameOrId, baseOnly),
    randFn: (lo: number, hi: number) => (lo >= hi ? lo : lo + this.rng.rand(hi - lo + 1)),
  })
}



/**
 * Effective level of `skill` in the player's skill list (0 = not castable), clamped to `[0, 99]`
 * (`D2Common.dll` `SKILLS_GetSkillLevel` `0x6FDA05D0` & `0x6FD9FCB0`, #1679, #1680, #1688):
 * - universal default skills (Attack, Kick, Throw, Unsummon, Left Hand Throw/Swing, scroll/book
 *   Identify & Town Portal) are always level 1;
 * - own-class skills with `hardPoints > 0`, `singleSkill > 0`, or `oskill > 0` add `item_allskills` (127),
 *   `item_addclassskills` (83, param = class), `item_addskill_tab` (188, param =
 *   `SkillDesc.SkillPage - 1 + 8 * class`, `skillTabStatParam`), `item_elemskill` (126, param = EType),
 *   `item_singleskill` (107, param = skill) and `min(item_nonclassskill, 3)` (97, param = skill);
 * - other-class / monster rows are only castable through `item_nonclassskill` oskills (uncapped +
 *   `allSkills` + `elemSkills`).
 */
function resolvePlayerSkillLevel(this: GameInstanceHost, player: InternalPlayerRecord, skill: SkillRecord): number {
  if (UNIVERSAL_PLAYER_SKILL_IDS.has(skill.id)) return 1
  const combat = this.playerCombatContext(player)
  const modAllSkills =
    Math.trunc(combat.statList.getModifierBonus('item_allskills')) +
    (player.states.has(134) && !combat.stateBus.hasState(134) ? 2 : 0)
  return this.computePlayerSkillLevel113c(player, skill, modAllSkills, collectEquippedItemStats(player.items))
}



/**
 * Non-recursive core of `resolvePlayerSkillLevel` (`SKILLS_GetSkillLevel` `0x6FDA05D0`): `modAllSkills`
 * carries the state-granted `item_allskills` (Battle Command, Skill Shrine) and `itemStats` the active
 * equipped stats, so `playerCombatContext` can sync every skill without re-entering itself (#1798).
 */
function computePlayerSkillLevel113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  skill: SkillRecord,
  modAllSkills: number,
  itemStats: readonly ItemStat[],
): number {
  if (UNIVERSAL_PLAYER_SKILL_IDS.has(skill.id)) return 1
  const tabParam = this.resolveSkillTabParam(skill)
  let allSkills = modAllSkills
  let classSkills = 0
  let tabSkills = 0
  let elemSkills = 0
  let singleSkill = 0
  let oskill = 0
  const skillEType = (skill.eType ?? '').trim().toLowerCase()
  const elemParamToType: Readonly<Record<number, string>> = {
    0: 'fire',
    1: 'fire',
    2: 'ltng',
    3: 'mag',
    4: 'cold',
    5: 'pois',
  }
  for (const stat of itemStats) {
    if (stat.statId === STAT_ITEM_ALLSKILLS) allSkills += stat.value
    else if (stat.statId === STAT_ITEM_ADDCLASSSKILLS && stat.param === player.classId) classSkills += stat.value
    else if (
      stat.statId === STAT_ITEM_ADDSKILL_TAB &&
      tabParam !== undefined &&
      decodeSkillTabParam(stat.param) !== undefined &&
      stat.param === tabParam
    ) {
      tabSkills += stat.value
    } else if (
      stat.statId === 126 &&
      skillEType !== '' &&
      elemParamToType[stat.param ?? 1] === skillEType
    ) {
      elemSkills += stat.value
    } else if (stat.statId === STAT_ITEM_SINGLESKILL && stat.param === skill.id) singleSkill += stat.value
    else if (stat.statId === STAT_ITEM_NONCLASSSKILL && stat.param === skill.id) oskill += stat.value
  }
  const hardPoints = player.skills.get(skill.id) ?? 0
  if (skill.charClass === player.classCode && (hardPoints > 0 || singleSkill > 0 || oskill > 0)) {
    const cappedOskill = Math.min(oskill, 3)
    return Math.min(
      99,
      Math.max(0, hardPoints + allSkills + classSkills + tabSkills + elemSkills + singleSkill + cappedOskill),
    )
  }
  return oskill > 0 ? Math.min(99, Math.max(0, oskill + allSkills + elemSkills)) : 0
}



/**
 * 1.13c `SKILLS_RefreshPassiveSkills` (`0x6FCBA1A0`) input sync (#1798, #1801..#1804): writes hard points
 * (`blvl`) plus a per-skill bonus so `statList.getEffectiveSkillLevel(id)` equals the exact
 * `SKILLS_GetSkillLevel` result (`+all/+class/+tab/+elem/+single` skills, native `oskill` capped at 3,
 * foreign `oskill` uncapped, Battle Command / Skill Shrine) for every learned or item-granted skill.
 * Passive statlists (Critical Strike, Dodge/Avoid/Evade, Penetrate, Pierce, Masteries, Iron Skin,
 * Increased Speed/Stamina, Natural Resistance, Claw Mastery, Weapon Block) therefore follow `+skills`.
 */
function syncPlayerSkillLevelsToStatList113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  st: UnitStatList,
  stateBus: StateBus | undefined,
): void {
  const itemStats = collectEquippedItemStats(player.items)
  const ids = new Set<number>(player.skills.keys())
  for (const stat of itemStats) {
    if (
      (stat.statId === STAT_ITEM_NONCLASSSKILL || stat.statId === STAT_ITEM_SINGLESKILL) &&
      stat.value > 0 &&
      (stat.param ?? 0) > 0
    ) {
      ids.add(stat.param!)
    }
  }
  const baseLevels = new Map<number, number>()
  for (const [id, lvl] of player.skills) baseLevels.set(id, lvl)
  st.replaceSkillLevels(baseLevels, new Map())
  const modAllSkills =
    Math.trunc(st.getModifierBonus('item_allskills')) +
    (player.states.has(134) && stateBus !== undefined && !stateBus.hasState(134) ? 2 : 0)
  const bonusLevels = new Map<number, number>()
  for (const id of ids) {
    const skill = this.registry.getSkillById(id)
    if (skill === undefined || UNIVERSAL_PLAYER_SKILL_IDS.has(id)) continue
    const eff = this.computePlayerSkillLevel113c(player, skill, modAllSkills, itemStats)
    if (eff <= 0) continue
    const withoutBonus = st.getEffectiveSkillLevel(id)
    if (eff !== withoutBonus) bonusLevels.set(id, eff - withoutBonus)
  }
  st.replaceSkillLevels(baseLevels, bonusLevels)
}



/** Copies gear elemental mastery / pierce stats `329..336` onto a combat stat list (#1801). */
function applyItemMasteryPierceStats113c(this: GameInstanceHost, 
  st: UnitStatList,
  sumStat: (statId: number) => number,
): void {
  for (const [statId, name] of ELEMENTAL_MASTERY_PIERCE_STATS_113C) {
    st.setBaseStat(name, sumStat(statId))
  }
}



/** `ItemTypes.txt` codes of the active right/left hand weapons (`undefined` for shields / empty). */
function resolvePlayerHandWeaponTypes113c(this: GameInstanceHost, player: InternalPlayerRecord): {
  readonly right: string | undefined
  readonly left: string | undefined
} {
  let right: string | undefined
  let left: string | undefined
  for (const item of player.items) {
    if (item.location !== 'equipped') continue
    if (item.bodyLoc === BODYLOC_RIGHT_ARM) right = resolveWeaponBase113c(item.code)?.type
    else if (item.bodyLoc === BODYLOC_LEFT_ARM) left = resolveWeaponBase113c(item.code)?.type
  }
  return { right, left }
}



/**
 * 1.13c item event dispatch (`0x6FD27E48`, handlers `0x6FC89060..0x6FC894F0`, #1797): aggregates the
 * player's active equipped CtC stat `statId` by `(skillId, slvl)`, rolls each entry and casts the
 * successful ones through `executePlayerItemProcSkill113c` (`SKILLS_DoSkill` with `bItemProc = 1`).
 * Swap slots (11/12), unidentified and broken items never proc.
 */
function triggerPlayerCtcProcs113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  statId: CtcStatId113c,
  opts: {
    readonly target?: InternalMonsterRecord | undefined
    readonly tx?: number | undefined
    readonly ty?: number | undefined
  },
): void {
  if (this.playerCtcProcDepth > 0) return
  const stats: ItemStat[] = []
  for (const item of player.items) {
    if (item.location !== 'equipped' || item.bodyLoc === 11 || item.bodyLoc === 12) continue
    if (item.identified === false || item.rawItemData?.identified === false) continue
    const broken =
      item.rawItemData?.broken === true ||
      (item.maxDurability > 0 && item.durability <= 0 && (item.stats.get(152) ?? 0) <= 0)
    if (broken) continue
    for (const st of collectItemStats(item)) {
      if (st.statId === statId) stats.push(st)
    }
  }
  if (stats.length === 0) return
  const fired = rollCtcProcs113c(aggregateCtcProcs113c(stats, statId), () => this.rng.rand(100))
  if (fired.length === 0) return
  this.playerCtcProcDepth += 1
  try {
    for (const proc of fired) {
      this.executePlayerItemProcSkill113c(player, proc.skillId, proc.slvl, statId, opts)
    }
  } finally {
    this.playerCtcProcDepth -= 1
  }
}



/**
 * `SKILLS_DoSkill` with `bItemProc = 1` (`0x6FCC1A50` / `0x6FCC1B0D`): casts `skillId` at the item `slvl`
 * with 0 mana and no `delay`, evaluated with the caster's hard points (`blvl`) so synergies, Sorceress
 * masteries and gear `329..336` apply. Curses land around the target, novas expand around the event point
 * (target for attack/hit/kill, player for get-hit/on-skill/level-up/death), buffs go on the player,
 * missiles fly from the player toward the target.
 */
function executePlayerItemProcSkill113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  skillId: number,
  slvl: number,
  statId: CtcStatId113c,
  opts: {
    readonly target?: InternalMonsterRecord | undefined
    readonly tx?: number | undefined
    readonly ty?: number | undefined
  },
): void {
  const skill = this.registry.getSkillById(skillId)
  if (skill === undefined || skill.passive) return
  const combat = this.playerCombatContext(player)
  const statList = new UnitStatList(
    this.registry,
    {
      level: player.level,
      strength: player.strength,
      dexterity: player.dexterity,
      vitality: player.vitality,
      energy: player.energy,
    },
    { ownerType: 'player', charClass: player.classCode },
  )
  this.syncPlayerSkillLevelsToStatList113c(player, statList, combat.stateBus)
  this.applyItemMasteryPierceStats113c(statList, (sid) => this.sumPlayerItemStat(player, sid))
  const blvl = player.skills.get(skillId) ?? 0
  statList.setBonusSkillLevel(
    skillId,
    statList.getBonusSkillLevel(skillId) + (slvl - statList.getEffectiveSkillLevel(skillId)),
  )
  const evalResult = evaluateSkill113c({
    registry: this.registry,
    skill,
    slvl,
    blvl,
    statList,
    difficulty: this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0,
    randFn: (lo: number, hi: number) => (lo >= hi ? lo : lo + this.rng.rand(hi - lo + 1)),
  })
  const missileName = resolvePlayerServerMissileName(skill, evalResult)
  const missile = missileName !== '' ? this.registry.getMissileByName(missileName) : undefined
  const cast: PlayerSkillCast = { skill, slvl, evalResult, missile, statList, blvl }
  const target = opts.target !== undefined && !opts.target.dead ? opts.target : undefined
  let fallbackTarget: InternalMonsterRecord | undefined
  if (target === undefined && opts.tx === undefined) {
    let bestDist = 25
    for (const m of this.monsters.values()) {
      if (m.dead || m.isNpc || !m.isKillable || m.submerged || m.areaId !== player.areaId) continue
      if (m.align !== 0 || this.isMonsterConverted(m)) continue
      const d = Math.hypot(m.x - player.x, m.y - player.y)
      if (d <= bestDist) {
        bestDist = d
        fallbackTarget = m
      }
    }
  }
  const aimTarget = target ?? fallbackTarget
  const aroundPlayer = statId === 201 || statId === 200 || statId === 199 || statId === 197
  const originX = aroundPlayer ? player.x : (opts.target?.x ?? opts.tx ?? aimTarget?.x ?? player.x)
  const originY = aroundPlayer ? player.y : (opts.target?.y ?? opts.ty ?? aimTarget?.y ?? player.y)
  const tx = aimTarget?.x ?? opts.tx ?? player.x
  const ty = aimTarget?.y ?? opts.ty ?? player.y
  if (skill.summon !== '' || skill.petType !== '') {
    this.applyPlayerSkillEffect(player, cast, originX, originY, target)
    return
  }
  if (skill.auraTgtState !== '' && skill.srvDoFunc !== 68 && skillId !== 130) {
    this.applyPlayerSkillEffect(player, cast, tx, ty, aimTarget)
    return
  }
  if (
    skill.auraState !== '' &&
    skill.srvDoFunc !== 68 &&
    (skill.srcDam <= 0 || skill.id === 277) &&
    skill.srvDoFunc !== SRVDOFUNC_WHIRLWIND
  ) {
    // Self-buff CtC procs (Fortitude #60 Chilling Armor, Treachery #267 Fade / #278 Venom,
    // Lava Gout / Obedience #52 Enchant `ItemTarget = 1` self, Bone/Cyclone Armor, Delirium #350).
    this.applyPlayerSkillEffect(player, cast, player.x, player.y, undefined)
    return
  }
  if (skillId === SKILL_TELEPORT) {
    // 1.13c `Skills.txt` #54 Teleport `ItemTarget = 2` (The Oculus random destination around caster).
    let destX = Math.round(player.x)
    let destY = Math.round(player.y)
    for (let attempt = 0; attempt < 8; attempt++) {
      const dx = this.rng.rand(21) - 10
      const dy = this.rng.rand(21) - 10
      if (dx === 0 && dy === 0) continue
      const cx = Math.max(1, Math.round(player.x) + dx)
      const cy = Math.max(1, Math.round(player.y) + dy)
      if (!this.terrainWalkableCheck || this.isWorldWalkableForPlayer(player.areaId, cx, cy)) {
        destX = cx
        destY = cy
        break
      }
    }
    this.relocatePlayerForSkill(player, destX, destY, true, true)
    return
  }
  if (skill.srvDoFunc === SRVDOFUNC_MIND_BLAST) {
    this.executeMindBlast(player, cast, tx, ty)
    return
  }
  if (skillId === 42) {
    this.applyStaticField(player, cast)
    return
  }
  if (isCtcRadialNovaSkill113c(skillId)) {
    const radius = Math.max(6, evalResult.radiusSubtiles > 0 ? evalResult.radiusSubtiles : 9)
    const channel = normalizeMissileElement(skill.eType) ?? 'mag'
    for (const m of [...this.monsters.values()]) {
      if (m.dead || m.isNpc || !m.isKillable || m.submerged || m.areaId !== player.areaId) continue
      if (m.align !== 0 || this.isMonsterConverted(m)) continue
      if (Math.hypot(m.x - originX, m.y - originY) > radius) continue
      if (evalResult.elemType === 'pois' && evalResult.durationFrames > 0) {
        const bitrate256 = this.rollInclusive(evalResult.minElemDmg256, evalResult.maxElemDmg256)
        if (bitrate256 > 0) {
          this.applyMonsterPoisonDot(player, m, bitrate256, evalResult.durationFrames, skillId)
        }
        continue
      }
      const dmg = this.rollInclusive(evalResult.minElemDmg, evalResult.maxElemDmg)
      if (dmg <= 0) continue
      this.applyDamageToMonster(player, m, dmg, skillId, channel, 'player', {
        attackKind: 'spell',
        autoHit: true,
        unblockable: true,
        elemDurationFrames: evalResult.durationFrames || undefined,
      })
    }
    return
  }
  if (missile !== undefined) {
    const missileTx = tx === player.x && ty === player.y ? player.x + 1 : tx
    this.launchPlayerSkillMissiles(player, cast, missile, missileTx, ty, aimTarget)
    return
  }
  if (aimTarget !== undefined) {
    const dmg = this.rollPlayerSkillDamage(player, cast)
    if (dmg > 0) {
      this.applyDamageToMonster(player, aimTarget, dmg, skillId, normalizeMissileElement(skill.eType) ?? undefined, 'player', {
        attackKind: 'spell',
        autoHit: true,
        unblockable: true,
        elemDurationFrames: evalResult.durationFrames || undefined,
      })
    }
  }
}



/**
 * 1.13c `D2Game.dll` `C2S 0x3C SelectSkill` (`0x6fcef480` -> `SKILLS_AssignSkill` `0x6fcc2100`):
 * Validates that `skillId` is a valid, non-passive skill that the player currently knows
 * (`resolvePlayerSkillLevel > 0`) or has charges for (`findChargedSkill !== undefined`), and is
 * usable on the requested hand (`hand !== 'left' || !skill.aura`).
 */
function isPlayerSkillSelectable(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  skillId: number,
  hand: 'left' | 'right',
  itemId?: number,
): boolean {
  if (this.isPlayerWhirlwinding113c(player)) return false
  if (!Number.isInteger(skillId) || skillId < 0) return false
  if (skillId === 0) return true
  const skill = this.registry.getSkillById(skillId)
  if (skill === undefined || skill.passive || skill.id === 5) return false
  if (hand === 'left' && skill.aura) return false
  if (itemId !== undefined && itemId !== 0xffffffff) {
    return findChargedSkill(player.items, skill.id, itemId) !== undefined
  }
  if (this.resolvePlayerSkillLevel(player, skill) > 0) return true
  return findChargedSkill(player.items, skill.id) !== undefined
}



/**
 * 1.13c `D2Game.dll` `0x6fcf1ed0`:
 * Re-validates the player's currently selected `leftSkill` and `rightSkill` after equipment
 * changes (`handleItemEquip` / `handleItemUnequip`). Resets any invalidated hand to `0` (`Attack`)
 * and emits `ActiveSkill` (`S2C 0x23`).
 */
function validatePlayerActiveSkills(this: GameInstanceHost, player: InternalPlayerRecord): void {
  if (
    player.leftSkill !== 0 &&
    !this.isPlayerSkillSelectable(player, player.leftSkill, 'left', player.leftSkillItemId)
  ) {
    player.leftSkill = 0
    player.leftSkillItemId = 0xffffffff
    this.emitToPlayer(player.unitId, {
      type: 'ActiveSkill',
      unitId: player.unitId,
      hand: 'left',
      skill: 0,
      itemId: 0xffffffff,
    })
  }
  if (
    player.rightSkill !== 0 &&
    !this.isPlayerSkillSelectable(player, player.rightSkill, 'right', player.rightSkillItemId)
  ) {
    player.rightSkill = 0
    player.rightSkillItemId = 0xffffffff
    this.stopPlayerAura(player)
    this.emitToPlayer(player.unitId, {
      type: 'ActiveSkill',
      unitId: player.unitId,
      hand: 'right',
      skill: 0,
      itemId: 0xffffffff,
    })
  }
}



/**
 * 1.13c `SCMD_SelectSkill` (`0x3C`) -> `SKILLS_SetRightSkill` -> `SKILLS_ActivateAura` (`0x6FCCDB30`):
 * Selecting a Paladin aura on the right-hand slot immediately activates its `AuraScanner` and caster
 * `aurastate` (even in town or at 0 mana); selecting any non-aura right-hand skill stops the active aura.
 */
function syncPlayerSelectedRightAura113c(this: GameInstanceHost, player: InternalPlayerRecord): void {
  if (player.dead) {
    this.stopPlayerAura(player)
    return
  }
  const skillId = player.rightSkill
  const skill = skillId > 0 ? this.registry.getSkillById(skillId) : undefined
  if (skill === undefined || !skill.aura || skill.auraState === '' || skill.passive) {
    this.stopPlayerAura(player)
    return
  }
  let slvl = this.resolvePlayerSkillLevel(player, skill)
  let chargeItem: ServerItemEntry | undefined
  if (slvl <= 0) {
    const charged = findChargedSkill(player.items, skill.id, player.rightSkillItemId)
    if (charged === undefined) {
      this.stopPlayerAura(player)
      return
    }
    slvl = charged.slvl
    chargeItem = charged.item
  }
  const statList = new UnitStatList(
    this.registry,
    {
      level: player.level,
      strength: player.strength,
      dexterity: player.dexterity,
      vitality: player.vitality,
      energy: player.energy,
      maxhp: this.getPlayerAccruedMaxHpFixed(player),
      hitpoints: player.hpFixed,
      maxmana: this.getPlayerAccruedMaxManaFixed(player),
      mana: player.manaFixed,
      maxstamina: this.getPlayerAccruedMaxStaminaFixed(player),
      stamina: player.staminaFixed,
      tohit: this.computePlayerBaseToHit113c(player),
      item_tohit_percent: this.computePlayerToHitPctBonus113c(player),
      armorclass: this.computePlayerBaseDefense(player),
    },
    { ownerType: 'player', charClass: player.classCode },
  )
  this.syncPlayerSkillLevelsToStatList113c(player, statList, this.playerCombat.get(player.unitId)?.stateBus)
  const blvl = player.skills.get(skillId) ?? 0
  const syncedLvl = statList.getEffectiveSkillLevel(skillId)
  if (syncedLvl !== slvl && (slvl > blvl || syncedLvl > 0)) {
    // Charged casts (`item_charged_skill` 204) run at the charge slvl; hard points still drive synergies.
    statList.setBonusSkillLevel(skillId, statList.getBonusSkillLevel(skillId) + (slvl - syncedLvl))
  }
  const evalResult = evaluateSkill113c({
    registry: this.registry,
    skill,
    slvl,
    blvl,
    statList,
    difficulty: this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0,
    randFn: (lo: number, hi: number) => (lo >= hi ? lo : lo + this.rng.rand(hi - lo + 1)),
  })
  this.applyPlayerSkillEffect(
    player,
    {
      skill,
      slvl,
      evalResult,
      missile: undefined,
      chargeItem,
      statList,
      blvl,
    },
    player.x,
    player.y,
    undefined,
  )
}

export interface FrameAndCommandsMethods {
  stepFrame(): Map<number, readonly ServerEvent[]>
  stepFrames(count: number): void
  isPlayerInBlockRecovery(player: InternalPlayerRecord): boolean
  isPlayerInHitRecovery(player: InternalPlayerRecord): boolean
  processPlayerCommand(player: InternalPlayerRecord, cmd: ClientCommand): void
  stepPlayerMovement(player: InternalPlayerRecord): void
  resolvePlayerSkillCast(player: InternalPlayerRecord, skillId: number): PlayerSkillCast | null
  evaluatePlayerSkillCalc(cast: PlayerSkillCast, expr: string): number
  resolvePlayerSkillLevel(player: InternalPlayerRecord, skill: SkillRecord): number
  computePlayerSkillLevel113c(player: InternalPlayerRecord, skill: SkillRecord, modAllSkills: number, itemStats: readonly ItemStat[]): number
  syncPlayerSkillLevelsToStatList113c(player: InternalPlayerRecord, st: UnitStatList, stateBus: StateBus | undefined): void
  applyItemMasteryPierceStats113c(st: UnitStatList, sumStat: (statId: number) => number): void
  resolvePlayerHandWeaponTypes113c(player: InternalPlayerRecord): {
  readonly right: string | undefined
  readonly left: string | undefined
}
  triggerPlayerCtcProcs113c(player: InternalPlayerRecord, statId: CtcStatId113c, opts: {
    readonly target?: InternalMonsterRecord | undefined
    readonly tx?: number | undefined
    readonly ty?: number | undefined
  }): void
  executePlayerItemProcSkill113c(player: InternalPlayerRecord, skillId: number, slvl: number, statId: CtcStatId113c, opts: {
    readonly target?: InternalMonsterRecord | undefined
    readonly tx?: number | undefined
    readonly ty?: number | undefined
  }): void
  isPlayerSkillSelectable(player: InternalPlayerRecord, skillId: number, hand: 'left' | 'right', itemId?: number): boolean
  validatePlayerActiveSkills(player: InternalPlayerRecord): void
  syncPlayerSelectedRightAura113c(player: InternalPlayerRecord): void
}

export const frameAndCommandsMethods: Record<keyof FrameAndCommandsMethods, unknown> = {
  stepFrame,
  stepFrames,
  isPlayerInBlockRecovery,
  isPlayerInHitRecovery,
  processPlayerCommand,
  stepPlayerMovement,
  resolvePlayerSkillCast,
  evaluatePlayerSkillCalc,
  resolvePlayerSkillLevel,
  computePlayerSkillLevel113c,
  syncPlayerSkillLevelsToStatList113c,
  applyItemMasteryPierceStats113c,
  resolvePlayerHandWeaponTypes113c,
  triggerPlayerCtcProcs113c,
  executePlayerItemProcSkill113c,
  isPlayerSkillSelectable,
  validatePlayerActiveSkills,
  syncPlayerSelectedRightAura113c,
}


/** AI step of one monster plus the pending action resolution that follows it in the monster loop. */
function stepMonsterAiAndPending113c(host: GameInstanceHost, monster: InternalMonsterRecord): void {
  if (
    !monster.aiDisabled &&
    !monster.isNpc &&
    monster.aiAwake !== false &&
    (host.drlgRoomPopulator !== null || host.isMonsterInActiveAoi(monster))
  ) {
    const monPrevArea = monster.areaId
    const monPrevX = monster.x
    const monPrevY = monster.y
    host.stepMonsterAi(monster)
    if (host.drlgRoomPopulator === null) {
      host.areaPathWorld.syncMonsterPosition(monster.areaId, monster.unitId, monster.x, monster.y, monster.mode)
    }
    if (monster.areaId !== monPrevArea || monster.x !== monPrevX || monster.y !== monPrevY) {
      host.syncUnitMoveAcrossViewerAoi113c(
        'monster',
        monster.unitId,
        monPrevArea,
        monPrevX,
        monPrevY,
        monster.areaId,
        monster.x,
        monster.y,
      )
    }
  }
  host.stepPendingMonsterAttack(monster)
  host.stepPendingAllyAttack(monster)
  host.stepPendingResurrection(monster)
}

const monsterEventSeqByHost113c = new WeakMap<object, number>()
function nextMonsterEventSeq113c(host: object): number {
  const next = (monsterEventSeqByHost113c.get(host) ?? 0) + 1
  monsterEventSeqByHost113c.set(host, next)
  return next
}

/**
 * Event sequence numbers that stand in for the 1.13c wheel insertion order: a monster's AI event
 * (`nextAiFrame`), its mode end (`actionAnimEndFrame`) and its death end (`deathAnimEndFrame`) get a new
 * sequence number whenever their frame changes, in the order the replica schedules them.
 */
function refreshMonsterEventSeq113c(host: GameInstanceHost, monster: InternalMonsterRecord): void {
  const seq = monster.eventSeq113c ?? (monster.eventSeq113c = { ai: 0, act: 0, death: 0, seenAi: NaN, seenAct: NaN, seenDeath: NaN })
  if (monster.nextAiFrame !== seq.seenAi) {
    seq.seenAi = monster.nextAiFrame
    seq.ai = nextMonsterEventSeq113c(host)
  }
  const act = monster.actionAnimEndFrame ?? 0
  if (act !== seq.seenAct) {
    seq.seenAct = act
    seq.act = nextMonsterEventSeq113c(host)
  }
  const death = monster.deathAnimEndFrame ?? 0
  if (death !== seq.seenDeath) {
    seq.seenDeath = death
    seq.death = nextMonsterEventSeq113c(host)
  }
}

/**
 * DRLG oracle path, monster partition of `EVENT_UpdateTimers` (`0x6FCAEBC0`, oracle order log a1c F760..F840):
 * 1. persistent mode updates of moving monsters (WL / RN), newest move registration first (LIFO);
 * 2. the frame's slot events in scheduling order (FIFO): AI thinks, mode ends (attack end, DT -> DD).
 * Monsters with nothing due are stepped afterwards in unit-id order (per-frame counters only).
 */
function runDrlgMonsterEventPhase113c(host: GameInstanceHost, deferred: readonly InternalMonsterRecord[]): void {
  const frame = host.currentFrame
  const moving = deferred.filter((m) => m.mode === 2 || m.mode === 15)
  moving.sort(
    (a, b) => host.areaPathWorld.getMonsterMoveSeq113c(b.unitId) - host.areaPathWorld.getMonsterMoveSeq113c(a.unitId),
  )
  const done = new Set<InternalMonsterRecord>()
  for (const m of moving) {
    done.add(m)
    stepMonsterAiAndPending113c(host, m)
    refreshMonsterEventSeq113c(host, m)
  }
  type Due = { readonly seq: number; readonly monster: InternalMonsterRecord; readonly kind: 'step' | 'death' }
  const due: Due[] = []
  for (const m of deferred) {
    if (done.has(m)) continue
    const seq = m.eventSeq113c
    const aiDue = m.nextAiFrame <= frame
    const actDue = (m.actionAnimEndFrame ?? 0) > 0 && frame >= (m.actionAnimEndFrame ?? 0)
    if (seq !== undefined && (aiDue || actDue)) {
      due.push({ seq: actDue ? seq.act : seq.ai, monster: m, kind: 'step' })
    }
  }
  for (const m of host.monsters.values()) {
    if (m.dead && m.mode === 0 && (m.deathAnimEndFrame ?? 0) > 0 && frame >= (m.deathAnimEndFrame ?? 0)) {
      due.push({ seq: m.eventSeq113c?.death ?? 0, monster: m, kind: 'death' })
    }
  }
  due.sort((a, b) => a.seq - b.seq)
  for (const d of due) {
    if (d.kind === 'death') {
      d.monster.deathAnimEndFrame = 0
      d.monster.mode = 12
      refreshMonsterEventSeq113c(host, d.monster)
      continue
    }
    if (done.has(d.monster)) continue
    done.add(d.monster)
    stepMonsterAiAndPending113c(host, d.monster)
    refreshMonsterEventSeq113c(host, d.monster)
  }
  for (const m of deferred) {
    if (done.has(m)) continue
    stepMonsterAiAndPending113c(host, m)
    refreshMonsterEventSeq113c(host, m)
  }
}

