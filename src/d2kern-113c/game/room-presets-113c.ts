/**
 * Diablo II v1.13c `D2Game.dll` room preset-unit spawning (image base `0x6FC20000`).
 *
 * `ROOM_SpawnPresetUnits113c` (`0x6FD01430`) is the first step of `GAME_UpdateActRooms113c`
 * (`0x6FC4CBE0`) for a room that has not been populated yet: it walks the DRLG preset units of the room
 * (`D2Common.#10476`, `pRoomEx+0x5C`) and creates every non-monster preset first, then (outside level
 * `0x88`) every monster preset.
 *
 * Every function below is a 1:1 port of the cited `objdump -d -M intel` disassembly of `D2Game.dll`.
 * Callees without a kernel port yet are reached through `RoomPresetCallees113c` (all members required).
 *
 * `D2PresetUnitStrc` roles as used by this code (the generated layout names `+0x00`/`+0x14` the other way
 * round): `+0x00` mode, `+0x04` class id, `+0x08` x (subtiles, room relative), `+0x0C` next, `+0x10` save
 * chain, `+0x14` unit type, `+0x18` y, `+0x1C` flags (bit 0 = already spawned).
 */
import { DUNGEON_AcquireRoomExDT1Mask113c, DUNGEON_GetLevelIdFromRoom113c, DUNGEON_GetRoomCoordinates113c } from '../common/dungeon.ts'
import { DRLGPRESET_MovePointerAndClear113c } from '../common/drlg/preset.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { MONSTATS2_CheckFlagBit113c } from './regpop-spawn-113c.ts'

const PRESET_OFF_MODE = 0x00
const PRESET_OFF_CLASS = 0x04
const PRESET_OFF_X = 0x08
const PRESET_OFF_NEXT = 0x0c
const PRESET_OFF_SAVE_CHAIN = 0x10
const PRESET_OFF_TYPE = 0x14
const PRESET_OFF_Y = 0x18
const PRESET_OFF_FLAGS = 0x1c
/** `pGame->nPresetCounter86` (`0x6FD014EF mov eax, [ebx+0x1DE4]`). */
const GAME_OFF_PRESET_COUNTER_86 = 0x1de4
/** `pGame->dwGameSeedLow` style dword read at `0x6FD014FE mov eax, [ebx+0x7C]`. */
const GAME_OFF_7C = 0x7c

/** Callees of the preset-unit spawner without a kernel port yet (all required). */
export interface RoomPresetCallees113c {
  /** `D2Game:0x6FC67CF0` (`ecx = pRoom`, `eax = nClassId`, stack `(pGame, x, y, nMode)`): monster preset. */
  readonly spawnMonsterPreset: (m: Memory113c, pRoom: number, nClassId: number, pGame: number, x: number, y: number, nMode: number) => number
  /** `D2Game:0x6FC4E830` (`esi = nClassId`, stack `(pGame, pRoom, x, y, nMode)`): object class `> 0x23D`. */
  readonly spawnSpecialObject: (m: Memory113c, nClassId: number, pGame: number, pRoom: number, x: number, y: number, nMode: number) => number
  /**
   * `D2Game:0x6FD01D90` `SUNIT_AllocUnitData` (`ecx = nUnitType`, `edx = nClassId`,
   * stack `(x, y, pGame, pRoom, 1, nMode, 0)`).
   */
  readonly allocUnitData: (
    m: Memory113c,
    nUnitType: number,
    nClassId: number,
    x: number,
    y: number,
    pGame: number,
    pRoom: number,
    a5: number,
    nMode: number,
    a7: number,
  ) => number
  /** `D2Game:0x6FC31070` (`ebx = ppItem`, stack `(pGame, pDropArgs, 1)`): places a preset item. */
  readonly placePresetItem: (m: Memory113c, ppItem: number, pGame: number, pDropArgs: number, a2: number) => number
  /** `D2Game:0x6FD020A0` (`ecx = pGame`, `edx = pUnit`): frees a unit. */
  readonly freeUnit: (m: Memory113c, pGame: number, pUnit: number) => void
  /** `D2Game:0x6FC79E10` (tail call from `0x6FC55E50`, `eax = pGame`, `ecx = pUnit`, `edx = pSaveChain`). */
  readonly initQuestObject1CB: (m: Memory113c, pGame: number, pUnit: number, pSaveChain: number) => void
  /** `D2Game:0x6FC79D30` (tail call from `0x6FC55E50`). */
  readonly initQuestObject1CD: (m: Memory113c, pGame: number, pUnit: number, pSaveChain: number) => void
  /** `D2Game:0x6FC7A5C0` (tail call from `0x6FC55E50`). */
  readonly initQuestObject21F: (m: Memory113c, pGame: number, pUnit: number, pSaveChain: number) => void
}

