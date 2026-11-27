/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 8 Batch 2 (`w8b2`) routines across
 * `0x6FC85760..0x6FCDA5E0` (30 functions).
 */

import {
  COLLISION_CheckMaskWithPattern2_113c,
  COLLISION_CheckMaskWithSizeXY113c,
} from '../common/collision.js';
import { UNITS_GetPlayerData113c } from '../common/composit.js';
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.js';
import {
  DUNGEON_CountNonPresetRoomsInLevel113c,
  DUNGEON_GetLevelIdFromRoom113c,
} from '../common/dungeon.js';
import { D2CommonAssertError } from '../common/inline-helpers.js';
import {
  INVENTORY_AllocInventory113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetItemNodePositionOther113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_IsItemOwnedByInventory113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory.js';
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_B043_GetMaxDurabilityFromUnit113c,
  ITEMS_B043_GetTotalStatFromUnitFast113c,
  ITEMS_GetBodyLocation113c,
  ITEMS_GetInvPage113c,
  ITEMS_GetMagicSuffix113c,
  ITEMS_IsHighQualityItem113c,
  ITEMS_SetBodyLocation113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../common/items.js';
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
} from '../common/k0-d2common-memports.js';
import {
  PATH_ComputeSquaredDistance113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_GetUnitCollisionPattern113c,
  PATH_SetStepNum113c,
  PATH_SetTargetUnit113c,
} from '../common/path.js';
import {
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_ClearQuestStateBits2To11_113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record.js';
import {
  SKILLS_GetParam1113c,
  SKILLS_GetUsedSkill113c,
} from '../common/skills.js';
import {
  DUNGEON_GetActLevelId113c,
  STATES_CheckStateMask2OnUnit113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATLIST_AddUnitStat113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitHirelingResurrectCost113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.js';
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITS_GetInteractItemGuid113c,
  UNITS_GetRoom113c,
  UNITS_GetUnitSizeX113c,
  UNITS_GetUnitSizeY113c,
  UNITS_SetCollisionMaskAtCoords113c,
  UNITS_SetInteractItem113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
} from '../common/unit.js';
import type { SparseMemory113c } from '../mem/sparse-memory.js';
import { seedRoll } from '../prng.js';
import {
  DATATBLS_GetItemsTxtRecordByCode113c,
  DATATBLS_GetQualityItemsTxtRecord113c,
  MONSTERS_IsDead113c,
} from '../tables/datatbls-113c.js';
import {
  MONSTER_InitModeChangeStrc113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c.js';
import {
  D2GAME_PACKET_SendPlayerPartyRelationship113c,
  D2GAME_PARTY_GetPartyIdForUnit113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c.js';
import {
  AI_Stall113c,
  ITEMS_FinalizeCreatedItem113c,
  MONSTER_BroadcastEventSoundToClients113c,
  MONSTER_StartMode113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
} from './combat-a1c-113c.js';
import {
  OBJECTS_SetUnitField7CDword4_113c,
  QUESTS_GuidListAdd113c,
  QUESTS_GuidListContains113c,
  QUESTS_SendNpcMessagePacket27_113c,
  QUESTS_SendQuestItemState2_5D_113c,
} from './k2-items-tc-w1-113c.js';
import { ITEMS_SpawnItemWithParams_6FC31980_113c } from './k2-laneI-0x6fc3-w1-113c.js';
import {
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
  QUESTS_SetGlobalQuestState_6FC53920_113c,
} from './k2-laneJ-0x6fc4-w1-113c.js';
import {
  PLAYER_SetPlayerDataField48_6FC57480_113c,
  QUESTS_CompleteQuestForPlayerGuidList_6FC55A20_113c,
} from './k2-laneK-0x6fc5-w1-113c.js';
import { QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c } from './k2-w2b1-113c.js';
import {
  ACT1Q1_PlayDenClearedSoundCallback_6FC82C60_113c,
  ACT1Q1_SetCompletedBeforeAlertCallback_6FC82CD0_113c,
} from './k2-w2b2-113c.js';
import { NET_SendPacket9B_MercReviveInfo_6FCAA690_113c } from './k2-w2b3-113c.js';
import {
  PARTY_FindSubPartyById_6FCBBD00_113c,
  S2C_QueueByteDwordPacket6_6FCAC3B0_113c,
  SUMMON_GetFirstPetGuidForType_6FCB67B0_113c,
} from './k2-w2b4-113c.js';
import { SKILLS_ResolveSummonMonsterId_6FCBEE50_113c } from './k2-w2b5-113c.js';
import {
  AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c,
  AI_StartModeAtCoordsKeepSteps_6FD121E0_113c,
} from './k2-w2b8-113c.js';
import { AI_ApproachTarget113c } from './k2-real-s2c-combat-113c.js';
import { QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c } from './k2-w3b3-113c.js';
import {
  ACT1Q4_SetCompletedBeforeAndAddGuidCallback_6FC81910_113c,
  ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c,
} from './k2-w3b6-113c.js';
import {
  OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c,
  OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c,
} from './k2-w3b7-113c.js';
import {
  ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c,
  ACT1Q6_SendAlert06IfQuest06Active_6FC82700_113c,
} from './k2-w4b2-113c.js';
import {
  ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c,
  ACT5Q5_OnArreatSummitPortalResetAncients_6FC7E3C0_113c,
  ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c,
} from './k2-w4b3-113c.js';
import { OBJ_ScheduleObjectTrapEventOrSound_6FC8DD60_113c } from './k2-w4b4-113c.js';
import {
  PARTY_CountSubPartyMembers_6FCBBF40_113c,
  PETS_FindPetTypeByGuid_6FCB6600_113c,
  PETS_GetFirstPetUnitByType_6FCB6A40_113c,
  PETS_SendPacket7A_UnsummonPet_6FCB6810_113c,
} from './k2-w4b5-113c.js';
import {
  ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c,
  ACT4Q1_SendQuestAlertIfEligible_6FCD9D20_113c,
  ACT4Q1_SyncPlayerQuest19State_6FCD96A0_113c,
} from './k2-w4b8-113c.js';
import { ACT1Q1_PropagateQuestStateToPartyCallback_6FC85200_113c } from './k2-w5b2-113c.js';
import {
  ACT5Q3_FindAnyaTownSpawnPosition_6FD02780_113c,
  SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c,
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c,
} from './k2-w5b7-113c.js';
import { PARTY_InitPlayerRelationOnJoinCallback_6FD10B10_113c } from './k2-w5b9-113c.js';
import { NET_BroadcastSystemChatMessage_6FCEBE70_113c } from './k2-w6b3-113c.js';
import {
  ACT1Q1_TimerPromoteState5_6FC83B50_113c,
  PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c,
} from './k2-w6b4-113c.js';
import { ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c } from './k2-w6b6-113c.js';
import {
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c,
  SKILLS_ApplyDimVisionToTarget_6FC70470_113c,
} from './k2-w7b1-113c.js';
import {
  ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c,
  ACT1Q4_SpawnTristramPortalAtCairnStones_6FC87A90_113c,
  ACT1Q4_TrySpawnSecretCowLevelPortal_6FC874A0_113c,
  ACT1Q4_UpdateGibbetModeAndCainState_6FC88280_113c,
  ACT1Q6_SpawnCatacombs4ReturnPortal_6FC87320_113c,
  OBJECTS_ApplyLightningTrapDamageInRoom_6FC8AE60_113c,
  SKILLS_TryConvertMonsterOnHit_6FCB5120_113c,
} from './k2-w7b2-113c.js';
import {
  MONAI_SiegeMinionThinkA_6FCC5EB0_113c,
  MONAI_SiegeMinionThinkB_6FCC6050_113c,
  MONAI_SiegeMinionThinkC_6FCC62D0_113c,
  MONSTER_ReactivateOrResurrectInRoom_6FCD33B0_113c,
  PARTY_RemoveSubPartyById_6FCBC7D0_113c,
  PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c,
  PORTAL_SpawnLinkedPortalPair_6FCC24C0_113c,
} from './k2-w7b3-113c.js';
import {
  ACT3Q0_ScheduleDarkWandererTimerOnPlayerSeen_6FD06760_113c,
  ITEMS_ConsumeSkeletonKeyFromInventory_6FCF4140_113c,
  ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c,
  ITEMS_EquipStoredItemToBodyLoc_6FCF57F0_113c,
  ITEMS_UseBeltItem_6FCF8BA0_113c,
  ITEMS_UseInventoryItem_6FCF9BF0_113c,
  MONSTER_SpawnFallenShamanPack_6FD0FB80_113c,
} from './k2-w7b4-113c.js';
import {
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.js';
import { SUNIT_FreeUnit113c } from './replay-final11-113c.js';
import { ITEMS_CheckItemTypeId113c } from './replay-kernel-113c.js';
import { UNITS_ChangeAnimMode113c } from './monster-events.js';
import { EVENT_SetEventFull113c } from './timer-wheel.js';
import { UNITS_GetOctileDistanceToCoordinates113c } from './town-npc-ai-113c.js';
import { hitD2GameVa113c } from '../va-trace-113c.js';

void ACT1Q1_TimerPromoteState5_6FC83B50_113c;
void ACT1Q4_SpawnTristramPortalAtCairnStones_6FC87A90_113c;

/**
 * @dll D2Game.dll
 * @va 0x6FC85760
 * @ordinalOrName ACT1Q1_OnMonsterKilled_6FC85760
 */
export function ACT1Q1_OnMonsterKilled_6FC85760_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC85760);
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) return;
  const pGame = m.u32(pQuestArg >>> 0);
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0);
  const pDenStats = m.u32((pGame + 0x110) >>> 0);
  if (pDenStats === 0) {
    throw new D2CommonAssertError('0x6FD19FF9', 0x1e4);
  }
  const nMonstersRemaining =
    ((m.u32((pDenStats + 0x2cc) >>> 0) | 0) - (m.u32((pDenStats + 0x2d0) >>> 0) | 0)) | 0;
  m.setU32((pQuestExt + 0x88) >>> 0, nMonstersRemaining >>> 0);
  const pKiller = m.u32((pQuestArg + 0x0c) >>> 0);
  if (pKiller !== 0) {
    const dwKillerGuid = m.u32((pKiller + 0x0c) >>> 0);
    if (QUESTS_GuidListContains113c(m, pQuestExt, dwKillerGuid) === 0) {
      QUESTS_GuidListAdd113c(m, pQuestExt, dwKillerGuid);
    }
  }
  const nActNo = DRLG_GetActNoFromLevelId113c(m, 8) & 0xff;
  const pAct = m.u32((pGame + nActNo * 4 + 0xbc) >>> 0);
  const nRoomCount = DUNGEON_CountNonPresetRoomsInLevel113c(m, pAct, 8);
  const nVisitedRooms = (m.u32((pDenStats + 0x04) >>> 0) | 0);
  if (
    nRoomCount <= nVisitedRooms &&
    (m.u32((pDenStats + 0x2d0) >>> 0) | 0) === (m.u32((pDenStats + 0x2cc) >>> 0) | 0)
  ) {
    if (m.u32(0x6fd31c20) !== 0) {
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        0x6fd1b2e0,
        m.u32((pQuestData + 0x04) >>> 0),
        4,
      );
    }
    m.setU8((pQuestExt + 0x84) >>> 0, 1);
    m.setU32((pQuestData + 0xa8) >>> 0, 0);
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 4);
    const nQuestId = (m.u32((pQuestData + 0xe0) >>> 0) | 0);
    m.setU32((pQuestData + 0xc0) >>> 0, 0);
    QUESTS_SetGlobalQuestState_6FC53920_113c(
      m,
      m.u32(pQuestArg >>> 0),
      nQuestId,
      0x0d,
    );
    QUESTS_CompleteQuestForPlayerGuidList_6FC55A20_113c(
      m,
      (m.u32((pQuestData + 0xe0) >>> 0) | 0),
      m.u32(pQuestArg >>> 0),
      pQuestExt,
      0,
    );
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(pQuestArg >>> 0),
      ACT1Q1_PropagateQuestStateToPartyCallback_6FC85200_113c,
      0,
      m.u32((pQuestArg + 0x08) >>> 0),
    );
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(pQuestArg >>> 0),
      ACT1Q1_SetCompletedBeforeAlertCallback_6FC82CD0_113c,
      0,
      m.u32((pQuestArg + 0x08) >>> 0),
    );
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(pQuestArg >>> 0),
      ACT1Q1_PlayDenClearedSoundCallback_6FC82C60_113c,
      0,
      m.u32((pQuestArg + 0x08) >>> 0),
    );
    const pQuestGame = m.u32((pQuestData + 0x04) >>> 0);
    const pQuestControl = m.u32((pQuestGame + 0x10f4) >>> 0);
    m.setU8((pQuestControl + 0x20) >>> 0, 0);
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pQuestGame,
      QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c,
      0,
      0,
    );
    if (m.u8((pQuestExt + 0x87) >>> 0) === 0) {
      m.setU8((pQuestExt + 0x87) >>> 0, 1);
      QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 8, pQuestData, 0x6fc83b50);
    }
    return;
  }
  if (nRoomCount <= nVisitedRooms && (m.u32((pQuestExt + 0x88) >>> 0) | 0) <= 5) {
    m.setU8((pQuestData + 0x14) >>> 0, 0x20);
    m.setU8((pQuestData + 0x0b) >>> 0, 4);
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c,
      0,
      0,
    );
    m.setU32((pQuestData + 0xa8) >>> 0, 0);
    return;
  }
  if (
    m.u8((pQuestData + 0x0b) >>> 0) === 4 &&
    (m.u32((pQuestExt + 0x88) >>> 0) | 0) > 5
  ) {
    m.setU8((pQuestData + 0x14) >>> 0, 0x20);
    m.setU8((pQuestData + 0x0b) >>> 0, 4);
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c,
      0,
      0,
    );
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC85D40
 * @ordinalOrName ACT1Q5_OnTreeOfInifussOperated_6FC85D40
 */
