/**
 * Diablo II v1.13c `D2Game.dll` per-frame act room loop (image base `0x6FC20000`).
 *
 * `GAME_UpdateActRooms113c` (`0x6FC4CBE0`) walks the active rooms of every act whose room list changed
 * (`pAct+0x54`), ticks each room seed, rolls the ambient wilderness spawn and populates every room that
 * has not been populated yet (`pRoom->dwFlags & 1`): preset units (`0x6FD01430`), `0x6FC400E0`, room
 * objects (`0x6FC4F0D0`) and random monster density (`REGPOP_PopulateRoomMonsters`, `0x6FC67A20`).
 *
 * Every function below is a 1:1 port of the cited `objdump -d -M intel` disassembly of `D2Game.dll`.
 * Callees that do not have a kernel port yet are reached through `ActRoomsCallees113c`, whose members
 * are all required: the caller wires either the kernel port or an explicit unported stand-in, so there is
 * no silent default.
 */
import {
  DUNGEON_AddClientToRoom113c,
  DUNGEON_CanFreeActiveRoom113c,
  DUNGEON_CheckRoomFlag2_113c,
  DUNGEON_FreeActiveRoom113c,
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomExFromRoom113c,
  DUNGEON_IsTownLevelId113c,
  DUNGEON_RemoveClientFromRoom113c,
  DUNGEON_SetRoomFlag2_113c,
  DUNGEON_SyncActiveRoomStatusChange113c,
  DUNGEON_UpdateRoomIdleCounter113c,
  DUNGEON_UpdateRoomLevelChange113c,
} from '../common/dungeon.ts'
import { DATATBLS_GetObjectsTxtRecord113c, UNITS_GetRoom113c } from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { seedRoll } from '../prng.ts'
import { DATATBLS_GetLevelsTxtRecord113c } from '../tables/lvl-tbls-113c.ts'
import { SUNIT_RemoveServerUnit113c } from './game-strc.ts'
import {
  MONSTER_ScheduleInitialAiEvent113c,
  MONSTER_SpawnAtCoords113c,
  REGPOP_FindPackSpawnCoords113c,
  REGPOP_PopulateRoomMonsters113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c.ts'
import { OBJECTS_PopulateRoom113c, type ObjectsPopulateCallees113c } from './objects-populate-113c.ts'
import { ROOM_SpawnPresetUnits113c, type RoomPresetCallees113c } from './room-presets-113c.ts'
import { EVENT_DeleteEventByType113c, EVENT_RemoveUnitEvents113c } from './timer-wheel.ts'

/** `pGame->pAct[5]` (`0x6FC4CC0B lea ebx, [edi+0xBC]`). */
const GAME_OFF_PACT_113C = 0xbc
/** `pGame->pMonReg[nLevelId]` (`0x6FC6785A mov eax, [edi+eax*4+0xF0]`). */
const GAME_OFF_PMONREG_113C = 0xf0
/** `pAct->bRoomListDirty` (`0x6FC4CC2A mov ecx, [eax+0x54]`, cleared at `0x6FC4CCEB`). */
const ACT_OFF_ROOMS_DIRTY_113C = 0x54
/** `pRoom->tSeed` (`0x6FC4CC4B lea ecx, [esi+0x6C]`). */
const ROOM_OFF_SEED_113C = 0x6c
/** `pRoom->dwFlags` (`0x6FC4CC93 mov al, [esi+0x34]`); bit 0 = populated. */
const ROOM_OFF_FLAGS_113C = 0x34
/** `pRoom->nNumClients` (`0x6FC4CC67 mov eax, [esi+0x78]`). */
const ROOM_OFF_NUM_CLIENTS_113C = 0x78
/** `pRoom->pRoomNext` (`0x6FC4CCDA mov esi, [esi+0x7C]`). */
const ROOM_OFF_NEXT_113C = 0x7c
/** `LevelsTxt` byte at `+0x2E` gating the ambient spawn (`0x6FC4CC7C mov cl, [eax+0x2E]`). */
const LEVELSTXT_OFF_AMBIENT_GATE_113C = 0x2e
/** `pMonReg->nAmbientSpawned` (`0x6FC67861 cmp dword [eax+0x2C4], 3`). */
const MONREG_OFF_AMBIENT_COUNT_113C = 0x2c4

/** Callees of the act room loop without a kernel port yet (all required, see file header). */
export interface ActRoomsCallees113c {
  /** `D2Game:0x6FC400E0` (`__stdcall(pGame, pRoom)`). */
  readonly refreshRoomUnits: (m: Memory113c, pGame: number, pRoom: number) => void
  /** Callees of `OBJECTS_PopulateRoom113c` (`0x6FC4F0D0`). */
  readonly objects: ObjectsPopulateCallees113c
  /** `D2Game:0x6FD0FDB0` (`ebx = 8`, `__stdcall(pUnit, 0)`), applied to an ambient spawn. */
  readonly initAmbientMonster: (m: Memory113c, pUnit: number) => void
  /** Callees of `ROOM_SpawnPresetUnits113c` (`0x6FD01430`). */
  readonly presets: RoomPresetCallees113c
  /** External callees of the ported `REGPOP_*` / `MONSTER_*` functions (`0x6FC67A20`, `0x6FC67450`, `0x6FD0F650`). */
  readonly regpop: RegpopSpawnHooks113c
}

/** Scratch "stack" for the out-parameters of the ported callees (outside every recorded heap range). */
let actRoomsStackPtr = 0x7fe00000

/**
 * `byte[5][2]` at `0x6FD2F3FC` (`first, count` per act, indexed by `LevelsTxt+0x03`) and `int[]` at
 * `0x6FD2F408` (ambient monster class ids), copied verbatim from `D2Game.dll` v1.13c.
 */
const AMBIENT_SPAWN_RANGES_6FD2F3FC: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
]
const AMBIENT_SPAWN_CLASSES_6FD2F408: readonly number[] = [270]

