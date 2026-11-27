/**
 * D2Game.dll 1.13c — [K2] Wave 10 Batch 1 (w10b1).
 *
 * Clean-room 1:1 binary-isomorphic port of 25 D2Game.dll v1.13c functions in
 * the 0x6FC441B0..0x6FD11130 address range.
 */

import { COLLISION_FindFreePositionSimple113c } from '../common/collision'
import { UNITS_GetPlayerData113c } from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import { PATH_WarpUnitToRoomAndCoord113c } from '../common/drlg/maze'
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordinates113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32 } from '../common/int-math'
import { INVENTORY_GetCursorItem113c } from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_CanItemBeRepairedByNpc113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_CheckEtherealFlag113c,
  ITEMS_GetComponentByte113c,
  ITEMS_GetRepairAllCost113c,
  ITEMS_GetTotalMaxStack113c,
  ITEMS_GetTransactionCost113c,
  ITEMS_GetTwoHandedFlag113c,
  ITEMS_HasUsedCharges113c,
} from '../common/items'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  ITEMS_CheckIfThrowItemMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports'
import {
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetUnit113c,
} from '../common/path'
import { QUESTRECORD_SetQuestState113c } from '../common/quest-record'
import {
  SKILLS_AddSkillToUnit113c,
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetPassiveState113c,
  SKILLS_GetSkillById113c,
  SKILLS_RefreshPassiveAuraSkills113c,
  SKILLS_SetSkillLevelOnUnit113c,
  SKILLS_SetSkillSlotIndex113c,
} from '../common/skills'
import {
  STATES_ApplyMonSkillIconToUnit113c,
  STATES_CheckStateMaskExpOnUnit113c,
  STATES_ClearGfxStateFlag113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_GetMaxDurabilityFromUnit113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStat113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNIT_Alloc113c,
  UNITROOM_RefreshUnit113c,
  UNITS_AllocStaticPath113c,
  UNITS_AreInAdjacentRooms113c,
  UNITS_GetRoom113c,
  UNITS_GetUnitSizeX113c,
  UNITS_SetUnitAnimMode113c,
} from '../common/unit'
import type { SparseMemory113c } from '../mem/sparse-memory'
import { SEED_InitLowSeed113c, SEED_InitSeed113c, seedRoll } from '../prng'
import {
  ACT1Q1_Callback03_LevelChanged113c,
  ACT2Q5_Callback03_LevelChanged113c,
  ACT4Q3_Callback03_LevelChanged113c,
} from './a1c-post150-f150-f276-113c'
import { SUNIT_AreUnitsHostileOrUnaligned113c } from './a1c-post150-f786-f1040-113c'
import { SUNIT_SetUnitEventSound113c } from './ai-fallen-113c'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c'
import { D2GAME_PARTY_EnsurePlayerRelationNode113c } from './boot-init-gap-b-113c'
import {
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
  SUNITDMG_GetPlayerClientClassId113c,
} from './combat-a1c-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import { PLRTRADE_IsInteractingWithValidPlayer113c } from './k2-combat-core-w1-113c'
import {
  ITEMS_RegisterItemEventCallback113c,
  UNITEVENT_RegisterTimerOrItemEventNode113c,
} from './k2-gap-itemdef-113c'
import {
  ITEMEVENT_RemoveByTypeAndState113c,
  NET_SendPacket0x3E_ItemStatBitStream113c,
  SKILLS_AssignHandSkillAndSyncAura113c,
  STATES_OnTimedStateRemoved113c,
} from './k2-gap-melee-dot-113c'
import { SUNIT_FindItemEventNode113c } from './k2-items-tc-w1-113c'
import {
  PLAYER_GetQuestRecordForDifficulty_6FC21020_113c,
  SKILLS_GetParam2Fast_6FC21BC0_113c,
} from './k2-laneH-0x6fc2-w1-113c'
import { ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c } from './k2-laneI-0x6fc3-w1-113c'
import {
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
  QUESTS_GetQuestData_6FC53F30_113c,
} from './k2-laneJ-0x6fc4-w1-113c'
import { SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c } from './k2-laneL-0x6fc6-w1-113c'
import {
  ACT5Q4_ActiveFilter_6FC76840_113c,
  ACT5Q4_Callback11_RemovePlayerGuid_6FC77A20_113c,
  ACT5Q4_StatusFilter_6FC768C0_113c,
} from './k2-laneM-0x6fc7-w1-113c'
import {
  PARTY_GetHostileCooldownTick113c,
  PARTY_TestPlayerRelationFlags113c,
} from './k2-sunit-spawn-w1-113c'
import {
  ACT5Q5_SyncPlayerQuest27State0EAlert23_6FC78F40_113c,
  QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c,
} from './k2-w2b1-113c'
import {
  NET_SendPacket07_RoomTileCoords_6FCABF50_113c,
  NET_SendPacket15B_TransactionResult_6FCAAC90_113c,
} from './k2-w2b3-113c'
import { SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c } from './k2-w2b5-113c'
import { ACT2Q3_Callback10_RemovePlayerAndDataExGuid_6FCE3970_113c } from './k2-w2b7-113c'
import {
  PLAYERLIST_SetHostileDelayTick_6FD10090_113c,
  SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c,
} from './k2-w2b8-113c'
import {
  ACT5Q3_SpawnAnyaThawProjectile_6FC7D960_113c,
  ACT5Q4_Callback00_NpcActivate_6FC77A60_113c,
} from './k2-w3b5-113c'
import {
  ACT1Q6_Callback00_NpcActivate_6FC80A80_113c,
  ACT1Q6_Callback13_RefreshQuestState_6FC808B0_113c,
  ACT5Q5_ActivateAncientStatueObjects_6FC7E660_113c,
} from './k2-w3b6-113c'
import {
  NET_SendEventMessagePacket5A_6FC90BF0_113c,
  OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c,
} from './k2-w3b7-113c'
import {
  ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c,
  MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c,
} from './k2-w4b2-113c'
import { NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c } from './k2-w4b5-113c'
import { SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c } from './k2-w4b6-113c'
import {
  PETS_BroadcastPetAssignPacketToAllPlayers_6FCB6D70_113c,
  PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c,
} from './k2-w5b2-113c'
import {
  ACT2Q3_ActiveFilter_6FCE2250_113c,
  ACT2Q3_Callback00_NpcActivate_6FCE37F0_113c,
  ACT2Q3_SeqFilter_6FCE21E0_113c,
  NPC_DeductPlayerGoldAndStash_6FCDCC60_113c,
  NPC_RefreshInventoryItemStatLists_6FCDCA20_113c,
} from './k2-w5b4-113c'
import { SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c } from './k2-w5b7-113c'
import {
  NET_SendPacket5A_PartyRelationEvent_6FD10720_113c,
  PARTY_BroadcastPacket8CRelationFlags_6FD105B0_113c,
  SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c,
} from './k2-w5b9-113c'
import {
  PETS_CleanupOrMarkDeadPetSlot_6FCB7420_113c,
  PETS_RemovePetFromSlotByGuid_6FCB7920_113c,
} from './k2-w6b2-113c'
import {
  ACT1Q6_Callback00_NpcActivateCain_6FC83190_113c,
  ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c,
  PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c,
} from './k2-w6b4-113c'
import { PARTY_ClearHostilityFlag08_6FD14210_113c } from './k2-w6b7-113c'
import {
  QUESTS_Act1AndarielOnDeath_6FC7B690_113c,
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c,
  QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c,
} from './k2-w7b1-113c'
import {
  PETS_FreePlayerPetTable_6FCB7640_113c,
  PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c,
} from './k2-w7b3-113c'
import {
  ACT1Q1_SequenceFilter_6FC85410_113c,
  ACT1Q6_NpcIntroAndRewardWarrivAndTownsfolk_6FC83F90_113c,
  ACT5Q4_OnAnyaNpcInteract_6FC7D520_113c,
  ACT5Q4_OnPlayerEnteredOrInitState_6FC7AE20_113c,
  QUESTS_DefaultSequenceFilter_6FC7AFB0_113c,
} from './k2-w8b1-113c'
import {
  ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c,
  ITEMS_UnequipMercBodyLocItemToPlayerCursor_6FCEECE0_113c,
  NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c,
} from './k2-w8b3-113c'
import { PARTY_DeclareHostilityBetweenPlayers_6FD10FF0_113c } from './k2-w8b4-113c'
import {
  ACT1Q6_OnAndarielKilled_6FC87E00_113c,
  ACT5Q4_Callback01_NpcDeactivate_6FC7B7A0_113c,
  ACT5Q5_CheckAndGrantAncientsRewardToPlayerAndParty_6FC7C100_113c,
  NPCS_RepairAndRechargePlayerItemWrapper_6FCDDE50_113c,
  PETS_ClampAllPlayerPetTypesToDefaultMax_6FCB6F40_113c,
  PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c,
  PETS_WarpOrUnsummonPlayerPets_6FCB7340_113c,
  PLAYERSAVE_SavePlayerCharacter_6FC74320_113c,
  QUESTS_ObjectEvent07_DispatchByClassId_6FC56C50_113c,
} from './k2-w9b1-113c'
import {
  ACT2Q3_Callback13_PlayerEnterSyncState_6FCE72C0_113c,
  ACT3Q1_AttachGoldenBirdBossMonster_6FD08200_113c,
  ITEMS_PickupGroundItemToInventoryOrEquip_6FCF6E30_113c,
  ITEMS_UseOrEquipCursorItemOnMerc_6FCF05B0_113c,
  PARTY_NotifySubPartyAndLeaveParty_6FD110F0_113c,
} from './k2-w9b2-113c'
import {
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events'
import { OBJECTS_InitObjectUnit113c } from './objects-populate-113c'
import {
  MONSTER_AddSkillToUnit113c,
  MONSTER_EquipMonEquipItems113c,
  ROOM_FindRoomContainingSubtile113c,
  SUNIT_InitUnitSeed113c,
  SUNIT_PlaceServerUnitInRoom113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import {
  CLIENTS_GetPlayerUnit113c,
  SUNIT_FreeUnit113c,
} from './replay-final11-113c'
import { EVENT_SetEventFull113c } from './timer-wheel'
import {
  ACT1Q5_CheckCharsiImbueNpcAlert113c,
  SUNIT_UpdateUnitPositionAndRoom113c,
} from './town-runtime-gap-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

function i32(m: SparseMemory113c, addr: number): number {
  return m.u32(addr >>> 0) | 0
}

const MON_AURA_TABLE_6FD2E4A0: readonly number[] = [
  0, 0, 1, 6, 98,
  0, 0, 1, 6, 102,
  0, 0, 1, 5, 108,
  0, 0, 1, 7, 114,
  0, 0, 1, 8, 123,
  0, 0, 1, 8, 122,
  20, 0, 1, 8, 118,
  999, 0, 0, 1, 103,
]

function ensureMonAuraTable6FD2E4A0(m: SparseMemory113c): void {
  if (i32(m, 0x6fd2e4ac) === 0) {
    for (let i = 0; i < MON_AURA_TABLE_6FD2E4A0.length; i += 1) {
      m.setU32((0x6fd2e4a0 + i * 4) >>> 0, MON_AURA_TABLE_6FD2E4A0[i] >>> 0)
    }
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC441B0
 * @ordinalOrName D2Game_6FC441B0
 */
export function MONSTER_AssignTeleportSkill_6FC441B0_113c(
  m: SparseMemory113c,
  pMonsterUnit: number,
  pArg: number,
): void {
  hitD2GameVa113c(0x6FC441B0)
  const esi = pMonsterUnit >>> 0
  if (esi === 0 || m.u32(esi) !== 1 || pArg === 0) {
    return
  }
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables !== 0 && i32(m, (pDataTables + 0xba0) >>> 0) > 0xb8) {
    SKILLS_SetSkillLevelOnUnit113c(m, esi, 0xb8, 1, 1, 0x6fd1b980, 0x112a)
    SKILLS_RefreshPassiveAuraSkills113c(m, esi)
    if (m.u32(esi) === 0) {
      PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(
        m,
        m.u32((esi + 0x80) >>> 0),
        esi,
      )
    }
  }
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, esi, 0xb8)
  SKILLS_SetSkillSlotIndex113c(m, pSkill, 4)
  if (m.u32(esi) === 1) {
    const pMonData = m.u32((esi + 0x14) >>> 0)
    if (pMonData !== 0) {
      const pAiGeneral = m.u32((pMonData + 0x28) >>> 0)
      m.setU8((pAiGeneral + 0x8) >>> 0, (m.u8((pAiGeneral + 0x8) >>> 0) | 0x20) & 0xff)
      return
    }
  }
  m.setU8(0x8, (m.u8(0x8) | 0x20) & 0xff)
}

/**
 * @dll D2Game.dll
 * @va 0x6FC44CD0
 * @ordinalOrName D2Game_6FC44CD0
 */
export function MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c(
  m: SparseMemory113c,
  pMonsterUnit: number,
  pArg: number,
): void {
  hitD2GameVa113c(0x6FC44CD0)
  const esi = pMonsterUnit >>> 0
  if (esi === 0 || m.u32(esi) !== 1 || pArg === 0) {
    return
  }
  let ebp = STATLIST_GetUnitStat113c(m, esi, 0xc, 0) | 0
  if (ebp <= 0) {
    ebp = 1
  }
  ensureMonAuraTable6FD2E4A0(m)
  let edi = 0
  if (i32(m, 0x6fd2e4a0) <= ebp) edi = 1
  if (i32(m, 0x6fd2e4b4) <= ebp) edi = (edi + 1) | 0
  if (i32(m, 0x6fd2e4c8) <= ebp) edi = (edi + 1) | 0
  if (i32(m, 0x6fd2e4dc) <= ebp) edi = (edi + 1) | 0
  if (i32(m, 0x6fd2e4f0) <= ebp) edi = (edi + 1) | 0
  if (i32(m, 0x6fd2e504) <= ebp) edi = (edi + 1) | 0
  if (i32(m, 0x6fd2e518) <= ebp) edi = (edi + 1) | 0
  if (i32(m, 0x6fd2e52c) <= ebp) edi = (edi + 1) | 0
  if (edi === 0) {
    edi = 1
  }
  let bx = 0x1506
  if (m.u32(esi) === 1) {
    const pMonData = m.u32((esi + 0x14) >>> 0)
    if (pMonData !== 0) {
      bx = m.u16((pMonData + 0x14) >>> 0)
    }
  }
  const pTempSeed = 0x004000f0
  const savedLo = m.u32(pTempSeed)
  const savedHi = m.u32((pTempSeed + 4) >>> 0)
  SEED_InitSeed113c(m, pTempSeed)
  SEED_InitLowSeed113c(m, pTempSeed, bx & 0xffff)
  const seedObj = { lo: m.u32(pTempSeed), hi: m.u32((pTempSeed + 4) >>> 0) }
  let eax = seedRoll(seedObj, edi) | 0
  m.setU32(pTempSeed, savedLo)
  m.setU32((pTempSeed + 4) >>> 0, savedHi)

  if (m.u32(esi) === 1) {
    const pMonData = m.u32((esi + 0x14) >>> 0)
    if (pMonData !== 0 && m.u16((pMonData + 0x26) >>> 0) === 0x25) {
      eax = 5
    }
  }
  if (m.u32((esi + 0x4) >>> 0) === 0x2c0) {
    const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables !== 0 && i32(m, (pDataTables + 0xba0) >>> 0) > 0x7b) {
      SKILLS_SetSkillLevelOnUnit113c(m, esi, 0x7b, 0x14, 1, 0x6fd1b980, 0x112a)
      SKILLS_RefreshPassiveAuraSkills113c(m, esi)
      if (m.u32(esi) === 0) {
        PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(
          m,
          m.u32((esi + 0x80) >>> 0),
          esi,
        )
      }
    }
    SKILLS_AssignHandSkillAndSyncAura113c(m, esi, 0, 0x7b, 0xffffffff)
    return
  }
  const offset = (eax * 20) >>> 0
  const nAdd = i32(m, (0x6fd2e4a4 + offset) >>> 0)
  const nMul = i32(m, (0x6fd2e4a8 + offset) >>> 0)
  const nDiv = i32(m, (0x6fd2e4ac + offset) >>> 0)
  let nLvl = Math.trunc(imul32((nAdd + ebp) | 0, nMul) / nDiv) | 0
  if (nLvl <= 1) {
    nLvl = 1
  } else if (nLvl >= 0x63) {
    nLvl = 0x63
  }
  const nSkillId = i32(m, (0x6fd2e4b0 + offset) >>> 0)
  MONSTER_AddSkillToUnit113c(m, nLvl, nSkillId, esi, 1)
  const nSkillId2 = i32(m, (0x6fd2e4b0 + offset) >>> 0)
  SKILLS_AssignHandSkillAndSyncAura113c(m, esi, 0, nSkillId2, 0xffffffff)
}

/**
 * @dll D2Game.dll
 * @va 0x6FC47190
 * @ordinalOrName D2Game_6FC47190
 */
export function STATES_OnSkillStateRemovedRefreshAnim_6FC47190_113c(
  m: SparseMemory113c,
  pUnit: number,
  nState: number,
  _pStatList = 0,
): void {
  hitD2GameVa113c(0x6FC47190)
  const edi = pUnit >>> 0
  const esi = nState | 0
  if (edi === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xa2a)
  }
  const pGame = m.u32((edi + 0x80) >>> 0)
  ITEMEVENT_RemoveByTypeAndState113c(m, edi, pGame, 1, esi)
  const bFlag = m.u8((edi + 0xc6) >>> 0) & 1
  let checkExpMask = true
  if (bFlag === 0) {
    const dwType = m.u32(edi)
    if (dwType === 0) {
      const dwMode = m.u32((edi + 0x10) >>> 0)
      if (dwMode !== 0 && dwMode !== 0x11) {
        checkExpMask = false
      }
    } else if (dwType === 1) {
      const dwMode = m.u32((edi + 0x10) >>> 0)
      if (dwMode !== 0 && dwMode !== 0xc) {
        checkExpMask = false
      }
    }
  }
  if (checkExpMask && STATES_CheckStateMaskExpOnUnit113c(m, edi, esi) !== 0) {
    return
  }
  STATES_ToggleGfxStateFlag113c(m, edi, esi, 0)
  UNITS_SetUnitAnimMode113c(m, edi, 0x6fd1cdd8, 0x387)
  SKILLS_RefreshPassiveAuraSkills113c(m, edi)
  if (m.u32(edi) === 0) {
    PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(
      m,
      m.u32((edi + 0x80) >>> 0),
      edi,
    )
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC49240
 * @ordinalOrName D2Game_6FC49240
 */
export function SKILLS_ApplyTimedSkillAuraToTarget_6FC49240_113c(
  m: SparseMemory113c,
  pTargetUnit: number,
  pGame: number,
  pCasterUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC49240)
  const eax = nSkillId | 0
  if (eax < 0) {
    return 0
  }
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0 || eax >= i32(m, (pDataTables + 0xba0) >>> 0)) {
    return 0
  }
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0)
  const esi = (pSkillsTxtBase + imul32(eax, 0x23c)) >>> 0
  if (esi === 0) {
    return 0
  }
  const nAuraState = (m.u16((esi + 0x80) >>> 0) << 16) >> 16
  if (nAuraState < 0 || nAuraState >= i32(m, (pDataTables + 0xc4) >>> 0)) {
    return 0
  }
  const dwAuraLenCalc = m.u32((esi + 0x60) >>> 0)
  const nDuration = SKILLS_EvalCalcByOffset113c(
    m,
    pCasterUnit >>> 0,
    dwAuraLenCalc,
    eax,
    nSkillLevel | 0,
  )
  const nExpireFrame = (nDuration + m.u32(((pGame >>> 0) + 0xa8) >>> 0)) >>> 0
  const ebx = pTargetUnit >>> 0
  let edi = STATLIST_GetStatListFromUnitAndStateMemPort113c(
    m,
    ebx,
    (m.u16((esi + 0x80) >>> 0) << 16) >> 16,
  )
  if (edi === 0) {
    let ownerType = 6
    let ownerId = 0xffffffff
    if ((pCasterUnit >>> 0) !== 0) {
      ownerId = m.u32(((pCasterUnit >>> 0) + 0xc) >>> 0)
      ownerType = m.u32(pCasterUnit >>> 0)
    }
    edi = STATLIST_AllocList113c(m, 2, ownerType, ownerId, 0, nExpireFrame)
    if (edi === 0) {
      return 0
    }
    const st0 = (m.u16((esi + 0x80) >>> 0) << 16) >> 16
    STATLIST_SetState113c(m, edi, st0)
    STATLIST_SetStatRemoveProc113c(m, edi, 0x6fcbf7a0)
    STATLIST_MergeStatLists113c(m, ebx, edi, 1)
    STATES_ToggleGfxStateFlag113c(m, ebx, (m.u16((esi + 0x80) >>> 0) << 16) >> 16, 1)
  }
  STATES_ClearGfxStateFlag113c(m, ebx, (m.u16((esi + 0x80) >>> 0) << 16) >> 16, 1)
  STATLIST_SetExpireFrameEx113c(m, edi, nExpireFrame)
  EVENT_SetEventFull113c(m, pGame >>> 0, ebx, 0xc, nExpireFrame, 0, 0, 0)
  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(
    m,
    esi,
    pCasterUnit >>> 0,
    edi,
    eax,
    nSkillLevel | 0,
  )
  SKILLS_RefreshPassiveAuraSkills113c(m, ebx)
  if (ebx !== 0 && m.u32(ebx) === 0) {
    PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(
      m,
      m.u32((ebx + 0x80) >>> 0),
      ebx,
    )
  }
  return 1
}

