/**
 * D2Game.dll 1.13c — [K2] Wave 11 Batch 1 (w11b1).
 *
 * Clean-room 1:1 binary-isomorphic port of 30 D2Game.dll v1.13c functions in
 * the 0x6FC3CAE0..0x6FD01C00 address range.
 */

import {
  COLLISION_FindFreeCoordsNear113c,
  COLLISION_FindFreePositionSimple113c,
  COLLISION_FindFreePositionWithStep113c,
  COLLISION_ResetMaskWithPattern113c,
  COLLISION_SetUnitCollisionMaskWithPattern113c,
} from '../common/collision'
import {
  UNITS_GetField7C_113c,
  UNITS_GetObjectPortalFlags113c,
  UNITS_GetPlayerData113c,
  UNITS_SetObjectPortalFlags113c,
} from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import { PATH_WarpUnitToRoomAndCoord113c } from '../common/drlg/maze'
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_FindFreeSpawnPositionInLevel113c,
  DUNGEON_FindWarpPortalUnitInTargetLevel113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordListFromSubtile113c,
  DUNGEON_GetRoomCoordListIndexAtSubtile113c,
  DUNGEON_GetRoomCoordinates113c,
  DUNGEON_ToggleHasPortalFlag113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32 } from '../common/int-math'
