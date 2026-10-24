/**
 * Client-side Skill Missiles, Overlays, Cast Spawners, and Audio Dispatchers (`src/client/world/world-skill-missiles.ts`).
 */

import {
  convertMonsterSoundMode113c,
  isUnshippedMonsterSoundId113c,
  resolveUnitMonSoundRow113c,
  type MonSoundRow113c,
} from '../../common/audio/mon-sounds-113c.ts'
import {
  getMissileSoundEntry113c,
  getSkillSoundEntry113c,
  normalizePlayerClassCode113c,
} from '../../common/audio/skill-sounds-113c.ts'
import { ISO_GROUND_ASPECT_RATIO } from '../../common/data/blizzard-table.js'
import { SKILLS_BY_ID } from '../../common/data/skills-catalog.ts'
import {
  D2COMMON_10160_PathUpdateDirection,
  D2COMMON_10212_PATH_SetMoveFlags,
  D2Common_10153,
  PATH_ComputePathChargedBolt_6FDB6AA0,
   getMonsterModeBaseAnimSpeed256,
  getMonsterModeBaseFrameCount113c,
  resolveMonsterSkillAnimMode113c,
} from '../../common/path/index.ts'
import { doesNpcModeMove113c } from '../motion/npc-motion.ts'
import {
  SEED_InitLowSeed,
  SEED_RollLimitedRandomNumber,
  SEED_RollRandomNumber,
  type D2SeedStrc,
} from '../../common/rng/d2-rng.ts'
import {
  CANONICAL_113C_MISSILES,
  getMissileTxtData,
  getOverlayTxtData,
  getSkillCastOverlay,
  getSkillOverlayRow113c,
  resolveRuntimeOverlayTxtData,
} from '../../common/skills/missiles-data.ts'
import {
  CLTDO25_RING_X_113C,
  CLTDO25_RING_Y_113C,
  cltDo25RingEntries113c,
  cltDo25Velocity113c,
  getCltDo25Skill113c,
  missileTxtVelocity113c,
} from '../../common/skills/cltdo25-ring-113c.ts'
import { getSkillAnimModes, resolveSkillSequenceFrame } from '../../common/skills/skill-anim-modes.ts'
import {
  getAttackWeaponInfo,
  isInMeleeRange113c,
  resolveThrowMissileForItemCode,
} from '../../common/skills/weapon-combat-meta.ts'
import {
  computeActionFrameTicks,
  computeOneShotDurationMs,
  computeSequenceDurationMs,
  getCharAnimClip113c,
  resolveEquippedWeaponClass,
} from '../../common/units/char-anim-speed.ts'
import { dir64FromPoints } from '../../common/units/direction.ts'
import { isTownNpcHcIdx } from '../../common/units/npc-table.ts'
import {
  MONSTATS2_FLAGINDEX,
  canMonsterClassBeCursed113c,
  hasMonStats2Flag,
} from '../../common/units/monstats2-flags.ts'
import { getMonsterSizeXByHcIdx } from '../../common/units/monster-mapping.ts'
import {
  PLAYER_SOUND_TABLE_0x6FBA7694,
  resolveHitClassSoundIds113c,
  type WorldSoundRequest,
} from '../audio/d2gs-play-sound-113c.ts'
import { OVERLAY_TXT_ROWS } from '../render/overlay-txt-rows.ts'
import { STATE_OVERLAYS } from '../render/overlays-meta.ts'
import { reportMissingArt } from '../../client/scene/missing-art.ts'
import { syncBoneArmorOverlays113c } from './bone-armor-overlays-113c.ts'
import { catapultBallTraj3d } from './boss-death-cltdo-113c.ts'
import { ClientUnit, type ClientUnitOverlay, type UnitCastState } from './client-unit.ts'
import { isAlliedCombatMonster113c } from './world-missile-stepper.ts'
import { TRAJ_FIXED_SHIFT } from './quest-fx-horadric-113c.ts'
import {
  CURSECENTER_RANGE_113C,
  MINDBLAST_CENTER_RANGE_113C,
  MINDBLAST_VISUAL_RADIUS_113C,
  curseVisualRadius113c,
  tickCurseCenter113c,
} from './curse-center-113c.ts'
import { playStateCastOverlay113c } from './state-cast-overlay-113c.ts'
import { stateOnSoundRequest113c } from './state-on-sound-113c.ts'
import {
  BLAZE_STATE_ID_113C,
  ENCHANT_STATE_ID_113C,
  STUNNED_STATE_ID_113C,
  addPredictedTimedState113c,
  arcticBlastRangeFrames113c,
  blazeStateDurationFrames113c,
  infernoFlameRangeFrames113c,
  warCryStunFrames113c,
} from './state-ids-113c.ts'
import { calculatePierceStats } from '../../common/skills/amazon-passive.ts'
import {
  CLT_RING16_DX_113C,
  CLT_RING16_DY_113C,
  POISONEXPLOSIONCLOUD_113C,
  computeCltDo17FanAimPoints113c,
  poisonExplosionCloudOffsets113c,
  ringMissileSpeedSubTilesPerTick113c,
} from './nec-poison-bone-113c.ts'
import {
  ALL_CURSE_TARGET_OVERLAY_SET,
  ALL_PALADIN_AURA_STATES,
  ALL_TYPE1_CURSE_STATES,
  CROSSBOW_ITEM_CODES,
  CURSE_CLT_MISSILE_A,
  CURSE_SKILL_STATES,
  CURSE_TARGET_OVERLAYS,
  LINEAR_SKILL_MISSILES,
  OVERLAY_INDICES_NOT_REPLACED,
  PALADIN_AURA_SKILL_STATES,
  SELF_BUFF_SKILL_STATES,
  SKILL_CLT_MISSILE_AB_113C,
  SKILL_TGT_OVERLAYS_113C,
  getCurseRadiusSubtiles113c,
  getMonsterModeMissile113c,
  getSkillTgtOverlay113c,
  type ClientWorldInternal,
  type SpawnMissileOptions,
} from './world-skill-state-tables.ts'

/** 1.13c Skills.txt rows with cltstfunc=19 (SKILLS_CltSt19 0x6FB78F50 -> 0x6FB78980): cltmissilec spawned at caster on cast start. */
const CLT_ST19_MISSILE_C_113C: Readonly<Record<number, string>> = Object.freeze({
  67: 'bonecast', // Teeth
  84: 'bonecast', // Bone Spear
})

/** 1.13c Skills.txt rows with cltdofunc=32 (SKILLS_CltDo32 0x6FB78FB0 -> 0x6FB78CE0): Corpse Explosion & NihlathakCorpseExplosion. */
const CLT_DO32_CORPSE_EXPLOSION_113C: Readonly<
  Record<
    number,
    {
      readonly cltMissileA: string
      readonly cltMissileB: string
      readonly cltMissileC: string
    }
  >
> = Object.freeze({
  74: {
    cltMissileA: 'corpseexplosion',
    cltMissileB: 'explodingarrowexp',
    cltMissileC: 'redlightmissile',
  },
  351: {
    cltMissileA: 'corpseexplosion',
    cltMissileB: 'explodingarrowexp',
    cltMissileC: 'redlightmissile',
  },
})

export function pushSoundRequestImpl(this: ClientWorldInternal, req: WorldSoundRequest): void {
  if (req.soundId !== undefined && isUnshippedMonsterSoundId113c(req.soundId)) {
    return
  }
  const clean: Record<string, unknown> = {}
  if (req.kind !== undefined) clean.kind = req.kind
  if (req.soundId !== undefined) clean.soundId = req.soundId
  if (req.speechSoundId !== undefined) clean.speechSoundId = req.speechSoundId
  if (req.stingerSoundId !== undefined) {
    clean.stingerSoundId = req.stingerSoundId
  } else if (req.soundId !== undefined && req.soundId >= 4685 && req.soundId <= 4698) {
    clean.stingerSoundId = req.soundId
  }
  if (req.eventCode !== undefined) clean.eventCode = req.eventCode
  if (req.skillId !== undefined) clean.skillId = req.skillId
  if (req.charclass !== undefined) clean.charclass = req.charclass
  if (req.flag !== undefined) clean.flag = req.flag
  if (req.weaponSoundId !== undefined) clean.weaponSoundId = req.weaponSoundId
  if (req.missileId !== undefined) clean.missileId = req.missileId
  if (req.entityId !== undefined) clean.entityId = req.entityId
  if (req.prog !== undefined) clean.prog = req.prog
  if (req.local !== undefined) clean.local = req.local
  if (req.unitId !== undefined) clean.unitId = req.unitId
  if (req.unitType !== undefined) clean.unitType = req.unitType
  if (req.classId !== undefined) clean.classId = req.classId
  if (req.unit !== undefined) {
    const uType = req.unit.unitType
    const uId = req.unit.id
    const isLocalPlayer =
      req.unit.isLocalPlayer ??
      (uType === 'player' && (uId === this.selfId || this.selfId === 0))
    const unitObj = this.getUnit(uType, uId)
    const resolvedX =
      req.unit.x ??
      req.x ??
      (unitObj ? unitObj.x : isLocalPlayer ? this._self.x : 0)
    const resolvedY =
      req.unit.y ??
      req.y ??
      (unitObj ? unitObj.y : isLocalPlayer ? this._self.y : 0)
    clean.unit = {
      unitType: uType,
      id: uId,
      x: resolvedX,
      y: resolvedY,
      ...(isLocalPlayer ? { isLocalPlayer: true } : {}),
    }
    clean.x = req.x ?? resolvedX
    clean.y = req.y ?? resolvedY
  } else {
    if (req.x !== undefined) clean.x = req.x
    if (req.y !== undefined) clean.y = req.y
  }
  if (req.delayTicks !== undefined) clean.delayTicks = req.delayTicks
  if (req.volume !== undefined) clean.volume = req.volume
  if (req.volumeOverride !== undefined) clean.volumeOverride = req.volumeOverride
  const queue: WorldSoundRequest[] = this._soundRequests
  const entityId = req.entityId
  if (req.kind === 'missile-tick' && entityId !== undefined) {
    // A travel-sound position update supersedes the previous one for the same missile (#991): keep one per id
    // so a crowd of looping missiles (Andariel's death fire) cannot flood the queue.
    const prev = queue.findIndex(q => q.kind === 'missile-tick' && q.entityId === entityId)
    if (prev >= 0) {
      queue[prev] = clean as unknown as WorldSoundRequest
      return
    }
  }
  if (entityId !== undefined) {
    const tracked = this._soundMissileIds as Set<number> | undefined
    if (req.kind === 'missile-spawn') tracked?.add(entityId)
    else if (req.kind === 'missile-destroy') tracked?.delete(entityId)
  }
  if (req.unit !== undefined && req.unit.unitType === 'object') {
    const trackedObjects = this._soundLoopObjectIds as Set<number> | undefined
    if (req.kind === 'unit-loop-start') trackedObjects?.add(req.unit.id)
    else if (req.kind === 'unit-loop-stop') trackedObjects?.delete(req.unit.id)
  }
  queue.push(clean as unknown as WorldSoundRequest)
  while (queue.length > WORLD_SOUND_QUEUE_CAP) {
    // Evict the oldest droppable request. Lifecycle requests (missile-destroy stops a looping travel sound,
    // speech-stop / npc-cancel stop speech) are never dropped, or the sound they stop would play forever (#991).
    const victim = queue.findIndex(q => !isLifecycleSoundRequest(q))
    if (victim < 0) break
    queue.splice(victim, 1)
  }
}

/** Soft cap of the per-frame world sound queue (droppable requests only). */
export const WORLD_SOUND_QUEUE_CAP = 64

/** Requests that stop a running sound; dropping them leaks the sound (e.g. a looping travel or object sound). */
export function isLifecycleSoundRequest(req: WorldSoundRequest): boolean {
  return (
    req.kind === 'missile-destroy' ||
    req.kind === 'unit-loop-stop' ||
    req.kind === 'unit-sound-stop' ||
    req.kind === 'skill-cast-stop' ||
    req.kind === 'speech-stop' ||
    req.kind === 'npc-cancel'
  )
}

/**
 * 1.13c `D2Client.dll` `D2LeapGravityTable113c` at `0x6FB85F54` (used by `SKILLS_CltDo46_Leap` `0x6FB765B0`
 * and `SKILLS_CltDo47_LeapAttack` `0x6FB76AA0`):
 * - Velocity for player is CharStatsTxt.nRunSpeed << 8 (9 << 8 = 2304) per 0x6FB75F20 / 0x6FB765B0,
 *   which translates to 9 / 16 = 0.5625 sub-tiles/tick in 16.16 fixed-point (velMag = 9).
 * - Gravity is piecewise linear from .rdata 0x6FB85F54:
 *   - dist < 27: rawGravity = -270 * dist + 8462
 *   - dist >= 27: rawGravity = -72 * dist + 1224
 *   - gravity = max(500, rawGravity), accelZ = -gravity
 * - Trajectory calculation per UNIT_SetTrajectoryTargetZ (0x6FB77C80) & UNIT_StepTrajectoryZ (0x6FB77FB0):
 *   - rawTicks = (intDist * 16) / 9
 *   - flightTicks = rawTicks > 1 ? rawTicks - 1 : 1
 *   - initialVelZ = Math.trunc(-Math.trunc((flightTicks * flightTicks * accelZ) / 2) / flightTicks)
 *   - peakZ = Math.max(1, Math.round((flightTicks * flightTicks * gravity) / 16384))
 */
export const LEAP_SETUP_TABLE_113C: readonly { readonly velMag: number; readonly peakZ: number }[] =
  Object.freeze([
    { velMag: 9, peakZ: 34 },
    { velMag: 9, peakZ: 127 },
    { velMag: 9, peakZ: 216 },
    { velMag: 9, peakZ: 70 },
  ])

export interface LeapTrajectoryParams113c {
  readonly sizeIdx: number
  readonly velMag: number
  readonly peakZ: number
  readonly stepSpeed: number
  readonly totalTicks: number
  readonly initialVelZ: number
  readonly accelZ: number
}

/**
 * Computes 1.13c Leap / Leap Attack trajectory parameters from jump distance in sub-tiles
 * (`D2Client.dll` `0x6FB75F20` + `0x6FB765B0` / `0x6FB76AA0` + `UNIT_SetTrajectoryTargetZ` `0x6FB77C80`).
 */
export function computeLeapTrajectoryParams113c(distSubtiles: number): LeapTrajectoryParams113c {
  const safeDist = Number.isFinite(distSubtiles) && distSubtiles > 0 ? distSubtiles : 1
  const intDist = Math.max(1, Math.round(safeDist))
  const velMag = 9 // 1.13c CharStatsTxt.nRunSpeed (0x6FB75F20 / 0x6FB765B0)
  const stepSpeed = velMag / 16 // 9 / 16 = 0.5625 sub-tiles/tick
  // 1.13c SKILLS_InitLeapTrajectory 0x6FB76608..0x6FB7661D:
  // rawTicks = (intDist << 16) / (velMag << 12) = (intDist * 16) / 9
  // flightTicks = rawTicks > 1 ? rawTicks - 1 : 1
  const rawTicks = Math.max(1, Math.trunc((intDist * 16) / velMag))
  const flightTicks = rawTicks > 1 ? rawTicks - 1 : 1

  // 1.13c D2Client.dll 0x6FB76625..0x6FB7665E (.rdata 0x6FB85F54):
  const rawGravity = intDist < 27 ? -270 * intDist + 8462 : -72 * intDist + 1224
  const gravity = Math.max(500, rawGravity)
  const accelZ = -gravity

  // 1.13c UNIT_SetTrajectoryTargetZ (0x6FB77C80):
  const initialVelZ = Math.trunc(-Math.trunc((flightTicks * flightTicks * accelZ) / 2) / flightTicks)
  // Apex altitude in pixels: (posZ >> 11 at flight midpoint k = flightTicks / 2):
  const peakZ = Math.max(1, Math.round((flightTicks * flightTicks * gravity) / 16384))
  const sizeIdx = Math.min(3, Math.max(0, (intDist - 1) >> 3))

  return {
    sizeIdx,
    velMag,
    peakZ,
    stepSpeed,
    totalTicks: flightTicks,
    initialVelZ,
    accelZ,
  }
}

/**
 * 1.13c Paladin Charge (#107) velocity computation (D2Client.dll 0x6FADC073..0x6FADC103 / D2Game.dll 0x6FCB9762..0x6FCB97FA):
 * - baseVel: CharStatsTxt.nRunSpeed << 8 (9 << 8 = 2304) for player; (animSpeed || 9) << 8 for monster
 * - velPct: Math.max(50, stat67VelocityPercent)
 * - totalPct: 150 + velPct (Skills.txt Param1 = 150)
 * - dwVelocity: Math.trunc((baseVel * totalPct) / 100)
 * - stepSpeed: dwVelocity / 4096 sub-tiles/tick (1.125 sub-tiles/tick at base velocity)
 */
export function computeChargeVelocity113c(
  stat67VelocityPercent = 0,
  baseRunSpeed = 9,
): { dwVelocity: number; stepSpeed: number } {
  const velPct = Math.max(50, stat67VelocityPercent)
  const totalPct = 150 + velPct
  const baseVel = baseRunSpeed << 8
  const dwVelocity = Math.trunc((baseVel * totalPct) / 100)
  const stepSpeed = dwVelocity / 4096
  return { dwVelocity, stepSpeed }
}

export function emitSkillCastSoundImpl(this: ClientWorldInternal, opts: {
  readonly skillId?: number | undefined
  readonly charclass?: string | number | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly unitId?: number | undefined
  readonly local?: boolean | undefined
}): void {
  const skillId = Number(opts.skillId ?? 0)
  if (!Number.isFinite(skillId) || skillId <= 0) return
  const entry = getSkillSoundEntry113c(skillId)
  if (!entry) return
  const cls = normalizePlayerClassCode113c(opts.charclass ?? this._self.charClass)
  const soundId =
    cls && entry.charclass === cls && entry.stsoundclass > 0
      ? entry.stsoundclass
      : entry.stsound
  if (soundId <= 0) return
  const isLocal =
    opts.local ??
    (opts.unitId !== undefined
      ? opts.unitId === this.selfId || (this.selfId === 0 && opts.unitId === 1)
      : true)
  const numUnitId = opts.unitId !== undefined ? Number(opts.unitId) : undefined
  const unitRef =
    numUnitId !== undefined && Number.isFinite(numUnitId)
      ? {
          unitType: 'player' as const,
          id: numUnitId,
          ...(opts.x !== undefined ? { x: Number(opts.x) } : {}),
          ...(opts.y !== undefined ? { y: Number(opts.y) } : {}),
          isLocalPlayer: isLocal,
        }
      : undefined
  if (skillId === 151 && unitRef !== undefined) {
    this.pushSoundRequest({
      kind: 'unit-sound-stop',
      soundId: 2531,
      skillId: 151,
      unitId: numUnitId,
      unit: unitRef,
      ...(opts.x !== undefined ? { x: Number(opts.x) } : {}),
      ...(opts.y !== undefined ? { y: Number(opts.y) } : {}),
      local: isLocal,
    })
  }
  this.pushSoundRequest({
    kind: 'skill-cast',
    soundId,
    skillId,
    ...(cls ? { charclass: cls } : {}),
    ...(opts.x !== undefined ? { x: Number(opts.x) } : {}),
    ...(opts.y !== undefined ? { y: Number(opts.y) } : {}),
    ...(numUnitId !== undefined ? { unitId: numUnitId } : {}),
    ...(unitRef !== undefined ? { unit: unitRef } : {}),
    local: isLocal,
    ...(entry.stsounddelay > 0 ? { delayTicks: entry.stsounddelay } : {}),
  })
}

/**
 * Maps a 1.13c weapon class (`hth`, `bow`, `xbw`, `1hs`, `2hs`, `1ht`, `2ht`, `stf`, `ht1`, `ht2`)
 * or skill ID (`1` Kick, `2`/`4` Throw) to its canonical `Sounds.txt` swing/release sound ID (`D2Client.dll` `0x6fb39a10`).
 */
export function resolveWeaponClassSwingSoundId113c(wclass?: string, skillId?: number): number {
  if (skillId === 1) return 255 // weapon_kick_1
  if (skillId === 2 || skillId === 4) return 259 // weapon_throw_1
  const wc = (wclass ?? 'hth').trim().toLowerCase()
  switch (wc) {
    case 'bow':
      return 309 // weapon_bow_1
    case 'xbw':
      return 317 // weapon_xbow_1
    case '1ht':
      return 286 // weapon_1ht_1
    case '2ht':
      return 292 // weapon_2ht_1
    case 'stf':
      return 298 // weapon_staff_1
    case '2hs':
      return 274 // weapon_2hs_small_1
    case '1hs':
    case '1ss':
    case '1js':
    case '1jt':
    case '1st':
    case 'ht1':
    case 'ht2':
    case 'orb':
    case 'wnd':
      return 262 // weapon_1hs_small_1
    case 'hth':
    default:
      return 251 // weapon_punch_1
  }
}

export function resolveUnitWeaponSwingSoundId113c(
  world: ClientWorldInternal,
  unitId?: number,
  skillId?: number,
): number {
  const resolvedId = unitId !== undefined && unitId > 0 ? unitId : world.selfId
  const isSelf = resolvedId === world.selfId || world.selfId === 0
  const unit = resolvedId !== 0 ? world.getUnit('player', resolvedId) : undefined
  const unitAny = unit as { readonly weaponClass?: string; readonly wclass?: string } | undefined
  const explicitWclass = unitAny?.weaponClass ?? unitAny?.wclass
  const wclass =
    explicitWclass ??
    (isSelf
      ? resolveEquippedWeaponClass(Array.from(world._containers.equipment.values()))
      : resolveEquippedWeaponClass(
          Array.from(world.resolvePlayerActiveEquipment(resolvedId, false) ?? []),
        ))
  return resolveWeaponClassSwingSoundId113c(wclass, skillId)
}

export function emitSkillKeyframeSoundImpl(this: ClientWorldInternal, opts: {
  readonly skillId?: number | undefined
  readonly flag?: number | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly unitId?: number | undefined
  readonly local?: boolean | undefined
  readonly weaponSoundId?: number | undefined
}): void {
  const skillId = Number(opts.skillId ?? 0)
  if (!Number.isFinite(skillId) || skillId < 0) return
  const entry = getSkillSoundEntry113c(skillId)
  if (!entry) return
  const flag = opts.flag ?? 1
  const soundId =
    flag === 2 && entry.dosoundA > 0
      ? entry.dosoundA
      : flag === 3 && entry.dosoundB > 0
        ? entry.dosoundB
        : entry.dosound > 0
          ? entry.dosound
          : entry.dosoundA > 0
            ? entry.dosoundA
            : entry.dosoundB
  const needsWeaponSound =
    entry.weaponsnd > 0 ||
    skillId === 0 ||
    skillId === 1 ||
    skillId === 2 ||
    skillId === 4 ||
    skillId === 5 ||
    skillId === 6 ||
    skillId === 7 ||
    skillId === 10 ||
    skillId === 11 ||
    skillId === 12 ||
    skillId === 22
  const resolvedWeaponSoundId =
    opts.weaponSoundId ??
    (needsWeaponSound ? resolveUnitWeaponSwingSoundId113c(this, opts.unitId, skillId) : undefined)
  const effSoundId = soundId > 0 ? soundId : (resolvedWeaponSoundId ?? 0)
  if (effSoundId <= 0) return
  this.pushSoundRequest({
    kind: 'skill-keyframe',
    soundId: effSoundId,
    skillId,
    flag,
    ...(resolvedWeaponSoundId !== undefined && resolvedWeaponSoundId > 0
      ? { weaponSoundId: resolvedWeaponSoundId }
      : {}),
    ...(opts.x !== undefined ? { x: Number(opts.x) } : {}),
    ...(opts.y !== undefined ? { y: Number(opts.y) } : {}),
    ...(opts.unitId !== undefined ? { unitId: Number(opts.unitId) } : {}),
    ...(opts.local !== undefined ? { local: opts.local } : {}),
  })
}

export function emitMissileSpawnSoundImpl(this: ClientWorldInternal, opts: {
  readonly missileId?: number | string | undefined
  readonly entityId?: number | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
}): void {
  if (opts.missileId === undefined) return
  const entry = getMissileSoundEntry113c(opts.missileId)
  if (!entry || entry.travelSound <= 0) return
  this.pushSoundRequest({
    kind: 'missile-spawn',
    soundId: entry.travelSound,
    missileId: entry.id,
    ...(opts.entityId !== undefined ? { entityId: Number(opts.entityId) } : {}),
    ...(opts.x !== undefined ? { x: Number(opts.x) } : {}),
    ...(opts.y !== undefined ? { y: Number(opts.y) } : {}),
  })
}

export function emitMissileImpactSoundImpl(this: ClientWorldInternal, opts: {
  readonly missileId?: number | string | undefined
  readonly entityId?: number | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly prog?: boolean | undefined
}): void {
  if (opts.missileId === undefined) return
  const entry = getMissileSoundEntry113c(opts.missileId)
  if (!entry) return
  const soundId = opts.prog
    ? entry.progSound > 0
      ? entry.progSound
      : entry.hitSound
    : entry.hitSound > 0
      ? entry.hitSound
      : entry.progSound
  if (soundId <= 0) return
  this.pushSoundRequest({
    kind: 'missile-impact',
    soundId,
    missileId: entry.id,
    ...(opts.entityId !== undefined ? { entityId: Number(opts.entityId) } : {}),
    ...(opts.x !== undefined ? { x: Number(opts.x) } : {}),
    ...(opts.y !== undefined ? { y: Number(opts.y) } : {}),
    ...(opts.prog !== undefined ? { prog: Boolean(opts.prog) } : {}),
  })
}

export function emitUnitDeathSoundImpl(this: ClientWorldInternal, opts: {
  readonly unitType?: number | string | undefined
  readonly unitId?: number | undefined
  readonly classId?: number | undefined
  readonly soundId?: number | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
}): void {
  const unitId = opts.unitId !== undefined ? Number(opts.unitId) : undefined
  if (unitId !== undefined && unitId > 0) {
    if (this._deadSoundUnitIds.has(unitId)) {
      return
    }
    this._deadSoundUnitIds.add(unitId)
  }
  let soundId = opts.soundId !== undefined ? Number(opts.soundId) : 0
  let delayTicks: number | undefined
  if (soundId <= 0) {
    const isPlayer = opts.unitType === 0 || opts.unitType === 'player'
    if (isPlayer) {
      const clsIdx = Math.max(0, Math.min(6, Number(opts.classId ?? this._self.charClass ?? 0)))
      soundId = PLAYER_SOUND_TABLE_0x6FBA7694[clsIdx]?.death1 ?? 2883
    } else {
      const mUnit = unitId !== undefined ? this._monsters.get(unitId) : undefined
      // D2Client.dll 0x6fad37e9..0x6fad3802: skip monster death vocal when STATE_FREEZE (43) is active
      if (mUnit?.states?.has(43)) return
      const monRow = resolveUnitMonSoundRow113c(
        mUnit ?? { classId: Number(opts.classId ?? 1) },
      )
      soundId = monRow?.deathSound && monRow.deathSound > 0 ? monRow.deathSound : 0
      if (monRow && monRow.deaDelay > 0) {
        delayTicks = monRow.deaDelay
      }
    }
  }
  if (soundId <= 0) return
  this.pushSoundRequest({
    kind: 'unit-death',
    soundId,
    ...(opts.unitType !== undefined ? { unitType: opts.unitType } : {}),
    ...(unitId !== undefined ? { unitId } : {}),
    ...(opts.classId !== undefined ? { classId: Number(opts.classId) } : {}),
    ...(opts.x !== undefined ? { x: Number(opts.x) } : {}),
    ...(opts.y !== undefined ? { y: Number(opts.y) } : {}),
    ...(delayTicks !== undefined && delayTicks > 0 ? { delayTicks } : {}),
  })
}

export function emitMonsterModeSoundImpl(this: ClientWorldInternal, unit: ClientUnit, rawMode: number, skillId?: number): void {
  if (unit.unitType !== 'monster') return
  const unitRef = {
    unitType: 'monster' as const,
    id: unit.id,
    x: unit.x,
    y: unit.y,
  }
  const emitHitClassSounds = () => {
    // D2Client.dll 0x6fad3630 -> 0x6fad27e0: emit physical + elemental HitClass impact sounds on GH (3), KB (13), and DT (0)
    if (unit.states?.has(146)) return
    const hitClass = unit.hitClass ?? 0
    if (hitClass <= 0) return
    for (const hitSoundId of resolveHitClassSoundIds113c(hitClass)) {
      this.pushSoundRequest({
        soundId: hitSoundId,
        unit: unitRef,
        x: unit.x,
        y: unit.y,
      })
    }
  }
  const row: MonSoundRow113c | undefined = resolveUnitMonSoundRow113c(unit)
  if (!row) {
    if (rawMode === 0) {
      if (unit.id > 0) {
        if (this._deadSoundUnitIds.has(unit.id)) return
        this._deadSoundUnitIds.add(unit.id)
      }
      emitHitClassSounds()
    } else if (rawMode === 3 || rawMode === 13) {
      emitHitClassSounds()
    }
    return
  }
  const effSkillId = skillId ?? unit.castState?.skillId ?? unit.lastSkillId
  const mode = convertMonsterSoundMode113c(row, rawMode, effSkillId)
  switch (mode) {
    case 0: {
      // DT: DeathSound + DeaDelay (deduped per unitId via _deadSoundUnitIds)
      if (unit.id > 0) {
        if (this._deadSoundUnitIds.has(unit.id)) return
        this._deadSoundUnitIds.add(unit.id)
      }
      emitHitClassSounds()
      // D2Client.dll 0x6fad36d0..0x6fad36ed: skip monster death vocal when STATE_FREEZE (43) or hitClass 0xA0 is active
      if (unit.states?.has(43) || ((unit.hitClass ?? 0) & 0xf0) === 0xa0) return
      if (row.deathSound > 0) {
        this.pushSoundRequest({
          kind: 'unit-death',
          soundId: row.deathSound,
          unit: unitRef,
          unitType: 1,
          unitId: unit.id,
          classId: unit.classId,
          x: unit.x,
          y: unit.y,
          ...(row.deaDelay > 0 ? { delayTicks: row.deaDelay } : {}),
        })
      }
      break
    }
    case 3:
    case 13: {
      // GH (3) / KB (13): HitClass physical + elemental impact sounds + HitSound + HitDelay
      emitHitClassSounds()
      if (unit.states?.has(43) || ((unit.hitClass ?? 0) & 0xf0) === 0xa0) return
      if (row.hitSound > 0) {
        this.pushSoundRequest({
          soundId: row.hitSound,
          unit: unitRef,
          x: unit.x,
          y: unit.y,
          ...(row.hitDelay > 0 ? { delayTicks: row.hitDelay } : {}),
        })
      }
      break
    }
    case 4: {
      // A1: Attack1 (Att1Prb / Att1Del) + Weapon1 (Wea1Del / Wea1Vol)
      if (row.attack1 > 0) {
        const playAtt1 =
          row.att1Prb <= 0 ||
          row.att1Prb >= 100 ||
          ((SEED_RollRandomNumber(unit.seed) >>> 0) % 100) < row.att1Prb
        if (playAtt1) {
          this.pushSoundRequest({
            soundId: row.attack1,
            unit: unitRef,
            x: unit.x,
            y: unit.y,
            ...(row.att1Del > 0 ? { delayTicks: row.att1Del } : {}),
          })
        }
      }
      if (row.weapon1 > 0) {
        this.pushSoundRequest({
          soundId: row.weapon1,
          unit: unitRef,
          x: unit.x,
          y: unit.y,
          ...(row.wea1Del > 0 ? { delayTicks: row.wea1Del } : {}),
          ...(row.wea1Vol > 0 ? { volume: row.wea1Vol } : {}),
        })
      }
      break
    }
    case 5: {
      // A2: Attack2 (Att2Prb / Att2Del) + Weapon2 (Wea2Del / Wea2Vol)
      if (row.attack2 > 0) {
        const playAtt2 =
          row.att2Prb <= 0 ||
          row.att2Prb >= 100 ||
          ((SEED_RollRandomNumber(unit.seed) >>> 0) % 100) < row.att2Prb
        if (playAtt2) {
          this.pushSoundRequest({
            soundId: row.attack2,
            unit: unitRef,
            x: unit.x,
            y: unit.y,
            ...(row.att2Del > 0 ? { delayTicks: row.att2Del } : {}),
          })
        }
      }
      if (row.weapon2 > 0) {
        this.pushSoundRequest({
          soundId: row.weapon2,
          unit: unitRef,
          x: unit.x,
          y: unit.y,
          ...(row.wea2Del > 0 ? { delayTicks: row.wea2Del } : {}),
          ...(row.wea2Vol > 0 ? { volume: row.wea2Vol } : {}),
        })
      }
      break
    }
    case 8: {
      if (row.skill1 > 0) {
        this.pushSoundRequest({
          soundId: row.skill1,
          unit: unitRef,
          x: unit.x,
          y: unit.y,
        })
      }
      break
    }
    case 9: {
      if (row.skill2 > 0) {
        this.pushSoundRequest({
          soundId: row.skill2,
          unit: unitRef,
          x: unit.x,
          y: unit.y,
        })
      }
      break
    }
    case 10: {
      if (row.skill3 > 0) {
        this.pushSoundRequest({
          soundId: row.skill3,
          unit: unitRef,
          x: unit.x,
          y: unit.y,
        })
      }
      break
    }
    case 11: {
      if (row.skill4 > 0) {
        this.pushSoundRequest({
          soundId: row.skill4,
          unit: unitRef,
          x: unit.x,
          y: unit.y,
        })
      }
      break
    }
    case 1: {
      // NU (1): Neutral + NeuTime (0x6fad381c..0x6fad38ae, 125-tick global throttle)
      if (!isTownNpcHcIdx(unit.classId) && row.neutral > 0 && row.neuTime > 0) {
        let nextTick = this._monsterNextNeutralSoundTick.get(unit.id)
        if (nextTick === undefined) {
          const jitter = (SEED_RollRandomNumber(unit.seed) >>> 0) % Math.max(1, row.neuTime)
          nextTick = this.frameCount + row.neuTime + jitter
          this._monsterNextNeutralSoundTick.set(unit.id, nextTick)
        } else if (this.frameCount >= nextTick) {
          if (this.frameCount - (this._lastGlobalNeutralSoundTick ?? -200) >= 125) {
            this._lastGlobalNeutralSoundTick = this.frameCount
            this.pushSoundRequest({
              soundId: row.neutral,
              unit: unitRef,
              x: unit.x,
              y: unit.y,
            })
          }
          const jitter = (SEED_RollRandomNumber(unit.seed) >>> 0) % Math.max(1, row.neuTime)
          this._monsterNextNeutralSoundTick.set(unit.id, this.frameCount + row.neuTime + jitter)
        }
      }
      break
    }
    case 2:
    case 15: {
      // WL (2) / RN (15): Footstep (FsCnt / FsPrb / FsOff) + FootstepLayer (FsCnt / FsOff)
      // D2Client.dll 0x6fad3a65..0x6fad3b01: schedules FsCnt steps across the walk/run cycle.
      const fsCnt = Math.max(1, row.fsCnt || 1)
      const npcUnit = this.npcMotion.getUnit(unit.id)
      const cycleTicks =
        npcUnit && npcUnit.wFrameCount > 0
          ? Math.max(1, Math.floor(npcUnit.wFrameCount / Math.max(1, npcUnit.wAnimSpeed || 256)))
          : Math.max(1, unit.totalFrames || 8)
      const stepInterval = Math.max(1, Math.floor(cycleTicks / fsCnt))
      for (let step = 0; step < fsCnt; step++) {
        const stepDelay = row.fsOff + step * stepInterval
        if (row.footstep > 0) {
          const playFs =
            row.fsPrb <= 0 ||
            row.fsPrb >= 100 ||
            ((SEED_RollRandomNumber(unit.seed) >>> 0) % 100) < row.fsPrb
          if (playFs) {
            this.pushSoundRequest({
              soundId: row.footstep,
              unit: unitRef,
              x: unit.x,
              y: unit.y,
              ...(stepDelay > 0 ? { delayTicks: stepDelay } : {}),
            })
          }
        }
        if (row.footstepLayer > 0) {
          this.pushSoundRequest({
            soundId: row.footstepLayer,
            unit: unitRef,
            x: unit.x,
            y: unit.y,
            ...(stepDelay > 0 ? { delayTicks: stepDelay } : {}),
          })
        }
      }
      break
    }
    default:
      break
  }
}

