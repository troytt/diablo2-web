/**
 * K2 Wave 2 Batch 6 (`w2b6`) — `0x6FCD2E90..0x6FCE1F40` (45 `D2Game.dll` 1.13c functions).
 *
 * Strictly instruction-faithful 1:1 port against `D2Game.dll` (1.13c, image base `0x6FC20000`).
 */

import { UNITS_GetPlayerData113c } from '../common/composit.js';
import { D2CommonAssertError } from '../common/inline-helpers.js';
import { INVENTORY_GetCursorItem113c } from '../common/inventory.js';
import { DRLGWARP_TestRoomTileBit113c, ITEMS_GetBaseCode113c } from '../common/items.js';
import { STATLIST_GetStatListFromUnitAndStateMemPort113c } from '../common/k0-d2common-memports.js';
import { PATH_GetTargetUnit113c, PATH_MarkUnitDeadCollision113c } from '../common/path.js';
import {
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record.js';
import {
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetSkillIdFromSkill113c,
} from '../common/skills.js';
import {
  STATES_CheckState113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist.js';
import {
  UNITROOM_RefreshUnit113c,
  UNITS_CheckStateMaskExp113c,
  UNITS_GetApproximateDistance113c,
  UNITS_GetShiftedFrameMetrics113c,
  UNITS_SetSeqFrameFromLowByte113c,
} from '../common/unit.js';
import {
  WAYPOINT_ActivateWaypoint113c,
  WAYPOINT_GetWaypointNoFromLevelId113c,
} from '../common/waypoint.js';
import type { Memory113c } from '../mem/sparse-memory.js';
import { DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty113c } from '../tables/monster-tbls-113c.js';
import { QUESTS_GuidListRemove113c } from './a1c-post150-f150-f276-113c.js';
import { SKILLS_ExecuteSkillStart113c } from './a1c-post150-f786-f1040-113c.js';
import { D2GAME_ARENA_FindPlayerSlotByUnit113c } from './boot-init-gap-b-113c.js';
import {
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_RemoveCombatNode113c,
} from './combat-a1c-113c.js';
import { UNITS_GetDistanceToCoordinates113c } from './replay-kernel-113c.ts';
import { QUESTS_SendQuestStateAlert5D_113c } from './k2-items-tc-w1-113c.js';
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c.js';
import { UNITS_ChangeAnimMode113c } from './monster-events.js';
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_GetRecordPtr113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.js';
import { hitD2GameVa113c } from '../va-trace-113c.js';

/** `D2Game.dll` `.rdata` `0x6FD1B434`: `'..\\Source\\D2Game\\Ai\\AiBaal.cpp'`. */
const AIBAAL_CPP_VA_113C = 0x6fd1b434;
const AIBAAL_CPP_FILE_113C = '..\\Source\\D2Game\\Ai\\AiBaal.cpp';
const A4Q1_CPP_FILE_113C = '..\\Source\\D2Game\\Quests\\a4q1.cpp';
const SUNITNPC_CPP_FILE_113C = '..\\Source\\D2Game\\Unit\\SUnitNpc.cpp';

/** Hellforge Hammer base code `'hfh '` (`0x20686668`). */
const ITEM_CODE_HELLFORGE_HAMMER_113C = 0x20686668;

/** Normal difficulty per-act NPC vendor item level caps (`[12, 20, 28, 36, 45]`). */
const NORMAL_ACT_LEVEL_CAPS_113C = [0x0c, 0x14, 0x1c, 0x24, 0x2d] as const;

/**
 * Helper matching the inlined quest chain lookup (`pGame->pQuestControl->pQuest` walk by `dwQuestId`).
 */
function findQuestDataByIdInline113c(m: Memory113c, pGame: number, nQuestId: number): number {
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0;
  if (pQuestControl === 0) return 0;
  let pQuest = m.u32(pQuestControl) >>> 0;
  while (pQuest !== 0) {
    if ((m.u32(pQuest) | 0) === (nQuestId | 0)) {
      return pQuest;
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0;
  }
  return 0;
}

/**
 * Queries `UNITS_GetShiftedFrameMetrics113c(pUnit, &nFrame, &nFrameCount)`, clears
 * `pUnit->nSeqCurrentFramePreciseLowByte` (`byte [pUnit + 0x4E] = 0`), and if `nFrame <= 0`,
 * zeroes `pUnit->dwFrameCountPrecise` (`dword [pUnit + 0x3C] = 0`). Returns `1`.
 *
 * @va D2Game.dll@0x6fcd2e90
 */
export function SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c(
  m: Memory113c,
  _pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCD2E90);
  const sp = m.alloc(8) >>> 0;
  const pOutFrame = sp;
  const pOutFrameCount = (sp + 4) >>> 0;
  UNITS_GetShiftedFrameMetrics113c(m, pUnit, pOutFrame, pOutFrameCount);
  const nFrame = m.u32(pOutFrame) | 0;
  m.setU8((pUnit + 0x4e) >>> 0, 0);
  if (nFrame <= 0) {
    m.setU32((pUnit + 0x3c) >>> 0, 0);
  }
  return 1;
}

/**
 * Sets bits `0x0E` (`UNITFLAG_TARGETABLE | UNITFLAG_CANBEATTACKED | UNITFLAG_ISVALIDTARGET`)
 * on `pUnit->dwFlags` (`+0xC4`) if `pUnit != 0`, and returns `1`.
 *
 * @va D2Game.dll@0x6fcd2f80
 */
export function SKILLS_SrvSt_SetUnitFlags0E_6FCD2F80_113c(
  m: Memory113c,
  _pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCD2F80);
  const unit = pUnit >>> 0;
  if (unit !== 0) {
    m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x0e) >>> 0);
  }
  return 1;
}

