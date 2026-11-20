/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 1 (`Lane K2-K`) routines across
 * `0x6FC54660..0x6FC62290` (`5,160 B` total: `QUESTS` callbacks/packets/NPC-intro
 * bitfields/preset spawns, `OBJECTS` container operation, `PLAYER` progression/corpse
 * cleanup/death experience penalty/placement events, `MISSILES` hit/step/path/elemental
 * helpers, and `SKILLS` Redemption/state callbacks).
 *
 * Every `@va`-annotated export is a direct instruction-faithful translation of
 * its corresponding `D2Game.dll` v1.13c machine-code routine operating on
 * `Memory113c` (`SparseMemory113c`).
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { PATH_WarpUnitToRoomAndCoord113c } from '../common/drlg/maze.ts'
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_ToggleHasPortalFlag113c,
} from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { imul32, mulDiv113c } from '../common/int-math.ts'
import {
  INVENTORY_GetCorpseUnitId113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstCorpse113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextCorpse113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../common/items.ts'
import { DATATBLS_GetItemsTxtRecordMemPort113c } from '../common/k0-d2common-memports.ts'
import {
  MISSILE_GetElapsedFrames113c,
  MISSILE_GetHitShiftFromId113c,
  MISSILE_GetLevel113c,
  MISSILE_GetSkill113c,
  MISSILE_GetTargetX113c,
  MISSILE_GetTotalFrames113c,
  MISSILE_SetRemainingFrames113c,
  MISSILE_SetTotalFrames113c,
} from '../common/missile.ts'
import {
  PATH_Compute113c,
  PATH_GetFirstPointX113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_SetNewDistance113c,
  PATH_SetType113c,
} from '../common/path.ts'
import {
  QUESTRECORD_CopyRecordToBuffer113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record.ts'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetParam1113c,
  SKILLS_GetSkillPeriodicDelayOrLength113c,
  SKILLS_IsSelectableCorpse10501_113c,
  SKILLS_SetParam1113c,
  SKILLS_SetParam2113c,
} from '../common/skills.ts'
import {
  STATES_CheckState113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import { DATATBLS_GetObjectsTxtRecord113c, UNITS_GetRoom113c } from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { SEED_InitLowSeed113c, seedNext, type D2SeedStrc } from '../prng.ts'
import {
  DATATBLS_AdjustMonsterPresetIndex113c,
  DATATBLS_GetMonLvlTxtRecord113c,
  DATATBLS_GetStartExpForLevel113c,
} from '../tables/datatbls-113c.ts'
import {
  QUESTS_TriggerCallback113c,
  type Post150LaneI1Hooks113c,
} from './a1c-post150-f150-f276-113c.ts'
import { SUNIT_SetUnitEventSound113c } from './ai-fallen-113c.ts'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c.ts'
import { SEED_RollLimitedRandomNumber113c } from './combat-a1c-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import { UNITS_ChangeAnimMode113c } from './monster-events.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_SpawnAtCoords113c,
  MONSTATS2_CheckFlagBit113c,
  ROOM_FindRoomContainingSubtile113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c.ts'
import { SUNIT_FreeUnit113c } from './replay-final11-113c.ts'
import { ROOM_SpawnMonsterPreset113c } from './room-presets-113c.ts'
import { EVENT_SetEventFull113c, type EventWheelHooks113c } from './timer-wheel.ts'
import { PLAYER_SetNeutralOrTownNeutralMode113c } from './town-runtime-gap-113c.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

/**
 * Optional host/callback hooks for `Lane K2-K` (`0x6FC54660..0x6FC62290`).
 */
export interface LaneK0x6fc5Hooks113c extends Post150LaneI1Hooks113c {
  isBadCodePtr?: (va: number) => number
  eventHooks?: EventWheelHooks113c
  regpopHooks?: RegpopSpawnHooks113c
  spawnAtCoords?: (
    m: Memory113c,
    nClassId: number,
    nMode: number,
    pGame: number,
    pRoom: number,
    x: number,
    y: number,
    nMaxRadius: number,
    wFlags: number,
  ) => number
  getMonPresetRecord?: (m: Memory113c, nAct: number, nPlaceId: number, pOutType: number) => number
  spawnSuperUnique?: (
    m: Memory113c,
    pGame: number,
    pRoom: number,
    x: number,
    y: number,
    nSuperUniqueId: number,
  ) => number
}

/**
 * Authoritative 35-entry `(nNpcClassId, nIntroBitIndex)` table from `D2Game.dll`
 * `.data` `0x6FD27E50..0x6FD27F67` (count `35` at `0x6FD27F68`).
 */
const NPC_INTRO_BIT_TABLE_6FD27E50: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [147, 1],
  [148, 2],
  [150, 3],
  [155, 4],
  [154, 5],
  [265, 6],
  [175, 7],
  [176, 8],
  [177, 9],
  [178, 10],
  [202, 11],
  [200, 12],
  [210, 13],
  [201, 14],
  [198, 15],
  [199, 16],
  [244, 17],
  [245, 18],
  [246, 19],
  [251, 20],
  [252, 21],
  [253, 22],
  [254, 23],
  [255, 24],
  [256, 25],
  [257, 26],
  [264, 27],
  [297, 28],
  [511, 29],
  [512, 30],
  [513, 31],
  [514, 32],
  [515, 33],
  [520, 34],
]

const D2GAME_CODE_START_VA_113C = 0x6fc20000
const D2GAME_CODE_END_VA_113C = 0x6fd18000

let k2LaneKStackPtr = 0x7e030000

function allocLaneKStackFrame(m: Memory113c, size: number): number {
  const ptr = k2LaneKStackPtr >>> 0
  k2LaneKStackPtr = (ptr + ((size + 15) & ~15)) >>> 0
  m.fill(ptr, size, 0)
  return ptr
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function lookupNpcIntroBitIndex113c(nNpcClassId: number): number {
  const target = nNpcClassId | 0
  for (let i = 0; i < NPC_INTRO_BIT_TABLE_6FD27E50.length; i++) {
    const row = NPC_INTRO_BIT_TABLE_6FD27E50[i]!
    if (row[0] === target) {
      return row[1]
    }
  }
  return 0
}

function fogTestBit10119_113c(m: Memory113c, pBitBuf: number, nBitIndex: number): number {
  const bit = nBitIndex | 0
  const byteVal = m.u8(((pBitBuf >>> 0) + (bit >> 3)) >>> 0)
  const mask = 1 << (bit & 7)
  return (byteVal & mask) >>> 0
}

function fogSetBit10118_113c(m: Memory113c, pBitBuf: number, nBitIndex: number): void {
  const bit = nBitIndex | 0
  const byteAddr = ((pBitBuf >>> 0) + (bit >> 3)) >>> 0
  const mask = (1 << (bit & 7)) & 0xff
  m.setU8(byteAddr, (m.u8(byteAddr) | mask) & 0xff)
}

function findQuestInChain113c(m: Memory113c, pGame: number, nQuestNo: number): number {
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return 0
  let pQuest = m.u32(pQuestCtrl) >>> 0
  const target = nQuestNo >>> 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) >>> 0) === target) {
      return pQuest
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  return 0
}

function findUnitInGameHashList113c(
  m: Memory113c,
  pGame: number,
  tableOffset: number,
  dwGuid: number,
): number {
  const guid = dwGuid >>> 0
  const bucket = guid & 0x7f
  let pUnit = m.u32((pGame + tableOffset + bucket * 4) >>> 0) >>> 0
  while (pUnit !== 0) {
    if ((m.u32((pUnit + 0x0c) >>> 0) >>> 0) === guid) {
      return pUnit
    }
    pUnit = m.u32((pUnit + 0xe4) >>> 0) >>> 0
  }
  return 0
}

function getMissilesTxtRecordFromMissile113c(m: Memory113c, pMissile: number): number {
  if (pMissile === 0) return 0
  const nClassId = m.u32((pMissile + 0x04) >>> 0) | 0
  if (nClassId < 0) return 0
  const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = m.u32(pSgptPtr) >>> 0
  const nCount = m.u32((pDataTables + 0xb6c) >>> 0) | 0
  if (nClassId >= nCount) return 0
  const pBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  return (pBase + imul32(nClassId, 0x1a4)) >>> 0
}

function getMissileOwnerUnit113c(m: Memory113c, pGame: number, pMissile: number): number {
  if (pMissile === 0) return 0
  const hasOwner = (m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1
  if (hasOwner === 0) return 0
  const dwOwnerId = m.u32((pMissile + 0x98) >>> 0) >>> 0
  const dwOwnerType = m.u32((pMissile + 0x94) >>> 0) >>> 0
  return SUNIT_GetServerUnit113c(m, pGame, dwOwnerType, dwOwnerId) >>> 0
}

function invokeRoomSpawnMonsterPreset113c(
  m: Memory113c,
  pRoom: number,
  nClassId: number,
  pGame: number,
  x: number,
  y: number,
  nMode: number,
  hooks?: LaneK0x6fc5Hooks113c,
): number {
  const spawnAt =
    hooks !== undefined && hooks.spawnAtCoords !== undefined
      ? hooks.spawnAtCoords
      : (
          m2: Memory113c,
          cid: number,
          mode: number,
          pg2: number,
          pr2: number,
          px: number,
          py: number,
          maxR: number,
          wf: number,
        ) =>
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
            hooks !== undefined ? hooks.regpopHooks : undefined,
          )
  return ROOM_SpawnMonsterPreset113c(
    m,
    pRoom,
    nClassId,
    pGame,
    x,
    y,
    nMode,
    spawnAt,
    hooks !== undefined ? hooks.getMonPresetRecord : undefined,
    hooks !== undefined ? hooks.spawnSuperUnique : undefined,
  )
}

/**
 * Builds a `0x1C`-byte `D2QuestArgStrc` (`pGame = pClient->pGame` at `+0x1A8`, `nCallback = 0`,
 * `pTarget = pTarget`, `pPlayer = pUnit`, `dwField14 = dwExtra`) and dispatches
 * `QUESTS_TriggerCallback113c(pArg, 1, 1)` (`eax = pClient`, stack `(pUnit, pTarget, dwExtra)`, `ret 0xC`).
 *
 * @va D2Game:0x6FC54660
 */
