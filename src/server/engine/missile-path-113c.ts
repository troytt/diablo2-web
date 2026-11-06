/**
 * 1.13c `D2Common.dll` linear missile direction (`0x6FD5CF40`, called by the path setup `0x6FD5D200` /
 * `0x6FD5D240`) with the 128-entry octant table at `0x6FDDD470` (`[minor, major, dir]`, 4096 = 1.0;
 * values checked against the binary). See `kb/missile-velocity-range-113c.md` §16.16 direction.
 *
 * Positions are 16.16 with the sub-tile centre at `+0x8000`; the per-frame displacement is
 * `(velocity * unit) >> 8` with `velocity = vel256` (`MissilesTxt.Vel << 8` * 75 %).
 */
const DIR_TABLE_113C: readonly (readonly [number, number, number])[] = [
  [0, 4096, 0], [32, 4095, 0], [64, 4095, 0], [96, 4094, 0], [128, 4093, 0], [161, 4092, 0], [193, 4091, 0], [225, 4089, 0],
  [257, 4087, 0], [289, 4085, 0], [321, 4083, 0], [353, 4080, 0], [385, 4077, 0], [417, 4074, 1], [448, 4071, 1], [480, 4067, 1],
  [511, 4063, 1], [543, 4059, 1], [574, 4055, 1], [606, 4050, 1], [637, 4046, 1], [668, 4041, 1], [699, 4035, 1], [729, 4030, 1],
  [760, 4024, 1], [791, 4018, 1], [821, 4012, 2], [851, 4006, 2], [881, 3999, 2], [911, 3993, 2], [941, 3986, 2], [971, 3979, 2],
  [1000, 3971, 2], [1030, 3964, 2], [1059, 3956, 2], [1088, 3948, 2], [1117, 3940, 2], [1145, 3932, 2], [1174, 3924, 2], [1202, 3915, 3],
  [1230, 3906, 3], [1258, 3897, 3], [1286, 3888, 3], [1313, 3879, 3], [1340, 3870, 3], [1368, 3860, 3], [1394, 3851, 3], [1421, 3841, 3],
  [1448, 3831, 3], [1474, 3821, 3], [1500, 3811, 3], [1526, 3800, 3], [1552, 3790, 3], [1577, 3780, 4], [1602, 3769, 4], [1627, 3758, 4],
  [1652, 3747, 4], [1677, 3736, 4], [1701, 3725, 4], [1725, 3714, 4], [1749, 3703, 4], [1773, 3692, 4], [1796, 3680, 4], [1820, 3669, 4],
  [1843, 3657, 4], [1866, 3646, 4], [1888, 3634, 4], [1911, 3622, 4], [1933, 3610, 5], [1955, 3599, 5], [1977, 3587, 5], [1998, 3575, 5],
  [2020, 3563, 5], [2041, 3551, 5], [2062, 3539, 5], [2082, 3526, 5], [2103, 3514, 5], [2123, 3502, 5], [2143, 3490, 5], [2163, 3478, 5],
  [2183, 3465, 5], [2202, 3453, 5], [2221, 3441, 5], [2240, 3428, 5], [2259, 3416, 5], [2278, 3403, 6], [2296, 3391, 6], [2314, 3379, 6],
  [2332, 3366, 6], [2350, 3354, 6], [2368, 3341, 6], [2385, 3329, 6], [2402, 3317, 6], [2419, 3304, 6], [2436, 3292, 6], [2453, 3279, 6],
  [2469, 3267, 6], [2486, 3255, 6], [2502, 3242, 6], [2518, 3230, 6], [2533, 3218, 6], [2549, 3205, 6], [2564, 3193, 6], [2580, 3181, 6],
  [2595, 3169, 6], [2609, 3156, 7], [2624, 3144, 7], [2639, 3132, 7], [2653, 3120, 7], [2667, 3108, 7], [2681, 3096, 7], [2695, 3084, 7],
  [2709, 3072, 7], [2722, 3060, 7], [2736, 3048, 7], [2749, 3036, 7], [2762, 3024, 7], [2775, 3012, 7], [2788, 3000, 7], [2800, 2988, 7],
  [2813, 2977, 7], [2825, 2965, 7], [2837, 2953, 7], [2849, 2942, 7], [2861, 2930, 7], [2873, 2919, 7], [2884, 2907, 7], [2896, 2896, 7],
]