export function ACT1Q5_OnTreeOfInifussOperated_6FC85D40_113c(
  m: SparseMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC85D40);
  const pGame = m.u32(pOperateArgs >>> 0);
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  if (pQuestControl === 0) return 0;
  let pQuestData = m.u32(pQuestControl >>> 0);
  if (pQuestData === 0) return 0;
  while (m.u32(pQuestData >>> 0) !== 3) {
    pQuestData = m.u32((pQuestData + 0xf4) >>> 0);
    if (pQuestData === 0) return 0;
  }
  const pObjectUnit = m.u32((pOperateArgs + 0x04) >>> 0);
  const nObjMode = pObjectUnit !== 0 ? m.u32((pObjectUnit + 0x10) >>> 0) : 0;
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) {
    UNITS_ChangeAnimMode113c(m, pObjectUnit, 2);
    const pPlayer = m.u32((pOperateArgs + 0x08) >>> 0);
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, pPlayer);
    return 0;
  }
  if (nObjMode !== 0) return 0;
  const pPlayerData = UNITS_GetPlayerData113c(
    m,
    m.u32((pOperateArgs + 0x08) >>> 0),
  );
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestRecord = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0);
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 3, 0) === 1) return 0;
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 3, 1) === 1) return 0;
  if (
    STATLIST_GetUnitBaseStat113c(m, m.u32((pOperateArgs + 0x08) >>> 0), 0x0c, 0) <
    8
  ) {
    const pPlayer = m.u32((pOperateArgs + 0x08) >>> 0);
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, pPlayer);
    return 0;
  }
  const pObj = m.u32((pOperateArgs + 0x04) >>> 0);
  m.setU32((pObj + 0xb8) >>> 0, 0x206d6468);
  const pScratchItemLevel = (0x7fff0000 - 0x400) >>> 0;
  if (
    ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
      m,
      m.u32(pOperateArgs >>> 0),
      m.u32((pOperateArgs + 0x04) >>> 0),
      2,
      pScratchItemLevel,
      0,
      -1,
      0,
    ) === 0
  ) {
    return 0;
  }
  UNITS_ChangeAnimMode113c(m, m.u32((pOperateArgs + 0x04) >>> 0), 2);
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0);
  m.setU8((pQuestExt + 0x01) >>> 0, 1);
  m.setU32((pQuestExt + 0x98) >>> 0, 2);
  const pObjAfter = m.u32((pOperateArgs + 0x04) >>> 0);
  const dwObjGuid =
    pObjAfter !== 0 ? m.u32((pObjAfter + 0x0c) >>> 0) : 0xffffffff;
  m.setU32((pQuestExt + 0x04) >>> 0, dwObjGuid >>> 0);
  m.setU32((pQuestExt + 0x9c) >>> 0, (m.u32((pQuestExt + 0x9c) >>> 0) + 1) >>> 0);
  if (m.u8((pQuestData + 0x0c) >>> 0) !== 4) {
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 4);
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c,
      0,
      0,
    );
  }
  if (m.u8((pQuestData + 0x0b) >>> 0) !== 1) {
    m.setU8((pQuestData + 0x14) >>> 0, 0);
    m.setU8((pQuestData + 0x0b) >>> 0, 1);
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC87C60
 * @ordinalOrName ACT1Q6_TimerTickAndarielDeathSequence_6FC87C60
 */
export function ACT1Q6_TimerTickAndarielDeathSequence_6FC87C60_113c(
  m: SparseMemory113c,
  pGame: number,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FC87C60);
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0);
  const wTimerTicks = (m.u16((pQuestExt + 0x192) >>> 0) + 1) & 0xffff;
  m.setU16((pQuestExt + 0x192) >>> 0, wTimerTicks);
  const nSignedTicks = (wTimerTicks << 16) >> 16;
  if (nSignedTicks === 10) {
    const dwTargetGuid = m.u32((pQuestExt + 0x18c) >>> 0);
    if (pGame === 0) {
      throw new D2CommonAssertError('0x6FD19FF9', 0x2d3);
    }
    let pUnit = m.u32((pGame + (dwTargetGuid & 0x7f) * 4 + 0x1320) >>> 0);
    while (pUnit !== 0 && m.u32((pUnit + 0x0c) >>> 0) !== dwTargetGuid) {
      pUnit = m.u32((pUnit + 0xe4) >>> 0);
    }
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pGame,
      ACT1Q6_SpawnCatacombs4ReturnPortal_6FC87320_113c,
      0,
      pUnit,
    );
    return 0;
  }
  if (nSignedTicks !== 12) return 0;
  const bQuestState = m.u8((pQuestData + 0x0b) >>> 0);
  if (bQuestState !== 3 && bQuestState !== 0x0d) {
    m.setU8((pQuestData + 0x14) >>> 0, 0);
    m.setU8((pQuestData + 0x0b) >>> 0, 3);
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      ACT1Q6_SendAlert06IfQuest06Active_6FC82700_113c,
      0,
      0,
    );
  }
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC87D20
 * @ordinalOrName ACT1Q4_OnCairnStoneInit_6FC87D20
 */
export function ACT1Q4_OnCairnStoneInit_6FC87D20_113c(
  m: SparseMemory113c,
  pObjInitArgs: number,
): void {
  hitD2GameVa113c(0x6FC87D20);
  const pGame = m.u32(pObjInitArgs >>> 0);
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  let pQuestData = pQuestControl !== 0 ? m.u32(pQuestControl >>> 0) : 0;
  while (pQuestData !== 0 && m.u32(pQuestData >>> 0) !== 4) {
    pQuestData = m.u32((pQuestData + 0xf4) >>> 0);
  }
  if (pQuestData === 0) {
    const pObjectUnit = m.u32((pObjInitArgs + 0x04) >>> 0);
    if (pObjectUnit === 0 || m.u32((pObjectUnit + 0x10) >>> 0) !== 2) {
      UNITS_ChangeAnimMode113c(m, pObjectUnit, 2);
    }
    return;
  }
  const pObjectUnit = m.u32((pObjInitArgs + 0x04) >>> 0);
  const nObjClassId =
    pObjectUnit !== 0 ? (m.u32((pObjectUnit + 0x04) >>> 0) | 0) : -1;
  const bActive = m.u8((pQuestData + 0x09) >>> 0);
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0);
  if (bActive !== 0 && m.u8((pQuestExt + 0x4c) >>> 0) === 0) {
    if (
      m.u8((pQuestExt + 0x4d) >>> 0) !== 0 ||
      m.u8((pQuestExt + 0x50) >>> 0) !== 0
    ) {
      UNITS_ChangeAnimMode113c(m, pObjectUnit, 2);
      return;
    }
    if (m.u8((pQuestExt + nObjClassId + 0x4b) >>> 0) === 1) {
      m.setU8((pQuestExt + nObjClassId + 0x4b) >>> 0, 0);
      UNITS_ChangeAnimMode113c(m, m.u32((pObjInitArgs + 0x04) >>> 0), 0);
    }
    return;
  }
  const bPortalSpawned = m.u8((pQuestExt + 0x45) >>> 0);
  m.setU8((pQuestExt + 0x4c) >>> 0, 0);
  if (bPortalSpawned === 0 && nObjClassId === 0x11) {
    const pObj = m.u32((pObjInitArgs + 0x04) >>> 0);
    const dwObjGuid = pObj !== 0 ? m.u32((pObj + 0x0c) >>> 0) : 0xffffffff;
    m.setU32((pQuestExt + 0x40) >>> 0, dwObjGuid >>> 0);
    if (m.u8((pQuestExt + 0x44) >>> 0) === 0) {
      m.setU8((pQuestExt + 0x44) >>> 0, 1);
      QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 1, pQuestData, 0x6fc87a90);
    }
  }
  UNITS_ChangeAnimMode113c(m, m.u32((pObjInitArgs + 0x04) >>> 0), 2);
}

/**
 * @dll D2Game.dll
 * @va 0x6FC883C0
 * @ordinalOrName ACT1Q4_OnPlayerEnterTristramWithCainUnrescued_6FC883C0
 */
export function ACT1Q4_OnPlayerEnterTristramWithCainUnrescued_6FC883C0_113c(
  m: SparseMemory113c,
  pPlayerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC883C0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestRecord = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0);
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  let pQuestData = pQuestControl !== 0 ? m.u32(pQuestControl >>> 0) : 0;
  while (pQuestData !== 0 && m.u32(pQuestData >>> 0) !== 4) {
    pQuestData = m.u32((pQuestData + 0xf4) >>> 0);
  }
  if (
    DRLGWARP_TestRoomTileBit113c(
      m,
      pQuestRecord,
      (m.u32((pQuestData + 0xe0) >>> 0) | 0),
      0,
    ) === 1
  ) {
    return;
  }
  if (
    DRLGWARP_TestRoomTileBit113c(
      m,
      pQuestRecord,
      (m.u32((pQuestData + 0xe0) >>> 0) | 0),
      1,
    ) === 1
  ) {
    return;
  }
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0);
  if (m.u8((pQuestExt + 0x50) >>> 0) !== 0) return;
  if (m.u8((pQuestData + 0x0c) >>> 0) >= 6) return;
  ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c(m, pQuestData);
  ACT1Q4_UpdateGibbetModeAndCainState_6FC88280_113c(m, pQuestData, 0, 1);
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 7);
  m.setU8((pQuestData + 0x14) >>> 0, 0);
  m.setU8((pQuestData + 0x0b) >>> 0, 5);
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c,
    0,
    pPlayerUnit,
  );
  QUESTS_SetGlobalQuestState_6FC53920_113c(m, pGame, 4, 0x0d);
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    pGame,
    ACT1Q4_SetCompletedBeforeAndAddGuidCallback_6FC81910_113c,
    0,
    0,
  );
}

/**
 * @dll D2Game.dll
 * @va 0x6FC88D70
 * @ordinalOrName ACT1Q5_OnForgottenTowerTomeOperated_6FC88D70
 */