export function QUESTS_TriggerCallback00_6FC54660_113c(
  m: Memory113c,
  pClient: number,
  pUnit: number,
  pTarget: number,
  dwExtra: number,
  hooks?: LaneK0x6fc5Hooks113c,
): void {
  hitD2GameVa113c(0x6FC54660)
  const client = pClient >>> 0
  if (client === 0) {
    throw new D2CommonAssertError('QUESTS_TriggerCallback00_6FC54660_113c: pClient == NULL', 0x996)
  }
  const pGame = m.u32((client + 0x1a8) >>> 0) >>> 0
  const savedSp = k2LaneKStackPtr
  const pArg = allocLaneKStackFrame(m, 0x1c)
  try {
    m.setU32(pArg, pGame)
    m.setU32((pArg + 0x04) >>> 0, 0)
    m.setU32((pArg + 0x08) >>> 0, pTarget >>> 0)
    m.setU32((pArg + 0x0c) >>> 0, pUnit >>> 0)
    m.setU32((pArg + 0x14) >>> 0, dwExtra >>> 0)
    QUESTS_TriggerCallback113c(m, pArg, 1, 1, hooks)
  } finally {
    k2LaneKStackPtr = savedSp
  }
}

/**
 * Walks `pUnit->pInventory` (`+0x60`) items (`eax = pUnit`, `[esp+4] = pGame`, `ret 0x4`):
 * for each item whose `ItemsTxt.nQuest` (`+0x12A`) is non-zero, finds quest `nQuest - 1` in
 * `pGame->pQuestControl` (`+0x10F4`), sets `pArg->pTarget = pItemUnit` (`+0x08`), and invokes
 * `pQuest->pfnCallback[9]` (`+0xC4`) when present; then triggers callback `10` (`0x0A`) across
 * all quests via `QUESTS_TriggerCallback113c(pArg, 1, 0)`.
 *
 * @va D2Game:0x6FC54760
 */
export function QUESTS_RefreshInventoryQuestItems_6FC54760_113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  hooks?: LaneK0x6fc5Hooks113c,
): void {
  hitD2GameVa113c(0x6FC54760)
  const unit = pUnit >>> 0
  const game = pGame >>> 0
  const pInventory = m.u32((unit + 0x60) >>> 0) >>> 0
  const savedSp = k2LaneKStackPtr
  const pArg = allocLaneKStackFrame(m, 0x1c)
  try {
    m.setU32(pArg, game)
    m.setU32((pArg + 0x04) >>> 0, 9)
    m.setU32((pArg + 0x0c) >>> 0, unit)

    let pCur = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
    while (pCur !== 0) {
      const pNext = INVENTORY_GetNextItem113c(m, pCur) >>> 0
      const pItem = INVENTORY_UnitIsItem113c(m, pCur) >>> 0
      const nItemId = pItem !== 0 ? m.u32((pItem + 0x04) >>> 0) | 0 : -1
      const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
      if (pItemsTxt !== 0) {
        const nQuestByte = m.u8((pItemsTxt + 0x12a) >>> 0)
        if (nQuestByte !== 0) {
          const nQuestIdx = (nQuestByte - 1) | 0
          if (nQuestIdx < 0) {
            throw new D2CommonAssertError(
              'QUESTS_RefreshInventoryQuestItems_6FC54760_113c: negative quest index',
              0x77,
            )
          }
          const pQuest = findQuestInChain113c(m, game, nQuestIdx)
          m.setU32((pArg + 0x08) >>> 0, pItem)
          if (pQuest !== 0) {
            const pfnCb9 = m.u32((pQuest + 0xc4) >>> 0) >>> 0
            if (pfnCb9 !== 0) {
              const badCode =
                hooks !== undefined && hooks.isBadCodePtr !== undefined
                  ? hooks.isBadCodePtr(pfnCb9)
                  : pfnCb9 < D2GAME_CODE_START_VA_113C || pfnCb9 >= D2GAME_CODE_END_VA_113C
                    ? 1
                    : 0
              if (badCode !== 0) {
                throw new D2CommonAssertError(
                  'QUESTS_RefreshInventoryQuestItems_6FC54760_113c: IsBadCodePtr(pfnCb9)',
                  0x2de,
                )
              }
              if (hooks !== undefined && hooks.onQuestCallback !== undefined) {
                hooks.onQuestCallback(m, pfnCb9, pQuest, pArg)
              }
            }
          }
        }
      }
      pCur = pNext
    }

    m.setU32((pArg + 0x04) >>> 0, 0x0a)
    QUESTS_TriggerCallback113c(m, pArg, 1, 0, hooks)
  } finally {
    k2LaneKStackPtr = savedSp
  }
}

/**
 * Initializes the 24-byte NPC intro `uint16[12]` payload at `pPacket + 2` to `0xFFFF`
 * (`eax = pPacket`, `edi = pNpcIds`, `[esp+4] = pQuestIntro`, `[esp+8] = nCount`, `ret 0x8`),
 * tests each NPC's intro bit in `[[pQuestIntro + 4]]` via `0x6FD27E50` + `Fog.#10119`, packs
 * matching `uint16` NPC class IDs sequentially, and returns `1` if at least one bit matched else `0`.
 *
 * @va D2Game:0x6FC54C70
 */
export function QUESTS_PackNpcIntroFlags_6FC54C70_113c(
  m: Memory113c,
  pPacket: number,
  pNpcIds: number,
  pQuestIntro: number,
  nCount: number,
): number {
  hitD2GameVa113c(0x6FC54C70)
  const pPayload = ((pPacket >>> 0) + 2) >>> 0
  for (let off = 0; off < 0x18; off += 4) {
    m.setU32((pPayload + off) >>> 0, 0xffffffff)
  }

  const count = nCount | 0
  if (count <= 0) return 0

  let outCursor = pPayload
  let anyPacked = 0
  const npcArr = pNpcIds >>> 0
  const intro = pQuestIntro >>> 0

  for (let i = 0; i < count; i++) {
    const npcId = m.u32((npcArr + i * 4) >>> 0) | 0
    const bitIdx = lookupNpcIntroBitIndex113c(npcId)
    const pBitRecord = m.u32((intro + 0x04) >>> 0) >>> 0
    const pBitBuf = m.u32(pBitRecord) >>> 0
    if (fogTestBit10119_113c(m, pBitBuf, bitIdx) !== 0) {
      const wNpc = m.u16((npcArr + i * 4) >>> 0)
      m.setU16(outCursor, wNpc)
      outCursor = (outCursor + 2) >>> 0
      anyPacked = 1
    }
  }
  return anyPacked
}

/**
 * Marks `nCount` NPC intro bits in `pPlayer->pPlayerData->pPlayerIntro[pGame->nDifficulty]`
 * (`+0x60 + nDiff * 4`, bit buffer at `[pIntro + 4] -> +0x00`) using `0x6FD27E50` + `Fog.#10118`
 * (`eax = pPlayerUnit`, `edi = nCount`, `[esp+4] = pGame`, `[esp+8] = pNpcIds`, `ret 0x8`).
 *
 * @va D2Game:0x6FC54D00
 */
export function QUESTS_SetNpcIntroFlags_6FC54D00_113c(
  m: Memory113c,
  pPlayerUnit: number,
  nCount: number,
  pGame: number,
  pNpcIds: number,
): void {
  hitD2GameVa113c(0x6FC54D00)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit >>> 0) >>> 0
  const nDiff = m.u8(((pGame >>> 0) + 0x6d) >>> 0)
  const pIntro = m.u32((pPlayerData + nDiff * 4 + 0x60) >>> 0) >>> 0
  const count = nCount | 0
  if (count <= 0) return

  const npcArr = pNpcIds >>> 0
  for (let i = 0; i < count; i++) {
    const npcId = m.u32((npcArr + i * 4) >>> 0) | 0
    const bitIdx = lookupNpcIntroBitIndex113c(npcId)
    const pBitRecord = m.u32((pIntro + 0x04) >>> 0) >>> 0
    const pBitBuf = m.u32(pBitRecord) >>> 0
    fogSetBit10118_113c(m, pBitBuf, bitIdx)
  }
}

/**
 * `Objects.txt` `nInitFn = 7` (`0x6FD2E06C`) object initializer for Act 1 Quest 4 (`nQuestNo == 4`,
 * Search for Cain / Inifuss): binds object GUID and animation mode from `pQuestDataEx` (`+0x54`,
 * `+0x48 = 1`, `+0x34 = guid/-1`), or falls back to `OBJMODE_OPENED (2)` when quest `4` is absent
 * (`ecx = pObjInit`).
 *
 * @va D2Game:0x6FC54DA0
 */
export function QUESTS_InitAct1Quest4Object_6FC54DA0_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC54DA0)
  const initPtr = pObjInit >>> 0
  const pGame = m.u32(initPtr) >>> 0
  const pQuest = findQuestInChain113c(m, pGame, 4)
  if (pQuest === 0) {
    const pObj = m.u32((initPtr + 0x04) >>> 0) >>> 0
    if (pObj === 0 || m.u32((pObj + 0x10) >>> 0) !== 2) {
      UNITS_ChangeAnimMode113c(m, pObj, 2)
    }
    return
  }

  const pObj0 = m.u32((initPtr + 0x04) >>> 0) >>> 0
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const nMode = m.u32((pQuestDataEx + 0x54) >>> 0) | 0
  UNITS_ChangeAnimMode113c(m, pObj0, nMode)
  m.setU8((pQuestDataEx + 0x48) >>> 0, 1)

  const pObj1 = m.u32((initPtr + 0x04) >>> 0) >>> 0
  const dwGuid = pObj1 !== 0 ? m.u32((pObj1 + 0x0c) >>> 0) : 0xffffffff
  m.setU32((pQuestDataEx + 0x34) >>> 0, dwGuid >>> 0)
}

/**
 * `Objects.txt` `nInitFn = 15` (`0x6FD2E08C`) object initializer for Act 1 Quest 3 (`nQuestNo == 3`,
 * Tools of the Trade / Horadric Malus): records object GUID in `pQuestDataEx + 0x04`, sets
 * `pQuestDataEx + 0x01 = 1`, forces mode `+0x98 = 2` when `pQuest->bNotIntro` (`+0x09`) is `0`,
 * and applies `UNITS_ChangeAnimMode113c` (`ecx = pObjInit`).
 *
 * @va D2Game:0x6FC54E10
 */
export function QUESTS_InitAct1Quest3Object_6FC54E10_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC54E10)
  const initPtr = pObjInit >>> 0
  const pGame = m.u32(initPtr) >>> 0
  const pQuest = findQuestInChain113c(m, pGame, 3)
  if (pQuest === 0) {
    const pObj = m.u32((initPtr + 0x04) >>> 0) >>> 0
    if (pObj === 0 || m.u32((pObj + 0x10) >>> 0) !== 2) {
      UNITS_ChangeAnimMode113c(m, pObj, 2)
    }
    return
  }

  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU8((pQuestDataEx + 0x01) >>> 0, 1)
  const pObj0 = m.u32((initPtr + 0x04) >>> 0) >>> 0
  const dwGuid = pObj0 !== 0 ? m.u32((pObj0 + 0x0c) >>> 0) : 0xffffffff
  m.setU32((pQuestDataEx + 0x04) >>> 0, dwGuid >>> 0)

  if (m.u8((pQuest + 0x09) >>> 0) === 0) {
    m.setU32((pQuestDataEx + 0x98) >>> 0, 2)
  }
  const nMode = m.u32((pQuestDataEx + 0x98) >>> 0) | 0
  const pObj1 = m.u32((initPtr + 0x04) >>> 0) >>> 0
  UNITS_ChangeAnimMode113c(m, pObj1, nMode)
}

