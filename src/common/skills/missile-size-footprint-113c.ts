/**
 * 1.13c D2Common missile `Size` footprint collision shared by the server and the client (moved from
 * src/server/engine/missile-engine.ts, Issue #1502). Coordinates are in `subtilePx` units per sub-tile.
 */

/**
 * 1.13c `D2Common.#10389` (`0x6FDCF6A0`, 9-case jump table at `0x6FDCF8E8`):
 * Subtile footprint overlap between a missile of size `missileSize` (`1..3`, `Missiles.txt` `Size`)
 * and a target unit of size `targetSize` (`1..3`, `MonStats2.txt` `SizeX` or `2` for players).
 */
export function checkMissileSizeFootprintOverlap113c(
  dxSub: number,
  dySub: number,
  missileSize: number,
  targetSize: number = 2,
): boolean {
  const mSize = Math.trunc(missileSize)
  const tSize = Math.trunc(targetSize)
  if (mSize < 1 || mSize > 3 || tSize < 1 || tSize > 3) {
    return false
  }
  const dx = Math.abs(dxSub)
  const dy = Math.abs(dySub)
  const caseIdx = (mSize - 1) * 3 + (tSize - 1)
  switch (caseIdx) {
    case 0: // (1, 1): dx == 0 && dy == 0
      return dx < 1 && dy < 1
    case 1: // (1, 2): dx + dy <= 1
    case 3: // (2, 1): dx + dy <= 1
      return dx + dy <= 1
    case 4: // (2, 2): dx + dy <= 2
      return dx + dy <= 2
    case 2: // (1, 3): dx <= 1 && dy <= 1
    case 6: // (3, 1): dx <= 1 && dy <= 1
      return dx <= 1 && dy <= 1
    case 5: // (2, 3): (dx <= 2 && dy <= 1) || (dy <= 2 && dx <= 1)
    case 7: // (3, 2): (dx <= 2 && dy <= 1) || (dy <= 2 && dx <= 1)
      return (dx <= 2 && dy <= 1) || (dy <= 2 && dx <= 1)
    case 8: // (3, 3): dx <= 2 && dy <= 2
      return dx <= 2 && dy <= 2
    default:
      return false
  }
}

/**
 * 1.13c `D2Common.#10229` (`PATH_StepMissile`, `0x6FD80F80` -> `0x6FD5D420` -> `0x6FD5D580` / `0x6FD8E110`):
 * Halves `(dx, dy)` (`sar 1`) until both `|stepX| <= subtilePx` (`< 0x10000` in 16.16 fixed-point) and
 * `|stepY| <= subtilePx`, returning the sequence of stepped points from `(x0, y0)` to `(x1, y1)`.
 */
export function stepMissileSubtileRay113c(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  subtilePx: number = 1,
): { readonly x: number; readonly y: number }[] {
  let stepX = x1 - x0
  let stepY = y1 - y0
  let steps = 1
  const limit = Math.max(1e-6, subtilePx)
  while ((Math.abs(stepX) > limit || Math.abs(stepY) > limit) && steps < 256) {
    stepX *= 0.5
    stepY *= 0.5
    steps <<= 1
  }
  const points: { readonly x: number; readonly y: number }[] = [{ x: x0, y: y0 }]
  for (let i = 1; i <= steps; i++) {
    points.push({
      x: i === steps ? x1 : x0 + stepX * i,
      y: i === steps ? y1 : y0 + stepY * i,
    })
  }
  return points
}

/**
 * Check `0x6FDCF6A0` `Size` footprint overlap along a missile's per-tick movement segment `(x0, y0) -> (x1, y1)`.
 */
