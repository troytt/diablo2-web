/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 8 Batch 1 (`w8b1`) routines across
 * `0x6FC2C1B0..0x6FC855F0` (30 functions).
 */

import { UNITS_GetPlayerData113c } from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import {
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_ToggleHasPortalFlag113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32, sdiv32 } from '../common/int-math'
import {
  INVENTORY_GetBeltItem113c,
  INVENTORY_GetCursorItem113c,
} from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_GetBaseCode113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../common/items'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
} from '../common/k0-d2common-memports'
import { MISSILE_SetTargetX113c } from '../common/missile'
import {
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_SetCollisionMask113c,
} from '../common/path'
import {
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_ClearQuestStateBits2To11_113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record'
import { SKILLS_EvalCalcByOffset113c } from '../common/skills'
import {
  STATES_CheckState113c,
  STATLIST_AddUnitStat113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
} from '../common/statlist'
import { UNITS_GetRoom113c } from '../common/unit'
import {
  WAYPOINT_GetWaypointNoFromLevelId113c,
  WAYPOINT_GetWaypointState113c,
} from '../common/waypoint'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory'
import { QUESTS_GuidListRemove113c } from './a1c-post150-f150-f276-113c'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c'
import {
  ITEMS_DropGoldPileAtUnit113c,
  MONSTER_StartMode113c,
} from './combat-a1c-113c'
import {
  GAME_AllocGameStrc113c,
  GAME_InitSeed113c,
  SUNIT_GetServerUnit113c,
} from './game-strc'
import { STATES_CreateOrUpdateAuraStatList113c } from './k2-gap-itemdef-113c'
import { SKILLS_ResolveChargedSrvMissileId113c } from './k2-gap-melee-dot-113c'
import {
  QUESTS_GuidListAdd113c,
  QUESTS_SendPlayerQuestLogPacket28_113c,
} from './k2-items-tc-w1-113c'
import { PLAYER_GetQuestRecordForDifficulty_6FC21020_113c } from './k2-laneH-0x6fc2-w1-113c'
import { ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c } from './k2-laneI-0x6fc3-w1-113c'
import {
  GAME_CommitGlobalGameSlot_6FC4A2D0_113c,
  GAME_ReserveGlobalGameSlot_6FC4A220_113c,
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
  QUESTS_GetQuestData_6FC53F30_113c,
  QUESTS_SetGlobalQuestState_6FC53920_113c,
} from './k2-laneJ-0x6fc4-w1-113c'
import {
  CLIENTS_FreeSaveDataBuffer_6FC69630_113c,
  CLIENTS_GetSaveDataPtr_6FC69790_113c,
  CLIENTS_GetSaveDataSize_6FC69760_113c,
  CLIENTS_SetClientFlag20_6FC69580_113c,
  CLIENTS_StoreSaveDataBuffer_6FC696B0_113c,
  SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c,
} from './k2-laneL-0x6fc6-w1-113c'
import { ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c } from './k2-laneM-0x6fc7-w1-113c'
import { SKILLS_DivideValueByMonLvlHp113c } from './k2-sunit-spawn-w1-113c'
import {
  ACT5Q3_SendQuest21State20Packet5D_6FC79180_113c,
  STORM_TSHashTableAllocUniqueKey_6FC22060_113c,
} from './k2-w2b1-113c'
import { PARTY_AllocPartyControl_6FCBBE40_113c } from './k2-w2b4-113c'
import { ARENA_AllocGameArenaCtrl_6FCD2560_113c } from './k2-w2b5-113c'
import { AI_StartModeAtCoordsKeepSteps_6FD121E0_113c } from './k2-w2b8-113c'
import {
  ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c,
  OBJRGN_AllocObjectControl_6FC2B9A0_113c,
} from './k2-w3b1-113c'
import {
  QUESTS_AllocAndInitGameQuests_6FC548A0_113c,
  QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c,
} from './k2-w3b3-113c'
import { CLIENTS_AllocAndLinkClient_6FC6A9B0_113c } from './k2-w3b4-113c'
import {
  ACT5Q1_SeqFilter_6FC76D10_113c,
  ACT5Q1_SyncPlayerQuestStateWithQuest1F_6FC78890_113c,
  ACT5Q6_SeqFilter_6FC767A0_113c,
  GAMETIME_QueueTaskNodeToWorkerList_6FC72390_113c,
  PLAYERSAVE_ComputeHeaderChecksum_6FC73170_113c,
} from './k2-w3b5-113c'
import {
  ACT1Q1_UpdatePlayerQuestStateCallback_6FC82370_113c,
  ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c,
  ACT1Q6_UpdatePlayerQuestStateCallback_6FC80D00_113c,
  ACT5Q5_DeactivateAncientStatuesAndReset_6FC7E560_113c,
  QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c,
  QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c,
} from './k2-w3b6-113c'
import {
  ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c,
  ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c,
  ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c,
  ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c,
  CLIENTS_AppendSaveDataChunk_6FC6A190_113c,
} from './k2-w4b2-113c'
import { GAME_AssignUniqueGameName_6FC4BC90_113c } from './k2-w4b3-113c'
import { SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c } from './k2-w4b6-113c'
import { CLIENTS_SendHandshakeAndSetInitState1_6FC4AC60_113c } from './k2-w5b1-113c'
import { AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c } from './k2-w5b3-113c'
import { ACT2Q6_SendBossTombSymbolPacket50_6FCE4B10_113c } from './k2-w5b5-113c'
import { NPCS_InitGameNpcControl_6FCAFBE0_113c } from './k2-w5b6-113c'
import {
  ITEMS_CompactBeltColumnDown_6FCF2540_113c,
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c,
} from './k2-w5b7-113c'
import { SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c } from './k2-w5b9-113c'
import { SKILLS_CanConvertOrMindBlastTarget_6FC6EE80_113c } from './k2-w6b1-113c'
import { NET_BroadcastSystemChatMessage_6FCEBE70_113c } from './k2-w6b3-113c'
import { ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c } from './k2-w6b6-113c'
import {
  ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c,
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c as W7_SetQuestStateAndDebugPrint_6FC55EB0_113c,
  QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c as W7_GrantAncientsExperienceAndSendQuestLog_6FC7BF70_113c,
  SKILLS_ApplyTerrorOrConfusionCallback_6FC70DB0_113c as W7_ApplyAttractorCurseCallback_6FC70DB0_113c,
  SKILLS_SpawnSpreadProjectilesAtTargetOrPath_6FC654E0_113c,
  SKILLS_StartOrUpdateDelayedChannelSkillState_6FC643F0_113c,
  STORM_TSHashTableInsertOrCreateNode_6FC22090_113c,
} from './k2-w7b1-113c'
import {
  ACT1Q3_ActivateQuestState1_6FC83D20_113c,
  ACT1Q3_PromoteQuestState3AndResetMalusStand_6FC84C10_113c,
  ACT1Q4_PromoteQuestState3AndUpdatePlayers_6FC84940_113c,
  ACT1Q4_SendScrollOfInifussOrderPacket50_6FC847B0_113c,
  ACT5Q2_SpawnNihlathakPortalFromQuestData_6FC7D380_113c,
  ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c,
} from './k2-w7b2-113c'
import {
  MONSTER_ReactivateOrResurrectInRoom_6FCD33B0_113c as W7_ResurrectMonsterUnit_6FCD33B0_113c,
  NPC_OnHealerNpcInteract_6FCDD810_113c,
  PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c,
  PORTAL_SpawnLinkedPortalPair_6FCC24C0_113c,
} from './k2-w7b3-113c'
import {
  ACT3Q5_OnKhalimWillSmashedCompellingOrb_6FD073C0_113c as W7_OnAct4ToAct5PortalEntered_6FD073C0_113c,
  MONREG_InitGameMonsterRegionsFromGameSeed_6FCEACC0_113c as W7_InitGameMonsterRegions_6FCEACC0_113c,
  PLAYERSAVE_WriteSaveFileBuffer_6FD0C7F0_113c as W7_WritePlayerSaveData_6FD0C7F0_113c,
} from './k2-w7b4-113c'
import { ITEMS_FindFreeGroundDropCoords_6FC2E930_113c } from './k2-real-itemdrop-113c'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  SUNIT_SetMonsterAlignmentState113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
} from './regpop-spawn-113c'
import { EVENT_InitTimerQueue113c, EVENT_SetEventFull113c } from './timer-wheel'
import { hitD2GameVa113c } from '../va-trace-113c'

export type D2KernMemory113c = SparseMemory113c

function W7_CastInfernoOrArcticBlastChannel_6FC643F0_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  nMissileId: number,
): number {
  return SKILLS_StartOrUpdateDelayedChannelSkillState_6FC643F0_113c(
    m,
    pUnit,
    pGame,
    nSkillId,
    nSkillLevel,
    nMissileId,
  )
}

function W7_SpawnMultipleSpreadMissiles_6FC654E0_113c(
  m: SparseMemory113c,
  bSpawnFirstDirect: number,
  nSkillLevel: number,
  pUnit: number,
  pGame: number,
  nCount: number,
  nMissileId: number,
  nSkillId: number,
): number {
  return SKILLS_SpawnSpreadProjectilesAtTargetOrPath_6FC654E0_113c(
    m,
    pGame,
    pUnit,
    nSkillId,
    nSkillLevel,
    nMissileId,
    nCount,
    bSpawnFirstDirect,
  )
}

function W7_ProcessSpecialMonsterSpawn_6FCDD810_113c(
  m: SparseMemory113c,
  pNpcUnit: number,
  pGame: number,
  pPlayer: number,
): void {
  NPC_OnHealerNpcInteract_6FCDD810_113c(m, pNpcUnit, pPlayer, pGame)
}

let k2W8B1StackPtr = 0x7e700000

function allocScratch(size: number): number {
  const aligned = (size + 7) & ~7
  k2W8B1StackPtr = (k2W8B1StackPtr - aligned) >>> 0
  return k2W8B1StackPtr
}

function freeScratch(size: number): void {
  const aligned = (size + 7) & ~7
  k2W8B1StackPtr = (k2W8B1StackPtr + aligned) >>> 0
}

function sstrCopyBounded(
  m: SparseMemory113c,
  pDest: number,
  pSrc: number,
  maxBytes: number,
): void {
  const dst = pDest >>> 0
  const src = pSrc >>> 0
  if (dst === 0 || maxBytes <= 0) return
  if (src === 0) {
    m.setU8(dst, 0)
    return
  }
  let i = 0
  while (i < maxBytes - 1) {
    const ch = m.u8((src + i) >>> 0)
    m.setU8((dst + i) >>> 0, ch)
    if (ch === 0) return
    i++
  }
  m.setU8((dst + maxBytes - 1) >>> 0, 0)
}

/**
 * [1/30] Resurrects a monster unit (`dwUnitType == 1`), clears dead/corpse flags (`+0xC4 &= ~0x0E`),
 * and resets its dynamic path collision mask to `0x100`.
 *
 * @dll D2Game.dll
 * @va 0x6FC2C1B0
 * @ordinalOrName D2Game_6FC2C1B0
 */