import {
  INVENTORY_AllocInventory113c,
  INVENTORY_GetCursorItem113c,
} from '../common/inventory'
import { DRLGWARP_TestRoomTileBit113c } from '../common/items'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
} from '../common/k0-d2common-memports'
import { MISSILE_GetLevel113c, MISSILE_GetSkill113c } from '../common/missile'
import {
  PATH_Compute113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPathPoints113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetPrevTargetX113c,
  PATH_GetPrevTargetY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_GetUnitCollisionPattern113c,
  PATH_SetMoveTestCollisionMask113c,
  PATH_SetType113c,
  PATH_SetUnitCollisionPattern113c,
  PATH_SetVelocity113c,
  UNITS_GetDirectionToCoords113c,
} from '../common/path'
import {
  UNITS_GetRightSkill113c,
  UNITS_InitPlayerData113c,
} from '../common/quest-record'
import {
  SKILLS_AllocSkillList113c,
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillToHitBonus113c,
  SKILLS_InitCharStartSkills113c,
  SKILLS_RefreshPassiveAuraSkills113c,
  SKILLS_RemoveAllCurseAndDebuffStatesFromUnit113c,
  SKILLS_SetParam0C113c,
  SKILLS_SetParam1113c,
  SKILLS_SetParam2113c,
  SKILLS_SetParam3113c,
  SKILLS_SetParam4113c,
  SKILLS_SetRightSkill113c,
} from '../common/skills'
import {
  STATES_CheckState113c,
  STATES_ClearGfxStateFlag113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetUnitHirelingResurrectCost113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RefreshUnit113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_FindFreeCoords113c,
  UNITS_GetRoom113c,
  UNITS_GetUnitSizeX113c,
} from '../common/unit'
import type { SparseMemory113c } from '../mem/sparse-memory'
import { type D2SeedStrc, seedRoll } from '../prng'
import {
  DATATBLS_GetDirectionOffset113c,
  DATATBLS_NormalizeDirection113c,
} from '../tables/datatbls-113c'
import {
  DATATBLS_GetLevelDefRecord113c,
  DATATBLS_GetLevelsTxtRecord113c,
} from '../tables/lvl-tbls-113c'
import {
  ACT4Q2_Callback03_LevelChanged113c,
  QUESTS_NotifyLevelChange113c,
} from './a1c-post150-f150-f276-113c'
import { SKILLS_ConsumeProgressiveChargesOnHit113c } from './a1c-post150-f786-f1040-113c'
import {
  AI_CalcApproxUnitDistSubtiles113c,
  AI_CastSkillWithMode113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c'
import {
  D2GAME_ITEMSTAT_OnStatChangedCallback113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c'
import { PLAYER_StartModeAtCoords113c } from './c2s-packet-113c'
import {
  AI_FleeFrom113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_FindCombatDamageData113c,
  SUNITDMG_GetPlayerClientClassId113c,
} from './combat-a1c-113c'
import { SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c } from './k2-real-s2c-combat-113c'
import {
  AI_ApproachTarget113c,
  type FallenSliceWorld113c,
  syncActRoomsAndUnitsIntoWorld113c,
} from './replay-kernel-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import {
  ITEMS_RegisterItemEventCallback113c,
  STATES_CreateOrUpdateAuraStatList113c,
  SUNIT_AreUnitsInSamePartyOrAligned113c,
} from './k2-gap-itemdef-113c'
import {
  ITEMEVENT_RemoveByTypeAndState113c,
  MISSILE_SpawnNova64Directions113c,
  SKILLS_ResolveChargedSrvMissileId113c,
  STATES_OnTimedStateRemoved113c,
  type K2GapMeleeDotHooks113c,
} from './k2-gap-melee-dot-113c'
import { MONUMOD_MarkBossAndIncrementUniqueCount113c } from './k2-items-tc-w1-113c'
import { SUNIT_GetOwnerUnit113c } from './k2-sunit-spawn-w1-113c'
import {
  MONSTER_GetMonsterDataField2C_6FC21DD0_113c,
  PLAYER_GetQuestRecordForDifficulty_6FC21020_113c,
  SKILLS_EvalLinearParam12_6FC21B10_113c,
  SKILLS_GetMaxSkillLevel_6FC21740_113c,
} from './k2-laneH-0x6fc2-w1-113c'
import { AI_CountAdjacentUnitsCallback_6FC35590_113c } from './k2-laneI-0x6fc3-w1-113c'
import { QUESTS_CheckGlobalQuestState_6FC538D0_113c } from './k2-laneJ-0x6fc4-w1-113c'
import { PLAYER_GetPlayerDataField48_6FC57440_113c } from './k2-laneK-0x6fc5-w1-113c'
import {
  CLIENTS_IsActionRateLimitExceeded_6FC6A660_113c,
  CLIENTS_RecordActionRateLimitFrame_6FC6A6E0_113c,
  CLIENTS_SetClientActNo_6FC69D70_113c,
  CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c,
  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c,
  SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c,
  SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c,
  SKILLS_ApplySummonResistStatList_6FC6E180_113c,
} from './k2-laneL-0x6fc6-w1-113c'
import {
  ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c,
  ACT5Q6_ActiveFilter_6FC76810_113c,
  ACT5Q6_Callback11_RemovePlayerGuid_6FC775D0_113c,
  ACT5Q6_Callback14_PlayerJoined_6FC77540_113c,
} from './k2-laneM-0x6fc7-w1-113c'
import {
  DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c,
  NPCS_RepairPlayerItemOrAllItems_6FCDDE60_113c,
  NPCS_ResurrectOrReplacePlayerMerc_6FCE0B90_113c,
  PETS_AllocAndInitPlayerPetTable_6FCB7120_113c,
  PETS_CleanupAllPlayerPetsOnActChangeOrSave_6FCB7730_113c,
  PETS_InsertPetIntoPlayerPetSlot_6FCB7A20_113c,
  QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c,
  SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c,
  SKILLS_ApplyTimedSkillAuraToTarget_6FC49240_113c,
  SKILLS_SpendSkillPointsAndIncrementSkill_6FCBFAE0_113c,
} from './k2-w10b1-113c'
import { PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c } from './k2-w2b1-113c'
import {
  NET_SendPacket07_RoomTileCoords_6FCABF50_113c,
  NET_SendPacket15B_TransactionResult_6FCAAC90_113c,
  NET_SendPacket9B_MercReviveInfo_6FCAA690_113c,
} from './k2-w2b3-113c'
import {
  S2C_QueueSingleBytePacket1_6FCAC490_113c,
  SUMMON_GetPetTypeBucketPtr_6FCB6540_113c,
} from './k2-w2b4-113c'
import { ARENA_AllocPlayerArenaUnit_6FCD24D0_113c } from './k2-w2b5-113c'
import {
  ACT2Q2_IsQuestInState01_6FCE1B20_113c,
  ACT2Q2_IsQuestPastState01_6FCE1B60_113c,
} from './k2-w2b6-113c'
import { STATES_ClearGfxStateFlag_6FCEB1A0_113c } from './k2-w2b7-113c'
import {
  AI_ScheduleAiThinkTimer_6FD120C0_113c,
  MONSTER_SpawnAtCoords_6FD0F450_113c,
} from './k2-w2b8-113c'
import { QUESTS_CheckLevelTransitionBlocked_6FC54020_113c } from './k2-w3b3-113c'
import {
  ACT5Q5_Callback00_NpcActivate_6FC775F0_113c,
  ACT5Q6_SeqFilter_6FC767A0_113c,
} from './k2-w3b5-113c'
import { OBJ_ApplyShrineAuraStatList_6FC8A960_113c } from './k2-w3b7-113c'
import { UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c } from './k2-w3b8-113c'
import { PLAYER_AllocPlayerDataQuestBitBuffers_6FC576F0_113c } from './k2-w4b2-113c'
import { NET_SendPacket13B_UnitCoordEvent_6FCAC280_113c } from './k2-w4b4-113c'
import {
  NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c,
  PETS_ForEachPlayerPetUnit_6FCB6AF0_113c,
  PETS_GetFirstPetUnitByType_6FCB6A40_113c,
  PETS_SendPetOrMercAssignPacket_6FCB66E0_113c,
} from './k2-w4b5-113c'
import {
  ACT_AllocGameActAndInitEclipse_6FCBD6F0_113c,
  CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c,
  SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c,
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c,
  SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c,
  SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c,
  STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c,
} from './k2-w4b6-113c'
import {
  AI_WalkWanderAroundSelf_6FD129B0_113c,
  AI_WalkWanderAroundUnitOrSelf_6FD12870_113c,
} from './k2-w5b10-113c'
import {
  ACT2Q4_UnitIterate_CheckNearHorazonTome_6FCE31C0_113c,
  NPC_DeductPlayerGoldAndStash_6FCDCC60_113c,
} from './k2-w5b4-113c'
import { SKILLS_ValidateSkillAllocationEligibility_6FCEB610_113c } from './k2-w5b5-113c'
import { SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c } from './k2-w5b6-113c'
import {
  SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c,
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c,
} from './k2-w5b7-113c'
import { ACT5Q5_Callback00_NpcActivateQualKehk_6FC79BE0_113c } from './k2-w6b4-113c'
import { ACT5Q5_NpcIntroAndScrolls_6FC7F200_113c } from './k2-w8b1-113c'
import {
  PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c,
  PETS_UnsummonSameGroupPetTypes_6FCB7C20_113c,
} from './k2-w8b2-113c'
import {
  PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c,
  PETS_WarpOrUnsummonPlayerPets_6FCB7340_113c,
} from './k2-w9b1-113c'
import { UNITS_ChangeAnimMode113c } from './monster-events'
import {
  MONSTER_Create113c,
  MONSTER_ScheduleInitialAiEvent113c,
  MONSTER_SpawnAtCoords113c,
  REGPOP_FindPackSpawnCoords113c,
  ROOM_FindRoomContainingSubtile113c,
  SUNIT_SetMonsterAlignmentState113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import { CLIENTS_GetPlayerUnit113c, SUNIT_FreeUnit113c } from './replay-final11-113c'
import {
  EVENT_DeleteEventByArg14_113c,
  EVENT_FreeNode113c,
  EVENT_RemoveUnitEvents113c,
  EVENT_SetEventFull113c,
  MONSTER_RefreshAiEvent113c,
} from './timer-wheel'
import { UNITS_GetOctileDistanceToCoordinates113c } from './town-npc-ai-113c'
import { SUNIT_UpdateUnitPositionAndRoom113c } from './town-runtime-gap-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

const u8 = (m: SparseMemory113c, a: number): number => m.u8(a >>> 0) & 0xff
const u16 = (m: SparseMemory113c, a: number): number => m.u16(a >>> 0) & 0xffff
const i16 = (m: SparseMemory113c, a: number): number => (m.u16(a >>> 0) << 16) >> 16
const u32 = (m: SparseMemory113c, a: number): number => m.u32(a >>> 0) >>> 0
const i32 = (m: SparseMemory113c, a: number): number => m.u32(a >>> 0) | 0
const w8 = (m: SparseMemory113c, a: number, v: number): void => m.setU8(a >>> 0, v & 0xff)
const w16 = (m: SparseMemory113c, a: number, v: number): void => m.setU16(a >>> 0, v & 0xffff)
const w32 = (m: SparseMemory113c, a: number, v: number): void => m.setU32(a >>> 0, v >>> 0)

const SGPT_DATA_TABLES_PTR_SLOT_113C = 0x6fde_9e1c
const K2_W11B1_SCRATCH_BASE = 0x7f9c_4000
const K2_W11B1_HEAP_PTR_SLOT = 0x7f9c_4ff0
const K2_W11B1_HEAP_BASE = 0x7f9c_5000

const AI_DIR_OFFSET_TABLE_6FD1CED8 = [4, 3, 2, 1, 0, 7, 6, 5] as const
const AI_DIR_OFFSET_TABLE_6FD1CEE0 = [4, 3, 2, 1, 0, 7, 6, 5] as const

function allocServerMem(m: SparseMemory113c, nBytes: number): number {
  let cur = u32(m, K2_W11B1_HEAP_PTR_SLOT)
  if (cur === 0) cur = K2_W11B1_HEAP_BASE
  const aligned = (cur + 7) & ~7
  const size = Math.max(8, (nBytes + 7) & ~7)
  w32(m, K2_W11B1_HEAP_PTR_SLOT, (aligned + size) >>> 0)
  for (let i = 0; i < size; i += 4) {
    w32(m, aligned + i, 0)
  }
  return aligned >>> 0
}

function readSgptDataTablesPtr(m: SparseMemory113c): number {
  const sgpt = u32(m, SGPT_DATA_TABLES_PTR_SLOT_113C)
  if (sgpt !== 0) return sgpt
  const ind = u32(m, 0x6fd1829c)
  return ind !== 0 ? u32(m, ind) : 0
}

function unitSeedOf(m: SparseMemory113c, pSeed: number): D2SeedStrc {
  return {
    get lo() {
      return u32(m, pSeed)
    },
    set lo(v: number) {
      w32(m, pSeed, v >>> 0)
    },
    get hi() {
      return u32(m, pSeed + 4)
    },
    set hi(v: number) {
      w32(m, pSeed + 4, v >>> 0)
    },
  }
}

function worldOf(m: SparseMemory113c, pGame: number): FallenSliceWorld113c {
  return {
    m,
    pGame,
    pTimer: pGame !== 0 ? u32(m, pGame + 0xb8) : 0,
    unitsByKey: new Map(),
    monsterById: new Map(),
    playerById: new Map(),
    pathUnitByPtr: new Map(),
    roomByPtr: new Map(),
    minionIdsByLeaderId: new Map(),
    lastFrameOrd: [],
    lastFrameDmg: [],
  }
}

function freeUnitEventNodesByType(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nEventType: number,
): void {
  let pNode = u32(m, pUnit + 0xdc)
  while (pNode !== 0) {
    const pNext = u32(m, pNode + 0x24)
    if (u8(m, pNode) === (nEventType & 0xff)) {
      EVENT_FreeNode113c(m, pGame, pNode)
    }
    pNode = pNext
  }
}

function sunitWarpUnitToCoords_6FD019C0(
  m: SparseMemory113c,
  nTargetX: number,
  pTargetRoom: number,
  nTargetY: number,
  pUnit: number,
  pGame: number,
  bExactCoords: number,
  bSetFlag800: number,
): number {
  return DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c(
    m,
    nTargetX,
    pTargetRoom,
    nTargetY,
    pGame,
    pUnit,
    bExactCoords,
    bSetFlag800,
  )
}

export interface PetMoveActionOps113c {
  readonly world?: FallenSliceWorld113c | undefined
  approachTarget(
    pMonster: number,
    pTarget: number,
    mode: number,
    targetX: number,
    targetY: number,
    stepNum: number,
    flags: number,
  ): boolean
  fleeFrom(
    pFrom: number,
    pMonster: number,
    distSteps: number,
    clearThinkOnFail: boolean,
  ): boolean
  idleWander(pMonster: number, range: number): boolean
  stall(pMonster: number, frames: number): void
  startMode(
    pMonster: number,
    mode: number,
    pTarget: number,
    targetX: number,
    targetY: number,
  ): boolean
}

function ensureBreadcrumbZeroedIfUnloadedW11B1(
  m: SparseMemory113c,
  baseAddr: number,
  byteLen: number,
): void {
  const memInternal = m as unknown as { known?: Map<number, Uint8Array> }
  const known = memInternal.known
  if (known === undefined) return
  for (let i = 0; i < byteLen; i++) {
    const addr = (baseAddr + i) >>> 0
    const kp = known.get(addr >>> 12)
    if (kp === undefined || kp[addr & 0xfff] === 0) {
      m.setU8(addr, 0)
    }
  }
}

function freeUnitType2Events113cW11B1(m: SparseMemory113c, pGame: number, pUnit: number): void {
  if (pUnit === 0) return
  let pEvt = u32(m, pUnit + 0xdc)
  while (pEvt !== 0) {
    const pNext = u32(m, pEvt + 0x24)
    if (u8(m, pEvt) === 2) {
      EVENT_FreeNode113c(m, pGame, pEvt)
    }
    pEvt = pNext
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC3CAE0
 * @ordinalOrName D2Game_6FC3CAE0
 */
export function AI_PetMoveActionDispatch_6FC3CAE0_113c(
  m: SparseMemory113c,
  pPetUnit: number,
  pGame: number,
  pOwnerUnit: number,
  nActionCase: number,
  nFlag: number,
  nDistOrDelay: number,
  nDirOrParam: number,
  ops?: PetMoveActionOps113c,
): number {
  hitD2GameVa113c(0x6FC3CAE0)
  if (pOwnerUnit === 0 || pPetUnit === 0) return 0
  if (nActionCase >>> 0 > 5) return 0

  const pField2C = MONSTER_GetMonsterDataField2C_6FC21DD0_113c(m, pPetUnit) >>> 0
  const pMonData = u32(m, pPetUnit) === 1 ? u32(m, pPetUnit + 0x14) : 0
  const pAiCtrl = pField2C !== 0 ? pField2C : pMonData !== 0 ? u32(m, pMonData + 0x28) : 0
  if (ops === undefined && pAiCtrl === 0) return 0

  const doApproach = (
    mode: number,
    tx: number,
    ty: number,
    stepNum: number,
    flags: number,
  ): boolean => {
    if (ops !== undefined) {
      return ops.approachTarget(pPetUnit, 0, mode, tx, ty, stepNum, flags)
    }
    return Boolean(
      AI_ApproachTarget113c(worldOf(m, pGame), pPetUnit, 0, mode, tx, ty, stepNum, flags),
    )
  }
  const doFlee = (distSteps: number, clearOnFail: boolean): boolean => {
    if (ops !== undefined) {
      return ops.fleeFrom(pOwnerUnit, pPetUnit, distSteps, clearOnFail)
    }
    return AI_FleeFrom113c(m, pGame, pPetUnit, pOwnerUnit, distSteps, clearOnFail ? 1 : 0) !== 0
  }
  const doStall = (frames: number): void => {
    if (ops !== undefined) {
      ops.stall(pPetUnit, frames)
      return
    }
    AI_Stall113c(m, pGame, pPetUnit, frames)
  }
  const doWalkWander = (pCenter: number, rad: number): boolean => {
    if (pCenter === pPetUnit) {
      return (
        AI_WalkWanderAroundSelf_6FD129B0_113c(
          m,
          rad & 0xff,
          pGame,
          pPetUnit,
          ops !== undefined ? { world: ops.world } : undefined,
        ) !== 0
      )
    }
    return (
      AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(
        m,
        pCenter,
        rad & 0xff,
        pGame,
        pPetUnit,
        ops !== undefined ? { world: ops.world } : undefined,
      ) !== 0
    )
  }

  const pScratchX = K2_W11B1_SCRATCH_BASE + 0x00
  const pScratchY = K2_W11B1_SCRATCH_BASE + 0x04
  const pOwnerPath = u32(m, pOwnerUnit + 0x2c)
  const ownerMode = i32(m, pOwnerUnit + 0x10)
  const prevX = pOwnerPath !== 0 ? (PATH_GetPrevTargetX113c(m, pOwnerPath) | 0) : 0
  const prevY = pOwnerPath !== 0 ? (PATH_GetPrevTargetY113c(m, pOwnerPath) | 0) : 0
  const petX = UNIT_GetPosX113c(m, pPetUnit) | 0
  const petY = UNIT_GetPosY113c(m, pPetUnit) | 0
  const ownerX = UNIT_GetPosX113c(m, pOwnerUnit) | 0
  const ownerY = UNIT_GetPosY113c(m, pOwnerUnit) | 0

  switch (nActionCase | 0) {
    case 0: {
      const rawDir = UNITS_GetDirectionToCoords113c(m, pOwnerUnit, prevX, prevY)
      let normDir = DATATBLS_NormalizeDirection113c(m, rawDir) & 0x07
      const pOwnerRoom = UNITS_GetRoom113c(m, pOwnerUnit)
      const ownerCoordIdx =
        DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, pOwnerRoom, ownerX, ownerY) | 0

      for (let i = 0; i < 8; i += 1) {
        const dirStep = AI_DIR_OFFSET_TABLE_6FD1CED8[normDir]!
        DATATBLS_GetDirectionOffset113c(m, dirStep, pScratchX, pScratchY)
        const candX = (prevX + (i32(m, pScratchX) << 3)) | 0
        const candY = (prevY + (i32(m, pScratchY) << 3)) | 0
        const testRoom = UNITS_GetRoom113c(m, pOwnerUnit)
        const testCoordIdx =
          DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, testRoom, candX, candY) | 0
        if (testCoordIdx === ownerCoordIdx) {
          if (pAiCtrl !== 0) {
            if (nDistOrDelay !== 0) {
              w32(m, pAiCtrl + 0x1c, nDistOrDelay >>> 0)
            }
            w8(m, pAiCtrl + 0x20, 0x28)
          }
          const mode = nFlag !== 0 ? 15 : 2
          if (doApproach(mode, candX, candY, 1, 4)) {
            return 1
          }
          const midX = ((petX + candX) >>> 1) | 0
          const midY = ((petY + candY) >>> 1) | 0
          if (doApproach(mode, midX, midY, 1, 4)) {
            return 1
          }
        }
        normDir = (normDir + 1) & 0x07
      }

      freeUnitType2Events113cW11B1(m, pGame, pPetUnit)
      if (doWalkWander(pPetUnit, 4)) {
        return 1
      }
      const midOwnerX = (petX + ownerX) >> 1
      const midOwnerY = (petY + ownerY) >> 1
      if (nFlag !== 0) {
        if (doApproach(15, midOwnerX, midOwnerY, 1, 4)) {
          return 1
        }
      }
      if (doApproach(2, midOwnerX, midOwnerY, 1, 4)) {
        return 1
      }
      return doApproach(2, ownerX, ownerY, 1, 0) ? 1 : 0
    }

    case 1: {
      if (ownerMode === 2) {
        if (pAiCtrl !== 0) {
          w8(m, pAiCtrl + 0x20, 0x4d)
        }
        if (doApproach(2, prevX, prevY, 1, 4)) {
          return 1
        }
        const midPrevX = (petX + prevX) >> 1
        const midPrevY = (petY + prevY) >> 1
        if (doApproach(2, midPrevX, midPrevY, 1, 4)) {
          return 1
        }
      }

      let speedBonus = nDistOrDelay | 0
      if (speedBonus === 0) {
        speedBonus = (seedRoll(unitSeedOf(m, pPetUnit + 0x20), 0x28) + 0x28) | 0
      }

      const pPlrData = u32(m, pOwnerUnit) === 0 ? UNITS_GetPlayerData113c(m, pOwnerUnit) : 0
      if (pPlrData !== 0) {
        ensureBreadcrumbZeroedIfUnloadedW11B1(m, (pPlrData + 0xa0) >>> 0, 0xcc)
        let bl = u8(m, pPlrData + 0xa0)
        let triedPathType1 = false
        for (let iter = 0; iter < 20; iter += 1) {
          bl = bl === 0 ? 19 : (bl - 1) & 0xff
          const histX = i32(m, pPlrData + 0xa8 + bl * 8)
          const histY = i32(m, pPlrData + 0xac + bl * 8)
          if (
            histX !== 0 &&
            histY !== 0 &&
            UNITS_GetOctileDistanceToCoordinates113c(m, pPetUnit, histX, histY) >>> 0 > 5
          ) {
            if (pAiCtrl !== 0) {
              if (speedBonus !== 0) w32(m, pAiCtrl + 0x1c, speedBonus >>> 0)
              w8(m, pAiCtrl + 0x20, 0x4d)
            }
            const firstMode = nFlag !== 0 ? 15 : 2
            const firstFlags = nFlag !== 0 ? 0 : 4
            if (doApproach(firstMode, histX, histY, 1, firstFlags)) {
              return 1
            }
            freeUnitType2Events113cW11B1(m, pGame, pPetUnit)

            const retryMode = bl !== 0 ? 15 : 2
            if (pAiCtrl !== 0) {
              w32(m, pAiCtrl + 0x18, 0x0f)
              if (speedBonus !== 0) w32(m, pAiCtrl + 0x1c, speedBonus >>> 0)
              w8(m, pAiCtrl + 0x20, 0x4d)
            }
            if (doApproach(retryMode, histX, histY, 1, 4)) {
              return 1
            }

            if (!triedPathType1) {
              triedPathType1 = true
              if (pAiCtrl !== 0) {
                w32(m, pAiCtrl + 0x18, 1)
                if (speedBonus !== 0) w32(m, pAiCtrl + 0x1c, speedBonus >>> 0)
                w8(m, pAiCtrl + 0x20, 0x4d)
              }
              if (doApproach(retryMode, histX, histY, 1, 4)) {
                return 1
              }
            }
          }
        }
      }

      const approxDist = AI_CalcApproxUnitDistSubtiles113c(m, pPetUnit, pOwnerUnit) >>> 0
      let wanderRad = approxDist >>> 2
      if (wanderRad < 4) wanderRad = 4
      if (pAiCtrl !== 0) {
        w32(m, pAiCtrl + 0x1c, 0x0f)
      }
      return doWalkWander(pPetUnit, wanderRad) ? 1 : 0
    }

    case 2: {
      if (seedRoll(unitSeedOf(m, pPetUnit + 0x20), 100) >= 10) {
        doStall(15)
        return 1
      }
      const wanderDist = (seedRoll(unitSeedOf(m, pPetUnit + 0x20), 3) + 3) & 0xff
      if (doWalkWander(pPetUnit, wanderDist)) {
        return 1
      }
      freeUnitType2Events113cW11B1(m, pGame, pPetUnit)
      if (pAiCtrl !== 0) {
        w8(m, pAiCtrl + 0x20, 0x28)
      }
      if (doApproach(2, prevX, prevY, 1, 4)) {
        return 1
      }
      doStall(15)
      return 1
    }

    case 3: {
      const pOwnerRoom = UNITS_GetRoom113c(m, pOwnerUnit)
      if (pOwnerRoom === 0) return 0
      const pCoordList = DUNGEON_GetRoomCoordListFromSubtile113c(
        m,
        pOwnerRoom,
        ownerX,
        ownerY,
      )
      const sgpt = readSgptDataTablesPtr(m)
      const nClassId = sgpt !== 0 && i32(m, sgpt + 0xa80) > 0x16b ? 0x16b : 0
      w32(m, pScratchX, ownerX >>> 0)
      w32(m, pScratchY, ownerY >>> 0)
      const hasWalkable = REGPOP_FindPackSpawnCoords113c(
        m,
        pOwnerRoom,
        pGame,
        pCoordList,
        nClassId,
        pScratchX,
        pScratchY,
        0,
      )
      if (hasWalkable === 0) return 0
      const spawnX = i32(m, pScratchX)
      const spawnY = i32(m, pScratchY)
      if (
        sunitWarpUnitToCoords_6FD019C0(m, spawnX, pOwnerRoom, spawnY, pPetUnit, pGame, 0, 0) === 0
      ) {
        return 0
      }
      w32(m, pPetUnit + 0xc8, (u32(m, pPetUnit + 0xc8) | 0x10000) >>> 0)
      doStall(5)
      return 1
    }

    case 4: {
      const pScanCtx = K2_W11B1_SCRATCH_BASE + 0x10
      w32(m, pScanCtx, pPetUnit)
      w32(m, pScanCtx + 0x04, 0)
      w32(m, pScanCtx + 0x08, 0)
      PETS_ForEachPlayerPetUnit_6FCB6AF0_113c(
        m,
        pGame,
        pOwnerUnit,
        (mem, _g, _owner, pet, ctx) => AI_CountAdjacentUnitsCallback_6FC35590_113c(mem, pet, ctx),
        pScanCtx,
      )
      if (i32(m, pScanCtx + 0x08) < 1) {
        doStall(15)
        return 1
      }
      freeUnitType2Events113cW11B1(m, pGame, pPetUnit)
      if (doFlee(nDirOrParam | 0, true)) {
        return 1
      }
      freeUnitType2Events113cW11B1(m, pGame, pPetUnit)
      if (doWalkWander(pPetUnit, nDirOrParam & 0xff)) {
        return 1
      }
      doStall(15)
      return 1
    }

    case 5: {
      if (pAiCtrl !== 0) {
        w32(m, pAiCtrl + 0x18, 7)
      }
      if (doWalkWander(pOwnerUnit, nDirOrParam & 0xff)) {
        return 1
      }
      freeUnitType2Events113cW11B1(m, pGame, pPetUnit)
      if (doFlee(nDirOrParam | 0, true)) {
        return 1
      }
      if (pAiCtrl !== 0) {
        w8(m, pAiCtrl + 0x20, 0x28)
      }
      return doApproach(2, prevX, prevY, 1, 4) ? 1 : 0
    }

    default:
      return 0
  }
}

function isFallenSliceWorldW11B1_113c(
  v: SparseMemory113c | FallenSliceWorld113c,
): v is FallenSliceWorld113c {
  return !('u32' in v)
}

/**
 * @dll D2Game.dll
 * @va 0x6FC3D3C0
 * @ordinalOrName D2Game_6FC3D3C0
 */
export function AI_MercMoveActionDispatch_6FC3D3C0_113c(
  arg0: SparseMemory113c | FallenSliceWorld113c,
  arg1: number,
  arg2: number,
  arg3 = 0,
  arg4 = 0,
  arg5 = 0,
  arg6 = 0,
  arg7 = 0,
): number {
  hitD2GameVa113c(0x6FC3D3C0)
  if (isFallenSliceWorldW11B1_113c(arg0)) {
    const world = arg0
    const { m, pGame } = world
    const pMerc = arg1 >>> 0
    const pOwner = arg2 >>> 0
    const subAction = arg3 | 0
    const bRunMode = arg4 | 0
    const velOverride = arg5 | 0
    const wanderArg = arg6 | 0

    const pOwnerData = pOwner !== 0 && m.u32(pOwner) === 0 ? (m.u32((pOwner + 0x14) >>> 0) >>> 0) : 0
    const pOwnerPath = pOwner !== 0 ? (m.u32((pOwner + 0x2c) >>> 0) >>> 0) : 0
    const ownerPrevTargetX = pOwnerPath !== 0 ? (PATH_GetPrevTargetX113c(m, pOwnerPath) | 0) : 0
    const ownerPrevTargetY = pOwnerPath !== 0 ? (PATH_GetPrevTargetY113c(m, pOwnerPath) | 0) : 0

    const pMonData = pMerc !== 0 ? (m.u32((pMerc + 0x14) >>> 0) >>> 0) : 0
    const pAiCtrl = pMonData !== 0 ? (m.u32((pMonData + 0x2c) >>> 0) >>> 0) : 0
    const pSeed = (pMerc + 0x20) >>> 0
    const rollSeedLim = (nMax: number): number => {
      const max = nMax | 0
      if (max <= 0) return 0
      const s: D2SeedStrc = { lo: m.u32(pSeed) >>> 0, hi: m.u32((pSeed + 4) >>> 0) >>> 0 }
      const r = seedRoll(s, max) | 0
      m.setU32(pSeed, s.lo >>> 0)
      m.setU32((pSeed + 4) >>> 0, s.hi >>> 0)
      return r
    }
    const ringDirs = [4, 3, 2, 1, 0, 7, 6, 5]

    switch (subAction) {
      case 0: {
        const rawDir = UNITS_GetDirectionToCoords113c(m, pOwner, ownerPrevTargetX, ownerPrevTargetY)
        let dirIdx = DATATBLS_NormalizeDirection113c(m, rawDir) & 7
        const pOwnerRoom = UNITS_GetRoom113c(m, pOwner) >>> 0
        const ownerX = UNIT_GetPosX113c(m, pOwner) | 0
        const ownerY = UNIT_GetPosY113c(m, pOwner) | 0
        const ownerCoordIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, pOwnerRoom, ownerX, ownerY)
        const sp = m.alloc(0x10)
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const mappedDir = ringDirs[dirIdx & 7]!
          DATATBLS_GetDirectionOffset113c(m, mappedDir, sp, (sp + 4) >>> 0)
          const offX = m.u32(sp) | 0
          const offY = m.u32((sp + 4) >>> 0) | 0
          const tx = (ownerPrevTargetX + offX * 8) | 0
          const ty = (ownerPrevTargetY + offY * 8) | 0
          if (
            DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, pOwnerRoom, tx, ty) === ownerCoordIdx
          ) {
            if (pAiCtrl !== 0) {
              if (velOverride !== 0) {
                m.setU32((pAiCtrl + 0x1c) >>> 0, velOverride >>> 0)
              }
              m.setU8((pAiCtrl + 0x20) >>> 0, 0x28)
            }
            if (AI_ApproachTarget113c(world, pMerc, 0, 2, tx, ty, 1, 4)) {
              return 1
            }
          }
          dirIdx = (dirIdx + 1) & 7
        }
        EVENT_DeleteEventByArg14_113c(m, pGame, pMerc, 2, 0)
        AI_WalkWanderAroundSelf_6FD129B0_113c(m, 4, pGame, pMerc, { world })
        return 1
      }

      case 1: {
        const ownerMode = m.u32((pOwner + 0x10) >>> 0) | 0
        if (ownerMode === 2) {
          if (pAiCtrl !== 0) {
            m.setU8((pAiCtrl + 0x20) >>> 0, 0x4d)
          }
          AI_ApproachTarget113c(world, pMerc, 0, 2, ownerPrevTargetX, ownerPrevTargetY, 1, 0)
          return 1
        }

        let effVel = velOverride | 0
        if (effVel === 0) {
          effVel = (rollSeedLim(15) + 0x32) | 0
        }
        let crumbIdx = pOwnerData !== 0 ? m.u8((pOwnerData + 0xa0) >>> 0) : 0
        let retriedPathType1 = false

        for (let i = 0; i < 20; i += 1) {
          crumbIdx = crumbIdx === 0 ? 0x13 : (crumbIdx - 1) & 0xff
          const cx = pOwnerData !== 0 ? (m.u32((pOwnerData + 0xa8 + crumbIdx * 8) >>> 0) | 0) : 0
          const cy = pOwnerData !== 0 ? (m.u32((pOwnerData + 0xac + crumbIdx * 8) >>> 0) | 0) : 0
          const dCrumb = UNITS_GetOctileDistanceToCoordinates113c(m, pMerc, cx, cy)
          if (dCrumb <= 5) continue

          if (pAiCtrl !== 0) {
            if (effVel !== 0) m.setU32((pAiCtrl + 0x1c) >>> 0, effVel >>> 0)
            m.setU8((pAiCtrl + 0x20) >>> 0, 0x4d)
          }
          if (AI_ApproachTarget113c(world, pMerc, 0, 2, cx, cy, 1, 4)) {
            return 1
          }
          EVENT_DeleteEventByArg14_113c(m, pGame, pMerc, 2, 0)

          if (pAiCtrl !== 0) {
            m.setU32((pAiCtrl + 0x18) >>> 0, 0x0f)
            if (effVel !== 0) m.setU32((pAiCtrl + 0x1c) >>> 0, effVel >>> 0)
            m.setU8((pAiCtrl + 0x20) >>> 0, 0x4d)
          }
          const moveMode = bRunMode !== 0 ? 15 : 2
          const moveFlags = bRunMode !== 0 ? 0 : 4
          if (AI_ApproachTarget113c(world, pMerc, 0, moveMode, cx, cy, 1, moveFlags)) {
            return 1
          }
          EVENT_DeleteEventByArg14_113c(m, pGame, pMerc, 2, 0)

          if (!retriedPathType1 && pAiCtrl !== 0) {
            retriedPathType1 = true
            m.setU32((pAiCtrl + 0x18) >>> 0, 1)
            if (effVel !== 0) m.setU32((pAiCtrl + 0x1c) >>> 0, effVel >>> 0)
            m.setU8((pAiCtrl + 0x20) >>> 0, 0x4d)
            if (AI_ApproachTarget113c(world, pMerc, 0, moveMode, cx, cy, 1, moveFlags)) {
              return 1
            }
            EVENT_DeleteEventByArg14_113c(m, pGame, pMerc, 2, 0)
          }
        }

        const dOwner = AI_CalcApproxUnitDistSubtiles113c(m, pMerc, pOwner)
        let boxRange = dOwner >>> 2
        if (boxRange < 4) boxRange = 4
        if (pAiCtrl !== 0) {
          m.setU32((pAiCtrl + 0x1c) >>> 0, 0x0f)
        }
        AI_WalkWanderAroundSelf_6FD129B0_113c(m, boxRange & 0xff, pGame, pMerc, { world })
        return 1
      }

      case 2: {
        if (rollSeedLim(100) < 10) {
          const boxRange = (rollSeedLim(3) + 3) & 0xff
          if (AI_WalkWanderAroundSelf_6FD129B0_113c(m, boxRange, pGame, pMerc, { world }) !== 0) {
            return 1
          }
          EVENT_DeleteEventByArg14_113c(m, pGame, pMerc, 2, 0)
          if (pAiCtrl !== 0) {
            m.setU8((pAiCtrl + 0x20) >>> 0, 0x28)
          }
          AI_ApproachTarget113c(world, pMerc, 0, 2, ownerPrevTargetX, ownerPrevTargetY, 1, 0)
          return 1
        }
        AI_Stall113c(world, pMerc, 15)
        return 1
      }

      case 3: {
        const pOwnerRoom = UNITS_GetRoom113c(m, pOwner) >>> 0
        const ox = UNIT_GetPosX113c(m, pOwner) | 0
        const oy = UNIT_GetPosY113c(m, pOwner) | 0
        const pCoordList = DUNGEON_GetRoomCoordListFromSubtile113c(m, pOwnerRoom, ox, oy) >>> 0
        const sgpt = readSgptDataTablesPtr(m as SparseMemory113c)
        const nMonCount = sgpt !== 0 ? (m.u32((sgpt + 0xa80) >>> 0) | 0) : 0
        const checkClassId = nMonCount > 0x16b ? 0x16b : 0
        const sp = m.alloc(0x10)
        m.setU32(sp, 0)
        m.setU32((sp + 4) >>> 0, 0)
        if (
          REGPOP_FindPackSpawnCoords113c(
            m,
            pOwnerRoom,
            pGame,
            pCoordList,
            checkClassId,
            sp,
            (sp + 4) >>> 0,
            0,
          ) === 0
        ) {
          return 0
        }
        const tx = m.u32(sp) | 0
        const ty = m.u32((sp + 4) >>> 0) | 0
        const pDestRoom = ROOM_FindRoomContainingSubtile113c(m, pOwnerRoom, tx, ty) >>> 0
        if (pDestRoom === 0) return 0
        if (
          DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c(
            m as unknown as Parameters<typeof DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c>[0],
            tx,
            pDestRoom,
            ty,
            pGame,
            pMerc,
            0,
            0,
          ) === 0
        ) {
          return 0
        }
        UNITROOM_RefreshUnit113c(m, pMerc)
        m.setU32((pMerc + 0xc8) >>> 0, (m.u32((pMerc + 0xc8) >>> 0) | 0x10000) >>> 0)
        syncActRoomsAndUnitsIntoWorld113c(world)
        AI_Stall113c(world, pMerc, 5)
        return 1
      }

      case 4: {
        const sp = m.alloc(0x18)
        m.setU32(sp, pMerc >>> 0)
        m.setU32((sp + 4) >>> 0, 0)
        m.setU32((sp + 8) >>> 0, 0)
        PETS_ForEachPlayerPetUnit_6FCB6AF0_113c(
          m,
          pGame,
          pOwner,
          AI_CountAdjacentUnitsCallback_6FC35590_113c,
          sp,
        )
        const nOverlap = m.u32((sp + 4) >>> 0) | 0
        const pOtherPet = m.u32((sp + 8) >>> 0) >>> 0
        if (nOverlap >= 1) {
          EVENT_DeleteEventByArg14_113c(m, pGame, pMerc, 2, 0)
          if (AI_FleeFrom113c(world, pOtherPet, pMerc, wanderArg, true)) {
            return 1
          }
          EVENT_DeleteEventByArg14_113c(m, pGame, pMerc, 2, 0)
          AI_WalkWanderAroundSelf_6FD129B0_113c(m, wanderArg & 0xff, pGame, pMerc, { world })
          return 1
        }
        AI_Stall113c(world, pMerc, 15)
        return 1
      }

      case 5: {
        if (pAiCtrl !== 0) {
          m.setU32((pAiCtrl + 0x18) >>> 0, 7)
        }
        if (
          AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, pOwner, wanderArg & 0xff, pGame, pMerc, {
            world,
          }) !== 0
        ) {
          return 1
        }
        EVENT_DeleteEventByArg14_113c(m, pGame, pMerc, 2, 0)
        if (AI_FleeFrom113c(world, pOwner, pMerc, wanderArg, true)) {
          return 1
        }
        if (pAiCtrl !== 0) {
          m.setU8((pAiCtrl + 0x20) >>> 0, 0x28)
        }
        AI_ApproachTarget113c(world, pMerc, 0, 2, ownerPrevTargetX, ownerPrevTargetY, 1, 0)
        return 1
      }

      default:
        return 0
    }
  }

  const m = arg0 as SparseMemory113c
  const pPetUnit = arg1
  const pGame = arg2
  const pOwnerUnit = arg3
  const nActionCase = arg4
  const nFlag = arg5
  const nDistOrDelay = arg6
  const nDirOrParam = arg7
  if (pOwnerUnit === 0 || pPetUnit === 0) return 0
  const pMonData = u32(m, pPetUnit) === 1 ? u32(m, pPetUnit + 0x14) : 0
  const pAiCtrl = pMonData !== 0 ? u32(m, pMonData + 0x28) : 0
  if (pAiCtrl === 0) return 0
  if (nActionCase >>> 0 > 5) return 0

  const pScratchX = K2_W11B1_SCRATCH_BASE + 0x20
  const pScratchY = K2_W11B1_SCRATCH_BASE + 0x24

  switch (nActionCase | 0) {
    case 0: {
      const pOwnerPath = u32(m, pOwnerUnit + 0x2c)
      if (pOwnerPath === 0) return 0
      const prevY = PATH_GetPrevTargetY113c(m, pOwnerPath)
      const prevX = PATH_GetPrevTargetX113c(m, pOwnerPath)
      const rawDir = UNITS_GetDirectionToCoords113c(m, pOwnerUnit, prevX, prevY)
      const normDir = DATATBLS_NormalizeDirection113c(m, rawDir) & 0xff
      const ownerPosY = UNIT_GetPosY113c(m, pOwnerUnit)
      const ownerPosX = UNIT_GetPosX113c(m, pOwnerUnit)
      const pOwnerRoom = UNITS_GetRoom113c(m, pOwnerUnit)
      const ownerCoordIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(
        m,
        pOwnerRoom,
        ownerPosX,
        ownerPosY,
      )

      let foundIdx = 8
      let candX = 0
      let candY = 0
      for (let i = 0; i < 8; i += 1) {
        const dirStep = ((normDir + AI_DIR_OFFSET_TABLE_6FD1CEE0[i]!) & 7) << 2
        DATATBLS_GetDirectionOffset113c(m, dirStep, pScratchX, pScratchY)
        const testX = (prevX + (i32(m, pScratchX) << 3)) | 0
        const testY = (prevY + (i32(m, pScratchY) << 3)) | 0
        const pRoomNow = UNITS_GetRoom113c(m, pOwnerUnit)
        const testCoordIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(
          m,
          pRoomNow,
          testX,
          testY,
        )
        candX = testX
        candY = testY
        if (testCoordIdx === ownerCoordIdx) {
          foundIdx = i
          break
        }
      }

      if (foundIdx < 8) {
        const mode = nDirOrParam !== 0 ? 0x0f : 0x02
        if (
          Boolean(AI_ApproachTarget113c(worldOf(m, pGame), pPetUnit, 0, mode, candX, candY, 1, 0))
        ) {
          if (nDistOrDelay < -126 || nDistOrDelay > 126) {
            throw new D2CommonAssertError('..\\Source\\D2Game\\Ai\\AiThink.cpp', 0x1bf)
          }
          w32(m, pAiCtrl + 0x1c, nDistOrDelay)
          w8(m, pAiCtrl + 0x20, 0x28)
          return 1
        }
      }

      freeUnitEventNodesByType(m, pGame, pPetUnit, 2)
      return AI_WalkWanderAroundSelf_6FD129B0_113c(m, 4, pGame, pPetUnit) !== 0 ? 1 : 0
    }

    case 1: {
      const mode = nFlag !== 0 ? 0x0f : 0x02
      if (u32(m, pOwnerUnit) === 0) {
        const pPlrData = UNITS_GetPlayerData113c(m, pOwnerUnit)
        if (pPlrData === 0) {
          throw new D2CommonAssertError('..\\Source\\D2Game\\Ai\\AiThink.cpp', 0xf6)
        }
        const headIdx = u8(m, pPlrData + 0xa0)
        for (let idx = headIdx - 1; idx >= 0; idx -= 1) {
          const histX = i32(m, pPlrData + 0xa8 + idx * 8)
          const histY = i32(m, pPlrData + 0xac + idx * 8)
          if (
            histX !== 0 &&
            histY !== 0 &&
            UNITS_GetOctileDistanceToCoordinates113c(m, pPetUnit, histX, histY) > 5
          ) {
            if (
              Boolean(AI_ApproachTarget113c(worldOf(m, pGame), pPetUnit, 0, mode, histX, histY, 1, 0))
            ) {
              return 1
            }
            freeUnitEventNodesByType(m, pGame, pPetUnit, 2)
          }
        }
        for (let idx = 19; idx >= headIdx; idx -= 1) {
          const histX = i32(m, pPlrData + 0xa8 + idx * 8)
          const histY = i32(m, pPlrData + 0xac + idx * 8)
          if (
            histX !== 0 &&
            histY !== 0 &&
            UNITS_GetOctileDistanceToCoordinates113c(m, pPetUnit, histX, histY) > 5
          ) {
            if (
              Boolean(AI_ApproachTarget113c(worldOf(m, pGame), pPetUnit, 0, mode, histX, histY, 1, 0))
            ) {
              return 1
            }
            freeUnitEventNodesByType(m, pGame, pPetUnit, 2)
          }
        }
      }

      const ownerX = UNIT_GetPosX113c(m, pOwnerUnit)
      const ownerY = UNIT_GetPosY113c(m, pOwnerUnit)
      if (Boolean(AI_ApproachTarget113c(worldOf(m, pGame), pPetUnit, 0, mode, ownerX, ownerY, 1, 0))) {
        return 1
      }
      freeUnitEventNodesByType(m, pGame, pPetUnit, 2)
      let approxDist = (AI_CalcApproxUnitDistSubtiles113c(m, pPetUnit, pOwnerUnit) >>> 2) | 0
      if (approxDist < 4) approxDist = 4
      if (approxDist > 127) {
        throw new D2CommonAssertError('..\\Source\\D2Game\\Ai\\AiThink.cpp', 0x1ee)
      }
      return AI_WalkWanderAroundSelf_6FD129B0_113c(m, approxDist & 0xff, pGame, pPetUnit) !== 0
        ? 1
        : 0
    }

    case 2: {
      if (seedRoll(unitSeedOf(m, pPetUnit + 0x20), 100) < 10) {
        const wanderDist = (seedRoll(unitSeedOf(m, pPetUnit + 0x20), 3) + 3) & 0xff
        if (AI_WalkWanderAroundSelf_6FD129B0_113c(m, wanderDist, pGame, pPetUnit) !== 0) {
          return 1
        }
        freeUnitEventNodesByType(m, pGame, pPetUnit, 2)
        const pOwnerPath = u32(m, pOwnerUnit + 0x2c)
        if (pOwnerPath !== 0) {
          const prevY = PATH_GetPrevTargetY113c(m, pOwnerPath)
          const prevX = PATH_GetPrevTargetX113c(m, pOwnerPath)
          const mode = nFlag !== 0 ? 0x0f : 0x02
          if (
            Boolean(AI_ApproachTarget113c(worldOf(m, pGame), pPetUnit, 0, mode, prevX, prevY, 1, 0))
          ) {
            return 1
          }
        }
      }
      AI_Stall113c(m, pGame, pPetUnit, 15)
      return 1
    }

    case 3: {
      const ownerPosY = UNIT_GetPosY113c(m, pOwnerUnit)
      const ownerPosX = UNIT_GetPosX113c(m, pOwnerUnit)
      const pOwnerRoom = UNITS_GetRoom113c(m, pOwnerUnit)
      const pCoordList = DUNGEON_GetRoomCoordListFromSubtile113c(
        m,
        pOwnerRoom,
        ownerPosX,
        ownerPosY,
      )
      const sgpt = readSgptDataTablesPtr(m)
      const nClassId = sgpt !== 0 && i32(m, sgpt + 0xa80) > 0x16b ? 0x16b : 0
      const pOwnerRoom2 = UNITS_GetRoom113c(m, pOwnerUnit)
      w32(m, pScratchX, 0)
      w32(m, pScratchY, 0)
      REGPOP_FindPackSpawnCoords113c(
        m,
        pOwnerRoom2,
        pGame,
        pCoordList,
        nClassId,
        pScratchX,
        pScratchY,
        0,
      )
      const spawnX = i32(m, pScratchX)
      const spawnY = i32(m, pScratchY)
      const pOwnerRoom3 = UNITS_GetRoom113c(m, pOwnerUnit)
      const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pOwnerRoom3, spawnX, spawnY)
      if (pTargetRoom !== 0) {
        if (
          sunitWarpUnitToCoords_6FD019C0(m, spawnX, pTargetRoom, spawnY, pPetUnit, pGame, 0, 0) !==
          0
        ) {
          UNITROOM_RefreshUnit113c(m, pPetUnit)
          w32(m, pPetUnit + 0xc8, (u32(m, pPetUnit + 0xc8) | 0x10000) >>> 0)
          AI_Stall113c(m, pGame, pPetUnit, 5)
          return 1
        }
      }
      return 0
    }

    case 4: {
      const pScanCtx = K2_W11B1_SCRATCH_BASE + 0x30
      w32(m, pScanCtx, pPetUnit)
      w32(m, pScanCtx + 0x04, 0)
      w32(m, pScanCtx + 0x08, MONSTER_GetMonsterDataField2C_6FC21DD0_113c(m, pPetUnit))
      w32(m, pScanCtx + 0x0c, 1)
      PETS_ForEachPlayerPetUnit_6FCB6AF0_113c(
        m,
        pGame,
        pOwnerUnit,
        (mem, _g, _owner, pet, ctx) => AI_CountAdjacentUnitsCallback_6FC35590_113c(mem, pet, ctx),
        pScanCtx,
      )
      if (i32(m, pScanCtx + 0x04) >= 1) {
        freeUnitEventNodesByType(m, pGame, pPetUnit, 2)
        if (AI_FleeFrom113c(m, pGame, pPetUnit, pOwnerUnit, nDistOrDelay, 1) !== 0) {
          return 1
        }
      }
      if (seedRoll(unitSeedOf(m, pPetUnit + 0x20), 100) < 10) {
        const wanderDist = (seedRoll(unitSeedOf(m, pPetUnit + 0x20), 3) + 3) & 0xff
        if (AI_WalkWanderAroundSelf_6FD129B0_113c(m, wanderDist, pGame, pPetUnit) !== 0) {
          return 1
        }
      }
      AI_Stall113c(m, pGame, pPetUnit, 15)
      return 1
    }

    case 5: {
      w32(m, pAiCtrl + 0x18, 7)
      const wanderDist = (seedRoll(unitSeedOf(m, pPetUnit + 0x20), 3) + 3) & 0xff
      if (
        AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, pOwnerUnit, wanderDist, pGame, pPetUnit) !==
        0
      ) {
        return 1
      }
      freeUnitEventNodesByType(m, pGame, pPetUnit, 2)
      if (AI_FleeFrom113c(m, pGame, pPetUnit, pOwnerUnit, nDistOrDelay, 1) !== 0) {
        return 1
      }
      freeUnitEventNodesByType(m, pGame, pPetUnit, 2)
      const pOwnerPath = u32(m, pOwnerUnit + 0x2c)
      if (pOwnerPath !== 0) {
        const prevY = PATH_GetPrevTargetY113c(m, pOwnerPath)
        const prevX = PATH_GetPrevTargetX113c(m, pOwnerPath)
        const mode = nFlag !== 0 ? 0x0f : 0x02
        if (Boolean(AI_ApproachTarget113c(worldOf(m, pGame), pPetUnit, 0, mode, prevX, prevY, 1, 0))) {
          return 1
        }
      }
      return 0
    }

    default:
      return 0
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC44950
 * @ordinalOrName D2Game_6FC44950
 */
