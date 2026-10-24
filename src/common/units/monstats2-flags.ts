/**
 * Diablo II 1.13c MonStats2 flag lookup (`D2MonStats2Txt.dwFlags`), mirroring D2Client `0x6FAB1510`.
 *
 * Data: `monstats2-flags-data.ts`, baked from the compiled bins by `src/baker/packers/pack-monstats2-flags.ts`.
 */

import {
  MONSTATS_TXT_RECORD_COUNT,
  MONSTER_PATH_DATA,
  MONSTER_PATH_DATA_STRIDE,
  MONSTER_PATH_IDS,
} from '../path/monster-path-data.ts'
import { MONSTATS2_FLAGS_BY_HCIDX } from './monstats2-flags-data.ts'

/** Bit indices of `D2MonStats2Txt.dwFlags` — D2MOO `MonsterTbls.h:224-244` (`D2C_MonStats2FlagIndices`). */
export const MONSTATS2_FLAGINDEX = Object.freeze({
  NOGFXHITTEST: 0,
  NOMAP: 1,
  NOOVLY: 2,
  ISSEL: 3,
  ALSEL: 4,
  NOSEL: 5,
  SHIFTSEL: 6,
  CORPSESEL: 7,
  REVIVE: 8,
  ISATT: 9,
  SMALL: 10,
  LARGE: 11,
  SOFT: 12,
  CRITTER: 13,
  SHADOW: 14,
  NOUNIQUESHIFT: 15,
  COMPOSITEDEATH: 16,
  INERT: 17,
  OBJCOL: 18,
  DEADCOL: 19,
  UNFLATDEAD: 20,
} as const)

export type MonStats2FlagIndex = (typeof MONSTATS2_FLAGINDEX)[keyof typeof MONSTATS2_FLAGINDEX]

/**
 * D2Client `0x6FAB1510(classId, flagIndex)`: `true` when bit `flagIndex` of the monster's MonStats2 `dwFlags` is set.
 *
 * Exactly like the original it answers `false` when `classId` is outside the MonStats table (`0x6fab1513` /
 * `0x6fab1523`) or the record's `wMonStatsEx` has no MonStats2 row (`0x6fab1538` / `0x6fab1540`).
 */
export function hasMonStats2Flag(classId: number, flagIndex: MonStats2FlagIndex): boolean {
  if (!Number.isInteger(classId) || classId < 0 || classId >= MONSTATS2_FLAGS_BY_HCIDX.length) return false
  const flags = MONSTATS2_FLAGS_BY_HCIDX[classId]
  if (flags === null || flags === undefined) return false
  return ((flags >>> flagIndex) & 1) === 1
}

/**
 * 1.13c `D2Game.dll` curse eligibility check (`0x6FC6ECD0` called by `SKILLS_SrvDo030_Curse` `0x6FC70250`,
 * `D2Common_11085` at `0x6FD81200` called by `SKILLS_SrvDo061_Confuse` `0x6FC70B70` and `SKILLS_SrvDo059_Attract` `0x6FC70DB0`,
 * and `sub_6FCC00B0` at `0x6FCC00B0`):
 * - `0x6FC6ECD0` -> `0x6FC21560(hcIdx, MONMODE_WALK = 2)` and `0x6FD81200` -> `0x6FD51400(hcIdx, MONMODE_WALK = 2)`:
 *   requires `(pMonStats2Txt->dwModeFlags & (1 << 2)) !== 0` (`mWL == 1` in `MonStats2.txt`).
 *   All buildings, barricades, doors, towers, walls, evil huts, catapults, sarcophagi, crow/sucker nests,
 *   maggot eggs, turrets, fire towers, lightning spires, gargoyle/floor/wall traps, evil holes, bone walls/prisons,
 *   windows, trapped souls, sentries, hydras, and spawners have `mWL = 0` and cannot be cursed.
 * - `sub_6FCC00B0` (`0x6FCC00B0`): requires `!(pMonStatsTxt->dwMonStatsFlags & (1 << 8))` (`npc == 0`)
 *   and `(pMonStats2Txt->dwFlags & (1 << 9)) !== 0` (`isAtt == 1`, `MONSTATS2_FLAGINDEX.ISATT`).
 * - Also excludes `MONSTATS2_FLAGINDEX.NOOVLY` (`noOvly == 1`) and `MONSTATS2_FLAGINDEX.INERT` (`inert == 1`).
 */
