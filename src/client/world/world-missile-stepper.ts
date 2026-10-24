/**
 * Missile Frame Stepping, Impact Triggers, and 25Hz Discrete Simulation Ticks (`src/client/world/world-missile-stepper.ts`).
 */

import { resolveUnitMonSoundRow113c } from '../../common/audio/mon-sounds-113c.ts'
import { getMissileSoundEntry113c } from '../../common/audio/skill-sounds-113c.ts'
import { CHAT_LINE_TTL_MS, OVERHEAD_SPEECH_TTL_MS } from '../../common/chat/chat-113c.ts'
import {
  BLIZZARD_CIRCLE_X,
  BLIZZARD_CIRCLE_Y,
  ISO_GROUND_ASPECT_RATIO,
} from '../../common/data/blizzard-table.js'
import {
  METEOR_EXPLODE_SUBTILE_OFFSETS,
  METEOR_FIRE_SUBTILE_OFFSETS,
} from '../../common/data/meteor-table.ts'
import { d2Rand, LIGHT_SEED_HI, type D2Seed } from '../../common/drlg/light-grid.ts'
import { MONMODE_KNOCKBACK, MONMODE_NEUTRAL } from '../../common/path/index.ts'
import { SEED_RollLimitedRandomNumber, SEED_RollRandomNumber } from '../../common/rng/d2-rng.ts'
import { dir64FromPoints } from '../../common/units/direction.ts'
import {
  computeIsoRadialRingVectors,
  getIcebreakMeltMissile113c,
  isMaggotSmallMonster,
} from '../../common/units/monster-death-fx.ts'
import { isInMeleeRange113c } from '../../common/skills/weapon-combat-meta.ts'
import { getMonsterSizeXByHcIdx } from '../../common/units/monster-mapping.ts'
import { MONSTATS_113C_ROWS, getMonsterKindByClassId } from '../../common/units/monsters-data.ts'
import { hasMonStats2Flag, MONSTATS2_FLAGINDEX } from '../../common/units/monstats2-flags.ts'
import { isTownNpcHcIdx } from '../../common/units/npc-table.ts'
import { getObjectsTxtRecord113c } from '../../common/world/objects-txt-113c.ts'
import { isTownLevel } from '../../common/world/scene-population.ts'
import { createOverlayFromTxtRow113c } from './bone-armor-overlays-113c.ts'
import type { ClientUnit, ClientUnitOverlay } from './client-unit.ts'
import { tickCurseCenter113c } from './curse-center-113c.ts'

/**
 * 1.13c Missiles.txt row #233 (`fistoftheheavensdelay`) + Skills.txt row #121 (`Fist of the Heavens`):
 * MissileCltHitFunc[26] (0x6FB6AD40) resolves:
 * - radius = cHitPar1 > 0 ? cHitPar1 : Skill_aurarangecalc (20)
 * - count = cHitPar2 > 0 ? cHitPar2 : Skill_calc4 (ln12 = Param1 + (slvl - 1) * Param2 = 6 + (slvl - 1))
 * - filter = Skill_aurafilter (42375 = 0xA587: living, hostile, attackable monsters, not in town)
 * - submissile = CltHitSubMissile1 ('fistoftheheavensbolt' #234)
 */
const FISTOFTHEHEAVENSDELAY_113C = Object.freeze({
  skillId: 121,
  cHitPar1: 0,
  cHitPar2: 0,
  auraRange: 20,
  boltBase: 6,
  boltPerLevel: 1,
  auraFilter: 42375,
  cltHitSubMissile1: 'fistoftheheavensbolt',
})

/**
 * 1.13c Skills.txt row #119 (`Sanctuary`) + States.txt row #47 (`sanctuary`):
 * StateCltActiveFunc[86] (0x6FB07F60 -> 0x6FB06D00):
 * - perdelay = 50 frames
 * - aurarangecalc = ln12 (Param1=5, Param2=1 => 5 + (slvl - 1))
 * - aurafilter = 1099623 (0x10C767: bit 18 undead-only, excludes bosses bit 15, living hostile monsters, not in town)
 * - cltmissilea = 'sanctuarybolt' (#57, Range=14, AnimLen=8, LoopAnim=1)
 */
export const SANCTUARY_AURA_113C = Object.freeze({
  skillId: 119,
  stateId: 47,
  perDelay: 50,
  auraRangeBase: 5,
  auraRangePerLevel: 1,
  auraFilter: 1099623,
  cltMissileA: 'sanctuarybolt',
  tgtOverlay: 'cast_undead',
})

export function isMonsterUndead113c(m: ClientUnit): boolean {
  if (typeof (m as any).isUndead === 'boolean') {
    return (m as any).isUndead
  }
  return getMonsterKindByClassId(m.classId)?.isUndead ?? false
}

function isMonsterDemon113c(m: ClientUnit): boolean {
  if (typeof (m as any).isDemon === 'boolean') {
    return (m as any).isDemon
  }
  return getMonsterKindByClassId(m.classId)?.isDemon ?? false
}

export function isAlliedCombatMonster113c(
  world: ClientWorldInternal,
  target: ClientUnit,
): boolean {
  if (target.unitType !== 'monster' || target.dead || target.isNpc || isTownNpcHcIdx(target.classId)) {
    return false
  }
  if (
    Number.isInteger(target.classId) &&
    target.classId >= 0 &&
    target.classId < MONSTATS_113C_ROWS.length
  ) {
    const monRow = MONSTATS_113C_ROWS[target.classId]
    if (monRow !== undefined) {
      if (monRow.npc || monRow.align === 2) return false
      if (
        !hasMonStats2Flag(target.classId, MONSTATS2_FLAGINDEX.ISATT) ||
        hasMonStats2Flag(target.classId, MONSTATS2_FLAGINDEX.CRITTER) ||
        target.classId === 344
      ) {
        return false
      }
    }
  }
  return world.isFriendlyOrNonHostileMonster(target)
}

function isFriendlyTargetForMissile113c(
  world: ClientWorldInternal,
  missile: ClientUnit,
  target: ClientUnit,
): boolean {
  if ((target as any).isFriendly === true) return true
  if ((target as any).isFriendly === false) return false
  if (missile.ownerType === 'monster') {
    return target.unitType === 'monster' && !world.isFriendlyOrNonHostileMonster(target)
  }
  if (target.unitType === 'player') return true
  if (world._merc && target.id === world._merc.mercId) return true
  if (world._pets.has(target.id) || target.ownerType === 'player') return true
  if (target.unitType === 'monster' && isAlliedCombatMonster113c(world, target)) return true
  return false
}

/**
 * 1.13c D2Client.dll MISSMODE_CltHit14_GlacialSpike (0x6FB60870, Issue #1112):
 * Static direction-group table at 0x6FB78434 (stride 5 ints: count + 4 dirs) and
 * 8-direction sub-tile offset table at 0x6FB783F0.
 */
const CLTHIT14_DIR_GROUPS_113C: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 1, 4, 5],
  [0, 2, 4, 6],
  [0, 3, 5],
]
const CLTHIT14_OFFSET_DX_113C = [1, 1, 0, -1, -1, -1, 0, 1] as const
const CLTHIT14_OFFSET_DY_113C = [0, 1, 1, 1, 0, -1, -1, -1] as const

import {
  BONESPIRIT_CLT_PARAM1_113C,
  BONESPIRIT_SIZE_113C,
  CLT_RING16_DX_113C,
  CLT_RING16_DY_113C,
  POISONEXPLOSIONCLOUD_113C,
  ringMissileSpeedSubTilesPerTick113c,
  rollPoisonCloudPuffTargets113c,
  shouldCltDo07Repath113c,
  unitDistance113c,
} from './nec-poison-bone-113c.ts'
export { rollPoisonCloudPuffTargets113c }
import {
  CANONICAL_113C_MISSILES,
  MISSILE_CLASS_ID_TO_KEY,
} from '../../common/skills/missiles-data.ts'
import { tickObjectAnim } from './object-light.ts'
import { updateObjectModeSound113c } from './object-sound-113c.ts'
import {
  ORB_MIST_MISSILE_ROWS,
  TOWER_MIST_MISSILE_ROWS,
  orbMistTick,
  towerChestSpawnerTick,
} from './quest-fx-compelling-orb-113c.ts'
import { QUEST_FX_MISSILES_113C } from './quest-fx-data-113c.ts'
import {
  BR_DEATH_CONTROL_CLT_PARAM1,
  BR_DEATH_CONTROL_CLT_SUBMISSILE1,
  BR_DEATH_CONTROL_INITIAL_COUNTDOWN,
  MEPHISTO_DEATH_CONTROL_113C,
  MEPHISTO_DO_NOT_DRAW_113C,
  MEPHISTO_DO_NOT_DRAW_OFFSETS_113C,
  MEPHISTO_FLYING_ROCKS_BIG_113C,
  cltDo26RockSpawn,
  cltDo26SubOffset,
  cltHit33Bursts,
  rand113c,
  stepCltDo26,
  OVERSEER_CONTROL_INITIAL_COUNTDOWN,
  brDeathBoltOffset,
  brDeathControlDelay,
  catapultBallTraj3d,
  overseerControlBallStart,
  overseerControlDelay,
  pickOverseerControlBall,
  stepCltCountdown,
} from './boss-death-cltdo-113c.ts'
import {
  HORADRIC_SHAKE_AMPLITUDE,
  HORADRIC_SHAKE_SUSTAIN_MS,
  TRAJ_FIXED_SHIFT,
  horadricStaffTick,
  stepTraj3dZ,
} from './quest-fx-horadric-113c.ts'
import {
  CLTDO25_RING_X_113C,
  CLTDO25_RING_Y_113C,
} from '../../common/skills/cltdo25-ring-113c.ts'
import {
  BLAZE_STATE_ID_113C,
  CHILLINGARMOR_STATE_ID_113C,
  COLD_STATE_ID_113C,
  addPredictedTimedState113c,
  arcticBlastColdFrames113c,
  arcticBlastRangeFrames113c,
  expirePredictedStates113c,
  hurricaneColdFrames113c,
  infernoFlameRangeFrames113c,
  isReturnFireMissile113c,
} from './state-ids-113c.ts'
import {
  getMissileCollideType113c,
  isMonsterOneShotMode,
  type ClientWorldInternal,
} from './world-skill-state-tables.ts'
import {
  CLT_DO54_INFERNO_113C,
  ensureBladeShieldAttachment113c,
  fireSingleStrafeShot113c,
  spawnCltDo54InfernoTick113c,
  spawnCltDo56DiabLightTick113c,
  spawnCltDo71ImpInfernoTick113c,
} from './world-skill-missiles.ts'

