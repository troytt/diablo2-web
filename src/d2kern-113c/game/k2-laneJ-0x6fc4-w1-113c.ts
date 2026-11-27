/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 1 (`Lane K2-J`) routines across
 * `0x6FC43320..0x6FC545A0` (`MONUMOD` event/init callbacks, `PLRMODE` dual-claw
 * and skill target/retreat/melee helpers, `SKILLS` corpse-target start gates,
 * `GAME` global slot & lock helpers, `CLIENT` room-adjacent packet queueing,
 * `DRLG` single-room population, `OBJECTS` footprint collision & `InitFn` /
 * density spawners, and `QUESTS` global state, timer, unit-chain, and item-event
 * dispatchers).
 *
 * Every `@va`-annotated export is a direct instruction-faithful translation of
 * its corresponding `D2Game.dll` v1.13c machine-code routine operating on
 * `Memory113c` (`SparseMemory113c`).
 */

import { COLLISION_CheckMaskWithSizeXY113c } from '../common/collision.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import {
  DUNGEON_CheckRoomFlag2_113c,
  DUNGEON_CountNonPresetRoomsInLevel113c,
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordinates113c,
  DUNGEON_SetRoomFlag2_113c,
} from '../common/dungeon.ts'
import { imul32 } from '../common/int-math.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../common/items.ts'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetWeaponByHandSlotMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
} from '../common/k0-d2common-memports.ts'
import {
  PATH_Compute113c,
  PATH_GetTargetUnit113c,
  PATH_SetDistance113c,
  PATH_SetNewDistance113c,
  PATH_SetStepNum113c,
  PATH_SetTargetPos113c,
  PATH_SetTargetUnit113c,
  PATH_SetType113c,
  PATH_SnapToSubtileCenter113c,
} from '../common/path.ts'
import { QUESTRECORD_SetQuestState113c } from '../common/quest-record.ts'
import {
  SKILLS_GetParam3113c,
  SKILLS_GetParam4113c,
  SKILLS_IsSelectableCorpse10678_113c,
  SKILLS_IsSelectableCorpseWithFlag12_113c,
  SKILLS_SetParam0C113c,
  SKILLS_SetParam3113c,
  SKILLS_SetParam4113c,
} from '../common/skills.ts'
import {
  DUNGEON_GetActLevelId113c,
  STATES_CheckState113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITS_GetRoom113c,
  UNITS_SetCollisionMaskAtCoords113c,
  UNITS_SetSeqFrameFromLowByte113c,
  UNIT_GetAlignment113c,
} from '../common/unit.ts'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import {
  ROOM_RefreshUnitsAndLoadSaved113c,
  ROOM_TickSeedAndAmbientSpawn113c,
  type ActRoomsCallees113c,
} from './act-rooms-113c.ts'
import { MONSTER_ExecuteMeleeSwing113c, type AiFallenHooks113c } from './ai-fallen-113c.ts'
import {
  MONSTER_ApplyElementalDamageAndResistStats113c,
  NET_QueuePacketToClientBuffer113c,
} from './boot-init-gap-a-113c.ts'
import { MONSTER_StartMode113c, SUNITDMG_ExecuteEvents113c } from './combat-a1c-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import {
  ACT3Q7_Callback11_Noop113c,
  ACT3Q7_Callback14_PlayerJoined113c,
} from './k2-sunit-spawn-w1-113c.ts'
import { UNITS_ChangeAnimMode113c } from './monster-events.ts'
import {
  OBJECTS_CheckLevelObjectHook113c,
  OBJECTS_InitObjectUnit113c,
  OBJECTS_PopulateRoom113c,
  OBJECTS_SpawnRandomObjectInRoom113c,
  type ObjectSpawnCallees113c,
} from './objects-populate-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_ScheduleInitialAiEvent113c,
  MONSTER_SpawnAtCoords113c,
  OBJECTS_InitChestLockAndSeed113c,
  REGPOP_PopulateRoomMonsters113c,
  ROOM_FindRoomContainingSubtile113c,
  SUNIT_AllocUnitData113c,
  SUNIT_PlaceServerUnitInRoom113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c.ts'
import {
  ITEMS_InitCreatedItemStats_6FC31070_113c,
  OBJECTS_FindFreeDropCoordsAndSpawnItem_6FC51000_113c,
} from './k2-real-itemdrop-113c.ts'
import {
  OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c,
  OBJECTS_PopulateBarrelClustersInRoom_6FC50800_113c,
  OBJECTS_PopulateCrateClustersInRoom_6FC50150_113c,
} from './k2-w3b2-113c.ts'
import {
  ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c,
  ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c,
  ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c,
} from './k2-w3b5-113c.ts'
import {
  OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c,
  OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c,
  OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c,
} from './k2-w4b1-113c.ts'
import { SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c } from './k2-w5b9-113c.ts'
import {
  OBJECTS_SpawnDensityWithSecondaryTorch113c,
  SUNIT_FreeUnit113c,
} from './replay-final11-113c.ts'
import { ACT4_IntroCallback08Noop_6FC80180_113c } from './k2-w2b1-113c.ts'
import { ACT2Q4_Callback00_Noop_6FCE1980_113c } from './k2-w2b6-113c.ts'
import { ACT2Q2_NoOp_6FCE2450_113c } from './k2-w2b7-113c.ts'
import { ACT4Q2_DropHellforgeHammerAtUnit_6FCDA810_113c } from './k2-w4b8-113c.ts'
import {
  ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c,
  ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c,
} from './k2-w5b5-113c.ts'
import { ACT3Q3_OnKhalimRelicPickedUp_6FD06190_113c } from './k2-w5b8-113c.ts'
import {
  ACT1Q4_Callback02_OnGriswoldDeath_6FC85A70_113c,
  ACT1Q5_OnMoldyTomeActivated_6FC83730_113c,
  ACT5Q1_OnShenkKilledCompleteQuest_6FC7BDB0_113c,
  ACT5Q2_Callback02_MonsterKilled_6FC7A310_113c,
} from './k2-w6b4-113c.ts'
import { QUESTS_Act1AndarielOnDeath_6FC7B690_113c } from './k2-w7b1-113c.ts'
import {
  ACT1Q2_OnBloodRavenKilled_6FC85620_113c,
  ACT1Q4_OnQuestActivatedUpdatePlayers_6FC83570_113c,
  ACT1Q5_OnAndarielKilled_6FC88B90_113c,
} from './k2-w7b2-113c.ts'
import {
  ACT2Q5_OnSummonerKilled_6FCE66B0_113c,
  ACT4Q1_OnIzualKilled_6FCDABF0_113c,
} from './k2-w7b3-113c.ts'
import {
  ACT2Q1_OnRadamentKilled_6FCE7540_113c,
  ACT2Q6_OnDurielKilled_6FCE97D0_113c,
  ACT3Q2_OnGidbinnBossKilled_6FD08140_113c,
  ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c,
  ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c,
} from './k2-w7b4-113c.ts'
import {
  ACT1Q1_OnMonsterKilled_6FC85760_113c,
  ACT4Q1_OnPlayerChangeLevel_6FCDA330_113c,
} from './k2-w8b2-113c.ts'
import {
  ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c,
  ACT3Q1_OnQuestItemPickedUp_6FD07640_113c,
  ACT3Q2_OnGidbinnPickedUp_6FD07770_113c,
  ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c,
  ACT3Q7_OnMephistoKilled_6FD09A10_113c,
} from './k2-w8b4-113c.ts'
import { ACT1Q6_OnAndarielKilled_6FC87E00_113c } from './k2-w9b1-113c.ts'
import { ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c } from './k2-w10b1-113c.ts'
import {
  ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c,
  ACT5Q6_OnBaalKilledCompleteQuestAndSpawnPortal_6FC7FE30_113c,
} from './k2-w16b1-113c.ts'
import { ROOM_SpawnMonsterPreset113c, ROOM_SpawnPresetUnits113c } from './room-presets-113c.ts'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c } from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

/** `D2Game.dll` `.data` `0x6FD2E350`: 16-bit next global game slot index (`1..0x400`). */
const D2GAME_NEXT_GAME_SLOT_VA_113C = 0x6fd2e350

/** `D2Game.dll` `.bss` `0x6FD30BE8`: global game slot critical section address. */
const D2GAME_GLOBAL_GAME_CS_VA_113C = 0x6fd30be8

/** `D2Game.dll` `.bss` `0x6FD30C04`: global game slot table (`uint32[1025]`, indices `1..0x400`). */
const D2GAME_GLOBAL_GAME_SLOTS_VA_113C = 0x6fd30c04

let k2LaneJStackPtr = 0x7e020000

function sx16(v: number): number {
  return (v << 16) >> 16
}

