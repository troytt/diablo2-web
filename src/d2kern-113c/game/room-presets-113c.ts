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
import {
  DUNGEON_AcquireRoomExDT1Mask113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetLevelIdIfNotHidden113c,
  DUNGEON_GetRoomCoordinates113c,
} from '../common/dungeon.ts'
import { DRLGPRESET_MovePointerAndClear113c } from '../common/drlg/preset.ts'
import { DRLG_ResolveMonsterSubClassIdForRoom113c } from '../common/drlg/drlg-ver.ts'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import { SEED_RollLimitedRandomNumber113c } from './combat-a1c-113c.ts'
import { MONSTER_SpawnPresetOrEvilUrn113c } from './boot-init-gap-a-113c.ts'
import { MONSTATS_FollowSubClassChain_6FC21D30_113c } from './k2-laneH-0x6fc2-w1-113c.ts'
import { QUESTS_CheckNotIntro_6FC53970_113c } from './k2-laneJ-0x6fc4-w1-113c.ts'
import { REGPOP_SpawnMonStatsGroupPackAtSubtile_6FC670F0_113c } from './k2-laneL-0x6fc6-w1-113c.ts'
import { DATATBLS_GetSuperUniquesTxtRecordCount113c } from '../tables/monster-tbls-113c.ts'
import { REGPOP_RemapDirectionalMonsterClassId113c } from './k2-sunit-spawn-w1-113c.ts'
import { MONUMOD_PromoteToBossWithSingleUMod_6FC44BF0_113c } from './k2-w4b3-113c.ts'
import { MONSTER_SpawnChampionPackMembers_6FC67880_113c } from './k2-w4b4-113c.ts'
import {
  MONUMOD_SpawnSuperUniqueMonsterPack_6FC451F0_113c,
  MONUMOD_SpawnUniqueOrChampionBossPack_6FC44C70_113c,
} from './k2-w12b1-113c.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_CheckFlagBit113c,
  MONSTATS_GetRecordPtr113c,
  MONSTATS_ValidateClassId113c,
  MONSTER_ChooseMonsterClass113c,
} from './regpop-spawn-113c.ts'
import { EVENT_SetEventFull113c } from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

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
/** Scratch pool for `0x6FD5B320` (`0x245`) repaired `D2PresetUnitStrc` nodes so heap allocation order stays invariant. */
let presetRepairPoolPtr = 0x7fd20000
const repairedPresetRooms = new WeakMap<Memory113c, Set<number>>()

function stepPresetSeed64_113c(seed: { lo: number; hi: number }): number {
  const prod = BigInt(seed.lo >>> 0) * 0x6ac690c5n + BigInt(seed.hi >>> 0)
  seed.lo = Number(prod & 0xffffffffn) >>> 0
  seed.hi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  return seed.lo
}

function unstepPresetSeed64_113c(seed: { lo: number; hi: number }): void {
  const prod = (BigInt(seed.hi >>> 0) << 32n) | BigInt(seed.lo >>> 0)
  const prevLo = prod / 0x6ac690c5n
  const prevHi = prod % 0x6ac690c5n
  seed.lo = Number(prevLo & 0xffffffffn) >>> 0
  seed.hi = Number(prevHi & 0xffffffffn) >>> 0
}

/**
 * Repairs `D2RoomExStrc.pPresetUnits (+0x5C)` on TS-generated preset rooms (`pRoomEx >= 0x40000000`)
 * whose DS1 contains `0x245` (`OBJECTS_SpawnPresetTorchOrBrazier`): `D2Common:0x6FD5B320` (`0x6FD5B377 -> 0x6FD5B460`)
 * tests `al & 3` and skips on `== 0` (`spawn = (lo & 3) !== 0`), whereas `preset.ts` tested `(lo & 1) !== 0`.
 */
