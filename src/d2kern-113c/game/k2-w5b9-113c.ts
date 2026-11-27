/**
 * Milestone 33 [K2] Wave 5 Batch 9 (`w5b9`): 45 `D2Game.dll` v1.13c functions
 * in the VA range `0x6FD06E00..0x6FD11730`.
 */

import { COLLISION_GetMaskWithPattern2_113c } from '../common/collision'
import { UNITS_GetPlayerData113c } from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import { DRLGPRESET_MovePointerAndClear113c } from '../common/drlg/preset'
import { DUNGEON_GetLevelIdFromRoom113c, DUNGEON_ToggleHasPortalFlag113c } from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32 } from '../common/int-math'
import { INVENTORY_GetFirstItem113c, INVENTORY_GetNextItem113c, INVENTORY_UnitIsItem113c } from '../common/inventory'
import { DRLGWARP_TestRoomTileBit113c } from '../common/items'
import { STATLIST_AddUnitStatMemPort113c } from '../common/k0-d2common-memports'
import { MISSILE_SetTargetX113c } from '../common/missile'
import { PATH_GetFootprintCollisionMask113c, PATH_GetPosX113c, PATH_GetPosY113c, PATH_GetTargetUnit113c, PATH_GetUnitCollisionPattern113c, PATH_SetTargetPos113c } from '../common/path'
import { QUESTRECORD_CopyRecordToBuffer113c } from '../common/quest-record'
import { SKILLS_EvaluateSkillLevel113c, SKILLS_GetClassSkillCount113c, SKILLS_GetClassSkillId113c, SKILLS_GetSkillById113c } from '../common/skills'
import { STATES_CheckState113c, STATLIST_CopyBaseStatsToBuffer113c, STATLIST_GetUnitStat113c, STATLIST_SetUnitStat113c } from '../common/statlist'
import { DATATBLS_GetObjectsTxtRecord113c, UNIT_GetAlignment113c, UNITS_GetDistanceToOtherUnit113c, UNITS_GetRoom113c, UNITS_SetTargetUnitForDynamicUnitEx113c } from '../common/unit'
import { UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c, UNITFINDS_FindUnitInAdjacentRooms113c, UNITFINDS_FreeUnitFindData113c, UNITFINDS_InitUnitFindData113c } from '../common/unit-finds'
import { UNITS_SetTargetUnitForDynamicUnit113c, WAYPOINT_CopyAndValidateWaypointData113c } from '../common/waypoint'
import type { Memory113c as D2KernMemory113c } from '../mem/sparse-memory'
import { MONSTERS_IsDemonOrUndead113c } from '../tables/datatbls-113c'
import { DATATBLS_GetLevelsTxtRecord113c } from '../tables/lvl-tbls-113c'
import { DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c } from '../tables/monster-tbls-113c'
import { AIGENERAL_LinkMinionToLeader113c } from './ai-fallen-113c'
import { NET_SendFixed40BytePacketToClient113c } from './boot-init-gap-a-113c'
import { D2GAME_PARTY_GetPartyIdForUnit113c, D2GAME_PARTY_Send0x8BPartyRelationStatus113c, D2GAME_PARTY_SetPlayerRelationState113c, D2GAME_SUNIT_IterateAllLivingPlayers113c } from './boot-init-gap-b-113c'
import { SKILLS_CastTriggeredSkillCore113c } from './k2-gap-itemdef-113c'
import { MISSILE_CreateServerProjectile113c } from './k2-gap-melee-dot-113c'
import { AIGENERAL_GetQuestDataPtr38_113c } from './k2-items-tc-w1-113c'
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c'
import { SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c } from './k2-laneM-0x6fc7-w1-113c'
import { PARTY_GetPlayerRelationState113c } from './k2-sunit-spawn-w1-113c'
import { MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c } from './k2-w2b1-113c'
import { S2C_Send11BytePacketToPlayerUnit_6FCAC690_113c } from './k2-w2b4-113c'
import { ACT3Q4_CheckPlayerHasLamEsensTome_6FD05080_113c, PLAYERLIST_RemoveRelationNode_6FD0FFD0_113c } from './k2-w2b8-113c'
import { PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c } from './k2-w3b5-113c'
import { UNITMSG_QueuePacket9ACoords_6FC9A440_113c } from './k2-w3b8-113c'
import { PLAYERSAVE_WriteInventoryOrCachedSaveBuffer_6FC73B40_113c } from './k2-w4b2-113c'
import { NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c, PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c, PETS_FindPetArgByGuid_6FCB6570_113c, PETS_GetFirstPetUnitByType_6FCB6A40_113c } from './k2-w4b5-113c'
import { SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c } from './k2-w4b6-113c'
import { SUNIT_IsDeadOrDying113c, UNITS_ChangeAnimMode113c } from './monster-events'
import { D2GAME_IAT_SGPT_DATATABLES_VA_113C, MONSTER_Create113c, MONSTER_SpawnAtCoords113c, MONSTER_SpawnPartyMinionInRing113c, ROOM_FindRoomContainingSubtile113c, SEED_RollLimitedFast113c, SUNIT_ValidatePathTargetUnit113c } from './regpop-spawn-113c'
import { EVENT_SetEventFull113c, SUNIT_GetLastAttacker113c } from './timer-wheel'
import { hitD2GameVa113c } from '../va-trace-113c'

export type { D2KernMemory113c }

let k2W5B9StackPtr = 0x7e0d0000

/**
 * [1/45] Act 3 Quest 4 (`Lam Esen's Tome`) quest status filter callback.
 *
 * @va D2Game:0x6FD06E00
 */
export function ACT3Q4_StatusFilter_6FD06E00_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pPlayer: number,
  _pGlobalFlags: number,
  pCurFlags: number,
  pOutStatus: number,
): number {
  hitD2GameVa113c(0x6FD06E00)
  if ((DRLGWARP_TestRoomTileBit113c(m, pCurFlags >>> 0, 0x0f, 0) | 0) === 0) {
    m.setU8(pOutStatus >>> 0, 0)
    return 1
  }
  if ((DRLGWARP_TestRoomTileBit113c(m, pCurFlags >>> 0, 0x11, 0) | 0) !== 0) {
    const hasBit0D = DRLGWARP_TestRoomTileBit113c(m, pCurFlags >>> 0, 0x11, 0x0d) | 0
    m.setU8(pOutStatus >>> 0, hasBit0D !== 0 ? 0x0d : 0x0b)
    return 1
  }
  m.setU8(pOutStatus >>> 0, 0)
  const pGame0 = m.u32((pQuest + 0x04) >>> 0) >>> 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer >>> 0, pGame0, 0x20626262) !== 0) {
    m.setU8(pOutStatus >>> 0, 2)
    return 1
  }
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (pPlayer !== 0) {
    const pPlayerGame = m.u32((pPlayer + 0x80) >>> 0) >>> 0
    if (pPlayerGame !== 0 && (m.u32(pPlayer >>> 0) | 0) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, pPlayer >>> 0, pPlayerGame) & 0xffff
      if (wPartyId !== 0xffff) {
        m.setU8((pState + 0x04) >>> 0, 0)
        const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
        PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
          m,
          pQuestGame,
          wPartyId,
          ACT3Q4_CheckPlayerHasLamEsensTome_6FD05080_113c,
          0,
        )
        if (m.u8((pState + 0x04) >>> 0) !== 0) {
          m.setU8(pOutStatus >>> 0, 2)
          return 1
        }
      }
    }
  }
  if (m.u8((pQuest + 0x09) >>> 0) !== 0) {
    const bSeq = m.u8((pQuest + 0x0c) >>> 0) & 0xff
    if (bSeq <= 3) {
      m.setU8(pOutStatus >>> 0, 1)
      if (m.u8((pState + 0x02) >>> 0) === 1 && m.u32((pState + 0x08) >>> 0) === 0) {
        const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
        m.setU8(pOutStatus >>> 0, m.u8((pQuestGame + 0x6a) >>> 0) !== 3 ? 9 : 8)
      }
      return 1
    }
    m.setU8(pOutStatus >>> 0, 0x0c)
    const pRoom = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0
    if (pRoom !== 0) {
      const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
      const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
      if (nAct === 2 && m.u32((pState + 0x08) >>> 0) !== 0) {
        m.setU8(pOutStatus >>> 0, 1)
      }
    }
  }
  return 1
}

/**
 * [2/45] Act 3 Dark Wanderer preset spawn handler (`nQuest = 0x1C`, monster `0x170` at `x + 7, y`).
 *
 * @va D2Game:0x6FD08290
 */
export function ACT3Q0_InitDarkWandererPreset_6FD08290_113c(
  m: D2KernMemory113c,
  pObjInitStrc: number,
): void {
  hitD2GameVa113c(0x6FD08290)
  const pGame0 = m.u32(pObjInitStrc >>> 0) >>> 0
  const pQuestControl = m.u32((pGame0 + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return
  while ((m.u32(pQuest) | 0) !== 0x1c) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return
  }
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pState + 0x01) >>> 0) !== 0) {
    const x = (m.u32((pObjInitStrc + 0x14) >>> 0) + 7) >>> 0
    m.setU32((pState + 0x04) >>> 0, x)
    const y = m.u32((pObjInitStrc + 0x18) >>> 0) >>> 0
    m.setU32((pState + 0x08) >>> 0, y)
    const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, m.u32((pObjInitStrc + 0x08) >>> 0), x | 0, y | 0) >>> 0
    const spawnY = m.u32((pState + 0x08) >>> 0) | 0
    const spawnX = m.u32((pState + 0x04) >>> 0) | 0
    const pGame = m.u32(pObjInitStrc >>> 0) >>> 0
    if (MONSTER_SpawnAtCoords113c(m, 0x170, 1, pGame, pTargetRoom, spawnX, spawnY, -1, 0) !== 0) {
      m.setU8((pState + 0x01) >>> 0, 0)
    }
  }
  m.setU8(pState >>> 0, 1)
}

/**
 * [3/45] Act 3 Travincal Council (`0x129`) preset spawn handler (`nQuest = 0x14`, quest flag `(0x16, 0x0D)`).
 *
 * @va D2Game:0x6FD08310
 */
export function ACT3Q5_InitCouncilBossPreset_6FD08310_113c(
  m: D2KernMemory113c,
  pObjInitStrc: number,
): void {
  hitD2GameVa113c(0x6FD08310)
  const pGame0 = m.u32(pObjInitStrc >>> 0) >>> 0
  const pQuestControl0 = m.u32((pGame0 + 0x10f4) >>> 0) >>> 0
  if (m.u32((pQuestControl0 + 0x08) >>> 0) === 0) throw new D2CommonAssertError('QuestsFX.cpp', 0x82c)
  if ((DRLGWARP_TestRoomTileBit113c(m, m.u32((pQuestControl0 + 0x0c) >>> 0), 0x16, 0x0d) | 0) !== 0) return
  const pGame = m.u32(pObjInitStrc >>> 0) >>> 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl) >>> 0 : 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x14) pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pState + 0x20) >>> 0) !== 0) {
    const dwGuid = m.u32((pState + 0x2c) >>> 0) >>> 0
    if (pGame === 0) throw new D2CommonAssertError('QuestsFX.cpp', 0x2d3)
    let pMon = m.u32((pGame + ((dwGuid & 0x7f) << 2) + 0x1320) >>> 0) >>> 0
    while (pMon !== 0) {
      if ((m.u32((pMon + 0x0c) >>> 0) >>> 0) === dwGuid) {
        if ((m.u32((pMon + 0x04) >>> 0) | 0) === 0x129) return
        break
      }
      pMon = m.u32((pMon + 0xe4) >>> 0) >>> 0
    }
  }
  const sp = k2W5B9StackPtr
  k2W5B9StackPtr = (sp + 0x30) >>> 0
  let pCreated = 0
  try {
    m.fill(sp, 0x28, 0)
    m.setU32(sp, pGame)
    m.setU32((sp + 0x04) >>> 0, m.u32((pObjInitStrc + 0x08) >>> 0))
    m.setU32((sp + 0x0c) >>> 0, 0x129)
    m.setU32((sp + 0x10) >>> 0, 1)
    m.setU32((sp + 0x18) >>> 0, m.u32((pObjInitStrc + 0x14) >>> 0))
    m.setU32((sp + 0x1c) >>> 0, m.u32((pObjInitStrc + 0x18) >>> 0))
    m.setU32((sp + 0x20) >>> 0, 0xffffffff)
    pCreated = MONSTER_Create113c(m, sp) >>> 0
  } finally {
    k2W5B9StackPtr = sp
  }
  if (pCreated === 0) {
    pCreated = MONSTER_SpawnAtCoords113c(m, 0x129, 1, m.u32(pObjInitStrc >>> 0), m.u32((pObjInitStrc + 0x08) >>> 0), m.u32((pObjInitStrc + 0x14) >>> 0) | 0, m.u32((pObjInitStrc + 0x18) >>> 0) | 0, 3, 0) >>> 0
    if (pCreated === 0) {
      m.setU8((pState + 0x20) >>> 0, 0)
      return
    }
  }
  m.setU8((pState + 0x20) >>> 0, 1)
  m.setU32((pState + 0x2c) >>> 0, pCreated !== 0 ? m.u32((pCreated + 0x0c) >>> 0) : 0xffffffff)
  if (pCreated !== 0) {
    const pPathCopy = m.u32((pState + 0x24) >>> 0) >>> 0
    if (pPathCopy !== 0 && m.u32((pPathCopy + 0x04) >>> 0) !== 0 && m.u8((pState + 0x30) >>> 0) === 0) {
      DRLGPRESET_MovePointerAndClear113c(m, (pState + 0x24) >>> 0, AIGENERAL_GetQuestDataPtr38_113c(m, pCreated) >>> 0)
      m.setU8((pState + 0x30) >>> 0, 1)
    }
  }
}

