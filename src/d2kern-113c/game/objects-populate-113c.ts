/**
 * Diablo II v1.13c `D2Game.dll` random room objects (image base `0x6FC20000`).
 *
 * `OBJECTS_PopulateRoom113c` (`0x6FC4F0D0`) is the third step of `GAME_UpdateActRooms113c`
 * (`0x6FC4CBE0`) for a newly activated room. For each of the 8 `LevelsTxt` object groups (`+0xE5` group
 * id, `+0xED` probability) it rolls `pRoom->tSeed`, picks one `ObjGroup.txt` entry by weighted roll and
 * calls the matching object spawner in the D2Game table at `0x6FD2E190`, indexed by `ObjectsTxt+0x1B2`
 * (index 3 is `OBJECTS_SpawnDensityObjectsInRoom`, `0x6FC52CE0`).
 *
 * Every function below is a 1:1 port of the cited `objdump -d -M intel` disassembly of `D2Game.dll`.
 * Callees without a kernel port yet are reached through `ObjectsPopulateCallees113c` (all members required).
 */
import { COLLISION_CheckMaskWithSizeXY113c } from '../common/collision.ts'
import { UNITS_GetObjectTxt113c, UNITS_SetField7C_113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import {
  DUNGEON_CheckPresetRoomFlag80_113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetLevelIdIfNotHidden113c,
  DUNGEON_GetRoomCoordinates113c,
  DUNGEON_HasRoomExWaypointFlags113c,
} from '../common/dungeon.ts'
import { DUNGEON_CheckRoomIsTownMemPort113c } from '../common/k0-d2common-memports.ts'
import { DATATBLS_GetObjectsTxtRecord113c, UNITS_AllocStaticPath113c, UNIT_Alloc113c } from '../common/unit.ts'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import { seedRoll, type D2SeedStrc } from '../prng.ts'
import { DATATBLS_GetShrinesTxtRecord113c } from '../tables/datatbls-113c.ts'
import { DATATBLS_GetLevelsTxtRecord113c } from '../tables/lvl-tbls-113c.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  OBJECTS_InitChestLockAndSeed113c,
  OBJECTS_InitShrineType113c,
  OBJECTS_RollChestTrapType113c,
  OBJECTS_SpawnDensityObjectsInRoom113c,
  SUNIT_InitUnitSeed113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c.ts'
import {
  OBJECTS_InitFn05_NoOp113c,
  OBJECTS_InitFn16_DoubleActToSubType113c,
  OBJECTS_InitFn27_RollSubType3_113c,
  OBJECTS_LevelHookAlwaysTrue113c,
} from './k2-items-tc-w1-113c.ts'
import {
  OBJECT_CheckRespawnOrPortalInRoom113c,
  OBJECT_SetAnimMode2Wrapper113c,
  QUEST_Act1TownPortalUpdateState113c,
} from './boot-init-gap-a-113c.ts'
import {
  OBJECTS_InitFn10_InitRogueFireAndScheduleEvent_6FC53740_113c,
  OBJECTS_InitFn11_InitTownPortal_6FC53330_113c,
  OBJECTS_InitFn14_SetAnimMode1_6FC4E740_113c,
  OBJECTS_InitFn22_InitBrazierAndScheduleEvent0_6FC536F0_113c,
  OBJECTS_InitFn23_SyncQuest0FObjectAnimMode_6FC54370_113c,
  OBJECTS_InitFn24_ScheduleEvent3_6FC536D0_113c,
  OBJECTS_InitFn26_SetAnimMode1_6FC4E730_113c,
  OBJECTS_InitFn34_RandomSetAnimMode1_6FC4EC70_113c,
  OBJECTS_InitFn51_ScheduleEvent9IfOperatingOrOpened_6FC532F0_113c,
  OBJECTS_InitFn57_InitSpecialChest_6FC4EF50_113c,
  OBJECTS_InitFn58_ScheduleRandomEvent8_6FC53680_113c,
  OBJECTS_InitFn59_ActivateAndScheduleEvents7And1_6FC53620_113c,
} from './k2-laneJ-0x6fc4-w1-113c.ts'
import {
  QUESTS_InitAct1Quest3Object_6FC54E10_113c,
  QUESTS_InitAct1Quest4Object_6FC54DA0_113c,
} from './k2-laneK-0x6fc5-w1-113c.ts'
import {
  ACT5Q5_InitAncientsAltarObject_6FC773D0_113c,
  ACT5Q5_InitSummitDoorObject_6FC765B0_113c,
  ACT5Q5_InitWorldstoneKeepEntranceObject_6FC774A0_113c,
  ACT5Q6_InitWorldstoneChamberObject94_6FC76520_113c,
  ACT5Q6_InitWorldstoneChamberObject9C_6FC764D0_113c,
  ACT5_InitObjectNoop_6FC76CE0_113c,
} from './k2-laneM-0x6fc7-w1-113c.ts'
import {
  ACT5Q5_InitAncientStatueObject14_6FC78EF0_113c,
  ACT5Q5_InitAncientStatueObject18_6FC78EA0_113c,
  ACT5Q5_InitAncientStatueObject1C_6FC78E50_113c,
} from './k2-w2b1-113c.ts'
import {
  ACT1Q4_InitCainGibbetObject_6FC814A0_113c,
  ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c,
  OBJECTS_InitOperatingObjectWithTimer25_6FC88F90_113c,
} from './k2-w2b2-113c.ts'
import {
  ACT4Q2_InitHellforgeObject_6FCD8870_113c,
  ACT4_InitObjectNoop_6FCD8930_113c,
} from './k2-w2b6-113c.ts'
import {
  ACT2Q3_NoOpA_6FCE2350_113c,
  ACT2Q3_NoOpB_6FCE2360_113c,
  ACT2Q3_NoOpC_6FCE2370_113c,
  ACT2Q4_InitArcanePortalObject_6FCE32C0_113c,
  ACT2Q6_ActivateHoradricOrifice_6FCE27F0_113c,
} from './k2-w2b7-113c.ts'
import {
  ACT3Q2_InitGidbinnAltarObject_6FD04120_113c,
  ACT3Q3_InitSewerLeverObject_6FD04980_113c,
  ACT3Q3_InitSewerStairsObject_6FD02E00_113c,
  ACT3Q5_InitCompellingOrbObject_6FD02A00_113c,
} from './k2-w2b8-113c.ts'
import {
  OBJECTS_PopulateEvilUrnMonstersInRoom_6FC4F690_113c,
  OBJECTS_PopulateGridObjectsInRect_6FC4FEC0_113c,
} from './k2-w3b2-113c.ts'
import { OBJECTS_InitFn05_InitPortalDestLevel_6FC533D0_113c } from './k2-w3b3-113c.ts'
import { ACT5Q3_SpawnFrozenAnyaMonsterIfNeeded_6FC7CF70_113c } from './k2-w3b5-113c.ts'
import {
  ACT1Q4_InitInifussTreeObject_6FC828D0_113c,
  ACT5Q3_InitFrozenAnyaObject_6FC7E8D0_113c,
} from './k2-w3b6-113c.ts'
import {
  OBJECTS_OperateGoldChestOrPile_6FC4F580_113c,
  OBJECTS_PopulateRoomEdgeObjectsMode0_6FC527B0_113c,
  OBJECTS_PopulateRoomEdgeObjectsMode1_6FC52790_113c,
} from './k2-w4b1-113c.ts'
import { ACT5Q1_SpawnShenkAndAttachQuestData_6FC7C3A0_113c } from './k2-w4b2-113c.ts'
import {
  ACT5Q3_RegisterAnyaObjectAndSpawnMonster200_6FC7EB30_113c,
  ACT5Q3_SpawnMonster202AndAttachQuestData_6FC7C5C0_113c,
} from './k2-w4b3-113c.ts'
import { OBJRGN_PopulateRoomRandomItemDropsGrid_6FC4F4B0_113c } from './k2-w4b4-113c.ts'
import { ACT2Q5_InitArcanePortalObject_6FCE2850_113c } from './k2-w5b4-113c.ts'
import { ACT2Q4_InitArcanePortalObjectMode_6FCE99B0_113c } from './k2-w5b5-113c.ts'
import { ACT3Q7_InitMephistoPortalObject_6FD03290_113c } from './k2-w5b8-113c.ts'
import {
  ACT3Q0_InitDarkWandererPreset_6FD08290_113c,
  ACT3Q2_InitGidbinnBossActivePreset_6FD08560_113c,
  ACT3Q2_InitGidbinnBossDefaultPreset_6FD086A0_113c,
  ACT3Q3_InitCompellingOrbPreset_6FD084A0_113c,
  ACT3Q5_InitCouncilBossPreset_6FD08310_113c,
  ACT3Q5_InitStairsObject_6FD098E0_113c,
} from './k2-w5b9-113c.ts'
import { QUESTS_TriggerAct2Q0SpawnJerhyn_6FC565B0_113c } from './k2-w6b1-113c.ts'
import {
  ACT5Q3_OnFrozenAnyaSpawnedPromoteState2_6FC79EF0_113c,
  ACT5Q6_RollBaalTauntMonsterIdAndBroadcastPacket50_6FC7A820_113c,
} from './k2-w6b4-113c.ts'
import {
  ACT4Q2_InitHellforgeObject_6FCD9E80_113c,
  QUEST0D_InitTemplePortalObject_6FCE9ED0_113c,
} from './k2-w6b5-113c.ts'
import {
  QUESTS_Act2TaintedSunTriggerAltarDarkness_6FC56C20_113c,
  QUESTS_Act5RescueBarbsOnPrisonDoorOpen_6FC7C850_113c,
} from './k2-w7b1-113c.ts'
import { ACT1Q5_RecordPlayerInMalusRoomAndSpawnLightning_6FC88AB0_113c } from './k2-w7b2-113c.ts'
import { ACT1Q4_OnCairnStoneInit_6FC87D20_113c } from './k2-w8b2-113c.ts'
import { QUESTS_OnTaintedSunAltarInitOrFallbackMode2_6FC56100_113c } from './k2-w9b1-113c.ts'
import { D2Game_6FD08EB0_113c } from './k2-w13b1-113c.ts'
import { ACT4Q3_OnSealObjectActivatedTriggerCheck_6FCDC220_113c } from './k2-w16b1-113c.ts'
import { UNITS_ChangeAnimMode113c } from './monster-events.ts'
import { EVENT_RemoveUnitEvents113c } from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

/** `pGame->pObjectControl` (`0x6FC4EEC1 mov eax, [ebp+0x10F0]`). */
const GAME_OFF_POBJECTCONTROL = 0x10f0
/** `pObjectControl->pLevelObjInfo[nLevelId]` (`0x6FC4EEC7 mov esi, [eax+edi*4+0x48]`). */
const OBJCTRL_OFF_LEVEL_INFO = 0x48
/** `sgptDataTables->nLevelsTxtRecordCount` (`0x6FC4EEDF cmp edi, [edx+0xC5C]`). */
const DATATABLES_OFF_LEVELS_COUNT = 0xc5c
/** `LevelsTxt->nObjGrp[8]` / `nObjPrb[8]` (`0x6FC4F156` / `0x6FC4F1D3`). */
const LEVELSTXT_OFF_OBJGRP = 0xe5
const LEVELSTXT_OFF_OBJPRB = 0xed
/** `LevelsTxt->dwObjectQuestHook` style dword tested at `0x6FC4EF15 mov eax, [edx+0x210]`. */
const LEVELSTXT_OFF_210 = 0x210

/** `byte` at `0x6FD2E1B8` (`.data`, only ever read, value `2` in the v1.13c image). */
const OBJECTS_MAX_ACT_FLAG_6FD2E1B8 = 2
/**
 * Object spawner table at `0x6FD2E190` (`int32[10]`, copied verbatim from `D2Game.dll` v1.13c);
 * `[3] = 0x6FC52CE0` (`OBJECTS_SpawnDensityObjectsInRoom`).
 */
export const OBJECTS_SPAWN_FN_TABLE_6FD2E190: readonly number[] = [
  0, 0x6fc51000, 0x6fc527d0, 0x6fc52ce0, 0x6fc50800, 0x6fc50150, 0x6fc53260, 0x6fc52df0, 0x6fc52a10, 0x6fc52bc0,
]

/** Callees of the room-object population without a kernel port yet (all required). */
export interface ObjectsPopulateCallees113c {
  /** `D2Common.#10662` (`0x6FD8C7E0`, `__stdcall(pAct, nLevelId)`): number of rooms of the level in the act. */
  readonly getLevelRoomCountInAct: (m: Memory113c, pAct: number, nLevelId: number) => number
  /** `D2Game:0x6FC4EAD0` (`ecx = pLevelObjInfo`, `__stdcall(pGame, pRoom, nHook)`). */
  readonly checkLevelObjectHook: (m: Memory113c, pLevelObjInfo: number, pGame: number, pRoom: number, nHook: number) => number
  /**
   * Object spawners `0x6FD2E190[nFn]` for `nFn != 3` (`ecx = pGame`, `edx = pRoom`,
   * `__stdcall(nDensity, nObjectId, 100)`); `nFn == 3` is the ported `0x6FC52CE0`.
   */
  readonly spawnObjectsByFn: (
    m: Memory113c,
    nFnVa: number,
    pGame: number,
    pRoom: number,
    nDensity: number,
    nObjectId: number,
    nProb: number,
  ) => number
  /** Callees of `OBJECTS_SpawnRandomObjectInRoom113c` (`0x6FC51E20`), reached from `0x6FC52CE0`. */
  readonly spawn: ObjectSpawnCallees113c
}

function seedStep113c(m: Memory113c, pSeed: number): number {
  const lo = m.u32(pSeed >>> 0) >>> 0
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  m.setU32((pSeed + 4) >>> 0, Number((prod >> 32n) & 0xffffffffn) >>> 0)
  m.setU32(pSeed >>> 0, newLo)
  return newLo
}

/**
 * Gate for random room objects (`ebx = pRoom`, `__stdcall(pGame, pLevelsTxt)`, `ret 8`): returns `0` for a
 * room with waypoint flags (`D2Common.#10233`), a hidden level (`#11025 == 0`), a preset room with flag
 * `0x80` (`#10283`), a level id `>= nLevelsTxtRecordCount`, or a town room (`#10057`). Otherwise lazily
 * caches the level's room count (`pLevelObjInfo->nRooms`, `+0x08`, `0x7FFFFFFF` = unknown) via
 * `D2Common.#10662`, increments `pLevelObjInfo->nVisitedRooms` (`+0x04`) and, when `LevelsTxt+0x210 != 0`,
 * returns `0` if `0x6FC4EAD0(...) == 1`; else `1`.
 *
 * @va D2Game:0x6FC4EEA0 (161B)
 */
export function OBJECTS_CanPopulateRoom113c(
  m: Memory113c,
  pRoom: number,
  pGame: number,
  pLevelsTxt: number,
  callees: ObjectsPopulateCallees113c,
): number {
  hitD2GameVa113c(0x6FC4EEA0)
  if (DUNGEON_HasRoomExWaypointFlags113c(m, pRoom) !== 0) return 0
  const nLevelId = DUNGEON_GetLevelIdIfNotHidden113c(m, pRoom) | 0
  const pObjCtrl = m.u32((pGame + GAME_OFF_POBJECTCONTROL) >>> 0) >>> 0
  const pInfo = m.u32((pObjCtrl + Math.imul(nLevelId, 4) + OBJCTRL_OFF_LEVEL_INFO) >>> 0) >>> 0
  if (nLevelId === 0) return 0
  if (DUNGEON_CheckPresetRoomFlag80_113c(m, pRoom) !== 0) return 0
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  if (nLevelId >= (m.u32((pDataTables + DATATABLES_OFF_LEVELS_COUNT) >>> 0) | 0)) return 0
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) return 0
  if ((m.u32((pInfo + 8) >>> 0) | 0) === 0x7fffffff) {
    const nAct = m.u8(pInfo)
    const pAct = m.u32((pGame + 0xbc + nAct * 4) >>> 0) >>> 0
    m.setU32((pInfo + 8) >>> 0, callees.getLevelRoomCountInAct(m, pAct, nLevelId) >>> 0)
  }
  m.setU32((pInfo + 4) >>> 0, ((m.u32((pInfo + 4) >>> 0) | 0) + 1) >>> 0)
  const nHook = m.u32((pLevelsTxt + LEVELSTXT_OFF_210) >>> 0) >>> 0
  if (nHook !== 0) {
    if (callees.checkLevelObjectHook(m, pInfo, pGame, pRoom, nHook) === 1) return 0
  }
  return 1
}

