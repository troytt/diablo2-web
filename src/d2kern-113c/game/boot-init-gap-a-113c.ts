/**
 * Diablo II v1.13c `D2Game.dll` Boot/Init & Event/Sync Coverage Gap Closure Part 1 (36 VAs).
 *
 * Strictly binary-isomorphic 1:1 ports of `D2Game.dll` (`0x6FC2BD10..0x6FCBD5B0`).
 * Pure `Memory113c` execution with zero legacy module dependencies.
 */
import { COLLISION_FindFreeCoordsNear113c } from '../common/collision.ts'
import { UNITS_GetObjectShrineTxt113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import { DRLGPRESET_FreeSaveHeaderBlock113c } from '../common/drlg/preset.ts'
import {
  DUNGEON_AreAllAdjacentRoomsActive113c,
  DUNGEON_FreeRoomPortalList113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordinates113c,
  DUNGEON_GetRoomExFromRoom113c,
} from '../common/dungeon.ts'
import { ENV_GetCycleState113c, ENV_StepCycle113c } from '../common/env.ts'
import { imul32, sar32 } from '../common/int-math.ts'
import {
  INVENTORY_GetCorpseUnitId113c,
  INVENTORY_GetFirstCorpse113c,
  INVENTORY_GetLeftItemGuid113c,
  INVENTORY_GetNextCorpse113c,
} from '../common/inventory.ts'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import { PATH_GetTargetTypeAndPosition113c, PATH_GetVelocity113c } from '../common/path.ts'
import {
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
} from '../common/skills.ts'
import {
  DATATBLS_CalculateMonsterStatsByLevel113c,
  STATES_CheckState113c,
  STATES_CheckStateMask2OnUnit113c,
  STATLIST_CheckUnitStatListFlag100113c,
  STATLIST_ClearBaseStats113c,
  STATLIST_CopyBaseStatsToBuffer113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_GetUnitStat113c,
  STATLIST_NotifyIfStatModified113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITS_GetGfxStateFlagsPtr113c,
  UNITS_GetRoom113c,
  UNITS_GetStateFlagsPtr113c,
  UNITS_HasAnyGfxStateFlag113c,
  UNITS_SetUnitUpdateFlags113c,
  UNIT_GetAlignment113c,
} from '../common/unit.ts'
import { D2EventStrc, D2GameStrc, D2TimerStrc } from '../mem/layout.generated.ts'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import { seedRoll } from '../prng.ts'
import {
  AIGENERAL_ExpireMinionListsInAct113c,
  ITEMS_ExpireGroundItemsInAct113c,
  SEED_RollLimitedRandomNumber113c,
} from './combat-a1c-113c.ts'
import {
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c,
  D2GAME_MONSTER_ApplyMercStatsOnOwner113c,
  D2GAME_PARTY_SyncAllPlayerRelationsOnJoin113c,
  D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c,
  D2GAME_SUNIT_GetGameFromUnit113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c.ts'
import {
  AIGENERAL_PopAiCommand113c,
  PLAYER_Event11_PeriodicTick113c,
  PLAYER_Event3_RegenTick113c,
} from './replay-kernel-113c.ts'
import { ITEMMODE_UnitTimerNoop113c } from './k2-combat-core-w1-113c.ts'
import {
  PLAYER_Event0C_ExpireTimedStats113c,
  SKILLS_Event08_AuraPulseTick113c,
} from './k2-gap-itemdef-113c.ts'
import { MISSILE_DispatchFrameTick113c } from './k2-gap-melee-dot-113c.ts'
import { D2COMMON_SGPT_DATATABLES_VA_113C } from '../common/inline-helpers.ts'
import {
  NET_SendPacket47_UnitRelator1_6FCAAEC0_113c,
  NET_SendPacket48_UnitRequestStatus_6FCAAE60_113c,
  OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c,
  OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c,
} from './k2-w2b3-113c.ts'
import {
  ITEMS_ExpireTimedStatSubListsEvent_6FCF1780_113c,
  SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c,
} from './k2-w2b8-113c.ts'
import {
  OBJ_EventHoverMsgTimeout_6FC8E470_113c,
  OBJ_EventPeriodicOrTimeOfDaySync_6FC8E4E0_113c,
  OBJ_IncrementWellChargesAndRefresh_6FC89CA0_113c,
} from './k2-w3b7-113c.ts'
import { EVENT_HandleFreeHoverMsg_6FC99AA0_113c } from './k2-w3b8-113c.ts'
import { OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c } from './k2-w4b4-113c.ts'
import { SKILLS_DispatchStateOnSrvDoFuncForSkill_6FCBE8E0_113c } from './k2-w4b6-113c.ts'
import { SKILLS_OnPeriodicItemAuraEvent9_6FCC37D0_113c } from './k2-w5b3-113c.ts'
import {
  OBJECTS_FloorSpikesEventTick_6FC8E270_113c,
  OBJECTS_LinkHellPortalToDestinationLevel_6FC8B930_113c,
} from './k2-w7b2-113c.ts'
import {
  OBJ_ThinkEventLightningSpire_6FC8E400_113c,
  OBJ_ThinkEventSparkyChest_6FC8E150_113c,
} from './k2-w8b2-113c.ts'
import { ITEMS_ProcessItemDurabilityAndStackReplenish_6FCFA480_113c } from './k2-w9b2-113c.ts'
import { D2Game_6FC93570_113c } from './k2-w13b1-113c.ts'
import {
  PLAYER_FinishModeAndResetToNeutral113c,
  PLAYER_StepAnimationModeTick113c,
} from './town-runtime-gap-113c.ts'
import {
  CLIENTS_GetPlayerUnit113c,
  CLIENTS_UpdatePlayerRoom113c,
  type ClientsUpdatePlayerRoomOpts113c,
} from './replay-final11-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import {
  MONUMOD_AddSecondaryDamageToBaseStats_6FC41B30_113c,
  MONUMOD_ScheduleDeathEvent4ForUnique_6FC41BB0_113c,
  MONUMOD_ScheduleDeathEvent4UnlessMod18_6FC41A90_113c,
  MONUMOD_ScheduleGetHitEvent2ForUnique_6FC41AD0_113c,
  MONUMOD_ScheduleGetHitOrDeathEvent2_6FC41B00_113c,
  MONUMOD_SetShatterOnDeath_6FC41A70_113c,
  MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c,
} from './k2-laneI-0x6fc3-w1-113c.ts'
import {
  MONUMOD_AddRogueOwnerSecondaryDamageToMissile_6FC43670_113c,
  MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c,
  MONUMOD_RollSelfResurrectEvent7_6FC43570_113c,
  MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c,
  QUESTS_CheckNotIntro_6FC53970_113c,
} from './k2-laneJ-0x6fc4-w1-113c.ts'
import { SUNIT_PlaceUnitAtRoomAndCoords_6FD00D00_113c } from './k2-w5b7-113c.ts'
import {
  PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c,
  QUESTS_ObjectEvent07_FastcallThunk_6FC8F510_113c,
} from './k2-w10b1-113c.ts'
import {
  MONUMOD_ApplyChampionBaseStats_6FC418A0_113c,
  MONUMOD_EventReviveOrCorpseCheck_6FC43E20_113c,
  MONUMOD_SpawnColdEnchantedFrostNova_6FC462D0_113c,
  MONUMOD_SpawnDeathNova_6FC46520_113c,
  MONUMOD_SpawnFireEnchantedBolts_6FC460D0_113c,
  MONUMOD_SpawnLightningEnchantedBolts_6FC45CC0_113c,
  MONUMOD_SpawnScarabChargedBolts_6FC46320_113c,
} from './k2-w3b2-113c.ts'
import {
  MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c,
  MONUMOD_EventScarabChargedBoltsWrapper_6FC468C0_113c,
} from './k2-w4b1-113c.ts'
import {
  MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c,
  MONUMOD_SpectralHitMissileDamage_6FC43650_113c,
  OBJ_DropChestLootFromObjectUnit_6FC8B6F0_113c,
} from './k2-w4b3-113c.ts'
import { SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c } from './k2-w5b2-113c.ts'
import { MONUMOD_OnHitApplyCursedAmplifyDamage_6FC44250_113c } from './k2-w6b1-113c.ts'
import { MONSTER_ApplyDeathExplosionSplashDamage_6FC44300_113c } from './k2-w6b4-113c.ts'
import {
  MISSILE_SplitForkedProjectilesOnTarget_6FC45AD0_113c,
  MONSTER_OnDeathCorpseExplosionScaledByMonLvl_6FC466B0_113c,
  MONSTER_OnDeathBossSpecialEffect_6FC45E60_113c,
  MONSTER_OnDeathSpawnFireExplosion75_6FC465E0_113c,
  MONSTER_OnDeathSpawnPoisonCloud_6FC46230_113c,
  MONSTER_OnDeathSuicideMinionExplosion_6FC457D0_113c,
} from './k2-w7b1-113c.ts'
import { ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c } from './k2-w7b3-113c.ts'
import {
  MONUMOD_Event07_KillOrUnsummonUnit_6FC43440_113c,
  MONUMOD_KnockBeltPotionToGround_6FC44440_113c,
} from './k2-w8b1-113c.ts'
import {
  AI_MapAiAction1_WalkToWaypoint113c,
  AI_MapAiAction2_WalkAndWait20_113c,
  AI_MapAiAction3_WalkToWaypoint113c,
  AI_MapAiAction4_WalkAndMode8_113c,
  AI_MapAiAction5_WalkAndMode9_113c,
} from './town-npc-ai-113c.ts'
import {
  MONSTER_DispatchEvent113c,
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
  type MonsterEventCallbacks113c,
} from './monster-events.ts'
import { REGPOP_CanSpawnPresetMinionPack113c } from './k2-sunit-spawn-w1-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_SpawnAtCoords113c,
  MONSTATS2_CheckFlagBit113c,
  MONSTATS_GetRecordPtr113c,
  MONSTATS_ValidateClassId113c,
  QUEST_Act4DiabloSealCheck113c,
  REGPOP_FindPackSpawnCoords113c,
  SUNIT_AllocUnitData113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c.ts'
import {
  EVENT_FLAG_DEFERRED_FREE,
  EVENT_FLAG_FIRING,
  EVENT_FreeNode113c,
  EVENT_SetEventFull113c,
} from './timer-wheel.ts'
import { NET_QueuePacketPtrToClient113c } from '../net/packet-sink.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

/** Scratch stack region for local structs/buffers in boot/init gap functions. */
let bootInitGapStackPtr = 0x7fb00000

/** `D2Game.dll` `.rdata` table `dword[9]` at `0x6FD1BBF0` used by `MONSTER_GetHirelingLevelBonusFactor113c`. */
export const HIRELING_BONUS_TABLE_6FD1BBF0: readonly number[] = [0, 0, 8, 16, 24, 32, 40, 48, 56]

/** `D2Game.dll` `.data` pointer `gpPerfTickRateArray` at `0x6FD27D30`. */
export const D2GAME_PERF_TICK_ARRAY_PTR_VA_113C = 0x6fd27d30
/** `D2Game.dll` `.bss` accumulator `gdwTotalMemPoolBytes` at `0x6FD4DC28`. */
export const D2GAME_TOTAL_MEMPOOL_BYTES_VA_113C = 0x6fd4dc28
/** `D2Game.dll` `.data` flag `gbDisableClientTimeout` at `0x6FD286A0`. */
export const D2GAME_DISABLE_CLIENT_TIMEOUT_VA_113C = 0x6fd286a0
/** `D2Game.dll` `.data` minion component callback table ptr (`0x6FD27D14`) and count (`0x6FD2A7E0`). */
export const D2GAME_MINION_COMP_TABLE_PTR_VA_113C = 0x6fd27d14
export const D2GAME_MINION_COMP_COUNT_VA_113C = 0x6fd2a7e0

/** Optional external hooks for callees outside the 36 target VAs. */
export interface BootInitGapACallees113c {
  readonly regpop?: RegpopSpawnHooks113c
  readonly monsterEvents?: MonsterEventCallbacks113c
  readonly spawnRestoredBossOrMinion?: (
    m: Memory113c,
    pGame: number,
    pRoom: number,
    pRec: number,
  ) => void
  readonly relocateRestoredUnit?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    x: number,
    y: number,
    pRoom: number,
  ) => void
  readonly deleteRestoredUnit?: (m: Memory113c, pGame: number, pUnit: number) => void
  readonly postRestoreMonsterHook?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    pRec: number,
    bDead: number,
  ) => void
  readonly onComponentCallback?: (
    m: Memory113c,
    pfn: number,
    pGame: number,
    pUnit: number,
    pNode: number,
    bFlag: number,
  ) => void
  readonly onComponentFree?: (
    m: Memory113c,
    pfnFree: number,
    pGame: number,
    pUnit: number,
    pNode: number,
  ) => void
  readonly getTickCountMs?: (m: Memory113c) => number
  readonly getClientPartyId?: (m: Memory113c, pUnit: number) => number
  readonly syncPlayerPartyRelations?: (
    m: Memory113c,
    pGame: number,
    pNewClient: number,
    pOtherClient: number,
  ) => void
  readonly sendCorpseSyncPacket?: (
    m: Memory113c,
    pClient: number,
    dwPlayerId: number,
    dwCorpseId: number,
  ) => void
  readonly onPostClientJoinSync?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    pUnit: number,
  ) => void
  readonly checkAct2EclipseQuest?: (m: Memory113c, pGame: number) => number
  readonly disconnectClient?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    nReason: number,
  ) => void
  readonly stepPlayerClientTick?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    pClient: number,
  ) => void
  readonly stepJoinState1Or2?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    dwTickMs: number,
  ) => number
  readonly stepJoinState3Ready?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    dwTickMs: number,
  ) => number
  readonly onEnterGame?: (
    m: Memory113c,
    wGameId: number,
    szCharName: number,
    dwClassId: number,
    dwLevel: number,
    wClientFlag0A: number,
  ) => void
  readonly spawnSuperUniqueById?: (
    m: Memory113c,
    pGame: number,
    pRoom: number,
    x: number,
    y: number,
    nSuperUniqueId: number,
  ) => number
  readonly pickEvilUrnMonsterClassId?: (
    m: Memory113c,
    pGame: number,
    pRoom: number,
    pMonReg: number,
  ) => number
  readonly spawnPresetPack?: (
    m: Memory113c,
    pGame: number,
    pRoom: number,
    nClassId: number,
    x: number,
    y: number,
    bFlag1: number,
  ) => number
  readonly getQuestDescriptor?: (m: Memory113c, pGame: number, nQuestId: number) => number
  readonly onObjectQuestSync?: (
    m: Memory113c,
    pGame: number,
    pObject: number,
    pClient: number,
  ) => void
  readonly onStatModifiedNotify?: (
    m: Memory113c,
    pUnit: number,
    nStatId: number,
    nVal: number,
    pClient: number,
  ) => void
  readonly sendLifeManaStaminaPacket?: (
    m: Memory113c,
    pClient: number,
    pUnit: number,
    curLife: number,
    curMana: number,
    curStamina: number,
  ) => void
  readonly syncPlayerMode?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    pUnit: number,
  ) => void
  readonly sendUnitEventSound?: (
    m: Memory113c,
    pClient: number,
    pUnit: number,
    wSound: number,
  ) => void
  readonly syncUnitFlag8000?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    pUnit: number,
  ) => void
  readonly sendUnitUpdateFlagsPacket?: (
    m: Memory113c,
    pClient: number,
    pUnit: number,
  ) => void
  readonly onNotifyOpcode?: (
    m: Memory113c,
    opcode: number,
    pClient: number,
    pUnit: number,
    pNode: number,
  ) => void
  readonly onUnitFullSyncPreSwitch?: (
    m: Memory113c,
    dwUnitType: number,
    pClient: number,
    pUnit: number,
    dwFlags: number,
  ) => void
  readonly onUnitFullSyncPostSwitch?: (
    m: Memory113c,
    dwUnitType: number,
    pClient: number,
    pUnit: number,
    dwFlags: number,
  ) => void
  readonly clientRoomOpts?: ClientsUpdatePlayerRoomOpts113c
  readonly allowZeroHandler?: boolean
  readonly dispatchPlayerEvent?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
    node?: number,
  ) => void
  readonly dispatchMonsterEvent?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
    node?: number,
  ) => void
  readonly dispatchObjectEvent?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
    node?: number,
  ) => void
  readonly dispatchMissileEvent?: (
    m: Memory113c,
    pfnHandler: number,
    pGame: number,
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
    node?: number,
  ) => void
  readonly dispatchItemEvent?: (
    m: Memory113c,
    pfnHandler: number,
    pGame: number,
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
    node?: number,
  ) => void
}

/** `Fog.#10046` (`D2FreePoolMem`): pool free is a no-op on sparse/bump memory. */
function fogFreeMemPool113c(_m: Memory113c, _ptr: number): void {}

/** Reads a signed 16-bit integer (`int16_t`) from `Memory113c`. */
function readI16(m: Memory113c, p: number): number {
  return (m.u16(p >>> 0) << 16) >> 16
}