/**
 * [4/45] Act 3 Quest 3 Compelling Orb (`0x16E`) preset spawn handler (`nQuest = 0x13`).
 *
 * @va D2Game:0x6FD084A0
 */
export function ACT3Q3_InitCompellingOrbPreset_6FD084A0_113c(
  m: D2KernMemory113c,
  pObjInitStrc: number,
): void {
  hitD2GameVa113c(0x6FD084A0)
  const pGame0 = m.u32(pObjInitStrc >>> 0) >>> 0
  const pQuestControl = m.u32((pGame0 + 0x10f4) >>> 0) >>> 0
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl) >>> 0 : 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x13) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pState + 0x0c) >>> 0) !== 0) {
    UNITS_ChangeAnimMode113c(m, m.u32((pObjInitStrc + 0x04) >>> 0), 2)
  }
  if (m.u8((pState + 0x28) >>> 0) !== 0) return
  const sp = k2W5B9StackPtr
  k2W5B9StackPtr = (sp + 0x30) >>> 0
  let pCreated = 0
  try {
    m.fill(sp, 0x28, 0)
    m.setU32(sp, m.u32(pObjInitStrc >>> 0))
    m.setU32((sp + 0x04) >>> 0, m.u32((pObjInitStrc + 0x08) >>> 0))
    m.setU32((sp + 0x0c) >>> 0, 0x16e)
    m.setU32((sp + 0x10) >>> 0, 1)
    m.setU32((sp + 0x18) >>> 0, m.u32((pObjInitStrc + 0x14) >>> 0))
    m.setU32((sp + 0x1c) >>> 0, m.u32((pObjInitStrc + 0x18) >>> 0))
    m.setU32((sp + 0x20) >>> 0, 0xffffffff)
    pCreated = MONSTER_Create113c(m, sp) >>> 0
  } finally {
    k2W5B9StackPtr = sp
  }
  if (pCreated !== 0) {
    m.setU32((pCreated + 0xc4) >>> 0, (m.u32((pCreated + 0xc4) >>> 0) | 0x20000) >>> 0)
    m.setU32((pState + 0x2c) >>> 0, m.u32((pCreated + 0x0c) >>> 0))
    m.setU8((pState + 0x28) >>> 0, 1)
  }
}

/**
 * [5/45] Act 3 Quest 2 (`The Gidbinn`, `nQuest = 0x0E`) boss (`0xFD`) preset spawn when `(0x10, 0x0D)` is set.
 *
 * @va D2Game:0x6FD08560
 */
export function ACT3Q2_InitGidbinnBossActivePreset_6FD08560_113c(
  m: D2KernMemory113c,
  pObjInitStrc: number,
): void {
  hitD2GameVa113c(0x6FD08560)
  const pGame0 = m.u32(pObjInitStrc >>> 0) >>> 0
  const pQuestControl0 = m.u32((pGame0 + 0x10f4) >>> 0) >>> 0
  if (pQuestControl0 === 0) return
  let pQuest = m.u32(pQuestControl0) >>> 0
  if (pQuest === 0) return
  while ((m.u32(pQuest) | 0) !== 0x0e) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return
  }
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU8((pState + 0x02) >>> 0, 1)
  m.setU32((pState + 0x04) >>> 0, m.u32((pObjInitStrc + 0x14) >>> 0))
  m.setU32((pState + 0x08) >>> 0, m.u32((pObjInitStrc + 0x18) >>> 0))
  const pGame1 = m.u32(pObjInitStrc >>> 0) >>> 0
  const pQuestControl1 = m.u32((pGame1 + 0x10f4) >>> 0) >>> 0
  if (m.u32((pQuestControl1 + 0x08) >>> 0) === 0) throw new D2CommonAssertError('QuestsFX.cpp', 0x82c)
  if ((DRLGWARP_TestRoomTileBit113c(m, m.u32((pQuestControl1 + 0x0c) >>> 0), 0x10, 0x0d) | 0) === 0) return
  if (m.u8((pState + 0x01) >>> 0) !== 0) return
  if (m.u8(pState >>> 0) !== 0) {
    const pGame2 = m.u32(pObjInitStrc >>> 0) >>> 0
    const dwGuid = m.u32((pState + 0x0c) >>> 0) >>> 0
    if (pGame2 === 0) throw new D2CommonAssertError('QuestsFX.cpp', 0x2d3)
    let pMon = m.u32((pGame2 + ((dwGuid & 0x7f) << 2) + 0x1320) >>> 0) >>> 0
    while (pMon !== 0) {
      if ((m.u32((pMon + 0x0c) >>> 0) >>> 0) === dwGuid) {
        m.setU8((pState + 0x03) >>> 0, 1)
        return
      }
      pMon = m.u32((pMon + 0xe4) >>> 0) >>> 0
    }
  }
  const pCreated = MONSTER_SpawnAtCoords113c(
    m,
    0xfd,
    1,
    m.u32(pObjInitStrc >>> 0),
    m.u32((pObjInitStrc + 0x08) >>> 0),
    m.u32((pObjInitStrc + 0x14) >>> 0) | 0,
    m.u32((pObjInitStrc + 0x18) >>> 0) | 0,
    -1,
    0,
  ) >>> 0
  if (pCreated === 0) return
  m.setU32((pState + 0x0c) >>> 0, m.u32((pCreated + 0x0c) >>> 0))
  m.setU8((pState + 0x01) >>> 0, 1)
  m.setU32((pCreated + 0xc4) >>> 0, (m.u32((pCreated + 0xc4) >>> 0) | 0x03000000) >>> 0)
  const pPathCopy = m.u32((pState + 0x18) >>> 0) >>> 0
  if (pPathCopy !== 0 && m.u32((pPathCopy + 0x04) >>> 0) !== 0 && m.u8((pState + 0x10) >>> 0) === 0) {
    DRLGPRESET_MovePointerAndClear113c(m, (pState + 0x18) >>> 0, AIGENERAL_GetQuestDataPtr38_113c(m, pCreated) >>> 0)
    m.setU8((pState + 0x10) >>> 0, 1)
  }
}

/**
 * [6/45] Act 3 Quest 2 (`The Gidbinn`, `nQuest = 0x0E`) boss (`0xFD`) preset spawn when `(0x10, 0x0D)` is clear.
 *
 * @va D2Game:0x6FD086A0
 */
export function ACT3Q2_InitGidbinnBossDefaultPreset_6FD086A0_113c(
  m: D2KernMemory113c,
  pObjInitStrc: number,
): void {
  hitD2GameVa113c(0x6FD086A0)
  const pGame0 = m.u32(pObjInitStrc >>> 0) >>> 0
  const pQuestControl = m.u32((pGame0 + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return
  while ((m.u32(pQuest) | 0) !== 0x0e) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return
  }
  if (m.u32((pQuestControl + 0x08) >>> 0) === 0) throw new D2CommonAssertError('QuestsFX.cpp', 0x82c)
  if ((DRLGWARP_TestRoomTileBit113c(m, m.u32((pQuestControl + 0x0c) >>> 0), 0x10, 0x0d) | 0) !== 0) return
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8(pState >>> 0) !== 0) {
    const pGame = m.u32(pObjInitStrc >>> 0) >>> 0
    const dwGuid = m.u32((pState + 0x0c) >>> 0) >>> 0
    if (pGame === 0) throw new D2CommonAssertError('QuestsFX.cpp', 0x2d3)
    let pMon = m.u32((pGame + ((dwGuid & 0x7f) << 2) + 0x1320) >>> 0) >>> 0
    while (pMon !== 0) {
      if ((m.u32((pMon + 0x0c) >>> 0) >>> 0) === dwGuid) return
      pMon = m.u32((pMon + 0xe4) >>> 0) >>> 0
    }
  }
  const pCreated = MONSTER_SpawnAtCoords113c(
    m,
    0xfd,
    1,
    m.u32(pObjInitStrc >>> 0),
    m.u32((pObjInitStrc + 0x08) >>> 0),
    m.u32((pObjInitStrc + 0x14) >>> 0) | 0,
    m.u32((pObjInitStrc + 0x18) >>> 0) | 0,
    -1,
    0,
  ) >>> 0
  if (pCreated !== 0) {
    m.setU32((pState + 0x0c) >>> 0, m.u32((pCreated + 0x0c) >>> 0))
    m.setU8(pState >>> 0, 1)
  }
}

/**
 * [7/45] Act 3 Quest 5 (`nQuest = 0x14`) stairs object init handler (`ecx = pObjInitStrc`).
 *
 * @va D2Game:0x6FD098E0
 */
export function ACT3Q5_InitStairsObject_6FD098E0_113c(
  m: D2KernMemory113c,
  pObjInitStrc: number,
): void {
  hitD2GameVa113c(0x6FD098E0)
  const pGame0 = m.u32(pObjInitStrc >>> 0) >>> 0
  const pQuestControl = m.u32((pGame0 + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return
  while ((m.u32(pQuest) | 0) !== 0x14) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return
  }
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU8((pState + 0x02) >>> 0, 1)
  const pObj0 = m.u32((pObjInitStrc + 0x04) >>> 0) >>> 0
  const dwObjGuid = pObj0 === 0 ? 0xffffffff : m.u32((pObj0 + 0x0c) >>> 0)
  const nAnimMode = m.u32((pState + 0x10) >>> 0) | 0
  m.setU32((pState + 0x08) >>> 0, dwObjGuid >>> 0)
  UNITS_ChangeAnimMode113c(m, m.u32((pObjInitStrc + 0x04) >>> 0), nAnimMode)
  if ((m.u32((pState + 0x10) >>> 0) | 0) !== 2) {
    const pGame = m.u32(pObjInitStrc >>> 0) >>> 0
    const frame = (m.u32((pGame + 0xa8) >>> 0) + 0x14) >>> 0
    EVENT_SetEventFull113c(m, pGame, m.u32((pObjInitStrc + 0x04) >>> 0), 7, frame, 0, 0, 0)
  }
}

/**
 * [8/45] Act 3 Quest 5 stairs proximity timer handler (`edi = pObjUnit`, `[esp+4] = pQuest`).
 *
 * @va D2Game:0x6FD09960
 */
export function ACT3Q5_OnStairsProximityTimer_6FD09960_113c(
  m: D2KernMemory113c,
  pObjUnit: number,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FD09960)
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if ((m.u32((pState + 0x0c) >>> 0) | 0) === 2) {
    const nMode = pObjUnit !== 0 ? (m.u32((pObjUnit + 0x10) >>> 0) | 0) : 0
    if (nMode === 2) return
    const pRoom = UNITS_GetRoom113c(m, pObjUnit >>> 0) >>> 0
    let pUnit = m.u32((pRoom + 0x74) >>> 0) >>> 0
    let foundNear = false
    while (pUnit !== 0) {
      if ((m.u32(pUnit) | 0) === 0) {
        if ((UNITS_GetDistanceToOtherUnit113c(m, pUnit, pObjUnit >>> 0) >>> 0) < 0x12) {
          foundNear = true
          break
        }
      }
      pUnit = m.u32((pUnit + 0xe8) >>> 0) >>> 0
    }
    if (foundNear) {
      if (nMode === 0) {
        m.setU32((pState + 0x10) >>> 0, 2)
        UNITS_ChangeAnimMode113c(m, pObjUnit >>> 0, 1)
      } else if (nMode === 1) {
        m.setU32((pState + 0x10) >>> 0, 2)
        UNITS_ChangeAnimMode113c(m, pObjUnit >>> 0, 2)
        UNITS_SetTargetUnitForDynamicUnitEx113c(m, pObjUnit >>> 0)
      }
    }
  }
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
  const frame = (m.u32((pGame + 0xa8) >>> 0) + 0x18) >>> 0
  EVENT_SetEventFull113c(m, pGame, pObjUnit >>> 0, 7, frame, 0, 0, 0)
}

/**
 * [9/45] Act 3 Quest 3 sewer lever opening helper (`eax = pQuest`).
 *
 * @va D2Game:0x6FD09EA0
 */
