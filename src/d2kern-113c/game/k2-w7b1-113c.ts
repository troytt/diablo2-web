/**
 * K2 Wave 7 Batch 1 (`w7b1`): 40 `D2Game.dll` v1.13c functions ported 1:1
 * onto `SparseMemory113c` (`D2KernMemory113c`).
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { imul32, mulDiv113c, sdiv32 } from '../common/int-math.ts'
import { ITEMS_DecodeItemCompactBitstreamV96_113c } from '../common/inventory.ts'
import {
  ITEMS_CanItemLoseDurability113c,
  ITEMS_GetActiveWeaponClassCodeIdx113c,
  ITEMS_GetMissileType113c,
  ITEMS_SerializeItemToBuffer113c,
  ITEMS_SetItemFlag113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../common/items.ts'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import {
  MISSILE_GetLevel113c,
  MISSILE_GetSkill113c,
  MISSILE_SetTargetX113c,
  MISSILE_SetTargetY113c,
} from '../common/missile.ts'
import {
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetUnit113c,
  PATH_SetStepNum113c,
  PATH_SetType113c,
} from '../common/path.ts'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetParam1113c,
  SKILLS_GetParam2113c,
  SKILLS_GetParam3113c,
  SKILLS_GetSkillToHitBonus113c,
  SKILLS_SetParam0C113c,
  SKILLS_SetParam1113c,
  SKILLS_SetParam2113c,
  SKILLS_SetParam3113c,
} from '../common/skills.ts'
import {
  DATATBLS_CalculateMonsterStatsByLevel113c,
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist.ts'
import {
  TEXT_AllocTextList113c,
  TEXT_BuildMessageList113c,
  TEXT_FreeTextList113c,
} from '../common/text.ts'
import {
  UNIT_GetAlignment113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetEquippedWeaponAdder113c,
  UNITS_GetRoom113c,
} from '../common/unit.ts'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { SEED_InitLowSeed113c, SEED_InitSeed113c, seedRoll } from '../prng.ts'
import {
  DATATBLS_GetMaxLevel113c,
  DATATBLS_GetMonLvlTxtRecord113c,
  DATATBLS_GetStartExpForLevel113c,
} from '../tables/datatbls-113c.ts'
import { DATATBLS_GetMonsterChainInfo113c } from '../tables/monster-tbls-113c.ts'
import { SUNIT_AreUnitsHostileOrUnaligned113c } from './a1c-post150-f786-f1040-113c.ts'
import { AI_CastSkillWithMode113c, MONSTER_CheckTypeFlagsMask113c } from './ai-fallen-113c.ts'
import {
  AI_IdleWander113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ComputeWeaponBaseDamage113c,
  SUNITDMG_ExecuteEvents113c,
} from './combat-a1c-113c.ts'
import {
  ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c,
  ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c,
} from './k2-real-itemdrop-113c.ts'
import { SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c } from './k2-real-s2c-combat-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import {
  AURA_ForEachUnitInRadius113c,
  DATATBLS_GetItemStatCostRecordFast113c,
  STATES_CreateOrUpdateAuraStatList113c,
} from './k2-gap-itemdef-113c.ts'
import {
  MISSILE_CreateServerProjectile113c,
  MISSILE_ProcessTargetCollisionHit113c,
  SKILLS_ResolveChargedSrvMissileId113c,
} from './k2-gap-melee-dot-113c.ts'
import {
  PLAYER_IsBusyWithCursorOrNpcInteract113c,
  QUESTS_SendPlayerQuestLogPacket28_113c,
} from './k2-items-tc-w1-113c.ts'
import {
  PLAYER_GetQuestRecordForDifficulty_6FC21020_113c,
  SKILLS_GetParam2Fast_6FC21BC0_113c,
  SKILLS_GetParam4Fast_6FC21C20_113c,
  SKILLS_GetParam6Fast_6FC21EC0_113c,
  SKILLS_GetParam7Fast_6FC21EF0_113c,
} from './k2-laneH-0x6fc2-w1-113c.ts'
import {
  AI_ScanOverlordMinionTargetsCallback_6FC35C40_113c,
  ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c,
} from './k2-laneI-0x6fc3-w1-113c.ts'
import {
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
  QUESTS_SetGlobalQuestState_6FC53920_113c,
} from './k2-laneJ-0x6fc4-w1-113c.ts'
import {
  MISSILES_InitChargedBoltPath_6FC61F50_113c,
  QUESTS_SendGameQuestStatePacket29_6FC55030_113c,
  QUESTS_TriggerCallback00_6FC54660_113c,
  SKILLS_StatListExpireClearState_6FC62290_113c,
} from './k2-laneK-0x6fc5-w1-113c.ts'
import {
  CLIENTS_GetClientGame_6FC69A80_113c,
  SKILLS_AddDamagePercentStat_6FC6C190_113c,
} from './k2-laneL-0x6fc6-w1-113c.ts'
import {
  ACT5Q3_EnsureAnyaTownPortalSpawned_6FC77CB0_113c,
  ACT5Q3_GetPortalTargetCoords_6FC76A40_113c,
  ACT5Q3_IsFrozenAnyaUnspawned_6FC76950_113c,
} from './k2-laneM-0x6fc7-w1-113c.ts'
import {
  SKILLS_DivideValueByMonLvlHp113c,
  SKILLS_IsDimVisionOrTerrorState113c,
} from './k2-sunit-spawn-w1-113c.ts'
import {
  ACT1Q4_GetTristramPortalTargetCoords_6FC80450_113c,
  ACT1Q4_IsCainSavedFlag93Set_6FC80390_113c,
  ACT5Q4_ApplyPlayerSkillState52IfQuest26State0D_6FC78FF0_113c,
  ACT5Q4_SyncPlayerQuest26State0EAlert22_6FC79060_113c,
  QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c,
} from './k2-w2b1-113c.ts'
import {
  NET_SendPacket103B_QuestRecord_6FCAAD40_113c,
  NET_SendPacketBuffer40B_6FCAB3D0_113c,
} from './k2-w2b3-113c.ts'
import { ITEMS_ClearAllDupeAndCommandFlags_6FCBB340_113c } from './k2-w2b4-113c.ts'
import {
  MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c,
  SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c,
} from './k2-w2b5-113c.ts'
import {
  AI_StartModeAtCoordsKeepSteps_6FD121E0_113c,
  SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c,
  SUNIT_SetLastKillerInfo_6FCFFAE0_113c,
} from './k2-w2b8-113c.ts'
import {
  SKILLS_FindNextMeleeTargetInRadius_6FC472C0_113c,
  SKILLS_SetupChargeOrLeapPath_6FC46A80_113c,
} from './k2-w3b2-113c.ts'
import { REGPOP_SpawnMonsterFormation_6FC671E0_113c } from './k2-w3b4-113c.ts'
import {
  ACT5Q2_SpawnBarbarianSoldiersInPrison_6FC7C2A0_113c,
  ACT5Q4_CheckPlayerNearNihlathakRoom_6FC77900_113c,
} from './k2-w3b5-113c.ts'
import {
  ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c,
  ACT1Q4_SpawnTristramPortalObject_6FC81340_113c,
} from './k2-w3b6-113c.ts'
import { UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c } from './k2-w3b8-113c.ts'
import { ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c } from './k2-w4b2-113c.ts'
import { ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c } from './k2-w4b4-113c.ts'
import {
  SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c,
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c,
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c,
} from './k2-w4b6-113c.ts'
import {
  AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c,
  SKILLS_ExecuteRadiusMeleeHitAndClearStun_6FC47820_113c,
} from './k2-w5b1-113c.ts'
import { ACT5Q4_PropagateQuestStateToPartyCallback_6FC7AF50_113c } from './k2-w5b2-113c.ts'
import {
  AURA_FindClosestUnitInRadius_6FCC1000_113c,
  AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c,
  AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c,
} from './k2-w5b3-113c.ts'
import {
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c,
  SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c,
  SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c,
  SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c,
} from './k2-w5b7-113c.ts'
import {
  QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c,
  QUESTS_SpawnProjectile12B_6FD0AB10_113c,
} from './k2-w5b9-113c.ts'
import { AI_CircleStrafeTarget_6FD126B0_113c } from './k2-w5b10-113c.ts'
import {
  MISSILE_SrvHit_RadialStatsDamageByAuraRange_6FC5B5F0_113c,
  SKILLS_ApplyAttractCurseCallback_6FC70B70_113c,
  SKILLS_ApplyCurseStateAndStatsCallback_6FC70250_113c,
  SKILLS_CanConvertOrMindBlastTarget_6FC6EE80_113c,
  SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c,
  SKILLS_SpawnProjectileAtTargetUnitIfBothOutsideTown_6FC62510_113c,
  STORM_TSHashTableCheckChainAndGrow_6FC221D0_113c,
} from './k2-w6b1-113c.ts'
import {
  AURAS_ApplyRadialDamageWithDefaultFilter_6FCC1240_113c,
  NPC_SendHirelingListPacketsToClient_6FCDD330_113c,
  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c,
  SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c,
} from './k2-w6b2-113c.ts'
import {
  ACT2Q0_PresetSpawnJerhynAndRelocate_6FCE9B70_113c,
  NET_BroadcastSystemChatMessage_6FCEBE70_113c,
  PLAYER_SyncClientLifeManaStaminaGoldAndCoords_6FCEC030_113c,
} from './k2-w6b3-113c.ts'
import {
  ACT5Q1_OnShenkSpottedPromoteState2_6FC7A690_113c,
  ACT5Q3_OnFrozenRiverEnteredPromoteState2_6FC79F80_113c,
  ITEMS_RollAndApplyWeaponDurabilityOrQuantityLoss_6FC6C9E0_113c,
  SKILLS_SpawnChannelingProjectileAndAdvanceTick_6FC641C0_113c,
  SKILLS_UpdateLeapMovementStep_6FC48740_113c,
} from './k2-w6b4-113c.ts'
import { SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c } from './k2-w6b5-113c.ts'
import {
  ACT3Q5_CorruptMonstersAndFireCompellingOrbProjectile_6FD0A930_113c,
  ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c,
  MONSTER_SpawnPresetPackTable_6FD0F940_113c,
  PLAYER_LevelUp_6FD0B090_113c,
  QUESTS_OnUberTristramBossKilledDropTorchAndStandards_6FD0AA30_113c,
} from './k2-w6b6-113c.ts'
import {
  registerAiTargetModeCallback113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_GetRecordPtr113c,
  MONSTATS_CheckFlagBit113c,
  SEED_RollLimitedFast113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts'
import { SUNIT_FreeUnit113c } from './replay-final11-113c.ts'
import {
  PLAYER_GetEquippedWeapon113c,
  SKILLS_GetFlags113c,
} from './replay-kernel-113c.ts'
import {
  EVENT_DeleteEventByArg14_113c,
  EVENT_FreeNode113c,
  EVENT_SetEventFull113c,
  SUNIT_GetLastAttacker113c,
} from './timer-wheel.ts'
import {
  AI_WarrivGreetMem113c,
  UNITS_GetOctileDistanceToCoordinates113c,
} from './town-npc-ai-113c.ts'
import { AITARGET_ScanUnitsByModeTable113c } from './town-runtime-gap-113c.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

export type D2KernMemory113c = Memory113c
export class D2CommonAssertError extends Error {
  constructor(file: string, line = 0) {
    super(file + ':' + line)
  }
}

const K2_W7B1_STACK_BASE_VA_113C = 0x7fd80000
let k2W7B1StackPtr = K2_W7B1_STACK_BASE_VA_113C

function sx8(v: number): number {
  return (v << 24) >> 24
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function i32(m: D2KernMemory113c, addr: number): number {
  return m.u32(addr >>> 0) | 0
}

function stepSeed64At113c(m: D2KernMemory113c, pSeed: number): number {
  const addr = pSeed >>> 0
  const lo = BigInt(m.u32(addr))
  const hi = BigInt(m.u32((addr + 0x04) >>> 0))
  const next = lo * 0x6ac690c5n + hi
  const nextLo = Number(next & 0xffffffffn) >>> 0
  const nextHi = Number((next >> 32n) & 0xffffffffn) >>> 0
  m.setU32((addr + 0x04) >>> 0, nextHi)
  m.setU32(addr, nextLo)
  return nextLo | 0
}

function rollSeedPtr113c(m: D2KernMemory113c, pSeed: number, nMax: number): number {
  const addr = pSeed >>> 0
  const max = nMax | 0
  hitD2GameVa113c(0x6FC21180)
  if (addr === 0 || max <= 0) return 0
  const seed = { lo: m.u32(addr), hi: m.u32((addr + 0x04) >>> 0) }
  if (((max - 1) & max) === 0) {
    return (stepSeed64At113c(m, addr) & (max - 1)) | 0
  }
  const res = seedRoll(seed, max)
  m.setU32(addr, seed.lo >>> 0)
  m.setU32((addr + 0x04) >>> 0, seed.hi >>> 0)
  return res | 0
}

function readUnitPosXInline113c(m: D2KernMemory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const uType = i32(m, u)
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    return pPath !== 0 ? i32(m, (pPath + 0x0c) >>> 0) : 0
  }
  return pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
}

function readUnitPosYInline113c(m: D2KernMemory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const uType = i32(m, u)
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    return pPath !== 0 ? i32(m, (pPath + 0x10) >>> 0) : 0
  }
  return pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0
}

function aiApproachTarget6FD12540(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pTarget: number,
  nMode: number,
  nX: number,
  nY: number,
  nStepNum: number,
  dwFlags: number,
): number {
  let mode = nMode | 0
  hitD2GameVa113c(0x6FD12540)
  if (mode === 0x0f && (STATES_CheckState113c(m, pUnit >>> 0, 0x3c) | 0) !== 0) {
    let pAiControl = 0
    if (pUnit !== 0 && i32(m, pUnit >>> 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) pAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
    }
    if (pAiControl !== 0) {
      m.setU32((pAiControl + 0x18) >>> 0, 0)
      m.setU32((pAiControl + 0x1c) >>> 0, 0)
      m.setU8((pAiControl + 0x20) >>> 0, 0)
    }
    mode = 2
  }
  const pPath = pUnit !== 0 ? m.u32((pUnit + 0x2c) >>> 0) >>> 0 : 0
  if (pPath !== 0) PATH_SetStepNum113c(m, pPath, nStepNum | 0)
  const res =
    MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, mode, pTarget >>> 0, nX | 0, nY | 0) | 0
  if (res !== 0) return res
  const flagsByte = dwFlags & 0xff
  if ((flagsByte & 4) !== 0 && pUnit !== 0) {
    let pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pEvent !== 0) {
      const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
      if (m.u8(pEvent) === 2) EVENT_FreeNode113c(m, pGame >>> 0, pEvent)
      pEvent = pNext
    }
  }
  if ((flagsByte & 1) !== 0 && pUnit !== 0 && i32(m, pUnit >>> 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    const pAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
    if (pAiGen !== 0) m.setU8((pAiGen + 0x08) >>> 0, (m.u8((pAiGen + 0x08) >>> 0) | 0x40) & 0xff)
  }
  if ((flagsByte & 2) !== 0 && pUnit !== 0) {
    const roll = (stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100
    if (roll < 0x46) {
      AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 4)
      return 1
    }
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 10)
    return 1
  }
  return res
}

function aiFleeFrom6FD12D80(
  m: D2KernMemory113c,
  pFrom: number,
  pGame: number,
  pUnit: number,
  nDistByte: number,
  bClearThinkOnFail: number,
): number {
  const unit = pUnit >>> 0
  const from = pFrom >>> 0
  hitD2GameVa113c(0x6FD12D80)
  if (unit === 0 || from === 0) return 0
  const mx = readUnitPosXInline113c(m, unit)
  const my = readUnitPosYInline113c(m, unit)
  const fx = readUnitPosXInline113c(m, from)
  const fy = readUnitPosYInline113c(m, from)
  const sx = fx > mx ? -1 : fx < mx ? 1 : 0
  const sy = fy > my ? -1 : fy < my ? 1 : 0
  const dist = nDistByte & 0xff
  const tx = (mx + imul32(dist, sx)) | 0
  const ty = (my + imul32(dist, sy)) | 0
  if (dist > 5 && i32(m, unit) === 1) {
    const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
    const pAiCtrl = pMonData !== 0 ? m.u32((pMonData + 0x2c) >>> 0) >>> 0 : 0
    if (pAiCtrl !== 0) {
      m.setU8((pAiCtrl + 0x20) >>> 0, dist < 0x4e ? dist : 0x4d)
    }
  }
  return aiApproachTarget6FD12540(
    m,
    pGame,
    unit,
    0,
    2,
    tx,
    ty,
    1,
    bClearThinkOnFail !== 0 ? 4 : 0,
  )
}

/**
 * [1/40] `STORM_TSHashTableInsertOrCreateNode_6FC22090_113c`
 * @dll D2Game.dll
 * @va 0x6FC22090
 * @ordinalOrName D2Game_6FC22090
 */
export function STORM_TSHashTableInsertOrCreateNode_6FC22090_113c(
  m: D2KernMemory113c,
  pHashTable: number,
  dwKey: number,
  nExtraBytes: number,
  dwFlags: number,
  onInternalNew?: (
    m: D2KernMemory113c,
    pTable: number,
    pBucketHead: number,
    nExtra: number,
    flags: number,
  ) => number,
): number {
  hitD2GameVa113c(0x6FC22090)
  const tbl = pHashTable >>> 0
  const key = dwKey >>> 0
  let bucketIdx = (key & m.u32((tbl + 0x24) >>> 0)) >>> 0
  if (STORM_TSHashTableCheckChainAndGrow_6FC221D0_113c(m, tbl, bucketIdx) !== 0) {
    bucketIdx = (key & m.u32((tbl + 0x24) >>> 0)) >>> 0
  }
  const pBucketsBase = m.u32((tbl + 0x1c) >>> 0) >>> 0
  const pBucketHead = (pBucketsBase + imul32(bucketIdx, 0x0c)) >>> 0
  let pNode = 0
  if (onInternalNew !== undefined) {
    pNode = onInternalNew(m, tbl, pBucketHead, nExtraBytes >>> 0, dwFlags >>> 0) >>> 0
  } else {
    const pVtable = m.u32(tbl) >>> 0
    const pfnInternalNew = pVtable !== 0 ? m.u32((pVtable + 0x04) >>> 0) >>> 0 : 0
    if (pfnInternalNew !== 0) {
      const allocBytes = Math.max(0x1d80, ((nExtraBytes >>> 0) + 0x40) >>> 0)
      pNode = m.alloc(allocBytes) >>> 0
      m.fill(pNode, allocBytes, 0)
    }
  }
  const pLink =
    pNode !== 0 ? ((m.u32((tbl + 0x04) >>> 0) + pNode) >>> 0) : ((tbl + 0x08) >>> 0)
  const pPrevNext = m.u32(pLink) >>> 0
  if (pPrevNext !== 0) {
    let pBack = i32(m, (pLink + 0x04) >>> 0)
    if (pBack < 0) {
      pBack = ~pBack
    } else {
      const delta = (pLink - m.u32((pPrevNext + 0x04) >>> 0)) | 0
      pBack = (pBack + delta) | 0
    }
    m.setU32(pBack >>> 0, pPrevNext)
    const pCurNext = m.u32(pLink) >>> 0
    const curBack = m.u32((pLink + 0x04) >>> 0)
    m.setU32((pCurNext + 0x04) >>> 0, curBack)
    m.setU32(pLink, 0)
    m.setU32((pLink + 0x04) >>> 0, 0)
  }
  const pOldHead = m.u32((tbl + 0x08) >>> 0) >>> 0
  m.setU32(pLink, pOldHead)
  const oldHeadBack = m.u32((pOldHead + 0x04) >>> 0)
  m.setU32((pLink + 0x04) >>> 0, oldHeadBack)
  m.setU32((pOldHead + 0x04) >>> 0, pNode)
  m.setU32((tbl + 0x08) >>> 0, pLink)
  m.setU32(pNode, key)
  return pNode
}

