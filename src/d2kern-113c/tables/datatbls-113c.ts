/**
 * Diablo II v1.13c `D2Common.dll` `DRLG\DrlgMaze.cpp`, `DRLG\DrlgOutPlace.cpp`, `DATATBLS\DataTbls.cpp`,
 * and `MONSTERS\Monsters.cpp` pure-leaf functions (`0x6FD5E430..0x6FD6A5B0`, image base `0x6FD50000`).
 *
 * Batch `B018` (16 functions):
 * - `0x6FD5E430` `DRLG_ReplacePresetRoom113c` (internal LTCG helper)
 * - `0x6FD5E700` `DRLG_RandomizePresetRooms113c` (internal `__fastcall`)
 * - `0x6FD63FD0` `DRLG_ApplyOutdoorVertexFlags113c` (internal `__fastcall`)
 * - `0x6FD644C0` `DRLG_LinkOutdoorLevels113c` (internal `__fastcall`)
 * - `0x6FD645A0` `DRLG_GetLevelBorderStyle113c` (internal `__fastcall`)
 * - `0x6FD64630` `DRLG_CheckAct1LinkOverlap113c` (internal `__fastcall`)
 * - `0x6FD646C0` `DRLG_CheckAct1WildLinkOverlap113c` (internal `__fastcall`)
 * - `0x6FD64750` `DRLG_CheckAct2LinkOverlap113c` (internal `__fastcall`)
 * - `0x6FD647E0` `DRLG_CheckAct4LinkOverlap113c` (internal `__fastcall`)
 * - `0x6FD64870` `DRLG_CheckMonasteryLinkOverlap113c` (internal `__fastcall`)
 * - `0x6FD6A270` `DATATBLS_GetDirectionOffset113c` (`#10740`)
 * - `0x6FD6A2B0` `DATATBLS_NormalizeDirection113c` (`#10266`)
 * - `0x6FD6A3C0` `DATATBLS_UnusedStub10182_113c` (`#10182`)
 * - `0x6FD6A520` `MONSTERS_IsDead113c` (`#10648`)
 * - `0x6FD6A550` `MONSTERS_CheckMonStatsFlagBit6_113c` (`#10064`)
 * - `0x6FD6A5B0` `MONSTERS_IsDemonOrUndead113c` (`#10239`)
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import { D2CommonAssertError, PLAYER_SetPlayerData150Params113c } from '../common/inline-helpers.ts'
import { imul32, sar32, sdiv32 } from '../common/int-math.ts'
import {
  ITEMS_CheckItemTypeRarityUnder7113c,
  ITEMS_IsUberOrUltraArmorOrWeapon113c,
} from '../common/items.ts'
import {
  D2DrlgCoordStrc,
  D2DrlgCoordStrc_SIZE,
  D2DrlgLevelLinkDataStrc,
  D2DrlgLevelStrc,
  D2DrlgOutdoorInfoStrc,
  D2DrlgPresetRoomStrc,
  D2DynamicPathStrc,
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2MonLvlTxt_SIZE,
  D2MonStatsTxt,
  D2MonStatsTxt_SIZE,
  D2PlayerDataStrc,
  D2RoomExStrc,
  D2ShrinesTxt_SIZE,
  D2StaticPathStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import {
  DATATABLES_LEVELS_COUNT_OFF_113C,
  DATATABLES_LEVELS_TXT_OFF_113C,
  SGPT_DATATABLES_VA_113C,
} from './lvl-tbls-113c.ts'

/** `.rdata` outdoor vertex flag rule table `[15][6]` (360 bytes) at `0x6FDE5350..0x6FDE54B8` (`0x6FD63FE4 mov eax, 0x6fde5350`). */
export const OUTDOOR_VERTEX_RULES_VA_113C = 0x6fde5350
export const OUTDOOR_VERTEX_RULES_END_VA_113C = 0x6fde54b8
export const OUTDOOR_VERTEX_RULE_STRIDE_113C = 0x18

/** `.rdata` level-link table base VAs for `0x6FD64630..0x6FD64870` (`cmp edx, [edi + <TABLE_VA>]`). */
export const LINK_TABLE_ACT1_VA_113C = 0x6fddd190
export const LINK_TABLE_ACT1_WILD_VA_113C = 0x6fddd0a0
export const LINK_TABLE_ACT2_VA_113C = 0x6fddcfb0
export const LINK_TABLE_ACT4_VA_113C = 0x6fddcec0
export const LINK_TABLE_MONASTERY_VA_113C = 0x6fddcdd0

/** `.rdata` direction Y/X signed byte offset tables at `0x6FDE4EC4` / `0x6FDE4EE4` (`0x6FD6A275`, `0x6FD6A282`). */
export const DIR_OFFSET_Y_VA_113C = 0x6fde4ec4
export const DIR_OFFSET_X_VA_113C = 0x6fde4ee4

/** `.data` direction ring lookup table `u8[256]` at `0x6FDEF0B0` (`0x6FD6A2B5 mov al, [eax + 0x6fdef0b0]`). */
export const DIR_RING_LUT_VA_113C = 0x6fdef0b0

/** `.data` pointer to `gdwBitMasks` table at `0x6FDD90B0` (`0x6FD6A590`, `0x6FD6A5EA mov ecx, [0x6fdd90b0]`). */
export const GDW_BITMASKS_PTR_VA_113C = 0x6fdd90b0

/** `sgptDataTables->pMonStatsTxt` (`+0xA78`) and `nMonStatsTxtRecordCount` (`+0xA80`) read via `0x6FDE9E1C` at `0x6FD6A572..0x6FD6A57A`. */
export const DATATABLES_MONSTATS_TXT_OFF_113C = 0xa78
export const DATATABLES_MONSTATS_COUNT_OFF_113C = 0xa80

/** `.bss` `B024` data-tables globals (`0x6FD8E900..0x6FDB08D0`). */
const G_OBJGROUP_COUNT_VA_113C = 0x6fdf0b90
const G_SHRINES_TXT_VA_113C = 0x6fdf0b9c
const G_SHRINES_COUNT_VA_113C = 0x6fdf0ba0
const G_SUPERUNIQUES_COUNT_VA_113C = 0x6fdf09b4
const G_CHEST_TC_TABLE_VA_113C = 0x6fdf089c
const G_COMPCODE_PTR_VA_113C = 0x6fdeff54
const G_COMPCODE_COUNT_VA_113C = 0x6fdeff5c
const G_EXPERIENCE_BIN_VA_113C = 0x6fdf0b50
const G_MONLVL_TXT_VA_113C = 0x6fdf0b54
const G_MONLVL_COUNT_VA_113C = 0x6fdf0b58

const UNIT_MONSTER = 1
const MONMODE_DEATH = 0
const MONMODE_DEAD = 12
const LCG_MUL_113C = 0x6ac690c5n

/**
 * `@va D2Common:0x6FD5E430` (internal LTCG helper, custom ABI `eax=pLevel, esi=nOldPrestId`,
 * stack `[esp+4]=nNewPrestId, [esp+8]=nNewOrient, [esp+0xC]=bClearBit1`, `ret 0xC` -> `eax`).
 *
 * Walks `pLevel->pFirstRoomEx` (`+0x10`) via `pRoomNext` (`+0x24`), inspects `pDungeonData = pRoomEx->pTypeData` (`+0x20`),
 * and finds the first room whose `(dwFlags & 2) === 0` (`shr edx, 1; not edx; test dl, 1`) and `nLevelPrest === nOldPrestId`.
 * Replaces `nLevelPrest`, `nOrientation`, and either clears bit 1 (`bClearBit1 !== 0`) or sets bit 1 (`bClearBit1 === 0`) of `dwFlags`.
 */
