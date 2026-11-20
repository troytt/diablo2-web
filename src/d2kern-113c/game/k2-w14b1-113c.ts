/**
 * D2Game.dll 1.13c — [K2] Wave 14 Batch 1 (w14b1).
 *
 * Clean-room 1:1 binary-isomorphic port of 44 D2Game.dll v1.13c functions in
 * the 0x6FC3E900..0x6FD09C80 address range.
 */

import { COLLISION_FindFreePositionBasic113c } from '../common/collision'
import { UNITS_GetPlayerData113c } from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import {
  DATATBLS_GetCubemainTxtRecord113c,
  DATATBLS_GetCubemainTxtRecordCount113c,
} from '../common/drlg/drlg-ver'
import { PATH_CheckFlag08_113c } from '../common/drlg/room-tile'
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_SyncActiveRoomStatusChange113c,
  DUNGEON_UpdateRoomLevelChange113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32, mulDiv113c } from '../common/int-math'
import {
  INVENTORY_CanTradeInventoriesSwap113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_SetCursorItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_GetAllowedBodyLocations113c,
  ITEMS_GetInvPage113c,
  ITEMS_GetTotalMaxStack113c,
  ITEMS_IsThrowableBit113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../common/items'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
} from '../common/k0-d2common-memports'
import {
  MISSILE_GetLevel113c,
  MISSILE_GetSkill113c,
  MISSILE_GetTargetX113c,
  MISSILE_GetTargetY113c,
  MISSILE_SetTargetX113c,
  MISSILE_SetTargetY113c,
  MONSTERS_GetHirelingTypeId113c,
} from '../common/missile'
import {
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
} from '../common/path'
import {
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_ClearQuestStateBits2To11_113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_IsSelectableCorpseWithVelocity113c,
  STATES_UpdateOrClearState98Transform113c,
} from '../common/skills'
import {
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitGoldBankLimit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatBonus113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNIT_GetAlignment113c,
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_GetRoom113c,
  UNITS_GetSpawnedMonsterOrSkillSummonInfo113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
} from '../common/unit'
import type { SparseMemory113c } from '../mem/sparse-memory'
import {
  DATATBLS_GetItemsTxtRecordByCode113c,
  DATATBLS_GetMaxLevel113c,
} from '../tables/datatbls-113c'
import { QUESTS_GuidListRemove113c } from './a1c-post150-f150-f276-113c'
import {
  AIGENERAL_GetPackLeaderUnit113c,
  AIGENERAL_LinkMinionToLeader113c,
  MONSTER_InitModeChangeStrc113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c'
import { D2GAME_ARENA_FindPlayerSlotByUnit113c } from './boot-init-gap-b-113c'
import { MONSTER_StartMode113c } from './combat-a1c-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import {
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c,
  ITEMS_HasSocketedSubItems113c,
  PLRTRADE_CanModifyBeltDuringTrade113c,
  PLRTRADE_CountCubePageItemsInInventory113c,
  PLRTRADE_IsInteractingWithValidPlayer113c,
} from './k2-combat-core-w1-113c'
import { DATATBLS_GetItemStatCostRecordFast113c } from './k2-gap-itemdef-113c'
import {
  MISSILE_CreateServerProjectile113c,
  MISSILE_SrvDo01_LinearProjectile113c,
} from './k2-gap-melee-dot-113c'
import {
  PLAYER_IsBusyWithCursorOrNpcInteract113c,
  QUESTS_AddNpcDialogTextNodes113c,
  QUESTS_GuidListAdd113c,
  QUESTS_GuidListContains113c,
  QUESTS_HasPlayerGuidInQuest113c,
  QUESTS_SendPlayerQuestLogPacket28_113c,
  QUESTS_SendQuestItemState2_5D_113c,
} from './k2-items-tc-w1-113c'
import {
  MONSTER_GetAiGeneralPtr_6FC218E0_113c,
  SKILLS_EvalLinearParam12_6FC21B10_113c,
  SKILLS_EvalLinearParam56_6FC21A90_113c,
  STATLIST_AddUnitStatGoldGuarded_6FC21670_113c,
} from './k2-laneH-0x6fc2-w1-113c'
import {
  ITEMS_FindQuestItemByBaseCode_6FC2E660_113c,
  MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c,
} from './k2-laneI-0x6fc3-w1-113c'
import {
  ITEMS_FindFreeGroundDropCoords_6FC2E930_113c,
  ITEMS_GetDropItemLevel_6FC2E5D0_113c,
} from './k2-real-itemdrop-113c'
import { SUNITDMG_GetPlayerClientClassId113c } from './k2-real-s2c-combat-113c'
import {
  type PetMoveActionOps113c,
  SKILLS_PostInitSummonedPetStatsAndAi_6FC70070_113c,
} from './k2-w11b1-113c'
import {
  D2Game_6FC3E3D0_113c,
  D2Game_6FC3E640_113c,
  D2Game_6FC56470_113c,
  D2Game_6FC565E0_113c,
  D2Game_6FC8E930_113c,
  D2Game_6FC91E10_113c,
  D2Game_6FC92220_113c,
  D2Game_6FC93AA0_113c,
  D2Game_6FC93BA0_113c,
  D2Game_6FC98D00_113c,
  D2Game_6FCC3610_113c,
  D2Game_6FCCA710_113c,
  D2Game_6FCCAC30_113c,
  D2Game_6FCDE2A0_113c,
  D2Game_6FCDE640_113c,
  D2Game_6FCDEE30_113c,
  D2Game_6FCDF990_113c,
  D2Game_6FCE1030_113c,
  D2Game_6FCE1510_113c,
  D2Game_6FCEF810_113c,
  D2Game_6FCF7300_113c,
  D2Game_6FCF78C0_113c,
  D2Game_6FCF7CC0_113c,
  D2Game_6FCF8020_113c,
  D2Game_6FCF8600_113c,
} from './k2-w13b1-113c'
import {
  CLIENT_BroadcastPlayerLeftPacket5C_6FC4BED0_113c,
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
  QUESTS_CheckGlobalQuestState_6FC538D0_113c,
  QUESTS_GetQuestData_6FC53F30_113c,
  QUESTS_GetQuestSeedPtr_6FC53D90_113c,
  QUESTS_SetGlobalQuestState_6FC53920_113c,
} from './k2-laneJ-0x6fc4-w1-113c'
import { QUESTS_RefreshInventoryQuestItems_6FC54760_113c } from './k2-laneK-0x6fc5-w1-113c'
import {
  CLIENTS_FindClientByIdInGame_6FC69FE0_113c,
  SKILLS_ApplyPaladinEighthMaxLifeCost_6FC6F450_113c,
  SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c,
  SKILLS_ApplySummonResistStatList_6FC6E180_113c,
  SKILLS_SrvSt20_CanCreateIronGolemOnItem_6FC6EDD0_113c,
} from './k2-laneL-0x6fc6-w1-113c'
import { ACT5Q3_SyncPrisonOfIceQuestStateCallback_6FC78110_113c } from './k2-laneM-0x6fc7-w1-113c'
import { SUNIT_GetOwnerUnit113c } from './k2-sunit-spawn-w1-113c'
import {
  PLAYERSAVE_SaveClientAndAllOtherPlayers_6FC4C910_113c,
  SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c,
} from './k2-w10b1-113c'
import { MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c } from './k2-w2b1-113c'
import { ACT1Q5_GrantImbueRewardIfLevel8Callback_6FC81D40_113c } from './k2-w2b2-113c'
import {
  NET_SendPacket61_ByteParam_6FCAAAC0_113c,
  NET_SendPacket77_ButtonAction_6FCAB340_113c,
  NET_SendPacketBuffer6B_6FCAACD0_113c,
} from './k2-w2b3-113c'
import { CLIENT_RemoveClientFromAdjacentRooms_6FCBD550_113c } from './k2-w2b4-113c'
import { SKILLS_ResolveSummonMonsterId_6FCBEE50_113c } from './k2-w2b5-113c'
import { ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c } from './k2-w3b1-113c'
import {
  ACT4Q3_ActivateHarrogathWaypointForPlayer_6FCD9030_113c,
  NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c,
} from './k2-w2b6-113c'
import {
  QUESTS_ApplyActNpcIntroFlags_6FC55C20_113c,
  QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c,
} from './k2-w3b3-113c'
import {
  CLIENTS_BuildPlayerPortraitDescString_6FC6AE90_113c,
  SKILLS_InitNecroSkeletonPetComponents_6FC6EB50_113c,
} from './k2-w3b4-113c'
import {
  ACT5Q1_SeqFilter_6FC76D10_113c,
  ACT5Q2_SyncPlayerQuestStateWithQuest20_6FC78530_113c,
  ACT5Q3_TryUseThawPotionOnFrozenAnya_6FC7DDF0_113c,
  ACT5Q4_SeqFilter_6FC76B10_113c,
  ACT5Q5_SeqFilter_6FC76BD0_113c,
  ACT5Q6_SeqFilter_6FC767A0_113c,
} from './k2-w3b5-113c'
import {
  ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c,
  QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c,
  QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c,
} from './k2-w3b6-113c'
import {
  PLAYER_ClearCursorItemAndNotify42_6FC97D90_113c,
  PLAYER_FreePlayerDataField5CList_6FC900C0_113c,
} from './k2-w3b7-113c'
import {
  ACT5Q3_CleanupFrozenAnyaAndTownNpcState_6FC7EC30_113c,
  ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c,
} from './k2-w4b2-113c'
import {
  ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c,
  CUBE_ValidateAllRecipeInputSlots_6FC90CF0_113c,
  ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c,
  PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c,
} from './k2-w4b3-113c'
import {
  NPCS_UpdateTownVendorSlotsOnPlayerLeave_6FCB0560_113c,
  PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c,
  SKILLS_ApplyMonsterSkillBuffAndUMod_6FCB1660_113c,
} from './k2-w4b5-113c'
import { SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c } from './k2-w4b6-113c'
import { ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c } from './k2-w4b8-113c'
import { PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c } from './k2-w5b1-113c'
import {
  ACT2Q1_SeqFilter_6FCE24A0_113c,
  ACT2Q3_SeqFilter_6FCE21E0_113c,
} from './k2-w5b4-113c'
import {
  C2S_ValidateCursorItem_6FCECF70_113c,
  C2S_ValidateStoredItem_6FCECF00_113c,
  C2S_ValidateWaypointInteraction_6FCECB50_113c,
} from './k2-w5b6-113c'
import {
  QUESTS_ChainStatusFilterNotState5_6FD02F00_113c,
  QUESTS_ChainStatusFilterNotState7_6FD02A40_113c,
  QUESTS_ChainStatusFilterOrQuest17_6FD02B70_113c,
  QUESTS_ChainStatusFilterPromoteState1A_6FD02D40_113c,
  QUESTS_ChainStatusFilterPromoteState1B_6FD02E80_113c,
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c,
} from './k2-w5b7-113c'
import { ACT3Q7_ActivateMephistoBridgeAndPortal_6FD05A60_113c } from './k2-w5b8-113c'
import {
  SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c,
  SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c,
} from './k2-w5b9-113c'
import { NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c } from './k2-w6b2-113c'
import { NET_BroadcastSystemChatMessage_6FCEBE70_113c } from './k2-w6b3-113c'
import { ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c } from './k2-w6b4-113c'
import { C2S_ValidateItemInteractionByAnimMode_6FCED6D0_113c } from './k2-w6b5-113c'
import { ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c } from './k2-w6b6-113c'
import {
  ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c,
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c,
} from './k2-w7b1-113c'
import {
  ACT1Q2_ActivateOrChainQuest_6FC84E10_113c,
  ACT1Q3_ActivateOrChainQuest_6FC84AA0_113c,
  ACT1Q3_ActivateQuestState1_6FC83D20_113c,
  ACT1Q4_ActivateOrChainQuest_6FC846D0_113c,
  CUBE_CanPlayerPickupAllCubeItems_6FC91170_113c,
} from './k2-w7b2-113c'
import {
  ACT2Q3_SeqCallback_6FCE6390_113c,
  ACT2Q5_SeqCallback_6FCE69D0_113c,
  ACT4Q1_SeqCallback_6FCDA270_113c,
  ACT4Q3_SeqCallback_6FCDA4F0_113c,
  PETS_FreePlayerPetTable_6FCB7640_113c,
} from './k2-w7b3-113c'
import {
  ACT3Q7_OnOrmusNpcActivateFilter_6FD07050_113c,
  ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c,
} from './k2-w7b4-113c'
import {
  ACT1Q1_SequenceFilter_6FC85410_113c,
  QUESTS_DefaultSequenceFilter_6FC7AFB0_113c,
} from './k2-w8b1-113c'
import { PARTY_LeavePartyForPlayer_6FCBC840_113c } from './k2-w8b2-113c'
import { UNITS_ChangeAnimMode113c } from './monster-events'
import {
  MONSTER_AddSkillToUnit113c,
  MONSTER_EquipMonEquipItems113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollRangeHalfOpen113c,
  SKILLS_GetRecordPtrFast113c,
  SUNIT_SetMonsterAlignmentState113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import { CLIENTS_GetPlayerUnit113c, SUNIT_FreeUnit113c } from './replay-final11-113c'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c } from './timer-wheel'
import { hitD2GameVa113c } from '../va-trace-113c'

function QUESTRECORD_GetQuestState113c(...args: Parameters<typeof DRLGWARP_TestRoomTileBit113c>): ReturnType<typeof DRLGWARP_TestRoomTileBit113c> {
  return DRLGWARP_TestRoomTileBit113c(...args)
}

function FOG_FreeClientMemory113c(
  _m: SparseMemory113c,
  _pMemPool: number,
  _ptr: number,
  _file: number,
  _line: number,
  _zero: number,
): void {}

const K2_W14B1_STACK_BASE = 0x00fa0000
let k2W14B1StackPtr = K2_W14B1_STACK_BASE

function allocW14B1Stack(m: SparseMemory113c, size: number): number {
  const aligned = (size + 15) & ~15
  const base = k2W14B1StackPtr >>> 0
  k2W14B1StackPtr = (base + aligned) >>> 0
  for (let off = 0; off < aligned; off += 4) {
    m.setU32((base + off) >>> 0, 0)
  }
  return base
}

function freeW14B1Stack(base: number): void {
  k2W14B1StackPtr = base >>> 0
}

function advanceSeed64_113c(m: SparseMemory113c, pSeed: number): number {
  const lo = BigInt(m.u32(pSeed >>> 0))
  const hi = BigInt(m.u32((pSeed + 4) >>> 0))
  const prod = lo * 0x6ac690c5n + hi
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32(pSeed >>> 0, newLo)
  m.setU32((pSeed + 4) >>> 0, newHi)
  return newLo
}

export function dispatchQuestSeqFilterF0_113c(
  m: SparseMemory113c,
  pQuest: number,
  onQuestCallbackF0?: (m: SparseMemory113c, pQuestData: number) => void,
): number {
  if (onQuestCallbackF0 !== undefined) {
    onQuestCallbackF0(m, pQuest)
    return 1
  }
  const fnVa = m.u32((pQuest + 0xf0) >>> 0) >>> 0
  switch (fnVa) {
    case 0x6fc767a0:
      return ACT5Q6_SeqFilter_6FC767A0_113c(m, pQuest) & 0xff
    case 0x6fc76b10:
      return ACT5Q4_SeqFilter_6FC76B10_113c(m, pQuest) & 0xff
    case 0x6fc76bd0:
      return ACT5Q5_SeqFilter_6FC76BD0_113c(m, pQuest) & 0xff
    case 0x6fc76d10:
      return ACT5Q1_SeqFilter_6FC76D10_113c(m, pQuest) & 0xff
    case 0x6fc79930:
      ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c(m, pQuest)
      return 1
    case 0x6fc7afb0:
      return QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(m, pQuest) & 0xff
    case 0x6fc801b0:
      return (
        QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c(m, pQuest, {
          onChainQuestRefresh: (mem, pNext) =>
            dispatchQuestSeqFilterF0_113c(mem as SparseMemory113c, pNext),
        }) & 0xff
      )
    case 0x6fc806e0:
      return (
        QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c(m, pQuest, {
          onChainQuestRefresh: (mem, pNext) =>
            dispatchQuestSeqFilterF0_113c(mem as SparseMemory113c, pNext),
        }) & 0xff
      )
    case 0x6fc83d20:
      return ACT1Q3_ActivateQuestState1_6FC83D20_113c(m, pQuest) & 0xff
    case 0x6fc846d0:
      return ACT1Q4_ActivateOrChainQuest_6FC846D0_113c(m, pQuest) & 0xff
    case 0x6fc84aa0:
      return ACT1Q3_ActivateOrChainQuest_6FC84AA0_113c(m, pQuest) & 0xff
    case 0x6fc84e10:
      return ACT1Q2_ActivateOrChainQuest_6FC84E10_113c(m, pQuest) & 0xff
    case 0x6fc85410:
      return ACT1Q1_SequenceFilter_6FC85410_113c(m, pQuest) & 0xff
    case 0x6fcd8a70:
      return ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c(m, pQuest) & 0xff
    case 0x6fcda270:
      return ACT4Q1_SeqCallback_6FCDA270_113c(m, pQuest) & 0xff
    case 0x6fcda4f0:
      return ACT4Q3_SeqCallback_6FCDA4F0_113c(m, pQuest) & 0xff
    case 0x6fce21e0:
      return ACT2Q3_SeqFilter_6FCE21E0_113c(m, pQuest) & 0xff
    case 0x6fce24a0:
      return ACT2Q1_SeqFilter_6FCE24A0_113c(m, pQuest) & 0xff
    case 0x6fce6390:
      return ACT2Q3_SeqCallback_6FCE6390_113c(m, pQuest) & 0xff
    case 0x6fce69d0:
      return ACT2Q5_SeqCallback_6FCE69D0_113c(m, pQuest) & 0xff
    case 0x6fd02a40:
      return QUESTS_ChainStatusFilterNotState7_6FD02A40_113c(m, pQuest) & 0xff
    case 0x6fd02b70:
      return QUESTS_ChainStatusFilterOrQuest17_6FD02B70_113c(m, pQuest) & 0xff
    case 0x6fd02d40:
      return QUESTS_ChainStatusFilterPromoteState1A_6FD02D40_113c(m, pQuest) & 0xff
    case 0x6fd02e80:
      return QUESTS_ChainStatusFilterPromoteState1B_6FD02E80_113c(m, pQuest) & 0xff
    case 0x6fd02f00:
      return QUESTS_ChainStatusFilterNotState5_6FD02F00_113c(m, pQuest) & 0xff
    case 0x6fd07050:
      return ACT3Q7_OnOrmusNpcActivateFilter_6FD07050_113c(m, pQuest) & 0xff
    default:
      return 0
  }
}

/** D2Game.dll .data 0x6FD1C3D0 (dy) and 0x6FD1C3DC (dx) for Wake of Fire / Sentry 3-trap triangle. */
const SENTRY_TRAP_DY_6FD1C3D0 = [-1, 0, -1] as const
const SENTRY_TRAP_DX_6FD1C3DC = [-1, 0, 1] as const

/** D2Game.dll .data 0x6FD2BC38 — Act 5 Q2 Qual-Kehk rune reward codes ('r07 ', 'r08 ', 'r09 ', 'r01 '). */
const ACT5Q2_RUNE_CODES_6FD2BC38 = [0x20373072, 0x20383072, 0x20393072, 0x20313072] as const

/** D2Game.dll .data 0x6FD293A8 — Act 1 Q3 Cain search state table. */
const ACT1Q3_CAIN_STATES_6FD293A8 = [-1, 0, 1, 2, 3, 4, 5, 6] as const

/** D2Game.dll .data 0x6FD2F15C / 0x6FD2F194 / 0x6FD2F1CC — Act 5 Q3 Anya class item code tables. */
const ACT5Q3_ANYA_CODES_HELL_6FD2F15C: readonly (readonly number[])[] = [
  [0x20626d61, 0x20636d61, 0x20646d61, 0x20656d61, 0x20666d61],
  [0x2062626f, 0x2063626f, 0x2064626f, 0x2065626f, 0x2066626f],
  [0x2062656e, 0x2063656e, 0x2064656e, 0x2065656e, 0x2066656e],
  [0x20626170, 0x20636170, 0x20646170, 0x20656170, 0x20666170],
  [0x20626162, 0x20636162, 0x20646162, 0x20656162, 0x20666162],
  [0x20627264, 0x20637264, 0x20647264, 0x20657264, 0x20667264],
  [0x20726137, 0x20627737, 0x20667837, 0x20736337, 0x20776c37, 0x20777437, 0x20727137],
]

const ACT5Q3_ANYA_CODES_NM_6FD2F194: readonly (readonly number[])[] = [
  [0x20366d61, 0x20376d61, 0x20386d61, 0x20396d61, 0x20616d61],
  [0x2036626f, 0x2037626f, 0x2038626f, 0x2039626f, 0x2061626f],
  [0x2036656e, 0x2037656e, 0x2038656e, 0x2039656e, 0x2061656e],
  [0x20366170, 0x20376170, 0x20386170, 0x20396170, 0x20616170],
  [0x20366162, 0x20376162, 0x20386162, 0x20396162, 0x20616162],
  [0x20367264, 0x20377264, 0x20387264, 0x20397264, 0x20617264],
  [0x20726139, 0x20627739, 0x20667839, 0x20736339, 0x20776c39, 0x20777439, 0x20727139],
]

const ACT5Q3_ANYA_CODES_NORM_6FD2F1CC: readonly (readonly number[])[] = [
  [0x20316d61, 0x20326d61, 0x20336d61, 0x20346d61, 0x20356d61],
  [0x2031626f, 0x2032626f, 0x2033626f, 0x2034626f, 0x2035626f],
  [0x2031656e, 0x2032656e, 0x2033656e, 0x2034656e, 0x2035656e],
  [0x20316170, 0x20326170, 0x20336170, 0x20346170, 0x20356170],
  [0x20316162, 0x20326162, 0x20336162, 0x20346162, 0x20356162],
  [0x20317264, 0x20327264, 0x20337264, 0x20347264, 0x20357264],
  [0x2072746b, 0x20627277, 0x20667861, 0x20736563, 0x20776c63, 0x206c7462, 0x20726b73],
]

/**
 * [1/44] Clears type-2 AI events on `pUnit` and dispatches treasure drop table evaluation (`0x6FC3E3D0` or `0x6FC3E640`).
 * @dll D2Game.dll
 * @va 0x6FC3E900
 * @ordinalOrName D2Game_6FC3E900
 */
export function ITEMS_EvaluateMonsterDropTableEntry_6FC3E900_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  pDropContext: number,
  onEvalTable14?: (m: SparseMemory113c, pDropContext: number, pUnit: number, pGame: number) => void,
  onEvalTableDefault?: (
    m: SparseMemory113c,
    pDropContext: number,
    pUnit: number,
    pGame: number,
  ) => void,
  ops?: PetMoveActionOps113c,
): void {
  hitD2GameVa113c(0x6FC3E900)
  if (pUnit !== 0) {
    let pEvt = m.u32((pUnit + 0xdc) >>> 0)
    while (pEvt !== 0) {
      const pNext = m.u32((pEvt + 0x24) >>> 0)
      if (m.u8(pEvt) === 2) {
        EVENT_FreeNode113c(m, pGame, pEvt)
      }
      pEvt = pNext
    }
  }
  const pRecord = m.u32(pDropContext >>> 0)
  const dwField14 = pRecord !== 0 ? m.u32((pRecord + 0x14) >>> 0) : 0
  if (dwField14 !== 0) {
    if (onEvalTable14 !== undefined) {
      onEvalTable14(m, pDropContext, pUnit, pGame)
    } else {
      D2Game_6FC3E3D0_113c(m, pDropContext, pUnit, pGame, ops)
    }
  } else if (onEvalTableDefault !== undefined) {
    onEvalTableDefault(m, pDropContext, pUnit, pGame)
  } else {
    D2Game_6FC3E640_113c(m, pUnit, pDropContext, pGame, ops)
  }
}

/**
 * [2/44] Finds a quest item by 4CC base code on `pPlayerUnit` and removes/frees it from inventory (`0x6FC565E0`).
 * @dll D2Game.dll
 * @va 0x6FC566A0
 * @ordinalOrName D2Game_6FC566A0
 */
export function QUESTS_FindAndDeletePlayerQuestItemByCode_6FC566A0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  dwItemCode: number,
  onDeleteQuestItem?: (
    m: SparseMemory113c,
    pPlayerUnit: number,
    pItem: number,
    pGame: number,
    pInventory: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FC566A0)
  const pItem = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayerUnit, pGame, dwItemCode) >>> 0
  if (pItem !== 0) {
    const pInventory = m.u32((pPlayerUnit + 0x60) >>> 0)
    if (onDeleteQuestItem !== undefined) {
      onDeleteQuestItem(m, pPlayerUnit, pItem, pGame, pInventory)
    } else {
      D2Game_6FC565E0_113c(m, pItem, pPlayerUnit, pGame, pInventory)
    }
  }
}

/**
 * [3/44] Handles Act 3 Mephisto red portal entry to Act 4 (`nTargetLevelId === 0x66`) or activates the Mephisto bridge (`0x6FD05A60`).
 * @dll D2Game.dll
 * @va 0x6FC566C0
 * @ordinalOrName D2Game_6FC566C0
 */