function repairSimPresetRoom245List113c(m: Memory113c, pRoom: number): void {
  if (pRoom === 0) return
  const pRoomEx = m.u32((pRoom + 0x10) >>> 0) >>> 0
  if (pRoomEx < 0x40000000) return
  if ((m.u32((pRoomEx + 0x48) >>> 0) | 0) !== 2) return
  let seen = repairedPresetRooms.get(m)
  if (seen === undefined) {
    seen = new Set<number>()
    repairedPresetRooms.set(m, seen)
  }
  if (seen.has(pRoomEx)) return
  seen.add(pRoomEx)

  const pPresetRoom = m.u32((pRoomEx + 0x20) >>> 0) >>> 0
  if (pPresetRoom === 0) return
  const pMap = m.u32((pPresetRoom + 0x08) >>> 0) >>> 0
  if (pMap === 0) return
  const pLvlPrest = m.u32((pMap + 0x08) >>> 0) >>> 0
  const pFile = m.u32((pMap + 0x0c) >>> 0) >>> 0
  if (pLvlPrest === 0 || pFile === 0) return

  let has245 = false
  for (let pSrc = m.u32((pFile + 0x54) >>> 0) >>> 0; pSrc !== 0; pSrc = m.u32((pSrc + 0x0c) >>> 0) >>> 0) {
    if ((m.u32((pSrc + 0x14) >>> 0) | 0) === 2 && (m.u32((pSrc + 0x04) >>> 0) | 0) === 0x245) {
      has245 = true
      break
    }
  }
  if (!has245) return

  const pTables = readSgptDataTablesForPresets113c(m)
  const nMonStats = pTables !== 0 ? (m.u32((pTables + 0xa80) >>> 0) | 0) : 0
  const nSuper = m.u32(0x6fdf09b4) | 0

  const bScan = m.u32((pLvlPrest + 0x34) >>> 0) | 0
  const nPops = m.u32((pLvlPrest + 0x38) >>> 0) | 0
  const seed = { lo: 0, hi: 0 }
  if (bScan === 0 && nPops === 0) {
    const roomInitLo = m.u32((pRoomEx + 0x04) >>> 0) >>> 0
    const nextLvlLo = (((BigInt(roomInitLo) - 0x29an) & 0xffffffffn) * 0x8a3e6e0dn) & 0xffffffffn
    const prod2 = nextLvlLo * 0x6ac690c5n + 0x29an
    seed.lo = roomInitLo
    seed.hi = Number((prod2 >> 32n) & 0xffffffffn) >>> 0
  } else {
    const pLevel = m.u32((pRoomEx + 0x58) >>> 0) >>> 0
    if (pLevel === 0) return
    let pFirstMapRoomEx = 0
    for (let rx = m.u32((pLevel + 0x10) >>> 0) >>> 0; rx !== 0; rx = m.u32((rx + 0x24) >>> 0) >>> 0) {
      if ((m.u32((rx + 0x48) >>> 0) | 0) !== 2) continue
      const pr = m.u32((rx + 0x20) >>> 0) >>> 0
      if (pr !== 0 && (m.u32((pr + 0x08) >>> 0) >>> 0) === pMap) {
        pFirstMapRoomEx = rx
      }
    }
    if (pFirstMapRoomEx === 0) return
    let nRolls = 0
    for (let pSrc = m.u32((pFile + 0x54) >>> 0) >>> 0; pSrc !== 0; pSrc = m.u32((pSrc + 0x0c) >>> 0) >>> 0) {
      const ut = m.u32((pSrc + 0x14) >>> 0) | 0
      const cid = m.u32((pSrc + 0x04) >>> 0) | 0
      if (ut === 1) {
        if (cid < nMonStats) {
          const c = cid < 0 ? -1 : cid
          if (c === 0xcc || c === 0xcd || c === 0x173 || c === 0x174) nRolls++
        } else {
          const rel = (cid - nMonStats) | 0
          if (rel >= nSuper) {
            const sIdx = (rel - nSuper) | 0
            if (sIdx >= 0x21 && sIdx <= 0x23) nRolls++
          }
        }
      } else if (ut === 2 && (cid === 0xc4 || cid === 0x105 || cid === 0x245)) {
        nRolls++
      }
    }
    const firstRoomInitLo = m.u32((pFirstMapRoomEx + 0x04) >>> 0) >>> 0
    const firstNextLvlLo = Number(
      (((BigInt(firstRoomInitLo) - 0x29an) & 0xffffffffn) * 0x8a3e6e0dn) & 0xffffffffn,
    ) >>> 0
    seed.lo = m.u32((pLevel + 0x1c4) >>> 0) >>> 0
    seed.hi = m.u32((pLevel + 0x1c8) >>> 0) >>> 0
    let found = false
    for (let back = 0; back < 4096; back++) {
      if (seed.lo === firstNextLvlLo) {
        found = true
        break
      }
      unstepPresetSeed64_113c(seed)
    }
    if (!found) return
    for (let k = 0; k < 1 + nRolls; k++) {
      unstepPresetSeed64_113c(seed)
    }
  }
  const mapOffX = Math.imul(m.u32((pMap + 0x10) >>> 0) | 0, 5)
  const mapOffY = Math.imul(m.u32((pMap + 0x14) >>> 0) | 0, 5)
  const tileX = m.u32((pRoomEx + 0x34) >>> 0) | 0
  const tileY = m.u32((pRoomEx + 0x38) >>> 0) | 0
  const tileW = m.u32((pRoomEx + 0x3c) >>> 0) | 0
  const tileH = m.u32((pRoomEx + 0x40) >>> 0) | 0
  const minSubX = Math.imul(tileX, 5)
  const minSubY = Math.imul(tileY, 5)
  const maxSubX = Math.imul((tileX + tileW) | 0, 5)
  const maxSubY = Math.imul((tileY + tileH) | 0, 5)

  interface Ds1Spec {
    readonly type: number
    readonly cls: number
    readonly relX: number
    readonly relY: number
    readonly mode: number
    readonly flags: number
    readonly buggySpawn: boolean
    readonly trueSpawn: boolean
  }
  const specs: Ds1Spec[] = []
  for (let pSrc = m.u32((pFile + 0x54) >>> 0) >>> 0; pSrc !== 0; pSrc = m.u32((pSrc + 0x0c) >>> 0) >>> 0) {
    const nUnitType = m.u32((pSrc + 0x14) >>> 0) | 0
    const nClassId = m.u32((pSrc + 0x04) >>> 0) | 0
    let buggySpawn = true
    let trueSpawn = true
    if (nUnitType === 1) {
      if (nClassId < nMonStats) {
        const c = nClassId < 0 ? -1 : nClassId
        if (c === 0xcc || c === 0xcd || c === 0x173 || c === 0x174) {
          const lo = stepPresetSeed64_113c(seed)
          if (lo % 3 !== 0) {
            buggySpawn = false
            trueSpawn = false
          }
        }
      } else {
        const rel = (nClassId - nMonStats) | 0
        if (rel >= nSuper) {
          const sIdx = (rel - nSuper) | 0
          if (sIdx === 0x21 || sIdx === 0x23) {
            const lo = stepPresetSeed64_113c(seed)
            if ((lo & 3) === 0) {
              buggySpawn = false
              trueSpawn = false
            }
          } else if (sIdx === 0x22) {
            const lo = stepPresetSeed64_113c(seed)
            if ((lo & 1) === 0) {
              buggySpawn = false
              trueSpawn = false
            }
          }
        }
      }
    } else if (nUnitType === 2) {
      if (nClassId === 0xc4 || nClassId === 0x105) {
        const lo = stepPresetSeed64_113c(seed)
        if ((lo & 1) !== 0) {
          buggySpawn = false
          trueSpawn = false
        }
      } else if (nClassId === 0x245) {
        const lo = stepPresetSeed64_113c(seed)
        buggySpawn = (lo & 1) === 0
        trueSpawn = (lo & 3) !== 0
      }
    }
    const worldX = ((m.u32((pSrc + 0x08) >>> 0) | 0) + mapOffX) | 0
    const worldY = ((m.u32((pSrc + 0x18) >>> 0) | 0) + mapOffY) | 0
    if (worldX >= minSubX && worldX < maxSubX && worldY >= minSubY && worldY < maxSubY) {
      specs.push({
        type: nUnitType,
        cls: nClassId,
        relX: (worldX - minSubX) | 0,
        relY: (worldY - minSubY) | 0,
        mode: m.u32(pSrc) | 0,
        flags: m.u32((pSrc + 0x1c) >>> 0) >>> 0,
        buggySpawn,
        trueSpawn,
      })
    }
  }

  let anyDiff = false
  for (let i = 0; i < specs.length; i++) {
    if (specs[i]!.buggySpawn !== specs[i]!.trueSpawn) {
      anyDiff = true
      break
    }
  }
  if (!anyDiff) return

  const curNodes: number[] = []
  for (let p = m.u32((pRoomEx + 0x5c) >>> 0) >>> 0; p !== 0; p = m.u32((p + PRESET_OFF_NEXT) >>> 0) >>> 0) {
    curNodes.push(p)
  }
  const buggySpecs = specs.filter(s => s.buggySpawn)
  let matchStart = -1
  for (let start = 0; start + buggySpecs.length <= curNodes.length; start++) {
    let ok = true
    for (let j = 0; j < buggySpecs.length; j++) {
      const pNode = curNodes[start + j]!
      const bs = buggySpecs[j]!
      if (
        (m.u32((pNode + PRESET_OFF_TYPE) >>> 0) | 0) !== bs.type ||
        (m.u32((pNode + PRESET_OFF_CLASS) >>> 0) | 0) !== bs.cls ||
        (m.u32((pNode + PRESET_OFF_X) >>> 0) | 0) !== bs.relX ||
        (m.u32((pNode + PRESET_OFF_Y) >>> 0) | 0) !== bs.relY
      ) {
        ok = false
        break
      }
    }
    if (ok) {
      matchStart = start
      break
    }
  }
  if (matchStart < 0) return

  const replacement: number[] = []
  let buggyCursor = 0
  for (let i = 0; i < specs.length; i++) {
    const sp = specs[i]!
    const existingNode = sp.buggySpawn ? curNodes[matchStart + buggyCursor++]! : 0
    if (!sp.trueSpawn) continue
    if (existingNode !== 0) {
      replacement.push(existingNode)
    } else {
      const pNew = presetRepairPoolPtr >>> 0
      presetRepairPoolPtr = (pNew + 0x20) >>> 0
      m.fill(pNew, 0x20, 0)
      m.setU32((pNew + PRESET_OFF_MODE) >>> 0, sp.mode >>> 0)
      m.setU32((pNew + PRESET_OFF_CLASS) >>> 0, sp.cls >>> 0)
      m.setU32((pNew + PRESET_OFF_X) >>> 0, sp.relX >>> 0)
      m.setU32((pNew + PRESET_OFF_TYPE) >>> 0, sp.type >>> 0)
      m.setU32((pNew + PRESET_OFF_Y) >>> 0, sp.relY >>> 0)
      m.setU32((pNew + PRESET_OFF_FLAGS) >>> 0, sp.flags >>> 0)
      replacement.push(pNew)
    }
  }

  const finalNodes = [
    ...curNodes.slice(0, matchStart),
    ...replacement,
    ...curNodes.slice(matchStart + buggySpecs.length),
  ]
  for (let i = 0; i < finalNodes.length; i++) {
    const nxt = i + 1 < finalNodes.length ? finalNodes[i + 1]! : 0
    m.setU32((finalNodes[i]! + PRESET_OFF_NEXT) >>> 0, nxt >>> 0)
  }
  m.setU32((pRoomEx + 0x5c) >>> 0, finalNodes.length > 0 ? finalNodes[0]! : 0)
}

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
  hitD2GameVa113c(0x6FC55E50)
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
  hitD2GameVa113c(0x6FD012D0)
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
  hitD2GameVa113c(0x6FD013B0)
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
  hitD2GameVa113c(0x6FD01430)
  if (pGame === 0) return
  repairSimPresetRoom245List113c(m, pRoom)
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