/**
 * Populates the random objects of a newly activated room (`__stdcall(pGame, pRoom)`, `ret 8`). `LevelsTxt`
 * of the room's level is asserted non-NULL (line `0xBEC`). After `0x6FC4EEA0` passes, for each object group
 * slot `i` in `0..7`: `nGroup = LevelsTxt+0xE5+i`, `roll = step(pRoom->tSeed) % 100` (always stepped); if
 * the level has visited more than 3/4 of its rooms (`(nVisited << 7) / nRooms > 0x60`, `nRooms > 0`,
 * `+0x10 == 0`) and `ObjectsTxt[nGroup]+0x167 != 0`, `roll = 100`. A non-zero group with
 * `roll <= LevelsTxt+0xED+i` looks up `ObjGroup.txt` (`D2Common.#10465`; `NULL` ends the whole walk),
 * rolls `pick = step(pRoom->tSeed) % 100` and walks the 8 group entries summing `ObjGroup+0x28+j` until
 * `pick < sum` and `ObjectsTxt[id]+0x172 <= 2`; the chosen entry's spawner `0x6FD2E190[ObjectsTxt+0x1B2]`
 * (`< 10`, else assert `0xC43`) is called with density `ObjGroup+0x20+j` (`< 0x80`, else assert `0xC47`)
 * and probability `100`.
 *
 * @va D2Game:0x6FC4F0D0 (545B)
 */