export function ACT1Q5_OnForgottenTowerTomeOperated_6FC88D70_113c(
  m: SparseMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC88D70);
  const pObjectUnit = m.u32((pOperateArgs + 0x04) >>> 0);
  if (pObjectUnit === 0 || m.u32((pObjectUnit + 0x10) >>> 0) === 0) {
    UNITS_ChangeAnimMode113c(m, pObjectUnit, 1);
    const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(
      m,
      (m.u32((pOperateArgs + 0x10) >>> 0) | 0),
    );
    const dwFrameCnt1 = m.u32((pObjTxt + 0xdc) >>> 0) >>> 8;
    const pGame = m.u32(pOperateArgs >>> 0);
    const dwTargetFrame = (dwFrameCnt1 + m.u32((pGame + 0xa8) >>> 0)) >>> 0;
    EVENT_SetEventFull113c(
      m,
      pGame,
      m.u32((pOperateArgs + 0x04) >>> 0),
      1,
      dwTargetFrame,
      0,
      0,
      0,
    );
  }
  const pGame = m.u32(pOperateArgs >>> 0);
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  if (pQuestControl === 0) return 0;
  let pQuestData = m.u32(pQuestControl >>> 0);
  if (pQuestData === 0) return 0;
  while (m.u32(pQuestData >>> 0) !== 5) {
    pQuestData = m.u32((pQuestData + 0xf4) >>> 0);
    if (pQuestData === 0) return 0;
  }
  if (m.u8((pQuestData + 0x09) >>> 0) !== 0) {
    QUESTS_SendNpcMessagePacket27_113c(
      m,
      m.u32((pOperateArgs + 0x08) >>> 0),
      m.u32((pOperateArgs + 0x04) >>> 0),
      0x7f,
    );
    if (m.u8((pQuestData + 0x0c) >>> 0) <= 1) {
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 2);
      if (m.u8((pQuestData + 0x0b) >>> 0) < 1) {
        const pQuestExt = m.u32((pQuestData + 0x18) >>> 0);
        m.setU8((pQuestExt + 0x11b) >>> 0, 1);
      }
    }
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8A9D0
 * @ordinalOrName OBJ_OperateDoorWithLockCheck_6FC8A9D0
 */