export function DRLG_ReplacePresetRoom113c(
  m: Memory113c,
  pLevel: number,
  nOldPrestId: number,
  nNewPrestId: number,
  nNewOrient: number,
  bClearBit1: number,
): number {
  let pRoomEx = m.get(pLevel >>> 0, D2DrlgLevelStrc.pFirstRoomEx)
  const targetPrest = nOldPrestId >>> 0
  while (pRoomEx !== 0) {
    const pDungeonData = m.get(pRoomEx, D2RoomExStrc.pTypeData)
    const dwFlags = m.get(pDungeonData, D2DrlgPresetRoomStrc.dwFlags)
    if (
      (dwFlags & 0x2) === 0 &&
      m.get(pDungeonData, D2DrlgPresetRoomStrc.nLevelPrest) === targetPrest
    ) {
      m.set(pDungeonData, D2DrlgPresetRoomStrc.nLevelPrest, nNewPrestId >>> 0)
      m.set(pDungeonData, D2DrlgPresetRoomStrc.nOrientation, nNewOrient >>> 0)
      if ((bClearBit1 | 0) !== 0) {
        m.set(pDungeonData, D2DrlgPresetRoomStrc.dwFlags, (dwFlags & ~0x2) >>> 0)
      } else {
        m.set(pDungeonData, D2DrlgPresetRoomStrc.dwFlags, (dwFlags | 0x2) >>> 0)
      }
      return pRoomEx
    }
    pRoomEx = m.get(pRoomEx, D2RoomExStrc.pRoomNext)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD5E700` (internal LTCG helper, `__fastcall(ecx=pLevel) -> void`, `ret`).
 *
 * Maps `pLevel->nLevelType` (`+0x1C0`) to a base `LvlPrest` ID (`0x6FD5EB5C` / `0x6FD5EB30`), skips `nLevelId == 8`,
 * shuffles `0..14` via 15 swaps (`3 * 5` unrolled LCG pairs on `pLevel->sSeed` at `+0x1C4..+0x1C8`), and replaces up to
 * `max(2, (nRooms / 5) + 1)` preset rooms over `nRooms * 2` attempts with `targetPrest + 15` and `nOrientation = -1`.
 */
export function DRLG_RandomizePresetRooms113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  let basePrest: number
  switch (m.get(lvl, D2DrlgLevelStrc.nLevelType)) {
    case 3:
      basePrest = 0x34
      break
    case 4:
      basePrest = 0x6c
      break
    case 7:
      basePrest = 0xa7
      break
    case 8:
      basePrest = 0xcd
      break
    case 10:
      basePrest = 0x101
      break
    case 13:
      basePrest = 0x12d
      break
    case 17:
      basePrest = 0x19d
      break
    case 22:
      basePrest = 0x2f1
      break
    case 24:
      basePrest = 0x298
      break
    case 25:
      basePrest = 0x2c0
      break
    default:
      return
  }

  if (m.get(lvl, D2DrlgLevelStrc.nLevelId) === 8) return

  const rollSeedMod15 = (): number => {
    const l = BigInt(m.get(lvl, D2DrlgLevelStrc.sSeed, 0))
    const h = BigInt(m.get(lvl, D2DrlgLevelStrc.sSeed, 1))
    const prod = l * LCG_MUL_113C + h
    const newL = Number(prod & 0xffffffffn) >>> 0
    const newH = Number((prod >> 32n) & 0xffffffffn) >>> 0
    m.set(lvl, D2DrlgLevelStrc.sSeed, newL, 0)
    m.set(lvl, D2DrlgLevelStrc.sSeed, newH, 1)
    return newL % 15
  }

  let curIdx = rollSeedMod15()
  const arr = new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
  const nRooms = m.get(lvl, D2DrlgLevelStrc.nRooms) | 0
  let roomsLeft = (sdiv32(nRooms, 5) + 1) | 0
  if (roomsLeft <= 2) {
    roomsLeft = 2
  }
  let attemptsLeft = (nRooms * 2) >>> 0

  for (let iter = 0; iter < 3; iter++) {
    for (let k = 0; k < 5; k++) {
      const idx1 = rollSeedMod15()
      const idx2 = rollSeedMod15()
      const tmp = arr[idx2]!
      arr[idx2] = arr[idx1]!
      arr[idx1] = tmp
    }
  }

  while (attemptsLeft !== 0 && roomsLeft !== 0) {
    const targetPrest = (basePrest + arr[curIdx]!) >>> 0
    const newPrest = (targetPrest + 15) >>> 0
    let pRoomEx = m.get(lvl, D2DrlgLevelStrc.pFirstRoomEx)
    while (pRoomEx !== 0) {
      const pDungeonData = m.get(pRoomEx, D2RoomExStrc.pTypeData)
      const dwFlags = m.get(pDungeonData, D2DrlgPresetRoomStrc.dwFlags)
      if (
        (dwFlags & 0x2) === 0 &&
        m.get(pDungeonData, D2DrlgPresetRoomStrc.nLevelPrest) === targetPrest
      ) {
        m.set(pDungeonData, D2DrlgPresetRoomStrc.nLevelPrest, newPrest)
        m.set(pDungeonData, D2DrlgPresetRoomStrc.nOrientation, 0xffffffff)
        m.set(pDungeonData, D2DrlgPresetRoomStrc.dwFlags, (dwFlags | 0x2) >>> 0)
        roomsLeft = (roomsLeft - 1) | 0
        break
      }
      pRoomEx = m.get(pRoomEx, D2RoomExStrc.pRoomNext)
    }
    attemptsLeft = (attemptsLeft - 1) >>> 0
    curIdx = (((curIdx + 1) | 0) % 15) | 0
  }
}

/**
 * `@va D2Common:0x6FD63FD0` (internal LTCG helper, `__fastcall(ecx=pLevel, edx=nIndex, [esp+4]=pDirArray) -> void`, `ret 4`).
 *
 * When `pLevel->nDrlgType === 3`, iterates the 15 outdoor vertex rules at `.rdata` `0x6FDE5350..0x6FDE54B8`
 * (`3` loop iterations * `5` unrolled 24-byte records) and ORs matching flag masks into `pLevel->pOutdoors->dwFlags`.
 */
export function DRLG_ApplyOutdoorVertexFlags113c(
  m: Memory113c,
  pLevel: number,
  nIndex: number,
  pDirArray: number,
): void {
  const lvl = pLevel >>> 0
  if (m.get(lvl, D2DrlgLevelStrc.nDrlgType) !== 3) return
  const pOutdoors = m.get(lvl, D2DrlgLevelStrc.pOutdoors)
  const idxOff = ((pDirArray >>> 0) + (((nIndex | 0) << 2) >>> 0)) >>> 0

  for (
    let ruleAddr = OUTDOOR_VERTEX_RULES_VA_113C;
    ruleAddr < OUTDOOR_VERTEX_RULES_END_VA_113C;
    ruleAddr += OUTDOOR_VERTEX_RULE_STRIDE_113C
  ) {
    const reqLvl = m.u32(ruleAddr) | 0
    const levelId = m.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
    if (levelId !== reqLvl && reqLvl !== 0) continue
    if (levelId === (m.u32((ruleAddr + 0x04) >>> 0) | 0)) continue
    if (levelId === (m.u32((ruleAddr + 0x08) >>> 0) | 0)) continue
    if ((m.u32(idxOff) | 0) !== (m.u32((ruleAddr + 0x0c) >>> 0) | 0)) continue
    if ((m.u32((idxOff + 0x04) >>> 0) | 0) !== (m.u32((ruleAddr + 0x10) >>> 0) | 0)) continue
    const mask = m.u32((ruleAddr + 0x14) >>> 0)
    m.set(
      pOutdoors,
      D2DrlgOutdoorInfoStrc.dwFlags,
      (m.get(pOutdoors, D2DrlgOutdoorInfoStrc.dwFlags) | mask) >>> 0,
    )
  }
}

/**
 * `@va D2Common:0x6FD644C0` (internal LTCG helper, `__fastcall(ecx=pLinkData) -> eax`, `ret`).
 *
 * Resets `pLinkData->nRand[1][nIteration] = 0`, copies `pLinkData->nRand[1][nIteration]` to `pLinkData->nRand[0][nIteration]`,
 * and places `pLevelCoord[nIteration]` relative to `pLevelCoord[pLink[nIteration].nLevelLink]` according to `nRand[0][nIteration]` (`0..3`).
 * Preserves the exact 3 memory reloads of `pLinkData->nIteration` (`+0x1EC`) at `0x6FD644C0`, `0x6FD644D1`, and `0x6FD644EC`.
 */
export function DRLG_LinkOutdoorLevels113c(m: Memory113c, pLinkData: number): number {
  const base = pLinkData >>> 0
  const nIter0 = m.get(base, D2DrlgLevelLinkDataStrc.nIteration)
  m.setU32((base + D2DrlgLevelLinkDataStrc.nRand1.off + ((nIter0 << 2) >>> 0)) >>> 0, 0)

  const nIter1 = m.get(base, D2DrlgLevelLinkDataStrc.nIteration)
  const rand1Val = m.u32((base + D2DrlgLevelLinkDataStrc.nRand1.off + ((nIter1 << 2) >>> 0)) >>> 0)
  m.setU32((base + D2DrlgLevelLinkDataStrc.nRand0.off + ((nIter1 << 2) >>> 0)) >>> 0, rand1Val)

  const pLink = m.get(base, D2DrlgLevelLinkDataStrc.pLink)
  const nIter2 = m.get(base, D2DrlgLevelLinkDataStrc.nIteration)
  const dirMode = m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + ((nIter2 << 2) >>> 0)) >>> 0)
  const iterScaled = (nIter2 << 4) >>> 0
  const nLevelLink = m.u32((pLink + iterScaled + 0x08) >>> 0)
  const pSrcBox = (base + ((nLevelLink << 4) >>> 0) + D2DrlgLevelLinkDataStrc.nPosX.off) >>> 0
  const pDstBox = (base + iterScaled + D2DrlgLevelLinkDataStrc.nPosX.off) >>> 0

  switch (dirMode) {
    case 0: {
      m.set(pDstBox, D2DrlgCoordStrc.nPosX, m.get(pSrcBox, D2DrlgCoordStrc.nPosX))
      const y =
        (m.get(pSrcBox, D2DrlgCoordStrc.nPosY) + m.get(pSrcBox, D2DrlgCoordStrc.nHeight)) >>> 0
      m.set(pDstBox, D2DrlgCoordStrc.nPosY, y)
      break
    }
    case 1: {
      const x =
        (m.get(pSrcBox, D2DrlgCoordStrc.nPosX) - m.get(pDstBox, D2DrlgCoordStrc.nWidth)) >>> 0
      m.set(pDstBox, D2DrlgCoordStrc.nPosX, x)
      m.set(pDstBox, D2DrlgCoordStrc.nPosY, m.get(pSrcBox, D2DrlgCoordStrc.nPosY))
      break
    }
    case 2: {
      const x =
        (m.get(pSrcBox, D2DrlgCoordStrc.nWidth) -
          m.get(pDstBox, D2DrlgCoordStrc.nWidth) +
          m.get(pSrcBox, D2DrlgCoordStrc.nPosX)) >>>
        0
      m.set(pDstBox, D2DrlgCoordStrc.nPosX, x)
      const y =
        (m.get(pSrcBox, D2DrlgCoordStrc.nPosY) - m.get(pDstBox, D2DrlgCoordStrc.nHeight)) >>> 0
      m.set(pDstBox, D2DrlgCoordStrc.nPosY, y)
      break
    }
    case 3: {
      const x =
        (m.get(pSrcBox, D2DrlgCoordStrc.nPosX) + m.get(pSrcBox, D2DrlgCoordStrc.nWidth)) >>> 0
      m.set(pDstBox, D2DrlgCoordStrc.nPosX, x)
      const y =
        (m.get(pSrcBox, D2DrlgCoordStrc.nHeight) -
          m.get(pDstBox, D2DrlgCoordStrc.nHeight) +
          m.get(pSrcBox, D2DrlgCoordStrc.nPosY)) >>>
        0
      m.set(pDstBox, D2DrlgCoordStrc.nPosY, y)
      break
    }
  }
  return 1
}

/**
 * `@va D2Common:0x6FD645A0` (internal LTCG helper, `__fastcall(ecx=pLevel, [esp+4]=bFlag) -> eax`, `ret 4`).
 *
 * Maps `pLevel->nLevelType` (`+0x1C0`) and `bFlag` (`[esp+4]` low byte) to outdoor border preset index (`-1..5`).
 */
export function DRLG_GetLevelBorderStyle113c(m: Memory113c, pLevel: number, bFlag: number): number {
  const lvl = pLevel >>> 0
  switch (m.get(lvl, D2DrlgLevelStrc.nLevelType)) {
    case 2:
      return (bFlag & 0xff) === 0 ? 1 : 0
    case 16:
      return 2
    case 27:
      return 3
    case 31:
      return m.get(lvl, D2DrlgLevelStrc.nLevelId) === 0x75 ? 5 : 4
    default:
      return -1
  }
}

function checkLinkBoxesNoOverlap113c(
  m: Memory113c,
  pLinkData: number,
  nIteration: number,
  tableBaseVa: number,
): number {
  const nIter = nIteration | 0
  if (nIter <= 0) return 1
  const base = pLinkData >>> 0
  const iterScaled = (nIter << 4) >>> 0
  const pCurBox = (base + iterScaled + D2DrlgLevelLinkDataStrc.nPosX.off) >>> 0

  for (let i = 0; i < nIter; i++) {
    const linkedIdx = m.u32((tableBaseVa + iterScaled) >>> 0) | 0
    if (i === linkedIdx) continue
    const pOtherBox =
      (base + Math.imul(i, D2DrlgCoordStrc_SIZE) + D2DrlgLevelLinkDataStrc.nPosX.off) >>> 0
    const xCur = m.get(pCurBox, D2DrlgCoordStrc.nPosX) | 0
    const xOther = m.get(pOtherBox, D2DrlgCoordStrc.nPosX) | 0
    const gapX =
      xCur < xOther
        ? ((xOther - (m.get(pCurBox, D2DrlgCoordStrc.nWidth) | 0)) - xCur) | 0
        : ((xCur - (m.get(pOtherBox, D2DrlgCoordStrc.nWidth) | 0)) - xOther) | 0

    const yCur = m.get(pCurBox, D2DrlgCoordStrc.nPosY) | 0
    const yOther = m.get(pOtherBox, D2DrlgCoordStrc.nPosY) | 0
    const gapY =
      yCur < yOther
        ? ((yOther - (m.get(pCurBox, D2DrlgCoordStrc.nHeight) | 0)) - yCur) | 0
        : ((yCur - (m.get(pOtherBox, D2DrlgCoordStrc.nHeight) | 0)) - yOther) | 0

    if (gapX < 0 && gapY < 0) return 0
  }
  return 1
}

/**
 * `@va D2Common:0x6FD64630` (internal LTCG helper, `__fastcall(ecx=pLinkData, edx=nIteration) -> eax`, `ret`).
 * Checks AABB overlap of `pLevelCoord[nIteration]` against prior boxes `0..nIteration-1` using `.rdata` table `0x6FDDD190`.
 */
export function DRLG_CheckAct1LinkOverlap113c(
  m: Memory113c,
  pLinkData: number,
  nIteration: number,
): number {
  return checkLinkBoxesNoOverlap113c(m, pLinkData, nIteration, LINK_TABLE_ACT1_VA_113C)
}

/**
 * `@va D2Common:0x6FD646C0` (internal LTCG helper, `__fastcall(ecx=pLinkData, edx=nIteration) -> eax`, `ret`).
 * Checks AABB overlap of `pLevelCoord[nIteration]` against prior boxes `0..nIteration-1` using `.rdata` table `0x6FDDD0A0`.
 */
export function DRLG_CheckAct1WildLinkOverlap113c(
  m: Memory113c,
  pLinkData: number,
  nIteration: number,
): number {
  return checkLinkBoxesNoOverlap113c(m, pLinkData, nIteration, LINK_TABLE_ACT1_WILD_VA_113C)
}

/**
 * `@va D2Common:0x6FD64750` (internal LTCG helper, `__fastcall(ecx=pLinkData, edx=nIteration) -> eax`, `ret`).
 * Checks AABB overlap of `pLevelCoord[nIteration]` against prior boxes `0..nIteration-1` using `.rdata` table `0x6FDDCFB0`.
 */
export function DRLG_CheckAct2LinkOverlap113c(
  m: Memory113c,
  pLinkData: number,
  nIteration: number,
): number {
  return checkLinkBoxesNoOverlap113c(m, pLinkData, nIteration, LINK_TABLE_ACT2_VA_113C)
}

/**
 * `@va D2Common:0x6FD647E0` (internal LTCG helper, `__fastcall(ecx=pLinkData, edx=nIteration) -> eax`, `ret`).
 * Checks AABB overlap of `pLevelCoord[nIteration]` against prior boxes `0..nIteration-1` using `.rdata` table `0x6FDDCEC0`.
 */
export function DRLG_CheckAct4LinkOverlap113c(
  m: Memory113c,
  pLinkData: number,
  nIteration: number,
): number {
  return checkLinkBoxesNoOverlap113c(m, pLinkData, nIteration, LINK_TABLE_ACT4_VA_113C)
}

/**
 * `@va D2Common:0x6FD64870` (internal LTCG helper, `__fastcall(ecx=pLinkData, edx=nIteration) -> eax`, `ret`).
 * Checks AABB overlap of `pLevelCoord[nIteration]` against prior boxes `0..nIteration-1` using `.rdata` table `0x6FDDCDD0`.
 */
export function DRLG_CheckMonasteryLinkOverlap113c(
  m: Memory113c,
  pLinkData: number,
  nIteration: number,
): number {
  return checkLinkBoxesNoOverlap113c(m, pLinkData, nIteration, LINK_TABLE_MONASTERY_VA_113C)
}

/**
 * `@va D2Common:0x6FD6A270` (`D2Common.#10740`, `__stdcall(nDir, pOutX, pOutY) -> void`, `ret 0xC`).
 * Sign-extends `.rdata` byte offsets at `0x6FDE4EE4[nDir & 0xFF]` and `0x6FDE4EC4[nDir & 0xFF]` into `*pOutX` and `*pOutY`.
 */
export function DATATBLS_GetDirectionOffset113c(
  m: Memory113c,
  nDir: number,
  pOutX: number,
  pOutY: number,
): void {
  const idx = nDir & 0xff
  const dx = (m.u8((DIR_OFFSET_X_VA_113C + idx) >>> 0) << 24) >> 24
  m.setU32(pOutX >>> 0, dx >>> 0)
  const dy = (m.u8((DIR_OFFSET_Y_VA_113C + idx) >>> 0) << 24) >> 24
  m.setU32(pOutY >>> 0, dy >>> 0)
}

/**
 * `@va D2Common:0x6FD6A2B0` (`D2Common.#10266`, `__stdcall(nDir) -> uint8_t`, `ret 4`).
 * Returns `m.u8(0x6FDEF0B0 + (nDir & 0xFF))`.
 */
export function DATATBLS_NormalizeDirection113c(m: Memory113c, nDir: number): number {
  const idx = nDir & 0xff
  return m.u8((DIR_RING_LUT_VA_113C + idx) >>> 0)
}

/**
 * `@va D2Common:0x6FD6A3C0` (`D2Common.#10182`, `__stdcall(a0, a1) -> void`, `ret 8`).
 * 3-byte empty stub (`c2 08 00`).
 */
export function DATATBLS_UnusedStub10182_113c(_m: Memory113c, _a0 = 0, _a1 = 0): void {}

/**
 * `@va D2Common:0x6FD6A520` (`D2Common.#10648`, `__stdcall(pUnit) -> BOOL`, `ret 4`).
 * Returns `1` iff `pUnit != 0 && pUnit->dwUnitType == 1` (`UNIT_MONSTER`) and `pUnit->dwAnimMode` (`+0x10`) is `0` (`MONMODE_DEATH`) or `12` (`MONMODE_DEAD`).
 */
export function MONSTERS_IsDead113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0 || m.get(u, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return 0
  const mode = m.get(u, D2UnitStrc.dwAnimMode)
  if (mode === MONMODE_DEATH || mode === MONMODE_DEAD) return 1
  return 0
}

/**
 * `@va D2Common:0x6FD6A550` (`D2Common.#10064`, `__stdcall(pMonStatsTxt, pUnit) -> uint32_t`, `ret 8`).
 * Checks bit 6 (`gdwBitMasks[6]` at `*(0x6FDD90B0) + 0x18`, value `0x40`) of `pMonStatsTxt->nBitField1` (`+0x0C`),
 * resolving `pMonStatsTxt` from `sgptDataTables->pMonStatsTxt[pUnit->dwClassId]` when `pMonStatsTxt == 0`.
 */
export function MONSTERS_CheckMonStatsFlagBit6_113c(
  m: Memory113c,
  pMonStatsTxt: number,
  pUnit: number,
): number {
  const u = pUnit >>> 0
  if (u === 0 || m.get(u, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return 0
  let pRec = pMonStatsTxt >>> 0
  if (pRec === 0) {
    const classId = m.get(u, D2UnitStrc.dwClassId) | 0
    if (classId < 0) return 0
    const sgpt = m.u32(SGPT_DATATABLES_VA_113C)
    const count = m.u32((sgpt + DATATABLES_MONSTATS_COUNT_OFF_113C) >>> 0) | 0
    if (classId >= count) return 0
    const pBase = m.u32((sgpt + DATATABLES_MONSTATS_TXT_OFF_113C) >>> 0)
    pRec = (pBase + Math.imul(classId, D2MonStatsTxt_SIZE)) >>> 0
    if (pRec === 0) return 0
  }
  const flags0C = m.get(pRec, D2MonStatsTxt.nBitField1)
  const pBitMasks = m.u32(GDW_BITMASKS_PTR_VA_113C)
  return (flags0C & m.u32((pBitMasks + 0x18) >>> 0)) >>> 0
}

/**
 * `@va D2Common:0x6FD6A5B0` (`D2Common.#10239`, `__stdcall(pUnit) -> BOOL`, `ret 4`).
 * Looks up `sgptDataTables->pMonStatsTxt[pUnit->dwClassId]` and returns `1` if `nBitField2` (`+0x0D`) has
 * bit 3 (`gdwBitMasks[3]` at `*(0x6FDD90B0) + 0x0C`) or bit 4 (`gdwBitMasks[4]` at `*(0x6FDD90B0) + 0x10`) set, else `0`.
 */
export function MONSTERS_IsDemonOrUndead113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0 || m.get(u, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return 0
  const classId = m.get(u, D2UnitStrc.dwClassId) | 0
  if (classId < 0) return 0
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C)
  const count = m.u32((sgpt + DATATABLES_MONSTATS_COUNT_OFF_113C) >>> 0) | 0
  if (classId >= count) return 0
  const pBase = m.u32((sgpt + DATATABLES_MONSTATS_TXT_OFF_113C) >>> 0)
  const pRec = (pBase + Math.imul(classId, D2MonStatsTxt_SIZE)) >>> 0
  if (pRec === 0) return 0
  const flags0D = m.get(pRec, D2MonStatsTxt.nBitField2)
  const pBitMasks = m.u32(GDW_BITMASKS_PTR_VA_113C)
  if ((flags0D & m.u32((pBitMasks + 0x0c) >>> 0)) !== 0) return 1
  if ((flags0D & m.u32((pBitMasks + 0x10) >>> 0)) !== 0) return 1
  return 0
}

/**
 * `@va D2Common:0x6FD8E900` (`D2Common.#10620` `DATATBLS_GetObjGroupTxtRecordCount`,
 * 0-arg `ret` -> `m.u32(0x6FDF0B90)`).
 */
export function DATATBLS_GetObjGroupTxtRecordCount113c(m: Memory113c): number {
  return m.u32(G_OBJGROUP_COUNT_VA_113C)
}

/**
 * `@va D2Common:0x6FD8E960` (`D2Common.#10834` `DATATBLS_GetShrinesTxtRecord`,
 * stdcall `[esp+4] = nIndex`, `ret 4` -> `D2ShrinesTxt*` or `0` if `count <= nIndex`).
 * Note: binary has no `nIndex < 0` check (`0x6FD8E960 cmp ecx, eax; jle`).
 */
export function DATATBLS_GetShrinesTxtRecord113c(m: Memory113c, nIndex: number): number {
  const idx = nIndex | 0
  const count = m.u32(G_SHRINES_COUNT_VA_113C) | 0
  if (count <= idx) return 0
  return (m.u32(G_SHRINES_TXT_VA_113C) + imul32(idx, D2ShrinesTxt_SIZE)) >>> 0
}

/**
 * `@va D2Common:0x6FDA3AA0` (internal LTCG helper `DATATBLS_AdjustMonsterPresetIndex`,
 * stdcall `[esp+4] = nType`, `[esp+8] = nIndex`, `ret 8` -> adjusted preset index).
 */
export function DATATBLS_AdjustMonsterPresetIndex113c(
  m: Memory113c,
  nType: number,
  nIndex: number,
): number {
  const type = nType | 0
  const idx = nIndex >>> 0
  if (type === 0) {
    const superUniquesCount = m.u32(G_SUPERUNIQUES_COUNT_VA_113C)
    const sgpt = m.u32(SGPT_DATATABLES_VA_113C)
    return (superUniquesCount + idx + m.u32((sgpt + DATATABLES_MONSTATS_COUNT_OFF_113C) >>> 0)) >>> 0
  }
  if (type === 2) {
    const sgpt = m.u32(SGPT_DATATABLES_VA_113C)
    return (idx + m.u32((sgpt + DATATABLES_MONSTATS_COUNT_OFF_113C) >>> 0)) >>> 0
  }
  return idx
}

/**
 * `@va D2Common:0x6FDA43C0` (`D2Common.#10275` `DATATBLS_GetChestTreasureClass`,
 * stdcall `[esp+4] = nDifficulty`, `[esp+8] = nAct`, `[esp+0xC] = nTier`, `ret 0xC` -> `m.u32(0x6FDF089C + idx * 4)`).
 */
export function DATATBLS_GetChestTreasureClass113c(
  m: Memory113c,
  nDifficulty: number,
  nAct: number,
  nTier: number,
): number {
  let diff = nDifficulty | 0
  if (diff < 0) diff = 0
  else if (diff >= 3) diff = 2

  let act = nAct | 0
  if (act < 0) act = 0
  else if (act >= 5) act = 4

  let tier = nTier | 0
  if (tier < 0) tier = 0
  else if (tier >= 3) tier = 2

  const idx = (tier + (act + diff * 5) * 3) >>> 0
  return m.u32((G_CHEST_TC_TABLE_VA_113C + idx * 4) >>> 0)
}

/**
 * `@va D2Common:0x6FDAE1C0` (`D2Common.#10447` `DATATBLS_GetCompCodeString`,
 * stdcall `[esp+4] = nIndex`, `ret 4` -> `m.u32(m.u32(0x6FDEFF54) + nIndex * 4)` or `0`).
 * Note: binary has no `nIndex < 0` check (`0x6FDAE1C4 cmp eax, ds:0x6FDEFF5C; jge`).
 */
export function DATATBLS_GetCompCodeString113c(m: Memory113c, nIndex: number): number {
  const idx = nIndex | 0
  if (idx >= (m.u32(G_COMPCODE_COUNT_VA_113C) | 0)) return 0
  const pBase = m.u32(G_COMPCODE_PTR_VA_113C)
  return m.u32((pBase + imul32(idx, 4)) >>> 0)
}

/**
 * `@va D2Common:0x6FDAE7E0` (`D2Common.#10591` `DATATBLS_GetMaxLevel`,
 * stdcall `[esp+4] = nClass`, `ret 4` -> `m.u32(m.u32(0x6FDF0B50) + cls * 4)`).
 */
export function DATATBLS_GetMaxLevel113c(m: Memory113c, nClass: number): number {
  let cls = nClass | 0
  if (cls < 0 || cls >= 7) cls = 0
  const pExp = m.u32(G_EXPERIENCE_BIN_VA_113C)
  return m.u32((pExp + cls * 4) >>> 0)
}

/**
 * `@va D2Common:0x6FDAE810` (`D2Common.#11092` `DATATBLS_GetStartExpForLevel`,
 * stdcall `[esp+4] = nClass`, `[esp+8] = nLevel`, `ret 8` -> `m.u32(m.u32(0x6FDF0B50) + (cls + nLevel * 8 + 8) * 4)`).
 */
export function DATATBLS_GetStartExpForLevel113c(
  m: Memory113c,
  nClass: number,
  nLevel: number,
): number {
  let cls = nClass | 0
  if (cls < 0 || cls >= 7) cls = 0
  const pExp = m.u32(G_EXPERIENCE_BIN_VA_113C)
  const edx = (cls + imul32(nLevel | 0, 8) + 8) | 0
  return m.u32((pExp + imul32(edx, 4)) >>> 0)
}

/**
 * `@va D2Common:0x6FDAE840` (`D2Common.#10989` `DATATBLS_GetExpRatio`,
 * stdcall `[esp+4] = nLevel`, `ret 4` -> `ExpRatio` from `sgpExperienceBin`).
 */
export function DATATBLS_GetExpRatio113c(m: Memory113c, nLevel: number): number {
  const pExp = m.u32(G_EXPERIENCE_BIN_VA_113C)
  if (pExp === 0) return 0
  const lvl = nLevel | 0
  if (lvl <= 0) return m.u32((pExp + 0x1c) >>> 0)
  if (lvl > (m.u32(pExp) | 0)) return 0
  return m.u32((pExp + ((lvl << 5) >>> 0) + 0x3c) >>> 0)
}

/**
 * `@va D2Common:0x6FDB03C0` (`D2Common.#10237` `DATATBLS_GetMonLvlTxtRecord`,
 * stdcall `[esp+4] = nLevel`, `ret 4` -> `D2MonLvlTxt*`).
 */
export function DATATBLS_GetMonLvlTxtRecord113c(m: Memory113c, nLevel: number): number {
  const count = m.u32(G_MONLVL_COUNT_VA_113C) | 0
  let lvl = nLevel | 0
  if (lvl < 0) lvl = 0
  else if (lvl >= count) lvl = (count - 1) | 0
  return (m.u32(G_MONLVL_TXT_VA_113C) + imul32(lvl, D2MonLvlTxt_SIZE)) >>> 0
}

/**
 * `@va D2Common:0x6FDB08D0` (`D2Common.#10670` `DATATBLS_GetCurrentLevelFromExp`,
 * stdcall `[esp+4] = nClass`, `[esp+8] = dwExp`, `ret 8` -> level `0..maxLvl`).
 */
export function DATATBLS_GetCurrentLevelFromExp113c(
  m: Memory113c,
  nClass: number,
  dwExp: number,
): number {
  let cls = nClass | 0
  if (cls < 0 || cls >= 7) cls = 0
  const pExp = m.u32(G_EXPERIENCE_BIN_VA_113C)
  const pClassCol = (pExp + cls * 4) >>> 0
  const maxLvl = m.u32(pClassCol) | 0
  let ecx = (pClassCol + 0x20) >>> 0
  let edi = m.u32(ecx)
  let eax = 0
  const exp = dwExp >>> 0
  if (exp < edi) return 0
  while (eax < maxLvl) {
    edi = m.u32((ecx + 0x20) >>> 0)
    ecx = (ecx + 0x20) >>> 0
    eax = (eax + 1) | 0
    if (exp < edi) break
  }
  return eax >>> 0
}

/**
 * `@va D2Common:0x6FDBE0C0` (`D2Common.#10068` `DATATBLS_GetLevelMonsterLevel`,
 * stdcall `[esp+4] = nLevelId`, `[esp+8] = nDifficulty`, `[esp+0xC] = bExpansion`, `ret 0xC` -> sign-extended monster level or `1`).
 */
export function DATATBLS_GetLevelMonsterLevel113c(
  m: Memory113c,
  nLevelId: number,
  nDifficulty: number,
  bExpansion: number,
): number {
  const diff = nDifficulty & 0xff
  if (diff >= 3) return 1
  const id = nLevelId | 0
  if (id <= 0) return 1
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C)
  const count = m.u32((sgpt + DATATABLES_LEVELS_COUNT_OFF_113C) >>> 0) | 0
  if (id >= count) return 1
  const pBase = m.u32((sgpt + DATATABLES_LEVELS_TXT_OFF_113C) >>> 0)
  const pRec = (pBase + imul32(id, D2LevelsTxt_SIZE)) >>> 0
  if (pRec === 0) return 1
  if ((bExpansion | 0) !== 0) {
    return ((m.get(pRec, D2LevelsTxt.wMonLvEx1, diff) << 16) >> 16) >>> 0
  }
  return ((m.get(pRec, D2LevelsTxt.wMonLv1, diff) << 16) >> 16) >>> 0
}

/**
 * `@va D2Common:0x6FDC1480` (internal LTCG helper `DATATBLS_GetBooksTxtRecordCountPtr`,
 * 0-arg `ret` -> `0x6FDEFD98`).
 */
export function DATATBLS_GetBooksTxtRecordCountPtr113c(_m: Memory113c): number {
  return 0x6fdefd98
}

/**
 * `@va D2Common:0x6FDC1520` (internal LTCG helper `DATATBLS_GetQualityItemsTxtRecordCountPtr`,
 * 0-arg `ret` -> `0x6FDEFDA0`).
 */
export function DATATBLS_GetQualityItemsTxtRecordCountPtr113c(_m: Memory113c): number {
  return 0x6fdefda0
}

/**
 * `@va D2Common:0x6FDC1660` (internal LTCG helper `DATATBLS_GetBeltsTxtRecordCountPtr`,
 * 0-arg `ret` -> `0x6FDEFD90`).
 */
export function DATATBLS_GetBeltsTxtRecordCountPtr113c(_m: Memory113c): number {
  return 0x6fdefd90
}

/**
 * `@va D2Common:0x6FDCF550` (`D2Common.#10997` `UNITS_IsPointWithinRadius`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pPoint`, `[esp+0xC] = nRadius`, `ret 0xC` -> `1` if `dx*dx + dy*dy <= nRadius*nRadius`, else `0`).
 * Note: unconditionally dereferences `pUnit`, `pPoint`, and (for `dwUnitType` in `{2, 4, 5}`) `pPath + 0x0C` / `pPath + 0x10`.
 */
export function UNITS_IsPointWithinRadius113c(
  m: Memory113c,
  pUnit: number,
  pPoint: number,
  nRadius: number,
): number {
  const u = pUnit >>> 0
  const unitType = m.get(u, D2UnitStrc.dwUnitType)
  let ux: number
  let uy: number
  switch (unitType) {
    case 0:
    case 1:
    case 3: {
      const pPath = m.get(u, D2UnitStrc.pPath)
      ux = pPath !== 0 ? m.u16((pPath + 0x02) >>> 0) : 0
      uy = pPath !== 0 ? m.u16((pPath + 0x06) >>> 0) : 0
      break
    }
    case 2:
    case 4:
    case 5: {
      const pPath = m.get(u, D2UnitStrc.pPath)
      ux = m.u32((pPath + 0x0c) >>> 0)
      uy = m.u32((pPath + 0x10) >>> 0)
      break
    }
    default:
      ux = 0
      uy = 0
      break
  }
  const pt = pPoint >>> 0
  const dx = (m.u32(pt) - ux) | 0
  const dy = (m.u32((pt + 4) >>> 0) - uy) | 0
  const r = nRadius | 0
  return ((imul32(dx, dx) + imul32(dy, dy)) | 0) <= imul32(r, r) ? 1 : 0
}

// ============================================================================
// K1r2 Iteration 7 Lane B — Batch B033 (18 D2Common hostImport functions)
// ============================================================================

export const SGPT_MONSTATS_TXT_PTR_VA = 0x6fdf0950
export const SGPT_MONSTATS_TXT_COUNT_VA = 0x6fdf0958
export const MONSTER_SUBCLASS_VEL_TABLE_VA = 0x6fde4e78
export const SGPT_OBJGROUP_TXT_PTR_VA = 0x6fdf0b8c
export const SGPT_OBJGROUP_TXT_COUNT_VA = 0x6fdf0b90
export const SGPT_LVLSUB_TXT_PTR_VA = 0x6fdf143c
export const SGPT_LVLSUB_TYPE_LUT_PTR_VA = 0x6fdf1444
export const SGPT_LVLWARP_TXT_PTR_VA = 0x6fdf142c
export const SGPT_LVLWARP_TXT_COUNT_VA = 0x6fdf1430
export const SGPT_BOOKS_TXT_COUNT_VA = 0x6fdefd98
export const SGPT_BOOKS_TXT_PTR_VA = 0x6fdefd9c
export const SGPT_QUALITYITEMS_TXT_COUNT_VA = 0x6fdefda0
export const SGPT_QUALITYITEMS_TXT_PTR_VA = 0x6fdefda4
export const SGPT_GEMS_TXT_COUNT_VA = 0x6fdefbcc
export const SGPT_GEMS_TXT_PTR_VA = 0x6fdefbd0
export const SGPT_BELTS_TXT_COUNT_VA = 0x6fdefd90
export const SGPT_BELTS_TXT_PTR_VA = 0x6fdefd94
export const SGPT_MAGICAFFIX_TXT_COUNT_VA = 0x6fdefbb8
export const SGPT_MAGICAFFIX_TXT_PTR_VA = 0x6fdefbbc
export const SGPT_ITEMS_TXT_COUNT_VA = 0x6fdefb94
export const SGPT_ITEMS_TXT_PTR_VA = 0x6fdefb98
export const SGPT_ITEMS_LINKER_PTR_VA = 0x6fdeff6c
export const SGPT_ARENA_TXT_PTR_VA = 0x6fdf1400
export const SGPT_CHARTEMPLATE_CLASS_START_VA = 0x6fdefa60
export const SGPT_CHARTEMPLATE_TXT_PTR_VA = 0x6fdf13f8
export const SGPT_CHARTEMPLATE_TXT_COUNT_VA = 0x6fdf13fc
export const SGPT_INVENTORY_TXT_MAX_VA = 0x6fdefa58
export const SGPT_INVENTORY_TXT_PTR_VA = 0x6fdefa5c

/** `Fog.dll` `.data` 512-entry `float32` sine/cosine lookup table at `0x6FF7F470` (`Fog.#10084` / `Fog.#10083`). */
export const FOG_TRIG_LUT_VA_113C = 0x6ff7f470

const _f32Buf = new ArrayBuffer(4)
const _f32U32 = new Uint32Array(_f32Buf)
const _f32F32 = new Float32Array(_f32Buf)

function bitsToF32(bits: number): number {
  _f32U32[0] = bits >>> 0
  return _f32F32[0]!
}

function lookupItemsTxtById113c(m: Memory113c, nItemId: number): number {
  if ((nItemId >>> 0) >= m.u32(SGPT_ITEMS_TXT_COUNT_VA)) return 0
  const base = m.u32(SGPT_ITEMS_TXT_PTR_VA)
  if (base === 0) {
    throw new D2CommonAssertError('ItemTbls.cpp', 0x1ef)
  }
  return (base + imul32(nItemId, D2ItemsTxt_SIZE)) >>> 0
}

/** `Fog.#10213` (`0x6FF61F00`): binary-searches sorted 8-byte `{dwCode, nIndex}` table at `pLinker`. */
export function fogGetRowFromTxt113c(
  m: Memory113c,
  pLinker: number,
  dwCode: number,
  _bLogError = 0,
): number {
  const link = pLinker >>> 0
  const esi = m.u32(link) | 0
  const edi = m.u32((link + 0x08) >>> 0)
  if (esi <= 0) return -1
  const ebx = dwCode >>> 0
  let ecx = 0
  let high = esi
  while (ecx < high) {
    const diff = (high - ecx) | 0
    const mid = (ecx + sar32((diff - (diff >> 31)) | 0, 1)) | 0
    const entryCode = m.u32((edi + mid * 8) >>> 0)
    if (ebx > entryCode) {
      ecx = (mid + 1) | 0
    } else if (ebx === entryCode) {
      return m.u32((edi + mid * 8 + 4) >>> 0) | 0
    } else {
      high = mid
    }
  }
  return -1
}

/**
 * `@va D2Common:0x6FD6A330` (`D2Common.#10065` `MONSTER_GetSubClassVelocityInfo`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pOut0`, `[esp+0xC] = pOut1`, `ret 0xC`, void).
 */
export function MONSTER_GetSubClassVelocityInfo113c(
  m: Memory113c,
  pUnit: number,
  pOut0: number,
  pOut1: number,
): void {
  const unitPtr = pUnit >>> 0
  if (unitPtr === 0 || m.get(unitPtr, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) {
    throw new D2CommonAssertError('Monsters.cpp', 0x2bc)
  }
  const nClassId = m.get(unitPtr, D2UnitStrc.dwClassId) | 0
  let idx = 0
  if (nClassId >= 0 && nClassId < (m.u32(SGPT_MONSTATS_TXT_COUNT_VA) | 0)) {
    const pMonStatsTxt = m.u32(SGPT_MONSTATS_TXT_PTR_VA)
    const pRec = (pMonStatsTxt + imul32(nClassId, D2MonStatsTxt_SIZE)) >>> 0
    idx = m.get(pRec, D2MonStatsTxt.nSubClassIndex)
    if (idx >= 4) {
      throw new D2CommonAssertError('Monsters.cpp', 0x2c8)
    }
  }
  m.setU32(pOut0 >>> 0, m.u32((MONSTER_SUBCLASS_VEL_TABLE_VA + idx * 8) >>> 0))
  m.setU32(pOut1 >>> 0, m.u32((MONSTER_SUBCLASS_VEL_TABLE_VA + 4 + idx * 8) >>> 0))
}

/**
 * `@va D2Common:0x6FD72C20` (`D2Common.#10119` `ITEMS_CheckIfUnique`,
 * stdcall `[esp+4] = pItem`, `ret 4` -> `D2ItemsTxt.nUnique (+0x129)`).
 */
export function ITEMS_CheckIfUnique113c(m: Memory113c, pItem: number): number {
  const ptr = pItem >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x9ce)
  }
  if (m.get(ptr, D2UnitStrc.dwUnitType) !== 4) {
    throw new D2CommonAssertError('Items.cpp', 0x9cf)
  }
  const pRec = lookupItemsTxtById113c(m, m.get(ptr, D2UnitStrc.dwClassId))
  if (pRec === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x9d2)
  }
  return m.get(pRec, D2ItemsTxt.nUnique)
}