export function ACT3Q7_OnMephistoPortalWarpToAct4_6FC566C0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  nTargetLevelId: number,
  _dwUnused = 0,
  onDeleteQuestItem?: (
    m: SparseMemory113c,
    pPlayerUnit: number,
    pItem: number,
    pGame: number,
    pInventory: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FC566C0)
  const pPlayerData1 = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const pPlayerData2 = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const bDifficulty = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData2 + bDifficulty * 4 + 0x10) >>> 0)
  if ((nTargetLevelId | 0) !== 0x66) {
    ACT3Q7_ActivateMephistoBridgeAndPortal_6FD05A60_113c(m, pGame)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x17, 0) !== 0) {
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 0) === 0) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x12, 0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x12, 0x0d)
    const khalimCodes = [0x20796571, 0x20726871, 0x20726271, 0x20316671, 0x20326671]
    for (let i = 0; i < khalimCodes.length; i++) {
      const pItem =
        ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayerUnit, pGame, khalimCodes[i]!) >>> 0
      if (pItem !== 0) {
        const pInv = m.u32((pPlayerUnit + 0x60) >>> 0)
        if (onDeleteQuestItem !== undefined) {
          onDeleteQuestItem(m, pPlayerUnit, pItem, pGame, pInv)
        } else {
          D2Game_6FC565E0_113c(m, pItem, pPlayerUnit, pGame, pInv)
        }
      }
    }
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x17, 0)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x17, 0x0d)
  QUESTS_ApplyActNpcIntroFlags_6FC55C20_113c(m, pPlayerUnit, 2, pGame)
  QUESTS_SendPlayerQuestLogPacket28_113c(m, pPlayerUnit, pGame)
  let pClient = 0
  if (pPlayerUnit !== 0 && m.u32(pPlayerUnit) === 0) {
    const pPd = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
    pClient = m.u32((pPd + 0x9c) >>> 0)
  }
  if (m.u32((pPlayerData1 + 0x4c) >>> 0) !== 1) {
    m.setU32((pPlayerData1 + 0x4c) >>> 0, 1)
    const sp = allocW14B1Stack(m, 0x10)
    try {
      m.setU8(sp, 0x61)
      m.setU8((sp + 1) >>> 0, 0x04)
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 2)
    } finally {
      freeW14B1Stack(sp)
    }
  }
}

/**
 * [4/44] Server missile DoFunc that spawns a sub-monster along a linear projectile path (`0x6FC60EB0`).
 * @dll D2Game.dll
 * @va 0x6FC60EB0
 * @ordinalOrName D2Game_6FC60EB0
 */
export function MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c(
  m: SparseMemory113c,
  pGame: number,
  pMissile: number,
  onSpawnPet?: (m: SparseMemory113c, pGame: number, pSummonArg: number) => number,
): number {
  hitD2GameVa113c(0x6FC60EB0)
  if (pMissile === 0) return 2
  const dwBit10 = (m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1
  if (dwBit10 === 0) return 2
  const dwOwnerType = m.u32((pMissile + 0x94) >>> 0)
  const dwOwnerGuid = m.u32((pMissile + 0x98) >>> 0)
  if (SUNIT_GetServerUnit113c(m, pGame, dwOwnerType, dwOwnerGuid) === 0) return 2
  if (MISSILE_GetTargetY113c(m, pMissile) === 0) return 2
  const pPath = m.u32((pMissile + 0x2c) >>> 0)
  if (PATH_CheckFlag08_113c(m, pPath) === 0) {
    return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame)
  }
  const pOwner = SUNIT_GetOwnerUnit113c(m, pMissile, pGame) >>> 0
  if (pOwner === 0) return 2
  const nSkillId = MISSILE_GetSkill113c(m, pMissile) | 0
  const nSkillLevel = MISSILE_GetLevel113c(m, pMissile) | 0
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
  if (pSkillsTxt === 0) return 2
  const sp = allocW14B1Stack(m, 0x40)
  try {
    const spSummonMode = sp >>> 0
    const nSummonId =
      SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
        m,
        0,
        0,
        spSummonMode,
        pOwner,
        0,
        nSkillId,
        nSkillLevel,
      ) | 0
    if (nSummonId < 0) return 0
    let bPetType = m.u8((pSkillsTxt + 0xbe) >>> 0)
    const pDataTablesPtr = m.u32(0x6fd1829c)
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) : 0
    const nPetTypesCount = pDataTables !== 0 ? (m.u32((pDataTables + 0xbf0) >>> 0) | 0) : 0
    if (bPetType >= nPetTypesCount) {
      bPetType = 0
    }
    const dwTargetX = MISSILE_GetTargetX113c(m, pMissile) >>> 0
    if (pGame === 0) {
      throw new D2CommonAssertError('SUnit.cpp', 0x2d3)
    }
    let pCarrierMon = m.u32((pGame + (dwTargetX & 0x7f) * 4 + 0x1320) >>> 0)
    while (pCarrierMon !== 0) {
      if (m.u32((pCarrierMon + 0x0c) >>> 0) === dwTargetX) break
      pCarrierMon = m.u32((pCarrierMon + 0xe4) >>> 0)
    }
    if (pCarrierMon === 0) {
      return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame)
    }
    const pSummonArg = (sp + 0x08) >>> 0
    m.setU32(pSummonArg, 0x0d)
    m.setU32((pSummonArg + 0x04) >>> 0, pOwner)
    m.setU32((pSummonArg + 0x08) >>> 0, nSummonId >>> 0)
    m.setU32((pSummonArg + 0x0c) >>> 0, 0)
    m.setU32((pSummonArg + 0x10) >>> 0, m.u32(spSummonMode))
    m.setU32((pSummonArg + 0x14) >>> 0, UNIT_GetPosX113c(m, pMissile) >>> 0)
    m.setU32((pSummonArg + 0x18) >>> 0, UNIT_GetPosY113c(m, pMissile) >>> 0)
    m.setU32((pSummonArg + 0x1c) >>> 0, bPetType >>> 0)
    m.setU32((pSummonArg + 0x20) >>> 0, 0)
    const pSpawned =
      (onSpawnPet !== undefined
        ? onSpawnPet(m, pGame, pSummonArg)
        : D2Game_6FCC3610_113c(m, pSummonArg, pGame)) >>> 0
    if (pSpawned !== 0) {
      const dwCarrierGuid = m.u32((pCarrierMon + 0x0c) >>> 0)
      if (m.u32(pSpawned) === 1) {
        const pMonData = m.u32((pSpawned + 0x14) >>> 0)
        const pAiCtrl = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) : 0
        m.setU32((pAiCtrl + 0x2c) >>> 0, dwCarrierGuid)
        m.setU32((pAiCtrl + 0x30) >>> 0, 1)
        m.setU32((pAiCtrl + 0x28) >>> 0, pGame)
      }
      AIGENERAL_LinkMinionToLeader113c(m, pCarrierMon, pSpawned, pGame)
      MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, pSpawned, 0x0f, pGame, 0)
      SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c(
        m,
        pGame,
        pOwner,
        pSpawned,
        nSkillId,
        nSkillLevel,
        0,
      )
      STATES_UpdateOrClearState98Transform113c(m, pSpawned, pOwner)
      SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c(m, pGame, 9, pSpawned, 0)
      const nRemain = (MISSILE_GetTargetY113c(m, pMissile) - 1) | 0
      MISSILE_SetTargetY113c(m, pMissile, nRemain)
    }
    return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame)
  } finally {
    freeW14B1Stack(sp)
  }
}

/**
 * [5/44] Server skill DoFunc that spawns 3 trap/sentry pet monsters in a triangle around target coords (`0x6FC63D40`).
 * @dll D2Game.dll
 * @va 0x6FC63D40
 * @ordinalOrName D2Game_6FC63D40
 */
export function SKILLS_SrvDo_Summon3TrapsInTriangle_6FC63D40_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  onSpawnPet?: (m: SparseMemory113c, pGame: number, pSummonArg: number) => number,
): number {
  hitD2GameVa113c(0x6FC63D40)
  if ((nSkillId | 0) < 0) return 0
  const pDataTablesPtr = m.u32(0x6fd1829c)
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) : 0
  if (pDataTables === 0 || (nSkillId | 0) >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0)
  const pSkillsTxt = (pSkillsTxtBase + imul32(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0
  const sp = allocW14B1Stack(m, 0x48)
  try {
    const spSummonMode = sp >>> 0
    const spX = (sp + 0x04) >>> 0
    const spY = (sp + 0x08) >>> 0
    const nSummonId =
      SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
        m,
        0,
        0,
        spSummonMode,
        pUnit,
        0,
        nSkillId,
        nSkillLevel,
      ) | 0
    if (nSummonId < 0) return 0
    const nPetType = ((m.u8((pSkillsTxt + 0xbe) >>> 0) << 24) >> 24)
    if (nPetType < 0 || nPetType >= (m.u32((pDataTables + 0xbf0) >>> 0) | 0)) return 0
    const pUnitRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
    if (pUnitRoom === 0) return 0
    if (SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, pUnit, pGame, spX, spY) === 0) {
      return 0
    }
    const targetX = (m.u32(spX) | 0)
    const targetY = (m.u32(spY) | 0)
    const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pUnitRoom, targetX, targetY) >>> 0
    if (pTargetRoom === 0) return 0
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pTargetRoom) !== 0) return 0
    let pEffectiveOwner = pUnit
    if (
      pEffectiveOwner !== 0 &&
      m.u32(pEffectiveOwner) === 1 &&
      MONSTERS_GetHirelingTypeId113c(m, pEffectiveOwner) !== 0
    ) {
      const pLeader = AIGENERAL_GetPackLeaderUnit113c(m, pEffectiveOwner) >>> 0
      if (pLeader !== 0) {
        pEffectiveOwner = pLeader
      }
    }
    const dwExpireFrame =
      (SKILLS_EvalLinearParam12_6FC21B10_113c(m, nSkillId, nSkillLevel) +
        m.u32((pGame + 0xa8) >>> 0)) >>>
      0
    const nPetMax =
      SKILLS_EvalCalcByOffset113c(
        m,
        pEffectiveOwner,
        m.u32((pSkillsTxt + 0xc0) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    const pSummonArg = (sp + 0x10) >>> 0
    m.setU32(pSummonArg, 1)
    m.setU32((pSummonArg + 0x04) >>> 0, pEffectiveOwner)
    m.setU32((pSummonArg + 0x0c) >>> 0, 0)
    m.setU32((pSummonArg + 0x10) >>> 0, m.u32(spSummonMode))
    m.setU32((pSummonArg + 0x1c) >>> 0, nPetType >>> 0)
    m.setU32((pSummonArg + 0x20) >>> 0, nPetMax >>> 0)
    let bSpawnedAny = 0
    for (let i = 0; i < 3; i++) {
      m.setU32((pSummonArg + 0x08) >>> 0, (nSummonId + i) >>> 0)
      m.setU32((pSummonArg + 0x14) >>> 0, (targetX + SENTRY_TRAP_DX_6FD1C3DC[i]!) >>> 0)
      m.setU32((pSummonArg + 0x18) >>> 0, (targetY + SENTRY_TRAP_DY_6FD1C3D0[i]!) >>> 0)
      const pSpawned =
        (onSpawnPet !== undefined
          ? onSpawnPet(m, pGame, pSummonArg)
          : D2Game_6FCC3610_113c(m, pSummonArg, pGame)) >>> 0
      if (pSpawned !== 0) {
        MONSTER_AddSkillToUnit113c(m, nSkillLevel, nSkillId, pSpawned, 1)
        SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c(
          m,
          pGame,
          pEffectiveOwner,
          pSpawned,
          nSkillId,
          nSkillLevel,
          0,
        )
        bSpawnedAny = 1
        const pAiGeneral = MONSTER_GetAiGeneralPtr_6FC218E0_113c(m, pSpawned) >>> 0
        if (pAiGeneral !== 0 && dwExpireFrame !== 0xfffffd66) {
          m.setU32((pAiGeneral + 0x14) >>> 0, dwExpireFrame)
        }
        if (pEffectiveOwner !== 0 && m.u32(pEffectiveOwner) === 1) {
          const bAlign = UNIT_GetAlignment113c(m, pEffectiveOwner) & 0xff
          SUNIT_SetMonsterAlignmentState113c(m, pSpawned, bAlign, 1)
        }
      }
    }
    return bSpawnedAny
  } finally {
    freeW14B1Stack(sp)
  }
}

/**
 * [6/44] Server skill DoFunc that summons a Druid pet (Raven / Spirit Wolf / Dire Wolf / Grizzly) at target coords (`0x6FC66560`).
 * @dll D2Game.dll
 * @va 0x6FC66560
 * @ordinalOrName D2Game_6FC66560
 */
export function SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  onSpawnPet?: (m: SparseMemory113c, pGame: number, pSummonArg: number) => number,
): number {
  hitD2GameVa113c(0x6FC66560)
  if ((nSkillId | 0) < 0) return 0
  const pDataTablesPtr = m.u32(0x6fd1829c)
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) : 0
  if (pDataTables === 0 || (nSkillId | 0) >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0
  const sp = allocW14B1Stack(m, 0x38)
  try {
    const spSummonMode = sp >>> 0
    const spX = (sp + 0x04) >>> 0
    const spY = (sp + 0x08) >>> 0
    const nSummonId =
      SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
        m,
        0,
        0,
        spSummonMode,
        pUnit,
        0,
        nSkillId,
        nSkillLevel,
      ) | 0
    if (nSummonId < 0) return 0
    const nPetType = ((m.u8((pSkillsTxt + 0xbe) >>> 0) << 24) >> 24)
    if (nPetType < 0 || nPetType >= (m.u32((pDataTables + 0xbf0) >>> 0) | 0)) return 0
    if (pUnit !== 0) {
      m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
    }
    if (SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, pUnit, pGame, spX, spY) === 0) {
      return 0
    }
    const pSummonArg = (sp + 0x10) >>> 0
    const nPetMax =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0xc0) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    m.setU32(pSummonArg, 0)
    m.setU32((pSummonArg + 0x04) >>> 0, pUnit)
    m.setU32((pSummonArg + 0x08) >>> 0, nSummonId >>> 0)
    m.setU32((pSummonArg + 0x0c) >>> 0, 0)
    m.setU32((pSummonArg + 0x10) >>> 0, m.u32(spSummonMode))
    m.setU32((pSummonArg + 0x14) >>> 0, 0)
    m.setU32((pSummonArg + 0x18) >>> 0, 0)
    m.setU32((pSummonArg + 0x1c) >>> 0, nPetType >>> 0)
    m.setU32((pSummonArg + 0x20) >>> 0, nPetMax >>> 0)
    const pSpawned =
      (onSpawnPet !== undefined
        ? onSpawnPet(m, pGame, pSummonArg)
        : D2Game_6FCC3610_113c(m, pSummonArg, pGame)) >>> 0
    if (pSpawned === 0) return 0
    SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(
      m,
      pGame,
      pSpawned,
      m.u32((pUnit + 0xd0) >>> 0),
      0,
    )
    let nCalcLvl =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0x13c) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    if (nCalcLvl < 1) nCalcLvl = 1
    SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c(
      m,
      pUnit,
      nCalcLvl,
      pGame,
      pSpawned,
      nSkillLevel,
    )
    SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c(
      m,
      pGame,
      pUnit,
      pSpawned,
      nSkillId,
      nSkillLevel,
      0,
    )
    return 1
  } finally {
    freeW14B1Stack(sp)
  }
}

/**
 * [7/44] Server skill DoFunc that summons a Druid Spirit (Oak Sage / Heart of Wolverine / Spirit of Barbs) (`0x6FC66720`).
 * @dll D2Game.dll
 * @va 0x6FC66720
 * @ordinalOrName D2Game_6FC66720
 */
export function SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  onSpawnPet?: (m: SparseMemory113c, pGame: number, pSummonArg: number) => number,
): number {
  hitD2GameVa113c(0x6FC66720)
  if ((nSkillId | 0) < 0) return 0
  const pDataTablesPtr = m.u32(0x6fd1829c)
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) : 0
  if (pDataTables === 0 || (nSkillId | 0) >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0
  const sp = allocW14B1Stack(m, 0x38)
  try {
    const spSummonMode = sp >>> 0
    const nSummonId =
      SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
        m,
        0,
        0,
        spSummonMode,
        pUnit,
        0,
        nSkillId,
        nSkillLevel,
      ) | 0
    if (nSummonId < 0) return 0
    const nPetType = ((m.u8((pSkillsTxt + 0xbe) >>> 0) << 24) >> 24)
    if (nPetType < 0 || nPetType >= (m.u32((pDataTables + 0xbf0) >>> 0) | 0)) return 0
    if (pUnit !== 0) {
      m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
    }
    const pSummonArg = (sp + 0x10) >>> 0
    const nPetMax =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0xc0) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    m.setU32(pSummonArg, 0)
    m.setU32((pSummonArg + 0x04) >>> 0, pUnit)
    m.setU32((pSummonArg + 0x08) >>> 0, nSummonId >>> 0)
    m.setU32((pSummonArg + 0x0c) >>> 0, 0)
    m.setU32((pSummonArg + 0x10) >>> 0, 8)
    m.setU32((pSummonArg + 0x14) >>> 0, 0)
    m.setU32((pSummonArg + 0x18) >>> 0, 0)
    m.setU32((pSummonArg + 0x1c) >>> 0, nPetType >>> 0)
    m.setU32((pSummonArg + 0x20) >>> 0, nPetMax >>> 0)
    const pSpawned =
      (onSpawnPet !== undefined
        ? onSpawnPet(m, pGame, pSummonArg)
        : D2Game_6FCC3610_113c(m, pSummonArg, pGame)) >>> 0
    if (pSpawned === 0) return 0
    SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(
      m,
      pGame,
      pSpawned,
      m.u32((pUnit + 0xd0) >>> 0),
      0,
    )
    STATES_ToggleGfxStateFlag113c(m, pSpawned, 0x96, 1)
    let nCalcLvl =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0x13c) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    if (nCalcLvl < 1) nCalcLvl = 1
    STATLIST_SetUnitStat113c(m, pSpawned, 12, nCalcLvl, 0)
    SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c(
      m,
      pGame,
      pUnit,
      pSpawned,
      nSkillId,
      nSkillLevel,
      0,
    )
    return 1
  } finally {
    freeW14B1Stack(sp)
  }
}

/**
 * [8/44] Server skill DoFunc that summons a Druid Vine/Creeper pet (`0x6FC668A0`).
 * @dll D2Game.dll
 * @va 0x6FC668A0
 * @ordinalOrName D2Game_6FC668A0
 */
export function SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  onSpawnPet?: (m: SparseMemory113c, pGame: number, pSummonArg: number) => number,
): number {
  hitD2GameVa113c(0x6FC668A0)
  if ((nSkillId | 0) < 0) return 0
  const pDataTablesPtr = m.u32(0x6fd1829c)
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) : 0
  if (pDataTables === 0 || (nSkillId | 0) >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0
  const sp = allocW14B1Stack(m, 0x38)
  try {
    const spSummonMode = sp >>> 0
    const nSummonId =
      SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
        m,
        0,
        0,
        spSummonMode,
        pUnit,
        0,
        nSkillId,
        nSkillLevel,
      ) | 0
    if (nSummonId < 0) return 0
    const nPetType = ((m.u8((pSkillsTxt + 0xbe) >>> 0) << 24) >> 24)
    if (nPetType < 0 || nPetType >= (m.u32((pDataTables + 0xbf0) >>> 0) | 0)) return 0
    if (pUnit !== 0) {
      m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
    }
    const pSummonArg = (sp + 0x10) >>> 0
    const nPetMax =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0xc0) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    m.setU32(pSummonArg, 0)
    m.setU32((pSummonArg + 0x04) >>> 0, pUnit)
    m.setU32((pSummonArg + 0x08) >>> 0, nSummonId >>> 0)
    m.setU32((pSummonArg + 0x0c) >>> 0, 0)
    m.setU32((pSummonArg + 0x10) >>> 0, m.u32(spSummonMode))
    m.setU32((pSummonArg + 0x14) >>> 0, 0)
    m.setU32((pSummonArg + 0x18) >>> 0, 0)
    m.setU32((pSummonArg + 0x1c) >>> 0, nPetType >>> 0)
    m.setU32((pSummonArg + 0x20) >>> 0, nPetMax >>> 0)
    const pSpawned =
      (onSpawnPet !== undefined
        ? onSpawnPet(m, pGame, pSummonArg)
        : D2Game_6FCC3610_113c(m, pSummonArg, pGame)) >>> 0
    if (pSpawned === 0) return 0
    m.setU32((pSpawned + 0xc4) >>> 0, (m.u32((pSpawned + 0xc4) >>> 0) & ~0x04) >>> 0)
    STATLIST_SetUnitStat113c(m, pSpawned, 0x4a, 0, 0)
    let nCalcLvl =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0x13c) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    if (nCalcLvl < 1) nCalcLvl = 1
    SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c(
      m,
      pUnit,
      nCalcLvl,
      pGame,
      pSpawned,
      nSkillLevel,
    )
    SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c(
      m,
      pGame,
      pUnit,
      pSpawned,
      nSkillId,
      nSkillLevel,
      0,
    )
    return 1
  } finally {
    freeW14B1Stack(sp)
  }
}
function fogCrc16CcittTableEntry113c(index: number): number {
  let c = (index & 0xff) << 8
  for (let b = 0; b < 8; b = (b + 1) | 0) {
    c = ((c & 0x8000) !== 0 ? (c << 1) ^ 0x1021 : c << 1) & 0xffff
  }
  return c
}

function fogCrc16LowerString113c(m: SparseMemory113c, str: number): number {
  if (str === 0) return 0xffff
  let crc = 0xffff
  let ptr = str >>> 0
  let ch = m.u8(ptr)
  if (ch >= 0x41 && ch <= 0x5a) ch = (ch + 0x20) & 0xff
  while (ch !== 0) {
    const idx = (ch ^ crc) & 0xff
    crc = ((crc >>> 2) ^ fogCrc16CcittTableEntry113c(idx)) & 0xffff
    ptr = (ptr + 1) >>> 0
    ch = m.u8(ptr)
    if (ch >= 0x41 && ch <= 0x5a) ch = (ch + 0x20) & 0xff
  }
  return crc & 0xffff
}

function strnicmpAscii113c(m: SparseMemory113c, s1: number, s2: number, maxLen: number): number {
  for (let i = 0; i < maxLen; i = (i + 1) | 0) {
    let c1 = m.u8((s1 + i) >>> 0)
    let c2 = m.u8((s2 + i) >>> 0)
    if (c1 >= 0x41 && c1 <= 0x5a) c1 = (c1 + 0x20) & 0xff
    if (c2 >= 0x41 && c2 <= 0x5a) c2 = (c2 + 0x20) & 0xff
    if (c1 !== c2) return (c1 - c2) | 0
    if (c1 === 0) return 0
  }
  return 0
}

/**
 * [9/44] Removes a client from a game, optionally saves all players, unlinks from ID/name/game lists, cleans up player unit, and frees client memory.
 * @dll D2Game.dll
 * @va 0x6FC6B7F0
 * @ordinalOrName D2Game_6FC6B7F0
 */
