/**
 * Pure 1:1 `D2Game.dll` v1.13c Blood Moor Fallen/Shaman/Skeleton AI,
 * boss-minion pack leadership (`AIGENERAL`), monster attack/cast mode initiation,
 * frame-step combat dispatch, critical hit doubling, and cast eligibility routines for `[K1]`.
 *
 * Every `@va`-annotated export is an instruction-faithful translation of its
 * corresponding `D2Game.dll` v1.13c routine operating on `Memory113c`.
 */

import {
  COLLISION_CheckMaskWithPattern2_113c,
  COLLISION_FindFreePositionSimple113c,
} from '../common/collision.ts'
import { MONSTER_GetMissileIdForAnimMode113c } from '../common/drlg/drlg-ver.ts'
import { DUNGEON_GetRoomCoordListFromSubtile113c } from '../common/dungeon.ts'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
} from '../common/k0-d2common-memports.ts'
import {
  PATH_GetNumberOfPathPoints113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetUnit113c,
  PATH_GetUnitCollisionPattern113c,
  PATH_SetStepNum113c,
  PATH_Compute113c,
} from '../common/path.ts'
import {
  SKILLS_CanMonsterReviveInMode2_113c,
  SKILLS_CheckLineOfSight113c,
  SKILLS_GetSkillById113c,
  SKILLS_SetParam0C113c,
} from '../common/skills.ts'
import {
  STATES_CheckState113c,
  STATES_CheckStateMask2OnUnit113c,
  STATES_CheckStateMask33OnUnit113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
} from '../common/statlist.ts'
import {
  UNITROOM_RefreshUnit113c,
  UNITS_AdvanceAnimFrame113c,
  UNITS_GetRoom113c,
  UNITS_GetUnitSizeX113c,
  UNITS_HasAnimFinished113c,
  UNIT_GetAlignment113c,
} from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  DATATBLS_GetMonLvlTxtRecord113c,
  MONSTERS_CheckMonStatsFlagBit6_113c,
  MONSTERS_IsDead113c,
} from '../tables/datatbls-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import {
  MONSTER_IsContinuousMode113c,
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_GetRecordPtr113c,
  MONSTATS_CheckFlagBit113c,
  MONSTER_GetBaseIdFromUnit113c,
  REGPOP_FindPackSpawnCoords113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SKILLS_GetRecordPtrFast113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_CalcSqDistSubtiles113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c.ts'
import {
  AIGENERAL_AllocAiCommand113c,
  AI_ApproachTarget113c,
  AI_FleeFrom113c,
  AI_IdleWander113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
  MONSTER_StepPath113c,
  SKILLS_GetFlags113c,
  SUNITDMG_ExecuteMissileOrMeleeDmg113c,
  type FallenSliceWorld113c,
} from './replay-kernel-113c.ts'

/** `D2Game.dll` `.data` `0x6FD2E668`: special AI dispatch table (`16` bytes/row). */
export const D2GAME_SPECIAL_AI_TABLE_VA_113C = 0x6fd2e668

/** `D2Game.dll` `.data` `0x6FD2E788`: standard `MonStatsTxt.wAi` dispatch table (`148` rows × `16` bytes). */
export const D2GAME_MONSTER_AI_TABLE_VA_113C = 0x6fd2e788

/** Reentrant stack frame pointer for `ai-fallen-113c.ts` stack structs. */
let aiFallenStackPtr = 0x7ff40000

/**
 * Optional hooks for external skill/missile/scan helpers when running without a full `FallenSliceWorld113c`.
 */
export interface AiFallenHooks113c extends RegpopSpawnHooks113c {
  onMonsterStartMode?: (
    m: Memory113c,
    pGame: number,
    pModeArgs: number,
    bUpdateAnim: number,
  ) => number
  onSkillDoStart?: (m: Memory113c, pUnit: number, pGame: number) => void
  onSkillDoStep?: (m: Memory113c, pUnit: number, pGame: number) => void
  onSpawnModeMissile?: (
    m: Memory113c,
    pGame: number,
    nMissileId: number,
    pUnit: number,
    nSkillId: number,
    nSkillLevel: number,
    x: number,
    y: number,
  ) => number
  onPostModeMissile?: (m: Memory113c, pUnit: number, pGame: number, nMissileId: number) => void
  onExecuteMeleeDamage?: (
    m: Memory113c,
    pAttacker: number,
    pGame: number,
    pDefender: number,
    pDamage: number,
    nSrcShift: number,
  ) => void
  onApplyPostMeleeHit?: (m: Memory113c, pGame: number, pAttacker: number, pDefender: number) => void
  onScanRadiusUnits?: (
    m: Memory113c,
    pGame: number,
    pOriginUnit: number,
    pScanCtx: number,
    nFilterMode: number,
    bUseCallback: boolean,
  ) => void
  onFindNearestPlayer?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    pOutDist: number,
  ) => number
  onSpawnBonePrison?: (
    m: Memory113c,
    pCaster: number,
    nClassId: number,
    pTarget: number,
    pRoom: number,
    nSubType: number,
  ) => number
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function stepSeed64Inline(m: Memory113c, pSeed: number): number {
  const lo = m.u32(pSeed >>> 0) >>> 0
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32(pSeed >>> 0, newLo)
  m.setU32((pSeed + 4) >>> 0, newHi)
  return newLo
}

function dispatchMonsterStartMode(
  m: Memory113c,
  pGame: number,
  pModeArgs: number,
  bUpdateAnim: number,
  world?: FallenSliceWorld113c,
  hooks?: AiFallenHooks113c,
): number {
  if (hooks !== undefined && hooks.onMonsterStartMode !== undefined) {
    return hooks.onMonsterStartMode(m, pGame, pModeArgs, bUpdateAnim) | 0
  }
  if (world !== undefined) {
    const mode = m.u32(pModeArgs) | 0
    const pUnit = m.u32((pModeArgs + 0x04) >>> 0) >>> 0
    const pTarget = m.u32((pModeArgs + 0x08) >>> 0) >>> 0
    const tx = m.u32((pModeArgs + 0x0c) >>> 0) | 0
    const ty = m.u32((pModeArgs + 0x10) >>> 0) | 0
    return MONSTER_StartMode113c(world, pUnit, mode, pTarget, tx, ty) ? 1 : 0
  }
  return 0
}

/**
 * Allocates an `8`-byte `D2MinionListStrc` (`+0x00 = dwMinionGuid`, `+0x04 = pNext`)
 * and prepends it to `pLeader->pMonsterData->pAiGeneral->pMinionList` (`+0x34`).
 *
 * @va D2Game:0x6FC40CF0 (95B)
 */
export function AIGENERAL_LinkMinionToLeader113c(
  m: Memory113c,
  pLeader: number,
  pMinion: number,
  _pGame: number,
): void {
  if (pLeader === 0) return
  if ((m.u32(pLeader) | 0) !== 1) return
  const pMonData = m.u32((pLeader + 0x14) >>> 0)
  const pAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) : 0
  const pNode = m.alloc(8)
  m.setU32(pNode, 0)
  m.setU32((pNode + 4) >>> 0, 0)
  const minionGuid = pMinion !== 0 ? m.u32((pMinion + 0x0c) >>> 0) : 0xffffffff
  m.setU32(pNode, minionGuid >>> 0)
  const pOldHead = m.u32((pAiGen + 0x34) >>> 0)
  if (pOldHead !== 0) {
    m.setU32((pNode + 4) >>> 0, pOldHead)
  }
  m.setU32((pAiGen + 0x34) >>> 0, pNode)
}

/**
 * Initializes `pUnit->pMonsterData->pAiGeneral` boss/group flags (`+0x08` bits `0x01`/`0x02`)
 * and owner fields (`+0x28 = pGame`, `+0x2C = nLeaderId`, `+0x30 = nLeaderType`).
 *
 * @va D2Game:0x6FC40D90 (69B)
 */
export function AIGENERAL_InitBossGroup113c(
  m: Memory113c,
  pUnit: number,
  nLeaderType: number,
  pGame: number,
  nLeaderId: number,
  bIsGroupMember: number,
  bIsBoss: number,
): void {
  if (pUnit === 0) return
  if ((m.u32(pUnit) | 0) !== 1) return
  const pMonData = m.u32((pUnit + 0x14) >>> 0)
  const pAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) : 0
  if (bIsBoss !== 0) {
    m.setU8((pAiGen + 0x08) >>> 0, (m.u8((pAiGen + 0x08) >>> 0) | 2) & 0xff)
  }
  if (bIsGroupMember !== 0) {
    m.setU8((pAiGen + 0x08) >>> 0, (m.u8((pAiGen + 0x08) >>> 0) | 1) & 0xff)
  }
  m.setU32((pAiGen + 0x2c) >>> 0, nLeaderId >>> 0)
  m.setU32((pAiGen + 0x30) >>> 0, nLeaderType >>> 0)
  m.setU32((pAiGen + 0x28) >>> 0, pGame >>> 0)
}

