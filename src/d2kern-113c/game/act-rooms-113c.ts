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
import { DRLG_GetActNoFromLevelId113c, DRLG_GetLevelDefField94_113c } from '../common/drlg/drlg.ts'
import { DRLGPRESET_FreeSaveHeaderBlock113c } from '../common/drlg/preset.ts'
import {
  DUNGEON_AddClientToRoom113c,
  DUNGEON_CanFreeActiveRoom113c,
  DUNGEON_CheckRoomFlag2_113c,
  DUNGEON_FreeActiveRoom113c,
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetLevelIdIfNotHidden113c,
  DUNGEON_GetPortalLevelBit113c,
  DUNGEON_GetRoomCoordinates113c,
  DUNGEON_GetRoomExFromRoom113c,
  DUNGEON_IsTownLevelId113c,
  DUNGEON_RemoveClientFromRoom113c,
  DUNGEON_SetRoomFlag2_113c,
  DUNGEON_SyncActiveRoomStatusChange113c,
  DUNGEON_UpdateRoomIdleCounter113c,
  DUNGEON_UpdateRoomLevelChange113c,
} from '../common/dungeon.ts'
import {
  UNITS_GetPlayerActiveWeaponFlags113c,
  UNITS_SetPlayerActiveWeaponFlags113c,
} from '../common/composit.ts'
import {
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
  DATATBLS_GetMonStatsTxtRecordInline113c,
} from '../common/inline-helpers.ts'
import {
  STATES_CheckStateMask33OnUnit113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNIT_GetAlignment113c,
  UNITROOM_ClearUnitRoom113c,
  UNITROOM_RefreshUnit113c,
  UNITS_GetRoom113c,
  UNITS_SetUnitAnimMode113c,
} from '../common/unit.ts'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import { seedRoll } from '../prng.ts'
import { DATATBLS_GetLevelsTxtRecord113c } from '../tables/lvl-tbls-113c.ts'
import { NET_QueuePacketToClient113c } from '../net/packet-sink.ts'
import {
  MONSTER_SaveInactiveMonsterNode113c,
  SUNIT_UnlinkFromRoomUpdateList113c,
  UNIT_SaveInactiveUnitNode113c,
} from './a1c-post150-f150-f276-113c.ts'
import {
  S2C_SendPacket9C_ItemActionWorld113c,
  UNITROOM_IsClientInUnitRoom113c,
  UNITROOM_SendDroppedGroundItemToClient113c,
} from './a1c-post150-f786-f1040-113c.ts'
import {
  MONREG_FindOrAllocActRoomNode113c,
  MONREG_FlushAndFreePendingSpawnNodes113c,
  MONREG_RestoreRoomMonstersFromNode113c,
  MONREG_UnlinkAndFreeActRoomNode113c,
  MONSTER_CalcLifePercentage128_113c,
  UNIT_SendFullUnitSyncToClient113c,
} from './boot-init-gap-a-113c.ts'
import {
  D2GAME_MONSTER_SendMonsterMovementSync113c,
  D2GAME_PACKET_Send0x73MissileSync113c,
  D2GAME_PACKET_SendMonsterAssign113c,
  type BootInitGapBCallees113c,
} from './boot-init-gap-b-113c.ts'
import {
  SUNIT_GetServerUnit113c,
  SUNIT_InsertServerUnit113c,
} from './game-strc.ts'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_ChooseMonsterClass113c,
  MONSTER_ScheduleInitialAiEvent113c,
  MONSTER_SpawnAtCoords113c,
  OBJECTS_InitObjectUnitWithGoldPileFix113c,
  QUEST_Act4DiabloSealCheck113c,
  REGPOP_FindPackSpawnCoords113c,
  REGPOP_PopulateRoomMonsters113c,
  SUNIT_AllocUnitData113c,
  SUNIT_PlaceServerUnitInRoom113c,
  SUNIT_SetMonsterAlignmentState113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c.ts'
import { AIGENERAL_FreeMinionList_6FC40B30_113c } from './k2-laneI-0x6fc3-w1-113c.ts'
import {
  AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c,
  MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c,
} from './k2-w2b1-113c.ts'
import {
  MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c,
  MONUMOD_SpawnSuperUniqueOrBoss_6FC446D0_113c,
} from './k2-w3b2-113c.ts'
import { MONREG_UpdateMonsterRegionTransferCounts_6FCEA410_113c } from './k2-w5b5-113c.ts'
import { SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c } from './k2-w5b9-113c.ts'
import { MONUMOD_SpawnMinionOrUniqueMonster_6FC44950_113c } from './k2-w11b1-113c.ts'
import { MONUMOD_SpawnPresetUniqueOrSuperUnique_6FC44E70_113c } from './k2-w12b1-113c.ts'
import { MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c } from './k2-w4b1-113c.ts'
import { MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c } from './k2-w4b3-113c.ts'
import { OBJECTS_PopulateRoom113c, type ObjectsPopulateCallees113c } from './objects-populate-113c.ts'
import {
  CLIENTS_GetPlayerUnit113c,
  ROOM_DeactivateAnyUnitInRoom113c,
  SUNIT_FreeUnit113c,
} from './replay-final11-113c.ts'
import { ROOM_SpawnPresetUnits113c, type RoomPresetCallees113c } from './room-presets-113c.ts'
import {
  EVENT_DeleteEventByType113c,
  EVENT_SetEventFull113c,
} from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

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
  hitD2GameVa113c(0x6FC67660)
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
  hitD2GameVa113c(0x6FC67820)
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
  hitD2GameVa113c(0x6FC67950)
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
  hitD2GameVa113c(0x6FC4CBE0)
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
        ROOM_SpawnPresetUnits113c(m, pGame, pRoom, {
          ...callees.presets,
          spawnMonsterPreset(mem, pr, nClassId, pg, x, y, nMode) {
            let pTables = 0
            try {
              const pIat = mem.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
              if (pIat !== 0) pTables = mem.u32(pIat) >>> 0
            } catch {
              // standalone fallback
            }
            if (pTables === 0) {
              try {
                pTables = mem.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
              } catch {
                pTables = 0
              }
            }
            if (pTables !== 0 && (nClassId | 0) >= 0) {
              const nMonStats = mem.u32((pTables + 0xa80) >>> 0) | 0
              const nSuperUniques = mem.u32((pTables + 0xa74) >>> 0) | 0
              const specialId = ((nClassId | 0) - nMonStats - nSuperUniques) | 0
              if ((nClassId | 0) >= nMonStats + nSuperUniques && specialId === 2) {
                hitD2GameVa113c(0x6FC67CF0)
                DUNGEON_GetLevelIdFromRoom113c(mem, pr)
                const visLvl = DUNGEON_GetLevelIdIfNotHidden113c(mem, pr) | 0
                const pMonReg =
                  pg !== 0 ? mem.u32((pg + GAME_OFF_PMONREG_113C + visLvl * 4) >>> 0) >>> 0 : 0
                if (pMonReg === 0) return 0
                const sp = actRoomsStackPtr
                actRoomsStackPtr = (sp + 0x10) >>> 0
                try {
                  mem.setU32(sp, 0)
                  const cid = MONSTER_ChooseMonsterClass113c(mem, 1, pr, pMonReg, pg, sp, 0) | 0
                  if (mem.u32(sp) === 0) return 0
                  hitD2GameVa113c(0x6FC44C70)
                  const pMonster = MONUMOD_SpawnMinionOrUniqueMonster_6FC44950_113c(
                    mem as SparseMemory113c,
                    cid,
                    0,
                    1,
                    pg,
                    pr,
                    0,
                    0,
                    -1,
                  )
                  if (pMonster === 0) return 0
                  MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c(
                    mem as SparseMemory113c,
                    pg,
                    pMonster,
                    0,
                  )
                  MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c(
                    mem,
                    1,
                    pr,
                    pg,
                    pMonster,
                    0,
                    3,
                    6,
                  )
                  return 0
                } finally {
                  actRoomsStackPtr = sp
                }
              }
            }
            return callees.presets.spawnMonsterPreset(mem, pr, nClassId, pg, x, y, nMode)
          },
        })
        callees.refreshRoomUnits(m, pGame, pRoom)
        OBJECTS_PopulateRoom113c(m, pGame, pRoom, {
          ...callees.objects,
          spawn: {
            ...callees.objects.spawn,
            initObject: OBJECTS_InitObjectUnitWithGoldPileFix113c,
          },
        })
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
 * `D2Game:0x6FCAA3E0` (`NET_QueuePacketToClient`): appends `pktBytes` to `pClient`'s `0x208`-byte
 * `D2PacketDataStrc` queue (`+0x1B8` head, `+0x1BC` tail, `+0x1C0` free list).
 */
