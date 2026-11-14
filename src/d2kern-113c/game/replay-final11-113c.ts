/**
 * Diablo II v1.13c Pure Kernel Final 11 D2Game.dll Functions for `a1-town-walk` and `a1c-bloodmoor-fallen`.
 *
 * Implements the remaining 11 executed `D2Game.dll` functions (2,308 bytes total) 1:1 on `Memory113c`
 * (`SparseMemory113c`) with zero legacy module imports, zero array sorting, and zero `??`.
 */
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c, DRLG_GetLevelDefField94_113c } from '../common/drlg/drlg.ts'
import { STATLIST_EnumerateCopyListStats113c } from '../common/drlg/preset.ts'
import {
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomExFromRoom113c,
  DUNGEON_GetRoomPortalList113c,
} from '../common/dungeon.ts'
import { DUNGEON_CheckRoomIsTownMemPort113c } from '../common/k0-d2common-memports.ts'
import { ITEMS_RemoveFromSocketedOwner113c } from '../common/items.ts'
import {
  PATH_ComputeSquaredDistance113c,
  PATH_FreeDynamicPath113c,
  PATH_GetNumberOfPathPoints113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_Step113c,
} from '../common/path.ts'
import {
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetSkillSlotIndex113c,
} from '../common/skills.ts'
import {
  STATES_CheckState113c,
  STATLIST_AllocList113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
} from '../common/statlist.ts'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_ClearUnitRoom113c,
  UNITROOM_ClearUpdateQueue113c,
  UNITROOM_RefreshUnit113c,
  UNITS_FreeStaticPath113c,
  UNITS_FreeUnit113c,
  UNITS_GetPathRoomRefreshFlag113c,
  UNITS_GetRoom113c,
  UNITS_SetUnitAnimMode113c,
  UNIT_Alloc113c,
} from '../common/unit.ts'
import {
  MONSTER_DestroyMonsterUnit113c,
  NPCS_OnPlayerLevelChange113c,
  OBJECT_DestroyObjectUnit113c,
  QUESTS_FreeUnitQuestChain113c,
  QUESTS_NotifyLevelChange113c,
  SUNIT_ClearUnitInventoryItems113c,
  SUNIT_DeactivateAndRemoveUnit113c,
  SUNIT_GetUnitField78_113c,
  SUNIT_UnlinkFromRoomUpdateList113c,
  UNIT_SaveInactiveUnitNode113c,
} from './a1c-post150-f150-f276-113c.ts'
import {
  CLIENTS_SetPlayerCurrentRoom113c,
  ROOM_DeactivateUnitInRoom113c,
} from './act-rooms-113c.ts'
import { SUNITDMG_FreeAttackerCombatList113c } from './ai-fallen-113c.ts'
import {
  NET_QueuePacketToClientBuffer113c,
  UNIT_FreeEventNotifyList113c,
} from './boot-init-gap-a-113c.ts'
import {
  D2GAME_ARENA_SyncArenaJoinState113c,
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c,
  D2GAME_PLRMODES_SendStatToClientOrParty113c,
  D2GAME_SUNIT_SyncRoomUnitsToClient113c,
} from './boot-init-gap-b-113c.ts'
import { PLAYER_StartModeAttack113c } from './combat-a1c-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import { MONSTER_ClearModeEvents113c, UNITS_ChangeAnimMode113c } from './monster-events.ts'
import { OBJECTS_InitObjectUnit113c } from './objects-populate-113c.ts'
import {
  OBJECTS_SpawnDensityObjectsInRoom113c,
  PLAYER_GetParam158_113c,
  PLAYER_GetParam15C_113c,
  SUNIT_DeactivateUnitStatesAndEvents113c,
  SUNIT_InitUnitAnimData113c,
  SUNIT_InitUnitSeed113c,
  SUNIT_PlaceServerUnitInRoom113c,
  SUNIT_ValidatePathTargetUnit113c,
} from './regpop-spawn-113c.ts'
import { PLAYER_DrainRunStamina113c } from './replay-kernel-113c.ts'
import { EVENT_FreeNode113c, EVENT_RemoveUnitEvents113c } from './timer-wheel.ts'
import {
  PLAYER_StartWalkOrRunMode113c,
  SUNIT_UpdateUnitPositionAndRoom113c,
} from './town-runtime-gap-113c.ts'

export type { SparseMemory113c }

let replayFinal11StackPtr = 0x7ef80000

