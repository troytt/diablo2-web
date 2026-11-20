/**
 * Milestone 33 [K2] Wave 2 Batch 3 (`w2b3`): 45 strictly ready `D2Game.dll` v1.13c functions
 * in the VA range `0x6FC89AD0..0x6FCABF50` (2,620B total).
 *
 * Clean-room 1:1 binary-accurate translations from `D2Game.dll` v1.13c.
 */

import {
  ANIMSEQ_GetEventAtFrame113c,
  UNITS_GetObjectPortalFlags113c,
  UNITS_GetPlayerData113c,
  UNITS_HasObjectSubClassBit0113c,
} from '../common/composit.js'
import { MONSTER_IsSarcophagusBaseAndZeroArg113c } from '../common/drlg/drlg-ver.js'
import { D2CommonAssertError } from '../common/inline-helpers.js'
import {
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
} from '../common/k0-d2common-memports.js'
import { PATH_Step113c } from '../common/path.js'
import { QUESTRECORD_CopyRecordToBuffer113c } from '../common/quest-record.js'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetUnitStat113c,
} from '../common/statlist.js'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNIT_GetAlignment113c,
  UNITROOM_RefreshUnit113c,
  UNITS_AdvanceAnimFrame113c,
  UNITS_GetAnimStartFrame113c,
  UNITS_GetPathRoomRefreshFlag113c,
  UNITS_HasAnimFinished113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
} from '../common/unit.js'
import type { Memory113c } from '../mem/sparse-memory.js'
import { MONSTERS_IsDead113c } from '../tables/datatbls-113c.js'
import { SKILLS_StartUsedSkill113c } from './a1c-post150-f786-f1040-113c.js'
import { SUNITDMG_FreeAttackerCombatList113c } from './ai-fallen-113c.js'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c.js'
import { AI_Stall113c, MONSTER_DropTreasureOnDeath113c } from './combat-a1c-113c.js'
import {
  isSgptDataTablesLoaded113c,
  MONSTER_DropTreasureOnDeath_6FC95680_113c,
} from './k2-real-itemdrop-113c.js'
import { MONSTER_ClearModeEvents113c, UNITS_ChangeAnimMode113c } from './monster-events.js'
import {
  AI_InitMonsterAiThinkFn113c,
  SUNIT_InitUnitAnimData113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_CalcSqDistSubtiles113c,
} from './regpop-spawn-113c.js'
import { EVENT_SetEventFull113c } from './timer-wheel.js'
import { SUNIT_UpdateUnitPositionAndRoom113c } from './town-runtime-gap-113c.js'
import { hitD2GameVa113c } from '../va-trace-113c.js'

/**
 * Pure-memory helper for `D2Game:0x6FD01930` (`MONSTER_StepPath`):
 * steps path for `pUnit` (`eax = pUnit`, `edi = pGame`) via `0x6FD007A0`,
 * `D2Common.#10220` (`PATH_Step113c(m, pUnit, 0x400)`), `D2Common.#10397`
 * (`UNITS_GetPathRoomRefreshFlag113c`), and `0x6FD01610` (`SUNIT_UpdateUnitPositionAndRoom113c`).
 */
function stepMonsterPathMem113c(m: Memory113c, pGame: number, pUnit: number): number {
  if (pGame === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x72f)
  }
  if (pUnit !== 0 && m.u32((pUnit + 0x2c) >>> 0) !== 0) {
    SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  }
  const nStepped = PATH_Step113c(m, pUnit >>> 0, 0x400) | 0
  const nResult = nStepped !== 0 ? 1 : 2
  if ((UNITS_GetPathRoomRefreshFlag113c(m, pUnit >>> 0) | 0) !== 0) {
    SUNIT_UpdateUnitPositionAndRoom113c(m, 0, pUnit >>> 0, pGame >>> 0)
  }
  return nResult
}

/**
 * Pure-memory helper for `D2Game:0x6FCFF7B0` (`SUNIT_ScheduleModeAnimEvents`):
 * scans animation sequence frames from `UNITS_GetAnimStartFrame113c(m, pUnit)` using
 * `ANIMSEQ_GetEventAtFrame113c` and schedules mode events (`0` or `1`) via `EVENT_SetEventFull113c`.
 */
function scheduleUnitModeAnimEventsMem113c(m: Memory113c, pGame: number, pUnit: number): void {
  if (pUnit === 0 || pGame === 0) return
  let ebx = m.u32((pGame + 0xa8) >>> 0) | 0
  const nStartFrameFp8 = (UNITS_GetAnimStartFrame113c(m, pUnit >>> 0) << 8) | 0
  const pSeqRecord = m.u32((pUnit + 0x30) >>> 0) >>> 0
  let nSpeed: number
  let nFrameCountFp8: number
  if (pSeqRecord !== 0) {
    nSpeed = m.u32((pUnit + 0x3c) >>> 0) | 0
    nFrameCountFp8 = m.u32((pUnit + 0x34) >>> 0) | 0
  } else {
    nSpeed = (m.u16((pUnit + 0x4c) >>> 0) << 16) >> 16
    nFrameCountFp8 = m.u32((pUnit + 0x48) >>> 0) | 0
  }
  if (nSpeed === 0) {
    EVENT_SetEventFull113c(
      m,
      pGame >>> 0,
      pUnit >>> 0,
      1,
      ((m.u32((pGame + 0xa8) >>> 0) | 0) + 1) >>> 0,
      0,
      0,
      0,
    )
    return
  }

  const pAnimData = m.u32((pUnit + 0x50) >>> 0) >>> 0
  let edi = nStartFrameFp8 >> 8
  let nCurFp8 = (nStartFrameFp8 + nSpeed) | 0
  let nHitCounter = 0
  const pEventOut = pSeqRecord !== 0 ? m.alloc(4) >>> 0 : 0

  while (nCurFp8 < nFrameCountFp8) {
    const nTargetFrame = nCurFp8 >> 8
    ebx = (ebx + 1) | 0
    while (edi <= nTargetFrame && edi < 0x90) {
      let nEvent = 0
      if (pSeqRecord !== 0) {
        ANIMSEQ_GetEventAtFrame113c(m, pSeqRecord, (edi << 8) | 0, pEventOut)
        nEvent = m.u32(pEventOut) | 0
      } else if (pAnimData !== 0) {
        nEvent = m.u8((pAnimData + 0x10 + edi) >>> 0)
      }
      if (nEvent === 1 || nEvent === 2) {
        EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 0, ebx >>> 0, 0, nEvent, nHitCounter)
        nHitCounter = (nHitCounter + 1) | 0
      } else if (nEvent === 3 || nEvent === 4) {
        EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 0, ebx >>> 0, 0, nEvent, 0)
      }
      edi = (edi + 1) | 0
    }
    nCurFp8 = (nCurFp8 + nSpeed) | 0
  }

  if (ebx === (m.u32((pGame + 0xa8) >>> 0) | 0)) {
    ebx = (ebx + 1) | 0
  }
  ebx = (ebx + 1) | 0
  EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 1, ebx >>> 0, 0, 0, 0)
  m.setU32((pUnit + 0x44) >>> 0, (m.u32((pGame + 0xa8) >>> 0) << 8) >>> 0)
}

/**
 * [1/45] Toggles an object unit's animation mode between `0` (`OBJMODE_NEUTRAL`)
 * and `1` (`OBJMODE_OPERATING`) via `D2Common.#11090` (`UNITS_ChangeAnimMode113c`).
 *
 * Binary convention: `__fastcall(ecx = pOperateArgs)` (`ret`).
 *
 * @va D2Game.dll@0x6fc89ad0
 * @va D2Game:0x6FC89AD0 (44B)
 */