/** Scratch "stack" for the on-stack locals of these functions (outside every recorded heap range). */
let presetStackPtr = 0x7fd00000

/**
 * Preset object post-init (`eax = pGame`, `ecx = pUnit`, `edx = pSaveChain`, plain `ret`): for an object
 * (`dwUnitType == 2`) of class `0x1CB` / `0x1CD` / `0x21F` tail-calls `0x6FC79E10` / `0x6FC79D30` /
 * `0x6FC7A5C0`; otherwise returns.
 *
 * @va D2Game:0x6FC55E50 (50B)
 */
export function OBJECTS_InitPresetQuestObject113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pSaveChain: number,
  callees: RoomPresetCallees113c,
): void {
  if (pUnit === 0) return
  if (m.u32(pUnit >>> 0) !== 2) return
  const nClassId = m.u32((pUnit + 4) >>> 0) | 0
  if (nClassId === 0x1cb) callees.initQuestObject1CB(m, pGame, pUnit, pSaveChain)
  else if (nClassId === 0x1cd) callees.initQuestObject1CD(m, pGame, pUnit, pSaveChain)
  else if (nClassId === 0x21f) callees.initQuestObject21F(m, pGame, pUnit, pSaveChain)
}

/**
 * Creates one preset unit (`ecx = nMode`, `eax = nClassId`, `edx = nUnitType`, stack
 * `(pGame, pRoom, x, y)`, `ret 0x10`):
 * - type 1: `0x6FC67CF0`;
 * - type 2: class `> 0x23D` -> `0x6FC4E830`, class `== 0x23D` -> `NULL`;
 * - otherwise `SUNIT_AllocUnitData` (`0x6FD01D90`); for an item (type 4) a `0x84`-byte drop record
 *   (`+0x30 = 2`, `+0x0C = nLevelId`) is passed to `0x6FC31070`, and the item is freed (`0x6FD020A0`, result
 *   `NULL`) when that fails.
 * A created unit gets `dwFlags |= 0x03000000` (`+0xC4`).
 *
 * @va D2Game:0x6FD012D0 (222B)
 */
export function SUNIT_CreatePresetUnit113c(
  m: Memory113c,
  nMode: number,
  nClassId: number,
  nUnitType: number,
  pGame: number,
  pRoom: number,
  x: number,
  y: number,
  callees: RoomPresetCallees113c,
): number {
  let pUnit = 0
  if (nUnitType === 1) {
    pUnit = callees.spawnMonsterPreset(m, pRoom, nClassId, pGame, x, y, nMode) >>> 0
  } else if (nUnitType === 2 && (nClassId | 0) > 0x23d) {
    pUnit = callees.spawnSpecialObject(m, nClassId, pGame, pRoom, x, y, nMode) >>> 0
  } else if (nUnitType === 2 && (nClassId | 0) === 0x23d) {
    return 0
  } else {
    pUnit = callees.allocUnitData(m, nUnitType, nClassId, x, y, pGame, pRoom, 1, nMode, 0) >>> 0
    if (nUnitType === 4) {
      if (pUnit === 0) return 0
      const sp = presetStackPtr
      presetStackPtr = (sp + 0x90) >>> 0
      try {
        const ppItem = sp
        const pDropArgs = (sp + 4) >>> 0
        m.setU32(ppItem, pUnit)
        m.fill(pDropArgs, 0x84, 0)
        m.setU32((pDropArgs + 0x30) >>> 0, 2)
        m.setU32((pDropArgs + 0x0c) >>> 0, DUNGEON_GetLevelIdFromRoom113c(m, pRoom) >>> 0)
        if (callees.placePresetItem(m, ppItem, pGame, pDropArgs, 1) === 0) {
          callees.freeUnit(m, pGame, m.u32(ppItem) >>> 0)
          return 0
        }
        pUnit = m.u32(ppItem) >>> 0
      } finally {
        presetStackPtr = sp
      }
    }
  }
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x03000000) >>> 0)
  }
  return pUnit
}

/**
 * Spawns one preset unit (`ebx = pGame`, `edi = pRoom`, `esi = pPreset`, plain `ret`): position is the
 * preset offset plus the room's subtile origin (`D2Common.#10561`); a created monster hands its
 * `pPreset->pSaveChain` to `pMonsterData->pAi (+0x28) + 0x38` (`D2Common.#10171`), a created object goes
 * through `0x6FC55E50`.
 *
 * @va D2Game:0x6FD013B0 (119B)
 */