export function CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c(
  m: SparseMemory113c,
  dwClientId: number,
  pGame: number,
  bSendSave: number,
  onCancelPlayerTrade_6FC93AA0?: (m: SparseMemory113c, pGame: number, pPlayerUnit: number) => void,
  onServerLeaveGameCallback?: (
    m: SparseMemory113c,
    pfnLeaveGame: number,
    pField68: number,
    wGameId: number,
    dwClassId: number,
    dwBaseLevel: number,
    dwBaseExpLo: number,
    dwBaseExpHi: number,
    wClientFlags0A: number,
    szCharName: number,
    szPortraitDesc: number,
    dwField178: number,
    szAccountName: number,
    dwField60: number,
    pField190: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FC6B7F0)
  if (pGame === 0) {
    throw new D2CommonAssertError('pGame', 0x489)
  }
  const pClient0 = CLIENTS_FindClientByIdInGame_6FC69FE0_113c(m, pGame, dwClientId) >>> 0
  if (pClient0 !== 0) {
    CLIENTS_BuildPlayerPortraitDescString_6FC6AE90_113c(m, (pClient0 + 0x6c) >>> 0, pClient0)
  }
  if (bSendSave === 1) {
    const pClientSave = CLIENTS_FindClientByIdInGame_6FC69FE0_113c(m, pGame, dwClientId) >>> 0
    PLAYERSAVE_SaveClientAndAllOtherPlayers_6FC4C910_113c(m, pClientSave, pGame)
  }
  const sp = allocW14B1Stack(m, 0x20)
  try {
    m.setU8(sp, 0)
    const idBucket = dwClientId & 0xff
    if (m.u32(0x6fd31c18) !== 0) {
      const pBucketAddr = (0x6fd307b8 + (idBucket << 2)) >>> 0
      let pNode = m.u32(pBucketAddr) >>> 0
      if (pNode !== 0) {
        if (m.u32(pNode) === (dwClientId >>> 0)) {
          let off = 0
          while (true) {
            const ch = m.u8((pNode + 0x0d + off) >>> 0)
            m.setU8((sp + off) >>> 0, ch)
            off = (off + 1) | 0
            if (ch === 0) break
          }
          m.setU32(pBucketAddr, m.u32((pNode + 0x4ac) >>> 0))
        } else {
          while (true) {
            const pNext = m.u32((pNode + 0x4ac) >>> 0) >>> 0
            if (pNext === 0 || m.u32(pNext) === (dwClientId >>> 0)) break
            pNode = pNext
          }
          const pMatch = m.u32((pNode + 0x4ac) >>> 0) >>> 0
          if (pMatch === 0) {
            throw new D2CommonAssertError('ptClient', 0x4db)
          }
          let off = 0
          while (true) {
            const ch = m.u8((pMatch + 0x0d + off) >>> 0)
            m.setU8((sp + off) >>> 0, ch)
            off = (off + 1) | 0
            if (ch === 0) break
          }
          m.setU32((pNode + 0x4ac) >>> 0, m.u32((pMatch + 0x4ac) >>> 0))
        }
      }
    }
    let pRemoved = 0
    const pGameHead = m.u32((pGame + 0x88) >>> 0) >>> 0
    if (pGameHead !== 0) {
      if (m.u32(pGameHead) === (dwClientId >>> 0)) {
        pRemoved = pGameHead
        m.setU32((pGame + 0x88) >>> 0, m.u32((pGameHead + 0x4a8) >>> 0))
      } else {
        let pPrev = pGameHead
        let pCur = m.u32((pPrev + 0x4a8) >>> 0) >>> 0
        while (pCur !== 0 && m.u32(pCur) !== (dwClientId >>> 0)) {
          pPrev = pCur
          pCur = m.u32((pPrev + 0x4a8) >>> 0) >>> 0
        }
        pCur = m.u32((pPrev + 0x4a8) >>> 0) >>> 0
        if (pCur !== 0) {
          pRemoved = pCur
          m.setU32((pPrev + 0x4a8) >>> 0, m.u32((pRemoved + 0x4a8) >>> 0))
        }
      }
    }
    if (m.u32(0x6fd31c18) !== 0) {
      const nameBucket = fogCrc16LowerString113c(m, sp) & 0xff
      const pNameBucketAddr = (0x6fd303b8 + (nameBucket << 2)) >>> 0
      const pHead = m.u32(pNameBucketAddr) >>> 0
      if (pHead !== 0) {
        if (strnicmpAscii113c(m, (pHead + 0x0d) >>> 0, sp, 0x10) === 0) {
          m.setU32(pNameBucketAddr, m.u32((pHead + 0x4b0) >>> 0))
        } else {
          let pPrev = pHead
          const pFirstNext = m.u32((pPrev + 0x4b0) >>> 0) >>> 0
          if (pFirstNext === 0) {
            throw new D2CommonAssertError('ptClient', 0x512)
          }
          if (strnicmpAscii113c(m, (pFirstNext + 0x0d) >>> 0, sp, 0x10) !== 0) {
            while (true) {
              pPrev = m.u32((pPrev + 0x4b0) >>> 0) >>> 0
              const pNext = m.u32((pPrev + 0x4b0) >>> 0) >>> 0
              if (pNext === 0) break
              if (strnicmpAscii113c(m, (pNext + 0x0d) >>> 0, sp, 0x10) === 0) break
            }
          }
          const pTarget = m.u32((pPrev + 0x4b0) >>> 0) >>> 0
          if (pTarget !== 0) {
            m.setU32((pPrev + 0x4b0) >>> 0, m.u32((pTarget + 0x4b0) >>> 0))
          }
        }
      }
    }
    if (pRemoved === 0) return
    CLIENT_BroadcastPlayerLeftPacket5C_6FC4BED0_113c(m, pRemoved, pGame)
    const pPlayer = CLIENTS_GetPlayerUnit113c(m, pRemoved, 0) >>> 0
    if (pPlayer !== 0) {
      const dwBaseExpLo = STATLIST_GetUnitBaseStat113c(m, pPlayer, 0x0d, 0) | 0
      const dwBaseExpHi = dwBaseExpLo < 0 ? -1 : 0
      const dwClassId = m.u32((pPlayer + 0x04) >>> 0) >>> 0
      const dwBaseLevel = STATLIST_GetUnitBaseStat113c(m, pPlayer, 0x0c, 0) | 0
      PARTY_LeavePartyForPlayer_6FCBC840_113c(m, pPlayer, pGame)
      PETS_FreePlayerPetTable_6FCB7640_113c(m, pGame, pPlayer)
      NPCS_UpdateTownVendorSlotsOnPlayerLeave_6FCB0560_113c(m, pGame, pPlayer)
      QUESTS_RefreshInventoryQuestItems_6FC54760_113c(m, pPlayer, pGame)
      if (onCancelPlayerTrade_6FC93AA0 !== undefined) {
        onCancelPlayerTrade_6FC93AA0(m, pGame, pPlayer)
      } else {
        D2Game_6FC93AA0_113c(m, pGame, pPlayer)
      }
      const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0
      if (pRoom !== 0) {
        DUNGEON_AddRoomPortalNode113c(m, pRoom, m.u32(pPlayer), m.u32((pPlayer + 0x0c) >>> 0))
      }
      SUNIT_FreeUnit113c(m, m.u32((pRemoved + 0x1a8) >>> 0), pPlayer)
      DUNGEON_SyncActiveRoomStatusChange113c(m, pRoom, 0)
      DUNGEON_UpdateRoomLevelChange113c(m, pRoom, 0)
      const pCbTable = m.u32(0x6fd31c3c) >>> 0
      if (pCbTable !== 0) {
        const pfnLeave = m.u32((pCbTable + 0x04) >>> 0) >>> 0
        if (pfnLeave === 0) {
          throw new D2CommonAssertError('0x6fd19ff9', 0x592)
        }
        const pCbTable2 = m.u32(0x6fd31c3c) >>> 0
        const pfnLeave2 = pCbTable2 !== 0 ? (m.u32((pCbTable2 + 0x04) >>> 0) >>> 0) : 0
        if (pfnLeave2 !== 0 && onServerLeaveGameCallback !== undefined) {
          onServerLeaveGameCallback(
            m,
            pfnLeave2,
            (pRemoved + 0x68) >>> 0,
            m.u16((pGame + 0x28) >>> 0),
            dwClassId,
            dwBaseLevel,
            dwBaseExpLo,
            dwBaseExpHi,
            m.u16((pRemoved + 0x0a) >>> 0),
            (pRemoved + 0x0d) >>> 0,
            (pRemoved + 0x6c) >>> 0,
            m.u32((pRemoved + 0x178) >>> 0),
            (pRemoved + 0x1d) >>> 0,
            m.u32((pRemoved + 0x60) >>> 0),
            (pRemoved + 0x190) >>> 0,
          )
        }
      }
    } else {
      const pCbTable = m.u32(0x6fd31c3c) >>> 0
      if (pCbTable !== 0) {
        m.setU8((pRemoved + 0x6c) >>> 0, 0)
        const pfnLeave = m.u32((pCbTable + 0x04) >>> 0) >>> 0
        if (pfnLeave === 0) {
          throw new D2CommonAssertError('0x6fd19ff9', 0x5ba)
        }
        const pCbTable2 = m.u32(0x6fd31c3c) >>> 0
        const pfnLeave2 = pCbTable2 !== 0 ? (m.u32((pCbTable2 + 0x04) >>> 0) >>> 0) : 0
        if (pfnLeave2 !== 0 && onServerLeaveGameCallback !== undefined) {
          onServerLeaveGameCallback(
            m,
            pfnLeave2,
            (pRemoved + 0x68) >>> 0,
            m.u16((pGame + 0x28) >>> 0),
            0,
            0,
            0,
            0,
            0,
            (pRemoved + 0x0d) >>> 0,
            (pRemoved + 0x6c) >>> 0,
            m.u32((pRemoved + 0x178) >>> 0),
            (pRemoved + 0x1d) >>> 0,
            m.u32((pRemoved + 0x60) >>> 0),
            (pRemoved + 0x190) >>> 0,
          )
        }
      }
    }
    const pAdjRoom = m.u32((pRemoved + 0x1b4) >>> 0)
    if (pAdjRoom !== 0) {
      CLIENT_RemoveClientFromAdjacentRooms_6FCBD550_113c(m, pAdjRoom, pRemoved)
    }
    const pField17C = m.u32((pRemoved + 0x17c) >>> 0) >>> 0
    if (pField17C !== 0) {
      const pClientGame = m.u32((pRemoved + 0x1a8) >>> 0) >>> 0
      FOG_FreeClientMemory113c(
        m,
        pClientGame !== 0 ? m.u32((pClientGame + 0x1c) >>> 0) : 0,
        pField17C,
        0x6fd1c204,
        0x5e1,
        0,
      )
      m.setU32((pRemoved + 0x17c) >>> 0, 0)
    }
    while (m.u32((pRemoved + 0x1c0) >>> 0) !== 0) {
      const pNode1C0 = m.u32((pRemoved + 0x1c0) >>> 0) >>> 0
      m.setU32((pRemoved + 0x1c0) >>> 0, m.u32((pNode1C0 + 0x204) >>> 0))
      FOG_FreeClientMemory113c(m, 0, pNode1C0, 0x6fd1c204, 0x5f1, 0)
    }
    const pClientGame = m.u32((pRemoved + 0x1a8) >>> 0) >>> 0
    FOG_FreeClientMemory113c(
      m,
      pClientGame !== 0 ? m.u32((pClientGame + 0x1c) >>> 0) : 0,
      pRemoved,
      0x6fd1c204,
      0x5f4,
      0,
    )
    m.setU32((pGame + 0x8c) >>> 0, (m.u32((pGame + 0x8c) >>> 0) - 1) >>> 0)
  } finally {
    freeW14B1Stack(sp)
  }
}

/**
 * [10/44] SrvDo handler for Amazon Decoy: spawns decoy pet, sets stats/passives/events, applies state 0x5D and transform 98, and inserts into subparty bucket.
 * @dll D2Game.dll
 * @va 0x6FC6D710
 * @ordinalOrName D2Game_6FC6D710
 */
export function SKILLS_SrvDo_SummonDecoy_6FC6D710_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  onSpawnPet?: (m: SparseMemory113c, pGame: number, pSummonArg: number) => number,
): number {
  hitD2GameVa113c(0x6FC6D710)
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
  if (pSkillsTxt === 0 || pUnit === 0 || m.u32(pUnit) !== 0) return 0
  const sp = allocW14B1Stack(m, 0x38)
  try {
    const pOutSpawnMode = sp >>> 0
    const pSummonArg = (sp + 0x08) >>> 0
    const nMonId = SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
      m,
      0,
      0,
      pOutSpawnMode,
      pUnit,
      0,
      nSkillId,
      nSkillLevel,
    )
    if (nMonId < 0) return 0
    const pDataTables = m.u32(m.u32(0x6fd1829c))
    let bPetType = m.u8((pSkillsTxt + 0xbe) >>> 0)
    if (bPetType >= m.u32((pDataTables + 0xbf0) >>> 0)) {
      bPetType = 0
    }
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
    m.setU32(pSummonArg, 0)
    m.setU32((pSummonArg + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pSummonArg + 0x08) >>> 0, nMonId >>> 0)
    m.setU32((pSummonArg + 0x0c) >>> 0, 0)
    m.setU32((pSummonArg + 0x10) >>> 0, m.u32(pOutSpawnMode))
    m.setU32((pSummonArg + 0x1c) >>> 0, bPetType)
    const nPetMax =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0xc0) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    m.setU32((pSummonArg + 0x20) >>> 0, nPetMax >>> 0)
    const pSpawned =
      (onSpawnPet !== undefined
        ? onSpawnPet(m, pGame, pSummonArg)
        : D2Game_6FCC3610_113c(m, pSummonArg, pGame)) >>> 0
    if (pSpawned === 0) return 0
    SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c(m, pUnit, 0, pGame, pSpawned, nSkillLevel)
    const nCalc13C =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0x13c) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c(
      m,
      pGame,
      pUnit,
      pSpawned,
      nSkillId,
      nSkillLevel,
      nCalc13C,
    )
    let pEvt = m.u32((pSpawned + 0xdc) >>> 0)
    while (pEvt !== 0) {
      const pNext = m.u32((pEvt + 0x24) >>> 0)
      if (m.u8(pEvt) === 2) {
        EVENT_FreeNode113c(m, pGame, pEvt)
      }
      pEvt = pNext
    }
    const dwFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x14) >>> 0
    EVENT_SetEventFull113c(m, pGame, pSpawned, 2, dwFrame, 0, 0, 0)
    STATES_ToggleGfxStateFlag113c(m, pSpawned, 0x5d, 1)
    STATES_UpdateOrClearState98Transform113c(m, pSpawned, pUnit)
    SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(
      m,
      pGame,
      pSpawned,
      m.u32((pUnit + 0xd0) >>> 0),
      0,
    )
    return 1
  } finally {
    freeW14B1Stack(sp)
  }
}
/**
 * [11/44] SrvDo handler for Assassin Shadow Warrior / Shadow Master.
 * @dll D2Game.dll
 * @va 0x6FC6D8C0
 * @ordinalOrName D2Game_6FC6D8C0
 */
export function SKILLS_SrvDo_SummonShadowWarriorOrMaster_6FC6D8C0_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  onSpawnPet?: (m: SparseMemory113c, pGame: number, pSummonArg: number) => number,
): number {
  hitD2GameVa113c(0x6FC6D8C0)
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
  if (pSkillsTxt === 0) return 0
  const sp = allocW14B1Stack(m, 0x38)
  try {
    const pOutSpawnMode = sp >>> 0
    const pSummonArg = (sp + 0x08) >>> 0
    const nMonId = SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
      m,
      0,
      0,
      pOutSpawnMode,
      pUnit,
      0,
      nSkillId,
      nSkillLevel,
    )
    if (nMonId < 0) return 0
    const pDataTables = m.u32(m.u32(0x6fd1829c))
    let bPetType = m.u8((pSkillsTxt + 0xbe) >>> 0)
    if (bPetType >= m.u32((pDataTables + 0xbf0) >>> 0)) {
      bPetType = 0
    }
    if (pUnit !== 0) {
      m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
    }
    m.setU32(pSummonArg, 0)
    m.setU32((pSummonArg + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pSummonArg + 0x08) >>> 0, nMonId >>> 0)
    m.setU32((pSummonArg + 0x0c) >>> 0, 0)
    m.setU32((pSummonArg + 0x10) >>> 0, m.u32(pOutSpawnMode))
    m.setU32((pSummonArg + 0x1c) >>> 0, bPetType)
    const nPetMax =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0xc0) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    m.setU32((pSummonArg + 0x20) >>> 0, nPetMax >>> 0)
    const pSpawned =
      (onSpawnPet !== undefined
        ? onSpawnPet(m, pGame, pSummonArg)
        : D2Game_6FCC3610_113c(m, pSummonArg, pGame)) >>> 0
    if (pSpawned === 0) return 0
    STATES_UpdateOrClearState98Transform113c(m, pSpawned, pUnit)
    const nOwnerMaxLife = STATLIST_GetMaxLifeFromUnit113c(m, pUnit) | 0
    const nCalc140 =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0x140) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    const nShadowLife = mulDiv113c(nOwnerMaxLife, nCalc140, 100) | 0
    STATLIST_SetUnitStat113c(m, pSpawned, 6, nShadowLife, 0)
    STATLIST_SetUnitStat113c(m, pSpawned, 7, nShadowLife, 0)
    const nBaseLvl = STATLIST_GetUnitStat113c(m, pUnit, 0x0c, 0) | 0
    STATLIST_SetUnitStat113c(m, pSpawned, 0x0c, nBaseLvl, 0)
    SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c(m, pUnit, 0, pGame, pSpawned, nSkillLevel)
    SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c(
      m,
      pGame,
      pUnit,
      pSpawned,
      nSkillId,
      nSkillLevel,
      0,
    )
    const nCalc13C =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0x13c) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    const dwFrame = (m.u32((pGame + 0xa8) >>> 0) + nCalc13C) >>> 0
    EVENT_SetEventFull113c(m, pGame, pSpawned, 7, dwFrame, 0, 0, 0)
    MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, pSpawned, 0x15, pGame, 0)
    STATES_SetMonsterSkillIconOnUnit113c(m, pSpawned, 0xab, 0)
    SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(
      m,
      pGame,
      pSpawned,
      m.u32((pUnit + 0xd0) >>> 0),
      0,
    )
    return 1
  } finally {
    freeW14B1Stack(sp)
  }
}

/**
 * [12/44] Spawns a single Bone Wall / Bone Prison segment monster at `(x, y)` if not in town.
 * @dll D2Game.dll
 * @va 0x6FC70E60
 * @ordinalOrName D2Game_6FC70E60
 */
export function SKILLS_SpawnBoneWallSegment_6FC70E60_113c(
  m: SparseMemory113c,
  nSkillId: number,
  pGame: number,
  pUnit: number,
  x: number,
  y: number,
  nSkillLevel: number,
  onSpawnPet?: (m: SparseMemory113c, pGame: number, pSummonArg: number) => number,
): number {
  hitD2GameVa113c(0x6FC70E60)
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
  if (nSkillId === 0) return 0
  const sp = allocW14B1Stack(m, 0x38)
  try {
    const pOutSpawnMode = sp >>> 0
    const pSummonArg = (sp + 0x08) >>> 0
    const nMonId = SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
      m,
      0,
      0,
      pOutSpawnMode,
      pUnit,
      0,
      nSkillId,
      nSkillLevel,
    )
    if (nMonId < 0) return 0
    const pDataTables = m.u32(m.u32(0x6fd1829c))
    let bPetType = m.u8((pSkillsTxt + 0xbe) >>> 0)
    if (bPetType >= m.u32((pDataTables + 0xbf0) >>> 0)) {
      bPetType = 0
    }
    const pOwnerRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
    const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pOwnerRoom, x, y) >>> 0
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pTargetRoom) !== 0) return 0
    m.setU32(pSummonArg, 9)
    m.setU32((pSummonArg + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pSummonArg + 0x08) >>> 0, nMonId >>> 0)
    m.setU32((pSummonArg + 0x0c) >>> 0, 0)
    m.setU32((pSummonArg + 0x10) >>> 0, m.u32(pOutSpawnMode))
    m.setU32((pSummonArg + 0x14) >>> 0, x >>> 0)
    m.setU32((pSummonArg + 0x18) >>> 0, y >>> 0)
    m.setU32((pSummonArg + 0x1c) >>> 0, bPetType)
    const nPetMax =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0xc0) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    m.setU32((pSummonArg + 0x20) >>> 0, nPetMax >>> 0)
    const pSpawned =
      (onSpawnPet !== undefined
        ? onSpawnPet(m, pGame, pSummonArg)
        : D2Game_6FCC3610_113c(m, pSummonArg, pGame)) >>> 0
    if (pSpawned === 0) return 0
    SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c(
      m,
      pGame,
      pUnit,
      pSpawned,
      nSkillId,
      nSkillLevel,
      0,
    )
    MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, pSpawned, 0x0f, pGame, 0)
    SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c(m, pGame, 9, pSpawned, 0)
    return pSpawned >>> 0
  } finally {
    freeW14B1Stack(sp)
  }
}

/**
 * [13/44] SrvDo handler for Necromancer Bone Wall: spawns center segment and two perpendicular wall-builder missiles.
 * @dll D2Game.dll
 * @va 0x6FC70FE0
 * @ordinalOrName D2Game_6FC70FE0
 */
export function SKILLS_SrvDo_BoneWall_6FC70FE0_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  onSpawnPet?: (m: SparseMemory113c, pGame: number, pSummonArg: number) => number,
): number {
  hitD2GameVa113c(0x6FC70FE0)
  const sp = allocW14B1Stack(m, 0xa0)
  try {
    const pOutY = sp >>> 0
    const pOutX = (sp + 0x04) >>> 0
    const pOutSpawnMode = (sp + 0x08) >>> 0
    const pSummonArg = (sp + 0x10) >>> 0
    const pMisParam = (sp + 0x38) >>> 0
    if (
      SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, pUnit, pGame, pOutX, pOutY) === 0
    ) {
      return 0
    }
    const targetX = (m.u32(pOutX) | 0)
    const targetY = (m.u32(pOutY) | 0)
    const pOwnerRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
    const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pOwnerRoom, targetX, targetY) >>> 0
    if (pTargetRoom === 0 || DUNGEON_CheckRoomIsTownMemPort113c(m, pTargetRoom) !== 0) {
      return 0
    }
    if (pUnit !== 0) {
      m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
    }
    const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
    if (nSkillId === 0) return 0
    const nMonId = SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
      m,
      0,
      0,
      pOutSpawnMode,
      pUnit,
      0,
      nSkillId,
      nSkillLevel,
    )
    if (nMonId < 0) return 0
    const pDataTables = m.u32(m.u32(0x6fd1829c))
    let bPetType = m.u8((pSkillsTxt + 0xbe) >>> 0)
    if (bPetType >= m.u32((pDataTables + 0xbf0) >>> 0)) {
      bPetType = 0
    }
    m.setU32(pSummonArg, 9)
    m.setU32((pSummonArg + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pSummonArg + 0x08) >>> 0, nMonId >>> 0)
    m.setU32((pSummonArg + 0x0c) >>> 0, 0)
    m.setU32((pSummonArg + 0x10) >>> 0, m.u32(pOutSpawnMode))
    m.setU32((pSummonArg + 0x14) >>> 0, targetX >>> 0)
    m.setU32((pSummonArg + 0x18) >>> 0, targetY >>> 0)
    m.setU32((pSummonArg + 0x1c) >>> 0, bPetType)
    const nPetMax =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0xc0) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    m.setU32((pSummonArg + 0x20) >>> 0, nPetMax >>> 0)
    const pCenterSeg =
      (onSpawnPet !== undefined
        ? onSpawnPet(m, pGame, pSummonArg)
        : D2Game_6FCC3610_113c(m, pSummonArg, pGame)) >>> 0
    if (pCenterSeg === 0) return 0
    const nOwnerType = pUnit !== 0 ? m.u32(pUnit) : 6
    const dwOwnerGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u32(pCenterSeg) === 1) {
      const pMonData = m.u32((pCenterSeg + 0x14) >>> 0)
      const pAiControl = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) : 0
      if (pAiControl !== 0) {
        m.setU8((pAiControl + 0x08) >>> 0, (m.u8((pAiControl + 0x08) >>> 0) | 2) & 0xff)
        m.setU32((pAiControl + 0x2c) >>> 0, dwOwnerGuid >>> 0)
        m.setU32((pAiControl + 0x30) >>> 0, nOwnerType >>> 0)
        m.setU32((pAiControl + 0x28) >>> 0, pGame >>> 0)
      }
    }
    MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, pCenterSeg, 0x0f, pGame, 0)
    SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c(
      m,
      pGame,
      pUnit,
      pCenterSeg,
      nSkillId,
      nSkillLevel,
      0,
    )
    SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c(m, pGame, 9, pCenterSeg, 0)
    const segX = UNIT_GetPosX113c(m, pCenterSeg) | 0
    const segY = UNIT_GetPosY113c(m, pCenterSeg) | 0
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pTargetRoom) !== 0) return 0
    const nCalc13C =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0x13c) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    const nHalfLen = (nCalc13C / 2) | 0
    if (nHalfLen > 1) {
      const nMissileId = ((m.u16((pSkillsTxt + 0x48) >>> 0) << 16) >> 16)
      if (nMissileId >= 0 && nMissileId < (m.u32((pDataTables + 0xb6c) >>> 0) | 0)) {
        m.setU32(pMisParam, 0x21)
        m.setU32((pMisParam + 0x04) >>> 0, pUnit >>> 0)
        m.setU32((pMisParam + 0x10) >>> 0, nMissileId >>> 0)
        m.setU32((pMisParam + 0x14) >>> 0, segX >>> 0)
        m.setU32((pMisParam + 0x18) >>> 0, segY >>> 0)
        m.setU32((pMisParam + 0x2c) >>> 0, nSkillId >>> 0)
        m.setU32((pMisParam + 0x30) >>> 0, nSkillLevel >>> 0)
        let dx = (UNIT_GetPosX113c(m, pUnit) - segX) | 0
        let dy = (UNIT_GetPosY113c(m, pUnit) - segY) | 0
        if (dx === 0 && dy === 0) {
          dx = 1
        }
        m.setU32((pMisParam + 0x1c) >>> 0, (segX - dy) >>> 0)
        m.setU32((pMisParam + 0x20) >>> 0, (segY + dx) >>> 0)
        const pMis1 = MISSILE_CreateServerProjectile113c(m, pGame, pMisParam) >>> 0
        if (pMis1 !== 0) {
          MISSILE_SetTargetX113c(m, pMis1, m.u32((pCenterSeg + 0x0c) >>> 0))
          MISSILE_SetTargetY113c(m, pMis1, nHalfLen)
        }
        m.setU32((pMisParam + 0x1c) >>> 0, (segX + dy) >>> 0)
        m.setU32((pMisParam + 0x20) >>> 0, (segY - dx) >>> 0)
        const pMis2 = MISSILE_CreateServerProjectile113c(m, pGame, pMisParam) >>> 0
        if (pMis2 !== 0) {
          MISSILE_SetTargetX113c(m, pMis2, m.u32((pCenterSeg + 0x0c) >>> 0))
          MISSILE_SetTargetY113c(m, pMis2, nHalfLen)
        }
      }
    }
    return 1
  } finally {
    freeW14B1Stack(sp)
  }
}
/**
 * [14/44] SrvDo handler for Necromancer Iron Golem: consumes metal ground item, spawns golem, equips item, and initializes summon stats.
 * @dll D2Game.dll
 * @va 0x6FC71540
 * @ordinalOrName D2Game_6FC71540
 */