export function OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c(
  m: Memory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC89AD0)
  const pObject = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  const nMode = pObject === 0 ? 0 : m.u32((pObject + 0x10) >>> 0) | 0
  if (nMode === 0) {
    UNITS_ChangeAnimMode113c(m, pObject, 1)
    return 0
  }
  if (((nMode - 1) | 0) === 0) {
    UNITS_ChangeAnimMode113c(m, pObject, 0)
  }
  return 0
}

/**
 * [2/45] Restores the operating unit's life (`STAT_HITPOINTS = 6`) and mana (`STAT_MANA = 8`)
 * to their respective maximums (`D2Common.#10913` / `D2Common.#10186`) by adding the delta
 * via `D2Common.#10551` (`STATLIST_AddUnitStatMemPort113c`).
 *
 * Binary convention: `__fastcall(ecx = pOperateArgs)` (`ret`).
 *
 * @va D2Game.dll@0x6fc89c00
 * @va D2Game:0x6FC89C00 (91B)
 */
export function OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c(
  m: Memory113c,
  pOperateArgs: number,
): void {
  hitD2GameVa113c(0x6FC89C00)
  const pUnit1 = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
  const nCurLife = STATLIST_GetUnitStat113c(m, pUnit1, 6, 0) | 0
  const pUnit2 = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
  const nMaxLife = STATLIST_GetMaxLifeFromUnit113c(m, pUnit2) | 0
  const nLifeDiff = (nMaxLife - nCurLife) | 0
  if (nLifeDiff !== 0) {
    const pUnit3 = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
    STATLIST_AddUnitStatMemPort113c(m, pUnit3, 6, nLifeDiff, 0)
  }

  const pUnit4 = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
  const nCurMana = STATLIST_GetUnitStat113c(m, pUnit4, 8, 0) | 0
  const pUnit5 = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
  const nMaxMana = STATLIST_GetMaxManaFromUnit113c(m, pUnit5) | 0
  const nManaDiff = (nMaxMana - nCurMana) | 0
  if (nManaDiff !== 0) {
    const pUnit6 = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
    STATLIST_AddUnitStatMemPort113c(m, pUnit6, 8, nManaDiff, 0)
  }
}

/**
 * [3/45] Checks if a unit (`pUnit`) is an alive monster (`dwUnitType == 1` and `!MONSTERS_IsDead113c`)
 * or an alive player (`dwUnitType == 0` with `dwAnimMode != 0` and `dwAnimMode != 17`).
 *
 * Binary convention: `__fastcall(ecx = pUnit)` (`ret`).
 *
 * @va D2Game.dll@0x6fc89c60
 * @va D2Game:0x6FC89C60 (50B)
 */
export function OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c(
  m: Memory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FC89C60)
  if (pUnit === 0) return 0
  const nUnitType = m.u32(pUnit >>> 0) | 0
  if (nUnitType === 1) {
    return MONSTERS_IsDead113c(m, pUnit >>> 0) === 0 ? 1 : 0
  }
  if (nUnitType !== 0) return 0
  const nAnimMode = m.u32((pUnit + 0x10) >>> 0) | 0
  if (nAnimMode === 0 || nAnimMode === 0x11) return 0
  return 1
}

/**
 * [4/45] Resets a shrine/subclass-bit-0 object (`D2Common.#10934`) back to neutral mode (`0`),
 * refreshes its room (`D2Common.#10158`), sets unit flag bit `0x01` (`+0xC4`), and clears
 * `pObjectData->dwShrineFrame` (`[pObjectData + 0x0C] = 0`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pObject)` (`ret`).
 *
 * @va D2Game.dll@0x6fc89d60
 * @va D2Game:0x6FC89D60 (50B)
 */
export function OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c(
  m: Memory113c,
  _pGame: number,
  pObject: number,
): void {
  hitD2GameVa113c(0x6FC89D60)
  if ((UNITS_HasObjectSubClassBit0113c(m, pObject >>> 0) | 0) !== 0) {
    UNITROOM_RefreshUnit113c(m, pObject >>> 0)
    if (pObject !== 0) {
      m.setU32((pObject + 0xc4) >>> 0, (m.u32((pObject + 0xc4) >>> 0) | 1) >>> 0)
    }
    UNITS_ChangeAnimMode113c(m, pObject >>> 0, 0)
    const pObjectData = m.u32((pObject + 0x14) >>> 0) >>> 0
    m.setU32((pObjectData + 0x0c) >>> 0, 0)
  }
}

/**
 * [5/45] Completes an object's transition from `OBJMODE_OPERATING` (`1`) to `OBJMODE_OPENED` (`2`)
 * when `ObjectsTxt.nSubClass` (`+0x141`) is non-zero, and clears target/collision via
 * `D2Common.#10408` (`UNITS_SetTargetUnitForDynamicUnitEx113c`) if `ObjectsTxt.bBlocksVis` (`+0x122`) is `0`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pObject)` (`ret`).
 *
 * @va D2Game.dll@0x6fc89da0
 * @va D2Game:0x6FC89DA0 (58B)
 */
export function OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c(
  m: Memory113c,
  _pGame: number,
  pObject: number,
): void {
  hitD2GameVa113c(0x6FC89DA0)
  if (pObject === 0) return
  if (m.u16((pObject + 0x10) >>> 0) !== 1) return
  const nClassId = m.u32((pObject + 0x04) >>> 0) | 0
  const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, nClassId) >>> 0
  if (pObjectsTxt === 0) return
  if (m.u8((pObjectsTxt + 0x141) >>> 0) === 0) return
  m.setU32((pObject + 0x10) >>> 0, 2)
  if (m.u8((pObjectsTxt + 0x122) >>> 0) === 0) {
    UNITS_SetTargetUnitForDynamicUnitEx113c(m, pObject >>> 0)
  }
}

/**
 * [6/45] Walks the player's trade item node list (`pPlayerData->pTrade` at `+0x5C`, head at `+0x08`)
 * until reaching the `0` terminator and returns `0`.
 *
 * Binary convention: `eax = pPlayer` (`ret`).
 *
 * @va D2Game.dll@0x6fc8ffa0
 * @va D2Game:0x6FC8FFA0 (32B)
 */