export function ROOM_SpawnPresetUnit113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
  pPreset: number,
  callees: RoomPresetCallees113c,
): void {
  const sp = presetStackPtr
  presetStackPtr = (sp + 0x20) >>> 0
  let x = 0
  let y = 0
  try {
    DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
    x = ((m.u32((pPreset + PRESET_OFF_X) >>> 0) | 0) + (m.u32(sp) | 0)) | 0
    y = ((m.u32((pPreset + PRESET_OFF_Y) >>> 0) | 0) + (m.u32((sp + 4) >>> 0) | 0)) | 0
  } finally {
    presetStackPtr = sp
  }
  const pUnit = SUNIT_CreatePresetUnit113c(
    m,
    m.u32((pPreset + PRESET_OFF_MODE) >>> 0) | 0,
    m.u32((pPreset + PRESET_OFF_CLASS) >>> 0) | 0,
    m.u32((pPreset + PRESET_OFF_TYPE) >>> 0) | 0,
    pGame,
    pRoom,
    x,
    y,
    callees,
  )
  if (pUnit === 0) return
  const nType = m.u32((pPreset + PRESET_OFF_TYPE) >>> 0) | 0
  if (nType === 1) {
    let pAi = 0
    if (m.u32(pUnit >>> 0) === 1) {
      const pMonsterData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonsterData !== 0) pAi = m.u32((pMonsterData + 0x28) >>> 0) >>> 0
    }
    const ppSaveChain = (pPreset + PRESET_OFF_SAVE_CHAIN) >>> 0
    if (m.u32(ppSaveChain) === 0) return
    DRLGPRESET_MovePointerAndClear113c(m, ppSaveChain, (pAi + 0x38) >>> 0)
    return
  }
  if (nType === 2) {
    OBJECTS_InitPresetQuestObject113c(m, pGame, pUnit, m.u32((pPreset + PRESET_OFF_SAVE_CHAIN) >>> 0) >>> 0, callees)
  }
}

/**
 * Spawns the DRLG preset units of `pRoom` (`eax = pRoom`, `ecx = pGame`, plain `ret`). `pGame == NULL`
 * returns. Pass 1 walks the preset list (`D2Common.#10476`) and spawns every non-monster preset whose
 * flag bit 0 is clear, with level filters: level `0x88` skips objects `0x10C`/`0x1A`/`0x10D`; levels
 * `0x85`/`0x87` skip object `0x18D`; level `0x86` skips object `0x192` and spawns any other object only
 * when `++pGame[0x1DE4] != pGame[0x7C] % 3 + 3`. Pass 2 (all levels but `0x88`) spawns the monster presets.
 *
 * @va D2Game:0x6FD01430 (311B)
 */
export function ROOM_SpawnPresetUnits113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
  callees: RoomPresetCallees113c,
): void {
  if (pGame === 0) return
  const pFirst = DUNGEON_AcquireRoomExDT1Mask113c(m, pRoom) >>> 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  for (let pPreset = pFirst; pPreset !== 0; pPreset = m.u32((pPreset + PRESET_OFF_NEXT) >>> 0) >>> 0) {
    const nType = m.u32((pPreset + PRESET_OFF_TYPE) >>> 0) | 0
    if (nType === 1) continue
    if ((m.u8((pPreset + PRESET_OFF_FLAGS) >>> 0) & 1) !== 0) continue
    const nClassId = (): number => m.u32((pPreset + PRESET_OFF_CLASS) >>> 0) | 0
    if (nLevelId === 0x88) {
      if (nType !== 2 || (nClassId() !== 0x10c && nClassId() !== 0x1a && nClassId() !== 0x10d)) {
        ROOM_SpawnPresetUnit113c(m, pGame, pRoom, pPreset, callees)
      }
      if (nClassId() === 0x1a) DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
    } else if (nLevelId === 0x85 || nLevelId === 0x87) {
      if (nType === 2 && nClassId() === 0x18d) continue
      ROOM_SpawnPresetUnit113c(m, pGame, pRoom, pPreset, callees)
    } else if (nLevelId === 0x86) {
      if (nType !== 2) {
        ROOM_SpawnPresetUnit113c(m, pGame, pRoom, pPreset, callees)
        continue
      }
      if (nClassId() === 0x192) continue
      const pCounter = (pGame + GAME_OFF_PRESET_COUNTER_86) >>> 0
      const cnt = ((m.u32(pCounter) | 0) + 1) >>> 0
      m.setU32(pCounter, cnt)
      const target = ((m.u32((pGame + GAME_OFF_7C) >>> 0) >>> 0) % 3) + 3
      if (cnt !== target) ROOM_SpawnPresetUnit113c(m, pGame, pRoom, pPreset, callees)
    } else {
      ROOM_SpawnPresetUnit113c(m, pGame, pRoom, pPreset, callees)
    }
  }
  if (nLevelId === 0x88) return
  for (let pPreset = pFirst; pPreset !== 0; pPreset = m.u32((pPreset + PRESET_OFF_NEXT) >>> 0) >>> 0) {
    if ((m.u32((pPreset + PRESET_OFF_TYPE) >>> 0) | 0) !== 1) continue
    if ((m.u8((pPreset + PRESET_OFF_FLAGS) >>> 0) & 1) !== 0) continue
    ROOM_SpawnPresetUnit113c(m, pGame, pRoom, pPreset, callees)
  }
}