const OVERLAY_TXT_ROW_BY_NAME: ReadonlyMap<string, (typeof OVERLAY_TXT_ROWS)[number]> = new Map(
  OVERLAY_TXT_ROWS.map(row => [row.name.trim().toLowerCase(), row]),
)

export function attachUnitOverlayImpl(this: ClientWorldInternal, unit: ClientUnit, overlayToken: string, loop = false): ClientUnitOverlay {
  const cleanToken = overlayToken.trim().toLowerCase()
  const row = OVERLAY_TXT_ROW_BY_NAME.get(cleanToken)
  if (row === undefined) {
    reportMissingArt(
      'overlay',
      cleanToken || overlayToken,
      `attachUnitOverlay: '${overlayToken}' is not a 1.13c Overlay.txt row`,
    )
    return undefined as unknown as ClientUnitOverlay
  }
  const totalFrames = Math.max(1, row.frames)
  const animRate = Math.max(1, row.animRate)
  const maxTicks = Math.max(1, Math.ceil((totalFrames * 16) / animRate))
  // Overlay.txt `Trans` draw level passed through unclamped (0 none .. 5 modulate);
  // the drawable layer maps it via `overlayTransToBlendMode`.
  const blendMode = row.trans
  const entry: ClientUnitOverlay = {
    overlayId: this._nextOverlayId++,
    token: cleanToken,
    frame: 0,
    totalFrames,
    animRate,
    loop,
    blendMode,
    xOffset: row.xOffset,
    yOffset: row.yOffset,
    preDraw: row.preDraw !== 0,
    startedAtMs: Date.now(),
    ageTicks: 0,
    maxTicks,
    lightRadius: row.radius,
    lightColor: [row.red, row.green, row.blue] as const,
  }
  if (
    cleanToken === 'death_sentry' ||
    !(unit.unitType === 'monster' && hasMonStats2Flag(unit.classId, MONSTATS2_FLAGINDEX.NOOVLY))
  ) {
    unit.overlays = unit.overlays.filter(o => o.token !== cleanToken || o.loop !== loop)
    unit.overlays.push(entry)
  }
  return entry
}

export function attachServerOverlayImpl(this: ClientWorldInternal, unit: ClientUnit, overlayIndex: number): ClientUnitOverlay | undefined {
  const row = Number.isInteger(overlayIndex) ? OVERLAY_TXT_ROWS[overlayIndex] : undefined
  if (row === undefined) return undefined
  const token = row.name.trim().toLowerCase()
  if (
    token !== 'death_sentry' &&
    unit.unitType === 'monster' &&
    hasMonStats2Flag(unit.classId, MONSTATS2_FLAGINDEX.NOOVLY)
  ) {
    return undefined
  }
  if (!OVERLAY_INDICES_NOT_REPLACED.has(overlayIndex)) {
    const existing = unit.overlays.findIndex(o => o.token === token)
    if (existing >= 0) {
      unit.overlays = unit.overlays.filter((_, i) => i !== existing)
    }
  } else if (overlayIndex === 0x9e) {
    // #121 Fist of the Heavens ('handofgod' #158 = 0x9E, Issue #1281):
    // If client-side optimistic cast already attached 'handofgod' within the last 10 ticks,
    // reuse/refresh it instead of stacking a duplicate overlay when S2C 0x11 arrives.
    const recent = unit.overlays.find(o => o.token === token && (o.ageTicks ?? 0) <= 10)
    if (recent) {
      return recent
    }
  }
  const entry: ClientUnitOverlay = {
    overlayId: this._nextOverlayId++,
    token,
    frame: 0,
    totalFrames: row.frames,
    animRate: row.animRate,
    loop: false,
    blendMode: row.trans,
    xOffset: row.xOffset,
    yOffset: row.yOffset,
    preDraw: row.preDraw !== 0,
    startedAtMs: Date.now(),
    ageTicks: 0,
    maxTicks: row.animRate > 0 ? Math.ceil((row.frames * 16) / row.animRate) : Number.POSITIVE_INFINITY,
    lightRadius: row.radius,
    lightColor: [row.red, row.green, row.blue] as const,
  }
  unit.overlays = [...unit.overlays, entry]
  return entry
}

export function spawnMissileByKeyImpl(
  this: ClientWorldInternal,
  missileKey: string,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  opts?: SpawnMissileOptions,
): ClientUnit {
  const cleanKey = missileKey.trim().toLowerCase()
  const data = getMissileTxtData(cleanKey)
  const canonical = CANONICAL_113C_MISSILES[cleanKey]
  const classId = opts?.classId ?? canonical?.id ?? data.id ?? 0
  const id = opts?.id ?? this._nextMissileId++
  const level = Math.max(1, opts?.skillLevel ?? 1)

  const dx = targetX - startX
  const dy = targetY - startY
  const dist = Math.hypot(dx, dy)
  const dir64 =
    opts?.direction !== undefined
      ? opts.direction & 0x3f
      : dir64FromPoints(startX, startY, targetX, targetY, 0)

  const velLev = data.velLev ?? 0
  let effVel = data.vel + Math.floor((level * velLev) / 8)
  if (opts?.velocity !== undefined) {
    if (!Number.isFinite(opts.velocity)) {
      throw new RangeError(`spawnMissileByKey(${cleanKey}): velocity ${String(opts.velocity)} is not finite`)
    }
    effVel = opts.velocity
  } else if (data.maxVel > 0 && effVel > data.maxVel) {
    effVel = data.maxVel
  }
  const dwVelocity = effVel > 0 ? Math.floor(((effVel << 8) * 75) / 100) : 0
  let speedSubTilesPerTick = dwVelocity > 0 ? (16 * dwVelocity) / 65536 : 0
  if (opts?.ownerType === 'monster' && opts?.ownerId !== undefined) {
    const ownerMonster = this._monsters.get(opts.ownerId)
    if (ownerMonster && ownerMonster.states.has(87) && (data as any).canSlow !== false) {
      speedSubTilesPerTick *= 0.33
    }
  }
  let vx = 0
  let vy = 0
  if (
    speedSubTilesPerTick > 0 &&
    !(dist <= 1e-5 && opts?.verticalDescentPerTick !== undefined && opts.verticalDescentPerTick > 0)
  ) {
    if (dist > 1e-5) {
      vx = (dx / dist) * speedSubTilesPerTick
      vy = (dy / dist) * speedSubTilesPerTick
    } else {
      vx = speedSubTilesPerTick
      vy = 0
    }
  }

  const totalFrames = Math.max(1, data.animLen || 1)
  const animSpeed = Math.max(1, data.animSpeed || 16)
  const loopAnim = opts?.loopAnim ?? (data.loopAnim !== 0)
  // Missiles.txt Range (+LevRange) is the lifetime of every row in 1.13c 0x6FB630F0 (Issues #1091, #1132, #1133, #1134, #1136, #1137).
  const baseMaxTicks = Math.max(1, data.range + level * (data.levRange ?? 0))
  const maxTicks = opts?.maxTicks ?? baseMaxTicks

  const unit = new ClientUnit({
    unitType: 'missile',
    id,
    classId,
    name: cleanKey,
    x: startX,
    y: startY,
    mode: 1,
    direction: dir64,
    ownerType: opts?.ownerType,
    ownerId: opts?.ownerId,
  })
  unit.missileKey = cleanKey
  unit.targetX = targetX
  unit.targetY = targetY
  unit.vx = vx
  unit.vy = vy
  unit.accel = data.accel ?? 0
  unit.ageTicks = 0
  unit.maxTicks = maxTicks
  const rawRow = CANONICAL_113C_MISSILES[cleanKey]
  const randStart = rawRow?.randStart ?? 0
  const initFrame =
    opts?.initialFrame !== undefined
      ? ((opts.initialFrame % totalFrames) + totalFrames) % totalFrames
      : randStart > 0
        ? id % Math.min(totalFrames, randStart)
        : 0
  unit.initialFrame = opts?.initialFrame !== undefined || randStart > 0 ? initFrame : undefined
  unit.frame = initFrame
  unit.totalFrames = totalFrames
  unit.animSpeed = animSpeed
  unit.loopAnim = loopAnim
  unit.numDirections = data.numDirections || 1
  // Missiles.txt SubLoop / SubStart / SubStop (D2MissilesTxt +0x180/+0x181/+0x182, read by the D2Client missile
  // creator at 0x6FB63441). Every value comes from the row (Issue #1092); an empty SubStart cell is 0 in the
  // compiled table, which the canonical rows encode by omitting the field.
  if (rawRow?.subLoop) {
    if (rawRow.subStop === undefined) {
      throw new Error(`Missiles.txt row '${cleanKey}' has SubLoop without SubStop`)
    }
    unit.subLoop = Number(rawRow.subLoop)
    unit.subStart = rawRow.subStart ?? 0
    unit.subStop = rawRow.subStop
  }
  unit.explosionMissile = data.explosionMissile || ''
  unit.alwaysExplode = Boolean(rawRow?.alwaysExplode)
  unit.hitUnitIds = new Set<number>()
  unit.piercedTargets = unit.hitUnitIds
  unit.altitude = opts?.altitude
  unit.verticalDescentPerTick = opts?.verticalDescentPerTick
  // 1.13c Lobbed Potions (pCltDoFunc = 2 / rows #44..49 & #238..239, Issue #1276) &
  // #286 Baal Monster Spawn ('baal spawn monsters' #550, Skills.txt lob = 1):
  // Calculate parabolic arc duration from distance and velocity so the projectile lands at (targetX, targetY)
  // with peak altitude > 0 during flight and altitude = 0 on impact.
  const isLobbedPotion113c =
    rawRow?.pCltDoFunc === 2 ||
    cleanKey === 'baal spawn monsters' ||
    opts?.sourceSkillId === 286 ||
    cleanKey === 'pantherpotorange' ||
    cleanKey === 'pantherpotgreen' ||
    cleanKey === 'oilpotion' ||
    cleanKey === 'explosivepotion' ||
    cleanKey === 'explodingpotion' ||
    cleanKey === 'fulminatingpotion' ||
    cleanKey === 'rancidgasepotion' ||
    cleanKey === 'chokinggaspoition' ||
    cleanKey === 'stranglinggaspotion'
  if (isLobbedPotion113c && opts?.maxTicks === undefined && dist > 0.01) {
    const lobFlightTicks = Math.max(
      1,
      Math.min(maxTicks, Math.round(dist / Math.max(0.1, speedSubTilesPerTick))),
    )
    unit.maxTicks = lobFlightTicks
    unit.vx = (targetX - startX) / lobFlightTicks
    unit.vy = (targetY - startY) / lobFlightTicks
    unit.alwaysExplode = true
    ;(unit as any).lobPeakAltitude = Math.min(80, Math.max(18, dist * 3.5))
    unit.altitude = 0
  }
  unit.missileSeed = opts?.missileSeed ? { lo: opts.missileSeed.lo >>> 0, hi: opts.missileSeed.hi >>> 0 } : undefined
  const defaultLowSeed = (Math.imul(id, 0x9e3779b9) ^ Math.imul(this.frameCount + 1, 0x85ebca6b)) >>> 0
  SEED_InitLowSeed(unit.seed, opts?.missileSeed ? opts.missileSeed.lo >>> 0 : defaultLowSeed)
  if (opts?.missileSeed?.hi !== undefined) {
    unit.seed.hi = opts.missileSeed.hi >>> 0
  }
  // 1.13c Missiles.txt Pierce column (D2Game.dll 0x6FD11420 / 0x6FC51390, Issue #1117 / #1306):
  // Pierce=1 marks the projectile as pierce-capable (canPierce); actual piercing requires
  // owner STAT_SKILL_PIERCE (166, from Pierce #33 dm(10,100,slvl)) or STAT_ITEM_PIERCE (156) > 0,
  // capped at 4 pierces (5 total hits), including Guided Arrow (#22 / guidedarrow #86).
  const canPierce = Boolean(rawRow?.pierce) || cleanKey === 'guidedarrow' || opts?.sourceSkillId === 22
  unit.canPierce = canPierce
  unit.pierceCount = 0
  if (typeof opts?.pierceRemaining === 'number') {
    const rem = canPierce ? Math.min(4, Math.max(0, Math.floor(opts.pierceRemaining))) : 0
    unit.pierceRemaining = rem
    unit.pierce = rem > 0
  } else if (opts?.pierce !== undefined) {
    unit.pierce = opts.pierce
  } else if (canPierce) {
    const ownerUnit =
      opts?.ownerId !== undefined
        ? this.getUnit(opts.ownerType ?? 'player', opts.ownerId)
        : opts?.ownerType === 'player' || !opts?.ownerType
          ? this.getUnit('player', this.selfId || 1)
          : undefined
    const isSelfOwner =
      ownerUnit?.unitType === 'player' && (ownerUnit.id === this.selfId || this.selfId === 0)
    const statPierce =
      (ownerUnit?.stats.get(166) ?? 0) +
      (ownerUnit?.stats.get(156) ?? 0) +
      (ownerUnit?.stats.get(328) ?? 0) +
      (isSelfOwner
        ? (this._self.stats.get(166) ?? 0) +
          (this._self.stats.get(156) ?? 0) +
          (this._self.stats.get(328) ?? 0)
        : 0)
    const ownerAny = ownerUnit as unknown as Record<string, unknown> | undefined
    const propSkillPierce = typeof ownerAny?.skill_pierce === 'number' ? ownerAny.skill_pierce : 0
    const propItemPierce = typeof ownerAny?.item_pierce === 'number' ? ownerAny.item_pierce : 0
    const propPiercePct =
      typeof ownerAny?.pierceChancePct === 'number'
        ? ownerAny.pierceChancePct
        : typeof ownerAny?.pierce === 'number'
          ? ownerAny.pierce
          : ownerAny?.pierce === true
            ? 100
            : 0
    let pierceSlvl = 0
    if (ownerAny?.skills instanceof Map) {
      pierceSlvl = Number(ownerAny.skills.get(33) ?? 0)
    } else if (ownerAny?.skills && typeof ownerAny.skills === 'object') {
      pierceSlvl = Number((ownerAny.skills as Record<number, unknown>)[33] ?? 0)
    }
    if (pierceSlvl <= 0 && ownerUnit) {
      pierceSlvl = (ownerUnit.stats.get(107, 33) ?? 0) + (ownerUnit.stats.get(97, 33) ?? 0)
    }
    if (pierceSlvl <= 0 && isSelfOwner) {
      pierceSlvl = this._self.skills.get(33) ?? 0
    }
    const passivePiercePct =
      pierceSlvl > 0 && statPierce === 0 && propSkillPierce === 0
        ? calculatePierceStats(pierceSlvl, opts?.sourceSkillId).chancePct
        : 0
    const totalPiercePct = Math.min(
      100,
      Math.max(0, statPierce + propSkillPierce + propItemPierce + propPiercePct + passivePiercePct),
    )
    let nPierce = 0
    if (totalPiercePct > 0) {
      for (let i = 0; i < 4; i++) {
        if (SEED_RollLimitedRandomNumber(unit.seed, 100) >= totalPiercePct) break
        nPierce++
      }
    }
    unit.pierceRemaining = nPierce
    unit.pierce = nPierce > 0
  } else {
    unit.pierceRemaining = 0
    unit.pierce = false
  }
  unit.originX = opts?.originX ?? startX
  unit.originY = opts?.originY ?? startY
  unit.spiralAngle = opts?.spiralAngle
  unit.spiralRadius = opts?.spiralRadius
  unit.jitterIndex = opts?.jitterIndex
  unit.emitterKind = opts?.emitterKind ?? (cleanKey === 'frozenorb' ? 'frozenorb' : undefined)
  unit.startedAtMs = Date.now()
  unit.startedAtTick = this.frameCount
  unit.sourceSkillId = opts?.sourceSkillId
  unit.skillLevel = level
  if (opts?.noLight === true) unit.missileNoLight = true

  if (
    cleanKey === 'chargedbolt' ||
    cleanKey === 'chargedstrikebolt' ||
    cleanKey === 'sentrychargedbolt' ||
    cleanKey === 'imp charged bolt' ||
    cleanKey === 'lightunique' ||
    cleanKey === 'buglightning' ||
    cleanKey === 'diabwallmaker' ||
    cleanKey === 'catapultchargedballbolt'
  ) {
    // 1.13c SKILLS_InitChargedBolt (0x6FC61F50), SKILLS_CltInitChargedBolt (0x6FB23B60) & SKILLS_CltInitDiabWallMaker (0x6FB06D00):
    // clamp range to 77 (0x4D) and compute PATHTYPE_CHARGEDBOLT (0x6FDB6AA0) random-walk path.
    if (opts?.maxTicks === undefined && unit.maxTicks >= 78) {
      unit.maxTicks = 77
    }
    const boltIdx = opts?.jitterIndex ?? unit.id
    const lowSeed =
      (Math.imul(this.frameCount + 1, 0x6ac690c5) +
        Math.imul(opts?.ownerId ?? 1, 0x19660d) +
        Math.imul(boltIdx, 0x5f95)) >>>
      0
    const waypoints = PATH_ComputePathChargedBolt_6FDB6AA0(
      startX,
      startY,
      targetX,
      targetY,
      unit.maxTicks,
      lowSeed,
    )
    unit.pathWaypoints = waypoints
    unit.pathWaypointIndex = 0
    if (waypoints.length > 0 && speedSubTilesPerTick > 0) {
      const wp0 = waypoints[0]!
      const wpDx = wp0.x - startX
      const wpDy = wp0.y - startY
      const wpDist = Math.hypot(wpDx, wpDy)
      if (wpDist > 1e-5) {
        unit.vx = (wpDx / wpDist) * speedSubTilesPerTick
        unit.vy = (wpDy / wpDist) * speedSubTilesPerTick
        unit.direction = dir64FromPoints(startX, startY, wp0.x, wp0.y, unit.direction)
      }
    }
  }

  this._units.set(unit.key, unit)

  // 1.13c D2Client.dll MISSMODE_CltDo09_MeteorCenter (0x6fb68f00) & UNIT_Set3DTrajectory (0x6fb77e30):
  // meteorcenter (id=101, Range=60, CltParam1=59, CltParam2=25, CltParam3=15) spawns
  // ClientSubMissile1 ('meteor') and ClientSubMissile2 ('meteortail') with identical 3D trajectory
  // (xOffset = -15 * 59 = -885 sub-units = -(15 * 59)/32 sub-tiles, zOffset = -25 * 59 = -1475 px).
  if (
    cleanKey === 'meteorcenter' ||
    cleanKey === 'vampiremeteorcenter' ||
    cleanKey === 'royalstrikemeteorcenter'
  ) {
    unit.vx = 0
    unit.vy = 0
    unit.alwaysExplode = true
    if (opts?.expandSubMissiles !== false) {
      const descentFrames = Math.max(1, unit.maxTicks - 1)
      const skyX = targetX - (15 * descentFrames) / 32
      const skyY = targetY
      const initAlt = 25 * descentFrames
      const tailKey =
        cleanKey === 'royalstrikemeteorcenter' ? 'royalstrikemeteortail' : 'meteortail'
      const coreKey =
        cleanKey === 'vampiremeteorcenter'
          ? 'vampiremeteor'
          : cleanKey === 'royalstrikemeteorcenter'
            ? 'royalstrikemeteor'
            : 'meteor'
      const tail = this.spawnMissileByKey(tailKey, skyX, skyY, targetX, targetY, {
        ownerType: opts?.ownerType,
        ownerId: opts?.ownerId,
        sourceSkillId: opts?.sourceSkillId ?? 56,
        skillLevel: level,
        maxTicks: unit.maxTicks,
        altitude: initAlt,
        originX: targetX,
        originY: targetY,
        pierce: true,
        expandSubMissiles: false,
      })
      tail.vx = 15 / 32
      tail.vy = 0
      tail.alwaysExplode = false
      tail.explosionMissile = ''
      const core = this.spawnMissileByKey(coreKey, skyX, skyY, targetX, targetY, {
        ownerType: opts?.ownerType,
        ownerId: opts?.ownerId,
        sourceSkillId: opts?.sourceSkillId ?? 56,
        skillLevel: level,
        maxTicks: unit.maxTicks,
        altitude: initAlt,
        originX: targetX,
        originY: targetY,
        pierce: true,
        expandSubMissiles: false,
      })
      core.vx = 15 / 32
      core.vy = 0
      core.alwaysExplode = false
      core.explosionMissile = ''
    }
  } else if (
    (cleanKey === 'meteor' ||
      cleanKey === 'vampiremeteor' ||
      cleanKey === 'royalstrikemeteor') &&
    opts?.expandSubMissiles !== false
  ) {
    const descentFrames = Math.max(1, unit.maxTicks - 1)
    const skyX = targetX - (15 * descentFrames) / 32
    const skyY = targetY
    const initAlt = opts?.altitude ?? 25 * descentFrames
    unit.originX = targetX
    unit.originY = targetY
    unit.x = skyX
    unit.y = skyY
    unit.altitude = initAlt
    unit.vx = 15 / 32
    unit.vy = 0
    unit.pierce = true
    unit.alwaysExplode = true
    const tailKey =
      cleanKey === 'royalstrikemeteor' ? 'royalstrikemeteortail' : 'meteortail'
    const tail = this.spawnMissileByKey(tailKey, skyX, skyY, targetX, targetY, {
      ownerType: opts?.ownerType,
      ownerId: opts?.ownerId,
      sourceSkillId: opts?.sourceSkillId ?? 56,
      skillLevel: level,
      maxTicks: unit.maxTicks,
      altitude: initAlt,
      originX: targetX,
      originY: targetY,
      pierce: true,
      expandSubMissiles: false,
    })
    tail.vx = 15 / 32
    tail.vy = 0
    tail.alwaysExplode = false
    tail.explosionMissile = ''
  }

  this.emitMissileSpawnSound({
    missileId: classId > 0 ? classId : cleanKey,
    entityId: unit.id,
    x: unit.x,
    y: unit.y,
  })

  return unit
}

export function resolveRangedAttackMissileKey113c(
  world: ClientWorldInternal,
  caster: ClientUnit,
  _mode = caster.mode,
): 'arrow' | 'bolt' | undefined {
  if (caster.unitType === 'player') {
    const isSelf = caster.id === world.selfId || world.selfId === 0
    if (isSelf) {
      const eqWeapon =
        world._containers.equipmentBySlot.get(4) ?? world._containers.equipmentBySlot.get(5)
      if (eqWeapon) {
        const info = getAttackWeaponInfo(eqWeapon)
        if (info.ammoType) return info.ammoType
      }
      for (const item of world._containers.equipment.values()) {
        const info = getAttackWeaponInfo(item)
        if (info.ammoType) return info.ammoType
      }
    }
    const activeEq = world.resolvePlayerActiveEquipment?.(caster.id, isSelf)
    if (activeEq) {
      for (const item of activeEq) {
        const info = getAttackWeaponInfo(item)
        if (info.ammoType) return info.ammoType
      }
    }
    const casterAny = caster as unknown as Record<string, unknown>
    if (casterAny.isCrossbow === true) return 'bolt'
    if (casterAny.isBow === true) return 'arrow'
    const weaponCode =
      casterAny.weaponCode ??
      casterAny.equippedWeaponCode ??
      caster.itemCode ??
      caster.itemData?.code
    const weaponType = casterAny.equippedWeaponType ?? casterAny.weaponItemType
    const weaponWclass = casterAny.wclass ?? casterAny.weaponClass
    if (typeof weaponCode === 'string' && weaponCode.trim() !== '') {
      const info = getAttackWeaponInfo({
        code: weaponCode,
        type: typeof weaponType === 'string' ? weaponType : undefined,
        wclass: typeof weaponWclass === 'string' ? weaponWclass : undefined,
      })
      if (info.ammoType) return info.ammoType
    }
    if (typeof weaponType === 'string') {
      const wt = weaponType.trim().toLowerCase()
      if (wt === 'crossbow' || wt === 'xbow') return 'bolt'
      if (wt === 'bow' || wt === 'abow') return 'arrow'
    }
    if (typeof weaponWclass === 'string') {
      const wc = weaponWclass.trim().toLowerCase()
      if (wc === 'xbw') return 'bolt'
      if (wc === 'bow') return 'arrow'
    }
    return undefined
  }

  if (caster.unitType === 'monster') {
    const casterAny = caster as unknown as Record<string, unknown>
    if (casterAny.isCrossbow === true) return 'bolt'
    if (casterAny.isBow === true) return 'arrow'
    const weaponCode =
      casterAny.weaponCode ??
      casterAny.equippedWeaponCode ??
      caster.itemCode ??
      caster.itemData?.code
    const weaponType = casterAny.equippedWeaponType ?? casterAny.weaponItemType
    const weaponWclass = casterAny.wclass ?? casterAny.weaponClass
    if (typeof weaponCode === 'string' && weaponCode.trim() !== '') {
      const info = getAttackWeaponInfo({
        code: weaponCode,
        type: typeof weaponType === 'string' ? weaponType : undefined,
        wclass: typeof weaponWclass === 'string' ? weaponWclass : undefined,
      })
      if (info.ammoType) return info.ammoType
    }
    if (typeof weaponType === 'string') {
      const wt = weaponType.trim().toLowerCase()
      if (wt === 'crossbow' || wt === 'xbow') return 'bolt'
      if (wt === 'bow' || wt === 'abow') return 'arrow'
    }
    if (typeof weaponWclass === 'string') {
      const wc = weaponWclass.trim().toLowerCase()
      if (wc === 'xbw') return 'bolt'
      if (wc === 'bow') return 'arrow'
    }
    if ((world._merc && caster.id === world._merc.mercId) || caster.classId === 271) {
      const mercWeapon =
        world._containers.mercBySlot.get(4) ?? world._containers.mercBySlot.get(5)
      if (mercWeapon) {
        const info = getAttackWeaponInfo(mercWeapon)
        if (info.ammoType) return info.ammoType
      }
    }
    // 1.13c Hireling.txt / MonStats.txt: Act 1 Rogue Scout ('roguehire', hcIdx=271) has empty MissA1/MissA2
    // in MonStats.txt and equiv1='bow' in Hireling.txt; her normal bow attack (SkillCltDoFunc[1] @ 0x6FB52230 /
    // D2Common#10709 ITEMS_GetMissileType @ 0x6FDA0D40) spawns 'arrow' (Missiles.txt id 0, Issue #1223).
    if (caster.classId === 271) {
      return 'arrow'
    }
  }
  return undefined
}

export function isCrossbowEquippedImpl(this: ClientWorldInternal, caster: ClientUnit): boolean {
  if (resolveRangedAttackMissileKey113c(this, caster) === 'bolt') {
    return true
  }
  if (caster.unitType === 'player') {
    const isSelf = caster.id === this.selfId || this.selfId === 0
    if (isSelf) {
      const eqWeapon =
        this._containers.equipmentBySlot.get(4) ?? this._containers.equipmentBySlot.get(5)
      if (eqWeapon) {
        const code = (eqWeapon.code ?? '').trim().toLowerCase()
        if (CROSSBOW_ITEM_CODES.has(code)) return true
      }
    }
    const activeEq = this.resolvePlayerActiveEquipment?.(caster.id, isSelf)
    if (activeEq) {
      for (const item of activeEq) {
        const code = (item.code ?? '').trim().toLowerCase()
        if (CROSSBOW_ITEM_CODES.has(code)) return true
      }
    }
    const casterAny = caster as unknown as Record<string, unknown>
    if (casterAny.isCrossbow === true) return true
    const weaponCode =
      casterAny.weaponCode ?? casterAny.equippedWeaponCode ?? caster.itemCode ?? caster.itemData?.code
    if (typeof weaponCode === 'string' && CROSSBOW_ITEM_CODES.has(weaponCode.trim().toLowerCase())) {
      return true
    }
    const weaponType = casterAny.equippedWeaponType ?? casterAny.weaponItemType
    if (
      typeof weaponType === 'string' &&
      (weaponType.toLowerCase() === 'crossbow' || weaponType.toLowerCase() === 'xbow')
    ) {
      return true
    }
  }
  return false
}

export function resolveThrowMissileKeyForCasterImpl(this: ClientWorldInternal, caster: ClientUnit, skillId: number): string {
  if (caster.unitType === 'player' && (caster.id === this.selfId || this.selfId === 0)) {
    const primarySlot = skillId === 4 ? 5 : 4
    const item =
      this._containers.equipmentBySlot.get(primarySlot) ??
      this._containers.equipmentBySlot.get(primarySlot === 4 ? 5 : 4)
    const key = resolveThrowMissileForItemCode(item?.code)
    if (key) return key
  }
  return 'javelin'
}

export function resolveCastActionFrameDelayMsImpl(
  this: ClientWorldInternal,
  unit: ClientUnit,
  mode: number,
  skillId: number,
  _seqNum: number,
  stepSpeed256: number,
  durationMs: number,
): number {
  if (unit.unitType !== 'player') return 0
  if (
    skillId === 159 ||
    skillId === 161 ||
    skillId === 162 ||
    skillId === 166 ||
    skillId === 167 ||
    skillId === 176 ||
    skillId === 180 ||
    skillId === 198 ||
    skillId === 206 ||
    skillId === 216 ||
    skillId === 284 ||
    skillId === 287 ||
    skillId === 288 ||
    skillId === 293 ||
    skillId === 294 ||
    skillId === 301 ||
    skillId === 303 ||
    skillId === 304 ||
    skillId === 305 ||
    skillId === 307 ||
    skillId === 314 ||
    skillId === 320 ||
    skillId === 325 ||
    skillId === 352
  ) {
    return 0
  }
  const step = stepSpeed256 > 0 ? stepSpeed256 : 256
  const isSelf = unit.id === this.selfId || this.selfId === 0
  const wclass = isSelf
    ? resolveEquippedWeaponClass(Array.from(this._containers.equipment.values()))
    : 'hth'
  if (mode === 18) {
    // SQ sequence clips (mode 18): walk the canonical SequenceTbls.cpp player sequence
    // with the unit's equipped weapon class and fire on the first event frame.
    const maxTicks = Math.max(1, Math.ceil(durationMs / 40))
    for (let ticks = 0; ticks <= maxTicks; ticks += 1) {
      const rec = resolveSkillSequenceFrame(skillId, wclass, ticks, step)
      if (rec && rec.event !== 0) return Math.min(durationMs, ticks * 40)
    }
    return 0
  }
  const hasWolf = Boolean(unit.states.has(139)) || (isSelf && this._self.states.has(139))
  const hasBear =
    !hasWolf && (Boolean(unit.states.has(140)) || (isSelf && this._self.states.has(140)))
  const hasVamp =
    !hasWolf &&
    !hasBear &&
    (Boolean(unit.states.has(176)) || (isSelf && this._self.states.has(176)))
  const hasDelirium =
    !hasWolf &&
    !hasBear &&
    !hasVamp &&
    (Boolean(unit.states.has(177)) || (isSelf && this._self.states.has(177)))
  const morphMonsterClassId = hasWolf
    ? 430
    : hasBear
      ? 431
      : hasVamp
        ? 135
        : hasDelirium
          ? 212
          : undefined
  const clip = getCharAnimClip113c(unit.classId, mode, {
    weaponClass: wclass,
    morphMonsterClassId,
  })
  const actionFrame = clip?.actionFrame ?? 0
  if (!(actionFrame > 0)) return 0
  return Math.min(durationMs, computeActionFrameTicks(actionFrame, step) * 40)
}