export function PLRTRADE_WalkTradeItemList_6FC8FFA0_113c(
  m: Memory113c,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FC8FFA0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  if (pPlayerData === 0) return 0
  const pTrade = m.u32((pPlayerData + 0x5c) >>> 0) >>> 0
  if (pTrade === 0) return 0
  let pNode = m.u32((pTrade + 0x08) >>> 0) >>> 0
  while (pNode !== 0) {
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
  return 0
}

/**
 * [7/45] Allocates a 12-byte trade item record (`Fog.#10045`) and prepends it to
 * `pPlayerData->pTrade->pItemList` (`[pTrade + 0x08]`).
 *
 * Binary convention: `eax = pPlayer`, `[esp+4] = pGame`, `[esp+8] = dwItemGuid`, `[esp+0xC] = dwField4` (`ret 0xC`).
 *
 * @va D2Game.dll@0x6fc8ffc0
 * @va D2Game:0x6FC8FFC0 (73B)
 */
export function PLRTRADE_PrependTradeItemNode_6FC8FFC0_113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
  dwItemGuid: number,
  dwField4: number,
): number {
  hitD2GameVa113c(0x6FC8FFC0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  if (pPlayerData === 0) return 0
  const pTrade = m.u32((pPlayerData + 0x5c) >>> 0) >>> 0
  if (pTrade === 0) return 0
  // Reads pGame->pMemoryPool (+0x1C) into ecx for Fog.#10045
  if (pGame !== 0) {
    m.u32((pGame + 0x1c) >>> 0)
  }
  const pNode = m.alloc(0x0c) >>> 0
  m.setU32(pNode, dwItemGuid >>> 0)
  m.setU32((pNode + 0x04) >>> 0, dwField4 >>> 0)
  const pPrevHead = m.u32((pTrade + 0x08) >>> 0) >>> 0
  m.setU32((pNode + 0x08) >>> 0, pPrevHead)
  m.setU32((pTrade + 0x08) >>> 0, pNode)
  return pNode
}

/**
 * [8/45] Mode-change handler that frees the unit's attacker combat list (`0x6FCFA750`)
 * and transitions the unit to animation mode `6` (`D2Common.#11090`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pModeChange)` (`ret`).
 *
 * @va D2Game.dll@0x6fc94c10
 * @va D2Game:0x6FC94C10 (25B)
 */
export function MONMODE_EnterAnimMode6_6FC94C10_113c(
  m: Memory113c,
  pGame: number,
  pModeChange: number,
): number {
  hitD2GameVa113c(0x6FC94C10)
  const pUnit = m.u32((pModeChange + 0x04) >>> 0) >>> 0
  SUNITDMG_FreeAttackerCombatList113c(m, pUnit, pGame >>> 0)
  UNITS_ChangeAnimMode113c(m, pUnit, 6)
  return 1
}

/**
 * [9/45] Mode-change handler that frees the unit's attacker combat list (`0x6FCFA750`)
 * and transitions the unit to animation mode `10` (`0x0A`, `D2Common.#11090`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pModeChange)` (`ret`).
 *
 * @va D2Game.dll@0x6fc94c90
 * @va D2Game:0x6FC94C90 (25B)
 */
export function MONMODE_EnterAnimMode10_6FC94C90_113c(
  m: Memory113c,
  pGame: number,
  pModeChange: number,
): number {
  hitD2GameVa113c(0x6FC94C90)
  const pUnit = m.u32((pModeChange + 0x04) >>> 0) >>> 0
  SUNITDMG_FreeAttackerCombatList113c(m, pUnit, pGame >>> 0)
  UNITS_ChangeAnimMode113c(m, pUnit, 0x0a)
  return 1
}

/**
 * [10/45] Mode-change handler that frees the unit's attacker combat list (`0x6FCFA750`),
 * transitions the unit to animation mode `14` (`0x0E`, `MONMODE_SEQUENCE`), clears unit flag
 * bit `0x40` (`[pUnit + 0xC4] &= ~0x40`), and invokes `SKILLS_StartUsedSkill113c` (`0x6FCC0830`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pModeChange)` (`ret`).
 *
 * @va D2Game.dll@0x6fc954e0
 * @va D2Game:0x6FC954E0 (45B)
 */
export function MONMODE_EnterSequenceMode14_6FC954E0_113c(
  m: Memory113c,
  pGame: number,
  pModeChange: number,
): number {
  hitD2GameVa113c(0x6FC954E0)
  const pUnit = m.u32((pModeChange + 0x04) >>> 0) >>> 0
  SUNITDMG_FreeAttackerCombatList113c(m, pUnit, pGame >>> 0)
  UNITS_ChangeAnimMode113c(m, pUnit, 0x0e)
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) & 0xffffffbf) >>> 0)
  }
  return SKILLS_StartUsedSkill113c(m, pUnit, pGame >>> 0) | 0
}

/**
 * [11/45] Wrapper that constructs the 32-byte death context (`[+4] = pGame`, `[+8] = pMonster`)
 * and invokes `MONSTER_DropTreasureOnDeath113c` (`0x6FC95680`) with `bAllowDrop = 1`.
 *
 * Binary convention: `eax = pGame`, `ecx = pMonster`, `[esp+4] = pKiller` (`ret 4`).
 *
 * @va D2Game.dll@0x6fc958d0
 * @va D2Game:0x6FC958D0 (34B)
 */
export function MONMODE_DropTreasureOnDeathWrapper_6FC958D0_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pKiller: number,
  allocateUnitInMem = false,
): number {
  hitD2GameVa113c(0x6FC958D0)
  // 0x6FC958D7: `push 1` passes bNoUpgrade = 1 to MONSTER_DropTreasureOnDeath_6FC95680
  if (isSgptDataTablesLoaded113c(m)) {
    return (
      MONSTER_DropTreasureOnDeath_6FC95680_113c(
        m,
        pGame >>> 0,
        pMonster >>> 0,
        pKiller >>> 0,
        1,
      ) | 0
    )
  }
  return (
    MONSTER_DropTreasureOnDeath113c(
      m,
      pGame >>> 0,
      pMonster >>> 0,
      pKiller >>> 0,
      allocateUnitInMem,
    ) | 0
  )
}

/**
 * [12/45] Advances a monster's path step (`0x6FD01930`) and animation frame (`D2Common.#10853`);
 * if the animation has finished (`D2Common.#10426`), frees the attacker combat list (`0x6FCFA750`)
 * and transitions to mode `11` (`0x0B`). Returns `1`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pUnit)` (`ret`).
 *
 * @va D2Game.dll@0x6fc959b0
 * @va D2Game:0x6FC959B0 (53B)
 */
export function MONMODE_StepPathAndAdvanceToMode11_6FC959B0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FC959B0)
  stepMonsterPathMem113c(m, pGame >>> 0, pUnit >>> 0)
  UNITS_AdvanceAnimFrame113c(m, pUnit >>> 0)
  if ((UNITS_HasAnimFinished113c(m, pUnit >>> 0) | 0) !== 0) {
    SUNITDMG_FreeAttackerCombatList113c(m, pUnit >>> 0, pGame >>> 0)
    UNITS_ChangeAnimMode113c(m, pUnit >>> 0, 0x0b)
  }
  return 1
}

/**
 * [13/45] Checks `D2Common.#10707` (`MONSTER_IsSarcophagusBaseAndZeroArg113c(m, pUnit, 0)`);
 * if non-zero, steps the monster path (`0x6FD01930`) and advances the animation frame (`D2Common.#10853`).
 * When not a sarcophagus or when the animation finishes (`D2Common.#10426`), frees the attacker
 * combat list (`0x6FCFA750`) and transitions to mode `12` (`0x0C`, `MONMODE_DEAD`). Returns `1`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pUnit)` (`ret`).
 *
 * @va D2Game.dll@0x6fc959f0
 * @va D2Game:0x6FC959F0 (65B)
 */
export function MONMODE_StepPathOrFinishToDeadMode12_6FC959F0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FC959F0)
  let bEnterDeadMode = true
  if ((MONSTER_IsSarcophagusBaseAndZeroArg113c(m, pUnit >>> 0, 0) | 0) !== 0) {
    stepMonsterPathMem113c(m, pGame >>> 0, pUnit >>> 0)
    UNITS_AdvanceAnimFrame113c(m, pUnit >>> 0)
    if ((UNITS_HasAnimFinished113c(m, pUnit >>> 0) | 0) === 0) {
      bEnterDeadMode = false
    }
  }
  if (bEnterDeadMode) {
    SUNITDMG_FreeAttackerCombatList113c(m, pUnit >>> 0, pGame >>> 0)
    UNITS_ChangeAnimMode113c(m, pUnit >>> 0, 0x0c)
  }
  return 1
}

/**
 * [14/45] Mode-change handler that frees the unit's attacker combat list (`0x6FCFA750`),
 * changes animation mode to `11` (`0x0B`), and schedules event type `2` (`EVENT_ENDANIM`)
 * at `pGame->dwGameFrame + 15` (`[pGame + 0xA8] + 0x0F`) via `0x6FCAEA80`. Returns `1`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pModeChange)` (`ret`).
 *
 * @va D2Game.dll@0x6fc96700
 * @va D2Game:0x6FC96700 (56B)
 */