/** `Fog.#10126`: initializes `D2BitBufferStrc` (`20 B`) for `pBuffer`/`nBytes`. */
function fogInitBitBuffer113c(
  m: Memory113c,
  pBitStream: number,
  pBuffer: number,
  nBytes: number,
): void {
  const bs = pBitStream >>> 0
  m.setU32(bs, pBuffer >>> 0)
  m.setU32((bs + 0x04) >>> 0, ((nBytes | 0) << 3) >>> 0)
  m.setU32((bs + 0x08) >>> 0, 0)
  m.setU32((bs + 0x0c) >>> 0, 0)
  m.setU32((bs + 0x10) >>> 0, 0)
}

/** `Fog.#10127`: returns current serialized byte count `nPos + (nPosBits !== 0 ? 1 : 0)`. */
function fogGetBitBufferSize113c(m: Memory113c, pBitStream: number): number {
  const bs = pBitStream >>> 0
  const nPos = m.u32((bs + 0x08) >>> 0) | 0
  return m.u32((bs + 0x0c) >>> 0) !== 0 ? (nPos + 1) | 0 : nPos
}

/** `Fog.#10128`: writes `nBits` of `nValue` into `D2BitBufferStrc` (`pBitStream`). */
function fogWriteBits113c(m: Memory113c, pBitStream: number, nValue: number, nBits: number): void {
  const esi = pBitStream >>> 0
  const ecx = m.u32((esi + 0x0c) >>> 0) | 0
  const edx = m.u32((esi + 0x08) >>> 0) | 0
  const eax = m.u32((esi + 0x04) >>> 0) | 0
  let ebp = nBits | 0
  const newBitTotal = (ecx + (edx << 3) + ebp) | 0
  if (newBitTotal > eax) {
    m.setU32((esi + 0x10) >>> 0, 1)
    m.setU32((esi + 0x08) >>> 0, sar32((eax + ((eax >> 31) & 7)) | 0, 3) >>> 0)
    m.setU32((esi + 0x0c) >>> 0, 0)
    return
  }
  if (ecx === 0) {
    m.setU8(m.u32((esi + 0x00) >>> 0), 0)
  }
  if (ebp <= 0) return
  let ebx = nValue | 0
  while (ebp > 0) {
    const curBit = m.u32((esi + 0x0c) >>> 0) | 0
    let chunk = (8 - curBit) | 0
    if (chunk > ebp) chunk = ebp
    const mask = ((1 << chunk) - 1) & 0xff
    const edi = m.u32((esi + 0x00) >>> 0)
    const dl = ((ebx & mask) << (curBit & 31)) & 0xff
    m.setU8(edi, (m.u8(edi) | dl) & 0xff)
    const nextBit = (curBit + chunk) | 0
    m.setU32((esi + 0x0c) >>> 0, nextBit >>> 0)
    if (nextBit === 8) {
      const newBuf = (m.u32((esi + 0x00) >>> 0) + 1) >>> 0
      const newPos = (m.u32((esi + 0x08) >>> 0) + 1) | 0
      const maxBits = m.u32((esi + 0x04) >>> 0) | 0
      m.setU32((esi + 0x08) >>> 0, newPos >>> 0)
      m.setU32((esi + 0x00) >>> 0, newBuf)
      m.setU32((esi + 0x0c) >>> 0, 0)
      if ((newPos << 3) < maxBits) {
        m.setU8(newBuf, 0)
      }
    }
    ebp = (ebp - chunk) | 0
    ebx = sar32(ebx, chunk & 31)
  }
}

/** `Fog.#10252`: returns lowest set bit index `0..31` of `mask`, or `-1` when `mask == 0`. */
function fogBitScanForward113c(mask: number): number {
  const v = mask >>> 0
  if (v === 0) return -1
  const lowest = (v & -v) >>> 0
  return (31 - Math.clz32(lowest)) | 0
}

/** `Storm.#501` (`SStrCopy`): copies up to `maxLen - 1` bytes and null-terminates `dst`. */
function stormStrCopy113c(m: Memory113c, dst: number, src: number, maxLen: number): number {
  const limit = maxLen | 0
  if (limit <= 0 || dst === 0) return 0
  let i = 0
  if (src !== 0) {
    for (; i < limit - 1; i++) {
      const ch = m.u8((src + i) >>> 0)
      if (ch === 0) break
      m.setU8((dst + i) >>> 0, ch)
    }
  }
  m.setU8((dst + i) >>> 0, 0)
  return i
}

/** `D2Game` `seedRoll` on an in-memory `D2SeedStrc`. */
function seedRollMem113c(m: Memory113c, pSeed: number, nMax: number): number {
  const seed = { lo: m.u32(pSeed >>> 0) >>> 0, hi: m.u32((pSeed + 4) >>> 0) >>> 0 }
  const r = seedRoll(seed, nMax)
  m.setU32((pSeed + 4) >>> 0, seed.hi >>> 0)
  m.setU32(pSeed >>> 0, seed.lo >>> 0)
  return r
}

/**
 * Checks whether an object in `pRoom` should respawn or block room deactivation due to an active portal.
 *
 * @va D2Game:0x6FC2BD10
 */
export function OBJECT_CheckRespawnOrPortalInRoom113c(
  m: Memory113c,
  pUnit: number,
  pRoom: number,
): number {
  hitD2GameVa113c(0x6FC2BD10)
  if (pUnit === 0 || pRoom === 0) return 1
  if (m.u32((pUnit + 0x10) >>> 0) !== 2) return 1
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) return 1

  const nClassId = pUnit !== 0 ? m.u32((pUnit + 0x04) >>> 0) | 0 : -1
  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nClassId) >>> 0
  if (pObjTxt === 0) {
    throw new Error('OBJECT_CheckRespawnOrPortalInRoom113c: pObjTxt == NULL (line 620)')
  }

  const isRespawnableShrineOrWell =
    nClassId > 0x132
      ? nClassId === 0x18e
      : nClassId >= 0x130 || nClassId === 0x18 || nClassId === 0x9c

  if (isRespawnableShrineOrWell) {
    const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
    if (m.u8((pGame + 0x6d) >>> 0) >= 3) return 1
    const dwRespawnFrame = m.u32((pUnit + 0x7c) >>> 0) >>> 0
    const dwGameFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
    if (dwRespawnFrame >= dwGameFrame) {
      UNITS_ChangeAnimMode113c(m, pUnit, 0)
      const dwNewFrame = (((m.u32((pObjTxt + 0xac) >>> 0) | 0) >> 8) + (dwGameFrame | 0)) >>> 0
      EVENT_SetEventFull113c(m, pGame, pUnit, 5, dwNewFrame, 0, 0, 0)
      return 1
    }
  }

  if (nClassId !== 0x3c) return 1
  const pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if ((m.u8((pObjData + 0x04) >>> 0) & 3) !== 1) return 1
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pUnitRoom = pPath !== 0 ? m.u32((pPath + 0x1c) >>> 0) >>> 0 : 0
  return pUnitRoom === (pRoom >>> 0) ? 0 : 1
}

function relocateRestoredServerUnit113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pRoom: number,
  posX: number,
  posY: number,
): void {
  if (pUnit === 0 || pRoom === 0) return
  const uType = m.u32(pUnit >>> 0) >>> 0
  const pPathExisting = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pUnitData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if (
    pGame !== 0 &&
    pPathExisting !== 0 &&
    pUnitData !== 0 &&
    (uType !== 4 || m.u32((pUnit + 0x10) >>> 0) === 3) &&
    m.u32((pGame + 0xbc) >>> 0) !== 0
  ) {
    SUNIT_PlaceUnitAtRoomAndCoords_6FD00D00_113c(
      m as SparseMemory113c,
      posY,
      pRoom,
      pUnit,
      pGame,
      posX,
    )
    if (m.u32((pRoom + 0x74) >>> 0) !== 0) return
  }

  let pPath = pPathExisting
  if (uType === 0 || uType === 1 || uType === 3) {
    if (pPath === 0) {
      pPath = m.alloc(0x200) >>> 0
      m.setU32((pUnit + 0x2c) >>> 0, pPath)
      m.setU32((pPath + 0x50) >>> 0, pUnit >>> 0)
    }
    m.setU16((pPath + 0x02) >>> 0, posX & 0xffff)
    m.setU16((pPath + 0x06) >>> 0, posY & 0xffff)
    m.setU16((pPath + 0x10) >>> 0, posX & 0xffff)
    m.setU16((pPath + 0x12) >>> 0, posY & 0xffff)
    m.setU32((pPath + 0x1c) >>> 0, pRoom >>> 0)
  } else {
    if (pPath === 0) {
      pPath = m.alloc(0x14) >>> 0
      m.setU32((pUnit + 0x2c) >>> 0, pPath)
    }
    m.setU32(pPath, pRoom >>> 0)
    m.setU32((pPath + 0x04) >>> 0, posX >>> 0)
    m.setU32((pPath + 0x08) >>> 0, posY >>> 0)
    m.setU32((pPath + 0x0c) >>> 0, posX >>> 0)
    m.setU32((pPath + 0x10) >>> 0, posY >>> 0)
  }
  let inList = false
  let cur = m.u32((pRoom + 0x74) >>> 0) >>> 0
  while (cur !== 0) {
    if (cur === (pUnit >>> 0)) {
      inList = true
      break
    }
    cur = m.u32((cur + 0xe8) >>> 0) >>> 0
  }
  if (!inList) {
    m.setU32((pUnit + 0xe8) >>> 0, m.u32((pRoom + 0x74) >>> 0) >>> 0)
    m.setU32((pRoom + 0x74) >>> 0, pUnit >>> 0)
  }
}

/**
 * Finds (or allocates when `bAlloc != 0`) the `0x18`-byte inactive room save node at
 * `[pGame + (nAct & 0xFF) * 4 + 0xD8]` matching `(roomX, roomY)` (sorted descending by `roomX`).
 *
 * @va D2Game:0x6FC3E960
 */
export function MONREG_FindOrAllocActRoomNode113c(
  m: Memory113c,
  pGame: number,
  nAct: number,
  roomX: number,
  roomY: number,
  bAlloc: number,
): number {
  hitD2GameVa113c(0x6FC3E960)
  if (pGame === 0) return 0
  const actIdx = nAct & 0xff
  if (actIdx >= 5) return 0
  const headAddr = (pGame + actIdx * 4 + 0xd8) >>> 0
  let pCur = m.u32(headAddr) >>> 0
  let pPrev = 0
  let found = 0
  const targetX = roomX | 0
  const targetY = roomY | 0
  while (pCur !== 0) {
    const curX = m.u32(pCur) | 0
    if (targetX === curX && targetY === (m.u32((pCur + 0x04) >>> 0) | 0)) {
      found = 1
      break
    }
    if (targetX > curX) {
      break
    }
    pPrev = pCur
    pCur = m.u32((pCur + 0x14) >>> 0) >>> 0
  }

  if (bAlloc === 0) {
    return found !== 0 ? pCur : 0
  }
  if (found !== 0) {
    return pCur
  }

  const pNew = m.alloc(0x18) >>> 0
  m.setU32(pNew, targetX >>> 0)
  m.setU32((pNew + 0x04) >>> 0, targetY >>> 0)
  m.setU32((pNew + 0x08) >>> 0, 0)
  m.setU32((pNew + 0x0c) >>> 0, 0)
  m.setU32((pNew + 0x10) >>> 0, 0)
  m.setU32((pNew + 0x14) >>> 0, pCur)
  if (pPrev !== 0) {
    m.setU32((pPrev + 0x14) >>> 0, pNew)
  } else {
    m.setU32(headAddr, pNew)
  }
  return pNew
}

/**
 * Unlinks the `0x18`-byte inactive room node for `pRoom` from `[pGame + nAct * 4 + 0xD8]`,
 * writes `*ppOutUnits = [pNode + 0x10]` and `*ppOutItems = [pNode + 0x08]`, and frees `pNode`.
 *
 * @va D2Game:0x6FC3EA40
 */
export function MONREG_UnlinkAndFreeActRoomNode113c(
  m: Memory113c,
  pRoom: number,
  pGame: number,
  ppOutUnits: number,
  ppOutItems: number,
): void {
  hitD2GameVa113c(0x6FC3EA40)
  if (ppOutUnits !== 0) m.setU32(ppOutUnits >>> 0, 0)
  if (ppOutItems !== 0) m.setU32(ppOutItems >>> 0, 0)
  if (pRoom === 0 || pGame === 0) return

  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (nAct >= 5) return

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x20) >>> 0
  let roomX = 0
  let roomY = 0
  try {
    DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
    roomX = m.u32(sp) | 0
    roomY = m.u32((sp + 0x04) >>> 0) | 0
  } finally {
    bootInitGapStackPtr = sp
  }

  const headAddr = (pGame + nAct * 4 + 0xd8) >>> 0
  let pPrev = 0
  let pCur = m.u32(headAddr) >>> 0
  while (pCur !== 0) {
    const curX = m.u32(pCur) | 0
    if (roomX > curX) return
    if (roomX === curX && roomY === (m.u32((pCur + 0x04) >>> 0) | 0)) {
      const pNext = m.u32((pCur + 0x14) >>> 0) >>> 0
      if (pPrev !== 0) {
        m.setU32((pPrev + 0x14) >>> 0, pNext)
      } else {
        m.setU32(headAddr, pNext)
      }
      if (ppOutUnits !== 0) {
        m.setU32(ppOutUnits >>> 0, m.u32((pCur + 0x10) >>> 0) >>> 0)
      }
      if (ppOutItems !== 0) {
        m.setU32(ppOutItems >>> 0, m.u32((pCur + 0x08) >>> 0) >>> 0)
      }
      fogFreeMemPool113c(m, pCur)
      return
    }
    pPrev = pCur
    pCur = m.u32((pCur + 0x14) >>> 0) >>> 0
  }
}

/**
 * Walks saved ground-item nodes starting at `pSavedItems` (next at `+0x00`), restores non-expired
 * items (`dwExpireFrame == 0 || dwGameFrame <= dwExpireFrame`) into `pRoom`, and frees each node.
 *
 * @va D2Game:0x6FC3FB40
 */
export function MONREG_FlushAndFreePendingSpawnNodes113c(
  m: Memory113c,
  pSavedItems: number,
  pGame: number,
  pRoom: number,
): void {
  hitD2GameVa113c(0x6FC3FB40)
  if (pSavedItems === 0) return
  const curGameFrame = pGame !== 0 ? (m.u32((pGame + 0xa8) >>> 0) | 0) : 0
  let pCur = pSavedItems >>> 0
  while (pCur !== 0) {
    const pNext = m.u32(pCur) >>> 0
    const dwExpireFrame = m.u32((pCur + 0x04) >>> 0) | 0
    if (dwExpireFrame === 0 || curGameFrame <= dwExpireFrame) {
      const savedItemGuid = m.u32((pCur + 0x08) >>> 0) >>> 0
      if (savedItemGuid !== 0 && pGame !== 0 && pRoom !== 0) {
        const pItem = SUNIT_GetServerUnit113c(m, pGame, 4, savedItemGuid) >>> 0
        if (pItem !== 0) {
          const itemX = m.u16((pCur + 0x0c) >>> 0)
          const itemY = m.u16((pCur + 0x0e) >>> 0)
          relocateRestoredServerUnit113c(m, pGame, pItem, pRoom, itemX, itemY)
        }
      }
    }
    fogFreeMemPool113c(m, pCur)
    pCur = pNext
  }
}

/**
 * Restores saved `0x5C`-byte monster nodes from `[pRoomNode + 0x0C]` for `(pGame, pRoom)` (`0x6FC3FB90`),
 * querying `MONREG_FindOrAllocActRoomNode113c(m, pGame, nAct, roomX, roomY, 0)` and checking Chaos Sanctuary seals.
 *
 * @va D2Game:0x6FC3FB90
 */