/**
 * Promotes the first active minion in `pBossAiGen->pMinionList` (`+0x34`) to new pack boss
 * when the current Fallen/group leader dies, linking `pOldBossUnit` and all remaining minions
 * onto the newly promoted leader (`F801: #12 -> #13`, `F1040: #13 -> #14`, `F1402: #14 -> #15`).
 *
 * @va D2Game:0x6FC410D0 (311B)
 */
export function AIGENERAL_ReassignPackOnBossDeath113c(
  m: Memory113c,
  pBossAiGen: number,
  pOldBossUnit: number,
): void {
  const pOrigHead = m.u32((pBossAiGen + 0x34) >>> 0)
  if (pOrigHead === 0) return

  const pGame = m.u32((pBossAiGen + 0x28) >>> 0)
  let pWalk = pOrigHead
  let pNewBoss = 0
  let newBossGuid = 0

  while (pWalk !== 0) {
    if (pGame === 0) {
      throw new Error('AIGENERAL_ReassignPackOnBossDeath113c: pGame == NULL (line 723)')
    }
    const candGuid = m.u32(pWalk) >>> 0
    pNewBoss = SUNIT_GetServerUnit113c(m, pGame, 1, candGuid)
    if (pNewBoss !== 0 && SUNIT_IsDeadOrDying113c(m, pNewBoss) === 0) {
      newBossGuid = candGuid
      break
    }
    pNewBoss = 0
    pWalk = m.u32((pWalk + 4) >>> 0)
  }

  if (pNewBoss === 0) return

  if ((m.u32(pNewBoss) | 0) === 1) {
    const pNewMonData = m.u32((pNewBoss + 0x14) >>> 0)
    const pNewAiGen = pNewMonData !== 0 ? m.u32((pNewMonData + 0x28) >>> 0) : 0
    m.setU8((pNewAiGen + 0x08) >>> 0, (m.u8((pNewAiGen + 0x08) >>> 0) | 3) & 0xff)
    m.setU32((pNewAiGen + 0x2c) >>> 0, newBossGuid)
    m.setU32((pNewAiGen + 0x30) >>> 0, 1)
    m.setU32((pNewAiGen + 0x28) >>> 0, pGame)
  }

  if (pOldBossUnit !== 0 && (m.u32(pOldBossUnit) | 0) === 1) {
    const pOldMonData = m.u32((pOldBossUnit + 0x14) >>> 0)
    const pOldAiGen = pOldMonData !== 0 ? m.u32((pOldMonData + 0x28) >>> 0) : 0
    m.setU32((pOldAiGen + 0x2c) >>> 0, newBossGuid)
    m.setU32((pOldAiGen + 0x30) >>> 0, 1)
    m.setU32((pOldAiGen + 0x28) >>> 0, pGame)
  }

  AIGENERAL_LinkMinionToLeader113c(m, pNewBoss, pOldBossUnit, pGame)

  let pCur = pOrigHead
  while (pCur !== 0) {
    const memberGuid = m.u32(pCur) >>> 0
    const pMember = SUNIT_GetServerUnit113c(m, pGame, 1, memberGuid)
    if (pMember !== 0 && pMember !== pNewBoss) {
      if ((m.u32(pMember) | 0) === 1) {
        const pMemMonData = m.u32((pMember + 0x14) >>> 0)
        const pMemAiGen = pMemMonData !== 0 ? m.u32((pMemMonData + 0x28) >>> 0) : 0
        m.setU32((pMemAiGen + 0x2c) >>> 0, newBossGuid)
        m.setU32((pMemAiGen + 0x30) >>> 0, 1)
        m.setU32((pMemAiGen + 0x28) >>> 0, pGame)
      }
      AIGENERAL_LinkMinionToLeader113c(m, pNewBoss, pMember, pGame)
    }
    pCur = m.u32((pCur + 4) >>> 0)
  }
}

/**
 * Resolves `pUnit->pMonsterData->pAiGeneral`'s owner unit (`SUNIT_GetServerUnit(pGame, eOwnerType, dwOwnerGUID)`).
 *
 * @va D2Game:0x6FC41260 (46B)
 */
export function AIGENERAL_GetPackLeaderUnit113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  if ((m.u32(pUnit) | 0) !== 1) return 0
  const pMonData = m.u32((pUnit + 0x14) >>> 0)
  if (pMonData === 0) return 0
  const pAiGen = m.u32((pMonData + 0x28) >>> 0)
  if (pAiGen === 0) return 0
  const pGame = m.u32((pAiGen + 0x28) >>> 0)
  if (pGame === 0) return 0
  const ownerGuid = m.u32((pAiGen + 0x2c) >>> 0)
  const ownerType = m.u32((pAiGen + 0x30) >>> 0) | 0
  return SUNIT_GetServerUnit113c(m, pGame, ownerType, ownerGuid)
}

/**
 * Broadcasts `5` `int32` command parameters (`pCmdTemplate + 0x08..+0x18` or `20`-byte `pCmdParams`)
 * across every live minion in `pUnit`'s pack leader's `pMinionList`, setting each minion's `pCurrentCmd` (`+0x20`).
 * Note: in `D2Game.dll` (`0x6FC413A9`), `ecx = [esp+0x18]` (`pCmdNode`) is indexed at `ecx + 8` (`5` dwords).
 *
 * @va D2Game:0x6FC412F0 (291B)
 */
export function AIGENERAL_BroadcastCmdToMinions113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  pCmdNode: number,
): void {
  const pLeader = AIGENERAL_GetPackLeaderUnit113c(m, pUnit)
  if (pLeader === 0) return
  if ((m.u32(pLeader) | 0) !== 1) return
  const pLeaderMonData = m.u32((pLeader + 0x14) >>> 0)
  if (pLeaderMonData === 0) return
  const pLeaderAiGen = m.u32((pLeaderMonData + 0x28) >>> 0)
  if (pLeaderAiGen === 0) return

  let pMinionNode = m.u32((pLeaderAiGen + 0x34) >>> 0)
  if (pMinionNode === 0) return

  while (pMinionNode !== 0) {
    const pHashGame = m.u32((pLeaderAiGen + 0x28) >>> 0)
    if (pHashGame === 0) {
      throw new Error('AIGENERAL_BroadcastCmdToMinions113c: pGame == NULL (line 723)')
    }
    const minionGuid = m.u32(pMinionNode) >>> 0
    const pMinion = SUNIT_GetServerUnit113c(m, pHashGame, 1, minionGuid)
    if (pMinion !== 0) {
      void pGame
      const pAllocCmd = AIGENERAL_AllocAiCommand113c(m, pMinion)
      if (pAllocCmd !== 0) {
        const pSrc = (pCmdNode + 0x08) >>> 0
        const pDst = (pAllocCmd + 0x08) >>> 0
        m.setU32(pDst, m.u32(pSrc))
        m.setU32((pDst + 0x04) >>> 0, m.u32((pSrc + 0x04) >>> 0))
        m.setU32((pDst + 0x08) >>> 0, m.u32((pSrc + 0x08) >>> 0))
        m.setU32((pDst + 0x0c) >>> 0, m.u32((pSrc + 0x0c) >>> 0))
        m.setU32((pDst + 0x10) >>> 0, m.u32((pSrc + 0x10) >>> 0))
        if ((m.u32(pMinion) | 0) === 1) {
          const pMinMonData = m.u32((pMinion + 0x14) >>> 0)
          if (pMinMonData !== 0) {
            const pMinAiGen = m.u32((pMinMonData + 0x28) >>> 0)
            if (pMinAiGen !== 0) {
              m.setU32((pMinAiGen + 0x20) >>> 0, pAllocCmd)
            }
          }
        }
      }
    }
    pMinionNode = m.u32((pMinionNode + 4) >>> 0)
  }
}

/**
 * Returns `1` if `(pUnit->pMonsterData->wTypeFlags & wMask) != 0` (`+0x16`), else `0`.
 *
 * @va D2Game:0x6FC42A80 (40B)
 */
export function MONSTER_CheckTypeFlagsMask113c(
  m: Memory113c,
  pUnit: number,
  wMask: number,
): number {
  if (pUnit === 0) return 0
  if ((m.u32(pUnit) | 0) !== 1) return 0
  const pMonData = m.u32((pUnit + 0x14) >>> 0)
  if (pMonData === 0) return 0
  return (m.u16((pMonData + 0x16) >>> 0) & (wMask & 0xffff)) !== 0 ? 1 : 0
}

/**
 * Clears `pUnit`'s active skill (`SKILLS_SetUsedSkill(pUnit, NULL)`) and initializes a `0x20`-byte
 * `D2ModeChangeStrc` (`+0x00 = nMode`, `+0x04 = pUnit`, `+0x15 = 101` if continuous else `100`).
 *
 * @va D2Game:0x6FC95070 (113B)
 */