export function SKILLS_SrvDo_ResurrectMonsterAndSetCollisionMask_6FC2C1B0_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FC2C1B0)
  const unit = pUnit >>> 0
  const game = pGame >>> 0
  if (unit === 0 || (m.u32(unit) | 0) !== 1) {
    return 0
  }
  W7_ResurrectMonsterUnit_6FCD33B0_113c(m, game, unit)
  m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) & 0xfffffff1) >>> 0)
  const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0
  PATH_SetCollisionMask113c(m, pPath, 0x100)
  return 1
}

/**
 * [2/30] Timer event `7` handler that kills/unsummons a player or monster unit
 * (`eMode = 0`, `nVelocityPct = 100`), rescheduling `+3` frames if state `0x36` is active.
 *
 * @dll D2Game.dll
 * @va 0x6FC43440
 * @ordinalOrName D2Game_6FC43440
 */
export function MONUMOD_Event07_KillOrUnsummonUnit_6FC43440_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  _arg0 = 0,
  _arg1 = 0,
): void {
  hitD2GameVa113c(0x6FC43440)
  void AI_StartModeAtCoordsKeepSteps_6FD121E0_113c
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  if (unit === 0) return
  if ((m.u8((unit + 0xc6) >>> 0) & 1) !== 0) return

  const unitType = m.u32(unit) | 0
  if (unitType === 0) {
    const mode = m.u32((unit + 0x10) >>> 0) | 0
    if (mode === 0 || mode === 0x11) return
  } else if (unitType === 1) {
    const mode = m.u32((unit + 0x10) >>> 0) | 0
    if (mode === 0 || mode === 0x0c) return
  } else {
    return
  }

  if ((STATES_CheckState113c(m, unit, 0x36) | 0) !== 0) {
    const targetFrame = (m.u32((game + 0xa8) >>> 0) + 3) >>> 0
    EVENT_SetEventFull113c(m, game, unit, 7, targetFrame, 0, 0, 0)
    return
  }

  if ((m.u32(unit) | 0) === 1) {
    const pMonsterData = m.u32((unit + 0x14) >>> 0) >>> 0
    if (pMonsterData !== 0) {
      const pAiGeneral = m.u32((pMonsterData + 0x28) >>> 0) >>> 0
      if (pAiGeneral !== 0) {
        const pOwnerGame = m.u32((pAiGeneral + 0x28) >>> 0) >>> 0
        if (pOwnerGame !== 0) {
          const dwOwnerGuid = m.u32((pAiGeneral + 0x2c) >>> 0) >>> 0
          const nOwnerType = m.u32((pAiGeneral + 0x30) >>> 0) | 0
          const pOwner = SUNIT_GetServerUnit113c(
            m,
            pOwnerGame,
            nOwnerType,
            dwOwnerGuid,
          ) >>> 0
          if (pOwner !== 0 && (m.u32(pOwner) | 0) === 0) {
            const dwPetGuid = m.u32((unit + 0x0c) >>> 0) >>> 0
            PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c(
              m,
              game,
              pOwner,
              dwPetGuid,
              1,
            )
            return
          }
        }
      }
    }
  }

  SKILLS_SetUsedSkillMemPort113c(m, unit, 0)
  MONSTER_StartMode113c(m, game, unit, 0, 0, 0, 0)
  if ((m.u32(unit) | 0) === 0) {
    m.setU32((unit + 0x10) >>> 0, 0)
  }
}

/**
 * [3/30] Monster unique modifier callback that steals/knocks a belt item from a target player
 * onto the ground (`70%` roll when `seed % 100 >= 30`).
 *
 * @dll D2Game.dll
 * @va 0x6FC44440
 * @ordinalOrName D2Game_6FC44440
 */
export function MONUMOD_KnockBeltPotionToGround_6FC44440_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  _nUMod = 0,
  bUnique = 0,
): void {
  hitD2GameVa113c(0x6FC44440)
  void ITEMS_DropGoldPileAtUnit113c
  if (bUnique === 0) return
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const lo = BigInt(m.u32((unit + 0x20) >>> 0) >>> 0)
  const hi = BigInt(m.u32((unit + 0x24) >>> 0) >>> 0)
  const full = lo * 0x6ac690c5n + hi
  const newLo = Number(full & 0xffffffffn) >>> 0
  const newHi = Number((full >> 32n) & 0xffffffffn) >>> 0
  m.setU32((unit + 0x24) >>> 0, newHi)
  m.setU32((unit + 0x20) >>> 0, newLo)
  if ((newLo >>> 0) % 100 < 0x1e) return

  SUNIT_ValidatePathTargetUnit113c(m, unit, game)
  const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === unit || pTarget === 0 || (m.u32(pTarget) | 0) !== 0) return

  const pInventory = m.u32((pTarget + 0x60) >>> 0) >>> 0
  let pBeltItem = 0
  for (let slot = 0; slot < 0x10; slot++) {
    pBeltItem = INVENTORY_GetBeltItem113c(m, pInventory, slot) >>> 0
    if (pBeltItem !== 0) break
  }
  if (pBeltItem === 0) return
  if ((m.u32(pBeltItem) | 0) !== 4) return
  if ((m.u32((pBeltItem + 0x10) >>> 0) | 0) !== 2) return
  if ((INVENTORY_GetCursorItem113c(m, pInventory) >>> 0) !== 0) return

  const pDupItem = ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(
    m,
    game,
    pBeltItem,
    1,
  ) >>> 0
  const sp = allocScratch(0x18)
  try {
    const pInCoords = (sp + 0x08) >>> 0
    const pOutCoords = sp
    PATH_GetTargetTypeAndPosition113c(m, pTarget, pInCoords)
    const pRoom = UNITS_GetRoom113c(m, pTarget) >>> 0
    const pDropRoom = ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(
      m,
      pRoom,
      pInCoords,
      pOutCoords,
      1,
    ) >>> 0
    if (pDropRoom === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 2762)
    }
    ITEMS_SetOrClearCommandFlags113c(m, pDupItem, 0x2000, 1)
    const outX = m.u32(pOutCoords) | 0
    const outY = m.u32((pOutCoords + 0x04) >>> 0) | 0
    ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c(
      m,
      outY,
      pDupItem,
      pDropRoom,
      game,
      pTarget,
      outX,
    )
    const nBeltSlot = UNIT_GetPosX113c(m, pBeltItem) | 0
    ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c(m, pBeltItem, pTarget, game)
    ITEMS_CompactBeltColumnDown_6FCF2540_113c(m, nBeltSlot, pTarget)
  } finally {
    freeScratch(0x18)
  }
}

/**
 * [4/30] Allocates and initializes a single-player or TCP/IP `D2GameStrc` in `gpGameHashTable`
 * (`0x6FD31C24`), links its initial client, and queues its worker task node.
 *
 * @dll D2Game.dll
 * @va 0x6FC4C2D0
 * @ordinalOrName D2Game_6FC4C2D0
 */
export function GAME_CreateSinglePlayerOrTcpIpGame_6FC4C2D0_113c(
  m: SparseMemory113c,
  dwArenaFlags: number,
  dwClientId: number,
  szGameName: number,
  bGameType: number,
  bCharClass: number,
  szCharName: number,
  _arg5 = 0,
  bTemplate: number = 0,
  nDifficulty: number = 0,
  bLocaleId: number = 0,
  _arg9 = 0,
  _arg10 = 0,
  onInitGameData34?: (m: SparseMemory113c, nZero: number) => number,
): void {
  hitD2GameVa113c(0x6FC4C2D0)
  void GAME_AllocGameStrc113c
  void ACT5Q3_SendQuest21State20Packet5D_6FC79180_113c
  const pHashTable = m.u32(0x6fd31c24) >>> 0
  if (pHashTable === 0) return

  const dwHashKey = STORM_TSHashTableAllocUniqueKey_6FC22060_113c(m, pHashTable) >>> 0
  const pGame = STORM_TSHashTableInsertOrCreateNode_6FC22090_113c(
    m,
    pHashTable,
    dwHashKey,
    0,
    0,
  ) >>> 0
  if (pGame === 0) return

  const pLock = m.alloc(0x18)
  m.setU32((pGame + 0x18) >>> 0, pLock)
  m.setU32((pGame + 0x1c) >>> 0, 0)
  for (let i = 0; i < 0x80; i++) {
    m.setU32((pGame + 0x1120 + (i << 2)) >>> 0, 0)
    m.setU32((pGame + 0x1320 + (i << 2)) >>> 0, 0)
    m.setU32((pGame + 0x1520 + (i << 2)) >>> 0, 0)
    m.setU32((pGame + 0x1720 + (i << 2)) >>> 0, 0)
    m.setU32((pGame + 0x1920 + (i << 2)) >>> 0, 0)
    m.setU32((pGame + 0x1b24 + (i << 2)) >>> 0, 0)
  }
  m.setU32((pGame + 0x24) >>> 0, 1)
  const wSlot = GAME_ReserveGlobalGameSlot_6FC4A220_113c(m) & 0xffff
  m.setU16((pGame + 0x28) >>> 0, wSlot)
  GAME_AssignUniqueGameName_6FC4BC90_113c(m, pGame, szGameName >>> 0)

  m.setU8((pGame + 0x6a) >>> 0, bGameType & 0xff)
  for (let off = 0x90; off <= 0xa4; off += 4) {
    m.setU32((pGame + off) >>> 0, 0)
  }
  m.setU8((pGame + 0x6d) >>> 0, nDifficulty & 0xff)
  m.setU8((pGame + 0x6b) >>> 0, bTemplate & 0xff)
  const bExpansion = (dwArenaFlags & 0x100000) !== 0 ? 1 : 0
  m.setU32((pGame + 0x70) >>> 0, bExpansion)
  const wItemFormat = bExpansion !== 0 ? 0x65 : 2
  const dwLadder = (dwArenaFlags >>> 0x15) & 1
  m.setU16((pGame + 0x78) >>> 0, wItemFormat)
  m.setU32((pGame + 0x74) >>> 0, dwLadder)

  GAME_InitSeed113c(m, pGame)
  EVENT_InitTimerQueue113c(m, pGame)
  ARENA_AllocGameArenaCtrl_6FCD2560_113c(
    m,
    pGame,
    dwArenaFlags >>> 0,
    bTemplate & 0xff,
  )
  m.setU32((pGame + 0x8c) >>> 0, 0)
  m.setU32((pGame + 0x88) >>> 0, 0)
  const pCallbackTbl = m.u32(0x6fd31c3c) >>> 0
  if (pCallbackTbl !== 0) {
    const pfnInitGameData = m.u32((pCallbackTbl + 0x34) >>> 0) >>> 0
    if (pfnInitGameData !== 0) {
      const dwInitResult =
        onInitGameData34 !== undefined
          ? onInitGameData34(m, 0) >>> 0
          : pfnInitGameData
      m.setU32((pGame + 0x20) >>> 0, dwInitResult)
    }
  }

  const pClient = CLIENTS_AllocAndLinkClient_6FC6A9B0_113c(
    m,
    dwClientId >>> 0,
    pGame,
    bCharClass & 0xff,
    szCharName >>> 0,
    0,
    0,
    bLocaleId & 0xff,
  ) >>> 0
  if (m.u8((pGame + 0x6a) >>> 0) === 1) {
    CLIENTS_SetClientFlag20_6FC69580_113c(m, pClient)
  }
  PARTY_AllocPartyControl_6FCBBE40_113c(m, pGame)
  W7_InitGameMonsterRegions_6FCEACC0_113c(m, pGame)
  m.setU32((pGame + 0x80) >>> 0, OBJRGN_AllocObjectControl_6FC2B9A0_113c(m, pGame) >>> 0)
  NPCS_InitGameNpcControl_6FCAFBE0_113c(m, pGame)
  QUESTS_AllocAndInitGameQuests_6FC548A0_113c(m, pGame)
  GAME_CommitGlobalGameSlot_6FC4A2D0_113c(m, dwHashKey, m.u16((pGame + 0x28) >>> 0))
  CLIENTS_SendHandshakeAndSetInitState1_6FC4AC60_113c(m, pClient, pGame)

  if (pClient === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 2006)
  }
  const bInitVer = m.u8(0x6fd31c30) & 0xff
  if (bInitVer >= 5) {
    throw new D2CommonAssertError('0x6fd19ff9', 2007)
  }
  m.setU8((pClient + 0x1ac) >>> 0, bInitVer)
  // Fog.#10055 (0x6fc2a2f2 thunk) returns elapsed epoch seconds; clamped to >= 2.
  m.setU32((pGame + 0x1dc4) >>> 0, 2)
  const pTaskNode = m.alloc(0x14)
  GAMETIME_QueueTaskNodeToWorkerList_6FC72390_113c(m, pTaskNode, 0, dwHashKey)
  if (pCallbackTbl !== 0 && m.u32((pCallbackTbl + 0x08) >>> 0) !== 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 1323)
  }
  const sp = allocScratch(8)
  try {
    m.setU8(sp, 0x02)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 1)
  } finally {
    freeScratch(8)
  }
}