export function MONREG_RestoreRoomMonstersFromNode113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC3FB90)
  if (pGame === 0 || pRoom === 0) return

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  try {
    DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
    const roomX = m.u32(sp) | 0
    const roomY = m.u32((sp + 0x04) >>> 0) | 0
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
    const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
    const pRoomNode = MONREG_FindOrAllocActRoomNode113c(m, pGame, nAct, roomX, roomY, 0)
    if (pRoomNode === 0) return

    let pMon = m.u32((pRoomNode + 0x0c) >>> 0) >>> 0
    m.setU32((pRoomNode + 0x0c) >>> 0, 0)
    let bChaosSealsCleared = 0
    if (DUNGEON_GetLevelIdFromRoom113c(m, pRoom) === 0x6c) {
      if (QUEST_Act4DiabloSealCheck113c(m, pGame) !== 0) {
        bChaosSealsCleared = 1
      }
    }
    if (pMon === 0) return

    const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
    const hooks = callees !== undefined && callees.regpop !== undefined ? callees.regpop : {}
    while (pMon !== 0) {
      const pNext = m.u32((pMon + 0x58) >>> 0) >>> 0
      const posX = m.u32(pMon) | 0
      const posY = m.u32((pMon + 0x04) >>> 0) | 0
      const nClassId = m.u32((pMon + 0x08) >>> 0) | 0
      const dwSavedGuid = m.u32((pMon + 0x0c) >>> 0) >>> 0
      const dwFlags10 = m.u32((pMon + 0x10) >>> 0) >>> 0
      const dwFlags14 = m.u32((pMon + 0x14) >>> 0) >>> 0
      const dwFlags18 = m.u32((pMon + 0x18) >>> 0) >>> 0
      const nAnimMode = (dwFlags18 & 0x04) !== 0 ? 0x0c : 1

      if (nAnimMode !== 0x0c && bChaosSealsCleared !== 0 && nClassId !== 0xf3) {
        const pSaveBlockSkip = m.u32((pMon + 0x24) >>> 0) >>> 0
        if (pSaveBlockSkip !== 0) {
          DRLGPRESET_FreeSaveHeaderBlock113c(m, pMemPool, (pMon + 0x24) >>> 0)
        }
        fogFreeMemPool113c(m, pMon)
        pMon = pNext
        continue
      }

      if ((dwFlags14 & 0x0100) !== 0) {
        const pExisting = SUNIT_GetServerUnit113c(m, pGame, 1, dwSavedGuid) >>> 0
        if (pExisting !== 0) {
          relocateRestoredServerUnit113c(m, pGame, pExisting, pRoom, posX, posY)
        }
        let pExtra = m.u32((pMon + 0x20) >>> 0) >>> 0
        while (pExtra !== 0) {
          const pExtraNext = m.u32((pExtra + 0x04) >>> 0) >>> 0
          fogFreeMemPool113c(m, pExtra)
          pExtra = pExtraNext
        }
      } else {
        const skipBoss =
          (dwFlags18 & 0x0400) !== 0 && ((dwFlags18 & 0x0100) !== 0 || (dwFlags18 & 0x80) !== 0)
        if (!skipBoss) {
          const wSpawnFlags = (dwFlags18 & 0x40) !== 0 ? 0x6a : 0x62
          let pSpawned = MONSTER_SpawnAtCoords113c(
            m,
            nClassId,
            nAnimMode,
            pGame,
            pRoom,
            posX,
            posY,
            -1,
            wSpawnFlags,
            hooks,
          )
          if (pSpawned === 0) {
            pSpawned = MONSTER_SpawnAtCoords113c(
              m,
              nClassId,
              nAnimMode,
              pGame,
              pRoom,
              posX,
              posY,
              5,
              wSpawnFlags,
              hooks,
            )
          }
          if (pSpawned !== 0) {
            const savedExp = m.u32((pMon + 0x40) >>> 0) | 0
            const savedMaxHp = m.u32((pMon + 0x44) >>> 0) | 0
            const savedCurHp = m.u32((pMon + 0x48) >>> 0) | 0
            const savedFrame = m.u32((pMon + 0x54) >>> 0) >>> 0
            const curGameFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
            STATLIST_SetUnitStat113c(m, pSpawned, 0x0d, savedExp, 0)
            if (savedMaxHp > 0) {
              STATLIST_SetUnitStat113c(m, pSpawned, 0x07, savedMaxHp, 0)
              const restoredHp =
                ((curGameFrame - savedFrame) >>> 0) >= 0x1d4c ? savedMaxHp : savedCurHp
              STATLIST_SetUnitStat113c(m, pSpawned, 0x06, restoredHp, 0)
            }
            const pMonData = m.u32((pSpawned + 0x14) >>> 0) >>> 0
            if (pMonData !== 0) {
              for (let k = 0; k < 9; k++) {
                m.setU8((pMonData + 0x1c + k) >>> 0, m.u8((pMon + 0x32 + k) >>> 0))
              }
            }
            if ((dwFlags14 & 0x0200) !== 0) {
              m.setU32((pSpawned + 0xc8) >>> 0, (m.u32((pSpawned + 0xc8) >>> 0) | 0x0200) >>> 0)
            }
            const curUnitFlags = m.u32((pSpawned + 0xc4) >>> 0) >>> 0
            m.setU32(
              (pSpawned + 0xc4) >>> 0,
              (curUnitFlags | (dwFlags10 & 0x20000) | 0x03000000) >>> 0,
            )
          }
        }
      }

      const pSaveDesc = m.u32((pMon + 0x24) >>> 0) >>> 0
      if (pSaveDesc !== 0) {
        DRLGPRESET_FreeSaveHeaderBlock113c(m, pMemPool, (pMon + 0x24) >>> 0)
      }
      fogFreeMemPool113c(m, pMon)
      pMon = pNext
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Pops all queued AI commands on `pMonster->pMonsterData->pAiGeneral`.
 *
 * @va D2Game:0x6FC41420
 */
export function AIGENERAL_FlushAllAiCommands113c(
  m: Memory113c,
  _pGame: number,
  pMonster: number,
): void {
  hitD2GameVa113c(0x6FC41420)
  if (pMonster === 0) return
  if (m.u32(pMonster >>> 0) !== 1) return
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
  if (pAiGeneral === 0) return
  while (m.u32((pAiGeneral + 0x24) >>> 0) !== 0 && m.u32((pAiGeneral + 0x20) >>> 0) !== 0) {
    AIGENERAL_PopAiCommand113c(m, pMonster)
  }
}

/**
 * `D2Game.dll` `.data` `0x6FD2F448`: `uint32[44][6]` `MonUMod` event callback table
 * (`uModId * 6 + slot`).
 */
export const MONUMOD_CALLBACK_TABLE_6FD2F448: readonly number[] = [
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x6fc44250, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc41bb0, 0x6fc466b0, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc41a90, 0x6fc46230, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x6fc418a0, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc43bf0, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc41ad0, 0x6fc46320, 0x00000000, 0x6fc468c0, 0x00000000,
  0x00000000, 0x6fc41a90, 0x6fc462d0, 0x00000000, 0x00000000, 0x00000000,
  0x6fc41b30, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x6fc43670,
  0x00000000, 0x6fc41b00, 0x6fc460d0, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x6fc43440, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc45e60, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x6fc45cc0, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x6fc44440, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x6fc42b60, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x6fc43650,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x6fc45ad0,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc41a90, 0x6fc465e0, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc41a90, 0x6fc44300, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc43390, 0x6fc457d0, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc43570, 0x6fc43e20, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc41a70, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc42b10, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x6fc43320, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc41a90, 0x6fc46520, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc36970, 0x6fc39bb0, 0x6fc39ba0, 0x6fc39ad0, 0x6fc39a00,
]

function dispatchMonUModCallback113c(
  m: Memory113c,
  pfn: number,
  pGame: number,
  pEdxUnit: number,
  uModId: number,
  isUnique: number,
): void {
  const sm = m as SparseMemory113c
  switch (pfn >>> 0) {
    case 0x6fc36970:
      AI_MapAiAction1_WalkToWaypoint113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc39a00:
      AI_MapAiAction5_WalkAndMode9_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc39ad0:
      AI_MapAiAction4_WalkAndMode8_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc39ba0:
      AI_MapAiAction3_WalkToWaypoint113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc39bb0:
      AI_MapAiAction2_WalkAndWait20_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc418a0:
      MONUMOD_ApplyChampionBaseStats_6FC418A0_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc41a70:
      MONUMOD_SetShatterOnDeath_6FC41A70_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc41a90:
      MONUMOD_ScheduleDeathEvent4UnlessMod18_6FC41A90_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc41ad0:
      MONUMOD_ScheduleGetHitEvent2ForUnique_6FC41AD0_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc41b00:
      MONUMOD_ScheduleGetHitOrDeathEvent2_6FC41B00_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc41b30:
      MONUMOD_AddSecondaryDamageToBaseStats_6FC41B30_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc41bb0:
      MONUMOD_ScheduleDeathEvent4ForUnique_6FC41BB0_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc42b10:
      MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc42b60:
      MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc43320:
      MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc43390:
      MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc43440:
      MONUMOD_Event07_KillOrUnsummonUnit_6FC43440_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc43570:
      MONUMOD_RollSelfResurrectEvent7_6FC43570_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc43650:
      MONUMOD_SpectralHitMissileDamage_6FC43650_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc43670:
      MONUMOD_AddRogueOwnerSecondaryDamageToMissile_6FC43670_113c(
        m,
        pGame,
        pEdxUnit,
        uModId,
        isUnique,
      )
      break
    case 0x6fc43bf0:
      MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc43e20:
      MONUMOD_EventReviveOrCorpseCheck_6FC43E20_113c(sm, pGame, pEdxUnit)
      break
    case 0x6fc44250:
      MONUMOD_OnHitApplyCursedAmplifyDamage_6FC44250_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc44300:
      MONSTER_ApplyDeathExplosionSplashDamage_6FC44300_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc44440:
      MONUMOD_KnockBeltPotionToGround_6FC44440_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc457d0:
      MONSTER_OnDeathSuicideMinionExplosion_6FC457D0_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc45ad0:
      MISSILE_SplitForkedProjectilesOnTarget_6FC45AD0_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc45cc0:
      MONUMOD_SpawnLightningEnchantedBolts_6FC45CC0_113c(sm, pGame, pEdxUnit)
      break
    case 0x6fc45e60:
      MONSTER_OnDeathBossSpecialEffect_6FC45E60_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc460d0:
      MONUMOD_SpawnFireEnchantedBolts_6FC460D0_113c(sm, pGame, pEdxUnit)
      break
    case 0x6fc46230:
      MONSTER_OnDeathSpawnPoisonCloud_6FC46230_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc462d0:
      MONUMOD_SpawnColdEnchantedFrostNova_6FC462D0_113c(sm, pGame, pEdxUnit)
      break
    case 0x6fc46320:
      MONUMOD_SpawnScarabChargedBolts_6FC46320_113c(sm, pGame, pEdxUnit)
      break
    case 0x6fc46520:
      MONUMOD_SpawnDeathNova_6FC46520_113c(sm, pGame, pEdxUnit, 0, uModId, isUnique)
      break
    case 0x6fc465e0:
      MONSTER_OnDeathSpawnFireExplosion75_6FC465E0_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc466b0:
      MONSTER_OnDeathCorpseExplosionScaledByMonLvl_6FC466B0_113c(
        sm,
        pGame,
        pEdxUnit,
        uModId,
        isUnique,
      )
      break
    case 0x6fc468c0:
      MONUMOD_EventScarabChargedBoltsWrapper_6FC468C0_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    default:
      break
  }
}

/**
 * Walks `pUnit->pMonsterData->nMonUMod[0..8]` (`+0x1C`) and dispatches the `MonUMod` event
 * callback at `0x6FD2F448[uModId][nSlot]` (`ecx = pGame`, `edx = pUnit` or `pArg0` when `nSlot == 5`).
 *
 * @va D2Game:0x6FC468E0
 */
export function MONSTER_DispatchMinionComponentCallbacks113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  arg0OrSlot: number,
  slotOrCallees?: number | BootInitGapACallees113c,
  calleesArg?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC468E0)
  let pMonster = pUnit >>> 0
  let pArg0 = 0
  let slot = 0
  let callees: BootInitGapACallees113c | undefined

  if (typeof slotOrCallees === 'number') {
    pArg0 = arg0OrSlot >>> 0
    slot = slotOrCallees | 0
    callees = calleesArg
  } else {
    slot = arg0OrSlot | 0
    callees = slotOrCallees
    if (slot === 5 && pMonster !== 0 && m.u32(pMonster) === 3) {
      pArg0 = pMonster
      if ((m.u32((pArg0 + 0xc8) >>> 0) & 0x400) !== 0) {
        pMonster = SUNIT_GetServerUnit113c(
          m,
          pGame,
          m.u32((pArg0 + 0x94) >>> 0) | 0,
          m.u32((pArg0 + 0x98) >>> 0) | 0,
        ) >>> 0
      } else {
        pMonster = 0
      }
    }
  }

  let isUnique = 0
  if (pMonster !== 0 && m.u32(pMonster) === 1) {
    const pmd0 = m.u32((pMonster + 0x14) >>> 0) >>> 0
    if (pmd0 !== 0) {
      isUnique = (m.u8((pmd0 + 0x16) >>> 0) >>> 3) & 1
    }
  }
  if (pMonster === 0 || m.u32(pMonster) !== 1) return
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const pUMods = (pMonData + 0x1c) >>> 0
  if (pUMods === 0 || m.u8(pUMods) === 0) return

  if (slot === 5) {
    for (let i = 0; i < 9; i++) {
      const uModId = m.u8((pUMods + i) >>> 0)
      const tblIdx = imul32(uModId, 6) + 5
      const pfn =
        tblIdx >= 0 && tblIdx < MONUMOD_CALLBACK_TABLE_6FD2F448.length
          ? MONUMOD_CALLBACK_TABLE_6FD2F448[tblIdx]! >>> 0
          : 0
      if (pfn !== 0) {
        if (callees !== undefined && callees.onComponentCallback !== undefined) {
          callees.onComponentCallback(m, pfn, pGame, pArg0, uModId, isUnique)
        } else {
          dispatchMonUModCallback113c(m, pfn, pGame, pArg0, uModId, isUnique)
        }
      }
    }
    return
  }

  if (slot < 0 || slot >= 6) return
  for (let i = 0; i < 9; i++) {
    const uModId = m.u8((pUMods + i) >>> 0)
    const tblIdx = imul32(uModId, 6) + slot
    const pfn =
      tblIdx >= 0 && tblIdx < MONUMOD_CALLBACK_TABLE_6FD2F448.length
        ? MONUMOD_CALLBACK_TABLE_6FD2F448[tblIdx]! >>> 0
        : 0
    if (pfn !== 0) {
      if (callees !== undefined && callees.onComponentCallback !== undefined) {
        callees.onComponentCallback(m, pfn, pGame, pMonster, uModId, isUnique)
      } else {
        dispatchMonUModCallback113c(m, pfn, pGame, pMonster, uModId, isUnique)
      }
    }
  }
}

/**
 * Walks `pGame->pClientList` (`+0x88` along `+0x4A8`) and invokes `callback` for every client with `dwClientState == 4`.
 *
 * @va D2Game:0x6FC49820
 */
export function CLIENTS_ForEachInGameClient113c(
  m: Memory113c,
  pGame: number,
  pfnCallback: number,
  pContext: number,
  callback?: (m: Memory113c, pClient: number, pContext: number) => void,
): void {
  hitD2GameVa113c(0x6FC49820)
  if (pGame === 0) {
    throw new Error('CLIENTS_ForEachInGameClient113c: pGame == NULL (line 1231)')
  }
  if (pfnCallback === 0 && callback === undefined) {
    throw new Error('CLIENTS_ForEachInGameClient113c: pfnCallback == NULL (line 1232)')
  }
  let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
  while (pClient !== 0) {
    if (m.u32((pClient + 0x04) >>> 0) === 4) {
      if (callback !== undefined) {
        callback(m, pClient, pContext)
      }
    }
    pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
  }
}

/**
 * Updates `pGame` tick rate metrics (`+0xAC`, `+0xB0`, `+0xB4`) and optional performance array slot.
 *
 * @va D2Game:0x6FC49BE0
 */
export function GAME_UpdateTickRateMetrics113c(
  m: Memory113c,
  pGame: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC49BE0)
  let pPerfInfo = 0
  try {
    pPerfInfo = m.u32(D2GAME_PERF_TICK_ARRAY_PTR_VA_113C) >>> 0
  } catch {
    pPerfInfo = 0
  }
  const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
  let poolBytes = 0
  if (pMemPool !== 0) {
    try {
      poolBytes = m.u32((pMemPool + 0x17a8) >>> 0)
    } catch {
      poolBytes = 0
    }
  }
  let curTotalPool = 0
  try {
    curTotalPool = m.u32(D2GAME_TOTAL_MEMPOOL_BYTES_VA_113C) >>> 0
  } catch {
    curTotalPool = 0
  }
  m.setU32(
    D2GAME_TOTAL_MEMPOOL_BYTES_VA_113C,
    (curTotalPool + poolBytes) >>> 0,
  )

  const dwTickMs =
    callees !== undefined && callees.getTickCountMs !== undefined
      ? callees.getTickCountMs(m) >>> 0
      : m.u32((pGame + 0xac) >>> 0) >>> 0
  const deltaMs = (dwTickMs - m.u32((pGame + 0xac) >>> 0)) | 0
  if (deltaMs >= 1000) {
    const framesDelta = (m.u32((pGame + 0xa8) >>> 0) - m.u32((pGame + 0xb0) >>> 0)) | 0
    const rate = Math.trunc(imul32(framesDelta, 1000) / deltaMs) | 0
    m.setU32((pGame + 0xb4) >>> 0, rate >>> 0)
    m.setU32((pGame + 0xac) >>> 0, dwTickMs)
    m.setU32((pGame + 0xb0) >>> 0, m.u32((pGame + 0xa8) >>> 0))
  }
  if (pPerfInfo !== 0) {
    const idx = m.u16((pGame + 0x28) >>> 0)
    m.setU32((pPerfInfo + idx * 4) >>> 0, m.u32((pGame + 0xb4) >>> 0))
  }
}