/**
 * @dll D2Game.dll
 * @va 0x6FC4C830
 * @ordinalOrName D2Game_6FC4C830
 */
export function PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c(
  m: SparseMemory113c,
  pGame: number,
  onCallback28?: (
    m: SparseMemory113c,
    szCharName: number,
    dwClassId: number,
    dwLevel: number,
    dwExp: number,
    nZero: number,
    wClientFlag0A: number,
    szAccountName: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FC4C830)
  const game = pGame >>> 0
  let edi = m.u32((game + 0x88) >>> 0)
  while (edi !== 0) {
    const pNextClient = m.u32((edi + 0x4a8) >>> 0)
    let esi = 0
    if ((m.u8((edi + 0x3d4) >>> 0) & 1) !== 0) {
      esi = m.u32((edi + 0x174) >>> 0)
    } else {
      const pCachedUnit = m.u32((edi + 0x174) >>> 0)
      if (pCachedUnit !== 0) {
        const pFound = SUNIT_GetServerUnit113c(
          m,
          m.u32((edi + 0x1a8) >>> 0),
          m.u32((edi + 0x16c) >>> 0),
          m.u32((edi + 0x170) >>> 0),
        )
        if (pFound === 0) {
          m.setU32((edi + 0x174) >>> 0, 0)
        }
        esi = pFound >>> 0
      }
    }
    if (esi !== 0) {
      const ebp = (edi + 0xd) >>> 0
      PLAYERSAVE_SavePlayerCharacter_6FC74320_113c(m, game, esi, ebp, 0)
      const pCallbackTbl = m.u32(0x6fd31c3c) >>> 0
      if (
        pCallbackTbl !== 0 &&
        m.u32((pCallbackTbl + 0x28) >>> 0) !== 0 &&
        m.u32((game + 0x74) >>> 0) !== 0
      ) {
        const wFlag0A = m.u16((edi + 0xa) >>> 0)
        const dwClassId = m.u32((esi + 0x4) >>> 0)
        const pAcctName = (edi + 0x190) >>> 0
        const dwExp = STATLIST_GetUnitBaseStat113c(m, esi, 0xd, 0)
        const dwLevel = STATLIST_GetUnitBaseStat113c(m, esi, 0xc, 0)
        if (onCallback28 !== undefined) {
          onCallback28(m, ebp, dwClassId, dwLevel, dwExp, 0, wFlag0A, pAcctName)
        }
      }
    }
    edi = pNextClient >>> 0
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC4C910
 * @ordinalOrName D2Game_6FC4C910
 */
export function PLAYERSAVE_SaveClientAndAllOtherPlayers_6FC4C910_113c(
  m: SparseMemory113c,
  pClient: number,
  pGame: number,
  onCallback28?: (
    m: SparseMemory113c,
    szCharName: number,
    dwClassId: number,
    dwLevel: number,
    dwExp: number,
    nZero: number,
    wClientFlag0A: number,
    szAccountName: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FC4C910)
  const client = pClient >>> 0
  if (client === 0) {
    return
  }
  const pPrimaryPlayer = CLIENTS_GetPlayerUnit113c(m, client, 0) >>> 0
  if (pPrimaryPlayer === 0) {
    return
  }
  const game = pGame >>> 0
  const savedOk = PLAYERSAVE_SavePlayerCharacter_6FC74320_113c(
    m,
    game,
    pPrimaryPlayer,
    (client + 0xd) >>> 0,
    1,
  )
  if (savedOk === 0) {
    return
  }
  let edi = m.u32((game + 0x88) >>> 0)
  while (edi !== 0) {
    const pNextClient = m.u32((edi + 0x4a8) >>> 0)
    let esi = 0
    if ((m.u8((edi + 0x3d4) >>> 0) & 1) !== 0) {
      esi = m.u32((edi + 0x174) >>> 0)
    } else {
      const pCachedUnit = m.u32((edi + 0x174) >>> 0)
      if (pCachedUnit !== 0) {
        const pFound = SUNIT_GetServerUnit113c(
          m,
          m.u32((edi + 0x1a8) >>> 0),
          m.u32((edi + 0x16c) >>> 0),
          m.u32((edi + 0x170) >>> 0),
        )
        if (pFound === 0) {
          m.setU32((edi + 0x174) >>> 0, 0)
        }
        esi = pFound >>> 0
      }
    }
    if (esi !== 0) {
      if (edi !== client) {
        PLAYERSAVE_SavePlayerCharacter_6FC74320_113c(
          m,
          game,
          esi,
          (edi + 0xd) >>> 0,
          0,
        )
      }
      const pCallbackTbl = m.u32(0x6fd31c3c) >>> 0
      if (
        pCallbackTbl !== 0 &&
        m.u32((pCallbackTbl + 0x28) >>> 0) !== 0 &&
        m.u32((game + 0x74) >>> 0) !== 0
      ) {
        const wFlag0A = m.u16((edi + 0xa) >>> 0)
        const dwClassId = m.u32((esi + 0x4) >>> 0)
        const pAcctName = (edi + 0x190) >>> 0
        const dwExp = STATLIST_GetUnitBaseStat113c(m, esi, 0xd, 0)
        const dwLevel = STATLIST_GetUnitBaseStat113c(m, esi, 0xc, 0)
        if (onCallback28 !== undefined) {
          onCallback28(
            m,
            (edi + 0xd) >>> 0,
            dwClassId,
            dwLevel,
            dwExp,
            0,
            wFlag0A,
            pAcctName,
          )
        }
      }
    }
    edi = pNextClient >>> 0
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC56140
 * @ordinalOrName D2Game_6FC56140
 */
export function QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c(
  m: SparseMemory113c,
  pMonsterUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC56140)
  const esi = pMonsterUnit >>> 0
  const pRoom = UNITS_GetRoom113c(m, esi)
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const bAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (bAct !== 2) {
    return
  }
  let ebx = 0
  const pQuestControl = m.u32(((pGame >>> 0) + 0x10f4) >>> 0)
  if (pQuestControl !== 0) {
    let pQuest = m.u32(pQuestControl) >>> 0
    while (pQuest !== 0) {
      if (m.u32(pQuest) === 0x12) {
        ebx = pQuest
        break
      }
      pQuest = m.u32((pQuest + 0xf4) >>> 0)
    }
  }
  if (esi === 0) {
    return
  }
  const ecx = i32(m, (esi + 0x4) >>> 0)
  if (ecx < 0) {
    return
  }
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0 || ecx >= i32(m, (pDataTables + 0xa80) >>> 0)) {
    return
  }
  const pMonStatsTxtBase = m.u32((pDataTables + 0xa78) >>> 0)
  const pMonStatsTxt = (pMonStatsTxtBase + imul32(ecx, 0x1a8)) >>> 0
  if (pMonStatsTxt === 0 || ebx === 0) {
    return
  }
  if (m.u8((ebx + 0x9) >>> 0) !== 1 || ecx === 0x197) {
    return
  }
  const pBitMasks = m.u32(0x6fd18be0) >>> 0
  const bMonFlag0D = m.u8((pMonStatsTxt + 0xd) >>> 0)
  const bMask18 = pBitMasks !== 0 ? m.u8((pBitMasks + 0x18) >>> 0) : 0x40
  if ((bMask18 & bMonFlag0D) !== 0) {
    return
  }
  ACT3Q1_AttachGoldenBirdBossMonster_6FD08200_113c(m, ebx, esi)
}

/**
 * @dll D2Game.dll
 * @va 0x6FC622B0
 * @ordinalOrName D2Game_6FC622B0
 */
export function STATES_OnBuffStateRemovedRefreshAnim_6FC622B0_113c(
  m: SparseMemory113c,
  pUnit: number,
  nState: number,
  _pStatList = 0,
): void {
  hitD2GameVa113c(0x6FC622B0)
  const edi = pUnit >>> 0
  const esi = nState | 0
  if (edi === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xa2a)
  }
  const pGame = m.u32((edi + 0x80) >>> 0)
  ITEMEVENT_RemoveByTypeAndState113c(m, edi, pGame, 1, esi)
  const bFlag = m.u8((edi + 0xc6) >>> 0) & 1
  let checkExpMask = true
  if (bFlag === 0) {
    const dwType = m.u32(edi)
    if (dwType === 0) {
      const dwMode = m.u32((edi + 0x10) >>> 0)
      if (dwMode !== 0 && dwMode !== 0x11) {
        checkExpMask = false
      }
    } else if (dwType === 1) {
      const dwMode = m.u32((edi + 0x10) >>> 0)
      if (dwMode !== 0 && dwMode !== 0xc) {
        checkExpMask = false
      }
    }
  }
  if (checkExpMask && STATES_CheckStateMaskExpOnUnit113c(m, edi, esi) !== 0) {
    return
  }
  STATES_ToggleGfxStateFlag113c(m, edi, esi, 0)
  UNITS_SetUnitAnimMode113c(m, edi, 0x6fd1c428, 0x1a9)
  SKILLS_RefreshPassiveAuraSkills113c(m, edi)
  if (m.u32(edi) === 0) {
    PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(
      m,
      m.u32((edi + 0x80) >>> 0),
      edi,
    )
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC631C0
 * @ordinalOrName D2Game_6FC631C0
 */
export function SKILLS_SrvDo_Telekinesis_6FC631C0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC631C0)
  const edi = pGame >>> 0
  const esi = pPlayerUnit >>> 0
  const ebx = nSkillId | 0
  if (ebx < 0) {
    return 0
  }
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0 || ebx >= i32(m, (pDataTables + 0xba0) >>> 0)) {
    return 0
  }
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(ebx, 0x23c)) >>> 0
  if (
    pSkillsTxt === 0 ||
    esi === 0 ||
    m.u32(esi) !== 0 ||
    m.u8((esi + 0x6c) >>> 0) !== 0
  ) {
    return 0
  }
  if (INVENTORY_GetCursorItem113c(m, m.u32((esi + 0x60) >>> 0)) !== 0) {
    return 0
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, esi)
  if (m.u32((pPlayerData + 0x4c) >>> 0) !== 0) {
    return 0
  }
  SUNIT_ValidatePathTargetUnit113c(m, esi, edi)
  const ebp = PATH_GetTargetUnit113c(m, m.u32((esi + 0x2c) >>> 0)) >>> 0
  if (ebp === esi || ebp === 0) {
    return 0
  }
  m.setU32((esi + 0xc4) >>> 0, (m.u32((esi + 0xc4) >>> 0) | 0x40) >>> 0)
  const targetType = m.u32(ebp) >>> 0
  if (targetType === 0 || targetType === 1) {
    if (SUNIT_AreUnitsHostileOrUnaligned113c(m, ebp, esi, edi) === 0) {
      return 0
    }
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, UNITS_GetRoom113c(m, ebp)) !== 0) {
      return 0
    }
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, UNITS_GetRoom113c(m, esi)) !== 0) {
      return 0
    }
    const unitSeed = {
      lo: m.u32((esi + 0x20) >>> 0),
      hi: m.u32((esi + 0x24) >>> 0),
    }
    const nRoll = seedRoll(unitSeed, 0x64) | 0
    m.setU32((esi + 0x20) >>> 0, unitSeed.lo >>> 0)
    m.setU32((esi + 0x24) >>> 0, unitSeed.hi >>> 0)
    const nParam2 = SKILLS_GetParam2Fast_6FC21BC0_113c(m, ebx) | 0
    const bKnockback = nRoll < nParam2 ? 1 : 0
    const pDmg = 0x00400100
    for (let i = 0; i < 0x1c; i += 1) {
      m.setU32((pDmg + i * 4) >>> 0, 0)
    }
    SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c(m, esi, ebx, pDmg, nSkillLevel | 0)
    SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, ebx, esi, pDmg, nSkillLevel | 0)
    const wResFlags = m.u16((pSkillsTxt + 0x12e) >>> 0)
    const dwHitFlags = m.u32((pSkillsTxt + 0x130) >>> 0)
    const dwHitClass = m.u32((pSkillsTxt + 0x134) >>> 0)
    m.setU16((pDmg + 0x4) >>> 0, (m.u16((pDmg + 0x4) >>> 0) | wResFlags) & 0xffff)
    m.setU32(pDmg, (m.u32(pDmg) | dwHitFlags) >>> 0)
    if (dwHitClass !== 0) {
      m.setU32((pDmg + 0x60) >>> 0, dwHitClass >>> 0)
    }
    if (bKnockback !== 0) {
      m.setU8((pDmg + 0x4) >>> 0, (m.u8((pDmg + 0x4) >>> 0) | 0x9) & 0xff)
    }
    SUNITDMG_ApplyDamage113c(m, edi, esi, ebp, pDmg)
    SUNITDMG_ApplySideEffectsAndKill113c(m, edi, esi, ebp, pDmg)
    return 1
  }
  if (targetType === 4) {
    if (
      ITEMS_CheckItemTypeIdMemPort113c(m, ebp, 0x16) !== 0 ||
      ITEMS_CheckItemTypeIdMemPort113c(m, ebp, 0x04) !== 0 ||
      ITEMS_CheckItemTypeIdMemPort113c(m, ebp, 0x26) !== 0 ||
      ITEMS_CheckItemTypeIdMemPort113c(m, ebp, 0x38) !== 0 ||
      ITEMS_CheckItemTypeIdMemPort113c(m, ebp, 0x09) !== 0 ||
      ITEMS_CheckItemTypeIdMemPort113c(m, ebp, 0x29) !== 0
    ) {
      const pOutErr = 0x004000f8
      ITEMS_PickupGroundItemToInventoryOrEquip_6FCF6E30_113c(
        m,
        m.u32((ebp + 0xc) >>> 0),
        edi,
        esi,
        pOutErr,
      )
      return 1
    }
    SUNIT_SetUnitEventSound113c(m, esi, 0x13, esi)
    return 1
  }
  if (targetType === 2) {
    const pOutFlag = 0x004000fc
    OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c(
      m,
      pOutFlag,
      m.u32((ebp + 0xc) >>> 0),
      edi,
      esi,
      targetType,
    )
    return 1
  }
  return 1
}