function queueClientBytesActRooms113c(
  m: Memory113c,
  pClient: number,
  pktBytes: Uint8Array,
): void {
  NET_QueuePacketToClient113c(m, pClient >>> 0, pktBytes)
}

/**
 * `@va D2Game:0x6FD00D00` (`SUNIT_RelocateUnitToRoom`, `edx = pUnit`, `ecx = pRoom`, `eax = posY`, stack `(pGame, posX)`).
 */
function relocateSavedUnitToRoom113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pRoom: number,
  posX: number,
  posY: number,
): void {
  void pGame
  if (pUnit === 0 || pRoom === 0) return
  const oldRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  if (oldRoom !== 0 && oldRoom !== (pRoom >>> 0)) {
    let prev = 0
    let cur = m.u32((oldRoom + 0x74) >>> 0) >>> 0
    while (cur !== 0) {
      const next = m.u32((cur + 0xe8) >>> 0) >>> 0
      if (cur === (pUnit >>> 0)) {
        if (prev === 0) {
          m.setU32((oldRoom + 0x74) >>> 0, next)
        } else {
          m.setU32((prev + 0xe8) >>> 0, next)
        }
        break
      }
      prev = cur
      cur = next
    }
  }

  const uType = m.u32(pUnit) >>> 0
  let pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
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

  if (oldRoom !== (pRoom >>> 0)) {
    m.setU32((pUnit + 0xe8) >>> 0, m.u32((pRoom + 0x74) >>> 0) >>> 0)
    m.setU32((pRoom + 0x74) >>> 0, pUnit >>> 0)
  }
  UNITROOM_RefreshUnit113c(m, pUnit)
}

function freeMemNodeAct113c(m: Memory113c, ptr: number): void {
  if (ptr === 0) return
  const candidate = m as unknown as { free?: (p: number) => void }
  if (typeof candidate.free === 'function') {
    candidate.free(ptr)
  }
}

/**
 * `@va D2Game:0x6FD012D0` (`SUNIT_AllocAndPlaceUnit`, `edx = dwUnitType`, `eax = dwClassId`, stack `(pGame, nMode, x, y)`).
 */
function allocAndPlaceSavedUnit113c(
  m: Memory113c,
  unitType: number,
  classId: number,
  animMode: number,
  pGame: number,
  pRoom: number,
  posX: number,
  posY: number,
): number {
  const pUnit = SUNIT_AllocUnitData113c(
    m,
    unitType,
    classId,
    posX,
    posY,
    pGame,
    pRoom,
    1,
    animMode,
    0,
  ) >>> 0
  if (pUnit === 0) return 0
  m.setU32((pUnit + 0x10) >>> 0, animMode >>> 0)
  if (SUNIT_GetServerUnit113c(m, pGame, unitType, m.u32((pUnit + 0x0c) >>> 0) >>> 0) === 0) {
    SUNIT_InsertServerUnit113c(m, pGame, pUnit)
  }
  if (UNITS_GetRoom113c(m, pUnit) === 0) {
    SUNIT_PlaceServerUnitInRoom113c(m, pRoom, posY, pUnit, posX, pGame, 0)
  }
  if (UNITS_GetRoom113c(m, pUnit) === 0) {
    relocateSavedUnitToRoom113c(m, pGame, pUnit, pRoom, posX, posY)
  }
  return pUnit
}

/**
 * `@va D2Game:0x6FC400E0` (`ROOM_RefreshUnitsAndLoadSaved`, `__stdcall(pGame, pRoom)`, `739B`).
 *
 * Exact binary sequence (`0x6FC400E0..0x6FC403C2`):
 * 1. Calls `0x6FC3FB90(pGame, pRoom)` (`MONREG_RestoreRoomMonstersFromNode113c`) to restore saved `0x5C`-byte monster nodes.
 * 2. Calls `0x6FC3EA40(pRoom, pGame, &pSavedUnits, &pSavedItems)` (`MONREG_UnlinkAndFreeActRoomNode113c`) to unlink the
 *    `0x18`-byte inactive room node from `[pGame + 0xD8 + nAct * 4]`.
 * 3. Calls `0x6FC3FB40(pSavedItems, pGame, pRoom)` (`MONREG_FlushAndFreePendingSpawnNodes113c`) to restore non-expired
 *    saved ground item nodes and free every node in `pSavedItems`.
 * 4. Walks `pSavedUnits` (`0x34`-byte nodes chained via `+0x30`) to relocate retained corpses/portals or respawn saved objects.
 */