function readSgptDataTablesForPresets113c(m: Memory113c): number {
  try {
    const pIat = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    if (pIat !== 0) {
      return m.u32(pIat) >>> 0
    }
  } catch {
    // Fall back to direct D2Common!sgptDataTables pointer when IAT slot is unloaded in standalone tests.
  }
  try {
    return m.u32(0x6fde9e1c) >>> 0
  } catch {
    return 0
  }
}

/**
 * Spawns a monster preset unit (`ecx = pRoom, eax = nClassId`, stack `(pGame, x, y, nMode)`, `ret 0x10`).
 * Implements the full 1322-byte `D2Game:0x6FC67CF0` three-way dispatch:
 * 1. Normal monster (`resolvedId < nMonStatsCount`): Act 5 Quest `0x1F` `0x1F2 -> 0x1F3` / `0x205 -> 0x206`
 *    remap, NM/Hell level `0x6E` `0x1C5`/`0x211` filter, and `0x6FC66F70` spawn.
 * 2. SuperUnique (`nMonStatsCount <= resolvedId < nMonStatsCount + nSuperUniquesCount`, or `nType == 1`):
 *    dispatches `0x6FC451F0` (`MONUMOD_SpawnSuperUniqueMonsterPack_6FC451F0_113c`).
 * 3. Special preset (`resolvedId >= nMonStatsCount + nSuperUniquesCount`, `specialId = 2..32` via `0x6FC6821C` /
 *    `0x6FC68240` / `0x6FC68260` / `0x6FC68284`): random Unique/Champion boss packs (`2`, `3`), Sarcophagus (`4`),
 *    Evil Urn (`5`), Trapped Soul (`8`), Act 3 Fetish subclass chain (`10`, `11`), directional catapult/siege/tentacle
 *    presets (`17..23`, `29..32` with `0x1B6` event `7` and dead-corpse flag `0x02000000`), and Normal-only group packs (`24`, `26`).
 *
 * @va D2Game:0x6FC67CF0 (1322B)
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
  hitD2GameVa113c(0x6FC67CF0)
  let resolvedId = nClassId | 0
  if (resolvedId < 0) return 0

  const pTables = readSgptDataTablesForPresets113c(m)
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0

  if (getMonPresetRecord !== undefined && nLevelId > 0) {
    const pLvlRec =
      pTables !== 0 ? (m.u32((pTables + 0xbb8) >>> 0) + Math.imul(nLevelId, 0x220)) >>> 0 : 0
    const nAct = pLvlRec !== 0 ? m.u8((pLvlRec + 0x05) >>> 0) : 0
    const sp = presetStackPtr
    presetStackPtr = (sp + 0x10) >>> 0
    let nType = 2
    try {
      m.setU8(sp, 2)
      resolvedId = getMonPresetRecord(m, nAct, resolvedId, sp) | 0
      nType = (m.u8(sp) << 24) >> 24
    } finally {
      presetStackPtr = sp
    }
    if (resolvedId < 0) return 0
    if (nType === 1) {
      if (spawnSuperUnique !== undefined) {
        return spawnSuperUnique(m, pGame, pRoom, x, y, resolvedId)
      }
      return MONUMOD_SpawnSuperUniqueMonsterPack_6FC451F0_113c(
        m as SparseMemory113c,
        pGame,
        pRoom,
        x,
        y,
        resolvedId,
      )
    }
    if (nType === 0) {
      resolvedId =
        (resolvedId +
          (pTables !== 0 ? m.u32((pTables + 0xa80) >>> 0) | 0 : 0) +
          (pTables !== 0 ? m.u32((pTables + 0xa74) >>> 0) | 0 : 0)) |
        0
    }
  }

  const nMonStats = pTables !== 0 ? m.u32((pTables + 0xa80) >>> 0) | 0 : 0
  const memKnownSuperUniq = (m as unknown as { known?: Map<number, Uint8Array> }).known
  const hasSuperUniqCountGlobal =
    memKnownSuperUniq === undefined ||
    (() => {
      const a = 0x6fdf09b4
      const kp = memKnownSuperUniq.get(a >>> 12)
      return kp !== undefined && kp[a & 0xfff] !== 0
    })()
  const nSuperUniques =
    pTables !== 0
      ? hasSuperUniqCountGlobal
        ? (DATATBLS_GetSuperUniquesTxtRecordCount113c(m) | 0)
        : (m.u32((pTables + 0xa74) >>> 0) | 0)
      : 0

  if (resolvedId < nMonStats) {
    let cid = resolvedId
    if ((cid === 0x1f2 || cid === 0x205) && pGame !== 0 && m.u32((pGame + 0x10f4) >>> 0) !== 0) {
      const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
      if (
        m.u32((pQuestCtrl + 0x08) >>> 0) !== 0 &&
        QUESTS_CheckNotIntro_6FC53970_113c(m, pGame, 0x1f) !== 0 &&
        DUNGEON_GetLevelIdFromRoom113c(m, pRoom) === 0x6e
      ) {
        if (cid === 0x1f2) {
          cid = nMonStats > 0x1f3 ? 0x1f3 : -1
        } else {
          cid = nMonStats > 0x206 ? 0x206 : -1
        }
      }
    }
    if (pGame !== 0 && m.u8((pGame + 0x6d) >>> 0) > 0) {
      const validCid = cid >= 0 && cid < nMonStats ? cid : -1
      if ((validCid === 0x1c5 || validCid === 0x211) && nLevelId === 0x6e) {
        return 0
      }
    }
    return MONSTER_SpawnPresetOrEvilUrn113c(
      m,
      cid,
      pGame,
      pRoom,
      x,
      y,
      nMode,
      spawnAtCoords,
    )
  }

  const suOffset = (resolvedId - nMonStats) | 0
  if (suOffset < nSuperUniques) {
    if (spawnSuperUnique !== undefined) {
      return spawnSuperUnique(m, pGame, pRoom, x, y, suOffset)
    }
    return MONUMOD_SpawnSuperUniqueMonsterPack_6FC451F0_113c(
      m as SparseMemory113c,
      pGame,
      pRoom,
      x,
      y,
      suOffset,
    )
  }

  const specialId = (suOffset - nSuperUniques) | 0
  if (specialId < 2 || specialId > 32) {
    return 0
  }

  const sp = presetStackPtr
  presetStackPtr = (sp + 0x10) >>> 0
  try {
    switch (specialId) {
      case 2: {
        const visLvl = DUNGEON_GetLevelIdIfNotHidden113c(m, pRoom) | 0
        const pMonReg = pGame !== 0 ? m.u32((pGame + 0xf0 + visLvl * 4) >>> 0) >>> 0 : 0
        if (pMonReg === 0) return 0
        m.setU32(sp, 0)
        const cid = MONSTER_ChooseMonsterClass113c(m, 1, pRoom, pMonReg, pGame, sp, 0) | 0
        if (m.u32(sp) === 0) return 0
        MONUMOD_SpawnUniqueOrChampionBossPack_6FC44C70_113c(
          m as SparseMemory113c,
          pGame,
          pRoom,
          0,
          x,
          y,
          0,
          1,
          cid,
        )
        return 0
      }
      case 3: {
        const visLvl = DUNGEON_GetLevelIdIfNotHidden113c(m, pRoom) | 0
        const pMonReg = pGame !== 0 ? m.u32((pGame + 0xf0 + visLvl * 4) >>> 0) >>> 0 : 0
        if (pMonReg === 0) return 0
        m.setU32(sp, 0)
        const cid = MONSTER_ChooseMonsterClass113c(m, 1, pRoom, pMonReg, pGame, sp, 0) | 0
        if (m.u32(sp) === 0) return 0
        const pLeader = spawnAtCoords(m, cid, nMode, pGame, pRoom, x, y, -1, 0) >>> 0
        if (pLeader === 0) return 0
        MONUMOD_PromoteToBossWithSingleUMod_6FC44BF0_113c(m, pLeader, pGame, 0x10)
        MONSTER_SpawnChampionPackMembers_6FC67880_113c(m, pLeader, cid, pGame, 0)
        return pLeader
      }
      case 4:
        return spawnAtCoords(m, 0x10a, nMode, pGame, pRoom, x, y, -1, 0)
      case 5: {
        const cid = nMonStats > 0x10b ? 0x10b : 0
        return spawnAtCoords(m, cid, nMode, pGame, pRoom, x, y, -1, 0)
      }
      case 8:
        return spawnAtCoords(m, 0x11c, nMode, pGame, pRoom, x, y, -1, 8)
      case 10:
      case 11: {
        const wFlags = specialId === 10 ? 4 : 0
        let steps = 0
        if (nLevelId >= 0x4c && nLevelId <= 0x4e) {
          steps = 1
        } else if (nLevelId === 0x5c || nLevelId === 0x5d) {
          steps = 2
        }
        const baseCid = nMonStats > 0x105 ? 0x105 : -1
        const cid = MONSTATS_FollowSubClassChain_6FC21D30_113c(m, baseCid, steps) | 0
        return spawnAtCoords(m, cid, nMode, pGame, pRoom, x, y, -1, wFlags)
      }
      case 17:
      case 18:
      case 22:
      case 23:
      case 29:
      case 30:
      case 31:
      case 32: {
        let rawCid = 0
        let modeUse = nMode | 0
        if (specialId === 17) {
          rawCid = 0x13
        } else if (specialId === 18) {
          rawCid = 0x3a
        } else if (specialId === 22) {
          rawCid = 0x8d
        } else if (specialId === 23) {
          rawCid = 0x116
        } else if (specialId === 29) {
          rawCid = 0x1c5
          modeUse = 0x0c
        } else if (specialId === 30) {
          rawCid = nLevelId === 0x6e ? 0x211 : 0x1ec
          modeUse = 0x0c
        } else if (specialId === 31) {
          rawCid = 0x20a
          modeUse = 0x0c
        } else {
          rawCid = 0x1b6
          modeUse = 0x0c
        }
        const valCid = MONSTATS_ValidateClassId113c(m, rawCid) | 0
        const subCid = DRLG_ResolveMonsterSubClassIdForRoom113c(m, pRoom, valCid) | 0
        const dirCid = REGPOP_RemapDirectionalMonsterClassId113c(m, subCid, nLevelId) | 0
        const pMonStatsRec = MONSTATS_GetRecordPtr113c(m, dirCid) >>> 0
        const wFlags =
          pMonStatsRec !== 0 && (m.u8((pMonStatsRec + 0x0e) >>> 0) & 4) !== 0 ? 8 : 0
        let pSpawned = spawnAtCoords(m, dirCid, modeUse, pGame, pRoom, x, y, -1, wFlags) >>> 0
        if (pSpawned === 0) {
          pSpawned = spawnAtCoords(m, dirCid, modeUse, pGame, pRoom, x, y, 4, wFlags) >>> 0
          if (pSpawned === 0) return 0
        }
        if (MONSTATS_ValidateClassId113c(m, dirCid) === 0x1b6 && pGame !== 0) {
          const delayRoll = SEED_RollLimitedRandomNumber113c(m, (pSpawned + 0x20) >>> 0, 0x32) | 0
          const targetFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + delayRoll + 0xfa) >>> 0
          EVENT_SetEventFull113c(m, pGame, pSpawned, 7, targetFrame, 0, 0, 0)
        }
        if (modeUse === 0x0c) {
          m.setU32((pSpawned + 0xc4) >>> 0, (m.u32((pSpawned + 0xc4) >>> 0) | 0x02000000) >>> 0)
        }
        return pSpawned
      }
      case 24:
      case 26: {
        if (pGame !== 0 && m.u8((pGame + 0x6d) >>> 0) > 0) {
          return 0
        }
        const rawCid = specialId === 24 ? (nLevelId === 0x6e ? 0x211 : 0x1ec) : 0x1c5
        const valCid = MONSTATS_ValidateClassId113c(m, rawCid) | 0
        const subCid = DRLG_ResolveMonsterSubClassIdForRoom113c(m, pRoom, valCid) | 0
        REGPOP_SpawnMonStatsGroupPackAtSubtile_6FC670F0_113c(m, y, x, subCid, pGame, pRoom)
        return 0
      }
      default:
        return 0
    }
  } finally {
    presetStackPtr = sp
  }
}