function stepSeed64AtPtr113c(m: Memory113c, pSeed: number): number {
  const addr = pSeed >>> 0
  const lo = m.u32(addr) >>> 0
  const hi = m.u32((addr + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((addr + 4) >>> 0, newHi)
  m.setU32(addr, newLo)
  return newLo
}

/**
 * Optional host boundary hooks for `Fog` / `KERNEL32` primitives and indirect quest callbacks
 * on `Memory113c` (`SparseMemory113c`).
 */
export interface LaneJKernHooks113c {
  readonly onEnterCriticalSection?: (m: Memory113c, pCs: number, nLine: number) => void
  readonly onLeaveCriticalSection?: (m: Memory113c, pCs: number) => void
  readonly onFreeMem?: (m: Memory113c, pMemPool: number, pBlock: number) => void
  readonly isBadCodePtr?: (pfnCallback: number) => number
  readonly onQuestCallback?: (
    m: Memory113c,
    pfnCallback: number,
    pQuest: number,
    pQuestArg: number,
  ) => void
  readonly aiFallen?: AiFallenHooks113c
  readonly objectSpawn?: ObjectSpawnCallees113c
  readonly regpop?: RegpopSpawnHooks113c
}

const DEFAULT_OBJECT_SPAWN_CALLEES_113C: ObjectSpawnCallees113c = {
  initObject(m, pUnit, pGame, nUnitId, pRoom, x, y) {
    OBJECTS_InitObjectUnit113c(m, pUnit, pGame, nUnitId, pRoom, x, y)
  },
  placeServerUnit(m, y, pUnit, pRoom, x, pGame, a2) {
    SUNIT_PlaceServerUnitInRoom113c(m, pRoom, y, pUnit, x, pGame, a2)
  },
}

const DEFAULT_REGPOP_SPAWN_HOOKS_113C: RegpopSpawnHooks113c = {
  getLevelRoomCountInAct(mem, pAct, nLevelId) {
    return DUNGEON_CountNonPresetRoomsInLevel113c(mem, pAct, nLevelId)
  },
}

const DEFAULT_ACT_ROOMS_CALLEES_113C: ActRoomsCallees113c = {
  refreshRoomUnits(mem, pGame, pRoom) {
    ROOM_RefreshUnitsAndLoadSaved113c(mem, pGame, pRoom)
  },
  objects: {
    getLevelRoomCountInAct(mem, pAct, nLevelId) {
      return DUNGEON_CountNonPresetRoomsInLevel113c(mem, pAct, nLevelId)
    },
    checkLevelObjectHook(mem, pLevelObjInfo, pGame, pRoom, nHook) {
      return OBJECTS_CheckLevelObjectHook113c(mem, pLevelObjInfo, pRoom, pGame, nHook)
    },
    spawnObjectsByFn(mem, nFnVa, pGame, pRoom, nDensity, nObjectId, nProb) {
      if (nFnVa === 0x6fc51000) {
        return OBJECTS_FindFreeDropCoordsAndSpawnItem_6FC51000_113c(
          mem,
          pGame,
          pRoom,
          nDensity,
          nObjectId,
          nProb,
        )
      }
      if (nFnVa === 0x6fc527d0) {
        return OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c(
          mem,
          pGame,
          pRoom,
          nObjectId,
          0,
          nProb,
        )
      }
      if (nFnVa === 0x6fc50800) {
        return OBJECTS_PopulateBarrelClustersInRoom_6FC50800_113c(mem, pGame, pRoom, nDensity)
      }
      if (nFnVa === 0x6fc50150) {
        return OBJECTS_PopulateCrateClustersInRoom_6FC50150_113c(mem, pGame, pRoom, nDensity)
      }
      if (nFnVa === 0x6fc53260) {
        return OBJECTS_SpawnDensityWithSecondaryTorch113c(
          mem,
          pGame,
          pRoom,
          nDensity,
          nObjectId,
          nProb,
        )
      }
      if (nFnVa === 0x6fc52df0) {
        return OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c(mem, pGame, pRoom, nObjectId, nProb)
      }
      if (nFnVa === 0x6fc52a10) {
        return OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c(
          mem,
          pGame,
          pRoom,
          nDensity,
          nObjectId,
          nProb,
        )
      }
      if (nFnVa === 0x6fc52bc0) {
        return OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c(
          mem,
          pGame,
          pRoom,
          nDensity,
          nObjectId,
          nProb,
          { objectSpawn: DEFAULT_OBJECT_SPAWN_CALLEES_113C },
        )
      }
      return 0
    },
    spawn: DEFAULT_OBJECT_SPAWN_CALLEES_113C,
  },
  initAmbientMonster(mem, pUnit) {
    const pGame = pUnit !== 0 ? mem.u32((pUnit + 0x80) >>> 0) >>> 0 : 0
    if (pGame !== 0) {
      SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c(mem, pGame, 8, pUnit, 0)
    }
    const pMonData = pUnit !== 0 ? mem.u32((pUnit + 0x14) >>> 0) >>> 0 : 0
    if (pMonData !== 0) {
      const pAiGen = mem.u32((pMonData + 0x28) >>> 0) >>> 0
      if (pAiGen !== 0) {
        mem.setU32(pAiGen, 8)
      }
    }
  },
  presets: {
    spawnMonsterPreset(mem, pRoom, nClassId, pGame, x, y, nMode) {
      return ROOM_SpawnMonsterPreset113c(
        mem,
        pRoom,
        nClassId,
        pGame,
        x,
        y,
        nMode,
        (m2, cid, mode, pg2, pr2, px, py, maxR, wf) =>
          MONSTER_SpawnAtCoords113c(
            m2,
            cid,
            mode,
            pg2,
            pr2,
            px,
            py,
            maxR,
            wf,
            DEFAULT_REGPOP_SPAWN_HOOKS_113C,
          ),
      )
    },
    spawnSpecialObject(mem, nClassId, pGame, pRoom, x, y, nMode) {
      return OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c(
        mem,
        nClassId,
        pGame,
        pRoom,
        x,
        y,
        nMode,
      )
    },
    allocUnitData(mem, nUnitType, nClassId, x, y, pGame, pRoom, a5, nMode, a7) {
      return SUNIT_AllocUnitData113c(
        mem,
        nUnitType,
        nClassId,
        x,
        y,
        pGame,
        pRoom,
        a5,
        nMode,
        a7,
      )
    },
    placePresetItem(mem, ppItem, pGame, pDropArgs, a2) {
      return ITEMS_InitCreatedItemStats_6FC31070_113c(mem, pGame, ppItem, pDropArgs, a2)
    },
    freeUnit(mem, pGame, pUnit) {
      SUNIT_FreeUnit113c(mem, pGame, pUnit)
    },
    initQuestObject1CB(mem, pGame, _pUnit, pSaveChain) {
      ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c(mem, pGame, pSaveChain)
    },
    initQuestObject1CD(mem, pGame, _pUnit, pSaveChain) {
      ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c(mem, pGame, pSaveChain)
    },
    initQuestObject21F(mem, pGame, _pUnit, pSaveChain) {
      ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c(mem, pGame, pSaveChain)
    },
  },
  regpop: DEFAULT_REGPOP_SPAWN_HOOKS_113C,
}

function dispatchQuestCallback113c(
  m: Memory113c,
  pfnCallback: number,
  pQuest: number,
  pQuestArg: number,
  hooks?: LaneJKernHooks113c,
): void {
  const fnVa = pfnCallback >>> 0
  const sm = m as SparseMemory113c
  switch (fnVa) {
    case 0x6fc7a310:
      ACT5Q2_Callback02_MonsterKilled_6FC7A310_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fc7b690:
      QUESTS_Act1AndarielOnDeath_6FC7B690_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fc7bdb0:
      ACT5Q1_OnShenkKilledCompleteQuest_6FC7BDB0_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fc7eed0:
      ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fc7fe30:
      ACT5Q6_OnBaalKilledCompleteQuestAndSpawnPortal_6FC7FE30_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fc80180:
      ACT4_IntroCallback08Noop_6FC80180_113c(m, pQuest, pQuestArg)
      return
    case 0x6fc83570:
      ACT1Q4_OnQuestActivatedUpdatePlayers_6FC83570_113c(sm, pQuest)
      return
    case 0x6fc83730:
      ACT1Q5_OnMoldyTomeActivated_6FC83730_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fc85620:
      ACT1Q2_OnBloodRavenKilled_6FC85620_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fc85760:
      ACT1Q1_OnMonsterKilled_6FC85760_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fc85a70:
      ACT1Q4_Callback02_OnGriswoldDeath_6FC85A70_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fc87e00:
      ACT1Q6_OnAndarielKilled_6FC87E00_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fc88b90:
      ACT1Q5_OnAndarielKilled_6FC88B90_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fcda330:
      ACT4Q1_OnPlayerChangeLevel_6FCDA330_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fcda810:
      ACT4Q2_DropHellforgeHammerAtUnit_6FCDA810_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fcdabf0:
      ACT4Q1_OnIzualKilled_6FCDABF0_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fcdc2c0:
      ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fce1980:
      ACT2Q4_Callback00_Noop_6FCE1980_113c(m, pQuest, pQuestArg)
      return
    case 0x6fce2450:
      ACT2Q2_NoOp_6FCE2450_113c(m)
      return
    case 0x6fce3e10:
      ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fce5f30:
      ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fce66b0:
      ACT2Q5_OnSummonerKilled_6FCE66B0_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fce7540:
      ACT2Q1_OnRadamentKilled_6FCE7540_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fce97d0:
      ACT2Q6_OnDurielKilled_6FCE97D0_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fd02ef0:
      ACT3Q7_Callback11_Noop113c(m, pQuest, pQuestArg)
      return
    case 0x6fd049e0:
      ACT3Q7_Callback14_PlayerJoined113c(m, pQuest, pQuestArg)
      return
    case 0x6fd06190:
      ACT3Q3_OnKhalimRelicPickedUp_6FD06190_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fd07640:
      ACT3Q1_OnQuestItemPickedUp_6FD07640_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fd07770:
      ACT3Q2_OnGidbinnPickedUp_6FD07770_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fd07a40:
      ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fd07af0:
      ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fd07db0:
      ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fd08010:
      ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fd08140:
      ACT3Q2_OnGidbinnBossKilled_6FD08140_113c(sm, pQuest, pQuestArg)
      return
    case 0x6fd09a10:
      ACT3Q7_OnMephistoKilled_6FD09A10_113c(sm, pQuest, pQuestArg)
      return
    default:
      if (hooks !== undefined && hooks.onQuestCallback !== undefined) {
        hooks.onQuestCallback(m, fnVa, pQuest, pQuestArg)
      }
      return
  }
}

function checkIsBadCodePtr113c(pfnCallback: number, hooks?: LaneJKernHooks113c): number {
  if (hooks !== undefined && hooks.isBadCodePtr !== undefined) {
    return hooks.isBadCodePtr(pfnCallback >>> 0) | 0
  }
  return (pfnCallback >>> 0) === 0xffffffff ? 1 : 0
}

/**
 * `monUModCallbackMatrixTable[41][2]` (`ecx = pGame`, `edx = pUnit`, `ret 8`):
 * when `pUnit != 0`, `(m.u8(pUnit + 0xC6) & 1) == 0` (`UNITFLAG_DEAD` clear), and `pUnit` is a
 * living player (`dwUnitType == 0`, `dwAnimMode != 0 && dwAnimMode != 0x11`) or living monster
 * (`dwUnitType == 1`, `dwAnimMode != 0 && dwAnimMode != 0x0C`), schedules initial AI via
 * `MONSTER_ScheduleInitialAiEvent` (`0x6FCCF920`) and registers timer event `7` at
 * `pGame->dwGameFrame + 0x4B` (`+75`).
 *
 * @va D2Game:0x6FC43320
 */
export function MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nUMod = 0,
  _bUnique = 0,
): void {
  hitD2GameVa113c(0x6FC43320)
  const unit = pUnit >>> 0
  if (unit === 0) return
  if ((m.u8((unit + 0xc6) >>> 0) & 1) !== 0) return
  const uType = m.u32(unit) | 0
  if (uType === 0) {
    const mode = m.u32((unit + 0x10) >>> 0) | 0
    if (mode === 0 || mode === 0x11) return
  } else if (uType === 1) {
    const mode = m.u32((unit + 0x10) >>> 0) | 0
    if (mode === 0 || mode === 0x0c) return
  } else {
    return
  }
  MONSTER_ScheduleInitialAiEvent113c(m, pGame >>> 0, unit)
  const targetFrame = (m.u32(((pGame >>> 0) + 0xa8) >>> 0) + 0x4b) >>> 0
  EVENT_SetEventFull113c(m, pGame >>> 0, unit, 7, targetFrame, 0, 0, 0)
}

/**
 * `monUModCallbackMatrixTable[33][1]` (`ecx = pGame`, `edx = pUnit`, `ret 8`):
 * - When `pUnit == 0`, schedules timer event `7` at `pGame->dwGameFrame + 4`.
 * - When `pUnit->dwAnimMode == 3` (`MONMODE_GETHIT`), clears used skill (`D2Common.#11103`),
 *   transitions `pUnit` to `MONMODE_DEATH (0)` (`0x6FC95E10` with `nVelocityPct = 100`), and
 *   schedules timer event `7` at `pGame->dwGameFrame + 4`.
 * - When `pUnit->dwAnimMode == 0` or `0x0C`, schedules timer event `7` at `pGame->dwGameFrame + 4`.
 *
 * @va D2Game:0x6FC43390
 */
export function MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nUMod = 0,
  _bUnique = 0,
): void {
  hitD2GameVa113c(0x6FC43390)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  if (unit === 0) {
    const targetFrame = (m.u32((game + 0xa8) >>> 0) + 4) >>> 0
    EVENT_SetEventFull113c(m, game, 0, 7, targetFrame, 0, 0, 0)
    return
  }
  const mode = m.u32((unit + 0x10) >>> 0) | 0
  if (mode === 3) {
    SKILLS_SetUsedSkillMemPort113c(m, unit, 0)
    MONSTER_StartMode113c(m, game, unit, 0)
    const targetFrame = (m.u32((game + 0xa8) >>> 0) + 4) >>> 0
    EVENT_SetEventFull113c(m, game, unit, 7, targetFrame, 0, 0, 0)
    return
  }
  if (mode === 0 || mode === 0x0c) {
    const targetFrame = (m.u32((game + 0xa8) >>> 0) + 4) >>> 0
    EVENT_SetEventFull113c(m, game, unit, 7, targetFrame, 0, 0, 0)
  }
}