export function SKILLS_SrvDo_IronGolem_6FC71540_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  onSpawnPet?: (m: SparseMemory113c, pGame: number, pSummonArg: number) => number,
  onInitGolemStats?: (
    m: SparseMemory113c,
    pGame: number,
    pOwnerUnit: number,
    pPetUnit: number,
    nSkillId: number,
    nSkillLevel: number,
  ) => void,
): number {
  hitD2GameVa113c(0x6FC71540)
  if (
    SKILLS_SrvSt20_CanCreateIronGolemOnItem_6FC6EDD0_113c(
      m,
      pGame,
      pUnit,
      nSkillId,
      nSkillLevel,
    ) === 0
  ) {
    return 0
  }
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
  if (nSkillId === 0) return 0
  const sp = allocW14B1Stack(m, 0x40)
  try {
    const pOutBodyLoc2 = sp >>> 0
    const pOutSpawnMode = (sp + 0x04) >>> 0
    const pOutBodyLoc1 = (sp + 0x08) >>> 0
    const pSummonArg = (sp + 0x0c) >>> 0
    const nMonId = SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
      m,
      0,
      0,
      pOutSpawnMode,
      pUnit,
      0,
      nSkillId,
      nSkillLevel,
    )
    if (nMonId < 0) return 0
    const pDataTables = m.u32(m.u32(0x6fd1829c))
    let bPetType = m.u8((pSkillsTxt + 0xbe) >>> 0)
    if (bPetType >= m.u32((pDataTables + 0xbf0) >>> 0)) {
      bPetType = 0
    }
    m.setU32(pSummonArg, 1)
    m.setU32((pSummonArg + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pSummonArg + 0x08) >>> 0, nMonId >>> 0)
    m.setU32((pSummonArg + 0x0c) >>> 0, 0)
    m.setU32((pSummonArg + 0x10) >>> 0, m.u32(pOutSpawnMode))
    m.setU32((pSummonArg + 0x14) >>> 0, UNIT_GetPosX113c(m, pUnit) >>> 0)
    m.setU32((pSummonArg + 0x18) >>> 0, UNIT_GetPosY113c(m, pUnit) >>> 0)
    m.setU32((pSummonArg + 0x1c) >>> 0, bPetType)
    const nPetMax =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0xc0) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    m.setU32((pSummonArg + 0x20) >>> 0, nPetMax >>> 0)
    SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
    let pTargetItem = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
    if (pTargetItem === (pUnit >>> 0)) {
      pTargetItem = 0
    } else if (pTargetItem !== 0) {
      m.setU32((pSummonArg + 0x14) >>> 0, UNIT_GetPosX113c(m, pTargetItem) >>> 0)
      m.setU32((pSummonArg + 0x18) >>> 0, UNIT_GetPosY113c(m, pTargetItem) >>> 0)
    }
    const pGolem =
      (onSpawnPet !== undefined
        ? onSpawnPet(m, pGame, pSummonArg)
        : D2Game_6FCC3610_113c(m, pSummonArg, pGame)) >>> 0
    if (pGolem === 0) return 0
    if (pTargetItem !== 0) {
      const pItemRoom = UNITS_GetRoom113c(m, pTargetItem) >>> 0
      DUNGEON_AddRoomPortalNode113c(
        m,
        pItemRoom,
        m.u32(pTargetItem),
        m.u32((pTargetItem + 0x0c) >>> 0),
      )
      UNITS_SetTargetUnitForDynamicUnitEx113c(m, pTargetItem)
      UNITROOM_RemoveUnitFromRoom113c(m, pTargetItem)
      ITEMS_GetAllowedBodyLocations113c(m, pTargetItem, pOutBodyLoc1, pOutBodyLoc2)
      UNITS_ChangeAnimMode113c(m, pTargetItem, 4)
      const dwItemGuid = m.u32((pTargetItem + 0x0c) >>> 0)
      const bBodyLoc = m.u8(pOutBodyLoc1)
      ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c(m, pGolem, dwItemGuid, pGame, bBodyLoc, 1, 0)
    }
    if (onInitGolemStats !== undefined) {
      onInitGolemStats(m, pGame, pUnit, pGolem, nSkillId, nSkillLevel)
    } else {
      SKILLS_PostInitSummonedPetStatsAndAi_6FC70070_113c(
        m,
        pGolem,
        pUnit,
        nSkillLevel,
        pGame,
        nSkillId,
      )
    }
    const pClient =
      pUnit !== 0 && m.u32(pUnit) === 0
        ? m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0)
        : 0
    NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c(m, pClient, pGolem)
    SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(
      m,
      pGame,
      pGolem,
      m.u32((pUnit + 0xd0) >>> 0),
      0,
    )
    return 1
  } finally {
    freeW14B1Stack(sp)
  }
}

/**
 * [15/44] SrvDo handler for Necromancer Clay / Blood / Fire Golem.
 * @dll D2Game.dll
 * @va 0x6FC71750
 * @ordinalOrName D2Game_6FC71750
 */
export function SKILLS_SrvDo_ClayBloodFireGolem_6FC71750_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  onSpawnPet?: (m: SparseMemory113c, pGame: number, pSummonArg: number) => number,
  onInitGolemStats?: (
    m: SparseMemory113c,
    pGame: number,
    pOwnerUnit: number,
    pPetUnit: number,
    nSkillId: number,
    nSkillLevel: number,
  ) => void,
): number {
  hitD2GameVa113c(0x6FC71750)
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
  if (nSkillId === 0) return 0
  const nMonId = ((m.u16((pSkillsTxt + 0xbc) >>> 0) << 16) >> 16)
  const pDataTables = m.u32(m.u32(0x6fd1829c))
  if (nMonId < 0 || nMonId >= (m.u32((pDataTables + 0xa80) >>> 0) | 0)) return 0
  let bPetType = m.u8((pSkillsTxt + 0xbe) >>> 0)
  if (bPetType >= m.u32((pDataTables + 0xbf0) >>> 0)) {
    bPetType = 0
  }
  let bSpawnMode = m.u8((pSkillsTxt + 0xbf) >>> 0)
  if (bSpawnMode >= 0x10) {
    bSpawnMode = 1
  }
  const sp = allocW14B1Stack(m, 0x30)
  try {
    const pSummonArg = sp >>> 0
    m.setU32(pSummonArg, 0)
    m.setU32((pSummonArg + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pSummonArg + 0x08) >>> 0, nMonId >>> 0)
    m.setU32((pSummonArg + 0x0c) >>> 0, 0)
    m.setU32((pSummonArg + 0x10) >>> 0, bSpawnMode)
    m.setU32((pSummonArg + 0x1c) >>> 0, bPetType)
    const nPetMax =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0xc0) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    m.setU32((pSummonArg + 0x20) >>> 0, nPetMax >>> 0)
    const pGolem =
      (onSpawnPet !== undefined
        ? onSpawnPet(m, pGame, pSummonArg)
        : D2Game_6FCC3610_113c(m, pSummonArg, pGame)) >>> 0
    if (pGolem === 0) return 0
    if (onInitGolemStats !== undefined) {
      onInitGolemStats(m, pGame, pUnit, pGolem, nSkillId, nSkillLevel)
    } else {
      SKILLS_PostInitSummonedPetStatsAndAi_6FC70070_113c(
        m,
        pGolem,
        pUnit,
        nSkillLevel,
        pGame,
        nSkillId,
      )
    }
    const pClient =
      pUnit !== 0 && m.u32(pUnit) === 0
        ? m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0)
        : 0
    NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c(m, pClient, pGolem)
    SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(
      m,
      pGame,
      pGolem,
      m.u32((pUnit + 0xd0) >>> 0),
      0,
    )
    return 1
  } finally {
    freeW14B1Stack(sp)
  }
}

/**
 * [16/44] SrvDo handler for Necromancer Raise Skeleton / Raise Skeletal Mage.
 * @dll D2Game.dll
 * @va 0x6FC718B0
 * @ordinalOrName D2Game_6FC718B0
 */
export function SKILLS_SrvDo_RaiseSkeletonOrMage_6FC718B0_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  onSpawnPet?: (m: SparseMemory113c, pGame: number, pSummonArg: number) => number,
): number {
  hitD2GameVa113c(0x6FC718B0)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pCorpse = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (
    pCorpse === (pUnit >>> 0) ||
    pCorpse === 0 ||
    SKILLS_IsSelectableCorpseWithVelocity113c(m, pCorpse, 0) === 0
  ) {
    return 0
  }
  SKILLS_ApplyPaladinEighthMaxLifeCost_6FC6F450_113c(m, pUnit, pGame)
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
  if (pSkillsTxt === 0) return 0
  const sp = allocW14B1Stack(m, 0x38)
  try {
    const pOutSpawnMode = sp >>> 0
    const pSummonArg = (sp + 0x08) >>> 0
    const nMonId = SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
      m,
      0,
      0,
      pOutSpawnMode,
      pUnit,
      0,
      nSkillId,
      nSkillLevel,
    )
    if (nMonId < 0) return 0
    const nPetType = (m.u8((pSkillsTxt + 0xbe) >>> 0) << 24) >> 24
    const pDataTables = m.u32(m.u32(0x6fd1829c))
    if (nPetType < 0 || nPetType >= (m.u32((pDataTables + 0xbf0) >>> 0) | 0)) return 0
    const corpseX = UNIT_GetPosX113c(m, pCorpse) | 0
    const corpseY = UNIT_GetPosY113c(m, pCorpse) | 0
    const pCorpseRoom = UNITS_GetRoom113c(m, pCorpse) >>> 0
    DUNGEON_AddRoomPortalNode113c(
      m,
      pCorpseRoom,
      m.u32(pCorpse),
      m.u32((pCorpse + 0x0c) >>> 0),
    )
    SUNIT_FreeUnit113c(m, pGame, pCorpse)
    m.setU32(pSummonArg, 1)
    m.setU32((pSummonArg + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pSummonArg + 0x08) >>> 0, nMonId >>> 0)
    m.setU32((pSummonArg + 0x0c) >>> 0, 0)
    m.setU32((pSummonArg + 0x10) >>> 0, m.u32(pOutSpawnMode))
    m.setU32((pSummonArg + 0x14) >>> 0, corpseX >>> 0)
    m.setU32((pSummonArg + 0x18) >>> 0, corpseY >>> 0)
    m.setU32((pSummonArg + 0x1c) >>> 0, nPetType >>> 0)
    const nPetMax =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillsTxt + 0xc0) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    m.setU32((pSummonArg + 0x20) >>> 0, nPetMax >>> 0)
    const pSkeleton =
      (onSpawnPet !== undefined
        ? onSpawnPet(m, pGame, pSummonArg)
        : D2Game_6FCC3610_113c(m, pSummonArg, pGame)) >>> 0
    if (pSkeleton === 0) return 0
    SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c(m, pUnit, 0, pGame, pSkeleton, nSkillLevel)
    SKILLS_InitNecroSkeletonPetComponents_6FC6EB50_113c(
      m,
      pSkeleton,
      pUnit,
      nSkillId,
      nSkillLevel,
    )
    SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c(
      m,
      pGame,
      pUnit,
      pSkeleton,
      nSkillId,
      nSkillLevel,
      0,
    )
    SKILLS_ApplySummonResistStatList_6FC6E180_113c(m, pUnit, pSkeleton)
    SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(
      m,
      pGame,
      pSkeleton,
      m.u32((pUnit + 0xd0) >>> 0),
      0,
    )
    return 1
  } finally {
    freeW14B1Stack(sp)
  }
}

/**
 * [17/44] Act 5 Quest 2 (Rescue on Mount Arreat) Qual-Kehk scroll callback (`0x4E80` / `0x4E8E` rune reward).
 * @dll D2Game.dll
 * @va 0x6FC7C9E0
 * @ordinalOrName D2Game_6FC7C9E0
 */
export function ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
  onCreateQuestItem?: (
    m: SparseMemory113c,
    pGame: number,
    pPlayerUnit: number,
    dwItemCode: number,
    nItemLevel: number,
    nQuality: number,
    bDropIfFull: number,
  ) => number,
  onQuestCallbackF0?: (m: SparseMemory113c, pQuestData: number) => void,
): void {
  hitD2GameVa113c(0x6FC7C9E0)
  const wNpcClassId = m.u16((pQuestArg + 0x14) >>> 0)
  const wScrollId = m.u16((pQuestArg + 0x18) >>> 0)
  const pExt = m.u32((pQuestData + 0x18) >>> 0)
  if (wNpcClassId !== 0x203) return
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0)
  const pQuestGame = m.u32((pQuestData + 0x04) >>> 0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const bDiff = m.u8((pQuestGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + 0x10 + (bDiff << 2)) >>> 0)
  if (wScrollId === 0x4e80) {
    m.setU8((pExt + 0x84) >>> 0, 1)
    m.setU8((pQuestData + 0x0c) >>> 0, 2)
    if (m.u32(0x6fd31c20) !== 0) {
      const sp = allocW14B1Stack(m, 0x80)
      try {
        writeAsciiStr113c(m, sp, 'changing state to 2\n')
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, sp, m.u32((pQuestData + 0x04) >>> 0), 4)
      } finally {
        freeW14B1Stack(sp)
      }
    }
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      (mem, pGameArg, pUnitArg) =>
        ACT5Q2_SyncPlayerQuestStateWithQuest20_6FC78530_113c(mem, pGameArg, pUnitArg),
      0,
      0,
    )
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((pQuestArg + 0x08) >>> 0),
      pPlayer,
      m.u32(pQuestArg),
    )
    return
  }
  if (wScrollId !== 0x4e8e) return
  const dwQuestId = m.u32((pQuestData + 0xe0) >>> 0)
  if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, dwQuestId, 1) !== 1) return
  let bCreatedAny = 0
  if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, dwQuestId, 0x0d) !== 0) {
    if (m.u8((pQuestData + 0x0c) >>> 0) !== 5) {
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 5)
      if (m.u32((pQuestData + 0xf0) >>> 0) === 0) {
        throw new D2CommonAssertError('0x6fd19ff9', 0x129)
      }
      dispatchQuestSeqFilterF0_113c(m, pQuestData, onQuestCallbackF0)
      m.setU8((pQuestData + 0x14) >>> 0, 0)
      m.setU8((pQuestData + 0x0b) >>> 0, 0x0d)
    }
    m.setU32((pQuestData + 0xa8) >>> 0, 0)
  }
  let nRunesToGrant = 3
  if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, 0x24, 6) !== 0) {
    nRunesToGrant = 2
  } else if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, 0x24, 7) !== 0) {
    nRunesToGrant = 1
  }
  const pArgGame = m.u32(pQuestArg)
  for (let i = 0; i < nRunesToGrant; i = (i + 1) | 0) {
    const dwRuneCode = ACT5Q2_RUNE_CODES_6FD2BC38[i]!
    const pItem =
      (onCreateQuestItem !== undefined
        ? onCreateQuestItem(m, pArgGame, pPlayer, dwRuneCode, 0, 2, 1)
        : D2Game_6FC56470_113c(m, 0, dwRuneCode, pPlayer, pArgGame, 2, 1)) >>> 0
    if (pItem !== 0) {
      bCreatedAny = 1
    }
  }
  if (bCreatedAny !== 0) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, dwQuestId, 0)
    QUESTRECORD_ClearQuestState113c(m, pQuestFlags, dwQuestId, 1)
    QUESTRECORD_ClearQuestStateBits2To11_113c(m, pQuestFlags, dwQuestId)
    const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) : 0xffffffff
    QUESTS_GuidListAdd113c(m, (pQuestData + 0x1c) >>> 0, dwPlayerGuid)
    const sp = allocW14B1Stack(m, 0x10)
    try {
      const pClient =
        pPlayer !== 0 && m.u32(pPlayer) === 0
          ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0)
          : 0
      m.setU8(sp, 0x5d)
      m.setU8((sp + 1) >>> 0, 0x20)
      m.setU8((sp + 2) >>> 0, 2)
      m.setU8((sp + 3) >>> 0, 0)
      m.setU16((sp + 4) >>> 0, 0)
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 6)
    } finally {
      freeW14B1Stack(sp)
    }
  }
  QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
    m,
    m.u32((pQuestArg + 0x08) >>> 0),
    pPlayer,
    m.u32(pQuestArg),
  )
}
/**
 * [18/44] Act 5 Quest 3 (Prison of Ice) Malah (`0x201`) and Anya (`0x200`) scroll callback.
 * @dll D2Game.dll
 * @va 0x6FC7F5E0
 * @ordinalOrName D2Game_6FC7F5E0
 */
export function ACT5Q3_OnMalahOrAnyaScrollCallback_6FC7F5E0_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
  onCreateQuestItem?: (
    m: SparseMemory113c,
    pGame: number,
    pPlayerUnit: number,
    dwItemCode: number,
    nItemLevel: number,
    nQuality: number,
    bDropIfFull: number,
  ) => number,
): void {
  hitD2GameVa113c(0x6FC7F5E0)
  const createQuestItem = (
    dwItemCode: number,
    nItemLevel: number,
    nQuality: number,
    bDropIfFull: number,
  ): number =>
    (onCreateQuestItem !== undefined
      ? onCreateQuestItem(m, pArgGame, pPlayer, dwItemCode, nItemLevel, nQuality, bDropIfFull)
      : D2Game_6FC56470_113c(m, nItemLevel, dwItemCode, pPlayer, pArgGame, nQuality, bDropIfFull)) >>>
    0
  const pExt = m.u32((pQuestData + 0x18) >>> 0)
  const wScrollId = m.u16((pQuestArg + 0x18) >>> 0)
  const pArgGame = m.u32(pQuestArg)
  const wNpcClassId = m.u16((pQuestArg + 0x14) >>> 0)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const bDiff = m.u8((pArgGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + 0x10 + (bDiff << 2)) >>> 0)
  if (wNpcClassId === 0x201) {
    if (wScrollId === 0x4e94) {
      m.setU8((pExt + 0xac) >>> 0, 1)
      m.setU8((pQuestData + 0x0c) >>> 0, 2)
      if (m.u32(0x6fd31c20) !== 0) {
        const sp = allocW14B1Stack(m, 0x80)
        try {
          writeAsciiStr113c(m, sp, 'changing state to 2\n')
          NET_BroadcastSystemChatMessage_6FCEBE70_113c(
            m,
            sp,
            m.u32((pQuestData + 0x04) >>> 0),
            4,
          )
        } finally {
          freeW14B1Stack(sp)
        }
      }
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuestData + 0x04) >>> 0),
        (mem, pGameArg, pUnitArg, pCbArg) =>
          ACT5Q3_SyncPrisonOfIceQuestStateCallback_6FC78110_113c(mem, pGameArg, pUnitArg, pCbArg),
        0,
        0,
      )
      QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
        m,
        m.u32((pQuestArg + 0x08) >>> 0),
        pPlayer,
        pArgGame,
      )
      return
    }
    if (wScrollId === 0x4e9f) {
      if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pArgGame, 0x20656369) !== 0) {
        return
      }
      if (m.u32((pExt + 0xd8) >>> 0) !== 0) return
      const pPotion = createQuestItem(0x20656369, 0, 2, 1)
      if (pPotion === 0) return
      m.setU32((pExt + 0xd8) >>> 0, (m.u32((pExt + 0xd8) >>> 0) + 1) >>> 0)
      const sp = allocW14B1Stack(m, 0x10)
      try {
        const pClient =
          pPlayer !== 0 && m.u32(pPlayer) === 0
            ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0)
            : 0
        m.setU8(sp, 0x5d)
        m.setU8((sp + 1) >>> 0, 0x21)
        m.setU8((sp + 2) >>> 0, 1)
        m.setU8((sp + 3) >>> 0, 0)
        m.setU16((sp + 4) >>> 0, 0)
        NET_SendPacketBuffer6B_6FCAACD0_113c(m, sp, pClient)
      } finally {
        freeW14B1Stack(sp)
      }
      m.setU8((pExt + 0x101) >>> 0, 1)
      return
    }
    if (wScrollId === 0x4ea4) {
      if (
        QUESTRECORD_GetQuestState113c(m, pQuestFlags, 0x25, 1) !== 0 &&
        QUESTRECORD_GetQuestState113c(m, pQuestFlags, 0x25, 0) === 0
      ) {
        const pScroll = createQuestItem(0x20327274, 0, 2, 1)
        if (pScroll === 0) return
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x25, 8)
        const sp = allocW14B1Stack(m, 0x10)
        try {
          const pClient =
            pPlayer !== 0 && m.u32(pPlayer) === 0
              ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0)
              : 0
          m.setU8(sp, 0x5d)
          m.setU8((sp + 1) >>> 0, 0x21)
          m.setU8((sp + 2) >>> 0, 2)
          m.setU8((sp + 3) >>> 0, 0)
          m.setU16((sp + 4) >>> 0, 0)
          NET_SendPacketBuffer6B_6FCAACD0_113c(m, sp, pClient)
        } finally {
          freeW14B1Stack(sp)
        }
        if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, 0x25, 9) !== 0) {
          QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x25, 1)
          QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x25, 0)
        } else if (m.u8((pQuestData + 0x09) >>> 0) !== 0 && m.u8((pQuestData + 0x0b) >>> 0) < 6) {
          m.setU8((pQuestData + 0x14) >>> 0, 0)
          m.setU8((pQuestData + 0x0b) >>> 0, 6)
          SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
            m,
            m.u32((pQuestData + 0x04) >>> 0),
            (mem, pGameArg, pUnitArg) =>
              ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c(mem, pGameArg, pUnitArg),
            0,
            0,
          )
        }
        if (m.u32((pExt + 0x84) >>> 0) === 1) {
          m.setU8((pExt + 0xe3) >>> 0, 0)
          SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
            m,
            m.u32((pQuestData + 0x04) >>> 0),
            (mem, pGameArg, pUnitArg) =>
              ACT5Q3_TryUseThawPotionOnFrozenAnya_6FC7DDF0_113c(mem, pGameArg, pUnitArg),
            1,
            0,
          )
          if (m.u8((pExt + 0xe3) >>> 0) === 0) {
            MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c(
              m,
              4,
              0x20f,
              m.u32((pQuestData + 0x04) >>> 0),
            )
          }
          m.setU8((pExt + 0xad) >>> 0, 1)
          m.setU32((pExt + 0x84) >>> 0, 2)
          ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c(m, pQuestData, pExt)
        }
        QUESTS_SendPlayerQuestLogPacket28_113c(m, pPlayer, pArgGame)
        return
      }
      const dwQuestId = m.u32((pQuestData + 0xe0) >>> 0)
      if (
        QUESTRECORD_GetQuestState113c(m, pQuestFlags, dwQuestId, 0) === 0 &&
        QUESTRECORD_GetQuestState113c(m, pQuestFlags, dwQuestId, 0x0f) === 0
      ) {
        return
      }
      if (m.u8((pExt + 0x102) >>> 0) !== 0) return
      if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, 0x25, 8) === 0) return
      if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, dwQuestId, 7) !== 0) return
      if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pArgGame, 0x20327274) !== 0) {
        return
      }
      const pScroll = createQuestItem(0x20327274, 0, 2, 1)
      if (pScroll === 0) return
      m.setU8((pExt + 0x102) >>> 0, 1)
      return
    }
  } else if (wNpcClassId === 0x200 && wScrollId === 0x4ea8) {
    if (
      QUESTRECORD_GetQuestState113c(m, pQuestFlags, 0x25, 1) === 0 ||
      QUESTRECORD_GetQuestState113c(m, pQuestFlags, 0x25, 0) !== 0
    ) {
      return
    }
    const nPlayerLvl = STATLIST_GetUnitStat113c(m, pPlayer, 0x0c, 0) >>> 0
    let codeTable = ACT5Q3_ANYA_CODES_NORM_6FD2F1CC
    const bGameDiff = m.u8((pArgGame + 0x6d) >>> 0)
    if (bGameDiff === 1) {
      if (m.u8((pArgGame + 0x6a) >>> 0) === 3 || nPlayerLvl > 0x2d) {
        codeTable = ACT5Q3_ANYA_CODES_NM_6FD2F194
      }
    } else if (bGameDiff === 2) {
      if (m.u8((pArgGame + 0x6a) >>> 0) === 3 || nPlayerLvl > 0x41) {
        codeTable = ACT5Q3_ANYA_CODES_HELL_6FD2F15C
      }
    }
    if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, 0x25, 0x0a) !== 0) return
    const nClassId = pPlayer !== 0 ? m.u32((pPlayer + 0x04) >>> 0) : 0xffffffff
    const pSeed = QUESTS_GetQuestSeedPtr_6FC53D90_113c(m, pArgGame) >>> 0
    const row = codeTable[nClassId] !== undefined ? codeTable[nClassId]! : codeTable[0]!
    const nRoll = SEED_RollRangeHalfOpen113c(m, pSeed, 0, row.length) >>> 0
    const dwRewardCode = row[nRoll] !== undefined ? row[nRoll]! : row[0]!
    const nDropItemLvl = ITEMS_GetDropItemLevel_6FC2E5D0_113c(m, pArgGame, pPlayer, 0)
    const pRewardItem = createQuestItem(dwRewardCode, nDropItemLvl, 6, 1)
    if (pRewardItem === 0) return
    const sp = allocW14B1Stack(m, 0x10)
    try {
      m.setU8(sp, 0x5d)
      m.setU8((sp + 1) >>> 0, 0x21)
      m.setU8((sp + 2) >>> 0, 0x10)
      m.setU8((sp + 3) >>> 0, 0)
      m.setU16((sp + 4) >>> 0, 0)
      const pTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, (m.u32((pRewardItem + 0x04) >>> 0) | 0)) >>> 0
      if (pTxt !== 0) {
        const wSound = ((m.u16((pTxt + 0x124) >>> 0) << 16) >> 16)
        if (wSound > 0) {
          m.setU16((sp + 4) >>> 0, wSound & 0xffff)
        }
      }
      const pClient =
        pPlayer !== 0 && m.u32(pPlayer) === 0
          ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0)
          : 0
      NET_SendPacketBuffer6B_6FCAACD0_113c(m, sp, pClient)
    } finally {
      freeW14B1Stack(sp)
    }
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x25, 9)
    if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, 0x25, 8) !== 0) {
      QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x25, 1)
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x25, 0)
    }
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x25, 0x0a)
    return
  }
  if (wScrollId === 0x4ea3 && m.u8((pQuestData + 0x09) >>> 0) !== 0) {
    if (m.u8((pQuestData + 0x0c) >>> 0) <= 3) {
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 4)
      ACT5Q3_CleanupFrozenAnyaAndTownNpcState_6FC7EC30_113c(m, pQuestData)
    }
    if (m.u8((pQuestData + 0x0b) >>> 0) < 3) {
      m.setU8((pQuestData + 0x14) >>> 0, 0)
      m.setU8((pQuestData + 0x0b) >>> 0, 3)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuestData + 0x04) >>> 0),
        (mem, pGameArg, pUnitArg) =>
          ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c(mem, pGameArg, pUnitArg),
        0,
        0,
      )
    }
  }
}

