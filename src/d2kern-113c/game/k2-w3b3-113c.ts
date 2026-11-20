/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 3 Batch 3 (`w3b3`) routines across
 * `0x6FC533D0..0x6FC5FED0` (45 functions):
 * - Object init fn `05` portal/door destination level assignment (`0x6FC533D0`)
 * - Quest level-transition gate, spiral room subtile search, game quest list init,
 *   quest alert/log packets (`0x5D`, `0x50`, `0x52`, `0x27`, `0x91`), and NPC intro flags (`0x6FC54020..0x6FC55C20`)
 * - Missile cold length scaling, guided/linear path setup, elemental conversion,
 *   and `SrvDoFunc` / `SrvDmgFunc` projectile handlers (`0x6FC59080..0x6FC5FED0`)
 */

import {
  COLLISION_CheckMaskWithSizeXY113c,
  COLLISION_CheckSubtileMask113c,
  COLLISION_RayTrace113c,
} from '../common/collision.ts'
import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import { SEED_GetLowSeed113c } from '../common/drlg/drlg-grid.ts'
import { MONSTER_CheckMonTypeFlag0x20_113c } from '../common/drlg/drlg-ver.ts'
import { PATH_CheckFlag08_113c } from '../common/drlg/room-tile.ts'
import {
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordinates113c,
} from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { imul32, mulDiv113c } from '../common/int-math.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../common/items.ts'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import {
  MISSILE_GetElapsedFrames113c,
  MISSILE_GetHitShiftFromId113c,
  MISSILE_GetLevel113c,
  MISSILE_GetRemainingFrames113c,
  MISSILE_GetSkill113c,
  MISSILE_GetTargetX113c,
  MISSILE_GetTargetY113c,
  MISSILE_SetRemainingFrames113c,
  MISSILE_SetTargetX113c,
  MISSILE_SetTargetY113c,
  MISSILE_SetTotalFrames113c,
} from '../common/missile.ts'
import {
  PATH_Compute113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_SetTargetPos113c,
  PATH_SetTargetUnit113c,
} from '../common/path.ts'
import { QUESTRECORD_AllocRecord113c } from '../common/quest-record.ts'
import {
  MISSILE_ResolveSkillIdByCodeOrRef113c,
  SKILLS_EvalCalcByOffset113c,
  SKILLS_GetSkillPhysMaxDamage113c,
  SKILLS_GetSkillPhysMinDamage113c,
  UNITS_GetUnitDistanceToCoordinates113c,
} from '../common/skills.ts'
import {
  DRLGLOGIC_GetBossTombLevel113c,
  STATES_ClearGfxStateFlag113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_GetExpireFrameEx113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  TEXT_AllocTextList113c,
  TEXT_BuildMessageList113c,
  TEXT_FreeTextList113c,
} from '../common/text.ts'
import {
  UNIT_GetAlignment113c,
  UNITS_GetApproximateDistance113c,
  UNITS_GetRoom113c,
  UNITS_SetCollisionMaskAtCoords113c,
} from '../common/unit.ts'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { SEED_InitLowSeed113c, SEED_InitSeed113c, seedRoll } from '../prng.ts'
import { MONSTERS_IsDemonOrUndead113c } from '../tables/datatbls-113c.ts'
import { SUNIT_CanPlayerTargetUnitWithSkill113c } from './a1c-post150-f786-f1040-113c.ts'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import {
  AURA_CheckUnitMatchesFilterFlags113c,
  STATES_CreateOrUpdateAuraStatList113c,
} from './k2-gap-itemdef-113c.ts'
import {
  type K2GapMeleeDotHooks113c,
  MISSILE_CanCollideWithUnit113c,
  MISSILE_CreateServerProjectile113c,
  MISSILE_ProcessTargetCollisionHit113c,
  MISSILE_RollMasteryStatRange113c,
  MISSILE_SrvDo01_LinearProjectile113c,
  STATES_OnTimedStateRemoved113c,
} from './k2-gap-melee-dot-113c.ts'
import { QUESTS_SendPlayerQuestLogPacket28_113c } from './k2-items-tc-w1-113c.ts'
import {
  QUESTS_AttachQuestToUnit_6FC53F80_113c,
  QUESTS_GetQuestData_6FC53F30_113c,
  QUESTS_ResolveDefaultStatusByte_6FC53A30_113c,
} from './k2-laneJ-0x6fc4-w1-113c.ts'
import {
  type LaneK0x6fc5Hooks113c,
  MISSILES_AddElemDamageByEType_6FC59260_113c,
  MISSILES_WarpPathToOwnerPos_6FC5A1D0_113c,
  QUESTS_PackNpcIntroFlags_6FC54C70_113c,
  QUESTS_SendGameQuestStatePacket29_6FC55030_113c,
  QUESTS_SetNpcIntroFlags_6FC54D00_113c,
  QUESTS_TriggerCallback00_6FC54660_113c,
} from './k2-laneK-0x6fc5-w1-113c.ts'
import { SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c } from './k2-laneL-0x6fc6-w1-113c.ts'
import {
  ACT5Q2_CalcRemainingSoldiersCount_6FC76B80_113c,
  ACT5Q5_CanSpawnTownPortalOnSummit_6FC76600_113c,
  ACT5Q6_IsWorldstoneEntryAllowed_6FC76570_113c,
} from './k2-laneM-0x6fc7-w1-113c.ts'
import {
  ACT3Q5_IsDuranceEntryBlocked113c,
  SUNIT_CanTargetOwnPetWithSkill113c,
  SUNIT_GetOwnerUnit113c,
} from './k2-sunit-spawn-w1-113c.ts'
import { ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c } from './k2-w2b2-113c.ts'
import { NET_SendPacketBuffer6B_6FCAACD0_113c } from './k2-w2b3-113c.ts'
import {
  type K2W2B4Hooks113c,
  SKILLS_DispatchSrvDoFunc_6FCBE420_113c,
} from './k2-w2b4-113c.ts'
import { ACT2Q2_CanSpawnViperAmuletChest_6FCE1A60_113c } from './k2-w2b6-113c.ts'
import { SUNIT_IsDeadOrDying113c, UNITS_ChangeAnimMode113c } from './monster-events.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SKILLS_GetRecordPtrFast113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts'
import { EVENT_SetEventFull113c, type EventWheelHooks113c } from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

export type D2KernMemory113c = Memory113c

/** Optional host callbacks for `w3b3` routines. */
export interface K2W3B3Hooks113c extends K2GapMeleeDotHooks113c {
  readonly eventWheel?: EventWheelHooks113c
  readonly laneK?: LaneK0x6fc5Hooks113c
  readonly w2b4?: K2W2B4Hooks113c
  readonly isBadCodePtr?: (pfn: number) => number
  readonly onQuestInit?: (m: Memory113c, pfnInit: number, pQuest: number) => void
  readonly onQuestStatus?: (
    m: Memory113c,
    pfnStatus: number,
    pQuest: number,
    pPlayerUnit: number,
    pGameQuestFlags: number,
    pPlayerQuestFlags: number,
    pOutByte: number,
  ) => number
}

/** Reentrant scratch stack region for `w3b3` local structs and network packets. */
let k2W3B3StackPtr = 0x7ef28000

const D2GAME_QUEST_INIT_TABLE_VA_113C = 0x6fd2dbf0
const D2GAME_QUEST_INIT_COUNT_VA_113C = 0x6fd2df68
const D2GAME_INTRO_QUEST_INIT_TABLE_VA_113C = 0x6fd2df6c
const D2GAME_INTRO_QUEST_INIT_COUNT_VA_113C = 0x6fd2df8c

const D2GAME_ACT1_NPC_INTRO_IDS_VA_113C = 0x6fd2df90
const D2GAME_ACT2_NPC_INTRO_IDS_VA_113C = 0x6fd2dfa8
const D2GAME_ACT3_NPC_INTRO_IDS_VA_113C = 0x6fd2dfd4
const D2GAME_ACT5_NPC_INTRO_IDS_VA_113C = 0x6fd2dff0

const DEFAULT_ACT1_NPC_INTRO_IDS_113C: readonly number[] = [148, 154, 150, 147, 155, 265]
const DEFAULT_ACT2_NPC_INTRO_IDS_113C: readonly number[] = [
  175, 176, 177, 178, 202, 200, 210, 201, 198, 199, 244,
]
const DEFAULT_ACT3_NPC_INTRO_IDS_113C: readonly number[] = [245, 252, 253, 254, 255, 264, 297]
const DEFAULT_ACT5_NPC_INTRO_IDS_113C: readonly number[] = [520, 521, 511, 512, 513, 514, 515]

function sx16(v: number): number {
  return (v << 16) >> 16
}

function readI32(m: Memory113c, addr: number): number {
  return m.u32(addr >>> 0) | 0
}

function getSgptDataTablesPtr113c(m: Memory113c): number {
  const pTables = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  return pTables !== 0 ? m.u32(pTables) >>> 0 : 0
}

function getMissilesTxtRecord113c(m: Memory113c, nMissileId: number): number {
  const id = nMissileId | 0
  if (id < 0) return 0
  const pTables = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  if (pTables === 0) return 0
  const pDataTables = m.u32(pTables) >>> 0
  if (pDataTables === 0) return 0
  const count = readI32(m, (pDataTables + 0xb6c) >>> 0)
  if (id >= count) return 0
  const base = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (base === 0) return 0
  return (base + imul32(id, 0x1a4)) >>> 0
}

function getSkillsTxtRecordInline113c(m: Memory113c, nSkillId: number): number {
  const id = nSkillId | 0
  if (id < 0) return 0
  const pTables = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  if (pTables === 0) return 0
  const pDataTables = m.u32(pTables) >>> 0
  if (pDataTables === 0) return 0
  const count = readI32(m, (pDataTables + 0xba0) >>> 0)
  if (id >= count) return 0
  const base = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (base === 0) return 0
  return (base + imul32(id, 0x23c)) >>> 0
}

function checkIsBadCodePtrW3B3(pfn: number, hooks?: K2W3B3Hooks113c): number {
  if (hooks !== undefined && hooks.isBadCodePtr !== undefined) {
    return hooks.isBadCodePtr(pfn >>> 0) | 0
  }
  return 0
}

function div100SignedMagic113c(val: number): number {
  const prod = BigInt(val | 0) * 0x51eb851fn
  const edx = Number((prod >> 32n) & 0xffffffffn) | 0
  return ((edx >> 5) + (edx >>> 31)) | 0
}

function readSeededU32OrZero113c(m: Memory113c, addr: number): number {
  try {
    return m.u32(addr >>> 0)
  } catch {
    return 0
  }
}

function ensureActNpcIntroArraysSeeded113c(m: Memory113c): void {
  if (readSeededU32OrZero113c(m, D2GAME_ACT1_NPC_INTRO_IDS_VA_113C) === 0) {
    for (let i = 0; i < DEFAULT_ACT1_NPC_INTRO_IDS_113C.length; i = (i + 1) | 0) {
      const id = DEFAULT_ACT1_NPC_INTRO_IDS_113C[i]
      if (id !== undefined) {
        m.setU32((D2GAME_ACT1_NPC_INTRO_IDS_VA_113C + i * 4) >>> 0, id >>> 0)
      }
    }
  }
  if (readSeededU32OrZero113c(m, D2GAME_ACT2_NPC_INTRO_IDS_VA_113C) === 0) {
    for (let i = 0; i < DEFAULT_ACT2_NPC_INTRO_IDS_113C.length; i = (i + 1) | 0) {
      const id = DEFAULT_ACT2_NPC_INTRO_IDS_113C[i]
      if (id !== undefined) {
        m.setU32((D2GAME_ACT2_NPC_INTRO_IDS_VA_113C + i * 4) >>> 0, id >>> 0)
      }
    }
  }
  if (readSeededU32OrZero113c(m, D2GAME_ACT3_NPC_INTRO_IDS_VA_113C) === 0) {
    for (let i = 0; i < DEFAULT_ACT3_NPC_INTRO_IDS_113C.length; i = (i + 1) | 0) {
      const id = DEFAULT_ACT3_NPC_INTRO_IDS_113C[i]
      if (id !== undefined) {
        m.setU32((D2GAME_ACT3_NPC_INTRO_IDS_VA_113C + i * 4) >>> 0, id >>> 0)
      }
    }
  }
  if (readSeededU32OrZero113c(m, D2GAME_ACT5_NPC_INTRO_IDS_VA_113C) === 0) {
    for (let i = 0; i < DEFAULT_ACT5_NPC_INTRO_IDS_113C.length; i = (i + 1) | 0) {
      const id = DEFAULT_ACT5_NPC_INTRO_IDS_113C[i]
      if (id !== undefined) {
        m.setU32((D2GAME_ACT5_NPC_INTRO_IDS_VA_113C + i * 4) >>> 0, id >>> 0)
      }
    }
  }
}

/**
 * `Objects.txt` `InitFn` 5 (`ecx = pObjInit`): initializes a portal/door object's animation mode,
 * collision footprint, and `pObjectData->bDestLevel (+0x04)` based on the room's level ID and
 * Act 2 boss tomb level (`DRLGLOGIC_GetBossTombLevel113c`).
 *
 * @va D2Game:0x6FC533D0
 */
export function OBJECTS_InitFn05_InitPortalDestLevel_6FC533D0_113c(
  m: D2KernMemory113c,
  pObjInit: number,
  hooks?: K2W3B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC533D0)
  const initPtr = pObjInit >>> 0
  const pRoom = m.u32((initPtr + 0x08) >>> 0) >>> 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  const pObject = m.u32((initPtr + 0x04) >>> 0) >>> 0

  if (pObject === 0 || m.u32((pObject + 0x10) >>> 0) === 0) {
    UNITS_ChangeAnimMode113c(m, pObject, 1)
    const nY = readI32(m, (initPtr + 0x18) >>> 0)
    const nX = readI32(m, (initPtr + 0x14) >>> 0)
    const pRoomNow = m.u32((initPtr + 0x08) >>> 0) >>> 0
    const pObjNow = m.u32((initPtr + 0x04) >>> 0) >>> 0
    UNITS_SetCollisionMaskAtCoords113c(m, pObjNow, pRoomNow, nX, nY)

    const pObjectsTxt = m.u32((initPtr + 0x10) >>> 0) >>> 0
    const frameDelta = m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8
    const pGame = m.u32(initPtr) >>> 0
    const curFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
    EVENT_SetEventFull113c(
      m,
      pGame,
      m.u32((initPtr + 0x04) >>> 0) >>> 0,
      1,
      (frameDelta + curFrame + 1) >>> 0,
      0,
      0,
      0,
      hooks !== undefined ? hooks.eventWheel : undefined,
    )
  }

  const pGame = m.u32(initPtr) >>> 0
  const pAct = m.u32((pGame + 0xc0) >>> 0) >>> 0
  const nBossTombLevel = DRLGLOGIC_GetBossTombLevel113c(m, pAct) | 0
  const getObjData = (): number => {
    const pObj = m.u32((initPtr + 0x04) >>> 0) >>> 0
    return m.u32((pObj + 0x14) >>> 0) >>> 0
  }

  switch (nLevelId) {
    case 1:
      m.setU8((getObjData() + 0x04) >>> 0, 0x27)
      return
    case 39:
      m.setU8((getObjData() + 0x04) >>> 0, 0x01)
      return
    case 38:
      m.setU8((getObjData() + 0x04) >>> 0, 0x04)
      return
    case 4:
      m.setU8((getObjData() + 0x04) >>> 0, 0x26)
      return
    case 74:
      m.setU8((getObjData() + 0x04) >>> 0, 0x2e)
      return
    case 46:
      m.setU8((getObjData() + 0x04) >>> 0, 0x4a)
      return
    case 73:
      m.setU8((getObjData() + 0x04) >>> 0, nBossTombLevel & 0xff)
      return
    case 121:
      m.setU8((getObjData() + 0x04) >>> 0, 0x6d)
      return
    case 109:
      m.setU8((getObjData() + 0x04) >>> 0, 0x79)
      return
    case 125:
      m.setU8((getObjData() + 0x04) >>> 0, 0x6f)
      return
    case 126:
      m.setU8((getObjData() + 0x04) >>> 0, 0x70)
      return
    case 127:
      m.setU8((getObjData() + 0x04) >>> 0, 0x75)
      return
    case 111:
    case 112:
    case 117: {
      const targetLevel = nLevelId === 111 ? 0x7d : nLevelId === 112 ? 0x7e : 0x7f
      if (m.u8((getObjData() + 0x04) >>> 0) === targetLevel) {
        return
      }
      const pObj2 = m.u32((initPtr + 0x04) >>> 0) >>> 0
      const pObjData2 = m.u32((pObj2 + 0x14) >>> 0) >>> 0
      m.setU8((pObjData2 + 0x04) >>> 0, targetLevel)
      const pGameNow = m.u32(initPtr) >>> 0
      const nextFrame = (m.u32((pGameNow + 0xa8) >>> 0) + 1) >>> 0
      EVENT_SetEventFull113c(
        m,
        pGameNow,
        m.u32((initPtr + 0x04) >>> 0) >>> 0,
        0x0b,
        nextFrame,
        0,
        0,
        0,
        hooks !== undefined ? hooks.eventWheel : undefined,
      )
      return
    }
    default:
      if (nLevelId === nBossTombLevel) {
        m.setU8((getObjData() + 0x04) >>> 0, 0x49)
      }
      return
  }
}

/**
 * Checks whether a level transition or portal into `nTargetLevelId` (`ecx`) from `nSourceLevelId`
 * (`[esp+8]`) by `pUnit` (`[esp+4]`) in `pGame` (`eax`) is blocked by quest state (`ret 8`).
 *
 * @va D2Game:0x6FC54020
 */
