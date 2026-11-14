/**
 * GameInstance Subsystem: AnimDispatcher Windup, Target/Location Skills, Multi-Hit Melee, Martial Arts & Hit Rolls (`src/server/engine/game-instance/player-skills-target-and-melee.ts`).
 */

import { itemTypeIsA } from '../../../common/items/item-types.ts'
import type { MissileRecord, SkillRecord } from '../../../common/data/data-registry.ts'
import { resolveEquippedWeaponClass, resolveEquippedWeaponWsm, resolvePrimaryWeaponWsm113c, resolveWeaponBase113c } from '../../../common/units/char-anim-speed.ts'
import { getSkillAnimModes } from '../../../common/skills/skill-anim-modes.ts'
import { canEnterPortalInPvp113c } from '../../combat/pvp-engine-113c.ts'
import { FRIENDLY_AURA_TARGET_STATE_IDS_113C } from '../../../common/skills/paladin-auras.ts'
import { CANONICAL_CHARSTATS } from '../../../common/units/classes.ts'
import { MON_UMOD } from '../../../common/units/monster-death-fx.ts'
import { computeMultishotFanTargets113c, isMissileEligibleForMultishot113c } from '../../ai/monumod-113c.ts'
import { getObjectsTxtRecord113c } from '../../../common/world/objects-txt-113c.ts'
import type { ServerEvent, UnitType } from '../../../netproto/index.ts'
import type { SummonedPetUnit } from '../../ai/summon-manager.ts'
import { FIXED_ONE, getEffectiveWeaponPoison113c } from '../stat-list.ts'
import { AnimDispatcher, isSkillInterruptible113c } from '../anim-dispatcher.ts'
import { evaluateChargeUpProgressiveToHit, evaluateDragonFlightStats, evaluateDragonTalonStats, resolveFinisherDischarge, type DischargedPayload } from '../../skills/assassin-martial-arts.ts'
import { DRAGON_TAIL_EXPLOSION_RADIUS_SUBTILES, FRENZY_DURATION_FRAMES_113C, FRENZY_STATE_ID_113C, KICK_SKILL_IDS_113C, MARTIAL_CHARGE_DURATION_FRAMES_113C, MARTIAL_FINISHER_SKILL_IDS_113C, PROGRESSIVE_SKILLS_113C, TELEKINESIS_KNOCKBACK_CHANCE_PCT, TELEKINESIS_SKILL_ID as TELEKINESIS_SKILL_ID_113C, addMartialCharge113c, computeDragonTailExplosionDamage113c, computeFistsOfFireConversionPct113c, computeKickDamageRange113c, computeSmiteStunFrames113c, getProgressiveSkillSpec113c, isTelekinesisObjectEligible113c, isTelekinesisPickupEligible113c, isWithinTelekinesisRange113c, liveMartialCharges113c, stepFrenzyStack113c, validateWave2SkillHands113c, type SkillTargetUnitType113c } from '../../skills/martial-dualwield-113c.ts'
import { evaluateCalc } from '../../../common/data/calc-ast.ts'
import { difficultyLifeStealDivisor, difficultyManaStealDivisor } from '../difficulty-resist-penalty.ts'
import { calculateVengeanceStats } from '../../skills/paladin-combat.ts'
import { STATE_RABIES_113C, STATE_SLOWMISSILES_113C } from '../../skills/p1-wave4-skills-113c.ts'
import { resolveWeaponMasteryBonus113c } from '../../skills/passives-procs-113c.ts'
import { strafeShotCount113c } from '../player-srvdo-113c.ts'
import { rollLimitedSeed113c } from './unit-seeds-113c.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMercenaryRecord, InternalMissileRecord, InternalMonsterRecord, InternalObjectRecord, InternalPlayerRecord, MissileDamageChannel, PlayerSkillCast, ServerItemEntry } from './types.ts'
import { BODYLOC_LEFT_ARM, BODYLOC_RIGHT_ARM, CHAR_ANIM_TOKEN_BY_CLASS_113C, PLAYER_MELEE_REACH_SUBTILES, SKILL_TELEPORT, SRVDOFUNC_CHARGE, SRVDOFUNC_CONVERSION, SRVDOFUNC_CORPSE_EXPLOSION, SRVDOFUNC_DRAGON_FLIGHT, SRVDOFUNC_FIND_ITEM, SRVDOFUNC_FIND_POTION, SRVDOFUNC_GRIM_WARD, SRVDOFUNC_JAB, SRVDOFUNC_LEAP, SRVDOFUNC_LEAP_ATTACK, SRVDOFUNC_MIND_BLAST, SRVDOFUNC_NOVA, SRVDOFUNC_PSYCHIC_HAMMER, SRVDOFUNC_TELEKINESIS, SRVDOFUNC_WHIRLWIND, SRVDOFUNC_ZEAL_FURY_FEND, STAT_QUANTITY, TOWN_AREAS, collectItemStats, missileClassElementFallback, normalizeMissileElement, playerWirePosition, resolveArmorCombatMeta113c, UNIT_TYPE_113C, missileSpeedSubtilesPerFrame113c } from './constants-and-helpers.ts'


/**
 * `#1877` (`D2Game.dll` `SKILLS_ApplySkillDelay` @ `0x6FCBFF70`):
 * Returns `true` while global `STATE_SKILLDELAY` (`state 121`) is active on `player`.
 */
function isPlayerSkillDelayActive113c(this: GameInstanceHost, player: InternalPlayerRecord): boolean {
  if (player.states.has(121)) {
    return true
  }
  if (this.playerSkillDelayUntilFrame.has(player.unitId)) {
    this.playerSkillDelayUntilFrame.delete(player.unitId)
  }
  const combat = this.playerCombat.get(player.unitId)
  if (combat !== undefined && (combat.stateBus.hasState(121) || combat.stateBus.hasState('skilldelay'))) {
    combat.stateBus.removeState(121)
    combat.stateBus.removeState('skilldelay')
  }
  return false
}



/**
 * `#1877`: Arm global `STATE_SKILLDELAY` (`state 121`) for `cooldownFrames` ticks across all
 * `Skills.txt` `delay > 0` skills, broadcasting S2C `0xA8 StateSet` (and `0xA9 StateEnd` on expiry).
 */
function applyPlayerGlobalSkillDelay113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  skillId: number,
  slvl: number,
  cooldownFrames: number,
): void {
  const frames = Math.trunc(cooldownFrames)
  if (frames <= 0) return
  const expireFrame = this.currentFrame + frames
  // `processCommands` runs before `stepUnitStates` in the same `stepFrame()`, whereas
  // `stepPlayerAnimations113c` runs after `stepUnitStates`: compensate +1 when armed in
  // `processCommands` so `stateTimers.get(121) === frames` at end of cast frame in both modes.
  const unitStateFrames = this.inStepPlayerAnimations113c ? frames : frames + 1
  this.playerSkillDelayUntilFrame.set(player.unitId, expireFrame)
  this.playerCombatContext(player).stateBus.applyState({
    stateNameOrId: 121,
    sourceUnitId: `player_${player.unitId}`,
    sourceSkillId: skillId,
    slvl,
    durationFrames: frames,
    currentFrame: this.currentFrame,
  })
  this.applyUnitState(
    player.states,
    player.stateTimers,
    'player',
    player.unitId,
    player.areaId,
    121,
    unitStateFrames,
  )
  this.playerAnimDispatchers.get(player.unitId)?.syncSkillDelayExpireFrame(expireFrame)
}



/**
 * `#1789`/`#1862`: Ensure `player` has a live `AnimDispatcher` synced with equipped weapon WClass,
 * WSM, on-weapon IAS, FCR (`105`), IAS (`93`), FHR (`99`), FBR (`102`), mana, and morph states.
 */
function syncPlayerAnimDispatcher113c(this: GameInstanceHost, player: InternalPlayerRecord): AnimDispatcher {
  const ctx = this.playerCombatContext(player)
  const unit = this.playerCombat.get(player.unitId)!
  const itemSt = unit.itemStatList ?? ctx.statList
  itemSt.setBaseStat('item_fasterattackrate', this.sumPlayerItemStat(player, 93))
  itemSt.setBaseStat('item_fastergethitrate', this.sumPlayerItemStat(player, 99))
  itemSt.setBaseStat('item_fasterblockrate', this.sumPlayerItemStat(player, 102))
  itemSt.setBaseStat('item_fastercastrate', this.sumPlayerItemStat(player, 105))

  for (const mirroredStateId of [65, 101, 139, 140] as const) {
    if (player.states.has(mirroredStateId) && !ctx.stateBus.hasState(mirroredStateId)) {
      ctx.stateBus.applyState({
        stateNameOrId: mirroredStateId,
        sourceUnitId: `player_${player.unitId}`,
        slvl: 1,
        durationFrames: player.stateTimers.get(mirroredStateId) ?? 50000,
        currentFrame: this.currentFrame,
      })
    } else if (!player.states.has(mirroredStateId) && ctx.stateBus.hasState(mirroredStateId)) {
      ctx.stateBus.removeState(mirroredStateId)
    }
  }

  const equipped = player.items.filter(
    (i) => i.location === 'equipped' && i.bodyLoc !== 11 && i.bodyLoc !== 12,
  )
  const equipInputs = equipped.map((item) => ({
    code: item.code,
    bodyLoc: item.bodyLoc,
    broken: item.maxDurability > 0 && item.durability <= 0 && (item.stats.get(152) ?? 0) <= 0,
  }))
  const weaponClass = resolveEquippedWeaponClass(equipInputs)
  const weaponWsm = resolveEquippedWeaponWsm(equipInputs)
  const primaryWeaponWsm = resolvePrimaryWeaponWsm113c(equipInputs)
  const primaryWeaponEntry =
    equipped.find(
      (i) =>
        i.bodyLoc === BODYLOC_RIGHT_ARM &&
        resolveWeaponBase113c(i.code) !== undefined &&
        !(i.maxDurability > 0 && i.durability <= 0 && (i.stats.get(152) ?? 0) <= 0),
    ) ??
    equipped.find(
      (i) =>
        i.bodyLoc === BODYLOC_LEFT_ARM &&
        resolveWeaponBase113c(i.code) !== undefined &&
        !(i.maxDurability > 0 && i.durability <= 0 && (i.stats.get(152) ?? 0) <= 0),
    )
  const primaryWeaponIas =
    primaryWeaponEntry !== undefined
      ? this.collectWhirlwindWeaponHandStats113c(primaryWeaponEntry)
          .filter((s) => s.statId === 93)
          .reduce((sum, s) => sum + s.value, 0)
      : 0

  let disp = this.playerAnimDispatchers.get(player.unitId)
  const charToken =
    CHAR_ANIM_TOKEN_BY_CLASS_113C[player.classCode] ?? 'SO'
  if (disp === undefined || disp.statList !== ctx.statList) {
    disp = new AnimDispatcher({
      registry: this.registry,
      statList: ctx.statList,
      stateBus: ctx.stateBus,
      charToken,
      weaponClass,
      weaponWsm,
      primaryWeaponWsm,
      primaryWeaponIas,
      enforceFrameLock: this.animActionWindupEnabled,
    })
    this.playerAnimDispatchers.set(player.unitId, disp)
  } else {
    disp.setWeaponClass(weaponClass)
    disp.setWeaponWsm(weaponWsm)
    disp.setPrimaryWeaponWsm(primaryWeaponWsm)
    disp.setPrimaryWeaponIas(primaryWeaponIas)
    disp.setEnforceFrameLock(this.animActionWindupEnabled)
  }
  const delayUntil = player.states.has(121)
    ? this.currentFrame + Math.max(1, player.stateTimers.get(121) ?? 1)
    : 0
  disp.syncSkillDelayExpireFrame(delayUntil)
  return disp
}



/** `#1789`: Whether `player` is currently frame-locked in an active skill animation or recovery. */
function isPlayerActionAnimLocked113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  nextSkill?: SkillRecord,
): boolean {
  if (!this.animActionWindupEnabled) return false
  if (nextSkill?.aura) return false
  if (this.isPlayerInHitRecovery(player) || this.isPlayerInBlockRecovery(player)) return true
  const disp = this.playerAnimDispatchers.get(player.unitId)
  if (!disp) return false
  const cur = disp.getCurrentAnimation()
  if (cur && !cur.completed) {
    if (
      nextSkill !== undefined &&
      nextSkill.startMana > 0 &&
      cur.skill.id === nextSkill.id &&
      (cur.actionTriggered ||
        (player.states.has(12) && this.playerChannelSkillId.get(player.unitId) === nextSkill.id))
    ) {
      return false
    }
    // 1.13c `D2Game.dll` `PLRMODE_CheckSkillInterrupt` (`0x6FC97FA0`..`0x6FC98065`):
    // When a C2S skill packet arrives mid-animation of an interruptible skill (`Skills.txt` `interrupt=1`)
    // while `STATE_CONCENTRATION` (`state 42`) is active, `0x6FC9805E` rolls `SEED_RollLimitedRandomNumber(&pPlayer->pSeed, 100)`
    // against `STAT_SKILL_CONCENTRATION` (`0xA4 = 164`, 20%).
    if (
      this.drlgRoomPopulator !== null &&
      nextSkill !== undefined &&
      isSkillInterruptible113c(cur.skill)
    ) {
      const pCombat = this.playerCombat.get(player.unitId)
      let blockedByConcentration = false
      if (
        player.states.has(42) ||
        Boolean(pCombat?.stateBus.hasState(42)) ||
        Boolean(pCombat?.statList.getActiveModifiers().some((m) => m.stateId === 42))
      ) {
        const pSeed = this.unitSeeds.get(`${UNIT_TYPE_113C.player}:${player.unitId}`)
        if (pSeed !== undefined) {
          const concChance = Math.max(20, pCombat?.statList.getAccruedStat('skill_concentration') ?? 20)
          blockedByConcentration = rollLimitedSeed113c(pSeed, 100) < concChance
        }
      }
      // `PLRMODE_SetMode` (`0x6FC98550`) -> `0x6FC98340` (current mode A1/A2/SC/TH: allowed while the
      // end-of-animation event is pending) -> `0x6FC97FA0`: an interruptible current skill without a
      // successful Concentration roll lets the new command restart the mode (oracle `a1-bloodmoor-melee`
      // F=1075 attack restarted by the F=1080 command: hit F=1086, NU F=1095; kb/engine/d2game-plrmode-gethit-113c.md §4).
          if (!blockedByConcentration && (cur.skill.id === 0 || nextSkill.id === 0)) {
        player.animRestartFrame113c = this.currentFrame
        return false
      }
    }
    return true
  }
  return disp.isInRecovery()
}




function rubberbandPlayer113c(this: GameInstanceHost, player: InternalPlayerRecord): void {
  this.emitToPlayer(player.unitId, {
    type: 'WalkVerify',
    stamina: player.stamina || 0,
    x: Math.round(player.x),
    y: Math.round(player.y),
    vx: 0,
    vy: 0,
  })
}



/**
 during hit/block recovery, Whirlwind, or active
 * skill animation windup/follow-through. Active post-`ActionFlag` channeling (`startMana > 0`,
 * `STATE_INFERNO` state 12) is cancelled by a movement command so the player can walk/run away.
 */
function consumeOrBlockMoveDuringPlayerAnim113c(this: GameInstanceHost, player: InternalPlayerRecord): boolean {
  if (
    this.isPlayerInHitRecovery(player) ||
    this.isPlayerInBlockRecovery(player) ||
    this.isPlayerWhirlwinding113c(player)
  ) {
    return true
  }
  if (!this.animActionWindupEnabled) return false
  const disp = this.playerAnimDispatchers.get(player.unitId)
  if (!disp) return false
  const cur = disp.getCurrentAnimation()
  if (cur && !cur.completed) {
    // `PLRMODE_SetMode` already accepted this command over the interruptible attack (`animRestartFrame113c`,
    // see `isPlayerActionAnimLocked113c`): an out-of-range attack target turns it into the run toward the
    // target, so the old mode and its pending action are dropped (oracle `a1c-bloodmoor-fallen` F1000:
    // the attack command on Fallen #13 switches the swinging player to RN at once).
    if (player.animRestartFrame113c === this.currentFrame) {
      player.animRestartFrame113c = undefined
      const pending = this.pendingPlayerAnimActions.get(player.unitId)
      if (pending !== undefined) {
        pending.onCleanup?.()
        this.pendingPlayerAnimActions.delete(player.unitId)
      }
      disp.clearAnimation()
      return false
    }
    if (cur.skill.startMana > 0 && cur.actionTriggered) {
      const pending = this.pendingPlayerAnimActions.get(player.unitId)
      if (pending !== undefined) {
        pending.onCleanup?.()
        this.pendingPlayerAnimActions.delete(player.unitId)
      }
      disp.clearAnimation()
      this.clearPlayerChannelState(player)
      return false
    }
    return true
  }
  return disp.isInRecovery()
}



/**
 * `#1789`: Returns `true` when `player` is executing an uninterruptible skill (`Whirlwind`,
 * `Concentrate`, `Zeal`, `Fury`, `Jab`, `Strafe`, `Fend`, `Smite`, `Charge`, `Frenzy`, `Leap`,
 * `Leap Attack`, `Dragon Flight`).
 */
function isPlayerSkillUninterruptible113c(this: GameInstanceHost, player: InternalPlayerRecord): boolean {
  if (this.isPlayerWhirlwinding113c(player)) return true
  const cur = this.playerAnimDispatchers.get(player.unitId)?.getCurrentAnimation()
  if (cur && !cur.completed && !isSkillInterruptible113c(cur.skill)) {
    return true
  }
  // 1.13c `D2Game.dll` `PLRMODE_CheckSkillInterrupt` (`0x6FC98033`..`0x6FC98065`):
  // Active `STATE_CONCENTRATION` (`state 42`) rolls `pPlayer->pSeed % 100 < STAT_SKILL_CONCENTRATION` (`0xA4 = 164`, 20%)
  // to prevent `GH` / `BL` from interrupting an active interruptible skill animation.
  if (cur && !cur.completed && isSkillInterruptible113c(cur.skill)) {
    const pCombat = this.playerCombat.get(player.unitId)
    if (
      player.states.has(42) ||
      Boolean(pCombat?.stateBus.hasState(42)) ||
      Boolean(pCombat?.statList.getActiveModifiers().some((m) => m.stateId === 42))
    ) {
      const concChance = Math.max(20, pCombat?.statList.getAccruedStat('skill_concentration') ?? 20)
      const pSeed =
        this.drlgRoomPopulator !== null
          ? this.unitSeeds.get(`${UNIT_TYPE_113C.player}:${player.unitId}`)
          : undefined
      const roll = pSeed !== undefined ? rollLimitedSeed113c(pSeed, 100) : this.rng.rand(100)
      if (roll < concChance) return true
    }
  }
  // Also honor active Concentrate state (`state 15`) if set during a Concentrate swing
  if (player.states.has(15)) return true
  return false
}