/**
 * Clears bits `0x0E` (`& 0xFFFFFFF1`) on `pUnit->dwFlags` (`+0xC4`) if `pUnit != 0`,
 * and returns `1`.
 *
 * @va D2Game.dll@0x6fcd2fa0
 */
export function SKILLS_SrvSt_ClearUnitFlags0E_6FCD2FA0_113c(
  m: Memory113c,
  _pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCD2FA0);
  const unit = pUnit >>> 0;
  if (unit !== 0) {
    m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) & 0xfffffff1) >>> 0);
  }
  return 1;
}

/**
 * Clears bits `0x0E` (`& 0xFFFFFFF1`) on `pUnit->dwFlags` (`+0xC4`) if `pUnit != 0`,
 * calls `PATH_MarkUnitDeadCollision113c(pUnit, 1)`, and returns `1`.
 *
 * @va D2Game.dll@0x6fcd31b0
 */
export function SKILLS_SrvSt_ClearUnitFlags0EAndMarkDeadCollision_6FCD31B0_113c(
  m: Memory113c,
  _pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCD31B0);
  const unit = pUnit >>> 0;
  if (unit !== 0) {
    m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) & 0xfffffff1) >>> 0);
  }
  PATH_MarkUnitDeadCollision113c(m, unit, 1);
  return 1;
}

/**
 * Initializes channeled sequence frame bounds (`+0x44`, `+0x48`, and `UNITS_SetSeqFrameFromLowByte113c`)
 * for `pUnit` from `MonStats2.txt` (`+0x109` `uInfernoLen`) when `pUnit` is a monster (`dwUnitType == 1`),
 * or defaults to `nFrame = 8` and `dword [pUnit + 0x48] = 0x500` for non-monsters.
 *
 * @va D2Game.dll@0x6fcd3270
 */
export function SKILLS_InitInfernoSeqFrames_6FCD3270_113c(
  m: Memory113c,
  pUnit: number,
  pSkillsTxt: number,
): void {
  hitD2GameVa113c(0x6FCD3270);
  const unit = pUnit >>> 0;
  if (unit === 0 || (m.u32(unit) >>> 0) !== 1) {
    UNITS_SetSeqFrameFromLowByte113c(m, unit, 8);
    m.setU32((unit + 0x48) >>> 0, 0x500);
    return;
  }
  const nClassId = m.u32((unit + 4) >>> 0) | 0;
  const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, nClassId) >>> 0;
  if (pMonStats2 === 0) {
    return;
  }
  if (m.u8((pSkillsTxt + 0x11) >>> 0) === 0x0e) {
    const uLen = m.u8((pMonStats2 + 0x109) >>> 0);
    UNITS_SetSeqFrameFromLowByte113c(m, unit, (uLen - 1) | 0);
    const uEndLen = m.u8((pMonStats2 + 0x109) >>> 0);
    m.setU32((unit + 0x48) >>> 0, (((uEndLen + 1) | 0) << 8) >>> 0);
    return;
  }
  const uLen = m.u8((pMonStats2 + 0x109) >>> 0);
  m.setU32((unit + 0x44) >>> 0, (uLen << 8) >>> 0);
}

/**
 * Validates `pUnit`'s path target unit via `SUNIT_ValidatePathTargetUnit113c(pUnit, pGame)`,
 * reads `pTarget = PATH_GetTargetUnit113c(pUnit->pPath)`, and returns `1` if `pTarget != 0 && pTarget != pUnit`,
 * else `0`.
 *
 * @va D2Game.dll@0x6fcd3570
 */
export function SKILLS_SrvDo002_ValidateNonSelfPathTarget_6FCD3570_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCD3570);
  const unit = pUnit >>> 0;
  SUNIT_ValidatePathTargetUnit113c(m, unit, pGame >>> 0);
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((unit + 0x2c) >>> 0)) >>> 0;
  if (pTarget === unit || pTarget === 0) {
    return 0;
  }
  return 1;
}

/**
 * Validates `pUnit`'s path target unit, checks `pTarget != 0 && pTarget != pUnit`,
 * zeroes a `0x70`-byte `D2DamageStrc`, allocates a combat node via
 * `SUNITDMG_AllocCombat113c(pGame, pUnit, pTarget, &dmg, 0x80)`, and returns `1` (`0` if invalid target).
 *
 * @va D2Game.dll@0x6fcd3eb0
 */
export function SKILLS_SrvSt_AllocZeroDamageCombatForTarget_6FCD3EB0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCD3EB0);
  const unit = pUnit >>> 0;
  const game = pGame >>> 0;
  SUNIT_ValidatePathTargetUnit113c(m, unit, game);
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((unit + 0x2c) >>> 0)) >>> 0;
  if (pTarget === unit || pTarget === 0) {
    return 0;
  }
  const pDmg = m.alloc(0x70) >>> 0;
  for (let i = 0; i < 0x1c; i = (i + 1) | 0) {
    m.setU32((pDmg + (i << 2)) >>> 0, 0);
  }
  SUNITDMG_AllocCombat113c(m, game, unit, pTarget, pDmg, 0x80);
  return 1;
}

/**
 * Validates `pUnit`'s path target unit, checks `pTarget != 0 && pTarget != pUnit`,
 * executes combat events via `SUNITDMG_ExecuteEvents113c(pGame, pUnit, pTarget, 1, 0)`,
 * removes the combat node via `SUNITDMG_RemoveCombatNode113c(pUnit, pTarget)`, and restarts the skill
 * via `SKILLS_ExecuteSkillStart113c(nSkillId, pGame, pUnit, nSkillLevel, 0)`.
 *
 * @va D2Game.dll@0x6fcd4660
 */