export function MONMODE_EnterMode11AndScheduleEndAnim15_6FC96700_113c(
  m: Memory113c,
  pGame: number,
  pModeChange: number,
): number {
  hitD2GameVa113c(0x6FC96700)
  const pUnit = m.u32((pModeChange + 0x04) >>> 0) >>> 0
  SUNITDMG_FreeAttackerCombatList113c(m, pUnit, pGame >>> 0)
  UNITS_ChangeAnimMode113c(m, pUnit, 0x0b)
  const dwTriggerFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + 0x0f) >>> 0
  EVENT_SetEventFull113c(m, pGame >>> 0, pUnit, 2, dwTriggerFrame, 0, 0, 0)
  return 1
}

/**
 * [15/45] Asserts `pUnit != 0` (line `0x46F`), frees the unit's attacker combat list (`0x6FCFA750`),
 * changes animation mode to `nMode` (`D2Common.#11090`), initializes animation data (`0x6FCFFF10`),
 * clears `pUnit->pSkills->pUsedSkill` (`D2Common.#11103`), clears mode events (`0x6FD00750`),
 * and schedules new mode animation events (`0x6FCFF7B0`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pUnit, [esp+4] = nMode, [esp+8] = arg8, [esp+0xC] = argC)` (`ret 0xC`).
 *
 * @va D2Game.dll@0x6fc98150
 * @va D2Game:0x6FC98150 (97B)
 */
export function MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nMode: number,
  _arg8 = 0,
  _argC = 0,
): void {
  hitD2GameVa113c(0x6FC98150)
  if (pUnit === 0) {
    throw new D2CommonAssertError('SUnitMode.cpp', 0x46f)
  }
  SUNITDMG_FreeAttackerCombatList113c(m, pUnit >>> 0, pGame >>> 0)
  UNITS_ChangeAnimMode113c(m, pUnit >>> 0, nMode | 0)
  SUNIT_InitUnitAnimData113c(m, pUnit >>> 0)
  SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
  MONSTER_ClearModeEvents113c(m, pGame >>> 0, pUnit >>> 0)
  scheduleUnitModeAnimEventsMem113c(m, pGame >>> 0, pUnit >>> 0)
}

/**
 * [16/45] Allocates a 12-byte unit message node (`Fog.#10045`), initializes packet header `0xA4`
 * (`[pNode + 4] = 0xA4`, `[pNode + 8] = wMsgId`, `[pNode + 0] = 0`), appends it to `pUnit`'s
 * message queue (`+0xEC` head, `+0xF0` tail), and refreshes the unit's room (`D2Common.#10158`).
 *
 * Binary convention: `esi = pUnit`, `[esp+4] = wMsgId` (`ret 4`).
 *
 * @va D2Game.dll@0x6fc9a090
 * @va D2Game:0x6FC9A090 (95B)
 */
export function SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c(
  m: Memory113c,
  pUnit: number,
  wMsgId: number,
): void {
  hitD2GameVa113c(0x6FC9A090)
  if (pUnit !== 0) {
    m.u32((pUnit + 0x08) >>> 0)
  }
  const pNode = m.alloc(0x0c) >>> 0
  m.setU8((pNode + 0x04) >>> 0, 0xa4)
  m.setU32(pNode, 0)
  m.setU16((pNode + 0x08) >>> 0, wMsgId & 0xffff)

  const pHead = m.u32((pUnit + 0xec) >>> 0) >>> 0
  if (pHead === 0) {
    m.setU32((pUnit + 0xec) >>> 0, pNode)
  }
  const pTail = m.u32((pUnit + 0xf0) >>> 0) >>> 0
  if (pTail !== 0) {
    m.setU32(pTail, pNode)
  }
  m.setU32((pUnit + 0xf0) >>> 0, pNode)
  UNITROOM_RefreshUnit113c(m, pUnit >>> 0)
}

/**
 * [17/45] Callback that checks whether `pCandidateUnit` is a distinct, alive (`!D2Common.#10648`),
 * evil-aligned (`D2Common.#10830 == 0`) monster (`dwUnitType == 1`) closer than `pBestOut->nBestSqDist`
 * (`+0x04`), updating `pBestOut->pBestUnit` (`+0x00`) and `pBestOut->nBestSqDist` (`+0x04`). Returns `0`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pSelfUnit, [esp+4] = pCandidateUnit, [esp+8] = pBestOut)` (`ret 8`).
 *
 * @va D2Game.dll@0x6fc9b9f0
 * @va D2Game:0x6FC9B9F0 (69B)
 */
export function AI_FindClosestEvilMonsterCallback_6FC9B9F0_113c(
  m: Memory113c,
  _pGame: number,
  pSelfUnit: number,
  pCandidateUnit: number,
  pBestOut: number,
): number {
  hitD2GameVa113c(0x6FC9B9F0)
  if ((pSelfUnit >>> 0) === (pCandidateUnit >>> 0)) return 0
  if (pCandidateUnit === 0) return 0
  if ((m.u32(pCandidateUnit >>> 0) | 0) !== 1) return 0
  if ((UNIT_GetAlignment113c(m, pCandidateUnit >>> 0) | 0) !== 0) return 0
  if ((MONSTERS_IsDead113c(m, pCandidateUnit >>> 0) | 0) !== 0) return 0
  const nSqDist = UNIT_CalcSqDistSubtiles113c(m, pSelfUnit >>> 0, pCandidateUnit >>> 0) | 0
  const nCurBest = m.u32((pBestOut + 0x04) >>> 0) | 0
  if (nSqDist < nCurBest) {
    m.setU32(pBestOut >>> 0, pCandidateUnit >>> 0)
    m.setU32((pBestOut + 0x04) >>> 0, nSqDist >>> 0)
  }
  return 0
}

/**
 * [18/45] Clears state `12` (`0x0C`) GfxState flag if active (`D2Common.#10494` / `D2Common.#10945`),
 * initializes the monster's AI think function (`0x6FCBD230`), and stalls the monster for `1` tick (`0x6FD122C0`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pUnit, [esp+4] = pAiInitArgs)` (`ret 4`).
 *
 * @va D2Game.dll@0x6fc9c8c0
 * @va D2Game:0x6FC9C8C0 (68B)
 */
export function AI_ClearState12InitThinkFnAndStall1_6FC9C8C0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pAiInitArgs: number,
): void {
  hitD2GameVa113c(0x6FC9C8C0)
  const pAiEntry = pAiInitArgs !== 0 ? m.u32(pAiInitArgs >>> 0) >>> 0 : 0
  if ((STATES_CheckState113c(m, pUnit >>> 0, 0x0c) | 0) !== 0) {
    STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, 0x0c, 0)
  }
  const nAiIdx = pAiEntry !== 0 ? m.u32(pAiEntry) | 0 : 0
  AI_InitMonsterAiThinkFn113c(
    m,
    pUnit >>> 0,
    pGame >>> 0,
    pAiEntry !== 0 ? pAiEntry : undefined,
    pAiEntry !== 0 ? nAiIdx : undefined,
  )
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 1)
}

/**
 * [19/45] Checks if a tracked client stat value (`[pSyncTrack + 4]`) differs from `nNewVal`;
 * if `|nNewVal - nOldVal| > 8` or the small-delta counter (`byte [pSyncTrack + 0x0C]`) exceeds `6`,
 * resets the counter to `0`, updates `[pSyncTrack + 4] = nNewVal`, and returns `1` (otherwise `0`).
 *
 * Binary convention: `eax = pSyncTrack`, `edx = nNewVal` (`ret`).
 *
 * @va D2Game.dll@0x6fcaa330
 * @va D2Game:0x6FCAA330 (51B)
 */