export function triggerMissileImpactImpl(
  this: ClientWorldInternal,
  missile: ClientUnit,
  hitX: number,
  hitY: number,
  isWallHit: boolean,
  hitUnit?: ClientUnit,
): void {
  this.emitMissileImpactSound({
    missileId: missile.classId > 0 ? missile.classId : missile.missileKey,
    entityId: missile.id,
    x: hitX,
    y: hitY,
  })
  const hitRow = CANONICAL_113C_MISSILES[missile.missileKey ?? '']
  const pCltHitFunc = hitRow?.pCltHitFunc ?? 0

  // 1.13c D2Client.dll MISSMODE_CltHit09_HolyBolt (0x6FB66990, Issue #1115):
  // - holybolt (#55) & fistoftheheavensbolt (#234): cHitPar1=1, cHitPar2=1, ProgOverlay='healing', CltHitSubMissile1='teethexplode'.
  // - On wall hit or range expiry without a hitUnit: returns 0 (no submissile, no overlay).
  // - On friendly target (player/ally/merc/pet) when cHitPar1 > 0: attaches ProgOverlay ('healing') and returns 0.
  // - On hostile monster matching cHitPar2 (1 = undead, 2 = demon): spawns ONE CltHitSubMissile1 ('teethexplode').
  if (pCltHitFunc === 9) {
    if (isWallHit || !hitUnit) {
      return
    }
    if (isFriendlyTargetForMissile113c(this, missile, hitUnit)) {
      if ((hitRow?.cHitPar1 ?? 1) > 0) {
        this.attachUnitOverlay(hitUnit, hitRow?.progOverlay || 'healing', false)
      }
      return
    }
    const cHitPar2 = hitRow?.cHitPar2 ?? 1
    const matchesTarget =
      cHitPar2 === 1
        ? isMonsterUndead113c(hitUnit)
        : cHitPar2 === 2
          ? isMonsterDemon113c(hitUnit)
          : true
    if (matchesTarget) {
      const subKey = hitRow?.cltHitSubMissile1 || 'teethexplode'
      const exp = this.spawnMissileByKey(subKey, hitX, hitY, hitX, hitY, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      exp.vx = 0
      exp.vy = 0
    }
    return
  }

  // 1.13c D2Client.dll MissCltHitFunc[31] (0x6FB605B0, Issue #1453): icebreaksmall (#272) / icebreakmedium (#273) /
  // icebreaklarge (#274) / catapult cold explosion (#417). Returns 0 for a unit hit (edx != 0); otherwise the class
  // switch (bytes 0x6FB606A0, jumps 0x6FB60694) creates icebreaksmallmelt (#344) for 272 and icebreaklargemelt (#345)
  // for 273 / 274 / 417 at the missile position, copying the missile direction.
  if (pCltHitFunc === 31) {
    if (hitUnit) return
    const missileId = hitRow?.id ?? missile.classId
    const meltKey = getIcebreakMeltMissile113c(missileId)
    if (meltKey === undefined) return
    const melt = this.spawnMissileByKey(meltKey, hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
      direction: missile.direction,
      loopAnim: false,
    })
    melt.vx = 0
    melt.vy = 0
    return
  }

  // 1.13c D2Client.dll MISSMODE_CltHit10_ProgOverlay (0x6FB62570) & Missiles.txt ProgOverlay (Issues #1114, #1116):
  // Table-driven attachment of hitRow.progOverlay ('lightning', 'ice_explode', 'vampiresteal',
  // 'diablolightning', 'healing', 'Convert', 'steallife', 'stealmana') on unit impact.
  // Missiles with pCltHitFunc=10 and empty ProgOverlay ('chargedstrikebolt', 'warcry', 'andyfallingdebris1..3')
  // do NOT attach an overlay on missile hit.
  if (!isWallHit && hitRow?.progOverlay) {
    const overlayTarget =
      hitUnit ??
      (missile.missileKey === 'recycler delay' || missile.missileKey === 'vine recycler delay'
        ? (missile.ownerType !== undefined && missile.ownerId !== undefined
            ? this.getUnit(missile.ownerType, missile.ownerId)
            : undefined) ?? this._self ?? undefined
        : undefined)
    if (overlayTarget) {
      this.attachUnitOverlay(overlayTarget, hitRow.progOverlay, false)
    }
  }

  // Druid Elemental hit effects: Twister stun (state 21 + 'stun' overlay), Arctic Blast chill (States.txt cold 11;
  // 29 is 'convicted' and would draw the Conviction overlays),
  // Molten Boulder knockback (and stop on SizeX >= 3 monsters)
  if (!isWallHit && hitUnit) {
    // 1.13c States.txt row 20 (chillingarmor): cltevent=hitbymissile, clteventfunc=1;
    // Skills.txt #60 cltmissilea=chillingarmorbolt (#264, ReturnFire=0), cltoverlaya=chillarmor_hit.
    if (
      hitUnit.states.has(CHILLINGARMOR_STATE_ID_113C) &&
      isReturnFireMissile113c(missile.missileKey)
    ) {
      this.attachUnitOverlay(hitUnit, 'chillarmor_hit', false)
      const attacker =
        missile.ownerType !== undefined && missile.ownerId !== undefined
          ? this.getUnit(missile.ownerType, missile.ownerId)
          : undefined
      const attackerX =
        attacker !== undefined
          ? attacker.x
          : (missile.originX ?? hitUnit.x - (missile.vx ?? 1) * 10)
      const attackerY =
        attacker !== undefined
          ? attacker.y
          : (missile.originY ?? hitUnit.y - (missile.vy ?? 0) * 10)
      this.spawnMissileByKey('chillingarmorbolt', hitUnit.x, hitUnit.y, attackerX, attackerY, {
        ownerType: hitUnit.unitType,
        ownerId: hitUnit.id,
        sourceSkillId: 60,
        skillLevel: hitUnit.skillLevel ?? 1,
      })
    }
    if (missile.missileKey === 'twister') {
      hitUnit.states.add(21)
      this.attachUnitOverlay(hitUnit, 'stun', false)
    } else if (missile.missileKey === 'arcticblast1' || missile.missileKey === 'arcticblast2') {
      addPredictedTimedState113c(
        hitUnit,
        COLD_STATE_ID_113C,
        this.frameCount + arcticBlastColdFrames113c(missile.skillLevel ?? 1),
      )
    } else if (missile.missileKey === 'moltenboulder') {
      const sizeX =
        hitUnit.unitType === 'monster' && hitUnit.classId >= 0
          ? getMonsterSizeXByHcIdx(hitUnit.classId)
          : 2
      if (sizeX >= 3) {
        missile.pierce = false
      } else {
        const bVx = missile.vx ?? 0
        const bVy = missile.vy ?? 0
        const bLen = Math.hypot(bVx, bVy) || 1
        hitUnit.x += (bVx / bLen) * 1.0
        hitUnit.y += (bVy / bLen) * 1.0
      }
    }
  }

  let expKey = missile.explosionMissile || ''

  // Missiles.txt ExplosionMissile spawns its own row (freezingarrowexp1 for iceblast / glacialspike / freezingarrow;
  // Issue #1090): no client-side rename.
  if (expKey === 'plaguejavcloud') {
    // Handled by dedicated multi-projectile bursts below
    expKey = ''
  } else if (missile.missileKey === 'moltenboulder' && !isWallHit && hitUnit && missile.pierce) {
    // Rolling boulder continues piercing small/medium monsters without shattering until wall/expiry/large target
    expKey = ''
  }

  if (expKey) {
    const exp = this.spawnMissileByKey(expKey, hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
      loopAnim: false,
    })
    exp.vx = 0
    exp.vy = 0
  }

  if (
    (missile.missileKey === 'moltenboulder' || missile.missileKey === 'moltenboulderexplode') &&
    (isWallHit || !hitUnit || !missile.pierce)
  ) {
    // 1.13c Molten Boulder pCltHitFunc=52 (Missiles.txt row #299):
    // CltHitSubMissile1 = 'moltenboulderexplode' (#301, Range=13)
    // CltHitSubMissile2 = 'moltenboulder-flyingrocks' (#303, Range=16)
    // CltHitSubMissile3 = 'moltenboulderfirepath' (#302, Range=37)
    if (missile.missileKey === 'moltenboulder') {
      const mbExp = this.spawnMissileByKey('moltenboulderexplode', hitX, hitY, hitX, hitY, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      mbExp.vx = 0
      mbExp.vy = 0
    }
    const vExp = this.spawnMissileByKey('volcano explosion', hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
      loopAnim: false,
    })
    vExp.vx = 0
    vExp.vy = 0
    const mExp = this.spawnMissileByKey('meteorexplode', hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
      loopAnim: false,
    })
    mExp.vx = 0
    mExp.vy = 0
    const vPool = this.spawnMissileByKey('volcano small fire', hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
    })
    vPool.vx = 0
    vPool.vy = 0
    for (let fIdx = 0; fIdx < 4; fIdx++) {
      const fAng = (fIdx * Math.PI) / 2
      const fx = hitX + Math.cos(fAng) * 1.5
      const fy = hitY + Math.sin(fAng) * 1.5
      const mFire = this.spawnMissileByKey('meteorfire', fx, fy, fx, fy, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
      })
      mFire.vx = 0
      mFire.vy = 0
    }
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI * 2) / 10
      const speed = 0.18 + (i % 3) * 0.08
      const tx = hitX + Math.cos(angle) * 3
      const ty = hitY + Math.sin(angle) * 3
      const frag = this.spawnMissileByKey('moltenboulder-flyingrocks', hitX, hitY, tx, ty, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      frag.vx = Math.cos(angle) * speed
      frag.vy = Math.sin(angle) * speed
    }
    const mbPath = this.spawnMissileByKey('moltenboulderfirepath', hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
    })
    mbPath.vx = 0
    mbPath.vy = 0
  } else if (
    missile.missileKey === 'moltenboulderemerge' &&
    (isWallHit || !hitUnit)
  ) {
    // 1.13c Missiles.txt row #514 ('moltenboulderemerge', pCltHitFunc=53):
    // Chains to CltHitSubMissile1 = 'moltenboulder' (#299, Range=100, Pierce=1, AlwaysExplode=1).
    const dx = (missile.targetX ?? hitX + 10) - (missile.originX ?? hitX)
    const dy = (missile.targetY ?? hitY) - (missile.originY ?? hitY)
    const destX = dx === 0 && dy === 0 ? hitX + 10 : hitX + dx
    const destY = dx === 0 && dy === 0 ? hitY : hitY + dy
    const boulder = this.spawnMissileByKey('moltenboulder', hitX, hitY, destX, destY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
      pierce: true,
    })
    boulder.alwaysExplode = true
  } else if (missile.missileKey === 'armageddonrock' || missile.missileKey === 'diablogeddonrock') {
    // 1.13c Missiles.txt row #305 ('armageddonrock') & row #671 ('diablogeddonrock', Issue #1197):
    // pCltHitFunc=55 (0x6FB65930), ExplosionMissile="":
    // Spawns CltHitSubMissile1 = 'armageddonexplosion'/'diablogeddonexplosion' (Range=16)
    // and CltHitSubMissile2 = 'armageddonfire'/'diablogeddonfire' (Range=37).
    const isDiab = missile.missileKey === 'diablogeddonrock'
    const expSubKey = isDiab ? 'diablogeddonexplosion' : 'armageddonexplosion'
    const fireSubKey = isDiab ? 'diablogeddonfire' : 'armageddonfire'
    if (!expKey) {
      const exp = this.spawnMissileByKey(expSubKey, hitX, hitY, hitX, hitY, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      exp.vx = 0
      exp.vy = 0
    }
    const patch = this.spawnMissileByKey(fireSubKey, hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
    })
    patch.vx = 0
    patch.vy = 0
    if (!isDiab) {
      for (let i = 0; i < 2; i++) {
        const ang = i * Math.PI + 0.5
        const spd = 0.22
        const frag = this.spawnMissileByKey(
          'moltenboulder-flyingrocks',
          hitX,
          hitY,
          hitX + Math.cos(ang) * 3,
          hitY + Math.sin(ang) * 3,
          {
            ownerType: missile.ownerType,
            ownerId: missile.ownerId,
            sourceSkillId: missile.sourceSkillId,
            skillLevel: missile.skillLevel,
          },
        )
        frag.vx = Math.cos(ang) * spd
        frag.vy = Math.sin(ang) * spd
      }
      const mfire = this.spawnMissileByKey('meteorfire', hitX, hitY, hitX, hitY, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
      })
      mfire.vx = 0
      mfire.vy = 0
    }
  } else if (missile.missileKey === 'volcano debris 2') {
    // 1.13c Missiles.txt row #466 ('volcano debris 2', pCltHitFunc=55, ExplosionMissile=""):
    // Spawns CltHitSubMissile1 = 'volcano explosion' (Range=18) and CltHitSubMissile2 = 'volcano small fire' (Range=18).
    if (!expKey) {
      const exp = this.spawnMissileByKey('volcano explosion', hitX, hitY, hitX, hitY, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      exp.vx = 0
      exp.vy = 0
    }
    const smallFire = this.spawnMissileByKey('volcano small fire', hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
    })
    smallFire.vx = 0
    smallFire.vy = 0
  } else if (missile.missileKey === 'bomb in air') {
    // 1.13c Missiles.txt row #385 ('bomb in air', Range=50, AlwaysExplode=1, pCltHitFunc=44, ExplosionMissile=""):
    // Spawns CltHitSubMissile1 = 'bomb on ground' (#386, Range=5, AlwaysExplode=1, ExplosionMissile='bomb explosion').
    const groundBomb = this.spawnMissileByKey('bomb on ground', hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
      loopAnim: false,
    })
    groundBomb.vx = 0
    groundBomb.vy = 0
    groundBomb.alwaysExplode = true
  } else if (missile.missileKey === 'shock field in air') {
    // 1.13c Missiles.txt row #388 ('shock field in air', Range=50, AlwaysExplode=1, pCltHitFunc=44, ExplosionMissile=""):
    // Spawns CltHitSubMissile1 = 'shock field on ground' (#389, Range=90, LoopAnim=1).
    const groundShock = this.spawnMissileByKey('shock field on ground', hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
    })
    groundShock.vx = 0
    groundShock.vy = 0
  } else if (missile.missileKey === 'death mauler trail') {
    // 1.13c Missiles.txt row #503 ('death mauler trail', Range=36, AlwaysExplode=1, pCltHitFunc=44, ExplosionMissile="", Issue #1183):
    // Spawns CltHitSubMissile1 = 'death mauler trail fade' (#504, Range=36) at the trail segment position.
    const fade = this.spawnMissileByKey('death mauler trail fade', hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
      direction: missile.direction,
    })
    fade.vx = 0
    fade.vy = 0
  } else if (missile.missileKey === 'baalcorpseexplodedelay') {
    // 1.13c Missiles.txt row #587 ('baalcorpseexplodedelay', AlwaysExplode=1, pCltHitFunc=44 @ 0x6FB63150):
    // Spawns CltHitSubMissile1 = 'baalcorpseexplodeexpl' (#588, Range=14, AlwaysExplode=1, HitSound=impact_gore_light_1).
    if (!expKey) {
      const sub1Key = hitRow?.cltHitSubMissile1 || 'baalcorpseexplodeexpl'
      const expl = this.spawnMissileByKey(sub1Key, hitX, hitY, hitX, hitY, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      expl.vx = 0
      expl.vy = 0
      expl.alwaysExplode = true
    }
  } else if (missile.missileKey === 'baalcorpseexplodeexpl') {
    // 1.13c Missiles.txt row #588 ('baalcorpseexplodeexpl', Range=14, AlwaysExplode=1, pCltHitFunc=44 @ 0x6FB63150):
    // Spawns CltHitSubMissile1 = 'baalcorpseexplodefade' (#622, Range=128).
    const sub1Key = hitRow?.cltHitSubMissile1 || 'baalcorpseexplodefade'
    const fade = this.spawnMissileByKey(sub1Key, hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
    })
    fade.vx = 0
    fade.vy = 0
  } else if (missile.missileKey === 'baal spawn monsters') {
    // 1.13c Missiles.txt row #550 ('baal spawn monsters', pCltHitFunc=57 @ 0x6FB6BF30 -> 0x6FB66D40,
    // cHitPar1=10, cHitPar2=20, CltHitSubMissile1='baal spawn monsters exp' #591):
    // Scans circular disc dx^2 + dy^2 <= 10^2 (317 sub-tiles) around (hitX, hitY), rolling 1/20 per cell
    // to spawn 'baal spawn monsters exp' (#591, AnimLen=12, Range=12) with randomized initial frame rand(11).
    const radius = Math.max(1, hitRow?.cHitPar1 ?? 10)
    const chanceDenom = Math.max(1, hitRow?.cHitPar2 ?? 20)
    const sub1Key = hitRow?.cltHitSubMissile1 || 'baal spawn monsters exp'
    const rSq = radius * radius
    let spawnedCount = 0
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > rSq) continue
        if (SEED_RollLimitedRandomNumber(missile.seed, chanceDenom) !== 0) continue
        const sx = hitX + dx
        const sy = hitY + dy
        const exp = this.spawnMissileByKey(sub1Key, sx, sy, sx, sy, {
          ownerType: missile.ownerType,
          ownerId: missile.ownerId,
          sourceSkillId: missile.sourceSkillId,
          skillLevel: missile.skillLevel,
          loopAnim: false,
        })
        exp.vx = 0
        exp.vy = 0
        ;(exp as any).initialFrameOffset = SEED_RollLimitedRandomNumber(missile.seed, 11)
        spawnedCount++
      }
    }
    if (spawnedCount === 0) {
      const exp = this.spawnMissileByKey(sub1Key, hitX, hitY, hitX, hitY, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      exp.vx = 0
      exp.vy = 0
    }
  } else if (missile.missileKey === 'catapultchargedball') {
    // 1.13c Missiles.txt row #407 ('catapultchargedball', pCltHitFunc=46 @ 0x6FB6AAC0, cHitPar1=4, cHitPar2=2,
    // CltHitSubMissile1='catapultchargedballbolt' #408, Issue #1199):
    // Spawns boltCount = max(1, cHitPar1 + (slvl - 1) * cHitPar2) = 4 + (slvl - 1) * 2 bolts radially.
    const slvl = Math.max(1, missile.skillLevel ?? 1)
    const boltCount = Math.max(1, (hitRow?.cHitPar1 ?? 4) + (slvl - 1) * (hitRow?.cHitPar2 ?? 2))
    const sub1Key = hitRow?.cltHitSubMissile1 || 'catapultchargedballbolt'
    for (let i = 0; i < boltCount; i++) {
      const angle = (i * 2 * Math.PI) / boltCount
      this.spawnMissileByKey(
        sub1Key,
        hitX,
        hitY,
        hitX + Math.cos(angle) * 10,
        hitY + Math.sin(angle) * 10,
        {
          ownerType: missile.ownerType,
          ownerId: missile.ownerId,
          sourceSkillId: missile.sourceSkillId,
          skillLevel: slvl,
          jitterIndex: i + 1,
        },
      )
    }
  } else if (missile.missileKey === 'catapult spike ball') {
    // 1.13c Missiles.txt row #411 ('catapult spike ball', pCltHitFunc=47 @ 0x6FB6BFA0 -> 0x6FB6BF10, cHitPar1=16,
    // CltHitSubMissile1='catapult spike in air' #412, CltHitSubMissile2='fireexplode' #103, Skills.txt #288 Param1=8, Issue #1199):
    // Spawns stationary CltHitSubMissile2 ('fireexplode' #103) at impact and lobs 8 CltHitSubMissile1 ('catapult spike in air' #412)
    // around (hitX, hitY) with 3D trajectory and AlwaysExplode=1.
    const sub2Key = hitRow?.cltHitSubMissile2 || 'fireexplode'
    const exp = this.spawnMissileByKey(sub2Key, hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
      loopAnim: false,
    })
    exp.vx = 0
    exp.vy = 0
    const sub1Key = hitRow?.cltHitSubMissile1 || 'catapult spike in air'
    const spikeCount = 8
    const flightTicks = CANONICAL_113C_MISSILES[sub1Key]?.range ?? 50
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i * 2 * Math.PI) / spikeCount
      const tx = hitX + Math.cos(angle) * 2.5
      const ty = hitY + Math.sin(angle) * 2.5
      const spike = this.spawnMissileByKey(sub1Key, hitX, hitY, tx, ty, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        maxTicks: flightTicks,
      })
      spike.vx = (tx - hitX) / flightTicks
      spike.vy = (ty - hitY) / flightTicks
      spike.traj3d = catapultBallTraj3d()
      spike.altitude = spike.traj3d.z >> TRAJ_FIXED_SHIFT
      spike.alwaysExplode = true
    }
  } else if (missile.missileKey === 'catapult spike in air') {
    // 1.13c Missiles.txt row #412 ('catapult spike in air', Range=50, AlwaysExplode=1, pCltHitFunc=44 @ 0x6FB60740,
    // CltHitSubMissile1='catapult spike on ground' #413, Issue #1199):
    // Spawns stationary 'catapult spike on ground' (#413, Range=180, AlwaysExplode=1, ExplosionMissile='catapult spike explosion' #414).
    const sub1Key = hitRow?.cltHitSubMissile1 || 'catapult spike on ground'
    const groundSpike = this.spawnMissileByKey(sub1Key, hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
    })
    groundSpike.vx = 0
    groundSpike.vy = 0
    groundSpike.alwaysExplode = true
  } else if (missile.missileKey === 'catapult cold ball') {
    // 1.13c Missiles.txt row #416 ('catapult cold ball', pCltHitFunc=48 @ 0x6FB60B70,
    // CltHitSubMissile1='freezingarrowexp1' #88, CltHitSubMissile2='freezingarrowexp2' #89,
    // CltHitSubMissile3='catapult cold explosion' #417, Issue #1199):
    // Spawns stationary 'freezingarrowexp1' at center and 8 radial pairs of 'freezingarrowexp2' + 'catapult cold explosion'.
    const sub1Key = hitRow?.cltHitSubMissile1 || 'freezingarrowexp1'
    const sub2Key = hitRow?.cltHitSubMissile2 || 'freezingarrowexp2'
    const sub3Key = hitRow?.cltHitSubMissile3 || 'catapult cold explosion'
    const centerExp = this.spawnMissileByKey(sub1Key, hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
      loopAnim: false,
    })
    centerExp.vx = 0
    centerExp.vy = 0
    for (let dir = 0; dir < 8; dir++) {
      const ox = CLTHIT14_OFFSET_DX_113C[dir]!
      const oy = CLTHIT14_OFFSET_DY_113C[dir]!
      this.spawnMissileByKey(sub2Key, hitX, hitY, hitX + ox, hitY + oy, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      const coldExp = this.spawnMissileByKey(sub3Key, hitX, hitY, hitX + ox * 2, hitY + oy * 2, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
      })
      coldExp.traj3d = catapultBallTraj3d()
      coldExp.altitude = coldExp.traj3d.z >> TRAJ_FIXED_SHIFT
      coldExp.alwaysExplode = true
    }
  } else if (missile.missileKey === 'catapult meteor ball') {
    // 1.13c Missiles.txt row #422 ('catapult meteor ball', pCltHitFunc=50 @ 0x6FB6AA70 -> 0x6FB65B70,
    // cHitPar1=10, cHitPar2=15, CltHitSubMissile1='moltenboulder-flyingrocks' #456,
    // CltHitSubMissile2='catapult meteor fire' #423, Issue #1199):
    // Spawns 10 'moltenboulder-flyingrocks' (#456) and 18 stationary 'catapult meteor fire' (#423, Range=90+(slvl-1)*25).
    const slvl = Math.max(1, missile.skillLevel ?? 1)
    const rockCount = hitRow?.cHitPar1 ?? 10
    const sub1Key = hitRow?.cltHitSubMissile1 || 'moltenboulder-flyingrocks'
    const sub2Key = hitRow?.cltHitSubMissile2 || 'catapult meteor fire'
    for (let i = 0; i < rockCount; i++) {
      let rx = SEED_RollLimitedRandomNumber(missile.seed, 9) - 4
      const ry = SEED_RollLimitedRandomNumber(missile.seed, 9) - 4
      if (rx === 0 && ry === 0) rx = 2
      this.spawnMissileByKey(sub1Key, hitX, hitY, hitX + rx, hitY + ry, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: slvl,
      })
    }
    const fireTicks = 90 + (slvl - 1) * 25
    for (const off of METEOR_FIRE_SUBTILE_OFFSETS) {
      const fx = hitX + off.x
      const fy = hitY + off.y
      const fire = this.spawnMissileByKey(sub2Key, fx, fy, fx, fy, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: slvl,
        maxTicks: fireTicks,
      })
      fire.vx = 0
      fire.vy = 0
    }
  } else if (missile.missileKey === 'vines trail' || missile.missileKey === 'plague vines trail') {
    // 1.13c Missiles.txt rows #472 ('vines trail') & #475 ('plague vines trail', pCltHitFunc=54 @ 0x6FB60EE0, Issue #1200):
    // Spawns stationary CltHitSubMissile1 ('vines wither' #473 or 'plague vines wither' #476, Range=100).
    const witherKey =
      hitRow?.cltHitSubMissile1 ||
      (missile.missileKey === 'plague vines trail' ? 'plague vines wither' : 'vines wither')
    const wither = this.spawnMissileByKey(witherKey, hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
      direction: missile.direction,
    })
    wither.vx = 0
    wither.vy = 0
  } else if (missile.missileKey === 'recycler vine') {
    // 1.13c Missiles.txt row #499 ('recycler vine', pCltHitFunc=56 @ 0x6FB65850, CltHitSubMissile1='recycler fade' #500, Issue #1200):
    // Spawns stationary 'recycler fade' (#500, Range=100) at corpse coordinates.
    const fadeKey = hitRow?.cltHitSubMissile1 || 'recycler fade'
    const fade = this.spawnMissileByKey(fadeKey, hitX, hitY, hitX, hitY, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: missile.skillLevel,
    })
    fade.vx = 0
    fade.vy = 0
  } else if (missile.missileKey === 'baal taunt lightning control') {
    // 1.13c Missiles.txt row #654 ('baal taunt lightning control', pCltHitFunc=62 @ 0x6FB63720,
    // cHitPar1=10, CltHitSubMissile1='baal taunt lightning' #547, Issue #1201):
    // Spawns 'baal taunt lightning' (#547, Vel=30, Range=10+2*(slvl-1), pCltDoFunc=8) toward a random offset in [-10..10].
    const slvl = Math.max(1, missile.skillLevel ?? 1)
    const r = Math.max(1, hitRow?.cHitPar1 ?? 10)
    let dx = SEED_RollLimitedRandomNumber(missile.seed, 2 * r + 1) - r
    const dy = SEED_RollLimitedRandomNumber(missile.seed, 2 * r + 1) - r
    if (dx === 0 && dy === 0) dx = SEED_RollLimitedRandomNumber(missile.seed, r) + 1
    const subKey = hitRow?.cltHitSubMissile1 || 'baal taunt lightning'
    this.spawnMissileByKey(subKey, hitX, hitY, hitX + dx, hitY + dy, {
      ownerType: missile.ownerType,
      ownerId: missile.ownerId,
      sourceSkillId: missile.sourceSkillId,
      skillLevel: slvl,
      maxTicks: 10 + 2 * (slvl - 1),
      pierce: true,
    })
  } else if (missile.missileKey === 'baal taunt poison control') {
    // 1.13c Missiles.txt row #655 ('baal taunt poison control', pCltHitFunc=63 @ 0x6FB69BB0,
    // cHitPar1=2, CltHitSubMissile1='baal taunt poison' #549, Issue #1201):
    // Spawns 16-direction ring (0x6FB870E8 / 0x6FB87128) of 'baal taunt poison' (#549, Range=60, Param1=4, pCltDoFunc=4).
    const slvl = Math.max(1, missile.skillLevel ?? 1)
    const subKey = hitRow?.cltHitSubMissile1 || 'baal taunt poison'
    for (let dir = 0; dir < 16; dir++) {
      const dx = CLT_RING16_DX_113C[dir]!
      const dy = CLT_RING16_DY_113C[dir]!
      this.spawnMissileByKey(subKey, hitX, hitY, hitX + dx, hitY + dy, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: slvl,
        pierce: true,
      })
    }
  }

  if (
    pCltHitFunc === 14 ||
    missile.missileKey === 'glacialspike' ||
    missile.missileKey === 'monglacialspike' ||
    missile.missileKey === 'freezingarrow'
  ) {
    // 1.13c D2Client.dll MISSMODE_CltHit14_GlacialSpike (0x6FB60870, Issue #1112):
    // 1) Spawn CltHitSubMissile1 ('freezingarrowexp1' #88) at impact center (hitX, hitY)
    // 2) Roll groupIdx = SEED_RollLimitedRandomNumber(missile.seed, 3) and
    //    rotOffset = SEED_RollLimitedRandomNumber(missile.seed, 8)
    // 3) For each baseDir in CLTHIT14_DIR_GROUPS_113C[groupIdx] (4 directions for groups 0/1, 3 directions for group 2):
    //    dir = (baseDir + rotOffset) & 7, offset = (DX[dir], DY[dir]), spawn CltHitSubMissile2 ('freezingarrowexp2' #97)
    //    at (hitX + dx, hitY + dy) facing (hitX + dx * 2, hitY + dy * 2).
    if (!expKey) {
      const sub1Key = hitRow?.cltHitSubMissile1 || 'freezingarrowexp1'
      const centerExp = this.spawnMissileByKey(sub1Key, hitX, hitY, hitX, hitY, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      centerExp.vx = 0
      centerExp.vy = 0
    }
    const sub2Key = hitRow?.cltHitSubMissile2 || 'freezingarrowexp2'
    const groupIdx = SEED_RollLimitedRandomNumber(missile.seed, 3)
    const rotOffset = SEED_RollLimitedRandomNumber(missile.seed, 8)
    const dirGroup = CLTHIT14_DIR_GROUPS_113C[groupIdx] ?? CLTHIT14_DIR_GROUPS_113C[0]!
    for (const baseDir of dirGroup) {
      const dir = (baseDir + rotOffset) & 7
      const dx = CLTHIT14_OFFSET_DX_113C[dir]!
      const dy = CLTHIT14_OFFSET_DY_113C[dir]!
      const sx = hitX + dx
      const sy = hitY + dy
      const ejecta = this.spawnMissileByKey(sub2Key, sx, sy, sx + dx, sy + dy, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      ejecta.vx = 0
      ejecta.vy = 0
    }
  } else if (missile.missileKey === 'baal spawn monsters') {
    // 1.13c Missiles.txt 'baal spawn monsters' (#554): pCltHitFunc=57, CltHitSubMissile1='baal spawn monsters exp' (#555)
    if (!expKey) {
      const exp = this.spawnMissileByKey('baal spawn monsters exp', hitX, hitY, hitX, hitY, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      exp.vx = 0
      exp.vy = 0
    }
  } else if (missile.missileKey === 'firehead') {
    // 1.13c Missiles.txt 'firehead' (#267): pCltHitFunc=32, ProgOverlay='vampiresteal' (attached above), CltHitSubMissile1='explodingarrowexp'
    if (!expKey) {
      const exp = this.spawnMissileByKey('explodingarrowexp', hitX, hitY, hitX, hitY, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      exp.vx = 0
      exp.vy = 0
    }
  } else if (
    missile.missileKey === 'monbliz1' ||
    missile.missileKey === 'monbliz2' ||
    missile.missileKey === 'monbliz3' ||
    missile.missileKey === 'monbliz4'
  ) {
    // 1.13c D2Client.dll CltHitFunc=19 (0x6FB66510, Issue #1171):
    // Missiles.txt monbliz1..4: CltHitSubMissile1 = 'monblizexplode1' (#111), CltHitSubMissile2 = 'monblizexplode3' (#113).
    // Randomly selects one of CltHitSubMissile1..2 (does NOT spawn icebreaksmall).
    if (!expKey) {
      const subExpKey =
        (SEED_RollRandomNumber(missile.seed) & 1) === 0 ? 'monblizexplode1' : 'monblizexplode3'
      const exp = this.spawnMissileByKey(subExpKey, hitX, hitY, hitX, hitY, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      exp.vx = 0
      exp.vy = 0
    }
  } else if (
    pCltHitFunc === 19 ||
    missile.missileKey === 'blizzard1' ||
    missile.missileKey === 'blizzard2' ||
    missile.missileKey === 'blizzard3' ||
    missile.missileKey === 'blizzard4'
  ) {
    // 1.13c D2Client.dll MISSMODE_CltHit19_Blizzard (0x6FB61080, Issue #1113):
    // ExplosionMissile is empty; CltHitSubMissile1='blizzardexplode1' (#163), CltHitSubMissile2='blizzardexplode3' (#165).
    // Uniformly rolls SEED_RollLimitedRandomNumber(missile.seed, sub2Id - sub1Id + 1) in [163..165] -> blizzardexplode1..3.
    if (!expKey) {
      const sub1 = CANONICAL_113C_MISSILES[hitRow?.cltHitSubMissile1 || 'blizzardexplode1']
      const sub2 = CANONICAL_113C_MISSILES[hitRow?.cltHitSubMissile2 || 'blizzardexplode3']
      const minId = sub1?.id ?? 163
      const maxId = Math.max(minId, sub2?.id ?? 165)
      const chosenId = minId + SEED_RollLimitedRandomNumber(missile.seed, maxId - minId + 1)
      const subExpKey = MISSILE_CLASS_ID_TO_KEY[chosenId] ?? 'blizzardexplode1'
      const exp = this.spawnMissileByKey(subExpKey, hitX, hitY, hitX, hitY, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      exp.vx = 0
      exp.vy = 0
    }
  } else if (
    pCltHitFunc === 1 ||
    missile.missileKey === 'fireball' ||
    missile.missileKey === 'explodingarrow' ||
    missile.missileKey === 'vampirefireball'
  ) {
    // 1.13c D2Client.dll MISSMODE_CltHit01_FireBall (0x6FB66DF0 -> 0x6FB66D00):
    // Spawns CltHitSubMissile1 ('fireexplosion2' #265) on every integer (dx, dy) in [-r..r]
    // with step = max(1, cHitPar2) where dx^2 + dy^2 <= r^2 (r = cHitPar1 = 3, step = 1 => 29 points).
    const subKey = hitRow?.cltHitSubMissile1 ?? 'fireexplosion2'
    const radius = hitRow?.cHitPar1 ?? 3
    const step = Math.max(1, hitRow?.cHitPar2 ?? 1)
    const rSq = radius * radius
    for (let dx = -radius; dx <= radius; dx += step) {
      for (let dy = -radius; dy <= radius; dy += step) {
        if (dx * dx + dy * dy <= rSq) {
          const sx = hitX + dx
          const sy = hitY + dy
          const subExp = this.spawnMissileByKey(subKey, sx, sy, sx, sy, {
            ownerType: missile.ownerType,
            ownerId: missile.ownerId,
            sourceSkillId: missile.sourceSkillId,
            skillLevel: missile.skillLevel,
            loopAnim: false,
          })
          subExp.vx = 0
          subExp.vy = 0
        }
      }
    }
  } else if (pCltHitFunc === 12 || missile.missileKey === 'immolationarrow') {
    // 1.13c D2Client.dll MISSMODE_CltHit12_ImmolationArrow (0x6FB6B220):
    // 0x6FB6B234: SKILLS_GetSkillsTxtRecord(27)->wCltMissileB = 'explodingarrowexp' (#42) spawned at (hitX, hitY).
    // Radius = cHitPar1 > 0 ? cHitPar1 : Skills.txt #27 calc1 (par2 = 3).
    // Duration = cHitCalc1 (100 frames), density = cHitPar2 (100%).
    // Spawns random pick of CltHitSubMissile1..3 ('firewall', 'firesmall', 'firemedium') across radius-3 disc.
    if (!expKey) {
      const centerExp = this.spawnMissileByKey('explodingarrowexp', hitX, hitY, hitX, hitY, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      centerExp.vx = 0
      centerExp.vy = 0
    }
    const radius = (hitRow?.cHitPar1 ?? 0) > 0 ? hitRow!.cHitPar1! : 3
    const duration = Number(hitRow?.cHitCalc1) || 100
    const density = hitRow?.cHitPar2 ?? 100
    const fireKeys = [
      hitRow?.cltHitSubMissile1 ?? 'firewall',
      hitRow?.cltHitSubMissile2 ?? 'firesmall',
      hitRow?.cltHitSubMissile3 ?? 'firemedium',
    ] as const
    const rSq = radius * radius
    const fireSeed: D2Seed = missile.missileSeed ?? {
      lo: ((Math.imul(missile.id, 0x6ac690c5) ^ 0x19660d) >>> 0) || 1,
      hi: LIGHT_SEED_HI,
    }
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx * dx + dy * dy > rSq) continue
        const fx = hitX + dx
        const fy = hitY + dy
        if (this.isSubTileBlocked(fx, fy)) continue
        if (density < 100 && d2Rand(fireSeed, 100) >= density) continue
        const fireKey = fireKeys[d2Rand(fireSeed, fireKeys.length)]!
        const patch = this.spawnMissileByKey(fireKey, fx, fy, fx, fy, {
          ownerType: missile.ownerType,
          ownerId: missile.ownerId,
          sourceSkillId: missile.sourceSkillId,
          skillLevel: missile.skillLevel,
          maxTicks: duration,
        })
        patch.vx = 0
        patch.vy = 0
      }
    }
  } else if (
    pCltHitFunc === 2 ||
    missile.missileKey === 'plaguejavelin' ||
    missile.missileKey === 'catapult plague ball'
  ) {
    // 1.13c D2Client.dll MISSMODE_CltHit02_PlagueJavelin (0x6FB6B1B0 -> 0x6FB66BC0):
    // Missiles.txt #43 ('plaguejavelin'): CltHitSubMissile1='plaguejavcloud' (#221, Range=60, Param1=2, Param2=4),
    // cHitPar1=1 (fast ring step), cHitPar2=2 (slow ring step), cHitPar3=3 (subLoops).
    // Missiles.txt #419 ('catapult plague ball'): CltHitSubMissile1='catapult plague cloud' (#420, Range=80, Param1=2, Param2=4),
    // cHitPar1=2 (fast ring step), cHitPar2=2 (slow ring step), cHitPar3=3 (subLoops).
    // Main ring: i = 0; i < 16; i += cHitPar2 (8 slow clouds at Param1<<7 => 0.046875 subtiles/tick).
    // Sub ring: i = 0; i < 15; i += cHitPar1 (fast clouds at (i+1) with Param2<<7 => 0.09375 subtiles/tick).
    const isCatPlague = missile.missileKey === 'catapult plague ball'
    const subKey =
      hitRow?.cltHitSubMissile1 ?? (isCatPlague ? 'catapult plague cloud' : 'plaguejavcloud')
    const subRow = CANONICAL_113C_MISSILES[subKey]
    const fastStep = hitRow?.cHitPar1 ?? (isCatPlague ? 2 : 1)
    const slowStep = Math.max(1, hitRow?.cHitPar2 ?? 2)
    const subLoops = hitRow?.cHitPar3 ?? 3
    const slowSpeed = ringMissileSpeedSubTilesPerTick113c(subRow?.param1 ?? 2)
    const fastSpeed = ringMissileSpeedSubTilesPerTick113c(subRow?.param2 ?? 4)
    const cloudMaxTicks = subRow?.range ?? (isCatPlague ? 80 : 60)
    for (let i = 0; i < 16; i += slowStep) {
      const dx = CLT_RING16_DX_113C[i]!
      const dy = CLT_RING16_DY_113C[i]!
      const cloud = this.spawnMissileByKey(subKey, hitX, hitY, hitX + dx, hitY + dy, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        maxTicks: cloudMaxTicks,
        pierce: true,
      })
      const len = Math.hypot(dx, dy) || 1
      cloud.vx = (dx / len) * slowSpeed
      cloud.vy = (dy / len) * slowSpeed
      cloud.subLoops = subLoops
    }
    if (fastStep > 0) {
      for (let i = 0; i < 15; i += fastStep) {
        const dx = CLT_RING16_DX_113C[i + 1]!
        const dy = CLT_RING16_DY_113C[i + 1]!
        const cloud = this.spawnMissileByKey(subKey, hitX, hitY, hitX + dx, hitY + dy, {
          ownerType: missile.ownerType,
          ownerId: missile.ownerId,
          sourceSkillId: missile.sourceSkillId,
          skillLevel: missile.skillLevel,
          maxTicks: cloudMaxTicks,
          pierce: true,
        })
        const len = Math.hypot(dx, dy) || 1
        cloud.vx = (dx / len) * fastSpeed
        cloud.vy = (dy / len) * fastSpeed
        cloud.subLoops = subLoops
      }
    }
  } else if (
    pCltHitFunc === 3 ||
    missile.missileKey === 'oilpotion' ||
    missile.missileKey === 'explosivepotion' ||
    missile.missileKey === 'fulminatingpotion' ||
    missile.missileKey === 'pantherpotorange'
  ) {
    // 1.13c D2Client.dll MISSMODE_CltHit03_FirePotion (0x6FB61100, Issue #1276):
    // Spawns CltHitSubMissile1 ('fireexplode' #29 for oilpotion, 'explodingarrowexp' #42 for explosivepotion/pantherpotorange,
    // 'explosivepotionexp' #51 for fulminatingpotion) at (hitX, hitY), plus random CltHitSubMissile2..3 debris when set.
    const sub1Key =
      hitRow?.cltHitSubMissile1 ??
      (missile.missileKey === 'oilpotion'
        ? 'fireexplode'
        : missile.missileKey === 'fulminatingpotion'
          ? 'explosivepotionexp'
          : 'explodingarrowexp')
    if (!expKey && sub1Key) {
      const exp = this.spawnMissileByKey(sub1Key, hitX, hitY, hitX, hitY, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        loopAnim: false,
      })
      exp.vx = 0
      exp.vy = 0
    }
    if (hitRow?.cltHitSubMissile2) {
      const sub2 = CANONICAL_113C_MISSILES[hitRow.cltHitSubMissile2]
      const sub3 = CANONICAL_113C_MISSILES[hitRow.cltHitSubMissile3 || hitRow.cltHitSubMissile2]
      const minId = sub2?.id ?? 52
      const maxId = Math.max(minId, sub3?.id ?? 54)
      const chosenId = minId + SEED_RollLimitedRandomNumber(missile.seed, maxId - minId + 1)
      const debrisKey = MISSILE_CLASS_ID_TO_KEY[chosenId] ?? hitRow.cltHitSubMissile2
      const debrisRow = CANONICAL_113C_MISSILES[debrisKey]
      const debris = this.spawnMissileByKey(debrisKey, hitX, hitY, hitX, hitY, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        maxTicks: Math.max(1, debrisRow?.range || debrisRow?.animLen || 29),
        loopAnim: false,
      })
      debris.vx = 0
      debris.vy = 0
    }
  } else if (pCltHitFunc === 28 || missile.missileKey === 'pantherpotgreen') {
    // 1.13c D2Client.dll MISSMODE_CltHit28_PantherPotGreen (0x6FB6ACB0 -> 0x6FB66290, Issue #1276):
    // Spawns 8-direction ring of CltHitSubMissile1 ('rancidgascloud' #222) at slowSpeed = Param1 << 7.
    const subKey = hitRow?.cltHitSubMissile1 ?? 'rancidgascloud'
    const subRow = CANONICAL_113C_MISSILES[subKey]
    const step = Math.max(1, hitRow?.cHitPar1 ?? 1) * 2
    const slowSpeed = ringMissileSpeedSubTilesPerTick113c(subRow?.param1 ?? 2)
    const cloudMaxTicks = subRow?.range ?? 60
    for (let i = 0; i < 16; i += step) {
      const dx = CLT_RING16_DX_113C[i]!
      const dy = CLT_RING16_DY_113C[i]!
      const cloud = this.spawnMissileByKey(subKey, hitX, hitY, hitX + dx, hitY + dy, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
        maxTicks: cloudMaxTicks,
        pierce: true,
      })
      const len = Math.hypot(dx, dy) || 1
      cloud.vx = (dx / len) * slowSpeed
      cloud.vy = (dy / len) * slowSpeed
    }
  } else if (pCltHitFunc === 30 || missile.missileKey === 'frozenorb') {
    // 1.13c D2Client.dll MISSMODE_CltHit30_FrozenOrb (0x6FB699D0):
    // Spawns 64 / max(1, cHitPar1) = 16 CltHitSubMissile1 ('frozenorbnova' #262, pCltDoFunc=20)
    // radially using the 64-entry circle table (CLTDO25_RING_X_113C / CLTDO25_RING_Y_113C).
    const subKey = hitRow?.cltHitSubMissile1 ?? 'frozenorbnova'
    const step = Math.max(1, hitRow?.cHitPar1 ?? 4)
    for (let idx = 0; idx < 64; idx += step) {
      const dx = CLTDO25_RING_X_113C[idx]!
      const dy = CLTDO25_RING_Y_113C[idx]!
      this.spawnMissileByKey(subKey, hitX, hitY, hitX + dx, hitY + dy, {
        ownerType: missile.ownerType,
        ownerId: missile.ownerId,
        sourceSkillId: missile.sourceSkillId,
        skillLevel: missile.skillLevel,
      })
    }
  } else if (pCltHitFunc === 25 || missile.missileKey === 'lightningfury') {
    // 1.13c D2Client.dll MISSMODE_CltHit25_LightningFury (0x6FB6AEF0, Issue #1123):
    // Missiles.txt #206 ('lightningfury'): AlwaysExplode=0, ExplosionMissile='', pCltHitFunc=25,
    // cHitPar1=0 -> Skills.txt #35 aurarangecalc (par3 = 15), cHitPar2=0 -> Skills.txt #35 calc1 (ln12 = 1 + slvl),
    // CltHitSubMissile1 = 'furylightning' (#231, Vel=30, Range=25, CollideKill=0).
    // Fires only on an actual unit hit (!isWallHit && hitUnit) and spawns bolts only toward found living hostiles (no radial ring fallback).
    if (!isWallHit && hitUnit) {
      const slvl = Math.max(1, missile.skillLevel ?? 1)
      const searchRadius = (hitRow?.cHitPar1 ?? 0) > 0 ? hitRow!.cHitPar1! : 15
      const maxBolts = (hitRow?.cHitPar2 ?? 0) > 0 ? hitRow!.cHitPar2! : 1 + slvl
      const subKey = hitRow?.cltHitSubMissile1 ?? 'furylightning'
      const hostiles = Array.from(this._monsters.values())
        .filter(
          (m) =>
            !m.dead &&
            m.mode !== 0 &&
            m.mode !== 12 &&
            (m.lifePct === undefined || m.lifePct > 0) &&
            !this.isFriendlyOrNonHostileMonster(m) &&
            m.id !== hitUnit.id &&
            Math.hypot(m.x - hitX, m.y - hitY) <= searchRadius,
        )
        .sort((a, b) => Math.hypot(a.x - hitX, a.y - hitY) - Math.hypot(b.x - hitX, b.y - hitY))
        .slice(0, maxBolts)
      for (const tgt of hostiles) {
        const bolt = this.spawnMissileByKey(subKey, hitX, hitY, tgt.x, tgt.y, {
          ownerType: missile.ownerType,
          ownerId: missile.ownerId,
          sourceSkillId: missile.sourceSkillId,
          skillLevel: missile.skillLevel,
          pierce: true,
        })
        bolt.hitUnitIds = new Set([hitUnit.id])
      }
    }
  }

  // Chain Lightning (15 subtiles, 5 + slvl) / Lightning Strike (20 subtiles, 1 + slvl) bounce to nearest unhit alive hostile monster (1.13c CltHitFunc=11)
  if (
    !isWallHit &&
    (missile.missileKey === 'chainlightning' || missile.missileKey === 'lightningstrike')
  ) {
    const slvl = Math.max(1, missile.skillLevel ?? 1)
    const maxHits = missile.missileKey === 'lightningstrike' ? 1 + slvl : 5 + slvl
    const searchRadius = missile.missileKey === 'lightningstrike' ? 20 : 15
    const hitCount = missile.hitUnitIds?.size ?? 0
    if (hitCount >= maxHits) {
      missile.pierce = false
    } else {
      let nearest: ClientUnit | null = null
      let bestDist = searchRadius
      for (const m of this._monsters.values()) {
        if (this.isFriendlyOrNonHostileMonster(m)) continue
        if (missile.hitUnitIds?.has(m.id)) continue
        const d = Math.hypot(m.x - hitX, m.y - hitY)
        if (d <= bestDist) {
          bestDist = d
          nearest = m
        }
      }
      if (nearest) {
        const speed = Math.hypot(missile.vx ?? 0, missile.vy ?? 0) || 1.5
        const dx = nearest.x - hitX
        const dy = nearest.y - hitY
        const dist = Math.hypot(dx, dy) || 1
        missile.vx = (dx / dist) * speed
        missile.vy = (dy / dist) * speed
        missile.direction = dir64FromPoints(hitX, hitY, nearest.x, nearest.y, missile.direction)
      } else {
        missile.pierce = false
      }
    }
  }
}

