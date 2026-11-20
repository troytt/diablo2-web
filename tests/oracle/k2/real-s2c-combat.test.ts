/**
 * Milestone 33 (`[K2]`) Real `D2Game.dll` v1.13c Non-Item Combat, Timed-State `D2StatListStrc`,
 * Room Saved-Unit Restoration (`0x6FC400E0`), Pure `fallen-ai` Ports, and `0x6FCAA3E0` S2C Packet
 * Emission Verification Suite.
 */
import { describe, expect, it } from 'vitest'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2AiGeneralStrc,
  D2AiGeneralStrc_SIZE,
  D2DamageStrc,
  D2DamageStrc_SIZE,
  D2GameStrc,
  D2GameStrc_SIZE,
  D2MonsterDataStrc,
  D2MonsterDataStrc_SIZE,
  D2PlayerDataStrc_SIZE,
  D2RoomCollisionGridStrc,
  D2RoomCollisionGridStrc_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2StatListStrc,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import {
  STATES_CheckState113c,
  STATLIST_CreateEx113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { STATLIST_GetStatListFromUnitAndStateMemPort113c } from '../../../src/d2kern-113c/common/k0-d2common-memports.ts'
import { UNITS_Create113c, UNITS_GetRoom113c } from '../../../src/d2kern-113c/common/unit.ts'
import { PATH_AllocDynamicPath113c } from '../../../src/d2kern-113c/common/path.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import { EVENT_GetNextEventFrame113c, EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_K2E_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_K2E_113C,
  MONSTER_Event03_RegenAndPoisonTick113c,
  MONSTER_Event12_ExpireTimedStats113c,
} from '../../../src/d2kern-113c/game/k2-gap-melee-dot-113c.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { SGPT_DATATABLES_VA_113C } from '../../../src/d2kern-113c/tables/lvl-tbls-113c.ts'
import { D2DynamicPathStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { DUNGEON_AddClientToRoom113c } from '../../../src/d2kern-113c/common/dungeon.ts'
import { ensureD2CommonPathGlobals113c } from '../../../src/d2kern-113c/game/tables-bootstrap-113c.ts'
import { getS2CPacketSize113c } from '../../../src/d2kern-113c/net/packet-sink.ts'
import {
  AI_ApproachTarget113c,
  AI_DispatchTargetByAiFlag113c,
  AI_FleeFrom113c,
  AI_GeneralFindTargetOrThrottle113c,
  AI_IdleWander113c,
  AI_Stall113c,
  AI_WarrivGreet113c,
  AIGENERAL_AllocAiCommand113c,
  AIGENERAL_ExpireMinionListsInAct113c,
  AIGENERAL_InitAiCommand113c,
  AIGENERAL_PopAiCommand113c,
  AiFallen113c,
  AiZombie113c,
  CLIENT_SyncRoomAndUnits113c,
  D2GAME_ARMOR_DURABILITY_SLOTS_6FD2E62C,
  GAME_ClearAllRoomUpdateQueues113c,
  GAME_UpdateGameFrame113c,
  MONSTER_BroadcastEventSoundToClients113c,
  MONSTER_CheckSandLeaperMidAir113c,
  MONSTER_EndDeath113c,
  MONSTER_EndToAiOrNeutral113c,
  MONSTER_SavePrevMode113c,
  MONSTER_StartDeath113c,
  MONSTER_StartMode113c,
  MONSTER_StartMove113c,
  MONSTER_StepRun113c,
  MONSTER_StepWalk113c,
  NET_QueuePacketToClient113c,
  PLAYER_RestoreHandSkillsFromSnapshot113c,
  PLAYER_ScheduleSkillActionFrameEvents113c,
  PLAYER_SnapshotHandSkillsToStruct113c,
  PLAYER_StartModeAttackWithTarget113c,
  PLAYER_StartModeDispatch113c,
  PLAYER_StartModeSkill113c,
  PLAYER_SyncLifeManaStaminaGoldExp113c,
  ROOM_ActivateRoomForClient113c,
  ROOM_DeactivateMonsterInRoom113c,
  ROOM_DeactivateRoomForClient113c,
  ROOM_DeactivateUnitInRoom113c,
  ROOM_RefreshUnitsAndLoadSaved113c,
  S2C_SendPacket07_AddRoom113c,
  S2C_SendPacket08_RemoveRoom113c,
  S2C_SendPacket09_AssignWarp113c,
  S2C_SendPacket0A_RemoveUnit113c,
  S2C_SendPacket0C_NpcHit113c,
  S2C_SendPacket0D_PlayerStop113c,
  S2C_SendPacket0E_ObjectState113c,
  S2C_SendPacket18_LifeManaPot113c,
  S2C_SendPacket1D_1E_1F_SetAttribute113c,
  S2C_SendPacket23_SetSkill113c,
  S2C_SendPacket2C_UnitSound113c,
  S2C_SendPacket3E_UpdateItemStat113c,
  S2C_SendPacket51_AssignObject113c,
  S2C_SendPacket59_AssignPlayer113c,
  S2C_SendPacket65_PlayerKillCount113c,
  S2C_SendPacket67_NpcMove113c,
  S2C_SendPacket68_NpcMoveToTarget113c,
  S2C_SendPacket69_NpcState113c,
  S2C_SendPacket6C_NpcAttack113c,
  S2C_SendPacket6D_NpcStop113c,
  S2C_SendPacket8A_NpcWantsInteract113c,
  S2C_SendPacket8D_AssignParty113c,
  S2C_SendPacket95_LifeManaChange113c,
  S2C_SendPacket96_WalkVerify113c,
  S2C_SendPacket99_SkillTriggered113c,
  S2C_SendPacketA8_SetState113c,
  S2C_SendPacketA9_EndState113c,
  S2C_SendPacketAA_StateSync113c,
  S2C_SendPacketAB_UnitHeal113c,
  STATES_OnColdStateRemoved_6FCFB4C0_113c,
  STATES_OnFreezeStateRemoved_6FCFBD90_113c,
  SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ApplyArmorDurabilityAndGetHit113c,
  SUNITDMG_ApplyArmorPenetrationAndFlatBonus113c,
  SUNITDMG_ApplyAttackerThornsToSelf113c,
  SUNITDMG_ApplyBurnEffect_6FCFC940_113c,
  SUNITDMG_ApplyColdChilledEffect113c,
  SUNITDMG_ApplyColdOrFreezeState113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplyFreezeEffect113c,
  SUNITDMG_ApplyPoisonEffect113c,
  SUNITDMG_ApplyStunEffect113c,
  SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c,
  SUNITDMG_CheckToHit113c,
  SUNITDMG_ClampManaBurnByMonsterSkill113c,
  SUNITDMG_ComputeExperienceGain113c,
  SUNITDMG_DistributeExperience113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_ExecuteSingleHit113c,
  SUNITDMG_FindCombatDamageData113c,
  SUNITDMG_GetColdEffectLengthBonus113c,
  SUNITDMG_GetEffectiveResistance113c,
  SUNITDMG_GetPvpOrPetDamageMultiplier113c,
  SUNITDMG_GetTotalSkillDamageBonus113c,
  SUNITDMG_RollDodgeAvoidEvadeBlock113c,
  SUNITDMG_TriggerAttackerBlindOrFlee113c,
  SUNITDMG_TriggerBlockEvents113c,
  SUNITDMG_TriggerPostCombatEvents113c,
  UNITS_GetDistanceToCoordinates113c,
  drainClientS2CPackets113c,
  drainFrameS2CPackets113c,
} from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c.ts'
import {
  PLAYER_DrainRunStamina113c,
  PLAYER_Event11_PeriodicTick113c,
  PLAYER_Event3_RegenTick113c,
  PLAYER_GetEquippedWeapon113c,
  PLAYER_UpdateHpRegen113c,
  PLAYER_UpdateManaRegen113c,
  PLAYER_UpdateStaminaRegen113c,
} from '../../../src/d2kern-113c/game/replay-kernel-113c.ts'

const D2COMMON_SGPT_DATATABLES_VA = 0x6fde9e1c
const D2COMMON_GDW_BITMASKS_IAT_VA = 0x6fdd90b0
const D2COMMON_ITEMS_TXT_COUNT_VA = 0x6fdefb94
const D2COMMON_ITEMS_TXT_PTR_VA = 0x6fdefb98
const D2COMMON_OBJECTS_TXT_PTR_VA = 0x6fdf0b94
const D2COMMON_OBJECTS_TXT_COUNT_VA = 0x6fdf0b98

interface RealK2World {
  m: SparseMemory113c
  pDataTables: number
  pMonStatsTxt: number
  pObjectsTxt: number
  pItemsTxt: number
  pItemTypesTxt: number
  pGame: number
  pAct0: number
  pRoom: number
  pClient: number
  pPlayer: number
}

function createRealK2World(levelId = 2): RealK2World {
  const m = new SparseMemory113c()

  // 1. gdwBitMasks
  const pBitMasks = m.alloc(32 * 4)
  for (let i = 0; i < 32; i++) {
    m.setU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(D2COMMON_GDW_BITMASKS_IAT_VA, pBitMasks)
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_K2E_113C, pBitMasks)

  // 2. sgptDataTables
  const pDataTables = m.alloc(0x1000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.fill(0x6fd2e000, 0x2000, 0)
  m.fill(0x6fddd458, 8, 0)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA, pDataTables)
  m.setU32(SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_K2E_113C, pBitMasks)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_K2E_113C, D2COMMON_SGPT_DATATABLES_VA)

  // StatesTxt (185 states * 0x40)
  const nStates = 185
  const pStatesTxt = m.alloc(nStates * 0x40)
  const pCurseMasks = m.alloc(8 * 4)
  const pStateMask6 = m.alloc(8 * 4)
  const pStateMask32 = m.alloc(8 * 4)
  const pStateMaskExp = m.alloc(8 * 4)
  // Mark Dim Vision (23) & Terror (19) as curses in pCurseMasks
  m.setU32(pCurseMasks, ((1 << 23) | (1 << 19)) >>> 0)
  m.setU32((pDataTables + 0xbc) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xc0) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xc4) >>> 0, nStates)
  m.setU32((pDataTables + 0xdc) >>> 0, pStateMask6)
  m.setU32((pDataTables + 0xe0) >>> 0, pStateMask6)
  m.setU32((pDataTables + 0xe4) >>> 0, pCurseMasks)
  m.setU32((pDataTables + 0xfc) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + 0x100) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + 0x104) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + 0x10c) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + 0x140) >>> 0, pStateMask32)
  m.setU32((pDataTables + 0x144) >>> 0, pStateMask32)
  m.setU32((pDataTables + 0x14c) >>> 0, pStateMask32)

  // MonStatsTxt (734 * 0x1A8) & MonStats2Txt (734 * 0x134)
  const nMonsters = 734
  const pMonStatsTxt = m.alloc(nMonsters * 0x1a8)
  const pMonStats2Txt = m.alloc(nMonsters * 0x134)
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + 0xa80) >>> 0, nMonsters)
  m.setU32((pDataTables + 0xa88) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, nMonsters)
  for (let i = 0; i < nMonsters; i++) {
    const pM = (pMonStatsTxt + i * 0x1a8) >>> 0
    m.setU16((pM + 0x02) >>> 0, i)
    m.setU16((pM + 0x06) >>> 0, i)
    m.setU16((pM + 0x18) >>> 0, i)
    m.setU32((pM + 0x0c) >>> 0, 0x8000)
    // Default nColdEffect = -50 (`0xCE` signed i8) at +0x175..+0x177
    m.setU8((pM + 0x175) >>> 0, 0xce)
    m.setU8((pM + 0x176) >>> 0, 0xce)
    m.setU8((pM + 0x177) >>> 0, 0xce)
    const pM2 = (pMonStats2Txt + i * 0x134) >>> 0
    m.setU8((pM2 + 0x08) >>> 0, 2)
    m.setU8((pM2 + 0x09) >>> 0, 2)
    m.setU32((pM2 + 0xf0) >>> 0, 0xa07f)
    m.setU8((pM2 + 0x130) >>> 0, 2) // nRestore = 2 (always save/restore on room deactivate)
  }

  // ItemStatCostTxt (360 * 0x144) & CharStatsTxt (7 * 0xC4)
  const pCharStatsTxt = m.alloc(7 * 0xc4)
  for (let i = 0; i < 7; i++) {
    m.setU32((pCharStatsTxt + i * 0xc4 + 0x4c) >>> 0, 0x20687468)
  }
  m.setU32((pDataTables + 0xbc4) >>> 0, pCharStatsTxt)
  m.setU32((pDataTables + 0xbc8) >>> 0, 7)
  const pIscTxt = m.alloc(360 * 0x144)
  // Configure STAT_QUANTITY (70) & STAT_DURABILITY (72) sendBits in ItemStatCostTxt for 0x3E bitpacking
  m.setU8((pIscTxt + 70 * 0x144 + 0x08) >>> 0, 9) // sendBits = 9
  m.setU8((pIscTxt + 72 * 0x144 + 0x08) >>> 0, 9) // sendBits = 9
  m.setU32((pDataTables + 0xbcc) >>> 0, pIscTxt)
  m.setU32((pDataTables + 0xbd4) >>> 0, 360)

  // ItemsTxt (16 * 0x1A8) & ItemTypesTxt (96 * 0xE4)
  const nItems = 16
  const pItemsTxt = m.alloc(nItems * 0x1a8)
  m.setU32(D2COMMON_ITEMS_TXT_COUNT_VA, nItems)
  m.setU32(D2COMMON_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32((pDataTables + 0xaa8) >>> 0, nItems)
  m.setU32((pDataTables + 0xaac) >>> 0, pItemsTxt)
  const nItemTypes = 96
  const pItemTypesTxt = m.alloc(nItemTypes * 0xe4)
  const pItemTypesEquiv = m.alloc(nItemTypes * 3 * 4)
  m.setU32((pDataTables + 0xbf8) >>> 0, pItemTypesTxt)
  m.setU32((pDataTables + 0xbfc) >>> 0, nItemTypes)
  m.setU32((pDataTables + 0xc00) >>> 0, 3)
  m.setU32((pDataTables + 0xc04) >>> 0, pItemTypesEquiv)
  for (let t = 0; t < nItemTypes; t++) {
    const col = t >>> 5
    const bit = (1 << (t & 31)) >>> 0
    m.setU32((pItemTypesEquiv + (t * 3 + col) * 4) >>> 0, bit)
  }
  // Type 43 (Javelin) also inherits Type 45 (Weapon)
  m.setU32(
    (pItemTypesEquiv + (43 * 3 + (45 >>> 5)) * 4) >>> 0,
    (m.u32((pItemTypesEquiv + (43 * 3 + (45 >>> 5)) * 4) >>> 0) | (1 << (45 & 31))) >>> 0,
  )
  // Item 0: Sword (type 45 weapon), Item 1: Buckler (type 2 shield), Item 2: Javelin (type 43 stackable + weapon 45)
  m.setU16((pItemsTxt + 0 * 0x1a8 + 0x11e) >>> 0, 45)
  m.setU16((pItemsTxt + 1 * 0x1a8 + 0x11e) >>> 0, 2)
  m.setU16((pItemsTxt + 2 * 0x1a8 + 0x11e) >>> 0, 43)

  // ObjectsTxt (32 * 0x1C0) & LevelsTxt (8 * 0x220)
  const nObjects = 32
  const pObjectsTxt = m.alloc(nObjects * 0x1c0)
  m.setU32(D2COMMON_OBJECTS_TXT_PTR_VA, pObjectsTxt)
  m.setU32(D2COMMON_OBJECTS_TXT_COUNT_VA, nObjects)
  m.setU32((pDataTables + 0xad8) >>> 0, pObjectsTxt)
  m.setU32((pDataTables + 0xae0) >>> 0, nObjects)
  const pLevelsTxt = m.alloc(8 * 0x220)
  m.setU32((pDataTables + 0xadc - 0x50) >>> 0, pLevelsTxt)
  const pMonLvlTxt = m.alloc(110 * 0x78)
  m.setU32((pDataTables + 0xb70) >>> 0, pMonLvlTxt)
  m.setU32((pDataTables + 0xb74) >>> 0, 110)
  m.setU32(0x6fdf0b54, pMonLvlTxt)
  m.setU32(0x6fdf0b58, 110)

  // AnimData.d2 & static D2Common animation globals
  m.setU32(0x20, 0x20687468)
  m.fill(0x6fdf13a4, 0x30, 0)
  m.setU32(0x6fdf13c8, 1)
  const pAnimTable = m.alloc(0x500)
  const pEmptyBucket = m.alloc(8)
  for (let h = 0; h < 256; h++) {
    m.setU32((pAnimTable + h * 4) >>> 0, pEmptyBucket)
  }
  m.setU32((pAnimTable + 0x404 + 0x08) >>> 0, 8)
  m.setU32((pAnimTable + 0x404 + 0x0c) >>> 0, 256)
  m.setU32(0x6fdf0b4c, pAnimTable)
  m.fill(0x6fde3368, 13 * 8, 0)
  m.fill(0x6fde4608, 6 * 12, 0)
  m.fill(0x6fddc5f8, 0x400, 0)
  ensureD2CommonPathGlobals113c(m)

  // 3. D2GameStrc + D2ActStrc + TimerQueue
  const pGame = m.alloc(D2GameStrc_SIZE)
  m.set(pGame, D2GameStrc.dwGameFrame, 100)
  m.set(pGame, D2GameStrc.bExpansion, 1)
  m.setU32((pGame + 0xd0) >>> 0, 0x12345678)
  m.setU32((pGame + 0xd4) >>> 0, 0x0000029a)
  const pAct0 = m.alloc(0x80)
  m.setU8((pAct0 + 0x08) >>> 0, 0)
  m.setU32((pGame + 0xbc) >>> 0, pAct0)
  EVENT_InitTimerQueue113c(m, pGame)

  // 4. D2ActiveRoomStrc (`tileX = 0x0460`, `tileY = 0x0488`, `levelId = 2`)
  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
  const pRoomEx = m.alloc(D2RoomExStrc_SIZE)
  const pLevel = m.alloc(0x230)
  m.setU32((pLevel + 0x1d0) >>> 0, levelId)
  m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
  const pLogical = m.alloc(0x40)
  m.setU8(pLogical, 1)
  m.setU32((pRoomEx + 0x64) >>> 0, pLogical)
  m.set(pRoom, D2ActiveRoomStrc.pAct, pAct0)
  m.setU32((pAct0 + 0x04) >>> 0, pRoom)
  m.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, m.alloc(8))

  const tileX = 0x0460
  const tileY = 0x0488
  const subX = tileX * 5
  const subY = tileY * 5
  const subW = 40
  const subH = 40
  m.set(pRoom, D2ActiveRoomStrc.nSubtileX, subX)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileY, subY)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileWidth, subW)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileHeight, subH)
  m.set(pRoom, D2ActiveRoomStrc.nTileX, tileX)
  m.set(pRoom, D2ActiveRoomStrc.nTileY, tileY)
  m.set(pRoom, D2ActiveRoomStrc.nTileWidth, 8)
  m.set(pRoom, D2ActiveRoomStrc.nTileHeight, 8)

  const pCoords = m.alloc(0x40)
  m.setU32((pCoords + 0x00) >>> 0, subX)
  m.setU32((pCoords + 0x04) >>> 0, subY)
  m.setU32((pCoords + 0x08) >>> 0, subW)
  m.setU32((pCoords + 0x0c) >>> 0, subH)
  m.setU32((pCoords + 0x10) >>> 0, tileX)
  m.setU32((pCoords + 0x14) >>> 0, tileY)
  m.setU32((pCoords + 0x18) >>> 0, 8)
  m.setU32((pCoords + 0x1c) >>> 0, 8)
  m.set(pRoom, D2ActiveRoomStrc.pCoords, pCoords)

  const ppNear = m.alloc(8)
  m.setU32(ppNear, pRoom)
  m.set(pRoom, D2ActiveRoomStrc.ppRoomsNear, ppNear)
  m.set(pRoom, D2ActiveRoomStrc.nRoomsNear, 1)

  const pColGrid = m.alloc(D2RoomCollisionGridStrc_SIZE)
  const pColMap = m.alloc(subW * subH * 2)
  m.set(pColGrid, D2RoomCollisionGridStrc.nSubtileX, subX)
  m.set(pColGrid, D2RoomCollisionGridStrc.nSubtileY, subY)
  m.set(pColGrid, D2RoomCollisionGridStrc.nSubtileWidth, subW)
  m.set(pColGrid, D2RoomCollisionGridStrc.nSubtileHeight, subH)
  m.set(pColGrid, D2RoomCollisionGridStrc.nTileX, tileX)
  m.set(pColGrid, D2RoomCollisionGridStrc.nTileY, tileY)
  m.set(pColGrid, D2RoomCollisionGridStrc.nTileWidth, 8)
  m.set(pColGrid, D2RoomCollisionGridStrc.nTileHeight, 8)
  m.set(pColGrid, D2RoomCollisionGridStrc.pMapStart, pColMap)
  m.set(pRoom, D2ActiveRoomStrc.pCollisionGrid, pColGrid)

  // 5. Player + D2ClientStrc (`dwClientState = 4`)
  const pClient = m.alloc(0x520)
  m.setU32(pClient, 1) // dwClientId = 1
  m.setU32((pClient + 0x04) >>> 0, 4) // CLIENTS_STATE_INGAME = 4
  m.setU32((pGame + 0x88) >>> 0, pClient) // pGame->pClientList

  const pPlayer = spawnUnitInWorld(m, pGame, pRoom, 0, 4, 1, subX + 10, subY + 10)
  const pPlrData = m.get(pPlayer, D2UnitStrc.pUnitData)
  m.setU32((pPlrData + 0x9c) >>> 0, pClient)
  m.setU32((pClient + 0x16c) >>> 0, 0)
  m.setU32((pClient + 0x170) >>> 0, 1)
  m.setU32((pClient + 0x174) >>> 0, pPlayer)
  m.setU32((pClient + 0x178) >>> 0, pRoom)
  m.setU32((pClient + 0x1a8) >>> 0, pGame)
  m.setU32((pClient + 0x1b4) >>> 0, pRoom)
  m.setU32((pClient + 0x3d4) >>> 0, 1)

  STATLIST_SetUnitStat113c(m, pPlayer, 12, 5, 0) // clvl 5
  STATLIST_SetUnitStat113c(m, pPlayer, 0, 40, 0) // str 40
  STATLIST_SetUnitStat113c(m, pPlayer, 2, 35, 0) // dex 35
  STATLIST_SetUnitStat113c(m, pPlayer, 6, 80 << 8, 0) // HP 80
  STATLIST_SetUnitStat113c(m, pPlayer, 7, 80 << 8, 0) // MaxHP 80
  STATLIST_SetUnitStat113c(m, pPlayer, 8, 30 << 8, 0) // MP 30
  STATLIST_SetUnitStat113c(m, pPlayer, 9, 30 << 8, 0) // MaxMP 30
  STATLIST_SetUnitStat113c(m, pPlayer, 10, 100 << 8, 0) // Stamina 100
  STATLIST_SetUnitStat113c(m, pPlayer, 11, 100 << 8, 0) // MaxStamina 100
  STATLIST_SetUnitStat113c(m, pPlayer, 19, 120, 0) // AR
  GAME_ClearAllRoomUpdateQueues113c(m, pGame)

  return {
    m,
    pDataTables,
    pMonStatsTxt,
    pObjectsTxt,
    pItemsTxt,
    pItemTypesTxt,
    pGame,
    pAct0,
    pRoom,
    pClient,
    pPlayer,
  }
}