function restoreRoomMonstersWithBossAndChampion113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
): void {
  const sp = actRoomsStackPtr
  actRoomsStackPtr = (sp + 0x20) >>> 0
  let pRoomNode = 0
  try {
    DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
    const roomX = m.u32(sp) | 0
    const roomY = m.u32((sp + 0x04) >>> 0) | 0
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
    const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
    pRoomNode = MONREG_FindOrAllocActRoomNode113c(m, pGame, nAct, roomX, roomY, 0)
  } finally {
    actRoomsStackPtr = sp
  }
  if (pRoomNode === 0) {
    MONREG_RestoreRoomMonstersFromNode113c(m, pGame, pRoom)
    return
  }

  hitD2GameVa113c(0x6FC3FB90)
  const roomLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  let bChaosSealsCleared = 0
  if (roomLevelId === 0x6c) {
    if (QUEST_Act4DiabloSealCheck113c(m, pGame) !== 0) {
      bChaosSealsCleared = 1
    }
  }
  const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
  const sm = m as SparseMemory113c
  const callTransferCountsIfValid = (
    origLevel2C: number,
    bSkipDec: number,
    nAlignment: number,
    isDead: number,
    pSpawned: number,
  ): void => {
    const ppReg = (pGame + GAME_OFF_PMONREG_113C) >>> 0
    if (
      origLevel2C >= 0 &&
      roomLevelId >= 0 &&
      m.u32((ppReg + ((origLevel2C | 0) << 2)) >>> 0) !== 0 &&
      m.u32((ppReg + ((roomLevelId | 0) << 2)) >>> 0) !== 0
    ) {
      MONREG_UpdateMonsterRegionTransferCounts_6FCEA410_113c(
        sm,
        ppReg,
        origLevel2C,
        bSkipDec,
        roomLevelId,
        nAlignment,
        isDead,
        pSpawned,
      )
    }
  }
  let pMon = m.u32((pRoomNode + 0x0c) >>> 0) >>> 0
  while (pMon !== 0) {
    const pNext = m.u32((pMon + 0x58) >>> 0) >>> 0
    const dwFlags14 = m.u32((pMon + 0x14) >>> 0) >>> 0
    const dwFlags18 = m.u32((pMon + 0x18) >>> 0) >>> 0
    if ((dwFlags14 & 0x0100) !== 0 || (dwFlags18 & 0x21) === 0) {
      const nSavedGuid = m.u32((pMon + 0x0c) >>> 0) >>> 0
      const nSavedClassId = m.u32((pMon + 0x08) >>> 0) | 0
      const nOrigLevel2C = m.u32((pMon + 0x2c) >>> 0) | 0
      const nSavedAnimMode = (dwFlags18 & 0x04) !== 0 ? 0x0c : 1
      const bChaosSkip = nSavedAnimMode !== 0x0c && bChaosSealsCleared !== 0 && nSavedClassId !== 0xf3
      const bSkipBossNormal =
        (dwFlags18 & 0x0400) !== 0 && ((dwFlags18 & 0x0100) !== 0 || (dwFlags18 & 0x80) !== 0)
      let nNormAlignment = 0
      if ((dwFlags18 & 0x0100) !== 0) nNormAlignment = 2
      if ((dwFlags18 & 0x80) !== 0) nNormAlignment = 1
      m.setU32((pRoomNode + 0x0c) >>> 0, pMon)
      m.setU32((pMon + 0x58) >>> 0, 0)
      MONREG_RestoreRoomMonstersFromNode113c(m, pGame, pRoom)
      if ((dwFlags14 & 0x0100) === 0 && !bChaosSkip && !bSkipBossNormal) {
        const pRestored = SUNIT_GetServerUnit113c(m, pGame, 1, nSavedGuid) >>> 0
        callTransferCountsIfValid(
          nOrigLevel2C,
          dwFlags18 & 0x40,
          nNormAlignment,
          nSavedAnimMode === 0x0c ? 1 : 0,
          pRestored,
        )
      }
      pMon = pNext
      continue
    }

    const posX = m.u32(pMon) | 0
    const posY = m.u32((pMon + 0x04) >>> 0) | 0
    const nClassId = m.u32((pMon + 0x08) >>> 0) | 0
    const dwSavedGuid = m.u32((pMon + 0x0c) >>> 0) >>> 0
    const dwFlags10 = m.u32((pMon + 0x10) >>> 0) >>> 0
    const nAnimMode = (dwFlags18 & 0x04) !== 0 ? 0x0c : 1

    if (nAnimMode !== 0x0c && bChaosSealsCleared !== 0 && nClassId !== 0xf3) {
      if (m.u32((pMon + 0x24) >>> 0) !== 0) {
        DRLGPRESET_FreeSaveHeaderBlock113c(m, pMemPool, (pMon + 0x24) >>> 0)
      }
      freeMemNodeAct113c(m, pMon)
      pMon = pNext
      continue
    }

    const skipBoss =
      (dwFlags18 & 0x0400) !== 0 && ((dwFlags18 & 0x0100) !== 0 || (dwFlags18 & 0x80) !== 0)
    if (!skipBoss) {
      let wSpawnFlags = (dwFlags18 & 0x40) !== 0 ? 0x6a : 0x62
      const pMonStatsTxt = DATATBLS_GetMonStatsTxtRecordInline113c(m, nClassId)
      if (pMonStatsTxt !== 0 && (m.u8((pMonStatsTxt + 0x0d) >>> 0) & 0x40) !== 0) {
        wSpawnFlags |= 0x80
      }
      let spawnKind = 0
      if ((dwFlags18 & 0x01) !== 0) spawnKind = 1
      if ((dwFlags18 & 0x20) !== 0) spawnKind = 2

      let pSpawned = 0
      if (spawnKind === 1) {
        pSpawned = MONUMOD_SpawnPresetUniqueOrSuperUnique_6FC44E70_113c(
          sm,
          pGame,
          pRoom,
          nClassId,
          posX,
          posY,
          dwSavedGuid,
          m.u16((pMon + 0x30) >>> 0),
          dwFlags18 & 0x02,
          dwFlags18 & 0x0800,
          m.u16((pMon + 0x3c) >>> 0),
          (pMon + 0x32) >>> 0,
        ) >>> 0
      } else if (spawnKind === 2) {
        pSpawned = MONUMOD_SpawnSuperUniqueOrBoss_6FC446D0_113c(
          sm,
          pGame,
          pRoom,
          0,
          posX,
          posY,
          -1,
          nClassId,
          wSpawnFlags,
          (pMon + 0x32) >>> 0,
          dwSavedGuid,
        ) >>> 0
      }

      let nAlignment = 0
      if ((dwFlags18 & 0x0100) !== 0) nAlignment = 2
      if ((dwFlags18 & 0x80) !== 0) nAlignment = 1
      if (pSpawned !== 0) {
        if (nAnimMode === 0x0c) {
          m.setU32((pSpawned + 0x10) >>> 0, 0x0c)
        }
        AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c(
          m,
          pGame,
          pSpawned,
          m.u32((pMon + 0x1c) >>> 0) >>> 0,
          1,
          dwFlags18 & 0x08,
          dwFlags18 & 0x10,
          m.u32((pMon + 0x20) >>> 0) >>> 0,
        )
        const savedExp = m.u32((pMon + 0x40) >>> 0) | 0
        const savedMaxHp = m.u32((pMon + 0x44) >>> 0) | 0
        const savedCurHp = m.u32((pMon + 0x48) >>> 0) | 0
        const savedFrame = m.u32((pMon + 0x54) >>> 0) >>> 0
        const curGameFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
        STATLIST_SetUnitStat113c(m, pSpawned, 0x0d, savedExp, 0)
        const restoredHp =
          ((curGameFrame - savedFrame) >>> 0) >= 0x1d4c ? savedMaxHp : savedCurHp
        STATLIST_SetUnitStat113c(m, pSpawned, 0x07, savedMaxHp, 0)
        STATLIST_SetUnitStat113c(m, pSpawned, 0x06, restoredHp, 0)
        const pMonData0 =
          m.u32(pSpawned >>> 0) === 1 ? (m.u32((pSpawned + 0x14) >>> 0) >>> 0) : 0
        const pAiGen0 = pMonData0 !== 0 ? (m.u32((pMonData0 + 0x28) >>> 0) >>> 0) : 0
        AI_InitMonsterAiThinkFn113c(
          m,
          pSpawned,
          pGame,
          pAiGen0,
          m.u32((pMon + 0x28) >>> 0) | 0,
        )
        MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c(sm, pSpawned, pGame, pMon)
        if ((dwFlags18 & 0x0400) !== 0) {
          if (nAlignment === 2) {
            SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c(sm, pGame, 8, pSpawned, 0)
          } else if (nAlignment === 1) {
            SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c(sm, pGame, 9, pSpawned, 0)
          }
        }
        if (m.u32(pSpawned >>> 0) === 1) {
          const pMonData = m.u32((pSpawned + 0x14) >>> 0) >>> 0
          if (pMonData !== 0) {
            for (let k = 0; k < 9; k++) {
              const savedMod = m.u8((pMon + 0x32 + k) >>> 0)
              if (m.u8((pMonData + 0x1c + k) >>> 0) !== savedMod) {
                MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(
                  m,
                  pSpawned,
                  savedMod,
                  pGame,
                  0,
                )
              }
            }
          }
        }
        SUNIT_SetMonsterAlignmentState113c(m, pSpawned, nAlignment, 1)
        if ((dwFlags14 & 0x0200) !== 0) {
          m.setU32((pSpawned + 0xc8) >>> 0, (m.u32((pSpawned + 0xc8) >>> 0) | 0x0200) >>> 0)
        }
        const curUnitFlags = m.u32((pSpawned + 0xc4) >>> 0) >>> 0
        m.setU32(
          (pSpawned + 0xc4) >>> 0,
          (curUnitFlags | (dwFlags10 & 0x20000) | 0x03000000) >>> 0,
        )
      } else {
        AIGENERAL_FreeMinionList_6FC40B30_113c(m, pGame, m.u32((pMon + 0x20) >>> 0) >>> 0)
      }
      callTransferCountsIfValid(
        m.u32((pMon + 0x2c) >>> 0) | 0,
        dwFlags18 & 0x40,
        nAlignment,
        nAnimMode === 0x0c ? 1 : 0,
        pSpawned,
      )
    }

    if (m.u32((pMon + 0x24) >>> 0) !== 0) {
      DRLGPRESET_FreeSaveHeaderBlock113c(m, pMemPool, (pMon + 0x24) >>> 0)
    }
    freeMemNodeAct113c(m, pMon)
    pMon = pNext
  }
  m.setU32((pRoomNode + 0x0c) >>> 0, 0)
}

