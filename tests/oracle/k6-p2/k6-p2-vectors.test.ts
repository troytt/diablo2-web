/**
 * [K6-P2] Real-DLL D2Common.dll (100.00% = 1,479 / 1,479) + D2Game.dll Branch Fixes & Lo-VA Suite (112 VAs).
 *
 * Replays every real-DLL vector emitted by tools/oracle/k6-p2/k6-p2-emitter.c
 * against the TypeScript v1.13c kernel in src/d2kern-113c/{common,game}/*, verifying 100%
 * bit-exact agreement on return values, Fog.#10024 assertion line numbers, staged arena
 * memory mutations, extra global captures, heap allocations, and va-trace-113c runtime hits.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { mulDiv113c } from '../../../src/d2kern-113c/common/int-math'
import {
  EvalStatWithOps113c,
  getBaseStatWithMinFromList113c,
  getTotalStatWithMinFromList113c,
  STATES_CheckState113c,
  STATES_CheckStateMaskOnUnit113c,
  STATES_ClearGfxStateFlag113c,
  STATLIST_AddFullStatDelta113c,
  STATLIST_FindInsertPos113c,
  STATLIST_FindModStatInsertPos113c,
  STATLIST_FindStatIndex113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_InsertStatSlot113c,
  STATLIST_PropagateDelta113c,
  STATLIST_RecomputeExStat113c,
  STATLIST_RecordModStat113c,
  STATLIST_RemoveStatSlotPtr113c,
  STATLIST_RemoveSubList113c,
  STATLIST_SetStat113c,
  STATLIST_SumDirectAndSubLists113c,
  STATLIST_UnlinkSubList113c,
} from '../../../src/d2kern-113c/common/statlist'
import {
  ROOM_DecrementAlliedCount113c,
  UNIT_Alloc113c,
  UNIT_GetAlignmentMemPort113c,
  UNITROOM_AddUnitToRoom113c,
  UNITROOM_ClearUpdateQueue113c,
  UNITROOM_RefreshUnit113c,
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_GetY113c,
} from '../../../src/d2kern-113c/common/unit'
import { AI_Skeleton113c } from '../../../src/d2kern-113c/game/ai-fallen-113c'
import {
  MONREG_FindOrAllocActRoomNode113c,
  MONREG_UnlinkAndFreeActRoomNode113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-a-113c'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import { DATATBLS_GetItemStatCostRecordFast113c } from '../../../src/d2kern-113c/game/k2-gap-itemdef-113c'
import {
  BITSTREAM_WriteVarUint113c,
  ITEMS_GetUnitAndLeaderMagicFind113c,
  MISSILES_GetTxtRecordFast113c,
  SEED_RollRangeWithMinFast113c,
} from '../../../src/d2kern-113c/game/k2-gap-melee-dot-113c'
import { ITEMS_HasAffixGroupOnItem113c } from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c'
import {
  OBJRGN_PrependObjectCoordNode_6FC2B800_113c,
  PLAYER_GetQuestRecordForDifficulty_6FC21020_113c,
  STATLIST_AddUnitStatGoldGuarded_6FC21670_113c,
  STATLIST_SetUnitStatGoldGuarded_6FC21040_113c,
} from '../../../src/d2kern-113c/game/k2-laneH-0x6fc2-w1-113c'
import {
  AI_ThinkSpecialGuard_6FC39640_113c,
  AI_ThinkTimedExpireOrStall_6FC36410_113c,
  ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c,
  ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c,
  ITEMS_CheckItemTxtSpawnable_6FC2F180_113c,
  ITEMS_CheckUniqueItemAlreadySpawned_6FC2E800_113c,
  ITEMS_DestroyItemEventsAndSubInventory_6FC30700_113c,
  ITEMS_FindQuestItemByBaseCode_6FC2E660_113c,
  ITEMS_RemoveFromInventoryOrCursor_6FC2E1C0_113c,
  ITEMS_SpawnItemWithParams_6FC31980_113c,
  ITEMS_TestUniqueSpawnedBit_6FC2E250_113c,
} from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c'
import {
  ITEMS_ApplyGoldFindBonus_6FC2F260_113c,
  ITEMS_CreateDroppedItemAtUnit_6FC31880_113c,
  ITEMS_DispatchNormalItemModsByFormat_6FC307B0_113c,
  ITEMS_DropMonsterTreasure_6FC32D60_113c,
  ITEMS_FinalizeNormalExpansionItem_6FC30550_113c,
  ITEMS_FindFreeGroundDropCoords_6FC2E930_113c,
  ITEMS_GetDropItemLevel_6FC2E5D0_113c,
  ITEMS_InitItemUnit_6FC30160_113c,
  ITEMS_RollStaffModsOnItem_6FC33DE0_113c,
  ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c,
  ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c,
} from '../../../src/d2kern-113c/game/k2-real-itemdrop-113c'
import {
  AIGENERAL_ExpireMinionListsInAct113c,
  ROOM_RecordMonsterDeath113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ExecuteEvents113c,
} from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c'
import { ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c } from '../../../src/d2kern-113c/game/k2-w12b1-113c'
import { ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c } from '../../../src/d2kern-113c/game/k2-w2b1-113c'
import {
  ITEMS_MarkUniqueItemSpawned_6FC2EDC0_113c,
  ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c,
  ITEMS_RollRarePrefixId_6FC34210_113c,
  ITEMS_RollSpawnableWeaponOrMiscId_6FC2F780_113c,
} from '../../../src/d2kern-113c/game/k2-w3b1-113c'
import { ITEMS_LoadItemAndSocketsFromBitstream_6FC3F9F0_113c } from '../../../src/d2kern-113c/game/k2-w3b2-113c'
import { ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c } from '../../../src/d2kern-113c/game/k2-w4b1-113c'
import { CLIENTS_AppendSaveDataChunk_6FC6A190_113c } from '../../../src/d2kern-113c/game/k2-w4b2-113c'
import { ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c } from '../../../src/d2kern-113c/game/k2-w4b3-113c'
import {
  SKILLS_SrvDo001_JumpOrLeapMissile_6FC2C400_113c,
  SKILLS_SrvDo006_SpawnChargedSkillMissile_6FC2D680_113c,
} from '../../../src/d2kern-113c/game/k2-w5b1-113c'
import { AI_ThinkTyraelOrIzualGhost_6FC39880_113c } from '../../../src/d2kern-113c/game/k2-w6b4-113c'
import { ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c } from '../../../src/d2kern-113c/game/k2-w7b1-113c'
import { UNITS_ChangeAnimMode113c } from '../../../src/d2kern-113c/game/monster-events'
import {
  MONPROP_GetRecordPtrFromClassId113c,
  MONSEQ_GetRecordPtrFromClassId113c,
  MONSTATS_CheckFlagBit113c,
  MONSTATS_GetBaseIdFromClassId113c,
  MONSTATS_GetRecordPtr113c,
  MONSTATS_ValidateClassId113c,
  MONSTATS2_CheckFlagBit113c,
  MONSTATS2_CheckModeBit113c,
  MONSTATS2_GetRecordPtr113c,
  MONSTER_GetBaseIdFromUnit113c,
  MONSTER_SetSpawnRoomCoordNode113c,
  PLAYER_GetParam158_113c,
  PLAYER_GetParam15C_113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollMaskFast113c,
  SEED_RollRangeHalfOpen113c,
  SKILLS_GetRecordPtrFast113c,
  UNIT_CalcSqDistSubtiles113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import {
  AI_CheckReturnHomeToNode10_113c,
  AI_FollowDs1NpcPathMem113c,
  AI_InitHomeNode10_113c,
  AI_MapAiAction1_WalkToWaypoint113c,
  AI_MapAiAction2_WalkAndWait20_113c,
  AI_MapAiAction3_WalkToWaypoint113c,
  AI_MapAiAction4_WalkAndMode8_113c,
  AI_SimpleMapAiNpc113c,
} from '../../../src/d2kern-113c/game/town-npc-ai-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: SparseMemory113c, a: readonly number[]) => unknown

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  // Group 1 — ALL 31 remaining scenario-only D2Common.dll VAs -> 1,479 / 1,479 (100.00%)
  '0x6FD51080': (m, a) => UNITS_GetY113c(m, a[0]!),
  '0x6FD511E0': (_m, a) => mulDiv113c(a[0]!, a[1]!, a[2]!),
  '0x6FD7F370': (m, a) => UNIT_Alloc113c(m, a[1]!, a[0]!),
  '0x6FD83920': (m, a) => UNITS_ChangeAnimMode113c(m, a[0]!, a[1]!),
  '0x6FD83C20': (m, a) => STATES_CheckStateMaskOnUnit113c(m, a[0]!, a[1]!),
  '0x6FD83CD0': (m, a) => STATES_CheckState113c(m, a[0]!, a[1]!),
  '0x6FD84450': (m, a) => STATES_ClearGfxStateFlag113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD88160': (m, a) => STATLIST_FindModStatInsertPos113c(m, a[0]!, a[1]!),
  '0x6FD881A0': (m, a) => STATLIST_RemoveStatSlotPtr113c(m, a[0]!, a[1]!),
  '0x6FD88270': (m, a) => STATLIST_FindInsertPos113c(m, a[0]!, a[1]!),
  '0x6FD882B0': (m, a) => STATLIST_FindStatIndex113c(m, a[0]!, a[1]!),
  '0x6FD88550': (m, a) => STATLIST_RecordModStat113c(m, a[0]!, a[1]!),
  '0x6FD88640': (m, a) => STATLIST_InsertStatSlot113c(m, a[0]!, a[1]!),
  '0x6FD889E0': (m, a) => STATLIST_AddFullStatDelta113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD88A80': (m, a) => getTotalStatWithMinFromList113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD88B00': (m, a) => getBaseStatWithMinFromList113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD88C20': (m, a) => STATLIST_GetUnitBaseStat113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD88CD0': (m, a) => STATLIST_SumDirectAndSubLists113c(m, a[0]!, a[1]!, undefined, a[2]!),
  '0x6FD891F0': (m, a) => UNIT_GetAlignmentMemPort113c(m, a[0]!),
  '0x6FD89530': (m, a) => EvalStatWithOps113c(m, a[0]!, a[1]!),
  '0x6FD89CE0': (m, a) =>
    STATLIST_RecomputeExStat113c(
      m,
      a[0]!,
      (a[1]! >>> 16) & 0xffff,
      a[1]! & 0xffff,
      undefined,
      undefined,
      a[3]!,
    ),
  '0x6FD89F70': (m, a) =>
    STATLIST_PropagateDelta113c(
      m,
      a[0]!,
      (a[1]! >>> 16) & 0xffff,
      a[1]! & 0xffff,
      a[2]!,
      undefined,
      a[3]!,
    ),
  '0x6FD8A280': (m, a) => STATLIST_SetStat113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD8A3B0': (m, a) => STATLIST_RemoveSubList113c(m, a[0]!),
  '0x6FD8A5F0': (m, a) => STATLIST_UnlinkSubList113c(m, a[0]!, a[1]!),
  '0x6FD8AFD0': (m, a) => ROOM_RecordMonsterDeath113c(m, a[0]!, a[1]!),
  '0x6FD8B650': (m, a) => ROOM_DecrementAlliedCount113c(m, a[0]!),
  '0x6FDB63B0': (m, a) => UNITROOM_ClearUpdateQueue113c(m, a[0]!),
  '0x6FDB65C0': (m, a) => UNITROOM_RefreshUnit113c(m, a[0]!),
  '0x6FDB6700': (m, a) => UNITROOM_RemoveUnitFromRoom113c(m, a[0]!),
  '0x6FDB6800': (m, a) => UNITROOM_AddUnitToRoom113c(m, a[0]!, a[1]!, a[2]!),

  // Group 2 — 5 Partial-branch D2Game.dll bug-fix VAs
  '0x6FC6A190': (m, a) =>
    CLIENTS_AppendSaveDataChunk_6FC6A190_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCA3550': (m, a) => AI_Skeleton113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC74810': (m, a) =>
    ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
      a[6]!,
    ),
  '0x6FCFDDE0': (m, a) => SUNITDMG_AllocCombat113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCFED30': (m, a) => SUNITDMG_ExecuteEvents113c(m, a[0]!, a[1]!, a[2]!, 1, 0),

  // Group 3 — 28 D2Game.dll 0x6FC21xxx Lo-VAs
  '0x6FC21020': (m, a) => PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, a[0]!, a[1]!),
  '0x6FC21040': (m, a) => STATLIST_SetUnitStatGoldGuarded_6FC21040_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC210D0': (m, a) => DATATBLS_GetItemStatCostRecordFast113c(m, a[0]!),
  '0x6FC21100': (m, a) => UNIT_GetPosX113c(m, a[0]!),
  '0x6FC21130': (m, a) => UNIT_GetPosY113c(m, a[0]!),
  '0x6FC21220': (m, a) => MONSTATS_GetRecordPtr113c(m, a[0]!),
  '0x6FC21250': (m, a) => MISSILES_GetTxtRecordFast113c(m, a[0]!),
  '0x6FC21280': (m, a) => ROOM_FindRoomContainingSubtile113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC21320': (m, a) => MONSTATS2_GetRecordPtr113c(m, a[0]!),
  '0x6FC21390': (m, a) => MONSTER_SetSpawnRoomCoordNode113c(m, a[0]!, a[1]!),
  '0x6FC213B0': (m, a) => MONSTATS2_CheckFlagBit113c(m, a[0]!, a[1]!),
  '0x6FC21420': (m, a) => SKILLS_GetRecordPtrFast113c(m, a[0]!),
  '0x6FC21450': (m, a) => SEED_RollMaskFast113c(m, a[0]!, a[1]!),
  '0x6FC21480': (m, a) => SEED_RollRangeWithMinFast113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC214D0': (_m, a) => mulDiv113c(a[0]!, a[1]!, a[2]!),
  '0x6FC21560': (m, a) => MONSTATS2_CheckModeBit113c(m, a[0]!, a[1]!),
  '0x6FC215D0': (m, a) => MONSTATS_CheckFlagBit113c(m, a[0]!, a[1]!),
  '0x6FC21670': (m, a) => STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC21780': (m, a) => SEED_RollRangeHalfOpen113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC21850': (m, a) => MONSTATS_ValidateClassId113c(m, a[0]!),
  '0x6FC21870': (m, a) => MONSTATS_GetBaseIdFromClassId113c(m, a[0]!),
  '0x6FC218A0': (m, a) => MONSTER_GetBaseIdFromUnit113c(m, a[0]!),
  '0x6FC21900': (m, a) => UNIT_CalcSqDistSubtiles113c(m, a[0]!, a[1]!),
  '0x6FC219F0': (m, a) => MONPROP_GetRecordPtrFromClassId113c(m, a[0]!),
  '0x6FC21C80': (m, a) => MONSEQ_GetRecordPtrFromClassId113c(m, a[0]!),
  '0x6FC21CD0': (m, a) => BITSTREAM_WriteVarUint113c(m, a[0]!, a[1]!),
  '0x6FC21D90': (m, a) => PLAYER_GetParam158_113c(m, a[0]!),
  '0x6FC21DB0': (m, a) => PLAYER_GetParam15C_113c(m, a[0]!),

  // Group 4 — 48 D2Game.dll 0x6FC2Bxxx..0x6FC3Fxxx Lo-VAs
  '0x6FC2B800': (m, a) => OBJRGN_PrependObjectCoordNode_6FC2B800_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC2C400': (m, a) =>
    SKILLS_SrvDo001_JumpOrLeapMissile_6FC2C400_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC2D680': (m, a) =>
    SKILLS_SrvDo006_SpawnChargedSkillMissile_6FC2D680_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC2E0A0': (m, a) => ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c(m, a[0]!, a[1]!),
  '0x6FC2E1C0': (m, a) => ITEMS_RemoveFromInventoryOrCursor_6FC2E1C0_113c(m, a[0]!, a[1]!),
  '0x6FC2E250': (m, a) => ITEMS_TestUniqueSpawnedBit_6FC2E250_113c(m, a[0]!, a[1]!),
  '0x6FC2E5D0': (m, a) => ITEMS_GetDropItemLevel_6FC2E5D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC2E660': (m, a) => ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC2E7E0': (m, a) => ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c(m, a[0]!, a[1]!),
  '0x6FC2E800': (m, a) => ITEMS_CheckUniqueItemAlreadySpawned_6FC2E800_113c(m, a[0]!, a[1]!),
  '0x6FC2E930': (m, a) =>
    ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC2E990': (m, a) =>
    ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC2EA10': (m, a) => ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c(m, a[0]!, a[1]!),
  '0x6FC2EA70': (m, a) => ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c(m, a[0]!, a[1]!),
  '0x6FC2EAE0': (m, a) =>
    ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
      a[6]!,
      a[7]!,
    ),
  '0x6FC2EDC0': (m, a) => ITEMS_MarkUniqueItemSpawned_6FC2EDC0_113c(m, a[0]!, a[1]!),
  '0x6FC2F180': (m, a) =>
    ITEMS_CheckItemTxtSpawnable_6FC2F180_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC2F260': (m, a) => ITEMS_ApplyGoldFindBonus_6FC2F260_113c(m, a[0]!, a[1]!),
  '0x6FC2F2F0': (m, a) => ITEMS_GetUnitAndLeaderMagicFind113c(m, a[0]!),
  '0x6FC2F780': (m, a) =>
    ITEMS_RollSpawnableWeaponOrMiscId_6FC2F780_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC30160': (m, a) => ITEMS_InitItemUnit_6FC30160_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC30550': (m, a) => ITEMS_FinalizeNormalExpansionItem_6FC30550_113c(m, a[0]!, a[1]!),
  '0x6FC30700': (m, a) => ITEMS_DestroyItemEventsAndSubInventory_6FC30700_113c(m, a[0]!, a[1]!),
  '0x6FC307B0': (m, a) =>
    ITEMS_DispatchNormalItemModsByFormat_6FC307B0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC307E0': (m, a) => ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC31880': (m, a) =>
    ITEMS_CreateDroppedItemAtUnit_6FC31880_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC31980': (m, a) =>
    ITEMS_SpawnItemWithParams_6FC31980_113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
      a[6]!,
      a[7]!,
      a[8]!,
      a[9]!,
      a[10]!,
    ),
  '0x6FC31CA0': (m, a) =>
    ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
    ),
  '0x6FC32D60': (m, a) =>
    ITEMS_DropMonsterTreasure_6FC32D60_113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
      a[6]!,
      a[7]!,
      a[8]!,
      a[9]!,
    ),
  '0x6FC32DF0': (m, a) => ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC331E0': (m, a) => ITEMS_HasAffixGroupOnItem113c(m, a[0]!, a[1]!),
  '0x6FC33DE0': (m, a) => ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, a[0]!, a[1]!),
  '0x6FC34210': (m, a) => ITEMS_RollRarePrefixId_6FC34210_113c(m, a[0]!, a[1]!),
  '0x6FC35D10': (m, a) => AI_InitHomeNode10_113c(m, a[0]!, a[1]!),
  '0x6FC36410': (m, a) => AI_ThinkTimedExpireOrStall_6FC36410_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC36610': (m, a) => AI_CheckReturnHomeToNode10_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC36970': (m, a) => AI_MapAiAction1_WalkToWaypoint113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC39640': (m, a) => AI_ThinkSpecialGuard_6FC39640_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC39880': (m, a) => AI_ThinkTyraelOrIzualGhost_6FC39880_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC39AD0': (m, a) => AI_MapAiAction4_WalkAndMode8_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC39BA0': (m, a) => AI_MapAiAction3_WalkToWaypoint113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC39BB0': (m, a) => AI_MapAiAction2_WalkAndWait20_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3BBC0': (m, a) => AI_FollowDs1NpcPathMem113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3BC60': (m, a) => AI_SimpleMapAiNpc113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3E960': (m, a) =>
    MONREG_FindOrAllocActRoomNode113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC3EA40': (m, a) =>
    MONREG_UnlinkAndFreeActRoomNode113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC3EB20': (m, a) => AIGENERAL_ExpireMinionListsInAct113c(m, a[0]!, a[1]!),
  '0x6FC3F9F0': (m, a) =>
    ITEMS_LoadItemAndSocketsFromBitstream_6FC3F9F0_113c(m, a[0]!, a[1]!, a[2]!),
}

interface MemRunRecord {
  addr: string
  hex: string
}

interface ExtraCapRecord {
  addr: string
  len: number
}

interface K6P2VectorRecord {
  va: string
  name: string
  caseIdx: number
  label: string
  tsArgs: number[]
  extraCaps: ExtraCapRecord[]
  retMask: string
  asserted: boolean
  assertLine: number
  ret: string
  setupTop: string
  preMem: MemRunRecord[]
  postMem: MemRunRecord[]
  heapTop: string
  heapHex: string
}

const D2COM_PREF_BASE = 0x6fd50000
const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0x00009000
const STAGE_CS_GAME = 0x30010000
const STAGE_SETUP_BASE = 0x30020000
const HEAP_BASE = 0x40000000
const PAGE_BITS = 12
const PAGE_SIZE = 1 << PAGE_BITS

class CoWSparseMemory113c extends SparseMemory113c {
  private readonly basePages = new Map<number, Uint8Array>()
  private readonly baseKnown = new Map<number, Uint8Array>()
  private readonly overlayPages = new Map<number, Uint8Array>()
  private readonly overlayKnown = new Map<number, Uint8Array>()
  private heapCursor = HEAP_BASE

  commitOverlayToBase(): void {
    for (const [pg, data] of this.overlayPages.entries()) {
      this.basePages.set(pg, data)
      this.baseKnown.set(pg, this.overlayKnown.get(pg)!)
    }
    this.overlayPages.clear()
    this.overlayKnown.clear()
    this.heapCursor = HEAP_BASE
  }

  resetOverlay(): void {
    this.overlayPages.clear()
    this.overlayKnown.clear()
    this.heapCursor = HEAP_BASE
  }

  getHeapTop(): number {
    return this.heapCursor >>> 0
  }

  override alloc(size: number): number {
    const effSize = size === 0 ? 4 : size
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    if (p > this.heapCursor) {
      this.fill(this.heapCursor, p - this.heapCursor, 0)
    }
    this.fill(p, effSize, 0)
    this.heapCursor = (p + effSize) >>> 0
    return p
  }

  override loadBlock(addr: number, data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.setU8((addr + i) >>> 0, data[i]!)
    }
  }

  override readBytes(addr: number, len: number): Uint8Array {
    const out = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      out[i] = this.u8((addr + i) >>> 0)
    }
    return out
  }

  override u8(p: number): number {
    const addr = p >>> 0
    const pg = addr >>> PAGE_BITS
    const off = addr & (PAGE_SIZE - 1)
    const ok = this.overlayKnown.get(pg)
    if (ok !== undefined && ok[off] !== 0) {
      return this.overlayPages.get(pg)![off]!
    }
    const bk = this.baseKnown.get(pg)
    if (bk !== undefined && bk[off] !== 0) {
      return this.basePages.get(pg)![off]!
    }
    throw new Error(`CoWSparseMemory113c: read of unloaded byte 0x${addr.toString(16)}`)
  }

  override u16(p: number): number {
    return this.u8(p) | (this.u8((p + 1) >>> 0) << 8)
  }

  override u32(p: number): number {
    return (this.u16(p) | (this.u16((p + 2) >>> 0) << 16)) >>> 0
  }

  override setU8(p: number, v: number): void {
    const addr = p >>> 0
    const pg = addr >>> PAGE_BITS
    const off = addr & (PAGE_SIZE - 1)
    let od = this.overlayPages.get(pg)
    let ok = this.overlayKnown.get(pg)
    if (od === undefined || ok === undefined) {
      const bd = this.basePages.get(pg)
      const bk = this.baseKnown.get(pg)
      od = bd !== undefined ? bd.slice() : new Uint8Array(PAGE_SIZE)
      ok = bk !== undefined ? bk.slice() : new Uint8Array(PAGE_SIZE)
      this.overlayPages.set(pg, od)
      this.overlayKnown.set(pg, ok)
    }
    od[off] = v & 0xff
    ok[off] = 1
  }

  override setU16(p: number, v: number): void {
    this.setU8(p, v & 0xff)
    this.setU8((p + 1) >>> 0, (v >>> 8) & 0xff)
  }

  override setU32(p: number, v: number): void {
    this.setU16(p, v & 0xffff)
    this.setU16((p + 2) >>> 0, (v >>> 16) & 0xffff)
  }

  override fill(p: number, len: number, v: number): void {
    const byte = v & 0xff
    for (let i = 0; i < len; i++) {
      this.setU8((p + i) >>> 0, byte)
    }
  }

  override get(base: number, f: FieldLayout113c, index = 0): number {
    if (base === 0) throw new Error('CoWSparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) {
      throw new Error(`CoWSparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    }
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = (base + f.off + index * width) >>> 0
    return width === 1 ? this.u8(p) : width === 2 ? this.u16(p) : this.u32(p)
  }

  override set(base: number, f: FieldLayout113c, v: number, index = 0): void {
    if (base === 0) throw new Error('CoWSparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) {
      throw new Error(`CoWSparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    }
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = (base + f.off + index * width) >>> 0
    if (width === 1) this.setU8(p, v)
    else if (width === 2) this.setU16(p, v)
    else this.setU32(p, v)
  }
}

const HEX_CHARS = '0123456789abcdef'

function hexToBytes(hex: string): Uint8Array {
  const n = hex.length >>> 1
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!
    out += HEX_CHARS[(b >>> 4) & 0x0f]! + HEX_CHARS[b & 0x0f]!
  }
  return out
}

function extractMemRunsRange(
  mem: CoWSparseMemory113c,
  startAddr: number,
  endAddr: number,
  out: MemRunRecord[],
): void {
  let a = startAddr >>> 0
  const end = endAddr >>> 0
  while (a < end) {
    const chunkEnd = a + 16 <= end ? a + 16 : end
    let nz = false
    for (let k = a; k < chunkEnd; k++) {
      if (mem.u8(k) !== 0) {
        nz = true
        break
      }
    }
    if (!nz) {
      a = chunkEnd
      continue
    }
    const runStart = a
    let runEnd = chunkEnd
    while (runEnd < end && runEnd - runStart < 512) {
      const nextEnd = runEnd + 16 <= end ? runEnd + 16 : end
      let nextNz = false
      for (let k = runEnd; k < nextEnd; k++) {
        if (mem.u8(k) !== 0) {
          nextNz = true
          break
        }
      }
      if (!nextNz) break
      runEnd = nextEnd
    }
    const addrHex = `0x${runStart.toString(16).toUpperCase().padStart(8, '0')}`
    const hex = bytesToHex(mem.readBytes(runStart, runEnd - runStart))
    out.push({ addr: addrHex, hex })
    a = runEnd
  }
}

function extractStageRuns(
  mem: CoWSparseMemory113c,
  setupTop: number,
  extraCaps: readonly ExtraCapRecord[],
): MemRunRecord[] {
  const out: MemRunRecord[] = []
  extractMemRunsRange(mem, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, out)
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  for (const cap of extraCaps) {
    const start = Number.parseInt(cap.addr, 16) >>> 0
    extractMemRunsRange(mem, start, (start + cap.len) >>> 0, out)
  }
  return out
}

function loadVectors(): K6P2VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-p2/k6-p2-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6P2VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6P2VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6-P2] Real-DLL D2Common 100.00% Closer + D2Game Branch Fixes & Lo-VAs (112 VAs)', () => {
  let mem: CoWSparseMemory113c

  beforeAll(() => {
    const imgPath = resolve(
      import.meta.dirname,
      '../../fixtures/oracle/k1/d2game-datatbls-113c.img.gz',
    )
    const raw = gunzipSync(readFileSync(imgPath))
    const hdr = parseVectorHeader(raw)
    expect(hdr.kind).toBe('PAGEIMG')
    expect(hdr.recordSize).toBe(4100)

    mem = new CoWSparseMemory113c()
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    let off = 32
    for (let i = 0; i < hdr.recordCount; i++) {
      const va = view.getUint32(off, true) >>> 0
      mem.loadBlock(va, raw.subarray(off + 4, off + 4 + 4096))
      off += 4100
    }
    bindK2KernelGlobals113c(mem)
    // Hydrate SGPT_ITEMS_LINKER_PTR_VA (0x6FDEFF6C) from loaded Items.txt rows
    const nItems = mem.u32(0x6fdefb94) >>> 0
    const pItems = mem.u32(0x6fdefb98) >>> 0
    if (nItems > 0 && nItems < 4096 && pItems !== 0) {
      const nodes: Array<{ code: number; row: number }> = []
      for (let r = 0; r < nItems; r++) {
        const code = mem.u32((pItems + r * 0x1a8 + 0x80) >>> 0) >>> 0
        nodes.push({ code, row: r })
      }
      nodes.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.row - b.row))
      const hdrVa = 0x20fe0000
      const nodesVa = 0x20fe0010
      mem.setU32(hdrVa, nItems)
      mem.setU32((hdrVa + 4) >>> 0, 0)
      mem.setU32((hdrVa + 8) >>> 0, nodesVa)
      for (let i = 0; i < nodes.length; i++) {
        mem.setU32((nodesVa + i * 8) >>> 0, nodes[i]!.code)
        mem.setU32((nodesVa + i * 8 + 4) >>> 0, nodes[i]!.row >>> 0)
      }
      mem.setU32(0x6fdeff6c, hdrVa)
    }
    mem.fill(STAGE_BASE, STAGE_FIXED_SIZE, 0)
    mem.fill(STAGE_CS_GAME, 0x20, 0)
    mem.fill(0x28000000, 0x10, 0)
    mem.setU32(0x28000004, 1)
    // Initialize known-zero D2Game global regions referenced by save/combat/AI paths
    mem.fill(0x6fd18d10, 4, 0)
    mem.fill(0x6fd2d8bc, 4, 0)
    mem.fill(0x6fd30398, 0x20, 0)
    mem.fill(0x6fd303b8, 0x800, 0)
    mem.fill(0x6fd30c04, 0x1008, 0)
    mem.fill(0x6fd31c0c, 0x40, 0)
    mem.fill(0x6fd31f80, 0x20, 0)
    mem.commitOverlayToBase()
  })

  it('covers all 112 target real-DLL VAs (31 D2Common + 81 D2Game, >= 3 cases each)', () => {
    expect(VECTORS_BY_VA.size).toBe(112)
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(VECTORS_BY_VA.size * 3)
    let d2CommonCount = 0
    let d2GameCount = 0
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      if (num >= D2COM_PREF_BASE) {
        d2CommonCount++
      } else {
        d2GameCount++
      }
      expect(cases.length).toBeGreaterThanOrEqual(3)
      expect(DISPATCH_BY_VA[va]).toBeTypeOf('function')
    }
    expect(d2CommonCount).toBe(31)
    expect(d2GameCount).toBe(81)
  })

  for (const [va, cases] of VECTORS_BY_VA.entries()) {
    const fnName = cases[0]!.name
    const vaNum = Number.parseInt(va, 16) >>> 0
    const modPrefix = vaNum >= D2COM_PREF_BASE ? 'D2Common' : 'D2Game'

    it(`${va} ${fnName} (${cases.length} real-DLL cases)`, () => {
      const fn = DISPATCH_BY_VA[va]
      expect(fn).toBeDefined()

      for (const vec of cases) {
        mem.resetOverlay()
        const setupTop = Number.parseInt(vec.setupTop, 16) >>> 0
        if (setupTop > STAGE_SETUP_BASE) {
          mem.fill(STAGE_SETUP_BASE, setupTop - STAGE_SETUP_BASE, 0)
        }
        for (const cap of vec.extraCaps) {
          const capStart = Number.parseInt(cap.addr, 16) >>> 0
          mem.fill(capStart, cap.len, 0)
        }
        for (const blk of vec.preMem) {
          const addr = Number.parseInt(blk.addr, 16) >>> 0
          mem.loadBlock(addr, hexToBytes(blk.hex))
        }

        beginVaTrace113c()
        let retVal: unknown = 0
        let caughtErr: unknown = null
        try {
          retVal = fn!(mem, vec.tsArgs)
        } catch (err) {
          caughtErr = err
        }
        const hits = endVaTrace113c()
        expect(
          hits.has(`${modPrefix}:${va}`),
          `${va} case ${vec.caseIdx} (${vec.label}) missing va-trace hit ${modPrefix}:${va}`,
        ).toBe(true)

        if (vec.asserted) {
          expect(
            caughtErr,
            `${va} case ${vec.caseIdx} (${vec.label}) expected D2CommonAssertError(${vec.assertLine})`,
          ).toBeInstanceOf(D2CommonAssertError)
          expect((caughtErr as D2CommonAssertError).line).toBe(vec.assertLine)
          continue
        }

        if (caughtErr !== null) {
          throw new Error(
            `${va} case ${vec.caseIdx} (${vec.label}) threw unexpected error: ${String(caughtErr)}`,
          )
        }

        const retMask = Number.parseInt(vec.retMask, 16) >>> 0
        if (retMask !== 0) {
          const actualMasked = ((Number(retVal) | 0) & retMask) >>> 0
          const expectedMasked = Number.parseInt(vec.ret, 16) >>> 0
          expect(
            actualMasked,
            `${va} case ${vec.caseIdx} (${vec.label}) return mismatch: got 0x${actualMasked.toString(16)} expected 0x${expectedMasked.toString(16)}`,
          ).toBe(expectedMasked)
        }

        const actualPostMem = extractStageRuns(mem, setupTop, vec.extraCaps)
        expect(
          actualPostMem,
          `${va} case ${vec.caseIdx} (${vec.label}) staged arena memory mismatch`,
        ).toEqual(vec.postMem)

        if (vec.heapHex.length > 0) {
          const expectedHeapTop = Number.parseInt(vec.heapTop, 16) >>> 0
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) heapTop mismatch`,
          ).toBe(expectedHeapTop)
          const rawHeapBytes = mem.readBytes(HEAP_BASE, expectedHeapTop - HEAP_BASE)
          const actualHeapHex = bytesToHex(rawHeapBytes)
          expect(
            actualHeapHex,
            `${va} case ${vec.caseIdx} (${vec.label}) heap contents mismatch`,
          ).toBe(vec.heapHex)
        } else {
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) unexpected heap allocation (expected zero heap drift)`,
          ).toBe(HEAP_BASE)
        }
      }
    })
  }
})