/**
 * `@va D2Common:0x6FD72C80` (`D2Common.#10478` `ITEMS_CheckIfUseable`,
 * stdcall `[esp+4] = pItem`, `ret 4` -> `D2ItemsTxt.nUseable (+0x11D)` or `0` on NULL / non-item).
 */
export function ITEMS_CheckIfUseable113c(m: Memory113c, pItem: number): number {
  const ptr = pItem >>> 0
  if (ptr === 0 || m.get(ptr, D2UnitStrc.dwUnitType) !== 4) {
    return 0
  }
  const pRec = lookupItemsTxtById113c(m, m.get(ptr, D2UnitStrc.dwClassId))
  if (pRec === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x9c5)
  }
  return m.get(pRec, D2ItemsTxt.nUseable)
}

/**
 * `@va D2Common:0x6FD73050` (`D2Common.#10395` `ITEMS_GetBaseLevel`,
 * stdcall `[esp+4] = pItem`, `ret 4` -> `AL` = `D2ItemsTxt.nLevel (+0xFD)`).
 */
export function ITEMS_GetBaseLevel113c(m: Memory113c, pItem: number): number {
  const ptr = pItem >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x697)
  }
  if (m.get(ptr, D2UnitStrc.dwUnitType) !== 4) {
    throw new D2CommonAssertError('Items.cpp', 0x698)
  }
  const pRec = lookupItemsTxtById113c(m, m.get(ptr, D2UnitStrc.dwClassId))
  if (pRec === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x69b)
  }
  return m.get(pRec, D2ItemsTxt.nLevel)
}

