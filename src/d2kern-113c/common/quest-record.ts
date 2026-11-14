/**
 * Diablo II v1.13c `D2Common.dll` hireling experience (`Hireling.cpp`) and DRLG warp (`DrlgWarp.cpp`)
 * leaf functions (image base `0x6FD50000`).
 *
 * Binary evidence (`objdump -d -M intel` on 1.13c `D2Common.dll`):
 * - `0x6FD7C990`: `HIRELING_GetExpForLevel` (`__stdcall(nLevel, nExpPerLvl)`, `ret 0x8`)
 * - `0x6FD7D210`: `DRLG_SetWarpId` (LTCG `eax = pWarp`, `ebx = nVis`, `ecx = nIndex`, `[esp+4] = nWarpId`, `ret 0x4`)
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2DrlgWarpStrc,
  D2HirelingTxt,
  D2SkillListStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import {
  DATATBLS_GetHirelingTxtRecordFromClassId113c,
  DATATBLS_GetHirelingTxtRecordFromNameId113c,
} from '../tables/monster-tbls-113c.ts'
import { D2CommonAssertError } from './inline-helpers.ts'
import { imul32 } from './int-math.ts'

/** `.data` `sgDefaultWaypointWordIdx` (`i16`) at `0x6FDE9C58` (`0x6FD80A49 movsx eax, word ptr ds:0x6fde9c58`). */
export const SG_DEFAULT_WAYPOINT_WORD_IDX_VA_113C = 0x6fde9c58
/** `.data` `sgDefaultWaypointMask` (`u16`) at `0x6FDE9C5A` (`0x6FD80A50 mov cx, word ptr ds:0x6fde9c5a`). */
export const SG_DEFAULT_WAYPOINT_MASK_VA_113C = 0x6fde9c5a
/** `.bss` `gpIntroDataTable` (`u32*`) at `0x6FDF1420` (`0x6FD80A6D mov eax, ds:0x6fdf1420`). */
export const G_INTRO_DATA_TABLE_VA_113C = 0x6fdf1420
/** `.bss` `gnIntroDataTableCount` (`i32`) at `0x6FDF1424` (`0x6FD80A61 mov edx, ds:0x6fdf1424`). */
export const G_INTRO_DATA_COUNT_VA_113C = 0x6fdf1424

const QUESTRECORD_ASSERT_FILE_113C = '..\\Source\\D2Common\\QuestRecord\\QuestRecord.cpp'
const UNITS_ASSERT_FILE_113C = '..\\Source\\D2Common\\Units\\Units.cpp'
const SKILLS_ASSERT_FILE_113C = '..\\Source\\D2Common\\Skills\\Skills.cpp'
const WAYPOINT_ASSERT_FILE_113C = '..\\Source\\D2Common\\WayPoint\\Waypoint.cpp'

/**
 * `@va D2Common:0x6FD7C990` (`HIRELING_GetExpForLevel`,
 * stdcall `[esp+4] = nLevel`, `[esp+8] = nExpPerLvl`, `ret 8` -> `((nLevel + 1) * nLevel * nLevel * nExpPerLvl) >>> 0`).
 *
 * Pure arithmetic leaf (`0x6FD7C990..0x6FD7C9A2`):
 * `mov ecx, [esp+4]; lea eax, [ecx+1]; imul eax, ecx; imul eax, ecx; imul eax, [esp+8]; ret 8`.
 */
export function HIRELING_GetExpForLevel113c(nLevel: number, nExpPerLvl: number): number {
  const lvl = nLevel | 0
  let v = (lvl + 1) | 0
  v = imul32(v, lvl)
  v = imul32(v, lvl)
  v = imul32(v, nExpPerLvl | 0)
  return v >>> 0
}

/**
 * `@va D2Common:0x6FD7D210` (`DRLG_SetWarpId`,
 * internal LTCG `eax = pWarp`, `ebx = nVis`, `ecx = nIndex`, `[esp+4] = nWarpId`, `ret 4`, void).
 *
 * Scans `pWarp->nVis[0..7]` (`+0x04..+0x20`) for an existing slot matching `nVis` (`0x6FD7D220..0x6FD7D22F`);
 * if found, updates `pWarp->nWarp[i] = nWarpId` (`0x6FD7D2AB..0x6FD7D2B5`) and returns.
 * Otherwise, if `nIndex == -1`, scans `k = 0..7` (2x4 unrolled loop `0x6FD7D241..0x6FD7D297`) for the first
 * slot where `nVis[k] == 0 && nWarp[k] == 0xFFFFFFFF`, then writes `nVis[idx] = nVis` and `nWarp[idx] = nWarpId`
 * (`0x6FD7D29F..0x6FD7D2A8`).
 */