/**
 * [19/44] Act 1 Quest 3 (The Search for Cain) NPC init callback (`0x6FC86960`).
 * @dll D2Game.dll
 * @va 0x6FC86960
 * @ordinalOrName D2Game_6FC86960
 */
export function ACT1Q3_OnNpcInitCainSearch_6FC86960_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
  onDeletePlayerQuestItem?: (
    m: SparseMemory113c,
    pPlayerUnit: number,
    pItem: number,
    pGame: number,
    pInventory: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FC86960)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0)
  const pArgGame = m.u32(pQuestArg)
  const pBksItem = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pArgGame, 0x20736b62) >>> 0
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0)
  const nNpcClassId = pNpc !== 0 ? (m.u32((pNpc + 0x04) >>> 0) | 0) : -1
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const bDiff = m.u8((pArgGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + 0x10 + (bDiff << 2)) >>> 0)
  const pExt = m.u32((pQuestData + 0x18) >>> 0)
  if (nNpcClassId === 0x92) {
    QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 9, m.u32((pQuestArg + 0x14) >>> 0), nNpcClassId)
  }
  if (m.u8((pExt + 0x4f) >>> 0) === 1) {
    if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pArgGame, 0x20646b62) !== 0) {
      const pBkdItem = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pArgGame, 0x20646b62) >>> 0
      if (pBkdItem !== 0) {
        const pInv = m.u32((pPlayer + 0x60) >>> 0)
        if (onDeletePlayerQuestItem !== undefined) {
          onDeletePlayerQuestItem(m, pPlayer, pBkdItem, pArgGame, pInv)
        } else {
          D2Game_6FC565E0_113c(m, pBkdItem, pPlayer, pArgGame, pInv)
        }
      }
      m.setU32((pExt + 0x7c) >>> 0, (m.u32((pExt + 0x7c) >>> 0) - 1) >>> 0)
    }
  }
  const bState1 = QUESTRECORD_GetQuestState113c(m, pQuestFlags, 4, 1)
  const bState0D = QUESTRECORD_GetQuestState113c(m, pQuestFlags, 4, 0x0d)
  if (nNpcClassId === 0x109) {
    const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) : 0xffffffff
    const nCount = m.u16((pExt + 0x1b8) >>> 0)
    let bFound = 0
    for (let i = 0; i < nCount; i = (i + 1) | 0) {
      if (m.u32((pExt + 0x138 + (i << 2)) >>> 0) === dwPlayerGuid) {
        bFound = 1
        break
      }
    }
    if (bFound === 0 && bState0D !== 0) {
      QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 5, m.u32((pQuestArg + 0x14) >>> 0), 0x109)
      return
    }
  }
  if (bState1 !== 0) {
    if (nNpcClassId === 0x109) {
      const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) : 0xffffffff
      const nCount = m.u16((pExt + 0x1b8) >>> 0)
      for (let i = 0; i < nCount; i = (i + 1) | 0) {
        if (m.u32((pExt + 0x138 + (i << 2)) >>> 0) === dwPlayerGuid) {
          QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 7, m.u32((pQuestArg + 0x14) >>> 0), 0x109)
          return
        }
      }
      QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 5, m.u32((pQuestArg + 0x14) >>> 0), 0x109)
      return
    }
    QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 5, m.u32((pQuestArg + 0x14) >>> 0), nNpcClassId)
    return
  }
  const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) : 0xffffffff
  const nListCount = m.u16((pExt + 0x134) >>> 0)
  for (let i = 0; i < nListCount; i = (i + 1) | 0) {
    if (m.u32((pExt + 0xb4 + (i << 2)) >>> 0) === dwPlayerGuid) {
      QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 6, m.u32((pQuestArg + 0x14) >>> 0), nNpcClassId)
      return
    }
  }
  const nQuestGuidCount = m.u16((pQuestData + 0x9c) >>> 0)
  let bInQuestGuids = 0
  for (let i = 0; i < nQuestGuidCount; i = (i + 1) | 0) {
    if (m.u32((pQuestData + 0x1c + (i << 2)) >>> 0) === dwPlayerGuid) {
      bInQuestGuids = 1
      break
    }
  }
  if (bInQuestGuids !== 0 && nNpcClassId === 0x109) {
    if (QUESTS_GuidListContains113c(m, (pExt + 0x138) >>> 0, dwPlayerGuid) === 0) {
      QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 5, m.u32((pQuestArg + 0x14) >>> 0), 0x109)
      return
    }
  }
  if (QUESTS_HasPlayerGuidInQuest113c(m, pQuestData, dwPlayerGuid) === 1) {
    if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, 4, 0x0e) !== 0) {
      QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 8, m.u32((pQuestArg + 0x14) >>> 0), nNpcClassId)
      return
    }
    if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, 4, 0) !== 0) {
      QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 7, m.u32((pQuestArg + 0x14) >>> 0), nNpcClassId)
    }
    return
  }
  if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, 4, 0x0e) !== 0) return
  const bState0C = m.u8((pQuestData + 0x0c) >>> 0)
  if (bState0C === 0) return
  if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, 4, 0) === 1) return
  if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, 4, 0x0f) !== 0) return
  if (pBksItem !== 0) {
    QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 3, m.u32((pQuestArg + 0x14) >>> 0), nNpcClassId)
    return
  }
  let nDialogIdx = -1
  if (bState0C === 4) {
    nDialogIdx = 2
  } else if (bState0C < 6) {
    nDialogIdx = ACT1Q3_CAIN_STATES_6FD293A8[bState0C]!
  }
  if (nDialogIdx >= 0 && nDialogIdx < 0x0b) {
    QUESTS_AddNpcDialogTextNodes113c(
      m,
      pQuestData,
      nDialogIdx,
      m.u32((pQuestArg + 0x14) >>> 0),
      nNpcClassId,
    )
  }
}

/**
 * [20/44] Act 1 Quest 3 (The Search for Cain) scroll message callback (`0x94` Akara / `0x109` Cain).
 * @dll D2Game.dll
 * @va 0x6FC86CE0
 * @ordinalOrName D2Game_6FC86CE0
 */
export function ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
  onDeletePlayerQuestItem?: (
    m: SparseMemory113c,
    pPlayerUnit: number,
    pItem: number,
    pGame: number,
    pInventory: number,
  ) => void,
  onCreateQuestItem?: (
    m: SparseMemory113c,
    pGame: number,
    pPlayerUnit: number,
    dwItemCode: number,
    nItemLevel: number,
    nQuality: number,
    bDropIfFull: number,
  ) => number,
  onQuestCallbackF0?: (m: SparseMemory113c, pQuestData: number) => void,
): void {
  hitD2GameVa113c(0x6FC86CE0)
  const wNpcClassId = m.u16((pQuestArg + 0x14) >>> 0)
  const pArgGame = m.u32(pQuestArg)
  const pExt = m.u32((pQuestData + 0x18) >>> 0)
  const wScrollId = m.u16((pQuestArg + 0x18) >>> 0)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const bDiff = m.u8((pArgGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + 0x10 + (bDiff << 2)) >>> 0)
  if (wNpcClassId === 0x94) {
    if (wScrollId === 0x61) {
      m.setU8((pExt + 0x53) >>> 0, 1)
      m.setU8((pQuestData + 0x0c) >>> 0, 2)
      if (m.u32(0x6fd31c20) !== 0) {
        const sp = allocW14B1Stack(m, 0x80)
        try {
          writeAsciiStr113c(m, sp, 'changing state to 2\n')
          NET_BroadcastSystemChatMessage_6FCEBE70_113c(
            m,
            sp,
            m.u32((pQuestData + 0x04) >>> 0),
            4,
          )
        } finally {
          freeW14B1Stack(sp)
        }
      }
      QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
        m,
        m.u32((pQuestArg + 0x08) >>> 0),
        pPlayer,
        m.u32(pQuestArg),
      )
      return
    }
    if (wScrollId === 0x70) {
      if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pArgGame, 0x20736b62) === 0) {
        return
      }
      const pBks = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pArgGame, 0x20736b62) >>> 0
      if (pBks !== 0) {
        const pInv = m.u32((pPlayer + 0x60) >>> 0)
        if (onDeletePlayerQuestItem !== undefined) {
          onDeletePlayerQuestItem(m, pPlayer, pBks, pArgGame, pInv)
        } else {
          D2Game_6FC565E0_113c(m, pBks, pPlayer, pArgGame, pInv)
        }
      }
      const pCreateGame = m.u32(pQuestArg)
      const pBkd =
        (onCreateQuestItem !== undefined
          ? onCreateQuestItem(m, pCreateGame, pPlayer, 0x20646b62, 0, 2, 1)
          : D2Game_6FC56470_113c(m, 0, 0x20646b62, pPlayer, pCreateGame, 2, 1)) >>> 0
      if (pBkd !== 0) {
        m.setU8((pExt + 0x64) >>> 0, 1)
        m.setU8((pExt + 0x4b) >>> 0, 1)
        m.setU8((pExt + 0x4e) >>> 0, 1)
        m.setU32((pExt + 0x38) >>> 0, m.u32((pBkd + 0x0c) >>> 0))
        if (m.u32(0x6fd31c20) !== 0) {
          NET_BroadcastSystemChatMessage_6FCEBE70_113c(
            m,
            0x6fd1bf18,
            m.u32((pQuestData + 0x04) >>> 0),
            4,
          )
        }
        QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 5)
        m.setU8((pQuestData + 0x14) >>> 0, 0)
        m.setU8((pQuestData + 0x0b) >>> 0, 3)
      } else {
        m.setU32((pExt + 0x7c) >>> 0, (m.u32((pExt + 0x7c) >>> 0) - 1) >>> 0)
      }
      return
    }
    if (wScrollId === 0x76) {
      if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, 4, 1) === 0) return
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 4, 0)
      QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 4, 1)
      const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) : 0xffffffff
      QUESTS_GuidListAdd113c(m, (pQuestData + 0x1c) >>> 0, dwPlayerGuid)
      QUESTS_SendPlayerQuestLogPacket28_113c(m, pPlayer, m.u32((pQuestData + 0x04) >>> 0))
      const pRingGame = m.u32(pQuestArg)
      const bRingDiff = m.u8((pRingGame + 0x6d) >>> 0)
      let nRingLvl = 7
      let nRingQual = 4
      if (bRingDiff === 1) {
        nRingLvl = 0x1e
        nRingQual = 6
      } else if (bRingDiff === 2) {
        nRingLvl = 0x3c
        nRingQual = 6
      }
      if (onCreateQuestItem !== undefined) {
        onCreateQuestItem(m, pRingGame, pPlayer, 0x206e6972, nRingLvl, nRingQual, 1)
      } else {
        D2Game_6FC56470_113c(m, nRingLvl, 0x206e6972, pPlayer, pRingGame, nRingQual, 1)
      }
      QUESTS_SendQuestItemState2_5D_113c(m, pPlayer, 4)
      QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
        m,
        m.u32((pQuestArg + 0x08) >>> 0),
        pPlayer,
        m.u32(pQuestArg),
      )
      if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, 4, 0x0d) !== 0) {
        if (m.u8((pQuestData + 0x0b) >>> 0) !== 0x0d) {
          m.setU8((pQuestData + 0x0b) >>> 0, 0x0d)
        }
        if (m.u8((pQuestData + 0x0c) >>> 0) !== 6) {
          QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 6)
        }
        if (QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, m.u32(pQuestArg), 4, 0x0d) === 0) {
          QUESTS_SetGlobalQuestState_6FC53920_113c(m, m.u32((pQuestData + 0x04) >>> 0), 4, 0x0d)
          if (m.u32((pQuestData + 0xf0) >>> 0) === 0) {
            throw new D2CommonAssertError('0x6fd19ff9', 0x194)
          }
          dispatchQuestSeqFilterF0_113c(m, pQuestData, onQuestCallbackF0)
        }
      }
      if (m.u8((pExt + 0x63) >>> 0) === 1) {
        QUESTS_SetGlobalQuestState_6FC53920_113c(m, m.u32((pQuestData + 0x04) >>> 0), 4, 0x0d)
      }
    }
    return
  }
  if (wNpcClassId === 0x109) {
    if (wScrollId === 0x7d) {
      const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) : 0xffffffff
      QUESTS_GuidListAdd113c(m, (pQuestData + 0x1c) >>> 0, dwPlayerGuid)
      QUESTS_GuidListRemove113c(m, (pExt + 0xb4) >>> 0, dwPlayerGuid)
      QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
        m,
        m.u32((pQuestArg + 0x08) >>> 0),
        pPlayer,
        m.u32(pQuestArg),
      )
    } else if (wScrollId === 0x7e || wScrollId === 0x7b) {
      const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) : 0xffffffff
      QUESTS_GuidListAdd113c(m, (pExt + 0x138) >>> 0, dwPlayerGuid)
      QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
        m,
        m.u32((pQuestArg + 0x08) >>> 0),
        pPlayer,
        m.u32(pQuestArg),
      )
    }
  }
}
function writeAsciiStr113c(m: SparseMemory113c, dst: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    m.setU8((dst + i) >>> 0, text.charCodeAt(i) & 0xff)
  }
  m.setU8((dst + text.length) >>> 0, 0)
}

/**
 * [21/44] Handles Act 1 Quest 5 (Tools of the Trade / Charsi Malus) scroll callback (`0x92` / `0xA3`).
 * @dll D2Game.dll
 * @va 0x6FC87000
 * @ordinalOrName D2Game_6FC87000
 */
export function ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
  onDeletePlayerQuestItem?: (
    m: SparseMemory113c,
    pPlayer: number,
    pItem: number,
    pGame: number,
    pInventory: number,
  ) => void,
  onQuestCallbackF0?: (m: SparseMemory113c, pQuestData: number) => void,
): void {
  hitD2GameVa113c(0x6FC87000)
  const wScrollId = m.u16((pQuestArg + 0x18) >>> 0)
  const pArgGame = m.u32(pQuestArg >>> 0)
  const wNpcClassId = m.u16((pQuestArg + 0x14) >>> 0)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0)
  const pHdm = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pArgGame, 0x206d6468) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pArgGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0)
  if (wNpcClassId !== 0x9a) {
    return
  }
  const pExt = m.u32((pQuestData + 0x18) >>> 0)
  if (wScrollId === 0xa3) {
    if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, 3, 0) !== 0) {
      return
    }
    const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) : 0xffffffff
    QUESTS_GuidListAdd113c(m, (pExt + 0x14) >>> 0, dwPlayerGuid)
    if (pHdm !== 0) {
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 3, 0x0d)
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 3, 1)
      QUESTS_SendPlayerQuestLogPacket28_113c(m, pPlayer, m.u32((pQuestData + 0x04) >>> 0))
      const pHdm2 = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pArgGame, 0x206d6468) >>> 0
      if (pHdm2 !== 0) {
        const pInv = m.u32((pPlayer + 0x60) >>> 0)
        if (onDeletePlayerQuestItem !== undefined) {
          onDeletePlayerQuestItem(m, pPlayer, pHdm2, pArgGame, pInv)
        } else {
          D2Game_6FC565E0_113c(m, pHdm2, pPlayer, pArgGame, pInv)
        }
      }
      m.setU32((pExt + 0x9c) >>> 0, (m.u32((pExt + 0x9c) >>> 0) - 1) >>> 0)
      const wPartyId = SUNITDMG_GetPlayerClientClassId113c(m, pPlayer) & 0xffff
      if (wPartyId !== 0xffff) {
        PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
          m,
          pArgGame,
          wPartyId,
          ACT1Q5_GrantImbueRewardIfLevel8Callback_6FC81D40_113c,
          0,
        )
      }
      if (m.u8((pQuestData + 0x09) >>> 0) !== 0) {
        if (m.u8((pQuestData + 0x0c) >>> 0) === 4) {
          QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 5)
          m.setU8((pExt + 0x03) >>> 0, 1)
          QUESTS_SetGlobalQuestState_6FC53920_113c(m, m.u32((pQuestData + 0x04) >>> 0), 3, 0x0d)
          if (m.u32((pQuestData + 0xf0) >>> 0) === 0) {
            throw new D2CommonAssertError('0x6fd19ff9', 0xfa)
          }
          dispatchQuestSeqFilterF0_113c(m, pQuestData, onQuestCallbackF0)
        } else if (m.u8((pExt + 0xa1) >>> 0) !== 0) {
          const pTargetQuest = QUESTS_GetQuestData_6FC53F30_113c(
            m,
            m.u32((pQuestData + 0x04) >>> 0),
            m.u32((pQuestData + 0x10) >>> 0),
          )
          if (pTargetQuest !== 0) {
            if (m.u32((pQuestData + 0xf0) >>> 0) === 0) {
              throw new D2CommonAssertError('0x6fd19ff9', 0x102)
            }
            dispatchQuestSeqFilterF0_113c(m, pTargetQuest, onQuestCallbackF0)
          }
        }
      }
    }
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((pQuestArg + 0x08) >>> 0),
      pPlayer,
      m.u32(pQuestArg >>> 0),
    )
  } else if (wScrollId === 0x92) {
    m.setU8((pQuestData + 0x0c) >>> 0, 2)
    if (m.u32(0x6fd31c20) !== 0) {
      const sp = allocW14B1Stack(m, 0x80)
      try {
        writeAsciiStr113c(m, sp, 'changing state to 2\n')
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, sp, m.u32((pQuestData + 0x04) >>> 0), 4)
      } finally {
        freeW14B1Stack(sp)
      }
    }
    m.setU8((pExt + 0x02) >>> 0, 1)
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((pQuestArg + 0x08) >>> 0),
      pPlayer,
      m.u32(pQuestArg >>> 0),
    )
  }
}

/**
 * [22/44] Handles Act 1 Quest 2 (Sisters' Burial Grounds / Blood Raven) Kashya scroll callback (`0x51` / `0x5C`).
 * @dll D2Game.dll
 * @va 0x6FC88920
 * @ordinalOrName D2Game_6FC88920
 */
export function ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
  onGrantMercReward_6FCE1030?: (
    m: SparseMemory113c,
    pGame: number,
    pPlayer: number,
    wNpcClassId: number,
  ) => void,
  onQuestCallbackF0?: (m: SparseMemory113c, pQuestData: number) => void,
): void {
  hitD2GameVa113c(0x6FC88920)
  const wScrollId = m.u16((pQuestArg + 0x18) >>> 0)
  const pArgGame = m.u32(pQuestArg >>> 0)
  const wNpcClassId = m.u16((pQuestArg + 0x14) >>> 0)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pArgGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0)
  if (wNpcClassId !== 0x96) {
    return
  }
  if (wScrollId === 0x51) {
    const pExt = m.u32((pQuestData + 0x18) >>> 0)
    m.setU8((pExt + 0x03) >>> 0, 1)
    m.setU8((pQuestData + 0x0c) >>> 0, 2)
    if (m.u32(0x6fd31c20) !== 0) {
      const sp = allocW14B1Stack(m, 0x80)
      try {
        writeAsciiStr113c(m, sp, 'changing state to 2\n')
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, sp, m.u32((pQuestData + 0x04) >>> 0), 4)
      } finally {
        freeW14B1Stack(sp)
      }
    }
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c,
      0,
      0,
    )
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((pQuestArg + 0x08) >>> 0),
      pPlayer,
      m.u32(pQuestArg >>> 0),
    )
  } else if (wScrollId === 0x5c) {
    const dwQuestId = (m.u32((pQuestData + 0xe0) >>> 0) | 0)
    if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, dwQuestId, 1) === 0) {
      return
    }
    if (
      QUESTRECORD_GetQuestState113c(m, pQuestFlags, dwQuestId, 0x0d) !== 0 &&
      m.u8((pQuestData + 0x0c) >>> 0) !== 5
    ) {
      m.setU8((pQuestData + 0x14) >>> 0, 0)
      m.setU8((pQuestData + 0x0b) >>> 0, 0x0d)
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 5)
      if (m.u32((pQuestData + 0xf0) >>> 0) === 0) {
        throw new D2CommonAssertError('0x6fd19ff9', 0xce)
      }
      dispatchQuestSeqFilterF0_113c(m, pQuestData, onQuestCallbackF0)
    }
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, (m.u32((pQuestData + 0xe0) >>> 0) | 0), 0)
    QUESTRECORD_ClearQuestState113c(m, pQuestFlags, (m.u32((pQuestData + 0xe0) >>> 0) | 0), 1)
    QUESTS_SendPlayerQuestLogPacket28_113c(m, pPlayer, m.u32((pQuestData + 0x04) >>> 0))
    const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) : 0xffffffff
    QUESTS_GuidListAdd113c(m, (pQuestData + 0x1c) >>> 0, dwPlayerGuid)
    const pQuestGame = m.u32((pQuestData + 0x04) >>> 0)
    if (onGrantMercReward_6FCE1030 !== undefined) {
      onGrantMercReward_6FCE1030(m, pQuestGame, pPlayer, 0x96)
    } else {
      D2Game_6FCE1030_113c(m, pQuestGame, pPlayer, 0x96)
    }
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((pQuestArg + 0x08) >>> 0),
      pPlayer,
      m.u32(pQuestArg >>> 0),
    )
  }
}

/**
 * [23/44] Evaluates all `Cubemain.txt` recipes against items in `pPlayer`'s Horadric Cube and executes the first matching recipe (`0x6FC92220`).
 * @dll D2Game.dll
 * @va 0x6FC92FC0
 * @ordinalOrName D2Game_6FC92FC0
 */
export function CUBE_TransmuteHoradricCubeItems_6FC92FC0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  onExecuteRecipe_6FC92220?: (
    m: SparseMemory113c,
    pGame: number,
    pPlayer: number,
    pRecipeTxt: number,
    pMatchedInputs: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FC92FC0)
  if (pPlayer === 0) {
    return
  }
  const nRecipes = DATATBLS_GetCubemainTxtRecordCount113c(m) | 0
  const nCubeItems = PLRTRADE_CountCubePageItemsInInventory113c(m, m.u32((pPlayer + 0x60) >>> 0)) | 0
  if (nCubeItems <= 0 || nRecipes <= 0) {
    return
  }
  const wDayOfWeekPlus1 = (m.u16(0x6fd31c00) + 1) | 0
  const wDayOfMonth = m.u16(0x6fd31c02) | 0
  const sp = allocW14B1Stack(m, 0x28)
  try {
    for (let i = 0; i < nRecipes; i = (i + 1) | 0) {
      const pRecipeTxt = DATATBLS_GetCubemainTxtRecord113c(m, i) >>> 0
      if (pRecipeTxt === 0) {
        return
      }
      if (m.u8(pRecipeTxt) === 0 && m.u32(0x6fd31c14) === 0) {
        continue
      }
      if (m.u32((pGame + 0x70) >>> 0) === 0 && m.u16((pRecipeTxt + 0x12) >>> 0) >= 0x64) {
        continue
      }
      if (
        m.u8((pGame + 0x6a) >>> 0) === 0 &&
        m.u32((pGame + 0x74) >>> 0) === 0 &&
        m.u8((pRecipeTxt + 0x01) >>> 0) !== 0
      ) {
        continue
      }
      if (m.u8((pRecipeTxt + 0x02) >>> 0) > m.u8((pGame + 0x6d) >>> 0)) {
        continue
      }
      const bClass = m.u8((pRecipeTxt + 0x03) >>> 0)
      if (bClass !== 0xff && bClass !== m.u32((pPlayer + 0x04) >>> 0)) {
        continue
      }
      if (m.u8((pRecipeTxt + 0x10) >>> 0) !== nCubeItems) {
        continue
      }
      const nOp = (m.u8((pRecipeTxt + 0x04) >>> 0) - 1) | 0
      if (nOp >= 0 && nOp <= 13) {
        if (nOp === 0) {
          if (
            (m.u32((pRecipeTxt + 0x08) >>> 0) | 0) > wDayOfMonth ||
            (m.u32((pRecipeTxt + 0x0c) >>> 0) | 0) < wDayOfMonth
          ) {
            continue
          }
        } else if (nOp === 1) {
          if ((m.u32((pRecipeTxt + 0x0c) >>> 0) | 0) !== wDayOfWeekPlus1) {
            continue
          }
        } else {
          const nStatId = (m.u32((pRecipeTxt + 0x08) >>> 0) | 0)
          const ppDataTables = m.u32(0x6fd1829c)
          const pDataTables = ppDataTables !== 0 ? m.u32(ppDataTables) : 0
          if (pDataTables !== 0 && nStatId >= 0 && nStatId <= (m.u32((pDataTables + 0xbd4) >>> 0) | 0)) {
            const pIsc = DATATBLS_GetItemStatCostRecordFast113c(m, nStatId) >>> 0
            if (pIsc === 0) {
              continue
            }
            const nShift = m.u8((pIsc + 0x18) >>> 0) & 0x1f
            const nTargetVal = (m.u32((pRecipeTxt + 0x0c) >>> 0) | 0) >> nShift
            let nActualVal = 0
            if (nOp >= 2 && nOp <= 5) {
              nActualVal = STATLIST_GetUnitStat113c(m, pPlayer, nStatId, 0) | 0
            } else if (nOp >= 6 && nOp <= 9) {
              nActualVal = STATLIST_GetUnitBaseStat113c(m, pPlayer, nStatId, 0) | 0
            } else {
              nActualVal = STATLIST_GetUnitStatBonus113c(m, pPlayer, nStatId, 0) | 0
            }
            const nCmpType = (nOp - 2) & 3
            if (nCmpType === 0 && nActualVal < nTargetVal) continue
            if (nCmpType === 1 && nActualVal > nTargetVal) continue
            if (nCmpType === 2 && nActualVal === nTargetVal) continue
            if (nCmpType === 3 && nActualVal !== nTargetVal) continue
          }
        }
      }
      for (let k = 0; k < 0x28; k += 4) {
        m.setU32((sp + k) >>> 0, 0)
      }
      if (
        CUBE_ValidateAllRecipeInputSlots_6FC90CF0_113c(
          m,
          pRecipeTxt,
          m.u32((pPlayer + 0x60) >>> 0),
          pGame,
          sp,
        ) !== 0
      ) {
        if (onExecuteRecipe_6FC92220 !== undefined) {
          onExecuteRecipe_6FC92220(m, pGame, pPlayer, pRecipeTxt, sp)
        } else {
          D2Game_6FC92220_113c(m, pGame, pPlayer, pRecipeTxt, sp)
        }
        return
      }
    }
  } finally {
    freeW14B1Stack(sp)
  }
}