export interface LinearMissilePathState113c {
  readonly ux: number
  readonly uy: number
  vel256: number
  readonly maxVel256: number
  accel: number
  accelStepCounter: number
}

function resolveLinearMissileDirUnit113c(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { ux: number; uy: number } {
  const adx = Math.abs(Math.round(x1) - Math.round(x0)) * 65536
  const ady = Math.abs(Math.round(y1) - Math.round(y0)) * 65536
  let ux: number
  let uy: number
  if (adx > ady) {
    const row = DIR_TABLE_113C[Math.trunc((ady * 127) / adx)]!
    ux = row[1]
    uy = row[0]
  } else {
    const row = ady === 0 ? DIR_TABLE_113C[0]! : DIR_TABLE_113C[Math.trunc((adx * 127) / ady)]!
    ux = row[0]
    uy = row[1]
  }
  if (Math.round(x0) > Math.round(x1)) ux = -ux
  if (Math.round(y0) > Math.round(y1)) uy = -uy
  return { ux, uy }
}

/**
 * Initializes the 1.13c `D2Common` linear missile path state (`MISSILE_CreateMissileFromParams`
 * `0x6FC8FDAC..0x6FC8FDC8` + `0x6FD5CF40` + `PATH_SetAcceleration` `0x6FD84CE0`).
 */
export function createLinearMissilePath113c(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  speed: number,
  accel: number,
  maxVel: number,
): LinearMissilePathState113c {
  const vel256 = Math.max(0, Math.round(speed * 4096))
  const { ux, uy } = resolveLinearMissileDirUnit113c(x0, y0, x1, y1)
  return {
    ux,
    uy,
    vel256,
    maxVel256: maxVel << 8,
    accel,
    accelStepCounter: 0,
  }
}

/**
 * Steps `PATH_StepVelocity` (`D2Common.dll` `0x6FD5CEB0..0x6FD5CF2F`):
 * increments `pPath->nAccelStepCounter` (`+0x8C`) when `nAcceleration != 0` (`+0x88`) and applies
 * `nVelocity += nAcceleration` every 5th step (`cmp edx, 0x5`), clamping `[0, nMaxVelocity]` and
 * zeroing `nAcceleration` on upper clamp (`0x6FD5CEED`), then computing `(nVelocity * unit) >> 8`.
 */
export function stepLinearMissilePath113c(path: LinearMissilePathState113c): { vx: number; vy: number } {
  if (path.accel !== 0) {
    path.accelStepCounter += 1
    if (path.accelStepCounter >= 5) {
      let nextVel = path.vel256 + path.accel
      if (nextVel > path.maxVel256) {
        nextVel = path.maxVel256
        path.accel = 0
      } else if (nextVel < 0) {
        nextVel = 0
      }
      path.vel256 = nextVel
      path.accelStepCounter = 0
    }
  }
  if (path.vel256 <= 0) return { vx: 0, vy: 0 }
  return {
    vx: ((path.vel256 * path.ux) >> 8) / 65536,
    vy: ((path.vel256 * path.uy) >> 8) / 65536,
  }
}

/**
 * Per-frame displacement (sub-tiles) of a linear missile from integer sub-tile `(x0, y0)` towards
 * `(x1, y1)` at `speed` sub-tiles per frame (`vel256 / 4096`), exactly as the 16.16 path computes it:
 * `idx = minor * 127 / major` (`0x6FD5CFA7`), `vx = sign * table[idx][major or minor]`,
 * `v16 = (vel256 * unit) >> 8`.
 */
export function linearMissileStep16_113c(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  speed: number,
): { vx: number; vy: number } {
  const vel256 = Math.round(speed * 4096)
  if (vel256 <= 0) return { vx: 0, vy: 0 }
  const { ux, uy } = resolveLinearMissileDirUnit113c(x0, y0, x1, y1)
  return { vx: ((vel256 * ux) >> 8) / 65536, vy: ((vel256 * uy) >> 8) / 65536 }
}