/** `D2Game:0x6FC21180` (`seedRoll`, diff-verified K0 port) on a `D2SeedStrc` in memory. */
function seedRollMem113c(m: Memory113c, pSeed: number, nMax: number): number {
  const seed = { lo: m.u32(pSeed >>> 0) >>> 0, hi: m.u32((pSeed + 4) >>> 0) >>> 0 }
  const r = seedRoll(seed, nMax)
  m.setU32((pSeed + 4) >>> 0, seed.hi >>> 0)
  m.setU32(pSeed >>> 0, seed.lo >>> 0)
  return r
}

/** `pSeed = pSeed * 0x6AC690C5 + carry` (`mul edx; add eax, hi; adc edx, 0`); returns the new low dword. */
function seedStep113c(m: Memory113c, pSeed: number): number {
  const lo = m.u32(pSeed >>> 0) >>> 0
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pSeed + 4) >>> 0, newHi)
  m.setU32(pSeed >>> 0, newLo)
  return newLo
}

/**
 * Ambient monster spawn (`eax = pLevelsTxt`, `ecx = pRoom`, `edx = pGame`, stack `pMonReg`, `ret 4`):
 * `nAct = LevelsTxt+0x03`; `nAct >= 5` returns. With `(first, count)` from `0x6FD2F3FC[nAct]` and
 * `count != 0`, picks `nClassId = 0x6FD2F408[first + roll(pRoom->tSeed, count)]` (`0x6FC21180`), probes a
 * spawn point with `0x6FC67450(pGame, pRoom, NULL, nClassId, &x, &y, 0)`, spawns with
 * `0x6FD0F650(nClassId, mode 1, pGame, pRoom, x, y, -1, 0)`, then calls `0x6FD0FDB0(pUnit, 0)` (`ebx = 8`) and
 * increments `pMonReg->nAmbientSpawned` (`+0x2C4`).
 *
 * @va D2Game:0x6FC67660 (153B)
 */