export function SKILLS_SrvDo113_ExecuteCombatAndRestartSkill_6FCD4660_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD4660);
  const unit = pUnit >>> 0;
  const game = pGame >>> 0;
  SUNIT_ValidatePathTargetUnit113c(m, unit, game);
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((unit + 0x2c) >>> 0)) >>> 0;
  if (pTarget === unit || pTarget === 0) {
    return 0;
  }
  SUNITDMG_ExecuteEvents113c(m, game, unit, pTarget, 1, 0);
  SUNITDMG_RemoveCombatNode113c(m, unit, pTarget);
  return SKILLS_ExecuteSkillStart113c(m, nSkillId | 0, game, unit, nSkillLevel | 0, 0) | 0;
}

/**
 * No-op AI callback (`ret 4`).
 *
 * @va D2Game.dll@0x6fcd6c80
 */
export function AIBAAL_NoopThink_6FCD6C80_113c(
  _m: Memory113c,
  _pGame = 0,
  _pUnit = 0,
  _pAiTickParam = 0,
): void {
  hitD2GameVa113c(0x6FCD6C80);
  // No-op (ret 4)
}

/**
 * Checks whether `pSkill` on `pUnit` is a high-threat AoE/ranged skill for Baal clone/minion AI:
 * returns `1` for Blizzard (`0x3B`), Meteor (`0x38`), Firewall (`0x33`) with level `> 3`,
 * or Immolation Arrow (`0x1B`) with level `> 7`; else returns `0`.
 *
 * @va D2Game.dll@0x6fcd6c90
 */
export function AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c(
  m: Memory113c,
  pSkill: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCD6C90);
  const skill = pSkill >>> 0;
  if (skill === 0) {
    return 0;
  }
  const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, skill, AIBAAL_CPP_VA_113C, 0x131) | 0;
  if (nSkillId === 0x3b || nSkillId === 0x38) {
    return 1;
  }
  if (nSkillId === 0x33) {
    const nLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit >>> 0, skill, 1) | 0;
    return nLvl > 3 ? 1 : 0;
  }
  if (nSkillId === 0x1b) {
    const nLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit >>> 0, skill, 1) | 0;
    return nLvl > 7 ? 1 : 0;
  }
  return 0;
}

/**
 * Minion enumeration callback that increments `*pOutCount` when `pUnit` is non-null,
 * not equal to `*pSelfUnitPtr`, and not in death/corpse mode (`dwAnimMode != 0 && dwAnimMode != 0x0C`).
 *
 * @va D2Game.dll@0x6fcd6ce0
 */
export function AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c(
  m: Memory113c,
  pUnit: number,
  pSelfUnitPtr: number,
  pOutCount: number,
): void {
  hitD2GameVa113c(0x6FCD6CE0);
  const unit = pUnit >>> 0;
  if (unit === (m.u32(pSelfUnitPtr >>> 0) >>> 0)) {
    return;
  }
  if (unit === 0) {
    return;
  }
  const dwMode = m.u32((unit + 0x10) >>> 0) >>> 0;
  if (dwMode === 0 || dwMode === 0x0c) {
    return;
  }
  const outPtr = pOutCount >>> 0;
  m.setU32(outPtr, (m.u32(outPtr) + 1) >>> 0);
}

/**
 * Asserts both `pUnit1` (`line 0x11D`) and `pUnit2` (`line 0x11E`) are non-null, verifies they are
 * in the same Act (`byte [pUnit1 + 0x18] == byte [pUnit2 + 0x18]`), and returns `1` if their
 * Euclidean coordinate distance is `< 0x3FC` (`1020`), else `0`.
 *
 * @va D2Game.dll@0x6fcd6d30
 */
export function AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c(
  m: Memory113c,
  pUnit1: number,
  pUnit2: number,
): number {
  hitD2GameVa113c(0x6FCD6D30);
  const u1 = pUnit1 >>> 0;
  const u2 = pUnit2 >>> 0;
  if (u1 === 0) {
    throw new D2CommonAssertError(AIBAAL_CPP_FILE_113C, 0x11d);
  }
  if (u2 === 0) {
    throw new D2CommonAssertError(AIBAAL_CPP_FILE_113C, 0x11e);
  }
  if (m.u8((u1 + 0x18) >>> 0) !== m.u8((u2 + 0x18) >>> 0)) {
    return 0;
  }
  const y1 = UNIT_GetPosY113c(m, u1) | 0;
  const x1 = UNIT_GetPosX113c(m, u1) | 0;
  const x2 = UNIT_GetPosX113c(m, u2) | 0;
  const y2 = UNIT_GetPosY113c(m, u2) | 0;
  const dist = UNITS_GetDistanceToCoordinates113c(x2, y2, x1, y1) >>> 0;
  return dist < 0x3fc ? 1 : 0;
}

/**
 * Always returns `0` (`xor al, al; ret 0x0C`).
 *
 * @va D2Game.dll@0x6fcd87d0
 */
export function ACT4Q0_StatusFilter_6FCD87D0_113c(
  _m: Memory113c,
  _pQuest = 0,
  _pPlayer = 0,
  _pGlobalFlags = 0,
  _pPlayerFlags = 0,
  _pStatusOut = 0,
): number {
  hitD2GameVa113c(0x6FCD87D0);
  return 0;
}

/**
 * Act 4 Quest 2 (Hell's Forge) item-picked-up callback: if `pQuestArg->pItem` (`+0x08`) has base code
 * `'hfh '` (`0x20686668`), decrements `pQuestDataEx->nHellforgeHammerCount` (`dword [pQuestDataEx + 0x10]`).
 *
 * @va D2Game.dll@0x6fcd87f0
 */
export function ACT4Q2_Callback04_ItemPickedUp_6FCD87F0_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCD87F0);
  const pItem = m.u32((pQuestArg + 8) >>> 0) >>> 0;
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const dwCode = ITEMS_GetBaseCode113c(m, pItem) >>> 0;
  if (dwCode === ITEM_CODE_HELLFORGE_HAMMER_113C) {
    m.setU32((pQuestDataEx + 0x10) >>> 0, (m.u32((pQuestDataEx + 0x10) >>> 0) - 1) >>> 0);
  }
}