function setPlayerNeutralOrTownNeutralMode113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nFallbackMode: number,
): void {
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  let mode = nFallbackMode
  if (pRoom !== 0) {
    const bInTown = DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom)
    mode = bInTown !== 0 ? 5 : 1
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  MONSTER_ClearModeEvents113c(m, pGame, pUnit)
  UNITS_ChangeAnimMode113c(m, pUnit, mode)
  SUNIT_InitUnitAnimData113c(m, pUnit)
}

/**
 * Deactivates any server unit (`pUnit`) when its room becomes inactive:
 * - `dwUnitType == 1` (`UNIT_MONSTER`): tail-calls `ROOM_DeactivateUnitInRoom113c` (`0x6FC40760`).
 * - Computes `bSave` from `DRLG_GetLevelDefField94_113c` (`#10929`) or `pUnit->dwFlags & 0x02000000`.
 * - Dispatches on `dwUnitType` (`0..5`) to free `EVENT_MODE_STEP` (`nType == 1`) nodes, save inactive
 *   unit state (`UNIT_SaveInactiveUnitNode113c`), clear room membership (`UNITROOM_ClearUnitRoom113c`),
 *   or free the server unit (`SUNIT_FreeUnit113c`).
 *
 * @va D2Game:0x6FC409B0
 */
export function ROOM_DeactivateAnyUnitInRoom113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
): void {
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  const dwUnitType = m.u32(pUnit >>> 0) >>> 0
  const dwClassId = m.u32((pUnit + 0x04) >>> 0) >>> 0

  if (dwUnitType === 1) {
    ROOM_DeactivateUnitInRoom113c(m, pGame, pUnit)
    return
  }

  let bSave = 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  if (
    DRLG_GetLevelDefField94_113c(m, nLevelId) !== 0 ||
    (m.u32((pUnit + 0xc4) >>> 0) & 0x02000000) !== 0
  ) {
    bSave = 1
  }

  switch (dwUnitType) {
    case 0: {
      if (STATES_CheckState113c(m, pUnit, 7) !== 0) {
        let pEv = m.u32((pUnit + 0xdc) >>> 0) >>> 0
        while (pEv !== 0) {
          const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
          if (m.u8(pEv) === 1) {
            EVENT_FreeNode113c(m, pGame, pEv)
          }
          pEv = pNext
        }
        m.setU32((pUnit + 0xc8) >>> 0, (m.u32((pUnit + 0xc8) >>> 0) | 0x0100) >>> 0)
        UNIT_SaveInactiveUnitNode113c(m, pGame, pUnit)
        UNITROOM_ClearUnitRoom113c(m, pUnit)
        return
      }
      if (bSave !== 0) {
        UNIT_SaveInactiveUnitNode113c(m, pGame, pUnit)
      }
      SUNIT_FreeUnit113c(m, pGame, pUnit)
      return
    }
    case 2: {
      if (dwClassId === 0x3b || dwClassId === 0x3c) {
        let pEv = m.u32((pUnit + 0xdc) >>> 0) >>> 0
        while (pEv !== 0) {
          const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
          if (m.u8(pEv) === 1) {
            EVENT_FreeNode113c(m, pGame, pEv)
          }
          pEv = pNext
        }
        m.setU32((pUnit + 0xc8) >>> 0, (m.u32((pUnit + 0xc8) >>> 0) | 0x0100) >>> 0)
        UNIT_SaveInactiveUnitNode113c(m, pGame, pUnit)
        UNITROOM_ClearUnitRoom113c(m, pUnit)
        return
      }
      const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, dwClassId) >>> 0
      if (
        pObjTxt === 0 ||
        m.u8((pObjTxt + 0x173) >>> 0) === 0 ||
        (SUNIT_GetUnitField78_113c(m, pUnit) & 2) !== 0
      ) {
        bSave = 0
      }
      if (
        pObjTxt !== 0 &&
        m.u8((pObjTxt + 0x174) >>> 0) !== 0 &&
        m.u32((pUnit + 0x10) >>> 0) !== 0
      ) {
        bSave = 0
      }
      let pEv = m.u32((pUnit + 0xdc) >>> 0) >>> 0
      while (pEv !== 0) {
        const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
        if (m.u8(pEv) === 1) {
          EVENT_FreeNode113c(m, pGame, pEv)
        }
        pEv = pNext
      }
      if (bSave !== 0) {
        UNIT_SaveInactiveUnitNode113c(m, pGame, pUnit)
      }
      SUNIT_FreeUnit113c(m, pGame, pUnit)
      return
    }
    case 4: {
      UNIT_SaveInactiveUnitNode113c(m, pGame, pUnit)
      return
    }
    case 5: {
      UNIT_SaveInactiveUnitNode113c(m, pGame, pUnit)
      SUNIT_FreeUnit113c(m, pGame, pUnit)
      return
    }
    default: {
      SUNIT_FreeUnit113c(m, pGame, pUnit)
      return
    }
  }
}