/**
 * `monUModCallbackMatrixTable[34][1]` (`ecx = pGame`, `edx = pUnit`, `ret 8`):
 * self-resurrect death hook. Requires `dwAnimMode == 0` (when `pUnit != 0`) and evil alignment
 * (`UNIT_GetAlignment == 0`), purges existing type-`7` timer nodes from `pUnit->pEventList (+0xDC)`,
 * steps `pUnit->tSeed (+0x20)`, and when `(newLo % 100) < MonStatsTxt.wAid[nDifficulty]` (`+0x80`)
 * schedules timer event `7` at `dwGameFrame + MonStatsTxt.wAIdel[nDifficulty] * 10 + 1` (`+0x56`).
 *
 * @va D2Game:0x6FC43570
 */
export function MONUMOD_RollSelfResurrectEvent7_6FC43570_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nUMod = 0,
  _bUnique = 0,
): void {
  hitD2GameVa113c(0x6FC43570)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  if (unit !== 0) {
    const mode = m.u32((unit + 0x10) >>> 0) | 0
    if (mode !== 0) return
  }
  if (UNIT_GetAlignment113c(m, unit) !== 0) return

  let pMonStatsTxt = 0
  if (unit !== 0) {
    const classId = m.u32((unit + 0x04) >>> 0) | 0
    if (classId >= 0) {
      const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
      const nCount = m.u32((pDataTables + 0xa80) >>> 0) | 0
      if (classId < nCount) {
        const pBase = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
        pMonStatsTxt = (pBase + imul32(classId, 0x1a8)) >>> 0
      }
    }
  }

  if (unit !== 0) {
    let pEv = m.u32((unit + 0xdc) >>> 0) >>> 0
    while (pEv !== 0) {
      const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
      if (m.u8(pEv) === 7) {
        EVENT_FreeNode113c(m, game, pEv)
      }
      pEv = pNext
    }
  }

  const newLo = stepSeed64AtPtr113c(m, (unit + 0x20) >>> 0)
  const roll = (newLo >>> 0) % 100 | 0
  const diff = m.u8((game + 0x6d) >>> 0)
  const chance = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x80) >>> 0))
  if (roll < chance) {
    const aiDel = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0))
    const edx = imul32(aiDel, 5)
    const gameFrame = m.u32((game + 0xa8) >>> 0) >>> 0
    const targetFrame = (gameFrame + imul32(edx, 2) + 1) >>> 0
    EVENT_SetEventFull113c(m, game, unit, 7, targetFrame, 0, 0, 0)
  }
}

/**
 * `monUModCallbackMatrixTable[20][3]` (`ecx = pGame`, `edx = pMissile`, `ret 8`):
 * when `pMissile` is a `UNIT_MISSILE (3)` with `STAT_MAXDAMAGE (0x16) > 0`, `dwFlags2 (+0xC8)` bit
 * `0x400` set, and owner (`+0x94`/`+0x98`) resolved to a Rogue Hireling (`dwClassId == 0x10F`),
 * adds `(ownerSecMin << 8) - 0x100` and `(ownerSecMax << 8) - 0x100` (`0x17`/`0x18`, clamped `>= 0`)
 * to `pMissile` stats `0x15` and `0x16`.
 *
 * @va D2Game:0x6FC43670
 */
export function MONUMOD_AddRogueOwnerSecondaryDamageToMissile_6FC43670_113c(
  m: Memory113c,
  pGame: number,
  pMissile: number,
  _nUMod = 0,
  _bUnique = 0,
): void {
  hitD2GameVa113c(0x6FC43670)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  if (mis === 0) return
  if (m.u32(mis) !== 3) return

  const minDmg = STATLIST_GetUnitStat113c(m, mis, 0x15, 0) | 0
  const maxDmg = STATLIST_GetUnitStat113c(m, mis, 0x16, 0) | 0
  if (maxDmg <= 0) return

  const dwFlags2 = m.u32((mis + 0xc8) >>> 0) >>> 0
  if (((dwFlags2 >>> 10) & 1) === 0) return

  const ownerType = m.u32((mis + 0x94) >>> 0) >>> 0
  const ownerId = m.u32((mis + 0x98) >>> 0) >>> 0
  const pOwner = SUNIT_GetServerUnit113c(m, game, ownerType, ownerId) >>> 0
  if (pOwner === 0) return
  if (m.u32((pOwner + 0x04) >>> 0) !== 0x10f) return

  const secMin = STATLIST_GetUnitStat113c(m, pOwner, 0x17, 0) | 0
  const secMax = STATLIST_GetUnitStat113c(m, pOwner, 0x18, 0) | 0
  let newMin = (minDmg + (secMin << 8) - 0x100) | 0
  let newMax = ((secMax << 8) + maxDmg - 0x100) | 0
  if (newMin < 0) newMin = 0
  if (newMax < 0) newMax = 0

  STATLIST_SetUnitStat113c(m, mis, 0x15, newMin, 0)
  STATLIST_SetUnitStat113c(m, mis, 0x16, newMax, 0)
}

/**
 * `monUModTable[41]` (`ecx = pUnit`, `[esp+4] = _bUnique`, `ret 4`):
 * when `pUnit` is a monster (`dwUnitType == 1`) with `pGame = pUnit->pGame (+0x80) != 0`,
 * schedules timer event `7` at `pGame->dwGameFrame + 0x4B` (`+75`).
 *
 * @va D2Game:0x6FC469F0
 */
export function MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c(
  m: Memory113c,
  pUnit: number,
  _bUnique = 0,
): void {
  hitD2GameVa113c(0x6FC469F0)
  const unit = pUnit >>> 0
  if (unit === 0) return
  if (m.u32(unit) !== 1) return
  const pGame = m.u32((unit + 0x80) >>> 0) >>> 0
  if (pGame === 0) return
  const targetFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x4b) >>> 0
  EVENT_SetEventFull113c(m, pGame, unit, 7, targetFrame, 0, 0, 0)
}

/**
 * Checks whether `pUnit` (`eax`) is dual-wielding two Assassin claws (`ITEMTYPE_HAND_TO_HAND = 0x2E`)
 * across hand slots `6` and `5` on `pUnit->pInventory (+0x60)`.
 *
 * @va D2Game:0x6FC46A30
 */
export function PLRMODE_IsDualWieldingClaws_6FC46A30_113c(
  m: Memory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FC46A30)
  const pInventory = m.u32(((pUnit >>> 0) + 0x60) >>> 0) >>> 0
  if (pInventory === 0) return 0
  const pSlot6 = INVENTORY_GetWeaponByHandSlotMemPort113c(m, pInventory, 6) >>> 0
  const pSlot5 = INVENTORY_GetWeaponByHandSlotMemPort113c(m, pInventory, 5) >>> 0
  if (pSlot6 === 0) return 0
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pSlot6, 0x2e) === 0) return 0
  if (pSlot5 === 0) return 0
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pSlot5, 0x2e) === 0) return 0
  return 1
}

/**
 * Validates whether `nSkillId` (`eax`) on `pUnit` (`[esp+4]`) may target subtile `(nX, nY)`
 * (`[esp+8]`, `edi`, `ret 8`): looks up `SkillsTxt[nSkillId]`, locates the room containing
 * `(nX, nY)` via `0x6FC21280`, and rejects town rooms unless `SkillsTxt.bInTown` (`+0x05 & gdwBitMasks[0]`) is set.
 *
 * @va D2Game:0x6FC46B30
 */
export function PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c(
  m: Memory113c,
  nSkillId: number,
  nY: number,
  pUnit: number,
  nX: number,
): number {
  hitD2GameVa113c(0x6FC46B30)
  const id = nSkillId | 0
  if (id < 0) return 0
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  const nSkillsCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (id >= nSkillsCount) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsBase + imul32(id, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  if (pRoom === 0) return 0
  const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pRoom, nX | 0, nY | 0) >>> 0
  if (pTargetRoom === 0) return 0

  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const bSkillFlags1 = m.u8((pSkillsTxt + 0x05) >>> 0)
  if ((m.u8(pBitMasks) & bSkillFlags1) === 0) {
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pTargetRoom) !== 0) {
      return 0
    }
  }
  return 1
}

/**
 * Configures retreat / knockback-away pathing (`PATHTYPE = 8`, distance `5`) on `pUnit` (`[esp+8]`)
 * away from the target unit stored in `pSkill` (`eax`, `dwParam3`/`dwParam4`), projecting destination
 * `(3 * nX - 2 * targetX, 3 * nY - 2 * targetY)` and rejecting town target rooms (`ret 0x10`).
 *
 * @va D2Game:0x6FC47030
 */
export function PLRMODE_SetupRetreatFromSkillTargetPath_6FC47030_113c(
  m: Memory113c,
  pSkill: number,
  pGame: number,
  pUnit: number,
  nX: number,
  nY: number,
): number {
  hitD2GameVa113c(0x6FC47030)
  const skill = pSkill >>> 0
  if (skill === 0) return 0
  const unit = pUnit >>> 0
  const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0
  if (pPath === 0) return 0

  const targetId = SKILLS_GetParam4113c(m, skill) >>> 0
  const targetType = SKILLS_GetParam3113c(m, skill) >>> 0
  const pTarget = SUNIT_GetServerUnit113c(m, pGame >>> 0, targetType, targetId) >>> 0
  if (pTarget === 0) return 0

  SKILLS_SetParam0C113c(m, skill, 1)
  UNITS_SetSeqFrameFromLowByte113c(m, unit, 0x0c)
  const frame48 = ((m.u32((unit + 0x48) >>> 0) & 0xffffff00) + 0x100) >>> 0
  m.setU32((unit + 0x48) >>> 0, frame48)

  PATH_SnapToSubtileCenter113c(m, pPath)
  PATH_SetNewDistance113c(m, pPath, 5)
  PATH_SetStepNum113c(m, pPath, 1)
  PATH_SetTargetUnit113c(m, pPath, 0)

  const tx2 = (UNIT_GetPosX113c(m, pTarget) << 1) | 0
  const destX = (imul32(nX | 0, 3) - tx2) | 0
  const ty2 = (UNIT_GetPosY113c(m, pTarget) << 1) | 0
  const destY = (imul32(nY | 0, 3) - ty2) | 0

  const pRoom = UNITS_GetRoom113c(m, unit) >>> 0
  const pDestRoom = ROOM_FindRoomContainingSubtile113c(m, pRoom, destX, destY) >>> 0
  if (pDestRoom !== 0) {
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pDestRoom) !== 0) {
      return 0
    }
  }

  PATH_SetTargetPos113c(m, pPath, destX, destY)
  PATH_SetType113c(m, pPath, 8)
  PATH_SetDistance113c(m, pPath, 5)
  PATH_Compute113c(m, pPath, unit, 0)
  return 1
}

/**
 * `skillsSrvStFuncTable[34]` (`ecx = pGame`, `edx = pUnit`, `ret 8`):
 * validates `pUnit`'s path target (`0x6FD007A0`) and returns `1` iff `pTarget != 0`, `pTarget != pUnit`,
 * and `D2Common.#10678` (`SKILLS_IsSelectableCorpse10678`) is non-zero.
 *
 * @va D2Game:0x6FC47240
 */
export function SKILLS_SrvSt34_CheckSelectableCorpseTarget_6FC47240_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FC47240)
  const unit = pUnit >>> 0
  SUNIT_ValidatePathTargetUnit113c(m, unit, pGame >>> 0)
  const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === unit || pTarget === 0) return 0
  return SKILLS_IsSelectableCorpse10678_113c(m, pTarget) !== 0 ? 1 : 0
}