/**
 * `#1789`: Enter `GH` (`mode 4`) or `BL` (`mode 9`) on the player's `AnimDispatcher`, cancelling
 * any pending pre-`ActionFlag` skill action so no mana, missile, or melee damage is emitted.
 */
function interruptPendingPlayerAnimAction113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  mode: 'GH' | 'BL',
): void {
  const disp = this.syncPlayerAnimDispatcher113c(player)
  const curBefore = disp.getCurrentAnimation()
  const wasPreAction = Boolean(curBefore && !curBefore.completed && !curBefore.actionTriggered)
  if (mode === 'GH') {
    disp.enterGetHit()
  } else {
    disp.enterBlock()
  }
  const pending = this.pendingPlayerAnimActions.get(player.unitId)
  if (pending !== undefined) {
    if (wasPreAction) {
      if (player.states.has(12)) {
        this.clearPlayerChannelState(player)
      }
    }
    pending.onCleanup?.()
    this.pendingPlayerAnimActions.delete(player.unitId)
  }
}



/**
 * `#1789`/`#1862`/`#1877`: Step every player's `25 Hz` `AnimDispatcher`, clearing expired `GH`/`BL`
 * recovery modes, syncing `STATE_SKILLDELAY` (`121`), and firing `ActionFlag=1`, rollback, and
 * `SequenceTbls` strike callbacks on their exact `AnimData.d2` ticks.
 */
function stepPlayerAnimations113c(this: GameInstanceHost): void {
  this.inStepPlayerAnimations113c = true
  try {
    for (const player of this.players.values()) {
    const disp = this.playerAnimDispatchers.get(player.unitId)
    if (player.dead) {
      const pending = this.pendingPlayerAnimActions.get(player.unitId)
      if (pending !== undefined) {
        pending.onCleanup?.()
        this.pendingPlayerAnimActions.delete(player.unitId)
      }
      this.playerSkillDelayUntilFrame.delete(player.unitId)
      player.blockRecoveryUntilFrame = undefined
      player.animResetFrame = undefined
      player.animStartSkipFrame = undefined
      disp?.clearAnimation()
      disp?.clearRecovery()
      continue
    }

    if (!player.states.has(121)) {
      this.isPlayerSkillDelayActive113c(player)
    }

    if (
      player.blockRecoveryUntilFrame !== undefined &&
      this.currentFrame >= player.blockRecoveryUntilFrame
    ) {
      player.blockRecoveryUntilFrame = undefined
      disp?.clearRecovery()
      if ((player.mode === 9 || player.mode === player.blockRecoveryMode113c) && !this.isPlayerWhirlwinding113c(player)) {
        player.mode = TOWN_AREAS.has(player.areaId) ? 5 : 1
      }
      player.blockRecoveryMode113c = undefined
    }

    if (
      player.hitRecoveryUntilFrame !== undefined &&
      this.currentFrame >= player.hitRecoveryUntilFrame
    ) {
      player.hitRecoveryUntilFrame = undefined
      disp?.clearRecovery()
      if (player.mode === 4 && !this.isPlayerWhirlwinding113c(player)) {
        player.mode = TOWN_AREAS.has(player.areaId) ? 5 : 1
      }
    }

    if (!disp) continue

    if (player.animResetFrame !== undefined && this.currentFrame >= player.animResetFrame) {
      player.animResetFrame = undefined
      const curAnim = disp.getCurrentAnimation()
      if (
        (!curAnim || curAnim.completed) &&
        !this.isPlayerInHitRecovery(player) &&
        !this.isPlayerInBlockRecovery(player) &&
        !this.isPlayerWhirlwinding113c(player) &&
        (player.mode === 7 ||
          player.mode === 8 ||
          player.mode === 10 ||
          player.mode === 11 ||
          player.mode === 18)
      ) {
        player.mode = TOWN_AREAS.has(player.areaId) ? 5 : 1
      }
    }

    if (player.animStartSkipFrame === this.currentFrame) {
      player.animStartSkipFrame = undefined
      continue
    }

    const { anim } = disp.tick(this.currentFrame, (activeAnim, _tick, strikeIdx) => {
      const pending = this.pendingPlayerAnimActions.get(player.unitId)
      if (!pending) return
      const needCommitOnStrike = strikeIdx === 0 && !pending.manaCommittedOnStart
      if (needCommitOnStrike) {
        if (
          pending.cast.chargeItem === undefined &&
          !pending.cast.isNoCostInState &&
          player.manaFixed < pending.cast.evalResult.manaCost256
        ) {
          if (player.states.has(12)) this.clearPlayerChannelState(player)
          pending.onCleanup?.()
          this.pendingPlayerAnimActions.delete(player.unitId)
          disp.clearAnimation()
          return
        }
      }
      // 1.13c `D2Game.dll` `SKILLS_DoSkillDo` (`0x6FCC19A0`): `pfnSrvDo` runs BEFORE `SKILLS_UseMana` (`0x6FCBF9D0`),
      // so self-buffs like `#149 Battle Orders` scale `manaFixed` up before deducting the cast's mana cost.
      pending.onStrike(strikeIdx, activeAnim.totalStrikes)
      if (needCommitOnStrike && !player.dead) {
        this.commitPlayerSkillCast(player, pending.cast)
      }
    })

    if (anim && anim.completed) {
      const pending = this.pendingPlayerAnimActions.get(player.unitId)
      if (pending !== undefined) {
        pending.onCleanup?.()
        this.pendingPlayerAnimActions.delete(player.unitId)
      }
      if (
        !this.isPlayerInHitRecovery(player) &&
        !this.isPlayerWhirlwinding113c(player)
      ) {
        if (this.drlgRoomPopulator !== null) {
          player.animResetFrame = this.currentFrame + 1
        } else {
          player.mode = TOWN_AREAS.has(player.areaId) ? 5 : 1
        }
      }
    }
  }
  } finally {
    this.inStepPlayerAnimations113c = false
  }
}



/**
 * `#1789`: Schedule a player attack/throw/cast through `AnimDispatcher` with exact `AnimData.d2`
 * windup -> `ActionFlag=1` release -> follow-through lock.
 */
function schedulePlayerSkillWindup113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  targetX: number,
  targetY: number,
  broadcastTarget:
    | { readonly x: number; readonly y: number }
    | { readonly unitType: UnitType; readonly id: number },
  opts: {
    readonly strikeCountOverride?: number | undefined
    readonly onStrike: (strikeIndex: number, totalStrikes: number) => void
    readonly onCleanup?: (() => void) | undefined
  },
): boolean {
  const disp = this.syncPlayerAnimDispatcher113c(player)
  if (player.animRestartFrame113c === this.currentFrame) {
    // `PLRMODE_SetMode` restart of an interruptible attack (see `isPlayerActionAnimLocked113c`): the old
    // mode and its pending action event are dropped before the new mode starts.
    player.animRestartFrame113c = undefined
    const prev = this.pendingPlayerAnimActions.get(player.unitId)
    if (prev !== undefined) {
      prev.onCleanup?.()
      this.pendingPlayerAnimActions.delete(player.unitId)
    }
    disp.clearAnimation()
  }
  const res = disp.startSkillAnimation({
    skill: cast.skill,
    slvl: cast.slvl,
    currentTick: this.currentFrame,
    targetX,
    targetY,
    ...(opts.strikeCountOverride !== undefined
      ? { strikeCountOverride: opts.strikeCountOverride }
      : {}),
    skipResourceCommit: true,
  })
  if (!res.allowed || !res.animState) {
    if (
      cast.skill.startMana > 0 &&
      player.states.has(12) &&
      this.playerChannelSkillId.get(player.unitId) === cast.skill.id
    ) {
      this.updatePlayerChannelState(player, cast)
    }
    opts.onCleanup?.()
    return false
  }

  this.updatePlayerChannelState(player, cast)
  const prevPending = this.pendingPlayerAnimActions.get(player.unitId)
  if (prevPending !== undefined) {
    prevPending.onCleanup?.()
  }
  // 1.13c `SKILLS_DoSkillStart` (`0x6FCBFD00`): when the skill has a `srvstfunc` (`SkillsTxt+0x2C`, table
  // `0x6FD27338`) that succeeds and `usemanaondo` is clear (`0x6FCBFE69..0x6FCBFE77`), `SKILLS_UseMana`
  // (`0x6FCBF850`) runs in the start phase; otherwise the mana is paid by `SKILLS_DoSkillDo` on the action
  // frame (oracle `p52-necromancer-curses`: Raise Skeleton, srvstfunc 15, pays 5351 on cast start F1510).
  const manaCommittedOnStart = cast.skill.srvStFunc > 0 && !cast.skill.useManaOnDo
  if (manaCommittedOnStart) this.commitPlayerSkillCast(player, cast)
  this.pendingPlayerAnimActions.set(player.unitId, {
    cast,
    manaCommittedOnStart,
    onStrike: opts.onStrike,
    onCleanup: opts.onCleanup,
  })

  const animMode = getSkillAnimModes(cast.skill.id).playerMode
  player.animResetFrame = undefined
  player.animStartSkipFrame =
    this.drlgRoomPopulator !== null && this.inStepPlayerMovement
      ? this.currentFrame
      : undefined
  player.mode = animMode
  player.targetX = player.x
  player.targetY = player.y
  const motion = this.playerMotion.get(player.unitId)
  if (motion !== undefined) {
    motion.mover.setPosition(player.x, player.y)
    motion.x = player.x
    motion.y = player.y
    motion.moving = false
    motion.plannedX = Number.NaN
    motion.plannedY = Number.NaN
  }

  this.broadcastPlayerSkillCast(player, cast, broadcastTarget)
  this.broadcastToArea(player.areaId, {
    type: 'UnitMode',
    unitType: 0,
    id: player.unitId,
    mode: animMode,
    at: playerWirePosition(player),
    lifePct:
      player.maxHp > 0
        ? Math.max(0, Math.round((player.hp / player.maxHp) * 128))
        : 0,
  })
  return true
}



/** Collect living hostile monsters in `player`'s melee reach, ordered with `primary` first, then nearest. */
function livingHostilesInMeleeReach113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  primary?: InternalMonsterRecord,
): InternalMonsterRecord[] {
  const list = [...this.monsters.values()].filter(
    (m) =>
      !m.dead &&
      !m.isNpc &&
      !m.submerged &&
      !this.isMonsterConverted(m) &&
      m.align === 0 &&
      (m.areaId === player.areaId ||
        (!TOWN_AREAS.has(player.areaId) &&
          !TOWN_AREAS.has(m.areaId) &&
          m.isKillable &&
          this.isAreaSeamAdjacent(player.areaId, m.areaId))) &&
      this.isPlayerMeleeInRangeOfMonster(player, m),
  )
  list.sort((a, b) => {
    if (a === primary) return -1
    if (b === primary) return 1
    const d = Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y)
    return d !== 0 ? d : a.unitId - b.unitId
  })
  return list
}



/** Sorted Strafe targets within `cast.evalResult.radiusSubtiles` (`primary` first, then nearest). */
function collectStrafeTargets113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  primaryTarget?: InternalMonsterRecord,
): InternalMonsterRecord[] {
  const radius = cast.evalResult.radiusSubtiles
  return [...this.monsters.values()]
    .filter(
      (m) =>
        !m.dead &&
        !m.isNpc &&
        !m.submerged &&
        !this.isMonsterConverted(m) &&
        m.align === 0 &&
        m.areaId === player.areaId &&
        Math.hypot(m.x - player.x, m.y - player.y) <= radius,
    )
    .sort((a, b) => {
      if (a === primaryTarget) return -1
      if (b === primaryTarget) return 1
      const d = Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y)
      return d !== 0 ? d : a.unitId - b.unitId
    })
}



function executeSingleStrafeShot113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  missileRec: MissileRecord,
  tx: number,
  ty: number,
  strikeIndex: number,
  primaryTarget?: InternalMonsterRecord,
): void {
  const edPct = this.evaluatePlayerSkillCalc(cast, cast.skill.calc2) + this.playerSkillPhysSynergyPct(cast)
  const inRange = this.collectStrafeTargets113c(player, cast, primaryTarget)
  if (inRange.length === 0) {
    if (strikeIndex === 0) {
      this.launchPlayerSkillMissile(player, cast, missileRec, tx, ty, this.rollPlayerSkillDamage(player, cast, edPct))
    }
    return
  }
  const target = inRange[strikeIndex % inRange.length]!
  this.launchPlayerSkillMissile(
    player,
    cast,
    missileRec,
    target.x,
    target.y,
    this.rollPlayerSkillDamage(player, cast, edPct),
  )
}



/** Deduct 1 throwing stack quantity from a single hand (`'right'` or `'left'`, `#1862` Double Throw). */
function consumeSingleHandThrowQuantity113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  hand: 'right' | 'left',
): void {
  const hands = this.activeHandItems113c(player)
  const item = hand === 'right' ? hands.right : hands.left
  if (item === undefined) return
  const next = Math.max(0, this.itemQuantity113c(item) - 1)
  item.quantity = next
  if (item.stats.has(STAT_QUANTITY)) item.stats.set(STAT_QUANTITY, next)
  if (item.rawItemData !== undefined) {
    item.rawItemData = {
      ...item.rawItemData,
      quantity: next,
      stats: item.rawItemData.stats.map((s) =>
        s.statId === STAT_QUANTITY ? { ...s, value: next } : s,
      ),
    }
  }
  this.emitToPlayer(player.unitId, {
    type: 'StatSet',
    unit: { unitType: 4, id: item.unitId },
    stat: STAT_QUANTITY,
    param: 0,
    value: next,
  })
}



function executeSkillAtLocation(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  skillId: number,
  tx: number,
  ty: number,
  targetCorpse?: InternalMonsterRecord,
  options?: { readonly hold?: boolean },
): void {
  if (player.dead || (this.isPlayerInHitRecovery(player) && !this.registry.getSkillById(skillId)?.aura)) return
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return
  // `#1883` Bone Prison (#88) requires an explicit unit target; Bone Wall (#78) & Bone Prison (#88) are blocked in Town!
  if (skillId === 88) return
  if (skillId === 78 && TOWN_AREAS.has(player.areaId)) return
  const cast = this.resolvePlayerSkillCast(player, skillId)
  if (cast === null) return
  // #1812: Double Throw needs a throwing weapon with quantity in both hands (checked before mana).
  if (!this.passesWave2HandRequirement113c(player, skillId)) return

  const doFunc = cast.skill.srvDoFunc
  let validatedCorpse: InternalMonsterRecord | undefined
  if (
    doFunc === SRVDOFUNC_FIND_POTION ||
    doFunc === SRVDOFUNC_GRIM_WARD ||
    doFunc === SRVDOFUNC_FIND_ITEM
  ) {
    const requireSoft = doFunc === SRVDOFUNC_FIND_POTION || doFunc === SRVDOFUNC_GRIM_WARD
    validatedCorpse = this.findNearestSelectableCorpse113c(
      player.areaId,
      tx,
      ty,
      requireSoft,
      targetCorpse,
    )
    if (validatedCorpse === undefined) {
      return
    }
  } else if (doFunc === SRVDOFUNC_WHIRLWIND) {
    if (this.resolveWhirlwindEquippedHandsForPlayer113c(player) === null) {
      return
    }
  }

  const executeLocationDoPhase = (strikeIndex: number, _totalStrikes: number): void => {
    if (skillId === SKILL_TELEPORT) {
      this.relocatePlayerForSkill(player, tx, ty, true, true)
      return
    }
    if (skillId === 219 || skillId === 220) {
      this.openTownPortal(player)
      return
    }
    if (doFunc === SRVDOFUNC_FIND_POTION) {
      if (validatedCorpse && validatedCorpse.dead) this.executeFindPotion(player, cast, validatedCorpse)
      return
    }
    if (doFunc === SRVDOFUNC_FIND_ITEM) {
      if (validatedCorpse && validatedCorpse.dead) this.executeFindItem(player, cast, validatedCorpse)
      return
    }
    if (doFunc === SRVDOFUNC_GRIM_WARD) {
      if (validatedCorpse && validatedCorpse.dead) this.executeGrimWard(player, cast, validatedCorpse)
      return
    }
    if (skillId === 78) {
      this.executeBoneWall113c(player, cast, tx, ty)
      return
    }
    if (skillId === 277) {
      this.activateBladeShieldState113c(player, cast.slvl)
      return
    }
    if (skillId === 257) {
      this.executeBladeSentinel113c(player, cast, tx, ty)
      return
    }
    if (skillId === 17) {
      this.executeSlowMissiles113c(player, cast)
      return
    }
    if (skillId === 266) {
      this.activeBladeFuryChannels.set(player.unitId, {
        tx,
        ty,
        nextAutoShotFrame: this.currentFrame + 5,
        lastShotFrame: this.currentFrame,
        hold: options?.hold === true,
      })
    }
    if (doFunc === SRVDOFUNC_LEAP || doFunc === SRVDOFUNC_LEAP_ATTACK) {
      this.relocatePlayerForSkill(player, tx, ty, false)
    }
    if (this.drlgRoomPopulator === null && doFunc === SRVDOFUNC_NOVA && skillId !== 130) {
      this.executeNovaSkill(player, cast)
      if (cast.missile !== undefined) {
        this.launchPlayerSkillMissile(player, cast, cast.missile, tx, ty, 0)
      }
      return
    }
    if (cast.missile !== undefined) {
      if (skillId === 26) {
        this.executeSingleStrafeShot113c(player, cast, cast.missile, tx, ty, strikeIndex)
        return
      }
      if (skillId === 140) {
        const hand = strikeIndex === 0 ? 'right' : 'left'
        const mRec = strikeIndex === 1 && cast.offHandMissile !== undefined ? cast.offHandMissile : cast.missile
        this.launchPlayerSkillMissile(player, cast, mRec, tx, ty, this.rollPlayerSkillDamage(player, cast))
        this.consumeSingleHandThrowQuantity113c(player, hand)
        return
      }
      this.launchPlayerSkillMissiles(player, cast, cast.missile, tx, ty)
      return
    }
    if (skillId === 42) {
      this.applyStaticField(player, cast)
      return
    }
    if (doFunc === SRVDOFUNC_CORPSE_EXPLOSION) {
      this.executeCorpseExplosion(player, cast, tx, ty, targetCorpse)
      return
    }
    if (doFunc === SRVDOFUNC_MIND_BLAST) {
      this.executeMindBlast(player, cast, tx, ty)
      return
    }
    if (cast.skill.range !== 'h2h' && cast.skill.range !== 'both') {
      this.applyPlayerSkillEffect(player, cast, tx, ty, targetCorpse)
    }
  }

  if (this.animActionWindupEnabled && doFunc !== SRVDOFUNC_WHIRLWIND && !cast.skill.aura) {
    let strikeCountOverride: number | undefined
    if (skillId === 26) {
      const targets = this.collectStrafeTargets113c(player, cast)
      strikeCountOverride =
        targets.length === 0
          ? 1
          : strafeShotCount113c(
              this.evaluatePlayerSkillCalc(cast, cast.skill.calc1),
              this.evaluatePlayerSkillCalc(cast, cast.skill.calc3),
              targets.length,
            )
    }
    this.schedulePlayerSkillWindup113c(
      player,
      cast,
      tx,
      ty,
      { x: Math.round(tx), y: Math.round(ty) },
      {
        strikeCountOverride,
        onStrike: executeLocationDoPhase,
      },
    )
    return
  }

  // Sync AnimDispatcher metadata even in immediate mode
  this.syncPlayerAnimDispatcher113c(player)
  this.updatePlayerChannelState(player, cast)
  // 1.13c `D2Game.dll` `SKILLS_DoSkillStart` (`0x6FCBFD00` @ `0x6FCBFE6C`) vs `SKILLS_DoSkillDo` (`0x6FCC19A0`):
  // When `usemanaondo = 1` (`Plague Javelin` #25, `Blade Fury` #266), mana is checked and deducted in the `do` phase.
  const commitAfterImmediateDo = doFunc === 68 && !cast.skill.useManaOnDo
  if (!cast.skill.useManaOnDo && !commitAfterImmediateDo) {
    this.commitPlayerSkillCast(player, cast)
  }
  this.broadcastPlayerSkillCast(player, cast, { x: Math.round(tx), y: Math.round(ty) })
  if (cast.skill.useManaOnDo) {
    if (
      cast.chargeItem === undefined &&
      !cast.isNoCostInState &&
      player.manaFixed < cast.evalResult.manaCost256
    ) {
      if (player.states.has(12)) this.clearPlayerChannelState(player)
      return
    }
    this.commitPlayerSkillCast(player, cast)
  }

  if (doFunc === SRVDOFUNC_WHIRLWIND) {
    this.executeWhirlwind(player, cast, tx, ty)
    return
  }
  if (skillId === 26 && cast.missile !== undefined) {
    this.executeStrafe(player, cast, cast.missile, tx, ty)
    return
  }
  if (skillId === 140 && cast.missile !== undefined) {
    this.launchPlayerSkillMissiles(player, cast, cast.missile, tx, ty)
    this.consumeDoubleThrowQuantity113c(player)
    return
  }
  executeLocationDoPhase(0, 1)
  if (commitAfterImmediateDo && !player.dead) {
    this.commitPlayerSkillCast(player, cast)
  }
}