function spawnUnitInWorld(
  m: SparseMemory113c,
  pGame: number,
  pRoom: number,
  unitType: 0 | 1,
  classId: number,
  unitId: number,
  x: number,
  y: number,
): number {
  const pUnit = UNITS_Create113c(m, unitType, classId, unitId, pGame)
  m.set(pUnit, D2UnitStrc.dwAnimMode, 1)
  m.set(pUnit, D2UnitStrc.dwFlags, 0x0c)
  m.setU32((pUnit + 0x20) >>> 0, 0x13579bdf)
  m.setU32((pUnit + 0x24) >>> 0, 0x0000029a)

  if (unitType === 0) {
    const pPlrData = m.alloc(D2PlayerDataStrc_SIZE)
    m.set(pUnit, D2UnitStrc.pUnitData, pPlrData)
  } else {
    const pMonData = m.alloc(D2MonsterDataStrc_SIZE)
    const pAiGen = m.alloc(D2AiGeneralStrc_SIZE)
    m.set(pMonData, D2MonsterDataStrc.pAiGeneral, pAiGen)
    m.set(pUnit, D2UnitStrc.pUnitData, pMonData)
  }

  STATLIST_CreateEx113c(m, pUnit, 0, pGame)
  PATH_AllocDynamicPath113c(m, 0, pRoom, x, y, pUnit, 0)
  SUNIT_InsertServerUnit113c(m, pGame, pUnit)
  return pUnit
}