/**
 * `skillsSrvStFuncTable[33]` (`ecx = pGame`, `edx = pUnit`, `ret 8`):
 * validates `pUnit`'s path target (`0x6FD007A0`) and returns `D2Common.#10096`
 * (`SKILLS_IsSelectableCorpseWithFlag12`) when `pTarget != 0`, `pTarget != pUnit`, and state `0x76`
 * (`STATE_CORPSE_NOSELECT`) is not active on `pTarget`, or `0` otherwise.
 *
 * @va D2Game:0x6FC47270
 */
export function SKILLS_SrvSt33_CheckSelectableCorpseNoState76_6FC47270_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FC47270)
  const unit = pUnit >>> 0
  SUNIT_ValidatePathTargetUnit113c(m, unit, pGame >>> 0)
  const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === unit || pTarget === 0) return 0
  const selectable = SKILLS_IsSelectableCorpseWithFlag12_113c(m, pTarget)
  if (selectable === 0) return 0
  if (STATES_CheckState113c(m, pTarget, 0x76) !== 0) return 0
  return selectable
}

/**
 * Executes a monster melee skill swing against `pDefender` (`eax = pDefender`, `ecx = pAttacker`,
 * `ebx = pSkill`, `[esp+4] = pGame`, `ret 4`): applies monster combat stats (`0x6FC97240` with `bFlag = 4`),
 * runs `MONSTER_ExecuteMeleeSwing` (`0x6FC97790`) + `SUNITDMG_ExecuteEvents` (`0x6FCFED30`), and records
 * `pDefender->dwUnitType` / `dwUnitId` into `pSkill` `dwParam3` / `dwParam4`.
 *
 * @va D2Game:0x6FC479C0
 */
export function PLRMODE_ExecuteMonsterMeleeSkillHit_6FC479C0_113c(
  m: Memory113c,
  pDefender: number,
  pAttacker: number,
  pSkill: number,
  pGame: number,
  hooks?: LaneJKernHooks113c,
): number {
  hitD2GameVa113c(0x6FC479C0)
  const def = pDefender >>> 0
  const sk = pSkill >>> 0
  if (def === 0 || sk === 0) return 0
  const att = pAttacker >>> 0
  const game = pGame >>> 0
  MONSTER_ApplyElementalDamageAndResistStats113c(m, game, att, 4)
  MONSTER_ExecuteMeleeSwing113c(
    m,
    att,
    game,
    undefined,
    hooks !== undefined ? hooks.aiFallen : undefined,
  )
  SUNITDMG_ExecuteEvents113c(m, game, att, def)
  const defType = m.u32(def) >>> 0
  SKILLS_SetParam3113c(m, sk, defType)
  const defId = m.u32((def + 0x0c) >>> 0) >>> 0
  SKILLS_SetParam4113c(m, sk, defId)
  return 1
}

/**
 * Releases `pGame->pGameLock` (`[pGame + 0x18]`, `eax = pGame`), asserting at lines `0x100E` (`4110`)
 * when `pGame == NULL` and `0x100F` (`4111`) when `pGame->pGameLock == NULL`.
 *
 * @va D2Game:0x6FC49BA0
 */
export function GAME_LeaveGameCriticalSection_6FC49BA0_113c(
  m: Memory113c,
  pGame: number,
  hooks?: LaneJKernHooks113c,
): void {
  hitD2GameVa113c(0x6FC49BA0)
  const game = pGame >>> 0
  if (game === 0) {
    throw new D2CommonAssertError('Game.cpp', 4110)
  }
  const pLock = m.u32((game + 0x18) >>> 0) >>> 0
  if (pLock === 0) {
    throw new D2CommonAssertError('Game.cpp', 4111)
  }
  if (hooks !== undefined && hooks.onLeaveCriticalSection !== undefined) {
    hooks.onLeaveCriticalSection(m, pLock)
  }
}

/**
 * Reserves the next free 16-bit global game slot (`1..0x400`) in `0x6FD30C04`, advancing and wrapping
 * `gwNextGameSlotIndex` (`0x6FD2E350`), marking `0x6FD30C04[slot] = 0xFFFFFFFF`, and returning the
 * reserved `uint16` slot index (or `0` if all slots cycled back to the starting index).
 *
 * @va D2Game:0x6FC4A220
 */
export function GAME_ReserveGlobalGameSlot_6FC4A220_113c(
  m: Memory113c,
  hooks?: LaneJKernHooks113c,
): number {
  hitD2GameVa113c(0x6FC4A220)
  if (hooks !== undefined && hooks.onEnterCriticalSection !== undefined) {
    hooks.onEnterCriticalSection(m, D2GAME_GLOBAL_GAME_CS_VA_113C, 0x19b)
  }
  let esi = m.u32(D2GAME_NEXT_GAME_SLOT_VA_113C) >>> 0
  let ax = ((esi & 0xffff) + 1) & 0xffff
  const startCx = esi & 0xffff
  m.setU16(D2GAME_NEXT_GAME_SLOT_VA_113C, ax)
  if (ax > 0x400) {
    ax = 1
    m.setU16(D2GAME_NEXT_GAME_SLOT_VA_113C, ax)
  }
  let slot = esi & 0xffff
  let entry = m.u32((D2GAME_GLOBAL_GAME_SLOTS_VA_113C + slot * 4) >>> 0) >>> 0
  while (entry !== 0) {
    esi = m.u32(D2GAME_NEXT_GAME_SLOT_VA_113C) >>> 0
    ax = (ax + 1) & 0xffff
    m.setU16(D2GAME_NEXT_GAME_SLOT_VA_113C, ax)
    if (ax > 0x400) {
      ax = 1
      m.setU16(D2GAME_NEXT_GAME_SLOT_VA_113C, ax)
    }
    slot = esi & 0xffff
    if (slot === startCx) {
      if (hooks !== undefined && hooks.onLeaveCriticalSection !== undefined) {
        hooks.onLeaveCriticalSection(m, D2GAME_GLOBAL_GAME_CS_VA_113C)
      }
      return 0
    }
    entry = m.u32((D2GAME_GLOBAL_GAME_SLOTS_VA_113C + slot * 4) >>> 0) >>> 0
  }
  m.setU32((D2GAME_GLOBAL_GAME_SLOTS_VA_113C + slot * 4) >>> 0, 0xffffffff)
  if (hooks !== undefined && hooks.onLeaveCriticalSection !== undefined) {
    hooks.onLeaveCriticalSection(m, D2GAME_GLOBAL_GAME_CS_VA_113C)
  }
  return slot
}

/**
 * Commits `dwGameValue` (`[esp+4]`) into reserved global game slot `wSlotIndex` (`[esp+8]`, `ret 8`)
 * at `0x6FD30C04[wSlotIndex]`, asserting at line `0x185` (`389`) if the slot is not `0xFFFFFFFF`.
 *
 * @va D2Game:0x6FC4A2D0
 */
export function GAME_CommitGlobalGameSlot_6FC4A2D0_113c(
  m: Memory113c,
  dwGameValue: number,
  wSlotIndex: number,
  hooks?: LaneJKernHooks113c,
): void {
  hitD2GameVa113c(0x6FC4A2D0)
  if (hooks !== undefined && hooks.onEnterCriticalSection !== undefined) {
    hooks.onEnterCriticalSection(m, D2GAME_GLOBAL_GAME_CS_VA_113C, 0x17f)
  }
  const slot = wSlotIndex & 0xffff
  const addr = (D2GAME_GLOBAL_GAME_SLOTS_VA_113C + slot * 4) >>> 0
  if (m.u32(addr) !== 0xffffffff) {
    throw new D2CommonAssertError('Game.cpp', 389)
  }
  m.setU32(addr, dwGameValue >>> 0)
  if (hooks !== undefined && hooks.onLeaveCriticalSection !== undefined) {
    hooks.onLeaveCriticalSection(m, D2GAME_GLOBAL_GAME_CS_VA_113C)
  }
}

/**
 * Client-list iteration callback (`__fastcall(pClient, ppOutClient)`): asserts `pClient != NULL`
 * (line `0xBA6` = `2982`) and stores `pClient` to `*ppOutClient` when `pClient->dwClientFlags (+0x3D4)`
 * has bit `0x20` set.
 *
 * @va D2Game:0x6FC4A700
 */
export function CLIENT_SelectFlag20ClientCallback_6FC4A700_113c(
  m: Memory113c,
  pClient: number,
  ppOutClient: number,
): void {
  hitD2GameVa113c(0x6FC4A700)
  const client = pClient >>> 0
  if (client === 0) {
    throw new D2CommonAssertError('Clients.cpp', 2982)
  }
  if ((m.u8((client + 0x3d4) >>> 0) & 0x20) !== 0) {
    m.setU32(ppOutClient >>> 0, client)
  }
}

/**
 * Client-list iteration callback (`__fastcall(pClient, pUnit)`): if `pUnit != 0` is non-missile
 * (`(pUnit->dwUnitType & 0xFF) != 3`) and `UNITS_GetRoom(pUnit)` appears in the adjacent room array
 * of `pClient->pRoom (+0x1B4)`, queues the 6-byte S2C `0x0A` unit-remove packet
 * `[0x0A, u8(dwUnitType), u32(dwUnitId)]` to `pClient`.
 *
 * @va D2Game:0x6FC4A9F0
 */
export function CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c(
  m: Memory113c,
  pClient: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FC4A9F0)
  const unit = pUnit >>> 0
  if (unit === 0) return
  const client = pClient >>> 0
  const pUnitRoom = UNITS_GetRoom113c(m, unit) >>> 0
  const pClientRoom = m.u32((client + 0x1b4) >>> 0) >>> 0
  if (pClientRoom === 0) {
    throw new D2CommonAssertError('Clients.cpp', 5483)
  }

  const savedSp = k2LaneJStackPtr
  const pNearCount = savedSp
  const pppRoomsNear = (savedSp + 4) >>> 0
  const pPkt = (savedSp + 8) >>> 0
  k2LaneJStackPtr = (savedSp + 16) >>> 0
  try {
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pClientRoom, pppRoomsNear, pNearCount)
    const nNear = m.u32(pNearCount) >>> 0
    if (nNear === 0) return
    const pRoomsArr = m.u32(pppRoomsNear) >>> 0
    let found = false
    for (let i = 0; i < nNear; i++) {
      const pAdj = m.u32((pRoomsArr + i * 4) >>> 0) >>> 0
      if (pAdj === 0) {
        throw new D2CommonAssertError('Clients.cpp', 5488)
      }
      if (pUnitRoom === pAdj) {
        found = true
        break
      }
    }
    if (!found) return

    const uTypeByte = m.u32(unit) & 0xff
    const uGuid = m.u32((unit + 0x0c) >>> 0) >>> 0
    if (uTypeByte === 3) return

    m.setU8(pPkt, 0x0a)
    m.setU8((pPkt + 1) >>> 0, uTypeByte)
    m.setU32((pPkt + 2) >>> 0, uGuid)
    NET_QueuePacketToClientBuffer113c(m, client, 1, pPkt, 6)
  } finally {
    k2LaneJStackPtr = savedSp
  }
}

/**
 * Resolves `pLeavingClient`'s player unit (`eax = pLeavingClient`, `[esp+4] = pGame`, `ret 4`) via
 * `+0x174` directly when `dwClientFlags (+0x3D4) & 1` is set (else re-validating `(+0x1A8, +0x16C, +0x170)`
 * with `SUNIT_GetServerUnit`, zeroing `+0x174` if missing), and queues the 5-byte S2C `0x5C`
 * player-left packet `[0x5C, u32(dwPlayerUnitId)]` to every in-game (`+0x04 == 4`) client on `pGame + 0x88`.
 *
 * @va D2Game:0x6FC4BED0
 */