/**
 * [5/30] Allocates and initializes a multi-client realm `D2GameStrc` in `gpGameHashTable`
 * (`0x6FD31C24`), populates name/password/description, and writes out its 16-bit slot ID.
 *
 * @dll D2Game.dll
 * @va 0x6FC4C570
 * @ordinalOrName D2Game_6FC4C570
 */
export function GAME_CreateMultiClientGame_6FC4C570_113c(
  m: SparseMemory113c,
  szGameName: number,
  szGamePass: number,
  szGameDesc: number,
  dwArenaFlags: number,
  bTemplate: number,
  bUnk6C: number,
  bUnk6E: number,
  pwOutGameSlot: number,
  onInitGameData34?: (m: SparseMemory113c, nZero: number) => number,
): number {
  hitD2GameVa113c(0x6FC4C570)
  void GAME_AllocGameStrc113c
  const pHashTable = m.u32(0x6fd31c24) >>> 0
  if (pHashTable === 0) return 0
  const wSlot = GAME_ReserveGlobalGameSlot_6FC4A220_113c(m) & 0xffff
  if (wSlot === 0) return 0

  const dwHashKey = STORM_TSHashTableAllocUniqueKey_6FC22060_113c(m, pHashTable) >>> 0
  const pGame = STORM_TSHashTableInsertOrCreateNode_6FC22090_113c(
    m,
    pHashTable,
    dwHashKey,
    0,
    0,
  ) >>> 0
  if (pGame === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 786)
  }

  m.setU32((pGame + 0x18) >>> 0, m.alloc(0x18))
  m.setU32((pGame + 0x1c) >>> 0, m.alloc(0x40))
  for (let i = 0; i < 0x80; i++) {
    m.setU32((pGame + 0x1120 + (i << 2)) >>> 0, 0)
    m.setU32((pGame + 0x1320 + (i << 2)) >>> 0, 0)
    m.setU32((pGame + 0x1520 + (i << 2)) >>> 0, 0)
    m.setU32((pGame + 0x1720 + (i << 2)) >>> 0, 0)
    m.setU32((pGame + 0x1920 + (i << 2)) >>> 0, 0)
    m.setU32((pGame + 0x1b24 + (i << 2)) >>> 0, 0)
  }
  m.setU16((pGame + 0x28) >>> 0, wSlot)
  m.setU32((pGame + 0x24) >>> 0, 1)
  GAME_AssignUniqueGameName_6FC4BC90_113c(m, pGame, szGameName >>> 0)
  sstrCopyBounded(m, (pGame + 0x3a) >>> 0, szGamePass >>> 0, 0x10)
  sstrCopyBounded(m, (pGame + 0x4a) >>> 0, szGameDesc >>> 0, 0x20)

  m.setU8((pGame + 0x6c) >>> 0, bUnk6C & 0xff)
  m.setU8((pGame + 0x6b) >>> 0, bTemplate & 0xff)
  m.setU8((pGame + 0x6e) >>> 0, bUnk6E & 0xff)
  const bExpansion = (dwArenaFlags & 0x100000) !== 0 ? 1 : 0
  m.setU32((pGame + 0x70) >>> 0, bExpansion)
  const wItemFormat = bExpansion !== 0 ? 0x65 : 2
  const dwLadder = (dwArenaFlags >>> 0x15) & 1
  const nDifficulty = (dwArenaFlags >>> 0x0c) & 7
  m.setU16((pGame + 0x78) >>> 0, wItemFormat)
  m.setU32((pGame + 0x74) >>> 0, dwLadder)
  for (let off = 0x90; off <= 0xa4; off += 4) {
    m.setU32((pGame + off) >>> 0, 0)
  }
  for (let off = 0x1dd4; off <= 0x1df0; off += 4) {
    m.setU32((pGame + off) >>> 0, 0)
  }
  m.setU8((pGame + 0x6d) >>> 0, nDifficulty)

  GAME_InitSeed113c(m, pGame)
  EVENT_InitTimerQueue113c(m, pGame)
  ARENA_AllocGameArenaCtrl_6FCD2560_113c(m, pGame, dwArenaFlags >>> 0, 0)
  m.setU32((pGame + 0x8c) >>> 0, 0)
  m.setU32((pGame + 0x88) >>> 0, 0)
  const pCallbackTbl = m.u32(0x6fd31c3c) >>> 0
  if (pCallbackTbl !== 0) {
    const pfnInitGameData = m.u32((pCallbackTbl + 0x34) >>> 0) >>> 0
    if (pfnInitGameData !== 0) {
      const dwInitResult =
        onInitGameData34 !== undefined
          ? onInitGameData34(m, 0) >>> 0
          : pfnInitGameData
      m.setU32((pGame + 0x20) >>> 0, dwInitResult)
    }
  }
  PARTY_AllocPartyControl_6FCBBE40_113c(m, pGame)
  W7_InitGameMonsterRegions_6FCEACC0_113c(m, pGame)
  m.setU32((pGame + 0x80) >>> 0, OBJRGN_AllocObjectControl_6FC2B9A0_113c(m, pGame) >>> 0)
  NPCS_InitGameNpcControl_6FCAFBE0_113c(m, pGame)
  QUESTS_AllocAndInitGameQuests_6FC548A0_113c(m, pGame)
  GAME_CommitGlobalGameSlot_6FC4A2D0_113c(m, dwHashKey, wSlot)
  // Fog.#10055 (0x6fc2a2f2 thunk) returns elapsed epoch seconds; clamped to >= 2.
  m.setU32((pGame + 0x1dc4) >>> 0, 2)
  const pTaskNode = m.alloc(0x14)
  GAMETIME_QueueTaskNodeToWorkerList_6FC72390_113c(m, pTaskNode, 0, dwHashKey)
  m.setU32((pGame + 0x1dbc) >>> 0, m.u32(0x6fd18d10) >>> 0)
  if (pwOutGameSlot !== 0) {
    m.setU16(pwOutGameSlot >>> 0, m.u16((pGame + 0x28) >>> 0))
  }
  return 1
}

/**
 * [6/30] Triggers Act 4 to Act 5 portal transition handling (`0x6FD073C0`) when `pPlayerUnit`
 * is in a room whose level ID is `< 0x6C` (`108`).
 *
 * @dll D2Game.dll
 * @va 0x6FC56050
 * @ordinalOrName D2Game_6FC56050
 */
export function QUESTS_TriggerAct5PortalTransitionIfBelowLevel108_6FC56050_113c(
  m: SparseMemory113c,
  pPlayerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC56050)
  const player = pPlayerUnit >>> 0
  const pRoom = UNITS_GetRoom113c(m, player) >>> 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId < 0x6c) {
    W7_OnAct4ToAct5PortalEntered_6FD073C0_113c(m, pGame >>> 0, player)
  }
}

/**
 * [7/30] Handles using a quest scroll item (`'bkd '` Scroll of Inifuss or `'trs '` Horadric Scroll)
 * from `pPlayerUnit`'s inventory or cursor by sending packet `0x50`.
 *
 * @dll D2Game.dll
 * @va 0x6FC56070
 * @ordinalOrName D2Game_6FC56070
 */
export function QUESTS_UseQuestScrollItem_6FC56070_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  dwItemGuid: number,
): void {
  hitD2GameVa113c(0x6FC56070)
  const game = pGame >>> 0
  const player = pPlayerUnit >>> 0
  const itemGuid = dwItemGuid >>> 0
  if (game === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 723)
  }

  const bucket = itemGuid & 0x7f
  let pItem = m.u32((game + 0x1720 + (bucket << 2)) >>> 0) >>> 0
  while (pItem !== 0) {
    if ((m.u32((pItem + 0x0c) >>> 0) >>> 0) === itemGuid) break
    pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0
  }
  if (pItem === 0) return

  if (
    (ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(m, player, pItem, 0) |
      0) ===
    0
  ) {
    return
  }

  const dwClassId = m.u32((pItem + 0x04) >>> 0) | 0
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, dwClassId) >>> 0
  if (pItemsTxt === 0) return

  const dwCode = m.u32((pItemsTxt + 0x80) >>> 0) >>> 0
  if (dwCode === 0x20646b62) {
    ACT1Q4_SendScrollOfInifussOrderPacket50_6FC847B0_113c(m, game, player)
    return
  }
  if (dwCode === 0x20737274) {
    ACT2Q6_SendBossTombSymbolPacket50_6FCE4B10_113c(m, player, game)
  }
}

/**
 * [8/30] Spawns a linked portal pair (`classId = 0x3C`) at `pMissileUnit`'s coordinates
 * leading to `nDestLevelId` and sets the room's portal flag.
 *
 * @dll D2Game.dll
 * @va 0x6FC5BDA0
 * @ordinalOrName D2Game_6FC5BDA0
 */