function executeSkillOnTarget(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  skillId: number,
  targetId: number,
  targetType?: SkillTargetUnitType113c,
  options?: { readonly shift?: boolean; readonly hold?: boolean },
): void {
  if (player.dead || (this.isPlayerInHitRecovery(player) && !this.registry.getSkillById(skillId)?.aura)) return
  if (skillId === TELEKINESIS_SKILL_ID_113C) {
    this.executeTelekinesis113c(player, targetId, targetType)
    return
  }
  const pvpTarget = this.resolveHostilePvpTargetById113c(
    player.unitId,
    player.areaId,
    targetId,
    targetType,
  )
  if (pvpTarget !== undefined) {
    this.executeSkillOnPvpTarget113c(player, skillId, pvpTarget)
    return
  }
  if (
    targetType === 0 ||
    (targetType === undefined && !this.monsters.has(targetId) && this.players.has(targetId))
  ) {
    // Clicking a non-hostile player (or player in Town) must never fall back to hitting a nearby monster.
    return
  }
  const clicked = this.monsters.get(targetId)
  if (clicked && clicked.submerged) {
    return
  }
  if (skillId === 131 || skillId === 142 || skillId === 150) {
    if (clicked && clicked.dead && !clicked.isNpc && clicked.areaId === player.areaId) {
      this.executeSkillAtLocation(player, skillId, clicked.x, clicked.y, clicked)
    }
    return
  }
  const allowDyingTarget113c =
    this.drlgRoomPopulator !== null &&
    skillId === 0 &&
    clicked !== undefined &&
    clicked.dead &&
    clicked.mode === 0
  if (
    clicked &&
    clicked.dead &&
    !allowDyingTarget113c &&
    !clicked.isNpc &&
    clicked.areaId === player.areaId
  ) {
    // A cast on a corpse (Corpse Explosion, Raise Skeleton, Revive, or clicking a settled mode-12 corpse) targets that location/corpse.
    this.executeSkillAtLocation(player, skillId, clicked.x, clicked.y, clicked)
    return
  }
  let monster = clicked
  const monsterInReachArea =
    monster !== undefined &&
    (monster.areaId === player.areaId ||
      (!TOWN_AREAS.has(player.areaId) &&
        !TOWN_AREAS.has(monster.areaId) &&
        monster.isKillable &&
        this.isAreaSeamAdjacent(player.areaId, monster.areaId)))
  if (
    !monster ||
    (monster.dead && !allowDyingTarget113c) ||
    monster.isNpc ||
    monster.submerged ||
    !monsterInReachArea
  ) {
    monster = undefined
    if (clicked === undefined && this.drlgRoomPopulator === null) {
      // Synthetic unit-test fallback only when no real target unit exists and DRLG room population is inactive.
      for (const candidate of this.monsters.values()) {
        if (!candidate.dead && !candidate.isNpc && !candidate.submerged && candidate.areaId === player.areaId) {
          monster = candidate
          break
        }
      }
    }
  }
  if (!monster) return

  if ((skillId === 78 || skillId === 88) && TOWN_AREAS.has(player.areaId)) return
  const cast = this.resolvePlayerSkillCast(player, skillId)
  if (cast === null) return
  const doFunc = cast.skill.srvDoFunc
  if (doFunc === SRVDOFUNC_WHIRLWIND && this.resolveWhirlwindEquippedHandsForPlayer113c(player) === null) {
    return
  }
  const isMovementStrike =
    doFunc === SRVDOFUNC_CHARGE || doFunc === SRVDOFUNC_LEAP_ATTACK || doFunc === SRVDOFUNC_DRAGON_FLIGHT
  const isMeleeStrike =
    !isMovementStrike &&
    (cast.missile === undefined || skillId === 238) &&
    (cast.skill.range === 'h2h' || cast.skill.range === 'both')
  if (options?.shift) {
    player.targetX = player.x
    player.targetY = player.y
  }
  if (isMeleeStrike && !this.isPlayerMeleeInRangeOfMonster(player, monster)) {
    if (options?.shift) {
      this.executeSkillAtLocation(player, skillId, monster.x, monster.y)
      return
    }
    // 1.13c `D2Game.dll` `0x6FCEE745` -> `0x6FCEE120`: out-of-range melee `0x06`/`0x0D` runs toward target
    // (`SKILLS_CastOnUnit(skillId=3)`) and queues the melee skill (`D2Common#10329`) to fire on arrival.
    if (this.consumeOrBlockMoveDuringPlayerAnim113c(player)) {
      return
    }
    this.clearPlayerChannelState(player)
    player.pendingInteraction = undefined
    player.pendingInteractionSteps = 0
    player.pendingNpcGamble = undefined
    player.moveTargetUnitId = monster.unitId
    player.moveTargetUnitType = UNIT_TYPE_113C.monster
    player.targetX = monster.x
    player.targetY = monster.y
    const staminaExhausted =
      player.staminaExhausted || player.stamina <= 0 || player.staminaFixed <= 0
    player.run = !staminaExhausted
    player.animResetFrame = undefined
    player.mode = player.run ? 3 : (TOWN_AREAS.has(player.areaId) ? 6 : 2)
    const motion = this.playerMotion.get(player.unitId)
    if (motion !== undefined) {
      motion.plannedX = Number.NaN
      motion.plannedY = Number.NaN
    }
    player.queuedSkillOnTarget = {
      skillId,
      targetId: monster.unitId,
      targetType: UNIT_TYPE_113C.monster,
    }
    return
  }
  // #1808/#1812/#1813/#1815/#1816: hand-equipment requirements are checked before mana is spent.
  if (!this.passesWave2HandRequirement113c(player, skillId)) return
  // Dragon Tail (#270) / Phoenix Strike (#280) carry a `srvmissile` for their release effects but
  // strike in melee: enforce melee reach before mana like every other h2h strike.
  if ((skillId === 270 || skillId === 280) && !this.isPlayerMeleeInRangeOfMonster(player, monster)) {
    if (options?.shift) {
      this.broadcastPlayerSkillCast(player, cast, {
        x: Math.round(monster.x),
        y: Math.round(monster.y),
      })
    }
    return
  }
  // #1816 / #1981 Dragon Flight (`aurarangecalc = 27`): reject out-of-range / missile-barrier-blocked targets before mana,
  // while permitting flight across walk-only water/chasms (`0x0001`).
  if (skillId === 275) {
    const range = evaluateDragonFlightStats(cast.slvl).rangeSubtiles
    if (
      Math.hypot(monster.x - player.x, monster.y - player.y) > range ||
      !this.isMonsterStepWalkable(player.areaId, player.x, player.y, monster.x, monster.y, true)
    ) {
      return
    }
  }

  const primaryMonster = monster
  if (this.animActionWindupEnabled && doFunc !== SRVDOFUNC_WHIRLWIND && !cast.skill.aura) {
    const fendTargets =
      skillId === 30 ? this.livingHostilesInMeleeReach113c(player, primaryMonster).slice(0, 12) : undefined
    let strikeCountOverride: number | undefined
    if (skillId === 26) {
      const targets = this.collectStrafeTargets113c(player, cast, primaryMonster)
      strikeCountOverride =
        targets.length === 0
          ? 1
          : strafeShotCount113c(
              this.evaluatePlayerSkillCalc(cast, cast.skill.calc1),
              this.evaluatePlayerSkillCalc(cast, cast.skill.calc3),
              targets.length,
            )
    } else if (skillId === 30) {
      strikeCountOverride = Math.max(1, fendTargets!.length)
    } else if (skillId === 106 || skillId === 248) {
      strikeCountOverride = Math.min(5, 1 + cast.slvl)
    } else if (skillId === 255) {
      strikeCountOverride = evaluateDragonTalonStats(cast.slvl).kickCount
    } else if (skillId === 260) {
      strikeCountOverride = 2
    }

    // `#144 Concentrate` (`SrvSt32`): applies temporary `concentrate` (`state 15`) defense bonus during swing.
    let concentrateApplied = false
    if (skillId === 144 && !player.states.has(15)) {
      concentrateApplied = true
      this.applyPlayerTimedState113c(
        player,
        15,
        100,
        { item_armor_percent: 100 + 10 * (cast.slvl - 1) },
        144,
        cast.slvl,
      )
    }

    let finisherSession:
      | { payloads: readonly DischargedPayload[]; tigerEdPct: number; released: boolean }
      | undefined

    this.schedulePlayerSkillWindup113c(
      player,
      cast,
      primaryMonster.x,
      primaryMonster.y,
      { unitType: 1, id: primaryMonster.unitId },
      {
        strikeCountOverride,
        onCleanup: concentrateApplied
          ? () => {
              if (player.states.has(15)) {
                this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 15)
              }
              this.playerCombat.get(player.unitId)?.stateBus.removeState(15)
            }
          : undefined,
        onStrike: (strikeIndex, totalStrikes) => {
          if (doFunc === SRVDOFUNC_JAB) {
            this.executeJabSingleStrike113c(player, cast, primaryMonster)
            return
          }
          if (doFunc === SRVDOFUNC_ZEAL_FURY_FEND) {
            if (skillId === 30) {
              const t = fendTargets?.[strikeIndex]
              if (t && !t.dead && this.isPlayerMeleeInRangeOfMonster(player, t)) {
                this.executeStandardSkillMeleeHit113c(player, cast, t)
              }
            } else {
              this.executeZealOrFurySingleStrike113c(player, cast, primaryMonster, strikeIndex)
            }
            return
          }
          if (skillId === 19) {
            this.executeImpaleStrike113c(player, cast, primaryMonster)
            return
          }
          if (skillId === 144) {
            this.executeConcentrateStrike113c(player, cast, primaryMonster)
            return
          }
          if (skillId === 133 || skillId === 147) {
            this.executeDualStrikeSingleHand113c(
              player,
              cast,
              primaryMonster,
              strikeIndex === 0 ? 'right' : 'left',
            )
            return
          }
          if (
            MARTIAL_FINISHER_SKILL_IDS_113C.has(skillId) &&
            (skillId !== 0 || cast.missile === undefined)
          ) {
            if (finisherSession === undefined) {
              const charges = liveMartialCharges113c(
                this.playerMartialCharges113c.get(player.unitId),
                this.currentFrame,
              )
              if (skillId !== 0 || charges.length > 0) {
                const payloads = resolveFinisherDischarge(
                  charges.map((c) => ({
                    skillId: c.skillId,
                    count: c.count,
                    slvl: c.slvl,
                    expiresAtFrame: this.currentFrame + 1,
                  })),
                  {
                    royalStrikeBlvl: player.skills.get(280) ?? 0,
                    fistsOfFireBlvl: player.skills.get(259) ?? 0,
                    clawsOfThunderBlvl: player.skills.get(269) ?? 0,
                    bladesOfIceBlvl: player.skills.get(274) ?? 0,
                  },
                )
                finisherSession = {
                  payloads,
                  tigerEdPct: payloads.reduce((sum, p) => sum + (p.enhancedDamagePct ?? 0), 0),
                  released: false,
                }
              }
            }
            if (finisherSession !== undefined) {
              this.executeMartialFinisherSingleStrike113c(
                player,
                cast,
                primaryMonster,
                strikeIndex,
                totalStrikes,
                finisherSession,
              )
              return
            }
          }
          if (this.executeWave2MeleeOnTarget113c(player, cast, primaryMonster)) return
          if (this.executeWave4TargetSkillDo113c(player, cast, primaryMonster, options)) return
          if (skillId === SKILL_TELEPORT) {
            this.relocatePlayerForSkill(player, primaryMonster.x, primaryMonster.y, true, true)
            return
          }
          if (isMovementStrike) {
            const arrival = this.pointBefore(player, primaryMonster.x, primaryMonster.y, 1)
            this.relocatePlayerForSkill(player, arrival.x, arrival.y, skillId === 275, skillId === 275)
            if (!primaryMonster.dead && this.isPlayerMeleeInRangeOfMonster(player, primaryMonster)) {
              const damage = this.rollPlayerSkillDamage(player, cast)
              if (damage > 0) this.applyDamageToMonster(player, primaryMonster, damage, skillId)
            }
            return
          }
          if (doFunc === SRVDOFUNC_LEAP) {
            this.relocatePlayerForSkill(player, primaryMonster.x, primaryMonster.y, false)
          }
          if (this.drlgRoomPopulator === null && doFunc === SRVDOFUNC_NOVA && skillId !== 130) {
            this.executeNovaSkill(player, cast)
            if (cast.missile !== undefined) {
              this.launchPlayerSkillMissile(player, cast, cast.missile, primaryMonster.x, primaryMonster.y, 0)
            }
            return
          }
          if (cast.missile !== undefined) {
            if (skillId === 26) {
              this.executeSingleStrafeShot113c(
                player,
                cast,
                cast.missile,
                primaryMonster.x,
                primaryMonster.y,
                strikeIndex,
                primaryMonster,
              )
              return
            }
            if (skillId === 140) {
              const hand = strikeIndex === 0 ? 'right' : 'left'
              const mRec =
                strikeIndex === 1 && cast.offHandMissile !== undefined
                  ? cast.offHandMissile
                  : cast.missile
              this.launchPlayerSkillMissile(
                player,
                cast,
                mRec,
                primaryMonster.x,
                primaryMonster.y,
                this.rollPlayerSkillDamage(player, cast),
              )
              this.consumeSingleHandThrowQuantity113c(player, hand)
              return
            }
            this.launchPlayerSkillMissiles(
              player,
              cast,
              cast.missile,
              primaryMonster.x,
              primaryMonster.y,
              primaryMonster,
            )
            return
          }
          if (skillId === 42) {
            this.applyStaticField(player, cast)
            return
          }
          if (doFunc === SRVDOFUNC_TELEKINESIS || doFunc === SRVDOFUNC_PSYCHIC_HAMMER) {
            if (!primaryMonster.dead) this.applyDirectSkillDamage(player, cast, primaryMonster)
            return
          }
          if (doFunc === SRVDOFUNC_MIND_BLAST) {
            this.executeMindBlast(player, cast, primaryMonster.x, primaryMonster.y)
            return
          }
          if (doFunc === SRVDOFUNC_CORPSE_EXPLOSION) {
            this.executeCorpseExplosion(player, cast, primaryMonster.x, primaryMonster.y)
            return
          }
          if (doFunc === SRVDOFUNC_CONVERSION) {
            if (!primaryMonster.dead) this.executePaladinConversion(player, cast, primaryMonster)
            return
          }
          if (isMeleeStrike) {
            const allowLockedDeadTarget113c =
              this.drlgRoomPopulator !== null && skillId === 0
            if (
              (!primaryMonster.dead || allowLockedDeadTarget113c) &&
              this.isPlayerMeleeInRangeOfMonster(player, primaryMonster)
            ) {
              this.executeStandardSkillMeleeHit113c(player, cast, primaryMonster)
            }
            return
          }
          this.applyPlayerSkillEffect(player, cast, primaryMonster.x, primaryMonster.y, primaryMonster)
        },
      },
    )
    return
  }

  this.syncPlayerAnimDispatcher113c(player)
  this.updatePlayerChannelState(player, cast)
  if (!cast.skill.useManaOnDo) {
    this.commitPlayerSkillCast(player, cast)
  }
  this.broadcastPlayerSkillCast(player, cast, { unitType: 1, id: monster.unitId })
  if (cast.skill.useManaOnDo) {
    if (
      cast.chargeItem === undefined &&
      !cast.isNoCostInState &&
      player.manaFixed < cast.evalResult.manaCost256
    ) {
      if (player.states.has(12)) this.clearPlayerChannelState(player)
      return
    }
    this.commitPlayerSkillCast(player, cast)
  }

  if (doFunc === SRVDOFUNC_JAB) {
    for (let i = 0; i < 3; i++) {
      this.executeJabSingleStrike113c(player, cast, monster)
    }
    return
  }
  if (doFunc === SRVDOFUNC_ZEAL_FURY_FEND) {
    if (skillId === 30) {
      const fendTargets = this.livingHostilesInMeleeReach113c(player, monster).slice(0, 12)
      for (const t of fendTargets) {
        if (!t.dead && this.isPlayerMeleeInRangeOfMonster(player, t)) {
          this.executeStandardSkillMeleeHit113c(player, cast, t)
        }
      }
    } else {
      const strikes = Math.min(5, 1 + cast.slvl)
      for (let i = 0; i < strikes; i++) {
        this.executeZealOrFurySingleStrike113c(player, cast, monster, i)
      }
    }
    return
  }
  if (skillId === 19) {
    this.executeImpaleStrike113c(player, cast, monster)
    return
  }
  if (skillId === 144) {
    this.executeConcentrateStrike113c(player, cast, monster)
    return
  }

  if (this.executeWave2MeleeOnTarget113c(player, cast, monster)) return
  if (this.executeWave4TargetSkillDo113c(player, cast, monster, options)) return

  if (skillId === SKILL_TELEPORT) {
    this.relocatePlayerForSkill(player, monster.x, monster.y, true, true)
    return
  }
  if (doFunc === SRVDOFUNC_WHIRLWIND) {
    this.executeWhirlwind(player, cast, monster.x, monster.y)
    return
  }
  if (isMovementStrike) {
    // Charge / Leap Attack / Dragon Flight: arrive next to the target, then strike it.
    const arrival = this.pointBefore(player, monster.x, monster.y, 1)
    this.relocatePlayerForSkill(player, arrival.x, arrival.y, skillId === 275, skillId === 275)
    if (this.isPlayerMeleeInRangeOfMonster(player, monster)) {
      const damage = this.rollPlayerSkillDamage(player, cast)
      if (damage > 0) this.applyDamageToMonster(player, monster, damage, skillId)
    }
    return
  }
  if (doFunc === SRVDOFUNC_LEAP) {
    this.relocatePlayerForSkill(player, monster.x, monster.y, false)
  }
  if (this.drlgRoomPopulator === null && doFunc === SRVDOFUNC_NOVA && skillId !== 130) {
    this.executeNovaSkill(player, cast)
    if (cast.missile !== undefined) {
      this.launchPlayerSkillMissile(player, cast, cast.missile, monster.x, monster.y, 0)
    }
    return
  }

  if (cast.missile !== undefined) {
    this.launchPlayerSkillMissiles(player, cast, cast.missile, monster.x, monster.y, monster)
    if (skillId === 140) this.consumeDoubleThrowQuantity113c(player)
    return
  }
  if (skillId === 42) {
    this.applyStaticField(player, cast)
    return
  }
  if (doFunc === SRVDOFUNC_TELEKINESIS || doFunc === SRVDOFUNC_PSYCHIC_HAMMER) {
    this.applyDirectSkillDamage(player, cast, monster)
    return
  }
  if (doFunc === SRVDOFUNC_MIND_BLAST) {
    this.executeMindBlast(player, cast, monster.x, monster.y)
    return
  }
  if (doFunc === SRVDOFUNC_CORPSE_EXPLOSION) {
    this.executeCorpseExplosion(player, cast, monster.x, monster.y)
    return
  }
  if (doFunc === SRVDOFUNC_CONVERSION) {
    this.executePaladinConversion(player, cast, monster)
    return
  }
  if (isMeleeStrike) {
    this.executeStandardSkillMeleeHit113c(player, cast, monster)
    return
  }
  this.applyPlayerSkillEffect(player, cast, monster.x, monster.y, monster)
}