export function MONSTER_InitModeChangeStrc113c(
  m: Memory113c,
  pUnit: number,
  pModeArgs: number,
  nMode: number,
): void {
  const mode = nMode | 0
  if (mode >= 0x10) {
    throw new Error('MONSTER_InitModeChangeStrc113c: nMode >= 16 (line 1976)')
  }
  SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
  m.fill(pModeArgs, 0x20, 0)
  m.setU32(pModeArgs, mode >>> 0)
  m.setU32((pModeArgs + 0x04) >>> 0, pUnit >>> 0)
  const isCont = MONSTER_IsContinuousMode113c(m, pUnit, mode)
  m.setU8((pModeArgs + 0x15) >>> 0, isCont ? 0x65 : 0x64)
}

/**
 * Mode-change handler for monster `A1` / `A2` / `S1..S4` / `SC` / `SQ`:
 * computes path if continuous, frees stale combat nodes (`0x6FCFA750`), changes animation mode,
 * and invokes skill `pfSrvDoStart` when `SKILLS_GetUsedSkill(pUnit) != NULL`.
 *
 * @va D2Game:0x6FC95510 (162B)
 */
export function MONSTER_StartAttackOrCast113c(
  m: Memory113c,
  pGame: number,
  pModeArgs: number,
  hooks?: AiFallenHooks113c,
): number {
  const nMode = m.u32(pModeArgs) | 0
  const pUnit = m.u32((pModeArgs + 0x04) >>> 0) >>> 0

  if (MONSTER_IsContinuousMode113c(m, pUnit, nMode)) {
    const pPath = m.u32((pUnit + 0x2c) >>> 0)
    if (PATH_GetNumberOfPathPoints113c(m, pPath) === 0) {
      const baseId = MONSTER_GetBaseIdFromUnit113c(m, pUnit)
      const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
      if (baseId < 0 || baseId >= (m.u32((pTables + 0xa80) >>> 0) | 0) || baseId !== 0x6e) {
        return 0
      }
      PATH_Compute113c(m, pPath, pUnit, 0)
      const modeReload = m.u32(pModeArgs) | 0
      SUNITDMG_FreeAttackerCombatList113c(m, pUnit, pGame)
      UNITS_ChangeAnimMode113c(m, pUnit, modeReload)
      return 1
    }
    PATH_Compute113c(m, pPath, pUnit, 0)
  }

  const modeFinal = m.u32(pModeArgs) | 0
  SUNITDMG_FreeAttackerCombatList113c(m, pUnit, pGame)
  UNITS_ChangeAnimMode113c(m, pUnit, modeFinal)
  if (SKILLS_GetUsedSkillMemPort113c(m, pUnit) !== 0) {
    if (hooks !== undefined && hooks.onSkillDoStart !== undefined) {
      hooks.onSkillDoStart(m, pUnit, pGame)
    }
  }
  return 1
}

/**
 * Fires a monster's animation-mode missile (`MONSTER_GetMissileIdForAnimMode`), scaling missile level
 * from `MonLvlTxt[difficulty].dwLevel + 1` or `STATLIST_GetUnitStat(pUnit, 12, 0)`.
 *
 * @va D2Game:0x6FC95C60 (122B)
 */
export function MONSTER_FireModeMissile113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  bCheckAnimEvent: number,
  hooks?: AiFallenHooks113c,
): number {
  if (pUnit === 0) return 0
  const nMissileId = MONSTER_GetMissileIdForAnimMode113c(m, pUnit, bCheckAnimEvent)
  if (nMissileId < 0) return 0

  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const pMonLvl = DATATBLS_GetMonLvlTxtRecord113c(m, bDiff)
  let lvl = ((m.u32((pMonLvl + 0x10) >>> 0) | 0) + 1) | 0
  if (((m.u32((pUnit + 0xc4) >>> 0) >>> 9) & 1) !== 0) {
    lvl = STATLIST_GetUnitStat113c(m, pUnit, 12, 0) | 0
  }

  const pMissile =
    hooks !== undefined && hooks.onSpawnModeMissile !== undefined
      ? hooks.onSpawnModeMissile(m, pGame, nMissileId, pUnit, 0, lvl, 0, 0) >>> 0
      : 0
  if (pMissile !== 0 && hooks !== undefined && hooks.onPostModeMissile !== undefined) {
    hooks.onPostModeMissile(m, pUnit, pGame, nMissileId)
  }
  return 1
}

/**
 * Per-frame `EVENT_MODE_STEP` (`type=0`) handler for monster attack/cast modes:
 * advances skill steps or animation action frame (`bActionFlag == 1` at `+0x4E`) and triggers
 * `MONSTER_FireModeMissile113c` or `MONSTER_ExecuteMeleeSwing113c`.
 *
 * @va D2Game:0x6FC95CE0 (302B)
 */
export function MONSTER_AdvanceAttackOrSkillStep113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  world?: FallenSliceWorld113c,
  hooks?: AiFallenHooks113c,
): number {
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit)
  if (pSkill !== 0) {
    const dwSkillFlags = SKILLS_GetFlags113c(m, pSkill)
    if ((dwSkillFlags & 1) !== 0) {
      SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
      const stepRes = world !== undefined ? MONSTER_StepPath113c(world, pUnit) : 0
      if (stepRes === 2) {
        SKILLS_SetParam0C113c(m, pSkill, (dwSkillFlags | 2) >>> 0)
        if (hooks !== undefined && hooks.onSkillDoStep !== undefined) {
          hooks.onSkillDoStep(m, pUnit, pGame)
        }
        if (pUnit !== 0 && (m.u32((pUnit + 0x10) >>> 0) | 0) === 0x0e) {
          if (((m.u32((pUnit + 0xc4) >>> 0) >>> 6) & 1) !== 0) {
            if (hooks !== undefined && hooks.onSkillDoStep !== undefined) {
              hooks.onSkillDoStep(m, pUnit, pGame)
            }
          }
          UNITS_AdvanceAnimFrame113c(m, pUnit)
          return 1
        }
        if (m.u8((pUnit + 0x4e) >>> 0) === 1) {
          if (hooks !== undefined && hooks.onSkillDoStep !== undefined) {
            hooks.onSkillDoStep(m, pUnit, pGame)
          }
        }
        UNITS_AdvanceAnimFrame113c(m, pUnit)
        return 1
      }
    }
    if (hooks !== undefined && hooks.onSkillDoStep !== undefined) {
      hooks.onSkillDoStep(m, pUnit, pGame)
    }
    UNITS_AdvanceAnimFrame113c(m, pUnit)
    return 1
  }

  const nMode = pUnit !== 0 ? m.u32((pUnit + 0x10) >>> 0) | 0 : 0
  const isCont = MONSTER_IsContinuousMode113c(m, pUnit, nMode) ? 1 : 0
  if (isCont !== 0) {
    if (world !== undefined) {
      MONSTER_StepPath113c(world, pUnit)
    }
    UNITS_AdvanceAnimFrame113c(m, pUnit)
    if (UNITS_HasAnimFinished113c(m, pUnit) !== 0) {
      return 2
    }
    let shouldTrigger = false
    if (pUnit !== 0 && (m.u32((pUnit + 0x10) >>> 0) | 0) === 0x0e) {
      if (((m.u32((pUnit + 0xc4) >>> 0) >>> 6) & 1) !== 0) {
        shouldTrigger = true
      }
    } else if (pUnit !== 0 && m.u8((pUnit + 0x4e) >>> 0) === 1) {
      shouldTrigger = true
    }
    if (!shouldTrigger) return 1
  }

  if (MONSTER_FireModeMissile113c(m, pUnit, pGame, isCont, hooks) === 0) {
    MONSTER_ExecuteMeleeSwing113c(m, pUnit, pGame, world, hooks)
    SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
    const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0))
    if (pTarget !== 0 && pTarget !== pUnit) {
      if (hooks !== undefined && hooks.onApplyPostMeleeHit !== undefined) {
        hooks.onApplyPostMeleeHit(m, pGame, pUnit, pTarget)
      }
    }
  }
  return 1
}

/**
 * Rolls monster critical strike (`MonStatsTxt.bCrit` at `+0xA6`, `5%` for standard monsters)
 * using `pAttacker->tSeed` (`+0x20`), doubling physical/elemental damage channels (`+0x08`, `+0x10`, `+0x1C..+0x28`)
 * and setting `wResultFlags |= 0x10` (or state icon `0x36` if `(wResultFlags & 0xF0) != 0`).
 *
 * @va D2Game:0x6FC970E0 (225B)
 */