/**
 * Act 4 Quest 2 (Hell's Forge) active NPC filter: returns `1` if `nNpcId == 0xF6` (Cain in Act 4),
 * player quest flags `(0x1B, 0)` and `(0x1B, 1)` are both clear, `pQuest->bActive != 0`,
 * `pQuest->nQuestState == 1`, and `pQuestDataEx->bCainIntroActivated (`+0x1C`) == 0`; else `0`.
 *
 * @va D2Game.dll@0x6fcd8810
 */
export function ACT4Q2_ActiveFilter_6FCD8810_113c(
  m: Memory113c,
  pQuest: number,
  nNpcId: number,
  _pPlayer: number,
  pPlayerFlags: number,
  _pTargetUnit = 0,
): number {
  hitD2GameVa113c(0x6FCD8810);
  if ((nNpcId | 0) !== 0xf6) {
    return 0;
  }
  const flags = pPlayerFlags >>> 0;
  if (DRLGWARP_TestRoomTileBit113c(m, flags, 0x1b, 0) !== 0) {
    return 0;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, flags, 0x1b, 1) !== 0) {
    return 0;
  }
  const quest = pQuest >>> 0;
  if (m.u8((quest + 9) >>> 0) === 0) {
    return 0;
  }
  if (m.u8((quest + 0x0c) >>> 0) !== 1) {
    return 0;
  }
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0;
  if (m.u8((pQuestDataEx + 0x1c) >>> 0) !== 0) {
    return 0;
  }
  return 1;
}

/**
 * Initializes the Hellforge object (`pObjInit->pObject` at `+0x04`): locates quest `0x17` on `pObjInit->pGame`,
 * and if `pQuestDataEx->nObjectMode` (`+0x40`) != `2`, sets it to `2` and changes object anim mode to `1`;
 * otherwise changes object anim mode to `2`.
 *
 * @va D2Game.dll@0x6fcd8870
 */
export function ACT4Q2_InitHellforgeObject_6FCD8870_113c(m: Memory113c, pObjInit: number): void {
  hitD2GameVa113c(0x6FCD8870);
  const initPtr = pObjInit >>> 0;
  const pGame = m.u32(initPtr) >>> 0;
  const pQuest = findQuestDataByIdInline113c(m, pGame, 0x17);
  if (pQuest === 0) {
    return;
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const nObjMode = m.u32((pQuestDataEx + 0x40) >>> 0) >>> 0;
  const pObject = m.u32((initPtr + 4) >>> 0) >>> 0;
  if (nObjMode !== 2) {
    m.setU32((pQuestDataEx + 0x40) >>> 0, 2);
    UNITS_ChangeAnimMode113c(m, pObject, 1);
    return;
  }
  UNITS_ChangeAnimMode113c(m, pObject, 2);
}

/**
 * Checks whether Classic (`bExpansion == 0`) quest state on quest `0x17` blocks special drop:
 * returns `0` if `pGame->bExpansion != 0` or if quest `0x17` has `byte [pQuestDataEx + 0x14] == 0`;
 * returns `1` if quest `0x17` is missing or `byte [pQuestDataEx + 0x14] != 0`.
 *
 * @va D2Game.dll@0x6fcd88c0
 */
export function ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c(
  m: Memory113c,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCD88C0);
  const game = pGame >>> 0;
  if (m.u32((game + 0x70) >>> 0) !== 0) {
    return 0;
  }
  const pQuest = findQuestDataByIdInline113c(m, game, 0x17);
  if (pQuest === 0) {
    return 1;
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  return m.u8((pQuestDataEx + 0x14) >>> 0) !== 0 ? 1 : 0;
}

/**
 * No-op object init handler (`ret`).
 *
 * @va D2Game.dll@0x6fcd8930
 */
export function ACT4_InitObjectNoop_6FCD8930_113c(_m: Memory113c, _pObjInit = 0): void {
  hitD2GameVa113c(0x6FCD8930);
  // No-op (ret)
}

/**
 * Player iteration callback for Act 4 Quest 1 (Izual): if `UNITS_GetApproximateDistance113c(pPlayer, pQuestDataEx->pIzualGhost)`
 * (`+0x14`) `< 5`, sets `pQuestDataEx->bPlayerClose` (`byte [pQuestDataEx + 0x18] = 1`).
 *
 * @va D2Game.dll@0x6fcd8a50
 */
export function ACT4Q1_CheckPlayerNearIzualCallback_6FCD8A50_113c(
  m: Memory113c,
  _pGame: number,
  pPlayer: number,
  pQuestDataEx: number,
): void {
  hitD2GameVa113c(0x6FCD8A50);
  const dataEx = pQuestDataEx >>> 0;
  const pTarget = m.u32((dataEx + 0x14) >>> 0) >>> 0;
  const dist = UNITS_GetApproximateDistance113c(m, pPlayer >>> 0, pTarget) | 0;
  if (dist < 5) {
    m.setU8((dataEx + 0x18) >>> 0, 1);
  }
}

/**
 * Act 4 Prologue active NPC filter: returns `1` if `nNpcId == 0x16F` (Tyrael) and
 * `DRLGWARP_TestRoomTileBit113c(pPlayerFlags, 0x18, 0) == 0`; else `0`.
 *
 * @va D2Game.dll@0x6fcd8b50
 */
export function ACT4Prologue_ActiveFilter_6FCD8B50_113c(
  m: Memory113c,
  _pQuest: number,
  nNpcId: number,
  _pPlayer: number,
  pPlayerFlags: number,
  _pTargetUnit = 0,
): number {
  hitD2GameVa113c(0x6FCD8B50);
  if ((nNpcId | 0) !== 0x16f) {
    return 0;
  }
  return DRLGWARP_TestRoomTileBit113c(m, pPlayerFlags >>> 0, 0x18, 0) === 0 ? 1 : 0;
}

/**
 * Always returns `0` (`xor al, al; ret 0x0C`).
 *
 * @va D2Game.dll@0x6fcd8b80
 */
export function ACT4Prologue_StatusFilter_6FCD8B80_113c(
  _m: Memory113c,
  _pQuest = 0,
  _pPlayer = 0,
  _pGlobalFlags = 0,
  _pPlayerFlags = 0,
  _pStatusOut = 0,
): number {
  hitD2GameVa113c(0x6FCD8B80);
  return 0;
}

/**
 * Act 4 Quest 2 (Hell's Forge) player-joined callback: if `pPlayer` (`pQuestArg + 0x0C`) carries
 * a Hellforge Hammer (`'hfh '`, `0x20686668`), increments `pQuestDataEx->nHellforgeHammerCount` (`+0x10`).
 *
 * @va D2Game.dll@0x6fcd8cc0
 */
export function ACT4Q2_Callback14_PlayerJoined_6FCD8CC0_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCD8CC0);
  const arg = pQuestArg >>> 0;
  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0;
  const pGame = m.u32(arg) >>> 0;
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, ITEM_CODE_HELLFORGE_HAMMER_113C) !== 0
  ) {
    m.setU32((pQuestDataEx + 0x10) >>> 0, (m.u32((pQuestDataEx + 0x10) >>> 0) + 1) >>> 0);
  }
}