export function CLIENT_BroadcastPlayerLeftPacket5C_6FC4BED0_113c(
  m: Memory113c,
  pLeavingClient: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC4BED0)
  const client = pLeavingClient >>> 0
  if (client === 0) {
    throw new D2CommonAssertError('Clients.cpp', 251)
  }
  let pPlayerUnit = 0
  if ((m.u8((client + 0x3d4) >>> 0) & 1) !== 0) {
    pPlayerUnit = m.u32((client + 0x174) >>> 0) >>> 0
  } else {
    const cachedUnit = m.u32((client + 0x174) >>> 0) >>> 0
    if (cachedUnit === 0) return
    const clientGame = m.u32((client + 0x1a8) >>> 0) >>> 0
    const unitType = m.u32((client + 0x16c) >>> 0) >>> 0
    const unitId = m.u32((client + 0x170) >>> 0) >>> 0
    const pFound = SUNIT_GetServerUnit113c(m, clientGame, unitType, unitId) >>> 0
    if (pFound === 0) {
      m.setU32((client + 0x174) >>> 0, 0)
    }
    pPlayerUnit = pFound
  }
  if (pPlayerUnit === 0) return

  let pPeer = m.u32(((pGame >>> 0) + 0x88) >>> 0) >>> 0
  if (pPeer === 0) return

  const savedSp = k2LaneJStackPtr
  const pPkt = savedSp
  k2LaneJStackPtr = (savedSp + 8) >>> 0
  try {
    while (pPeer !== 0) {
      if (m.u32((pPeer + 0x04) >>> 0) === 4) {
        const playerGuid = m.u32((pPlayerUnit + 0x0c) >>> 0) >>> 0
        m.setU8(pPkt, 0x5c)
        m.setU32((pPkt + 1) >>> 0, playerGuid)
        NET_QueuePacketToClientBuffer113c(m, pPeer, 1, pPkt, 5)
      }
      pPeer = m.u32((pPeer + 0x4a8) >>> 0) >>> 0
    }
  } finally {
    k2LaneJStackPtr = savedSp
  }
}

/**
 * Single-room population helper (`eax = pRoom`, `edi = pGame`, plain `ret`):
 * calls `ROOM_TickSeedAndAmbientSpawn` (`0x6FC67950`), then either populates an unpopulated room
 * (`(pRoom->dwFlags & 1) == 0`: presets `0x6FD01430`, saved refresh `0x6FC400E0`, objects `0x6FC4F0D0`,
 * monsters `0x6FC67A20`, sets `dwFlags |= 1`, and `DUNGEON_SetRoomFlag2(pRoom, 1)`), or refreshes saved
 * units + sets flag `2` when `DUNGEON_CheckRoomFlag2(pRoom) == 0`.
 *
 * @va D2Game:0x6FC4CB80
 */
export function DRLG_PopulateSingleRoom_6FC4CB80_113c(
  m: Memory113c,
  pRoom: number,
  pGame: number,
  callees: ActRoomsCallees113c = DEFAULT_ACT_ROOMS_CALLEES_113C,
): void {
  hitD2GameVa113c(0x6FC4CB80)
  const room = pRoom >>> 0
  const game = pGame >>> 0
  ROOM_TickSeedAndAmbientSpawn113c(m, room, game, callees)
  if ((m.u8((room + 0x34) >>> 0) & 1) === 0) {
    ROOM_SpawnPresetUnits113c(m, game, room, callees.presets)
    callees.refreshRoomUnits(m, game, room)
    OBJECTS_PopulateRoom113c(m, game, room, callees.objects)
    REGPOP_PopulateRoomMonsters113c(m, game, room, callees.regpop)
    const newFlags = (m.u32((room + 0x34) >>> 0) | 1) >>> 0
    m.setU32((room + 0x34) >>> 0, newFlags)
    DUNGEON_SetRoomFlag2_113c(m, room, 1)
    return
  }
  if (DUNGEON_CheckRoomFlag2_113c(m, room) === 0) {
    callees.refreshRoomUnits(m, game, room)
    DUNGEON_SetRoomFlag2_113c(m, room, 1)
  }
}

/**
 * Validates that candidate object position `pPos` (`esi`: `{ x, y }`) lies strictly inside
 * `pRoomCoords` (`eax`: `{ subX, subY, subW, subH }`) with a 2-subtile border margin and has
 * zero `0x3F11` collision across `(nSizeX + 2) x (nSizeY + 2)` in `pRoom` (`ret 0x0C`).
 *
 * @va D2Game:0x6FC4E5D0
 */
export function OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c(
  m: Memory113c,
  pRoomCoords: number,
  pPos: number,
  pRoom: number,
  nSizeX: number,
  nSizeY: number,
): number {
  hitD2GameVa113c(0x6FC4E5D0)
  const rc = pRoomCoords >>> 0
  const pos = pPos >>> 0
  const subW = m.u32((rc + 0x08) >>> 0) | 0
  if (subW < 2) return 0
  const subH = m.u32((rc + 0x0c) >>> 0) | 0
  if (subH < 2) return 0

  const subX = m.u32(rc) | 0
  const posX16 = m.u16(pos)
  if (posX16 <= ((subX + 2) | 0)) return 0

  const subY = m.u32((rc + 0x04) >>> 0) | 0
  const posY16 = m.u16((pos + 0x04) >>> 0)
  if (posY16 <= ((subY + 2) | 0)) return 0

  const sizeX = nSizeX | 0
  const maxX = (((subX - sizeX) | 0) + subW) | 0
  if (posX16 >= maxX) return 0

  const sizeY = nSizeY | 0
  const maxY = (((subY - sizeY) | 0) + subH) | 0
  if (posY16 >= maxY) return 0

  const x = m.u32(pos) | 0
  const y = m.u32((pos + 0x04) >>> 0) | 0
  const hit = COLLISION_CheckMaskWithSizeXY113c(
    m,
    pRoom >>> 0,
    x,
    y,
    (sizeX + 2) | 0,
    (sizeY + 2) | 0,
    0x3f11,
  )
  return (hit & 0xffff) === 0 ? 1 : 0
}

/**
 * Validates that candidate object position `pPos` (`esi`: `{ x, y }`) fits inside `pRoomCoords`
 * (`eax`) with `(nSizeX, nSizeY)` (`edi`, `[esp+8]`) and passes both a `(nSizeX + 7) x (nSizeY + 7)`
 * `0x0C01` clearance check and an exact `nSizeX x nSizeY` `0x3F11` collision check in `pRoom` (`ret 8`).
 *
 * @va D2Game:0x6FC4E660
 */
export function OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c(
  m: Memory113c,
  pRoomCoords: number,
  pPos: number,
  nSizeX: number,
  pRoom: number,
  nSizeY: number,
): number {
  hitD2GameVa113c(0x6FC4E660)
  const rc = pRoomCoords >>> 0
  const pos = pPos >>> 0
  const sizeX = nSizeX | 0
  const subW = m.u32((rc + 0x08) >>> 0) | 0
  if (subW < ((sizeX + 2) | 0)) return 0

  const sizeY = nSizeY | 0
  const subH = m.u32((rc + 0x0c) >>> 0) | 0
  if (subH < ((sizeY + 2) | 0)) return 0

  const subX = m.u32(rc) | 0
  const posX16 = m.u16(pos)
  if (posX16 <= ((subX + 1) | 0)) return 0

  const subY = m.u32((rc + 0x04) >>> 0) | 0
  const posY16 = m.u16((pos + 0x04) >>> 0)
  if (posY16 <= ((subY + 1) | 0)) return 0

  const maxX = (((subX - sizeX) | 0) + subW - 2) | 0
  if (m.u16(pos) >= maxX) return 0

  const maxY = (((subY - sizeY) | 0) + subH - 2) | 0
  if (posY16 >= maxY) return 0

  const room = pRoom >>> 0
  const hitWide = COLLISION_CheckMaskWithSizeXY113c(
    m,
    room,
    m.u32(pos) | 0,
    m.u32((pos + 0x04) >>> 0) | 0,
    (sizeX + 7) | 0,
    (sizeY + 7) | 0,
    0x0c01,
  )
  if ((hitWide & 0xffff) !== 0) return 0

  const hitExact = COLLISION_CheckMaskWithSizeXY113c(
    m,
    room,
    m.u32(pos) | 0,
    m.u32((pos + 0x04) >>> 0) | 0,
    sizeX,
    sizeY,
    0x3f11,
  )
  return (hitExact & 0xffff) === 0 ? 1 : 0
}

/**
 * `Objects.txt` `InitFn` 26 (`0x6FD2E0B8`, `ecx = pObjInit`): transitions `pObjInit->pObject (+0x04)`
 * into animation mode `1` (`OBJMODE_OPERATING`).
 *
 * @va D2Game:0x6FC4E730
 */
export function OBJECTS_InitFn26_SetAnimMode1_6FC4E730_113c(
  m: Memory113c,
  pObjInit: number,
): number {
  hitD2GameVa113c(0x6FC4E730)
  const pObject = m.u32(((pObjInit >>> 0) + 0x04) >>> 0) >>> 0
  return UNITS_ChangeAnimMode113c(m, pObject, 1)
}

/**
 * `Objects.txt` `InitFn` 14 (`0x6FD2E088`, `ecx = pObjInit`): transitions `pObjInit->pObject (+0x04)`
 * into animation mode `1` (`OBJMODE_OPERATING`).
 *
 * @va D2Game:0x6FC4E740
 */
export function OBJECTS_InitFn14_SetAnimMode1_6FC4E740_113c(
  m: Memory113c,
  pObjInit: number,
): number {
  hitD2GameVa113c(0x6FC4E740)
  const pObject = m.u32(((pObjInit >>> 0) + 0x04) >>> 0) >>> 0
  return UNITS_ChangeAnimMode113c(m, pObject, 1)
}

/**
 * `Objects.txt` `InitFn` 34 (`0x6FD2E0D8`, `ecx = pObjInit`): steps `pGame->pObjectControl->tSeed`
 * (`[pGame + 0x10F0]`) and transitions `pObjInit->pObject (+0x04)` to animation mode `1` when `(newLo & 1) != 0`.
 *
 * @va D2Game:0x6FC4EC70
 */
export function OBJECTS_InitFn34_RandomSetAnimMode1_6FC4EC70_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC4EC70)
  const initPtr = pObjInit >>> 0
  const pGame = m.u32(initPtr) >>> 0
  const pObjCtrl = m.u32((pGame + 0x10f0) >>> 0) >>> 0
  const newLo = stepSeed64AtPtr113c(m, pObjCtrl)
  if ((newLo & 1) !== 0) {
    const pObject = m.u32((initPtr + 0x04) >>> 0) >>> 0
    UNITS_ChangeAnimMode113c(m, pObject, 1)
  }
}

/**
 * `Objects.txt` `InitFn` 57 (`0x6FD2E134`, `ecx = pObjInit`): runs `OBJECTS_InitChestLockAndSeed`
 * (`0x6FC4ECB0`), asserts `pObject != NULL` (line `0xA48` = `2632`), and sets `pObject + 0x78 = 1`
 * (special / sparkly chest flag).
 *
 * @va D2Game:0x6FC4EF50
 */
export function OBJECTS_InitFn57_InitSpecialChest_6FC4EF50_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC4EF50)
  const initPtr = pObjInit >>> 0
  OBJECTS_InitChestLockAndSeed113c(m, initPtr)
  const pObject = m.u32((initPtr + 0x04) >>> 0) >>> 0
  if (pObject === 0) {
    throw new D2CommonAssertError('ObjMode.cpp', 2632)
  }
  m.setU8((pObject + 0x78) >>> 0, 1)
}