/**
 * Spawns density objects in `pRoom` via `OBJECTS_SpawnDensityObjectsInRoom113c` (`0x6FC52CE0`) and,
 * if an object was spawned, rolls `pGame->pObjectControl->tSeed` (`+0x10F0`) mod `100 > 70` (`0x46`)
 * to place a secondary companion object (`classId = 0x67`) at the same coordinates.
 *
 * @va D2Game:0x6FC53260
 */
export function OBJECTS_SpawnDensityWithSecondaryTorch113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
  nDensity: number,
  nObjectId: number,
  nProb: number,
): number {
  const pObj = OBJECTS_SpawnDensityObjectsInRoom113c(
    m,
    pGame,
    pRoom,
    nDensity,
    nObjectId,
    nProb,
  ) >>> 0
  if (pObj !== 0) {
    const pObjRoom = UNITS_GetRoom113c(m, pObj) >>> 0
    const pObjCtrl = m.u32((pGame + 0x10f0) >>> 0) >>> 0
    if (pObjCtrl !== 0) {
      const lo = m.u32(pObjCtrl) >>> 0
      const hi = m.u32((pObjCtrl + 4) >>> 0) >>> 0
      const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
      const newLo = Number(prod & 0xffffffffn) >>> 0
      const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
      m.setU32(pObjCtrl, newLo)
      m.setU32((pObjCtrl + 4) >>> 0, newHi)
      if ((newLo % 100) > 0x46 && pObjRoom !== 0) {
        const pPath = m.u32((pObj + 0x2c) >>> 0) >>> 0
        const x = pPath !== 0 ? m.u32((pPath + 0x0c) >>> 0) | 0 : 0
        const y = pPath !== 0 ? m.u32((pPath + 0x10) >>> 0) | 0 : 0
        const pSecondary = UNIT_Alloc113c(m, 2) >>> 0
        if (pSecondary !== 0) {
          m.setU32((pSecondary + 0x04) >>> 0, 0x67)
          m.setU32((pSecondary + 0x80) >>> 0, m.u32((pGame + 0x1c) >>> 0))
          m.setU32((pSecondary + 0x84) >>> 0, pGame >>> 0)
          let flagsEx = m.u32((pSecondary + 0xc8) >>> 0) >>> 0
          flagsEx =
            m.u16((pGame + 0x68) >>> 0) !== 0
              ? (flagsEx | 0x02000000) >>> 0
              : (flagsEx & 0xfdffffff) >>> 0
          m.setU32((pSecondary + 0xc8) >>> 0, (flagsEx | 0x04000000) >>> 0)
          const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pObjRoom)
          const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
          m.setU8((pSecondary + 0x18) >>> 0, nAct)
          m.setU32((pSecondary + 0x1c) >>> 0, m.u32((pGame + 0xbc + nAct * 4) >>> 0))
          m.setU32((pSecondary + 0x74) >>> 0, 0)
          SUNIT_InitUnitSeed113c(m, pSecondary, (pGame + 0xd0) >>> 0)
          m.setU32((pSecondary + 0xc4) >>> 0, (m.u32((pSecondary + 0xc4) >>> 0) | 0x10) >>> 0)
          m.setU32((pSecondary + 0xd0) >>> 0, 0x0b)
          let nextId = (m.u32((pGame + 0x98) >>> 0) + 1) >>> 0
          if (nextId === 0xffffffff) nextId = 1
          m.setU32((pGame + 0x98) >>> 0, nextId)
          m.setU32((pSecondary + 0x0c) >>> 0, nextId)
          const pObjData = m.alloc(0x38) >>> 0
          m.fill(pObjData, 0x38, 0)
          m.setU32((pSecondary + 0x14) >>> 0, pObjData)
          m.setU32(pObjData, DATATBLS_GetObjectsTxtRecord113c(m, 0x67) >>> 0)
          m.setU32((pSecondary + 0x10) >>> 0, 0)
          OBJECTS_InitObjectUnit113c(m, pSecondary, pGame, nextId, pObjRoom, x, y)
          SUNIT_PlaceServerUnitInRoom113c(m, pObjRoom, y, pSecondary, x, pGame, 1)
        }
      }
    }
  }
  return pObj
}

