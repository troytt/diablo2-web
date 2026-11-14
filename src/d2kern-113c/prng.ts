/**
 * Diablo II v1.13c 64-bit LCG PRNG (D2SeedStrc).
 *
 * Ground truth from D2Common.dll / D2Game.dll:
 *   SEED_Next(D2SeedStrc* pSeed) -> int32:
 *     uint64_t v = (uint64_t)pSeed->lo * 0x6AC690C5ULL + pSeed->hi;
 *     pSeed->lo = (uint32_t)v;
 *     pSeed->hi = (uint32_t)(v >> 32);
 *     return (int32_t)pSeed->lo;
 *
 *   SEED_Roll(D2SeedStrc* pSeed, uint32_t nMax) -> uint32_t:
 *     if (nMax == 0) return 0;
 *     uint32_t raw = (uint32_t)SEED_Next(pSeed);
 *     return raw % nMax;
 */

import type { Memory113c } from './mem/sparse-memory.ts'
import { DRLGOUTDOORS_SpawnPresetInGrid113c } from './common/drlg/drlg-grid.ts'
import { D2CommonAssertError, SEED_RollRandomNumberInline113c } from './common/inline-helpers.ts'
import { imul32 } from './common/int-math.ts'

export interface D2SeedStrc {
  lo: number // uint32
  hi: number // uint32
}

const MULT = 0x6ac690c5n

export function seedInit(lo: number, hi: number = 0): D2SeedStrc {
  return {
    lo: lo >>> 0,
    hi: hi >>> 0,
  }
}

export function seedNext(seed: D2SeedStrc): number {
  const loBig = BigInt(seed.lo >>> 0)
  const hiBig = BigInt(seed.hi >>> 0)
  const prod = loBig * MULT + hiBig
  seed.lo = Number(prod & 0xffffffffn) >>> 0
  seed.hi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  return (seed.lo | 0) // signed 32-bit int
}

/**
 * `SEED_RollLimited` (`D2Game:0x6FC21180` / `D2Common.#10920 @ 0x6FD510B0`).
 * @va D2Game:0x6FC21180
 * @va D2Common:0x6FD510B0
 */
export function seedRoll(seed: D2SeedStrc, nMax: number): number {
  const max = nMax | 0
  if (max <= 0) return 0
  const raw = seedNext(seed) >>> 0
  return (raw % (max >>> 0)) >>> 0
}

export const seedRollLimited113c = seedRoll

/**
 * `@va D2Common:0x6FD86740` (`D2Common.#10614` `SEED_InitLowSeed`,
 * fastcall `ecx = pSeed`, `edx = nLowSeed`, plain `ret`, void).
 *
 * Writes `pSeed->nLowSeed = nLowSeed` (`+0x00`) and `pSeed->nHighSeed = 0x29A` (`666`, `+0x04`).
 */
export function SEED_InitLowSeed113c(m: Memory113c, pSeed: number, nLowSeed: number): void {
  const s = pSeed >>> 0
  m.setU32(s, nLowSeed >>> 0)
  m.setU32((s + 4) >>> 0, 0x29a)
}

/**
 * `@va D2Common:0x6FD86750` (`D2Common.#10936` `SEED_InitSeed`,
 * fastcall `ecx = pSeed`, plain `ret`, void).
 *
 * Writes `pSeed->nLowSeed = 1` (`+0x00`) and `pSeed->nHighSeed = 0x29A` (`666`, `+0x04`).
 */
export function SEED_InitSeed113c(m: Memory113c, pSeed: number): void {
  const s = pSeed >>> 0
  m.setU32(s, 1)
  m.setU32((s + 4) >>> 0, 0x29a)
}

const PATH_WF_ASSERT_FILE_113C = '..\\Source\\D2Common\\PATH\\PathWF.cpp'