/**
 * `OBJECTS_SPAWN_FN_TABLE_6FD2E190[9]` (`ecx = pGame`, `edx = pRoom`, `[esp+4] = nDensity`,
 * `[esp+8] = nObjectId`, `[esp+0xC] = nProb`, `ret 0x0C`): asserts `(nDensity & 0xFF) <= 0x80`
 * (line `0x893` = `2195`), rolls `(step(pRoom->tSeed) % 100) <= (nProb & 0xFFFF)`, computes attempt
 * count `(((subH * subW) >> 7) * (nDensity & 0xFF)) >> 8`, and attempts `OBJECTS_SpawnRandomObjectInRoom`
 * (`0x6FC51E20`) until the first non-null spawn succeeds, updating bit `0x02` (`UNITFLAG_ISVALIDTARGET`)
 * on `pObj + 0xC4` from `ObjectsTxt.bSelectable[mode]` (`+0xC4`).
 *
 * @va D2Game:0x6FC52BC0
 */
export function OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
  nDensity: number,
  nObjectId: number,
  nProb: number,
  hooks?: LaneJKernHooks113c,
): number {
  hitD2GameVa113c(0x6FC52BC0)
  const densByte = nDensity & 0xff
  if (densByte > 0x80) {
    throw new D2CommonAssertError('ObjMode.cpp', 2195)
  }
  const game = pGame >>> 0
  const room = pRoom >>> 0
  const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjectId | 0) >>> 0
  const sizeX = m.u32((pObjectsTxt + 0xd0) >>> 0) | 0
  const sizeY = m.u32((pObjectsTxt + 0xd4) >>> 0) | 0

  const savedSp = k2LaneJStackPtr
  const pCoords = savedSp
  k2LaneJStackPtr = (savedSp + 32) >>> 0
  let roomW = 0
  let roomH = 0
  try {
    DUNGEON_GetRoomCoordinates113c(m, room, pCoords)
    roomW = m.u32((pCoords + 0x08) >>> 0) | 0
    roomH = m.u32((pCoords + 0x0c) >>> 0) | 0
  } finally {
    k2LaneJStackPtr = savedSp
  }

  const pSeed = room !== 0 ? (room + 0x6c) >>> 0 : 0
  const newLo = stepSeed64AtPtr113c(m, pSeed)
  const probRoll = (newLo >>> 0) % 100
  if (probRoll > (nProb & 0xffff)) {
    return 0
  }

  const areaScaled = imul32(roomH, roomW) >> 7
  let attempts = imul32(areaScaled, densByte) >> 8
  if (attempts <= 0) {
    return 0
  }

  const spawnCallees =
    hooks !== undefined && hooks.objectSpawn !== undefined
      ? hooks.objectSpawn
      : DEFAULT_OBJECT_SPAWN_CALLEES_113C

  while (attempts > 0) {
    const pObj =
      hooks !== undefined &&
      hooks.regpop !== undefined &&
      hooks.regpop.onSpawnRandomObjectInRoom !== undefined
        ? hooks.regpop.onSpawnRandomObjectInRoom(m, sizeX, sizeY, nObjectId | 0, game, 0, room) >>>
          0
        : OBJECTS_SpawnRandomObjectInRoom113c(
            m,
            game,
            nObjectId | 0,
            sizeX,
            sizeY,
            room,
            spawnCallees,
          ) >>> 0
    if (pObj !== 0) {
      const mode = m.u32((pObj + 0x10) >>> 0) | 0
      const selectable = m.u8((pObjectsTxt + mode + 0xc4) >>> 0)
      const curFlags = m.u32((pObj + 0xc4) >>> 0) >>> 0
      if (selectable !== 0) {
        m.setU32((pObj + 0xc4) >>> 0, (curFlags | 2) >>> 0)
      } else {
        m.setU32((pObj + 0xc4) >>> 0, (curFlags & 0xfffffffd) >>> 0)
      }
      return pObj
    }
    attempts = (attempts - 1) | 0
  }
  return 0
}

/**
 * `Objects.txt` `InitFn` 51 (`0x6FD2E11C`, `ecx = pObjInit`): when `pObject = pObjInit->pObject (+0x04)`
 * is non-null and has `dwAnimMode == 2` (`OBJMODE_OPENED`) or `1` (`OBJMODE_OPERATING`), schedules
 * timer event `9` at `pGame->dwGameFrame + 0x23` (`+35`).
 *
 * @va D2Game:0x6FC532F0
 */
export function OBJECTS_InitFn51_ScheduleEvent9IfOperatingOrOpened_6FC532F0_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC532F0)
  const initPtr = pObjInit >>> 0
  const pObject = m.u32((initPtr + 0x04) >>> 0) >>> 0
  if (pObject === 0) return
  const mode = m.u32((pObject + 0x10) >>> 0) | 0
  if (mode !== 2 && mode !== 1) return
  const pGame = m.u32(initPtr) >>> 0
  const targetFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x23) >>> 0
  EVENT_SetEventFull113c(m, pGame, pObject, 9, targetFrame, 0, 0, 0)
}

/**
 * `Objects.txt` `InitFn` 11 (`0x6FD2E07C`, `ecx = pObjInit` — Town Portal):
 * resolves the Act's town level ID from `pObjInit->pRoom (+0x08)`, asserts `<= 0xFF` (line `0x46F` = `1135`),
 * stores it in `pObjectData->InteractType (+0x04)`, and when `pObject->dwAnimMode == 1` applies object
 * collision at `(nX, nY)` (`+0x14`, `+0x18`) and schedules timer event `1` at
 * `dwGameFrame + (ObjectsTxt.dwFrameCnt1 >> 8) + 1`.
 *
 * @va D2Game:0x6FC53330
 */
export function OBJECTS_InitFn11_InitTownPortal_6FC53330_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC53330)
  const initPtr = pObjInit >>> 0
  const pRoom0 = m.u32((initPtr + 0x08) >>> 0) >>> 0
  const levelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom0)
  const actNo = DRLG_GetActNoFromLevelId113c(m, levelId) & 0xff
  const townLevelId = DUNGEON_GetActLevelId113c(m, actNo) | 0
  if (townLevelId > 0xff) {
    throw new D2CommonAssertError('ObjMode.cpp', 1135)
  }
  const pObject0 = m.u32((initPtr + 0x04) >>> 0) >>> 0
  const pObjData = m.u32((pObject0 + 0x14) >>> 0) >>> 0
  m.setU8((pObjData + 0x04) >>> 0, townLevelId & 0xff)

  const pObject = m.u32((initPtr + 0x04) >>> 0) >>> 0
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) === 1) {
    const nY = m.u32((initPtr + 0x18) >>> 0) | 0
    const nX = m.u32((initPtr + 0x14) >>> 0) | 0
    const pRoom = m.u32((initPtr + 0x08) >>> 0) >>> 0
    UNITS_SetCollisionMaskAtCoords113c(m, pObject, pRoom, nX, nY)

    const pObjectsTxt = m.u32((initPtr + 0x10) >>> 0) >>> 0
    const frames1 = m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8
    const pGame = m.u32(initPtr) >>> 0
    const targetFrame = (frames1 + m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0
    const pObjEv = m.u32((initPtr + 0x04) >>> 0) >>> 0
    EVENT_SetEventFull113c(m, pGame, pObjEv, 1, targetFrame, 0, 0, 0)
  }
}

/**
 * `Objects.txt` `InitFn` 59 (`0x6FD2E13C`, `ecx = pObjInit`): when `pObject == 0` or
 * `pObject->dwAnimMode == 0`, sets mode `1`, schedules timer event `7` at `dwGameFrame + 0x1B` (`+27`),
 * and schedules timer event `1` at `dwGameFrame + (ObjectsTxt.dwFrameCnt1 >> 8) + 1`.
 *
 * @va D2Game:0x6FC53620
 */
export function OBJECTS_InitFn59_ActivateAndScheduleEvents7And1_6FC53620_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC53620)
  const initPtr = pObjInit >>> 0
  const pObject0 = m.u32((initPtr + 0x04) >>> 0) >>> 0
  if (pObject0 !== 0 && m.u32((pObject0 + 0x10) >>> 0) !== 0) return

  UNITS_ChangeAnimMode113c(m, pObject0, 1)

  const pGame1 = m.u32(initPtr) >>> 0
  const frame7 = (m.u32((pGame1 + 0xa8) >>> 0) + 0x1b) >>> 0
  const pObject1 = m.u32((initPtr + 0x04) >>> 0) >>> 0
  EVENT_SetEventFull113c(m, pGame1, pObject1, 7, frame7, 0, 0, 0)

  const pObjectsTxt = m.u32((initPtr + 0x10) >>> 0) >>> 0
  const frames1 = m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8
  const pGame2 = m.u32(initPtr) >>> 0
  const frame1 = (frames1 + m.u32((pGame2 + 0xa8) >>> 0) + 1) >>> 0
  const pObject2 = m.u32((initPtr + 0x04) >>> 0) >>> 0
  EVENT_SetEventFull113c(m, pGame2, pObject2, 1, frame1, 0, 0, 0)
}

/**
 * `Objects.txt` `InitFn` 58 (`0x6FD2E138`, `ecx = pObjInit`): steps `pGame->pObjectControl->tSeed`
 * (`[pGame + 0x10F0]`) and schedules timer event `8` at `dwGameFrame + (newLo % 0xFA) + 0x19`.
 *
 * @va D2Game:0x6FC53680
 */
export function OBJECTS_InitFn58_ScheduleRandomEvent8_6FC53680_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC53680)
  const initPtr = pObjInit >>> 0
  const pGame0 = m.u32(initPtr) >>> 0
  const pObjCtrl = m.u32((pGame0 + 0x10f0) >>> 0) >>> 0
  const newLo = stepSeed64AtPtr113c(m, pObjCtrl)
  const jitter = (newLo >>> 0) % 0xfa

  const pGame = m.u32(initPtr) >>> 0
  const targetFrame = (m.u32((pGame + 0xa8) >>> 0) + jitter + 0x19) >>> 0
  const pObject = m.u32((initPtr + 0x04) >>> 0) >>> 0
  EVENT_SetEventFull113c(m, pGame, pObject, 8, targetFrame, 0, 0, 0)
}

/**
 * `Objects.txt` `InitFn` 24 (`0x6FD2E0B0`, `ecx = pObjInit`): schedules timer event `3` on
 * `pObjInit->pObject (+0x04)` at `pGame->dwGameFrame + 0x19` (`+25`).
 *
 * @va D2Game:0x6FC536D0
 */
export function OBJECTS_InitFn24_ScheduleEvent3_6FC536D0_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC536D0)
  const initPtr = pObjInit >>> 0
  const pGame = m.u32(initPtr) >>> 0
  const targetFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x19) >>> 0
  const pObject = m.u32((initPtr + 0x04) >>> 0) >>> 0
  EVENT_SetEventFull113c(m, pGame, pObject, 3, targetFrame, 0, 0, 0)
}

/**
 * `Objects.txt` `InitFn` 22 (`0x6FD2E0A8`, `ecx = pObjInit`): if `ObjectsTxt + 0x141 != 0`,
 * `pObject == 0 || pObject->dwAnimMode == 0`, and `ObjectsTxt + 0x13F == 0`, transitions `pObject`
 * to mode `2`, then unconditionally schedules timer event `0` at `dwGameFrame + 0x19` (`+25`).
 *
 * @va D2Game:0x6FC536F0
 */