/**
 * Spawns a monster preset unit (`ecx = pRoom, eax = nClassId`, stack `(pGame, x, y, nMode)`, `ret 0x10`).
 * Resolves `MonPresetTxt` (`D2Common.#11241` via `DRLG_GetActNoFromLevelId`) when `nClassId` is a preset
 * index, and handles SuperUnique (`1`), regular monster (`2`), or special handler (`nClassId >= nMonStatsCount + nSuperUniquesCount`).
 *
 * @va D2Game:0x6FC67CF0 (305B)
 */
export function ROOM_SpawnMonsterPreset113c(
  m: Memory113c,
  pRoom: number,
  nClassId: number,
  pGame: number,
  x: number,
  y: number,
  nMode: number,
  spawnAtCoords: (
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
  getMonPresetRecord?: (m: Memory113c, nAct: number, nPlaceId: number, pOutType: number) => number,
  spawnSuperUnique?: (m: Memory113c, pGame: number, pRoom: number, x: number, y: number, nSuperUniqueId: number) => number,
): number {
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  let resolvedId = nClassId | 0
  let nType = 2
  if (getMonPresetRecord !== undefined && nLevelId > 0) {
    const pTables = m.u32(0x6fde9e1c) >>> 0
    const pLvlRec = pTables !== 0 ? (m.u32((pTables + 0xbb8) >>> 0) + Math.imul(nLevelId, 0x220)) >>> 0 : 0
    const nAct = pLvlRec !== 0 ? m.u8((pLvlRec + 0x05) >>> 0) : 0
    const pScratch = 0x7ff00f00
    m.setU8(pScratch, 2)
    resolvedId = getMonPresetRecord(m, nAct, resolvedId, pScratch) | 0
    nType = (m.u8(pScratch) << 24) >> 24
  }
  const pTables = m.u32(0x6fde9e1c) >>> 0
  const nMonStats = pTables !== 0 ? m.u32((pTables + 0xa80) >>> 0) | 0 : 0
  const nSuperUniques = pTables !== 0 ? m.u32((pTables + 0xa74) >>> 0) | 0 : 0
  if (resolvedId >= nMonStats + nSuperUniques) return 0
  if (nType === 2) {
    if (resolvedId === 0x222 && nLevelId === 0x78) {
      return spawnAtCoords(m, 0x222, nMode, pGame, pRoom, x, y, -1, 0x42)
    }
    if (MONSTATS2_CheckFlagBit113c(m, resolvedId, 0x0d) !== 0) {
      return 0
    }
    const pMonStatsBase = pTables !== 0 ? m.u32((pTables + 0xa78) >>> 0) >>> 0 : 0
    const pMonStatsRec = pMonStatsBase !== 0 ? (pMonStatsBase + Math.imul(resolvedId, 0x1a8)) >>> 0 : 0
    const wFlags = pMonStatsRec !== 0 && (m.u8((pMonStatsRec + 0x0e) >>> 0) & 4) !== 0 ? 8 : 0
    let pUnit = spawnAtCoords(m, resolvedId, nMode, pGame, pRoom, x, y, -1, wFlags)
    if (pUnit === 0 && (wFlags & 8) !== 0) {
      pUnit = spawnAtCoords(m, resolvedId, nMode, pGame, pRoom, x, y, 4, wFlags)
    }
    return pUnit
  }
  if (nType === 1 && spawnSuperUnique !== undefined) {
    return spawnSuperUnique(m, pGame, pRoom, x, y, resolvedId)
  }
  return 0
}