export function NET_ShouldSyncTrackedStatDelta_6FCAA330_113c(
  m: Memory113c,
  pSyncTrack: number,
  nNewVal: number,
): number {
  hitD2GameVa113c(0x6FCAA330)
  const nOldVal = m.u32((pSyncTrack + 0x04) >>> 0) | 0
  let nDiff = ((nNewVal | 0) - nOldVal) | 0
  if (nDiff === 0) return 0
  if (nDiff < 0) {
    nDiff = -nDiff | 0
  }
  if (nDiff <= 8) {
    const nCount = ((m.u8((pSyncTrack + 0x0c) >>> 0) + 1) & 0xff) >>> 0
    m.setU8((pSyncTrack + 0x0c) >>> 0, nCount)
    if (nCount <= 6) {
      return 0
    }
  }
  m.setU8((pSyncTrack + 0x0c) >>> 0, 0)
  m.setU32((pSyncTrack + 0x04) >>> 0, nNewVal >>> 0)
  return 1
}

/**
 * [20/45] Builds 7-byte packet `0x9B` (`[0]=0x9B`, `[1..2]=wMercNameId`, `[3..6]=dwReviveCost`)
 * and queues it to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `eax = wMercNameId`, `ecx = dwReviveCost`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcaa690
 * @va D2Game:0x6FCAA690 (39B)
 */
export function NET_SendPacket9B_MercReviveInfo_6FCAA690_113c(
  m: Memory113c,
  wMercNameId: number,
  dwReviveCost: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAA690)
  const pPkt = m.alloc(8) >>> 0
  m.setU8(pPkt, 0x9b)
  m.setU16((pPkt + 0x01) >>> 0, wMercNameId & 0xffff)
  m.setU32((pPkt + 0x03) >>> 0, dwReviveCost >>> 0)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 7) | 0
}

/**
 * [21/45] Builds 7-byte packet `0x98` (`[0]=0x98`, `[1..4]=dwUnitGuid`, `[5..6]=wValue`)
 * and queues it to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `ecx = dwUnitGuid`, `edx = wValue`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcaa6c0
 * @va D2Game:0x6FCAA6C0 (53B)
 */
export function NET_SendPacket98_UnitWordValue_6FCAA6C0_113c(
  m: Memory113c,
  dwUnitGuid: number,
  wValue: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAA6C0)
  const pPkt = m.alloc(8) >>> 0
  m.setU8(pPkt, 0x98)
  m.setU32((pPkt + 0x01) >>> 0, dwUnitGuid >>> 0)
  m.setU16((pPkt + 0x05) >>> 0, wValue & 0xffff)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 7) | 0
}

/**
 * [22/45] Builds 10-byte packet `0x74` (`[0]=0x74`, `[1]=bAssign`, `[2..5]=dwOwnerGuid`, `[6..9]=dwCorpseGuid`,
 * using `0xFFFFFFFF` when either unit pointer is `0`) and queues it to channel `1` (`0x6FCAA3E0`).
 *
 * Binary convention: `eax = pOwnerUnit`, `ecx = pCorpseUnit`, `[esp+4] = pClient`, `[esp+8] = bAssign` (`ret 8`).
 *
 * @va D2Game.dll@0x6fcaa9c0
 * @va D2Game:0x6FCAA9C0 (69B)
 */
export function NET_SendPacket74_PlayerCorpseAssign_6FCAA9C0_113c(
  m: Memory113c,
  pOwnerUnit: number,
  pCorpseUnit: number,
  pClient: number,
  bAssign: number,
): number {
  hitD2GameVa113c(0x6FCAA9C0)
  const pPkt = m.alloc(0x0c) >>> 0
  m.setU8(pPkt, 0x74)
  m.setU8((pPkt + 0x01) >>> 0, bAssign & 0xff)
  const dwOwnerGuid = pOwnerUnit === 0 ? 0xffffffff : m.u32((pOwnerUnit + 0x0c) >>> 0) >>> 0
  m.setU32((pPkt + 0x02) >>> 0, dwOwnerGuid)
  const dwCorpseGuid = pCorpseUnit === 0 ? 0xffffffff : m.u32((pCorpseUnit + 0x0c) >>> 0) >>> 0
  m.setU32((pPkt + 0x06) >>> 0, dwCorpseGuid)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x0a) | 0
}

/**
 * [23/45] Copies a 32-byte (`0x20`, 8 dwords) packet payload from `pSrc` into a stack buffer
 * and queues it to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `eax = pSrc`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcaaa10
 * @va D2Game:0x6FCAAA10 (42B)
 */
export function NET_SendPacketBuffer32B_6FCAAA10_113c(
  m: Memory113c,
  pSrc: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAAA10)
  const pPkt = m.alloc(0x20) >>> 0
  for (let i = 0; i < 8; i = (i + 1) | 0) {
    const off = (i << 2) >>> 0
    m.setU32((pPkt + off) >>> 0, m.u32((pSrc + off) >>> 0) >>> 0)
  }
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x20) | 0
}

/**
 * [24/45] Copies a 21-byte (`0x15`, 5 dwords + 1 byte) packet payload from `pSrc` into a stack buffer
 * and queues it to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `eax = pSrc`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcaaa70
 * @va D2Game:0x6FCAAA70 (65B)
 */
export function NET_SendPacketBuffer21B_6FCAAA70_113c(
  m: Memory113c,
  pSrc: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAAA70)
  const pPkt = m.alloc(0x18) >>> 0
  m.setU32(pPkt, m.u32(pSrc >>> 0) >>> 0)
  m.setU32((pPkt + 0x04) >>> 0, m.u32((pSrc + 0x04) >>> 0) >>> 0)
  m.setU32((pPkt + 0x08) >>> 0, m.u32((pSrc + 0x08) >>> 0) >>> 0)
  m.setU32((pPkt + 0x0c) >>> 0, m.u32((pSrc + 0x0c) >>> 0) >>> 0)
  m.setU32((pPkt + 0x10) >>> 0, m.u32((pSrc + 0x10) >>> 0) >>> 0)
  m.setU8((pPkt + 0x14) >>> 0, m.u8((pSrc + 0x14) >>> 0))
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x15) | 0
}

/**
 * [25/45] Builds 2-byte packet `0x61` (`[0]=0x61`, `[1]=bParam`) and queues it to channel `1`
 * via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `al = bParam`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcaaac0
 * @va D2Game:0x6FCAAAC0 (30B)
 */
export function NET_SendPacket61_ByteParam_6FCAAAC0_113c(
  m: Memory113c,
  bParam: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAAAC0)
  const pPkt = m.alloc(4) >>> 0
  m.setU8(pPkt, 0x61)
  m.setU8((pPkt + 0x01) >>> 0, bParam & 0xff)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 2) | 0
}

/**
 * [26/45] Builds 7-byte town portal state packet `0x60` (`[0]=0x60`, `[1]=portalFlags` from
 * `D2Common.#10258`, `[2]=pObjectData->bDestLevel` at `+0x04`, `[3..6]=pPortalObject->dwUnitId` at `+0x0C`)
 * and queues it to channel `1` (`0x6FCAA3E0`).
 *
 * Binary convention: `esi = pPortalObject`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcaaae0
 * @va D2Game:0x6FCAAAE0 (57B)
 */
export function NET_SendPacket60_PortalInfo_6FCAAAE0_113c(
  m: Memory113c,
  pPortalObject: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAAAE0)
  const pPkt = m.alloc(8) >>> 0
  m.setU8(pPkt, 0x60)
  const bPortalFlags = UNITS_GetObjectPortalFlags113c(m, pPortalObject >>> 0) & 0xff
  const dwUnitId = m.u32((pPortalObject + 0x0c) >>> 0) >>> 0
  m.setU8((pPkt + 0x01) >>> 0, bPortalFlags)
  const pObjectData = m.u32((pPortalObject + 0x14) >>> 0) >>> 0
  const bDestLevel = m.u8((pObjectData + 0x04) >>> 0)
  m.setU8((pPkt + 0x02) >>> 0, bDestLevel)
  m.setU32((pPkt + 0x03) >>> 0, dwUnitId)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 7) | 0
}