/**
 * Every 128 frames (`(dwGameFrame & 0x7F) == 0`), expires ground items and minion lists in act `(dwGameFrame >> 7) % 5`.
 *
 * @va D2Game:0x6FC4C0F0
 */
export function GAME_ExpireItemsAndMinionListsPeriodic113c(
  m: Memory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC4C0F0)
  const dwFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
  if ((dwFrame & 0x7f) === 0) {
    const nAct = ((dwFrame >>> 7) % 5) >>> 0
    const pAct = m.u32((pGame + nAct * 4 + 0xbc) >>> 0) >>> 0
    if (pAct !== 0) {
      ITEMS_ExpireGroundItemsInAct113c(m, pGame, pAct)
      AIGENERAL_ExpireMinionListsInAct113c(m, pGame, pAct)
    }
  }
}

/**
 * Broadcasts `0x5B` player-in-game packets and corpse sync between `pNewClient` and all existing state-4 clients.
 *
 * @va D2Game:0x6FC4C120
 */
export function GAME_SyncNewClientWithExistingPlayers113c(
  m: Memory113c,
  pGame: number,
  pNewClient: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC4C120)
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x60) >>> 0
  const pktNew = sp
  const pktOther = (sp + 0x28) >>> 0
  try {
    m.fill(pktNew, 0x24, 0)
    const pNewUnit = m.u32((pNewClient + 0x174) >>> 0) >>> 0
    m.setU8(pktNew, 0x5b)
    m.setU16((pktNew + 1) >>> 0, 0x24)
    m.setU32((pktNew + 3) >>> 0, pNewUnit !== 0 ? m.u32((pNewUnit + 0x0c) >>> 0) : 0)
    m.setU8((pktNew + 7) >>> 0, m.u8((pNewClient + 0x0c) >>> 0))
    stormStrCopy113c(m, (pktNew + 8) >>> 0, (pNewClient + 0x0d) >>> 0, 0x10)
    const newLvl = pNewUnit !== 0 ? STATLIST_GetUnitStat113c(m, pNewUnit, 0x0c, 0) & 0xffff : 0
    m.setU16((pktNew + 0x18) >>> 0, newLvl)
    const newPartyId =
      callees !== undefined && callees.getClientPartyId !== undefined && pNewUnit !== 0
        ? callees.getClientPartyId(m, pNewUnit) & 0xffff
        : 0xffff
    m.setU16((pktNew + 0x1a) >>> 0, newPartyId)
    m.setU32((pktNew + 0x1c) >>> 0, 0)
    m.setU32((pktNew + 0x20) >>> 0, 0)

    let pOther = m.u32((pGame + 0x88) >>> 0) >>> 0
    while (pOther !== 0) {
      if (pOther !== (pNewClient >>> 0) && m.u32((pOther + 0x04) >>> 0) === 4) {
        NET_QueuePacketToClientBuffer113c(m, pOther, 1, pktNew, 0x24)

        const pOtherUnit = m.u32((pOther + 0x174) >>> 0) >>> 0
        m.fill(pktOther, 0x24, 0)
        m.setU8(pktOther, 0x5b)
        m.setU16((pktOther + 1) >>> 0, 0x24)
        m.setU32((pktOther + 3) >>> 0, pOtherUnit !== 0 ? m.u32((pOtherUnit + 0x0c) >>> 0) : 0)
        m.setU8((pktOther + 7) >>> 0, m.u8((pOther + 0x0c) >>> 0))
        stormStrCopy113c(m, (pktOther + 8) >>> 0, (pOther + 0x0d) >>> 0, 0x10)
        const otherLvl =
          pOtherUnit !== 0 ? STATLIST_GetUnitStat113c(m, pOtherUnit, 0x0c, 0) & 0xffff : 0
        m.setU16((pktOther + 0x18) >>> 0, otherLvl)
        const otherPartyId =
          callees !== undefined && callees.getClientPartyId !== undefined && pOtherUnit !== 0
            ? callees.getClientPartyId(m, pOtherUnit) & 0xffff
            : 0xffff
        m.setU16((pktOther + 0x1a) >>> 0, otherPartyId)
        m.setU32((pktOther + 0x1c) >>> 0, 0)
        m.setU32((pktOther + 0x20) >>> 0, 0)
        NET_QueuePacketToClientBuffer113c(m, pNewClient, 1, pktOther, 0x24)

        if (callees !== undefined && callees.syncPlayerPartyRelations !== undefined) {
          callees.syncPlayerPartyRelations(m, pGame, pNewClient, pOther)
        }

        if (pOtherUnit !== 0) {
          const pInv = m.u32((pOtherUnit + 0x60) >>> 0) >>> 0
          let pCorpse = INVENTORY_GetFirstCorpse113c(m, pInv) >>> 0
          while (pCorpse !== 0) {
            const dwCorpseUnitId = INVENTORY_GetCorpseUnitId113c(m, pCorpse)
            const pCorpseUnit = SUNIT_GetServerUnit113c(m, pGame, 0, dwCorpseUnitId)
            if (pCorpseUnit !== 0) {
              if (callees !== undefined && callees.sendCorpseSyncPacket !== undefined) {
                callees.sendCorpseSyncPacket(
                  m,
                  pNewClient,
                  m.u32((pOtherUnit + 0x0c) >>> 0),
                  m.u32((pCorpseUnit + 0x0c) >>> 0),
                )
              }
            }
            pCorpse = INVENTORY_GetNextCorpse113c(m, pCorpse) >>> 0
          }
        }
      }
      pOther = m.u32((pOther + 0x4a8) >>> 0) >>> 0
    }

    NET_QueuePacketToClientBuffer113c(m, pNewClient, 1, pktNew, 0x24)
    if (callees !== undefined && callees.onPostClientJoinSync !== undefined) {
      callees.onPostClientJoinSync(m, pGame, pNewClient, pNewUnit)
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Steps environment lighting cycles across all 5 acts and broadcasts `0x53` when any cycle or Act 2 eclipse state changes.
 *
 * @va D2Game:0x6FC4CA20
 */
export function GAME_StepActEnvironmentCycles113c(
  m: Memory113c,
  pGame: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC4CA20)
  if (pGame === 0) {
    throw new Error('GAME_StepActEnvironmentCycles113c: pGame == NULL (line 3058)')
  }
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  const pCycleIdx = sp
  const pTicks = (sp + 4) >>> 0
  const pEclipse = (sp + 8) >>> 0
  const pPkt53 = (sp + 0x10) >>> 0
  try {
    let bBroadcast53 = 0
    m.setU32(pCycleIdx, 0)
    m.setU32(pTicks, 0)
    m.setU32(pEclipse, 0)

    for (let nAct = 0; nAct < 5; nAct++) {
      const pAct = m.u32((pGame + 0xbc + nAct * 4) >>> 0) >>> 0
      if (pAct !== 0) {
        if (ENV_StepCycle113c(m, pAct, nAct) !== 0) {
          ENV_GetCycleState113c(m, pAct, pCycleIdx, pTicks, pEclipse)
          bBroadcast53 = 1
          if (m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) !== 0) {
            let pClAct = m.u32((pGame + 0x88) >>> 0) >>> 0
            while (pClAct !== 0) {
              let pPlrAct = 0
              if ((m.u8((pClAct + 0x3d4) >>> 0) & 1) !== 0) {
                pPlrAct = m.u32((pClAct + 0x174) >>> 0) >>> 0
              } else if (m.u32((pClAct + 0x174) >>> 0) !== 0) {
                pPlrAct = SUNIT_GetServerUnit113c(
                  m,
                  m.u32((pClAct + 0x1a8) >>> 0),
                  m.u32((pClAct + 0x16c) >>> 0) | 0,
                  m.u32((pClAct + 0x170) >>> 0) | 0,
                ) >>> 0
              }
              if (pPlrAct !== 0) {
                D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pPlrAct, 0)
                UNITS_SetUnitUpdateFlags113c(m, pPlrAct, 1)
              }
              pClAct = m.u32((pClAct + 0x4a8) >>> 0) >>> 0
            }
          }
        }
        if (nAct === 1) {
          ENV_GetCycleState113c(m, pAct, pCycleIdx, pTicks, pEclipse)
          const curEclipse = m.u32(pEclipse)
          const questEclipse =
            callees !== undefined && callees.checkAct2EclipseQuest !== undefined
              ? callees.checkAct2EclipseQuest(m, pGame) >>> 0
              : 0
          if (questEclipse !== curEclipse) {
            bBroadcast53 = 1
          }
        }
      }
    }

    if (bBroadcast53 !== 0) {
      const pAct0 = m.u32((pGame + 0xbc) >>> 0) >>> 0
      if (pAct0 !== 0) {
        ENV_GetCycleState113c(m, pAct0, pCycleIdx, pTicks, pEclipse)
      }
      let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
      while (pClient !== 0) {
        if (m.u32((pClient + 0x04) >>> 0) === 4) {
          let bClientEclipse = 0
          if (m.u8((pClient + 0x16d) >>> 0) === 1) {
            const questEclipse =
              callees !== undefined && callees.checkAct2EclipseQuest !== undefined
                ? callees.checkAct2EclipseQuest(m, pGame)
                : 0
            if (questEclipse !== 0) bClientEclipse = 1
          }
          m.setU8(pPkt53, 0x53)
          m.setU32((pPkt53 + 1) >>> 0, m.u32(pCycleIdx))
          m.setU32((pPkt53 + 5) >>> 0, m.u32(pTicks))
          m.setU8((pPkt53 + 9) >>> 0, bClientEclipse & 0xff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt53, 10)
        }
        pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
      }
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Checks all clients in `pGame` for ping timeout (`> 35000` ms) or player timer timeout (`> 0x4E2` frames), and steps active players.
 *
 * @va D2Game:0x6FC4D670
 */
export function GAME_CheckAndDisconnectTimedOutClients113c(
  m: Memory113c,
  pGame: number,
  dwTickMs: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC4D670)
  let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
  while (pClient !== 0) {
    const pNext = m.u32((pClient + 0x4a8) >>> 0) >>> 0
    const dwLastPing = m.u32((pClient + 0x484) >>> 0) >>> 0
    if (
      dwLastPing !== 0 &&
      ((dwTickMs - dwLastPing) | 0) > 35000 &&
      m.u32(D2GAME_DISABLE_CLIENT_TIMEOUT_VA_113C) === 0
    ) {
      if (callees !== undefined && callees.disconnectClient !== undefined) {
        callees.disconnectClient(m, pGame, pClient, 4)
      }
    } else if (m.u32((pClient + 0x04) >>> 0) === 4) {
      const pUnit = m.u32((pClient + 0x174) >>> 0) >>> 0
      if (pUnit === 0) {
        if (callees !== undefined && callees.disconnectClient !== undefined) {
          callees.disconnectClient(m, pGame, pClient, 4)
        }
      } else {
        if (callees !== undefined && callees.stepPlayerClientTick !== undefined) {
          callees.stepPlayerClientTick(m, pGame, pUnit, pClient)
        }
      }
    }
    pClient = pNext
  }
}

/**
 * Steps client join state machine (`dwClientState` 3, 4, 5 -> 4), checks client ping/timer timeouts,
 * saves active characters every 8192 frames, and broadcasts `0x5A` / `0x5B` join notifications.
 *
 * @va D2Game:0x6FC4D9B0
 */
export function GAME_StepClientJoinStatesAndTimeouts113c(
  m: Memory113c,
  pGame: number,
  dwTickMs = 0,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FC4D9B0)
  if (pGame === 0) return 0

  const dwGameFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  const bPeriodicSave = dwGameFrame % 8192 === 0 ? 1 : 0

  const pArenaCtrl = m.u32((pGame + 0x1d28) >>> 0) >>> 0
  if (pArenaCtrl !== 0 && (m.u8((pArenaCtrl + 0x08) >>> 0) & 4) === 0) {
    throw new Error('GAME_StepClientJoinStatesAndTimeouts113c: (pArena->dwFlags & 4) == 0 (line 3295)')
  }

  let bAnyDisconnected = 0
  const wrappedCallees: BootInitGapACallees113c = {
    ...callees,
    disconnectClient(mem, pg, pc, reason) {
      bAnyDisconnected = 1
      if (callees !== undefined && callees.disconnectClient !== undefined) {
        callees.disconnectClient(mem, pg, pc, reason)
      }
    },
  }
  GAME_CheckAndDisconnectTimedOutClients113c(m, pGame, dwTickMs, wrappedCallees)
  if (bPeriodicSave !== 0 && bAnyDisconnected === 0) {
    PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c(m as SparseMemory113c, pGame)
  }

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x90) >>> 0
  const spPkt04 = sp
  const spPkt5A = (sp + 0x08) >>> 0
  const spAcct = (sp + 0x38) >>> 0
  try {
    let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
    while (pClient !== 0) {
      const pNext = m.u32((pClient + 0x4a8) >>> 0) >>> 0
      const dwState = m.u32((pClient + 0x04) >>> 0) | 0

      if (dwState === 5) {
        CLIENTS_UpdatePlayerRoom113c(m, pClient, pGame, callees?.clientRoomOpts)
        const pActRoom = m.u32((pClient + 0x1b4) >>> 0) >>> 0
        if (pActRoom !== 0 && DUNGEON_AreAllAdjacentRoomsActive113c(m, pActRoom) !== 0) {
          m.setU8(spPkt04, 4)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, spPkt04, 1)
          m.setU32((pClient + 0x04) >>> 0, 4)
          const pUnit = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0
          if (pUnit !== 0) {
            D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pUnit, 1)
          }
        }
      } else if (dwState === 4) {
        CLIENTS_UpdatePlayerRoom113c(m, pClient, pGame, callees?.clientRoomOpts)
      } else if (dwState === 3) {
        CLIENTS_UpdatePlayerRoom113c(m, pClient, pGame, callees?.clientRoomOpts)
        const pActRoom = m.u32((pClient + 0x1b4) >>> 0) >>> 0
        const roomsReady =
          callees !== undefined && callees.stepJoinState3Ready !== undefined
            ? callees.stepJoinState3Ready(m, pGame, pClient, dwTickMs)
            : pActRoom !== 0
              ? DUNGEON_AreAllAdjacentRoomsActive113c(m, pActRoom)
              : 0
        if (roomsReady !== 0) {
          const pUnit0 = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0
          if (pUnit0 !== 0) {
            m.setU8(spPkt04, 4)
            NET_QueuePacketToClientBuffer113c(m, pClient, 1, spPkt04, 1)
            m.setU32((pClient + 0x04) >>> 0, 4)
            const pUnit1 = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0
            if (pUnit1 !== 0) {
              D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pUnit1, 1)
            }
            GAME_SyncNewClientWithExistingPlayers113c(m, pGame, pClient, callees)
            const pJoinUnit = m.u32((pClient + 0x174) >>> 0) >>> 0
            if (pJoinUnit === 0) {
              throw new Error('GAME_StepClientJoinStatesAndTimeouts113c: pUnit == NULL (line 335)')
            }
            D2GAME_SUNIT_IterateAllLivingPlayers113c(
              m,
              pGame,
              D2GAME_PARTY_SyncAllPlayerRelationsOnJoin113c,
              pJoinUnit,
            )

            let pCbTbl = 0
            try {
              pCbTbl = m.u32(0x6fd31c3c) >>> 0
            } catch {
              pCbTbl = 0
            }
            if (pCbTbl !== 0) {
              const pEnterUnit = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0
              if (pEnterUnit !== 0) {
                const pfnEnterGame = m.u32((pCbTbl + 0x14) >>> 0) >>> 0
                if (pfnEnterGame !== 0) {
                  const dwClassId = m.u32((pEnterUnit + 0x04) >>> 0) >>> 0
                  const wFlag0A = m.u16((pClient + 0x0a) >>> 0) & 0xffff
                  const dwLevel = STATLIST_GetUnitStat113c(m, pEnterUnit, 0x0c, 0) | 0
                  const wGameId = m.u16((pGame + 0x28) >>> 0) & 0xffff
                  const szCharName = (pClient + 0x0d) >>> 0
                  if (callees !== undefined && callees.onEnterGame !== undefined) {
                    callees.onEnterGame(m, wGameId, szCharName, dwClassId, dwLevel, wFlag0A)
                  }
                }
              }
            }

            m.fill(spPkt5A, 0x28, 0)
            m.fill(spAcct, 0x34, 0)
            m.setU8(spPkt5A, 0x5a)
            m.setU8((spPkt5A + 1) >>> 0, 2)
            m.setU8((spPkt5A + 2) >>> 0, 4)
            const acctLen = stormStrCopy113c(m, spAcct, (pClient + 0x1d) >>> 0, 0x32)
            if (acctLen !== 0) {
              stormStrCopy113c(m, (spPkt5A + 0x18) >>> 0, spAcct, 0x10)
              m.setU8((spPkt5A + 0x27) >>> 0, 0)
            }
            stormStrCopy113c(m, (spPkt5A + 0x08) >>> 0, (pClient + 0x0d) >>> 0, 0x10)
            D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c(m, spPkt5A, pGame)
          }
        }
      }
      pClient = pNext
    }
  } finally {
    bootInitGapStackPtr = sp
  }
  return 1
}