export function QUESTS_CheckLevelTransitionBlocked_6FC54020_113c(
  m: D2KernMemory113c,
  pGame: number,
  nTargetLevelId: number,
  pUnit: number,
  nSourceLevelId: number,
): number {
  hitD2GameVa113c(0x6FC54020)
  const game = pGame >>> 0
  switch (nTargetLevelId | 0) {
    case 0x49:
      return ACT2Q2_CanSpawnViperAmuletChest_6FCE1A60_113c(m, game) | 0
    case 0x64:
      return ACT3Q5_IsDuranceEntryBlocked113c(m, game, pUnit >>> 0) | 0
    case 0x76:
    case 0x80:
      if ((nSourceLevelId | 0) !== 0x78) {
        return 0
      }
      return ACT5Q5_CanSpawnTownPortalOnSummit_6FC76600_113c(m, game) | 0
    case 0x84:
      return ACT5Q6_IsWorldstoneEntryAllowed_6FC76570_113c(m, game) | 0
    default:
      return 0
  }
}

/**
 * Searches outward in concentric rings (`1..nMaxRing-1`, step `2`) around `*pIoCoord` in `pRoom`
 * for an unblocked subtile region of size `(2 * nSubtileRadius + 1)` against `wCollisionMask`,
 * writing the resolved `(x, y)` and `D2RoomStrc*` into `pIoCoord` and `*ppOutRoom` (`ret 0x18`).
 *
 * @va D2Game:0x6FC54130
 */
export function QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(
  m: D2KernMemory113c,
  pRoom: number,
  pIoCoord: number,
  nSubtileRadius: number,
  wCollisionMask: number,
  ppOutRoom: number,
  nMaxRing: number,
): void {
  hitD2GameVa113c(0x6FC54130)
  const coordPtr = pIoCoord >>> 0
  const outRoomPtr = ppOutRoom >>> 0
  const halfSize = (nSubtileRadius >>> 0) >>> 1
  const baseX = (readI32(m, coordPtr) - halfSize) | 0
  const baseY = (readI32(m, (coordPtr + 0x04) >>> 0) - halfSize) | 0
  let lastX = baseX
  let curRoom = pRoom >>> 0

  const savedSp = k2W3B3StackPtr
  const pRoomCoords = savedSp
  k2W3B3StackPtr = (savedSp + 0x20) >>> 0
  try {
    DUNGEON_GetRoomCoordinates113c(m, curRoom, pRoomCoords)
    const maxRing = nMaxRing | 0
    if (maxRing <= 1) {
      m.setU32(outRoomPtr, 0)
      return
    }

    let nRing = 1
    let negRing = -1
    while (nRing < maxRing) {
      if (nRing > negRing) {
        let dy = nRing
        while (dy > negRing) {
          const curY = (dy + baseY) | 0
          const roomYStart = readI32(m, (pRoomCoords + 0x04) >>> 0)
          const roomYEnd = (roomYStart + readI32(m, (pRoomCoords + 0x0c) >>> 0)) | 0
          let pRowRoom = curRoom
          if (curY < roomYStart || curY >= roomYEnd) {
            pRowRoom = ROOM_FindRoomContainingSubtile113c(m, curRoom, lastX, curY) >>> 0
          }
          if (pRowRoom !== 0 && negRing < nRing) {
            let dx = negRing
            let curX = (negRing + baseX) | 0
            while (dx < nRing) {
              curRoom = pRowRoom
              DUNGEON_GetRoomCoordinates113c(m, pRowRoom, pRoomCoords)
              lastX = curX
              const roomXStart = readI32(m, pRoomCoords)
              const roomXEnd = (roomXStart + readI32(m, (pRoomCoords + 0x08) >>> 0)) | 0
              if (curX < roomXStart || curY >= roomXEnd) {
                curRoom = ROOM_FindRoomContainingSubtile113c(m, pRowRoom, curX, curY) >>> 0
              }
              if (curRoom !== 0) {
                const nSizeXY = ((nSubtileRadius | 0) * 2 + 1) | 0
                const hit =
                  COLLISION_CheckMaskWithSizeXY113c(
                    m,
                    curRoom,
                    curX,
                    curY,
                    nSizeXY,
                    nSizeXY,
                    wCollisionMask & 0xffff,
                  ) & 0xffff
                if (hit === 0) {
                  const uXStart = m.u32(pRoomCoords) >>> 0
                  const uXEnd = (uXStart + (m.u32((pRoomCoords + 0x08) >>> 0) >>> 0)) >>> 0
                  const uYStart = m.u32((pRoomCoords + 0x04) >>> 0) >>> 0
                  const uYEnd = (uYStart + (m.u32((pRoomCoords + 0x0c) >>> 0) >>> 0)) >>> 0
                  if (
                    (curX >>> 0) >= uXStart &&
                    (curX >>> 0) < uXEnd &&
                    (curY >>> 0) >= uYStart &&
                    (curY >>> 0) < uYEnd
                  ) {
                    const finalX = (curX + halfSize) | 0
                    const finalY = (curY + halfSize) | 0
                    m.setU32(coordPtr, finalX >>> 0)
                    m.setU32((coordPtr + 0x04) >>> 0, finalY >>> 0)
                    const finalRoom =
                      ROOM_FindRoomContainingSubtile113c(m, pRoom >>> 0, finalX, finalY) >>> 0
                    m.setU32(outRoomPtr, finalRoom)
                    return
                  }
                }
              }
              dx = (dx + 2) | 0
              curX = (curX + 2) | 0
            }
            curRoom = pRoom >>> 0
          }
          dy = (dy - 2) | 0
        }
      }
      nRing = (nRing + 1) | 0
      negRing = (negRing - 1) | 0
    }
    m.setU32(outRoomPtr, 0)
  } finally {
    k2W3B3StackPtr = savedSp
  }
}

/**
 * Allocates and initializes `pGame->pQuestControl (+0x10F4)` along with all regular quest nodes
 * (`0x6FD2DBF0`, count at `0x6FD2DF68`) and intro quest nodes (`0x6FD2DF6C`, count at `0x6FD2DF8C`),
 * seeding `pQuestControl->tSeed (+0x18)` from `pGame->pGameSeed (+0xD0)` and allocating
 * `pQuestControl->pQuestFlags (+0x0C)` via `QUESTRECORD_AllocRecord113c` (`ret 4`).
 *
 * @va D2Game:0x6FC548A0
 */
export function QUESTS_AllocAndInitGameQuests_6FC548A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  hooks?: K2W3B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC548A0)
  const game = pGame >>> 0
  let esi = 0
  let ebx = 0

  const nQuests = readI32(m, D2GAME_QUEST_INIT_COUNT_VA_113C)
  if (nQuests > 0) {
    let edi = D2GAME_QUEST_INIT_TABLE_VA_113C
    for (let i = 0; i < nQuests; i = (i + 1) | 0) {
      m.u32((game + 0x1c) >>> 0)
      esi = m.alloc(0xf8) >>> 0
      const bAct = m.u8((edi + 0x04) >>> 0)
      const dwQuestId = m.u32((edi + 0x10) >>> 0) >>> 0
      m.fill(esi, 0xf8, 0)
      m.setU32((esi + 0xf4) >>> 0, ebx)
      m.setU32(esi, dwQuestId)
      m.setU32((esi + 0x04) >>> 0, game)
      m.setU8((esi + 0x0a) >>> 0, 0)
      m.setU8((esi + 0x0b) >>> 0, 0)
      m.setU8((esi + 0x09) >>> 0, 1)
      m.setU8((esi + 0x08) >>> 0, bAct)
      m.setU16((esi + 0x9c) >>> 0, 0)
      const pfnInit = m.u32(edi) >>> 0
      ebx = esi
      if (pfnInit !== 0) {
        if (checkIsBadCodePtrW3B3(pfnInit, hooks) !== 0) {
          throw new D2CommonAssertError('Quests.cpp', 0x19b)
        }
        if (hooks !== undefined && hooks.onQuestInit !== undefined) {
          hooks.onQuestInit(m, pfnInit, esi)
        }
      }
      edi = (edi + 0x18) >>> 0
    }
  }

  const nIntroQuests = readI32(m, D2GAME_INTRO_QUEST_INIT_COUNT_VA_113C)
  if (nIntroQuests > 0) {
    for (let i = 0; i < nIntroQuests; i = (i + 1) | 0) {
      m.u32((game + 0x1c) >>> 0)
      esi = m.alloc(0xf8) >>> 0
      m.fill(esi, 0xf8, 0)
      m.setU32(esi, (i + 0x25) >>> 0)
      m.setU32((esi + 0x04) >>> 0, game)
      m.setU8((esi + 0x0a) >>> 0, 1)
      m.setU8((esi + 0x0b) >>> 0, 0)
      m.setU8((esi + 0x09) >>> 0, 0)
      const bAct = m.u8((D2GAME_INTRO_QUEST_INIT_TABLE_VA_113C + i * 8 + 4) >>> 0)
      m.setU32((esi + 0xf4) >>> 0, ebx)
      m.setU8((esi + 0x08) >>> 0, bAct)
      const pfnInit = m.u32((D2GAME_INTRO_QUEST_INIT_TABLE_VA_113C + i * 8) >>> 0) >>> 0
      ebx = esi
      if (pfnInit !== 0) {
        if (checkIsBadCodePtrW3B3(pfnInit, hooks) !== 0) {
          throw new D2CommonAssertError('Quests.cpp', 0x1ad)
        }
        if (hooks !== undefined && hooks.onQuestInit !== undefined) {
          hooks.onQuestInit(m, pfnInit, esi)
        }
      }
    }
  }

  m.u32((game + 0x1c) >>> 0)
  const pQuestCtrl = m.alloc(0x24) >>> 0
  m.setU32(pQuestCtrl, esi)
  const pSeed = (pQuestCtrl + 0x18) >>> 0
  m.setU32((pQuestCtrl + 0x08) >>> 0, 0)
  m.setU32((pQuestCtrl + 0x10) >>> 0, 0)
  m.setU32((pQuestCtrl + 0x14) >>> 0, 0)
  SEED_InitSeed113c(m, pSeed)

  const seedLo = m.u32((game + 0xd0) >>> 0) >>> 0
  const seedHi = m.u32((game + 0xd4) >>> 0) >>> 0
  const prod = BigInt(seedLo) * 0x6ac690c5n + BigInt(seedHi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((game + 0xd4) >>> 0, newHi)
  m.setU32((game + 0xd0) >>> 0, newLo)
  SEED_InitLowSeed113c(m, pSeed, newLo)

  m.setU32((pQuestCtrl + 0x04) >>> 0, 0)
  const pMemPool = m.u32((game + 0x1c) >>> 0) >>> 0
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, pMemPool) >>> 0
  m.setU32((pQuestCtrl + 0x0c) >>> 0, pQuestFlags)
  m.setU32((game + 0x10f4) >>> 0, pQuestCtrl)
}

let k4QuestStatusFilterDispatcher:
  | ((
      m: Memory113c,
      pfnStatus: number,
      pQuest: number,
      pPlayerUnit: number,
      pGameQuestFlags: number,
      pPlayerQuestFlags: number,
      pOutByte: number,
    ) => number)
  | null = null

export function registerK4QuestStatusFilterDispatcher113c(
  fn: (
    m: Memory113c,
    pfnStatus: number,
    pQuest: number,
    pPlayerUnit: number,
    pGameQuestFlags: number,
    pPlayerQuestFlags: number,
    pOutByte: number,
  ) => number,
): void {
  k4QuestStatusFilterDispatcher = fn
}

/**
 * Builds and sends a 6-byte `0x5D` quest state alert packet for `nQuestId` (`al`) to `pPlayerUnit`
 * (`ecx`) in `pGame` (`[esp+4]`) when the player is in the same act as `pQuest->bAct (+0x08)` (`ret 4`).
 *
 * @va D2Game:0x6FC554F0
 */
export function QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(
  m: D2KernMemory113c,
  nQuestId: number,
  pPlayerUnit: number,
  pGame: number,
  hooks?: K2W3B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC554F0)
  const game = pGame >>> 0
  const player = pPlayerUnit >>> 0
  const questIdByte = nQuestId & 0xff
  const pQuest = QUESTS_GetQuestData_6FC53F30_113c(m, game, questIdByte) >>> 0
  if (pQuest === 0) return

  let pClient = 0
  if (player !== 0 && m.u32(player) === 0) {
    const pPlayerData0 = UNITS_GetPlayerData113c(m, player) >>> 0
    pClient = m.u32((pPlayerData0 + 0x9c) >>> 0) >>> 0
  }

  const pRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pRoom === 0) return
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId === 0) return
  const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (m.u8((pQuest + 0x08) >>> 0) !== nAct) return

  const savedSp = k2W3B3StackPtr
  const pPacket = savedSp
  const pOutByte = (savedSp + 0x08) >>> 0
  k2W3B3StackPtr = (savedSp + 0x10) >>> 0
  try {
    m.setU32(pPacket, 0)
    m.setU16((pPacket + 0x04) >>> 0, 0)
    m.setU8(pPacket, 0x5d)
    m.setU8((pPacket + 0x01) >>> 0, questIdByte)
    m.setU8((pPacket + 0x02) >>> 0, m.u8((pQuest + 0x14) >>> 0))
    m.setU8((pPacket + 0x03) >>> 0, 0)

    const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
    const bDiff = m.u8((game + 0x6d) >>> 0)
    const pPlayerQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
    const pfnStatus = m.u32((pQuest + 0xe8) >>> 0) >>> 0

    if (pfnStatus === 0) {
      QUESTS_ResolveDefaultStatusByte_6FC53A30_113c(
        m,
        pQuest,
        pPlayerQuestFlags,
        (pPacket + 0x03) >>> 0,
      )
    } else {
      m.setU8(pOutByte, 0)
      if (checkIsBadCodePtrW3B3(pfnStatus, hooks) !== 0) {
        throw new D2CommonAssertError('Quests.cpp', 0x595)
      }
      const pQuestCtrl = m.u32((game + 0x10f4) >>> 0) >>> 0
      const pGameQuestFlags = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0
      let statusHandled = 0
      if (hooks !== undefined && hooks.onQuestStatus !== undefined) {
        statusHandled =
          hooks.onQuestStatus(m, pfnStatus, pQuest, player, pGameQuestFlags, pPlayerQuestFlags, pOutByte) &
          0xff
      } else if (k4QuestStatusFilterDispatcher !== null) {
        statusHandled =
          k4QuestStatusFilterDispatcher(
            m,
            pfnStatus,
            pQuest,
            player,
            pGameQuestFlags,
            pPlayerQuestFlags,
            pOutByte,
          ) & 0xff
      }
      if (statusHandled === 1) {
        m.setU8((pPacket + 0x03) >>> 0, m.u8(pOutByte))
      }
    }

    const nSeqId = m.u32((pQuest + 0xe0) >>> 0) >>> 0
    if (nSeqId === 1) {
      const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
      m.setU16((pPacket + 0x04) >>> 0, m.u16((pQuestDataEx + 0x88) >>> 0))
    } else if (nSeqId === 0x24) {
      const wRem = ACT5Q2_CalcRemainingSoldiersCount_6FC76B80_113c(m, pQuest) & 0xffff
      m.setU16((pPacket + 0x04) >>> 0, wRem)
    }

    NET_SendPacketBuffer6B_6FCAACD0_113c(m, pPacket, pClient)
  } finally {
    k2W3B3StackPtr = savedSp
  }
}

/**
 * Synchronizes player quest log packet `0x28`, optional quest extra info packet `0x50` (Den of Evil
 * monster count, Tal Rasha tomb offset, Act 5 prison soldiers remaining), and full 42-byte `0x52`
 * quest status array to `pPlayerUnit`'s client (`[esp+4] = pGame`, `[esp+8] = pPlayerUnit`, `ret 8`).
 *
 * @va D2Game:0x6FC55640
 */