/**
 * [27/45] Copies a 7-byte (`1 dword + 1 word + 1 byte`) packet payload from `pSrc` into a stack buffer
 * and queues it to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `eax = pSrc`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcaab20
 * @va D2Game:0x6FCAAB20 (46B)
 */
export function NET_SendPacketBuffer7B_6FCAAB20_113c(
  m: Memory113c,
  pSrc: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAAB20)
  const pPkt = m.alloc(8) >>> 0
  m.setU32(pPkt, m.u32(pSrc >>> 0) >>> 0)
  m.setU16((pPkt + 0x04) >>> 0, m.u16((pSrc + 0x04) >>> 0))
  m.setU8((pPkt + 0x06) >>> 0, m.u8((pSrc + 0x06) >>> 0))
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 7) | 0
}

/**
 * [28/45] Copies a 15-byte (`0x0F`, 3 dwords + 1 word + 1 byte) packet payload from `pSrc` into
 * a stack buffer and queues it to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `eax = pSrc`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcaabf0
 * @va D2Game:0x6FCAABF0 (60B)
 */
export function NET_SendPacketBuffer15B_6FCAABF0_113c(
  m: Memory113c,
  pSrc: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAABF0)
  const pPkt = m.alloc(0x10) >>> 0
  m.setU32(pPkt, m.u32(pSrc >>> 0) >>> 0)
  m.setU32((pPkt + 0x04) >>> 0, m.u32((pSrc + 0x04) >>> 0) >>> 0)
  m.setU32((pPkt + 0x08) >>> 0, m.u32((pSrc + 0x08) >>> 0) >>> 0)
  m.setU16((pPkt + 0x0c) >>> 0, m.u16((pSrc + 0x0c) >>> 0))
  m.setU8((pPkt + 0x0e) >>> 0, m.u8((pSrc + 0x0e) >>> 0))
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x0f) | 0
}

/**
 * [29/45] Builds a 15-byte (`0x0F`) transaction response packet (`[0]=bPacketId`, `[1]=bByte1`,
 * `[2]=bResult`, `[7..10]=dwParam7`, `[11..14]=dwParam11`) and queues it to channel `1` (`0x6FCAA3E0`).
 *
 * Binary convention: `al = bPacketId`, `cl = bResult`, `edx = dwParam11`,
 * `[esp+4] = pClient`, `[esp+8] = dwParam7`, `[esp+0xC] = bByte1` (`ret 0xC`).
 *
 * @va D2Game.dll@0x6fcaac90
 * @va D2Game:0x6FCAAC90 (52B)
 */
export function NET_SendPacket15B_TransactionResult_6FCAAC90_113c(
  m: Memory113c,
  bPacketId: number,
  bResult: number,
  dwParam11: number,
  pClient: number,
  dwParam7: number,
  bByte1: number,
): number {
  hitD2GameVa113c(0x6FCAAC90)
  const pPkt = m.alloc(0x10) >>> 0
  m.setU8(pPkt, bPacketId & 0xff)
  m.setU8((pPkt + 0x01) >>> 0, bByte1 & 0xff)
  m.setU8((pPkt + 0x02) >>> 0, bResult & 0xff)
  m.setU32((pPkt + 0x07) >>> 0, dwParam7 >>> 0)
  m.setU32((pPkt + 0x0b) >>> 0, dwParam11 >>> 0)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x0f) | 0
}

/**
 * [30/45] Copies a 6-byte (`1 dword + 1 word`) packet payload from `pSrc` into a stack buffer
 * and queues it to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `eax = pSrc`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcaacd0
 * @va D2Game:0x6FCAACD0 (40B)
 */
export function NET_SendPacketBuffer6B_6FCAACD0_113c(
  m: Memory113c,
  pSrc: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAACD0)
  const pPkt = m.alloc(8) >>> 0
  m.setU32(pPkt, m.u32(pSrc >>> 0) >>> 0)
  m.setU16((pPkt + 0x04) >>> 0, m.u16((pSrc + 0x04) >>> 0))
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 6) | 0
}

/**
 * [31/45] Builds a 7-byte packet (`[0]=bPacketId`, `[1]=bByte1`, `[2..5]=dwParam2`)
 * and queues it to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `al = bPacketId`, `cl = bByte1`, `edx = dwParam2`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcaad10
 * @va D2Game:0x6FCAAD10 (36B)
 */
export function NET_SendPacket7B_ByteAndDword_6FCAAD10_113c(
  m: Memory113c,
  bPacketId: number,
  bByte1: number,
  dwParam2: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAAD10)
  const pPkt = m.alloc(8) >>> 0
  m.setU8(pPkt, bPacketId & 0xff)
  m.setU8((pPkt + 0x01) >>> 0, bByte1 & 0xff)
  m.setU32((pPkt + 0x02) >>> 0, dwParam2 >>> 0)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 7) | 0
}

/**
 * [32/45] Builds a 103-byte (`0x67`) quest record packet (`[0]=bPacketId`, `[1]=bByte1`,
 * `[2..5]=dwUnitGuid`, `[6]=bByte6`, `[7..102]` copied from `pQuestData` via `D2Common.#10579`
 * `QUESTRECORD_CopyRecordToBuffer113c`) and queues it to channel `1` (`0x6FCAA3E0`).
 *
 * Binary convention: `al = bPacketId`, `cl = bByte1`, `edx = dwUnitGuid`,
 * `[esp+4] = pClient`, `[esp+8] = pQuestData`, `[esp+0xC] = bByte6` (`ret 0xC`).
 *
 * @va D2Game.dll@0x6fcaad40
 * @va D2Game:0x6FCAAD40 (64B)
 */
export function NET_SendPacket103B_QuestRecord_6FCAAD40_113c(
  m: Memory113c,
  bPacketId: number,
  bByte1: number,
  dwUnitGuid: number,
  pClient: number,
  pQuestData: number,
  bByte6: number,
): number {
  hitD2GameVa113c(0x6FCAAD40)
  const pPkt = m.alloc(0x68) >>> 0
  m.setU8(pPkt, bPacketId & 0xff)
  m.setU8((pPkt + 0x01) >>> 0, bByte1 & 0xff)
  m.setU32((pPkt + 0x02) >>> 0, dwUnitGuid >>> 0)
  m.setU8((pPkt + 0x06) >>> 0, bByte6 & 0xff)
  QUESTRECORD_CopyRecordToBuffer113c(m, pQuestData >>> 0, (pPkt + 0x07) >>> 0, 0x60, 0)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x67) | 0
}

/**
 * [33/45] Builds 11-byte (`0x0B`) packet `0x48` (`[0]=0x48`, `[1]=bUnitType` (`6` if `pUnit == 0`),
 * `[2]=bResult`, `[3..6]=dwUnitGuid` (`0xFFFFFFFF` if `pUnit == 0`), `[7..10]=0`) and queues it
 * to channel `1` (`0x6FCAA3E0`).
 *
 * Binary convention: `eax = pUnit`, `[esp+4] = pClient`, `[esp+8] = bResult` (`ret 8`).
 *
 * @va D2Game.dll@0x6fcaae60
 * @va D2Game:0x6FCAAE60 (86B)
 */