function executeWave4TargetSkillDo113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  monster: InternalMonsterRecord,
  options?: { readonly shift?: boolean; readonly hold?: boolean },
): boolean {
  const skillId = cast.skill.id
  if (skillId === 111) {
    if (!monster.dead && this.isPlayerMeleeInRangeOfMonster(player, monster)) {
      this.executePaladinVengeance113c(player, cast, monster)
    }
    return true
  }
  if (skillId === 78) {
    this.executeBoneWall113c(player, cast, monster.x, monster.y)
    return true
  }
  if (skillId === 88) {
    this.executeBonePrison113c(player, cast, monster.x, monster.y)
    return true
  }
  if (skillId === 277) {
    this.activateBladeShieldState113c(player, cast.slvl)
    return true
  }
  if (skillId === 257) {
    this.executeBladeSentinel113c(player, cast, monster.x, monster.y)
    return true
  }
  if (skillId === 17) {
    this.executeSlowMissiles113c(player, cast)
    return true
  }
  if (skillId === 266) {
    this.activeBladeFuryChannels.set(player.unitId, {
      tx: monster.x,
      ty: monster.y,
      nextAutoShotFrame: this.currentFrame + 5,
      lastShotFrame: this.currentFrame,
      hold: options?.hold === true,
    })
    return false
  }
  // `#1886` Druid `Rabies (#238)` (`SrvSt57` / `SrvDo121` @ `0x6FC66A20`):
  // `Skills.txt` `#238` sets `srvmissile = rabiesplague`, so handle `#238` BEFORE `cast.missile !== undefined`!
  if (skillId === 238) {
    if (monster.dead || !this.isPlayerMeleeInRangeOfMonster(player, monster)) {
      return true
    }
    const physDamage = Math.max(1, this.rollPlayerSkillPhysDamage(player, cast))
    const outHitResult = { landedHitRoll: false }
    this.applyDamageToMonster(player, monster, physDamage, 238, 'phys', 'player', {
      attackKind: 'melee',
      outHitResult,
    })
    const bitrate256 = this.rollInclusive(
      cast.evalResult.minElemDmg256,
      cast.evalResult.maxElemDmg256,
    )
    if (
      outHitResult.landedHitRoll &&
      bitrate256 > 0 &&
      cast.evalResult.durationFrames > 0 &&
      !monster.dead &&
      this.applyMonsterPoisonDot(
        player,
        monster,
        bitrate256,
        cast.evalResult.durationFrames,
        238,
      )
    ) {
      this.applyUnitState(
        monster.states,
        monster.stateTimers,
        'monster',
        monster.unitId,
        monster.areaId,
        STATE_RABIES_113C,
        cast.evalResult.durationFrames,
      )
      monster.rabiesInfection = {
        expireFrame: this.currentFrame + cast.evalResult.durationFrames,
        rawBitrate256: bitrate256,
        attackerId: player.unitId,
        slvl: cast.slvl,
      }
    }
    return true
  }
  return false
}



/**
 * #1784: Execute a targeted skill against a hostile PvP unit (player, mercenary, or summoned pet).
 */
function executeSkillOnPvpTarget113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  skillId: number,
  pvpTarget:
    | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
    | {
        readonly kind: 'pet'
        readonly ownerId: number
        readonly pet: SummonedPetUnit
        readonly petUnitId: number
        readonly areaId: number
      },
): void {
  const resolveTargetPos = (): { x: number; y: number } => ({
    x:
      pvpTarget.kind === 'player'
        ? pvpTarget.player.x
        : pvpTarget.kind === 'merc'
          ? pvpTarget.merc.x
          : pvpTarget.pet.x,
    y:
      pvpTarget.kind === 'player'
        ? pvpTarget.player.y
        : pvpTarget.kind === 'merc'
          ? pvpTarget.merc.y
          : pvpTarget.pet.y,
  })
  const { x: tx, y: ty } = resolveTargetPos()
  const targetUnitId =
    pvpTarget.kind === 'player'
      ? pvpTarget.player.unitId
      : pvpTarget.kind === 'merc'
        ? pvpTarget.merc.unitId
        : pvpTarget.petUnitId
  const wireUnitType: 0 | 1 = pvpTarget.kind === 'player' ? 0 : 1
  const isTargetAlive = (): boolean =>
    this.resolveHostilePvpTargetById113c(player.unitId, player.areaId, targetUnitId, wireUnitType) !==
    undefined
  const lockedTargetKey = this.onlineUnitKey113c(pvpTarget.kind, targetUnitId)
  if ((skillId === 78 || skillId === 88) && TOWN_AREAS.has(player.areaId)) return
  const cast = this.resolvePlayerSkillCast(player, skillId)
  if (cast === null) return
  const doFunc = cast.skill.srvDoFunc
  if (doFunc === SRVDOFUNC_WHIRLWIND && this.resolveWhirlwindEquippedHandsForPlayer113c(player) === null) {
    return
  }
  const meleeReach = PLAYER_MELEE_REACH_SUBTILES + Math.max(0, this.resolvePlayerWeaponRangeAdder(player))
  const inMelee = Math.hypot(tx - player.x, ty - player.y) <= meleeReach
  const isMovementStrike =
    doFunc === SRVDOFUNC_CHARGE || doFunc === SRVDOFUNC_LEAP_ATTACK || doFunc === SRVDOFUNC_DRAGON_FLIGHT
  const isMeleeStrike =
    !isMovementStrike &&
    (cast.missile === undefined || skillId === 238) &&
    (cast.skill.range === 'h2h' || cast.skill.range === 'both')
  if (isMeleeStrike && !inMelee) return
  if (!this.passesWave2HandRequirement113c(player, skillId)) return
  if ((skillId === 270 || skillId === 280) && !inMelee) return
  if (skillId === 275) {
    const range = evaluateDragonFlightStats(cast.slvl).rangeSubtiles
    if (
      Math.hypot(tx - player.x, ty - player.y) > range ||
      !this.isMonsterStepWalkable(player.areaId, player.x, player.y, tx, ty, true)
    ) {
      return
    }
  }

  if (this.animActionWindupEnabled && doFunc !== SRVDOFUNC_WHIRLWIND && !cast.skill.aura) {
    const strikeCountOverride =
      skillId === 255
        ? evaluateDragonTalonStats(cast.slvl).kickCount
        : skillId === 106 || skillId === 248
          ? Math.min(5, 1 + cast.slvl)
          : skillId === 260
            ? 2
            : undefined
    this.schedulePlayerSkillWindup113c(
      player,
      cast,
      tx,
      ty,
      { unitType: wireUnitType, id: targetUnitId },
      {
        strikeCountOverride,
        onStrike: (strikeIndex) => {
          if (!isTargetAlive()) return
          const livePos = resolveTargetPos()
          const liveInMelee = Math.hypot(livePos.x - player.x, livePos.y - player.y) <= meleeReach
          if (skillId === 133 || skillId === 147) {
            if (!liveInMelee) return
            const isFrenzy = skillId === 147
            const magicPct = isFrenzy ? Math.min(100, Math.max(0, player.skills.get(152) ?? 0)) : 0
            const hand = strikeIndex === 0 ? 'right' : 'left'
            const total = this.rollWave2HandStrike113c(player, cast, hand)
            const magic = Math.trunc((total * magicPct) / 100)
            const phys = total - magic
            const landed = this.applyPvpHitToTarget113c(player, pvpTarget, {
              skillId,
              physDamage: phys,
              elemDamage: magic,
              elemType: magic > 0 ? 'mag' : undefined,
              attackKind: 'melee',
            })
            if (isFrenzy) {
              const prev = this.playerFrenzyStack113c.get(player.unitId)
              const step = stepFrenzyStack113c(prev, this.currentFrame, cast.slvl, landed)
              this.playerFrenzyStack113c.set(player.unitId, {
                stacks: step.stacks,
                expireFrame: step.expireFrame,
              })
              if (landed && step.stacks > 0) {
                this.applyPlayerTimedState113c(
                  player,
                  FRENZY_STATE_ID_113C,
                  FRENZY_DURATION_FRAMES_113C,
                  {
                    skill_frenzy: step.stacks,
                    velocitypercent: step.velocityPct,
                    attackrate: step.attackRatePct,
                  },
                  skillId,
                  cast.slvl,
                )
              }
            }
            return
          }
          if (skillId === 255) {
            if (!liveInMelee) return
            const kickDmg = this.rollKickDamage113c(player, cast, 0)
            this.applyPvpHitToTarget113c(player, pvpTarget, {
              skillId,
              physDamage: kickDmg,
              attackKind: 'melee',
            })
            return
          }
          if (strikeIndex > 0) {
            if (liveInMelee && (isMeleeStrike || KICK_SKILL_IDS_113C.has(skillId))) {
              this.applyPvpSkillHitToTarget113c(player, cast, pvpTarget, 'melee')
            }
            return
          }
          this.executePvpSkillImmediateRelease113c(
            player,
            cast,
            pvpTarget,
            livePos.x,
            livePos.y,
            lockedTargetKey,
            meleeReach,
            isMovementStrike,
            isMeleeStrike,
          )
        },
      },
    )
    return
  }

  this.syncPlayerAnimDispatcher113c(player)
  this.updatePlayerChannelState(player, cast)
  if (!cast.skill.useManaOnDo) {
    this.commitPlayerSkillCast(player, cast)
  }
  this.broadcastPlayerSkillCast(player, cast, { unitType: wireUnitType, id: targetUnitId })
  if (cast.skill.useManaOnDo) {
    if (
      cast.chargeItem === undefined &&
      !cast.isNoCostInState &&
      player.manaFixed < cast.evalResult.manaCost256
    ) {
      if (player.states.has(12)) this.clearPlayerChannelState(player)
      return
    }
    this.commitPlayerSkillCast(player, cast)
  }

  this.executePvpSkillImmediateRelease113c(
    player,
    cast,
    pvpTarget,
    tx,
    ty,
    lockedTargetKey,
    meleeReach,
    isMovementStrike,
    isMeleeStrike,
  )
}



function executePvpSkillImmediateRelease113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  pvpTarget:
    | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
    | {
        readonly kind: 'pet'
        readonly ownerId: number
        readonly pet: SummonedPetUnit
        readonly petUnitId: number
        readonly areaId: number
      },
  tx: number,
  ty: number,
  lockedTargetKey: string,
  meleeReach: number,
  isMovementStrike: boolean,
  isMeleeStrike: boolean,
): void {
  const skillId = cast.skill.id
  const doFunc = cast.skill.srvDoFunc
  const inMelee = Math.hypot(tx - player.x, ty - player.y) <= meleeReach

  if (skillId === 111) {
    if (!inMelee) return
    const wBase = this.computePlayerVengeanceWeaponBase113c(player)
    const weaponBaseRolled = this.rollInclusive(wBase.vMin, wBase.vMax)
    const vStats = calculateVengeanceStats(cast.slvl, {
      resistFire: player.skills.get(100) ?? 0,
      resistCold: player.skills.get(105) ?? 0,
      resistLightning: player.skills.get(110) ?? 0,
      salvation: player.skills.get(125) ?? 0,
    })
    const physDamage = this.rollPlayerSkillPhysDamage(player, cast)
    this.applyPvpHitToTarget113c(player, pvpTarget, {
      skillId: 111,
      physDamage,
      attackKind: 'melee',
      toHitBonusPct: vStats.toHitBonusPct,
      elemDurationFrames: vStats.chillDurationFrames,
      vengeanceBasePhys: weaponBaseRolled,
      multiElemPacket: {
        firePct: vStats.firePct,
        coldPct: vStats.coldPct,
        ltngPct: vStats.ltngPct,
        chillDurationFrames: vStats.chillDurationFrames,
      },
    })
    return
  }
  if (skillId === 78) {
    this.executeBoneWall113c(player, cast, tx, ty)
    return
  }
  if (skillId === 88) {
    this.executeBonePrison113c(player, cast, tx, ty)
    return
  }
  if (skillId === 277) {
    this.activateBladeShieldState113c(player, cast.slvl)
    return
  }
  if (skillId === 257) {
    this.executeBladeSentinel113c(player, cast, tx, ty)
    return
  }
  if (skillId === 17) {
    this.executeSlowMissiles113c(player, cast)
    return
  }
  if (skillId === 238) {
    if (!inMelee) return
    this.applyPvpSkillHitToTarget113c(player, cast, pvpTarget, 'melee')
    return
  }

  if (skillId === 97) {
    const damage = this.removeAuraEdFromPreScaled113c(player, this.rollPlayerSkillPhysDamage(player, cast))
    const landed = this.applyPvpHitToTarget113c(player, pvpTarget, {
      skillId: 97,
      physDamage: damage,
      attackKind: 'melee',
      autoHit: true,
      unblockable: true,
    })
    if (landed) {
      this.applyPvpDebuffStateToTarget113c(
        pvpTarget,
        21,
        computeSmiteStunFrames113c(cast.slvl),
        `player_${player.unitId}`,
        97,
        cast.slvl,
      )
    }
    return
  }

  if (skillId === 133 || skillId === 147) {
    const isFrenzy = skillId === 147
    const magicPct = isFrenzy ? Math.min(100, Math.max(0, player.skills.get(152) ?? 0)) : 0
    let frenzy = this.playerFrenzyStack113c.get(player.unitId)
    let refreshed = false
    for (const hand of ['right', 'left'] as const) {
      const total = this.rollWave2HandStrike113c(player, cast, hand)
      const magic = Math.trunc((total * magicPct) / 100)
      const phys = total - magic
      const landed = this.applyPvpHitToTarget113c(player, pvpTarget, {
        skillId,
        physDamage: phys,
        elemDamage: magic,
        elemType: magic > 0 ? 'mag' : undefined,
        attackKind: 'melee',
      })
      if (isFrenzy) {
        const step = stepFrenzyStack113c(frenzy, this.currentFrame, cast.slvl, landed)
        frenzy = { stacks: step.stacks, expireFrame: step.expireFrame }
        if (landed) refreshed = true
      }
    }
    if (isFrenzy && frenzy !== undefined) {
      this.playerFrenzyStack113c.set(player.unitId, frenzy)
      if (refreshed && frenzy.stacks > 0) {
        const step = stepFrenzyStack113c(frenzy, this.currentFrame, cast.slvl, false)
        this.applyPlayerTimedState113c(
          player,
          FRENZY_STATE_ID_113C,
          FRENZY_DURATION_FRAMES_113C,
          { skill_frenzy: step.stacks, velocitypercent: step.velocityPct, attackrate: step.attackRatePct },
          skillId,
          cast.slvl,
        )
      }
    }
    return
  }

  if (skillId === SKILL_TELEPORT) {
    this.relocatePlayerForSkill(player, tx, ty, true, true)
    return
  }
  if (doFunc === SRVDOFUNC_WHIRLWIND) {
    this.executeWhirlwind(player, cast, tx, ty)
    return
  }
  if (isMovementStrike) {
    const arrival = this.pointBefore(player, tx, ty, 1)
    this.relocatePlayerForSkill(player, arrival.x, arrival.y, skillId === 275, skillId === 275)
    if (Math.hypot(tx - player.x, ty - player.y) <= meleeReach) {
      if (KICK_SKILL_IDS_113C.has(skillId)) {
        const kickDmg = this.rollKickDamage113c(player, cast, 0)
        this.applyPvpHitToTarget113c(player, pvpTarget, {
          skillId,
          physDamage: kickDmg,
          attackKind: 'melee',
        })
      } else {
        this.applyPvpSkillHitToTarget113c(player, cast, pvpTarget, 'melee')
      }
    }
    return
  }
  if (doFunc === SRVDOFUNC_LEAP) {
    this.relocatePlayerForSkill(player, tx, ty, false)
  }
  if (this.drlgRoomPopulator === null && doFunc === SRVDOFUNC_NOVA) {
    this.executeNovaSkill(player, cast)
    if (cast.missile !== undefined) {
      this.launchPlayerSkillMissile(player, cast, cast.missile, tx, ty, 0)
    }
    return
  }
  if (cast.missile !== undefined) {
    this.launchPlayerSkillMissiles(player, cast, cast.missile, tx, ty, undefined, lockedTargetKey)
    if (skillId === 140) this.consumeDoubleThrowQuantity113c(player)
    return
  }
  if (skillId === 42) {
    this.applyStaticField(player, cast)
    return
  }
  if (doFunc === SRVDOFUNC_TELEKINESIS || doFunc === SRVDOFUNC_PSYCHIC_HAMMER) {
    this.applyPvpSkillHitToTarget113c(player, cast, pvpTarget, 'spell')
    return
  }
  if (doFunc === SRVDOFUNC_MIND_BLAST) {
    this.executeMindBlast(player, cast, tx, ty)
    return
  }
  if (doFunc === SRVDOFUNC_CORPSE_EXPLOSION) {
    this.executeCorpseExplosion(player, cast, tx, ty)
    return
  }
  if (isMeleeStrike || KICK_SKILL_IDS_113C.has(skillId)) {
    if (KICK_SKILL_IDS_113C.has(skillId)) {
      const strikes = skillId === 255 ? evaluateDragonTalonStats(cast.slvl).kickCount : 1
      for (let i = 0; i < strikes; i++) {
        const kickDmg = this.rollKickDamage113c(player, cast, 0)
        this.applyPvpHitToTarget113c(player, pvpTarget, {
          skillId,
          physDamage: kickDmg,
          attackKind: 'melee',
        })
      }
    } else {
      this.applyPvpSkillHitToTarget113c(player, cast, pvpTarget, 'melee')
    }
    return
  }
  if (
    cast.skill.auraTgtState !== '' &&
    cast.evalResult.durationFrames > 0 &&
    cast.evalResult.radiusSubtiles <= 0
  ) {
    const st = this.registry.getStateByName(cast.skill.auraTgtState)
    if (st !== undefined && !FRIENDLY_AURA_TARGET_STATE_IDS_113C.has(st.id)) {
      const stats = this.evaluateSkillStateStats(
        cast.skill,
        cast.slvl,
        this.playerCombatContext(player).statList,
      )
      this.applyPvpDebuffStateToTarget113c(
        pvpTarget,
        st.id,
        cast.evalResult.durationFrames,
        `player_${player.unitId}`,
        cast.skill.id,
        cast.slvl,
        stats,
      )
      return
    }
  }
  this.applyPlayerSkillEffect(player, cast, tx, ty, undefined)
}