/**
 * Returns `pClient->pPlayerUnit` (`+0x174`). When `(pClient->dwFlags (+0x3D4) & 1) == 0` and
 * `bSkipVerify == 0`, verifies the player unit in `pClient->pGame` (`+0x1A8`) via `SUNIT_GetServerUnit113c`
 * (`unitType = +0x16C`, `unitId = +0x170`) and clears `pClient->pPlayerUnit = 0` if not found.
 *
 * @va D2Game:0x6FC6AD10
 */
export function CLIENTS_GetPlayerUnit113c(
  m: Memory113c,
  pClient: number,
  bSkipVerify: number,
): number {
  if ((m.u8((pClient + 0x3d4) >>> 0) & 1) !== 0 || (bSkipVerify | 0) !== 0) {
    return m.u32((pClient + 0x174) >>> 0) >>> 0
  }
  const pPlayer = m.u32((pClient + 0x174) >>> 0) >>> 0
  if (pPlayer === 0) {
    return 0
  }
  const pFound = SUNIT_GetServerUnit113c(
    m,
    m.u32((pClient + 0x1a8) >>> 0) >>> 0,
    m.u32((pClient + 0x16c) >>> 0) | 0,
    m.u32((pClient + 0x170) >>> 0) | 0,
  ) >>> 0
  if (pFound === 0) {
    m.setU32((pClient + 0x174) >>> 0, 0)
  }
  return pFound
}

/**
 * Synchronizes `pClient`'s room, adjacent room units, portal removals, copy-list stats,
 * inventory/equipment stats (when `pPlayer->dwFlagsEx & 0x200000`), level change notifications,
 * arena state, and `UNITROOM_RefreshUnit113c`.
 *
 * @va D2Game:0x6FC6B400
 */
export function CLIENTS_UpdatePlayerRoom113c(
  m: Memory113c,
  pClient: number,
  pGame: number,
): void {
  if (pGame === 0 || pClient === 0) {
    return
  }
  const pOldRoom = m.u32((pClient + 0x1b4) >>> 0) >>> 0
  const pPlayer = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0
  if (pPlayer === 0) {
    return
  }
  const pNewRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0
  SUNIT_SendRemovePortalsInAdjacentRooms113c(m, pOldRoom, pClient)
  SUNIT_SyncAdjacentRoomUnitsToClient113c(m, pOldRoom, pClient, pGame)
  STATLIST_EnumerateCopyListStats113c(
    m,
    pPlayer,
    pPlayer,
    0,
    (mem, u, statId, val, arg) =>
      D2GAME_PLRMODES_SendStatToClientOrParty113c(mem, u, statId, arg, val),
  )
  if (((m.u32((pPlayer + 0xc8) >>> 0) >>> 0x15) & 1) !== 0) {
    D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pPlayer, 1)
  }
  m.setU32((pClient + 0x1b0) >>> 0, (m.u32((pClient + 0x1b0) >>> 0) + 1) >>> 0)
  if (pOldRoom !== pNewRoom) {
    const nOldLvl = DUNGEON_GetLevelIdFromRoom113c(m, pOldRoom) | 0
    const nNewLvl = DUNGEON_GetLevelIdFromRoom113c(m, pNewRoom) | 0
    if (nOldLvl !== nNewLvl) {
      QUESTS_NotifyLevelChange113c(m, pGame, pPlayer, nOldLvl, nNewLvl)
      NPCS_OnPlayerLevelChange113c(m, pGame, nOldLvl, pPlayer, nNewLvl)
    }
    CLIENTS_SetPlayerCurrentRoom113c(m, pClient, pNewRoom)
  }
  D2GAME_ARENA_SyncArenaJoinState113c(m, pGame, pClient)
  if (UNITS_GetRoom113c(m, pPlayer) !== 0) {
    UNITROOM_RefreshUnit113c(m, pPlayer)
  }
}

/**
 * Monster `MONMODE_WALK (2)` start callback: checks `PATH_GetNumberOfPathPoints113c(pUnit->pPath) != 0`,
 * frees attacker combat list (`SUNITDMG_FreeAttackerCombatList113c`), switches animation mode to `2`
 * (`UNITS_ChangeAnimMode113c`), and returns `1` (or `0` if path has `0` points).
 *
 * @va D2Game:0x6FC94C60
 */
export function MONSTER_StartModeWalk113c(
  m: Memory113c,
  pGame: number,
  pModeArgs: number,
): number {
  const pUnit = m.u32((pModeArgs + 0x04) >>> 0) >>> 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (PATH_GetNumberOfPathPoints113c(m, pPath) === 0) {
    return 0
  }
  SUNITDMG_FreeAttackerCombatList113c(m, pUnit, pGame)
  UNITS_ChangeAnimMode113c(m, pUnit, 2)
  return 1
}