/** Skills.txt cltdofunc-25 rows whose client handler also applies warcry states / cast overlays (section 8). */
const CLTDO25_WARCRY_SKILLS: ReadonlySet<number> = new Set([130, 138, 146, 149, 154, 155])

/**
 * 0x6FB50DB0(0) / D2Game sub_6FD14170: 64 creates of `missileKey` from (centerX, centerY) toward the 64-entry
 * radius-30 offset table with an explicit velocity (param flag 4). `diabfire` (id 176) alternates param flag 0x4000,
 * so every second create has no light. Lifetime is the missile's own Range + LevRange*lvl.
 */
export function spawnCltDo25Ring113c(
  world: ClientWorldInternal,
  missileKey: string,
  centerX: number,
  centerY: number,
  velocity: number,
  opts: Pick<SpawnMissileOptions, 'ownerType' | 'ownerId' | 'sourceSkillId' | 'skillLevel'>,
): ClientUnit[] {
  const row = CANONICAL_113C_MISSILES[missileKey.trim().toLowerCase()]
  if (row === undefined) {
    throw new Error(`CltDoFunc 25 ring: "${missileKey}" is not a Missiles.txt row`)
  }
  const out: ClientUnit[] = []
  for (const entry of cltDo25RingEntries113c(row.id)) {
    out.push(
      world.spawnMissileByKey(row.name, centerX, centerY, centerX + entry.dx, centerY + entry.dy, {
        ...opts,
        velocity,
        ...(entry.noLight ? { noLight: true } : {}),
      }),
    )
  }
  return out
}

/**
 * 1.13c `Skills.txt` rows with `cltdofunc = 54` (`0x6FB08C90` -> `0x6FB08370` -> `0x6FB06E10`, Issue #1173):
 * - `#178 FetishInferno`: `cltmissilea = 'fetishinferno1'` (#338), `cltmissileb = 'fetishinferno2'` (#339), `Param2 = 7`
 * - `#317 Baal Inferno`: `cltmissilea = 'baal inferno'` (#522), `cltmissileb = ''`, `Param2 = 12`
 * - `#319 MegademonInferno`: `cltmissilea = 'fetishinferno1'` (#338), `cltmissileb = 'fetishinferno2'` (#339), `Param2 = 7`
 * - `#323 Horror Arctic Blast`: `cltmissilea = 'frozenhorror arcticblast1'` (#531), `cltmissileb = 'frozenhorror arcticblast1'` (#531), `Param2 = 7`
 */
export interface CltDo54InfernoSpec113c {
  readonly cltMissileA: string
  readonly cltMissileB: string
  readonly param2: number
}

export const CLT_DO54_INFERNO_113C: Readonly<Record<number, CltDo54InfernoSpec113c>> = Object.freeze({
  178: Object.freeze({ cltMissileA: 'fetishinferno1', cltMissileB: 'fetishinferno2', param2: 7 }),
  317: Object.freeze({ cltMissileA: 'baal inferno', cltMissileB: '', param2: 12 }),
  319: Object.freeze({ cltMissileA: 'fetishinferno1', cltMissileB: 'fetishinferno2', param2: 7 }),
  323: Object.freeze({
    cltMissileA: 'frozenhorror arcticblast1',
    cltMissileB: 'frozenhorror arcticblast1',
    param2: 7,
  }),
})

const CLT_DO54_VEL_DELTA_TABLE_113C = [-2, -1, 0, 1, 2] as const

/**
 * 1.13c `SkillCltDoFunc[54]` (`0x6FB08C90` -> `0x6FB08370` -> `0x6FB06E10`, Issue #1173):
 * Computes `rangeFrames = clamp(Param2 + slvl - 1, 1, 255)` and spawns 2 flame puffs per tick
 * toward `(targetX, targetY)` with `velocity = Vel + [-2,-1,0,1,2][rand % 5]` and
 * `animSpeed = max(1, floor((AnimLen * 16) / rangeFrames))`.
 */
export function spawnCltDo54InfernoTick113c(
  world: ClientWorldInternal,
  caster: ClientUnit,
  skillId: number,
  targetX: number,
  targetY: number,
  skillLevel = 1,
): ClientUnit[] {
  const spec = CLT_DO54_INFERNO_113C[skillId]
  if (!spec) return []
  const slvl = Math.max(1, skillLevel)
  const rangeFrames = Math.max(1, Math.min(255, spec.param2 + slvl - 1))
  const dx = targetX - caster.x
  const dy = targetY - caster.y
  const angle =
    Math.hypot(dx, dy) > 1e-5
      ? Math.atan2(dy, dx)
      : (((caster.direction ?? 0) & 63) / 64) * Math.PI * 2
  const destX = Math.hypot(dx, dy) > 1e-5 ? targetX : caster.x + Math.cos(angle) * 16
  const destY = Math.hypot(dx, dy) > 1e-5 ? targetY : caster.y + Math.sin(angle) * 16

  const out: ClientUnit[] = []
  for (let i = 0; i < 2; i++) {
    const pickB =
      spec.cltMissileB !== '' && (SEED_RollRandomNumber(caster.seed) & 1) !== 0
    const mKey = pickB ? spec.cltMissileB : spec.cltMissileA
    const row = getMissileTxtData(mKey)
    const velDelta =
      CLT_DO54_VEL_DELTA_TABLE_113C[(SEED_RollRandomNumber(caster.seed) >>> 0) % 5] ?? 0
    const velocity = Math.max(1, row.vel + velDelta)
    const animSpeed = Math.max(1, Math.floor((Math.max(1, row.animLen) * 16) / rangeFrames))
    const m = world.spawnMissileByKey(mKey, caster.x, caster.y, destX, destY, {
      ownerType: caster.unitType,
      ownerId: caster.id,
      sourceSkillId: skillId,
      skillLevel: slvl,
      maxTicks: rangeFrames,
      velocity,
      pierce: true,
    })
    m.animSpeed = animSpeed
    out.push(m)
  }
  return out
}

const CLT_DO56_VEL_DELTA_TABLE_113C = [-1, -3, -2, -1, 0] as const

/**
 * 1.13c `SkillCltDoFunc[56]` (`0x6FB08B80` -> `0x6FB08370` -> `0x6FB06E10`, `Skills.txt` #193 `DiabLight`, Issue #1174):
 * Computes `rangeFrames = clamp(Param2 + slvl - 1, 1, 255)` (`Missiles.txt` #172 `diablight` `Param2 = 30`),
 * `animSpeed = max(1, floor((AnimLen * 16) / rangeFrames))` (`AnimLen = 15`), and spawns 1 `'diablight'`
 * missile per tick toward `(targetX, targetY)` with `velocity = Vel + [-1,-3,-2,-1,0][rand % 5]` (`Vel = 20`)
 * and `pierce: true`.
 */
export function spawnCltDo56DiabLightTick113c(
  world: ClientWorldInternal,
  caster: ClientUnit,
  targetX: number,
  targetY: number,
  skillLevel = 1,
): ClientUnit {
  const slvl = Math.max(1, skillLevel)
  const row = getMissileTxtData('diablight')
  const rangeFrames = Math.max(1, Math.min(255, 30 + slvl - 1))
  const dx = targetX - caster.x
  const dy = targetY - caster.y
  const angle =
    Math.hypot(dx, dy) > 1e-5
      ? Math.atan2(dy, dx)
      : (((caster.direction ?? 0) & 63) / 64) * Math.PI * 2
  const destX = Math.hypot(dx, dy) > 1e-5 ? targetX : caster.x + Math.cos(angle) * 16
  const destY = Math.hypot(dx, dy) > 1e-5 ? targetY : caster.y + Math.sin(angle) * 16
  const velDelta =
    CLT_DO56_VEL_DELTA_TABLE_113C[(SEED_RollRandomNumber(caster.seed) >>> 0) % 5] ?? 0
  const velocity = Math.max(1, row.vel + velDelta)
  const animSpeed = Math.max(1, Math.floor((Math.max(1, row.animLen) * 16) / rangeFrames))
  const m = world.spawnMissileByKey('diablight', caster.x, caster.y, destX, destY, {
    ownerType: caster.unitType,
    ownerId: caster.id,
    sourceSkillId: 193,
    skillLevel: slvl,
    maxTicks: rangeFrames,
    velocity,
    pierce: true,
  })
  m.animSpeed = animSpeed
  return m
}

const CLT_DO71_VEL_DELTA_TABLE_113C = [-2, -1, 0, 1, 2] as const

/**
 * 1.13c `SkillCltDoFunc[71]` (`0x6FB757D0`, `Skills.txt` #282 `Imp Inferno`, Issue #1186):
 * - `cltmissilea = 'impinfernoflame1'` (#398, `Vel=20`, `Range=80`, `Param1=8`, `Param2=16`, `AnimLen=15`, `CelFile='Flamethrower'`)
 * - `cltmissileb = 'impinfernoflame2'` (#399, `Vel=20`, `Range=80`, `Param1=8`, `Param2=16`, `AnimLen=15`, `CelFile='Flamethrower2'`)
 * - `cltcalc1 = 8` (`zOffset = 8`), `cltcalc2 = 'lvl-1'` (`rangeFrames = Param2 + cltcalc2 = 16 + slvl - 1 = 15 + slvl`)
 * - Spawns dual-layer `'impinfernoflame1'` and `'impinfernoflame2'` with `animSpeed = max(1, floor((15 * 16) / rangeFrames))`,
 *   `velocity = 20 + [-2,-1,0,1,2][rand % 5]`, `altitude = 8`, and `verticalDescentPerTick = 16 / rangeFrames`.
 */
export function spawnCltDo71ImpInfernoTick113c(
  world: ClientWorldInternal,
  caster: ClientUnit,
  targetX: number,
  targetY: number,
  skillLevel = 1,
): ClientUnit[] {
  const slvl = Math.max(1, skillLevel)
  const rangeFrames = Math.max(1, Math.min(255, 16 + slvl - 1))
  const zOffset = 8
  const verticalDescentPerTick = (zOffset * 2) / rangeFrames
  const dx = targetX - caster.x
  const dy = targetY - caster.y
  const angle =
    Math.hypot(dx, dy) > 1e-5
      ? Math.atan2(dy, dx)
      : (((caster.direction ?? 0) & 63) / 64) * Math.PI * 2
  const destX = Math.hypot(dx, dy) > 1e-5 ? targetX : caster.x + Math.cos(angle) * 16
  const destY = Math.hypot(dx, dy) > 1e-5 ? targetY : caster.y + Math.sin(angle) * 16

  const out: ClientUnit[] = []
  for (const mKey of ['impinfernoflame1', 'impinfernoflame2'] as const) {
    const row = getMissileTxtData(mKey)
    const velDelta =
      CLT_DO71_VEL_DELTA_TABLE_113C[(SEED_RollRandomNumber(caster.seed) >>> 0) % 5] ?? 0
    const velocity = Math.max(1, row.vel + velDelta)
    const animSpeed = Math.max(1, Math.floor((Math.max(1, row.animLen) * 16) / rangeFrames))
    const m = world.spawnMissileByKey(mKey, caster.x, caster.y, destX, destY, {
      ownerType: caster.unitType,
      ownerId: caster.id,
      sourceSkillId: 282,
      skillLevel: slvl,
      maxTicks: rangeFrames,
      velocity,
      pierce: true,
      altitude: zOffset,
      verticalDescentPerTick,
    })
    m.animSpeed = animSpeed
    out.push(m)
  }
  return out
}

/**
 * 1.13c `Skills.txt` monster teleport family with `cltstfunc = 48` (`0x6FB74550`) and
 * `cltdofunc = 73` (`0x6FB744D0`) / `cltdofunc = 74` (`0x6FB75050`, Issues #1190, #1191):
 * - `#292 Teleport 2`: `cltmissilea = ''`, `cltmissileb = ''`
 * - `#329 Baal Teleport`: `cltmissilea = ''`, `cltmissileb = 'baalteleport'` (#613)
 * - `#330 Imp Teleport`: `cltmissilea = 'imp teleport'` (#451), `cltmissileb = 'imp teleport'` (#451)
 * - `#331 Baal Clone Teleport`: `cltmissilea = 'baalclonedeath'` (#614), `cltmissileb = 'baalteleport'` (#613)
 */
export interface CltDo73TeleportSpec113c {
  readonly cltMissileA?: string
  readonly cltMissileB?: string
}

export const CLT_DO73_74_TELEPORT_113C: Readonly<Record<number, CltDo73TeleportSpec113c>> =
  Object.freeze({
    292: Object.freeze({}),
    329: Object.freeze({ cltMissileB: 'baalteleport' }),
    330: Object.freeze({ cltMissileA: 'imp teleport', cltMissileB: 'imp teleport' }),
    331: Object.freeze({ cltMissileA: 'baalclonedeath', cltMissileB: 'baalteleport' }),
  })

/**
 * 1.13c `SkillCltStFunc[47]` (`0x6FB752E0`, `Skills.txt` #287/#288/#303/#304/#305, Issue #1199):
 * Catapult skills lob `cltmissilea` with `Range = 25` (`cltcalc1 = 16`) and `AlwaysExplode = 1`.
 */
export const CLT_ST47_CATAPULT_BALL_113C: Readonly<Record<number, string>> = Object.freeze({
  287: 'catapultchargedball',
  288: 'catapult spike ball',
  303: 'catapult cold ball',
  304: 'catapult plague ball',
  305: 'catapult meteor ball',
})

/**
 * 1.13c `D2Client.dll` `0x6FB87078` 8-octant direction table for `SkillCltStFunc[49]` (`0x6FB75C70`, `Skills.txt` #294 `Vine Attack`, Issue #1200).
 */
export const CLT_ST49_VINE_OCTANT_OFFSETS_113C: readonly (readonly [number, number])[] =
  Object.freeze([
    [-6, 6],
    [0, 8],
    [6, 6],
    [8, 0],
    [6, -6],
    [0, -8],
    [-6, -6],
    [-8, 0],
  ])

/**
 * 1.13c `D2Client.dll` `0x6FB85CD0` & `0x6FB85CD8` tables for `SkillCltDoFunc[48]` (`0x6FB073A0`, `Skills.txt` #164 `AndrialSpray`, Issue #1175):
 * 8-octant spawn origin offsets and 9-step directional fan target offsets.
 */
export const ANDARIAL_SPRAY_SPAWN_OFFSET_113C: readonly (readonly [number, number])[] = Object.freeze([
  [3, 4],
  [0, 5],
  [-3, 4],
  [-5, 0],
  [-3, -4],
  [0, -5],
  [3, -4],
  [5, 0],
])

export const ANDARIAL_SPRAY_FAN_OFFSETS_113C: readonly (readonly (readonly [number, number])[])[] =
  Object.freeze([
    [
      [-2, 14],
      [0, 14],
      [2, 13],
      [4, 13],
      [6, 12],
      [9, 9],
      [12, 6],
      [13, 2],
      [14, -2],
    ],
    [
      [-10, 10],
      [-9, 11],
      [-7, 12],
      [-5, 13],
      [-3, 13],
      [0, 14],
      [3, 13],
      [7, 12],
      [10, 10],
    ],
    [
      [-14, -2],
      [-14, 0],
      [-13, 2],
      [-13, 4],
      [-12, 6],
      [-9, 9],
      [-6, 12],
      [-2, 13],
      [2, 14],
    ],
    [
      [-10, -10],
      [-11, -9],
      [-12, -7],
      [-13, -5],
      [-13, -3],
      [-14, 0],
      [-13, 3],
      [-12, 7],
      [-10, 10],
    ],
    [
      [2, -14],
      [0, -14],
      [-2, -13],
      [-4, -13],
      [-6, -12],
      [-9, -9],
      [-12, -6],
      [-13, -2],
      [-14, 2],
    ],
    [
      [10, -10],
      [9, -11],
      [7, -12],
      [5, -13],
      [3, -13],
      [0, -14],
      [-3, -13],
      [-7, -12],
      [-10, -10],
    ],
    [
      [14, 2],
      [14, 0],
      [13, -2],
      [13, -4],
      [12, -6],
      [9, -9],
      [6, -12],
      [2, -13],
      [-2, -14],
    ],
    [
      [10, 10],
      [11, 9],
      [12, 7],
      [13, 5],
      [13, 3],
      [14, 0],
      [13, -3],
      [12, -7],
      [10, -10],
    ],
  ])

/**
 * 1.13c `SkillCltDoFunc[60]` (`0x6FB07D50`, `Skills.txt` #203 `DesertTurret`, Issue #1177):
 * Computes the `calc1 = 3` parallel lateral shot origins `(sx, sy)` and targets `(tx, ty)` for `'desertfireball'` (#283).
 */
export function computeCltDo60DesertTurretShots113c(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  count = 3,
): { sx: number; sy: number; tx: number; ty: number }[] {
  const cx = Math.floor(startX)
  const cy = Math.floor(startY)
  let dx = Math.floor(targetX) - cx
  let dy = Math.floor(targetY) - cy
  if (dx === 0 && dy === 0) {
    dx = 10
  }
  let stepX = 0
  let stepY = 0
  if (dx < 0) {
    if (dy < 0) {
      stepX = 2
      stepY = -2
    } else if (dy > 0) {
      stepX = -2
      stepY = -2
    } else {
      stepX = 0
      stepY = -2
    }
  } else if (dx > 0) {
    if (dy < 0) {
      stepX = 2
      stepY = 2
    } else if (dy > 0) {
      stepX = -2
      stepY = 2
    } else {
      stepX = 0
      stepY = 2
    }
  } else {
    if (dy < 0) {
      stepX = 2
      stepY = 0
    } else {
      stepX = -2
      stepY = 0
    }
  }
  const half = count >> 1
  let relX = dx - half * stepX
  let relY = dy - half * stepY
  const out: { sx: number; sy: number; tx: number; ty: number }[] = []
  for (let i = 0; i < count; i++) {
    const sx = cx + Math.trunc(relX / 3)
    const sy = cy + Math.trunc(relY / 3)
    out.push({
      sx,
      sy,
      tx: sx + relX,
      ty: sy + relY,
    })
    relX += stepX
    relY += stepY
  }
  return out
}

/**
 * 1.13c `SkillCltStFunc[44]` (`0x6FB07540`, `Skills.txt` #213 `HellMeteor`, Issue #1172):
 * Spawns:
 * 1. At `(targetX, targetY)`:
 *    - `'hellmeteordown'` (#336, `Range=225`, `zOffset=11520000` => `175.78125` px, `zStep=-51200` => `0.78125` px/tick, `alwaysExplode=true`)
 *    - `'hellmeteorball'` (#337, `Range=225`, `zOffset=175.78125` px, `zStep=-0.78125` px/tick)
 * 2. At `(caster.x, caster.y)`:
 *    - `'hellmeteorup'` (#335, `Range=50`, `zOffset=0`, `zStep=+30720/65536` => `verticalDescentPerTick = -0.46875`)
 *    - `'hellmeteorball'` (#337, `Range=50`, `zOffset=0`, `verticalDescentPerTick = -0.46875`)
 *    - `'hellmeteorlaunch2'` (#334, `Range=44 >> 1 = 22`, `AnimSpeed=16 >> 1 = 8`)
 *    - `'hellmeteorlaunch1'` (#333, `Range=44 >> 1 = 22`, `AnimSpeed=16 >> 1 = 8`)
 */
export function spawnHellMeteorCltSt44_113c(
  world: ClientWorldInternal,
  caster: ClientUnit,
  targetX: number,
  targetY: number,
  skillLevel = 1,
): void {
  const slvl = Math.max(1, skillLevel)
  const ownerType = caster.unitType
  const ownerId = caster.id
  const downAlt = 11520000 / 65536 // 175.78125
  const downStep = 51200 / 65536 // 0.78125
  const upStep = -30720 / 65536 // -0.46875 (ascends by 0.46875 px/tick)

  const down = world.spawnMissileByKey('hellmeteordown', targetX, targetY, targetX, targetY, {
    ownerType,
    ownerId,
    sourceSkillId: 213,
    skillLevel: slvl,
    maxTicks: 225,
    altitude: downAlt,
    verticalDescentPerTick: downStep,
  })
  down.vx = 0
  down.vy = 0
  down.alwaysExplode = true

  const downBall = world.spawnMissileByKey('hellmeteorball', targetX, targetY, targetX, targetY, {
    ownerType,
    ownerId,
    sourceSkillId: 213,
    skillLevel: slvl,
    maxTicks: 225,
    altitude: downAlt,
    verticalDescentPerTick: downStep,
  })
  downBall.vx = 0
  downBall.vy = 0

  const up = world.spawnMissileByKey('hellmeteorup', caster.x, caster.y, caster.x, caster.y, {
    ownerType,
    ownerId,
    sourceSkillId: 213,
    skillLevel: slvl,
    maxTicks: 50,
    altitude: 0,
    verticalDescentPerTick: upStep,
  })
  up.vx = 0
  up.vy = 0

  const upBall = world.spawnMissileByKey('hellmeteorball', caster.x, caster.y, caster.x, caster.y, {
    ownerType,
    ownerId,
    sourceSkillId: 213,
    skillLevel: slvl,
    maxTicks: 50,
    altitude: 0,
    verticalDescentPerTick: upStep,
  })
  upBall.vx = 0
  upBall.vy = 0

  for (const launchKey of ['hellmeteorlaunch2', 'hellmeteorlaunch1'] as const) {
    const launch = world.spawnMissileByKey(launchKey, caster.x, caster.y, caster.x, caster.y, {
      ownerType,
      ownerId,
      sourceSkillId: 213,
      skillLevel: slvl,
      maxTicks: 22,
    })
    launch.vx = 0
    launch.vy = 0
    launch.animSpeed = 8
  }
}

/**
 * 1.13c Skills.txt #277 ('Blade Shield') + Missiles.txt #553 ('blade shield attachment', pCltDoFunc=57 @ 0x6FB66F60):
 * Ensures exactly one 'blade shield attachment' missile unit is anchored to `owner` while state 158 ('bladeshield')
 * is active, with Range=500 + LevRange=100 * slvl frames.
 */
export function ensureBladeShieldAttachment113c(
  world: ClientWorldInternal,
  owner: ClientUnit,
  skillLevel?: number,
): ClientUnit {
  const isSelf =
    owner.unitType === 'player' && (owner.id === world.selfId || world.selfId === 0)
  const resolvedLevel = Math.max(
    1,
    skillLevel ??
      (isSelf ? world._self.skills.get(277) : undefined) ??
      (owner as any).bladeShieldSkillLevel ??
      owner.skillLevel ??
      1,
  )
  ;(owner as any).bladeShieldSkillLevel = resolvedLevel
  for (const u of world._units.values()) {
    if (
      u.unitType === 'missile' &&
      u.missileKey === 'blade shield attachment' &&
      u.ownerType === owner.unitType &&
      u.ownerId === owner.id
    ) {
      u.x = owner.x
      u.y = owner.y
      u.vx = 0
      u.vy = 0
      u.skillLevel = resolvedLevel
      u.ageTicks = 0
      u.maxTicks = 500 + resolvedLevel * 100
      return u
    }
  }
  const attachment = world.spawnMissileByKey(
    'blade shield attachment',
    owner.x,
    owner.y,
    owner.x,
    owner.y,
    {
      ownerType: owner.unitType,
      ownerId: owner.id,
      sourceSkillId: 277,
      skillLevel: resolvedLevel,
    },
  )
  attachment.vx = 0
  attachment.vy = 0
  return attachment
}

/**
 * 1.13c `D2Common_11050` (`0x6FDA54E0`, `MonStats.txt` `MissA1`..`MissSQ`, Issue #1162):
 * Spawns the monster's mode projectile for `mode` (`4=A1`, `5=A2`, `7=C`, `8=S1`, `9=S2`, `10=S3`, `11=S4`, `14=SQ`)
 * from `(unit.x, unit.y)` toward its target.
 */
export function spawnMonsterModeMissileImpl(
  this: ClientWorldInternal,
  unit: ClientUnit,
  mode = unit.mode,
  targetX?: number,
  targetY?: number,
): ClientUnit | undefined {
  if (unit.unitType !== 'monster' || unit.dead) return undefined
  const missileKey =
    getMonsterModeMissile113c(unit.classId, mode) ??
    (mode === 4 || mode === 5 ? resolveRangedAttackMissileKey113c(this, unit, mode) : undefined)
  if (!missileKey) return undefined

  let tx = targetX
  let ty = targetY
  if (
    tx === undefined ||
    ty === undefined ||
    !Number.isFinite(tx) ||
    !Number.isFinite(ty) ||
    (tx === unit.x && ty === unit.y)
  ) {
    tx = undefined
    ty = undefined
    if (unit.targetUnit) {
      const tUnit = this.getUnit(unit.targetUnit.unitType as any, unit.targetUnit.id)
      if (tUnit && (tUnit.x !== unit.x || tUnit.y !== unit.y)) {
        tx = tUnit.x
        ty = tUnit.y
      } else if (
        (unit.targetUnit.unitType === 'player' || (unit.targetUnit.unitType as unknown) === 0) &&
        (unit.targetUnit.id === this.selfId || this.selfId === 0) &&
        (this._self.x !== unit.x || this._self.y !== unit.y)
      ) {
        tx = this._self.x
        ty = this._self.y
      }
    }
    if (
      (tx === undefined || ty === undefined) &&
      unit.targetX !== undefined &&
      unit.targetY !== undefined &&
      (unit.targetX !== 0 || unit.targetY !== 0) &&
      (unit.targetX !== unit.x || unit.targetY !== unit.y)
    ) {
      tx = unit.targetX
      ty = unit.targetY
    }
    if (
      (tx === undefined || ty === undefined) &&
      !this.isFriendlyOrNonHostileMonster(unit) &&
      (this._self.x !== 0 || this._self.y !== 0) &&
      (this._self.x !== unit.x || this._self.y !== unit.y)
    ) {
      tx = this._self.x
      ty = this._self.y
    }
    if ((tx === undefined || ty === undefined) && this.isFriendlyOrNonHostileMonster(unit)) {
      let bestHostile: ClientUnit | undefined
      let bestDist = Infinity
      for (const m of this._monsters.values()) {
        if (m.dead || m.id === unit.id || this.isFriendlyOrNonHostileMonster(m)) continue
        const d = Math.hypot(m.x - unit.x, m.y - unit.y)
        if (d > 1e-5 && d < bestDist) {
          bestDist = d
          bestHostile = m
        }
      }
      if (bestHostile) {
        tx = bestHostile.x
        ty = bestHostile.y
      }
    }
    if (tx === undefined || ty === undefined) {
      const dirAngle = (((unit.direction ?? 0) & 63) / 64) * Math.PI * 2
      tx = unit.x + Math.cos(dirAngle) * 10
      ty = unit.y + Math.sin(dirAngle) * 10
    }
  }

  ;(unit as any)._lastModeMissileMode = mode
  return this.spawnMissileByKey(missileKey, unit.x, unit.y, tx, ty, {
    ownerType: 'monster',
    ownerId: unit.id,
    sourceSkillId: unit.lastSkillId ?? 0,
    skillLevel: Math.max(1, unit.skillLevel ?? 1),
  })
}

/**
 * 1.13c `SKILLS_CltDo20_Strafe` (`0x6FAC5820`, `Skills.txt` #26 `Strafe`, Issues #1119 & #1120):
 * Emits a single `cltmissilea` (`'multipleshotarrow'`) or `cltmissileb` (`'multipleshotbolt'`) missile
 * for one Strafe sequence event frame toward the indexed hostile target (or spread fan angle).
 */
export function fireSingleStrafeShot113c(
  world: ClientWorldInternal,
  caster: ClientUnit,
  targetX: number,
  targetY: number,
  skillLevel: number,
  shotIndex: number,
  totalShots: number,
): ClientUnit {
  const startX = caster.x
  const startY = caster.y
  const dx = targetX - startX
  const dy = targetY - startY
  const baseAngle = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx)
  const isXBow = world.isCrossbowEquipped(caster)
  const cltAb = SKILL_CLT_MISSILE_AB_113C[26]!
  const missileKey = isXBow ? cltAb.cltMissileB : cltAb.cltMissileA
  const slvl = Math.max(1, skillLevel)
  const hostiles = Array.from(world._monsters.values())
    .filter((m) => !world.isFriendlyOrNonHostileMonster(m) && Math.hypot(m.x - startX, m.y - startY) <= 35)
    .sort((a, b) => Math.hypot(a.x - startX, a.y - startY) - Math.hypot(b.x - startX, b.y - startY))
  const count = Math.max(1, totalShots)
  const totalSpread = Math.min(Math.PI * 0.35, 0.08 * Math.max(1, count - 1))
  let tx: number
  let ty: number
  if (hostiles.length > 0) {
    const tgt = hostiles[shotIndex % hostiles.length]!
    tx = tgt.x
    ty = tgt.y
  } else {
    const offset = count === 1 ? 0 : -totalSpread / 2 + (totalSpread * shotIndex) / (count - 1)
    const angle = baseAngle + offset
    tx = startX + Math.cos(angle) * 20
    ty = startY + Math.sin(angle) * 20
  }
  caster.faceToward(tx, ty, true)
  return world.spawnMissileByKey(missileKey, startX, startY, tx, ty, {
    ownerType: caster.unitType,
    ownerId: caster.id,
    sourceSkillId: 26,
    skillLevel: slvl,
  })
}