export function OBJ_OperateDoorWithLockCheck_6FC8A9D0_113c(
  m: SparseMemory113c,
  pOperateArgs: number,
  dwTickCount = m.u32(0x6fd18d10),
): number {
  hitD2GameVa113c(0x6FC8A9D0);
  const pScratchCoords = (0x7fff0000 - 0x410) >>> 0;
  const pRoom = UNITS_GetRoom113c(m, m.u32((pOperateArgs + 0x04) >>> 0));
  PATH_GetTargetTypeAndPosition113c(
    m,
    m.u32((pOperateArgs + 0x04) >>> 0),
    pScratchCoords,
  );
  const nSizeX = UNITS_GetUnitSizeX113c(m, m.u32((pOperateArgs + 0x04) >>> 0));
  const nSizeY = UNITS_GetUnitSizeY113c(m, m.u32((pOperateArgs + 0x04) >>> 0));
  const dwNowTick = dwTickCount >>> 0;
  const pObjectUnit = m.u32((pOperateArgs + 0x04) >>> 0);
  const nObjMode = pObjectUnit !== 0 ? m.u32((pObjectUnit + 0x10) >>> 0) : 0;
  const dwNextAllowedTick = (m.u32((pObjectUnit + 0xd4) >>> 0) + 0x1f4) >>> 0;
  if (dwNowTick < dwNextAllowedTick || nObjMode > 6) {
    return 1;
  }
  switch (nObjMode) {
    case 6: {
      if (
        ITEMS_ConsumeSkeletonKeyFromInventory_6FCF4140_113c(
          m,
          m.u32((pOperateArgs + 0x08) >>> 0),
          m.u32(pOperateArgs >>> 0),
        ) === 0
      ) {
        const pPlayer = m.u32((pOperateArgs + 0x08) >>> 0);
        SUNIT_SetUnitEventSound113c(m, pPlayer, 0x16, pPlayer);
        return 1;
      }
      UNITS_SetTargetUnitForDynamicUnitEx113c(
        m,
        m.u32((pOperateArgs + 0x04) >>> 0),
      );
      UNITS_ChangeAnimMode113c(m, m.u32((pOperateArgs + 0x04) >>> 0), 2);
      m.setU32((m.u32((pOperateArgs + 0x04) >>> 0) + 0xd4) >>> 0, dwNowTick);
      return 1;
    }
    case 0: {
      UNITS_SetTargetUnitForDynamicUnitEx113c(
        m,
        m.u32((pOperateArgs + 0x04) >>> 0),
      );
      UNITS_ChangeAnimMode113c(m, m.u32((pOperateArgs + 0x04) >>> 0), 2);
      m.setU32((m.u32((pOperateArgs + 0x04) >>> 0) + 0xd4) >>> 0, dwNowTick);
      return 1;
    }
    case 2:
    case 5: {
      const nX = (m.u32(pScratchCoords) | 0);
      const nY = (m.u32((pScratchCoords + 0x04) >>> 0) | 0);
      const wHit1 =
        COLLISION_CheckMaskWithSizeXY113c(
          m,
          pRoom,
          nX,
          nY,
          nSizeX,
          nSizeY,
          0x8180,
        ) & 0xffff;
      if (wHit1 === 0) {
        UNITS_SetCollisionMaskAtCoords113c(
          m,
          m.u32((pOperateArgs + 0x04) >>> 0),
          pRoom,
          (m.u32(pScratchCoords) | 0),
          (m.u32((pScratchCoords + 0x04) >>> 0) | 0),
        );
        UNITS_ChangeAnimMode113c(m, m.u32((pOperateArgs + 0x04) >>> 0), 0);
        m.setU32((m.u32((pOperateArgs + 0x04) >>> 0) + 0xd4) >>> 0, dwNowTick);
        return 1;
      }
      const wHit2 =
        COLLISION_CheckMaskWithSizeXY113c(
          m,
          pRoom,
          (m.u32(pScratchCoords) | 0),
          (m.u32((pScratchCoords + 0x04) >>> 0) | 0),
          nSizeX,
          nSizeY,
          0x8000,
        ) & 0xffff;
      if (wHit2 === 0) {
        if (nObjMode === 5) return 1;
        UNITS_ChangeAnimMode113c(m, m.u32((pOperateArgs + 0x04) >>> 0), 5);
        m.setU32((m.u32((pOperateArgs + 0x04) >>> 0) + 0xd4) >>> 0, dwNowTick);
        return 1;
      }
      UNITS_ChangeAnimMode113c(m, m.u32((pOperateArgs + 0x04) >>> 0), 4);
      m.setU32((m.u32((pOperateArgs + 0x04) >>> 0) + 0xd4) >>> 0, dwNowTick);
      return 1;
    }
    default:
      return 1;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8E150
 * @ordinalOrName OBJ_ThinkEventSparkyChest_6FC8E150
 */
export function OBJ_ThinkEventSparkyChest_6FC8E150_113c(
  m: SparseMemory113c,
  pGame: number,
  pObjectUnit: number,
): void {
  hitD2GameVa113c(0x6FC8E150);
  const nObjMode = pObjectUnit !== 0 ? m.u32((pObjectUnit + 0x10) >>> 0) : 0;
  const nObjClassId =
    pObjectUnit !== 0 ? (m.u32((pObjectUnit + 0x04) >>> 0) | 0) : -1;
  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjClassId);
  if (nObjMode === 1) {
    EVENT_SetEventFull113c(
      m,
      pGame,
      pObjectUnit,
      9,
      (m.u32((pGame + 0xa8) >>> 0) + 10) >>> 0,
      0,
      0,
      0,
    );
    return;
  }
  if (nObjMode === 2) {
    const pObjectData = m.u32((pObjectUnit + 0x14) >>> 0);
    const bSparkCount = (m.u8((pObjectData + 0x04) >>> 0) + 1) & 0xff;
    m.setU8((pObjectData + 0x04) >>> 0, bSparkCount);
    if (bSparkCount <= 1) {
      UNITS_GetRoom113c(m, pObjectUnit);
      OBJECTS_ApplyLightningTrapDamageInRoom_6FC8AE60_113c(
        m,
        pObjectUnit,
        pGame,
      );
      EVENT_SetEventFull113c(
        m,
        pGame,
        pObjectUnit,
        9,
        (m.u32((pGame + 0xa8) >>> 0) + 25) >>> 0,
        0,
        0,
        0,
      );
      return;
    }
    const pLocalOperateArgs = (0x7fff0000 - 0x430) >>> 0;
    m.setU32(pLocalOperateArgs, pGame >>> 0);
    m.setU32((pLocalOperateArgs + 0x04) >>> 0, pObjectUnit >>> 0);
    m.setU32((pLocalOperateArgs + 0x08) >>> 0, 0);
    UNITS_GetRoom113c(m, pObjectUnit);
    m.setU32((pLocalOperateArgs + 0x0c) >>> 0, m.u32((pGame + 0x10f0) >>> 0));
    m.setU32((pLocalOperateArgs + 0x10) >>> 0, m.u32((pObjectUnit + 0x04) >>> 0));
    if (
      OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(
        m,
        pLocalOperateArgs,
        0,
      ) === 0
    ) {
      return;
    }
    UNITS_ChangeAnimMode113c(m, pObjectUnit, 3);
    const dwFrameCnt3 = m.u32((pObjTxt + 0xe4) >>> 0) >>> 8;
    const dwTargetFrame =
      (dwFrameCnt3 + m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0;
    EVENT_SetEventFull113c(
      m,
      pGame,
      pObjectUnit,
      9,
      dwTargetFrame,
      0,
      0,
      0,
    );
    return;
  }
  if (nObjMode === 3) {
    UNITS_ChangeAnimMode113c(m, pObjectUnit, 4);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8E400
 * @ordinalOrName OBJ_ThinkEventLightningSpire_6FC8E400
 */
export function OBJ_ThinkEventLightningSpire_6FC8E400_113c(
  m: SparseMemory113c,
  pGame: number,
  pObjectUnit: number,
): void {
  hitD2GameVa113c(0x6FC8E400);
  if (pObjectUnit !== 0 && m.u32((pObjectUnit + 0x10) >>> 0) === 1) {
    m.setU32((pObjectUnit + 0x10) >>> 0, 2);
  }
  UNITS_GetRoom113c(m, pObjectUnit);
  const pGameSeed = m.u32((pGame + 0x10f0) >>> 0);
  OBJECTS_ApplyLightningTrapDamageInRoom_6FC8AE60_113c(m, pObjectUnit, pGame);
  const prod =
    BigInt(m.u32(pGameSeed >>> 0)) * 0x6ac690c5n +
    BigInt(m.u32((pGameSeed + 0x04) >>> 0));
  const low = Number(prod & 0xffffffffn) >>> 0;
  const high = Number((prod >> 32n) & 0xffffffffn) >>> 0;
  m.setU32((pGameSeed + 0x04) >>> 0, high);
  m.setU32(pGameSeed >>> 0, low);
  const rem = (low % 0x23) >>> 0;
  const dwTargetFrame = (m.u32((pGame + 0xa8) >>> 0) + rem + 0x0f) >>> 0;
  EVENT_SetEventFull113c(m, pGame, pObjectUnit, 0, dwTargetFrame, 0, 0, 0);
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8F040
 * @ordinalOrName OBJ_OperateChestAndSparkyChest_6FC8F040
 */
export function OBJ_OperateChestAndSparkyChest_6FC8F040_113c(
  m: SparseMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8F040);
  const pObjectUnit = m.u32((pOperateArgs + 0x04) >>> 0);
  if (pObjectUnit !== 0 && m.u32((pObjectUnit + 0x10) >>> 0) !== 0) {
    return 1;
  }
  const pRoom = UNITS_GetRoom113c(m, pObjectUnit);
  DUNGEON_GetLevelIdFromRoom113c(m, pRoom);
  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(
    m,
    (m.u32((pOperateArgs + 0x10) >>> 0) | 0),
  );
  const pObjUnitForData = m.u32((pOperateArgs + 0x04) >>> 0);
  const pObjectData = m.u32((pObjUnitForData + 0x14) >>> 0);
  const bChestFlags = m.u8((pObjectData + 0x04) >>> 0);
  const bLocked = bChestFlags & 0x80;
  let nBaseDrops = 0;
  if (bLocked !== 0) {
    const pPlayerUnit = m.u32((pOperateArgs + 0x08) >>> 0);
    if (pPlayerUnit === 0 || m.u32((pPlayerUnit + 0x04) >>> 0) !== 6) {
      if (
        ITEMS_ConsumeSkeletonKeyFromInventory_6FCF4140_113c(
          m,
          pPlayerUnit,
          m.u32(pOperateArgs >>> 0),
        ) === 0
      ) {
        const pPlayer = m.u32((pOperateArgs + 0x08) >>> 0);
        SUNIT_SetUnitEventSound113c(m, pPlayer, 0x16, pPlayer);
        return 1;
      }
    }
    const pPlayerUnlock = m.u32((pOperateArgs + 0x08) >>> 0);
    SUNIT_SetUnitEventSound113c(m, pPlayerUnlock, 0x0b, pPlayerUnlock);
    const pPlayer2 = m.u32((pOperateArgs + 0x08) >>> 0);
    let pClient = 0;
    if (pPlayer2 !== 0 && m.u32(pPlayer2 >>> 0) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer2);
      pClient = m.u32((pPlayerData + 0x9c) >>> 0);
    }
    if (pClient !== 0) {
      MONSTER_BroadcastEventSoundToClients113c(m, pPlayer2, pClient);
    }
    nBaseDrops = 1;
  }
  const nDropAttempts = (nBaseDrops + 1) >>> 0;
  const pScratchCoords = (0x7fff0000 - 0x450) >>> 0;
  PATH_GetTargetTypeAndPosition113c(
    m,
    m.u32((pOperateArgs + 0x04) >>> 0),
    pScratchCoords,
  );
  const pObjUnit = m.u32((pOperateArgs + 0x04) >>> 0);
  let bIsSuperChest = 0;
  if (pObjUnit === 0) {
    throw new D2CommonAssertError('0x6FD19FF9', 0xa51);
  }
  let nDropTier = 0;
  if ((m.u8((pObjUnit + 0x78) >>> 0) & 1) !== 0) {
    const pSeed = m.u32((pOperateArgs + 0x0c) >>> 0);
    const prod =
      BigInt(m.u32(pSeed >>> 0)) * 0x6ac690c5n +
      BigInt(m.u32((pSeed + 0x04) >>> 0));
    const low = Number(prod & 0xffffffffn) >>> 0;
    const high = Number((prod >> 32n) & 0xffffffffn) >>> 0;
    m.setU32(pSeed >>> 0, low);
    m.setU32((pSeed + 0x04) >>> 0, high);
    const rem = (low % 100) >>> 0;
    bIsSuperChest = 1;
    nDropTier = rem < 5 ? 6 : 4;
  }
  const pObjCheck = m.u32((pOperateArgs + 0x04) >>> 0);
  if (pObjCheck !== 0 && m.u32((pObjCheck + 0x04) >>> 0) === 0x18d) {
    const pSeed = m.u32((pOperateArgs + 0x0c) >>> 0);
    let nHighQualCount = 0;
    bIsSuperChest = 0;
    const prod =
      BigInt(m.u32(pSeed >>> 0)) * 0x6ac690c5n +
      BigInt(m.u32((pSeed + 0x04) >>> 0));
    const low = Number(prod & 0xffffffffn) >>> 0;
    const high = Number((prod >> 32n) & 0xffffffffn) >>> 0;
    m.setU32((pSeed + 0x04) >>> 0, high);
    m.setU32(pSeed >>> 0, low);
    const nRoll10000 = (low % 0x2710) >>> 0;
    let bRunFallback = false;
    if (nRoll10000 < 0xc8) {
      const pItem1 = OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(
        m,
        pOperateArgs,
        7,
      );
      if (pItem1 === 0) {
        bRunFallback = true;
      } else if (ITEMS_IsHighQualityItem113c(m, pItem1) === 0) {
        const pItem2 = OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(
          m,
          pOperateArgs,
          7,
        );
        if (pItem2 === 0 || ITEMS_IsHighQualityItem113c(m, pItem2) === 0) {
          bRunFallback = true;
        }
      }
    } else if (nRoll10000 < 0x258) {
      const pItem1 = OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(
        m,
        pOperateArgs,
        5,
      );
      if (pItem1 === 0) {
        bRunFallback = true;
      } else if (ITEMS_IsHighQualityItem113c(m, pItem1) === 0) {
        const pItem2 = OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(
          m,
          pOperateArgs,
          5,
        );
        if (pItem2 === 0 || ITEMS_IsHighQualityItem113c(m, pItem2) === 0) {
          bRunFallback = true;
        }
      }
    } else if (nRoll10000 < 0x4b0) {
      const pItem1 = OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(
        m,
        pOperateArgs,
        6,
      );
      if (pItem1 === 0) {
        bRunFallback = true;
      } else if (ITEMS_IsHighQualityItem113c(m, pItem1) === 0) {
        const pItem2 = OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(
          m,
          pOperateArgs,
          6,
        );
        if (pItem2 === 0 || ITEMS_IsHighQualityItem113c(m, pItem2) === 0) {
          bRunFallback = true;
        }
      }
    } else if (nRoll10000 < 0xc80) {
      for (let i = 0; i < 10; i++) {
        const pItem = OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(
          m,
          pOperateArgs,
          4,
        );
        if (pItem !== 0) {
          if (ITEMS_IsHighQualityItem113c(m, pItem) !== 0) nHighQualCount++;
          bIsSuperChest++;
        }
        if (nHighQualCount >= 3) break;
      }
      if (bIsSuperChest === 0) bRunFallback = true;
    } else if (nRoll10000 < 0x1838) {
      let nLowQualDrops = bIsSuperChest;
      for (let i = 0; i < 10; i++) {
        const pItem = OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(
          m,
          pOperateArgs,
          4,
        );
        if (pItem !== 0) {
          if (ITEMS_IsHighQualityItem113c(m, pItem) !== 0) nHighQualCount++;
          else nLowQualDrops++;
        }
        if (nHighQualCount >= 2) break;
      }
      if (nLowQualDrops === 0) {
        if (
          OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(
            m,
            pOperateArgs,
            0,
          ) !== 0
        ) {
          nLowQualDrops = 1;
        }
      }
      if (nLowQualDrops < 7) {
        const nGoldDrops = 7 - nLowQualDrops;
        for (let i = 0; i < nGoldDrops; i++) {
          OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(
            m,
            0x20646c67,
            m.u32((pOperateArgs + 0x04) >>> 0),
            m.u32(pOperateArgs >>> 0),
            0,
          );
        }
      }
    } else {
      bRunFallback = true;
    }
    if (bRunFallback) {
      let nFallbackLow = bIsSuperChest;
      for (let i = 0; i < 10; i++) {
        const pItem = OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(
          m,
          pOperateArgs,
          4,
        );
        if (pItem !== 0) {
          if (ITEMS_IsHighQualityItem113c(m, pItem) !== 0) break;
          nFallbackLow++;
        }
      }
      if (nFallbackLow < 4) {
        const nRem = 4 - nFallbackLow;
        for (let i = 0; i < nRem; i++) {
          OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, pOperateArgs, 0);
        }
      }
      for (let i = 0; i < 5; i++) {
        OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(
          m,
          0x20646c67,
          m.u32((pOperateArgs + 0x04) >>> 0),
          m.u32(pOperateArgs >>> 0),
          0,
        );
      }
      for (let i = 0; i < 2; i++) {
        OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(
          m,
          0x20337068,
          m.u32((pOperateArgs + 0x04) >>> 0),
          m.u32(pOperateArgs >>> 0),
          0,
        );
      }
      for (let i = 0; i < 2; i++) {
        OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(
          m,
          0x2033706d,
          m.u32((pOperateArgs + 0x04) >>> 0),
          m.u32(pOperateArgs >>> 0),
          0,
        );
      }
    }
  } else {
    const pSeed = m.u32((pOperateArgs + 0x0c) >>> 0);
    const prod =
      BigInt(m.u32(pSeed >>> 0)) * 0x6ac690c5n +
      BigInt(m.u32((pSeed + 0x04) >>> 0));
    const low = Number(prod & 0xffffffffn) >>> 0;
    const high = Number((prod >> 32n) & 0xffffffffn) >>> 0;
    m.setU32((pSeed + 0x04) >>> 0, high);
    m.setU32(pSeed >>> 0, low);
    const nRoll100 = (low % 100) >>> 0;
    if (nRoll100 >= 25 || bIsSuperChest !== 0 || bLocked !== 0) {
      let nHighDropped = 0;
      for (let i = 0; i < nDropAttempts; i++) {
        const pItem = OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(
          m,
          pOperateArgs,
          nDropTier,
        );
        if (pItem !== 0 && ITEMS_IsHighQualityItem113c(m, pItem) !== 0) {
          nHighDropped++;
        }
      }
      if (bIsSuperChest !== 0 && nHighDropped === 0) {
        while (nHighDropped < 10) {
          const pItem = OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(
            m,
            pOperateArgs,
            nDropTier,
          );
          if (pItem !== 0 && ITEMS_IsHighQualityItem113c(m, pItem) !== 0) {
            break;
          }
          nHighDropped++;
        }
      }
    }
  }
  if (m.u8((pObjTxt + 0x140) >>> 0) !== 0) {
    UNITS_ChangeAnimMode113c(m, m.u32((pOperateArgs + 0x04) >>> 0), 1);
    const pGame = m.u32(pOperateArgs >>> 0);
    const dwFrameCnt1 = m.u32((pObjTxt + 0xdc) >>> 0) >>> 8;
    const dwTargetFrame =
      (dwFrameCnt1 + m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0;
    EVENT_SetEventFull113c(
      m,
      pGame,
      m.u32((pOperateArgs + 0x04) >>> 0),
      1,
      dwTargetFrame,
      0,
      0,
      0,
    );
  } else {
    UNITS_ChangeAnimMode113c(m, m.u32((pOperateArgs + 0x04) >>> 0), 2);
  }
  const pObjAfter = m.u32((pOperateArgs + 0x04) >>> 0);
  if (pObjAfter !== 0) {
    m.setU32(
      (pObjAfter + 0xc4) >>> 0,
      (m.u32((pObjAfter + 0xc4) >>> 0) & 0xfffffffd) >>> 0,
    );
  }
  const pObjAfter2 = m.u32((pOperateArgs + 0x04) >>> 0);
  if (m.u32((pObjAfter2 + 0xb8) >>> 0) !== 0) {
    const pScratchItemLvl = (0x7fff0000 - 0x458) >>> 0;
    ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
      m,
      m.u32(pOperateArgs >>> 0),
      pObjAfter2,
      2,
      pScratchItemLvl,
      0,
      -1,
      1,
    );
  }
  OBJ_ScheduleObjectTrapEventOrSound_6FC8DD60_113c(
    m,
    pOperateArgs,
    bChestFlags & 0x7f,
  );
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC92210
 * @ordinalOrName CUBE_Op15_SpawnSecretCowLevelPortal_6FC92210
 */
export function CUBE_Op15_SpawnSecretCowLevelPortal_6FC92210_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
): number {
  hitD2GameVa113c(0x6FC92210);
  return ACT1Q4_TrySpawnSecretCowLevelPortal_6FC874A0_113c(
    m,
    pGame,
    pPlayerUnit,
  );
}

/**
 * @dll D2Game.dll
 * @va 0x6FC98B60
 * @ordinalOrName MONSTER_AutoEquipInteractItem_6FC98B60
 */
export function MONSTER_AutoEquipInteractItem_6FC98B60_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  bInitBodyLoc = 0,
): void {
  hitD2GameVa113c(0x6FC98B60);
  const pScratchBodyLoc = (0x7fff0000 - 0x460) >>> 0;
  m.setU32(pScratchBodyLoc, bInitBodyLoc & 0xff);
  const dwItemGuid = UNITS_GetInteractItemGuid113c(m, pUnit) >>> 0;
  if (dwItemGuid === 0) return;
  if (pGame === 0) {
    throw new D2CommonAssertError('0x6FD19FF9', 0x2d3);
  }
  let pItem = m.u32((pGame + (dwItemGuid & 0x7f) * 4 + 0x1720) >>> 0);
  while (pItem !== 0 && m.u32((pItem + 0x0c) >>> 0) !== dwItemGuid) {
    pItem = m.u32((pItem + 0xe4) >>> 0);
  }
  const pInventory = m.u32((pUnit + 0x60) >>> 0);
  if (
    pItem !== 0 &&
    pInventory !== 0 &&
    (ITEMS_GetInvPage113c(m, pItem) & 0xff) === 0 &&
    INVENTORY_IsItemOwnedByInventory113c(m, pInventory, pItem) !== 0 &&
    ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c(
      m,
      pItem,
      pUnit,
      pScratchBodyLoc,
      0,
    ) !== 0
  ) {
    const nBodyLoc = (m.u32(pScratchBodyLoc) | 0);
    if (INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, nBodyLoc) !== 0) {
      throw new D2CommonAssertError('0x6FD19FF9', 0x4e9);
    }
    ITEMS_EquipStoredItemToBodyLoc_6FCF57F0_113c(
      m,
      pUnit,
      pGame,
      dwItemGuid,
      nBodyLoc,
    );
  }
  UNITS_SetInteractItem113c(m, pUnit, 0);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB54F0
 * @ordinalOrName AURA_ApplyRadialDamageCallback_6FCB54F0
 */
export function AURA_ApplyRadialDamageCallback_6FCB54F0_113c(
  m: SparseMemory113c,
  pAuraIterArgs: number,
  pDefender: number,
  pfnApplyAuraStatFilter?: (
    m: SparseMemory113c,
    pAuraDamageCtx: number,
    pDefender: number,
    pGame: number,
    pAttacker: number,
  ) => number,
): number {
  hitD2GameVa113c(0x6FCB54F0);
  const pGame = m.u32(pAuraIterArgs >>> 0);
  const pAttacker = m.u32((pAuraIterArgs + 0x04) >>> 0);
  const pAuraDamageCtx = m.u32((pAuraIterArgs + 0x0c) >>> 0);
  const nFilterResult =
    pfnApplyAuraStatFilter !== undefined
      ? pfnApplyAuraStatFilter(
          m,
          pAuraDamageCtx,
          pDefender,
          pGame,
          pAttacker,
        )
      : SKILLS_TryConvertMonsterOnHit_6FCB5120_113c(
          m,
          pAuraDamageCtx,
          pDefender,
          pGame,
          pAttacker,
        );
  if (nFilterResult === 0) {
    const pTemplateDmg = m.u32(pAuraDamageCtx >>> 0);
    const pScratchDmg = (0x7fff0000 - 0x500) >>> 0;
    for (let i = 0; i < 0x1c; i++) {
      m.setU32(
        (pScratchDmg + i * 4) >>> 0,
        m.u32((pTemplateDmg + i * 4) >>> 0),
      );
    }
    SUNITDMG_ApplyDamage113c(
      m,
      m.u32(pAuraIterArgs >>> 0),
      m.u32((pAuraIterArgs + 0x04) >>> 0),
      pDefender,
      pScratchDmg,
      1,
      undefined,
      1,
    );
    SUNITDMG_ApplySideEffectsAndKill113c(
      m,
      m.u32(pAuraIterArgs >>> 0),
      m.u32((pAuraIterArgs + 0x04) >>> 0),
      pDefender,
      pScratchDmg,
    );
  }
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB6C00
 * @ordinalOrName PETS_UnsummonPetsBeyondDistanceSq_6FCB6C00
 */
export function PETS_UnsummonPetsBeyondDistanceSq_6FCB6C00_113c(
  m: SparseMemory113c,
  pPetListWrapper: number,
  pGame: number,
  pPlayerUnit: number,
  nMaxDistSq: number,
): void {
  hitD2GameVa113c(0x6FCB6C00);
  let pPetNode = m.u32(pPetListWrapper >>> 0);
  while (pPetNode !== 0) {
    const pNextNode = m.u32((pPetNode + 0x14) >>> 0);
    if ((m.u8(pPetNode >>> 0) & 1) === 0) {
      const dwPetGuid = m.u32((pPetNode + 0x04) >>> 0);
      if (pGame === 0) {
        throw new D2CommonAssertError('0x6FD19FF9', 0x2d3);
      }
      let pPetUnit = m.u32((pGame + (dwPetGuid & 0x7f) * 4 + 0x1320) >>> 0);
      while (pPetUnit !== 0 && m.u32((pPetUnit + 0x0c) >>> 0) !== dwPetGuid) {
        pPetUnit = m.u32((pPetUnit + 0xe4) >>> 0);
      }
      if (pPetUnit !== 0) {
        const uPetType = (m.u32(pPetUnit >>> 0) | 0);
        let nPetY = 0;
        if (uPetType === 2 || (uPetType > 3 && uPetType <= 5)) {
          nPetY = (m.u32((m.u32((pPetUnit + 0x2c) >>> 0) + 0x10) >>> 0) | 0);
        } else {
          const pPetPath = m.u32((pPetUnit + 0x2c) >>> 0);
          nPetY = pPetPath !== 0 ? PATH_GetPosY113c(m, pPetPath) : 0;
        }
        const uPetType2 = (m.u32(pPetUnit >>> 0) | 0);
        let nPetX = 0;
        if (uPetType2 === 2 || (uPetType2 > 3 && uPetType2 <= 5)) {
          nPetX = (m.u32((m.u32((pPetUnit + 0x2c) >>> 0) + 0x0c) >>> 0) | 0);
        } else {
          const pPetPath = m.u32((pPetUnit + 0x2c) >>> 0);
          nPetX = pPetPath !== 0 ? PATH_GetPosX113c(m, pPetPath) : 0;
        }
        const uPlrType = (m.u32(pPlayerUnit >>> 0) | 0);
        let nPlayerY = 0;
        if (uPlrType === 2 || (uPlrType > 3 && uPlrType <= 5)) {
          nPlayerY = (m.u32((m.u32((pPlayerUnit + 0x2c) >>> 0) + 0x10) >>> 0) | 0);
        } else {
          const pPlrPath = m.u32((pPlayerUnit + 0x2c) >>> 0);
          nPlayerY = pPlrPath !== 0 ? PATH_GetPosY113c(m, pPlrPath) : 0;
        }
        const uPlrType2 = (m.u32(pPlayerUnit >>> 0) | 0);
        let nPlayerX = 0;
        if (uPlrType2 === 2 || (uPlrType2 > 3 && uPlrType2 <= 5)) {
          nPlayerX = (m.u32((m.u32((pPlayerUnit + 0x2c) >>> 0) + 0x0c) >>> 0) | 0);
        } else {
          const pPlrPath = m.u32((pPlayerUnit + 0x2c) >>> 0);
          nPlayerX = pPlrPath !== 0 ? PATH_GetPosX113c(m, pPlrPath) : 0;
        }
        const nDistSq = PATH_ComputeSquaredDistance113c(
          nPlayerX,
          nPlayerY,
          nPetX,
          nPetY,
        );
        if ((nDistSq | 0) > (nMaxDistSq | 0)) {
          PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c(
            m,
            pGame,
            pPlayerUnit,
            m.u32((pPetNode + 0x04) >>> 0),
            1,
          );
        }
      }
    }
    pPetNode = pNextNode;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB6EA0
 * @ordinalOrName PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0
 */
export function PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c(
  m: SparseMemory113c,
  nPetType: number,
  pPlayerUnit: number,
  pGame: number,
  nMaxCount: number,
): void {
  hitD2GameVa113c(0x6FCB6EA0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  if (pPlayerData === 0) {
    throw new D2CommonAssertError('0x6FD19FF9', 0x200);
  }
  if (nPetType === 1 && nMaxCount !== 1) return;
  const pPlayerPets = m.u32((pPlayerData + 0x44) >>> 0);
  if (pPlayerPets === 0 || nPetType < 0) return;
  const pDataTablesPtr = m.u32(0x6fd1829c);
  const pDataTables = m.u32(pDataTablesPtr >>> 0);
  if (nPetType >= (m.u32((pDataTables + 0xbf0) >>> 0) | 0)) return;
  const pPetTypeArray = m.u32(pPlayerPets >>> 0);
  const pPetTypeEntry = (pPetTypeArray + nPetType * 12) >>> 0;
  if (pPetTypeEntry === 0) return;
  const nCurCount = (m.u32((pPetTypeEntry + 0x04) >>> 0) | 0);
  m.setU32((pPetTypeEntry + 0x08) >>> 0, nMaxCount >>> 0);
  if (nCurCount <= nMaxCount) return;
  while ((m.u32((pPetTypeEntry + 0x04) >>> 0) | 0) > 0 && nPetType !== 7) {
    const nBefore = (m.u32((pPetTypeEntry + 0x04) >>> 0) | 0);
    const dwPetGuid = SUMMON_GetFirstPetGuidForType_6FCB67B0_113c(
      m,
      pPlayerUnit,
      nPetType,
    );
    PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c(
      m,
      pGame,
      pPlayerUnit,
      dwPetGuid,
      1,
    );
    if ((m.u32((pPetTypeEntry + 0x04) >>> 0) | 0) <= nMaxCount) break;
    if ((m.u32((pPetTypeEntry + 0x04) >>> 0) | 0) === nBefore) break;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB7C20
 * @ordinalOrName PETS_UnsummonSameGroupPetTypes_6FCB7C20
 */
export function PETS_UnsummonSameGroupPetTypes_6FCB7C20_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  nPetType: number,
): void {
  hitD2GameVa113c(0x6FCB7C20);
  if (pPlayerUnit === 0 || m.u32(pPlayerUnit >>> 0) !== 0) return;
  if (nPetType < 0) return;
  const pDataTablesPtr = m.u32(0x6fd1829c);
  let pDataTables = m.u32(pDataTablesPtr >>> 0);
  let nPetTypeCount = (m.u32((pDataTables + 0xbf0) >>> 0) | 0);
  if (nPetType >= nPetTypeCount) return;
  const pPetTypeTxt = (m.u32((pDataTables + 0xbe8) >>> 0) + nPetType * 0xe0) >>> 0;
  if (pPetTypeTxt === 0) return;
  const nGroup = ((m.u16((pPetTypeTxt + 0x08) >>> 0) << 16) >> 16);
  if (nGroup <= 0) return;
  if (nPetTypeCount <= 0) return;
  let nByteOffset = 0;
  for (let nOtherType = 0; nOtherType < nPetTypeCount; ) {
    if (
      nOtherType !== nPetType &&
      nByteOffset >= 0 &&
      nOtherType < nPetTypeCount
    ) {
      const pOtherTxt =
        (m.u32((pDataTables + 0xbe8) >>> 0) + nByteOffset) >>> 0;
      if (pOtherTxt !== 0 && ((m.u16((pOtherTxt + 0x08) >>> 0) << 16) >> 16) === nGroup) {
        let pPetUnit = PETS_GetFirstPetUnitByType_6FCB6A40_113c(
          m,
          pPlayerUnit,
          nOtherType,
          1,
          pGame,
        );
        while (pPetUnit !== 0) {
          const dwPetGuid = m.u32((pPetUnit + 0x0c) >>> 0);
          PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c(
            m,
            pGame,
            pPlayerUnit,
            dwPetGuid,
            1,
          );
          const pNextPet = PETS_GetFirstPetUnitByType_6FCB6A40_113c(
            m,
            pPlayerUnit,
            nOtherType,
            1,
            pGame,
          );
          if (pNextPet === pPetUnit) break;
          pPetUnit = pNextPet;
        }
      }
    }
    pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0);
    nPetTypeCount = (m.u32((pDataTables + 0xbf0) >>> 0) | 0);
    nOtherType++;
    nByteOffset = (nByteOffset + 0xe0) | 0;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB8070
 * @ordinalOrName PETS_UnsummonPetAndCheckNodeStillExists_6FCB8070
 */
export function PETS_UnsummonPetAndCheckNodeStillExists_6FCB8070_113c(
  m: SparseMemory113c,
  pPetUnit: number,
  pPlayerUnit: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCB8070);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  if (pPlayerData === 0) {
    throw new D2CommonAssertError('0x6FD19FF9', 0x2d3);
  }
  const dwPetGuid =
    pPetUnit !== 0 ? m.u32((pPetUnit + 0x0c) >>> 0) : 0xffffffff;
  const pPlayerPets = m.u32((pPlayerData + 0x44) >>> 0);
  if (pPlayerPets === 0) return 0;
  const nPetType = PETS_FindPetTypeByGuid_6FCB6600_113c(
    m,
    pPlayerUnit,
    dwPetGuid,
  );
  if (nPetType !== 7) {
    PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c(
      m,
      pGame,
      pPlayerUnit,
      dwPetGuid,
      0,
    );
  }
  if (nPetType < 0) return 0;
  const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0);
  if (nPetType >= (m.u32((pDataTables + 0xbf0) >>> 0) | 0)) return 0;
  const pPetTypeArray = m.u32(pPlayerPets >>> 0);
  const pPetTypeEntry = (pPetTypeArray + nPetType * 12) >>> 0;
  if (pPetTypeEntry === 0) return 0;
  let pNode = m.u32(pPetTypeEntry >>> 0);
  while (pNode !== 0) {
    if (m.u32((pNode + 0x04) >>> 0) === (dwPetGuid >>> 0)) return 1;
    pNode = m.u32((pNode + 0x14) >>> 0);
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB8120
 * @ordinalOrName PETS_OnPetOrMercKilled_6FCB8120
 */
export function PETS_OnPetOrMercKilled_6FCB8120_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  pPetUnit: number,
): void {
  hitD2GameVa113c(0x6FCB8120);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  if (pPlayerData === 0) {
    throw new D2CommonAssertError('0x6FD19FF9', 0x2a0);
  }
  const dwPetGuid =
    pPetUnit !== 0 ? m.u32((pPetUnit + 0x0c) >>> 0) : 0xffffffff;
  const pPlayerPets = m.u32((pPlayerData + 0x44) >>> 0);
  if (pPlayerPets === 0) return;
  const nPetType = PETS_FindPetTypeByGuid_6FCB6600_113c(
    m,
    pPlayerUnit,
    dwPetGuid,
  );
  if (nPetType !== 7) {
    PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c(
      m,
      pGame,
      pPlayerUnit,
      dwPetGuid,
      0,
    );
  }
  if (nPetType < 0) return;
  const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0);
  if (nPetType >= (m.u32((pDataTables + 0xbf0) >>> 0) | 0)) return;
  const pPetTypeArray = m.u32(pPlayerPets >>> 0);
  const pPetTypeEntry = (pPetTypeArray + nPetType * 12) >>> 0;
  if (pPetTypeEntry === 0) return;
  let pNode = m.u32(pPetTypeEntry >>> 0);
  while (pNode !== 0 && m.u32((pNode + 0x04) >>> 0) !== (dwPetGuid >>> 0)) {
    pNode = m.u32((pNode + 0x14) >>> 0);
  }
  if (pNode !== 0) {
    m.setU32(pNode >>> 0, (m.u32(pNode >>> 0) | 1) >>> 0);
    let pClient = 0;
    if (pPlayerUnit !== 0 && m.u32(pPlayerUnit >>> 0) === 0) {
      const pPlrData2 = UNITS_GetPlayerData113c(m, pPlayerUnit);
      pClient = m.u32((pPlrData2 + 0x9c) >>> 0);
    }
    const dwReviveCost = STATLIST_GetUnitHirelingResurrectCost113c(m, pPetUnit);
    const wMercNameId = m.u16((pNode + 0x0c) >>> 0);
    NET_SendPacket9B_MercReviveInfo_6FCAA690_113c(
      m,
      wMercNameId,
      dwReviveCost,
      pClient,
    );
  }
  const pTempNode = (0x7fff0000 - 0x520) >>> 0;
  m.setU32(pTempNode, dwPetGuid >>> 0);
  m.setU32((pTempNode + 0x04) >>> 0, 0);
  m.setU32((pTempNode + 0x08) >>> 0, 0);
  m.setU32((pTempNode + 0x0c) >>> 0, 0);
  m.setU32((pTempNode + 0x10) >>> 0, 0);
  m.setU32((pTempNode + 0x14) >>> 0, 0);
  m.setU32((pTempNode + 0x18) >>> 0, 0);
  D2GAME_SUNIT_IterateAllLivingPlayers113c(
    m,
    pGame,
    (_m, _g, pPlr, pCtx) =>
      PETS_SendPacket7A_UnsummonPet_6FCB6810_113c(m, pPlr, pCtx),
    pTempNode,
  );
}

/**
 * @dll D2Game.dll
 * @va 0x6FCBC840
 * @ordinalOrName PARTY_LeavePartyForPlayer_6FCBC840
 */
export function PARTY_LeavePartyForPlayer_6FCBC840_113c(
  m: SparseMemory113c,
  pPlayerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCBC840);
  if (pPlayerUnit === 0) {
    throw new D2CommonAssertError('0x6FD19FF9', 0x130);
  }
  const dwPlayerGuid = m.u32((pPlayerUnit + 0x0c) >>> 0);
  if (m.u32(pPlayerUnit >>> 0) !== 0) {
    throw new D2CommonAssertError('0x6FD19FF9', 0x130);
  }
  const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, pPlayerUnit, pGame);
  if ((wPartyId & 0xffff) === 0xffff) return;
  const pSubParty = PARTY_FindSubPartyById_6FCBBD00_113c(m, pGame, wPartyId);
  if (pSubParty === 0) {
    throw new D2CommonAssertError('0x6FD19FF9', 0x138);
  }
  let pPrevMember = 0;
  let pCurMember = m.u32((pSubParty + 0x04) >>> 0);
  while (pCurMember !== 0 && m.u32(pCurMember >>> 0) !== dwPlayerGuid) {
    pPrevMember = pCurMember;
    pCurMember = m.u32((pCurMember + 0x04) >>> 0);
  }
  if (pCurMember !== 0) {
    if (pPrevMember !== 0) {
      m.setU32((pPrevMember + 0x04) >>> 0, m.u32((pCurMember + 0x04) >>> 0));
    } else {
      m.setU32((pSubParty + 0x04) >>> 0, m.u32((pCurMember + 0x04) >>> 0));
    }
    D2GAME_SUNIT_IterateAllLivingPlayers113c(
      m,
      pGame,
      PARTY_InitPlayerRelationOnJoinCallback_6FD10B10_113c,
      pPlayerUnit,
    );
    D2GAME_PACKET_SendPlayerPartyRelationship113c(m, pPlayerUnit, pPlayerUnit);
    void m.u32((pGame + 0x1c) >>> 0);
  }
  if (PARTY_CountSubPartyMembers_6FCBBF40_113c(m, pGame, wPartyId) <= 1) {
    PARTY_RemoveSubPartyById_6FCBC7D0_113c(m, pGame, wPartyId);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCC2EA0
 * @ordinalOrName SKILLS_SrvDo_Unsummon_6FCC2EA0
 */
export function SKILLS_SrvDo_Unsummon_6FCC2EA0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCC2EA0);
  const pUsedSkill = SKILLS_GetUsedSkill113c(m, pPlayerUnit);
  if (pUsedSkill === 0) return 0;
  const dwPetGuid = SKILLS_GetParam1113c(m, pUsedSkill);
  PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c(
    m,
    pGame,
    pPlayerUnit,
    dwPetGuid,
    1,
  );
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCC6E60
 * @ordinalOrName MONAI_DarkWandererThink_6FCC6E60
 */
export function MONAI_DarkWandererThink_6FCC6E60_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FCC6E60);
  const pAiControl = m.u32(pAiThinkArg >>> 0);
  const pTarget = m.u32((pAiThinkArg + 0x08) >>> 0);
  const nTargetDist = (m.u32((pAiThinkArg + 0x14) >>> 0) | 0);
  const pScratchCoords = (0x7fff0000 - 0x540) >>> 0;
  m.setU32(pScratchCoords, 0);
  m.setU32((pScratchCoords + 0x04) >>> 0, 0);
  if (
    ACT5Q3_FindAnyaTownSpawnPosition_6FD02780_113c(
      m,
      pGame,
      pUnit,
      pScratchCoords,
    ) === 0
  ) {
    AI_Stall113c(m, pGame, pUnit, 0x0a);
    return;
  }
  if ((m.u32((pAiControl + 0x14) >>> 0) | 0) === 0) {
    m.setU32((pAiControl + 0x14) >>> 0, 1);
    m.setU32((pAiControl + 0x18) >>> 0, 0);
    m.setU32((pAiControl + 0x1c) >>> 0, 0);
  }
  if (pTarget === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x0a);
    return;
  }
  if (nTargetDist >= 0x14) {
    AI_Stall113c(m, pGame, pUnit, 0x28);
    return;
  }
  const nAiState = (m.u32((pAiControl + 0x14) >>> 0) | 0);
  const nDestX = (m.u32(pScratchCoords) | 0);
  const nDestY = (m.u32((pScratchCoords + 0x04) >>> 0) | 0);
  if (nAiState === 1) {
    hitD2GameVa113c(0x6FD12540);
    AI_ApproachTarget113c(m, pGame, pUnit, 0, 2, nDestX, nDestY, 1, 0);
    m.setU32((pAiControl + 0x14) >>> 0, 2);
    return;
  }
  if (nAiState !== 2) {
    AI_Stall113c(m, pGame, pUnit, 0x28);
    return;
  }
  const nDist =
    UNITS_GetOctileDistanceToCoordinates113c(m, pUnit, nDestX, nDestY) >>> 0;
  const nRetryCount = (m.u32((pAiControl + 0x18) >>> 0) | 0);
  if (nDist >= 2 && nRetryCount < 3) {
    m.setU32((pAiControl + 0x18) >>> 0, (nRetryCount + 1) >>> 0);
    let pMonAiCtrl = 0;
    if (pUnit !== 0 && m.u32(pUnit >>> 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0);
      if (pMonData !== 0) pMonAiCtrl = m.u32((pMonData + 0x2c) >>> 0);
    }
    if (pMonAiCtrl !== 0) {
      m.setU32((pMonAiCtrl + 0x18) >>> 0, 7);
    }
    hitD2GameVa113c(0x6FD12540);
    AI_ApproachTarget113c(m, pGame, pUnit, 0, 2, nDestX, nDestY, 1, 0);
    return;
  }
  if (pUnit !== 0) {
    m.setU32(
      (pUnit + 0xc4) >>> 0,
      (m.u32((pUnit + 0xc4) >>> 0) | 0x20000) >>> 0,
    );
  }
  AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(m, pUnit, 0, pGame, 0, 0);
  ACT3Q0_ScheduleDarkWandererTimerOnPlayerSeen_6FD06760_113c(m, pGame, pUnit);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCC7530
 * @ordinalOrName MONAI_SiegeMinionThinkDispatch_6FCC7530
 */
export function MONAI_SiegeMinionThinkDispatch_6FCC7530_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FCC7530);
  const dwClassId = pUnit !== 0 ? (m.u32((pUnit + 0x04) >>> 0) | 0) : -1;
  if (dwClassId === 0x21c) {
    MONAI_SiegeMinionThinkC_6FCC62D0_113c(m, pAiThinkArg, pUnit, pGame);
  } else if (dwClassId === 0x21d) {
    MONAI_SiegeMinionThinkB_6FCC6050_113c(m, pAiThinkArg, pGame, pUnit);
  } else if (dwClassId === 0x21e) {
    MONAI_SiegeMinionThinkA_6FCC5EB0_113c(m, pAiThinkArg, pUnit, pGame);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCCDFA0
 * @ordinalOrName SKILLS_SrvDo_FindPotionOrConsumeBook_6FCCDFA0
 */
export function SKILLS_SrvDo_FindPotionOrConsumeBook_6FCCDFA0_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSpellId: number,
  _uUnused = 0,
): number {
  hitD2GameVa113c(0x6FCCDFA0);
  const pInventory = m.u32((pUnit + 0x60) >>> 0);
  if (pInventory === 0) return 0;
  let pNode = INVENTORY_GetFirstItem113c(m, pInventory);
  while (pNode !== 0) {
    const pItem = INVENTORY_UnitIsItem113c(m, pNode);
    let bMatched = false;
    if (ITEMS_CheckItemTypeId113c(m, pItem, 0x12) !== 0) {
      const wSuffix = ITEMS_GetMagicSuffix113c(m, pItem, 0) & 0xffff;
      const pQualRec = DATATBLS_GetQualityItemsTxtRecord113c(m, wSuffix);
      if (
        pQualRec !== 0 &&
        (m.u32((pQualRec + 0x0c) >>> 0) | 0) === (nSpellId | 0) &&
        STATLIST_GetUnitStat113c(m, pItem, 0x46, 0) > 0
      ) {
        bMatched = true;
      }
    } else if (ITEMS_CheckItemTypeId113c(m, pItem, 0x16) !== 0) {
      const wSuffix = ITEMS_GetMagicSuffix113c(m, pItem, 0) & 0xffff;
      const pQualRec = DATATBLS_GetQualityItemsTxtRecord113c(m, wSuffix);
      if (pQualRec !== 0 && (m.u32((pQualRec + 0x08) >>> 0) | 0) === (nSpellId | 0)) {
        bMatched = true;
      }
    }
    if (bMatched) {
      if (pNode === 0) return 0;
      const nNodePos = INVENTORY_GetItemNodePositionOther113c(m, pNode);
      const dwItemGuid = pItem !== 0 ? m.u32((pItem + 0x0c) >>> 0) : 0xffffffff;
      const pScratchOut = (0x7fff0000 - 0x550) >>> 0;
      m.setU32(pScratchOut, 0);
      if (nNodePos === 1) {
        const nY = UNIT_GetPosY113c(m, pItem);
        const nX = UNIT_GetPosX113c(m, pItem);
        ITEMS_UseInventoryItem_6FCF9BF0_113c(
          m,
          dwItemGuid,
          pGame,
          pUnit,
          nX,
          nY,
          pScratchOut,
        );
        return 1;
      }
      if (nNodePos === 2) {
        const nY = UNIT_GetPosY113c(m, pItem);
        const nX = UNIT_GetPosX113c(m, pItem);
        ITEMS_UseBeltItem_6FCF8BA0_113c(
          m,
          pScratchOut,
          dwItemGuid,
          pGame,
          pUnit,
          nX,
          nY,
          0,
        );
        return 1;
      }
      return 0;
    }
    pNode = INVENTORY_GetNextItem113c(m, pNode);
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCCE0E0
 * @ordinalOrName SKILLS_OnHitEffect_HitBlindsTarget_6FCCE0E0
 */
export function SKILLS_OnHitEffect_HitBlindsTarget_6FCCE0E0_113c(
  m: SparseMemory113c,
  pGame: number,
  nEventType: number,
  pAttacker: number,
  pDefender: number,
  _pDmg = 0,
  dwStatAndLayer = 0,
  _uUnused = 0,
): number {
  hitD2GameVa113c(0x6FCCE0E0);
  if (pAttacker === 0 || pDefender === 0 || m.u32(pDefender >>> 0) !== 1) {
    return 0;
  }
  const nBlindStat =
    ITEMS_B043_GetTotalStatFromUnitFast113c(
      m,
      pAttacker,
      dwStatAndLayer >>> 16,
      dwStatAndLayer & 0xffff,
    ) | 0;
  if (nBlindStat === 0) return 0;
  const nAttackerLvl = STATLIST_GetUnitStat113c(m, pAttacker, 0x0c, 0) | 0;
  const nDefenderLvl = STATLIST_GetUnitStat113c(m, pDefender, 0x0c, 0) | 0;
  let nChance =
    (((nAttackerLvl + (nBlindStat << 2) - nDefenderLvl + 6) | 0) * 5) | 0;
  if ((nEventType | 0) === 6 && nChance > 0) {
    nChance = Math.trunc(nChance / 3) | 0;
  }
  if (nChance <= 1) nChance = 1;
  else if (nChance >= 0x63) nChance = 0x63;
  const seed = {
    lo: m.u32((pAttacker + 0x20) >>> 0),
    hi: m.u32((pAttacker + 0x24) >>> 0),
  };
  const nRoll = seedRoll(seed, 0x64) | 0;
  m.setU32((pAttacker + 0x20) >>> 0, seed.lo >>> 0);
  m.setU32((pAttacker + 0x24) >>> 0, seed.hi >>> 0);
  if (nRoll >= nChance) return 0;
  let nSkillLevel = (Math.trunc(((nChance - nRoll) | 0) / 5) + 1) | 0;
  if (nSkillLevel <= 1) nSkillLevel = 1;
  else if (nSkillLevel >= 0x14) nSkillLevel = 0x14;
  SKILLS_ApplyDimVisionToTarget_6FC70470_113c(
    m,
    pGame,
    pAttacker,
    pDefender,
    nSkillLevel,
  );
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCCF450
 * @ordinalOrName SKILLS_SrvDo_BookOrScrollOfTownPortal_6FCCF450
 */
export function SKILLS_SrvDo_BookOrScrollOfTownPortal_6FCCF450_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  pScrollItem = 0,
  _uArg2 = 0,
  _uArg3 = 0,
  _uArg4 = 0,
  _uArg5 = 0,
): number {
  hitD2GameVa113c(0x6FCCF450);
  if (pUnit === 0 || m.u32(pUnit >>> 0) !== 0) return 0;
  m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0);
  const pRoom = UNITS_GetRoom113c(m, pUnit);
  const nRoomLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom);
  const bAct = DRLG_GetActNoFromLevelId113c(m, nRoomLevelId) & 0xff;
  const nTownLevelId = DUNGEON_GetActLevelId113c(m, bAct);
  if (
    DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0 ||
    DUNGEON_GetLevelIdFromRoom113c(m, pRoom) === 0x88
  ) {
    SUNIT_SetUnitEventSound113c(m, pUnit, 0x18, pUnit);
    return 0;
  }
  PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c(m, pUnit, pGame);
  const pScratchOutPortal = (0x7fff0000 - 0x560) >>> 0;
  m.setU32(pScratchOutPortal, 0);
  const nY = UNIT_GetPosY113c(m, pUnit);
  const nX = UNIT_GetPosX113c(m, pUnit);
  const bSpawned = PORTAL_SpawnLinkedPortalPair_6FCC24C0_113c(
    m,
    pUnit,
    pGame,
    pRoom,
    nX,
    nY,
    nTownLevelId,
    pScratchOutPortal,
    0x3b,
    0,
  );
  SUNIT_SetUnitEventSound113c(m, pUnit, 7, 0);
  if (bSpawned !== 0) {
    const pSourcePortal = m.u32(pScratchOutPortal);
    const dwPortalGuid =
      pSourcePortal !== 0 ? m.u32((pSourcePortal + 0x0c) >>> 0) : 0xffffffff;
    PLAYER_SetPlayerDataField48_6FC57480_113c(m, pUnit, dwPortalGuid);
    if (pSourcePortal !== 0) {
      const dwUnitGuid = m.u32((pUnit + 0x0c) >>> 0);
      OBJECTS_SetUnitField7CDword4_113c(m, pSourcePortal, dwUnitGuid);
      const pDestPortal = SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c(
        m,
        pGame,
        pSourcePortal,
      );
      if (pDestPortal !== 0) {
        OBJECTS_SetUnitField7CDword4_113c(m, pDestPortal, dwUnitGuid);
        ACT5Q5_OnArreatSummitPortalResetAncients_6FC7E3C0_113c(
          m,
          pDestPortal,
          pGame,
        );
      }
      ACT5Q5_OnArreatSummitPortalResetAncients_6FC7E3C0_113c(
        m,
        pSourcePortal,
        pGame,
      );
    }
  }
  if (pScrollItem !== 0) {
    const dwScrollGuid = m.u32((pScrollItem + 0x0c) >>> 0);
    const bScrollType = m.u32(pScrollItem >>> 0) & 0xff;
    if (m.u32(pUnit >>> 0) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pUnit);
      const pClient = m.u32((pPlayerData + 0x9c) >>> 0);
      S2C_QueueByteDwordPacket6_6FCAC3B0_113c(
        m,
        0x7c,
        bScrollType,
        dwScrollGuid,
        pClient,
      );
    } else {
      S2C_QueueByteDwordPacket6_6FCAC3B0_113c(
        m,
        0x7c,
        bScrollType,
        dwScrollGuid,
        0,
      );
    }
  }
  return bSpawned;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCCFCE0
 * @ordinalOrName MONSTER_SpawnAndEquipMonEquipRecordItem_6FCCFCE0
 */
export function MONSTER_SpawnAndEquipMonEquipRecordItem_6FCCFCE0_113c(
  m: SparseMemory113c,
  pMonsterUnit: number,
  pMonEquipRecord: number,
  pGame: number,
  nItemLevel: number,
  nQuality: number,
): void {
  hitD2GameVa113c(0x6FCCFCE0);
  if (pMonsterUnit === 0 || m.u32(pMonsterUnit >>> 0) !== 1) return;
  if (m.u32((pMonsterUnit + 0x60) >>> 0) === 0) {
    INVENTORY_AllocInventory113c(m, 0, pMonsterUnit);
  }
  const dwItemCode = m.u32(pMonEquipRecord >>> 0);
  const pScratchItemIdx = (0x7fff0000 - 0x570) >>> 0;
  m.setU32(pScratchItemIdx, 0);
  if (
    DATATBLS_GetItemsTxtRecordByCode113c(m, dwItemCode, pScratchItemIdx) === 0
  ) {
    return;
  }
  const nItemIdx = (m.u32(pScratchItemIdx) | 0);
  const pItem = ITEMS_SpawnItemWithParams_6FC31980_113c(
    m,
    nItemLevel,
    1,
    1,
    pMonsterUnit,
    nItemIdx,
    pGame,
    4,
    nQuality,
    0,
    0,
    0,
    {
      onCreateItemEx: (mem, pg, pDrop) => ITEMS_FinalizeCreatedItem113c(mem, pg, pDrop, 0),
    },
  );
  if (pItem === 0) return;
  ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x1000, 1);
  const bBodyLoc = m.u8((pMonEquipRecord + 0x04) >>> 0);
  ITEMS_SetBodyLocation113c(m, pItem, bBodyLoc);
  if (m.u8((pMonEquipRecord + 0x04) >>> 0) === 0) return;
  const dwItemGuid = m.u32((pItem + 0x0c) >>> 0);
  const pScratchReject = (0x7fff0000 - 0x578) >>> 0;
  m.setU32(pScratchReject, 0);
  const nEquipBodyLoc = ITEMS_GetBodyLocation113c(m, pItem) & 0xff;
  if (
    ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c(
      m,
      dwItemGuid,
      pMonsterUnit,
      pGame,
      nEquipBodyLoc,
      1,
      pScratchReject,
    ) === 0
  ) {
    SUNIT_FreeUnit113c(m, pGame, pItem);
    return;
  }
  const nMaxDur = ITEMS_B043_GetMaxDurabilityFromUnit113c(m, pItem);
  STATLIST_SetUnitStat113c(m, pItem, 0x48, nMaxDur, 0);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCD4410
 * @ordinalOrName SKILLS_SrvDo_SummonFallenShamanPack_6FCD4410
 */
export function SKILLS_SrvDo_SummonFallenShamanPack_6FCD4410_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD4410);
  const nSkill = nSkillId | 0;
  if (nSkill < 0) return 0;
  const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0);
  if (nSkill >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0;
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0);
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(nSkill, 0x23c)) >>> 0;
  if (pSkillsTxt === 0) return 0;
  const pScratchMode = (0x7fff0000 - 0x580) >>> 0;
  m.setU32(pScratchMode, 0);
  const nMonClassId =
    SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
      m,
      0,
      0,
      pScratchMode,
      pUnit,
      0,
      nSkill,
      nSkillLevel,
    ) | 0;
  if (nMonClassId < 0) return 0;
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
  const pPath = m.u32((pUnit + 0x2c) >>> 0);
  let pTarget = PATH_GetTargetUnit113c(m, pPath);
  if (pTarget === pUnit || pTarget === 0) {
    if (pPath === 0) return 0;
    if (PATH_GetFirstPointY113c(m, pPath) !== 2) return 0;
    const dwObjGuid = PATH_GetFirstPointX113c(m, pPath) >>> 0;
    if (pGame === 0) {
      throw new D2CommonAssertError('0x6FD19FF9', 0x2d3);
    }
    let pObj = m.u32((pGame + (dwObjGuid & 0x7f) * 4 + 0x1520) >>> 0);
    while (pObj !== 0 && m.u32((pObj + 0x0c) >>> 0) !== dwObjGuid) {
      pObj = m.u32((pObj + 0xe4) >>> 0);
    }
    if (pObj === 0) return 0;
    pTarget = pObj;
  }
  const pTargetRoom = UNITS_GetRoom113c(m, pTarget);
  if (pTargetRoom === 0 || DUNGEON_CheckRoomIsTownMemPort113c(m, pTargetRoom) !== 0) {
    return 0;
  }
  const pTargetRoom2 = UNITS_GetRoom113c(m, pTarget);
  MONSTER_SpawnFallenShamanPack_6FD0FB80_113c(
    m,
    pTarget,
    nMonClassId,
    pGame,
    pTargetRoom2,
    0,
    0,
    0,
  );
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCD5BD0
 * @ordinalOrName SKILLS_SrvDo_MonResurrectCorpse_6FCD5BD0
 */