export function MONSTER_ApplyCritDamage113c(
  m: Memory113c,
  pAttacker: number,
  pDamage: number,
  pDefender: number,
): void {
  if (pAttacker === 0) return
  if ((m.u32(pAttacker) | 0) !== 1) return
  const nClassId = m.u32((pAttacker + 0x04) >>> 0) | 0
  if (nClassId < 0) return
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (nClassId >= (m.u32((pTables + 0xa80) >>> 0) | 0)) return
  const pMonStats = (m.u32((pTables + 0xa78) >>> 0) + Math.imul(nClassId, 0x1a8)) >>> 0
  if (pMonStats === 0) return

  const bCrit = m.u8((pMonStats + 0xa6) >>> 0)
  if (bCrit === 0) return

  const roll100 = (stepSeed64Inline(m, (pAttacker + 0x20) >>> 0) >>> 0) % 100
  if (roll100 >= m.u8((pMonStats + 0xa6) >>> 0)) return

  m.setU32((pDamage + 0x10) >>> 0, (m.u32((pDamage + 0x10) >>> 0) << 1) >>> 0)
  m.setU32((pDamage + 0x08) >>> 0, (m.u32((pDamage + 0x08) >>> 0) << 1) >>> 0)
  m.setU32((pDamage + 0x20) >>> 0, (m.u32((pDamage + 0x20) >>> 0) << 1) >>> 0)
  m.setU32((pDamage + 0x1c) >>> 0, (m.u32((pDamage + 0x1c) >>> 0) << 1) >>> 0)
  m.setU32((pDamage + 0x28) >>> 0, (m.u32((pDamage + 0x28) >>> 0) << 1) >>> 0)
  m.setU32((pDamage + 0x24) >>> 0, (m.u32((pDamage + 0x24) >>> 0) << 1) >>> 0)

  if (pDefender === 0) return
  const flags60 = m.u32((pDamage + 0x60) >>> 0)
  if ((flags60 & 0xf0) === 0) {
    m.setU32((pDamage + 0x60) >>> 0, (flags60 | 0x10) >>> 0)
    return
  }
  STATES_SetMonsterSkillIconOnUnit113c(m, pDefender, 0x36, 0)
}

/**
 * Executes a monster's melee swing at its animation contact frame:
 * validates `pAttacker->pDynamicPath` target (`0x6FD007A0`) and runs the full `0x70`-byte `D2DamageStrc`
 * melee combat pipeline against `pDefender`.
 *
 * @va D2Game:0x6FC97790 (92B)
 */
export function MONSTER_ExecuteMeleeSwing113c(
  m: Memory113c,
  pAttacker: number,
  pGame: number,
  world?: FallenSliceWorld113c,
  hooks?: AiFallenHooks113c,
): void {
  SUNIT_ValidatePathTargetUnit113c(m, pAttacker, pGame)
  const pPath = m.u32((pAttacker + 0x2c) >>> 0)
  const pDefender = PATH_GetTargetUnit113c(m, pPath)
  if (pDefender === pAttacker || pDefender === 0) return

  if (hooks !== undefined && hooks.onExecuteMeleeDamage !== undefined) {
    const sp = aiFallenStackPtr
    aiFallenStackPtr = (sp + 0x70) >>> 0
    try {
      m.fill(sp, 0x70, 0)
      hooks.onExecuteMeleeDamage(m, pAttacker, pGame, pDefender, sp, 0x80)
    } finally {
      aiFallenStackPtr = sp
    }
    return
  }

  if (world !== undefined) {
    SUNITDMG_ExecuteMissileOrMeleeDmg113c(world, pAttacker, pDefender, 0, 0)
  }
}

/**
 * Callback filter for `AI_FallenShaman` corpse scan: selects non-boss/non-unique (`(wTypeFlags & 0x0C) == 0`)
 * dead (`mode == 12`) Fallen (`baseId == 19`) or Fetish (`baseId == 58`) corpses within `pScanCtx->nMaxSqDist` (`+0x0C`)
 * that have no revive-blocking state masks (`STATES_CheckStateMask33OnUnit` / `STATES_CheckStateMask2OnUnit`).
 *
 * @va D2Game:0x6FC9BD50 (177B)
 */
export function AI_FallenShamanCorpseFilter113c(
  m: Memory113c,
  pShaman: number,
  pCandidate: number,
  pScanCtx: number,
): number {
  if (pShaman === pCandidate || pCandidate === 0) return 0
  if ((m.u32(pCandidate) | 0) !== 1) return 0

  const baseId = MONSTER_GetBaseIdFromUnit113c(m, pCandidate)
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (baseId < 0 || baseId >= (m.u32((pTables + 0xa80) >>> 0) | 0)) return 0
  if (baseId !== 0x13 && baseId !== 0x3a) return 0

  if (UNIT_GetAlignment113c(m, pCandidate) !== 0) return 0
  if (((m.u32((pCandidate + 0xc4) >>> 0) >>> 1) & 1) === 0) return 0
  if (STATES_CheckStateMask33OnUnit113c(m, pCandidate) !== 0) return 0
  if ((m.u32((pCandidate + 0x10) >>> 0) | 0) !== 0x0c) return 0
  if (STATES_CheckStateMask2OnUnit113c(m, pCandidate) !== 0) return 0

  const sqDist = UNIT_CalcSqDistSubtiles113c(m, pShaman, pCandidate)
  if (sqDist > (m.u32((pScanCtx + 0x0c) >>> 0) | 0)) return 0
  if (MONSTER_CheckTypeFlagsMask113c(m, pCandidate, 0x0c) !== 0) return 0

  m.setU32(pScanCtx, pCandidate >>> 0)
  m.setU32((pScanCtx + 0x04) >>> 0, ((m.u32((pScanCtx + 0x04) >>> 0) | 0) + 1) >>> 0)
  m.setU32((pScanCtx + 0x08) >>> 0, sqDist >>> 0)
  return 0
}

/**
 * `AI_Skeleton` (`MonStatsTxt.wAi == 1`): melee charge (`pAiControl->dwAiState == 1`), `aip3` swing roll,
 * `aip4` retreat/counter-swing, `aip1` velocity-overridden approach (`0x6FD11A20`), and `aip2` tactical wander.
 *
 * @va D2Game:0x6FCA3550 (856B)
 */