/**
 * Serializes `pGame->pQuestControl->pGameQuestBuffer` (`[pQuestCtrl + 0x0C]`, `0x60` bytes) into a
 * 97-byte S2C `0x29` packet and queues it to `pClient` (`eax = pGame`, `[esp+4] = pClient`, `ret 0x4`).
 * Asserts line `0x7DD` if `pQuestControl->bInitialized` (`+0x08`) is `0`.
 *
 * @va D2Game:0x6FC55030
 */
export function QUESTS_SendGameQuestStatePacket29_6FC55030_113c(
  m: Memory113c,
  pGame: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FC55030)
  const pQuestCtrl = m.u32(((pGame >>> 0) + 0x10f4) >>> 0) >>> 0
  if (m.u32((pQuestCtrl + 0x08) >>> 0) === 0) {
    throw new D2CommonAssertError(
      'QUESTS_SendGameQuestStatePacket29_6FC55030_113c: quest control uninitialized',
      0x7dd,
    )
  }

  const savedSp = k2LaneKStackPtr
  const pPkt = allocLaneKStackFrame(m, 0x64)
  try {
    m.setU8(pPkt, 0x29)
    const pQuestRecord = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0
    QUESTRECORD_CopyRecordToBuffer113c(m, pQuestRecord, (pPkt + 1) >>> 0, 0x60, 0)
    NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x61)
  } finally {
    k2LaneKStackPtr = savedSp
  }
}

/**
 * Iterates the `u16` count (`+0x80`) of player GUIDs in `pGuidList` (`+0x00..+0x7C`), resolves each
 * player in `pGame`'s player hash table (`+0x1120`), and when quest `nQuestId` (`ebx`) has neither
 * state `0` nor state `1` set in difficulty quest flags, sets states `0x0D` and `1` and optionally
 * triggers `wSoundId` on the player (`ebx = nQuestId`, stack `(pGame, pGuidList, wSoundId)`, `ret 0xC`).
 *
 * @va D2Game:0x6FC55A20
 */
export function QUESTS_CompleteQuestForPlayerGuidList_6FC55A20_113c(
  m: Memory113c,
  nQuestId: number,
  pGame: number,
  pGuidList: number,
  wSoundId: number,
): void {
  hitD2GameVa113c(0x6FC55A20)
  const list = pGuidList >>> 0
  const game = pGame >>> 0
  const questId = nQuestId | 0
  const soundId = wSoundId >>> 0

  if (m.u16((list + 0x80) >>> 0) === 0) return

  let idx = 0
  while (true) {
    const dwPlayerGuid = m.u32((list + idx * 4) >>> 0) >>> 0
    if (game === 0) {
      throw new D2CommonAssertError(
        'QUESTS_CompleteQuestForPlayerGuidList_6FC55A20_113c: pGame == NULL',
        0x2d3,
      )
    }
    const pPlayer = findUnitInGameHashList113c(m, game, 0x1120, dwPlayerGuid)
    if (pPlayer !== 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
      const nDiff = m.u8((game + 0x6d) >>> 0)
      const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, questId, 0) !== 1 &&
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, questId, 1) !== 1
      ) {
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, questId, 0x0d)
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, questId, 1)
        if (soundId !== 0) {
          SUNIT_SetUnitEventSound113c(m, pPlayer, soundId, pPlayer)
        }
      }
    }
    idx = (idx + 1) | 0
    const curCount = m.u16((list + 0x80) >>> 0)
    if (idx >= curCount) break
  }
}

/**
 * Resolves optional monster unit `dwTargetGuid` (`ecx`, or `-1` for none) in `pGame`'s monster hash
 * table (`+0x1320`), populates a `0x1C`-byte `D2QuestArgStrc` with `nCallback = 0x0B` (`11`),
 * `pTarget = pMonster`, `pPlayer = pPlayerUnit` (`edx`), `dwField14 = pMonster->dwClassId`, and
 * `dwField18 = wMessageId & 0xFFFF` (`[esp+4]`), and invokes `QUESTS_TriggerCallback113c(pArg, 1, 1)`
 * (`eax = pGame`, `ecx = dwTargetGuid`, `edx = pPlayerUnit`, `[esp+4] = wMessageId`, `ret 0x4`).
 *
 * @va D2Game:0x6FC55C90
 */
export function QUESTS_TriggerCallback0B_6FC55C90_113c(
  m: Memory113c,
  pGame: number,
  dwTargetGuid: number,
  pPlayerUnit: number,
  wMessageId: number,
  hooks?: LaneK0x6fc5Hooks113c,
): void {
  hitD2GameVa113c(0x6FC55C90)
  const game = pGame >>> 0
  const targetGuid = dwTargetGuid | 0
  let pMonster = 0
  let nMonsterClassId = 0

  if (targetGuid !== -1) {
    if (game === 0) {
      throw new D2CommonAssertError(
        'QUESTS_TriggerCallback0B_6FC55C90_113c: pGame == NULL',
        0x2d3,
      )
    }
    pMonster = findUnitInGameHashList113c(m, game, 0x1320, targetGuid >>> 0)
    if (pMonster !== 0) {
      nMonsterClassId = m.u32((pMonster + 0x04) >>> 0) | 0
    }
  }

  const savedSp = k2LaneKStackPtr
  const pArg = allocLaneKStackFrame(m, 0x1c)
  try {
    m.setU32(pArg, game)
    m.setU32((pArg + 0x04) >>> 0, 0x0b)
    m.setU32((pArg + 0x08) >>> 0, pMonster)
    m.setU32((pArg + 0x0c) >>> 0, pPlayerUnit >>> 0)
    m.setU32((pArg + 0x10) >>> 0, 0)
    m.setU32((pArg + 0x14) >>> 0, nMonsterClassId >>> 0)
    m.setU32((pArg + 0x18) >>> 0, wMessageId & 0xffff)
    QUESTS_TriggerCallback113c(m, pArg, 1, 1, hooks)
  } finally {
    k2LaneKStackPtr = savedSp
  }
}

/**
 * Adjusts monster preset `(nType, nPlaceId)` via `DATATBLS_AdjustMonsterPresetIndex113c`, locates
 * the room containing `pCoord` (`[x, y]`) starting from `UNITS_GetRoom113c(pUnit)`, and spawns the
 * monster preset in mode `1` (`eax = nPlaceId`, `ecx = nType`, `esi = pCoord`, `[esp+4] = pGame`,
 * `[esp+8] = pUnit`, `ret 0x8`).
 *
 * @va D2Game:0x6FC56820
 */
export function QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c(
  m: Memory113c,
  nPlaceId: number,
  nType: number,
  pCoord: number,
  pGame: number,
  pUnit: number,
  hooks?: LaneK0x6fc5Hooks113c,
): number {
  hitD2GameVa113c(0x6FC56820)
  const nAdjustedId = DATATBLS_AdjustMonsterPresetIndex113c(m, nType | 0, nPlaceId | 0) | 0
  const pStartRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  const coordPtr = pCoord >>> 0
  const y0 = m.u32((coordPtr + 0x04) >>> 0) | 0
  const x0 = m.u32(coordPtr) | 0
  const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pStartRoom, x0, y0) >>> 0
  if (pTargetRoom === 0) {
    return 0
  }
  const y1 = m.u32((coordPtr + 0x04) >>> 0) | 0
  const x1 = m.u32(coordPtr) | 0
  return invokeRoomSpawnMonsterPreset113c(
    m,
    pTargetRoom,
    nAdjustedId,
    pGame >>> 0,
    x1,
    y1,
    1,
    hooks,
  )
}

/**
 * Operates a closed container/chest object (`eax = pOp`, `D2ObjOperateFnStrc*`):
 * - Returns `0` when `pObject != NULL` (`[pOp + 0x04]`) and `pObject->dwAnimMode != 0` (`+0x10`).
 * - Queries target position, looks up `ObjectsTxt[pOp->nObjectId]` (`+0x10`), transitions to mode `1`
 *   with timer event `1` at `dwGameFrame + (dwFrameCnt1 >>> 8)` if `bHasOpAnim` (`+0x140`) is non-zero
 *   (or directly to mode `2` otherwise), clears `UNITFLAG_TARGETABLE` (`~2` at `+0xC4`), and returns `1`.
 *
 * @va D2Game:0x6FC56B90
 */