export function DRLG_SetWarpId113c(
  m: Memory113c,
  pWarp: number,
  nVis: number,
  nIndex: number,
  nWarpId: number,
): void {
  const w = pWarp >>> 0
  const vis = nVis >>> 0
  const warpId = nWarpId >>> 0

  for (let i = 0; i < 8; i++) {
    if (m.get(w, D2DrlgWarpStrc.nVis, i) === vis) {
      m.set(w, D2DrlgWarpStrc.nWarp, warpId, i)
      return
    }
  }

  let idx = nIndex | 0
  if (idx === -1) {
    for (let k = 0; k < 8; k++) {
      if (
        m.get(w, D2DrlgWarpStrc.nVis, k) === 0 &&
        m.get(w, D2DrlgWarpStrc.nWarp, k) === 0xffffffff
      ) {
        idx = k
        break
      }
    }
  }

  m.setU32((w + 4 + imul32(idx, 4)) >>> 0, vis)
  m.setU32((w + 0x24 + imul32(idx, 4)) >>> 0, warpId)
}

/**
 * `@va D2Common:0x6FD7CF40` (`D2Common.#10697` `QUESTRECORD_CopyRecordToBuffer`,
 * stdcall `[esp+4] = pQuestData`, `[esp+8] = pBuffer`, `[esp+0xC] = wSize`, `[esp+0x10] = bUnused`, `ret 0x10`, void).
 *
 * Asserts `(wSize & 0xFFFF) == 0x60` (`line 0x84`), then copies 24 dwords (`0x60` bytes)
 * from `m.u32(pQuestData)` to `pBuffer`.
 */
export function QUESTRECORD_CopyRecordToBuffer113c(
  m: Memory113c,
  pQuestData: number,
  pBuffer: number,
  wSize: number,
  _bUnused: number,
): void {
  if ((wSize & 0xffff) !== 0x60) {
    throw new D2CommonAssertError(QUESTRECORD_ASSERT_FILE_113C, 0x84)
  }
  const qd = pQuestData >>> 0
  const dst = pBuffer >>> 0
  const pBitBuf = m.u32(qd)
  for (let i = 0; i < 0x60; i += 4) {
    m.setU32((dst + i) >>> 0, m.u32((pBitBuf + i) >>> 0))
  }
}

/**
 * `@va D2Common:0x6FD7CFC0` (`D2Common.#10218` `QUESTRECORD_AllocRecord`,
 * stdcall `[esp+4] = pMemPool`, `ret 4` -> `D2BitBufferStrc*`).
 *
 * Allocates a 20-byte `D2BitBufferStrc` (`0x14`) and a zeroed 96-byte (`0x60`) backing bit buffer via `Fog.#10045`,
 * initializes the bit buffer header via `Fog.#10126` (`pBuffer = pBuf`, `nBits = 0x300`, `nPos = 0`, `nPosBits = 0`, `bFull = 0`),
 * and returns the `D2BitBufferStrc` pointer.
 */
export function QUESTRECORD_AllocRecord113c(m: Memory113c, _pMemPool: number): number {
  const pRecord = m.alloc(0x14)
  const pBuf = m.alloc(0x60)
  for (let i = 0; i < 0x60; i += 4) {
    m.setU32((pBuf + i) >>> 0, 0)
  }
  m.setU32(pRecord, pBuf)
  m.setU32((pRecord + 0x04) >>> 0, 0x300)
  m.setU32((pRecord + 0x08) >>> 0, 0)
  m.setU32((pRecord + 0x0c) >>> 0, 0)
  m.setU32((pRecord + 0x10) >>> 0, 0)
  return pRecord >>> 0
}