export function QUESTS_SpawnPortalFromMissileAtCoords_6FC5BDA0_113c(
  m: SparseMemory113c,
  pMissileUnit: number,
  pGame: number,
  nDestLevelId: number,
): void {
  hitD2GameVa113c(0x6FC5BDA0)
  const missile = pMissileUnit >>> 0
  const game = pGame >>> 0
  MISSILE_SetTargetX113c(m, missile, 1)

  let pOwner = 0
  if (missile !== 0) {
    const dwFlagsEx = m.u32((missile + 0xc8) >>> 0) >>> 0
    if (((dwFlagsEx >>> 0x0a) & 1) !== 0) {
      const dwOwnerGuid = m.u32((missile + 0x98) >>> 0) >>> 0
      const nOwnerType = m.u32((missile + 0x94) >>> 0) | 0
      pOwner = SUNIT_GetServerUnit113c(m, game, nOwnerType, dwOwnerGuid) >>> 0
    }
  }

  const unitType = m.u32(missile) | 0
  const pPath = m.u32((missile + 0x2c) >>> 0) >>> 0
  let nY = 0
  if (unitType === 2 || (unitType > 3 && unitType <= 5)) {
    nY = m.u32((pPath + 0x10) >>> 0) | 0
  } else if (pPath !== 0) {
    nY = PATH_GetPosY113c(m, pPath) | 0
  }

  const unitTypeX = m.u32(missile) | 0
  const pPathX = m.u32((missile + 0x2c) >>> 0) >>> 0
  let nX = 0
  if (unitTypeX === 2 || (unitTypeX > 3 && unitTypeX <= 5)) {
    nX = m.u32((pPathX + 0x0c) >>> 0) | 0
  } else if (pPathX !== 0) {
    nX = PATH_GetPosX113c(m, pPathX) | 0
  }

  const pRoom = UNITS_GetRoom113c(m, missile) >>> 0
  PORTAL_SpawnLinkedPortalPair_6FCC24C0_113c(
    m,
    pOwner,
    game,
    pRoom,
    nX,
    nY,
    nDestLevelId | 0,
    0,
    0x3c,
    1,
  )
  const pRoomAfter = UNITS_GetRoom113c(m, missile) >>> 0
  DUNGEON_ToggleHasPortalFlag113c(m, pRoomAfter, 1)
}

/**
 * [9/30] Validates Inferno state (`0x0C`) or minimum start mana (`wStartMana << 8`) and
 * `nSrvMissileA`, then delegates to `0x6FC643F0`.
 *
 * @dll D2Game.dll
 * @va 0x6FC64550
 * @ordinalOrName D2Game_6FC64550
 */
export function SKILLS_SrvSt25_InfernoCheckManaAndStart_6FC64550_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC64550)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  if (skillId < 0) return 0

  const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? (m.u32(pDataTablesPtr) >>> 0) : 0
  if (pDataTables === 0) return 0
  const nSkillsTxtCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (skillId >= nSkillsTxtCount) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  if ((STATES_CheckState113c(m, unit, 0x0c) | 0) === 0) {
    const curMana = STATLIST_GetUnitStat113c(m, unit, 8, 0) | 0
    const wStartMana = (m.u16((pSkillsTxt + 0x184) >>> 0) << 16) >> 16
    if (curMana < (wStartMana << 8)) {
      return 0
    }
  }

  const nSrvMissileA = (m.u16((pSkillsTxt + 0x48) >>> 0) << 16) >> 16
  if (nSrvMissileA < 0) return 0
  const nMissilesTxtCount = m.u32((pDataTables + 0xb6c) >>> 0) | 0
  if (nSrvMissileA >= nMissilesTxtCount) return 0

  return (
    W7_CastInfernoOrArcticBlastChannel_6FC643F0_113c(
      m,
      game,
      unit,
      skillId,
      nSkillLevel | 0,
      nSrvMissileA,
    ) | 0
  )
}

/**
 * [10/30] Resolves charged/default server missile ID (`0x6FCB1340`), evaluates `dwCalc1`
 * (`+0x138`) for projectile count, and spawns spread missiles via `0x6FC654E0`.
 *
 * @dll D2Game.dll
 * @va 0x6FC65600
 * @ordinalOrName D2Game_6FC65600
 */
export function SKILLS_SrvDo035_MultipleShotSpreadMissiles_6FC65600_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC65600)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const skillLvl = nSkillLevel | 0
  if (skillId < 0) return 0

  const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? (m.u32(pDataTablesPtr) >>> 0) : 0
  if (pDataTables === 0) return 0
  const nSkillsTxtCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (skillId >= nSkillsTxtCount) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, skillId, unit) | 0
  if (nMissileId < 0) return 0
  const nMissilesTxtCount = m.u32((pDataTables + 0xb6c) >>> 0) | 0
  if (nMissileId >= nMissilesTxtCount) return 0

  if (unit !== 0) {
    m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
  }

  const dwCalc1 = m.u32((pSkillsTxt + 0x138) >>> 0) >>> 0
  const nCount =
    SKILLS_EvalCalcByOffset113c(m, unit, dwCalc1, skillId, skillLvl) | 0
  if (nCount <= 0) {
    return 0
  }

  return (
    W7_SpawnMultipleSpreadMissiles_6FC654E0_113c(
      m,
      0,
      skillLvl,
      unit,
      game,
      nCount,
      nMissileId,
      skillId,
    ) | 0
  )
}

/**
 * [11/30] Searches a linked list of `(dwUnitGuid, bProcessed, pNext)` nodes for `dwUnitGuid`;
 * if found and `bProcessed == 0`, marks `bProcessed = 1` and invokes `0x6FCDD810`.
 *
 * @dll D2Game.dll
 * @va 0x6FC68B60
 * @ordinalOrName D2Game_6FC68B60
 */
export function MONSTER_MarkSpawnNodeProcessedAndTrigger_6FC68B60_113c(
  m: SparseMemory113c,
  ppListHead: number,
  dwUnitGuid: number,
  pGame: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FC68B60)
  const headPtr = ppListHead >>> 0
  if (headPtr === 0) return
  const targetGuid = dwUnitGuid >>> 0
  let pNode = m.u32(headPtr) >>> 0
  while (pNode !== 0) {
    if ((m.u32(pNode) >>> 0) === targetGuid) {
      if (m.u32((pNode + 0x04) >>> 0) === 0) {
        m.setU32((pNode + 0x04) >>> 0, 1)
        W7_ProcessSpecialMonsterSpawn_6FCDD810_113c(
          m,
          pUnit >>> 0,
          pGame >>> 0,
          targetGuid,
        )
      }
      return
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
}

/**
 * [12/30] Converts a target monster (`SUNIT_SetMonsterAlignmentState`, `SUBPARTY_PrependUnitToBucket8Or9`),
 * taunts nearby units in radius (`0x6FC70DB0`), and attaches an aura statlist (`0x6FC6EBE0` on expire).
 *
 * @dll D2Game.dll
 * @va 0x6FC71C60
 * @ordinalOrName D2Game_6FC71C60
 */
export function SKILLS_SrvDo058_AttractConvertAndTauntRadius_6FC71C60_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC71C60)
  void SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const skillLvl = nSkillLevel | 0
  if (skillId < 0) return 0

  const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? (m.u32(pDataTablesPtr) >>> 0) : 0
  if (pDataTables === 0) return 0
  const nSkillsTxtCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (skillId >= nSkillsTxtCount) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, unit, game)
  const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0
  const pRawTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  const pTarget = pRawTarget === unit ? 0 : pRawTarget
  if (
    (SKILLS_CanConvertOrMindBlastTarget_6FC6EE80_113c(m, pTarget, unit, game) |
      0) ===
    0
  ) {
    return 0
  }

  const wAuraTargetState = (m.u16((pSkillsTxt + 0x54) >>> 0) << 16) >> 16
  if (wAuraTargetState < -1) return 0
  const nStatesCount = m.u32((pDataTables + 0xbd4) >>> 0) | 0
  if (wAuraTargetState >= nStatesCount) return 0

  const wAuraStat1 = (m.u16((pSkillsTxt + 0x82) >>> 0) << 16) >> 16
  if (wAuraStat1 < 0) return 0
  const nItemStatCostCount = m.u32((pDataTables + 0xc4) >>> 0) | 0
  if (wAuraStat1 >= nItemStatCostCount) return 0

  m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
  SUNIT_SetMonsterAlignmentState113c(m, pTarget, 1, 1)
  SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c(m, game, 9, pTarget, 0)
  SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c(m, pTarget)

  const dwCalcRadius = m.u32((pSkillsTxt + 0x64) >>> 0) >>> 0
  const nRadius =
    SKILLS_EvalCalcByOffset113c(m, unit, dwCalcRadius, skillId, skillLvl) | 0
  const dwCalcDur = m.u32((pSkillsTxt + 0x60) >>> 0) >>> 0
  const nRawDur =
    SKILLS_EvalCalcByOffset113c(m, unit, dwCalcDur, skillId, skillLvl) | 0
  const nDifficulty = m.u8((game + 0x6d) >>> 0) & 0xff
  const nDuration = SKILLS_DivideValueByMonLvlHp113c(m, nDifficulty, nRawDur) | 0

  const sp = allocScratch(0x48)
  try {
    const pCbArg = sp
    m.setU32(pCbArg, game)
    m.setU32((pCbArg + 0x04) >>> 0, unit)
    m.setU32((pCbArg + 0x08) >>> 0, skillId >>> 0)
    m.setU32((pCbArg + 0x0c) >>> 0, skillLvl >>> 0)
    m.setU32((pCbArg + 0x10) >>> 0, 0)
    m.setU8(
      (pCbArg + 0x10) >>> 0,
      pTarget !== 0 ? m.u32(pTarget) & 0xff : 6,
    )
    m.setU32(
      (pCbArg + 0x14) >>> 0,
      pTarget !== 0 ? (m.u32((pTarget + 0x0c) >>> 0) >>> 0) : 0xffffffff,
    )
    m.setU32((pCbArg + 0x18) >>> 0, nDuration >>> 0)

    const dwAuraFilter = m.u32((pSkillsTxt + 0x50) >>> 0) >>> 0
    AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c(
      m,
      game,
      dwAuraFilter,
      unit,
      nRadius,
      (mem, pRadiusUnit, pArg) => {
        W7_ApplyAttractorCurseCallback_6FC70DB0_113c(
          mem as SparseMemory113c,
          pRadiusUnit,
          pArg,
        )
      },
      pCbArg,
    )

    const pAuraSetup = (sp + 0x1c) >>> 0
    for (let i = 0; i < 9; i++) {
      m.setU32((pAuraSetup + (i << 2)) >>> 0, 0)
    }
    m.setU32(pAuraSetup, unit)
    m.setU32((pAuraSetup + 0x04) >>> 0, pTarget)
    m.setU32((pAuraSetup + 0x08) >>> 0, skillId >>> 0)
    m.setU32((pAuraSetup + 0x0c) >>> 0, skillLvl >>> 0)
    m.setU32((pAuraSetup + 0x10) >>> 0, nDuration >>> 0)
    m.setU32((pAuraSetup + 0x14) >>> 0, 0xffffffff)
    m.setU32((pAuraSetup + 0x1c) >>> 0, wAuraStat1 >>> 0)
    m.setU32((pAuraSetup + 0x20) >>> 0, 0x6fc6ebe0)
    STATES_CreateOrUpdateAuraStatList113c(m, pAuraSetup)
    return 1
  } finally {
    freeScratch(0x48)
  }
}

/**
 * [13/30] Serializes `pPlayerUnit`'s save data (`0x6FD0C7F0`), appends it to `pClient`'s
 * save buffer (`0x6FC6A190`), sets flag `0x10` at `+0x3D4`, and sets state `+0x184 = 5`.
 *
 * @dll D2Game.dll
 * @va 0x6FC73E50
 * @ordinalOrName D2Game_6FC73E50
 */