export function isFriendlyOrNonHostileMonsterImpl(
  this: ClientWorldInternal,
  m: ClientUnit,
  ignoreDead = false,
): boolean {
  if ((!ignoreDead && m.dead) || m.isNpc || m.ownerType === 'player') return true
  if ((m as any).hasOwner === true || (m.ownerId !== undefined && m.ownerId !== 0)) return true
  if (m.states.has(96) || m.states.has(53)) return true
  if (this._merc && m.id === this._merc.mercId) return true
  if (this._pets.has(m.id)) return true
  // Hireling HCIdx (Rogue 271, Desert Merc 338, Iron Wolf 359, Barbarian 560/561)
  if (
    m.classId === 271 ||
    m.classId === 338 ||
    m.classId === 359 ||
    m.classId === 560 ||
    m.classId === 561
  ) {
    return true
  }
  // Player summons/totems/sentries (Clay/Blood/Iron/Fire Golem 289..292, Bone Wall/Prison 344, Hydra 351..353,
  // Decoy/Dopplezon 356, Valkyrie 357, Iron Wolf/Necro Skeletons 363..364, Assassin traps/Shadow & Druid pets 410..428)
  if (
    (m.classId >= 289 && m.classId <= 292) ||
    m.classId === 344 ||
    (m.classId >= 351 && m.classId <= 353) ||
    m.classId === 356 ||
    m.classId === 357 ||
    m.classId === 363 ||
    m.classId === 364 ||
    (m.classId >= 410 && m.classId <= 428)
  ) {
    return true
  }
  if ((m as { align?: number }).align === 1 || (m as { align?: number }).align === 2) return true
  if ((m as { killable?: boolean }).killable === false) return true
  // 1.13c D2Client 0x6FB562A0 / 0x6FB51620 & D2Game sub_6FD0FA00:
  // Non-hostile alignment (MonStats.txt Align != 0), NPC flag (npc == 1), non-attackable
  // units (MonStats2.txt isAtt == 0 / UNITFLAG_CANBEATTACKED == 0), and critters (critter == 1)
  // are never valid hostile missile/skill/melee targets.
  if (Number.isInteger(m.classId) && m.classId >= 0 && m.classId < MONSTATS_113C_ROWS.length) {
    const monRow = MONSTATS_113C_ROWS[m.classId]
    if (monRow !== undefined) {
      if (monRow.align !== 0 || monRow.npc) return true
      if (
        !hasMonStats2Flag(m.classId, MONSTATS2_FLAGINDEX.ISATT) ||
        hasMonStats2Flag(m.classId, MONSTATS2_FLAGINDEX.CRITTER)
      ) {
        return true
      }
    }
  }
  return false
}

export function syncPlayerTownModesImpl(this: ClientWorldInternal): void {
  const inTown = isTownLevel(this.areaId)
  for (const unit of this._units.values()) {
    if (unit.unitType !== 'player') continue
    if (unit.mode === 1 || unit.mode === 5) {
      unit.mode = inTown ? 5 : 1
    } else if (unit.mode === 2 || unit.mode === 6) {
      unit.mode = inTown ? 6 : 2
    }
  }
}

