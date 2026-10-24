/**
 * ServerEvent State Machine Dispatcher & Outgoing Command Applier (`src/client/world/world-event-applier.ts`).
 */

import {
  ClickButtonId,
  unitTypeFromId,
  type CharClassId,
  type ClientCommand,
  type ItemData,
  type NpcCommandPayload113c,
  type ServerEvent,
  type SkillLevel,
  type UnitRef,
  type UnitType,
  type UnitTypeId,
} from '../../netproto/index.ts'
import { resolveUnitMonSoundRow113c } from '../../common/audio/mon-sounds-113c.ts'
import { getSoundIdByName113c } from '../../common/audio/sounds-113c.ts'
import {
  CHAT_LINE_TTL_MS,
  MESSAGE_LOG_MAX_ENTRIES,
  OVERHEAD_SPEECH_TTL_MS,
  formatChatPacket0x26,
  formatEventPacket0x5A,
} from '../../common/chat/chat-113c.ts'
import { BAKED_UI_MANIFEST } from '../../common/items/baked-ui-meta.ts'
import {
  imbueItemData113c,
  isEligibleForCharsiImbue113c,
  onlineItemDataToUiInventoryItem,
  type CharsiImbueOptions,
} from '../../common/items/item-bridge.ts'
import {
  D2COMMON_10160_PathUpdateDirection,
  D2COMMON_10212_PATH_SetMoveFlags,
  D2Common_10153,
  MONMODE_DEAD,
  MONMODE_DEATH,
  MONMODE_GETHIT,
  MONMODE_KNOCKBACK,
  MONMODE_NEUTRAL,
  MONMODE_RUN,
  MONMODE_WALK,
  PATHTYPE_KNOCKBACK_CLIENT,
  PATHTYPE_TOWARD,
  PATH_GetXPosition,
  PATH_GetYPosition,
  UNITFLAG_DOUPDATE,
  type DynamicPath,
} from '../../common/path/index.ts'
import { MISSILE_CLASS_ID_TO_KEY } from '../../common/skills/missiles-data.ts'
import { isSkillAllowedInTown } from '../../common/skills/skills-meta.ts'
import {
  computeEffectiveFhr,
  computeOneShotDurationMs,
} from '../../common/units/char-anim-speed.ts'
import { resolveHirelingName } from '../../common/units/hireling-table.ts'
import {
  MON_UMOD,
  hasMonsterUMod,
  resolveMonsterUModIds,
} from '../../common/units/monster-death-fx.ts'
import { MONSTER_HCIDX_SIZEX } from '../../common/units/monster-mapping.ts'
import { isTownNpcHcIdx } from '../../common/units/npc-table.ts'
import { CANONICAL_113C_OBJECTS, getNpcPlaceholderHcIdx } from '../../common/world/objects-meta.ts'
import { getObjectsTxtRecord113c } from '../../common/world/objects-txt-113c.ts'
import { isTownLevel } from '../../common/world/scene-population.ts'
import {
  PLAYER_SOUND_TABLE_0x6FBA7694,
  resolve0x2CPlaySound113c,
  resolveBlockSoundId113c,
  resolveHitClassSoundIds113c,
} from '../audio/d2gs-play-sound-113c.ts'
import { STATE_OVERLAYS, STATE_PGSV_OVERLAYS } from '../render/overlays-meta.ts'
import { computeEffectiveMercenaryStats } from '../ui-model/derived-stats.ts'
import { resolveGroundItemFlippyKey } from '../ui/inventory.ts'
import type { ClientWorld } from './client-world.ts'
import { unitSkillEventForcesLightning113c } from '../weather/weather-controller.ts'
import {
  STATE_BONEARMOR,
  clearBoneArmorOverlays113c,
  syncBoneArmorOverlays113c,
} from './bone-armor-overlays-113c.ts'
import { ClientUnit, makeUnitKey } from './client-unit.ts'
import { objectLitForMode, resetObjectAnim, setObjectLight } from './object-light.ts'
import { updateObjectModeSound113c } from './object-sound-113c.ts'
import { HORADRIC_ORIFICE_OBJECT_CLASS } from './quest-fx-horadric-113c.ts'
import {
  playStateCastOverlay113c,
  playStateRemOverlay113c,
  removeStateCastOverlay113c,
} from './state-cast-overlay-113c.ts'
import { releasePredictedState113c } from './state-ids-113c.ts'
import { stateOffSoundRequest113c, stateOnSoundRequest113c } from './state-on-sound-113c.ts'
import { isMonsterUndead113c, SANCTUARY_AURA_113C } from './world-missile-stepper.ts'
import { addLocalSystemMessageImpl } from './world-chat-social.ts'
import { ensureBladeShieldAttachment113c } from './world-skill-missiles.ts'
import {
  ALL_PALADIN_AURA_STATES,
  BUTTON_ACTION_CLOSE_STASH,
  BUTTON_ACTION_OPEN_CUBE,
  BUTTON_ACTION_OPEN_STASH,
  MAX_D2_STAT_ID,
  PALADIN_AURA_SKILL_STATES,
  isMonsterOneShotMode,
  type ChatLogEntry,
  type ClientWorldInternal,
  type PartyMemberState,
} from './world-skill-state-tables.ts'

/** D2Common `IFLAG_BROKEN` (D2Items.h); toggled by S2C 0x7D (D2Client.dll 0x6fb34df0). */
const ITEM_FLAG_BROKEN = 0x00000100
const RED_TEXT = 1
const ARTISAN_REFUSALS: Readonly<Record<number, string>> = { 154: "Charsi can't imbue that item.", 511: "Larzuk can't add sockets to that item.", 512: "Anya can't personalize that item." }
/** D2Common `IFLAG_REPAIRED` (D2Items.h); S2C 0x7D with this flag clears IFLAG_BROKEN. */
const ITEM_FLAG_REPAIRED = 0x00000200

function normalizeMonsterHpStatValue(v: number | undefined): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined
  return v > 4096 ? Math.floor(v / 256) : Math.floor(v)
}

function syncMercStat6FromLifePct(
  world: ClientWorldInternal,
  mercUnit: ClientUnit | undefined,
  pct: number,
  scale: 100 | 128,
): void {
  const merc = world._merc
  if (!merc) return
  const hasMercStat6 = merc.stats.has(6)
  const hasUnitStat6 = mercUnit ? mercUnit.stats.has(6) : false
  if (!hasMercStat6 && !hasUnitStat6) return
  if (pct <= 0) {
    merc.stats.delete(6)
    mercUnit?.stats.delete(6)
    return
  }
  const rawHp = normalizeMonsterHpStatValue(merc.stats.get(6) ?? mercUnit?.stats.get(6))
  const rawMaxHp =
    normalizeMonsterHpStatValue(merc.stats.get(7) ?? mercUnit?.stats.get(7)) ??
    computeEffectiveMercenaryStats(world as unknown as ClientWorld)?.maxHp
  if (
    rawHp !== undefined &&
    rawMaxHp !== undefined &&
    rawMaxHp > 0 &&
    Math.min(scale, Math.max(1, Math.round((rawHp * scale) / rawMaxHp))) === Math.round(pct)
  ) {
    return
  }
  merc.stats.delete(6)
  mercUnit?.stats.delete(6)
}

/**
 * 1.13c `D2Client.dll` (`0x6facbfd5..0x6facbfee`, `0x6fac9d80`) & `D2Game.dll` (`0x6fc9865e..0x6fc98684`):
 * Returns `true` when the local player's stamina stat has been initialized and `stamina <= 0`.
 */
function isSelfStaminaExhausted(world: ClientWorldInternal): boolean {
  const self = world._self
  const hasStaminaInitialized =
    self.maxStamina > 0 || self.stats.has(10) || self.stats.has(11)
  return hasStaminaInitialized && self.stamina <= 0
}

/**
 * 1.13c `D2Client.dll` `0x6facc50c -> 0x6fac9d80` (`Player_CheckRunStaminaExhausted`):
 * When the local player is in `PLRMODE_RUN (3)` and `STAT_STAMINA (10) == 0`, immediately
 * transitions the local player into walk mode (`PLRMODE_WALK = 2` or `PLRMODE_TWALK = 6` in town).
 */
const PLAYER_DEATH_MODES = new Set([0, 17])

function clearZeroLifeDeathInTown(world: ClientWorldInternal): void {
  const mode = world.getUnit('player', world.selfId)?.mode
  if (world._self.isDead && isTownLevel(world.areaId) && (mode === undefined || !PLAYER_DEATH_MODES.has(mode))) [world._self.isDead, world._isSelfDead] = [false, false]
}

function downgradeSelfRunOnStaminaExhausted(world: ClientWorldInternal): void {
  if (!isSelfStaminaExhausted(world)) return
  const walkMode = isTownLevel(world.areaId) ? 6 : 2
  const resolvedSelfId = world.selfId || (world.getUnit('player', 1) ? 1 : 0)
  if (resolvedSelfId !== 0) {
    const selfUnit = world.getUnit('player', resolvedSelfId)
    if (selfUnit && !selfUnit.dead) {
      if (selfUnit.moveMode === 'run') {
        selfUnit.moveMode = 'walk'
      }
      if (selfUnit.mode === 3) {
        selfUnit.mode = walkMode
        const speedInfo = world.resolvePlayerAnimSpeed(walkMode, selfUnit.id)
        selfUnit.modeDurationMs = undefined
        selfUnit.modeUntilMs = undefined
        selfUnit.animStepSpeed256 = speedInfo.stepSpeed256
        selfUnit.animEffRate = speedInfo.effRate
        world._selfLocomotionAnimSpeed256 = speedInfo.stepSpeed256
      }
    }
  }
  if (!world._self.isDead && world._self.mode === 3) {
    world._self.mode = walkMode
  }
}

export function noteOutgoingCommandImpl(
  this: ClientWorldInternal,
  cmd: ClientCommand,
  nowMs?: number,
  selfXOverride?: number,
  selfYOverride?: number,
): void {
  if (cmd && typeof cmd === 'object') {
    if (this._notedCommands.has(cmd)) return
    this._notedCommands.add(cmd)
  }
  const cur = this._npcInteraction
  switch (cmd.type) {
    case 'NpcInit': {
      this._pendingMeleeAttack = null
      this._awaitingArtisanConfirmNpcId = null
      if (cur.npcId !== null && cur.npcId !== cmd.target.id) {
        this.npcMotion.setNpcInteractionLock(cur.npcId, false)
      }
      this.npcMotion.setNpcInteractionLock(cmd.target.id, true)
      const perNpcInfo = this._npcInfoByUnitId.get(cmd.target.id)
      const sameNpcInfo = cur.infoNpcId === cmd.target.id || cur.npcId === cmd.target.id
      this._npcInteraction = {
        ...cur,
        npcId: cmd.target.id,
        infoNpcId: perNpcInfo ? cmd.target.id : sameNpcInfo ? cur.infoNpcId : undefined,
        window: 'none',
        activeWindow: 'none',
        npcInfoRaw: perNpcInfo?.npcInfoRaw ?? (sameNpcInfo ? cur.npcInfoRaw : undefined),
        messages: perNpcInfo?.messages ?? (sameNpcInfo ? cur.messages : undefined),
        allMessages: perNpcInfo?.allMessages ?? (sameNpcInfo ? cur.allMessages : undefined),
        hadWantsInteract:
          this.getUnit(cmd.target.unitType ?? 'monster', cmd.target.id)?.wantsInteract === true ||
          this.getUnit('monster', cmd.target.id)?.wantsInteract === true ||
          this._pendingWantsInteractUnitIds.has(cmd.target.id)
            ? true
            : undefined,
      }
      this._pendingWantsInteractUnitIds.delete(cmd.target.id)
      const targetUnitType = cmd.target.unitType ?? (cmd.target as any).kind ?? 'monster'
      const targetUnit = this.getUnit(targetUnitType, cmd.target.id) ?? this.getUnit('monster', cmd.target.id)
      if (targetUnit) {
        targetUnit.wantsInteract = false
      }
      const resolvedSelfId = this.selfId || (this.getUnit('player', 1) ? 1 : 0)
      if (resolvedSelfId !== 0) {
        if (targetUnit) {
          const selfUnit = this.ensureUnit('player', resolvedSelfId)
          selfUnit.targetUnit = cmd.target
          selfUnit.faceToward(targetUnit.x, targetUnit.y, false)
        }
      }
      break
    }
    case 'Interact': {
      this._pendingMeleeAttack = null
      this._pendingWantsInteractUnitIds.delete(cmd.target.id)
      const targetUnit = this.getUnit(cmd.target.unitType, cmd.target.id)
      if (targetUnit) {
        targetUnit.wantsInteract = false
      }
      const resolvedSelfId = this.selfId || (this.getUnit('player', 1) ? 1 : 0)
      if (resolvedSelfId !== 0) {
        if (targetUnit) {
          const selfUnit = this.ensureUnit('player', resolvedSelfId)
          selfUnit.targetUnit = cmd.target
          selfUnit.faceToward(targetUnit.x, targetUnit.y, false)
        }
      }
      break
    }
    case 'OperateObject': {
      this._pendingMeleeAttack = null
      const resolvedSelfId = this.selfId || (this.getUnit('player', 1) ? 1 : 0)
      if (resolvedSelfId !== 0) {
        const targetUnit = this.getUnit('object', cmd.objectId)
        if (targetUnit) {
          const selfUnit = this.ensureUnit('player', resolvedSelfId)
          selfUnit.faceToward(targetUnit.x, targetUnit.y, false)
        }
      }
      break
    }
    case 'TakeWarp':
    case 'WarpTo': {
      this._pendingMeleeAttack = null
      break
    }
    case 'NpcOpenTrade':
    case 'NpcOpenGamble': {
      const win = cmd.type === 'NpcOpenTrade' ? 'trade' : 'gamble'
      this._containers.clearShop()
      this._pendingGambleBuyCount = 0
      this._npcInteraction = {
        ...cur,
        npcId: cmd.npcId,
        window: win,
        activeWindow: win,
      }
      break
    }
    case 'NpcEntityAction':
    case 'NpcAction':
      if (cmd.action === 0) {
        const curWin = cur.activeWindow ?? cur.window
        const npcUnit = cmd.npcId
          ? this.getUnit('monster', cmd.npcId)
          : cur.npcId
            ? this.getUnit('monster', cur.npcId)
            : undefined
        const isArtisanNpc =
          npcUnit?.classId === 154 || npcUnit?.classId === 511 || npcUnit?.classId === 512
        const isTravelComplement =
          !isArtisanNpc &&
          curWin !== 'imbue' &&
          curWin !== 'add_sockets' &&
          curWin !== 'personalize' &&
          (cmd.complement === 1 || cmd.complement === 40 || cmd.complement === 75 || cmd.complement === 109)
        const isCharsi =
          curWin === 'imbue' ||
          (npcUnit?.classId === 154 &&
            curWin !== 'trade' &&
            curWin !== 'gamble' &&
            !isTravelComplement) ||
          (curWin === 'none' &&
            !isTravelComplement &&
            (this._quests[3]! & 0x0002) !== 0 &&
            (npcUnit === undefined || npcUnit.classId === 154))
        if (
          curWin === 'imbue' ||
          curWin === 'add_sockets' ||
          curWin === 'personalize' ||
          isCharsi
        ) {
          this._awaitingArtisanConfirmNpcId = (cmd.npcId || cur.npcId) ?? null
        }
        if (isCharsi || curWin === 'add_sockets' || curWin === 'personalize' || curWin === 'orifice') {
          this._npcInteraction = { ...cur, window: 'none', activeWindow: 'none' }
        }
      } else if (cmd.action === 1) {
        this._containers.clearShop()
        this._npcInteraction = { ...cur, npcId: cmd.npcId, window: 'trade', activeWindow: 'trade' }
      } else if (cmd.action === 2) {
        this._containers.clearShop()
        this._pendingGambleBuyCount = 0
        this._npcInteraction = { ...cur, npcId: cmd.npcId, window: 'gamble', activeWindow: 'gamble' }
      } else if (cmd.action === 3) {
        this._npcInteraction = { ...cur, npcId: cmd.npcId, window: 'none', activeWindow: 'hire' }
      }
      break
    case 'PlayNpcMessage': {
      const classId = cmd.classId ?? cmd.npcClassId ?? cmd.hcIdx
      if (classId !== undefined) {
        this.markNpcIntroPlayed(this.act, classId)
      }
      break
    }
    case 'QuestMessage': {
      const npcId = cmd.npcId
      if (npcId !== undefined && npcId !== 0) {
        this._pendingWantsInteractUnitIds.delete(npcId)
        const unit = this.getUnit('monster', npcId)
        if (unit) {
          unit.wantsInteract = false
        }
      }
      break
    }
    case 'NpcCancel': {
      this._awaitingArtisanConfirmNpcId = null
      if (cur.npcId !== null) {
        this.npcMotion.setNpcInteractionLock(cur.npcId, false)
      }
      this._containers.clearShop()
      const cancelNpcId = cmd.npcId ?? cur.npcId
      if (cancelNpcId !== null && cancelNpcId !== undefined && cancelNpcId !== 0) {
        this._pendingWantsInteractUnitIds.delete(cancelNpcId)
        const unit = this.getUnit('monster', cancelNpcId)
        if (unit) {
          unit.wantsInteract = false
        }
      }
      this._npcInteraction = {
        ...cur,
        npcId: null,
        infoNpcId: null,
        window: 'none',
        activeWindow: 'none',
        npcInfoRaw: undefined,
        npcTalkRaw: undefined,
        messages: undefined,
        allMessages: undefined,
        hadWantsInteract: undefined,
      }
      this.pushSoundRequest({ kind: 'speech-stop' })
      break
    }
    case 'StaffInOrifice': {
      this._awaitingArtisanConfirmNpcId = null
      this._npcInteraction = {
        ...cur,
        npcId: null,
        window: 'none',
        activeWindow: 'none',
      }
      break
    }
    case 'ClickButton': {
      const buttonId = cmd.buttonId ?? cmd.button ?? 0
      if (buttonId === ClickButtonId.CloseStash) {
        this._npcInteraction = { ...cur, stashOpen: false }
      } else if (buttonId === ClickButtonId.CloseCube) {
        this._npcInteraction = { ...cur, cubeOpen: false }
      } else if (buttonId === ClickButtonId.TradeAccept) {
        this._trade.pendingModal = null
      } else if (buttonId === ClickButtonId.TradeOk) {
        if (!this._trade.acceptDisabled) {
          this._trade.selfAccepted = true
        }
      } else if (buttonId === ClickButtonId.TradeUnaccept) {
        this._trade.selfAccepted = false
      } else if (buttonId === ClickButtonId.TradeGold) {
        const offeredGold = (cmd as any).complement ?? cmd.amount ?? 0
        this._trade.selfGold = Math.max(0, Math.floor(Number(offeredGold) || 0))
        this._trade.selfAccepted = false
      } else if (buttonId === ClickButtonId.TradeCancel) {
        this._trade.active = false
        this._trade.pendingModal = null
        this._trade.selfAccepted = false
        this._trade.partnerAccepted = false
        this._trade.acceptDisabled = false
        this._trade.partnerGold = 0
        this._trade.selfGold = 0
        this._containers.clearTrade()
      }
      break
    }
    case 'Resurrect':
      this._pendingMeleeAttack = null
      break
    case 'WaypointGo':
      this._waypointOpen = false
      this._waypointUnitId = null
      break
    case 'SelectSkill': {
      if (cmd.hand === 'left') {
        this._self.leftSkill = cmd.skill
      } else {
        this._self.rightSkill = cmd.skill
        this.syncSelfRightHandAuraState(cmd.skill)
      }
      break
    }
    case 'AssignSkillHotkey': {
      this.assignSkillHotkey(cmd.slot, cmd.hand, cmd.skill, cmd.itemId)
      break
    }
    case 'RunToggle': {
      this._self.runMode = cmd.run
      break
    }
    case 'Move':
    case 'WalkToLocation':
    case 'RunToLocation':
    case 'MoveToUnit':
    case 'WalkToTarget':
    case 'RunToTarget': {
      this._pendingMeleeAttack = null
      const isWalk =
        isSelfStaminaExhausted(this) ||
        cmd.type === 'WalkToLocation' ||
        cmd.type === 'WalkToTarget' ||
        (cmd.type === 'Move' && cmd.run === false) ||
        (cmd.type === 'MoveToUnit' && cmd.run === false)
      const nextMode = isWalk ? (isTownLevel(this.areaId) ? 6 : 2) : 3
      if (this.selfId !== 0) {
        const selfUnit = this.getUnit('player', this.selfId)
        if (selfUnit) {
          this.clearUnitCastState(selfUnit)
          selfUnit.moveMode = isWalk ? 'walk' : 'run'
          if (!selfUnit.dead) {
            selfUnit.mode = nextMode
          }
        }
      }
      if (!this._self.isDead) {
        this._self.mode = nextMode
        this._self.moving = true
      }
      this._self.castState = undefined
      break
    }
    case 'SkillAt':
    case 'CastLeftSkillOnLocation':
    case 'CastRightSkillOnLocation': {
      this._pendingMeleeAttack = null
      const isRight =
        cmd.type === 'CastRightSkillOnLocation' || (cmd.type === 'SkillAt' && cmd.hand === 'right')
      const skillId = isRight ? this._self.rightSkill : this._self.leftSkill
      if (isTownLevel(this.areaId) && !isSkillAllowedInTown(skillId)) {
        break
      }
      const targetX = cmd.type === 'SkillAt' ? cmd.at.x : cmd.x
      const targetY = cmd.type === 'SkillAt' ? cmd.at.y : cmd.y
      const now = this.resolveEventNowMs(nowMs)
      if (this.selfId !== 0) {
        const selfUnit = this.ensureUnit('player', this.selfId)
        if (selfXOverride !== undefined && selfYOverride !== undefined) {
          selfUnit.x = selfXOverride
          selfUnit.y = selfYOverride
          this._self.x = selfXOverride
          this._self.y = selfYOverride
        }
        // A location cast has no target unit (CltDo18 0x6FAC5C40 reads it via 0x6FB55F70: none → mode 2).
        selfUnit.targetUnit = undefined
        const isBusyActiveCast =
          selfUnit.castState &&
          selfUnit.castState.skillId === skillId &&
          now < selfUnit.castState.untilMs
        if (!isBusyActiveCast) {
          this._lastLocalCastSkillId = skillId
          this._lastLocalCastAtMs = now
          this.applySkillCastToUnit(selfUnit, skillId, targetX, targetY, 1, true, nowMs)
        } else if ((skillId === 41 || skillId === 230) && selfUnit.castState) {
          // 1.13c continuous channeling skills (#41 Inferno, #230 Arctic Blast):
          // Sustain the active channel and aim toward the cursor without restarting wind-up frames.
          this._lastLocalCastSkillId = skillId
          this._lastLocalCastAtMs = now
          selfUnit.castState.targetX = targetX
          selfUnit.castState.targetY = targetY
          selfUnit.castState.untilMs = Math.max(selfUnit.castState.untilMs, now + 240)
          selfUnit.castState.durationMs = Math.max(
            selfUnit.castState.durationMs ?? 0,
            (selfUnit.castState.elapsedMs ?? 0) + 240,
          )
          selfUnit.modeUntilMs = selfUnit.castState.untilMs
          selfUnit.modeDurationMs = selfUnit.castState.durationMs
          selfUnit.faceToward(targetX, targetY, false)
          this._self.castState = selfUnit.castState
        }
      } else {
        this._lastLocalCastSkillId = skillId
        this._lastLocalCastAtMs = now
      }
      break
    }
    case 'SkillOn':
    case 'CastLeftSkillOnTarget':
    case 'CastRightSkillOnTarget': {
      const isRight =
        cmd.type === 'CastRightSkillOnTarget' || (cmd.type === 'SkillOn' && cmd.hand === 'right')
      const hand: 'left' | 'right' = isRight ? 'right' : 'left'
      const skillId = isRight ? this._self.rightSkill : this._self.leftSkill
      if (isTownLevel(this.areaId) && !isSkillAllowedInTown(skillId)) {
        break
      }
      const isShift = cmd.type === 'SkillOn' && cmd.shift === true
      const targetRef: UnitRef =
        cmd.type === 'SkillOn' ? cmd.target : { unitType: cmd.unitKind, id: cmd.unitId }
      const targetUnit = this.getUnit(targetRef.unitType, targetRef.id)
      const targetX = targetUnit?.x ?? this._self.x
      const targetY = targetUnit?.y ?? this._self.y
      const now = this.resolveEventNowMs(nowMs)

      // 1.13c sub_6FC836D0 (D2Game/src/PLAYER/PlrMsg.cpp:1018-1033):
      // When casting an unshifted melee skill (D2Common_11016 == 1) on a target unit that is
      // outside UNITS_IsInMeleeRange, the player walks/runs toward the target first and only
      // enters the attack animation once within melee range (sub_6FC7F780).
      if (
        !isShift &&
        targetUnit !== undefined &&
        (targetUnit.x !== 0 || targetUnit.y !== 0) &&
        this.isSelfMeleeSkill(skillId) &&
        !this.isTargetInSelfMeleeRange(targetUnit, selfXOverride, selfYOverride)
      ) {
        const existingPending = this._pendingMeleeAttack
        if (
          !existingPending ||
          existingPending.skillId !== skillId ||
          existingPending.hand !== hand ||
          existingPending.target.unitType !== targetRef.unitType ||
          existingPending.target.id !== targetRef.id
        ) {
          this._pendingMeleeAttack = {
            skillId,
            hand,
            target: targetRef,
            startedAtMs: now,
          }
        }
        if (this.selfId !== 0) {
          const selfUnit = this.ensureUnit('player', this.selfId)
          this.clearUnitCastState(selfUnit)
          this._self.castState = undefined
          selfUnit.targetUnit = targetRef
          if (selfXOverride !== undefined && selfYOverride !== undefined) {
            selfUnit.x = selfXOverride
            selfUnit.y = selfYOverride
            this._self.x = selfXOverride
            this._self.y = selfYOverride
          }
          if (!this.skipSelfTurnStep) {
            selfUnit.targetX = targetUnit.x
            selfUnit.targetY = targetUnit.y
          }
          selfUnit.faceToward(targetUnit.x, targetUnit.y, false)
          const inTown = isTownLevel(this.areaId)
          const isWalk = inTown || isSelfStaminaExhausted(this) || selfUnit.moveMode === 'walk'
          selfUnit.moveMode = isWalk ? 'walk' : 'run'
          if (!selfUnit.dead) {
            selfUnit.mode = isWalk ? (inTown ? 6 : 2) : 3
          }
        }
        break
      }

      this._pendingMeleeAttack = null
      if (this.selfId !== 0) {
        const selfUnit = this.ensureUnit('player', this.selfId)
        if (selfXOverride !== undefined && selfYOverride !== undefined) {
          selfUnit.x = selfXOverride
          selfUnit.y = selfYOverride
          this._self.x = selfXOverride
          this._self.y = selfYOverride
        }
        selfUnit.targetUnit = targetRef
        const isBusyActiveCast =
          selfUnit.castState &&
          selfUnit.castState.skillId === skillId &&
          now < selfUnit.castState.untilMs
        if (!isBusyActiveCast) {
          this._lastLocalCastSkillId = skillId
          this._lastLocalCastAtMs = now
          this.applySkillCastToUnit(selfUnit, skillId, targetX, targetY, 1, true, nowMs)
        } else if ((skillId === 41 || skillId === 230) && selfUnit.castState) {
          this._lastLocalCastSkillId = skillId
          this._lastLocalCastAtMs = now
          selfUnit.castState.targetX = targetX
          selfUnit.castState.targetY = targetY
          selfUnit.castState.untilMs = Math.max(selfUnit.castState.untilMs, now + 240)
          selfUnit.castState.durationMs = Math.max(
            selfUnit.castState.durationMs ?? 0,
            (selfUnit.castState.elapsedMs ?? 0) + 240,
          )
          selfUnit.modeUntilMs = selfUnit.castState.untilMs
          selfUnit.modeDurationMs = selfUnit.castState.durationMs
          selfUnit.faceToward(targetX, targetY, false)
          this._self.castState = selfUnit.castState
        }
      } else {
        this._lastLocalCastSkillId = skillId
        this._lastLocalCastAtMs = now
      }
      break
    }
    case 'BeltRemove': {
      this._pendingBeltPickupItemIds.add(cmd.itemId >>> 0)
      break
    }
    case 'BeltUse': {
      this._pendingBeltPickupItemIds.delete(cmd.itemId >>> 0)
      break
    }
    case 'NpcBuy': {
      // 0x32 with the gamble bit: the next unidentified item the server places into the inventory is the
      // purchased one (D2Game `dwBoughtItemId`), which 0x37 IdentifyFromGamble then identifies (#1006).
      if (cmd.gamble) this._pendingGambleBuyCount = (this._pendingGambleBuyCount ?? 0) + 1
      break
    }
    case 'OverheadChat': {
      const resolvedSelfId = this.selfId || (this.getUnit('player', 1) ? 1 : 0)
      if (resolvedSelfId !== 0) {
        const selfUnit = this.ensureUnit('player', resolvedSelfId)
        const cleaned = cmd.text.trim()
        if (cleaned.length > 0) {
          const tNow = this.resolveEventNowMs(nowMs)
          selfUnit.overheadText = cleaned
          selfUnit.overheadExpireMs = tNow + OVERHEAD_SPEECH_TTL_MS
          selfUnit.overheadColor = 0
        } else {
          selfUnit.overheadText = undefined
          selfUnit.overheadExpireMs = undefined
          selfUnit.overheadColor = undefined
        }
      }
      break
    }
    case 'Chat': {
      if (cmd.whisperTo && cmd.whisperTo.trim()) {
        this._lastWhisperTarget = cmd.whisperTo.trim()
      }
      break
    }
    default:
      break
  }
}