export function OBJECTS_OperateContainer_6FC56B90_113c(
  m: Memory113c,
  pOp: number,
  hooks?: LaneK0x6fc5Hooks113c,
): number {
  hitD2GameVa113c(0x6FC56B90)
  const op = pOp >>> 0
  const pObj0 = m.u32((op + 0x04) >>> 0) >>> 0
  if (pObj0 !== 0 && m.u32((pObj0 + 0x10) >>> 0) !== 0) {
    return 0
  }

  const savedSp = k2LaneKStackPtr
  const pCoord = allocLaneKStackFrame(m, 0x08)
  try {
    PATH_GetTargetTypeAndPosition113c(m, pObj0, pCoord)
  } finally {
    k2LaneKStackPtr = savedSp
  }

  const nObjectId = m.u32((op + 0x10) >>> 0) | 0
  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjectId) >>> 0
  const bHasOpAnim = m.u8((pObjTxt + 0x140) >>> 0)
  const pObj1 = m.u32((op + 0x04) >>> 0) >>> 0

  if (bHasOpAnim !== 0) {
    UNITS_ChangeAnimMode113c(m, pObj1, 1)
    const pGame = m.u32(op) >>> 0
    const dwFrameCnt1 = m.u32((pObjTxt + 0xdc) >>> 0) >>> 0
    const dwGameFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
    const targetFrame = ((dwFrameCnt1 >>> 8) + dwGameFrame) >>> 0
    const pObj2 = m.u32((op + 0x04) >>> 0) >>> 0
    EVENT_SetEventFull113c(
      m,
      pGame,
      pObj2,
      1,
      targetFrame,
      0,
      0,
      0,
      hooks !== undefined ? hooks.eventHooks : undefined,
    )
  } else {
    UNITS_ChangeAnimMode113c(m, pObj1, 2)
  }

  const pObj3 = m.u32((op + 0x04) >>> 0) >>> 0
  if (pObj3 !== 0) {
    m.setU32((pObj3 + 0xc4) >>> 0, (m.u32((pObj3 + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
  }
  return 1
}

/**
 * Returns `pPlayer->pPlayerData->dwField48` (`+0x48`, portal/trade partner GUID; `eax = pPlayer`),
 * asserting at line `0x24C` if `pPlayer == NULL` or line `0x24F` if `pPlayerData == NULL`.
 *
 * @va D2Game:0x6FC57440
 */
export function PLAYER_GetPlayerDataField48_6FC57440_113c(
  m: Memory113c,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FC57440)
  const player = pPlayer >>> 0
  if (player === 0) {
    throw new D2CommonAssertError('PLAYER_GetPlayerDataField48_6FC57440_113c: pPlayer == NULL', 0x24c)
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(
      'PLAYER_GetPlayerDataField48_6FC57440_113c: pPlayerData == NULL',
      0x24f,
    )
  }
  return m.u32((pPlayerData + 0x48) >>> 0) >>> 0
}

/**
 * Writes `dwValue` (`[esp+4]`) to `pPlayer->pPlayerData->dwField48` (`+0x48`, `eax = pPlayer`,
 * `ret 0x4`), asserting at line `0x23F` if `pPlayer == NULL` or line `0x242` if `pPlayerData == NULL`.
 *
 * @va D2Game:0x6FC57480
 */
export function PLAYER_SetPlayerDataField48_6FC57480_113c(
  m: Memory113c,
  pPlayer: number,
  dwValue: number,
): void {
  hitD2GameVa113c(0x6FC57480)
  const player = pPlayer >>> 0
  if (player === 0) {
    throw new D2CommonAssertError('PLAYER_SetPlayerDataField48_6FC57480_113c: pPlayer == NULL', 0x23f)
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(
      'PLAYER_SetPlayerDataField48_6FC57480_113c: pPlayerData == NULL',
      0x242,
    )
  }
  m.setU32((pPlayerData + 0x48) >>> 0, dwValue >>> 0)
}

/**
 * Walks the singly-linked list at `pPlayerData + 0x98` (next pointer at `+0x10`), reading
 * `pGame->pMemPool` (`+0x1C`) on each node release (`Fog.#10046`), and zeroes `[pPlayerData + 0x98]`
 * (`ebx = pPlayerData`, `edi = pGame`).
 *
 * @va D2Game:0x6FC57500
 */
export function PLAYER_FreePlayerDataList98_6FC57500_113c(
  m: Memory113c,
  pPlayerData: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC57500)
  const pd = pPlayerData >>> 0
  const game = pGame >>> 0
  let pNode = m.u32((pd + 0x98) >>> 0) >>> 0
  while (pNode !== 0) {
    void m.u32((game + 0x1c) >>> 0)
    const pNext = m.u32((pNode + 0x10) >>> 0) >>> 0
    pNode = pNext
  }
  m.setU32((pd + 0x98) >>> 0, 0)
}

/**
 * Applies the PvE death experience penalty on `pPlayer` (`[esp+4]`, `eax = pGame`, `ret 0x4`):
 * - For `STAT_LEVEL (12) > 1`, computes `expSpan = StartExp(lvl) - StartExp(lvl - 1)` and scales by
 *   `DifficultyLevels[nDiff].dwDeathExpPenalty` (`+0x04`) via unsigned `mul 0x51EB851F; shr 5` (`/ 100`).
 * - Clamps `STAT_EXPERIENCE (13)` so it never drops below `StartExp(lvl - 1) + 1`, stores recoverable
 *   lost XP into `pClient + 0x508`, and updates `STAT_EXPERIENCE`.
 *
 * @va D2Game:0x6FC57730
 */
export function PLAYER_ApplyDeathExpPenalty_6FC57730_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FC57730)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pDiffRec = DATATBLS_GetMonLvlTxtRecord113c(m, nDiff) >>> 0
  const nClass = player !== 0 ? m.u32((player + 0x04) >>> 0) | 0 : -1

  const nLevel = STATLIST_GetUnitStat113c(m, player, 0x0c, 0) | 0
  if (nLevel <= 1) return

  const expFloor = DATATBLS_GetStartExpForLevel113c(m, nClass, (nLevel - 1) | 0) >>> 0
  const expNext = DATATBLS_GetStartExpForLevel113c(m, nClass, nLevel) >>> 0
  const expSpan = (expNext - expFloor) | 0
  let newExp = STATLIST_GetUnitStat113c(m, player, 0x0d, 0) >>> 0

  const nPenaltyPct = m.u32((pDiffRec + 0x04) >>> 0) | 0
  const scaled = imul32(nPenaltyPct, expSpan) >>> 0
  let lostExp = Number((BigInt(scaled) * 0x51eb851fn) >> 37n) | 0
  if (lostExp === 0) return

  newExp = (newExp - (lostExp >>> 0)) >>> 0
  if (newExp <= expFloor) {
    const underflow = (newExp - expFloor) | 0
    lostExp = (lostExp + underflow) | 0
    if (lostExp < 0) {
      lostExp = 0
    }
    newExp = (expFloor + 1) >>> 0
  }

  let pClient = 0
  if (player !== 0 && m.u32(player) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }

  if (lostExp < 0) {
    throw new D2CommonAssertError('PLAYER_ApplyDeathExpPenalty_6FC57730_113c: negative lostExp', 0xc4a)
  }

  m.setU32((pClient + 0x508) >>> 0, lostExp >>> 0)
  STATLIST_SetUnitStat113c(m, player, 0x0d, newExp | 0, 0)
}

/**
 * Walks all corpse records in `pPlayer->pInventory` (`+0x60`), resolves each corpse unit in
 * `pGame`'s player hash table (`+0x1120`), records room removal via `DUNGEON_AddRoomPortalNode113c`
 * when in a room, and frees the corpse unit via `SUNIT_FreeUnit113c` (`eax = pPlayer`, `ebx = pGame`).
 *
 * @va D2Game:0x6FC579E0
 */
export function PLAYER_FreePlayerCorpses_6FC579E0_113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC579E0)
  const player = pPlayer >>> 0
  const game = pGame >>> 0
  const pInventory = m.u32((player + 0x60) >>> 0) >>> 0
  let pCorpseRec = INVENTORY_GetFirstCorpse113c(m, pInventory) >>> 0
  while (pCorpseRec !== 0) {
    const dwCorpseGuid = INVENTORY_GetCorpseUnitId113c(m, pCorpseRec) >>> 0
    if (game === 0) {
      throw new D2CommonAssertError('PLAYER_FreePlayerCorpses_6FC579E0_113c: pGame == NULL', 0x2d3)
    }
    const pCorpseUnit = findUnitInGameHashList113c(m, game, 0x1120, dwCorpseGuid)
    if (pCorpseUnit !== 0) {
      const pRoom = UNITS_GetRoom113c(m, pCorpseUnit) >>> 0
      if (pRoom !== 0) {
        const dwGuid = m.u32((pCorpseUnit + 0x0c) >>> 0) >>> 0
        const dwType = m.u32(pCorpseUnit) >>> 0
        DUNGEON_AddRoomPortalNode113c(m, pRoom, dwType, dwGuid)
      }
      SUNIT_FreeUnit113c(m, game, pCorpseUnit)
    }
    pCorpseRec = INVENTORY_GetNextCorpse113c(m, pCorpseRec) >>> 0
  }
}

/**
 * Initializes placed player neutral/town-neutral animation mode (`0x6FC982F0` via `[0x6FD1A400]`)
 * when `pPlayer->pInventory` (`+0x60`) has no cursor item, and schedules timer events `3`
 * (`dwGameFrame + 1`) and `0x0B` (`dwGameFrame + 250`) (`esi = pGame`, `edi = pPlayer`,
 * `[esp+4] = x`, `[esp+8] = y`, `ret 0x8`).
 *
 * @va D2Game:0x6FC57E20
 */
export function PLAYER_InitPlacedModesAndEvents_6FC57E20_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  x: number,
  y: number,
  hooks?: LaneK0x6fc5Hooks113c,
): void {
  hitD2GameVa113c(0x6FC57E20)
  const game = pGame >>> 0
  if (game === 0) {
    throw new D2CommonAssertError(
      'PLAYER_InitPlacedModesAndEvents_6FC57E20_113c: pGame == NULL',
      0x804,
    )
  }
  const player = pPlayer >>> 0
  const pInventory = m.u32((player + 0x60) >>> 0) >>> 0
  let pCursorItem = 0
  if (pInventory !== 0) {
    pCursorItem = INVENTORY_GetCursorItem113c(m, pInventory) >>> 0
  }

  if (pCursorItem === 0) {
    if (hooks !== undefined && hooks.isBadCodePtr !== undefined && hooks.isBadCodePtr(0x6fc982f0) !== 0) {
      throw new D2CommonAssertError(
        'PLAYER_InitPlacedModesAndEvents_6FC57E20_113c: IsBadCodePtr([0x6FD1A400])',
        0x811,
      )
    }
    PLAYER_SetNeutralOrTownNeutralMode113c(m, game, player, 1, x | 0, y | 0)
  }

  const evHooks = hooks !== undefined ? hooks.eventHooks : undefined
  const frame1 = (m.u32((game + 0xa8) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, game, player, 3, frame1, 0, 0, 0, evHooks)

  const frame2 = (m.u32((game + 0xa8) >>> 0) + 0xfa) >>> 0
  EVENT_SetEventFull113c(m, game, player, 0x0b, frame2, 0, 0, 0, evHooks)
}

/**
 * `Missiles.txt` `pSrvHitFunc = 4` (`0x6FD2DB78`): moves `pDamage->dwColdLen` (`+0x30`) into
 * `pDamage->dwFrzLen` (`+0x34`) and zeroes `pDamage->dwColdLen` (`ecx = pGame`, `edx = pMissile`,
 * `[esp+4] = pTarget`, `[esp+8] = pDamage`, `ret 0x8`).
 *
 * @va D2Game:0x6FC58E70
 */
export function MISSILES_SrvHit_MoveColdLenToFrzLen_6FC58E70_113c(
  m: Memory113c,
  _pGame: number,
  _pMissile: number,
  _pTarget: number,
  pDamage: number,
): void {
  hitD2GameVa113c(0x6FC58E70)
  const dmg = pDamage >>> 0
  const coldLen = m.u32((dmg + 0x30) >>> 0) >>> 0
  m.setU32((dmg + 0x34) >>> 0, coldLen)
  m.setU32((dmg + 0x30) >>> 0, 0)
}

/**
 * `Missiles.txt` `pSrvDoFunc = 37` (`0x6FD2DADC`): returns `2` (destroy missile) when
 * `bCollided != 0` (`[esp+4]`), or `0` otherwise (`neg eax; sbb eax, eax; and eax, 2; ret 0x4`).
 *
 * @va D2Game:0x6FC58E90
 */
export function MISSILES_SrvDo_ReturnTwoIfCollided_6FC58E90_113c(
  _m: Memory113c,
  _pGame: number,
  _pMissile: number,
  bCollided: number,
): number {
  hitD2GameVa113c(0x6FC58E90)
  return (bCollided | 0) !== 0 ? 2 : 0
}

/**
 * `Missiles.txt` `pSrvDoFunc = 33` (`0x6FD2DACC`): when `bCollided == 0` (`[esp+4]`) and the
 * missile occupies a room, calls `DUNGEON_ToggleHasPortalFlag113c(pRoom, 1)` and returns `0`.
 *
 * @va D2Game:0x6FC58EA0
 */
export function MISSILES_SrvDo_ClearRoomPortalFlag_6FC58EA0_113c(
  m: Memory113c,
  _pGame: number,
  pMissile: number,
  bCollided: number,
): number {
  hitD2GameVa113c(0x6FC58EA0)
  if ((bCollided | 0) === 0) {
    const pRoom = UNITS_GetRoom113c(m, pMissile >>> 0) >>> 0
    if (pRoom !== 0) {
      DUNGEON_ToggleHasPortalFlag113c(m, pRoom, 1)
    }
  }
  return 0
}

/**
 * `Missiles.txt` `pSrvDoFunc = 27` (`0x6FD2DAB4`): unconditionally returns `1` (`ret 0x4`).
 *
 * @va D2Game:0x6FC58EC0
 */
export function MISSILES_SrvDo_ReturnOne_6FC58EC0_113c(
  _m: Memory113c,
  _pGame: number,
  _pMissile: number,
  _bCollided: number,
): number {
  hitD2GameVa113c(0x6FC58EC0)
  return 1
}

/**
 * Evaluates missile pierce continuation (`esi = pMissile`): checks `MissilesTxt.dwFlags` (`+0x04`)
 * bit `2` (`gdwBitMasks[2]`, `+0x08`) and decrements `STAT_ITEM_PIERCE` (`0x148` = `328`) when
 * non-zero, returning `2` on pierce or `3` when pierce is disabled or exhausted.
 *
 * @va D2Game:0x6FC58F40
 */
export function MISSILES_ConsumePierceStat_6FC58F40_113c(
  m: Memory113c,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC58F40)
  const missile = pMissile >>> 0
  const pMissilesTxt = getMissilesTxtRecordFromMissile113c(m, missile)
  if (pMissilesTxt === 0) {
    return 3
  }
  const flagByte = m.u8((pMissilesTxt + 0x04) >>> 0)
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const maskByte = m.u8((pMasks + 0x08) >>> 0)
  if ((maskByte & flagByte) === 0) {
    return 3
  }

  const curPierce = STATLIST_GetUnitStat113c(m, missile, 0x148, 0) | 0
  if (curPierce === 0) {
    return 3
  }
  STATLIST_SetUnitStat113c(m, missile, 0x148, (curPierce - 1) | 0, 0)
  return 2
}

