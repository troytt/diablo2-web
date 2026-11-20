/**
 * Direction helpers of the Act I dirt-path search (DrlgOutPlace.cpp sub_6FD80750). 1:1 port of D2MOO
 * source/D2Common/src/Path/PathMisc.cpp lines 25-58 and 767-856 (commit 5596f5c, MIT License,
 * Copyright (c) 2020-2025 The Phrozen Keep community); the oracle compiles the same code
 * (tools/d2moo-oracle/src/path_misc.cpp).
 */

//1.10f: D2Common.0x6FDD2158, 1.13c: D2Common.0x6FDDC320 (only unk0x00 is read by sub_6FDAB750)
const stru_6FDD2158: readonly (readonly [number, number, number])[] = [
  [5, 4, 6],
  [4, 5, 6],
  [4, 3, 5],
  [4, 3, 2],
  [3, 4, 2],
  [6, 5, 4],
  [5, 4, 6],
  [4, 3, 5],
  [3, 4, 2],
  [2, 3, 4],
  [6, 7, 5],
  [6, 7, 5],
  [6, 7, 5],
  [2, 1, 3],
  [2, 1, 3],
  [6, 7, 0],
  [7, 0, 6],
  [0, 1, 7],
  [1, 0, 2],
  [2, 1, 0],
  [7, 0, 6],
  [0, 7, 6],
  [0, 1, 7],
  [0, 1, 2],
  [1, 0, 2],
]

//D2Common.0x6FDAB610
export function sub_6FDAB610(nX1: number, nY1: number, nX2: number, nY2: number): number {
  let nDiffX = (nX2 - nX1) | 0
  let nDiffY = (nY2 - nY1) | 0

  let nAbsDiffX = nDiffX
  let nAbsDiffY = nDiffY
  if (nAbsDiffX < 0) nAbsDiffX = -nAbsDiffX
  if (nAbsDiffY < 0) nAbsDiffY = -nAbsDiffY

  if (nAbsDiffX < 2 * nAbsDiffY) {
    if (nAbsDiffY >= 2 * nAbsDiffX) {
      if (nDiffX < 0) {
        if (nDiffY < -1) {
          return 5
        } else if (nDiffY > 1) {
          nDiffY = 2
        }
        return nDiffY + 7
      }
      nDiffX &= 1
    }
  } else if (nDiffY >= 0) {
    nDiffY &= 1
  } else {
    nDiffY = -1
  }

  if (nDiffX < -1) {
    nDiffX = -2
  } else if (nDiffX > 1) {
    nDiffX = 2
  }

  if (nDiffY < -1) {
    return 5 * nDiffX + 10
  } else if (nDiffY > 1) {
    nDiffY = 2
  }

  return nDiffY + 5 * nDiffX + 12
}

//D2Common.0x6FDAB750
export function sub_6FDAB750(nX1: number, nY1: number, nX2: number, nY2: number): number {
  const nIndex = sub_6FDAB610(nX1, nY1, nX2, nY2)
  const entry = stru_6FDD2158[nIndex]
  // C indexes stru_6FDD2158[25] unchecked; every reachable index is 0..24.
  if (!entry) throw new RangeError(`sub_6FDAB750: stru_6FDD2158[${nIndex}] out of range`)
  return entry[0]
}