export function spawnMissilesForSkillImpl(
  this: ClientWorldInternal,
  caster: ClientUnit,
  skillId: number,
  targetX: number,
  targetY: number,
  skillLevel = 1,
  isSecondHand = false,
): void {
  const ownerType = caster.unitType
  const ownerId = caster.id
  const startX = caster.x
  const startY = caster.y
  const dx = targetX - startX
  const dy = targetY - startY
  const baseAngle = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx)

  if (
    caster.unitType === 'monster' &&
    (skillId === 0 || skillId === 183 || skillId === 202 || skillId === 336)
  ) {
    // 1.13c D2Common_11050 (0x6FDA54E0) / SkillCltDoFunc[1] (0x6FB52230) / SkillCltDoFunc[66] (#183 Rogue1, #202 Rogue2, #336 HireableMissile, Issues #1162, #1223):
    // Spawns the monster's MonStats.txt mode missile (MissA1/A2/C/S1..S4/SQ), or for #0 normal ranged weapon attack
    // (such as Act 1 Rogue Scout 'roguehire' hcIdx=271) spawns 'arrow' / 'bolt' from the equipped ranged weapon.
    const modeMissileKey =
      getMonsterModeMissile113c(caster.classId, caster.mode) ??
      getMonsterModeMissile113c(caster.classId, 4) ??
      (skillId === 0 ? resolveRangedAttackMissileKey113c(this, caster, caster.mode) : undefined) ??
      (skillId === 202 || skillId === 336 ? 'arrow' : undefined)
    if (modeMissileKey) {
      const tx = dx === 0 && dy === 0 ? startX + Math.cos(baseAngle) * 10 : targetX
      const ty = dx === 0 && dy === 0 ? startY + Math.sin(baseAngle) * 10 : targetY
      ;(caster as any)._lastModeMissileMode = caster.mode
      this.spawnMissileByKey(modeMissileKey, startX, startY, tx, ty, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
      })
    }
    if (skillId === 0 || skillId === 183 || skillId === 202 || skillId === 336) {
      return
    }
  }

  if (caster.unitType === 'player' && (skillId === 0 || skillId === 5)) {
    // 1.13c SkillCltDoFunc[1] (0x6FB52230, D2MOO Skills.cpp:2252-2261, Issue #1223):
    // Normal Attack (#0) / Left Hand Swing (#5) with an equipped ranged weapon (bow/abow -> 'arrow', xbow -> 'bolt' via D2Common#10709)
    // spawns the weapon's projectile toward the target.
    const rangedMissileKey = resolveRangedAttackMissileKey113c(this, caster, caster.mode)
    if (rangedMissileKey) {
      const tx = dx === 0 && dy === 0 ? startX + Math.cos(baseAngle) * 10 : targetX
      const ty = dx === 0 && dy === 0 ? startY + Math.sin(baseAngle) * 10 : targetY
      this.spawnMissileByKey(rangedMissileKey, startX, startY, tx, ty, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
      })
    }
    return
  }

  const cltSt19MissileC = CLT_ST19_MISSILE_C_113C[skillId]
  if (
    cltSt19MissileC !== undefined &&
    !(caster.castState?.skillId === skillId && (caster.castState as any).cltSt19Spawned)
  ) {
    // 1.13c SkillCltStFunc[19] (0x6FB78F50 -> 0x6FB78980): ensure cltmissilec (#218 bonecast) is spawned at
    // caster facing the target even when spawnMissilesForSkill is invoked directly without startUnitCastAnim.
    this.spawnMissileByKey(cltSt19MissileC, startX, startY, targetX, targetY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel: Math.max(1, skillLevel),
      ...(dx === 0 && dy === 0 ? { direction: caster.direction } : {}),
    })
  }

  if (skillId === 3) {
    // #3 Unsummon: cltstfunc 3 (0x6FB51110) only validates the targeted own pet and cltdofunc is 0. The pet is
    // despawned by the server (SKILLS_SrvDo004_Unsummon -> S2C UnitRemove / 0x7A action 0), never client-side.
    return
  }

  if (skillId === 179) {
    // 1.13c Skills.txt #179 ZakarumHeal (SrvDoFunc=94 @ 0x6FC29AF0, cltdofunc=empty, castoverlay='healing', tgtoverlay='receiving', Issue #1181):
    // Attaches tgtoverlay='receiving' (#99 in Overlay.txt) to the healed target unit and spawns 0 missiles.
    const tgtOverlayToken = getSkillTgtOverlay113c(skillId)
    if (tgtOverlayToken !== undefined) {
      const tgtUnit = resolveSkillTargetUnit113c(this, caster, skillId, targetX, targetY)
      if (tgtUnit !== undefined) {
        this.attachUnitOverlay(tgtUnit, tgtOverlayToken, false)
      }
    }
    return
  }

  if (skillId === 335) {
    // #335 DoomKnightMissile (Oblivion Knight), SkillCltDoFunc[94] SKILLS_CltDo94_DoomKnightMissile (0x6FB08990, Issue #1182):
    // fires cltmissilea + element, element = the monster's S3 component (0xAC component index 10):
    // 0 undeadmissile1 / 1 undeadmissile2 / 2 undeadmissile3 / 3 undeadmissile4.
    const element = caster.compVariants?.[10]
    if (element === undefined || element < 0 || element > 3) {
      throw new RangeError(
        `DoomKnightMissile (#335): caster ${String(caster.id)} (class ${String(caster.classId)}) has no S3 element component (got ${String(element)})`,
      )
    }
    this.spawnMissileByKey(`undeadmissile${String(element + 1)}`, startX, startY, targetX, targetY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
    })
    return
  }

  if (skillId === 338) {
    // #338 NecromageMissile (Skeletal Mage), SkillCltDoFunc[95] SKILLS_CltDo95_NecromageMissile (0x6FB088B0):
    // fires cltmissilea + element, element = the mage's S4 component (0xAC component index 11, set equal to S5 by
    // D2GAME_SetUnitComponent): 0 necromage1 (poison) / 1 necromage2 (cold) / 2 necromage3 (fire) / 3 necromage4 (ltng).
    const element = caster.compVariants?.[11]
    if (element === undefined || element < 0 || element > 3) {
      throw new RangeError(
        `NecromageMissile (#338): caster ${String(caster.id)} (class ${String(caster.classId)}) has no S4 element component (got ${String(element)})`,
      )
    }
    this.spawnMissileByKey(`necromage${String(element + 1)}`, startX, startY, targetX, targetY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
    })
    return
  }

  // 0. Amazon & Sorceress Summons, Melee triggers, Buffs & Special Trajectories
  if (skillId === 8 || skillId === 17) {
    // #8 Inner Sight / #17 Slow Missiles: cast overlay on caster, innersight overlay on nearby monsters
    // 1.13c Skills.txt: fixed 20 subtiles (13.33 yards) radius (Param1 = 20 for #8, Param2 = 20 for #17), does NOT scale with slvl!
    const castOverlay = skillId === 8 ? 'cast_innersight' : 'cast_slowmissiles'
    const stateId = skillId === 8 ? 17 : 87
    this.attachUnitOverlay(caster, castOverlay, false)
    const radius = 20
    for (const m of this._monsters.values()) {
      if (m.dead || this.isFriendlyOrNonHostileMonster(m) || !canMonsterClassBeCursed113c(m.classId)) continue
      if (Math.hypot(m.x - startX, m.y - startY) <= radius) {
        m.states.add(stateId)
        this.attachUnitOverlay(m, 'innersight', true)
      }
    }
    return
  }

  if (skillId === 10 || skillId === 19 || skillId === 30) {
    // #10 Jab / #19 Impale / #30 Fend: pure physical melee skills (cltmissilea = empty, tgtoverlay = empty)
    return
  }

  if (skillId === 14) {
    // #14 Power Strike (1.13c Skills.txt row 14): melee hit with tgtoverlay = lightning (no cltmissilea)
    const targetMon = findHostileMeleeTargetMonster113c(this, caster, targetX, targetY, 4)
    if (targetMon) {
      this.attachUnitOverlay(targetMon, 'lightning', false)
    }
    return
  }

  if (skillId === 24) {
    // #24 Charged Strike (1.13c Skills.txt row 24: srvdofunc=17 / cltdofunc=23, Param1=3, Param2=5):
    // cltcalc1 = par1 + lvl/par2 -> 3 + floor(slvl / 5) chargedstrikebolt missiles + tgtoverlay = lightning
    const targetMon = findHostileMeleeTargetMonster113c(this, caster, targetX, targetY, 4)
    if (targetMon) {
      this.attachUnitOverlay(targetMon, 'lightning', false)
    }
    const count = 3 + Math.floor(Math.max(1, skillLevel) / 5)
    const tx = targetX + Math.cos(baseAngle) * 16
    const ty = targetY + Math.sin(baseAngle) * 16
    for (let i = 0; i < count; i++) {
      this.spawnMissileByKey('chargedstrikebolt', targetX, targetY, tx, ty, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
        jitterIndex: i + 1,
      })
    }
    return
  }

  if (skillId === 26) {
    // #26 Strafe (1.13c Skills.txt SrvDoFunc=12 / CltStFunc=13 / CltDoFunc=20, Issues #1119 & #1120):
    // Param1=2, Param2=4 (minArrows = 2 + floor(slvl/4)), Param3=4, Param4=1 (maxArrows = min(10, 3 + slvl)), Param5=35 (search radius).
    // Fires 1 cltmissilea ('multipleshotarrow') / cltmissileb ('multipleshotbolt') per sequence event frame.
    const slvl = Math.max(1, skillLevel)
    const minArrows = 2 + Math.floor(slvl / 4)
    const maxArrows = Math.min(10, 3 + slvl)
    const hostiles = Array.from(this._monsters.values()).filter(
      (m) => !this.isFriendlyOrNonHostileMonster(m) && Math.hypot(m.x - startX, m.y - startY) <= 35,
    )
    const totalShots =
      hostiles.length > 0 ? Math.min(maxArrows, Math.max(minArrows, hostiles.length)) : maxArrows
    fireSingleStrafeShot113c(this, caster, targetX, targetY, slvl, 0, totalShots)
    if (totalShots > 1) {
      const intervalTicks = 3
      const remainingMs = (totalShots - 1) * intervalTicks * 40 + 40
      const nowMs = this._clockMs ?? Date.now()
      if (!caster.castState || caster.castState.skillId !== 26) {
        caster.castState = {
          skillId: 26,
          targetX,
          targetY,
          mode: caster.unitType === 'player' ? 7 : 4,
          startedAtMs: nowMs,
          untilMs: nowMs + remainingMs,
          durationMs: remainingMs,
          elapsedMs: 0,
          missileSkillLevel: slvl,
          missileSpawned: true,
        }
      } else {
        const elapsed = caster.castState.elapsedMs ?? 0
        caster.castState.durationMs = elapsed + remainingMs
        caster.castState.untilMs = Math.max(
          caster.castState.untilMs,
          caster.castState.startedAtMs + elapsed + remainingMs,
        )
      }
      caster.castState.strafeTotalShots = totalShots
      caster.castState.strafeShotsFired = 1
      caster.castState.strafeIntervalTicks = intervalTicks
      caster.castState.strafeNextShotTick = this.frameCount + intervalTicks
      caster.castState.strafeTargetX = targetX
      caster.castState.strafeTargetY = targetY
      caster.castState.strafeSkillLevel = slvl
    }
    return
  }

  if (skillId === 28) {
    let existingServerDecoy: ClientUnit | undefined
    for (const m of Array.from(this._units.values())) {
      if (m.unitType === 'monster' && m.classId === 356 && !m.dead) {
        if (m.id < 900000) {
          existingServerDecoy = m
        } else {
          m.dead = true
          m.mode = 12
          this._units.delete(m.key)
          this._monsters.delete(m.id)
          this._pets.delete(m.id)
          this.npcMotion.removeMonster(m.id)
        }
      }
    }
    if (existingServerDecoy) {
      existingServerDecoy.ownerType = 'player'
      existingServerDecoy.ownerId = caster.id
      if (!existingServerDecoy.overlays.some((o) => o.token === 'dopllezon_appear')) {
        this.attachUnitOverlay(existingServerDecoy, 'dopllezon_appear', false)
      }
      return
    }
    // #28 Decoy (Dopplezon): summon monster hcIdx=356, sumoverlay=dopllezon_appear
    const summonId = 900000 + Math.floor(Math.random() * 90000)
    const decoyUnit = new ClientUnit({
      unitType: 'monster',
      id: summonId,
      classId: 356, // dopplezon
      x: targetX,
      y: targetY,
      mode: 1, // NU
      direction: caster.direction,
    })
    decoyUnit.ownerType = 'player'
    decoyUnit.ownerId = caster.id
    decoyUnit.name = 'Decoy'
    decoyUnit.nameZh = '诱饵'
    this._units.set(decoyUnit.key, decoyUnit)
    this._monsters.set(decoyUnit.id, decoyUnit)
    this._pets.set(decoyUnit.id, {
      unitId: decoyUnit.id,
      ownerId: caster.id,
      petType: 6, // dopplezon
      classId: 356,
      lifePct: 128,
      isDead: false,
    })
    this.attachUnitOverlay(decoyUnit, 'dopllezon_appear', false)
    return
  }

  if (skillId === 32) {
    let existingServerValk: ClientUnit | undefined
    for (const m of Array.from(this._units.values())) {
      if (m.unitType === 'monster' && m.classId === 357 && !m.dead) {
        if (m.id < 900000) {
          existingServerValk = m
        } else {
          m.dead = true
          m.mode = 12
          this._units.delete(m.key)
          this._monsters.delete(m.id)
          this._pets.delete(m.id)
          this.npcMotion.removeMonster(m.id)
        }
      }
    }
    if (existingServerValk) {
      existingServerValk.ownerType = 'player'
      existingServerValk.ownerId = caster.id
      existingServerValk.states.add(93)
      playStateCastOverlay113c(this, existingServerValk, 93)
      if (!existingServerValk.overlays.some((o) => o.token === 'valkyrie')) {
        this.attachUnitOverlay(existingServerValk, 'valkyrie', true)
      }
      return
    }
    // #32 Valkyrie: summon monster hcIdx=357, sumoverlay=valkyriestart, state=valkyrie
    const summonId = 910000 + Math.floor(Math.random() * 90000)
    const valkUnit = new ClientUnit({
      unitType: 'monster',
      id: summonId,
      classId: 357, // valkyrie
      x: targetX,
      y: targetY,
      mode: 1, // NU
      direction: caster.direction,
    })
    valkUnit.ownerType = 'player'
    valkUnit.ownerId = caster.id
    valkUnit.name = 'Valkyrie'
    valkUnit.nameZh = '女武神'
    valkUnit.states.add(93) // valkyrie
    this._units.set(valkUnit.key, valkUnit)
    this._monsters.set(valkUnit.id, valkUnit)
    this._pets.set(valkUnit.id, {
      unitId: valkUnit.id,
      ownerId: caster.id,
      petType: 7, // valkyrie
      classId: 357,
      lifePct: 128,
      isDead: false,
    })
    playStateCastOverlay113c(this, valkUnit, 93)
    this.attachUnitOverlay(valkUnit, 'valkyrie', true)
    return
  }

  if (skillId === 34) {
    // #34 Lightning Strike (1.13c Skills.txt row 34, SrvDoFunc=22 / CltDoFunc=13, Issue #1118):
    // Attaches tgtoverlay='lightning' to the struck primary target (targetMon), then spawns cltmissilea='lightningstrike' (#232, Range=25)
    // FROM (targetMon.x, targetMon.y) TOWARD the nearest secondary hostile monster (secondMon) within calc1=20 sub-tiles.
    // If no primary target or no secondary target within 20 sub-tiles exists, no 'lightningstrike' missile is spawned.
    let targetMon: ClientUnit | undefined
    if (
      caster.targetUnit &&
      (caster.targetUnit.unitType === 'monster' || (caster.targetUnit.unitType as unknown) === 1)
    ) {
      const explicitTarget = this._monsters.get(caster.targetUnit.id)
      if (explicitTarget && !this.isFriendlyOrNonHostileMonster(explicitTarget)) {
        targetMon = explicitTarget
      }
    }
    if (!targetMon) {
      let bestPrimaryDist = 20
      for (const m of this._monsters.values()) {
        if (this.isFriendlyOrNonHostileMonster(m)) continue
        const d = Math.hypot(m.x - targetX, m.y - targetY)
        if (d <= bestPrimaryDist) {
          bestPrimaryDist = d
          targetMon = m
        }
      }
    }
    if (!targetMon) {
      return
    }
    this.attachUnitOverlay(targetMon, 'lightning', false)
    let secondMon: ClientUnit | undefined
    let bestSecondDist = 20
    for (const m of this._monsters.values()) {
      if (m.id === targetMon.id || this.isFriendlyOrNonHostileMonster(m)) continue
      const d = Math.hypot(m.x - targetMon.x, m.y - targetMon.y)
      if (d <= bestSecondDist) {
        bestSecondDist = d
        secondMon = m
      }
    }
    if (!secondMon) {
      return
    }
    const ls = this.spawnMissileByKey(
      'lightningstrike',
      targetMon.x,
      targetMon.y,
      secondMon.x,
      secondMon.y,
      {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
        pierce: true,
      },
    )
    ls.originX = targetMon.x
    ls.originY = targetMon.y
    ls.hitUnitIds = new Set<number>([targetMon.id])
    return
  }

  if (skillId === 41) {
    // #41 Inferno: 1.13c SKILLS_DoInferno (D2MOO SkillSor.cpp:50-121):
    // Initial frame only primes Param1=1 and spawns 0 missiles; each subsequent channeled frame spawns
    // 1 infernoflame1/infernoflame2 with Range = calc1 (ln12/2 = trunc((20 + 3*(slvl-1)) / 2)).
    const cs = caster.castState?.skillId === 41 ? (caster.castState as any) : undefined
    const primed = cs ? Boolean(cs.infernoChannelPrimed) : Boolean((caster as any).infernoChannelPrimed)
    if (!primed) {
      if (cs) cs.infernoChannelPrimed = true
      ;(caster as any).infernoChannelPrimed = true
      return
    }
    const maxTicks = infernoFlameRangeFrames113c(skillLevel)
    const cosA = Math.cos(baseAngle)
    const sinA = Math.sin(baseAngle)
    const tx = startX + cosA * 16
    const ty = startY + sinA * 16
    const mKey = this._nextSyntheticMissileId % 2 === 0 ? 'infernoflame1' : 'infernoflame2'
    this.spawnMissileByKey(mKey, startX, startY, tx, ty, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
      maxTicks,
      pierce: true,
    })
    return
  }

  if (skillId === 62) {
    // #62 Hydra (Issue #1168): 1.13c Skills.txt srvstfunc=14, srvdofunc=144, cltstfunc=17 (0x6FB23C10), cltdofunc=empty.
    // Client does not synthesize ghost hydra units in _monsters or _pets; summoned hydras are server-authoritative.
    return
  }

  if (CLT_DO54_INFERNO_113C[skillId] !== undefined) {
    // 1.13c SkillCltDoFunc[54] (0x6FB08C90 -> 0x6FB08370 -> 0x6FB06E10, Issue #1173):
    // #178 FetishInferno, #317 Baal Inferno, #319 MegademonInferno, #323 Horror Arctic Blast.
    spawnCltDo54InfernoTick113c(this, caster, skillId, targetX, targetY, skillLevel)
    return
  }

  if (skillId === 193) {
    // 1.13c Skills.txt #193 DiabLight (cltstfunc=40 @ 0x6FB06930, cltdofunc=56 @ 0x6FB08B80, Issue #1174):
    // Spawns 1 'diablight' (#172, Pierce=1, Param2=30) per channeled frame toward (targetX, targetY).
    spawnCltDo56DiabLightTick113c(this, caster, targetX, targetY, skillLevel)
    return
  }

  if (skillId === 164) {
    // 1.13c Skills.txt #164 AndrialSpray (cltstfunc=34 @ 0x6FB07120, cltdofunc=48 @ 0x6FB073A0, Issue #1175):
    // Locks initial target direction in CltSt34 and fires a 9-bolt fan sweep of 'andarielspray' (#32, Range=40, Vel=15, Pierce=1).
    const lockedTx = (caster.castState as any)?.andarialSprayTargetX ?? targetX
    const lockedTy = (caster.castState as any)?.andarialSprayTargetY ?? targetY
    const dir64 =
      lockedTx !== startX || lockedTy !== startY
        ? dir64FromPoints(startX, startY, lockedTx, lockedTy, caster.direction ?? 0)
        : (caster.direction ?? 0) & 63
    const dir8 = (dir64 >> 3) & 7
    const spawnOff = ANDARIAL_SPRAY_SPAWN_OFFSET_113C[dir8] ?? [3, 4]
    const fanRow = ANDARIAL_SPRAY_FAN_OFFSETS_113C[dir8] ?? ANDARIAL_SPRAY_FAN_OFFSETS_113C[0]!
    const sx = startX + spawnOff[0]
    const sy = startY + spawnOff[1]
    for (const [fx, fy] of fanRow) {
      this.spawnMissileByKey('andarielspray', sx, sy, startX + fx, startY + fy, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
        maxTicks: 40,
        pierce: true,
      })
    }
    return
  }

  if (skillId === 192) {
    // 1.13c Skills.txt #192 PrimePoisonNova (cltdofunc=55 @ 0x6FB081F0 -> 0x6FB66BC0, Issue #1176):
    // Ring 1 (8 even entries of 16-point ring) drifts outward at Param1=2 (slowSpeed);
    // Ring 2 (8 odd entries, skip = calc2 = 2) drifts outward at Param2=4 (fastSpeed);
    // each 'primepoisoncloud' (#220, Range=60, SubLoop=1, pCltDoFunc=4) gets subLoops = max(0, slvl - 1).
    const slvl = Math.max(1, skillLevel)
    const subLoops = Math.max(0, slvl - 1)
    const slowSpeed = ringMissileSpeedSubTilesPerTick113c(2)
    const fastSpeed = ringMissileSpeedSubTilesPerTick113c(4)
    for (let i = 0; i < 16; i += 2) {
      const rx = CLT_RING16_DX_113C[i]!
      const ry = CLT_RING16_DY_113C[i]!
      const cloud = this.spawnMissileByKey('primepoisoncloud', startX, startY, startX + rx, startY + ry, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel: slvl,
        maxTicks: 60,
        pierce: true,
      })
      const len = Math.hypot(rx, ry) || 1
      cloud.vx = (rx / len) * slowSpeed
      cloud.vy = (ry / len) * slowSpeed
      ;(cloud as any).subLoops = subLoops
    }
    for (let i = 1; i < 16; i += 2) {
      const rx = CLT_RING16_DX_113C[i]!
      const ry = CLT_RING16_DY_113C[i]!
      const cloud = this.spawnMissileByKey('primepoisoncloud', startX, startY, startX + rx, startY + ry, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel: slvl,
        maxTicks: 60,
        pierce: true,
      })
      const len = Math.hypot(rx, ry) || 1
      cloud.vx = (rx / len) * fastSpeed
      cloud.vy = (ry / len) * fastSpeed
      ;(cloud as any).subLoops = subLoops
    }
    return
  }

  if (skillId === 203) {
    // 1.13c Skills.txt #203 DesertTurret (cltdofunc=60 @ 0x6FB07D50, calc1=3, Issue #1177):
    // Fires calc1=3 parallel lateral 'desertfireball' (#283, Vel=16, Range=40, ExplosionMissile='explodingarrowexp').
    for (const shot of computeCltDo60DesertTurretShots113c(startX, startY, targetX, targetY, 3)) {
      const m = this.spawnMissileByKey('desertfireball', shot.sx, shot.sy, shot.tx, shot.ty, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
      })
      m.alwaysExplode = true
    }
    return
  }

  if (skillId === 204) {
    // 1.13c Skills.txt #204 ArcaneTower (cltdofunc=61 @ 0x6FB07BB0, Issue #1178):
    // Spawns 64 'lightningtowernova' (#643, Vel=24, Range=13, Accel=-1000) around caster from the 64-entry radius-30
    // circle table with zOffset=0x3C000 (3.75 px) and zStep=-0x3000 (0.1875 px/tick).
    const zAlt = 0x3c000 / 65536
    const zStep = 0x3000 / 65536
    for (let i = 0; i < 64; i++) {
      const rx = CLTDO25_RING_X_113C[i]!
      const ry = CLTDO25_RING_Y_113C[i]!
      this.spawnMissileByKey('lightningtowernova', startX, startY, startX + rx, startY + ry, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
        altitude: zAlt,
        verticalDescentPerTick: zStep,
      })
    }
    return
  }

  if (skillId === 177) {
    // 1.13c Skills.txt #177 FetishAura (cltdofunc=53 @ 0x6FB084D0, cltmissilea='curseeffectred' #142, cltcalc1=3, Issue #1179):
    // Spawns cltcalc1 = 3 'curseeffectred' visual missiles around target; client never adds aura states locally.
    const count = 3
    for (let i = 0; i < count; i++) {
      const ox = i === 0 ? 0 : SEED_RollLimitedRandomNumber(caster.seed, 5) - 2
      const oy = i === 0 ? 0 : SEED_RollLimitedRandomNumber(caster.seed, 5) - 2
      const cx = targetX + ox
      const cy = targetY + oy
      const m = this.spawnMissileByKey('curseeffectred', cx, cy, cx, cy, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
      })
      m.vx = 0
      m.vy = 0
    }
    return
  }

  if (skillId === 213) {
    // 1.13c Skills.txt #213 HellMeteor (cltstfunc=44 @ 0x6FB07540, cltdofunc=empty, Issue #1172):
    // When spawnMissilesForSkill is invoked directly without applySkillCastToUnit, run cltstfunc=44 here.
    if (!(caster.castState?.skillId === 213 && (caster.castState as any).cltSt44Spawned)) {
      spawnHellMeteorCltSt44_113c(this, caster, targetX, targetY, skillLevel)
    }
    return
  }

  // 1. Single-bolt linear projectiles
  // Skills 2/4 (Throw / Left Hand Throw): weapon-dependent missile — no
  // Skills.txt missile (srvdofunc 3/5), so resolve from the equipped weapon.
  if (skillId === 2 || skillId === 4) {
    this.spawnMissileByKey(
      this.resolveThrowMissileKeyForCaster(caster, skillId),
      startX,
      startY,
      targetX,
      targetY,
      {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
      },
    )
    return
  }
  // 140 Double Throw (Skills.txt row 140: SrvDoFunc 74 / CltDoFunc 32 @ 0x6FAC6F10):
  // Sequential 2-event-frame throw (BASQ[8] = {TH, TH}: frame 3 -> right-hand, frame 8 -> left-hand),
  // straight along baseAngle toward (targetX, targetY) with zero fan spread (#1274).
  if (skillId === 140) {
    const handSkillId = isSecondHand ? 4 : 2
    const key = this.resolveThrowMissileKeyForCaster(caster, handSkillId)
    this.spawnMissileByKey(
      key,
      startX,
      startY,
      dx === 0 && dy === 0 ? startX + Math.cos(baseAngle) * 30 : targetX,
      dx === 0 && dy === 0 ? startY + Math.sin(baseAngle) * 30 : targetY,
      {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
      },
    )
    return
  }
  const linear = LINEAR_SKILL_MISSILES[skillId]
  if (linear) {
    const destX = dx === 0 && dy === 0 ? startX + Math.cos(baseAngle) * 10 : targetX
    const destY = dx === 0 && dy === 0 ? startY + Math.sin(baseAngle) * 10 : targetY
    const srcSkillId = skillId === 313 ? 271 : skillId === 324 ? 276 : skillId
    const mUnit = this.spawnMissileByKey(linear.key, startX, startY, destX, destY, {
      ownerType,
      ownerId,
      sourceSkillId: srcSkillId,
      skillLevel,
      pierce: linear.pierce,
    })
    if (skillId === 16 || skillId === 342) {
      mUnit.explosionMissile = 'explodingarrowexp'
      mUnit.alwaysExplode = true
    } else if (skillId === 27 || skillId === 31 || skillId === 343) {
      mUnit.alwaysExplode = true
    } else if (skillId === 25) {
      mUnit.alwaysExplode = true
    } else if (skillId === 22) {
      // SKILLS_SrvDo010 (0x6FC677F0) / SKILLS_CltDo18 (0x6FAC5C40): #22 Guided Arrow (#1292 / #1306):
      // Preserves pierce roll from spawnMissileByKey (up to 4 pierces from #33 Pierce + item_pierce).
      // Lock onto caster's living hostile targetUnit, or acquire nearest living hostile monster
      // within Param2=15 sub-tiles of the cast location.
      if (caster.targetUnit !== undefined) {
        const target = this.getUnit(caster.targetUnit.unitType, caster.targetUnit.id)
        const targetDead =
          target !== undefined &&
          (target.dead ||
            (target.unitType === 'monster' &&
              (target.mode === 0 || target.mode === 12 || (target.lifePct !== undefined && target.lifePct <= 0))))
        if (!targetDead) {
          mUnit.homingTarget = caster.targetUnit
        }
      }
      if (mUnit.homingTarget === undefined && caster.unitType !== 'monster') {
        let nearest: ClientUnit | undefined
        let bestDist = 15
        for (const m of this._monsters.values()) {
          if (m.dead || m.mode === 0 || m.mode === 12 || (m.lifePct !== undefined && m.lifePct <= 0)) continue
          if (this.isFriendlyOrNonHostileMonster(m)) continue
          const d = Math.hypot(m.x - targetX, m.y - targetY)
          if (d <= bestDist) {
            bestDist = d
            nearest = m
          }
        }
        if (nearest !== undefined) {
          mUnit.homingTarget = { unitType: 'monster', id: nearest.id }
        }
      }
    } else if (skillId === 93 || skillId === 211) {
      // SKILLS_SrvDo010 (0x6FC677F0) / SKILLS_CltDo18 (0x6FAC5C40): #93 Bone Spirit & #211 MonBoneSpirit (#1192, #1300):
      // Lock onto the caster's living target unit; for player #93 casts aimed onto a monster without targetUnit populated,
      // acquire the nearest living hostile monster within 6 sub-tiles of the cast location.
      if (caster.targetUnit !== undefined) {
        const target = this.getUnit(caster.targetUnit.unitType, caster.targetUnit.id)
        const targetDead =
          target !== undefined &&
          (target.dead ||
            (target.unitType === 'monster' &&
              (target.mode === 0 || target.mode === 12 || (target.lifePct !== undefined && target.lifePct <= 0))))
        if (!targetDead) {
          mUnit.homingTarget = caster.targetUnit
        }
      }
      if (mUnit.homingTarget === undefined && skillId === 93 && caster.unitType !== 'monster') {
        let nearest: ClientUnit | undefined
        let bestDist = 6
        for (const m of this._monsters.values()) {
          if (m.dead || m.mode === 0 || m.mode === 12 || (m.lifePct !== undefined && m.lifePct <= 0)) continue
          if (this.isFriendlyOrNonHostileMonster(m)) continue
          const d = Math.hypot(m.x - targetX, m.y - targetY)
          if (d <= bestDist) {
            bestDist = d
            nearest = m
          }
        }
        if (nearest !== undefined) {
          mUnit.homingTarget = { unitType: 'monster', id: nearest.id }
        }
      }
    }
    return
  }

  // 2a. CltDoFunc 23 Charged Bolt family (#38 Charged Bolt, #186 PrimeBolt, #306 BoltSentry, #322 ImpBolt, Issue #1164):
  // 1.13c srvdofunc[17] (0x6FC63B60) / cltdofunc[23] (0x6FB24AC0) spawns all bolts at the caster position aiming at
  // the exact same target coordinates; divergence comes from PATHTYPE_CHARGEDBOLT (0x6FDB6AA0) random-walk waypoints.
  if (skillId === 38 || skillId === 186 || skillId === 306 || skillId === 322) {
    let missileKey = 'chargedbolt'
    let count = Math.min(24, 2 + Math.max(1, skillLevel))
    let srcSkillId = skillId
    if (skillId === 186) {
      // Skills.txt #186 PrimeBolt: cltmissilea=chargedbolt, calc1=lvl+2
      missileKey = 'chargedbolt'
      count = Math.max(1, skillLevel) + 2
    } else if (skillId === 306) {
      // Skills.txt #306 BoltSentry: cltmissilea=sentrychargedbolt, calc1=ln12+skill('Shock Field'.blvl)/3 (Param1=5, Param2=0)
      const ownerPlayer =
        caster.ownerId !== undefined ? this.getUnit('player', caster.ownerId) : undefined
      const shockWebBlvl = Math.max(
        0,
        caster.stats.get(256) ??
          ownerPlayer?.stats.get(256) ??
          this._self.skillEntries?.get(256)?.baseLevel ??
          this._self.skills.get(256) ??
          0,
      )
      missileKey = 'sentrychargedbolt'
      count = 5 + Math.floor(shockWebBlvl / 3)
      srcSkillId = 261
    } else if (skillId === 322) {
      // Skills.txt #322 ImpBolt: cltmissilea='imp charged bolt', calc1=lvl+2
      missileKey = 'imp charged bolt'
      count = Math.max(1, skillLevel) + 2
    }
    const tx = dx === 0 && dy === 0 ? startX + Math.cos(baseAngle) * 20 : targetX
    const ty = dx === 0 && dy === 0 ? startY + Math.sin(baseAngle) * 20 : targetY
    for (let i = 0; i < count; i++) {
      this.spawnMissileByKey(missileKey, startX, startY, tx, ty, {
        ownerType,
        ownerId,
        sourceSkillId: srcSkillId,
        skillLevel,
        jitterIndex: i + 1,
      })
    }
    return
  }

  // 2b. Multi-projectile fan spells: Teeth (67), Multiple Shot (12)
  // Both use 1.13c Param1=2, Param2=1 (ln12 = 2 + (slvl - 1) = 1 + slvl), capped at 24.
  if (skillId === 67 || skillId === 12) {
    const missileKey =
      skillId === 67
        ? 'teeth'
        : this.isCrossbowEquipped(caster)
          ? 'multipleshotbolt'
          : 'multipleshotarrow'
    const count = Math.min(24, 1 + Math.max(1, skillLevel))
    // SKILLS_CltDo17 (0x6FAC5DA0): perpendicular fan across the target point; tooth floor(count/2)
    // aims exactly at (targetX, targetY), the others step one perpendicular unit apart.
    for (const aim of computeCltDo17FanAimPoints113c(startX, startY, targetX, targetY, count)) {
      this.spawnMissileByKey(missileKey, startX, startY, aim.x, aim.y, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
      })
    }
    return
  }

  // 3. SkillCltDoFunc 25 (0x6FB23CB0 -> 0x6FB51020(-1) -> 0x6FB50DB0): every Skills.txt row with cltdofunc 25
  // (Frost Nova 44, Nova 48, Poison Nova 92, the warcries 130/138/146/149/154/155, PrimeIceNova 190, DiabFire 195,
  // Baal Nova 316, MephFrostNova 346, Trap Nova 353) fires 64 cltmissilea around the caster from the 64-entry
  // radius-30 table, velocity = Vel + VelLev*lvl/8 + cltcalc1, lifetime = Missiles.txt Range + LevRange*lvl.
  const cltDo25 = getCltDo25Skill113c(skillId)
  if (cltDo25 !== undefined) {
    const ringMissile = getMissileTxtData(cltDo25.cltMissileA)
    spawnCltDo25Ring113c(this, cltDo25.cltMissileA, startX, startY, cltDo25Velocity113c(cltDo25, ringMissile, skillLevel), {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
    })
    // The warcries continue to section 8 for their states / cast overlays; the ring itself is complete here.
    if (!CLTDO25_WARCRY_SKILLS.has(skillId)) return
  }

  // 4. Spiral trajectory: Blessed Hammer (112)
  if (skillId === 112) {
    const tx = dx === 0 && dy === 0 ? startX + 8 : targetX
    const ty = dx === 0 && dy === 0 ? startY : targetY
    this.spawnMissileByKey('blessedhammer', startX, startY, tx, ty, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
      pierce: true,
      originX: startX,
      originY: startY,
      spiralAngle: baseAngle,
      spiralRadius: 0,
    })
    return
  }

  // 5. Sub-missile emitter: Frozen Orb (64)
  if (skillId === 64) {
    const tx = dx === 0 && dy === 0 ? startX + 16 : targetX
    const ty = dx === 0 && dy === 0 ? startY : targetY
    this.spawnMissileByKey('frozenorb', startX, startY, tx, ty, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
      pierce: true,
      emitterKind: 'frozenorb',
    })
    return
  }

  // 6. Ground / Skyfall / Instant-target spells
  // Static Field (#42) & Telekinesis (#43): 1.13c Skills.txt has an EMPTY tgtoverlay for
  // both — no target overlay is attached client-side (the old 'staticfield' /
  // 'telekinesis' attachments were invented tokens absent from Overlay.txt and aborted
  // the render loop via pushOverlayLight, Issue #955). Static Field's caster visual is
  // its real castOverlay 'light_cast_1', applied by the generic cast path.

  if (skillId === 46) {
    // #46 Blaze: Skills.txt aurastate=blaze -> States.txt id 13 (id 12 is 'inferno', nosend=1).
    // Duration = auralencalc dm12 over Skills.txt Param1=50 / Param2=500 (frames).
    // Patch lifetime derives from Missiles.txt blaze Range=90 + LevRange=25 * slvl.
    caster.states.add(BLAZE_STATE_ID_113C)
    caster.lastBlazeX = startX
    caster.lastBlazeY = startY
    caster.skillLevel = Math.max(1, skillLevel)
    caster.blazeSkillLevel = skillLevel
    caster.blazeUntilTick = this.frameCount + blazeStateDurationFrames113c(skillLevel)
    const b = this.spawnMissileByKey('blaze', startX, startY, startX, startY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
    })
    b.vx = 0
    b.vy = 0
    return
  }

  if (skillId === 52) {
    // #52 Enchant: Skills.txt TargetAlly=1, TargetPet=1, aurastate=enchant (16);
    // States.txt row 16 castoverlay=enchant (one-shot).
    const enchantTarget = resolveEnchantTargetUnit113c(this, caster, targetX, targetY)
    applyEnchantStateToTarget113c(this, enchantTarget, true)
    return
  }

  if (skillId === 51 || skillId === 170 || skillId === 188 || skillId === 321) {
    // 1.13c SkillCltDoFunc[26] (0x6FB24770, Issue #1169):
    // - #51 Fire Wall: cltmissilea='firewallmaker' (#82, Range=7, LevRange=2, CltSubMissile1='firewall' #83 Range=90)
    // - #170 VampireFirewall / #188 PrimeFirewall: cltmissilea='vampirefirewallmaker' (#130, Range=10, LevRange=0, CltSubMissile1='vampirefirewall' #131 Range=90)
    // - #321 CountessFirewall: cltmissilea='countessfirewallmaker' (#525, Range=7, LevRange=0, CltSubMissile1='countessfirewall' #526 Range=1000, LevRange=1)
    const slvl = Math.max(1, skillLevel)
    const makerKey =
      skillId === 170 || skillId === 188
        ? 'vampirefirewallmaker'
        : skillId === 321
          ? 'countessfirewallmaker'
          : 'firewallmaker'
    const centerKey =
      skillId === 170 || skillId === 188
        ? 'vampirefirewall'
        : skillId === 321
          ? 'countessfirewall'
          : 'firewall'
    const makerRow = getMissileTxtData(makerKey)
    const centerRow = getMissileTxtData(centerKey)
    const makerRange = makerRow.range + (makerRow.levRange ?? 0) * slvl
    const centerRange = centerRow.range + (centerRow.levRange ?? 0) * Math.max(0, slvl - 1)
    const centerWall = this.spawnMissileByKey(centerKey, targetX, targetY, targetX, targetY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel: slvl,
      maxTicks: centerRange,
    })
    centerWall.vx = 0
    centerWall.vy = 0
    for (const sign of [-1, 1] as const) {
      const perpAngle = baseAngle + sign * (Math.PI / 2)
      const destX = targetX + Math.cos(perpAngle) * 32
      const destY = targetY + Math.sin(perpAngle) * 32
      const maker = this.spawnMissileByKey(makerKey, targetX, targetY, destX, destY, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel: slvl,
        maxTicks: makerRange,
        pierce: true,
      })
      maker.vx = Math.cos(perpAngle) * 0.9
      maker.vy = Math.sin(perpAngle) * 0.9
    }
    return
  }

  if (skillId === 56 || skillId === 171) {
    // #56 Meteor / #171 VampireMeteor (Issue #1170):
    // 1.13c Skills.txt srvmissile/cltmissilea = meteorcenter (#101, Range=60) or vampiremeteorcenter (#133, Range=60).
    // spawnMissileByKey expands ClientSubMissile1 ('meteor'/'vampiremeteor') and ClientSubMissile2 ('meteortail')
    // along the 59-tick 3D trajectory (fallrate=25, sliderate=15) per MISSMODE_CltDo09_MeteorCenter (0x6fb68f00).
    const centerKey = skillId === 171 ? 'vampiremeteorcenter' : 'meteorcenter'
    this.spawnMissileByKey(centerKey, targetX, targetY, targetX, targetY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
      maxTicks: 60,
    })
    return
  }

  if (skillId === 59) {
    // Blizzard (#59): 1.13c Skills.txt cltdofunc=28 (0x6FB24010) spawns only cltmissilea='blizzardcenter' (#158).
    // Falling blizzard1..4 shards (#159..162) are emitted by blizzardcenter CltDo13 (0x6FB6BC10, Issue #1113).
    this.spawnMissileByKey('blizzardcenter', targetX, targetY, targetX, targetY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
      emitterKind: 'blizzard_controller',
      maxTicks: 100,
    })
    return
  }

  if (skillId === 205) {
    // #205 MonBlizzard (1.13c Skills.txt cltdofunc=28 @ 0x6FB24010, cltmissilea='monblizcenter' #106, Issue #1171):
    // Missiles.txt #106 monblizcenter: Range=25, LevRange=15, pCltDoFunc=10 (0x6FB6BD40),
    // CltParam1=5, CltParam2=8, CltParam3=4, CltSubMissile1='monbliz1' (#107), CltSubMissile2='monbliz4' (#110).
    const slvl = Math.max(1, skillLevel)
    const maxTicks = 25 + 15 * (slvl - 1)
    this.spawnMissileByKey('monblizcenter', targetX, targetY, targetX, targetY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel: slvl,
      maxTicks,
    })
    const initShardKey = (SEED_RollRandomNumber(caster.seed) & 1) === 0 ? 'monbliz1' : 'monbliz4'
    const shard = this.spawnMissileByKey(initShardKey, targetX, targetY, targetX, targetY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel: slvl,
      maxTicks: 9,
      altitude: 120,
    })
    shard.vx = 0
    shard.vy = 0
    shard.alwaysExplode = true
    return
  }

  const cltDo32 = CLT_DO32_CORPSE_EXPLOSION_113C[skillId]
  if (cltDo32 !== undefined) {
    // Corpse Explosion (#74) / NihlathakCorpseExplosion (#351)
    // (SkillSrvDoFunc[31] / SkillCltDoFunc[32] 0x6FB78FB0 -> 0x6FB78CE0):
    // Marks consumed corpse with STATE_CORPSE_NODRAW (104) and spawns cltmissilea=corpseexplosion,
    // cltmissileb=explodingarrowexp, cltmissilec=redlightmissile (#151, Light=5, Range=10), plus 6 bigblood1/bigblood2.
    let corpseUnit: ClientUnit | undefined
    let bestDistSq = 16 // 4 subtiles radius squared
    for (const m of this._monsters.values()) {
      if (!m.dead && m.mode !== 0 && m.mode !== 12 && m.lifePct > 0) continue
      if (
        m.states.has(99) ||
        m.states.has(104) ||
        m.states.has(107) ||
        m.states.has(118) ||
        m.states.has(173)
      ) {
        continue
      }
      const dx = m.x - targetX
      const dy = m.y - targetY
      const dSq = dx * dx + dy * dy
      if (dSq <= bestDistSq) {
        bestDistSq = dSq
        corpseUnit = m
      }
    }
    if (corpseUnit) {
      corpseUnit.states.add(104)
    }
    const cx = corpseUnit ? corpseUnit.x : targetX
    const cy = corpseUnit ? corpseUnit.y : targetY
    this.spawnMissileByKey(cltDo32.cltMissileA, cx, cy, cx, cy, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
    })
    this.spawnMissileByKey(cltDo32.cltMissileB, cx, cy, cx, cy, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
    })
    this.spawnMissileByKey(cltDo32.cltMissileC, cx, cy, cx, cy, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel: 1,
      maxTicks: getMissileTxtData(cltDo32.cltMissileC).range,
    })
    if (corpseUnit) {
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3
        const gx = cx + Math.cos(angle) * 2
        const gy = cy + Math.sin(angle) * 2
        this.spawnMissileByKey(i % 2 === 0 ? 'bigblood1' : 'bigblood2', cx, cy, gx, gy, {
          ownerType,
          ownerId,
          sourceSkillId: skillId,
          maxTicks: 16,
        })
      }
    }
    return
  }

  if (skillId === 214) {
    // 1.13c Skills.txt #214 RegurgitatorEat (cltdofunc=63 @ 0x6FB08A70, cltmissilea='corpseexplosion' #115, cltmissileb='bigblood1' #20, Issue #1180):
    // Consumes the target corpse (marks STATE_CORPSE_NODRAW = 104) and spawns 1..2 'corpseexplosion'
    // (0x6FB52380(1, &param, 2)) + 5..8 'bigblood1' (0x6FB52380(5, &param, 4)) at the corpse position.
    let corpseUnit: ClientUnit | undefined
    let bestDistSq = 16 // 4 subtiles radius squared
    for (const m of this._monsters.values()) {
      if (!m.dead && m.mode !== 0 && m.mode !== 12 && m.lifePct > 0) continue
      if (
        m.states.has(99) ||
        m.states.has(104) ||
        m.states.has(107) ||
        m.states.has(118) ||
        m.states.has(173)
      ) {
        continue
      }
      const cdx = m.x - targetX
      const cdy = m.y - targetY
      const dSq = cdx * cdx + cdy * cdy
      if (dSq <= bestDistSq) {
        bestDistSq = dSq
        corpseUnit = m
      }
    }
    if (corpseUnit) {
      corpseUnit.states.add(104)
    }
    const cx = corpseUnit ? corpseUnit.x : targetX
    const cy = corpseUnit ? corpseUnit.y : targetY
    const ceCount = 1 + SEED_RollLimitedRandomNumber(caster.seed, 2)
    for (let i = 0; i < ceCount; i++) {
      const ce = this.spawnMissileByKey('corpseexplosion', cx, cy, cx, cy, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
      })
      ce.vx = 0
      ce.vy = 0
    }
    const bloodCount = 5 + SEED_RollLimitedRandomNumber(caster.seed, 4)
    for (let i = 0; i < bloodCount; i++) {
      const angle = (i * Math.PI * 2) / bloodCount
      const gx = cx + Math.cos(angle) * 2
      const gy = cy + Math.sin(angle) * 2
      this.spawnMissileByKey('bigblood1', cx, cy, gx, gy, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
        maxTicks: 16,
      })
    }
    return
  }

  if (skillId === 83) {
    // Poison Explosion (Skills.txt cltdofunc=33, SKILLS_CltDo33 0x6FB78C90 -> 0x6FB78710):
    // cltmissilea=poisoncorpseexplosion at the corpse, cltmissilec=greenlightmissile, then the
    // 0x6FB66BC0 ring of cltmissileb=poisonexplosioncloud on the 8 even entries of the radius-2
    // 16-point table, drifting outward at Param1<<7. The server (SrvDo063 0x6FC70190) toggles
    // STATE_CORPSE_NOSELECT (118, not hide) on the corpse; the prediction marks it unselectable.
    let corpseUnit: ClientUnit | undefined
    let bestDistSq = 16 // 4 subtiles radius squared
    for (const m of this._monsters.values()) {
      if (!m.dead && m.mode !== 0 && m.mode !== 12 && m.lifePct > 0) continue
      if (
        m.states.has(99) ||
        m.states.has(104) ||
        m.states.has(107) ||
        m.states.has(118) ||
        m.states.has(173)
      ) {
        continue
      }
      const dx = m.x - targetX
      const dy = m.y - targetY
      const dSq = dx * dx + dy * dy
      if (dSq <= bestDistSq) {
        bestDistSq = dSq
        corpseUnit = m
      }
    }
    if (corpseUnit) {
      corpseUnit.states.add(118)
    }
    const cx = corpseUnit ? corpseUnit.x : targetX
    const cy = corpseUnit ? corpseUnit.y : targetY
    this.spawnMissileByKey('poisoncorpseexplosion', cx, cy, cx, cy, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
    })
    this.spawnMissileByKey('greenlightmissile', cx, cy, cx, cy, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
    })
    const cloudSpeed = ringMissileSpeedSubTilesPerTick113c(POISONEXPLOSIONCLOUD_113C.param1)
    for (const off of poisonExplosionCloudOffsets113c()) {
      const cloud = this.spawnMissileByKey('poisonexplosioncloud', cx, cy, cx + off.x, cy + off.y, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
        // Missiles.txt poisonexplosioncloud: CollideKill=0 — unit collisions do not end it.
        pierce: true,
      })
      const len = Math.hypot(off.x, off.y)
      cloud.vx = (off.x / len) * cloudSpeed
      cloud.vy = (off.y / len) * cloudSpeed
    }
    return
  }

  if (skillId === 96) {
    // #96 Sacrifice: SkillCltDoFunc[34] (D2Client.dll 0x6FADB530).
    // Skills.txt row 96: castoverlay='', tgtoverlay='', cltdofunc=34, cltmissilea=blood1 (#18), cltcalc1=3.
    // 0x6FADB59B calls 0x6FB55F70 to resolve the target unit; if NULL, returns 0 without spawning a missile.
    let targetMon: ClientUnit | undefined
    if (
      caster.targetUnit &&
      (caster.targetUnit.unitType === 'monster' || (caster.targetUnit.unitType as unknown) === 1)
    ) {
      const cand = this.getUnit('monster', caster.targetUnit.id)
      if (
        cand &&
        !cand.dead &&
        (cand.lifePct === undefined || cand.lifePct > 0) &&
        !this.isFriendlyOrNonHostileMonster(cand)
      ) {
        targetMon = cand
      }
    }
    if (!targetMon) {
      let bestDist = 4
      for (const m of this._monsters.values()) {
        if (m.dead || (m.lifePct !== undefined && m.lifePct <= 0) || this.isFriendlyOrNonHostileMonster(m)) continue
        const d = Math.min(Math.hypot(m.x - targetX, m.y - targetY), Math.hypot(m.x - startX, m.y - startY))
        if (d <= bestDist) {
          bestDist = d
          targetMon = m
        }
      }
    }
    if (!targetMon) {
      return
    }
    // 0x6FADB612..0x6FADB63E: cltcalc1 = 3 -> missileId = 18 + SEED_RollLimitedRandomNumber(&caster.seed, 3) (blood1 #18, blood2 #19, bigblood1 #20).
    const bloodKeys = ['blood1', 'blood2', 'bigblood1'] as const
    const cltCalc1 = 3
    const missileOffset = SEED_RollLimitedRandomNumber(caster.seed, cltCalc1)
    const missileClassId = 18 + missileOffset
    const bloodKey = bloodKeys[missileOffset] ?? 'blood1'
    // 0x6FADB5A8..0x6FADB60C: octant direction + [-1..+1] jitter via 0x6FB86A90 / 0x6FB86A70 offset tables.
    const offsetXTable = [0, -1, -2, -1, 0, 1, 2, 1] as const
    const offsetYTable = [2, 1, 0, -1, -2, -1, 0, 1] as const
    const dir64 =
      targetX !== startX || targetY !== startY
        ? dir64FromPoints(startX, startY, targetX, targetY, 0)
        : dir64FromPoints(startX, startY, targetMon.x, targetMon.y, 0)
    const dir8 = (dir64 >> 3) & 7
    const jitter = SEED_RollLimitedRandomNumber(caster.seed, 3)
    const octant = (((dir8 + 4) & 7) + jitter - 1) & 7
    const aimX = targetMon.x + offsetXTable[octant]!
    const aimY = targetMon.y + offsetYTable[octant]!
    this.spawnMissileByKey(bloodKey, targetMon.x, targetMon.y, aimX, aimY, {
      classId: missileClassId,
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
    })
    return
  }

  if (skillId === 97) {
    // #97 Smite (Skills.txt row 97: SrvDoFunc 73 single-target shield bash; no client columns or overlays in 1.13c.
    // Stun state 21 -> 'stun' overlay comes exclusively from the server via StateSet/StateEnd, Issue #1076).
    return
  }

  if (skillId === 106) {
    // #106 Zeal: multi-strike melee attack (no client missile)
    return
  }

  if (skillId === 107) {
    // #107 Charge (Skills.txt row 107: SrvDoFunc 67 / CltDoFunc 37; no tgtoverlay/castoverlay/srvoverlay or cltmissile in 1.13c, Issue #1167).
    return
  }

  if (skillId === 111) {
    // #111 Vengeance (Skills.txt row 111: SrvDoFunc 71; no client overlay or missile in 1.13c, Issue #1075).
    return
  }

  if (skillId === 116) {
    // #116 Conversion (Skills.txt row 116: SrvDoFunc 79; state 53 conversion -> 'conversionaura' via STATE_OVERLAYS, Issue #1074).
    return
  }

  if (skillId === 117) {
    // #117 Holy Shield (Skills.txt row 117: SrvDoFunc 77; state 101 holyshield sets sh='bsh' via StateSetFunc[11], with no Overlay.txt row, Issue #1073 / #1278).
    caster.states.add(101)
    if (caster.unitType === 'player' && (caster.id === this.selfId || this.selfId === 0)) {
      this._self.states.add(101)
    }
    return
  }

  if (skillId === 121) {
    // #121 Fist of the Heavens (Skills.txt row 121: SkillCltDoFunc[36] 0x6FADBD20, cltmissilea=fistoftheheavensdelay #233, srvoverlay=handofgod #158, Issue #1281).
    let targetMon: ClientUnit | undefined
    if (
      caster.targetUnit &&
      (caster.targetUnit.unitType === 'monster' || caster.targetUnit.unitType === 1)
    ) {
      const explicitMon = this.getUnit('monster', caster.targetUnit.id)
      if (explicitMon && !explicitMon.dead && !this.isFriendlyOrNonHostileMonster(explicitMon)) {
        targetMon = explicitMon
      }
    }
    if (!targetMon) {
      let bestDist = 4
      for (const m of this._monsters.values()) {
        if (m.dead || this.isFriendlyOrNonHostileMonster(m)) continue
        const d = Math.hypot(m.x - targetX, m.y - targetY)
        if (d <= bestDist) {
          bestDist = d
          targetMon = m
        }
      }
    }
    if (targetMon) {
      const hasRecentHandOfGod = targetMon.overlays.some(
        (o) => o.token === 'handofgod' && (o.ageTicks ?? 0) <= 10,
      )
      if (!hasRecentHandOfGod) {
        this.attachUnitOverlay(targetMon, 'handofgod', false)
      }
    }
    const tx = targetMon ? targetMon.x : targetX
    const ty = targetMon ? targetMon.y : targetY
    const foa = this.spawnMissileByKey('fistoftheheavensdelay', tx, ty, tx, ty, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
    })
    foa.vx = 0
    foa.vy = 0
    return
  }

  if (skillId === 70 || skillId === 80 || skillId === 95) {
    // Necromancer corpse summons (1.13c SkillCltStFunc[14] 0x6FB784E0 & SkillCltStFunc[24] 0x6FB78620).
    // Find the targeted corpse at (targetX, targetY) and mark STATE_CORPSE_NODRAW (104) so the
    // corpse visually disappears and cannot be re-targeted.
    let corpseUnit: ClientUnit | undefined
    let fallbackCorpseUnit: ClientUnit | undefined
    let bestDistSq = 100
    let bestFallbackDistSq = 100
    for (const m of this._monsters.values()) {
      if (!(m.dead || m.mode === 0 || m.mode === 12 || m.lifePct <= 0)) continue
      if (m.states.has(99) || m.states.has(104) || m.states.has(107) || m.states.has(118) || m.states.has(173)) {
        continue
      }
      if (skillId === 95) {
        if (
          m.states.has(96) ||
          m.isUnique ||
          m.isChampion ||
          m.isSuperUnique ||
          (m as any).revivable === false
        ) {
          continue
        }
      }
      const dSq = (m.x - targetX) ** 2 + (m.y - targetY) ** 2
      if (
        skillId === 95 &&
        Number.isInteger(m.classId) &&
        m.classId >= 0 &&
        m.classId < 734 &&
        !hasMonStats2Flag(m.classId, MONSTATS2_FLAGINDEX.REVIVE)
      ) {
        if (dSq <= bestFallbackDistSq) {
          bestFallbackDistSq = dSq
          fallbackCorpseUnit = m
        }
        continue
      }
      if (dSq <= bestDistSq) {
        bestDistSq = dSq
        corpseUnit = m
      }
    }
    if (!corpseUnit && fallbackCorpseUnit) {
      corpseUnit = fallbackCorpseUnit
    }
    if (corpseUnit && skillId !== 95) {
      // SKILLS_CltDo31 (0x6FB788A0): Raise Skeleton / Skeletal Mage consume the corpse.
      // Revive (#95, SKILLS_CltSt24 0x6FB78620) never touches the corpse states client-side:
      // the server resurrects the SAME unitId in place (SKILLS_SrvDo058) and sends STATE_REVIVE (96).
      corpseUnit.states.add(104)
    }
    const cx = corpseUnit ? corpseUnit.x : targetX
    const cy = corpseUnit ? corpseUnit.y : targetY
    if (skillId === 70 || skillId === 80) {
      // cltmissilea = corpseexplosion (MissileCltDoFunc[11] 0x6FB62DC0 spawns 6 flying gore chunks)
      this.spawnMissileByKey('corpseexplosion', cx, cy, cx, cy, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
      })
      if (corpseUnit) {
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3
          const gx = cx + Math.cos(angle) * 2
          const gy = cy + Math.sin(angle) * 2
          this.spawnMissileByKey(i % 2 === 0 ? 'bigblood1' : 'bigblood2', cx, cy, gx, gy, {
            ownerType,
            ownerId,
            sourceSkillId: skillId,
            maxTicks: 16,
          })
        }
      }
    } else {
      // Revive (95, SkillCltStFunc[24] 0x6FB78620): selects exactly ONE revive missile by MonStats2 SizeX / small / large:
      // SizeX <= 1 (or small=1) -> revivesmall (#268), SizeX === 2 -> revivemedium (#269), SizeX >= 3 (or large=1) -> revivelarge (#270).
      const validClassId =
        corpseUnit && Number.isInteger(corpseUnit.classId) && corpseUnit.classId >= 0 && corpseUnit.classId < 734
          ? corpseUnit.classId
          : -1
      const sizeX = validClassId >= 0 ? getMonsterSizeXByHcIdx(validClassId) : 2
      const isSmall =
        sizeX <= 1 || (validClassId >= 0 && !hasMonStats2Flag(validClassId, MONSTATS2_FLAGINDEX.LARGE) && sizeX === 1)
      const isLarge =
        sizeX >= 3 || (validClassId >= 0 && hasMonStats2Flag(validClassId, MONSTATS2_FLAGINDEX.LARGE) && sizeX >= 3)
      const reviveMissileKey =
        isSmall ? 'revivesmall' : isLarge ? 'revivelarge' : 'revivemedium'
      this.spawnMissileByKey(reviveMissileKey, cx, cy, cx, cy, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
      })
    }
    return
  }

  // 7. CltDo30 Curses (#66..#91 Necromancer curses & #212/#309/#310 Monster curses, Issues #1165, #1166):
  // cltmissilec="cursecast" (#147) is spawned at cast start by SKILLS_CltSt18_Curse (applySkillCastToUnit)
  // or here if spawnMissilesForSkill was called directly without applySkillCastToUnit.
  // On the Do frame ONE invisible cursecenter (#191) is created at the target carrying wCltMissileA (#181..#190 or
  // #142 curseeffectred) and nVisualRadius = max(aurarangecalc - 3, 2); MISSMODE_CltDo17 (world-missile-stepper) scatters
  // the CurseArea particles on elapsed 0/3/6.
  // Local state/overlay prediction on hostile monsters ONLY applies when `caster.unitType === 'player'` (Issue #1165).
  const cltMissileA = CURSE_CLT_MISSILE_A[skillId]
  const curseStateId = CURSE_SKILL_STATES[skillId]
  if (cltMissileA !== undefined || curseStateId !== undefined) {
    if (!(caster.castState?.skillId === skillId && (caster.castState as any).cltSt18Spawned)) {
      this.spawnMissileByKey('cursecast', startX, startY, startX, startY, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel: Math.max(1, skillLevel),
      })
    }
    const radiusSubtiles = getCurseRadiusSubtiles113c(skillId, skillLevel)
    if (cltMissileA) {
      const center = this.spawnMissileByKey('cursecenter', targetX, targetY, targetX, targetY, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
        maxTicks: CURSECENTER_RANGE_113C,
      })
      center.curseSubMissileKey = cltMissileA
      center.curseVisualRadius = curseVisualRadius113c(radiusSubtiles)
    }
    if (caster.unitType !== 'player' || curseStateId === undefined) {
      return
    }
    const curseOverlay = CURSE_TARGET_OVERLAYS[skillId]
    const isAiCurse = skillId === 71 || skillId === 77 || skillId === 81 || skillId === 86
    const candidates: ClientUnit[] = []
    for (const m of this._units.values()) {
      if (m.unitType !== 'monster' || m.dead) continue
      if (this.isFriendlyOrNonHostileMonster(m)) continue
      if (!canMonsterClassBeCursed113c(m.classId)) continue
      if (isAiCurse && (m.isUnique || m.isChampion || m.isSuperUnique)) continue
      if (Math.hypot(m.x - targetX, m.y - targetY) <= radiusSubtiles) {
        candidates.push(m)
      }
    }
    if (curseStateId === 57) {
      // #86 Attract (SkillDo035_Attract, cursetype=2, TargetableOnly=1): single closest hostile target
      candidates.sort(
        (a, b) => Math.hypot(a.x - targetX, a.y - targetY) - Math.hypot(b.x - targetX, b.y - targetY),
      )
      const targetMon = candidates[0]
      if (targetMon && !targetMon.states.has(57)) {
        for (const s of ALL_TYPE1_CURSE_STATES) {
          targetMon.states.remove(s)
        }
        targetMon.overlays = targetMon.overlays.filter(
          (o) => !ALL_CURSE_TARGET_OVERLAY_SET.has(o.token),
        )
        const attractOnSound = stateOnSoundRequest113c(targetMon, 57, false)
        if (attractOnSound) this.pushSoundRequest(attractOnSound)
        targetMon.states.add(57)
        playStateCastOverlay113c(this, targetMon, 57)
        if (curseOverlay) {
          this.attachUnitOverlay(targetMon, curseOverlay, true)
        }
      }
    } else {
      for (const m of candidates) {
        // Standard type-1 curse: cannot overwrite Attract (state 57, cursetype=2)
        if (m.states.has(57)) continue
        const wasAlreadyCursed = m.states.has(curseStateId)
        // D2Client 0x6fb23760: onsound only on the inactive -> active transition (a refresh is silent).
        const curseOnSound = stateOnSoundRequest113c(m, curseStateId, wasAlreadyCursed)
        for (const s of ALL_TYPE1_CURSE_STATES) {
          m.states.remove(s)
        }
        m.overlays = m.overlays.filter((o) => !ALL_CURSE_TARGET_OVERLAY_SET.has(o.token))
        if (curseOnSound) this.pushSoundRequest(curseOnSound)
        m.states.add(curseStateId)
        if (!wasAlreadyCursed) {
          playStateCastOverlay113c(this, m, curseStateId)
        }
        if (curseOverlay) {
          this.attachUnitOverlay(m, curseOverlay, true)
        }
      }
    }
    return
  }

  // 8. Barbarian Warcries: the 64-missile shockwave ring was fired by the CltDoFunc 25 path (section 3); here only
  // the cast overlays / states.
  if (skillId === 130 || skillId === 138 || skillId === 146 || skillId === 149 || skillId === 155) {
    if (skillId === 130) {
      for (const m of this._units.values()) {
        if (
          m.unitType === 'monster' &&
          !m.dead &&
          !this.isFriendlyOrNonHostileMonster(m) &&
          canMonsterClassBeCursed113c(m.classId) &&
          Math.hypot(m.x - caster.x, m.y - caster.y) <= 12
        ) {
          const wasSet = m.states.has(56)
          m.states.add(56)
          if (!wasSet) playStateCastOverlay113c(this, m, 56)
          this.attachUnitOverlay(m, 'curseterror', false)
        }
      }
    } else if (skillId === 138) {
      const wasSet = caster.states.has(26)
      caster.states.add(26)
      if (!wasSet) playStateCastOverlay113c(this, caster, 26)
    } else if (skillId === 149) {
      const wasSet = caster.states.has(32)
      caster.states.add(32)
      if (!wasSet) playStateCastOverlay113c(this, caster, 32)
    } else if (skillId === 155) {
      const wasSet = caster.states.has(51)
      caster.states.add(51)
      if (!wasSet) playStateCastOverlay113c(this, caster, 51)
    } else if (skillId === 146) {
      for (const m of this._monsters.values()) {
        if (
          !m.dead &&
          !this.isFriendlyOrNonHostileMonster(m) &&
          canMonsterClassBeCursed113c(m.classId) &&
          Math.hypot(m.x - caster.x, m.y - caster.y) <= 8
        ) {
          const wasSet = m.states.has(89)
          m.states.add(89)
          if (!wasSet) playStateCastOverlay113c(this, m, 89)
          this.attachUnitOverlay(m, 'battlecry', false)
        }
      }
    }
    return
  }

  if (skillId === 154) {
    // War Cry: the 64 'warcry' ring missiles come from CltDoFunc 25 (section 3); States.txt 'stunned' (id 21; 28 is
    // conviction). Stun length = Skills.txt Param1 + (lvl - 1) * Param2 (SrvDmg07_Warcry_ShockWave). The 'stun'
    // overlay is drawn by States.txt stunned overlay1, not attached by hand.
    for (const m of this._monsters.values()) {
      if (!m.dead && !(m as any).isBoss && Math.hypot(m.x - caster.x, m.y - caster.y) <= 8) {
        addPredictedTimedState113c(m, STUNNED_STATE_ID_113C, this.frameCount + warCryStunFrames113c(skillLevel))
      }
    }
    return
  }

  if (skillId === 131 || skillId === 142) {
    // 1.13c Skills.txt #131 Find Potion / #142 Find Item (SrvDoFunc=99 / CltDoFunc=59):
    // Consume corpse (states 118 corpse_nodraw), no missile / overlay / sound fields in Skills.txt.
    let bestCorpse: any = null
    let bestDist = 12
    for (const m of this._monsters.values()) {
      if (!m.dead || m.states.has(104) || m.states.has(118)) continue
      if (skillId === 131 && (m as any).isSoft === false) continue
      const d = Math.hypot(m.x - targetX, m.y - targetY)
      if (d <= bestDist) {
        bestDist = d
        bestCorpse = m
      }
    }
    if (bestCorpse) {
      bestCorpse.states.add(118)
    }
    return
  }

  if (skillId === 137) {
    // Taunt: single-target hostile non-boss monster
    let bestTarget: ClientUnit | undefined
    let bestDist = 12
    for (const m of this._monsters.values()) {
      if (m.dead || m.id === caster.id || this.isFriendlyOrNonHostileMonster(m) || (m as any).isBoss) continue
      const d = Math.hypot(m.x - targetX, m.y - targetY)
      if (d <= bestDist) {
        bestDist = d
        bestTarget = m
      }
    }
    if (bestTarget) {
      bestTarget.states.add(27)
      this.attachUnitOverlay(bestTarget, 'taunt', false)
    }
    return
  }

  // Barbarian Combat Skills (#126 Bash, #132 Leap, #139 Stun, #143 Leap Attack, #144 Concentrate, #147 Frenzy, #151 Whirlwind, #152 Berserk)
  if (skillId === 126) {
    // 1.13c Skills.txt #126 Bash has no srvoverlay, tgtoverlay, or cltoverlay ('bash' belongs to #143 Leap Attack srvoverlay, Issue #1079)
    return
  }

  if (skillId === 139) {
    if (caster.unitType !== 'player') return
    const bestTarget = findHostileMeleeTargetMonster113c(this, caster, targetX, targetY, 4)
    if (bestTarget) {
      // States.txt #21 stunned (overlay1='stun') renders via STATE_OVERLAYS[21]; do not duplicate in unit.overlays (#1079)
      bestTarget.states.add(21)
    }
    return
  }

  if (skillId === 132 || skillId === 143) {
    // 1.13c Skills.txt #132 Leap / #143 Leap Attack (SrvDoFunc 77/78, CltDoFunc 43/44, Issue #1167):
    // Position displacement, knockback, and #143 srvoverlay='bash' are server-authoritative; client never
    // teleports units, pushes monster allies, or attaches 'bash' client-side.
    if (caster.unitType === 'player') {
      this.attachUnitOverlay(caster, 'dust', false)
    }
    return
  }

  if (skillId === 144) {
    // 1.13c Skills.txt #144 Concentrate: aurastate=concentrate (15) on caster, srvoverlay='doubledamage1' on hit target (#1080)
    caster.states.add(15)
    if (caster.unitType === 'player' && (caster.id === this.selfId || this.selfId === 0)) {
      this._self.states.add(15)
    }
    if (caster.unitType !== 'player') return
    const bestTarget = findHostileMeleeTargetMonster113c(this, caster, targetX, targetY, 4)
    if (bestTarget) {
      this.attachUnitOverlay(bestTarget, 'doubledamage1', false)
    }
    return
  }

  if (skillId === 147) {
    caster.states.add(94)
    if (caster.unitType === 'player' && (caster.id === this.selfId || this.selfId === 0)) {
      this._self.states.add(94)
    }
    this.attachUnitOverlay(caster, 'frenzy', true)
    return
  }

  if (skillId === 151) {
    if (!caster.castState || caster.castState.skillId === 151) {
      caster.states.add(174)
      if (caster.unitType === 'player' && (caster.id === this.selfId || this.selfId === 0)) {
        this._self.states.add(174)
      }
    }
    this.attachUnitOverlay(caster, 'whirlwind', false)
    return
  }

  if (skillId === 152) {
    caster.states.add(95)
    if (caster.unitType === 'player' && (caster.id === this.selfId || this.selfId === 0)) {
      this._self.states.add(95)
    }
    this.attachUnitOverlay(caster, 'berserkfront', false)
    this.attachUnitOverlay(caster, 'berserkback', false)
    return
  }

  if (skillId === 150) {
    // 1.13c Skills.txt #150 Grim Ward (SrvDoFunc=107 / CltDoFunc=64):
    // Consume soft corpse (states 104 nodraw + 118 corpse_nodraw), select cltmissilea/b/c by MonStats2 small/large flags,
    // and spawn ONLY the start missile (Range=5 for smallstart, Range=8 for mediumstart/largestart), which chains via pCltHitFunc=29
    // to grimwardsmall/medium/large (Range=200) -> grimwardsmallstop/mediumstop/largestop (Range=9).
    let bestCorpse: any = null
    let bestDist = 12
    for (const m of this._monsters.values()) {
      if (!m.dead || m.states.has(104) || m.states.has(118) || (m as any).isSoft === false) continue
      const d = Math.hypot(m.x - targetX, m.y - targetY)
      if (d <= bestDist) {
        bestDist = d
        bestCorpse = m
      }
    }
    const wardX = bestCorpse ? bestCorpse.x : targetX
    const wardY = bestCorpse ? bestCorpse.y : targetY
    if (bestCorpse) {
      bestCorpse.states.add(104)
      bestCorpse.states.add(118)
    }
    const corpseClassId = bestCorpse ? bestCorpse.classId : -1
    const isLargeCorpse =
      (corpseClassId >= 0 && hasMonStats2Flag(corpseClassId, MONSTATS2_FLAGINDEX.LARGE)) ||
      (bestCorpse && (bestCorpse as any).sizeX === 3)
    const isSmallCorpse =
      !isLargeCorpse &&
      ((corpseClassId >= 0 && hasMonStats2Flag(corpseClassId, MONSTATS2_FLAGINDEX.SMALL)) ||
        (bestCorpse && (bestCorpse as any).sizeX === 1))
    const startKey = isLargeCorpse
      ? 'grimwardlargestart'
      : isSmallCorpse
        ? 'grimwardsmallstart'
        : 'grimwardmediumstart'
    const gwStart = this.spawnMissileByKey(startKey, wardX, wardY, wardX, wardY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
      loopAnim: false,
    })
    gwStart.vx = 0
    gwStart.vy = 0
    return
  }

  // 9. Druid Elemental Missiles (1.13c Skills.txt #225-#250)
  if (skillId === 225) {
    // #225 Firestorm (SrvDoFunc=113 / CltDoFunc=72): 3 weaving S-curve firestormmaker trails (Missiles.txt Range=40)
    const angles = [-0.25, 0, 0.25]
    const fBaseAngle = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx)
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i]!
      const destX = caster.x + Math.cos(fBaseAngle + a) * 15
      const destY = caster.y + Math.sin(fBaseAngle + a) * 15
      this.spawnMissileByKey('firestormmaker', caster.x, caster.y, destX, destY, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
        pierce: true,
        jitterIndex: i,
      })
    }
    return
  }

  if (skillId === 229) {
    // #229 Molten Boulder (SrvDoFunc=116 / CltDoFunc=75): spawn moltenboulderemerge (Missiles.txt #514, Range=5, Vel=9),
    // which chains on hit/expiry (pCltHitFunc=53) to CltHitSubMissile1='moltenboulder' (#299, Range=100).
    const destX = dx === 0 && dy === 0 ? caster.x + 10 : targetX
    const destY = dx === 0 && dy === 0 ? caster.y : targetY
    this.spawnMissileByKey('moltenboulderemerge', caster.x, caster.y, destX, destY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
      loopAnim: false,
    })
    return
  }

  if (skillId === 230) {
    // #230 Arctic Blast (SrvDoFunc=117 / CltDoFunc=28 @ 0x6FB784F0): continuous cold stream (Range = floor((35 + (slvl - 1) * 6) / 2)).
    // Skills.txt castoverlay is empty; prgoverlay='arctic_blast_cast' is attached once at cast start via CltStFunc=15.
    if (caster.castState?.skillId !== 230) {
      const abRange = arcticBlastRangeFrames113c(skillLevel)
      const cosA = Math.cos(baseAngle)
      const sinA = Math.sin(baseAngle)
      const sx = caster.x + cosA * 0.5
      const sy = caster.y + sinA * 0.5
      const tx = sx + cosA * 16
      const ty = sy + sinA * 16
      const m1 = this.spawnMissileByKey('arcticblast1', sx, sy, tx, ty, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
        maxTicks: abRange,
        pierce: true,
      })
      m1.animSpeed = Math.max(1, Math.floor((16 * 16) / abRange))
    }
    return
  }

  if (skillId === 234) {
    // #234 Fissure / Eruption (SrvDoFunc=118 / CltDoFunc=76): spawn 'erruption center' (Range=80) at target
    const center = this.spawnMissileByKey('erruption center', targetX, targetY, targetX, targetY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
    })
    center.vx = 0
    center.vy = 0
    return
  }

  if (skillId === 235) {
    // #235 Cyclone Armor (SrvDoFunc=18, state 151): StateSetFunc[8] 0x6FB23090 draws staged cyclonearmor1front..3front via state 151 (#1081)
    caster.states.add(151)
    if (caster.unitType === 'player' && (caster.id === this.selfId || this.selfId === 0)) {
      this._self.states.add(151)
    }
    return
  }

  if (skillId === 232) {
    // #232 Feral Rage (SrvDoFunc=56, state 120, setfunc=16): progressive red charge orb (feralrage1..5 + feralrage1back..5back)
    caster.states.add(120)
    if (caster.unitType === 'player' && (caster.id === this.selfId || this.selfId === 0)) {
      this._self.states.add(120)
    }
    const maxCharges = Math.max(5, Math.floor(Math.max(1, skillLevel) / 2) + 3)
    const prevCharges = (caster as any).feralRageCharges || 0
    const nextCharges = Math.min(maxCharges, prevCharges + 1)
    ;(caster as any).feralRageCharges = nextCharges
    caster.overlays = caster.overlays.filter(o => !o.token.toLowerCase().startsWith('feralrage'))
    return
  }

  if (skillId === 233) {
    // #233 Maul (SrvDoFunc=57, state 117, setfunc=16): progressive green charge orb (maul1..5 + maul1back..5back) + stun on hit
    caster.states.add(117)
    if (caster.unitType === 'player' && (caster.id === this.selfId || this.selfId === 0)) {
      this._self.states.add(117)
    }
    const maxCharges = Math.max(5, Math.floor(Math.max(1, skillLevel) / 2) + 3)
    const prevCharges = (caster as any).maulCharges || 0
    const nextCharges = Math.min(maxCharges, prevCharges + 1)
    ;(caster as any).maulCharges = nextCharges
    caster.overlays = caster.overlays.filter(o => !o.token.toLowerCase().startsWith('maul'))
    for (const m of this._monsters.values()) {
      if (!m.dead && Math.hypot(m.x - targetX, m.y - targetY) <= 4 && !(m as any).isBoss && !m.isUnique && !m.isSuperUnique && !m.isChampion) {
        m.states.add(21)
        this.attachUnitOverlay(m, 'stun', false)
      }
    }
    return
  }

  if (skillId === 238) {
    // #238 Rabies (SrvDoFunc=120, state 112): plague overlay on target and nearby contagion targets (7 subtiles)
    for (const m of this._monsters.values()) {
      if (!m.dead && Math.hypot(m.x - targetX, m.y - targetY) <= 7) {
        m.states.add(112)
        this.attachUnitOverlay(m, 'rabiesplague', false)
      }
    }
    return
  }

  if (skillId === 239) {
    // Fire Claws: fire_hit overlay on target
    for (const m of this._monsters.values()) {
      if (!m.dead && Math.hypot(m.x - targetX, m.y - targetY) <= 4) {
        this.attachUnitOverlay(m, 'fire_hit', false)
      }
    }
    return
  }

  if (skillId === 242) {
    // #242 Hunger (SrvDoFunc=122): 1.13c Skills.txt has no overlay columns (#1082)
    return
  }

  if (skillId === 248) {
    // #248 Fury (SrvDoFunc=123): multi-hit werewolf melee flurry
    return
  }

  if (skillId === 240) {
    // #240 Twister (SrvDoFunc=123 / CltDoFunc=78): 3 wavy piercing wind vortices (Missiles.txt Range=50, StunLen=10)
    const angles = [-0.3, 0, 0.3]
    const tBaseAngle = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx)
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i]!
      const destX = caster.x + Math.cos(tBaseAngle + a) * 16
      const destY = caster.y + Math.sin(tBaseAngle + a) * 16
      this.spawnMissileByKey('twister', caster.x, caster.y, destX, destY, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
        pierce: true,
        jitterIndex: i,
      })
    }
    return
  }

  if (skillId === 243) {
    // #243 Shock Wave (SrvDoFunc=121 / CltDoFunc=67): 5 piercing fan missiles with non-boss stun
    const angles = [-0.5, -0.25, 0, 0.25, 0.5]
    const baseAngle = Math.atan2(targetY - caster.y, targetX - caster.x)
    for (const a of angles) {
      const destX = caster.x + Math.cos(baseAngle + a) * 14
      const destY = caster.y + Math.sin(baseAngle + a) * 14
      this.spawnMissileByKey('shockwave', caster.x, caster.y, destX, destY, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
        pierce: true,
      })
    }
    for (const m of this._monsters.values()) {
      if (!m.dead && Math.hypot(m.x - targetX, m.y - targetY) <= 8 && !(m as any).isBoss && !m.isUnique && !m.isSuperUnique && !m.isChampion) {
        m.states.add(21)
        this.attachUnitOverlay(m, 'stun', false)
      }
    }
    return
  }

  if (skillId === 244) {
    // #244 Volcano (SrvDoFunc=124 / CltDoFunc=79): cltmissilea='volcano' (Range=150) + cltmissileb='volcano overlay fire' (Range=150)
    const vBase = this.spawnMissileByKey('volcano', targetX, targetY, targetX, targetY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
    })
    vBase.vx = 0
    vBase.vy = 0
    const vFire = this.spawnMissileByKey('volcano overlay fire', targetX, targetY, targetX, targetY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
    })
    vFire.vx = 0
    vFire.vy = 0
    return
  }

  if (skillId === 245) {
    // #245 Tornado (SrvDoFunc=125 / CltDoFunc=80): wavy piercing vortex (Missiles.txt Range=75, Param1=5, NextDelay=25)
    const destX = dx === 0 && dy === 0 ? caster.x + 12 : targetX
    const destY = dx === 0 && dy === 0 ? caster.y : targetY
    this.spawnMissileByKey('tornado', caster.x, caster.y, destX, destY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
      pierce: true,
      jitterIndex: 0,
    })
    return
  }

  if (skillId === 249) {
    // #249 Armageddon (SrvDoFunc=126 / CltDoFunc=82, state 145): 250 + Fissure*50 frame meteor storm around caster
    caster.states.add(145)
    if (caster.unitType === 'player' && (caster.id === this.selfId || this.selfId === 0)) {
      this._self.states.add(145)
    }
    const syn234 = Math.max(0, caster.stats.get(234) ?? 0)
    caster.armageddonSkillLevel = skillLevel
    ;(caster as any).armageddonSkillId = 249
    caster.armageddonUntilTick = this.frameCount + 250 + syn234 * 50
    const clampedDx = dx === 0 && dy === 0 ? 2 : Math.max(-8, Math.min(8, dx))
    const clampedDy = dx === 0 && dy === 0 ? 2 : Math.max(-8, Math.min(8, dy))
    const dropX = caster.x + clampedDx
    const dropY = caster.y + clampedDy
    const skyOffset = 6.5
    const skyX = dropX - skyOffset
    const skyY = dropY - skyOffset
    // Missiles.txt armageddonrock (#578, Range=25, cltcalc1=25, cltcalc2=25, pCltHitFunc=55, SkillCltDoFunc[92] @ 0x6FB795F0):
    // 3D diagonal sky-fall trajectory from (dropX - skyOffset, dropY - skyOffset) to (dropX, dropY) over 25 ticks.
    const rock = this.spawnMissileByKey('armageddonrock', skyX, skyY, dropX, dropY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
      altitude: 625,
      verticalDescentPerTick: 25,
    })
    rock.vx = skyOffset / 25
    rock.vy = skyOffset / 25
    rock.alwaysExplode = true
    const tail = this.spawnMissileByKey('armageddontail', skyX, skyY, dropX, dropY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
      altitude: 625,
      verticalDescentPerTick: 25,
    })
    tail.vx = skyOffset / 25
    tail.vy = skyOffset / 25
    return
  }

  if (skillId === 349) {
    // 1.13c Skills.txt #349 Diablogeddon (SrvDoFunc=124 @ 0x6FC97300, CltPrgFunc1=92 @ 0x6FB795F0, aurastate='armageddon' #145, Issue #1197):
    // auralencalc = ln12 (Param1=1000, Param2=50 => 1000 + (slvl - 1) * 50 frames), aurarangecalc = par3 = 8, Param4 = 8 frame cadence.
    // Spawns cltmissileb = 'diablogeddonrock' (#671, Range=25, pCltHitFunc=55 -> 'diablogeddonexplosion' #673 + 'diablogeddonfire' #674)
    // and cltmissilea = 'diablogeddontail' (#672, Range=25) with cltcalc1=25, cltcalc2=25 (altitude=625, descent=25).
    const slvl = Math.max(1, skillLevel)
    caster.states.add(145)
    if (caster.unitType === 'player' && (caster.id === this.selfId || this.selfId === 0)) {
      this._self.states.add(145)
    }
    caster.armageddonSkillLevel = slvl
    ;(caster as any).armageddonSkillId = 349
    caster.armageddonUntilTick = this.frameCount + 1000 + (slvl - 1) * 50
    const dropX = dx === 0 && dy === 0 ? caster.x + 2 : targetX
    const dropY = dy === 0 && dx === 0 ? caster.y + 1 : targetY
    const rock = this.spawnMissileByKey('diablogeddonrock', dropX, dropY, dropX, dropY, {
      ownerType,
      ownerId,
      sourceSkillId: 349,
      skillLevel: slvl,
      altitude: 625,
      verticalDescentPerTick: 25,
    })
    rock.vx = 0
    rock.vy = 0
    rock.alwaysExplode = true
    const tail = this.spawnMissileByKey('diablogeddontail', dropX, dropY, dropX, dropY, {
      ownerType,
      ownerId,
      sourceSkillId: 349,
      skillLevel: slvl,
      altitude: 625,
      verticalDescentPerTick: 25,
    })
    tail.vx = 0
    tail.vy = 0
    return
  }

  if (skillId === 250) {
    // #250 Hurricane (SrvDoFunc=126 / CltDoFunc=82, state 144, SkillCltDoFunc[90] @ 0x6FB79BE0):
    // 250 + CycloneArmor*50 frame cold vortex around caster within aurarangecalc = 9 subtiles.
    caster.states.add(144)
    if (caster.unitType === 'player' && (caster.id === this.selfId || this.selfId === 0)) {
      this._self.states.add(144)
    }
    const syn235 = Math.max(0, caster.stats.get(235) ?? 0)
    caster.hurricaneSkillLevel = skillLevel
    caster.hurricaneUntilTick = this.frameCount + 250 + syn235 * 50
    const orbitSpecs: ReadonlyArray<{ key: string; radius: number }> = [
      { key: 'hurricaneswoosh', radius: 2.5 },
      { key: 'hurricanerock', radius: 3.5 },
      { key: 'hurricaneswoosh', radius: 4.5 },
      { key: 'hurricanetree', radius: 5.5 },
      { key: 'hurricaneswoosh', radius: 6.5 },
      { key: 'hurricanecart', radius: 7.2 },
      { key: 'hurricanesack', radius: 8.0 },
      { key: 'hurricaneswoosh', radius: 8.5 },
      { key: 'hurricanevase', radius: 9.0 },
    ]
    for (let i = 0; i < orbitSpecs.length; i++) {
      const spec = orbitSpecs[i]!
      const angle = (i * 2 * Math.PI) / orbitSpecs.length
      const radius = spec.radius
      const sx = caster.x + Math.cos(angle) * radius
      const sy = caster.y + Math.sin(angle) * radius
      this.spawnMissileByKey(spec.key, sx, sy, sx, sy, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
        pierce: true,
        originX: caster.x,
        originY: caster.y,
        spiralAngle: angle,
        spiralRadius: radius,
      })
    }
    return
  }

  // 10. Druid Summons:
  // #222 Poison Creeper ('plaguepoppy' #425), #231 Carrion Vine ('cycleoflife' #426), #241 Solar Creeper ('vinecreature' #427):
  // 1.13c SkillCltDoFunc[89] (0x6FB750F0 / StateCltDoFunc[4] 0x6FACAF00, STATE_VINE_BEAST = 150, Issue #1288):
  // Since token 'k9' has no DCC in data/global/monsters/k9/, vine visuals are driven by Missiles.txt
  // ('vine beast walk 1' #466, 'vine beast walk 2' #467, 'vine beast neutral' #468, 'vines trail' #472).
  if (skillId === 222 || skillId === 231 || skillId === 241) {
    const slvl = Math.max(1, skillLevel)
    const vx = dx === 0 && dy === 0 ? startX : targetX
    const vy = dx === 0 && dy === 0 ? startY : targetY
    const vNeutral = this.spawnMissileByKey('vine beast neutral', vx, vy, vx, vy, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel: slvl,
    })
    vNeutral.vx = 0
    vNeutral.vy = 0
    vNeutral.alwaysExplode = true
    const vWalk = this.spawnMissileByKey('vine beast walk 1', vx, vy, vx, vy, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel: slvl,
    })
    vWalk.vx = 0
    vWalk.vy = 0
    vWalk.alwaysExplode = true
    if (skillId === 222) {
      const vTrail = this.spawnMissileByKey('vines trail', vx, vy, vx, vy, {
        ownerType,
        ownerId,
        sourceSkillId: 222,
        skillLevel: slvl,
        maxTicks: 100 + (slvl - 1) * 25,
      })
      vTrail.vx = 0
      vTrail.vy = 0
      vTrail.alwaysExplode = true
    }
    return
  }

  // 11. Assassin Traps, Shadow Clones, and Thrown Blades
  if (skillId === 251) {
    // 1.13c Skills.txt #251 'Fire Trauma' (Fire Blast): srvdofunc=43, cltdofunc=4,
    // srvmissilea=cltmissilea='bomb in air' (#385, Range=50, AlwaysExplode=1, pCltHitFunc=44 -> 'bomb on ground' #386 -> 'bomb explosion' #387).
    const m = this.spawnMissileByKey('bomb in air', caster.x, caster.y, targetX, targetY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
    })
    m.alwaysExplode = true
    return
  }

  if (skillId === 256) {
    // 1.13c Skills.txt #256 'Shock Field' (Shock Web): srvdofunc=42, cltdofunc=5,
    // srvmissilea=cltmissilea='shock field in air' (#388, Range=50, AlwaysExplode=1, pCltHitFunc=44 -> 'shock field on ground' #389).
    // prgcalc1 = par1 + slvl/par2 + skill('Fire Trauma'.blvl)/par3 = 6 + floor(slvl/4) + floor(fireBlastBlvl/3).
    // Scatter radius = floor(N / 4) + 1 sub-tiles around (targetX, targetY).
    const fireBlastBlvl = Math.max(
      0,
      caster.stats.get(251) ??
        (caster.unitType === 'player' && (caster.id === this.selfId || this.selfId === 0)
          ? (this._self.skillEntries?.get(251)?.baseLevel ?? this._self.skills.get(251) ?? 0)
          : 0),
    )
    const slvl = Math.max(1, skillLevel)
    const spikeCount = 6 + Math.floor(slvl / 4) + Math.floor(fireBlastBlvl / 3)
    const radius = Math.floor(spikeCount / 4) + 1
    const span = 2 * radius + 1
    for (let i = 0; i < spikeCount; i++) {
      const offX = (SEED_RollRandomNumber(caster.seed) % span) - radius
      const offY = (SEED_RollRandomNumber(caster.seed) % span) - radius
      const tx = targetX + offX
      const ty = targetY + offY
      const m = this.spawnMissileByKey('shock field in air', caster.x, caster.y, tx, ty, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel: slvl,
      })
      m.alwaysExplode = true
    }
    return
  }

  if (skillId === 257) {
    // 1.13c Skills.txt #257 'Blade Sentinel': srvdofunc=44, srvmissilea='blade creeper' (#392), summon='bladecreeper' (hcIdx=413).
    // CltDoFunc and cltmissilea..c are empty — client spawns 0 client-predicted missiles on cast.
    return
  }

  if (skillId === 266) {
    // 1.13c Skills.txt #266 ('Blade Fury'): srvdofunc=48, srvmissilea='bladefragment1' (#506),
    // cltdofunc=6 (0x6FAF13A0), cltmissilea='bladefragment2' (#508, Vel=22, Range=33, CelFile=Expansion\bladefury_B).
    const tx = dx === 0 && dy === 0 ? startX + Math.cos(baseAngle) * 20 : targetX
    const ty = dx === 0 && dy === 0 ? startY + Math.sin(baseAngle) * 20 : targetY
    this.spawnMissileByKey('bladefragment2', startX, startY, tx, ty, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
    })
    return
  }

  if (skillId === 277) {
    // 1.13c Skills.txt #277 ('Blade Shield'): srvmissilea='blade shield attachment' (#553, pCltDoFunc=57),
    // aurastate='bladeshield' (#158, overlay1='bladeshield'), perdelay=25, aurarangecalc=6.
    caster.states.add(158)
    if (caster.unitType === 'player' && (caster.id === this.selfId || this.selfId === 0)) {
      this._self.states.add(158)
    }
    this.attachUnitOverlay(caster, 'bladeshield', true)
    ensureBladeShieldAttachment113c(this, caster, skillLevel)
    return
  }

  if (skillId === 253) {
    // Psychic Hammer: the caster's 'psychic_hammer_curse' comes from Skills.txt
    // castoverlay via the generic cast path; only the target hits attach here.
    for (const m of this._monsters.values()) {
      if (!m.dead && Math.hypot(m.x - targetX, m.y - targetY) <= 4) {
        this.attachUnitOverlay(m, 'psychic_hammer_hit', false)
      }
    }
    return
  }

  if (skillId === 273) {
    // Mind Blast (1.13c Skills.txt #273: cltdofunc = 8 @ 0x6FAF1290, cltmissilea = 'mindblast center' #576,
    // cltmissileb = 'mindblast hit' #551, aurarangecalc = par7 = 4 sub-tiles, tgtoverlay = 'fist_will_cast').
    // Spawns 'mindblast center' (CltDoFunc 17 -> 'mindblast hit' waves on elapsed 0/3/6/9) and attaches
    // 'fist_will_cast' + 'stun' to hit monsters (States.txt id 21 = stunned).
    const center = this.spawnMissileByKey('mindblast center', targetX, targetY, targetX, targetY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
      maxTicks: MINDBLAST_CENTER_RANGE_113C,
    })
    center.curseSubMissileKey = 'mindblast hit'
    center.curseVisualRadius = MINDBLAST_VISUAL_RADIUS_113C
    tickCurseCenter113c(this.spawnMissileByKey.bind(this), center, 0)
    ;(center as any).curseCenterWave0Spawned = true
    for (const m of this._monsters.values()) {
      if (!m.dead && Math.hypot(m.x - targetX, m.y - targetY) <= MINDBLAST_VISUAL_RADIUS_113C) {
        this.attachUnitOverlay(m, 'fist_will_cast', false)
        this.attachUnitOverlay(m, 'stun', false)
        const isBossOrUnique = Boolean(
          (m as any).isBoss ||
            (m as any).isUnique ||
            (m as any).isSuperUnique ||
            (m as any).isChampion ||
            (m as any).rank === 'boss' ||
            (m as any).rank === 'unique' ||
            (m as any).rank === 'champion',
        )
        if (!isBossOrUnique) {
          m.states.add(21) // States.txt id 21 = stunned (id 53 = conversion)
        }
      }
    }
    return
  }

  // Trap Sentries: 261, 262, 271, 272, 276
  // 1.13c Skills.txt: srvdofunc=45, summon -> MonStats.txt hcIdx:
  // 261 Charged Bolt Sentry -> 'chargeboltsentry' (411)
  // 262 Wake of Fire        -> 'wakeofdestruction' (410)
  // 271 Lightning Sentry    -> 'lightningsentry' (412)
  // 272 Wake of Inferno     -> 'infernosentry' (415)
  // 276 Death Sentry        -> 'deathsentry' (416)
  // Placement skills have NO cltdofunc and NO cltmissile — 0 missiles are spawned on the cast frame.
  if (
    skillId === 261 ||
    skillId === 262 ||
    skillId === 271 ||
    skillId === 272 ||
    skillId === 276
  ) {
    let trapClassId = 411
    if (skillId === 261) {
      trapClassId = 411 // chargeboltsentry (MonStats.txt hcIdx = 411)
    } else if (skillId === 262) {
      trapClassId = 410 // wakeofdestruction (MonStats.txt hcIdx = 410)
    } else if (skillId === 271) {
      trapClassId = 412 // lightningsentry (MonStats.txt hcIdx = 412)
    } else if (skillId === 272) {
      trapClassId = 415 // infernosentry (MonStats.txt hcIdx = 415)
    } else if (skillId === 276) {
      trapClassId = 416 // deathsentry (MonStats.txt hcIdx = 416)
    }

    // Maintain max 5 traps per caster
    if (!(this as any)._trapIdsByOwner) (this as any)._trapIdsByOwner = new Map<number, number[]>()
    const trapIds: number[] = (this as any)._trapIdsByOwner.get(ownerId) ?? []
    if (trapIds.length >= 5) {
      const oldestTrapId = trapIds.shift()!
      const oldestTrap = this.getUnit('monster', oldestTrapId)
      if (oldestTrap) {
        this._units.delete(oldestTrap.key)
        this._monsters.delete(oldestTrap.id)
      }
    }

    const trapId = 8600 + skillId * 10 + (trapIds.length % 5)
    trapIds.push(trapId)
    ;(this as any)._trapIdsByOwner.set(ownerId, trapIds)

    const trapUnit = this.ensureUnit('monster', trapId)
    trapUnit.classId = trapClassId
    trapUnit.ownerType = ownerType
    trapUnit.ownerId = ownerId
    trapUnit.x = targetX
    trapUnit.y = targetY
    trapUnit.mode = 1 // NU mode
    trapUnit.dead = false
    trapUnit.lifePct = 128
    for (const synSkillId of [251, 256, 261, 262, 271, 272, 276]) {
      const v = caster.stats.get(synSkillId)
      if (v !== undefined) {
        trapUnit.stats.set(synSkillId, v)
      }
    }
    this._monsters.set(trapId, trapUnit)
    return
  }

  // Assassin Trap Monster Sub-Skills (fired by sentry monsters during their AI attack ticks):
  // #306 BoltSentry is handled by CltDoFunc 23 (section 2a); #313 sentry lightning & #324 death sentry ltng
  // are handled by LINEAR_SKILL_MISSILES (section 1). Here: #281 Wake Of Destruction Sentry, #311 mon inferno sentry, #312 mon death sentry.
  if (skillId === 281) {
    // 1.13c Skills.txt #281 'Wake Of Destruction Sentry' (SrvDoFunc=125 @ 0x6FC2D680, CltDoFunc=70 @ 0x6FB75A80, Issue #1188):
    // Spawns cltmissilea = 'wake of destruction maker' (#517, Range=25, LevRange=2, Vel=10, pCltDoFunc=52 @ 0x6FB672D0)
    // and records perpendicular vector (-dy, dx) (`InitSteps = -dy`, `InitDrift = dx`) for V-wave wing emission.
    const slvl = Math.max(1, skillLevel)
    const tx = dx === 0 && dy === 0 ? startX + Math.cos(baseAngle) * 10 : targetX
    const ty = dx === 0 && dy === 0 ? startY + Math.sin(baseAngle) * 10 : targetY
    const mdx = tx - startX
    const mdy = ty - startY
    const maker = this.spawnMissileByKey('wake of destruction maker', startX, startY, tx, ty, {
      ownerType,
      ownerId,
      sourceSkillId: 281,
      skillLevel: slvl,
      maxTicks: 25 + 2 * (slvl - 1),
    })
    ;(maker as any).perpDx = -mdy
    ;(maker as any).perpDy = mdx
    return
  }

  if (skillId === 318) {
    // 1.13c Skills.txt #318 'Baal Cold Missiles' (SrvDoFunc=139 @ 0x6FC2D620, CltDoFunc=81 @ 0x6FB74C10, Issue #1196):
    // Spawns cltmissilea = 'baal cold maker' (#589, Range=50, Vel=20, pCltDoFunc=52 @ 0x6FB672D0)
    // and records perpendicular vector (-dy, dx) (`InitSteps = -dy`, `InitDrift = dx`) for V-wave wing emission
    // of CltSubMissile1 = 'baal cold trail' (#590, Range=20, Vel=13).
    const slvl = Math.max(1, skillLevel)
    const tx = dx === 0 && dy === 0 ? startX + Math.cos(baseAngle) * 10 : targetX
    const ty = dx === 0 && dy === 0 ? startY + Math.sin(baseAngle) * 10 : targetY
    const mdx = tx - startX
    const mdy = ty - startY
    const maker = this.spawnMissileByKey('baal cold maker', startX, startY, tx, ty, {
      ownerType,
      ownerId,
      sourceSkillId: 318,
      skillLevel: slvl,
      maxTicks: 50,
    })
    ;(maker as any).perpDx = -mdy
    ;(maker as any).perpDy = mdx
    return
  }

  if (skillId === 172) {
    // 1.13c Skills.txt #172 'GargoyleTrap' (SrvDoFunc=93 @ 0x6FC48A20, CltDoFunc=51 @ 0x6FB085C0, Issue #1195):
    // Spawns cltmissilea = 'shafire3' (#24, Vel=12, Range=40, Pierce=1, ExplosionMissile='shamanexp' #18).
    const slvl = Math.max(1, skillLevel)
    const tx = dx === 0 && dy === 0 ? startX + Math.cos(baseAngle) * 10 : targetX
    const ty = dx === 0 && dy === 0 ? startY + Math.sin(baseAngle) * 10 : targetY
    const m = this.spawnMissileByKey('shafire3', startX, startY, tx, ty, {
      ownerType,
      ownerId,
      sourceSkillId: 172,
      skillLevel: slvl,
      pierce: true,
    })
    m.explosionMissile = 'shamanexp'
    return
  }

  if (skillId === 196) {
    // 1.13c Skills.txt #196 'FingerMageSpider' (SrvDoFunc=107, CltDoFunc=57 @ 0x6FB08070, Issue #1193):
    // Spawns cltmissilea = 'fingermagespider' (#177, Vel=6, Range=80, pCltDoFunc=15 @ 0x6FB68BC0,
    // pCltHitFunc=10 -> ProgOverlay='fingermagespiderexplode', CltSubMissile1='fingermagespider',
    // CltParam1=3 trail cadence, CltParam2=20 trail life, CltParam3=5 repath cadence, CltParam4=20 homing dist).
    const slvl = Math.max(1, skillLevel)
    const tx = dx === 0 && dy === 0 ? startX + Math.cos(baseAngle) * 10 : targetX
    const ty = dx === 0 && dy === 0 ? startY + Math.sin(baseAngle) * 10 : targetY
    const m = this.spawnMissileByKey('fingermagespider', startX, startY, tx, ty, {
      ownerType,
      ownerId,
      sourceSkillId: 196,
      skillLevel: slvl,
    })
    ;(m as any).spiderTrailActive = true
    if (caster.targetUnit !== undefined) {
      m.homingTarget = caster.targetUnit
    } else if (ownerType === 'monster' && !this._self.dead) {
      m.homingTarget = { unitType: 'player', id: this.selfId || this._self.id }
    } else if (ownerType === 'player') {
      let bestMonster: ClientUnit | undefined
      let bestDist = 20
      for (const mon of this._monsters.values()) {
        if (this.isFriendlyOrNonHostileMonster(mon)) continue
        const d = Math.hypot(mon.x - tx, mon.y - ty)
        if (d <= bestDist) {
          bestDist = d
          bestMonster = mon
        }
      }
      if (bestMonster) {
        m.homingTarget = { unitType: 'monster', id: bestMonster.id }
      }
    }
    return
  }

  if (skillId === 197) {
    // 1.13c Skills.txt #197 'DiabWall' (SrvDoFunc=108, CltDoFunc=58 @ 0x6FB07F60 + CltInit 0x6FB06D00, Issue #1194):
    // Spawns calc1 = lvl instances of cltmissilea = 'diabwallmaker' (#179, Vel=20, Range=80 clamped to 77,
    // PATHTYPE_CHARGEDBOLT, pCltDoFunc=16 @ 0x6FB68AA0 -> spawns CltSubMissile1 = 'diabwall' #180 on each sub-tile step).
    const slvl = Math.max(1, skillLevel)
    const tx = dx === 0 && dy === 0 ? startX + Math.cos(baseAngle) * 10 : targetX
    const ty = dx === 0 && dy === 0 ? startY + Math.sin(baseAngle) * 10 : targetY
    for (let i = 0; i < slvl; i++) {
      this.spawnMissileByKey('diabwallmaker', startX, startY, tx, ty, {
        ownerType,
        ownerId,
        sourceSkillId: 197,
        skillLevel: slvl,
        jitterIndex: i,
      })
    }
    return
  }

  if (skillId === 282) {
    // 1.13c Skills.txt #282 'Imp Inferno' (SrvStFunc=59 @ 0x6FC2BEE0, SrvDoFunc=126 @ 0x6FC2DE70, CltDoFunc=71 @ 0x6FB757D0, Issue #1186):
    // Spawns dual-layer 'impinfernoflame1' (#398) and 'impinfernoflame2' (#399) with zOffset=8 and rangeFrames=16+slvl-1.
    spawnCltDo71ImpInfernoTick113c(this, caster, targetX, targetY, skillLevel)
    return
  }

  if (skillId === 283) {
    // 1.13c Skills.txt #283 'Imp Fireball' (CltDoFunc=72 @ 0x6FB75D20, cltmissilea='impfireball' #404, cltcalc1=40, Issue #1187):
    // Spawns 'impfireball' (#404, Vel=18, Range=50, AlwaysExplode=1, ExplosionMissile='impfireballexplode' #405)
    // with initial altitude = cltcalc1 = 40 and verticalDescentPerTick = 40 / remainingFrames.
    const tx = dx === 0 && dy === 0 ? startX + Math.cos(baseAngle) * 10 : targetX
    const ty = dx === 0 && dy === 0 ? startY + Math.sin(baseAngle) * 10 : targetY
    const m = this.spawnMissileByKey('impfireball', startX, startY, tx, ty, {
      ownerType,
      ownerId,
      sourceSkillId: 283,
      skillLevel: Math.max(1, skillLevel),
      altitude: 40,
    })
    const speed = Math.hypot(m.vx, m.vy)
    const dist = Math.hypot(tx - startX, ty - startY)
    const travelFrames =
      speed > 1e-5 && dist > 1e-5
        ? Math.max(1, Math.min(m.maxTicks || 50, Math.round(dist / speed)))
        : Math.max(1, m.maxTicks || 50)
    m.verticalDescentPerTick = 40 / travelFrames
    m.alwaysExplode = true
    m.explosionMissile = 'impfireballexplode'
    return
  }

  const cltDo73 = CLT_DO73_74_TELEPORT_113C[skillId]
  if (cltDo73 !== undefined) {
    // 1.13c SkillCltStFunc[48] (0x6FB74550) + SkillCltDoFunc[73] (0x6FB744D0) / SkillCltDoFunc[74] (0x6FB75050):
    // #292 Teleport 2, #329 Baal Teleport, #330 Imp Teleport, #331 Baal Clone Teleport (Issues #1190, #1191).
    // Spawns cltmissilea at origin (startX, startY) if present and not already spawned on cast start,
    // and spawns cltmissileb at destination (targetX, targetY) if present.
    const slvl = Math.max(1, skillLevel)
    if (
      cltDo73.cltMissileA !== undefined &&
      !(caster.castState?.skillId === skillId && (caster.castState as any).cltSt48Spawned)
    ) {
      const originM = this.spawnMissileByKey(cltDo73.cltMissileA, startX, startY, startX, startY, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel: slvl,
      })
      originM.vx = 0
      originM.vy = 0
    }
    if (cltDo73.cltMissileB !== undefined) {
      const destM = this.spawnMissileByKey(cltDo73.cltMissileB, targetX, targetY, targetX, targetY, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel: slvl,
      })
      destM.vx = 0
      destM.vy = 0
    }
    return
  }

  if (skillId === 308) {
    // 1.13c Skills.txt #308 DeathMaul (SrvDoFunc=136 @ 0x6FC2C400, CltDoFunc=76 @ 0x6FB74CE0, Issue #1183):
    // cltmissilea = 'death mauler' (#502, Range=60, AnimLen=8, AlwaysExplode=1),
    // cltmissileb = 'death mauler trail' (#503, Param1=6 spacing, Param2=4 drawDelay, Range=36, AnimLen=31, pCltHitFunc=44 -> 'death mauler trail fade' #504).
    // Steps along the line from (startX, startY) to (targetX, targetY) every spacing=6 subtiles (minimum 1 trail segment),
    // accumulating drawDelay=4 frames per segment so both trail and terminal 'death mauler' lifetime scale with distance.
    const rawDist = Math.hypot(dx, dy)
    const dist = Math.max(1, Math.floor(rawDist))
    const dir64 =
      rawDist > 1e-5
        ? dir64FromPoints(startX, startY, targetX, targetY, caster.direction ?? 0)
        : (caster.direction ?? 0) & 63
    const trailRow = CANONICAL_113C_MISSILES['death mauler trail']
    const spacing = Math.max(1, trailRow?.param1 ?? 6)
    const drawDelay = Math.max(1, trailRow?.param2 ?? 4)
    const srvFrames =
      dist < 10 ? Math.floor((dist * 8) / 6) + 4 : Math.floor((dist * 8) / 3)
    let stepCount = 0
    let delayAcc = 0
    if (dist <= spacing) {
      const mx = startX + (targetX - startX) * 0.5
      const my = startY + (targetY - startY) * 0.5
      const trail = this.spawnMissileByKey('death mauler trail', mx, my, targetX, targetY, {
        ownerType,
        ownerId,
        sourceSkillId: skillId,
        skillLevel,
        direction: dir64,
        maxTicks: 31 + srvFrames,
      })
      trail.vx = 0
      trail.vy = 0
      stepCount = 1
      delayAcc = drawDelay
    } else {
      for (let stepDist = spacing; stepDist < dist; stepDist += spacing) {
        const frac = stepDist / rawDist
        const sx = startX + dx * frac
        const sy = startY + dy * frac
        const trail = this.spawnMissileByKey('death mauler trail', sx, sy, targetX, targetY, {
          ownerType,
          ownerId,
          sourceSkillId: skillId,
          skillLevel,
          direction: dir64,
          maxTicks: 31 + delayAcc + srvFrames,
        })
        trail.vx = 0
        trail.vy = 0
        stepCount++
        delayAcc += drawDelay
      }
    }
    const maulerMaxTicks = srvFrames + stepCount * drawDelay
    const mauler = this.spawnMissileByKey('death mauler', targetX, targetY, targetX, targetY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel,
      direction: dir64,
      maxTicks: maulerMaxTicks,
    })
    mauler.vx = 0
    mauler.vy = 0
    return
  }

  if (skillId === 311) {
    // 1.13c Skills.txt #311 'mon inferno sentry' (CltStFunc=52 @ 0x6FB74370, CltDoFunc=77 @ 0x6FB75BA0, Issue #1184):
    // Spawns dual-layer flame 'inferno sentry 1' (#523) and 'inferno sentry 2' (#524) toward target with
    // Range = calc1 = ln34/2 + skill('Wake of Fire Sentry'.blvl) (Param3=40, Param4=0 => 20 + wofBlvl).
    const wofBlvl = Math.max(0, caster.stats.get(262) ?? 0)
    const maxTicks = Math.max(1, 20 + wofBlvl)
    const tx = dx === 0 && dy === 0 ? startX + Math.cos(baseAngle) * 10 : targetX
    const ty = dx === 0 && dy === 0 ? startY + Math.sin(baseAngle) * 10 : targetY
    this.spawnMissileByKey('inferno sentry 1', startX, startY, tx, ty, {
      ownerType,
      ownerId,
      sourceSkillId: 311,
      skillLevel,
      maxTicks,
      pierce: true,
    })
    this.spawnMissileByKey('inferno sentry 2', startX, startY, tx, ty, {
      ownerType,
      ownerId,
      sourceSkillId: 311,
      skillLevel,
      maxTicks,
      pierce: true,
    })
    return
  }

  if (skillId === 312) {
    // 1.13c Skills.txt #312 'mon death sentry' (CltStFunc=50 @ 0x6FB74A20, CltDoFunc=78 @ 0x6FB74B00, Issue #1185):
    // Consumes targeted corpse (STATE_CORPSE_NODRAW = 104), attaches castoverlay='death_sentry' on caster,
    // and spawns cltmissilea='corpseexplosion' (#115) + cltmissileb='deathsentryexplode' (#519) at corpse position.
    let corpseUnit: ClientUnit | undefined
    let bestDistSq = 16 // 4 subtiles radius squared
    for (const m of this._monsters.values()) {
      if (!m.dead && m.mode !== 0 && m.mode !== 12 && m.lifePct > 0) continue
      if (
        m.states.has(99) ||
        m.states.has(104) ||
        m.states.has(107) ||
        m.states.has(118) ||
        m.states.has(173)
      ) {
        continue
      }
      const cdx = m.x - targetX
      const cdy = m.y - targetY
      const dSq = cdx * cdx + cdy * cdy
      if (dSq <= bestDistSq) {
        bestDistSq = dSq
        corpseUnit = m
      }
    }
    if (corpseUnit) {
      corpseUnit.states.add(104)
    }
    const cx = corpseUnit ? corpseUnit.x : targetX
    const cy = corpseUnit ? corpseUnit.y : targetY
    this.attachUnitOverlay(caster, 'death_sentry', false)
    const ce = this.spawnMissileByKey('corpseexplosion', cx, cy, cx, cy, {
      ownerType,
      ownerId,
      sourceSkillId: 312,
      skillLevel,
    })
    ce.vx = 0
    ce.vy = 0
    const dse = this.spawnMissileByKey('deathsentryexplode', cx, cy, cx, cy, {
      ownerType,
      ownerId,
      sourceSkillId: 312,
      skillLevel,
    })
    dse.vx = 0
    dse.vy = 0
    return
  }

  if (skillId === 314) {
    // 1.13c Skills.txt #314 'fenris rage' (CltStFunc=51 @ 0x6FB74990, CltDoFunc=79 @ 0x6FB742B0, Issue #1198):
    // Consumes targeted corpse (STATE_CORPSE_NODRAW = 104), sets aurastate='fenris_rage' (state 138 -> overlay1='direwolfcharged'),
    // and spawns cltmissilea='corpseexplosion' (#115) stationary at corpse position.
    let corpseUnit: ClientUnit | undefined
    let bestDistSq = 16
    for (const m of this._monsters.values()) {
      if (!m.dead && m.mode !== 0 && m.mode !== 12 && m.lifePct > 0) continue
      if (
        m.states.has(99) ||
        m.states.has(104) ||
        m.states.has(107) ||
        m.states.has(118) ||
        m.states.has(173)
      ) {
        continue
      }
      const cdx = m.x - targetX
      const cdy = m.y - targetY
      const dSq = cdx * cdx + cdy * cdy
      if (dSq <= bestDistSq) {
        bestDistSq = dSq
        corpseUnit = m
      }
    }
    if (corpseUnit) {
      corpseUnit.states.add(104)
    }
    caster.states.add(138)
    if (caster.unitType === 'player' && (caster.id === this.selfId || this.selfId === 0)) {
      this._self.states.add(138)
    }
    const cx = corpseUnit ? corpseUnit.x : targetX
    const cy = corpseUnit ? corpseUnit.y : targetY
    const ce = this.spawnMissileByKey('corpseexplosion', cx, cy, cx, cy, {
      ownerType,
      ownerId,
      sourceSkillId: 314,
      skillLevel: Math.max(1, skillLevel),
    })
    ce.vx = 0
    ce.vy = 0
    return
  }

  if (skillId === 301) {
    // 1.13c Skills.txt #301 'Siege Beast Stomp' (CltDoFunc=75 @ 0x6FB74830, castoverlay='siege_beast_dust' #245,
    // Param1=8 amplitude, Param2=5 rampUp=200ms, Param3=20 sustain=800ms, Param4=15 rampDown=600ms, Issue #1198):
    // Attaches castoverlay='siege_beast_dust' (if not already attached by applySkillCastToUnit) and triggers screen shake; 0 missiles.
    if (!caster.overlays.some((o) => o.token === 'siege_beast_dust')) {
      this.attachUnitOverlay(caster, 'siege_beast_dust', false)
    }
    this.startScreenShake(800, 8, 200, 600)
    return
  }

  const catapultBallKey = CLT_ST47_CATAPULT_BALL_113C[skillId]
  if (catapultBallKey !== undefined) {
    // 1.13c SkillCltStFunc[47] (0x6FB752E0 -> 0x6FB77F40, Issue #1199):
    // #287 Catapult Charged Ball ('catapultchargedball' #407), #288 Catapult Spike Ball ('catapult spike ball' #411),
    // #303 CatapultBlizzard ('catapult cold ball' #416), #304 CatapultPlague ('catapult plague ball' #419),
    // #305 CatapultMeteor ('catapult meteor ball' #422).
    // Lobs cltmissilea over Range=25 ticks to (tx, ty) with 3D trajectory and AlwaysExplode=1.
    const slvl = Math.max(1, skillLevel)
    const tx = dx === 0 && dy === 0 ? startX + Math.cos(baseAngle) * 10 : targetX
    const ty = dx === 0 && dy === 0 ? startY + Math.sin(baseAngle) * 10 : targetY
    const flightTicks = 25
    const ball = this.spawnMissileByKey(catapultBallKey, startX, startY, tx, ty, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel: slvl,
      maxTicks: flightTicks,
    })
    ball.vx = (tx - startX) / flightTicks
    ball.vy = (ty - startY) / flightTicks
    ball.traj3d = catapultBallTraj3d()
    ball.altitude = ball.traj3d.z >> TRAJ_FIXED_SHIFT
    ball.alwaysExplode = true
    return
  }

  if (skillId === 294) {
    // 1.13c Skills.txt #294 'Vine Attack' (CltStFunc=49 @ 0x6FB75C70, cltmissilea='vine beast attack' #469,
    // cltmissileb='vines' #471, cltcalc1='min(12,ln12)' with Param1=3, Param2=1 => min(12, 2 + slvl), Issue #1200):
    // Spawns stationary 'vine beast attack' (#469) at caster and min(12, 2 + slvl) 'vines' (#471) along the 8-octant table 0x6FB87078.
    const slvl = Math.max(1, skillLevel)
    const vba = this.spawnMissileByKey('vine beast attack', startX, startY, startX, startY, {
      ownerType,
      ownerId,
      sourceSkillId: 294,
      skillLevel: slvl,
    })
    vba.vx = 0
    vba.vy = 0
    const count = Math.min(12, 2 + slvl)
    const baseOctant = (((caster.direction ?? 0) & 63) >> 3) & 7
    for (let i = 0; i < count; i++) {
      const oct = (baseOctant + i) & 7
      const [ox, oy] = CLT_ST49_VINE_OCTANT_OFFSETS_113C[oct]!
      this.spawnMissileByKey('vines', startX, startY, startX + ox, startY + oy, {
        ownerType,
        ownerId,
        sourceSkillId: 294,
        skillLevel: slvl,
        pierce: true,
      })
    }
    return
  }

  if (skillId === 307 || skillId === 325) {
    // 1.13c Skills.txt #307 'CorpseCycler' & #325 'VineCycler' (CltStFunc=49 @ 0x6FB75C70, CltPrgFunc1=93 @ 0x6FB75670,
    // cltmissilea='vine beast attack' #469, cltmissileb='recycler delay' #498, cltcalc1=0, Issue #1200):
    // Consumes targeted corpse (STATE_CORPSE_NODRAW = 104), spawns stationary 'vine beast attack' (#469) at caster,
    // and spawns stationary 'recycler delay' (#498, Range=47, pCltDoFunc=51 -> 'recycler explosion' #501 + 'recycler vine' #499) at corpse.
    const slvl = Math.max(1, skillLevel)
    let corpseUnit: ClientUnit | undefined
    let bestDistSq = 16
    for (const m of this._monsters.values()) {
      if (!m.dead && m.mode !== 0 && m.mode !== 12 && m.lifePct > 0) continue
      if (
        m.states.has(99) ||
        m.states.has(104) ||
        m.states.has(107) ||
        m.states.has(118) ||
        m.states.has(173)
      ) {
        continue
      }
      const cdx = m.x - targetX
      const cdy = m.y - targetY
      const dSq = cdx * cdx + cdy * cdy
      if (dSq <= bestDistSq) {
        bestDistSq = dSq
        corpseUnit = m
      }
    }
    if (corpseUnit) {
      corpseUnit.states.add(104)
    }
    const cx = corpseUnit ? corpseUnit.x : targetX
    const cy = corpseUnit ? corpseUnit.y : targetY
    const vba = this.spawnMissileByKey('vine beast attack', startX, startY, startX, startY, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel: slvl,
    })
    vba.vx = 0
    vba.vy = 0
    const delayM = this.spawnMissileByKey('recycler delay', cx, cy, cx, cy, {
      ownerType,
      ownerId,
      sourceSkillId: skillId,
      skillLevel: slvl,
    })
    delayM.vx = 0
    delayM.vy = 0
    return
  }

  if (skillId === 161) {
    // 1.13c Skills.txt #161 'MagottUp' (CltStFunc=32 @ 0x6FB07200, cltmissilea='dirt pile' #322, cltmissileb='sand pile' #76, Issue #1201):
    // Checks DUNGEON_GetActFromLevelId(levelId) == ACT_II (areaId 40..74): spawns 'sand pile' (#76) in Act 2, otherwise 'dirt pile' (#322).
    const isAct2 = this.areaId >= 40 && this.areaId <= 74
    const pileKey = isAct2 ? 'sand pile' : 'dirt pile'
    const pile = this.spawnMissileByKey(pileKey, startX, startY, startX, startY, {
      ownerType,
      ownerId,
      sourceSkillId: 161,
      skillLevel: Math.max(1, skillLevel),
    })
    pile.vx = 0
    pile.vy = 0
    return
  }

  if (skillId === 284) {
    // 1.13c Skills.txt #284 'Baal Taunt' (CltStFunc=46 @ 0x6FB74FC0, cltmissilea='baal taunt control' #546, Issue #1201):
    // Spawns stationary 'baal taunt control' (#546, Range=75, pCltDoFunc=56 @ 0x6FB670A0 -> 'baal taunt lightning control' #654 / 'baal taunt poison control' #655) at target.
    const ctrl = this.spawnMissileByKey('baal taunt control', targetX, targetY, targetX, targetY, {
      ownerType,
      ownerId,
      sourceSkillId: 284,
      skillLevel: Math.max(1, skillLevel),
    })
    ctrl.vx = 0
    ctrl.vy = 0
    return
  }

  if (skillId === 285) {
    // 1.13c Skills.txt #285 'Baal Corpse Explode' (CltDoFunc=82 @ 0x6FB745C0, cltmissilea='baalcorpseexplodedelay' #587, Param1=40):
    // Scans monster corpses within 40 sub-tiles of caster, marks each with STATE_CORPSE_NODRAW (104),
    // and spawns 'baalcorpseexplodedelay' (#587) with random Range=1..19 ticks (pCltHitFunc=44 -> 'baalcorpseexplodeexpl' #588 -> 'baalcorpseexplodefade' #622).
    const slvl = Math.max(1, skillLevel)
    for (const m of this._monsters.values()) {
      if (m.id === caster.id) continue
      if (!m.dead && m.mode !== 0 && m.mode !== 12 && m.lifePct > 0) continue
      if (
        m.states.has(99) ||
        m.states.has(107) ||
        m.states.has(118) ||
        m.states.has(173)
      ) {
        continue
      }
      if (Math.hypot(m.x - startX, m.y - startY) > 40) continue
      m.states.add(104)
      const delayTicks = 1 + SEED_RollLimitedRandomNumber(caster.seed, 19)
      const delayM = this.spawnMissileByKey(
        'baalcorpseexplodedelay',
        m.x,
        m.y,
        m.x,
        m.y,
        {
          ownerType,
          ownerId,
          sourceSkillId: 285,
          skillLevel: slvl,
          maxTicks: delayTicks,
        },
      )
      delayM.vx = 0
      delayM.vy = 0
      delayM.alwaysExplode = true
    }
    return
  }

  if (skillId === 216) {
    // 1.13c Skills.txt #216 'QueenDeath' (CltDoFunc=64 @ 0x6FB07860 -> 0x6FB078F0, cltmissilea='queendeathcenter' #353, Issue #1202):
    // Spawns stationary 'queendeathcenter' (#353, Range=100, pCltDoFunc=35 -> 'queendeathglob' #354 -> 'queendeathsplat1'/'queendeathsplat2').
    const qdc = this.spawnMissileByKey('queendeathcenter', startX, startY, startX, startY, {
      ownerType,
      ownerId,
      sourceSkillId: 216,
      skillLevel: Math.max(1, skillLevel),
    })
    qdc.vx = 0
    qdc.vy = 0
    return
  }

  if (
    skillId === 159 ||
    skillId === 162 ||
    skillId === 166 ||
    skillId === 167 ||
    skillId === 176 ||
    skillId === 180 ||
    skillId === 198 ||
    skillId === 206 ||
    skillId === 293 ||
    skillId === 320 ||
    skillId === 352
  ) {
    // 1.13c D2Client.dll movement / mode / unit-flag monster CltDoFunc & CltStFunc (Issue #1202):
    // - #159 MaggotEgg (CltDo46 @ 0x6FB071E0)
    // - #162 MagottDown (CltSt33 @ 0x6FB06870, CltDo47 @ 0x6FB068B0)
    // - #166 Swarm Move (CltSt35 @ 0x6FB06910, CltDo49 @ 0x6FB07290)
    // - #167 Nest / #320 EvilHutSpawner (CltSt36 @ 0x6FB06CA0, CltDo50 @ 0x6FB06CC0)
    // - #176 Submerge (CltSt37 @ 0x6FB068C0, CltDo52 @ 0x6FB068A0)
    // - #180 Emerge / #293 Self-resurrect (CltSt38 @ 0x6FB06900)
    // - #198 DiabRun (CltSt41 @ 0x6FB07FF0, CltDo59 @ 0x6FB08B20)
    // - #206 Mosquito (CltSt42 @ 0x6FB06940, CltDo62 @ 0x6FB07830)
    // - #352 SerpentCharge (CltSt25 @ 0x6FB24BB0, CltDo37 @ 0x6FB24BE0)
    // Skills.txt has no cltmissilea/b/c and no cast/tgt/prg overlays — 0 missiles spawned.
    return
  }

  // Shadow Clones: 268 Shadow Warrior, 279 Shadow Master
  if (skillId === 268 || skillId === 279) {
    const cloneClassId = skillId === 268 ? 417 : 418
    const cloneId = 8800 + ownerId
    // Clones are unique per caster: replace old clone if exists
    const oldClone = this.getUnit('monster', cloneId)
    if (oldClone) {
      this._units.delete(oldClone.key)
      this._monsters.delete(oldClone.id)
    }

    const cloneUnit = this.ensureUnit('monster', cloneId)
    cloneUnit.classId = cloneClassId
    cloneUnit.ownerType = ownerType
    cloneUnit.ownerId = ownerId
    cloneUnit.x = targetX
    cloneUnit.y = targetY
    cloneUnit.mode = 1 // NU mode
    cloneUnit.dead = false
    cloneUnit.lifePct = 128
    cloneUnit.states.add(119) // state 119 = shadowwarrior
    this._monsters.set(cloneId, cloneUnit)
    return
  }
}