/**
 * `Missiles.txt` `pSrvHitFunc = 8` (`0x6FD2DB88`): applies `MissilesTxt.wProgOverlay` (`i16` at
 * `+0x36`) onto `pTarget` via `STATES_SetMonsterSkillIconOnUnit113c` (`D2Common.#10689`) when
 * `pTarget != NULL` and `wProgOverlay > 0` (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTarget`,
 * `[esp+8] = pDamage`, `ret 0x8`).
 *
 * @va D2Game:0x6FC58FF0
 */
export function MISSILES_SrvHit_ApplyProgOverlay_6FC58FF0_113c(
  m: Memory113c,
  _pGame: number,
  pMissile: number,
  pTarget: number,
  _pDamage: number,
): void {
  hitD2GameVa113c(0x6FC58FF0)
  const pMissilesTxt = getMissilesTxtRecordFromMissile113c(m, pMissile >>> 0)
  if (pMissilesTxt === 0) return
  const target = pTarget >>> 0
  if (target === 0) return
  const wOverlay = sx16(m.u16((pMissilesTxt + 0x36) >>> 0))
  if (wOverlay > 0) {
    STATES_SetMonsterSkillIconOnUnit113c(m, target, wOverlay, 0)
  }
}

/**
 * `Missiles.txt` `pSrvHitFunc = 10` (`0x6FD2DB90`): when `pMissile` resolves to a valid
 * `MissilesTxt` record, copies `pDamage->dwColdLen` (`+0x30`) into `pDamage->dwFrzLen` (`+0x34`)
 * without clearing `dwColdLen` (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTarget`,
 * `[esp+8] = pDamage`, `ret 0x8`).
 *
 * @va D2Game:0x6FC59040
 */
export function MISSILES_SrvHit_CopyColdLenToFrzLen_6FC59040_113c(
  m: Memory113c,
  _pGame: number,
  pMissile: number,
  _pTarget: number,
  pDamage: number,
): void {
  hitD2GameVa113c(0x6FC59040)
  const pMissilesTxt = getMissilesTxtRecordFromMissile113c(m, pMissile >>> 0)
  if (pMissilesTxt === 0) return
  const dmg = pDamage >>> 0
  m.setU32((dmg + 0x34) >>> 0, m.u32((dmg + 0x30) >>> 0) >>> 0)
}

/**
 * `Missiles.txt` `pSrvDoFunc = 50` (`0x6FD2DB10`): returns `1` if `pMissile` has no valid
 * `MissilesTxt` record, `0` if `bCollided == 0` or `elapsedFrames >= totalFrames - dwParam1`
 * (`+0x4C`), and `2` if `bCollided != 0` while `elapsedFrames < totalFrames - dwParam1` (`ret 0x4`).
 *
 * @va D2Game:0x6FC591A0
 */
export function MISSILES_SrvDo_ExpireBeforeEndWindow_6FC591A0_113c(
  m: Memory113c,
  _pGame: number,
  pMissile: number,
  bCollided: number,
): number {
  hitD2GameVa113c(0x6FC591A0)
  const missile = pMissile >>> 0
  const pMissilesTxt = getMissilesTxtRecordFromMissile113c(m, missile)
  if (pMissilesTxt === 0) {
    return 1
  }
  if ((bCollided | 0) === 0) {
    return 0
  }
  const elapsed = MISSILE_GetElapsedFrames113c(m, missile) | 0
  const total = MISSILE_GetTotalFrames113c(m, missile) | 0
  const threshold = (total - (m.u32((pMissilesTxt + 0x4c) >>> 0) | 0)) | 0
  return elapsed < threshold ? 2 : 0
}

/**
 * Initializes drunken-missile pathing (`PATHTYPE_MISSILE_DRUNKEN = 10`) on `pMissile` (`ecx`),
 * clamping path distance to `min(MISSILE_GetTotalFrames(pMissile), 255)`, seeding `pMissile->tSeed`
 * (`+0x20`) from `PATH_GetFirstPointX`, and computing the path.
 *
 * @va D2Game:0x6FC59210
 */
export function MISSILES_InitDrunkenPath_6FC59210_113c(
  m: Memory113c,
  pMissile: number,
  _nUnusedSeedOffset = 0,
): void {
  hitD2GameVa113c(0x6FC59210)
  const missile = pMissile >>> 0
  if (missile === 0) return

  const totalFrames = MISSILE_GetTotalFrames113c(m, missile) | 0
  const clampedDist = totalFrames > 0xff ? 0xff : totalFrames
  const pPath = m.u32((missile + 0x2c) >>> 0) >>> 0
  const firstX = PATH_GetFirstPointX113c(m, pPath) | 0
  SEED_InitLowSeed113c(m, (missile + 0x20) >>> 0, firstX)
  PATH_SetType113c(m, pPath, 0x0a)
  PATH_SetNewDistance113c(m, pPath, clampedDist)
  PATH_Compute113c(m, pPath, missile, 0)
}

/**
 * Adds (or sets for `eType == 12`) `nAmount` (`edi`) into the `D2DamageStrc` (`esi`) elemental
 * damage slot selected by `MissilesTxt[pMissile->dwClassId].nEType` (`0..12`, jump table at
 * `0x6FC592AC`; `eax = pMissile`, `esi = pDamage`, `edi = nAmount`).
 *
 * @va D2Game:0x6FC59260
 */
export function MISSILES_AddElemDamageByEType_6FC59260_113c(
  m: Memory113c,
  pMissile: number,
  pDamage: number,
  nAmount: number,
): void {
  hitD2GameVa113c(0x6FC59260)
  const missile = pMissile >>> 0
  if (missile === 0) return
  const nMissileId = m.u32((missile + 0x04) >>> 0) | 0
  const eType = MISSILE_GetHitShiftFromId113c(m, nMissileId) & 0xff
  if (eType > 0x0c) return

  const dmg = pDamage >>> 0
  const amt = nAmount | 0
  const addAt = (off: number): void => {
    const addr = (dmg + off) >>> 0
    m.setU32(addr, ((m.u32(addr) | 0) + amt) >>> 0)
  }

  switch (eType) {
    case 0:
      addAt(0x08)
      return
    case 1:
      addAt(0x10)
      return
    case 2:
      addAt(0x1c)
      return
    case 3:
      addAt(0x20)
      return
    case 4:
      addAt(0x24)
      return
    case 5:
      addAt(0x28)
      return
    case 6:
      addAt(0x38)
      return
    case 7:
      addAt(0x3c)
      return
    case 8:
      addAt(0x40)
      return
    case 9:
      addAt(0x44)
      return
    case 10:
      return
    case 11:
      addAt(0x14)
      return
    case 12:
      m.setU32((dmg + 0x24) >>> 0, amt >>> 0)
      return
  }
}

/**
 * Clears damage amounts and mask `~0x700` on `pDamage` (`esi`) and zeroes all elemental duration
 * fields except those matching `MissilesTxt[pMissile->dwClassId].nEType` (jump table `0x6FC59354`:
 * `4/12` keep `+0x30/+0x34`; `5` keeps `+0x2C`; `11` keeps `+0x18`; all others clear all four;
 * `eax = pMissile`, `esi = pDamage`).
 *
 * @va D2Game:0x6FC592E0
 */