/**
 * Sets object animation mode to `2` via `D2Common.#11090` (`UNITS_ChangeAnimMode`).
 *
 * @va D2Game:0x6FC4E750
 */
export function OBJECT_SetAnimMode2Wrapper113c(
  m: Memory113c,
  _pGame: number,
  pObject: number,
  _pPlayer = 0,
  _bFlag = 0,
): number {
  hitD2GameVa113c(0x6FC4E750)
  return UNITS_ChangeAnimMode113c(m, pObject, 2)
}

/**
 * Spawns a regular preset monster (`edi = nClassId`, `__stdcall(pGame, pRoom, x, y, nMode)`, `370B`):
 * 1. Validates `0 <= nClassId < nMonStatsCount` (`[sgptDataTables + 0xA80]`) and `pMonStatsTxt != 0`.
 * 2. Frozen Anya (`nClassId == 0x1B2`): decrements `y` and forces `nMode = 0x0C` when Quest `0x20` is intro.
 * 3. Rejects `MONSTATS2_CheckFlagBit113c(m, nClassId, 0x0D) != 0`.
 * 4. Computes `wFlags = (pMonStatsTxt[+0x0E] & 0x04) != 0 ? 8 : 0` and spawns via `0x6FD0F650`
 *    (`MONSTER_SpawnAtCoords113c`) at radius `-1`, retrying at radius `4` when `REGPOP_CanSpawnPresetMinionPack113c != 0`.
 * 5. When `MONSTATS2_CheckFlagBit113c(m, nClassId, 0x12) != 0`, allocates companion object `0x23B` (`0x1B0`)
 *    or `0x23C` (`0x1B1`) via `0x6FD01D90` (`SUNIT_AllocUnitData113c`).
 *
 * @va D2Game:0x6FC66F70
 */
export function MONSTER_SpawnPresetOrEvilUrn113c(
  m: Memory113c,
  nClassId: number,
  pGame: number,
  pRoom: number,
  x: number,
  y: number,
  nMode: number,
  spawnAtCoordsOverride?: (
    m: Memory113c,
    nClassId: number,
    nMode: number,
    pGame: number,
    pRoom: number,
    x: number,
    y: number,
    nMaxRadius: number,
    wFlags: number,
  ) => number,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FC66F70)
  const cid = nClassId | 0
  if (cid < 0) return 0

  let pTables = 0
  try {
    const pIat = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    if (pIat !== 0) {
      pTables = m.u32(pIat) >>> 0
      if (pTables === 0) pTables = pIat
    }
  } catch {
    // Fall back to direct D2Common!sgptDataTables pointer if IAT page is unloaded in standalone tests.
  }
  if (pTables === 0) {
    try {
      pTables = m.u32(0x6fde9e1c) >>> 0
    } catch {
      pTables = 0
    }
  }
  if (pTables === 0) return 0

  const nMonStatsCount = m.u32((pTables + 0xa80) >>> 0) | 0
  if (cid >= nMonStatsCount) return 0
  const pMonStatsBase = m.u32((pTables + 0xa78) >>> 0) >>> 0
  const pMonStatsTxt = (pMonStatsBase + imul32(cid, 0x1a8)) >>> 0
  if (pMonStatsTxt === 0) return 0

  let spawnY = y | 0
  let spawnMode = nMode | 0
  if (cid === 0x1b2) {
    spawnY = (spawnY - 1) | 0
    if (pGame !== 0 && QUESTS_CheckNotIntro_6FC53970_113c(m, pGame, 0x20) === 0) {
      spawnMode = 0x0c
    }
  }

  if (MONSTATS2_CheckFlagBit113c(m, cid, 0x0d) !== 0) {
    return 0
  }

  let bitMask2 = 4
  try {
    const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
    if (pBitMasks !== 0) {
      const b = m.u8((pBitMasks + 8) >>> 0)
      if (b !== 0) bitMask2 = b
    }
  } catch {
    // Default bit 2 = 0x04 when gdwBitMasks IAT is unloaded.
  }
  const wFlags = (m.u8((pMonStatsTxt + 0x0e) >>> 0) & bitMask2) !== 0 ? 8 : 0

  const doSpawn =
    spawnAtCoordsOverride !== undefined
      ? spawnAtCoordsOverride
      : (
          mem: Memory113c,
          c: number,
          md: number,
          pg: number,
          pr: number,
          px: number,
          py: number,
          maxR: number,
          wf: number,
        ): number =>
          MONSTER_SpawnAtCoords113c(
            mem,
            c,
            md,
            pg,
            pr,
            px,
            py,
            maxR,
            wf,
            callees !== undefined ? callees.regpop : undefined,
          )

  let pUnit = doSpawn(m, cid, spawnMode, pGame, pRoom, x | 0, spawnY, -1, wFlags) >>> 0
  if (pUnit === 0) {
    if (REGPOP_CanSpawnPresetMinionPack113c(m, cid) === 0) {
      return 0
    }
    pUnit = doSpawn(m, cid, spawnMode, pGame, pRoom, x | 0, spawnY, 4, wFlags) >>> 0
    if (pUnit === 0) {
      return 0
    }
  }

  if (MONSTATS2_CheckFlagBit113c(m, cid, 0x12) !== 0) {
    if (cid < nMonStatsCount && cid === 0x1b0) {
      const ux = UNIT_GetPosX113c(m, pUnit)
      const uy = UNIT_GetPosY113c(m, pUnit)
      SUNIT_AllocUnitData113c(m, 2, 0x23b, ux, uy, pGame, pRoom, 1, 0, 0)
      return pUnit
    }
    if (MONSTATS_ValidateClassId113c(m, cid) === 0x1b1) {
      const ux = UNIT_GetPosX113c(m, pUnit)
      const uy = UNIT_GetPosY113c(m, pUnit)
      SUNIT_AllocUnitData113c(m, 2, 0x23c, ux, uy, pGame, pRoom, 1, 0, 0)
    }
  }
  return pUnit
}

/**
 * Checks if `pPortalUnit` or its linked twin portal is in Tristram (`levelId == 0x26`) and advances Act 1 Quest 3 state.
 *
 * @va D2Game:0x6FC86320
 */
export function QUEST_Act1TownPortalUpdateState113c(
  m: Memory113c,
  pPortalUnit: number,
  pGame: number,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FC86320)
  const pPath = pPortalUnit !== 0 ? m.u32((pPortalUnit + 0x2c) >>> 0) >>> 0 : 0
  const pRoom = pPath !== 0 ? m.u32((pPath + 0x1c) >>> 0) >>> 0 : 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)

  const dwTwinId = pPortalUnit !== 0 ? m.u32((pPortalUnit + 0x94) >>> 0) : 0xffffffff
  const pTwinUnit = SUNIT_GetServerUnit113c(m, pGame, 2, dwTwinId) >>> 0
  const pTwinPath = pTwinUnit !== 0 ? m.u32((pTwinUnit + 0x2c) >>> 0) >>> 0 : 0
  const pTwinRoom = pTwinPath !== 0 ? m.u32((pTwinPath + 0x1c) >>> 0) >>> 0 : 0
  const nTwinLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pTwinRoom)

  if (nLevelId !== 0x26 && nTwinLevelId !== 0x26) {
    return 0
  }

  const pQuest =
    callees !== undefined && callees.getQuestDescriptor !== undefined
      ? callees.getQuestDescriptor(m, pGame, 3) >>> 0
      : 0
  if (pQuest === 0) return 1
  const pQuestExt = m.u32((pQuest + 0xf0) >>> 0) >>> 0
  if (pQuestExt === 0) return 1
  if (m.u8(pQuestExt) === 1) {
    m.setU32((pQuestExt + 0x04) >>> 0, 2)
  }
  return 1
}

/**
 * Sends object mode (`0x0E`), shrine speech (`0x2C`), and quest state packets for `pObject` to `pClient`.
 *
 * @va D2Game:0x6FC8A0D0
 */
export function OBJECT_SendUpdatePacketsToClient113c(
  m: Memory113c,
  pClient: number,
  pObject: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC8A0D0)
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  const pkt0E = sp
  const pkt4D = (sp + 0x10) >>> 0
  try {
    const dwFlags = pObject !== 0 ? m.u32((pObject + 0xc4) >>> 0) >>> 0 : 0
    const dwUnitId = pObject !== 0 ? m.u32((pObject + 0x0c) >>> 0) >>> 0 : 0xffffffff
    const wAnimMode = pObject !== 0 ? m.u16((pObject + 0x10) >>> 0) : 0
    m.fill(pkt0E, 0x0c, 0)
    m.setU8(pkt0E, 0x0e)
    m.setU8((pkt0E + 1) >>> 0, 0x02)
    m.setU32((pkt0E + 2) >>> 0, dwUnitId)
    m.setU8((pkt0E + 6) >>> 0, 0x03)
    m.setU8((pkt0E + 7) >>> 0, (dwFlags >>> 1) & 1)
    m.setU32((pkt0E + 8) >>> 0, wAnimMode >>> 0)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pkt0E, 0x0c)

    if (pObject === 0) return
    const pObjData = m.u32((pObject + 0x14) >>> 0) >>> 0
    const pObjTxtRaw = pObjData !== 0 ? (m.u32(pObjData) >>> 0) : 0
    const pObjTxt =
      pObjTxtRaw !== 0
        ? pObjTxtRaw
        : (DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pObject + 4) >>> 0) | 0) >>> 0)
    if (pObjTxt === 0) return
    const subClass = m.u8((pObjTxt + 0x167) >>> 0)
    if (subClass === 0) return
    if ((subClass & 0x04) !== 0) {
      if (callees !== undefined && callees.onObjectQuestSync !== undefined) {
        callees.onObjectQuestSync(m, m.u32((pObject + 0x80) >>> 0), pObject, pClient)
      }
      return
    }
    if (m.u32((pObject + 0x10) >>> 0) === 1 && (subClass & 0x01) !== 0) {
      const pShrineTxt = UNITS_GetObjectShrineTxt113c(m, pObject) >>> 0
      const shrineByte = pShrineTxt !== 0 ? m.u8(pShrineTxt) : 0
      const shrineType = m.u32((pObjData + 0x0c) >>> 0) >>> 0
      if (shrineType !== 0) {
        m.fill(pkt4D, 0x11, 0)
        m.setU8(pkt4D, 0x4d)
        m.setU8((pkt4D + 1) >>> 0, 0x02)
        m.setU32((pkt4D + 2) >>> 0, dwUnitId)
        m.setU32((pkt4D + 6) >>> 0, (shrineType - 1) >>> 0)
        m.setU8((pkt4D + 10) >>> 0, shrineByte)
        NET_QueuePacketToClientBuffer113c(m, pClient, 1, pkt4D, 0x11)
      }
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Syncs `pObject` update packets (`dwFlags & 0x01`), unit sound `0x2C` (`dwFlags & 0x400`),
 * hover message `0x26`/`0x30` (`dwFlags & 0x100`), inventory command flags (`dwFlagsEx & 0x01`),
 * and flushes `pObject->pEventNotifyList` (`+0xE8`) to `pClient`.
 *
 * @va D2Game:0x6FC8B200
 */
export function OBJECT_SyncStateAndEventsToClient113c(
  m: Memory113c,
  pObject: number,
  pClient: number,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FC8B200)
  const obj = pObject >>> 0
  if (obj !== 0) {
    if ((m.u32((obj + 0xc4) >>> 0) & 0x01) !== 0) {
      OBJECT_SendUpdatePacketsToClient113c(m, pClient, obj, callees)
    }
    if (((m.u32((obj + 0xc4) >>> 0) >>> 10) & 1) !== 0) {
      const pOwnerRestrict = m.u32((obj + 0x70) >>> 0) >>> 0
      if (pOwnerRestrict === 0 || CLIENTS_GetPlayerUnit113c(m, pClient, 0) === pOwnerRestrict) {
        const wSound = m.u16((obj + 0x6e) >>> 0)
        if (callees !== undefined && callees.sendUnitEventSound !== undefined) {
          callees.sendUnitEventSound(m, pClient, obj, wSound)
        } else {
          const sp = bootInitGapStackPtr
          bootInitGapStackPtr = (sp + 0x10) >>> 0
          try {
            m.fill(sp, 8, 0)
            m.setU8(sp, 0x2c)
            m.setU8((sp + 1) >>> 0, m.u8(obj))
            m.setU32((sp + 2) >>> 0, m.u32((obj + 0x0c) >>> 0))
            m.setU16((sp + 6) >>> 0, wSound)
            NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 8)
          } finally {
            bootInitGapStackPtr = sp
          }
        }
      }
    }
    if (((m.u32((obj + 0xc4) >>> 0) >>> 8) & 1) !== 0) {
      SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c(m as SparseMemory113c, obj, pClient)
    }
    if ((m.u32((obj + 0xc8) >>> 0) & 0x01) !== 0) {
      ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c(
        m as SparseMemory113c,
        0,
        m.u32((obj + 0x80) >>> 0) >>> 0,
        obj,
        pClient,
      )
    }
    UNIT_FlushEventNotifyQueueToClient113c(m, pClient, obj, callees)
  }
  return 1
}

/**
 * Computes monster life percentage on a `0..128` (`0x80`) scale (`((curLife >> 8) << 7) / (maxLife >> 8)`).
 *
 * @va D2Game:0x6FC97060
 */
export function MONSTER_CalcLifePercentage128_113c(m: Memory113c, pUnit: number): number {
  hitD2GameVa113c(0x6FC97060)
  if (pUnit === 0) return 0
  const curLife = STATLIST_GetUnitStat113c(m, pUnit, 6, 0) | 0
  const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pUnit) | 0
  const maxLifeShr = maxLife >> 8
  if (maxLifeShr <= 0) return 0x80
  let pct = Math.trunc(((curLife >> 8) << 7) / maxLifeShr) | 0
  if (pct === 0 && curLife > 0) {
    pct = 1
  }
  if (pct > 0x80) {
    pct = 0x80
  }
  return pct & 0xff
}

/**
 * Looks up `0x6FD1BBF0[nIndex]` (`[0, 0, 8, 16, 24, 32, 40, 48]`) when `pGame != 0`, `nIndex < 8`, and `pGame->dwGameType == 0`.
 *
 * @va D2Game:0x6FC970A0
 */
export function MONSTER_GetHirelingLevelBonusFactor113c(
  m: Memory113c,
  pGame: number,
  nIndex: number,
): number {
  hitD2GameVa113c(0x6FC970A0)
  if (pGame === 0) return 0
  if ((nIndex >>> 0) >= 8) return 0
  if (m.u32((pGame + 0x70) >>> 0) !== 0) return 0
  return HIRELING_BONUS_TABLE_6FD1BBF0[nIndex >>> 0]!
}

/**
 * Calculates and applies monster base combat stats, elemental damage rolls (`0x30..0x42`, `0x13B..0x13D`), and resistances (`0x24..0x2D`).
 *
 * @va D2Game:0x6FC97240
 */