/** Standard 1-strike melee skill damage + poison DoT + Open Wounds rider. */
function executeStandardSkillMeleeHit113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  monster: InternalMonsterRecord,
): void {
  const skillId = cast.skill.id
  if (cast.evalResult.elemType === 'pois' && cast.evalResult.durationFrames > 0) {
    const physDamage = this.rollPlayerSkillPhysDamage(player, cast)
    const hitResult = { landedHitRoll: true }
    if (physDamage > 0) {
      this.applyDamageToMonster(player, monster, physDamage, skillId, 'phys', 'player', {
        outHitResult: hitResult,
      })
    }
    const landed = hitResult.landedHitRoll
    const bitrate256 = this.rollInclusive(
      cast.evalResult.minElemDmg256,
      cast.evalResult.maxElemDmg256,
    )
    if (landed && bitrate256 > 0 && !monster.dead) {
      // 1.13c `#73 Poison Dagger` (`SrvDo006`): sums skill poison bitrate with weapon/charm/Venom
      // poison bitrate and adds effective weapon poison length (`10` frames under `#278 Venom`, #1871).
      const combat = this.playerCombat.get(player.unitId)
      const venomMod =
        combat?.stateBus.getState(31) ?? combat?.stateBus.getState('venom')
      const hasVenom = venomMod !== undefined || player.states.has(31)
      const venomMin256 = venomMod ? (venomMod.stats['poisonmindam'] ?? 0) : 0
      const venomMax256 = Math.max(
        venomMin256,
        venomMod ? (venomMod.stats['poisonmaxdam'] ?? 0) : 0,
      )
      const effWeapPois =
        skillId === 73
          ? getEffectiveWeaponPoison113c(
              this.collectPlayerWeaponPoisonSources113c(player),
              hasVenom,
              venomMin256,
              venomMax256,
              this.rng,
            )
          : { bitrate256: 0, lengthFrames: 0 }
      this.applyMonsterPoisonDot(
        player,
        monster,
        bitrate256 + effWeapPois.bitrate256,
        cast.evalResult.durationFrames + effWeapPois.lengthFrames,
        skillId,
      )
    }
    if (landed) this.applyPlayerMeleeRiders113c(player, monster)
    return
  }
  // 1.13c `#111 Vengeance` (`SKILLS_SrvDo002_Vengeance` @ `0x6FCF5B80`, #1868):
  if (skillId === 111) {
    const physDamage = this.rollPlayerSkillPhysDamage(player, cast)
    const hitResult = { landedHitRoll: false }
    this.applyDamageToMonster(player, monster, physDamage, 111, 'phys', 'player', {
      skipHitRiders: true,
      outHitResult: hitResult,
    })
    if (hitResult.landedHitRoll && !monster.dead) {
      const convBase = this.resolvePlayerWeaponDamage(player, 0, {
        excludeNormalDamage: true,
        baseOnlyWithoutOffWeaponEd: true,
      })
      const baseVengPct = 70 + 6 * (cast.slvl - 1)
      const salvationSyn = 2 * Math.max(0, player.skills.get(125) ?? 0)
      const firePct = baseVengPct + 10 * Math.max(0, player.skills.get(100) ?? 0) + salvationSyn
      const coldPct = baseVengPct + 10 * Math.max(0, player.skills.get(105) ?? 0) + salvationSyn
      const ltngPct = baseVengPct + 10 * Math.max(0, player.skills.get(110) ?? 0) + salvationSyn
      const coldFrames = this.resolveSkillColdOrFreezeDuration113c(player, 111, 'cold').rawFrames
      for (const [ch, pct] of [
        ['fire', firePct],
        ['cold', coldPct],
        ['ltng', ltngPct],
      ] as const) {
        if (monster.dead || pct <= 0) continue
        const eMin = Math.max(1, Math.trunc((convBase.min * pct) / 100))
        const eMax = Math.max(eMin, Math.trunc((convBase.max * pct) / 100))
        this.applyDamageToMonster(
          player,
          monster,
          this.rollInclusive(eMin, eMax),
          111,
          ch,
          'player',
          {
            attackKind: 'melee',
            autoHit: true,
            unblockable: true,
            skipHitRiders: true,
            ...(ch === 'cold' ? { elemDurationFrames: coldFrames } : {}),
          },
        )
      }
    }
    if (hitResult.landedHitRoll) this.applyPlayerMeleeRiders113c(player, monster)
    return
  }
  if (
    this.drlgRoomPopulator !== null &&
    cast.evalResult.srcDam > 0 &&
    cast.evalResult.minPhysDmg === 0 &&
    cast.evalResult.maxPhysDmg === 0 &&
    cast.skill.eType === '' &&
    (cast.missile?.eType ?? '') === ''
  ) {
    const pSeed = this.unitSeeds.get(`${UNIT_TYPE_113C.player}:${player.unitId}`)
    if (pSeed !== undefined) {
      const baseBand = this.resolvePlayerWeaponDamage(player, 0, {
        baseOnlyWithoutOffWeaponEd: true,
      })
      const combat = this.playerCombat.get(player.unitId)
      const offWeaponItemEd =
        this.sumPlayerItemStat(player, 17, { excludeWeaponHands: true }) +
        this.sumPlayerItemStat(player, 25, { excludeWeaponHands: true })
      const offWeaponEdPercent =
        (combat === undefined ? 0 : combat.statList.getModifierBonus('damagepercent')) +
        offWeaponItemEd +
        cast.evalResult.physDamagePct
      const totalStr =
        player.strength +
        this.sumPlayerItemStat(player, 0) +
        (combat === undefined ? 0 : combat.statList.getModifierBonus('strength'))
      const totalDex =
        player.dexterity +
        this.sumPlayerItemStat(player, 2) +
        (combat === undefined ? 0 : combat.statList.getModifierBonus('dexterity'))
      const { right, left } = this.activeHandItems113c(player)
      const rightBase = right ? resolveWeaponBase113c(right.code) : undefined
      const leftBase = left ? resolveWeaponBase113c(left.code) : undefined
      const weapon = rightBase ? right : leftBase ? left : undefined
      const wBase = rightBase ?? leftBase
      let combinedEdPct: number
      let enDmgPct113c = 0
      if (wBase === undefined) {
        combinedEdPct = Math.max(-90, offWeaponEdPercent + totalStr)
      } else {
        const masteryEdPct =
          resolveWeaponMasteryBonus113c(wBase.type, false, (id) =>
            player.skills.has(id) || combat?.statList.getEffectiveSkillLevel(id) !== undefined
              ? this.resolvePlayerSkillLevelById(player, id)
              : 0,
          )?.damagePct ?? 0
        const statBonusPercent =
          Math.trunc((totalStr * wBase.strBonus) / 100) +
          Math.trunc((totalDex * wBase.dexBonus) / 100)
        // `SUNITDMG_FillDamageValues` (`0x6FCFD4E2` -> `0x6FCFA8C0`): vs an undead defender (`#10239`) a blunt
        // weapon (`#10744(weapon, 0x39 'blun')`) adds 50 to `pDamage->dwEnDmgPct` (`+0x0C`), which seeds the
        // `SUNITDMG_FillPacket` %ED pool (oracle `p52-necromancer-curses` F=948: `raw[3] = 50`, 1477 damage).
        // `item_undeaddamage_percent` (122) of the same routine is added by `executeSUnitDmg`.
        const bluntVsUndeadPct = monster.isUndead && itemTypeIsA(wBase.type, 'blun') ? 50 : 0
        enDmgPct113c = bluntVsUndeadPct
        combinedEdPct = Math.max(
          -90,
          offWeaponEdPercent + masteryEdPct + statBonusPercent + bluntVsUndeadPct,
        )
      }
      const wasDeadBefore = monster.dead
      const landed = this.applyDamageToMonster(player, monster, 0, skillId, 'phys', 'player', {
        attackKind: 'melee',
        allowDeadTarget113c: wasDeadBefore,
        d2AttackerSeed113c: pSeed,
        unrolledWeaponBase113c: {
          min256: baseBand.min * FIXED_ONE,
          max256: baseBand.max * FIXED_ONE,
          edPct: combinedEdPct,
          srcDam: cast.evalResult.srcDam,
          enDmgPct113c,
        },
      })
      if (landed) {
        if (
          weapon !== undefined &&
          weapon.maxDurability > 0 &&
          weapon.durability > 0 &&
          !collectItemStats(weapon).some((s) => s.statId === 152 && s.value > 0)
        ) {
          if (rollLimitedSeed113c(pSeed, 100) < 4) {
            this.degradeEquippedWeaponDurabilityOnHit113c(player)
          }
        }
        if (!wasDeadBefore) {
          this.applyPlayerMeleeRiders113c(player, monster)
        }
      }
      return
    }
  }
  const damage = this.rollPlayerSkillDamage(player, cast)
  if (damage > 0) {
    const landed = this.applyDamageToMonster(player, monster, damage, skillId)
    if (landed) this.applyPlayerMeleeRiders113c(player, monster)
  }
}



/** `#10 Jab` (`SrvDo007` @ `0x6FC6CE80`): 1 spear strike of the 3-strike `SequenceTbls` sequence. */
function executeJabSingleStrike113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  primaryMonster: InternalMonsterRecord,
): void {
  const target =
    !primaryMonster.dead && this.isPlayerMeleeInRangeOfMonster(player, primaryMonster)
      ? primaryMonster
      : this.livingHostilesInMeleeReach113c(player)[0]
  if (!target) return
  const damage = this.rollWave2HandStrike113c(player, cast, 'right')
  const landed = this.applyDamageToMonster(player, target, damage, 10, 'phys')
  if (landed) this.applyPlayerMeleeRiders113c(player, target)
}



/**
 * `#106 Zeal` / `#248 Fury` (`SrvDo013` @ `0x6FC6E290`): 1 rollback strike distributed round-robin
 * across living hostiles in melee reach (`primary` first, cycling back on single target).
 */
function executeZealOrFurySingleStrike113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  primaryMonster: InternalMonsterRecord,
  strikeIndex: number,
): void {
  const candidates = this.livingHostilesInMeleeReach113c(player, primaryMonster)
  if (candidates.length === 0) return
  const target = candidates[strikeIndex % candidates.length]!
  const damage = this.rollWave2HandStrike113c(player, cast, 'right')
  const landed = this.applyDamageToMonster(player, target, damage, cast.skill.id, 'phys')
  if (landed) this.applyPlayerMeleeRiders113c(player, target)
}



/** `#19 Impale` (`SrvSt007` + `SrvDo002`): heavy spear thrust + weapon durability loss roll on hit. */
function executeImpaleStrike113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  monster: InternalMonsterRecord,
): void {
  if (monster.dead || !this.isPlayerMeleeInRangeOfMonster(player, monster)) return
  const damage = this.rollWave2HandStrike113c(player, cast, 'right')
  const landed = this.applyDamageToMonster(player, monster, damage, 19, 'phys')
  if (!landed) return
  this.applyPlayerMeleeRiders113c(player, monster)

  const { right, left } = this.activeHandItems113c(player)
  const weapon =
    right !== undefined && resolveWeaponBase113c(right.code) !== undefined
      ? right
      : left !== undefined && resolveWeaponBase113c(left.code) !== undefined
        ? left
        : undefined
  if (weapon === undefined) return
  const isIndestructible = collectItemStats(weapon).some((s) => s.statId === 152 && s.value > 0)
  if (isIndestructible || weapon.maxDurability <= 0 || weapon.durability <= 0) return
  const lossChance = Math.max(0, this.evaluatePlayerSkillCalc(cast, cast.skill.calc2))
  const lossAmount = Math.max(1, this.evaluatePlayerSkillCalc(cast, cast.skill.calc3) || 1)
  if (lossChance > 0 && (lossChance >= 100 || this.rng.rand(100) < lossChance)) {
    const nextDur = Math.max(0, weapon.durability - lossAmount)
    weapon.durability = nextDur
    if (weapon.stats.has(72)) weapon.stats.set(72, nextDur)
    if (weapon.rawItemData !== undefined) {
      weapon.rawItemData = {
        ...weapon.rawItemData,
        durability: nextDur,
        curDurability: nextDur,
        stats: weapon.rawItemData.stats.map((s) =>
          s.statId === 72 ? { ...s, value: nextDur } : s,
        ),
      }
    }
    this.emitToPlayer(player.unitId, {
      type: 'StatSet',
      unit: { unitType: 4, id: weapon.unitId },
      stat: 72,
      param: 0,
      value: nextDur,
    })
  }
}



/**
 * `#144 Concentrate` (`SrvSt32` + `SrvDo002`): uninterruptible strike converting
 * `min(100, Berserk.blvl)%` physical damage to magic damage.
 */
function executeConcentrateStrike113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  monster: InternalMonsterRecord,
): void {
  if (monster.dead || !this.isPlayerMeleeInRangeOfMonster(player, monster)) return
  const total = this.rollWave2HandStrike113c(player, cast, 'right')
  const magicPct = Math.min(100, Math.max(0, player.skills.get(152) ?? 0))
  const magic = Math.trunc((total * magicPct) / 100)
  const phys = total - magic
  const landed =
    phys > 0
      ? this.applyDamageToMonster(player, monster, phys, 144, 'phys')
      : this.applyDamageToMonster(player, monster, magic, 144, 'mag', 'player', { attackKind: 'melee' })
  if (landed && phys > 0 && magic > 0 && !monster.dead) {
    this.applyDamageToMonster(player, monster, magic, 144, 'mag', 'player', {
      attackKind: 'melee',
      autoHit: true,
      unblockable: true,
    })
  }
  if (landed) this.applyPlayerMeleeRiders113c(player, monster)
}



// ===========================================================================================
// Wave 2 melee / Telekinesis runtime (#1806, #1808, #1812, #1813, #1815, #1816).
// Pure 1.13c rules live in `src/server/skills/martial-dualwield-113c.ts`.
// ===========================================================================================

function activeHandItems113c(this: GameInstanceHost, player: InternalPlayerRecord): {
  readonly right: ServerItemEntry | undefined
  readonly left: ServerItemEntry | undefined
} {
  const equipped = player.items.filter(
    (i) => i.location === 'equipped' && i.bodyLoc !== 11 && i.bodyLoc !== 12,
  )
  return {
    right: equipped.find((i) => i.bodyLoc === BODYLOC_RIGHT_ARM),
    left: equipped.find((i) => i.bodyLoc === BODYLOC_LEFT_ARM),
  }
}



/** `STAT_QUANTITY` (70) of a stackable item; falls back to the entry quantity. */
function itemQuantity113c(this: GameInstanceHost, item: ServerItemEntry | undefined): number {
  if (item === undefined) return 0
  const stat = collectItemStats(item).find((s) => s.statId === STAT_QUANTITY)
  return stat !== undefined ? stat.value : item.quantity
}



/**
 * Hand-equipment gate of Double Swing / Double Throw / Frenzy and the Martial Arts skills
 * (`validateWave2SkillHands113c`). Smite's shield gate stays in `resolvePlayerSkillCast` (#1800).
 */
function passesWave2HandRequirement113c(this: GameInstanceHost, player: InternalPlayerRecord, skillId: number): boolean {
  if (skillId === 97) return true
  const { right, left } = this.activeHandItems113c(player)
  return validateWave2SkillHands113c(skillId, right, left, {
    right: this.itemQuantity113c(right),
    left: this.itemQuantity113c(left),
  }).valid
}



/** Double Throw (`SrvDo074`) spends one throwing weapon from each hand. */
function consumeDoubleThrowQuantity113c(this: GameInstanceHost, player: InternalPlayerRecord): void {
  const { right, left } = this.activeHandItems113c(player)
  if (right === undefined || left === undefined) return
  for (const item of [right, left]) {
    const next = Math.max(0, this.itemQuantity113c(item) - 1)
    item.quantity = next
    if (item.stats.has(STAT_QUANTITY)) item.stats.set(STAT_QUANTITY, next)
    if (item.rawItemData !== undefined) {
      item.rawItemData = {
        ...item.rawItemData,
        quantity: next,
        stats: item.rawItemData.stats.map((s) => (s.statId === STAT_QUANTITY ? { ...s, value: next } : s)),
      }
    }
    this.emitToPlayer(player.unitId, {
      type: 'StatSet',
      unit: { unitType: 4, id: item.unitId },
      stat: STAT_QUANTITY,
      param: 0,
      value: next,
    })
  }
}