/**
 * [2/40] `SKILLS_SrvDo004_SpawnMissileWithDeltaTargetXY_6FC2D290_113c`
 * @dll D2Game.dll
 * @va 0x6FC2D290
 * @ordinalOrName D2Game_6FC2D290
 */
export function SKILLS_SrvDo004_SpawnMissileWithDeltaTargetXY_6FC2D290_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2D290)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  if (pDataTables === 0 || skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillTxt = (pSkillsTxtBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillTxt === 0) return 0
  const wSrvMissile = sx16(m.u16((pSkillTxt + 0x48) >>> 0))
  if (wSrvMissile <= 0 || wSrvMissile >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 0
  const unit = pUnit >>> 0
  if (unit !== 0) {
    m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  const savedSp = k2W7B1StackPtr
  const sp = (savedSp - 0x10) >>> 0
  k2W7B1StackPtr = sp
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 0x04) >>> 0, 0)
    if (SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, unit, pGame >>> 0, sp, (sp + 0x04) >>> 0) === 0) {
      return 0
    }
    const unitX = UNIT_GetPosX113c(m, unit) | 0
    const dx = (i32(m, sp) - unitX) | 0
    const unitY = UNIT_GetPosY113c(m, unit) | 0
    const dy = (i32(m, (sp + 0x04) >>> 0) - unitY) | 0
    const pMissile =
      SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
        m,
        pGame >>> 0,
        wSrvMissile,
        unit,
        skillId,
        nSkillLevel | 0,
        0,
        0,
        0,
        0,
        0,
      ) >>> 0
    if (pMissile === 0) return 0
    MISSILE_SetTargetX113c(m, pMissile, (-dy) | 0)
    MISSILE_SetTargetY113c(m, pMissile, dx)
    return 1
  } finally {
    k2W7B1StackPtr = savedSp
  }
}

/**
 * [3/40] `SKILLS_SrvDo006_SpawnSubClassIndexedMissile_6FC2D530_113c`
 * @dll D2Game.dll
 * @va 0x6FC2D530
 * @ordinalOrName D2Game_6FC2D530
 */
export function SKILLS_SrvDo006_SpawnSubClassIndexedMissile_6FC2D530_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2D530)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  if (pDataTables === 0 || skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillTxt = (pSkillsTxtBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillTxt === 0) return 0
  const wSrvMissile = sx16(m.u16((pSkillTxt + 0x48) >>> 0))
  if (wSrvMissile <= 0 || wSrvMissile >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 0
  const unit = pUnit >>> 0
  let nMonsterId = -1
  if (unit !== 0) {
    m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
    nMonsterId = i32(m, (unit + 0x04) >>> 0)
  }
  const savedSp = k2W7B1StackPtr
  const sp = (savedSp - 0x08) >>> 0
  k2W7B1StackPtr = sp
  try {
    m.setU32(sp, skillId >>> 0)
    DATATBLS_GetMonsterChainInfo113c(m, nMonsterId, 0, sp)
    const subIdx = i32(m, sp)
    SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
      m,
      pGame >>> 0,
      (subIdx + wSrvMissile) | 0,
      unit,
      skillId,
      nSkillLevel | 0,
      0,
      0,
      0,
      0,
      0,
    )
    return 1
  } finally {
    k2W7B1StackPtr = savedSp
  }
}

/**
 * [4/40] `ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c`
 * @dll D2Game.dll
 * @va 0x6FC307E0
 * @ordinalOrName D2Game_6FC307E0
 */
export function ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pSourceItem: number,
  bCloneSockets: number,
): number {
  hitD2GameVa113c(0x6FC307E0)
  const game = pGame >>> 0
  const srcItem = pSourceItem >>> 0
  const pRoom = UNITS_GetRoom113c(m, srcItem) >>> 0
  const savedSp = k2W7B1StackPtr
  const sp = (savedSp - 0x440) >>> 0
  k2W7B1StackPtr = sp
  try {
    const pOutBytesRead = sp
    const pOutRejectReason = (sp + 0x08) >>> 0
    const pHeader = (sp + 0x10) >>> 0
    const pBuf = (sp + 0x34) >>> 0
    const nTotalBytes = ITEMS_SerializeItemToBuffer113c(m, srcItem, pBuf, 0x400, 1, 1, 0) | 0
    ITEMS_DecodeItemCompactBitstreamV96_113c(m, pBuf, nTotalBytes, 1, pHeader)
    m.setU32(pOutBytesRead, 0)
    const pNewItem =
      ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c(
        m,
        game,
        pHeader,
        pRoom,
        pBuf,
        nTotalBytes,
        1,
        pOutBytesRead,
        0x60,
      ) >>> 0
    if (pNewItem === 0) return 0
    const rootBytesRead = m.u32(pOutBytesRead) | 0
    let pCurStream = (pBuf + rootBytesRead) >>> 0
    let remBytes = (nTotalBytes - rootBytesRead) | 0
    ITEMS_SetOrClearCommandFlags113c(m, pNewItem, 0x80000, 1)
    ITEMS_SetOrClearCommandFlags113c(m, pNewItem, 0x2000, 0)
    if (bCloneSockets !== 0) {
      const nSocketCount = i32(m, (pHeader + 0x14) >>> 0)
      if (nSocketCount > 0) {
        for (let i = 0; i < nSocketCount; i = (i + 1) | 0) {
          ITEMS_DecodeItemCompactBitstreamV96_113c(m, pCurStream, remBytes, 1, pHeader)
          m.setU32(pOutBytesRead, 0)
          const pFiller =
            ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c(
              m,
              game,
              pHeader,
              0,
              pCurStream,
              remBytes,
              1,
              pOutBytesRead,
              0x60,
            ) >>> 0
          if (pFiller === 0) return 0
          const fillerBytes = m.u32(pOutBytesRead) | 0
          pCurStream = (pCurStream + fillerBytes) >>> 0
          remBytes = (remBytes - fillerBytes) | 0
          UNITS_ChangeAnimMode113c(m, pFiller, 4)
          m.setU32(pOutRejectReason, 0)
          const ok =
            ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c(
              m,
              m.u32((pFiller + 0x0c) >>> 0),
              game,
              pNewItem,
              m.u32((pNewItem + 0x0c) >>> 0),
              pOutRejectReason,
              0,
              1,
              0,
              0,
            ) | 0
          if (ok === 0) {
            throw new D2CommonAssertError('Items.cpp', 0xdb7)
          }
          ITEMS_SetOrClearCommandFlags113c(m, pFiller, 0x80000, 1)
          ITEMS_SetOrClearCommandFlags113c(m, pFiller, 0x2000, 0)
          ITEMS_SetItemFlag113c(m, pFiller, 1, 0)
        }
      }
    }
    ITEMS_SetOrClearCommandFlags113c(m, srcItem, 0x8000000, 1)
    ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c(m, game, pNewItem)
    ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c(m, game, pNewItem)
    ITEMS_ClearAllDupeAndCommandFlags_6FCBB340_113c(m, pNewItem)
    ITEMS_SetItemFlag113c(m, pNewItem, 1, 0)
    return pNewItem
  } finally {
    k2W7B1StackPtr = savedSp
  }
}

/**
 * [5/40] `AI_Think_Overlord_6FC37CB0_113c`
 * @dll D2Game.dll
 * @va 0x6FC37CB0
 * @ordinalOrName D2Game_6FC37CB0
 */
export function AI_Think_Overlord_6FC37CB0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FC37CB0)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const args = pAiTickArgs >>> 0
  const bInMeleeRange = i32(m, (args + 0x18) >>> 0)
  const pMonStatsTxt = m.u32((args + 0x1c) >>> 0) >>> 0
  const nTargetDist = i32(m, (args + 0x14) >>> 0)
  const pAiParam = m.u32(args) >>> 0
  const pTarget = m.u32((args + 0x08) >>> 0) >>> 0
  const pSeed = (unit + 0x20) >>> 0
  ACT5Q1_OnShenkSpottedPromoteState2_6FC7A690_113c(m, game, unit)
  let pAttacker = SUNIT_GetLastAttacker113c(m, game, unit) >>> 0
  if (pAttacker !== 0) {
    const attType = i32(m, pAttacker)
    if (attType === 0) {
      const attMode = i32(m, (pAttacker + 0x10) >>> 0)
      if (attMode === 0 || attMode === 0x11) {
        pAttacker = 0
      }
    } else if (attType === 1) {
      const attMode = i32(m, (pAttacker + 0x10) >>> 0)
      if (attMode === 0 || attMode === 0x0c) {
        pAttacker = 0
      } else if (SUNIT_AreUnitsHostileOrUnaligned113c(m, unit, pAttacker, game) === 0) {
        pAttacker = 0
      }
    } else {
      pAttacker = 0
    }
  }
  const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  if (wSkill0 >= 0 && unit !== 0 && i32(m, unit) === 1) {
    const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const aiState = i32(m, (pMonData + 0x54) >>> 0)
      if (
        (aiState === 3 || aiState === 0x13) &&
        i32(m, (game + 0xa8) >>> 0) > i32(m, (pAiParam + 0x14) >>> 0) &&
        pAttacker !== 0 &&
        MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c(m, unit, wSkill0) !== 0
      ) {
        AI_CastSkillWithMode113c(m, m.u8((pMonStatsTxt + 0x180) >>> 0), unit, game, wSkill0, pAttacker, 0, 0)
        const nDiff = m.u8((game + 0x6d) >>> 0)
        const cd = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0))
        m.setU32((pAiParam + 0x14) >>> 0, ((i32(m, (game + 0xa8) >>> 0) + cd) | 0) >>> 0)
        return
      }
    }
  }
  if (bInMeleeRange !== 0) {
    const rollAtk = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if ((rollAtk | 0) < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x74) >>> 0))) {
      const rollMode = (stepSeed64At113c(m, pSeed) >>> 0) % 100
      const nDiffM = m.u8((game + 0x6d) >>> 0)
      const useMode5 = (rollMode | 0) < sx16(m.u16((pMonStatsTxt + nDiffM * 2 + 0x7a) >>> 0))
      SKILLS_SetUsedSkillMemPort113c(m, unit, 0)
      const mode = useMode5 ? 5 : 4
      const savedModeSp = k2W7B1StackPtr
      const pModeChange = (savedModeSp - 0x20) >>> 0
      k2W7B1StackPtr = pModeChange
      try {
        for (let i = 0; i < 0x20; i += 4) {
          m.setU32((pModeChange + i) >>> 0, 0)
        }
        m.setU32(pModeChange, mode >>> 0)
        m.setU32((pModeChange + 0x04) >>> 0, unit)
        m.setU32((pModeChange + 0x08) >>> 0, pTarget)
        let bPathMode = 0x64
        if (unit !== 0) {
          const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, i32(m, (unit + 0x04) >>> 0)) >>> 0
          if (pMonStats2 !== 0) {
            const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
            const maskOff = useMode5 ? 0x14 : 0x10
            const bitMask = pMasks !== 0 ? m.u32((pMasks + maskOff) >>> 0) : 0
            if ((m.u8((pMonStats2 + 0x104) >>> 0) & bitMask) !== 0) {
              bPathMode = 0x65
            }
          }
        }
        m.setU8((pModeChange + 0x15) >>> 0, bPathMode)
        if (bPathMode === 0x65 && unit !== 0) {
          const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0
          if (pPath !== 0) PATH_SetType113c(m, pPath, 0x0d)
        }
        MONSTER_StartMode113c(m, game, unit, mode, pTarget, 0, 0)
      } finally {
        k2W7B1StackPtr = savedModeSp
      }
      return
    }
  }
  const savedSp = k2W7B1StackPtr
  const sp = (savedSp - 0x20) >>> 0
  k2W7B1StackPtr = sp
  let pScanTarget0C = 0
  let pScanTarget10 = 0
  let nScanFlag14 = 0
  try {
    m.setU32(sp, 0x240)
    m.setU32((sp + 0x04) >>> 0, 0x190)
    m.setU32((sp + 0x08) >>> 0, 0x32)
    m.setU32((sp + 0x0c) >>> 0, 0)
    m.setU32((sp + 0x10) >>> 0, 0)
    m.setU32((sp + 0x14) >>> 0, 0)
    registerAiTargetModeCallback113c(0x6fc35c40, AI_ScanOverlordMinionTargetsCallback_6FC35C40_113c)
    AITARGET_ScanUnitsByModeTable113c(m, 1, sp, game, unit, 0x6fc35c40)
    pScanTarget0C = m.u32((sp + 0x0c) >>> 0) >>> 0
    pScanTarget10 = m.u32((sp + 0x10) >>> 0) >>> 0
    nScanFlag14 = i32(m, (sp + 0x14) >>> 0)
  } finally {
    k2W7B1StackPtr = savedSp
  }
  const wSkill1 = sx16(m.u16((pMonStatsTxt + 0x172) >>> 0))
  if (wSkill1 >= 0 && pScanTarget0C !== 0) {
    const roll1 = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiff1 = m.u8((game + 0x6d) >>> 0)
    if (
      (roll1 | 0) < sx16(m.u16((pMonStatsTxt + nDiff1 * 2 + 0x5c) >>> 0)) &&
      MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c(m, unit, wSkill1) !== 0
    ) {
      AI_CastSkillWithMode113c(m, m.u8((pMonStatsTxt + 0x181) >>> 0), unit, game, wSkill1, pScanTarget0C, 0, 0)
      return
    }
  }
  const wSkill2 = sx16(m.u16((pMonStatsTxt + 0x174) >>> 0))
  if (wSkill2 !== 0 && pScanTarget10 !== 0) {
    const roll2 = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiff2 = m.u8((game + 0x6d) >>> 0)
    if (
      (roll2 | 0) < sx16(m.u16((pMonStatsTxt + nDiff2 * 2 + 0x62) >>> 0)) &&
      (UNIT_GetAlignment113c(m, unit) | 0) !== 2 &&
      MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c(m, unit, wSkill2) !== 0
    ) {
      AI_CastSkillWithMode113c(m, m.u8((pMonStatsTxt + 0x182) >>> 0), unit, game, wSkill2, pScanTarget10, 0, 0)
      return
    }
  }
  if (nScanFlag14 !== 0) {
    const nDiff = m.u8((game + 0x6d) >>> 0)
    const aip4 = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x68) >>> 0))
    const aip5 = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x6e) >>> 0))
    if (nTargetDist < ((aip4 - aip5) | 0)) {
      const fleeDist = (m.u8((pMonStatsTxt + nDiff * 2 + 0x68) >>> 0) - (nTargetDist & 0xff)) & 0xff
      aiFleeFrom6FD12D80(m, pTarget, game, unit, fleeDist, 0)
      return
    }
    if (nTargetDist > ((aip4 + aip5) | 0)) {
      aiApproachTarget6FD12540(m, game, unit, pTarget, 2, 0, 0, 1, 0)
      return
    }
    if ((rollSeedPtr113c(m, pSeed, 100) | 0) < 0x32) {
      AI_CircleStrafeTarget_6FD126B0_113c(m, unit, 0, game, pTarget, 5)
      return
    }
    AI_Stall113c(m, game, unit, 10)
    return
  }
  if (((stepSeed64At113c(m, pSeed) >>> 0) % 100) < 0x3c) {
    aiApproachTarget6FD12540(m, game, unit, pTarget, 2, 0, 0, 1, 0)
    return
  }
  AI_Stall113c(m, game, unit, 10)
}

/**
 * [6/40] `AI_Think_CainAndAnyaPrisonPortal_6FC3BF60_113c`
 * @dll D2Game.dll
 * @va 0x6FC3BF60
 * @ordinalOrName D2Game_6FC3BF60
 */
export function AI_Think_CainAndAnyaPrisonPortal_6FC3BF60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FC3BF60)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const bIsFrozenAnya = unit !== 0 && i32(m, (unit + 0x04) >>> 0) === 0x20f ? 1 : 0
  if (AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c(m, unit, game) !== 0) {
    return
  }
  if (bIsFrozenAnya !== 0) {
    ACT5Q3_OnFrozenRiverEnteredPromoteState2_6FC79F80_113c(m, game)
  }
  let pInteractHead = 0
  if (unit !== 0 && i32(m, unit) === 1) {
    const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pInteractHead = m.u32((pMonData + 0x30) >>> 0) >>> 0
    }
  }
  let pInteractNode = pInteractHead !== 0 ? (m.u32(pInteractHead) >>> 0) : 0
  while (pInteractNode !== 0) {
    if (m.u32(pInteractNode) !== 0) {
      AI_Stall113c(m, game, unit, 0x28)
      return
    }
    pInteractNode = m.u32((pInteractNode + 0x08) >>> 0) >>> 0
  }
  let pCmd3 = 0
  if (unit !== 0 && i32(m, unit) === 1) {
    const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
      if (pAiGen !== 0) {
        const pCmdHead = m.u32((pAiGen + 0x20) >>> 0) >>> 0
        if (pCmdHead !== 0) {
          let pCur = m.u32(pCmdHead) >>> 0
          if (i32(m, (pCur + 0x08) >>> 0) !== 3) {
            while (pCur !== pCmdHead) {
              pCur = m.u32(pCur) >>> 0
              if (i32(m, (pCur + 0x08) >>> 0) === 3) break
            }
          }
          if (i32(m, (pCur + 0x08) >>> 0) === 3) {
            pCmd3 = pCur
          }
        }
      }
    }
  }
  if (unit !== 0 && i32(m, (unit + 0x10) >>> 0) === 0x0c) {
    return
  }
  AI_WarrivGreetMem113c(m, game, unit, pAiTickArgs >>> 0)
  if (pCmd3 === 0) {
    AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c(m, unit, game)
    AI_Stall113c(m, game, unit, 0x28)
    return
  }
  const cmdState = i32(m, (pCmd3 + 0x14) >>> 0)
  if (cmdState >= 2) {
    const nextState = (cmdState + 1) | 0
    m.setU32((pCmd3 + 0x14) >>> 0, nextState >>> 0)
    const savedSp = k2W7B1StackPtr
    const sp = (savedSp - 0x10) >>> 0
    k2W7B1StackPtr = sp
    try {
      m.setU32(sp, 0)
      m.setU32((sp + 0x04) >>> 0, 0)
      const ok =
        bIsFrozenAnya !== 0
          ? ACT5Q3_GetPortalTargetCoords_6FC76A40_113c(m, game, unit, sp)
          : ACT1Q4_GetTristramPortalTargetCoords_6FC80450_113c(m, game, unit, sp)
      if (ok === 0) {
        AI_Stall113c(m, game, unit, 0x14)
        return
      }
      if (i32(m, (pCmd3 + 0x14) >>> 0) < 8) {
        const tx = i32(m, sp)
        const ty = i32(m, (sp + 0x04) >>> 0)
        const dist = UNITS_GetOctileDistanceToCoordinates113c(m, unit, tx, ty) >>> 0
        if (dist > 0) {
          aiApproachTarget6FD12540(m, game, unit, 0, 2, tx, ty, 1, 0)
          return
        }
      }
      if (bIsFrozenAnya !== 0) {
        ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c(m, game)
      } else {
        ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c(m, game)
      }
      STATLIST_SetUnitStat113c(m, unit, 6, 0, 0)
      const curY = UNIT_GetPosY113c(m, unit) | 0
      const curX = UNIT_GetPosX113c(m, unit) | 0
      AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(m, unit, 0x0c, game, curX, curY)
      return
    } finally {
      k2W7B1StackPtr = savedSp
    }
  }
  const destX = i32(m, (pCmd3 + 0x0c) >>> 0)
  const destY = i32(m, (pCmd3 + 0x10) >>> 0)
  const distToDest = UNITS_GetOctileDistanceToCoordinates113c(m, unit, destX, destY) | 0
  if (distToDest > 1) {
    const tries = i32(m, (pCmd3 + 0x18) >>> 0)
    if (tries <= 5) {
      m.setU32((pCmd3 + 0x18) >>> 0, ((tries + 1) | 0) >>> 0)
      if (bIsFrozenAnya !== 0 && ACT5Q3_IsFrozenAnyaUnspawned_6FC76950_113c(m, game) !== 0) {
        AI_Stall113c(m, game, unit, 0x14)
        m.setU32((pCmd3 + 0x18) >>> 0, 0)
        return
      }
      aiApproachTarget6FD12540(m, game, unit, 0, 2, destX, destY, 1, 0)
      return
    }
  }
  if (i32(m, (pCmd3 + 0x14) >>> 0) === 1) {
    const portalOk =
      bIsFrozenAnya !== 0
        ? ACT5Q3_EnsureAnyaTownPortalSpawned_6FC77CB0_113c(m, game, unit)
        : ACT1Q4_SpawnTristramPortalObject_6FC81340_113c(m, game, unit)
    if (portalOk === 0) {
      m.setU32((pCmd3 + 0x14) >>> 0, 1)
      m.setU32((pCmd3 + 0x18) >>> 0, 1)
      AI_Stall113c(m, game, unit, 0x14)
      return
    }
    m.setU32((pCmd3 + 0x14) >>> 0, 2)
  }
  AI_Stall113c(m, game, unit, 0x14)
}