export function MONSTER_ApplyElementalDamageAndResistStats113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  nMode: number,
): void {
  hitD2GameVa113c(0x6FC97240)
  if (pMonster === 0 || m.u32(pMonster >>> 0) !== 1) return
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const nClassId = m.u32((pMonster + 0x04) >>> 0) | 0
  const pMonStatsTxt = (m.u32(pMonData) || MONSTATS_GetRecordPtr113c(m, nClassId)) >>> 0
  if (pMonStatsTxt === 0) return

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x60) >>> 0
  const pBonusArr = sp
  const pCalcBlock = (sp + 0x10) >>> 0
  try {
    m.setU32(pBonusArr, 0)
    m.setU32((pBonusArr + 0x04) >>> 0, 0)
    m.setU32((pBonusArr + 0x08) >>> 0, 0)

    // 0x6FC9728C: D2GAME_MONSTER_ApplyMercStatsOnOwner(pMonster, pBonusArr)
    D2GAME_MONSTER_ApplyMercStatsOnOwner113c(
      m,
      pMonster,
      pBonusArr,
      m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0,
    )

    // 0x6FC97291..0x6FC972A9: get monster's flag=1 attack-mode statlist and clear it
    const pStatList = STATLIST_GetStatListFromUnitAndFlag113c(m, pMonster, 1) >>> 0
    if (pStatList === 0) return
    STATLIST_ClearBaseStats113c(m, pStatList)

    // 0x6FC972AA..0x6FC972DC: resolve pGame, nDiff, bExpansionFlag
    const pGameResolved = (D2GAME_SUNIT_GetGameFromUnit113c(m, pMonster) || pGame) >>> 0
    if (pGameResolved === 0) return
    const rawDiff = m.u8((pGameResolved + 0x6d) >>> 0) | 0
    const nDifficulty = rawDiff <= 0 ? 0 : rawDiff >= 2 ? 2 : 1
    const dwExpansion = m.u32((pGameResolved + 0x70) >>> 0) >>> 0
    const bIsExpansion =
      m.u8((pGameResolved + 0x6a) >>> 0) !== 0 ||
      m.u32((pGameResolved + 0x74) >>> 0) !== 0 ||
      dwExpansion !== 0
        ? 1
        : 0

    // 0x6FC972DD..0x6FC9730C: alignment == 0 -> MONSTER_GetHirelingLevelBonusFactor(pGame, max(1, stat 0x64))
    let bonusFactor = 0
    if (UNIT_GetAlignment113c(m, pMonster) === 0) {
      let playerCount = STATLIST_GetUnitStat113c(m, pMonster, 0x64, 0) | 0
      if (playerCount < 1) playerCount = 1
      bonusFactor = MONSTER_GetHirelingLevelBonusFactor113c(m, pGameResolved, playerCount) | 0
    }

    // 0x6FC9730D..0x6FC97410: A1 / A2 / S1 base damage & toHit calculation
    const mode = nMode | 0
    const mlvl = STATLIST_GetUnitStat113c(m, pMonster, 0x0c, 0) | 0
    m.fill(pCalcBlock, 0x38, 0)
    let calcFlags = 0x08
    let minOff = 0x14
    let maxOff = 0x18
    if (mode === 5) {
      calcFlags = 0x10
      minOff = 0x1c
      maxOff = 0x20
    } else if (mode === 7 || mode === 8) {
      calcFlags = 0x20
      minOff = 0x24
      maxOff = 0x28
    }
    DATATBLS_CalculateMonsterStatsByLevel113c(
      m,
      nClassId,
      bIsExpansion,
      nDifficulty,
      mlvl,
      calcFlags,
      pCalcBlock,
    )
    let minD = ((m.u32((pCalcBlock + minOff) >>> 0) | 0) + (m.u32(pBonusArr) | 0)) | 0
    let maxD = ((m.u32((pCalcBlock + maxOff) >>> 0) | 0) + (m.u32((pBonusArr + 0x04) >>> 0) | 0)) | 0
    let toHit = ((m.u32((pCalcBlock + 0x0c) >>> 0) | 0) + (m.u32((pBonusArr + 0x08) >>> 0) | 0)) | 0

    // 0x6FC97415..0x6FC97478: Classic NM/Hell scaling when bNoRatio (+0x4C) != 1
    if (dwExpansion === 0) {
      if (nDifficulty !== 0 && m.u8((pMonStatsTxt + 0x4c) >>> 0) !== 1) {
        minD = Math.trunc((minD * 10) / 6) | 0
        maxD = Math.trunc((maxD * 10) / 6) | 0
        toHit = Math.trunc((toHit * 10) / 9) | 0
      }
    } else if (bonusFactor !== 0) {
      // 0x6FC9747A..0x6FC974B5: Expansion player-count bonus (trunc(v * bonusFactor / 128))
      minD = (minD + Math.trunc(imul32(minD, bonusFactor) / 128)) | 0
      maxD = (maxD + Math.trunc(imul32(maxD, bonusFactor) / 128)) | 0
      toHit = (toHit + Math.trunc(imul32(toHit, bonusFactor) / 128)) | 0
    }

    // 0x6FC974B6..0x6FC974D6: STAT_MINDAMAGE (21), STAT_MAXDAMAGE (22), STAT_TOHIT (19) on flag=1 list
    STATLIST_SetStat113c(m, pStatList, 0x15, minD, 0)
    STATLIST_SetStat113c(m, pStatList, 0x16, maxD, 0)
    STATLIST_SetStat113c(m, pStatList, 0x13, toHit, 0)

    // 0x6FC974D7..0x6FC9774A: El1..El3 elemental mode-matched damage rolls
    const pSeed = (pMonster + 0x20) >>> 0
    for (let slot = 0; slot < 3; slot++) {
      const elMode = m.u8((pMonStatsTxt + 0xfe + slot) >>> 0)
      if (elMode === 0 || elMode !== mode) continue
      const elPct = m.u8((pMonStatsTxt + 0x104 + slot * 3 + nDifficulty) >>> 0)
      if (elPct === 0) continue
      if (elPct < 100) {
        if ((SEED_RollLimitedRandomNumber113c(m, pSeed, 100) | 0) >= elPct) continue
      }

      m.fill(pCalcBlock, 0x38, 0)
      const curMlvl = STATLIST_GetUnitStat113c(m, pMonster, 0x0c, 0) | 0
      DATATBLS_CalculateMonsterStatsByLevel113c(
        m,
        nClassId,
        bIsExpansion,
        nDifficulty,
        curMlvl,
        (0x40 + slot) | 0,
        pCalcBlock,
      )
      let elMin = m.u32((pCalcBlock + 0x2c) >>> 0) | 0
      let elMax = m.u32((pCalcBlock + 0x30) >>> 0) | 0
      let elLen = m.u32((pCalcBlock + 0x34) >>> 0) | 0
      if (dwExpansion !== 0 && bonusFactor !== 0) {
        elMin = (elMin + Math.trunc(imul32(elMin, bonusFactor) / 128)) | 0
        elMax = (elMax + Math.trunc(imul32(elMax, bonusFactor) / 128)) | 0
        elLen = (elLen + Math.trunc(imul32(elLen, bonusFactor) / 128)) | 0
      }

      let elType = m.u8((pMonStatsTxt + 0x101 + slot) >>> 0)
      if (elType === 10) {
        elType = ((SEED_RollLimitedRandomNumber113c(m, pSeed, 5) | 0) + 1) & 0xff
        if (elLen === 0) elLen = 0x19
      }

      switch (elType) {
        case 1:
          STATLIST_SetStat113c(m, pStatList, 0x30, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x31, elMax, 0)
          break
        case 2:
          STATLIST_SetStat113c(m, pStatList, 0x32, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x33, elMax, 0)
          break
        case 3:
          STATLIST_SetStat113c(m, pStatList, 0x34, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x35, elMax, 0)
          break
        case 4:
          STATLIST_SetStat113c(m, pStatList, 0x36, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x37, elMax, 0)
          STATLIST_SetStat113c(m, pStatList, 0x38, elLen, 0)
          break
        case 5:
          STATLIST_SetStat113c(m, pStatList, 0x39, imul32(elMin, 10), 0)
          STATLIST_SetStat113c(m, pStatList, 0x3a, imul32(elMax, 10), 0)
          STATLIST_SetStat113c(m, pStatList, 0x3b, (elLen * 2) | 0, 0)
          break
        case 6:
          STATLIST_SetStat113c(m, pStatList, 0x3c, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x3d, elMax, 0)
          break
        case 7:
          STATLIST_SetStat113c(m, pStatList, 0x3e, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x3f, elMax, 0)
          break
        case 8:
          STATLIST_SetStat113c(m, pStatList, 0x40, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x41, elMax, 0)
          break
        case 9:
          STATLIST_SetStat113c(m, pStatList, 0x42, elLen, 0)
          break
        case 11:
          STATLIST_SetStat113c(m, pStatList, 0x13c, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x13d, elMax, 0)
          STATLIST_SetStat113c(m, pStatList, 0x13b, elLen, 0)
          break
        default:
          break
      }
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Syncs unit gfx states, modified stats, sound events, and event notification queue to `pClient`.
 *
 * @va D2Game:0x6FC988B0
 */
export function UNIT_SyncStateAndStatsToClient113c(
  m: Memory113c,
  pGame: number,
  pClient: number,
  pUnit: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC988B0)
  if (pClient === 0) return

  const dwFlags = pUnit !== 0 ? (m.u32((pUnit + 0xc4) >>> 0) >>> 0) : 0

  // 0x6FC98966..0x6FC9899C: `bPreSynced == 0 && (dwFlagsEx & 0x01) != 0` -> broadcast inventory command flags + packets 0x47 / 0x48
  if (pUnit !== 0 && (m.u32((pUnit + 0xc8) >>> 0) & 0x01) !== 0) {
    ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c(
      m as SparseMemory113c,
      0,
      pGame,
      pUnit,
      pClient,
    )
    NET_SendPacket47_UnitRelator1_6FCAAEC0_113c(m, pUnit, pClient)
    NET_SendPacket48_UnitRequestStatus_6FCAAE60_113c(m, pUnit, pClient, 0)
  }

  // 0x6FC989A0..0x6FC989B8: `dwFlags & 0x01` -> player mode sync
  if (pUnit !== 0 && (dwFlags & 0x01) !== 0) {
    if (callees !== undefined && callees.syncPlayerMode !== undefined) {
      callees.syncPlayerMode(m, pGame, pClient, pUnit)
    }
  }

  // 0x6FC989B8..0x6FC989BA: flush event notify queue (`pUnit + 0xEC`)
  if (pUnit !== 0 && m.u32((pUnit + 0xec) >>> 0) !== 0) {
    UNIT_FlushEventNotifyQueueToClient113c(m, pClient, pUnit, callees)
  }

  // 0x6FC989C3..0x6FC989DE: `dwFlags & 0x400` -> unit event sound (`0x6FC9AC50`)
  if (pUnit !== 0 && (dwFlags & 0x400) !== 0) {
    if (callees !== undefined && callees.sendUnitEventSound !== undefined) {
      callees.sendUnitEventSound(m, pClient, pUnit, m.u16((pUnit + 0xd8) >>> 0))
    }
  }

  // 0x6FC989FC..0x6FC98A16: `dwFlags & 0x8000` -> hit/gethit stop sync (`0x6FCEBBB0`)
  if (pUnit !== 0 && ((dwFlags >>> 15) & 1) !== 0) {
    if (callees !== undefined && callees.syncUnitFlag8000 !== undefined) {
      callees.syncUnitFlag8000(m, pGame, pClient, pUnit)
    }
  }

  // 0x6FC98A16..0x6FC98A27: `UNITS_HasAnyGfxStateFlag` -> `UNIT_SendGfxStatesBitstreamToClient`
  if (pUnit !== 0 && UNITS_HasAnyGfxStateFlag113c(m, pUnit) !== 0) {
    UNIT_SendGfxStatesBitstreamToClient113c(m, pUnit, pClient)
  }

  // 0x6FC98A27..0x6FC98A78: statlist flag 0x100 + modified stat notifications (0x43, 0x44, 0x0C, 0, 2)
  if (pUnit !== 0 && STATLIST_CheckUnitStatListFlag100113c(m, pUnit) !== 0) {
    const uType = m.u32(pUnit >>> 0)
    if (uType === 0 && m.u32((pClient + 0x174) >>> 0) === (pUnit >>> 0)) {
      if (callees !== undefined && callees.sendLifeManaStaminaPacket !== undefined) {
        const curLife = STATLIST_GetUnitStat113c(m, pUnit, 6, 0) | 0
        const curMana = STATLIST_GetUnitStat113c(m, pUnit, 8, 0) | 0
        const curStamina = STATLIST_GetUnitStat113c(m, pUnit, 0x0a, 0) | 0
        if (
          curLife !== (m.u32((pClient + 0x48c) >>> 0) | 0) ||
          curMana !== (m.u32((pClient + 0x490) >>> 0) | 0) ||
          curStamina !== (m.u32((pClient + 0x494) >>> 0) | 0)
        ) {
          m.setU32((pClient + 0x48c) >>> 0, curLife >>> 0)
          m.setU32((pClient + 0x490) >>> 0, curMana >>> 0)
          m.setU32((pClient + 0x494) >>> 0, curStamina >>> 0)
          callees.sendLifeManaStaminaPacket(m, pClient, pUnit, curLife, curMana, curStamina)
        }
      }
    }
  }

  if (pUnit !== 0) {
    const pClientPlayer = m.u32((pClient + 0x174) >>> 0) >>> 0
    const cb =
      callees !== undefined && callees.onStatModifiedNotify !== undefined
        ? callees.onStatModifiedNotify
        : undefined
    STATLIST_NotifyIfStatModified113c(m, pUnit, pClientPlayer, 0x43, 0, cb)
    STATLIST_NotifyIfStatModified113c(m, pUnit, pClientPlayer, 0x44, 0, cb)
    STATLIST_NotifyIfStatModified113c(m, pUnit, pClientPlayer, 0x0c, 0, cb)
    STATLIST_NotifyIfStatModified113c(m, pUnit, pClientPlayer, 0, 0, cb)
    STATLIST_NotifyIfStatModified113c(m, pUnit, pClientPlayer, 2, 0, cb)

    if ((m.u8((pUnit + 0xc6) >>> 0) & 1) !== 0 || (m.u8((pUnit + 0xc4) >>> 0) & 0x80) !== 0) {
      if (callees !== undefined && callees.sendUnitUpdateFlagsPacket !== undefined) {
        callees.sendUnitUpdateFlagsPacket(m, pClient, pUnit)
      }
    }
  }
}

/**
 * Frees all nodes in `pUnit->pEventNotifyList` (`+0xEC`, linked via `+0x00`) and zeroes `+0xEC`/`+0xF0`.
 *
 * @va D2Game:0x6FC99FE0
 */
export function UNIT_FreeEventNotifyList113c(m: Memory113c, pUnit: number): void {
  hitD2GameVa113c(0x6FC99FE0)
  if (pUnit === 0) {
    throw new Error('UNIT_FreeEventNotifyList113c: pUnit == NULL (line 3373)')
  }
  let pNode = m.u32((pUnit + 0xec) >>> 0) >>> 0
  while (pNode !== 0) {
    const pNext = m.u32(pNode >>> 0) >>> 0
    fogFreeMemPool113c(m, pNode)
    pNode = pNext
  }
  m.setU32((pUnit + 0xf0) >>> 0, 0)
  m.setU32((pUnit + 0xec) >>> 0, 0)
}

function writeUnitStateStatsBitstream113c(
  m: Memory113c,
  pDataTables: number,
  pBitStream: number,
  pStatsBuf: number,
  nStats: number,
): void {
  const nIscCount = m.u32((pDataTables + 0xbd4) >>> 0) | 0
  const pIscBase = m.u32((pDataTables + 0xbcc) >>> 0) >>> 0
  for (let i = 0; i < nStats; i++) {
    const pStat = (pStatsBuf + i * 8) >>> 0
    const wParam = m.u16(pStat)
    const wStatId = m.u16((pStat + 2) >>> 0)
    let nVal = m.u32((pStat + 4) >>> 0) | 0
    if ((wStatId | 0) < 0 || (wStatId | 0) >= nIscCount || pIscBase === 0) continue
    const pIsc = (pIscBase + imul32(wStatId, 0x144)) >>> 0
    const bSendBits = m.u8((pIsc + 0x08) >>> 0)
    if (bSendBits === 0) continue
    if (bSendBits < 0x20) {
      const fSigned = (m.u8((pIsc + 0x04) >>> 0) & 0x02) !== 0
      if (fSigned) {
        const maxPos = ((1 << (bSendBits - 1)) - 1) | 0
        const minNeg = -(1 << (bSendBits - 1)) | 0
        if (nVal < minNeg) nVal = minNeg
        if (nVal > maxPos) nVal = maxPos
      } else {
        const maxUnsigned = (((1 << bSendBits) >>> 0) - 1) | 0
        if (nVal <= 0) nVal = 0
        else if (nVal > maxUnsigned) nVal = maxUnsigned
      }
    }
    fogWriteBits113c(m, pBitStream, wStatId, 9)
    const bSendParamBits = m.u8((pIsc + 0x09) >>> 0)
    if (bSendParamBits !== 0) {
      fogWriteBits113c(m, pBitStream, wParam, bSendParamBits)
    }
    fogWriteBits113c(m, pBitStream, nVal, bSendBits)
  }
}

/**
 * Serializes modified gfx states on `pUnit` (`D2Common.#10315`) as `0xA8` (bitstream), `0xA7` (flag), or `0xA9` (clear) packets to `pClient`.
 *
 * @va D2Game:0x6FC9A5E0
 */
export function UNIT_SendGfxStatesBitstreamToClient113c(
  m: Memory113c,
  pUnit: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FC9A5E0)
  if (pUnit === 0 || pClient === 0) return
  const pGfxFlags = UNITS_GetGfxStateFlagsPtr113c(m, pUnit) >>> 0
  if (pGfxFlags === 0) return

  const pSgptHolder = m.u32(0x6fd1829c) >>> 0
  const pDataTables = (pSgptHolder !== 0 ? m.u32(pSgptHolder) : m.u32(0x6fde9e1c)) >>> 0
  if (pDataTables === 0) return
  const nStatesCount = m.u32((pDataTables + 0xc4) >>> 0) | 0
  const plus31 = (nStatesCount + 0x1f) | 0
  const nDwords = sar32(plus31 + ((plus31 >> 31) & 0x1f), 5)
  if (nDwords <= 0) return
  const pStatesTxtBase = m.u32((pDataTables + 0xbc) >>> 0) >>> 0

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x1140) >>> 0
  const pBitStream = sp
  const pPkt = (sp + 0x20) >>> 0
  const pStatsBuf = (sp + 0x120) >>> 0
  try {
    const uType = m.u8(pUnit >>> 0)
    const uGuid = m.u32((pUnit + 0x0c) >>> 0) >>> 0
    for (let dwordIdx = 0; dwordIdx < nDwords; dwordIdx++) {
      let mask = m.u32((pGfxFlags + dwordIdx * 4) >>> 0) >>> 0
      while (mask !== 0) {
        const bitIdx = fogBitScanForward113c(mask)
        if (bitIdx < 0) break
        const nState = ((dwordIdx << 5) + bitIdx) | 0
        mask = (mask & ~((1 << (bitIdx & 31)) >>> 0)) >>> 0
        if (nState < 0 || nState >= nStatesCount || pStatesTxtBase === 0) continue
        const pStateRec = (pStatesTxtBase + imul32(nState, 0x3c)) >>> 0
        if ((m.u8((pStateRec + 0x10) >>> 0) & 0x01) !== 0) continue

        if (STATES_CheckState113c(m, pUnit, nState) === 0) {
          m.setU8(pPkt, 0xa9)
          m.setU8((pPkt + 1) >>> 0, uType)
          m.setU32((pPkt + 2) >>> 0, uGuid)
          m.setU8((pPkt + 6) >>> 0, nState & 0xff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 7)
          continue
        }

        const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, nState) >>> 0
        if (pStatList === 0) {
          m.setU8(pPkt, 0xa7)
          m.setU8((pPkt + 1) >>> 0, uType)
          m.setU32((pPkt + 2) >>> 0, uGuid)
          m.setU8((pPkt + 6) >>> 0, nState & 0xff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 7)
          continue
        }

        const nStats = STATLIST_CopyBaseStatsToBuffer113c(m, pStatList, pStatsBuf, 0x10) | 0
        if (nStats <= 0) {
          m.setU8(pPkt, 0xa7)
          m.setU8((pPkt + 1) >>> 0, uType)
          m.setU32((pPkt + 2) >>> 0, uGuid)
          m.setU8((pPkt + 6) >>> 0, nState & 0xff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 7)
          continue
        }

        m.fill(pPkt, 0x100, 0)
        m.setU8(pPkt, 0xa8)
        m.setU8((pPkt + 1) >>> 0, uType)
        m.setU32((pPkt + 2) >>> 0, uGuid)
        m.setU8((pPkt + 7) >>> 0, nState & 0xff)
        fogInitBitBuffer113c(m, pBitStream, (pPkt + 8) >>> 0, 0xf4)
        writeUnitStateStatsBitstream113c(m, pDataTables, pBitStream, pStatsBuf, nStats)
        fogWriteBits113c(m, pBitStream, 0x1ff, 9)
        const totalLen = (fogGetBitBufferSize113c(m, pBitStream) + 8) & 0xff
        m.setU8((pPkt + 6) >>> 0, totalLen)
        NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, totalLen)
      }
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Serializes all active states on `pUnit` (`D2Common.#11150`) into a single `0xAA` multi-state
 * bitstream packet (`ItemStatCost.txt` bit widths + `0xFF` 8-bit state terminator) to `pClient`.
 *
 * @va D2Game:0x6FC9A940
 */