/**
 * `@va D2Common:0x6FD7D020` (`D2Common.#10627` `QUESTRECORD_ClearQuestStateBits2To11`,
 * stdcall `[esp+4] = pQuestData`, `[esp+8] = nQuest`, `ret 8`, void).
 *
 * Asserts `pQuestData != 0` (`line 0x3E`), then loops `nState = 2..11` (`0x02..0x0B`),
 * clearing bit `(nQuest << 4) + nState` in `pQuestData->pBuffer` (`+0x00`) via `Fog.#10120`.
 */
export function QUESTRECORD_ClearQuestStateBits2To11_113c(
  m: Memory113c,
  pQuestData: number,
  nQuest: number,
): void {
  const qd = pQuestData >>> 0
  if (qd === 0) {
    throw new D2CommonAssertError(QUESTRECORD_ASSERT_FILE_113C, 0x3e)
  }
  const questBase = (nQuest << 4) | 0
  for (let state = 2; state < 12; state++) {
    const pBuf = m.u32(qd)
    const bitIdx = (questBase + state) | 0
    const byteAddr = (pBuf + (bitIdx >> 3)) >>> 0
    const mask = (~(1 << (bitIdx & 7))) & 0xff
    m.setU8(byteAddr, (m.u8(byteAddr) & mask) >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD7D070` (`D2Common.#11085` `QUESTRECORD_ClearQuestState`,
 * stdcall `[esp+4] = pQuestData`, `[esp+8] = nQuest`, `[esp+0xC] = nState`, `ret 0xC`, void).
 *
 * Asserts `pQuestData != 0` (`line 0x34`), then clears bit `(nQuest << 4) + nState` in
 * `pQuestData->pBuffer` (`+0x00`) via `Fog.#10120`.
 */
export function QUESTRECORD_ClearQuestState113c(
  m: Memory113c,
  pQuestData: number,
  nQuest: number,
  nState: number,
): void {
  const qd = pQuestData >>> 0
  if (qd === 0) {
    throw new D2CommonAssertError(QUESTRECORD_ASSERT_FILE_113C, 0x34)
  }
  const pBuf = m.u32(qd)
  const bitIdx = ((nQuest << 4) + nState) | 0
  const byteAddr = (pBuf + (bitIdx >> 3)) >>> 0
  const mask = (~(1 << (bitIdx & 7))) & 0xff
  m.setU8(byteAddr, (m.u8(byteAddr) & mask) >>> 0)
}

/**
 * `@va D2Common:0x6FD7D0B0` (`D2Common.#10003` `QUESTRECORD_SetQuestState`,
 * stdcall `[esp+4] = pQuestData`, `[esp+8] = nQuest`, `[esp+0xC] = nState`, `ret 0xC`, void).
 *
 * Asserts `pQuestData != 0` (`line 0x29`), then sets bit `(nQuest << 4) + nState` in
 * `pQuestData->pBuffer` (`+0x00`) via `Fog.#10118`.
 */
export function QUESTRECORD_SetQuestState113c(
  m: Memory113c,
  pQuestData: number,
  nQuest: number,
  nState: number,
): void {
  const qd = pQuestData >>> 0
  if (qd === 0) {
    throw new D2CommonAssertError(QUESTRECORD_ASSERT_FILE_113C, 0x29)
  }
  const pBuf = m.u32(qd)
  const bitIdx = ((nQuest << 4) + nState) | 0
  const byteAddr = (pBuf + (bitIdx >> 3)) >>> 0
  const mask = (1 << (bitIdx & 7)) & 0xff
  m.setU8(byteAddr, (m.u8(byteAddr) | mask) >>> 0)
}

/**
 * `@va D2Common:0x6FD7FED0` (internal `UNITS_InitStaticPathCoords`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pRoom`, `[esp+0xC] = nX`, `[esp+0x10] = nY`, `ret 0x10`, void).
 *
 * Asserts `pUnit != 0` (`line 0x866`), reads `pStaticPath = pUnit->pPath (+0x2C)`, and writes:
 * - `+0x00 = pRoom`
 * - `+0x0C = nX`
 * - `+0x04 = (nX - nY) << 4`
 * - `+0x1C (u8) = 0`
 * - `+0x10 = nY`
 * - `+0x08 = (nX + nY) << 3`
 */
export function UNITS_InitStaticPathCoords113c(
  m: Memory113c,
  pUnit: number,
  pRoom: number,
  nX: number,
  nY: number,
): void {
  const u = pUnit >>> 0
  if (u === 0) {
    throw new D2CommonAssertError(UNITS_ASSERT_FILE_113C, 0x866)
  }
  const pStaticPath = m.get(u, D2UnitStrc.pPath)
  const x = nX | 0
  const y = nY | 0
  m.setU32(pStaticPath, pRoom >>> 0)
  m.setU32((pStaticPath + 0x0c) >>> 0, x >>> 0)
  m.setU32((pStaticPath + 0x04) >>> 0, ((x - y) << 4) >>> 0)
  m.setU8((pStaticPath + 0x1c) >>> 0, 0)
  m.setU32((pStaticPath + 0x10) >>> 0, y >>> 0)
  m.setU32((pStaticPath + 0x08) >>> 0, ((x + y) << 3) >>> 0)
}

/**
 * `@va D2Common:0x6FD80420` (`D2Common.#10557` `UNITS_GetRightSkill`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `D2SkillStrc*`).
 *
 * Asserts `pUnit != 0` (`line 0x64A`) and `pUnit->pSkills (+0xA8) != 0` (`line 0x40F`),
 * then returns `pSkills->pRightSkill (+0x0C)`.
 */
export function UNITS_GetRightSkill113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) {
    throw new D2CommonAssertError(UNITS_ASSERT_FILE_113C, 0x64a)
  }
  const pSkills = m.get(u, D2UnitStrc.pSkills)
  if (pSkills === 0) {
    throw new D2CommonAssertError(SKILLS_ASSERT_FILE_113C, 0x40f)
  }
  return m.get(pSkills, D2SkillListStrc.pRightSkill)
}