export function PLAYERSAVE_SerializeAndAppendClientSaveData_6FC73E50_113c(
  m: SparseMemory113c,
  pClient: number,
  pGame: number,
  pPlayerUnit: number,
  bUnkFlag: number,
): void {
  hitD2GameVa113c(0x6FC73E50)
  const client = pClient >>> 0
  if (client === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 2881)
  }
  if (m.u32((client + 0x17c) >>> 0) !== 0) {
    CLIENTS_FreeSaveDataBuffer_6FC69630_113c(m, client)
  }

  const sp = allocScratch(0x2008)
  try {
    const pOutSize = sp
    const pSaveBuf = (sp + 0x04) >>> 0
    m.setU32(pOutSize, 0)
    W7_WritePlayerSaveData_6FD0C7F0_113c(
      m,
      pPlayerUnit >>> 0,
      pGame >>> 0,
      pSaveBuf,
      pOutSize,
      0x2000,
      bUnkFlag | 0,
      0,
    )
    const nSaveSize = m.u32(pOutSize) | 0
    if (nSaveSize <= 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 2855)
    }
    const dwClientId = m.u32(client) >>> 0
    CLIENTS_AppendSaveDataChunk_6FC6A190_113c(
      m,
      dwClientId,
      pSaveBuf,
      nSaveSize,
      nSaveSize,
      0,
    )
    m.setU32(
      (client + 0x3d4) >>> 0,
      (m.u32((client + 0x3d4) >>> 0) | 0x10) >>> 0,
    )
    m.setU32((client + 0x184) >>> 0, 5)
    m.setU32((client + 0x188) >>> 0, 0)
  } finally {
    freeScratch(0x2008)
  }
}

/**
 * [14/30] Serializes `pPlayerUnit`'s save data (`0x6FD0C7F0`) when local save flag
 * (`0x6FD2D8BC`) is enabled.
 *
 * @dll D2Game.dll
 * @va 0x6FC73F10
 * @ordinalOrName D2Game_6FC73F10
 */
export function PLAYERSAVE_SaveSinglePlayerCharFileToDisk_6FC73F10_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _szCharName: number,
  bUnkFlag: number,
  bSaveMerc: number,
): void {
  hitD2GameVa113c(0x6FC73F10)
  if (m.u32(0x6fd2d8bc) === 0) return
  const sp = allocScratch(0x2008)
  try {
    const pOutSize = sp
    const pSaveBuf = (sp + 0x04) >>> 0
    m.setU32(pOutSize, 0)
    W7_WritePlayerSaveData_6FD0C7F0_113c(
      m,
      pPlayerUnit >>> 0,
      pGame >>> 0,
      pSaveBuf,
      pOutSize,
      0x2000,
      bUnkFlag | 0,
      bSaveMerc | 0,
    )
  } finally {
    freeScratch(0x2008)
  }
}

/**
 * [15/30] Serializes `pPlayerUnit`, deduplicates unchanged save data against `pClient`'s cached
 * save buffer and header checksum, and stores updated save data via `0x6FC696B0`.
 *
 * @dll D2Game.dll
 * @va 0x6FC74000
 * @ordinalOrName D2Game_6FC74000
 */
export function PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000_113c(
  m: SparseMemory113c,
  bUnkFlag: number,
  pPlayerUnit: number,
  pGame: number,
  szAccountName: number,
  szCharName: number,
  dwSaveToken: number,
  bSaveMerc: number,
  dwClientSaveTimestamp: number,
  hooks?: {
    onSaveUnchanged38?: (
      m: SparseMemory113c,
      pTimestamp: number,
      szAccountName: number,
      szCharName: number,
    ) => void
    onSavePlayerData0C?: (
      m: SparseMemory113c,
      pTimestamp: number,
      szAccountName: number,
      szCharName: number,
      pPacketBuf: number,
      nTotalSize: number,
      dwSaveToken: number,
    ) => void
  },
): number {
  hitD2GameVa113c(0x6FC74000)
  if (m.u32(0x6fd2d8bc) === 0) return 0
  const player = pPlayerUnit >>> 0
  const game = pGame >>> 0
  const sp = allocScratch(0x2018)
  try {
    const pOutSize = sp
    const pTimestamp = (sp + 0x04) >>> 0
    const pPacketBuf = (sp + 0x08) >>> 0
    const pSaveData = (pPacketBuf + 2) >>> 0
    m.setU32(pOutSize, 0)
    m.setU32(pTimestamp, dwClientSaveTimestamp >>> 0)
    W7_WritePlayerSaveData_6FD0C7F0_113c(
      m,
      player,
      game,
      pSaveData,
      pOutSize,
      0x2000,
      bUnkFlag | 0,
      bSaveMerc | 0,
    )
    const nSaveSize = m.u32(pOutSize) | 0
    if (nSaveSize <= 0) return 0

    const nTotalSize = (nSaveSize + 2) | 0
    m.setU16(pPacketBuf, nTotalSize & 0xffff)
    if (player === 0 || (m.u32(player) | 0) !== 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 2027)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
    const pClient = pPlayerData !== 0 ? (m.u32((pPlayerData + 0x9c) >>> 0) >>> 0) : 0
    if (pClient === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 2027)
    }

    const dwOldChecksum = m.u32((pClient + 0x18c) >>> 0) >>> 0
    const dwNewChecksum =
      PLAYERSAVE_ComputeHeaderChecksum_6FC73170_113c(m, pSaveData, nSaveSize) >>> 0
    if (dwNewChecksum === dwOldChecksum) {
      const pCached = CLIENTS_GetSaveDataPtr_6FC69790_113c(m, pClient) >>> 0
      const nCachedSize = CLIENTS_GetSaveDataSize_6FC69760_113c(m, pClient) | 0
      if (pCached === 0) {
        throw new D2CommonAssertError('0x6fd19ff9', 2619)
      }
      if (nCachedSize === nSaveSize) {
        const cachedVer = m.u32((pCached + 0x04) >>> 0) >>> 0
        let c0c = 0, c30 = 0, c34 = 0, cab = 0
        if (cachedVer > 0x5b) {
          c0c = m.u32((pCached + 0x0c) >>> 0) >>> 0
          c30 = m.u32((pCached + 0x30) >>> 0) >>> 0
          c34 = m.u32((pCached + 0x34) >>> 0) >>> 0
          cab = m.u32((pCached + 0xab) >>> 0) >>> 0
          m.setU32((pCached + 0x0c) >>> 0, 0)
          m.setU32((pCached + 0x30) >>> 0, 0)
          m.setU32((pCached + 0x34) >>> 0, 0)
          m.setU32((pCached + 0xab) >>> 0, 0)
        }
        const newVer = m.u32((pSaveData + 0x04) >>> 0) >>> 0
        let n0c = 0, n30 = 0, n34 = 0, nab = 0
        if (newVer > 0x5b) {
          n0c = m.u32((pSaveData + 0x0c) >>> 0) >>> 0
          n30 = m.u32((pSaveData + 0x30) >>> 0) >>> 0
          n34 = m.u32((pSaveData + 0x34) >>> 0) >>> 0
          nab = m.u32((pSaveData + 0xab) >>> 0) >>> 0
          m.setU32((pSaveData + 0x0c) >>> 0, 0)
          m.setU32((pSaveData + 0x30) >>> 0, 0)
          m.setU32((pSaveData + 0x34) >>> 0, 0)
          m.setU32((pSaveData + 0xab) >>> 0, 0)
        }
        let bSame = 1
        for (let i = 0; i < nCachedSize; i++) {
          if (m.u8((pCached + i) >>> 0) !== m.u8((pSaveData + i) >>> 0)) {
            bSame = 0
            break
          }
        }
        if (cachedVer > 0x5b) {
          m.setU32((pCached + 0x0c) >>> 0, c0c)
          m.setU32((pCached + 0x30) >>> 0, c30)
          m.setU32((pCached + 0x34) >>> 0, c34)
          m.setU32((pCached + 0xab) >>> 0, cab)
        }
        if (newVer > 0x5b) {
          m.setU32((pSaveData + 0x0c) >>> 0, n0c)
          m.setU32((pSaveData + 0x30) >>> 0, n30)
          m.setU32((pSaveData + 0x34) >>> 0, n34)
          m.setU32((pSaveData + 0xab) >>> 0, nab)
        }
        if (bSame !== 0) {
          m.setU32(0x6fd31f84, (m.u32(0x6fd31f84) + 1) >>> 0)
          const pCbTblUnchanged = m.u32(0x6fd31c3c) >>> 0
          if (pCbTblUnchanged !== 0 && m.u32((pCbTblUnchanged + 0x38) >>> 0) !== 0) {
            if (hooks !== undefined && hooks.onSaveUnchanged38 !== undefined) {
              hooks.onSaveUnchanged38(m, pTimestamp, szAccountName >>> 0, szCharName >>> 0)
            }
          }
          m.setU32((pClient + 0x68) >>> 0, m.u32(pTimestamp) >>> 0)
          return 0
        }
      }
    }

    m.setU32((pClient + 0x68) >>> 0, m.u32(pTimestamp) >>> 0)
    m.setU32((pClient + 0x18c) >>> 0, dwNewChecksum)
    const pCallbackTbl = m.u32(0x6fd31c3c) >>> 0
    if (pCallbackTbl !== 0) {
      const pfnSavePlayerData = m.u32((pCallbackTbl + 0x0c) >>> 0) >>> 0
      if (pfnSavePlayerData !== 0) {
        if (pfnSavePlayerData === 0xffffffff) {
          throw new D2CommonAssertError('0x6fd19ff9', 2769)
        }
        if (hooks !== undefined && hooks.onSavePlayerData0C !== undefined) {
          hooks.onSavePlayerData0C(
            m,
            pTimestamp,
            szAccountName >>> 0,
            szCharName >>> 0,
            pPacketBuf,
            nTotalSize,
            dwSaveToken >>> 0,
          )
        }
        CLIENTS_StoreSaveDataBuffer_6FC696B0_113c(m, pClient, nSaveSize, pSaveData)
      }
    }
    return 1
  } finally {
    freeScratch(0x2018)
  }
}

/**
 * [16/30] Act 5 Quest 4 (Nihlathak / Betrayal of Harrogath) level/quest state handler:
 * checks Halls of Pain waypoint (`levelId = 0x7B`) when inactive, or updates quest state
 * and broadcasts alert `0x22` (`0x6FC790C0`).
 *
 * @dll D2Game.dll
 * @va 0x6FC7AE20
 * @ordinalOrName D2Game_6FC7AE20
 */
