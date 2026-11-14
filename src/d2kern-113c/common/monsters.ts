/**
 * Diablo II v1.13c `D2Common.dll` monster helper leaf functions (`Monsters.cpp` block, image base `0x6FD50000`).
 *
 * Binary evidence (`objdump -d -M intel` on 1.13c `D2Common.dll`):
 * - `0x6FD6A660`: `MONSTERS_IsTownOrFriendlyUnit` (LTCG `edx = pUnit`, plain `ret` -> `0` or `1`)
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import { D2MonStatsTxt, D2MonStatsTxt_SIZE, D2UnitStrc } from '../mem/layout.generated.ts'
import { DATATBLS_GetCompCodeString113c } from '../tables/datatbls-113c.ts'
import { DRLG_GetActNoFromLevelId113c } from './drlg/drlg.ts'
import { DUNGEON_GetLevelIdFromRoom113c } from './dungeon.ts'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  DATATABLES_OFF_113C,
  DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline113c,
  DATATBLS_ValidateMonStatsIdInline113c,
  MONSTERS_GetBaseIdFromMonsterUnitInline113c,
} from './inline-helpers.ts'
import { imul32 } from './int-math.ts'
import { UNITS_GetRoom113c } from './unit.ts'

const UNIT_MONSTER = 1

/**
 * `@va D2Common:0x6FD6A660` (`MONSTERS_IsTownOrFriendlyUnit`,
 * internal LTCG `edx = pUnit`, plain `ret` -> `0` or `1`).
 *
 * Checks `pUnit != NULL && pUnit->dwUnitType == 1` (`0x6FD6A660..0x6FD6A669`), looks up the
 * `D2MonStatsTxt` record for `pUnit->dwClassId` via `sgptDataTables` (`+0xA78` / `+0xA80`, stride `0x1A8`),
 * tests `bFlags1 (+0x0D)` against `gdwBitMasks[0]` (`0x01`, `isSpawn`) and `gdwBitMasks[2]` (`0x04`, `inTown`)
 * (`0x6FD6A69A..0x6FD6A6B2`), and otherwise returns `(pUnit->dwFlags (+0xC4) >>> 31) !== 0 ? 1 : 0`.
 */