/**
 * `@va D2Common:0x6FD80460` (`D2Common.#10926` `UNITS_GetLeftSkill`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `D2SkillStrc*`).
 *
 * Asserts `pUnit != 0` (`line 0x641`) and `pUnit->pSkills (+0xA8) != 0` (`line 0x3EA`),
 * then returns `pSkills->pLeftSkill (+0x08)`.
 */
export function UNITS_GetLeftSkill113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) {
    throw new D2CommonAssertError(UNITS_ASSERT_FILE_113C, 0x641)
  }
  const pSkills = m.get(u, D2UnitStrc.pSkills)
  if (pSkills === 0) {
    throw new D2CommonAssertError(SKILLS_ASSERT_FILE_113C, 0x3ea)
  }
  return m.get(pSkills, D2SkillListStrc.pLeftSkill)
}

/**
 * `@va D2Common:0x6FD80880` (`D2Common.#11132` `UNITS_FreePlayerData`,
 * stdcall `[esp+4] = pMemPool`, `[esp+8] = pPlayerUnit`, `ret 8`, void).
 *
 * Asserts `pPlayerUnit != 0` (`line 0xF6B`) and `pPlayerUnit->pPlayerData (+0x14) != 0` (`line 0xF6D`),
 * iterates the 3 difficulty slots (`edi = 0x1C, 0x20, 0x24`), validates waypoint header magic (`0x0102`,
 * upgrading `0` or `0x0101` to `0x0102` in-place before free, or asserting at `line 0x113`), and clears
 * `pPlayerUnit->pPlayerData (+0x14) = 0`.
 */
export function UNITS_FreePlayerData113c(
  m: Memory113c,
  _pMemPool: number,
  pPlayerUnit: number,
): void {
  const u = pPlayerUnit >>> 0
  if (u === 0) {
    throw new D2CommonAssertError(UNITS_ASSERT_FILE_113C, 0xf6b)
  }
  const pPlayerDataInit = m.get(u, D2UnitStrc.pUnitData)
  if (pPlayerDataInit === 0) {
    throw new D2CommonAssertError(UNITS_ASSERT_FILE_113C, 0xf6d)
  }
  for (let edi = 0x1c; edi < 0x28; edi += 4) {
    const pPlayerData1 = m.get(u, D2UnitStrc.pUnitData)
    const pQuestData = m.u32((pPlayerData1 + edi - 0x0c) >>> 0)
    if (pQuestData !== 0) {
      m.u32(pQuestData)
    }
    const pPlayerData2 = m.get(u, D2UnitStrc.pUnitData)
    const pWaypoint = m.u32((pPlayerData2 + edi) >>> 0)
    const wMagic = m.u16(pWaypoint)
    if (wMagic !== 0x0102) {
      if (wMagic !== 0 && wMagic !== 0x0101) {
        throw new D2CommonAssertError(WAYPOINT_ASSERT_FILE_113C, 0x113)
      }
      m.setU16(pWaypoint, 0x0102)
    }
  }
  m.get(u, D2UnitStrc.pUnitData)
  m.set(u, D2UnitStrc.pUnitData, 0)
}