export function OBJECTS_InitFn22_InitBrazierAndScheduleEvent0_6FC536F0_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC536F0)
  const initPtr = pObjInit >>> 0
  const pObjectsTxt = m.u32((initPtr + 0x10) >>> 0) >>> 0
  if (m.u8((pObjectsTxt + 0x141) >>> 0) !== 0) {
    const pObject0 = m.u32((initPtr + 0x04) >>> 0) >>> 0
    if (
      (pObject0 === 0 || m.u32((pObject0 + 0x10) >>> 0) === 0) &&
      m.u8((pObjectsTxt + 0x13f) >>> 0) === 0
    ) {
      UNITS_ChangeAnimMode113c(m, pObject0, 2)
    }
  }
  const pGame = m.u32(initPtr) >>> 0
  const targetFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x19) >>> 0
  const pObject = m.u32((initPtr + 0x04) >>> 0) >>> 0
  EVENT_SetEventFull113c(m, pGame, pObject, 0, targetFrame, 0, 0, 0)
}

/**
 * `Objects.txt` `InitFn` 10 (`0x6FD2E078`, `ecx = pObjInit`): in Rogue Encampment (`nLevelId == 1`)
 * schedules timer event `8` at `dwGameFrame + 0x3C` (`+60`); in any other level sets animation mode `2`
 * and schedules timer event `0` at `dwGameFrame + 0x19` (`+25`).
 *
 * @va D2Game:0x6FC53740
 */
export function OBJECTS_InitFn10_InitRogueFireAndScheduleEvent_6FC53740_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC53740)
  const initPtr = pObjInit >>> 0
  const pRoom = m.u32((initPtr + 0x08) >>> 0) >>> 0
  const levelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (levelId === 1) {
    const pGame = m.u32(initPtr) >>> 0
    const targetFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x3c) >>> 0
    const pObject = m.u32((initPtr + 0x04) >>> 0) >>> 0
    EVENT_SetEventFull113c(m, pGame, pObject, 8, targetFrame, 0, 0, 0)
    return
  }
  const pObject0 = m.u32((initPtr + 0x04) >>> 0) >>> 0
  UNITS_ChangeAnimMode113c(m, pObject0, 2)
  const pGame = m.u32(initPtr) >>> 0
  const targetFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x19) >>> 0
  const pObject = m.u32((initPtr + 0x04) >>> 0) >>> 0
  EVENT_SetEventFull113c(m, pGame, pObject, 0, targetFrame, 0, 0, 0)
}

/**
 * Tests `(nQuestId, nState)` (`[esp+4]`, `[esp+8]`, `ret 8`) in `pGame->pQuestControl->pQuestFlags`
 * (`[pGame + 0x10F4] + 0x0C`), asserting `pQuestControl->bInitialized (+0x08) != 0` (line `0x82C` = `2092`).
 *
 * @va D2Game:0x6FC538D0
 */
export function QUESTS_CheckGlobalQuestState_6FC538D0_113c(
  m: Memory113c,
  pGame: number,
  nQuestId: number,
  nState: number,
): number {
  hitD2GameVa113c(0x6FC538D0)
  const pQuestCtrl = m.u32(((pGame >>> 0) + 0x10f4) >>> 0) >>> 0
  if (m.u32((pQuestCtrl + 0x08) >>> 0) === 0) {
    throw new D2CommonAssertError('Quests.cpp', 2092)
  }
  const pQuestFlags = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0
  return DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId | 0, nState | 0)
}

/**
 * Sets `(nQuestId, nState)` (`[esp+4]`, `[esp+8]`, `ret 8`) in `pGame->pQuestControl->pQuestFlags`
 * (`[pGame + 0x10F4] + 0x0C`), asserting `pQuestControl->bInitialized (+0x08) != 0` (line `0x820` = `2080`).
 *
 * @va D2Game:0x6FC53920
 */
export function QUESTS_SetGlobalQuestState_6FC53920_113c(
  m: Memory113c,
  pGame: number,
  nQuestId: number,
  nState: number,
): void {
  hitD2GameVa113c(0x6FC53920)
  const pQuestCtrl = m.u32(((pGame >>> 0) + 0x10f4) >>> 0) >>> 0
  if (m.u32((pQuestCtrl + 0x08) >>> 0) === 0) {
    throw new D2CommonAssertError('Quests.cpp', 2080)
  }
  const pQuestFlags = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, nQuestId | 0, nState | 0)
}

/**
 * Checks whether quest `nQuestNo` (`[esp+8]`) in `pGame` (`[esp+4]`, `ret 8`) has `bNotIntro (+0x09) == 1`
 * (or returns `1` if `nQuestNo` is absent from the quest list), asserting `pGame != NULL` (line `0x7C3` = `1987`)
 * and `pQuestControl->bInitialized (+0x08) != 0` (line `0x7C5` = `1989`).
 *
 * @va D2Game:0x6FC53970
 */
export function QUESTS_CheckNotIntro_6FC53970_113c(
  m: Memory113c,
  pGame: number,
  nQuestNo: number,
): number {
  hitD2GameVa113c(0x6FC53970)
  const game = pGame >>> 0
  if (game === 0) {
    throw new D2CommonAssertError('Quests.cpp', 1987)
  }
  const pQuestCtrl = m.u32((game + 0x10f4) >>> 0) >>> 0
  if (m.u32((pQuestCtrl + 0x08) >>> 0) === 0) {
    throw new D2CommonAssertError('Quests.cpp', 1989)
  }
  let pQuest = m.u32(pQuestCtrl) >>> 0
  const target = nQuestNo >>> 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) >>> 0) === target) {
      return m.u8((pQuest + 0x09) >>> 0) === 1 ? 1 : 0
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  return 1
}

/**
 * Default quest log status byte resolver (`esi = pQuest`, `edi = pQuestFlags`, `ebx = pOutStateByte`)
 * used when `pQuest->pfStatusFilter (+0xE8) == NULL`, evaluating `pQuest->nSeqId (+0xE0)` states `0x0E`
 * and `0x0D`, `bLastState (+0x0C)` vs `bFlags (+0x0D)`, and special-case quests `4` and `10`.
 *
 * @va D2Game:0x6FC53A30
 */
export function QUESTS_ResolveDefaultStatusByte_6FC53A30_113c(
  m: Memory113c,
  pQuest: number,
  pQuestFlags: number,
  pOutStateByte: number,
): void {
  hitD2GameVa113c(0x6FC53A30)
  const quest = pQuest >>> 0
  const qFlags = pQuestFlags >>> 0
  const outPtr = pOutStateByte >>> 0

  const seqId0 = m.u32((quest + 0xe0) >>> 0) | 0
  const hasState0E = DRLGWARP_TestRoomTileBit113c(m, qFlags, seqId0, 0x0e)
  const b0C = m.u8((quest + 0x0c) >>> 0)
  const b0D = m.u8((quest + 0x0d) >>> 0)

  if (b0C < b0D) {
    if (hasState0E !== 0) {
      m.setU8(outPtr, 0x0c)
      return
    }
    if (m.u32(quest) === 4 && m.u8((quest + 0x0b) >>> 0) === 6) {
      const seqId2 = m.u32((quest + 0xe0) >>> 0) | 0
      const hasState0D = DRLGWARP_TestRoomTileBit113c(m, qFlags, seqId2, 0x0d)
      if (hasState0D === 0) {
        m.setU8(outPtr, 0x0c)
        return
      }
    }
    m.setU8(outPtr, m.u8((quest + 0x0b) >>> 0))
    return
  }

  const seqId1 = m.u32((quest + 0xe0) >>> 0) | 0
  const hasState0D = DRLGWARP_TestRoomTileBit113c(m, qFlags, seqId1, 0x0d)
  if (hasState0D === 1) {
    if ((m.u32((quest + 0xe0) >>> 0) | 0) >= 0x29) {
      throw new D2CommonAssertError('Quests.cpp', 1109)
    }
    m.setU8(outPtr, m.u8((quest + 0x0b) >>> 0))
    return
  }

  const questNo = m.u32(quest) >>> 0
  if (questNo === 4 && hasState0E !== 0) {
    if (m.u8((quest + 0x0c) >>> 0) === 6) {
      m.setU8(outPtr, 0x0c)
      return
    }
    m.setU8(outPtr, m.u8((quest + 0x0b) >>> 0))
    return
  }

  if (questNo === 0x0a) {
    const not4 = m.u8((quest + 0x0b) >>> 0) !== 4 ? 1 : 0
    m.setU8(outPtr, (not4 * 8 + 4) & 0xff)
    return
  }

  m.setU8(outPtr, 0x0c)
}

/**
 * Allocates a `0x14`-byte `D2QuestTimerStrc` (`ebx = nPeriodTicks`, `[esp+4] = pQuest`,
 * `[esp+8] = pfnTimerCallback`, `ret 8`) via `Fog.#10045` and prepends it to
 * `pQuestControl->pTimerList (+0x10)` with `dwFireTick = pQuestControl->dwTick (+0x14) + nPeriodTicks`,
 * asserting `pQuestControl->bExecuting (+0x04) == 0` (line `0x417` = `1047`).
 *
 * @va D2Game:0x6FC53AF0
 */
export function QUESTS_AppendQuestTimer_6FC53AF0_113c(
  m: Memory113c,
  nPeriodTicks: number,
  pQuest: number,
  pfnTimerCallback: number,
): void {
  hitD2GameVa113c(0x6FC53AF0)
  const quest = pQuest >>> 0
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return
  if (m.u32((pQuestCtrl + 0x04) >>> 0) !== 0) {
    throw new D2CommonAssertError('Quests.cpp', 1047)
  }
  m.u32((pGame + 0x1c) >>> 0)
  const oldHead = m.u32((pQuestCtrl + 0x10) >>> 0) >>> 0
  const pNode = m.alloc(0x14) >>> 0
  m.setU32((pNode + 0x10) >>> 0, oldHead)
  m.setU32((pNode + 0x04) >>> 0, quest)
  m.setU32(pNode, pfnTimerCallback >>> 0)
  const period = nPeriodTicks >>> 0
  const fireTick = (m.u32((pQuestCtrl + 0x14) >>> 0) + period) >>> 0
  m.setU32((pNode + 0x08) >>> 0, fireTick)
  m.setU32((pNode + 0x0c) >>> 0, period)
  m.setU32((pQuestCtrl + 0x10) >>> 0, pNode)
}

/**
 * Walks the quest chain attached to `pQuestArg->pTargetUnit (+0x08)` at `+0x74` (`edi = pQuestArg`,
 * `bl = bForceInactive`) and invokes `pQuest->pfCallback[pQuestArg->nCallbackIdx]` (`+0xA0`) whenever
 * `pQuest->bActive (+0x0A) == 1 || (bForceInactive & 0xFF) != 0`, asserting `!IsBadCodePtr(pfn)` (line `0x23E` = `574`).
 *
 * @va D2Game:0x6FC53C70
 */
export function QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c(
  m: Memory113c,
  pQuestArg: number,
  bForceInactive: number,
  hooks?: LaneJKernHooks113c,
): void {
  hitD2GameVa113c(0x6FC53C70)
  const argPtr = pQuestArg >>> 0
  const pUnit = m.u32((argPtr + 0x08) >>> 0) >>> 0
  let pNode = m.u32((pUnit + 0x74) >>> 0) >>> 0
  if (pNode === 0) return

  const force = bForceInactive & 0xff
  while (pNode !== 0) {
    const pQuest = m.u32(pNode) >>> 0
    const cbIdx = m.u32((argPtr + 0x04) >>> 0) >>> 0
    const pfn = m.u32((pQuest + cbIdx * 4 + 0xa0) >>> 0) >>> 0
    if (pfn !== 0) {
      if (m.u8((pQuest + 0x0a) >>> 0) === 1 || force !== 0) {
        if (checkIsBadCodePtr113c(pfn, hooks) !== 0) {
          throw new D2CommonAssertError('Quests.cpp', 574)
        }
        const pQuestCall = m.u32(pNode) >>> 0
        const cbIdxCall = m.u32((argPtr + 0x04) >>> 0) >>> 0
        const pfnCall = m.u32((pQuestCall + cbIdxCall * 4 + 0xa0) >>> 0) >>> 0
        dispatchQuestCallback113c(m, pfnCall, pQuestCall, argPtr, hooks)
      }
    }
    pNode = m.u32((pNode + 0x04) >>> 0) >>> 0
  }
}