export function OBJECTS_PopulateRoom113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
  callees: ObjectsPopulateCallees113c,
): void {
  hitD2GameVa113c(0x6FC4F0D0)
  const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, DUNGEON_GetLevelIdFromRoom113c(m, pRoom)) >>> 0
  if (pLevelsTxt === 0) {
    throw new Error('OBJECTS_PopulateRoom113c: pLevelsTxt == NULL (line 3052)')
  }
  if (OBJECTS_CanPopulateRoom113c(m, pRoom, pGame, pLevelsTxt, callees) === 0) return
  const pSeed = pRoom !== 0 ? (pRoom + 0x6c) >>> 0 : 0
  for (let i = 0; i < 8; i++) {
    const nGroup = m.u8((pLevelsTxt + i + LEVELSTXT_OFF_OBJGRP) >>> 0)
    let roll = (seedStep113c(m, pSeed) % 100) | 0
    const nLevelId = DUNGEON_GetLevelIdIfNotHidden113c(m, pRoom) | 0
    const pObjCtrl = m.u32((pGame + GAME_OFF_POBJECTCONTROL) >>> 0) >>> 0
    const pInfo = m.u32((pObjCtrl + Math.imul(nLevelId, 4) + OBJCTRL_OFF_LEVEL_INFO) >>> 0) >>> 0
    const nRooms = m.u32((pInfo + 8) >>> 0) | 0
    if (nRooms > 0) {
      const pct = Math.trunc(((m.u32((pInfo + 4) >>> 0) << 7) | 0) / nRooms) | 0
      if (pct > 0x60 && m.u32((pInfo + 0x10) >>> 0) === 0) {
        if (m.u8((DATATBLS_GetObjectsTxtRecord113c(m, nGroup) + 0x167) >>> 0) !== 0) roll = 100
      }
    }
    if (nGroup === 0) continue
    if (roll > m.u8((pLevelsTxt + i + LEVELSTXT_OFF_OBJPRB) >>> 0)) continue
    const pGroup = DATATBLS_GetShrinesTxtRecord113c(m, nGroup) >>> 0
    if (pGroup === 0) return
    const pick = (seedStep113c(m, pSeed) % 100) | 0
    let sum = 0
    for (let j = 0; j < 8; j++) {
      const nObjectId = m.u32((pGroup + j * 4) >>> 0) | 0
      if (nObjectId === 0) break
      sum = (sum + m.u8((pGroup + j + 0x28) >>> 0)) | 0
      const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjectId) >>> 0
      if (pick >= sum) continue
      if (m.u8((pObjTxt + 0x172) >>> 0) > OBJECTS_MAX_ACT_FLAG_6FD2E1B8) continue
      const nFn = m.u8((pObjTxt + 0x1b2) >>> 0)
      if (nFn >= 10) throw new Error('OBJECTS_PopulateRoom113c: nFn >= 10 (line 3139)')
      const fnVa = OBJECTS_SPAWN_FN_TABLE_6FD2E190[nFn]!
      if (fnVa === 0) break
      // 0x6FC4F271 IsBadCodePtr(fn) != 0 -> assert 0xC46: never taken for the constant table entries.
      const nDensity = m.u8((pGroup + j + 0x20) >>> 0)
      if (nDensity >= 0x80) throw new Error('OBJECTS_PopulateRoom113c: nDensity >= 0x80 (line 3143)')
      if (fnVa === 0x6fc52ce0) {
        OBJECTS_SpawnDensityObjectsInRoom113c(m, pGame, pRoom, nDensity, nObjectId, 100, densityObjectHooks113c(callees.spawn))
      } else {
        callees.spawnObjectsByFn(m, fnVa, pGame, pRoom, nDensity, nObjectId, 100)
      }
      break
    }
  }
}