export function applySkillCastToUnitImpl(
  this: ClientWorldInternal,
  unit: ClientUnit,
  skillId: number,
  targetX: number,
  targetY: number,
  skillLevel = 1,
  spawnVisuals = true,
  nowMs?: number,
): void {
  unit.lastSkillId = skillId
  unit.skillLevel = Math.max(1, skillLevel)
  unit.moveMode = 'stop'
  const isSelf = unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)
  if (unit.castState?.skillId === 151) {
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
        ...(isSelf ? { isLocalPlayer: true } : {}),
      },
      x: unit.x,
      y: unit.y,
      local: isSelf,
    })
  }
  const isMovementSkill =
    skillId === 107 || skillId === 132 || skillId === 143 || skillId === 151
  // Turn toward the cast/attack target via D2Common.#10425; movement skills (#107 Charge, #132 Leap,
  // #143 Leap Attack, #151 Whirlwind) snap initial facing to the travel vector (`bInstant = 1`).
  unit.faceToward(targetX, targetY, isMovementSkill)
  if (unit.unitType === 'monster') {
    const npcUnit = this.npcMotion.getUnit(unit.id)
    if (npcUnit?.pDynamicPath) {
      D2COMMON_10160_PathUpdateDirection(npcUnit.pDynamicPath, unit.targetDirection)
    }
  }
  const animModes = getSkillAnimModes(skillId)
  let mode =
    unit.unitType === 'monster'
      ? resolveMonsterSkillAnimMode113c(unit.classId, skillId, animModes.monsterMode)
      : animModes.playerMode
  unit.mode = mode
  if (unit.unitType === 'monster') {
    unit.lastSkillId = skillId
    const npcUnit = this.npcMotion.getUnit(unit.id)
    if (npcUnit) {
      D2COMMON_10212_PATH_SetMoveFlags(npcUnit, 0)
      if (!doesNpcModeMove113c(unit.classId, mode) && npcUnit.pDynamicPath) {
        D2Common_10153(npcUnit.pDynamicPath)
        unit.moving = false
        unit.moveMode = 'stop'
      }
      this.npcMotion.changeAnimMode0x6FADA6C0(npcUnit, mode, true)
      npcUnit.dwFlags = (npcUnit.dwFlags & ~0x01) >>> 0
      mode = npcUnit.dwAnimMode
      unit.mode = mode
      unit.animStepSpeed256 = npcUnit.wAnimSpeed
    }
    if (spawnVisuals) {
      this.emitMonsterModeSound(unit, mode, skillId)
    }
  }
  const castOverlayToken = getSkillCastOverlay(skillId)
  const now = this.resolveEventNowMs(nowMs)
  let frames = 12
  let baseSpeed = 256
  let effRate = 0
  let stepSpeed256 = 256
  let durationMs = computeOneShotDurationMs(frames, stepSpeed256)

  if (unit.unitType === 'player') {
    const animParams = this.resolvePlayerAnimSpeed(mode, unit.id, skillId)
    frames = animParams.frames
    baseSpeed = animParams.baseSpeed
    effRate = animParams.effRate
    stepSpeed256 = animParams.stepSpeed256
    durationMs = animParams.durationMs
    if (mode === 18) {
      const wclass = isSelf
        ? resolveEquippedWeaponClass(Array.from(this._containers.equipment.values()))
        : 'hth'
      const seq0 = resolveSkillSequenceFrame(skillId, wclass, 0, stepSpeed256)
      if (seq0) {
        frames = seq0.totalSequenceFrames
        durationMs = computeSequenceDurationMs(frames, stepSpeed256)
      }
    }
  } else if (unit.unitType === 'monster') {
    frames =
      unit.totalFrames && unit.totalFrames > 0
        ? unit.totalFrames
        : getMonsterModeBaseFrameCount113c(unit.classId, mode, skillId)
    baseSpeed =
      unit.animSpeed && unit.animSpeed > 0
        ? Math.round((unit.animSpeed / 16) * 256)
        : getMonsterModeBaseAnimSpeed256(unit.classId, mode)
    const npcUnit = this.npcMotion.getUnit(unit.id)
    if (npcUnit && npcUnit.wAnimSpeed > 0) {
      stepSpeed256 = npcUnit.wAnimSpeed
    } else if (unit.animStepSpeed256 && unit.animStepSpeed256 > 0) {
      stepSpeed256 = unit.animStepSpeed256
    } else {
      stepSpeed256 = baseSpeed
    }
    durationMs =
      mode === 14
        ? computeSequenceDurationMs(frames, stepSpeed256)
        : computeOneShotDurationMs(frames, stepSpeed256)
  }

  if (skillId === 193) {
    // 1.13c Skills.txt #193 DiabLight: Param1=40 (40-frame channel duration).
    frames = Math.max(frames, 40)
    durationMs = Math.max(durationMs, 40 * 40)
  }

  let leapParams: LeapTrajectoryParams113c | undefined
  let chargeParams: { dwVelocity: number; stepSpeed: number } | undefined
  let isChargeInPlace = false

  if (skillId === 107) {
    // 1.13c CltSt25 (0x6FADBFD1) & SrvSt31 (0x6FCB96A7):
    // When Charge is cast on a targetUnit that is already within melee range (UNITS_IsInMeleeRange with rangeBonus=0),
    // immediately execute an in-place melee attack (Attack1 / mode 7 for player, mode 4 for monster) WITHOUT dashing or state 18!
    let targetUnit: ClientUnit | undefined
    if (unit.targetUnit) {
      targetUnit = this.getUnit(unit.targetUnit.unitType, unit.targetUnit.id)
    }
    if (targetUnit && !targetUnit.dead && (targetUnit.x !== 0 || targetUnit.y !== 0)) {
      const targetSizeX =
        targetUnit.unitType === 'monster' ? getMonsterSizeXByHcIdx(targetUnit.classId) : 2
      const rangeAdder =
        typeof this.getSelfWeaponRangeAdder === 'function' ? this.getSelfWeaponRangeAdder() : 0
      const collisionFn =
        this._collisionChecker !== null || this._blockedSubTiles?.size > 0
          ? (x: number, y: number) => this.isSubTileBlocked(x, y)
          : null
      const inMelee = isInMeleeRange113c(
        unit.x,
        unit.y,
        unit.unitType === 'player' ? 2 : 2,
        targetUnit.x,
        targetUnit.y,
        targetSizeX,
        rangeAdder,
        false, // rangeBonus = 0 in CltSt25 / SrvSt31
        collisionFn,
      )
      if (inMelee) {
        isChargeInPlace = true
      }
    }
  }

  if (isChargeInPlace) {
    // 1.13c CltSt25 0x6FADBFE7 / 0x6FB53040: override mode to Attack1 (mode 7 for player, mode 4 for monster)
    const attackMode = unit.unitType === 'monster' ? 4 : 7
    unit.mode = attackMode
    if (unit.unitType === 'player') {
      const animParams = this.resolvePlayerAnimSpeed(attackMode, unit.id, skillId)
      frames = animParams.frames
      baseSpeed = animParams.baseSpeed
      effRate = animParams.effRate
      stepSpeed256 = animParams.stepSpeed256
      durationMs = animParams.durationMs
    }
  } else if (skillId === 107 || skillId === 132 || skillId === 143 || skillId === 151) {
    const dist = Math.hypot(targetX - unit.x, targetY - unit.y)
    if (skillId === 132 || skillId === 143) {
      leapParams = computeLeapTrajectoryParams113c(dist)
    } else if (skillId === 107) {
      const stat67 = unit.velocityPercent ?? (isSelf ? this._self.velocityPercent : 0) ?? 0
      chargeParams = computeChargeVelocity113c(stat67, 9)
    }
    const stepSpeed =
      skillId === 151
        ? 0.5
        : leapParams !== undefined
          ? leapParams.stepSpeed
          : chargeParams !== undefined
            ? chargeParams.stepSpeed
            : 1.125
    durationMs = Math.max(durationMs, Math.ceil(dist / stepSpeed) * 40 + 80)
    frames = Math.max(frames, Math.ceil(durationMs / 40))
    unit.states.add(18)
    if (skillId === 151) {
      unit.states.add(174)
    }
    if (isSelf) {
      this._self.states.add(18)
      if (skillId === 151) {
        this._self.states.add(174)
      }
    }
  }

  const castState: UnitCastState = {
    skillId,
    targetX,
    targetY,
    mode: isChargeInPlace ? (unit.unitType === 'monster' ? 4 : 7) : mode,
    startedAtMs: now,
    untilMs: now + durationMs,
    castOverlayToken,
    durationMs,
    elapsedMs: 0,
    stepSpeed256,
    frames,
    baseSpeed,
    effRate,
    ...(isChargeInPlace ? { chargeInPlaceAttack: true } : {}),
    ...(chargeParams !== undefined
      ? {
          chargeStepSpeed: chargeParams.stepSpeed,
          chargeVelocity: chargeParams.dwVelocity,
        }
      : {}),
    ...(skillId === 151 ? { whirlwindBaseDir64: unit.direction } : {}),
    ...(leapParams !== undefined
      ? {
          leapStartX: unit.x,
          leapStartY: unit.y,
          leapTotalDist: Math.hypot(targetX - unit.x, targetY - unit.y),
          leapSizeIdx: leapParams.sizeIdx,
          leapVelMag: leapParams.velMag,
          leapPeakZ: leapParams.peakZ,
          leapTotalTicks: leapParams.totalTicks,
          leapTick: 0,
          leapPosZ: 0,
          leapVelZ: leapParams.initialVelZ,
          leapAccelZ: leapParams.accelZ,
        }
      : {}),
  }
  unit.altitude = 0
  if (skillId === 41) {
    ;(castState as any).infernoChannelPrimed = false
    ;(unit as any).infernoChannelPrimed = false
  } else if (skillId === 230) {
    // 1.13c SKILLS_DoArcticBlast / CltDoFunc=28: continuous channeling emits 1 missile per tick in stepDiscreteSimulationTick.
    castState.missileSpawned = true
  } else if (skillId === 164) {
    // 1.13c SkillCltStFunc[34] (0x6FB07120): locks initial target coordinates into pSkill->nParam1/nParam2.
    ;(castState as any).andarialSprayTargetX = targetX
    ;(castState as any).andarialSprayTargetY = targetY
  }
  unit.castState = castState
  unit.animStartedAtMs = now
  unit.modeStartedAtMs = now
  unit.modeUntilMs = now + durationMs
  unit.modeDurationMs = durationMs
  unit.modeElapsedMs = 0
  unit.animStepSpeed256 = stepSpeed256
  unit.animEffRate = effRate
  if (isSelf) {
    this._self.castState = castState
  }

  if (spawnVisuals) {
    this.emitSkillCastSound({
      skillId,
      ...(unit.unitType === 'player'
        ? { charclass: (isSelf ? this._self.charClass : unit.classId) ?? unit.classId }
        : {}),
      x: unit.x,
      y: unit.y,
      unitId: unit.id,
      local: isSelf,
    })
    if (castOverlayToken) {
      // 1.13c attaches exactly the skill's castoverlay — the extra 'light_cast_3'
      // companion attach was an invented token absent from Overlay.txt (Issue #955).
      this.attachUnitOverlay(unit, castOverlayToken, false)
    }
    const skillOverlayRow = getSkillOverlayRow113c(skillId)
    if (skillOverlayRow?.cltStFunc === 15 && skillOverlayRow.prgOverlay !== '') {
      // 1.13c SKILLS_CltSt15 (0x6FB784F0): attaches Skills.txt prgoverlay once when channelling starts (#230 Arctic Blast -> arctic_blast_cast).
      this.attachUnitOverlay(unit, skillOverlayRow.prgOverlay, false)
    }
    const tgtOverlayToken = getSkillTgtOverlay113c(skillId)
    if (tgtOverlayToken !== undefined && skillId !== 254) {
      // 1.13c Skills.txt tgtoverlay (+0x10A, Issue #1181): attach target overlay to the resolved target unit.
      const tgtUnit = resolveSkillTargetUnit113c(this, unit, skillId, targetX, targetY)
      if (tgtUnit !== undefined) {
        this.attachUnitOverlay(tgtUnit, tgtOverlayToken, false)
      }
    }
    if (skillId === 52) {
      // #52 Enchant: Skills.txt TargetAlly=1, TargetPet=1, aurastate=enchant (16);
      // States.txt row 16 castoverlay=enchant (one-shot on target unit).
      const enchantTarget = resolveEnchantTargetUnit113c(this, unit, targetX, targetY)
      applyEnchantStateToTarget113c(this, enchantTarget, true)
    }
    if (CURSE_CLT_MISSILE_A[skillId] !== undefined || CURSE_SKILL_STATES[skillId] !== undefined) {
      // 1.13c SKILLS_CltSt18_Curse (0x6fb785c0): Skills.txt cltmissilec = cursecast (#147) at the caster on cast start
      // for all CltSt18 curses (#66..#91 and monster curses #212 MonCurseCast, #309 Defense Curse, #310 Blood Mana, Issue #1166).
      this.spawnMissileByKey('cursecast', unit.x, unit.y, unit.x, unit.y, {
        ownerType: unit.unitType,
        ownerId: unit.id,
        sourceSkillId: skillId,
        skillLevel: Math.max(1, skillLevel),
      })
      if (unit.castState) {
        ;(unit.castState as any).cltSt18Spawned = true
      }
    }
    const cltSt19MissileC = CLT_ST19_MISSILE_C_113C[skillId]
    if (cltSt19MissileC !== undefined) {
      // 1.13c SkillCltStFunc[19] (0x6FB78F50 -> 0x6FB78980): spawns cltmissilec (#218 bonecast) at caster facing target on cast start.
      this.spawnMissileByKey(cltSt19MissileC, unit.x, unit.y, targetX, targetY, {
        ownerType: unit.unitType,
        ownerId: unit.id,
        sourceSkillId: skillId,
        skillLevel: Math.max(1, skillLevel),
        ...(targetX === unit.x && targetY === unit.y ? { direction: unit.direction } : {}),
      })
      if (unit.castState) {
        ;(unit.castState as any).cltSt19Spawned = true
      }
    }
    if (skillId === 213) {
      // 1.13c SkillCltStFunc[44] (0x6FB07540, Skills.txt #213 HellMeteor, Issue #1172):
      // Spawns hellmeteordown + hellmeteorball at target and hellmeteorup + hellmeteorball + hellmeteorlaunch2 + hellmeteorlaunch1 at caster on cast start.
      spawnHellMeteorCltSt44_113c(this, unit, targetX, targetY, skillLevel)
      if (unit.castState) {
        ;(unit.castState as any).cltSt44Spawned = true
      }
    }
    const cltSt48MissileA = CLT_DO73_74_TELEPORT_113C[skillId]?.cltMissileA
    if (cltSt48MissileA !== undefined) {
      // 1.13c SkillCltStFunc[48] (0x6FB74550, #330 Imp Teleport / #331 Baal Clone Teleport, Issues #1190, #1191):
      // Spawns cltmissilea stationary at the caster's origin on cast start.
      const originM = this.spawnMissileByKey(cltSt48MissileA, unit.x, unit.y, unit.x, unit.y, {
        ownerType: unit.unitType,
        ownerId: unit.id,
        sourceSkillId: skillId,
        skillLevel: Math.max(1, skillLevel),
      })
      originM.vx = 0
      originM.vy = 0
      if (unit.castState) {
        ;(unit.castState as any).cltSt48Spawned = true
      }
    }
    if (skillId === 68) {
      // #68 Bone Armor (state 14, nooverlays=1): StateSetFunc[6] 0x6FB23230 owns the bonearmor_cast →
      // bonearmor_front/back chain and the 1..3 phase-offset bone pairs (stats 132/133 via 0xA8).
      unit.states.add(14)
      if (isSelf) this._self.states.add(14)
      syncBoneArmorOverlays113c(unit, () => this._nextOverlayId++)
    }
    if (skillId === 40 || skillId === 50 || skillId === 60) {
      // 1.13c Cold Armors are strictly mutually exclusive: clear existing cold armor states (10, 88, 20)
      unit.states.remove(10)
      unit.states.remove(88)
      unit.states.remove(20)
      unit.overlays = unit.overlays.filter(
        (o) =>
          o.token !== 'frozenarmor' &&
          o.token !== 'shiverarmor' &&
          o.token !== 'chillarmor' &&
          o.token !== 'chillingarmor',
      )
      if (isSelf) {
        this._self.states.delete(10)
        this._self.states.delete(88)
        this._self.states.delete(20)
      }
    }
    if (PALADIN_AURA_SKILL_STATES[skillId] !== undefined) {
      // 1.13c Paladin Auras are strictly mutually exclusive: clear existing 20 aura states & overlays
      this.removePaladinAuraStatesAndOverlays(unit, isSelf)
      if (skillId === 100) this.attachUnitOverlay(unit, 'cast_resistfire', false)
      if (skillId === 105) this.attachUnitOverlay(unit, 'cast_resistcold', false)
      if (skillId === 110) this.attachUnitOverlay(unit, 'cast_resistlight', false)
      if (skillId === 125) this.attachUnitOverlay(unit, 'cast_resistall', false)
    }
    if (skillId === 223) {
      // Werewolf: if already in wolf form (state 139), revert to human and play wolf_undo
      unit.states.remove(120)
      unit.states.remove(117)
      if (isSelf) {
        this._self.states.delete(120)
        this._self.states.delete(117)
      }
      ;(unit as any).feralRageCharges = 0
      ;(unit as any).maulCharges = 0
      unit.overlays = unit.overlays.filter(
        o => !o.token.toLowerCase().startsWith('feralrage') && !o.token.toLowerCase().startsWith('maul'),
      )
      if (unit.states.has(139)) {
        unit.states.remove(139)
        if (isSelf) this._self.states.delete(139)
        this.attachUnitOverlay(unit, 'wolf_undo', false)
      } else {
        unit.states.remove(140)
        if (isSelf) this._self.states.delete(140)
        unit.states.add(139)
        if (isSelf) this._self.states.add(139)
        this.attachUnitOverlay(unit, 'wolf_into', false)
      }
    } else if (skillId === 228) {
      // Werebear: if already in bear form (state 140), revert to human and play bear_undo
      unit.states.remove(120)
      unit.states.remove(117)
      if (isSelf) {
        this._self.states.delete(120)
        this._self.states.delete(117)
      }
      ;(unit as any).feralRageCharges = 0
      ;(unit as any).maulCharges = 0
      unit.overlays = unit.overlays.filter(
        o => !o.token.toLowerCase().startsWith('feralrage') && !o.token.toLowerCase().startsWith('maul'),
      )
      if (unit.states.has(140)) {
        unit.states.remove(140)
        if (isSelf) this._self.states.delete(140)
        this.attachUnitOverlay(unit, 'bear_undo', false)
      } else {
        unit.states.remove(139)
        if (isSelf) this._self.states.delete(139)
        unit.states.add(140)
        if (isSelf) this._self.states.add(140)
        this.attachUnitOverlay(unit, 'bear_into', false)
      }
    } else if (skillId === 235) {
      // Cyclone Armor (state 151): StateSetFunc[8] 0x6FB23090 draws staged cyclonearmor1front..3front via state 151 (#1081)
      unit.states.add(151)
      if (isSelf) this._self.states.add(151)
    } else if (skillId === 249) {
      // Armageddon (state 145): 250 + Fissure*50 frame meteor storm timer
      unit.states.add(145)
      if (isSelf) this._self.states.add(145)
      const syn234 = Math.max(0, (isSelf ? this._self.skills.get(234) : undefined) ?? unit.stats.get(234) ?? 0)
      unit.armageddonSkillLevel = Math.max(1, skillLevel)
      ;(unit as any).armageddonSkillId = 249
      unit.armageddonUntilTick = this.frameCount + 250 + syn234 * 50
    } else if (skillId === 349) {
      // Diablogeddon (state 145, Issue #1197): auralencalc = ln12 (1000 + (slvl - 1) * 50)
      const slvl = Math.max(1, skillLevel)
      unit.states.add(145)
      if (isSelf) this._self.states.add(145)
      unit.armageddonSkillLevel = slvl
      ;(unit as any).armageddonSkillId = 349
      unit.armageddonUntilTick = this.frameCount + 1000 + (slvl - 1) * 50
    } else if (skillId === 250) {
      // Hurricane (state 144): 250 + CycloneArmor*50 frame cold vortex timer
      unit.states.add(144)
      if (isSelf) this._self.states.add(144)
      const syn235 = Math.max(0, (isSelf ? this._self.skills.get(235) : undefined) ?? unit.stats.get(235) ?? 0)
      unit.hurricaneSkillLevel = Math.max(1, skillLevel)
      unit.hurricaneUntilTick = this.frameCount + 250 + syn235 * 50
    }

    // Assassin Self-Buffs & Shadow Disciplines
    if (skillId === 258) {
      // Burst of Speed (state 157) removes Fade (state 159); one-shot cast overlay 'quickness' (loop: false)
      unit.states.remove(159)
      if (isSelf) this._self.states.delete(159)
      unit.overlays = unit.overlays.filter(o => o.token !== 'fade')
      unit.states.add(157)
      if (isSelf) this._self.states.add(157)
      this.attachUnitOverlay(unit, 'quickness', false)
    } else if (skillId === 267) {
      // Fade (state 159 translucent render) removes Burst of Speed (state 157); state 159 draws 'fade' via STATE_OVERLAYS[159]
      unit.states.remove(157)
      if (isSelf) this._self.states.delete(157)
      unit.overlays = unit.overlays.filter(o => o.token !== 'quickness' && o.token !== 'fade')
      unit.states.add(159)
      if (isSelf) this._self.states.add(159)
    } else if (skillId === 277) {
      // Blade Shield (state 158): Skills.txt has no cast overlay — only the persistent
      // 'bladeshield' state overlay ('blade_shield_cast' was an invented token, #955)
      // plus 'blade shield attachment' (#553, pCltDoFunc=57).
      unit.states.add(158)
      if (isSelf) this._self.states.add(158)
      this.attachUnitOverlay(unit, 'bladeshield', true)
      ensureBladeShieldAttachment113c(this, unit, skillLevel)
    } else if (skillId === 278) {
      // Venom (state 31 'venomclaws' only; remove bogus state 178 'antidote')
      unit.states.remove(178)
      unit.states.add(31)
      if (isSelf) {
        this._self.states.delete(178)
        this._self.states.add(31)
      }
      this.attachUnitOverlay(unit, 'venomclaws', false)
    } else if (skillId === 264) {
      // Cloak of Shadows (#264): caster gets aurastate=cloak_of_shadows (153, no overlay, setfunc 2);
      // monsters in 30 sub-tiles get auratargetstate=cloaked (156, overlay1='cloaked' via STATE_OVERLAYS[156], #1084).
      unit.states.add(153)
      if (isSelf) this._self.states.add(153)
      for (const m of this._monsters.values()) {
        if (
          !m.dead &&
          !this.isFriendlyOrNonHostileMonster(m) &&
          canMonsterClassBeCursed113c(m.classId) &&
          Math.hypot(m.x - unit.x, m.y - unit.y) <= 30
        ) {
          m.states.add(156)
        }
      }
    }

    // Martial Arts Charge-Up skills (1.13c States.txt pgsvoverlay -> Overlay.txt progressive_*_1..3)
    // Each sets only its Skills.txt aurastate (States.txt progressive_* 122..127). States 147..152 are the Druid
    // barbs / wolverine / oaksage / vine_beast / cyclonearmor / clawmastery rows and are never touched (#1049).
    const chargeSkillMap: Record<number, { state: number; prefix: string }> = {
      254: { state: 122, prefix: 'progressive_damage_' },
      265: { state: 123, prefix: 'progressive_steal_' },
      280: { state: 124, prefix: 'progressive_other_' },
      259: { state: 125, prefix: 'progressive_fire_' },
      274: { state: 126, prefix: 'progressive_cold_' },
      269: { state: 127, prefix: 'progressive_lightning_' },
    }
    if (chargeSkillMap[skillId]) {
      const { state, prefix } = chargeSkillMap[skillId]
      if (!(unit as any).chargeCounts) (unit as any).chargeCounts = new Map<number, number>()
      // 1.13c Martial Arts Charge-Up skills (SrvDo032..035): charges only increment on a successful melee hit!
      // A missed swing leaves chargeCounts and progressive overlays/states unchanged.
      const explicitHit = (unit as any).lastAttackHit
      const explicitMiss = (unit as any).lastAttackMissed === true || explicitHit === false
      let didHit = false
      if (!explicitMiss) {
        if (explicitHit === true) {
          didHit = true
        } else if (this._monsters.size > 0) {
          for (const m of this._monsters.values()) {
            if (m.dead || m.mode === 0 || m.mode === 12 || m.lifePct <= 0) continue
            if (this.isFriendlyOrNonHostileMonster(m)) continue
            if ((m as any).lastHitResult === 'miss' || (m as any).missed === true) continue
            if (
              Math.hypot(m.x - targetX, m.y - targetY) <= 4 &&
              Math.hypot(m.x - unit.x, m.y - unit.y) <= 12
            ) {
              didHit = true
              break
            }
          }
        } else {
          // Synthetic unit test context with no monster registry populated: require target within melee reach
          didHit = Math.hypot(targetX - unit.x, targetY - unit.y) <= 12
        }
      }
      if (didHit) {
        const currentCharges = (unit as any).chargeCounts.get(skillId) ?? 0
        const nextCharge = Math.min(3, currentCharges + 1)
        ;(unit as any).chargeCounts.set(skillId, nextCharge)
        unit.states.add(state)
        if (isSelf) {
          this._self.states.add(state)
        }
        unit.overlays = unit.overlays.filter((o) => !o.token.startsWith(prefix))
        this.attachUnitOverlay(unit, `${prefix}${nextCharge}`, true)
        if (skillId === 254) {
          unit.overlays = unit.overlays.filter((o) => !o.token.startsWith('tigerstrike'))
          this.attachUnitOverlay(unit, `tigerstrike${nextCharge}`, true)
          for (const m of this._monsters.values()) {
            if (Math.hypot(m.x - targetX, m.y - targetY) <= 3) {
              this.attachUnitOverlay(m, 'assassinfootimpact', false)
            }
          }
        }
        if (skillId === 265) {
          unit.overlays = unit.overlays.filter((o) => !o.token.startsWith('cobrastrike'))
          this.attachUnitOverlay(unit, `cobrastrike${nextCharge}`, true)
        }
      }
    }

    // Martial Arts Finishing moves (Normal Attack 0, Dragon Talon 255, Dragon Claw 260, Dragon Tail 270, Dragon Flight 275)
    const isFinisher =
      skillId === 0 || skillId === 255 || skillId === 260 || skillId === 270 || skillId === 275
    if (isFinisher) {
      if (skillId === 270) {
        // Dragon Tail (Skills.txt #270: cltdofunc = 7 @ 0x6FAF0910, cltmissilea = 'dragontail missile' #533; no overlay columns)
        this.spawnMissileByKey('dragontail missile', targetX, targetY, targetX, targetY, {
          ownerType: unit.unitType,
          ownerId: unit.id,
          sourceSkillId: skillId,
        })
      } else if (skillId === 275) {
        // Dragon Flight (Skills.txt #275: tgtoverlay = 'dragonflight' attached to kick target; caster position is server-authoritative)
        let bestTarget: ClientUnit | undefined
        let bestDist = 4
        for (const m of this._monsters.values()) {
          if (m.dead || this.isFriendlyOrNonHostileMonster(m)) continue
          const d = Math.hypot(m.x - targetX, m.y - targetY)
          if (d <= bestDist) {
            bestDist = d
            bestTarget = m
          }
        }
        if (bestTarget) {
          this.attachUnitOverlay(bestTarget, 'dragonflight', false)
        }
      }

      const chargeCounts: Map<number, number> | undefined = (unit as any).chargeCounts
      if (chargeCounts && chargeCounts.size > 0) {
        for (const [cSkill, count] of chargeCounts.entries()) {
          if (cSkill === 259) {
            // Fists of Fire discharges (C2: fistsoffireexplode, C3: SrvDo039 / CltDoFunc 9 radius 4 disk scatter of fistsoffirefirewall)
            if (count >= 2) {
              this.spawnMissileByKey('fistsoffireexplode', targetX, targetY, targetX, targetY, {
                ownerType: unit.unitType,
                ownerId: unit.id,
                sourceSkillId: cSkill,
              })
            }
            if (count === 3) {
              for (const pt of computeSrvDo039ScatterPoints113c(targetX, targetY, 4, unit.seed)) {
                this.spawnMissileByKey('fistsoffirefirewall', pt.x, pt.y, pt.x, pt.y, {
                  ownerType: unit.unitType,
                  ownerId: unit.id,
                  sourceSkillId: cSkill,
                })
              }
            }
          } else if (cSkill === 269) {
            // Claws of Thunder discharges (C2: clawsofthundernova, C3: 16x clawsofthunderbolt)
            if (count >= 2) {
              // SKILLS_SrvDo036_ClawsOfThunder_ProgressiveFn2 (D2Game 0x6FCF6420): sub_6FD14170 from the target unit,
              // 64 cltmissileb 'clawsofthundernova' on the radius-30 table, velocity = calc1 (empty for #269) + Vel.
              const cotLevel = Math.max(1, (isSelf ? this._self.skills.get(cSkill) : undefined) ?? 1)
              const cotNova = getMissileTxtData('clawsofthundernova')
              spawnCltDo25Ring113c(this, cotNova.name, targetX, targetY, missileTxtVelocity113c(cotNova, cotLevel), {
                ownerType: unit.unitType,
                ownerId: unit.id,
                sourceSkillId: cSkill,
                skillLevel: cotLevel,
              })
            }
            if (count === 3) {
              for (let i = 0; i < 16; i++) {
                const angle = (i / 16) * Math.PI * 2
                const tx = targetX + Math.cos(angle) * 16
                const ty = targetY + Math.sin(angle) * 16
                this.spawnMissileByKey('clawsofthunderbolt', targetX, targetY, tx, ty, {
                  ownerType: unit.unitType,
                  ownerId: unit.id,
                  sourceSkillId: cSkill,
                })
              }
            }
          } else if (cSkill === 274) {
            // Blades of Ice discharges (C2: bladesoficeexplode, C3: SrvDo039 / CltDoFunc 9 radius 3 disk scatter of bladesoficecubes)
            if (count >= 2) {
              this.spawnMissileByKey('bladesoficeexplode', targetX, targetY, targetX, targetY, {
                ownerType: unit.unitType,
                ownerId: unit.id,
                sourceSkillId: cSkill,
              })
            }
            if (count === 3) {
              for (const pt of computeSrvDo039ScatterPoints113c(targetX, targetY, 3, unit.seed)) {
                this.spawnMissileByKey('bladesoficecubes', pt.x, pt.y, pt.x, pt.y, {
                  ownerType: unit.unitType,
                  ownerId: unit.id,
                  sourceSkillId: cSkill,
                })
              }
            }
          } else if (cSkill === 280) {
            // Phoenix Strike discharges (C1: royalstrikemeteorcenter -> spawns royalstrikemeteorfire on impact after 60 ticks,
            // C2: 7x royalstrikechainlightning, C3: 16x royalstrikechaosice)
            if (count === 1) {
              this.spawnMissileByKey('royalstrikemeteorcenter', targetX, targetY, targetX, targetY, {
                ownerType: unit.unitType,
                ownerId: unit.id,
                sourceSkillId: cSkill,
              })
            } else if (count === 2) {
              for (let i = 0; i < 7; i++) {
                const angle = (i * 10 * Math.PI * 2) / 64
                const tx = targetX + Math.cos(angle) * 16
                const ty = targetY + Math.sin(angle) * 16
                this.spawnMissileByKey('royalstrikechainlightning', targetX, targetY, tx, ty, {
                  ownerType: unit.unitType,
                  ownerId: unit.id,
                  sourceSkillId: cSkill,
                })
              }
            } else if (count === 3) {
              for (let i = 0; i < 16; i++) {
                const angle = (i / 16) * Math.PI * 2
                const tx = targetX + Math.cos(angle) * 16
                const ty = targetY + Math.sin(angle) * 16
                this.spawnMissileByKey('royalstrikechaosice', targetX, targetY, tx, ty, {
                  ownerType: unit.unitType,
                  ownerId: unit.id,
                  sourceSkillId: cSkill,
                })
              }
            }
          }
        }
        // Clear all charges and overlays
        for (let st = 122; st <= 127; st++) {
          unit.states.remove(st)
          if (isSelf) this._self.states.delete(st)
        }
        unit.overlays = unit.overlays.filter(
          (o) =>
            !o.token.startsWith('progressive_') &&
            !o.token.startsWith('tigerstrike') &&
            !o.token.startsWith('cobrastrike'),
        )
        chargeCounts.clear()
      }
    }

    const buffStateId = SELF_BUFF_SKILL_STATES[skillId]
    if (
      buffStateId !== undefined &&
      skillId !== 223 &&
      skillId !== 228 &&
      skillId !== 258 &&
      skillId !== 267
    ) {
      const wasBuffStateSet = unit.states.has(buffStateId)
      unit.states.add(buffStateId)
      if (isSelf) {
        this._self.states.add(buffStateId)
      }
      if (!wasBuffStateSet) {
        playStateCastOverlay113c(this, unit, buffStateId)
      }
    }
    const effectiveLevel =
      unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)
        ? Math.max(1, this._self.skills.get(skillId) ?? skillLevel)
        : Math.max(1, skillLevel)
    // 1.13c D2Client spawns cltmissilea on the cast animation's ACTION FRAME
    // (AnimData.d2 frame event), not at cast start — otherwise the projectile
    // visibly leaves while the actor is still winding up (Issue #905 feedback:
    // knife/fireball flying out before the character's motion).
    const actionFrameDelayMs = this.resolveCastActionFrameDelayMs(
      unit,
      mode,
      skillId,
      animModes.seqNum,
      stepSpeed256,
      durationMs,
    )
    if (actionFrameDelayMs > 0) {
      const firstDelayMs =
        skillId === 140 ? Math.max(40, Math.round((3 / 12) * durationMs)) : actionFrameDelayMs
      castState.missileFireDelayMs = firstDelayMs
      castState.missileSkillLevel = effectiveLevel
      castState.missileSpawned = false
      if (skillId === 140) {
        castState.secondMissileFireDelayMs = Math.max(
          firstDelayMs + 40,
          Math.round((8 / 12) * durationMs),
        )
        castState.secondMissileSpawned = false
      }
    } else {
      this.emitSkillKeyframeSound({
        skillId,
        flag: 1,
        x: unit.x,
        y: unit.y,
        unitId: unit.id,
        local: isSelf,
      })
      this.spawnMissilesForSkill(unit, skillId, targetX, targetY, effectiveLevel)
    }

    const delayFrames = SKILLS_BY_ID[skillId]?.delay ?? 0
    if (delayFrames > 0) {
      const delayMs = delayFrames * 40
      this._skillDelayUntilMs = now + delayMs
      this._skillDelayDurationMs = delayMs
      unit.states.add(121)
      if (isSelf) {
        this._self.states.add(121)
      }
    }
  }
}