export function MONUMOD_SpawnMinionOrUniqueMonster_6FC44950_113c(
  m: SparseMemory113c,
  nMonHcIdx: number,
  pCoordNode: number,
  bCheckSafeZone: number,
  pGame: number,
  pRoom: number,
  nX: number,
  nY: number,
  dwArg14: number,
): number {
  hitD2GameVa113c(0x6FC44950)
  let curX = nX | 0
  let curY = nY | 0
  const pOutX = K2_W11B1_SCRATCH_BASE + 0x68
  const pOutY = K2_W11B1_SCRATCH_BASE + 0x6c
  if (curX === 0 && curY === 0) {
    w32(m, pOutX, 0)
    w32(m, pOutY, 0)
    if (
      REGPOP_FindPackSpawnCoords113c(
        m,
        pRoom,
        pGame,
        pCoordNode,
        nMonHcIdx,
        pOutX,
        pOutY,
        bCheckSafeZone,
      ) === 0
    ) {
      return 0
    }
    curX = i32(m, pOutX)
    curY = i32(m, pOutY)
  }

  let pMonster = 0
  if (pCoordNode !== 0) {
    const pSpawnArgs = K2_W11B1_SCRATCH_BASE + 0x40
    w32(m, pSpawnArgs + 0x00, pGame)
    w32(m, pSpawnArgs + 0x04, pRoom)
    w32(m, pSpawnArgs + 0x08, pCoordNode)
    w32(m, pSpawnArgs + 0x0c, nMonHcIdx)
    w32(m, pSpawnArgs + 0x10, 1)
    w32(m, pSpawnArgs + 0x14, 0)
    w32(m, pSpawnArgs + 0x18, curX)
    w32(m, pSpawnArgs + 0x1c, curY)
    w32(m, pSpawnArgs + 0x20, 0xffffffff)
    w16(m, pSpawnArgs + 0x24, 0x40)
    pMonster = MONSTER_Create113c(m, pSpawnArgs) >>> 0
  } else if ((dwArg14 | 0) === -1) {
    pMonster = MONSTER_SpawnAtCoords113c(m, nMonHcIdx, 1, pGame, pRoom, curX, curY, -1, 0x40) >>> 0
    if (pMonster === 0) {
      pMonster = MONSTER_SpawnAtCoords113c(m, nMonHcIdx, 1, pGame, pRoom, curX, curY, 5, 0x40) >>> 0
    }
  } else {
    pMonster =
      MONSTER_SpawnAtCoords_6FD0F450_113c(
        m,
        dwArg14,
        nMonHcIdx,
        1,
        pGame,
        pRoom,
        curX,
        curY,
        -1,
        0x62,
      ) >>> 0
    if (pMonster === 0) {
      pMonster =
        MONSTER_SpawnAtCoords_6FD0F450_113c(
          m,
          dwArg14,
          nMonHcIdx,
          1,
          pGame,
          pRoom,
          curX,
          curY,
          5,
          0x62,
        ) >>> 0
    }
    if (pMonster === 0) {
      w32(m, pOutX, curX >>> 0)
      w32(m, pOutY, curY >>> 0)
      if (REGPOP_FindPackSpawnCoords113c(m, pRoom, pGame, 0, nMonHcIdx, pOutX, pOutY, 0) !== 0) {
        curX = i32(m, pOutX)
        curY = i32(m, pOutY)
        pMonster =
          MONSTER_SpawnAtCoords_6FD0F450_113c(
            m,
            dwArg14,
            nMonHcIdx,
            1,
            pGame,
            pRoom,
            curX,
            curY,
            -1,
            0x62,
          ) >>> 0
      }
    }
    if (pMonster === 0) {
      const pCoordScratch = K2_W11B1_SCRATCH_BASE + 0x70
      const ppRoomScratch = K2_W11B1_SCRATCH_BASE + 0x78
      w32(m, pCoordScratch, curX >>> 0)
      w32(m, pCoordScratch + 4, curY >>> 0)
      w32(m, ppRoomScratch, 0)
      COLLISION_FindFreeCoordsNear113c(m, pRoom, pCoordScratch, 1, 0x3c01, ppRoomScratch)
      const pNearRoom = u32(m, ppRoomScratch)
      if (pNearRoom === 0) return 0
      pMonster =
        MONSTER_SpawnAtCoords_6FD0F450_113c(
          m,
          dwArg14,
          nMonHcIdx,
          1,
          pGame,
          pNearRoom,
          i32(m, pCoordScratch),
          i32(m, pCoordScratch + 4),
          -1,
          0x62,
        ) >>> 0
    }
  }

  if (pMonster === 0) return 0
  MONUMOD_MarkBossAndIncrementUniqueCount113c(m, pMonster, pGame)
  if (u32(m, pMonster) === 1) {
    const pMonData = u32(m, pMonster + 0x14)
    if (pMonData !== 0) {
      w16(m, pMonData + 0x16, (u16(m, pMonData + 0x16) | 1) & 0xffff)
    }
  }
  QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c(m, pMonster, pGame)
  if (u32(m, pMonster) === 1) {
    const pMonData = u32(m, pMonster + 0x14)
    const pAiGeneral = pMonData !== 0 ? u32(m, pMonData + 0x28) : 0
    if (pAiGeneral !== 0) {
      w16(m, pAiGeneral + 0x08, (u16(m, pAiGeneral + 0x08) | 1) & 0xffff)
      w32(m, pAiGeneral + 0x2c, u32(m, pMonster + 0x0c))
      w32(m, pAiGeneral + 0x30, 1)
      w32(m, pAiGeneral + 0x28, pGame)
    }
  }
  return pMonster
}