export function applyWorldEventImpl(this: ClientWorldInternal, rawEv: ServerEvent | Record<string, any>, nowMs?: number): void {
  if (!rawEv || typeof rawEv !== 'object') return
  if (nowMs !== undefined && Number.isFinite(nowMs)) {
    this._clockMs = nowMs
    this._clockExplicit = true
    this._timeMs = nowMs
  }
  let ev: any = rawEv
  if (ev.type === 'ActDataLoaded') {
    const area = ev.townAreaId ?? ev.areaId
    if (area === undefined || area === null) {
      throw new Error('ActDataLoaded missing areaId')
    }
    ev = {
      type: 'LoadAct',
      act: Number(ev.act ?? 0),
      mapSeed: Number(ev.mapSeed ?? 0) >>> 0,
      areaId: Number(area),
      objectSeed: Number(ev.unknown ?? 0) >>> 0,
    }
  } else if (ev.type === 'PlayerAssign' || ev.type === 'AssignPlayer' || ev.type === 'EntitySpawn' || ev.type === 'MonsterSpawned') {
    const rawId = ev.unitId ?? ev.id
    if (rawId === undefined || rawId === null) {
      throw new Error(`${ev.type} missing unitId`)
    }
    const isPlayerEv = ev.type === 'PlayerAssign' || ev.type === 'AssignPlayer'
    const uType =
      isPlayerEv
        ? 'player'
        : ev.type === 'MonsterSpawned'
          ? 'monster'
          : unitTypeFromId(ev.unitType ?? 1)
    const uId = Number(rawId)
    const lifePct = ev.hpRatio !== undefined
      ? Math.round(Number(ev.hpRatio))
      : ev.maxHp
        ? Math.round((Number(ev.hp ?? ev.maxHp) / Number(ev.maxHp)) * 128)
        : 128
    const defaultMode =
      uType === 'monster'
        ? lifePct <= 0
          ? 12
          : 1
        : uType === 'player'
          ? 1
          : 0
    ev = {
      type: 'UnitAssign',
      classId: Number(ev.classId ?? 0),
      isSelf:
        uType === 'player' &&
        (this.selfId !== 0 ? this.selfId === uId : (isPlayerEv || ev.isSelf === true)),
      unit: {
        unitType: uType,
        id: uId,
        classId: Number(ev.classId ?? 0),
        name: ev.name ?? ev.code,
        x: Number(ev.x ?? 0),
        y: Number(ev.y ?? 0),
        ...(ev.direction !== undefined ? { direction: Number(ev.direction) } : {}),
        lifePct,
        mode: ev.mode !== undefined ? Number(ev.mode) : defaultMode,
        ...(ev.monUMods !== undefined
          ? { monUMods: ev.monUMods }
          : Array.isArray(ev.modifiers)
            ? { monUMods: resolveMonsterUModIds(ev.modifiers) }
            : {}),
        ...(ev.isMinion !== undefined
          ? { isMinion: Boolean(ev.isMinion) }
          : ev.rank === 'minion'
            ? { isMinion: true }
            : {}),
        ...(ev.tempSummonExpireTick !== undefined
          ? { tempSummonExpireTick: Number(ev.tempSummonExpireTick) }
          : {}),
      },
    }
  } else if (ev.type === 'ReassignPlayer') {
    ev = {
      type: 'UnitReassign',
      unitType: unitTypeFromId(ev.unitType ?? 0),
      id: Number(ev.unitId ?? ev.id ?? 0),
      at: ev.at ?? { x: Number(ev.x ?? 0), y: Number(ev.y ?? 0) },
      snap: Boolean(ev.snap ?? ev.true ?? false),
    }
  } else if (ev.type === 'EntityRemove') {
    ev = {
      type: 'UnitRemove',
      unitType: unitTypeFromId(ev.unitType ?? 1),
      id: Number(ev.unitId ?? ev.id ?? 0),
    }
  } else if (ev.type === 'UnitMove') {
    const evAny = ev as any
    const rawUnitType = evAny.unitType ?? evAny.unit?.unitType
    const uType = typeof rawUnitType === 'number' ? unitTypeFromId(rawUnitType) : (rawUnitType ?? 'player')
    const uId = Number(evAny.id ?? evAny.unitId ?? evAny.unit?.id ?? 0)
    const hasFrom = evAny.from !== undefined || evAny.currentX !== undefined
    const from = hasFrom
      ? {
          x: Number(evAny.from?.x ?? evAny.currentX ?? 0),
          y: Number(evAny.from?.y ?? evAny.currentY ?? 0),
        }
      : undefined
    const toX = Number(evAny.to?.x ?? evAny.targetX ?? evAny.x ?? (from ? from.x : 0))
    const toY = Number(evAny.to?.y ?? evAny.targetY ?? evAny.y ?? (from ? from.y : 0))
    ev = {
      type: 'UnitMove',
      unitType: uType,
      id: uId,
      mode: evAny.mode ?? evAny.moveMode ?? 'walk',
      ...(from ? { from } : {}),
      to: {
        x: toX,
        y: toY,
      },
      ...(evAny.target ? { target: evAny.target } : {}),
      ...(evAny.velocityPercent !== undefined ? { velocityPercent: Number(evAny.velocityPercent) } : {}),
      ...(evAny.pathType !== undefined ? { pathType: Number(evAny.pathType) } : {}),
      ...(evAny.npc !== undefined ? { npc: evAny.npc } : {}),
    }
  } else if (ev.type === 'CastAtCoord') {
    ev = {
      type: 'SkillCast',
      caster: ev.caster ?? ev.unit ?? { unitType: ev.unitType ?? 0, id: Number(ev.unitId ?? ev.id ?? (this.selfId || 1)) },
      skill: Number(ev.skill ?? ev.skillId ?? 0),
      level: Number(ev.level ?? 1),
      target: ev.at ?? ev.target ?? {
        x: Number(ev.targetX ?? ev.x ?? 0),
        y: Number(ev.targetY ?? ev.y ?? 0),
      },
    }
  } else if (ev.type === 'CastOnUnit') {
    ev = {
      type: 'SkillCast',
      caster: ev.caster ?? ev.unit ?? { unitType: ev.unitType ?? 0, id: Number(ev.unitId ?? ev.id ?? (this.selfId || 1)) },
      skill: Number(ev.skill ?? ev.skillId ?? 0),
      level: Number(ev.level ?? 1),
      target: ev.target ?? {
        unitType: ev.targetType ?? ev.targetUnitType ?? 1,
        id: Number(ev.targetId ?? ev.targetUnitId ?? 0),
      },
    }
  } else if (ev.type === 'ChatMessage') {
    ev = {
      type: 'Chat',
      kind: 'say',
      from: ev.speaker ?? ev.from ?? 'Server',
      text: String(ev.text ?? ''),
    }
  } else if (ev.type === 'LifeManaPotUpdate' || ev.type === 'PlayerLifeManaChange') {
    ev = {
      type: 'LifeMana',
      life: Number(ev.life ?? 0),
      mana: Number(ev.mana ?? 0),
      stamina: Number(ev.stamina ?? 0),
      ...(ev.lifeRegen !== undefined ? { lifeRegen: Number(ev.lifeRegen) } : {}),
      ...(ev.manaRegen !== undefined ? { manaRegen: Number(ev.manaRegen) } : {}),
      at: ev.at ?? { x: Number(ev.x ?? 0), y: Number(ev.y ?? 0) },
    }
  } else if (ev.type === 'StatChange' || ev.type === 'UnitStatUpdate') {
    ev = {
      type: 'StatSet',
      ...(ev.unit
        ? { unit: ev.unit }
        : ev.unitType !== undefined && ev.unitId !== undefined
          ? { unit: { unitType: unitTypeFromId(ev.unitType), id: Number(ev.unitId) } }
          : {}),
      stat: Number(ev.stat ?? ev.statId ?? 0),
      value: Number(ev.value ?? 0),
      param: Number(ev.param ?? 0),
    }
  } else if (ev.type === 'UnitState') {
    const uRef = ev.unit ?? {
      unitType: unitTypeFromId(ev.unitType ?? 0),
      id: Number(ev.unitId ?? (this.selfId || 1)),
    }
    if (ev.active === false) {
      ev = {
        type: 'StateEnd',
        unit: uRef,
        state: Number(ev.stateId ?? ev.state ?? 0),
      }
    } else {
      ev = {
        type: 'StateSet',
        unit: uRef,
        state: Number(ev.stateId ?? ev.state ?? 0),
      }
    }
  } else if (ev.type === 'SkillUpdate') {
    const baseLevel = Number(ev.baseLevel ?? ev.level ?? 0)
    const bonus = Number(ev.bonusLevel ?? ev.bonus ?? 0)
    ev = {
      type: 'SkillList',
      unitId: Number(ev.unitId ?? this.selfId),
      skills: [
        {
          skillId: Number(ev.skillId ?? ev.skill ?? 0),
          skill: Number(ev.skillId ?? ev.skill ?? 0),
          level: baseLevel + bonus,
          baseLevel,
          bonus,
        },
      ],
    }
  } else if (ev.type === 'MercStatChange') {
    ev = {
      type: 'Merc',
      kind: 'stat',
      mercId: Number(ev.mercId ?? 0),
      stat: Number(ev.statId ?? ev.stat ?? 0),
      value: Number(ev.value ?? 0),
    }
  } else if (ev.type === 'Damage') {
    const isPlayerTarget = unitTypeFromId(ev.unitType ?? 1) === 'player'
    ev = {
      type: 'UnitMode',
      unitType: ev.unitType ?? 1,
      id: Number(ev.unitId ?? ev.id ?? 0),
      mode: Number(ev.mode ?? (ev.lifePct === 0 ? (isPlayerTarget ? 17 : 12) : (isPlayerTarget ? 4 : 3))),
      lifePct: Number(ev.lifePct ?? 0),
    }
  } else if (ev.type === 'UnitUseSkillOnTarget' || ev.type === 'UnitUseSkill') {
    this.emitSkillCastSound({
      skillId: Number(ev.skill ?? ev.skillId ?? 0),
      charclass: ev.charclass,
      x: ev.x !== undefined ? Number(ev.x) : undefined,
      y: ev.y !== undefined ? Number(ev.y) : undefined,
      unitId: ev.unitId !== undefined ? Number(ev.unitId) : undefined,
    })
    return
  } else if (ev.type === 'MissileImpact') {
    this.emitMissileImpactSound({
      missileId: ev.missileId,
      entityId: ev.entityId !== undefined ? Number(ev.entityId) : undefined,
      x: ev.x !== undefined ? Number(ev.x) : undefined,
      y: ev.y !== undefined ? Number(ev.y) : undefined,
      prog: ev.prog,
    })
    return
  } else if (ev.type === 'AssignNpc') {
    const uId = Number(ev.unitId ?? ev.id ?? 0)
    if (uId > 0) {
      this._deadSoundUnitIds.delete(uId)
    }
    ev = {
      type: 'UnitAssign',
      classId: Number(ev.classId ?? 0),
      isSelf: false,
      unit: {
        unitType: 'monster',
        id: uId,
        classId: Number(ev.classId ?? 0),
        x: Number(ev.x ?? 0),
        y: Number(ev.y ?? 0),
        lifePct: ev.life !== undefined && Number(ev.life) <= 0 ? 0 : 128,
        mode: ev.life !== undefined && Number(ev.life) <= 0 ? 12 : 1,
      },
    }
  } else if (ev.type === 'NpcState') {
    const uId = Number(ev.unitId ?? ev.id ?? 0)
    const state = Number(ev.state ?? ev.mode ?? 0)
    const existing = uId > 0 ? this.getUnit('monster', uId) : undefined
    if (state === 0x08 || state === 0x09) {
      this.emitUnitDeathSound({
        unitType: 1,
        unitId: uId,
        classId: existing?.classId ?? (ev.classId !== undefined ? Number(ev.classId) : 1),
        x: ev.x !== undefined ? Number(ev.x) : existing?.x,
        y: ev.y !== undefined ? Number(ev.y) : existing?.y,
      })
    }
    if (existing) {
      const wasDead = existing.dead
      existing.mode = state === 0x08 || state === 0x09 ? 12 : state
      if (ev.x !== undefined) existing.x = Number(ev.x)
      if (ev.y !== undefined) existing.y = Number(ev.y)
      if (state === 0x08 || state === 0x09 || (ev.life !== undefined && Number(ev.life) <= 0)) {
        existing.lifePct = 0
      }
      if (!wasDead && existing.dead) {
        existing.diedAtMs = this._timeMs
      }
    }
    return
  }

  switch (ev.type) {
    case 'GameLoading':
      this.loading = true
      break

    case 'GameFlags':
      this.difficulty = ev.difficulty
      this.hardcore = ev.hardcore
      this.expansion = ev.expansion
      this.ladder = ev.ladder
      break

    case 'LoadAct': {
      this._deadSoundUnitIds.clear()
      const prevAreaId = this.areaId
      if (prevAreaId !== 0 && prevAreaId !== ev.areaId) {
        this._waypointOpen = false
        this._waypointUnitId = null
        this.pruneNonSelfUnitsOnAreaTransition()
      }
      this.act = ev.act
      this.mapSeed = ev.mapSeed >>> 0
      this.areaId = ev.areaId
      this._collisionRevision++
      if (ev.objectSeed !== undefined) {
        this.objectSeed = ev.objectSeed >>> 0
      }
      this._awaitingArtisanConfirmNpcId = null
      this._npcInteraction = {
        npcId: null,
        window: 'none',
        activeWindow: 'none',
        stashOpen: false,
        cubeOpen: false,
      }
      this._containers.clearShop()
      if (!this._isSelfDead || this._self.maxLife === 0 || this._self.life > 0 || this._self.stats.get(6) > 0) {
        this._isSelfDead = false
        this._self.isDead = false
        if (this.selfId !== 0) {
          const selfUnit = this._units.get(makeUnitKey('player', this.selfId))
          if (selfUnit) {
            if (selfUnit.lifePct <= 0) {
              selfUnit.lifePct =
                this._self.maxLife > 0 && this._self.life > 0
                  ? Math.max(1, Math.round((this._self.life / this._self.maxLife) * 128))
                  : 128
            }
            if (
              isTownLevel(this.areaId) ||
              selfUnit.mode === 0 ||
              selfUnit.mode === 17 ||
              selfUnit.mode === 10
            ) {
              selfUnit.mode = isTownLevel(this.areaId) ? 5 : 1
            }
            this._self.mode = selfUnit.mode
          }
        }
      }
      this.syncPlayerTownModes()
      break
    }

    case 'LoadComplete':
      this.loading = false
      break

    case 'UnloadComplete':
      this.loading = true
      break

    case 'GameLogout':
      this.loading = false
      break

    case 'CanGoToAct':
      this._canGoToAct.add(ev.act)
      break

    case 'OpenUi': {
      if (ev.uiId === 0) {
        this._npcInteraction = {
          ...this._npcInteraction,
          npcId: ev.unitId > 0 ? ev.unitId : this._npcInteraction.npcId,
          unitType: 2,
          window: 'orifice',
          activeWindow: 'orifice',
        }
      } else if (ev.uiId === 1 || ev.uiId === 5) {
        this._awaitingArtisanConfirmNpcId = null
        this._npcInteraction = {
          ...this._npcInteraction,
          window: 'none',
          activeWindow: 'none',
        }
      } else if (ev.uiId === 6) {
        const curWin = this._npcInteraction.activeWindow ?? this._npcInteraction.window
        const isCompletion =
          ev.unitType === 0 ||
          ev.unitId === 0 ||
          curWin === 'orifice' ||
          curWin === 'imbue' ||
          curWin === 'add_sockets' ||
          curWin === 'personalize' ||
          this._awaitingArtisanConfirmNpcId !== null
        if (isCompletion) {
          this._awaitingArtisanConfirmNpcId = null
          this._npcInteraction = {
            ...this._npcInteraction,
            npcId: null,
            infoNpcId: null,
            window: 'none',
            activeWindow: 'none',
          }
        } else {
          this._npcInteraction = {
            ...this._npcInteraction,
            npcId: ev.unitId > 0 ? ev.unitId : this._npcInteraction.npcId,
            window: 'imbue',
            activeWindow: 'imbue',
          }
        }
      } else if (ev.uiId === 7) {
        const curWin = this._npcInteraction.activeWindow ?? this._npcInteraction.window
        const refusedBy = this._awaitingArtisanConfirmNpcId === null ? undefined : this.getUnit('monster', this._awaitingArtisanConfirmNpcId)?.classId
        const refusal = refusedBy === undefined ? undefined : ARTISAN_REFUSALS[refusedBy]
        if (refusal !== undefined) addLocalSystemMessageImpl.call(this, refusal, RED_TEXT)
        const isCompletion =
          ev.unitType === 0 ||
          ev.unitId === 0 ||
          curWin === 'orifice' ||
          curWin === 'imbue' ||
          curWin === 'add_sockets' ||
          curWin === 'personalize' ||
          this._awaitingArtisanConfirmNpcId !== null
        if (isCompletion) {
          this._awaitingArtisanConfirmNpcId = null
          this._npcInteraction = {
            ...this._npcInteraction,
            npcId: null,
            infoNpcId: null,
            window: 'none',
            activeWindow: 'none',
          }
        } else {
          this._npcInteraction = {
            ...this._npcInteraction,
            npcId: ev.unitId > 0 ? ev.unitId : this._npcInteraction.npcId,
            window: 'add_sockets',
            activeWindow: 'add_sockets',
          }
        }
      } else if (ev.uiId === 8) {
        this._npcInteraction = {
          ...this._npcInteraction,
          npcId: ev.unitId > 0 ? ev.unitId : this._npcInteraction.npcId,
          window: 'personalize',
          activeWindow: 'personalize',
        }
      }
      break
    }

    case 'RoomReveal':
      this._revealedRooms.add(`${ev.areaId}:${ev.tileX}:${ev.tileY}`)
      if (ev.roomSeed !== undefined) {
        this.setRevealedRoomSeed(
          ev.areaId,
          ev.tileX,
          ev.tileY,
          ev.roomSeed,
          ev.tileX * 5,
          ev.tileY * 5,
          (ev.tileW ?? 8) * 5,
          (ev.tileH ?? 8) * 5,
          true,
        )
      }
      this._revealedAreaIdsCache = null
      this._collisionRevision++
      if (
        ev.areaId > 0 &&
        (this.areaId === 0 || !this.getRevealedAreaIds().includes(this.areaId))
      ) {
        this.areaId = ev.areaId
        this.syncPlayerTownModes()
      } else if (this._self.x !== 0 || this._self.y !== 0) {
        const roomAreaId = this.resolveAreaFromRevealedRooms(this._self.x, this._self.y)
        if (roomAreaId > 0 && roomAreaId !== this.areaId) {
          this.areaId = roomAreaId
          this.syncPlayerTownModes()
        }
      }
      break

    case 'RoomHide': {
      const roomKey = `${ev.areaId}:${ev.tileX}:${ev.tileY}`
      const seededRoom = this._revealedRoomSeeds.get(roomKey)
      this._revealedRooms.delete(roomKey)
      this._revealedRoomSeeds.delete(roomKey)
      this._revealedAreaIdsCache = null
      this._collisionRevision++
      this.pruneUnitsInHiddenRoom(ev.tileX, ev.tileY, seededRoom?.subW, seededRoom?.subH)
      if (this.areaId > 0 && ev.areaId === this.areaId && this._revealedRooms.size > 0) {
        const revealedAreas = this.getRevealedAreaIds()
        if (!revealedAreas.includes(this.areaId)) {
          const roomAreaId =
            this.resolveAreaFromRevealedRooms(this._self.x, this._self.y) ||
            (revealedAreas[0] ?? 0)
          if (roomAreaId > 0 && roomAreaId !== this.areaId) {
            this.areaId = roomAreaId
            this.syncPlayerTownModes()
          }
        }
      }
      break
    }

    case 'UnitAssign': {
      const rawUnitId = (ev as any).id ?? (ev as any).unitId
      const unitPayload =
        ev.unit ??
        (rawUnitId !== undefined && (ev as any).unitType !== undefined
          ? {
              id: rawUnitId,
              unitType: (ev as any).unitType,
              classId: (ev as any).classId ?? 0,
              name: (ev as any).name,
              x: (ev as any).x ?? 0,
              y: (ev as any).y ?? 0,
              mode: (ev as any).mode,
              direction: (ev as any).direction,
              lifePct: (ev as any).lifePct,
            }
          : null)
      if (!unitPayload) {
        throw new Error('UnitAssign missing unit payload')
      }
      const key = makeUnitKey(unitPayload.unitType, unitPayload.id)
      let unit = this._units.get(key)
      const existed = unit !== undefined
      const wasDeadBeforeAssign = unit?.dead ?? false
      const prevMode = unit?.mode
      if (!unit) {
        unit = new ClientUnit(unitPayload)
        this._units.set(key, unit)
      } else {
        unit.updateFromSnapshot(unitPayload)
      }
      this.seedUnitFromActiveRoom(unit, existed)
      if (unitPayload.mode === undefined) {
        if (unit.unitType === 'player') {
          unit.mode = isTownLevel(this.areaId) ? 5 : 1
        } else if (unit.unitType === 'monster') {
          unit.mode = unit.lifePct <= 0 ? 12 : 1
        }
      } else if (unit.unitType === 'monster' && unit.lifePct > 0 && isMonsterOneShotMode(unit.mode)) {
        unit.mode = 1
      }
      if (unit.unitType === 'object') {
        // S2C 0x51 object init (0x6fad5490): a new unit has no light (unit+0x64 = 0, 0x6fad54ad) and #10595 runs for
        // the packet mode (0x6fad556a). A 0x51 for an existing (type, id) replaces the unit (0x6fb57360), so the light
        // and packet queue restart too. The session then applies the EnvEffect switch or `Lit[mode]` (0x6fad564e).
        const objectRecord = getObjectsTxtRecord113c(unit.classId)
        unit.queuedPackets.length = 0
        unit.objectLight = null
        // The replaced unit has no handled sound mode yet (unit +0x70 = 0): 0x6fad37e0 plays no one-shot for it,
        // and replacing an existing object frees its prior sound handles (0x6fb57360 -> 0x6fb56d61 -> 0x6fad3120, #998).
        if (existed && ((unit.objectLoopSoundId ?? 0) > 0 || this._soundLoopObjectIds?.has(unit.id))) {
          this.pushSoundRequest({
            kind: 'unit-loop-stop',
            unit: { unitType: 'object', id: unit.id, x: unit.x, y: unit.y },
            x: unit.x,
            y: unit.y,
          })
        }
        unit.objectSoundMode = undefined
        unit.objectLoopSoundId = undefined
        resetObjectAnim(unit, objectRecord)
        if (!existed || unit.mode !== prevMode || unit.modeStartedAtMs === undefined) {
          const objNow = this.resolveEventNowMs(nowMs)
          unit.modeStartedAtMs = objNow
          unit.animStartedAtMs = objNow
          unit.modeElapsedMs = 0
          if (unit.mode === 1 && objectRecord.isDoor !== 0) {
            // Doors only: DoorAnim 0x6fad5400 is not ported, so the port keeps its timed 1 → 2 for them. Every
            // other object leaves mode 1 through the 1.13c animation tick (tickObjectAnim).
            const objMeta = unit.objectMeta
            const opFrames = objMeta?.frameCnt?.[1] || 15
            const opDelta = objMeta?.frameDelta?.[1] || 200
            const durationMs = Math.ceil(((opFrames * 256) / opDelta) * 40)
            unit.modeDurationMs = durationMs
            unit.modeUntilMs = objNow + durationMs
          } else {
            unit.modeDurationMs = undefined
            unit.modeUntilMs = undefined
          }
        }
      }
      if (unit.unitType === 'object') {
        const placeholderHcIdx = getNpcPlaceholderHcIdx(unit.classId)
        if (placeholderHcIdx !== undefined) {
          unit.hidden = this.hasActiveMonsterNpc(placeholderHcIdx)
        }
        this.updateObjectCollisionFootprint(unit)
      }
      unit.moving = false
      unit.moveMode = 'stop'
      if (unit.unitType === 'monster') {
        this._monsters.set(unit.id, unit)
        if (unit.dead || unit.mode === 0 || unit.mode === 12 || unit.lifePct <= 0) {
          unit.deathFxTriggered = true
          if (unit.id > 0) {
            this._deadSoundUnitIds.add(unit.id)
          }
        } else if (!existed && !unit.dead && unit.mode !== 0 && unit.mode !== 12 && unit.lifePct > 0) {
          this._deadSoundUnitIds.delete(unit.id)
          if (!isTownNpcHcIdx(unit.classId)) {
            const monRow = resolveUnitMonSoundRow113c(unit)
            if (monRow && monRow.init > 0) {
              this.pushSoundRequest({
                soundId: monRow.init,
                unit: { unitType: 'monster', id: unit.id, x: unit.x, y: unit.y },
                x: unit.x,
                y: unit.y,
              })
            }
          }
        }
        if (
          !unit.dead &&
          unit.tempSummonExpireTick === undefined &&
          hasMonsterUMod(unit, MON_UMOD.TEMPSUMMON)
        ) {
          unit.tempSummonExpireTick = this.frameCount + 500
        }
        if (isTownNpcHcIdx(unit.classId)) {
          this.reconcileNpcPlaceholderObjects(unit.classId)
        }
        if (this._pendingWantsInteractUnitIds.delete(unit.id)) {
          unit.wantsInteract = true
        }
        if (unit.id < 900000 && unit.classId >= 351 && unit.classId <= 353) {
          for (const m of Array.from(this._monsters.values())) {
            if (m.id >= 920000 && m.classId >= 351 && m.classId <= 353) {
              this._units.delete(m.key)
              this._monsters.delete(m.id)
              this._pets.delete(m.id)
              this.npcMotion.removeMonster(m.id)
            }
          }
        }
        if (unit.id < 900000 && (unit.classId === 356 || unit.classId === 357)) {
          for (const m of Array.from(this._monsters.values())) {
            if (m.id !== unit.id && m.classId === unit.classId && m.id >= 900000) {
              this._units.delete(m.key)
              this._monsters.delete(m.id)
              this._pets.delete(m.id)
              this.npcMotion.removeMonster(m.id)
            }
          }
          if (!unit.ownerType) unit.ownerType = 'player'
          if (!unit.ownerId) unit.ownerId = this.selfId || 1
          if (!unit.dead) {
            if (unit.classId === 356) {
              if (!unit.name) unit.name = 'Decoy'
              if (!unit.nameZh) unit.nameZh = '诱饵'
              if (!existed && !unit.overlays.some((o) => o.token === 'dopllezon_appear')) {
                this.attachUnitOverlay(unit, 'dopllezon_appear', false)
              }
            } else if (unit.classId === 357) {
              if (!unit.name) unit.name = 'Valkyrie'
              if (!unit.nameZh) unit.nameZh = '女武神'
              unit.states.add(93)
              if (!existed) {
                playStateCastOverlay113c(this, unit, 93)
              }
              if (!unit.overlays.some((o) => o.token === 'valkyrie')) {
                this.attachUnitOverlay(unit, 'valkyrie', true)
              }
            }
          }
        }
        if (unit.dead) {
          if (existed && !wasDeadBeforeAssign) {
            unit.diedAtMs = this._timeMs
          }
          unit.lifePct = 0
          unit.moveMode = 'stop'
          unit.targetX = unit.x
          unit.targetY = unit.y
          unit.setDirection(unit.direction)
        } else {
          unit.diedAtMs = undefined
        }
        if (unit.classId === 0) {
          const knownClassId = this.resolveKnownMonsterClassId(unit.id)
          if (knownClassId > 0) {
            unit.classId = knownClassId
          }
        }
        if (
          unit.x === 0 &&
          unit.y === 0 &&
          (this.isOwnMercUnitId(unit.id) || this.isOwnPetUnitId(unit.id)) &&
          (this._self.x !== 0 || this._self.y !== 0)
        ) {
          unit.x = this._self.x
          unit.y = this._self.y
          unit.targetX = this._self.x
          unit.targetY = this._self.y
        }
        this.npcMotion.spawnMonster({
          unitId: unit.id,
          classId: unit.classId,
          x: unit.x,
          y: unit.y,
          mode: unit.mode,
          direction: unitPayload.direction ?? unit.direction,
          lifePct: unit.lifePct,
          isDead: unit.dead,
          ...(unit.velocityPercent !== undefined ? { stat67: unit.velocityPercent } : {}),
        })
        if (this._merc && unit.id === this._merc.mercId) {
          if (this._merc.classId === 0 && unit.classId > 0) {
            this._merc.classId = unit.classId
          }
          for (const [statId, val] of this._merc.stats) {
            if (!unit.stats.has(statId)) {
              unit.stats.set(statId, val)
            }
          }
          this._merc.lifePct = unit.lifePct
          this._merc.lifePctScale = 128
          syncMercStat6FromLifePct(this, unit, unit.lifePct, 128)
          if (unit.lifePct <= 0 || unit.mode === 0 || unit.mode === 12) {
            this._merc.isDead = true
          } else {
            this._merc.isDead = false
            this._merc.reviveCost = 0
          }
          if (!this._pets.has(unit.id)) {
            this._pets.set(unit.id, {
              unitId: unit.id,
              petType: 7,
              classId: unit.classId,
              ownerId: this._merc.ownerId || this.selfId,
              lifePct: unit.lifePct,
              lifePctScale: 128,
              isDead: this._merc.isDead,
            })
          }
        }
        const pet = this._pets.get(unit.id)
        if (pet) {
          if (pet.classId === 0 && unit.classId > 0) {
            ;(pet as { classId: number }).classId = unit.classId
          }
          pet.lifePct = unit.lifePct
          pet.lifePctScale = 128
          if (unit.lifePct <= 0 || unit.mode === 0 || unit.mode === 12) {
            pet.isDead = true
          } else {
            pet.isDead = false
          }
          // S2C 0x7A SummonAction roster (D2Client pet list 0x6FBCC4D4): pPet->dwOwnerId.
          unit.ownerType = 'player'
          unit.ownerId = pet.ownerId
        }
        if (existed && (prevMode === 0 || prevMode === 12) && !unit.dead && unit.lifePct > 0) {
          clearRevivedCorpseMarks113c(unit)
        }
      }

      const isSelfPlayer =
        unit.unitType === 'player' &&
        (this.selfId !== 0 ? unit.id === this.selfId : ev.isSelf === true)

      if (isSelfPlayer) {
        if (this.selfId === 0 && ev.isSelf === true) {
          this.selfId = unit.id
          this._self.unitId = unit.id
        }
        if (unit.name) {
          this._self.name = unit.name
        }
        if (unit.classId >= 0 && unit.classId <= 6) {
          this._self.charClass = unit.classId as CharClassId
        }
        if (unit.x !== 0 || unit.y !== 0) {
          this._self.x = unit.x
          this._self.y = unit.y
          this._self.targetX = unit.x
          this._self.targetY = unit.y
        }
        if (unit.mode === 0 || unit.mode === 17) {
          this._isSelfDead = true
          this._self.isDead = true
        } else {
          this._isSelfDead = false
          this._self.isDead = false
        }
        this._self.mode = unit.mode
        this._self.moving = unit.mode === 2 || unit.mode === 3 || unit.mode === 6
        this.reconcileOwnMercOwnerAndPosition(this._self.x, this._self.y)
      }
      if (unit.unitType === 'player') {
        this.syncPlayerSetBonusStates(unit.id)
        const existingRoster = this._party.get(unit.id)
        if (existingRoster) {
          if (!existingRoster.charName && unit.name) {
            existingRoster.charName = unit.name
          }
          if (existingRoster.charClass === undefined && unit.classId >= 0 && unit.classId <= 6) {
            existingRoster.charClass = unit.classId
          }
          const statLvl = unit.stats.get(12)
          if (existingRoster.charLevel === undefined && statLvl !== undefined && statLvl > 0) {
            existingRoster.charLevel = statLvl
          }
          if (
            (existingRoster.areaId === undefined || existingRoster.areaId === 0) &&
            (unit.x !== 0 || unit.y !== 0)
          ) {
            const unitArea = this.resolveAreaFromRevealedRooms(unit.x, unit.y) || this.areaId
            if (unitArea > 0) {
              existingRoster.areaId = unitArea
              existingRoster.levelId = unitArea
            }
          }
        }
      }
      break
    }

    case 'UnitRemove': {
      const uId = Number(ev.id ?? ev.unitId ?? (ev as any).unit?.id ?? 0)
      const uTypeRaw = ev.unitType ?? (ev as any).unit?.unitType ?? 0
      const typeName = unitTypeFromId(uTypeRaw)
      const key = makeUnitKey(uTypeRaw, uId)
      const removedUnit = this._units.get(key)
      // D2Client.dll 0x6FB5CA40 (Packet 0x0A RemoveGroundUnit):
      // When bUnitType == 1 (UNIT_MONSTER), walks g_pRosterPetList (0x6FBCC4D4) and immediately
      // returns without removing the local player's living mercenary (dwPetType == 7).
      if (typeName === 'monster' && this.isOwnMercUnitId(uId) && !removedUnit?.dead) {
        break
      }
      const removedMonsterClassId =
        typeName === 'monster' ? (removedUnit?.classId ?? (ev as any).classId) : undefined
      if (typeName === 'item') {
        this._containers.removeGroundItemById(uId)
      }
      if (typeName === 'player' && uId !== 0 && uId !== this.selfId) {
        this._containers.removePlayerEquipment(uId)
        this._playerPathUnits.delete(uId)
        this._setBonusStatesByPlayerId.delete(uId)
      }
      if (typeName === 'monster') {
        if (uId !== 0 && this._npcInteraction.unitType !== 2 && this._npcInteraction.npcId === uId) {
          this.npcMotion.setNpcInteractionLock(uId, false)
          this._containers.clearShop()
          this._pendingWantsInteractUnitIds.delete(uId)
          this._npcInteraction = {
            ...this._npcInteraction,
            npcId: null,
            infoNpcId: null,
            unitType: undefined,
            window: 'none',
            activeWindow: 'none',
            npcInfoRaw: undefined,
            npcTalkRaw: undefined,
            messages: undefined,
            allMessages: undefined,
            hadWantsInteract: undefined,
          }
        }
        this._monsters.delete(uId)
        this.npcMotion.removeMonster(uId)
        // D2Client.dll 0x6FB5CA40 (S2C 0x0A RemoveGroundUnit) unlinks the world unit from
        // g_pClientUnitTable[1] when its room unloads, but NEVER deletes entries from
        // g_pRosterPetList (0x6FBCC4D4, this._pets); server roster pets are removed exclusively
        // by S2C 0x7A SummonAction (action = 0, 0x6FB5C720 -> 0x6FAD1840). Only synthetic
        // client-only summons (uId >= 900000) are cleaned up here.
        if (uId >= 900000) {
          this._pets.delete(uId)
        }
      }
      if (typeName === 'object') {
        if (uId !== 0 && this._npcInteraction.unitType === 2 && this._npcInteraction.npcId === uId) {
          this.clearObjectNpcInteraction(uId)
        }
        if (removedUnit?.classId === 267 && this._npcInteraction.stashOpen) {
          this._npcInteraction = { ...this._npcInteraction, stashOpen: false }
        }
        this.clearObjectCollisionFootprint(key)
      }
      this._units.delete(key)
      this._portals.delete(uId)
      if (removedMonsterClassId !== undefined && isTownNpcHcIdx(removedMonsterClassId)) {
        this.reconcileNpcPlaceholderObjects(removedMonsterClassId)
      }
      break
    }

    case 'UnitMove': {
      const evAny = ev as any
      const uId = Number(ev.id ?? evAny.unitId ?? evAny.unit?.id ?? 0)
      const uType = ev.unitType ?? evAny.unit?.unitType
      const unit = this.ensureWorldOrGroundUnit(uType, uId)
      if (!unit) break
      if (unit.unitType === 'monster') {
        this._monsters.set(unit.id, unit)
      }
      if (unit.dead && unit.unitType !== 'monster') {
        break
      }
      const wasDead = unit.dead
      if (typeof evAny.lifePct === 'number' && evAny.lifePct > 0) {
        unit.lifePct = evAny.lifePct
      }
      const now = this.resolveEventNowMs(nowMs)
      const moveMode = ev.mode ?? evAny.moveMode ?? 'walk'
      const preserveActiveCast =
        moveMode === 'stop' &&
        unit.castState !== undefined &&
        now < unit.castState.untilMs &&
        (!unit.castState.missileSpawned || now - unit.castState.startedAtMs <= 250)
      if (!preserveActiveCast) {
        this.clearUnitCastState(unit)
      }

      if (unit.unitType === 'monster') {
        if (unit.x === 0 && unit.y === 0) {
          if (ev.from && (ev.from.x !== 0 || ev.from.y !== 0)) {
            unit.x = ev.from.x
            unit.y = ev.from.y
          } else if (ev.npc?.driftCheckAt && (ev.npc.driftCheckAt.x !== 0 || ev.npc.driftCheckAt.y !== 0)) {
            unit.x = ev.npc.driftCheckAt.x
            unit.y = ev.npc.driftCheckAt.y
          } else if (ev.to.x !== 0 || ev.to.y !== 0) {
            unit.x = ev.to.x
            unit.y = ev.to.y
          } else if (
            (this.isOwnMercUnitId(uId) || this.isOwnPetUnitId(uId)) &&
            (this._self.x !== 0 || this._self.y !== 0)
          ) {
            unit.x = this._self.x
            unit.y = this._self.y
          }
        }
        const existingNpc = this.npcMotion.getUnit(uId)
        if (!existingNpc) {
          this.npcMotion.spawnMonster({
            unitId: unit.id,
            classId: unit.classId,
            x: unit.x,
            y: unit.y,
            mode: unit.mode,
            direction: unit.direction,
            lifePct: unit.lifePct,
            isDead: unit.dead,
            ...(unit.velocityPercent !== undefined ? { stat67: unit.velocityPercent } : {}),
          })
        } else if (
          existingNpc.pDynamicPath &&
          PATH_GetXPosition(existingNpc.pDynamicPath) === 0 &&
          PATH_GetYPosition(existingNpc.pDynamicPath) === 0 &&
          (unit.x !== 0 || unit.y !== 0)
        ) {
          this.npcMotion.reassignMonster(uId, unit.x, unit.y)
        }
        if (ev.velocityPercent !== undefined) {
          unit.velocityPercent = ev.velocityPercent
        }
        if (ev.pathType !== undefined) {
          unit.pathType = ev.pathType
        }
        unit.targetUnit = moveMode === 'stop' ? undefined : ev.target
        let npcPayload: NpcCommandPayload113c
        if (ev.npc !== undefined) {
          npcPayload = ev.npc
        } else if (moveMode === 'stop') {
          const stopX = Math.round(ev.to.x)
          const stopY = Math.round(ev.to.y)
          npcPayload = {
            opcode: 0x6d,
            cmd: 0x07,
            s: [stopX, stopY, unit.lifePct || 128, 2, 0, 4, 0],
            driftCheckAt: { x: stopX, y: stopY },
          }
        } else if (ev.target !== undefined) {
          const targetTypeId =
            ev.target.unitType === 'player' || ev.target.unitType === 0 ? 0 : 1
          npcPayload = {
            opcode: 0x68,
            cmd: moveMode === 'run' ? 0x18 : 0x00,
            s: [
              targetTypeId,
              ev.target.id,
              1,
              ev.pathType ?? PATHTYPE_TOWARD,
              ev.velocityPercent ?? 0,
              14,
              0,
            ],
            driftCheckAt:
              ev.from && (ev.from.x !== 0 || ev.from.y !== 0)
                ? { x: Math.round(ev.from.x), y: Math.round(ev.from.y) }
                : null,
          }
        } else if (moveMode === 'knockback') {
          const kbX = Math.round(ev.to.x)
          const kbY = Math.round(ev.to.y)
          const kbDist = Math.max(1, Math.round(Math.hypot(kbX - unit.x, kbY - unit.y)))
          npcPayload = {
            opcode: 0x67,
            cmd: 0x14,
            s: [kbX, kbY, kbDist, PATHTYPE_KNOCKBACK_CLIENT, 0, 128, 0],
            driftCheckAt: null,
          }
        } else {
          npcPayload = {
            opcode: 0x67,
            cmd: moveMode === 'run' ? 0x17 : 0x01,
            s: [
              Math.round(ev.to.x),
              Math.round(ev.to.y),
              1,
              ev.pathType ?? PATHTYPE_TOWARD,
              ev.velocityPercent ?? 0,
              14,
              0,
            ],
            driftCheckAt:
              ev.from && (ev.from.x !== 0 || ev.from.y !== 0)
                ? { x: Math.round(ev.from.x), y: Math.round(ev.from.y) }
                : null,
          }
        }
        // #119 Sanctuary (Issue #1277): when an undead monster is knocked back (cmd === 0x14 or moveMode === 'knockback')
        // while Sanctuary (state 47/100) is active on the monster or a nearby player, ensure tgtoverlay='cast_undead' (#79)
        // and cltmissilea='sanctuarybolt' are attached on the pulse frame.
        if ((moveMode === 'knockback' || npcPayload.cmd === 0x14) && isMonsterUndead113c(unit)) {
          let sanctuaryOwnerId: number | undefined
          if (unit.states.has(47) || unit.states.has(100) || this._self.states.has(47)) {
            sanctuaryOwnerId = this.selfId || 1
          } else {
            for (const u of this._units.values()) {
              if (u.unitType === 'player' && (u.states.has(47) || u.states.has(100))) {
                sanctuaryOwnerId = u.id
                break
              }
            }
          }
          if (sanctuaryOwnerId !== undefined) {
            if (!unit.overlays.some((o) => o.token === SANCTUARY_AURA_113C.tgtOverlay)) {
              this.attachUnitOverlay(unit, SANCTUARY_AURA_113C.tgtOverlay, false)
            }
            const hasBolt = Array.from(this._units.values()).some(
              (u) =>
                u.unitType === 'missile' &&
                u.missileKey === SANCTUARY_AURA_113C.cltMissileA &&
                Math.hypot(u.x - unit.x, u.y - unit.y) <= 2,
            )
            if (!hasBolt) {
              const bolt = this.spawnMissileByKey(
                SANCTUARY_AURA_113C.cltMissileA,
                unit.x,
                unit.y,
                unit.x,
                unit.y,
                {
                  ownerType: 'player',
                  ownerId: sanctuaryOwnerId,
                  sourceSkillId: SANCTUARY_AURA_113C.skillId,
                  skillLevel: 1,
                },
              )
              bolt.vx = 0
              bolt.vy = 0
            }
          }
        }
        const prevMode = unit.mode
        this.npcMotion.applyCommandForUnit(uId, npcPayload)
        const moveLifeByte =
          typeof evAny.lifePct === 'number' && evAny.lifePct >= 0
            ? evAny.lifePct
            : npcPayload.opcode === 0x6d && typeof npcPayload.s[2] === 'number' && npcPayload.s[2] >= 0
              ? npcPayload.s[2]
              : undefined
        if (moveLifeByte !== undefined && !unit.dead) {
          unit.lifePct = moveLifeByte
          if (this._merc && unit.id === this._merc.mercId) {
            this._merc.lifePct = moveLifeByte
            this._merc.lifePctScale = 128
            if (moveLifeByte > 0) {
              this._merc.isDead = false
            }
            syncMercStat6FromLifePct(this, unit, moveLifeByte, 128)
          }
          const movePet = this._pets.get(unit.id)
          if (movePet) {
            movePet.lifePct = moveLifeByte
            movePet.lifePctScale = 128
            if (moveLifeByte > 0) {
              movePet.isDead = false
            }
          }
        }
        if (wasDead && !unit.dead) {
          unit.deathFxTriggered = false
          this._deadSoundUnitIds.delete(unit.id)
          clearRevivedCorpseMarks113c(unit)
          if (unit.lifePct <= 0) {
            unit.lifePct =
              typeof evAny.lifePct === 'number' && evAny.lifePct > 0
                ? evAny.lifePct
                : npcPayload.opcode === 0x6d && npcPayload.s[2] && npcPayload.s[2] > 0
                  ? npcPayload.s[2]
                  : 128
          }
          const existingPet = this._pets.get(unit.id)
          if (existingPet) {
            existingPet.isDead = false
            if (existingPet.lifePct <= 0) {
              existingPet.lifePct = unit.lifePct
              existingPet.lifePctScale = 128
            }
          }
        }
        if (preserveActiveCast) {
          unit.mode = prevMode
          const npcUnit = this.npcMotion.getUnit(uId)
          if (npcUnit) {
            D2COMMON_10212_PATH_SetMoveFlags(npcUnit, 0)
            if (npcUnit.pDynamicPath) {
              D2Common_10153(npcUnit.pDynamicPath)
            }
            this.npcMotion.changeAnimMode0x6FADA6C0(npcUnit, prevMode)
            npcUnit.lastAnimRestarted = false
            unit.moving = false
            unit.moveMode = 'stop'
          }
          if (unit.castState) {
            unit.animStartedAtMs = unit.castState.startedAtMs
            unit.modeStartedAtMs = unit.castState.startedAtMs
          }
        }
        break
      }

      const isSelfPlayer =
        unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)
      if (
        isSelfPlayer &&
        unit.x === 0 &&
        unit.y === 0 &&
        (this._self.x !== 0 || this._self.y !== 0)
      ) {
        unit.x = this._self.x
        unit.y = this._self.y
      }
      const isSelfActiveTargetChase =
        isSelfPlayer &&
        moveMode !== 'stop' &&
        (this._pendingMeleeAttack !== null || ev.target !== undefined)
      const isRemotePlayer = unit.unitType === 'player' && !isSelfPlayer
      const snapLimit =
        moveMode === 'knockback'
          ? 10
          : isRemotePlayer
            ? 15
            : moveMode === 'run'
              ? 7
              : 5

      if (ev.from && (ev.from.x !== 0 || ev.from.y !== 0)) {
        if (unit.x === 0 && unit.y === 0) {
          unit.x = ev.from.x
          unit.y = ev.from.y
        } else {
          const maxDelta = Math.max(Math.abs(ev.from.x - unit.x), Math.abs(ev.from.y - unit.y))
          if (maxDelta > snapLimit) {
            unit.x = ev.from.x
            unit.y = ev.from.y
          }
        }
      } else if (moveMode === 'stop' || (unit.x === 0 && unit.y === 0)) {
        if (ev.to.x !== 0 || ev.to.y !== 0) {
          unit.x = ev.to.x
          unit.y = ev.to.y
        }
      }
      let targetX = ev.to.x
      let targetY = ev.to.y
      if (
        ev.target &&
        ((targetX === 0 && targetY === 0) ||
          (ev.from !== undefined && targetX === ev.from.x && targetY === ev.from.y))
      ) {
        const targetUnit = this.getUnit(ev.target.unitType, ev.target.id)
        if (targetUnit && (targetUnit.x !== 0 || targetUnit.y !== 0)) {
          targetX = targetUnit.x
          targetY = targetUnit.y
        } else if (
          unitTypeFromId(ev.target.unitType) === 'player' &&
          (ev.target.id === this.selfId || this.selfId === 0) &&
          (this._self.x !== 0 || this._self.y !== 0)
        ) {
          targetX = this._self.x
          targetY = this._self.y
        }
      }
      const effectiveMoveMode =
        isSelfPlayer && moveMode === 'run' && isSelfStaminaExhausted(this) ? 'walk' : moveMode
      unit.targetX = targetX
      unit.targetY = targetY
      unit.targetUnit = effectiveMoveMode === 'stop' ? undefined : ev.target
      unit.moveMode = effectiveMoveMode
      unit.moving =
        effectiveMoveMode !== 'stop' &&
        (Math.hypot(targetX - unit.x, targetY - unit.y) > 1e-4 || ev.target !== undefined)
      if (ev.velocityPercent !== undefined) {
        unit.velocityPercent = ev.velocityPercent
      } else if (unit.unitType === 'player') {
        unit.velocityPercent = undefined
      }
      if (ev.pathType !== undefined) {
        unit.pathType = ev.pathType
      }
      if (unit.moveMode !== 'stop' || Math.hypot(targetX - unit.x, targetY - unit.y) > 0.15) {
        if (targetX !== 0 || targetY !== 0) {
          unit.faceToward(targetX, targetY, false)
        }
      }
      if (unit.unitType === 'player' && unit.mode !== 0 && unit.mode !== 17) {
        const inTown = isTownLevel(this.areaId)
        if (effectiveMoveMode === 'stop') {
          if (!preserveActiveCast) {
            unit.mode = inTown ? 5 : 1
          }
        } else if (effectiveMoveMode === 'run') {
          unit.mode = 3
        } else if (effectiveMoveMode === 'knockback') {
          unit.mode = 19
        } else {
          unit.mode = inTown ? 6 : 2
        }
        if (effectiveMoveMode !== 'stop') {
          unit.castState = undefined
        }
        if (unit.mode === 2 || unit.mode === 3 || unit.mode === 6) {
          const speedInfo = this.resolvePlayerAnimSpeed(unit.mode, unit.id)
          unit.modeDurationMs = undefined
          unit.modeUntilMs = undefined
          unit.animStepSpeed256 = speedInfo.stepSpeed256
          unit.animEffRate = speedInfo.effRate
          if (unit.id === this.selfId || this.selfId === 0) {
            this._selfLocomotionAnimSpeed256 = speedInfo.stepSpeed256
          }
        }
      }
      if (isSelfPlayer) {
        if (isSelfActiveTargetChase && (unit.x !== 0 || unit.y !== 0)) {
          this._self.x = unit.x
          this._self.y = unit.y
        } else if (ev.from && (ev.from.x !== 0 || ev.from.y !== 0)) {
          this._self.x = ev.from.x
          this._self.y = ev.from.y
        } else if (ev.to.x !== 0 || ev.to.y !== 0) {
          this._self.x = ev.to.x
          this._self.y = ev.to.y
        }
        if (targetX !== 0 || targetY !== 0) {
          this._self.targetX = targetX
          this._self.targetY = targetY
        }
        this._self.mode = unit.mode
        this._self.moving =
          moveMode !== 'stop' && (unit.mode === 2 || unit.mode === 3 || unit.mode === 6)
      }
      break
    }

    case 'UnitReassign': {
      const unit = this.ensureWorldOrGroundUnit(ev.unitType, ev.id)
      if (!unit) break
      const now = this.resolveEventNowMs(nowMs)
      const isSelfPlayer =
        unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)
      const wasDead = isSelfPlayer && (this._isSelfDead || this._self.isDead)
      const roomAreaId = isSelfPlayer ? this.resolveAreaFromRevealedRooms(ev.at.x, ev.at.y) : 0
      const targetAreaId = roomAreaId > 0 ? roomAreaId : (ev.areaId ?? this.areaId)
      if (isSelfPlayer && targetAreaId > 0 && targetAreaId !== this.areaId) {
        this.areaId = targetAreaId
        this.syncPlayerTownModes()
      }
      // 1.13c D2Client.dll 0x6FB5F640 -> 0x6FB57E20:
      // S2C 0x15 ReassignPlayer repositions the unit's DynamicPath and drops its walk/run path,
      // but does NOT clear an active cast/skill animation (mode 10 PLRMODE_CAST for Teleport #54,
      // mode 18 PLRMODE_SEQUENCE for Dragon Flight #275, etc.). Clearing castState on the action
      // frame prematurely unlocked the cast backswing across all 7 classes.
      const preserveActiveCast =
        unit.unitType === 'player' &&
        !wasDead &&
        !unit.dead &&
        unit.mode !== 0 &&
        unit.mode !== 17 &&
        unit.castState !== undefined &&
        now < unit.castState.untilMs &&
        (!isTownLevel(targetAreaId) || isSkillAllowedInTown(unit.castState.skillId))
      if (!preserveActiveCast) {
        this.clearUnitCastState(unit)
      }
      if (unit.unitType === 'monster') {
        this._monsters.set(unit.id, unit)
        if (unit.dead || unit.mode === 0 || unit.mode === 12) {
          // D2Client.dll 0x6FB57E20: early-exits on dead monsters (dwFlags & 0x10000 or mode 0/12).
          break
        }
        unit.x = ev.at.x
        unit.y = ev.at.y
        unit.targetX = ev.at.x
        unit.targetY = ev.at.y
        unit.moving = false
        unit.moveMode = 'stop'
        unit.targetUnit = undefined
        const pet = this._pets.get(unit.id)
        if (pet) {
          if (pet.classId === 0 && unit.classId > 0) {
            ;(pet as { classId: number }).classId = unit.classId
          }
          unit.ownerType = 'player'
          unit.ownerId = pet.ownerId || this.selfId
        }
        if (!this.npcMotion.getUnit(ev.id)) {
          this.npcMotion.spawnMonster({
            unitId: unit.id,
            classId: unit.classId,
            x: ev.at.x,
            y: ev.at.y,
            mode: unit.mode,
            direction: unit.direction,
            lifePct: unit.lifePct,
            isDead: false,
          })
        } else {
          this.npcMotion.reassignMonster(ev.id, ev.at.x, ev.at.y)
        }
        break
      }
      unit.x = ev.at.x
      unit.y = ev.at.y
      unit.targetX = ev.at.x
      unit.targetY = ev.at.y
      unit.moving = false
      unit.moveMode = 'stop'
      unit.targetUnit = undefined
      if (isSelfPlayer) {
        if (this.selfId === 0) {
          this.selfId = unit.id
          this._self.unitId = unit.id
        }
        this._self.x = ev.at.x
        this._self.y = ev.at.y
        this._self.targetX = ev.at.x
        this._self.targetY = ev.at.y
        if (targetAreaId > 0 && targetAreaId !== this.areaId) {
          this.areaId = targetAreaId
        }
        this._isSelfDead = false
        this._self.isDead = false
        if (unit.lifePct <= 0) {
          unit.lifePct =
            this._self.maxLife > 0 && this._self.life > 0
              ? Math.max(1, Math.round((this._self.life / this._self.maxLife) * 128))
              : 128
        }
        if (
          !preserveActiveCast &&
          (wasDead ||
            isTownLevel(this.areaId) ||
            unit.mode === 0 ||
            unit.mode === 17 ||
            unit.mode === 10 ||
            unit.mode === 1 ||
            unit.mode === 5 ||
            unit.mode === 2 ||
            unit.mode === 3 ||
            unit.mode === 6)
        ) {
          unit.mode = isTownLevel(this.areaId) ? 5 : 1
        }
        this._self.mode = unit.mode
        this._self.moving = false
        this.syncPlayerTownModes()
        this.reconcileOwnMercOwnerAndPosition(this._self.x, this._self.y)
      }
      break
    }

    case 'UnitOverlay': {
      // S2C 0x11, D2Client 0x6FB5DAA0: find the unit in the client unit table of wire type `rawUnitType`
      // (0x6fb5dab8 → 0x6FB54E20). The server sends type 6 / id 0xFFFFFFFF when it has no unit; no client
      // table exists for it, so the lookup fails and the packet is ignored, as is any unknown unit (0x6fb5dac7).
      if (!Number.isInteger(ev.rawUnitType) || ev.rawUnitType < 0 || ev.rawUnitType > 5) break
      const unit = this.getUnit(ev.rawUnitType as UnitTypeId, ev.id)
      if (!unit) break
      this.attachServerOverlay(unit, ev.overlayIndex)
      break
    }

    case 'UnitHoverTextClear':
    case 'UnitOverhead' as any: {
      // S2C 0x76, D2Client 0x6FB5D370: look the unit up in the table of wire type `rawUnitType`; an unknown
      // unit (or type 6 / id 0xFFFFFFFF) is ignored. Only the overhead hover message (unit+0xA4) is freed —
      // mode, HP and ISDEAD are untouched, so a dead unit stays dead (Refs #916).
      const rawUnitType = Number(ev.rawUnitType ?? (ev as any).unitType ?? -1)
      const rawUnitId = Number(ev.id ?? (ev as any).unitId ?? 0)
      if (!Number.isInteger(rawUnitType) || rawUnitType < 0 || rawUnitType > 5) break
      const unit = this.getUnit(rawUnitType as UnitTypeId, rawUnitId)
      if (!unit) break
      unit.overheadText = undefined
      unit.overheadExpireMs = undefined
      unit.overheadColor = undefined
      ;(unit as { _overheadElapsedMs?: number | undefined })._overheadElapsedMs = undefined
      break
    }

    case 'UnitMode': {
      const uId = Number(ev.id ?? ev.unitId ?? (ev as any).unit?.id ?? 0)
      const uType: UnitType = ev.unitType ?? (ev as any).unit?.unitType ?? 1
      if (ev.eventCode !== undefined) {
        // S2C 0x0E (D2Client 0x6fb5bc60 -> 0x6fb5c630): look up the existing unit via
        // D2Client_FindUnit (0x6fb59600); if not found, drop the packet. Otherwise append
        // to the per-unit FIFO packet queue (unit+0xd8) to be drained at the end of the
        // unit's 25 Hz tick (0x6fadb1e0 -> 0x6fb5bc20).
        const unit = this.getUnit(uType, uId)
        if (!unit) break
        unit.queuedPackets.push(ev)
        break
      }
      const existedBefore = this.getUnit(uType, uId) !== undefined
      const unit = this.ensureWorldOrGroundUnit(uType, uId)
      if (!unit) break
      if (!existedBefore && unit.unitType === 'monster' && ev.mode === 12) {
        unit.dead = true
        unit.deathFxTriggered = true
        if (unit.id > 0) {
          this._deadSoundUnitIds.add(unit.id)
        }
      }
      this.applyUnitModeImmediate(unit, ev, nowMs)
      break
    }

    case 'Interact': {
      const actorType: UnitType = ev.actor?.unitType ?? ev.unit?.unitType ?? ev.unitType ?? 0
      const actorId = Number(ev.actor?.id ?? ev.unit?.id ?? ev.unitId ?? (this.selfId || 1))
      const unit = this.ensureWorldOrGroundUnit(actorType, actorId)
      if (!unit || unit.dead) break
      let targetX = unit.x
      let targetY = unit.y
      if (ev.target && typeof ev.target === 'object' && 'x' in ev.target) {
        targetX = Number(ev.target.x ?? unit.x)
        targetY = Number(ev.target.y ?? unit.y)
      } else if (ev.target && typeof ev.target === 'object' && 'unitType' in ev.target) {
        unit.targetUnit = ev.target
        const targetUnit = this.getUnit(ev.target.unitType, ev.target.id)
        if (targetUnit) {
          targetX = targetUnit.x
          targetY = targetUnit.y
        }
      } else if (ev.x !== undefined && ev.y !== undefined) {
        targetX = Number(ev.x)
        targetY = Number(ev.y)
      }
      unit.moveMode = 'stop'
      unit.moving = false
      unit.faceToward(targetX, targetY, false)
      if (unit.unitType === 'monster') {
        const npcUnit = this.npcMotion.getUnit(unit.id)
        if (npcUnit?.pDynamicPath) {
          D2COMMON_10160_PathUpdateDirection(npcUnit.pDynamicPath, unit.targetDirection)
        }
      }
      break
    }

    case 'SkillCast': {
      const casterType: UnitType =
        ev.caster?.unitType ??
        (ev.kind === 'monsterAttack' ? 1 : (ev.unitType ?? ev.attackerType ?? 0))
      const casterId = Number(
        ev.caster?.id ?? ev.monsterId ?? ev.unitId ?? ev.attackerId ?? 0,
      )
      const skillId = Number(ev.skillId ?? ev.skill ?? ev.attackType ?? 0)
      const level = Number(ev.level ?? ev.skillLevel ?? 1) || 1

      // 0x73 CreateMissile: caster.unitType === 3 ('missile')
      if (unitTypeFromId(casterType) === 'missile') {
        const missileClassId = skillId
        const missileKey = MISSILE_CLASS_ID_TO_KEY[missileClassId]
        if (!missileKey) {
          throw new Error(`Unknown missile classId ${missileClassId} in Missiles.txt`)
        }
        const ownerType = ev.owner ? unitTypeFromId(ev.owner.unitType) : 'player'
        const ownerId = ev.owner?.id ?? 0
        const ownerUnit = ev.owner ? this.getUnit(ev.owner.unitType, ev.owner.id) : undefined
        const startX = ev.at ? Number(ev.at.x) : (ownerUnit?.x ?? this._self.x)
        const startY = ev.at ? Number(ev.at.y) : (ownerUnit?.y ?? this._self.y)
        let targetX = startX
        let targetY = startY
        if (ev.target && typeof ev.target === 'object' && 'x' in ev.target) {
          targetX = Number(ev.target.x ?? startX)
          targetY = Number(ev.target.y ?? startY)
        }
        this.spawnMissileByKey(missileKey, startX, startY, targetX, targetY, {
          id: casterId > 0 ? casterId : undefined,
          classId: missileClassId,
          ownerType,
          ownerId,
          skillLevel: level,
          ...(typeof (ev as { pierce?: unknown }).pierce === 'number'
            ? { pierceRemaining: Number((ev as { pierce?: number }).pierce) }
            : {}),
        })
        break
      }

      let unit = this.getUnit(casterType, casterId)
      if (!unit && unitTypeFromId(casterType) === 'player' && (casterId === this.selfId || this.selfId === 0)) {
        unit = this.ensureUnit('player', casterId || this.selfId || 1)
      }
      if (!unit || unit.dead) break

      const now = this.resolveEventNowMs(nowMs)
      if (unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)) {
        this._pendingMeleeAttack = null
      }
      const timeSinceLocalCast = now - this._lastLocalCastAtMs
      const isSelfEcho =
        unit.unitType === 'player' &&
        (unit.id === this.selfId || this.selfId === 0) &&
        skillId === this._lastLocalCastSkillId &&
        timeSinceLocalCast >= 0 &&
        timeSinceLocalCast <= 1000

      let targetX = unit.x
      let targetY = unit.y
      if (ev.target && typeof ev.target === 'object' && 'x' in ev.target) {
        if (!isSelfEcho) {
          unit.targetUnit = undefined
        }
        targetX = Number(ev.target.x ?? unit.x)
        targetY = Number(ev.target.y ?? unit.y)
      } else if (ev.targetX !== undefined && ev.targetY !== undefined) {
        if (!isSelfEcho) {
          unit.targetUnit = undefined
        }
        targetX = Number(ev.targetX)
        targetY = Number(ev.targetY)
      } else {
        const targetRef: UnitRef | undefined =
          ev.target && typeof ev.target === 'object' && 'unitType' in ev.target
            ? ev.target
            : ev.targetId !== undefined
              ? { unitType: ev.targetType ?? 1, id: Number(ev.targetId) }
              : undefined
        if (targetRef) {
          unit.targetUnit = targetRef
          const targetUnit = this.getUnit(targetRef.unitType, targetRef.id)
          if (targetUnit) {
            targetX = targetUnit.x
            targetY = targetUnit.y
          } else if (unitTypeFromId(targetRef.unitType) === 'player' && targetRef.id === this.selfId) {
            targetX = this._self.x
            targetY = this._self.y
          }
        }
      }
      if (
        (skillId === 41 || skillId === 230) &&
        unit.castState &&
        unit.castState.skillId === skillId &&
        now < unit.castState.untilMs
      ) {
        this._lastLocalCastSkillId = -1
        unit.castState.targetX = targetX
        unit.castState.targetY = targetY
        unit.castState.untilMs = Math.max(unit.castState.untilMs, now + 240)
        unit.castState.durationMs = Math.max(
          unit.castState.durationMs ?? 0,
          (unit.castState.elapsedMs ?? 0) + 240,
        )
        unit.modeUntilMs = unit.castState.untilMs
        unit.modeDurationMs = unit.castState.durationMs
        unit.faceToward(targetX, targetY, false)
        if (unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)) {
          this._self.castState = unit.castState
        }
      } else if (isSelfEcho) {
        this._lastLocalCastSkillId = -1
        if (unit.castState && unit.castState.skillId === skillId && now < unit.castState.untilMs) {
          unit.faceToward(targetX, targetY, false)
        } else {
          this.applySkillCastToUnit(unit, skillId, targetX, targetY, level, false, nowMs)
        }
      } else {
        this.applySkillCastToUnit(unit, skillId, targetX, targetY, level, true, nowMs)
      }
      break
    }

    case 'UnloadAct':
    case 'ProtocolSync':
    case 'MonsterSpecial':
      break

    case 'CreateMissile': {
      const missileClassId = Number(ev.missileClassId ?? 0)
      const missileKey = MISSILE_CLASS_ID_TO_KEY[missileClassId] ?? `missile_${missileClassId}`
      const ownerRef = ev.owner
      const ownerType: UnitType =
        ev.ownerType !== undefined
          ? unitTypeFromId(ev.ownerType)
          : ownerRef
            ? unitTypeFromId(ownerRef.unitType)
            : 'player'
      const ownerId =
        ev.ownerId !== undefined
          ? Number(ev.ownerId)
          : ownerRef
            ? Number(ownerRef.id)
            : this.selfId
      const ownerUnit = this.getUnit(ownerType, ownerId)
      const startX = ev.at ? Number(ev.at.x) : (ownerUnit?.x ?? this._self.x)
      const startY = ev.at ? Number(ev.at.y) : (ownerUnit?.y ?? this._self.y)
      const targetX = ev.target ? Number(ev.target.x ?? startX) : startX
      const targetY = ev.target ? Number(ev.target.y ?? startY) : startY
      const level = Math.max(1, Number(ev.level ?? 1))
      this.spawnMissileByKey(missileKey, startX, startY, targetX, targetY, {
        classId: missileClassId,
        ownerType,
        ownerId,
        skillLevel: level,
      })
      break
    }

    case 'UnitSkillEvent': {
      // S2C 0xA3 handler 0x6fb5efb0 -> 0x6fb51b10 -> Skills.txt cltprgfunc1:
      // For Thunder Storm (skill 57, cltprgfunc1 = 84 -> 0x6fb24350), when both caster and target
      // are known units, spawn client missile `thunderstorm1` at `(target.x, target.y)` with
      // initial velocity `(vx, vy, vz) = (0, 280, 0)` and `zDelta = -40` per tick (altitude 280,
      // verticalDescentPerTick 40, Range = 9 ticks), and attach `prgoverlay` `lightning` (`ShockHitSm`)
      // on the target unit (`0x6fb1b300`).
      const casterRawType = ev.caster.rawUnitType
      const targetRawType = ev.target.rawUnitType
      const casterUnit =
        Number.isInteger(casterRawType) && casterRawType >= 0 && casterRawType <= 5
          ? this.getUnit(casterRawType as UnitTypeId, ev.caster.id)
          : undefined
      const targetUnit =
        Number.isInteger(targetRawType) && targetRawType >= 0 && targetRawType <= 5
          ? this.getUnit(targetRawType as UnitTypeId, ev.target.id)
          : undefined
      if (
        casterUnit &&
        targetUnit &&
        unitSkillEventForcesLightning113c({
          skill: ev.skill,
          casterKnown: true,
          targetKnown: true,
        })
      ) {
        this.spawnMissileByKey(
          'thunderstorm1',
          targetUnit.x,
          targetUnit.y,
          targetUnit.x,
          targetUnit.y,
          {
            ownerType: casterUnit.unitType,
            ownerId: casterUnit.id,
            sourceSkillId: ev.skill,
            skillLevel: Math.max(1, ev.level),
            maxTicks: 9,
            altitude: 280,
            verticalDescentPerTick: 40,
          },
        )
        this.attachUnitOverlay(targetUnit, 'lightning', false)
      }
      break
    }

    case 'StatSet': {
      // 1.13c stat ids are 9-bit (ItemStatCost.txt). netproto still wraps some non-stat packets
      // (0x8000|op / 0x9000|op opaque envelopes) as pseudo StatSet events;
      // those must never enter a unit StatList.
      if (ev.stat < 0 || ev.stat > MAX_D2_STAT_ID) break
      this.invalidatePlayerLightCache()
      if (!ev.unit || (unitTypeFromId(ev.unit.unitType) === 'player' && (ev.unit.id === this.selfId || this.selfId === 0))) {
        this._self.applyStat(ev.stat, ev.value, ev.param ?? 0)
        // D2Client.dll 0x6fb5ee00 -> 0x6fb5eb10 (0x6fb5eb2a..0x6fb5eb47):
        // When STAT_HITPOINTS (6) has raw 8.8 value > 0 (`test eax, eax; jne`), revives from PLRMODE_DEAD (17)
        // (`dwMode = 5`, clears UNITFLAG_DEAD). StatSet never sets death when STAT_HITPOINTS or STAT_MAXHP updates.
        if (ev.stat === 6 && ev.value > 0) {
          this._isSelfDead = false
          this._self.isDead = false
        }
        clearZeroLifeDeathInTown(this)
        if (this.selfId !== 0) {
          const selfUnit = this._units.get(makeUnitKey('player', this.selfId))
          selfUnit?.stats.set(ev.stat, this._self.stats.get(ev.stat), ev.param ?? 0)
          if (selfUnit && ev.stat === 6 && ev.value > 0 && (selfUnit.mode === 0 || selfUnit.mode === 17)) {
            selfUnit.mode = isTownLevel(this.areaId) ? 5 : 1
            this._self.mode = selfUnit.mode
          }
          if (selfUnit && !this._self.isDead && this._self.life > 0 && selfUnit.lifePct <= 0) {
            selfUnit.lifePct =
              this._self.maxLife > 0
                ? Math.max(1, Math.round((this._self.life / this._self.maxLife) * 128))
                : 128
          }
        }
        if (ev.stat === 10 || ev.stat === 11) {
          downgradeSelfRunOnStaminaExhausted(this)
        }
      } else if (ev.unit && (ev.unit.unitType === 4 || unitTypeFromId(ev.unit.unitType) === 'item')) {
        const itemId = ev.unit.id
        const item =
          this._containers.allById.get(itemId) ??
          this._containers.inventory.get(itemId) ??
          this._containers.equipment.get(itemId) ??
          this._containers.cube.get(itemId) ??
          this._containers.stash.get(itemId)
        if (item) {
          // Only S2C 0x3E UpdateItemStats reaches here (D2Client.dll 0x6fb5e300): `ev.value` is the
          // stat value, never item flags. IFLAG_IDENTIFIED only changes via a full 0x9C/0x9D item
          // re-send; inferring it from stat bits made unidentified items render as identified (#1006).
          if (ev.stat >= 0 && ev.stat <= MAX_D2_STAT_ID) {
            const mutableStats = [...item.stats]
            const existingIdx = mutableStats.findIndex(
              (s) => s.statId === ev.stat && (ev.param === undefined || s.param === ev.param),
            )
            // D2Client.dll 0x6fb35990 -> 0x6fb32210: for stat 204 (item_charged_skill), 0x3E sends
            // only the updated 8-bit current charges in `ev.value` (while the item bitstream stores
            // `(maxCharges << 8) | curCharges`). Preserve the existing high-byte `maxCharges`.
            const nextValue =
              ev.stat === 204 && existingIdx >= 0
                ? ((mutableStats[existingIdx]!.value & 0xff00) | (ev.value & 0xff))
                : ev.value
            if (existingIdx >= 0) {
              mutableStats[existingIdx] = { statId: ev.stat, value: nextValue, param: ev.param ?? 0 }
            } else {
              mutableStats.push({ statId: ev.stat, value: nextValue, param: ev.param ?? 0 })
            }
            ;(item as any).stats = mutableStats
            if (ev.stat === 72) {
              ;(item as any).curDurability = ev.value
              ;(item as any).durability = ev.value
            } else if (ev.stat === 73) {
              ;(item as any).maxDurability = ev.value
            } else if (ev.stat === 70) {
              ;(item as any).quantity = ev.value
              // D2Client.dll 0x6fb35990: replenished stackable quantity (> 0) clears IFLAG_BROKEN
              if (ev.value > 0 && item.broken) {
                ;(item as any).broken = false
                ;(item as any).rawFlags = ((item.rawFlags ?? 0) & ~ITEM_FLAG_BROKEN) >>> 0
                if (typeof item.flags === 'number') {
                  ;(item as any).flags = (item.flags & ~ITEM_FLAG_BROKEN) >>> 0
                }
              }
            }
          }
          this._containers.revision++
          this._containers.hudRevision++
        }
      } else {
        const targetUnit = this.ensureUnit(ev.unit.unitType, ev.unit.id)
        targetUnit.stats.set(ev.stat, ev.value, ev.param ?? 0)
        if (this._merc && targetUnit.unitType === 'monster' && targetUnit.id === this._merc.mercId) {
          this._merc.stats.set(ev.stat, ev.value)
        }
        if (targetUnit.unitType === 'monster' && (ev.stat === 6 || ev.stat === 7)) {
          const rawHp = normalizeMonsterHpStatValue(
            targetUnit.stats.get(6) ??
              (this._merc && targetUnit.id === this._merc.mercId
                ? this._merc.stats.get(6)
                : undefined),
          )
          const rawMaxHp =
            normalizeMonsterHpStatValue(
              targetUnit.stats.get(7) ??
                (this._merc && targetUnit.id === this._merc.mercId
                  ? this._merc.stats.get(7)
                  : undefined),
            ) ??
            (this._merc && targetUnit.id === this._merc.mercId
              ? computeEffectiveMercenaryStats(this as unknown as ClientWorld)?.maxHp
              : undefined)
          if (rawHp !== undefined && rawMaxHp !== undefined && rawMaxHp > 0) {
            const life128 =
              rawHp <= 0
                ? 0
                : Math.min(128, Math.max(1, Math.round((rawHp * 128) / rawMaxHp)))
            targetUnit.lifePct = life128
            const motionUnit = this.npcMotion.getUnit(targetUnit.id)
            if (motionUnit) {
              motionUnit.lifeByte = life128
            }
            if (this._merc && targetUnit.id === this._merc.mercId) {
              this._merc.lifePct = life128
              this._merc.lifePctScale = 128
              this._merc.isDead = rawHp <= 0
            }
            const pet = this._pets.get(targetUnit.id)
            if (pet) {
              pet.lifePct = life128
              pet.lifePctScale = 128
              pet.isDead = rawHp <= 0
            }
          }
        }
      }
      break
    }

    case 'LifeMana': {
      const atX = ev.at?.x ?? 0
      const atY = ev.at?.y ?? 0
      const selfUnit = this.selfId !== 0 ? this._units.get(makeUnitKey('player', this.selfId)) : undefined
      const isMovementSkillActive =
        Boolean(
          selfUnit?.castState &&
            (selfUnit.castState.skillId === 107 ||
              selfUnit.castState.skillId === 132 ||
              selfUnit.castState.skillId === 143 ||
              selfUnit.castState.skillId === 151),
        ) ||
        selfUnit?.states.has(18) === true ||
        this._self.states.has(18)

      this._self.applyLifeMana(
        ev.life,
        ev.mana,
        ev.stamina,
        isMovementSkillActive ? 0 : atX,
        isMovementSkillActive ? 0 : atY,
        ev.lifeRegen,
        ev.manaRegen,
      )
      clearZeroLifeDeathInTown(this)
      if (ev.life > 0) {
        this._isSelfDead = false
        this._self.isDead = false
      }
      if (selfUnit) {
        // D2Client.dll 0x6fb5ebe0 (0x95, 0x6fb5ec78) & 0x6fb5eca0 (0x18, 0x6fb5ed58):
        // When life > 0 and dwMode == 17 (or 0), transitions to mode 5 (PLRMODE_TNEUTRAL) and clears UNITFLAG_DEAD.
        if (ev.life > 0 && (selfUnit.mode === 0 || selfUnit.mode === 17)) {
          selfUnit.mode = isTownLevel(this.areaId) ? 5 : 1
          this._self.mode = selfUnit.mode
        }
        if (ev.life > 0 && selfUnit.lifePct <= 0) {
          selfUnit.lifePct =
            this._self.maxLife > 0
              ? Math.max(1, Math.round((this._self.life / this._self.maxLife) * 128))
              : 128
        }
        if (ev.stamina >= 0) {
          selfUnit.stats.set(10 /* STAT_STAMINA */, this._self.stats.get(10))
        }
        if (typeof ev.lifeRegen === 'number') {
          selfUnit.stats.set(74 /* STAT_HPREGEN */, ev.lifeRegen)
        }
        if (typeof ev.manaRegen === 'number') {
          selfUnit.stats.set(26 /* STAT_MANARECOVERY */, ev.manaRegen)
        }
        if (!isMovementSkillActive && (atX !== 0 || atY !== 0)) {
          selfUnit.x = atX
          selfUnit.y = atY
        }
      }
      downgradeSelfRunOnStaminaExhausted(this)
      break
    }

    case 'Experience': {
      this._self.applyExperience(ev.value, ev.isDelta ?? false)
      const selfUnit =
        this.selfId !== 0 ? this._units.get(makeUnitKey('player', this.selfId)) : undefined
      if (selfUnit) selfUnit.stats.set(13, this._self.experience)
      break
    }

    case 'StateSkillEffect': {
      const unitRef = ev.unit ?? (ev as any).target
      if (!unitRef) break
      const unit = this.ensureWorldOrGroundUnit(unitRef.unitType, unitRef.id)
      if (!unit) break
      const isSelf = unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)
      this.clearUnitCastState(unit)
      unit.states.remove(18)
      unit.states.remove(174)
      if (isSelf) {
        this._self.states.delete(18)
        this._self.states.delete(174)
      }
      if (ev.skillId === 132 || ev.skillId === 143) {
        this.attachUnitOverlay(unit, 'dust', false)
      }
      break
    }

    case 'StateSet': {
      const unitRef = ev.unit ?? (ev as any).target
      if (!unitRef) break
      const unit = this.ensureWorldOrGroundUnit(unitRef.unitType, unitRef.id)
      if (!unit) break
      // S2C 0xAA lists several states; D2Client 0x6fb5db90 sets each one (0x6fb5dc03), including a
      // state whose stat list bailed out (the packet ends after it).
      const entries = ev.states ?? [{ state: ev.state, stats: ev.stats }]
      const isSelf = unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)
      for (const entry of entries) {
        const wasAlreadySet = unit.states.has(entry.state)
        // D2Client 0x6fb23760: States.txt onsound plays only when the state was not already set.
        const stateOnSound = stateOnSoundRequest113c(unit, entry.state, wasAlreadySet)
        if (stateOnSound) this.pushSoundRequest(stateOnSound)
        unit.states.add(entry.state, entry.stats)
        // 0x6fb2382d -> 0x6FB22C80: States.txt castoverlay on the inactive -> active transition (Issue #1063).
        if (!wasAlreadySet) playStateCastOverlay113c(this, unit, entry.state)
        releasePredictedState113c(unit, entry.state)
        if (isSelf) {
          this._self.states.add(entry.state)
        }
        if (entry.stats) {
          unit.stats.setStateStats(entry.state, entry.stats)
          if (isSelf) {
            this._self.stats.setStateStats(entry.state, entry.stats)
          }
        }
        // #124 Redemption corpse state handler (STATE_REDEEMED #99, StateSetFunc[10] 0x6FB239C0):
        // States.txt row 99 redeemed: setfunc=10, skill=redemption (#124), hide=1.
        // Reads Skills.txt #124 cltmissilea='redemption' (#173, CelFile RedemptionGhost, AnimLen 16, Range 18, Trans 1, Light 6),
        // spawns missile #173 at the corpse via 0x6FB630F0, and hides the corpse (attaches no overlay).
        if (entry.state === 99 && unit.unitType === 'monster') {
          ;(unit as any).hidden = true
          ;(unit as any).redeemed = true
          this.spawnMissileByKey('redemption', unit.x, unit.y, unit.x, unit.y, {
            ownerType: unit.unitType,
            ownerId: unit.id,
            sourceSkillId: 124,
            skillLevel: 1,
          })
        }
        // STATE_REVIVE (96): SKILLS_SrvDo058_Revive (D2Game 0x6FC71340) resurrects the SAME unitId in place,
        // so any corpse-consumption marks left on it must not keep the living unit hidden.
        if (entry.state === 96 && unit.unitType === 'monster') {
          clearRevivedCorpseMarks113c(unit)
          unit.dead = false
          if (unit.mode === 0 || unit.mode === 12) {
            unit.mode = 1
          }
          if (unit.lifePct <= 0) {
            unit.lifePct = 128
          }
          unit.deathFxTriggered = false
          this._deadSoundUnitIds.delete(unit.id)
          const npcUnit = this.npcMotion.getUnit(unit.id)
          if (npcUnit) {
            npcUnit.dwFlags = (npcUnit.dwFlags & ~0x10000) >>> 0
            if (npcUnit.dwAnimMode === 0 || npcUnit.dwAnimMode === 12) {
              npcUnit.dwAnimMode = 1
            }
            if (npcUnit.lifeByte <= 0) {
              npcUnit.lifeByte = 128
            }
          }
          const existingPet = this._pets.get(unit.id)
          if (existingPet) {
            existingPet.isDead = false
            if (existingPet.lifePct <= 0) {
              existingPet.lifePct = unit.lifePct
            }
          }
        }
        // #68 Bone Armor: StateSetFunc[6] 0x6FB23230 (1..3 orbiting bone pairs from stats 132/133). The
        // set-function dispatch 0x6fb22530 only runs for a complete 0xA8 / 0xAA stat list (not 0xA5/0xA7).
        if (entry.state === STATE_BONEARMOR) {
          const runsSetFunc =
            ev.origin === undefined ||
            (ev.origin === 0xa8 && ev.complete === true) ||
            (ev.origin === 0xaa && (entry as { complete?: boolean }).complete === true)
          if (runsSetFunc) {
            syncBoneArmorOverlays113c(unit, () => this._nextOverlayId++)
          }
        }
        if (entry.state === 158) {
          ensureBladeShieldAttachment113c(this, unit)
        }
        // States.txt #142 `changeclass` (StateSetFunc[8] @ 0x6FB235B0):
        // Reads STAT_SHORTPARAM1 (355) from the state stat list and updates the monster's classId
        // (e.g. Baal on Throne #543 `baalthrone` -> #559 `baalcrabstairs`) and resets mode to NU (1).
        if (entry.state === 142 && unit.unitType === 'monster') {
          const newClassId =
            entry.stats?.find((s: { statId: number; value: number }) => s.statId === 355)?.value ??
            unit.stats.get(355)
          if (typeof newClassId === 'number' && newClassId > 0) {
            unit.classId = newClassId
            unit.mode = 1
            const npcUnit = this.npcMotion.getUnit(unit.id)
            if (npcUnit) {
              npcUnit.dwTxtFileNo = newClassId
              npcUnit.dwAnimMode = 1
            }
          }
        }
      }
      if (unit.unitType === 'player' && (unit.mode === 2 || unit.mode === 3 || unit.mode === 6)) {
        const speedInfo = this.resolvePlayerAnimSpeed(unit.mode, unit.id)
        unit.animStepSpeed256 = speedInfo.stepSpeed256
        unit.animEffRate = speedInfo.effRate
        if (isSelf) {
          this._selfLocomotionAnimSpeed256 = speedInfo.stepSpeed256
        }
      }
      break
    }

    case 'StateEnd': {
      const unitRef = ev.unit ?? (ev as any).target
      if (!unitRef) break
      const unit = this.ensureWorldOrGroundUnit(unitRef.unitType, unitRef.id)
      if (!unit) break
      const isSelf = unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)
      const wasActive = unit.states.has(ev.state)
      const offSnd = stateOffSoundRequest113c(unit, ev.state, wasActive)
      if (offSnd) {
        this.pushSoundRequest(offSnd)
      }
      unit.states.remove(ev.state)
      releasePredictedState113c(unit, ev.state)
      unit.stats.removeStateStats(ev.state)
      // remfunc 0x6FB22A50 drops the state's castoverlay with overlay1..4 (Issue #1063) and triggers removerlay (#1242).
      removeStateCastOverlay113c(unit, ev.state)
      if (wasActive) {
        playStateRemOverlay113c(this, unit, ev.state)
      }
      if (ev.state === STATE_BONEARMOR) {
        // remfunc[3] 0x6FB22A50: drops bonearmor_cast/front/back/null overlays.
        clearBoneArmorOverlays113c(unit)
      }
      if (ev.state === 158) {
        for (const u of Array.from(this._units.values())) {
          if (
            u.unitType === 'missile' &&
            u.missileKey === 'blade shield attachment' &&
            u.ownerType === unit.unitType &&
            u.ownerId === unit.id
          ) {
            this._units.delete(u.key)
          }
        }
      }
      const stateOverlayTokens = STATE_OVERLAYS[ev.state]
      const pgsvToken = STATE_PGSV_OVERLAYS[ev.state]
      if (stateOverlayTokens || pgsvToken) {
        const tokensToRemove = new Set<string>(
          stateOverlayTokens
            ? (Array.isArray(stateOverlayTokens) ? stateOverlayTokens : [stateOverlayTokens]).map(
                (t) => String(t).toLowerCase(),
              )
            : [],
        )
        if (ev.state === 20) {
          tokensToRemove.add('chillarmor')
          tokensToRemove.add('chillingarmor')
        } else if (ev.state === 117) {
          ;(unit as any).maulCharges = 0
          for (let i = 1; i <= 5; i++) {
            tokensToRemove.add(`maul${i}`)
            tokensToRemove.add(`maul${i}back`)
          }
        } else if (ev.state === 120) {
          ;(unit as any).feralRageCharges = 0
          for (let i = 1; i <= 5; i++) {
            tokensToRemove.add(`feralrage${i}`)
            tokensToRemove.add(`feralrage${i}back`)
          }
        } else if (pgsvToken) {
          const prefix = pgsvToken.slice(0, -1).toLowerCase()
          for (let i = 1; i <= 3; i++) {
            tokensToRemove.add(`${prefix}${i}`)
          }
        }
        unit.overlays = unit.overlays.filter(
          (o) => !tokensToRemove.has(o.token.toLowerCase()),
        )
      }
      if (isSelf) {
        this._self.states.delete(ev.state)
        this._self.stats.removeStateStats(ev.state)
        if (ev.state === 121) {
          this._skillDelayUntilMs = 0
          this._skillDelayDurationMs = 0
        }
      }
      if (unit.unitType === 'player' && (unit.mode === 2 || unit.mode === 3 || unit.mode === 6)) {
        const speedInfo = this.resolvePlayerAnimSpeed(unit.mode, unit.id)
        unit.animStepSpeed256 = speedInfo.stepSpeed256
        unit.animEffRate = speedInfo.effRate
        if (isSelf) {
          this._selfLocomotionAnimSpeed256 = speedInfo.stepSpeed256
        }
      }
      break
    }

    case 'WeaponSwitch': {
      // S2C 0x97 (#765, PROJECT rule 24). The server has already moved the weapons 4<->11 / 5<->12
      // and toggled the client's switch flag (D2MOO D2Game `ItemMode.cpp` `sub_6FC46840` 3173-3224);
      // 0x97 goes to the owning client only (`SCmd.cpp:2361-2369`), so it flips the LOCAL I/II tab
      // exactly once per swap. `weaponSet` is the tab only; stats come from body locs 1-10
      // (`ItemMode.cpp:1981`, `1996`) and the moved items arrive as 0x9D action 0x17 below.
      this._self.weaponSet = this._self.weaponSet === 0 ? 1 : 0
      break
    }

    case 'Item':
    case 'ItemEvent':
    case 'ItemAction':
    case 'WorldItemAction': {
      if (!ev.item && ev.action === 0x17) {
        this._self.weaponSet = this._self.weaponSet === 0 ? 1 : 0
        this.invalidatePlayerLightCache()
        break
      }
      this.invalidatePlayerLightCache()
      if (!ev.item && (ev as any).itemId !== undefined) {
        ;(ev as any).item = {
          id: (ev as any).itemId,
          code: (ev as any).code ?? 'rin',
          x: (ev as any).x ?? 0,
          y: (ev as any).y ?? 0,
        }
      }
      if (!ev.item) {
        throw new Error(`${ev.type} missing item payload`)
      }
      // 0x9D action 0x17 ITEMACTION_WEAPONSWITCH (#765, PROJECT rule 24): one packet per item the
      // swap moved, carrying the item's NEW body loc (D2MOO D2Game `InvMode.cpp:178-181` ->
      // `SCmd.cpp:1588-1591`; full bitstream `SCmd.cpp:1456-1500`; socketed children re-sent right
      // after as 0x13 `SCmd.cpp:1501-1509`). It is placed like any equipment update below and
      // NEVER toggles the tab (only 0x97 does). Remote players' equipment is isolated in
      // `ClientInventoryManager.remoteEquipmentByPlayerId` (issue #879) so it never evicts local slots.
      const effectiveAction = ev.action ?? ev.item?.action ?? 0
      const isCursorImode =
        ev.item?.location === 4 &&
        effectiveAction !== 0x03 &&
        (ev.item.worldX === undefined || ev.item.worldX === 0) &&
        (ev.item.worldY === undefined || ev.item.worldY === 0)
      const defaultContainer =
        effectiveAction === 0x01 ||
        effectiveAction === 0x12 ||
        effectiveAction === 0x16 ||
        isCursorImode
          ? 'cursor'
          : ev.type === 'WorldItemAction' ||
              effectiveAction === 0x00 ||
              effectiveAction === 0x02 ||
              effectiveAction === 0x03 ||
              ev.item?.location === 3 ||
              ev.item?.location === 5
            ? 'ground'
            : effectiveAction === 0x06 ||
                effectiveAction === 0x07 ||
                effectiveAction === 0x09 ||
                effectiveAction === 0x17 ||
                ev.item?.location === 1
              ? 'equipment'
              : 'inventory'
      let effectiveContainer = ev.container ?? ev.item?.container ?? defaultContainer
      if (
        isCursorImode &&
        (effectiveAction === 0x02 || effectiveAction === 0x00 || effectiveAction === 0x04)
      ) {
        effectiveContainer = 'cursor'
        ;(this as any)._lastOptimisticImbuedItem = null
      }
      if (
        effectiveAction === 0x0f &&
        this._pendingBeltPickupItemIds.delete(ev.item.id >>> 0) &&
        (((ev.item.rawFlags ?? ev.item.flags ?? 0) & 0x20) === 0)
      ) {
        effectiveContainer = 'cursor'
      }
      let itemPayload = ev.item
      if (
        this._npcInteraction.window === 'gamble' &&
        effectiveContainer === 'inventory' &&
        (effectiveAction === 0x04 || effectiveAction === 0x15)
      ) {
        const rawId =
          ev.item.identified !== undefined
            ? Boolean(ev.item.identified)
            : ((ev.item.rawFlags ?? 0) & 0x10) !== 0
        // D2Client.dll 0x6fb3357b..0x6fb335a6: an unidentified purchased item triggers 0x37 IdentifyFromGamble;
        // D2Game 0x6FCCA990 identifies it (only if it is `dwBoughtItemId`) and re-sends the full item.
        // The client never sets IFLAG_IDENTIFIED itself: the wire omitted the id data (rare/unique/set ids,
        // stat lists), so a forged flag renders a nameless "identified" item. Items merely moved inside the
        // inventory while the gamble window is open must stay unidentified (#1006).
        if (!rawId && effectiveAction === 0x04 && (this._pendingGambleBuyCount ?? 0) > 0) {
          this._pendingGambleBuyCount--
          this._pendingGambleIdentifyItemIds.push(ev.item.id)
        }
        if ((ev.item as { isGambleMystery?: boolean }).isGambleMystery) {
          itemPayload = { ...ev.item, isGambleMystery: false } as typeof ev.item
        }
      }
      this._containers.applyItemEvent(effectiveAction, itemPayload, effectiveContainer, this.selfId)
      const itemOwnerType = itemPayload.ownerType
      const itemOwnerId = itemPayload.ownerId
      if (
        (itemOwnerType === 0 || itemOwnerType === 'player') &&
        itemOwnerId !== undefined &&
        itemOwnerId !== 0 &&
        this.selfId !== 0 &&
        itemOwnerId !== this.selfId
      ) {
        this.syncPlayerSetBonusStates(itemOwnerId)
      } else {
        this.syncPlayerSetBonusStates(this.selfId)
      }
      if (effectiveContainer === 'ground') {
        const itemUnit = this.ensureUnit('item', ev.item.id)
        itemUnit.x = ev.item.worldX || ev.item.x || 0
        itemUnit.y = ev.item.worldY || ev.item.y || 0
        const trimmedCode = ev.item.code.trim()
        const goldStatVal = ev.item.stats?.find((s: { statId: number; value: number }) => s.statId === 14)?.value
        const goldAmt =
          ev.item.goldAmount ??
          (trimmedCode === 'gld' ? (ev.item.quantity ?? goldStatVal ?? 1) : undefined)
        itemUnit.goldAmount = goldAmt
        itemUnit.itemCode = trimmedCode
        itemUnit.itemQuality = ev.item.quality
        itemUnit.itemData = ev.item
        const uiItem = onlineItemDataToUiInventoryItem(ev.item)
        itemUnit.flippyFile = uiItem.flippyFile
        itemUnit.invFile = uiItem.invFile
        itemUnit.invtransform = uiItem.invtransform
        itemUnit.name =
          trimmedCode === 'gld' && goldAmt !== undefined
            ? `${goldAmt} Gold`
            : (uiItem.name || ev.item.code)
        itemUnit.nameZh =
          trimmedCode === 'gld' && goldAmt !== undefined
            ? `${goldAmt} 金币`
            : (uiItem.nameZh || uiItem.baseNameZh || itemUnit.name)

        // D2Client.dll 0x6fb34bb0 / 0x6fb34990 / 0x6fb36810:
        // - Action 0x02 / 'drop' (DropToGround) -> mode 5 (ITEMMODE_DROPPING)
        // - Action 0x00 / 'groundSpawn' (AddToGround) -> mode 5 if IFLAG_NEWITEM (0x2000) is set, else mode 3
        // - Action 0x03 (OnGround / static room reveal) -> mode 3 (ITEMMODE_ON_GROUND)
        const rawFlags = ev.item.rawFlags ?? ev.item.flags ?? 0
        const isDropping =
          effectiveAction === 0x02 ||
          effectiveAction === 'drop' ||
          ((effectiveAction === 0x00 || effectiveAction === 'groundSpawn') &&
            ((rawFlags & 0x2000) !== 0 || ev.item.newItem === true))
        if (isDropping) {
          const now = this.resolveEventNowMs(nowMs)
          const flippyKey = resolveGroundItemFlippyKey(
            {
              isGold: trimmedCode === 'gld',
              amount: goldAmt ?? 1,
              code: trimmedCode,
              ...(itemUnit.name ? { name: itemUnit.name } : {}),
              ...(uiItem.flippyFile ? { flippyFile: uiItem.flippyFile } : {}),
              ...(uiItem.invFile ? { invFile: uiItem.invFile } : {}),
              ...(uiItem.invtransform ? { invtransform: uiItem.invtransform } : {}),
            },
            BAKED_UI_MANIFEST.flippyFrames,
            BAKED_UI_MANIFEST.codeToFlippyFile,
          )
          const flippyFrames = flippyKey ? BAKED_UI_MANIFEST.flippyFrames?.[flippyKey] : undefined
          const flippyFrameCount =
            flippyFrames && flippyFrames.length > 0 ? flippyFrames.length : 12
          const dropDurationMs = flippyFrameCount * 40
          itemUnit.mode = 5
          itemUnit.animStartedAtMs = now
          itemUnit.modeStartedAtMs = now
          itemUnit.modeDurationMs = dropDurationMs
          itemUnit.modeElapsedMs = 0
          itemUnit.modeUntilMs = now + dropDurationMs

          // D2Client.dll 0x6fb327c0 (`PlayItemFlippyAndScheduleDropSound` on mode 5):
          // 1. Immediate PlaySound(0xd8 = 216 /* item_flippy */, pItem, 0, 0, 0)
          this.pushSoundRequest({
            soundId: 216,
            unit: { unitType: 'item', id: itemUnit.id },
            x: itemUnit.x,
            y: itemUnit.y,
          })
          // 2. Scheduled landing sound: PlaySound(dropSoundId, pItem, dropSfxFrame, 0, 0) + SetSoundVolume(handle, 0xb4 = 180)
          const dropSoundId = uiItem.dropSound
            ? (getSoundIdByName113c(uiItem.dropSound) ?? 0)
            : trimmedCode === 'gld'
              ? 221
              : 0
          const dropSfxFrame =
            uiItem.dropSfxFrame !== undefined && uiItem.dropSfxFrame > 0
              ? Math.floor(uiItem.dropSfxFrame)
              : 12
          if (dropSoundId > 0) {
            this.pushSoundRequest({
              soundId: dropSoundId,
              unit: { unitType: 'item', id: itemUnit.id },
              x: itemUnit.x,
              y: itemUnit.y,
              delayTicks: dropSfxFrame,
              volume: 180,
              volumeOverride: 180,
            })
          }
        } else {
          itemUnit.mode = 3
          itemUnit.animStartedAtMs = undefined
          itemUnit.modeStartedAtMs = undefined
          itemUnit.modeDurationMs = undefined
          itemUnit.modeElapsedMs = undefined
          itemUnit.modeUntilMs = undefined
        }
      } else {
        this._units.delete(makeUnitKey('item', ev.item.id))
        if (effectiveContainer === 'cursor') {
          // D2Client.dll 0x6fb328d9 (item mode 4 OnCursor -> PlaySound(0xeb = 235 /* item_pickup */, 0, 0, 0, 0))
          this.pushSoundRequest({ soundId: 235 })
        }
      }
      break
    }

    case 'CursorClear': {
      // S2C 0x42 ClearCursor (D2Client.dll 0x6fb5db70 -> 0x6fb32f50):
      // Resolves unit from g_pClientUnitTable and compares against g_pPlayerUnit;
      // only clears the local player's cursor item and never touches unit.mode or death flags.
      const uType = unitTypeFromId(ev.unitType)
      const uId = Number(ev.id ?? 0)
      if (uType === 'player' && (uId === this.selfId || this.selfId === 0)) {
        const cleared = this._containers.clearCursor()
        if (cleared) {
          this._units.delete(makeUnitKey('item', cleared.id))
        }
      }
      break
    }

    case 'UseSpecialItem': {
      // S2C 0x7C UseSpecialItem (D2Client.dll 0x6fb5d2a0 -> 0x6fb31aa0):
      // Sent by D2Game.dll (0x6fcac3b0) after using a Tome (tbk/ibk) or item spell.
      // Looks up existing client unit via D2CLIENT_FindClientSideUnit (0x6fb54e20) and expires
      // temporary StatList 0x36 (`STATLIST_GetStatListFromUnitAndFlag(pUnit, 0x36)`).
      // Never spawns a phantom world unit and never mutates item containers or eMode.
      const uId = Number(ev.id ?? 0)
      const unit = this.getUnit(ev.unitType, uId)
      if (unit) {
        unit.states.remove(0x36)
        unit.stats.removeStateStats(0x36)
      }
      break
    }

    case 'ItemFlagUpdate': {
      // S2C 0x7D SetItemState (D2Client.dll 0x6fb5e1f0 -> 0x6fb34df0):
      //   flag == IFLAG_BROKEN (0x100)   -> ITEMS_SetItemFlag(pItem, 0x100, enabled)
      //   flag == IFLAG_REPAIRED (0x200) -> ITEMS_SetItemFlag(pItem, 0x100, 0)
      //   any other flag                 -> ignored (never IFLAG_IDENTIFIED, #1006)
      let broken: boolean
      if (ev.flag === ITEM_FLAG_BROKEN) broken = ev.enabled !== 0
      else if (ev.flag === ITEM_FLAG_REPAIRED) broken = false
      else break
      const item =
        this._containers.allById.get(ev.itemId) ??
        this._containers.inventory.get(ev.itemId) ??
        this._containers.equipment.get(ev.itemId) ??
        this._containers.cube.get(ev.itemId) ??
        this._containers.stash.get(ev.itemId)
      if (!item) break
      const setBroken = (word: number): number =>
        (broken ? word | ITEM_FLAG_BROKEN : word & ~ITEM_FLAG_BROKEN) >>> 0
      ;(item as any).rawFlags = setBroken(item.rawFlags ?? 0)
      if (typeof item.flags === 'number') (item as any).flags = setBroken(item.flags)
      ;(item as any).broken = broken
      this._containers.revision++
      this._containers.hudRevision++
      break
    }

    case 'ItemRelate':
      // S2C 0x47 / 0x48 (D2Client.dll 0x6fb5e2b0 / 0x6fb5e260): unit lookup + refresh (0x6fb32fe0) only.
      // No item stat or flag is carried, so the client world is not mutated (#1006).
      break

    case 'SkillList': {
      if (this.selfId === 0 && ev.unitId !== 0) {
        this.selfId = ev.unitId
        this._self.unitId = ev.unitId
      }
      if (ev.unitId === this.selfId || ev.unitId === 0) {
        const isStatus = (ev as any).isSkillStatus === true
        for (const sk of ev.skills) {
          const rawQuantity = (sk as any).quantity ?? (isStatus ? sk.level : undefined)
          if (rawQuantity !== undefined) {
            this._self.skillCharges.set(sk.skillId, rawQuantity)
          }
          if (isStatus) {
            continue
          }
          const existing = this._self.skillEntries.get(sk.skillId)
          const bonus = sk.bonus ?? existing?.bonus ?? 0
          const baseLevel = sk.baseLevel ?? sk.level
          const merged: SkillLevel = {
            skillId: sk.skillId,
            skill: sk.skillId,
            level: sk.level,
            baseLevel,
            bonus,
          }
          this._self.skillEntries.set(sk.skillId, merged)
          this._self.skills.set(sk.skillId, baseLevel + bonus)
        }
      }
      break
    }

    case 'ActiveSkill': {
      if ((ev as { isUseStackableItem?: boolean }).isUseStackableItem === true) {
        this._pendingUseStackableCursor = {
          cursorAction: ev.unitId,
          itemId: ev.itemId ?? 0,
          skillId: ev.skill,
        }
        break
      }
      const isHotkey = (ev as any).isHotkey === true || (ev as any).slot !== undefined
      if (isHotkey) {
        const slot = (ev as any).slot ?? ev.unitId
        this.assignSkillHotkey(slot, ev.hand, ev.skill, ev.itemId)
        break
      }
      if (ev.unitId === 0 && ev.skill === 0xffff) {
        this._self.weaponSet = this._self.weaponSet === 0 ? 1 : 0
        break
      }
      if (this.selfId === 0 && ev.unitId !== 0) {
        this.selfId = ev.unitId
        this._self.unitId = ev.unitId
      }
      if (ev.unitId === this.selfId || ev.unitId === 0) {
        if (ev.hand === 'left') {
          this._self.leftSkill = ev.skill
        } else {
          this._self.rightSkill = ev.skill
          this.syncSelfRightHandAuraState(ev.skill)
        }
      }
      break
    }

    case 'NpcMenu':
    case 'NpcInfo':
    case 'Npc': {
      const targetId = ev.npcId ?? ev.unitId ?? ev.npcUnitId
      if (ev.kind === 'heal' && targetId !== undefined) {
        const healPct = ev.result ?? ev.lifePct ?? 128
        const unit = this.getUnit('monster', targetId)
        if (unit) {
          unit.lifePct = healPct
        }
        const motionUnit = this.npcMotion.getUnit(targetId)
        if (motionUnit) {
          motionUnit.lifeByte = healPct
        }
        if (this._merc && this._merc.mercId === targetId) {
          this._merc.lifePct = healPct
          this._merc.lifePctScale = 128
          if (healPct > 0) {
            this._merc.isDead = false
          }
          syncMercStat6FromLifePct(this, unit, healPct, 128)
        }
        const pet = this._pets.get(targetId)
        if (pet) {
          pet.lifePct = healPct
          pet.lifePctScale = 128
          if (healPct > 0) {
            pet.isDead = false
          }
        }
      } else if (ev.kind === 'info') {
        const validMessages =
          typeof ev.count === 'number' && Array.isArray(ev.messages)
            ? ev.messages.slice(0, Math.max(0, ev.count))
            : ev.messages
        if (targetId !== undefined && targetId !== 0) {
          this._npcInfoByUnitId.set(targetId, {
            npcInfoRaw: ev.raw,
            messages: validMessages,
            allMessages: ev.allMessages,
          })
        }
        if (
          ev.unitType === 2 &&
          targetId !== undefined &&
          targetId !== 0 &&
          validMessages?.some((m: { readonly stringId: number }) => m.stringId > 0)
        ) {
          this._npcInteraction = {
            ...this._npcInteraction,
            npcId: targetId,
            infoNpcId: targetId,
            unitType: 2,
            window: 'none',
            activeWindow: 'none',
            npcInfoRaw: ev.raw,
            messages: validMessages,
            allMessages: ev.allMessages,
          }
        } else if (
          this._npcInteraction.npcId === null ||
          targetId === undefined ||
          targetId === 0 ||
          this._npcInteraction.npcId === targetId
        ) {
          this._npcInteraction = {
            ...this._npcInteraction,
            ...(targetId !== undefined && targetId !== 0 ? { infoNpcId: targetId } : {}),
            unitType: ev.unitType ?? 1,
            npcInfoRaw: ev.raw,
            messages: validMessages,
            allMessages: ev.allMessages,
          }
        }
      } else if (ev.kind === 'wantsInteract') {
        if (targetId !== undefined && targetId !== 0) {
          // D2Client.dll 0x6faf7970: ignore 0x8A if the NPC is currently being interacted with
          if (this._npcInteraction.npcId === targetId) {
            break
          }
          const uType = ev.unitType !== undefined ? unitTypeFromId(ev.unitType) : 'monster'
          const unit = this.getUnit(uType, targetId)
          if (unit) {
            unit.wantsInteract = true
          } else {
            this._pendingWantsInteractUnitIds.add(targetId)
          }
        }
      } else if (ev.kind === 'assign') {
        if (targetId !== undefined) {
          const unit = this.ensureUnit('monster', targetId)
          if (ev.classId !== undefined) unit.classId = ev.classId
          if (ev.x !== undefined) unit.x = ev.x
          if (ev.y !== undefined) unit.y = ev.y
          if (this._pendingWantsInteractUnitIds.delete(targetId)) {
            unit.wantsInteract = true
          }
          if (Array.isArray(ev.messages)) {
            this._npcInfoByUnitId.set(targetId, { messages: ev.messages })
          }
        }
        this._npcInteraction = {
          ...this._npcInteraction,
          ...(targetId !== undefined ? { npcId: targetId, infoNpcId: targetId } : {}),
          ...(Array.isArray(ev.messages) ? { messages: ev.messages } : {}),
        }
      } else if (ev.kind === 'menu' || ev.kind === 'setTalk') {
        const actIdx = Number(ev.act ?? ev.result ?? this.act)
        if (Array.isArray(ev.npcFlags)) {
          const arr = this._npcTalkFlagsByAct.get(actIdx) ?? new Uint16Array(12)
          for (let i = 0; i < Math.min(arr.length, ev.npcFlags.length); i++) {
            const w = ev.npcFlags[i]! & 0xffff
            arr[i] = w
            // D2Client.dll 0x6faf5dd0: each non-0xFFFF u16 word in S2C 0x91 is an NPC classId (hcIdx)
            // whose intro has already been played in this act.
            if (w >= 146 && w < 0xfff0) {
              this._npcIntroPlayedKeys.add(`${actIdx}:${w}`)
            }
          }
          this._npcTalkFlagsByAct.set(actIdx, arr)
        }
        this._npcInteraction = {
          ...this._npcInteraction,
          ...(this._npcInteraction.npcId === null && targetId !== undefined && targetId !== 0
            ? { npcId: targetId }
            : {}),
          npcTalkRaw: ev.raw,
        }
      }
      break
    }

    case 'NpcTransaction': {
      // Gold and items are driven by stat 14 and 0x9C/0x9D only (D2Client 0x6fafbc80 ignores [11..14]).
      // If a cursor-held item was sold (result === 1) and is still on the cursor, clear it.
      if (ev.result === 1 && this._containers.cursor?.id === ev.itemId) {
        this._containers.removeItemById(ev.itemId)
      }
      // A rejected buy (result other than 0 buy-ok / 1 sell-ok) never delivers the gambled item (#1006).
      if (ev.result !== 0 && ev.result !== 1 && (this._pendingGambleBuyCount ?? 0) > 0) {
        this._pendingGambleBuyCount--
      }
      this._lastNpcTransaction = {
        seq: ++this._npcTransactionSeq,
        result: ev.result,
        flag: ev.flag,
        itemId: ev.itemId,
        gold: ev.gold,
      }
      break
    }

    case 'WaypointMenu': {
      this._waypoints.clear()
      this._waypointUnitId = ev.unitId
      this._waypointOpen = true
      this._waypointMenuSeq++
      for (const wp of ev.open) {
        this._waypoints.add(wp)
      }
      break
    }

    case 'QuestState': {
      if (ev.kind === 'history' || ev.source === 0x52) {
        const raw = ev.statusBytes ?? ev.historyBytes
        if (raw) {
          this._questHistory.set(raw.subarray(0, this._questHistory.length))
          this._questLog.apply52(raw)
        } else {
          const arr = ev.quests ?? ev.flags ?? []
          const len = Math.min(this._questHistory.length, arr.length)
          for (let i = 0; i < len; i++) {
            this._questHistory[i] = (arr[i] ?? 0) & 0xff
          }
          this._questLog.apply52(this._questHistory)
        }
        break
      }
      if (ev.kind === 'item' || ev.source === 0x50) {
        const arr = ev.quests ?? ev.flags ?? []
        const copy = new Uint16Array(7)
        for (let i = 0; i < Math.min(7, arr.length); i++) {
          copy[i] = (arr[i] ?? 0) & 0xffff
        }
        this._questItemState = copy
        this._questLog.apply50(copy)
        break
      }
      if (ev.kind === 'status' || ev.source === 0x5d) {
        const arr = ev.quests ?? ev.flags ?? []
        const rawExtra = arr[2] ?? 0
        const qs = ev.questStatus ?? {
          questId: arr[0] ?? 0,
          alertFlags: (arr[1] ?? 0) & 0xff,
          filterStatus: ((arr[1] ?? 0) >>> 8) & 0xff,
          extra: (rawExtra << 16) >> 16,
        }
        this._questStatus = qs
        this._questLog.apply5D(qs.questId, qs.alertFlags, qs.filterStatus, qs.extra, {
          denQuestWord: this._quests[1] ?? 0,
          playerDeadOrDying: this.isSelfDead,
        })
        break
      }
      if (ev.kind === 'availability' || ev.source === 0x5e) {
        const avail = new Uint8Array(37)
        if (ev.availabilityBytes) {
          avail.set(ev.availabilityBytes.subarray(0, 37))
        } else {
          for (let i = 0; i < Math.min(18, ev.quests.length); i++) {
            avail[i * 2] = (ev.quests[i] ?? 0) & 0xff
            if (i * 2 + 1 < 37) avail[i * 2 + 1] = ((ev.quests[i] ?? 0) >>> 8) & 0xff
          }
        }
        this._gameQuestAvailability = avail
        break
      }
      if (ev.kind === 'special' || ev.source === 0x89) {
        this._specialQuestEvent = ev.specialEventId ?? ev.quests[0] ?? 0
        break
      }
      if (ev.kind === 'log' || ev.source === 0x29) {
        const incoming = ev.flags ?? ev.quests ?? []
        const gCopy = new Uint16Array(Math.max(48, this._gameQuests.length, incoming.length))
        gCopy.set(this._gameQuests)
        for (let i = 0; i < incoming.length; i++) {
          gCopy[i] = (incoming[i] ?? 0) & 0xffff
        }
        this._gameQuests = gCopy
        this._gameQuestLog = gCopy
        if (!this._hasPlayerQuests) {
          const qCopy = new Uint16Array(Math.max(48, this._quests.length, incoming.length))
          qCopy.set(this._quests)
          for (let i = 0; i < incoming.length; i++) {
            qCopy[i] = (incoming[i] ?? 0) & 0xffff
          }
          this._quests = qCopy
        }
        this._hasQuestInfo = true
        break
      }
      // D2Client.dll 0x6fafb8a0: updateType === 6 copies directly into the player quest record (0x6fafb8bc);
      // updateType !== 6 looks up the unit (0x6fafb91f) and copies the 96-byte quest buffer when found (0x6fafb996).
      if (ev.updateType !== undefined && ev.updateType !== 6) {
        const uType = ev.updateType === 4 || ev.updateType === 5 ? 'object' : 'monster'
        if (ev.unitId === undefined || !this.getUnit(uType, ev.unitId)) {
          break
        }
      }
      this._hasPlayerQuests = true
      const incoming = ev.flags ?? ev.quests ?? []
      const copy = new Uint16Array(Math.max(48, this._quests.length, incoming.length))
      copy.set(this._quests)
      for (let i = 0; i < incoming.length; i++) {
        copy[i] = (incoming[i] ?? 0) & 0xffff
      }
      this._quests = copy
      this._hasQuestInfo = true
      break
    }

    case 'CorpseAssign': {
      const ownerId = Number(ev.ownerId ?? 0)
      const corpseId = Number(ev.corpseId ?? 0)
      const assign = Number(ev.assign ?? 1)
      if (corpseId !== 0) {
        if (assign !== 0) {
          this._corpses.set(corpseId, ownerId)
        } else {
          this._corpses.delete(corpseId)
        }
      }
      break
    }

    case 'Party': {
      const rawUnitId = ev.unitId ?? ev.playerId ?? ev.subjectId
      const rawOtherId = ev.otherId ?? ev.objectId
      const rawRel = ev.relation ?? ev.state ?? ev.relations

      // 0x7F PartyMemberState for pets / hirelings (isPlayer === 0)
      if (ev.kind === 'memberState' && (ev.isPlayer === false || ev.relation === 0)) {
        const targetId = ev.unitId ?? 0
        const pct100 = ev.lifePct
        const unit = targetId !== 0 ? this.getUnit('monster', targetId) : undefined
        if (pct100 !== undefined) {
          const life128 =
            pct100 <= 0 ? 0 : Math.min(128, Math.max(1, Math.round((pct100 * 128) / 100)))
          if (unit) {
            unit.lifePct = life128
          }
          const motionUnit = targetId !== 0 ? this.npcMotion.getUnit(targetId) : undefined
          if (motionUnit) {
            motionUnit.lifeByte = life128
          }
        }
        if (this._merc && this._merc.mercId === targetId) {
          if (pct100 !== undefined) {
            this._merc.lifePct = pct100
            this._merc.lifePctScale = 100
            this._merc.isDead = pct100 <= 0
            syncMercStat6FromLifePct(this, unit, pct100, 100)
          }
        }
        const pet = this._pets.get(targetId)
        if (pet) {
          if (pct100 !== undefined) {
            pet.lifePct = pct100
            pet.lifePctScale = 100
            pet.isDead = pct100 <= 0
          }
        }
        break
      }

      const id =
        this.selfId !== 0 && rawUnitId === this.selfId && rawOtherId !== undefined
          ? rawOtherId
          : (rawUnitId ?? rawOtherId ?? 0)
      if (id !== 0) {
        // 0x65 PlayerKillCount (D2Client.dll 0x6fb5d890) is kill count, not party relationship (#965).
        if (ev.source === 0x65) {
          break
        }
        if (
          this.selfId !== 0 &&
          id === this.selfId &&
          !ev.charName &&
          !this._party.has(id) &&
          (ev.kind !== 'roster' || ev.partyId === undefined || ev.partyId === 0xffff)
        ) {
          break
        }
        // Only delete on 0x5C PlayerLeftGame (source === 0x5c, or legacy synthetic leave event with partyId === 0xffff and no source/level/relation).
        // 0x5B PlayerInGame, 0x75 PlayerPartyInfo, and 0x8D AssignPlayerToParty also send partyId === 0xffff when unpartied and must NEVER delete the roster entry (#965).
        const isPlayerLeftGame =
          ev.kind === 'roster' &&
          ev.partyId === 0xffff &&
          !ev.charName &&
          (ev.source === 0x5c ||
            (ev.source === undefined && ev.charLevel === undefined && ev.relation === undefined))
        if (isPlayerLeftGame) {
          this._party.delete(id)
          break
        }
        const isNewEntry = !this._party.has(id)
        const prev: PartyMemberState = this._party.get(id) ?? {
          unitId: id,
          partyState: 0,
          hostile: false,
          lootPermit: false,
        }

        let partyState = prev.partyState ?? 0
        // Issue #909 R3: PvP / Hostile state is disabled globally; never mark other players hostile.
        const hostile = false
        let lootPermit = prev.lootPermit ?? false
        let nextPartyId = ev.partyId ?? prev.partyId

        const explicitPartyState = (ev as { partyState?: number | string }).partyState
        if (typeof explicitPartyState === 'number') {
          partyState = explicitPartyState
        } else if (explicitPartyState === 'invited_me' || explicitPartyState === 'invited_by') {
          partyState = 2
        } else if (explicitPartyState === 'invited') {
          partyState = 4
        } else if (explicitPartyState === 'in_party' || explicitPartyState === 'partied') {
          partyState = 1
        } else if (explicitPartyState === 'none') {
          partyState = 0
        } else if (ev.kind === 'roster') {
          if (rawRel !== undefined) {
            const inPartyHi = (rawRel >>> 16) & 0xffff
            const relLo = rawRel & 0xffff
            if (inPartyHi >= 1 && inPartyHi <= 4) {
              partyState = inPartyHi
            } else if ((ev.partyId === undefined || ev.partyId === 0xffff) && relLo >= 1 && relLo <= 4) {
              partyState = relLo
            } else if (ev.partyId !== undefined) {
              partyState = ev.partyId !== 0xffff && ev.partyId !== 0 ? 1 : 0
            }
          } else if (ev.partyId !== undefined) {
            partyState = ev.partyId !== 0xffff && ev.partyId !== 0 ? 1 : 0
          } else if (isNewEntry && prev.partyId === undefined) {
            // Issue #909 R4.3: local/test roster entries without explicit partyId default to partied
            nextPartyId = 1
            partyState = 1
          }
        } else if (ev.kind === 'relation' && rawRel !== undefined) {
          if ((rawOtherId === undefined || ev.subKind === 'partyState') && rawRel <= 4) {
            partyState = rawRel
          }
          if ((rawRel & 0x04) !== 0 || (rawOtherId !== undefined && rawRel === 1)) {
            lootPermit = true
          } else if (rawOtherId !== undefined) {
            lootPermit = false
          }
        } else if ((ev.kind === 'memberState' || ev.kind === 'memberPos') && partyState === 0) {
          // 0x66, 0x7F (isPlayer !== false), and 0x90 are only sent for members in our party (#965).
          partyState = 1
        }

        const playerUnit = this.getUnit('player', id)
        const fallbackName =
          id === this.selfId ? this._self.name || playerUnit?.name : playerUnit?.name
        const fallbackClass =
          id === this.selfId
            ? this._self.charClass
            : playerUnit && playerUnit.classId >= 0 && playerUnit.classId <= 6
              ? playerUnit.classId
              : undefined
        const statLevel = playerUnit?.stats.get(12)
        const fallbackLevel =
          id === this.selfId
            ? this._self.level > 0
              ? this._self.level
              : statLevel
            : statLevel !== undefined && statLevel > 0
              ? statLevel
              : undefined

        let nextAreaId = ev.areaId ?? ev.levelId ?? prev.areaId
        const nextAt =
          ev.at ??
          (ev.x !== undefined && ev.y !== undefined ? { x: Number(ev.x), y: Number(ev.y) } : prev.at)
        if (!nextAreaId || nextAreaId === 0) {
          const posX = nextAt?.x ?? playerUnit?.x ?? 0
          const posY = nextAt?.y ?? playerUnit?.y ?? 0
          if (posX > 0 || posY > 0) {
            const roomArea = this.resolveAreaFromRevealedRooms(posX, posY)
            if (roomArea > 0) {
              nextAreaId = roomArea
            }
          }
          if ((!nextAreaId || nextAreaId === 0) && playerUnit && this.areaId > 0) {
            nextAreaId = this.areaId
          }
        }

        const resolvedCharName = ev.charName ?? prev.charName ?? (fallbackName ? fallbackName : undefined)
        const resolvedCharClass = ev.charClass ?? prev.charClass ?? fallbackClass
        const resolvedCharLevel = ev.charLevel ?? prev.charLevel ?? fallbackLevel
        const squelched =
          prev.squelched ??
          this._squelchedPlayerIds.has(id) ??
          (resolvedCharName ? this._squelchedPlayerNames.has(resolvedCharName.toLowerCase()) : false)
        const ignored =
          prev.ignored ??
          this._ignoredPlayerIds.has(id) ??
          (resolvedCharName ? this._ignoredPlayerNames.has(resolvedCharName.toLowerCase()) : false)

        if (ev.lifePct !== undefined && playerUnit) {
          if (playerUnit.mode === 0 || playerUnit.mode === 17) {
            playerUnit.lifePct = 0
          } else if (ev.lifePct > 0) {
            playerUnit.lifePct = Math.min(128, Math.max(1, Math.round((ev.lifePct * 128) / 100)))
          }
        }
        this._party.set(id, {
          ...prev,
          ...(resolvedCharName !== undefined ? { charName: resolvedCharName } : {}),
          ...(resolvedCharClass !== undefined ? { charClass: resolvedCharClass } : {}),
          ...(resolvedCharLevel !== undefined ? { charLevel: resolvedCharLevel } : {}),
          ...(nextPartyId !== undefined ? { partyId: nextPartyId } : {}),
          ...(rawRel !== undefined && ev.kind !== 'memberState' ? { relation: rawRel } : {}),
          ...(ev.lifePct !== undefined ? { lifePct: ev.lifePct } : {}),
          ...(nextAreaId !== undefined ? { areaId: nextAreaId, levelId: nextAreaId } : {}),
          ...(nextAt !== undefined ? { at: nextAt, x: nextAt.x, y: nextAt.y } : {}),
          partyState,
          hostile,
          lootPermit,
          squelched: Boolean(squelched),
          ignored: Boolean(ignored),
        })
      }
      break
    }

    case 'Trade': {
      const action =
        ev.kind === 'accepted' || ev.kind === 'partnerAccept'
          ? 0x78
          : ev.kind === 'gold' && ev.action === undefined
            ? 0x7900 | (ev.isSelf ? 1 : 0)
            : (ev.action ?? 0)
      const gold = ev.gold ?? ev.amount
      this._trade.lastAction = action
      if (action === BUTTON_ACTION_OPEN_STASH) {
        this._npcInteraction = { ...this._npcInteraction, stashOpen: true, cubeOpen: false }
        break
      }
      if (action === BUTTON_ACTION_CLOSE_STASH) {
        this._npcInteraction = { ...this._npcInteraction, stashOpen: false }
        break
      }
      if (action === BUTTON_ACTION_OPEN_CUBE) {
        // D2Client.dll 0x6fb0a520[0x15] -> 0x6fb48070 (D2Game.dll 0x6fd03cd0 SKILLITEM_pSpell07_OpenCube):
        // Opens the Horadric Cube UI (`UPDATEUI_OPENCUBE = 21`). Quest reward windows (imbue/add_sockets/personalize)
        // are opened via S2C 0x52 OpenUi (`uiId = 6/7/8`), NOT S2C 0x77.
        this._npcInteraction = { ...this._npcInteraction, cubeOpen: true, stashOpen: false }
        break
      }
      if (ev.partnerId !== undefined) {
        this._trade.partnerId = ev.partnerId
      }
      if (ev.partnerName !== undefined) {
        this._trade.partnerName = ev.partnerName
      }
      if (!this._trade.partnerName && this._trade.partnerId !== undefined) {
        const pName =
          this._units.get(makeUnitKey('player', this._trade.partnerId))?.name ??
          this._party.get(this._trade.partnerId)?.charName
        if (pName) {
          this._trade.partnerName = pName
        }
      }
      if (gold !== undefined && (action & 0xff00) === 0x7900) {
        // 0x79 GoldInTrade: low byte is the decoder's `bySelf` flag (D2Client.dll 0x6fb5bfb0).
        if ((action & 0xff) !== 0) {
          this._trade.selfGold = gold
        } else {
          this._trade.partnerGold = gold
        }
        break
      }
      // 0x92 ClearDisplay
      if (action === 0x92 || (action & 0xff00) === 0x9200) {
        this._containers.clearTrade()
        break
      }
      // 0x78 TradeAccepted (D2Client.dll 0x6fb5bfd0 -> opens trade session with partner name & unitId)
      if (action === 0x78) {
        this._trade.active = true
        this._trade.pendingModal = null
        this._trade.selfAccepted = false
        this._trade.partnerAccepted = false
        this._trade.acceptDisabled = false
        break
      }
      // 0x77 ButtonActions (D2Client.dll 0x6fb0a520 jump table)
      if (action === 0x00) {
        // 0x00 RequestTrade (initiator waiting dialog: "Waiting for other player", 0x6fb099e0)
        this._trade.pendingModal = 'wait'
        this._trade.selfAccepted = false
        this._trade.partnerAccepted = false
        this._trade.acceptDisabled = false
      } else if (action === 0x01) {
        // 0x01 TargetTradeRequest (target invitation dialog: "%s wants to trade with you", 0x6fb099e0)
        this._trade.pendingModal = 'request'
        this._trade.selfAccepted = false
        this._trade.partnerAccepted = false
        this._trade.acceptDisabled = false
      } else if (action === 0x02 || action === 0x03 || action === 0x0c || action === 0x0d) {
        // 0x02 PartnerDeclined, 0x03 PartnerCanceled, 0x0C CloseTrade, 0x0D TradeCompleted
        this._trade.active = false
        this._trade.pendingModal = null
        this._trade.selfAccepted = false
        this._trade.partnerAccepted = false
        this._trade.acceptDisabled = false
        this._trade.partnerGold = 0
        this._trade.selfGold = 0
        this._containers.clearTrade()
      } else if (action === 0x04) {
        // 0x04 PlayerAccepted (0x6fb0a3a1)
        if (this._trade.acceptDisabled) {
          this._trade.selfAccepted = false
          this._trade.partnerAccepted = false
        } else {
          this._trade.selfAccepted = true
        }
      } else if (action === 0x05) {
        // 0x05 PartnerAccepted (0x6fb0a3b9)
        if (this._trade.acceptDisabled) {
          this._trade.selfAccepted = false
          this._trade.partnerAccepted = false
        } else {
          this._trade.partnerAccepted = true
        }
      } else if (action === 0x06) {
        // 0x06 OpenTrade / ResetCheckmarks (0x6fb0a3d5)
        this._trade.active = true
        this._trade.pendingModal = null
        this._trade.selfAccepted = false
        this._trade.partnerAccepted = false
      } else if (action === 0x07 || action === 0x08 || action === 0x09 || action === 0x0a) {
        // 0x07 SellerNoRoom, 0x08 BuyerNoRoom, 0x09 NotEnoughGold, 0x0A PartnerNotEnoughGold
        this._trade.selfAccepted = false
        this._trade.partnerAccepted = false
      } else if (action === 0x0e) {
        // 0x0E DisableAcceptButton (0x6fb0a4ff: item removed -> red lockout on accept button)
        this._trade.acceptDisabled = true
        this._trade.selfAccepted = false
        this._trade.partnerAccepted = false
      } else if (action === 0x0f) {
        // 0x0F EnableAcceptButton (0x6fb0a50e: lockout timer expired)
        this._trade.acceptDisabled = false
      }
      break
    }

    case 'Chat': {
      const senderUnitId = ev.unit?.id ?? (ev as any).unitId
      const senderUnitType = ev.unit?.unitType ?? (ev as any).unitType ?? 0
      const senderName = ev.from ?? ev.name1 ?? (ev as any).speaker ?? (ev as any).charName
      const effectiveKind: 'say' | 'whisper' | 'overhead' | 'system' | 'event' =
        (ev.kind as string) === 'chat'
          ? 'say'
          : (ev.kind ??
            ((ev as any).chatType === 0x05
              ? 'overhead'
              : (ev as any).chatType === 0x02 || (ev as any).chatType === 0x06
                ? 'whisper'
                : (ev as any).chatType === 0x04
                  ? 'system'
                  : 'say'))
      const effectiveEventType = ev.eventType ?? (ev as any).chatType

      // 1.13c Party Squelch / Ignore filtering (D2Client.dll 0x6fb2dee0):
      // - Squelched players: drop normal chat (0x01), overhead speech (0x05), and incoming whispers (0x02).
      // - Ignored players: drop incoming whispers (0x02).
      if (effectiveKind === 'say' || effectiveKind === 'overhead') {
        if (this.isPlayerSquelched(senderUnitId, senderName)) {
          break
        }
      } else if (effectiveKind === 'whisper' && effectiveEventType !== 0x06) {
        if (
          this.isPlayerSquelched(senderUnitId, senderName) ||
          this.isPlayerIgnored(senderUnitId, senderName)
        ) {
          break
        }
      }

      // 1.13c Overhead Speech Bubble (`!text`, S2C 0x26 chatType == 0x05, 0x6fb2dc00):
      // Sets unit overhead text with 10,000 ms (0x2710) lifetime; does NOT push to top-left chat stream or message log.
      if (effectiveKind === 'overhead') {
        let unit: ClientUnit | undefined
        if (senderUnitId !== undefined) {
          unit =
            this.getUnit(senderUnitType, senderUnitId) ??
            (senderUnitType === 0 || senderUnitType === 'player'
              ? this.ensureUnit('player', senderUnitId)
              : undefined)
        } else if (senderName) {
          for (const u of this._units.values()) {
            if (u.unitType === 'player' && u.name === senderName) {
              unit = u
              break
            }
          }
        }
        if (unit) {
          const cleaned = ev.text.trim()
          if (cleaned.length > 0) {
            const tNow = this.resolveEventNowMs(nowMs)
            unit.overheadText = cleaned
            unit.overheadExpireMs = tNow + OVERHEAD_SPEECH_TTL_MS
            unit.overheadColor = ev.color ?? 0
            ;(unit as { _overheadElapsedMs?: number | undefined })._overheadElapsedMs = 0
          } else {
            unit.overheadText = undefined
            unit.overheadExpireMs = undefined
            unit.overheadColor = undefined
            ;(unit as { _overheadElapsedMs?: number | undefined })._overheadElapsedMs = undefined
          }
        }
        break
      }

      // S2C 0x26 chatType == 7 opens the Inifuss recipe scroll UI (0x6fb29440) rather than chat log
      if (effectiveKind !== 'event' && effectiveEventType === 7) {
        break
      }

      const tNow = this.resolveEventNowMs(nowMs)
      let formattedEn = ev.text
      let formattedZh = ev.text
      let effectiveColor = ev.color ?? 0

      if (effectiveKind === 'event' && effectiveEventType !== undefined) {
        const argVal = ev.arg ?? 0
        const resolvedPlayerName =
          argVal !== 0
            ? (this._party.get(argVal)?.charName ??
              this.getUnit('player', argVal)?.name ??
              (argVal === this.selfId ? this._self.name : undefined))
            : undefined
        const fmtInput = {
          eventType: effectiveEventType,
          color: ev.color ?? 0,
          arg: argVal,
          subType: ev.subType ?? 0,
          name1: senderName ?? '',
          name2: ev.name2 ?? '',
          resolvedPlayerName,
        }
        const resEn = formatEventPacket0x5A(fmtInput, 'ENG')
        const resZh = formatEventPacket0x5A(fmtInput, 'CHI')
        formattedEn = resEn.text
        formattedZh = resZh.text
        effectiveColor = resEn.color
      } else if (effectiveKind === 'whisper') {
        const chatType = effectiveEventType === 0x06 ? 0x06 : 0x02
        const sender = senderName ?? ''
        const rawMsg = ev.name2 ?? ev.text
        formattedEn = formatChatPacket0x26(
          { chatType, color: ev.color ?? 2, senderName: sender, message: rawMsg },
          'ENG',
        ).text
        formattedZh = formatChatPacket0x26(
          { chatType, color: ev.color ?? 2, senderName: sender, message: rawMsg },
          'CHI',
        ).text
        effectiveColor = ev.color ?? 2
        if (sender) {
          this._lastWhisperTarget = sender
        }
      } else if (effectiveKind === 'say') {
        const sender = senderName ?? ''
        const rawMsg = ev.name2 ?? ev.text
        if (sender && !rawMsg.startsWith(`${sender}: `) && !rawMsg.startsWith(`${sender}：`)) {
          formattedEn = formatChatPacket0x26(
            { chatType: 0x01, color: ev.color ?? 0, senderName: sender, message: rawMsg },
            'ENG',
          ).text
          formattedZh = formatChatPacket0x26(
            { chatType: 0x01, color: ev.color ?? 0, senderName: sender, message: rawMsg },
            'CHI',
          ).text
        }
      } else if (effectiveKind === 'system') {
        const rawMsg = ev.name2 ?? ev.text
        formattedEn = rawMsg
        formattedZh = rawMsg
        if (ev.color === undefined && (ev as any).chatType === 0x04) {
          effectiveColor = 4
        }
      }

      const displayText = this.lang === 'ENG' ? formattedEn : formattedZh
      const entry: ChatLogEntry = {
        id: this._nextChatEntryId++,
        kind: effectiveKind,
        from: senderName,
        unit:
          ev.unit ??
          (senderUnitId !== undefined ? { unitType: senderUnitType, id: senderUnitId } : undefined),
        text: displayText,
        rawText: ev.name2 ?? ev.text,
        formattedEn,
        formattedZh,
        color: effectiveColor,
        eventType: effectiveEventType,
        subType: ev.subType,
        arg: ev.arg,
        createdAtMs: tNow,
        expireAtMs: tNow + CHAT_LINE_TTL_MS,
        elapsedMs: 0,
      }

      // Persistent Message Log (`0x6fb2db7e`: max 128 entries, unaffected by 10s overlay expiration)
      this._chatLog.push(entry)
      while (this._chatLog.length > MESSAGE_LOG_MAX_ENTRIES) {
        this._chatLog.shift()
      }

      // Active Top-Left Chat Stream (`0x6fb2b730`: expires after 10,000 ms)
      this._activeChatStream.push({ ...entry })
      while (this._activeChatStream.length > MESSAGE_LOG_MAX_ENTRIES) {
        this._activeChatStream.shift()
      }
      break
    }

    case 'PlaySound': {
      // S2C 0xA4 MonsterSpecialSkill (`src/netproto/d2gs/s2c/misc.ts:151`) decodes as
      // `{ type: 'PlaySound', sound: classId }` with `unit === undefined`.
      // D2Client.dll `0x6fb5d760` plays ZERO sound — guard `if (!ev.unit) break;` (D8 / D24).
      if (!ev.unit) {
        break
      }
      // S2C 0x2C PlaySound (`D2Client.dll` `0x6fb5d740` -> `0x6fad3f20`):
      // Looks up unit via `D2CLIENT_FindClientSideUnit` (`0x6fb54e20`) BEFORE switching on `nSound`.
      // If the unit is not present in ClientWorld, `0x6fad3f3b` returns immediately and plays nothing.
      const uType = unitTypeFromId(ev.unit.unitType)
      const uId = Number(ev.unit.id ?? 0)
      const isSelfPlayer = uType === 'player' && this.selfId !== 0 && uId === this.selfId
      const unit = this.getUnit(uType, uId)
      if (!unit && !isSelfPlayer) {
        break
      }
      const unitClassId = unit ? unit.classId : (this._self.charClass ?? 0)
      const unitX = unit ? unit.x : this._self.x
      const unitY = unit ? unit.y : this._self.y
      const unitMode = unit ? unit.mode : this._self.mode
      const modSkillId = unit ? unit.stats.get(350) : this._self.stats.get(350)
      const resolved = resolve0x2CPlaySound113c(
        ev.sound,
        {
          unitType: uType,
          id: uId,
          classId: unitClassId,
          x: unitX,
          y: unitY,
          mode: unitMode,
          isLocalPlayer: isSelfPlayer,
          ...(modSkillId > 0 ? { modifierListSkillId: modSkillId } : {}),
          hasSkill: (skillId: number) =>
            isSelfPlayer ? (this._self.skills.get(skillId) ?? 0) > 0 : true,
          ...(unit?.isUnique !== undefined ? { isUnique: unit.isUnique } : {}),
          ...(unit?.isChampion !== undefined ? { isChampion: unit.isChampion } : {}),
          ...(unit?.isSuperUnique !== undefined ? { isSuperUnique: unit.isSuperUnique } : {}),
          ...(unit?.superUniqueId !== undefined ? { superUniqueId: unit.superUniqueId } : {}),
          ...(unit?.name !== undefined ? { name: unit.name } : {}),
        },
        {
          localPlayerId: this.selfId,
          localPlayerX: this._self.x,
          localPlayerY: this._self.y,
        },
      )
      if (resolved !== null) {
        if (resolved.speechSoundId !== undefined) {
          this._speechPendingCount += 1
        }
        this.pushSoundRequest(resolved)
      }
      break
    }

    case 'Merc': {
      if (ev.kind === 'assign' && ev.mercId !== undefined) {
        const isSummonAction = (ev as any).isSummonAction === true || (ev as any).summonAction !== undefined
        const petType = (ev as any).petType ?? ((ev as any).stat !== undefined ? ev.value : undefined) ?? 0
        const isSummonPet = isSummonAction && petType !== 7

        if (isSummonPet) {
          const action = (ev as any).summonAction ?? ev.stat ?? 1
          if (action === 0) {
            this._pets.delete(ev.mercId)
          } else {
            const petUnit = this.getUnit('monster', ev.mercId)
            if (petUnit && petUnit.classId === 0 && ev.classId && ev.classId > 0) {
              petUnit.classId = ev.classId
            }
            const petOwnerId = ev.ownerId ?? this.selfId
            if (petUnit) {
              petUnit.ownerType = 'player'
              petUnit.ownerId = petOwnerId
            }
            const resolvedPetClassId = ev.classId ?? petUnit?.classId ?? 0
            if (ev.mercId < 900000 && (resolvedPetClassId === 356 || resolvedPetClassId === 357)) {
              for (const m of Array.from(this._monsters.values())) {
                if (m.id >= 900000 && m.classId === resolvedPetClassId) {
                  this._units.delete(m.key)
                  this._monsters.delete(m.id)
                  this._pets.delete(m.id)
                  this.npcMotion.removeMonster(m.id)
                }
              }
            }
            this._pets.set(ev.mercId, {
              unitId: ev.mercId,
              ownerId: petOwnerId,
              petType,
              classId: resolvedPetClassId,
              lifePct: petUnit?.lifePct && petUnit.lifePct > 0 ? petUnit.lifePct : 128,
              lifePctScale: 128,
              isDead: false,
            })
          }
        } else {
          if (ev.ownerId === undefined || ev.ownerId === this.selfId || this.selfId === 0) {
            if (isSummonAction && (ev as any).summonAction === 0) {
              if (this._merc && this._merc.mercId === ev.mercId) {
                this._merc.isDead = true
                this._merc.lifePct = 0
              }
              this._pets.delete(ev.mercId)
            } else {
              const prevMerc = this._merc
              const evSeed =
                typeof (ev as { seed?: number }).seed === 'number'
                  ? (ev as { seed?: number }).seed
                  : !isSummonAction && typeof ev.value === 'number'
                    ? ev.value
                    : undefined
              // Issue #994: Detect when S2C 0x81 AssignMerc replaces an existing mercenary
              // (vs resurrecting the same dead mercenary or re-syncing on area transition).
              const isReplacingMerc =
                !isSummonAction &&
                ev.mercId !== 0 &&
                prevMerc !== null &&
                ((ev.classId !== undefined &&
                  ev.classId > 0 &&
                  prevMerc.classId > 0 &&
                  ev.classId !== prevMerc.classId) ||
                  (ev.nameId !== undefined &&
                    prevMerc.nameId !== undefined &&
                    ev.nameId !== prevMerc.nameId) ||
                  (evSeed !== undefined &&
                    prevMerc.seed !== undefined &&
                    evSeed !== prevMerc.seed) ||
                  (!prevMerc.isDead &&
                    prevMerc.mercId !== 0 &&
                    ev.mercId !== prevMerc.mercId))
              if (ev.mercId === 0 || isReplacingMerc) {
                this._containers.clearMerc()
              }
              if (prevMerc && prevMerc.mercId !== 0 && prevMerc.mercId !== ev.mercId) {
                this._pets.delete(prevMerc.mercId)
                if (isReplacingMerc) {
                  this._monsters.delete(prevMerc.mercId)
                  this.npcMotion.removeMonster(prevMerc.mercId)
                  this._units.delete(makeUnitKey(1, prevMerc.mercId))
                }
              }
              this._self.mercId = ev.mercId === 0 ? null : ev.mercId
              const mercUnit = ev.mercId !== 0 ? this.getUnit('monster', ev.mercId) : undefined
              const resolvedClassId =
                ev.classId ?? (isReplacingMerc ? undefined : prevMerc?.classId) ?? mercUnit?.classId ?? 0
              if (mercUnit && mercUnit.classId === 0 && resolvedClassId > 0) {
                mercUnit.classId = resolvedClassId
                const motionUnit = this.npcMotion.getUnit(ev.mercId)
                if (motionUnit && motionUnit.dwClassId === 0) {
                  motionUnit.dwClassId = resolvedClassId
                }
              }
              const resolvedNameId =
                ev.nameId !== undefined
                  ? ev.nameId
                  : !isReplacingMerc && prevMerc?.nameId !== undefined
                    ? prevMerc.nameId
                    : undefined
              const resolvedSeed =
                evSeed !== undefined
                  ? evSeed
                  : !isReplacingMerc && prevMerc?.seed !== undefined
                    ? prevMerc.seed
                    : undefined
              const resolvedName =
                resolvedNameId !== undefined
                  ? resolveHirelingName(resolvedClassId, resolvedNameId, 'ENG')
                  : !isReplacingMerc
                    ? prevMerc?.name
                    : undefined
              const resolvedNameZh =
                resolvedNameId !== undefined
                  ? resolveHirelingName(resolvedClassId, resolvedNameId, 'CHI')
                  : !isReplacingMerc
                    ? prevMerc?.nameZh
                    : undefined
              this._merc =
                ev.mercId === 0
                  ? null
                  : {
                      mercId: ev.mercId,
                      ownerId: ev.ownerId ?? this.selfId,
                      classId: resolvedClassId,
                      ...(resolvedNameId !== undefined ? { nameId: resolvedNameId } : {}),
                      ...(resolvedSeed !== undefined ? { seed: resolvedSeed } : {}),
                      ...(resolvedName !== undefined ? { name: resolvedName } : {}),
                      ...(resolvedNameZh !== undefined ? { nameZh: resolvedNameZh } : {}),
                      exp: isReplacingMerc ? undefined : prevMerc?.exp,
                      lifePct: mercUnit?.lifePct && mercUnit.lifePct > 0 ? mercUnit.lifePct : 128,
                      lifePctScale: 128,
                      isDead: false,
                      reviveCost: 0,
                      stats: isReplacingMerc
                        ? new Map<number, number>()
                        : (prevMerc?.stats ?? new Map<number, number>()),
                      hireList: this._mercHireList,
                    }
              if (ev.mercId !== 0) {
                for (const [id, p] of this._pets.entries()) {
                  if (
                    p.petType === 7 &&
                    p.ownerId === (ev.ownerId ?? this.selfId) &&
                    id !== ev.mercId
                  ) {
                    this._pets.delete(id)
                  }
                }
                this._pets.set(ev.mercId, {
                  unitId: ev.mercId,
                  ownerId: ev.ownerId ?? this.selfId,
                  petType: 7,
                  classId: resolvedClassId,
                  lifePct: mercUnit?.lifePct && mercUnit.lifePct > 0 ? mercUnit.lifePct : 128,
                  lifePctScale: 128,
                  isDead: false,
                })
              } else {
                for (const [id, p] of this._pets.entries()) {
                  if (p.petType === 7 && p.ownerId === (ev.ownerId ?? this.selfId)) {
                    this._pets.delete(id)
                  }
                }
              }
            }
          }
        }
      } else if (ev.kind === 'exp' && ev.value !== undefined) {
        // D2Client.dll 0x6FB5EA40 (0xA0..0xA2 MercGainExp): looks up g_pClientUnitTable[1]
        // without allocating a unit at (0, 0) when absent.
        const statId = ev.stat ?? ev.statId ?? 13
        const mUnit = ev.mercId !== undefined ? this.getUnit('monster', ev.mercId) : undefined
        if (mUnit) {
          const v = mUnit.stats.get(statId) + ev.value
          mUnit.stats.set(statId, v)
          if (this._merc && this._merc.mercId === ev.mercId) {
            this._merc.stats.set(statId, v)
            this._merc.exp = v
          }
        } else if (this._merc && this._merc.mercId === ev.mercId) {
          const v = (this._merc.stats.get(statId) ?? 0) + ev.value
          this._merc.stats.set(statId, v)
          this._merc.exp = v
        }
      } else if (ev.kind === 'stat' || ev.kind === 'attr' || ev.kind === 'reviveCost') {
        const statId = ev.stat ?? ev.statId
        const revNameId =
          ev.nameId ?? ev.deadNameId ?? (ev as { reviveNameId?: number }).reviveNameId
        const revCost = ev.reviveCost ?? ev.value
        if (ev.mercId !== undefined && statId !== undefined && ev.value !== undefined) {
          // D2Client.dll 0x6FB5EA40 (0x9E..0xA2 MercAttribute): looks up g_pClientUnitTable[1]
          // without allocating a phantom classId=0 monster unit at (0, 0) when absent.
          const mercUnit = this.getUnit('monster', ev.mercId)
          if (mercUnit) {
            mercUnit.stats.set(statId, ev.value)
          }
          if (this._merc && this._merc.mercId === ev.mercId) {
            this._merc.stats.set(statId, ev.value)
          }
        } else if (ev.mercId === undefined && revNameId !== undefined && revCost !== undefined) {
          // 0x9B MercReviveCost
          const currentClassId = this._merc?.classId ?? 0
          const resolvedName = resolveHirelingName(currentClassId, revNameId, 'ENG')
          const resolvedNameZh = resolveHirelingName(currentClassId, revNameId, 'CHI')
          if (!this._merc) {
            this._merc = {
              mercId: 0,
              ownerId: this.selfId,
              classId: 0,
              nameId: revNameId,
              name: resolvedName,
              nameZh: resolvedNameZh,
              lifePct: 0,
              isDead: true,
              reviveCost: revCost,
              deadNameId: revNameId,
              reviveNameId: revNameId,
              stats: new Map<number, number>(),
              hireList: this._mercHireList,
            }
          } else {
            if (this._merc.mercId) {
              this._pets.delete(this._merc.mercId)
            }
            this._merc.nameId = revNameId
            this._merc.name = resolvedName
            this._merc.nameZh = resolvedNameZh
            this._merc.deadNameId = revNameId
            this._merc.reviveNameId = revNameId
            this._merc.reviveCost = revCost
            this._merc.lifePct = 0
            this._merc.isDead = true
          }
        }
      } else if (
        ev.kind === 'hireList' ||
        ev.kind === 'forHireListStart' ||
        ev.kind === 'hireListStart' ||
        ev.kind === 'forHire'
      ) {
        if (ev.nameId === undefined || ev.kind === 'forHireListStart' || ev.kind === 'hireListStart') {
          // 0x4F StartMercList
          this._mercHireList.length = 0
        } else {
          // 0x4E MercForHire
          this._mercHireList.push({
            nameId: ev.nameId,
            seed: ev.seed ?? ev.value ?? 0,
          })
        }
      }
      break
    }

    case 'Portal': {
      const localId = ev.localId ?? (ev as any).portalId ?? 0
      this._portals.set(localId, {
        localId,
        remoteId: ev.remoteId,
        ownerName: ev.ownerName,
        ownerId: ev.ownerId,
        areaId: ev.areaId,
        flags: ev.flags,
      })
      break
    }

    case 'Pong':
      this.lastRttMs = ev.rttMs
      break

    case 'Warden':
    case 'SaveChunk':
    case 'Opaque':
      break
  }

  for (const cb of this._changeListeners) {
    cb(ev)
  }
}