/**
 * 1.13c melee target resolution (`Skills.txt` `#14`, `#24`, `#139`, `#144`, Issue #1222):
 * Prefers the caster's explicit `targetUnit` if it is a living hostile monster, and otherwise searches
 * near `(targetX, targetY)` excluding the caster (`m.id === caster.id`) and all friendly/allied monsters
 * (`world.isFriendlyOrNonHostileMonster(m)`). Never measures distance from `caster.x/y` (which would pick
 * the caster itself at `d = 0` or an adjacent ally).
 */
export function findHostileMeleeTargetMonster113c(
  world: ClientWorldInternal,
  caster: ClientUnit,
  targetX: number,
  targetY: number,
  maxDist = 4,
): ClientUnit | undefined {
  if (caster.targetUnit !== undefined) {
    const explicit =
      world.getUnit(caster.targetUnit.unitType as any, caster.targetUnit.id) ??
      (caster.targetUnit.unitType === 'monster' || (caster.targetUnit.unitType as unknown) === 1
        ? world._monsters.get(caster.targetUnit.id)
        : undefined)
    if (
      explicit &&
      explicit.unitType === 'monster' &&
      !explicit.dead &&
      explicit.id !== caster.id &&
      !world.isFriendlyOrNonHostileMonster(explicit) &&
      Math.hypot(explicit.x - targetX, explicit.y - targetY) <= Math.max(maxDist, 12)
    ) {
      return explicit
    }
  }
  let bestTarget: ClientUnit | undefined
  let bestDist = maxDist
  for (const m of world._monsters.values()) {
    if (m.dead || m.id === caster.id || world.isFriendlyOrNonHostileMonster(m)) continue
    const d = Math.hypot(m.x - targetX, m.y - targetY)
    if (d <= bestDist) {
      bestDist = d
      bestTarget = m
    }
  }
  return bestTarget
}