/** Apply a timed player state whose `stats` feed the StateBus (FRW/IAS/AR) and the 0xA8 packet. */
function applyPlayerTimedState113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  stateId: number,
  durationFrames: number,
  stats: Readonly<Record<string, number>>,
  skillId: number,
  slvl: number,
): void {
  this.playerCombatContext(player).stateBus.applyState({
    stateNameOrId: stateId,
    sourceUnitId: `player_${player.unitId}`,
    sourceSkillId: skillId,
    slvl,
    durationFrames,
    currentFrame: this.currentFrame,
    stats,
  })
  this.applyUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, stateId, durationFrames)
}



/**
 * `resolvePlayerWeaponDamage` folds aura `%ED` into its pool and `executeSUnitDmg` adds the
 * aura `damagepercent` again; divide it back out so the aura counts once (additive pool).
 */
function removeAuraEdFromPreScaled113c(this: GameInstanceHost, player: InternalPlayerRecord, damage: number): number {
  const auraEd = this.playerCombat.get(player.unitId)?.statList.getModifierBonus('damagepercent') ?? 0
  if (auraEd <= 0) return Math.max(1, Math.trunc(damage))
  return Math.max(1, Math.trunc((damage * 100) / (100 + auraEd)))
}



/** One weapon strike of the given hand (`SrcDam`/128 of the hand's weapon roll + skill `%ED`). */
function rollWave2HandStrike113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  hand: 'right' | 'left',
  extraEdPct = 0,
): number {
  const ev = cast.evalResult
  const range = this.resolvePlayerWeaponDamage(player, ev.physDamagePct + extraEdPct, { weaponHand: hand })
  const srcDam = ev.srcDam > 0 ? ev.srcDam : 128
  const weaponHit = Math.trunc((this.rollInclusive(range.min, range.max) * srcDam) / 128)
  return this.removeAuraEdFromPreScaled113c(player, weaponHit + this.rollInclusive(ev.minPhysDmg, ev.maxPhysDmg))
}



/** Equipped boots (`bodyLoc 9`) `Armor.txt` kick `mindam..maxdam`, `0..0` barefoot. */
function resolveEquippedBootKickDamage113c(this: GameInstanceHost, player: InternalPlayerRecord): { min: number; max: number } {
  const boots = player.items.find((i) => i.location === 'equipped' && i.bodyLoc === 9)
  const meta = boots !== undefined ? resolveArmorCombatMeta113c(boots.code) : undefined
  return meta === undefined ? { min: 0, max: 0 } : { min: meta.smiteMinDam, max: meta.smiteMaxDam }
}



/** 1.13c kick roll (`0x6FC42F10`); kick packets bypass the pipeline `%ED`, so auras are folded here. */
function rollKickDamage113c(this: GameInstanceHost, player: InternalPlayerRecord, cast: PlayerSkillCast, extraEdPct: number): number {
  const combat = this.playerCombat.get(player.unitId)
  const strength =
    player.strength + this.sumPlayerItemStat(player, 0) + (combat?.statList.getModifierBonus('strength') ?? 0)
  const dexterity =
    player.dexterity + this.sumPlayerItemStat(player, 2) + (combat?.statList.getModifierBonus('dexterity') ?? 0)
  const offWeaponEdPct =
    this.sumPlayerItemStat(player, 17, { excludeWeaponHands: true }) +
    this.sumPlayerItemStat(player, 25, { excludeWeaponHands: true }) +
    (combat?.statList.getModifierBonus('damagepercent') ?? 0)
  const skillEdPct =
    cast.skill.id === 270
      ? 0
      : cast.skill.id === 275
        ? evaluateDragonFlightStats(cast.slvl).enhancedDamagePct
        : cast.evalResult.physDamagePct
  const range = computeKickDamageRange113c({
    strength,
    dexterity,
    boot: this.resolveEquippedBootKickDamage113c(player),
    skillEdPct: skillEdPct + extraEdPct,
    offWeaponEdPct,
  })
  return this.rollInclusive(range.min, range.max)
}



/** Player `item_openwounds` (stat 135) & `item_preventheal` (stat 117) riders on a landed melee strike. */
function applyPlayerMeleeRiders113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  monster: InternalMonsterRecord,
  weaponHand?: 'left' | 'right',
): void {
  if (monster.dead) return
  const handOpts = weaponHand !== undefined ? { weaponHand } : undefined
  const owChance = this.sumPlayerItemStat(player, 135, handOpts)
  if (owChance > 0 && (owChance >= 100 || this.rng.rand(100) < owChance)) {
    this.applyMonsterOpenWounds113c(player, monster)
  }
  if (this.sumPlayerItemStat(player, 117, handOpts) > 0) {
    this.applyMonsterPreventHeal113c(monster)
  }
}



function hostilesNear113c(this: GameInstanceHost, areaId: number, cx: number, cy: number, radius: number): InternalMonsterRecord[] {
  return [...this.monsters.values()].filter(
    (m) =>
      !m.dead &&
      !m.isNpc &&
      !m.submerged &&
      (m.areaId === areaId ||
        (!TOWN_AREAS.has(areaId) &&
          !TOWN_AREAS.has(m.areaId) &&
          m.isKillable &&
          this.isAreaSeamAdjacent(areaId, m.areaId))) &&
      !this.isMonsterConverted(m) &&
      m.align === 0 &&
      Math.hypot(m.x - cx, m.y - cy) <= radius,
  )
}



/** Returns true when the cast was fully handled by a Wave 2 runtime path. */
function executeWave2MeleeOnTarget113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  monster: InternalMonsterRecord,
): boolean {
  const skillId = cast.skill.id
  if (skillId === 97) {
    this.executeSmite113c(player, cast, monster)
    return true
  }
  if (skillId === 133 || skillId === 147) {
    this.executeDualStrike113c(player, cast, monster)
    return true
  }
  if (getProgressiveSkillSpec113c(skillId) !== undefined) {
    this.executeMartialChargeUp113c(player, cast, monster)
    return true
  }
  if (MARTIAL_FINISHER_SKILL_IDS_113C.has(skillId) && (skillId !== 0 || cast.missile === undefined)) {
    return this.executeMartialFinisher113c(player, cast, monster)
  }
  return false
}



/**
 * #1808 Smite (`SrvDo150`): shield `mindam..maxdam` + Holy Shield + `stat 111` scaled by
 * Str / skill / off-weapon / aura `%ED` (`rollPlayerSkillPhysDamage`), auto-hit and unblockable
 * (`classifyPlayerHitRoll113c`), then stun `min(250, 15 + 5*(slvl-1))` + knockback on non-bosses.
 */
function executeSmite113c(this: GameInstanceHost, player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord): void {
  const damage = this.removeAuraEdFromPreScaled113c(player, this.rollPlayerSkillPhysDamage(player, cast))
  const landed = this.applyDamageToMonster(player, monster, damage, 97, 'phys', 'player', {
    skipHitRiders: true,
  })
  if (!landed) return
  this.applyPlayerMeleeRiders113c(player, monster)
  if (monster.dead || monster.isBoss || monster.isPrimeEvil) return
  this.applyUnitState(
    monster.states,
    monster.stateTimers,
    'monster',
    monster.unitId,
    monster.areaId,
    21,
    computeSmiteStunFrames113c(cast.slvl),
  )
  this.knockbackMonster(monster, player.x, player.y)
}



/**
 * #1812 Double Swing (`SrvDo070`) / #1813 Frenzy (`SrvDo009`): one independent strike per hand
 * (main hand, then off hand). Frenzy converts `min(100, Berserk blvl)%` to magic and raises the
 * `frenzy` (state 94) counter on every landed strike (`stepFrenzyStack113c`).
 */
function executeDualStrikeSingleHand113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  primaryMonster: InternalMonsterRecord,
  hand: 'right' | 'left',
): void {
  const monster =
    !primaryMonster.dead && this.isPlayerMeleeInRangeOfMonster(player, primaryMonster)
      ? primaryMonster
      : this.livingHostilesInMeleeReach113c(player)[0]
  if (!monster) return
  const skillId = cast.skill.id
  const isFrenzy = skillId === 147
  const magicPct = isFrenzy ? Math.min(100, Math.max(0, player.skills.get(152) ?? 0)) : 0
  const total = this.rollWave2HandStrike113c(player, cast, hand)
  const magic = Math.trunc((total * magicPct) / 100)
  const phys = total - magic
  const landed =
    phys > 0
      ? this.applyDamageToMonster(player, monster, phys, skillId, 'phys', 'player', {
          attackKind: 'melee',
          weaponHand: hand,
          skipHitRiders: true,
        })
      : this.applyDamageToMonster(player, monster, magic, skillId, 'mag', 'player', {
          attackKind: 'melee',
          weaponHand: hand,
          skipHitRiders: true,
        })
  if (landed && phys > 0 && magic > 0 && !monster.dead) {
    this.applyDamageToMonster(player, monster, magic, skillId, 'mag', 'player', {
      attackKind: 'melee',
      autoHit: true,
      unblockable: true,
    })
  }
  if (landed) this.applyPlayerMeleeRiders113c(player, monster, hand)
  if (!isFrenzy) return
  const prev = this.playerFrenzyStack113c.get(player.unitId)
  const step = stepFrenzyStack113c(prev, this.currentFrame, cast.slvl, landed)
  const next = { stacks: step.stacks, expireFrame: step.expireFrame }
  this.playerFrenzyStack113c.set(player.unitId, next)
  if (landed && next.stacks > 0) {
    this.applyPlayerTimedState113c(
      player,
      FRENZY_STATE_ID_113C,
      FRENZY_DURATION_FRAMES_113C,
      { skill_frenzy: step.stacks, velocitypercent: step.velocityPct, attackrate: step.attackRatePct },
      skillId,
      cast.slvl,
    )
  }
}



function executeDualStrike113c(this: GameInstanceHost, player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord): void {
  this.executeDualStrikeSingleHand113c(player, cast, monster, 'right')
  this.executeDualStrikeSingleHand113c(player, cast, monster, 'left')
}



/** #1815 charge-up strike: weapon hit (+FoF phys->fire conversion); a landed hit adds one charge. */
function executeMartialChargeUp113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  monster: InternalMonsterRecord,
): void {
  const skillId = cast.skill.id
  let phys = this.rollWave2HandStrike113c(player, cast, 'right')
  let fire = 0
  if (skillId === 259) {
    fire = Math.trunc((phys * computeFistsOfFireConversionPct113c(cast.slvl)) / 100)
    phys -= fire
  }
  const landed =
    phys > 0
      ? this.applyDamageToMonster(player, monster, phys, skillId, 'phys', 'player', {
          skipHitRiders: true,
        })
      : this.applyDamageToMonster(player, monster, fire, skillId, 'fire', 'player', {
          attackKind: 'melee',
          skipHitRiders: true,
        })
  if (landed && phys > 0 && fire > 0 && !monster.dead) {
    this.applyDamageToMonster(player, monster, fire, skillId, 'fire', 'player', {
      attackKind: 'melee',
      autoHit: true,
      unblockable: true,
    })
  }
  if (!landed) return
  this.applyPlayerMeleeRiders113c(player, monster)
  this.addPlayerMartialCharge113c(player, skillId, cast.slvl)
}



/** Add one progressive charge and refresh every held charge state to 375 frames. */
function addPlayerMartialCharge113c(this: GameInstanceHost, player: InternalPlayerRecord, skillId: number, slvl: number): void {
  const next = addMartialCharge113c(this.playerMartialCharges113c.get(player.unitId), skillId, slvl, this.currentFrame)
  this.playerMartialCharges113c.set(player.unitId, next)
  for (const charge of next.charges) {
    const spec = getProgressiveSkillSpec113c(charge.skillId)
    if (spec === undefined) continue
    // The progressive counter stat goes first: the client orb renderer reads `stats[0]`.
    this.applyPlayerTimedState113c(
      player,
      charge.stateId,
      MARTIAL_CHARGE_DURATION_FRAMES_113C,
      {
        [spec.countStatName]: charge.count,
        progressive_tohit: evaluateChargeUpProgressiveToHit(charge.skillId, charge.count),
      },
      charge.skillId,
      charge.slvl,
    )
  }
}



/**
 * #1816 finishers (`0x6FCB1D21`): Attack (#0, only with charges), Dragon Talon (#255,
 * `kickCount` kicks), Dragon Claw (#260, both claws), Dragon Tail (#270, kick + fire explosion of
 * the physical damage dealt), Dragon Flight (#275, teleport kick). The first landed strike
 * releases every charge (Tiger Strike `%ED` rides on that strike).
 */
function executeMartialFinisherSingleStrike113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  primaryMonster: InternalMonsterRecord,
  strikeIndex: number,
  totalStrikes: number,
  session: { payloads: readonly DischargedPayload[]; tigerEdPct: number; released: boolean },
): void {
  const skillId = cast.skill.id
  if (skillId === 275 && strikeIndex === 0) {
    const arrival = this.pointBefore(player, primaryMonster.x, primaryMonster.y, 1)
    this.relocatePlayerForSkill(player, arrival.x, arrival.y, true, true)
  }
  const monster = primaryMonster
  if (monster.dead || !this.isPlayerMeleeInRangeOfMonster(player, monster)) return
  const isKick = KICK_SKILL_IDS_113C.has(skillId)
  const extraEd = session.released ? 0 : session.tigerEdPct
  const strikeHand: 'left' | 'right' = skillId === 260 && strikeIndex === 1 ? 'left' : 'right'
  const damage = isKick
    ? this.rollKickDamage113c(player, cast, extraEd)
    : this.rollWave2HandStrike113c(player, cast, strikeHand, extraEd)
  const hpBefore = monster.hp
  const landed = this.applyDamageToMonster(player, monster, damage, skillId, 'phys', 'player', {
    attackKind: 'melee',
    skipHitRiders: true,
    ...(!isKick ? { weaponHand: strikeHand } : {}),
  })
  if (!landed) return
  const dealtPhys = Math.max(0, hpBefore - monster.hp)
  this.applyPlayerMeleeRiders113c(player, monster, !isKick ? strikeHand : undefined)
  if (skillId === 270) {
    const explosion = computeDragonTailExplosionDamage113c(dealtPhys, cast.slvl)
    if (explosion > 0) {
      for (const m of this.hostilesNear113c(player.areaId, monster.x, monster.y, DRAGON_TAIL_EXPLOSION_RADIUS_SUBTILES)) {
        this.applyDamageToMonster(player, m, explosion, 270, 'fire', 'player', {
          attackKind: 'spell',
          autoHit: true,
          unblockable: true,
        })
      }
    }
    if (!monster.dead && !monster.isBoss && !monster.isPrimeEvil) this.knockbackMonster(monster, player.x, player.y)
  } else if (
    skillId === 255 &&
    strikeIndex === totalStrikes - 1 &&
    !monster.dead &&
    !monster.isBoss &&
    !monster.isPrimeEvil
  ) {
    this.knockbackMonster(monster, player.x, player.y)
  }
  if (!session.released && session.payloads.length > 0) {
    session.released = true
    this.releaseMartialCharges113c(player, monster, session.payloads, dealtPhys)
  }
}



function executeMartialFinisher113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  monster: InternalMonsterRecord,
): boolean {
  const skillId = cast.skill.id
  const charges = liveMartialCharges113c(this.playerMartialCharges113c.get(player.unitId), this.currentFrame)
  if (skillId === 0 && charges.length === 0) return false
  const payloads = resolveFinisherDischarge(
    charges.map((c) => ({ skillId: c.skillId, count: c.count, slvl: c.slvl, expiresAtFrame: this.currentFrame + 1 })),
    {
      royalStrikeBlvl: player.skills.get(280) ?? 0,
      fistsOfFireBlvl: player.skills.get(259) ?? 0,
      clawsOfThunderBlvl: player.skills.get(269) ?? 0,
      bladesOfIceBlvl: player.skills.get(274) ?? 0,
    },
  )
  const session = {
    payloads,
    tigerEdPct: payloads.reduce((sum, p) => sum + (p.enhancedDamagePct ?? 0), 0),
    released: false,
  }
  const strikes = skillId === 255 ? evaluateDragonTalonStats(cast.slvl).kickCount : skillId === 260 ? 2 : 1
  for (let i = 0; i < strikes && !monster.dead; i++) {
    this.executeMartialFinisherSingleStrike113c(player, cast, monster, i, strikes, session)
  }
  return true
}