/**
 * @dll D2Game.dll
 * @va 0x6FC48290
 * @ordinalOrName D2Game_6FC48290
 */
export function SKILLS_SrvDo037_LeapAttackAndChargeInit_6FC48290_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC48290)
  const sgpt = readSgptDataTablesPtr(m)
  if (sgpt === 0 || (nSkillId | 0) < 0 || (nSkillId | 0) >= i32(m, sgpt + 0xba0)) return 0
  const pSkillsTxtBase = u32(m, sgpt + 0xb98)
  const pSkillsTxt = (pSkillsTxtBase + imul32(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit, nSkillId) >>> 0
  if (pSkill === 0) {
    UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c(m, pUnit, nSkillId)
    return 0
  }

  const pTargetX = K2_W11B1_SCRATCH_BASE + 0x80
  const pTargetY = K2_W11B1_SCRATCH_BASE + 0x84
  w32(m, pTargetX, 0)
  w32(m, pTargetY, 0)
  if (
    SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, pUnit, pGame, pTargetX, pTargetY) === 0
  ) {
    UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c(m, pUnit, nSkillId)
    return 0
  }

  if (STATES_CheckState113c(m, pUnit, 0x0c) !== 0) {
    return 0
  }

  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pTargetUnit = PATH_GetTargetUnit113c(m, u32(m, pUnit + 0x2c)) >>> 0
  if (
    pTargetUnit !== pUnit &&
    pTargetUnit !== 0 &&
    UNITS_CanUnitMeleeAttackTarget113c(m, pUnit, pTargetUnit, 0) !== 0
  ) {
    UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c(m, pUnit, nSkillId)
    return SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c(
      m,
      pUnit,
      pGame,
      pTargetUnit,
    )
  }

  const isPlayer = u32(m, pUnit) === 0
  const pPath = u32(m, pUnit + 0x2c)
  if (pPath === 0) {
    UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c(m, pUnit, nSkillId)
    return 0
  }

  const savedMask = isPlayer ? 0x1c09 : 0x3c01
  PATH_SetMoveTestCollisionMask113c(m, pPath, 0xc01)
  PATH_SetType113c(m, pPath, 7)
  if (PATH_Compute113c(m, pPath, pUnit, 0) === 0) {
    UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c(m, pUnit, nSkillId)
    PATH_SetMoveTestCollisionMask113c(m, pPath, savedMask)
    return 0
  }

  const baseWalkVel = SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c(m, pUnit)
  PATH_SetVelocity113c(m, pPath, baseWalkVel, 0x6fd1cdd8, 0x3d9)
  PATH_SetMoveTestCollisionMask113c(m, pPath, 0x401)
  const ppPointsScratch = K2_W11B1_SCRATCH_BASE + 0xc0
  w32(m, ppPointsScratch, 0)
  const nPointCount = PATH_GetPathPoints113c(m, pPath, ppPointsScratch) | 0
  if (nPointCount <= 0) {
    UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c(m, pUnit, nSkillId)
    PATH_SetMoveTestCollisionMask113c(m, pPath, savedMask)
    return 0
  }

  const pPoints = u32(m, ppPointsScratch)
  const lastOffset = ((nPointCount << 2) - 4) >>> 0
  const lastX = u16(m, pPoints + lastOffset)
  const lastY = u16(m, pPoints + lastOffset + 2)
  const colPattern = PATH_GetUnitCollisionPattern113c(m, pUnit)
  const pRoom = UNITS_GetRoom113c(m, pUnit)
  COLLISION_SetUnitCollisionMaskWithPattern113c(
    m,
    pRoom,
    lastX,
    lastY,
    colPattern,
    isPlayer ? 0x80 : 0x100,
  )
  MONSTER_RefreshAiEvent113c(m, pUnit, 1)
  STATES_ToggleGfxStateFlag113c(m, pUnit, 0x12, 1)
  SKILLS_SetParam0C113c(m, pSkill, 1)
  SKILLS_SetParam1113c(m, pSkill, lastX)
  SKILLS_SetParam2113c(m, pSkill, lastY)
  SKILLS_SetParam3113c(m, pSkill, -1)
  SKILLS_SetParam4113c(m, pSkill, 0)

  const auraState = i16(m, pSkillsTxt + 0x80)
  if (auraState >= 0) {
    const sgptNow = readSgptDataTablesPtr(m)
    if (sgptNow !== 0 && auraState < i32(m, sgptNow + 0xc4)) {
      STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c(m, pUnit, auraState, 0)
      const auraLen = SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        i32(m, pSkillsTxt + 0x60),
        nSkillId,
        nSkillLevel,
      )
      const pAuraSetup = K2_W11B1_SCRATCH_BASE + 0x90
      for (let i = 0; i < 9; i += 1) {
        w32(m, pAuraSetup + i * 4, 0)
      }
      w32(m, pAuraSetup + 0x00, pUnit)
      w32(m, pAuraSetup + 0x04, pUnit)
      w32(m, pAuraSetup + 0x08, nSkillId)
      w32(m, pAuraSetup + 0x0c, nSkillLevel)
      w32(m, pAuraSetup + 0x10, auraLen)
      w32(m, pAuraSetup + 0x14, 0xffffffff)
      w32(m, pAuraSetup + 0x18, 0)
      w32(m, pAuraSetup + 0x1c, auraState)
      w32(m, pAuraSetup + 0x20, 0x6fc47190)
      const pStatList = STATES_CreateOrUpdateAuraStatList113c(m, pAuraSetup) >>> 0
      if (pStatList === 0) return 0

      SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(
        m,
        pSkillsTxt,
        pUnit,
        pStatList,
        nSkillId,
        nSkillLevel,
      )
      SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c(
        m,
        pSkillsTxt,
        pUnit,
        pStatList,
        nSkillId,
        nSkillLevel,
      )
      STATLIST_SetStat113c(m, pStatList, 0x15e, nSkillId, 0)
      STATLIST_SetStat113c(m, pStatList, 0x15f, nSkillLevel, 0)
      if (i16(m, pSkillsTxt + 0x84) >= 0) {
        ITEMEVENT_RemoveByTypeAndState113c(m, pUnit, pGame, 1, auraState)
        for (let i = 0; i < 3; i += 1) {
          const ev = i16(m, pSkillsTxt + 0x84 + i * 2)
          if (ev < 0) break
          const evFunc = i16(m, pSkillsTxt + 0x8a + i * 2)
          ITEMS_RegisterItemEventCallback113c(
            m,
            evFunc,
            auraState,
            1,
            pUnit,
            pGame,
            ev,
            nSkillId,
            nSkillLevel,
          )
        }
      }
      STATES_ClearGfxStateFlag113c(m, pUnit, auraState, 1)
    }
  }
  return 1
}

/**
 * @dll D2Game.dll
 * @va 0x6FC49720
 * @ordinalOrName D2Game_6FC49720
 */
export function SKILLS_SrvDo045_NovaAndTimedAura_6FC49720_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FC49720)
  if (pUnit !== 0) {
    w32(m, pUnit + 0xc4, (u32(m, pUnit + 0xc4) | 0x40) >>> 0)
  }
  const sgpt = readSgptDataTablesPtr(m)
  if (sgpt === 0 || nSkillId < 0 || nSkillId >= i32(m, sgpt + 0xba0)) return 0
  const pSkillsTxtBase = u32(m, sgpt + 0xb98)
  if (pSkillsTxtBase === 0) return 0
  const pSkillsTxt = (pSkillsTxtBase + imul32(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, nSkillId, pUnit)
  const sgptNow = readSgptDataTablesPtr(m)
  if (nMissileId < 0 || sgptNow === 0 || nMissileId >= i32(m, sgptNow + 0xb6c)) {
    return 0
  }
  MISSILE_SpawnNova64Directions113c(
    m,
    pUnit,
    0,
    pGame,
    pUnit,
    nMissileId,
    nSkillId,
    nSkillLevel,
    hooks,
  )
  SKILLS_ApplyTimedSkillAuraToTarget_6FC49240_113c(
    m,
    pUnit,
    pGame,
    pUnit,
    nSkillId,
    nSkillLevel,
  )
  return 1
}

/**
 * @dll D2Game.dll
 * @va 0x6FC58620
 * @ordinalOrName D2Game_6FC58620
 */
export function PLAYER_InitPlayerUnitSubsystems_6FC58620_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  dwUnitId: number,
): void {
  hitD2GameVa113c(0x6FC58620)
  void D2GAME_ITEMSTAT_OnStatChangedCallback113c
  if (pPlayerUnit === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Plr\\Plr.cpp', 0x47)
  }
  w32(m, pPlayerUnit + 0x0c, dwUnitId)
  w32(m, pPlayerUnit + 0xc4, (u32(m, pPlayerUnit + 0xc4) | 0x0e) >>> 0)
  INVENTORY_AllocInventory113c(m, 0, pPlayerUnit)
  const pSkillList = SKILLS_AllocSkillList113c(m, u32(m, pGame + 0x1c))
  w32(m, pPlayerUnit + 0xa8, pSkillList)
  SKILLS_InitCharStartSkills113c(m, pPlayerUnit)
  STATLIST_CreateEx113c(m, pPlayerUnit, 0, pGame, 0x6fcf9470)
  UNITS_InitPlayerData113c(m, pPlayerUnit)
  PLAYER_AllocPlayerDataQuestBitBuffers_6FC576F0_113c(m, pPlayerUnit, pGame)
  if (u32(m, pPlayerUnit) !== 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Plr\\Plr.cpp', 0x4bc)
  }
  const pPlrData = UNITS_GetPlayerData113c(m, pPlayerUnit)
  w32(m, pPlrData + 0x9c, 0)
  if (u32(m, pPlayerUnit + 0xdc) !== 0) {
    EVENT_RemoveUnitEvents113c(m, pGame, pPlayerUnit)
  }
  w32(m, pPlayerUnit + 0xdc, 0)
  ARENA_AllocPlayerArenaUnit_6FCD24D0_113c(m, pGame, pPlayerUnit)
  PETS_AllocAndInitPlayerPetTable_6FCB7120_113c(m, pGame, pPlayerUnit)
  SUNIT_SetMonsterAlignmentState113c(m, pPlayerUnit, 2, 1)
}

/**
 * @dll D2Game.dll
 * @va 0x6FC5EA60
 * @ordinalOrName D2Game_6FC5EA60
 */
export function MISSILE_ApplyFriendlyOwnerTimedSkillAura_6FC5EA60_113c(
  m: SparseMemory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit: number,
): number {
  hitD2GameVa113c(0x6FC5EA60)
  if (pMissile === 0) return 1
  if (((u32(m, pMissile + 0xc8) >>> 10) & 1) === 0) return 1
  const pOwner = SUNIT_GetOwnerUnit113c(m, pMissile, pGame) >>> 0
  if (pOwner === 0) return 1
  if (pTargetUnit !== 0 && SUNIT_AreUnitsInSamePartyOrAligned113c(m, pTargetUnit, pOwner) !== 0) {
    const nSkillLevel = MISSILE_GetLevel113c(m, pMissile)
    const nSkillId = MISSILE_GetSkill113c(m, pMissile)
    SKILLS_ApplyTimedSkillAuraToTarget_6FC49240_113c(
      m,
      pTargetUnit,
      pGame,
      pOwner,
      nSkillId,
      nSkillLevel,
    )
  }
  return 0
}

/**
 * @dll D2Game.dll
 * @va 0x6FC628F0
 * @ordinalOrName D2Game_6FC628F0
 */