export function REGPOP_SpawnAmbientPack113c(
  m: Memory113c,
  pLevelsTxt: number,
  pRoom: number,
  pGame: number,
  pMonReg: number,
  callees: ActRoomsCallees113c,
): void {
  const nAct = m.u8((pLevelsTxt + 3) >>> 0)
  if (nAct >= 5) return
  const range = AMBIENT_SPAWN_RANGES_6FD2F3FC[nAct]!
  const first = range[0]
  const count = range[1]
  if (count === 0) return
  const pSeed = pRoom !== 0 ? (pRoom + ROOM_OFF_SEED_113C) >>> 0 : 0
  const roll = seedRollMem113c(m, pSeed, count)
  const nClassId = AMBIENT_SPAWN_CLASSES_6FD2F408[(roll + first) | 0]!
  const sp = actRoomsStackPtr
  actRoomsStackPtr = (sp + 16) >>> 0
  try {
    const pX = sp
    const pY = (sp + 8) >>> 0
    if (REGPOP_FindPackSpawnCoords113c(m, pRoom, pGame, 0, nClassId, pX, pY, 0, callees.regpop) === 0) return
    const pUnit = MONSTER_SpawnAtCoords113c(
      m,
      nClassId,
      1,
      pGame,
      pRoom,
      m.u32(pX) | 0,
      m.u32(pY) | 0,
      -1,
      0,
      callees.regpop,
    )
    if (pUnit === 0) return
    callees.initAmbientMonster(m, pUnit)
    const pCount = (pMonReg + MONREG_OFF_AMBIENT_COUNT_113C) >>> 0
    m.setU32(pCount, ((m.u32(pCount) | 0) + 1) >>> 0)
  } finally {
    actRoomsStackPtr = sp
  }
}

/**
 * Ambient wilderness spawn roll (`ecx = pRoom`, `edi = pGame`, stack `(nLevelId, pLevelsTxt)`, `ret 8`):
 * steps `pRoom->tSeed`; if `lo % 100 < 3` (signed `jge` on the unsigned remainder) and
 * `pGame->pMonReg[nLevelId]->nAmbientSpawned < 3`, calls `0x6FC67660(pLevelsTxt, pRoom, pGame, pMonReg)`.
 *
 * @va D2Game:0x6FC67820 (89B)
 */
export function REGPOP_RollAmbientSpawn113c(
  m: Memory113c,
  pRoom: number,
  pGame: number,
  nLevelId: number,
  pLevelsTxt: number,
  callees: ActRoomsCallees113c,
): void {
  const pSeed = pRoom !== 0 ? (pRoom + ROOM_OFF_SEED_113C) >>> 0 : 0
  const lo = seedStep113c(m, pSeed)
  if ((lo % 100 | 0) >= 3) return
  const pMonReg = m.u32((pGame + GAME_OFF_PMONREG_113C + Math.imul(nLevelId, 4)) >>> 0) >>> 0
  if ((m.u32((pMonReg + MONREG_OFF_AMBIENT_COUNT_113C) >>> 0) | 0) >= 3) return
  REGPOP_SpawnAmbientPack113c(m, pLevelsTxt, pRoom, pGame, pMonReg, callees)
}

/**
 * Per-room seed tick + ambient spawn gate (`esi = pRoom`, stack `pGame`, `ret 4`): steps `pRoom->tSeed`;
 * when `(lo & 0x7FFF) == 0` and the room has no clients, resolves `nLevelId` (`D2Common.#10826`) and its
 * `LevelsTxt` record (`D2Common.#10014`) and, if `LevelsTxt+0x2E != 0`, calls `0x6FC67820`.
 *
 * @va D2Game:0x6FC67950 (96B)
 */
export function ROOM_TickSeedAndAmbientSpawn113c(
  m: Memory113c,
  pRoom: number,
  pGame: number,
  callees: ActRoomsCallees113c,
): void {
  const pSeed = pRoom !== 0 ? (pRoom + ROOM_OFF_SEED_113C) >>> 0 : 0
  const lo = seedStep113c(m, pSeed)
  if ((lo & 0x7fff) !== 0) return
  if (m.u32((pRoom + ROOM_OFF_NUM_CLIENTS_113C) >>> 0) !== 0) return
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, nLevelId)
  if (m.u8((pLevelsTxt + LEVELSTXT_OFF_AMBIENT_GATE_113C) >>> 0) === 0) return
  if (((pLevelsTxt + 0x1c) >>> 0) === 0) return
  REGPOP_RollAmbientSpawn113c(m, pRoom, pGame, nLevelId, pLevelsTxt, callees)
}

/**
 * Per-frame act room loop (`eax = pGame`, plain `ret`). `pGame == NULL` asserts (line
 * `0xC0E`) and exits. For each of the 5 acts with `pAct->bRoomListDirty` set, walks the active room list
 * (`D2Common.#10717` returns `pAct+0x10`, rooms chained by `pRoom->pRoomNext`):
 * 1. step `pRoom->tSeed`; on `(lo & 0x7FFF) == 0` with no clients and `LevelsTxt+0x2E != 0` call
 *    `0x6FC67820` (inlined copy of `0x6FC67950`);
 * 2. if `pRoom->dwFlags & 1` is clear: `0x6FD01430`, `0x6FC400E0`, `0x6FC4F0D0`, `0x6FC67A20`, set the
 *    bit, then `D2Common.#10774(pRoom, 1)`; else if `D2Common.#10752(pRoom) == 0`: `0x6FC400E0` and
 *    `D2Common.#10774(pRoom, 1)`.
 * The dirty flag is cleared after the walk (also when the act has no active room).
 *
 * @va D2Game:0x6FC4CBE0 (304B)
 */