function equipTestItem(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  itemClassId: number,
  itemId: number,
  bodyLoc: number,
  durability = 20,
  maxDurability = 20,
): number {
  let pInv = m.get(pPlayer, D2UnitStrc.pInventory)
  if (pInv === 0) {
    pInv = m.alloc(0x40)
    m.setU32(pInv, 0x1020304) // INVENTORY_MAGIC
    m.setU32((pInv + 0x08) >>> 0, pPlayer)
    m.set(pPlayer, D2UnitStrc.pInventory, pInv)
  }
  const pItem = UNITS_Create113c(m, 4, itemClassId, itemId, pGame)
  const pItemData = m.alloc(0x74)
  // Raw D2ItemDataStrc offsets (+0x0C dwOwnerGUID, +0x10 dwInitSeed, +0x14 dwCommandFlags, +0x18 dwItemFlags, +0x28 dwFileIndex)
  m.setU32(pItemData, 2) // quality = Normal
  m.setU32((pItemData + 0x0c) >>> 0, m.get(pPlayer, D2UnitStrc.dwUnitId) >>> 0)
  m.setU32((pItemData + 0x10) >>> 0, 0xabcdef01)
  m.setU32((pItemData + 0x18) >>> 0, 0x10) // ITEMFLAG_IDENTIFIED
  m.setU8((pItemData + 0x44) >>> 0, 0xff) // equipped node page
  m.setU8((pItemData + 0x45) >>> 0, bodyLoc & 0xff)
  m.set(pItem, D2UnitStrc.pUnitData, pItemData)

  STATLIST_CreateEx113c(m, pItem, 0, pGame)
  STATLIST_SetUnitStat113c(m, pItem, 72, durability, 0)
  STATLIST_SetUnitStat113c(m, pItem, 73, maxDurability, 0)

  const prevHead = m.u32((pInv + 0x0c) >>> 0) >>> 0
  m.setU32((pItemData + 0x5c + 0x08) >>> 0, prevHead)
  m.setU32((pInv + 0x0c) >>> 0, pItem)
  let pGrids = m.u32((pInv + 0x14) >>> 0) >>> 0
  if (pGrids === 0) {
    pGrids = m.alloc(16)
    const ppItems = m.alloc(13 * 4)
    m.setU8((pGrids + 0x08) >>> 0, 13)
    m.setU8((pGrids + 0x09) >>> 0, 1)
    m.setU32((pGrids + 0x0c) >>> 0, ppItems)
    m.setU32((pInv + 0x14) >>> 0, pGrids)
    m.setU32((pInv + 0x18) >>> 0, 1)
  }
  const ppBodyItems = m.u32((pGrids + 0x0c) >>> 0) >>> 0
  if (ppBodyItems !== 0 && bodyLoc >= 0 && bodyLoc < 13) {
    m.setU32((ppBodyItems + bodyLoc * 4) >>> 0, pItem)
  }
  if (bodyLoc === 4) {
    m.setU32((pInv + 0x24) >>> 0, itemId >>> 0)
  }
  SUNIT_InsertServerUnit113c(m, pGame, pItem)
  return pItem
}