export function ACT5Q4_OnPlayerEnteredOrInitState_6FC7AE20_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC7AE20)
  const quest = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const bActive = m.u8((quest + 0x09) >>> 0) & 0xff
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0

  if (bActive === 0) {
    m.setU8((quest + 0x0c) >>> 0, 5)
    const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
    const pGame = m.u32(arg) >>> 0
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
    const nDifficulty = m.u8((pGame + 0x6d) >>> 0) & 0xff
    const pWaypointData =
      pPlayerData !== 0
        ? (m.u32((pPlayerData + (nDifficulty << 2) + 0x1c) >>> 0) >>> 0)
        : 0
    const sp = allocScratch(8)
    try {
      m.setU32(sp, 0)
      if ((WAYPOINT_GetWaypointNoFromLevelId113c(m, 0x7b, sp) | 0) === 0) {
        return
      }
      const nWaypointNo = m.u32(sp) | 0
      if ((WAYPOINT_GetWaypointState113c(m, pWaypointData, nWaypointNo) | 0) !== 0) {
        return
      }
      m.setU8((pQuestDataEx + 0x89) >>> 0, 1)
      return
    } finally {
      freeScratch(8)
    }
  }

  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(arg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0) & 0xff
  const nQuestNo = m.u32((quest + 0xe0) >>> 0) | 0
  const pQuestRecord =
    pPlayerData !== 0
      ? (m.u32((pPlayerData + (nDifficulty << 2) + 0x10) >>> 0) >>> 0)
      : 0

  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, nQuestNo, 1) | 0) !== 0) {
    return
  }

  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x26, 3) | 0) !== 0) {
    m.setU8((pQuestDataEx + 0x87) >>> 0, 1)
    m.setU8((quest + 0x0b) >>> 0, 2)
    const pQuestGame = m.u32((quest + 0x04) >>> 0) >>> 0
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pQuestGame,
      ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c,
      0,
      0,
    )
    W7_SetQuestStateAndDebugPrint_6FC55EB0_113c(m, quest, 3)
    return
  }

  const nQuestNoReload = m.u32((quest + 0xe0) >>> 0) | 0
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, nQuestNoReload, 2) | 0) !== 0
  ) {
    m.setU8((pQuestDataEx + 0x87) >>> 0, 1)
    m.setU8((quest + 0x0b) >>> 0, 1)
    const pQuestGame = m.u32((quest + 0x04) >>> 0) >>> 0
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pQuestGame,
      ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c,
      0,
      0,
    )
    W7_SetQuestStateAndDebugPrint_6FC55EB0_113c(m, quest, 2)
  }
}

/**
 * [17/30] Quest sequence filter that promotes `bSeqState == 0` to `1` when active and `< 4`,
 * or chains to the next quest (`+0x10`) via `QUESTS_GetQuestData_6FC53F30`.
 *
 * @dll D2Game.dll
 * @va 0x6FC7AFB0
 * @ordinalOrName D2Game_6FC7AFB0
 */
export function QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(
  m: SparseMemory113c,
  pQuestData: number,
  onChainCallback?: (m: SparseMemory113c, pChainedQuest: number) => number,
): number {
  hitD2GameVa113c(0x6FC7AFB0)
  const quest = pQuestData >>> 0
  const bSeqState = m.u8((quest + 0x0c) >>> 0) & 0xff
  if (bSeqState < 4) {
    const bActive = m.u8((quest + 0x09) >>> 0) & 0xff
    if (bActive !== 0) {
      if (bSeqState === 0) {
        W7_SetQuestStateAndDebugPrint_6FC55EB0_113c(m, quest, 1)
      }
      return 1
    }
  }

  const nChainQuestId = m.u32((quest + 0x10) >>> 0) | 0
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  const pChainedQuest =
    QUESTS_GetQuestData_6FC53F30_113c(m, pGame, nChainQuestId) >>> 0
  if (pChainedQuest === 0) {
    return 0
  }

  const pfnSelfSeq = m.u32((quest + 0xf0) >>> 0) >>> 0
  if (pfnSelfSeq === 0 || pfnSelfSeq === 0xffffffff) {
    throw new D2CommonAssertError('0x6fd19ff9', 246)
  }
  if (onChainCallback !== undefined) {
    return onChainCallback(m, pChainedQuest) & 0xff
  }
  const pfnChained = m.u32((pChainedQuest + 0xf0) >>> 0) >>> 0
  if (pfnChained === 0x6fc767a0) {
    return ACT5Q6_SeqFilter_6FC767A0_113c(m, pChainedQuest) & 0xff
  }
  if (pfnChained === 0x6fc7afb0 && pChainedQuest !== quest) {
    return QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(m, pChainedQuest)
  }
  return pfnChained !== 0 ? 1 : 0
}

/**
 * [18/30] Act 5 Quest 1 (Siege on Harrogath) NPC dialogue handler for Larzuk (`wNpcId == 0x1FF`,
 * `wMessageIndex == 0x4E6D` intro or `0x4E7A` completion reward).
 *
 * @dll D2Game.dll
 * @va 0x6FC7B4F0
 * @ordinalOrName D2Game_6FC7B4F0
 */
export function ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC7B4F0)
  const quest = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const wNpcId = m.u16((arg + 0x14) >>> 0) & 0xffff
  const wMsgIdx = m.u16((arg + 0x18) >>> 0) & 0xffff
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0
  if (wNpcId !== 0x1ff) return

  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0) & 0xff
  const pQuestRecord =
    pPlayerData !== 0
      ? (m.u32((pPlayerData + (nDifficulty << 2) + 0x10) >>> 0) >>> 0)
      : 0

  if (wMsgIdx === 0x4e6d) {
    m.setU8((pQuestDataEx + 0x08) >>> 0, 1)
    m.setU8((quest + 0x0c) >>> 0, 2)
    if (m.u32(0x6fd31c20) !== 0) {
      const sp = allocScratch(0x80)
      try {
        m.setU8(sp, 0)
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          sp,
          m.u32((quest + 0x04) >>> 0) >>> 0,
          4,
        )
      } finally {
        freeScratch(0x80)
      }
    }
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((quest + 0x04) >>> 0) >>> 0,
      ACT5Q1_SyncPlayerQuestStateWithQuest1F_6FC78890_113c,
      0,
      0,
    )
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((arg + 0x08) >>> 0) >>> 0,
      m.u32((arg + 0x0c) >>> 0) >>> 0,
      m.u32(arg) >>> 0,
    )
    return
  }

  if (wMsgIdx !== 0x4e7a) return
  const nQuestNo = m.u32((quest + 0xe0) >>> 0) | 0
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, nQuestNo, 1) | 0) !== 1) {
    return
  }
  m.setU8((pQuestDataEx + 0x16) >>> 0, 1)
  QUESTRECORD_ClearQuestStateBits2To11_113c(
    m,
    pQuestRecord,
    m.u32((quest + 0xe0) >>> 0) | 0,
  )
  QUESTRECORD_SetQuestState113c(
    m,
    pQuestRecord,
    m.u32((quest + 0xe0) >>> 0) | 0,
    5,
  )

  if (
    (DRLGWARP_TestRoomTileBit113c(
      m,
      pQuestRecord,
      m.u32((quest + 0xe0) >>> 0) | 0,
      0x0d,
    ) |
      0) !==
      0 &&
    m.u8((quest + 0x0c) >>> 0) !== 5
  ) {
    W7_SetQuestStateAndDebugPrint_6FC55EB0_113c(m, quest, 5)
    const pfnSeq = m.u32((quest + 0xf0) >>> 0) >>> 0
    if (pfnSeq === 0 || pfnSeq === 0xffffffff) {
      throw new D2CommonAssertError('0x6fd19ff9', 265)
    }
    if (pfnSeq === 0x6fc76d10) {
      ACT5Q1_SeqFilter_6FC76D10_113c(m, quest)
    } else if (pfnSeq === 0x6fc7afb0) {
      QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(m, quest)
    }
    m.setU8((quest + 0x14) >>> 0, 0)
    m.setU8((quest + 0x0b) >>> 0, 0x0d)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((quest + 0x04) >>> 0) >>> 0,
      ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c,
      0,
      0,
    )
  }

  const pPlayerUnit = m.u32((arg + 0x0c) >>> 0) >>> 0
  const dwGuid =
    pPlayerUnit !== 0
      ? (m.u32((pPlayerUnit + 0x0c) >>> 0) >>> 0)
      : 0xffffffff
  QUESTS_GuidListAdd113c(m, (quest + 0x1c) >>> 0, dwGuid)
}

/**
 * [19/30] Act 5 Quest 5 (Rite of Passage) callback that checks if `pPlayerUnit` is in Act 5
 * (`actNo == 4`), has character level `>= (nDifficulty + 1) * 20`, and has not completed
 * quest `0x27`, then sets flags `0` and `0x0D` and grants experience via `0x6FC7BF70`.
 *
 * @dll D2Game.dll
 * @va 0x6FC7C080
 * @ordinalOrName D2Game_6FC7C080
 */
export function ACT5Q5_CheckAndGrantAncientsRewardInAct5_6FC7C080_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FC7C080)
  const game = pGame >>> 0
  const player = pPlayerUnit >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDifficulty = m.u8((game + 0x6d) >>> 0) & 0xff
  const pQuestRecord =
    pPlayerData !== 0
      ? (m.u32((pPlayerData + (nDifficulty << 2) + 0x10) >>> 0) >>> 0)
      : 0

  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x27, 0) | 0) !== 0) {
    return
  }

  const nLevel = STATLIST_GetUnitBaseStat113c(m, player, 0x0c, 0) | 0
  const nMinLevel = ((nDifficulty + 1) * 20) | 0
  if (nLevel < nMinLevel) {
    return
  }

  const pRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pRoom === 0) return
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId === 0) return
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) !== 4) {
    return
  }

  QUESTRECORD_SetQuestState113c(m, pQuestRecord, 0x27, 0)
  QUESTRECORD_SetQuestState113c(m, pQuestRecord, 0x27, 0x0d)
  W7_GrantAncientsExperienceAndSendQuestLog_6FC7BF70_113c(m, player, game)
}

/**
 * [20/30] Iterates all living players in `pGame` to destroy portals in Arreat Summit
 * via `ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c`.
 *
 * @dll D2Game.dll
 * @va 0x6FC7D080
 * @ordinalOrName D2Game_6FC7D080
 */
export function ACT5Q5_DestroyAllPlayerPortalsInArreatSummit_6FC7D080_113c(
  m: SparseMemory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC7D080)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    pGame >>> 0,
    ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c,
    0,
    0,
  )
}

/**
 * [21/30] Handles Anya (`wNpcId == 0x200`) interaction for Act 5 Quest 4: broadcasts alert `0x22`
 * if `pQuestDataEx + 0x86 == 1` and spawns Nihlathak's red portal if `+0x87 != 0 && +0x88 == 0`.
 *
 * @dll D2Game.dll
 * @va 0x6FC7D520
 * @ordinalOrName D2Game_6FC7D520
 */
export function ACT5Q4_OnAnyaNpcInteract_6FC7D520_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC7D520)
  const quest = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const pNpc = m.u32((arg + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || (m.u16((pNpc + 0x04) >>> 0) & 0xffff) !== 0x200) {
    return
  }
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestDataEx + 0x86) >>> 0) === 1) {
    m.setU8((quest + 0x0b) >>> 0, 1)
    m.setU8((quest + 0x14) >>> 0, 0)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((quest + 0x04) >>> 0) >>> 0,
      ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c,
      0,
      0,
    )
    m.setU8((pQuestDataEx + 0x86) >>> 0, 0)
  }
  if (m.u8((pQuestDataEx + 0x87) >>> 0) !== 0 && m.u8((pQuestDataEx + 0x88) >>> 0) === 0) {
    ACT5Q2_SpawnNihlathakPortalFromQuestData_6FC7D380_113c(
      m,
      m.u32((arg + 0x08) >>> 0) >>> 0,
      quest,
    )
  }
}