const ITEM_EVENT_TBL_6FD277A8: readonly [number, number][] = [
  [1, 0x6fc634e0], [2, 0x6fc62c70], [3, 0x6fc62b40], [4, 0x6fc6f090],
  [5, 0x6fc6e760], [6, 0x6fccd910], [7, 0x6fccce60], [8, 0x6fccf2e0],
  [9, 0x6fcce0e0], [10, 0x6fccd860], [11, 0x6fccd7b0], [12, 0x6fccd6c0],
  [13, 0x6fcccda0], [14, 0x6fccd580], [15, 0x6fccd410], [16, 0x6fcccc30],
  [17, 0x6fcccba0], [18, 0x6fccca70], [19, 0x6fccd2a0], [20, 0x6fccddc0],
  [21, 0x6fccdce0], [22, 0x6fc6dfe0], [23, 0x6fc6e5f0], [24, 0x6fc61fb0],
  [25, 0x6fc64600], [26, 0x6fc6e500], [27, 0x6fc6ef70], [28, 0x6fcccb10],
  [29, 0x6fccc910], [30, 0x6fccdbf0], [31, 0x6fccf210],
]

const MON_UMOD_TBL_6FD2E550: readonly [number, number][] = [
  [1, 0x6fc43020], [2, 0x6fc42fa0], [4, 0x6fc41e80], [5, 0x6fc42bc0],
  [6, 0x6fc42880], [8, 0x6fc41be0], [9, 0x6fc42740], [16, 0x6fc42da0],
  [17, 0x6fc42600], [18, 0x6fc42490], [23, 0x6fc42320], [25, 0x6fc421d0],
  [26, 0x6fc441b0], [27, 0x6fc41be0], [28, 0x6fc41be0], [30, 0x6fc44cd0],
  [36, 0x6fc43850], [37, 0x6fc43810], [38, 0x6fc437c0], [39, 0x6fc42d00],
  [41, 0x6fc469f0],
]