export function ROOM_RefreshUnitsAndLoadSaved113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
): void {
  hitD2GameVa113c(0x6FC400E0)
  if (pGame === 0 || pRoom === 0) return

  // 1. 0x6FC400F2: call 0x6FC3FB90 (restore saved monsters)
  restoreRoomMonstersWithBossAndChampion113c(m, pGame, pRoom)

  // 2. 0x6FC4010F: call 0x6FC3EA40 (unlink inactive room node & extract +0x10 saved units / +0x08 saved items)
  let pSavedUnits = 0
  let pSavedItems = 0
  const sp = actRoomsStackPtr
  actRoomsStackPtr = (sp + 0x10) >>> 0
  try {
    const ppOutUnits = sp
    const ppOutItems = (sp + 4) >>> 0
    MONREG_UnlinkAndFreeActRoomNode113c(m, pRoom, pGame, ppOutUnits, ppOutItems)
    pSavedUnits = m.u32(ppOutUnits) >>> 0
    pSavedItems = m.u32(ppOutItems) >>> 0
  } finally {
    actRoomsStackPtr = sp
  }

  // 3. 0x6FC40119: call 0x6FC3FB40 (restore non-expired saved ground items & free item save nodes)
  MONREG_FlushAndFreePendingSpawnNodes113c(m, pSavedItems, pGame, pRoom)

  // 4. 0x6FC4011E..0x6FC40385: walk 0x34-byte saved unit nodes along +0x30
  let pNode = pSavedUnits
  while (pNode !== 0) {
    const posX = m.u32(pNode) | 0
    const posY = m.u32((pNode + 0x04) >>> 0) | 0
    const unitType = m.u32((pNode + 0x08) >>> 0) >>> 0
    const classId = m.u32((pNode + 0x0c) >>> 0) | 0
    const animMode = m.u32((pNode + 0x10) >>> 0) | 0
    const savedFrame = m.u32((pNode + 0x14) >>> 0) | 0
    const flags1C = m.u32((pNode + 0x1c) >>> 0) >>> 0
    const pNext = m.u32((pNode + 0x30) >>> 0) >>> 0

    if ((flags1C & 0x0100) !== 0) {
      // 0x6FC4014B..0x6FC401B6: existing server unit relocation (player corpse / portal)
      const dwGuid = m.u32((pNode + 0x20) >>> 0) >>> 0
      const pExisting = SUNIT_GetServerUnit113c(m, pGame, unitType, dwGuid)
      if (pExisting !== 0) {
        relocateSavedUnitToRoom113c(m, pGame, pExisting, pRoom, posX, posY)
        m.setU32((pExisting + 0xc4) >>> 0, (m.u32((pExisting + 0xc4) >>> 0) | 0x10) >>> 0)
        if (unitType === 0) {
          if (animMode !== 0x11) {
            throw new Error('ROOM_RefreshUnitsAndLoadSaved113c: player corpse animMode != 0x11 (line 343)')
          }
          UNITS_SetUnitAnimMode113c(m, pExisting, 0x11)
        } else if (unitType === 2) {
          const pObjData = m.u32((pExisting + 0x14) >>> 0) >>> 0
          if (pObjData !== 0) {
            m.setU8((pObjData + 0x04) >>> 0, m.u8((pNode + 0x28) >>> 0))
          }
        }
      }
      freeMemNodeAct113c(m, pNode)
      pNode = pNext
      continue
    }

    // 0x6FC401BB..0x6FC40369: fresh unit allocation & object state restoration
    let pUnit = 0
    if (unitType !== 1) {
      pUnit = allocAndPlaceSavedUnit113c(m, unitType, classId, animMode, pGame, pRoom, posX, posY)
    }
    if (unitType === 2) {
      if (pUnit === 0) {
        throw new Error('ROOM_RefreshUnitsAndLoadSaved113c: failed to spawn saved object (line 369)')
      }
      const hcIdx = m.u32((pUnit + 0x04) >>> 0) | 0
      const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, hcIdx) >>> 0
      const subClass = pObjTxt !== 0 ? m.u8((pObjTxt + 0x167) >>> 0) : 0

      if ((subClass & 0x01) !== 0 && savedFrame !== 0) {
        // 0x6FC40203..0x6FC40252: Shrine recharge timer (`Event 5`) + `bShrineId` (`+0x04`)
        const targetFrame = ((m.u16((pNode + 0x20) >>> 0) << 16) | m.u16((pNode + 0x24) >>> 0)) | 0
        if (targetFrame > 0) {
          const gameFrame = m.u32((pGame + 0xa8) >>> 0) | 0
          const fireFrame = targetFrame > gameFrame ? targetFrame : ((gameFrame + 1) | 0)
          EVENT_SetEventFull113c(m, pGame, pUnit, 5, fireFrame >>> 0, 0, 0, 0)
        }
        const shrineId = m.u8((pNode + 0x28) >>> 0)
        const pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
        if (pObjData !== 0) {
          m.setU8((pObjData + 0x04) >>> 0, shrineId)
        }
      } else if ((subClass & 0x20) !== 0) {
        // 0x6FC40257..0x6FC4034B: Well offline charge regeneration + `Event 2` recharge schedule
        const maxCharges = ((m.u8((pObjTxt + 0x180) >>> 0) << 1) & 0xff) >>> 0
        let charges = m.u8((pNode + 0x28) >>> 0) >>> 0
        if (charges < maxCharges) {
          const regenRate = m.u32((pObjTxt + 0x178) >>> 0) | 0
          if (regenRate === 0) {
            throw new Error('ROOM_RefreshUnitsAndLoadSaved113c: well dwParm[0] == 0 (line 396)')
          }
          const gameFrame = m.u32((pGame + 0xa8) >>> 0) | 0
          let skipSchedule = false
          if (savedFrame < ((gameFrame + regenRate) | 0)) {
            let addTicks = Math.trunc(((gameFrame - savedFrame) | 0) / regenRate)
            if (addTicks >= 1) addTicks = 1
            charges = ((charges + addTicks) & 0xff) >>> 0
            if (charges > maxCharges) charges = maxCharges
            const parm0Dword = m.u32((pObjTxt + 0x180) >>> 0) | 0
            const stage = parm0Dword !== 0 ? Math.trunc(charges / parm0Dword) : 2
            const newMode = (2 - stage) >>> 0
            m.setU32((pUnit + 0x10) >>> 0, newMode)
            if (newMode > 2) {
              m.setU32((pUnit + 0x10) >>> 0, 0)
              const pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
              if (pObjData !== 0) {
                m.setU8((pObjData + 0x04) >>> 0, maxCharges & 0xff)
              }
              skipSchedule = true
            }
          }
          if (!skipSchedule) {
            const pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
            if (pObjData !== 0) {
              m.setU8((pObjData + 0x04) >>> 0, charges & 0xff)
            }
            if (charges < maxCharges) {
              const missing = (maxCharges - charges) | 0
              let stepOffset = regenRate
              for (let i = 0; i < missing; i++) {
                const curFrameNow = m.u32((pGame + 0xa8) >>> 0) | 0
                EVENT_SetEventFull113c(
                  m,
                  pGame,
                  pUnit,
                  2,
                  ((curFrameNow + stepOffset) | 0) >>> 0,
                  0,
                  0,
                  0,
                )
                stepOffset = (stepOffset + regenRate) | 0
              }
            }
          }
        }
      } else {
        // 0x6FC4034D..0x6FC40369: Generic object restore
        const pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
        if (pObjData !== 0) {
          m.setU8((pObjData + 0x04) >>> 0, m.u8((pNode + 0x28) >>> 0))
        }
        m.setU8((pUnit + 0x78) >>> 0, m.u8((pNode + 0x24) >>> 0))
        const interactType = m.u32((pNode + 0x2c) >>> 0) >>> 0
        if (interactType !== 0) {
          m.setU32((pUnit + 0xb8) >>> 0, interactType)
        }
      }
    }

    freeMemNodeAct113c(m, pNode)
    pNode = pNext
  }
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
  hitD2GameVa113c(0x6FCBD950)
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
  hitD2GameVa113c(0x6FCBD8E0)
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
 * 1. Adds `pClient` to `pRoom` via `D2Common.#10879` (`DUNGEON_AddClientToRoom113c`), and if
 *    `pRoom->nNumClients (+0x78) <= 1`, wakes all monsters in `pRoom` via `0x6FCBD950`.
 * 2. When `pClient->dwClientState (+0x04) == 4` (in-game), queues `0x07` (`AddRoom`: `[0x07, u16 tileX, u16 tileY, u8 levelId]`, `6B`)
 *    onto `pClient`'s `0x6FCAA3E0` S2C buffer list.
 */