/**
 * [7/40] `MONSTER_OnDeathSuicideMinionExplosion_6FC457D0_113c`
 * @dll D2Game.dll
 * @va 0x6FC457D0
 * @ordinalOrName D2Game_6FC457D0
 */
export function MONSTER_OnDeathSuicideMinionExplosion_6FC457D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _arg0 = 0,
  _arg1 = 0,
): void {
  hitD2GameVa113c(0x6FC457D0)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  let pMonStatsTxt = 0
  if (unit !== 0) {
    const classId = i32(m, (unit + 0x04) >>> 0)
    if (classId >= 0) {
      const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
      if (pDataTables !== 0 && classId < i32(m, (pDataTables + 0xa80) >>> 0)) {
        const pMonStatsBase = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
        pMonStatsTxt = (pMonStatsBase + imul32(classId, 0x1a8)) >>> 0
      }
    }
  }
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const elemType = pMonStatsTxt !== 0 ? sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0)) : 0
  const nGameType = m.u8((game + 0x6a) >>> 0) !== 0 || m.u32((game + 0x74) >>> 0) !== 0 ? 1 : 0
  const savedSp = k2W7B1StackPtr
  const sp = (savedSp - 0xb0) >>> 0
  k2W7B1StackPtr = sp
  try {
    const pCalcStats = sp
    const pDmg = (sp + 0x38) >>> 0
    m.fill(pCalcStats, 0x38, 0)
    const monId = unit !== 0 ? i32(m, (unit + 0x04) >>> 0) : -1
    const nLevel = STATLIST_GetUnitStat113c(m, unit, 0x0c, 0) | 0
    DATATBLS_CalculateMonsterStatsByLevel113c(m, monId, nGameType, nDiff, nLevel, 8, pCalcStats)
    const minDmg = i32(m, (pCalcStats + 0x14) >>> 0)
    const maxDmg = i32(m, (pCalcStats + 0x18) >>> 0)
    const range = (maxDmg - minDmg) | 0
    let roll = 0
    if (range > 0) {
      const nextLo = stepSeed64At113c(m, (unit + 0x20) >>> 0) >>> 0
      if (((range - 1) & range) === 0) {
        roll = (nextLo & (range - 1)) | 0
      } else {
        roll = (nextLo % (range >>> 0)) | 0
      }
    }
    const scaledDmg = (((roll + minDmg) | 0) << 8) >>> 0
    m.fill(pDmg, 0x70, 0)
    m.setU8((pDmg + 0x04) >>> 0, (m.u8((pDmg + 0x04) >>> 0) | 8) & 0xff)
    m.setU32((pDmg + 0x08) >>> 0, scaledDmg)
    let missileId = 0x1aa
    let posY = 0
    let posX = 0
    if (elemType === 1) {
      m.setU32((pDmg + 0x10) >>> 0, scaledDmg)
      posY = readUnitPosYInline113c(m, unit)
      posX = readUnitPosXInline113c(m, unit)
      missileId = 0x1ab
    } else if (elemType >= 2) {
      m.setU32((pDmg + 0x30) >>> 0, elemType >>> 0)
      m.setU32((pDmg + 0x24) >>> 0, scaledDmg)
      posY = readUnitPosYInline113c(m, unit)
      posX = readUnitPosXInline113c(m, unit)
      missileId = 0x1ac
    } else {
      posY = readUnitPosYInline113c(m, unit)
      posX = readUnitPosXInline113c(m, unit)
    }
    const pMissile =
      SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
        m,
        game,
        missileId,
        unit,
        0,
        1,
        0,
        0,
        posX,
        posY,
        1,
      ) >>> 0
    const splashX = readUnitPosXInline113c(m, unit)
    const splashY = readUnitPosYInline113c(m, unit)
    if (pMissile !== 0) {
      const nDiffSplash = m.u8((game + 0x6d) >>> 0)
      const radius = sx16(m.u16((pMonStatsTxt + nDiffSplash * 2 + 0x68) >>> 0))
      SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c(
        m,
        game,
        pMissile,
        splashX,
        splashY,
        radius,
        pDmg,
        0,
        0,
        0,
        0x581,
      )
    }
  } finally {
    k2W7B1StackPtr = savedSp
  }
}

/**
 * [8/40] `MISSILE_SplitForkedProjectilesOnTarget_6FC45AD0_113c`
 * @dll D2Game.dll
 * @va 0x6FC45AD0
 * @ordinalOrName D2Game_6FC45AD0
 */
export function MISSILE_SplitForkedProjectilesOnTarget_6FC45AD0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pHitTarget: number,
  bAllowSplit: number,
): void {
  hitD2GameVa113c(0x6FC45AD0)
  const game = pGame >>> 0
  const missile = pMissile >>> 0
  if (bAllowSplit === 0 || missile === 0 || i32(m, missile) !== 3) return
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) === 0) return
  const missileId = i32(m, (missile + 0x04) >>> 0)
  const pOwner =
    SUNIT_GetServerUnit113c(
      m,
      game,
      i32(m, (missile + 0x94) >>> 0),
      m.u32((missile + 0x98) >>> 0),
    ) >>> 0
  if (pOwner === 0 || missileId < 0) return
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  if (pDataTables === 0 || missileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  const pMissileTxt = (pMissilesBase + imul32(missileId, 0x1a4)) >>> 0
  if (pMissileTxt === 0) return
  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  if (pBitMasks !== 0 && (m.u8((pMissileTxt + 0x05) >>> 0) & m.u8((pBitMasks + 0x10) >>> 0)) !== 0) {
    return
  }
  if (MONSTER_CheckTypeFlagsMask113c(m, pOwner, 0x80) !== 0) return
  const pPath = m.u32((missile + 0x2c) >>> 0) >>> 0
  const pTargetUnit = SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c(m, pOwner, game) >>> 0
  let targetX = 0
  let targetY = 0
  if (pTargetUnit === 0) {
    targetX = PATH_GetFirstPointX113c(m, pPath) | 0
    targetY = PATH_GetFirstPointY113c(m, pPath) | 0
  } else {
    targetX = UNIT_GetPosX113c(m, pTargetUnit) | 0
    targetY = UNIT_GetPosY113c(m, pTargetUnit) | 0
  }
  const savedSp = k2W7B1StackPtr
  const sp = (savedSp - 0x10) >>> 0
  k2W7B1StackPtr = sp
  try {
    SEED_InitSeed113c(m, sp)
    SEED_InitLowSeed113c(m, sp, 0x53454953)
    m.setU32((sp + 0x04) >>> 0, m.u32((pOwner + 0x0c) >>> 0))
    const dx = (UNIT_GetPosX113c(m, pOwner) - targetX) | 0
    const dy = (UNIT_GetPosY113c(m, pOwner) - targetY) | 0
    let signX = dx < 0 ? -1 : dx > 0 ? 1 : 0
    let signY = dy < 0 ? -1 : dy > 0 ? 1 : 0
    if (missileId >= 0x3f && missileId <= 0x42) {
      signY = 0
      signX = 0
    }
    if (i32(m, pOwner) === 1) {
      const pMonData = m.u32((pOwner + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        m.setU8((pMonData + 0x16) >>> 0, (m.u8((pMonData + 0x16) >>> 0) | 0x80) & 0xff)
      }
    }
    const lvl1 = MISSILE_GetLevel113c(m, missile) | 0
    const sk1 = MISSILE_GetSkill113c(m, missile) | 0
    SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
      m,
      game,
      missileId,
      pOwner,
      sk1,
      lvl1,
      0,
      0,
      (targetX - signY) | 0,
      (targetY + signX) | 0,
      0,
    )
    const lvl2 = MISSILE_GetLevel113c(m, missile) | 0
    const sk2 = MISSILE_GetSkill113c(m, missile) | 0
    SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
      m,
      game,
      missileId,
      pOwner,
      sk2,
      lvl2,
      0,
      0,
      (targetX + signY) | 0,
      (targetY - signX) | 0,
      0,
    )
    if (i32(m, pOwner) === 1) {
      const pMonData = m.u32((pOwner + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        m.setU8((pMonData + 0x16) >>> 0, (m.u8((pMonData + 0x16) >>> 0) & 0x7f) & 0xff)
      }
    }
  } finally {
    k2W7B1StackPtr = savedSp
  }
}

/**
 * [9/40] `MONSTER_OnDeathBossSpecialEffect_6FC45E60_113c`
 * @dll D2Game.dll
 * @va 0x6FC45E60
 * @ordinalOrName D2Game_6FC45E60
 */
export function MONSTER_OnDeathBossSpecialEffect_6FC45E60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _arg0 = 0,
  _arg1 = 0,
): void {
  hitD2GameVa113c(0x6FC45E60)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const classId = unit !== 0 ? i32(m, (unit + 0x04) >>> 0) : -1
  if (classId <= 0x10b) {
    if (classId === 0x10b) {
      if (i32(m, (unit + 0x10) >>> 0) === 0) {
        QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c(m, game, unit, 0x23, 0x19, 0x7d, 1)
      }
      return
    }
    switch (classId) {
      case 0x9c:
        if (i32(m, (unit + 0x10) >>> 0) === 0) {
          QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c(m, game, unit, 0x23, 1, 0x33, 0)
        }
        return
      case 0xe5:
        if (i32(m, (unit + 0x10) >>> 0) === 0) {
          ACT3Q5_CorruptMonstersAndFireCompellingOrbProjectile_6FD0A930_113c(m, unit, game)
        }
        return
      case 0xf2:
        if (i32(m, (unit + 0x10) >>> 0) === 0) {
          QUESTS_SpawnProjectile12B_6FD0AB10_113c(m, unit, game)
        }
        return
      case 0x100:
        if (i32(m, (unit + 0x10) >>> 0) === 0) {
          QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c(m, game, unit, 0x69, 1, 2, 0)
        }
        return
      default:
        return
    }
  }
  switch (classId) {
    case 0x1df:
      if (unit === 0 || i32(m, (unit + 0x10) >>> 0) === 0) {
        QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c(m, game, unit, 0x23, 0x19, 0x7d, 0)
      }
      return
    case 0x2c0:
    case 0x2c1:
    case 0x2c5:
      if (unit === 0 || i32(m, (unit + 0x10) >>> 0) === 0) {
        QUESTS_OnUberTristramBossKilledDropTorchAndStandards_6FD0AA30_113c(m, game, unit)
      }
      return
    default:
      return
  }
}

/**
 * [10/40] `MONSTER_OnDeathSpawnPoisonCloud_6FC46230_113c`
 * @dll D2Game.dll
 * @va 0x6FC46230
 * @ordinalOrName D2Game_6FC46230
 */
export function MONSTER_OnDeathSpawnPoisonCloud_6FC46230_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _arg0 = 0,
  _arg1 = 0,
): void {
  hitD2GameVa113c(0x6FC46230)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  let lvl = STATLIST_GetUnitStat113c(m, unit, 0x0c, 0) | 0
  if (lvl <= 1) {
    lvl = 1
  }
  const posY = readUnitPosYInline113c(m, unit)
  const posX = readUnitPosXInline113c(m, unit)
  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
    m,
    game,
    0x9b,
    unit,
    0,
    lvl,
    0,
    0,
    posX,
    posY,
    1,
  )
}