export function AI_Skeleton113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pAiArgs: number,
  world?: FallenSliceWorld113c,
  hooks?: AiFallenHooks113c,
): void {
  const pAiControl = m.u32(pAiArgs) >>> 0
  const nDist = m.u32((pAiArgs + 0x14) >>> 0) | 0
  const pMonStatsTxt = m.u32((pAiArgs + 0x1c) >>> 0) >>> 0
  const bInMelee = m.u32((pAiArgs + 0x18) >>> 0) | 0
  const pTarget = m.u32((pAiArgs + 0x08) >>> 0) >>> 0
  const pUnitSeed = (pUnit + 0x20) >>> 0

  const startMode4 = (): void => {
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
    const sp = aiFallenStackPtr
    aiFallenStackPtr = (sp + 0x20) >>> 0
    try {
      m.fill(sp, 0x20, 0)
      m.setU32(sp, 4)
      m.setU32((sp + 0x04) >>> 0, pUnit)
      m.setU32((sp + 0x08) >>> 0, pTarget)
      let speedByte = 0x64
      if (pUnit !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0)
        if (pMonStats2 !== 0) {
          const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
          if ((m.u8((pMonStats2 + 0x104) >>> 0) & m.u32((pMasks + 0x10) >>> 0)) !== 0) {
            speedByte = 0x65
          }
        }
      }
      m.setU8((sp + 0x15) >>> 0, speedByte)
      dispatchMonsterStartMode(m, pGame, sp, 1, world, hooks)
    } finally {
      aiFallenStackPtr = sp
    }
  }

  if ((m.u32((pAiControl + 0x14) >>> 0) | 0) === 1 && bInMelee !== 0) {
    m.setU32((pAiControl + 0x14) >>> 0, 0)
    startMode4()
    return
  }

  m.setU32((pAiControl + 0x14) >>> 0, 0)
  const bDiff = m.u8((pGame + 0x6d) >>> 0)

  if (bInMelee !== 0) {
    const roll100 = (stepSeed64Inline(m, pUnitSeed) >>> 0) % 100
    const aip3 = sx16(m.u16((pMonStatsTxt + 0x62 + bDiff * 2) >>> 0))
    if ((roll100 | 0) < aip3) {
      startMode4()
      return
    }
    const aip4 = sx16(m.u16((pMonStatsTxt + 0x68 + bDiff * 2) >>> 0))
    if (aip4 < -0x7e || aip4 > 0x7e) {
      throw new Error('AI_Skeleton113c: out-of-bounds velocity override (line 272)')
    }
    const pMonData =
      pUnit !== 0 && (m.u32(pUnit) | 0) === 1 ? m.u32((pUnit + 0x14) >>> 0) : 0
    const pAiParam = pMonData !== 0 ? m.u32((pMonData + 0x2c) >>> 0) : 0
    if (aip4 !== 0) {
      m.setU32((pAiParam + 0x1c) >>> 0, aip4 >>> 0)
    }
    const fled = world !== undefined ? AI_FleeFrom113c(world, pTarget, pUnit, 4, true) : 0
    if (!fled) {
      AI_StartAttackMode113c(m, 4, pUnit, pGame, pTarget, world, hooks)
    }
    return
  }

  const approachRoll = (stepSeed64Inline(m, pUnitSeed) >>> 0) % 100
  const aip1 = sx16(m.u16((pMonStatsTxt + 0x56 + bDiff * 2) >>> 0))
  if ((approachRoll | 0) < aip1) {
    const aip5 = sx16(m.u16((pMonStatsTxt + 0x6e + bDiff * 2) >>> 0))
    AI_SetAiControlOverrides113c(m, pUnit, 0, aip5, nDist & 0xff)
    m.setU32((pAiControl + 0x14) >>> 0, 1)
    if (world !== undefined) {
      AI_ApproachTarget113c(world, pUnit, pTarget, 2, 0, 0, 1, 0)
    }
    return
  }

  if (nDist > 3) {
    const wanderRoll = SEED_RollLimitedFast113c(m, pUnitSeed, 100)
    const bDiffNow = m.u8((pGame + 0x6d) >>> 0)
    const aip2 = sx16(m.u16((pMonStatsTxt + 0x5c + bDiffNow * 2) >>> 0))
    if (wanderRoll < aip2) {
      const pMonData =
        pUnit !== 0 && (m.u32(pUnit) | 0) === 1 ? m.u32((pUnit + 0x14) >>> 0) : 0
      const pAiParam = pMonData !== 0 ? m.u32((pMonData + 0x2c) >>> 0) : 0
      m.setU32((pAiParam + 0x1c) >>> 0, 0xffffffce)
      if (world !== undefined) {
        AI_IdleWander113c(world, pUnit, 4)
      }
      return
    }
    if (world !== undefined) {
      AI_IdleWander113c(world, pUnit, 3)
    }
    return
  }

  const aip4Close = sx16(m.u16((pMonStatsTxt + 0x68 + bDiff * 2) >>> 0))
  if (aip4Close < -0x7e || aip4Close > 0x7e) {
    throw new Error('AI_Skeleton113c: out-of-bounds velocity override (line 272)')
  }
  const pMonDataClose =
    pUnit !== 0 && (m.u32(pUnit) | 0) === 1 ? m.u32((pUnit + 0x14) >>> 0) : 0
  const pAiParamClose = pMonDataClose !== 0 ? m.u32((pMonDataClose + 0x2c) >>> 0) : 0
  if (aip4Close !== 0) {
    m.setU32((pAiParamClose + 0x1c) >>> 0, aip4Close >>> 0)
  }
  const fledClose = world !== undefined ? AI_FleeFrom113c(world, pTarget, pUnit, 4, true) : 0
  if (!fledClose) {
    AI_StartAttackMode113c(m, 4, pUnit, pGame, pTarget, world, hooks)
  }
}

/**
 * `AI_FallenShaman` (`MonStatsTxt.wAi == 6`):
 * 1. Melee `A1` swing (`aip3`) when `bInMelee != 0`,
 * 2. Radius `aip4^2` Fallen/Fetish corpse scan (`AI_FallenShamanCorpseFilter113c`),
 * 3. Pack rally broadcast (`AIGENERAL_BroadcastCmdToMinions113c` cmd `1` on `aip1`),
 * 4. `Raise` cast (`wSkill1` via `AI_CastSkillMode14_113c` on `aip1`),
 * 5. `Firebolt` cast (`wSkill2` via `AI_CastSkillWithMode113c` within `aip5` on `aip2`),
 * 6. Flanking circlestrafe approach (`pathType = 5` or `6`, `dist = 3` on `aip3`) or `10`-frame `AI_Stall`.
 *
 * @va D2Game:0x6FCA90A0 (906B)
 */
export function AI_FallenShaman113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pAiArgs: number,
  world?: FallenSliceWorld113c,
  hooks?: AiFallenHooks113c,
): void {
  let curDist = m.u32((pAiArgs + 0x14) >>> 0) | 0
  const bInMelee = m.u32((pAiArgs + 0x18) >>> 0) | 0
  const pTarget = m.u32((pAiArgs + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiArgs + 0x1c) >>> 0) >>> 0
  const pUnitSeed = (pUnit + 0x20) >>> 0

  if (bInMelee !== 0) {
    const meleeRoll = (stepSeed64Inline(m, pUnitSeed) >>> 0) % 100
    const bDiff0 = m.u8((pGame + 0x6d) >>> 0)
    const aip3 = sx16(m.u16((pMonStatsTxt + 0x62 + bDiff0 * 2) >>> 0))
    if ((meleeRoll | 0) < aip3) {
      SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
      const sp = aiFallenStackPtr
      aiFallenStackPtr = (sp + 0x20) >>> 0
      try {
        m.fill(sp, 0x20, 0)
        m.setU32(sp, 4)
        m.setU32((sp + 0x04) >>> 0, pUnit)
        m.setU32((sp + 0x08) >>> 0, pTarget)
        let speedByte = 0x64
        if (pUnit !== 0) {
          const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0)
          if (pMonStats2 !== 0) {
            const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
            if ((m.u8((pMonStats2 + 0x104) >>> 0) & m.u32((pMasks + 0x10) >>> 0)) !== 0) {
              speedByte = 0x65
            }
          }
        }
        m.setU8((sp + 0x15) >>> 0, speedByte)
        dispatchMonsterStartMode(m, pGame, sp, 1, world, hooks)
      } finally {
        aiFallenStackPtr = sp
      }
      return
    }
  }

  const sp = aiFallenStackPtr
  aiFallenStackPtr = (sp + 0x40) >>> 0
  try {
    const pCmdBuf = sp
    const pScanCtx = (sp + 0x20) >>> 0
    const pNearDist = (sp + 0x34) >>> 0
    m.fill(pCmdBuf, 0x38, 0)

    const bDiff1 = m.u8((pGame + 0x6d) >>> 0)
    const aip4 = sx16(m.u16((pMonStatsTxt + 0x68 + bDiff1 * 2) >>> 0))
    m.setU32((pScanCtx + 0x0c) >>> 0, Math.imul(aip4, aip4) >>> 0)

    let useCustomCorpseFilter = false
    if (pUnit !== 0 && (m.u32(pUnit) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0)
      if (pMonData !== 0) {
        const typeFlags = m.u8((pMonData + 0x16) >>> 0)
        if ((typeFlags & 8) !== 0 && (typeFlags & 4) === 0) {
          useCustomCorpseFilter = true
        }
      }
    }

    if (hooks !== undefined && hooks.onScanRadiusUnits !== undefined) {
      hooks.onScanRadiusUnits(
        m,
        pGame,
        pUnit,
        pScanCtx,
        useCustomCorpseFilter ? 1 : 9,
        useCustomCorpseFilter,
      )
    }

    const rallyRoll = (stepSeed64Inline(m, pUnitSeed) >>> 0) % 100
    const bDiff2 = m.u8((pGame + 0x6d) >>> 0)
    const aip1Rally = sx16(m.u16((pMonStatsTxt + 0x56 + bDiff2 * 2) >>> 0))
    if ((rallyRoll | 0) < aip1Rally) {
      m.setU32((pCmdBuf + 0x08) >>> 0, 1)
      AIGENERAL_BroadcastCmdToMinions113c(m, pUnit, pGame, pCmdBuf)
    }

    const pCorpse = m.u32(pScanCtx) >>> 0
    const nCorpses = m.u32((pScanCtx + 0x04) >>> 0) | 0
    if (pCorpse !== 0 && nCorpses !== 0) {
      const raiseRoll = (stepSeed64Inline(m, pUnitSeed) >>> 0) % 100
      const bDiff3 = m.u8((pGame + 0x6d) >>> 0)
      const aip1Raise = sx16(m.u16((pMonStatsTxt + 0x56 + bDiff3 * 2) >>> 0))
      if ((raiseRoll | 0) < aip1Raise) {
        const wSkill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
        if (SKILLS_CanMonsterCastAtTarget113c(m, 0, pCorpse, pUnit, wSkill1, 0, hooks) !== 0) {
          const wSkill1Reload = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
          AI_CastSkillMode14_113c(m, pUnit, wSkill1Reload, pGame, pCorpse, 0, 0, world, hooks)
          return
        }
      }
    }

    let castTarget = 0
    if (pTarget !== 0) {
      const bDiff4 = m.u8((pGame + 0x6d) >>> 0)
      const aip5 = sx16(m.u16((pMonStatsTxt + 0x6e + bDiff4 * 2) >>> 0))
      if (curDist < aip5) {
        const boltRoll = (stepSeed64Inline(m, pUnitSeed) >>> 0) % 100
        const bDiff5 = m.u8((pGame + 0x6d) >>> 0)
        const aip2 = sx16(m.u16((pMonStatsTxt + 0x5c + bDiff5 * 2) >>> 0))
        if ((boltRoll | 0) < aip2) {
          castTarget = pTarget
        }
      }
    }

    if (castTarget === 0) {
      m.setU32(pNearDist, curDist >>> 0)
      const pAltTarget =
        hooks !== undefined && hooks.onFindNearestPlayer !== undefined
          ? hooks.onFindNearestPlayer(m, pGame, pUnit, pNearDist) >>> 0
          : 0
      curDist = m.u32(pNearDist) | 0
      if (pAltTarget !== 0) {
        const bDiff6 = m.u8((pGame + 0x6d) >>> 0)
        const aip5Alt = sx16(m.u16((pMonStatsTxt + 0x6e + bDiff6 * 2) >>> 0))
        if (curDist < aip5Alt) {
          const altRoll = (stepSeed64Inline(m, pUnitSeed) >>> 0) % 100
          const bDiff7 = m.u8((pGame + 0x6d) >>> 0)
          const aip2Alt = sx16(m.u16((pMonStatsTxt + 0x5c + bDiff7 * 2) >>> 0))
          if ((altRoll | 0) < aip2Alt) {
            castTarget = pAltTarget
          }
        }
      }
    }

    if (castTarget !== 0) {
      const wSkill2 = sx16(m.u16((pMonStatsTxt + 0x172) >>> 0))
      const bSkillMode2 = m.u8((pMonStatsTxt + 0x181) >>> 0)
      AI_CastSkillWithMode113c(
        m,
        bSkillMode2,
        pUnit,
        pGame,
        wSkill2,
        castTarget,
        0,
        0,
        world,
        hooks,
      )
      return
    }

    const moveRoll = (stepSeed64Inline(m, pUnitSeed) >>> 0) % 100
    const bDiff8 = m.u8((pGame + 0x6d) >>> 0)
    const aip3Move = sx16(m.u16((pMonStatsTxt + 0x62 + bDiff8 * 2) >>> 0))
    if ((moveRoll | 0) < aip3Move) {
      const sideByte = stepSeed64Inline(m, pUnitSeed) & 0xff
      let pathType = sideByte >= 0x80 ? 6 : 5
      if (pathType === 1) pathType = 7
      const pMonData =
        pUnit !== 0 && (m.u32(pUnit) | 0) === 1 ? m.u32((pUnit + 0x14) >>> 0) : 0
      const pAiParam = pMonData !== 0 ? m.u32((pMonData + 0x2c) >>> 0) : 0
      if (pathType !== 0) {
        m.setU32((pAiParam + 0x18) >>> 0, pathType >>> 0)
      }
      m.setU8((pAiParam + 0x20) >>> 0, 3)
      if (world !== undefined) {
        AI_ApproachTarget113c(world, pUnit, pTarget, 2, 0, 0, 1, 0)
      }
      return
    }

    if (world !== undefined) {
      AI_Stall113c(world, pUnit, 10)
    }
  } finally {
    aiFallenStackPtr = sp
  }
}