/**
 * [24/44] Validates gold, inventory swap space, and cube contents, then executes a player-to-player trade swap (`0x6FC91E10`).
 * @dll D2Game.dll
 * @va 0x6FC93D90
 * @ordinalOrName D2Game_6FC93D90
 */
export function PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c(
  m: SparseMemory113c,
  pPlayerData1: number,
  pPlayer1: number,
  pPlayer2: number,
  pGame: number,
  pPlayerData2: number,
  onSwapItems?: (
    m: SparseMemory113c,
    pDestPlayer: number,
    pGame: number,
    pSrcPlayer: number,
  ) => number,
  onCancelTrade_6FC93BA0?: (
    m: SparseMemory113c,
    pPlayer1: number,
    pGame: number,
    pPlayerData1: number,
    pPlayerData2: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FC93D90)
  const sendTradePacket77 = (pUnit: number, bSubType: number): void => {
    const pClient =
      pUnit !== 0 && m.u32(pUnit) === 0
        ? m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0)
        : 0
    const spPkt = allocW14B1Stack(m, 4)
    try {
      m.setU8(spPkt, 0x77)
      m.setU8((spPkt + 1) >>> 0, bSubType & 0xff)
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, spPkt, 2)
    } finally {
      freeW14B1Stack(spPkt)
    }
  }

  const cancelTrade = (): void => {
    if (onCancelTrade_6FC93BA0 !== undefined) {
      onCancelTrade_6FC93BA0(m, pPlayer1, pGame, pPlayerData1, pPlayerData2)
      return
    }
    D2Game_6FC93BA0_113c(m, pPlayer1, pPlayer2, pGame, pPlayerData1, pPlayerData2)
  }

  const pTrade1 = m.u32((pPlayerData1 + 0x5c) >>> 0)
  const nGold1 = (m.u32((pTrade1 + 0x0c) >>> 0) | 0)
  if (nGold1 !== 0) {
    if ((STATLIST_GetUnitStat113c(m, pPlayer1, 0x0e, 0) | 0) < nGold1) {
      cancelTrade()
      return
    }
    const nPartnerTotal1 = (STATLIST_GetUnitStat113c(m, pPlayer2, 0x0e, 0) + nGold1) >>> 0
    if (nPartnerTotal1 > STATLIST_GetUnitGoldBankLimit113c(m, pPlayer2) >>> 0) {
      cancelTrade()
      sendTradePacket77(pPlayer1, 0x0a)
      sendTradePacket77(pPlayer2, 0x09)
      return
    }
  }

  const pTrade2 = m.u32((pPlayerData2 + 0x5c) >>> 0)
  const nGold2 = (m.u32((pTrade2 + 0x0c) >>> 0) | 0)
  if (nGold2 !== 0) {
    if ((STATLIST_GetUnitStat113c(m, pPlayer2, 0x0e, 0) | 0) < nGold2) {
      cancelTrade()
      return
    }
    const nPartnerTotal2 = (STATLIST_GetUnitStat113c(m, pPlayer1, 0x0e, 0) + nGold2) >>> 0
    if (nPartnerTotal2 > STATLIST_GetUnitGoldBankLimit113c(m, pPlayer1) >>> 0) {
      cancelTrade()
      sendTradePacket77(pPlayer1, 0x09)
      sendTradePacket77(pPlayer2, 0x0a)
      return
    }
  }

  const spReason = allocW14B1Stack(m, 4)
  let bCanSwap = 0
  let nFailSide = 0
  try {
    m.setU32(spReason, 0)
    bCanSwap =
      INVENTORY_CanTradeInventoriesSwap113c(
        m,
        m.u32((pGame + 0x1c) >>> 0),
        pPlayer1,
        pPlayer2,
        spReason,
      ) | 0
    nFailSide = m.u32(spReason)
  } finally {
    freeW14B1Stack(spReason)
  }

  if (bCanSwap === 0) {
    m.setU32((m.u32((pPlayerData1 + 0x5c) >>> 0) + 0x0c) >>> 0, 0)
    m.setU32((m.u32((pPlayerData2 + 0x5c) >>> 0) + 0x0c) >>> 0, 0)
    if (nFailSide !== 0) {
      sendTradePacket77(pPlayer1, 0x09)
      sendTradePacket77(pPlayer2, 0x0a)
    } else {
      sendTradePacket77(pPlayer1, 0x0a)
      sendTradePacket77(pPlayer2, 0x09)
    }
    cancelTrade()
    return
  }

  if (
    CUBE_CanPlayerPickupAllCubeItems_6FC91170_113c(m, pPlayer1, pGame, pPlayer2) === 0 ||
    CUBE_CanPlayerPickupAllCubeItems_6FC91170_113c(m, pPlayer2, pGame, pPlayer1) === 0
  ) {
    cancelTrade()
    return
  }

  if (pPlayer1 !== 0) {
    m.setU32((pPlayer1 + 0xc8) >>> 0, (m.u32((pPlayer1 + 0xc8) >>> 0) | 0x800000) >>> 0)
  }
  if (pPlayer2 !== 0) {
    m.setU32((pPlayer2 + 0xc8) >>> 0, (m.u32((pPlayer2 + 0xc8) >>> 0) | 0x800000) >>> 0)
  }
  m.setU32((pPlayerData1 + 0x50) >>> 0, 9)
  m.setU32((pPlayerData2 + 0x50) >>> 0, 9)
  const dwNextFrame = (m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, pGame, pPlayer1, 0x0d, dwNextFrame, 0, 0, 0)
  EVENT_SetEventFull113c(m, pGame, pPlayer2, 0x0d, dwNextFrame, 0, 0, 0)

  const swap1 =
    onSwapItems !== undefined
      ? onSwapItems(m, pPlayer2, pGame, pPlayer1)
      : D2Game_6FC91E10_113c(m, pPlayer2, pGame, pPlayer1)
  if ((swap1 & 0xff) === 0) {
    cancelTrade()
    return
  }
  const swap2 =
    onSwapItems !== undefined
      ? onSwapItems(m, pPlayer1, pGame, pPlayer2)
      : D2Game_6FC91E10_113c(m, pPlayer1, pGame, pPlayer2)
  if ((swap2 & 0xff) === 0) {
    cancelTrade()
    return
  }

  const pTradePost1 = m.u32((pPlayerData1 + 0x5c) >>> 0)
  const nGoldPost1 = (m.u32((pTradePost1 + 0x0c) >>> 0) | 0)
  if (nGoldPost1 !== 0) {
    if ((STATLIST_GetUnitStat113c(m, pPlayer1, 0x0e, 0) | 0) >= nGoldPost1) {
      STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, pPlayer1, 0x0e, -nGoldPost1)
    }
    ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c(
      m,
      pPlayer2,
      pGame,
      (m.u32((pTradePost1 + 0x0c) >>> 0) | 0),
    )
  }

  const pTradePost2 = m.u32((pPlayerData2 + 0x5c) >>> 0)
  const nGoldPost2 = (m.u32((pTradePost2 + 0x0c) >>> 0) | 0)
  if (nGoldPost2 !== 0) {
    if ((STATLIST_GetUnitStat113c(m, pPlayer2, 0x0e, 0) | 0) >= nGoldPost2) {
      STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, pPlayer2, 0x0e, -nGoldPost2)
    }
    ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c(
      m,
      pPlayer1,
      pGame,
      (m.u32((pTradePost2 + 0x0c) >>> 0) | 0),
    )
  }

  m.setU32((pPlayer1 + 0x68) >>> 0, 6)
  m.setU32((pPlayer1 + 0x64) >>> 0, 0xffffffff)
  m.setU8((pPlayer1 + 0x6c) >>> 0, 0)
  m.setU32((pPlayer2 + 0x68) >>> 0, 6)
  m.setU32((pPlayer2 + 0x64) >>> 0, 0xffffffff)
  m.setU8((pPlayer2 + 0x6c) >>> 0, 0)

  PLAYER_FreePlayerDataField5CList_6FC900C0_113c(m, pPlayer1, pGame)
  PLAYER_FreePlayerDataField5CList_6FC900C0_113c(m, pPlayer2, pGame)
  ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, pPlayer1)
  ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, pPlayer2)

  const pClient1 =
    m.u32(pPlayer1) === 0 ? m.u32((UNITS_GetPlayerData113c(m, pPlayer1) + 0x9c) >>> 0) : 0
  NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 0x0d, pClient1)
  const pClient2 =
    m.u32(pPlayer2) === 0 ? m.u32((UNITS_GetPlayerData113c(m, pPlayer2) + 0x9c) >>> 0) : 0
  NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 0x0d, pClient2)
}

/**
 * [25/44] Drops cursor and all equipped body items (`-1..12`) plus inventory gold (`0x0E`) to the ground on player death.
 * @dll D2Game.dll
 * @va 0x6FC98FA0
 * @ordinalOrName D2Game_6FC98FA0
 */
export function PLRDEATH_DropPlayerEquippedItemsAndGoldToCorpseOrGround_6FC98FA0_113c(
  m: SparseMemory113c,
  pPlayer: number,
  pGame: number,
  onRemoveEquippedItem_6FC98D00?: (
    m: SparseMemory113c,
    pPlayer: number,
    pItem: number,
    pGame: number,
    nBodyLoc: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FC98FA0)
  const sp = allocW14B1Stack(m, 0x20)
  try {
    const spCoordBox = sp >>> 0
    const spOutCoords = (sp + 0x10) >>> 0
    const pInventory = m.u32((pPlayer + 0x60) >>> 0)

    for (let nBodyLoc = -1; nBodyLoc < 13; nBodyLoc = (nBodyLoc + 1) | 0) {
      let pItem = 0
      if (nBodyLoc === -1) {
        pItem = INVENTORY_GetCursorItem113c(m, pInventory) >>> 0
        if (pItem !== 0) {
          PLAYER_ClearCursorItemAndNotify42_6FC97D90_113c(m, pPlayer, pItem)
        }
      } else {
        pItem = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, nBodyLoc) >>> 0
        if (pItem !== 0) {
          if ((m.u32((pItem + 0x10) >>> 0) | 0) !== 1) {
            throw new D2CommonAssertError('0x6fd19ff9', 0x2a7)
          }
          if (onRemoveEquippedItem_6FC98D00 !== undefined) {
            onRemoveEquippedItem_6FC98D00(m, pPlayer, pItem, pGame, nBodyLoc)
          } else {
            D2Game_6FC98D00_113c(m, pPlayer, pItem, pGame, nBodyLoc)
          }
        }
      }

      if (pItem !== 0) {
        const pDup = ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(m, pGame, pItem, 1) >>> 0
        PATH_GetTargetTypeAndPosition113c(m, pPlayer, spCoordBox)
        const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0
        const inX = m.u32(spCoordBox) | 0
        const inY = m.u32((spCoordBox + 0x04) >>> 0) | 0
        const candX = (inX + 2) | 0
        const candY = (inY + 3) | 0
        if (ROOM_FindRoomContainingSubtile113c(m, pRoom, candX, candY) !== 0) {
          m.setU32(spOutCoords, candX >>> 0)
          m.setU32((spOutCoords + 0x04) >>> 0, candY >>> 0)
        } else {
          m.setU32(spOutCoords, inX >>> 0)
          m.setU32((spOutCoords + 0x04) >>> 0, inY >>> 0)
        }
        const pFreeRoom =
          COLLISION_FindFreePositionBasic113c(
            m,
            pRoom,
            spOutCoords,
            spCoordBox,
            1,
            0x3e01,
            0x801,
            1,
          ) >>> 0
        if (pFreeRoom !== 0 && pDup !== 0) {
          ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c(
            m,
            m.u32((spOutCoords + 0x04) >>> 0) | 0,
            pDup,
            pFreeRoom,
            pGame,
            pPlayer,
            m.u32(spOutCoords) | 0,
          )
        }
      }
    }

    const nGold = STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0) | 0
    if (m.u32(pPlayer) === 0) {
      STATLIST_GetUnitGoldBankLimit113c(m, pPlayer)
    }
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0e, 0, 0)
    const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) : 0xffffffff
    PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c(m, pGame, dwPlayerGuid, pPlayer, nGold)
  } finally {
    freeW14B1Stack(sp)
  }
}



/**
 * [26/44] Summons Amazon Valkyrie (`0x6FCB5980`), sets owner level, applies skill buffs/UMods, equips MonEquip items, and schedules pet events.
 * @dll D2Game.dll
 * @va 0x6FCB5980
 * @ordinalOrName D2Game_6FCB5980
 */
export function SKILLS_SrvDo_Valkyrie_6FCB5980_113c(
  m: SparseMemory113c,
  pGame: number,
  pOwnerUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  onSummonMonster?: (m: SparseMemory113c, pGame: number, pSummonArg: number) => number,
): number {
  hitD2GameVa113c(0x6FCB5980)
  if (pOwnerUnit !== 0) {
    m.setU32((pOwnerUnit + 0xc4) >>> 0, (m.u32((pOwnerUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  const ppDataTables = m.u32(0x6fd1829c)
  const pDataTables = ppDataTables !== 0 ? m.u32(ppDataTables) : 0
  if (
    pDataTables === 0 ||
    nSkillId < 0 ||
    nSkillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)
  ) {
    return 0
  }
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0)
  if (pSkillsTxtBase === 0) {
    return 0
  }
  const pSkillTxt = (pSkillsTxtBase + imul32(nSkillId, 0x23c)) >>> 0
  if (pSkillTxt === 0) {
    return 0
  }

  const sp = allocW14B1Stack(m, 0x30)
  try {
    const spPetType = sp >>> 0
    const spSummonArg = (sp + 0x04) >>> 0
    const nHcIdx =
      SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
        m,
        0,
        0,
        spPetType,
        pOwnerUnit,
        0,
        nSkillId,
        nSkillLevel,
      ) | 0
    if (nHcIdx < 0) {
      return 0
    }
    let nSummonMode = m.u8((pSkillTxt + 0xbe) >>> 0)
    if (nSummonMode >= (m.u32((pDataTables + 0xbf0) >>> 0) | 0)) {
      nSummonMode = 0
    }
    const nMaxPets =
      SKILLS_EvalCalcByOffset113c(
        m,
        pOwnerUnit,
        (m.u32((pSkillTxt + 0xc0) >>> 0) | 0),
        nSkillId,
        nSkillLevel,
      ) | 0

    m.setU32((spSummonArg + 0x04) >>> 0, pOwnerUnit >>> 0)
    m.setU32((spSummonArg + 0x08) >>> 0, nHcIdx >>> 0)
    m.setU32((spSummonArg + 0x0c) >>> 0, 0)
    m.setU32((spSummonArg + 0x10) >>> 0, m.u32(spPetType))
    m.setU32((spSummonArg + 0x1c) >>> 0, nSummonMode >>> 0)
    m.setU32((spSummonArg + 0x20) >>> 0, nMaxPets >>> 0)

    const pValkyrie =
      (onSummonMonster !== undefined
        ? onSummonMonster(m, pGame, spSummonArg)
        : D2Game_6FCC3610_113c(m, spSummonArg, pGame)) >>> 0
    if (pValkyrie === 0) {
      return 0
    }

    const nOwnerLevel = STATLIST_GetUnitStat113c(m, pOwnerUnit, 0x0c, 0) | 0
    STATLIST_SetUnitStat113c(m, pValkyrie, 0x0c, nOwnerLevel, 0)
    SKILLS_ApplyMonsterSkillBuffAndUMod_6FCB1660_113c(
      m,
      pSkillTxt,
      pGame,
      pValkyrie,
      nSkillId,
      nSkillLevel,
    )

    let nEquipLevel = SKILLS_EvalLinearParam56_6FC21A90_113c(m, nSkillId, nSkillLevel) | 0
    if (nEquipLevel < 1) {
      nEquipLevel = 1
    }
    const nMaxLvl = DATATBLS_GetMaxLevel113c(m, 0) | 0
    if (nEquipLevel >= nMaxLvl) {
      nEquipLevel = nMaxLvl
    }
    MONSTER_EquipMonEquipItems113c(
      m,
      pValkyrie,
      pGame,
      pOwnerUnit,
      nEquipLevel,
      0,
      nSkillLevel,
    )

    let pEvt = m.u32((pValkyrie + 0xdc) >>> 0)
    while (pEvt !== 0) {
      const pNext = m.u32((pEvt + 0x24) >>> 0)
      if (m.u8(pEvt) === 2) {
        EVENT_FreeNode113c(m, pGame, pEvt)
      }
      pEvt = pNext
    }
    EVENT_SetEventFull113c(
      m,
      pGame,
      pValkyrie,
      2,
      (m.u32((pGame + 0xa8) >>> 0) + 0x14) >>> 0,
      0,
      0,
      0,
    )

    const wAuraState = ((m.u16((pSkillTxt + 0x80) >>> 0) << 16) >> 16)
    if (wAuraState > 0 && wAuraState < (m.u32((pDataTables + 0xc4) >>> 0) | 0)) {
      STATES_ToggleGfxStateFlag113c(m, pValkyrie, wAuraState, 1)
    }
    STATES_UpdateOrClearState98Transform113c(m, pValkyrie, pOwnerUnit)

    const nDuration =
      SKILLS_EvalCalcByOffset113c(
        m,
        pOwnerUnit,
        (m.u32((pSkillTxt + 0x60) >>> 0) | 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    if (nDuration > 0) {
      EVENT_SetEventFull113c(
        m,
        pGame,
        pValkyrie,
        7,
        (m.u32((pGame + 0xa8) >>> 0) + nDuration) >>> 0,
        0,
        0,
        0,
      )
      MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, pValkyrie, 0x15, pGame, 0)
    }
    SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(
      m,
      pGame,
      pValkyrie,
      m.u32((pOwnerUnit + 0xd0) >>> 0),
      0,
    )
    return 1
  } finally {
    freeW14B1Stack(sp)
  }
}

/**
 * [27/44] Summons a monster from a skill or missile (`0x6FCB5D50`), walks the owner chain, applies summon stats, and starts its anim mode.
 * @dll D2Game.dll
 * @va 0x6FCB5D50
 * @ordinalOrName D2Game_6FCB5D50
 */
export function SKILLS_SummonMonsterFromSkillOrMissile_6FCB5D50_113c(
  m: SparseMemory113c,
  pOwnerUnit: number,
  pGame: number,
  nX: number,
  nY: number,
  pSkillTxt: number,
  bUpdateStatsFlag: number,
  nSkillLevel: number,
  onSummonMonster?: (m: SparseMemory113c, pGame: number, pSummonArg: number) => number,
): number {
  hitD2GameVa113c(0x6FCB5D50)
  if (pSkillTxt === 0) {
    return 0
  }
  const sp = allocW14B1Stack(m, 0x58)
  try {
    const spSummonMode = sp >>> 0
    const spOutY = (sp + 0x04) >>> 0
    const spOutX = (sp + 0x08) >>> 0
    const spSummonArg = (sp + 0x0c) >>> 0
    const spModeChange = (sp + 0x30) >>> 0

    const nSkillId = bUpdateStatsFlag | 0
    let nHcIdx =
      UNITS_GetSpawnedMonsterOrSkillSummonInfo113c(
        m,
        pOwnerUnit,
        0,
        nSkillId,
        nSkillLevel,
        spSummonMode,
        0,
        0,
      ) | 0
    const ppSgpt = m.u32(0x6fd1829c)
    const pSgpt = ppSgpt !== 0 ? m.u32(ppSgpt) : 0
    const nMonStatsCount = pSgpt !== 0 ? (m.u32((pSgpt + 0xa80) >>> 0) | 0) : 0

    if (nHcIdx < 0 || nHcIdx >= nMonStatsCount) {
      let pAiCtrl = 0
      if (pOwnerUnit !== 0 && m.u32(pOwnerUnit) === 1) {
        const pMonData = m.u32((pOwnerUnit + 0x14) >>> 0)
        if (pMonData !== 0) {
          pAiCtrl = m.u32((pMonData + 0x28) >>> 0)
        }
      }
      if (pAiCtrl === 0) {
        return 0
      }
      nHcIdx = m.u32((pAiCtrl + 0x3c) >>> 0) | 0
      if (nHcIdx <= 0 || nHcIdx >= nMonStatsCount) {
        return 0
      }
    }

    if (nHcIdx < 0 || nHcIdx >= nMonStatsCount) {
      return 0
    }

    let nPetType = (m.u8((pSkillTxt + 0xbe) >>> 0) << 24) >> 24
    if (nPetType < 0 || pSgpt === 0 || nPetType >= (m.u32((pSgpt + 0xbf0) >>> 0) | 0)) {
      nPetType = 0
    }
    const nMaxPets =
      SKILLS_EvalCalcByOffset113c(
        m,
        pOwnerUnit,
        m.u32((pSkillTxt + 0xc0) >>> 0) | 0,
        nSkillId,
        nSkillLevel,
      ) | 0

    let curX = nX | 0
    let curY = nY | 0
    m.setU32(spOutX, curX >>> 0)
    m.setU32(spOutY, curY >>> 0)

    if (curX === 0 || curY === 0) {
      if (pOwnerUnit !== 0) {
        const dwType = m.u32(pOwnerUnit)
        const pPathOrPos = m.u32((pOwnerUnit + 0x2c) >>> 0)
        if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
          curX = pPathOrPos !== 0 ? (m.u32((pPathOrPos + 0x0c) >>> 0) | 0) : 0
          curY = pPathOrPos !== 0 ? (m.u32((pPathOrPos + 0x10) >>> 0) | 0) : 0
        } else if (pPathOrPos !== 0) {
          curX = PATH_GetPosX113c(m, pPathOrPos) | 0
          curY = PATH_GetPosY113c(m, pPathOrPos) | 0
        } else {
          curX = 0
          curY = 0
        }
        m.setU32(spOutX, curX >>> 0)
        m.setU32(spOutY, curY >>> 0)
      }
    }

    let pResolvedOwner = pOwnerUnit >>> 0
    while (pResolvedOwner !== 0 && m.u32(pResolvedOwner) === 1) {
      const pMonData = m.u32((pResolvedOwner + 0x14) >>> 0)
      if (pMonData === 0) {
        return 0
      }
      const pAiCtrl = m.u32((pMonData + 0x28) >>> 0)
      if (pAiCtrl === 0) {
        return 0
      }
      const pOwnerGame = m.u32((pAiCtrl + 0x28) >>> 0)
      if (pOwnerGame === 0) {
        return 0
      }
      const pNextOwner =
        SUNIT_GetServerUnit113c(
          m,
          pOwnerGame,
          m.u32((pAiCtrl + 0x30) >>> 0) | 0,
          m.u32((pAiCtrl + 0x2c) >>> 0),
        ) >>> 0
      if (pNextOwner === 0) {
        return 0
      }
      if (pNextOwner === pResolvedOwner) {
        break
      }
      pResolvedOwner = pNextOwner
    }
    pOwnerUnit = pResolvedOwner

    if (curX === 0 || curY === 0) {
      if (SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, pOwnerUnit, pGame, spOutX, spOutY) === 0) {
        return 0
      }
      curX = m.u32(spOutX) | 0
      curY = m.u32(spOutY) | 0
    }

    const pOwnerRoom = UNITS_GetRoom113c(m, pOwnerUnit) >>> 0
    if (pOwnerRoom === 0) {
      return 0
    }
    const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pOwnerRoom, curX, curY) >>> 0
    if (pTargetRoom === 0) {
      return 0
    }
    if (
      (m.u8((pSkillTxt + 0x05) >>> 0) & 1) === 0 &&
      DUNGEON_CheckRoomIsTownMemPort113c(m, pTargetRoom) !== 0
    ) {
      return 0
    }

    m.setU32(spSummonArg, 1)
    m.setU32((spSummonArg + 0x04) >>> 0, pOwnerUnit >>> 0)
    m.setU32((spSummonArg + 0x08) >>> 0, nHcIdx >>> 0)
    m.setU32((spSummonArg + 0x0c) >>> 0, 0)
    m.setU32((spSummonArg + 0x10) >>> 0, m.u32(spSummonMode))
    m.setU32((spSummonArg + 0x14) >>> 0, (curX) >>> 0)
    m.setU32((spSummonArg + 0x18) >>> 0, (curY) >>> 0)
    m.setU32((spSummonArg + 0x1c) >>> 0, nPetType >>> 0)
    m.setU32((spSummonArg + 0x20) >>> 0, nMaxPets >>> 0)

    const pPet =
      (onSummonMonster !== undefined
        ? onSummonMonster(m, pGame, spSummonArg)
        : D2Game_6FCC3610_113c(m, spSummonArg, pGame)) >>> 0
    if (pPet === 0) {
      return 0
    }

    SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c(
      m,
      pOwnerUnit,
      0,
      pGame,
      pPet,
      nSkillLevel,
    )
    SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c(
      m,
      pGame,
      pOwnerUnit,
      pPet,
      bUpdateStatsFlag,
      nSkillLevel,
      0,
    )
    SUNIT_SetMonsterAlignmentState113c(m, pPet, 2, 1)
    const nSummonMode = m.u32(spSummonMode) | 0
    MONSTER_InitModeChangeStrc113c(m, pPet, spModeChange, nSummonMode)
    MONSTER_StartMode113c(
      m,
      pGame,
      pPet,
      nSummonMode,
      m.u32((spModeChange + 0x08) >>> 0),
      m.u32((spModeChange + 0x0c) >>> 0) | 0,
      m.u32((spModeChange + 0x10) >>> 0) | 0,
    )
    return pPet >>> 0
  } finally {
    freeW14B1Stack(sp)
  }
}