export function stepMissileUnitImpl(this: ClientWorldInternal, unit: ClientUnit): void {
  const prevX = unit.x
  const prevY = unit.y
  const prevAgeTicks = unit.ageTicks ?? 0
  const remBeforeStep = Math.max(0, (unit.maxTicks ?? 1) - prevAgeTicks)
  const vx = unit.vx ?? 0
  const vy = unit.vy ?? 0
  const isMeteor3D =
    unit.missileKey === 'meteor' ||
    unit.missileKey === 'meteortail' ||
    unit.missileKey === 'vampiremeteor' ||
    unit.missileKey === 'royalstrikemeteor' ||
    unit.missileKey === 'royalstrikemeteortail'
  const isQuestFxController =
    unit.missileKey === 'denofevillight' ||
    unit.missileKey === 'cairnstones' ||
    unit.missileKey === 'cairnstonesground' ||
    unit.missileKey === 'diablo appears' ||
    unit.missileKey === 'cairn stones bolt' ||
    unit.missileKey === 'andycontrol0' ||
    unit.missileKey === 'andycolumnfirebase' ||
    unit.missileKey === 'andyfirewallmaker' ||
    unit.missileKey === 'durieldeathcontrol' ||
    unit.missileKey === 'brdeathcontrol' ||
    unit.missileKey === 'radamentdeath' ||
    unit.missileKey === 'queendeathcenter' ||
    unit.missileKey === 'mephistodeathcontrol' ||
    unit.missileKey === 'mephistofirewallmaker' ||
    unit.missileKey === 'mephistodonotdraw' ||
    unit.missileKey === 'mephistoflyingrocksbig' ||
    unit.missileKey === 'mephistoflyingrockssmall' ||
    unit.missileKey === 'izual control' ||
    unit.missileKey === 'diabwallmaker' ||
    unit.missileKey === 'overseercontrol' ||
    unit.missileKey === 'nehlithakcontrol' ||
    unit.missileKey === 'ancient death center' ||
    unit.missileKey === 'baalfx control' ||
    unit.missileKey === 'baal taunt control' ||
    unit.missileKey === 'horadricstaff' ||
    unit.missileKey === 'horadriclight' ||
    unit.missileKey === 'horadriclightning' ||
    unit.missileKey === 'dust' ||
    unit.missileKey === 'orbmist' ||
    unit.missileKey === 'orbmisttrail' ||
    unit.missileKey === 'orbmistfade' ||
    unit.missileKey === 'towermist' ||
    unit.missileKey === 'towermisttrail' ||
    unit.missileKey === 'towermistfade' ||
    unit.missileKey === 'towerchestspawner'
  const isHurricaneOrbit =
    unit.missileKey === 'hurricaneswoosh' ||
    unit.missileKey === 'hurricanerock' ||
    unit.missileKey === 'hurricanetree' ||
    unit.missileKey === 'hurricanecart' ||
    unit.missileKey === 'hurricanesack' ||
    unit.missileKey === 'hurricanevase'
  const isMoving =
    vx !== 0 || vy !== 0 || unit.missileKey === 'blessedhammer' || isHurricaneOrbit || isMeteor3D
  // 1.13c UNIT_Step3DTrajectory (0x6fb77fb0, unit tick 0x6fadb2a5) for a trajectory a CltDoFunc set explicitly.
  const traj3d = unit.traj3d
  if (traj3d !== undefined) unit.altitude = stepTraj3dZ(traj3d)

  if (isMoving) {
    if (isMeteor3D) {
      // 1.13c D2Client.dll UNIT_Step3DTrajectory (0x6fb77fb0) & D2Common_10132 (0x6fd9db40):
      // Step xOffset (+15 sub-units/tick = +15/32 sub-tiles/tick) and zOffset (+25 px/tick)
      // continuously over 59 frames until landing at (targetX, targetY) with altitude = 0.
      const nextTick = (unit.ageTicks ?? 0) + 1
      const descentTicks = Math.max(1, (unit.maxTicks ?? 60) - 1)
      const rem = Math.max(0, descentTicks - nextTick)
      const destX = unit.targetX ?? unit.originX ?? unit.x
      const destY = unit.targetY ?? unit.originY ?? unit.y
      unit.vx = 15 / 32
      unit.vy = 0
      unit.x = destX - (15 * rem) / 32
      unit.y = destY
      unit.altitude = 25 * rem
    } else if (unit.missileKey === 'blessedhammer') {
      // 1.13c Missiles.txt row 92 ('blessedhammer'): Range=95, Par1=10, Par2=20:
      // dTheta = 2*pi / (512 / 10.13) ≈ 0.12435 rad/tick (~2.02 sec/rev),
      // dR = 95 / 1024 ≈ 0.09277 sub-tiles/tick (~8.8 sub-tiles max radius at tick 95, Issue #1279).
      unit.spiralAngle = (unit.spiralAngle ?? 0) + 0.12435
      unit.spiralRadius = (unit.spiralRadius ?? 0) + 0.09277
      const nextX = (unit.originX ?? unit.x) + Math.cos(unit.spiralAngle) * unit.spiralRadius
      const nextY = (unit.originY ?? unit.y) + Math.sin(unit.spiralAngle) * unit.spiralRadius
      unit.vx = nextX - unit.x
      unit.vy = nextY - unit.y
      unit.x = nextX
      unit.y = nextY
    } else if (isHurricaneOrbit) {
      const ownerUnit =
        unit.ownerType && unit.ownerId !== undefined
          ? this.getUnit(unit.ownerType, unit.ownerId)
          : undefined
      const cx = ownerUnit ? ownerUnit.x : (unit.originX ?? unit.x)
      const cy = ownerUnit ? ownerUnit.y : (unit.originY ?? unit.y)
      unit.originX = cx
      unit.originY = cy
      unit.spiralAngle = (unit.spiralAngle ?? 0) + 0.18
      const rad = unit.spiralRadius ?? 3.0
      const nextX = cx + Math.cos(unit.spiralAngle) * rad
      const nextY = cy + Math.sin(unit.spiralAngle) * rad
      unit.vx = nextX - unit.x
      unit.vy = nextY - unit.y
      unit.x = nextX
      unit.y = nextY
    } else if (unit.pathWaypoints && unit.pathWaypoints.length > 0) {
      // 1.13c D2Common.dll sub_6FD5D0A0 (0x6FD5D0A0) + PATH_ComputeVelocityAndDirectionVectorsToNextPoint (0x6FD5D240):
      // Step along PATHTYPE_CHARGEDBOLT (0x6FDB6AA0) 2-sub-tile waypoints at missile velocity.
      const speed = Math.hypot(vx, vy) || 0.5625
      let remaining = speed
      let idx = unit.pathWaypointIndex ?? 0
      const waypoints = unit.pathWaypoints
      while (remaining > 1e-5 && idx < waypoints.length) {
        const wp = waypoints[idx]!
        const wpDx = wp.x - unit.x
        const wpDy = wp.y - unit.y
        const wpDist = Math.hypot(wpDx, wpDy)
        if (wpDist <= remaining) {
          unit.x = wp.x
          unit.y = wp.y
          remaining -= wpDist
          idx++
          unit.pathWaypointIndex = idx
          if (idx < waypoints.length) {
            const nextWp = waypoints[idx]!
            const nextDx = nextWp.x - unit.x
            const nextDy = nextWp.y - unit.y
            const nextDist = Math.hypot(nextDx, nextDy)
            if (nextDist > 1e-5) {
              unit.vx = (nextDx / nextDist) * speed
              unit.vy = (nextDy / nextDist) * speed
            }
          }
        } else {
          const inv = 1 / wpDist
          unit.vx = wpDx * inv * speed
          unit.vy = wpDy * inv * speed
          unit.x += wpDx * inv * remaining
          unit.y += wpDy * inv * remaining
          remaining = 0
        }
      }
      if (remaining > 1e-5) {
        const len = Math.hypot(unit.vx ?? 0, unit.vy ?? 0)
        if (len > 1e-5) {
          unit.x += ((unit.vx ?? 0) / len) * remaining
          unit.y += ((unit.vy ?? 0) / len) * remaining
        }
      }
    } else {
      if (unit.missileKey === 'guidedarrow' && prevAgeTicks % 5 === 0) {
        // 1.13c Guided Arrow MISSMODE_SrvDo07_GuidedArrow_BoneSpirit (0x6FC59DC0) / MISSMODE_CltDo07 (0x6FB62EB0, Issue #1292 / #1306):
        // Every Param1=5 frames, follow locked living hostile target within 25 sub-tiles, or acquire nearest living
        // hostile monster within Param2=15 sub-tiles and steer velocity + direction directly toward it.
        // In Missiles.txt, guidedarrow (#86) has LastCollide = 0, so once a pierced monster is outside collision range
        // on the 5-frame homing tick, clear its temporary collision lock so a piercing arrow can turn back and hit again.
        if (unit.piercedTargets && unit.piercedTargets.size > 0) {
          for (const piercedId of Array.from(unit.piercedTargets)) {
            const pm = this._monsters.get(piercedId)
            if (!pm || Math.hypot(pm.x - unit.x, pm.y - unit.y) > 2.25) {
              unit.piercedTargets.delete(piercedId)
            }
          }
        }
        const isAliveHostileGuidedArrowTarget = (cand: ClientUnit | undefined): cand is ClientUnit =>
          cand !== undefined &&
          !cand.dead &&
          cand.mode !== 0 &&
          cand.mode !== 12 &&
          (cand.lifePct === undefined || cand.lifePct > 0) &&
          cand.unitType === 'monster' &&
          !this.isFriendlyOrNonHostileMonster(cand)

        let target =
          unit.homingTarget !== undefined
            ? (this.getUnit(unit.homingTarget.unitType, unit.homingTarget.id) as ClientUnit | undefined)
            : undefined
        if (
          !isAliveHostileGuidedArrowTarget(target) ||
          Math.hypot(target.x - unit.x, target.y - unit.y) > 25 ||
          unit.piercedTargets?.has(target.id)
        ) {
          unit.homingTarget = undefined
          target = undefined
          let nearestUnhit: ClientUnit | undefined
          let bestUnhitDist = 15
          let nearestAny: ClientUnit | undefined
          let bestAnyDist = 15
          for (const m of this._monsters.values()) {
            if (!isAliveHostileGuidedArrowTarget(m)) continue
            if (unit.piercedTargets?.has(m.id)) continue
            const d = Math.hypot(m.x - unit.x, m.y - unit.y)
            if (d <= bestAnyDist) {
              bestAnyDist = d
              nearestAny = m
            }
            if (!unit.hitUnitIds?.has(m.id) && d <= bestUnhitDist) {
              bestUnhitDist = d
              nearestUnhit = m
            }
          }
          const chosen = nearestUnhit ?? nearestAny
          if (chosen !== undefined) {
            unit.homingTarget = { unitType: 'monster', id: chosen.id }
            target = chosen
          }
        }
        if (target !== undefined) {
          const curSpeed = Math.hypot(unit.vx ?? 0, unit.vy ?? 0) || 1.125
          const dx = target.x - unit.x
          const dy = target.y - unit.y
          const dist = Math.hypot(dx, dy)
          if (dist > 1e-5) {
            unit.vx = (dx / dist) * curSpeed
            unit.vy = (dy / dist) * curSpeed
            unit.direction = dir64FromPoints(unit.x, unit.y, target.x, target.y, unit.direction)
          }
        }
      }
      if (unit.missileKey === 'bonespirit' || unit.missileKey === 'monbonespirit') {
        // 1.13c MISSMODE_SrvDo07_GuidedArrow_BoneSpirit (0x6FC59DC0) / MISSMODE_CltDo07 (0x6FB62EB0, Issue #1300):
        // Every CltParam1 (5) elapsed frames, track the locked living hostile target while within 25 sub-tiles;
        // if no living hostile target is locked, search within Param2 (15) sub-tiles for the nearest living hostile target.
        const isAliveHostileBoneSpiritTarget = (cand: ClientUnit | undefined): cand is ClientUnit =>
          cand !== undefined &&
          !cand.dead &&
          cand.mode !== 0 &&
          cand.mode !== 12 &&
          (cand.lifePct === undefined || cand.lifePct > 0) &&
          (unit.ownerType === 'monster'
            ? cand.unitType === 'player' || Boolean(this._merc && cand.id === this._merc.mercId)
            : cand.unitType === 'monster' && !this.isFriendlyOrNonHostileMonster(cand))

        let target =
          unit.homingTarget !== undefined
            ? (this.getUnit(unit.homingTarget.unitType, unit.homingTarget.id) as ClientUnit | undefined)
            : undefined
        if (!isAliveHostileBoneSpiritTarget(target)) {
          unit.homingTarget = undefined
          target = undefined
          if (prevAgeTicks % BONESPIRIT_CLT_PARAM1_113C === 0) {
            let nearest: ClientUnit | undefined
            let bestDist = 15
            if (unit.ownerType === 'monster') {
              for (const cand of this._units.values()) {
                if (cand.unitType !== 'player' && !(this._merc && cand.id === this._merc.mercId)) continue
                if (!isAliveHostileBoneSpiritTarget(cand)) continue
                const d = Math.hypot(cand.x - unit.x, cand.y - unit.y)
                if (d <= bestDist) {
                  bestDist = d
                  nearest = cand
                }
              }
            } else {
              for (const m of this._monsters.values()) {
                if (!isAliveHostileBoneSpiritTarget(m)) continue
                const d = Math.hypot(m.x - unit.x, m.y - unit.y)
                if (d <= bestDist) {
                  bestDist = d
                  nearest = m
                }
              }
            }
            if (nearest !== undefined) {
              unit.homingTarget = { unitType: nearest.unitType, id: nearest.id }
              target = nearest
            }
          }
        }
        if (target !== undefined) {
          const targetSize =
            target.unitType === 'monster' ? getMonsterSizeXByHcIdx(target.classId) : target.unitType === 'player' ? 2 : 0
          const distance = unitDistance113c(unit.x, unit.y, BONESPIRIT_SIZE_113C, target.x, target.y, targetSize)
          if (
            shouldCltDo07Repath113c(prevAgeTicks, BONESPIRIT_CLT_PARAM1_113C, distance) ||
            (prevAgeTicks % BONESPIRIT_CLT_PARAM1_113C === 0 && distance > 0 && distance <= 3)
          ) {
            const curSpeed = Math.hypot(unit.vx ?? 0, unit.vy ?? 0)
            const dx = target.x - unit.x
            const dy = target.y - unit.y
            const dist = Math.hypot(dx, dy)
            if (curSpeed > 0 && dist > 1e-5) {
              unit.vx = (dx / dist) * curSpeed
              unit.vy = (dy / dist) * curSpeed
              unit.direction = dir64FromPoints(unit.x, unit.y, target.x, target.y, unit.direction)
            }
          }
        }
      }
      if (
        unit.missileKey === 'fingermagespider' &&
        (unit as any).spiderTrailActive &&
        unit.homingTarget !== undefined
      ) {
        // 1.13c MISSMODE_CltDo15 (0x6FB68BC0, Missiles.txt #177 'fingermagespider', Issue #1193):
        // Every CltParam3 (5) elapsed frames, if target is alive and within CltParam4 (20) subtiles,
        // re-paths velocity toward target.
        const row = CANONICAL_113C_MISSILES[unit.missileKey]
        const repathMod = Math.max(1, row?.cltParam3 ?? 5)
        const maxDist = row?.cltParam4 ?? 20
        if (prevAgeTicks > 0 && prevAgeTicks % repathMod === 0) {
          const target = this.getUnit(unit.homingTarget.unitType, unit.homingTarget.id) as ClientUnit | undefined
          if (target !== undefined && !target.dead) {
            const curSpeed = Math.hypot(unit.vx ?? 0, unit.vy ?? 0)
            const dx = target.x - unit.x
            const dy = target.y - unit.y
            const dist = Math.hypot(dx, dy)
            if (curSpeed > 0 && dist > 1e-5 && dist <= maxDist) {
              unit.vx = (dx / dist) * curSpeed
              unit.vy = (dy / dist) * curSpeed
              unit.direction = dir64FromPoints(unit.x, unit.y, target.x, target.y, unit.direction)
            }
          }
        }
      }
      if (unit.missileKey === 'frozenorbnova') {
        // 1.13c D2Client.dll MISSMODE_CltDo20_FrozenOrbNova (0x6FB69090):
        // When remaining ticks < CltParam1 (6) and divisible by CltParam2 (2),
        // rotates velocity direction by +8 in 64-dir space (+45 deg = Math.PI / 4).
        const row = CANONICAL_113C_MISSILES[unit.missileKey]
        const cltParam1 = row?.cltParam1 ?? 6
        const cltParam2 = Math.max(1, row?.cltParam2 ?? 2)
        if (remBeforeStep > 0 && remBeforeStep < cltParam1 && remBeforeStep % cltParam2 === 0) {
          const curVx = unit.vx ?? 0
          const curVy = unit.vy ?? 0
          const cos45 = Math.SQRT1_2
          const sin45 = Math.SQRT1_2
          unit.vx = curVx * cos45 - curVy * sin45
          unit.vy = curVx * sin45 + curVy * cos45
        }
      }
      if (unit.accel !== undefined && unit.accel < 0) {
        const speed = Math.hypot(unit.vx ?? 0, unit.vy ?? 0)
        if (speed > 0) {
          const nextSpeed = Math.max(0.15, speed * (1 + unit.accel / 12800))
          const scale = nextSpeed / speed
          unit.vx = (unit.vx ?? 0) * scale
          unit.vy = (unit.vy ?? 0) * scale
        }
      }
      unit.x += unit.vx ?? 0
      unit.y += unit.vy ?? 0
      if (
        unit.missileKey === 'firestormmaker' ||
        unit.missileKey === 'twister' ||
        unit.missileKey === 'tornado'
      ) {
        const speed = Math.hypot(unit.vx ?? 0, unit.vy ?? 0)
        if (speed > 1e-5) {
          const baseAng = Math.atan2(unit.vy ?? 0, unit.vx ?? 0)
          const phase = (prevAgeTicks + 1) * 0.6 + (unit.jitterIndex ?? 0) * 2.094
          const waveAmp = unit.missileKey === 'tornado' ? 0.35 : 0.45
          unit.x += -Math.sin(baseAng) * Math.sin(phase) * speed * waveAmp
          unit.y += Math.cos(baseAng) * Math.sin(phase) * speed * waveAmp
        }
      }
      if (traj3d !== undefined) {
        // altitude already stepped above
      } else if ((unit as any).lobPeakAltitude !== undefined && (unit.maxTicks ?? 0) > 0) {
        const nextAge = (unit.ageTicks ?? 0) + 1
        const t = Math.min(1, Math.max(0, nextAge / unit.maxTicks!))
        unit.altitude = Math.round(4 * (unit as any).lobPeakAltitude * t * (1 - t))
      } else if (unit.verticalDescentPerTick !== undefined && unit.verticalDescentPerTick !== 0) {
        unit.altitude = Math.max(0, (unit.altitude ?? 0) - unit.verticalDescentPerTick)
      } else if (unit.altitude !== undefined && unit.altitude > 0 && unit.missileKey !== 'lightninghit') {
        const startAlt =
          unit.missileKey?.startsWith('blizzard') || unit.missileKey?.startsWith('monbliz')
            ? 120
            : 240
        const progress = Math.min(
          1,
          ((unit.ageTicks ?? 0) + 1) / Math.max(1, unit.maxTicks ?? 1),
        )
        unit.altitude = Math.max(0, Math.round(startAlt * (1 - progress)))
      }
    }
    if (unit.fixedDirection !== true && ((unit.vx ?? 0) !== 0 || (unit.vy ?? 0) !== 0)) {
      unit.direction = dir64FromPoints(0, 0, unit.vx ?? 0, unit.vy ?? 0, unit.direction)
    }
    const mSoundEntry = getMissileSoundEntry113c(
      unit.classId > 0 ? unit.classId : (unit.missileKey ?? ''),
    )
    if (mSoundEntry && mSoundEntry.travelSound > 0) {
      this.pushSoundRequest({
        kind: 'missile-tick',
        entityId: unit.id,
        x: unit.x,
        y: unit.y,
      })
    }
  } else if (!isMeteor3D && traj3d === undefined && (unit as any).lobPeakAltitude === undefined && unit.altitude !== undefined) {
    if (unit.verticalDescentPerTick !== undefined && unit.verticalDescentPerTick !== 0) {
      // 1.13c D2Client CltDoFunc 22 (0x6fb627a0) / CltStFunc 44 (0x6fb07540): zOffset steps by verticalDescentPerTick
      unit.altitude = Math.max(0, unit.altitude - unit.verticalDescentPerTick)
    } else if (unit.altitude > 0 && unit.missileKey !== 'lightninghit') {
      // Purely vertical falling missiles (e.g. 1.13c blizzard1..4 / monbliz1..4 with vel=0, range=9)
      const startAlt =
        unit.missileKey?.startsWith('blizzard') || unit.missileKey?.startsWith('monbliz')
          ? 120
          : 240
      const progress = Math.min(
        1,
        ((unit.ageTicks ?? 0) + 1) / Math.max(1, unit.maxTicks ?? 1),
      )
      unit.altitude = Math.max(0, Math.round(startAlt * (1 - progress)))
    }
  }

  unit.ageTicks = (unit.ageTicks ?? 0) + 1
  if ((unit as any).lobPeakAltitude !== undefined && (unit.maxTicks ?? 0) > 0) {
    const t = Math.min(1, Math.max(0, unit.ageTicks / unit.maxTicks!))
    unit.altitude = Math.round(4 * (unit as any).lobPeakAltitude * t * (1 - t))
  }
  const animSpeed = Math.max(1, unit.animSpeed ?? 16)
  const totalFrames = Math.max(1, unit.totalFrames ?? 1)
  const rawFrame = (unit.initialFrame ?? 0) + Math.floor((unit.ageTicks * animSpeed) / 16)
  if (
    unit.subLoop === 1 &&
    unit.subStart !== undefined &&
    unit.subStop !== undefined &&
    unit.subStop > unit.subStart
  ) {
    const subStart = unit.subStart
    const subStop = unit.subStop
    const burnoutFrames = Math.max(0, totalFrames - 1 - subStop)
    const ticksRemaining = Math.max(0, (unit.maxTicks ?? 1) - unit.ageTicks)
    if (burnoutFrames === 0) {
      // 1.13c D2Client.dll MISSMODE_CltDo05_GroundFire (0x6fb62f90):
      // Emergence frames [0..subStart-1], active SubLoop [subStart..subStop] with per-unit phase
      // desynchronization, and reverse emergence fade-out during the final subStart ticks.
      if (ticksRemaining < subStart) {
        unit.frame = Math.max(0, Math.min(subStart - 1, ticksRemaining))
      } else if (rawFrame < subStart) {
        unit.frame = rawFrame
      } else {
        const loopSpan = subStop - subStart + 1
        const phaseOffset = (unit.id * 7) % Math.max(1, subStop - subStart)
        unit.frame = subStart + ((rawFrame - subStart + phaseOffset) % loopSpan)
      }
    } else if (
      subStop - subStart <= 1 ||
      unit.missileKey === 'volcano' ||
      unit.missileKey === 'volcano overlay fire'
    ) {
      const outroFrames = Math.max(0, totalFrames - subStop)
      if (ticksRemaining <= outroFrames) {
        unit.frame = Math.min(totalFrames - 1, totalFrames - Math.max(1, ticksRemaining))
      } else if (rawFrame < subStart) {
        unit.frame = rawFrame
      } else if (subStop - subStart <= 1) {
        unit.frame = subStart
      } else {
        unit.frame = subStart + ((rawFrame - subStart) % (subStop - subStart))
      }
    } else if (ticksRemaining > burnoutFrames) {
      if (rawFrame < subStart) {
        unit.frame = rawFrame
      } else {
        unit.frame = subStart + ((rawFrame - subStart) % (subStop - subStart + 1))
      }
    } else {
      const burnoutProgress = burnoutFrames - ticksRemaining
      unit.frame = Math.min(totalFrames - 1, subStop + 1 + burnoutProgress)
    }
  } else {
    unit.frame =
      unit.loopAnim === false ? Math.min(totalFrames - 1, rawFrame) : rawFrame % totalFrames
  }

  if (unit.missileKey === 'cursecenter' || unit.missileKey === 'mindblast center') {
    // 1.13c MISSMODE_CltDo17_CurseCenter (0x6fb6bb40): scatter waves on elapsed % 3 === 0 while elapsed < CltParam1
    // (CltParam1 = 7 for cursecenter -> 0/3/6; CltParam1 = 10 for mindblast center -> 0/3/6/9).
    if (!(prevAgeTicks === 0 && (unit as any).curseCenterWave0Spawned)) {
      tickCurseCenter113c(this.spawnMissileByKey.bind(this), unit, prevAgeTicks)
    }
  }

  const cltDoRow = unit.missileKey ? CANONICAL_113C_MISSILES[unit.missileKey] : undefined
  if (
    cltDoRow?.pCltDoFunc === 4 ||
    unit.missileKey === 'poisonjavcloud' ||
    unit.missileKey === 'plaguejavcloud' ||
    unit.missileKey === 'corpsepoisoncloud' ||
    unit.missileKey === 'poisonexplosioncloud' ||
    unit.missileKey === 'primepoisoncloud' ||
    unit.missileKey === 'rancidgascloud' ||
    unit.missileKey === 'chokinggascloud' ||
    unit.missileKey === 'stranglinggascloud' ||
    unit.missileKey === 'catapult plague cloud' ||
    unit.missileKey === 'baal taunt poison'
  ) {
    // 1.13c MISSMODE_CltDo04 (0x6FB6BE00 -> 0x6FB69470), run before the CltDo01 step from the cloud's
    // position: CltParam2 poisonpuff (CltSubMissile1) per spawn, 1-in-CltParam1 chance per frame (always on
    // the last frame), aimed CltParam3..2*CltParam3-1 sub-tiles away per axis; puff Vel/Range from Missiles.txt.
    unit.missileSeed ??= { lo: unit.id >>> 0, hi: 666 }
    const row = cltDoRow
    const cltParam1 = row?.cltParam1 ?? POISONEXPLOSIONCLOUD_113C.cltParam1
    const cltParam2 = row?.cltParam2 ?? POISONEXPLOSIONCLOUD_113C.cltParam2
    const cltParam3 = row?.cltParam3 ?? POISONEXPLOSIONCLOUD_113C.cltParam3
    const subKey = row?.cltSubMissile1 || POISONEXPLOSIONCLOUD_113C.cltSubMissile1
    for (const aim of rollPoisonCloudPuffTargets113c(
      unit.missileSeed,
      Math.max(0, (unit.maxTicks ?? 1) - unit.ageTicks),
      prevX,
      prevY,
      cltParam1,
      cltParam2,
      cltParam3,
    )) {
      this.spawnMissileByKey(subKey, prevX, prevY, aim.x, aim.y, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        sourceSkillId: unit.sourceSkillId,
        skillLevel: unit.skillLevel,
        // Missiles.txt poisonpuff: no CollideType / CollideKill — passes through units.
        pierce: true,
      })
    }
  }

  // 1.13c Quest FX & Boss Death FX missile CltDoFunc callbacks (Issues #872, #873)
  const mSeed = unit.missileSeed ?? this._questFxSeed
  if (unit.missileKey === 'denofevillight') {
    // 1.13c MISSMODE_CltDo23 (0x6fb62980): if remaining ticks < 100, extend lifetime by +500
    if ((unit.maxTicks ?? 300) - unit.ageTicks < 100) {
      unit.maxTicks = unit.ageTicks + 500
    }
  } else if (unit.missileKey === 'cairnstones') {
    // 1.13c MISSMODE_CltDo24 (0x6fb6b8f0):
    // Phase A: random sky lightning bolts (384) around StoneAlpha when 40 < rem < 260 and elapsed % 2 === 0
    // Phase B: stone-top sky lightning bolts (384) + inter-stone ground arcs (290) when 40 < rem < 165
    const row288 = QUEST_FX_MISSILES_113C[288]!
    const rem = remBeforeStep
    const elapsed = prevAgeTicks
    if (row288.cltParam1 < rem && rem < row288.range - row288.cltParam1) {
      if (elapsed % Math.max(1, row288.cltParam2) === 0) {
        const seed: D2Seed = {
          lo: (elapsed + Math.floor(unit.x)) >>> 0,
          hi: LIGHT_SEED_HI,
        }
        const rx = 16 - d2Rand(seed, 32)
        const ry = 16 - d2Rand(seed, 32)
        const bx = Math.floor(unit.x) + rx
        const by = Math.floor(unit.y) + ry
        if (!this.isSubTileBlocked(bx, by)) {
          this.spawnCairnSkyBolt(bx, by, unit)
        }
      }
    }
    if (row288.cltParam1 < rem && rem < row288.cltParam1 + 125) {
      const row290 = QUEST_FX_MISSILES_113C[290]!
      for (const stone of this._units.values()) {
        if (
          stone.unitType !== 'object' ||
          stone.classId < 17 ||
          stone.classId > 21 ||
          Math.abs(stone.x - unit.x) >= 40 ||
          Math.abs(stone.y - unit.y) >= 40
        ) {
          continue
        }
        this.spawnCairnSkyBolt(stone.x, stone.y, unit)
        if (rem % 8 === 0) {
          const prevStone =
            unit.cairnPrevStoneId !== undefined
              ? this.getUnit('object', unit.cairnPrevStoneId)
              : undefined
          if (!prevStone) {
            unit.cairnPrevStoneId = stone.id
          } else {
            const dist = Math.hypot(prevStone.x - stone.x, prevStone.y - stone.y)
            if (dist > 1e-5) {
              const dwVel = Math.floor(((row290.vel << 8) * 75) / 100)
              const groundSpeed = (16 * dwVel) / 65536
              const groundTicks = Math.max(1, Math.floor(dist / groundSpeed))
              const gBolt = this.spawnMissileByKey(
                'cairnstonesground',
                stone.x,
                stone.y,
                prevStone.x,
                prevStone.y,
                {
                  classId: row290.id,
                  ownerType: unit.ownerType,
                  ownerId: unit.ownerId,
                  maxTicks: groundTicks,
                  pierce: true,
                  missileSeed: {
                    lo: ((stone.id ^ 0x6ac690c5) + rem) >>> 0,
                    hi: LIGHT_SEED_HI,
                  },
                },
              )
              gBolt.alwaysExplode = false
            }
            const ctrlSeed = unit.missileSeed ?? this._questFxSeed
            if (d2Rand(ctrlSeed, 4) === 0) {
              unit.cairnPrevStoneId = stone.id
            }
          }
        }
      }
    }
  } else if (unit.missileKey === 'cairnstonesground') {
    // 1.13c MISSMODE_CltDo08 (0x6fb691c0) for cairnstonesground (290):
    // spawns CltSubMissile1 = lightninghit (99) at current position with zOffset = rand(16) - 8
    const row99 = QUEST_FX_MISSILES_113C[99]!
    const zOff = d2Rand(mSeed, 16) - 8
    const initFrame = d2Rand(mSeed, row99.animLen)
    const trail = this.spawnMissileByKey(
      'lightninghit',
      unit.x,
      unit.y,
      unit.x + (unit.vx ?? 1),
      unit.y + (unit.vy ?? 0),
      {
        classId: row99.id,
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        maxTicks: row99.range,
        altitude: zOff,
        initialFrame: initFrame,
        loopAnim: false,
        expandSubMissiles: false,
      },
    )
    trail.vx = 0
    trail.vy = 0
  } else if (unit.missileKey === 'horadricstaff') {
    // 1.13c MISSMODE_CltDo31 (0x6fb64b80); rem = #10737 before the CltDoFunc 1 tail decrements it.
    const staffSeed = unit.missileSeed
    if (staffSeed === undefined) throw new Error('horadricstaff: missing unit seed (unit+0x20)')
    const tick = horadricStaffTick(remBeforeStep, Math.floor(unit.x), Math.floor(unit.y), staffSeed)
    if (tick.shake) this.startScreenShake(HORADRIC_SHAKE_SUSTAIN_MS, HORADRIC_SHAKE_AMPLITUDE, 0, 0)
    for (const spawn of tick.spawns) this.spawnHoradricStaffChild(spawn, unit)
  } else if (unit.missileKey === 'orbmist') {
    // 1.13c MISSMODE_CltDo25 (0x6fb683d0) runs before the CltDoFunc 1 tail moves the mist: elapsed = #10985 and the
    // position is the one of this tick's start.
    const mistSeed = unit.missileSeed
    if (mistSeed === undefined) throw new Error('orbmist: missing unit seed (unit+0x20)')
    const spawn = orbMistTick(prevAgeTicks, Math.floor(prevX), Math.floor(prevY), mistSeed)
    if (spawn !== null) {
      const row = ORB_MIST_MISSILE_ROWS.trail
      this.spawnMissileByKey(row.name, spawn.x, spawn.y, spawn.targetX, spawn.targetY, {
        classId: row.id,
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        maxTicks: row.range,
      })
    }
  } else if (unit.missileKey === 'towermist') {
    // 1.13c MISSMODE_CltDo25 (0x6fb683d0) for towermist (#291, Issue #1215): spawns towermisttrail (#292)
    // before the CltDoFunc 1 tail advances the mist toward the Tower Chest.
    const mistSeed = unit.missileSeed ?? mSeed
    const spawn = orbMistTick(
      prevAgeTicks,
      Math.floor(prevX),
      Math.floor(prevY),
      mistSeed,
      TOWER_MIST_MISSILE_ROWS.mist,
    )
    if (spawn !== null) {
      const row = TOWER_MIST_MISSILE_ROWS.trail
      this.spawnMissileByKey(row.name, spawn.x, spawn.y, spawn.targetX, spawn.targetY, {
        classId: row.id,
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        maxTicks: row.range,
      })
    }
  } else if (unit.missileKey === 'towerchestspawner') {
    // 1.13c MISSMODE_CltDo30 (0x6fb679f0) for towerchestspawner (#332, Issue #1215):
    // At elapsed === CltParam1 (150) sets TargetY = 1; while active and elapsed % CltParam2 (2) === 0,
    // spawns CltSubMissile1 = towermisttrail (#292) around the chest within [-CltParam3, CltParam3] ([-5, 5]).
    const spawnerSeed = unit.missileSeed ?? mSeed
    const step = towerChestSpawnerTick(
      prevAgeTicks,
      unit.cltCountdownY ?? 0,
      Math.floor(prevX),
      Math.floor(prevY),
      spawnerSeed,
      TOWER_MIST_MISSILE_ROWS.chestSpawner,
    )
    unit.cltCountdownY = step.active
    if (step.spawn !== null) {
      const row = TOWER_MIST_MISSILE_ROWS.trail
      this.spawnMissileByKey(
        row.name,
        step.spawn.x,
        step.spawn.y,
        step.spawn.targetX,
        step.spawn.targetY,
        {
          classId: row.id,
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          maxTicks: row.range,
        },
      )
    }
  } else if (unit.missileKey === 'diablo appears') {
    // 1.13c MISSMODE_CltDo37 (0x6fb62500):
    // rem === 150 -> StartScreenShake(4000, 25, 0, 0)
    if (remBeforeStep === 150) {
      this.startScreenShake(4000, 25, 0, 0)
    }
  } else if (unit.missileKey === 'andycontrol0') {
    // 1.13c Andariel Death Controller (#167): fire pillars, fire walls, falling debris & screen shake
    if (prevAgeTicks % 8 === 0 && remBeforeStep > 20) {
      const rx = d2Rand(mSeed, 13) - 6
      const ry = d2Rand(mSeed, 13) - 6
      const base = this.spawnMissileByKey(
        'andycolumnfirebase',
        unit.x + rx,
        unit.y + ry,
        unit.x + rx,
        unit.y + ry,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          maxTicks: 40,
          missileSeed: mSeed,
        },
      )
      base.vx = 0
      base.vy = 0
      const angle = (d2Rand(mSeed, 64) * 2 * Math.PI) / 64
      this.spawnMissileByKey(
        'andyfirewallmaker',
        unit.x,
        unit.y,
        unit.x + Math.cos(angle) * 12,
        unit.y + Math.sin(angle) * 12 * ISO_GROUND_ASPECT_RATIO,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          maxTicks: 20,
        },
      )
    }
    if (prevAgeTicks % 5 === 0) {
      const dx = d2Rand(mSeed, 21) - 10
      const dy = d2Rand(mSeed, 21) - 10
      const debrisIdx = (d2Rand(mSeed, 3) % 3) + 1
      const debris = this.spawnMissileByKey(
        `andyfallingdebris${debrisIdx}`,
        unit.x + dx,
        unit.y + dy,
        unit.x + dx,
        unit.y + dy,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          maxTicks: 19,
          altitude: 240,
          verticalDescentPerTick: 13,
        },
      )
      debris.vx = 0
      debris.vy = 0
      debris.explosionMissile = `andydebrisexplosion${debrisIdx}`
      debris.alwaysExplode = true
    }
    if (prevAgeTicks === 10 || prevAgeTicks === 90) {
      this.startScreenShake(3200, 16, 0, 0)
    }
  } else if (unit.missileKey === 'andycolumnfirebase') {
    if (prevAgeTicks % 3 === 0) {
      const col = this.spawnMissileByKey('andycolumnfire', unit.x, unit.y, unit.x, unit.y, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        maxTicks: 25,
      })
      col.vx = 0
      col.vy = 0
    }
  } else if (unit.missileKey === 'andyfirewallmaker') {
    // 1.13c andycontrol0 (#307) -> andyfirewallmaker (#308, pCltDoFunc 27) drops its SubMissile1 `andyfirewall`
    // (#309: Range 25, TravelSound 0) along its path — not the Sorceress `firewall` (#69) / `firemedium` (#105),
    // whose looping TravelSound 2577 (object_fire_loop_magic) kept burning after Andariel died (#991).
    if (prevAgeTicks % 2 === 0) {
      const fw = this.spawnMissileByKey('andyfirewall', unit.x, unit.y, unit.x, unit.y, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        maxTicks: 25,
      })
      fw.vx = 0
      fw.vy = 0
    }
  } else if (unit.missileKey === 'mephistofirewallmaker') {
    // 1.13c mephistodeathcontrol (#299) -> mephistofirewallmaker (#300, pCltDoFunc 27, the same CltDoFunc as
    // andyfirewallmaker #308) drops its CltSubMissile1 `mephistofirewall` (#301: Range 25, groundFireSmall,
    // TravelSound object_fire_loop_magic) along its path — not the Sorceress `firewall` (#69, Range 90,
    // groundFireBig) + `firemedium` (#105), which doubled the looping 2577 sources every 2 frames (#999).
    if (prevAgeTicks % 2 === 0) {
      const fw = this.spawnMissileByKey('mephistofirewall', unit.x, unit.y, unit.x, unit.y, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        maxTicks: 25,
      })
      fw.vx = 0
      fw.vy = 0
    }
  } else if (unit.missileKey === 'durieldeathcontrol') {
    if (prevAgeTicks % 4 === 0) {
      const rx = d2Rand(mSeed, 17) - 8
      const ry = d2Rand(mSeed, 17) - 8
      const rock = this.spawnMissileByKey(
        'durieldeathrock',
        unit.x + rx,
        unit.y + ry,
        unit.x + rx,
        unit.y + ry,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          maxTicks: 22,
          altitude: 220,
          verticalDescentPerTick: 10,
        },
      )
      rock.vx = 0
      rock.vy = 0
      rock.explosionMissile = 'durieldeathsmoke'
      rock.alwaysExplode = true
    }
  } else if (unit.missileKey === 'brdeathcontrol') {
    // 1.13c MissCltDoFunc[21] (0x6fb686f0): TargetX countdown (50 from 0x6fb02320); on 0 one CltSubMissile1
    // `brdeathlightningbolt` toward owner + (dx, dy) within CltParam1, next delay from 0x6fb60050. The spirits /
    // smokes are created once by the death handler, never by this controller (Issue #1041).
    if (stepCltCountdown(unit, BR_DEATH_CONTROL_INITIAL_COUNTDOWN, prevAgeTicks, brDeathControlDelay)) {
      const { dx, dy } = brDeathBoltOffset(mSeed, BR_DEATH_CONTROL_CLT_PARAM1)
      this.spawnMissileByKey(
        BR_DEATH_CONTROL_CLT_SUBMISSILE1,
        unit.x,
        unit.y,
        unit.x + dx,
        unit.y + dy,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
        },
      )
    }
  } else if (unit.missileKey === 'radamentdeath') {
    if (prevAgeTicks % 6 === 0) {
      const rx = d2Rand(mSeed, 9) - 4
      const ry = d2Rand(mSeed, 9) - 4
      const hog = this.spawnMissileByKey(
        'radamenthandofgod',
        unit.x + rx,
        unit.y + ry,
        unit.x + rx,
        unit.y + ry,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          loopAnim: false,
        },
      )
      hog.vx = 0
      hog.vy = 0
    }
  } else if (unit.missileKey === 'queendeathcenter') {
    if (prevAgeTicks % 4 === 0) {
      const rx = d2Rand(mSeed, 13) - 6
      const ry = d2Rand(mSeed, 13) - 6
      const glob = this.spawnMissileByKey(
        'queendeathglob',
        unit.x,
        unit.y,
        unit.x + rx,
        unit.y + ry,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          maxTicks: 16,
        },
      )
      glob.explosionMissile = prevAgeTicks % 8 === 0 ? 'queendeathsplat1' : 'queendeathsplat2'
      glob.alwaysExplode = true
    }
  } else if (unit.missileKey === 'mephistodeathcontrol') {
    // 1.13c MissCltDoFunc[26] (0x6fb6b780): TargetX / TargetY countdowns (75 / 75 from 0x6fb02270). TargetX at 0 ->
    // CltSubMissile1 mephistofirewallmaker toward start + (dx, dy) within CltParam3 (0x6fb682b0), next in CltParam1
    // frames; TargetY at 0 -> CltSubMissile2 mephistoflyingrocksbig (level RAND(5) + 1, offset within CltParam3,
    // TargetX = RAND(5) bursts for CltHitFunc 33), next in CltParam2 frames. mephistoholedelay / mephistodonotdraw
    // are created once by the death handler, never by this controller (Issue #1208).
    const { sub1, sub2 } = stepCltDo26(unit)
    if (sub1) {
      const { dx, dy } = cltDo26SubOffset(mSeed, MEPHISTO_DEATH_CONTROL_113C.cltParam3)
      this.spawnMissileByKey(
        MEPHISTO_DEATH_CONTROL_113C.cltSubMissile1,
        unit.x,
        unit.y,
        unit.x + dx,
        unit.y + dy,
        { ownerType: unit.ownerType, ownerId: unit.ownerId },
      )
    }
    if (sub2) {
      const { level, dx, dy } = cltDo26RockSpawn(mSeed, MEPHISTO_DEATH_CONTROL_113C.cltParam3)
      const rock = this.spawnMissileByKey(
        MEPHISTO_DEATH_CONTROL_113C.cltSubMissile2,
        unit.x,
        unit.y,
        unit.x + dx,
        unit.y + dy,
        { ownerType: unit.ownerType, ownerId: unit.ownerId, skillLevel: level },
      )
      rock.cltCountdown = rand113c(mSeed, 5)
    }
  } else if (unit.missileKey === 'mephistodonotdraw') {
    // 1.13c MissCltDoFunc[28] (0x6fb68010): at elapsed == CltParam1 (15), four CltSubMissile1 corpseexplosion
    // {flags 0x2001} at the owner (Mephisto) + the 0x6fb83e00 / 0x6fb83df0 cross offsets.
    if (prevAgeTicks === MEPHISTO_DO_NOT_DRAW_113C.cltParam1) {
      const owner = unit.ownerId !== undefined ? this._monsters.get(unit.ownerId) : undefined
      if (owner) {
        for (const off of MEPHISTO_DO_NOT_DRAW_OFFSETS_113C) {
          const ex = owner.x + off.dx
          const ey = owner.y + off.dy
          const ce = this.spawnMissileByKey(MEPHISTO_DO_NOT_DRAW_113C.cltSubMissile1, ex, ey, ex, ey, {
            ownerType: unit.ownerType,
            ownerId: unit.ownerId,
          })
          ce.vx = 0
          ce.vy = 0
        }
      }
    }
  } else if (unit.missileKey === 'izual control') {
    if (prevAgeTicks % 4 === 0) {
      const rx = d2Rand(mSeed, 9) - 4
      const ry = d2Rand(mSeed, 9) - 4
      const mist = this.spawnMissileByKey(
        'izual mist loop',
        unit.x + rx,
        unit.y + ry,
        unit.x + rx,
        unit.y + ry,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          maxTicks: 30,
        },
      )
      mist.vx = 0
      mist.vy = 0
      this.spawnMissileByKey(
        'izual lightning',
        unit.x,
        unit.y,
        unit.x + rx * 2,
        unit.y + ry * 2,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          maxTicks: 20,
        },
      )
    }
  } else if (unit.missileKey === 'diabwallmaker') {
    // 1.13c Missiles.txt row #179 ('diabwallmaker', pCltDoFunc=16 @ 0x6FB68AA0, Issue #1194):
    // Spawns CltSubMissile1 = 'diabwall' (#180, Range=36) stationary on each new sub-tile stepped onto.
    if (
      prevAgeTicks === 0 ||
      Math.floor(unit.x) !== Math.floor(prevX) ||
      Math.floor(unit.y) !== Math.floor(prevY)
    ) {
      const dw = this.spawnMissileByKey('diabwall', unit.x, unit.y, unit.x, unit.y, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        sourceSkillId: unit.sourceSkillId,
        skillLevel: unit.skillLevel,
        maxTicks: 36,
      })
      dw.vx = 0
      dw.vy = 0
    }
  } else if (unit.missileKey === 'overseercontrol') {
    // 1.13c MissCltDoFunc[61] (0x6fb6a600): TargetX countdown (25 from 0x6fb02bd0); on 0 one `catapult cold ball`
    // (#416) or `catapult meteor ball` (#422) by seed & 1, created by 0x6fb63fc0 at owner + RAND(20) - 10 and lobbed
    // down from z 400 at -16 px / frame over its Range 25; next delay from 0x6fb5ff80 (Issue #1040). Impact visuals
    // belong to the balls' own rows (CltHitFunc 48 / 50, CltHitSubMissile*), not to this controller.
    if (stepCltCountdown(unit, OVERSEER_CONTROL_INITIAL_COUNTDOWN, prevAgeTicks, overseerControlDelay)) {
      const ownerUnit =
        unit.ownerType !== undefined && unit.ownerId !== undefined
          ? this.getUnit(unit.ownerType, unit.ownerId)
          : undefined
      const ballKey = pickOverseerControlBall(mSeed)
      const start = overseerControlBallStart(mSeed, ownerUnit?.x ?? unit.x, ownerUnit?.y ?? unit.y)
      const ball = this.spawnMissileByKey(ballKey, start.x, start.y, start.x, start.y, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
      })
      ball.vx = 0
      ball.vy = 0
      ball.traj3d = catapultBallTraj3d()
      ball.altitude = ball.traj3d.z >> TRAJ_FIXED_SHIFT
      ball.alwaysExplode = false
    }
  } else if (unit.missileKey === 'nehlithakcontrol') {
    if (prevAgeTicks % 4 === 0) {
      const rx = d2Rand(mSeed, 9) - 4
      const ry = d2Rand(mSeed, 9) - 4
      const debIdx = (d2Rand(mSeed, 4) % 4) + 1
      this.spawnMissileByKey(
        `nehlithakdebris${debIdx}`,
        unit.x,
        unit.y,
        unit.x + rx,
        unit.y + ry,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          maxTicks: 20,
        },
      )
      if (prevAgeTicks % 8 === 0) {
        const glow = this.spawnMissileByKey('nehlithakglow', unit.x, unit.y, unit.x, unit.y, {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          loopAnim: false,
        })
        glow.vx = 0
        glow.vy = 0
      }
    }
  } else if (unit.missileKey === 'ancient death center') {
    if (prevAgeTicks % 4 === 0) {
      const rx = d2Rand(mSeed, 7) - 3
      const ry = d2Rand(mSeed, 7) - 3
      const cloud = this.spawnMissileByKey(
        'ancient death cloud',
        unit.x + rx,
        unit.y + ry,
        unit.x + rx,
        unit.y + ry,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          maxTicks: 25,
        },
      )
      cloud.vx = 0
      cloud.vy = 0
    }
  } else if (unit.missileKey === 'baalfx control') {
    if (prevAgeTicks % 5 === 0) {
      const rx = d2Rand(mSeed, 13) - 6
      const ry = d2Rand(mSeed, 13) - 6
      const spIdx = (d2Rand(mSeed, 5) % 5) + 1
      this.spawnMissileByKey(
        `baalfx spirit ${spIdx}`,
        unit.x,
        unit.y,
        unit.x + rx,
        unit.y + ry,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          maxTicks: 30,
        },
      )
    }
  } else if (unit.missileKey === 'baal taunt control') {
    // 1.13c Missiles.txt row #546 ('baal taunt control', Range=75, pCltDoFunc=56 @ 0x6FB670A0,
    // CltParam1=25, CltParam2=3, CltParam3=45, CltSubMissile1='baal taunt lightning control' #654,
    // CltSubMissile2='baal taunt poison control' #655, Issue #1201):
    if (prevAgeTicks === 3) {
      const pCtrl = this.spawnMissileByKey(
        'baal taunt poison control',
        unit.x,
        unit.y,
        unit.x,
        unit.y,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          sourceSkillId: unit.sourceSkillId ?? 284,
          skillLevel: unit.skillLevel,
          maxTicks: 1,
        },
      )
      pCtrl.vx = 0
      pCtrl.vy = 0
      pCtrl.alwaysExplode = true
    } else if (prevAgeTicks >= 6 && prevAgeTicks % 3 === 0) {
      const rx = d2Rand(mSeed, 17) - 8
      const ry = d2Rand(mSeed, 17) - 8
      const lCtrl = this.spawnMissileByKey(
        'baal taunt lightning control',
        unit.x + rx,
        unit.y + ry,
        unit.x + rx,
        unit.y + ry,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          sourceSkillId: unit.sourceSkillId ?? 284,
          skillLevel: unit.skillLevel,
          maxTicks: 1,
        },
      )
      lCtrl.vx = 0
      lCtrl.vy = 0
      lCtrl.alwaysExplode = true
    }
  }

  // Sub-missile emitter logic
  const stepMissileRow = CANONICAL_113C_MISSILES[unit.missileKey ?? '']
  if (
    unit.missileKey === 'firewallmaker' ||
    unit.missileKey === 'vampirefirewallmaker' ||
    unit.missileKey === 'countessfirewallmaker'
  ) {
    // 1.13c MissCltDoFunc[6] (0x6FB6BA20, CltParam1=4, Issue #1169):
    // - firewallmaker (#82): CltSubMissile1='firewall' (#83, Range=90), CltSubMissile2='firesmall' (#104), CltSubMissile3='firemedium' (#105)
    // - vampirefirewallmaker (#130): CltSubMissile1='vampirefirewall' (#131, Range=90), CltSubMissile2='firesmall' (#104), CltSubMissile3='firemedium' (#105)
    // - countessfirewallmaker (#525): CltSubMissile1='countessfirewall' (#526, Range=1000, LevRange=1), CltSubMissile2='firesmall' (#104), CltSubMissile3='firemedium' (#105)
    const slvl = Math.max(1, unit.skillLevel ?? 1)
    const sub1Key =
      unit.missileKey === 'vampirefirewallmaker'
        ? 'vampirefirewall'
        : unit.missileKey === 'countessfirewallmaker'
          ? 'countessfirewall'
          : 'firewall'
    const sub1Ticks = unit.missileKey === 'countessfirewallmaker' ? 1000 + Math.max(0, slvl - 1) : 90
    const pillar = this.spawnMissileByKey(sub1Key, unit.x, unit.y, unit.x, unit.y, {
      ownerType: unit.ownerType,
      ownerId: unit.ownerId,
      sourceSkillId: unit.sourceSkillId,
      skillLevel: slvl,
      maxTicks: sub1Ticks,
    })
    pillar.vx = 0
    pillar.vy = 0
    if (prevAgeTicks % 4 === 0) {
      const fSmall = this.spawnMissileByKey('firesmall', unit.x, unit.y, unit.x, unit.y, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        sourceSkillId: unit.sourceSkillId,
        skillLevel: slvl,
      })
      fSmall.vx = 0
      fSmall.vy = 0
      const fMed = this.spawnMissileByKey('firemedium', unit.x, unit.y, unit.x, unit.y, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        sourceSkillId: unit.sourceSkillId,
        skillLevel: slvl,
      })
      fMed.vx = 0
      fMed.vy = 0
    }
  } else if (unit.missileKey === 'bonespear') {
    const trail = this.spawnMissileByKey('bonespeartrail', prevX, prevY, prevX, prevY, {
      ownerType: unit.ownerType,
      ownerId: unit.ownerId,
      sourceSkillId: unit.sourceSkillId,
      skillLevel: unit.skillLevel,
      maxTicks: 10,
      loopAnim: false,
    })
    trail.vx = 0
    trail.vy = 0
  } else if (stepMissileRow?.pCltDoFunc === 3 && stepMissileRow.cltSubMissile1) {
    // 1.13c MissCltDoFunc[3] (0x6FB624C0, Missiles.txt #38 poisonjav -> poisonjavcloud, #43 plaguejavelin -> plaguejavcloud, Issue #1121 / #1297):
    // Spawns CltSubMissile1 at the missile's path position using the sub-missile row's own Range (60).
    const cloud = this.spawnMissileByKey(stepMissileRow.cltSubMissile1, prevX, prevY, prevX, prevY, {
      ownerType: unit.ownerType,
      ownerId: unit.ownerId,
      sourceSkillId: unit.sourceSkillId,
      skillLevel: unit.skillLevel,
      direction: unit.direction,
    })
    cloud.vx = 0
    cloud.vy = 0
  } else if (
    isMoving &&
    ((stepMissileRow?.pCltDoFunc === 8 && stepMissileRow.cltSubMissile1) ||
      unit.missileKey === 'baal taunt lightning')
  ) {
    // 1.13c MissCltDoFunc[8] (0x6FB63460, Missiles.txt #93 chainlightning, #98 lightningbolt, #232 lightningstrike,
    // #547 baal taunt lightning, Issues #1122, #1201):
    // Spawns CltParam1 (3) interpolated trailing CltSubMissile1 ('lightninghit') segments per tick,
    // plus CltSubMissile2 ('baal taunt lightning trail' #548 for 'baal taunt lightning' #547).
    const segCount = Math.max(1, stepMissileRow?.cltParam1 ?? 3)
    const sub1Key = stepMissileRow?.cltSubMissile1 || 'lightninghit'
    for (let s = 1; s <= segCount; s++) {
      const frac = s / segCount
      const sx = prevX + (unit.x - prevX) * frac
      const sy = prevY + (unit.y - prevY) * frac
      const trail = this.spawnMissileByKey(
        sub1Key,
        sx,
        sy,
        sx + (unit.vx ?? 0),
        sy + (unit.vy ?? 0),
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          sourceSkillId: unit.sourceSkillId,
          skillLevel: unit.skillLevel,
          loopAnim: false,
        },
      )
      trail.vx = 0
      trail.vy = 0
      if (unit.missileKey === 'baal taunt lightning') {
        const subTrail = this.spawnMissileByKey(
          'baal taunt lightning trail',
          sx,
          sy,
          sx + (unit.vx ?? 0),
          sy + (unit.vy ?? 0),
          {
            ownerType: unit.ownerType,
            ownerId: unit.ownerId,
            sourceSkillId: unit.sourceSkillId,
            skillLevel: unit.skillLevel,
            loopAnim: false,
          },
        )
        subTrail.vx = 0
        subTrail.vy = 0
      }
    }
  }
  if (unit.missileKey === 'firestormmaker' && prevAgeTicks % 4 === 0) {
    // 1.13c Missiles.txt row #296 ('firestormmaker', pCltDoFunc=6, CltParam1=4):
    // Every 4 ticks, spawn CltSubMissile1='firestorm' (Range=15), CltSubMissile2='firesmall' (Range=30), CltSubMissile3='firemedium' (Range=45).
    const fsPatch = this.spawnMissileByKey('firestorm', unit.x, unit.y, unit.x, unit.y, {
      ownerType: unit.ownerType,
      ownerId: unit.ownerId,
      sourceSkillId: unit.sourceSkillId,
      skillLevel: unit.skillLevel,
    })
    fsPatch.vx = 0
    fsPatch.vy = 0
    const fSmall = this.spawnMissileByKey('firesmall', unit.x, unit.y, unit.x, unit.y, {
      ownerType: unit.ownerType,
      ownerId: unit.ownerId,
      sourceSkillId: unit.sourceSkillId,
      skillLevel: unit.skillLevel,
    })
    fSmall.vx = 0
    fSmall.vy = 0
    const fMed = this.spawnMissileByKey('firemedium', unit.x, unit.y, unit.x, unit.y, {
      ownerType: unit.ownerType,
      ownerId: unit.ownerId,
      sourceSkillId: unit.sourceSkillId,
      skillLevel: unit.skillLevel,
    })
    fMed.vx = 0
    fMed.vy = 0
  } else if (unit.missileKey === 'moltenboulder' && prevAgeTicks % 4 === 0) {
    // 1.13c Missiles.txt row #299 ('moltenboulder', pCltDoFunc=47 -> CltDo06, CltParam1=4):
    // Every 4 ticks, spawn CltSubMissile1='firewall' (Range=90), CltSubMissile2='firesmall' (Range=30), CltSubMissile3='firemedium' (Range=45).
    const fwPatch = this.spawnMissileByKey('firewall', unit.x, unit.y, unit.x, unit.y, {
      ownerType: unit.ownerType,
      ownerId: unit.ownerId,
      sourceSkillId: unit.sourceSkillId,
      skillLevel: unit.skillLevel,
    })
    fwPatch.vx = 0
    fwPatch.vy = 0
    const fSmall = this.spawnMissileByKey('firesmall', unit.x, unit.y, unit.x, unit.y, {
      ownerType: unit.ownerType,
      ownerId: unit.ownerId,
      sourceSkillId: unit.sourceSkillId,
      skillLevel: unit.skillLevel,
    })
    fSmall.vx = 0
    fSmall.vy = 0
    const fMed = this.spawnMissileByKey('firemedium', unit.x, unit.y, unit.x, unit.y, {
      ownerType: unit.ownerType,
      ownerId: unit.ownerId,
      sourceSkillId: unit.sourceSkillId,
      skillLevel: unit.skillLevel,
    })
    fMed.vx = 0
    fMed.vy = 0
  } else if (unit.missileKey === 'erruption center') {
    // 1.13c Missiles.txt row #300 ('erruption center', Range=80, pSrvDoFunc=28, pCltDoFunc=48):
    // Skills.txt #234 Eruption: Param1=7 (calc1=7 -> ±6 sub-tile offset), Param2=6 (calc2=6 frame cadence).
    // Spawns CltSubMissile1 = 'erruption crack 1' (#462, Range=84) and CltSubMissile2 = 'erruption smoke 1' (#464, Range=84).
    const rem = Math.max(0, (unit.maxTicks ?? 80) - unit.ageTicks)
    if (rem > 0 && rem % 6 === 0) {
      const rx = d2Rand(mSeed, 12) - 6
      const ry = d2Rand(mSeed, 12) - 6
      const crack = this.spawnMissileByKey(
        'erruption crack 1',
        unit.x + rx,
        unit.y + ry,
        unit.x + rx,
        unit.y + ry,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          sourceSkillId: unit.sourceSkillId,
          skillLevel: unit.skillLevel,
        },
      )
      crack.vx = 0
      crack.vy = 0
      const smoke = this.spawnMissileByKey(
        'erruption smoke 1',
        unit.x + rx,
        unit.y + ry,
        unit.x + rx,
        unit.y + ry,
        {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          sourceSkillId: unit.sourceSkillId,
          skillLevel: unit.skillLevel,
        },
      )
      smoke.vx = 0
      smoke.vy = 0
    }
  } else if (unit.missileKey === 'volcano') {
    // 1.13c Missiles.txt row #301 ('volcano', Range=150, pSrvDoFunc=29, pCltDoFunc=50, CltParam3=2, CltParam4=128):
    // Skills.txt #244 Volcano: calc4=par2=2, aurarangecalc=12. Spawns CltSubMissile1 = 'volcano debris 2' (#466, Range=16, Vel=14).
    const rem = Math.max(0, (unit.maxTicks ?? 150) - unit.ageTicks)
    if (rem > 2 && rem < 128 && rem % 2 === 0) {
      const offX = d2Rand(mSeed, 25) - 12
      const offY = d2Rand(mSeed, 25) - 12
      const tx = unit.x + (offX === 0 && offY === 0 ? 1 : offX)
      const ty = unit.y + offY
      const debris = this.spawnMissileByKey('volcano debris 2', unit.x, unit.y, tx, ty, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        sourceSkillId: unit.sourceSkillId,
        skillLevel: unit.skillLevel,
      })
      debris.alwaysExplode = true
    }
  } else if (
    unit.missileKey === 'wake of destruction maker' ||
    unit.missileKey === 'baal cold maker'
  ) {
    // 1.13c Missiles.txt row #517 ('wake of destruction maker', Range=25, LevRange=2, pSrvDoFunc=31, pCltDoFunc=52 @ 0x6FB672D0, Issue #1188)
    // and row #589 ('baal cold maker', Range=50, Vel=20, pSrvDoFunc=31, pCltDoFunc=52 @ 0x6FB672D0, Issue #1196):
    // Reads perpendicular vector (perpDx = -dy, perpDy = dx) stored by CltDo70/CltDo81 and spawns two opposing
    // perpendicular CltSubMissile1 ('wake of destruction' #518 or 'baal cold trail' #590) V-wave wings along its trajectory.
    const isBaalCold = unit.missileKey === 'baal cold maker'
    if (isBaalCold ? unit.ageTicks >= 1 : unit.ageTicks === 1 || unit.ageTicks % 3 === 0) {
      let perpDx = Number((unit as any).perpDx)
      let perpDy = Number((unit as any).perpDy)
      if (!Number.isFinite(perpDx) || !Number.isFinite(perpDy) || (perpDx === 0 && perpDy === 0)) {
        perpDx = -(unit.vy || 0)
        perpDy = unit.vx || 1
      }
      const pLen = Math.hypot(perpDx, perpDy) || 1
      const ux = (perpDx / pLen) * 10
      const uy = (perpDy / pLen) * 10
      const wingKey = isBaalCold ? 'baal cold trail' : 'wake of destruction'
      for (const sign of [1, -1] as const) {
        this.spawnMissileByKey(
          wingKey,
          unit.x,
          unit.y,
          unit.x + ux * sign,
          unit.y + uy * sign,
          {
            ownerType: unit.ownerType,
            ownerId: unit.ownerId,
            sourceSkillId: unit.sourceSkillId,
            skillLevel: unit.skillLevel,
            pierce: !isBaalCold ? true : undefined,
          },
        )
      }
    }
  } else if (unit.missileKey === 'fingermagespider' && (unit as any).spiderTrailActive) {
    // 1.13c Missiles.txt row #177 ('fingermagespider', pCltDoFunc=15 @ 0x6FB68BC0, CltParam1=3, CltParam2=20, Issue #1193):
    // Every CltParam1 (3) frames, spawns stationary CltSubMissile1 = 'fingermagespider' trail segment with
    // Range = min(CltParam2=20, remainingFrames - 1) and spiderTrailActive = false.
    const row = CANONICAL_113C_MISSILES[unit.missileKey]
    const spawnMod = Math.max(1, row?.cltParam1 ?? 3)
    const spawnLife = Math.max(1, row?.cltParam2 ?? 20)
    if (unit.ageTicks > 0 && unit.ageTicks % spawnMod === 0 && remBeforeStep > 1) {
      const trail = this.spawnMissileByKey('fingermagespider', prevX, prevY, prevX, prevY, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        sourceSkillId: unit.sourceSkillId,
        skillLevel: unit.skillLevel,
        direction: unit.direction,
        maxTicks: Math.min(spawnLife, Math.max(1, remBeforeStep - 1)),
      })
      trail.vx = 0
      trail.vy = 0
      ;(trail as any).spiderTrailActive = false
    }
  } else if (unit.missileKey === 'blade shield attachment') {
    // 1.13c Missiles.txt #553 ('blade shield attachment', pCltDoFunc=57 @ 0x6FB66F60):
    // Anchors to owner (via 0x6FB62890 MissileCltDoFunc[43]) while state 158 ('bladeshield') is active,
    // and emits CltSubMissile1 = 'blade shield missile' (#552, Vel=18, Range=100, Trans=1) toward living
    // hostile targets within Skills.txt #277 aurarangecalc (6 sub-tiles) on a perdelay (25 frames) cadence.
    const ownerUnit =
      unit.ownerType !== undefined && unit.ownerId !== undefined
        ? this.getUnit(unit.ownerType, unit.ownerId)
        : undefined
    if (!ownerUnit || ownerUnit.dead || !ownerUnit.states.has(158)) {
      this._units.delete(unit.key)
      return
    }
    unit.x = ownerUnit.x
    unit.y = ownerUnit.y
    unit.vx = 0
    unit.vy = 0
    if ((unit.maxTicks ?? 500) - unit.ageTicks <= 2) {
      unit.maxTicks = unit.ageTicks + 25
    }
    const lastSlashTick = (unit as any).lastBladeShieldSlashTick as number | undefined
    if (
      !isTownLevel(this.areaId) &&
      (lastSlashTick === undefined || this.frameCount - lastSlashTick >= 25)
    ) {
      const radius = 6
      let spawnedAny = false
      for (const m of this._monsters.values()) {
        if (m.dead || m.mode === 0 || m.mode === 12 || m.lifePct <= 0) continue
        if (this.isFriendlyOrNonHostileMonster(m)) continue
        if (Math.hypot(m.x - unit.x, m.y - unit.y) <= radius) {
          const dx = m.x - unit.x
          const dy = m.y - unit.y
          const tx = dx === 0 && dy === 0 ? unit.x + 1 : m.x
          const ty = m.y
          this.spawnMissileByKey('blade shield missile', unit.x, unit.y, tx, ty, {
            ownerType: unit.ownerType,
            ownerId: unit.ownerId,
            sourceSkillId: unit.sourceSkillId ?? 277,
            skillLevel: unit.skillLevel ?? 1,
          })
          spawnedAny = true
        }
      }
      if (spawnedAny) {
        ;(unit as any).lastBladeShieldSlashTick = this.frameCount
      }
    }
  }
  if (unit.emitterKind === 'frozenorb') {
    // 1.13c MISSMODE_SrvDo15_FrozenOrb (0x6FC581F0) / pCltDoFunc=19:
    // Every CltParam1=1 frame, spawns 1 frozenorbbolt (CltSubMissile1) aimed at the 64-entry
    // circle table (CLTDO25_RING_X_113C / CLTDO25_RING_Y_113C), stepping index by CltParam2=19 mod 64.
    const idx = (unit.subMissileIdx ?? 0) & 63
    const tx = unit.x + CLTDO25_RING_X_113C[idx]!
    const ty = unit.y + CLTDO25_RING_Y_113C[idx]!
    this.spawnMissileByKey('frozenorbbolt', unit.x, unit.y, tx, ty, {
      ownerType: unit.ownerType,
      ownerId: unit.ownerId,
      sourceSkillId: unit.sourceSkillId,
      skillLevel: unit.skillLevel,
    })
    unit.subMissileIdx = (idx + 19) & 63
  } else if (unit.emitterKind === 'blizzard_controller' && unit.ageTicks % 4 === 0) {
    // 1.13c MISSMODE_CltDo13_BlizzardCenter (0x6FB61770) & Missiles.txt blizzard1..4 (range=9, vel=0, Issue #1113):
    // Sample the 64-entry circle lookup table with coprime step 13 (radius = 7 sub-tiles) and spawn
    // vertical-falling blizzard1..4 shards (randomly chosen in [159..162]) that burst into blizzardexplode1..3 via CltHit19.
    const stepIndex = Math.floor(unit.ageTicks / 4)
    const circleIdx = (stepIndex * 13) % 64
    const radius = 7
    const sx = unit.x + (BLIZZARD_CIRCLE_X[circleIdx]! * radius) / 30
    const sy =
      unit.y + (BLIZZARD_CIRCLE_Y[circleIdx]! * radius * ISO_GROUND_ASPECT_RATIO) / 30
    const fallTicks = 9
    const shardId = 159 + SEED_RollLimitedRandomNumber(unit.seed, 4)
    const shardKey = MISSILE_CLASS_ID_TO_KEY[shardId] ?? 'blizzard1'
    const shard = this.spawnMissileByKey(shardKey, sx, sy, sx, sy, {
      ownerType: unit.ownerType,
      ownerId: unit.ownerId,
      sourceSkillId: unit.sourceSkillId,
      skillLevel: unit.skillLevel,
      maxTicks: fallTicks,
      altitude: 120,
    })
    shard.vx = 0
    shard.vy = 0
    shard.alwaysExplode = true
  } else if (
    unit.missileKey === 'recycler delay' ||
    unit.missileKey === 'vine recycler delay'
  ) {
    // 1.13c D2Client.dll MISSMODE_CltDo51_RecyclerDelay (0x6FB673E0, Issue #1116):
    // - recycler delay (#498): Range=47, CltParam1=40, ProgOverlay='steallife', CltSubMissile1='recycler explosion' (#501), CltSubMissile2='recycler vine' (#499)
    // - vine recycler delay (#540): Range=47, CltParam1=40, ProgOverlay='stealmana', CltSubMissile1='recycler explosion' (#501), CltSubMissile2='recycler vine' (#499)
    // On first frame (prevAgeTicks === 0), spawns CltSubMissile1 and CltSubMissile2 at corpse coordinates;
    // when remaining frames (maxTicks - prevAgeTicks) == CltParam1 (40), attaches ProgOverlay to owner unit.
    const row = CANONICAL_113C_MISSILES[unit.missileKey]
    if (prevAgeTicks === 0) {
      const sub1 = row?.cltSubMissile1 || 'recycler explosion'
      const sub2 = row?.cltSubMissile2 || 'recycler vine'
      const exp = this.spawnMissileByKey(sub1, unit.x, unit.y, unit.x, unit.y, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        sourceSkillId: unit.sourceSkillId,
        skillLevel: unit.skillLevel,
        loopAnim: false,
      })
      exp.vx = 0
      exp.vy = 0
      const vine = this.spawnMissileByKey(sub2, unit.x, unit.y, unit.x, unit.y, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        sourceSkillId: unit.sourceSkillId,
        skillLevel: unit.skillLevel,
        loopAnim: false,
      })
      vine.vx = 0
      vine.vy = 0
      vine.alwaysExplode = true
    }
    const maxTicks = unit.maxTicks ?? row?.range ?? 47
    const triggerRemaining = row?.cltParam1 ?? 40
    if (maxTicks - prevAgeTicks === triggerRemaining && row?.progOverlay) {
      const ownerUnit =
        (unit.ownerType !== undefined && unit.ownerId !== undefined
          ? this.getUnit(unit.ownerType, unit.ownerId)
          : undefined) ?? this._self ?? undefined
      if (ownerUnit) {
        this.attachUnitOverlay(ownerUnit, row.progOverlay, false)
      }
    }
  } else if (unit.missileKey === 'vines' || unit.missileKey === 'plague vines') {
    // 1.13c Missiles.txt rows #471 ('vines') & #474 ('plague vines'): pCltDoFunc=49 @ 0x6FB62720,
    // CltParam1=9, CltSubMissile1='vines trail' #472 / 'plague vines trail' #475 (Issue #1200).
    // Every CltParam1=9 ticks, spawns stationary CltSubMissile1 with Range=100+(slvl-1)*25 and AlwaysExplode=1.
    const row = CANONICAL_113C_MISSILES[unit.missileKey]
    const cadence = Math.max(1, row?.cltParam1 ?? 9)
    if (prevAgeTicks % cadence === 0) {
      const slvl = Math.max(1, unit.skillLevel ?? 1)
      const trailKey =
        row?.cltSubMissile1 ||
        (unit.missileKey === 'plague vines' ? 'plague vines trail' : 'vines trail')
      const trail = this.spawnMissileByKey(trailKey, prevX, prevY, prevX, prevY, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        sourceSkillId: unit.sourceSkillId,
        skillLevel: slvl,
        direction: unit.direction,
        maxTicks: 100 + (slvl - 1) * 25,
      })
      trail.vx = 0
      trail.vy = 0
      trail.alwaysExplode = true
    }
  } else if (unit.missileKey === 'monblizcenter') {
    // 1.13c Missiles.txt #106 ('monblizcenter', pCltDoFunc=10 @ 0x6FB6BD40, Issue #1171):
    // CltParam1=5, CltParam2=8, CltParam3=4, CltSubMissile1='monbliz1' (#107), CltSubMissile2='monbliz4' (#110).
    // q = floor(slvl / 4), radius = 5 + max(2, q), freq = max(3, 8 - q).
    const slvl = Math.max(1, unit.skillLevel ?? 1)
    const q = Math.floor(slvl / 4)
    const radius = 5 + Math.max(2, q)
    const freq = Math.max(3, 8 - q)
    if (unit.ageTicks % freq === 0) {
      const span = 2 * radius + 1
      const sx = unit.x + (d2Rand(mSeed, span) - radius)
      const sy = unit.y + (d2Rand(mSeed, span) - radius)
      const shardKey = d2Rand(mSeed, 2) === 0 ? 'monbliz1' : 'monbliz4'
      const shard = this.spawnMissileByKey(shardKey, sx, sy, sx, sy, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        sourceSkillId: unit.sourceSkillId ?? 205,
        skillLevel: slvl,
        maxTicks: 9,
        altitude: 120,
      })
      shard.vx = 0
      shard.vy = 0
      shard.alwaysExplode = true
    }
  }

  // Wall / obstacle collision check along the step segment (only for ground-level flying projectiles)
  // 1.13c D2Client.dll 0x6FB81340 / D2Game.dll 0x6FD2A5B0:
  // Check COLLIDE_MISSILE_BARRIER | COLLIDE_DOOR (0x0804) for flying missiles (CollideType 1, 3, 6),
  // 0x0805 for floor-hugging missiles (CollideType 8), or 0 for CollideType 0.
  const missileCollideType = getMissileCollideType113c(unit.missileKey)
  if (
    isMoving &&
    !isMeteor3D &&
    !isQuestFxController &&
    unit.traj3d === undefined &&
    (unit as any).lobPeakAltitude === undefined &&
    (unit.altitude ?? 0) <= 0 &&
    missileCollideType !== 0
  ) {
    const stepDist = Math.hypot(unit.x - prevX, unit.y - prevY)
    const samples = Math.max(1, Math.ceil(stepDist * 2))
    for (let s = 1; s <= samples; s++) {
      const t = s / samples
      const sx = prevX + (unit.x - prevX) * t
      const sy = prevY + (unit.y - prevY) * t
      if (this.isSubTileMissileBlocked(sx, sy, missileCollideType)) {
        unit.x = sx
        unit.y = sy
        if (
          unit.missileKey === 'poisonjav' &&
          stepMissileRow?.pCltDoFunc === 3 &&
          stepMissileRow.cltSubMissile1 &&
          (Math.abs(sx - prevX) > 1e-4 || Math.abs(sy - prevY) > 1e-4)
        ) {
          const hitCloud = this.spawnMissileByKey(stepMissileRow.cltSubMissile1, sx, sy, sx, sy, {
            ownerType: unit.ownerType,
            ownerId: unit.ownerId,
            sourceSkillId: unit.sourceSkillId,
            skillLevel: unit.skillLevel,
            direction: unit.direction,
          })
          hitCloud.vx = 0
          hitCloud.vy = 0
        }
        this.triggerMissileImpact(unit, unit.x, unit.y, true)
        this._units.delete(unit.key)
        return
      }
    }
  }

  // Hostile / friendly unit collision check along the step segment (only for ground-level flying projectiles, excluding Frozen Orb carrier and Fire Wall makers)
  if (
    (isMoving || Boolean(stepMissileRow?.progOverlay && stepMissileRow?.nextHit)) &&
    !isMeteor3D &&
    !isQuestFxController &&
    unit.traj3d === undefined &&
    (unit as any).lobPeakAltitude === undefined &&
    (unit.altitude ?? 0) <= 0 &&
    unit.emitterKind !== 'frozenorb' &&
    unit.missileKey !== 'armageddonrock' &&
    unit.missileKey !== 'armageddontail' &&
    unit.missileKey !== 'diablogeddonrock' &&
    unit.missileKey !== 'diablogeddontail' &&
    unit.missileKey !== 'firewallmaker' &&
    unit.missileKey !== 'vampirefirewallmaker' &&
    unit.missileKey !== 'countessfirewallmaker'
  ) {
    const hitRadius = 1.75
    const segDx = unit.x - prevX
    const segDy = unit.y - prevY
    const segLenSq = segDx * segDx + segDy * segDy
    const distToSeg = (tx: number, ty: number): number => {
      if (segLenSq <= 1e-6) return Math.hypot(tx - unit.x, ty - unit.y)
      const t = Math.max(0, Math.min(1, ((tx - prevX) * segDx + (ty - prevY) * segDy) / segLenSq))
      return Math.hypot(tx - (prevX + segDx * t), ty - (prevY + segDy * t))
    }
    const consumePierceOrKillOnUnitHit = (hitX?: number, hitY?: number): boolean => {
      const spawnFinalPoisonJavCloud = (): void => {
        if (
          unit.missileKey === 'poisonjav' &&
          stepMissileRow?.pCltDoFunc === 3 &&
          stepMissileRow.cltSubMissile1
        ) {
          const cx = hitX ?? unit.x
          const cy = hitY ?? unit.y
          if (Math.abs(cx - prevX) > 1e-4 || Math.abs(cy - prevY) > 1e-4) {
            const hitCloud = this.spawnMissileByKey(stepMissileRow.cltSubMissile1, cx, cy, cx, cy, {
              ownerType: unit.ownerType,
              ownerId: unit.ownerId,
              sourceSkillId: unit.sourceSkillId,
              skillLevel: unit.skillLevel,
              direction: unit.direction,
            })
            hitCloud.vx = 0
            hitCloud.vy = 0
          }
        }
      }
      if (unit.pierceRemaining !== undefined) {
        unit.pierceCount = (unit.pierceCount ?? 0) + 1
        if (unit.pierceRemaining > 0 && unit.pierceCount <= 4) {
          unit.pierceRemaining -= 1
          if (unit.pierceRemaining <= 0) {
            unit.pierce = false
          }
          return false
        }
        unit.pierceRemaining = 0
        unit.pierce = false
        spawnFinalPoisonJavCloud()
        this._units.delete(unit.key)
        return true
      }
      if (!unit.pierce) {
        spawnFinalPoisonJavCloud()
        this._units.delete(unit.key)
        return true
      }
      return false
    }
    if (stepMissileRow?.pCltHitFunc === 9 || stepMissileRow?.collideFriend) {
      for (const target of this._units.values()) {
        if (target.unitType !== 'player' && target.unitType !== 'monster') continue
        if (target.dead) continue
        if (target.unitType === unit.ownerType && target.id === unit.ownerId) continue
        if (!isFriendlyTargetForMissile113c(this, unit, target)) continue
        if (unit.hitUnitIds?.has(target.id)) continue
        if (distToSeg(target.x, target.y) <= hitRadius) {
          unit.hitUnitIds?.add(target.id)
          this.triggerMissileImpact(unit, target.x, target.y, false, target)
          if (consumePierceOrKillOnUnitHit(target.x, target.y)) {
            return
          }
        }
      }
    }
    if (unit.ownerType === 'monster') {
      for (const target of this._units.values()) {
        if (target.unitType !== 'player' && !(this._merc && target.id === this._merc.mercId)) {
          continue
        }
        if (target.dead) continue
        if (unit.hitUnitIds?.has(target.id)) continue
        if (distToSeg(target.x, target.y) <= hitRadius) {
          unit.hitUnitIds?.add(target.id)
          this.triggerMissileImpact(unit, target.x, target.y, false, target)
          if (consumePierceOrKillOnUnitHit(target.x, target.y)) {
            return
          }
        }
      }
    } else {
      const candidates = Array.from(this._monsters.values()).sort(
        (a, b) => Math.hypot(a.x - prevX, a.y - prevY) - Math.hypot(b.x - prevX, b.y - prevY),
      )
      for (const target of candidates) {
        const isDeadOrCorpse =
          target.dead ||
          target.mode === 0 ||
          target.mode === 12 ||
          (target.lifePct !== undefined && target.lifePct <= 0)
        if (isDeadOrCorpse) {
          const isHomingMissile =
            unit.missileKey === 'guidedarrow' ||
            unit.missileKey === 'bonespirit' ||
            unit.missileKey === 'monbonespirit'
          if (
            isHomingMissile ||
            target.diedAtMs === undefined ||
            this._timeMs - target.diedAtMs > 600 ||
            unit.piercedTargets?.has(target.id)
          ) {
            continue
          }
        }
        if (this._merc && target.id === this._merc.mercId) continue
        if (this._pets.has(target.id) || target.ownerType === 'player') continue
        if (this.isFriendlyOrNonHostileMonster(target, true)) continue
        const alreadyCollidedWithTarget =
          unit.missileKey === 'guidedarrow'
            ? Boolean(unit.piercedTargets?.has(target.id))
            : Boolean(unit.hitUnitIds?.has(target.id) || unit.piercedTargets?.has(target.id))
        if (alreadyCollidedWithTarget) continue
        if (stepMissileRow?.pCltHitFunc === 9) {
          const cHitPar2 = stepMissileRow.cHitPar2 ?? 1
          const matchesHostile =
            cHitPar2 === 1
              ? isMonsterUndead113c(target)
              : cHitPar2 === 2
                ? isMonsterDemon113c(target)
                : true
          if (!matchesHostile) continue
        }
        const effectiveHitRadius = unit.missileKey === 'guidedarrow' ? Math.max(hitRadius, 2.25) : hitRadius
        if (distToSeg(target.x, target.y) <= effectiveHitRadius) {
          unit.hitUnitIds?.add(target.id)
          if (!unit.piercedTargets) {
            unit.piercedTargets = new Set<number>()
          }
          unit.piercedTargets.add(target.id)
          this.triggerMissileImpact(unit, target.x, target.y, false, target)
          if (consumePierceOrKillOnUnitHit(target.x, target.y)) {
            return
          }
          if (unit.missileKey === 'guidedarrow') {
            // Guided Arrow pierced `target` (#1306): switch homingTarget to the nearest unhit living hostile monster
            // within 15 sub-tiles if one exists; otherwise keep target so it can re-home on the 5-frame cadence.
            let nextMonster: ClientUnit | undefined
            let bestDist = 15
            for (const m of this._monsters.values()) {
              if (
                m.id === target.id ||
                m.dead ||
                m.mode === 0 ||
                m.mode === 12 ||
                (m.lifePct !== undefined && m.lifePct <= 0) ||
                this.isFriendlyOrNonHostileMonster(m) ||
                unit.hitUnitIds?.has(m.id) ||
                unit.piercedTargets?.has(m.id)
              ) {
                continue
              }
              const d = Math.hypot(m.x - unit.x, m.y - unit.y)
              if (d <= bestDist) {
                bestDist = d
                nextMonster = m
              }
            }
            if (nextMonster !== undefined) {
              unit.homingTarget = { unitType: 'monster', id: nextMonster.id }
            }
          }
        }
      }
    }
  }

  // Lifetime / range expiry check
  if (unit.ageTicks >= (unit.maxTicks ?? 1)) {
    if (unit.emitterKind === 'frozenorb') {
      this.triggerMissileImpact(unit, unit.x, unit.y, false)
    } else if (
      unit.missileKey === 'meteorcenter' ||
      unit.missileKey === 'vampiremeteorcenter' ||
      unit.missileKey === 'royalstrikemeteorcenter' ||
      ((unit.missileKey === 'meteor' ||
        unit.missileKey === 'vampiremeteor' ||
        unit.missileKey === 'royalstrikemeteor') &&
        unit.alwaysExplode)
    ) {
      // 1.13c D2Client.dll MISSMODE_CltHit18_MeteorCenter (0x6fb66540, Issue #1170):
      // 1) 5 CltHitSubMissile1 ('meteorexplode' for meteorcenter #101 & vampiremeteorcenter #133,
      //    'royalstrikemeteorexplode' for royalstrikemeteorcenter) at cross offsets [(0,0), (0,4), (4,0), (0,-4), (-4,0)]
      // 2) 1 'whitelightmissile' (ID 154 / 0x9a, table light=5 but SetRadius(12) at spawn, range=10+slvl*10)
      //    at impact center
      // 3) 18 ground fires at METEOR_FIRE_SUBTILE_OFFSETS: indices 0..2 = CltHitSubMissile3 ('firemedium'),
      //    indices 3..17 = CltHitSubMissile4 ('firesmall'), skipping blocked sub-tiles.
      const destX = unit.targetX ?? unit.x
      const destY = unit.targetY ?? unit.y
      const slvl = Math.max(1, unit.skillLevel ?? 1)
      const isRoyal =
        unit.missileKey === 'royalstrikemeteorcenter' || unit.missileKey === 'royalstrikemeteor'
      const explodeKey = isRoyal ? 'royalstrikemeteorexplode' : 'meteorexplode'
      for (const off of METEOR_EXPLODE_SUBTILE_OFFSETS) {
        const ex = destX + off.x
        const ey = destY + off.y
        const exp = this.spawnMissileByKey(explodeKey, ex, ey, ex, ey, {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          sourceSkillId: unit.sourceSkillId,
          skillLevel: slvl,
          loopAnim: false,
          expandSubMissiles: false,
        })
        exp.vx = 0
        exp.vy = 0
      }
      const light = this.spawnMissileByKey('whitelightmissile', destX, destY, destX, destY, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        sourceSkillId: unit.sourceSkillId,
        skillLevel: slvl,
        maxTicks: 10 + slvl * 10,
        expandSubMissiles: false,
      })
      light.vx = 0
      light.vy = 0
      // 0x6fb666f2-0x6fb66702: when the spawned CltHitSubMissile2 (missiles.bin +0x2e = 154 for all three meteor
      // centres) owns a light, its radius is set to 12 (0x6fb58b60), replacing the table Light=5. Issue #830.
      light.missileLightRadius = 12
      for (let i = 0; i < METEOR_FIRE_SUBTILE_OFFSETS.length; i++) {
        const off = METEOR_FIRE_SUBTILE_OFFSETS[i]!
        const fx = destX + off.x
        const fy = destY + off.y
        if (this.isSubTileBlocked(fx, fy)) continue
        const fireKey = isRoyal
          ? 'royalstrikemeteorfire'
          : i < 3
            ? 'firemedium'
            : 'firesmall'
        const fm = this.spawnMissileByKey(fireKey, fx, fy, fx, fy, {
          ownerType: unit.ownerType,
          ownerId: unit.ownerId,
          sourceSkillId: unit.sourceSkillId,
          skillLevel: slvl,
          expandSubMissiles: false,
        })
        fm.vx = 0
        fm.vy = 0
      }
    } else if (unit.missileKey === 'hellmeteordown') {
      // 1.13c Missiles.txt #336 ('hellmeteordown', pCltHitFunc=36 @ 0x6FB6ABF0 -> 0x6FB69740, Issue #1172):
      // cHitPar1 = 5 (radius 5 disk scatter at 75% density), CltHitSubMissile1..3 = 'firewall' / 'firesmall' / 'firemedium'.
      const destX = unit.targetX ?? unit.x
      const destY = unit.targetY ?? unit.y
      const slvl = Math.max(1, unit.skillLevel ?? 1)
      const radius = 5
      const subKeys = ['firewall', 'firesmall', 'firemedium'] as const
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue
          const fx = destX + dx
          const fy = destY + dy
          if (this.isSubTileBlocked(fx, fy)) continue
          if (d2Rand(mSeed, 100) < 75) {
            const fireKey = subKeys[d2Rand(mSeed, 3)] ?? 'firewall'
            const fm = this.spawnMissileByKey(fireKey, fx, fy, fx, fy, {
              ownerType: unit.ownerType,
              ownerId: unit.ownerId,
              sourceSkillId: unit.sourceSkillId ?? 213,
              skillLevel: slvl,
            })
            fm.vx = 0
            fm.vy = 0
          }
        }
      }
    } else if (unit.missileKey === 'fistoftheheavensdelay') {
      // 1.13c Missiles.txt row #233 ('fistoftheheavensdelay', CltHitFunc=26 0x6FB6AD40):
      // radius = cHitPar1 > 0 ? cHitPar1 : Skill_aurarangecalc (20)
      // maxBolts = cHitPar2 > 0 ? cHitPar2 : Skill_calc4 (ln12 = 6 + (slvl - 1))
      // aurafilter = 42375 (0xA587: living, hostile, attackable monsters, not in town)
      if (!isTownLevel(this.areaId)) {
        const slvl = Math.max(1, unit.skillLevel ?? 1)
        const radius =
          FISTOFTHEHEAVENSDELAY_113C.cHitPar1 > 0
            ? FISTOFTHEHEAVENSDELAY_113C.cHitPar1
            : FISTOFTHEHEAVENSDELAY_113C.auraRange
        const maxBolts =
          FISTOFTHEHEAVENSDELAY_113C.cHitPar2 > 0
            ? FISTOFTHEHEAVENSDELAY_113C.cHitPar2
            : FISTOFTHEHEAVENSDELAY_113C.boltBase +
              (slvl - 1) * FISTOFTHEHEAVENSDELAY_113C.boltPerLevel
        const eligible: ClientUnit[] = []
        for (const m of this._monsters.values()) {
          if (m.dead || m.mode === 0 || m.mode === 12 || m.lifePct <= 0) continue
          if (this.isFriendlyOrNonHostileMonster(m)) continue
          if (Math.hypot(m.x - unit.x, m.y - unit.y) <= radius) {
            eligible.push(m)
          }
        }
        for (const m of eligible.slice(0, Math.max(0, maxBolts))) {
          this.spawnMissileByKey(
            FISTOFTHEHEAVENSDELAY_113C.cltHitSubMissile1,
            unit.x,
            unit.y,
            m.x,
            m.y,
            {
              ownerType: unit.ownerType,
              ownerId: unit.ownerId,
              sourceSkillId: unit.sourceSkillId ?? FISTOFTHEHEAVENSDELAY_113C.skillId,
              skillLevel: slvl,
            },
          )
        }
      }
    } else if (unit.missileKey === 'mephistoflyingrocksbig') {
      // 1.13c range end (0x6fb615c8) runs MissCltHitFunc[33] (0x6fb65dd0): TargetX (RAND(5) from CltDoFunc 26)
      // CltHitSubMissile1 mephistoflyingrockssmall within max(3, cHitPar1), then the row's AlwaysExplode
      // ExplosionMissile mephistoexplosionbig.
      const bursts = cltHit33Bursts(mSeed, unit.cltCountdown ?? 0, MEPHISTO_FLYING_ROCKS_BIG_113C.cHitPar1)
      for (const b of bursts) {
        this.spawnMissileByKey(
          MEPHISTO_FLYING_ROCKS_BIG_113C.cltHitSubMissile1,
          unit.x,
          unit.y,
          unit.x + b.dx,
          unit.y + b.dy,
          { ownerType: unit.ownerType, ownerId: unit.ownerId, skillLevel: b.level },
        )
      }
      this.triggerMissileImpact(unit, unit.x, unit.y, false)
    } else if (
      unit.missileKey === 'grimwardsmallstart' ||
      unit.missileKey === 'grimwardmediumstart' ||
      unit.missileKey === 'grimwardlargestart'
    ) {
      // 1.13c Missiles.txt rows #459/#462/#465 (pCltHitFunc=29): chain start -> loop (CltHitSubMissile1, Range=200).
      const loopKey =
        unit.missileKey === 'grimwardsmallstart'
          ? 'grimwardsmall'
          : unit.missileKey === 'grimwardlargestart'
            ? 'grimwardlarge'
            : 'grimwardmedium'
      const gwLoop = this.spawnMissileByKey(loopKey, unit.x, unit.y, unit.x, unit.y, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        sourceSkillId: unit.sourceSkillId,
        skillLevel: unit.skillLevel,
      })
      gwLoop.vx = 0
      gwLoop.vy = 0
    } else if (
      unit.missileKey === 'grimwardsmall' ||
      unit.missileKey === 'grimwardmedium' ||
      unit.missileKey === 'grimwardlarge'
    ) {
      // 1.13c Missiles.txt rows #460/#463/#466 (pCltHitFunc=29): chain loop -> stop (CltHitSubMissile1, Range=9).
      const stopKey =
        unit.missileKey === 'grimwardsmall'
          ? 'grimwardsmallstop'
          : unit.missileKey === 'grimwardlarge'
            ? 'grimwardlargestop'
            : 'grimwardmediumstop'
      const gwStop = this.spawnMissileByKey(stopKey, unit.x, unit.y, unit.x, unit.y, {
        ownerType: unit.ownerType,
        ownerId: unit.ownerId,
        sourceSkillId: unit.sourceSkillId,
        skillLevel: unit.skillLevel,
        loopAnim: false,
      })
      gwStop.vx = 0
      gwStop.vy = 0
    } else if (
      (unit.alwaysExplode || unit.missileKey === 'towermisttrail') &&
      unit.missileKey !== 'orbmisttrail' &&
      (unit.explosionMissile ||
        (CANONICAL_113C_MISSILES[unit.missileKey ?? '']?.pCltHitFunc ?? 0) > 0 ||
        (unit as any).lobPeakAltitude !== undefined ||
        unit.missileKey === 'freezingarrow' ||
        unit.missileKey === 'immolationarrow' ||
        unit.missileKey === 'plaguejavelin' ||
        unit.missileKey === 'armageddonrock' ||
        unit.missileKey === 'diablogeddonrock' ||
        unit.missileKey === 'volcano debris 2' ||
        unit.missileKey === 'bomb in air' ||
        unit.missileKey === 'shock field in air' ||
        unit.missileKey === 'catapultchargedball' ||
        unit.missileKey === 'catapult spike ball' ||
        unit.missileKey === 'catapult spike in air' ||
        unit.missileKey === 'catapult cold ball' ||
        unit.missileKey === 'catapult plague ball' ||
        unit.missileKey === 'catapult meteor ball' ||
        unit.missileKey === 'vines trail' ||
        unit.missileKey === 'plague vines trail' ||
        unit.missileKey === 'recycler vine' ||
        unit.missileKey === 'baal taunt lightning control' ||
        unit.missileKey === 'baal taunt poison control' ||
        unit.missileKey === 'baalcorpseexplodedelay' ||
        unit.missileKey === 'baalcorpseexplodeexpl' ||
        unit.missileKey === 'baal spawn monsters' ||
        unit.missileKey === 'moltenboulder' ||
        unit.missileKey === 'moltenboulderemerge' ||
        (unit.missileKey?.startsWith('blizzard') && unit.missileKey !== 'blizzardcenter') ||
        (unit.missileKey?.startsWith('monbliz') &&
          unit.missileKey !== 'monblizcenter' &&
          !unit.missileKey.startsWith('monblizexplode')))
    ) {
      this.triggerMissileImpact(unit, unit.x, unit.y, false)
    }
    const expSoundEntry = getMissileSoundEntry113c(
      unit.classId > 0 ? unit.classId : (unit.missileKey ?? ''),
    )
    if (expSoundEntry && expSoundEntry.travelSound > 0) {
      this.pushSoundRequest({
        kind: 'missile-destroy',
        entityId: unit.id,
      })
    }
    this._units.delete(unit.key)
  }
}