/**
 * Checks whether a boss/taunting monster within `20` subtiles of a player target has not yet played
 * its one-time taunt sound (`pAiControl->wFlags & 0x10`), firing `SUNIT_SetUnitEventSound(pUnit, 0x10, 0)`
 * and stalling `20` frames via `AI_Stall`.
 *
 * @va D2Game:0x6FCBCA60 (151B)
 */
export function AI_CheckApproachTauntSound113c(
  m: Memory113c,
  pUnit: number,
  pAiArgs: number,
  pGame: number,
  world?: FallenSliceWorld113c,
): number {
  let isBossOrFlag6 = false
  if (pUnit !== 0 && (m.u32(pUnit) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0)
    if (pMonData !== 0 && (m.u8((pMonData + 0x16) >>> 0) & 8) !== 0) {
      isBossOrFlag6 = true
    }
  }
  if (!isBossOrFlag6) {
    if (MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, pUnit) !== 0) {
      isBossOrFlag6 = true
    }
  }

  let isSpecial250 = false
  if (pUnit !== 0) {
    const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
    const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
    if (nClassId >= 0 && nClassId < (m.u32((pTables + 0xa80) >>> 0) | 0) && nClassId === 0xfa) {
      isSpecial250 = true
    }
  }
  if (!isSpecial250 && !isBossOrFlag6) return 0

  if ((m.u32((pAiArgs + 0x14) >>> 0) >>> 0) >= 20) return 0
  const pTarget = m.u32((pAiArgs + 0x08) >>> 0)
  if (pTarget === 0) return 0
  if ((m.u32(pTarget) | 0) !== 0) return 0

  const pAiControl = m.u32(pAiArgs)
  if ((m.u8((pAiControl + 0x08) >>> 0) & 0x10) !== 0) return 0

  SUNIT_SetUnitEventSound113c(m, pUnit, 0x10, 0)
  const pAiControlAfter = m.u32(pAiArgs)
  m.setU8((pAiControlAfter + 0x08) >>> 0, (m.u8((pAiControlAfter + 0x08) >>> 0) | 0x10) & 0xff)
  void pGame
  if (world !== undefined) {
    AI_Stall113c(world, pUnit, 20)
  }
  return 1
}

/**
 * Evaluates Teleportation (`pAiControl->wFlags & 0x20`) escape/heal for boss monsters (`skill 0xB8` = `184`).
 *
 * @va D2Game:0x6FCBCDE0 (507B)
 */
export function AI_TryMonsterTeleportEscape113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  pAiArgs: number,
  world?: FallenSliceWorld113c,
  hooks?: AiFallenHooks113c,
): number {
  if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0) return 0
  const pAiControl = m.u32(pAiArgs)
  if ((m.u8((pAiControl + 0x08) >>> 0) & 0x20) === 0) return 0

  const roll1 = (stepSeed64Inline(m, (pUnit + 0x20) >>> 0) >>> 0) % 100
  if ((roll1 | 0) >= 40) return 0

  let baseId = MONSTER_GetBaseIdFromUnit113c(m, pUnit)
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (baseId < 0 || baseId >= (m.u32((pTables + 0xa80) >>> 0) | 0)) {
    baseId = -1
  }

  let isRanged = MONSTATS_CheckFlagBit113c(m, m.u32((pUnit + 0x04) >>> 0) | 0, 1)
  if (baseId === 0x0a || baseId === 0x159 || baseId === 0x22d) {
    isRanged = 1
  }

  const lifePct = STATLIST_GetUnitLifePercent113c(m, pUnit) | 0
  if (lifePct >= 30) {
    if (isRanged !== 0) return 0
    if ((m.u32((pAiArgs + 0x14) >>> 0) >>> 0) >= 10) return 0
  }

  if (SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, 100) >= 15) return 0

  const pRoom = UNITS_GetRoom113c(m, pUnit)
  const ux = UNIT_GetPosX113c(m, pUnit)
  const uy = UNIT_GetPosY113c(m, pUnit)
  const pCoordNode = DUNGEON_GetRoomCoordListFromSubtile113c(m, pRoom, ux, uy)

  const sp = aiFallenStackPtr
  aiFallenStackPtr = (sp + 16) >>> 0
  let dstX = 0
  let dstY = 0
  try {
    if (
      REGPOP_FindPackSpawnCoords113c(
        m,
        pRoom,
        pGame,
        pCoordNode,
        baseId,
        sp,
        (sp + 4) >>> 0,
        0,
        hooks,
      ) === 0
    ) {
      return 0
    }
    dstX = m.u32(sp) | 0
    dstY = m.u32((sp + 4) >>> 0) | 0
  } finally {
    aiFallenStackPtr = sp
  }

  const pDstRoom = ROOM_FindRoomContainingSubtile113c(m, pRoom, dstX, dstY)
  if (pDstRoom === 0) return 0
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pDstRoom) !== 0) return 0

  if (lifePct < 30) {
    if (SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, 100) < 25) {
      if (STATES_CheckState113c(m, pUnit, 0x34) === 0) {
        let heal = (STATLIST_GetUnitStat113c(m, pUnit, 12, 0) << 8) | 0
        const curHp = STATLIST_GetUnitStat113c(m, pUnit, 6, 0) | 0
        const maxHp = STATLIST_GetMaxLifeFromUnit113c(m, pUnit) | 0
        if (((heal + curHp) | 0) > maxHp) {
          heal = (maxHp - curHp) | 0
        }
        STATLIST_AddUnitStatMemPort113c(m, pUnit, 6, heal, 0)
      }
    }
  }

  AI_CastSkillWithMode113c(m, 4, pUnit, pGame, 0xb8, 0, dstX, dstY, world, hooks)
  return 1
}