/**
 * `@va D2Common:0x6FD80970` (`D2Common.#10955` `UNITS_InitPlayerData`,
 * stdcall `[esp+4] = pPlayerUnit`, `ret 4`, void).
 *
 * Asserts `pPlayerUnit != 0` (`line 0xF4F`) and `pPlayerUnit->pPlayerData (+0x14) == 0` (`line 0xF51`).
 * Allocates a 364-byte (`0x16C`) `D2PlayerDataStrc`, zeroes it, allocates 3 quest records (`+0x10..+0x18`)
 * and 3 waypoint records (`+0x1C..+0x24`, with magic `0x0102` and default waypoint bit from `0x6FDE9C58..0x6FDE9C5A`),
 * scans `gpIntroDataTable` (`0x6FDF1420`, count at `0x6FDF1424`) for entry `== 1` to set `+0x2C = 1 << idx`,
 * and zeroes `+0x4C`.
 */
export function UNITS_InitPlayerData113c(m: Memory113c, pPlayerUnit: number): void {
  const u = pPlayerUnit >>> 0
  if (u === 0) {
    throw new D2CommonAssertError(UNITS_ASSERT_FILE_113C, 0xf4f)
  }
  if (m.get(u, D2UnitStrc.pUnitData) !== 0) {
    throw new D2CommonAssertError(UNITS_ASSERT_FILE_113C, 0xf51)
  }
  m.get(u, D2UnitStrc.pMemPool)
  const pPlayerData = m.alloc(0x16c)
  m.set(u, D2UnitStrc.pUnitData, pPlayerData)
  for (let i = 0; i < 0x16c; i += 4) {
    m.setU32((pPlayerData + i) >>> 0, 0)
  }
  m.setU8(m.get(u, D2UnitStrc.pUnitData), 0)

  for (let ebx = 0x1c; ebx < 0x28; ebx += 4) {
    m.get(u, D2UnitStrc.pMemPool)
    const pQuestRec = m.alloc(0x14)
    const pQuestBuf = m.alloc(0x60)
    for (let i = 0; i < 0x60; i += 4) {
      m.setU32((pQuestBuf + i) >>> 0, 0)
    }
    m.setU32(pQuestRec, pQuestBuf)
    m.setU32((pQuestRec + 0x04) >>> 0, 0x300)
    m.setU32((pQuestRec + 0x08) >>> 0, 0)
    m.setU32((pQuestRec + 0x0c) >>> 0, 0)
    m.setU32((pQuestRec + 0x10) >>> 0, 0)
    m.setU32((m.get(u, D2UnitStrc.pUnitData) + ebx - 0x0c) >>> 0, pQuestRec)

    m.get(u, D2UnitStrc.pMemPool)
    const pWaypoint = m.alloc(0x10)
    for (let i = 0; i < 0x10; i += 4) {
      m.setU32((pWaypoint + i) >>> 0, 0)
    }
    m.setU16(pWaypoint, 0x0102)
    const wpIdx = (m.u16(SG_DEFAULT_WAYPOINT_WORD_IDX_VA_113C) << 16) >> 16
    const wpMask = m.u16(SG_DEFAULT_WAYPOINT_MASK_VA_113C)
    const wpWordAddr = (pWaypoint + wpIdx * 2) >>> 0
    m.setU16(wpWordAddr, (m.u16(wpWordAddr) | wpMask) & 0xffff)
    m.setU32((m.get(u, D2UnitStrc.pUnitData) + ebx) >>> 0, pWaypoint)
  }

  const count = m.u32(G_INTRO_DATA_COUNT_VA_113C) | 0
  let ecx = 0
  if (count > 0) {
    const pTable = m.u32(G_INTRO_DATA_TABLE_VA_113C)
    while (ecx < count) {
      if (m.u32((pTable + ecx * 4) >>> 0) === 1) break
      ecx++
    }
  }
  const flagVal = ecx < count ? (1 << (ecx & 31)) >>> 0 : 0
  m.setU32((m.get(u, D2UnitStrc.pUnitData) + 0x2c) >>> 0, flagVal)
  m.setU32((m.get(u, D2UnitStrc.pUnitData) + 0x4c) >>> 0, 0)
}