export function ACT3Q3_OpenSewerLeverObject_6FD09EA0_113c(
  m: D2KernMemory113c,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FD09EA0)
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8(pState >>> 0) !== 1) return
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
  const dwObjGuid = m.u32((pState + 0x04) >>> 0) >>> 0
  if (pGame === 0) throw new D2CommonAssertError('QuestsFX.cpp', 0x2d3)
  let pObj = m.u32((pGame + ((dwObjGuid & 0x7f) << 2) + 0x1520) >>> 0) >>> 0
  while (pObj !== 0 && (m.u32((pObj + 0x0c) >>> 0) >>> 0) !== dwObjGuid) {
    pObj = m.u32((pObj + 0xe4) >>> 0) >>> 0
  }
  if (pObj === 0) {
    m.setU32((pState + 0x08) >>> 0, 2)
    return
  }
  UNITS_ChangeAnimMode113c(m, pObj, m.u32((pState + 0x08) >>> 0) | 0)
  if ((m.u32((pState + 0x08) >>> 0) | 0) !== 2) {
    m.setU32((pState + 0x08) >>> 0, 2)
    const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pObj + 0x04) >>> 0) | 0) >>> 0
    const pGame2 = m.u32((pQuest + 0x04) >>> 0) >>> 0
    const frame = ((m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8) + m.u32((pGame2 + 0xa8) >>> 0)) >>> 0
    EVENT_SetEventFull113c(m, pGame2, pObj, 1, frame, 0, 0, 0)
  }
}

/**
 * [10/45] Corrupts nearby hostile non-Diablo monsters within `nRadius` with UMod `0x15` (`21`) and schedules timer `7`.
 *
 * @va D2Game:0x6FD0A730
 */
export function QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c(
  m: D2KernMemory113c,
  pGame: number,
  pCenterUnit: number,
  nRadius: number,
  nMinDelay: number,
  nMaxDelay: number,
  bOnlyDemonOrUndead: number,
): void {
  hitD2GameVa113c(0x6FD0A730)
  const pRoom = UNITS_GetRoom113c(m, pCenterUnit >>> 0) >>> 0
  const nTypeX = m.u32(pCenterUnit >>> 0) | 0
  let nX = 0
  if (nTypeX === 2 || (nTypeX > 3 && nTypeX <= 5)) {
    nX = m.u32((m.u32((pCenterUnit + 0x2c) >>> 0) + 0x0c) >>> 0) | 0
  } else {
    const pPath = m.u32((pCenterUnit + 0x2c) >>> 0) >>> 0
    nX = pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
  }
  const nTypeY = m.u32(pCenterUnit >>> 0) | 0
  let nY = 0
  if (nTypeY === 2 || (nTypeY > 3 && nTypeY <= 5)) {
    nY = m.u32((m.u32((pCenterUnit + 0x2c) >>> 0) + 0x10) >>> 0) | 0
  } else {
    const pPath = m.u32((pCenterUnit + 0x2c) >>> 0) >>> 0
    nY = pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0
  }
  if ((nMaxDelay | 0) === 0) throw new D2CommonAssertError('QuestsFX.cpp', 0x20)
  if ((nMaxDelay | 0) <= (nMinDelay | 0)) throw new D2CommonAssertError('QuestsFX.cpp', 0x21)

  const sp = k2W5B9StackPtr
  const pFindData = sp
  const pFilterArg = (sp + 0x30) >>> 0
  k2W5B9StackPtr = (sp + 0x70) >>> 0
  try {
    m.fill(sp, 0x68, 0)
    m.setU32(pFilterArg, 0x583)
    m.setU32((pFilterArg + 0x08) >>> 0, pCenterUnit >>> 0)
    m.setU32((pFilterArg + 0x0c) >>> 0, nX >>> 0)
    m.setU32((pFilterArg + 0x10) >>> 0, nY >>> 0)
    m.setU32((pFilterArg + 0x14) >>> 0, nRadius >>> 0)
    UNITFINDS_InitUnitFindData113c(m, m.u32((pGame + 0x1c) >>> 0), pFindData, pRoom, nX, nY, nRadius, 0, pFilterArg)
    UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(m, pFindData)
    let i = 0
    let nCount = m.u32((pFindData + 0x18) >>> 0) | 0
    while (i < nCount) {
      const pUnitsArray = m.u32((pFindData + 0x04) >>> 0) >>> 0
      const pMon = m.u32((pUnitsArray + i * 4) >>> 0) >>> 0
      if (pMon !== 0 && (m.u32(pMon) | 0) === 1) {
        let bOk = (UNIT_GetAlignment113c(m, pMon) | 0) === 0 ? 1 : 0
        if (bOnlyDemonOrUndead !== 0 && (MONSTERS_IsDemonOrUndead113c(m, pMon) | 0) === 0) {
          bOk = 0
        }
        if ((m.u32((pMon + 0x04) >>> 0) | 0) !== 0x14d && bOk !== 0) {
          const roll = SEED_RollLimitedFast113c(m, (pCenterUnit + 0x20) >>> 0, (nMaxDelay - nMinDelay) | 0)
          const frame = (m.u32((pGame + 0xa8) >>> 0) + ((roll + nMinDelay) >>> 0)) >>> 0
          EVENT_SetEventFull113c(m, pGame >>> 0, pMon, 7, frame, 0, 0, 0)
          MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, pMon, 0x15, pGame >>> 0, 0)
        }
      }
      i = (i + 1) | 0
      nCount = m.u32((pFindData + 0x18) >>> 0) | 0
    }
    UNITFINDS_FreeUnitFindData113c(m, pFindData)
  } finally {
    k2W5B9StackPtr = sp
  }
}

/**
 * [11/45] Spawns quest projectile `0x12B` (`299`, duration `100`, flags `0x8000`) from `pOwnerUnit` (`edx`).
 *
 * @va D2Game:0x6FD0AB10
 */
export function QUESTS_SpawnProjectile12B_6FD0AB10_113c(
  m: D2KernMemory113c,
  pOwnerUnit: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FD0AB10)
  const sp = k2W5B9StackPtr
  k2W5B9StackPtr = (sp + 0x60) >>> 0
  try {
    m.fill(sp, 0x5c, 0)
    m.setU32(sp, 0x8000)
    m.setU32((sp + 0x04) >>> 0, pOwnerUnit >>> 0)
    m.setU32((sp + 0x08) >>> 0, pOwnerUnit >>> 0)
    m.setU32((sp + 0x10) >>> 0, 0x12b)
    m.setU32((sp + 0x30) >>> 0, 1)
    m.setU32((sp + 0x4c) >>> 0, 0x64)
    return MISSILE_CreateServerProjectile113c(m, pGame >>> 0, sp) >>> 0
  } finally {
    k2W5B9StackPtr = sp
  }
}

/**
 * [12/45] Fires portal-opening projectile `0x170` (`368`) from `pUnit` (`ebx`) to adjacent Hellgate object `0x182`.
 *
 * @va D2Game:0x6FD0AB60
 */
export function ACT3Q6_FireHellgateOpenerProjectile_6FD0AB60_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FD0AB60)
  const pRoom0 = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  const pPortalObj = UNITFINDS_FindUnitInAdjacentRooms113c(m, pRoom0, 2, 0x182) >>> 0
  if (pPortalObj === 0) throw new D2CommonAssertError('QuestsFX.cpp', 0x8f)

  const sp = k2W5B9StackPtr
  k2W5B9StackPtr = (sp + 0x60) >>> 0
  let pMissile = 0
  try {
    m.fill(sp, 0x5c, 0)
    m.setU32(sp, 0x420)
    m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((sp + 0x08) >>> 0, pUnit >>> 0)
    m.setU32((sp + 0x10) >>> 0, 0x170)
    const nTypeX = m.u32(pPortalObj) | 0
    let targetX = 0
    if (nTypeX === 2 || (nTypeX > 3 && nTypeX <= 5)) {
      targetX = m.u32((m.u32((pPortalObj + 0x2c) >>> 0) + 0x0c) >>> 0)
    } else {
      const pPath = m.u32((pPortalObj + 0x2c) >>> 0) >>> 0
      targetX = pPath !== 0 ? PATH_GetPosX113c(m, pPath) : 0
    }
    m.setU32((sp + 0x1c) >>> 0, targetX >>> 0)
    const nTypeY = m.u32(pPortalObj) | 0
    let targetY = 0
    if (nTypeY === 2 || (nTypeY > 3 && nTypeY <= 5)) {
      targetY = m.u32((m.u32((pPortalObj + 0x2c) >>> 0) + 0x10) >>> 0)
    } else {
      const pPath = m.u32((pPortalObj + 0x2c) >>> 0) >>> 0
      targetY = pPath !== 0 ? PATH_GetPosY113c(m, pPath) : 0
    }
    m.setU32((sp + 0x20) >>> 0, targetY >>> 0)
    m.setU32((sp + 0x30) >>> 0, 1)
    pMissile = MISSILE_CreateServerProjectile113c(m, pGame >>> 0, sp) >>> 0
  } finally {
    k2W5B9StackPtr = sp
  }
  if (pMissile !== 0) {
    MISSILE_SetTargetX113c(m, pMissile, m.u32((pPortalObj + 0x0c) >>> 0) | 0)
    const pObjRoom = UNITS_GetRoom113c(m, pPortalObj) >>> 0
    DUNGEON_ToggleHasPortalFlag113c(m, pObjRoom, 0)
    return
  }
  if ((m.u32((pPortalObj + 0x10) >>> 0) | 0) === 0) {
    UNITS_ChangeAnimMode113c(m, pPortalObj, 1)
    const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, 0x182) >>> 0
    const frame = ((m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8) + m.u32((pGame + 0xa8) >>> 0)) >>> 0
    EVENT_SetEventFull113c(m, pGame >>> 0, pPortalObj, 1, frame, 0, 0, 0)
  }
}

/**
 * [13/45] Allocates `nPoints` (`eax`) into Vitality (`STAT_VITALITY = 3`) on `pPlayerUnit` (`esi`),
 * adjusting stat points (`4`), life (`6`/`7`), and stamina (`10`/`11`) from `CharStats.txt`.
 *
 * @va D2Game:0x6FD0AD10
 */
export function PLAYERSTATS_AllocateVitalityPoints_6FD0AD10_113c(
  m: D2KernMemory113c,
  nPoints: number,
  pPlayerUnit: number,
): void {
  hitD2GameVa113c(0x6FD0AD10)
  const pts = nPoints | 0
  const pUnit = pPlayerUnit >>> 0
  if (pts === 0 || pUnit === 0) return
  const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  if (nClassId < 0) return
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  if (nClassId >= (m.u32((pDataTables + 0xbc8) >>> 0) | 0)) return
  const pCharStatsBase = m.u32((pDataTables + 0xbc4) >>> 0) >>> 0
  const pCharStats = (pCharStatsBase + imul32(nClassId, 0xc4)) >>> 0
  if (pCharStats === 0) return

  STATLIST_AddUnitStatMemPort113c(m, pUnit, 4, (-pts) | 0, 0)
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 3, pts, 0)

  const nLifePerVit = m.u8((pCharStats + 0x46) >>> 0)
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 7, (imul32(nLifePerVit, pts) << 6) | 0, 0)
  if (pts > 0) {
    const nLifePerVitCur = m.u8((pCharStats + 0x46) >>> 0)
    STATLIST_AddUnitStatMemPort113c(m, pUnit, 6, (imul32(nLifePerVitCur, pts) << 6) | 0, 0)
  }
  const maxHp = STATLIST_GetUnitStat113c(m, pUnit, 7, 0) | 0
  const curHp = STATLIST_GetUnitStat113c(m, pUnit, 6, 0) | 0
  if (curHp > maxHp) {
    STATLIST_SetUnitStat113c(m, pUnit, 6, maxHp, 0)
  }

  const nStamPerVit = m.u8((pCharStats + 0x47) >>> 0)
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x0b, (imul32(nStamPerVit, pts) << 6) | 0, 0)
  if (pts > 0) {
    const nStamPerVitCur = m.u8((pCharStats + 0x47) >>> 0)
    STATLIST_AddUnitStatMemPort113c(m, pUnit, 0x0a, (imul32(nStamPerVitCur, pts) << 6) | 0, 0)
  }
  const maxStam = STATLIST_GetUnitStat113c(m, pUnit, 0x0b, 0) | 0
  const curStam = STATLIST_GetUnitStat113c(m, pUnit, 0x0a, 0) | 0
  if (curStam > maxStam) {
    STATLIST_SetUnitStat113c(m, pUnit, 0x0a, maxStam, 0)
  }
}

/**
 * [14/45] Allocates `nPoints` (`eax`) into Energy (`STAT_ENERGY = 1`) on `pPlayerUnit` (`esi`),
 * adjusting stat points (`4`) and mana (`8`/`9`) from `CharStats.txt`.
 *
 * @va D2Game:0x6FD0AE20
 */
