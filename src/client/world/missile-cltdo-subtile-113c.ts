/**
 * 1.13c D2Client MissCltDoFuncs that drop CltSubMissile1 each time the path enters a new sub-tile (#10203):
 *
 * ```
 * CltDo3  0x6fb6be60  poisonjav, plaguejavelin, trap poison ball right/left, viper_poisjav:
 *         #10203 && CltSubMissile1 (+0x1e) >= 0 -> 0x6fb69650(CltSubMissile1, #10231(CltCalc1 +0x84)): create
 *         { flags 5 (start = missile cell, velocity 0), owner, source = m, level = missile level } (flag 8 /
 *         loops only when the CltCalc1 value is > 0; no pCltDoFunc 3 row has a CltCalc1)
 * CltDo18 0x6fb68960  bonespear, viper_bonespear:
 *         CltSubMissile1 >= 0 && #10985 >= InitSteps (+0x135) && #10203 -> create { flags 1 (start = missile cell),
 *         owner, missile = CltSubMissile1, record level 0 (lifetime = Range), loops (+0x34) = CltParam1 (+0x58) },
 *         path direction / speed copied from the missile, 3D offset copied (0x6fb77ec0 -> 0x6fb77e30)
 * CltDo68 0x6fb677a0  sucfireball: CltSubMissile1 == 0 -> remove; #10203 -> create { flags 9, ... missile =
 *         CltSubMissile1 }; sucfireball has no CltSubMissile1 (compiled -1), so 0x6fb630f0 returns NULL at once
 *         (`[rec+0x10] < 0`): the client never draws a trail for it.
 * ```
 * Every branch ends in the CltDo1 tail.
 */
import { missileCltCols113c, type MissileCltColsRow113c } from '../../common/skills/missile-clt-cols-113c.ts'

export interface SubtileTrailSpawn {
  readonly sub: MissileCltColsRow113c
  /** CltDo3: inherit the missile level; CltDo18: record level 0 (lifetime = Range). */
  readonly inheritLevel: boolean
  /** CltDo18: create record +0x34 (SubLoop count). */
  readonly loops: number | undefined
}

/** The spawn of MissCltDoFunc 3 / 18 for one frame, or null (any other pCltDoFunc returns null). */
export function subtileTrailSpawn(
  row: MissileCltColsRow113c,
  elapsed: number,
  enteredNewSubtile: boolean,
): SubtileTrailSpawn | null {
  const subId = row.cltSubMissile[0]
  if (row.pCltDoFunc === 3) {
    if (!enteredNewSubtile || subId < 0) return null
    return { sub: missileCltCols113c(subId), inheritLevel: true, loops: undefined }
  }
  if (row.pCltDoFunc === 18) {
    if (subId < 0 || elapsed < row.initSteps || !enteredNewSubtile) return null
    return { sub: missileCltCols113c(subId), inheritLevel: false, loops: row.cltParam[0] }
  }
  return null
}