export function QUESTS_SendQuestLogPackets50And52_6FC55640_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  hooks?: K2W3B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC55640)
  const game = pGame >>> 0
  const player = pPlayerUnit >>> 0
  QUESTS_SendPlayerQuestLogPacket28_113c(m, player, game)

  let pClient = 0
  if (player !== 0 && m.u32(player) === 0) {
    const pPlayerData0 = UNITS_GetPlayerData113c(m, player) >>> 0
    pClient = m.u32((pPlayerData0 + 0x9c) >>> 0) >>> 0
  }

  const pQuestCtrl = m.u32((game + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return

  const savedSp = k2W3B3StackPtr
  const pPacket50 = savedSp
  const pPacket52 = (savedSp + 0x10) >>> 0
  const pOutByte = (savedSp + 0x3c) >>> 0
  k2W3B3StackPtr = (savedSp + 0x40) >>> 0
  try {
    m.fill(pPacket52, 0x2a, 0)
    m.setU8(pPacket52, 0x52)

    let pQuest = m.u32(pQuestCtrl) >>> 0
    const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
    const bDiff = m.u8((game + 0x6d) >>> 0)
    const pPlayerQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0

    while (pQuest !== 0) {
      if ((readI32(m, pQuest) | 0) >= 0x29) {
        throw new D2CommonAssertError('Quests.cpp', 0x4b3)
      }
      if (m.u8((pQuest + 0x0b) >>> 0) !== 0) {
        const pfnStatus = m.u32((pQuest + 0xe8) >>> 0) >>> 0
        if (pfnStatus === 0) {
          const nSeqId = m.u32((pQuest + 0xe0) >>> 0) >>> 0
          QUESTS_ResolveDefaultStatusByte_6FC53A30_113c(
            m,
            pQuest,
            pPlayerQuestFlags,
            (pPacket52 + 1 + nSeqId) >>> 0,
          )
        } else {
          if (checkIsBadCodePtrW3B3(pfnStatus, hooks) !== 0) {
            throw new D2CommonAssertError('Quests.cpp', 0x4cb)
          }
          const pGameQuestFlags = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0
          let statusHandled = 0
          if (hooks !== undefined && hooks.onQuestStatus !== undefined) {
            statusHandled =
              hooks.onQuestStatus(
                m,
                pfnStatus,
                pQuest,
                player,
                pGameQuestFlags,
                pPlayerQuestFlags,
                pOutByte,
              ) & 0xff
          }
          if (statusHandled === 1) {
            const nSeqId = m.u32((pQuest + 0xe0) >>> 0) >>> 0
            m.setU8((pPacket52 + 1 + nSeqId) >>> 0, m.u8(pOutByte))
          }
        }
      }
      pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    }

    m.fill(pPacket50, 0x10, 0)
    let bSend50 = 0

    if (m.u8((pPacket52 + 0x02) >>> 0) !== 0) {
      let q = m.u32(pQuestCtrl) >>> 0
      while (q !== 0) {
        if ((m.u32(q) >>> 0) === 1) {
          const pQuestDataEx = m.u32((q + 0x18) >>> 0) >>> 0
          bSend50 = 1
          m.setU16((pPacket50 + 0x03) >>> 0, m.u16((pQuestDataEx + 0x88) >>> 0))
          break
        }
        q = m.u32((q + 0xf4) >>> 0) >>> 0
      }
    }

    if (m.u8((pPacket52 + 0x25) >>> 0) !== 0) {
      let q = m.u32(pQuestCtrl) >>> 0
      while (q !== 0) {
        if ((m.u32(q) >>> 0) === 0x20) {
          bSend50 = 1
          const wSoldiers = ACT5Q2_CalcRemainingSoldiersCount_6FC76B80_113c(m, q) & 0xffff
          m.setU16((pPacket50 + 0x07) >>> 0, wSoldiers)
          break
        }
        q = m.u32((q + 0xf4) >>> 0) >>> 0
      }
    }

    if (
      DRLGWARP_TestRoomTileBit113c(m, pPlayerQuestFlags, 0x0c, 0) !== 0 ||
      DRLGWARP_TestRoomTileBit113c(m, pPlayerQuestFlags, 0x0c, 0x0d) !== 0
    ) {
      const pAct2 = m.u32((game + 0xc0) >>> 0) >>> 0
      if (pAct2 !== 0) {
        const wTombIdx = (DRLGLOGIC_GetBossTombLevel113c(m, pAct2) - 0x42) & 0xffff
        m.setU16((pPacket50 + 0x05) >>> 0, wTombIdx)
        bSend50 = 1
      }
    }

    if (bSend50 !== 0) {
      m.setU8(pPacket50, 0x50)
      m.setU16((pPacket50 + 0x01) >>> 0, 1)
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPacket50, 0x0f)
    }

    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPacket52, 0x2a)
  } finally {
    k2W3B3StackPtr = savedSp
  }
}

/**
 * Attaches `pUnit` (`eax`) to quest `nQuestId` (`ebx`) in `pGame` (`[esp+4]`), recording the
 * Inifuss Tree object GUID when `nQuestId == 4`, `pUnit->dwUnitType == 2`, and `pUnit->dwClassId == 0x3D` (`ret 4`).
 *
 * @va D2Game:0x6FC55890
 */
export function QUESTS_AttachUnitToQuest_6FC55890_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nQuestId: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC55890)
  const qId = nQuestId | 0
  if (qId < 0) {
    throw new D2CommonAssertError('Quests.cpp', 0xe0)
  }
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const pQuest = QUESTS_GetQuestData_6FC53F30_113c(m, game, qId) >>> 0
  if (pQuest === 0) return 0

  const nUnitType = unit !== 0 ? m.u32(unit) >>> 0 : 6
  if (qId === 4 && nUnitType === 2 && unit !== 0 && (m.u32((unit + 0x04) >>> 0) >>> 0) === 0x3d) {
    ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c(m, pQuest, unit)
  }
  return QUESTS_AttachQuestToUnit_6FC53F80_113c(m, pQuest, unit, game) | 0
}

/**
 * Allocates a `D2TextHeaderStrc` for NPC interaction (`eax = pNpcUnit`, `ecx = pPlayerUnit`,
 * `[esp+4] = pGame`), fires quest callback `0` (`QUESTS_TriggerCallback00_6FC54660_113c`), queues
 * 40-byte packet `0x27` (`TEXT_BuildMessageList113c`), frees the text list, and syncs packet `0x29` (`ret 4`).
 *
 * @va D2Game:0x6FC55910
 */
export function QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
  m: D2KernMemory113c,
  pNpcUnit: number,
  pPlayerUnit: number,
  pGame: number,
  hooks?: K2W3B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC55910)
  const npc = pNpcUnit >>> 0
  const player = pPlayerUnit >>> 0
  const game = pGame >>> 0
  const pMemPool = m.u32((game + 0x1c) >>> 0) >>> 0
  const pTextHeader = TEXT_AllocTextList113c(m, pMemPool) >>> 0

  let pClient = 0
  if (player !== 0 && m.u32(player) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }

  QUESTS_TriggerCallback00_6FC54660_113c(
    m,
    pClient,
    player,
    npc,
    pTextHeader,
    hooks !== undefined ? hooks.laneK : undefined,
  )

  const savedSp = k2W3B3StackPtr
  const pPacket27 = savedSp
  k2W3B3StackPtr = (savedSp + 0x30) >>> 0
  try {
    m.fill(pPacket27, 0x28, 0)
    m.setU8(pPacket27, 0x27)
    const dwNpcGuid = npc !== 0 ? m.u32((npc + 0x0c) >>> 0) >>> 0 : 0xffffffff
    m.setU32((pPacket27 + 0x02) >>> 0, dwNpcGuid)
    const nNpcType = npc !== 0 ? m.u32(npc) & 0xff : 6
    m.setU8((pPacket27 + 0x01) >>> 0, nNpcType)
    TEXT_BuildMessageList113c(m, pTextHeader, (pPacket27 + 0x06) >>> 0)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPacket27, 0x28)
  } finally {
    k2W3B3StackPtr = savedSp
  }

  TEXT_FreeTextList113c(m, pTextHeader)
  QUESTS_SendGameQuestStatePacket29_6FC55030_113c(m, game, pClient)
}

/**
 * Packs and queues 26-byte packet `0x91` (NPC intro flags for `nAct` in `bl`) for `pPlayerUnit`
 * (`eax`) in `pGame` (`[esp+4]`) when `QUESTS_PackNpcIntroFlags_6FC54C70_113c` returns non-zero (`ret 4`).
 *
 * @va D2Game:0x6FC55B60
 */
export function QUESTS_SendNpcIntroPacket91_6FC55B60_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  nAct: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC55B60)
  const player = pPlayerUnit >>> 0
  const game = pGame >>> 0
  const actIdx = nAct & 0xff
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const bDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestIntro = m.u32((pPlayerData + bDiff * 4 + 0x60) >>> 0) >>> 0

  if (actIdx > 4 || actIdx === 3) return
  ensureActNpcIntroArraysSeeded113c(m)

  let pNpcIds = 0
  let nCount = 0
  if (actIdx === 0) {
    pNpcIds = D2GAME_ACT1_NPC_INTRO_IDS_VA_113C
    nCount = 6
  } else if (actIdx === 1) {
    pNpcIds = D2GAME_ACT2_NPC_INTRO_IDS_VA_113C
    nCount = 11
  } else if (actIdx === 2) {
    pNpcIds = D2GAME_ACT3_NPC_INTRO_IDS_VA_113C
    nCount = 7
  } else {
    pNpcIds = D2GAME_ACT5_NPC_INTRO_IDS_VA_113C
    nCount = 7
  }

  const savedSp = k2W3B3StackPtr
  const pPacket91 = savedSp
  k2W3B3StackPtr = (savedSp + 0x20) >>> 0
  try {
    m.fill(pPacket91, 0x1a, 0)
    // 0x6FC55BA9 passes pPacket91 (+0x00); QUESTS_PackNpcIntroFlags_6FC54C70 adds +2 internally (0x6FC54C73).
    const packed = QUESTS_PackNpcIntroFlags_6FC54C70_113c(
      m,
      pPacket91,
      pNpcIds,
      pQuestIntro,
      nCount,
    )
    if (packed === 0) return

    m.setU8(pPacket91, 0x91)
    m.setU8((pPacket91 + 0x01) >>> 0, actIdx)
    let pClient = 0
    if (player !== 0 && m.u32(player) === 0) {
      const pPlayerData2 = UNITS_GetPlayerData113c(m, player) >>> 0
      pClient = m.u32((pPlayerData2 + 0x9c) >>> 0) >>> 0
    }
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPacket91, 0x1a)
  } finally {
    k2W3B3StackPtr = savedSp
  }
}

/**
 * Sets act-specific NPC intro flags (`QUESTS_SetNpcIntroFlags_6FC54D00_113c`) on `pPlayerUnit`
 * (`eax`) in `pGame` (`edx`) for `nAct` (`cl`).
 *
 * @va D2Game:0x6FC55C20
 */
export function QUESTS_ApplyActNpcIntroFlags_6FC55C20_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  nAct: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC55C20)
  const actIdx = nAct & 0xff
  if (actIdx > 4 || actIdx === 3) return
  ensureActNpcIntroArraysSeeded113c(m)

  const player = pPlayerUnit >>> 0
  const game = pGame >>> 0
  if (actIdx === 0) {
    QUESTS_SetNpcIntroFlags_6FC54D00_113c(m, player, 6, game, D2GAME_ACT1_NPC_INTRO_IDS_VA_113C)
  } else if (actIdx === 1) {
    QUESTS_SetNpcIntroFlags_6FC54D00_113c(m, player, 11, game, D2GAME_ACT2_NPC_INTRO_IDS_VA_113C)
  } else if (actIdx === 2) {
    QUESTS_SetNpcIntroFlags_6FC54D00_113c(m, player, 7, game, D2GAME_ACT3_NPC_INTRO_IDS_VA_113C)
  } else {
    QUESTS_SetNpcIntroFlags_6FC54D00_113c(m, player, 7, game, D2GAME_ACT5_NPC_INTRO_IDS_VA_113C)
  }
}

/**
 * Scales `pMissile`'s `STAT_COLDLENGTH` (`0x38`) by `max(0, pMissilesTxt->dwElemLen)` (`+0x78`) / `100`
 * and writes `dwColdLen` (`+0x34`) and `dwFreezeLen = 0` (`+0x30`) into `pDamage` (`[esp+8]`, `ret 8`).
 *
 * @va D2Game:0x6FC59080
 */
export function MISSILES_ApplyColdLengthToDamage_6FC59080_113c(
  m: D2KernMemory113c,
  pMissile: number,
  _pUnit: number,
  pDamage: number,
): void {
  hitD2GameVa113c(0x6FC59080)
  const missile = pMissile >>> 0
  if (missile === 0) return
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return

  const esi = STATLIST_GetUnitStat113c(m, missile, 0x38, 0) | 0
  const rawElemLen = readI32(m, (pMissilesTxt + 0x78) >>> 0)
  const ecx = rawElemLen < 0 ? 0 : rawElemLen
  const dmg = pDamage >>> 0

  let outColdLen: number
  if (esi > 0x100000) {
    if (((esi & ~0x0f) | 0) >= 0x640) {
      outColdLen = imul32(div100SignedMagic113c(esi), ecx)
    } else {
      outColdLen = Number((BigInt(ecx) * BigInt(esi)) / 100n) | 0
    }
  } else if (ecx > 0x10000) {
    if (((ecx & ~0x0f) | 0) >= 0x640) {
      outColdLen = imul32(div100SignedMagic113c(ecx), esi)
    } else {
      outColdLen = Number((BigInt(ecx) * BigInt(esi)) / 100n) | 0
    }
  } else {
    outColdLen = div100SignedMagic113c(imul32(ecx, esi))
  }

  m.setU32((dmg + 0x34) >>> 0, outColdLen >>> 0)
  m.setU32((dmg + 0x30) >>> 0, 0)
}

/**
 * Initializes total/remaining frames and dynamic path target on `pMissile` (`esi`) toward
 * `pTargetUnit` (`[esp+4]`, or offset coordinates from `MISSILE_GetTargetY113c` when `pTargetUnit`
 * is null/dead), computing the path immediately when distance `< 25` (`ret 4`).
 *
 * @va D2Game:0x6FC597C0
 */
export function MISSILES_InitGuidedOrLinearPath_6FC597C0_113c(
  m: D2KernMemory113c,
  pMissile: number,
  pTargetUnit: number,
): void {
  hitD2GameVa113c(0x6FC597C0)
  const missile = pMissile >>> 0
  if (missile === 0) return
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return

  let target = pTargetUnit >>> 0
  if (target !== 0 && SUNIT_IsDeadOrDying113c(m, target) !== 0) {
    target = 0
  }

  const nLevel = MISSILE_GetLevel113c(m, missile) | 0
  const wLevRange = sx16(m.u16((pMissilesTxt + 0x98) >>> 0))
  const wRange = sx16(m.u16((pMissilesTxt + 0x96) >>> 0))
  const nFrames = (imul32((nLevel - 1) | 0, wLevRange) + wRange) | 0
  MISSILE_SetTotalFrames113c(m, missile, nFrames)
  MISSILE_SetRemainingFrames113c(m, missile, nFrames)

  const pPath = m.u32((missile + 0x2c) >>> 0) >>> 0
  let nDist: number
  if (target !== 0) {
    PATH_SetTargetUnit113c(m, pPath, target)
    MISSILE_SetTargetX113c(m, missile, 5)
    nDist = UNITS_GetApproximateDistance113c(m, missile, target) | 0
  } else {
    const packedOffset = MISSILE_GetTargetY113c(m, missile) >>> 0
    const dx = sx16(packedOffset & 0xffff)
    const dy = sx16(packedOffset >>> 16)

    const uType1 = readI32(m, missile)
    let curX = 0
    if (uType1 === 2 || (uType1 > 3 && uType1 <= 5)) {
      const pStatic = m.u32((missile + 0x2c) >>> 0) >>> 0
      curX = readI32(m, (pStatic + 0x0c) >>> 0)
    } else {
      const pDyn = m.u32((missile + 0x2c) >>> 0) >>> 0
      curX = pDyn !== 0 ? PATH_GetPosX113c(m, pDyn) | 0 : 0
    }
    const targetX = (dx + curX) | 0

    const uType2 = readI32(m, missile)
    let curY = 0
    if (uType2 === 2 || (uType2 > 3 && uType2 <= 5)) {
      const pStatic = m.u32((missile + 0x2c) >>> 0) >>> 0
      curY = readI32(m, (pStatic + 0x10) >>> 0)
    } else {
      const pDyn = m.u32((missile + 0x2c) >>> 0) >>> 0
      curY = pDyn !== 0 ? PATH_GetPosY113c(m, pDyn) | 0 : 0
    }
    const targetY = (dy + curY) | 0

    PATH_SetTargetPos113c(m, pPath, targetX, targetY)
    MISSILE_SetTargetX113c(m, missile, 6)
    nDist = UNITS_GetUnitDistanceToCoordinates113c(m, missile, targetX, targetY) | 0
  }

  if (nDist < 0x19) {
    PATH_Compute113c(m, pPath, missile, 0)
  }
}

/**
 * Evaluates `pMissilesTxt->dwDmgCalc1 (+0x90)` via `MISSILE_ResolveSkillIdByCodeOrRef113c` (`1..100%`)
 * and converts that percentage of `pDamage->dwPhysDamage (+0x08)` into elemental damage via
 * `MISSILES_AddElemDamageByEType_6FC59260_113c` (`ecx = pGame`, `edx = pMissile`, `[esp+8] = pDamage`, `ret 8`).
 *
 * @va D2Game:0x6FC59CE0
 */
export function MISSILES_ConvertPhysToElemDamageByCalc_6FC59CE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pTarget: number,
  pDamage: number,
): void {
  hitD2GameVa113c(0x6FC59CE0)
  const missile = pMissile >>> 0
  if (missile === 0) return
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return

  let pOwner = 0
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
    const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
    pOwner = SUNIT_GetServerUnit113c(m, pGame >>> 0, ownerType, ownerId) >>> 0
  }

  const dwCalc = m.u32((pMissilesTxt + 0x90) >>> 0) >>> 0
  let nPct = MISSILE_ResolveSkillIdByCodeOrRef113c(m, missile, pOwner, dwCalc, -1, -1) | 0
  if (nPct <= 0) return
  if (nPct >= 100) {
    nPct = 100
  }

  const dmg = pDamage >>> 0
  const nPhys = readI32(m, (dmg + 0x08) >>> 0)
  let nConvert = mulDiv113c(nPhys, nPct, 100) | 0
  if (nConvert >= nPhys) {
    nConvert = nPhys
  }
  m.setU32((dmg + 0x08) >>> 0, (nPhys - nConvert) >>> 0)
  MISSILES_AddElemDamageByEType_6FC59260_113c(m, missile, dmg, nConvert)
}

/**
 * `Missiles.txt` `pSrvDmgFunc` 5 (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTargetUnit`, `ret 4`):
 * binds `pTargetUnit` onto `pMissile` and dispatches `pMissilesTxt->wSrvDmgFunc (+0x4C)` as a skill
 * `SrvDoFunc` via `SKILLS_DispatchSrvDoFunc_6FCBE420_113c`.
 *
 * @va D2Game:0x6FC59DA0
 */