/**
 * [28/44] Dispatches merc / Shadow Warrior (`hcIdx == 0x1A4` = 420) AI think tick (`0x6FCCAC30` vs `0x6FCCA710`).
 * @dll D2Game.dll
 * @va 0x6FCCC8E0
 * @ordinalOrName D2Game_6FCCC8E0
 */
export function AI_MercOrShadowWarriorThink_6FCCC8E0_113c(
  m: SparseMemory113c,
  pGame: number,
  pMonster: number,
  pAiTickArgs: number,
  onAiThink1A4_6FCCAC30?: (
    m: SparseMemory113c,
    pAiTickArgs: number,
    pMonster: number,
    pGame: number,
  ) => void,
  onAiThinkDefault_6FCCA710?: (
    m: SparseMemory113c,
    pMonster: number,
    pGame: number,
    pAiTickArgs: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FCCC8E0)
  if (pMonster !== 0 && m.u32((pMonster + 0x04) >>> 0) === 0x1a4) {
    if (onAiThink1A4_6FCCAC30 !== undefined) {
      onAiThink1A4_6FCCAC30(m, pAiTickArgs, pMonster, pGame)
    } else {
      D2Game_6FCCAC30_113c(m, pAiTickArgs, pMonster, pGame)
    }
    return
  }
  if (onAiThinkDefault_6FCCA710 !== undefined) {
    onAiThinkDefault_6FCCA710(m, pMonster, pGame, pAiTickArgs)
  } else {
    D2Game_6FCCA710_113c(m, pMonster, pGame, 0, pAiTickArgs)
  }
}

/**
 * [29/44] Handles Act 3 Quest 3 (Blade of the Old Religion / Gidbinn) Ormus scroll callback (`0x2A6`, `0x2A7`, `0x2A8`).
 * @dll D2Game.dll
 * @va 0x6FCDAA50
 * @ordinalOrName D2Game_6FCDAA50
 */
export function ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
  onCreateQuestItem?: (
    m: SparseMemory113c,
    pGame: number,
    pPlayerUnit: number,
    dwItemCode: number,
    nItemLevel: number,
    nQuality: number,
    bDropIfFull: number,
  ) => number,
  onQuestCallbackF0?: (m: SparseMemory113c, pQuestData: number) => void,
): void {
  hitD2GameVa113c(0x6FCDAA50)
  const wScrollId = m.u16((pQuestArg + 0x18) >>> 0)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0)
  const wNpcClassId = m.u16((pQuestArg + 0x14) >>> 0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const pArgGame = m.u32(pQuestArg >>> 0)
  const nDiff = m.u8((pArgGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0)
  if (wNpcClassId !== 0xf6) {
    return
  }
  const pExt = m.u32((pQuestData + 0x18) >>> 0)
  if (wScrollId === 0x2a6) {
    m.setU8((pExt + 0x02) >>> 0, 1)
    m.setU8((pQuestData + 0x0c) >>> 0, 2)
    if (m.u32(0x6fd31c20) !== 0) {
      const sp = allocW14B1Stack(m, 0x80)
      try {
        writeAsciiStr113c(m, sp, 'changing state to 2\n')
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, sp, m.u32((pQuestData + 0x04) >>> 0), 4)
      } finally {
        freeW14B1Stack(sp)
      }
    }
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((pQuestArg + 0x08) >>> 0),
      pPlayer,
      m.u32(pQuestArg >>> 0),
    )
  } else if (wScrollId === 0x2a7) {
    const pGameRef = m.u32(pQuestArg >>> 0)
    const pCreated =
      (onCreateQuestItem !== undefined
        ? onCreateQuestItem(m, pGameRef, pPlayer, 0x2073736d, 0, 2, 1)
        : D2Game_6FC56470_113c(m, 0, 0x2073736d, pPlayer, pGameRef, 2, 1)) >>> 0
    if (pCreated !== 0) {
      m.setU8((pExt + 0x02) >>> 0, 1)
      if (m.u8((pQuestData + 0x0c) >>> 0) < 2) {
        QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 2)
      }
      m.setU8((pExt + 0x1c) >>> 0, 1)
      QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
        m,
        m.u32((pQuestArg + 0x08) >>> 0),
        pPlayer,
        m.u32(pQuestArg >>> 0),
      )
    }
  } else if (wScrollId === 0x2a8) {
    const dwQuestId = (m.u32((pQuestData + 0xe0) >>> 0) | 0)
    if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, dwQuestId, 1) === 0) {
      return
    }
    if (
      QUESTRECORD_GetQuestState113c(m, pQuestFlags, dwQuestId, 0x0d) !== 0 &&
      m.u8((pQuestData + 0x0c) >>> 0) !== 5
    ) {
      m.setU8((pQuestData + 0x14) >>> 0, 0)
      m.setU8((pQuestData + 0x0b) >>> 0, 0x0d)
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 5)
      if (m.u32((pQuestData + 0xf0) >>> 0) === 0) {
        throw new D2CommonAssertError('0x6fd19ff9', 0x213)
      }
      dispatchQuestSeqFilterF0_113c(m, pQuestData, onQuestCallbackF0)
    }
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, (m.u32((pQuestData + 0xe0) >>> 0) | 0), 0)
    QUESTRECORD_ClearQuestState113c(m, pQuestFlags, (m.u32((pQuestData + 0xe0) >>> 0) | 0), 1)
    const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) : 0xffffffff
    QUESTS_GuidListAdd113c(m, (pQuestData + 0x1c) >>> 0, dwPlayerGuid)
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((pQuestArg + 0x08) >>> 0),
      pPlayer,
      m.u32(pQuestArg >>> 0),
    )
  }
}

/**
 * [30/44] Handles Act 4 Quest 3 red portal warp to Act 5 Harrogath (`0x6D`) after Diablo's death.
 * @dll D2Game.dll
 * @va 0x6FCDB550
 * @ordinalOrName D2Game_6FCDB550
 */
export function ACT4Q3_OnDiabloDeathPortalWarpToAct5_6FCDB550_113c(
  m: SparseMemory113c,
  pQuestArg: number,
  onTownWarp_6FCEF810?: (
    m: SparseMemory113c,
    pGame: number,
    pPlayer: number,
    nTargetLevelId: number,
    nWarpState: number,
  ) => void,
): number {
  hitD2GameVa113c(0x6FCDB550)
  const pGame = m.u32(pQuestArg >>> 0)
  if (m.u32((pGame + 0x70) >>> 0) === 0) {
    return 0
  }
  const pPlayer = m.u32((pQuestArg + 0x08) >>> 0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0)
  if (
    QUESTRECORD_GetQuestState113c(m, pQuestFlags, 0x1a, 0) === 0 &&
    QUESTRECORD_GetQuestState113c(m, pQuestFlags, 0x1a, 0x0d) === 0
  ) {
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, 0)
    return 0
  }
  const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0
  if (pRoom === 0) {
    return 0
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (nAct !== 3) {
    return 0
  }
  if (QUESTRECORD_GetQuestState113c(m, pQuestFlags, 0x1c, 0) === 0) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1c, 0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1c, 0x0d)
    const pClient =
      pPlayer !== 0 && m.u32(pPlayer) === 0
        ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0)
        : 0
    const pPd2 = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
    if (pClient !== 0 && PLAYER_IsBusyWithCursorOrNpcInteract113c(m, pPlayer) === 0) {
      m.setU32((pPlayer + 0x64) >>> 0, 0xffffffff)
      m.setU32((pPlayer + 0x68) >>> 0, 6)
      m.setU8((pPlayer + 0x6c) >>> 0, 0)
      m.setU32((pPd2 + 0x4c) >>> 0, 1)
      const sp = allocW14B1Stack(m, 0x10)
      try {
        m.setU8(sp, 0x5d)
        m.setU8((sp + 1) >>> 0, 0x17)
        m.setU8((sp + 2) >>> 0, 2)
        m.setU8((sp + 3) >>> 0, 0)
        m.setU16((sp + 4) >>> 0, 0)
        NET_SendPacketBuffer6B_6FCAACD0_113c(m, sp, pClient)
      } finally {
        freeW14B1Stack(sp)
      }
      NET_SendPacket61_ByteParam_6FCAAAC0_113c(m, 5, pClient)
    }
  }
  const pPlayerWarp = m.u32((pQuestArg + 0x08) >>> 0)
  const pGameWarp = m.u32(pQuestArg >>> 0)
  if (onTownWarp_6FCEF810 !== undefined) {
    onTownWarp_6FCEF810(m, pGameWarp, pPlayerWarp, 0x6d, 5)
  } else {
    D2Game_6FCEF810_113c(m, pPlayerWarp, pGameWarp, 0x6d, 5)
  }
  QUESTS_SendPlayerQuestLogPacket28_113c(
    m,
    m.u32((pQuestArg + 0x08) >>> 0),
    m.u32(pQuestArg >>> 0),
  )
  ACT4Q3_ActivateHarrogathWaypointForPlayer_6FCD9030_113c(
    m,
    m.u32(pQuestArg >>> 0),
    m.u32((pQuestArg + 0x08) >>> 0),
  )
  return 0
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDF1C0
 * @ordinalOrName sub_6FCDF1C0
 *
 * Ensures the vendor inventory record for `pNpcUnit` is generated in `pNpcControl` (`+0x08` list).
 * If no node with `[node + 0x04] === dwNpcGuid` exists, invokes `0x6FCDE2A0`.
 * Calling convention: custom (`eax = pNpcControl`, `ecx = pNpcUnit`, `[esp+4] = pGame`, `[esp+8] = bIsGamble`).
 */
export function NPCTRADE_EnsureVendorInventoryGenerated_6FCDF1C0_113c(
  m: SparseMemory113c,
  pNpcControl: number,
  pNpcUnit: number,
  pGame: number,
  bIsGamble: number,
  onGenerateVendorItems?: (
    m: SparseMemory113c,
    pNpcControl: number,
    pNpcUnit: number,
    pGame: number,
    bIsGamble: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FCDF1C0)
  const dwGuid = pNpcUnit !== 0 ? m.u32((pNpcUnit + 0x0c) >>> 0) : 0xffffffff
  let pNode = m.u32((pNpcControl + 0x08) >>> 0)
  let bFound = 0
  while (pNode !== 0) {
    if (m.u32((pNode + 0x04) >>> 0) === dwGuid) {
      bFound = 1
    }
    pNode = m.u32((pNode + 0x08) >>> 0)
  }
  if (bFound === 0) {
    if (onGenerateVendorItems !== undefined) {
      onGenerateVendorItems(m, pNpcControl >>> 0, pNpcUnit >>> 0, pGame >>> 0, bIsGamble | 0)
    } else {
      D2Game_6FCDE2A0_113c(m, pNpcControl >>> 0, pNpcUnit >>> 0, pGame >>> 0, bIsGamble >>> 0)
    }
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDF200
 * @ordinalOrName sub_6FCDF200
 *
 * Validates NPC interaction for buying an item (`0x6FCDF200`).
 * If the player is not actively interacting with `dwNpcGuid`, queues a 15-byte `0x2A` failure packet
 * (`result = 9`) to the client; otherwise delegates to `0x6FCDE640`. Always returns `1`.
 */
export function NPCTRADE_InteractBuyItem_6FCDF200_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  dwNpcGuid: number,
  dwItemGuid: number,
  nBuyMode: number,
  wTab: number,
  dwCost: number,
  bFillStackOrHook?:
    | number
    | ((
        m: SparseMemory113c,
        pGame: number,
        pPlayer: number,
        pNpc: number,
        dwItemGuid: number,
        nBuyMode: number,
        wTab: number,
        dwCost: number,
      ) => void),
  onExecuteBuy?: (
    m: SparseMemory113c,
    pGame: number,
    pPlayer: number,
    pNpc: number,
    dwItemGuid: number,
    nBuyMode: number,
    wTab: number,
    dwCost: number,
  ) => void,
): number {
  hitD2GameVa113c(0x6FCDF200)
  if (pGame === 0) {
    throw new D2CommonAssertError('NpcTrade.cpp', 0x93f)
  }
  let pInteractUnit = 0
  if (m.u8((pPlayer + 0x6c) >>> 0) !== 0) {
    const dwInteractId = m.u32((pPlayer + 0x64) >>> 0)
    const nInteractType = m.u32((pPlayer + 0x68) >>> 0) | 0
    pInteractUnit = SUNIT_GetServerUnit113c(m, pGame >>> 0, nInteractType, dwInteractId) >>> 0
  }
  const bucketIdx = (dwNpcGuid & 0x7f) >>> 0
  let pNpc = m.u32((pGame + 0x1320 + (bucketIdx << 2)) >>> 0)
  while (pNpc !== 0 && m.u32((pNpc + 0x0c) >>> 0) !== (dwNpcGuid >>> 0)) {
    pNpc = m.u32((pNpc + 0xe4) >>> 0)
  }
  if (pNpc === 0 || pNpc !== pInteractUnit) {
    const dwGold = STATLIST_GetUnitStat113c(m, pPlayer >>> 0, 0x0e, 0) >>> 0
    let pClient = 0
    if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
      pClient = m.u32((pPlayerData + 0x9c) >>> 0)
    }
    const sp = allocW14B1Stack(m, 0x14)
    try {
      m.setU8(sp, 0x2a)
      m.setU8((sp + 1) >>> 0, 0)
      m.setU8((sp + 2) >>> 0, 9)
      m.setU32((sp + 7) >>> 0, 0xffffffff)
      m.setU32((sp + 0x0b) >>> 0, dwGold)
      NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, sp, 0x0f)
    } finally {
      freeW14B1Stack(sp)
    }
    return 1
  }
  const hook = typeof bFillStackOrHook === 'function' ? bFillStackOrHook : onExecuteBuy
  if (hook !== undefined) {
    hook(
      m,
      pGame >>> 0,
      pPlayer >>> 0,
      pNpc >>> 0,
      dwItemGuid >>> 0,
      nBuyMode | 0,
      wTab & 0xffff,
      dwCost >>> 0,
    )
    return 1
  }
  const bFillStack = typeof bFillStackOrHook === 'number' ? bFillStackOrHook : 0
  const effectiveBuyMode =
    typeof bFillStackOrHook === 'number' ? wTab : wTab !== 0 ? wTab : nBuyMode
  return (
    D2Game_6FCDE640_113c(
      m,
      pGame >>> 0,
      pPlayer >>> 0,
      pNpc >>> 0,
      dwItemGuid >>> 0,
      effectiveBuyMode,
      bFillStack,
    ) | 0
  )
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDF2E0
 * @ordinalOrName sub_6FCDF2E0
 *
 * Populates an NPC vendor's inventory items from its trade table slot (`pSlot + 0x34`, count `pSlot + 0x38`).
 * Spawns permanent/stackable items and rolled random/magic items via `0x6FCDEE30`.
 */