/**
 * Returns `&pGame->pQuestControl->tSeed` (`[pGame + 0x10F4] + 0x18`, `eax = pGame`), asserting
 * `pQuestControl != NULL` at line `0x1FB` (`507`).
 *
 * @va D2Game:0x6FC53D90
 */
export function QUESTS_GetQuestSeedPtr_6FC53D90_113c(
  m: Memory113c,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC53D90)
  const pQuestCtrl = m.u32(((pGame >>> 0) + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) {
    throw new D2CommonAssertError('Quests.cpp', 507)
  }
  return (pQuestCtrl + 0x18) >>> 0
}

/**
 * Looks up `D2QuestDataStrc*` matching `nQuestId` (`eax = pGame`, `ecx = nQuestId`) in
 * `pGame->pQuestControl->pQuestList` (`[pGame + 0x10F4]`, next at `+0xF4`), asserting `nQuestId >= 0`
 * at line `0x77` (`119`) and returning `0` if `pQuestControl == 0` or no matching node exists.
 *
 * @va D2Game:0x6FC53F30
 */
export function QUESTS_GetQuestData_6FC53F30_113c(
  m: Memory113c,
  pGame: number,
  nQuestId: number,
): number {
  hitD2GameVa113c(0x6FC53F30)
  const pQuestCtrl = m.u32(((pGame >>> 0) + 0x10f4) >>> 0) >>> 0
  if ((nQuestId | 0) < 0) {
    throw new D2CommonAssertError('Quests.cpp', 119)
  }
  if (pQuestCtrl === 0) return 0
  let pQuest = m.u32(pQuestCtrl) >>> 0
  const target = nQuestId >>> 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) >>> 0) === target) {
      return pQuest
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  return 0
}

/**
 * Attaches `pQuest` (`esi`) to `pUnit->pQuestChain (+0x74)` (`edi = pUnit`, `[esp+4] = pGame`, `ret 4`):
 * asserts `pQuest != NULL` (line `0x5D` = `93`), returns `0` if `pQuest` is already present prior to
 * any null-quest sentinel, or prepends an 8-byte `[pQuest, oldHead]` node allocated via `Fog.#10045`
 * and returns `1`.
 *
 * @va D2Game:0x6FC53F80
 */
export function QUESTS_AttachQuestToUnit_6FC53F80_113c(
  m: Memory113c,
  pQuest: number,
  pUnit: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC53F80)
  const quest = pQuest >>> 0
  const unit = pUnit >>> 0
  let pCur = m.u32((unit + 0x74) >>> 0) >>> 0
  if (quest === 0) {
    throw new D2CommonAssertError('Quests.cpp', 93)
  }
  while (pCur !== 0) {
    const curQuest = m.u32(pCur) >>> 0
    if (curQuest === 0) break
    if (curQuest === quest) return 0
    pCur = m.u32((pCur + 0x04) >>> 0) >>> 0
  }
  m.u32(((pGame >>> 0) + 0x1c) >>> 0)
  const pNode = m.alloc(8) >>> 0
  m.setU32(pNode, quest)
  const oldHead = m.u32((unit + 0x74) >>> 0) >>> 0
  m.setU32((pNode + 0x04) >>> 0, oldHead)
  m.setU32((unit + 0x74) >>> 0, pNode)
  return 1
}

/**
 * Walks and frees a unit's `D2QuestChainStrc` singly-linked list (`edi = pGame`, `edx = pChainHead`,
 * next at `+0x04`) via `Fog.#10046` (`pGame->pMemPool` at `+0x1C`).
 *
 * @va D2Game:0x6FC53FF0
 */
export function QUESTS_FreeUnitQuestChain_6FC53FF0_113c(
  m: Memory113c,
  pGame: number,
  pChainHead: number,
  hooks?: LaneJKernHooks113c,
): void {
  hitD2GameVa113c(0x6FC53FF0)
  let pCur = pChainHead >>> 0
  if (pCur === 0) return
  const game = pGame >>> 0
  while (pCur !== 0) {
    const pMemPool = m.u32((game + 0x1c) >>> 0) >>> 0
    const pNext = m.u32((pCur + 0x04) >>> 0) >>> 0
    if (hooks !== undefined && hooks.onFreeMem !== undefined) {
      hooks.onFreeMem(m, pMemPool, pCur)
    }
    pCur = pNext
  }
}

/**
 * `Objects.txt` `InitFn` 23 (`0x6FD2E0AC`, `ecx = pObjInit`): locates quest `0x0F` (`15`) on `pGame`,
 * asserts if missing (line `0x983` = `2435`), and sets `pObjInit->pObject (+0x04)` animation mode to `2`
 * when `pQuest0F->bNotIntro (+0x09) == 0`, or to `pQuest0F->pQuestDataEx->dwAnimMode (+0x18)` otherwise.
 *
 * @va D2Game:0x6FC54370
 */
export function OBJECTS_InitFn23_SyncQuest0FObjectAnimMode_6FC54370_113c(
  m: Memory113c,
  pObjInit: number,
): number {
  hitD2GameVa113c(0x6FC54370)
  const initPtr = pObjInit >>> 0
  const pGame = m.u32(initPtr) >>> 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  let pQuest = pQuestCtrl !== 0 ? m.u32(pQuestCtrl) >>> 0 : 0
  while (pQuest !== 0 && (m.u32(pQuest) >>> 0) !== 0x0f) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) {
    throw new D2CommonAssertError('ObjMode.cpp', 2435)
  }
  const bNotIntro = m.u8((pQuest + 0x09) >>> 0)
  const pObject = m.u32((initPtr + 0x04) >>> 0) >>> 0
  if (bNotIntro === 0) {
    return UNITS_ChangeAnimMode113c(m, pObject, 2)
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const mode = m.u32((pQuestDataEx + 0x18) >>> 0) | 0
  return UNITS_ChangeAnimMode113c(m, pObject, mode)
}

/**
 * Dispatches quest item-picked-up callbacks (`ecx = pGame`, `eax = pItem`, `edx = pPlayer`,
 * `nCallbackIdx = 5`): builds a `0x1C`-byte `D2QuestArgStrc` (`{ pGame, 5, pItem, pPlayer }`) and
 * invokes `pQuest->pfCallback[cbIdx]` (`+0xA0`) for every active (`bActive (+0x0A) == 1`) quest on
 * `pItem->pQuestChain (+0x74)`, asserting `!IsBadCodePtr(pfn)` (line `0x23E` = `574`).
 *
 * @va D2Game:0x6FC54510
 */
export function QUESTS_TriggerItemPickedUp_6FC54510_113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
  pPlayer: number,
  hooks?: LaneJKernHooks113c,
): void {
  hitD2GameVa113c(0x6FC54510)
  const item = pItem >>> 0
  let pNode = m.u32((item + 0x74) >>> 0) >>> 0
  if (pNode === 0) return

  const savedSp = k2LaneJStackPtr
  const pQuestArg = savedSp
  k2LaneJStackPtr = (savedSp + 0x1c) >>> 0
  try {
    m.fill(pQuestArg, 0x1c, 0)
    m.setU32(pQuestArg, pGame >>> 0)
    m.setU32((pQuestArg + 0x04) >>> 0, 5)
    m.setU32((pQuestArg + 0x08) >>> 0, item)
    m.setU32((pQuestArg + 0x0c) >>> 0, pPlayer >>> 0)

    while (pNode !== 0) {
      const pQuest = m.u32(pNode) >>> 0
      const cbIdx = m.u32((pQuestArg + 0x04) >>> 0) >>> 0
      const pfn = pQuest !== 0 ? (m.u32((pQuest + cbIdx * 4 + 0xa0) >>> 0) >>> 0) : 0
      if (pfn !== 0 && m.u8((pQuest + 0x0a) >>> 0) === 1) {
        if (checkIsBadCodePtr113c(pfn, hooks) !== 0) {
          throw new D2CommonAssertError('Quests.cpp', 574)
        }
        const pQuestCall = m.u32(pNode) >>> 0
        const cbIdxCall = m.u32((pQuestArg + 0x04) >>> 0) >>> 0
        const pfnCall = m.u32((pQuestCall + cbIdxCall * 4 + 0xa0) >>> 0) >>> 0
        dispatchQuestCallback113c(m, pfnCall, pQuestCall, pQuestArg, hooks)
      }
      pNode = m.u32((pNode + 0x04) >>> 0) >>> 0
    }
  } finally {
    k2LaneJStackPtr = savedSp
  }
}

/**
 * Dispatches quest item-dropped callbacks (`ecx = pGame`, `eax = pItem`, `edx = pUnit`,
 * `nCallbackIdx = 4`): builds a `0x1C`-byte `D2QuestArgStrc` (`{ pGame, 4, pItem, pUnit }`) and
 * invokes `pQuest->pfCallback[cbIdx]` (`+0xA0`) for every active (`bActive (+0x0A) == 1`) quest on
 * `pItem->pQuestChain (+0x74)`, asserting `!IsBadCodePtr(pfn)` (line `0x23E` = `574`).
 *
 * @va D2Game:0x6FC545A0
 */
export function QUESTS_TriggerItemDropped_6FC545A0_113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
  pUnit: number,
  hooks?: LaneJKernHooks113c,
): void {
  hitD2GameVa113c(0x6FC545A0)
  const item = pItem >>> 0
  let pNode = m.u32((item + 0x74) >>> 0) >>> 0
  if (pNode === 0) return

  const savedSp = k2LaneJStackPtr
  const pQuestArg = savedSp
  k2LaneJStackPtr = (savedSp + 0x1c) >>> 0
  try {
    m.fill(pQuestArg, 0x1c, 0)
    m.setU32(pQuestArg, pGame >>> 0)
    m.setU32((pQuestArg + 0x04) >>> 0, 4)
    m.setU32((pQuestArg + 0x08) >>> 0, item)
    m.setU32((pQuestArg + 0x0c) >>> 0, pUnit >>> 0)

    while (pNode !== 0) {
      const pQuest = m.u32(pNode) >>> 0
      const cbIdx = m.u32((pQuestArg + 0x04) >>> 0) >>> 0
      const pfn = pQuest !== 0 ? (m.u32((pQuest + cbIdx * 4 + 0xa0) >>> 0) >>> 0) : 0
      if (pfn !== 0 && m.u8((pQuest + 0x0a) >>> 0) === 1) {
        if (checkIsBadCodePtr113c(pfn, hooks) !== 0) {
          throw new D2CommonAssertError('Quests.cpp', 574)
        }
        const pQuestCall = m.u32(pNode) >>> 0
        const cbIdxCall = m.u32((pQuestArg + 0x04) >>> 0) >>> 0
        const pfnCall = m.u32((pQuestCall + cbIdxCall * 4 + 0xa0) >>> 0) >>> 0
        dispatchQuestCallback113c(m, pfnCall, pQuestCall, pQuestArg, hooks)
      }
      pNode = m.u32((pNode + 0x04) >>> 0) >>> 0
    }
  } finally {
    k2LaneJStackPtr = savedSp
  }
}