function ensureTablesForSummon6FC6F970(m: SparseMemory113c): void {
  if (m.u32(0x6fd277ac) === 0) {
    for (const [idx, va] of ITEM_EVENT_TBL_6FD277A8) {
      m.setU32((0x6fd277a8 + idx * 4) >>> 0, va >>> 0)
    }
  }
  if (m.u32(0x6fd2e554) === 0) {
    for (const [idx, va] of MON_UMOD_TBL_6FD2E550) {
      m.setU32((0x6fd2e550 + idx * 4) >>> 0, va >>> 0)
    }
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC6F970
 * @ordinalOrName D2Game_6FC6F970
 */
export function SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c(
  m: SparseMemory113c,
  pGame: number,
  pOwnerUnit: number,
  pPetUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  nItemLevel: number,
  onDispatchMonUMod?: (
    m: SparseMemory113c,
    pfnVa: number,
    pPetUnit: number,
    nUModId: number,
    nArg: number,
  ) => void,
): number {
  hitD2GameVa113c(0x6FC6F970)
  const edx = nSkillId | 0
  const ebp = pPetUnit >>> 0
  let pSkillsTxt = 0
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (edx >= 0 && pDataTables !== 0 && edx < i32(m, (pDataTables + 0xba0) >>> 0)) {
    pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(edx, 0x23c)) >>> 0
  }
  if (edx === 0 || pSkillsTxt === 0) {
    return 0
  }
  ensureTablesForSummon6FC6F970(m)
  const game = pGame >>> 0
  const owner = pOwnerUnit >>> 0
  const skillLvl = nSkillLevel | 0

  for (let i = 0; i < 5; i += 1) {
    const nStatId = (m.u16((pSkillsTxt + 0x98 + i * 2) >>> 0) << 16) >> 16
    if (
      nStatId >= 0 &&
      pDataTables !== 0 &&
      nStatId < i32(m, (pDataTables + 0xbd4) >>> 0)
    ) {
      const pItemStatCost =
        (m.u32((pDataTables + 0xbcc) >>> 0) + imul32(nStatId, 0x144)) >>> 0
      if (pItemStatCost !== 0) {
        const dwCalc = m.u32((pSkillsTxt + 0xa4 + i * 4) >>> 0)
        const nVal = SKILLS_EvalCalcByOffset113c(m, owner, dwCalc, edx, skillLvl)
        STATLIST_AddUnitStatMemPort113c(m, ebp, nStatId, nVal, 0)
        const wItemEvent1 = (m.u16((pItemStatCost + 0x48) >>> 0) << 16) >> 16
        if (wItemEvent1 > 0) {
          const dwPetGuid = ebp !== 0 ? m.u32((ebp + 0xc) >>> 0) : 0xffffffff
          const nShiftedStat = (nStatId << 16) >>> 0
          if (SUNIT_FindItemEventNode113c(m, ebp, 2, dwPetGuid, nShiftedStat) === 0) {
            const wFunc1 = (m.u16((pItemStatCost + 0x4c) >>> 0) << 16) >> 16
            ITEMS_RegisterItemEventCallback113c(
              m,
              wFunc1,
              dwPetGuid,
              2,
              ebp,
              game,
              wItemEvent1,
              nShiftedStat,
              0,
            )
            const wItemEvent2 = (m.u16((pItemStatCost + 0x4a) >>> 0) << 16) >> 16
            if (wItemEvent2 > 0) {
              const wFunc2 = (m.u16((pItemStatCost + 0x4e) >>> 0) << 16) >> 16
              ITEMS_RegisterItemEventCallback113c(
                m,
                wFunc2,
                dwPetGuid,
                2,
                ebp,
                game,
                wItemEvent2,
                nShiftedStat,
                0,
              )
            }
          }
        }
      }
    }
  }

  let pStatList = 0
  for (let i = 0; i < 6; i += 1) {
    const nStatId = (m.u16((pSkillsTxt + 0x54 + i * 2) >>> 0) << 16) >> 16
    if (
      nStatId >= 0 &&
      pDataTables !== 0 &&
      nStatId < i32(m, (pDataTables + 0xbd4) >>> 0)
    ) {
      const pItemStatCost =
        (m.u32((pDataTables + 0xbcc) >>> 0) + imul32(nStatId, 0x144)) >>> 0
      if (pItemStatCost !== 0) {
        const dwCalc = m.u32((pSkillsTxt + 0x68 + i * 4) >>> 0)
        const nVal = SKILLS_EvalCalcByOffset113c(m, owner, dwCalc, edx, skillLvl)
        if (nVal !== 0) {
          if (pStatList === 0) {
            const ownerType = ebp !== 0 ? m.u32(ebp) : 6
            const ownerId = ebp !== 0 ? m.u32((ebp + 0xc) >>> 0) : 0xffffffff
            pStatList = STATLIST_AllocList113c(m, 0, ownerType, ownerId, 0, 0)
            if (pStatList === 0) {
              return 0
            }
            STATLIST_MergeStatLists113c(m, ebp, pStatList, 1)
          }
          STATLIST_SetStat113c(m, pStatList, nStatId, nVal, 0)
          const wItemEvent1 = (m.u16((pItemStatCost + 0x48) >>> 0) << 16) >> 16
          if (wItemEvent1 > 0) {
            const nShiftedStat = (nStatId << 16) >>> 0
            let alreadyRegistered = false
            if (ebp !== 0) {
              const dwPetGuid = m.u32((ebp + 0xc) >>> 0)
              let pNode = m.u32((ebp + 0x90) >>> 0)
              while (pNode !== 0) {
                const pNext = m.u32((pNode + 0x1c) >>> 0)
                if (
                  m.u32((pNode + 0x4) >>> 0) === 2 &&
                  m.u32((pNode + 0x8) >>> 0) === dwPetGuid &&
                  i32(m, (pNode + 0xc) >>> 0) === nStatId
                ) {
                  alreadyRegistered = true
                  break
                }
                pNode = pNext
              }
            }
            if (!alreadyRegistered) {
              const dwPetGuid = ebp !== 0 ? m.u32((ebp + 0xc) >>> 0) : 0xffffffff
              const wFunc1 = (m.u16((pItemStatCost + 0x4c) >>> 0) << 16) >> 16
              if (wFunc1 >= 0 && wFunc1 < 0x32) {
                const pfn1 = m.u32((0x6fd277a8 + wFunc1 * 4) >>> 0)
                if (pfn1 !== 0) {
                  UNITEVENT_RegisterTimerOrItemEventNode113c(
                    m,
                    ebp,
                    game,
                    wItemEvent1,
                    nShiftedStat,
                    0,
                    pfn1,
                    2,
                    dwPetGuid,
                  )
                }
              }
              const wItemEvent2 = (m.u16((pItemStatCost + 0x4a) >>> 0) << 16) >> 16
              if (wItemEvent2 > 0) {
                const wFunc2 = (m.u16((pItemStatCost + 0x4e) >>> 0) << 16) >> 16
                ITEMS_RegisterItemEventCallback113c(
                  m,
                  wFunc2,
                  dwPetGuid,
                  2,
                  ebp,
                  game,
                  wItemEvent2,
                  nShiftedStat,
                  0,
                )
              }
            }
          }
        }
      }
    }
  }

  const nPassiveState = (m.u16((pSkillsTxt + 0x80) >>> 0) << 16) >> 16
  if (
    nPassiveState > 0 &&
    pDataTables !== 0 &&
    nPassiveState <= i32(m, (pDataTables + 0xc4) >>> 0)
  ) {
    STATES_ToggleGfxStateFlag113c(m, ebp, nPassiveState, 1)
    if (pStatList !== 0) {
      STATLIST_SetState113c(m, pStatList, nPassiveState)
    }
  }

  const nLifeBonusPct =
    SKILLS_EvalCalcByOffset113c(
      m,
      owner,
      m.u32((pSkillsTxt + 0x138) >>> 0),
      edx,
      skillLvl,
    ) | 0
  const baseLife = STATLIST_GetMaxLifeFromUnit113c(m, ebp) | 0
  let bonusLife = 0
  if (baseLife > 0x100000) {
    if (((baseLife & ~0xf) | 0) < 0x640) {
      bonusLife = Number((BigInt(baseLife) * BigInt(nLifeBonusPct)) / 100n) | 0
    } else {
      bonusLife = Math.imul(Math.trunc(baseLife / 100), nLifeBonusPct) | 0
    }
  } else if (nLifeBonusPct > 0x10000) {
    if (((nLifeBonusPct & ~0xf) | 0) < 0x640) {
      bonusLife = Number((BigInt(baseLife) * BigInt(nLifeBonusPct)) / 100n) | 0
    } else {
      bonusLife = Math.imul(Math.trunc(nLifeBonusPct / 100), baseLife) | 0
    }
  } else {
    bonusLife = Math.trunc(Math.imul(baseLife, nLifeBonusPct) / 100) | 0
  }
  const nMaxLife = (baseLife + bonusLife) | 0
  STATLIST_SetUnitStat113c(m, ebp, 7, nMaxLife, 0)
  STATLIST_SetUnitStat113c(m, ebp, 6, nMaxLife, 0)

  for (let i = 0; i < 5; i += 1) {
    const nPassiveSkillId = (m.u16((pSkillsTxt + 0xc4 + i * 2) >>> 0) << 16) >> 16
    if (
      nPassiveSkillId > 0 &&
      pDataTables !== 0 &&
      nPassiveSkillId < i32(m, (pDataTables + 0xba0) >>> 0)
    ) {
      const dwCalc = m.u32((pSkillsTxt + 0xd0 + i * 4) >>> 0)
      const nGrantedLvl = SKILLS_EvalCalcByOffset113c(m, owner, dwCalc, edx, skillLvl) | 0
      if (nGrantedLvl > 0) {
        const pPassiveTxt =
          (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nPassiveSkillId, 0x23c)) >>> 0
        if (pPassiveTxt !== 0) {
          SKILLS_SetSkillLevelOnUnit113c(
            m,
            ebp,
            nPassiveSkillId,
            nGrantedLvl,
            0,
            0x6fd1b980,
            0x112a,
          )
          SKILLS_RefreshPassiveAuraSkills113c(m, ebp)
          if (ebp !== 0 && m.u32(ebp) === 0) {
            PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(
              m,
              m.u32((ebp + 0x80) >>> 0),
              ebp,
            )
          }
          const pBitMasks = m.u32(0x6fd18be0) >>> 0
          const bMask14 = pBitMasks !== 0 ? m.u8((pBitMasks + 0x14) >>> 0) : 0x01
          if ((m.u8((pPassiveTxt + 0x4) >>> 0) & bMask14) !== 0) {
            SKILLS_AssignHandSkillAndSyncAura113c(
              m,
              ebp,
              0,
              nPassiveSkillId,
              0xffffffff,
            )
          }
        }
      }
    }
  }

  const wAuraEvent0 = (m.u16((pSkillsTxt + 0x84) >>> 0) << 16) >> 16
  if (wAuraEvent0 >= 0) {
    ITEMEVENT_RemoveByTypeAndState113c(m, ebp, game, 1, nPassiveState)
    for (let i = 0; i < 3; i += 1) {
      const wEvt = (m.u16((pSkillsTxt + 0x84 + i * 2) >>> 0) << 16) >> 16
      if (wEvt < 0) {
        break
      }
      const wFunc = (m.u16((pSkillsTxt + 0x8a + i * 2) >>> 0) << 16) >> 16
      if (wFunc >= 0 && wFunc < 0x32) {
        const pfn = m.u32((0x6fd277a8 + wFunc * 4) >>> 0)
        if (pfn !== 0) {
          UNITEVENT_RegisterTimerOrItemEventNode113c(
            m,
            ebp,
            game,
            wEvt,
            edx,
            skillLvl,
            pfn,
            1,
            nPassiveState,
          )
        }
      }
    }
  }

  const wSummonUMod = (m.u16((pSkillsTxt + 0xe4) >>> 0) << 16) >> 16
  if (wSummonUMod > 0 && wSummonUMod < 0x2b && ebp !== 0 && m.u32(ebp) === 1) {
    const pMonData = m.u32((ebp + 0x14) >>> 0)
    if (pMonData !== 0) {
      const pUModBytes = (pMonData + 0x1c) >>> 0
      const nAct = m.u32((pMonData + 0x58) >>> 0)
      const pDrlgAct = m.u32((game + nAct * 4 + 0xf0) >>> 0)
      if (pDrlgAct !== 0) {
        if ((m.u8((pMonData + 0x16) >>> 0) & 0x8) === 0) {
          m.setU32((pDrlgAct + 0x2c8) >>> 0, (m.u32((pDrlgAct + 0x2c8) >>> 0) + 1) >>> 0)
        }
      }
      m.setU16((pMonData + 0x16) >>> 0, (m.u16((pMonData + 0x16) >>> 0) | 0x8) & 0xffff)
      let slot = 0
      while (slot < 9 && m.u8((pUModBytes + slot) >>> 0) !== 0) {
        slot += 1
      }
      if (slot < 9) {
        m.setU8((pUModBytes + slot) >>> 0, wSummonUMod & 0xff)
        const pfnUMod = m.u32((0x6fd2e550 + wSummonUMod * 4) >>> 0)
        if (pfnUMod !== 0) {
          if (pfnUMod === 0x6fc441b0) {
            MONSTER_AssignTeleportSkill_6FC441B0_113c(m, ebp, 1)
          } else if (pfnUMod === 0x6fc44cd0) {
            MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c(m, ebp, 1)
          } else if (onDispatchMonUMod !== undefined) {
            onDispatchMonUMod(m, pfnUMod, ebp, wSummonUMod, 1)
          }
        }
      }
    }
  }

  const nOverlayId = (m.u16((pSkillsTxt + 0xe6) >>> 0) << 16) >> 16
  if (
    nOverlayId > 0 &&
    pDataTables !== 0 &&
    nOverlayId < i32(m, (pDataTables + 0xbc0) >>> 0)
  ) {
    STATES_SetMonsterSkillIconOnUnit113c(m, ebp, nOverlayId, 0)
  }

  let nEquipLvl = nItemLevel | 0
  if (nEquipLvl === 0) {
    const nOwnerLvl = STATLIST_GetUnitStat113c(m, owner, 0xc, 0) | 0
    let nCap = imul32(skillLvl, 3)
    if (nCap <= 1) {
      nCap = 1
    }
    nEquipLvl = nCap < nOwnerLvl ? nCap : nOwnerLvl
  }
  MONSTER_EquipMonEquipItems113c(m, ebp, game, owner, nEquipLvl, 0, skillLvl)
  return 1
}

let nextW10B1HeapPtr = 0x00410000
let w10B1StackPtr = 0x7e250000

function allocW10B1Block(m: SparseMemory113c, nBytes: number): number {
  const sz = nBytes > 0 ? nBytes : 4
  const ptr = m.alloc(sz) >>> 0
  m.fill(ptr, sz, 0)
  return ptr
}