export function MISSILES_SrvDmg05_DispatchSkillSrvDo_6FC59DA0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC59DA0)
  const missile = pMissile >>> 0
  if (missile === 0) return 1
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 1

  const nSkillId = MISSILE_GetSkill113c(m, missile) | 0
  const nLevel = MISSILE_GetLevel113c(m, missile) | 0
  if (nSkillId > 0 && nLevel > 0) {
    const game = pGame >>> 0
    const pOwner = SUNIT_GetOwnerUnit113c(m, missile, game) >>> 0
    if (pOwner !== 0) {
      const target = pTargetUnit >>> 0
      if (target !== 0) {
        UNITS_SetTargetUnitForDynamicUnit113c(m, missile, target)
      }
      const nSrvDoFunc = readI32(m, (pMissilesTxt + 0x4c) >>> 0)
      SKILLS_DispatchSrvDoFunc_6FCBE420_113c(
        m,
        nSrvDoFunc,
        game,
        missile,
        nSkillId,
        nLevel,
        hooks !== undefined ? hooks.w2b4 : undefined,
      )
    }
  }
  return 1
}

/**
 * `Missiles.txt` `pSrvDmgFunc` 14 (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTargetUnit`, `ret 4`):
 * rolls skill physical min..max healing on `pMissile`'s seed (`+0x20`), applies monster skill icon
 * (`pMissilesTxt->wProgOverlay` at `+0x36`) when `pTargetUnit` is below max life, clamps and writes
 * `STAT_HITPOINTS (6)`, and returns `pMissilesTxt->bPierce (+0x186) != 0`.
 *
 * @va D2Game:0x6FC59E30
 */
export function MISSILES_SrvDmg14_HolyBoltHeal_6FC59E30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit: number,
): number {
  hitD2GameVa113c(0x6FC59E30)
  const missile = pMissile >>> 0
  if (missile === 0) return 1
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  const target = pTargetUnit >>> 0
  if (pMissilesTxt === 0 || target === 0) return 1

  const nSkillId = MISSILE_GetSkill113c(m, missile) | 0
  const nLevel = MISSILE_GetLevel113c(m, missile) | 0
  if (getSkillsTxtRecordInline113c(m, nSkillId) === 0) return 1

  const game = pGame >>> 0
  const pOwnerMin = SUNIT_GetOwnerUnit113c(m, missile, game) >>> 0
  const nMinHeal = SKILLS_GetSkillPhysMinDamage113c(m, pOwnerMin, nSkillId, nLevel, 1) | 0
  const pOwnerMax = SUNIT_GetOwnerUnit113c(m, missile, game) >>> 0
  const nMaxHeal = SKILLS_GetSkillPhysMaxDamage113c(m, pOwnerMax, nSkillId, nLevel, 1) | 0

  const nRoll = SEED_RollLimitedFast113c(m, (missile + 0x20) >>> 0, (nMaxHeal - nMinHeal) | 0) | 0
  const nHeal = (nRoll + nMinHeal) | 0
  const nCurLife = STATLIST_GetUnitStat113c(m, target, 6, 0) | 0
  const nMaxLife = STATLIST_GetMaxLifeFromUnit113c(m, target) | 0

  if (nCurLife !== nMaxLife) {
    const wProgOverlay = sx16(m.u16((pMissilesTxt + 0x36) >>> 0))
    if (wProgOverlay > 0) {
      STATES_SetMonsterSkillIconOnUnit113c(m, target, wProgOverlay, 0)
    }
  }

  let nNewLife = (nCurLife + nHeal) | 0
  if (nNewLife >= nMaxLife) {
    nNewLife = nMaxLife
  }
  STATLIST_SetUnitStat113c(m, target, 6, nNewLife, 0)
  return m.u8((pMissilesTxt + 0x186) >>> 0) !== 0 ? 1 : 0
}

const PLAGUE_JAVELIN_8WAY_Y_113C: readonly number[] = [0, 16, 16, 16, 0, -16, -16, -16]
const PLAGUE_JAVELIN_8WAY_X_113C: readonly number[] = [16, 16, 0, -16, -16, -16, 0, 16]

const NOVA64_Y_113C: readonly number[] = [
  0, 2, 5, 8, 11, 14, 16, 19, 21, 23, 24, 26, 27, 28, 29, 29,
  30, 29, 29, 28, 27, 26, 24, 23, 21, 19, 16, 14, 11, 8, 5, 2,
  0, -2, -5, -8, -11, -14, -16, -19, -21, -23, -24, -26, -27, -28, -29, -29,
  -30, -29, -29, -28, -27, -26, -24, -23, -21, -19, -16, -14, -11, -8, -5, -2,
]

const NOVA64_X_113C: readonly number[] = [
  30, 29, 29, 28, 27, 26, 24, 23, 21, 19, 16, 14, 11, 8, 5, 2,
  0, -2, -5, -8, -11, -14, -16, -19, -21, -23, -24, -26, -27, -28, -29, -29,
  -30, -29, -29, -28, -27, -26, -24, -23, -21, -19, -16, -14, -11, -8, -5, -2,
  0, 2, 5, 8, 11, 14, 16, 19, 21, 23, 24, 26, 27, 28, 29, 29,
]

const RADIAL8_Y_113C: readonly number[] = [2, 2, 0, -2, -2, -2, 0, 2]
const RADIAL8_X_113C: readonly number[] = [0, 2, 2, 2, 0, -2, -2, -2]

function rollSeedAtPtr113c(m: Memory113c, pSeed: number, nMax: number): number {
  const addr = pSeed >>> 0
  const s = {
    lo: m.u32(addr) >>> 0,
    hi: m.u32((addr + 0x04) >>> 0) >>> 0,
  }
  const res = seedRoll(s, nMax) | 0
  m.setU32(addr, s.lo >>> 0)
  m.setU32((addr + 0x04) >>> 0, s.hi >>> 0)
  return res
}

function readUnitPosXInline113c(m: Memory113c, pUnit: number): number {
  const unit = pUnit >>> 0
  const uType = readI32(m, unit)
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    const pStatic = m.u32((unit + 0x2c) >>> 0) >>> 0
    return readI32(m, (pStatic + 0x0c) >>> 0)
  }
  const pDyn = m.u32((unit + 0x2c) >>> 0) >>> 0
  return pDyn !== 0 ? PATH_GetPosX113c(m, pDyn) | 0 : 0
}

function readUnitPosYInline113c(m: Memory113c, pUnit: number): number {
  const unit = pUnit >>> 0
  const uType = readI32(m, unit)
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    const pStatic = m.u32((unit + 0x2c) >>> 0) >>> 0
    return readI32(m, (pStatic + 0x10) >>> 0)
  }
  const pDyn = m.u32((unit + 0x2c) >>> 0) >>> 0
  return pDyn !== 0 ? PATH_GetPosY113c(m, pDyn) | 0 : 0
}

/**
 * `Missiles.txt` `pSrvDmgFunc` 15 (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTargetUnit`, `ret 4`):
 * heals friendly pet/party targets when `pMissilesTxt->dwParam1 (+0x4C) != 0` (rolling
 * `pSkillsTxt->dwCalc1..dwCalc2` at `+0x138..+0x13C` << 8, or `MISSILE_RollMasteryStatRange113c` fallback),
 * or returns `3` (apply damage) / `4` (pass through) based on `pMissilesTxt->dwParam2 (+0x50)` and
 * undead/demon monster flags.
 *
 * @va D2Game:0x6FC59FD0
 */
export function MISSILES_SrvDmg15_HolyBoltHealOrUndeadFilter_6FC59FD0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit: number,
): number {
  hitD2GameVa113c(0x6FC59FD0)
  const missile = pMissile >>> 0
  if (missile === 0) return 1
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 1
  const target = pTargetUnit >>> 0
  if (target === 0) return 1

  const game = pGame >>> 0
  const nSkillId = MISSILE_GetSkill113c(m, missile) | 0
  const nLevel = MISSILE_GetLevel113c(m, missile) | 0
  let pOwner = 0
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
    const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
    pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  }

  if (readI32(m, (pMissilesTxt + 0x4c) >>> 0) !== 0 && pOwner !== 0) {
    if (
      SUNIT_CanTargetOwnPetWithSkill113c(m, pOwner, target, nSkillId) !== 0 ||
      SUNIT_CanPlayerTargetUnitWithSkill113c(m, target, game, pOwner, nSkillId) !== 0
    ) {
      const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
      if (pSkillsTxt === 0) return 1
      const dwCalc1 = m.u32((pSkillsTxt + 0x138) >>> 0) >>> 0
      const nMinHeal =
        (SKILLS_EvalCalcByOffset113c(m, pOwner, dwCalc1, nSkillId, nLevel) << 8) | 0
      const dwCalc2 = m.u32((pSkillsTxt + 0x13c) >>> 0) >>> 0
      const nMaxHeal =
        (SKILLS_EvalCalcByOffset113c(m, pOwner, dwCalc2, nSkillId, nLevel) << 8) | 0
      const nRoll =
        SEED_RollLimitedFast113c(m, (missile + 0x20) >>> 0, (nMaxHeal - nMinHeal) | 0) | 0
      let nHeal = (nRoll + nMinHeal) | 0
      if (nHeal <= 0) {
        nHeal = MISSILE_RollMasteryStatRange113c(m, 0x16, -1, missile, 0x15) | 0
      }

      const nCurLife = STATLIST_GetUnitStat113c(m, target, 6, 0) | 0
      let nNewLife = (nCurLife + nHeal) | 0
      const nMaxLife = STATLIST_GetMaxLifeFromUnit113c(m, target) | 0
      if (nNewLife >= nMaxLife) {
        nNewLife = nMaxLife
      }
      STATLIST_SetUnitStat113c(m, target, 6, nNewLife, 0)

      const wProgOverlay = sx16(m.u16((pMissilesTxt + 0x36) >>> 0))
      if (wProgOverlay > 0) {
        STATES_SetMonsterSkillIconOnUnit113c(m, target, wProgOverlay, 0)
      }
      return 1
    }
  }

  const uType = readI32(m, target)
  if (uType === 0) {
    return readI32(m, (pMissilesTxt + 0x50) >>> 0) === 0 ? 3 : 4
  }
  if (uType !== 1) {
    return 4
  }

  const nFilterMode = readI32(m, (pMissilesTxt + 0x50) >>> 0)
  if (nFilterMode === 0) {
    return 3
  }
  if (nFilterMode === 2) {
    return MONSTER_CheckMonTypeFlag0x20_113c(m, target) !== 0 ? 3 : 4
  }
  return MONSTERS_IsDemonOrUndead113c(m, target) !== 0 ? 3 : 4
}

/**
 * Populates the elemental or physical damage fields on `pDamage` (`esi`) from `pMissile` (`edi`)
 * and `pTargetUnit` (`[esp+4]`) according to `MISSILE_GetHitShiftFromId113c(m, pMissile->dwClassId)`
 * (`0..12`, `ret 4`).
 *
 * @va D2Game:0x6FC5A280
 */
export function MISSILES_PopulateDamageByEType_6FC5A280_113c(
  m: D2KernMemory113c,
  pMissile: number,
  pDamage: number,
  pTargetUnit: number,
): number {
  hitD2GameVa113c(0x6FC5A280)
  const missile = pMissile >>> 0
  if (missile === 0) return 0
  const dmg = pDamage >>> 0
  const target = pTargetUnit >>> 0
  const nEType = MISSILE_GetHitShiftFromId113c(m, readI32(m, (missile + 0x04) >>> 0)) & 0xff

  switch (nEType) {
    case 0: {
      const basePhys = MISSILE_RollMasteryStatRange113c(m, 0x16, -1, missile, 0x15) | 0
      m.setU32((dmg + 0x08) >>> 0, basePhys >>> 0)
      if (target !== 0) {
        let nPct = STATLIST_GetUnitStat113c(m, missile, 0x19, 0) | 0
        if (MONSTER_CheckMonTypeFlag0x20_113c(m, target) !== 0) {
          nPct = (nPct + (STATLIST_GetUnitStat113c(m, missile, 0x79, 0) | 0)) | 0
        }
        if (MONSTERS_IsDemonOrUndead113c(m, target) !== 0) {
          nPct = (nPct + (STATLIST_GetUnitStat113c(m, missile, 0x7a, 0) | 0)) | 0
        }
        if (nPct <= -90) {
          nPct = -90
        }
        const curPhys = readI32(m, (dmg + 0x08) >>> 0)
        const bonus = div100SignedMagic113c(imul32(curPhys, nPct))
        m.setU32((dmg + 0x08) >>> 0, (curPhys + bonus) >>> 0)
      }
      if (STATLIST_GetUnitStat113c(m, missile, 0x8d, 0) !== 0) {
        const doubled = (readI32(m, (dmg + 0x08) >>> 0) << 1) >>> 0
        m.setU8((dmg + 0x05) >>> 0, (m.u8((dmg + 0x05) >>> 0) | 0x20) & 0xff)
        m.setU32((dmg + 0x08) >>> 0, doubled)
      }
      return readI32(m, (dmg + 0x08) >>> 0)
    }
    case 1: {
      const val = MISSILE_RollMasteryStatRange113c(m, 0x31, 0x149, missile, 0x30) | 0
      m.setU32((dmg + 0x10) >>> 0, val >>> 0)
      return val
    }
    case 2: {
      const val = MISSILE_RollMasteryStatRange113c(m, 0x33, 0x14a, missile, 0x32) | 0
      m.setU32((dmg + 0x1c) >>> 0, val >>> 0)
      return val
    }
    case 3: {
      const val = MISSILE_RollMasteryStatRange113c(m, 0x35, 0x165, missile, 0x34) | 0
      m.setU32((dmg + 0x20) >>> 0, val >>> 0)
      return val
    }
    case 4: {
      const val = MISSILE_RollMasteryStatRange113c(m, 0x37, 0x14b, missile, 0x36) | 0
      m.setU32((dmg + 0x24) >>> 0, val >>> 0)
      const len = STATLIST_GetUnitStat113c(m, missile, 0x38, 0) | 0
      m.setU32((dmg + 0x30) >>> 0, len >>> 0)
      return readI32(m, (dmg + 0x24) >>> 0)
    }
    case 5: {
      const val = MISSILE_RollMasteryStatRange113c(m, 0x3a, 0x14c, missile, 0x39) | 0
      m.setU32((dmg + 0x28) >>> 0, val >>> 0)
      const len = STATLIST_GetUnitStat113c(m, missile, 0x3b, 0) | 0
      m.setU32((dmg + 0x2c) >>> 0, len >>> 0)
      const cnt = STATLIST_GetUnitStat113c(m, missile, 0x146, 0) | 0
      if (cnt > 1) {
        const divLen = (readI32(m, (dmg + 0x2c) >>> 0) / cnt) | 0
        m.setU32((dmg + 0x2c) >>> 0, divLen >>> 0)
      }
      return imul32(readI32(m, (dmg + 0x28) >>> 0), 0x19)
    }
    case 6: {
      const val = STATLIST_GetUnitStat113c(m, missile, 0x3c, 0) >>> 0
      m.setU32((dmg + 0x38) >>> 0, val)
      return 0
    }
    case 7: {
      const val = STATLIST_GetUnitStat113c(m, missile, 0x3e, 0) >>> 0
      m.setU32((dmg + 0x3c) >>> 0, val)
      return 0
    }
    case 8: {
      const val = STATLIST_GetUnitStat113c(m, missile, 0x40, 0) >>> 0
      m.setU32((dmg + 0x40) >>> 0, val)
      return 0
    }
    case 9: {
      const val = STATLIST_GetUnitStat113c(m, missile, 0x42, 0) >>> 0
      m.setU32((dmg + 0x44) >>> 0, val)
      return 0
    }
    case 10:
      return 0
    case 11: {
      const val = MISSILE_RollMasteryStatRange113c(m, 0x13d, 0x149, missile, 0x13c) | 0
      m.setU32((dmg + 0x14) >>> 0, val >>> 0)
      const len = STATLIST_GetUnitStat113c(m, missile, 0x13b, 0) | 0
      m.setU32((dmg + 0x18) >>> 0, len >>> 0)
      return imul32(readI32(m, (dmg + 0x14) >>> 0), 0x19)
    }
    case 12: {
      const val = MISSILE_RollMasteryStatRange113c(m, 0x37, 0x14b, missile, 0x36) | 0
      m.setU32((dmg + 0x24) >>> 0, val >>> 0)
      const len = STATLIST_GetUnitStat113c(m, missile, 0x38, 0) | 0
      m.setU32((dmg + 0x34) >>> 0, len >>> 0)
      return readI32(m, (dmg + 0x24) >>> 0)
    }
    default:
      return 0
  }
}

/**
 * `Missiles.txt` `pSrvDmgFunc` 9 (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTargetUnit`, `ret 4`):
 * applies the missile skill's aura state (`pSkillsTxt->wAuraState` at `+0x82`) and aura stat calcs
 * (`SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c`) onto `pTargetUnit` when `AURA_CheckUnitMatchesFilterFlags113c` passes.
 *
 * @va D2Game:0x6FC5ABD0
 */