/**
 * `@va D2Common:0x6FD732E0` (`D2Common.#10664` `ITEMS_Get2HandedWClass`,
 * stdcall `[esp+4] = pItem`, `ret 4` -> `D2ItemsTxt.dw2HandedWClass (+0xC4)`).
 */
export function ITEMS_Get2HandedWClass113c(m: Memory113c, pItem: number): number {
  const ptr = pItem >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x609)
  }
  if (m.get(ptr, D2UnitStrc.dwUnitType) !== 4) {
    throw new D2CommonAssertError('Items.cpp', 0x60a)
  }
  const pRec = lookupItemsTxtById113c(m, m.get(ptr, D2UnitStrc.dwClassId))
  if (pRec === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x60d)
  }
  return m.get(pRec, D2ItemsTxt.dw2HandedWClass)
}

/**
 * `@va D2Common:0x6FD8E310` (internal LTCG helper `PATH_GetTargetUnitCoordsWithTrigOffset`,
 * custom reg `edx = pDynamicPath`, `edi = pOutCoordsWordPair`, `ret`, void).
 */
export function PATH_GetTargetUnitCoordsWithTrigOffset113c(
  m: Memory113c,
  edx: number,
  edi: number,
): void {
  const pDynamicPath = edx >>> 0
  const pOut = edi >>> 0
  if (pDynamicPath === 0) {
    throw new D2CommonAssertError('PathUtil.cpp', 0x201)
  }
  let pTargetUnit = m.get(pDynamicPath, D2DynamicPathStrc.pTargetUnit)
  if (pTargetUnit === 0) {
    throw new D2CommonAssertError('PathUtil.cpp', 0x202)
  }
  const unitTypeX = m.get(pTargetUnit, D2UnitStrc.dwUnitType) | 0
  let x = 0
  if (unitTypeX === 2 || (unitTypeX > 3 && unitTypeX <= 5)) {
    const pStaticPath = m.get(pTargetUnit, D2UnitStrc.pPath)
    x = m.get(pStaticPath, D2StaticPathStrc.nPosX) & 0xffff
  } else {
    const pPath = m.get(pTargetUnit, D2UnitStrc.pPath)
    x = pPath !== 0 ? m.get(pPath, D2DynamicPathStrc.wPosX) : 0
  }
  m.setU16(pOut, x)

  pTargetUnit = m.get(pDynamicPath, D2DynamicPathStrc.pTargetUnit)
  const unitTypeY = m.get(pTargetUnit, D2UnitStrc.dwUnitType) | 0
  let y = 0
  if (unitTypeY === 2 || (unitTypeY > 3 && unitTypeY <= 5)) {
    const pStaticPath = m.get(pTargetUnit, D2UnitStrc.pPath)
    y = m.get(pStaticPath, D2StaticPathStrc.nPosY) & 0xffff
  } else {
    const pPath = m.get(pTargetUnit, D2UnitStrc.pPath)
    y = pPath !== 0 ? m.get(pPath, D2DynamicPathStrc.wPosY) : 0
  }
  m.setU16((pOut + 2) >>> 0, y)

  const nDist = m.get(pDynamicPath, D2DynamicPathStrc.nStepAttr)
  if (nDist !== 0) {
    const pTarget2 = m.get(pDynamicPath, D2DynamicPathStrc.pTargetUnit)
    const pTargetPath = m.get(pTarget2, D2UnitStrc.pPath)
    const nTargetDir = pTargetPath !== 0 ? m.get(pTargetPath, D2DynamicPathStrc.nDirection) : 0
    const distByte = m.get(pDynamicPath, D2DynamicPathStrc.nStepAttr)
    const fDist = Math.fround(distByte)
    const angle512 = ((nTargetDir - (distByte << 5)) << 3) & 0x1ff
    const cosBits = m.u32((FOG_TRIG_LUT_VA_113C + ((angle512 + 0x80) & 0x1ff) * 4) >>> 0)
    const dx = Math.trunc(Math.fround(bitsToF32(cosBits) * fDist)) | 0
    m.setU16(pOut, (m.u16(pOut) + dx) & 0xffff)
    const sinBits = m.u32((FOG_TRIG_LUT_VA_113C + angle512 * 4) >>> 0)
    const dy = Math.trunc(Math.fround(bitsToF32(sinBits) * fDist)) | 0
    m.setU16((pOut + 2) >>> 0, (m.u16((pOut + 2) >>> 0) + dy) & 0xffff)
  }
}