/**
 * `@va D2Common:0x6FD69A50` (`SEED_PickRandomListNode`,
 * custom LTCG `eax = pOwner`, plain `ret` -> `pNode`).
 *
 * Asserts `pOwner != NULL` (`PathWF.cpp:0x13E`) and `pOwner->pFirst (+0x10) != NULL` (`PathWF.cpp:0x13F`),
 * rolls `k = SEED_RollRandomNumberInline(&pOwner->seed (+0x1C4), pOwner->nCount (+0x08))`,
 * and advances `pNode = pOwner->pFirst (+0x10)` via `pNode = pNode->pNext (+0x24)` `k` times
 * (`while (k != 0) { pNode = [pNode + 0x24]; k--; }`).
 */
export function SEED_PickRandomListNode113c(m: Memory113c, pOwner: number): number {
  const owner = pOwner >>> 0
  if (owner === 0) {
    throw new D2CommonAssertError(PATH_WF_ASSERT_FILE_113C, 0x13e)
  }
  if (m.u32((owner + 0x10) >>> 0) === 0) {
    throw new D2CommonAssertError(PATH_WF_ASSERT_FILE_113C, 0x13f)
  }
  const nMax = m.u32((owner + 0x08) >>> 0) | 0
  let k = SEED_RollRandomNumberInline113c(m, (owner + 0x1c4) >>> 0, nMax) | 0
  let pNode = m.u32((owner + 0x10) >>> 0)
  while (k !== 0) {
    pNode = m.u32((pNode + 0x24) >>> 0)
    k = (k - 1) | 0
  }
  return pNode >>> 0
}

const OUT_JUNG_ASSERT_FILE_113C = '..\\Source\\D2Common\\DRLG\\OutJung.cpp'

/**
 * `.rdata` `0x6FDE01B0..0x6FDE01B8` (`0x6FDE0080 + 0x4C*4`): level preset base offsets for levels `0x4C..0x4E`.
 */
const JUNG_PRESET_OFFSET_6FDE0080 = Int32Array.from([0, 10, 20])

/**
 * `.rdata` `0x6FDE0168..0x6FDE01AF` (`6 × 3` `int32` permutation table for special jungle presets).
 */
const JUNG_PERM_TABLE_6FDE0168 = Int32Array.from([
  0, 1, 2,
  1, 0, 2,
  0, 2, 1,
  1, 2, 0,
  2, 0, 1,
  2, 1, 0,
])

/**
 * `@va D2Common:0x6FDD54C0` (`DRLGOUTJUNG_BuildJunglePresets`,
 * custom LTCG `esi = pLevel`, plain `ret`, void).
 *
 * Populates Act 3 jungle presets (`dwLevelId` in `0x4C..0x4E` / `76..78`: Spider Forest, Great Marsh, Flayer Jungle):
 * - Computes `blocksX = pDef76->dwSizeX[diff] / 32` and `blocksY = pDef76->dwSizeY[diff] / 32` (`pDef76 = sgpLevelsTxt + 0x2E50` when `nLevelsTxtRecordCount > 0x4C`, else `0`).
 * - Rolls `permIdx = SEED_RollRandomNumberInline(&pLevel->sSeed (+0x1C4), pLevel->nLevelType (+0x1B8) == 3 ? 6 : 2)`.
 * - Asserts `pLevel->pJungDefs (+0x1BC) != 0` at `OutJung.cpp:0x27` (`39`).
 * - Iterates `by = 0 .. blocksY - 1`:
 *   - For `dwLevelId == 0x4C && by == blocksY - 1`, spawns preset `0x23D` at `(0, by * 4)` with `nPickedFile = (pJungDefs[blocksY * blocksX - 1] == 0 ? 1 : 0)` and advances `defCursor += 2`.
 *   - For `dwLevelId == 0x4E && by == 0`, spawns preset `0x23E` at `(0, 0)` with `nPickedFile = (pJungDefs[1] == 0 ? 1 : 0)` and advances `defCursor += 2`.
 *   - Otherwise iterates `bx = 0 .. blocksX - 1`, reading `prestId = pJungDefs[defCursor++]`; if `prestId > 0x23E`, asserts `specialIdx < 3` at `OutJung.cpp:0x47` (`71`), adds `JUNG_PRESET_OFFSET_6FDE0080[dwLevelId - 0x4C]`, and picks `pickedFile = JUNG_PERM_TABLE_6FDE0168[permIdx * 3 + specialIdx++]`. Calls `DRLGOUTDOORS_SpawnPresetInGrid113c(pLevel, bx * 4, by * 4, prestId, pickedFile, 0)` when `prestId != 0`.
 */