/**
 * [22/30] Timer event `7` callback that attempts to spawn Nihlathak's portal for quest `0x22`
 * when `pQuestDataEx + 0x87 != 0`, rescheduling `+12` frames if portal creation fails.
 *
 * @dll D2Game.dll
 * @va 0x6FC7E790
 * @ordinalOrName D2Game_6FC7E790
 */
export function ACT5Q4_TrySpawnNihlathakPortalOrRescheduleEvent7_6FC7E790_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FC7E790)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const pQuestCtrl = m.u32((game + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return
  let pQuest = m.u32(pQuestCtrl) >>> 0
  while (pQuest !== 0 && (m.u32(pQuest) >>> 0) !== 0x22) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) return
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestDataEx + 0x87) >>> 0) === 0) return
  if ((ACT5Q2_SpawnNihlathakPortalFromQuestData_6FC7D380_113c(m, unit, pQuest) & 0xff) === 0) {
    const nextFrame = (m.u32((game + 0xa8) >>> 0) + 0x0c) >>> 0
    EVENT_SetEventFull113c(m, game, unit, 7, nextFrame, 0, 0, 0)
  }
}

/**
 * [23/30] Handles Act 5 Quest 5 (Rite of Passage) NPC dialogues and scroll messages
 * (`0x4EB9`, `0x4E22`, `0x4EC9`, and town NPC completion flags `5..9`).
 *
 * @dll D2Game.dll
 * @va 0x6FC7F200
 * @ordinalOrName D2Game_6FC7F200
 */
export function ACT5Q5_NpcIntroAndScrolls_6FC7F200_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC7F200)
  const quest = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const wMsgIdx = m.u16((arg + 0x18) >>> 0) & 0xffff
  const wNpcId = m.u16((arg + 0x14) >>> 0) & 0xffff
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0

  if (wMsgIdx === 0x4eb9) {
    if (wNpcId === 0x203) {
      if (m.u8((quest + 0x09) >>> 0) === 0 || m.u8((quest + 0x0c) >>> 0) !== 1) {
        return
      }
      W7_SetQuestStateAndDebugPrint_6FC55EB0_113c(m, quest, 2)
      if (m.u8((quest + 0x0b) >>> 0) !== 1) {
        m.setU8((quest + 0x14) >>> 0, 0)
        m.setU8((quest + 0x0b) >>> 0, 1)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          m.u32((quest + 0x04) >>> 0) >>> 0,
          ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c,
          0,
          0,
        )
      }
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((quest + 0x04) >>> 0) >>> 0,
        ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c,
        0,
        0,
      )
      m.setU8((pQuestDataEx + 0x01) >>> 0, 1)
      return
    }
  } else if (wMsgIdx === 0x4e22) {
    if (
      m.u8((quest + 0x09) >>> 0) !== 0 &&
      m.u8((quest + 0x0c) >>> 0) < 4 &&
      m.u8((quest + 0x0b) >>> 0) !== 3
    ) {
      m.setU8((quest + 0x14) >>> 0, 0)
      m.setU8((quest + 0x0b) >>> 0, 3)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((quest + 0x04) >>> 0) >>> 0,
        ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c,
        0,
        0,
      )
    }
    if ((m.u32((pQuestDataEx + 0x0c) >>> 0) | 0) > 0) return
    for (let i = 0; i < 3; i++) {
      if (m.u32((pQuestDataEx + 0x30 + i * 4) >>> 0) !== 0) return
    }
    if ((ACT5Q5_DeactivateAncientStatuesAndReset_6FC7E560_113c(m, quest, pQuestDataEx) | 0) !== 0) {
      m.setU8((pQuestDataEx + 0x10) >>> 0, 1)
      m.setU8((pQuestDataEx + 0x11) >>> 0, 1)
    }
    return
  } else if (wMsgIdx === 0x4ec9) {
    const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
    const pPlayerData = UNITS_GetPlayerData113c(m, m.u32((arg + 0x0c) >>> 0) >>> 0) >>> 0
    const nDiff = m.u8((pGame + 0x6d) >>> 0)
    const pQuestRec = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
    QUESTRECORD_SetQuestState113c(m, pQuestRec, 0x27, 4)
    return
  }

  let targetState = 0
  if (wNpcId === 0x1ff && wMsgIdx === 0x4ec7) targetState = 5
  else if (wNpcId === 0x208 && wMsgIdx === 0x4ec5) targetState = 6
  else if (wNpcId === 0x200 && wMsgIdx === 0x4ec6) targetState = 7
  else if (wNpcId === 0x201 && wMsgIdx === 0x4ec8) targetState = 8
  else if (wNpcId === 0x203 && wMsgIdx === 0x4ec4) targetState = 9
  if (targetState !== 0) {
    const nQuestId = m.u32((quest + 0xe0) >>> 0) | 0
    const pQuestRec =
      PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(
        m,
        m.u32((arg + 0x0c) >>> 0) >>> 0,
        m.u32((quest + 0x04) >>> 0) >>> 0,
      ) >>> 0
    QUESTRECORD_SetQuestState113c(m, pQuestRec, nQuestId, targetState)
  }
}

function writeDebugQuestStateStr(m: SparseMemory113c, pBuf: number, nState: number): void {
  const s = `queststate = ${nState | 0}`
  for (let i = 0; i < s.length; i++) {
    m.setU8((pBuf + i) >>> 0, s.charCodeAt(i) & 0xff)
  }
  m.setU8((pBuf + s.length) >>> 0, 0)
}

/**
 * [24/30] Handles Act 1 Quest 6 (Sisters to the Slaughter) NPC intros and rewards
 * for Deckard Cain (`0x109`), Warriv (`0x9B`), Akara (`0x94`), and Kashya (`0x96`).
 *
 * @dll D2Game.dll
 * @va 0x6FC83F90
 * @ordinalOrName D2Game_6FC83F90
 */
export function ACT1Q6_NpcIntroAndRewardWarrivAndTownsfolk_6FC83F90_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC83F90)
  const quest = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const wNpcId = m.u16((arg + 0x14) >>> 0) & 0xffff
  const wMsgIdx = m.u16((arg + 0x18) >>> 0) & 0xffff
  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0

  if (wNpcId === 0x109) {
    if (wMsgIdx === 0xa6) {
      m.setU8((quest + 0x0c) >>> 0, 2)
      const szBuf = allocScratch(0x80)
      writeDebugQuestStateStr(m, szBuf, 2)
      if (m.u32(0x6fd31c20) !== 0) {
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          szBuf,
          m.u32((quest + 0x04) >>> 0) >>> 0,
          4,
        )
      }
      freeScratch(0x80)
      m.setU8((pQuestDataEx + 0x195) >>> 0, 1)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((quest + 0x04) >>> 0) >>> 0,
        ACT1Q6_UpdatePlayerQuestStateCallback_6FC80D00_113c,
        0,
        0,
      )
      QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
        m,
        m.u32((arg + 0x08) >>> 0) >>> 0,
        pPlayer,
        m.u32(arg) >>> 0,
      )
      return
    }
    if (wMsgIdx === 0xb8) {
      QUESTS_GuidListRemove113c(m, pQuestDataEx, dwPlayerGuid)
    }
    return
  }

  if (wNpcId === 0x9b) {
    if (wMsgIdx !== 0xb7) return
    const pGame = m.u32(arg) >>> 0
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((arg + 0x08) >>> 0) >>> 0,
      pPlayer,
      pGame,
    )
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
    const nDiff = m.u8((pGame + 0x6d) >>> 0)
    const pQuestRec = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
    if ((DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 6, 1) | 0) === 0) return
    if ((DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 6, 0x0d) | 0) !== 0) {
      m.setU8((quest + 0x14) >>> 0, 0)
      m.setU8((quest + 0x0b) >>> 0, 0x0d)
      W7_SetQuestStateAndDebugPrint_6FC55EB0_113c(m, quest, 5)
      QUESTS_SetGlobalQuestState_6FC53920_113c(m, m.u32((quest + 0x04) >>> 0) >>> 0, 6, 0x0d)
    }
    QUESTRECORD_ClearQuestState113c(m, pQuestRec, 6, 1)
    QUESTRECORD_SetQuestState113c(m, pQuestRec, 6, 0)
    const guid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff
    QUESTS_GuidListAdd113c(m, (quest + 0x1c) >>> 0, guid)
    QUESTS_SendPlayerQuestLogPacket28_113c(m, pPlayer, m.u32((quest + 0x04) >>> 0) >>> 0)
    return
  }

  if (wNpcId === 0x94 && wMsgIdx === 0xb3) {
    QUESTS_GuidListRemove113c(m, (pQuestDataEx + 0x84) >>> 0, dwPlayerGuid)
  } else if (wNpcId === 0x96 && wMsgIdx === 0xb5) {
    QUESTS_GuidListRemove113c(m, (pQuestDataEx + 0x108) >>> 0, dwPlayerGuid)
  }
}

function invokeQuestFilterCallbackF0(m: SparseMemory113c, pQuest: number, nLine: number): number {
  const quest = pQuest >>> 0
  const fnVa = m.u32((quest + 0xf0) >>> 0) >>> 0
  if (fnVa === 0 || fnVa === 0xffffffff) {
    throw new D2CommonAssertError('Quests.cpp', nLine)
  }
  if (fnVa === 0x6fc801b0) {
    return QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c(m, quest)
  }
  if (fnVa === 0x6fc806e0) {
    return QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c(m, quest)
  }
  if (fnVa === 0x6fc85410) {
    return ACT1Q1_SequenceFilter_6FC85410_113c(m, quest)
  }
  if (fnVa === 0x6fc7afb0) {
    return QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(m, quest)
  }
  if (fnVa === 0x6fc83d20) {
    return ACT1Q3_ActivateQuestState1_6FC83D20_113c(m, quest)
  }
  return 0
}

/**
 * [25/30] Handles Act 1 Quest 5 (Tools of the Trade) NPC dialogues (`0x7F` and town completion
 * messages `0x8C..0x91`), updating Charsi imbue state and moving player GUIDs between tracking arrays.
 *
 * @dll D2Game.dll
 * @va 0x6FC84430
 * @ordinalOrName D2Game_6FC84430
 */