export function PLAYERSTATS_AllocateEnergyPoints_6FD0AE20_113c(
  m: D2KernMemory113c,
  nPoints: number,
  pPlayerUnit: number,
): void {
  hitD2GameVa113c(0x6FD0AE20)
  const pts = nPoints | 0
  const pUnit = pPlayerUnit >>> 0
  if (pts === 0 || pUnit === 0) return
  const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  if (nClassId < 0) return
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  if (nClassId >= (m.u32((pDataTables + 0xbc8) >>> 0) | 0)) return
  const pCharStatsBase = m.u32((pDataTables + 0xbc4) >>> 0) >>> 0
  const pCharStats = (pCharStatsBase + imul32(nClassId, 0xc4)) >>> 0
  if (pCharStats === 0) return

  STATLIST_AddUnitStatMemPort113c(m, pUnit, 4, (-pts) | 0, 0)
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 1, pts, 0)

  if (pts > 0) {
    const nManaPerEnrCur = m.u8((pCharStats + 0x48) >>> 0)
    STATLIST_AddUnitStatMemPort113c(m, pUnit, 8, (imul32(nManaPerEnrCur, pts) << 6) | 0, 0)
  }
  const nManaPerEnr = m.u8((pCharStats + 0x48) >>> 0)
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 9, (imul32(nManaPerEnr, pts) << 6) | 0, 0)
  const maxMana = STATLIST_GetUnitStat113c(m, pUnit, 9, 0) | 0
  const curMana = STATLIST_GetUnitStat113c(m, pUnit, 8, 0) | 0
  if (curMana > maxMana) {
    STATLIST_SetUnitStat113c(m, pUnit, 8, maxMana, 0)
  }
}

/**
 * [15/45] Living-player callback wrapper forwarding `(pTargetPlayer = [esp+4], pRecipientPlayer = edx)`
 * to `NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c`.
 *
 * @va D2Game:0x6FD0B070
 */
export function PARTY_SendRosterUpdateCallback_6FD0B070_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pRecipientPlayer: number,
  pTargetPlayer: number,
): number {
  hitD2GameVa113c(0x6FD0B070)
  return NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c(
    m,
    pTargetPlayer >>> 0,
    pRecipientPlayer >>> 0,
  )
}

/**
 * [16/45] Serializes the 52-byte (`0x34`, header `0x7701`) NPC/quest intro flags section for `pPlayerUnit` (`ecx`).
 *
 * @va D2Game:0x6FD0B610
 */
export function PLAYERSAVE_WritePlrIntroSection_6FD0B610_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  ppCurPos: number,
  pEndPos: number,
): number {
  hitD2GameVa113c(0x6FD0B610)
  const pCur = m.u32(ppCurPos >>> 0) >>> 0
  const pNext = (pCur + 0x34) >>> 0
  if (pNext > (pEndPos >>> 0)) return 1
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit >>> 0) >>> 0
  if (pPlayerData === 0) return 2

  const sp = k2W5B9StackPtr
  k2W5B9StackPtr = (sp + 0x38) >>> 0
  try {
    m.fill(sp, 0x34, 0)
    const pIntro0 = m.u32((pPlayerData + 0x60) >>> 0) >>> 0
    const pQIntro0 = m.u32(m.u32(pIntro0) >>> 0) >>> 0
    const q0Lo = m.u32(pQIntro0)
    m.setU32((sp + 0x08) >>> 0, m.u32((pQIntro0 + 0x04) >>> 0))
    const pNIntro0 = m.u32(m.u32((pIntro0 + 0x04) >>> 0) >>> 0) >>> 0
    const n0Lo = m.u32(pNIntro0)
    m.setU32((sp + 0x20) >>> 0, m.u32((pNIntro0 + 0x04) >>> 0))
    m.setU32((sp + 0x1c) >>> 0, n0Lo)

    const pIntro1 = m.u32((pPlayerData + 0x64) >>> 0) >>> 0
    const pQIntro1 = m.u32(m.u32(pIntro1) >>> 0) >>> 0
    const pIntro2 = m.u32((pPlayerData + 0x68) >>> 0) >>> 0
    m.setU32((sp + 0x04) >>> 0, q0Lo)
    const q1Lo = m.u32(pQIntro1)
    m.setU32((sp + 0x10) >>> 0, m.u32((pQIntro1 + 0x04) >>> 0))
    const pNIntro1 = m.u32(m.u32((pIntro1 + 0x04) >>> 0) >>> 0) >>> 0
    m.setU32((sp + 0x24) >>> 0, m.u32(pNIntro1))
    m.setU32((sp + 0x28) >>> 0, m.u32((pNIntro1 + 0x04) >>> 0))

    const pQIntro2 = m.u32(m.u32(pIntro2) >>> 0) >>> 0
    m.setU32((sp + 0x14) >>> 0, m.u32(pQIntro2))
    m.setU32((sp + 0x18) >>> 0, m.u32((pQIntro2 + 0x04) >>> 0))
    const pNIntro2 = m.u32(m.u32((pIntro2 + 0x04) >>> 0) >>> 0) >>> 0
    m.setU32((sp + 0x0c) >>> 0, q1Lo)
    m.setU32((sp + 0x2c) >>> 0, m.u32(pNIntro2))
    m.setU16(sp, 0x7701)
    m.setU16((sp + 0x02) >>> 0, 0x34)
    m.setU32((sp + 0x30) >>> 0, m.u32((pNIntro2 + 0x04) >>> 0))

    for (let i = 0; i < 0x34; i += 4) {
      m.setU32((pCur + i) >>> 0, m.u32((sp + i) >>> 0))
    }
    m.setU32(ppCurPos >>> 0, pNext)
    return 0
  } finally {
    k2W5B9StackPtr = sp
  }
}

/**
 * [17/45] Serializes the 80-byte (`0x50`, header `'WS'` `0x5357`) waypoint section (`ecx = pEndPos`).
 *
 * @va D2Game:0x6FD0B700
 */
export function PLAYERSAVE_WriteWaypointSection_6FD0B700_113c(
  m: D2KernMemory113c,
  pEndPos: number,
  pPlayerUnit: number,
  ppCurPos: number,
): number {
  hitD2GameVa113c(0x6FD0B700)
  const pCur = m.u32(ppCurPos >>> 0) >>> 0
  const pNext = (pCur + 0x50) >>> 0
  if (pNext > (pEndPos >>> 0)) return 1
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit >>> 0) >>> 0
  if (pPlayerData === 0) return 2

  const sp = k2W5B9StackPtr
  k2W5B9StackPtr = (sp + 0x54) >>> 0
  try {
    m.fill(sp, 0x50, 0)
    m.setU16(sp, 0x5357)
    m.setU32((sp + 0x02) >>> 0, 1)
    m.setU16((sp + 0x06) >>> 0, 0x50)
    for (let i = 0; i < 3; i = (i + 1) | 0) {
      const pWpSrc = m.u32((pPlayerData + 0x1c + i * 4) >>> 0) >>> 0
      WAYPOINT_CopyAndValidateWaypointData113c(m, pWpSrc, (sp + 0x08 + i * 0x18) >>> 0)
    }
    for (let i = 0; i < 0x50; i += 4) {
      m.setU32((pCur + i) >>> 0, m.u32((sp + i) >>> 0))
    }
    m.setU32(ppCurPos >>> 0, pNext)
    return 0
  } finally {
    k2W5B9StackPtr = sp
  }
}

/**
 * [18/45] Serializes the 298-byte (`0x12A`, header `'Woo!'` `0x216F6F57`) quest section (`ecx = pEndPos`).
 *
 * @va D2Game:0x6FD0B7B0
 */
export function PLAYERSAVE_WriteQuestSection_6FD0B7B0_113c(
  m: D2KernMemory113c,
  pEndPos: number,
  pPlayerUnit: number,
  ppCurPos: number,
): number {
  hitD2GameVa113c(0x6FD0B7B0)
  const pCur = m.u32(ppCurPos >>> 0) >>> 0
  const pNext = (pCur + 0x12a) >>> 0
  if (pNext > (pEndPos >>> 0)) return 1
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit >>> 0) >>> 0
  if (pPlayerData === 0) return 2

  const sp = k2W5B9StackPtr
  k2W5B9StackPtr = (sp + 0x130) >>> 0
  try {
    m.fill(sp, 0x12a, 0)
    m.setU32(sp, 0x216f6f57)
    m.setU32((sp + 0x04) >>> 0, 6)
    m.setU16((sp + 0x08) >>> 0, 0x12a)
    for (let i = 0; i < 3; i = (i + 1) | 0) {
      const pQuestRecord = m.u32((pPlayerData + 0x10 + i * 4) >>> 0) >>> 0
      QUESTRECORD_CopyRecordToBuffer113c(m, pQuestRecord, (sp + 0x0a + i * 0x60) >>> 0, 0x60, 1)
    }
    for (let i = 0; i < 0x128; i += 4) {
      m.setU32((pCur + i) >>> 0, m.u32((sp + i) >>> 0))
    }
    m.setU16((pCur + 0x128) >>> 0, m.u16((sp + 0x128) >>> 0))
    m.setU32(ppCurPos >>> 0, pNext)
    return 0
  } finally {
    k2W5B9StackPtr = sp
  }
}

/**
 * [19/45] Serializes the `'if'` (`0x6669`) class skill-levels section for `pPlayerUnit` (`ebx`).
 *
 * @va D2Game:0x6FD0BC40
 */
export function PLAYERSAVE_WriteSkillSection_6FD0BC40_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  ppCurPos: number,
  pEndPos: number,
): number {
  hitD2GameVa113c(0x6FD0BC40)
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  let pCur = m.u32(ppCurPos >>> 0) >>> 0
  const nMaxClassSkills = m.u32((pDataTables + 0xba8) >>> 0)
  if (((pCur + nMaxClassSkills + 2) >>> 0) > (pEndPos >>> 0)) return 1

  m.setU16(pCur, 0x6669)
  pCur = (pCur + 2) >>> 0
  if (pPlayerUnit === 0 || (m.u32(pPlayerUnit >>> 0) | 0) !== 0) {
    throw new D2CommonAssertError('PlrSave.cpp', 0x8a4)
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit >>> 0) >>> 0
  const pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  if (pClient === 0) throw new D2CommonAssertError('PlrSave.cpp', 0x8a4)

  const nCharClass = m.u8((pClient + 0x08) >>> 0)
  if ((nCharClass | 0) >= 7) return 2

  let i = 0
  let nCount = SKILLS_GetClassSkillCount113c(m, nCharClass) | 0
  while (i < nCount) {
    const nSkillId = SKILLS_GetClassSkillId113c(m, nCharClass, i)
    const pSkill = SKILLS_GetSkillById113c(m, pPlayerUnit >>> 0, nSkillId, -1) >>> 0
    const bLvl = SKILLS_EvaluateSkillLevel113c(m, pPlayerUnit >>> 0, pSkill, 0) & 0xff
    m.setU8(pCur, bLvl)
    pCur = (pCur + 1) >>> 0
    i = (i + 1) | 0
    nCount = SKILLS_GetClassSkillCount113c(m, nCharClass) | 0
  }
  m.setU32(ppCurPos >>> 0, pCur)
  return 0
}

/**
 * [20/45] Returns the 1-based inventory item index (`1..0x7FFE`) of `dwTargetItemGuid` on `pPlayerUnit`, or `0`.
 *
 * @va D2Game:0x6FD0BD10
 */