export function MISSILES_SrvDmg09_ApplySkillAuraState_6FC5ABD0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit: number,
): number {
  hitD2GameVa113c(0x6FC5ABD0)
  const missile = pMissile >>> 0
  if (missile === 0) return 1
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1

  const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
  const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
  const pOwner = SUNIT_GetServerUnit113c(m, pGame >>> 0, ownerType, ownerId) >>> 0
  const target = pTargetUnit >>> 0
  if (pOwner === 0 || target === 0) return 1

  const nSkillId = MISSILE_GetSkill113c(m, missile) | 0
  const nLevel = MISSILE_GetLevel113c(m, missile) | 0
  const pSkillsTxt = getSkillsTxtRecordInline113c(m, nSkillId)
  if (pSkillsTxt === 0) return 1

  const pTables = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pTables !== 0 ? m.u32(pTables) >>> 0 : 0
  const wAuraState = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
  if (wAuraState < 0 || wAuraState > readI32(m, (pDataTables + 0xc4) >>> 0)) {
    return 1
  }

  const dwFilterFlags = m.u32((pSkillsTxt + 0x50) >>> 0) !== 0 ? 0xa783 : 0
  if (AURA_CheckUnitMatchesFilterFlags113c(m, dwFilterFlags, pOwner, target) === 0) {
    return 1
  }

  const dwLenCalc = m.u32((pSkillsTxt + 0x60) >>> 0) >>> 0
  const nLen = SKILLS_EvalCalcByOffset113c(m, pOwner, dwLenCalc, nSkillId, nLevel) | 0

  const savedSp = k2W3B3StackPtr
  const pAuraSetup = savedSp
  k2W3B3StackPtr = (savedSp + 0x24) >>> 0
  try {
    m.fill(pAuraSetup, 0x24, 0)
    m.setU32(pAuraSetup, pOwner)
    m.setU32((pAuraSetup + 0x04) >>> 0, target)
    m.setU32((pAuraSetup + 0x08) >>> 0, nSkillId >>> 0)
    m.setU32((pAuraSetup + 0x0c) >>> 0, nLevel >>> 0)
    m.setU32((pAuraSetup + 0x10) >>> 0, nLen >>> 0)
    m.setU32((pAuraSetup + 0x1c) >>> 0, wAuraState >>> 0)

    const pStatList = STATES_CreateOrUpdateAuraStatList113c(m, pAuraSetup) >>> 0
    if (pStatList !== 0) {
      SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(
        m,
        pSkillsTxt,
        target,
        pStatList,
        nSkillId,
        nLevel,
      )
    }
  } finally {
    k2W3B3StackPtr = savedSp
  }
  return 0
}

/**
 * Target filter callback (`ecx = pTargetUnit`, `edx = pFilterCtx`): accepts players (`dwUnitType == 0`)
 * or friendly-aligned monsters (`dwUnitType == 1` with `UNIT_GetAlignment113c == 2`) that pass
 * `MISSILE_CanCollideWithUnit113c`.
 *
 * @va D2Game:0x6FC5AD70
 */
export function MISSILES_TargetFilter_PlayersAndAlignedMonsters_6FC5AD70_113c(
  m: D2KernMemory113c,
  pTargetUnit: number,
  pFilterCtx: number,
): number {
  hitD2GameVa113c(0x6FC5AD70)
  const ctx = pFilterCtx >>> 0
  if (ctx === 0) return 0
  const pOwner = m.u32((ctx + 0x0c) >>> 0) >>> 0
  if (pOwner === 0) return 0

  const target = pTargetUnit >>> 0
  const uType = target !== 0 ? readI32(m, target) : 6
  if (uType !== 0) {
    if (uType !== 1) return 0
    if ((UNIT_GetAlignment113c(m, target) | 0) !== 2) return 0
  }

  const pGame = m.u32((ctx + 0x04) >>> 0) >>> 0
  const pMissile = m.u32(ctx) >>> 0
  const pMissilesTxt = m.u32((ctx + 0x08) >>> 0) >>> 0
  const canHit = MISSILE_CanCollideWithUnit113c(m, target, pOwner, pMissilesTxt, pGame, pMissile)
  return canHit !== 0 ? 1 : 0
}

/**
 * Target filter callback (`ecx = pTargetUnit`, `edx = pFilterCtx`): accepts only monster units
 * (`dwUnitType == 1`) that pass `MISSILE_CanCollideWithUnit113c`.
 *
 * @va D2Game:0x6FC5ADD0
 */
export function MISSILES_TargetFilter_MonstersOnly_6FC5ADD0_113c(
  m: D2KernMemory113c,
  pTargetUnit: number,
  pFilterCtx: number,
): number {
  hitD2GameVa113c(0x6FC5ADD0)
  const ctx = pFilterCtx >>> 0
  if (ctx === 0) return 0
  const pOwner = m.u32((ctx + 0x0c) >>> 0) >>> 0
  if (pOwner === 0) return 0
  const target = pTargetUnit >>> 0
  if (target === 0 || readI32(m, target) !== 1) return 0

  const pGame = m.u32((ctx + 0x04) >>> 0) >>> 0
  const pMissile = m.u32(ctx) >>> 0
  const pMissilesTxt = m.u32((ctx + 0x08) >>> 0) >>> 0
  const canHit = MISSILE_CanCollideWithUnit113c(m, target, pOwner, pMissilesTxt, pGame, pMissile)
  return canHit !== 0 ? 1 : 0
}

/**
 * `Missiles.txt` `pSrvDmgFunc` 1 (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTargetUnit`, `ret 4`):
 * seeds `pMissile->pSeed (+0x20)` from `UNIT_GetPosX113c(pMissile)`, rolls random `(x, y)` within
 * `±max(1, pMissilesTxt->dwParam1)`, and spawns `pMissilesTxt->wSubMissile1 (+0x24)` with `dwFlags = 0x20`.
 *
 * @va D2Game:0x6FC5BED0
 */
export function MISSILES_SrvDmg01_SpawnRandomOffsetSubMissile_6FC5BED0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pTargetUnit: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5BED0)
  const missile = pMissile >>> 0
  if (missile === 0) return 1
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 1
  if (sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) < 0) return 1
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1

  const game = pGame >>> 0
  const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
  const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
  const pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  if (pOwner === 0) return 1

  const pSeed = (missile + 0x20) >>> 0
  const posX0 = UNIT_GetPosX113c(m, missile) | 0
  SEED_InitLowSeed113c(m, pSeed, posX0)

  const rawRadius = readI32(m, (pMissilesTxt + 0x4c) >>> 0)
  const nRadius = rawRadius < 1 ? 1 : rawRadius
  const curX = UNIT_GetPosX113c(m, missile) | 0
  const curY = UNIT_GetPosY113c(m, missile) | 0
  const span = (nRadius * 2 + 1) | 0
  const rollX = rollSeedAtPtr113c(m, pSeed, span)
  const targetX = (curX - nRadius + rollX) | 0
  const rollY = rollSeedAtPtr113c(m, pSeed, span)
  const targetY = (curY - nRadius + rollY) | 0

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 0x20)
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    m.setU32((pParams + 0x08) >>> 0, missile)
    const nSkillId = MISSILE_GetSkill113c(m, missile) >>> 0
    m.setU32((pParams + 0x2c) >>> 0, nSkillId)
    const nLevel = MISSILE_GetLevel113c(m, missile) >>> 0
    m.setU32((pParams + 0x30) >>> 0, nLevel)
    const nSubMissile = sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) >>> 0
    m.setU32((pParams + 0x10) >>> 0, nSubMissile)
    m.setU32((pParams + 0x1c) >>> 0, targetX >>> 0)
    m.setU32((pParams + 0x20) >>> 0, targetY >>> 0)
    MISSILE_CreateServerProjectile113c(m, game, pParams, hooks)
  } finally {
    k2W3B3StackPtr = savedSp
  }
  return 1
}

/**
 * `Missiles.txt` `pSrvDmgFunc` 2 (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTargetUnit`, `ret 4`):
 * spawns up to 8 radial sub-projectiles (`0x6FD1C470` / `0x6FD1C450`, stride `max(1, dwParam1)`)
 * with `dwFlags = 2` and assigns `MISSILE_SetTargetX113c` / `MISSILE_SetTargetY113c` on each spawned missile.
 *
 * @va D2Game:0x6FC5C030
 */
export function MISSILES_SrvDmg02_PlagueJavelin8WaySubMissiles_6FC5C030_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pTargetUnit: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5C030)
  const missile = pMissile >>> 0
  if (missile === 0) return 1
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 1
  if (sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) < 0) return 1
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1

  const game = pGame >>> 0
  const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
  const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
  const pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  if (pOwner === 0) return 1

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 2)
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    m.setU32((pParams + 0x08) >>> 0, missile)
    const nSkillId = MISSILE_GetSkill113c(m, missile) >>> 0
    m.setU32((pParams + 0x2c) >>> 0, nSkillId)
    const nLevel = MISSILE_GetLevel113c(m, missile) >>> 0
    m.setU32((pParams + 0x30) >>> 0, nLevel)

    const rawStep = readI32(m, (pMissilesTxt + 0x4c) >>> 0)
    const step = rawStep >= 1 ? rawStep : 1
    for (let idx = 0; idx < 8; idx = (idx + step) | 0) {
      const dx = PLAGUE_JAVELIN_8WAY_X_113C[idx] | 0
      const dy = PLAGUE_JAVELIN_8WAY_Y_113C[idx] | 0
      m.setU32((pParams + 0x1c) >>> 0, dx >>> 0)
      m.setU32((pParams + 0x20) >>> 0, dy >>> 0)
      const pSub = MISSILE_CreateServerProjectile113c(m, game, pParams, hooks) >>> 0
      if (pSub !== 0) {
        MISSILE_SetTargetX113c(m, pSub, dx)
        MISSILE_SetTargetY113c(m, pSub, dy)
      }
    }
  } finally {
    k2W3B3StackPtr = savedSp
  }
  return 1
}

/**
 * `Missiles.txt` `pSrvDmgFunc` 3 (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTargetUnit`, `ret 4`):
 * spawns `wSubMissile1 (+0x24)` and optionally `wSubMissile2 (+0x26)` and `wSubMissile3 (+0x28)`
 * from `pMissile`.
 *
 * @va D2Game:0x6FC5C160
 */
export function MISSILES_SrvDmg03_SpawnSubMissiles123_6FC5C160_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pTargetUnit: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5C160)
  const missile = pMissile >>> 0
  if (missile === 0) return 1
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 1
  if (sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) < 0) return 1

  const game = pGame >>> 0
  let pOwner = 0
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
    const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
    pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  }

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    const nSkillId = MISSILE_GetSkill113c(m, missile) >>> 0
    m.setU32((pParams + 0x2c) >>> 0, nSkillId)
    const nLevel = MISSILE_GetLevel113c(m, missile) >>> 0
    m.setU32((pParams + 0x30) >>> 0, nLevel)
    m.setU32((pParams + 0x08) >>> 0, missile)

    const sub1 = sx16(m.u16((pMissilesTxt + 0x24) >>> 0))
    m.setU32((pParams + 0x10) >>> 0, sub1 >>> 0)
    MISSILE_CreateServerProjectile113c(m, game, pParams, hooks)

    const sub2 = sx16(m.u16((pMissilesTxt + 0x26) >>> 0))
    if (sub2 >= 0) {
      m.setU32((pParams + 0x10) >>> 0, sub2 >>> 0)
      MISSILE_CreateServerProjectile113c(m, game, pParams, hooks)
    }

    const sub3 = sx16(m.u16((pMissilesTxt + 0x28) >>> 0))
    if (sub3 >= 0) {
      m.setU32((pParams + 0x10) >>> 0, sub3 >>> 0)
      MISSILE_CreateServerProjectile113c(m, game, pParams, hooks)
    }
  } finally {
    k2W3B3StackPtr = savedSp
  }
  return 1
}

/**
 * `Missiles.txt` `pSrvDmgFunc` 4 (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTargetUnit`, `ret 4`):
 * spawns `wSubMissile1 (+0x24)` at `pMissile`'s current position with `dwFlags = 0x21` and target
 * coordinates set to `PATH_GetFirstPointX113c` / `PATH_GetFirstPointY113c`.
 *
 * @va D2Game:0x6FC5C260
 */
export function MISSILES_SrvDmg04_SpawnSubMissileAlongPath_6FC5C260_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pTargetUnit: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5C260)
  const missile = pMissile >>> 0
  if (missile === 0) return 1
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 1
  if (sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) < 0) return 1

  const curX = readUnitPosXInline113c(m, missile)
  const curY = readUnitPosYInline113c(m, missile)
  const game = pGame >>> 0

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 0x21)
    let pOwner = 0
    if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
      const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
      const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
      pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
    }
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    m.setU32((pParams + 0x14) >>> 0, curX >>> 0)
    m.setU32((pParams + 0x18) >>> 0, curY >>> 0)
    const nSkillId = MISSILE_GetSkill113c(m, missile) >>> 0
    m.setU32((pParams + 0x2c) >>> 0, nSkillId)
    const nLevel = MISSILE_GetLevel113c(m, missile) >>> 0
    m.setU32((pParams + 0x30) >>> 0, nLevel)
    const nSubMissile = sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) >>> 0
    m.setU32((pParams + 0x10) >>> 0, nSubMissile)
    const pPath1 = m.u32((missile + 0x2c) >>> 0) >>> 0
    const firstX = PATH_GetFirstPointX113c(m, pPath1) >>> 0
    m.setU32((pParams + 0x1c) >>> 0, firstX)
    const pPath2 = m.u32((missile + 0x2c) >>> 0) >>> 0
    const firstY = PATH_GetFirstPointY113c(m, pPath2) >>> 0
    m.setU32((pParams + 0x20) >>> 0, firstY)
    MISSILE_CreateServerProjectile113c(m, game, pParams, hooks)
  } finally {
    k2W3B3StackPtr = savedSp
  }
  return 1
}

/**
 * `Missiles.txt` `pSrvDmgFunc` 12 (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTargetUnit`, `ret 4`):
 * spawns a 64-direction Nova ring (`0x6FD1C590` / `0x6FD1C490`, stride `max(1, dwParam1)`) of
 * `wSubMissile1 (+0x24)` and returns `3` (`1` on early exit).
 *
 * @va D2Game:0x6FC5C700
 */
export function MISSILES_SrvDmg12_Nova64RingSubMissiles_6FC5C700_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pTargetUnit: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5C700)
  const missile = pMissile >>> 0
  if (missile === 0) return 1
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 1
  if (sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) < 0) return 1
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1

  const game = pGame >>> 0
  const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
  const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
  const pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  if (pOwner === 0) return 1

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 2)
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    m.setU32((pParams + 0x08) >>> 0, missile)
    const nSkillId = MISSILE_GetSkill113c(m, missile) >>> 0
    m.setU32((pParams + 0x2c) >>> 0, nSkillId)
    const nLevel = MISSILE_GetLevel113c(m, missile) >>> 0
    m.setU32((pParams + 0x30) >>> 0, nLevel)
    const nSubMissile = sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) >>> 0
    m.setU32((pParams + 0x10) >>> 0, nSubMissile)

    const rawStep = readI32(m, (pMissilesTxt + 0x4c) >>> 0)
    const step = rawStep >= 1 ? rawStep : 1
    for (let idx = 0; idx < 64; idx = (idx + step) | 0) {
      const dx = NOVA64_X_113C[idx] | 0
      const dy = NOVA64_Y_113C[idx] | 0
      m.setU32((pParams + 0x1c) >>> 0, dx >>> 0)
      m.setU32((pParams + 0x20) >>> 0, dy >>> 0)
      const pSub = MISSILE_CreateServerProjectile113c(m, game, pParams, hooks) >>> 0
      if (pSub !== 0) {
        MISSILE_SetTargetX113c(m, pSub, dx)
        MISSILE_SetTargetY113c(m, pSub, dy)
      }
    }
  } finally {
    k2W3B3StackPtr = savedSp
  }
  return 3
}

/**
 * `Missiles.txt` `pSrvDoFunc` / `pSrvDmgFunc` (`ecx = pGame`, `edx = pMissile`, `ret 4`):
 * returns `2` while `MISSILE_GetRemainingFrames113c(pMissile) != 0`; when expired (`0`), spawns a
 * 64-direction Nova ring (`0x6FD1C790` / `0x6FD1C690`, stride `max(1, dwParam1)`) and returns `3`.
 *
 * @va D2Game:0x6FC5C850
 */
export function MISSILES_SrvDmg12B_Nova64RingOnExpire_6FC5C850_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pTargetUnit: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5C850)
  const missile = pMissile >>> 0
  if (missile === 0) return 1
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 1
  if (sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) < 0) return 1

  if (MISSILE_GetRemainingFrames113c(m, missile) !== 0) {
    return 2
  }

  const game = pGame >>> 0
  const pOwner = SUNIT_GetOwnerUnit113c(m, missile, game) >>> 0
  if (pOwner === 0) return 1

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 2)
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    m.setU32((pParams + 0x08) >>> 0, missile)
    const nSkillId = MISSILE_GetSkill113c(m, missile) >>> 0
    m.setU32((pParams + 0x2c) >>> 0, nSkillId)
    const nLevel = MISSILE_GetLevel113c(m, missile) >>> 0
    m.setU32((pParams + 0x30) >>> 0, nLevel)
    const nSubMissile = sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) >>> 0
    m.setU32((pParams + 0x10) >>> 0, nSubMissile)

    const rawStep = readI32(m, (pMissilesTxt + 0x4c) >>> 0)
    const step = rawStep >= 1 ? rawStep : 1
    for (let idx = 0; idx < 64; idx = (idx + step) | 0) {
      const dx = NOVA64_X_113C[idx] | 0
      const dy = NOVA64_Y_113C[idx] | 0
      m.setU32((pParams + 0x1c) >>> 0, dx >>> 0)
      m.setU32((pParams + 0x20) >>> 0, dy >>> 0)
      const pSub = MISSILE_CreateServerProjectile113c(m, game, pParams, hooks) >>> 0
      if (pSub !== 0) {
        MISSILE_SetTargetX113c(m, pSub, dx)
        MISSILE_SetTargetY113c(m, pSub, dy)
      }
    }
  } finally {
    k2W3B3StackPtr = savedSp
  }
  return 3
}

