/**
 * 1.13c `MonStats.txt` hostile monster kill eligibility (`D2Game.dll` `0x6fcacd52..0x6fcacdb8`).
 *
 * Excludes:
 * - `killable === false` (checked via `getMonsterKindByClassId(hcIdx)`)
 * - `Align !== 0` (115 rows: summons, hirelings, traps, town guards, critters, Act 5 POWs)
 * - `neverCount !== 0` (77 rows: bone prison, windows, trapped souls, barricade doors/walls, familiars)
 */

import { getMonsterKindByClassId } from '../../src/common/units/monsters-data.ts'

export const MONSTATS_MAX_HCIDX = 733

/**
 * Exact 115 `hcIdx` values from 1.13c MPQ `data\global\excel\MonStats.txt` where `Align !== 0`.
 */
export const MONSTATS_ALIGN_NONZERO_HCIDX: ReadonlySet<number> = new Set<number>([
  146, 147, 148, 150, 151, 152, 154, 155, 157, 158,
  159, 175, 176, 177, 178, 179, 185, 195, 196, 197,
  198, 199, 200, 201, 202, 203, 204, 205, 210, 227,
  244, 245, 246, 251, 252, 253, 254, 255, 257, 264,
  265, 266, 268, 269, 270, 271, 272, 289, 290, 291,
  292, 294, 296, 297, 318, 319, 320, 331, 338, 344,
  351, 352, 353, 356, 357, 358, 359, 363, 364, 367,
  377, 378, 405, 406, 408, 410, 411, 412, 413, 414,
  415, 416, 417, 418, 419, 420, 421, 422, 423, 424,
  425, 426, 427, 428, 429, 430, 431, 511, 512, 513,
  514, 515, 520, 521, 522, 523, 527, 534, 535, 536,
  537, 538, 539, 560, 561,
])

/**
 * Exact 77 `hcIdx` values from 1.13c MPQ `data\global\excel\MonStats.txt` where `neverCount !== 0`.
 */
export const MONSTATS_NEVER_COUNT_HCIDX: ReadonlySet<number> = new Set<number>([
  153, 251, 270, 271, 289, 290, 291, 292, 293, 297,
  326, 327, 328, 329, 330, 332, 340, 341, 342, 343,
  344, 351, 352, 353, 355, 356, 357, 358, 363, 364,
  366, 368, 369, 392, 393, 401, 403, 404, 410, 411,
  412, 413, 414, 415, 416, 417, 418, 419, 420, 421,
  422, 423, 424, 425, 426, 427, 428, 432, 433, 434,
  522, 523, 524, 525, 535, 536, 537, 538, 539, 545,
  559, 560, 561, 567, 568, 569, 574,
])

/**
 * Returns `true` iff `hcIdx` (`0..733`) is a countable hostile monster class in 1.13c:
 * - `getMonsterKindByClassId(hcIdx)` exists and has `killable === true`
 * - `hcIdx` is not in `MONSTATS_ALIGN_NONZERO_HCIDX`
 * - `hcIdx` is not in `MONSTATS_NEVER_COUNT_HCIDX`
 */
export function isCountableKillClass(hcIdx: number): boolean {
  if (!Number.isInteger(hcIdx) || hcIdx < 0 || hcIdx > MONSTATS_MAX_HCIDX) {
    return false
  }
  if (MONSTATS_ALIGN_NONZERO_HCIDX.has(hcIdx) || MONSTATS_NEVER_COUNT_HCIDX.has(hcIdx)) {
    return false
  }
  const kind = getMonsterKindByClassId(hcIdx)
  return kind !== undefined && kind.killable === true
}

/**
 * Returns `true` iff `hcIdx` is one of the 24 countable `MonStats.txt` rows with `boss === true`.
 */
export function isCountableBossClass(hcIdx: number): boolean {
  if (!isCountableKillClass(hcIdx)) return false
  const kind = getMonsterKindByClassId(hcIdx)
  return kind?.boss === true
}