export function MISSILES_ResetDamageKeepETypeLen_6FC592E0_113c(
  m: Memory113c,
  pMissile: number,
  pDamage: number,
): void {
  hitD2GameVa113c(0x6FC592E0)
  const missile = pMissile >>> 0
  if (missile === 0) return

  const dmg = pDamage >>> 0
  const maskedFlags = (m.u32(dmg) & 0xfffff8ff) >>> 0
  m.setU32((dmg + 0x08) >>> 0, 0)
  m.setU32((dmg + 0x10) >>> 0, 0)
  m.setU32((dmg + 0x1c) >>> 0, 0)
  m.setU32((dmg + 0x20) >>> 0, 0)
  m.setU32((dmg + 0x24) >>> 0, 0)
  m.setU32((dmg + 0x28) >>> 0, 0)
  m.setU32((dmg + 0x38) >>> 0, 0)
  m.setU32((dmg + 0x3c) >>> 0, 0)
  m.setU32((dmg + 0x40) >>> 0, 0)
  m.setU32((dmg + 0x44) >>> 0, 0)
  m.setU32((dmg + 0x14) >>> 0, 0)
  m.setU32(dmg, maskedFlags)

  const nMissileId = m.u32((missile + 0x04) >>> 0) | 0
  const eType = MISSILE_GetHitShiftFromId113c(m, nMissileId) & 0xff

  if (eType === 4 || eType === 12) {
    m.setU32((dmg + 0x2c) >>> 0, 0)
    m.setU32((dmg + 0x18) >>> 0, 0)
    return
  }
  if (eType === 5) {
    m.setU32((dmg + 0x30) >>> 0, 0)
    m.setU32((dmg + 0x34) >>> 0, 0)
    m.setU32((dmg + 0x18) >>> 0, 0)
    return
  }
  if (eType === 11) {
    m.setU32((dmg + 0x30) >>> 0, 0)
    m.setU32((dmg + 0x2c) >>> 0, 0)
    m.setU32((dmg + 0x34) >>> 0, 0)
    return
  }

  m.setU32((dmg + 0x30) >>> 0, 0)
  m.setU32((dmg + 0x34) >>> 0, 0)
  m.setU32((dmg + 0x2c) >>> 0, 0)
  m.setU32((dmg + 0x18) >>> 0, 0)
}

/**
 * Writes `nLength` (`esi`) into the `D2DamageStrc` (`edi`) duration field corresponding to
 * `MissilesTxt[pMissile->dwClassId].nEType` (jump table `0x6FC594E4`: `4 -> +0x30`, `5 -> +0x2C`,
 * `9 -> +0x44`, `11 -> +0x18`, `12 -> +0x34`; `eax = pMissile`, `edi = pDamage`, `esi = nLength`).
 *
 * @va D2Game:0x6FC594B0
 */
export function MISSILES_SetElemLenByEType_6FC594B0_113c(
  m: Memory113c,
  pMissile: number,
  pDamage: number,
  nLength: number,
): void {
  hitD2GameVa113c(0x6FC594B0)
  const missile = pMissile >>> 0
  if (missile === 0) return
  const nMissileId = m.u32((missile + 0x04) >>> 0) | 0
  const eType = MISSILE_GetHitShiftFromId113c(m, nMissileId) & 0xff
  const idx = (eType - 4) >>> 0
  if (idx > 8) return

  const dmg = pDamage >>> 0
  const len = nLength >>> 0
  switch (eType) {
    case 4:
      m.setU32((dmg + 0x30) >>> 0, len)
      return
    case 5:
      m.setU32((dmg + 0x2c) >>> 0, len)
      return
    case 9:
      m.setU32((dmg + 0x44) >>> 0, len)
      return
    case 11:
      m.setU32((dmg + 0x18) >>> 0, len)
      return
    case 12:
      m.setU32((dmg + 0x34) >>> 0, len)
      return
    default:
      return
  }
}

/**
 * Unit-search filter (`0x6FD2D960`, `ecx = pUnit`): returns `1` iff `pUnit` is a `UNIT_MISSILE (3)`
 * whose `MissilesTxt.dwFlags` (`+0x04`) has bit `4` (`gdwBitMasks[4]`, `+0x10`) set, else `0`.
 *
 * @va D2Game:0x6FC59510
 */
export function MISSILES_FilterFlagBit4Missile_6FC59510_113c(
  m: Memory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FC59510)
  const unit = pUnit >>> 0
  if (unit === 0 || m.u32(unit) !== 3) return 0
  const pMissilesTxt = getMissilesTxtRecordFromMissile113c(m, unit)
  if (pMissilesTxt === 0) return 0
  const flagByte = m.u8((pMissilesTxt + 0x04) >>> 0)
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const maskByte = m.u8((pMasks + 0x10) >>> 0)
  return (maskByte & flagByte) !== 0 ? 1 : 0
}

/**
 * `Missiles.txt` `pSrvHitFunc = 9` (`0x6FD2DB8C`): sets `pDamage->dwStunLen` (`+0x44`) from
 * `MissilesTxt.dwHitPar[0]` (`+0x78`, or `SkillsTxt[missileSkill].dwParam[2]` at `+0x14C` when
 * `dwHitPar[0] <= 0`) and writes `0x60` to `pDamage + 0x60` (`ecx = pGame`, `edx = pMissile`,
 * `[esp+4] = pTarget`, `[esp+8] = pDamage`, `ret 0x8`).
 *
 * @va D2Game:0x6FC59560
 */
export function MISSILES_SrvHit_SetStunLenAndConv60_6FC59560_113c(
  m: Memory113c,
  _pGame: number,
  pMissile: number,
  _pTarget: number,
  pDamage: number,
): void {
  hitD2GameVa113c(0x6FC59560)
  const missile = pMissile >>> 0
  const pMissilesTxt = getMissilesTxtRecordFromMissile113c(m, missile)
  if (pMissilesTxt === 0) return

  const nSkillId = MISSILE_GetSkill113c(m, missile) | 0
  let stunLen = m.u32((pMissilesTxt + 0x78) >>> 0) | 0
  if (stunLen <= 0) {
    stunLen = 0
    if (nSkillId >= 0) {
      const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
      const pDataTables = m.u32(pSgptPtr) >>> 0
      const nSkillsCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
      if (nSkillId < nSkillsCount) {
        const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
        const pSkillsTxt = (pSkillsBase + imul32(nSkillId, 0x23c)) >>> 0
        if (pSkillsTxt !== 0) {
          stunLen = m.u32((pSkillsTxt + 0x14c) >>> 0) | 0
        }
      }
    }
  }

  const dmg = pDamage >>> 0
  m.setU32((dmg + 0x44) >>> 0, stunLen >>> 0)
  m.setU32((dmg + 0x60) >>> 0, 0x60)
}

/**
 * `Missiles.txt` `pSrvHitFunc = 3` (`0x6FD2DB74`): steps `pMissile->tSeed` (`+0x20/+0x24`), tests
 * `(newLo & 0x7F) < MissilesTxt.dwHitPar[0]` (`+0x78`), and sets `0x40` on `pDamage + 0x05`
 * (`wResultFlags |= 0x4000`, knockback) on success (`ecx = pGame`, `edx = pMissile`,
 * `[esp+4] = pTarget`, `[esp+8] = pDamage`, `ret 0x8`).
 *
 * @va D2Game:0x6FC59670
 */
export function MISSILES_SrvHit_RollKnockbackResult_6FC59670_113c(
  m: Memory113c,
  _pGame: number,
  pMissile: number,
  _pTarget: number,
  pDamage: number,
): void {
  hitD2GameVa113c(0x6FC59670)
  const missile = pMissile >>> 0
  const pMissilesTxt = getMissilesTxtRecordFromMissile113c(m, missile)
  if (pMissilesTxt === 0) return

  const seed: D2SeedStrc = {
    lo: m.u32((missile + 0x20) >>> 0),
    hi: m.u32((missile + 0x24) >>> 0),
  }
  const nextLo = seedNext(seed) >>> 0
  m.setU32((missile + 0x20) >>> 0, seed.lo)
  m.setU32((missile + 0x24) >>> 0, seed.hi)

  const threshold = m.u32((pMissilesTxt + 0x78) >>> 0) | 0
  const roll = (nextLo & 0x7f) | 0
  if (roll < threshold) {
    const flagAddr = ((pDamage >>> 0) + 0x05) >>> 0
    m.setU8(flagAddr, (m.u8(flagAddr) | 0x40) & 0xff)
  }
}

/**
 * `Missiles.txt` `pSrvDoFunc = 55` (`0x6FD2DB24`): drains a clamped percentage
 * `clamp(MissilesTxt.dwParam[0], 1, 100)%` of a player target's `STAT_MANA (8)` (minimum `1`,
 * maximum `curMana`):
 * - Returns `2` when `pTarget == NULL` or `pTarget->dwUnitType != UNIT_PLAYER (0)`, or after draining mana.
 * - Returns `1` when `MissilesTxt` is missing, `dwParam[0] <= 0`, or `curMana <= 0`.
 *
 * @va D2Game:0x6FC596E0
 */
export function MISSILES_SrvDo_DrainPlayerManaPct_6FC596E0_113c(
  m: Memory113c,
  _pGame: number,
  pMissile: number,
  pTarget: number,
): number {
  hitD2GameVa113c(0x6FC596E0)
  const target = pTarget >>> 0
  if (target === 0 || m.u32(target) !== 0) {
    return 2
  }
  const pMissilesTxt = getMissilesTxtRecordFromMissile113c(m, pMissile >>> 0)
  if (pMissilesTxt === 0) {
    return 1
  }
  const rawPct0 = m.u32((pMissilesTxt + 0x4c) >>> 0) | 0
  if (rawPct0 <= 0) {
    return 1
  }
  const curMana = STATLIST_GetUnitStat113c(m, target, 8, 0) | 0
  if (curMana <= 0) {
    return 1
  }

  let pct = m.u32((pMissilesTxt + 0x4c) >>> 0) | 0
  if (pct <= 1) {
    pct = 1
  } else if (pct >= 0x64) {
    pct = 0x64
  }

  let drain = mulDiv113c(pct, curMana, 0x64) | 0
  if (drain <= 1) {
    drain = 1
  }
  if (drain >= curMana) {
    drain = curMana
  }

  STATLIST_SetUnitStat113c(m, target, 8, (curMana - drain) | 0, 0)
  return 2
}

/**
 * Paladin Redemption (`skill 0x7C = 124`) corpse-redemption AoE callback (`ecx = pGame`,
 * `edx = pOwner`, `[esp+4] = pCorpse`, `[esp+8] = nLevel`, `[esp+0xC] = _unused`, `ret 0xC`):
 * checks `SKILLS_IsSelectableCorpse10501_113c(pCorpse)`, rolls `pOwner->tSeed` (`0..99`) against
 * `SkillsTxt[124].dwCalc1` (`+0x138`), heals `STAT_HITPOINTS (6)` (`dwCalc2` at `+0x13C`, `<< 8`)
 * and `STAT_MANA (8)` (`dwCalc3` at `+0x140`, `<< 8`) clamped to max life/mana, sets
 * `STATE_REDEEMED (0x63)` on `pCorpse`, and clears bits `0x06` on `pCorpse->dwFlags` (`+0xC4`).
 *
 * @va D2Game:0x6FC59930
 */