export function SKILLS_SrvDo_MonResurrectCorpse_6FCD5BD0_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCD5BD0);
  const nSkill = nSkillId | 0;
  if (nSkill < 0) return 0;
  const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0);
  if (nSkill >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0;
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0);
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(nSkill, 0x23c)) >>> 0;
  if (pSkillsTxt === 0) return 0;
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
  const pPath = m.u32((pUnit + 0x2c) >>> 0);
  const pTarget = PATH_GetTargetUnit113c(m, pPath);
  if (pTarget === pUnit || pTarget === 0) return 0;
  m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0);
  if (MONSTERS_IsDead113c(m, pTarget) === 0) return 0;
  if (STATES_CheckStateMask2OnUnit113c(m, pTarget) !== 0) return 0;
  const nTargetX = UNIT_GetPosX113c(m, pTarget);
  const nTargetY = UNIT_GetPosY113c(m, pTarget);
  const dwTargetType = m.u32(pTarget >>> 0);
  const pTargetRoom = UNITS_GetRoom113c(m, pTarget);
  if (pTargetRoom === 0) return 0;
  const nCollPattern = PATH_GetUnitCollisionPattern113c(m, pTarget);
  const wCollMask = dwTargetType !== 0 ? 0x3c01 : 0x1c09;
  if (
    COLLISION_CheckMaskWithPattern2_113c(
      m,
      pTargetRoom,
      nTargetX,
      nTargetY,
      nCollPattern,
      wCollMask,
    ) !== 0
  ) {
    return 0;
  }
  PATH_SetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0), pTarget);
  MONSTER_ReactivateOrResurrectInRoom_6FCD33B0_113c(m, pGame, pTarget);
  if (m.u32(pTarget >>> 0) === 1) {
    const nResMode = AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c(
      m,
      pTarget,
      1,
    );
    const pModeStrc = (0x7fff0000 - 0x5c0) >>> 0;
    MONSTER_InitModeChangeStrc113c(m, pTarget, pModeStrc, nResMode);
    AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c(m, pTarget, 1);
    const pModeUnit = m.u32((pModeStrc + 0x04) >>> 0);
    const nReqMode = m.u32(pModeStrc) | 0;
    MONSTER_StartMode113c(
      m,
      pGame,
      pModeUnit,
      nReqMode,
      m.u32((pModeStrc + 0x08) >>> 0),
      m.u32((pModeStrc + 0x0c) >>> 0) | 0,
      m.u32((pModeStrc + 0x10) >>> 0) | 0,
    );
    if (
      (nResMode | 0) !== 0x0e &&
      pModeUnit !== 0 &&
      (m.u32((pModeUnit + 0x10) >>> 0) | 0) === nReqMode
    ) {
      SKILLS_SetUsedSkillMemPort113c(m, pModeUnit, 0);
    }
  }
  const nAuraState = (m.u16((pSkillsTxt + 0x4e) >>> 0) << 16) >> 16;
  if (nAuraState >= 0) {
    const pDataTables2 = m.u32(m.u32(0x6fd1829c) >>> 0);
    if (nAuraState < (m.u32((pDataTables2 + 0xbc0) >>> 0) | 0)) {
      STATES_SetMonsterSkillIconOnUnit113c(m, pTarget, nAuraState, 0);
    }
  }
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDA330
 * @ordinalOrName ACT4Q1_OnPlayerChangeLevel_6FCDA330
 */