/** Release every held charge (`srvprgfunc1..3`) and end states 122..127. */
function releaseMartialCharges113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  target: InternalMonsterRecord,
  payloads: readonly DischargedPayload[],
  dealtPhys: number,
): void {
  const spell = { attackKind: 'spell' as const, autoHit: true, unblockable: true }
  const hit = (m: InternalMonsterRecord, min: number, max: number, skillId: number, ch: 'fire' | 'ltng' | 'cold'): void => {
    if (m.dead) return
    const dmg = this.rollInclusive(min, max)
    if (dmg > 0) this.applyDamageToMonster(player, m, dmg, skillId, ch, 'player', spell)
  }
  const around = (radius: number): InternalMonsterRecord[] =>
    this.hostilesNear113c(player.areaId, target.x, target.y, radius)
  for (const p of payloads) {
    if ((p.lifeStealPct ?? 0) > 0 || (p.manaStealPct ?? 0) > 0) {
      const lifeGain = Math.floor(
        (dealtPhys * (p.lifeStealPct ?? 0)) / 100 / Math.max(1, difficultyLifeStealDivisor(this.difficulty)),
      )
      const manaGain = Math.floor(
        (dealtPhys * (p.manaStealPct ?? 0)) / 100 / Math.max(1, difficultyManaStealDivisor(this.difficulty)),
      )
      if (lifeGain > 0 && !player.dead) {
        player.hpFixed = Math.min(this.getPlayerAccruedMaxHpFixed(player), player.hpFixed + lifeGain * FIXED_ONE)
        player.hp = Math.floor(player.hpFixed / FIXED_ONE)
        this.emitToPlayer(player.unitId, {
          type: 'UnitStatUpdate',
          unitType: 'player',
          unitId: player.unitId,
          statId: 6,
          value: player.hpFixed,
        })
      }
      if (manaGain > 0 && !player.dead) {
        player.manaFixed = Math.min(this.getPlayerAccruedMaxManaFixed(player), player.manaFixed + manaGain * FIXED_ONE)
        player.mana = Math.floor(player.manaFixed / FIXED_ONE)
        this.emitToPlayer(player.unitId, {
          type: 'UnitStatUpdate',
          unitType: 'player',
          unitId: player.unitId,
          statId: 8,
          value: player.manaFixed,
        })
      }
    }
    if (p.fireDamage !== undefined) {
      const f = p.fireDamage
      hit(target, f.min, f.max, 259, 'fire')
      if (f.explosionRadiusPx !== undefined) {
        for (const m of around(f.explosionRadiusPx / 16)) if (m !== target) hit(m, f.min, f.max, 259, 'fire')
      }
      if (f.burningGroundTotalMin !== undefined && f.burningGroundTotalMax !== undefined) {
        for (const m of around(3)) hit(m, f.burningGroundTotalMin, f.burningGroundTotalMax, 259, 'fire')
      }
    }
    if (p.ltngDamage !== undefined) {
      const l = p.ltngDamage
      hit(target, l.min, l.max, 269, 'ltng')
      if (l.hasNova === true) {
        for (const m of this.hostilesNear113c(player.areaId, player.x, player.y, 8)) hit(m, l.novaMin, l.novaMax, 269, 'ltng')
      }
      if ((l.chargedBoltsCount ?? 0) > 0) {
        const victims = around(8)
        for (let i = 0; i < (l.chargedBoltsCount ?? 0) && victims.length > 0; i++) {
          hit(victims[i % victims.length]!, l.boltMin, l.boltMax, 269, 'ltng')
        }
      }
    }
    if (p.coldDamage !== undefined) {
      const c = p.coldDamage
      hit(target, c.min, c.max, 274, 'cold')
      if (c.explosionRadiusPx !== undefined) {
        for (const m of around(c.explosionRadiusPx / 16)) if (m !== target) hit(m, c.min, c.max, 274, 'cold')
      }
      if ((c.freezeDurationFrames ?? 0) > 0) {
        for (const m of around(6)) if (!m.dead) this.applyMonsterState(m.unitId, 1, c.freezeDurationFrames ?? 0)
      }
    }
    const ph = p.phoenixPayload
    if (ph?.meteorDamage !== undefined) {
      for (const m of around(4)) {
        hit(m, ph.meteorDamage.min, ph.meteorDamage.max, 280, 'fire')
        hit(m, ph.meteorDamage.groundFireTotalMin, ph.meteorDamage.groundFireTotalMax, 280, 'fire')
      }
    }
    if (ph?.chainLightningDamage !== undefined) {
      const cl = ph.chainLightningDamage
      const struck = new Set<number>()
      let cur: InternalMonsterRecord | undefined = target
      for (let i = 0; i < cl.maxTargets && cur !== undefined; i++) {
        struck.add(cur.unitId)
        hit(cur, cl.min, cl.max, 280, 'ltng')
        const from: InternalMonsterRecord = cur
        cur = this.hostilesNear113c(player.areaId, from.x, from.y, cl.jumpRadiusSubtiles ?? 8)
          .filter((m) => !struck.has(m.unitId))
          .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y) || a.unitId - b.unitId)[0]
      }
    }
    if (ph?.chaosIceDamage !== undefined) {
      const ci = ph.chaosIceDamage
      for (const m of this.hostilesNear113c(player.areaId, player.x, player.y, 8)) {
        hit(m, ci.min, ci.max, 280, 'cold')
        if (!m.dead && ci.freezeFrames > 0) this.applyMonsterState(m.unitId, 1, ci.freezeFrames)
      }
    }
  }
  for (const spec of PROGRESSIVE_SKILLS_113C) {
    if (player.states.has(spec.stateId)) {
      this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, spec.stateId)
    }
  }
  this.playerMartialCharges113c.delete(player.unitId)
}



/**
 * #1806 Telekinesis (`SrvSt12` + `SrvDo021`): dispatch by target unit type — ground item
 * (whitelisted pickup), object (TK-operable objects), monster (lightning + 35% knockback,
 * never in town). Range `<= 25` sub-tiles with line of sight, checked before mana is spent.
 */
function executeTelekinesis113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  targetId: number,
  targetType: SkillTargetUnitType113c | undefined,
): void {
  const item = targetType === undefined || targetType === 4 ? this.groundItems.get(targetId) : undefined
  const obj = item === undefined && (targetType === undefined || targetType === 2) ? this.objects.get(targetId) : undefined
  const monster =
    item === undefined && obj === undefined && (targetType === undefined || targetType === 1)
      ? this.monsters.get(targetId)
      : undefined
  const pvpTarget =
    item === undefined && obj === undefined && monster === undefined
      ? this.resolveHostilePvpTargetById113c(player.unitId, player.areaId, targetId, targetType)
      : undefined
  if (pvpTarget !== undefined) {
    const tx =
      pvpTarget.kind === 'player'
        ? pvpTarget.player.x
        : pvpTarget.kind === 'merc'
          ? pvpTarget.merc.x
          : pvpTarget.pet.x
    const ty =
      pvpTarget.kind === 'player'
        ? pvpTarget.player.y
        : pvpTarget.kind === 'merc'
          ? pvpTarget.merc.y
          : pvpTarget.pet.y
    if (!isWithinTelekinesisRange113c(player.x, player.y, tx, ty)) return
    if (!this.hasInteractionLineOfSight(player.areaId, player.x, player.y, tx, ty)) return
    const cast = this.resolvePlayerSkillCast(player, TELEKINESIS_SKILL_ID_113C)
    if (cast === null) return
    this.updatePlayerChannelState(player, cast)
    this.commitPlayerSkillCast(player, cast)
    this.broadcastPlayerSkillCast(player, cast, {
      unitType: pvpTarget.kind === 'player' ? 0 : 1,
      id: targetId,
    })
    this.applyPvpSkillHitToTarget113c(player, cast, pvpTarget, 'spell')
    return
  }
  const target = item ?? obj ?? monster
  if (target === undefined || target.areaId !== player.areaId) return
  if (monster !== undefined && (monster.dead || monster.isNpc || monster.submerged || TOWN_AREAS.has(player.areaId))) {
    return
  }
  if (!isWithinTelekinesisRange113c(player.x, player.y, target.x, target.y)) return
  if (!this.hasInteractionLineOfSight(player.areaId, player.x, player.y, target.x, target.y, obj?.unitId)) return
  const cast = this.resolvePlayerSkillCast(player, TELEKINESIS_SKILL_ID_113C)
  if (cast === null) return
  const targetKind: 4 | 2 | 1 = item !== undefined ? 4 : obj !== undefined ? 2 : 1
  const refuse = (): void => {
    this.emitToPlayer(player.unitId, { type: 'PlaySound', unit: { unitType: 0, id: player.unitId }, sound: 19 })
  }
  const executeTelekinesisRelease = (): void => {
    if (targetKind === 4) {
      const liveItem = this.groundItems.get(targetId)
      if (liveItem === undefined || liveItem.areaId !== player.areaId) return
      if (isTelekinesisPickupEligible113c(liveItem.code)) this.handleItemPickup(player, targetId, false, true)
      else refuse()
      return
    }
    if (targetKind === 2) {
      const liveObj = this.objects.get(targetId)
      if (liveObj === undefined || liveObj.areaId !== player.areaId) return
      let operateFn = 0
      try {
        operateFn = getObjectsTxtRecord113c(liveObj.classId).operateFn
      } catch {
        operateFn = 0
      }
      const eligible = isTelekinesisObjectEligible113c({
        classId: liveObj.classId,
        operateFn,
        isWaypoint: liveObj.isWaypoint,
        isShrine: liveObj.isShrine,
        destAreaId: liveObj.destAreaId,
      })
      if (!eligible) {
        refuse()
        return
      }
      this.operateObjectByTelekinesis113c(player, liveObj)
      return
    }
    const liveMonster = this.monsters.get(targetId)
    if (
      liveMonster === undefined ||
      liveMonster.dead ||
      liveMonster.isNpc ||
      liveMonster.submerged ||
      liveMonster.areaId !== player.areaId ||
      TOWN_AREAS.has(player.areaId)
    ) {
      return
    }
    this.applyDirectSkillDamage(player, cast, liveMonster)
    if (!liveMonster.dead && this.rng.rand(100) < TELEKINESIS_KNOCKBACK_CHANCE_PCT) {
      this.knockbackMonster(liveMonster, player.x, player.y)
    }
  }
  if (this.animActionWindupEnabled) {
    this.schedulePlayerSkillWindup113c(
      player,
      cast,
      target.x,
      target.y,
      { unitType: targetKind, id: targetId },
      {
        onStrike: () => {
          executeTelekinesisRelease()
        },
      },
    )
    return
  }
  this.updatePlayerChannelState(player, cast)
  this.commitPlayerSkillCast(player, cast)
  this.broadcastPlayerSkillCast(player, cast, { unitType: targetKind, id: targetId })
  executeTelekinesisRelease()
}



/** Remote object operate: same dispatch as `handleInteract` once in range (portals, waypoints, operate). */
function operateObjectByTelekinesis113c(this: GameInstanceHost, player: InternalPlayerRecord, obj: InternalObjectRecord): void {
  if (obj.classId !== 267 && this.hasCursorItem113c(player)) return
  if (
    obj.destAreaId !== undefined &&
    obj.classId !== 194 &&
    obj.classId !== 195 &&
    obj.classId !== 298 &&
    obj.classId !== 342 &&
    obj.classId !== 547 &&
    obj.classId !== 565 &&
    obj.classId !== 566
  ) {
    if (
      (obj.classId === 366 || obj.classId === 386 || obj.classId === 563 || obj.classId === 569) &&
      obj.mode !== 2
    ) {
      return
    }
    if (
      !canEnterPortalInPvp113c({
        currentFrame: this.currentFrame,
        playerUnitId: player.unitId,
        hostilePortalLockUntilFrame: player.hostilePortalLockUntilFrame,
        portalClassId: obj.classId,
        portalOwnerId: obj.portalOwnerId,
        isAlliedWithOwner:
          obj.portalOwnerId !== undefined && obj.portalOwnerId > 0
            ? this.partyManager.areAllied(obj.portalOwnerId, player.unitId)
            : false,
      })
    ) {
      return
    }
    if (!this.consumeWarpCooldown(player)) return
    const arrival = this.resolvePortalArrival113c(obj)
    const wasTownMouth = TOWN_AREAS.has(obj.areaId) && obj.portalOwnerId !== undefined
    const moved = this.transitionPlayerArea(player, obj.destAreaId, arrival)
    if (moved && wasTownMouth) this.closeTownPortal(player)
    return
  }
  if (obj.isWaypoint) {
    this.openWaypointMenu(player, obj)
    return
  }
  this.operateObject(player, obj)
}




function spawnMonsterMissile(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  targetX: number,
  targetY: number,
  damage: number,
  missileClassId = 1,
  skillId = 0,
  options: {
    readonly missile?: MissileRecord | undefined
    readonly skillLevel?: number | undefined
    /** Explicit lifetime override in 25Hz frames (`SKILLS_SetInfernoMissileRange` `0x6FCD32E0`, #2012). */
    readonly rangeFrames?: number | undefined
    readonly physDamage?: number | undefined
    readonly elemDamage?: number | undefined
    readonly element?: MissileDamageChannel | undefined
    readonly elemDurationFrames?: number | undefined
    /** Explicit spawn origin override (`SKILLS_SrvDo024_FireWall` `0x6FC637D0`, #1999). */
    readonly fromX?: number | undefined
    readonly fromY?: number | undefined
    /** Per-frame `1/256` burning range for `SrvDo05` / `SrvDmg03` ground-fire patches or makers (#1999). */
    readonly groundFire256?: { readonly min: number; readonly max: number } | undefined
    /** Death-effect nova: never miss, never block, never stop on terrain. */
    readonly guaranteed?: boolean | undefined
    /** Monster-vs-monster projectile (Confuse/Conversion/Attract). */
    readonly hitMonsters?: boolean | undefined
    /** Internal guard preventing recursive fan duplication on `MonUMod #29` (`Multishot`, #1900). */
    readonly skipMultishot?: boolean | undefined
  } = {},
): number {
  // The data registry carries the full Missiles.txt row (Vel/Range/LevRange/Size/
  // CollideType/Pierce/NextDelay/EType); `getMissileTxtData` only has the art subset.
  const meta = options.missile ?? this.registry.getMissileById(missileClassId)
  const resolvedClassId = meta?.id ?? missileClassId
  const skillLevel = Math.max(1, options.skillLevel ?? monster.level)
  const rawVel = meta === undefined ? 0 : meta.vel + Math.trunc((meta.velLev * skillLevel) / 8)
  const baseSpeed = meta === undefined ? 1.8 : rawVel > 0 ? missileSpeedSubtilesPerFrame113c(rawVel) : 0
  const speed =
    baseSpeed > 0 && monster.states.has(STATE_SLOWMISSILES_113C) ? baseSpeed * 0.33 : baseSpeed
  const rawRangeTicks =
    meta === undefined ? 45 : Math.max(2, meta.range + meta.levRange * skillLevel)
  // 1.13c `D2Game.dll` `0x6FC460D0` -> `0x6FC61F50` (`0x6FC61F64..0x6FC61F77`, #1997):
  // Caps `#225 buglightning` (`Range = 98`) lifetime to `0x4D` (`77` frames) when `>= 78`.
  const rangeTicks =
    options.rangeFrames !== undefined && options.rangeFrames > 0
      ? Math.max(1, Math.min(255, Math.trunc(options.rangeFrames)))
      : resolvedClassId === 225 && rawRangeTicks >= 78
        ? 77
        : rawRangeTicks
  const element =
    options.element ??
    normalizeMissileElement(meta?.eType) ??
    missileClassElementFallback(resolvedClassId) ??
    'phys'
  const stationary = meta !== undefined && meta.vel <= 0
  const startX = options.fromX ?? (stationary ? targetX : monster.x)
  const startY = options.fromY ?? (stationary ? targetY : monster.y)
  const dx = targetX - startX
  const dy = targetY - startY
  const dist = Math.max(0.5, Math.hypot(dx, dy))
  const physDamage =
    Math.max(0, Math.floor(options.physDamage ?? (element === 'phys' ? damage : 0)))
  const elemDamage =
    Math.max(0, Math.floor(options.elemDamage ?? (element === 'phys' ? 0 : damage)))
  const engine = meta !== undefined ? this.onlineMissileEngine() : undefined
  const doKind = meta !== undefined && engine !== undefined ? engine.classifyOnlineSrvDo113c(meta) : 'standard'
  const hitKind = meta !== undefined && engine !== undefined ? engine.classifyOnlineSrvHit113c(meta) : 'none'
  const isGroundFire = meta !== undefined && (doKind === 'groundfire' || meta.pSrvDmgFunc === 3)
  const isFunctionalCarrier =
    meta !== undefined &&
    (doKind === 'pathspawner' ||
      doKind === 'areaspawner' ||
      doKind === 'orb' ||
      (hitKind !== 'none' && hitKind !== 'engine-only' && hitKind !== 'homing'))
  const rawTotal = physDamage + elemDamage
  const totalDamage =
    isGroundFire || (rawTotal <= 0 && isFunctionalCarrier) ? 0 : Math.max(1, rawTotal)
  const missileUnitId = this.allocateUnitId(UNIT_TYPE_113C.missile)
  const missile: InternalMissileRecord = {
    unitId: missileUnitId,
    missileId: resolvedClassId,
    skillId,
    ownerType: 'monster',
    ownerId: monster.unitId,
    areaId: monster.areaId,
    x: startX,
    y: startY,
    vx: speed > 0 ? (dx / dist) * speed : 0,
    vy: speed > 0 ? (dy / dist) * speed : 0,
    damage: totalDamage,
    remainingFrames: rangeTicks,
    collideType: meta?.collideType ?? 3,
    size: Math.max(1, meta?.size ?? 1),
    pierce: isGroundFire || (meta !== undefined ? !meta.collideKill : false),
    nextHit: meta?.nextHit === true,
    nextDelay: Math.max(0, meta?.nextDelay ?? 0),
    element: isGroundFire ? 'fire' : element,
    physDamage: isGroundFire ? 0 : physDamage,
    elemDamage: isGroundFire ? 0 : elemDamage,
    elemDurationFrames: Math.max(0, options.elemDurationFrames ?? 0),
    hitCooldowns: new Map(),
    guaranteedHit: options.guaranteed ?? (meta !== undefined ? !meta.toHit : false),
    ...(options.hitMonsters === true ? { hitMonsters: true } : {}),
  }
  if (options.groundFire256 !== undefined) {
    missile.groundFire256 = options.groundFire256
  }
  if (isGroundFire && meta !== undefined) {
    missile.carrier = 'groundfire'
    missile.groundFire256 ??= this.resolveOnlineGroundFire256113c(meta, skillLevel, undefined)
    missile.groundFireCarry = new Map()
  } else if (rawTotal <= 0 && isFunctionalCarrier) {
    missile.carrier = 'none'
  }
  if (meta !== undefined) {
    this.attachOnlineMissileState113c(missile, meta, skillId, skillLevel, speed > 0 ? Math.ceil(dist / speed) : 0)
  }
  missile.createdFrame = this.currentFrame
  this.missiles.set(missileUnitId, missile)

  this.broadcastToArea(monster.areaId, {
    type: 'CreateMissile',
    missileId: missileUnitId,
    missileClassId: resolvedClassId,
    at: { x: Math.round(startX), y: Math.round(startY) },
    target: { x: Math.round(targetX), y: Math.round(targetY) },
    x: Math.round(startX),
    y: Math.round(startY),
    targetX: Math.round(targetX),
    targetY: Math.round(targetY),
    skillId,
    level: skillLevel,
    ownerType: 1,
    ownerUnitType: 'monster',
    ownerId: monster.unitId,
    sourceUnitId: monster.unitId,
    areaId: monster.areaId,
  } as ServerEvent)

  // 1.13c `MonUMod #29` (`Multishot`, `ev5 = 0x6FC45AD0`, boss-only `bBoss != 0`, #1900 / #1993 / #2017):
  // Spawns `+2` angled fan projectiles (`1 + 2 = 3` total) on boss units (`rank !== 'minion'`),
  // skipping any `Missiles.txt` row with `NoMultiShot == 1` (`0x6FC45B67..0x6FC45B72`).
  if (
    options.skipMultishot !== true &&
    meta?.noMultiShot !== true &&
    missile.carrier !== 'none' &&
    missile.carrier !== 'groundfire' &&
    monster.rank !== 'minion' &&
    monster.umodIds.includes(MON_UMOD.MULTISHOT) &&
    isMissileEligibleForMultishot113c(resolvedClassId, {
      guaranteed: options.guaranteed,
      hitMonsters: options.hitMonsters,
      stationary,
    })
  ) {
    const fanTargets = computeMultishotFanTargets113c(startX, startY, targetX, targetY)
    for (const [fanX, fanY] of fanTargets) {
      this.spawnMonsterMissile(monster, fanX, fanY, damage, missileClassId, skillId, {
        ...options,
        skipMultishot: true,
      })
    }
  }
  return missileUnitId
}