export function PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  dwTargetItemGuid: number,
): number {
  hitD2GameVa113c(0x6FD0BD10)
  if ((dwTargetItemGuid | 0) === -1) return 0
  const pInventory = m.u32((pPlayerUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) return 0
  let idx = 1
  let pItem = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
  while (pItem !== 0) {
    const pValid = INVENTORY_UnitIsItem113c(m, pItem) >>> 0
    pItem = INVENTORY_GetNextItem113c(m, pItem) >>> 0
    const dwGuid = pValid !== 0 ? m.u32((pValid + 0x0c) >>> 0) : 0xffffffff
    if ((dwGuid >>> 0) === (dwTargetItemGuid >>> 0)) {
      if (idx >= 0x7fff) throw new D2CommonAssertError('PlrSave.cpp', 0x185)
      return idx & 0xffff
    }
    idx = (idx + 1) | 0
  }
  return 0
}

function w5b9BitInit113c(m: D2KernMemory113c, pBs: number, pBuf: number, nBytes: number): void {
  m.setU32(pBs >>> 0, pBuf >>> 0)
  m.setU32((pBs + 0x04) >>> 0, ((nBytes | 0) << 3) >>> 0)
  m.setU32((pBs + 0x08) >>> 0, 0)
  m.setU32((pBs + 0x0c) >>> 0, 0)
  m.setU32((pBs + 0x10) >>> 0, 0)
}

function w5b9BitWrite113c(m: D2KernMemory113c, pBs: number, nValue: number, nBits: number): void {
  const bs = pBs >>> 0
  const curBit0 = m.u32((bs + 0x0c) >>> 0) | 0
  const curByte0 = m.u32((bs + 0x08) >>> 0) | 0
  const maxBits = m.u32((bs + 0x04) >>> 0) | 0
  let rem = nBits | 0
  if (((curBit0 + (curByte0 << 3) + rem) | 0) > maxBits) {
    m.setU32((bs + 0x10) >>> 0, 1)
    m.setU32((bs + 0x08) >>> 0, (((maxBits + ((maxBits >> 31) & 7)) | 0) >> 3) >>> 0)
    m.setU32((bs + 0x0c) >>> 0, 0)
    return
  }
  if (curBit0 === 0 && ((curByte0 << 3) | 0) < maxBits) {
    m.setU8(m.u32(bs), 0)
  }
  if (rem <= 0) return
  let val = nValue | 0
  while (rem > 0) {
    const curBit = m.u32((bs + 0x0c) >>> 0) | 0
    let chunk = (8 - curBit) | 0
    if (chunk > rem) chunk = rem
    const mask = ((1 << chunk) - 1) & 0xff
    const pOut = m.u32(bs)
    m.setU8(pOut, (m.u8(pOut) | (((val & mask) << (curBit & 31)) & 0xff)) & 0xff)
    const nextBit = (curBit + chunk) | 0
    m.setU32((bs + 0x0c) >>> 0, nextBit >>> 0)
    if (nextBit === 8) {
      const nextByte = ((m.u32((bs + 0x08) >>> 0) | 0) + 1) | 0
      const nextOut = (pOut + 1) >>> 0
      m.setU32(bs, nextOut)
      m.setU32((bs + 0x08) >>> 0, nextByte >>> 0)
      m.setU32((bs + 0x0c) >>> 0, 0)
      if (((nextByte << 3) | 0) < maxBits) {
        m.setU8(nextOut, 0)
      }
    }
    val = val >> chunk
    rem = (rem - chunk) | 0
  }
}

function w5b9BitSize113c(m: D2KernMemory113c, pBs: number): number {
  const bs = pBs >>> 0
  const nPos = m.u32((bs + 0x08) >>> 0) | 0
  return m.u32((bs + 0x0c) >>> 0) !== 0 ? (nPos + 1) | 0 : nPos
}

/**
 * [21/45] Serializes the `'gf'` (`0x6667`) player base-stats bitstream section (`ItemStatCost.txt` CSV encoding).
 *
 * @va D2Game:0x6FD0BE70
 */
export function PLAYERSAVE_WriteStatsSection_6FD0BE70_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  ppCurPos: number,
  pEndPos: number,
): number {
  hitD2GameVa113c(0x6FD0BE70)
  const pCur = m.u32(ppCurPos >>> 0) >>> 0
  const pBitStart = (pCur + 2) >>> 0
  if (pBitStart > (pEndPos >>> 0)) return 1

  const sp = k2W5B9StackPtr
  const pBs = sp
  const pStatsBuf = (sp + 0x20) >>> 0
  k2W5B9StackPtr = (sp + 0x1028) >>> 0
  try {
    m.setU16(pCur, 0x6667)
    w5b9BitInit113c(m, pBs, pBitStart, ((pEndPos >>> 0) - pBitStart) | 0)
    const pStatList = m.u32((pPlayerUnit + 0x5c) >>> 0) >>> 0
    if (pStatList !== 0) {
      const nStats = STATLIST_CopyBaseStatsToBuffer113c(m, pStatList, pStatsBuf, 0x200) | 0
      for (let i = 0; i < nStats; i = (i + 1) | 0) {
        const pEntry = (pStatsBuf + i * 8) >>> 0
        const wSubIdx = m.u16(pEntry)
        const nStatId = m.u16((pEntry + 2) >>> 0)
        let nVal = m.u32((pEntry + 4) >>> 0) | 0
        if ((nStatId | 0) < 0) continue
        const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
        if ((nStatId | 0) >= (m.u32((pDataTables + 0xbd4) >>> 0) | 0)) continue
        const pIscBase = m.u32((pDataTables + 0xbcc) >>> 0) >>> 0
        const pIsc = (pIscBase + imul32(nStatId, 0x144)) >>> 0
        if (pIsc === 0) continue
        const bCSvBits = m.u8((pIsc + 0x0a) >>> 0)
        if (bCSvBits === 0) continue
        if (bCSvBits < 0x20) {
          const bFlagByte5 = m.u8((pIsc + 0x05) >>> 0)
          const pMasks = m.u32(0x6fd18be0) >>> 0
          if ((m.u8((pMasks + 0x14) >>> 0) & bFlagByte5) !== 0) {
            const shift = (bCSvBits - 1) & 31
            const maxS = ((1 << shift) - 1) | 0
            const minS = ((-1) << shift) | 0
            const lo = nVal > minS ? nVal : minS
            nVal = lo < maxS ? lo : maxS
          } else {
            const maxU = ((1 << (bCSvBits & 31)) - 1) | 0
            if (nVal <= 0) nVal = 0
            if (nVal >= maxU) nVal = maxU
          }
        }
        w5b9BitWrite113c(m, pBs, nStatId, 9)
        const bCSvParam = m.u8((pIsc + 0x0b) >>> 0)
        if (bCSvParam !== 0) w5b9BitWrite113c(m, pBs, wSubIdx, bCSvParam)
        w5b9BitWrite113c(m, pBs, nVal, m.u8((pIsc + 0x0a) >>> 0))
      }
    }
    w5b9BitWrite113c(m, pBs, 0x1ff, 9)
    const nWritten = w5b9BitSize113c(m, pBs) | 0
    m.setU32(ppCurPos >>> 0, (pBitStart + nWritten) >>> 0)
    return 0
  } finally {
    k2W5B9StackPtr = sp
  }
}

/**
 * [22/45] Serializes the `'kf'` (`0x666B`) Iron Golem item section in Expansion games (`eax = pGame`).
 *
 * @va D2Game:0x6FD0C020
 */
export function PLAYERSAVE_WriteIronGolemSection_6FD0C020_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  ppCurPos: number,
  pEndPos: number,
  _arg4 = 0,
  _arg5 = 0,
): number {
  hitD2GameVa113c(0x6FD0C020)
  let pCur = m.u32(ppCurPos >>> 0) >>> 0
  if (m.u32((pGame + 0x70) >>> 0) === 0) return 0
  m.setU16(pCur, 0x666b)
  pCur = (pCur + 2) >>> 0

  const pPet = PETS_GetFirstPetUnitByType_6FCB6A40_113c(m, pPlayerUnit >>> 0, 3, 1, pGame >>> 0) >>> 0
  let pGolemItem = 0
  let bHasGolem = 0
  if (pPet !== 0 && (m.u32((pPet + 0x04) >>> 0) | 0) === 0x123) {
    if (SKILLS_GetSkillById113c(m, pPlayerUnit >>> 0, 0x5a, -1) !== 0) {
      const pPetInv = m.u32((pPet + 0x60) >>> 0) >>> 0
      if (pPetInv !== 0) {
        const pFirst = INVENTORY_GetFirstItem113c(m, pPetInv) >>> 0
        if (pFirst !== 0) {
          pGolemItem = INVENTORY_UnitIsItem113c(m, pFirst) >>> 0
          if (pGolemItem !== 0) bHasGolem = 1
        }
      }
    }
  }
  const pFlagPos = pCur
  m.setU8(pCur, bHasGolem & 0xff)
  pCur = (pCur + 1) >>> 0
  if (bHasGolem !== 0) {
    const nWritten = SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(
      m,
      pGolemItem,
      ((pEndPos >>> 0) - pCur) | 0,
      pCur,
    ) | 0
    if (nWritten <= 0) m.setU8(pFlagPos, 0)
    pCur = (pCur + nWritten) >>> 0
  }
  m.setU32(ppCurPos >>> 0, pCur)
  return 0
}

/**
 * [23/45] Wrapper writing player inventory or cached save buffer (`eax = pEndPos`, `edi = ppCurPos`).
 *
 * @va D2Game:0x6FD0C0E0
 */
export function PLAYERSAVE_WritePlayerItemsSection_6FD0C0E0_113c(
  m: D2KernMemory113c,
  pEndPos: number,
  arg5: number,
  arg4: number,
  ppCurPos: number,
  pGame: number,
  pPlayerUnit: number,
  bUseCached5C: number,
): number {
  hitD2GameVa113c(0x6FD0C0E0)
  const pCur = m.u32(ppCurPos >>> 0) >>> 0
  const nWritten = PLAYERSAVE_WriteInventoryOrCachedSaveBuffer_6FC73B40_113c(
    m,
    pPlayerUnit >>> 0,
    pGame >>> 0,
    pCur,
    ((pEndPos >>> 0) - pCur) | 0,
    bUseCached5C,
    arg4,
    arg5,
  ) | 0
  if (nWritten < 0) return 3
  m.setU32(ppCurPos >>> 0, (pCur + nWritten) >>> 0)
  return 0
}

/**
 * [24/45] Populates `.d2s` header hireling fields (`+0xAF..+0xBB`) from active pet bucket `7` (`eax = pGame`).
 *
 * @va D2Game:0x6FD0C120
 */
export function PLAYERSAVE_WriteHirelingHeaderFields_6FD0C120_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  pSaveHeader: number,
): void {
  hitD2GameVa113c(0x6FD0C120)
  const pMerc = PETS_GetFirstPetUnitByType_6FCB6A40_113c(m, pPlayerUnit >>> 0, 7, 1, pGame >>> 0) >>> 0
  if (pMerc === 0) return
  const pPetArg = PETS_FindPetArgByGuid_6FCB6570_113c(m, pPlayerUnit >>> 0, m.u32((pMerc + 0x0c) >>> 0)) >>> 0
  const nLevel = STATLIST_GetUnitStat113c(m, pMerc, 0x0c, 0)
  const pHirelingTxt = DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c(
    m,
    m.u32((pGame + 0x70) >>> 0),
    m.u32((pPetArg + 0x08) >>> 0),
    nLevel,
  ) >>> 0
  if (pHirelingTxt === 0) return

  m.setU32((pSaveHeader + 0xb3) >>> 0, m.u32(pPetArg))
  m.setU16((pSaveHeader + 0xb7) >>> 0, m.u16((pPetArg + 0x04) >>> 0))
  m.setU16((pSaveHeader + 0xb9) >>> 0, m.u16((pPetArg + 0x08) >>> 0))
  m.setU32((pSaveHeader + 0xbb) >>> 0, STATLIST_GetUnitStat113c(m, pMerc, 0x0d, 0) >>> 0)
  m.setU32((pSaveHeader + 0xaf) >>> 0, 0)
  const wNameFirst = m.u16((pHirelingTxt + 0x114) >>> 0)
  m.setU16((pSaveHeader + 0xb7) >>> 0, (m.u16((pSaveHeader + 0xb7) >>> 0) - wNameFirst) & 0xffff)
  if ((SUNIT_IsDeadOrDying113c(m, pMerc) | 0) !== 0) {
    m.setU32((pSaveHeader + 0xaf) >>> 0, 0x10000)
  }
}

/**
 * [25/45] Serializes the `'jf'` (`0x666A`) hireling inventory items section in Expansion games (`eax = pGame`).
 *
 * @va D2Game:0x6FD0C1E0
 */
export function PLAYERSAVE_WriteHirelingItemsSection_6FD0C1E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  ppCurPos: number,
  pEndPos: number,
  arg4 = 0,
  arg5 = 0,
): number {
  hitD2GameVa113c(0x6FD0C1E0)
  let pCur = m.u32(ppCurPos >>> 0) >>> 0
  if (m.u32((pGame + 0x70) >>> 0) === 0) return 0
  m.setU16(pCur, 0x666a)
  pCur = (pCur + 2) >>> 0

  const pMerc = PETS_GetFirstPetUnitByType_6FCB6A40_113c(m, pPlayerUnit >>> 0, 7, 1, pGame >>> 0) >>> 0
  if (pMerc !== 0) {
    const nWritten = PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c(
      m,
      pCur,
      m.u32((pMerc + 0x60) >>> 0),
      pGame >>> 0,
      pMerc,
      ((pEndPos >>> 0) - pCur) | 0,
      0,
      arg4,
      arg5,
    ) | 0
    if (nWritten < 0) return 5
    pCur = (pCur + nWritten) >>> 0
  }
  m.setU32(ppCurPos >>> 0, pCur)
  return 0
}

/**
 * [26/45] Spawns `nCount` (`eax`) party minions around `pLeader` (`esi`) in game `pGame` (`ebx`) and links each to `pLeader`.
 *
 * @va D2Game:0x6FD0DE90
 */