export function expireCastStatesImpl(this: ClientWorldInternal, nowMs?: number, dtMs = 0): void {
  const safeDt = Math.max(0, Number.isFinite(dtMs) ? dtMs : 0)
  if (nowMs !== undefined && Number.isFinite(nowMs)) {
    if (!this._clockExplicit) {
      for (const unit of this._units.values()) {
        if (unit.castState && nowMs < unit.castState.startedAtMs) {
          const elapsed = unit.castState.elapsedMs ?? 0
          const duration =
            unit.castState.durationMs ??
            Math.max(40, unit.castState.untilMs - unit.castState.startedAtMs)
          unit.castState.startedAtMs = nowMs - elapsed
          unit.castState.untilMs = unit.castState.startedAtMs + duration
        }
        if (unit.modeStartedAtMs !== undefined && nowMs < unit.modeStartedAtMs) {
          const elapsed = unit.modeElapsedMs ?? 0
          const duration =
            unit.modeDurationMs ??
            (unit.modeUntilMs !== undefined ? Math.max(40, unit.modeUntilMs - unit.modeStartedAtMs) : 0)
          unit.modeStartedAtMs = nowMs - elapsed
          if (unit.animStartedAtMs !== undefined && nowMs < unit.animStartedAtMs) {
            unit.animStartedAtMs = unit.modeStartedAtMs
          }
          if (unit.modeUntilMs !== undefined) {
            unit.modeUntilMs = unit.modeStartedAtMs + duration
          }
        }
      }
    }
    this._clockMs = nowMs
    this._clockExplicit = true
  } else if (safeDt > 0 && this._clockMs !== null) {
    this._clockMs += safeDt
  }

  const effNow = nowMs !== undefined && Number.isFinite(nowMs) ? nowMs : this._clockMs

  for (const unit of this._units.values()) {
    if (unit.castState) {
      if (safeDt > 0) {
        unit.castState.elapsedMs = (unit.castState.elapsedMs ?? 0) + safeDt
      }
      // Action-frame missile trigger (1.13c AnimData frame events): fire the
      // cast's missiles once the animation reaches its event frame — before
      // expiry processing so a last-frame event still fires on the same tick.
      if (
        unit.castState.missileFireDelayMs !== undefined &&
        unit.castState.missileSpawned !== true &&
        !unit.dead
      ) {
        const firedByElapsed =
          (unit.castState.elapsedMs ?? 0) >= unit.castState.missileFireDelayMs
        const firedByClock =
          effNow !== null && effNow - unit.castState.startedAtMs >= unit.castState.missileFireDelayMs
        if (firedByElapsed || firedByClock) {
          unit.castState.missileSpawned = true
          const isSelfUnit =
            unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)
          this.emitSkillKeyframeSound({
            skillId: unit.castState.skillId,
            flag: 1,
            x: unit.x,
            y: unit.y,
            unitId: unit.id,
            local: isSelfUnit,
          })
          this.spawnMissilesForSkill(
            unit,
            unit.castState.skillId,
            unit.castState.targetX,
            unit.castState.targetY,
            unit.castState.missileSkillLevel ?? 1,
            false,
          )
        }
      }
      if (
        unit.castState.secondMissileFireDelayMs !== undefined &&
        unit.castState.secondMissileSpawned !== true &&
        !unit.dead
      ) {
        const firedByElapsed =
          (unit.castState.elapsedMs ?? 0) >= unit.castState.secondMissileFireDelayMs
        const firedByClock =
          effNow !== null &&
          effNow - unit.castState.startedAtMs >= unit.castState.secondMissileFireDelayMs
        if (firedByElapsed || firedByClock) {
          unit.castState.secondMissileSpawned = true
          const isSelfUnit =
            unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)
          this.emitSkillKeyframeSound({
            skillId: unit.castState.skillId,
            flag: 2,
            x: unit.x,
            y: unit.y,
            unitId: unit.id,
            local: isSelfUnit,
          })
          this.spawnMissilesForSkill(
            unit,
            unit.castState.skillId,
            unit.castState.targetX,
            unit.castState.targetY,
            unit.castState.missileSkillLevel ?? 1,
            true,
          )
        }
      }
      const durationMs =
        unit.castState.durationMs ??
        Math.max(40, unit.castState.untilMs - unit.castState.startedAtMs)
      const expiredByClock =
        effNow !== null &&
        effNow >= unit.castState.untilMs &&
        effNow >= unit.castState.startedAtMs
      const expiredByElapsed = (unit.castState.elapsedMs ?? 0) >= durationMs
      const strafeVolleyActive =
        unit.castState.skillId === 26 &&
        (unit.castState.strafeShotsFired ?? 0) < (unit.castState.strafeTotalShots ?? 0)

      if ((expiredByClock || expiredByElapsed) && !strafeVolleyActive) {
        const castMode = unit.castState.mode
        unit.states.remove(18)
        unit.states.remove(174)
        if (unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)) {
          this._self.states.delete(18)
          this._self.states.delete(174)
        }
        this.clearUnitCastState(unit)
        if (
          !unit.dead &&
          (unit.mode === castMode ||
              (unit.unitType === 'player' &&
                ((unit.mode >= 7 && unit.mode <= 16) || unit.mode === 18)) ||
              (unit.unitType === 'monster' &&
                (isMonsterOneShotMode(unit.mode) || unit.mode === 14)))
        ) {
          unit.mode = unit.unitType === 'player' && isTownLevel(this.areaId) ? 5 : 1
          unit.modeStartedAtMs = effNow ?? this._timeMs
          unit.animStartedAtMs = undefined
          if (unit.unitType === 'monster') {
            const npcUnit = this.npcMotion.getUnit(unit.id)
            if (npcUnit && npcUnit.dwAnimMode === castMode) {
              this.npcMotion.changeAnimMode0x6FADA6C0(npcUnit, 1)
              npcUnit.lastAnimRestarted = false
            }
          }
          if (!unit.moveMode || unit.moveMode === 'stop') {
            unit.targetX = undefined
            unit.targetY = undefined
          }
        }
      }
    } else if (unit.modeUntilMs !== undefined) {
      if (unit.unitType === 'monster' && this.npcMotion.getUnit(unit.id) !== undefined) {
        continue
      }
      if (safeDt > 0) {
        unit.modeElapsedMs = (unit.modeElapsedMs ?? 0) + safeDt
      }
      const durationMs =
        unit.modeDurationMs ??
        Math.max(40, unit.modeUntilMs - (unit.modeStartedAtMs ?? 0))
      const expiredByClock =
        effNow !== null &&
        effNow >= unit.modeUntilMs &&
        effNow >= (unit.modeStartedAtMs ?? 0)
      const expiredByElapsed = (unit.modeElapsedMs ?? 0) >= durationMs

      if (expiredByClock || expiredByElapsed) {
        unit.modeUntilMs = undefined
        unit.modeDurationMs = undefined
        unit.modeElapsedMs = undefined
        unit.animStepSpeed256 = undefined
        unit.animEffRate = undefined
        if (unit.unitType === 'object' && unit.mode === 1) {
          unit.mode = 2
          const transitionMs = effNow ?? Date.now()
          unit.modeStartedAtMs = transitionMs
          unit.animStartedAtMs = transitionMs
          this.updateObjectCollisionFootprint(unit)
        } else if (unit.unitType === 'item' && unit.mode === 5) {
          // D2Client.dll 0x6fb3286a: once dwFrame >= wTotalFrames << 8, ITEMMODE_DROPPING (5)
          // transitions to ITEMMODE_ON_GROUND (3).
          unit.mode = 3
          unit.modeStartedAtMs = undefined
          unit.animStartedAtMs = undefined
        } else if (
          !unit.dead &&
          ((unit.unitType === 'player' &&
            (unit.mode === 4 || (unit.mode >= 7 && unit.mode <= 16) || unit.mode === 18)) ||
            (unit.unitType === 'monster' &&
              (isMonsterOneShotMode(unit.mode) || unit.mode === 14)))
        ) {
          unit.mode = unit.unitType === 'player' && isTownLevel(this.areaId) ? 5 : 1
        }
      }
    }
  }

  if (this._self.castState) {
    const selfUnit = this.selfId !== 0 ? this.getUnit('player', this.selfId) : undefined
    if (!selfUnit || !selfUnit.castState) {
      this._self.castState = undefined
    }
  }

  if (this._skillDelayUntilMs > 0 && effNow !== null && effNow >= this._skillDelayUntilMs) {
    this._skillDelayUntilMs = 0
    this._skillDelayDurationMs = 0
    this._self.states.delete(121)
    if (this.selfId !== 0) {
      const selfUnit = this.getUnit('player', this.selfId)
      selfUnit?.states.remove(121)
    }
  }

  // 1.13c D2Client.dll 0x6fb2b470 (MSG_TickOverheadMessages): expire unit overhead speech after 10,000 ms (0x2710)
  for (const unit of this._units.values()) {
    if (unit.overheadText !== undefined && unit.overheadExpireMs !== undefined) {
      const prevElapsed = (unit as { _overheadElapsedMs?: number | undefined })._overheadElapsedMs ?? 0
      const nextElapsed = safeDt > 0 ? prevElapsed + safeDt : prevElapsed
      ;(unit as { _overheadElapsedMs?: number | undefined })._overheadElapsedMs = nextElapsed
      const expiredByElapsed = nextElapsed >= OVERHEAD_SPEECH_TTL_MS
      const expiredByClock = effNow !== null && effNow >= unit.overheadExpireMs
      if (expiredByElapsed || expiredByClock) {
        unit.overheadText = undefined
        unit.overheadExpireMs = undefined
        unit.overheadColor = undefined
        ;(unit as { _overheadElapsedMs?: number | undefined })._overheadElapsedMs = undefined
      }
    }
  }

  // 1.13c D2Client.dll 0x6fb2b730 (MSG_DrawChatOverlay): expire active chat stream lines after 10,000 ms (0x2710)
  for (let i = this._activeChatStream.length - 1; i >= 0; i--) {
    const entry = this._activeChatStream[i]!
    if (safeDt > 0) {
      entry.elapsedMs = (entry.elapsedMs ?? 0) + safeDt
    }
    const expiredByElapsed = (entry.elapsedMs ?? 0) >= CHAT_LINE_TTL_MS
    const expiredByClock =
      effNow !== null &&
      entry.expireAtMs !== undefined &&
      entry.createdAtMs !== undefined &&
      effNow >= entry.expireAtMs &&
      effNow >= entry.createdAtMs
    if (expiredByElapsed || expiredByClock) {
      this._activeChatStream.splice(i, 1)
    }
  }
}