function i16(m: D2KernMemory113c, addr: number): number {
  return sx16(m.u16(addr >>> 0))
}
function EVENT_SetEvent113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  type: number,
  frame: number,
  arg14: number,
  arg18: number,
): number {
  return EVENT_SetEventFull113c(m, pGame, pUnit, type, frame, 0, arg14, arg18)
}
function EVENT_FreeEventQueueNodesByType_6FC35570_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  evType: number,
  _arg: number,
): void {
  if (pUnit === 0) return
  let cur = m.u32((pUnit + 0xdc) >>> 0)
  while (cur !== 0) {
    const next = m.u32((cur + 0x24) >>> 0)
    if (m.u8(cur) === (evType & 0xff)) {
      EVENT_FreeNode113c(m, pGame, cur)
    }
    cur = next
  }
}
function SUNIT_UpdateUnitOverlayNode_6FCAE6F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pNode: number,
  _pUnit: number,
): void {
  EVENT_FreeNode113c(m, pGame, pNode)
}
function AURA_ForEachHostileTargetInRadius_6FCC0C70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pCenterUnit: number,
  nX: number,
  nY: number,
  nRadius: number,
  dwFilterFlags: number,
  pfnCallback: number,
  pCallbackArg: number,
  bSkipMonFlag1B: number,
): void {
  AURA_ForEachUnitInRadius113c(
    m,
    pGame,
    pCenterUnit,
    nX,
    nY,
    nRadius,
    dwFilterFlags,
    pfnCallback,
    pCallbackArg,
    bSkipMonFlag1B,
    (mm, pAuraCtx, pTarget) => AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c(mm, pAuraCtx, pTarget),
  )
}
function FOG_GetErrorLocation113c(_m: D2KernMemory113c, line: number): number {
  return line | 0
}
function FOG_DisplayAssert113c(_m: D2KernMemory113c, _msgPtr: number, _loc: number): void {}
function msvc_exit113c(_m: D2KernMemory113c, code: number): never {
  throw new D2CommonAssertError("exit " + code)
}
function user32_wsprintfA113c(
  m: D2KernMemory113c,
  pBuf: number,
  pFmt: number,
  nVal: number,
): number {
  const dst = pBuf >>> 0
  for (let i = 0; i < 0x100; i += 4) {
    m.setU32((dst + i) >>> 0, 0)
  }
  const fmtAddr = pFmt >>> 0
  let fmt = ''
  if (fmtAddr !== 0) {
    try {
      for (let i = 0; i < 128; i += 1) {
        const ch = m.u8((fmtAddr + i) >>> 0)
        if (ch === 0) break
        fmt += String.fromCharCode(ch)
      }
    } catch {
      fmt = ''
    }
  }
  if (fmt.length === 0 && fmtAddr === 0x6fd1cc2c) {
    fmt = 'changing state to %d\n'
  }
  const out = fmt.replace('%d', String(nVal | 0))
  const len = out.length < 255 ? out.length : 255
  for (let i = 0; i < len; i += 1) {
    m.setU8((dst + i) >>> 0, out.charCodeAt(i) & 0xff)
  }
  m.setU8((dst + len) >>> 0, 0)
  return len
}
function QUESTS_DebugOutput_6FCEBE70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pBuf: number,
  nColor: number,
): void {
  NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, pBuf, pGame, nColor)
}
function SUNIT_GetUnitPosX_6FC21100_113c(...args: Parameters<typeof UNIT_GetPosX113c>): ReturnType<typeof UNIT_GetPosX113c> {
  return UNIT_GetPosX113c(...args)
}
function SUNIT_GetUnitPosY_6FC21130_113c(...args: Parameters<typeof UNIT_GetPosY113c>): ReturnType<typeof UNIT_GetPosY113c> {
  return UNIT_GetPosY113c(...args)
}
function MISSILE_SetTotalFrames113c(...args: Parameters<typeof MISSILE_SetTargetX113c>): ReturnType<typeof MISSILE_SetTargetX113c> {
  return MISSILE_SetTargetX113c(...args)
}
function SKILLS_GetParam04113c(...args: Parameters<typeof SKILLS_GetParam1113c>): ReturnType<typeof SKILLS_GetParam1113c> {
  return SKILLS_GetParam1113c(...args)
}
function SKILLS_SetParam04113c(...args: Parameters<typeof SKILLS_SetParam1113c>): ReturnType<typeof SKILLS_SetParam1113c> {
  return SKILLS_SetParam1113c(...args)
}
function SKILLS_GetParam08113c(...args: Parameters<typeof SKILLS_GetParam2113c>): ReturnType<typeof SKILLS_GetParam2113c> {
  return SKILLS_GetParam2113c(...args)
}
function SKILLS_SetParam08113c(...args: Parameters<typeof SKILLS_SetParam2113c>): ReturnType<typeof SKILLS_SetParam2113c> {
  return SKILLS_SetParam2113c(...args)
}
function SKILLS_GetParam0C113c(...args: Parameters<typeof SKILLS_GetParam3113c>): ReturnType<typeof SKILLS_GetParam3113c> {
  return SKILLS_GetParam3113c(...args)
}
function SKILLS_LookupSkillPetTypeIndex_6FC21EF0_113c(...args: Parameters<typeof SKILLS_GetParam7Fast_6FC21EF0_113c>): ReturnType<typeof SKILLS_GetParam7Fast_6FC21EF0_113c> {
  return SKILLS_GetParam7Fast_6FC21EF0_113c(...args)
}
function PETS_FindOwnedUnitBySubIndex_6FCC0F40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _zero: number,
  dwExtraFlags: number,
  nSearchRadius: number,
  nRingBandRadius: number,
  pOutCount: number,
  _zero2: number,
): number {
  return SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c(
    m,
    dwExtraFlags,
    nSearchRadius,
    nRingBandRadius,
    pOutCount,
    0,
    pGame,
    pUnit,
    0,
  )
}
function SKILLS_SpawnPetFromObjectOrCorpse_6FC62510_113c(
  ...args: Parameters<typeof SKILLS_SpawnProjectileAtTargetUnitIfBothOutsideTown_6FC62510_113c>
): ReturnType<typeof SKILLS_SpawnProjectileAtTargetUnitIfBothOutsideTown_6FC62510_113c> {
  return SKILLS_SpawnProjectileAtTargetUnitIfBothOutsideTown_6FC62510_113c(...args)
}
function SUNIT_VerifyAndDeleteUnit_6FD020A0_113c(...args: Parameters<typeof SUNIT_FreeUnit113c>): ReturnType<typeof SUNIT_FreeUnit113c> {
  return SUNIT_FreeUnit113c(...args)
}
function AURA_ApplyTimerStatListWithSkillAndState_6FCC00B0_113c(...args: Parameters<typeof STATES_CreateOrUpdateAuraStatList113c>): ReturnType<typeof STATES_CreateOrUpdateAuraStatList113c> {
  return STATES_CreateOrUpdateAuraStatList113c(...args)
}
function STATLIST_SetStatIfListIsValid113c(...args: Parameters<typeof STATLIST_SetStat113c>): ReturnType<typeof STATLIST_SetStat113c> {
  return STATLIST_SetStat113c(...args)
}
function SKILLS_SpawnMissileAtSkillTargetPos_6FC641C0_113c(
  ...args: Parameters<typeof SKILLS_SpawnChannelingProjectileAndAdvanceTick_6FC641C0_113c>
): ReturnType<typeof SKILLS_SpawnChannelingProjectileAndAdvanceTick_6FC641C0_113c> {
  return SKILLS_SpawnChannelingProjectileAndAdvanceTick_6FC641C0_113c(...args)
}
function UNITS_GetCurrentSkill113c(...args: Parameters<typeof SKILLS_GetUsedSkillMemPort113c>): ReturnType<typeof SKILLS_GetUsedSkillMemPort113c> {
  return SKILLS_GetUsedSkillMemPort113c(...args)
}
function STATLIST_GetStatListFromUnitAndState113c(...args: Parameters<typeof STATLIST_GetStatListFromUnitAndStateMemPort113c>): ReturnType<typeof STATLIST_GetStatListFromUnitAndStateMemPort113c> {
  return STATLIST_GetStatListFromUnitAndStateMemPort113c(...args)
}
function STATLIST_AllocStatList113c(
  m: D2KernMemory113c,
  _pMemPool: number,
  flags: number,
  expireFrame: number,
  unitType: number,
  unitId: number,
): number {
  return STATLIST_AllocList113c(m, flags, unitType, unitId, 0, expireFrame)
}
function STATLIST_SetStatRemoveCallback113c(
  m: D2KernMemory113c,
  pStatList: number,
  pfOnRemove: number,
): void {
  if (pfOnRemove === 0x6fc62290 && pStatList === 0) {
    SKILLS_StatListExpireClearState_6FC62290_113c(m, 0, 0, 0)
  }
  STATLIST_SetStatRemoveProc113c(m, pStatList, pfOnRemove)
}
function STATES_ToggleState113c(...args: Parameters<typeof STATES_ToggleGfxStateFlag113c>): ReturnType<typeof STATES_ToggleGfxStateFlag113c> {
  return STATES_ToggleGfxStateFlag113c(...args)
}
function SUNIT_AdvancePathAndBroadcast_6FD02480_113c(
  ...args: Parameters<typeof SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c>
): ReturnType<typeof SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c> {
  return SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c(...args)
}
function D2Common_10476_SetStatListExpireFrame113c(...args: Parameters<typeof STATLIST_SetExpireFrameEx113c>): ReturnType<typeof STATLIST_SetExpireFrameEx113c> {
  return STATLIST_SetExpireFrameEx113c(...args)
}
function SKILLS_GetTargetOrPathPosition_6FCBFA30_113c(
  ...args: Parameters<typeof SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c>
): ReturnType<typeof SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c> {
  return SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(...args)
}
function MISSILE_InitAndSpawnCustom_6FC8F930_113c(
  m: D2KernMemory113c,
  pGame: number,
  pParams: number,
): number {
  return MISSILE_CreateServerProjectile113c(m, pGame, pParams, {
    missileInitCallback: (mm, fnVa, pMis, dwParam) => {
      const va = fnVa >>> 0
      if (va === 0x6fc61f50) {
        MISSILES_InitChargedBoltPath_6FC61F50_113c(mm, pMis, dwParam)
      } else if (va === 0x6fc6c190) {
        SKILLS_AddDamagePercentStat_6FC6C190_113c(mm, pMis, dwParam)
      }
    },
  })
}
function SKILLS_GetBowOrCrossbowMissileId_6FCB1340_113c(...args: Parameters<typeof SKILLS_ResolveChargedSrvMissileId113c>): ReturnType<typeof SKILLS_ResolveChargedSrvMissileId113c> {
  return SKILLS_ResolveChargedSrvMissileId113c(...args)
}
function EVENT_CancelSkillEventsByTypeAndId_6FCAE900_113c(...args: Parameters<typeof EVENT_DeleteEventByArg14_113c>): ReturnType<typeof EVENT_DeleteEventByArg14_113c> {
  return EVENT_DeleteEventByArg14_113c(...args)
}
function DUNGEON_IsRoomInTown113c(...args: Parameters<typeof DUNGEON_CheckRoomIsTownMemPort113c>): ReturnType<typeof DUNGEON_CheckRoomIsTownMemPort113c> {
  return DUNGEON_CheckRoomIsTownMemPort113c(...args)
}
function D2Common_10474_UnlinkStatListFromUnit113c(...args: Parameters<typeof STATLIST_UnlinkSubList113c>): ReturnType<typeof STATLIST_UnlinkSubList113c> {
  return STATLIST_UnlinkSubList113c(...args)
}
function STATLIST_FreeStatListEx113c(...args: Parameters<typeof STATLIST_FreeStatListIfNonExtended113c>): ReturnType<typeof STATLIST_FreeStatListIfNonExtended113c> {
  return STATLIST_FreeStatListIfNonExtended113c(...args)
}
function SKILLS_GetPerDelay113c(...args: Parameters<typeof SKILLS_GetParam4Fast_6FC21C20_113c>): ReturnType<typeof SKILLS_GetParam4Fast_6FC21C20_113c> {
  return SKILLS_GetParam4Fast_6FC21C20_113c(...args)
}
function SKILLS_SetupPhysicalSkillDamage_6FCBF1A0_113c(...args: Parameters<typeof SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c>): ReturnType<typeof SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c> {
  return SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c(...args)
}
function SKILLS_FillElementalDamageStrc_6FCBF210_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nSkillId: number,
  pDmg: number,
  nSkillLevel: number,
): number {
  return SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, nSkillId, pUnit, pDmg, nSkillLevel)
}
function AURA_ApplyRadialDamageToEnemies_6FCC1240_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pDmg: number,
  dwFilterFlags: number,
  nX: number,
  nY: number,
  radius: number,
): number {
  return AURAS_ApplyRadialDamageWithDefaultFilter_6FCC1240_113c(
    m,
    dwFilterFlags,
    pUnit,
    pDmg,
    pGame,
    nX,
    nY,
    radius,
  )
}
function SKILLS_FindBlessedHammerSpawnCoords_6FC671E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  pCoordNode: number,
  nClassId: number,
  pFormation: number,
  pOutX: number,
  pOutY: number,
): number {
  if (pFormation === 0) return 0
  return REGPOP_SpawnMonsterFormation_6FC671E0_113c(
    m,
    pGame,
    pRoom,
    pCoordNode,
    nClassId,
    pFormation,
    pOutX,
    pOutY,
  )
}
function ACT1Q4_IsCainInTristram_6FC57680_113c(...args: Parameters<typeof PLAYER_IsBusyWithCursorOrNpcInteract113c>): ReturnType<typeof PLAYER_IsBusyWithCursorOrNpcInteract113c> {
  return PLAYER_IsBusyWithCursorOrNpcInteract113c(...args)
}
function MONSTERS_GetNpcVendorIndex_6FC215D0_113c(...args: Parameters<typeof MONSTATS_CheckFlagBit113c>): ReturnType<typeof MONSTATS_CheckFlagBit113c> {
  return MONSTATS_CheckFlagBit113c(...args)
}
function QUESTS_Act2JerhynCheckPalaceBlocked_6FC80390_113c(
  m: D2KernMemory113c,
  pGame: number,
  _pUnit: number,
  _pInteractUnit: number,
): number {
  return ACT1Q4_IsCainSavedFlag93Set_6FC80390_113c(m, pGame)
}
function FOG_AllocServerMemory113c(
  _m: D2KernMemory113c,
  _pMemPool: number,
  nSize: number,
  _szFile: number,
  _nLine: number,
  _nZero: number,
): number {
  const ptr = (k2W7B1StackPtr - ((nSize + 15) & ~15)) >>> 0
  k2W7B1StackPtr = ptr
  return ptr
}
function PLRINTRO_GetNpcIntroQuestFlag_6FC69A80_113c(
  m: D2KernMemory113c,
  pClient: number,
  _pGame: number,
  _classId: number,
  _pClient2 = 0,
): number {
  return CLIENTS_GetClientGame_6FC69A80_113c(m, pClient)
}
function MONSTER_SetNpcIntroFlag_6FCDD330_113c(
  m: D2KernMemory113c,
  pInteractUnit: number,
  pGame: number,
): void {
  NPC_SendHirelingListPacketsToClient_6FCDD330_113c(m, pInteractUnit, pGame, 0)
}
function UNIT_SetInteractUnit_6FCFFAE0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  dwType: number,
  dwId: number,
): void {
  SUNIT_SetLastKillerInfo_6FCFFAE0_113c(m, pUnit, dwType, dwId)
}
function ITEMS_GetInventory2113c(...args: Parameters<typeof TEXT_AllocTextList113c>): ReturnType<typeof TEXT_AllocTextList113c> {
  return TEXT_AllocTextList113c(...args)
}
function QUESTS_OnNpcInteract_6FC54660_113c(...args: Parameters<typeof QUESTS_TriggerCallback00_6FC54660_113c>): ReturnType<typeof QUESTS_TriggerCallback00_6FC54660_113c> {
  return QUESTS_TriggerCallback00_6FC54660_113c(...args)
}
function ITEMS_SerializeInventoryPacket113c(...args: Parameters<typeof TEXT_BuildMessageList113c>): ReturnType<typeof TEXT_BuildMessageList113c> {
  return TEXT_BuildMessageList113c(...args)
}
function D2GS_SendPacket27_NpcQuestInfo_6FCAB3D0_113c(...args: Parameters<typeof NET_SendPacketBuffer40B_6FCAB3D0_113c>): ReturnType<typeof NET_SendPacketBuffer40B_6FCAB3D0_113c> {
  return NET_SendPacketBuffer40B_6FCAB3D0_113c(...args)
}
function ITEMS_FreeInventory113c(...args: Parameters<typeof TEXT_FreeTextList113c>): ReturnType<typeof TEXT_FreeTextList113c> {
  return TEXT_FreeTextList113c(...args)
}
function QUESTS_CheckFirstNpcIntro_6FC55030_113c(
  m: D2KernMemory113c,
  pGame: number,
  _pInteractUnit: number,
  pClient: number,
): void {
  QUESTS_SendGameQuestStatePacket29_6FC55030_113c(m, pGame, pClient)
}
function QUESTS_ShouldDisableNpcGamble_6FC21020_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  _bFlag: number,
): number {
  return PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pUnit, pGame)
}
function NET_SendPacketToClient9Bytes_6FCAAD40_113c(
  m: D2KernMemory113c,
  bPacketId: number,
  bByte1: number,
  npcId: number,
  pClient: number,
  pQuestData: number,
): number {
  return NET_SendPacket103B_QuestRecord_6FCAAD40_113c(
    m,
    bPacketId,
    bByte1,
    npcId,
    pClient,
    pQuestData,
    0,
  )
}
function INVENTORY_GetShieldItem_6FC572C0_113c(...args: Parameters<typeof PLAYER_GetEquippedWeapon113c>): ReturnType<typeof PLAYER_GetEquippedWeapon113c> {
  return PLAYER_GetEquippedWeapon113c(...args)
}
function ITEMS_CheckIfShield113c(...args: Parameters<typeof ITEMS_CanItemLoseDurability113c>): ReturnType<typeof ITEMS_CanItemLoseDurability113c> {
  return ITEMS_CanItemLoseDurability113c(...args)
}
function PALADIN_AddShieldSmiteDamage_6FC6C9E0_113c(
  m: D2KernMemory113c,
  pShield: number,
  pUnit: number,
  minBonus: number,
  pGame: number,
  maxBonus: number,
): void {
  ITEMS_RollAndApplyWeaponDurabilityOrQuantityLoss_6FC6C9E0_113c(
    m,
    minBonus,
    pUnit,
    pShield,
    pGame,
    maxBonus,
  )
}
function SUNITDMG_ExecuteEventsAndApplyDamage_6FCFDDE0_113c(...args: Parameters<typeof SUNITDMG_AllocCombat113c>): ReturnType<typeof SUNITDMG_AllocCombat113c> {
  return SUNITDMG_AllocCombat113c(...args)
}
function UNITS_GetAnimOrSeqFrame113c(...args: Parameters<typeof UNITS_GetEquippedWeaponAdder113c>): ReturnType<typeof UNITS_GetEquippedWeaponAdder113c> {
  return UNITS_GetEquippedWeaponAdder113c(...args)
}
function UNITS_IsUnitInRoomAndValid113c(...args: Parameters<typeof UNITS_CanUnitMeleeAttackTarget113c>): ReturnType<typeof UNITS_CanUnitMeleeAttackTarget113c> {
  return UNITS_CanUnitMeleeAttackTarget113c(...args)
}
function SKILLS_GetAnimActionFrame_6FC21BC0_113c(...args: Parameters<typeof SKILLS_GetParam2Fast_6FC21BC0_113c>): ReturnType<typeof SKILLS_GetParam2Fast_6FC21BC0_113c> {
  return SKILLS_GetParam2Fast_6FC21BC0_113c(...args)
}
function SKILLS_RollbackUnitAnimationFrame_6FCC35D0_113c(...args: Parameters<typeof SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c>): ReturnType<typeof SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c> {
  return SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c(...args)
}
function D2Common_10419_GetUnitSeqCurrentFrame113c(...args: Parameters<typeof ITEMS_GetActiveWeaponClassCodeIdx113c>): ReturnType<typeof ITEMS_GetActiveWeaponClassCodeIdx113c> {
  return ITEMS_GetActiveWeaponClassCodeIdx113c(...args)
}
function SKILLS_GetSeqRollbackFrame_6FC21EC0_113c(...args: Parameters<typeof SKILLS_GetParam6Fast_6FC21EC0_113c>): ReturnType<typeof SKILLS_GetParam6Fast_6FC21EC0_113c> {
  return SKILLS_GetParam6Fast_6FC21EC0_113c(...args)
}
function DATATBLS_GetDifficultyLevelsTxtRecord113c(...args: Parameters<typeof DATATBLS_GetMonLvlTxtRecord113c>): ReturnType<typeof DATATBLS_GetMonLvlTxtRecord113c> {
  return DATATBLS_GetMonLvlTxtRecord113c(...args)
}
function SKILLS_IsCurseDurationDifficultyScaled_6FC6DF80_113c(...args: Parameters<typeof SKILLS_IsDimVisionOrTerrorState113c>): ReturnType<typeof SKILLS_IsDimVisionOrTerrorState113c> {
  return SKILLS_IsDimVisionOrTerrorState113c(...args)
}
function SKILLS_ScaleCurseDurationByDifficulty_6FC6DF60_113c(...args: Parameters<typeof SKILLS_DivideValueByMonLvlHp113c>): ReturnType<typeof SKILLS_DivideValueByMonLvlHp113c> {
  return SKILLS_DivideValueByMonLvlHp113c(...args)
}
function AURA_ExecuteRadiusFilterAtTargetPos_6FCC0AD0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _nSkillId: number,
  dwFilterFlags: number,
  radius: number,
  pfnCallback: number,
  pCurseCtx: number,
): number {
  return AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c(
    m,
    pGame,
    dwFilterFlags,
    pUnit,
    radius,
    (mm, pTarget, pArg) => {
      if (pfnCallback === 0x6fc70250) {
        SKILLS_ApplyCurseStateAndStatsCallback_6FC70250_113c(mm, pTarget, pArg)
      } else if (pfnCallback === 0x6fc70b70) {
        SKILLS_ApplyAttractCurseCallback_6FC70B70_113c(mm, pTarget, pArg)
      }
    },
    pCurseCtx,
  )
}
function SKILLS_CanApplyTerrorOrConfusionToMonster_6FC6EE80_113c(
  m: D2KernMemory113c,
  pGame: number,
  pTarget: number,
  pCaster: number,
): number {
  return SKILLS_CanConvertOrMindBlastTarget_6FC6EE80_113c(m, pTarget, pCaster, pGame)
}
function SUNIT_IterateUnitsOfType113c(
  m: D2KernMemory113c,
  pGame: number,
  dwType: number,
  pArg: number,
  pfnCallback: number,
): number {
  return SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    pGame,
    (mm, g, u, a) => {
      if (pfnCallback === 0x6fc77900) return ACT5Q4_CheckPlayerNearNihlathakRoom_6FC77900_113c(mm, g, u, a)
      if (pfnCallback === 0x6fc7af50) return ACT5Q4_PropagateQuestStateToPartyCallback_6FC7AF50_113c(mm, g, u, a)
      if (pfnCallback === 0x6fc78ff0) return ACT5Q4_ApplyPlayerSkillState52IfQuest26State0D_6FC78FF0_113c(mm, g, u, a)
      if (pfnCallback === 0x6fc79060) return ACT5Q4_SyncPlayerQuest26State0EAlert22_6FC79060_113c(mm, g, u, a)
      if (pfnCallback === 0x6fc559c0) return QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c(mm, g, u, a)
      if (pfnCallback === 0x6fc793f0) return ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c(mm, g, u, a)
      return 0
    },
    dwType,
    pArg,
  )
}
function QUESTS_BroadcastNpcQuestMessages_6FC53920_113c(...args: Parameters<typeof QUESTS_SetGlobalQuestState_6FC53920_113c>): ReturnType<typeof QUESTS_SetGlobalQuestState_6FC53920_113c> {
  return QUESTS_SetGlobalQuestState_6FC53920_113c(...args)
}
function QUESTS_SetTimer_6FC53AF0_113c(
  m: D2KernMemory113c,
  nPeriodTicks: number,
  pQuest: number,
  pfnTimerCallback: number,
): void {
  QUESTS_AppendQuestTimer_6FC53AF0_113c(m, nPeriodTicks, pQuest, pfnTimerCallback)
}
function QUESTS_RecordPlayerGUID_6FC54C00_113c(...args: Parameters<typeof QUESTS_SendPlayerQuestLogPacket28_113c>): ReturnType<typeof QUESTS_SendPlayerQuestLogPacket28_113c> {
  return QUESTS_SendPlayerQuestLogPacket28_113c(...args)
}
function DATATBLS_GetLevelThreshold113c(...args: Parameters<typeof DATATBLS_GetStartExpForLevel113c>): ReturnType<typeof DATATBLS_GetStartExpForLevel113c> {
  return DATATBLS_GetStartExpForLevel113c(...args)
}
function STATLIST_UnitGetStatValue113c(...args: Parameters<typeof STATLIST_GetUnitBaseStat113c>): ReturnType<typeof STATLIST_GetUnitBaseStat113c> {
  return STATLIST_GetUnitBaseStat113c(...args)
}
function QUESTS_Act5SpawnPrisonBarbarians_6FC7C2A0_113c(...args: Parameters<typeof ACT5Q2_SpawnBarbarianSoldiersInPrison_6FC7C2A0_113c>): ReturnType<typeof ACT5Q2_SpawnBarbarianSoldiersInPrison_6FC7C2A0_113c> {
  return ACT5Q2_SpawnBarbarianSoldiersInPrison_6FC7C2A0_113c(...args)
}

/**
 * @dll D2Game.dll
 * @va 0x6FC465E0
 * @ordinalOrName MONSTER_OnDeathSpawnFireExplosion75_6FC465E0_113c
 */