/**
 * Applies `pModeArgs->nVelocityOverride` (`+0x10`) to `pUnit`'s `0x4000` velocity stat list
 * (`STAT_VELOCITYPERCENT = 0x43`, allocating and merging a `0x4004` list if absent) and refreshes
 * `UNITS_SetUnitAnimMode113c`.
 *
 * @va D2Game:0x6FC94CE0
 */
export function MONSTER_ApplyModeVelocityOverride113c(
  m: Memory113c,
  pModeArgs: number,
  pUnit: number,
): void {
  const nVel = m.u32((pModeArgs + 0x10) >>> 0) | 0
  if (nVel === 0) {
    return
  }
  let pStatList = STATLIST_GetStatListFromUnitAndFlag113c(m, pUnit, 0x4000) >>> 0
  if (pStatList === 0) {
    const dwOwnerId = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff
    pStatList = STATLIST_AllocList113c(m, 0x4004, 1, dwOwnerId, 0, 0) >>> 0
    if (pStatList === 0) {
      return
    }
    STATLIST_MergeStatLists113c(m, pUnit, pStatList, 1)
  }
  STATLIST_SetStat113c(m, pStatList, 0x43, nVel, 0)
  UNITS_SetUnitAnimMode113c(m, pUnit, 0x6fd1bd10, 0x10d)
}

/**
 * Steps a player in `PLRMODE_WALK (2)` or `PLRMODE_RUN (3)`:
 * 1. Validates `pPlayer->pDynamicPath` target unit (`SUNIT_ValidatePathTargetUnit113c`).
 * 2. Checks `STATE_BLAZE (0x0D)` and drains stamina in `PLRMODE_RUN (3)` (`PLAYER_DrainRunStamina113c`,
 *    switching to `PLRMODE_WALK (2)` via `PLAYER_StartWalkOrRunMode113c` when stamina is exhausted).
 * 3. Steps the dynamic path (`PATH_Step113c(m, pPlayer, 0x400)`) and updates room membership if needed
 *    (`SUNIT_UpdateUnitPositionAndRoom113c`).
 * 4. Updates the player's 20-slot waypoint history ring buffer (`pPlayerData + 0xA0..0x147`).
 * 5. When the path finishes (`stepResult == 2`), dispatches any queued `pPlayerData + 0x150` skill/attack
 *    or transitions to `PLRMODE_NEUTRAL (1)` / `PLRMODE_TNEUTRAL (5)`.
 *
 * @va D2Game:0x6FC99B90
 */