export function ACT4Q1_OnPlayerChangeLevel_6FCDA330_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCDA330);
  const pPlayerUnit = m.u32((pQuestArg + 0x0c) >>> 0);
  const pGame = m.u32((pQuestData + 0x04) >>> 0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const bDiff = m.u8((pGame + 0x6d) >>> 0);
  const pQuestRecord = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x1b, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x1b, 0x0d) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x1b, 1) === 0 &&
    m.u8((pQuestData + 0x09) >>> 0) !== 0 &&
    m.u8((pQuestData + 0x0b) >>> 0) !== 0x0d &&
    m.u8((pQuestData + 0x0c) >>> 0) === 0
  ) {
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 1);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDA5E0
 * @ordinalOrName ACT4Q1_OnNpcMessage_6FCDA5E0
 */
export function ACT4Q1_OnNpcMessage_6FCDA5E0_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
  pfnQuestCallbackF0?: (m: SparseMemory113c, pQuestData: number) => void,
): void {
  hitD2GameVa113c(0x6FCDA5E0);
  const wMessageId = m.u16((pQuestArg + 0x14) >>> 0);
  const wScrollId = m.u16((pQuestArg + 0x18) >>> 0);
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0);
  const pGame = m.u32((pQuestData + 0x04) >>> 0);
  const pPlayerUnit = m.u32((pQuestArg + 0x0c) >>> 0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const bDiff = m.u8((pGame + 0x6d) >>> 0);
  const pQuestRecord = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0);
  if (wMessageId === 0x16f) {
    if (wScrollId === 0x29e) {
      m.setU8((pQuestExt + 0x11) >>> 0, 1);
      m.setU8((pQuestData + 0x0c) >>> 0, 2);
      if (m.u32(0x6fd31c20) !== 0) {
        const pScratchMsg = (0x7fff0000 - 0x660) >>> 0;
        const msg = 'changing state to 2\n';
        for (let i = 0; i < 0x100; i++) {
          m.setU8((pScratchMsg + i) >>> 0, i < msg.length ? msg.charCodeAt(i) : 0);
        }
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          pScratchMsg,
          m.u32((pQuestData + 0x04) >>> 0),
          4,
        );
      }
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuestData + 0x04) >>> 0),
        ACT4Q1_SyncPlayerQuest19State_6FCD96A0_113c,
        0,
        0,
      );
      QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
        m,
        m.u32((pQuestArg + 0x08) >>> 0),
        m.u32((pQuestArg + 0x0c) >>> 0),
        m.u32(pQuestArg >>> 0),
      );
      return;
    }
    if (wScrollId !== 0x2a4) return;
    if (
      DRLGWARP_TestRoomTileBit113c(
        m,
        pQuestRecord,
        m.u32((pQuestData + 0xe0) >>> 0),
        1,
      ) === 0
    ) {
      return;
    }
    if (
      DRLGWARP_TestRoomTileBit113c(
        m,
        pQuestRecord,
        m.u32((pQuestData + 0xe0) >>> 0),
        0x0d,
      ) !== 0
    ) {
      if (m.u8((pQuestData + 0x0c) >>> 0) !== 5) {
        QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(
          m,
          pQuestData,
          5,
        );
        const pfnF0 = m.u32((pQuestData + 0xf0) >>> 0) >>> 0;
        if (pfnF0 === 0 || m.u32(0x6fd18d14) === 1) {
          throw new D2CommonAssertError('0x6FD19FF9', 0xdf);
        }
        if (pfnQuestCallbackF0 !== undefined) {
          pfnQuestCallbackF0(m, pQuestData);
        } else if (pfnF0 === 0x6fcd8a70) {
          ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c(m, pQuestData);
        }
        m.setU8((pQuestData + 0x14) >>> 0, 0);
        m.setU8((pQuestData + 0x0b) >>> 0, 0x0d);
      }
      m.setU32((pQuestData + 0xa8) >>> 0, 0);
      QUESTS_SetGlobalQuestState_6FC53920_113c(
        m,
        m.u32(pQuestArg >>> 0),
        m.u32((pQuestData + 0xe0) >>> 0),
        0x0d,
      );
    }
    const nQuestId = m.u32((pQuestData + 0xe0) >>> 0);
    QUESTRECORD_SetQuestState113c(m, pQuestRecord, nQuestId, 0);
    QUESTRECORD_ClearQuestState113c(m, pQuestRecord, nQuestId, 1);
    QUESTRECORD_ClearQuestStateBits2To11_113c(m, pQuestRecord, nQuestId);
    STATLIST_AddUnitStat113c(m, m.u32((pQuestArg + 0x0c) >>> 0), 5, 2, 0);
    QUESTS_SendQuestItemState2_5D_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0),
      0x16,
    );
    const pPlayerUnit2 = m.u32((pQuestArg + 0x0c) >>> 0);
    const dwPlayerGuid =
      pPlayerUnit2 !== 0 ? m.u32((pPlayerUnit2 + 0x0c) >>> 0) : 0xffffffff;
    QUESTS_GuidListAdd113c(m, (pQuestData + 0x1c) >>> 0, dwPlayerGuid);
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((pQuestArg + 0x08) >>> 0),
      m.u32((pQuestArg + 0x0c) >>> 0),
      m.u32(pQuestArg >>> 0),
    );
    return;
  }
  if (wMessageId === 0x196 && wScrollId === 0x2a3) {
    m.setU8((pQuestExt + 0x12) >>> 0, 1);
    m.setU8((pQuestExt + 0x0f) >>> 0, 1);
    QUESTRECORD_SetQuestState113c(
      m,
      pQuestRecord,
      m.u32((pQuestData + 0xe0) >>> 0),
      5,
    );
    if (m.u8((pQuestData + 0x0b) >>> 0) !== 4) {
      m.setU8((pQuestData + 0x14) >>> 0, 0);
      m.setU8((pQuestData + 0x0b) >>> 0, 4);
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuestData + 0x04) >>> 0),
        ACT4Q1_SendQuestAlertIfEligible_6FCD9D20_113c,
        0,
        0,
      );
    }
  }
}