export function MONSTER_OnDeathSpawnFireExplosion75_6FC465E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _arg0 = 0,
  _arg1 = 0,
): void {
  hitD2GameVa113c(0x6FC465E0)
  const posX = readUnitPosXInline113c(m, pUnit);
  const posY = readUnitPosYInline113c(m, pUnit);
  const pMissile = SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
    m,
    pGame,
    0x75,
    pUnit,
    0,
    1,
    0,
    0,
    posX,
    posY,
    1,
  ) >>> 0;
  if (pMissile === 0) return;

  const savedSp = k2W7B1StackPtr;
  const pDmg = (savedSp - 0x70) >>> 0;
  k2W7B1StackPtr = pDmg;
  try {
    for (let i = 0; i < 0x70; i += 4) {
      m.setU32((pDmg + i) >>> 0, 0);
    }
    m.setU32((pDmg + 0x08) >>> 0, 0x6400);
    m.setU32((pDmg + 0x10) >>> 0, 0x6400);
    SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c(
      m,
      pGame,
      pMissile,
      posX,
      posY,
      6,
      pDmg,
      0,
      0,
      0,
      0x583,
    );
  } finally {
    k2W7B1StackPtr = savedSp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC466B0
 * @ordinalOrName MONSTER_OnDeathCorpseExplosionScaledByMonLvl_6FC466B0_113c
 */
export function MONSTER_OnDeathCorpseExplosionScaledByMonLvl_6FC466B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _arg0 = 0,
  _arg1 = 0,
): void {
  hitD2GameVa113c(0x6FC466B0)
  const posX = readUnitPosXInline113c(m, pUnit);
  const posY = readUnitPosYInline113c(m, pUnit);
  const pMissile = SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
    m,
    pGame,
    0x75,
    pUnit,
    0,
    1,
    0,
    0,
    posX,
    posY,
    1,
  ) >>> 0;
  if (pMissile === 0) return;

  const savedSp = k2W7B1StackPtr;
  const pDmg = (savedSp - 0xc0) >>> 0;
  const pCalcStats = (pDmg + 0x80) >>> 0;
  k2W7B1StackPtr = pDmg;
  try {
    for (let i = 0; i < 0x70; i += 4) {
      m.setU32((pDmg + i) >>> 0, 0);
    }
    for (let i = 0; i < 0x38; i += 4) {
      m.setU32((pCalcStats + i) >>> 0, 0);
    }
    const nMonLevel = STATLIST_GetUnitStat113c(m, pUnit, 0x0c, 0) | 0;
    const bDiff = m.u8((pGame + 0x6d) >>> 0);
    const nGameType = m.u8((pGame + 0x6a) >>> 0) !== 0 || m.u32((pGame + 0x74) >>> 0) !== 0 ? 1 : 0;
    DATATBLS_CalculateMonsterStatsByLevel113c(
      m,
      i32(m, (pUnit + 0x04) >>> 0),
      nGameType,
      bDiff,
      nMonLevel,
      1,
      pCalcStats,
    );
    const pMonLvlRec = DATATBLS_GetMonLvlTxtRecord113c(m, bDiff) >>> 0;
    if (pMonLvlRec === 0) return;

    let esi = mulDiv113c(i32(m, (pMonLvlRec + 0x3c) >>> 0), i32(m, (pCalcStats + 0x04) >>> 0), 100);
    if (bDiff === 0) {
      esi = (esi - sdiv32(esi, 4)) | 0;
    } else if (bDiff === 1) {
      esi = (esi - sdiv32(esi, 3)) | 0;
    } else if (bDiff === 2) {
      esi = sdiv32(esi, 8);
    }

    let edi = 0;
    if (esi > 0x100000) {
      const eaxMask = (esi & -16) | 0;
      if (eaxMask < 0x640) {
        edi = Number((BigInt(esi) * 60n) / 100n) | 0;
      } else {
        edi = imul32(sdiv32(esi, 100), 60);
      }
    } else {
      edi = sdiv32(imul32(esi, 60), 100);
    }

    const roll = SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, (esi - edi) | 0) | 0;
    const dmg = (((roll + edi) | 0) << 6) >>> 0;
    m.setU32((pDmg + 0x08) >>> 0, dmg);
    m.setU32((pDmg + 0x10) >>> 0, dmg);
    const radius = (m.u8((pGame + 0x6d) >>> 0) + 4) | 0;
    SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c(
      m,
      pGame,
      pMissile,
      posX,
      posY,
      radius,
      pDmg,
      0,
      0,
      0,
      0x581,
    );
  } finally {
    k2W7B1StackPtr = savedSp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC47E30
 * @ordinalOrName SKILLS_SrvDo024_SpawnWeaponMissileWithToHitAndBonusDmg_6FC47E30_113c
 */
export function SKILLS_SrvDo024_SpawnWeaponMissileWithToHitAndBonusDmg_6FC47E30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC47E30)
  if (pUnit === 0) return 0;
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  if (nSkillId < 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0;
  const pSkillTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0;
  if (pSkillTxt === 0) return 0;

  const pWeapon = PLAYER_GetEquippedWeapon113c(m, pUnit) >>> 0;
  if (pWeapon === 0) return 0;
  const missileId = ITEMS_GetMissileType113c(m, pWeapon) | 0;
  if (missileId <= 0 || missileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 0;

  let pMissile = 0;
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pWeapon, 0x26) !== 0) {
    pMissile = SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c(
      m,
      0,
      pUnit,
      pGame,
      missileId,
      nSkillId,
      nSkillLevel,
      0,
      0,
      0,
      1,
    ) >>> 0;
  } else {
    pMissile = SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
      m,
      pGame,
      missileId,
      pUnit,
      nSkillId,
      nSkillLevel,
      0,
      0,
      0,
      0,
      1,
    ) >>> 0;
  }

  if (pMissile !== 0) {
    const toHit = SKILLS_GetSkillToHitBonus113c(m, pUnit, nSkillId, nSkillLevel) | 0;
    STATLIST_AddUnitStatMemPort113c(m, pMissile, 0x13, toHit, 0);
    const bonusDmg = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      m.u32((pSkillTxt + 0x138) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0;
    STATLIST_AddUnitStatMemPort113c(m, pMissile, 0x19, bonusDmg, 0);
  }
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC49000
 * @ordinalOrName SKILLS_SrvDo029_ApplySingleTargetMonsterCurse_6FC49000_113c
 */
export function SKILLS_SrvDo029_ApplySingleTargetMonsterCurse_6FC49000_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC49000)
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  if (nSkillId < 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0;
  const pSkillTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0;
  if (pSkillTxt === 0) return 0;

  const wAuraTargetState = i16(m, (pSkillTxt + 0x82) >>> 0);
  if (wAuraTargetState < 0 || wAuraTargetState >= i32(m, (pDataTables + 0xc4) >>> 0)) return 0;

  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
  const pPath = m.u32((pUnit + 0x2c) >>> 0);
  let pTarget = (pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) : 0) >>> 0;
  if (
    pTarget === pUnit ||
    pTarget === 0 ||
    SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c(m, pGame, pTarget) === 0 ||
    SUNIT_AreUnitsHostileOrUnaligned113c(m, pUnit, pTarget, pGame) === 0
  ) {
    pTarget = AURA_FindClosestUnitInRadius_6FCC1000_113c(
      m,
      pUnit,
      pGame,
      0x14,
      0x6fc47130,
      {
        onUnitFindFilter: (mm, _cb, g, t) =>
          SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c(mm, g, t),
      },
    ) >>> 0;
    if (pTarget === 0) return 0;
  }

  const savedSp = k2W7B1StackPtr;
  const pCurseCtx = (savedSp - 0x70) >>> 0;
  k2W7B1StackPtr = pCurseCtx;
  try {
    for (let i = 0; i < 0x68; i += 4) {
      m.setU32((pCurseCtx + i) >>> 0, 0);
    }
    m.setU32(pCurseCtx, pGame >>> 0);
    m.setU32((pCurseCtx + 0x04) >>> 0, pUnit >>> 0);
    m.setU32((pCurseCtx + 0x08) >>> 0, 1);
    m.setU32((pCurseCtx + 0x0c) >>> 0, 0);
    m.setU32((pCurseCtx + 0x10) >>> 0, nSkillId >>> 0);
    m.setU32((pCurseCtx + 0x14) >>> 0, nSkillLevel >>> 0);
    const len = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      m.u32((pSkillTxt + 0x60) >>> 0),
      nSkillId,
      nSkillLevel,
    ) >>> 0;
    m.setU32((pCurseCtx + 0x18) >>> 0, len);

    const bitMask1 = m.u32((m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) + 0x04) >>> 0) & 0xff;
    for (let idx = 0; idx < 6; idx++) {
      const statId = i16(m, (pSkillTxt + 0x54 + idx * 2) >>> 0);
      if (statId < 0 || statId >= i32(m, (pDataTables + 0xbd4) >>> 0)) {
        m.setU32((pCurseCtx + 0x1c + idx * 4) >>> 0, 0xffffffff);
        break;
      }
      const pStatRec = DATATBLS_GetItemStatCostRecordFast113c(m, statId) >>> 0;
      if (pStatRec === 0) break;
      if ((m.u8((pStatRec + 0x05) >>> 0) & bitMask1) !== 0) {
        m.setU32((pCurseCtx + 0x0c) >>> 0, 1);
      }
      m.setU32((pCurseCtx + 0x1c + idx * 4) >>> 0, statId >>> 0);
      const statVal = SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillTxt + 0x68 + idx * 4) >>> 0),
        nSkillId,
        nSkillLevel,
      ) >>> 0;
      m.setU32((pCurseCtx + 0x34 + idx * 4) >>> 0, statVal);
    }
    m.setU32((pCurseCtx + 0x4c) >>> 0, wAuraTargetState >>> 0);

    SKILLS_ApplyCurseStateAndStatsCallback_6FC70250_113c(m, pTarget, pCurseCtx);
  } finally {
    k2W7B1StackPtr = savedSp;
  }
  const pAiGeneral =
    m.u32(pTarget) === 1 && m.u32((pTarget + 0x14) >>> 0) !== 0
      ? m.u32((m.u32((pTarget + 0x14) >>> 0) + 0x28) >>> 0)
      : 0;
  if (pAiGeneral !== 0) {
    m.setU32((pAiGeneral + 0x0c) >>> 0, 0xffffffff);
    m.setU32((pAiGeneral + 0x10) >>> 0, 1);
  }
  EVENT_FreeEventQueueNodesByType_6FC35570_113c(m, pGame, pTarget, 2, 0);
  EVENT_SetEvent113c(m, pGame, pTarget, 2, (m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0, 0, 0);
  UNITS_SetTargetUnitForDynamicUnit113c(m, pTarget, pUnit);
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC493B0
 * @ordinalOrName SKILLS_SrvDo030_BarbarianChargeUpdateAndStrike_6FC493B0_113c
 */
export function SKILLS_SrvDo030_BarbarianChargeUpdateAndStrike_6FC493B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC493B0)
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit, nSkillId) >>> 0;
  if (pSkill === 0) return 0;
  const flags = SKILLS_GetFlags113c(m, pSkill) | 0;
  if ((flags & 0x100) !== 0) {
    if (SKILLS_UpdateLeapMovementStep_6FC48740_113c(m, pUnit, pGame, pSkill) === 0) {
      return 1;
    }
    if (SKILLS_FindNextMeleeTargetInRadius_6FC472C0_113c(m, pGame, pUnit, pSkill) !== 0) {
      SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c(m, pUnit, pGame, 0x10);
      return 1;
    }
    EVENT_FreeEventQueueNodesByType_6FC35570_113c(m, pGame, pUnit, 1, 0);
    EVENT_SetEvent113c(m, pGame, pUnit, 1, (m.u32((pGame + 0xa8) >>> 0) + 4) >>> 0, 0, 0);
    return 0;
  }
  if ((flags & 0x80) !== 0) {
    return SKILLS_SetupChargeOrLeapPath_6FC46A80_113c(m, pUnit, pSkill, flags) | 0;
  }
  const flags2 = SKILLS_GetFlags113c(m, pSkill) | 0;
  if ((flags2 & 0x200) !== 0) {
    return SKILLS_ExecuteRadiusMeleeHitAndClearStun_6FC47820_113c(m, pUnit, pGame, nSkillId, nSkillLevel) | 0;
  }
  SKILLS_SetParam0C113c(m, pSkill, 0x1000);
  return 1;
}
/**
 * @dll D2Game.dll
 * @va 0x6FC494A0
 * @ordinalOrName SKILLS_SrvDo031_LeapLandingAndKnockback_6FC494A0_113c
 */
export function SKILLS_SrvDo031_LeapLandingAndKnockback_6FC494A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC494A0)
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  if (nSkillId < 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0;
  const pSkillTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0;
  if (pSkillTxt === 0) return 0;

  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit, nSkillId) >>> 0;
  if (pSkill === 0) return 0;

  let unitType = 6;
  if (pUnit !== 0) {
    let pNode = m.u32((pUnit + 0xdc) >>> 0);
    while (pNode !== 0) {
      const pNext = m.u32((pNode + 0x24) >>> 0);
      if (m.u8(pNode) === 1) {
        SUNIT_UpdateUnitOverlayNode_6FCAE6F0_113c(m, pGame, pNode, pUnit);
      }
      pNode = pNext;
    }
    unitType = m.u32(pUnit);
  }

  const bIsMonster = unitType === 1 ? 1 : 0;
  const flags = SKILLS_GetFlags113c(m, pSkill) | 0;
  if ((flags & 0x100) !== 0) {
    if (SKILLS_UpdateLeapMovementStep_6FC48740_113c(m, pUnit, pGame, pSkill) === 0) {
      return 1;
    }
    if (bIsMonster !== 0) {
      return 1;
    }
    const savedSp = k2W7B1StackPtr;
    const pDmg = (savedSp - 0x70) >>> 0;
    k2W7B1StackPtr = pDmg;
    try {
      for (let i = 0; i < 0x70; i += 4) {
        m.setU32((pDmg + i) >>> 0, 0);
      }
      m.setU16((pDmg + 0x04) >>> 0, 9);
      const radius = SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillTxt + 0x138) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0;
      if (pUnit !== 0) {
        AURA_ForEachHostileTargetInRadius_6FCC0C70_113c(
          m,
          pGame,
          pUnit,
          0,
          0,
          radius,
          0x8583,
          0x6fcc1210,
          pDmg,
          bIsMonster,
        );
      }
    } finally {
      k2W7B1StackPtr = savedSp;
    }
    return 1;
  }

  if ((flags & 0x80) !== 0) {
    return SKILLS_SetupChargeOrLeapPath_6FC46A80_113c(m, pUnit, pSkill, flags) | 0;
  }
  if (bIsMonster === 0) {
    SKILLS_SetParam0C113c(m, pSkill, 0);
  }
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC4BE20
 * @ordinalOrName PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c
 */
export function PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c(
  m: D2KernMemory113c,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FC4BE20)
  const ebx = m.u32((pClient + 0x1b8) >>> 0);
  let edi = 0;
  let pUnit = 0;
  if ((m.u8((pClient + 0x3d4) >>> 0) & 1) !== 0) {
    pUnit = m.u32((pClient + 0x174) >>> 0);
  } else {
    pUnit = m.u32((pClient + 0x174) >>> 0);
    if (pUnit === 0) return;
    pUnit = SUNIT_GetServerUnit113c(
      m,
      m.u32((pClient + 0x1a8) >>> 0),
      m.u32((pClient + 0x16c) >>> 0),
      m.u32((pClient + 0x170) >>> 0),
    ) >>> 0;
    if (pUnit === 0) {
      m.setU32((pClient + 0x174) >>> 0, 0);
      return;
    }
  }
  if (pUnit === 0) return;

  if (ebx !== 0 && i32(m, (pClient + 0x1b0) >>> 0) >= 10) {
    edi = 1;
  }
  if (i32(m, (pClient + 0x1b0) >>> 0) >= 20) {
    edi = 1;
  }
  if (m.u32(pUnit) !== 0) {
    const loc = FOG_GetErrorLocation113c(m, 0xeb0);
    FOG_DisplayAssert113c(m, 0x6fd19ff9, loc);
    msvc_exit113c(m, -1);
  }
  if (PLAYER_SyncClientLifeManaStaminaGoldAndCoords_6FCEC030_113c(m, pUnit, pUnit, edi) !== 0) {
    m.setU32((pClient + 0x1b0) >>> 0, 0);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC55EB0
 * @ordinalOrName QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c
 */
export function QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(
  m: D2KernMemory113c,
  pQuestArg: number,
  nState: number,
): void {
  hitD2GameVa113c(0x6FC55EB0)
  const savedSp = k2W7B1StackPtr;
  const pBuf = (savedSp - 0x100) >>> 0;
  k2W7B1StackPtr = pBuf;
  try {
    m.setU8((pQuestArg + 0x0c) >>> 0, nState & 0xff);
    user32_wsprintfA113c(m, pBuf, 0x6fd1cc2c, nState);
    if (m.u32(0x6fd31c20) !== 0) {
      QUESTS_DebugOutput_6FCEBE70_113c(m, m.u32((pQuestArg + 0x04) >>> 0), pBuf, 4);
    }
  } finally {
    k2W7B1StackPtr = savedSp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC56C20
 * @ordinalOrName QUESTS_Act2TaintedSunTriggerAltarDarkness_6FC56C20_113c
 */
export function QUESTS_Act2TaintedSunTriggerAltarDarkness_6FC56C20_113c(
  m: D2KernMemory113c,
  pArgs: number,
): void {
  hitD2GameVa113c(0x6FC56C20)
  const pGame = m.u32(pArgs);
  const pAct2Quests = m.u32((pGame + 0x10f4) >>> 0);
  if (pAct2Quests === 0) return;
  let pQuest = m.u32(pAct2Quests);
  while (pQuest !== 0) {
    if (m.u32(pQuest) === 0x0b) {
      ACT2Q0_PresetSpawnJerhynAndRelocate_6FCE9B70_113c(m, pArgs >>> 0, pQuest >>> 0);
      return;
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC5BB60
 * @ordinalOrName QUESTS_Act3KurastTemplesSequenceFilter_6FC5BB60_113c
 */
export function QUESTS_Act3KurastTemplesSequenceFilter_6FC5BB60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pHitUnit = 0,
): number {
  hitD2GameVa113c(0x6FC5BB60)
  if ((pHitUnit | 0) !== 0) return 0;
  return MISSILE_SrvHit_RadialStatsDamageByAuraRange_6FC5B5F0_113c(m, pGame, pMissile, 0) | 0;
}
/**
 * @dll D2Game.dll
 * @va 0x6FC63610
 * @ordinalOrName SKILLS_SrvDo042_SpawnSrvMissileWithDeltaAndRange_6FC63610_113c
 */
export function SKILLS_SrvDo042_SpawnSrvMissileWithDeltaAndRange_6FC63610_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC63610)
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  if (nSkillId < 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0;
  const pSkillTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0;
  if (pSkillTxt === 0) return 0;

  const wSrvMissile = i16(m, (pSkillTxt + 0x48) >>> 0);
  if (wSrvMissile < 0 || wSrvMissile >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 0;

  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0);
  }
  const range = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    m.u32((pSkillTxt + 0x138) >>> 0),
    nSkillId,
    nSkillLevel,
  ) | 0;

  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
  const pPath = m.u32((pUnit + 0x2c) >>> 0);
  const pTarget = (pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) : 0) >>> 0;
  let dx = 0;
  let dy = 0;
  if (pTarget !== pUnit && pTarget !== 0) {
    dx = (SUNIT_GetUnitPosX_6FC21100_113c(m, pTarget) - SUNIT_GetUnitPosX_6FC21100_113c(m, pUnit)) | 0;
    dy = (SUNIT_GetUnitPosY_6FC21130_113c(m, pTarget) - SUNIT_GetUnitPosY_6FC21130_113c(m, pUnit)) | 0;
  }

  const pMissile = SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
    m,
    pGame,
    wSrvMissile,
    pUnit,
    nSkillId,
    nSkillLevel,
    dx,
    dy,
    0,
    0,
    0,
  ) >>> 0;
  if (pMissile === 0) return 0;
  MISSILE_SetTotalFrames113c(m, pMissile, range);
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC63720
 * @ordinalOrName SKILLS_SrvDo043_SpawnSrvMissileWithRange_6FC63720_113c
 */
export function SKILLS_SrvDo043_SpawnSrvMissileWithRange_6FC63720_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC63720)
  if (nSkillId < 0) return 0;
  const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0;
  const pDataTables = pDataTablesPtr !== 0 ? (m.u32(pDataTablesPtr) >>> 0) : 0;
  if (pDataTables === 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0;
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0;
  if (pSkillsBase === 0) return 0;
  const pSkillTxt = (pSkillsBase + imul32(nSkillId, 0x23c)) >>> 0;
  if (pSkillTxt === 0) return 0;

  const wSrvMissile = i16(m, (pSkillTxt + 0x48) >>> 0);
  if (wSrvMissile < 0 || wSrvMissile >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 0;

  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0);
  }
  const range = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    m.u32((pSkillTxt + 0x138) >>> 0),
    nSkillId,
    nSkillLevel,
  ) | 0;

  const pMissile = SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
    m,
    pGame,
    wSrvMissile,
    pUnit,
    nSkillId,
    nSkillLevel,
    0,
    0,
    0,
    0,
    0,
  ) >>> 0;
  if (pMissile === 0) return 0;
  MISSILE_SetTargetX113c(m, pMissile, range);
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC63FA0
 * @ordinalOrName SKILLS_SrvDo046_EnchantOrRevivePetWithAuraState_6FC63FA0_113c
 */