export function MONSTER_SpawnMinionPackInRing_6FD0DE90_113c(
  m: D2KernMemory113c,
  nCount: number,
  pGame: number,
  pLeader: number,
  nMode: number,
  nClassId: number,
  nMaxRadius: number,
  wFlags: number,
): number {
  hitD2GameVa113c(0x6FD0DE90)
  if (pLeader === 0) return 0
  const dwLeaderGuid = m.u32((pLeader + 0x0c) >>> 0) >>> 0
  let bSpawnedAny = 0
  let rem = nCount | 0
  if (rem > 0) {
    while (rem !== 0) {
      const pMinion = MONSTER_SpawnPartyMinionInRing113c(
        m,
        nClassId,
        pLeader >>> 0,
        nMode,
        pGame >>> 0,
        nMaxRadius,
        wFlags,
      ) >>> 0
      if (pMinion !== 0) {
        bSpawnedAny = 1
        if ((m.u32(pMinion) | 0) === 1) {
          const pMonData = m.u32((pMinion + 0x14) >>> 0) >>> 0
          const pAiGeneral = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
          m.setU32((pAiGeneral + 0x2c) >>> 0, dwLeaderGuid)
          m.setU32((pAiGeneral + 0x30) >>> 0, 1)
          m.setU32((pAiGeneral + 0x28) >>> 0, pGame >>> 0)
        }
        AIGENERAL_LinkMinionToLeader113c(m, pLeader >>> 0, pMinion, pGame >>> 0)
      }
      rem = (rem - 1) | 0
    }
  }
  return bSpawnedAny
}

/**
 * [27/45] Picks a random spawnable monster from `Levels.txt` (`bNumMon` / `wMon[]`) for `pRoom` and spawns it within radius `5`.
 *
 * @va D2Game:0x6FD0F6B0
 */
export function MONSTER_SpawnRandomLevelMonAtCoords_6FD0F6B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  x: number,
  y: number,
): number {
  hitD2GameVa113c(0x6FD0F6B0)
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom >>> 0)
  const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, nLevelId) >>> 0
  const bNumMon0 = m.u8((pLevelsTxt + 0x33) >>> 0)
  if (bNumMon0 === 0) throw new D2CommonAssertError('RegPop.cpp', 0x4f0)

  const pSeed = pRoom !== 0 ? ((pRoom + 0x6c) >>> 0) : 0
  let idx = SEED_RollLimitedFast113c(m, pSeed, bNumMon0) | 0
  const nNumMon = m.u8((pLevelsTxt + 0x33) >>> 0) | 0
  let tries = 0
  if (nNumMon <= 0) return 0

  const bMask0 = m.u8(m.u32(0x6fd18be0) >>> 0) & 0xff
  let nChosenMonId = -1
  while (true) {
    idx = (idx + 1) | 0
    if (idx >= nNumMon) idx = 0
    const wMon = (m.u16((pLevelsTxt + 0x36 + idx * 2) >>> 0) << 16) >> 16
    nChosenMonId = wMon
    let pMonStats = 0
    if (wMon >= 0) {
      const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
      if (wMon < (m.u32((pDataTables + 0xa80) >>> 0) | 0)) {
        pMonStats = (m.u32((pDataTables + 0xa78) >>> 0) + imul32(wMon, 0x1a8)) >>> 0
      }
    }
    if ((m.u8((pMonStats + 0x0c) >>> 0) & bMask0) !== 0) break
    tries = (tries + 1) | 0
    if (tries >= nNumMon) break
  }
  if (nChosenMonId === -1) return 0
  if (tries >= nNumMon) throw new D2CommonAssertError('RegPop.cpp', 0x507)

  const pSpawned = MONSTER_SpawnAtCoords113c(
    m,
    nChosenMonId,
    1,
    pGame >>> 0,
    pRoom >>> 0,
    x | 0,
    y | 0,
    5,
    0,
  ) >>> 0
  return pSpawned !== 0 ? 1 : 0
}

/**
 * [28/45] Spawns `nCount` (`eax`) minions at `(nX, nY)` in `pLeader`'s room and links each to `pLeader` (`esi = pGame`).
 *
 * @va D2Game:0x6FD0F7D0
 */
export function MONSTER_SpawnMinionPackAtCoords_6FD0F7D0_113c(
  m: D2KernMemory113c,
  nCount: number,
  pGame: number,
  pLeader: number,
  nX: number,
  nY: number,
  nClassId: number,
  nMode: number,
  nMaxRadius: number,
  wFlags: number,
): number {
  hitD2GameVa113c(0x6FD0F7D0)
  if (pLeader === 0) return 0
  const pRoom = UNITS_GetRoom113c(m, pLeader >>> 0) >>> 0
  const dwLeaderGuid = m.u32((pLeader + 0x0c) >>> 0) >>> 0
  let bSpawnedAny = 0
  let rem = nCount | 0
  if (rem > 0) {
    const sp = k2W5B9StackPtr
    k2W5B9StackPtr = (sp + 0x30) >>> 0
    try {
      while (rem !== 0) {
        m.fill(sp, 0x28, 0)
        m.setU32(sp, pGame >>> 0)
        m.setU32((sp + 0x04) >>> 0, pRoom)
        m.setU32((sp + 0x0c) >>> 0, nClassId >>> 0)
        m.setU32((sp + 0x10) >>> 0, nMode >>> 0)
        m.setU32((sp + 0x18) >>> 0, nX >>> 0)
        m.setU32((sp + 0x1c) >>> 0, nY >>> 0)
        m.setU32((sp + 0x20) >>> 0, nMaxRadius >>> 0)
        m.setU16((sp + 0x24) >>> 0, wFlags & 0xffff)
        const pMinion = MONSTER_Create113c(m, sp) >>> 0
        if (pMinion !== 0) {
          bSpawnedAny = 1
          if ((m.u32(pMinion) | 0) === 1) {
            const pMonData = m.u32((pMinion + 0x14) >>> 0) >>> 0
            const pAiGeneral = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
            m.setU32((pAiGeneral + 0x2c) >>> 0, dwLeaderGuid)
            m.setU32((pAiGeneral + 0x30) >>> 0, 1)
            m.setU32((pAiGeneral + 0x28) >>> 0, pGame >>> 0)
          }
          AIGENERAL_LinkMinionToLeader113c(m, pLeader >>> 0, pMinion, pGame >>> 0)
        }
        rem = (rem - 1) | 0
      }
    } finally {
      k2W5B9StackPtr = sp
    }
  }
  return bSpawnedAny
}

/**
 * [29/45] Spawns a self-owned leader monster via `MONSTER_Create113c` and sets `pAiGeneral` owner flags (`0x01 | (bFlag2 ? 0x02 : 0)`).
 *
 * @va D2Game:0x6FD0F8B0
 */
export function MONSTER_SpawnSelfOwnedLeader_6FD0F8B0_113c(
  m: D2KernMemory113c,
  nClassId: number,
  nMode: number,
  pRoom: number,
  pGame: number,
  nX: number,
  nY: number,
  nMaxRadius: number,
  bSetAiFlag02: number,
  wFlags: number,
): number {
  hitD2GameVa113c(0x6FD0F8B0)
  const sp = k2W5B9StackPtr
  k2W5B9StackPtr = (sp + 0x30) >>> 0
  let pMon = 0
  try {
    m.fill(sp, 0x28, 0)
    m.setU32(sp, pGame >>> 0)
    m.setU32((sp + 0x04) >>> 0, pRoom >>> 0)
    m.setU32((sp + 0x0c) >>> 0, nClassId >>> 0)
    m.setU32((sp + 0x10) >>> 0, nMode >>> 0)
    m.setU32((sp + 0x18) >>> 0, nX >>> 0)
    m.setU32((sp + 0x1c) >>> 0, nY >>> 0)
    m.setU32((sp + 0x20) >>> 0, nMaxRadius >>> 0)
    m.setU16((sp + 0x24) >>> 0, wFlags & 0xffff)
    pMon = MONSTER_Create113c(m, sp) >>> 0
  } finally {
    k2W5B9StackPtr = sp
  }
  if (pMon !== 0) {
    const dwGuid = m.u32((pMon + 0x0c) >>> 0) >>> 0
    if ((m.u32(pMon) | 0) === 1) {
      const pMonData = m.u32((pMon + 0x14) >>> 0) >>> 0
      const pAiGeneral = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
      if (bSetAiFlag02 !== 0) {
        m.setU8((pAiGeneral + 0x08) >>> 0, (m.u8((pAiGeneral + 0x08) >>> 0) | 0x02) & 0xff)
      }
      m.setU8((pAiGeneral + 0x08) >>> 0, (m.u8((pAiGeneral + 0x08) >>> 0) | 0x01) & 0xff)
      m.setU32((pAiGeneral + 0x2c) >>> 0, dwGuid)
      m.setU32((pAiGeneral + 0x30) >>> 0, 1)
      m.setU32((pAiGeneral + 0x28) >>> 0, pGame >>> 0)
    }
  }
  return pMon
}

/**
 * [30/45] Clears and unlinks all nodes in `pGame->pSubPartyBuckets[pUnit->dwGroupIdx]` (`+0x10F8`), resetting `dwGroupIdx` (`+0xD0`) to `0x0B`.
 *
 * @va D2Game:0x6FD0FD40
 */
export function SUBPARTY_ClearUnitBucketList_6FD0FD40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FD0FD40)
  if (pGame === 0 || pUnit === 0) return
  const nType = m.u32(pUnit >>> 0) | 0
  if (nType !== 0 && nType !== 1) return
  const nBucket = m.u32((pUnit + 0xd0) >>> 0) | 0
  if (nBucket === 0x0b) return
  let pNode = m.u32((pGame + nBucket * 4 + 0x10f8) >>> 0) >>> 0
  while (pNode !== 0) {
    const pNodeUnit = m.u32(pNode) >>> 0
    const pNext = m.u32((pNode + 0x08) >>> 0) >>> 0
    if (pNodeUnit !== 0) {
      m.setU32((pNodeUnit + 0xd0) >>> 0, 0x0b)
    }
    m.u32((pGame + 0x1c) >>> 0)
    pNode = pNext
  }
  m.setU32((pGame + nBucket * 4 + 0x10f8) >>> 0, 0)
}

/**
 * [31/45] Prepends `(pUnit, dwArg4)` onto `pGame->pSubPartyBuckets[nBucket]` (`nBucket` in `8..9`, `esi = pGame`, `ebx = nBucket`).
 *
 * @va D2Game:0x6FD0FDB0
 */
export function SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c(
  m: D2KernMemory113c,
  pGame: number,
  nBucket: number,
  pUnit: number,
  dwArg4: number,
): void {
  hitD2GameVa113c(0x6FD0FDB0)
  if (pGame === 0 || pUnit === 0) return
  if ((m.u32((pUnit + 0xd0) >>> 0) | 0) !== 0x0b) return
  const b = nBucket | 0
  if (b < 8 || b >= 0x0a) return
  const nType = m.u32(pUnit >>> 0) | 0
  if (nType !== 0 && nType !== 1) return

  m.u32((pGame + 0x1c) >>> 0)
  const pHead = m.u32((pGame + b * 4 + 0x10f8) >>> 0) >>> 0
  const pNew = m.alloc(0x10) >>> 0
  if (pNew !== 0) {
    m.setU32(pNew, pUnit >>> 0)
    m.setU32((pNew + 0x04) >>> 0, dwArg4 >>> 0)
    m.setU32((pNew + 0x08) >>> 0, 0)
    m.setU32((pNew + 0x0c) >>> 0, 0)
    m.setU32((pGame + b * 4 + 0x10f8) >>> 0, pNew)
    if (pHead !== 0) {
      m.setU32((pNew + 0x08) >>> 0, pHead)
      m.setU32((pHead + 0x0c) >>> 0, pNew)
    }
    m.setU32((pUnit + 0xd0) >>> 0, b >>> 0)
  }
}

/**
 * [32/45] Inserts `(pUnit, dwArg4)` right after the non-empty head of `pGame->pSubPartyBuckets[nBucket]` (`nBucket < 8`).
 *
 * @va D2Game:0x6FD0FE40
 */
export function SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nBucket: number,
  dwArg4: number,
): void {
  hitD2GameVa113c(0x6FD0FE40)
  if (pGame === 0 || pUnit === 0) return
  if ((m.u32((pUnit + 0xd0) >>> 0) | 0) !== 0x0b) return
  const b = nBucket | 0
  if (b >= 8) return
  const nType = m.u32(pUnit >>> 0) | 0
  if (nType !== 0 && nType !== 1) return

  const pHead = m.u32((pGame + b * 4 + 0x10f8) >>> 0) >>> 0
  if (pHead === 0 || m.u32(pHead) === 0) return
  m.u32((pGame + 0x1c) >>> 0)
  const pNew = m.alloc(0x10) >>> 0
  if (pNew !== 0) {
    m.setU32(pNew, pUnit >>> 0)
    m.setU32((pNew + 0x04) >>> 0, dwArg4 >>> 0)
    const pOldNext = m.u32((pHead + 0x08) >>> 0) >>> 0
    m.setU32((pNew + 0x08) >>> 0, pOldNext)
    m.setU32((pNew + 0x0c) >>> 0, pHead)
    const pOldNext2 = m.u32((pHead + 0x08) >>> 0) >>> 0
    if (pOldNext2 !== 0) {
      m.setU32((pOldNext2 + 0x0c) >>> 0, pNew)
    }
    m.setU32((pHead + 0x08) >>> 0, pNew)
    m.setU32((pUnit + 0xd0) >>> 0, b >>> 0)
  }
}