/**
 * `Missiles.txt` `pSrvDmgFunc` 13 (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTargetUnit`, `ret 4`):
 * spawns `wSubMissile1 (+0x24)` at `pMissile`'s coordinates with `dwFlags = 0x8001` and custom range
 * `pMissilesTxt->dwParam1 > 0 ? dwParam1 : max(5, SKILLS_EvalCalcByOffset(pSkillsTxt->dwCalc1))`.
 *
 * @va D2Game:0x6FC5C990
 */
export function MISSILES_SrvDmg13_PoisonExplosionCloud_6FC5C990_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pTargetUnit: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5C990)
  const missile = pMissile >>> 0
  if (missile === 0) return 1
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 1
  if (sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) < 0) return 1
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1

  const game = pGame >>> 0
  const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
  const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
  const pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  if (pOwner === 0) return 1

  const nSkillId = MISSILE_GetSkill113c(m, missile) | 0
  const nLevel = MISSILE_GetLevel113c(m, missile) | 0
  const pSkillsTxt = getSkillsTxtRecordInline113c(m, nSkillId)
  if (pSkillsTxt === 0) return 1

  let nRange = readI32(m, (pMissilesTxt + 0x4c) >>> 0)
  if (nRange <= 0) {
    const dwCalc1 = m.u32((pSkillsTxt + 0x138) >>> 0) >>> 0
    nRange = SKILLS_EvalCalcByOffset113c(m, pOwner, dwCalc1, nSkillId, nLevel) | 0
    if (nRange < 5) {
      nRange = 5
    }
  }

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 0x8001)
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    const nSubMissile = sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) >>> 0
    m.setU32((pParams + 0x10) >>> 0, nSubMissile)
    m.setU32((pParams + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nLevel >>> 0)
    m.setU32((pParams + 0x4c) >>> 0, nRange >>> 0)
    const posX = UNIT_GetPosX113c(m, missile) >>> 0
    m.setU32((pParams + 0x14) >>> 0, posX)
    const posY = UNIT_GetPosY113c(m, missile) >>> 0
    m.setU32((pParams + 0x18) >>> 0, posY)
    MISSILE_CreateServerProjectile113c(m, game, pParams, hooks)
  } finally {
    k2W3B3StackPtr = savedSp
  }
  return 1
}

/**
 * Spawns radial sub-projectiles of class `nMissileId` (`edx`) from `pOriginUnit` (`eax`) across
 * the 8 cardinal/diagonal directions (`0x6FD1C8B0` / `0x6FD1C890`, stride `nStep`) with `dwFlags = 0x1F` (`ret 0x14`).
 *
 * @va D2Game:0x6FC5CB00
 */
export function MISSILES_SpawnRadial8SubMissiles_6FC5CB00_113c(
  m: D2KernMemory113c,
  pOriginUnit: number,
  nMissileId: number,
  pGame: number,
  pOwnerUnit: number,
  nSkillId: number,
  nLevel: number,
  nStep: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5CB00)
  const pMissilesTxt = getMissilesTxtRecord113c(m, nMissileId)
  if (pMissilesTxt === 0) return 0

  const origin = pOriginUnit >>> 0
  const game = pGame >>> 0
  const posX = readUnitPosXInline113c(m, origin)
  const posY = readUnitPosYInline113c(m, origin)
  const nVel = (readI32(m, (pMissilesTxt + 0x38) >>> 0) << 7) | 0
  const lvl = nLevel | 0

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 0x1f)
    m.setU32((pParams + 0x04) >>> 0, pOwnerUnit >>> 0)
    m.setU32((pParams + 0x08) >>> 0, origin)
    m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pParams + 0x14) >>> 0, posX >>> 0)
    m.setU32((pParams + 0x18) >>> 0, posY >>> 0)
    m.setU32((pParams + 0x28) >>> 0, nVel >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, lvl >>> 0)
    m.setU32((pParams + 0x34) >>> 0, ((lvl - 1) | 0) >>> 0)

    const stride = nStep | 0
    if (stride > 0) {
      for (let idx = 0; idx < 8; idx = (idx + stride) | 0) {
        const dx = RADIAL8_X_113C[idx] | 0
        const dy = RADIAL8_Y_113C[idx] | 0
        m.setU32((pParams + 0x1c) >>> 0, dx >>> 0)
        m.setU32((pParams + 0x20) >>> 0, dy >>> 0)
        MISSILE_CreateServerProjectile113c(m, game, pParams, hooks)
      }
    }
  } finally {
    k2W3B3StackPtr = savedSp
  }
  return 1
}

/**
 * Area-filter callback (`ecx = pAuraCtx`, `edx = pTargetUnit`): spawns a sub-missile defined in
 * `pAuraCtx->pUserCtx (+0x0C)` aimed at `pTargetUnit`'s position (`dwFlags = 0x20`) when
 * `pUserCtx->nMaxTargets (+0x10) <= 0 || pAuraCtx->nCount (+0x08) < pUserCtx->nMaxTargets`.
 *
 * @va D2Game:0x6FC5CC30
 */
export function MISSILES_AuraCallback_SpawnSubMissileOnTarget_6FC5CC30_113c(
  m: D2KernMemory113c,
  pAuraCtx: number,
  pTargetUnit: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5CC30)
  const auraCtx = pAuraCtx >>> 0
  const target = pTargetUnit >>> 0
  const pUserCtx = m.u32((auraCtx + 0x0c) >>> 0) >>> 0
  const nMaxTargets = readI32(m, (pUserCtx + 0x10) >>> 0)
  if (nMaxTargets > 0 && readI32(m, (auraCtx + 0x08) >>> 0) >= nMaxTargets) {
    return 0
  }

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 0x20)
    m.setU32((pParams + 0x04) >>> 0, m.u32(pUserCtx) >>> 0)
    m.setU32((pParams + 0x08) >>> 0, m.u32((pUserCtx + 0x04) >>> 0) >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, m.u32((pUserCtx + 0x08) >>> 0) >>> 0)
    m.setU32((pParams + 0x30) >>> 0, m.u32((pUserCtx + 0x0c) >>> 0) >>> 0)
    m.setU32((pParams + 0x10) >>> 0, m.u32((pUserCtx + 0x14) >>> 0) >>> 0)
    const targetX = readUnitPosXInline113c(m, target)
    m.setU32((pParams + 0x1c) >>> 0, targetX >>> 0)
    const targetY = readUnitPosYInline113c(m, target)
    m.setU32((pParams + 0x20) >>> 0, targetY >>> 0)
    const pGame = m.u32(auraCtx) >>> 0
    MISSILE_CreateServerProjectile113c(m, pGame, pParams, hooks)
  } finally {
    k2W3B3StackPtr = savedSp
  }
  return 1
}

/**
 * Area-filter callback (`ecx = pAuraCtx`, `edx = pTargetUnit`): spawns a sub-missile defined in
 * `pAuraCtx->pUserCtx (+0x0C)` aimed at `pTargetUnit`'s position (`dwFlags = 0x20`) while
 * `pAuraCtx->nCount (+0x08) < pUserCtx->nMaxTargets (+0x10)`.
 *
 * @va D2Game:0x6FC5CD00
 */
export function MISSILES_AuraCallback_SpawnSubMissileStrictCount_6FC5CD00_113c(
  m: D2KernMemory113c,
  pAuraCtx: number,
  pTargetUnit: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5CD00)
  const auraCtx = pAuraCtx >>> 0
  const target = pTargetUnit >>> 0
  const pUserCtx = m.u32((auraCtx + 0x0c) >>> 0) >>> 0
  if (readI32(m, (auraCtx + 0x08) >>> 0) >= readI32(m, (pUserCtx + 0x10) >>> 0)) {
    return 0
  }

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 0x20)
    m.setU32((pParams + 0x04) >>> 0, m.u32(pUserCtx) >>> 0)
    m.setU32((pParams + 0x08) >>> 0, m.u32((pUserCtx + 0x04) >>> 0) >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, m.u32((pUserCtx + 0x08) >>> 0) >>> 0)
    m.setU32((pParams + 0x30) >>> 0, m.u32((pUserCtx + 0x0c) >>> 0) >>> 0)
    m.setU32((pParams + 0x10) >>> 0, m.u32((pUserCtx + 0x14) >>> 0) >>> 0)
    const targetX = readUnitPosXInline113c(m, target)
    m.setU32((pParams + 0x1c) >>> 0, targetX >>> 0)
    const targetY = readUnitPosYInline113c(m, target)
    m.setU32((pParams + 0x20) >>> 0, targetY >>> 0)
    const pGame = m.u32(auraCtx) >>> 0
    MISSILE_CreateServerProjectile113c(m, pGame, pParams, hooks)
  } finally {
    k2W3B3StackPtr = savedSp
  }
  return 1
}

/**
 * `Missiles.txt` `pSrvDmgFunc` 10 (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTargetUnit`, `ret 4`):
 * spawns `pMissilesTxt->wSubMissile1 (+0x24)` at `(UNIT_GetPosX113c(pMissile), UNIT_GetPosY113c(pMissile))`
 * with `dwFlags = 1` and returns `0` on success (`1` on early exit).
 *
 * @va D2Game:0x6FC5CDD0
 */
export function MISSILES_SrvDmg10_SpawnSubMissileAtSelfPos_6FC5CDD0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pTargetUnit: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5CDD0)
  const missile = pMissile >>> 0
  if (missile === 0) return 1
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 1
  const nSubMissile = sx16(m.u16((pMissilesTxt + 0x24) >>> 0))
  if (nSubMissile < 0) return 1
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1

  const game = pGame >>> 0
  const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
  const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
  const pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  if (pOwner === 0) return 1

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 1)
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    const posX = UNIT_GetPosX113c(m, missile) | 0
    m.setU32((pParams + 0x14) >>> 0, posX >>> 0)
    const posY = UNIT_GetPosY113c(m, missile) | 0
    m.setU32((pParams + 0x18) >>> 0, posY >>> 0)
    const nSkillId = MISSILE_GetSkill113c(m, missile) >>> 0
    m.setU32((pParams + 0x2c) >>> 0, nSkillId)
    const nLevel = MISSILE_GetLevel113c(m, missile) >>> 0
    m.setU32((pParams + 0x30) >>> 0, nLevel)
    m.setU32((pParams + 0x10) >>> 0, nSubMissile >>> 0)
    MISSILE_CreateServerProjectile113c(m, game, pParams, hooks)
  } finally {
    k2W3B3StackPtr = savedSp
  }
  return 0
}

/** `0x6FD1C8D0` — 18-point ring Y-offsets for `MISSILES_SpawnRing18SubMissiles_6FC5CEC0_113c`. */
const D2GAME_RING18_OFFSET_Y_113C: readonly number[] = [
  -2, -2, 2, 5, 3, 3, 3, 2, 1, -1, -1, -2, -2, -3, -4, -3, -3, -2,
]

/** `0x6FD1C918` — 18-point ring X-offsets for `MISSILES_SpawnRing18SubMissiles_6FC5CEC0_113c`. */
const D2GAME_RING18_OFFSET_X_113C: readonly number[] = [
  2, -2, 0, 0, -3, 0, 3, -1, 1, -1, 2, -4, -3, -1, 0, 1, 3, 4,
]

/**
 * Spawns up to 18 ring sub-projectiles (`eax = pMissile`, `[esp+4] = pGame`, `[esp+8] = nSubMissile`,
 * `[esp+0x0c] = nRangeOverride`, `[esp+0x10] = nStep`, `ret 0x10`) using offsets `0x6FD1C918` (X)
 * and `0x6FD1C8D0` (Y).
 *
 * @va D2Game:0x6FC5CEC0
 */
export function MISSILES_SpawnRing18SubMissiles_6FC5CEC0_113c(
  m: D2KernMemory113c,
  pMissile: number,
  pGame: number,
  nSubMissile: number,
  nRangeOverride: number,
  nStep: number,
  hooks?: K2W3B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC5CEC0)
  const subId = nSubMissile | 0
  if (subId < 0) return

  const missile = pMissile >>> 0
  const posX = readUnitPosXInline113c(m, missile) | 0
  const posY = readUnitPosYInline113c(m, missile) | 0

  const game = pGame >>> 0
  let pOwner = 0
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
    const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
    pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  }

  const nSkillId = MISSILE_GetSkill113c(m, missile) >>> 0
  const nLevel = MISSILE_GetLevel113c(m, missile) >>> 0

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    const rangeOvr = nRangeOverride | 0
    if (rangeOvr > 0) {
      m.setU32(pParams, 0x8001)
      m.setU32((pParams + 0x4c) >>> 0, rangeOvr >>> 0)
    } else {
      m.setU32(pParams, 1)
    }
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    m.setU32((pParams + 0x10) >>> 0, subId >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, nSkillId)
    m.setU32((pParams + 0x30) >>> 0, nLevel)

    const step = (nStep | 0) >= 1 ? nStep | 0 : 1
    for (let idx = 0; idx < 18; idx = (idx + step) | 0) {
      const targetY = (posY + (D2GAME_RING18_OFFSET_Y_113C[idx] | 0)) | 0
      const targetX = (posX + (D2GAME_RING18_OFFSET_X_113C[idx] | 0)) | 0
      m.setU32((pParams + 0x14) >>> 0, targetX >>> 0)
      m.setU32((pParams + 0x18) >>> 0, targetY >>> 0)
      MISSILE_CreateServerProjectile113c(m, game, pParams, hooks)
    }
  } finally {
    k2W3B3StackPtr = savedSp
  }
}

/**
 * Periodically spawns a sub-projectile at a random offset within `±(nRadius - 1)` when the target
 * subtile passes `COLLISION_CheckSubtileMask113c` (`eax = nInterval`, `ebx = pMissile`,
 * `[esp+4] = pGame`, `[esp+8] = nRadius`, `[esp+0x0c] = nSubMissile`, `[esp+0x10] = wCollisionMask`, `ret 0x10`).
 *
 * @va D2Game:0x6FC5D1E0
 */
export function MISSILES_SpawnRandomWalkableSubMissileOnInterval_6FC5D1E0_113c(
  m: D2KernMemory113c,
  nInterval: number,
  pMissile: number,
  pGame: number,
  nRadius: number,
  nSubMissile: number,
  wCollisionMask: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5D1E0)
  const interval = nInterval | 0
  if (interval === 0) return 0

  const missile = pMissile >>> 0
  const elapsed = MISSILE_GetElapsedFrames113c(m, missile) | 0
  if (elapsed % interval !== 0) return 0
  if (missile === 0) return 0
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) === 0) return 0

  const game = pGame >>> 0
  const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
  const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
  const pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  if (pOwner === 0) return 0
  if ((UNITS_GetRoom113c(m, missile) >>> 0) === 0) return 0

  const pSeed = (missile + 0x20) >>> 0
  const elapsedSeed = MISSILE_GetElapsedFrames113c(m, missile) | 0
  const posXSeed = UNIT_GetPosX113c(m, missile) | 0
  SEED_InitLowSeed113c(m, pSeed, (elapsedSeed + posXSeed) | 0)

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 3)
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    const nSkillId = MISSILE_GetSkill113c(m, missile) >>> 0
    m.setU32((pParams + 0x2c) >>> 0, nSkillId)
    const nLevel = MISSILE_GetLevel113c(m, missile) >>> 0
    m.setU32((pParams + 0x30) >>> 0, nLevel)
    m.setU32((pParams + 0x10) >>> 0, nSubMissile >>> 0)

    const halfRange = ((nRadius | 0) - 1) | 0
    const span = (halfRange * 2) | 0
    const dx = ((SEED_RollLimitedFast113c(m, pSeed, span) | 0) - halfRange) | 0
    const dy = ((SEED_RollLimitedFast113c(m, pSeed, span) | 0) - halfRange) | 0
    const targetX = ((UNIT_GetPosX113c(m, missile) | 0) + dx) | 0
    m.setU32((pParams + 0x14) >>> 0, targetX >>> 0)
    const targetY = ((UNIT_GetPosY113c(m, missile) | 0) + dy) | 0
    m.setU32((pParams + 0x18) >>> 0, targetY >>> 0)

    const pRoom = UNITS_GetRoom113c(m, missile) >>> 0
    const blocked = COLLISION_CheckSubtileMask113c(m, pRoom, targetX, targetY, wCollisionMask & 0xffff)
    if ((blocked & 0xffff) !== 0) return 0

    return MISSILE_CreateServerProjectile113c(m, game, pParams, hooks) >>> 0
  } finally {
    k2W3B3StackPtr = savedSp
  }
}

/**
 * Spawns a trailing sub-projectile at `pMissile`'s current position when `PATH_CheckFlag08_113c(pMissile->pPath)`
 * is non-zero (`esi = pMissile`, `ebx = nRangeOverride`, `[esp+4] = pGame`, `[esp+8] = nSubMissile`,
 * `[esp+0x0c] = nVelFlag`, `ret 0x0c`).
 *
 * @va D2Game:0x6FC5D320
 */