export function SKILLS_SrvDo046_EnchantOrRevivePetWithAuraState_6FC63FA0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC63FA0)
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  if (nSkillId < 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0;
  const pSkillTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0;
  if (pSkillTxt === 0) return 0;

  const wSrvMissile = i16(m, (pSkillTxt + 0x48) >>> 0);
  if (wSrvMissile < 0 || wSrvMissile >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 0;
  const wAuraState = i16(m, (pSkillTxt + 0x80) >>> 0);
  if (wAuraState < 0 || wAuraState >= i32(m, (pDataTables + 0xc4) >>> 0)) return 0;

  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit, nSkillId) >>> 0;
  if (pSkill === 0) return 0;

  if (
    STATES_CheckState113c(m, pUnit, wAuraState) !== 0 &&
    SKILLS_GetParam08113c(m, pSkill) === 0
  ) {
    const targetId = SKILLS_GetParam04113c(m, pSkill) | 0;
    const petType = SKILLS_LookupSkillPetTypeIndex_6FC21EF0_113c(m, nSkillId) | 0;
    const pPetUnit = PETS_FindOwnedUnitBySubIndex_6FCC0F40_113c(
      m,
      pGame,
      pUnit,
      0,
      3,
      petType,
      targetId,
      0,
      0,
    ) >>> 0;
    if (pPetUnit !== 0) {
      const pSpawned = SKILLS_SpawnPetFromObjectOrCorpse_6FC62510_113c(
        m,
        pUnit,
        pPetUnit,
        pGame,
        wSrvMissile,
        nSkillId,
        nSkillLevel,
      ) >>> 0;
      if (pSpawned !== 0) {
        MISSILE_ProcessTargetCollisionHit113c(m, pSpawned, pGame, pPetUnit, 1);
        SUNIT_VerifyAndDeleteUnit_6FD020A0_113c(m, pGame, pSpawned);
        UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c(
          m,
          pUnit,
          pPetUnit,
          nSkillId,
          nSkillLevel,
          0,
          0,
          0,
        );
      }
      SKILLS_SetParam04113c(m, pSkill, m.u32((pPetUnit + 0x0c) >>> 0));
    } else {
      SKILLS_SetParam04113c(m, pSkill, 0xffffffff);
    }
  } else {
    const savedSp = k2W7B1StackPtr;
    const pSummonArg = (savedSp - 0x30) >>> 0;
    k2W7B1StackPtr = pSummonArg;
    try {
      for (let i = 0; i < 0x28; i += 4) {
        m.setU32((pSummonArg + i) >>> 0, 0);
      }
      m.setU32(pSummonArg, pUnit >>> 0);
      m.setU32((pSummonArg + 0x04) >>> 0, pUnit >>> 0);
      m.setU32((pSummonArg + 0x08) >>> 0, nSkillId >>> 0);
      m.setU32((pSummonArg + 0x0c) >>> 0, nSkillLevel >>> 0);
      const duration = SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillTxt + 0x60) >>> 0),
        nSkillId,
        nSkillLevel,
      ) >>> 0;
      m.setU32((pSummonArg + 0x10) >>> 0, duration);
      m.setU32((pSummonArg + 0x14) >>> 0, 0xffffffff);
      m.setU32((pSummonArg + 0x18) >>> 0, 0);
      m.setU32((pSummonArg + 0x1c) >>> 0, wAuraState >>> 0);

      const pStatList = AURA_ApplyTimerStatListWithSkillAndState_6FCC00B0_113c(m, pSummonArg) >>> 0;
      if (pStatList !== 0) {
        STATLIST_SetStatIfListIsValid113c(m, pStatList, 0x15e, nSkillId, 0);
        STATLIST_SetStatIfListIsValid113c(m, pStatList, 0x15f, nSkillLevel, 0);
      }
    } finally {
      k2W7B1StackPtr = savedSp;
    }
  }
  SKILLS_SetParam08113c(m, pSkill, 0);
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC64390
 * @ordinalOrName SKILLS_SrvDo047_SpawnSkillMissileAtTargetPos_6FC64390_113c
 */
export function SKILLS_SrvDo047_SpawnSkillMissileAtTargetPos_6FC64390_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC64390)
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  if (nSkillId < 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0;
  const pSkillTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0;
  if (pSkillTxt === 0) return 0;

  const wSrvMissile = i16(m, (pSkillTxt + 0x48) >>> 0);
  if (wSrvMissile < 0 || wSrvMissile >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 0;

  return (
    SKILLS_SpawnMissileAtSkillTargetPos_6FC641C0_113c(
      m,
      pUnit,
      pGame,
      nSkillId,
      nSkillLevel,
      wSrvMissile,
    ) | 0
  );
}

/**
 * @dll D2Game.dll
 * @va 0x6FC643F0
 * @ordinalOrName SKILLS_StartOrUpdateDelayedChannelSkillState_6FC643F0_113c
 */
export function SKILLS_StartOrUpdateDelayedChannelSkillState_6FC643F0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  nSkillId: number,
  nSkillLevel: number,
  nMissileId: number,
): number {
  hitD2GameVa113c(0x6FC643F0)
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  if (nSkillId < 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0;
  const pSkillTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0;
  if (pSkillTxt === 0) return 0;

  if (pUnit !== 0 && m.u32(pUnit) === 1) {
    let frames =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillTxt + 0x13c) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0;
    if (frames < 1) frames = 1;
    const targetFrame = (m.u32((pGame + 0xa8) >>> 0) + frames) >>> 0;
    const pCurSkill = UNITS_GetCurrentSkill113c(m, pUnit) >>> 0;
    SKILLS_SetParam04113c(m, pCurSkill, targetFrame);
  }

  let pStatList = STATLIST_GetStatListFromUnitAndState113c(m, pUnit, 0x0c) >>> 0;
  if (pStatList === 0) {
    const expireFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x14) >>> 0;
    const unitId = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff;
    const unitType = pUnit !== 0 ? m.u32(pUnit) : 6;
    pStatList = STATLIST_AllocStatList113c(
      m,
      m.u32((pGame + 0x1c) >>> 0),
      2,
      expireFrame,
      unitType,
      unitId,
    ) >>> 0;
    if (pStatList === 0) return 0;

    EVENT_SetEvent113c(m, pGame, pUnit, 0x0c, expireFrame, 0, 0);
    STATLIST_MergeStatLists113c(m, pUnit, pStatList, 1);
    STATLIST_SetStatRemoveCallback113c(m, pStatList, 0x6fc62290);
    STATLIST_SetState113c(m, pStatList, 0x0c);
    STATES_ToggleState113c(m, pUnit, 0x0c, 1);
    const pCurSkill = UNITS_GetCurrentSkill113c(m, pUnit) >>> 0;
    SKILLS_SetParam04113c(m, pCurSkill, 0);
    return 1;
  }

  SUNIT_AdvancePathAndBroadcast_6FD02480_113c(m, pUnit, pGame, 1);
  const expireFrame = (m.u32((pGame + 0xa8) >>> 0) + 6) >>> 0;
  D2Common_10476_SetStatListExpireFrame113c(m, pStatList, expireFrame);
  EVENT_SetEvent113c(m, pGame, pUnit, 0x0c, expireFrame, 0, 0);
  SKILLS_SpawnMissileAtSkillTargetPos_6FC641C0_113c(
    m,
    pUnit,
    pGame,
    nSkillId,
    nSkillLevel,
    nMissileId,
  );
  return 1;
}
/**
 * @dll D2Game.dll
 * @va 0x6FC654E0
 * @ordinalOrName SKILLS_SpawnSpreadProjectilesAtTargetOrPath_6FC654E0_113c
 */
export function SKILLS_SpawnSpreadProjectilesAtTargetOrPath_6FC654E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  nMissileId: number,
  nCount: number,
  bSpawnFirstDirect = 0,
): number {
  hitD2GameVa113c(0x6FC654E0)
  let rem = nCount | 0;
  if (bSpawnFirstDirect !== 0) {
    SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
      m,
      pGame,
      nMissileId,
      pUnit,
      nSkillId,
      nSkillLevel,
      0,
      0,
      0,
      0,
      0,
    );
    rem = (rem - 1) | 0;
    if (rem <= 0) return 1;
  }

  const savedSp = k2W7B1StackPtr;
  const pParam = (savedSp - 0x60) >>> 0;
  k2W7B1StackPtr = pParam;
  try {
    for (let i = 0; i < 0x5c; i += 4) {
      m.setU32((pParam + i) >>> 0, 0);
    }
    m.setU32(pParam, 0x21);
    m.setU32((pParam + 0x04) >>> 0, pUnit >>> 0);
    m.setU32((pParam + 0x10) >>> 0, nMissileId >>> 0);
    m.setU32((pParam + 0x14) >>> 0, readUnitPosXInline113c(m, pUnit) >>> 0);
    m.setU32((pParam + 0x18) >>> 0, readUnitPosYInline113c(m, pUnit) >>> 0);
    m.setU32((pParam + 0x2c) >>> 0, nSkillId >>> 0);
    m.setU32((pParam + 0x30) >>> 0, nSkillLevel >>> 0);
    m.setU32((pParam + 0x54) >>> 0, 0x6fc61f50);

    if (
      SKILLS_GetTargetOrPathPosition_6FCBFA30_113c(
        m,
        pUnit,
        pGame,
        (pParam + 0x1c) >>> 0,
        (pParam + 0x20) >>> 0,
      ) !== 0 &&
      rem > 0
    ) {
      for (let i = 0; i < rem; i++) {
        m.setU32((pParam + 0x58) >>> 0, i >>> 0);
        MISSILE_InitAndSpawnCustom_6FC8F930_113c(m, pGame, pParam);
      }
    }
  } finally {
    k2W7B1StackPtr = savedSp;
  }
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC656B0
 * @ordinalOrName SKILLS_SrvDo051_SpawnMultipleBowOrCrossbowProjectiles_6FC656B0_113c
 */
export function SKILLS_SrvDo051_SpawnMultipleBowOrCrossbowProjectiles_6FC656B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC656B0)
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  if (nSkillId < 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0;
  const pSkillTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0;
  if (pSkillTxt === 0) return 0;

  const missileId = SKILLS_GetBowOrCrossbowMissileId_6FCB1340_113c(m, nSkillId, pUnit) | 0;
  if (missileId < 0 || missileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 0;

  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0);
  }
  const count =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      m.u32((pSkillTxt + 0x138) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0;
  if (count <= 0) return 0;

  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
    m,
    pGame,
    missileId,
    pUnit,
    nSkillId,
    nSkillLevel,
    0,
    0,
    0,
    0,
    0,
  );
  const rem = (count - 1) | 0;
  if (rem > 0) {
    const savedSp = k2W7B1StackPtr;
    const pParam = (savedSp - 0x60) >>> 0;
    k2W7B1StackPtr = pParam;
    try {
      for (let i = 0; i < 0x5c; i += 4) {
        m.setU32((pParam + i) >>> 0, 0);
      }
      m.setU32(pParam, 0x21);
      m.setU32((pParam + 0x04) >>> 0, pUnit >>> 0);
      m.setU32((pParam + 0x10) >>> 0, missileId >>> 0);
      m.setU32((pParam + 0x14) >>> 0, readUnitPosXInline113c(m, pUnit) >>> 0);
      m.setU32((pParam + 0x18) >>> 0, readUnitPosYInline113c(m, pUnit) >>> 0);
      m.setU32((pParam + 0x2c) >>> 0, nSkillId >>> 0);
      m.setU32((pParam + 0x30) >>> 0, nSkillLevel >>> 0);
      m.setU32((pParam + 0x54) >>> 0, 0x6fc61f50);

      if (
        SKILLS_GetTargetOrPathPosition_6FCBFA30_113c(
          m,
          pUnit,
          pGame,
          (pParam + 0x1c) >>> 0,
          (pParam + 0x20) >>> 0,
        ) !== 0
      ) {
        for (let i = 0; i < rem; i++) {
          m.setU32((pParam + 0x58) >>> 0, i >>> 0);
          MISSILE_InitAndSpawnCustom_6FC8F930_113c(m, pGame, pParam);
        }
      }
    } finally {
      k2W7B1StackPtr = savedSp;
    }
  }
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC65AF0
 * @ordinalOrName SKILLS_EventFunc05_MoltenBoulderOrPerFrameAura_6FC65AF0_113c
 */
export function SKILLS_EventFunc05_MoltenBoulderOrPerFrameAura_6FC65AF0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC65AF0)
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  if (nSkillId < 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) {
    EVENT_CancelSkillEventsByTypeAndId_6FCAE900_113c(m, pGame, pUnit, 5, nSkillId);
    return 0;
  }
  const pSkillTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0;
  if (pSkillTxt === 0 || nSkillLevel <= 0) {
    EVENT_CancelSkillEventsByTypeAndId_6FCAE900_113c(m, pGame, pUnit, 5, nSkillId);
    return 0;
  }
  const wAuraState = i16(m, (pSkillTxt + 0x80) >>> 0);
  if (
    wAuraState < 0 ||
    wAuraState >= i32(m, (pDataTables + 0xc4) >>> 0) ||
    STATES_CheckState113c(m, pUnit, wAuraState) === 0
  ) {
    EVENT_CancelSkillEventsByTypeAndId_6FCAE900_113c(m, pGame, pUnit, 5, nSkillId);
    return 0;
  }

  const bitMask0 = m.u8(m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C));
  if ((m.u8((pSkillTxt + 0x05) >>> 0) & bitMask0) === 0) {
    const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0;
    if (pRoom !== 0 && DUNGEON_IsRoomInTown113c(m, pRoom) !== 0) {
      const pStatList = STATLIST_GetStatListFromUnitAndState113c(m, pUnit, wAuraState) >>> 0;
      if (pStatList !== 0) {
        D2Common_10474_UnlinkStatListFromUnit113c(m, pUnit, pStatList);
        STATLIST_FreeStatListEx113c(m, pStatList);
      }
      STATES_ToggleState113c(m, pUnit, wAuraState, 0);
      EVENT_CancelSkillEventsByTypeAndId_6FCAE900_113c(m, pGame, pUnit, 5, nSkillId);
      return 0;
    }
  }

  const radius =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      m.u32((pSkillTxt + 0x64) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0;
  if (radius <= 0) {
    EVENT_CancelSkillEventsByTypeAndId_6FCAE900_113c(m, pGame, pUnit, 5, nSkillId);
    return 0;
  }

  const perDelay = SKILLS_GetPerDelay113c(m, nSkillId) | 0;
  const nextFrame = (m.u32((pGame + 0xa8) >>> 0) + perDelay) >>> 0;
  EVENT_CancelSkillEventsByTypeAndId_6FCAE900_113c(m, pGame, pUnit, 5, nSkillId);
  EVENT_SetEvent113c(m, pGame, pUnit, 5, nextFrame, nSkillId, nSkillLevel);

  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0;
  if (pRoom === 0 || DUNGEON_IsRoomInTown113c(m, pRoom) !== 0) {
    return 0;
  }

  const savedSp = k2W7B1StackPtr;
  const pDmg = (savedSp - 0x70) >>> 0;
  k2W7B1StackPtr = pDmg;
  try {
    for (let i = 0; i < 0x70; i += 4) {
      m.setU32((pDmg + i) >>> 0, 0);
    }
    SKILLS_SetupPhysicalSkillDamage_6FCBF1A0_113c(m, pUnit, nSkillId, pDmg, nSkillLevel);
    SKILLS_FillElementalDamageStrc_6FCBF210_113c(m, pUnit, nSkillId, pDmg, nSkillLevel);
    m.setU16(
      (pDmg + 0x04) >>> 0,
      (m.u16((pDmg + 0x04) >>> 0) | m.u16((pSkillTxt + 0x12e) >>> 0)) & 0xffff,
    );
    m.setU32(pDmg, (m.u32(pDmg) | m.u32((pSkillTxt + 0x130) >>> 0)) >>> 0);
    AURA_ApplyRadialDamageToEnemies_6FCC1240_113c(
      m,
      pGame,
      pUnit,
      pDmg,
      m.u32((pSkillTxt + 0x50) >>> 0),
      0,
      0,
      radius,
    );
  } finally {
    k2W7B1StackPtr = savedSp;
  }
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC67900
 * @ordinalOrName PALADIN_FindAndSpawnBlessedHammerOrAuraSubMissile_6FC67900_113c
 */
export function PALADIN_FindAndSpawnBlessedHammerOrAuraSubMissile_6FC67900_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSubMissileIdx: number,
  nLevel: number,
): number {
  hitD2GameVa113c(0x6FC67900)
  const savedSp = k2W7B1StackPtr;
  const pOutX = (savedSp - 0x10) >>> 0;
  const pOutY = (pOutX + 0x04) >>> 0;
  k2W7B1StackPtr = pOutX;
  try {
    m.setU32(pOutX, 0);
    m.setU32(pOutY, 0);
    if (
      SKILLS_FindBlessedHammerSpawnCoords_6FC671E0_113c(
        m,
        pGame,
        pUnit,
        0,
        nLevel,
        nSubMissileIdx,
        pOutX,
        pOutY,
      ) === 0
    ) {
      return 0;
    }
    return (
      MONSTER_SpawnPresetPackTable_6FD0F940_113c(
        m,
        nSubMissileIdx,
        pUnit,
        pGame,
        m.u32(pOutX),
        m.u32(pOutY),
        nLevel,
        0,
        1,
        0,
      ) | 0
    );
  } finally {
    k2W7B1StackPtr = savedSp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC687A0
 * @ordinalOrName NPC_StartPlayerNpcInteraction_6FC687A0_113c
 */
export function NPC_StartPlayerNpcInteraction_6FC687A0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pInteractUnit: number,
  pGame: number,
  ppInteractionListHead: number,
  bFlag = 0,
): number {
  hitD2GameVa113c(0x6FC687A0)
  let edi = m.u32(ppInteractionListHead);
  if (m.u8((pUnit + 0x6c) >>> 0) !== 0) {
    if (
      SUNIT_GetServerUnit113c(
        m,
        pGame,
        m.u32((pUnit + 0x68) >>> 0),
        m.u32((pUnit + 0x64) >>> 0),
      ) !== 0
    ) {
      return 0;
    }
  }
  if (pInteractUnit === 0) return 0;
  const mode = m.u32((pInteractUnit + 0x10) >>> 0);
  if (mode === 0 || mode === 0x0c) return 0;
  if (ACT1Q4_IsCainInTristram_6FC57680_113c(m, pInteractUnit) === 1) return 0;

  const classId = m.u32((pInteractUnit + 0x04) >>> 0);
  if (MONSTERS_GetNpcVendorIndex_6FC215D0_113c(m, classId, 9) === 0) {
    return 1;
  }
  if (classId === 0x92) {
    if (QUESTS_Act2JerhynCheckPalaceBlocked_6FC80390_113c(m, pGame, pUnit, pInteractUnit) !== 0) {
      return 0;
    }
  }

  while (edi !== 0) {
    if (m.u32(edi) === pUnit >>> 0) {
      return 1;
    }
    edi = m.u32((edi + 0x08) >>> 0);
  }

  let pClient = 0;
  if (m.u32(pUnit) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit) >>> 0;
    pClient = m.u32((pPlayerData + 0x9c) >>> 0);
  }
  const pNode = FOG_AllocServerMemory113c(
    m,
    m.u32((pGame + 0x1c) >>> 0),
    0x0c,
    0x6fd1c358,
    0x1c7,
    0,
  ) >>> 0;
  m.setU32(pNode, pUnit >>> 0);
  const prevHead = m.u32(ppInteractionListHead);
  if (prevHead === 0) {
    m.setU32((pNode + 0x08) >>> 0, 0);
  } else {
    m.setU32((pNode + 0x08) >>> 0, prevHead);
  }
  m.setU32(ppInteractionListHead, pNode);

  const introFlag = PLRINTRO_GetNpcIntroQuestFlag_6FC69A80_113c(
    m,
    pClient,
    classId,
    pGame,
    pClient,
  ) | 0;
  MONSTER_SetNpcIntroFlag_6FCDD330_113c(m, pInteractUnit, introFlag);
  UNIT_SetInteractUnit_6FCFFAE0_113c(m, pUnit, 1, m.u32((pInteractUnit + 0x0c) >>> 0));
  m.setU32((pNode + 0x04) >>> 0, 0);

  const pInv = ITEMS_GetInventory2113c(m, m.u32((pGame + 0x1c) >>> 0)) >>> 0;
  QUESTS_OnNpcInteract_6FC54660_113c(m, pClient, pUnit, pInteractUnit, pInv);

  const pPkt27 = 0x7ffdf400;
  m.setU8(pPkt27, 0x27);
  m.setU8((pPkt27 + 1) >>> 0, m.u32(pInteractUnit) & 0xff);
  m.setU32((pPkt27 + 2) >>> 0, m.u32((pInteractUnit + 0x0c) >>> 0));
  ITEMS_SerializeInventoryPacket113c(m, pInv, (pPkt27 + 6) >>> 0);
  D2GS_SendPacket27_NpcQuestInfo_6FCAB3D0_113c(m, pPkt27, pClient);
  ITEMS_FreeInventory113c(m, pInv);
  QUESTS_CheckFirstNpcIntro_6FC55030_113c(m, pGame, pInteractUnit, pClient);

  const npcId = m.u32((pInteractUnit + 0x0c) >>> 0);
  const disableGamble = QUESTS_ShouldDisableNpcGamble_6FC21020_113c(m, pUnit, pGame, bFlag) | 0;
  NET_SendPacketToClient9Bytes_6FCAAD40_113c(m, 0x28, 1, npcId, pClient, disableGamble);
  return 0;
}
/**
 * @dll D2Game.dll
 * @va 0x6FC6CC50
 * @ordinalOrName SKILLS_SrvDo060_PaladinSmite_6FC6CC50_113c
 */