export function ROOM_ActivateRoomForClient113c(
  m: Memory113c,
  pClient: number,
  pRoom: number,
  pPlayer = 0,
): void {
  hitD2GameVa113c(0x6FCBDC10)
  if (pRoom === 0) {
    throw new D2CommonAssertError('ptRoom', 0xcf)
  }
  if (pClient === 0) return

  const sp = actRoomsStackPtr
  actRoomsStackPtr = (sp + 0x20) >>> 0
  try {
    DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
    const tileX = m.u16((sp + 0x10) >>> 0)
    const tileY = m.u16((sp + 0x14) >>> 0)
    const levelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) & 0xff
    const pkt = new Uint8Array(6)
    pkt[0] = 0x07
    pkt[1] = tileX & 0xff
    pkt[2] = (tileX >>> 8) & 0xff
    pkt[3] = tileY & 0xff
    pkt[4] = (tileY >>> 8) & 0xff
    pkt[5] = levelId
    queueClientBytesActRooms113c(m, pClient, pkt)
  } finally {
    actRoomsStackPtr = sp
  }

  DUNGEON_AddClientToRoom113c(m, pRoom, pClient)

  const clientGame = m.u32((pClient + 0x1a8) >>> 0) >>> 0
  let pGame = clientGame
  if (pPlayer !== 0) {
    if ((pPlayer >>> 0) === clientGame) {
      pGame = pPlayer >>> 0
    } else if (
      m.u32(pPlayer >>> 0) === 0 &&
      m.u32((pPlayer + 0x14) >>> 0) !== 0 &&
      (m.u32((pPlayer + 0x80) >>> 0) !== 0 || m.u32((pPlayer + 0x84) >>> 0) !== 0)
    ) {
      pGame = (m.u32((pPlayer + 0x80) >>> 0) || m.u32((pPlayer + 0x84) >>> 0)) >>> 0
    } else {
      pGame = pPlayer >>> 0
    }
  }

  if ((m.u32((pRoom + 0x78) >>> 0) >>> 0) <= 1 && pGame !== 0) {
    ROOM_WakeRoomMonsters113c(m, pRoom, pGame)
  }

  let pClientPlayer = 0
  if ((m.u8((pClient + 0x3d4) >>> 0) & 1) !== 0) {
    pClientPlayer = m.u32((pClient + 0x174) >>> 0) >>> 0
  } else if (m.u32((pClient + 0x174) >>> 0) !== 0) {
    pClientPlayer =
      SUNIT_GetServerUnit113c(
        m,
        m.u32((pClient + 0x1a8) >>> 0) >>> 0,
        m.u32((pClient + 0x16c) >>> 0) | 0,
        m.u32((pClient + 0x170) >>> 0) >>> 0,
      ) >>> 0
  }

  let pUnit = m.u32((pRoom + 0x74) >>> 0) >>> 0
  while (pUnit !== 0) {
    const pUnitGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
    if (pUnit !== pClientPlayer && pUnitGame !== 0) {
      const monsterSyncCallees: BootInitGapBCallees113c = {
        getSpecialUnit(mem) {
          return pClient !== 0 ? (CLIENTS_GetPlayerUnit113c(mem, pClient, 0) >>> 0) : 0
        },
        getMonsterDirection(mem, u) {
          return MONSTER_CalcLifePercentage128_113c(mem, u)
        },
        checkMonsterTargetValid(mem, pTarget) {
          const inRoom = UNITROOM_IsClientInUnitRoom113c(mem, pTarget, pClient)
          if (inRoom !== 0) return 1
          const pTargetRoom = UNITS_GetRoom113c(mem, pTarget)
          return pTargetRoom !== 0 && (mem.u32((pTargetRoom + 0x78) >>> 0) | 0) === 0 ? 1 : 0
        },
      }
      UNIT_SendFullUnitSyncToClient113c(m, pClient, pUnit, 0, {
        onUnitFullSyncPreSwitch(m2, uType, cl2, u2) {
          if (uType === 1) {
            D2GAME_PACKET_SendMonsterAssign113c(
              m2,
              u2,
              cl2,
              m2.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0,
            )
          } else if (uType === 2) {
            const pStaticPath = m2.u32((u2 + 0x2c) >>> 0) >>> 0
            const objX = pStaticPath !== 0 ? (m2.u32((pStaticPath + 0x0c) >>> 0) & 0xffff) : 0
            const objY = pStaticPath !== 0 ? (m2.u32((pStaticPath + 0x10) >>> 0) & 0xffff) : 0
            const pObjData = m2.u32((u2 + 0x14) >>> 0) >>> 0
            const interactType = pObjData !== 0 ? m2.u8((pObjData + 0x04) >>> 0) : 0
            D2GAME_PACKET_Send0x73MissileSync113c(
              m2,
              cl2,
              2,
              m2.u32((u2 + 0x0c) >>> 0) >>> 0,
              0x51,
              m2.u32((u2 + 0x04) >>> 0) & 0xffff,
              objX,
              objY,
              m2.u32((u2 + 0x10) >>> 0) & 0xff,
              interactType & 0xff,
            )
          } else if (uType === 4) {
            const itemMode = m2.u32((u2 + 0x10) >>> 0) >>> 0
            if (itemMode === 3 || itemMode === 5) {
              S2C_SendPacket9C_ItemActionWorld113c(m2, cl2, u2, 0, 0, 0)
            }
          }
        },
        onUnitFullSyncPostSwitch(m2, uType, cl2, u2) {
          if (uType === 1) {
            D2GAME_MONSTER_SendMonsterMovementSync113c(m2, u2, pUnitGame, cl2, monsterSyncCallees)
          } else if (uType === 4) {
            UNITROOM_SendDroppedGroundItemToClient113c(m2, u2, cl2)
          }
        },
      })
    }
    pUnit = m.u32((pUnit + 0xe8) >>> 0) >>> 0
  }
}