export function MISSILES_SpawnTrailingSubMissileIfMoved_6FC5D320_113c(
  m: D2KernMemory113c,
  pMissile: number,
  nRangeOverride: number,
  pGame: number,
  nSubMissile: number,
  nVelFlag: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5D320)
  const missile = pMissile >>> 0
  const pPath = m.u32((missile + 0x2c) >>> 0) >>> 0
  const flag08 = PATH_CheckFlag08_113c(m, pPath) | 0
  if (flag08 === 0) return 0

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    let dwFlags = 5
    const rangeOvr = nRangeOverride | 0
    if (rangeOvr > 0) {
      m.setU32((pParams + 0x4c) >>> 0, rangeOvr >>> 0)
      dwFlags = 0x8005
    }
    const velOvr = nVelFlag | 0
    if (velOvr > 0) {
      dwFlags = (dwFlags | 8) >>> 0
      m.setU32((pParams + 0x34) >>> 0, velOvr >>> 0)
    }
    m.setU32(pParams, dwFlags >>> 0)

    const game = pGame >>> 0
    let pOwner = 0
    if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
      const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
      const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
      pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
    }
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    if (pOwner === 0) return 0

    m.setU32((pParams + 0x08) >>> 0, missile)
    m.setU32((pParams + 0x10) >>> 0, nSubMissile >>> 0)
    const posX = readUnitPosXInline113c(m, missile) | 0
    m.setU32((pParams + 0x14) >>> 0, posX >>> 0)
    const posY = readUnitPosYInline113c(m, missile) | 0
    m.setU32((pParams + 0x18) >>> 0, posY >>> 0)
    const nSkillId = MISSILE_GetSkill113c(m, missile) >>> 0
    m.setU32((pParams + 0x2c) >>> 0, nSkillId)
    const nLevel = MISSILE_GetLevel113c(m, missile) | 0
    m.setU32((pParams + 0x30) >>> 0, nLevel >>> 0)
    m.setU32((pParams + 0x34) >>> 0, ((nLevel * 2 - 2) | 0) >>> 0)

    return MISSILE_CreateServerProjectile113c(m, game, pParams, hooks) >>> 0
  } finally {
    k2W3B3StackPtr = savedSp
  }
}

/**
 * Spawns sub-projectiles across a circular disk of radius `nRadius` around `pMissile` for subtiles
 * that pass line-of-sight (`COLLISION_RayTrace113c(..., 4) == 0`) and are outside town
 * (`__stdcall(pGame, pMissile, nRadius, nSubMissile, nRangeOverride)`, `ret 0x14`).
 *
 * @va D2Game:0x6FC5D450
 */
export function MISSILES_SpawnCircularAreaSubMissiles_6FC5D450_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  nRadius: number,
  nSubMissile: number,
  nRangeOverride: number,
  hooks?: K2W3B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FC5D450)
  const missile = pMissile >>> 0
  if ((UNITS_GetRoom113c(m, missile) >>> 0) === 0) return

  let rangeOvr = nRangeOverride | 0
  if (rangeOvr < 0) rangeOvr = 0

  const game = pGame >>> 0
  let pOwner = 0
  if (missile !== 0 && ((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
    const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
    pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  }

  const savedSp = k2W3B3StackPtr
  const pPt2 = savedSp
  const pPt1 = (savedSp + 0x08) >>> 0
  const pParams = (savedSp + 0x10) >>> 0
  k2W3B3StackPtr = (savedSp + 0x6c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, rangeOvr !== 0 ? 0x8001 : 1)
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    const nSkillId = MISSILE_GetSkill113c(m, missile) >>> 0
    m.setU32((pParams + 0x2c) >>> 0, nSkillId)
    const nLevel = MISSILE_GetLevel113c(m, missile) >>> 0
    m.setU32((pParams + 0x30) >>> 0, nLevel)
    m.setU32((pParams + 0x10) >>> 0, nSubMissile >>> 0)

    const originX = readUnitPosXInline113c(m, missile) | 0
    const originY = readUnitPosYInline113c(m, missile) | 0
    const radius = nRadius | 0
    const radiusSq = Math.imul(radius, radius)

    for (let dx = (-radius) | 0; dx <= radius; dx = (dx + 1) | 0) {
      const x = (originX + dx) | 0
      for (let dy = (-radius) | 0; dy <= radius; dy = (dy + 1) | 0) {
        const y = (originY + dy) | 0
        const pRoom = UNITS_GetRoom113c(m, missile) >>> 0
        if (pRoom === 0) continue
        const distSq = (Math.imul(dx, dx) + Math.imul(dy, dy)) | 0
        if (distSq > radiusSq) continue

        m.setU32(pPt2, ((x + dx) | 0) >>> 0)
        m.setU32((pPt2 + 0x04) >>> 0, ((y + dy) | 0) >>> 0)
        m.setU32(pPt1, x >>> 0)
        m.setU32((pPt1 + 0x04) >>> 0, y >>> 0)
        const hit = COLLISION_RayTrace113c(m, pRoom, pPt1, pPt2, 4) | 0
        if (hit !== 0) continue

        const pRoom2 = UNITS_GetRoom113c(m, missile) >>> 0
        const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pRoom2, x, y) >>> 0
        if (pTargetRoom === 0) continue
        if ((DUNGEON_CheckRoomIsTownMemPort113c(m, pTargetRoom) | 0) !== 0) continue

        if (rangeOvr !== 0) {
          m.setU32((pParams + 0x4c) >>> 0, rangeOvr >>> 0)
        }
        m.setU32((pParams + 0x14) >>> 0, x >>> 0)
        m.setU32((pParams + 0x18) >>> 0, y >>> 0)
        MISSILE_CreateServerProjectile113c(m, game, pParams, hooks)
      }
    }
  } finally {
    k2W3B3StackPtr = savedSp
  }
}

/** `0x6FD1CBA0` — 16-direction X-offsets for `MISSILES_SpawnRing16WithOptionalInnerRingSubMissiles_6FC5D680_113c`. */
const D2GAME_RING16_DIR_X_113C: readonly number[] = [
  0, 1, 2, 2, 2, 2, 2, 1, 0, -1, -2, -2, -2, -2, -2, -1,
]

/** `0x6FD1CB60` — 16-direction Y-offsets for `MISSILES_SpawnRing16WithOptionalInnerRingSubMissiles_6FC5D680_113c`. */
const D2GAME_RING16_DIR_Y_113C: readonly number[] = [
  2, 2, 2, 1, 0, -1, -2, -2, -2, -2, -2, -1, 0, 1, 2, 2,
]

/**
 * Spawns up to 16 radial sub-projectiles (`eax = pOriginUnit`, `edx = nSubMissile`,
 * `[esp+4] = pGame`, `[esp+8] = pOwnerUnit`, `[esp+0x0c] = nSkillId`, `[esp+0x10] = nLevel`,
 * `[esp+0x14] = nStepInner`, `[esp+0x18] = nStepOuter`, `[esp+0x1c] = nVelocityOverride`, `ret 0x1c`)
 * using `0x6FD1CBA0` / `0x6FD1CB60` and `pMissilesTxt->dwParam1 << 7` (`+0x38`) and optional inner
 * ring with `pMissilesTxt->dwParam2 << 7` (`+0x3c`).
 *
 * @va D2Game:0x6FC5D680
 */
export function MISSILES_SpawnRing16WithOptionalInnerRingSubMissiles_6FC5D680_113c(
  m: D2KernMemory113c,
  pOriginUnit: number,
  nSubMissile: number,
  pGame: number,
  pOwnerUnit: number,
  nSkillId: number,
  nLevel: number,
  nStepInner: number,
  nStepOuter: number,
  nVelocityOverride: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5D680)
  const subId = nSubMissile | 0
  if (subId < 0) return 0
  const pMissilesTxt = getMissilesTxtRecord113c(m, subId)
  if (pMissilesTxt === 0) return 0
  const game = pGame >>> 0
  const owner = pOwnerUnit >>> 0
  if (owner === 0) return 0
  const origin = pOriginUnit >>> 0
  if (origin === 0) return 0

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    const velOvr = nVelocityOverride | 0
    if (velOvr > 0) {
      m.setU32(pParams, 0x1f)
      m.setU32((pParams + 0x34) >>> 0, velOvr >>> 0)
    } else {
      m.setU32(pParams, 0x17)
    }
    m.setU32((pParams + 0x04) >>> 0, pOwnerUnit >>> 0)
    m.setU32((pParams + 0x08) >>> 0, origin)
    m.setU32((pParams + 0x10) >>> 0, subId >>> 0)
    const posX = UNIT_GetPosX113c(m, origin) | 0
    m.setU32((pParams + 0x14) >>> 0, posX >>> 0)
    const posY = UNIT_GetPosY113c(m, origin) | 0
    m.setU32((pParams + 0x18) >>> 0, posY >>> 0)
    const outerVel = (readI32(m, (pMissilesTxt + 0x38) >>> 0) << 7) | 0
    m.setU32((pParams + 0x28) >>> 0, outerVel >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nLevel >>> 0)

    const stepOuter = (nStepOuter | 0) >= 1 ? nStepOuter | 0 : 1
    for (let idx = 0; idx < 16; idx = (idx + stepOuter) | 0) {
      const dx = D2GAME_RING16_DIR_X_113C[idx] | 0
      const dy = D2GAME_RING16_DIR_Y_113C[idx] | 0
      m.setU32((pParams + 0x1c) >>> 0, dx >>> 0)
      m.setU32((pParams + 0x20) >>> 0, dy >>> 0)
      MISSILE_CreateServerProjectile113c(m, game, pParams, hooks)
    }

    const stepInner = nStepInner | 0
    if (stepInner > 0) {
      const innerVel = (readI32(m, (pMissilesTxt + 0x3c) >>> 0) << 7) | 0
      m.setU32((pParams + 0x28) >>> 0, innerVel >>> 0)
      for (let idx = 0; idx < 15; idx = (idx + stepInner) | 0) {
        const dx = D2GAME_RING16_DIR_X_113C[(idx + 1) | 0] | 0
        const dy = D2GAME_RING16_DIR_Y_113C[(idx + 1) | 0] | 0
        m.setU32((pParams + 0x1c) >>> 0, dx >>> 0)
        m.setU32((pParams + 0x20) >>> 0, dy >>> 0)
        MISSILE_CreateServerProjectile113c(m, game, pParams, hooks)
      }
    }
  } finally {
    k2W3B3StackPtr = savedSp
  }
  return 1
}

/**
 * `Missiles.txt` `pSrvDmgFunc` (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTargetUnit`, `ret 4`):
 * evaluates `pSkillsTxt->dwAuraLenCalc (+0x60)`, creates or updates timed `wAuraState (+0x82)` statlist
 * on `pTargetUnit`, applies `SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c`, schedules event `0x0c`,
 * and returns `3` (`1` on early exit).
 *
 * @va D2Game:0x6FC5E8A0
 */
export function MISSILES_SrvDmg29_ApplySkillStateAndAuraStatsCalc1_6FC5E8A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5E8A0)
  const missile = pMissile >>> 0
  const nSkillId = MISSILE_GetSkill113c(m, missile) | 0
  const nLevel = MISSILE_GetLevel113c(m, missile) | 0
  const pSkillsTxt = getSkillsTxtRecordInline113c(m, nSkillId)
  if (pSkillsTxt === 0) return 1
  if (missile === 0) return 1
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1

  const game = pGame >>> 0
  const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
  const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
  const pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  if (pOwner === 0) return 1

  const target = pTargetUnit >>> 0
  if (target === 0) return 1

  const nState = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
  if (nState < 0) return 1
  const sgpt = getSgptDataTablesPtr113c(m)
  const stateCount = sgpt !== 0 ? readI32(m, (sgpt + 0xc4) >>> 0) : 0
  if (nState >= stateCount) return 1

  const dwAuraLenCalc = m.u32((pSkillsTxt + 0x60) >>> 0) >>> 0
  let duration = SKILLS_EvalCalcByOffset113c(m, pOwner, dwAuraLenCalc, nSkillId, nLevel) | 0
  if (duration < 5) duration = 5
  const expireFrame = ((m.u32((game + 0xa8) >>> 0) >>> 0) + (duration >>> 0)) >>> 0

  const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, target, nState) >>> 0
  if (pStatList === 0) {
    const uOwnerType = m.u32(pOwner) >>> 0
    const uOwnerId = m.u32((pOwner + 0x0c) >>> 0) >>> 0
    // 1.13c native 0x6FC5E9BF stores newly allocated statlist in [esp+0x24] without updating ebp (pStatList).
    const pNewStatList = STATLIST_AllocList113c(m, 2, uOwnerType, uOwnerId, 0, expireFrame) >>> 0
    if (pNewStatList === 0) return 1
    STATLIST_SetState113c(m, pNewStatList, nState)
    STATLIST_SetStatRemoveProc113c(m, pNewStatList, 0x6fcbf7a0)
    STATLIST_MergeStatLists113c(m, target, pNewStatList, 1)
    STATES_ToggleGfxStateFlag113c(m, target, nState, 1)
  }

  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(m, pSkillsTxt, target, pStatList, nSkillId, nLevel)
  STATES_ClearGfxStateFlag113c(m, target, nState, 1)
  STATLIST_SetExpireFrameEx113c(m, pStatList, expireFrame)
  EVENT_SetEventFull113c(m, game, target, 0x0c, expireFrame, 0, 0, 0, hooks !== undefined ? hooks.eventWheel : undefined)
  return 3
}

/**
 * `Missiles.txt` `pSrvDmgFunc` (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTargetUnit`, `ret 4`):
 * evaluates `pSkillsTxt->dwCalc4 (+0x144)`, creates or updates timed `wAuraState (+0x82)` statlist
 * on `pTargetUnit`, applies `SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c`, schedules event `0x0c`,
 * and returns `0` (`1` on invalid skill/missile/owner/state).
 *
 * @va D2Game:0x6FC5EC10
 */
export function MISSILES_SrvDmg30_ApplySkillStateAndAuraStatsCalc4_6FC5EC10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5EC10)
  const missile = pMissile >>> 0
  const nSkillId = MISSILE_GetSkill113c(m, missile) | 0
  const nLevel = MISSILE_GetLevel113c(m, missile) | 0
  const pSkillsTxt = getSkillsTxtRecordInline113c(m, nSkillId)
  if (pSkillsTxt === 0) return 1
  if (missile === 0) return 1
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1

  const game = pGame >>> 0
  const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
  const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
  const pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  if (pOwner === 0) return 1

  const target = pTargetUnit >>> 0
  if (target === 0) return 0

  const nState = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
  if (nState < 0) return 1
  const sgpt = getSgptDataTablesPtr113c(m)
  const stateCount = sgpt !== 0 ? readI32(m, (sgpt + 0xc4) >>> 0) : 0
  if (nState >= stateCount) return 1

  const dwCalc4 = m.u32((pSkillsTxt + 0x144) >>> 0) >>> 0
  let duration = SKILLS_EvalCalcByOffset113c(m, pOwner, dwCalc4, nSkillId, nLevel) | 0
  if (duration < 5) duration = 5

  const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, target, nState) >>> 0
  if (pStatList === 0) {
    const uOwnerType = m.u32(pOwner) >>> 0
    const uOwnerId = m.u32((pOwner + 0x0c) >>> 0) >>> 0
    const initExpire = ((m.u32((game + 0xa8) >>> 0) >>> 0) + (duration >>> 0)) >>> 0
    // 1.13c native 0x6FC5ED28 stores newly allocated statlist in [esp+0x24] without updating [esp+0x14] (pStatList).
    const pNewStatList = STATLIST_AllocList113c(m, 2, uOwnerType, uOwnerId, 0, initExpire) >>> 0
    if (pNewStatList === 0) return 1
    STATLIST_SetState113c(m, pNewStatList, nState)
    STATLIST_SetStatRemoveProc113c(m, pNewStatList, 0x6fcbf7a0)
    STATLIST_MergeStatLists113c(m, target, pNewStatList, 1)
    STATES_ToggleGfxStateFlag113c(m, target, nState, 1)
  }

  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(m, pSkillsTxt, target, pStatList, nSkillId, nLevel)
  STATES_ClearGfxStateFlag113c(m, target, nState, 1)
  const expireFrame = ((m.u32((game + 0xa8) >>> 0) >>> 0) + (duration >>> 0)) >>> 0
  STATLIST_SetExpireFrameEx113c(m, pStatList, expireFrame)
  EVENT_SetEventFull113c(m, game, target, 0x0c, expireFrame, 0, 0, 0, hooks !== undefined ? hooks.eventWheel : undefined)
  return 0
}

/**
 * `Missiles.txt` `pSrvDmgFunc` (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTargetUnit`, `ret 4`):
 * loops over the 4 sub-missile words at `pMissilesTxt + 0x24..0x2a`, spawns each `subId > 0`, and
 * when `pMissilesTxt->dwParam1 (+0x4c) > 0` immediately runs `MISSILE_ProcessTargetCollisionHit113c(..., 1)`.
 * Returns `1`.
 *
 * @va D2Game:0x6FC5F120
 */
export function MISSILES_SrvDmg35_SpawnSubMissilesAndCollide_6FC5F120_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5F120)
  const missile = pMissile >>> 0
  if (missile === 0) return 1
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 1

  const game = pGame >>> 0
  let pOwner = 0
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
    const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
    pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  }

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    m.setU32((pParams + 0x08) >>> 0, missile)
    const nSkillId = MISSILE_GetSkill113c(m, missile) >>> 0
    m.setU32((pParams + 0x2c) >>> 0, nSkillId)
    const nLevel = MISSILE_GetLevel113c(m, missile) >>> 0
    m.setU32((pParams + 0x30) >>> 0, nLevel)

    const target = pTargetUnit >>> 0
    for (let i = 0; i < 4; i++) {
      const subId = sx16(m.u16((pMissilesTxt + 0x24 + i * 2) >>> 0))
      if (subId > 0) {
        m.setU32((pParams + 0x10) >>> 0, subId >>> 0)
        const pSub = MISSILE_CreateServerProjectile113c(m, game, pParams, hooks) >>> 0
        if (pSub !== 0 && readI32(m, (pMissilesTxt + 0x4c) >>> 0) > 0) {
          MISSILE_ProcessTargetCollisionHit113c(m, pSub, game, target, 1, hooks)
        }
      }
    }
  } finally {
    k2W3B3StackPtr = savedSp
  }
  return 1
}

/**
 * `Missiles.txt` `pSrvDmgFunc` (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTargetUnit`, `ret 4`):
 * identical to `0x6FC5F120`, except returns `3` on completion (`1` on invalid missile/record).
 *
 * @va D2Game:0x6FC5F220
 */