export function SKILLS_SrvDo067_ApplyBuffStateAndItemEvents_6FC628F0_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC628F0)
  const sgpt = readSgptDataTablesPtr(m)
  if (sgpt === 0 || (nSkillId | 0) < 0 || (nSkillId | 0) >= i32(m, sgpt + 0xba0)) return 0
  const pSkillsTxtBase = u32(m, sgpt + 0xb98)
  const pSkillsTxt = (pSkillsTxtBase + imul32(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const auraState = i16(m, pSkillsTxt + 0x80)
  if (auraState < 0 || auraState >= i32(m, sgpt + 0xc4)) return 0

  if (pUnit !== 0) {
    w32(m, pUnit + 0xc4, (u32(m, pUnit + 0xc4) | 0x40) >>> 0)
  }
  STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c(m, pUnit, auraState, 1)
  const auraLen = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    i32(m, pSkillsTxt + 0x60),
    nSkillId,
    nSkillLevel,
  )
  const pAuraSetup = K2_W11B1_SCRATCH_BASE + 0x100
  for (let i = 0; i < 9; i += 1) {
    w32(m, pAuraSetup + i * 4, 0)
  }
  w32(m, pAuraSetup + 0x00, pUnit)
  w32(m, pAuraSetup + 0x04, pUnit)
  w32(m, pAuraSetup + 0x08, nSkillId)
  w32(m, pAuraSetup + 0x0c, nSkillLevel)
  w32(m, pAuraSetup + 0x10, auraLen)
  w32(m, pAuraSetup + 0x14, 0xffffffff)
  w32(m, pAuraSetup + 0x18, 0)
  w32(m, pAuraSetup + 0x1c, auraState)
  w32(m, pAuraSetup + 0x20, 0x6fc622b0)
  const pStatList = STATES_CreateOrUpdateAuraStatList113c(m, pAuraSetup) >>> 0
  if (pStatList === 0) return 0

  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(
    m,
    pSkillsTxt,
    pUnit,
    pStatList,
    nSkillId,
    nSkillLevel,
  )
  SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c(
    m,
    pSkillsTxt,
    pUnit,
    pStatList,
    nSkillId,
    nSkillLevel,
  )
  STATLIST_SetStat113c(m, pStatList, 0x15e, nSkillId, 0)
  STATLIST_SetStat113c(m, pStatList, 0x15f, nSkillLevel, 0)
  if (i16(m, pSkillsTxt + 0x84) >= 0) {
    ITEMEVENT_RemoveByTypeAndState113c(m, pUnit, pGame, 1, auraState)
    for (let i = 0; i < 3; i += 1) {
      const ev = i16(m, pSkillsTxt + 0x84 + i * 2)
      if (ev < 0) break
      const evFunc = i16(m, pSkillsTxt + 0x8a + i * 2)
      ITEMS_RegisterItemEventCallback113c(
        m,
        evFunc,
        auraState,
        1,
        pUnit,
        pGame,
        ev,
        nSkillId,
        nSkillLevel,
      )
    }
  }
  STATES_ClearGfxStateFlag113c(m, pUnit, auraState, 1)
  return pStatList
}

/**
 * @dll D2Game.dll
 * @va 0x6FC63450
 * @ordinalOrName D2Game_6FC63450
 */
export function SKILLS_SrvDo029_Teleport_6FC63450_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  _nSkillId: number,
  _nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC63450)
  const pTargetX = K2_W11B1_SCRATCH_BASE + 0x140
  const pTargetY = K2_W11B1_SCRATCH_BASE + 0x144
  w32(m, pTargetX, 0)
  w32(m, pTargetY, 0)
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, pUnit, pGame, pTargetX, pTargetY)
  const pCurrentRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  if (pCurrentRoom === 0) return 0

  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pCurrentRoom)
  const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, nLevelId) >>> 0
  if (pLevelsTxt === 0) return 0
  const bTeleport = u8(m, pLevelsTxt + 0x04)
  if (bTeleport === 0) return 0
  const destX = i32(m, pTargetX)
  const destY = i32(m, pTargetY)
  if (bTeleport === 2) {
    if (UNITS_FindFreeCoords113c(m, pUnit, destX, destY, 0x804) !== 0) {
      return 0
    }
  }
  return sunitWarpUnitToCoords_6FD019C0(m, destX, 0, destY, pUnit, pGame, 0, 0)
}

/**
 * @dll D2Game.dll
 * @va 0x6FC70070
 * @ordinalOrName D2Game_6FC70070
 */
export function SKILLS_PostInitSummonedPetStatsAndAi_6FC70070_113c(
  m: SparseMemory113c,
  pPetUnit: number,
  pOwnerUnit: number,
  nSkillLevel: number,
  pGame: number,
  nSkillId: number,
): void {
  hitD2GameVa113c(0x6FC70070)
  SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c(m, pOwnerUnit, 0, pGame, pPetUnit, nSkillLevel)
  SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c(
    m,
    pGame,
    pOwnerUnit,
    pPetUnit,
    nSkillId,
    nSkillLevel,
    0,
  )
  SKILLS_ApplySummonResistStatList_6FC6E180_113c(m, pOwnerUnit, pPetUnit)
}

const SHRINE_STATE_TABLE_6FD1A600 = [
  0, 0, 0, 0, 0, 0, 128, 129, 131, 132, 130, 133, 134, 135, 136, 137, 0, 0, 0, 0, 0, 0, 0, 0,
] as const

/**
 * @dll D2Game.dll
 * @va 0x6FC70800
 * @ordinalOrName D2Game_6FC70800
 */
export function SKILLS_ReleaseTrappedOrConvertedMonster_6FC70800_113c(
  m: SparseMemory113c,
  pMonsterUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC70800)
  if (pMonsterUnit === 0) return
  const posY = UNIT_GetPosY113c(m, pMonsterUnit)
  const posX = UNIT_GetPosX113c(m, pMonsterUnit)
  const colPattern = PATH_GetUnitCollisionPattern113c(m, pMonsterUnit)
  const pRoom = UNITS_GetRoom113c(m, pMonsterUnit) >>> 0
  COLLISION_ResetMaskWithPattern113c(m, pRoom, posX, posY, colPattern, 0x8000)

  const pCoordScratch = K2_W11B1_SCRATCH_BASE + 0x160
  w32(m, pCoordScratch, UNIT_GetPosX113c(m, pMonsterUnit) >>> 0)
  w32(m, pCoordScratch + 4, UNIT_GetPosY113c(m, pMonsterUnit) >>> 0)
  const nUnitSize = UNITS_GetUnitSizeX113c(m, pMonsterUnit)
  const pRoom2 = UNITS_GetRoom113c(m, pMonsterUnit) >>> 0
  const pFoundRoom =
    COLLISION_FindFreePositionSimple113c(m, pRoom2, pCoordScratch, nUnitSize, 0x3c01, 1) >>> 0
  if (pFoundRoom === 0) return

  w32(m, pMonsterUnit + 0xc4, (u32(m, pMonsterUnit + 0xc4) | 0x0402000e) >>> 0)
  MONSTER_ScheduleInitialAiEvent113c(m, pGame, pMonsterUnit)
  SKILLS_SetUsedSkillMemPort113c(m, pMonsterUnit, 0)
  MONSTER_StartMode113c(m, pGame, pMonsterUnit, 1, 0, 0, 0)
  SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c(m, pMonsterUnit)
  freeUnitEventNodesByType(m, pGame, pMonsterUnit, 8)
  if (UNITS_GetRightSkill113c(m, pMonsterUnit) !== 0) {
    SKILLS_SetRightSkill113c(m, pMonsterUnit, 0, 0xffffffff)
  }
  sunitWarpUnitToCoords_6FD019C0(
    m,
    i32(m, pCoordScratch),
    pFoundRoom,
    i32(m, pCoordScratch + 4),
    pMonsterUnit,
    pGame,
    0,
    0,
  )
}

/**
 * @dll D2Game.dll
 * @va 0x6FC7FB50
 * @ordinalOrName D2Game_6FC7FB50
 */
export function ACT5Q5_InitQuestData_6FC7FB50_113c(
  m: SparseMemory113c,
  pQuest: number,
  pPreallocatedState = 0,
): void {
  hitD2GameVa113c(0x6FC7FB50)
  if (pQuest === 0) return
  for (let i = 0; i < 15; i += 1) {
    w32(m, pQuest + 0xa0 + i * 4, 0)
  }
  w32(m, pQuest + 0xa0, 0x6fc775f0)
  w32(m, pQuest + 0xc8, 0x6fc775d0)
  w32(m, pQuest + 0xac, 0x6fc7ab60)
  w32(m, pQuest + 0xc0, 0x6fc7eed0)
  w32(m, pQuest + 0xa8, 0x6fc79be0)
  w32(m, pQuest + 0xcc, 0x6fc7f200)
  w32(m, pQuest + 0xd4, 0x6fc77540)
  w32(m, pQuest + 0xdc, 0x6fd2cac0)

  const existingState = u32(m, pQuest + 0x18)
  const pState =
    pPreallocatedState !== 0
      ? pPreallocatedState
      : existingState !== 0
        ? existingState
        : allocServerMem(m, 0x64)
  for (let i = 0; i < 25; i += 1) {
    w32(m, pState + i * 4, 0)
  }
  w32(m, pQuest + 0xe0, 0x27)
  w32(m, pQuest + 0xe8, 0)
  w32(m, pQuest + 0x18, pState)
  w8(m, pQuest + 0x0d, 4)
  w32(m, pQuest + 0xec, 0x6fc76810)
  w32(m, pQuest + 0xf0, 0x6fc767a0)
  w32(m, pQuest + 0x10, 0x24)
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8AB60
 * @ordinalOrName D2Game_6FC8AB60
 */
export function OBJ_OperateFn_SkillShrine_6FC8AB60_113c(
  m: SparseMemory113c,
  pOperateArgs: number,
  pShrineRecord: number,
): number {
  hitD2GameVa113c(0x6FC8AB60)
  const nCode = u8(m, pShrineRecord)
  const dwDuration = i32(m, pShrineRecord + 0x0c)
  const nStateId =
    nCode < SHRINE_STATE_TABLE_6FD1A600.length
      ? SHRINE_STATE_TABLE_6FD1A600[nCode]!
      : 0
  const pObjectUnit = u32(m, pOperateArgs + 0x04)
  const pPlayerUnit = u32(m, pOperateArgs + 0x08)
  OBJ_ApplyShrineAuraStatList_6FC8A960_113c(
    m,
    pObjectUnit,
    pPlayerUnit,
    dwDuration,
    0,
    0x0b,
    nStateId,
    0x6fc8a930,
  )
  SKILLS_RefreshPassiveAuraSkills113c(m, pPlayerUnit)
  if (pPlayerUnit !== 0 && u32(m, pPlayerUnit) === 0) {
    PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(
      m,
      u32(m, pPlayerUnit + 0x80),
      pPlayerUnit,
    )
  }
  return 1
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8BB60
 * @ordinalOrName D2Game_6FC8BB60
 */
export function OBJ_OperateFn_CowAndSpecialPortal_6FC8BB60_113c(
  m: SparseMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8BB60)
  const pPlayerUnit = pOperateArgs !== 0 ? u32(m, pOperateArgs + 0x08) : 0
  if (pPlayerUnit === 0 || u32(m, pPlayerUnit) !== 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Objects\\ObjEval.cpp', 0xfb3)
  }
  const pGame = u32(m, pOperateArgs)
  const pPortalObj = u32(m, pOperateArgs + 0x04)
  const flags = UNITS_GetObjectPortalFlags113c(m, pPortalObj)
  UNITS_SetObjectPortalFlags113c(m, pPortalObj, (flags | 5) & 0xff)
  let nTargetLevelId = 0
  if (pPortalObj !== 0) {
    const nObjClassId = i32(m, pPortalObj + 0x04)
    if (nObjClassId === 0x64) {
      nTargetLevelId = 0x49
    } else if (nObjClassId === 0x179) {
      const pObjData = u32(m, pPortalObj + 0x14)
      nTargetLevelId = u8(m, pObjData + 0x04)
    }
  }
  const nAct = DRLG_GetActNoFromLevelId113c(m, nTargetLevelId) & 0xff
  if (nAct >= 5) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Objects\\ObjEval.cpp', 0xfcb)
  }
  const nUnitSize = UNITS_GetUnitSizeX113c(m, pPlayerUnit)
  const pOutX = K2_W11B1_SCRATCH_BASE + 0x180
  const pOutY = K2_W11B1_SCRATCH_BASE + 0x184
  w32(m, pOutX, 0)
  w32(m, pOutY, 0)
  const pAct = u32(m, pGame + 0xbc + nAct * 4)
  const pRoom =
    DUNGEON_FindFreeSpawnPositionInLevel113c(
      m,
      pAct,
      nTargetLevelId,
      0,
      pOutX,
      pOutY,
      nUnitSize,
    ) >>> 0
  if (pRoom === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Objects\\ObjEval.cpp', 0xfcd)
  }
  const pDestCoord = K2_W11B1_SCRATCH_BASE + 0x188
  w32(m, pDestCoord, u32(m, pOutX))
  w32(m, pDestCoord + 4, u32(m, pOutY))
  const nUnitSize2 = UNITS_GetUnitSizeX113c(m, pPlayerUnit)
  const pFreeRoom =
    COLLISION_FindFreePositionSimple113c(m, pRoom, pDestCoord, nUnitSize2, 0x1c09, 0) >>> 0
  if (pFreeRoom !== 0) {
    if (
      sunitWarpUnitToCoords_6FD019C0(
        m,
        i32(m, pDestCoord),
        pFreeRoom,
        i32(m, pDestCoord + 4),
        pPlayerUnit,
        pGame,
        0,
        0,
      ) === 0
    ) {
      throw new D2CommonAssertError('..\\Source\\D2Game\\Objects\\ObjEval.cpp', 0xfd9)
    }
  }
  return 0
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8BD60
 * @ordinalOrName D2Game_6FC8BD60
 */
export function OBJ_TeleportPlayerToRoomPad_6FC8BD60_113c(
  m: SparseMemory113c,
  pObjectUnit: number,
  pPlayerUnit: number,
  pTargetRoom: number,
): number {
  hitD2GameVa113c(0x6FC8BD60)
  const pObjCoord = K2_W11B1_SCRATCH_BASE + 0x190
  const pRoomCoords = K2_W11B1_SCRATCH_BASE + 0x1a0
  PATH_GetTargetTypeAndPosition113c(m, pObjectUnit, pObjCoord)
  const pFreeRoom =
    COLLISION_FindFreePositionSimple113c(m, pTargetRoom, pObjCoord, 3, 0x1c09, 0) >>> 0
  if (pFreeRoom === 0) return 0
  if (pPlayerUnit === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Objects\\ObjEval.cpp', 0xa2a)
  }
  const pGame = u32(m, pPlayerUnit + 0x80)
  if (
    sunitWarpUnitToCoords_6FD019C0(
      m,
      i32(m, pObjCoord),
      pTargetRoom,
      i32(m, pObjCoord + 4),
      pPlayerUnit,
      pGame,
      0,
      0,
    ) === 0
  ) {
    return 0
  }
  DUNGEON_GetRoomCoordinates113c(m, pTargetRoom, pRoomCoords)
  const pClient =
    u32(m, pPlayerUnit) === 0 ? u32(m, UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c) : 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pTargetRoom)
  const pPacket07 = K2_W11B1_SCRATCH_BASE + 0x1e0
  w8(m, pPacket07 + 0, 0x07)
  w16(m, pPacket07 + 1, u16(m, pRoomCoords + 0x10))
  w16(m, pPacket07 + 3, u16(m, pRoomCoords + 0x14))
  w8(m, pPacket07 + 5, nLevelId & 0xff)
  NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPacket07, 6)
  UNITROOM_RefreshUnit113c(m, pPlayerUnit)
  w32(m, pPlayerUnit + 0xc8, (u32(m, pPlayerUnit + 0xc8) | 0x10000) >>> 0)
  return 1
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8D0F0
 * @ordinalOrName D2Game_6FC8D0F0
 */