/**
 * `@va D2Common:0x6FD7C9E0` (`D2Common.#10988` `HIRELING_GetActIndex`,
 * fastcall `ecx = bExpansion`, `edx = nClassId`, `[esp+4] = nNameId`, `ret 4` -> `pRecord->dwAct - 1` or `0`).
 *
 * Looks up `D2HirelingTxt` by `(bExpansion, nClassId, 0)` (`0x6FDA3190`), falling back to
 * `(bExpansion, nNameId, 0)` (`0x6FDA3220`) when null, and returns `pRec->dwAct (+0x0C) - 1` (`0` if neither matched).
 */
export function HIRELING_GetActIndex113c(
  m: Memory113c,
  bExpansion: number,
  nClassId: number,
  nNameId: number,
): number {
  let pRec = DATATBLS_GetHirelingTxtRecordFromClassId113c(m, bExpansion, nClassId, 0)
  if (pRec === 0) {
    pRec = DATATBLS_GetHirelingTxtRecordFromNameId113c(m, bExpansion, nNameId, 0)
    if (pRec === 0) return 0
  }
  return ((m.get(pRec, D2HirelingTxt.dwAct) | 0) - 1) >>> 0
}

/**
 * `@va D2Common:0x6FD80590` (`D2Common.#10859` `PLAYER_StoreSwitchLeftSkill`,
 * stdcall `[esp+4] = pUnit`, `ret 4`, void).
 *
 * No-op unless `pUnit != NULL && pUnit->dwUnitType == 0`. Asserts `pUnit->pPlayerData (+0x14) != NULL`
 * (`Units.cpp:0x1424`), queries `pSkill = UNITS_GetLeftSkill(pUnit)` (`0x6FD80460`), writes
 * `pPlayerData + 0x84 = pSkill ? s16(u16(*pSkill)) : 0` before asserting `pSkill != NULL` (`Skills.cpp:0x638`),
 * then writes `pPlayerData + 0x8C = pSkill->dwOwnerGuid (+0x34)`.
 */
export function PLAYER_StoreSwitchLeftSkill113c(m: Memory113c, pUnit: number): void {
  const u = pUnit >>> 0
  if (u === 0 || m.get(u, D2UnitStrc.dwUnitType) !== 0) return
  const pPlayerData = m.get(u, D2UnitStrc.pUnitData)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(UNITS_ASSERT_FILE_113C, 0x1424)
  }
  const pSkill = UNITS_GetLeftSkill113c(m, u)
  const skillId = pSkill !== 0 ? (m.u16(m.u32(pSkill)) << 16) >> 16 : 0
  m.setU32((pPlayerData + 0x84) >>> 0, skillId >>> 0)
  if (pSkill === 0) {
    throw new D2CommonAssertError(SKILLS_ASSERT_FILE_113C, 0x638)
  }
  m.setU32((pPlayerData + 0x8c) >>> 0, m.u32((pSkill + 0x34) >>> 0))
}

/**
 * `@va D2Common:0x6FD80600` (`D2Common.#10645` `PLAYER_StoreSwitchRightSkill`,
 * stdcall `[esp+4] = pUnit`, `ret 4`, void).
 *
 * No-op unless `pUnit != NULL && pUnit->dwUnitType == 0`. Asserts `pUnit->pPlayerData (+0x14) != NULL`
 * (`Units.cpp:0x1414`), queries `pSkill = UNITS_GetRightSkill(pUnit)` (`0x6FD80420`), writes
 * `pPlayerData + 0x80 = pSkill ? s16(u16(*pSkill)) : 0` before asserting `pSkill != NULL` (`Skills.cpp:0x638`),
 * then writes `pPlayerData + 0x88 = pSkill->dwOwnerGuid (+0x34)`.
 */