/**
 * Act 4 Quest 2 callback `0x0A` (player leaves): removes `pPlayer->dwUnitId` (or `0xFFFFFFFF` if `pPlayer == 0`)
 * from `pQuest->tPlayerGuids` (`pQuest + 0x1C`).
 *
 * @va D2Game.dll@0x6fcd8e60
 */
export function ACT4Q2_Callback10_RemovePlayerGuid_6FCD8E60_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FCD8E60);
  const pUnit = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const dwGuid = pUnit === 0 ? 0xffffffff : m.u32((pUnit + 0x0c) >>> 0) >>> 0;
  return QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid) | 0;
}

/**
 * Act 4 Quest 3 (Diablo) callback `0x0E` (player joined): in Expansion games (`pGame->bExpansion != 0`),
 * if quest state `(0x1A, 9)` is set on `pPlayer` and Act 5 prologue `(0x1C, 0)` is clear, clears `(0x1A, 9)`.
 *
 * @va D2Game.dll@0x6fcd8fe0
 */
export function ACT4Q3_Callback14_ClearState09IfAct5Incomplete_6FCD8FE0_113c(
  m: Memory113c,
  _pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCD8FE0);
  const arg = pQuestArg >>> 0;
  const pGame = m.u32(arg) >>> 0;
  if (m.u32((pGame + 0x70) >>> 0) === 0) {
    return;
  }
  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0;
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0;
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + (nDifficulty << 2) + 0x10) >>> 0) >>> 0;
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 9) !== 0) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1c, 0) === 0) {
      QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x1a, 9);
    }
  }
}

/**
 * Activates the Harrogath waypoint (`levelId = 0x6D` / `109`) in `pPlayer`'s waypoint history for
 * `pGame->nDifficulty`.
 *
 * @va D2Game.dll@0x6fcd9030
 */
export function ACT4Q3_ActivateHarrogathWaypointForPlayer_6FCD9030_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FCD9030);
  const pWaypointNoOut = m.alloc(4) >>> 0;
  if (WAYPOINT_GetWaypointNoFromLevelId113c(m, 0x6d, pWaypointNoOut) !== 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0;
    const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
    const wWaypointNo = m.u16(pWaypointNoOut);
    const pWaypointData = m.u32((pPlayerData + (nDifficulty << 2) + 0x1c) >>> 0) >>> 0;
    WAYPOINT_ActivateWaypoint113c(m, pWaypointData, wWaypointNo);
  }
}

/**
 * Act 4 Quest 1 callback `0x0A` (player leaves): removes `pPlayer->dwUnitId` (or `0xFFFFFFFF` if `pPlayer == 0`)
 * from `pQuest->tPlayerGuids` (`pQuest + 0x1C`).
 *
 * @va D2Game.dll@0x6fcd94d0
 */
export function ACT4Q1_Callback10_RemovePlayerGuid_6FCD94D0_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FCD94D0);
  const pUnit = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const dwGuid = pUnit === 0 ? 0xffffffff : m.u32((pUnit + 0x0c) >>> 0) >>> 0;
  return QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid) | 0;
}

/**
 * Act 4 Prologue scroll message callback (`wNpcId == 0x16F`, `wMessageIndex == 0x298`):
 * sets quest state `(0x18, 0)` on `pPlayer`'s quest record for `pGame->nDifficulty`.
 *
 * @va D2Game.dll@0x6fcd97a0
 */
export function ACT4Prologue_Callback11_ScrollMessage_6FCD97A0_113c(
  m: Memory113c,
  _pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCD97A0);
  const arg = pQuestArg >>> 0;
  if (m.u16((arg + 0x14) >>> 0) !== 0x16f) {
    return;
  }
  if (m.u16((arg + 0x18) >>> 0) !== 0x298) {
    return;
  }
  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0;
  const pGame = m.u32(arg) >>> 0;
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0;
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + (nDifficulty << 2) + 0x10) >>> 0) >>> 0;
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x18, 0);
}

/**
 * Act 4 Quest 2 (Hell's Forge) player sync callback: if neither `(0x1B, 0)` nor `(0x1B, 1)` is `1`,
 * sets quest state `(0x1B, 0x0E)` and sends packet `0x5D` (`uQuestId = 0x18, uMinAct = 0`). Returns `0`.
 *
 * @va D2Game.dll@0x6fcd9920
 */