export function tickWorldImpl(this: ClientWorldInternal, dtMs = 40, nowMs?: number): void {
  if (!Number.isFinite(dtMs)) {
    throw new RangeError(`dtMs must be a finite number, got ${String(dtMs)}`)
  }
  const safeDt = Math.min(200, Math.max(0, dtMs))
  this._tickAccumulatorMs = Math.min(200, this._tickAccumulatorMs + safeDt)
  this._simTimeMs += safeDt
  if (nowMs !== undefined && Number.isFinite(nowMs)) {
    this._timeMs = nowMs
  } else {
    this._timeMs += safeDt
  }

  this.expireCastStates(nowMs, safeDt)
  this.refreshSelfLocomotionAnimSpeed()

  const D2_TICK_MS = 40
  const EPSILON = 1e-4
  while (this._tickAccumulatorMs >= D2_TICK_MS - EPSILON) {
    this._tickAccumulatorMs = Math.max(0, this._tickAccumulatorMs - D2_TICK_MS)
    this.stepDiscreteSimulationTick(D2_TICK_MS, nowMs)
  }
  this.updateScreenShake()

  for (const unit of this._units.values()) {
    if (unit.dead) continue
    if (unit.unitType === 'monster' && this.npcMotion.getUnit(unit.id) !== undefined) {
      continue
    }
    if (this.skipSelfTurnStep && unit.unitType === 'player' && (unit.id === this.selfId || (this.selfId === 0 && unit.id === 1))) {
      continue
    }
    unit.advanceTurn(safeDt)
  }

  if (!this.skipSelfTurnStep && this._pendingMeleeAttack !== null && this.selfId !== 0) {
    const targetUnit = this.getUnit(
      this._pendingMeleeAttack.target.unitType,
      this._pendingMeleeAttack.target.id,
    )
    const selfUnit = this.getUnit('player', this.selfId)
    if (targetUnit && selfUnit) {
      selfUnit.targetX = targetUnit.x
      selfUnit.targetY = targetUnit.y
      selfUnit.faceToward(targetUnit.x, targetUnit.y, false)
    }
  }

  // Continuous unit movement interpolation across display frames (standalone mode, non-monster units)
  if (safeDt > 0 && !this.skipRemoteUnitStep) {
    const inTown = isTownLevel(this.areaId)
    for (const unit of this._units.values()) {
      if (
        unit.dead ||
        unit.castState ||
        unit.unitType === 'missile' ||
        unit.unitType === 'monster'
      ) {
        continue
      }
      if (unit.targetX === undefined || unit.targetY === undefined) {
        unit.moving = false
        continue
      }
      const dx = unit.targetX - unit.x
      const dy = unit.targetY - unit.y
      const dist = Math.hypot(dx, dy)
      if (dist === 0) {
        unit.moving = false
        continue
      }
      const speedSubTilesPerSec = 10
      const step = (safeDt / 1000) * speedSubTilesPerSec
      if (step <= 0) continue

      const moveDist = Math.min(step, dist)
      const ux = dx / dist
      const uy = dy / dist
      const samples = Math.max(1, Math.ceil(moveDist / 0.125))
      let lastSafeX = unit.x
      let lastSafeY = unit.y
      let hitWall = false

      for (let i = 1; i <= samples; i++) {
        const stepFrac = (moveDist * i) / samples
        const sx = i === samples && dist <= step ? unit.targetX : unit.x + ux * stepFrac
        const sy = i === samples && dist <= step ? unit.targetY : unit.y + uy * stepFrac
        if (this.isSubTileBlocked(sx, sy)) {
          hitWall = true
          break
        }
        lastSafeX = sx
        lastSafeY = sy
      }

      if (hitWall) {
        unit.x = lastSafeX
        unit.y = lastSafeY
        unit.targetX = lastSafeX
        unit.targetY = lastSafeY
        unit.moving = false
        unit.moveMode = 'stop'
        if (
          unit.unitType === 'player' &&
          (unit.mode === 2 || unit.mode === 3 || unit.mode === 6 || unit.mode === 19)
        ) {
          unit.mode = inTown ? 5 : 1
        }
        continue
      }

      if (dist <= step) {
        unit.x = unit.targetX
        unit.y = unit.targetY
        unit.moving = false
        if (
          unit.unitType === 'player' &&
          (unit.mode === 2 || unit.mode === 3 || unit.mode === 6 || unit.mode === 19)
        ) {
          unit.mode = inTown ? 5 : 1
          unit.moveMode = 'stop'
          if (unit.id === this.selfId || this.selfId === 0) {
            this._self.mode = unit.mode
            this._self.moving = false
          }
        }
      } else {
        unit.x = lastSafeX
        unit.y = lastSafeY
        unit.moving = true
      }
    }
  }

  if (!this.skipSelfTurnStep && this._pendingMeleeAttack !== null) {
    this.checkPendingMeleeAttack(nowMs)
  }
}