/**
 * [33/45] Allocates the first free bucket `0..7` in `pGame->pSubPartyBuckets` (`+0x10F8`) for `pPlayerUnit` (`ebx`).
 *
 * @va D2Game:0x6FD0FED0
 */
export function SUBPARTY_CreatePlayerBucketHead_6FD0FED0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  dwArg4: number,
): void {
  hitD2GameVa113c(0x6FD0FED0)
  if (pGame === 0 || pPlayerUnit === 0) return
  if ((m.u32(pPlayerUnit >>> 0) | 0) !== 0) return
  if ((m.u32((pPlayerUnit + 0xd0) >>> 0) | 0) !== 0x0b) return

  let slot = 0
  while (slot < 8) {
    if (m.u32((pGame + 0x10f8 + slot * 4) >>> 0) === 0) break
    slot = (slot + 1) | 0
  }
  if ((m.u32((pGame + 0x8c) >>> 0) | 0) > 8) return
  if (slot >= 8) return

  m.u32((pGame + 0x1c) >>> 0)
  const pNew = m.alloc(0x10) >>> 0
  if (pNew !== 0) {
    m.setU32(pNew, pPlayerUnit >>> 0)
    m.setU32((pNew + 0x04) >>> 0, dwArg4 >>> 0)
    m.setU32((pNew + 0x08) >>> 0, 0)
    m.setU32((pNew + 0x0c) >>> 0, 0)
    m.setU32((pGame + 0x10f8 + slot * 4) >>> 0, pNew)
    m.setU32((pPlayerUnit + 0xd0) >>> 0, slot >>> 0)
  }
}

/**
 * [34/45] Living-player callback wrapper forwarding `(pTargetUnit = [esp+4], pOwnerUnit = edx, pGame = ecx)`
 * to `PLAYERLIST_RemoveRelationNode_6FD0FFD0_113c`.
 *
 * @va D2Game:0x6FD10040
 */
export function PLAYERLIST_RemoveRelationNodeCallback_6FD10040_113c(
  m: D2KernMemory113c,
  pGame: number,
  pOwnerUnit: number,
  pTargetUnit: number,
): void {
  hitD2GameVa113c(0x6FD10040)
  PLAYERLIST_RemoveRelationNode_6FD0FFD0_113c(
    m,
    pTargetUnit >>> 0,
    pOwnerUnit >>> 0,
    pGame >>> 0,
  )
}

/**
 * [35/45] Refreshes relation nodes with state `2` on `pPlayerUnit` to `1` (if target is in a party) or `0`,
 * sending packet `0x8B` for each updated node.
 *
 * @va D2Game:0x6FD103E0
 */
export function PARTY_RefreshInviteRelationNodes_6FD103E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
): void {
  hitD2GameVa113c(0x6FD103E0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit >>> 0) >>> 0
  let pNode = m.u32((pPlayerData + 0x38) >>> 0) >>> 0
  while (pNode !== 0) {
    if ((m.u32((pNode + 0x0c) >>> 0) | 0) === 2) {
      const dwTargetGuid = m.u32(pNode) >>> 0
      if (pGame === 0) throw new D2CommonAssertError('PlayerList.cpp', 0x2d3)
      let pOther = m.u32((pGame + ((dwTargetGuid & 0x7f) << 2) + 0x1120) >>> 0) >>> 0
      while (pOther !== 0 && (m.u32((pOther + 0x0c) >>> 0) >>> 0) !== dwTargetGuid) {
        pOther = m.u32((pOther + 0xe4) >>> 0) >>> 0
      }
      if (pOther !== 0) {
        const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, pOther, pGame >>> 0) & 0xffff
        const dwNewState = wPartyId !== 0xffff ? 1 : 0
        m.setU32((pNode + 0x0c) >>> 0, dwNewState)
        D2GAME_PARTY_Send0x8BPartyRelationStatus113c(m, pOther, pPlayerUnit >>> 0)
      }
    }
    pNode = m.u32((pNode + 0x10) >>> 0) >>> 0
  }
}

/**
 * [36/45] Broadcasts 11-byte packet `0x8C` (`wRelationFlags` between `pPlayerUnit1` and `pPlayerUnit2`) to all living players.
 *
 * @va D2Game:0x6FD105B0
 */
export function PARTY_BroadcastPacket8CRelationFlags_6FD105B0_113c(
  m: D2KernMemory113c,
  pPlayerUnit2: number,
  pPlayerUnit1: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FD105B0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit1 >>> 0) >>> 0
  const dwGuid2Init = pPlayerUnit2 !== 0 ? m.u32((pPlayerUnit2 + 0x0c) >>> 0) : 0xffffffff
  if ((pPlayerUnit1 >>> 0) === (pPlayerUnit2 >>> 0)) return
  let pNode = m.u32((pPlayerData + 0x38) >>> 0) >>> 0
  if (pNode === 0) return
  while ((m.u32(pNode) >>> 0) !== (dwGuid2Init >>> 0)) {
    pNode = m.u32((pNode + 0x10) >>> 0) >>> 0
    if (pNode === 0) return
  }

  const dwTargetGuid = pPlayerUnit2 !== 0 ? m.u32((pPlayerUnit2 + 0x0c) >>> 0) : 0xffffffff
  const dwOwnerGuid = pPlayerUnit1 !== 0 ? m.u32((pPlayerUnit1 + 0x0c) >>> 0) : 0xffffffff
  const wFlags = m.u16((pNode + 0x04) >>> 0)

  const sp = k2W5B9StackPtr
  k2W5B9StackPtr = (sp + 0x10) >>> 0
  try {
    m.fill(sp, 0x0c, 0)
    m.setU8(sp, 0x8c)
    m.setU32((sp + 0x01) >>> 0, dwOwnerGuid >>> 0)
    m.setU32((sp + 0x05) >>> 0, dwTargetGuid >>> 0)
    m.setU16((sp + 0x09) >>> 0, wFlags & 0xffff)
    D2GAME_SUNIT_IterateAllLivingPlayers113c(
      m,
      pGame >>> 0,
      (mem, _g, pRecipient, pPkt) => {
        S2C_Send11BytePacketToPlayerUnit_6FCAC690_113c(mem, pRecipient, pPkt)
      },
      sp,
    )
  } finally {
    k2W5B9StackPtr = sp
  }
}

/**
 * [37/45] Sets or clears `dwFlagMask` (`eax`) on `pPlayerUnit1`'s (`ecx`) relation node for `pPlayerUnit2` (`esi`) and broadcasts `0x8C`.
 *
 * @va D2Game:0x6FD10640
 */
export function PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c(
  m: D2KernMemory113c,
  dwFlagMask: number,
  pPlayerUnit1: number,
  pPlayerUnit2: number,
  pGame: number,
  bSet: number,
): void {
  hitD2GameVa113c(0x6FD10640)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit1 >>> 0) >>> 0
  const dwGuid2Init = pPlayerUnit2 !== 0 ? m.u32((pPlayerUnit2 + 0x0c) >>> 0) : 0xffffffff
  let pNode = 0
  if ((pPlayerUnit1 >>> 0) !== (pPlayerUnit2 >>> 0)) {
    let cur = m.u32((pPlayerData + 0x38) >>> 0) >>> 0
    while (cur !== 0) {
      if ((m.u32(cur) >>> 0) === (dwGuid2Init >>> 0)) {
        pNode = cur
        break
      }
      cur = m.u32((cur + 0x10) >>> 0) >>> 0
    }
  }
  if ((pPlayerUnit1 >>> 0) === (pPlayerUnit2 >>> 0) || pNode === 0) return

  const oldFlags = m.u32((pNode + 0x04) >>> 0)
  const newFlags = bSet !== 0 ? ((oldFlags | dwFlagMask) >>> 0) : ((oldFlags & (~dwFlagMask)) >>> 0)
  m.setU32((pNode + 0x04) >>> 0, newFlags)

  const dwTargetGuid = pPlayerUnit2 !== 0 ? m.u32((pPlayerUnit2 + 0x0c) >>> 0) : 0xffffffff
  const dwOwnerGuid = pPlayerUnit1 !== 0 ? m.u32((pPlayerUnit1 + 0x0c) >>> 0) : 0xffffffff
  const wFlags = m.u16((pNode + 0x04) >>> 0)

  const sp = k2W5B9StackPtr
  k2W5B9StackPtr = (sp + 0x10) >>> 0
  try {
    m.fill(sp, 0x0c, 0)
    m.setU8(sp, 0x8c)
    m.setU32((sp + 0x01) >>> 0, dwOwnerGuid >>> 0)
    m.setU32((sp + 0x05) >>> 0, dwTargetGuid >>> 0)
    m.setU16((sp + 0x09) >>> 0, wFlags & 0xffff)
    D2GAME_SUNIT_IterateAllLivingPlayers113c(
      m,
      pGame >>> 0,
      (mem, _g, pRecipient, pPkt) => {
        S2C_Send11BytePacketToPlayerUnit_6FCAC690_113c(mem, pRecipient, pPkt)
      },
      sp,
    )
  } finally {
    k2W5B9StackPtr = sp
  }
}

/**
 * [38/45] Builds and queues 40-byte party/relation event packet `0x5A` (`eEvent = 7`) for `bAction` (`1..11`) to `pClient`.
 *
 * @va D2Game:0x6FD10720
 */
export function NET_SendPacket5A_PartyRelationEvent_6FD10720_113c(
  m: D2KernMemory113c,
  dwParam: number,
  pClient: number,
  bAction: number,
): number {
  hitD2GameVa113c(0x6FD10720)
  const sp = k2W5B9StackPtr
  k2W5B9StackPtr = (sp + 0x30) >>> 0
  try {
    m.fill(sp, 0x28, 0)
    const act = bAction & 0xff
    m.setU8((sp + 0x07) >>> 0, act)
    m.setU8(sp, 0x5a)
    m.setU8((sp + 0x01) >>> 0, 0x07)
    m.setU8((sp + 0x02) >>> 0, 0x03)
    m.setU32((sp + 0x03) >>> 0, dwParam >>> 0)

    switch (act) {
      case 1:
      case 2:
        m.setU8((sp + 0x02) >>> 0, 0x04)
        break
      case 3:
        m.setU8((sp + 0x02) >>> 0, 0x08)
        break
      case 4:
        m.setU8((sp + 0x02) >>> 0, 0x00)
        break
      case 5:
      case 7:
      case 8:
        m.setU8((sp + 0x02) >>> 0, 0x02)
        break
      case 6:
      case 9:
      case 10:
      case 11:
        m.setU8((sp + 0x02) >>> 0, 0x09)
        break
      default:
        break
    }
    return NET_SendFixed40BytePacketToClient113c(m, pClient >>> 0, sp)
  } finally {
    k2W5B9StackPtr = sp
  }
}

/**
 * [39/45] Synchronizes mutual party relation states between `pUnit1` (`ebx`) and `pUnit2` (`[esp+4]`).
 *
 * @va D2Game:0x6FD109E0
 */
export function PARTY_SyncMutualRelationState_6FD109E0_113c(
  m: D2KernMemory113c,
  pUnit1: number,
  pUnit2: number,
): void {
  hitD2GameVa113c(0x6FD109E0)
  const guid1 = pUnit1 !== 0 ? m.u32((pUnit1 + 0x0c) >>> 0) : 0xffffffff
  const guid2 = pUnit2 !== 0 ? m.u32((pUnit2 + 0x0c) >>> 0) : 0xffffffff
  if ((guid1 >>> 0) === (guid2 >>> 0)) return

  let inParty = false
  if (pUnit1 !== 0) {
    const pGame = m.u32((pUnit1 + 0x80) >>> 0) >>> 0
    if (pGame !== 0 && (m.u32(pUnit1 >>> 0) | 0) === 0) {
      if ((D2GAME_PARTY_GetPartyIdForUnit113c(m, pUnit1 >>> 0, pGame) & 0xffff) !== 0xffff) {
        inParty = true
      }
    }
  }

  if (inParty) {
    D2GAME_PARTY_SetPlayerRelationState113c(m, pUnit2 >>> 0, pUnit1 >>> 0, 1)
    D2GAME_PARTY_SetPlayerRelationState113c(m, pUnit1 >>> 0, pUnit2 >>> 0, 1)
    return
  }

  const wRel = PARTY_GetPlayerRelationState113c(m, pUnit2 >>> 0, pUnit1 >>> 0) & 0xffff
  if (wRel === 4) {
    D2GAME_PARTY_SetPlayerRelationState113c(m, pUnit1 >>> 0, pUnit2 >>> 0, 2)
    return
  }
  D2GAME_PARTY_SetPlayerRelationState113c(m, pUnit2 >>> 0, pUnit1 >>> 0, 0)
  D2GAME_PARTY_SetPlayerRelationState113c(m, pUnit1 >>> 0, pUnit2 >>> 0, 1)
}

/**
 * [40/45] Dispatches party/hostility command `nActionIdx` (`ebx`, table `0x6FD1A3B0`) against target `dwTargetGuid` (`eax`) in `pGame` (`edi`).
 *
 * @va D2Game:0x6FD10A70
 */