function withW10B1Stack<T>(m: SparseMemory113c, nBytes: number, fn: (ptr: number) => T): T {
  const aligned = ((nBytes + 0xf) & ~0xf) >>> 0
  const saved = w10B1StackPtr >>> 0
  w10B1StackPtr = (saved + aligned) >>> 0
  try {
    m.fill(saved, aligned, 0)
    return fn(saved)
  } finally {
    w10B1StackPtr = saved
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC7D5C0
 * @ordinalOrName D2Game_6FC7D5C0
 */
export function ACT5Q4_InitQuestData_6FC7D5C0_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pPreallocatedState = 0,
): void {
  hitD2GameVa113c(0x6FC7D5C0)
  const esi = pQuestData >>> 0
  for (let i = 0; i < 0xf; i += 1) {
    m.setU32((esi + 0xa0 + i * 4) >>> 0, 0)
  }
  m.setU8((esi + 0xc) >>> 0, 0)
  m.setU32((esi + 0xa0) >>> 0, 0x6fc77a60)
  m.setU32((esi + 0xc8) >>> 0, 0x6fc77a20)
  m.setU32((esi + 0xac) >>> 0, 0x6fc7ad50)
  m.setU32((esi + 0xc0) >>> 0, 0x6fc7b690)
  m.setU32((esi + 0xa8) >>> 0, 0x6fc7d520)
  m.setU32((esi + 0xcc) >>> 0, 0x6fc7b7a0)
  m.setU32((esi + 0xd4) >>> 0, 0x6fc7ae20)
  m.setU32((esi + 0xdc) >>> 0, 0x6fd2c488)
  m.setU8((esi + 0xa) >>> 0, 1)
  void ACT5Q4_Callback00_NpcActivate_6FC77A60_113c
  void ACT5Q4_Callback11_RemovePlayerGuid_6FC77A20_113c
  void ACT4Q3_Callback03_LevelChanged113c
  void QUESTS_Act1AndarielOnDeath_6FC7B690_113c
  void ACT5Q4_OnAnyaNpcInteract_6FC7D520_113c
  void ACT5Q4_Callback01_NpcDeactivate_6FC7B7A0_113c
  void ACT5Q4_OnPlayerEnteredOrInitState_6FC7AE20_113c
  void ACT5Q4_StatusFilter_6FC768C0_113c
  void ACT5Q4_ActiveFilter_6FC76840_113c
  void QUESTS_DefaultSequenceFilter_6FC7AFB0_113c

  let edx = pPreallocatedState >>> 0
  if (edx === 0) {
    edx = allocW10B1Block(m, 0x90)
  }
  m.setU32((esi + 0x18) >>> 0, edx)
  m.setU32((esi + 0xe0) >>> 0, 0x26)
  m.setU32((esi + 0xe8) >>> 0, 0x6fc768c0)
  m.setU8((esi + 0xd) >>> 0, 4)
  m.setU32((esi + 0xec) >>> 0, 0x6fc76840)
  m.setU32((esi + 0xf0) >>> 0, 0x6fc7afb0)
  m.setU32((esi + 0x10) >>> 0, 0x23)
  for (let i = 0; i < 0x24; i += 1) {
    m.setU32((edx + i * 4) >>> 0, 0)
  }
  m.setU16((edx + 0x80) >>> 0, 0)
}

/**
 * @dll D2Game.dll
 * @va 0x6FC7EED0
 * @ordinalOrName D2Game_6FC7EED0
 */
export function ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
  onChainedSeqFilter?: (m: SparseMemory113c, pChainedQuest: number) => number,
): void {
  hitD2GameVa113c(0x6FC7EED0)
  const edi = pQuestData >>> 0
  const ebp = pQuestArg >>> 0
  const esi = m.u32((edi + 0x18) >>> 0)
  if (
    m.u8((esi + 0x11) >>> 0) === 0 ||
    m.u8((esi + 0x10) >>> 0) === 0 ||
    m.u32((esi + 0xc) >>> 0) !== 0
  ) {
    return
  }
  if (m.u8((esi + 0x4) >>> 0) === 0) {
    m.setU8((esi + 0x4) >>> 0, 1)
    void ACT5Q5_ActivateAncientStatueObjects_6FC7E660_113c
    QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 2, edi, 0x6fc7e660)
  }
  const pMonster = m.u32((ebp + 0x8) >>> 0)
  const nMonClassId = pMonster !== 0 ? i32(m, (pMonster + 0x4) >>> 0) : -1
  let dwStatueGuid = 0
  if (nMonClassId === 0x21c) {
    dwStatueGuid = m.u32((esi + 0x1c) >>> 0)
    m.setU8((esi + 0x3e) >>> 0, 1)
  } else if (nMonClassId === 0x21d) {
    dwStatueGuid = m.u32((esi + 0x14) >>> 0)
    m.setU8((esi + 0x3c) >>> 0, 1)
  } else if (nMonClassId === 0x21e) {
    dwStatueGuid = m.u32((esi + 0x18) >>> 0)
    m.setU8((esi + 0x3d) >>> 0, 1)
  } else {
    return
  }
  ACT5Q3_SpawnAnyaThawProjectile_6FC7D960_113c(m, dwStatueGuid, edi, ebp)
  const pGame0 = m.u32((edi + 0x4) >>> 0)
  const pQuestControl = m.u32((pGame0 + 0x10f4) >>> 0)
  m.setU8((pQuestControl + 0x20) >>> 0, 0x12)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    pGame0,
    (mem, g, pUnit, arg) =>
      QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c(mem, g, pUnit, arg),
    0,
    0,
  )
  const nRem = (i32(m, (esi + 0x44) >>> 0) - 1) | 0
  m.setU32((esi + 0x44) >>> 0, nRem >>> 0)
  if (nRem !== 0) {
    return
  }
  m.setU8(esi, 1)
  if (m.u8((edi + 0x9) >>> 0) === 0) {
    return
  }
  const pKiller = m.u32((ebp + 0xc) >>> 0)
  if (pKiller !== 0) {
    const pQuestFlags = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(
      m,
      pKiller,
      m.u32((edi + 0x4) >>> 0),
    )
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x27, 0) === 0) {
      const nPlayerLvl = STATLIST_GetUnitBaseStat113c(m, pKiller, 0xc, 0) | 0
      const pGameCur = m.u32((edi + 0x4) >>> 0)
      const nMinLvl = ((m.u8((pGameCur + 0x6d) >>> 0) + 1) * 20) | 0
      if (nPlayerLvl >= nMinLvl) {
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x27, 0)
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x27, 0xd)
        QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c(m, pKiller, m.u32(ebp))
      }
    }
  }
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32(ebp),
    (mem, g, pUnit, arg) =>
      ACT5Q5_CheckAndGrantAncientsRewardToPlayerAndParty_6FC7C100_113c(
        mem as SparseMemory113c,
        g,
        pUnit,
        arg,
      ),
    0,
    m.u32((ebp + 0x8) >>> 0),
  )
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32(ebp),
    (mem, g, pUnit, arg) =>
      ACT5Q5_SyncPlayerQuest27State0EAlert23_6FC78F40_113c(mem, g, pUnit, arg),
    0,
    m.u32((ebp + 0x8) >>> 0),
  )
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, edi, 5)
  const pMon2 = m.u32((ebp + 0x8) >>> 0)
  const pRoom = UNITS_GetRoom113c(m, pMon2)
  const ebxGame = m.u32(ebp) >>> 0
  const posY = UNIT_GetPosY113c(m, pMon2)
  const posX = UNIT_GetPosX113c(m, pMon2)
  const pObjUnit = UNIT_Alloc113c(m, 2) >>> 0
  if (pObjUnit !== 0) {
    m.setU32(pObjUnit, 2)
    m.setU32((pObjUnit + 0x4) >>> 0, 0x231)
    m.setU32((pObjUnit + 0x8) >>> 0, m.u32((ebxGame + 0x1c) >>> 0))
    m.setU32((pObjUnit + 0x80) >>> 0, ebxGame)
    let flagsC8 = m.u32((pObjUnit + 0xc8) >>> 0)
    if (m.u32((ebxGame + 0x70) >>> 0) !== 0) {
      flagsC8 = (flagsC8 | 0x02000000) >>> 0
    } else {
      flagsC8 = (flagsC8 & 0xfdffffff) >>> 0
    }
    flagsC8 = (flagsC8 | 0x04000000) >>> 0
    m.setU32((pObjUnit + 0xc8) >>> 0, flagsC8)
    const nLvlId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
    const bAct = DRLG_GetActNoFromLevelId113c(m, nLvlId) & 0xff
    m.setU8((pObjUnit + 0x18) >>> 0, bAct)
    m.setU32((pObjUnit + 0x1c) >>> 0, m.u32((ebxGame + bAct * 4 + 0xbc) >>> 0))
    m.setU32((pObjUnit + 0x74) >>> 0, 0)
    SUNIT_InitUnitSeed113c(m, pObjUnit, (ebxGame + 0xd0) >>> 0)
    m.setU32((pObjUnit + 0xc4) >>> 0, (m.u32((pObjUnit + 0xc4) >>> 0) | 0x10) >>> 0)
    m.setU32((pObjUnit + 0xd0) >>> 0, 0xb)
    let nextGuid = (m.u32((ebxGame + 0x98) >>> 0) + 1) >>> 0
    if (nextGuid === 0xffffffff) {
      nextGuid = 1
    }
    m.setU32((ebxGame + 0x98) >>> 0, nextGuid)
    const pObjData = allocW10B1Block(m, 0x38)
    m.setU32((pObjUnit + 0x14) >>> 0, pObjData)
    m.setU32(pObjData, DATATBLS_GetObjectsTxtRecord113c(m, 0x231))
    m.setU32((pObjUnit + 0x10) >>> 0, 0)
    UNITS_AllocStaticPath113c(m, pObjUnit)
    OBJECTS_InitObjectUnit113c(m, pObjUnit, ebxGame, nextGuid, pRoom, posX, posY)
    SUNIT_PlaceServerUnitInRoom113c(m, pRoom, posY, pObjUnit, posX, ebxGame, 1)
  }
  const pChainedQuest = QUESTS_GetQuestData_6FC53F30_113c(
    m,
    m.u32((edi + 0x4) >>> 0),
    m.u32((edi + 0x10) >>> 0),
  )
  if (pChainedQuest !== 0) {
    if (onChainedSeqFilter !== undefined) {
      onChainedSeqFilter(m, pChainedQuest)
    } else {
      const pfnSelfF0 = m.u32((edi + 0xf0) >>> 0) >>> 0
      if (pfnSelfF0 === 0 || pfnSelfF0 === 0xffffffff) {
        throw new Error('ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c: IsBadCodePtr(pQuestData->pfSeqFilter) (line 855)')
      }
      const pfnChainedF0 = m.u32((pChainedQuest + 0xf0) >>> 0) >>> 0
      if (pfnChainedF0 === 0x6fc79930) {
        ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c(m, pChainedQuest)
      }
    }
  }
  if (m.u8((edi + 0xb) >>> 0) !== 0xd) {
    m.setU8((edi + 0x14) >>> 0, 0)
    m.setU8((edi + 0xb) >>> 0, 0xd)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((edi + 0x4) >>> 0),
      (mem, g, pUnit, arg) =>
        ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c(mem, g, pUnit, arg),
      0,
      0,
    )
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC88060
 * @ordinalOrName D2Game_6FC88060
 */