export function SKILLS_RedemptionCorpseCallback_6FC59930_113c(
  m: Memory113c,
  _pGame: number,
  pOwner: number,
  pCorpse: number,
  nLevel: number,
  _nUnusedArg3 = 0,
): void {
  hitD2GameVa113c(0x6FC59930)
  const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = m.u32(pSgptPtr) >>> 0
  const nSkillsCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (nSkillsCount <= 0x7c) return

  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + 0x11510) >>> 0
  if (pSkillsTxt === 0) return

  const corpse = pCorpse >>> 0
  if (corpse === 0) return
  if (SKILLS_IsSelectableCorpse10501_113c(m, corpse) === 0) return

  const owner = pOwner >>> 0
  const lvl = nLevel | 0
  const calcChance = m.u32((pSkillsTxt + 0x138) >>> 0) >>> 0
  const chance = SKILLS_EvalCalcByOffset113c(m, owner, calcChance, 0x7c, lvl) | 0
  const roll = SEED_RollLimitedRandomNumber113c(m, (owner + 0x20) >>> 0, 0x64) | 0
  if (roll >= chance) return

  const calcLife = m.u32((pSkillsTxt + 0x13c) >>> 0) >>> 0
  const lifeAdd = (SKILLS_EvalCalcByOffset113c(m, owner, calcLife, 0x7c, lvl) << 8) | 0
  const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, owner) | 0
  const curLife = STATLIST_GetUnitStat113c(m, owner, 6, 0) | 0
  let nextLife = (curLife + lifeAdd) | 0
  if (maxLife < nextLife) {
    nextLife = maxLife
  }
  STATLIST_SetUnitStat113c(m, owner, 6, nextLife, 0)

  const calcMana = m.u32((pSkillsTxt + 0x140) >>> 0) >>> 0
  const manaAdd = (SKILLS_EvalCalcByOffset113c(m, owner, calcMana, 0x7c, lvl) << 8) | 0
  const maxMana = STATLIST_GetMaxManaFromUnit113c(m, owner) | 0
  const curMana = STATLIST_GetUnitStat113c(m, owner, 8, 0) | 0
  let nextMana = (curMana + manaAdd) | 0
  if (maxMana < nextMana) {
    nextMana = maxMana
  }
  STATLIST_SetUnitStat113c(m, owner, 8, nextMana, 0)

  STATES_ToggleGfxStateFlag113c(m, corpse, 0x63, 1)
  m.setU32((corpse + 0xc4) >>> 0, (m.u32((corpse + 0xc4) >>> 0) & 0xfffffff9) >>> 0)
}

/**
 * `Missiles.txt` `pSrvHitFunc = 14` (`0x6FD2DBA0`): rolls size-scaled hit flag `0x08` on
 * `pDamage + 0x04` using `MissilesTxt.dwHitPar[0]` (`+0x78` size tier `<1`, `1`, `>1`) and
 * `dwHitPar[1]` (`+0x7C` base chance) against `MonStats2Txt` `bSmall` (bit `0x0A`) and `bLarge`
 * (bit `0x0B`) (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTarget`, `[esp+8] = pDamage`, `ret 0x8`).
 *
 * @va D2Game:0x6FC59A40
 */
export function MISSILES_SrvHit_RollSizeScaledHitFlag_6FC59A40_113c(
  m: Memory113c,
  _pGame: number,
  pMissile: number,
  pTarget: number,
  pDamage: number,
): void {
  hitD2GameVa113c(0x6FC59A40)
  const missile = pMissile >>> 0
  if (missile === 0 || m.u32(missile) !== 3) return
  const pMissilesTxt = getMissilesTxtRecordFromMissile113c(m, missile)
  if (pMissilesTxt === 0) return

  const target = pTarget >>> 0
  if (target === 0) return
  const targetType = m.u32(target) | 0
  const tier = m.u32((pMissilesTxt + 0x78) >>> 0) | 0
  const baseChance = m.u32((pMissilesTxt + 0x7c) >>> 0) | 0
  let chance = 0

  if (targetType === 0) {
    if (tier < 1) return
    chance = baseChance
  } else if (targetType === 1) {
    const nTargetClassId = m.u32((target + 0x04) >>> 0) | 0
    if (tier < 1) {
      if (MONSTATS2_CheckFlagBit113c(m, nTargetClassId, 0x0a) === 0) return
      chance = baseChance
    } else if (tier === 1) {
      if (MONSTATS2_CheckFlagBit113c(m, nTargetClassId, 0x0a) !== 0) {
        chance = (baseChance << 1) | 0
      } else {
        if (MONSTATS2_CheckFlagBit113c(m, nTargetClassId, 0x0b) !== 0) return
        chance = baseChance
      }
    } else {
      if (MONSTATS2_CheckFlagBit113c(m, nTargetClassId, 0x0a) !== 0) {
        chance = imul32(baseChance, 3)
      } else if (MONSTATS2_CheckFlagBit113c(m, nTargetClassId, 0x0b) !== 0) {
        chance = baseChance
      } else {
        chance = (baseChance << 1) | 0
      }
    }
  } else {
    return
  }

  if (chance <= 0) return
  const roll = SEED_RollLimitedRandomNumber113c(m, (missile + 0x20) >>> 0, 0x64) | 0
  if (roll < chance) {
    const flagAddr = ((pDamage >>> 0) + 0x04) >>> 0
    m.setU8(flagAddr, (m.u8(flagAddr) | 0x08) & 0xff)
  }
}

/**
 * `Missiles.txt` `pSrvHitFunc = 11` (`0x6FD2DB94`): sets `pDamage->dwPoisLen` (`+0x2C`) to
 * `MISSILE_GetTargetX(pMissile) - pGame->dwGameFrame` (`+0xA8`) when the missile has a valid owner,
 * `pTarget != NULL`, and `10 <= remFrames <= SKILLS_GetSkillPeriodicDelayOrLength(owner, skill, lvl, 1)`;
 * otherwise zeroes both `pDamage->dwPoisDamage` (`+0x28`) and `pDamage->dwPoisLen` (`+0x2C`).
 *
 * @va D2Game:0x6FC59BD0
 */
export function MISSILES_SrvHit_ClampRemainingPoisonLen_6FC59BD0_113c(
  m: Memory113c,
  pGame: number,
  pMissile: number,
  pTarget: number,
  pDamage: number,
): void {
  hitD2GameVa113c(0x6FC59BD0)
  const game = pGame >>> 0
  const missile = pMissile >>> 0
  const dmg = pDamage >>> 0
  const pOwner = getMissileOwnerUnit113c(m, game, missile)
  if (pOwner === 0 || (pTarget >>> 0) === 0) {
    m.setU32((dmg + 0x28) >>> 0, 0)
    m.setU32((dmg + 0x2c) >>> 0, 0)
    return
  }

  const nSkillId = MISSILE_GetSkill113c(m, missile) | 0
  const nLevel = MISSILE_GetLevel113c(m, missile) | 0
  const expireFrame = MISSILE_GetTargetX113c(m, missile) | 0
  const curFrame = m.u32((game + 0xa8) >>> 0) | 0
  const remFrames = (expireFrame - curFrame) | 0

  if (remFrames >= 0x0a) {
    const maxLen = SKILLS_GetSkillPeriodicDelayOrLength113c(m, pOwner, nSkillId, nLevel, 1) | 0
    if (remFrames <= maxLen) {
      m.setU32((dmg + 0x2c) >>> 0, remFrames >>> 0)
      return
    }
  }

  m.setU32((dmg + 0x28) >>> 0, 0)
  m.setU32((dmg + 0x2c) >>> 0, 0)
}

/**
 * `Missiles.txt` `pSrvHitFunc = 6` (`0x6FD2DB80`): when `pMissile` resolves to a live owner whose
 * `dwFlags` (`+0xC4`) bit `9` (`0x200`) is `0`, sets bit `0x20000` on `pTarget->dwFlags` (`+0xC4`)
 * (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pTarget`, `[esp+8] = pDamage`, `ret 0x8`).
 *
 * @va D2Game:0x6FC59C80
 */
export function MISSILES_SrvHit_SetTargetFlag20000_6FC59C80_113c(
  m: Memory113c,
  pGame: number,
  pMissile: number,
  pTarget: number,
  _pDamage: number,
): void {
  hitD2GameVa113c(0x6FC59C80)
  const pOwner = getMissileOwnerUnit113c(m, pGame >>> 0, pMissile >>> 0)
  if (pOwner === 0) return
  if (((m.u32((pOwner + 0xc4) >>> 0) >>> 9) & 1) !== 0) return
  const target = pTarget >>> 0
  if (target === 0) return
  m.setU32((target + 0xc4) >>> 0, (m.u32((target + 0xc4) >>> 0) | 0x20000) >>> 0)
}

/**
 * `Missiles.txt` `pSrvDoFunc = 8` (`0x6FD2DA68`): returns `0` when `pCollidedUnit` (`[esp+4]`) is
 * non-NULL, equals `pMissile`'s owner, and that owner still has `STATE_BLAZE (0x0D)` active;
 * otherwise returns `2` (`ecx = pGame`, `edx = pMissile`, `[esp+4] = pCollidedUnit`, `ret 0x4`).
 *
 * @va D2Game:0x6FC59F70
 */
export function MISSILES_SrvDo_KeepAliveOnBlazeOwner_6FC59F70_113c(
  m: Memory113c,
  pGame: number,
  pMissile: number,
  pCollidedUnit: number,
): number {
  hitD2GameVa113c(0x6FC59F70)
  const collided = pCollidedUnit >>> 0
  if (collided === 0) return 2
  const pOwner = getMissileOwnerUnit113c(m, pGame >>> 0, pMissile >>> 0)
  if (pOwner === 0) return 2
  if (collided === pOwner && STATES_CheckState113c(m, pOwner, 0x0d) !== 0) {
    return 0
  }
  return 2
}

/**
 * Warps `pMissile->pDynamicPath` (`+0x2C`) to its owner unit's current room and `(x, y)` coordinates
 * via `PATH_WarpUnitToRoomAndCoord113c`, reading static path coordinates (`+0x0C/+0x10`) for unit
 * types `2, 4, 5` or `PATH_GetPosX/Y` for dynamic path unit types (`ecx = pGame`, `ebx = pMissile`).
 *
 * @va D2Game:0x6FC5A1D0
 */
export function MISSILES_WarpPathToOwnerPos_6FC5A1D0_113c(
  m: Memory113c,
  pGame: number,
  pMissile: number,
): void {
  hitD2GameVa113c(0x6FC5A1D0)
  const missile = pMissile >>> 0
  if (missile === 0) return
  const pOwner = getMissileOwnerUnit113c(m, pGame >>> 0, missile)
  const pMissilePath = m.u32((missile + 0x2c) >>> 0) >>> 0
  if (pOwner === 0 || pMissilePath === 0) return

  const ownerTypeY = m.u32(pOwner) | 0
  let ownerY = 0
  if (ownerTypeY === 2 || (ownerTypeY > 3 && ownerTypeY <= 5)) {
    const pStaticPath = m.u32((pOwner + 0x2c) >>> 0) >>> 0
    ownerY = m.u32((pStaticPath + 0x10) >>> 0) | 0
  } else {
    const pDynPath = m.u32((pOwner + 0x2c) >>> 0) >>> 0
    ownerY = pDynPath !== 0 ? PATH_GetPosY113c(m, pDynPath) | 0 : 0
  }

  const ownerTypeX = m.u32(pOwner) | 0
  let ownerX = 0
  if (ownerTypeX === 2 || (ownerTypeX > 3 && ownerTypeX <= 5)) {
    const pStaticPath = m.u32((pOwner + 0x2c) >>> 0) >>> 0
    ownerX = m.u32((pStaticPath + 0x0c) >>> 0) | 0
  } else {
    const pDynPath = m.u32((pOwner + 0x2c) >>> 0) >>> 0
    ownerX = pDynPath !== 0 ? PATH_GetPosX113c(m, pDynPath) | 0 : 0
  }

  const pOwnerRoom = UNITS_GetRoom113c(m, pOwner) >>> 0
  PATH_WarpUnitToRoomAndCoord113c(m, pMissilePath, missile, pOwnerRoom, ownerX, ownerY)
}