export function OBJ_OperateFn_TownAndPermanentPortal_6FC8D0F0_113c(
  m: SparseMemory113c,
  pOperateArgs: number,
  nCurrentTick = 0,
): number {
  hitD2GameVa113c(0x6FC8D0F0)
  const pGame = u32(m, pOperateArgs)
  const pPortalObj = u32(m, pOperateArgs + 0x04)
  const pPlayerUnit = u32(m, pOperateArgs + 0x08)

  if (pPlayerUnit !== 0 && u32(m, pPlayerUnit) === 0) {
    if (u8(m, pPlayerUnit + 0x6c) !== 0) return 0
    const pInventory = u32(m, pPlayerUnit + 0x60)
    if (INVENTORY_GetCursorItem113c(m, pInventory) !== 0) return 0
    const pPlrDataCheck = UNITS_GetPlayerData113c(m, pPlayerUnit)
    if (u32(m, pPlrDataCheck + 0x4c) !== 0) return 0
  }

  if (PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c(m, pGame, pPlayerUnit) !== 0) {
    const dwPlayerGuid = pPlayerUnit !== 0 ? u32(m, pPlayerUnit + 0x0c) : 0xffffffff
    const pPortalOwnerRec = UNITS_GetField7C_113c(m, pPortalObj)
    const dwPortalOwnerGuid = pPortalOwnerRec !== 0 ? u32(m, pPortalOwnerRec + 0x04) : 0xffffffff
    if (dwPlayerGuid !== dwPortalOwnerGuid) return 0
  }

  const pPlrDataTick = UNITS_GetPlayerData113c(m, pPlayerUnit)
  let dwCooldownTick = 0
  if (pPlrDataTick !== 0) {
    dwCooldownTick = u32(m, pPlrDataTick + 0x160)
  } else {
    const pPlrData2 = UNITS_GetPlayerData113c(m, pPlayerUnit)
    if (pPlayerUnit !== 0) {
      let pNode = u32(m, pPlrData2 + 0x38)
      while (pNode !== 0) {
        if (u32(m, pNode) === 0xffffffff) {
          dwCooldownTick = u32(m, pNode + 0x08)
          break
        }
        pNode = u32(m, pNode + 0x10)
      }
    }
  }
  const dwNow = nCurrentTick !== 0 ? (nCurrentTick >>> 0) : u32(m, 0x6fd18d10)
  if (((dwCooldownTick + 0x1388) >>> 0) > dwNow) {
    SUNIT_SetUnitEventSound113c(m, pPlayerUnit, 0x13, pPlayerUnit)
    return 0
  }

  const pPortalOwnerRec2 = UNITS_GetField7C_113c(m, pPortalObj)
  const dwOwnerGuid = pPortalOwnerRec2 !== 0 ? u32(m, pPortalOwnerRec2 + 0x04) : 0xffffffff
  if (dwOwnerGuid !== 0xffffffff) {
    const dwPlayerGuid = pPlayerUnit !== 0 ? u32(m, pPlayerUnit + 0x0c) : 0xffffffff
    if (dwOwnerGuid !== dwPlayerGuid) {
      const wPlayerParty = SUNITDMG_GetPlayerClientClassId113c(m, pPlayerUnit) & 0xffff
      if (wPlayerParty === 0xffff) {
        SUNIT_SetUnitEventSound113c(m, pPlayerUnit, 0x13, pPlayerUnit)
        return 0
      }
      if (pGame === 0) {
        throw new D2CommonAssertError('..\\Source\\D2Game\\Objects\\ObjEval.cpp', 0x2d3)
      }
      let pOwner = u32(m, pGame + 0x1120 + ((dwOwnerGuid & 0x7f) << 2))
      while (pOwner !== 0 && u32(m, pOwner + 0x0c) !== dwOwnerGuid) {
        pOwner = u32(m, pOwner + 0xe4)
      }
      if (pOwner !== 0) {
        const wOwnerParty = SUNITDMG_GetPlayerClientClassId113c(m, pOwner) & 0xffff
        const wPlayerParty2 = SUNITDMG_GetPlayerClientClassId113c(m, pPlayerUnit) & 0xffff
        if (wPlayerParty2 !== wOwnerParty) {
          SUNIT_SetUnitEventSound113c(m, pPlayerUnit, 0x13, pPlayerUnit)
          return 0
        }
      }
    }
  }

  if (pPlayerUnit === 0 || u32(m, pPlayerUnit) !== 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Objects\\ObjEval.cpp', 0xed8)
  }

  let pDualPortal =
    SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c(m, pGame, pPortalObj) >>> 0
  if (pDualPortal !== 0 && u32(m, pDualPortal) !== 2) {
    pDualPortal = 0
  }

  const pPortalRoom = UNITS_GetRoom113c(m, pPortalObj) >>> 0
  let bSkipDualLookup = false
  if (pPortalRoom !== 0) {
    const pQuestRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayerUnit, pGame) >>> 0
    if (pQuestRec === 0) {
      SUNIT_SetUnitEventSound113c(m, pPlayerUnit, 0x13, pPlayerUnit)
      return 0
    }
    const pObjData = u32(m, pPortalObj + 0x14)
    const nDestLevelId = u8(m, pObjData + 0x04)
    const pLevelDef = DATATBLS_GetLevelDefRecord113c(m, nDestLevelId) >>> 0
    if (pLevelDef === 0) {
      SUNIT_SetUnitEventSound113c(m, pPlayerUnit, 0x13, pPlayerUnit)
      return 0
    }
    if (i32(m, pOperateArgs + 0x10) === 0x3b) {
      const dwPlayerPortalGuid = PLAYER_GetPlayerDataField48_6FC57440_113c(m, pPlayerUnit) >>> 0
      const dwThisPortalGuid = pPortalObj !== 0 ? u32(m, pPortalObj + 0x0c) : 0xffffffff
      if (dwPlayerPortalGuid !== dwThisPortalGuid) {
        if (pDualPortal === 0) {
          bSkipDualLookup = true
        } else if (dwPlayerPortalGuid !== u32(m, pDualPortal + 0x0c)) {
          const nQuestId =
            u32(m, pGame + 0x70) !== 0 ? i32(m, pLevelDef + 0x04) : i32(m, pLevelDef + 0x00)
          if (nQuestId > 0 && DRLGWARP_TestRoomTileBit113c(m, pQuestRec, nQuestId, 0) === 0) {
            SUNIT_SetUnitEventSound113c(m, pPlayerUnit, 0x13, pPlayerUnit)
            return 0
          }
        }
      }
    }
  }

  const pSpawnX = K2_W11B1_SCRATCH_BASE + 0x200
  const pSpawnY = K2_W11B1_SCRATCH_BASE + 0x204
  const pDestCoord = K2_W11B1_SCRATCH_BASE + 0x208
  let pDestRoom = 0
  if (bSkipDualLookup || pDualPortal === 0) {
    const pObjData = u32(m, pPortalObj + 0x14)
    const nDestLevelId = u8(m, pObjData + 0x04)
    const nAct = DRLG_GetActNoFromLevelId113c(m, nDestLevelId) & 0xff
    const pAct = u32(m, pGame + 0xbc + nAct * 4)
    w32(m, pSpawnX, 0)
    w32(m, pSpawnY, 0)
    pDestRoom =
      DUNGEON_FindFreeSpawnPositionInLevel113c(
        m,
        pAct,
        nDestLevelId,
        0,
        pSpawnX,
        pSpawnY,
        3,
      ) >>> 0
    w32(m, pDestCoord, u32(m, pSpawnX))
    w32(m, pDestCoord + 4, u32(m, pSpawnY))
  } else {
    w32(m, pDestCoord, UNIT_GetPosX113c(m, pDualPortal) >>> 0)
    w32(m, pDestCoord + 4, UNIT_GetPosY113c(m, pDualPortal) >>> 0)
    pDestRoom = UNITS_GetRoom113c(m, pDualPortal) >>> 0
  }

  const portalFlags = UNITS_GetObjectPortalFlags113c(m, pPortalObj)
  UNITS_SetObjectPortalFlags113c(m, pPortalObj, (portalFlags | 5) & 0xff)

  const pPlayerRoomNow = UNITS_GetRoom113c(m, pPlayerUnit) >>> 0
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pPlayerRoomNow) !== 0) {
    const nDestLvl = DUNGEON_GetLevelIdFromRoom113c(m, pDestRoom)
    const pPlayerRoom2 = UNITS_GetRoom113c(m, pPlayerUnit) >>> 0
    const nSrcLvl = DUNGEON_GetLevelIdFromRoom113c(m, pPlayerRoom2)
    QUESTS_NotifyLevelChange113c(m, pGame, pPlayerUnit, nSrcLvl, nDestLvl)
  }

  const nUnitSize = UNITS_GetUnitSizeX113c(m, pPlayerUnit)
  const pFreeRoom =
    COLLISION_FindFreePositionSimple113c(
      m,
      pDestRoom,
      pDestCoord,
      nUnitSize,
      0x1c09,
      0,
    ) >>> 0
  if (pFreeRoom === 0) return 0

  const destX = i32(m, pDestCoord)
  const destY = i32(m, pDestCoord + 4)
  if (
    sunitWarpUnitToCoords_6FD019C0(m, destX, pFreeRoom, destY, pPlayerUnit, pGame, 0, 0) === 0
  ) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Objects\\ObjEval.cpp', 0xf52)
  }

  const pClient =
    pPlayerUnit !== 0 && u32(m, pPlayerUnit) === 0
      ? u32(m, UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c)
      : 0
  SUNIT_SetUnitEventSound113c(m, pPlayerUnit, 8, 0)
  PLAYER_StartModeAtCoords113c(m, pGame, pPlayerUnit, 2, (destX + 5) | 0, (destY + 5) | 0, 0)
  const nUnitType = pPlayerUnit !== 0 ? u8(m, pPlayerUnit) : 6
  const dwUnitGuid = pPlayerUnit !== 0 ? u32(m, pPlayerUnit + 0x0c) : 0xffffffff
  NET_SendPacket13B_UnitCoordEvent_6FCAC280_113c(
    m,
    nUnitType,
    0x0d,
    dwUnitGuid,
    pClient,
    1,
    (destX + 5) | 0,
    (destY + 5) | 0,
    0,
    0,
  )

  const nPortalClassId = pPortalObj !== 0 ? i32(m, pPortalObj + 0x04) : -1
  if (pDualPortal !== 0 && (nPortalClassId & 0xffff) !== 0x3c) {
    const dwPlayerPortalGuid = PLAYER_GetPlayerDataField48_6FC57440_113c(m, pPlayerUnit) >>> 0
    if (dwPlayerPortalGuid === u32(m, pDualPortal + 0x0c)) {
      const pSrcPortalRoom = UNITS_GetRoom113c(m, pPortalObj) >>> 0
      const dwSrcPortalGuid = pPortalObj !== 0 ? u32(m, pPortalObj + 0x0c) : 0xffffffff
      DUNGEON_AddRoomPortalNode113c(m, pSrcPortalRoom, 2, dwSrcPortalGuid)
      SUNIT_FreeUnit113c(m, pGame, pPortalObj)
      DUNGEON_ToggleHasPortalFlag113c(m, pSrcPortalRoom, 1)
      ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c(m, pDualPortal, pGame)
      const pDualPortalRoom = UNITS_GetRoom113c(m, pDualPortal) >>> 0
      DUNGEON_AddRoomPortalNode113c(m, pDualPortalRoom, 2, u32(m, pDualPortal + 0x0c))
      SUNIT_FreeUnit113c(m, pGame, pDualPortal)
      DUNGEON_ToggleHasPortalFlag113c(m, pDualPortalRoom, 1)
    }
  } else if (pPortalObj !== 0 && i32(m, pPortalObj + 0x10) === 1) {
    const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nPortalClassId & 0xffff) >>> 0
    const nFrameDelay = (u32(m, pObjTxt + 0xdc) >>> 8) >>> 0
    const dwNextFrame = (u32(m, pGame + 0xa8) + nFrameDelay + 1) >>> 0
    EVENT_SetEventFull113c(m, pGame, pPortalObj, 1, dwNextFrame, 0, 0, 0)
  }

  const dwExpireFrame = (u32(m, pGame + 0xa8) + 0x4b) >>> 0
  const dwOwnerType = pPlayerUnit !== 0 ? u32(m, pPlayerUnit) : 6
  const pStatList = STATLIST_AllocList113c(m, 2, 0, dwOwnerType, 0, dwExpireFrame) >>> 0
  if (pStatList !== 0) {
    EVENT_SetEventFull113c(m, pGame, pPlayerUnit, 0x0c, dwExpireFrame, 0, 0, 0)
    STATES_ToggleGfxStateFlag113c(m, pPlayerUnit, 0x66, 1)
    STATLIST_SetState113c(m, pStatList, 0x66)
    void STATES_OnTimedStateRemoved113c
    STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcbf7a0)
    STATLIST_MergeStatLists113c(m, pPlayerUnit, pStatList, 1)
  }
  return 0
}

/**
 * @dll D2Game.dll
 * @va 0x6FCA9730
 * @ordinalOrName D2Game_6FCA9730
 */
export function MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c(
  m: SparseMemory113c,
  pMonsterUnit: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCA9730)
  if (pMonsterUnit !== 0) {
    w32(m, pMonsterUnit + 0xc4, (u32(m, pMonsterUnit + 0xc4) | 0x0e) >>> 0)
  }
  if (pMonsterUnit === 0 || PATH_GetUnitCollisionPattern113c(m, pMonsterUnit) === 1) return 0

  const dwType = u32(m, pMonsterUnit)
  const pPath = u32(m, pMonsterUnit + 0x2c)
  let posY = 0
  let posX = 0
  if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
    posY = pPath !== 0 ? i32(m, pPath + 0x10) : 0
    posX = pPath !== 0 ? i32(m, pPath + 0x0c) : 0
  } else {
    posY = pPath !== 0 ? PATH_GetPosY113c(m, pPath) : 0
    posX = pPath !== 0 ? PATH_GetPosX113c(m, pPath) : 0
  }
  const pRoom = UNITS_GetRoom113c(m, pMonsterUnit)
  if (
    DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c(
      m,
      posX,
      pRoom,
      posY,
      pGame,
      pMonsterUnit,
      0,
      0,
    ) === 0
  ) {
    return 0
  }

  const dwTypeNow = u32(m, pMonsterUnit)
  const pPathNow = u32(m, pMonsterUnit + 0x2c)
  let newY = 0
  let newX = 0
  if (dwTypeNow === 2 || (dwTypeNow > 3 && dwTypeNow <= 5)) {
    newY = pPathNow !== 0 ? i32(m, pPathNow + 0x10) : 0
    newX = pPathNow !== 0 ? i32(m, pPathNow + 0x0c) : 0
  } else {
    newY = pPathNow !== 0 ? PATH_GetPosY113c(m, pPathNow) : 0
    newX = pPathNow !== 0 ? PATH_GetPosX113c(m, pPathNow) : 0
  }
  const pRoomNow = UNITS_GetRoom113c(m, pMonsterUnit)
  COLLISION_SetUnitCollisionMaskWithPattern113c(m, pRoomNow, newX, newY, 1, 0x100)
  PATH_SetUnitCollisionPattern113c(m, pMonsterUnit, 1)
  if (pPathNow !== 0) {
    PATH_SetMoveTestCollisionMask113c(m, pPathNow, 0x3c01)
  }
  AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pMonsterUnit, 0x0c)
  return 1
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB3680
 * @ordinalOrName D2Game_6FCB3680
 */
export function SKILLS_SrvDo252_DragonFlight_6FCB3680_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB3680)
  const sgpt = readSgptDataTablesPtr(m)
  if (sgpt === 0 || (nSkillId | 0) < 0 || (nSkillId | 0) >= i32(m, sgpt + 0xba0)) return 0
  const pSkillsTxtBase = u32(m, sgpt + 0xb98)
  const pSkillsTxt = (pSkillsTxtBase + imul32(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pPath = pUnit !== 0 ? u32(m, pUnit + 0x2c) : 0
  const pTargetUnit = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTargetUnit === pUnit || pTargetUnit === 0) return 0

  const nFrame = i32(m, pUnit + 0x38) >> 8
  if ((nFrame & 1) === 0) {
    const pCurRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
    if (pCurRoom === 0) return 0
    w32(m, pUnit + 0xc4, (u32(m, pUnit + 0xc4) & ~0x40) >>> 0)
    const pTargetX = K2_W11B1_SCRATCH_BASE + 0x218
    const pTargetY = K2_W11B1_SCRATCH_BASE + 0x21c
    w32(m, pTargetX, 0)
    w32(m, pTargetY, 0)
    if (
      SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, pUnit, pGame, pTargetX, pTargetY) === 0
    ) {
      return 0
    }
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pCurRoom)
    const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, nLevelId) >>> 0
    if (pLevelsTxt === 0) return 0
    const bTeleport = u8(m, pLevelsTxt + 0x04)
    if (bTeleport === 0) return 0
    const destX = i32(m, pTargetX)
    const destY = i32(m, pTargetY)
    if (bTeleport === 2) {
      if (UNITS_FindFreeCoords113c(m, pUnit, destX, destY, 0x804) !== 0) {
        return 0
      }
    }
    sunitWarpUnitToCoords_6FD019C0(m, destX, 0, destY, pUnit, pGame, 0, 0)
    return 1
  }

  const pDmg = K2_W11B1_SCRATCH_BASE + 0x220
  for (let i = 0; i < 0x1c; i += 1) {
    w32(m, pDmg + i * 4, 0)
  }
  const nToHitBonus =
    (SKILLS_GetSkillToHitBonus113c(m, pUnit, nSkillId, nSkillLevel) +
      STATLIST_GetUnitStat113c(m, pUnit, 0x145, 0)) |
    0
  const wRoll =
    SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, pUnit, pTargetUnit, pGame, nToHitBonus, 0) &
    0xffff
  w16(m, pDmg + 0x04, wRoll)
  if ((wRoll & 1) !== 0) {
    w32(m, pDmg + 0x0c, SKILLS_EvalLinearParam12_6FC21B10_113c(m, nSkillId, nSkillLevel))
    SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c(
      m,
      pUnit,
      pGame,
      pDmg,
      pTargetUnit,
      nSkillId,
      nSkillLevel,
    )
  }
  const srcDamRaw = u8(m, pSkillsTxt + 0x1a5)
  const srcDam = srcDamRaw !== 0 ? srcDamRaw : 0x80
  SUNITDMG_AllocCombat113c(m, pGame, pUnit, pTargetUnit, pDmg, srcDam)
  SUNITDMG_FindCombatDamageData113c(m, pUnit, pTargetUnit)
  SKILLS_ConsumeProgressiveChargesOnHit113c(m, 0, pUnit, pGame)
  SUNITDMG_ExecuteEvents113c(m, pGame, pUnit, pTargetUnit, 1, 0)
  return 1
}