/** Callees of the random object spawn without a kernel port yet (all required). */
export interface ObjectSpawnCallees113c {
  /** `D2Game:0x6FC4F300` (`esi = pUnit`, `ebx = pGame`, `__stdcall(nUnitId, pRoom, x, y)`): object init. */
  readonly initObject: (m: Memory113c, pUnit: number, pGame: number, nUnitId: number, pRoom: number, x: number, y: number) => void
  /** `D2Game:0x6FD00F40` (`ecx = y`, `edx = pUnit`, `eax = pRoom`, `__stdcall(x, pGame, 1)`): place and hash the unit. */
  readonly placeServerUnit: (m: Memory113c, y: number, pUnit: number, pRoom: number, x: number, pGame: number, a2: number) => void
}

/**
 * `0x6FC52CE0` calls `0x6FC51E20` as `__stdcall(pGame, nObjectId, nSizeX, nSizeY, pRoom)`; Lane G's port reaches it
 * through `RegpopSpawnHooks113c.onSpawnRandomObjectInRoom` (`nSizeX, nSizeY, nObjectId, pGame, 0, pRoom`).
 */
function densityObjectHooks113c(spawn: ObjectSpawnCallees113c): RegpopSpawnHooks113c {
  return {
    onSpawnRandomObjectInRoom: (m, nSizeX, nSizeY, nObjectId, pGame, _nSubType, pRoom) =>
      OBJECTS_SpawnRandomObjectInRoom113c(m, pGame, nObjectId, nSizeX, nSizeY, pRoom, spawn),
  }
}

/** Scratch "stack" for the room coordinates of `0x6FC51E20` (outside every recorded heap range). */
let objSpawnStackPtr = 0x7fc00000

/** Inline `SEED_RollLimited` on `pObjectControl->tSeed` (`0x6FC51E74..0x6FC51EA6`): power-of-two mask else `lo % n`. */
function rollObjCtrlSeed113c(m: Memory113c, pSeed: number, n: number): number {
  if ((n | 0) <= 0) return 0
  const lo = seedStep113c(m, pSeed)
  const mask = (n - 1) | 0
  if ((n & mask) === 0) return (mask & lo) >>> 0
  return (lo % (n >>> 0)) >>> 0
}

/**
 * Spawns one random object in `pRoom` (`__stdcall(pGame, nObjectId, nSizeX, nSizeY, pRoom)`, `ret 0x14`).
 * Rooms narrower or shorter than 2 subtiles return `NULL`. Up to 5 attempts pick
 * `x = subX + roll(subW - nSizeX - 1)`, `y = subY + roll(subH - nSizeY - 1)` on `pGame->pObjectControl->tSeed`
 * and accept the first non-zero point strictly inside the room border whose
 * `(nSizeX + 6) x (nSizeY + 6)` box has no `0x3F11` collision (`D2Common.#10303`). The object unit is then
 * built in place: `D2Common.#11153` unit (type 2, class `nObjectId`, mem pool `pGame+0x1C`, `pGame` at
 * `+0x80`), `dwFlags2 (+0xC8)` bit `0x2000000` from `pGame+0x70` plus `0x4000000`, act / `pAct` from the
 * room's level, `SUNIT_InitUnitSeed(pGame->tSeed)` (one game-seed step), `dwFlags |= 0x10`, `+0xD0 = 0xB`,
 * unit id `++pGame->dwObjectId (+0x98)` (`-1` wraps to `1`), a zeroed `0x38`-byte object data with
 * `pObjectsTxt`, mode 0, a static path (`D2Common.#10445`), then `0x6FC4F300` and `0x6FD00F40`.
 * `pRoom == NULL` after a successful probe asserts (line `0x54E`).
 *
 * @va D2Game:0x6FC51E20 (744B)
 */