export function PLAYER_StoreSwitchRightSkill113c(m: Memory113c, pUnit: number): void {
  const u = pUnit >>> 0
  if (u === 0 || m.get(u, D2UnitStrc.dwUnitType) !== 0) return
  const pPlayerData = m.get(u, D2UnitStrc.pUnitData)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(UNITS_ASSERT_FILE_113C, 0x1414)
  }
  const pSkill = UNITS_GetRightSkill113c(m, u)
  const skillId = pSkill !== 0 ? (m.u16(m.u32(pSkill)) << 16) >> 16 : 0
  m.setU32((pPlayerData + 0x80) >>> 0, skillId >>> 0)
  if (pSkill === 0) {
    throw new D2CommonAssertError(SKILLS_ASSERT_FILE_113C, 0x638)
  }
  m.setU32((pPlayerData + 0x88) >>> 0, m.u32((pSkill + 0x34) >>> 0))
}

/**
 * `@va D2Common:0x6FD80670` (`D2Common.#10088` `PLAYER_StoreLeftSkill`,
 * stdcall `[esp+4] = pUnit`, `ret 4`, void).
 *
 * No-op unless `pUnit != NULL && pUnit->dwUnitType == 0`. Asserts `pUnit->pPlayerData (+0x14) != NULL`
 * (`Units.cpp:0x1405`), queries `pSkill = UNITS_GetLeftSkill(pUnit)` (`0x6FD80460`), writes
 * `pPlayerData + 0x74 = pSkill ? s16(u16(*pSkill)) : 0` before asserting `pSkill != NULL` (`Skills.cpp:0x638`),
 * then writes `pPlayerData + 0x7C = pSkill->dwOwnerGuid (+0x34)`.
 */
export function PLAYER_StoreLeftSkill113c(m: Memory113c, pUnit: number): void {
  const u = pUnit >>> 0
  if (u === 0 || m.get(u, D2UnitStrc.dwUnitType) !== 0) return
  const pPlayerData = m.get(u, D2UnitStrc.pUnitData)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(UNITS_ASSERT_FILE_113C, 0x1405)
  }
  const pSkill = UNITS_GetLeftSkill113c(m, u)
  const skillId = pSkill !== 0 ? (m.u16(m.u32(pSkill)) << 16) >> 16 : 0
  m.setU32((pPlayerData + 0x74) >>> 0, skillId >>> 0)
  if (pSkill === 0) {
    throw new D2CommonAssertError(SKILLS_ASSERT_FILE_113C, 0x638)
  }
  m.setU32((pPlayerData + 0x7c) >>> 0, m.u32((pSkill + 0x34) >>> 0))
}

/**
 * `@va D2Common:0x6FD806D0` (`D2Common.#10374` `PLAYER_StoreRightSkill`,
 * stdcall `[esp+4] = pUnit`, `ret 4`, void).
 *
 * No-op unless `pUnit != NULL && pUnit->dwUnitType == 0`. Asserts `pUnit->pPlayerData (+0x14) != NULL`
 * (`Units.cpp:0x13F6`), queries `pSkill = UNITS_GetRightSkill(pUnit)` (`0x6FD80420`), writes
 * `pPlayerData + 0x70 = pSkill ? s16(u16(*pSkill)) : 0` before asserting `pSkill != NULL` (`Skills.cpp:0x638`),
 * then writes `pPlayerData + 0x78 = pSkill->dwOwnerGuid (+0x34)`.
 */
export function PLAYER_StoreRightSkill113c(m: Memory113c, pUnit: number): void {
  const u = pUnit >>> 0
  if (u === 0 || m.get(u, D2UnitStrc.dwUnitType) !== 0) return
  const pPlayerData = m.get(u, D2UnitStrc.pUnitData)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(UNITS_ASSERT_FILE_113C, 0x13f6)
  }
  const pSkill = UNITS_GetRightSkill113c(m, u)
  const skillId = pSkill !== 0 ? (m.u16(m.u32(pSkill)) << 16) >> 16 : 0
  m.setU32((pPlayerData + 0x70) >>> 0, skillId >>> 0)
  if (pSkill === 0) {
    throw new D2CommonAssertError(SKILLS_ASSERT_FILE_113C, 0x638)
  }
  m.setU32((pPlayerData + 0x78) >>> 0, m.u32((pSkill + 0x34) >>> 0))
}