/**
 * `@va D2Common:0x6FD8E910` (`D2Common.#10403` `DATATBLS_GetObjGroupTxtRecord`,
 * stdcall `[esp+4] = nIndex`, `ret 4` -> `D2ObjGroupTxt*`).
 */
export function DATATBLS_GetObjGroupTxtRecord113c(m: Memory113c, nIndex: number): number {
  const idx = nIndex | 0
  if (idx >= (m.u32(SGPT_OBJGROUP_TXT_COUNT_VA) | 0)) {
    throw new D2CommonAssertError('ObjectsTbls.cpp', 0x15f)
  }
  if (idx < 0) {
    throw new D2CommonAssertError('ObjectsTbls.cpp', 0x160)
  }
  return (m.u32(SGPT_OBJGROUP_TXT_PTR_VA) + imul32(idx, 0xb8)) >>> 0
}

/**
 * `@va D2Common:0x6FDBC4D0` (internal LTCG helper `DATATBLS_GetLvlSubTxtRecordBySubType`,
 * custom reg `edx = nSubType`, `ret` -> `D2LvlSubTxt*`).
 */
export function DATATBLS_GetLvlSubTxtRecordBySubType113c(m: Memory113c, edx: number): number {
  const nSubType = edx | 0
  if (nSubType < 0) {
    throw new D2CommonAssertError('LvlTbls.cpp', 0x402)
  }
  const pLvlSubTxt = m.u32(SGPT_LVLSUB_TXT_PTR_VA)
  if (pLvlSubTxt === 0) {
    throw new D2CommonAssertError('LvlTbls.cpp', 0x403)
  }
  const pTypeLut = m.u32(SGPT_LVLSUB_TYPE_LUT_PTR_VA)
  if (pTypeLut === 0) {
    throw new D2CommonAssertError('LvlTbls.cpp', 0x404)
  }
  const rowIdx = m.u32((pTypeLut + ((nSubType << 2) >>> 0)) >>> 0) | 0
  return (pLvlSubTxt + imul32(rowIdx, 0x15c)) >>> 0
}