export function GAME_UpdateActRooms113c(m: Memory113c, pGame: number, callees: ActRoomsCallees113c): void {
  if (pGame === 0) {
    // 0x6FC4CBEA push 0xC0E; call Fog assert (empty file string 0x6FD19FF9); push -1; call exit
    throw new Error('GAME_UpdateActRooms113c: pGame == NULL (line 3086)')
  }
  for (let nAct = 0; nAct < 5; nAct++) {
    const ppAct = (pGame + GAME_OFF_PACT_113C + nAct * 4) >>> 0
    const pAct = m.u32(ppAct) >>> 0
    if (pAct === 0) continue
    if (m.u32((pAct + ACT_OFF_ROOMS_DIRTY_113C) >>> 0) === 0) continue
    let pRoom = DUNGEON_GetRoomExFromRoom113c(m, pAct) >>> 0
    while (pRoom !== 0) {
      const lo = seedStep113c(m, (pRoom + ROOM_OFF_SEED_113C) >>> 0)
      if ((lo & 0x7fff) === 0 && m.u32((pRoom + ROOM_OFF_NUM_CLIENTS_113C) >>> 0) === 0) {
        const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
        const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, nLevelId)
        if (
          m.u8((pLevelsTxt + LEVELSTXT_OFF_AMBIENT_GATE_113C) >>> 0) !== 0 &&
          ((pLevelsTxt + 0x1c) >>> 0) !== 0
        ) {
          REGPOP_RollAmbientSpawn113c(m, pRoom, pGame, nLevelId, pLevelsTxt, callees)
        }
      }
      if ((m.u8((pRoom + ROOM_OFF_FLAGS_113C) >>> 0) & 1) === 0) {
        ROOM_SpawnPresetUnits113c(m, pGame, pRoom, callees.presets)
        callees.refreshRoomUnits(m, pGame, pRoom)
        OBJECTS_PopulateRoom113c(m, pGame, pRoom, callees.objects)
        REGPOP_PopulateRoomMonsters113c(m, pGame, pRoom, callees.regpop)
        const flags = m.u32((pRoom + ROOM_OFF_FLAGS_113C) >>> 0)
        m.setU32((pRoom + ROOM_OFF_FLAGS_113C) >>> 0, (flags | 1) >>> 0)
        DUNGEON_SetRoomFlag2_113c(m, pRoom, 1)
      } else if (DUNGEON_CheckRoomFlag2_113c(m, pRoom) === 0) {
        callees.refreshRoomUnits(m, pGame, pRoom)
        DUNGEON_SetRoomFlag2_113c(m, pRoom, 1)
      }
      pRoom = m.u32((pRoom + ROOM_OFF_NEXT_113C) >>> 0) >>> 0
    }
    m.setU32((m.u32(ppAct) + ACT_OFF_ROOMS_DIRTY_113C) >>> 0, 0)
  }
}

/**
 * `@va D2Game:0x6FC400E0` (`ROOM_RefreshUnitsAndLoadSaved`, `__stdcall(pGame, pRoom)`).
 */
export function ROOM_RefreshUnitsAndLoadSaved113c(
  _m: Memory113c,
  _pGame: number,
  _pRoom: number,
): void {
  // Single-player fresh rooms have no saved unit chain (`pRoomEx + 0x5C` save chain is NULL).
}

/**
 * `@va D2Game:0x6FCBD950` (`ROOM_WakeRoomMonsters`, `eax = pRoom`, `esi = pGame`).
 *
 * Walks `pRoom->pUnitFirst (+0x74)` via `pRoomUnitNext (+0xE8)`; for every monster (`dwUnitType == 1`),
 * schedules its initial AI event via `0x6FCCF920` (`MONSTER_ScheduleInitialAiEvent113c`).
 */