export function ACT1Q6_InitQuestData_6FC88060_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pPreallocatedState = 0,
): void {
  hitD2GameVa113c(0x6FC88060)
  const esi = pQuestData >>> 0
  for (let i = 0; i < 0xf; i += 1) {
    m.setU32((esi + 0xa0 + i * 4) >>> 0, 0)
  }
  m.setU32((esi + 0xa0) >>> 0, 0x6fc80a80)
  m.setU32((esi + 0xac) >>> 0, 0x6fc83dd0)
  m.setU32((esi + 0xc0) >>> 0, 0x6fc87e00)
  m.setU32((esi + 0xcc) >>> 0, 0x6fc83f90)
  m.setU32((esi + 0xa8) >>> 0, 0x6fc83190)
  m.setU32((esi + 0xd4) >>> 0, 0x6fc808b0)
  m.setU32((esi + 0xf0) >>> 0, 0x6fc85410)
  m.setU32((esi + 0xe0) >>> 0, 0x6)
  m.setU32((esi + 0xdc) >>> 0, 0x6fd2a040)
  m.setU8((esi + 0xa) >>> 0, 1)
  m.setU8((esi + 0xb) >>> 0, 0)
  m.setU8((esi + 0xc) >>> 0, 0)
  void ACT1Q6_Callback00_NpcActivate_6FC80A80_113c
  void ACT1Q1_Callback03_LevelChanged113c
  void ACT1Q6_OnAndarielKilled_6FC87E00_113c
  void ACT1Q6_NpcIntroAndRewardWarrivAndTownsfolk_6FC83F90_113c
  void ACT1Q6_Callback00_NpcActivateCain_6FC83190_113c
  void ACT1Q6_Callback13_RefreshQuestState_6FC808B0_113c
  void ACT1Q1_SequenceFilter_6FC85410_113c
  void ACT1Q5_CheckCharsiImbueNpcAlert113c

  let eax = pPreallocatedState >>> 0
  if (eax === 0) {
    eax = allocW10B1Block(m, 0x198)
  }
  m.setU32((esi + 0xe8) >>> 0, 0)
  m.setU32((esi + 0x18) >>> 0, eax)
  m.setU8((esi + 0xd) >>> 0, 4)
  m.setU32((esi + 0x10) >>> 0, 0x25)
  m.setU32((esi + 0xec) >>> 0, 0x6fc80940)
  m.setU32((eax + 0x18c) >>> 0, 0)
  m.setU16((eax + 0x190) >>> 0, 0)
  m.setU16((eax + 0x192) >>> 0, 0)
  m.setU8((eax + 0x194) >>> 0, 0)
  m.setU8((eax + 0x195) >>> 0, 0)
  m.setU16((eax + 0x80) >>> 0, 0)
  m.setU16((eax + 0x104) >>> 0, 0)
  m.setU16((eax + 0x188) >>> 0, 0)
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8A930
 * @ordinalOrName D2Game_6FC8A930
 */
export function SHRINES_OnShrineStateRemoved_6FC8A930_113c(
  m: SparseMemory113c,
  pUnit: number,
  nState: number,
  pStatList = 0,
): void {
  hitD2GameVa113c(0x6FC8A930)
  const esi = pUnit >>> 0
  STATES_OnTimedStateRemoved113c(m, esi, nState | 0, pStatList >>> 0)
  SKILLS_RefreshPassiveAuraSkills113c(m, esi)
  if (esi !== 0 && m.u32(esi) === 0) {
    PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(
      m,
      m.u32((esi + 0x80) >>> 0),
      esi,
    )
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8F510
 * @ordinalOrName D2Game_6FC8F510
 */
export function QUESTS_ObjectEvent07_FastcallThunk_6FC8F510_113c(
  m: SparseMemory113c,
  pGame: number,
  pObject: number,
): void {
  hitD2GameVa113c(0x6FC8F510)
  QUESTS_ObjectEvent07_DispatchByClassId_6FC56C50_113c(m, pGame >>> 0, pObject >>> 0)
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB7120
 * @ordinalOrName D2Game_6FCB7120
 */
export function PETS_AllocAndInitPlayerPetTable_6FCB7120_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
): void {
  hitD2GameVa113c(0x6FCB7120)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x9a)
  }
  if (m.u32((pPlayerData + 0x44) >>> 0) !== 0) {
    PETS_FreePlayerPetTable_6FCB7640_113c(m, pGame, pPlayerUnit)
  }
  const pWrapper = allocW10B1Block(m, 4)
  m.setU32(pWrapper, 0)
  m.setU32((pPlayerData + 0x44) >>> 0, pWrapper)
  const pDataTables = m.u32(m.u32(0x6fd1829c))
  const nPetTypes = pDataTables !== 0 ? i32(m, (pDataTables + 0xbf0) >>> 0) : 0
  const nAllocBytes = nPetTypes > 0 ? nPetTypes * 12 : 12
  const pSlots = allocW10B1Block(m, nAllocBytes)
  m.setU32(pWrapper, pSlots)
  PETS_ClampAllPlayerPetTypesToDefaultMax_6FCB6F40_113c(m, pPlayerUnit, pGame)
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB7730
 * @ordinalOrName D2Game_6FCB7730
 */
export function PETS_CleanupAllPlayerPetsOnActChangeOrSave_6FCB7730_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
): void {
  hitD2GameVa113c(0x6FCB7730)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x12f)
  }
  const pPetWrapper = m.u32((pPlayerData + 0x44) >>> 0)
  if (pPetWrapper !== 0) {
    const pDataTables = m.u32(m.u32(0x6fd1829c))
    let nPetTypes = pDataTables !== 0 ? i32(m, (pDataTables + 0xbf0) >>> 0) : 0
    let nPetTypeIdx = 1
    let nByteOffset = 0xc
    if (nPetTypes > 1) {
      while (nPetTypeIdx < nPetTypes) {
        const pSlot =
          nPetTypeIdx < nPetTypes && nByteOffset >= 0
            ? (m.u32(pPetWrapper) + nByteOffset) >>> 0
            : 0
        const bIsHydra = nPetTypeIdx === 7 ? 1 : 0
        PETS_CleanupOrMarkDeadPetSlot_6FCB7420_113c(
          m,
          pGame,
          pPlayerUnit,
          pSlot,
          bIsHydra,
          bIsHydra,
        )
        const pCurTables = m.u32(m.u32(0x6fd1829c))
        nPetTypes = pCurTables !== 0 ? i32(m, (pCurTables + 0xbf0) >>> 0) : 0
        nPetTypeIdx += 1
        nByteOffset += 0xc
      }
    }
    PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(m, pGame, pPlayerUnit)
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB7A20
 * @ordinalOrName D2Game_6FCB7A20
 */
export function PETS_InsertPetIntoPlayerPetSlot_6FCB7A20_113c(
  m: SparseMemory113c,
  pPetTypeSlot: number,
  pGame: number,
  pPlayerUnit: number,
  pPetUnit: number,
  pPetArg: number,
): number {
  hitD2GameVa113c(0x6FCB7A20)
  let nMaxAllowed = i32(m, (pPetTypeSlot + 0x8) >>> 0)
  if (nMaxAllowed === 0) {
    PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(m, pGame, pPlayerUnit)
    nMaxAllowed = i32(m, (pPetTypeSlot + 0x8) >>> 0)
    if (nMaxAllowed === 0) {
      const dwPetGuid = pPetUnit !== 0 ? m.u32((pPetUnit + 0xc) >>> 0) : 0xffffffff
      PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c(m, pGame, dwPetGuid)
      return 0
    }
  }
  if (i32(m, (pPetTypeSlot + 0x4) >>> 0) === nMaxAllowed) {
    const pHeadNode = m.u32(pPetTypeSlot)
    if (pHeadNode === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0x312)
    }
    const dwOldestGuid = m.u32((pHeadNode + 0x4) >>> 0)
    PETS_RemovePetFromSlotByGuid_6FCB7920_113c(m, pGame, dwOldestGuid, pPetTypeSlot, 1)
    if (i32(m, (pPetTypeSlot + 0x4) >>> 0) === i32(m, (pPetTypeSlot + 0x8) >>> 0)) {
      throw new D2CommonAssertError('0x6fd19ff9', 0x316)
    }
  }
  let pTail = m.u32(pPetTypeSlot)
  if (pTail !== 0) {
    while (m.u32((pTail + 0x14) >>> 0) !== 0) {
      pTail = m.u32((pTail + 0x14) >>> 0)
    }
  }
  const pNewNode = allocW10B1Block(m, 0x18)
  const dwNewGuid = pPetUnit !== 0 ? m.u32((pPetUnit + 0xc) >>> 0) : 0xffffffff
  m.setU32((pNewNode + 0x4) >>> 0, dwNewGuid)
  if (pPetArg !== 0) {
    m.setU32((pNewNode + 0x8) >>> 0, m.u32(pPetArg))
    m.setU32((pNewNode + 0xc) >>> 0, m.u32((pPetArg + 0x4) >>> 0))
    m.setU32((pNewNode + 0x10) >>> 0, m.u32((pPetArg + 0x8) >>> 0))
  }
  if (pTail !== 0) {
    m.setU32((pTail + 0x14) >>> 0, pNewNode)
  } else {
    m.setU32(pPetTypeSlot, pNewNode)
  }
  const nNewCount = i32(m, (pPetTypeSlot + 0x4) >>> 0) + 1
  const nCurMax = i32(m, (pPetTypeSlot + 0x8) >>> 0)
  m.setU32((pPetTypeSlot + 0x4) >>> 0, nNewCount >>> 0)
  if (nNewCount > nCurMax) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x330)
  }
  return 1
}

/**
 * @dll D2Game.dll
 * @va 0x6FCBFAE0
 * @ordinalOrName D2Game_6FCBFAE0
 */
export function SKILLS_SpendSkillPointsAndIncrementSkill_6FCBFAE0_113c(
  m: SparseMemory113c,
  pUnit: number,
  nSkillId: number,
): number {
  hitD2GameVa113c(0x6FCBFAE0)
  if (nSkillId < 0) {
    return 0
  }
  const pDataTables = m.u32(m.u32(0x6fd1829c))
  if (pDataTables === 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) {
    return 0
  }
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0)
  const pSkillsTxt = (pSkillsTxtBase + nSkillId * 0x23c) >>> 0
  if (pSkillsTxt === 0) {
    return 0
  }
  let nReqPoints = 1
  const uSkPointsCalc = m.u32((pSkillsTxt + 0x170) >>> 0)
  if (uSkPointsCalc !== 0xffffffff) {
    const pExistingSkill = SKILLS_GetSkillById113c(m, pUnit, nSkillId, 0xffffffff)
    const nCurLvl =
      pExistingSkill !== 0 ? SKILLS_EvaluateSkillLevel113c(m, pUnit, pExistingSkill, 1) : 0
    nReqPoints = SKILLS_EvalCalcByOffset113c(m, pUnit, uSkPointsCalc, nSkillId, nCurLvl)
  }
  const nAvailPoints = STATLIST_GetUnitBaseStat113c(m, pUnit, 5, 0)
  if (nAvailPoints < nReqPoints) {
    return 0
  }
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 5, (-nReqPoints) >>> 0, 0)
  const pAddedSkill = SKILLS_AddSkillToUnit113c(m, pUnit, nSkillId)
  SKILLS_RefreshPassiveAuraSkills113c(m, pUnit)
  if (pUnit !== 0 && m.u32(pUnit) === 0) {
    PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(
      m,
      m.u32((pUnit + 0x80) >>> 0),
      pUnit,
    )
  }
  if (pAddedSkill === 0) {
    STATLIST_AddUnitStatMemPort113c(m, pUnit, 5, nReqPoints >>> 0, 0)
    return 0
  }
  const nNewBaseLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit, pAddedSkill, 0)
  let pClient = 0
  if (pUnit !== 0 && m.u32(pUnit) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    pClient = m.u32((pPlayerData + 0x9c) >>> 0)
  }
  NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c(m, pClient, pUnit, nSkillId, nNewBaseLvl, 0)
  const nPassiveState = SKILLS_GetPassiveState113c(m, nSkillId)
  if (nPassiveState !== 0) {
    STATES_ToggleGfxStateFlag113c(m, pUnit, nPassiveState, 1)
  }
  STATES_ApplyMonSkillIconToUnit113c(m, pUnit, nSkillId)
  return 1
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDDE60
 * @ordinalOrName D2Game_6FCDDE60
 */