export function ACT4Q2_SyncHellforgeQuestStateCallback_6FCD9920_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCD9920);
  const player = pPlayer >>> 0;
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0;
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + (nDifficulty << 2) + 0x10) >>> 0) >>> 0;
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 0) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 1) !== 1
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1b, 0x0e);
    QUESTS_SendQuestStateAlert5D_113c(m, player, 0x18, 0);
  }
  return 0;
}

/**
 * Act 4 Quest 3 (Diablo) player sync callback: if `(0x1A, 0)` is not `1`, sets quest state `(0x1A, 0x0E)`
 * and sends packet `0x5D` (`uQuestId = 0x17, uMinAct = 0`). Returns `0`.
 *
 * @va D2Game.dll@0x6fcd9bc0
 */
export function ACT4Q3_SyncDiabloQuestStateCallback_6FCD9BC0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCD9BC0);
  const player = pPlayer >>> 0;
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0;
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + (nDifficulty << 2) + 0x10) >>> 0) >>> 0;
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0) !== 1) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1a, 0x0e);
    QUESTS_SendQuestStateAlert5D_113c(m, player, 0x17, 0);
  }
  return 0;
}

/**
 * Act 4 Quest 1 (Izual) player chat broadcast callback: if quest state `(0x19, 0x0D)` is set on `pPlayer`,
 * asserts `pPlayer != 0` (`line 0x558`), sets `pPlayer->wUnitMessageId = 0x4A` (`+0x6E`) and
 * `pPlayer->pMessageUnit = pPlayer` (`+0x70`), calls `UNITROOM_RefreshUnit113c(pPlayer)`,
 * and sets `0x400` (`UNITFLAG_SENDREFRESHMSG`) on `pPlayer->dwFlags` (`+0xC4`). Returns `0`.
 *
 * @va D2Game.dll@0x6fcd9c60
 */
export function ACT4Q1_BroadcastIzualQuestChatCallback_6FCD9C60_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCD9C60);
  const player = pPlayer >>> 0;
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0;
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + (nDifficulty << 2) + 0x10) >>> 0) >>> 0;
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 0x0d) !== 0) {
    if (player === 0) {
      throw new D2CommonAssertError(A4Q1_CPP_FILE_113C, 0x558);
    }
    m.setU16((player + 0x6e) >>> 0, 0x4a);
    m.setU32((player + 0x70) >>> 0, player);
    UNITROOM_RefreshUnit113c(m, player);
    m.setU32((player + 0xc4) >>> 0, (m.u32((player + 0xc4) >>> 0) | 0x400) >>> 0);
  }
  return 0;
}

/**
 * Act 4 Quest 1 (Izual) player sync callback: if neither `(0x19, 0)` nor `(0x19, 1)` is `1`,
 * sets quest state `(0x19, 0x0E)` and sends packet `0x5D` (`uQuestId = 0x16, uMinAct = 0`). Returns `0`.
 *
 * @va D2Game.dll@0x6fcd9cd0
 */
export function ACT4Q1_SyncIzualQuestStateCallback_6FCD9CD0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCD9CD0);
  const player = pPlayer >>> 0;
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0;
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + (nDifficulty << 2) + 0x10) >>> 0) >>> 0;
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 0) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 1) !== 1
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x19, 0x0e);
    QUESTS_SendQuestStateAlert5D_113c(m, player, 0x16, 0);
  }
  return 0;
}

/**
 * Queries the first `Hireling.txt` record for `(pGame->bExpansion, nVendorClassId, nDifficulty = 0, 0)`:
 * if none exists, zeroes `*pOutIdLow`, `*pOutIdHigh`, and `*pOutMonsterClassId` and returns `-1`;
 * otherwise writes `wNameFirst` (`+0x114`) to `*pOutIdLow`, `wNameLast` (`+0x116`) to `*pOutIdHigh`,
 * `dwClass` (`+0x08`) to `*pOutMonsterClassId` (if non-null), asserts `count != -1` (`line 0x5B`),
 * and returns `(*pOutIdHigh - *pOutIdLow + 1) | 0`.
 *
 * @va D2Game.dll@0x6fcdc7d0
 */
export function HIRELING_GetVendorNameIdRange_6FCDC7D0_113c(
  m: Memory113c,
  nVendorClassId: number,
  pOutIdLow: number,
  pOutIdHigh: number,
  pOutMonsterClassId: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCDC7D0);
  const outLow = pOutIdLow >>> 0;
  const outHigh = pOutIdHigh >>> 0;
  const outClass = pOutMonsterClassId >>> 0;
  const bExpansion = m.u32((pGame + 0x70) >>> 0) | 0;
  const pHirelingTxt =
    DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty113c(
      m,
      bExpansion,
      nVendorClassId | 0,
      0,
      0,
    ) >>> 0;
  if (pHirelingTxt === 0) {
    m.setU32(outLow, 0);
    m.setU32(outHigh, 0);
    m.setU32(outClass, 0);
    return -1;
  }
  const uIdLow = m.u16((pHirelingTxt + 0x114) >>> 0) >>> 0;
  m.setU32(outLow, uIdLow);
  const uIdHigh = m.u16((pHirelingTxt + 0x116) >>> 0) >>> 0;
  m.setU32(outHigh, uIdHigh);
  if (outClass !== 0) {
    m.setU32(outClass, m.u32((pHirelingTxt + 8) >>> 0) >>> 0);
  }
  const nCount = ((m.u32(outHigh) | 0) - (m.u32(outLow) | 0) + 1) | 0;
  if (nCount === -1) {
    throw new D2CommonAssertError(SUNITNPC_CPP_FILE_113C, 0x5b);
  }
  return nCount;
}

/**
 * Iterates `nState = 0 .. sgptDataTables->nStatesTxtRecordCount - 1` (`+0xC4`); for each active state
 * on `pUnit` with `UNITS_CheckStateMaskExp113c(nState) != 0` and a non-null statlist, unlinks and frees
 * the statlist, returning `1` if at least one statlist was removed, else `0`.
 *
 * @va D2Game.dll@0x6fcdc920
 */