/**
 * `@va D2Common:0x6FDBC5D0` (internal LTCG helper `DATATBLS_GetLvlWarpTxtRecordByIdAndDir`,
 * custom reg `ebx = nWarpId`, `dl = cDirection`, `ret` -> `D2LvlWarpTxt*`).
 */
export function DATATBLS_GetLvlWarpTxtRecordByIdAndDir113c(
  m: Memory113c,
  ebx: number,
  edx: number,
): number {
  const pLvlWarpTxt = m.u32(SGPT_LVLWARP_TXT_PTR_VA)
  if (pLvlWarpTxt === 0) {
    throw new D2CommonAssertError('LvlTbls.cpp', 0x32b)
  }
  const nCount = m.u32(SGPT_LVLWARP_TXT_COUNT_VA) | 0
  const targetId = ebx >>> 0
  const dirByte = edx & 0xff
  let pRec = pLvlWarpTxt
  for (let i = 0; i < nCount; i = (i + 1) | 0) {
    if (m.u32(pRec) === targetId) {
      if (dirByte === 0x62) {
        return pRec
      }
      const recDir = m.u8((pRec + 0x2c) >>> 0)
      if (recDir === 0x62 || recDir === dirByte) {
        return pRec
      }
    }
    pRec = (pRec + 0x30) >>> 0
  }
  throw new D2CommonAssertError('LvlTbls.cpp', 0x33a)
}