/**
 * Resolves the `16`-byte AI dispatch table row pointer (`0x6FD2E668 + idx * 16` for special AI,
 * or `0x6FD2E788 + wAi * 16` for standard `MonStatsTxt.wAi`).
 *
 * @va D2Game:0x6FCBD0F0 (110B)
 */
export function AI_LookupDispatchTableRow113c(
  m: Memory113c,
  pUnit: number,
  nSpecialAiIdx: number,
): number {
  let pMonStatsTxt = 0
  if (pUnit !== 0 && (m.u32(pUnit) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0)
    if (pMonData !== 0) {
      pMonStatsTxt = m.u32(pMonData)
    }
  }

  const specIdx = nSpecialAiIdx | 0
  if (specIdx !== 0) {
    let useSpecial = true
    if (specIdx === 10 || specIdx === 11 || specIdx === 12) {
      const nClassId = pUnit !== 0 ? m.u32((pUnit + 0x04) >>> 0) | 0 : -1
      if (SKILLS_CanMonsterReviveInMode2_113c(m, nClassId) === 0) {
        useSpecial = false
      }
    }
    if (useSpecial) {
      return (D2GAME_SPECIAL_AI_TABLE_VA_113C + (specIdx << 4)) >>> 0
    }
  }

  const wAi = sx16(m.u16((pMonStatsTxt + 0x1e) >>> 0))
  if (wAi < 0 || wAi >= 0x94) {
    return D2GAME_MONSTER_AI_TABLE_VA_113C
  }
  return (D2GAME_MONSTER_AI_TABLE_VA_113C + (wAi << 4)) >>> 0
}

/**
 * Computes size-adjusted octile subtile distance between `pUnit1` and `pUnit2`:
 * `dx = max(0, |x1 - x2| - sizeX(pUnit1))`, `dy = max(0, |y1 - y2| - sizeX(pUnit1))`, `(2 * max + min) / 2`.
 *
 * @va D2Game:0x6FCD0A20 (242B)
 */
export function AI_CalcApproxUnitDistSubtiles113c(
  m: Memory113c,
  pUnit1: number,
  pUnit2: number,
): number {
  let dx = (UNIT_GetPosX113c(m, pUnit1) - UNIT_GetPosX113c(m, pUnit2)) | 0
  let dy = (UNIT_GetPosY113c(m, pUnit1) - UNIT_GetPosY113c(m, pUnit2)) | 0
  if (dx < 0) dx = (-dx) | 0
  if (dy < 0) dy = (-dy) | 0
  const size1 = UNITS_GetUnitSizeX113c(m, pUnit1) | 0
  dx = (dx - size1) | 0
  dy = (dy - size1) | 0
  if (dx < 0) dx = 0
  if (dy < 0) dy = 0
  const sum = dx > dy ? (dy + (dx << 1)) | 0 : (dx + (dy << 1)) | 0
  return Math.trunc(sum / 2) | 0
}

/**
 * Returns `1` if `pUnit->pMonsterData->dwInteractType` (`+0x54`) is `3` or `19` (`0x13`), else `0`.
 *
 * @va D2Game:0x6FCD0BE0 (40B)
 */
export function MONSTER_HasAlwaysChaseFlag113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  if ((m.u32(pUnit) | 0) !== 1) return 0
  const pMonData = m.u32((pUnit + 0x14) >>> 0)
  if (pMonData === 0) return 0
  const flag54 = m.u32((pMonData + 0x54) >>> 0) | 0
  return flag54 === 3 || flag54 === 0x13 ? 1 : 0
}

/**
 * Unlinks all `D2CombatStrc` records from `pUnit->pCombat` (`+0xAC`, `pNext` at `+0x84`)
 * where `dwAttackerType (+0x04) == pUnit->dwUnitType` and `dwAttackerId (+0x08) == pUnit->dwUnitId (+0x0C)`.
 *
 * @va D2Game:0x6FCFA750 (94B)
 */
export function SUNITDMG_FreeAttackerCombatList113c(
  m: Memory113c,
  pUnit: number,
  _pGame: number,
): void {
  let pCur = m.u32((pUnit + 0xac) >>> 0)
  if (pCur === 0) return
  const selfType = m.u32(pUnit) | 0
  const selfGuid = m.u32((pUnit + 0x0c) >>> 0) >>> 0
  let pPrev = 0

  while (pCur !== 0) {
    const pNext = m.u32((pCur + 0x84) >>> 0)
    if (
      (m.u32((pCur + 0x04) >>> 0) | 0) === selfType &&
      (m.u32((pCur + 0x08) >>> 0) >>> 0) === selfGuid
    ) {
      if (pPrev === 0) {
        m.setU32((pUnit + 0xac) >>> 0, pNext)
      } else {
        m.setU32((pPrev + 0x84) >>> 0, pNext)
      }
    } else {
      pPrev = pCur
    }
    pCur = pNext
  }
}

/**
 * Records a unit sound event (`+0x6E = wSoundId`, `+0x70 = pSourceUnit`), refreshes unit room state,
 * and sets `UNITFLAG_SOUND` (`+0xC4 |= 0x400`) — used on Fallen morale flee (`F802`) and boss taunt.
 *
 * @va D2Game:0x6FCFFFD0 (70B)
 */
export function SUNIT_SetUnitEventSound113c(
  m: Memory113c,
  pUnit: number,
  wSoundId: number,
  pSourceUnit: number,
): void {
  if (pUnit === 0) {
    throw new Error('SUNIT_SetUnitEventSound113c: pUnit == NULL (line 1368)')
  }
  m.setU16((pUnit + 0x6e) >>> 0, wSoundId & 0xffff)
  m.setU32((pUnit + 0x70) >>> 0, pSourceUnit >>> 0)
  UNITROOM_RefreshUnit113c(m, pUnit)
  m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x400) >>> 0)
}

/**
 * Writes per-move AI path overrides into `pUnit->pMonsterData->pAiParam` (`+0x2C`):
 * `+0x18 = nPathType` (remapping `1 -> 7`), `+0x1C = nVelPct` (`[-126..126]`), `+0x20 = min(nDist, 77)`.
 *
 * @va D2Game:0x6FD11A20 (104B)
 */
export function AI_SetAiControlOverrides113c(
  m: Memory113c,
  pUnit: number,
  nPathType: number,
  nVelPct: number,
  nDist: number,
): void {
  const vel = nVelPct | 0
  if (vel < -0x7e || vel > 0x7e) {
    throw new Error('AI_SetAiControlOverrides113c: nVelPct out of [-126..126] (line 272)')
  }
  let pType = nPathType | 0
  if (pType === 1) pType = 7

  let pAiParam = 0
  if (pUnit !== 0 && (m.u32(pUnit) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0)
    if (pMonData !== 0) {
      pAiParam = m.u32((pMonData + 0x2c) >>> 0)
    }
  }
  if (pType !== 0) {
    m.setU32((pAiParam + 0x18) >>> 0, pType >>> 0)
  }
  if (vel !== 0) {
    m.setU32((pAiParam + 0x1c) >>> 0, vel >>> 0)
  }
  let distByte = nDist & 0xff
  if (distByte !== 0) {
    if (distByte >= 0x4e) distByte = 0x4d
    m.setU8((pAiParam + 0x20) >>> 0, distByte)
  }
}

/**
 * Starts sequence-cast mode `14` (`MONMODE_SEQ`) with `nSkillId` on `pUnit` (used by `AI_FallenShaman` `Raise`).
 *
 * @va D2Game:0x6FD12120 (184B)
 */
export function AI_CastSkillMode14_113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
  pGame: number,
  pTarget: number,
  x: number,
  y: number,
  world?: FallenSliceWorld113c,
  hooks?: AiFallenHooks113c,
): number {
  const id = nSkillId | 0
  if (id < 0) return 0
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (id >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 0

  SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
  const sp = aiFallenStackPtr
  aiFallenStackPtr = (sp + 0x20) >>> 0
  try {
    m.fill(sp, 0x20, 0)
    m.setU32(sp, 0x0e)
    m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
    m.setU8((sp + 0x15) >>> 0, pUnit !== 0 ? 0x65 : 0x64)

    const pSkill = SKILLS_GetSkillById113c(m, pUnit, id, -1)
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, pSkill)
    PATH_SetStepNum113c(m, m.u32((pUnit + 0x2c) >>> 0), 1)

    m.setU32((sp + 0x08) >>> 0, pTarget >>> 0)
    m.setU32((sp + 0x0c) >>> 0, x >>> 0)
    m.setU32((sp + 0x10) >>> 0, y >>> 0)
    return dispatchMonsterStartMode(m, pGame, sp, 0, world, hooks)
  } finally {
    aiFallenStackPtr = sp
  }
}