/**
 * `@va D2Game:0x6FCBD980` (`ROOM_DeactivateRoomForClient`, `edi = pRoom`, `__stdcall(pPlayer, pClient)`).
 *
 * 1. When `pClient->dwClientState (+0x04) == 4`, sends `0x0A` (`RemoveUnit`: `[0x0A, u8 unitType, u32 unitId]`, `6B`)
 *    for every non-missile (`dwUnitType != 3`) unit in `pRoom->pUnitFirst (+0x74)`.
 * 2. Removes `pClient` from `pRoom` via `D2Common.#10144` (`DUNGEON_RemoveClientFromRoom113c`), and if
 *    `pRoom->nNumClients (+0x78) == 0`, sleeps all monsters in `pRoom` via `0x6FCBD8E0`.
 * 3. Sends `0x08` (`RemoveRoom`: `[0x08, u16 tileX, u16 tileY, u8 levelId]`, `6B`) via `0x6FCAA3E0`.
 */
export function ROOM_DeactivateRoomForClient113c(
  m: Memory113c,
  pRoom: number,
  pGame: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FCBD980)
  if ((pRoom >>> 0) === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x104)
  }
  if ((pClient >>> 0) !== 0) {
    const pkt0A = new Uint8Array(6)
    pkt0A[0] = 0x0a
    let pUnit = m.u32((pRoom + 0x74) >>> 0) >>> 0
    while (pUnit !== 0) {
      const uType = m.u8(pUnit) & 0xff
      if (uType !== 3) {
        const uId = m.u32((pUnit + 0x0c) >>> 0) >>> 0
        pkt0A[1] = uType
        pkt0A[2] = uId & 0xff
        pkt0A[3] = (uId >>> 8) & 0xff
        pkt0A[4] = (uId >>> 16) & 0xff
        pkt0A[5] = (uId >>> 24) & 0xff
        queueClientBytesActRooms113c(m, pClient, pkt0A)
      }
      pUnit = m.u32((pUnit + 0xe8) >>> 0) >>> 0
    }
  }

  DUNGEON_RemoveClientFromRoom113c(m, pRoom, pClient)
  if ((m.u32((pRoom + 0x78) >>> 0) >>> 0) === 0) {
    ROOM_SleepRoomMonsters113c(m, pRoom, pGame >>> 0)
  }

  if ((pClient >>> 0) !== 0) {
    const sp = actRoomsStackPtr
    actRoomsStackPtr = (sp + 0x20) >>> 0
    try {
      DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
      const tileX = m.u16((sp + 0x10) >>> 0)
      const tileY = m.u16((sp + 0x14) >>> 0)
      const levelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) & 0xff
      const pkt08 = new Uint8Array(6)
      pkt08[0] = 0x08
      pkt08[1] = tileX & 0xff
      pkt08[2] = (tileX >>> 8) & 0xff
      pkt08[3] = tileY & 0xff
      pkt08[4] = (tileY >>> 8) & 0xff
      pkt08[5] = levelId
      queueClientBytesActRooms113c(m, pClient, pkt08)
    } finally {
      actRoomsStackPtr = sp
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
  onOldRoomDeactivated?: (m: Memory113c, pClient: number, rOld: number, pClientGame: number) => void,
): void {
  hitD2GameVa113c(0x6FC6B1D0)
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
        const pClientGame = m.u32((pClient + 0x1a8) >>> 0) >>> 0
        ROOM_DeactivateRoomForClient113c(m, rOld, pClientGame, pClient)
        if (rOld === pOldRoom && onOldRoomDeactivated !== undefined) {
          onOldRoomDeactivated(m, pClient, rOld, pClientGame)
        }
      }
    }

    m.setU32((pClient + 0x1b4) >>> 0, pNewRoom >>> 0)
    const pClientUnit174 = m.u32((pClient + 0x174) >>> 0) >>> 0
    const pPortalPlayer = pClientUnit174 !== 0 ? pClientUnit174 : pPlayer
    if (
      pNewRoom !== 0 &&
      pPortalPlayer !== 0 &&
      m.u32(pPortalPlayer) === 0 &&
      m.u32((pPortalPlayer + 0x14) >>> 0) !== 0
    ) {
      const newLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pNewRoom) | 0
      const curWeaponFlags = UNITS_GetPlayerActiveWeaponFlags113c(m, pPortalPlayer) >>> 0
      const portalBit = DUNGEON_GetPortalLevelBit113c(m, newLevelId) >>> 0
      UNITS_SetPlayerActiveWeaponFlags113c(m, pPortalPlayer, (curWeaponFlags | portalBit) >>> 0)
    }
  } finally {
    actRoomsStackPtr = sp
  }
}