// Exact 10-entry `D2Game.dll` `.rdata` table at `0x6FD1A3B0..0x6FD1A3D7` (party relation action handlers).
const DEFAULT_PARTY_ACTION_TABLE_6FD1A3B0: readonly number[] = [
  0,
  0x6fd10f40,
  0x6fd10ee0,
  0x6fd10e80,
  0x6fd11130,
  0,
  0x6fd10870,
  0x6fd10900,
  0x6fd10d50,
  0x6fd110f0,
]

export function PARTY_DispatchRelationAction_6FD10A70_113c(
  m: D2KernMemory113c,
  dwTargetGuid: number,
  nActionIdx: number,
  pGame: number,
  pSourcePlayer: number,
  dwExtraArg: number,
  onDispatchAction?: (
    m: D2KernMemory113c,
    pfnHandler: number,
    pGame: number,
    pSourcePlayer: number,
    pTargetPlayer: number,
    dwExtraArg: number,
    pOutError: number,
  ) => void,
  isBadCodePtr?: (pfn: number) => number,
): number {
  hitD2GameVa113c(0x6FD10A70)
  if (pGame === 0) throw new D2CommonAssertError('PlayerList.cpp', 0x2d3)
  let pTarget = m.u32((pGame + ((dwTargetGuid & 0x7f) << 2) + 0x1120) >>> 0) >>> 0
  while (pTarget !== 0 && (m.u32((pTarget + 0x0c) >>> 0) >>> 0) !== (dwTargetGuid >>> 0)) {
    pTarget = m.u32((pTarget + 0xe4) >>> 0) >>> 0
  }
  if (pTarget === 0) return 0

  const idx = nActionIdx | 0
  let pfnHandler = 0
  try {
    pfnHandler = m.u32((0x6fd1a3b0 + imul32(idx, 4)) >>> 0) >>> 0
  } catch {
    pfnHandler = 0
  }
  if (pfnHandler === 0 && idx >= 0 && idx < DEFAULT_PARTY_ACTION_TABLE_6FD1A3B0.length) {
    pfnHandler = DEFAULT_PARTY_ACTION_TABLE_6FD1A3B0[idx]! >>> 0
  }
  if (pfnHandler === 0) return 0
  const badPtr =
    isBadCodePtr !== undefined
      ? isBadCodePtr(pfnHandler) | 0
      : pfnHandler < 0x6fc21000 || pfnHandler >= 0x6fd18000
        ? 1
        : 0
  if (badPtr !== 0) return 3

  const sp = k2W5B9StackPtr
  k2W5B9StackPtr = (sp + 8) >>> 0
  try {
    m.setU32(sp, 0)
    if (onDispatchAction !== undefined) {
      onDispatchAction(m, pfnHandler, pGame >>> 0, pSourcePlayer >>> 0, pTarget, dwExtraArg >>> 0, sp)
    }
    return m.u32(sp) !== 0 ? 3 : 0
  } finally {
    k2W5B9StackPtr = sp
  }
}

/**
 * [41/45] Living-player callback initializing party relation states and sending bidirectional `0x75` roster updates on join.
 *
 * @va D2Game:0x6FD10B10
 */
export function PARTY_InitPlayerRelationOnJoinCallback_6FD10B10_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pExistingPlayer: number,
  pJoiningPlayer: number,
): void {
  hitD2GameVa113c(0x6FD10B10)
  if ((pExistingPlayer >>> 0) === (pJoiningPlayer >>> 0)) {
    D2GAME_PARTY_SetPlayerRelationState113c(m, pExistingPlayer >>> 0, pExistingPlayer >>> 0, 1)
    NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c(m, pExistingPlayer >>> 0, pExistingPlayer >>> 0)
    return
  }

  D2GAME_PARTY_SetPlayerRelationState113c(m, pExistingPlayer >>> 0, pJoiningPlayer >>> 0, 0)
  let dwRelToExisting = 0
  if (pExistingPlayer !== 0) {
    const pGame = m.u32((pExistingPlayer + 0x80) >>> 0) >>> 0
    if (pGame !== 0 && (m.u32(pExistingPlayer >>> 0) | 0) === 0) {
      if ((D2GAME_PARTY_GetPartyIdForUnit113c(m, pExistingPlayer >>> 0, pGame) & 0xffff) !== 0xffff) {
        dwRelToExisting = 1
      }
    }
  }
  D2GAME_PARTY_SetPlayerRelationState113c(m, pJoiningPlayer >>> 0, pExistingPlayer >>> 0, dwRelToExisting)
  NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c(m, pJoiningPlayer >>> 0, pExistingPlayer >>> 0)
  NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c(m, pExistingPlayer >>> 0, pJoiningPlayer >>> 0)
}

/**
 * [42/45] Rolls up to `10` random `(x + [0..39] - 20, y + [0..39] - 20)` target coordinates using `pUnit->pSeed` (`+0x20`),
 * setting `pUnit->pDynamicPath` target pos on the first unblocked coordinate.
 *
 * @va D2Game:0x6FD112C0
 */
export function SKILLS_RollRandomUnblockedTargetPos_6FD112C0_113c(
  m: D2KernMemory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FD112C0)
  const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  if (pRoom === 0) return 0

  const nTypeX = m.u32(pUnit >>> 0) | 0
  let baseX = 0
  if (nTypeX === 2 || (nTypeX > 3 && nTypeX <= 5)) {
    baseX = m.u32((m.u32((pUnit + 0x2c) >>> 0) + 0x0c) >>> 0) | 0
  } else {
    const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    baseX = pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
  }

  const nTypeY = m.u32(pUnit >>> 0) | 0
  let baseY = 0
  if (nTypeY === 2 || (nTypeY > 3 && nTypeY <= 5)) {
    baseY = m.u32((m.u32((pUnit + 0x2c) >>> 0) + 0x10) >>> 0) | 0
  } else {
    const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    baseY = pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0
  }

  const pSeed = (pUnit + 0x20) >>> 0
  if (pSeed === 0) return 0

  const nPattern = PATH_GetUnitCollisionPattern113c(m, pUnit >>> 0)
  const wMask = PATH_GetFootprintCollisionMask113c(m, m.u32((pUnit + 0x2c) >>> 0))

  for (let attempt = 0; attempt < 10; attempt = (attempt + 1) | 0) {
    const lo1 = m.u32(pSeed) >>> 0
    const hi1 = m.u32((pSeed + 0x04) >>> 0) >>> 0
    const prod1 = BigInt(lo1) * 0x6ac690c5n + BigInt(hi1)
    const newLo1 = Number(prod1 & 0xffffffffn) >>> 0
    const newHi1 = Number((prod1 >> 32n) & 0xffffffffn) >>> 0
    const remX = (newLo1 % 0x28) >>> 0
    m.setU32(pSeed, newLo1)
    const candX = (baseX + remX - 0x14) | 0

    const prod2 = BigInt(newLo1) * 0x6ac690c5n + BigInt(newHi1)
    const newLo2 = Number(prod2 & 0xffffffffn) >>> 0
    const newHi2 = Number((prod2 >> 32n) & 0xffffffffn) >>> 0
    m.setU32((pSeed + 0x04) >>> 0, newHi2)
    m.setU32(pSeed, newLo2)
    const remY = (newLo2 % 0x28) >>> 0
    const candY = (baseY + remY - 0x14) | 0

    if ((COLLISION_GetMaskWithPattern2_113c(m, pRoom, candX, candY, nPattern, wMask) & 0xffff) === 0) {
      PATH_SetTargetPos113c(m, m.u32((pUnit + 0x2c) >>> 0), candX, candY)
      return 1
    }
  }
  return 0
}

/**
 * [43/45] Resolves triggered-skill attacker target (`ItemTarget == 4`): keeps an existing non-self path target,
 * or falls back to `SUNIT_GetLastAttacker113c` (`eax = pGame`, `esi = pCasterUnit`, `ebx = pOutTargetType`).
 *
 * @va D2Game:0x6FD11420
 */
export function SKILLS_ResolveTriggeredAttackerTarget_6FD11420_113c(
  m: D2KernMemory113c,
  pGame: number,
  pCasterUnit: number,
  pOutTargetType: number,
  pOutTargetGuid: number,
): number {
  hitD2GameVa113c(0x6FD11420)
  SUNIT_ValidatePathTargetUnit113c(m, pCasterUnit >>> 0, pGame >>> 0)
  const pCurTarget = PATH_GetTargetUnit113c(m, m.u32((pCasterUnit + 0x2c) >>> 0)) >>> 0
  if (pCurTarget !== (pCasterUnit >>> 0) && pCurTarget !== 0) {
    return 1
  }

  const pAttacker = SUNIT_GetLastAttacker113c(m, pGame >>> 0, pCasterUnit >>> 0) >>> 0
  UNITS_SetTargetUnitForDynamicUnit113c(m, pCasterUnit >>> 0, pAttacker)
  if (pOutTargetType !== 0) {
    const dwType = pAttacker === 0 ? 6 : m.u32(pAttacker)
    m.setU32(pOutTargetType >>> 0, dwType >>> 0)
    const dwGuid = pAttacker === 0 ? 0xffffffff : m.u32((pAttacker + 0x0c) >>> 0)
    m.setU32(pOutTargetGuid >>> 0, dwGuid >>> 0)
  }
  return 1
}

/**
 * [44/45] Resolves triggered-skill corpse target (`ItemTarget == 3`) within radius `10` (`ecx = pGame`, `esi = pCasterUnit`, `ebx = pOutTargetType`).
 *
 * @va D2Game:0x6FD11490
 */
export function SKILLS_ResolveTriggeredCorpseTarget_6FD11490_113c(
  m: D2KernMemory113c,
  pGame: number,
  pCasterUnit: number,
  pOutTargetType: number,
  _unusedArg1: number,
  nSkillLevel: number,
  pOutTargetGuid: number,
): number {
  hitD2GameVa113c(0x6FD11490)
  SUNIT_ValidatePathTargetUnit113c(m, pCasterUnit >>> 0, pGame >>> 0)
  let pCenter = PATH_GetTargetUnit113c(m, m.u32((pCasterUnit + 0x2c) >>> 0)) >>> 0
  if (pCenter === (pCasterUnit >>> 0)) {
    pCenter = 0
  }
  const pCorpse = SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c(m, pCenter, pCasterUnit >>> 0, nSkillLevel) >>> 0
  if (pCorpse === 0) return 0

  UNITS_SetTargetUnitForDynamicUnit113c(m, pCasterUnit >>> 0, pCorpse)
  if (pOutTargetType !== 0) {
    m.setU32(pOutTargetType >>> 0, m.u32(pCorpse))
    m.setU32(pOutTargetGuid >>> 0, m.u32((pCorpse + 0x0c) >>> 0))
  }
  return 1
}

/**
 * [45/45] Casts a coordinate-targeted triggered skill (`eax = pCasterUnit`, `ebx = nY`, blocked by state `0x36`)
 * and queues `0x9A` sync message.
 *
 * @va D2Game:0x6FD11730
 */
export function SKILLS_CastTriggeredCoordSkillAndQueue9A_6FD11730_113c(
  m: D2KernMemory113c,
  pCasterUnit: number,
  nY: number,
  nSkillId: number,
  nSkillLevel: number,
  nX: number,
  bConsumeMana: number,
): number {
  hitD2GameVa113c(0x6FD11730)
  if (pCasterUnit === 0) return 0
  const pGame = m.u32((pCasterUnit + 0x80) >>> 0) >>> 0
  if (pGame === 0) return 0
  if ((STATES_CheckState113c(m, pCasterUnit >>> 0, 0x36) | 0) !== 0) return 0

  const sp = k2W5B9StackPtr
  const pOutTargetType = sp
  const pOutTargetId = (sp + 0x04) >>> 0
  const pOutX = (sp + 0x08) >>> 0
  const pOutY = (sp + 0x0c) >>> 0
  k2W5B9StackPtr = (sp + 0x10) >>> 0
  try {
    m.fill(sp, 0x10, 0)
    const ok = SKILLS_CastTriggeredSkillCore113c(
      m,
      0,
      pCasterUnit >>> 0,
      pGame,
      nSkillId,
      nSkillLevel,
      nX,
      nY,
      pOutTargetType,
      pOutTargetId,
      pOutX,
      pOutY,
      bConsumeMana,
    ) | 0
    if (ok === 0) return 0

    let finalX = m.u32(pOutX) | 0
    let finalY = 0
    if (finalX === 0) {
      finalX = nX | 0
      finalY = nY | 0
    } else {
      finalY = m.u32(pOutY) | 0
    }
    UNITMSG_QueuePacket9ACoords_6FC9A440_113c(
      m,
      pCasterUnit >>> 0,
      nSkillId,
      nSkillLevel,
      finalX,
      finalY,
      bConsumeMana,
    )
    return 1
  } finally {
    k2W5B9StackPtr = sp
  }
}