export function stepDiscreteSimulationTickImpl(this: ClientWorldInternal, _tickDtMs = 40, nowMs?: number): void {
  this.frameCount++
  for (const unit of this._monsters.values()) {
    if (unit.dead) continue
    const mMode = unit.mode
    ;(unit as any)._wasMovingThisTick = mMode === 2 || Boolean(unit.moving)
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
      if (!unit.castState && (unit as any)._lastModeMissileMode !== mMode) {
        this.spawnMonsterModeMissile(unit, mMode)
      }
    } else if ((unit as any)._lastModeMissileMode !== undefined) {
      ;(unit as any)._lastModeMissileMode = undefined
    }
    const npcUnit = this.npcMotion.getUnit(unit.id)
    if (!npcUnit) continue
    if (unit.mode !== npcUnit.dwAnimMode) {
      if (unit.mode === MONMODE_KNOCKBACK && unit.moveMode === 'knockback') {
        const tx = unit.targetX ?? unit.x
        const ty = unit.targetY ?? unit.y
        const dist = Math.hypot(tx - unit.x, ty - unit.y)
        if (dist <= 1.0) {
          unit.x = tx
          unit.y = ty
          unit.moving = false
          unit.moveMode = 'stop'
          unit.mode = MONMODE_NEUTRAL
          this.npcMotion.changeAnimMode0x6FADA6C0(npcUnit, MONMODE_NEUTRAL)
          continue
        }
      }
      this.npcMotion.changeAnimMode0x6FADA6C0(npcUnit, unit.mode)
    }
  }
  this.npcMotion.tick()

  let objectNowMs: number | undefined
  const unitsSnapshot = Array.from(this._units.values())
  for (const unit of unitsSnapshot) {
    if (!this._units.has(unit.key)) continue

    // 1. Step missile units (1 simulation tick)
    if (unit.unitType === 'missile') {
      this.stepMissileUnit(unit)
      continue
    }

    // 1a. Objects: the 25 Hz animation step 0x6fad5660 (run by the per-object update 0x6fad5b40 before ClientFn),
    // which owns the client auto transition 1 → 2 and its `SetObjectLight(Lit[2])` (object-light.ts).
    if (unit.unitType === 'object') {
      objectNowMs ??= this.resolveEventNowMs(nowMs)
      const objectRecord = getObjectsTxtRecord113c(unit.classId)
      if (tickObjectAnim(unit, objectRecord, objectNowMs)) {
        this.updateObjectCollisionFootprint(unit)
      }
      // 0x6fad5b60: the per-object update then runs the object mode sound handler 0x6fad37e0 (#991 / #998).
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

    // 1a'. Locally predicted timed states (War Cry stun 21, Hurricane cold 11) expire on their
    // Skills.txt-derived frame count unless the server took ownership via 0xA8/0xA9.
    expirePredictedStates113c(unit, this.frameCount)

    // #277 Blade Shield (state 158 'bladeshield'): ensure 'blade shield attachment' (#553) exists while state 158 is active.
    if (
      (unit.unitType === 'player' || unit.unitType === 'monster') &&
      !unit.dead &&
      unit.states.has(158)
    ) {
      let hasAttachment = false
      for (const u of this._units.values()) {
        if (
          u.unitType === 'missile' &&
          u.missileKey === 'blade shield attachment' &&
          u.ownerType === unit.unitType &&
          u.ownerId === unit.id
        ) {
          hasAttachment = true
          break
        }
      }
      if (!hasAttachment) {
        const att = ensureBladeShieldAttachment113c(this, unit)
        this.stepMissileUnit(att)
      }
    }

    // 1b. Movement skills (#107 Charge, #132 Leap, #143 Leap Attack, #151 Whirlwind) & periodic state/summon emitters
    if (unit.unitType === 'player' && !unit.dead) {
      if (unit.castState) {
        if (unit.castState.chargeInPlaceAttack) {
          // 1.13c CltSt25 (0x6FADBFD1) & SrvSt31 (0x6FCB96A7): in-place Charge attack when target already in melee range.
          // Player executes Attack1 in place without dash displacement or state 18.
        } else {
          const csSkill = unit.castState.skillId
          if (csSkill === 107 || csSkill === 132 || csSkill === 143 || csSkill === 151) {
            let targetX = unit.castState.targetX
            let targetY = unit.castState.targetY
            const isSelfUnit = unit.id === this.selfId || this.selfId === 0

            // 1.13c Paladin Charge (#107 CltDo37 0x6FADB7D2 & SrvDo67 0x6FCB9DF7):
            // Dynamically follow alive targetUnit and check if within melee range every tick.
            if (csSkill === 107 && unit.targetUnit) {
              const targetUnit = this.getUnit(unit.targetUnit.unitType, unit.targetUnit.id)
              if (targetUnit && !targetUnit.dead && (targetUnit.x !== 0 || targetUnit.y !== 0)) {
                targetX = targetUnit.x
                targetY = targetUnit.y
                unit.castState.targetX = targetX
                unit.castState.targetY = targetY

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
                  false, // rangeBonus = 0 in CltDo37 / SrvDo67
                  collisionFn,
                )
                if (inMelee) {
                  // Reached target within melee range: terminate dash, clear state 18, and trigger Attack1
                  this.clearUnitCastState(unit)
                  unit.states.remove(18)
                  unit.states.remove(174)
                  if (isSelfUnit) {
                    this._self.states.delete(18)
                    this._self.states.delete(174)
                  }
                  unit.mode = 7
                  return
                }
              }
            }

            const dx = targetX - unit.x
            const dy = targetY - unit.y
            const dist = Math.hypot(dx, dy)
            const isLeapSkill = csSkill === 132 || csSkill === 143
            const stepSpeed =
              csSkill === 151
                ? 0.5
                : isLeapSkill && unit.castState.leapVelMag !== undefined
                  ? unit.castState.leapVelMag / 16
                  : csSkill === 107 && unit.castState.chargeStepSpeed !== undefined
                    ? unit.castState.chargeStepSpeed
                    : 1.5
            if (dist > 0.05) {
              const step = Math.min(dist, stepSpeed)
              const nextX = unit.x + (dx / dist) * step
              const nextY = unit.y + (dy / dist) * step

              // 1.13c CltDo37 0x6FADB859 / SrvDo67 0x6FCB9E35:
              // Collision obstacle terminates charge immediately!
              if (
                csSkill === 107 &&
                (this._collisionChecker !== null || this._blockedSubTiles?.size > 0) &&
                this.isSubTileBlocked(nextX, nextY)
              ) {
                this.clearUnitCastState(unit)
                unit.states.remove(18)
                unit.states.remove(174)
                if (isSelfUnit) {
                  this._self.states.delete(18)
                  this._self.states.delete(174)
                }
                unit.mode = 1 // stand
                return
              }

              unit.x = nextX
              unit.y = nextY
              unit.targetX = unit.x
              unit.targetY = unit.y
              if (isSelfUnit) {
                this._self.x = unit.x
                this._self.y = unit.y
              }
              if (isLeapSkill && unit.castState) {
                if (dist > step) {
                  // 1.13c UNIT_Step3DTrajectory (0x6FB77FB0) + D2LeapSetupTableStrc (0x6FB85F54):
                  // step 21.11 fixed-point vertical trajectory and sync with normalized flight progress
                  // so the jump arc reaches exact tier peakZ at midpoint.
                  const nextLeapTick = (unit.castState.leapTick ?? 0) + 1
                  unit.castState.leapTick = nextLeapTick
                  const posZ = (unit.castState.leapPosZ ?? 0) + (unit.castState.leapVelZ ?? 0)
                  const velZ = (unit.castState.leapVelZ ?? 0) + (unit.castState.leapAccelZ ?? 0)
                  unit.castState.leapPosZ = posZ
                  unit.castState.leapVelZ = velZ
                  const peakZ = unit.castState.leapPeakZ ?? 60
                  const totalDist = unit.castState.leapTotalDist ?? dist
                  const remDist = Math.max(0, dist - step)
                  const u = totalDist > 0.05 ? Math.max(0, Math.min(1, 1 - remDist / totalDist)) : 0.5
                  const parabolaZ = Math.round(4 * peakZ * u * (1 - u))
                  const fixedZ = Math.max(0, posZ >> 11)
                  unit.altitude = Math.max(parabolaZ, Math.min(peakZ, fixedZ))
                } else {
                  // 1.13c SKILLS_CltDo46_Leap / SKILLS_CltDo47_LeapAttack landing (0x6FB76CC7..0x6FB76CE0):
                  // ground altitude to 0, attach Overlay.txt #80 'dust' (BAJumpLandPuff01) landing dust, and play
                  // Sounds.txt #2517 'barbarian_leap_land' (skill\barbarian\leapland.wav).
                  unit.x = targetX
                  unit.y = targetY
                  unit.targetX = unit.x
                  unit.targetY = unit.y
                  unit.altitude = 0
                  if (isSelfUnit) {
                    this._self.x = unit.x
                    this._self.y = unit.y
                  }
                  this.attachUnitOverlay(unit, 'dust', false)
                  this.pushSoundRequest({
                    kind: 'sound',
                    soundId: 2517,
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
                  this.clearUnitCastState(unit)
                }
              } else if (dist <= step && (csSkill === 151 || csSkill === 107)) {
                this.clearUnitCastState(unit)
                unit.states.remove(18)
                unit.states.remove(174)
                if (isSelfUnit) {
                  this._self.states.delete(18)
                  this._self.states.delete(174)
                }
                if (csSkill === 107 && unit.targetUnit) {
                  unit.mode = 7
                }
              }
            } else if (isLeapSkill) {
              unit.altitude = 0
              this.attachUnitOverlay(unit, 'dust', false)
              this.pushSoundRequest({
                kind: 'sound',
                soundId: 2517,
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
              this.clearUnitCastState(unit)
            } else if (csSkill === 151 || csSkill === 107) {
              this.clearUnitCastState(unit)
              unit.states.remove(18)
              unit.states.remove(174)
              if (isSelfUnit) {
                this._self.states.delete(18)
                this._self.states.delete(174)
              }
              if (csSkill === 107 && unit.targetUnit) {
                unit.mode = 7
              }
            }
            if (csSkill === 151 && unit.castState) {
              // 1.13c PLR_SEQUENCE_TABLE_113C[10] (0x6FDEBE20) & SKILLS_CltDo45_Whirlwind (0x6FB764B0):
              // each 25Hz spin tick advances both direction and targetDirection by 1 quadrant (+16 in dir64 = 90°,
              // completing a full 360° spin every 4 ticks / 160ms across the 5-frame sequence loop 3..7).
              unit.setDirection((unit.direction + 16) & 63)
            }
          }
        }
      }
      // #46 Blaze trail (D2MOO SkillSor.cpp SKILLS_CreateBlazeMissile): emitted only while STATE_BLAZE
      // (States.txt id 13) is set and the unit moves. State 12 is 'inferno' (nosend) and must not trail.
      if (unit.blazeUntilTick !== undefined && this.frameCount >= unit.blazeUntilTick) {
        // Locally predicted Blaze duration (Skills.txt #46 auralencalc dm12) elapsed.
        unit.blazeUntilTick = undefined
        unit.states.remove(BLAZE_STATE_ID_113C)
        if (unit.id === this.selfId || this.selfId === 0) {
          this._self.states.delete(BLAZE_STATE_ID_113C)
        }
      }
      const blazeActive = unit.states.has(BLAZE_STATE_ID_113C)
      if (blazeActive) {
        if (unit.lastBlazeX === undefined || unit.lastBlazeY === undefined) {
          unit.lastBlazeX = unit.x
          unit.lastBlazeY = unit.y
        }
        const blazeDx = unit.x - unit.lastBlazeX
        const blazeDy = unit.y - unit.lastBlazeY
        const blazeDist = Math.hypot(blazeDx, blazeDy)
        if (blazeDist >= 0.75) {
          const steps = Math.min(8, Math.floor(blazeDist / 0.75))
          for (let s = 1; s <= steps; s++) {
            const bx = unit.lastBlazeX + (blazeDx * (s * 0.75)) / blazeDist
            const by = unit.lastBlazeY + (blazeDy * (s * 0.75)) / blazeDist
            const b = this.spawnMissileByKey('blaze', bx, by, bx, by, {
              ownerType: 'player',
              ownerId: unit.id,
              sourceSkillId: 46,
              skillLevel: unit.blazeSkillLevel ?? unit.skillLevel ?? 1,
            })
            b.vx = 0
            b.vy = 0
          }
          unit.lastBlazeX = unit.x
          unit.lastBlazeY = unit.y
        }
      } else {
        unit.lastBlazeX = undefined
        unit.lastBlazeY = undefined
      }

      // #119 Sanctuary (state 47, StateCltActiveFunc[86] 0x6FB07F60 -> 0x6FB06D00):
      // Every perdelay (50) frames, spawns cltmissilea='sanctuarybolt' (#57, Range=14, AnimLen=8, LoopAnim=1)
      // on living, hostile, non-boss Undead monsters within aurarangecalc (ln12 = 5 + (slvl - 1)).
      if (
        unit.states.has(SANCTUARY_AURA_113C.stateId) &&
        !isTownLevel(this.areaId) &&
        this.frameCount % SANCTUARY_AURA_113C.perDelay === 0
      ) {
        const selfSkillLvl =
          unit.id === this.selfId || this.selfId === 0
            ? this._self.skills.get(SANCTUARY_AURA_113C.skillId)
            : undefined
        const slvl = Math.max(1, selfSkillLvl ?? (unit as any).skillLevel ?? 1)
        const radius =
          SANCTUARY_AURA_113C.auraRangeBase +
          (slvl - 1) * SANCTUARY_AURA_113C.auraRangePerLevel
        for (const m of this._monsters.values()) {
          if (m.dead || m.mode === 0 || m.mode === 12 || m.lifePct <= 0) continue
          if (this.isFriendlyOrNonHostileMonster(m)) continue
          if (!isMonsterUndead113c(m)) continue
          if (getMonsterKindByClassId(m.classId)?.isBoss) continue
          if (Math.hypot(m.x - unit.x, m.y - unit.y) <= radius) {
            if (!m.overlays.some((o) => o.token === SANCTUARY_AURA_113C.tgtOverlay)) {
              this.attachUnitOverlay(m, SANCTUARY_AURA_113C.tgtOverlay, false)
            }
            const bolt = this.spawnMissileByKey(
              SANCTUARY_AURA_113C.cltMissileA,
              m.x,
              m.y,
              m.x,
              m.y,
              {
                ownerType: 'player',
                ownerId: unit.id,
                sourceSkillId: SANCTUARY_AURA_113C.skillId,
                skillLevel: slvl,
              },
            )
            bolt.vx = 0
            bolt.vy = 0
          }
        }
      }

      // #249 Armageddon / #349 Diablogeddon (state 145): periodic skyfall meteor rocks around caster every 8 frames
      if (unit.armageddonUntilTick !== undefined && this.frameCount >= unit.armageddonUntilTick) {
        unit.armageddonUntilTick = undefined
        unit.states.remove(145)
        if (unit.id === this.selfId || this.selfId === 0) {
          this._self.states.delete(145)
        }
      } else if (
        (unit.states.has(145) ||
          (unit.armageddonUntilTick !== undefined && this.frameCount < unit.armageddonUntilTick)) &&
        !isTownLevel(this.areaId) &&
        this.frameCount % 8 === 0
      ) {
        const isDiablogeddon = (unit as any).armageddonSkillId === 349
        const rockKey = isDiablogeddon ? 'diablogeddonrock' : 'armageddonrock'
        const tailKey = isDiablogeddon ? 'diablogeddontail' : 'armageddontail'
        const srcSkillId = isDiablogeddon ? 349 : 249
        const stepIdx = Math.floor(this.frameCount / 8)
        const offX = ((stepIdx * 11 + unit.id * 3) % 17) - 8
        const offY = ((stepIdx * 7 + unit.id * 5) % 17) - 8
        const dropX = unit.x + offX
        const dropY = unit.y + offY
        const skyOffset = 6.5
        const skyX = dropX - skyOffset
        const skyY = dropY - skyOffset
        const sLvl = unit.armageddonSkillLevel ?? 1
        const rock = this.spawnMissileByKey(rockKey, skyX, skyY, dropX, dropY, {
          ownerType: 'player',
          ownerId: unit.id,
          sourceSkillId: srcSkillId,
          skillLevel: sLvl,
          altitude: 625,
          verticalDescentPerTick: 25,
        })
        rock.vx = skyOffset / 25
        rock.vy = skyOffset / 25
        rock.alwaysExplode = true
        const tail = this.spawnMissileByKey(tailKey, skyX, skyY, dropX, dropY, {
          ownerType: 'player',
          ownerId: unit.id,
          sourceSkillId: srcSkillId,
          skillLevel: sLvl,
          altitude: 625,
          verticalDescentPerTick: 25,
        })
        tail.vx = skyOffset / 25
        tail.vy = skyOffset / 25
      }

      // #250 Hurricane (state 144, SkillCltDoFunc[90] @ 0x6FB79BE0): continuous orbiting vortex & debris across aurarangecalc = 9 subtiles
      if (unit.hurricaneUntilTick !== undefined && this.frameCount >= unit.hurricaneUntilTick) {
        unit.hurricaneUntilTick = undefined
        unit.states.remove(144)
        if (unit.id === this.selfId || this.selfId === 0) {
          this._self.states.delete(144)
        }
      } else if (
        (unit.states.has(144) ||
          (unit.hurricaneUntilTick !== undefined && this.frameCount < unit.hurricaneUntilTick)) &&
        !isTownLevel(this.areaId) &&
        this.frameCount % 5 === 0
      ) {
        const hLvl = unit.hurricaneSkillLevel ?? 1
        const pulseIdx = Math.floor(this.frameCount / 5)
        const phaseOffset = (pulseIdx * Math.PI) / 6
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
          const angle = phaseOffset + (i * 2 * Math.PI) / orbitSpecs.length
          const radius = spec.radius
          const sx = unit.x + Math.cos(angle) * radius
          const sy = unit.y + Math.sin(angle) * radius
          this.spawnMissileByKey(spec.key, sx, sy, sx, sy, {
            ownerType: 'player',
            ownerId: unit.id,
            sourceSkillId: 250,
            skillLevel: hLvl,
            pierce: true,
            originX: unit.x,
            originY: unit.y,
            spiralAngle: angle,
            spiralRadius: radius,
          })
        }
        for (const m of this._monsters.values()) {
          if (this.isFriendlyOrNonHostileMonster(m)) continue
          if (Math.hypot(m.x - unit.x, m.y - unit.y) <= 9) {
            // States.txt 'cold' (id 11) for Skills.txt ELen frames; 29 is 'convicted' (Conviction overlays).
            addPredictedTimedState113c(
              m,
              COLD_STATE_ID_113C,
              this.frameCount + hurricaneColdFrames113c(hLvl),
            )
          }
        }
      }
    } else if (unit.unitType === 'monster' && !unit.dead) {
      if (unit.tempSummonExpireTick !== undefined && this.frameCount >= unit.tempSummonExpireTick) {
        unit.dead = true
        unit.mode = 0
        unit.lifePct = 0
        this.attachUnitOverlay(unit, 'spawnedminion', false)
        this.triggerMonsterDeathFx(unit)
        continue
      }
      // 1.13c Skills.txt #349 Diablogeddon (state 145 = 'armageddon', CltPrgFunc1=92 @ 0x6FB795F0, Issue #1197):
      // Periodic meteor storm around monster caster every Param4=8 frames within aurarangecalc=par3=8 subtiles.
      if (unit.armageddonUntilTick !== undefined && this.frameCount >= unit.armageddonUntilTick) {
        unit.armageddonUntilTick = undefined
        unit.states.remove(145)
      } else if (
        (unit.states.has(145) ||
          (unit.armageddonUntilTick !== undefined && this.frameCount < unit.armageddonUntilTick)) &&
        !isTownLevel(this.areaId) &&
        this.frameCount % 8 === 0
      ) {
        const isArmageddon249 = (unit as any).armageddonSkillId === 249
        const rockKey = isArmageddon249 ? 'armageddonrock' : 'diablogeddonrock'
        const tailKey = isArmageddon249 ? 'armageddontail' : 'diablogeddontail'
        const srcSkillId = isArmageddon249 ? 249 : 349
        const stepIdx = Math.floor(this.frameCount / 8) + unit.id
        const angle = (stepIdx * 2.39996) % (Math.PI * 2)
        const rad = 1.5 + ((stepIdx * 7) % 6.5)
        const dropX = unit.x + Math.cos(angle) * rad
        const dropY = unit.y + Math.sin(angle) * rad * ISO_GROUND_ASPECT_RATIO
        const sLvl = Math.max(1, unit.armageddonSkillLevel ?? unit.skillLevel ?? 1)
        const rock = this.spawnMissileByKey(rockKey, dropX, dropY, dropX, dropY, {
          ownerType: 'monster',
          ownerId: unit.id,
          sourceSkillId: srcSkillId,
          skillLevel: sLvl,
          altitude: 625,
          verticalDescentPerTick: 25,
        })
        rock.vx = 0
        rock.vy = 0
        rock.alwaysExplode = true
        const tail = this.spawnMissileByKey(tailKey, dropX, dropY, dropX, dropY, {
          ownerType: 'monster',
          ownerId: unit.id,
          sourceSkillId: srcSkillId,
          skillLevel: sLvl,
          altitude: 625,
          verticalDescentPerTick: 25,
        })
        tail.vx = 0
        tail.vy = 0
      }
      // 1.13c SkillCltDoFunc[89] (0x6FB750F0, States.txt cltactivefunc=89 for STATE_VINE_BEAST = 150, Issue #1288):
      // Underground vine summon monsters (plaguepoppy #425, cycleoflife #426, vinecreature #427) have no monster DCC
      // under token 'k9' and emit Missiles.txt pod visuals ('vine beast neutral' #468 when idle every cltcalc2=35 frames;
      // 'vine beast walk 1' #466 / 'vine beast walk 2' #467 when tunneling; plus 'vines trail' #472 for #425).
      if (
        unit.classId === 425 ||
        unit.classId === 426 ||
        unit.classId === 427 ||
        unit.states.has(150)
      ) {
        unit.states.add(150)
        const vLvl = Math.max(1, unit.skillLevel ?? 1)
        const lastTick = (unit as any)._lastVinePodTick as number | undefined
        const hasLastPos =
          (unit as any)._lastVinePodX !== undefined && (unit as any)._lastVinePodY !== undefined
        const lastX = ((unit as any)._lastVinePodX as number | undefined) ?? unit.x
        const lastY = ((unit as any)._lastVinePodY as number | undefined) ?? unit.y
        const movedDist = hasLastPos ? Math.hypot(unit.x - lastX, unit.y - lastY) : 0
        if (
          unit.mode === 2 ||
          unit.moving ||
          Boolean((unit as any)._wasMovingThisTick) ||
          movedDist >= 0.5
        ) {
          if (
            lastTick === undefined ||
            this.frameCount - lastTick >= 15 ||
            movedDist >= 2
          ) {
            ;(unit as any)._lastVinePodTick = this.frameCount
            ;(unit as any)._lastVinePodX = unit.x
            ;(unit as any)._lastVinePodY = unit.y
            const walkIdx = (((unit as any)._vineWalkStep ?? 0) as number) + 1
            ;(unit as any)._vineWalkStep = walkIdx
            const walkKey = (walkIdx & 1) === 1 ? 'vine beast walk 1' : 'vine beast walk 2'
            const walkPod = this.spawnMissileByKey(walkKey, unit.x, unit.y, unit.x, unit.y, {
              ownerType: 'monster',
              ownerId: unit.id,
              sourceSkillId: 294,
              skillLevel: vLvl,
            })
            walkPod.vx = 0
            walkPod.vy = 0
            walkPod.alwaysExplode = true
            if (unit.classId === 425) {
              const trail = this.spawnMissileByKey('vines trail', unit.x, unit.y, unit.x, unit.y, {
                ownerType: 'monster',
                ownerId: unit.id,
                sourceSkillId: 222,
                skillLevel: vLvl,
                maxTicks: 100 + (vLvl - 1) * 25,
              })
              trail.vx = 0
              trail.vy = 0
              trail.alwaysExplode = true
            }
          }
        } else if (unit.mode === MONMODE_NEUTRAL && this.frameCount > 0 && this.frameCount % 35 === 0) {
          ;(unit as any)._lastVinePodTick = this.frameCount
          ;(unit as any)._lastVinePodX = unit.x
          ;(unit as any)._lastVinePodY = unit.y
          const neuPod = this.spawnMissileByKey('vine beast neutral', unit.x, unit.y, unit.x, unit.y, {
            ownerType: 'monster',
            ownerId: unit.id,
            sourceSkillId: 294,
            skillLevel: vLvl,
          })
          neuPod.vx = 0
          neuPod.vy = 0
          neuPod.alwaysExplode = true
        }
      }
      if (unit.mode === MONMODE_NEUTRAL && !isTownNpcHcIdx(unit.classId)) {
        const monRow = resolveUnitMonSoundRow113c(unit)
        if (monRow && monRow.neutral > 0 && monRow.neuTime > 0) {
          let nextTick = this._monsterNextNeutralSoundTick.get(unit.id)
          if (nextTick === undefined) {
            const jitter = (SEED_RollRandomNumber(unit.seed) >>> 0) % Math.max(1, monRow.neuTime)
            nextTick = this.frameCount + monRow.neuTime + jitter
            this._monsterNextNeutralSoundTick.set(unit.id, nextTick)
          } else if (this.frameCount >= nextTick) {
            if (this.frameCount - (this._lastGlobalNeutralSoundTick ?? -200) >= 125) {
              this._lastGlobalNeutralSoundTick = this.frameCount
              this.pushSoundRequest({
                soundId: monRow.neutral,
                unit: { unitType: 'monster', id: unit.id, x: unit.x, y: unit.y },
                x: unit.x,
                y: unit.y,
              })
            }
            const jitter = (SEED_RollRandomNumber(unit.seed) >>> 0) % Math.max(1, monRow.neuTime)
            this._monsterNextNeutralSoundTick.set(unit.id, this.frameCount + monRow.neuTime + jitter)
          }
        }
      }
      if (isMaggotSmallMonster(unit.classId, unit.name)) {
        let stomped = false
        if ((this._self.x !== 0 || this._self.y !== 0) && !this._isSelfDead) {
          if (Math.hypot(this._self.x - unit.x, this._self.y - unit.y) <= 1.5) {
            stomped = true
          }
        }
        if (!stomped) {
          for (const u of this._units.values()) {
            if (u.unitType === 'player' && !u.dead && Math.hypot(u.x - unit.x, u.y - unit.y) <= 1.5) {
              stomped = true
              break
            }
          }
        }
        if (stomped) {
          unit.dead = true
          unit.mode = 12
          unit.lifePct = 0
          unit.deathFxTriggered = true
          const npcUnit = this.npcMotion.getUnit(unit.id)
          if (npcUnit) {
            npcUnit.dwAnimMode = 12
            npcUnit.lifeByte = 0
            npcUnit.dwFlags = (npcUnit.dwFlags | 0x10000) >>> 0
          }
          continue
        }
      }
      if (unit.classId >= 351 && unit.classId <= 353) {
        unit.ageTicks = (unit.ageTicks ?? 0) + 1
        if (unit.ageTicks >= 12 && unit.mode === 9) {
          unit.mode = 1
          const npcUnit = this.npcMotion.getUnit(unit.id)
          if (npcUnit) {
            this.npcMotion.changeAnimMode0x6FADA6C0(npcUnit, 1)
          }
        }
        // 1.13c Hydra AI (hydra1..3, MonStats.txt AIDelay=15 + 9-frame A1 attack = ~24 ticks per head,
        // staggered by 5 ticks across the 3 heads after 12-tick S1 emergence):
        const headOffset = (unit.classId - 351) * 5
        const ticksAfterEmerge = unit.ageTicks - 14
        if (
          unit.mode !== 9 &&
          ticksAfterEmerge >= headOffset &&
          (ticksAfterEmerge - headOffset) % 24 === 0
        ) {
          for (const m of this._monsters.values()) {
            if (m.id === unit.id || this.isFriendlyOrNonHostileMonster(m)) {
              continue
            }
            if (Math.hypot(m.x - unit.x, m.y - unit.y) <= 20) {
              unit.faceToward(m.x, m.y, false)
              unit.mode = 4 // A1 attack animation
              const npcUnit = this.npcMotion.getUnit(unit.id)
              if (npcUnit) {
                this.npcMotion.changeAnimMode0x6FADA6C0(npcUnit, 4)
              }
              unit.modeStartedAtMs = this._simTimeMs
              unit.modeDurationMs = 240
              unit.modeUntilMs = this._simTimeMs + 240
              unit.modeElapsedMs = 0
              this.spawnMissileByKey('hydra', unit.x, unit.y, m.x, m.y, {
                ownerType: 'player',
                ownerId: unit.ownerId ?? 1,
                sourceSkillId: 62,
                maxTicks: 25,
              })
              break
            }
          }
        }
      }
    }

    // 2. Continuous channeling skill emission (#41 Inferno, #230 Arctic Blast, CltDoFunc 54 #178/#317/#319/#323, CltDoFunc 56 #193 DiabLight, #26 Strafe sequence event frames)
    if (
      !unit.dead &&
      unit.castState &&
      unit.castState.skillId === 26 &&
      unit.castState.strafeShotsFired !== undefined &&
      unit.castState.strafeTotalShots !== undefined &&
      unit.castState.strafeShotsFired < unit.castState.strafeTotalShots
    ) {
      const nextTick = unit.castState.strafeNextShotTick ?? 0
      if (this.frameCount >= nextTick) {
        const shotIdx = unit.castState.strafeShotsFired
        const total = unit.castState.strafeTotalShots
        const tx = unit.castState.strafeTargetX ?? unit.castState.targetX
        const ty = unit.castState.strafeTargetY ?? unit.castState.targetY
        const sLvl = Math.max(
          1,
          unit.castState.strafeSkillLevel ?? unit.castState.missileSkillLevel ?? unit.skillLevel ?? 1,
        )
        fireSingleStrafeShot113c(this, unit, tx, ty, sLvl, shotIdx, total)
        unit.castState.strafeShotsFired = shotIdx + 1
        unit.castState.strafeNextShotTick =
          this.frameCount + (unit.castState.strafeIntervalTicks ?? 3)
      }
    } else if (!unit.dead && unit.castState && CLT_DO54_INFERNO_113C[unit.castState.skillId] !== undefined) {
      const chSkillId = unit.castState.skillId
      const sLvl = Math.max(1, unit.castState.missileSkillLevel ?? unit.skillLevel ?? 1)
      spawnCltDo54InfernoTick113c(
        this,
        unit,
        chSkillId,
        unit.castState.targetX,
        unit.castState.targetY,
        sLvl,
      )
      unit.castState.missileSpawned = true
    } else if (!unit.dead && unit.castState && unit.castState.skillId === 193) {
      const sLvl = Math.max(1, unit.castState.missileSkillLevel ?? unit.skillLevel ?? 1)
      spawnCltDo56DiabLightTick113c(
        this,
        unit,
        unit.castState.targetX,
        unit.castState.targetY,
        sLvl,
      )
      unit.castState.missileSpawned = true
    } else if (!unit.dead && unit.castState && unit.castState.skillId === 282) {
      const sLvl = Math.max(1, unit.castState.missileSkillLevel ?? unit.skillLevel ?? 1)
      spawnCltDo71ImpInfernoTick113c(
        this,
        unit,
        unit.castState.targetX,
        unit.castState.targetY,
        sLvl,
      )
      unit.castState.missileSpawned = true
    } else if (!unit.dead && unit.castState && (unit.castState.skillId === 41 || unit.castState.skillId === 230)) {
      const chSkillId = unit.castState.skillId
      if (chSkillId === 41 && !(unit.castState as any).infernoChannelPrimed) {
        // 1.13c SKILLS_DoInferno (D2MOO SkillSor.cpp:50-121): initial frame only sets Param1=1 and spawns 0 missiles.
        ;(unit.castState as any).infernoChannelPrimed = true
        ;(unit as any).infernoChannelPrimed = true
        unit.castState.missileSpawned = true
        continue
      }
      const sLvl =
        unit.unitType === 'player' && (unit.id === this.selfId || this.selfId === 0)
          ? Math.max(1, this._self.skills.get(chSkillId) ?? unit.skillLevel ?? 1)
          : Math.max(1, unit.skillLevel ?? 1)
      const maxTicks =
        chSkillId === 230 ? arcticBlastRangeFrames113c(sLvl) : infernoFlameRangeFrames113c(sLvl)
      const mKey =
        chSkillId === 230
          ? this.frameCount % 2 === 0
            ? 'arcticblast1'
            : 'arcticblast2'
          : this.frameCount % 2 === 0
            ? 'infernoflame1'
            : 'infernoflame2'
      const rawDx = unit.castState.targetX - unit.x
      const rawDy = unit.castState.targetY - unit.y
      const rawDist = Math.hypot(rawDx, rawDy)
      const angle =
        rawDist > 0.05
          ? Math.atan2(rawDy, rawDx)
          : ((unit.direction & 63) / 64) * Math.PI * 2
      const cosA = Math.cos(angle)
      const sinA = Math.sin(angle)
      const startX = unit.x + cosA * 0.5
      const startY = unit.y + sinA * 0.5
      const aimX = startX + cosA * 16
      const aimY = startY + sinA * 16
      const m = this.spawnMissileByKey(mKey, startX, startY, aimX, aimY, {
        ownerType: unit.unitType,
        ownerId: unit.id,
        sourceSkillId: chSkillId,
        skillLevel: sLvl,
        maxTicks,
        pierce: true,
      })
      if (chSkillId === 230) {
        m.animSpeed = Math.max(1, Math.floor((16 * 16) / maxTicks))
      }
    }

    // 3. Step unit overlays (one-shot cast overlays & state overlays)
    if (unit.overlays.length > 0) {
      const remainingOverlays: ClientUnitOverlay[] = []
      for (const ov of unit.overlays) {
        ov.ageTicks += 1
        const rawFrame = Math.floor((ov.ageTicks * ov.animRate) / 16)
        if (ov.loop) {
          ov.frame = rawFrame % Math.max(1, ov.totalFrames)
          remainingOverlays.push(ov)
        } else if (ov.ageTicks < ov.maxTicks) {
          ov.frame = Math.min(Math.max(0, ov.totalFrames - 1), rawFrame)
          remainingOverlays.push(ov)
        } else if (ov.onExpire !== undefined) {
          // 1.13c overlay completion switch (D2Client 0x6FB1C1D7): chained overlays replace this one.
          for (const step of ov.onExpire) {
            remainingOverlays.push(
              createOverlayFromTxtRow113c(this._nextOverlayId++, step.overlayIndex, step.loop, step.onExpire),
            )
          }
        }
      }
      unit.overlays = remainingOverlays
    }

    // 4. Drain per-unit queued packets (unit+0xd8, 0x6fadb290 -> 0x6fb5bc20 -> 0x6fb5f560 -> 0x6fada750 -> 0x6fad5ce0 -> 0x6fad59f0)
    if (this._units.has(unit.key) && unit.queuedPackets.length > 0) {
      objectNowMs ??= this.resolveEventNowMs(nowMs)
      while (unit.queuedPackets.length > 0 && this._units.has(unit.key)) {
        const pkt = unit.queuedPackets.shift()!
        this.applyUnitModeImmediate(unit, pkt, objectNowMs)
      }
    }
  }
}