export function DRLGOUTJUNG_BuildJunglePresets113c(m: Memory113c, pLevel: number): void {
  const esi = pLevel >>> 0
  const lvlId0 = m.u32((esi + 0x1d0) >>> 0) | 0
  if (lvlId0 < 0x4c || lvlId0 > 0x4e) return

  const sgpt = m.u32(0x6fde9e1c)
  const pDef76 =
    (m.u32((sgpt + 0xc5c) >>> 0) | 0) > 0x4c ? (m.u32(0x6fdf0b38) + 0x2e50) >>> 0 : 0
  const pDrlg = m.u32((esi + 0x1b4) >>> 0)
  const diff = m.u8((pDrlg + 0x450) >>> 0)
  const rawX = m.u32((pDef76 + diff * 4 + 0x0c) >>> 0) | 0
  const blocksX = (rawX + ((rawX >> 31) & 0x1f)) >> 5
  const rawY = m.u32((pDef76 + diff * 4 + 0x18) >>> 0) | 0
  const nLevelType = m.u32((esi + 0x1b8) >>> 0) | 0
  const blocksY = (rawY + ((rawY >> 31) & 0x1f)) >> 5
  const nRollMax = nLevelType === 3 ? 6 : 2
  const permIdx = SEED_RollRandomNumberInline113c(m, (esi + 0x1c4) >>> 0, nRollMax) | 0

  if (m.u32((esi + 0x1bc) >>> 0) === 0) {
    throw new D2CommonAssertError(OUT_JUNG_ASSERT_FILE_113C, 0x27)
  }
  if (blocksY <= 0) return

  let defCursor = 0
  let specialIdx = 0
  for (let by = 0; by < blocksY; by = (by + 1) | 0) {
    const curLvl = m.u32((esi + 0x1d0) >>> 0) | 0
    if (curLvl === 0x4c && by === ((blocksY - 1) | 0)) {
      const pDefs = m.u32((esi + 0x1bc) >>> 0)
      const lastIdx = imul32(blocksY, blocksX)
      const lastCell = m.u32((pDefs + lastIdx * 4 - 4) >>> 0)
      DRLGOUTDOORS_SpawnPresetInGrid113c(m, esi, 0, (by * 4) | 0, 0x23d, lastCell === 0 ? 1 : 0, 0)
      defCursor = (defCursor + 2) | 0
      continue
    }
    if (curLvl === 0x4e && by === 0) {
      const pDefs = m.u32((esi + 0x1bc) >>> 0)
      const cell1 = m.u32((pDefs + 4) >>> 0)
      DRLGOUTDOORS_SpawnPresetInGrid113c(m, esi, 0, 0, 0x23e, cell1 === 0 ? 1 : 0, 0)
      defCursor = (defCursor + 2) | 0
      continue
    }
    for (let bx = 0; bx < blocksX; bx = (bx + 1) | 0) {
      const pDefs = m.u32((esi + 0x1bc) >>> 0)
      let prestId = m.u32((pDefs + defCursor * 4) >>> 0) | 0
      defCursor = (defCursor + 1) | 0
      let pickedFile = -1
      if (prestId > 0x23e) {
        if (specialIdx >= 3) {
          throw new D2CommonAssertError(OUT_JUNG_ASSERT_FILE_113C, 0x47)
        }
        const lvlNow = m.u32((esi + 0x1d0) >>> 0) | 0
        prestId = (prestId + JUNG_PRESET_OFFSET_6FDE0080[(lvlNow - 0x4c) | 0]!) | 0
        pickedFile = JUNG_PERM_TABLE_6FDE0168[(permIdx * 3 + specialIdx) | 0]!
        specialIdx = (specialIdx + 1) | 0
      }
      if (prestId !== 0) {
        DRLGOUTDOORS_SpawnPresetInGrid113c(
          m,
          esi,
          (bx * 4) | 0,
          (by * 4) | 0,
          prestId,
          pickedFile,
          0,
        )
      }
    }
  }
}