/**
 * Revive (#95) resurrects the corpse unit in place (D2Game `SKILLS_SrvDo058_Revive` 0x6FC71340: same unitId and
 * classId, mode 12 -> 1, then STATE_REVIVE 96), unlike Raise Skeleton/Mage which spawn a new unit. The client cast
 * (`SKILLS_CltSt24_Revive` 0x6FB78620) only spawns revivesmall/medium/large, so a living unit must never keep the
 * corpse-consumption marks STATE_CORPSE_NODRAW (104) / STATE_CORPSE_NOSELECT (118) / `corpseSuppressed`, which
 * the drawables and pickers treat as "corpse gone".
 */
export function clearRevivedCorpseMarks113c(unit: ClientUnit): void {
  if (unit.unitType !== 'monster') return
  unit.states.remove(104)
  unit.states.remove(118)
  unit.corpseSuppressed = false
}

export function applyUnitModeImmediateImpl(
  this: ClientWorldInternal,
  unit: ClientUnit,
  ev: Extract<ServerEvent, { readonly type: 'UnitMode' }>,
  nowMs?: number,
): void {
  const uId = unit.id
  if (unit.unitType === 'object' && ev.eventCode !== undefined && ev.eventCode !== 3) {
    // S2C 0x0E ObjectEvent 0x6fad5ce0: event 0x15 is the operate fx (0x6fad4b90; no mode change, no light), and
    // any event other than 3 / 0x15 is fatal (0x6fad5ced).
    if (ev.eventCode === 0x15) return
    throw new RangeError(
      `S2C 0x0E: object ${String(uId)} event ${String(ev.eventCode)} is not 3 or 0x15 (fatal at 0x6fad5ced)`,
    )
  }
  if (unit.unitType === 'monster') {
    this._monsters.set(unit.id, unit)
  }
  const wasDead = unit.dead
  if (ev.mode !== undefined) {
    if (unit.unitType === 'player' && (ev.mode < 0 || ev.mode > 19)) {
      throw new RangeError(`Invalid PlrMode: ${ev.mode}, expected 0..19`)
    }
    if (unit.unitType === 'monster' && (ev.mode < 0 || ev.mode > 15)) {
      throw new RangeError(`Invalid MonMode: ${ev.mode}, expected 0..15`)
    }
  }

  if (unit.unitType === 'monster') {
    if (unit.x === 0 && unit.y === 0) {
      if (ev.at && (ev.at.x !== 0 || ev.at.y !== 0)) {
        unit.x = ev.at.x
        unit.y = ev.at.y
      } else if (ev.npc?.driftCheckAt && (ev.npc.driftCheckAt.x !== 0 || ev.npc.driftCheckAt.y !== 0)) {
        unit.x = ev.npc.driftCheckAt.x
        unit.y = ev.npc.driftCheckAt.y
      } else if (
        (this.isOwnMercUnitId(uId) || this.isOwnPetUnitId(uId)) &&
        (this._self.x !== 0 || this._self.y !== 0)
      ) {
        unit.x = this._self.x
        unit.y = this._self.y
      }
      if (unit.x !== 0 || unit.y !== 0) {
        unit.targetX = unit.x
        unit.targetY = unit.y
      }
    }
    let npcUnit = this.npcMotion.getUnit(uId)
    if (!npcUnit) {
      npcUnit = this.npcMotion.spawnMonster({
        unitId: unit.id,
        classId: unit.classId,
        x: unit.x,
        y: unit.y,
        mode: unit.mode,
        direction: unit.direction,
        lifePct: unit.lifePct,
        isDead: unit.dead,
        ...(unit.velocityPercent !== undefined ? { stat67: unit.velocityPercent } : {}),
      })
    } else if (
      npcUnit.pDynamicPath &&
      PATH_GetXPosition(npcUnit.pDynamicPath) === 0 &&
      PATH_GetYPosition(npcUnit.pDynamicPath) === 0 &&
      (unit.x !== 0 || unit.y !== 0)
    ) {
      this.npcMotion.reassignMonster(uId, unit.x, unit.y)
    }
    const now = this.resolveEventNowMs(nowMs)
    const preserveActiveCast =
      ev.mode === 1 &&
      unit.castState !== undefined &&
      now < unit.castState.untilMs &&
      now - unit.castState.startedAtMs <= 150
    if (!preserveActiveCast) {
      this.clearUnitCastState(unit)
    }
    if (ev.hitClass !== undefined) {
      unit.hitClass = ev.hitClass
    }
    if (ev.lifePct !== undefined) {
      unit.lifePct = ev.lifePct
      npcUnit.lifeByte = ev.lifePct
    } else if (
      ev.mode !== undefined &&
      ev.mode !== 0 &&
      ev.mode !== 12 &&
      unit.lifePct <= 0
    ) {
      unit.lifePct = 128
      npcUnit.lifeByte = 128
    }
    if (
      wasDead &&
      ev.mode !== undefined &&
      ev.mode !== 0 &&
      ev.mode !== 12 &&
      (ev.lifePct === undefined || ev.lifePct > 0)
    ) {
      npcUnit.dwFlags = (npcUnit.dwFlags & ~0x10000) >>> 0
      unit.deathFxTriggered = false
      this._deadSoundUnitIds.delete(unit.id)
      clearRevivedCorpseMarks113c(unit)
    }
    if (ev.npc !== undefined) {
      this.npcMotion.applyCommandForUnit(uId, ev.npc)
    } else if (ev.mode === 0) {
      this.npcMotion.executeCmd0x6FAFDC70(npcUnit, 0x08, [
        0,
        0,
        0,
        2,
        0,
        4,
        ev.hitClass ?? 0,
      ])
      this.syncClientUnitFromNpcMotion(npcUnit)
    } else if (ev.mode === 12) {
      this.npcMotion.executeCmd0x6FAFDC70(npcUnit, 0x09, [
        0,
        0,
        0,
        2,
        0,
        4,
        ev.hitClass ?? 0,
      ])
      this.syncClientUnitFromNpcMotion(npcUnit)
    } else if (ev.mode === 3) {
      this.npcMotion.applyGetHitForUnit(uId, 3, ev.lifePct ?? unit.lifePct, ev.hitClass)
    } else if (ev.mode === undefined && ev.hitClass !== undefined) {
      this.npcMotion.executeCmd0x6FAFDC70(npcUnit, 0x13, [
        0,
        0,
        ev.lifePct ?? unit.lifePct,
        0,
        0,
        0,
        ev.hitClass,
      ])
      this.syncClientUnitFromNpcMotion(npcUnit)
      this.emitMonsterModeSound(unit, 13)
    } else if (ev.mode !== undefined && !preserveActiveCast) {
      if (ev.at && (ev.at.x !== 0 || ev.at.y !== 0)) {
        this.npcMotion.runDriftCheck0x6FADA1B0(npcUnit, ev.at.x, ev.at.y)
      }
      const forceRestart = isMonsterOneShotMode(ev.mode) || ev.mode === 14
      const restarted = this.npcMotion.changeAnimMode0x6FADA6C0(npcUnit, ev.mode, forceRestart)
      npcUnit.lastAnimRestarted = false
      this.syncClientUnitFromNpcMotion(npcUnit, undefined, restarted)
    }
    if (!preserveActiveCast && !unit.dead && !unit.castState) {
      const mMode = unit.mode
      if (
        mMode === 4 ||
        mMode === 5 ||
        mMode === 7 ||
        mMode === 8 ||
        mMode === 9 ||
        mMode === 10 ||
        mMode === 11 ||
        mMode === 14
      ) {
        let tx: number | undefined
        let ty: number | undefined
        const evAny = ev as Record<string, any>
        const rawTargetRef =
          evAny.target ??
          evAny.targetUnit ??
          (ev.npc as any)?.targetUnit ??
          (ev.npc?.opcode === 0x6c &&
          Array.isArray(ev.npc.s) &&
          typeof ev.npc.s[1] === 'number' &&
          ev.npc.s[1] > 0
            ? { unitType: ev.npc.s[0] ?? 1, id: ev.npc.s[1] }
            : undefined)
        if (rawTargetRef && typeof rawTargetRef === 'object' && rawTargetRef.id !== undefined) {
          const tType = rawTargetRef.unitType ?? 0
          unit.targetUnit = { unitType: unitTypeFromId(tType), id: Number(rawTargetRef.id) }
          const tUnit = this.getUnit(tType, rawTargetRef.id)
          if (tUnit && (tUnit.x !== 0 || tUnit.y !== 0)) {
            tx = tUnit.x
            ty = tUnit.y
          } else if (
            (tType === 0 || tType === 'player') &&
            (rawTargetRef.id === this.selfId || this.selfId === 0) &&
            (this._self.x !== 0 || this._self.y !== 0)
          ) {
            tx = this._self.x
            ty = this._self.y
          }
        }
        if (tx === undefined || ty === undefined) {
          if (typeof evAny.targetX === 'number' && typeof evAny.targetY === 'number') {
            tx = evAny.targetX
            ty = evAny.targetY
          } else if (
            typeof (ev.npc as any)?.targetX === 'number' &&
            typeof (ev.npc as any)?.targetY === 'number'
          ) {
            tx = (ev.npc as any).targetX
            ty = (ev.npc as any).targetY
          }
        }
        this.spawnMonsterModeMissile(unit, mMode, tx, ty)
      } else if ((unit as any)._lastModeMissileMode !== undefined) {
        ;(unit as any)._lastModeMissileMode = undefined
      }
    }
    if (wasDead && !unit.dead) {
      unit.diedAtMs = undefined
      clearRevivedCorpseMarks113c(unit)
    }
    if (unit.dead) {
      if (!wasDead) {
        unit.diedAtMs = this._timeMs
      }
      unit.lifePct = 0
      unit.moveMode = 'stop'
      unit.targetX = unit.x
      unit.targetY = unit.y
      unit.targetUnit = undefined
      unit.setDirection(unit.direction)
      this.clearUnitCastState(unit)
      unit.modeDurationMs = undefined
      unit.modeUntilMs = undefined
      unit.animStepSpeed256 = undefined
      unit.animEffRate = undefined
    }
    if (!wasDead && (unit.dead || ev.mode === 0 || ev.mode === 12 || (ev.lifePct !== undefined && ev.lifePct <= 0))) {
      this.triggerMonsterDeathFx(unit)
    } else if (
      !unit.dead &&
      (ev.mode === 3 || ev.npc?.cmd === 0x06 || (ev.mode === undefined && ev.hitClass !== undefined))
    ) {
      this.triggerMonsterGetHitFx(unit)
    }
    if (this._merc && unit.id === this._merc.mercId) {
      if (ev.lifePct !== undefined) {
        this._merc.lifePct = ev.lifePct
        this._merc.lifePctScale = 128
        syncMercStat6FromLifePct(this, unit, ev.lifePct, 128)
      }
      if (ev.mode === 0 || ev.mode === 12 || (ev.lifePct !== undefined && ev.lifePct <= 0)) {
        this._merc.isDead = true
        this._merc.lifePct = 0
        this._merc.lifePctScale = 128
        syncMercStat6FromLifePct(this, unit, 0, 128)
      }
    }
    const pet = this._pets.get(unit.id)
    if (pet) {
      if (ev.lifePct !== undefined) {
        pet.lifePct = ev.lifePct
        pet.lifePctScale = 128
      }
      if (ev.mode === 0 || ev.mode === 12 || (ev.lifePct !== undefined && ev.lifePct <= 0)) {
        pet.isDead = true
        pet.lifePct = 0
        pet.lifePctScale = 128
      }
    }
    return
  }

  if (ev.mode !== undefined) {
    const prevObjectMode = unit.mode
    let resolvedMode = ev.mode
    if (unit.unitType === 'player' && resolvedMode === 1) {
      const posAreaId =
        ev.at && (ev.at.x !== 0 || ev.at.y !== 0)
          ? this.resolveAreaFromRevealedRooms(ev.at.x, ev.at.y) || this.areaId
          : this.areaId
      if (isTownLevel(posAreaId)) {
        resolvedMode = 5
      }
    }
    const now = this.resolveEventNowMs(nowMs)
    const preserveActiveCast =
      (resolvedMode === 1 || resolvedMode === 5) &&
      unit.castState !== undefined &&
      now < unit.castState.untilMs &&
      now - unit.castState.startedAtMs <= 150
    if (!preserveActiveCast) {
      if (unit.unitType === 'object' && unit.objectSoundMode === undefined) {
        unit.objectSoundMode = prevObjectMode
      }
      this.clearUnitCastState(unit)
      unit.mode = resolvedMode
    }
    if (
      wasDead &&
      unit.unitType === 'player' &&
      resolvedMode !== 0 &&
      resolvedMode !== 17 &&
      (ev.lifePct === undefined || ev.lifePct > 0)
    ) {
      unit.lifePct = ev.lifePct !== undefined && ev.lifePct > 0 ? ev.lifePct : 128
    }
    const isMovingMode =
      resolvedMode === 2 ||
      resolvedMode === 3 ||
      resolvedMode === 6 ||
      resolvedMode === 19
    if (!isMovingMode) {
      unit.moveMode = 'stop'
      unit.moving = false
      unit.targetUnit = undefined
      unit.targetX = unit.x
      unit.targetY = unit.y
    }
    if (!preserveActiveCast) {
      unit.modeStartedAtMs = now
      if (unit.unitType === 'object') {
        unit.animStartedAtMs = now
      }
      unit.modeElapsedMs = 0
      if (
        unit.unitType === 'player' &&
        (resolvedMode === 4 || (resolvedMode >= 7 && resolvedMode <= 16) || resolvedMode === 18 || resolvedMode === 19)
      ) {
        const speedInfo = this.resolvePlayerAnimSpeed(resolvedMode === 19 ? 4 : resolvedMode, unit.id)
        unit.modeDurationMs = speedInfo.durationMs
        unit.modeUntilMs = now + speedInfo.durationMs
        unit.animStepSpeed256 = speedInfo.stepSpeed256
        unit.animEffRate = speedInfo.effRate
      } else if (unit.unitType === 'player' && (resolvedMode === 2 || resolvedMode === 3 || resolvedMode === 6)) {
        const speedInfo = this.resolvePlayerAnimSpeed(resolvedMode, unit.id)
        unit.modeDurationMs = undefined
        unit.modeUntilMs = undefined
        unit.animStepSpeed256 = speedInfo.stepSpeed256
        unit.animEffRate = speedInfo.effRate
        if (unit.id === this.selfId || this.selfId === 0) {
          this._selfLocomotionAnimSpeed256 = speedInfo.stepSpeed256
        }
      } else if (
        unit.unitType === 'object' &&
        resolvedMode === 1 &&
        getObjectsTxtRecord113c(unit.classId).isDoor !== 0
      ) {
        // Doors only (DoorAnim 0x6fad5400 is not ported); every other object leaves mode 1 through the
        // 1.13c animation tick (tickObjectAnim in stepDiscreteSimulationTick).
        const objMeta = unit.objectMeta
        const opFrames = objMeta?.frameCnt?.[1] || 15
        const opDelta = objMeta?.frameDelta?.[1] || 200
        const durationMs = Math.ceil(((opFrames * 256) / opDelta) * 40)
        unit.modeDurationMs = durationMs
        unit.modeUntilMs = now + durationMs
        unit.animStepSpeed256 = opDelta
        unit.animEffRate = undefined
      } else {
        unit.modeDurationMs = undefined
        unit.modeUntilMs = undefined
        unit.animStepSpeed256 = undefined
        unit.animEffRate = undefined
      }
    }
    if (unit.unitType === 'object' && ev.eventCode === 3) {
      // ObjectSetMode 0x6fad59f0 on a non-door:
      // - 0x6fad5a1b: D2Common #11090 (0x6fd83920) runs #10595 when prevObjectMode !== resolvedMode;
      // - 0x6fad5af9: SetObjectLight(Lit[packet mode]) even when the mode is unchanged;
      // - 0x6fad5b05: D2Common #10595 again in the tail.
      // Doors take DoorSetMode 0x6fad5040, which never touches a light. UnitMode without an event code
      // (S2C 0x98, 0x76, the port's own remaps) never touches the light either.
      const objectRecord = getObjectsTxtRecord113c(unit.classId)
      if (objectRecord.isDoor === 0) {
        if (prevObjectMode !== resolvedMode) {
          resetObjectAnim(unit, objectRecord)
        }
        setObjectLight(unit, objectRecord, objectLitForMode(objectRecord, resolvedMode))
        resetObjectAnim(unit, objectRecord)
      }
    }
  }
  if (ev.at && (ev.at.x !== 0 || ev.at.y !== 0)) {
    unit.x = ev.at.x
    unit.y = ev.at.y
    if (!unit.moving) {
      unit.targetX = ev.at.x
      unit.targetY = ev.at.y
    }
  }
  if (ev.hitClass !== undefined) {
    unit.hitClass = ev.hitClass
  }
  if (ev.lifePct !== undefined) {
    if (unit.unitType === 'player') {
      const rosterEntry = this._party.get(unit.id)
      if (rosterEntry) {
        this._party.set(unit.id, { ...rosterEntry, lifePct: ev.lifePct })
      }
      if (unit.mode === 0 || unit.mode === 17) {
        unit.lifePct = 0
      } else if (ev.lifePct > 0) {
        unit.lifePct = ev.lifePct
      }
    } else {
      unit.lifePct = ev.lifePct
    }
  }
  if (unit.dead) {
    unit.lifePct = 0
    unit.moveMode = 'stop'
    unit.targetX = unit.x
    unit.targetY = unit.y
    unit.targetUnit = undefined
    unit.setDirection(unit.direction)
    this.clearUnitCastState(unit)
    unit.modeDurationMs = undefined
    unit.modeUntilMs = undefined
    unit.animStepSpeed256 = undefined
    unit.animEffRate = undefined
  }
  if (unit.unitType === 'object') {
    this.updateObjectCollisionFootprint(unit)
    if (ev.mode !== undefined && unit.mode !== undefined) {
      const objectRecord = getObjectsTxtRecord113c(unit.classId)
      for (const snd of updateObjectModeSound113c(unit, objectRecord)) {
        this.pushSoundRequest({
          ...(snd.kind !== undefined ? { kind: snd.kind } : {}),
          ...(snd.soundId > 0 ? { soundId: snd.soundId } : {}),
          unit: { unitType: 'object', id: unit.id, x: unit.x, y: unit.y },
          x: unit.x,
          y: unit.y,
          ...(snd.delayTicks !== undefined ? { delayTicks: snd.delayTicks } : {}),
        })
      }
    }
  }
  if (unit.unitType === 'player' && (ev.mode !== undefined || ev.hitClass !== undefined)) {
    const clsIdx =
      unit.classId >= 0 && unit.classId <= 6 ? unit.classId : (this._self.charClass ?? 0)
    const playerSounds = PLAYER_SOUND_TABLE_0x6FBA7694[clsIdx] ?? PLAYER_SOUND_TABLE_0x6FBA7694[0]!
    const playerUnitRef = { unitType: 'player' as const, id: unit.id, x: unit.x, y: unit.y }
    const effHitClass = ev.hitClass ?? 0
    const emitPlayerHitClassSounds = () => {
      if (effHitClass <= 0) return
      for (const hitSoundId of resolveHitClassSoundIds113c(effHitClass)) {
        this.pushSoundRequest({
          soundId: hitSoundId,
          unit: playerUnitRef,
          x: unit.x,
          y: unit.y,
        })
      }
    }
    if (!wasDead && (ev.mode === 0 || ev.mode === 17)) {
      emitPlayerHitClassSounds()
      this.emitUnitDeathSound({
        unitType: 'player',
        unitId: unit.id,
        classId: clsIdx,
        x: unit.x,
        y: unit.y,
      })
    } else if (
      !unit.dead &&
      (ev.mode === 4 || ev.mode === 19 || (ev.mode === undefined && ev.hitClass !== undefined))
    ) {
      // D2Client.dll 0x6fac99d1 (0x06 GH -> mode 4), 0x6fac9a0d (0x13 damage-no-FHR -> mode 19),
      // 0x6fac9b0d (0x14 KB -> mode 19), and 0x0C damage-only: emit HitClass impact sounds + player getHit1
      emitPlayerHitClassSounds()
      if ((effHitClass & 0xf0) !== 0xa0) {
        this.pushSoundRequest({
          soundId: playerSounds.getHit1,
          unit: playerUnitRef,
          x: unit.x,
          y: unit.y,
        })
      }
    } else if (!unit.dead && ev.mode === 9) {
      // D2Client.dll 0x6fac9b5c (0x12 BL -> mode 9) -> 0x6fad2d60 -> 0x6fad21c0: block_weapon_1 (398) / block_arrow_1 (401)
      this.pushSoundRequest({
        soundId: resolveBlockSoundId113c(effHitClass || (unit.hitClass ?? 0)),
        unit: playerUnitRef,
        x: unit.x,
        y: unit.y,
      })
    } else if (!unit.dead && (ev.mode === 2 || ev.mode === 3 || ev.mode === 6)) {
      this.pushSoundRequest({
        soundId: playerSounds.taunt1,
        unit: playerUnitRef,
        x: unit.x,
        y: unit.y,
      })
    } else if (
      !unit.dead &&
      !unit.castState &&
      (ev.mode === 7 || ev.mode === 8 || ev.mode === 11 || ev.mode === 12)
    ) {
      this.emitSkillKeyframeSound({
        skillId: unit.mode === 12 ? 1 : unit.mode === 11 ? 2 : 0,
        flag: 1,
        unitId: unit.id,
        x: unit.x,
        y: unit.y,
        local: unit.id === this.selfId || this.selfId === 0,
      })
    }
  }
  if (unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)) {
    if (ev.mode === 0 || ev.mode === 17) {
      this._isSelfDead = true
      this._self.isDead = true
    } else if (ev.mode !== undefined) {
      // D2Client.dll 0x6fac9830 (PLAYER_SetMode, e.g. 0x6fac9c39 rawCode=0x07 Neutral -> sub_6FB56210):
      // Transitioning to a non-death player mode clears UNITFLAG_DEAD.
      this._isSelfDead = false
      this._self.isDead = false
    }
    this._self.mode = unit.mode
    this._self.moving = unit.mode === 2 || unit.mode === 3 || unit.mode === 6
  }
}