export function NPCTRADE_PopulateVendorItemsFromTable_6FCDF2E0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pNpc: number,
  pShop: number,
  onCreateVendorItem?: (
    m: SparseMemory113c,
    pNpc: number,
    dwItemCode: number,
    pGame: number,
    nItemLevel: number,
    nCount: number,
    nQuality: number,
    bPermStore: number,
  ) => number,
): void {
  hitD2GameVa113c(0x6FCDF2E0)
  if (pShop === 0) {
    return
  }
  const pNpcControl = m.u32((pGame + 0x1d24) >>> 0)
  const pSeed = (pNpcControl + 0x08) >>> 0
  m.setU32((pShop + 0x08) >>> 0, m.u32(0x6fd18d10) >>> 0)

  const sp = allocW14B1Stack(m, 0x18)
  try {
    const spSlotIdx = sp >>> 0
    const spItemIdx = (sp + 0x08) >>> 0
    const spPermIdx = (sp + 0x10) >>> 0
    const nNpcClassId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) : 0xffffffff
    const pNpcRecord =
      D2GAME_ARENA_FindPlayerSlotByUnit113c(m, spSlotIdx, pGame >>> 0, nNpcClassId) >>> 0
    if (pNpcRecord === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0x2c4)
    }

    let nFailedCount = 0
    const nPlayerLvl = STATLIST_GetUnitStat113c(m, pPlayer >>> 0, 0x0c, 0) | 0
    const nShopLvl =
      NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c(
        m,
        pGame >>> 0,
        pNpc >>> 0,
        (nPlayerLvl + 5) | 0,
      ) | 0

    const spawnVendorItem = (dwCode: number, nQual: number, bPerm: number): number => {
      if (onCreateVendorItem !== undefined) {
        return (
          onCreateVendorItem(
            m,
            pNpc >>> 0,
            dwCode >>> 0,
            pGame >>> 0,
            nShopLvl,
            1,
            nQual,
            bPerm,
          ) >>> 0
        )
      }
      return (
        D2Game_6FCDEE30_113c(
          m,
          pGame >>> 0,
          dwCode >>> 0,
          pNpc >>> 0,
          1,
          nQual,
          nShopLvl,
          nPlayerLvl,
        ) >>> 0
      )
    }

    const nShopEntries = m.u32((pNpcRecord + 0x30) >>> 0) | 0
    for (let i = 0, byteOff = 0; i < nShopEntries; i = (i + 1) | 0, byteOff = (byteOff + 0x0c) | 0) {
      const pShopItems = m.u32((pShop + 0x0c) >>> 0)
      const dwCode = m.u32((pShopItems + byteOff + 0x04) >>> 0)
      m.setU32(spItemIdx, 0)
      const pItemsTxt = DATATBLS_GetItemsTxtRecordByCode113c(m, dwCode, spItemIdx) >>> 0
      if (pItemsTxt === 0 || m.u8((pItemsTxt + 0xfd) >>> 0) > nShopLvl) {
        continue
      }

      let nNormalCount = 0
      if (nShopLvl < 0x19) {
        const pMinMax = (m.u32((pNpcRecord + 0x2c) >>> 0) + byteOff) >>> 0
        const nMin = m.u8(pMinMax)
        const nMaxPlus1 = (m.u8((pMinMax + 1) >>> 0) + 1) | 0
        nNormalCount = SEED_RollRangeHalfOpen113c(m, pSeed, nMin, nMaxPlus1) | 0
      }

      if (m.u16((pItemsTxt + 0xf6) >>> 0) >= 0x64 && m.u16((pGame + 0x78) >>> 0) < 0x64) {
        continue
      }

      if (nNormalCount >>> 0 > 0) {
        let bExceeded = false
        for (let k = 0; (k >>> 0) < (nNormalCount >>> 0); k = (k + 1) | 0) {
          const roll100 = (advanceSeed64_113c(m, pSeed) % 100) >>> 0
          let nQual = 2
          if (nShopLvl < 5) {
            if (roll100 > 0x5a) {
              nQual = 1
            }
          } else if (nShopLvl < 10) {
            if (roll100 > 0x55) {
              nQual = 3
            }
          } else if (roll100 >= 0x4b) {
            nQual = 3
          }
          const pMinMaxRecOff = m.u32((pNpcRecord + 0x2c) >>> 0)
          const dwSpawnCode = m.u32((pMinMaxRecOff + byteOff + 0x04) >>> 0)
          if (spawnVendorItem(dwSpawnCode, nQual, 0) === 0) {
            nFailedCount = (nFailedCount + 1) | 0
          }
          if (nFailedCount > 0x20) {
            bExceeded = true
            break
          }
        }
        if (bExceeded) {
          return
        }
      }

      const pShopItemsAfter = m.u32((pShop + 0x0c) >>> 0)
      const dwMagicCode = m.u32((pShopItemsAfter + byteOff + 0x04) >>> 0)
      m.setU32(spItemIdx, 0)
      DATATBLS_GetItemsTxtRecordByCode113c(m, dwMagicCode, spItemIdx)
      if (ITEMS_IsThrowableBit113c(m, m.u32(spItemIdx) | 0) !== 1) {
        continue
      }
      if (m.u8((pShopItemsAfter + byteOff + 0x08) >>> 0) > nShopLvl) {
        continue
      }

      let nMagicBonus = 1
      if (nShopLvl >= 0x19) {
        nMagicBonus = (SEED_RollRangeHalfOpen113c(m, pSeed, 1, 3) + 1) | 0
      }
      const pMagicMinMax = (m.u32((pNpcRecord + 0x2c) >>> 0) + byteOff) >>> 0
      const nMagicMax = (m.u8((pMagicMinMax + 3) >>> 0) + nMagicBonus) | 0
      const nMagicMin = m.u8((pMagicMinMax + 2) >>> 0)
      let nMagicCount = nMagicMin >>> 0
      if (nMagicMax > nMagicMin) {
        const span = (nMagicMax - nMagicMin) >>> 0
        const raw = advanceSeed64_113c(m, pSeed)
        const rem = (span & (span - 1)) === 0 ? (raw & (span - 1)) >>> 0 : (raw % span) >>> 0
        nMagicCount = (nMagicMin + rem) >>> 0
      }
      for (let mIdx = 0; (mIdx >>> 0) < nMagicCount; mIdx = (mIdx + 1) | 0) {
        const dwCurMagicCode = m.u32((m.u32((pNpcRecord + 0x2c) >>> 0) + byteOff + 0x04) >>> 0)
        if (spawnVendorItem(dwCurMagicCode, 4, 0) === 0) {
          nFailedCount = (nFailedCount + 1) | 0
        }
      }
    }

    const nPermEntries = m.u32((pNpcRecord + 0x38) >>> 0) | 0
    for (let j = 0; j < nPermEntries; j = (j + 1) | 0) {
      const pPermCodes = m.u32((pNpcRecord + 0x34) >>> 0)
      const dwPermCode = m.u32((pPermCodes + j * 4) >>> 0)
      const pPermItem = spawnVendorItem(dwPermCode, 2, 1)
      if (pPermItem !== 0) {
        const pShopPermCodes = m.u32((pShop + 0x14) >>> 0)
        const dwLookupCode =
          pShopPermCodes !== 0 ? m.u32((pShopPermCodes + j * 4) >>> 0) : dwPermCode
        m.setU32(spPermIdx, 0)
        const pPermTxt = DATATBLS_GetItemsTxtRecordByCode113c(m, dwLookupCode, spPermIdx) >>> 0
        if (pPermTxt !== 0) {
          const dwTxtCode = m.u32((pPermTxt + 0x80) >>> 0)
          if (dwTxtCode === 0x20767163 || dwTxtCode === 0x20767161) {
            const nMaxStack = ITEMS_GetTotalMaxStack113c(m, pPermItem) | 0
            STATLIST_SetUnitStat113c(m, pPermItem, 0x46, nMaxStack, 0)
          }
        }
      } else {
        nFailedCount = (nFailedCount + 1) | 0
      }
      if (nFailedCount > 0x20) {
        break
      }
    }
  } finally {
    freeW14B1Stack(sp)
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCE1890
 * @ordinalOrName sub_6FCE1890
 *
 * Validates NPC interaction for hiring a mercenary (`0x6FCE1890`).
 * If the player is not actively interacting with `dwNpcGuid`, queues a 15-byte `0x2A` failure packet
 * (`type = 0`, `result = 9`); otherwise delegates to `0x6FCE1510`.
 */
export function NPCTRADE_InteractRepairItem_6FCE1890_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  dwNpcGuid: number,
  dwItemGuidOrAll: number,
  onExecuteRepair?: (
    m: SparseMemory113c,
    pGame: number,
    pPlayer: number,
    pNpc: number,
    dwItemGuidOrAll: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FCE1890)
  let pInteractUnit = 0
  if (m.u8((pPlayer + 0x6c) >>> 0) !== 0) {
    const dwInteractId = m.u32((pPlayer + 0x64) >>> 0)
    const nInteractType = m.u32((pPlayer + 0x68) >>> 0) | 0
    pInteractUnit = SUNIT_GetServerUnit113c(m, pGame >>> 0, nInteractType, dwInteractId) >>> 0
  }
  if (pGame === 0) {
    throw new D2CommonAssertError('NpcTrade.cpp', 0x2d3)
  }
  const bucketIdx = (dwNpcGuid & 0x7f) >>> 0
  let pNpc = m.u32((pGame + 0x1320 + (bucketIdx << 2)) >>> 0)
  while (pNpc !== 0 && m.u32((pNpc + 0x0c) >>> 0) !== (dwNpcGuid >>> 0)) {
    pNpc = m.u32((pNpc + 0xe4) >>> 0)
  }
  if (pNpc === 0 || pNpc !== pInteractUnit) {
    const dwGold = STATLIST_GetUnitStat113c(m, pPlayer >>> 0, 0x0e, 0) >>> 0
    let pClient = 0
    if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
      pClient = m.u32((pPlayerData + 0x9c) >>> 0)
    }
    const sp = allocW14B1Stack(m, 0x14)
    try {
      m.setU8(sp, 0x2a)
      m.setU8((sp + 1) >>> 0, 0)
      m.setU8((sp + 2) >>> 0, 9)
      m.setU32((sp + 7) >>> 0, 0xffffffff)
      m.setU32((sp + 0x0b) >>> 0, dwGold)
      NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, sp, 0x0f)
    } finally {
      freeW14B1Stack(sp)
    }
    return
  }
  if (onExecuteRepair !== undefined) {
    onExecuteRepair(m, pGame >>> 0, pPlayer >>> 0, pNpc >>> 0, dwItemGuidOrAll >>> 0)
  } else {
    D2Game_6FCE1510_113c(m, pPlayer >>> 0, pGame >>> 0, pNpc >>> 0, dwItemGuidOrAll & 0xffff)
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCE7D00
 * @ordinalOrName sub_6FCE7D00
 *
 * Act 2 Quest 2 (`0x0A`) Horadric Staff cleanup handler when entering Act 2 (`act === 1`).
 * Sets quest `0x0A` bits `0` and `0x0D`, and deletes `'hst '`, `'vip '`, and `'msf '` if not trading.
 */
export function ACT2Q2_CleanupHoradricStaffItemsOnEnterAct1_6FCE7D00_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  _dwUnused: number = 0,
  onDeleteQuestItem?: (
    m: SparseMemory113c,
    pPlayerUnit: number,
    pItem: number,
    pGame: number,
    pInventory: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FCE7D00)
  const bDiff = m.u8((pGame + 0x6d) >>> 0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0;
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0);
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0) === 1) {
    return;
  }
  const pRoom = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0;
  if (pRoom === 0) {
    return;
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0;
  const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff;
  if (nAct !== 1) {
    return;
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0a, 0);
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0a, 0x0d);
  if (PLRTRADE_IsInteractingWithValidPlayer113c(m, pPlayer >>> 0, pGame >>> 0) !== 0) {
    return;
  }
  const pHst = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer >>> 0, pGame >>> 0, 0x20747368) >>> 0;
  if (pHst !== 0) {
    const pInv = m.u32((pPlayer + 0x60) >>> 0);
    if (onDeleteQuestItem !== undefined) {
      onDeleteQuestItem(m, pPlayer >>> 0, pHst, pGame >>> 0, pInv);
    } else {
      D2Game_6FC565E0_113c(m, pHst, pPlayer >>> 0, pGame >>> 0, pInv);
    }
  }
  const pVip = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer >>> 0, pGame >>> 0, 0x20706976) >>> 0;
  if (pVip !== 0) {
    const pInv = m.u32((pPlayer + 0x60) >>> 0);
    if (onDeleteQuestItem !== undefined) {
      onDeleteQuestItem(m, pPlayer >>> 0, pVip, pGame >>> 0, pInv);
    } else {
      D2Game_6FC565E0_113c(m, pVip, pPlayer >>> 0, pGame >>> 0, pInv);
    }
  }
  const pMsf = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer >>> 0, pGame >>> 0, 0x2066736d) >>> 0;
  if (pMsf !== 0) {
    const pInv = m.u32((pPlayer + 0x60) >>> 0);
    if (onDeleteQuestItem !== undefined) {
      onDeleteQuestItem(m, pPlayer >>> 0, pMsf, pGame >>> 0, pInv);
    } else {
      D2Game_6FC565E0_113c(m, pMsf, pPlayer >>> 0, pGame >>> 0, pInv);
    }
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCEF270
 * @ordinalOrName sub_6FCEF270
 *
 * Client-to-host packet handler (`9` bytes): place cursor item (`[pPacket + 1]`) into container (`[pPacket + 5]`).
 * Validates cursor item by anim mode (`0x6FCED6D0`) and stored container item (`0x6FCECF00`), then delegates to `0x6FCF7CC0`.
 */
export function C2S_Packet_PlaceCursorItemIntoContainer_6FCEF270_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
  onPlaceIntoContainer?: (
    m: SparseMemory113c,
    dwContainerGuid: number,
    pPlayer: number,
    pGame: number,
    dwCursorGuid: number,
    pOutErr: number,
  ) => number,
): number {
  hitD2GameVa113c(0x6FCEF270)
  if ((nPacketLen | 0) !== 9) {
    return 3;
  }
  const dwCursorGuid = m.u32((pPacket + 1) >>> 0);
  const dwContainerGuid = m.u32((pPacket + 5) >>> 0);
  const err1 = C2S_ValidateItemInteractionByAnimMode_6FCED6D0_113c(
    m,
    pGame >>> 0,
    dwCursorGuid,
    pPlayer >>> 0,
  ) | 0;
  if (err1 !== 0) {
    return err1;
  }
  const err2 = C2S_ValidateStoredItem_6FCECF00_113c(
    m,
    pGame >>> 0,
    dwContainerGuid,
    pPlayer >>> 0,
  ) | 0;
  if (err2 !== 0) {
    return err2;
  }
  const sp = allocW14B1Stack(m, 8);
  try {
    m.setU32(sp, 0);
    const res =
      onPlaceIntoContainer !== undefined
        ? onPlaceIntoContainer(m, dwContainerGuid, pPlayer >>> 0, pGame >>> 0, dwCursorGuid, sp) | 0
        : D2Game_6FCF7CC0_113c(m, dwContainerGuid, pPlayer >>> 0, pGame >>> 0, dwCursorGuid, sp) | 0;
    if (res === 0 && m.u32(sp) !== 0) {
      return 3;
    }
    return 0;
  } finally {
    freeW14B1Stack(sp);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCEF2F0
 * @ordinalOrName sub_6FCEF2F0
 *
 * Client-to-host packet `0x1A` handler (`9` bytes): equip cursor item (`[pPacket + 1]`) to body location (`u8 [pPacket + 5]`).
 * Validates cursor item (`0x6FCECF70`) and body location (`1..10`), then delegates to `0x6FCF8020`.
 */
export function C2S_Packet1A_EquipCursorItem_6FCEF2F0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
  onEquipItem?: (
    m: SparseMemory113c,
    dwCursorGuid: number,
    pPlayer: number,
    pGame: number,
    bBodyLoc: number,
    nUnusedZero: number,
    pOutErr: number,
  ) => number,
): number {
  hitD2GameVa113c(0x6FCEF2F0)
  if ((nPacketLen | 0) !== 9) {
    return 3;
  }
  const dwCursorGuid = m.u32((pPacket + 1) >>> 0);
  const bBodyLoc = m.u8((pPacket + 5) >>> 0);
  const err = C2S_ValidateCursorItem_6FCECF70_113c(m, pGame >>> 0, dwCursorGuid, pPlayer >>> 0) | 0;
  if (err !== 0) {
    return err;
  }
  if (bBodyLoc <= 0 || bBodyLoc >= 0x0b) {
    return 2;
  }
  const sp = allocW14B1Stack(m, 8);
  try {
    m.setU32(sp, 0);
    const res =
      onEquipItem !== undefined
        ? onEquipItem(m, dwCursorGuid, pPlayer >>> 0, pGame >>> 0, bBodyLoc, 0, sp) | 0
        : D2Game_6FCF8020_113c(m, dwCursorGuid, pPlayer >>> 0, pGame >>> 0, bBodyLoc, 0, sp) | 0;
    if (res === 0 && m.u32(sp) !== 0) {
      return 3;
    }
    return 0;
  } finally {
    freeW14B1Stack(sp);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCEF570
 * @ordinalOrName sub_6FCEF570
 *
 * Client-to-host packet `0x32` handler (`17` bytes): buy item from NPC vendor.
 * Unpacks `dwNpcGuid`, `dwItemGuid`, `wTab`, `dwCost` and delegates to `0x6FCDF990`.
 */
export function C2S_Packet32_NpcBuyItem_6FCEF570_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
  onNpcBuy?: (
    m: SparseMemory113c,
    dwNpcGuid: number,
    pGame: number,
    pPlayer: number,
    dwItemGuid: number,
    wTab: number,
    dwCost: number,
  ) => number,
): number {
  hitD2GameVa113c(0x6FCEF570)
  if ((nPacketLen | 0) !== 0x11) {
    return 3;
  }
  const dwNpcGuid = m.u32((pPacket + 1) >>> 0);
  const dwItemGuid = m.u32((pPacket + 5) >>> 0);
  const wTab = m.u16((pPacket + 9) >>> 0);
  const dwCost = m.u32((pPacket + 0x0d) >>> 0);
  if (onNpcBuy !== undefined) {
    return onNpcBuy(m, dwNpcGuid, pGame >>> 0, pPlayer >>> 0, dwItemGuid, wTab, dwCost) | 0;
  }
  return D2Game_6FCDF990_113c(m, dwNpcGuid, pGame >>> 0, pPlayer >>> 0, dwItemGuid, wTab) | 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF0D30
 * @ordinalOrName sub_6FCF0D30
 *
 * Client-to-host packet `0x49` handler (`9` bytes): waypoint interaction (`dwWaypointGuid`, `wDestLevelId`).
 * Enforces the 10,000-ms cooldown against `[0x6FD18D10]`, validates waypoint interaction (`0x6FCECB50`),
 * clears interaction state on error if matched, and delegates to `0x6FC8E930`.
 */
export function C2S_Packet49_WaypointInteract_6FCF0D30_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
  onActivateWaypoint?: (
    m: SparseMemory113c,
    dwWaypointGuid: number,
    pPlayer: number,
    pGame: number,
    wDestLevelId: number,
  ) => void,
): number {
  hitD2GameVa113c(0x6FCF0D30)
  if ((nPacketLen | 0) !== 9) {
    return 3;
  }
  const dwWaypointGuid = m.u32((pPacket + 1) >>> 0);
  const wDestLevelId = m.u16((pPacket + 5) >>> 0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0;
  let dwLastTick = 0;
  if (pPlayerData !== 0) {
    dwLastTick = m.u32((pPlayerData + 0x160) >>> 0);
  } else {
    const pPlayerData2 = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0;
    if ((pPlayer >>> 0) !== 0) {
      let pNode = m.u32((pPlayerData2 + 0x38) >>> 0);
      while (pNode !== 0 && m.u32(pNode >>> 0) !== 0xffffffff) {
        pNode = m.u32((pNode + 0x10) >>> 0);
      }
      if (pNode !== 0) {
        dwLastTick = m.u32((pNode + 0x08) >>> 0);
      }
    }
  }
  const dwCurTick = m.u32(0x6fd18d10) >>> 0;
  if (((dwLastTick + 0x2710) >>> 0) > dwCurTick) {
    SUNIT_SetUnitEventSound113c(m, pPlayer >>> 0, 0x13, 0);
    m.setU32((pPlayer + 0x64) >>> 0, 0xffffffff);
    m.setU32((pPlayer + 0x68) >>> 0, 6);
    m.setU8((pPlayer + 0x6c) >>> 0, 0);
    return 1;
  }
  const err = C2S_ValidateWaypointInteraction_6FCECB50_113c(
    m,
    dwWaypointGuid,
    pGame >>> 0,
    pPlayer >>> 0,
    wDestLevelId,
  ) | 0;
  if (err !== 0) {
    let pInteractUnit = 0;
    if (m.u8((pPlayer + 0x6c) >>> 0) !== 0) {
      const dwInteractId = m.u32((pPlayer + 0x64) >>> 0);
      const nInteractType = (m.u32((pPlayer + 0x68) >>> 0) | 0);
      pInteractUnit = SUNIT_GetServerUnit113c(m, pGame >>> 0, nInteractType, dwInteractId) >>> 0;
    }
    if (pGame === 0) {
      throw new D2CommonAssertError('PacketHandler.cpp', 0x2d3);
    }
    const bucketIdx = (dwWaypointGuid & 0x7f) >>> 0;
    let pObj = m.u32((pGame + 0x1520 + (bucketIdx << 2)) >>> 0);
    while (pObj !== 0 && m.u32((pObj + 0x0c) >>> 0) !== dwWaypointGuid) {
      pObj = m.u32((pObj + 0xe4) >>> 0);
    }
    if (pObj !== 0 && pObj === pInteractUnit) {
      m.setU32((pPlayer + 0x64) >>> 0, 0xffffffff);
      m.setU32((pPlayer + 0x68) >>> 0, 6);
      m.setU8((pPlayer + 0x6c) >>> 0, 0);
    }
    return err;
  }
  if (onActivateWaypoint !== undefined) {
    onActivateWaypoint(m, dwWaypointGuid, pPlayer >>> 0, pGame >>> 0, wDestLevelId);
  } else {
    D2Game_6FC8E930_113c(m, dwWaypointGuid, pGame >>> 0, pPlayer >>> 0, wDestLevelId);
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF1010
 * @ordinalOrName sub_6FCF1010
 *
 * Client-to-host packet `0x1F` handler (`17` bytes): swap cursor item (`[pPacket + 1]`) with stored container item (`[pPacket + 5]`) at `(nX, nY)`.
 * Rejects invPage `1` or `2`, checks trade/interact manipulation rules (`0x6FC588C0`), and delegates to `0x6FCF7300`.
 */
export function C2S_Packet1F_SwapCursorWithContainerItem_6FCF1010_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
  onSwapContainerItem?: (
    m: SparseMemory113c,
    pPlayer: number,
    pGame: number,
    dwCursorGuid: number,
    dwStoredGuid: number,
    nX: number,
    nY: number,
    pOutErr: number,
  ) => number,
): number {
  hitD2GameVa113c(0x6FCF1010)
  if ((nPacketLen | 0) !== 0x11) {
    return 3;
  }
  const dwCursorGuid = m.u32((pPacket + 1) >>> 0);
  const dwStoredGuid = m.u32((pPacket + 5) >>> 0);
  const nX = (m.u32((pPacket + 9) >>> 0) | 0);
  const nY = (m.u32((pPacket + 0x0d) >>> 0) | 0);
  const err1 = C2S_ValidateCursorItem_6FCECF70_113c(m, pGame >>> 0, dwCursorGuid, pPlayer >>> 0) | 0;
  if (err1 !== 0) {
    return err1;
  }
  const err2 = C2S_ValidateStoredItem_6FCECF00_113c(m, pGame >>> 0, dwStoredGuid, pPlayer >>> 0) | 0;
  if (err2 !== 0) {
    return err2;
  }
  if (pGame === 0) {
    throw new D2CommonAssertError('PacketHandler.cpp', 0x2d3);
  }
  const bucketIdx = (dwStoredGuid & 0x7f) >>> 0;
  let pStoredItem = m.u32((pGame + 0x1720 + (bucketIdx << 2)) >>> 0);
  while (pStoredItem !== 0 && m.u32((pStoredItem + 0x0c) >>> 0) !== dwStoredGuid) {
    pStoredItem = m.u32((pStoredItem + 0xe4) >>> 0);
  }
  if (pStoredItem === 0) {
    return 2;
  }
  const bInvPage = ITEMS_GetInvPage113c(m, pStoredItem) & 0xff;
  if (bInvPage === 1 || bInvPage === 2) {
    return 3;
  }
  if (
    PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c(
      m,
      pPlayer >>> 0,
      pGame >>> 0,
      pStoredItem,
    ) === 0
  ) {
    return 0;
  }
  const sp = allocW14B1Stack(m, 8);
  try {
    m.setU32(sp, 0);
    const res =
      onSwapContainerItem !== undefined
        ? onSwapContainerItem(
            m,
            pPlayer >>> 0,
            pGame >>> 0,
            dwCursorGuid,
            dwStoredGuid,
            nX,
            nY,
            sp,
          ) | 0
        : D2Game_6FCF7300_113c(
            m,
            pPlayer >>> 0,
            pGame >>> 0,
            dwCursorGuid,
            dwStoredGuid,
            nX,
            nY,
            sp,
            sp,
          ) | 0;
    if (res === 0 && m.u32(sp) !== 0) {
      return 3;
    }
    return 0;
  } finally {
    freeW14B1Stack(sp);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF1200
 * @ordinalOrName sub_6FCF1200
 *
 * Client-to-host packet `0x1D` handler (`9` bytes): swap cursor item (`[pPacket + 1]`) with equipped body item (`u8 [pPacket + 5]`).
 * Validates cursor item, body location (`1..10`), existing equipped item, belt trade rules (`bodyLoc === 8`), and delegates to `0x6FCF8600`.
 */
export function C2S_Packet1D_SwapCursorWithBodyItem_6FCF1200_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
  onSwapBodyItem?: (
    m: SparseMemory113c,
    dwCursorGuid: number,
    pPlayer: number,
    pGame: number,
    bBodyLoc: number,
    nUnusedZero: number,
    pOutErr: number,
  ) => number,
): number {
  hitD2GameVa113c(0x6FCF1200)
  if ((nPacketLen | 0) !== 9) {
    return 3;
  }
  const dwCursorGuid = m.u32((pPacket + 1) >>> 0);
  const bBodyLoc = m.u8((pPacket + 5) >>> 0);
  const err = C2S_ValidateCursorItem_6FCECF70_113c(m, pGame >>> 0, dwCursorGuid, pPlayer >>> 0) | 0;
  if (err !== 0) {
    return err;
  }
  if (bBodyLoc <= 0 || bBodyLoc >= 0x0b) {
    return 2;
  }
  const pInv1 = m.u32((pPlayer + 0x60) >>> 0);
  if (INVENTORY_GetItemFromBodyLocMemPort113c(m, pInv1, bBodyLoc) === 0) {
    return 1;
  }
  if (bBodyLoc === 8) {
    if (PLRTRADE_CanModifyBeltDuringTrade113c(m, pPlayer >>> 0) === 0) {
      return 0;
    }
  }
  const pInv2 = m.u32((pPlayer + 0x60) >>> 0);
  const pBodyItem = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInv2, bBodyLoc) >>> 0;
  if (
    PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c(
      m,
      pPlayer >>> 0,
      pGame >>> 0,
      pBodyItem,
    ) === 0
  ) {
    return 0;
  }
  const sp = allocW14B1Stack(m, 8);
  try {
    m.setU32(sp, 0);
    const res =
      onSwapBodyItem !== undefined
        ? onSwapBodyItem(m, dwCursorGuid, pPlayer >>> 0, pGame >>> 0, bBodyLoc, 0, sp) | 0
        : D2Game_6FCF8600_113c(m, dwCursorGuid, pPlayer >>> 0, pGame >>> 0, bBodyLoc, 0, sp) | 0;
    if (res === 0 && m.u32(sp) !== 0) {
      return 3;
    }
    return 0;
  } finally {
    freeW14B1Stack(sp);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF8310
 * @ordinalOrName sub_6FCF8310
 *
 * Duplicates and drops/finalizes a cursor item (`eItemMode === 4`), clears cursor slot,
 * updates command flags (`0x1` if socketed, clears `0x4000`), and deletes original via `0x6FCF78C0`.
 */
export function ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c(
  m: SparseMemory113c,
  dwItemGuid: number,
  pGame: number,
  pPlayer: number,
  onDeleteItemUnit?: (
    m: SparseMemory113c,
    pGame: number,
    pPlayer: number,
    pItem: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FCF8310)
  if (pGame === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x834);
  }
  if (pPlayer === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x835);
  }
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pPlayer >>> 0);
  const bucketIdx = (dwItemGuid & 0x7f) >>> 0;
  let pItem = m.u32((pGame + 0x1720 + (bucketIdx << 2)) >>> 0);
  while (pItem !== 0 && m.u32((pItem + 0x0c) >>> 0) !== (dwItemGuid >>> 0)) {
    pItem = m.u32((pItem + 0xe4) >>> 0);
  }
  if (pItem === 0 || m.u32(pItem >>> 0) !== 4 || m.u32((pItem + 0x10) >>> 0) !== 4) {
    return;
  }
  const sp = allocW14B1Stack(m, 0x18);
  try {
    const spInCoords = sp >>> 0;
    const spOutCoords = (sp + 8) >>> 0;
    m.setU32(spInCoords, 0);
    m.setU32((spInCoords + 4) >>> 0, 0);
    PATH_GetTargetTypeAndPosition113c(m, pPlayer >>> 0, spInCoords);
    const pRoom = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0;
    if (pRoom === 0) {
      return;
    }
    const pDropRoom = ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(m, pRoom, spInCoords, spOutCoords, 1) >>> 0;
    if (pDropRoom === 0) {
      return;
    }
    ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c(
      m,
      m.u32((spOutCoords + 4) >>> 0) | 0,
      pItem,
      pDropRoom,
      pGame >>> 0,
      pPlayer >>> 0,
      m.u32(spOutCoords) | 0,
    );
    INVENTORY_SetCursorItem113c(m, m.u32((pPlayer + 0x60) >>> 0), 0);
    if (ITEMS_HasSocketedSubItems113c(m, pItem) !== 0) {
      ITEMS_SetOrClearCommandFlags113c(m, pItem, 1, 1);
    }
    if (ITEMS_CheckCommandFlags113c(m, pItem, 0x4000) !== 0) {
      ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x4000, 0);
    }
    if (onDeleteItemUnit !== undefined) {
      onDeleteItemUnit(m, pGame >>> 0, pPlayer >>> 0, pItem);
    } else {
      D2Game_6FCF78C0_113c(m, pGame >>> 0, pPlayer >>> 0, pItem);
    }
  } finally {
    freeW14B1Stack(sp);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FD087E0
 * @ordinalOrName sub_6FD087E0
 *
 * Act 3 Quest 3 (`0x12`) Khalim item cleanup handler (`'qey '`, `'qhr '`, `'qbr '`, `'qf1 '`, `'qf2 '`).
 * If quest `0x12` bit `0` is set, deletes Khalim items immediately; otherwise on entering Act 3 (`act === 2`),
 * sets quest `0x12` bits `0` and `0x0D`, deletes Khalim items if not trading, and updates quest `0x15` bit `0` if bit `4` is set.
 */
export function ACT3Q3_CleanupKhalimItemsOnEnterAct2OrComplete_6FD087E0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  _dwUnused: number = 0,
  onDeleteQuestItem?: (
    m: SparseMemory113c,
    pPlayerUnit: number,
    pItem: number,
    pGame: number,
    pInventory: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FD087E0)
  const bDiff = m.u8((pGame + 0x6d) >>> 0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0;
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0);
  const khalimCodes = [0x20796571, 0x20726871, 0x20726271, 0x20316671, 0x20326671];
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 0) === 1) {
    for (let i = 0; i < 5; i = (i + 1) | 0) {
      const pItem = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
        m,
        pPlayer >>> 0,
        pGame >>> 0,
        khalimCodes[i]!,
      ) >>> 0;
      if (pItem !== 0) {
        const pInv = m.u32((pPlayer + 0x60) >>> 0);
        if (onDeleteQuestItem !== undefined) {
          onDeleteQuestItem(m, pPlayer >>> 0, pItem, pGame >>> 0, pInv);
        } else {
          D2Game_6FC565E0_113c(m, pItem, pPlayer >>> 0, pGame >>> 0, pInv);
        }
      }
    }
    return;
  }
  const pRoom = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0;
  if (pRoom === 0) {
    return;
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0;
  const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff;
  if (nAct !== 2) {
    return;
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x12, 0);
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x12, 0x0d);
  if (PLRTRADE_IsInteractingWithValidPlayer113c(m, pPlayer >>> 0, pGame >>> 0) === 0) {
    for (let i = 0; i < 5; i = (i + 1) | 0) {
      const pItem = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
        m,
        pPlayer >>> 0,
        pGame >>> 0,
        khalimCodes[i]!,
      ) >>> 0;
      if (pItem !== 0) {
        const pInv = m.u32((pPlayer + 0x60) >>> 0);
        if (onDeleteQuestItem !== undefined) {
          onDeleteQuestItem(m, pPlayer >>> 0, pItem, pGame >>> 0, pInv);
        } else {
          D2Game_6FC565E0_113c(m, pItem, pPlayer >>> 0, pGame >>> 0, pInv);
        }
      }
    }
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 4) !== 0) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0) === 0) {
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x15, 0);
    }
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FD09C80
 * @ordinalOrName sub_6FD09C80
 *
 * Act 3 Quest 2 (`0x11` / `0x13`) Gidbinn Altar object operate handler (`0x6FD09C80`).
 * Validates object mode `0` and player quest `0x13` bits `0`, `7`, `8`, activates altar anim mode `1`,
 * schedules event `1`, and arms quest timer `0x6FD08F30` (`7` ticks).
 */
export function ACT3Q2_OperateGidbinnAltar_6FD09C80_113c(
  m: SparseMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FD09C80)
  const pObj = m.u32((pOperateArgs + 0x04) >>> 0);
  if (pObj !== 0 && m.u32((pObj + 0x10) >>> 0) !== 0) {
    return 0;
  }
  const pGame = m.u32(pOperateArgs >>> 0);
  const pPlayer = m.u32((pOperateArgs + 0x08) >>> 0);
  const bDiff = m.u8((pGame + 0x6d) >>> 0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0;
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 7) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 8) !== 0
  ) {
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, 0);
    return 0;
  }
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  if (pQuestControl === 0) {
    return 0;
  }
  let pQuest = m.u32(pQuestControl >>> 0);
  while (pQuest !== 0 && m.u32(pQuest >>> 0) !== 0x11) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0);
  }
  if (pQuest === 0 || m.u8((pQuest + 0x09) >>> 0) === 0) {
    return 0;
  }
  if (m.u8((pQuest + 0x0c) >>> 0) === 0) {
    m.setU8((pQuest + 0x0c) >>> 0, 1);
  }
  UNITS_ChangeAnimMode113c(m, pObj, 1);
  const nObjId = (m.u32((pOperateArgs + 0x10) >>> 0) | 0);
  const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjId) >>> 0;
  const pGameRef = m.u32(pOperateArgs >>> 0);
  const dwAnimDelta = m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8;
  const dwTargetFrame = (m.u32((pGameRef + 0xa8) >>> 0) + dwAnimDelta) >>> 0;
  EVENT_SetEventFull113c(m, pGameRef, pObj, 1, dwTargetFrame, 0, 0, 0);
  const pQuestExt = m.u32((pQuest + 0x18) >>> 0);
  m.setU8((pQuestExt + 0x03) >>> 0, 1);
  if (m.u8((pQuestExt + 0x05) >>> 0) === 0) {
    m.setU8((pQuestExt + 0x05) >>> 0, 1);
    QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 7, pQuest, 0x6fd08f30);
  }
  return 0;
}