/**
 * Initiates monster melee attack mode `nMode` (`4` = `A1`, `5` = `A2`) against `pTarget`
 * via `MONSTER_InitModeChangeStrc113c` + `MONSTER_StartMode`.
 *
 * @va D2Game:0x6FD12220 (44B)
 */
export function AI_StartAttackMode113c(
  m: Memory113c,
  nMode: number,
  pUnit: number,
  pGame: number,
  pTarget: number,
  world?: FallenSliceWorld113c,
  hooks?: AiFallenHooks113c,
): number {
  const sp = aiFallenStackPtr
  aiFallenStackPtr = (sp + 0x20) >>> 0
  try {
    MONSTER_InitModeChangeStrc113c(m, pUnit, sp, nMode)
    m.setU32((sp + 0x08) >>> 0, pTarget >>> 0)
    return dispatchMonsterStartMode(m, pGame, sp, 1, world, hooks)
  } finally {
    aiFallenStackPtr = sp
  }
}

/**
 * Casts `nSkillId` using explicit animation mode `nMode` (`< 16`), setting `UNITFLAG_SKILLMODE` (`+0xC4 |= 0x40`)
 * and stalling `10` frames if `MONSTER_StartMode` rejects the transition.
 *
 * @va D2Game:0x6FD12380 (150B)
 */
export function AI_CastSkillWithMode113c(
  m: Memory113c,
  nMode: number,
  pUnit: number,
  pGame: number,
  nSkillId: number,
  pTarget: number,
  x: number,
  y: number,
  world?: FallenSliceWorld113c,
  hooks?: AiFallenHooks113c,
): number {
  const modeByte = nMode & 0xff
  if (modeByte >= 0x10) return 0

  const sp = aiFallenStackPtr
  aiFallenStackPtr = (sp + 0x20) >>> 0
  try {
    MONSTER_InitModeChangeStrc113c(m, pUnit, sp, modeByte)
    const pSkill = SKILLS_GetSkillById113c(m, pUnit, nSkillId | 0, -1)
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, pSkill)
    if (pUnit !== 0) {
      m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
    }
    PATH_SetStepNum113c(m, m.u32((pUnit + 0x2c) >>> 0), 1)
    m.setU32((sp + 0x08) >>> 0, pTarget >>> 0)
    m.setU32((sp + 0x0c) >>> 0, x >>> 0)
    m.setU32((sp + 0x10) >>> 0, y >>> 0)

    if (dispatchMonsterStartMode(m, pGame, sp, 0, world, hooks) !== 0) {
      return 1
    }
    if (world !== undefined) {
      AI_Stall113c(world, pUnit, 10)
    }
    return 0
  } finally {
    aiFallenStackPtr = sp
  }
}

/**
 * Checks whether monster `pCaster` can cast `nSkillId` at `pTarget` / `(x, y)`
 * (handling corpse-revive target collision clearance for `Raise`, town checks, Teleport `0xB8`,
 * Leap/Charge `0x4D`/`0x4E`, Bone Prison `0xC7`, Telekinesis `0x43`, and `0xCB` LOS).
 *
 * @va D2Game:0x6FD13E30 (801B)
 */
export function SKILLS_CanMonsterCastAtTarget113c(
  m: Memory113c,
  y: number,
  pTarget: number,
  pCaster: number,
  nSkillId: number,
  x: number,
  hooks?: AiFallenHooks113c,
): number {
  const id = nSkillId | 0
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, id)
  if (pSkillsTxt === 0) return 0
  if (id === 0xa7) return 0

  const bSkillFlags0 = m.u8((pSkillsTxt + 0x08) >>> 0)
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
  if ((bSkillFlags0 & m.u8(pMasks)) !== 0) {
    if (pTarget === 0) return 0
    if (((m.u32((pTarget + 0xc4) >>> 0) >>> 1) & 1) === 0) return 0
    const pat = PATH_GetUnitCollisionPattern113c(m, pTarget)
    const ty = UNIT_GetPosY113c(m, pTarget)
    const tx = UNIT_GetPosX113c(m, pTarget)
    const pRoom = UNITS_GetRoom113c(m, pTarget)
    const blocked = COLLISION_CheckMaskWithPattern2_113c(m, pRoom, tx, ty, pat, 0x3c01)
    return blocked === 0 ? 1 : 0
  }

  if (id === 0xa4) {
    return pTarget !== 0 ? 1 : 0
  }

  const wSrvDoFunc = sx16(m.u16((pSkillsTxt + 0x2e) >>> 0))
  if (wSrvDoFunc === 0x4d || wSrvDoFunc === 0x4e) {
    if (pTarget === 0) return 0
    if (MONSTERS_IsDead113c(m, pCaster) !== 0) return 0
    const cx = UNIT_GetPosX113c(m, pCaster)
    const cy = UNIT_GetPosY113c(m, pCaster)
    const tx = UNIT_GetPosX113c(m, pTarget)
    const ty = UNIT_GetPosY113c(m, pTarget)
    const jumpX = ((tx << 1) - cx) | 0
    const jumpY = ((ty << 1) - cy) | 0

    const sp = aiFallenStackPtr
    aiFallenStackPtr = (sp + 16) >>> 0
    let pJumpRoom = 0
    try {
      m.setU32(sp, jumpX >>> 0)
      m.setU32((sp + 4) >>> 0, jumpY >>> 0)
      const cRoom = UNITS_GetRoom113c(m, pCaster)
      const cSize = UNITS_GetUnitSizeX113c(m, pCaster)
      pJumpRoom = COLLISION_FindFreePositionSimple113c(m, cRoom, sp, cSize, 0x3c01, 0)
    } finally {
      aiFallenStackPtr = sp
    }
    if (pJumpRoom === 0) return 0
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pJumpRoom) !== 0) return 0
    const pat = PATH_GetUnitCollisionPattern113c(m, pCaster)
    if (COLLISION_CheckMaskWithPattern2_113c(m, pJumpRoom, jumpX, jumpY, pat, 0x3c01) !== 0) {
      return 0
    }
    return SKILLS_CheckLineOfSight113c(m, cx, cy, jumpX, jumpY, pJumpRoom, 0x0c01) !== 0 ? 1 : 0
  }

  if (id === 0xc7) {
    const tRoom = UNITS_GetRoom113c(m, pTarget)
    if (hooks !== undefined && hooks.onSpawnBonePrison !== undefined) {
      return hooks.onSpawnBonePrison(m, pTarget, 0x154, pCaster, tRoom, 1) | 0
    }
    return 0
  }

  if (id === 0xb8) {
    if (pCaster === 0) return 0
    const cRoom = UNITS_GetRoom113c(m, pCaster)
    const dstRoom = ROOM_FindRoomContainingSubtile113c(m, cRoom, x, y)
    if (dstRoom === 0) return 0
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, dstRoom) !== 0) return 0
    const pat = PATH_GetUnitCollisionPattern113c(m, pCaster)
    if (COLLISION_CheckMaskWithPattern2_113c(m, dstRoom, x, y, pat, 0x3c01) !== 0) return 0
    const cx = UNIT_GetPosX113c(m, pCaster)
    const cy = UNIT_GetPosY113c(m, pCaster)
    return SKILLS_CheckLineOfSight113c(m, cx, cy, x, y, dstRoom, 0x0c01) !== 0 ? 1 : 0
  }

  if (wSrvDoFunc === 0x43) {
    if (pCaster === 0) return 0
    const cRoom = UNITS_GetRoom113c(m, pCaster)
    const dstRoom = ROOM_FindRoomContainingSubtile113c(m, cRoom, x, y)
    if (dstRoom === 0) return 0
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, dstRoom) !== 0) return 0
    const cx = UNIT_GetPosX113c(m, pCaster)
    const cy = UNIT_GetPosY113c(m, pCaster)
    return SKILLS_CheckLineOfSight113c(m, cx, cy, x, y, dstRoom, 0x0c01) !== 0 ? 1 : 0
  }

  if (id === 0xcb) {
    if (pCaster === 0) return 0
    const cRoom = UNITS_GetRoom113c(m, pCaster)
    const dstRoom = ROOM_FindRoomContainingSubtile113c(m, cRoom, x, y)
    if (dstRoom === 0) return 0
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, dstRoom) !== 0) return 0
    const cx = UNIT_GetPosX113c(m, pCaster)
    const cy = UNIT_GetPosY113c(m, pCaster)
    return SKILLS_CheckLineOfSight113c(m, cx, cy, x, y, dstRoom, 0x0805) !== 0 ? 1 : 0
  }

  return 1
}

export { PATH_GetPosX113c as aiFallenPathPosX_113c, PATH_GetPosY113c as aiFallenPathPosY_113c }