export function ROOM_WakeRoomMonsters113c(
  m: Memory113c,
  pRoom: number,
  pGame: number,
): void {
  let pUnit = m.u32((pRoom + 0x74) >>> 0) >>> 0
  while (pUnit !== 0) {
    const uType = m.u32(pUnit) >>> 0
    if (uType === 1) {
      MONSTER_ScheduleInitialAiEvent113c(m, pGame, pUnit)
    }
    pUnit = m.u32((pUnit + 0xe8) >>> 0) >>> 0
  }
}

/**
 * `@va D2Game:0x6FCBD8E0` (`ROOM_SleepRoomMonsters`, `eax = pRoom`, `ecx = pGame`).
 *
 * Walks `pRoom->pUnitFirst (+0x74)` via `pRoomUnitNext (+0xE8)`; for every monster (`dwUnitType == 1`),
 * removes event types `2` (`MON_EVENT_AI_THINK`) and `3` from `pUnit->pEventFirst (+0xDC)`.
 */
export function ROOM_SleepRoomMonsters113c(
  m: Memory113c,
  pRoom: number,
  pGame: number,
): void {
  let pUnit = m.u32((pRoom + 0x74) >>> 0) >>> 0
  while (pUnit !== 0) {
    const uType = m.u32(pUnit) >>> 0
    if (uType === 1) {
      EVENT_DeleteEventByType113c(m, pGame, pUnit, 2)
      EVENT_DeleteEventByType113c(m, pGame, pUnit, 3)
    }
    pUnit = m.u32((pUnit + 0xe8) >>> 0) >>> 0
  }
}

/**
 * `@va D2Game:0x6FCBDC10` (`ROOM_ActivateRoomForClient`, `ebx = pClient`, `eax = pRoom`, `__stdcall(pPlayer)`).
 *
 * Adds `pClient` to `pRoom` via `D2Common.#10879` (`DUNGEON_AddClientToRoom113c`), and if
 * `pRoom->nNumClients (+0x78) <= 1`, wakes all monsters in `pRoom` via `0x6FCBD950`.
 */
export function ROOM_ActivateRoomForClient113c(
  m: Memory113c,
  pClient: number,
  pRoom: number,
  pPlayer: number,
): void {
  if (pRoom === 0 || pClient === 0) return
  DUNGEON_AddClientToRoom113c(m, pRoom, pClient)
  if ((m.u32((pRoom + 0x78) >>> 0) >>> 0) <= 1) {
    const pGame =
      pPlayer !== 0
        ? ((m.u32((pPlayer + 0x80) >>> 0) || m.u32((pPlayer + 0x84) >>> 0)) >>> 0)
        : 0
    if (pGame !== 0) {
      ROOM_WakeRoomMonsters113c(m, pRoom, pGame)
    }
  }
}

/**
 * `@va D2Game:0x6FCBD980` (`ROOM_DeactivateRoomForClient`, `edi = pRoom`, `__stdcall(pPlayer, pClient)`).
 *
 * Removes `pClient` from `pRoom` via `D2Common.#10144` (`DUNGEON_RemoveClientFromRoom113c`), and if
 * `pRoom->nNumClients (+0x78) == 0`, sleeps all monsters in `pRoom` via `0x6FCBD8E0`.
 */
export function ROOM_DeactivateRoomForClient113c(
  m: Memory113c,
  pRoom: number,
  pPlayer: number,
  pClient: number,
): void {
  if (pRoom === 0 || pClient === 0) return
  DUNGEON_RemoveClientFromRoom113c(m, pRoom, pClient)
  if ((m.u32((pRoom + 0x78) >>> 0) >>> 0) === 0) {
    const pGame =
      pPlayer !== 0
        ? ((m.u32((pPlayer + 0x80) >>> 0) || m.u32((pPlayer + 0x84) >>> 0)) >>> 0)
        : 0
    if (pGame !== 0) {
      ROOM_SleepRoomMonsters113c(m, pRoom, pGame)
    }
  }
}