export function PLAYER_StepModeWalkOrRun113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): number {
  SUNIT_ValidatePathTargetUnit113c(m, pPlayer, pGame)
  if (STATES_CheckState113c(m, pPlayer, 0x0d) !== 0) {
    m.setU32((pPlayer + 0xc4) >>> 0, (m.u32((pPlayer + 0xc4) >>> 0) | 1) >>> 0)
  }
  if (pPlayer !== 0 && (m.u32((pPlayer + 0x10) >>> 0) | 0) === 3) {
    if (PLAYER_DrainRunStamina113c(m, pPlayer) === 0) {
      PLAYER_StartWalkOrRunMode113c(m, 2, pPlayer, pGame)
    }
  }

  SUNIT_ValidatePathTargetUnit113c(m, pPlayer, pGame)
  const stepped = PATH_Step113c(m, pPlayer, 0x400)
  let stepResult = stepped !== 0 ? 1 : 2
  if (UNITS_GetPathRoomRefreshFlag113c(m, pPlayer) !== 0) {
    SUNIT_UpdateUnitPositionAndRoom113c(m, 0, pPlayer, pGame)
  }

  const dwTick = m.u32(0x6fd18d10) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  if (pPlayerData !== 0) {
    const lastTick = m.u32((pPlayerData + 0xa4) >>> 0) >>> 0
    if (dwTick > ((lastTick + 0x19) >>> 0)) {
      const curIdx = m.u8((pPlayerData + 0xa0) >>> 0)
      const prevIdx = curIdx === 0 ? 0x13 : (curIdx - 1) & 0xff
      const unitType = m.u32(pPlayer >>> 0) | 0
      const pPath = m.u32((pPlayer + 0x2c) >>> 0) >>> 0
      let posX = 0
      let posY = 0
      if (unitType === 2 || (unitType > 3 && unitType <= 5)) {
        posX = pPath !== 0 ? m.u32((pPath + 0x0c) >>> 0) | 0 : 0
        posY = pPath !== 0 ? m.u32((pPath + 0x10) >>> 0) | 0 : 0
      } else if (pPath !== 0) {
        posX = PATH_GetPosX113c(m, pPath) | 0
        posY = PATH_GetPosY113c(m, pPath) | 0
      }
      const prevX = m.u32((pPlayerData + prevIdx * 8 + 0xa8) >>> 0) | 0
      const prevY = m.u32((pPlayerData + prevIdx * 8 + 0xac) >>> 0) | 0
      if ((PATH_ComputeSquaredDistance113c(posX, posY, prevX, prevY) | 0) > 0x2d) {
        m.setU32((pPlayerData + curIdx * 8 + 0xa8) >>> 0, posX >>> 0)
        m.setU32((pPlayerData + curIdx * 8 + 0xac) >>> 0, posY >>> 0)
        const nextIdx = (m.u8((pPlayerData + 0xa0) >>> 0) + 1) & 0xff
        m.setU32((pPlayerData + 0xa4) >>> 0, dwTick)
        m.setU8((pPlayerData + 0xa0) >>> 0, nextIdx < 0x14 ? nextIdx : 0)
      }
    }
  }

  if (stepResult === 2) {
    if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
      const pPd = m.u32((pPlayer + 0x14) >>> 0) >>> 0
      if (pPd !== 0 && m.u32((pPd + 0x150) >>> 0) !== 0) {
        const nAction = m.u32((pPd + 0x154) >>> 0) | 0
        if (nAction >= 0) {
          const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(
            m,
            pPlayer,
            nAction,
          ) >>> 0
          if (pSkill !== 0) {
            SKILLS_GetSkillSlotIndex113c(m, pPlayer, pSkill)
            const targetId = PLAYER_GetParam15C_113c(m, pPlayer)
            const targetType = PLAYER_GetParam158_113c(m, pPlayer)
            const pTarget = SUNIT_GetServerUnit113c(m, pGame, targetType, targetId) >>> 0
            PLAYER_StartModeAttack113c(m, pGame, pPlayer, 7, pTarget)
            stepResult = 1
          } else {
            setPlayerNeutralOrTownNeutralMode113c(m, pGame, pPlayer, 1)
          }
        } else {
          setPlayerNeutralOrTownNeutralMode113c(m, pGame, pPlayer, 1)
        }
        if (m.u32(pPlayer >>> 0) === 0) {
          const pPdAfter = m.u32((pPlayer + 0x14) >>> 0) >>> 0
          if (pPdAfter !== 0) {
            m.setU32((pPdAfter + 0x150) >>> 0, 0)
          }
        }
        return stepResult
      }
    }
    setPlayerNeutralOrTownNeutralMode113c(m, pGame, pPlayer, 1)
  }
  return stepResult
}

/**
 * Iterates all adjacent rooms of `pRoom` (`DUNGEON_GetAdjacentRoomsListFromRoom113c`) and queues
 * 6-byte `0x0A` remove-unit packets (`NET_QueuePacketToClientBuffer113c`) to `pClient` for every
 * non-player, non-missile (`bType != 3`) portal node in `DUNGEON_GetRoomPortalList113c(pAdjRoom)`.
 *
 * @va D2Game:0x6FCBD780
 */
export function SUNIT_SendRemovePortalsInAdjacentRooms113c(
  m: Memory113c,
  pRoom: number,
  pClient: number,
): void {
  const sp = replayFinal11StackPtr
  replayFinal11StackPtr = (sp + 0x20) >>> 0
  try {
    const pOutCount = sp
    const pOutRooms = (sp + 4) >>> 0
    const pPkt = (sp + 8) >>> 0
    m.setU32(pOutCount, 0)
    m.setU32(pOutRooms, 0)
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, pOutRooms, pOutCount)
    const pPlayer = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0
    const dwPlayerType = m.u32(pPlayer >>> 0) >>> 0
    const dwPlayerId = m.u32((pPlayer + 0x0c) >>> 0) >>> 0
    const nRooms = m.u32(pOutCount) >>> 0
    const pRoomsArr = m.u32(pOutRooms) >>> 0
    for (let i = 0; i < nRooms; i++) {
      const pAdjRoom = m.u32((pRoomsArr + i * 4) >>> 0) >>> 0
      let pPortalNode = DUNGEON_GetRoomPortalList113c(m, pAdjRoom) >>> 0
      while (pPortalNode !== 0) {
        const nodeType = m.u32(pPortalNode) >>> 0
        const nodeId = m.u32((pPortalNode + 4) >>> 0) >>> 0
        if (!(nodeType === dwPlayerType && nodeId === dwPlayerId)) {
          const bType = m.u8(pPortalNode)
          if (bType !== 3) {
            m.setU8(pPkt, 0x0a)
            m.setU8((pPkt + 1) >>> 0, bType)
            m.setU32((pPkt + 2) >>> 0, nodeId)
            NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 6)
          }
        }
        pPortalNode = m.u32((pPortalNode + 8) >>> 0) >>> 0
      }
    }
  } finally {
    replayFinal11StackPtr = sp
  }
}