export function NET_SendPacket48_UnitRequestStatus_6FCAAE60_113c(
  m: Memory113c,
  pUnit: number,
  pClient: number,
  bResult: number,
): number {
  hitD2GameVa113c(0x6FCAAE60)
  const pPkt = m.alloc(0x0c) >>> 0
  m.setU8(pPkt, 0x48)
  const bUnitType = pUnit === 0 ? 6 : m.u32(pUnit >>> 0) & 0xff
  m.setU8((pPkt + 0x01) >>> 0, bUnitType)
  m.setU8((pPkt + 0x02) >>> 0, bResult & 0xff)
  const dwUnitGuid = pUnit === 0 ? 0xffffffff : m.u32((pUnit + 0x0c) >>> 0) >>> 0
  m.setU32((pPkt + 0x03) >>> 0, dwUnitGuid)
  m.setU32((pPkt + 0x07) >>> 0, 0)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x0b) | 0
}

/**
 * [34/45] Builds 11-byte (`0x0B`) packet `0x47` (`[0]=0x47`, `[1]=bUnitType` (`6` if `pUnit == 0`),
 * `[2]=0`, `[3..6]=dwUnitGuid` (`0xFFFFFFFF` if `pUnit == 0`), `[7..10]=0`) and queues it to channel `1`
 * (`0x6FCAA3E0`).
 *
 * Binary convention: `eax = pUnit`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcaaec0
 * @va D2Game:0x6FCAAEC0 (78B)
 */
export function NET_SendPacket47_UnitRelator1_6FCAAEC0_113c(
  m: Memory113c,
  pUnit: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAAEC0)
  const pPkt = m.alloc(0x0c) >>> 0
  m.setU8(pPkt, 0x47)
  const bUnitType = pUnit === 0 ? 6 : m.u32(pUnit >>> 0) & 0xff
  m.setU8((pPkt + 0x01) >>> 0, bUnitType)
  m.setU8((pPkt + 0x02) >>> 0, 0)
  const dwUnitGuid = pUnit === 0 ? 0xffffffff : m.u32((pUnit + 0x0c) >>> 0) >>> 0
  m.setU32((pPkt + 0x03) >>> 0, dwUnitGuid)
  m.setU32((pPkt + 0x07) >>> 0, 0)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x0b) | 0
}

/**
 * [35/45] Builds 6-byte packet `0x42` (`[0]=0x42`, `[1]=bUnitType` (`6` if `pUnit == 0`),
 * `[2..5]=dwUnitGuid` (`0xFFFFFFFF` if `pUnit == 0`)) and queues it to channel `1` (`0x6FCAA3E0`).
 *
 * Binary convention: `eax = pUnit`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcaaf10
 * @va D2Game:0x6FCAAF10 (70B)
 */
export function NET_SendPacket42_ClearCursor_6FCAAF10_113c(
  m: Memory113c,
  pUnit: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAAF10)
  const pPkt = m.alloc(8) >>> 0
  m.setU8(pPkt, 0x42)
  const bUnitType = pUnit === 0 ? 6 : m.u32(pUnit >>> 0) & 0xff
  m.setU8((pPkt + 0x01) >>> 0, bUnitType)
  const dwUnitGuid = pUnit === 0 ? 0xffffffff : m.u32((pUnit + 0x0c) >>> 0) >>> 0
  m.setU32((pPkt + 0x02) >>> 0, dwUnitGuid)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 6) | 0
}

/**
 * [36/45] Builds 6-byte packet `0x79` (`[0]=0x79`, `[1]=bOwnerFlag`, `[2..5]=dwGoldAmount`)
 * and queues it to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `eax = dwGoldAmount`, `cl = bOwnerFlag`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcab1f0
 * @va D2Game:0x6FCAB1F0 (38B)
 */
export function NET_SendPacket79_GoldInTrade_6FCAB1F0_113c(
  m: Memory113c,
  dwGoldAmount: number,
  bOwnerFlag: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAB1F0)
  const pPkt = m.alloc(8) >>> 0
  m.setU8(pPkt, 0x79)
  m.setU8((pPkt + 0x01) >>> 0, bOwnerFlag & 0xff)
  m.setU32((pPkt + 0x02) >>> 0, dwGoldAmount >>> 0)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 6) | 0
}

/**
 * [37/45] Builds 20-byte (`0x14`) packet `0x81` (`[0]=0x81`, `[1]=bByte1`, `[2..3]=wWord2`,
 * `[4..7]=dwOwnerGuid`, `[8..11]=dwMercGuid`, `[12..15]=dwSeed`, `[16..19]=dwWParam`)
 * and queues it to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `edx = dwMercGuid`, `[esp+4] = pClient`, `[esp+8] = bByte1`,
 * `[esp+0xC] = dwOwnerGuid`, `[esp+0x10] = wWord2`, `[esp+0x14] = dwSeed`, `[esp+0x18] = dwWParam` (`ret 0x18`).
 *
 * @va D2Game.dll@0x6fcab220
 * @va D2Game:0x6FCAB220 (97B)
 */
export function NET_SendPacket81_AssignMerc_6FCAB220_113c(
  m: Memory113c,
  dwMercGuid: number,
  pClient: number,
  bByte1: number,
  dwOwnerGuid: number,
  wWord2: number,
  dwSeed: number,
  dwWParam: number,
): number {
  hitD2GameVa113c(0x6FCAB220)
  const pPkt = m.alloc(0x14) >>> 0
  m.setU8(pPkt, 0x81)
  m.setU8((pPkt + 0x01) >>> 0, bByte1 & 0xff)
  m.setU16((pPkt + 0x02) >>> 0, wWord2 & 0xffff)
  m.setU32((pPkt + 0x04) >>> 0, dwOwnerGuid >>> 0)
  m.setU32((pPkt + 0x08) >>> 0, dwMercGuid >>> 0)
  m.setU32((pPkt + 0x0c) >>> 0, dwSeed >>> 0)
  m.setU32((pPkt + 0x10) >>> 0, dwWParam >>> 0)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x14) | 0
}

/**
 * [38/45] Builds 13-byte (`0x0D`) packet `0x7A` (`[0]=0x7A`, `[1]=bAction`, `[2]=bSkillTree`,
 * `[3..4]=wSummonArg`, `[5..8]=dwOwnerGuid`, `[9..12]=dwPetGuid`) and queues it to channel `1`
 * via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `cl = bAction`, `[esp+4] = pClient`, `[esp+8] = bSkillTree`,
 * `[esp+0xC] = dwPetGuid`, `[esp+0x10] = dwOwnerGuid`, `[esp+0x14] = wSummonArg` (`ret 0x14`).
 *
 * @va D2Game.dll@0x6fcab290
 * @va D2Game:0x6FCAB290 (85B)
 */
export function NET_SendPacket7A_SummonChange_6FCAB290_113c(
  m: Memory113c,
  bAction: number,
  pClient: number,
  bSkillTree: number,
  dwPetGuid: number,
  dwOwnerGuid: number,
  wSummonArg: number,
): number {
  hitD2GameVa113c(0x6FCAB290)
  const pPkt = m.alloc(0x10) >>> 0
  m.setU8(pPkt, 0x7a)
  m.setU8((pPkt + 0x01) >>> 0, bAction & 0xff)
  m.setU8((pPkt + 0x02) >>> 0, bSkillTree & 0xff)
  m.setU16((pPkt + 0x03) >>> 0, wSummonArg & 0xffff)
  m.setU32((pPkt + 0x05) >>> 0, dwOwnerGuid >>> 0)
  m.setU32((pPkt + 0x09) >>> 0, dwPetGuid >>> 0)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x0d) | 0
}

/**
 * [39/45] Copies a 21-byte (`0x15`, 5 dwords + 1 byte) packet payload from `pSrc` into a stack buffer
 * and queues it to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `eax = pSrc`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcab2f0
 * @va D2Game:0x6FCAB2F0 (65B)
 */