/**
 * `@va D2Game:0x6FC6B1D0` (`CLIENTS_SetPlayerCurrentRoom`, `esi = pClient`, `__stdcall(pNewRoom)`).
 *
 * 1. If `pClient == 0 || pClient->pPlayer (+0x1A8) == 0` or `pClient->pRoom (+0x1B4) == pNewRoom`, returns.
 * 2. Calls `D2Common.#10622` (`DUNGEON_SyncActiveRoomStatusChange113c(m, pOldRoom, pNewRoom)`) and
 *    `D2Common.#10043` (`DUNGEON_UpdateRoomLevelChange113c(m, pOldRoom, pNewRoom)`).
 * 3. Fetches `ppNewNear[0..nNew)` and `ppOldNear[0..nOld)` via `D2Common.#10688` (`DUNGEON_GetAdjacentRoomsListFromRoom113c`).
 * 4. For each room in `ppNewNear` not in `ppOldNear`, calls `0x6FCBDC10` (`ROOM_ActivateRoomForClient113c`).
 * 5. For each room in `ppOldNear` not in `ppNewNear`, calls `0x6FCBD980` (`ROOM_DeactivateRoomForClient113c`).
 * 6. Sets `pClient->pRoom (+0x1B4) = pNewRoom`.
 */
export function CLIENTS_SetPlayerCurrentRoom113c(
  m: Memory113c,
  pClient: number,
  pNewRoom: number,
): void {
  if (pClient === 0) return
  const pPlayer = (m.u32((pClient + 0x174) >>> 0) || m.u32((pClient + 0x1a8) >>> 0)) >>> 0
  if (pPlayer === 0) return
  const pOldRoom = m.u32((pClient + 0x1b4) >>> 0) >>> 0
  if (pOldRoom === (pNewRoom >>> 0)) return

  DUNGEON_SyncActiveRoomStatusChange113c(m, pOldRoom, pNewRoom)
  DUNGEON_UpdateRoomLevelChange113c(m, pOldRoom, pNewRoom)

  const sp = actRoomsStackPtr
  actRoomsStackPtr = (sp + 0x20) >>> 0
  try {
    let ppNew = 0
    let nNew = 0
    if (pNewRoom !== 0) {
      DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pNewRoom, sp, (sp + 0x04) >>> 0)
      ppNew = m.u32(sp) >>> 0
      nNew = m.u32((sp + 0x04) >>> 0) | 0
    }
    let ppOld = 0
    let nOld = 0
    if (pOldRoom !== 0) {
      DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pOldRoom, (sp + 0x08) >>> 0, (sp + 0x0c) >>> 0)
      ppOld = m.u32((sp + 0x08) >>> 0) >>> 0
      nOld = m.u32((sp + 0x0c) >>> 0) | 0
    }

    for (let i = 0; i < nNew; i++) {
      const rNew = m.u32((ppNew + i * 4) >>> 0) >>> 0
      let inOld = false
      for (let j = 0; j < nOld; j++) {
        if ((m.u32((ppOld + j * 4) >>> 0) >>> 0) === rNew) {
          inOld = true
          break
        }
      }
      if (!inOld) {
        ROOM_ActivateRoomForClient113c(m, pClient, rNew, pPlayer)
      }
    }

    for (let j = 0; j < nOld; j++) {
      const rOld = m.u32((ppOld + j * 4) >>> 0) >>> 0
      let inNew = false
      for (let i = 0; i < nNew; i++) {
        if ((m.u32((ppNew + i * 4) >>> 0) >>> 0) === rOld) {
          inNew = true
          break
        }
      }
      if (!inNew) {
        ROOM_DeactivateRoomForClient113c(m, rOld, pPlayer, pClient)
      }
    }

    m.setU32((pClient + 0x1b4) >>> 0, pNewRoom >>> 0)
  } finally {
    actRoomsStackPtr = sp
  }
}

/**
 * `@va D2Game:0x6FC409B0` / `@va D2Game:0x6FC40760` (`ROOM_DeactivateUnitInRoom`, `esi = pUnit`, `__stdcall(pGame)`).
 *
 * Removes active events on `pUnit` via `EVENT_RemoveUnitEvents113c` (`0x6FCAE880`) and unlinks `pUnit` from
 * the server unit hash table via `SUNIT_RemoveServerUnit113c` (`0x6FD002A0`).
 */