function petsInsertPetIntoPlayerPetSlot_6FCB7A20(
  m: SparseMemory113c,
  pPetTypeSlot: number,
  pGame: number,
  pPlayerUnit: number,
  pPetUnit: number,
  pPetInfo12Bytes: number,
): number {
  return PETS_InsertPetIntoPlayerPetSlot_6FCB7A20_113c(
    m,
    pPetTypeSlot,
    pGame,
    pPlayerUnit,
    pPetUnit,
    pPetInfo12Bytes,
  )
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB7E20
 * @ordinalOrName D2Game_6FCB7E20
 */
export function PETS_AssignMercOrPetRecordAndBroadcast_6FCB7E20_113c(
  m: SparseMemory113c,
  pPlayerUnit: number,
  pGame: number,
  pPetUnit: number,
  nPetType: number,
  pPetInfo12Bytes: number,
): void {
  hitD2GameVa113c(0x6FCB7E20)
  const pPlrData = UNITS_GetPlayerData113c(m, pPlayerUnit)
  if (pPlrData === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Plr\\PlrPets.cpp', 0x3b5)
  }
  const pPlayerPets = u32(m, pPlrData + 0x44)
  if (pPlayerPets === 0) return

  const sgpt = readSgptDataTablesPtr(m)
  const nPetTypeCount = sgpt !== 0 ? i32(m, sgpt + 0xbf0) : 0
  if (nPetType < 0 || nPetType >= nPetTypeCount) return
  const pSlotsBase = u32(m, pPlayerPets)
  const pPetTypeSlot = (pSlotsBase + nPetType * 12) >>> 0
  if (pPetTypeSlot === 0) return

  const pLocalPetInfo = K2_W11B1_SCRATCH_BASE + 0x2b0
  w32(m, pLocalPetInfo + 0x00, u32(m, pPetInfo12Bytes + 0x00))
  w32(m, pLocalPetInfo + 0x04, u32(m, pPetInfo12Bytes + 0x04))
  w32(m, pLocalPetInfo + 0x08, u32(m, pPetInfo12Bytes + 0x08))
  if (
    petsInsertPetIntoPlayerPetSlot_6FCB7A20(
      m,
      pPetTypeSlot,
      pGame,
      pPlayerUnit,
      pPetUnit,
      pLocalPetInfo,
    ) === 0
  ) {
    return
  }

  const pAssignPacketCtx = K2_W11B1_SCRATCH_BASE + 0x2c0
  for (let i = 0; i < 7; i += 1) {
    w32(m, pAssignPacketCtx + i * 4, 0)
  }
  const dwPetGuid = pPetUnit !== 0 ? u32(m, pPetUnit + 0x0c) : 0xffffffff
  const dwPlayerGuid = pPlayerUnit !== 0 ? u32(m, pPlayerUnit + 0x0c) : 0xffffffff
  const wMonClassId = pPetUnit !== 0 ? u16(m, pPetUnit + 0x04) : 0xffff
  w32(m, pAssignPacketCtx + 0x00, dwPetGuid)
  w32(m, pAssignPacketCtx + 0x04, dwPlayerGuid)
  w16(m, pAssignPacketCtx + 0x08, wMonClassId)
  w32(m, pAssignPacketCtx + 0x0c, nPetType)
  w32(m, pAssignPacketCtx + 0x10, u32(m, pPetInfo12Bytes + 0x00))
  w32(m, pAssignPacketCtx + 0x14, u32(m, pPetInfo12Bytes + 0x04))
  w32(m, pAssignPacketCtx + 0x18, 0)
  D2GAME_SUNIT_IterateAllLivingPlayers113c(
    m,
    pGame,
    (mem, _g, pTargetPlr, pCtx) => {
      PETS_SendPetOrMercAssignPacket_6FCB66E0_113c(mem, pTargetPlr, pCtx)
    },
    pAssignPacketCtx,
  )
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB7F50
 * @ordinalOrName D2Game_6FCB7F50
 */
export function PETS_RegisterSummonPetAndClampCount_6FCB7F50_113c(
  m: SparseMemory113c,
  nPetType: number,
  pPlayerUnit: number,
  pGame: number,
  pPetUnit: number,
  nMaxPets: number,
  pPetInfo12Bytes: number,
): number {
  hitD2GameVa113c(0x6FCB7F50)
  const pPlrData = UNITS_GetPlayerData113c(m, pPlayerUnit)
  const pPlayerPets = pPlrData !== 0 ? u32(m, pPlrData + 0x44) : 0
  if (pPlayerPets === 0) return 0

  const sgpt = readSgptDataTablesPtr(m)
  if (sgpt === 0 || nPetType <= 0 || nPetType >= i32(m, sgpt + 0xbf0)) {
    return 0
  }
  const pPetTypesTxt = u32(m, sgpt + 0xbec)
  if (pPetTypesTxt === 0 || pPetTypesTxt + nPetType * 0xe0 === 0) {
    return 0
  }

  PETS_UnsummonSameGroupPetTypes_6FCB7C20_113c(m, pGame, pPlayerUnit, nPetType)
  const pPetTypeSlot = SUMMON_GetPetTypeBucketPtr_6FCB6540_113c(m, nPetType, pPlayerPets)
  if (pPetTypeSlot === 0) return 0

  PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c(
    m,
    nPetType,
    pPlayerUnit,
    pGame,
    nMaxPets,
  )
  if (
    petsInsertPetIntoPlayerPetSlot_6FCB7A20(
      m,
      pPetTypeSlot,
      pGame,
      pPlayerUnit,
      pPetUnit,
      pPetInfo12Bytes,
    ) === 0
  ) {
    return 0
  }

  if (pPetUnit !== 0 && u32(m, pPetUnit) === 1) {
    const pMonData = u32(m, pPetUnit + 0x14)
    const pAiCtrl = pMonData !== 0 ? u32(m, pMonData + 0x28) : 0
    if (pAiCtrl !== 0) {
      w32(m, pAiCtrl + 0x2c, u32(m, pPlayerUnit + 0x0c))
      w32(m, pAiCtrl + 0x30, u32(m, pPlayerUnit))
      w32(m, pAiCtrl + 0x28, pGame)
    }
  }

  const pAssignPacketCtx = K2_W11B1_SCRATCH_BASE + 0x2e0
  const dwPetGuid = pPetUnit !== 0 ? u32(m, pPetUnit + 0x0c) : 0xffffffff
  const wMonClassId = pPetUnit !== 0 ? u16(m, pPetUnit + 0x04) : 0xffff
  w32(m, pAssignPacketCtx + 0x00, u32(m, pPlayerUnit + 0x0c))
  w32(m, pAssignPacketCtx + 0x04, nPetType)
  w32(m, pAssignPacketCtx + 0x08, dwPetGuid)
  w16(m, pAssignPacketCtx + 0x0c, wMonClassId)
  w32(m, pAssignPacketCtx + 0x10, u32(m, pPetInfo12Bytes + 0x00))
  w32(m, pAssignPacketCtx + 0x14, u32(m, pPetInfo12Bytes + 0x04))
  w32(m, pAssignPacketCtx + 0x18, u32(m, pPetInfo12Bytes + 0x08))
  D2GAME_SUNIT_IterateAllLivingPlayers113c(
    m,
    pGame,
    (mem, _g, pTargetPlr, pCtx) => {
      PETS_SendPetOrMercAssignPacket_6FCB66E0_113c(mem, pTargetPlr, pCtx)
    },
    pAssignPacketCtx,
  )
  return 1
}

/**
 * @dll D2Game.dll
 * @va 0x6FCBDF40
 * @ordinalOrName sub_6FCBDF40
 */
export function ACT_WarpClientPlayerToActTown_6FCBDF40_113c(
  m: SparseMemory113c,
  pGame: number,
  pClient: number,
  nTargetLevelId: number,
  nPortalType: number,
): void {
  hitD2GameVa113c(0x6FCBDF40)
  const pArena = u32(m, pGame + 0x1d28);
  if (pArena === 0) {
    throw new D2CommonAssertError('Act.cpp', 0x27);
  }
  if ((u8(m, pArena + 0x08) & 2) !== 0) {
    return;
  }
  const nAct = DRLG_GetActNoFromLevelId113c(m, nTargetLevelId) & 0xff;
  if (nAct === u8(m, pClient + 0x1ac)) {
    throw new D2CommonAssertError('Act.cpp', 0x19f);
  }
  const pActSlot = (pGame + 0xbc + nAct * 4) >>> 0;
  if (u32(m, pActSlot) === 0) {
    ACT_AllocGameActAndInitEclipse_6FCBD6F0_113c(m, pGame, nAct);
  }
  w32(m, pClient + 0x04, 5);
  const pPlayer = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0;
  if (pPlayer === 0) {
    throw new D2CommonAssertError('Act.cpp', 0x1af);
  }
  if (u32(m, pGame + 0x70) === 0 && u32(m, pPlayer) === 0) {
    PETS_CleanupAllPlayerPetsOnActChangeOrSave_6FCB7730_113c(m, pGame, pPlayer);
  }
  SKILLS_RemoveAllCurseAndDebuffStatesFromUnit113c(m, pPlayer);
  const nSize = UNITS_GetUnitSizeX113c(m, pPlayer);
  const pSpawnX = K2_W11B1_SCRATCH_BASE;
  const pSpawnY = (K2_W11B1_SCRATCH_BASE + 4) >>> 0;
  const pFinalCoords = (K2_W11B1_SCRATCH_BASE + 8) >>> 0;
  const pSpawnRoom =
    DUNGEON_FindFreeSpawnPositionInLevel113c(
      m,
      u32(m, pActSlot),
      nTargetLevelId,
      nPortalType,
      pSpawnX,
      pSpawnY,
      nSize,
    ) >>> 0;
  if (pSpawnRoom === 0) {
    return;
  }
  w32(m, pFinalCoords, u32(m, pSpawnX));
  w32(m, pFinalCoords + 4, u32(m, pSpawnY));
  const pFinalRoom =
    COLLISION_FindFreePositionWithStep113c(
      m,
      pSpawnRoom,
      pFinalCoords,
      UNITS_GetUnitSizeX113c(m, pPlayer),
      0x1c89,
      5,
    ) >>> 0;
  if (pFinalRoom === 0) {
    return;
  }
  const pPath = u32(m, pPlayer + 0x2c);
  const pOldRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0;
  if (PATH_WarpUnitToRoomAndCoord113c(m, pPath, pPlayer, 0, 0, 0) === 0) {
    throw new D2CommonAssertError('Act.cpp', 0x1d1);
  }
  SUNIT_UpdateUnitPositionAndRoom113c(m, pOldRoom, pPlayer, pGame);
  if (
    PATH_WarpUnitToRoomAndCoord113c(
      m,
      pPath,
      pPlayer,
      pFinalRoom,
      i32(m, pFinalCoords),
      i32(m, pFinalCoords + 4),
    ) === 0
  ) {
    throw new D2CommonAssertError('Act.cpp', 0x1d6);
  }
  CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c(m, pClient, 0);
  S2C_QueueSingleBytePacket1_6FCAC490_113c(m, 5, pClient);
  CLIENTS_SetClientActNo_6FC69D70_113c(m, pClient, nAct);
  w8(m, pPlayer + 0x18, nAct);
  w32(m, pPlayer + 0x1c, u32(m, pActSlot));
  CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c(m, pClient, pGame);
  CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c(m, pClient, pFinalRoom);
  UNITROOM_RefreshUnit113c(m, pPlayer);
  w32(m, pPlayer + 0xc8, (u32(m, pPlayer + 0xc8) | 0x10000) >>> 0);
  SUNIT_UpdateUnitPositionAndRoom113c(m, 0, pPlayer, pGame);
  UNITROOM_RefreshUnit113c(m, pPlayer);
  if (u32(m, pPlayer) === 0) {
    PETS_WarpOrUnsummonPlayerPets_6FCB7340_113c(
      m,
      pGame,
      pPlayer,
      UNIT_GetPosX113c(m, pPlayer),
      UNIT_GetPosY113c(m, pPlayer),
    );
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCC9D40
 * @ordinalOrName sub_6FCC9D40
 */
export function AI_Think_TeleportLeashOrApproachOwner_6FCC9D40_113c(
  m: SparseMemory113c,
  pGame: number,
  pMonster: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FCC9D40)
  const pMonStats = u32(m, pAiTickArgs + 0x1c);
  const pOwner = u32(m, pAiTickArgs + 0x08);
  const nDist = i32(m, pAiTickArgs + 0x14);
  if (pOwner === 0) {
    AI_Stall113c(m, pGame, pMonster, 0x19);
    return;
  }
  const nOwnerType = i32(m, pOwner);
  const bOwnerIdle =
    (nOwnerType === 0 || nOwnerType === 1) && i32(m, pOwner + 0x10) === 1;
  const pAiCtrl = u32(m, pAiTickArgs);
  let bCastSkill4 = false;
  if (bOwnerIdle) {
    const nIdleCnt = (i32(m, pAiCtrl + 0x14) + 1) | 0;
    w32(m, pAiCtrl + 0x14, nIdleCnt);
    const bDiff = u8(m, pGame + 0x6d);
    const nMaxIdle = i16(m, pMonStats + bDiff * 2 + 0x5c);
    if (nIdleCnt > nMaxIdle) {
      bCastSkill4 = true;
    }
  }
  if (!bOwnerIdle || bCastSkill4) {
    w32(m, pAiCtrl + 0x14, 0);
    if (bCastSkill4) {
      AI_CastSkillWithMode113c(
        m,
        4,
        pMonster,
        pGame,
        0x11c,
        pOwner,
        0,
        0,
        worldOf(m, pGame),
      );
      return;
    }
  }
  const bDiff = u8(m, pGame + 0x6d);
  const nTeleportDist = i16(m, pMonStats + bDiff * 2 + 0x62);
  if (nDist > nTeleportDist) {
    const nTargetY = UNIT_GetPosY113c(m, pOwner);
    const nTargetX = UNIT_GetPosX113c(m, pOwner);
    const pOwnerRoom = UNITS_GetRoom113c(m, pOwner) >>> 0;
    if (
      sunitWarpUnitToCoords_6FD019C0(
        m,
        nTargetX,
        pOwnerRoom,
        nTargetY,
        pMonster,
        pGame,
        0,
        0,
      ) !== 0
    ) {
      AI_Stall113c(m, pGame, pMonster, 0x19);
      return;
    }
  }
  const nWalkDist = i16(m, pMonStats + u8(m, pGame + 0x6d) * 2 + 0x56);
  if (nDist > nWalkDist) {
    AI_ApproachTarget113c(worldOf(m, pGame), pMonster, pOwner, 2, 0, 0, 1, 0);
    return;
  }
  AI_Stall113c(m, pGame, pMonster, 0x19);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCD46B0
 * @ordinalOrName sub_6FCD46B0
 */
export function SKILLS_SrvDo_TeleportMonsterToFirstPathPoint_6FCD46B0_113c(
  m: SparseMemory113c,
  pGame: number,
  pMonster: number,
  _nSkillId: number = 0,
  _nSkillLevel: number = 0,
): number {
  hitD2GameVa113c(0x6FCD46B0)
  const pPath = u32(m, pMonster + 0x2c);
  const nX = PATH_GetFirstPointX113c(m, pPath);
  const nY = PATH_GetFirstPointY113c(m, pPath);
  const pCurRoom = UNITS_GetRoom113c(m, pMonster) >>> 0;
  let pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pCurRoom, nX, nY) >>> 0;
  if (pTargetRoom === 0 && u32(m, pMonster) === 1) {
    const pMonData = u32(m, pMonster + 0x14);
    const pAiGeneral = pMonData !== 0 ? u32(m, pMonData + 0x28) : 0;
    if (pAiGeneral !== 0 && u32(m, pAiGeneral + 0x28) !== 0) {
      const pOwner =
        SUNIT_GetServerUnit113c(
          m,
          u32(m, pAiGeneral + 0x28),
          i32(m, pAiGeneral + 0x30),
          u32(m, pAiGeneral + 0x2c),
        ) >>> 0;
      if (pOwner !== 0) {
        pTargetRoom = UNITS_GetRoom113c(m, pOwner) >>> 0;
      }
    }
  }
  if (
    sunitWarpUnitToCoords_6FD019C0(
      m,
      nX,
      pTargetRoom,
      nY,
      pMonster,
      pGame,
      0,
      0,
    ) === 0
  ) {
    return 0;
  }
  UNITROOM_RefreshUnit113c(m, pMonster);
  w32(m, pMonster + 0xc8, (u32(m, pMonster + 0xc8) | 0x10000) >>> 0);
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCD4760
 * @ordinalOrName sub_6FCD4760
 */
export function SKILLS_SrvDo_SubmergeOrBurrowMonster_6FCD4760_113c(
  m: SparseMemory113c,
  pGame: number,
  pMonster: number,
  _nSkillId: number = 0,
  _nSkillLevel: number = 0,
): number {
  hitD2GameVa113c(0x6FCD4760)
  const nUnitType = i32(m, pMonster);
  const bStaticPos = nUnitType === 2 || (nUnitType > 3 && nUnitType <= 5);
  const pPath = u32(m, pMonster + 0x2c);
  const nX =
    pPath === 0
      ? 0
      : bStaticPos
        ? i32(m, pPath + 0x0c)
        : PATH_GetPosX113c(m, pPath);
  const nY =
    pPath === 0
      ? 0
      : bStaticPos
        ? i32(m, pPath + 0x10)
        : PATH_GetPosY113c(m, pPath);
  const pRoom = UNITS_GetRoom113c(m, pMonster) >>> 0;
  if (
    sunitWarpUnitToCoords_6FD019C0(m, nX, pRoom, nY, pMonster, pGame, 0, 0) === 0
  ) {
    return 0;
  }
  w32(m, pMonster + 0xc4, (u32(m, pMonster + 0xc4) | 0x0e) >>> 0);
  const nUnitType2 = i32(m, pMonster);
  const bStaticPos2 = nUnitType2 === 2 || (nUnitType2 > 3 && nUnitType2 <= 5);
  const pPath2 = u32(m, pMonster + 0x2c);
  const nX2 =
    pPath2 === 0
      ? 0
      : bStaticPos2
        ? i32(m, pPath2 + 0x0c)
        : PATH_GetPosX113c(m, pPath2);
  const nY2 =
    pPath2 === 0
      ? 0
      : bStaticPos2
        ? i32(m, pPath2 + 0x10)
        : PATH_GetPosY113c(m, pPath2);
  const pRoom2 = UNITS_GetRoom113c(m, pMonster) >>> 0;
  COLLISION_SetUnitCollisionMaskWithPattern113c(m, pRoom2, nX2, nY2, 1, 0x1000);
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCE0DB0
 * @ordinalOrName sub_6FCE0DB0
 */
export function NPCTRADE_InteractResurrectMerc_6FCE0DB0_113c(
  m: SparseMemory113c,
  dwNpcGuid: number,
  pGame: number,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FCE0DB0)
  const pInteractUnit =
    u8(m, pPlayer + 0x6c) !== 0
      ? SUNIT_GetServerUnit113c(
          m,
          pGame,
          i32(m, pPlayer + 0x68),
          u32(m, pPlayer + 0x64),
        ) >>> 0
      : 0;
  if (pGame === 0) {
    throw new D2CommonAssertError('NpcTrade.cpp', 0x2d3);
  }
  let pNpc = u32(m, pGame + 0x1320 + ((dwNpcGuid & 0x7f) << 2));
  while (pNpc !== 0 && u32(m, pNpc + 0x0c) !== (dwNpcGuid >>> 0)) {
    pNpc = u32(m, pNpc + 0xe4);
  }
  const getClient = (): number =>
    u32(m, pPlayer) === 0 ? u32(m, UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) : 0;
  const queueFailPacket2A = (): void => {
    const sp = K2_W11B1_SCRATCH_BASE;
    m.fill(sp, 0x10, 0);
    w8(m, sp, 0x2a);
    w8(m, sp + 1, 0);
    w8(m, sp + 2, 9);
    w32(m, sp + 7, 0xffffffff);
    w32(m, sp + 0x0b, STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0));
    NET_QueuePacketToClientBuffer113c(m, getClient(), 1, sp, 0x0f);
  };
  if (pNpc === 0 || pNpc !== pInteractUnit) {
    queueFailPacket2A();
    return;
  }
  const nNpcClassId = i32(m, pNpc + 0x04);
  const bCanResurrect =
    nNpcClassId === 0x96 ||
    nNpcClassId === 0xc6 ||
    nNpcClassId === 0xfc ||
    nNpcClassId === 0x16f ||
    nNpcClassId === 0x203;
  if (!bCanResurrect) {
    NET_SendPacket15B_TransactionResult_6FCAAC90_113c(
      m,
      0x2a,
      9,
      STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0),
      getClient(),
      0xffffffff,
      0,
    );
    return;
  }
  const pMerc = PETS_GetFirstPetUnitByType_6FCB6A40_113c(m, pPlayer, 7, 1, pGame) >>> 0;
  if (pMerc === 0) {
    queueFailPacket2A();
    return;
  }
  const nCost = STATLIST_GetUnitHirelingResurrectCost113c(m, pMerc) | 0;
  if (NPC_DeductPlayerGoldAndStash_6FCDCC60_113c(m, pPlayer, nCost) === 0) {
    NET_SendPacket15B_TransactionResult_6FCAAC90_113c(
      m,
      0x2a,
      0x0c,
      STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0),
      getClient(),
      0xffffffff,
      0,
    );
    return;
  }
  w32(m, pMerc + 0xc4, (u32(m, pMerc + 0xc4) & ~0x10000) >>> 0);
  UNITS_ChangeAnimMode113c(m, pMerc, 1);
  const nMaxLife = STATLIST_GetMaxLifeFromUnit113c(m, pMerc);
  STATLIST_SetUnitStat113c(m, pMerc, 6, nMaxLife, 0);
  NPCS_ResurrectOrReplacePlayerMerc_6FCE0B90_113c(m, pMerc, pGame, pPlayer);
  NET_SendPacket9B_MercReviveInfo_6FCAA690_113c(m, 0xffff, 0, getClient());
  NET_SendPacket15B_TransactionResult_6FCAAC90_113c(
    m,
    0x2a,
    5,
    STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0),
    getClient(),
    u32(m, pMerc + 0x0c),
    0,
  );
}