export function MISSILES_SrvDmg36_SpawnSubMissilesAndCollideRet3_6FC5F220_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5F220)
  const missile = pMissile >>> 0
  if (missile === 0) return 1
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 1

  const game = pGame >>> 0
  let pOwner = 0
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
    const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
    pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  }

  const savedSp = k2W3B3StackPtr
  const pParams = savedSp
  k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    m.setU32((pParams + 0x08) >>> 0, missile)
    const nSkillId = MISSILE_GetSkill113c(m, missile) >>> 0
    m.setU32((pParams + 0x2c) >>> 0, nSkillId)
    const nLevel = MISSILE_GetLevel113c(m, missile) >>> 0
    m.setU32((pParams + 0x30) >>> 0, nLevel)

    const target = pTargetUnit >>> 0
    for (let i = 0; i < 4; i++) {
      const subId = sx16(m.u16((pMissilesTxt + 0x24 + i * 2) >>> 0))
      if (subId > 0) {
        m.setU32((pParams + 0x10) >>> 0, subId >>> 0)
        const pSub = MISSILE_CreateServerProjectile113c(m, game, pParams, hooks) >>> 0
        if (pSub !== 0 && readI32(m, (pMissilesTxt + 0x4c) >>> 0) > 0) {
          MISSILE_ProcessTargetCollisionHit113c(m, pSub, game, target, 1, hooks)
        }
      }
    }
  } finally {
    k2W3B3StackPtr = savedSp
  }
  return 3
}

/**
 * `Missiles.txt` `pSrvDoFunc` 12 (`ecx = pGame`, `edx = pMissile`, `ret`):
 * every `max(1, pMissilesTxt->dwParam1)` frames, perturbs `(dx, dy)` packed in `MISSILE_GetTargetY113c`
 * using a 64-bit LCG step seeded from `MISSILE_GetTargetX113c`, recomputes path, and delegates to
 * `MISSILE_SrvDo01_LinearProjectile113c`.
 *
 * @va D2Game:0x6FC5F890
 */
export function MISSILES_SrvDo12_RandomWalkStepProjectile_6FC5F890_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5F890)
  const missile = pMissile >>> 0
  if (missile === 0) return 2
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 2

  const rawInterval = readI32(m, (pMissilesTxt + 0x38) >>> 0)
  const interval = rawInterval < 1 ? 1 : rawInterval
  const elapsed = MISSILE_GetElapsedFrames113c(m, missile) | 0
  const game = pGame >>> 0
  if (elapsed % interval !== 0) {
    return MISSILE_SrvDo01_LinearProjectile113c(m, missile, game, hooks) | 0
  }

  const pSeed = (missile + 0x20) >>> 0
  if (pSeed === 0) return 2

  const seedLowIn = MISSILE_GetTargetX113c(m, missile) | 0
  SEED_InitLowSeed113c(m, pSeed, seedLowIn)

  const packedTargetY = MISSILE_GetTargetY113c(m, missile) >>> 0
  let dx = sx16(packedTargetY & 0xffff)
  let dy = sx16((packedTargetY >>> 16) & 0xffff)

  const curLo = BigInt(m.u32(pSeed) >>> 0)
  const curHi = BigInt(m.u32((pSeed + 0x04) >>> 0) >>> 0)
  const next = curLo * 0x6ac690c5n + curHi
  const newLo = Number(next & 0xffffffffn) >>> 0
  const newHi = Number((next >> 32n) & 0xffffffffn) >>> 0
  m.setU32(pSeed, newLo)
  m.setU32((pSeed + 0x04) >>> 0, newHi)

  let ecx = dx
  let eax = dy
  if ((newLo & 1) !== 0) {
    eax = (-eax) | 0
  } else {
    ecx = (-ecx) | 0
  }

  dx = Math.trunc(((eax + dx * 4) | 0) / 4) | 0
  dy = Math.trunc(((ecx + dy * 4) | 0) / 4) | 0
  if (dx === 0) dx = 1
  if (dy === 0) dy = 1

  const posY = UNIT_GetPosY113c(m, missile) | 0
  const posX = UNIT_GetPosX113c(m, missile) | 0
  const pPath = m.u32((missile + 0x2c) >>> 0) >>> 0
  PATH_SetTargetPos113c(m, pPath, (posX + dx) | 0, (posY + dy) | 0)
  PATH_Compute113c(m, pPath, missile, 0)

  const outSeedLo = SEED_GetLowSeed113c(m, pSeed) | 0
  MISSILE_SetTargetX113c(m, missile, outSeedLo)
  const outPacked = (((dy & 0xffff) << 16) + (dx & 0xffff)) | 0
  MISSILE_SetTargetY113c(m, missile, outPacked)

  return MISSILE_SrvDo01_LinearProjectile113c(m, missile, game, hooks) | 0
}

/**
 * `Missiles.txt` `pSrvDoFunc` 13 (`ecx = pGame`, `edx = pMissile`, `ret`):
 * when `PATH_CheckFlag08_113c(pMissile->pPath)` is non-zero, spawns two `wSrvSubMissile1 (+0x18)`
 * sub-projectiles with `(+targetX, +targetY)` and `(-targetX, -targetY)`, then runs
 * `MISSILE_SrvDo01_LinearProjectile113c`.
 *
 * @va D2Game:0x6FC5F9F0
 */
export function MISSILES_SrvDo13_SpawnOppositeSubMissilesAlongStep_6FC5F9F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5F9F0)
  const missile = pMissile >>> 0
  if (missile === 0) return 2
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 2
  const nSubMissile = sx16(m.u16((pMissilesTxt + 0x18) >>> 0))
  if (nSubMissile < 0) return 2

  const game = pGame >>> 0
  let pOwner = 0
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
    const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
    pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  }
  if (pOwner === 0) {
    MISSILE_ProcessTargetCollisionHit113c(m, missile, game, 0, 0, hooks)
    return 2
  }

  const pPath = m.u32((missile + 0x2c) >>> 0) >>> 0
  if ((PATH_CheckFlag08_113c(m, pPath) | 0) !== 0) {
    const tx = MISSILE_GetTargetX113c(m, missile) | 0
    const ty = MISSILE_GetTargetY113c(m, missile) | 0
    const savedSp = k2W3B3StackPtr
    const pParams = savedSp
    k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
    try {
      m.fill(pParams, 0x5c, 0)
      m.setU32(pParams, 2)
      m.setU32((pParams + 0x04) >>> 0, pOwner)
      m.setU32((pParams + 0x08) >>> 0, missile)
      const nSkillId = MISSILE_GetSkill113c(m, missile) >>> 0
      m.setU32((pParams + 0x2c) >>> 0, nSkillId)
      const nLevel = MISSILE_GetLevel113c(m, missile) >>> 0
      m.setU32((pParams + 0x30) >>> 0, nLevel)
      m.setU32((pParams + 0x10) >>> 0, nSubMissile >>> 0)
      m.setU32((pParams + 0x1c) >>> 0, tx >>> 0)
      m.setU32((pParams + 0x20) >>> 0, ty >>> 0)
      MISSILE_CreateServerProjectile113c(m, game, pParams, hooks)

      m.setU32((pParams + 0x1c) >>> 0, ((-tx) | 0) >>> 0)
      m.setU32((pParams + 0x20) >>> 0, ((-ty) | 0) >>> 0)
      MISSILE_CreateServerProjectile113c(m, game, pParams, hooks)
    } finally {
      k2W3B3StackPtr = savedSp
    }
  }

  return MISSILE_SrvDo01_LinearProjectile113c(m, missile, game, hooks) | 0
}

/**
 * `Missiles.txt` `pSrvDoFunc` 15 (`ecx = pGame`, `edx = pMissile`, `ret`):
 * warps `pMissile` to its owner (`MISSILES_WarpPathToOwnerPos_6FC5A1D0_113c`), and every
 * `max(1, dwParam1)` frames spawns `wSrvSubMissile1 (+0x18)` with random `(dx, dy)` in `±dwParam2 (+0x3c)`,
 * copying `wAuraState` expiration frame to the sub-projectile's `TargetX`.
 *
 * @va D2Game:0x6FC5FB40
 */
export function MISSILES_SrvDo15_FollowOwnerAndSpawnRandomSubMissile_6FC5FB40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5FB40)
  const missile = pMissile >>> 0
  if (missile === 0) return 2
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 2
  const nSubMissile = sx16(m.u16((pMissilesTxt + 0x18) >>> 0))
  if (nSubMissile < 0) return 2

  const nSkillId = MISSILE_GetSkill113c(m, missile) | 0
  const pSkillsTxt = getSkillsTxtRecordInline113c(m, nSkillId)
  if (pSkillsTxt === 0) return 2

  const game = pGame >>> 0
  const targetUnitId = MISSILE_GetTargetY113c(m, missile) >>> 0
  const targetUnitType = MISSILE_GetTargetX113c(m, missile) >>> 0
  const pFollowUnit = SUNIT_GetServerUnit113c(m, game, targetUnitType, targetUnitId) >>> 0
  const pOwner = SUNIT_GetOwnerUnit113c(m, missile, game) >>> 0

  if (
    pFollowUnit === 0 ||
    pOwner === 0 ||
    (SUNIT_IsDeadOrDying113c(m, pOwner) | 0) !== 0 ||
    (MISSILE_GetRemainingFrames113c(m, missile) | 0) < 0
  ) {
    MISSILE_ProcessTargetCollisionHit113c(m, missile, game, 0, 1, hooks)
    return 2
  }

  MISSILES_WarpPathToOwnerPos_6FC5A1D0_113c(m, game, missile)

  const rawInterval = readI32(m, (pMissilesTxt + 0x38) >>> 0)
  const interval = rawInterval < 1 ? 1 : rawInterval
  const elapsed = MISSILE_GetElapsedFrames113c(m, missile) | 0
  if (elapsed % interval === 0) {
    const savedSp = k2W3B3StackPtr
    const pParams = savedSp
    k2W3B3StackPtr = (savedSp + 0x5c) >>> 0
    try {
      m.fill(pParams, 0x5c, 0)
      m.setU32(pParams, 2)
      m.setU32((pParams + 0x04) >>> 0, pFollowUnit)
      m.setU32((pParams + 0x08) >>> 0, missile)
      m.setU32((pParams + 0x10) >>> 0, nSubMissile >>> 0)
      const skill = MISSILE_GetSkill113c(m, missile) >>> 0
      m.setU32((pParams + 0x2c) >>> 0, skill)
      const level = MISSILE_GetLevel113c(m, missile) >>> 0
      m.setU32((pParams + 0x30) >>> 0, level)

      const radius = readI32(m, (pMissilesTxt + 0x3c) >>> 0)
      const span = (radius * 2 + 1) | 0
      const pFollowSeed = (pFollowUnit + 0x20) >>> 0
      const dx = (rollSeedAtPtr113c(m, pFollowSeed, span) - radius) | 0
      const dy = (rollSeedAtPtr113c(m, pFollowSeed, span) - radius) | 0
      m.setU32((pParams + 0x1c) >>> 0, dx >>> 0)
      m.setU32((pParams + 0x20) >>> 0, dy >>> 0)

      const pSub = MISSILE_CreateServerProjectile113c(m, game, pParams, hooks) >>> 0
      const nState = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
      if (nState > 0) {
        const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pOwner, nState) >>> 0
        if (pSub !== 0 && pStatList !== 0) {
          const expireFrame = STATLIST_GetExpireFrameEx113c(m, pStatList) | 0
          MISSILE_SetTargetX113c(m, pSub, expireFrame)
        }
      }
    } finally {
      k2W3B3StackPtr = savedSp
    }
  }

  MISSILE_SrvDo01_LinearProjectile113c(m, missile, game, hooks)
  return 1
}

/**
 * `Missiles.txt` `pSrvDoFunc` 16 (`ecx = pGame`, `edx = pMissile`, `ret`):
 * when `MISSILE_GetElapsedFrames113c(pMissile) == pMissilesTxt->dwParam1 (+0x38)`, restores
 * `mulDiv113c(eval(pSkillsTxt->dwCalc1), maxMana, 100)` mana (`STAT_MANA = 8`) to `pOwner`
 * and sets skill icon (`pMissilesTxt->wProgOverlay` at `+0x36`), then calls `MISSILE_SrvDo01_LinearProjectile113c`.
 *
 * @va D2Game:0x6FC5FD30
 */
export function MISSILES_SrvDo16_RedemptionManaHealOnFrame_6FC5FD30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5FD30)
  const missile = pMissile >>> 0
  if (missile === 0) return 2
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 2

  const nSkillId = MISSILE_GetSkill113c(m, missile) | 0
  const pSkillsTxt = getSkillsTxtRecordInline113c(m, nSkillId)
  if (pSkillsTxt === 0) return 2

  const game = pGame >>> 0
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
    const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
    const pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
    if (pOwner !== 0 && (SUNIT_IsDeadOrDying113c(m, pOwner) | 0) === 0) {
      const nLevel = MISSILE_GetLevel113c(m, missile) | 0
      const elapsed = MISSILE_GetElapsedFrames113c(m, missile) | 0
      if (elapsed === readI32(m, (pMissilesTxt + 0x38) >>> 0)) {
        const curMana = (STATLIST_GetUnitStat113c(m, pOwner, 8, 0) | 0) >> 8
        const maxMana = (STATLIST_GetMaxManaFromUnit113c(m, pOwner) | 0) >> 8
        if (curMana < maxMana) {
          const dwCalc1 = m.u32((pSkillsTxt + 0x138) >>> 0) >>> 0
          const pct = SKILLS_EvalCalcByOffset113c(m, pOwner, dwCalc1, nSkillId, nLevel) | 0
          const addMana = mulDiv113c(pct, maxMana, 100) | 0
          let newMana = (curMana + addMana) | 0
          if (newMana >= maxMana) newMana = maxMana
          STATLIST_SetUnitStat113c(m, pOwner, 8, newMana << 8, 0)

          const wProgOverlay = sx16(m.u16((pMissilesTxt + 0x36) >>> 0))
          if (wProgOverlay > 0) {
            const sgpt = getSgptDataTablesPtr113c(m)
            const overlayCount = sgpt !== 0 ? readI32(m, (sgpt + 0xbc0) >>> 0) : 0
            if (wProgOverlay < overlayCount) {
              STATES_SetMonsterSkillIconOnUnit113c(m, pOwner, wProgOverlay, 0)
            }
          }
        }
      }
    }
  }

  return MISSILE_SrvDo01_LinearProjectile113c(m, missile, game, hooks) | 0
}

/**
 * `Missiles.txt` `pSrvDoFunc` 17 (`ecx = pGame`, `edx = pMissile`, `ret`):
 * when `MISSILE_GetElapsedFrames113c(pMissile) == pMissilesTxt->dwParam1 (+0x38)`, restores
 * `mulDiv113c(eval(pSkillsTxt->dwCalc1), maxLife, 100)` life (`STAT_HITPOINTS = 6`) to `pOwner`
 * and sets skill icon (`pMissilesTxt->wProgOverlay` at `+0x36`), then calls `MISSILE_SrvDo01_LinearProjectile113c`.
 *
 * @va D2Game:0x6FC5FED0
 */
export function MISSILES_SrvDo17_RedemptionLifeHealOnFrame_6FC5FED0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  hooks?: K2W3B3Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5FED0)
  const missile = pMissile >>> 0
  if (missile === 0) return 2
  const pMissilesTxt = getMissilesTxtRecord113c(m, readI32(m, (missile + 0x04) >>> 0))
  if (pMissilesTxt === 0) return 2

  const nSkillId = MISSILE_GetSkill113c(m, missile) | 0
  const pSkillsTxt = getSkillsTxtRecordInline113c(m, nSkillId)
  if (pSkillsTxt === 0) return 2

  const game = pGame >>> 0
  if (((m.u32((missile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    const ownerType = m.u32((missile + 0x94) >>> 0) >>> 0
    const ownerId = m.u32((missile + 0x98) >>> 0) >>> 0
    const pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
    if (pOwner !== 0 && (SUNIT_IsDeadOrDying113c(m, pOwner) | 0) === 0) {
      const nLevel = MISSILE_GetLevel113c(m, missile) | 0
      const elapsed = MISSILE_GetElapsedFrames113c(m, missile) | 0
      if (elapsed === readI32(m, (pMissilesTxt + 0x38) >>> 0)) {
        const curLife = (STATLIST_GetUnitStat113c(m, pOwner, 6, 0) | 0) >> 8
        const maxLife = (STATLIST_GetMaxLifeFromUnit113c(m, pOwner) | 0) >> 8
        if (curLife < maxLife) {
          const dwCalc1 = m.u32((pSkillsTxt + 0x138) >>> 0) >>> 0
          const pct = SKILLS_EvalCalcByOffset113c(m, pOwner, dwCalc1, nSkillId, nLevel) | 0
          const addLife = mulDiv113c(pct, maxLife, 100) | 0
          let newLife = (curLife + addLife) | 0
          if (newLife >= maxLife) newLife = maxLife
          STATLIST_SetUnitStat113c(m, pOwner, 6, newLife << 8, 0)

          const wProgOverlay = sx16(m.u16((pMissilesTxt + 0x36) >>> 0))
          if (wProgOverlay > 0) {
            const sgpt = getSgptDataTablesPtr113c(m)
            const overlayCount = sgpt !== 0 ? readI32(m, (sgpt + 0xbc0) >>> 0) : 0
            if (wProgOverlay < overlayCount) {
              STATES_SetMonsterSkillIconOnUnit113c(m, pOwner, wProgOverlay, 0)
            }
          }
        }
      }
    }
  }

  return MISSILE_SrvDo01_LinearProjectile113c(m, missile, game, hooks) | 0
}