export function resolveSkillTargetUnit113c(
  world: ClientWorldInternal,
  caster: ClientUnit,
  skillId: number,
  targetX: number,
  targetY: number,
): ClientUnit | undefined {
  if (caster.targetUnit !== undefined) {
    const explicit =
      world.getUnit(caster.targetUnit.unitType as any, caster.targetUnit.id) ??
      world._monsters.get(caster.targetUnit.id)
    if (explicit && !explicit.dead && explicit.unitType !== 'missile') {
      if (
        skillId === 179 ||
        (explicit !== caster &&
          explicit.id !== caster.id &&
          !(explicit.unitType === 'monster' && world.isFriendlyOrNonHostileMonster(explicit)))
      ) {
        return explicit
      }
    }
  }
  const candidates = new Set<ClientUnit>()
  for (const u of world._units.values()) {
    candidates.add(u)
  }
  for (const m of world._monsters.values()) {
    candidates.add(m)
  }
  if (skillId === 179) {
    // #179 ZakarumHeal (TargetAlly=1): prefer living ally/unit closest to (targetX, targetY)
    let bestTarget: ClientUnit | undefined
    let bestDist = 6.0
    for (const u of candidates) {
      if (u === caster || u.dead || u.unitType === 'missile') continue
      const d = Math.hypot(u.x - targetX, u.y - targetY)
      if (d <= bestDist) {
        bestDist = d
        bestTarget = u
      }
    }
    if (!bestTarget || bestDist > 1e-3) {
      const selfDist = Math.hypot(caster.x - targetX, caster.y - targetY)
      if (!caster.dead && selfDist < bestDist) {
        bestTarget = caster
      }
    }
    return bestTarget
  }
  return findHostileMeleeTargetMonster113c(world, caster, targetX, targetY, 4.0)
}