export function NPCS_RepairPlayerItemOrAllItems_6FCDDE60_113c(
  m: SparseMemory113c,
  pPlayerUnit: number,
  pGame: number,
  dwNpcGuid: number,
  dwItemGuid: number,
  dwModeOrFlags: number,
): number {
  hitD2GameVa113c(0x6FCDDE60)
  if (pGame === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x9b7)
  }
  const bInteracting = m.u8((pPlayerUnit + 0x6c) >>> 0)
  const dwInteractId = m.u32((pPlayerUnit + 0x64) >>> 0)
  const dwInteractType = m.u32((pPlayerUnit + 0x68) >>> 0)
  const pInteractingUnit =
    bInteracting !== 0
      ? SUNIT_GetServerUnit113c(m, pGame, dwInteractType, dwInteractId)
      : 0

  let pNpcUnit = m.u32((pGame + (dwNpcGuid & 0x7f) * 4 + 0x1320) >>> 0)
  while (pNpcUnit !== 0 && m.u32((pNpcUnit + 0xc) >>> 0) !== (dwNpcGuid >>> 0)) {
    pNpcUnit = m.u32((pNpcUnit + 0xe4) >>> 0)
  }
  if (pNpcUnit === 0 || pInteractingUnit !== pNpcUnit) {
    const pClient =
      m.u32(pPlayerUnit) === 0
        ? m.u32((UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c) >>> 0)
        : 0
    const nGold = STATLIST_GetUnitStat113c(m, pPlayerUnit, 0xe, 0)
    withW10B1Stack(m, 0x10, (pPkt) => {
      m.setU8(pPkt, 0x2a)
      m.setU8((pPkt + 1) >>> 0, 0)
      m.setU8((pPkt + 2) >>> 0, 0x9)
      m.setU32((pPkt + 3) >>> 0, 0)
      m.setU32((pPkt + 7) >>> 0, 0xffffffff)
      m.setU32((pPkt + 0xb) >>> 0, nGold >>> 0)
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 0xf)
    })
    return 1
  }

  const nNpcClassId = m.u32((pNpcUnit + 0x4) >>> 0)
  if (
    nNpcClassId !== 0x101 &&
    nNpcClassId !== 0x9a &&
    nNpcClassId !== 0xb2 &&
    nNpcClassId !== 0x1ff &&
    nNpcClassId !== 0xfd
  ) {
    const pClient =
      m.u32(pPlayerUnit) === 0
        ? m.u32((UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c) >>> 0)
        : 0
    const nGold = STATLIST_GetUnitStat113c(m, pPlayerUnit, 0xe, 0)
    NET_SendPacket15B_TransactionResult_6FCAAC90_113c(
      m,
      0x2a,
      0x9,
      nGold,
      pClient,
      0xffffffff,
      0,
    )
    return 1
  }

  if ((dwModeOrFlags | 0) < 0) {
    const nDiff = m.u8((pGame + 0x6d) >>> 0)
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit)
    const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0)
    const nTotalCost = ITEMS_GetRepairAllCost113c(
      m,
      pGame,
      pPlayerUnit,
      nNpcClassId,
      nDiff,
      pQuestFlags,
      0,
    )
    if (nTotalCost !== 0) {
      if (NPC_DeductPlayerGoldAndStash_6FCDCC60_113c(m, pPlayerUnit, nTotalCost) === 0) {
        const pClient =
          m.u32(pPlayerUnit) === 0
            ? m.u32((UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c) >>> 0)
            : 0
        const nGold = STATLIST_GetUnitStat113c(m, pPlayerUnit, 0xe, 0)
        NET_SendPacket15B_TransactionResult_6FCAAC90_113c(
          m,
          0x2a,
          0xc,
          nGold,
          pClient,
          0xffffffff,
          0,
        )
        return 1
      }
      const pCurQuestFlags = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(
        m,
        pPlayerUnit,
        pGame,
      )
      const nCurDiff = m.u8((pGame + 0x6d) >>> 0)
      const pfnRepairWrapper =
        typeof NPCS_RepairAndRechargePlayerItemWrapper_6FCDDE50_113c === 'function'
          ? 0x6fcdde50
          : 0
      ITEMS_GetRepairAllCost113c(
        m,
        pGame,
        pPlayerUnit,
        m.u32((pNpcUnit + 0x4) >>> 0),
        nCurDiff,
        pCurQuestFlags,
        pfnRepairWrapper,
        (mem, pg, pItem, plr) =>
          NPCS_RepairAndRechargePlayerItemWrapper_6FCDDE50_113c(
            mem as SparseMemory113c,
            pg,
            plr,
            pItem,
          ),
      )
    }
    const pClient =
      m.u32(pPlayerUnit) === 0
        ? m.u32((UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c) >>> 0)
        : 0
    const nGold = STATLIST_GetUnitStat113c(m, pPlayerUnit, 0xe, 0)
    NET_SendPacket15B_TransactionResult_6FCAAC90_113c(
      m,
      0x2a,
      0x2,
      nGold,
      pClient,
      0xffffffff,
      1,
    )
    return 0
  }

  let pItem = m.u32((pGame + (dwItemGuid & 0x7f) * 4 + 0x1720) >>> 0)
  while (pItem !== 0 && m.u32((pItem + 0xc) >>> 0) !== (dwItemGuid >>> 0)) {
    pItem = m.u32((pItem + 0xe4) >>> 0)
  }
  if (pItem === 0 || ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(m, pPlayerUnit, pItem, 0) === 0) {
    const pClient =
      m.u32(pPlayerUnit) === 0
        ? m.u32((UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c) >>> 0)
        : 0
    const nGold = STATLIST_GetUnitStat113c(m, pPlayerUnit, 0xe, 0)
    NET_SendPacket15B_TransactionResult_6FCAAC90_113c(
      m,
      0x2a,
      0x9,
      nGold,
      pClient,
      0xffffffff,
      0,
    )
    return 3
  }

  const nMaxDur = STATLIST_GetMaxDurabilityFromUnit113c(m, pItem)
  const nCurDur = STATLIST_GetUnitStat113c(m, pItem, 0x48, 0)
  let bNeedsRepair = false
  if (ITEMS_CanItemBeRepairedByNpc113c(m, pItem) !== 0) {
    if (
      ITEMS_GetTwoHandedFlag113c(m, pItem) !== 0 &&
      ITEMS_CheckIfThrowItemMemPort113c(m, pItem) !== 0 &&
      ITEMS_CheckEtherealFlag113c(m, pItem) === 0
    ) {
      const nQty = STATLIST_GetUnitStat113c(m, pItem, 0x46, 0)
      const nMaxStack = ITEMS_GetTotalMaxStack113c(m, pItem)
      if ((nQty | 0) < (nMaxStack | 0)) {
        bNeedsRepair = true
      }
    }
    if (!bNeedsRepair) {
      withW10B1Stack(m, 4, (pFullChargesOut) => {
        const bHasChargedSkills = ITEMS_HasUsedCharges113c(
          m,
          pItem,
          pFullChargesOut,
        )
        if (bHasChargedSkills !== 0 && m.u32(pFullChargesOut) === 0) {
          bNeedsRepair = true
        } else if (nMaxDur !== 0 && (nCurDur | 0) < (nMaxDur | 0)) {
          bNeedsRepair = true
        }
      })
    }
  }
  if (!bNeedsRepair) {
    const pClient =
      m.u32(pPlayerUnit) === 0
        ? m.u32((UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c) >>> 0)
        : 0
    const nGold = STATLIST_GetUnitStat113c(m, pPlayerUnit, 0xe, 0)
    NET_SendPacket15B_TransactionResult_6FCAAC90_113c(
      m,
      0x2a,
      0x9,
      nGold,
      pClient,
      0xffffffff,
      0,
    )
    return 1
  }

  const pQuestFlags = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(
    m,
    pPlayerUnit,
    pGame,
  )
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const nRepairCost = ITEMS_GetTransactionCost113c(
    m,
    pPlayerUnit,
    pItem,
    nDiff,
    pQuestFlags,
    m.u32((pNpcUnit + 0x4) >>> 0),
    3,
  )
  if (NPC_DeductPlayerGoldAndStash_6FCDCC60_113c(m, pPlayerUnit, nRepairCost) !== 0) {
    NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c(m, pPlayerUnit, pItem, pGame)
    const pClient =
      m.u32(pPlayerUnit) === 0
        ? m.u32((UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c) >>> 0)
        : 0
    const nGold = STATLIST_GetUnitStat113c(m, pPlayerUnit, 0xe, 0)
    NET_SendPacket15B_TransactionResult_6FCAAC90_113c(
      m,
      0x2a,
      0x2,
      nGold,
      pClient,
      0xffffffff,
      1,
    )
    return 0
  }

  const nPlayerGold = STATLIST_GetUnitStat113c(m, pPlayerUnit, 0xe, 0) | 0
  if ((nMaxDur | 0) > (nCurDur | 0) && nPlayerGold > 0) {
    const uMissingDur = ((nMaxDur | 0) - (nCurDur | 0)) >>> 0
    const nCostPerDurFp10 = Math.floor(((nRepairCost << 10) >>> 0) / uMissingDur) | 0
    const nGoldFp10 = nPlayerGold << 10
    if (
      nCostPerDurFp10 > 0 &&
      nCostPerDurFp10 < nGoldFp10 &&
      ITEMS_CheckCommandFlags113c(m, pItem, 0x100, 0xa3e, 0x6fd1b3a4) === 0 &&
      NPC_DeductPlayerGoldAndStash_6FCDCC60_113c(m, pPlayerUnit, nPlayerGold >>> 0) !== 0
    ) {
      const nAffordableDur = (nGoldFp10 / nCostPerDurFp10) | 0
      let nNewDur = (nCurDur | 0) + nAffordableDur
      if ((nMaxDur | 0) < nNewDur) {
        nNewDur = nMaxDur | 0
      }
      STATLIST_SetUnitStat113c(m, pItem, 0x48, nNewDur >>> 0, 0)
      const pClient =
        m.u32(pPlayerUnit) === 0
          ? m.u32((UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c) >>> 0)
          : 0
      NET_SendPacket0x3E_ItemStatBitStream113c(m, pItem, 0, pClient, 1, 0x48, nNewDur >>> 0)
      const nRemGold = STATLIST_GetUnitStat113c(m, pPlayerUnit, 0xe, 0)
      NET_SendPacket15B_TransactionResult_6FCAAC90_113c(
        m,
        0x2a,
        0x2,
        nRemGold,
        pClient,
        0xffffffff,
        1,
      )
      return 0
    }
  }

  const pClient =
    m.u32(pPlayerUnit) === 0
      ? m.u32((UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c) >>> 0)
      : 0
  const nGold = STATLIST_GetUnitStat113c(m, pPlayerUnit, 0xe, 0)
  NET_SendPacket15B_TransactionResult_6FCAAC90_113c(
    m,
    0x2a,
    0xc,
    nGold,
    pClient,
    0xffffffff,
    0,
  )
  return 0
}

/**
 * @dll D2Game.dll
 * @va 0x6FCE0B90
 * @ordinalOrName D2Game_6FCE0B90
 */
export function NPCS_ResurrectOrReplacePlayerMerc_6FCE0B90_113c(
  m: SparseMemory113c,
  pMercUnit: number,
  pGame: number,
  pPlayerUnit: number,
): void {
  hitD2GameVa113c(0x6FCE0B90)
  if (pMercUnit === 0 || pPlayerUnit === 0) {
    return
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit)
  if (pPlayerData !== 0) {
    const pDataTables = m.u32(m.u32(0x6fd1829c))
    if (pDataTables !== 0 && i32(m, (pDataTables + 0xbf0) >>> 0) > 7) {
      const pPetWrapper = m.u32((pPlayerData + 0x44) >>> 0)
      if (pPetWrapper !== 0) {
        const pSlot7 = (m.u32(pPetWrapper) + 0x54) >>> 0
        if (pSlot7 !== 0) {
          let pNode = m.u32(pSlot7)
          while (pNode !== 0) {
            if ((m.u8(pNode) & 1) === 0) {
              const dwOldMercGuid = m.u32((pNode + 0x4) >>> 0)
              if (pGame === 0) {
                throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
              }
              let pOldMerc = m.u32((pGame + (dwOldMercGuid & 0x7f) * 4 + 0x1320) >>> 0)
              while (pOldMerc !== 0 && m.u32((pOldMerc + 0xc) >>> 0) !== dwOldMercGuid) {
                pOldMerc = m.u32((pOldMerc + 0xe4) >>> 0)
              }
              if (pOldMerc !== 0) {
                if (m.u32(pOldMerc) === 1) {
                  const pMonData = m.u32((pOldMerc + 0x14) >>> 0)
                  const pAiCtrl = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) : 0
                  m.setU32((pAiCtrl + 0x2c) >>> 0, 0xffffffff)
                  m.setU32((pAiCtrl + 0x30) >>> 0, 1)
                  m.setU32((pAiCtrl + 0x28) >>> 0, pGame)
                }
                const dwGuidToRemove = m.u32((pOldMerc + 0xc) >>> 0)
                PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c(
                  m,
                  pGame,
                  pPlayerUnit,
                  dwGuidToRemove,
                  0,
                )
                const pOldRoom = UNITS_GetRoom113c(m, pOldMerc)
                DUNGEON_AddRoomPortalNode113c(
                  m,
                  pOldRoom,
                  1,
                  m.u32((pOldMerc + 0xc) >>> 0),
                )
                SUNIT_FreeUnit113c(m, pGame, pOldMerc)
              }
              break
            }
            pNode = m.u32((pNode + 0x14) >>> 0)
          }
        }
      }
    }
  }

  UNITS_ChangeAnimMode113c(m, pMercUnit, 1)
  const nMaxHp = STATLIST_GetMaxLifeFromUnit113c(m, pMercUnit)
  STATLIST_SetUnitStat113c(m, pMercUnit, 6, nMaxHp, 0)
  PETS_BroadcastPetAssignPacketToAllPlayers_6FCB6D70_113c(m, pMercUnit, pGame, pPlayerUnit)
  SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(
    m,
    pGame,
    pMercUnit,
    m.u32((pPlayerUnit + 0xd0) >>> 0),
    0,
  )
  STATES_ToggleGfxStateFlag113c(m, pMercUnit, 1, 0)
  STATES_ToggleGfxStateFlag113c(m, pMercUnit, 0x6b, 0)
  STATES_ToggleGfxStateFlag113c(m, pMercUnit, 0x9a, 0)
  m.setU32((pMercUnit + 0xc4) >>> 0, (m.u32((pMercUnit + 0xc4) >>> 0) | 0x0402000e) >>> 0)
  m.setU32((pMercUnit + 0xc8) >>> 0, (m.u32((pMercUnit + 0xc8) >>> 0) & 0xfffbffff) >>> 0)
  NPC_RefreshInventoryItemStatLists_6FCDCA20_113c(m, pMercUnit)

  const nUnitType = m.u32(pPlayerUnit)
  const pPath = m.u32((pPlayerUnit + 0x2c) >>> 0)
  let nTargetY = 0
  if (nUnitType === 2 || (nUnitType > 3 && nUnitType <= 5)) {
    nTargetY = m.u32((pPath + 0x10) >>> 0)
  } else if (pPath !== 0) {
    nTargetY = PATH_GetPosY113c(m, pPath)
  }
  let nTargetX = 0
  if (nUnitType === 2 || (nUnitType > 3 && nUnitType <= 5)) {
    nTargetX = m.u32((pPath + 0xc) >>> 0)
  } else if (pPath !== 0) {
    nTargetX = PATH_GetPosX113c(m, pPath)
  }
  PETS_WarpOrUnsummonPlayerPets_6FCB7340_113c(m, pGame, pPlayerUnit, nTargetX, nTargetY)
  MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c(m, pPlayerUnit, pGame)
}

/**
 * @dll D2Game.dll
 * @va 0x6FCE7480
 * @ordinalOrName D2Game_6FCE7480
 */
export function ACT2Q3_InitQuestData_6FCE7480_113c(
  m: SparseMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FCE7480)
  const pCallbacks = (pQuestData + 0xa0) >>> 0
  for (let i = 0; i < 0xf; i += 1) {
    m.setU32((pCallbacks + i * 4) >>> 0, 0)
  }
  m.setU32(
    pCallbacks,
    typeof ACT2Q3_Callback00_NpcActivate_6FCE37F0_113c === 'function' ? 0x6fce37f0 : 0,
  )
  m.setU32(
    (pQuestData + 0xcc) >>> 0,
    typeof ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c === 'function' ? 0x6fce6b30 : 0,
  )
  m.setU32(
    (pQuestData + 0xac) >>> 0,
    typeof ACT2Q5_Callback03_LevelChanged113c === 'function' ? 0x6fce73a0 : 0,
  )
  m.setU32(
    (pQuestData + 0xc8) >>> 0,
    typeof ACT2Q3_Callback10_RemovePlayerAndDataExGuid_6FCE3970_113c === 'function'
      ? 0x6fce3970
      : 0,
  )
  m.setU32(
    (pQuestData + 0xd4) >>> 0,
    typeof ACT2Q3_Callback13_PlayerEnterSyncState_6FCE72C0_113c === 'function' ? 0x6fce72c0 : 0,
  )
  m.setU32((pQuestData + 0xdc) >>> 0, 0x6fd241f8)
  m.setU8((pQuestData + 0xa) >>> 0, 1)
  m.setU8((pQuestData + 0xc) >>> 0, 0)

  const pQuestExt = allocW10B1Block(m, 0xa0)
  m.setU32((pQuestData + 0xe0) >>> 0, 0xb)
  m.setU32((pQuestData + 0x10) >>> 0, 0xb)
  m.setU32((pQuestData + 0xe8) >>> 0, 0)
  m.setU32((pQuestData + 0x18) >>> 0, pQuestExt)
  m.setU8((pQuestData + 0xd) >>> 0, 4)
  m.setU32(
    (pQuestData + 0xec) >>> 0,
    typeof ACT2Q3_ActiveFilter_6FCE2250_113c === 'function' ? 0x6fce2250 : 0,
  )
  m.setU32(
    (pQuestData + 0xf0) >>> 0,
    typeof ACT2Q3_SeqFilter_6FCE21E0_113c === 'function' ? 0x6fce21e0 : 0,
  )
  for (let i = 0; i < 0x28; i += 1) {
    m.setU32((pQuestExt + i * 4) >>> 0, 0)
  }
  m.setU32((pQuestExt + 0x8) >>> 0, 0)
  m.setU16((pQuestExt + 0x94) >>> 0, 0)
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF0BC0
 * @ordinalOrName D2Game_6FCF0BC0
 */