/**
 * @dll D2Game.dll
 * @va 0x6FCE8990
 * @ordinalOrName sub_6FCE8990
 */
export function ACT2Q4_JerhynPalaceNpcAiOverride_6FCE8990_113c(
  m: SparseMemory113c,
  pGame: number,
  pNpcUnit: number,
  pOutSkipDefaultAi: number,
  pOutHandled: number,
): void {
  hitD2GameVa113c(0x6FCE8990)
  void ACT2Q4_UnitIterate_CheckNearHorazonTome_6FCE31C0_113c;
  void STATES_ClearGfxStateFlag_6FCEB1A0_113c;
  const pQuestChainRoot = u32(m, pGame + 0x10f4);
  let pQuest = pQuestChainRoot !== 0 ? u32(m, pQuestChainRoot) : 0;
  while (pQuest !== 0 && u32(m, pQuest) !== 0x0b) {
    pQuest = u32(m, pQuest + 0xf4);
  }
  if (pQuest === 0 || u8(m, pQuest + 0x09) === 0) {
    w32(m, pOutHandled, 1);
    w32(m, pOutSkipDefaultAi, 0);
    return;
  }
  const pQuestExt = u32(m, pQuest + 0x18);
  if (
    u8(m, pQuestExt + 0x0d) === 0 ||
    QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, pGame, 0x0c, 0x0d) !== 0 ||
    QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, pGame, 0x0e, 0x0d) !== 0 ||
    (ACT2Q2_IsQuestPastState01_6FCE1B60_113c(m, pGame) & 0xff) !== 0 ||
    u8(m, pQuestExt + 0x14) !== 0
  ) {
    w32(m, pOutHandled, 1);
    w32(m, pOutSkipDefaultAi, 0);
    return;
  }
  if ((ACT2Q2_IsQuestInState01_6FCE1B20_113c(m, pGame) & 0xff) !== 0) {
    w8(m, pQuestExt + 0x12, 1);
  }
  if (u8(m, pQuestExt + 0x12) !== 1) {
    w32(m, pOutHandled, 1);
    w32(m, pOutSkipDefaultAi, 0);
    return;
  }
  const bState13 = u8(m, pQuestExt + 0x13);
  if (bState13 === 0) {
    if (u8(m, pQuestExt + 0x0f) !== 0) {
      const pTargetUnit =
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pGame,
          0x6fce31c0,
          0,
          0,
        ) >>> 0;
      const nTargetY = i32(m, pQuestExt + 0x24);
      const nTargetX = i32(m, pQuestExt + 0x20);
      if (pTargetUnit !== 0) {
        w8(m, pQuestExt + 0x13, 1);
        if (
          Boolean(
            AI_ApproachTarget113c(
              worldOf(m, pGame),
              pNpcUnit,
              0,
              2,
              nTargetX,
              nTargetY,
              1,
              0,
            ),
          )
        ) {
          w32(m, pOutHandled, 1);
          w32(m, pOutSkipDefaultAi, 1);
          return;
        }
        w32(m, pOutHandled, 0);
        w32(m, pOutSkipDefaultAi, 0);
        return;
      }
      if (
        UNITS_GetOctileDistanceToCoordinates113c(
          m,
          pNpcUnit,
          nTargetX,
          nTargetY,
        ) > 7
      ) {
        if (
          Boolean(
            AI_ApproachTarget113c(
              worldOf(m, pGame),
              pNpcUnit,
              0,
              2,
              nTargetX,
              nTargetY,
              1,
              0,
            ),
          )
        ) {
          w32(m, pOutHandled, 1);
          w32(m, pOutSkipDefaultAi, 1);
          return;
        }
        w32(m, pOutHandled, 0);
        w32(m, pOutSkipDefaultAi, 0);
        return;
      }
    }
    w32(m, pOutHandled, 1);
    w32(m, pOutSkipDefaultAi, 0);
    return;
  }
  if (bState13 === 1) {
    const pOutPos = K2_W11B1_SCRATCH_BASE;
    w32(m, pOutPos, 0);
    w32(m, pOutPos + 4, 0);
    PATH_GetTargetTypeAndPosition113c(m, pNpcUnit, pOutPos);
    const nPosX = UNIT_GetPosX113c(m, pNpcUnit);
    const nPosY = UNIT_GetPosY113c(m, pNpcUnit);
    if (nPosX === i32(m, pOutPos) && nPosY === i32(m, pOutPos + 4)) {
      if (u8(m, pQuestExt + 0x11) !== 0 && i32(m, pQuestExt + 0x38) > 0) {
        const pTargetUnit =
          SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
            m,
            pGame,
            0x6fce31c0,
            0,
            0,
          ) >>> 0;
        if (pTargetUnit !== 0) {
          w8(m, pQuestExt + 0x13, 2);
          if (
            Boolean(
              AI_ApproachTarget113c(
                worldOf(m, pGame),
                pNpcUnit,
                0,
                2,
                i32(m, pQuestExt + 0x28),
                i32(m, pQuestExt + 0x2c),
                1,
                0,
              ),
            )
          ) {
            w32(m, pOutHandled, 1);
            w32(m, pOutSkipDefaultAi, 1);
            return;
          }
          w32(m, pOutHandled, 0);
          w32(m, pOutSkipDefaultAi, 0);
          return;
        }
      }
      w8(m, pQuestExt + 0x13, 0);
      const nTargetY = i32(m, pQuestExt + 0x24);
      const nTargetX = i32(m, pQuestExt + 0x20);
      if (
        UNITS_GetOctileDistanceToCoordinates113c(
          m,
          pNpcUnit,
          nTargetX,
          nTargetY,
        ) > 7
      ) {
        if (
          Boolean(
            AI_ApproachTarget113c(
              worldOf(m, pGame),
              pNpcUnit,
              0,
              2,
              nTargetX,
              nTargetY,
              1,
              0,
            ),
          )
        ) {
          w32(m, pOutHandled, 1);
          w32(m, pOutSkipDefaultAi, 1);
          return;
        }
        w32(m, pOutHandled, 0);
        w32(m, pOutSkipDefaultAi, 0);
        return;
      }
      w32(m, pOutHandled, 1);
      w32(m, pOutSkipDefaultAi, 0);
      return;
    }
    if (
      Boolean(
        AI_ApproachTarget113c(
          worldOf(m, pGame),
          pNpcUnit,
          0,
          2,
          i32(m, pOutPos),
          i32(m, pOutPos + 4),
          1,
          0,
        ),
      )
    ) {
      w32(m, pOutHandled, 1);
      w32(m, pOutSkipDefaultAi, 1);
      return;
    }
    w32(m, pOutHandled, 0);
    w32(m, pOutSkipDefaultAi, 0);
    return;
  }
  if (bState13 === 2) {
    const pOutPos = K2_W11B1_SCRATCH_BASE;
    w32(m, pOutPos, 0);
    w32(m, pOutPos + 4, 0);
    PATH_GetTargetTypeAndPosition113c(m, pNpcUnit, pOutPos);
    const nPosX = UNIT_GetPosX113c(m, pNpcUnit);
    const nPosY = UNIT_GetPosY113c(m, pNpcUnit);
    if (nPosX === i32(m, pOutPos) && nPosY === i32(m, pOutPos + 4)) {
      w8(m, pQuestExt + 0x13, 3);
      w8(m, pQuestExt + 0x14, 1);
      w32(m, pOutHandled, 1);
      w32(m, pOutSkipDefaultAi, 0);
      return;
    }
    if (
      Boolean(
        AI_ApproachTarget113c(
          worldOf(m, pGame),
          pNpcUnit,
          0,
          2,
          i32(m, pOutPos),
          i32(m, pOutPos + 4),
          1,
          0,
        ),
      )
    ) {
      w32(m, pOutHandled, 1);
      w32(m, pOutSkipDefaultAi, 1);
      return;
    }
    w32(m, pOutHandled, 0);
    w32(m, pOutSkipDefaultAi, 0);
    return;
  }
  w32(m, pOutHandled, 1);
  w32(m, pOutSkipDefaultAi, 0);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCEDA20
 * @ordinalOrName sub_6FCEDA20
 */
export function C2S_Packet3B_SpendSkillPoint_6FCEDA20_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEDA20)
  void pGame;
  if ((nPacketLen | 0) !== 3) {
    return 3;
  }
  const wSkillId = u16(m, pPacket + 1);
  const nVal =
    SKILLS_ValidateSkillAllocationEligibility_6FCEB610_113c(
      m,
      wSkillId,
      pPlayer,
    ) | 0;
  const getClient = (): number =>
    pPlayer !== 0 && u32(m, pPlayer) === 0
      ? u32(m, UNITS_GetPlayerData113c(m, pPlayer) + 0x9c)
      : 0;
  if (nVal !== 0) {
    if (nVal === 2) {
      NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c(
        m,
        getClient(),
        pPlayer,
        0,
        1,
        0,
      );
    }
    return nVal;
  }
  const pSkill = SKILLS_GetSkillById113c(m, pPlayer, wSkillId, -1) >>> 0;
  if (pSkill !== 0) {
    const nCurLvl = SKILLS_EvaluateSkillLevel113c(m, pPlayer, pSkill, 0) | 0;
    const nMaxLvl = SKILLS_GetMaxSkillLevel_6FC21740_113c(m, wSkillId) | 0;
    if (nCurLvl >= nMaxLvl) {
      NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c(
        m,
        getClient(),
        pPlayer,
        0,
        1,
        0,
      );
      return 2;
    }
  }
  if (SKILLS_SpendSkillPointsAndIncrementSkill_6FCBFAE0_113c(m, pPlayer, wSkillId) === 0) {
    return 2;
  }
  SKILLS_RefreshPassiveAuraSkills113c(m, pPlayer);
  if (pPlayer !== 0 && u32(m, pPlayer) === 0) {
    const pPlayerGame = u32(m, pPlayer + 0x80);
    PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(
      m,
      pPlayerGame,
      pPlayer,
    );
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCEF0A0
 * @ordinalOrName sub_6FCEF0A0
 */
export function C2S_Packet35_NpcRepair_6FCEF0A0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEF0A0)
  if ((nPacketLen | 0) !== 0x11) {
    return 3;
  }
  const dwNpcGuid = u32(m, pPacket + 1);
  const dwItemGuid = u32(m, pPacket + 5);
  const dwModeOrFlags = u32(m, pPacket + 0x0d);
  NPCS_RepairPlayerItemOrAllItems_6FCDDE60_113c(
    m,
    pPlayer,
    pGame,
    dwNpcGuid,
    dwItemGuid,
    dwModeOrFlags,
  );
  return 0;
}

const K2_W11B1_TELEPORT_RATELIMIT_TABLE_6FD1B170: readonly [number, number][] = [
  [50, 1500],
  [25, 3000],
  [25, 4500],
];

/**
 * @dll D2Game.dll
 * @va 0x6FCEFE40
 * @ordinalOrName sub_6FCEFE40
 */
export function PLAYER_TeleportToCoordsWithRateLimitDelay_6FCEFE40_113c(
  m: SparseMemory113c,
  nTargetY: number,
  nTargetX: number,
  pPlayer: number,
  pGame: number,
  _pTargetRoom: number = 0,
): number {
  hitD2GameVa113c(0x6FCEFE40)
  if (
    sunitWarpUnitToCoords_6FD019C0(
      m,
      nTargetX,
      0,
      nTargetY,
      pPlayer,
      pGame,
      0,
      1,
    ) === 0
  ) {
    return 0;
  }
  CLIENTS_RecordActionRateLimitFrame_6FC6A6E0_113c(m, pPlayer, pGame);
  let nDelayFrames = 0x7d;
  if (
    CLIENTS_IsActionRateLimitExceeded_6FC6A660_113c(m, pPlayer, pGame) !== 0 &&
    u8(m, pGame + 0x6a) === 0
  ) {
    let nRoll = seedRoll(unitSeedOf(m, pPlayer + 0x20), 100) | 0;
    for (let i = 0; i < 3; i += 1) {
      const entry = K2_W11B1_TELEPORT_RATELIMIT_TABLE_6FD1B170[i]!;
      if (nRoll < entry[0]) {
        nDelayFrames = entry[1];
        break;
      }
      nRoll = (nRoll - entry[0]) | 0;
    }
  }
  const dwExpireFrame = (u32(m, pGame + 0xa8) + nDelayFrames) >>> 0;
  STATES_ToggleGfxStateFlag113c(m, pPlayer, 0x6c, 1);
  const dwOwnerType = pPlayer !== 0 ? u32(m, pPlayer) : 6;
  const dwOwnerGuid = pPlayer !== 0 ? u32(m, pPlayer + 0x0c) : 0xffffffff;
  const pStatList =
    STATLIST_AllocList113c(
      m,
      2,
      dwOwnerType,
      dwOwnerGuid,
      0,
      dwExpireFrame,
    ) >>> 0;
  STATLIST_SetState113c(m, pStatList, 0x6c);
  STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fceb1a0);
  STATLIST_MergeStatLists113c(m, pPlayer, pStatList, 1);
  EVENT_SetEventFull113c(m, pGame, pPlayer, 0x0c, dwExpireFrame, 0, 0, 0);
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FD01C00
 * @ordinalOrName sub_6FD01C00
 */
export function DUNGEON_ExecuteRoomTileWarpTransition_6FD01C00_113c(
  m: SparseMemory113c,
  pSourceUnit: number,
  pPlayerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FD01C00)
  if (pGame === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x14a);
  }
  if (pPlayerUnit === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x14b);
  }
  const pSrcRoom = UNITS_GetRoom113c(m, pSourceUnit) >>> 0;
  const nSrcClassId = pSourceUnit !== 0 ? i32(m, pSourceUnit + 0x04) : -1;
  const pOutLvlWarpTxt = K2_W11B1_SCRATCH_BASE;
  w32(m, pOutLvlWarpTxt, 0);
  const pWarpUnit =
    DUNGEON_FindWarpPortalUnitInTargetLevel113c(
      m,
      pSrcRoom,
      nSrcClassId,
      pOutLvlWarpTxt,
    ) >>> 0;
  if (pWarpUnit === 0) {
    return;
  }
  const pDestRoom = UNITS_GetRoom113c(m, pWarpUnit) >>> 0;
  const nWarpX = UNIT_GetPosX113c(m, pWarpUnit);
  const nWarpY = UNIT_GetPosY113c(m, pWarpUnit);
  if (u32(m, pPlayerUnit) !== 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x15d);
  }
  const pCoords = (K2_W11B1_SCRATCH_BASE + 8) >>> 0;
  w32(m, pCoords, nWarpX);
  w32(m, pCoords + 4, nWarpY);
  const pFinalRoom =
    COLLISION_FindFreePositionSimple113c(
      m,
      pDestRoom,
      pCoords,
      UNITS_GetUnitSizeX113c(m, pPlayerUnit),
      0x1c09,
      1,
    ) >>> 0;
  if (pFinalRoom === 0) {
    return;
  }
  const nSrcLvl = DUNGEON_GetLevelIdFromRoom113c(m, pSrcRoom) | 0;
  const nDestLvl = DUNGEON_GetLevelIdFromRoom113c(m, pFinalRoom) | 0;
  if (
    nDestLvl === 0x49 ||
    nDestLvl === 0x80 ||
    nDestLvl === 0x84 ||
    nDestLvl === 0x76 ||
    nDestLvl === 0x64
  ) {
    if (
      QUESTS_CheckLevelTransitionBlocked_6FC54020_113c(
        m,
        pGame,
        nDestLvl,
        pPlayerUnit,
        nSrcLvl,
      ) !== 0
    ) {
      return;
    }
  }
  const warpX = i32(m, pCoords);
  const warpY = i32(m, pCoords + 4);
  if (
    sunitWarpUnitToCoords_6FD019C0(
      m,
      warpX,
      pDestRoom,
      warpY,
      pPlayerUnit,
      pGame,
      0,
      0,
    ) === 0
  ) {
    return;
  }
  const pClient =
    u32(m, pPlayerUnit) === 0
      ? u32(m, UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c)
      : 0;
  const pLvlWarpTxt = u32(m, pOutLvlWarpTxt);
  const nExitX = (i32(m, pLvlWarpTxt + 0x14) + warpX) | 0;
  const nExitY = (i32(m, pLvlWarpTxt + 0x18) + warpY) | 0;
  PLAYER_StartModeAtCoords113c(m, pGame, pPlayerUnit, 2, nExitX, nExitY, 0);
  const bLifePct = STATLIST_GetUnitLifePercent113c(m, pPlayerUnit) & 0xff;
  NET_SendPacket13B_UnitCoordEvent_6FCAC280_113c(
    m,
    u8(m, pPlayerUnit),
    0x0d,
    u32(m, pPlayerUnit + 0x0c),
    pClient,
    1,
    nExitX,
    nExitY,
    0,
    bLifePct,
  );
}