export function canMonsterClassBeCursed113c(classId: number): boolean {
  if (!Number.isInteger(classId) || classId < 0 || classId >= MONSTATS_TXT_RECORD_COUNT) {
    return false
  }
  const o = classId * MONSTER_PATH_DATA_STRIDE
  const monStatsFlags = MONSTER_PATH_DATA[o + 1]!
  const modeFlags = MONSTER_PATH_DATA[o + 12]!
  // 1.13c 0x6FC6ECD0 / 0x6FD81200: MONMODE_WALK (bit 2 = 0x04, MonStats2.txt mWL) must be enabled
  if ((modeFlags & 0x04) === 0) return false
  // 1.13c 0x6FCC00B0: MonStats.txt npc (bit 8 = 0x100) must be 0
  if ((monStatsFlags & 0x100) !== 0) return false
  // 1.13c 0x6FCC00B0 & D2Client 0x6FAB1510: MonStats2.txt isAtt (bit 9) must be 1, and not noOvly (bit 2) or inert (bit 17)
  if (!hasMonStats2Flag(classId, MONSTATS2_FLAGINDEX.ISATT)) return false
  if (hasMonStats2Flag(classId, MONSTATS2_FLAGINDEX.NOOVLY)) return false
  if (hasMonStats2Flag(classId, MONSTATS2_FLAGINDEX.INERT)) return false
  return true
}

const MONSTER_HCIDX_BY_ID: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>()
  for (let i = 0; i < MONSTER_PATH_IDS.length; i++) {
    const id = MONSTER_PATH_IDS[i]
    if (id) map.set(id.toLowerCase(), i)
  }
  return map
})()

export function resolveMonsterClassId113c(idOrName: string | number | undefined): number | undefined {
  if (typeof idOrName === 'number') {
    return Number.isInteger(idOrName) && idOrName >= 0 && idOrName < MONSTATS_TXT_RECORD_COUNT
      ? idOrName
      : undefined
  }
  if (typeof idOrName === 'string' && idOrName.trim().length > 0) {
    const norm = idOrName.trim().toLowerCase()
    const exact = MONSTER_HCIDX_BY_ID.get(norm)
    if (exact !== undefined) return exact
    const compact = norm.replace(/[\s_-]+/g, '')
    const byCompact = MONSTER_HCIDX_BY_ID.get(compact) ?? MONSTER_HCIDX_BY_ID.get(`${compact}1`)
    if (byCompact !== undefined) return byCompact
  }
  return undefined
}

export function canMonsterTargetBeCursed113c(target: {
  readonly classId?: number | string | undefined
  readonly monId?: string | undefined
  readonly id?: string | number | undefined
  readonly name?: string | undefined
  readonly isBuilding?: boolean | undefined
  readonly cannotBeCursed?: boolean | undefined
  readonly stats?: {
    readonly id?: string | number | undefined
    readonly classId?: number | string | undefined
    readonly isBuilding?: boolean | undefined
    readonly cannotBeCursed?: boolean | undefined
  } | undefined
}): boolean {
  if (
    target.isBuilding ||
    target.cannotBeCursed ||
    target.stats?.isBuilding ||
    target.stats?.cannotBeCursed
  ) {
    return false
  }
  const candidates = [
    target.classId,
    target.stats?.classId,
    target.monId,
    target.stats?.id,
    target.id,
    target.name,
  ]
  for (const c of candidates) {
    const hcIdx = resolveMonsterClassId113c(c)
    if (hcIdx !== undefined) {
      return canMonsterClassBeCursed113c(hcIdx)
    }
  }
  return true
}