function resolveSkillDamageChannel(this: GameInstanceHost, 
  skillId: number,
): 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois' {
  if (skillId <= 0) return 'phys'
  switch (skillId) {
    // Magic damage skills
    case 6: // Magic Arrow
    case 67: // Teeth
    case 84: // Bone Spear
    case 93: // Bone Spirit
    case 101: // Holy Bolt
    case 112: // Blessed Hammer
    case 152: // Berserk
      return 'mag'
    // Fire damage skills
    case 7: // Fire Arrow
    case 16: // Exploding Arrow
    case 27: // Immolation Arrow
    case 36: // Fire Bolt
    case 41: // Inferno
    case 46: // Blaze
    case 47: // Fire Ball
    case 51: // Fire Wall
    case 52: // Enchant
    case 56: // Meteor
    case 62: // Hydra
    case 225: // Firestorm
    case 229: // Molten Boulder
    case 234: // Fissure
    case 239: // Fire Claws
    case 244: // Volcano
    case 249: // Armageddon
    case 251: // Fire Blast
    case 259: // Fists of Fire (#1815: Skills.txt EType = fire)
    case 262: // Wake of Fire
    case 272: // Wake of Inferno
      return 'fire'
    // Lightning damage skills
    case 14: // Power Strike
    case 20: // Lightning Bolt
    case 24: // Charged Strike
    case 34: // Lightning Strike
    case 35: // Lightning Fury
    case 38: // Charged Bolt
    case 42: // Static Field
    case 48: // Nova
    case 49: // Lightning
    case 53: // Chain Lightning
    case 57: // Thunder Storm
    case 118: // Holy Shock
    case 121: // Fist of the Heavens
    case 256: // Shock Web
    case 261: // Charged Bolt Sentry
    case 269: // Claws of Thunder
    case 271: // Lightning Sentry
      return 'ltng'
    // Cold damage skills
    case 11: // Cold Arrow
    case 21: // Ice Arrow
    case 31: // Freezing Arrow
    case 39: // Ice Bolt
    case 44: // Frost Nova
    case 45: // Ice Blast
    case 55: // Glacial Spike
    case 59: // Blizzard
    case 64: // Frozen Orb
    case 114: // Holy Freeze
    case 230: // Arctic Blast
    case 250: // Hurricane
    case 274: // Blades of Ice
    case 280: // Phoenix Strike (charge 3 chaos ice)
      return 'cold'
    // Poison damage skills
    case 15: // Poison Javelin
    case 25: // Plague Javelin
    case 73: // Poison Dagger
    case 83: // Poison Explosion
    case 92: // Poison Nova
    case 222: // Poison Creeper
    case 238: // Rabies
    case 278: // Venom
      return 'pois'
    default: {
      const sk = this.registry?.getSkillById(skillId)
      const et = sk?.eType?.toLowerCase() ?? ''
      if (et === 'fire') return 'fire'
      if (et === 'ltng') return 'ltng'
      if (et === 'cold' || et === 'frze' || et === 'free') return 'cold'
      if (et === 'mag') return 'mag'
      if (et === 'pois') return 'pois'
      return 'phys'
    }
  }
}



/**
 * 1.13c player base Attack Rating (`D2Common.dll` `0x6FD81EA0`, `STAT_TOHIT` = 19):
 * `(Dex - 7) * 5 + CharStats.ToHitFactor` (`dex * 5 - 35 + ToHitFactor`) plus active
 * flat `STAT_TOHIT` (19) and `STAT_ITEM_TOHIT_PERLEVEL` (224, `(val * clvl) >> 1` = `/ 2`)
 * across equipped items (excluding swap 11/12), sockets, charms, and set bonuses (#1629, #1630).
 */
function computePlayerBaseToHit113c(this: GameInstanceHost, player: InternalPlayerRecord): number {
  const baseStats = CANONICAL_CHARSTATS[player.classCode] ?? CANONICAL_CHARSTATS.ama
  const totalDex = player.dexterity + this.sumPlayerItemStat(player, 2)
  let ar =
    player.ar !== undefined
      ? player.ar
      : player.tohit !== undefined
        ? player.tohit
        : totalDex * 5 - 35 + baseStats.toHitFactor
  ar += this.sumPlayerItemStat(player, 19)
  return Math.max(0, ar)
}



/**
 * 1.13c player `%AR` bonus (`STAT_ITEM_TOHIT_PERCENT` = 119) and
 * `STAT_ITEM_TOHITPERCENT_PERLEVEL` (225, `(val * clvl) >> 1` = `/ 2`) across equipped items,
 * sockets, charms, and set bonuses (#1629, #1630).
 */
function computePlayerToHitPctBonus113c(this: GameInstanceHost, player: InternalPlayerRecord): number {
  return this.sumPlayerItemStat(player, 119)
}



/**
 * 1.13c skill `%AR` bonus (`D2Common_11284_EvalSkillToHit`, `0x6FDAAC60`):
 * if `Skills.txt` `ToHitCalc` is non-empty, evaluate `ToHitCalc`; else if `ToHit != 0` or
 * `LevToHit != 0`, return `ToHit + (slvl - 1) * LevToHit`.
 */
function computePlayerSkillToHitBonusPct113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  skillId: number,
): number {
  if (skillId <= 0) return 0
  const skill = this.registry?.getSkillById(skillId)
  if (skill === undefined) return 0
  const slvl = Math.max(1, this.resolvePlayerSkillLevel(player, skill))
  if (skill.toHitCalc !== '') {
    const calcVal = evaluateCalc(skill.toHitCalc, {
      registry: this.registry,
      activeSkill: skill,
      slvl,
      blvl: Math.max(1, player.skills.get(skillId) ?? 1),
      ulvl: player.level,
      getBaseSkillLevel: (id: number) => player.skills.get(id) ?? 0,
      getEffectiveSkillLevel: (id: number) => {
        const s = this.registry?.getSkillById(id)
        return s ? Math.max(1, this.resolvePlayerSkillLevel(player, s)) : 0
      },
      getUnitStat: (statNameOrId: string | number) => {
        if (statNameOrId === 'level' || statNameOrId === 12) return player.level
        if (statNameOrId === 'strength' || statNameOrId === 0) return player.strength
        if (statNameOrId === 'dexterity' || statNameOrId === 2) return player.dexterity
        if (statNameOrId === 'vitality' || statNameOrId === 3) return player.vitality
        if (statNameOrId === 'energy' || statNameOrId === 1) return player.energy
        return 0
      },
    })
    return Math.floor(calcVal)
  }
  if (skill.toHit !== 0 || skill.toHitLev !== 0) {
    return skill.toHit + (slvl - 1) * skill.toHitLev
  }
  return 0
}



/**
 * 1.13c data-driven `attackKind` / `autoHit` / `unblockable` classification from
 * `Skills.txt` (`srvdofunc`, `range`, `srcdam`, `ToHit`, `LevToHit`, `ToHitCalc`) and
 * `Missiles.txt` (`toHit`).
 */
function classifyPlayerHitRoll113c(this: GameInstanceHost, skillId: number): {
  readonly attackKind: 'melee' | 'missile' | 'spell'
  readonly autoHit: boolean
  readonly unblockable: boolean
} {
  if (skillId <= 0 || skillId === 4 || skillId === 5) {
    return { attackKind: 'melee', autoHit: false, unblockable: false }
  }
  if (skillId === 1 || skillId === 2) {
    return { attackKind: 'missile', autoHit: false, unblockable: false }
  }
  const skill = this.registry?.getSkillById(skillId)
  // Smite (skillId 97, srvdofunc 150) bypasses AR (`autoHit: true`) and cannot be blocked by
  // regular shield/monster block (`unblockable: true`) per `D2Game.dll` `0x6FD13220`.
  if (skillId === 97 || skill?.srvDoFunc === 150) {
    return { attackKind: 'melee', autoHit: true, unblockable: true }
  }
  if (skill === undefined) {
    return { attackKind: 'spell', autoHit: true, unblockable: true }
  }
  const mName = skill.srvMissile || skill.srvMissileA || skill.srvMissileB || skill.srvMissileC
  const mRec = mName ? this.registry?.getMissileByName(mName) : undefined
  const hasSkillToHit =
    skill.toHit !== 0 || skill.toHitLev !== 0 || skill.toHitCalc !== ''
  const range = skill.range.toLowerCase()
  if (mRec !== undefined && skill.srcDam === 0 && !hasSkillToHit) {
    return {
      attackKind: mRec.toHit ? 'missile' : 'spell',
      autoHit: !mRec.toHit,
      unblockable: !mRec.toHit,
    }
  }
  if (range === 'h2h' || range === 'both') {
    return { attackKind: 'melee', autoHit: false, unblockable: false }
  }
  if (mRec !== undefined) {
    return {
      attackKind: mRec.toHit || skill.srcDam > 0 ? 'missile' : 'spell',
      autoHit: !mRec.toHit,
      unblockable: !mRec.toHit && skill.srcDam === 0,
    }
  }
  if (skill.srcDam > 0 || hasSkillToHit) {
    return {
      attackKind: range === 'rng' && skillId !== 275 ? 'missile' : 'melee',
      autoHit: false,
      unblockable: false,
    }
  }
  return { attackKind: 'spell', autoHit: true, unblockable: true }
}

export interface PlayerSkillsTargetAndMeleeMethods {
  isPlayerSkillDelayActive113c(player: InternalPlayerRecord): boolean
  applyPlayerGlobalSkillDelay113c(player: InternalPlayerRecord, skillId: number, slvl: number, cooldownFrames: number): void
  syncPlayerAnimDispatcher113c(player: InternalPlayerRecord): AnimDispatcher
  isPlayerActionAnimLocked113c(player: InternalPlayerRecord, nextSkill?: SkillRecord): boolean
  rubberbandPlayer113c(player: InternalPlayerRecord): void
  consumeOrBlockMoveDuringPlayerAnim113c(player: InternalPlayerRecord): boolean
  isPlayerSkillUninterruptible113c(player: InternalPlayerRecord): boolean
  interruptPendingPlayerAnimAction113c(player: InternalPlayerRecord, mode: 'GH' | 'BL'): void
  stepPlayerAnimations113c(): void
  schedulePlayerSkillWindup113c(player: InternalPlayerRecord, cast: PlayerSkillCast, targetX: number, targetY: number, broadcastTarget: | { readonly x: number; readonly y: number }
    | { readonly unitType: UnitType; readonly id: number }, opts: {
    readonly strikeCountOverride?: number | undefined
    readonly onStrike: (strikeIndex: number, totalStrikes: number) => void
    readonly onCleanup?: (() => void) | undefined
  }): boolean
  livingHostilesInMeleeReach113c(player: InternalPlayerRecord, primary?: InternalMonsterRecord): InternalMonsterRecord[]
  collectStrafeTargets113c(player: InternalPlayerRecord, cast: PlayerSkillCast, primaryTarget?: InternalMonsterRecord): InternalMonsterRecord[]
  executeSingleStrafeShot113c(player: InternalPlayerRecord, cast: PlayerSkillCast, missileRec: MissileRecord, tx: number, ty: number, strikeIndex: number, primaryTarget?: InternalMonsterRecord): void
  consumeSingleHandThrowQuantity113c(player: InternalPlayerRecord, hand: 'right' | 'left'): void
  executeSkillAtLocation(player: InternalPlayerRecord, skillId: number, tx: number, ty: number, targetCorpse?: InternalMonsterRecord, options?: { readonly hold?: boolean }): void
  executeSkillOnTarget(player: InternalPlayerRecord, skillId: number, targetId: number, targetType?: SkillTargetUnitType113c, options?: { readonly shift?: boolean; readonly hold?: boolean }): void
  executeWave4TargetSkillDo113c(player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord, options?: { readonly shift?: boolean; readonly hold?: boolean }): boolean
  executeSkillOnPvpTarget113c(player: InternalPlayerRecord, skillId: number, pvpTarget: | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
    | {
        readonly kind: 'pet'
        readonly ownerId: number
        readonly pet: SummonedPetUnit
        readonly petUnitId: number
        readonly areaId: number
      }): void
  executePvpSkillImmediateRelease113c(player: InternalPlayerRecord, cast: PlayerSkillCast, pvpTarget: | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
    | {
        readonly kind: 'pet'
        readonly ownerId: number
        readonly pet: SummonedPetUnit
        readonly petUnitId: number
        readonly areaId: number
      }, tx: number, ty: number, lockedTargetKey: string, meleeReach: number, isMovementStrike: boolean, isMeleeStrike: boolean): void
  executeStandardSkillMeleeHit113c(player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord): void
  executeJabSingleStrike113c(player: InternalPlayerRecord, cast: PlayerSkillCast, primaryMonster: InternalMonsterRecord): void
  executeZealOrFurySingleStrike113c(player: InternalPlayerRecord, cast: PlayerSkillCast, primaryMonster: InternalMonsterRecord, strikeIndex: number): void
  executeImpaleStrike113c(player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord): void
  executeConcentrateStrike113c(player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord): void
  activeHandItems113c(player: InternalPlayerRecord): {
  readonly right: ServerItemEntry | undefined
  readonly left: ServerItemEntry | undefined
}
  itemQuantity113c(item: ServerItemEntry | undefined): number
  passesWave2HandRequirement113c(player: InternalPlayerRecord, skillId: number): boolean
  consumeDoubleThrowQuantity113c(player: InternalPlayerRecord): void
  applyPlayerTimedState113c(player: InternalPlayerRecord, stateId: number, durationFrames: number, stats: Readonly<Record<string, number>>, skillId: number, slvl: number): void
  removeAuraEdFromPreScaled113c(player: InternalPlayerRecord, damage: number): number
  rollWave2HandStrike113c(player: InternalPlayerRecord, cast: PlayerSkillCast, hand: 'right' | 'left', extraEdPct?: number | undefined): number
  resolveEquippedBootKickDamage113c(player: InternalPlayerRecord): { min: number; max: number }
  rollKickDamage113c(player: InternalPlayerRecord, cast: PlayerSkillCast, extraEdPct: number): number
  applyPlayerMeleeRiders113c(player: InternalPlayerRecord, monster: InternalMonsterRecord, weaponHand?: 'left' | 'right'): void
  hostilesNear113c(areaId: number, cx: number, cy: number, radius: number): InternalMonsterRecord[]
  executeWave2MeleeOnTarget113c(player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord): boolean
  executeSmite113c(player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord): void
  executeDualStrikeSingleHand113c(player: InternalPlayerRecord, cast: PlayerSkillCast, primaryMonster: InternalMonsterRecord, hand: 'right' | 'left'): void
  executeDualStrike113c(player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord): void
  executeMartialChargeUp113c(player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord): void
  addPlayerMartialCharge113c(player: InternalPlayerRecord, skillId: number, slvl: number): void
  executeMartialFinisherSingleStrike113c(player: InternalPlayerRecord, cast: PlayerSkillCast, primaryMonster: InternalMonsterRecord, strikeIndex: number, totalStrikes: number, session: { payloads: readonly DischargedPayload[]; tigerEdPct: number; released: boolean }): void
  executeMartialFinisher113c(player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord): boolean
  releaseMartialCharges113c(player: InternalPlayerRecord, target: InternalMonsterRecord, payloads: readonly DischargedPayload[], dealtPhys: number): void
  executeTelekinesis113c(player: InternalPlayerRecord, targetId: number, targetType: SkillTargetUnitType113c | undefined): void
  operateObjectByTelekinesis113c(player: InternalPlayerRecord, obj: InternalObjectRecord): void
  spawnMonsterMissile(monster: InternalMonsterRecord, targetX: number, targetY: number, damage: number, missileClassId?: number | undefined, skillId?: number | undefined, options?: {
    readonly missile?: MissileRecord | undefined
    readonly skillLevel?: number | undefined
    /** Explicit lifetime override in 25Hz frames (`SKILLS_SetInfernoMissileRange` `0x6FCD32E0`, #2012). */
    readonly rangeFrames?: number | undefined
    readonly physDamage?: number | undefined
    readonly elemDamage?: number | undefined
    readonly element?: MissileDamageChannel | undefined
    readonly elemDurationFrames?: number | undefined
    readonly fromX?: number | undefined
    readonly fromY?: number | undefined
    readonly groundFire256?: { readonly min: number; readonly max: number } | undefined
    /** Death-effect nova: never miss, never block, never stop on terrain. */
    readonly guaranteed?: boolean | undefined
    /** Monster-vs-monster projectile (Confuse/Conversion/Attract). */
    readonly hitMonsters?: boolean | undefined
    /** Internal guard preventing recursive fan duplication on `MonUMod #29` (`Multishot`, #1900). */
    readonly skipMultishot?: boolean | undefined
  }): number
  resolveSkillDamageChannel(skillId: number): 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois'
  computePlayerBaseToHit113c(player: InternalPlayerRecord): number
  computePlayerToHitPctBonus113c(player: InternalPlayerRecord): number
  computePlayerSkillToHitBonusPct113c(player: InternalPlayerRecord, skillId: number): number
  classifyPlayerHitRoll113c(skillId: number): {
  readonly attackKind: 'melee' | 'missile' | 'spell'
  readonly autoHit: boolean
  readonly unblockable: boolean
}
}

export const playerSkillsTargetAndMeleeMethods: Record<keyof PlayerSkillsTargetAndMeleeMethods, unknown> = {
  isPlayerSkillDelayActive113c,
  applyPlayerGlobalSkillDelay113c,
  syncPlayerAnimDispatcher113c,
  isPlayerActionAnimLocked113c,
  rubberbandPlayer113c,
  consumeOrBlockMoveDuringPlayerAnim113c,
  isPlayerSkillUninterruptible113c,
  interruptPendingPlayerAnimAction113c,
  stepPlayerAnimations113c,
  schedulePlayerSkillWindup113c,
  livingHostilesInMeleeReach113c,
  collectStrafeTargets113c,
  executeSingleStrafeShot113c,
  consumeSingleHandThrowQuantity113c,
  executeSkillAtLocation,
  executeSkillOnTarget,
  executeWave4TargetSkillDo113c,
  executeSkillOnPvpTarget113c,
  executePvpSkillImmediateRelease113c,
  executeStandardSkillMeleeHit113c,
  executeJabSingleStrike113c,
  executeZealOrFurySingleStrike113c,
  executeImpaleStrike113c,
  executeConcentrateStrike113c,
  activeHandItems113c,
  itemQuantity113c,
  passesWave2HandRequirement113c,
  consumeDoubleThrowQuantity113c,
  applyPlayerTimedState113c,
  removeAuraEdFromPreScaled113c,
  rollWave2HandStrike113c,
  resolveEquippedBootKickDamage113c,
  rollKickDamage113c,
  applyPlayerMeleeRiders113c,
  hostilesNear113c,
  executeWave2MeleeOnTarget113c,
  executeSmite113c,
  executeDualStrikeSingleHand113c,
  executeDualStrike113c,
  executeMartialChargeUp113c,
  addPlayerMartialCharge113c,
  executeMartialFinisherSingleStrike113c,
  executeMartialFinisher113c,
  releaseMartialCharges113c,
  executeTelekinesis113c,
  operateObjectByTelekinesis113c,
  spawnMonsterMissile,
  resolveSkillDamageChannel,
  computePlayerBaseToHit113c,
  computePlayerToHitPctBonus113c,
  computePlayerSkillToHitBonusPct113c,
  classifyPlayerHitRoll113c,
}