export function NET_SendPacketBuffer21B_Alt_6FCAB2F0_113c(
  m: Memory113c,
  pSrc: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAB2F0)
  const pPkt = m.alloc(0x18) >>> 0
  m.setU32(pPkt, m.u32(pSrc >>> 0) >>> 0)
  m.setU32((pPkt + 0x04) >>> 0, m.u32((pSrc + 0x04) >>> 0) >>> 0)
  m.setU32((pPkt + 0x08) >>> 0, m.u32((pSrc + 0x08) >>> 0) >>> 0)
  m.setU32((pPkt + 0x0c) >>> 0, m.u32((pSrc + 0x0c) >>> 0) >>> 0)
  m.setU32((pPkt + 0x10) >>> 0, m.u32((pSrc + 0x10) >>> 0) >>> 0)
  m.setU8((pPkt + 0x14) >>> 0, m.u8((pSrc + 0x14) >>> 0))
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x15) | 0
}

/**
 * [40/45] Builds 2-byte button action packet `0x77` (`[0]=0x77`, `[1]=bAction`) and queues it
 * to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `al = bAction`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcab340
 * @va D2Game:0x6FCAB340 (30B)
 */
export function NET_SendPacket77_ButtonAction_6FCAB340_113c(
  m: Memory113c,
  bAction: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAB340)
  const pPkt = m.alloc(4) >>> 0
  m.setU8(pPkt, 0x77)
  m.setU8((pPkt + 0x01) >>> 0, bAction & 0xff)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 2) | 0
}

/**
 * [41/45] Copies a 40-byte (`0x28`, 10 dwords) packet payload from `pSrc` into a stack buffer
 * and queues it to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `eax = pSrc`, `[esp+4] = pClient` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcab3d0
 * @va D2Game:0x6FCAB3D0 (42B)
 */
export function NET_SendPacketBuffer40B_6FCAB3D0_113c(
  m: Memory113c,
  pSrc: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAB3D0)
  const pPkt = m.alloc(0x28) >>> 0
  for (let i = 0; i < 10; i = (i + 1) | 0) {
    const off = (i << 2) >>> 0
    m.setU32((pPkt + off) >>> 0, m.u32((pSrc + off) >>> 0) >>> 0)
  }
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x28) | 0
}

/**
 * [42/45] Asserts `(wStatId & 0xFFFF) < 0xFF` (line `0x4B8`), builds a 10-byte unit stat packet
 * (`[0]=bPacketId`, `[1..4]=dwUnitGuid`, `[5]=wStatId & 0xFF`, `[6..9]=dwStatVal`), and queues it
 * to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `ax = wStatId`, `[esp+4] = pClient`, `[esp+8] = bPacketId`,
 * `[esp+0xC] = dwUnitGuid`, `[esp+0x10] = dwStatVal` (`ret 0x10`).
 *
 * @va D2Game.dll@0x6fcab9b0
 * @va D2Game:0x6FCAB9B0 (89B)
 */
export function NET_SendPacket10B_UnitByteStat_6FCAB9B0_113c(
  m: Memory113c,
  wStatId: number,
  pClient: number,
  bPacketId: number,
  dwUnitGuid: number,
  dwStatVal: number,
): number {
  hitD2GameVa113c(0x6FCAB9B0)
  if ((wStatId & 0xffff) >= 0xff) {
    throw new D2CommonAssertError('SUnitNet.cpp', 0x4b8)
  }
  const pPkt = m.alloc(0x0c) >>> 0
  m.setU8(pPkt, bPacketId & 0xff)
  m.setU32((pPkt + 0x01) >>> 0, dwUnitGuid >>> 0)
  m.setU8((pPkt + 0x05) >>> 0, wStatId & 0xff)
  m.setU32((pPkt + 0x06) >>> 0, dwStatVal >>> 0)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x0a) | 0
}

/**
 * [43/45] Builds 8-byte packet `0xA5` (`[0]=0xA5`, `[1]=bUnitType`, `[2..5]=dwUnitGuid`,
 * `[6..7]=wSkillId`) and queues it to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `cl = bUnitType`, `edx = dwUnitGuid`, `[esp+4] = pClient`, `[esp+8] = wSkillId` (`ret 8`).
 *
 * @va D2Game.dll@0x6fcaba10
 * @va D2Game:0x6FCABA10 (57B)
 */
export function NET_SendPacketA5_StateSkill_6FCABA10_113c(
  m: Memory113c,
  bUnitType: number,
  dwUnitGuid: number,
  pClient: number,
  wSkillId: number,
): number {
  hitD2GameVa113c(0x6FCABA10)
  const pPkt = m.alloc(8) >>> 0
  m.setU8(pPkt, 0xa5)
  m.setU8((pPkt + 0x01) >>> 0, bUnitType & 0xff)
  m.setU32((pPkt + 0x02) >>> 0, dwUnitGuid >>> 0)
  m.setU16((pPkt + 0x06) >>> 0, wSkillId & 0xffff)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 8) | 0
}

/**
 * [44/45] Compares `nDelta = nNewVal - nOldVal`:
 * - If `0 <= nDelta < 0xFF`, queues 2-byte packet `0x1A` (`[0]=0x1A`, `[1]=nDelta & 0xFF`);
 * - If `0xFF <= nDelta < 0xFFFF`, queues 3-byte packet `0x1B` (`[0]=0x1B`, `[1..2]=nDelta & 0xFFFF`);
 * - Otherwise (`nDelta < 0` or `nDelta >= 0xFFFF`), queues 5-byte packet `0x1C` (`[0]=0x1C`, `[1..4]=nNewVal`).
 *
 * Binary convention: `eax = pClient`, `edx = nNewVal`, `esi = nOldVal` (`ret`).
 *
 * @va D2Game.dll@0x6fcabda0
 * @va D2Game:0x6FCABDA0 (101B)
 */
export function NET_SendPacket1A1B1C_StatUpdate_6FCABDA0_113c(
  m: Memory113c,
  pClient: number,
  nNewVal: number,
  nOldVal: number,
): number {
  hitD2GameVa113c(0x6FCABDA0)
  const nDelta = ((nNewVal | 0) - (nOldVal | 0)) | 0
  const pPkt = m.alloc(8) >>> 0
  if (nDelta >= 0 && nDelta < 0xffff) {
    if (nDelta < 0xff) {
      m.setU8(pPkt, 0x1a)
      m.setU8((pPkt + 0x01) >>> 0, nDelta & 0xff)
      return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 2) | 0
    }
    m.setU8(pPkt, 0x1b)
    m.setU16((pPkt + 0x01) >>> 0, nDelta & 0xffff)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 3) | 0
  }
  m.setU8(pPkt, 0x1c)
  m.setU32((pPkt + 0x01) >>> 0, nNewVal >>> 0)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 5) | 0
}

/**
 * [45/45] Builds 6-byte room tile packet `0x07` (`[0]=0x07`, `[1..2]=wTileX`, `[3..4]=wTileY`,
 * `[5]=bAct`) and queues it to channel `1` via `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`).
 *
 * Binary convention: `ax = wTileX`, `cx = wTileY`, `[esp+4] = pClient`, `[esp+8] = bAct` (`ret 8`).
 *
 * @va D2Game.dll@0x6fcabf50
 * @va D2Game:0x6FCABF50 (48B)
 */
export function NET_SendPacket07_RoomTileCoords_6FCABF50_113c(
  m: Memory113c,
  wTileX: number,
  wTileY: number,
  pClient: number,
  bAct: number,
): number {
  hitD2GameVa113c(0x6FCABF50)
  const pPkt = m.alloc(8) >>> 0
  m.setU8(pPkt, 0x07)
  m.setU16((pPkt + 0x01) >>> 0, wTileX & 0xffff)
  m.setU16((pPkt + 0x03) >>> 0, wTileY & 0xffff)
  m.setU8((pPkt + 0x05) >>> 0, bAct & 0xff)
  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 6) | 0
}