export function SKILLS_SrvDo060_PaladinSmite_6FC6CC50_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6CC50)
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  if (nSkillId < 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0;
  const pSkillTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0;
  if (pSkillTxt === 0) return 0;

  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
  const pPath = m.u32((pUnit + 0x2c) >>> 0);
  const pTarget = (pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) : 0) >>> 0;
  if (pTarget === pUnit || pTarget === 0) return 0;
  if (SUNIT_AreUnitsHostileOrUnaligned113c(m, pUnit, pTarget, pGame) === 0) return 0;

  const savedSp = k2W7B1StackPtr;
  const pDmg = (savedSp - 0xe0) >>> 0;
  const pTmpDmg = (pDmg + 0x70) >>> 0;
  k2W7B1StackPtr = pDmg;
  try {
    for (let i = 0; i < 0xe0; i += 4) {
      m.setU32((pDmg + i) >>> 0, 0);
    }
    const toHitBonus = SKILLS_GetSkillToHitBonus113c(m, pUnit, nSkillId, nSkillLevel) | 0;
    const resultFlags =
      SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, pUnit, pTarget, pGame, toHitBonus, 0, pDmg) & 0xffff;
    m.setU16((pDmg + 0x04) >>> 0, resultFlags);

    if ((resultFlags & 1) !== 0) {
      const dmgBonus =
        SKILLS_EvalCalcByOffset113c(
          m,
          pUnit,
          m.u32((pSkillTxt + 0x138) >>> 0),
          nSkillId,
          nSkillLevel,
        ) | 0;
      const srcDam = m.u8((pSkillTxt + 0x1a5) >>> 0);
      m.setU32((pTmpDmg + 0x0c) >>> 0, dmgBonus >>> 0);
      const physRaw = SUNITDMG_ComputeWeaponBaseDamage113c(m, pUnit, 0, pTmpDmg, 90, 0) | 0;
      let physDmg = physRaw;
      if (srcDam !== 0x80) {
        if (physRaw > 0x100000) {
          physDmg = imul32(sdiv32(physRaw, 0x80), srcDam);
        } else {
          physDmg = sdiv32(imul32(srcDam, physRaw), 0x80);
        }
      }
      m.setU32((pDmg + 0x08) >>> 0, physDmg >>> 0);

      const elemType = m.u8((pSkillTxt + 0x1dc) >>> 0);
      if (elemType !== 0) {
        const convPct =
          SKILLS_EvalCalcByOffset113c(
            m,
            pUnit,
            m.u32((pSkillTxt + 0x144) >>> 0),
            nSkillId,
            nSkillLevel,
          ) | 0;
        m.setU32((pDmg + 0x68) >>> 0, convPct >>> 0);
        if (convPct > 0) {
          m.setU8((pDmg + 0x65) >>> 0, elemType);
        }
      }
      SKILLS_FillElementalDamageStrc_6FCBF210_113c(m, pUnit, nSkillId, pDmg, nSkillLevel);
      m.setU32(pDmg, 1);

      const pShield = INVENTORY_GetShieldItem_6FC572C0_113c(m, pUnit) >>> 0;
      if (pShield !== 0 && ITEMS_CheckIfShield113c(m, pShield) !== 0) {
        const minBonus =
          SKILLS_EvalCalcByOffset113c(
            m,
            pUnit,
            m.u32((pSkillTxt + 0x13c) >>> 0),
            nSkillId,
            nSkillLevel,
          ) | 0;
        const maxBonus =
          SKILLS_EvalCalcByOffset113c(
            m,
            pUnit,
            m.u32((pSkillTxt + 0x140) >>> 0),
            nSkillId,
            nSkillLevel,
          ) | 0;
        PALADIN_AddShieldSmiteDamage_6FC6C9E0_113c(m, pShield, pUnit, minBonus, pGame, maxBonus);
      }
    }
    SUNITDMG_ExecuteEventsAndApplyDamage_6FCFDDE0_113c(m, pGame, pUnit, pTarget, pDmg, 0x80);
  } finally {
    k2W7B1StackPtr = savedSp;
  }
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC6DAC0
 * @ordinalOrName SKILLS_SrvDo062_StrikeTrackedPetTargetAndAdvanceChain_6FC6DAC0_113c
 */
export function SKILLS_SrvDo062_StrikeTrackedPetTargetAndAdvanceChain_6FC6DAC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6DAC0)
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  if (nSkillId < 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0;
  const pSkillTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0;
  if (pSkillTxt === 0) return 0;

  const pSkill = UNITS_GetCurrentSkill113c(m, pUnit) >>> 0;
  if (pSkill === 0) return 0;

  const subIdx = (UNITS_GetAnimOrSeqFrame113c(m, pUnit) + 4) | 0;
  const targetId = SKILLS_GetParam0C113c(m, pSkill) | 0;
  const targetType = SKILLS_GetParam08113c(m, pSkill) | 0;
  let pTarget = SUNIT_GetServerUnit113c(m, pGame, targetType, targetId) >>> 0;
  if (pTarget === 0 || UNITS_IsUnitInRoomAndValid113c(m, pUnit, pTarget, 0) === 0) {
    pTarget = PETS_FindOwnedUnitBySubIndex_6FCC0F40_113c(
      m,
      pGame,
      pUnit,
      0,
      0x20003,
      subIdx,
      targetId,
      0,
      0,
    ) >>> 0;
    if (pTarget === 0) return 0;
  }

  const savedSp = k2W7B1StackPtr;
  const pDmg = (savedSp - 0x70) >>> 0;
  k2W7B1StackPtr = pDmg;
  try {
    for (let i = 0; i < 0x70; i += 4) {
      m.setU32((pDmg + i) >>> 0, 0);
    }
    const toHitBonus = SKILLS_GetSkillToHitBonus113c(m, pUnit, nSkillId, nSkillLevel) | 0;
    const resultFlags =
      SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, pUnit, pTarget, pGame, toHitBonus, 0, pDmg) & 0xffff;
    m.setU16((pDmg + 0x04) >>> 0, resultFlags);

    if ((resultFlags & 1) !== 0) {
      const physBonus =
        SKILLS_EvalCalcByOffset113c(
          m,
          pUnit,
          m.u32((pSkillTxt + 0x13c) >>> 0),
          nSkillId,
          nSkillLevel,
        ) >>> 0;
      m.setU32((pDmg + 0x0c) >>> 0, physBonus);
      const elemType = m.u8((pSkillTxt + 0x1dc) >>> 0);
      if (elemType !== 0) {
        const convPct =
          SKILLS_EvalCalcByOffset113c(
            m,
            pUnit,
            m.u32((pSkillTxt + 0x144) >>> 0),
            nSkillId,
            nSkillLevel,
          ) | 0;
        m.setU32((pDmg + 0x68) >>> 0, convPct >>> 0);
        if (convPct > 0) {
          m.setU8((pDmg + 0x65) >>> 0, elemType);
        }
        SKILLS_FillElementalDamageStrc_6FCBF210_113c(m, pUnit, nSkillId, pDmg, nSkillLevel);
      }
    }

    let srcDam = m.u8((pSkillTxt + 0x1a5) >>> 0);
    if (srcDam === 0) srcDam = 0x80;
    SUNITDMG_ExecuteEventsAndApplyDamage_6FCFDDE0_113c(m, pGame, pUnit, pTarget, pDmg, srcDam);
    SUNITDMG_ExecuteEvents113c(m, pGame, pUnit, pTarget, 1, 0);
  } finally {
    k2W7B1StackPtr = savedSp;
  }

  const remCount = (SKILLS_GetParam04113c(m, pSkill) - 1) | 0;
  SKILLS_SetParam04113c(m, pSkill, remCount);
  if (remCount > 0) {
    const skipId = pTarget !== 0 ? m.u32((pTarget + 0x0c) >>> 0) : 0xffffffff;
    const pNextTarget = PETS_FindOwnedUnitBySubIndex_6FCC0F40_113c(
      m,
      pGame,
      pUnit,
      0,
      0x20003,
      subIdx,
      skipId,
      0,
      0,
    ) >>> 0;
    if (pNextTarget !== 0) {
      SKILLS_SetParam08113c(m, pSkill, m.u32(pNextTarget));
      SKILLS_SetParam0C113c(m, pSkill, m.u32((pNextTarget + 0x0c) >>> 0));
      const rollback = SKILLS_GetAnimActionFrame_6FC21BC0_113c(m, nSkillId) | 0;
      SKILLS_RollbackUnitAnimationFrame_6FCC35D0_113c(m, pUnit, rollback);
    }
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC6DCD0
 * @ordinalOrName SKILLS_SrvDo063_RangedMultiShotAtTrackedPetTargets_6FC6DCD0_113c
 */
export function SKILLS_SrvDo063_RangedMultiShotAtTrackedPetTargets_6FC6DCD0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6DCD0)
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  if (nSkillId < 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0;
  const pSkillTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0;
  if (pSkillTxt === 0) return 0;

  const pSkill = UNITS_GetCurrentSkill113c(m, pUnit) >>> 0;
  if (pSkill === 0) return 0;

  const subIdx =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      m.u32((pSkillTxt + 0x64) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0;
  let remCount = SKILLS_GetParam04113c(m, pSkill) | 0;
  if (remCount === 0) return 0;

  const targetId = SKILLS_GetParam0C113c(m, pSkill) | 0;
  const targetType = SKILLS_GetParam08113c(m, pSkill) | 0;
  let pTarget = SUNIT_GetServerUnit113c(m, pGame, targetType, targetId) >>> 0;
  if (pTarget === 0) {
    pTarget = PETS_FindOwnedUnitBySubIndex_6FCC0F40_113c(
      m,
      pGame,
      pUnit,
      0,
      3,
      subIdx,
      targetId,
      0,
      0,
    ) >>> 0;
    if (pTarget === 0) return 1;
  }

  UNITS_SetTargetUnitForDynamicUnit113c(m, pUnit, pTarget);
  const savedSp = k2W7B1StackPtr;
  const pParam = (savedSp - 0x70) >>> 0;
  const pOutX = (pParam + 0x60) >>> 0;
  const pOutY = (pParam + 0x64) >>> 0;
  k2W7B1StackPtr = pParam;
  try {
    m.setU32(pOutX, 0);
    m.setU32(pOutY, 0);
    SKILLS_GetTargetOrPathPosition_6FCBFA30_113c(m, pUnit, pGame, pOutX, pOutY);

    let missileId = i16(m, (pSkillTxt + 0x48) >>> 0);
    if (D2Common_10419_GetUnitSeqCurrentFrame113c(m, pUnit) !== 1) {
      const missileA = i16(m, (pSkillTxt + 0x4a) >>> 0);
      if (missileA >= 0) {
        missileId = missileA;
      }
    }
    if (missileId < 0 || missileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 0;

    const range =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillTxt + 0x13c) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0;
    for (let i = 0; i < 0x5c; i += 4) {
      m.setU32((pParam + i) >>> 0, 0);
    }
    m.setU32(pParam, 0x21);
    m.setU32((pParam + 0x04) >>> 0, pUnit >>> 0);
    m.setU32((pParam + 0x10) >>> 0, missileId >>> 0);
    m.setU32((pParam + 0x14) >>> 0, SUNIT_GetUnitPosX_6FC21100_113c(m, pUnit) >>> 0);
    m.setU32((pParam + 0x18) >>> 0, SUNIT_GetUnitPosY_6FC21130_113c(m, pUnit) >>> 0);
    m.setU32((pParam + 0x1c) >>> 0, m.u32(pOutX));
    m.setU32((pParam + 0x20) >>> 0, m.u32(pOutY));
    m.setU32((pParam + 0x2c) >>> 0, nSkillId >>> 0);
    m.setU32((pParam + 0x30) >>> 0, nSkillLevel >>> 0);
    m.setU32((pParam + 0x54) >>> 0, 0x6fc6c190);
    m.setU32((pParam + 0x58) >>> 0, range >>> 0);
    MISSILE_InitAndSpawnCustom_6FC8F930_113c(m, pGame, pParam);
  } finally {
    k2W7B1StackPtr = savedSp;
  }

  remCount = (remCount - 1) | 0;
  SKILLS_SetParam04113c(m, pSkill, remCount);
  if (remCount <= 0) return 0;

  const skipId = pTarget !== 0 ? m.u32((pTarget + 0x0c) >>> 0) : 0xffffffff;
  const pNextTarget = PETS_FindOwnedUnitBySubIndex_6FCC0F40_113c(
    m,
    pGame,
    pUnit,
    0,
    3,
    subIdx,
    skipId,
    0,
    0,
  ) >>> 0;
  if (pNextTarget !== 0) {
    SKILLS_SetParam08113c(m, pSkill, m.u32(pNextTarget));
    SKILLS_SetParam0C113c(m, pSkill, m.u32((pNextTarget + 0x0c) >>> 0));
    const rollback = SKILLS_GetSeqRollbackFrame_6FC21EC0_113c(m, nSkillId) | 0;
    SKILLS_RollbackUnitAnimationFrame_6FCC35D0_113c(m, pUnit, rollback);
  }
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC70470
 * @ordinalOrName SKILLS_ApplyDimVisionToTarget_6FC70470_113c
 */
export function SKILLS_ApplyDimVisionToTarget_6FC70470_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pTarget: number,
  nSkillLevel: number,
): void {
  hitD2GameVa113c(0x6FC70470)
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  const nSkillsCnt = i32(m, (pDataTables + 0xba0) >>> 0);
  if (nSkillsCnt <= 0x47) return;
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0);
  if (pSkillsBase === 0) return;
  const pSkillTxt = (pSkillsBase + 0x9ea4) >>> 0;

  let len =
    SKILLS_EvalCalcByOffset113c(m, pUnit, m.u32((pSkillTxt + 0x60) >>> 0), 0x47, nSkillLevel) | 0;
  const pDiffLvls = DATATBLS_GetDifficultyLevelsTxtRecord113c(m, m.u8((pGame + 0x6d) >>> 0)) >>> 0;
  if (pDiffLvls !== 0) {
    const div = i32(m, (pDiffLvls + 0x1c) >>> 0);
    if (div !== 0) {
      len = sdiv32(len, div);
    }
  }

  const savedSp = k2W7B1StackPtr;
  const pCurseCtx = (savedSp - 0x70) >>> 0;
  k2W7B1StackPtr = pCurseCtx;
  try {
    for (let i = 0; i < 0x68; i += 4) {
      m.setU32((pCurseCtx + i) >>> 0, 0);
    }
    m.setU32(pCurseCtx, pGame >>> 0);
    m.setU32((pCurseCtx + 0x04) >>> 0, pUnit >>> 0);
    m.setU32((pCurseCtx + 0x08) >>> 0, 1);
    m.setU32((pCurseCtx + 0x0c) >>> 0, 0);
    m.setU32((pCurseCtx + 0x10) >>> 0, 0x47);
    m.setU32((pCurseCtx + 0x14) >>> 0, nSkillLevel >>> 0);
    m.setU32((pCurseCtx + 0x18) >>> 0, len >>> 0);

    const bitMask1 = m.u8((m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) + 0x04) >>> 0);
    for (let idx = 0; idx < 6; idx++) {
      const statId = i16(m, (pSkillTxt + 0x54 + idx * 2) >>> 0);
      if (statId < 0 || statId >= i32(m, (pDataTables + 0xbd4) >>> 0)) {
        m.setU32((pCurseCtx + 0x1c + idx * 4) >>> 0, 0xffffffff);
        break;
      }
      const pStatRec = (m.u32((pDataTables + 0xbcc) >>> 0) + imul32(statId, 0x144)) >>> 0;
      if (pStatRec === 0) break;
      if ((m.u8((pStatRec + 0x05) >>> 0) & bitMask1) !== 0) {
        m.setU32((pCurseCtx + 0x0c) >>> 0, 1);
      }
      m.setU32((pCurseCtx + 0x1c + idx * 4) >>> 0, statId >>> 0);
      const val =
        SKILLS_EvalCalcByOffset113c(
          m,
          pUnit,
          m.u32((pSkillTxt + 0x68 + idx * 4) >>> 0),
          0x47,
          nSkillLevel,
        ) >>> 0;
      m.setU32((pCurseCtx + 0x34 + idx * 4) >>> 0, val);
    }
    m.setU32((pCurseCtx + 0x4c) >>> 0, i16(m, (pSkillTxt + 0x82) >>> 0) >>> 0);
    SKILLS_ApplyCurseStateAndStatsCallback_6FC70250_113c(m, pTarget, pCurseCtx);
  } finally {
    k2W7B1StackPtr = savedSp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC705D0
 * @ordinalOrName SKILLS_SrvDo067_NecromancerCurseRadius_6FC705D0_113c
 */
export function SKILLS_SrvDo067_NecromancerCurseRadius_6FC705D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC705D0)
  const pIat = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0;
  const pDataTables = pIat !== 0 ? (m.u32(pIat) >>> 0) : (m.u32(0x6fde9e1c) >>> 0);
  const has113cSkills =
    pDataTables !== 0 &&
    m.u32((pDataTables + 0xb98) >>> 0) >= 0x1000 &&
    i32(m, (pDataTables + 0xba0) >>> 0) > 0;
  const nSkillsCnt = pDataTables !== 0 ? i32(m, (pDataTables + (has113cSkills ? 0xba0 : 0xb98)) >>> 0) : 0;
  if (pDataTables === 0 || nSkillId < 0 || nSkillId >= nSkillsCnt) return 0;
  const pSkillsBase = m.u32((pDataTables + (has113cSkills ? 0xb98 : 0xb90)) >>> 0);
  if (pSkillsBase === 0) return 0;
  const pSkillTxt = (pSkillsBase + imul32(nSkillId, 0x23c)) >>> 0;

  const wAuraStat0 = i16(m, (pSkillTxt + 0x54) >>> 0);
  if (wAuraStat0 < -1 || wAuraStat0 >= i32(m, (pDataTables + 0xbd4) >>> 0)) return 0;
  const wAuraTargetState = i16(m, (pSkillTxt + 0x82) >>> 0);
  if (wAuraTargetState < 0 || wAuraTargetState >= i32(m, (pDataTables + 0xc4) >>> 0)) return 0;

  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0);
  }
  const bScaleLenByDiff = SKILLS_IsCurseDurationDifficultyScaled_6FC6DF80_113c(
    m,
    wAuraTargetState,
  ) | 0;
  const radius =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      m.u32((pSkillTxt + 0x64) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0;
  let len =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      m.u32((pSkillTxt + 0x60) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0;
  if (bScaleLenByDiff !== 0) {
    len = SKILLS_ScaleCurseDurationByDifficulty_6FC6DF60_113c(
      m,
      m.u8((pGame + 0x6d) >>> 0),
      len,
    ) | 0;
  }

  const pCurseCtx = 0x7ffdf400;
  for (let i = 0; i < 0x68; i += 4) {
    m.setU32((pCurseCtx + i) >>> 0, 0);
  }
  m.setU32(pCurseCtx, pGame >>> 0);
  m.setU32((pCurseCtx + 0x04) >>> 0, pUnit >>> 0);
  m.setU32((pCurseCtx + 0x08) >>> 0, bScaleLenByDiff >>> 0);
  m.setU32((pCurseCtx + 0x0c) >>> 0, 0);
  m.setU32((pCurseCtx + 0x10) >>> 0, nSkillId >>> 0);
  m.setU32((pCurseCtx + 0x14) >>> 0, nSkillLevel >>> 0);
  m.setU32((pCurseCtx + 0x18) >>> 0, len >>> 0);

  const bitMask1 = m.u8((m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) + 0x04) >>> 0);
  for (let idx = 0; idx < 6; idx++) {
    const statId = i16(m, (pSkillTxt + 0x54 + idx * 2) >>> 0);
    if (statId < 0 || statId >= i32(m, (pDataTables + 0xbd4) >>> 0)) {
      m.setU32((pCurseCtx + 0x1c + idx * 4) >>> 0, 0xffffffff);
      break;
    }
    const pStatRec = DATATBLS_GetItemStatCostRecordFast113c(m, statId) >>> 0;
    if (pStatRec === 0) break;
    if ((m.u8((pStatRec + 0x05) >>> 0) & bitMask1) !== 0) {
      m.setU32((pCurseCtx + 0x0c) >>> 0, 1);
    }
    m.setU32((pCurseCtx + 0x1c + idx * 4) >>> 0, statId >>> 0);
    const val =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillTxt + 0x68 + idx * 4) >>> 0),
        nSkillId,
        nSkillLevel,
      ) >>> 0;
    m.setU32((pCurseCtx + 0x34 + idx * 4) >>> 0, val);
  }
  m.setU32((pCurseCtx + 0x4c) >>> 0, i16(m, (pSkillTxt + 0x82) >>> 0) >>> 0);
  m.setU32((pCurseCtx + 0x50) >>> 0, i16(m, (pSkillTxt + 0x84) >>> 0) >>> 0);
  m.setU32((pCurseCtx + 0x54) >>> 0, i16(m, (pSkillTxt + 0x86) >>> 0) >>> 0);
  m.setU32((pCurseCtx + 0x58) >>> 0, i16(m, (pSkillTxt + 0x88) >>> 0) >>> 0);
  m.setU32((pCurseCtx + 0x5c) >>> 0, i16(m, (pSkillTxt + 0x8a) >>> 0) >>> 0);
  m.setU32((pCurseCtx + 0x60) >>> 0, i16(m, (pSkillTxt + 0x8c) >>> 0) >>> 0);
  m.setU32((pCurseCtx + 0x64) >>> 0, i16(m, (pSkillTxt + 0x8e) >>> 0) >>> 0);

  return (
    AURA_ExecuteRadiusFilterAtTargetPos_6FCC0AD0_113c(
      m,
      pGame,
      pUnit,
      nSkillId,
      m.u32((pSkillTxt + 0x50) >>> 0),
      radius,
      0x6fc70250,
      pCurseCtx,
    ) | 0
  );
}
/**
 * @dll D2Game.dll
 * @va 0x6FC70DB0
 * @ordinalOrName SKILLS_ApplyTerrorOrConfusionCallback_6FC70DB0_113c
 */