/**
 * `@va D2Common:0x6FDC1430` (`D2Common.#10961` `DATATBLS_GetBooksTxtRecord`,
 * stdcall `[esp+4] = nIndex`, `ret 4` -> `D2BooksTxt*` or `0`).
 */
export function DATATBLS_GetBooksTxtRecord113c(m: Memory113c, nIndex: number): number {
  const idx = nIndex | 0
  if (idx >= (m.u32(SGPT_BOOKS_TXT_COUNT_VA) | 0) || idx === -1) {
    return 0
  }
  const pBase = m.u32(SGPT_BOOKS_TXT_PTR_VA)
  if (pBase === 0) {
    throw new D2CommonAssertError('ItemTbls.cpp', 0x5d0)
  }
  const res = (pBase + imul32(idx, 0x22)) >>> 0
  if (res === 0) {
    throw new D2CommonAssertError('ItemTbls.cpp', 0x5d1)
  }
  return res
}

/**
 * `@va D2Common:0x6FDC14D0` (`D2Common.#11065` `DATATBLS_GetQualityItemsTxtRecord`,
 * stdcall `[esp+4] = nIndex`, `ret 4` -> `D2QualityItemsTxt*` or `0`).
 */
export function DATATBLS_GetQualityItemsTxtRecord113c(m: Memory113c, nIndex: number): number {
  const idx = nIndex | 0
  if (idx >= (m.u32(SGPT_QUALITYITEMS_TXT_COUNT_VA) | 0) || idx === -1) {
    return 0
  }
  const pBase = m.u32(SGPT_QUALITYITEMS_TXT_PTR_VA)
  if (pBase === 0) {
    throw new D2CommonAssertError('ItemTbls.cpp', 0x59c)
  }
  const res = (pBase + ((idx << 5) >>> 0)) >>> 0
  if (res === 0) {
    throw new D2CommonAssertError('ItemTbls.cpp', 0x59d)
  }
  return res
}

/**
 * `@va D2Common:0x6FDC1570` (`D2Common.#10806` `DATATBLS_GetGemsTxtRecord`,
 * stdcall `[esp+4] = nIndex`, `ret 4` -> `D2GemsTxt*` or `0`).
 */
export function DATATBLS_GetGemsTxtRecord113c(m: Memory113c, nIndex: number): number {
  const idx = nIndex | 0
  if (idx >= (m.u32(SGPT_GEMS_TXT_COUNT_VA) | 0) || idx === -1) {
    return 0
  }
  const pBase = m.u32(SGPT_GEMS_TXT_PTR_VA)
  if (pBase === 0) {
    throw new D2CommonAssertError('ItemTbls.cpp', 0x563)
  }
  const res = (pBase + imul32(idx, 0xc0)) >>> 0
  if (res === 0) {
    throw new D2CommonAssertError('ItemTbls.cpp', 0x564)
  }
  return res
}

/**
 * `@va D2Common:0x6FDC1610` (`D2Common.#11007` `DATATBLS_GetBeltsTxtRecord`,
 * stdcall `[esp+4] = nIndex`, `ret 4` -> `D2BeltsTxt*` or `0`).
 */
export function DATATBLS_GetBeltsTxtRecord113c(m: Memory113c, nIndex: number): number {
  const idx = nIndex | 0
  if (idx >= (m.u32(SGPT_BELTS_TXT_COUNT_VA) | 0) || idx === -1) {
    return 0
  }
  const pBase = m.u32(SGPT_BELTS_TXT_PTR_VA)
  if (pBase === 0) {
    throw new D2CommonAssertError('ItemTbls.cpp', 0x4f2)
  }
  const res = (pBase + imul32(idx, 0x70)) >>> 0
  if (res === 0) {
    throw new D2CommonAssertError('ItemTbls.cpp', 0x4f3)
  }
  return res
}

/**
 * `@va D2Common:0x6FDC1820` (`D2Common.#10248` `DATATBLS_GetMagicAffixTxtRecord`,
 * stdcall `[esp+4] = nIndex1Based`, `ret 4` -> `D2MagicAffixTxt*` or `0`).
 */
export function DATATBLS_GetMagicAffixTxtRecord113c(m: Memory113c, nIndex: number): number {
  const pBase = m.u32(SGPT_MAGICAFFIX_TXT_PTR_VA)
  if (pBase === 0) {
    throw new D2CommonAssertError('ItemTbls.cpp', 0x2c8)
  }
  const idx = nIndex | 0
  if (idx > (m.u32(SGPT_MAGICAFFIX_TXT_COUNT_VA) | 0) || idx <= 0) {
    return 0
  }
  return (pBase + imul32(idx, 0x90) - 0x90) >>> 0
}

/**
 * `@va D2Common:0x6FDC1960` (`D2Common.#10450` `DATATBLS_GetItemsTxtRecordByCode`,
 * stdcall `[esp+4] = dwCode`, `[esp+8] = pOutIndex`, `ret 8` -> `D2ItemsTxt*` or `0`).
 */
export function DATATBLS_GetItemsTxtRecordByCode113c(
  m: Memory113c,
  dwCode: number,
  pOutIndex: number,
): number {
  const idx = fogGetRowFromTxt113c(m, m.u32(SGPT_ITEMS_LINKER_PTR_VA), dwCode >>> 0, 0) | 0
  if (idx < 0) {
    m.setU32(pOutIndex >>> 0, 0)
    return 0
  }
  m.setU32(pOutIndex >>> 0, idx >>> 0)
  return (m.u32(SGPT_ITEMS_TXT_PTR_VA) + imul32(idx, D2ItemsTxt_SIZE)) >>> 0
}

/**
 * `@va D2Common:0x6FDCFF80` (`D2Common.#10827` `DATATBLS_GetArenaTxtRecord`,
 * `__fastcall(ecx = nArenaType)` -> `D2ArenaTxt*`, `ret`).
 */
export function DATATBLS_GetArenaTxtRecord113c(m: Memory113c, ecx: number): number {
  const idx = ecx | 0
  if (idx >= 1) {
    throw new D2CommonAssertError('ArenaTbls.cpp', 0x41)
  }
  return (m.u32(SGPT_ARENA_TXT_PTR_VA) + imul32(idx, 0x1c)) >>> 0
}

/**
 * `@va D2Common:0x6FDCFFB0` (`D2Common.#10241` `DATATBLS_GetCharTemplateStartLevel`,
 * `__fastcall(ecx = nTemplate, edx = nClass)` -> `uint32_t`, `ret`).
 */
export function DATATBLS_GetCharTemplateStartLevel113c(
  m: Memory113c,
  ecx: number,
  edx: number,
): number {
  const nTemplate = ecx | 0
  const nClass = edx | 0
  if (nTemplate <= 0) {
    throw new D2CommonAssertError('CharTemplateTbls.cpp', 0xf5)
  }
  const baseIdx = m.u32((SGPT_CHARTEMPLATE_CLASS_START_VA + ((nClass << 2) >>> 0)) >>> 0) | 0
  const idx = (baseIdx + nTemplate - 1) | 0
  if (idx >= (m.u32(SGPT_CHARTEMPLATE_TXT_COUNT_VA) | 0)) {
    throw new D2CommonAssertError('CharTemplateTbls.cpp', 0xf8)
  }
  return m.u8((m.u32(SGPT_CHARTEMPLATE_TXT_PTR_VA) + imul32(idx, 0xf0) + 0x1e) >>> 0)
}

/**
 * `@va D2Common:0x6FDD1FB0` (`D2Common.#10760` `DATATBLS_GetInventoryGridInfo`,
 * stdcall `[esp+4] = nIndex`, `[esp+8] = nMode`, `[esp+0xC] = pOutGridInfo`, `ret 0xC`, void).
 */
export function DATATBLS_GetInventoryGridInfo113c(
  m: Memory113c,
  nIndex: number,
  nMode: number,
  pOutGridInfo: number,
): void {
  const idx = ((nMode << 4) + nIndex) >>> 0
  const pBase = m.u32(SGPT_INVENTORY_TXT_PTR_VA)
  if (pBase === 0) {
    throw new D2CommonAssertError('InvTbls.cpp', 0x7f)
  }
  if (idx > m.u32(SGPT_INVENTORY_TXT_MAX_VA)) {
    throw new D2CommonAssertError('InvTbls.cpp', 0x97)
  }
  const pRec = (pBase + imul32(idx | 0, 0xf0)) >>> 0
  if (pRec === 0) {
    throw new D2CommonAssertError('InvTbls.cpp', 0x97)
  }
  const out = pOutGridInfo >>> 0
  const src = (pRec + 0x10) >>> 0
  m.setU32(out, m.u32(src))
  m.setU32((out + 0x04) >>> 0, m.u32((src + 0x04) >>> 0))
  m.setU32((out + 0x08) >>> 0, m.u32((src + 0x08) >>> 0))
  m.setU32((out + 0x0c) >>> 0, m.u32((src + 0x0c) >>> 0))
  m.setU32((out + 0x10) >>> 0, m.u32((src + 0x10) >>> 0))
  m.setU32((out + 0x14) >>> 0, m.u32((src + 0x14) >>> 0))
}