/**
 * Walks all 5 `pGame->pAct[0..4]` (`+0xBC..+0xCC`): when `pAct != 0` and `*pAct != 0` (`bHasPendingRoomUpdates`),
 * iterates active rooms via `DUNGEON_GetRoomExFromRoom113c(pAct)` along `pRoomNext (+0x7C)`, deactivates
 * update-list units (`pRoom + 0x1C` along `pRoomUpdateNext +0xE0`) via `SUNIT_DeactivateUnitStatesAndEvents113c`,
 * clears each room's update queue (`UNITROOM_ClearUpdateQueue113c`), zeroes `*pAct = 0`, and clears bit `0x400`
 * on `pGame->pArenaCtrl->dwFlags` (`+0x1D28 -> +0x08`).
 *
 * @va D2Game:0x6FCBD850
 */
export function GAME_ClearAllActRoomUpdateLists113c(m: Memory113c, pGame: number): void {
  for (let actIdx = 0; actIdx < 5; actIdx++) {
    const pAct = m.u32((pGame + 0xbc + actIdx * 4) >>> 0) >>> 0
    if (pAct !== 0 && m.u32(pAct) !== 0) {
      let pRoom = DUNGEON_GetRoomExFromRoom113c(m, pAct) >>> 0
      while (pRoom !== 0) {
        let pUnit = m.u32((pRoom + 0x1c) >>> 0) >>> 0
        while (pUnit !== 0) {
          SUNIT_DeactivateUnitStatesAndEvents113c(m, pUnit, pGame)
          pUnit = m.u32((pUnit + 0xe0) >>> 0) >>> 0
        }
        UNITROOM_ClearUpdateQueue113c(m, pRoom)
        pRoom = m.u32((pRoom + 0x7c) >>> 0) >>> 0
      }
      m.setU32(pAct, 0)
    }
  }
  const pArena = m.u32((pGame + 0x1d28) >>> 0) >>> 0
  if (pArena !== 0) {
    m.setU32((pArena + 8) >>> 0, (m.u32((pArena + 8) >>> 0) & 0xfffffbff) >>> 0)
  }
}

/**
 * Checks `*pGame->pAct[pClient->nAct (+0x1AC)] != 0` and synchronizes all units in every adjacent room
 * of `pRoom` (`DUNGEON_GetAdjacentRoomsListFromRoom113c`) to `pClient` via `D2GAME_SUNIT_SyncRoomUnitsToClient113c`.
 *
 * @va D2Game:0x6FCBDEC0
 */
export function SUNIT_SyncAdjacentRoomUnitsToClient113c(
  m: Memory113c,
  pRoom: number,
  pClient: number,
  pGame: number,
): void {
  const nAct = m.u8((pClient + 0x1ac) >>> 0)
  const pAct = m.u32((pGame + 0xbc + nAct * 4) >>> 0) >>> 0
  if (m.u32(pAct) === 0) {
    return
  }
  const sp = replayFinal11StackPtr
  replayFinal11StackPtr = (sp + 0x10) >>> 0
  try {
    const pOutCount = sp
    const pOutRooms = (sp + 4) >>> 0
    m.setU32(pOutCount, 0)
    m.setU32(pOutRooms, 0)
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, pOutRooms, pOutCount)
    const nRooms = m.u32(pOutCount) >>> 0
    const pRoomsArr = m.u32(pOutRooms) >>> 0
    for (let i = 0; i < nRooms; i++) {
      const pAdjRoom = m.u32((pRoomsArr + i * 4) >>> 0) >>> 0
      D2GAME_SUNIT_SyncRoomUnitsToClient113c(m, pAdjRoom, pClient, pGame)
    }
  } finally {
    replayFinal11StackPtr = sp
  }
}