export function OBJECTS_SpawnRandomObjectInRoom113c(
  m: Memory113c,
  pGame: number,
  nObjectId: number,
  nSizeX: number,
  nSizeY: number,
  pRoom: number,
  callees: ObjectSpawnCallees113c,
): number {
  hitD2GameVa113c(0x6FC51E20)
  const sp = objSpawnStackPtr
  objSpawnStackPtr = (sp + 0x20) >>> 0
  let subX = 0
  let subY = 0
  let subW = 0
  let subH = 0
  try {
    DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
    subX = m.u32(sp) | 0
    subY = m.u32((sp + 4) >>> 0) | 0
    subW = m.u32((sp + 8) >>> 0) | 0
    subH = m.u32((sp + 12) >>> 0) | 0
  } finally {
    objSpawnStackPtr = sp
  }
  if (subW < 2 || subH < 2) return 0
  const pSeed = m.u32((pGame + GAME_OFF_POBJECTCONTROL) >>> 0) >>> 0
  let x = 0
  let y = 0
  let attempt = 0
  for (; attempt < 5; attempt++) {
    x = (rollObjCtrlSeed113c(m, pSeed, (subW - nSizeX - 1) | 0) + subX) | 0
    y = (rollObjCtrlSeed113c(m, pSeed, (subH - nSizeY - 1) | 0) + subY) | 0
    if (x === 0 || y === 0) continue
    const x16 = x & 0xffff
    const y16 = y & 0xffff
    if (x16 < ((subX + 1) | 0)) continue
    if (y16 < ((subY + 1) | 0)) continue
    if (x16 >= ((subX + subW - 1) | 0)) continue
    if (y16 >= ((subY + subH - 1) | 0)) continue
    const hit = COLLISION_CheckMaskWithSizeXY113c(m, pRoom, x, y, (nSizeX + 6) | 0, (nSizeY + 6) | 0, 0x3f11)
    if ((hit & 0xffff) === 0) break
  }
  if (attempt >= 5) return 0
  if (pRoom === 0) {
    throw new Error('OBJECTS_SpawnRandomObjectInRoom113c: pRoom == NULL (line 1358)')
  }
  const pUnit = UNIT_Alloc113c(m, 2) >>> 0
  if (pUnit === 0) return 0
  m.setU32(pUnit, 2)
  m.setU32((pUnit + 0x04) >>> 0, nObjectId >>> 0)
  m.setU32((pUnit + 0x08) >>> 0, m.u32((pGame + 0x1c) >>> 0))
  m.setU32((pUnit + 0x80) >>> 0, pGame >>> 0)
  let flags2 = m.u32((pUnit + 0xc8) >>> 0)
  flags2 = m.u32((pGame + 0x70) >>> 0) !== 0 ? (flags2 | 0x2000000) >>> 0 : (flags2 & 0xfdffffff) >>> 0
  m.setU32((pUnit + 0xc8) >>> 0, flags2)
  m.setU32((pUnit + 0xc8) >>> 0, (flags2 | 0x4000000) >>> 0)
  const nAct = DRLG_GetActNoFromLevelId113c(m, DUNGEON_GetLevelIdFromRoom113c(m, pRoom)) & 0xff
  m.setU8((pUnit + 0x18) >>> 0, nAct)
  m.setU32((pUnit + 0x1c) >>> 0, m.u32((pGame + 0xbc + nAct * 4) >>> 0))
  m.setU32((pUnit + 0x74) >>> 0, 0)
  SUNIT_InitUnitSeed113c(m, pUnit, (pGame + 0xd0) >>> 0)
  m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x10) >>> 0)
  m.setU32((pUnit + 0xd0) >>> 0, 0xb)
  let nUnitId = ((m.u32((pGame + 0x98) >>> 0) | 0) + 1) | 0
  if (nUnitId === -1) nUnitId = 1
  m.setU32((pGame + 0x98) >>> 0, nUnitId >>> 0)
  const pObjData = m.alloc(0x38)
  m.setU32((pUnit + 0x14) >>> 0, pObjData)
  m.fill(pObjData, 0x38, 0)
  m.setU32(pObjData, DATATBLS_GetObjectsTxtRecord113c(m, nObjectId) >>> 0)
  m.setU32((pUnit + 0x10) >>> 0, 0)
  UNITS_AllocStaticPath113c(m, pUnit)
  callees.initObject(m, pUnit, pGame, nUnitId >>> 0, pRoom, x, y)
  callees.placeServerUnit(m, y, pUnit, pRoom, x, pGame, 1)
  return pUnit
}

/**
 * `@va D2Game:0x6FC4E7D0` (`OBJECTS_AllocInteractStrc`, `edi = pGame`, returns 2x8-byte sentinel list head).
 */
export function OBJECTS_AllocInteractStrc113c(
  m: Memory113c,
  pGame: number,
  _pObjectsTxt = 0,
): number {
  hitD2GameVa113c(0x6FC4E7D0)
  if (pGame !== 0) {
    m.u32((pGame + 0x1c) >>> 0)
  }
  const pHead = m.alloc(0x08) >>> 0
  m.setU32(pHead, 0)
  m.setU32((pHead + 0x04) >>> 0, 0xffffffff)
  const pTail = m.alloc(0x08) >>> 0
  m.setU32(pTail, 0xffffffff)
  m.setU32((pTail + 0x04) >>> 0, 0)
  m.setU32(pHead, pTail)
  return pHead
}

/**
 * `@va D2Game:0x6FC4EAD0` (`OBJECTS_CheckLevelObjectHook`, 407B: `ecx = pLevelObjInfo`,
 * stack `(pGame, pRoom, bDensityFlags)`, `ret 0x0C`).
 *
 * 1. Requires `pLevelObjInfo->nRooms (+0x08) >= pLevelObjInfo->dwField0C (+0x0C) * 10`.
 * 2. Steps `pGame->pObjectControl->tSeed` (`[pGame + 0x10F0]`) mod `100` against threshold
 *    `12 + (visited > rooms / 2 ? 5 : 0) + (visited > rooms - rooms / 4 ? 5 : 0)`.
 * 3. Fetches room coordinates (`DUNGEON_GetRoomCoordinates113c`), builds candidate hook IDs `1..7`
 *    from `bDensityFlags` bits `0..6`, rolls `idx = rollObjCtrlSeed(pObjCtrl, candCount)`,
 *    checks `idx < candCount && hookId < candCount` (`0x6FC4EC1A..0x6FC4EC24`), and dispatches
 *    `0x6FD2E2FC[hookId]` (`1 -> 0x6FC4E5C0`, `2 -> 0x6FC4FEC0`, `4 -> 0x6FC4F4B0`,
 *    `5 -> 0x6FC527B0`, `6 -> 0x6FC52790`).
 */