export function UNIT_SendAllStatesBitstreamToClient113c(
  m: Memory113c,
  pUnit: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FC9A940)
  if (pUnit === 0 || pClient === 0) return
  const pStateFlags = UNITS_GetStateFlagsPtr113c(m, pUnit) >>> 0
  if (pStateFlags === 0) return

  const pSgptHolder = m.u32(0x6fd1829c) >>> 0
  const pDataTables = (pSgptHolder !== 0 ? m.u32(pSgptHolder) : m.u32(0x6fde9e1c)) >>> 0
  if (pDataTables === 0) return
  const nStatesCount = m.u32((pDataTables + 0xc4) >>> 0) | 0
  const plus31 = (nStatesCount + 0x1f) | 0
  const nDwords = sar32(plus31 + ((plus31 >> 31) & 0x1f), 5)
  const pStatesTxtBase = m.u32((pDataTables + 0xbc) >>> 0) >>> 0

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x1140) >>> 0
  const pBitStream = sp
  const pPkt = (sp + 0x20) >>> 0
  const pStatsBuf = (sp + 0x120) >>> 0
  try {
    m.fill(pPkt, 0x100, 0)
    m.setU8(pPkt, 0xaa)
    m.setU8((pPkt + 1) >>> 0, m.u8(pUnit >>> 0))
    m.setU32((pPkt + 2) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
    fogInitBitBuffer113c(m, pBitStream, (pPkt + 7) >>> 0, 0xf4)

    for (let dwordIdx = 0; dwordIdx < nDwords; dwordIdx++) {
      let mask = m.u32((pStateFlags + dwordIdx * 4) >>> 0) >>> 0
      while (mask !== 0) {
        const bitIdx = fogBitScanForward113c(mask)
        if (bitIdx < 0) break
        const nState = ((dwordIdx << 5) + bitIdx) | 0
        mask = (mask & ~((1 << (bitIdx & 31)) >>> 0)) >>> 0
        if (nState < 0 || nState >= nStatesCount || pStatesTxtBase === 0) continue
        const pStateRec = (pStatesTxtBase + imul32(nState, 0x3c)) >>> 0
        if ((m.u8((pStateRec + 0x10) >>> 0) & 0x01) !== 0) continue
        if (((fogGetBitBufferSize113c(m, pBitStream) + 7) | 0) >= 0xdb) break

        fogWriteBits113c(m, pBitStream, nState, 8)
        const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, nState) >>> 0
        if (pStatList === 0) {
          fogWriteBits113c(m, pBitStream, 0, 1)
          continue
        }
        const nStats = STATLIST_CopyBaseStatsToBuffer113c(m, pStatList, pStatsBuf, 0x10) | 0
        if (nStats <= 0) {
          fogWriteBits113c(m, pBitStream, 0, 1)
          continue
        }
        fogWriteBits113c(m, pBitStream, 1, 1)
        writeUnitStateStatsBitstream113c(m, pDataTables, pBitStream, pStatsBuf, nStats)
        fogWriteBits113c(m, pBitStream, 0x1ff, 9)
      }
    }

    fogWriteBits113c(m, pBitStream, 0xff, 8)
    const totalLen = (fogGetBitBufferSize113c(m, pBitStream) + 7) & 0xff
    m.setU8((pPkt + 6) >>> 0, totalLen)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, totalLen)
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Walks `pUnit->pEventNotifyList` (`+0xE8`) and dispatches queued S2C packets (`0x23, 0x99, 0x9A, 0x9E, 0xA1, 0xA3, 0xA4, 0xA5, 0xAB`) to `pClient`.
 *
 * @va D2Game:0x6FC9ADF0
 */
export function UNIT_FlushEventNotifyQueueToClient113c(
  m: Memory113c,
  pClient: number,
  pUnit: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC9ADF0)
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  const pPkt = sp
  try {
    let pNode = m.u32((pUnit + 0xec) >>> 0) >>> 0
    while (pNode !== 0) {
      const opcode = m.u8((pNode + 0x04) >>> 0)
      switch (opcode) {
        case 0x9a:
          m.fill(pPkt, 0x11, 0)
          m.setU8(pPkt, 0x9a)
          m.setU32((pPkt + 1) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
          m.setU16((pPkt + 5) >>> 0, m.u16((pNode + 0x0a) >>> 0))
          m.setU16((pPkt + 7) >>> 0, m.u16((pNode + 0x08) >>> 0))
          m.setU32((pPkt + 9) >>> 0, m.u32(pNode >>> 0))
          m.setU16((pPkt + 13) >>> 0, m.u32((pNode + 0x0c) >>> 0) & 0xffff)
          m.setU16((pPkt + 15) >>> 0, (m.u32((pNode + 0x0c) >>> 0) >>> 16) & 0xffff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 0x11)
          break
        case 0xa4:
          m.setU8(pPkt, 0xa4)
          m.setU16((pPkt + 1) >>> 0, m.u16((pNode + 0x08) >>> 0))
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 3)
          break
        case 0xab:
          if (((m.u32((pUnit + 0xc4) >>> 0) >>> 15) & 1) === 0) {
            if (callees !== undefined && callees.onNotifyOpcode !== undefined) {
              callees.onNotifyOpcode(m, opcode, pClient, pUnit, pNode)
            }
          }
          break
        case 0x23:
        case 0x99:
        case 0x9e:
        case 0xa1:
        case 0xa3:
        case 0xa5:
          if (callees !== undefined && callees.onNotifyOpcode !== undefined) {
            callees.onNotifyOpcode(m, opcode, pClient, pUnit, pNode)
          }
          break
        default:
          break
      }
      pNode = m.u32(pNode >>> 0) >>> 0
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Full unit synchronization to `pClient` across unit types (`0..5`), including monster skill levels, states, and event queues.
 *
 * @va D2Game:0x6FC9B0A0
 */
export function UNIT_SendFullUnitSyncToClient113c(
  m: Memory113c,
  pClient: number,
  pUnit: number,
  dwFlags: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC9B0A0)
  if (pClient === 0) {
    throw new Error('UNIT_SendFullUnitSyncToClient113c: pClient == NULL (line 2802)')
  }
  if (pUnit === 0) {
    throw new Error('UNIT_SendFullUnitSyncToClient113c: pUnit == NULL (line 2803)')
  }
  const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
  if (pGame === 0) {
    throw new Error('UNIT_SendFullUnitSyncToClient113c: pGame == NULL (line 2806)')
  }
  if (((m.u32((pUnit + 0xc4) >>> 0) >>> 11) & 1) !== 0) return

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  const pPkt09 = sp
  const pTargetPos = (sp + 0x10) >>> 0
  try {
    PATH_GetTargetTypeAndPosition113c(m, pUnit, pTargetPos)
    const dwUnitType = m.u32(pUnit >>> 0)
    switch (dwUnitType) {
      case 0:
      case 2:
      case 4:
        if (callees !== undefined && callees.onUnitFullSyncPreSwitch !== undefined) {
          callees.onUnitFullSyncPreSwitch(m, dwUnitType, pClient, pUnit, dwFlags)
        }
        break
      case 3: {
        const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
        if (pPath !== 0) {
          PATH_GetVelocity113c(m, pPath)
        }
        if (callees !== undefined && callees.onUnitFullSyncPreSwitch !== undefined) {
          callees.onUnitFullSyncPreSwitch(m, dwUnitType, pClient, pUnit, dwFlags)
        }
        break
      }
      case 1: {
        const isDead = SUNIT_IsDeadOrDying113c(m, pUnit) !== 0
        if (!isDead || STATES_CheckStateMask2OnUnit113c(m, pUnit) !== 0) {
          const x = UNIT_GetPosX113c(m, pUnit)
          const y = UNIT_GetPosY113c(m, pUnit)
          STATLIST_SetUnitStat113c(m, pUnit, 0x148, (x + y) & 0xffff, 0)
          const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
          const pMonStatsTxt = pMonData !== 0 ? m.u32(pMonData >>> 0) >>> 0 : 0
          if (pMonStatsTxt !== 0) {
            const skillMask = m.u32((pMonStatsTxt + 0x16c) >>> 0)
            for (let i = 0; i < 8; i++) {
              if (((1 << i) & skillMask) !== 0) {
                const wSkillId = readI16(m, (pMonStatsTxt + 0x170 + i * 2) >>> 0)
                const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(
                  m,
                  pUnit,
                  wSkillId,
                )
                if (pSkill !== 0) {
                  SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 1)
                }
              }
            }
          }
          if (callees !== undefined && callees.onUnitFullSyncPreSwitch !== undefined) {
            callees.onUnitFullSyncPreSwitch(m, dwUnitType, pClient, pUnit, dwFlags)
          }
          UNIT_SendAllStatesBitstreamToClient113c(m, pUnit, pClient)
          UNIT_FlushEventNotifyQueueToClient113c(m, pClient, pUnit, callees)
          if (callees !== undefined && callees.onUnitFullSyncPostSwitch !== undefined) {
            callees.onUnitFullSyncPostSwitch(m, dwUnitType, pClient, pUnit, dwFlags)
          }
        }
        break
      }
      default: {
        m.fill(pPkt09, 0x0b, 0)
        m.setU8(pPkt09, 0x09)
        m.setU8((pPkt09 + 1) >>> 0, dwUnitType & 0xff)
        m.setU32((pPkt09 + 2) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
        m.setU8((pPkt09 + 6) >>> 0, m.u8((pUnit + 0x04) >>> 0))
        m.setU16((pPkt09 + 7) >>> 0, UNIT_GetPosX113c(m, pUnit) & 0xffff)
        m.setU16((pPkt09 + 9) >>> 0, UNIT_GetPosY113c(m, pUnit) & 0xffff)
        NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt09, 0x0b)
        break
      }
    }

    if (dwUnitType === 0) {
      if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0 && STATES_CheckState113c(m, pUnit, 7) !== 0) {
        const dwCorpseGuid = INVENTORY_GetLeftItemGuid113c(m, m.u32((pUnit + 0x60) >>> 0))
        if (dwCorpseGuid !== -1) {
          const pCorpseUnit = SUNIT_GetServerUnit113c(m, pGame, 0, dwCorpseGuid)
          if (
            pCorpseUnit !== 0 &&
            callees !== undefined &&
            callees.sendCorpseSyncPacket !== undefined
          ) {
            callees.sendCorpseSyncPacket(
              m,
              pClient,
              m.u32((pUnit + 0x0c) >>> 0),
              m.u32((pCorpseUnit + 0x0c) >>> 0),
            )
          }
        }
      }
      UNIT_SendAllStatesBitstreamToClient113c(m, pUnit, pClient)
      UNIT_FlushEventNotifyQueueToClient113c(m, pClient, pUnit, callees)
    }

    if (dwUnitType !== 1 && callees !== undefined && callees.onUnitFullSyncPostSwitch !== undefined) {
      callees.onUnitFullSyncPostSwitch(m, dwUnitType, pClient, pUnit, dwFlags)
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Appends `nSize` bytes from `pPacket` into `pClient`'s `0x208`-byte `D2PacketDataStrc` queue
 * (`pClient + 0x1B8` head, `+0x1BC` tail, `+0x1C0` free list; `node + 0x00` `nPacketSize <= 0x200`,
 * `node + 0x04` `pData[0x200]`, `node + 0x204` `pNext`).
 *
 * @va D2Game:0x6FCAA3E0
 */
export function NET_QueuePacketToClientBuffer113c(
  m: Memory113c,
  pClient: number,
  nChannel: number,
  pPacket: number,
  nSize: number,
): number {
  hitD2GameVa113c(0x6FCAA3E0)
  const esi = pClient >>> 0
  if (esi === 0 || nChannel !== 1) return 0
  const size = nSize | 0
  if (size <= 0) return 0
  if (size > 0x200) {
    throw new Error('NET_QueuePacketToClientBuffer113c: nSize > 0x200')
  }
  return NET_QueuePacketPtrToClient113c(m, esi, pPacket >>> 0, size)
}

/**
 * Copies 10 dwords (`0x28` = 40 bytes) from `pSrcPacket40` and queues them to `pClient` channel `1`.
 *
 * @va D2Game:0x6FCAB400
 */
export function NET_SendFixed40BytePacketToClient113c(
  m: Memory113c,
  pClient: number,
  pSrcPacket40: number,
): number {
  hitD2GameVa113c(0x6FCAB400)
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  try {
    for (let i = 0; i < 10; i++) {
      m.setU32((sp + i * 4) >>> 0, m.u32((pSrcPacket40 + i * 4) >>> 0))
    }
    return NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 0x28)
  } finally {
    bootInitGapStackPtr = sp
  }
}

function dispatchDefaultPlayerTimerEvent113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  evType: number,
  arg14: number,
  arg18: number,
): void {
  const sm = m as SparseMemory113c
  switch (evType | 0) {
    case 0:
      PLAYER_StepAnimationModeTick113c(m, pGame, pUnit, arg14, arg18)
      break
    case 1:
      PLAYER_FinishModeAndResetToNeutral113c(m, pGame, pUnit, arg14, arg18)
      break
    case 3:
      PLAYER_Event3_RegenTick113c(m, pGame, pUnit)
      break
    case 5:
      SKILLS_DispatchStateOnSrvDoFuncForSkill_6FCBE8E0_113c(sm, pGame, pUnit, arg14, arg18)
      break
    case 6:
      EVENT_HandleFreeHoverMsg_6FC99AA0_113c(sm, pGame, pUnit, arg14, arg18)
      break
    case 8:
      SKILLS_Event08_AuraPulseTick113c(m, pGame, pUnit, arg14, arg18)
      break
    case 9:
      SKILLS_OnPeriodicItemAuraEvent9_6FCC37D0_113c(sm, pGame, pUnit, arg14, arg18)
      break
    case 11:
      PLAYER_Event11_PeriodicTick113c(m, pGame, pUnit)
      break
    case 12:
      PLAYER_Event0C_ExpireTimedStats113c(m, pGame, pUnit, arg14, arg18)
      break
    case 13:
      D2Game_6FC93570_113c(sm, pGame, pUnit, arg14, arg18)
      break
    default:
      break
  }
}