export function ROOM_DeactivateUnitInRoom113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  onUnitRemoved?: (pUnit: number, dwUnitType: number, dwUnitId: number) => void,
): void {
  if (pUnit === 0) return
  const uType = m.u32(pUnit) >>> 0
  const uId = m.u32((pUnit + 0x0c) >>> 0) >>> 0
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  if (uType === 1) {
    // 0x6FC40760: dead monster (dwAnimMode == 12) in non-town room rolls room seed % 3 (`0x6FC407D8..0x6FC4080C`)
    const mode = m.u32((pUnit + 0x10) >>> 0) | 0
    if (mode === 12 && pRoom !== 0) {
      const seedAddr = (pRoom + 0x6c) >>> 0
      const lo = BigInt(m.u32(seedAddr) >>> 0)
      const hi = BigInt(m.u32((seedAddr + 4) >>> 0) >>> 0)
      const next = lo * 0x6ac690c5n + hi
      m.setU32(seedAddr, Number(next & 0xffffffffn) >>> 0)
      m.setU32((seedAddr + 4) >>> 0, Number((next >> 32n) & 0xffffffffn) >>> 0)
    }
    EVENT_RemoveUnitEvents113c(m, pGame, pUnit)
    SUNIT_RemoveServerUnit113c(m, pGame, pUnit)
    onUnitRemoved?.(pUnit, uType, uId)
    return
  }
  if (uType === 2) {
    const classId = m.u32((pUnit + 0x04) >>> 0) | 0
    if (classId === 0x3b || classId === 0x3c) return
    const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, classId)
    void pObjectsTxt
    EVENT_RemoveUnitEvents113c(m, pGame, pUnit)
    SUNIT_RemoveServerUnit113c(m, pGame, pUnit)
    onUnitRemoved?.(pUnit, uType, uId)
    return
  }
  if (uType !== 0 && uType !== 4) {
    EVENT_RemoveUnitEvents113c(m, pGame, pUnit)
    SUNIT_RemoveServerUnit113c(m, pGame, pUnit)
    onUnitRemoved?.(pUnit, uType, uId)
  }
}

/**
 * `@va D2Game:0x6FC4CF30` (`GAME_DeactivateUnusedRoomsTick`, `__stdcall(pGame)`).
 *
 * Called every 12 frames (`dwGameFrame % 12 == 0` at `0x6FC4E106..0x6FC4E119`):
 * Walks `pGame->pAct[0..4]` and each active room `pRoom = DUNGEON_GetRoomExFromRoom113c(m, pAct)`:
 * 1. Calls `D2Common.#10557` (`DUNGEON_UpdateRoomIdleCounter113c(m, pRoom)`).
 * 2. If `idleCounter > 10` and `D2Common.#10163` (`DUNGEON_CanFreeActiveRoom113c(m, pAct, pRoom) != 0`):
 *    - Walks `pUnit = pRoom->pUnitFirst (+0x74)` via `pRoomUnitNext (+0xE8)` and calls `0x6FC409B0`
 *      (`ROOM_DeactivateUnitInRoom113c`).
 *    - Calls `D2Common.#10150` (`DUNGEON_FreeActiveRoom113c(m, pAct, pRoom)`).
 */
export function GAME_DeactivateUnusedRoomsTick113c(
  m: Memory113c,
  pGame: number,
  onRoomDeactivated?: (pRoom: number) => void,
  onUnitRemoved?: (pUnit: number, dwUnitType: number, dwUnitId: number) => void,
): void {
  for (let actIdx = 0; actIdx < 5; actIdx++) {
    const pAct = m.u32((pGame + GAME_OFF_PACT_113C + actIdx * 4) >>> 0) >>> 0
    if (pAct === 0) continue
    let pRoom = DUNGEON_GetRoomExFromRoom113c(m, pAct) >>> 0
    while (pRoom !== 0) {
      const pNext = m.u32((pRoom + ROOM_OFF_NEXT_113C) >>> 0) >>> 0
      const idleCount = DUNGEON_UpdateRoomIdleCounter113c(m, pRoom)
      if (idleCount > 10 && DUNGEON_CanFreeActiveRoom113c(m, pAct, pRoom) !== 0) {
        let pUnit = m.u32((pRoom + 0x74) >>> 0) >>> 0
        while (pUnit !== 0) {
          const pUnitNext = m.u32((pUnit + 0xe8) >>> 0) >>> 0
          ROOM_DeactivateUnitInRoom113c(m, pGame, pUnit, onUnitRemoved)
          pUnit = pUnitNext
        }
        DUNGEON_FreeActiveRoom113c(m, pAct, pRoom)
        onRoomDeactivated?.(pRoom)
      }
      pRoom = pNext
    }
  }
}

export { DUNGEON_IsTownLevelId113c }