export function OBJECTS_CheckLevelObjectHook113c(
  m: Memory113c,
  pLevelObjInfo: number,
  pRoom: number,
  pGame: number,
  bDensityFlags: number,
): number {
  hitD2GameVa113c(0x6FC4EAD0)
  if (pLevelObjInfo === 0 || pGame === 0) return 0
  const count0C = m.u32((pLevelObjInfo + 0x0c) >>> 0) | 0
  const rooms08 = m.u32((pLevelObjInfo + 0x08) >>> 0) | 0
  if (rooms08 < Math.imul(count0C, 10)) return 0

  const pObjCtrl = m.u32((pGame + GAME_OFF_POBJECTCONTROL) >>> 0) >>> 0
  if (pObjCtrl === 0) return 0

  const roll100 = (seedStep113c(m, pObjCtrl) >>> 0) % 100
  const totalRooms = m.u32((pLevelObjInfo + 0x08) >>> 0) | 0
  const visitedRooms = m.u32((pLevelObjInfo + 0x04) >>> 0) | 0

  let threshold = 0
  const halfRooms = Math.trunc(totalRooms / 2) | 0
  if (visitedRooms > halfRooms) {
    threshold = 5
  }
  const quarterRooms = Math.trunc(totalRooms / 4) | 0
  if (visitedRooms > ((totalRooms - quarterRooms) | 0)) {
    threshold = (threshold + 5) | 0
  }
  threshold = (threshold + 12) | 0
  if ((roll100 | 0) >= threshold) {
    return 0
  }

  const sp = objSpawnStackPtr
  objSpawnStackPtr = (sp + 0x40) >>> 0
  try {
    const pRoomCoords = (sp + 0x20) >>> 0
    if (pRoom !== 0) {
      DUNGEON_GetRoomCoordinates113c(m, pRoom, pRoomCoords)
    } else {
      m.fill(pRoomCoords, 0x20, 0)
    }

    const mask = bDensityFlags & 0xff
    let candCount = 0
    for (let bit = 0; bit < 7; bit++) {
      if ((mask & (1 << bit)) !== 0) {
        m.setU32((sp + candCount * 4) >>> 0, (bit + 1) >>> 0)
        candCount = (candCount + 1) | 0
      }
    }

    const pickIdx = candCount > 0 ? rollObjCtrlSeed113c(m, pObjCtrl, candCount) | 0 : 0
    if (pickIdx >= candCount) {
      return 0
    }
    const hookId = m.u32((sp + pickIdx * 4) >>> 0) | 0
    if (hookId >= candCount) {
      return 0
    }

    switch (hookId) {
      case 1:
        return OBJECTS_LevelHookAlwaysTrue113c(m, pGame, pRoom, pRoomCoords) | 0
      case 2:
        return (
          OBJECTS_PopulateGridObjectsInRect_6FC4FEC0_113c(
            m,
            pGame,
            pRoom,
            pRoomCoords,
            pRoomCoords,
            0,
          ) | 0
        )
      case 4:
        return OBJRGN_PopulateRoomRandomItemDropsGrid_6FC4F4B0_113c(m, pGame, pRoom, pRoomCoords) | 0
      case 5:
        return OBJECTS_PopulateRoomEdgeObjectsMode0_6FC527B0_113c(m, pGame, pRoom, 0, pRoomCoords) | 0
      case 6:
        return OBJECTS_PopulateRoomEdgeObjectsMode1_6FC52790_113c(m, pGame, pRoom, 0, pRoomCoords) | 0
      default:
        return 0
    }
  } finally {
    objSpawnStackPtr = sp
  }
}

/**
 * `@va D2Game:0x6FC4F300` (`OBJECTS_InitObjectUnit`, `esi = pUnit`, `ebx = pGame`, `__stdcall(nUnitId, pRoom, x, y)`).
 *
 * Sets `dwUnitId (+0x0C)`, clears `bSparkly (+0x78)`, updates `dwFlags (+0xC4)` bit `0x04` from `ObjectsTxt + 0x128`,
 * clears `pObjectData->InteractType (+0x04)`, removes pending events on `pUnit + 0xDC`, dispatches
 * `ObjectsTxt->nInitFn (+0x1B1)` via `0x6FD2E050[nInitFn]` (`1/3 -> 0x6FC4ECB0`, `2 -> 0x6FC4EF90`,
 * `8/10 -> mode 1`, `9 -> mode 2`, `16 -> (ObjectsTxt+0x180)<<1`), updates `dwFlags` bit `0x02` from
 * `ObjectsTxt->bSelectable[nMode] (+0xC4 + nMode)`, rolls 1/14 pre-operated mode 2 when `ObjectsTxt + 0x13D != 0`,
 * and allocates interaction data via `0x6FC4E7D0`.
 */