function resolveSgptDataTablesActRooms113c(m: Memory113c): number {
  const iatVal = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  if (iatVal !== 0) {
    const deref = m.u32(iatVal) >>> 0
    if (deref !== 0 && m.u32((deref + 0xa80) >>> 0) !== 0) {
      return deref
    }
    if (m.u32((iatVal + 0xa80) >>> 0) !== 0) {
      return iatVal
    }
  }
  return m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
}

/**
 * Compatibility delegate to canonical `MONSTER_SaveInactiveMonsterNode113c` (`0x6FC3F600`).
 */
export function ROOM_SaveInactiveMonsterNode113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
): void {
  MONSTER_SaveInactiveMonsterNode113c(m, pGame, pMonster)
}

/**
 * Compatibility delegate to canonical `UNIT_SaveInactiveUnitNode113c` (`0x6FC404E0`).
 */
export function ROOM_SaveInactiveUnitToActNode113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): void {
  UNIT_SaveInactiveUnitNode113c(m, pGame, pUnit)
}

/**
 * `@va D2Game:0x6FC40760` (`ROOM_DeactivateMonsterInRoom`, `eax = pMonster`, `__stdcall(pGame)`).
 *
 * Exact 1:1 port of `0x6FC40760..0x6FC409A1` (`580B`):
 * 1. Evaluates corpse 1-in-3 room-seed survival (`pRoom + 0x6C`), alignment (`!= 2`), summon/pet
 *    exclusion (`dwFlags >> 31`), `MonStats2Txt.nRestore (+0x130)`, and quest/preset persistence (`+0xD0 < 8`).
 * 2. When `bSave != 0`, serializes `pMonster` via `0x6FC404E0` (`UNIT_SaveInactiveUnitNode113c`) -> `0x6FC3F600`
 *    (`MONSTER_SaveInactiveMonsterNode113c`).
 * 3. Either retains `pMonster` in server hash with `dwFlagsEx |= 0x100` (`bKeepUnit != 0`, clearing room via `D2Common.#10650`)
 *    or frees it via `0x6FD020A0` (`SUNIT_FreeUnit113c`).
 */