export function STATES_PurgeExpStateStatLists_6FCDC920_113c(
  m: Memory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCDC920);
  const unit = pUnit >>> 0;
  let pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0;
  let nStatesCount = m.u32((pDataTables + 0xc4) >>> 0) | 0;
  let bRemovedAny = 0;
  let nState = 0;
  if (nStatesCount > 0) {
    do {
      if (STATES_CheckState113c(m, unit, nState) !== 0) {
        if (UNITS_CheckStateMaskExp113c(m, nState) !== 0) {
          const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, unit, nState) >>> 0;
          if (pStatList !== 0) {
            STATLIST_UnlinkSubList113c(m, unit, pStatList);
            STATLIST_FreeStatListIfNonExtended113c(m, pStatList);
            bRemovedAny = 1;
          }
        }
      }
      pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0;
      nStatesCount = m.u32((pDataTables + 0xc4) >>> 0) | 0;
      nState = (nState + 1) | 0;
    } while (nState < nStatesCount);
  }
  return bRemovedAny;
}

/**
 * Checks whether `pUnit->pInventory` (`+0x60`) has a cursor item whose `dwUnitId` (`+0x0C`)
 * equals `dwItemGuid`.
 *
 * @va D2Game.dll@0x6fcdc990
 */
export function INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c(
  m: Memory113c,
  pUnit: number,
  dwItemGuid: number,
): number {
  hitD2GameVa113c(0x6FCDC990);
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0;
  if (pInventory === 0) {
    return 0;
  }
  const pCursorItem = INVENTORY_GetCursorItem113c(m, pInventory) >>> 0;
  if (pCursorItem === 0) {
    return 0;
  }
  return (m.u32((pCursorItem + 0x0c) >>> 0) >>> 0) === (dwItemGuid >>> 0) ? 1 : 0;
}

/**
 * In Normal difficulty (`pGame->nDifficulty == 0`), looks up `pNpc`'s `D2NpcRecordStrc` in
 * `pGame->pNpcControl` (`0x6FCAF5C0`) and clamps `nMaxCap` to the Act-based cap `[12, 20, 28, 36, 45][uAct]`
 * when `uAct < 5`.
 *
 * @va D2Game.dll@0x6fcdcb20
 */
export function NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c(
  m: Memory113c,
  pGame: number,
  pNpc: number,
  nMaxCap: number,
): number {
  hitD2GameVa113c(0x6FCDCB20);
  const game = pGame >>> 0;
  const maxCap = nMaxCap | 0;
  if (m.u8((game + 0x6d) >>> 0) !== 0) {
    return maxCap;
  }
  const npc = pNpc >>> 0;
  const nClassId = npc === 0 ? 0xffffffff : m.u32((npc + 4) >>> 0) >>> 0;
  const pOutIdx = m.alloc(4) >>> 0;
  const pNpcRecord = D2GAME_ARENA_FindPlayerSlotByUnit113c(m, pOutIdx, game, nClassId) >>> 0;
  if (pNpcRecord === 0) {
    return maxCap;
  }
  const uAct = m.u8((pNpcRecord + 0x22) >>> 0);
  if (uAct >= 5) {
    return maxCap;
  }
  const nActCap = NORMAL_ACT_LEVEL_CAPS_113C[uAct]!;
  return nActCap < maxCap ? nActCap : maxCap;
}

/**
 * Always returns `0` (`xor al, al; ret 0x0C`).
 *
 * @va D2Game.dll@0x6fce1960
 */
export function ACT2Q5_StatusFilter_6FCE1960_113c(
  _m: Memory113c,
  _pQuest = 0,
  _pPlayer = 0,
  _pGlobalFlags = 0,
  _pPlayerFlags = 0,
  _pStatusOut = 0,
): number {
  hitD2GameVa113c(0x6FCE1960);
  return 0;
}

/**
 * Always returns `0` (`xor al, al; ret 0x0C`).
 *
 * @va D2Game.dll@0x6fce1970
 */
export function ACT2Q4_StatusFilter_6FCE1970_113c(
  _m: Memory113c,
  _pQuest = 0,
  _pPlayer = 0,
  _pGlobalFlags = 0,
  _pPlayerFlags = 0,
  _pStatusOut = 0,
): number {
  hitD2GameVa113c(0x6FCE1970);
  return 0;
}

/**
 * No-op quest callback (`ret`).
 *
 * @va D2Game.dll@0x6fce1980
 */
export function ACT2Q4_Callback00_Noop_6FCE1980_113c(
  _m: Memory113c,
  _pQuest = 0,
  _pQuestArg = 0,
): void {
  hitD2GameVa113c(0x6FCE1980);
  // No-op (ret)
}

/**
 * Checks whether Act 2 Quest 2 (`dwQuestId = 0x0D`, Horadric Staff) is absent, inactive (`bActive == 0`),
 * or in `nQuestState >= 4` (`+0x0C`), returning `1` if so, else `0`.
 *
 * @va D2Game.dll@0x6fce1a00
 */
export function ACT2Q2_IsHoradricStaffQuestInactiveOrCompleted_6FCE1A00_113c(
  m: Memory113c,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCE1A00);
  const pQuest = findQuestDataByIdInline113c(m, pGame >>> 0, 0x0d);
  if (pQuest === 0) {
    return 1;
  }
  if (m.u8((pQuest + 9) >>> 0) === 0) {
    return 1;
  }
  return m.u8((pQuest + 0x0c) >>> 0) >= 4 ? 1 : 0;
}

/**
 * Player iteration callback for Act 2 Quest 4 (Arcane Sanctuary / Horazon's Journal):
 * if `UNITS_GetApproximateDistance113c(pPlayer, pQuestDataEx->pTomeObject)` (`+0x40`) `< 0x0C`,
 * sets `pQuestDataEx->bPlayerNearTome` (`byte [pQuestDataEx + 0x44] = 1`).
 *
 * @va D2Game.dll@0x6fce1a40
 */