export function OBJECTS_InitObjectUnit113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  nUnitId: number,
  pRoom: number,
  x: number,
  y: number,
): void {
  hitD2GameVa113c(0x6FC4F300)
  if (pUnit === 0) return
  const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  const pInitObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  const pObjectsTxt =
    m.u32(pUnit) === 2 && pInitObjData !== 0 && m.u32(pInitObjData) !== 0
      ? (UNITS_GetObjectTxt113c(m, pUnit) >>> 0)
      : (DATATBLS_GetObjectsTxtRecord113c(m, nClassId) >>> 0)
  if (pObjectsTxt === 0) return

  const savedMode = m.u32((pUnit + 0x10) >>> 0) | 0
  m.setU32((pUnit + 0x0c) >>> 0, nUnitId >>> 0)
  m.setU8((pUnit + 0x78) >>> 0, 0)
  let flags = (m.u32((pUnit + 0xc4) >>> 0) & ~0x08) >>> 0
  m.setU32((pUnit + 0xc4) >>> 0, flags)
  m.setU32((pUnit + 0xa4) >>> 0, 0)

  if (m.u8((pObjectsTxt + 0x128) >>> 0) !== 0) {
    flags = (flags | 0x04) >>> 0
  } else {
    flags = (flags & ~0x04) >>> 0
  }
  m.setU32((pUnit + 0xc4) >>> 0, flags)

  const pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if (pObjData !== 0) {
    m.setU8((pObjData + 0x04) >>> 0, 0)
  }

  if (m.u32((pUnit + 0xdc) >>> 0) !== 0) {
    EVENT_RemoveUnitEvents113c(m, pGame, pUnit)
  }
  m.setU32((pUnit + 0xdc) >>> 0, 0)

  const nInitFn = m.u8((pObjectsTxt + 0x1b1) >>> 0)
  const pObjControl = m.u32((pGame + 0x10f0) >>> 0) >>> 0
  if (nInitFn !== 0 && nInitFn < 0x50) {
    const sp = objSpawnStackPtr
    objSpawnStackPtr = (sp + 0x20) >>> 0
    try {
      m.setU32((sp + 0x00) >>> 0, pGame >>> 0)
      m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
      m.setU32((sp + 0x08) >>> 0, pRoom >>> 0)
      m.setU32((sp + 0x0c) >>> 0, pObjControl >>> 0)
      m.setU32((sp + 0x10) >>> 0, pObjectsTxt >>> 0)
      m.setU32((sp + 0x14) >>> 0, x >>> 0)
      m.setU32((sp + 0x18) >>> 0, y >>> 0)
      const sm = m as SparseMemory113c
      switch (nInitFn) {
        case 1:
          OBJECTS_InitShrineType113c(m, sp)
          break
        case 2:
          OBJECTS_RollChestTrapType113c(m, sp)
          break
        case 3:
          OBJECTS_InitChestLockAndSeed113c(m, sp)
          break
        case 4:
          ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c(m, sp)
          break
        case 5:
          OBJECTS_InitFn05_NoOp113c(m, sp)
          break
        case 6:
          ACT1Q4_OnCairnStoneInit_6FC87D20_113c(sm, sp)
          break
        case 7:
          QUESTS_InitAct1Quest4Object_6FC54DA0_113c(m, sp)
          break
        case 8:
          OBJECT_SetAnimMode2Wrapper113c(m, pGame, pUnit)
          break
        case 9:
          ACT1Q4_InitCainGibbetObject_6FC814A0_113c(m, sp)
          break
        case 10:
          OBJECTS_InitFn10_InitRogueFireAndScheduleEvent_6FC53740_113c(m, sp)
          break
        case 11:
          OBJECTS_InitFn11_InitTownPortal_6FC53330_113c(m, sp)
          break
        case 12:
          OBJECTS_InitFn05_InitPortalDestLevel_6FC533D0_113c(sm, sp)
          break
        case 13:
          ACT1Q4_InitInifussTreeObject_6FC828D0_113c(sm, sp)
          break
        case 14:
          OBJECTS_InitFn14_SetAnimMode1_6FC4E740_113c(m, sp)
          break
        case 15:
          QUESTS_InitAct1Quest3Object_6FC54E10_113c(m, sp)
          break
        case 16:
          OBJECTS_InitFn16_DoubleActToSubType113c(m, sp)
          break
        case 17:
          OBJECT_CheckRespawnOrPortalInRoom113c(m, pUnit, pRoom)
          break
        case 18:
          QUESTS_TriggerAct2Q0SpawnJerhyn_6FC565B0_113c(sm, sp)
          break
        case 19:
          QUESTS_Act2TaintedSunTriggerAltarDarkness_6FC56C20_113c(sm, sp)
          break
        case 20:
          QUESTS_OnTaintedSunAltarInitOrFallbackMode2_6FC56100_113c(sm, sp)
          break
        case 21:
          QUEST0D_InitTemplePortalObject_6FCE9ED0_113c(sm, sp)
          break
        case 22:
          OBJECTS_InitFn22_InitBrazierAndScheduleEvent0_6FC536F0_113c(m, sp)
          break
        case 23:
          OBJECTS_InitFn23_SyncQuest0FObjectAnimMode_6FC54370_113c(m, sp)
          break
        case 24:
          OBJECTS_InitFn24_ScheduleEvent3_6FC536D0_113c(m, sp)
          break
        case 25:
          D2Game_6FD08EB0_113c(sm, sp)
          break
        case 26:
          OBJECTS_InitFn26_SetAnimMode1_6FC4E730_113c(m, sp)
          break
        case 27:
          OBJECTS_InitFn27_RollSubType3_113c(m, sp)
          break
        case 28:
          OBJECTS_OperateGoldChestOrPile_6FC4F580_113c(sm, sp)
          break
        case 29:
          ACT2Q4_InitArcanePortalObjectMode_6FCE99B0_113c(sm, sp)
          break
        case 30:
          ACT2Q4_InitArcanePortalObject_6FCE32C0_113c(m, sp)
          break
        case 31:
          ACT2Q3_NoOpC_6FCE2370_113c(m)
          break
        case 32:
          ACT2Q3_NoOpA_6FCE2350_113c(m)
          break
        case 33:
          ACT2Q3_NoOpB_6FCE2360_113c(m)
          break
        case 34:
          OBJECTS_InitFn34_RandomSetAnimMode1_6FC4EC70_113c(m, sp)
          break
        case 37:
          ACT2Q5_InitArcanePortalObject_6FCE2850_113c(sm, sp)
          break
        case 38:
          ACT2Q6_ActivateHoradricOrifice_6FCE27F0_113c(m, sp)
          break
        case 39:
          ACT3Q2_InitGidbinnAltarObject_6FD04120_113c(m, sp)
          break
        case 41:
          ACT3Q3_InitSewerLeverObject_6FD04980_113c(m, sp)
          break
        case 42:
          ACT3Q3_InitSewerStairsObject_6FD02E00_113c(m, sp)
          break
        case 43:
          ACT3Q0_InitDarkWandererPreset_6FD08290_113c(sm, sp)
          break
        case 44:
          ACT3Q7_InitMephistoPortalObject_6FD03290_113c(sm, sp)
          break
        case 45:
          ACT3Q5_InitStairsObject_6FD098E0_113c(sm, sp)
          break
        case 46:
          OBJECTS_PopulateEvilUrnMonstersInRoom_6FC4F690_113c(sm, sp)
          break
        case 47:
          ACT1Q5_RecordPlayerInMalusRoomAndSpawnLightning_6FC88AB0_113c(sm, sp)
          break
        case 48:
          ACT4Q2_InitHellforgeObject_6FCD9E80_113c(sm, sp)
          break
        case 49:
          ACT3Q2_InitGidbinnBossDefaultPreset_6FD086A0_113c(sm, sp)
          break
        case 50:
          ACT3Q2_InitGidbinnBossActivePreset_6FD08560_113c(sm, sp)
          break
        case 51:
          OBJECTS_InitFn51_ScheduleEvent9IfOperatingOrOpened_6FC532F0_113c(m, sp)
          break
        case 52:
          ACT3Q5_InitCouncilBossPreset_6FD08310_113c(sm, sp)
          break
        case 53:
          ACT3Q5_InitCompellingOrbObject_6FD02A00_113c(m, sp)
          break
        case 54:
          QUEST_Act1TownPortalUpdateState113c(m, pUnit, pGame)
          break
        case 55:
          ACT4Q3_OnSealObjectActivatedTriggerCheck_6FCDC220_113c(sm, sp)
          break
        case 56:
          ACT4_InitObjectNoop_6FCD8930_113c(m, sp)
          break
        case 57:
          OBJECTS_InitFn57_InitSpecialChest_6FC4EF50_113c(m, sp)
          break
        case 58:
          OBJECTS_InitFn58_ScheduleRandomEvent8_6FC53680_113c(m, sp)
          break
        case 59:
          OBJECTS_InitFn59_ActivateAndScheduleEvents7And1_6FC53620_113c(m, sp)
          break
        case 60:
          ACT3Q3_InitCompellingOrbPreset_6FD084A0_113c(sm, sp)
          break
        case 61:
          OBJECTS_InitOperatingObjectWithTimer25_6FC88F90_113c(m, sp)
          break
        case 62:
          QUESTS_Act5RescueBarbsOnPrisonDoorOpen_6FC7C850_113c(sm, sp)
          break
        case 63:
          ACT5Q5_InitAncientStatueObject18_6FC78EA0_113c(m, sp)
          break
        case 64:
          ACT5Q5_InitAncientStatueObject1C_6FC78E50_113c(m, sp)
          break
        case 65:
          ACT5Q5_InitAncientStatueObject14_6FC78EF0_113c(m, sp)
          break
        case 66:
          ACT5Q3_RegisterAnyaObjectAndSpawnMonster200_6FC7EB30_113c(sm, sp)
          break
        case 67:
          ACT5Q3_InitFrozenAnyaObject_6FC7E8D0_113c(sm, sp)
          break
        case 68:
          ACT5Q3_SpawnMonster202AndAttachQuestData_6FC7C5C0_113c(sm, sp)
          break
        case 69:
          ACT5Q3_SpawnFrozenAnyaMonsterIfNeeded_6FC7CF70_113c(sm, sp)
          break
        case 70:
          ACT5_InitObjectNoop_6FC76CE0_113c(m, sp)
          break
        case 71:
          ACT5Q1_SpawnShenkAndAttachQuestData_6FC7C3A0_113c(sm, sp)
          break
        case 72:
          ACT5Q5_InitWorldstoneKeepEntranceObject_6FC774A0_113c(m, sp)
          break
        case 73:
          ACT5Q5_InitSummitDoorObject_6FC765B0_113c(m, sp)
          break
        case 74:
          ACT5Q3_OnFrozenAnyaSpawnedPromoteState2_6FC79EF0_113c(sm, sp)
          break
        case 75:
          ACT5Q6_InitWorldstoneChamberObject94_6FC76520_113c(m, sp)
          break
        case 76:
          ACT5Q5_InitAncientsAltarObject_6FC773D0_113c(m, sp)
          break
        case 77:
          ACT5Q6_InitWorldstoneChamberObject9C_6FC764D0_113c(m, sp)
          break
        case 78:
          ACT4Q2_InitHellforgeObject_6FCD8870_113c(m, sp)
          break
        case 79:
          ACT5Q6_RollBaalTauntMonsterIdAndBroadcastPacket50_6FC7A820_113c(sm, sp)
          break
        default:
          break
      }
    } finally {
      objSpawnStackPtr = sp
    }
  }

  const bSelectable = m.u8((pObjectsTxt + 0xc4 + savedMode) >>> 0)
  let flagsAfter = m.u32((pUnit + 0xc4) >>> 0)
  if (bSelectable !== 0) {
    flagsAfter = (flagsAfter | 0x02) >>> 0
  } else {
    flagsAfter = (flagsAfter & ~0x02) >>> 0
  }
  m.setU32((pUnit + 0xc4) >>> 0, flagsAfter)

  if (m.u8((pObjectsTxt + 0x13d) >>> 0) !== 0 && ((flagsAfter >>> 7) & 1) === 0 && pObjControl !== 0) {
    const seed: D2SeedStrc = {
      lo: m.u32(pObjControl) >>> 0,
      hi: m.u32((pObjControl + 0x04) >>> 0) >>> 0,
    }
    const r = seedRoll(seed, 0x0e)
    m.setU32(pObjControl, seed.lo >>> 0)
    m.setU32((pObjControl + 0x04) >>> 0, seed.hi >>> 0)
    if (r === 0) {
      UNITS_ChangeAnimMode113c(m, pUnit, 2)
    }
  }

  const pInteractList = OBJECTS_AllocInteractStrc113c(m, pGame, pObjectsTxt)
  UNITS_SetField7C_113c(m, pUnit, pInteractList)

  const postInitMode = m.u32((pUnit + 0x10) >>> 0) | 0
  if (postInitMode !== savedMode && (m.u8((pObjectsTxt + 0x167) >>> 0) & 0x20) === 0) {
    pendingObjectInitModeFixes113c.push({
      m,
      pUnit: pUnit >>> 0,
      savedMode,
      postInitMode,
    })
  }
}

interface PendingObjectInitModeFix113c {
  readonly m: Memory113c
  readonly pUnit: number
  readonly savedMode: number
  readonly postInitMode: number
}

const pendingObjectInitModeFixes113c: PendingObjectInitModeFix113c[] = []

export function clearPendingSavedObjectInitModes113c(): void {
  pendingObjectInitModeFixes113c.length = 0
}

export function flushPendingSavedObjectInitModes113c(): void {
  if (pendingObjectInitModeFixes113c.length === 0) return
  for (let i = 0; i < pendingObjectInitModeFixes113c.length; i++) {
    const entry = pendingObjectInitModeFixes113c[i]!
    if ((entry.m.u32((entry.pUnit + 0x10) >>> 0) | 0) === entry.savedMode) {
      entry.m.setU32((entry.pUnit + 0x10) >>> 0, entry.postInitMode >>> 0)
    }
  }
  pendingObjectInitModeFixes113c.length = 0
}