export function ROOM_DeactivateMonsterInRoom113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  onUnitRemoved?: (pUnit: number, dwUnitType: number, dwUnitId: number) => void,
): void {
  hitD2GameVa113c(0x6FC40760)
  if (pUnit === 0) return
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  const uType = m.u32(pUnit) >>> 0
  const uId = m.u32((pUnit + 0x0c) >>> 0) >>> 0
  const animMode = m.u32((pUnit + 0x10) >>> 0) | 0
  const bKeepUnit = m.u8((pUnit + 0xc6) >>> 0) & 0x01

  let isActive = 0
  if (bKeepUnit !== 0) {
    isActive = 1
  } else if (uType === 0) {
    if (animMode === 0 || animMode === 0x11) isActive = 1
  } else if (uType === 1) {
    if (animMode === 0 || animMode === 0x0c) isActive = 1
  } else {
    isActive = 1
  }

  let bSave = 0
  if (pRoom !== 0) {
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
    if (DRLG_GetLevelDefField94_113c(m, nLevelId) !== 0 || !DUNGEON_IsTownLevelId113c(m, nLevelId)) {
      bSave = 1
    }
  }
  const dwFlags = m.u32((pUnit + 0xc4) >>> 0) >>> 0
  if ((dwFlags & 0x02000000) !== 0) {
    bSave = 1
  }

  if (animMode === 0x0c) {
    const seedAddr = pRoom !== 0 ? ((pRoom + 0x6c) >>> 0) : 0
    if (seedAddr !== 0) {
      const lo = BigInt(m.u32(seedAddr) >>> 0)
      const hi = BigInt(m.u32((seedAddr + 4) >>> 0) >>> 0)
      const next = lo * 0x6ac690c5n + hi
      const nextLo = Number(next & 0xffffffffn) >>> 0
      const nextHi = Number((next >> 32n) & 0xffffffffn) >>> 0
      m.setU32(seedAddr, nextLo)
      m.setU32((seedAddr + 4) >>> 0, nextHi)
      if (nextLo % 3 !== 0) {
        bSave = 0
      }
    }
  }

  if (isActive !== 0) {
    const memKnownDeact = (m as unknown as { known?: Map<number, Uint8Array> }).known
    const hasSgptForMask33 = (() => {
      if (memKnownDeact !== undefined) {
        const kp = memKnownDeact.get(0x6fde9e1c >>> 12)
        if (kp === undefined || kp[0x6fde9e1c & 0xfff] === 0) return false
      }
      const sgpt = m.u32(0x6fde9e1c) >>> 0
      if (sgpt === 0) return false
      const maskSlot = (sgpt + 0x150) >>> 0
      if (memKnownDeact !== undefined) {
        const kp2 = memKnownDeact.get(maskSlot >>> 12)
        if (kp2 === undefined || kp2[maskSlot & 0xfff] === 0) return false
      }
      return (m.u32(maskSlot) >>> 0) !== 0
    })()
    if (hasSgptForMask33 && STATES_CheckStateMask33OnUnit113c(m, pUnit) !== 0) {
      bSave = 0
    }
    if (UNIT_GetAlignment113c(m, pUnit) === 2) {
      bSave = 0
    }
  }

  const spawnMode = m.u32((pUnit + 0xd0) >>> 0) | 0
  if (spawnMode < 8) {
    if (isActive === 0) {
      bSave = 1
      SUNIT_SetMonsterAlignmentState113c(m, pUnit, 0, 1)
      SUNIT_UnlinkFromRoomUpdateList113c(m, pGame, pUnit)
    } else {
      bSave = 0
    }
  }
  const classId = m.u32((pUnit + 0x04) >>> 0) | 0
  if (isActive !== 0 && (classId === 0x16b || classId === 0x16c)) {
    bSave = 0
  }
  if (uType === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0 && (m.u8((pMonData + 0x16) >>> 0) & 0x18) !== 0 && isActive !== 0) {
      bSave = 0
    }
  }
  if ((dwFlags >>> 31) !== 0) {
    bSave = 0
  }
  if (((dwFlags >>> 9) & 1) !== 0) {
    bSave = 0
  }

  const pDataTables = resolveSgptDataTablesActRooms113c(m)
  if (classId < 0 || pDataTables === 0) {
    bSave = 0
  } else {
    const nMonStats = m.u32((pDataTables + 0xa80) >>> 0) | 0
    const pMonStats = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
    if (classId >= nMonStats || pMonStats === 0) {
      bSave = 0
    } else {
      const exIdx = (m.u16((pMonStats + Math.imul(classId, 0x1a8) + 0x18) >>> 0) << 16) >> 16
      const nMonStats2 = m.u32((pDataTables + 0xa98) >>> 0) | 0
      const pMonStats2 = m.u32((pDataTables + 0xa90) >>> 0) >>> 0
      if (exIdx < 0 || exIdx >= nMonStats2 || pMonStats2 === 0) {
        bSave = 0
      } else {
        const nRestore = m.u8((pMonStats2 + Math.imul(exIdx, 0x134) + 0x130) >>> 0)
        if (nRestore === 0) {
          bSave = 0
        } else if (nRestore === 2) {
          bSave = 1
        }
      }
    }
  }

  if (bKeepUnit !== 0) {
    m.setU32((pUnit + 0xc8) >>> 0, (m.u32((pUnit + 0xc8) >>> 0) | 0x100) >>> 0)
    if (bSave !== 0 && pGame !== 0) {
      UNIT_SaveInactiveUnitNode113c(m, pGame, pUnit)
    }
    UNITROOM_ClearUnitRoom113c(m, pUnit)
    return
  }

  if (bSave !== 0 && pGame !== 0) {
    UNIT_SaveInactiveUnitNode113c(m, pGame, pUnit)
  }
  SUNIT_FreeUnit113c(m, pGame, pUnit)
  onUnitRemoved?.(pUnit, uType, uId)
}

/**
 * Compatibility delegate to canonical `ROOM_DeactivateAnyUnitInRoom113c` (`0x6FC409B0`).
 */
export function ROOM_DeactivateUnitInRoom113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  onUnitRemoved?: (pUnit: number, dwUnitType: number, dwUnitId: number) => void,
): void {
  if (pUnit === 0) return
  ROOM_DeactivateAnyUnitInRoom113c(m, pUnit, pGame, onUnitRemoved)
}

/**
 * `@va D2Game:0x6FC4CF30` (`GAME_DeactivateUnusedRoomsTick`, `__stdcall(pGame)`).
 *
 * Called every 12 frames (`dwGameFrame % 12 == 0` at `0x6FC4E106..0x6FC4E119`):
 * Walks `pGame->pAct[0..4]` and each active room `pRoom = DUNGEON_GetRoomExFromRoom113c(m, pAct)`:
 * 1. Calls `D2Common.#10557` (`DUNGEON_UpdateRoomIdleCounter113c(m, pRoom)`).
 * 2. If `idleCount > 10` and `D2Common.#10163` (`DUNGEON_CanFreeActiveRoom113c(m, pAct, pRoom) != 0`):
 *    - Walks `pUnit = pRoom->pUnitFirst (+0x74)` via `pRoomUnitNext (+0xE8)` and calls `0x6FC409B0`
 *      (`ROOM_DeactivateAnyUnitInRoom113c`).
 *    - Calls `D2Common.#10150` (`DUNGEON_FreeActiveRoom113c(m, pAct, pRoom)`).
 */
export function GAME_DeactivateUnusedRoomsTick113c(
  m: Memory113c,
  pGame: number,
  onRoomDeactivated?: (pRoom: number) => void,
  onUnitRemoved?: (pUnit: number, dwUnitType: number, dwUnitId: number) => void,
  deactivateUnit?: (
    m: Memory113c,
    pUnit: number,
    pGame: number,
    onUnitRemoved?: (pUnit: number, dwUnitType: number, dwUnitId: number) => void,
  ) => void,
): void {
  hitD2GameVa113c(0x6FC4CF30)
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
          if (deactivateUnit !== undefined) {
            deactivateUnit(m, pUnit, pGame, onUnitRemoved)
          } else {
            ROOM_DeactivateAnyUnitInRoom113c(m, pUnit, pGame, onUnitRemoved)
          }
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