export function ACT2Q4_CheckPlayerNearHorazonTomeCallback_6FCE1A40_113c(
  m: Memory113c,
  _pGame: number,
  pPlayer: number,
  pQuestDataEx: number,
): void {
  hitD2GameVa113c(0x6FCE1A40);
  const dataEx = pQuestDataEx >>> 0;
  const pTarget = m.u32((dataEx + 0x40) >>> 0) >>> 0;
  const dist = UNITS_GetApproximateDistance113c(m, pPlayer >>> 0, pTarget) | 0;
  if (dist < 0x0c) {
    m.setU8((dataEx + 0x44) >>> 0, 1);
  }
}

/**
 * Checks whether Act 2 Quest 2 (`dwQuestId = 0x0D`) is present, active (`bActive != 0`),
 * and has `byte [pQuestDataEx + 0x0B] == 0`.
 *
 * @va D2Game.dll@0x6fce1a60
 */
export function ACT2Q2_CanSpawnViperAmuletChest_6FCE1A60_113c(
  m: Memory113c,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCE1A60);
  const pQuest = findQuestDataByIdInline113c(m, pGame >>> 0, 0x0d);
  if (pQuest === 0) {
    return 0;
  }
  if (m.u8((pQuest + 9) >>> 0) === 0) {
    return 0;
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  return m.u8((pQuestDataEx + 0x0b) >>> 0) === 0 ? 1 : 0;
}

/**
 * Checks whether Act 2 Quest 2 (`dwQuestId = 0x0D`) is present, active (`bActive != 0`),
 * and in `nQuestState == 1` (`+0x0C`).
 *
 * @va D2Game.dll@0x6fce1b20
 */
export function ACT2Q2_IsQuestInState01_6FCE1B20_113c(m: Memory113c, pGame: number): number {
  hitD2GameVa113c(0x6FCE1B20);
  const pQuest = findQuestDataByIdInline113c(m, pGame >>> 0, 0x0d);
  if (pQuest === 0) {
    return 0;
  }
  if (m.u8((pQuest + 9) >>> 0) === 0) {
    return 0;
  }
  return m.u8((pQuest + 0x0c) >>> 0) === 1 ? 1 : 0;
}

/**
 * Checks whether Act 2 Quest 2 (`dwQuestId = 0x0D`) is absent, inactive (`bActive == 0`),
 * or in `nQuestState >= 2` (`+0x0C`), returning `1` if so, else `0`.
 *
 * @va D2Game.dll@0x6fce1b60
 */
export function ACT2Q2_IsQuestPastState01_6FCE1B60_113c(m: Memory113c, pGame: number): number {
  hitD2GameVa113c(0x6FCE1B60);
  const pQuest = findQuestDataByIdInline113c(m, pGame >>> 0, 0x0d);
  if (pQuest === 0) {
    return 1;
  }
  if (m.u8((pQuest + 9) >>> 0) === 0) {
    return 1;
  }
  return m.u8((pQuest + 0x0c) >>> 0) >= 2 ? 1 : 0;
}

/**
 * Retrieves Radament / Sewer quest (`dwQuestId = 0x0B`) target coordinates into `pOutCoord` (`+0x00`, `+0x04`):
 * if `byte [pQuestDataEx + 0x18] != 0`, copies `(x, y)` from `(pQuestDataEx + 0x30, pQuestDataEx + 0x34)` and returns `1`;
 * else if `byte [pQuestDataEx + 0x19] != 0`, copies `(x, y - 4)` and returns `1`; else returns `0`.
 *
 * @va D2Game.dll@0x6fce1ee0
 */
export function ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c(
  m: Memory113c,
  pGame: number,
  pOutCoord: number,
): number {
  hitD2GameVa113c(0x6FCE1EE0);
  const pQuest = findQuestDataByIdInline113c(m, pGame >>> 0, 0x0b);
  if (pQuest === 0) {
    return 0;
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const outPtr = pOutCoord >>> 0;
  if (m.u8((pQuestDataEx + 0x18) >>> 0) !== 0) {
    m.setU32(outPtr, m.u32((pQuestDataEx + 0x30) >>> 0));
    m.setU32((outPtr + 4) >>> 0, m.u32((pQuestDataEx + 0x34) >>> 0));
    return 1;
  }
  if (m.u8((pQuestDataEx + 0x19) >>> 0) !== 0) {
    m.setU32(outPtr, m.u32((pQuestDataEx + 0x30) >>> 0));
    const y = m.u32((pQuestDataEx + 0x34) >>> 0);
    m.setU32((outPtr + 4) >>> 0, y);
    m.setU32((outPtr + 4) >>> 0, (y - 4) >>> 0);
    return 1;
  }
  return 0;
}

/**
 * Checks whether the Act 2 Sewer trap door (`dwQuestId = 0x0B`) is open:
 * returns `1` if quest `0x0B` is missing; else if `byte [pQuestDataEx + 0x18] != 0` or
 * `byte [pQuestDataEx + 0x19] != 0` returns `0`; else returns `word [pQuestDataEx + 0x40] == 2 ? 1 : 0`.
 *
 * @va D2Game.dll@0x6fce1f40
 */
export function ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c(m: Memory113c, pGame: number): number {
  hitD2GameVa113c(0x6FCE1F40);
  const pQuest = findQuestDataByIdInline113c(m, pGame >>> 0, 0x0b);
  if (pQuest === 0) {
    return 1;
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  if (m.u8((pQuestDataEx + 0x18) >>> 0) !== 0) {
    return 0;
  }
  if (m.u8((pQuestDataEx + 0x19) >>> 0) !== 0) {
    return 0;
  }
  return m.u16((pQuestDataEx + 0x40) >>> 0) === 2 ? 1 : 0;
}