export function checkMissileSegmentFootprintOverlap113c(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tx: number,
  ty: number,
  missileSize: number,
  targetSize: number = 2,
  subtilePx: number = 1,
  yAspect: number = 1,
): boolean {
  const stepPoints = stepMissileSubtileRay113c(x0, y0, x1, y1, subtilePx)
  for (const pt of stepPoints) {
    const dxSub = Math.abs(tx - pt.x) / subtilePx
    const dySub = Math.abs((ty - pt.y) / yAspect) / subtilePx
    if (checkMissileSizeFootprintOverlap113c(dxSub, dySub, missileSize, targetSize)) {
      return true
    }
  }
  const segDx = x1 - x0
  const segDy = (y1 - y0) / yAspect
  const segLenSq = segDx * segDx + segDy * segDy
  if (segLenSq > 1e-6) {
    const relY = (ty - y0) / yAspect
    const t = Math.max(0, Math.min(1, ((tx - x0) * segDx + relY * segDy) / segLenSq))
    const cx = x0 + segDx * t
    const cy = y0 + (y1 - y0) * t
    const dxSub = Math.abs(tx - cx) / subtilePx
    const dySub = Math.abs((ty - cy) / yAspect) / subtilePx
    if (checkMissileSizeFootprintOverlap113c(dxSub, dySub, missileSize, targetSize)) {
      return true
    }
  }
  return false
}


/**
 * Sub-tile-grid form of the per-step footprint test for callers whose coordinates are already in sub-tiles (the
 * client world). 1.13c unit positions are 16.16 fixed-point and `#10389` compares the integer sub-tile parts
 * (`>> 16`), so both the stepped ray points (`stepMissileSubtileRay113c`, at most one sub-tile apart) and the target
 * are floored to their sub-tile before the `Size` / `SizeX` jump-table test.
 */
export function checkMissileSubtileRayFootprintOverlap113c(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tx: number,
  ty: number,
  missileSize: number,
  targetSize: number = 2,
): boolean {
  const tSubX = Math.floor(tx)
  const tSubY = Math.floor(ty)
  for (const pt of stepMissileSubtileRay113c(x0, y0, x1, y1, 1)) {
    if (checkMissileSizeFootprintOverlap113c(Math.floor(pt.x) - tSubX, Math.floor(pt.y) - tSubY, missileSize, targetSize)) {
      return true
    }
  }
  return false
}

const MISSILE_WALL_FOOTPRINT_SIZE_1: readonly (readonly [number, number])[] = Object.freeze([[0, 0]])
const MISSILE_WALL_FOOTPRINT_SIZE_2: readonly (readonly [number, number])[] = Object.freeze([
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
])
const MISSILE_WALL_FOOTPRINT_SIZE_3: readonly (readonly [number, number])[] = Object.freeze([
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
])

/**
 * 1.13c `D2Common.#10229` (`0x6FD80F80` `UNITS_GetUnitSizeX` -> `0x6FD5D420` -> `0x6FD9D760`
 * `COLLISION_TryMoveUnitCollisionMask` -> `0x6FD9CE00` `COLLISION_CheckMaskWithSize`):
 * Sub-tile `(dx, dy)` offsets tested against static wall / missile barrier collision masks when a
 * missile of `Missiles.txt` `Size` (`1..3`, stored in `pDynamicPath->dwUnitSize`) enters a new sub-tile:
 * - `Size <= 1`: single sub-tile `(0, 0)`
 * - `Size === 2`: 5-cell `"+"` cross (`(0,0), (-1,0), (1,0), (0,-1), (0,1)`)
 * - `Size >= 3`: 9-cell `3x3` bounding box (`dx in -1..1, dy in -1..1`)
 */
export function getMissileSizeFootprintOffsets113c(
  missileSize: number,
): readonly (readonly [number, number])[] {
  const mSize = Math.trunc(missileSize)
  if (mSize >= 3) return MISSILE_WALL_FOOTPRINT_SIZE_3
  if (mSize === 2) return MISSILE_WALL_FOOTPRINT_SIZE_2
  return MISSILE_WALL_FOOTPRINT_SIZE_1
}
