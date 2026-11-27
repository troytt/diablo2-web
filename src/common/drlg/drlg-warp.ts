/**
 * D2Common DRLG warps: port of the parts of D2MOO source/D2Common/src/Drlg/DrlgDrlgWarp.cpp
 * (commit 5596f5c, MIT License, Copyright (c) 2020-2025 The Phrozen Keep community) used by the
 * outdoor generator.
 */

import {
  DATATBLS_GetLevelDefRecord,
  DATATBLS_GetLvlWarpTxtRecordFromLevelIdAndDirection,
  type LvlWarpRecord,
} from './drlg-tables.ts'
import type { D2DrlgLevelStrc, D2DrlgStrc } from './drlg-types.ts'

//D2Common.0x6FD78CC0
export function DRLGWARP_GetWarpIdArrayFromLevelId(pDrlg: D2DrlgStrc, nLevelId: number): readonly number[] {
  for (let pDrlgWarp = pDrlg.pWarp; pDrlgWarp; pDrlgWarp = pDrlgWarp.pNext) {
    if (!pDrlgWarp.nLevel) throw new Error('ptVisInfo->eLevelId != LEVEL_ID_NONE')
    if (nLevelId === pDrlgWarp.nLevel) return pDrlgWarp.nWarp
  }
  return DATATBLS_GetLevelDefRecord(pDrlg.env.tables, nLevelId).dwWarp
}

//D2Common.0x6FD78D10
export function DRLGWARP_GetWarpDestinationFromArray(pLevel: D2DrlgLevelStrc, nArrayId: number): number {
  const nIndex = nArrayId & 0xff
  if (nIndex >= 8) throw new RangeError(`DRLGWARP_GetWarpDestinationFromArray: index ${nIndex}`)
  return DRLGWARP_GetWarpIdArrayFromLevelId(pLevel.pDrlg, pLevel.nLevelId)[nIndex]!
}

//D2Common.0x6FD78D80 (DrlgDrlgWarp.cpp:304). nWarpId is a uint8_t parameter; szDirection the C char.
export function DRLGWARP_GetLvlWarpTxtRecordFromWarpIdAndDirection(
  pLevel: D2DrlgLevelStrc,
  nWarpId: number,
  szDirection: string,
): LvlWarpRecord {
  return DATATBLS_GetLvlWarpTxtRecordFromLevelIdAndDirection(
    pLevel.pDrlg.env.tables,
    DRLGWARP_GetWarpDestinationFromArray(pLevel, nWarpId & 0xff),
    szDirection,
  )
}