/**
 * Frees a server `D2UnitStrc` (`pUnit`) from `pGame`:
 * 1. Deactivates and unlinks `pUnit` from its room and server hash table (`SUNIT_DeactivateAndRemoveUnit113c`).
 * 2. Clears `pUnit->pField74` (`+0x74`) linked list.
 * 3. Runs type-specific destruction (`0..5`: player node list / combat / inventory / dynamic path;
 *    monster room update list / dynamic path / `MONSTER_DestroyMonsterUnit113c`; object `OBJECT_DestroyObjectUnit113c`
 *    / static path; missile dynamic path / events; item inventory / events / socket owner / static path; tile static path).
 * 4. Frees unit quest chain (`QUESTS_FreeUnitQuestChain113c`), event notify list (`UNIT_FreeEventNotifyList113c`),
 *    and base unit allocation (`UNITS_FreeUnit113c`).
 *
 * @va D2Game:0x6FD020A0
 */
export function SUNIT_FreeUnit113c(m: Memory113c, pGame: number, pUnit: number): void {
  SUNIT_DeactivateAndRemoveUnit113c(m, pGame, pUnit, 0)
  let pNode74 = m.u32((pUnit + 0x74) >>> 0) >>> 0
  if (pNode74 !== 0) {
    while (pNode74 !== 0) {
      pNode74 = m.u32((pNode74 + 0x04) >>> 0) >>> 0
    }
    m.setU32((pUnit + 0x74) >>> 0, 0)
  }

  const dwUnitType = m.u32(pUnit >>> 0) >>> 0
  const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
  switch (dwUnitType) {
    case 0: {
      const dwNodeIdx = m.u32((pUnit + 0xd0) >>> 0) >>> 0
      if (dwNodeIdx !== 0x0b) {
        let pCur = m.u32((pGame + 0x10f8 + dwNodeIdx * 4) >>> 0) >>> 0
        while (pCur !== 0) {
          const pRefUnit = m.u32(pCur) >>> 0
          const pNext = m.u32((pCur + 0x08) >>> 0) >>> 0
          if (pRefUnit !== 0) {
            m.setU32((pRefUnit + 0xd0) >>> 0, 0x0b)
          }
          pCur = pNext
        }
        m.setU32((pGame + 0x10f8 + dwNodeIdx * 4) >>> 0, 0)
      }
      SUNITDMG_FreeAttackerCombatList113c(m, pUnit, pGame)
      SUNIT_ClearUnitInventoryItems113c(m, pGame, pUnit)
      EVENT_RemoveUnitEvents113c(m, pGame, pUnit)
      const pPath0 = m.u32((pUnit + 0x2c) >>> 0) >>> 0
      if (pPath0 !== 0) {
        PATH_FreeDynamicPath113c(m, pMemPool, pPath0)
        m.setU32((pUnit + 0x2c) >>> 0, 0)
      }
      break
    }
    case 1: {
      SUNIT_UnlinkFromRoomUpdateList113c(m, pGame, pUnit)
      const pPath1 = m.u32((pUnit + 0x2c) >>> 0) >>> 0
      if (pPath1 !== 0) {
        PATH_FreeDynamicPath113c(m, pMemPool, pPath1)
        m.setU32((pUnit + 0x2c) >>> 0, 0)
      }
      MONSTER_DestroyMonsterUnit113c(m, pGame, pUnit)
      break
    }
    case 2: {
      OBJECT_DestroyObjectUnit113c(m, pGame, pUnit)
      UNITS_FreeStaticPath113c(m, pUnit)
      break
    }
    case 3: {
      const pPath3 = m.u32((pUnit + 0x2c) >>> 0) >>> 0
      if (pPath3 !== 0) {
        PATH_FreeDynamicPath113c(m, pMemPool, pPath3)
        m.setU32((pUnit + 0x2c) >>> 0, 0)
      }
      EVENT_RemoveUnitEvents113c(m, pGame, pUnit)
      break
    }
    case 4: {
      if (m.u32((pUnit + 0x60) >>> 0) !== 0) {
        SUNIT_ClearUnitInventoryItems113c(m, pGame, pUnit)
      }
      EVENT_RemoveUnitEvents113c(m, pGame, pUnit)
      ITEMS_RemoveFromSocketedOwner113c(m, pMemPool, pUnit)
      UNITS_FreeStaticPath113c(m, pUnit)
      break
    }
    case 5: {
      UNITS_FreeStaticPath113c(m, pUnit)
      break
    }
    default:
      break
  }

  QUESTS_FreeUnitQuestChain113c(m, pGame, pUnit)
  UNIT_FreeEventNotifyList113c(m, pUnit)
  UNITS_FreeUnit113c(m, pUnit)
}