export function resolveEnchantTargetUnit113c(
  world: ClientWorldInternal,
  caster: ClientUnit,
  targetX: number,
  targetY: number,
): ClientUnit {
  const isAlliedEnchantCandidate = (u: ClientUnit): boolean => {
    if (u.dead) return false
    if (u.unitType === 'player') return true
    if (u.unitType === 'monster' && !u.isNpc) {
      return (
        isAlliedCombatMonster113c(world, u) ||
        (world._merc !== null && u.id === world._merc.mercId) ||
        world._pets.has(u.id) ||
        u.ownerType === 'player'
      )
    }
    return false
  }
  if (caster.targetUnit !== undefined) {
    const explicit = world.getUnit(caster.targetUnit.unitType, caster.targetUnit.id)
    if (explicit && isAlliedEnchantCandidate(explicit)) {
      return explicit
    }
  }
  let bestTarget: ClientUnit = caster
  let bestDist = 6.0
  const distToCaster = Math.hypot(caster.x - targetX, caster.y - targetY)
  for (const u of world._units.values()) {
    if (u === caster || !isAlliedEnchantCandidate(u)) continue
    const d = Math.hypot(u.x - targetX, u.y - targetY)
    if (d <= bestDist && (d < distToCaster || distToCaster > 1e-3)) {
      bestDist = d
      bestTarget = u
    }
  }
  return bestTarget
}

export function applyEnchantStateToTarget113c(
  world: ClientWorldInternal,
  targetUnit: ClientUnit,
  spawnOverlay: boolean,
): void {
  const wasAlreadySet = targetUnit.states.has(ENCHANT_STATE_ID_113C)
  targetUnit.states.add(ENCHANT_STATE_ID_113C)
  const isSelf =
    targetUnit.unitType === 'player' &&
    (targetUnit.id === world.selfId || (world.selfId === 0 && targetUnit.id === 1))
  if (isSelf) {
    world._self.states.add(ENCHANT_STATE_ID_113C)
  }
  if (spawnOverlay && !wasAlreadySet) {
    playStateCastOverlay113c(world, targetUnit, ENCHANT_STATE_ID_113C)
  }
}

export function removePaladinAuraStatesAndOverlaysImpl(this: ClientWorldInternal, unit?: ClientUnit, isSelf = false): void {
  const auraOverlayTokens = new Set<string>()
  for (const s of ALL_PALADIN_AURA_STATES) {
    unit?.states.remove(s)
    if (isSelf) {
      this._self.states.delete(s)
    }
    const ovs = STATE_OVERLAYS[s]
    if (ovs) {
      const arr = Array.isArray(ovs) ? ovs : [ovs]
      for (const t of arr) {
        auraOverlayTokens.add(String(t).toLowerCase())
      }
    }
  }
  if (unit && auraOverlayTokens.size > 0) {
    unit.overlays = unit.overlays.filter(o => !auraOverlayTokens.has(o.token.toLowerCase()))
  }
}

export function syncSelfRightHandAuraStateImpl(this: ClientWorldInternal, skillId: number): void {
  const resolvedSelfId = this.selfId || (this.getUnit('player', 1) ? 1 : 0)
  const selfUnit = resolvedSelfId !== 0 ? this.getUnit('player', resolvedSelfId) : undefined
  const hadPaladinAura = ALL_PALADIN_AURA_STATES.some(
    s => this._self.states.has(s) || Boolean(selfUnit?.states.has(s)),
  )
  const nextAuraState = PALADIN_AURA_SKILL_STATES[skillId]
  if (hadPaladinAura || nextAuraState !== undefined) {
    this.removePaladinAuraStatesAndOverlays(selfUnit, true)
  }
  if ( nextAuraState !== undefined) {
    this._self.states.add(nextAuraState)
    if (selfUnit) {
      selfUnit.states.add(nextAuraState)
      if (skillId === 100) this.attachUnitOverlay(selfUnit, 'cast_resistfire', false)
      if (skillId === 105) this.attachUnitOverlay(selfUnit, 'cast_resistcold', false)
      if (skillId === 110) this.attachUnitOverlay(selfUnit, 'cast_resistlight', false)
      if (skillId === 125) this.attachUnitOverlay(selfUnit, 'cast_resistall', false)
    }
  }
}

/**
 * 1.13c `SKILLS_SrvDo039_FoF_BoI_ProgressiveFn3` (`SkillAss.cpp:621-677` / `SkillCltDoFunc[9]` `0x6FAF1780` -> `0x6FAF1100`):
 * Rolls `nRand = SEED_RollRandomNumber(unitSeed)`, initializes a local `D2SeedStrc` with `SEED_InitLowSeed(seed, nRand)`,
 * and attempts `nRange²` random points `(dx, dy)` where `dx = nRange - SEED_RollLimitedRandomNumber(seed, 2 * nRange)`,
 * spawning the progressive missile whenever `dx² + dy² <= nRange²`.
 */
export function computeSrvDo039ScatterPoints113c(
  targetX: number,
  targetY: number,
  nRange: number,
  unitSeed: D2SeedStrc,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  if (!(nRange > 0)) return out
  const nRand = SEED_RollRandomNumber(unitSeed)
  const seed: D2SeedStrc = { lo: 0, hi: 0 }
  SEED_InitLowSeed(seed, nRand)
  const nArea = nRange * nRange
  for (let i = 0; i < nArea; i++) {
    const dx = nRange - SEED_RollLimitedRandomNumber(seed, 2 * nRange)
    const dy = nRange - SEED_RollLimitedRandomNumber(seed, 2 * nRange)
    if (dx * dx + dy * dy <= nArea) {
      out.push({ x: targetX + dx, y: targetY + dy })
    }
  }
  return out
}