export function SKILLS_ApplyTerrorOrConfusionCallback_6FC70DB0_113c(
  m: D2KernMemory113c,
  pTarget: number,
  pCtx: number,
): number {
  hitD2GameVa113c(0x6FC70DB0)
  if (
    SKILLS_CanApplyTerrorOrConfusionToMonster_6FC6EE80_113c(
      m,
      m.u32(pCtx),
      pTarget,
      m.u32((pCtx + 0x04) >>> 0),
    ) === 0
  ) {
    return 0;
  }

  const ebp = m.u32((pCtx + 0x14) >>> 0);
  if (m.u8((pCtx + 0x10) >>> 0) === 0) {
    if (pTarget !== 0 && m.u32(pTarget) === 1) {
      if (MONSTERS_GetNpcVendorIndex_6FC215D0_113c(m, m.u32((pTarget + 0x04) >>> 0), 0x10) !== 0) {
        const pMonData = m.u32((pTarget + 0x14) >>> 0);
        if (pMonData !== 0) {
          m.setU32((pMonData + 0x38) >>> 0, 1);
          m.setU32((pMonData + 0x34) >>> 0, ebp);
        }
      }
    }
  } else {
    if (pTarget !== 0 && m.u32(pTarget) === 1) {
      if (MONSTERS_GetNpcVendorIndex_6FC215D0_113c(m, m.u32((pTarget + 0x04) >>> 0), 0x10) !== 0) {
        const pMonData = m.u32((pTarget + 0x14) >>> 0);
        if (pMonData !== 0) {
          m.setU32((pMonData + 0x38) >>> 0, 2);
          m.setU32((pMonData + 0x34) >>> 0, ebp);
        }
      }
    }
  }

  const pGame = m.u32(pCtx);
  const expireFrame = (m.u32((pGame + 0xa8) >>> 0) + m.u32((pCtx + 0x18) >>> 0)) >>> 0;
  EVENT_SetEvent113c(m, pGame, pTarget, 0x0a, expireFrame, 0, 0);
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC71A90
 * @ordinalOrName SKILLS_SrvDo070_NecromancerWeakenOrDecrepify_6FC71A90_113c
 */
export function SKILLS_SrvDo070_NecromancerWeakenOrDecrepify_6FC71A90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC71A90)
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  if (nSkillId < 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0;
  const pSkillTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0;
  if (pSkillTxt === 0) return 0;

  const wAuraStat0 = i16(m, (pSkillTxt + 0x54) >>> 0);
  if (wAuraStat0 < -1 || wAuraStat0 >= i32(m, (pDataTables + 0xbd4) >>> 0)) return 0;
  const wAuraTargetState = i16(m, (pSkillTxt + 0x82) >>> 0);
  if (wAuraTargetState < 0 || wAuraTargetState >= i32(m, (pDataTables + 0xc4) >>> 0)) return 0;

  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0);
  }
  const radius =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      m.u32((pSkillTxt + 0x64) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0;
  const rawLen =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      m.u32((pSkillTxt + 0x60) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0;
  const len = SKILLS_ScaleCurseDurationByDifficulty_6FC6DF60_113c(
    m,
    m.u8((pGame + 0x6d) >>> 0),
    rawLen,
  ) | 0;

  const savedSp = k2W7B1StackPtr;
  const pCurseCtx = (savedSp - 0x70) >>> 0;
  k2W7B1StackPtr = pCurseCtx;
  try {
    for (let i = 0; i < 0x68; i += 4) {
      m.setU32((pCurseCtx + i) >>> 0, 0);
    }
    m.setU32(pCurseCtx, pGame >>> 0);
    m.setU32((pCurseCtx + 0x04) >>> 0, pUnit >>> 0);
    m.setU32((pCurseCtx + 0x08) >>> 0, 0);
    m.setU32((pCurseCtx + 0x0c) >>> 0, 0);
    m.setU32((pCurseCtx + 0x10) >>> 0, nSkillId >>> 0);
    m.setU32((pCurseCtx + 0x14) >>> 0, nSkillLevel >>> 0);
    m.setU32((pCurseCtx + 0x18) >>> 0, len >>> 0);

    const bitMask1 = m.u8((m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) + 0x04) >>> 0);
    for (let idx = 1; idx < 6; idx++) {
      const statId = i16(m, (pSkillTxt + 0x54 + idx * 2) >>> 0);
      if (statId < 0 || statId >= i32(m, (pDataTables + 0xbd4) >>> 0)) {
        m.setU32((pCurseCtx + 0x1c + idx * 4) >>> 0, 0xffffffff);
        break;
      }
      const pStatRec = DATATBLS_GetItemStatCostRecordFast113c(m, statId) >>> 0;
      if (pStatRec === 0) break;
      if ((m.u8((pStatRec + 0x05) >>> 0) & bitMask1) !== 0) {
        m.setU32((pCurseCtx + 0x0c) >>> 0, 1);
      }
      m.setU32((pCurseCtx + 0x1c + idx * 4) >>> 0, statId >>> 0);
      const val =
        SKILLS_EvalCalcByOffset113c(
          m,
          pUnit,
          m.u32((pSkillTxt + 0x68 + idx * 4) >>> 0),
          nSkillId,
          nSkillLevel,
        ) >>> 0;
      m.setU32((pCurseCtx + 0x34 + idx * 4) >>> 0, val);
    }
    m.setU32((pCurseCtx + 0x4c) >>> 0, wAuraTargetState >>> 0);

    return (
      AURA_ExecuteRadiusFilterAtTargetPos_6FCC0AD0_113c(
        m,
        pGame,
        pUnit,
        nSkillId,
        m.u32((pSkillTxt + 0x50) >>> 0),
        radius,
        0x6fc70b70,
        pCurseCtx,
      ) | 0
    );
  } finally {
    k2W7B1StackPtr = savedSp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC7B690
 * @ordinalOrName QUESTS_Act1AndarielOnDeath_6FC7B690_113c
 */
export function QUESTS_Act1AndarielOnDeath_6FC7B690_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC7B690)
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) return;
  const pRoom = UNITS_GetRoom113c(m, m.u32((pQuestArg + 0x08) >>> 0)) >>> 0;
  if (pRoom === 0) return;

  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0);
  m.setU32((pQuestExt + 0x8c) >>> 0, pRoom);

  SUNIT_IterateUnitsOfType113c(m, m.u32((pQuestData + 0x04) >>> 0), 0, 0, 0x6fc77900);
  SUNIT_IterateUnitsOfType113c(
    m,
    m.u32(pQuestArg),
    0,
    m.u32((pQuestArg + 0x08) >>> 0),
    0x6fc7af50,
  );
  SUNIT_IterateUnitsOfType113c(
    m,
    m.u32(pQuestArg),
    0,
    m.u32((pQuestArg + 0x08) >>> 0),
    0x6fc79060,
  );
  SUNIT_IterateUnitsOfType113c(
    m,
    m.u32(pQuestArg),
    0,
    m.u32((pQuestArg + 0x08) >>> 0),
    0x6fc78ff0,
  );

  QUESTS_BroadcastNpcQuestMessages_6FC53920_113c(m, m.u32((pQuestData + 0x04) >>> 0), 0x26, 0x0d);
  const pGame = m.u32((pQuestData + 0x04) >>> 0);
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0);
  m.setU8((pQuestCtrl + 0x20) >>> 0, 0x11);
  SUNIT_IterateUnitsOfType113c(m, pGame, 0, 0, 0x6fc559c0);

  m.setU8((pQuestData + 0x0c) >>> 0, 4);
  const savedSp = k2W7B1StackPtr;
  const pBuf = (savedSp - 0x100) >>> 0;
  k2W7B1StackPtr = pBuf;
  try {
    user32_wsprintfA113c(m, pBuf, 0x6fd1cc2c, 4);
    if (m.u32(0x6fd31c20) !== 0) {
      QUESTS_DebugOutput_6FCEBE70_113c(m, m.u32((pQuestData + 0x04) >>> 0), pBuf, 4);
    }
  } finally {
    k2W7B1StackPtr = savedSp;
  }
  if (m.u8((pQuestExt + 0x85) >>> 0) === 0) {
    m.setU8((pQuestExt + 0x85) >>> 0, 1);
    QUESTS_SetTimer_6FC53AF0_113c(m, 8, pQuestData, 0x6fc79cd0);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC7BF70
 * @ordinalOrName QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c
 */
export function QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC7BF70)
  QUESTS_RecordPlayerGUID_6FC54C00_113c(m, pUnit, pGame);
  const bDiff = m.u8((pGame + 0x6d) >>> 0);
  let expReward = 0x155cc0;
  if (bDiff === 1) {
    expReward = 0x1312d00;
  } else if (bDiff === 2) {
    expReward = 0x2625a00;
  }

  const classId = pUnit !== 0 ? m.u32((pUnit + 0x04) >>> 0) : 0xffffffff;
  const maxLvl = DATATBLS_GetMaxLevel113c(m, classId) | 0;
  let curLvl = STATLIST_GetUnitStat113c(m, pUnit, 0x0c, 0) | 0;
  if (curLvl >= maxLvl) return;

  const nextLvlExp =
    (DATATBLS_GetLevelThreshold113c(m, classId, (curLvl + 1) | 0) -
      DATATBLS_GetLevelThreshold113c(m, classId, curLvl)) |
    0;
  if ((expReward | 0) > nextLvlExp) {
    expReward = nextLvlExp;
  }

  while (expReward !== 0) {
    const nextExpStat = STATLIST_UnitGetStatValue113c(m, pUnit, 0x1e, 0) >>> 0;
    const curExpStat = STATLIST_UnitGetStatValue113c(m, pUnit, 0x0d, 0) >>> 0;
    const remToLevel = (nextExpStat - curExpStat) >>> 0;
    if (expReward >>> 0 >= remToLevel) {
      STATLIST_SetUnitStat113c(m, pUnit, 0x0d, nextExpStat, 0);
      STATLIST_SetUnitStat113c(m, pUnit, 0x1d, remToLevel, 0);
      PLAYER_LevelUp_6FD0B090_113c(m, pUnit, pGame);
      expReward = (expReward - remToLevel) >>> 0;
      curLvl = STATLIST_GetUnitStat113c(m, pUnit, 0x0c, 0) | 0;
    } else {
      const curExp2 = STATLIST_UnitGetStatValue113c(m, pUnit, 0x0d, 0) >>> 0;
      STATLIST_SetUnitStat113c(m, pUnit, 0x0d, (curExp2 + expReward) >>> 0, 0);
      expReward = 0;
    }
    if (curLvl >= maxLvl) break;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC7C850
 * @ordinalOrName QUESTS_Act5RescueBarbsOnPrisonDoorOpen_6FC7C850_113c
 */
export function QUESTS_Act5RescueBarbsOnPrisonDoorOpen_6FC7C850_113c(
  m: D2KernMemory113c,
  pArgs: number,
): void {
  hitD2GameVa113c(0x6FC7C850)
  const pGame = m.u32(pArgs);
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0);
  let pQuest = 0;
  if (pQuestCtrl !== 0) {
    let cur = m.u32(pQuestCtrl);
    while (cur !== 0) {
      if (m.u32(cur) === 0x20) {
        pQuest = cur;
        break;
      }
      cur = m.u32((cur + 0xf4) >>> 0);
    }
  }
  if (pQuest === 0 || m.u8((pQuest + 0x09) >>> 0) === 0) return;

  const pQuestExt = m.u32((pQuest + 0x18) >>> 0);
  if (m.u8((pQuest + 0x0c) >>> 0) < 2) {
    m.setU8((pQuest + 0x0c) >>> 0, 2);
    const savedSp = k2W7B1StackPtr;
    const pBuf = (savedSp - 0x100) >>> 0;
    k2W7B1StackPtr = pBuf;
    try {
      user32_wsprintfA113c(m, pBuf, 0x6fd1cc2c, 2);
      if (m.u32(0x6fd31c20) !== 0) {
        QUESTS_DebugOutput_6FCEBE70_113c(m, m.u32((pQuest + 0x04) >>> 0), pBuf, 4);
      }
    } finally {
      k2W7B1StackPtr = savedSp;
    }
  }

  if (m.u8((pQuest + 0x0b) >>> 0) === 0 && i32(m, (pQuestExt + 0xa8) >>> 0) < 5) {
    m.setU8((pQuest + 0x14) >>> 0, 0);
    m.setU8((pQuest + 0x0b) >>> 0, 1);
    SUNIT_IterateUnitsOfType113c(m, m.u32((pQuest + 0x04) >>> 0), 0, 0, 0x6fc793f0);
  }

  for (let idx = 0; idx < 3; idx++) {
    if (m.u8((pQuestExt + 0x86 + idx) >>> 0) === 0) {
      const coordX = m.u32((pArgs + 0x14) >>> 0);
      const coordY = m.u32((pArgs + 0x18) >>> 0);
      for (let j = 0; j < idx; j++) {
        if (
          m.u32((pQuestExt + 0x8c + j * 8) >>> 0) === coordX &&
          m.u32((pQuestExt + 0x90 + j * 8) >>> 0) === coordY
        ) {
          return;
        }
      }
      m.setU32((pQuestExt + 0x8c + idx * 8) >>> 0, coordX);
      m.setU32((pQuestExt + 0x90 + idx * 8) >>> 0, coordY);
      const spawned = QUESTS_Act5SpawnPrisonBarbarians_6FC7C2A0_113c(m, pQuest, pArgs, idx) | 0;
      m.setU32((pQuestExt + 0xa4) >>> 0, (m.u32((pQuestExt + 0xa4) >>> 0) + spawned) >>> 0);
      m.setU8((pQuestExt + 0x86 + idx) >>> 0, 1);
      m.setU8((pQuestExt + 0x10e + idx) >>> 0, 0);
      return;
    }
  }
}