// ============================================================================
// Batch B039 & B049 — datatbls-113c.ts functions (B039-01, B039-03, B049-13)
// ============================================================================

/**
 * `@va D2Common:0x6FD72F20` (`D2Common.#10696` `ITEMS_GetQuiverType`,
 * stdcall `[esp+4] = pItem`, `ret 4`, `retMask: 0xFF` -> `AL` = `D2ItemsTxt + 0x104` or `0`).
 * Note: binary has no `pRec == 0` guard after `0x6FDC19A0` and reads `BYTE PTR [eax+0x104]` directly.
 */
export function ITEMS_GetQuiverType113c(m: Memory113c, pItem: number): number {
  const ptr = pItem >>> 0
  if (ptr === 0) return 0
  if (m.get(ptr, D2UnitStrc.dwUnitType) !== 4) return 0
  const pRec = lookupItemsTxtById113c(m, m.get(ptr, D2UnitStrc.dwClassId))
  return m.u8((pRec + 0x104) >>> 0)
}

/**
 * `@va D2Common:0x6FD73330` (`D2Common.#10238` `ITEMS_GetWeaponClassCode`,
 * stdcall `[esp+4] = pItem`, `ret 4` -> `D2ItemsTxt.dwWClass (+0xC0)` or `0`).
 */
export function ITEMS_GetWeaponClassCode113c(m: Memory113c, pItem: number): number {
  const ptr = pItem >>> 0
  if (ptr === 0) return 0
  if (m.get(ptr, D2UnitStrc.dwUnitType) !== 4) return 0
  const pRec = lookupItemsTxtById113c(m, m.get(ptr, D2UnitStrc.dwClassId))
  if (pRec === 0) return 0
  return m.u32((pRec + 0xc0) >>> 0)
}

/**
 * `@va D2Common:0x6FD7D660` (internal helper `DRLG_ValidateAndRebaseLevelRooms`,
 * stdcall `[esp+4] = pLevel`, `ret 4`, void).
 * Note: uses stack-free bbox computation identical to `0x6FD7D3C0` so no scratch heap writes
 * pollute `StrictMem` diff verification.
 */
export function DRLG_ValidateAndRebaseLevelRooms113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  if (lvl === 0) {
    throw new D2CommonAssertError('Drlg.cpp', 0x2e3)
  }
  const firstRoom = m.get(lvl, D2DrlgLevelStrc.pFirstRoomEx)
  if (firstRoom === 0) {
    throw new D2CommonAssertError('Drlg.cpp', 0x2e4)
  }
  // 0x6FD7D3C0 seeds the box from the first room (0x6FD7D3C7..0x6FD7D3E2: min = pos, max = pos + size)
  // before widening it over every room (signed `jle`/`jge`).
  const seedX = m.get(firstRoom, D2RoomExStrc.nTileXPos) | 0
  const seedY = m.get(firstRoom, D2RoomExStrc.nTileYPos) | 0
  let minX = seedX
  let minY = seedY
  let maxX = (seedX + (m.get(firstRoom, D2RoomExStrc.nTileWidth) | 0)) | 0
  let maxY = (seedY + (m.get(firstRoom, D2RoomExStrc.nTileHeight) | 0)) | 0
  for (let r = firstRoom; r !== 0; r = m.get(r, D2RoomExStrc.pRoomNext)) {
    const rx = m.get(r, D2RoomExStrc.nTileXPos) | 0
    if (rx < minX) minX = rx
    const ry = m.get(r, D2RoomExStrc.nTileYPos) | 0
    if (ry < minY) minY = ry
    const rxEnd = (rx + (m.get(r, D2RoomExStrc.nTileWidth) | 0)) | 0
    if (rxEnd > maxX) maxX = rxEnd
    const ryEnd = (ry + (m.get(r, D2RoomExStrc.nTileHeight) | 0)) | 0
    if (ryEnd > maxY) maxY = ryEnd
  }
  const spanX = (maxX - minX) | 0
  if ((m.get(lvl, D2DrlgLevelStrc.nWidth) | 0) < spanX) {
    throw new D2CommonAssertError('Drlg.cpp', 0x2eb)
  }
  const spanY = (maxY - minY) | 0
  if ((m.get(lvl, D2DrlgLevelStrc.nHeight) | 0) < spanY) {
    throw new D2CommonAssertError('Drlg.cpp', 0x2ec)
  }
  for (let r = m.get(lvl, D2DrlgLevelStrc.pFirstRoomEx); r !== 0; r = m.get(r, D2RoomExStrc.pRoomNext)) {
    const newX = ((m.get(r, D2RoomExStrc.nTileXPos) | 0) + ((m.get(lvl, D2DrlgLevelStrc.nPosX) | 0) - minX)) >>> 0
    m.set(r, D2RoomExStrc.nTileXPos, newX)
    const newY = ((m.get(r, D2RoomExStrc.nTileYPos) | 0) + ((m.get(lvl, D2DrlgLevelStrc.nPosY) | 0) - minY)) >>> 0
    m.set(r, D2RoomExStrc.nTileYPos, newY)
  }
}

// ============================================================================
// K1r3 Iteration 9 Lane B — Batch I9B-B (datatbls-113c.ts)
// ============================================================================

/**
 * `@va D2Common:0x6FDCF670` (`D2Common.#10329`, `__fastcall(ecx = pUnit, edx = nArg0, [esp+4] = nArg1,
 * [esp+8] = nArg2) -> void`, `ret 8`).
 *
 * - Returns if `pUnit == 0` or `pUnit->dwUnitType != 0` (`mov ecx, [eax]; test ecx, ecx; jne`).
 * - `pPlayerData = pUnit->pUnitData (+0x14)`; if non-zero stores `pPlayerData->dwField150 = 1`
 *   (`mov dword [ecx+0x150], 1` at 0x6FDCF683) before the callee repeats the same store.
 * - Calls `PLAYER_SetPlayerData150Params113c(pUnit, nArg0, nArg1, nArg2)` (`push [a2]; push [a1]; push edx;
 *   call 0x6FD51000` at 0x6FDCF68D..0x6FDCF698, `eax = pUnit`).
 */
export function PLAYER_SetPlayerData150ParamsExport113c(
  m: Memory113c,
  pUnit: number,
  nArg0: number,
  nArg1: number,
  nArg2: number,
): void {
  const u = pUnit >>> 0
  if (u === 0) return
  if (m.get(u, D2UnitStrc.dwUnitType) !== 0) return
  const pPlayerData = m.get(u, D2UnitStrc.pUnitData)
  if (pPlayerData !== 0) {
    m.set(pPlayerData, D2PlayerDataStrc.dwField150, 1)
  }
  PLAYER_SetPlayerData150Params113c(m, u, nArg0, nArg1, nArg2)
}

// ============================================================================
// K1r7 Iteration 10 Lane B — Batch I10B-2 (datatbls-113c.ts)
// ============================================================================

const ITEMRATIO_TXT_COUNT_VA_113C = 0x6fdefd88
const ITEMRATIO_TXT_PTR_VA_113C = 0x6fdefd8c
const ITEMRATIO_RECORD_STRIDE_113C = 0x44
const ITEMRATIO_OFF_VERSION_113C = 0x40
const ITEMRATIO_REL_UBER_113C = 2
const ITEMRATIO_REL_CLASSSPEC_113C = 3
const ASSERT_LINE_ITEMRATIO_VER_113C = 0x61d

/**
 * `@va D2Common:0x6FDC4000` (`D2Common.#10560` `DATATBLS_GetItemRatioTxtRecord113c`,
 * `__stdcall(nItemId, _unused, wVersion) -> D2ItemRatioTxt*`, `ret 0xC`).
 */
export function DATATBLS_GetItemRatioTxtRecord113c(
  m: Memory113c,
  nItemId: number,
  _unused: number,
  wVersion: number,
): number {
  const bClassSpec = ITEMS_CheckItemTypeRarityUnder7113c(m, nItemId) | 0
  const bUber = ITEMS_IsUberOrUltraArmorOrWeapon113c(m, nItemId) | 0
  const ver16 = wVersion & 0xffff
  if (ver16 !== 0 && ver16 !== 0x64) {
    throw new D2CommonAssertError('ItemTbls.cpp', ASSERT_LINE_ITEMRATIO_VER_113C)
  }
  let count = m.u32(ITEMRATIO_TXT_COUNT_VA_113C) | 0
  if (count <= 0) return 0
  let recPtr = (m.u32(ITEMRATIO_TXT_PTR_VA_113C) + ITEMRATIO_OFF_VERSION_113C) >>> 0
  let bestVer = -1
  let bestIdx = -1
  for (let i = 0; i < count; i++) {
    if (
      m.u8((recPtr + ITEMRATIO_REL_CLASSSPEC_113C) >>> 0) === bClassSpec &&
      m.u8((recPtr + ITEMRATIO_REL_UBER_113C) >>> 0) === bUber
    ) {
      const recVer = m.u16(recPtr)
      if (recVer <= ver16 && recVer >= bestVer) {
        bestVer = recVer
        bestIdx = i
      }
    }
    count = m.u32(ITEMRATIO_TXT_COUNT_VA_113C) | 0
    recPtr = (recPtr + ITEMRATIO_RECORD_STRIDE_113C) >>> 0
  }
  if (bestIdx < 0) return 0
  return (m.u32(ITEMRATIO_TXT_PTR_VA_113C) + imul32(bestIdx, ITEMRATIO_RECORD_STRIDE_113C)) >>> 0
}