/**
 * `Missiles.txt` `pSrvDoFunc = 54` (`0x6FD2DB20`): when `bCollided == 0` (`[esp+4]`) and `pMissile`
 * has an owner possessing `MISSILE_GetSkill(pMissile)`, spawns monster class `SKILLS_GetParam1(pSkill)`
 * in mode `1` at `pMissile`'s room and `(x, y)` via `ROOM_SpawnMonsterPreset113c`, and returns `1`.
 *
 * @va D2Game:0x6FC5BC80
 */
export function MISSILES_SrvDo_SpawnSkillParam1Monster_6FC5BC80_113c(
  m: Memory113c,
  pGame: number,
  pMissile: number,
  bCollided: number,
  hooks?: LaneK0x6fc5Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5BC80)
  if ((bCollided | 0) !== 0) return 1
  const game = pGame >>> 0
  const missile = pMissile >>> 0
  const pOwner = getMissileOwnerUnit113c(m, game, missile)
  if (pOwner === 0) return 1

  const nSkillId = MISSILE_GetSkill113c(m, missile) | 0
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pOwner, nSkillId) >>> 0
  if (pSkill === 0) return 1

  const nClassId = SKILLS_GetParam1113c(m, pSkill) | 0
  const y = UNIT_GetPosY113c(m, missile) | 0
  const x = UNIT_GetPosX113c(m, missile) | 0
  const pRoom = UNITS_GetRoom113c(m, missile) >>> 0
  invokeRoomSpawnMonsterPreset113c(m, pRoom, nClassId, game, x, y, 1, hooks)
  return 1
}

/**
 * `Missiles.txt` `pSrvDoFunc = 6` (`0x6FD2DA60`): spawns monster class `MissilesTxt.dwParam[0]`
 * (`+0x4C`, validated in `0 <= id < nMonStatsTxtRecordCount`) in mode `dwParam[1]` (`+0x50` if in
 * `0..15`, else `1`) at `pMissile`'s room and `(x, y)`, and returns `1`.
 *
 * @va D2Game:0x6FC5BD10
 */
export function MISSILES_SrvDo_SpawnMissileParam0Monster_6FC5BD10_113c(
  m: Memory113c,
  pGame: number,
  pMissile: number,
  _bCollided = 0,
  hooks?: LaneK0x6fc5Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5BD10)
  const missile = pMissile >>> 0
  if (missile === 0) return 1
  const nMissileId = m.u32((missile + 0x04) >>> 0) | 0
  if (nMissileId < 0) return 1

  const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = m.u32(pSgptPtr) >>> 0
  const nMissilesCount = m.u32((pDataTables + 0xb6c) >>> 0) | 0
  if (nMissileId >= nMissilesCount) return 1
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  const pMissilesTxt = (pMissilesBase + imul32(nMissileId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1

  const nMonsterClassId = m.u32((pMissilesTxt + 0x4c) >>> 0) | 0
  const nMonStatsCount = m.u32((pDataTables + 0xa80) >>> 0) | 0
  if (nMonsterClassId < 0 || nMonsterClassId >= nMonStatsCount) return 1

  const rawMode = m.u32((pMissilesTxt + 0x50) >>> 0) | 0
  const nMode = rawMode >= 0 && rawMode < 0x10 ? rawMode : 1

  const y = UNIT_GetPosY113c(m, missile) | 0
  const x = UNIT_GetPosX113c(m, missile) | 0
  const pRoom = UNITS_GetRoom113c(m, missile) >>> 0
  invokeRoomSpawnMonsterPreset113c(m, pRoom, nMonsterClassId, pGame >>> 0, x, y, nMode, hooks)
  return 1
}

/**
 * `Missiles.txt` `pSrvDoFunc = 35` (`0x6FD2DAD4`, Town Portal creator missile): when `bCollided == 0`
 * (`[esp+4]`), looks up object GUID `MISSILE_GetTargetX(pMissile)` in `pGame`'s object hash table
 * (`+0x1520`), clears room portal flag (`DUNGEON_ToggleHasPortalFlag(pRoom, 1)`), and if the portal
 * object is in `OBJMODE_NEUTRAL (0)` transitions it to `OBJMODE_OPERATING (1)` and schedules event `1`
 * at `dwGameFrame + (ObjectsTxt.dwFrameCnt1 >>> 8)`, returning `1` (`0` if collided or missing).
 *
 * @va D2Game:0x6FC5E670
 */
export function MISSILES_SrvDo_OpenTownPortalObject_6FC5E670_113c(
  m: Memory113c,
  pGame: number,
  pMissile: number,
  bCollided: number,
  hooks?: LaneK0x6fc5Hooks113c,
): number {
  hitD2GameVa113c(0x6FC5E670)
  if ((bCollided | 0) !== 0) return 0
  const dwPortalGuid = MISSILE_GetTargetX113c(m, pMissile >>> 0) >>> 0
  const game = pGame >>> 0
  if (game === 0) {
    throw new D2CommonAssertError(
      'MISSILES_SrvDo_OpenTownPortalObject_6FC5E670_113c: pGame == NULL',
      0x2d3,
    )
  }

  const pPortalObj = findUnitInGameHashList113c(m, game, 0x1520, dwPortalGuid)
  if (pPortalObj === 0) return 0

  const pRoom = UNITS_GetRoom113c(m, pPortalObj) >>> 0
  if (pRoom !== 0) {
    DUNGEON_ToggleHasPortalFlag113c(m, pRoom, 1)
  }

  if (m.u32((pPortalObj + 0x10) >>> 0) === 0) {
    UNITS_ChangeAnimMode113c(m, pPortalObj, 1)
    const nObjClassId = m.u32((pPortalObj + 0x04) >>> 0) | 0
    const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjClassId) >>> 0
    if (pObjTxt !== 0) {
      const dwFrameCnt1 = m.u32((pObjTxt + 0xdc) >>> 0) >>> 0
      const dwGameFrame = m.u32((game + 0xa8) >>> 0) >>> 0
      const targetFrame = ((dwFrameCnt1 >>> 8) + dwGameFrame) >>> 0
      EVENT_SetEventFull113c(
        m,
        game,
        pPortalObj,
        1,
        targetFrame,
        0,
        0,
        0,
        hooks !== undefined ? hooks.eventHooks : undefined,
      )
    }
  }
  return 1
}

/**
 * Initializes Charged Bolt drunken-missile pathing (`PATHTYPE_MISSILE_DRUNKEN = 10`) on `pMissile`
 * (`ecx`), clamping total and remaining frames to `77` (`0x4D`) when `>= 78` (`0x4E`), seeding
 * `pMissile->tSeed` (`+0x20`) with `PATH_GetFirstPointX(pPath) + nSeedOffset` (`edx`), and computing
 * the path.
 *
 * @va D2Game:0x6FC61F50
 */
export function MISSILES_InitChargedBoltPath_6FC61F50_113c(
  m: Memory113c,
  pMissile: number,
  nSeedOffset: number,
): void {
  hitD2GameVa113c(0x6FC61F50)
  const missile = pMissile >>> 0
  if (missile === 0) return

  let totalFrames = MISSILE_GetTotalFrames113c(m, missile) | 0
  if (totalFrames >= 0x4e) {
    totalFrames = 0x4d
    MISSILE_SetTotalFrames113c(m, missile, 0x4d)
    MISSILE_SetRemainingFrames113c(m, missile, 0x4d)
  }

  const pPath = m.u32((missile + 0x2c) >>> 0) >>> 0
  const firstX = PATH_GetFirstPointX113c(m, pPath) | 0
  const seedVal = ((firstX + (nSeedOffset | 0)) | 0) >>> 0
  SEED_InitLowSeed113c(m, (missile + 0x20) >>> 0, seedVal)
  PATH_SetType113c(m, pPath, 0x0a)
  PATH_SetNewDistance113c(m, pPath, totalFrames)
  PATH_Compute113c(m, pPath, missile, 0)
}

/**
 * `Skills.txt` `SrvStFunc = 13` (`0x6FD2736C`): validates `0 <= nSkillId < nSkillsTxtRecordCount`,
 * resolves `SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(pUnit, nSkillId)`, sets
 * `Param1 = -1` and `Param2 = 1`, and returns `1` (`0` if invalid or skill missing; `ecx = pGame`,
 * `edx = pUnit`, `[esp+4] = nSkillId`, `[esp+8] = nLevel`, `ret 0x8`).
 *
 * @va D2Game:0x6FC62230
 */
export function SKILLS_SrvSt13_ResetSkillParams_6FC62230_113c(
  m: Memory113c,
  _pGame: number,
  pUnit: number,
  nSkillId: number,
  _nLevel: number,
): number {
  hitD2GameVa113c(0x6FC62230)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = m.u32(pSgptPtr) >>> 0
  const nSkillsCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (skillId >= nSkillsCount) return 0
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit >>> 0, skillId) >>> 0
  if (pSkill === 0) return 0

  SKILLS_SetParam1113c(m, pSkill, -1)
  SKILLS_SetParam2113c(m, pSkill, 1)
  return 1
}

/**
 * Stat-list expiration callback (`ecx = pUnit`, `edx = nState`, `[esp+4] = pStatList`, `ret 0x4`):
 * clears graphics state `nState` via `STATES_ToggleGfxStateFlag113c(pUnit, nState, 0)` and sets
 * `UNITFLAG_SKILLEND (0x40)` on `pUnit->dwFlags` (`+0xC4`) when `pUnit != NULL`.
 *
 * @va D2Game:0x6FC62290
 */
export function SKILLS_StatListExpireClearState_6FC62290_113c(
  m: Memory113c,
  pUnit: number,
  nState: number,
  _pStatList: number,
): void {
  hitD2GameVa113c(0x6FC62290)
  const unit = pUnit >>> 0
  STATES_ToggleGfxStateFlag113c(m, unit, nState | 0, 0)
  if (unit !== 0) {
    m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
}