export function MONSTERS_IsTownOrFriendlyUnit113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  if (m.get(u, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return 0

  const classId = m.get(u, D2UnitStrc.dwClassId) | 0
  if (classId < 0) return 0

  const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const count = m.u32((dt + DATATABLES_OFF_113C.nMonStatsTxtRecordCount) >>> 0) | 0
  if (classId >= count) return 0

  const pMonStatsBase = m.u32((dt + DATATABLES_OFF_113C.pMonStatsTxt) >>> 0)
  const pMonStats = (pMonStatsBase + imul32(classId, D2MonStatsTxt_SIZE)) >>> 0
  if (pMonStats === 0) return 0

  const bFlags1 = m.get(pMonStats, D2MonStatsTxt.nMonStatsFlags) & 0xff
  const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
  if ((m.u32(pBitMasks) & bFlags1) !== 0) return 1
  if ((m.u32((pBitMasks + 8) >>> 0) & bFlags1) !== 0) return 1

  const flag31 = m.get(u, D2UnitStrc.dwFlags) >>> 31
  return flag31 !== 0 ? 1 : 0
}

const ACT2_COMP_OVERRIDE_0_6FDEE208: readonly (readonly number[] | null)[] = [
  [0x2074696c, 0x2074696c, 0x20736564, 0x20736564, 0x20797668, 0x20797668, 0x20797668, 0x2074696c, 0x20736564, 0x20797668, 0x20657861, 0x20657861],
  [0x2074696c, 0x2064656d, 0x20797668, 0x0, 0x6fdee164, 0x6fdee1f8, 0x6fdee180, 0x6fdee180, 0x6fdee180, 0x6fdee18c, 0x0, 0x6fdee1b4],
  [0x2074696c, 0x20736564, 0x20797668, 0x20657861, 0x20657861, 0x20616c66, 0x20616c66, 0x20786168, 0x20786168, 0x2063616d, 0x2063616d, 0x206d6373],
  [0x2074696c, 0x20736564, 0x20797668, 0x20657861, 0x20657861, 0x20616c66, 0x20616c66, 0x20786168, 0x20786168, 0x2063616d, 0x2063616d, 0x206d6373],
  [0x2074696c, 0x20736564, 0x20797668, 0x20657861, 0x20657861, 0x20616c66, 0x20616c66, 0x20786168, 0x20786168, 0x2063616d, 0x2063616d, 0x206d6373],
  [0x20657861, 0x20657861, 0x20616c66, 0x20616c66, 0x20786168, 0x20786168, 0x2063616d, 0x2063616d, 0x206d6373, 0x206d6373, 0x0, 0x20637562],
  null,
  [0x0, 0x20637562, 0x2067726c, 0x2074696b, 0x206c6d73, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0],
  [0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x2074696c, 0x20736564, 0x20797668],
  [0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x2074696c, 0x20736564, 0x20797668],
  null,
  null,
  null,
  null,
  null,
  null,
]

const ACT2_COMP_OVERRIDE_AA_6FDEE288: readonly (readonly number[] | null)[] = [
  [0x2074696c, 0x20736564, 0x20797668, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x2074696c],
  [0x2074696c, 0x2064656d, 0x20797668, 0x0, 0x6fdee164, 0x6fdee1f8, 0x6fdee180, 0x6fdee180, 0x6fdee180, 0x6fdee18c, 0x0, 0x6fdee1b4],
  [0x2074696c, 0x20736564, 0x20797668, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x2074696c],
  [0x2074696c, 0x20736564, 0x20797668, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x2074696c],
  [0x2074696c, 0x20736564, 0x20797668, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x2074696c],
  null,
  [0x20776273, 0x0, 0x6fdee248, 0x6fdee1f8, 0x6fdee248, 0x6fdee248, 0x6fdee248, 0x0, 0x6fdee280, 0x0, 0x6fdee254, 0x6fdee254],
  null,
  [0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x2074696c, 0x20736564, 0x20797668, 0x20776273],
  [0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x2074696c, 0x20736564, 0x20797668, 0x20776273],
  null,
  null,
  null,
  null,
  null,
  null,
]

/**
 * `@va D2Common:0x6FDD4C70` (`D2Common.#10134` `MONSTERS_GetCompCode113c`,
 * `__stdcall(pUnit, nCompIdx, nVarIdx) -> u32`, `ret 0xc`).
 */
export function MONSTERS_GetCompCode113c(
  m: Memory113c,
  pUnit: number,
  nCompIdx: number,
  nVarIdx: number,
): number {
  const unit = pUnit >>> 0
  if (unit === 0 || (m.u32(unit) >>> 0) !== UNIT_MONSTER) return 0
  const compIdx = nCompIdx >>> 0
  if (compIdx >= 16) return 0
  const classId = m.u32((unit + 0x04) >>> 0) | 0
  const pMonStats2 = DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline113c(m, classId) >>> 0
  if (pMonStats2 === 0) return 0
  const nCount = m.u8((pMonStats2 + 0x15 + compIdx) >>> 0)
  const varIdx = nVarIdx >>> 0
  if (nCount <= varIdx) return 0

  const varCodeIdx = m.u8((pMonStats2 + compIdx * 12 + varIdx + 0x26) >>> 0)
  let compCode = DATATBLS_GetCompCodeString113c(m, varCodeIdx) >>> 0
  const pRoom = UNITS_GetRoom113c(m, unit) >>> 0
  if (pRoom !== 0) {
    const levelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
    if (DRLG_GetActNoFromLevelId113c(m, levelId) === 1) {
      const baseId = DATATBLS_ValidateMonStatsIdInline113c(
        m,
        MONSTERS_GetBaseIdFromMonsterUnitInline113c(m, unit),
      ) | 0
      if (baseId === 0) {
        const tbl = ACT2_COMP_OVERRIDE_0_6FDEE208[compIdx]
        if (tbl !== null && tbl !== undefined && varIdx < tbl.length) {
          compCode = tbl[varIdx]! >>> 0
        }
      } else if (baseId === 0xaa) {
        const tbl = ACT2_COMP_OVERRIDE_AA_6FDEE288[compIdx]
        if (tbl !== null && tbl !== undefined && varIdx < tbl.length) {
          compCode = tbl[varIdx]! >>> 0
        }
      }
    }
  }
  return compCode >>> 0
}