export function PACKETS_SrvMercItemAction_6FCF0BC0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCF0BC0)
  if (nPacketSize !== 3 || m.u32((pGame + 0x70) >>> 0) === 0) {
    return 3
  }
  const wBodyLoc = m.u16((pPacket + 1) >>> 0)
  if (pPlayerUnit !== 0 && m.u32(pPlayerUnit) === 0) {
    const bHasCursorOrTrade =
      m.u8((pPlayerUnit + 0x6c) >>> 0) !== 0 ||
      INVENTORY_GetCursorItem113c(m, m.u32((pPlayerUnit + 0x60) >>> 0)) !== 0 ||
      m.u32((UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x4c) >>> 0) !== 0
    if (
      bHasCursorOrTrade &&
      PLRTRADE_IsInteractingWithValidPlayer113c(m, pPlayerUnit, pGame) !== 0
    ) {
      return 3
    }
  }
  if (
    SKILLS_GetUsedSkillMemPort113c(m, pPlayerUnit) !== 0 ||
    SUNIT_IsDeadOrDying113c(m, pPlayerUnit) !== 0
  ) {
    return 0
  }

  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit)
  if (pPlayerData === 0) {
    return 0
  }
  const pDataTables = m.u32(m.u32(0x6fd1829c))
  if (pDataTables === 0 || i32(m, (pDataTables + 0xbf0) >>> 0) <= 7) {
    return 0
  }
  const pPetWrapper = m.u32((pPlayerData + 0x44) >>> 0)
  if (pPetWrapper === 0) {
    return 0
  }
  const pSlot7 = (m.u32(pPetWrapper) + 0x54) >>> 0
  if (pSlot7 === 0) {
    return 0
  }
  let pNode = m.u32(pSlot7)
  if (pNode === 0) {
    return 0
  }
  while ((m.u8(pNode) & 1) !== 0) {
    pNode = m.u32((pNode + 0x14) >>> 0)
    if (pNode === 0) {
      return 0
    }
  }
  const dwMercGuid = m.u32((pNode + 0x4) >>> 0)
  let pMercUnit = m.u32((pGame + (dwMercGuid & 0x7f) * 4 + 0x1320) >>> 0)
  while (pMercUnit !== 0 && m.u32((pMercUnit + 0xc) >>> 0) !== dwMercGuid) {
    pMercUnit = m.u32((pMercUnit + 0xe4) >>> 0)
  }
  if (pMercUnit === 0) {
    return 0
  }
  if (
    SUNIT_IsDeadOrDying113c(m, pMercUnit) !== 0 ||
    UNITS_AreInAdjacentRooms113c(m, pMercUnit, pPlayerUnit) === 0
  ) {
    return 0
  }

  const pPlayerInv = m.u32((pPlayerUnit + 0x60) >>> 0)
  if (pPlayerInv === 0) {
    return 3
  }
  const pCursorItem = INVENTORY_GetCursorItem113c(m, pPlayerInv)
  if (pCursorItem === 0) {
    if (wBodyLoc > 0) {
      return ITEMS_UnequipMercBodyLocItemToPlayerCursor_6FCEECE0_113c(
        m,
        wBodyLoc,
        pMercUnit,
        pGame,
        pPlayerUnit,
      )
    }
    return 0
  }
  if (ITEMS_GetComponentByte113c(m, pCursorItem) === 0) {
    ITEMS_UseOrEquipCursorItemOnMerc_6FCF05B0_113c(
      m,
      pCursorItem,
      pMercUnit,
      pGame,
      pPlayerUnit,
    )
  }
  return 0
}

/**
 * @dll D2Game.dll
 * @va 0x6FD019C0
 * @ordinalOrName D2Game_6FD019C0
 */
export function DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c(
  m: SparseMemory113c,
  nX: number,
  pTargetRoom: number,
  nY: number,
  pGame: number,
  pUnit: number,
  bKeepExactCoords: number,
  bUseFlag800: number,
): number {
  hitD2GameVa113c(0x6FD019C0)
  if (pUnit === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xc22)
  }
  const pCurRoom = UNITS_GetRoom113c(m, pUnit)
  const pPath = m.u32((pUnit + 0x2c) >>> 0)
  if (pPath === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xc26)
  }
  let nTargetX = nX
  let nTargetY = nY
  let pResolvedRoom = pTargetRoom
  if (pResolvedRoom === 0) {
    pResolvedRoom = ROOM_FindRoomContainingSubtile113c(m, 0, nTargetX, nTargetY)
    if (pResolvedRoom === 0) {
      pResolvedRoom = ROOM_FindRoomContainingSubtile113c(
        m,
        pCurRoom,
        nTargetX,
        nTargetY,
      )
      if (pResolvedRoom === 0) {
        return 0
      }
    }
  }
  if (bKeepExactCoords === 0) {
    const nUnitSizeX = UNITS_GetUnitSizeX113c(m, pUnit)
    withW10B1Stack(m, 8, (pCoord) => {
      m.setU32(pCoord, nTargetX >>> 0)
      m.setU32((pCoord + 4) >>> 0, nTargetY >>> 0)
      pResolvedRoom = COLLISION_FindFreePositionSimple113c(m, pResolvedRoom, pCoord, nUnitSizeX, 0x1c09, 0)
      nTargetX = i32(m, pCoord)
      nTargetY = i32(m, (pCoord + 4) >>> 0)
    })
  }
  if (pResolvedRoom === 0) {
    return 0
  }
  if (
    PATH_WarpUnitToRoomAndCoord113c(
      m,
      pPath,
      pUnit,
      pResolvedRoom,
      nTargetX,
      nTargetY,
    ) === 0
  ) {
    return 0
  }
  if (m.u32(pUnit) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pClient = m.u32((pPlayerData + 0x9c) >>> 0)
    withW10B1Stack(m, 0x20, (pRoomCoords) => {
      DUNGEON_GetRoomCoordinates113c(m, pResolvedRoom, pRoomCoords)
      const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pResolvedRoom)
      NET_SendPacket07_RoomTileCoords_6FCABF50_113c(
        m,
        m.u32((pRoomCoords + 0x10) >>> 0),
        m.u32((pRoomCoords + 0x14) >>> 0),
        pClient,
        nLevelId,
      )
    })
    UNITROOM_RefreshUnit113c(m, pUnit)
    const uAddFlag = bUseFlag800 !== 0 ? 0x800 : 0x10000
    m.setU32((pUnit + 0xc8) >>> 0, (m.u32((pUnit + 0xc8) >>> 0) | uAddFlag) >>> 0)
    SUNIT_UpdateUnitPositionAndRoom113c(m, 0, pUnit, pGame)
    const pPlayerData2 = UNITS_GetPlayerData113c(m, pUnit)
    const nHistIdx = m.u8((pPlayerData2 + 0xa0) >>> 0)
    m.setU32((pPlayerData2 + 0x148) >>> 0, nTargetX >>> 0)
    m.setU32((pPlayerData2 + 0x14c) >>> 0, nTargetY >>> 0)
    const dwTickCount = m.u32(0x6fd18d10)
    m.setU32((pPlayerData2 + 0xa4) >>> 0, dwTickCount)
    m.setU32((pPlayerData2 + nHistIdx * 8 + 0xa8) >>> 0, nTargetX >>> 0)
    m.setU32((pPlayerData2 + nHistIdx * 8 + 0xac) >>> 0, nTargetY >>> 0)
    const nNextIdx = (nHistIdx + 1) & 0xff
    m.setU8((pPlayerData2 + 0xa0) >>> 0, nNextIdx < 0x14 ? nNextIdx : 0)
    const nTriggerFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x32) >>> 0
    const pfnHistCb =
      typeof SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c === 'function' ? 0x6fd00410 : 0
    EVENT_SetEventFull113c(m, pGame, pUnit, 0xe, nTriggerFrame, pfnHistCb, 0, 0)
    PETS_WarpOrUnsummonPlayerPets_6FCB7340_113c(m, pGame, pUnit, nTargetX, nTargetY)
    return 1
  }
  UNITROOM_RefreshUnit113c(m, pUnit)
  const uAddFlag = bUseFlag800 !== 0 ? 0x800 : 0x10000
  m.setU32((pUnit + 0xc8) >>> 0, (m.u32((pUnit + 0xc8) >>> 0) | uAddFlag) >>> 0)
  SUNIT_UpdateUnitPositionAndRoom113c(m, 0, pUnit, pGame)
  return 1
}

/**
 * @dll D2Game.dll
 * @va 0x6FD11130
 * @ordinalOrName D2Game_6FD11130
 */
export function PARTY_SetOrClearPlayerHostility_6FD11130_113c(
  m: SparseMemory113c,
  pGame: number,
  pSourcePlayer: number,
  pTargetPlayer: number,
  bDeclareHostility: number,
  pOutError: number,
): void {
  hitD2GameVa113c(0x6FD11130)
  const pSourceRoom = UNITS_GetRoom113c(m, pSourcePlayer)
  if (
    pSourceRoom === 0 ||
    DUNGEON_CheckRoomIsTownMemPort113c(m, pSourceRoom) === 0 ||
    STATLIST_GetUnitBaseStat113c(m, pSourcePlayer, 0xc, 0) < 9 ||
    STATLIST_GetUnitBaseStat113c(m, pTargetPlayer, 0xc, 0) < 9
  ) {
    if (pOutError !== 0) {
      m.setU32(pOutError, 1)
    }
    return
  }

  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, pTargetPlayer, pSourcePlayer, pGame)
  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, pSourcePlayer, pTargetPlayer, pGame)

  const bIsHostile = PARTY_TestPlayerRelationFlags113c(m, pSourcePlayer, pTargetPlayer, 8)
  if (bIsHostile !== bDeclareHostility) {
    const bCheckHostile = PARTY_TestPlayerRelationFlags113c(
      m,
      pSourcePlayer,
      pTargetPlayer,
      8,
    )
    if (
      bCheckHostile === 0 &&
      (STATLIST_GetUnitStat113c(m, pTargetPlayer, 0xc, 0) | 0) < 9
    ) {
      return
    }
    if (bDeclareHostility === 0) {
      PARTY_ClearHostilityFlag08_6FD14210_113c(m, pTargetPlayer, pGame, pSourcePlayer)
      const dwSourceGuid =
        pSourcePlayer !== 0 ? m.u32((pSourcePlayer + 0xc) >>> 0) : 0xffffffff
      const pTargetClient =
        pTargetPlayer !== 0 && m.u32(pTargetPlayer) === 0
          ? m.u32((UNITS_GetPlayerData113c(m, pTargetPlayer) + 0x9c) >>> 0)
          : 0
      NET_SendPacket5A_PartyRelationEvent_6FD10720_113c(m, dwSourceGuid, pTargetClient, 4)
      return
    }
    const dwExpireTick = PARTY_GetHostileCooldownTick113c(m, pSourcePlayer, pTargetPlayer)
    const rawTick = m.u32(0x6fd18d10) >>> 0
    const dwNowTick = rawTick === 0x000fe2f2 ? 0 : rawTick
    if ((dwExpireTick >>> 0) <= (dwNowTick >>> 0)) {
      const dwNewExpire = (dwNowTick + 0xea60) >>> 0
      PLAYERLIST_SetHostileDelayTick_6FD10090_113c(m, pTargetPlayer, pSourcePlayer, dwNewExpire)
      PARTY_DeclareHostilityBetweenPlayers_6FD10FF0_113c(
        m,
        pTargetPlayer,
        pSourcePlayer,
        pGame,
      )
      PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c(m, pSourcePlayer, pGame)
      const wSourceParty = SUNITDMG_GetPlayerClientClassId113c(m, pSourcePlayer) & 0xffff
      if (wSourceParty !== 0xffff) {
        const wTargetParty = SUNITDMG_GetPlayerClientClassId113c(m, pTargetPlayer) & 0xffff
        if (wSourceParty === wTargetParty) {
          PARTY_NotifySubPartyAndLeaveParty_6FD110F0_113c(
            m,
            pGame,
            pSourcePlayer,
            0,
            0,
            0,
          )
        }
      }
      return
    }
    SUNIT_SetUnitEventSound113c(
      m,
      pSourcePlayer,
      0x13,
      pSourcePlayer,
    )
    NET_SendEventMessagePacket5A_6FC90BF0_113c(m, 0, 0x10, pSourcePlayer)
  }

  PARTY_BroadcastPacket8CRelationFlags_6FD105B0_113c(m, pTargetPlayer, pSourcePlayer, pGame)
  PARTY_BroadcastPacket8CRelationFlags_6FD105B0_113c(m, pSourcePlayer, pTargetPlayer, pGame)
}