function dispatchDefaultObjectTimerEvent113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  evType: number,
): void {
  const sm = m as SparseMemory113c
  switch (evType | 0) {
    case 0:
      OBJ_ThinkEventLightningSpire_6FC8E400_113c(sm, pGame, pUnit)
      break
    case 1:
      OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c(m, pGame, pUnit)
      break
    case 2:
      OBJ_IncrementWellChargesAndRefresh_6FC89CA0_113c(sm, pGame, pUnit)
      break
    case 3:
      OBJECTS_FloorSpikesEventTick_6FC8E270_113c(sm, pGame, pUnit)
      break
    case 4:
      OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c(sm, pGame, pUnit)
      break
    case 5:
      OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c(m, pGame, pUnit)
      break
    case 6:
      OBJ_EventHoverMsgTimeout_6FC8E470_113c(sm, pGame, pUnit)
      break
    case 7:
      QUESTS_ObjectEvent07_FastcallThunk_6FC8F510_113c(sm, pGame, pUnit)
      break
    case 8:
      OBJ_EventPeriodicOrTimeOfDaySync_6FC8E4E0_113c(sm, pGame, pUnit)
      break
    case 9:
      OBJ_ThinkEventSparkyChest_6FC8E150_113c(sm, pGame, pUnit)
      break
    case 10:
      OBJ_DropChestLootFromObjectUnit_6FC8B6F0_113c(sm, pGame, pUnit)
      break
    case 11:
      OBJECTS_LinkHellPortalToDestinationLevel_6FC8B930_113c(sm, pGame, pUnit)
      break
    default:
      break
  }
}

function dispatchDefaultItemTimerEvent113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  evType: number,
): void {
  const sm = m as SparseMemory113c
  switch (evType | 0) {
    case 3:
      ITEMS_ProcessItemDurabilityAndStackReplenish_6FCFA480_113c(sm, pGame, pUnit)
      break
    case 4:
      ITEMMODE_UnitTimerNoop113c(m, pGame, pUnit)
      break
    case 12:
      ITEMS_ExpireTimedStatSubListsEvent_6FCF1780_113c(m, pGame, pUnit)
      break
    default:
      break
  }
}

/**
 * Executes persistent and timed slot events for Partition 0 (`UNIT_PLAYER`).
 *
 * @va D2Game:0x6FCAE9A0
 */
export function EVENT_ExecutePlayerEvents113c(
  m: Memory113c,
  pGame: number,
  pTimer: number,
  nSlot: number,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FCAE9A0)
  let firedCount = 0
  let node = m.get(pTimer, D2TimerStrc.pPersistentHead, 0)
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
    const pUnit = m.get(node, D2EventStrc.pUnit)
    const evType = m.get(node, D2EventStrc.nType)
    const arg14 = m.get(node, D2EventStrc.dwArg14)
    const arg18 = m.get(node, D2EventStrc.dwArg18)
    const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
    firedCount++
    if (callees !== undefined && callees.dispatchPlayerEvent !== undefined) {
      callees.dispatchPlayerEvent(m, pGame, pUnit, evType, arg14, arg18, node)
    } else if (pfn === 0x6fd00410) {
      SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
    } else if (pfn === 0) {
      dispatchDefaultPlayerTimerEvent113c(m, pGame, pUnit, evType, arg14, arg18)
    }
    const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
    m.set(node, D2EventStrc.fFlags, postFlags)
    if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }

  const slot = nSlot & 63
  node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
      const pUnit = m.get(node, D2EventStrc.pUnit)
      const evType = m.get(node, D2EventStrc.nType)
      const arg14 = m.get(node, D2EventStrc.dwArg14)
      const arg18 = m.get(node, D2EventStrc.dwArg18)
      const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
      firedCount++
      if (callees !== undefined && callees.dispatchPlayerEvent !== undefined) {
        callees.dispatchPlayerEvent(m, pGame, pUnit, evType, arg14, arg18, node)
      } else if (pfn === 0x6fd00410) {
        SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
      } else if (pfn === 0) {
        dispatchDefaultPlayerTimerEvent113c(m, pGame, pUnit, evType, arg14, arg18)
      }
      const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
      m.set(node, D2EventStrc.fFlags, postFlags)
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }
  m.set(pTimer, D2TimerStrc.pSavedNext, 0)
  return firedCount
}

/**
 * Executes persistent and timed slot events for Partition 1 (`UNIT_MONSTER`).
 *
 * @va D2Game:0x6FCAEBC0
 */
export function EVENT_ExecuteMonsterEvents113c(
  m: Memory113c,
  pGame: number,
  pTimer: number,
  nSlot: number,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FCAEBC0)
  let firedCount = 0
  let node = m.get(pTimer, D2TimerStrc.pPersistentHead, 1)
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
    const pUnit = m.get(node, D2EventStrc.pUnit)
    const evType = m.get(node, D2EventStrc.nType)
    const arg14 = m.get(node, D2EventStrc.dwArg14)
    const arg18 = m.get(node, D2EventStrc.dwArg18)
    const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
    firedCount++
    if (callees !== undefined && callees.dispatchMonsterEvent !== undefined) {
      callees.dispatchMonsterEvent(m, pGame, pUnit, evType, arg14, arg18, node)
    } else if (pfn === 0x6fd00410) {
      SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
    } else if (callees !== undefined && callees.monsterEvents !== undefined) {
      MONSTER_DispatchEvent113c(m, pGame, pUnit, evType, arg14, arg18, callees.monsterEvents)
    }
    const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
    m.set(node, D2EventStrc.fFlags, postFlags)
    if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }

  const slot = 64 + (nSlot & 63)
  node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
      const pUnit = m.get(node, D2EventStrc.pUnit)
      const evType = m.get(node, D2EventStrc.nType)
      const arg14 = m.get(node, D2EventStrc.dwArg14)
      const arg18 = m.get(node, D2EventStrc.dwArg18)
      const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
      firedCount++
      if (callees !== undefined && callees.dispatchMonsterEvent !== undefined) {
        callees.dispatchMonsterEvent(m, pGame, pUnit, evType, arg14, arg18, node)
      } else if (pfn === 0x6fd00410) {
        SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
      } else if (callees !== undefined && callees.monsterEvents !== undefined) {
        MONSTER_DispatchEvent113c(m, pGame, pUnit, evType, arg14, arg18, callees.monsterEvents)
      }
      const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
      m.set(node, D2EventStrc.fFlags, postFlags)
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }
  m.set(pTimer, D2TimerStrc.pSavedNext, 0)
  return firedCount
}

/**
 * Executes persistent and timed slot events for Partition 3 (`UNIT_OBJECT`), freeing orphaned events whose room is NULL.
 *
 * @va D2Game:0x6FCAECC0
 */
export function EVENT_ExecuteObjectEvents113c(
  m: Memory113c,
  pGame: number,
  pTimer: number,
  nSlot: number,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FCAECC0)
  let firedCount = 0
  let node = m.get(pTimer, D2TimerStrc.pPersistentHead, 3)
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    const pUnit = m.get(node, D2EventStrc.pUnit)
    const pPath = pUnit !== 0 ? m.u32((pUnit + 0x2c) >>> 0) >>> 0 : 0
    const pRoom = (UNITS_GetRoom113c(m, pUnit) || (pPath !== 0 ? m.u32((pPath + 0x1c) >>> 0) : 0)) >>> 0
    if (pRoom === 0) {
      EVENT_FreeNode113c(m, pGame, node)
    } else {
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
      const evType = m.get(node, D2EventStrc.nType)
      const arg14 = m.get(node, D2EventStrc.dwArg14)
      const arg18 = m.get(node, D2EventStrc.dwArg18)
      const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
      firedCount++
      if (callees !== undefined && callees.dispatchObjectEvent !== undefined) {
        callees.dispatchObjectEvent(m, pGame, pUnit, evType, arg14, arg18, node)
      } else if (pfn === 0x6fd00410) {
        SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
      } else if (pfn === 0) {
        dispatchDefaultObjectTimerEvent113c(m, pGame, pUnit, evType)
      }
      const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
      m.set(node, D2EventStrc.fFlags, postFlags)
      if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
        EVENT_FreeNode113c(m, pGame, node)
      }
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }

  const slot = 192 + (nSlot & 63)
  node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
      const pUnit = m.get(node, D2EventStrc.pUnit)
      const pPath = pUnit !== 0 ? m.u32((pUnit + 0x2c) >>> 0) >>> 0 : 0
      const pRoom = (UNITS_GetRoom113c(m, pUnit) || (pPath !== 0 ? m.u32((pPath + 0x1c) >>> 0) : 0)) >>> 0
      if (pRoom === 0) {
        EVENT_FreeNode113c(m, pGame, node)
      } else {
        m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
        const evType = m.get(node, D2EventStrc.nType)
        const arg14 = m.get(node, D2EventStrc.dwArg14)
        const arg18 = m.get(node, D2EventStrc.dwArg18)
        const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
        firedCount++
        if (callees !== undefined && callees.dispatchObjectEvent !== undefined) {
          callees.dispatchObjectEvent(m, pGame, pUnit, evType, arg14, arg18, node)
        } else if (pfn === 0x6fd00410) {
          SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
        } else if (pfn === 0) {
          dispatchDefaultObjectTimerEvent113c(m, pGame, pUnit, evType)
        }
        const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
        m.set(node, D2EventStrc.fFlags, postFlags)
        EVENT_FreeNode113c(m, pGame, node)
      }
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }
  m.set(pTimer, D2TimerStrc.pSavedNext, 0)
  return firedCount
}

/**
 * Executes persistent and timed slot events for Partition 2 (`UNIT_MISSILE`), invoking `pNode->pfnHandler`.
 *
 * @va D2Game:0x6FCAEDD0
 */
export function EVENT_ExecuteMissileEvents113c(
  m: Memory113c,
  pGame: number,
  pTimer: number,
  nSlot: number,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FCAEDD0)
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x10) >>> 0
  let firedCount = 0
  const allowZero = callees !== undefined && callees.allowZeroHandler === true
  try {
    let node = m.get(pTimer, D2TimerStrc.pPersistentHead, 2)
    while (node !== 0) {
      m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
      const pUnit = m.get(node, D2EventStrc.pUnit)
      const pPath = pUnit !== 0 ? m.u32((pUnit + 0x2c) >>> 0) >>> 0 : 0
      const pRoom = pPath !== 0 ? m.u32((pPath + 0x1c) >>> 0) >>> 0 : 0
      if (pRoom === 0) {
        EVENT_FreeNode113c(m, pGame, node)
      } else {
        if (m.u32(pUnit >>> 0) === 3 && (m.u8((pUnit + 0xc4) >>> 0) & 4) !== 0) {
          PATH_GetTargetTypeAndPosition113c(m, pUnit, sp)
        }
        m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
        const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
        const evType = m.get(node, D2EventStrc.nType)
        const arg14 = m.get(node, D2EventStrc.dwArg14)
        const arg18 = m.get(node, D2EventStrc.dwArg18)
        if (callees !== undefined && callees.dispatchMissileEvent !== undefined) {
          if (pfn !== 0 || allowZero) {
            firedCount++
            callees.dispatchMissileEvent(m, pfn, pGame, pUnit, evType, arg14, arg18, node)
          } else {
            m.set(
              node,
              D2EventStrc.fFlags,
              m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_DEFERRED_FREE,
            )
          }
        } else if (pfn === 0x6fd00410) {
          firedCount++
          SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
        } else if (pfn === 0) {
          firedCount++
          MISSILE_DispatchFrameTick113c(m, pGame, pUnit)
        }
        const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
        m.set(node, D2EventStrc.fFlags, postFlags)
        if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
          EVENT_FreeNode113c(m, pGame, node)
        }
      }
      node = m.get(pTimer, D2TimerStrc.pSavedNext)
    }

    const slot = 128 + (nSlot & 63)
    node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
    const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
    while (node !== 0) {
      m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
      if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
        const pUnit = m.get(node, D2EventStrc.pUnit)
        const pPath = pUnit !== 0 ? m.u32((pUnit + 0x2c) >>> 0) >>> 0 : 0
        const pRoom = pPath !== 0 ? m.u32((pPath + 0x1c) >>> 0) >>> 0 : 0
        if (pRoom === 0) {
          EVENT_FreeNode113c(m, pGame, node)
        } else {
          if (m.u32(pUnit >>> 0) === 3 && (m.u8((pUnit + 0xc4) >>> 0) & 4) !== 0) {
            PATH_GetTargetTypeAndPosition113c(m, pUnit, sp)
          }
          m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
          const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
          const evType = m.get(node, D2EventStrc.nType)
          const arg14 = m.get(node, D2EventStrc.dwArg14)
          const arg18 = m.get(node, D2EventStrc.dwArg18)
          if (callees !== undefined && callees.dispatchMissileEvent !== undefined) {
            if (pfn !== 0 || allowZero) {
              firedCount++
              callees.dispatchMissileEvent(m, pfn, pGame, pUnit, evType, arg14, arg18, node)
            }
          } else if (pfn === 0x6fd00410) {
            firedCount++
            SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
          } else if (pfn === 0) {
            firedCount++
            MISSILE_DispatchFrameTick113c(m, pGame, pUnit)
          }
          const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
          m.set(node, D2EventStrc.fFlags, postFlags)
          EVENT_FreeNode113c(m, pGame, node)
        }
      }
      node = m.get(pTimer, D2TimerStrc.pSavedNext)
    }
    m.set(pTimer, D2TimerStrc.pSavedNext, 0)
  } finally {
    bootInitGapStackPtr = sp
  }
  return firedCount
}

/**
 * Executes persistent and timed slot events for Partition 4 (`UNIT_ITEM`), invoking `pNode->pfnHandler`.
 *
 * @va D2Game:0x6FCAEF20
 */
export function EVENT_ExecuteItemEvents113c(
  m: Memory113c,
  pGame: number,
  pTimer: number,
  nSlot: number,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FCAEF20)
  let firedCount = 0
  const allowZero = callees !== undefined && callees.allowZeroHandler === true
  let node = m.get(pTimer, D2TimerStrc.pPersistentHead, 4)
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
    const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
    const pUnit = m.get(node, D2EventStrc.pUnit)
    const evType = m.get(node, D2EventStrc.nType)
    const arg14 = m.get(node, D2EventStrc.dwArg14)
    const arg18 = m.get(node, D2EventStrc.dwArg18)
    if (callees !== undefined && callees.dispatchItemEvent !== undefined) {
      if (pfn !== 0 || allowZero) {
        firedCount++
        callees.dispatchItemEvent(m, pfn, pGame, pUnit, evType, arg14, arg18, node)
      } else {
        m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_DEFERRED_FREE)
      }
    } else if (pfn === 0x6fd00410) {
      firedCount++
      SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
    } else if (pfn === 0) {
      firedCount++
      dispatchDefaultItemTimerEvent113c(m, pGame, pUnit, evType)
    }
    const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
    m.set(node, D2EventStrc.fFlags, postFlags)
    if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }

  const slot = 256 + (nSlot & 63)
  node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
      const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
      const pUnit = m.get(node, D2EventStrc.pUnit)
      const evType = m.get(node, D2EventStrc.nType)
      const arg14 = m.get(node, D2EventStrc.dwArg14)
      const arg18 = m.get(node, D2EventStrc.dwArg18)
      if (callees !== undefined && callees.dispatchItemEvent !== undefined) {
        if (pfn !== 0 || allowZero) {
          firedCount++
          callees.dispatchItemEvent(m, pfn, pGame, pUnit, evType, arg14, arg18, node)
        }
      } else if (pfn === 0x6fd00410) {
        firedCount++
        SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
      } else if (pfn === 0) {
        firedCount++
        dispatchDefaultItemTimerEvent113c(m, pGame, pUnit, evType)
      }
      const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
      m.set(node, D2EventStrc.fFlags, postFlags)
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }
  m.set(pTimer, D2TimerStrc.pSavedNext, 0)
  return firedCount
}

/**
 * Walks all 5 acts in `pGame` (`+0xBC..+0xCC`) and frees the portal list on every room via `D2Common.#10732`.
 *
 * @va D2Game:0x6FCBD5B0
 */
export function ACT_FreeAllActRoomPortalLists113c(m: Memory113c, pGame: number): void {
  hitD2GameVa113c(0x6FCBD5B0)
  if (pGame === 0) {
    throw new Error('ACT_FreeAllActRoomPortalLists113c: pGame == NULL (line 223)')
  }
  for (let nAct = 0; nAct < 5; nAct++) {
    const pAct = m.u32((pGame + 0xbc + nAct * 4) >>> 0) >>> 0
    if (pAct !== 0) {
      let pRoom = DUNGEON_GetRoomExFromRoom113c(m, pAct) >>> 0
      while (pRoom !== 0) {
        DUNGEON_FreeRoomPortalList113c(m, pRoom)
        pRoom = m.u32((pRoom + 0x7c) >>> 0) >>> 0
      }
    }
  }
}