export function executeCharsiImbueImpl(
  this: ClientWorldInternal,
  itemId?: number,
  _npcId?: number,
  options?: CharsiImbueOptions & { readonly force?: boolean },
): ItemData | null {
  const q3 = this._quests[3] ?? this._gameQuestLog[3] ?? 0
  const isImbueWindowOpen =
    Boolean(options?.force) ||
    this._npcInteraction.window === 'imbue' ||
    this._npcInteraction.activeWindow === 'imbue' ||
    this._awaitingArtisanConfirmNpcId !== null
  if (!isImbueWindowOpen && (q3 & 0x0001) !== 0 && (q3 & 0x0002) === 0) {
    return null
  }
  if (this._hasQuestInfo && !isImbueWindowOpen && (q3 & 0x0002) === 0) {
    return null
  }

  const targetId =
    typeof itemId === 'number' && Number.isFinite(itemId) && itemId > 0
      ? itemId
      : this._containers.cursor?.id
  const targetItem =
    (targetId !== undefined ? this._containers.allById.get(targetId) : undefined) ??
    (this._containers.cursor && (targetId === undefined || this._containers.cursor.id === targetId)
      ? this._containers.cursor
      : undefined)
  if (!targetItem || !isEligibleForCharsiImbue113c(targetItem, options?.dropTables)) {
    return null
  }

  const rawLvl = this._self.stats.get(12) ?? (this._self as any).level
  const playerLevel =
    typeof rawLvl === 'number' && Number.isFinite(rawLvl) && rawLvl > 0 ? Math.trunc(rawLvl) : 8

  const imbued = imbueItemData113c(targetItem, playerLevel, options)
  this._containers.removeItemById(targetItem.id)
  this._containers.applyItemEvent(0x02, imbued, 'cursor', this.selfId)
  ;(this as any)._lastOptimisticImbuedItem = imbued

  const nextQ3 = ((this._quests[3] ?? 0) & ~0x0002) | 0x0001
  this._quests[3] = nextQ3
  if ((this._gameQuests[3] ?? 0) !== 0 || !this._hasPlayerQuests) {
    this._gameQuests[3] = ((this._gameQuests[3] ?? 0) & ~0x0002) | 0x0001
    this._gameQuestLog[3] = this._gameQuests[3]!
  }
  this._hasQuestInfo = true

  this._npcInteraction = {
    ...this._npcInteraction,
    npcId: null,
    infoNpcId: null,
    window: 'none',
    activeWindow: 'none',
  }
  return imbued
}