describe('K2 Real D2Game Non-Item Combat, Timed StatLists, Room Restore & 0x6FCAA3E0 S2C Pipeline', () => {
  it('1. 0x6FC400E0 ROOM_RefreshUnitsAndLoadSaved113c restores non-expired items, Shrines (Event 5), Wells (Event 2), and corpses', () => {
    const w = createRealK2World(2)
    const { m, pGame, pRoom, pObjectsTxt } = w
    const subX = m.get(pRoom, D2ActiveRoomStrc.nSubtileX)
    const subY = m.get(pRoom, D2ActiveRoomStrc.nSubtileY)

    // Configure Object classId 5 as a Shrine (subClass bit 0 = 0x01 at +0x167) and classId 6 as a Well (subClass bit 5 = 0x20, regenRate +0x178 = 50, halfCap +0x180 = 2 -> maxCharges = 4)
    m.setU8((pObjectsTxt + 5 * 0x1c0 + 0x167) >>> 0, 0x01)
    m.setU8((pObjectsTxt + 6 * 0x1c0 + 0x167) >>> 0, 0x20)
    m.setU32((pObjectsTxt + 6 * 0x1c0 + 0x178) >>> 0, 50)
    m.setU32((pObjectsTxt + 6 * 0x1c0 + 0x180) >>> 0, 2)

    // Create a server ground item (GUID 42) currently detached from room, plus an expired item node (GUID 43)
    const pGroundItem = UNITS_Create113c(m, 4, 0, 42, pGame)
    const pStaticPath = m.alloc(0x20)
    m.set(pGroundItem, D2UnitStrc.pPath, pStaticPath)
    SUNIT_InsertServerUnit113c(m, pGame, pGroundItem)

    const pExpiredItem = UNITS_Create113c(m, 4, 0, 43, pGame)
    m.set(pExpiredItem, D2UnitStrc.pPath, m.alloc(0x20))
    SUNIT_InsertServerUnit113c(m, pGame, pExpiredItem)

    // Saved item list: item 42 expires at frame 250 (> 100), item 43 expired at frame 80 (< 100)
    const pItemNode1 = m.alloc(0x10)
    const pItemNode2 = m.alloc(0x10)
    m.setU32(pItemNode1, pItemNode2)
    m.setU32((pItemNode1 + 0x04) >>> 0, 250)
    m.setU32((pItemNode1 + 0x08) >>> 0, 42)
    m.setU16((pItemNode1 + 0x0c) >>> 0, subX + 6)
    m.setU16((pItemNode1 + 0x0e) >>> 0, subY + 7)

    m.setU32(pItemNode2, 0)
    m.setU32((pItemNode2 + 0x04) >>> 0, 80)
    m.setU32((pItemNode2 + 0x08) >>> 0, 43)
    m.setU16((pItemNode2 + 0x0c) >>> 0, subX + 8)
    m.setU16((pItemNode2 + 0x0e) >>> 0, subY + 8)

    // Saved unit list: Shrine (classId 5, recharge frame 300 = 0x0000_012C, shrineId = 7) -> Well (classId 6, charges = 1, savedFrame = 90)
    const pShrineNode = m.alloc(0x34)
    const pWellNode = m.alloc(0x34)
    m.setU32(pShrineNode, subX + 12)
    m.setU32((pShrineNode + 0x04) >>> 0, subY + 12)
    m.setU32((pShrineNode + 0x08) >>> 0, 2) // UNIT_OBJECT
    m.setU32((pShrineNode + 0x0c) >>> 0, 5) // Shrine
    m.setU32((pShrineNode + 0x10) >>> 0, 2) // Operating/depleted
    m.setU32((pShrineNode + 0x14) >>> 0, 95) // savedFrame != 0
    m.setU16((pShrineNode + 0x20) >>> 0, 0) // hi16 of targetFrame
    m.setU16((pShrineNode + 0x24) >>> 0, 300) // lo16 of targetFrame
    m.setU8((pShrineNode + 0x28) >>> 0, 7) // bShrineId = 7
    m.setU32((pShrineNode + 0x30) >>> 0, pWellNode)

    m.setU32(pWellNode, subX + 16)
    m.setU32((pWellNode + 0x04) >>> 0, subY + 16)
    m.setU32((pWellNode + 0x08) >>> 0, 2)
    m.setU32((pWellNode + 0x0c) >>> 0, 6) // Well
    m.setU32((pWellNode + 0x10) >>> 0, 1)
    m.setU32((pWellNode + 0x14) >>> 0, 40) // savedFrame = 40 (gameFrame = 100, regenRate = 50 -> +1 offline tick -> charges 2)
    m.setU8((pWellNode + 0x28) >>> 0, 1)

    // Link 0x18-byte inactive room node at pGame + 0xD8 (Act 0)
    const pRoomNode = m.alloc(0x18)
    m.setU32(pRoomNode, subX)
    m.setU32((pRoomNode + 0x04) >>> 0, subY)
    m.setU32((pRoomNode + 0x08) >>> 0, pItemNode1)
    m.setU32((pRoomNode + 0x10) >>> 0, pShrineNode)
    m.setU32((pGame + 0xd8) >>> 0, pRoomNode)

    ROOM_RefreshUnitsAndLoadSaved113c(m, pGame, pRoom)

    // Inactive room node was unlinked from pGame + 0xD8
    expect(m.u32((pGame + 0xd8) >>> 0)).toBe(0)
    // Non-expired item 42 restored into pRoom; expired item 43 NOT restored
    expect(UNITS_GetRoom113c(m, pGroundItem)).toBe(pRoom)
    expect(UNITS_GetRoom113c(m, pExpiredItem)).toBe(0)

    // Verify spawned Shrine & Well objects in pRoom
    let foundShrine = 0
    let foundWell = 0
    let u = m.get(pRoom, D2ActiveRoomStrc.pUnitFirst)
    while (u !== 0) {
      if (m.u32(u) === 2) {
        const cls = m.get(u, D2UnitStrc.dwClassId)
        if (cls === 5) foundShrine = u
        if (cls === 6) foundWell = u
      }
      u = m.get(u, D2UnitStrc.pRoomUnitNext)
    }
    expect(foundShrine).not.toBe(0)
    expect(m.u8((m.get(foundShrine, D2UnitStrc.pUnitData) + 0x04) >>> 0)).toBe(7)
    expect(EVENT_GetNextEventFrame113c(m, foundShrine, 5)).toBe(300)

    expect(foundWell).not.toBe(0)
    expect(m.u8((m.get(foundWell, D2UnitStrc.pUnitData) + 0x04) >>> 0)).toBe(2)
    expect(EVENT_GetNextEventFrame113c(m, foundWell, 2)).toBeGreaterThan(100)
  })

  it('2. 0x6FCBDC10 / 0x6FCBD980 room activate/deactivate queues exact 0x07, 0x0A, and 0x08 S2C packets via 0x6FCAA3E0', () => {
    const w = createRealK2World(2)
    const { m, pGame, pRoom, pClient } = w

    // Spawn a monster (unitId = 9) in pRoom
    spawnUnitInWorld(
      m,
      pGame,
      pRoom,
      1,
      0,
      9,
      m.get(pRoom, D2ActiveRoomStrc.nSubtileX) + 5,
      m.get(pRoom, D2ActiveRoomStrc.nSubtileY) + 5,
    )

    ROOM_ActivateRoomForClient113c(m, pClient, pRoom, w.pPlayer)
    // Matches real D2Game.dll oracle `076004880402` (tileX=0x0460, tileY=0x0488, levelId=2)!
    expect(drainFrameS2CPackets113c(m, pGame)).toEqual(['076004880402'])

    ROOM_DeactivateRoomForClient113c(m, pRoom, w.pPlayer, pClient)
    const deactPkts = drainFrameS2CPackets113c(m, pGame)
    expect(deactPkts).toContain('0a0109000000') // RemoveUnit monster 9
    expect(deactPkts[deactPkts.length - 1]).toBe('086004880402') // RemoveRoom
  })

  it('3. 0x6FC3EB20 AIGENERAL_ExpireMinionListsInAct113c & 0x6FC39C20 AI_WarrivGreet113c (0x8A greeting)', () => {
    const w = createRealK2World(1)
    const { m, pGame, pRoom, pPlayer } = w

    // Build two saved-item nodes on an inactive room node: one expired (frame 50 < 100), one live (frame 200 > 100)
    const pRoomNode = m.alloc(0x18)
    const pExpired = m.alloc(0x10)
    const pLive = m.alloc(0x10)
    m.setU32(pExpired, pLive)
    m.setU32((pExpired + 0x04) >>> 0, 50)
    m.setU32(pLive, 0)
    m.setU32((pLive + 0x04) >>> 0, 200)
    m.setU32((pRoomNode + 0x08) >>> 0, pExpired)
    m.setU32((pGame + 0xd8) >>> 0, pRoomNode)

    AIGENERAL_ExpireMinionListsInAct113c(m, pGame, 0)
    expect(m.u32((pRoomNode + 0x08) >>> 0)).toBe(pLive)

    // Spawn Warriv (classId 155, unitId 12) 2 subtiles away from player -> emits 0x8A (`8a010c000000`)!
    const px = m.get(pRoom, D2ActiveRoomStrc.nSubtileX) + 10
    const py = m.get(pRoom, D2ActiveRoomStrc.nSubtileY) + 10
    void pPlayer
    const pWarriv = spawnUnitInWorld(m, pGame, pRoom, 1, 155, 12, px + 2, py + 1)
    AI_WarrivGreet113c(m, pGame, pWarriv)

    const pkts = drainFrameS2CPackets113c(m, pGame)
    expect(pkts).toEqual(['8a010c000000'])
    const pAiGen = m.get(m.get(pWarriv, D2UnitStrc.pUnitData), D2MonsterDataStrc.pAiGeneral)
    expect(m.u32((pAiGen + 0x1c) >>> 0)).toBe(1) // greeted once
  })

  it('4. 0x6FC98DD0 PLAYER_StartModeSkill113c & 0x6FC99100 stackable throw quantity + 34B 0x3E sync', () => {
    const w = createRealK2World(2)
    const { m, pGame, pPlayer } = w

    // Equip throwable javelin (itemClassId = 2, itemId = 77) in right hand (bodyLoc = 4) with quantity 5
    const pJav = equipTestItem(m, pGame, pPlayer, 2, 77, 4, 10, 10)
    STATLIST_SetUnitStat113c(m, pJav, 125, 1, 0) // STAT_ITEM_THROWABLE
    STATLIST_SetUnitStat113c(m, pJav, 70, 5, 0) // STAT_QUANTITY = 5
    STATLIST_SetUnitStat113c(m, pPlayer, 105, 40, 0) // +40% FCR

    // Cast mode (10) schedules Event 6 & Event 7 without consuming javelin quantity
    expect(PLAYER_StartModeSkill113c(m, pGame, pPlayer, 10, 0, '1HS')).toBe(1)
    expect(m.get(pPlayer, D2UnitStrc.dwAnimMode)).toBe(10)
    expect(EVENT_GetNextEventFrame113c(m, pPlayer, 7)).toBeGreaterThan(100)
    expect(STATLIST_GetUnitStat113c(m, pJav, 70, 0)).toBe(5)

    // Throw mode (11) consumes 1 quantity -> 4 and emits 34-byte 0x3E S2C packet!
    expect(PLAYER_StartModeSkill113c(m, pGame, pPlayer, 11, 0, '1HT')).toBe(1)
    expect(STATLIST_GetUnitStat113c(m, pJav, 70, 0)).toBe(4)
    const pkts = drainFrameS2CPackets113c(m, pGame)
    expect(pkts.length).toBe(1)
    expect(pkts[0]!.startsWith('3e')).toBe(true)
    expect(pkts[0]!.length).toBe(68) // 34 bytes = 68 hex chars (`0x22` in `0x6FCAA3E0`)

    // 3-arg 0x6FC99100 call consumes another stackable quantity -> 3
    PLAYER_ScheduleSkillActionFrameEvents113c(m, pGame, pPlayer)
    expect(STATLIST_GetUnitStat113c(m, pJav, 70, 0)).toBe(3)
    drainFrameS2CPackets113c(m, pGame)
  })

  it('5. Real Timed D2StatListStrc creation, stat propagation & Event 12 expiry for Cold (11), Freeze (1), Burn (115), Poison (2), Stun (21)', () => {
    const w = createRealK2World(2)
    const { m, pGame, pRoom, pPlayer } = w
    const baseX = m.get(pRoom, D2ActiveRoomStrc.nSubtileX) + 12
    const baseY = m.get(pRoom, D2ActiveRoomStrc.nSubtileY) + 12

    const pFallen = spawnUnitInWorld(m, pGame, pRoom, 1, 0, 9, baseX, baseY)
    STATLIST_SetUnitStat113c(m, pFallen, 6, 50 << 8, 0)
    STATLIST_SetUnitStat113c(m, pFallen, 7, 50 << 8, 0)

    // (a) Cold Chilled (`0x6FCFC780`): sets STATE_COLD (11) + stats 67, 68, 69 = -50
    SUNITDMG_ApplyColdChilledEffect113c(m, pGame, pPlayer, pFallen, 50)
    expect(STATES_CheckState113c(m, pFallen, 11)).not.toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pFallen, 67, 0)).toBe(-50)
    expect(STATLIST_GetUnitStat113c(m, pFallen, 68, 0)).toBe(-50)
    expect(STATLIST_GetUnitStat113c(m, pFallen, 69, 0)).toBe(-50)
    const pColdSl = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pFallen, 11)
    expect(pColdSl).not.toBe(0)
    expect(m.get(pColdSl, D2StatListStrc.dwExpireFrame)).toBe(150)

    // (b) Freeze (`0x6FCFDAC0`): supersedes STATE_COLD (11) on normal monster, sets STATE_FREEZE (1); downgrades to Cold on Player!
    SUNITDMG_ApplyFreezeEffect113c(m, pGame, pPlayer, pFallen, 40)
    expect(STATES_CheckState113c(m, pFallen, 1)).not.toBe(0)
    expect(STATES_CheckState113c(m, pFallen, 11)).toBe(0)
    STATES_OnFreezeStateRemoved_6FCFBD90_113c(m, pFallen)
    STATES_OnColdStateRemoved_6FCFB4C0_113c(m, pFallen)

    // Cannot Be Frozen (`153`) blocks chill on player; without it, Freeze on player downgrades to Cold (11)
    STATLIST_SetUnitStat113c(m, pPlayer, 153, 1, 0)
    SUNITDMG_ApplyFreezeEffect113c(m, pGame, pFallen, pPlayer, 40)
    expect(STATES_CheckState113c(m, pPlayer, 11)).toBe(0)
    STATLIST_SetUnitStat113c(m, pPlayer, 153, 0, 0)
    SUNITDMG_ApplyFreezeEffect113c(m, pGame, pFallen, pPlayer, 40)
    expect(STATES_CheckState113c(m, pPlayer, 1)).toBe(0)
    expect(STATES_CheckState113c(m, pPlayer, 11)).not.toBe(0)

    // (c) Burn (`0x6FCFC940`): STATE_BURNING (115) sets negative STAT_HPREGEN (74)
    const pZombie = spawnUnitInWorld(m, pGame, pRoom, 1, 1, 10, baseX + 2, baseY)
    STATLIST_SetUnitStat113c(m, pZombie, 6, 80 << 8, 0)
    STATLIST_SetUnitStat113c(m, pZombie, 7, 80 << 8, 0)
    SUNITDMG_ApplyBurnEffect_6FCFC940_113c(m, pGame, pPlayer, pZombie, 64, 30)
    expect(STATES_CheckState113c(m, pZombie, 115)).not.toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pZombie, 74, 0)).toBe(-64)

    // (d) Poison (`0x6FCFCAB0`): STATE_POISON (2) emits `a8010b0000000a02ff01`, ticks HP down via Event 3, and emits `a9010b00000002` when expired via Event 12!
    GAME_ClearAllRoomUpdateQueues113c(m, pGame)
    drainFrameS2CPackets113c(m, pGame)
    const pTargetMon = spawnUnitInWorld(m, pGame, pRoom, 1, 0, 11, baseX + 4, baseY)
    STATLIST_SetUnitStat113c(m, pTargetMon, 6, 40 << 8, 0)
    STATLIST_SetUnitStat113c(m, pTargetMon, 7, 40 << 8, 0)
    SUNITDMG_ApplyPoisonEffect113c(m, pGame, pPlayer, pTargetMon, 128, 25)
    expect(STATES_CheckState113c(m, pTargetMon, 2)).not.toBe(0)
    const pPoisSl = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pTargetMon, 2)
    expect(STATLIST_GetStatValue113c(m, pPoisSl, 57, 0)).toBe(128)
    expect(STATLIST_GetStatValue113c(m, pPoisSl, 59, 0)).toBe(25)

    // Register pClient in pRoom and run 0x6FC6B400 -> 0x6FCBDEC0 -> 0x6FC9A5E0 to verify exact 10B 0xA8 Poison SetState (`a8010b0000000a02ff01`)!
    DUNGEON_AddClientToRoom113c(m, pRoom, w.pClient)
    CLIENT_SyncRoomAndUnits113c(m, pGame)
    expect(drainFrameS2CPackets113c(m, pGame)).toContain('a8010b0000000a02ff01')

    // Run DoT tick (Event 3) -> HP decreases by 128 (`0.5` HP)
    const hpBefore = STATLIST_GetUnitStat113c(m, pTargetMon, 6, 0)
    MONSTER_Event03_RegenAndPoisonTick113c(m, pGame, pTargetMon)
    expect(STATLIST_GetUnitStat113c(m, pTargetMon, 6, 0)).toBe(hpBefore - 128)

    // Advance game frame to expiry (125), run Event 12 + CLIENT_SyncRoomAndUnits113c -> clears STATE_POISON (2) and queues `a9010b00000002`!
    drainFrameS2CPackets113c(m, pGame)
    m.set(pGame, D2GameStrc.dwGameFrame, 125)
    MONSTER_Event12_ExpireTimedStats113c(m, pGame, pTargetMon)
    expect(STATES_CheckState113c(m, pTargetMon, 2)).toBe(0)
    CLIENT_SyncRoomAndUnits113c(m, pGame)
    expect(drainFrameS2CPackets113c(m, pGame)).toContain('a9010b00000002')

    // (e) Stun (`0x6FCFCC20`): caps player stun at 13f and monster stun at 250f
    SUNITDMG_ApplyStunEffect113c(m, pGame, pFallen, pPlayer, 100)
    const pPlrStun = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pPlayer, 21)
    expect(m.get(pPlrStun, D2StatListStrc.dwExpireFrame)).toBe(125 + 13)
    SUNITDMG_ApplyStunEffect113c(m, pGame, pPlayer, pTargetMon, 999)
    const pMonStun = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pTargetMon, 21)
    expect(m.get(pMonStun, D2StatListStrc.dwExpireFrame)).toBe(125 + 250)
  })

  it('6. Combat pipeline: ToHit, Dodge/Block, Resistance/Pierce, 7-slot Armor Durability (0x3E), GetHit (0x0D), Lethal Kill (0x69/0x65) & Level-Up', () => {
    const w = createRealK2World(2)
    const { m, pGame, pRoom, pPlayer } = w
    const baseX = m.get(pRoom, D2ActiveRoomStrc.nSubtileX) + 10
    const baseY = m.get(pRoom, D2ActiveRoomStrc.nSubtileY) + 10

    // Verify 7-entry armor durability table matches `0x6FD2E628`
    expect(D2GAME_ARMOR_DURABILITY_SLOTS_6FD2E62C).toEqual([
      [1, 3],
      [3, 5],
      [4, 4],
      [5, 4],
      [8, 2],
      [9, 2],
      [10, 2],
    ])

    // Resistance & PvP/Pet helpers
    expect(SUNITDMG_GetPvpOrPetDamageMultiplier113c(m, pPlayer, pPlayer)).toBe(170)
    expect(SUNITDMG_GetColdEffectLengthBonus113c(m, pPlayer, pPlayer)).toBe(100)
    STATLIST_SetUnitStat113c(m, pPlayer, 39, 90, 0)
    expect(SUNITDMG_GetEffectiveResistance113c(m, pPlayer, 39, 0)).toBe(75)
    expect(SUNITDMG_GetTotalSkillDamageBonus113c(m, pPlayer, 35)).toBe(35)

    // Running player defender auto-hits in SUNITDMG_CheckToHit113c (both 4-arg and 5-arg signatures)
    const pFallen = spawnUnitInWorld(m, pGame, pRoom, 1, 0, 20, baseX + 1, baseY)
    STATLIST_SetUnitStat113c(m, pFallen, 12, 2, 0)
    STATLIST_SetUnitStat113c(m, pFallen, 13, 18, 0) // baseExp 18
    STATLIST_SetUnitStat113c(m, pFallen, 6, 12 << 8, 0)
    STATLIST_SetUnitStat113c(m, pFallen, 7, 12 << 8, 0)

    m.set(pPlayer, D2UnitStrc.dwAnimMode, 3) // PLRMODE_RUN
    expect(SUNITDMG_CheckToHit113c(m, pFallen, pPlayer)).toBe(1)
    expect(SUNITDMG_CheckToHit113c(m, pGame, pFallen, pPlayer, 0)).toBe(1)
    m.set(pPlayer, D2UnitStrc.dwAnimMode, 1)

    // Equip Buckler (itemClassId=1, shield type=2) in left hand (bodyLoc=5) and force seed so armor durability triggers (`roll < weight`)
    const pBuckler = equipTestItem(m, pGame, pPlayer, 1, 88, 5, 12, 12)
    // Find a seed on pPlayer where first roll < 4 (`totalWeight * 10 = 40`)
    for (let s = 1; s < 500; s++) {
      m.setU32((pPlayer + 0x20) >>> 0, s)
      m.setU32((pPlayer + 0x24) >>> 0, 0)
      SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c(m, pGame, 0, pPlayer, 0)
      if (STATLIST_GetUnitStat113c(m, pBuckler, 72, 0) < 12) break
    }
    expect(STATLIST_GetUnitStat113c(m, pBuckler, 72, 0)).toBe(11)
    const durPkts = drainFrameS2CPackets113c(m, pGame)
    expect(durPkts.some((h) => h.startsWith('3e') && h.length === 68)).toBe(true)

    // Player GetHit (`0x6FCEBBB0`) emits 13-byte `0x0D` S2C packet
    const pDmg = m.alloc(D2DamageStrc_SIZE)
    m.set(pDmg, D2DamageStrc.wResultFlags, 0x05) // HIT | GETHIT
    m.set(pDmg, D2DamageStrc.dwDmgTotal, 25 << 8)
    m.set(pDmg, D2DamageStrc.dwHitClass, 0x0c)
    SUNITDMG_ApplyArmorDurabilityAndGetHit113c(m, pGame, pFallen, pPlayer, pDmg)
    const ghPkts = drainFrameS2CPackets113c(m, pGame)
    expect(ghPkts.some((h) => h.startsWith('0d000100000013') && h.length === 26)).toBe(true)

    // Armor penetration, Mana Burn clamp, Blind/Flee, Thorns, PostCombatEvents & Lethal Kill + Level-Up
    m.set(pDmg, D2DamageStrc.dwPhysDamage, 20 << 8)
    m.set(pDmg, D2DamageStrc.dwManaLeech, 10 << 8)
    SUNITDMG_ApplyArmorPenetrationAndFlatBonus113c(m, pPlayer, pFallen, pDmg, 128)
    SUNITDMG_ClampManaBurnByMonsterSkill113c(m, pFallen, pDmg)
    SUNITDMG_TriggerAttackerBlindOrFlee113c(m, pGame, pPlayer, pFallen, pDmg)
    SUNITDMG_ApplyColdOrFreezeState113c(m, pGame, pPlayer, pFallen, pDmg)

    // Set player at clvl 1 with 490 XP; killing Fallen (+18 XP -> 508 XP >= 500) levels up to clvl 2 (+5 statpts, +1 skillpt)!
    STATLIST_SetUnitStat113c(m, pPlayer, 12, 1, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 13, 490, 0)
    expect(SUNITDMG_ComputeExperienceGain113c(m, pGame, pPlayer, 1, 18)).toBe(18)

    m.set(pDmg, D2DamageStrc.wResultFlags, 0x01)
    m.set(pDmg, D2DamageStrc.dwDmgTotal, 30 << 8)
    SUNITDMG_ApplyDamage113c(m, pGame, pPlayer, pFallen, pDmg)
    SUNITDMG_TriggerPostCombatEvents113c(m, pGame, pPlayer, pFallen, pDmg)
    SUNITDMG_ApplyAttackerThornsToSelf113c(m, pGame, pPlayer, pFallen)

    expect(STATLIST_GetUnitStat113c(m, pFallen, 6, 0)).toBe(0)
    expect(m.get(pFallen, D2UnitStrc.dwAnimMode)).toBe(0) // MONMODE_DEATH
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 12, 0)).toBe(2) // leveled up!
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 4, 0)).toBe(5) // +5 stat points
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 5, 0)).toBe(1) // +1 skill point

    const killPkts = drainFrameS2CPackets113c(m, pGame)
    expect(killPkts.some((h) => h.startsWith('691400000008') && h.length === 24)).toBe(true) // 0x69 death
    expect(killPkts).toContain('65010000000100') // 0x65 kill count
    expect(killPkts).toContain('1d0c02') // 0x1D clvl = 2

    // RollDodgeAvoidEvadeBlock (`0x6FCFB030`)
    STATLIST_SetUnitStat113c(m, pPlayer, 338, 100, 0) // 100% STAT_PASSIVE_DODGE
    m.set(pPlayer, D2UnitStrc.dwAnimMode, 1)
    m.set(pDmg, D2DamageStrc.wResultFlags, 0x01)
    expect(SUNITDMG_RollDodgeAvoidEvadeBlock113c(m, pFallen, pPlayer, pDmg)).toBe(1)
    expect((m.get(pDmg, D2DamageStrc.wResultFlags) & 0x81) >>> 0).toBe(0x80)
  })

  it('7. Pure SparseMemory113c replacements for all 30 fallen-ai VAs & GAME_UpdateGameFrame113c', () => {
    const w = createRealK2World(2)
    const { m, pGame, pRoom, pPlayer } = w
    const baseX = m.get(pRoom, D2ActiveRoomStrc.nSubtileX) + 15
    const baseY = m.get(pRoom, D2ActiveRoomStrc.nSubtileY) + 15

    const pSword = equipTestItem(m, pGame, pPlayer, 0, 91, 4, 20, 20)
    expect(PLAYER_GetEquippedWeapon113c(m, pPlayer)).toBe(pSword)
    expect(UNITS_GetDistanceToCoordinates113c(10, 10, 16, 14)).toBe(8)
    expect(UNITS_GetDistanceToCoordinates113c(m, pPlayer, baseX, baseY)).toBeGreaterThan(0)

    const pMon = spawnUnitInWorld(m, pGame, pRoom, 1, 0, 31, baseX, baseY)
    STATLIST_SetUnitStat113c(m, pMon, 6, 40 << 8, 0)
    STATLIST_SetUnitStat113c(m, pMon, 7, 40 << 8, 0)

    // AI Command queue (`0x6FC40F30`, `0x6FC41290`, `0x6FC40EC0`)
    const cmd1 = AIGENERAL_InitAiCommand113c(m, pMon, 1, 1, 14, 0, 0)
    const cmd2 = AIGENERAL_AllocAiCommand113c(m, pMon)
    expect(cmd1).not.toBe(0)
    expect(cmd2).not.toBe(0)
    const pAiGen = m.get(m.get(pMon, D2UnitStrc.pUnitData), D2MonsterDataStrc.pAiGeneral)
    expect(m.get(pAiGen, D2AiGeneralStrc.pCommandHead)).toBe(cmd1)
    AIGENERAL_PopAiCommand113c(m, pMon)
    expect(m.get(pAiGen, D2AiGeneralStrc.pCommandHead)).toBe(cmd2)
    AIGENERAL_PopAiCommand113c(m, pMon)
    expect(m.get(pAiGen, D2AiGeneralStrc.pCommandHead)).toBe(0)

    // Monster mode & movement (`0x6FC95260`, `0x6FC94F90`, `0x6FC95E10`, `0x6FC97010`, `0x6FC96FE0`, `0x6FC96BF0`)
    MONSTER_SavePrevMode113c(m, pMon, 1)
    expect(MONSTER_StartMove113c(m, pGame, pMon, 2, 0, baseX + 4, baseY + 2)).toBe(1)
    MONSTER_StepWalk113c(m, pGame, pMon)
    expect(MONSTER_StartMove113c(m, pGame, pMon, 15, pPlayer, 0, 0)).toBe(1)
    MONSTER_StepRun113c(m, pGame, pMon)
    expect(MONSTER_StartMode113c(m, pGame, pMon, 4, pPlayer, 0, 0)).toBe(1)
    MONSTER_EndToAiOrNeutral113c(m, pGame, pMon)
    expect(m.get(pMon, D2UnitStrc.dwAnimMode)).toBe(1)

    // AI drivers (`0x6FD122C0`, `0x6FD11B10`, `0x6FD12540`, `0x6FD12D80`, `0x6FCA38B0`, `0x6FCA3130`)
    AI_Stall113c(m, pGame, pMon, 8)
    AI_IdleWander113c(m, pGame, pMon, 6)
    AI_ApproachTarget113c(m, pGame, pMon, pPlayer, 2)
    AI_FleeFrom113c(m, pGame, pMon, pPlayer, 8, 1)
    AiZombie113c(m, pGame, pMon)
    AiFallen113c(m, pGame, pMon)

    // Player regen/drain (`0x6FC97BB0`, `0x6FC97CB0`, `0x6FC97950`, `0x6FC97A50`, `0x6FC99B10`, `0x6FC99A60`, `0x6FC987C0`)
    m.set(pPlayer, D2UnitStrc.dwAnimMode, 3)
    PLAYER_DrainRunStamina113c(m, pPlayer)
    m.set(pPlayer, D2UnitStrc.dwAnimMode, 1)
    STATLIST_SetUnitStat113c(m, pPlayer, 74, 16, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 6, 60 << 8, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 8, 15 << 8, 0)
    PLAYER_UpdateHpRegen113c(m, pPlayer)
    PLAYER_UpdateManaRegen113c(m, pPlayer)
    PLAYER_UpdateStaminaRegen113c(m, pPlayer)
    PLAYER_Event3_RegenTick113c(m, pGame, pPlayer)
    PLAYER_Event11_PeriodicTick113c(m, pGame, pPlayer)
    expect(PLAYER_StartModeAttackWithTarget113c(m, pGame, pPlayer, 7, pMon, '1HS')).toBe(1)

    // Death & EndDeath (`0x6FC96270`, `0x6FC96040`) + `GAME_UpdateGameFrame113c` (`0x6FC4E050`)
    MONSTER_StartDeath113c(m, pGame, pMon, pPlayer)
    expect(m.get(pMon, D2UnitStrc.dwAnimMode)).toBe(0)
    MONSTER_EndDeath113c(m, pGame, pMon)
    expect(m.get(pMon, D2UnitStrc.dwAnimMode)).toBe(12)

    drainFrameS2CPackets113c(m, pGame)
    const nextFrame = GAME_UpdateGameFrame113c(m, pGame)
    expect(nextFrame).toBeGreaterThan(100)
  })

  it('8. Exact D2Net.#10033 sizes & wire formatting across all K2 S2C packet builders + 0x95/0x96/0x18 bitstreams', () => {
    const w = createRealK2World(2)
    const { m, pGame, pRoom, pClient, pPlayer } = w
    const pMon = spawnUnitInWorld(
      m,
      pGame,
      pRoom,
      1,
      0,
      9,
      0x1620,
      0x16a3,
    )
    STATLIST_SetUnitStat113c(m, pMon, 6, 80 << 8, 0)
    STATLIST_SetUnitStat113c(m, pMon, 7, 100 << 8, 0)

    const pObj = UNITS_Create113c(m, 2, 1, 5, pGame)
    const pObjPath = m.alloc(0x20)
    m.setU32(pObjPath, pRoom)
    m.setU32((pObjPath + 0x04) >>> 0, 0x1610)
    m.setU32((pObjPath + 0x08) >>> 0, 0x1690)
    m.set(pObj, D2UnitStrc.pPath, pObjPath)
    m.set(pObj, D2UnitStrc.pUnitData, m.alloc(0x40))

    const pBuckler = equipTestItem(m, pGame, pPlayer, 1, 99, 5, 10, 12)

    S2C_SendPacket07_AddRoom113c(m, pClient, 0x0460, 0x0488, 2)
    S2C_SendPacket08_RemoveRoom113c(m, pClient, 0x0460, 0x04a0, 1)
    S2C_SendPacket09_AssignWarp113c(m, pClient, 3, 12, 0x1600, 0x1680)
    S2C_SendPacket0A_RemoveUnit113c(m, pClient, 1, 9)
    S2C_SendPacket0C_NpcHit113c(m, pClient, pMon, 0x13, 0x50)
    S2C_SendPacket0D_PlayerStop113c(m, pClient, pPlayer, 0x13, 0x0c)
    S2C_SendPacket0E_ObjectState113c(m, pClient, 5, 0, 1, 2)
    S2C_SendPacket1D_1E_1F_SetAttribute113c(m, pClient, 12, 2)
    S2C_SendPacket1D_1E_1F_SetAttribute113c(m, pClient, 13, 1500)
    S2C_SendPacket1D_1E_1F_SetAttribute113c(m, pClient, 13, 100000)
    S2C_SendPacket23_SetSkill113c(m, pClient, 0, 1, 0, 36, 0xffffffff)
    S2C_SendPacket2C_UnitSound113c(m, pClient, pMon, 0x0019)
    MONSTER_BroadcastEventSoundToClients113c(m, pMon, 0x001a, pClient)
    S2C_SendPacket3E_UpdateItemStat113c(m, pClient, pBuckler, 72, 10)
    S2C_SendPacket51_AssignObject113c(m, pClient, pObj)
    S2C_SendPacket59_AssignPlayer113c(m, pClient, pPlayer)
    S2C_SendPacket65_PlayerKillCount113c(m, pClient, 1, 3)
    S2C_SendPacket67_NpcMove113c(m, pClient, pMon, 0x1624, 0x16a5, 0x01)
    S2C_SendPacket68_NpcMoveToTarget113c(m, pClient, pMon, pPlayer, 0x18)
    S2C_SendPacket69_NpcState113c(m, pClient, pMon, 0x08, 0)
    S2C_SendPacket6C_NpcAttack113c(m, pClient, pMon, 0x10, pPlayer, 0)
    S2C_SendPacket6D_NpcStop113c(m, pClient, 9, 0x1620, 0x16a3, 0x66)
    S2C_SendPacket8A_NpcWantsInteract113c(m, pClient, 1, 12)
    S2C_SendPacket8D_AssignParty113c(m, pClient, 1, 0xffff)
    S2C_SendPacket95_LifeManaChange113c(m, pClient, 75, 25, 95, 0x161e, 0x16a5, 0, 0)
    S2C_SendPacket96_WalkVerify113c(m, pClient, 92, 0x1620, 0x16a6, 0, 0)
    S2C_SendPacket18_LifeManaPot113c(m, pClient, 78, 28, 96, 4, 2, 0x1620, 0x16a6, 0, 0)
    S2C_SendPacket99_SkillTriggered113c(m, pClient, 0, 1, 38, 3, 1, 9, 1)
    S2C_SendPacketA8_SetState113c(m, pClient, 1, 9, 2)
    S2C_SendPacketA9_EndState113c(m, pClient, 1, 9, 2)
    STATES_OnColdStateRemoved_6FCFB4C0_113c(m, pMon)
    S2C_SendPacketAA_StateSync113c(m, pClient, pMon)
    S2C_SendPacketAB_UnitHeal113c(m, pClient, 1, 9, 0x80)

    const drained = drainFrameS2CPackets113c(m, pGame)
    expect(drained.length).toBe(32)
    expect(drained[0]).toBe('076004880402')
    expect(drained[1]).toBe('086004a00401')
    expect(drained[3]).toBe('0a0109000000')
    expect(drained[20]).toBe('6c09000000100001000000002016a316') // exact match to Windows oracle `0x6C`!
    expect(drained[21]).toBe('6d090000002016a31666')
    expect(drained[29]).toBe('a9010900000002') // exact match to Windows oracle `p52-dot-ticks`!

    // Every drained packet resolves to its exact byte length under D2Net.#10033 (`getS2CPacketSize113c`)
    for (const hex of drained) {
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
      }
      if (bytes[0] === 0x3e) {
        expect(bytes.byteLength).toBe(34)
        expect(getS2CPacketSize113c(bytes)).toBeGreaterThan(2)
      } else {
        expect(getS2CPacketSize113c(bytes)).toBe(bytes.byteLength)
      }
    }

    // Verify per-frame PLAYER_SyncLifeManaStaminaGoldExp113c & CLIENT_SyncRoomAndUnits113c emit 0x95 on >=10% HP change
    PLAYER_SyncLifeManaStaminaGoldExp113c(m, pPlayer, 1) // initialize shadow
    drainClientS2CPackets113c(m, pClient)
    STATLIST_SetUnitStat113c(m, pPlayer, 6, 50 << 8, 0) // 80 -> 50 (>10% change)
    CLIENT_SyncRoomAndUnits113c(m, pGame)
    const syncPkts = drainFrameS2CPackets113c(m, pGame)
    expect(syncPkts.length).toBe(1)
    expect(syncPkts[0]!.startsWith('95')).toBe(true)
    expect(syncPkts[0]!.length).toBe(26) // 13 bytes
    expect(NET_QueuePacketToClient113c(m, 0, new Uint8Array([0x0a, 1, 0, 0, 0, 0]))).toBe(0) // pClient == 0 returns 0
  })

  it('9. 0x6FC40760 / 0x6FC409B0 ROOM_DeactivateUnitInRoom113c -> 0x6FC400E0 round-trip & full combat-a1c 1:1 VAs', () => {
    const w = createRealK2World(2)
    const { m, pGame, pRoom, pPlayer } = w
    const baseX = m.get(pRoom, D2ActiveRoomStrc.nSubtileX) + 18
    const baseY = m.get(pRoom, D2ActiveRoomStrc.nSubtileY) + 18

    // Spawn a monster (unitId 51) and kill it to corpse (mode 12), then spawn a live monster (unitId 52),
    // deactivate both via 0x6FC409B0 / 0x6FC40760, and verify inactive room node creation + 0x6FC400E0 restore!
    const pCorpse = spawnUnitInWorld(m, pGame, pRoom, 1, 1, 51, baseX, baseY)
    MONSTER_EndDeath113c(m, pGame, pCorpse)
    expect(m.get(pCorpse, D2UnitStrc.dwAnimMode)).toBe(12)
    ROOM_DeactivateUnitInRoom113c(m, pGame, pCorpse)

    const pLiveSaved = spawnUnitInWorld(m, pGame, pRoom, 1, 2, 52, baseX + 3, baseY + 2)
    STATLIST_SetUnitStat113c(m, pLiveSaved, 6, 30 << 8, 0)
    STATLIST_SetUnitStat113c(m, pLiveSaved, 7, 30 << 8, 0)
    ROOM_DeactivateMonsterInRoom113c(m, pGame, pLiveSaved)
    expect(m.u32((pGame + 0xd8) >>> 0)).not.toBe(0)

    ROOM_RefreshUnitsAndLoadSaved113c(m, pGame, pRoom)
    expect(m.u32((pGame + 0xd8) >>> 0)).toBe(0)
    let restoredCorpse = 0
    let u = m.get(pRoom, D2ActiveRoomStrc.pUnitFirst)
    while (u !== 0) {
      if (m.u32(u) === 1 && m.get(u, D2UnitStrc.dwClassId) === 1 && m.get(u, D2UnitStrc.dwAnimMode) === 12) {
        restoredCorpse = u
      }
      u = m.get(u, D2UnitStrc.pRoomUnitNext)
    }
    expect(restoredCorpse).not.toBe(0)

    // Exercise Section 1B 1:1 ports: Sand Leaper (hcIdx 78 = 0x4e) knockback, Hand-skill snapshot, AI target dispatch, Combat node & SingleHit!
    const pLeaper = spawnUnitInWorld(m, pGame, pRoom, 1, 78, 60, baseX + 2, baseY - 2)
    STATLIST_SetUnitStat113c(m, pLeaper, 12, 2, 0)
    STATLIST_SetUnitStat113c(m, pLeaper, 6, 20 << 8, 0)
    STATLIST_SetUnitStat113c(m, pLeaper, 7, 20 << 8, 0)
    m.set(pLeaper, D2UnitStrc.dwAnimMode, 5)
    expect(MONSTER_CheckSandLeaperMidAir113c(m, pLeaper)).toBe(1)
    m.set(pLeaper, D2UnitStrc.dwAnimMode, 1)

    const pSnap = m.alloc(16)
    expect(PLAYER_SnapshotHandSkillsToStruct113c(m, pPlayer, pSnap)).toBe(1)
    expect(PLAYER_RestoreHandSkillsFromSnapshot113c(m, pPlayer, pSnap)).toBe(1)
    expect(PLAYER_StartModeDispatch113c(m, pGame, pPlayer, 9, 0, '1HS')).toBe(1)
    expect(SUNITDMG_TriggerBlockEvents113c(m, pGame, pPlayer)).toBe(1)

    AI_DispatchTargetByAiFlag113c(m, pGame, pLeaper)
    AI_GeneralFindTargetOrThrottle113c(m, pGame, pLeaper, 0)

    STATLIST_SetUnitStat113c(m, pPlayer, 21, 50, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 22, 60, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 19, 5000, 0)
    const pDmg = m.alloc(D2DamageStrc_SIZE)
    m.set(pDmg, D2DamageStrc.wResultFlags, 0x01)
    m.set(pDmg, D2DamageStrc.dwPhysDamage, 25 << 8)
    m.set(pDmg, D2DamageStrc.dwDmgTotal, 25 << 8)
    const pCombat = SUNITDMG_AllocCombat113c(m, pGame, pPlayer, pLeaper, pDmg, 128)
    expect(pCombat).not.toBe(0)
    expect(SUNITDMG_FindCombatDamageData113c(m, pPlayer, pLeaper)).toBe((pCombat + 0x14) >>> 0)
    expect(SUNITDMG_ExecuteEvents113c(m, pGame, pPlayer, pLeaper, 1, 0)).toBe(1)
    expect(m.get(pPlayer, D2UnitStrc.pCombat)).toBe(0)

    const pFoe2 = spawnUnitInWorld(m, pGame, pRoom, 1, 0, 61, baseX + 1, baseY + 1)
    STATLIST_SetUnitStat113c(m, pFoe2, 12, 1, 0)
    STATLIST_SetUnitStat113c(m, pFoe2, 6, 5 << 8, 0)
    STATLIST_SetUnitStat113c(m, pFoe2, 7, 5 << 8, 0)
    expect(SUNITDMG_ExecuteSingleHit113c(m, pGame, pPlayer, pFoe2, 0, 128)).toBe(1)
    expect(SUNITDMG_DistributeExperience113c(m, pGame, pPlayer, pFoe2)).toBeGreaterThan(0)
  })
})