export function ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC84430)
  const quest = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0
  const wNpcId = m.u16((arg + 0x14) >>> 0) & 0xffff
  const wMsgIdx = m.u16((arg + 0x18) >>> 0) & 0xffff

  if (wMsgIdx === 0x7f && m.u8((quest + 0x09) >>> 0) !== 0) {
    let bUpdated = 0
    if (m.u8((pQuestDataEx + 0x11b) >>> 0) === 1) {
      if (m.u8((quest + 0x0b) >>> 0) < 1) {
        bUpdated = 1
        m.setU8((quest + 0x0b) >>> 0, 1)
        m.setU8((quest + 0x14) >>> 0, 0)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          m.u32((quest + 0x04) >>> 0) >>> 0,
          ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c,
          0,
          0,
        )
      }
      if (m.u8((quest + 0x0b) >>> 0) === 3) {
        bUpdated = 1
        m.setU8((quest + 0x14) >>> 0, 0)
        m.setU8((quest + 0x0b) >>> 0, 2)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          m.u32((quest + 0x04) >>> 0) >>> 0,
          ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c,
          0,
          0,
        )
        if (m.u8((quest + 0x0c) >>> 0) < 3) {
          W7_SetQuestStateAndDebugPrint_6FC55EB0_113c(m, quest, 3)
        }
      }
    }
    if (m.u8((quest + 0x0c) >>> 0) < 2) {
      W7_SetQuestStateAndDebugPrint_6FC55EB0_113c(m, quest, 2)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((quest + 0x04) >>> 0) >>> 0,
        ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c,
        0,
        0,
      )
    } else if (bUpdated !== 0) {
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((quest + 0x04) >>> 0) >>> 0,
        ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c,
        0,
        0,
      )
    }
  }

  const isTownNpc =
    wNpcId === 0x9a ||
    wNpcId === 0x96 ||
    wNpcId === 0x109 ||
    wNpcId === 0x9b ||
    wNpcId === 0x94 ||
    wNpcId === 0x93
  const isTownMsg =
    wMsgIdx === 0x90 ||
    wMsgIdx === 0x8c ||
    wMsgIdx === 0x91 ||
    wMsgIdx === 0x8d ||
    wMsgIdx === 0x8f ||
    wMsgIdx === 0x8e
  if (!isTownNpc || !isTownMsg) {
    return
  }

  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(arg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestRec = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 5, 0x0d) | 0) !== 0 &&
    m.u8((pQuestDataEx + 0x11a) >>> 0) !== 0
  ) {
    m.setU8((pQuestDataEx + 0x11a) >>> 0, 0)
    m.setU8((quest + 0x0c) >>> 0, 5)
    const szBuf = allocScratch(0x80)
    writeDebugQuestStateStr(m, szBuf, 5)
    if (m.u32(0x6fd31c20) !== 0) {
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        szBuf,
        m.u32((quest + 0x04) >>> 0) >>> 0,
        4,
      )
    }
    freeScratch(0x80)
    invokeQuestFilterCallbackF0(m, quest, 0x14d)
  }

  const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff
  const nCount64 = m.u16((pQuestDataEx + 0x64) >>> 0) & 0xffff
  if ((nCount64 | 0) <= 0) return

  let foundIdx = -1
  for (let i = 0; i < nCount64; i++) {
    if ((m.u32((pQuestDataEx + 0x34 + i * 4) >>> 0) >>> 0) === dwPlayerGuid) {
      foundIdx = i
      break
    }
  }
  if (foundIdx < 0) return

  if (foundIdx !== nCount64 - 1) {
    const lastGuid = m.u32((pQuestDataEx + 0x30 + nCount64 * 4) >>> 0) >>> 0
    m.setU32((pQuestDataEx + 0x34 + foundIdx * 4) >>> 0, lastGuid)
  }
  const nCount30 = m.u16((pQuestDataEx + 0x30) >>> 0) & 0xffff
  m.setU16((pQuestDataEx + 0x64) >>> 0, (nCount64 - 1) & 0xffff)
  if (nCount30 < 0x0c) {
    m.setU32((pQuestDataEx + nCount30 * 4) >>> 0, dwPlayerGuid)
    m.setU16((pQuestDataEx + 0x30) >>> 0, (nCount30 + 1) & 0xffff)
  }
}

/**
 * [26/30] Handles Akara (`wNpcId == 0x94`) intro (`0x40`) and Den of Evil completion reward
 * (`0x4C`: grants `+1` skill point via `STATLIST_AddUnitStat(pPlayer, 5, 1, 0)` and updates quest flags).
 *
 * @dll D2Game.dll
 * @va 0x6FC85260
 * @ordinalOrName D2Game_6FC85260
 */
export function ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC85260)
  const quest = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  if ((m.u16((arg + 0x14) >>> 0) & 0xffff) !== 0x94) {
    return
  }
  const wMsgIdx = m.u16((arg + 0x18) >>> 0) & 0xffff
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0
  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestRec = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if (wMsgIdx === 0x40) {
    m.setU8((pQuestDataEx + 0x86) >>> 0, 1)
    m.setU8((quest + 0x0c) >>> 0, 2)
    const szBuf = allocScratch(0x80)
    writeDebugQuestStateStr(m, szBuf, 2)
    if (m.u32(0x6fd31c20) !== 0) {
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        szBuf,
        m.u32((quest + 0x04) >>> 0) >>> 0,
        4,
      )
    }
    freeScratch(0x80)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((quest + 0x04) >>> 0) >>> 0,
      ACT1Q1_UpdatePlayerQuestStateCallback_6FC82370_113c,
      0,
      0,
    )
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((arg + 0x08) >>> 0) >>> 0,
      pPlayer,
      m.u32(arg) >>> 0,
    )
    return
  }

  if (wMsgIdx !== 0x4c) {
    return
  }
  const nQuestId = m.u32((quest + 0xe0) >>> 0) | 0
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestRec, nQuestId, 1) | 0) !== 1) {
    return
  }
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestRec, m.u32((quest + 0xe0) >>> 0) | 0, 0x0d) | 0) !== 0) {
    if (m.u8((quest + 0x0c) >>> 0) !== 5) {
      W7_SetQuestStateAndDebugPrint_6FC55EB0_113c(m, quest, 5)
      invokeQuestFilterCallbackF0(m, quest, 0x10a)
      m.setU8((quest + 0x14) >>> 0, 0)
      m.setU8((quest + 0x0b) >>> 0, 0x0d)
    }
    m.setU32((quest + 0xa8) >>> 0, 0)
  }

  QUESTRECORD_SetQuestState113c(m, pQuestRec, m.u32((quest + 0xe0) >>> 0) | 0, 0)
  QUESTRECORD_ClearQuestState113c(m, pQuestRec, m.u32((quest + 0xe0) >>> 0) | 0, 1)
  QUESTRECORD_SetQuestState113c(m, pQuestRec, m.u32((quest + 0xe4) >>> 0) | 0, 0x0d)
  QUESTRECORD_SetQuestState113c(m, pQuestRec, m.u32((quest + 0xe4) >>> 0) | 0, 1)
  QUESTRECORD_ClearQuestStateBits2To11_113c(m, pQuestRec, m.u32((quest + 0xe0) >>> 0) | 0)
  STATLIST_AddUnitStat113c(m, pPlayer, 5, 1, 0)
  const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff
  QUESTS_GuidListAdd113c(m, (quest + 0x1c) >>> 0, dwPlayerGuid)
  QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
    m,
    m.u32((arg + 0x08) >>> 0) >>> 0,
    pPlayer,
    m.u32(arg) >>> 0,
  )
}

/**
 * [27/30] Sequence filter callback for Act 1 Quest 1: schedules `ACT1Q3_ActivateQuestState1_6FC83D20`
 * (`+0x14` ticks) when `quest + 0x0C == 0` and `quest + 0x09 == 1`.
 *
 * @dll D2Game.dll
 * @va 0x6FC85410
 * @ordinalOrName D2Game_6FC85410
 */
export function ACT1Q1_SequenceFilter_6FC85410_113c(
  m: SparseMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FC85410)
  const quest = pQuestData >>> 0
  if (m.u8((quest + 0x0c) >>> 0) === 0 && m.u8((quest + 0x09) >>> 0) === 1) {
    QUESTS_AppendQuestTimer_6FC53AF0_113c(
      m,
      0x14,
      quest,
      0x6fc83d20,
    )
  }
  return 1
}

/**
 * [28/30] Promotes Act 1 Quest 2 / Quest 4 state (`quest + 0x0C = 3`) and updates players
 * via `ACT1Q4_PromoteQuestState3AndUpdatePlayers_6FC84940` when `pQuestDataEx + 0x4F != 1` and `quest + 0x0C <= 5`.
 *
 * @dll D2Game.dll
 * @va 0x6FC85440
 * @ordinalOrName D2Game_6FC85440
 */
export function ACT1Q2_OnBurialGroundsEntered_6FC85440_113c(
  m: SparseMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FC85440)
  const quest = pQuestData >>> 0
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestDataEx + 0x4f) >>> 0) === 1 || m.u8((quest + 0x0c) >>> 0) > 5) {
    return
  }
  m.setU8((quest + 0x0c) >>> 0, 3)
  const szBuf = allocScratch(0x80)
  writeDebugQuestStateStr(m, szBuf, 3)
  if (m.u32(0x6fd31c20) !== 0) {
    NET_BroadcastSystemChatMessage_6FCEBE70_113c(
      m,
      szBuf,
      m.u32((quest + 0x04) >>> 0) >>> 0,
      4,
    )
  }
  freeScratch(0x80)
  ACT1Q4_PromoteQuestState3AndUpdatePlayers_6FC84940_113c(m, quest)
}

/**
 * [29/30] Decrements `pQuestDataEx + 0x7C` when Scroll of Inifuss (`'bkd '` / `'bks '`) is removed
 * and promotes quest state `3` if all scrolls are gone and `+0x4F != 1 && +0x47 == 1`.
 *
 * @dll D2Game.dll
 * @va 0x6FC854A0
 * @ordinalOrName D2Game_6FC854A0
 */
export function ACT1Q4_OnScrollPickedUpOrDropped_6FC854A0_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC854A0)
  const quest = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  if (m.u8((quest + 0x09) >>> 0) === 0 || m.u8((quest + 0x0c) >>> 0) === 6) {
    return
  }
  const pItem = m.u32((arg + 0x08) >>> 0) >>> 0
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0
  const dwCode = ITEMS_GetBaseCode113c(m, pItem) >>> 0
  if (dwCode === 0x20646b62 || dwCode === 0x20736b62) {
    m.setU32((pQuestDataEx + 0x7c) >>> 0, (m.u32((pQuestDataEx + 0x7c) >>> 0) - 1) >>> 0)
  }
  if (
    m.u32((pQuestDataEx + 0x7c) >>> 0) === 0 &&
    m.u8((quest + 0x0c) >>> 0) <= 5 &&
    m.u8((pQuestDataEx + 0x4f) >>> 0) !== 1 &&
    m.u8((pQuestDataEx + 0x47) >>> 0) === 1
  ) {
    W7_SetQuestStateAndDebugPrint_6FC55EB0_113c(m, quest, 3)
    ACT1Q4_PromoteQuestState3AndUpdatePlayers_6FC84940_113c(m, quest)
  }
}

/**
 * [30/30] Decrements Horadric Malus count (`pQuestDataEx + 0x9C`) when dropped/removed and resets
 * Malus stand (`ACT1Q3_PromoteQuestState3AndResetMalusStand_6FC84C10`) if count reaches `0` and `+0x98 == 2`.
 *
 * @dll D2Game.dll
 * @va 0x6FC855F0
 * @ordinalOrName D2Game_6FC855F0
 */
export function ACT1Q5_OnHoradricMalusDroppedOrRemoved_6FC855F0_113c(
  m: SparseMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FC855F0)
  const quest = pQuestData >>> 0
  if (m.u8((quest + 0x09) >>> 0) === 0) {
    return
  }
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0
  const nMalusCount = (m.u32((pQuestDataEx + 0x9c) >>> 0) - 1) >>> 0
  m.setU32((pQuestDataEx + 0x9c) >>> 0, nMalusCount)
  if (nMalusCount === 0 && (m.u32((pQuestDataEx + 0x98) >>> 0) >>> 0) === 2) {
    ACT1Q3_PromoteQuestState3AndResetMalusStand_6FC84C10_113c(m, quest)
  }
}
