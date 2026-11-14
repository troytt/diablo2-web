/**
 * Diablo II v1.13c `D2Common.dll` pathfinding / velocity / dynamic-path leaf functions (`Path.cpp` / `PathMisc.cpp`,
 * image base `0x6FD50000`).
 *
 * Every function below is a 1:1 port of the cited disassembly (`objdump -d -M intel` on the 1.13c image).
 * None of them calls another function. Register-convention (LTCG) arguments are explicit TS parameters, and
 * the doc comment of each function names the register that carries them. Signedness follows the branch
 * mnemonics: `jl/jg/jle/jge/idiv/sar/cdq` are signed, `ja/jb/jae/jbe` are unsigned.
 *
 * Struct offsets come from `mem/layout.generated.ts` (`docs/oracle/route2-layout.json`).
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2ActiveRoomStrc,
  D2AStarNodeStrc,
  D2DynamicPathStrc,
  D2IdaStarNodeStrc,
  D2MonStatsTxt,
  D2MonStatsTxt_SIZE,
  D2PathInfoStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import {
  PATH_AStar_FindPointInVisitedCache113c,
  PATH_AStar_GetNodeFromPendingCache113c,
  PATH_AStar_PropagateNewFScoreToChildren113c,
} from '../tables/item-tbls-113c.ts'
import {
  COLLISION_CheckMaskWithPattern1_113c,
  COLLISION_CheckMaskWithPattern2_113c,
  COLLISION_MoveUnitCollisionMask113c,
  COLLISION_ResetMaskWithPattern113c,
  COLLISION_ResetMaskWithPatternSimple113c,
  COLLISION_ResetMaskWithSizeXY113c,
  COLLISION_SetMaskForBoundingBoxRecursively113c,
  COLLISION_SetMaskWithPattern113c,
  COLLISION_SetMaskWithSizeXY113c,
  COLLISION_SetUnitCollisionMaskWithPattern113c,
} from './collision.ts'
import { PATH_CheckStepTargetDistance113c } from './drlg/room-tile.ts'
import {
  DRLG_IsTownLevel113c,
  DUNGEON_GetRoomAtPosition113c,
  DUNGEON_GetRoomCoordinates113c,
} from './dungeon.ts'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
  DATATABLES_OFF_113C,
  DATATBLS_CheckMonStatsFlagInline113c,
} from './inline-helpers.ts'
import { imul32, sar32, sdiv32 } from './int-math.ts'
import { MONSTERS_IsTownOrFriendlyUnit113c } from './monsters.ts'
import {
  UNITROOM_AddUnitToRoom113c,
  UNITROOM_RefreshUnit113c,
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_GetCollisionMask113c,
  UNITS_GetDistanceToOtherUnit113c,
  UNITS_GetRoom113c,
  UNITS_GetUnitSizeX113c,
  UNITS_GetUnitSizeY113c,
  UNITS_GetX113c,
  UNITS_GetY113c,
  UNITS_IsDoor113c,
  UNITS_TestCollisionBetweenUnitsWithDoors113c,
  UNITS_TransferStateMaskToRemoved113c,
} from './unit.ts'
import { PATH_GetTargetUnitCoordsWithTrigOffset113c } from '../tables/datatbls-113c.ts'
import { seedNext, type D2SeedStrc } from '../prng.ts'

const PATH_STACK_SCRATCH_BASE = 0x7ff00000
const PATH_STACK_SCRATCH_SIZE = 0x80000
const _pathStackBuf = new ArrayBuffer(PATH_STACK_SCRATCH_SIZE)
const _pathStackU8 = new Uint8Array(_pathStackBuf)
const _pathStackDV = new DataView(_pathStackBuf)

const PATH_STACK_F26_BASE = PATH_STACK_SCRATCH_BASE + 0x00100
const PATH_STACK_F23_BASE = PATH_STACK_SCRATCH_BASE + 0x00200
const PATH_STACK_F19_BASE = PATH_STACK_SCRATCH_BASE + 0x00300
const PATH_STACK_F18_BASE = PATH_STACK_SCRATCH_BASE + 0x00400
const PATH_STACK_F01_BASE = PATH_STACK_SCRATCH_BASE + 0x00800
const PATH_STACK_F08_BASE = PATH_STACK_SCRATCH_BASE + 0x01000
const PATH_STACK_F07_BASE = PATH_STACK_SCRATCH_BASE + 0x05000
const PATH_STACK_I12C_F22_BASE = PATH_STACK_SCRATCH_BASE + 0x10000
const PATH_STACK_I12C_F23_BASE = PATH_STACK_SCRATCH_BASE + 0x11000
const PATH_STACK_I12C_F24_BASE = PATH_STACK_SCRATCH_BASE + 0x12000
const PATH_STACK_I12C_F25_BASE = PATH_STACK_SCRATCH_BASE + 0x13000
const PATH_STACK_I12C_F26_BASE = PATH_STACK_SCRATCH_BASE + 0x14000

/** `.rdata` 25×3 step-direction candidate table `int32[25][3]` at `0x6FDDC320..0x6FDDC44B`. */
export const PATH_CANDIDATE_DIRS_25X3_6FDDC320 = Int32Array.from([
  5, 4, 6, 4, 5, 6, 4, 3, 5, 4, 3, 2, 3, 4, 2,
  6, 5, 4, 5, 4, 6, 4, 3, 5, 3, 4, 2, 2, 3, 4,
  6, 7, 5, 6, 7, 5, 6, 7, 5, 2, 1, 3, 2, 1, 3,
  6, 7, 0, 7, 0, 6, 0, 1, 7, 1, 0, 2, 2, 1, 0,
  7, 0, 6, 0, 7, 6, 0, 1, 7, 0, 1, 2, 1, 0, 2,
])

/** `.rdata` `gdwPathTypeStepNums` `uint32[18]` at `0x6FDE4138..0x6FDE417F`. */
export const PATH_TYPE_STEP_NUMS_6FDE4138 = Uint32Array.from([
  0, 0, 0, 0, 0, 2, 0xfffffffe, 0, 0, 0, 0, 0, 0xfffffffc, 0, 0, 0, 0, 0,
])

/** `.rdata` `gdwPathTypeFlags` `uint32[18]` at `0x6FDE4180..0x6FDE41C7`. */
export const PATH_TYPE_FLAGS_6FDE4180 = Uint32Array.from([
  0x21900, 0x1900, 0, 0, 0x60000, 0, 0, 0x21900, 0x1e600,
  0x1e800, 0x60000, 0x1e604, 0, 0x100, 0x60000, 0x800, 0, 0,
])

/** `.rdata` target position 3-candidate direction table `uint8[25][3]` at `0x6FDDC450..0x6FDDC49A` (`75` bytes). */
export const PATH_VALID_TARGET_DIRS_6FDDC450 = Uint8Array.from([
  4, 6, 255, 4, 6, 255, 4, 2, 6, 4, 2, 255, 4, 2, 255,
  6, 4, 255, 4, 6, 255, 4, 2, 6, 4, 2, 255, 2, 4, 255,
  6, 0, 4, 6, 0, 4, 6, 0, 4, 2, 0, 4, 2, 0, 4,
  6, 0, 255, 0, 6, 255, 0, 2, 6, 2, 0, 255, 2, 0, 255,
  0, 6, 255, 0, 6, 255, 0, 2, 6, 0, 2, 255, 0, 2, 255,
])

/** `.data` wall-follower probe/advance turn tables `int32[4][16]` at `0x6FDE5098..0x6FDE5197`. */
export const PATH_WF_TURN_TABLES_6FDE5098 = Int32Array.from([
  6, 0, 0, 2, 2, 4, 4, 6, 6, 0, 0, 2, 2, 4, 4, 6,
  2, 2, 4, 4, 6, 6, 0, 0, 2, 2, 4, 4, 6, 6, 0, 0,
  2, 2, 4, 4, 6, 6, 0, 0, 2, 2, 4, 4, 6, 6, 0, 0,
  6, 6, 0, 0, 2, 2, 4, 4, 6, 6, 0, 0, 2, 2, 4, 4,
])

/** `.data` wall-follower initial direction delta table `int32[9]` at `0x6FDE5198..0x6FDE51BB`. */
export const PATH_WF_DELTA_TO_DIR_6FDE5198 = Int32Array.from([7, 0, 1, 6, -1, 2, 5, 4, 3])

function withPathStackScratch113c(m: Memory113c): Memory113c {
  const isStack = (p: number): boolean => {
    const u = p >>> 0
    return u >= PATH_STACK_SCRATCH_BASE && u < PATH_STACK_SCRATCH_BASE + PATH_STACK_SCRATCH_SIZE
  }
  const self: Memory113c = {
    alloc: size => m.alloc(size),
    u8: p => (isStack(p) ? _pathStackU8[(p >>> 0) - PATH_STACK_SCRATCH_BASE]! : m.u8(p)),
    u16: p => (isStack(p) ? _pathStackDV.getUint16((p >>> 0) - PATH_STACK_SCRATCH_BASE, true) : m.u16(p)),
    u32: p => {
      const u = p >>> 0
      if (isStack(u)) return _pathStackDV.getUint32(u - PATH_STACK_SCRATCH_BASE, true)
      if (u >= 0x6fddb860 && u < 0x6fddb960 && (u & 3) === 0) {
        return PATH_IDASTAR_BEST_DIR_TABLE_6FDDB860[(u - 0x6fddb860) >>> 2]! >>> 0
      }
      if (u >= 0x6fddc320 && u < 0x6fddc44c && (u & 3) === 0) {
        return PATH_CANDIDATE_DIRS_25X3_6FDDC320[(u - 0x6fddc320) >>> 2]! >>> 0
      }
      if (u >= 0x6fde4138 && u < 0x6fde4180 && (u & 3) === 0) {
        return PATH_TYPE_STEP_NUMS_6FDE4138[(u - 0x6fde4138) >>> 2]! >>> 0
      }
      if (u >= 0x6fde4180 && u < 0x6fde41c8 && (u & 3) === 0) {
        return PATH_TYPE_FLAGS_6FDE4180[(u - 0x6fde4180) >>> 2]! >>> 0
      }
      if (u >= 0x6fde5098 && u < 0x6fde5198 && (u & 3) === 0) {
        return PATH_WF_TURN_TABLES_6FDE5098[(u - 0x6fde5098) >>> 2]! >>> 0
      }
      return m.u32(p)
    },
    setU8: (p, v) => {
      if (isStack(p)) _pathStackU8[(p >>> 0) - PATH_STACK_SCRATCH_BASE] = v & 0xff
      else m.setU8(p, v)
    },
    setU16: (p, v) => {
      if (isStack(p)) _pathStackDV.setUint16((p >>> 0) - PATH_STACK_SCRATCH_BASE, v & 0xffff, true)
      else m.setU16(p, v)
    },
    setU32: (p, v) => {
      if (isStack(p)) _pathStackDV.setUint32((p >>> 0) - PATH_STACK_SCRATCH_BASE, v >>> 0, true)
      else m.setU32(p, v)
    },
    get: (base, f, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      const p = ((base >>> 0) + f.off + idx * width) >>> 0
      return width === 1 ? self.u8(p) : width === 2 ? self.u16(p) : self.u32(p)
    },
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      const p = ((base >>> 0) + f.off + idx * width) >>> 0
      if (width === 1) self.setU8(p, v)
      else if (width === 2) self.setU16(p, v)
      else self.setU32(p, v)
    },
    fill: (p, len, v) => {
      if (isStack(p)) {
        const off = (p >>> 0) - PATH_STACK_SCRATCH_BASE
        _pathStackU8.fill(v & 0xff, off, off + len)
      } else {
        m.fill(p, len, v)
      }
    },
  }
  return self
}

/**
 * `PATH_GetDirectionVector` `.rdata` lookup table at `0x6FDDD470` (128 rows × 3 `int32_t` `{a, b, ang}`, stride 12,
 * 1,536 bytes total). Copied verbatim from the 1.13c PE image; `tests/oracle/k1/laneC-B007-path.test.ts` re-reads
 * the PE bytes at `0x6FDDD470` and verifies byte-for-byte identity against this constant.
 */
export const PATH_DIRECTION_TABLE_6FDDD470 = Int32Array.from([
  0, 4096, 0, 32, 4095, 0, 64, 4095, 0, 96, 4094, 0,
  128, 4093, 0, 161, 4092, 0, 193, 4091, 0, 225, 4089, 0,
  257, 4087, 0, 289, 4085, 0, 321, 4083, 0, 353, 4080, 0,
  385, 4077, 0, 417, 4074, 1, 448, 4071, 1, 480, 4067, 1,
  511, 4063, 1, 543, 4059, 1, 574, 4055, 1, 606, 4050, 1,
  637, 4046, 1, 668, 4041, 1, 699, 4035, 1, 729, 4030, 1,
  760, 4024, 1, 791, 4018, 1, 821, 4012, 2, 851, 4006, 2,
  881, 3999, 2, 911, 3993, 2, 941, 3986, 2, 971, 3979, 2,
  1000, 3971, 2, 1030, 3964, 2, 1059, 3956, 2, 1088, 3948, 2,
  1117, 3940, 2, 1145, 3932, 2, 1174, 3924, 2, 1202, 3915, 3,
  1230, 3906, 3, 1258, 3897, 3, 1286, 3888, 3, 1313, 3879, 3,
  1340, 3870, 3, 1368, 3860, 3, 1394, 3851, 3, 1421, 3841, 3,
  1448, 3831, 3, 1474, 3821, 3, 1500, 3811, 3, 1526, 3800, 3,
  1552, 3790, 3, 1577, 3780, 4, 1602, 3769, 4, 1627, 3758, 4,
  1652, 3747, 4, 1677, 3736, 4, 1701, 3725, 4, 1725, 3714, 4,
  1749, 3703, 4, 1773, 3692, 4, 1796, 3680, 4, 1820, 3669, 4,
  1843, 3657, 4, 1866, 3646, 4, 1888, 3634, 4, 1911, 3622, 4,
  1933, 3610, 5, 1955, 3599, 5, 1977, 3587, 5, 1998, 3575, 5,
  2020, 3563, 5, 2041, 3551, 5, 2062, 3539, 5, 2082, 3526, 5,
  2103, 3514, 5, 2123, 3502, 5, 2143, 3490, 5, 2163, 3478, 5,
  2183, 3465, 5, 2202, 3453, 5, 2221, 3441, 5, 2240, 3428, 5,
  2259, 3416, 5, 2278, 3403, 6, 2296, 3391, 6, 2314, 3379, 6,
  2332, 3366, 6, 2350, 3354, 6, 2368, 3341, 6, 2385, 3329, 6,
  2402, 3317, 6, 2419, 3304, 6, 2436, 3292, 6, 2453, 3279, 6,
  2469, 3267, 6, 2486, 3255, 6, 2502, 3242, 6, 2518, 3230, 6,
  2533, 3218, 6, 2549, 3205, 6, 2564, 3193, 6, 2580, 3181, 6,
  2595, 3169, 6, 2609, 3156, 7, 2624, 3144, 7, 2639, 3132, 7,
  2653, 3120, 7, 2667, 3108, 7, 2681, 3096, 7, 2695, 3084, 7,
  2709, 3072, 7, 2722, 3060, 7, 2736, 3048, 7, 2749, 3036, 7,
  2762, 3024, 7, 2775, 3012, 7, 2788, 3000, 7, 2800, 2988, 7,
  2813, 2977, 7, 2825, 2965, 7, 2837, 2953, 7, 2849, 2942, 7,
  2861, 2930, 7, 2873, 2919, 7, 2884, 2907, 7, 2896, 2896, 7,
])

/**
 * `@va D2Common:0x6FD5CEB0` (`PATH_StepVelocity`, not exported; LTCG `eax = pPath`, `ecx = nRate`, plain `ret`).
 * Sole caller `0x6FD5E230` (`PATH_Step`).
 *
 * - `0x6FD5CEB1 mov edi, ecx; test edi, edi; jg -> rate = nRate > 0 ? nRate : 0x400`.
 * - If `dwAcceleration (+0x88) != 0` (`0x6FD5CEBC`):
 *   - increments `nAccelStepCounter (+0x8C)` (`0x6FD5CECC`);
 *   - when `cnt >= 5` (signed `jl` at `0x6FD5CED6`): `vel = dwVelocity (+0x7C) + acc`; if `vel > dwMaxVelocity (+0x84)`
 *     (signed `jle`) clamps `dwVelocity = dwMaxVelocity` and clears `dwAcceleration = 0`; else if `vel < 0` clamps
 *     `dwVelocity = 0`; resets `nAccelStepCounter = 0` (`0x6FD5CF04`).
 * - Computes `s = imul32(dwVelocity, rate) >> 6` (`0x6FD5CF14..0x6FD5CF17`), then writes unaligned int32s
 *   `tVelocityVectorX (+0x72) = imul32(tDirectionVectorX (+0x6A), s) >> 12` (`0x6FD5CF20`) and
 *   `tVelocityVectorY (+0x76) = imul32(tDirectionVectorY (+0x6E), s) >> 12` (`0x6FD5CF2C`).
 */
export function PATH_StepVelocity113c(m: Memory113c, pPath: number, nRate: number): void {
  const rate = (nRate | 0) > 0 ? nRate | 0 : 0x400
  const acc = m.get(pPath, D2DynamicPathStrc.dwAcceleration) | 0
  if (acc !== 0) {
    const cnt = (m.get(pPath, D2DynamicPathStrc.nAccelStepCounter) + 1) | 0
    m.set(pPath, D2DynamicPathStrc.nAccelStepCounter, cnt >>> 0)
    if (cnt >= 5) {
      const vel = ((m.get(pPath, D2DynamicPathStrc.dwVelocity) | 0) + acc) | 0
      const maxVel = m.get(pPath, D2DynamicPathStrc.dwMaxVelocity) | 0
      m.set(pPath, D2DynamicPathStrc.dwVelocity, vel >>> 0)
      if (vel > maxVel) {
        m.set(pPath, D2DynamicPathStrc.dwVelocity, maxVel >>> 0)
        m.set(pPath, D2DynamicPathStrc.dwAcceleration, 0)
      } else if (vel < 0) {
        m.set(pPath, D2DynamicPathStrc.dwVelocity, 0)
      }
      m.set(pPath, D2DynamicPathStrc.nAccelStepCounter, 0)
    }
  }
  const s = sar32(imul32(m.get(pPath, D2DynamicPathStrc.dwVelocity) | 0, rate), 6)
  const dirX = m.get(pPath, D2DynamicPathStrc.tDirectionVectorX) | 0
  m.set(pPath, D2DynamicPathStrc.tVelocityVectorX, sar32(imul32(dirX, s), 12) >>> 0)
  const dirY = m.get(pPath, D2DynamicPathStrc.tDirectionVectorY) | 0
  m.set(pPath, D2DynamicPathStrc.tVelocityVectorY, sar32(imul32(dirY, s), 12) >>> 0)
}

/**
 * `@va D2Common:0x6FD5CF40` (`PATH_GetDirectionVector`, not exported; stdcall `(nX1, nY1, nX2, nY2, int* pVec, int* pDir)`, `ret 0x18`).
 *
 * - `0x6FD5CF4B cmp ecx, esi; ja` (unsigned) -> `bXPos = (u32)x1 <= (u32)x2`, `xMax/xMin` by unsigned compare.
 * - `0x6FD5CF72 cmp edx, edi; ja` (unsigned) -> `bYPos = (u32)y1 <= (u32)y2`, `yMax/yMin` by unsigned compare.
 * - `0x6FD5CF88 cmp ebx, edi; jg` (signed) -> `xMajor = (int32)(xMax - xMin) > (int32)(yMax - yMin)`.
 * - `0x6FD5CFA1..0x6FD5CFAD`: `idx = major != 0 ? sdiv32(imul32(minor, 127), major) : 0`.
 * - Reads `{a, b, ang}` from `PATH_DIRECTION_TABLE_6FDDD470[idx * 3 .. +2]`, folds octant/quadrant signs and angles,
 *   stores `pVec[0..1]` and `*pDir = (d + 8) & 0x3F`, and returns `*pDir`.
 */
export function PATH_GetDirectionVector113c(
  m: Memory113c,
  nX1: number,
  nY1: number,
  nX2: number,
  nY2: number,
  pVec: number,
  pDir: number,
): number {
  const uX1 = nX1 >>> 0
  const uX2 = nX2 >>> 0
  const bXPos = uX1 <= uX2 ? 1 : 0
  const xMax = bXPos !== 0 ? uX2 : uX1
  const xMin = bXPos !== 0 ? uX1 : uX2

  const uY1 = nY1 >>> 0
  const uY2 = nY2 >>> 0
  const bYPos = uY1 <= uY2 ? 1 : 0
  const yMax = bYPos !== 0 ? uY2 : uY1
  const yMin = bYPos !== 0 ? uY1 : uY2

  const dx = (xMax - xMin) | 0
  const dy = (yMax - yMin) | 0
  const xMajor = dx > dy ? 1 : 0
  const major = xMajor !== 0 ? dx : dy
  const minor = xMajor !== 0 ? dy : dx
  const idx = major !== 0 ? sdiv32(imul32(minor, 0x7f), major) : 0

  const base = idx * 3
  const a = PATH_DIRECTION_TABLE_6FDDD470[base]! | 0
  const b = PATH_DIRECTION_TABLE_6FDDD470[base + 1]! | 0
  const ang = PATH_DIRECTION_TABLE_6FDDD470[base + 2]! | 0

  let d: number
  if (xMajor !== 0) {
    m.setU32((pVec + 4) >>> 0, a >>> 0)
    m.setU32(pVec, b >>> 0)
    d = ~ang & 0x0f
  } else {
    m.setU32(pVec, a >>> 0)
    m.setU32((pVec + 4) >>> 0, b >>> 0)
    d = ang
  }

  if (bYPos === 0) {
    const vy = (-m.u32((pVec + 4) >>> 0)) | 0
    m.setU32((pVec + 4) >>> 0, vy >>> 0)
    d = ~d & 0x1f
  }

  if (bXPos !== 0) {
    d = ~d & 0x3f
  } else {
    const vx = (-m.u32(pVec)) | 0
    m.setU32(pVec, vx >>> 0)
  }

  const outDir = (d + 8) & 0x3f
  m.setU32(pDir, outDir >>> 0)
  return outDir
}

/**
 * `@va D2Common:0x6FD68310` (`PATH_SimplifyToLines`, not exported; LTCG `edx = pPoints` + 3 stack args
 * `(dwStartPt, pOut, nPoints)`, `ret 0xC`). Sole caller `0x6FD68C40` (`0x6FD68D6B`).
 *
 * Compresses a `u16 (x, y)` point array into line segment endpoints:
 * - `nPoints < 2` (`0x6FD68316`): if `nPoints == 1`, copies `pPoints[0]` (dword) to `pOut[0]` and returns `1`; else `0`.
 * - `pdx = pts[0].x - (u16)dwStartPt`, `pdy = pts[0].y - (dwStartPt >>> 16)` (`0x6FD68342..0x6FD6834E`).
 * - Walks `i = 0 .. nPoints - 2` (`0x6FD68370..0x6FD683DC`):
 *   - same `(dx, dy)` as `(pdx, pdy)` -> `run++`;
 *   - `run <= 0 && pdx != dx && pdy != dy` -> `run = 1; dx = -2` (sentinel stored into `pdx` so a single-step diagonal
 *     jog can continue without emitting a vertex, unless the very next real step has `dx == -2 && dy == pdy`);
 *   - otherwise emits `pts[i]` to `pOut[cnt++]` and resets `run = 0`.
 * - Always appends `pts[nPoints - 1]` (`0x6FD683E5`) and returns `cnt`.
 */
export function PATH_SimplifyToLines113c(
  m: Memory113c,
  pPoints: number,
  dwStartPt: number,
  pOut: number,
  nPoints: number,
): number {
  const n = nPoints | 0
  if (n < 2) {
    if (n === 1) {
      m.setU32(pOut, m.u32(pPoints))
      return 1
    }
    return 0
  }
  const startX = dwStartPt & 0xffff
  const startY = dwStartPt >>> 16
  let pdx = (m.u16(pPoints) - startX) | 0
  let pdy = (m.u16((pPoints + 2) >>> 0) - startY) | 0
  let cnt = 0
  let run = 0
  const last = (n - 1) | 0
  for (let i = 0; i < last; i++) {
    const pCur = (pPoints + i * 4) >>> 0
    const x0 = m.u16(pCur)
    const x1 = m.u16((pCur + 4) >>> 0)
    const y0 = m.u16((pCur + 2) >>> 0)
    let dx = (x1 - x0) | 0
    const y1 = m.u16((pCur + 6) >>> 0)
    const dy = (y1 - y0) | 0
    if (dx === pdx && dy === pdy) {
      run = (run + 1) | 0
    } else if (run <= 0 && pdx !== dx && pdy !== dy) {
      run = 1
      dx = -2
    } else {
      m.setU32((pOut + cnt * 4) >>> 0, m.u32(pCur))
      cnt = (cnt + 1) | 0
      run = 0
    }
    pdx = dx
    pdy = dy
  }
  m.setU32((pOut + cnt * 4) >>> 0, m.u32((pPoints + last * 4) >>> 0))
  return (cnt + 1) | 0
}

/**
 * `@va D2Common:0x6FD684C0` (`PATH_BresenhamLine`, not exported; LTCG `edi = pOut` + 4 stack args
 * `(dwStartPt, dwEndPt, nMax, int* pDir)`, `ret 0x10`). Sole caller `0x6FD68C40` (`0x6FD68CCC`).
 *
 * Rasterises a 16-bit `(x, y)` Bresenham line from `dwStartPt` (exclusive) to `dwEndPt` (inclusive) into `pOut`:
 * - Initializes `*pDir = 0` (`0x6FD684F1`), `lim = nMax - 1` (`0x6FD684DA`).
 * - Updates `*pDir` (`1`/+X, `3`/-X for X-major or horizontal; `2`/+Y, `0`/-Y for Y-major or vertical) BEFORE checking
 *   whether `major > lim` (`0x6FD6853B/0x6FD68589/0x6FD685D3/0x6FD68639`).
 * - On `(0, 0)` delta (`0x6FD68528`) or `major > lim` (`0x6FD68641`), writes `pOut[0].x = 0` (16-bit word only;
 *   `pOut[0].y` is untouched) and returns `0`.
 * - Otherwise writes `major` `(u16 x, u16 y)` points, terminates with `pOut[major].x = 0` (16-bit word only,
 *   `0x6FD68561/0x6FD685B1/0x6FD68621/0x6FD68693`), and returns `major`.
 */
export function PATH_BresenhamLine113c(
  m: Memory113c,
  pOut: number,
  dwStartPt: number,
  dwEndPt: number,
  nMax: number,
  pDir: number,
): number {
  const lim = (nMax - 1) | 0
  const x0 = dwStartPt & 0xffff
  const y0 = dwStartPt >>> 16
  const x1 = dwEndPt & 0xffff
  const y1 = dwEndPt >>> 16
  let dx = (x1 - x0) | 0
  let dy = (y1 - y0) | 0
  m.setU32(pDir, 0)

  let sx = 1
  if (dx < 0) {
    dx = (-dx) | 0
    sx = -1
  }
  let sy = 1
  if (dy < 0) {
    dy = (-dy) | 0
    sy = -1
  }

  let count = 0
  if (dx === 0) {
    if (dy <= 0) {
      m.setU16(pOut, 0)
      return 0
    }
    m.setU32(pDir, sy > 0 ? 2 : 0)
    if (dy > lim) {
      m.setU16(pOut, 0)
      return 0
    }
    let y = y0
    for (let i = 0; i < dy; i++) {
      y = (y + sy) & 0xffff
      const p = (pOut + count * 4) >>> 0
      m.setU16(p, x0)
      m.setU16((p + 2) >>> 0, y)
      count = (count + 1) | 0
    }
    m.setU16((pOut + count * 4) >>> 0, 0)
    return count
  }

  if (dy === 0) {
    m.setU32(pDir, sx <= 0 ? 3 : 1)
    if (dx > lim) {
      m.setU16(pOut, 0)
      return 0
    }
    let x = x0
    for (let i = 0; i < dx; i++) {
      x = (x + sx) & 0xffff
      const p = (pOut + count * 4) >>> 0
      m.setU16(p, x)
      m.setU16((p + 2) >>> 0, y0)
      count = (count + 1) | 0
    }
    m.setU16((pOut + count * 4) >>> 0, 0)
    return count
  }

  if (dx >= dy) {
    m.setU32(pDir, sx <= 0 ? 3 : 1)
    if (dx > lim) {
      m.setU16(pOut, 0)
      return 0
    }
    let err = 0
    let x = x0
    let y = y0
    for (let i = 0; i < dx; i++) {
      err = (err + dy) | 0
      x = (x + sx) & 0xffff
      if (err >= dx) {
        err = (err - dx) | 0
        y = (y + sy) & 0xffff
      }
      const p = (pOut + count * 4) >>> 0
      m.setU16((p + 2) >>> 0, y)
      m.setU16(p, x)
      count = (count + 1) | 0
    }
    m.setU16((pOut + count * 4) >>> 0, 0)
    return count
  }

  m.setU32(pDir, sy > 0 ? 2 : 0)
  if (dy > lim) {
    m.setU16(pOut, 0)
    return 0
  }
  let err = 0
  let x = x0
  let y = y0
  for (let i = 0; i < dy; i++) {
    y = (y + sy) & 0xffff
    err = (err + dx) | 0
    if (err >= dy) {
      err = (err - dy) | 0
      x = (x + sx) & 0xffff
    }
    const p = (pOut + count * 4) >>> 0
    m.setU16(p, x)
    m.setU16((p + 2) >>> 0, y)
    count = (count + 1) | 0
  }
  m.setU16((pOut + count * 4) >>> 0, 0)
  return count
}

/**
 * `@va D2Common:0x6FD84580` (`D2Common.#10769` `PATH_ComputeSquaredDistance`, stdcall `(nX1, nY1, nX2, nY2)`, `ret 0x10`).
 *
 * `dx = nX2 - nX1; dy = nY2 - nY1; return imul32(dy, dy) + imul32(dx, dx)` (`0x6FD8458C..0x6FD8459E`, 32-bit wrapping).
 */
export function PATH_ComputeSquaredDistance113c(nX1: number, nY1: number, nX2: number, nY2: number): number {
  const dx = (nX2 - nX1) | 0
  const dy = (nY2 - nY1) | 0
  return (imul32(dy, dy) + imul32(dx, dx)) | 0
}

/**
 * `@va D2Common:0x6FD845B0` (`D2Common.#10671` `PATH_SetUnitCollisionPattern`, stdcall `(pUnit, dwCollisionPattern)`, `ret 8`).
 *
 * `pUnit->pPath (+0x2C)->dwCollisionPattern (+0x48) = dwCollisionPattern` (`0x6FD845B4 / 0x6FD845BB`, no NULL checks).
 */
export function PATH_SetUnitCollisionPattern113c(m: Memory113c, pUnit: number, dwCollisionPattern: number): void {
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  m.set(pPath, D2DynamicPathStrc.dwCollisionPattern, dwCollisionPattern >>> 0)
}

/**
 * `@va D2Common:0x6FD845D0` (`D2Common.#10123` `PATH_GetUnitCollisionPattern`, stdcall `(pUnit)`, `ret 4`).
 *
 * Returns `pUnit->pPath (+0x2C)->dwCollisionPattern (+0x48)` (`0x6FD845D4 / 0x6FD845D7`, no NULL checks).
 */
export function PATH_GetUnitCollisionPattern113c(m: Memory113c, pUnit: number): number {
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  return m.get(pPath, D2DynamicPathStrc.dwCollisionPattern)
}

/**
 * `@va D2Common:0x6FD84690` (`D2Common.#10229` `PATH_GetStepNum`, stdcall `(pPath)`, `ret 4`).
 *
 * `movzx eax, byte [eax+0x93]; inc eax; ret 4` (`0x6FD84694 / 0x6FD8469B`, no NULL check; returns `1..256`).
 */
export function PATH_GetStepNum113c(m: Memory113c, pPath: number): number {
  return (m.get(pPath, D2DynamicPathStrc.nStepNum) + 1) | 0
}

/**
 * `@va D2Common:0x6FD846A0` (`D2Common.#11005` `PATH_SetStepNum`, stdcall `(pPath, nSteps)`, `ret 8`).
 *
 * NULL -> no-op (`0x6FD846A4`). Otherwise `al = (u8)nSteps`; if `al != 0 && al < 0x14` (`jbe` / `jae` unsigned)
 * writes `al - 1` to `pPath->nStepNum (+0x93)` (`0x6FD846B6`), else writes `0` (`0x6FD846BF`).
 */
export function PATH_SetStepNum113c(m: Memory113c, pPath: number, nSteps: number): void {
  if (pPath === 0) return
  const b = nSteps & 0xff
  m.set(pPath, D2DynamicPathStrc.nStepNum, b !== 0 && b < 0x14 ? (b - 1) & 0xff : 0)
}

/**
 * `@va D2Common:0x6FD846D0` (`D2Common.#10723` `PATH_ClearPrevTargetCoord`, stdcall `(pPath)`, `ret 4`).
 *
 * Zeroes `pPath->wPrevTargetX (+0x14)` and `pPath->wPrevTargetY (+0x16)` as 16-bit words (`0x6FD846D6 / 0x6FD846DA`,
 * no NULL check).
 */
export function PATH_ClearPrevTargetCoord113c(m: Memory113c, pPath: number): void {
  m.set(pPath, D2DynamicPathStrc.wPrevTargetX, 0)
  m.set(pPath, D2DynamicPathStrc.wPrevTargetY, 0)
}

/**
 * `@va D2Common:0x6FD84860` (`D2Common.#11058` `PATH_GetMaxDistance`, stdcall `(pPath)`, `ret 4`).
 *
 * `mov eax, [esp+4]; mov al, [eax+0x91]; ret 4`: returns the low byte `AL = pPath->nDistMax (+0x91)` (no NULL check;
 * upper 24 bits of `eax` in the x86 caller are the pointer high bits, so callers read `AL` / `u8`).
 */
export function PATH_GetMaxDistance113c(m: Memory113c, pPath: number): number {
  return m.get(pPath, D2DynamicPathStrc.nDistMax)
}

/**
 * `@va D2Common:0x6FD84870` (`D2Common.#10981` `PATH_GetDistance`, stdcall `(pPath)`, `ret 4`).
 *
 * `mov eax, [esp+4]; mov al, [eax+0x90]; ret 4`: returns the low byte `AL = pPath->nDist (+0x90)` (no NULL check).
 */
export function PATH_GetDistance113c(m: Memory113c, pPath: number): number {
  return m.get(pPath, D2DynamicPathStrc.nDist)
}

/**
 * `@va D2Common:0x6FD84880` (`D2Common.#10527` `PATH_SetDistance`, stdcall `(pPath, nDist)`, `ret 8`).
 *
 * `mov al, [esp+8]; mov ecx, [esp+4]; mov [ecx+0x90], al; ret 8` (`pPath->nDist = (u8)nDist`, no NULL check).
 */
export function PATH_SetDistance113c(m: Memory113c, pPath: number, nDist: number): void {
  m.set(pPath, D2DynamicPathStrc.nDist, nDist & 0xff)
}

/**
 * `@va D2Common:0x6FD848A0` (`D2Common.#10471` `PATH_GetType`, stdcall `(pPath)`, `ret 4`).
 *
 * Returns `pPath->dwPathType (+0x3C)` (`0x6FD848A4`, no NULL check).
 */
export function PATH_GetType113c(m: Memory113c, pPath: number): number {
  return m.get(pPath, D2DynamicPathStrc.dwPathType)
}

/**
 * `@va D2Common:0x6FD848B0` (`D2Common.#11164` `PATH_SetMoveTestCollisionMask`, stdcall `(pPath, dwMask)`, `ret 8`).
 *
 * Stores full 32-bit `dwMask` at `pPath->nMoveTestCollisionMask (+0x50)` (`0x6FD848B8 mov [ecx+0x50], eax`, no NULL check).
 */
export function PATH_SetMoveTestCollisionMask113c(m: Memory113c, pPath: number, dwMask: number): void {
  m.set(pPath, D2DynamicPathStrc.nMoveTestCollisionMask, dwMask >>> 0)
}

/**
 * `@va D2Common:0x6FD848C0` (`D2Common.#11083` `PATH_GetMoveTestCollisionMask`, stdcall `(pPath)`, `ret 4`).
 *
 * Loads full 32-bit `pPath->nMoveTestCollisionMask (+0x50)` (`0x6FD848C4 mov eax, [eax+0x50]`, no NULL check).
 */
export function PATH_GetMoveTestCollisionMask113c(m: Memory113c, pPath: number): number {
  return m.get(pPath, D2DynamicPathStrc.nMoveTestCollisionMask)
}

/**
 * `@va D2Common:0x6FD848D0` (`D2Common.#10259` `PATH_GetFootprintCollisionMask`, stdcall `(pPath)`, `ret 4`).
 *
 * NULL -> `0xFFFF` (`0x6FD848D8 mov eax, 0xffff`); otherwise `pPath->nFootprintCollisionMask (+0x4C)` (`0x6FD848E0`).
 */
export function PATH_GetFootprintCollisionMask113c(m: Memory113c, pPath: number): number {
  if (pPath === 0) return 0xffff
  return m.get(pPath, D2DynamicPathStrc.nFootprintCollisionMask)
}

/**
 * `@va D2Common:0x6FD848F0` (`D2Common.#10392` `PATH_GetTargetUnit`, stdcall `(pPath)`, `ret 4`).
 *
 * NULL -> `0` (`0x6FD848F4 test eax, eax; jne; ret 4`); otherwise `pPath->pTargetUnit (+0x58)` (`0x6FD848FB`).
 */
export function PATH_GetTargetUnit113c(m: Memory113c, pPath: number): number {
  if (pPath === 0) return 0
  return m.get(pPath, D2DynamicPathStrc.pTargetUnit)
}

/**
 * `PATH_SetDirection` `.rdata` turn-rate table at `0x6FDE41C8` (64 `int32_t` entries, 256 bytes total;
 * read as `mov al, byte [eax*4+0x6fde41c8]` at `0x6FD850DD`).
 */
export const PATH_DIR_TURN_RATE_TABLE_6FDE41C8 = Int32Array.from([
  0, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 4, 4, 4, 4, 4,
  4, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
  -8, -8, -8, -8, -8, -8, -8, -8, -8, -8, -8, -8, -8, -8, -8, -8,
  -4, -4, -4, -4, -4, -4, -4, -4, -1, -1, -1, -1, -1, -1, -1, -1,
])

/**
 * `PATH_OctileDistanceWithTable` `.rdata` 8x8 lookup table at `0x6FDE3F20` (64 `int32_t` entries, 256 bytes total).
 */
export const PATH_OCTILE_DISTANCE_TABLE_6FDE3F20 = Int32Array.from([
  -1, -1, -1, 0, 2, 4, 6, 8,
  -1, -1, 0, 1, 2, 4, 6, 8,
  -1, 0, 0, 2, 3, 5, 7, 8,
  0, 1, 2, 2, 4, 5, 7, 8,
  2, 2, 3, 4, 5, 6, 7, 9,
  4, 4, 5, 5, 6, 7, 8, 9,
  6, 6, 7, 7, 7, 8, 10, 10,
  8, 8, 8, 8, 9, 9, 10, 11,
])

/**
 * `PATH_IdaStar_AdvanceNeighborIndex` `.rdata` 32-entry jitter table at `0x6FDDB960` (32 `int32_t` entries, 128 bytes).
 */
export const PATH_IDASTAR_JITTER_TABLE_6FDDB960 = Int32Array.from([
  -2, -1, 0, 1, 2, -2, -1, 0,
  1, 2, -2, -1, 0, 1, 2, -2,
  -1, 0, 1, 2, -2, -1, 0, 1,
  2, -2, -1, 0, 1, 2, -1, 1,
])

/**
 * `PATH_AStar` `.rdata` X-coordinate permutation table at `0x6FDDB458` (128 `uint32_t` entries, 512 bytes).
 */
export const PATH_ASTAR_HASH_X_6FDDB458 = Uint32Array.from([
  57, 92, 72, 94, 119, 80, 14, 84, 93, 17, 20, 37, 87, 70, 100, 108,
  30, 91, 85, 60, 40, 3, 118, 78, 81, 109, 43, 26, 67, 27, 49, 75,
  69, 2, 58, 36, 55, 5, 122, 125, 11, 35, 77, 59, 29, 18, 28, 82,
  63, 86, 83, 105, 90, 48, 101, 38, 115, 9, 41, 89, 95, 19, 1, 61,
  51, 7, 110, 34, 126, 47, 15, 6, 99, 22, 104, 4, 71, 97, 121, 114,
  0, 112, 62, 54, 23, 111, 74, 123, 45, 120, 44, 50, 31, 39, 42, 66,
  33, 113, 53, 64, 16, 65, 106, 96, 88, 24, 46, 56, 103, 68, 10, 117,
  25, 32, 124, 127, 76, 8, 79, 21, 102, 52, 107, 73, 13, 116, 98, 12,
])

/**
 * `PATH_AStar` `.rdata` Y-coordinate permutation table at `0x6FDDB658` (128 `uint32_t` entries, 512 bytes).
 */
export const PATH_ASTAR_HASH_Y_6FDDB658 = Uint32Array.from([
  114, 80, 68, 91, 97, 73, 127, 88, 18, 58, 101, 41, 19, 108, 6, 8,
  24, 99, 83, 33, 77, 56, 74, 37, 43, 107, 85, 12, 75, 30, 27, 23,
  92, 69, 115, 2, 84, 7, 17, 20, 117, 67, 31, 121, 111, 105, 120, 96,
  94, 122, 47, 25, 4, 112, 34, 62, 10, 89, 1, 40, 76, 71, 49, 51,
  90, 55, 118, 50, 116, 106, 109, 42, 45, 65, 28, 60, 123, 36, 98, 48,
  124, 22, 64, 38, 15, 102, 110, 79, 57, 125, 59, 21, 70, 63, 93, 86,
  66, 35, 16, 53, 61, 103, 29, 52, 119, 46, 100, 3, 0, 126, 32, 81,
  87, 9, 26, 14, 95, 113, 13, 54, 104, 82, 44, 72, 5, 78, 11, 39,
])

/**
 * `@va D2Common:0x6FD84D30` (`D2Common.#10777` `PATH_GetVelocity`, stdcall `(pPath)`, `ret 4`).
 *
 * Returns `pPath->dwVelocity (+0x7C)` (`0x6FD84D34`, no NULL check).
 */
export function PATH_GetVelocity113c(m: Memory113c, pPath: number): number {
  return m.get(pPath, D2DynamicPathStrc.dwVelocity)
}

/**
 * `@va D2Common:0x6FD84D40` (`D2Common.#10488` `PATH_SetVelocity`, stdcall `(pPath, nVelocity, szFile, nLine)`, `ret 0x10`).
 *
 * - NULL `pPath` -> no-op (`0x6FD84D44`).
 * - If `nVelocity != pPath->dwVelocity (+0x7C)`, writes `0x0F` to `pPath->dwVelocityChangeCounter (+0x38)` (`0x6FD84D54`).
 * - Writes `nVelocity` to `pPath->dwVelocity (+0x7C)` and `pPath->dwMaxVelocity (+0x84)` (`0x6FD84D5B..0x6FD84D5E`).
 */
export function PATH_SetVelocity113c(
  m: Memory113c,
  pPath: number,
  nVelocity: number,
  _szFile = 0,
  _nLine = 0,
): void {
  if (pPath === 0) return
  const v = nVelocity >>> 0
  if (v !== m.get(pPath, D2DynamicPathStrc.dwVelocity)) {
    m.set(pPath, D2DynamicPathStrc.dwVelocityChangeCounter, 0x0f)
  }
  m.set(pPath, D2DynamicPathStrc.dwVelocity, v)
  m.set(pPath, D2DynamicPathStrc.dwMaxVelocity, v)
}

/**
 * `@va D2Common:0x6FD84E70` (`PATH_UpdateOutOfRoomFlag`, not exported; LTCG `eax = pPath`, plain `ret`).
 *
 * - Clears bit 0 of `pPath->dwFlags (+0x34)` (`0x6FD84E79..0x6FD84E83`).
 * - If `(int32)pPath->dwPathPoints (+0x28) > 0` (`0x6FD84E86`), walks `i = 0 .. dwPathPoints - 1`:
 *   - Reads `pRoom = pPath->pRoom (+0x1C)`, `x = pPath->wPathPoints[i].x (+0x9C + i*4)`,
 *     `y = pPath->wPathPoints[i].y (+0x9E + i*4)`.
 *   - If `pRoom == 0` or `x < r.nSubtileX` or `x >= r.nSubtileX + r.nSubtileWidth` or
 *     `y < r.nSubtileY` or `y >= r.nSubtileY + r.nSubtileHeight` (signed `jl`/`jge`), sets bit 0 of `dwFlags`
 *     and returns (`0x6FD84ED1..0x6FD84EDB`).
 */
export function PATH_UpdateOutOfRoomFlag113c(m: Memory113c, pPath: number): void {
  let flags = (m.get(pPath, D2DynamicPathStrc.dwFlags) & ~1) >>> 0
  m.set(pPath, D2DynamicPathStrc.dwFlags, flags)
  const nPts = m.get(pPath, D2DynamicPathStrc.dwPathPoints) | 0
  if (nPts <= 0) return
  for (let i = 0; i < nPts; i++) {
    const pRoom = m.get(pPath, D2DynamicPathStrc.pRoom)
    if (pRoom === 0) {
      flags = (flags | 1) >>> 0
      m.set(pPath, D2DynamicPathStrc.dwFlags, flags)
      return
    }
    const ptOff = (pPath + 0x9c + i * 4) >>> 0
    const x = m.u16(ptOff)
    const y = m.u16((ptOff + 2) >>> 0)
    const rx = m.get(pRoom, D2ActiveRoomStrc.nSubtileX) | 0
    if (x < rx) {
      flags = (flags | 1) >>> 0
      m.set(pPath, D2DynamicPathStrc.dwFlags, flags)
      return
    }
    const rw = m.get(pRoom, D2ActiveRoomStrc.nSubtileWidth) | 0
    if (x >= ((rx + rw) | 0)) {
      flags = (flags | 1) >>> 0
      m.set(pPath, D2DynamicPathStrc.dwFlags, flags)
      return
    }
    const ry = m.get(pRoom, D2ActiveRoomStrc.nSubtileY) | 0
    if (y < ry) {
      flags = (flags | 1) >>> 0
      m.set(pPath, D2DynamicPathStrc.dwFlags, flags)
      return
    }
    const rh = m.get(pRoom, D2ActiveRoomStrc.nSubtileHeight) | 0
    if (y >= ((ry + rh) | 0)) {
      flags = (flags | 1) >>> 0
      m.set(pPath, D2DynamicPathStrc.dwFlags, flags)
      return
    }
  }
}

/**
 * `@va D2Common:0x6FD84F50` (`D2Common.#10168` `PATH_SetNewDistance`, stdcall `(pPath, nNewDist)`, `ret 8`).
 *
 * - NULL `pPath` -> no-op (`0x6FD84F56`).
 * - Zero-extends low byte `v = nNewDist & 0xFF`; clamps `if (v >= 0x4D) v = 0x4D`; writes `v` to both
 *   `pPath->nDistMax (+0x91)` and `pPath->nDist (+0x90)` (`0x6FD84F64..0x6FD84F6A`).
 */
export function PATH_SetNewDistance113c(m: Memory113c, pPath: number, nNewDist: number): void {
  if (pPath === 0) return
  let v = nNewDist & 0xff
  if (v >= 0x4d) v = 0x4d
  m.set(pPath, D2DynamicPathStrc.nDistMax, v)
  m.set(pPath, D2DynamicPathStrc.nDist, v)
}

/**
 * `@va D2Common:0x6FD85040` (`D2Common.#10336` `PATH_SetTargetUnit`, stdcall `(pPath, pUnit)`, `ret 8`).
 *
 * Writes `pPath->pTargetUnit (+0x58) = pUnit`; if `pUnit != 0`, also copies `pUnit->dwUnitType (+0x00)` to
 * `pPath->dwTargetType (+0x5C)` and `pUnit->dwUnitId (+0x0C)` to `pPath->dwTargetId (+0x60)`.
 */
export function PATH_SetTargetUnit113c(m: Memory113c, pPath: number, pUnit: number): void {
  const u = pUnit >>> 0
  m.set(pPath, D2DynamicPathStrc.pTargetUnit, u)
  if (u !== 0) {
    m.set(pPath, D2DynamicPathStrc.dwTargetType, m.get(u, D2UnitStrc.dwUnitType))
    m.set(pPath, D2DynamicPathStrc.dwTargetId, m.get(u, D2UnitStrc.dwUnitId))
  }
}

/**
 * `@va D2Common:0x6FD85080` (`D2Common.#10165` `PATH_SetNumberOfPathPoints`, stdcall `(pPath, nPoints)`, `ret 8`).
 *
 * Clamps signed `nPoints > 0x4D` to `0x4D` (`cmp eax, 0x4d; jle` at `0x6FD85084..0x6FD85087`, no lower bound clamp)
 * and stores into `pPath->dwPathPoints (+0x28)`.
 */
export function PATH_SetNumberOfPathPoints113c(m: Memory113c, pPath: number, nPoints: number): void {
  const pts = (nPoints | 0) > 0x4d ? 0x4d : nPoints | 0
  m.set(pPath, D2DynamicPathStrc.dwPathPoints, pts >>> 0)
}

/**
 * `@va D2Common:0x6FD850B0` (`PATH_SetDirection`, not exported; LTCG `ecx = pPath`, `al = nDir`, plain `ret`).
 *
 * - Masks `dir = nDir & 0x3F`; reads `pUnit = pPath->pUnit (+0x30)` and `uType = pUnit ? pUnit->dwUnitType : 6`.
 * - `uType == 2` (object) or `uType == 4` (item): writes `pPath->nDirection (+0x64) = dir`.
 * - `uType == 3` (missile): if `(pPath->dwFlags (+0x34) & 0x40) == 0`, writes `pPath->nDirection (+0x64) = dir`.
 * - Otherwise (`uType == 0, 1, 5, 6, ...`): if `dir != pPath->nNewDirection (+0x65)`, sets `nNewDirection = dir` and
 *   `nDiffDirection (+0x66) = PATH_DIR_TURN_RATE_TABLE_6FDE41C8[(dir - nDirection) & 0x3F] & 0xFF`.
 */
export function PATH_SetDirection113c(m: Memory113c, pPath: number, nDir: number): void {
  const dir = nDir & 0x3f
  const pUnit = m.get(pPath, D2DynamicPathStrc.pUnit)
  const uType = pUnit === 0 ? 6 : m.get(pUnit, D2UnitStrc.dwUnitType) | 0
  if (uType === 2 || uType === 4) {
    m.set(pPath, D2DynamicPathStrc.nDirection, dir)
    return
  }
  if (uType === 3) {
    if ((m.get(pPath, D2DynamicPathStrc.dwFlags) & 0x40) === 0) {
      m.set(pPath, D2DynamicPathStrc.nDirection, dir)
    }
    return
  }
  if (dir !== m.get(pPath, D2DynamicPathStrc.nNewDirection)) {
    const oldDir = m.get(pPath, D2DynamicPathStrc.nDirection)
    m.set(pPath, D2DynamicPathStrc.nNewDirection, dir)
    const diff = (dir - oldDir) & 0x3f
    m.set(pPath, D2DynamicPathStrc.nDiffDirection, PATH_DIR_TURN_RATE_TABLE_6FDE41C8[diff]! & 0xff)
  }
}

/**
 * `@va D2Common:0x6FD85100` (`PATH_GetMonsterMoveTestMask`, not exported; LTCG `eax = pMonsterUnit`, plain `ret`).
 *
 * - Resolves `pMonStatsTxt` for `pMonsterUnit->dwClassId (+0x04)` via `sgptDataTables (+0xA78 / +0xA80)`.
 * - Loads `pBitMasks = *(u32*)0x6FDD90B0` (`__imp_gdwBitMasks`).
 * - If `(pMonStatsTxt->nBitField2 (+0x0D) & u8(pBitMasks + 0x18)) != 0` (flying bit), returns `0x1804`.
 * - Else if `(pMonStatsTxt->nBitField1 (+0x0C) & u8(pBitMasks + 0x0C)) != 0` (open-doors bit), returns `0x3401`,
 *   otherwise `0x3C01`.
 */
export function PATH_GetMonsterMoveTestMask113c(m: Memory113c, pMonsterUnit: number): number {
  let pMonStats = 0
  if (pMonsterUnit !== 0) {
    const classId = m.get(pMonsterUnit, D2UnitStrc.dwClassId) | 0
    if (classId >= 0) {
      const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
      const count = m.u32((dt + DATATABLES_OFF_113C.nMonStatsTxtRecordCount) >>> 0) | 0
      if (classId < count) {
        pMonStats = (m.u32((dt + DATATABLES_OFF_113C.pMonStatsTxt) >>> 0) + imul32(classId, D2MonStatsTxt_SIZE)) >>> 0
      }
    }
  }
  const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
  const bf2 = m.get(pMonStats, D2MonStatsTxt.nBitField2)
  if ((bf2 & m.u8((pBitMasks + 0x18) >>> 0)) !== 0) {
    return 0x1804
  }
  const bf1 = m.get(pMonStats, D2MonStatsTxt.nBitField1)
  return (bf1 & m.u8((pBitMasks + 0x0c) >>> 0)) !== 0 ? 0x3401 : 0x3c01
}

/**
 * `@va D2Common:0x6FD8E110` (`PATH_NormalizePrecisionVector`, not exported; LTCG `eax = pVecX`, `ecx = pVecY`, plain `ret`).
 *
 * Arithmetic-shifts (`sar 1`) both `*pVecX` and `*pVecY` while `*pVecX > 0x10000` or `*pVecX < -0x10000`,
 * then again while `*pVecY > 0x10000` or `*pVecY < -0x10000`.
 */
export function PATH_NormalizePrecisionVector113c(m: Memory113c, pVecX: number, pVecY: number): void {
  const x0 = m.u32(pVecX) | 0
  if (x0 >= 0) {
    if (x0 > 0x10000) {
      do {
        m.setU32(pVecX, sar32(m.u32(pVecX) | 0, 1) >>> 0)
        m.setU32(pVecY, sar32(m.u32(pVecY) | 0, 1) >>> 0)
      } while ((m.u32(pVecX) | 0) > 0x10000)
    }
  } else if (x0 < -0x10000) {
    do {
      m.setU32(pVecX, sar32(m.u32(pVecX) | 0, 1) >>> 0)
      m.setU32(pVecY, sar32(m.u32(pVecY) | 0, 1) >>> 0)
    } while ((m.u32(pVecX) | 0) < -0x10000)
  }

  const y0 = m.u32(pVecY) | 0
  if (y0 >= 0) {
    if (y0 > 0x10000) {
      do {
        m.setU32(pVecX, sar32(m.u32(pVecX) | 0, 1) >>> 0)
        const ny = sar32(m.u32(pVecY) | 0, 1)
        m.setU32(pVecY, ny >>> 0)
        if (ny <= 0x10000) break
      } while (true)
    }
  } else if (y0 < -0x10000) {
    do {
      m.setU32(pVecX, sar32(m.u32(pVecX) | 0, 1) >>> 0)
      const ny = sar32(m.u32(pVecY) | 0, 1)
      m.setU32(pVecY, ny >>> 0)
      if (ny >= -0x10000) break
    } while (true)
  }
}

/**
 * `@va D2Common:0x6FD8E190` (`PATH_QuantizeDirectionIndex25`, not exported; stdcall `(dwStartCoord, dwEndCoord)`, `ret 8`).
 *
 * Quantizes the 16-bit `(x, y)` delta between `dwStartCoord` and `dwEndCoord` into a 5x5 grid index `5*sx + sy + 12` (`0..24`).
 */
export function PATH_QuantizeDirectionIndex25_113c(dwStartCoord: number, dwEndCoord: number): number {
  let edx = ((dwEndCoord & 0xffff) - (dwStartCoord & 0xffff)) | 0
  let esi = ((dwEndCoord >>> 16) - (dwStartCoord >>> 16)) | 0
  const absX = edx >= 0 ? edx : -edx | 0
  const absY = esi >= 0 ? esi : -esi | 0

  if (absX >= ((absY * 2) | 0)) {
    esi = esi < 0 ? -1 : esi & 1
    if (edx < -1) edx = -2
    else if (edx > 1) edx = 2
  } else {
    if (absY >= ((absX * 2) | 0)) {
      if (edx < 0) {
        edx = -1
      } else {
        edx = edx & 1
        if (edx < -1) edx = -2
        else if (edx > 1) edx = 2
      }
    } else {
      if (edx < -1) edx = -2
      else if (edx > 1) edx = 2
    }
  }

  if (esi < -1) esi = -2
  else if (esi > 1) esi = 2
  return (esi + edx * 5 + 12) | 0
}

/**
 * `@va D2Common:0x6FD8E2B0` (`PATH_OctileDistanceWithTable`, not exported; stdcall `(dwCoord1, dwCoord2)`, `ret 8`).
 *
 * For `|dx| < 8 && |dy| < 8`, returns `v < 0 ? 0 : v + 1` where `v = PATH_OCTILE_DISTANCE_TABLE_6FDE3F20[dx + dy * 8]`.
 * Otherwise returns `dx > dy ? dy + dx * 2 : dx + dy * 2`.
 */
export function PATH_OctileDistanceWithTable113c(dwCoord1: number, dwCoord2: number): number {
  let dx = ((dwCoord1 & 0xffff) - (dwCoord2 & 0xffff)) | 0
  if (dx < 0) dx = -dx | 0
  let dy = ((dwCoord1 >>> 16) - (dwCoord2 >>> 16)) | 0
  if (dy < 0) dy = -dy | 0
  if (dx < 8 && dy < 8) {
    const v = PATH_OCTILE_DISTANCE_TABLE_6FDE3F20[dx + dy * 8]! | 0
    return v < 0 ? 0 : (v + 1) | 0
  }
  return dx > dy ? (dy + dx * 2) | 0 : (dx + dy * 2) | 0
}

/**
 * `@va D2Common:0x6FDC0650` (`PATH_IdaStar_FlushNodeToDynamicPath`, not exported; LTCG `eax = pPathInfo`, `ecx = pNode`, plain `ret`).
 *
 * Walks the IDA* parent chain (`pNode->pParent` at `+0x14`, `(wPosX, wPosY)` at `+0x08..+0x0A`), pushing non-collinear
 * step vertices onto a reverse stack (up to 78 entries; root node with `pParent == 0` is excluded). If `1 < count < 78`,
 * copies `count` `uint32_t` coordinates in forward order into `pPathInfo->pDynamicPath (+0x30)->wPathPoints (+0x9C)`
 * and returns `count`; else returns `0`.
 */
export function PATH_IdaStar_FlushNodeToDynamicPath113c(m: Memory113c, pPathInfo: number, pNode: number): number {
  const pOut = (m.u32((pPathInfo + 0x30) >>> 0) + 0x9c) >>> 0
  if (pNode === 0) return 0
  const stack = new Uint32Array(0x4e)
  let count = 0
  let prevDx = -2
  let prevDy = -2
  let cur = pNode >>> 0
  while (cur !== 0 && count < 0x4e) {
    const pParent = m.get(cur, D2IdaStarNodeStrc.pParent)
    if (pParent !== 0) {
      const dx = (m.get(cur, D2IdaStarNodeStrc.wPosX) - m.get(pParent, D2IdaStarNodeStrc.wPosX)) | 0
      const dy = (m.get(cur, D2IdaStarNodeStrc.wPosY) - m.get(pParent, D2IdaStarNodeStrc.wPosY)) | 0
      if (dx !== prevDx || dy !== prevDy) {
        stack[count] = m.u32((cur + 0x08) >>> 0)
        count = (count + 1) | 0
        prevDx = dx
        prevDy = dy
      }
    }
    cur = pParent
  }
  if (count <= 1 || count >= 0x4e) return 0
  for (let i = 0; i < count; i++) {
    m.setU32((pOut + i * 4) >>> 0, stack[count - 1 - i]!)
  }
  return count
}

/**
 * `@va D2Common:0x6FDC07E0` (`PATH_IdaStar_AdvanceNeighborIndex`, not exported; LTCG `eax = pContext`, `esi = pNode`, plain `ret`).
 *
 * Advances `pNode->nNextNeighborIndex (+0x10)` modulo 8:
 * - If `*(u32*)(pContext + 0x36FD0) != 0`, steps the 64-bit LCG seed pointed to by `*(u32*)(pContext + 0x36FD4)`
 *   (writing `hi` at `+4` then `lo` at `+0`) and sets
 *   `pNode->nNextNeighborIndex = (PATH_IDASTAR_JITTER_TABLE_6FDDB960[newLo & 0x1F] + *pNode->pBestDirection + pNode->nNextNeighborIndex) & 7`.
 * - Otherwise sets `pNode->nNextNeighborIndex = (*pNode->pBestDirection + pNode->nNextNeighborIndex) & 7`.
 */
export function PATH_IdaStar_AdvanceNeighborIndex113c(m: Memory113c, pContext: number, pNode: number): void {
  const bRandom = m.u32((pContext + 0x36fd0) >>> 0)
  if (bRandom !== 0) {
    const pSeed = m.u32((pContext + 0x36fd4) >>> 0)
    const seed: D2SeedStrc = { lo: m.u32(pSeed), hi: m.u32((pSeed + 4) >>> 0) }
    seedNext(seed)
    m.setU32((pSeed + 4) >>> 0, seed.hi)
    m.setU32(pSeed, seed.lo)
    const pDelta = m.get(pNode, D2IdaStarNodeStrc.pBestDirection)
    const delta = m.u32(pDelta) | 0
    const curIdx = m.get(pNode, D2IdaStarNodeStrc.nNextNeighborIndex) | 0
    const jitter = PATH_IDASTAR_JITTER_TABLE_6FDDB960[seed.lo & 0x1f]! | 0
    const nextIdx = (jitter + delta + curIdx) & 7
    m.set(pNode, D2IdaStarNodeStrc.nNextNeighborIndex, nextIdx >>> 0)
    return
  }
  const pDelta = m.get(pNode, D2IdaStarNodeStrc.pBestDirection)
  const nextIdx = (m.u32(pDelta) + m.get(pNode, D2IdaStarNodeStrc.nNextNeighborIndex)) & 7
  m.set(pNode, D2IdaStarNodeStrc.nNextNeighborIndex, nextIdx >>> 0)
}

/**
 * `@va D2Common:0x6FDCAB50` (`PATH_AStar_FlushNodeToDynamicPath`, not exported; LTCG `eax = pPathInfo`, `ecx = pNode`, plain `ret`).
 *
 * Walks the A* parent chain (`pNode->pParent` at `+0x0C`, `(wPosX, wPosY)` at `+0x00..+0x02`), pushing non-collinear
 * step vertices onto a reverse stack (up to 78 entries; root node with `pParent == 0` is excluded). If `1 <= count < 78`,
 * copies `count` `uint32_t` coordinates in forward order into `pPathInfo->pDynamicPath (+0x30)->wPathPoints (+0x9C)`
 * and returns `count`; else returns `0`.
 */
export function PATH_AStar_FlushNodeToDynamicPath113c(m: Memory113c, pPathInfo: number, pNode: number): number {
  const pOut = (m.u32((pPathInfo + 0x30) >>> 0) + 0x9c) >>> 0
  if (pNode === 0) return 0
  const stack = new Uint32Array(0x4e)
  let count = 0
  let prevDx = -2
  let prevDy = -2
  let cur = pNode >>> 0
  while (cur !== 0 && count < 0x4e) {
    const pParent = m.get(cur, D2AStarNodeStrc.pParent)
    if (pParent !== 0) {
      const dx = (m.get(cur, D2AStarNodeStrc.wPosX) - m.get(pParent, D2AStarNodeStrc.wPosX)) | 0
      const dy = (m.get(cur, D2AStarNodeStrc.wPosY) - m.get(pParent, D2AStarNodeStrc.wPosY)) | 0
      if (dx !== prevDx || dy !== prevDy) {
        stack[count] = m.u32(cur)
        count = (count + 1) | 0
        prevDx = dx
        prevDy = dy
      }
    }
    cur = pParent
  }
  if (count < 1 || count >= 0x4e) return 0
  for (let i = 0; i < count; i++) {
    m.setU32((pOut + i * 4) >>> 0, stack[count - 1 - i]!)
  }
  return count
}

/**
 * `@va D2Common:0x6FDCAE20` (`PATH_AStar_PushToOpenAndHash`, not exported; LTCG `edi = pContext`, `esi = pNode`, plain `ret`).
 *
 * - Computes 7-bit bucket index `h = (PATH_ASTAR_HASH_Y_6FDDB658[u8(pNode+2) & 0x7F] + PATH_ASTAR_HASH_X_6FDDB458[u8(pNode) & 0x7F]) & 0x7F`.
 * - Pushes `pNode` at head of `pContext->pOpenHeaders[h]` (`pContext + h*4`, linked via `pNode->pHashNext` at `+0x30`).
 * - Inserts `pNode` into the ascending `wFScore` (`int16` at `+0x04`) chain rooted at `pContext->pOpenBest` (`pContext + 0x400`,
 *   linked via `pNode->pBestNext` at `+0x34`), placing `pNode` before the first node with `cur->wFScore >= pNode->wFScore`.
 */
export function PATH_AStar_PushToOpenAndHash113c(m: Memory113c, pContext: number, pNode: number): void {
  let cur = m.u32((pContext + 0x400) >>> 0)
  const yIdx = m.u8((pNode + 2) >>> 0) & 0x7f
  const xIdx = m.u8(pNode) & 0x7f
  const hash = (PATH_ASTAR_HASH_Y_6FDDB658[yIdx]! + PATH_ASTAR_HASH_X_6FDDB458[xIdx]!) & 0x7f
  const bucketAddr = (pContext + hash * 4) >>> 0
  m.set(pNode, D2AStarNodeStrc.pHashNext, m.u32(bucketAddr))
  m.setU32(bucketAddr, pNode >>> 0)

  const nodeF = (m.get(pNode, D2AStarNodeStrc.wFScore) << 16) >> 16
  if (cur !== 0) {
    let prev = 0
    while (cur !== 0) {
      const curF = (m.get(cur, D2AStarNodeStrc.wFScore) << 16) >> 16
      if (curF >= nodeF) break
      prev = cur
      cur = m.get(cur, D2AStarNodeStrc.pBestNext)
    }
    if (prev !== 0) {
      m.set(prev, D2AStarNodeStrc.pBestNext, pNode >>> 0)
      m.set(pNode, D2AStarNodeStrc.pBestNext, cur)
      return
    }
  }
  const head = m.u32((pContext + 0x400) >>> 0)
  m.set(pNode, D2AStarNodeStrc.pBestNext, head)
  m.setU32((pContext + 0x400) >>> 0, pNode >>> 0)
}

/**
 * `@va D2Common:0x6FDCAF70` (`PATH_AStar_EvaluateHeuristic`, not exported; stdcall `(dwCoord1, dwCoord2)`, `ret 8`).
 *
 * Returns `dx >= dy ? dy + dx * 2 : dx + dy * 2` where `dx = |(u16)dwCoord1 - (u16)dwCoord2|` and
 * `dy = |(dwCoord1 >>> 16) - (dwCoord2 >>> 16)|`.
 */
export function PATH_AStar_EvaluateHeuristic113c(dwCoord1: number, dwCoord2: number): number {
  let dx = ((dwCoord1 & 0xffff) - (dwCoord2 & 0xffff)) | 0
  if (dx < 0) dx = -dx | 0
  let dy = ((dwCoord1 >>> 16) - (dwCoord2 >>> 16)) | 0
  if (dy < 0) dy = -dy | 0
  return dx >= dy ? (dy + dx * 2) | 0 : (dx + dy * 2) | 0
}

/**
 * `@va D2Common:0x6FDCB220` (`PATH_AStar_PopBestOpenToClosed`, not exported; LTCG `esi = pContext`, plain `ret`).
 *
 * - Pops `pNode = pContext->pOpenBest` (`*(u32*)(pContext + 0x400)`); if `0`, returns `0`.
 * - Advances `pContext->pOpenBest = pNode->pBestNext (+0x34)`.
 * - Unlinks `pNode` from `pContext->pOpenHeaders[h]` (`pContext + h*4`, linked via `pHashNext` at `+0x30`),
 *   then pushes `pNode` onto `pContext->pClosedHeaders[h]` (`pContext + 0x200 + h*4`) and returns `pNode`.
 */
export function PATH_AStar_PopBestOpenToClosed113c(m: Memory113c, pContext: number): number {
  const pNode = m.u32((pContext + 0x400) >>> 0)
  if (pNode === 0) return 0
  m.setU32((pContext + 0x400) >>> 0, m.get(pNode, D2AStarNodeStrc.pBestNext))

  const yIdx = m.u8((pNode + 2) >>> 0) & 0x7f
  const xIdx = m.u8(pNode) & 0x7f
  const hash = (PATH_ASTAR_HASH_Y_6FDDB658[yIdx]! + PATH_ASTAR_HASH_X_6FDDB458[xIdx]!) & 0x7f
  const openBucketAddr = (pContext + hash * 4) >>> 0
  let cur = m.u32(openBucketAddr)
  let prev = 0
  if (cur !== pNode) {
    do {
      prev = cur
      cur = m.get(cur, D2AStarNodeStrc.pHashNext)
    } while (cur !== pNode)
  }
  if (prev !== 0) {
    m.set(prev, D2AStarNodeStrc.pHashNext, m.get(pNode, D2AStarNodeStrc.pHashNext))
  } else {
    m.setU32(openBucketAddr, m.get(pNode, D2AStarNodeStrc.pHashNext))
  }

  m.set(pNode, D2AStarNodeStrc.pHashNext, 0)
  const closedBucketAddr = (pContext + 0x200 + hash * 4) >>> 0
  const oldClosed = m.u32(closedBucketAddr)
  m.set(pNode, D2AStarNodeStrc.pHashNext, oldClosed)
  m.setU32(closedBucketAddr, pNode)
  return pNode
}

/**
 * `@va D2Common:0x6FD84990` (`D2Common.#10390` `PATH_SetCurrentRoomInvalid`, stdcall `(pPath, bInvalid)`, `ret 8`).
 *
 * Tests `bInvalid` (`[esp+8]`, no NULL check on `pPath`); if `bInvalid != 0`, sets bit `0x02`
 * (`PATH_CURRENT_ROOM_INVALID`) on `pPath->dwFlags (+0x34)`, else clears bit `0x02` (`& 0xFFFFFFFD`).
 */
export function PATH_SetCurrentRoomInvalid113c(m: Memory113c, pPath: number, bInvalid: number): void {
  const flags = m.get(pPath, D2DynamicPathStrc.dwFlags)
  if ((bInvalid | 0) !== 0) {
    m.set(pPath, D2DynamicPathStrc.dwFlags, (flags | 2) >>> 0)
  } else {
    m.set(pPath, D2DynamicPathStrc.dwFlags, (flags & 0xfffffffd) >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD849D0` (`D2Common.#10286` `PATH_SetTargetPos`, stdcall `(pPath, nTargetX, nTargetY)`, `ret 0xC`).
 *
 * - NULL `pPath` -> no-op (`0x6FD849D4`).
 * - Writes `u16` `nTargetX` to `pPath->wTargetX (+0x10)`, `u16` `nTargetY` to `pPath->wTargetY (+0x12)`,
 *   and `u32` `0` to `pPath->pTargetUnit (+0x58)`.
 */
export function PATH_SetTargetPos113c(m: Memory113c, pPath: number, nTargetX: number, nTargetY: number): void {
  if (pPath === 0) return
  m.set(pPath, D2DynamicPathStrc.wTargetX, nTargetX & 0xffff)
  m.set(pPath, D2DynamicPathStrc.wTargetY, nTargetY & 0xffff)
  m.set(pPath, D2DynamicPathStrc.pTargetUnit, 0)
}

/**
 * `@va D2Common:0x6FD84A00` (`D2Common.#10451` `PATH_ClearNextRoom`, stdcall `(pPath)`, `ret 4`).
 *
 * Unconditionally stores `0` at `pPath->pPreviousRoom (+0x20)` (`0x6FD84A04`, no NULL check).
 */
export function PATH_ClearNextRoom113c(m: Memory113c, pPath: number): void {
  m.set(pPath, D2DynamicPathStrc.pPreviousRoom, 0)
}

/**
 * `@va D2Common:0x6FD84A10` (`D2Common.#10950` `PATH_GetNextRoom`, stdcall `(pPath)`, `ret 4`).
 *
 * Unconditionally reads and returns `pPath->pPreviousRoom (+0x20)` (`0x6FD84A14`, no NULL check).
 */
export function PATH_GetNextRoom113c(m: Memory113c, pPath: number): number {
  return m.get(pPath, D2DynamicPathStrc.pPreviousRoom) | 0
}

/**
 * `@va D2Common:0x6FD84A40` (`D2Common.#11001` `PATH_GetLastPointY`, stdcall `(pPath)`, `ret 4`).
 *
 * Unconditionally reads `count = pPath->dwPathPoints (+0x28)`; if `count == 0`, returns `0`;
 * otherwise returns `u16(pPath + 0x9A + count * 4)` (`wPathPoints[count - 1].y`).
 */
export function PATH_GetLastPointY113c(m: Memory113c, pPath: number): number {
  const count = m.get(pPath, D2DynamicPathStrc.dwPathPoints)
  if (count === 0) return 0
  return m.u16((pPath + 0x9a + ((count << 2) >>> 0)) >>> 0)
}

/**
 * `@va D2Common:0x6FD84A60` (`D2Common.#10976` `PATH_GetLastPointX`, stdcall `(pPath)`, `ret 4`).
 *
 * Unconditionally reads `count = pPath->dwPathPoints (+0x28)`; if `count == 0`, returns `0`;
 * otherwise returns `u16(pPath + 0x98 + count * 4)` (`wPathPoints[count - 1].x`).
 */
export function PATH_GetLastPointX113c(m: Memory113c, pPath: number): number {
  const count = m.get(pPath, D2DynamicPathStrc.dwPathPoints)
  if (count === 0) return 0
  return m.u16((pPath + 0x98 + ((count << 2) >>> 0)) >>> 0)
}

/**
 * `@va D2Common:0x6FD84A80` (`D2Common.#10999` `PATH_GetPrevTargetY`, stdcall `(pPath)`, `ret 4`).
 *
 * Unconditionally zero-extends `pPath->wFinalTargetY (+0x1A)` (`0x6FD84A84`, no NULL check).
 */
export function PATH_GetPrevTargetY113c(m: Memory113c, pPath: number): number {
  return m.get(pPath, D2DynamicPathStrc.wFinalTargetY)
}

/**
 * `@va D2Common:0x6FD84A90` (`D2Common.#10690` `PATH_GetPrevTargetX`, stdcall `(pPath)`, `ret 4`).
 *
 * Unconditionally zero-extends `pPath->wFinalTargetX (+0x18)` (`0x6FD84A94`, no NULL check).
 */
export function PATH_GetPrevTargetX113c(m: Memory113c, pPath: number): number {
  return m.get(pPath, D2DynamicPathStrc.wFinalTargetX)
}

/**
 * `@va D2Common:0x6FD84AA0` (`D2Common.#10764` `PATH_GetFirstPointY`, stdcall `(pPath)`, `ret 4`).
 *
 * Unconditionally zero-extends `pPath->wTargetY (+0x12)` (`0x6FD84AA4`, no NULL check).
 */
export function PATH_GetFirstPointY113c(m: Memory113c, pPath: number): number {
  return m.get(pPath, D2DynamicPathStrc.wTargetY)
}

/**
 * `@va D2Common:0x6FD84AB0` (`D2Common.#10983` `PATH_GetFirstPointX`, stdcall `(pPath)`, `ret 4`).
 *
 * Unconditionally zero-extends `pPath->wTargetX (+0x10)` (`0x6FD84AB4`, no NULL check).
 */
export function PATH_GetFirstPointX113c(m: Memory113c, pPath: number): number {
  return m.get(pPath, D2DynamicPathStrc.wTargetX)
}

/**
 * `@va D2Common:0x6FD84BE0` (`D2Common.#10706` `PATH_ForceDirection`, stdcall `(pPath, nDir)`, `ret 8`).
 *
 * - NULL `pPath` -> no-op (`0x6FD84BE4`).
 * - Masks `d = nDir & 0x3F` (`0x6FD84BEC`) and writes `u8` `d` to `pPath->nDirection (+0x64)`
 *   and `pPath->nNewDirection (+0x65)`.
 */
export function PATH_ForceDirection113c(m: Memory113c, pPath: number, nDir: number): void {
  if (pPath === 0) return
  const d = nDir & 0x3f
  m.set(pPath, D2DynamicPathStrc.nDirection, d)
  m.set(pPath, D2DynamicPathStrc.nNewDirection, d)
}

/**
 * `@va D2Common:0x6FD84C00` (`D2Common.#10788` `PATH_GetNewDirection`, stdcall `(pPath)`, `ret 4`).
 *
 * Unconditionally reads and returns `pPath->nNewDirection (+0x65)` (`mov al, [eax+0x65]`, no NULL check).
 */
export function PATH_GetNewDirection113c(m: Memory113c, pPath: number): number {
  return m.get(pPath, D2DynamicPathStrc.nNewDirection)
}

/**
 * `@va D2Common:0x6FD84C10` (`D2Common.#10042` `PATH_GetDirection`, stdcall `(pPath)`, `ret 4`).
 *
 * NULL `pPath` -> `0`; otherwise returns `pPath->nDirection (+0x64)` (`mov al, [eax+0x64]`).
 */
export function PATH_GetDirection113c(m: Memory113c, pPath: number): number {
  if (pPath === 0) return 0
  return m.get(pPath, D2DynamicPathStrc.nDirection)
}

/**
 * `@va D2Common:0x6FD84C30` (`D2Common.#10817` `PATH_GetPathPoints`, stdcall `(pPath, ppPathPoints)`, `ret 8`).
 *
 * Unconditionally stores `(pPath + 0x9C)` at `*ppPathPoints` and returns `pPath->dwPathPoints (+0x28)` (no NULL check).
 */
export function PATH_GetPathPoints113c(m: Memory113c, pPath: number, ppPathPoints: number): number {
  m.setU32(ppPathPoints >>> 0, (pPath + D2DynamicPathStrc.wPathPoints.off) >>> 0)
  return m.get(pPath, D2DynamicPathStrc.dwPathPoints) | 0
}

/**
 * `@va D2Common:0x6FD84C60` (`D2Common.#10800` `PATH_GetNumberOfPathPoints`, stdcall `(pPath)`, `ret 4`).
 *
 * Unconditionally reads and returns `pPath->dwPathPoints (+0x28)` (no NULL check).
 */
export function PATH_GetNumberOfPathPoints113c(m: Memory113c, pPath: number): number {
  return m.get(pPath, D2DynamicPathStrc.dwPathPoints) | 0
}

/**
 * `@va D2Common:0x6FD84CB0` (`D2Common.#10159` `PATH_ClearPathPointsAndFlag0x20`, stdcall `(pPath)`, `ret 4`).
 *
 * Unconditionally clears bit `0x20` (`& 0xFFFFFFDF`) on `pPath->dwFlags (+0x34)` and stores `0`
 * to `pPath->dwPathPoints (+0x28)` (no NULL check).
 */
export function PATH_ClearPathPointsAndFlag0x20_113c(m: Memory113c, pPath: number): void {
  m.set(pPath, D2DynamicPathStrc.dwFlags, (m.get(pPath, D2DynamicPathStrc.dwFlags) & 0xffffffdf) >>> 0)
  m.set(pPath, D2DynamicPathStrc.dwPathPoints, 0)
}

/**
 * `@va D2Common:0x6FD84CE0` (`D2Common.#11022` `PATH_SetAcceleration`, stdcall `(pPath, nAcceleration)`, `ret 8`).
 *
 * Unconditionally stores `nAcceleration` at `pPath->dwAcceleration (+0x88)` (no NULL check).
 */
export function PATH_SetAcceleration113c(m: Memory113c, pPath: number, nAcceleration: number): void {
  m.set(pPath, D2DynamicPathStrc.dwAcceleration, nAcceleration >>> 0)
}

/**
 * `@va D2Common:0x6FD84D10` (`D2Common.#10378` `PATH_SetMaxVelocity`, stdcall `(pPath, nMaxVelocity)`, `ret 8`).
 *
 * Unconditionally stores `nMaxVelocity` at `pPath->dwMaxVelocity (+0x84)` (no NULL check).
 */
export function PATH_SetMaxVelocity113c(m: Memory113c, pPath: number, nMaxVelocity: number): void {
  m.set(pPath, D2DynamicPathStrc.dwMaxVelocity, nMaxVelocity >>> 0)
}

/**
 * `D2Common.dll` `.data` table `gdwPathTypeFlags` at `0x6FDE4180` (`18` `uint32_t` entries).
 *
 * `@va D2Common:0x6FDE4180`
 */
export const PATH_TYPE_FLAGS_VA_6FDE4180 = 0x6fde4180

/**
 * `D2Common.dll` `.data` table `gdwPathTypeStepNums` at `0x6FDE4138` (`18` `uint32_t` entries).
 *
 * `@va D2Common:0x6FDE4138`
 */
export const PATH_TYPE_STEP_NUMS_VA_6FDE4138 = 0x6fde4138

/**
 * `D2Common.dll` `.rdata` table `PATH_DIR_TURN_RATE_TABLE` at `0x6FDE41C8` (`64` `int32_t` entries).
 *
 * `@va D2Common:0x6FDE41C8`
 */
export const PATH_DIR_TURN_RATE_VA_6FDE41C8 = 0x6fde41c8

/**
 * `Fog.dll` `.data` 512-entry `float32` sine/cosine lookup table at `0x6FF7F470`
 * (`Fog.#10084` `FOG_SinLUT(idx) = *(float*)(0x6FF7F470 + (idx & 0x1FF)*4)`,
 * `Fog.#10083` `FOG_CosLUT(idx) = *(float*)(0x6FF7F470 + ((idx + 0x80) & 0x1FF)*4)`).
 *
 * `@va Fog:0x6FF7F470`
 */
export const FOG_TRIG_LUT_VA_6FF7F470 = 0x6ff7f470

const _f32ScratchBuf = new ArrayBuffer(4)
const _f32ScratchU32 = new Uint32Array(_f32ScratchBuf)
const _f32ScratchF32 = new Float32Array(_f32ScratchBuf)

function u32BitsToF32(bits: number): number {
  _f32ScratchU32[0] = bits >>> 0
  return _f32ScratchF32[0]!
}

/**
 * `@va D2Common:0x6FD68400` (`PATH_SpliceSegmentPoints113c`, not exported;
 * custom LTCG `eax = nInsertIdx`, `ecx = pSubPath`, `ebx = pnTotalPoints`,
 * stack `[esp+4] = pPointsBuf`, `[esp+8] = pnCurIdx`, `ret 8`).
 *
 * Shifts `(*pnTotalPoints - nInsertIdx - 1)` `D2PathPointStrc` dwords starting at `pPointsBuf + (nInsertIdx + 1)*4`
 * to `pPointsBuf + (*pnCurIdx + pSubPath->nSubPoints (+0x04))*4` via `_memmove` (`0x6FD52320`),
 * copies `pSubPath->nSubPoints (+0x04)` dwords from `pSubPath + 0x24` into `pPointsBuf + (*pnCurIdx)*4`,
 * adds `(*pnCurIdx - nInsertIdx + pSubPath->nSubPoints - 1)` to `*pnTotalPoints`,
 * and sets `*pnCurIdx = *pnCurIdx + pSubPath->nSubPoints`.
 */
export function PATH_SpliceSegmentPoints113c(
  m: Memory113c,
  nInsertIdx: number,
  pSubPath: number,
  pnTotalPoints: number,
  pPointsBuf: number,
  pnCurIdx: number,
): void {
  const insIdx = nInsertIdx | 0
  const subPath = pSubPath >>> 0
  const pTotal = pnTotalPoints >>> 0
  const ptsBuf = pPointsBuf >>> 0
  const pCur = pnCurIdx >>> 0

  const curIdx0 = m.u32(pCur) | 0
  const subCount0 = m.u32((subPath + 0x04) >>> 0) | 0
  const delta = (((curIdx0 - insIdx) | 0) + subCount0 - 1) | 0
  const total0 = m.u32(pTotal) | 0
  const dstIdx = (delta + insIdx) | 0
  const moveBytes = ((((total0 - insIdx) | 0) * 4 - 4) | 0) >>> 0
  const srcAddr = (ptsBuf + insIdx * 4 + 4) >>> 0
  const dstAddr = (ptsBuf + dstIdx * 4 + 4) >>> 0

  if (moveBytes > 0 && moveBytes < 0x80000000) {
    const tmp = new Uint8Array(moveBytes)
    for (let i = 0; i < moveBytes; i++) {
      tmp[i] = m.u8((srcAddr + i) >>> 0)
    }
    for (let i = 0; i < moveBytes; i++) {
      m.setU8((dstAddr + i) >>> 0, tmp[i]!)
    }
  }

  const subCount1 = m.u32((subPath + 0x04) >>> 0) | 0
  const curIdx1 = m.u32(pCur) | 0
  const copyBytes = (subCount1 << 2) >>> 0
  const pWrite = (ptsBuf + curIdx1 * 4) >>> 0
  const pRead = (subPath + 0x24) >>> 0
  const dwords = copyBytes >>> 2
  for (let i = 0; i < dwords; i++) {
    m.setU32((pWrite + i * 4) >>> 0, m.u32((pRead + i * 4) >>> 0))
  }
  for (let i = dwords << 2; i < copyBytes; i++) {
    m.setU8((pWrite + i) >>> 0, m.u8((pRead + i) >>> 0))
  }

  const total1 = m.u32(pTotal) | 0
  m.setU32(pTotal, ((total1 + delta) | 0) >>> 0)
  m.setU32(pCur, ((dstIdx + 1) | 0) >>> 0)
}

/**
 * `@va D2Common:0x6FD84630` (`D2Common.#10022` `PATH_SetStepDistance113c`,
 * stdcall `(pPath, nDistance)`, `ret 8`).
 *
 * Asserts `0 <= (int32)nDistance <= 0xFF` (`line 2405`, `0x965`) and writes `u8(nDistance)`
 * to `pPath + 0x94` (`nStepDistance`).
 */
export function PATH_SetStepDistance113c(
  m: Memory113c,
  pPath: number,
  nDistance: number,
): void {
  const dist = nDistance | 0
  if (dist < 0 || dist > 0xff) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 2405)
  }
  m.setU8((pPath + 0x94) >>> 0, dist & 0xff)
}

/**
 * `@va D2Common:0x6FD847C0` (`D2Common.#10214` `PATH_GetSavedSteps113c`,
 * stdcall `(pPath, ppOutSavedSteps)`, `ret 8`).
 *
 * Asserts `(pPath->dwFlags (+0x34) & 0x20000) != 0` (`line 2292`, `0x8F4`), writes `pPath + 0x1D8`
 * to `*ppOutSavedSteps`, and returns `*(int32*)(pPath + 0x1D4)` (`nSavedStepsCount`).
 */
export function PATH_GetSavedSteps113c(
  m: Memory113c,
  pPath: number,
  ppOutSavedSteps: number,
): number {
  const path = pPath >>> 0
  if ((m.u32((path + 0x34) >>> 0) & 0x20000) === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 2292)
  }
  m.setU32(ppOutSavedSteps >>> 0, (path + 0x1d8) >>> 0)
  return m.u32((path + 0x1d4) >>> 0) | 0
}

/**
 * `@va D2Common:0x6FD84910` (`D2Common.#11163` `PATH_GetTargetTypeAndId113c`,
 * stdcall `(pPath, pOutTargetType, pOutTargetId)`, `ret 0xC`).
 *
 * Asserts `pPath->pTargetUnit (+0x58) != 0` (`line 1984`, `0x7C0`), then copies `pPath->dwTargetType (+0x5C)`
 * to `*pOutTargetType` and `pPath->dwTargetId (+0x60)` to `*pOutTargetId`.
 */
export function PATH_GetTargetTypeAndId113c(
  m: Memory113c,
  pPath: number,
  pOutTargetType: number,
  pOutTargetId: number,
): void {
  const path = pPath >>> 0
  if (m.u32((path + 0x58) >>> 0) === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 1984)
  }
  m.setU32(pOutTargetType >>> 0, m.u32((path + 0x5c) >>> 0))
  m.setU32(pOutTargetId >>> 0, m.u32((path + 0x60) >>> 0))
}

/**
 * `@va D2Common:0x6FD84B80` (`D2Common.#10750` `PATH_GetPosY113c`,
 * stdcall `(pPath)`, `ret 4`).
 *
 * Asserts `pPath != 0` (`line 1693`, `0x69D`) and returns `u16(pPath + 0x06)` (`wPosY`).
 */
export function PATH_GetPosY113c(m: Memory113c, pPath: number): number {
  if (pPath === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 1693)
  }
  return m.u16((pPath + 0x06) >>> 0)
}

/**
 * `@va D2Common:0x6FD84BB0` (`D2Common.#10867` `PATH_GetPosX113c`,
 * stdcall `(pPath)`, `ret 4`).
 *
 * Asserts `pPath != 0` (`line 1682`, `0x692`) and returns `u16(pPath + 0x02)` (`wPosX`).
 */
export function PATH_GetPosX113c(m: Memory113c, pPath: number): number {
  if (pPath === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 1682)
  }
  return m.u16((pPath + 0x02) >>> 0)
}

/**
 * `@va D2Common:0x6FD84DC0` (`D2Common.#10692` `PATH_FreeDynamicPath113c`,
 * stdcall `(pMemPool, pPath)`, `ret 8`).
 *
 * Frees `pPath` via `Fog.#10046` (`0x6FD59228`).
 */
export function PATH_FreeDynamicPath113c(
  m: Memory113c,
  _pMemPool: number,
  pPath: number,
): void {
  const freeFn = (m as { free?: (p: number) => void }).free
  if (pPath !== 0) {
    freeFn?.call(m, pPath >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD84F80` (`D2Common.#10647` `PATH_SetType113c`,
 * stdcall `(pPath, nPathType)`, `ret 8`).
 *
 * - Asserts `!(pPath->pUnit != 0 && pPath->pUnit->dwUnitType == 0 && nPathType == 2)` (`line 2145`, `0x861`).
 * - Reads `flagMask = gdwPathTypeFlags[nPathType]` (`0x6FDE4180 + nPathType * 4`).
 * - If `(flagMask & 0x2000) != 0 && (pPath->dwFlags & 0x4000) == 0`, saves `pPath->dwPrevPathType (+0x40) = pPath->dwPathType (+0x3C)`.
 * - If `(flagMask & 0x8000) != 0 && (pPath->dwFlags & 0x10000) == 0`, saves `*(u32*)(pPath + 0x80) = pPath->dwVelocity (+0x7C)`.
 * - Updates `pPath->dwFlags = (pPath->dwFlags & 0xFFF800FF) | flagMask`, `pPath->dwPathType (+0x3C) = nPathType`,
 *   and `pPath->nStepNum (+0x98) = gdwPathTypeStepNums[nPathType]` (`0x6FDE4138 + nPathType * 4`).
 * - Asserts `pPath->dwPrevPathType != 11` (`line 2161`), `pPath->dwPrevPathType != 8` (`line 2162`),
 *   and `!(nPathType == 4 && pPath->nDistMax (+0x91) >= 0x4E)` (`line 2163`).
 */
export function PATH_SetType113c(
  m: Memory113c,
  pPath: number,
  nPathType: number,
): void {
  const path = pPath >>> 0
  const type = nPathType | 0
  const pUnit = m.u32((path + 0x30) >>> 0)
  if (pUnit !== 0 && m.u32(pUnit) === 0 && type === 2) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 2145)
  }

  const flagMask = m.u32((PATH_TYPE_FLAGS_VA_6FDE4180 + type * 4) >>> 0)
  if ((flagMask & 0x2000) !== 0 && (m.u32((path + 0x34) >>> 0) & 0x4000) === 0) {
    m.setU32((path + 0x40) >>> 0, m.u32((path + 0x3c) >>> 0))
  }
  if (
    (flagMask & 0x8000) !== 0 &&
    (m.u32((path + 0x34) >>> 0) & 0x10000) === 0
  ) {
    m.setU32((path + 0x80) >>> 0, m.u32((path + 0x7c) >>> 0))
  }

  const newFlags = ((m.u32((path + 0x34) >>> 0) & 0xfff800ff) | flagMask) >>> 0
  m.setU32((path + 0x34) >>> 0, newFlags)
  m.setU32((path + 0x3c) >>> 0, type >>> 0)
  const stepNum = m.u32((PATH_TYPE_STEP_NUMS_VA_6FDE4138 + type * 4) >>> 0)
  m.setU32((path + 0x98) >>> 0, stepNum)

  const prevType = m.u32((path + 0x40) >>> 0) | 0
  if (prevType === 0x0b) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 2161)
  }
  if (prevType === 0x08) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 2162)
  }
  if (type === 4 && m.u8((path + 0x91) >>> 0) >= 0x4e) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 2163)
  }
}

/**
 * `@va D2Common:0x6FD85160` (`PATH_AdjustTargetForDoorObject113c`, not exported;
 * custom LTCG `eax = pContext`, plain `ret`).
 *
 * - Reads `pPath = *(u32*)(pContext + 0x30)` and `pTargetUnit = pPath->pTargetUnit (+0x58)`.
 * - Asserts `pTargetUnit != 0` (`line 3600`, `0xE10`), `pTargetUnit->dwUnitType (+0x00) == 2` (`line 533`, `0x215`),
 *   and `pObjectTxt = **(u32**)(pTargetUnit + 0x14)` has `nSubClass (+0x13A) != 0` (`line 533`, `0x215`).
 * - Reads `pStaticPath = pTargetUnit->pStaticPath (+0x2C)`:
 *   - If `u8(pObjectTxt + 0x13C) == 1`, adjusts `pPath->wTargetY (+0x12)` by `-2` if `pPath->wPosY (+0x06) < pStaticPath->nYPos (+0x10)` (unsigned) else `+2`.
 *   - Otherwise adjusts `pPath->wTargetX (+0x10)` by `-2` if `pPath->wPosX (+0x02) < pStaticPath->nXPos (+0x0C)` (unsigned) else `+2`.
 */
export function PATH_AdjustTargetForDoorObject113c(
  m: Memory113c,
  pContext: number,
): void {
  const pPath = m.u32((pContext + 0x30) >>> 0)
  const pTargetUnit = m.u32((pPath + 0x58) >>> 0)
  if (pTargetUnit === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 3600)
  }
  if ((m.u32(pTargetUnit) | 0) !== 2) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 533)
  }
  const pObjectData = m.u32((pTargetUnit + 0x14) >>> 0)
  const pObjectTxt = m.u32(pObjectData)
  if (m.u8((pObjectTxt + 0x13a) >>> 0) === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 533)
  }

  const pStaticPath = m.u32((pTargetUnit + 0x2c) >>> 0)
  if (m.u8((pObjectTxt + 0x13c) >>> 0) === 1) {
    const posY = m.u16((pPath + 0x06) >>> 0) >>> 0
    const doorY = m.u32((pStaticPath + 0x10) >>> 0) >>> 0
    const deltaY = posY < doorY ? 0xfffe : 2
    m.setU16((pPath + 0x12) >>> 0, (m.u16((pPath + 0x12) >>> 0) + deltaY) & 0xffff)
  } else {
    const posX = m.u16((pPath + 0x02) >>> 0) >>> 0
    const doorX = m.u32((pStaticPath + 0x0c) >>> 0) >>> 0
    const deltaX = posX < doorX ? 0xfffe : 2
    m.setU16((pPath + 0x10) >>> 0, (m.u16((pPath + 0x10) >>> 0) + deltaX) & 0xffff)
  }
}

/**
 * `@va D2Common:0x6FD85270` (`D2Common.#10425` `PATH_SetNewDirection113c`,
 * stdcall `(pPath, nNewDir)`, `ret 8`).
 *
 * - Asserts `(nNewDir & 0xFF) < 0x40` (`line 1650`, `0x672`).
 * - Masks `dir = nNewDir & 0x3F`, reads `pUnit = pPath->pUnit (+0x30)`, `uType = pUnit ? pUnit->dwUnitType : 6`:
 *   - `uType == 2` or `uType == 4`: writes `pPath->nDirection (+0x64) = dir`.
 *   - `uType == 3`: if `(u8(pPath + 0x34) & 0x40) == 0`, writes `pPath->nDirection (+0x64) = dir`.
 *   - Otherwise: if `dir != pPath->nNewDirection (+0x65)`, sets `nNewDirection = dir` and
 *     `nDiffDirection (+0x66) = u8(0x6FDE41C8 + ((dir - nDirection) & 0x3F) * 4)`.
 */
export function PATH_SetNewDirection113c(
  m: Memory113c,
  pPath: number,
  nNewDir: number,
): void {
  const rawByte = nNewDir & 0xff
  if (rawByte >= 0x40) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 1650)
  }
  const path = pPath >>> 0
  const pUnit = m.u32((path + 0x30) >>> 0)
  const dir = rawByte & 0x3f
  const uType = pUnit === 0 ? 6 : m.u32(pUnit) | 0
  if (uType === 2 || uType === 4) {
    m.setU8((path + 0x64) >>> 0, dir)
    return
  }
  if (uType === 3) {
    if ((m.u8((path + 0x34) >>> 0) & 0x40) === 0) {
      m.setU8((path + 0x64) >>> 0, dir)
    }
    return
  }
  if (dir !== m.u8((path + 0x65) >>> 0)) {
    const oldDir = m.u8((path + 0x64) >>> 0)
    m.setU8((path + 0x65) >>> 0, dir)
    const diff = (dir - oldDir) & 0x3f
    const step = m.u8((PATH_DIR_TURN_RATE_VA_6FDE41C8 + diff * 4) >>> 0)
    m.setU8((path + 0x66) >>> 0, step)
  }
}

/**
 * `@va D2Common:0x6FD8E080` (`PATH_OffsetTargetByUnitRadius113c`, not exported;
 * custom LTCG `esi = pPath`, plain `ret`).
 *
 * - Asserts `pPath != 0` (`line 490`, `0x1EA`) and `pTargetUnit = pPath->pTargetUnit (+0x58) != 0` (`line 491`, `0x1EB`).
 * - Reads `targetDir = pTargetUnit->pPath (+0x2C) ? u8(pTargetPath + 0x64) : 0` and `offset = u8(pPath + 0x68)`.
 * - Computes `lutIdx = ((targetDir - (offset << 5)) << 3) & 0x1FF`, evaluates `dx = _ftol2(FOG_CosLUT(lutIdx) * (float)offset)`
 *   and `dy = _ftol2(FOG_SinLUT(lutIdx) * (float)offset)` from `Fog.dll` LUT at `0x6FF7F470`, and adds `(dx, dy)`
 *   to `(pPath->wTargetX (+0x10), pPath->wTargetY (+0x12))`.
 */
export function PATH_OffsetTargetByUnitRadius113c(
  m: Memory113c,
  pPath: number,
): void {
  if (pPath === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\DrlgVer.cpp', 490)
  }
  const path = pPath >>> 0
  const pTargetUnit = m.u32((path + 0x58) >>> 0)
  if (pTargetUnit === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\DrlgVer.cpp', 491)
  }
  const pTargetPath = m.u32((pTargetUnit + 0x2c) >>> 0)
  const targetDir = pTargetPath === 0 ? 0 : m.u8((pTargetPath + 0x64) >>> 0)
  const offsetParam = m.u8((path + 0x68) >>> 0)
  const radiusF32 = Math.fround(offsetParam)
  const lutIdx = ((targetDir - (offsetParam << 5)) << 3) & 0x1ff

  const cosBits = m.u32(
    (FOG_TRIG_LUT_VA_6FF7F470 + ((lutIdx + 0x80) & 0x1ff) * 4) >>> 0,
  )
  const dx = Math.trunc(Math.fround(u32BitsToF32(cosBits) * radiusF32)) | 0
  m.setU16((path + 0x10) >>> 0, (m.u16((path + 0x10) >>> 0) + dx) & 0xffff)

  const sinBits = m.u32((FOG_TRIG_LUT_VA_6FF7F470 + (lutIdx & 0x1ff) * 4) >>> 0)
  const dy = Math.trunc(Math.fround(u32BitsToF32(sinBits) * radiusF32)) | 0
  m.setU16((path + 0x12) >>> 0, (m.u16((path + 0x12) >>> 0) + dy) & 0xffff)
}

/**
 * `@va D2Common:0x6FDB6920` (`PATH_BuildSpiralPath77Points113c`, not exported;
 * stdcall `(pPath)`, `ret 4`).
 *
 * Generates an outward spiral of `77` (`0x4D`) distinct subtile coordinates around `(pPath->dwPrecisionX (+0x00), pPath->dwPrecisionY (+0x04))`
 * by stepping `radius += 0x2580` (`9600`) and `angleIdx += 0x10` (`16`) per iteration, projecting via `Fog.dll` cosine/sine LUT
 * at `0x6FF7F470`, and appending `(curX >>> 16, curY >>> 16)` to `pPath->wPathPoints (+0x9C)` whenever the subtile changes
 * until `77` points are recorded (`pPath->dwPathPoints (+0x28) = 77`).
 */
export function PATH_BuildSpiralPath77Points113c(
  m: Memory113c,
  pPath: number,
): void {
  const path = pPath >>> 0
  const originX = m.u32(path) | 0
  const originY = m.u32((path + 4) >>> 0) | 0
  let prevX = originX
  let prevY = originY
  let radiusStep = 0
  let count = 0
  let angleIdx = 0
  let pWriteY = (path + 0x9e) >>> 0

  while (count < 0x4d) {
    radiusStep = (radiusStep + 0x2580) | 0
    const rF32 = Math.fround(radiusStep)
    angleIdx = (angleIdx + 0x10) | 0

    const cosBits = m.u32(
      (FOG_TRIG_LUT_VA_6FF7F470 + ((angleIdx + 0x80) & 0x1ff) * 4) >>> 0,
    )
    const dx = Math.trunc(Math.fround(u32BitsToF32(cosBits) * rF32)) | 0
    const curX = (dx + originX) | 0

    const sinBits = m.u32(
      (FOG_TRIG_LUT_VA_6FF7F470 + (angleIdx & 0x1ff) * 4) >>> 0,
    )
    const dy = Math.trunc(Math.fround(u32BitsToF32(sinBits) * rF32)) | 0
    const curY = (dy + originY) | 0

    const tileX = curX >>> 16
    const prevTileX = prevX >>> 16
    const tileY = curY >>> 16
    const prevTileY = prevY >>> 16

    if ((tileX & 0xffff) !== (prevTileX & 0xffff) || tileY !== prevTileY) {
      m.setU16((pWriteY - 2) >>> 0, tileX & 0xffff)
      m.setU16(pWriteY, tileY & 0xffff)
      prevY = curY
      prevX = curX
      count = (count + 1) | 0
      pWriteY = (pWriteY + 4) >>> 0
    }
  }
  m.setU32((path + 0x28) >>> 0, count >>> 0)
}

/**
 * `@va D2Common:0x6FD80050` (`D2Common.#10141` `PATH_GetTargetTypeAndPosition113c`,
 * stdcall `(pUnit, pOutCoords)`, `ret 8`).
 *
 * - Asserts `pUnit != 0` (`line 1994`, `0x7CA`).
 * - For static-path units (`dwUnitType == 2` or `4..5`), copies `(pStaticPath->nXPos (+0x0C), pStaticPath->nYPos (+0x10))`
 *   to `pOutCoords[0..1]`.
 * - For dynamic-path units, writes `PATH_GetPosX(pDynPath)` and `PATH_GetPosY(pDynPath)` if `pDynPath != 0`, else `0, 0`.
 */
export function PATH_GetTargetTypeAndPosition113c(
  m: Memory113c,
  pUnit: number,
  pOutCoords: number,
): void {
  const unit = pUnit >>> 0
  if (unit === 0) {
    throw new D2CommonAssertError('Path.cpp', 0x7ca) // pUnit == 0 (line 1994)
  }
  const out = pOutCoords >>> 0
  const uType = m.u32(unit) | 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    const pStaticPath = m.u32((unit + 0x2c) >>> 0)
    m.setU32(out, m.u32((pStaticPath + 0x0c) >>> 0))
    m.setU32((out + 0x04) >>> 0, m.u32((pStaticPath + 0x10) >>> 0))
    return
  }

  const pDynPath = m.u32((unit + 0x2c) >>> 0)
  let x = 0
  if (pDynPath !== 0) {
    x = PATH_GetPosX113c(m, pDynPath) >>> 0
  }
  m.setU32(out, x)

  const pDynPath2 = m.u32((unit + 0x2c) >>> 0)
  if (pDynPath2 !== 0) {
    const y = PATH_GetPosY113c(m, pDynPath2) >>> 0
    m.setU32((out + 0x04) >>> 0, y)
    return
  }
  m.setU32((out + 0x04) >>> 0, 0)
}

/**
 * `@va D2Common:0x6FD85210` (`D2Common.#10498` `PATH_ResetToDefaultType113c`,
 * stdcall `(pDynamicPath)`, `ret 4`).
 *
 * - Reads `pUnit = pDynamicPath->pUnit (+0x30)` and asserts `pUnit != 0` (`line 2174`, `0x87E`).
 * - If `(dwFlags (+0x34) & 0x8000) != 0`, restores `dwVelocity (+0x7C) = *(u32*)(pDynamicPath + 0x80)`.
 * - If `pUnit->dwUnitType == 0`, calls `PATH_SetType(pDynamicPath, 7)`.
 * - Otherwise, if `(dwFlags & 0x2000) != 0`, calls `PATH_SetType(pDynamicPath, pDynamicPath->dwPrevPathType (+0x40))`.
 */
export function PATH_ResetToDefaultType113c(
  m: Memory113c,
  pDynamicPath: number,
): void {
  const path = pDynamicPath >>> 0
  const pUnit = m.u32((path + 0x30) >>> 0)
  if (pUnit === 0) {
    throw new D2CommonAssertError('Path.cpp', 0x87e) // pUnit == 0 (line 2174)
  }
  const dwFlags = m.u32((path + 0x34) >>> 0)
  if ((dwFlags & 0x8000) !== 0) {
    m.setU32((path + 0x7c) >>> 0, m.u32((path + 0x80) >>> 0))
  }
  if (m.u32(pUnit) === 0) {
    PATH_SetType113c(m, path, 7)
    return
  }
  if ((dwFlags & 0x2000) !== 0) {
    PATH_SetType113c(m, path, m.u32((path + 0x40) >>> 0) | 0)
  }
}

// ============================================================================
// Iteration 9 Lane C — Batch B061 (12 PATH functions)
// ============================================================================

/** `.rdata` size-to-collision-pattern table at `0x6FDDC5E4` (`4` `int32_t` entries). */
export const PATH_SIZE_COLLISION_PATTERN_6FDDC5E4 = Int32Array.from([0, 1, 1, 2])

/** `.rdata` Charged Bolt base octant direction col 0 of `int32[25][3]` at `0x6FDDC320`. */
export const PATH_CHARGED_BOLT_BASE_DIR_6FDDC320 = Int32Array.from([
  5, 4, 4, 4, 3, 6, 5, 4, 3, 2, 6, 6, 6, 2, 2, 6, 7, 0, 1, 2, 7, 0, 0, 0, 1,
])

/** `.rdata` 8-way X step table at `0x6FDDC2E0` (`int32[8][2]` col 0). */
export const PATH_DIR8_DX_6FDDC2E0 = Int32Array.from([1, 1, 0, -1, -1, -1, 0, 1])

/** `.rdata` 8-way Y step table at `0x6FDDC2E4` (`int32[8][2]` col 1). */
export const PATH_DIR8_DY_6FDDC2E0 = Int32Array.from([0, 1, 1, 1, 0, -1, -1, -1])

const PATH_CHARGED_BOLT_JITTER_32 = Int32Array.from([
  -1, 0, 1, -1, 0, 1, -1, 0, 1, -1, 0, 1, -1, 0, 1, -1,
  0, 1, -1, 0, 1, -1, 0, 1, -1, 0, 1, -1, 0, 1, -1, 1,
])

function toFixedSubtileCenter(coord: number): number {
  return (((coord | 0) << 16) + 0x8000) >>> 0
}

function attachAStarChild(m: Memory113c, parent: number, child: number): void {
  for (let k = 0; k < 8; k++) {
    const slot = (parent + 0x10 + (k << 2)) >>> 0
    if (m.u32(slot) === 0) {
      m.setU32(slot, child >>> 0)
      return
    }
  }
}

/**
 * `@va D2Common:0x6FD5D180` (`D2Common.#10493` `PATH_ComputeDirection113c`,
 * `__stdcall(nX1, nY1, nX2, nY2) -> int32`, `ret 0x10`).
 */
export function PATH_ComputeDirection113c(
  m: Memory113c,
  nX1: number,
  nY1: number,
  nX2: number,
  nY2: number,
): number {
  const sm = withPathStackScratch113c(m)
  const pVec = PATH_STACK_SCRATCH_BASE
  const pDir = PATH_STACK_SCRATCH_BASE + 0x08
  PATH_GetDirectionVector113c(
    sm,
    toFixedSubtileCenter(nX1),
    toFixedSubtileCenter(nY1),
    toFixedSubtileCenter(nX2),
    toFixedSubtileCenter(nY2),
    pVec,
    pDir,
  )
  return sm.u32(pDir) >>> 0
}

/**
 * `@va D2Common:0x6FD5D240` (`PATH_ComputeVelocityToNextPoint113c`, not exported;
 * custom LTCG `esi = pPath`, `[esp+4] = bDirOnArrive`, `[esp+8] = bAlwaysDir`, `ret 8 -> BOOL`).
 */
export function PATH_ComputeVelocityToNextPoint113c(
  m: Memory113c,
  pPath: number,
  bDirOnArrive: number,
  bAlwaysDir: number,
): number {
  const path = pPath >>> 0
  let idx = m.u32((path + 0x24) >>> 0) | 0
  let tx = toFixedSubtileCenter(m.u16((path + 0x9c + idx * 4) >>> 0))
  let ty = toFixedSubtileCenter(m.u16((path + 0x9e + idx * 4) >>> 0))
  if (tx === m.u32(path)) {
    const posY0 = m.u32((path + 0x04) >>> 0)
    while (ty === posY0) {
      const nPts = m.u32((path + 0x28) >>> 0) | 0
      idx = m.u32((path + 0x24) >>> 0) | 0
      if (idx >= ((nPts - 1) | 0)) {
        m.setU32((path + 0x6a) >>> 0, 0)
        m.setU32((path + 0x72) >>> 0, 0)
        m.setU32((path + 0x24) >>> 0, nPts >>> 0)
        m.setU32((path + 0x6e) >>> 0, 0)
        m.setU32((path + 0x76) >>> 0, 0)
        m.setU32((path + 0x7c) >>> 0, 0)
        return 1
      }
      idx = (idx + 1) | 0
      m.setU32((path + 0x24) >>> 0, idx >>> 0)
      tx = toFixedSubtileCenter(m.u16((path + 0x9c + idx * 4) >>> 0))
      ty = toFixedSubtileCenter(m.u16((path + 0x9e + idx * 4) >>> 0))
      if (tx !== m.u32(path)) break
    }
  }
  const sm = withPathStackScratch113c(m)
  const pVec = PATH_STACK_SCRATCH_BASE + 0x10
  const pDir = PATH_STACK_SCRATCH_BASE + 0x18
  PATH_GetDirectionVector113c(sm, m.u32(path), m.u32((path + 0x04) >>> 0), tx, ty, pVec, pDir)
  const vecX = sm.u32(pVec) | 0
  const vecY = sm.u32((pVec + 0x04) >>> 0) | 0
  let dir = sm.u32(pDir) >>> 0
  m.setU32((path + 0x6e) >>> 0, vecY >>> 0)
  m.setU32((path + 0x6a) >>> 0, vecX >>> 0)
  if ((m.u32((path + 0x34) >>> 0) & 0x200) !== 0) {
    dir = ((dir - 0x20) & 0x3f) >>> 0
  }
  const vel = m.u32((path + 0x7c) >>> 0) | 0
  const vx = sar32(imul32(vel, vecX), 8)
  const vy = sar32(imul32(vel, vecY), 8)
  m.setU32((path + 0x72) >>> 0, vx >>> 0)
  m.setU32((path + 0x76) >>> 0, vy >>> 0)
  const arr =
    tx >>> 16 === ((m.u32(path) + vx) >>> 0) >>> 16 &&
    ty >>> 16 === ((m.u32((path + 0x04) >>> 0) + vy) >>> 0) >>> 16
      ? 1
      : 0
  if ((bAlwaysDir | 0) !== 0 || (arr !== 0 && (bDirOnArrive | 0) !== 0)) {
    PATH_SetDirection113c(m, path, dir)
  }
  return arr
}

/**
 * `@va D2Common:0x6FD5D760` (`PATH_RecacheRoom113c`, not exported;
 * `__stdcall(pPath, pHintRoom)`, `ret 8`).
 */
export function PATH_RecacheRoom113c(
  m: Memory113c,
  pPath: number,
  pHintRoom: number,
): void {
  const path = pPath >>> 0
  const r0 = m.u32((path + 0x1c) >>> 0)
  const x = m.u16((path + 0x02) >>> 0)
  const y = m.u16((path + 0x06) >>> 0)
  if (r0 !== 0) {
    const rx = m.u32((r0 + 0x4c) >>> 0) | 0
    const rw = m.u32((r0 + 0x54) >>> 0) | 0
    const ry = m.u32((r0 + 0x50) >>> 0) | 0
    const rh = m.u32((r0 + 0x58) >>> 0) | 0
    if (x >= rx && x < ((rx + rw) | 0) && y >= ry && y < ((ry + rh) | 0)) {
      return
    }
  }
  let n = DUNGEON_GetRoomAtPosition113c(m, r0, x, y)
  if (n === 0 && (pHintRoom >>> 0) !== 0) {
    n = DUNGEON_GetRoomAtPosition113c(m, pHintRoom >>> 0, x, y)
  }
  if (n === 0 && (m.u32((path + 0x34) >>> 0) & 0x40000) !== 0) {
    m.setU32((path + 0x28) >>> 0, 0)
    return
  }
  const rPrev = m.u32((path + 0x1c) >>> 0)
  const pUnit = m.u32((path + 0x30) >>> 0)
  m.setU32((path + 0x20) >>> 0, rPrev)
  if (rPrev !== 0) {
    UNITROOM_RemoveUnitFromRoom113c(m, pUnit)
  }
  const newFlags = (m.u32((path + 0x34) >>> 0) | 0x02) >>> 0
  m.setU32((path + 0x1c) >>> 0, n >>> 0)
  m.setU32((path + 0x34) >>> 0, newFlags)
  if (n !== 0) {
    UNITROOM_AddUnitToRoom113c(m, pUnit, n)
    UNITROOM_RefreshUnit113c(m, pUnit)
  }
}

/**
 * `@va D2Common:0x6FD7F910` (`D2Common.#10192` `UNITS_GetDirectionToCoords113c`,
 * `__stdcall(pUnit, nX, nY) -> uint8`, `ret 0xC`, `retMask 0xFF`).
 */
export function UNITS_GetDirectionToCoords113c(
  m: Memory113c,
  pUnit: number,
  nX: number,
  nY: number,
): number {
  const unit = pUnit >>> 0
  const ux = UNITS_GetX113c(m, unit)
  const uy = UNITS_GetY113c(m, unit)
  const sm = withPathStackScratch113c(m)
  const pVec = PATH_STACK_SCRATCH_BASE + 0x20
  const pDir = PATH_STACK_SCRATCH_BASE + 0x28
  PATH_GetDirectionVector113c(
    sm,
    toFixedSubtileCenter(ux),
    toFixedSubtileCenter(uy),
    toFixedSubtileCenter(nX),
    toFixedSubtileCenter(nY),
    pVec,
    pDir,
  )
  return sm.u8(pDir)
}

/**
 * `@va D2Common:0x6FD844F0` (`D2Common.#10993` `UNITS_TransferStateMaskDCToRemoved113c`,
 * `__stdcall(pUnit)`, `ret 4`).
 */
export function UNITS_TransferStateMaskDCToRemoved113c(
  m: Memory113c,
  pUnit: number,
): void {
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const pMaskArray = m.u32((sgpt + DATATABLES_OFF_113C.fStateMasksDC) >>> 0)
  UNITS_TransferStateMaskToRemoved113c(m, pMaskArray, pUnit)
}

/**
 * `@va D2Common:0x6FD852F0` (`D2Common.#10739` `PATH_FaceTowardsCoords113c`,
 * `__stdcall(pPath, nX, nY, bSetBoth)`, `ret 0x10`).
 */
export function PATH_FaceTowardsCoords113c(
  m: Memory113c,
  pPath: number,
  nX: number,
  nY: number,
  bSetBoth: number,
): void {
  const path = pPath >>> 0
  if (path === 0) return
  const sm = withPathStackScratch113c(m)
  const pVec = PATH_STACK_SCRATCH_BASE + 0x30
  const pDir = PATH_STACK_SCRATCH_BASE + 0x38
  PATH_GetDirectionVector113c(
    sm,
    m.u32(path),
    m.u32((path + 0x04) >>> 0),
    toFixedSubtileCenter(nX),
    toFixedSubtileCenter(nY),
    pVec,
    pDir,
  )
  const d = sm.u8(pDir)
  if ((bSetBoth | 0) !== 0) {
    const dm = d & 0x3f
    m.setU8((path + 0x64) >>> 0, dm)
    m.setU8((path + 0x65) >>> 0, dm)
    return
  }
  PATH_SetDirection113c(m, path, d)
}

/**
 * `@va D2Common:0x6FD85360` (`D2Common.#10122` `PATH_GetCollisionPatternForSize113c`,
 * `__stdcall(pUnit, nSize) -> int32`, `ret 8`).
 */
export function PATH_GetCollisionPatternForSize113c(
  m: Memory113c,
  pUnit: number,
  nSize: number,
): number {
  const sz = nSize | 0
  if (sz < 0 || sz >= 4) return 1
  let v = PATH_SIZE_COLLISION_PATTERN_6FDDC5E4[sz]! | 0
  const unit = pUnit >>> 0
  if (unit !== 0 && (m.u32(unit) | 0) === 1) {
    if (MONSTERS_IsTownOrFriendlyUnit113c(m, unit) !== 0) {
      const classId = m.u32((unit + 0x04) >>> 0) | 0
      if (DATATBLS_CheckMonStatsFlagInline113c(m, classId, 9) === 0) {
        if (v === 1) v = 3
        else if (v === 2) v = 4
      }
    }
  }
  return v
}

/**
 * `@va D2Common:0x6FD85470` (`PATH_ResolveTargetUnitPosition113c`, not exported;
 * custom LTCG `edi = pPathInfo`, plain `ret -> uint8`, `retMask 0xFF`).
 */
export function PATH_ResolveTargetUnitPosition113c(
  m: Memory113c,
  pPathInfo: number,
): number {
  const info = pPathInfo >>> 0
  const pPath = m.get(info, D2PathInfoStrc.pDynamicPath)
  const pTarget = m.u32((pPath + 0x58) >>> 0)
  if (pTarget === 0) return 1
  const tx = UNITS_GetX113c(m, pTarget) & 0xffff
  m.setU16((pPath + 0x10) >>> 0, tx)
  const ty = UNITS_GetY113c(m, pTarget) & 0xffff
  m.setU16((pPath + 0x12) >>> 0, ty)
  if (tx === 0 && ty === 0) return 0
  const uType = m.u32(pTarget) >>> 0
  switch (uType) {
    case 0:
    case 1:
      if (m.u8((pPath + 0x68) >>> 0) !== 0) {
        PATH_OffsetTargetByUnitRadius113c(m, pPath)
      }
      return 1
    case 2:
      if (UNITS_IsDoor113c(m, pTarget) !== 0) {
        PATH_AdjustTargetForDoorObject113c(m, info)
      }
      return 2
    case 4:
      return 2
    default:
      return 1
  }
}

/**
 * `@va D2Common:0x6FD856E0` (`PATH_IsMonsterDestinationAllowed113c`, not exported;
 * custom LTCG `edx = pUnit`, `esi = pPathInfo`, `ret -> BOOL`).
 */
export function PATH_IsMonsterDestinationAllowed113c(
  m: Memory113c,
  pUnit: number,
  pPathInfo: number,
): number {
  const unit = pUnit >>> 0
  if (unit === 0) return 1
  if ((m.u32(unit) | 0) !== 1) return 1
  if (MONSTERS_IsTownOrFriendlyUnit113c(m, unit) !== 0) return 1
  const info = pPathInfo >>> 0
  let r = m.get(info, D2PathInfoStrc.pTargetRoom)
  if (r === 0) {
    const sX = m.get(info, D2PathInfoStrc.startX)
    const sY = m.get(info, D2PathInfoStrc.startY)
    const tX = m.get(info, D2PathInfoStrc.targetX)
    const tY = m.get(info, D2PathInfoStrc.targetY)
    const mx = (sdiv32((tX - sX) | 0, 2) + sX) | 0
    const my = (sdiv32((tY - sY) | 0, 2) + sY) | 0
    const rMid = DUNGEON_GetRoomAtPosition113c(m, m.get(info, D2PathInfoStrc.pStartRoom), mx, my)
    r = DUNGEON_GetRoomAtPosition113c(m, rMid, tX, tY)
    if (r === 0) return 1
  }
  const pRoomEx = m.u32((r + 0x10) >>> 0)
  const pLevel = m.u32((pRoomEx + 0x58) >>> 0)
  const nLevelId = m.u32((pLevel + 0x1d0) >>> 0) | 0
  return DRLG_IsTownLevel113c(nLevelId) !== 0 ? 0 : 1
}

/**
 * `@va D2Common:0x6FDB6AA0` (`PATH_ComputePathChargedBolt113c`, not exported;
 * custom LTCG `esi = pSeed`, `[esp+4] = pPath`, `ret 4`).
 */
export function PATH_ComputePathChargedBolt113c(
  m: Memory113c,
  pSeed: number,
  pPath: number,
): void {
  const seedPtr = pSeed >>> 0
  const path = pPath >>> 0
  let curX = m.u16((path + 0x02) >>> 0)
  let curY = m.u16((path + 0x06) >>> 0)
  const startXY = (curX | (curY << 16)) >>> 0
  const targetXY = m.u32((path + 0x10) >>> 0)
  const qIdx = PATH_QuantizeDirectionIndex25_113c(startXY, targetXY)
  const baseDir = PATH_CHARGED_BOLT_BASE_DIR_6FDDC320[qIdx]! | 0
  const n = m.u8((path + 0x91) >>> 0) >>> 1
  const seed: D2SeedStrc = { lo: m.u32(seedPtr), hi: m.u32((seedPtr + 0x04) >>> 0) }
  for (let k = 0; k < n; k++) {
    seedNext(seed)
    m.setU32(seedPtr, seed.lo)
    m.setU32((seedPtr + 0x04) >>> 0, seed.hi)
    const d = (PATH_CHARGED_BOLT_JITTER_32[seed.lo & 0x1f]! + baseDir) & 7
    m.setU32((path + 0x9c + (k << 2)) >>> 0, ((curX & 0xffff) | ((curY & 0xffff) << 16)) >>> 0)
    curX = (curX + (PATH_DIR8_DX_6FDDC2E0[d]! << 1)) & 0xffff
    curY = (curY + (PATH_DIR8_DY_6FDDC2E0[d]! << 1)) & 0xffff
  }
  m.setU32((path + 0x9c + (n << 2)) >>> 0, ((curX & 0xffff) | ((curY & 0xffff) << 16)) >>> 0)
  m.setU32((path + 0x28) >>> 0, (n + 1) >>> 0)
}

/**
 * `@va D2Common:0x6FDC0840` (`PATH_IdaStar_AdvanceToNextCandidate113c`, not exported;
 * custom LTCG `eax = pNode`, `edi = pContext`, `ret -> D2IdaStarNodeStrc*`).
 */
export function PATH_IdaStar_AdvanceToNextCandidate113c(
  m: Memory113c,
  pNode: number,
  pContext: number,
): number {
  let node = pNode >>> 0
  const ctx = pContext >>> 0
  const visit0 = (m.get(node, D2IdaStarNodeStrc.nVisitCount) << 16) >> 16
  if (visit0 < 4) {
    m.set(node, D2IdaStarNodeStrc.pBestDirection, (m.get(node, D2IdaStarNodeStrc.pBestDirection) + 4) >>> 0)
    PATH_IdaStar_AdvanceNeighborIndex113c(m, ctx, node)
  }
  m.set(node, D2IdaStarNodeStrc.nVisitCount, (m.get(node, D2IdaStarNodeStrc.nVisitCount) + 1) & 0xffff)
  while (m.get(node, D2IdaStarNodeStrc.nVisitCount) === 5) {
    if (node === m.u32(ctx)) return 0
    node = m.get(node, D2IdaStarNodeStrc.pParent)
    m.set(node, D2IdaStarNodeStrc.pBestDirection, (m.get(node, D2IdaStarNodeStrc.pBestDirection) + 4) >>> 0)
    PATH_IdaStar_AdvanceNeighborIndex113c(m, ctx, node)
    m.set(node, D2IdaStarNodeStrc.nVisitCount, (m.get(node, D2IdaStarNodeStrc.nVisitCount) + 1) & 0xffff)
  }
  return node >>> 0
}

/**
 * `@va D2Common:0x6FDCAFB0` (`PATH_AStar_ProcessNeighbor113c`, not exported;
 * custom LTCG `ebx = pParent`, `[esp+4] = unused`, `[esp+8] = pContext`, `[esp+0xC] = dwPointXY`, `[esp+0x10] = dwTargetXY`,
 * `ret 0x10 -> BOOL`).
 */
export function PATH_AStar_ProcessNeighbor113c(
  m: Memory113c,
  pParent: number,
  _unused: number,
  pContext: number,
  dwPointXY: number,
  dwTargetXY: number,
): number {
  const parent = pParent >>> 0
  const ctx = pContext >>> 0
  const xy = dwPointXY >>> 0
  const ptX = xy & 0xffff
  const ptY = (xy >>> 16) & 0xffff
  const cost = m.u16(parent) === ptX || m.u16((parent + 0x02) >>> 0) === ptY ? 2 : 3
  const g16 = (m.u16((parent + 0x08) >>> 0) + cost) & 0xffff
  const gSigned = (g16 << 16) >> 16

  const pending = PATH_AStar_GetNodeFromPendingCache113c(m, ctx, xy)
  if (pending !== 0) {
    attachAStarChild(m, parent, pending)
    const oldG = (m.u16((pending + 0x08) >>> 0) << 16) >> 16
    if (gSigned < oldG) {
      const h = m.u16((pending + 0x06) >>> 0)
      m.setU16((pending + 0x08) >>> 0, g16)
      m.setU32((pending + 0x0c) >>> 0, parent)
      m.setU16((pending + 0x04) >>> 0, (h + g16) & 0xffff)
    }
    return 1
  }

  const visited = PATH_AStar_FindPointInVisitedCache113c(m, ctx, xy)
  if (visited !== 0) {
    attachAStarChild(m, parent, visited)
    const oldG = (m.u16((visited + 0x08) >>> 0) << 16) >> 16
    if (gSigned < oldG) {
      const h = m.u16((visited + 0x06) >>> 0)
      m.setU16((visited + 0x04) >>> 0, (h + g16) & 0xffff)
      m.setU32((visited + 0x0c) >>> 0, parent)
      m.setU16((visited + 0x08) >>> 0, g16)
      PATH_AStar_PropagateNewFScoreToChildren113c(m, ctx, visited)
    }
    return 1
  }

  const used = m.u32((ctx + 0x2fc4) >>> 0) >>> 0
  if (used === 200) return 0
  const node = (ctx + 0x404 + imul32(used, 0x38)) >>> 0
  m.setU32((ctx + 0x2fc4) >>> 0, (used + 1) >>> 0)
  for (let d = 0; d < 14; d++) {
    m.setU32((node + (d << 2)) >>> 0, 0)
  }
  m.setU32((node + 0x0c) >>> 0, parent)
  m.setU16((node + 0x08) >>> 0, g16)
  const h = PATH_AStar_EvaluateHeuristic113c(xy, dwTargetXY >>> 0) & 0xffff
  m.setU16((node + 0x06) >>> 0, h)
  m.setU32(node, xy)
  m.setU16((node + 0x04) >>> 0, (h + g16) & 0xffff)
  PATH_AStar_PushToOpenAndHash113c(m, ctx, node)
  attachAStarChild(m, parent, node)
  return 1
}

// ============================================================================
// Iteration 10 Lane C — I10C-1 (F07..F08) & I10C-2 (F17..F27) PATH functions
// ============================================================================

/** `.rdata` 16-entry wall-follower X step table at `0x6FDDCA38` (`int32[16][2]` col 0, North=0 clockwise repeated twice). */
export const PATH_WF_DIR8_DX_6FDDCA38 = Int32Array.from([
  0, 1, 1, 1, 0, -1, -1, -1, 0, 1, 1, 1, 0, -1, -1, -1,
])

/** `.rdata` 16-entry wall-follower Y step table at `0x6FDDCA3C` (`int32[16][2]` col 1, North=0 clockwise repeated twice). */
export const PATH_WF_DIR8_DY_6FDDCA38 = Int32Array.from([
  -1, -1, 0, 1, 1, 1, 0, -1, -1, -1, 0, 1, 1, 1, 0, -1,
])

/**
 * `.rdata` 9×9 signed step nudge table at `0x6FDE4338..0x6FDE447C`, centered at `0x6FDE43D8` (`index 40 = (0, 0)`).
 * Copied verbatim from `D2Common.dll` v1.13c.
 */
export const PATH_NUDGE_GRID_81_6FDE4338 = Int32Array.from([
  -1, 0, 0, 0, 0, 0, 0, 0, 1,
  -1, -1, 0, 0, 0, 0, 0, 1, 1,
  -1, -1, -1, 0, 0, 0, 1, 1, 1,
  -1, -1, -1, -1, 0, 1, 1, 1, 1,
  -1, -1, -1, -1, 0, 1, 1, 1, 1,
  -1, -1, -1, -1, 0, 1, 1, 1, 1,
  -1, -1, -1, 0, 0, 0, 1, 1, 1,
  -1, -1, 0, 0, 0, 0, 0, 1, 1,
  -1, 0, 0, 0, 0, 0, 0, 0, 1,
])

/**
 * `@va D2Common:0x6FD5DA40` (`PATH_SetPrecisionPosAndRecacheRoom113c`, not exported;
 * custom LTCG `esi = pPath`, stack `[esp+4] = dwPrecisionX`, `[esp+8] = dwPrecisionY`, `[esp+0xC] = pHintRoom`, `ret 0xC`).
 */
export function PATH_SetPrecisionPosAndRecacheRoom113c(
  m: Memory113c,
  pPath: number,
  dwPrecisionX: number,
  dwPrecisionY: number,
  pHintRoom: number,
): void {
  const path = pPath >>> 0
  const px = dwPrecisionX >>> 0
  const py = dwPrecisionY >>> 0
  if ((m.get(path, D2DynamicPathStrc.dwFlags) & 0x40000) !== 0) {
    const r = DUNGEON_GetRoomAtPosition113c(
      m,
      m.get(path, D2DynamicPathStrc.pRoom),
      px >>> 16,
      py >>> 16,
    )
    if (r === 0) {
      m.set(path, D2DynamicPathStrc.dwPathPoints, 0)
      return
    }
  }
  m.setU32((path + 0x04) >>> 0, py)
  m.setU32(path, px)
  const py11 = py >>> 11
  const px11 = px >>> 11
  m.set(path, D2DynamicPathStrc.dwClientCoordY, sar32((py11 + px11) | 0, 2) >>> 0)
  m.set(path, D2DynamicPathStrc.dwClientCoordX, sar32((px11 - py11) | 0, 1) >>> 0)
  if (
    m.get(path, D2DynamicPathStrc.pUnit) !== 0 &&
    (m.u8((path + 0x34) >>> 0) & 0x01) !== 0
  ) {
    PATH_RecacheRoom113c(m, path, pHintRoom >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD85530` (`PATH_ComputeDirectSinglePointPath113c`, not exported;
 * custom LTCG `eax = pDynamicPath`, plain `ret -> int32`).
 */
export function PATH_ComputeDirectSinglePointPath113c(
  m: Memory113c,
  pDynamicPath: number,
): number {
  const path = pDynamicPath >>> 0
  const posY = m.u16((path + 0x06) >>> 0)
  const posX = m.u16((path + 0x02) >>> 0)
  m.set(path, D2DynamicPathStrc.dwCurrentPointIdx, 0)
  const pTarget = m.get(path, D2DynamicPathStrc.pTargetUnit)
  if (pTarget !== 0) {
    const t1 = m.u32(pTarget) | 0
    const ptp1 = m.u32((pTarget + 0x2c) >>> 0)
    const tx1 =
      t1 === 2 || (t1 > 3 && t1 <= 5)
        ? m.u32((ptp1 + 0x0c) >>> 0) & 0xffff
        : ptp1 !== 0
          ? m.u16((ptp1 + 0x02) >>> 0)
          : 0
    m.setU16((path + 0x10) >>> 0, tx1)

    const t2 = m.u32(pTarget) | 0
    const ptp2 = m.u32((pTarget + 0x2c) >>> 0)
    const ty1 =
      t2 === 2 || (t2 > 3 && t2 <= 5)
        ? m.u32((ptp2 + 0x10) >>> 0) & 0xffff
        : ptp2 !== 0
          ? m.u16((ptp2 + 0x06) >>> 0)
          : 0
    m.setU16((path + 0x12) >>> 0, ty1)
  }

  const tx = m.u16((path + 0x10) >>> 0)
  const ty = m.u16((path + 0x12) >>> 0)
  const dx = (posX - tx) | 0
  const absDx = dx < 0 ? (-dx) | 0 : dx
  const dy = (posY - ty) | 0
  const absDy = dy < 0 ? (-dy) | 0 : dy
  if (absDx >= 100 || absDy >= 100 || tx === 0 || ty === 0) {
    return 0
  }

  m.set(path, D2DynamicPathStrc.dwPathPoints, 1)
  m.setU32((path + 0x9c) >>> 0, m.u32((path + 0x10) >>> 0))
  m.set(path, D2DynamicPathStrc.dwCurrentPointIdx, 0)
  PATH_ComputeVelocityToNextPoint113c(m, path, 1, 1)

  const pRoom = m.get(path, D2DynamicPathStrc.pRoom)
  const tx2 = m.u16((path + 0x10) >>> 0)
  const ty2 = m.u16((path + 0x12) >>> 0)
  const rx = pRoom !== 0 ? m.get(pRoom, D2ActiveRoomStrc.nSubtileX) | 0 : 0
  const rw = pRoom !== 0 ? m.get(pRoom, D2ActiveRoomStrc.nSubtileWidth) | 0 : 0
  const ry = pRoom !== 0 ? m.get(pRoom, D2ActiveRoomStrc.nSubtileY) | 0 : 0
  const rh = pRoom !== 0 ? m.get(pRoom, D2ActiveRoomStrc.nSubtileHeight) | 0 : 0
  if (
    pRoom === 0 ||
    tx2 < rx ||
    tx2 >= ((rx + rw) | 0) ||
    ty2 < ry ||
    ty2 >= ((ry + rh) | 0)
  ) {
    m.set(path, D2DynamicPathStrc.dwFlags, (m.get(path, D2DynamicPathStrc.dwFlags) | 1) >>> 0)
  }
  return m.get(path, D2DynamicPathStrc.dwPathPoints)
}

/**
 * `@va D2Common:0x6FD5DC80` (`PATH_StopMovementAndSnapToTileCenter113c`, not exported;
 * custom LTCG `eax = pDynamicPath`, plain `ret`).
 */
export function PATH_StopMovementAndSnapToTileCenter113c(
  m: Memory113c,
  pDynamicPath: number,
): void {
  const path = pDynamicPath >>> 0
  const precY = ((m.u32((path + 0x04) >>> 0) & 0xffff0000) + 0x8000) >>> 0
  const precX = ((m.u32(path) & 0xffff0000) + 0x8000) >>> 0
  PATH_SetPrecisionPosAndRecacheRoom113c(m, path, precX, precY, 0)
  m.set(path, D2DynamicPathStrc.dwFlags, (m.get(path, D2DynamicPathStrc.dwFlags) & ~0x20) >>> 0)
  m.set(path, D2DynamicPathStrc.dwPathPoints, 0)
  m.set(path, D2DynamicPathStrc.dwCurrentPointIdx, 0)
  m.set(path, D2DynamicPathStrc.tVelocityVectorX, 0)
  m.set(path, D2DynamicPathStrc.tVelocityVectorY, 0)
}

function probeWfDirection113c(
  m: Memory113c,
  pRoom: number,
  pPathMov: number,
  dir: number,
  nPattern: number,
  wMask: number,
): number {
  const tx = (m.u16((pPathMov + 0x08) >>> 0) + PATH_WF_DIR8_DX_6FDDCA38[dir]!) & 0xffff
  m.setU16((pPathMov + 0x0c) >>> 0, tx)
  const ty = (m.u16((pPathMov + 0x0a) >>> 0) + PATH_WF_DIR8_DY_6FDDCA38[dir]!) & 0xffff
  m.setU16((pPathMov + 0x0e) >>> 0, ty)
  return COLLISION_CheckMaskWithPattern2_113c(m, pRoom, tx, ty, nPattern, wMask)
}

/**
 * `@va D2Common:0x6FD686D0` (`PATH_FindNonCollidingTargetPoint113c`, not exported;
 * custom LTCG `eax = pPathInfo`, `esi = pPathMov`, plain `ret -> BOOL`).
 */
export function PATH_FindNonCollidingTargetPoint113c(
  m: Memory113c,
  pPathInfo: number,
  pPathMov: number,
): number {
  const info = pPathInfo >>> 0
  const mov = pPathMov >>> 0
  const nPattern = m.get(info, D2PathInfoStrc.dwCollisionPattern)
  const wMask = m.get(info, D2PathInfoStrc.nMoveTestCollisionMask)
  const pRoom = m.get(info, D2PathInfoStrc.pStartRoom)
  const pDynPath = m.get(info, D2PathInfoStrc.pDynamicPath)
  const pUnit = m.get(pDynPath, D2DynamicPathStrc.pUnit)
  if (pUnit === 0 || ((m.u32(pUnit) | 0) !== 0 && (m.u32(pUnit) | 0) !== 1)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\PathWF.cpp', 0x122)
  }

  let dir = m.u32(mov) | 0
  m.setU32((mov + 0x10) >>> 0, 0)
  if (probeWfDirection113c(m, pRoom, mov, dir, nPattern, wMask) === 0) {
    return 1
  }

  dir = m.u32((m.u32((mov + 0x18) >>> 0) + dir * 4) >>> 0) | 0
  m.setU32(mov, dir >>> 0)
  if (probeWfDirection113c(m, pRoom, mov, dir, nPattern, wMask) === 0) {
    return 1
  }

  dir = m.u32((m.u32((mov + 0x18) >>> 0) + dir * 4) >>> 0) | 0
  m.setU32(mov, dir >>> 0)
  if (probeWfDirection113c(m, pRoom, mov, dir, nPattern, wMask) === 0) {
    return 1
  }

  const curDir = m.u32(mov) | 0
  const pNextDirTable = m.u32((mov + 0x18) >>> 0)
  m.setU32((mov + 0x10) >>> 0, 1)
  dir = m.u32((pNextDirTable + curDir * 4) >>> 0) | 0
  m.setU32(mov, dir >>> 0)
  return probeWfDirection113c(m, pRoom, mov, dir, nPattern, wMask) === 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FD85780` (`PATH_ComputeSpecialFlag40000Path113c`, not exported;
 * custom LTCG `edi = pDynamicPath`, stack `[esp+4] = pUnit`, `ret 4 -> int32`).
 */
export function PATH_ComputeSpecialFlag40000Path113c(
  m: Memory113c,
  pDynamicPath: number,
  pUnit: number,
): number {
  const path = pDynamicPath >>> 0
  const unit = pUnit >>> 0
  const t = m.get(path, D2DynamicPathStrc.dwPathType) | 0
  if (t === 4) {
    const ok = PATH_ComputeDirectSinglePointPath113c(m, path)
    const flags = m.get(path, D2DynamicPathStrc.dwFlags)
    if (ok !== 0) {
      m.set(path, D2DynamicPathStrc.dwFlags, (flags | 0x20) >>> 0)
      return m.get(path, D2DynamicPathStrc.dwPathPoints)
    }
    m.set(path, D2DynamicPathStrc.dwFlags, (flags & ~0x20) >>> 0)
    return 0
  }
  if (t === 10) {
    PATH_ComputePathChargedBolt113c(m, (unit + 0x20) >>> 0, path)
    m.set(path, D2DynamicPathStrc.dwFlags, (m.get(path, D2DynamicPathStrc.dwFlags) | 0x20) >>> 0)
    return m.get(path, D2DynamicPathStrc.dwPathPoints)
  }
  if (t === 14) {
    PATH_BuildSpiralPath77Points113c(m, path)
    m.set(path, D2DynamicPathStrc.dwFlags, (m.get(path, D2DynamicPathStrc.dwFlags) | 0x20) >>> 0)
    return m.get(path, D2DynamicPathStrc.dwPathPoints)
  }
  throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 0x207)
}

/**
 * `@va D2Common:0x6FD85800` (`D2Common.#10775` `PATH_RemoveUnitCollisionFootprint113c`,
 * `__stdcall(pUnit, bForce) -> BOOL`, `ret 8`).
 */
export function PATH_RemoveUnitCollisionFootprint113c(
  m: Memory113c,
  pUnit: number,
  bForce: number,
): number {
  const unit = pUnit >>> 0
  const uType = m.u32(unit) | 0
  if (uType === 0 || uType === 1) {
    const mode = m.get(unit, D2UnitStrc.dwAnimMode) | 0
    const isDead = (uType === 0 ? mode === 17 : mode === 12) || mode === 0
    if (isDead && (bForce | 0) === 0) {
      return 0
    }
    const pPath = m.get(unit, D2UnitStrc.pPath)
    const nPattern = m.get(pPath, D2DynamicPathStrc.dwCollisionPattern)
    const y = pPath !== 0 ? m.u16((pPath + 0x06) >>> 0) : 0
    const x = pPath !== 0 ? m.u16((pPath + 0x02) >>> 0) : 0
    const wMask = UNITS_GetCollisionMask113c(m, unit)
    const pRoom = UNITS_GetRoom113c(m, unit)
    COLLISION_ResetMaskWithPattern113c(m, pRoom, x, y, nPattern, wMask)
    return 1
  }

  if (uType === 2) {
    const pObjData = m.u32((unit + 0x14) >>> 0)
    const pObjTxt = m.u32(pObjData)
    const mode = m.get(unit, D2UnitStrc.dwAnimMode) >>> 0
    // +0x120 of D2ObjectsTxt is bHasCollision[8] (`movzx eax, byte [edx+eax+0x120]` at 0x6FD858A4)
    const bHasColl = m.u8((pObjTxt + mode + 0x120) >>> 0)
    if (bHasColl === 0 && (bForce | 0) === 0) {
      return 0
    }
    const pSP = m.u32((unit + 0x2c) >>> 0)
    const y = m.u32((pSP + 0x10) >>> 0) | 0
    const x = m.u32((pSP + 0x0c) >>> 0) | 0
    const wMask = UNITS_GetCollisionMask113c(m, unit)
    const sy = UNITS_GetUnitSizeY113c(m, unit)
    const sx = UNITS_GetUnitSizeX113c(m, unit)
    const pRoom = UNITS_GetRoom113c(m, unit)
    COLLISION_ResetMaskWithSizeXY113c(m, pRoom, x, y, sx, sy, wMask)
    return 1
  }

  const pPath = m.u32((unit + 0x2c) >>> 0)
  const isStatic = uType > 3 && uType <= 5
  const y = isStatic ? m.u32((pPath + 0x10) >>> 0) | 0 : pPath !== 0 ? m.u16((pPath + 0x06) >>> 0) : 0
  const x = isStatic ? m.u32((pPath + 0x0c) >>> 0) | 0 : pPath !== 0 ? m.u16((pPath + 0x02) >>> 0) : 0
  const wMask = UNITS_GetCollisionMask113c(m, unit)
  const nPattern = UNITS_GetUnitSizeX113c(m, unit)
  const pRoom = UNITS_GetRoom113c(m, unit)
  COLLISION_ResetMaskWithPatternSimple113c(m, pRoom, x, y, nPattern, wMask)
  return 1
}

/**
 * `@va D2Common:0x6FD859D0` (`D2Common.#10713` `PATH_AddUnitCollisionFootprint113c`,
 * `__stdcall(pUnit)`, `ret 4`).
 */
export function PATH_AddUnitCollisionFootprint113c(
  m: Memory113c,
  pUnit: number,
): void {
  const unit = pUnit >>> 0
  const uType = m.u32(unit) | 0
  if (uType >= 0 && uType <= 1) {
    const pPath = m.get(unit, D2UnitStrc.pPath)
    const nPattern = m.get(pPath, D2DynamicPathStrc.dwCollisionPattern)
    const y = pPath !== 0 ? m.u16((pPath + 0x06) >>> 0) : 0
    const x = pPath !== 0 ? m.u16((pPath + 0x02) >>> 0) : 0
    const wMask = UNITS_GetCollisionMask113c(m, unit)
    const pRoom = UNITS_GetRoom113c(m, unit)
    COLLISION_SetUnitCollisionMaskWithPattern113c(m, pRoom, x, y, nPattern, wMask)
    return
  }

  if (uType === 2) {
    const pSP = m.u32((unit + 0x2c) >>> 0)
    const y = m.u32((pSP + 0x10) >>> 0) | 0
    const x = m.u32((pSP + 0x0c) >>> 0) | 0
    const wMask = UNITS_GetCollisionMask113c(m, unit)
    const sy = UNITS_GetUnitSizeY113c(m, unit)
    const sx = UNITS_GetUnitSizeX113c(m, unit)
    const pRoom = UNITS_GetRoom113c(m, unit)
    COLLISION_SetMaskWithSizeXY113c(m, pRoom, x, y, sx, sy, wMask)
    return
  }

  const pPath = m.u32((unit + 0x2c) >>> 0)
  const isStatic = uType > 3 && uType <= 5
  const y = isStatic ? m.u32((pPath + 0x10) >>> 0) | 0 : pPath !== 0 ? m.u16((pPath + 0x06) >>> 0) : 0
  const x = isStatic ? m.u32((pPath + 0x0c) >>> 0) | 0 : pPath !== 0 ? m.u16((pPath + 0x02) >>> 0) : 0
  const wMask = UNITS_GetCollisionMask113c(m, unit)
  const nPattern = UNITS_GetUnitSizeX113c(m, unit)
  const pRoom = UNITS_GetRoom113c(m, unit)
  COLLISION_SetMaskWithPattern113c(m, pRoom, x, y, nPattern, wMask)
}

/**
 * `@va D2Common:0x6FD85D40` (`PATH_NudgeTargetOutOfImmediateCollision113c`, not exported;
 * custom LTCG `esi = pPathInfo`, plain `ret`).
 */
export function PATH_NudgeTargetOutOfImmediateCollision113c(
  m: Memory113c,
  pPathInfo: number,
): void {
  const info = pPathInfo >>> 0
  const sx = m.get(info, D2PathInfoStrc.startX)
  const sy = m.get(info, D2PathInfoStrc.startY)
  let tx = m.get(info, D2PathInfoStrc.targetX)
  let ty = m.get(info, D2PathInfoStrc.targetY)
  const dx = (tx - sx) | 0
  const dy = (ty - sy) | 0
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  if (adx >= 5 || ady >= 5 || (adx === 0 && ady === 0)) {
    return
  }
  const nPattern = m.get(info, D2PathInfoStrc.dwCollisionPattern)
  const wMask = m.get(info, D2PathInfoStrc.nMoveTestCollisionMask)
  const stepX = PATH_NUDGE_GRID_81_6FDE4338[dx + dy * 9 + 40]! | 0
  const stepY = PATH_NUDGE_GRID_81_6FDE4338[dy + dx * 9 + 40]! | 0
  let cnt = adx > ady ? adx : ady
  do {
    tx = (tx + stepX) | 0
    ty = (ty + stepY) | 0
    const pRoom = m.get(info, D2PathInfoStrc.pStartRoom)
    if (COLLISION_CheckMaskWithPattern2_113c(m, pRoom, tx, ty, nPattern, wMask) !== 0) {
      break
    }
    cnt = (cnt + 1) | 0
    m.set(info, D2PathInfoStrc.targetX, tx & 0xffff)
    m.set(info, D2PathInfoStrc.targetY, ty & 0xffff)
  } while (cnt < 5)
}

/**
 * `@va D2Common:0x6FDB6C20` (`PATH_RaycastGridLineCollision113c`, not exported;
 * custom LTCG `eax = pDynamicPath`, stack `[esp+4] = dwStartPoint`, `[esp+8] = pInOutTargetPoint`, `ret 8 -> BOOL`).
 */
export function PATH_RaycastGridLineCollision113c(
  m: Memory113c,
  pDynamicPath: number,
  dwStartPoint: number,
  pInOutTargetPoint: number,
): number {
  const path = pDynamicPath >>> 0
  const pTargetPtr = pInOutTargetPoint >>> 0
  const nPattern = m.get(path, D2DynamicPathStrc.dwCollisionPattern)
  const pRoom = m.get(path, D2DynamicPathStrc.pRoom)
  const wMask = m.get(path, D2DynamicPathStrc.nMoveTestCollisionMask)

  const dwTarget = m.u32(pTargetPtr)
  const sx = dwStartPoint & 0xffff
  const sy = dwStartPoint >>> 16
  const tx = dwTarget & 0xffff
  const ty = dwTarget >>> 16
  const dx = (tx - sx) | 0
  const dy = (ty - sy) | 0
  const absDx = dx < 0 ? (-dx) | 0 : dx
  const absDy = dy < 0 ? (-dy) | 0 : dy
  const nx = (absDx + 1) | 0
  const ny = (absDy + 1) | 0

  let lastFree = dwStartPoint >>> 0
  let curX = sx
  let curY = sy
  const stepX = dx >= 0 ? 1 : -1
  const stepY = dy >= 0 ? 1 : -1

  if (nx > ny) {
    let err = ny
    do {
      curX = (curX + stepX) & 0xffff
      if (COLLISION_CheckMaskWithPattern2_113c(m, pRoom, curX, curY, nPattern, wMask) !== 0) {
        m.setU32(pTargetPtr, lastFree)
        return 0
      }
      err = (err + ny) | 0
      if (err >= nx) {
        curY = (curY + stepY) & 0xffff
        err = (err - nx) | 0
        if (err > 0) {
          if (COLLISION_CheckMaskWithPattern2_113c(m, pRoom, curX, curY, nPattern, wMask) !== 0) {
            m.setU32(pTargetPtr, lastFree)
            return 0
          }
        }
      }
      lastFree = (curX | (curY << 16)) >>> 0
    } while (curX !== tx)
    return 1
  }

  if (nx < ny) {
    let err = nx
    do {
      curY = (curY + stepY) & 0xffff
      if (COLLISION_CheckMaskWithPattern2_113c(m, pRoom, curX, curY, nPattern, wMask) !== 0) {
        m.setU32(pTargetPtr, lastFree)
        return 0
      }
      err = (err + nx) | 0
      if (err >= ny) {
        curX = (curX + stepX) & 0xffff
        err = (err - ny) | 0
        if (err > 0) {
          if (COLLISION_CheckMaskWithPattern2_113c(m, pRoom, curX, curY, nPattern, wMask) !== 0) {
            m.setU32(pTargetPtr, lastFree)
            return 0
          }
        }
      }
      lastFree = (curX | (curY << 16)) >>> 0
    } while (curY !== ty)
    return 1
  }

  if (sx === tx) {
    return 1
  }
  do {
    curX = (curX + stepX) & 0xffff
    curY = (curY + stepY) & 0xffff
    if (COLLISION_CheckMaskWithPattern2_113c(m, pRoom, curX, curY, nPattern, wMask) !== 0) {
      m.setU32(pTargetPtr, lastFree)
      return 0
    }
    lastFree = (curX | (curY << 16)) >>> 0
  } while (curX !== tx)
  return 1
}

/**
 * `@va D2Common:0x6FDB71B0` (`PATH_PickStepDirectionCandidate3_113c`, not exported;
 * custom LTCG `eax = pPathInfo`, stack `[esp+4] = dwCurPoint`, `[esp+8] = pCandidateDirs`, `[esp+0xC] = pOutDir`, `ret 0xC -> BOOL`).
 */
export function PATH_PickStepDirectionCandidate3_113c(
  m: Memory113c,
  pPathInfo: number,
  dwCurPoint: number,
  pCandidateDirs: number,
  pOutDir: number,
): number {
  const info = pPathInfo >>> 0
  const cand = pCandidateDirs >>> 0
  const outDir = pOutDir >>> 0
  const pDynPath = m.get(info, D2PathInfoStrc.pDynamicPath)
  const pUnit = m.get(pDynPath, D2DynamicPathStrc.pUnit)
  if (pUnit === 0 || ((m.u32(pUnit) | 0) !== 0 && (m.u32(pUnit) | 0) !== 1)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\PathMisc.cpp', 0x34)
  }

  const wMask = m.get(info, D2PathInfoStrc.nMoveTestCollisionMask)
  const pRoom = m.get(info, D2PathInfoStrc.pStartRoom)
  const nPattern = m.get(info, D2PathInfoStrc.dwCollisionPattern)
  const cx = dwCurPoint & 0xffff
  const cy = dwCurPoint >>> 16

  for (let k = 0; k < 3; k++) {
    const d = m.u32((cand + k * 4) >>> 0) | 0
    if (k === 2 && d === 0xff) {
      throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\PathMisc.cpp', 0x4c)
    }
    const nx = (cx + PATH_DIR8_DX_6FDDC2E0[d]!) & 0xffff
    const ny = (cy + PATH_DIR8_DY_6FDDC2E0[d]!) & 0xffff
    if (COLLISION_CheckMaskWithPattern2_113c(m, pRoom, nx, ny, nPattern, wMask) === 0) {
      m.setU32(outDir, d >>> 0)
      return 1
    }
  }
  return 0
}

/** `.rdata` IDA* best-direction table VA at `0x6FDDB860` (`int32[8][8]`, `256` bytes). */
export const PATH_IDASTAR_BEST_DIR_VA_6FDDB860 = 0x6fddb860

/** `.rdata` IDA* best-direction table `int32[8][8]` at `0x6FDDB860..0x6FDDB95F`. */
export const PATH_IDASTAR_BEST_DIR_TABLE_6FDDB860 = Int32Array.from([
  0, 1, 6, 3, 4, 5, 2, 7,
  0, 1, 6, 3, 1, 3, 6, 1,
  0, 1, 1, 1, 1, 1, 2, 7,
  1, 1, 1, 1, 1, 3, 6, 1,
  6, 4, 3, 6, 1, 3, 2, 7,
  7, 7, 7, 7, 7, 5, 2, 7,
  0, 7, 7, 7, 7, 5, 2, 7,
  0, 7, 2, 5, 7, 5, 2, 7,
])

/**
 * `@va D2Common:0x6FDC08F0` (`PATH_IdaStar_SearchLoop113c`, not exported;
 * custom LTCG `eax = pContext`, stack `[esp+4] = nFScoreCutoff`, `[esp+8] = pPathInfo`, `ret 8 -> D2IdaStarNodeStrc*`).
 */
export function PATH_IdaStar_SearchLoop113c(
  m: Memory113c,
  pContext: number,
  nFScoreCutoff: number,
  pPathInfo: number,
): number {
  const ctx = pContext >>> 0
  const info = pPathInfo >>> 0
  const cutoff = nFScoreCutoff | 0
  const dwTarget = m.u32((info + 0x04) >>> 0)
  const tx = dwTarget & 0xffff
  const ty = dwTarget >>> 16
  let esi = m.u32(ctx)
  let iters = 0

  while (true) {
    const cx = m.get(esi, D2IdaStarNodeStrc.wPosX)
    const cy = m.get(esi, D2IdaStarNodeStrc.wPosY)
    if (cx === tx && cy === ty) {
      return esi >>> 0
    }
    iters = (iters + 1) | 0
    if (iters > 10000) {
      return 0
    }
    if (
      cx < m.u16((ctx + 0x6278) >>> 0) ||
      cx > m.u16((ctx + 0x627c) >>> 0) ||
      cy < m.u16((ctx + 0x627a) >>> 0) ||
      cy > m.u16((ctx + 0x627e) >>> 0)
    ) {
      return esi >>> 0
    }

    const dir = m.get(esi, D2IdaStarNodeStrc.nNextNeighborIndex) | 0
    const nx = (cx + PATH_DIR8_DX_6FDDC2E0[dir]!) & 0xffff
    const ny = (cy + PATH_DIR8_DY_6FDDC2E0[dir]!) & 0xffff
    const gIdx =
      (imul32(
        ((m.u32((ctx + 0x628c) >>> 0) | 0) + ny) | 0,
        m.u32((ctx + 0x6284) >>> 0) | 0,
      ) +
        (m.u32((ctx + 0x6288) >>> 0) | 0) +
        nx) |
      0
    const pCell = (ctx + 0x6290 + gIdx * 4) >>> 0

    if (m.u32(pCell) === 0) {
      const hit = COLLISION_CheckMaskWithPattern2_113c(
        m,
        m.get(info, D2PathInfoStrc.pStartRoom),
        nx,
        ny,
        m.get(info, D2PathInfoStrc.dwCollisionPattern),
        m.get(info, D2PathInfoStrc.nMoveTestCollisionMask),
      )
      if (hit !== 0) {
        m.setU32(pCell, 1)
        esi = PATH_IdaStar_AdvanceToNextCandidate113c(m, esi, ctx)
        if (esi === 0) return 0
        continue
      }
    }

    const cost = cx === nx || cy === ny ? 2 : 3
    const newG16 = (m.get(esi, D2IdaStarNodeStrc.wGScore) + cost) & 0xffff
    const newGSigned = (newG16 << 16) >> 16
    const prev = m.u32(pCell)
    if (prev !== 0 && (prev >>> 0) < (newGSigned >>> 0)) {
      esi = PATH_IdaStar_AdvanceToNextCandidate113c(m, esi, ctx)
      if (esi === 0) return 0
      continue
    }
    m.setU32(pCell, newGSigned >>> 0)

    const adx = Math.abs((tx - nx) | 0)
    const ady = Math.abs((ty - ny) | 0)
    const minD = adx < ady ? adx : ady
    const maxD = adx < ady ? ady : adx
    const h = (minD + maxD * 2) | 0
    const f16 = (h + newG16) & 0xffff
    const fSigned = (f16 << 16) >> 16
    if (fSigned > cutoff) {
      esi = PATH_IdaStar_AdvanceToNextCandidate113c(m, esi, ctx)
      if (esi === 0) return 0
      continue
    }

    let pChild = m.get(esi, D2IdaStarNodeStrc.pChild)
    if (pChild === 0) {
      const used = m.u32((ctx + 0x6274) >>> 0)
      if (used === 0x384) {
        m.set(esi, D2IdaStarNodeStrc.pChild, 0)
        return 0
      }
      pChild = (ctx + 0x04 + imul32(used, 0x1c)) >>> 0
      m.setU32((ctx + 0x6274) >>> 0, (used + 1) >>> 0)
      m.fill(pChild, 0x1c, 0)
      m.set(esi, D2IdaStarNodeStrc.pChild, pChild)
      m.set(pChild, D2IdaStarNodeStrc.pParent, esi)
    }

    esi = pChild
    const parent = m.get(esi, D2IdaStarNodeStrc.pParent)
    m.set(esi, D2IdaStarNodeStrc.wGScore, newG16)
    m.set(esi, D2IdaStarNodeStrc.wFScore, f16)
    m.set(esi, D2IdaStarNodeStrc.wHScore, h & 0xffff)
    m.set(esi, D2IdaStarNodeStrc.nVisitCount, 0)

    const dwNewXY = (nx | (ny << 16)) >>> 0
    const qIdx = PATH_QuantizeDirectionIndex25_113c(dwNewXY, dwTarget)
    const relDir =
      (PATH_CHARGED_BOLT_BASE_DIR_6FDDC320[qIdx]! -
        m.get(parent, D2IdaStarNodeStrc.nNextNeighborIndex)) &
      7
    const pBestDir = (PATH_IDASTAR_BEST_DIR_VA_6FDDB860 + relDir * 32) >>> 0
    m.set(esi, D2IdaStarNodeStrc.pBestDirection, pBestDir)

    if (m.u32((ctx + 0x36fd0) >>> 0) !== 0) {
      const pSeed = m.u32((ctx + 0x36fd4) >>> 0)
      const seed: D2SeedStrc = { lo: m.u32(pSeed), hi: m.u32((pSeed + 4) >>> 0) }
      seedNext(seed)
      m.setU32((pSeed + 4) >>> 0, seed.hi)
      m.setU32(pSeed, seed.lo)
      const pPar = m.get(esi, D2IdaStarNodeStrc.pParent)
      const parIdx = m.get(pPar, D2IdaStarNodeStrc.nNextNeighborIndex)
      const jitter = PATH_IDASTAR_JITTER_TABLE_6FDDB960[seed.lo & 0x1f]! | 0
      const best0 = m.u32(m.get(esi, D2IdaStarNodeStrc.pBestDirection)) | 0
      m.set(esi, D2IdaStarNodeStrc.nNextNeighborIndex, ((jitter + parIdx + best0) & 7) >>> 0)
    } else {
      const parIdx = m.get(parent, D2IdaStarNodeStrc.nNextNeighborIndex)
      const best0 = m.u32(pBestDir) | 0
      m.set(esi, D2IdaStarNodeStrc.nNextNeighborIndex, ((parIdx + best0) & 7) >>> 0)
    }

    m.setU32((esi + 0x08) >>> 0, dwNewXY)
    const hSigned = (m.get(esi, D2IdaStarNodeStrc.wHScore) << 16) >> 16
    if (hSigned < m.get(info, D2PathInfoStrc.nTargetTypeStatus)) {
      return esi >>> 0
    }
  }
}

const ASTAR_REACHABLE_OFFSETS: readonly (readonly [number, number])[] = [
  [-2, -2],
  [-2, 2],
  [2, -2],
  [2, 2],
  [-2, 0],
  [0, -2],
  [2, 0],
  [0, 2],
]

/**
 * `@va D2Common:0x6FDCB2C0` (`PATH_AStar_IsTargetReachableOrHasNoTargetUnit113c`, not exported;
 * custom LTCG `eax = pPathInfo`, plain `ret -> BOOL`).
 */
export function PATH_AStar_IsTargetReachableOrHasNoTargetUnit113c(
  m: Memory113c,
  pPathInfo: number,
): number {
  const info = pPathInfo >>> 0
  const pDynPath = m.get(info, D2PathInfoStrc.pDynamicPath)
  if (m.get(pDynPath, D2DynamicPathStrc.pTargetUnit) === 0) {
    return 1
  }
  const tx = m.get(info, D2PathInfoStrc.targetX)
  const ty = m.get(info, D2PathInfoStrc.targetY)
  const pRoom = m.get(info, D2PathInfoStrc.pStartRoom)
  const nPattern = m.get(info, D2PathInfoStrc.dwCollisionPattern)
  const wMask = m.get(info, D2PathInfoStrc.nMoveTestCollisionMask)
  for (let i = 0; i < 8; i++) {
    const [ox, oy] = ASTAR_REACHABLE_OFFSETS[i]!
    if (
      COLLISION_CheckMaskWithPattern2_113c(
        m,
        pRoom,
        (tx + ox) | 0,
        (ty + oy) | 0,
        nPattern,
        wMask,
      ) === 0
    ) {
      return 1
    }
  }
  return 0
}

const ASTAR_EXPAND_NEIGHBOR_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
]

/**
 * `@va D2Common:0x6FDCB3C0` (`PATH_AStar_ExpandNodeNeighbors113c`, not exported;
 * custom LTCG `eax = pNode`, stack `[esp+4] = pPathInfo`, `[esp+8] = pContext`, `[esp+0xC] = dwTargetXY`, `ret 0xC -> BOOL`).
 */
export function PATH_AStar_ExpandNodeNeighbors113c(
  m: Memory113c,
  pNode: number,
  pPathInfo: number,
  pContext: number,
  dwTargetXY: number,
): number {
  const node = pNode >>> 0
  const info = pPathInfo >>> 0
  const ctx = pContext >>> 0
  const tgt = dwTargetXY >>> 0
  const pRoom = m.get(info, D2PathInfoStrc.pStartRoom)
  const nPattern = m.get(info, D2PathInfoStrc.dwCollisionPattern)
  const wMask = m.get(info, D2PathInfoStrc.nMoveTestCollisionMask)
  const x0 = m.get(node, D2AStarNodeStrc.wPosX)
  const y0 = m.get(node, D2AStarNodeStrc.wPosY)

  for (let i = 0; i < 8; i++) {
    const [ox, oy] = ASTAR_EXPAND_NEIGHBOR_OFFSETS[i]!
    const nx = (x0 + ox) & 0xffff
    const ny = (y0 + oy) & 0xffff
    if (COLLISION_CheckMaskWithPattern2_113c(m, pRoom, nx, ny, nPattern, wMask) === 0) {
      const xy = (nx | (ny << 16)) >>> 0
      if (PATH_AStar_ProcessNeighbor113c(m, node, info, ctx, xy, tgt) === 0) {
        return 0
      }
    }
  }
  return 1
}

// ============================================================================
// Iteration 11 Lane C — I11C-1 (F01..F08) & I11C-2 (F18..F26) PATH closure
// ============================================================================

/**
 * `@va D2Common:0x6FD68830` (`PATH_WallFollow_StepBidirectional113c`, not exported;
 * `__stdcall(pPathInfo, dwStartPt, pPtsBuf, pnCurIdx, pnTotalPts, nMaxStepBudget, nLineDir)`, `ret 0x1C -> int32`).
 */
export function PATH_WallFollow_StepBidirectional113c(
  m: Memory113c,
  pPathInfo: number,
  dwStartPt: number,
  pPtsBuf: number,
  pnCurIdx: number,
  pnTotalPts: number,
  nMaxStepBudget: number,
  nLineDir: number,
): number {
  const info = pPathInfo >>> 0
  const startPt = dwStartPt >>> 0
  const ptsBuf = pPtsBuf >>> 0
  const pCur = pnCurIdx >>> 0
  const pTotal = pnTotalPts >>> 0
  const maxSteps = nMaxStepBudget | 0
  const lineDir = nLineDir | 0

  const startX = startPt & 0xffff
  const startY = startPt >>> 16
  const curIdx0 = m.u32(pCur) | 0
  const curPt0 = m.u32((ptsBuf + curIdx0 * 4) >>> 0)
  const curX0 = curPt0 & 0xffff
  const curY0 = curPt0 >>> 16
  const deltaIdx = ((curY0 - startY) * 3 - startX + curX0 + 4) | 0
  const dir = PATH_WF_DELTA_TO_DIR_6FDE5198[deltaIdx]! | 0

  const sm = withPathStackScratch113c(m)
  const pMov0 = PATH_STACK_F01_BASE
  const pMov1 = (PATH_STACK_F01_BASE + 0x348) >>> 0
  sm.fill(pMov0, 0x348, 0)
  sm.fill(pMov1, 0x348, 0)

  sm.setU32(pMov1, (dir + 1) >>> 0)
  sm.setU32(pMov0, (dir + 7) >>> 0)
  sm.setU32((pMov1 + 0x08) >>> 0, startPt)
  sm.setU32((pMov0 + 0x08) >>> 0, startPt)
  sm.setU32((pMov1 + 0x18) >>> 0, 0x6fde50d8)
  sm.setU32((pMov0 + 0x18) >>> 0, 0x6fde5098)
  sm.setU32((pMov1 + 0x14) >>> 0, 0x6fde5158)
  sm.setU32((pMov0 + 0x14) >>> 0, 0x6fde5118)

  let ebx = pMov1
  let edi = pMov0

  while (true) {
    if (sm.u32((ebx + 0x20) >>> 0) === 0) {
      if (PATH_FindNonCollidingTargetPoint113c(sm, info, ebx) !== 0) {
        const candPt = sm.u32((ebx + 0x0c) >>> 0)
        const candX = candPt & 0xffff
        const candY = candPt >>> 16
        if ((sm.u32((ebx + 0x04) >>> 0) | 0) > 0 && (lineDir >>> 0) <= 3) {
          const lineDelta =
            lineDir === 0
              ? (startY - candY) | 0
              : lineDir === 1
                ? (candX - startX) | 0
                : lineDir === 2
                  ? (candY - startY) | 0
                  : (startX - candX) | 0
          if (lineDelta > 0) {
            const insIdx = (lineDelta + (sm.u32(pCur) | 0) - 1) | 0
            if (
              insIdx < (sm.u32(pTotal) | 0) &&
              sm.u32((ptsBuf + insIdx * 4) >>> 0) === candPt
            ) {
              const cnt = sm.u32((ebx + 0x04) >>> 0) | 0
              if (cnt >= maxSteps) {
                throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\PathWF.cpp', 0x1bb)
              }
              sm.setU32((ebx + 0x24 + cnt * 4) >>> 0, candPt)
              const cnt1 = (cnt + 1) | 0
              sm.setU32((ebx + 0x04) >>> 0, cnt1 >>> 0)
              sm.setU16((ebx + 0x24 + cnt1 * 4) >>> 0, 0)
              PATH_SpliceSegmentPoints113c(sm, insIdx, ebx, pTotal, ptsBuf, pCur)
              return sm.u32((ebx + 0x04) >>> 0) | 0
            }
          }
        }

        if ((sm.u32((edi + 0x04) >>> 0) | 0) > 1) {
          const matchIdx = sm.u32((ebx + 0x1c) >>> 0) | 0
          if (matchIdx !== 0) {
            if (candPt === sm.u32((edi + matchIdx * 4 + 0x1c) >>> 0)) {
              const curIdx = sm.u32(pCur) | 0
              sm.setU16((ptsBuf + curIdx * 4) >>> 0, 0)
              sm.setU32(pTotal, curIdx >>> 0)
              return 0
            }
            sm.setU32((ebx + 0x1c) >>> 0, 0)
          }
          if (candPt === sm.u32((edi + 0x08) >>> 0)) {
            sm.setU32((ebx + 0x1c) >>> 0, sm.u32((edi + 0x04) >>> 0))
          }
        }

        const cnt = sm.u32((ebx + 0x04) >>> 0) | 0
        sm.setU32((ebx + 0x24 + cnt * 4) >>> 0, candPt)
        sm.setU32((ebx + 0x08) >>> 0, candPt)
        const curDir = sm.u32(ebx) | 0
        const pAdv = sm.u32((ebx + 0x14) >>> 0)
        sm.setU32(ebx, sm.u32((pAdv + curDir * 4) >>> 0))
        const nextCnt = (cnt + 1) | 0
        sm.setU32((ebx + 0x04) >>> 0, nextCnt >>> 0)
        const rem = (maxSteps - (sm.u32(pTotal) | 0) - 1) | 0
        if (nextCnt >= rem) {
          sm.setU32((ebx + 0x20) >>> 0, 1)
        }
      } else {
        sm.setU32((ebx + 0x20) >>> 0, 1)
      }
    }

    if (sm.u32((ebx + 0x1c) >>> 0) === 0) {
      const tmp = ebx
      ebx = edi
      edi = tmp
    }
    if (sm.u32((pMov1 + 0x20) >>> 0) !== 0 || sm.u32((pMov0 + 0x20) >>> 0) !== 0) {
      break
    }
  }

  if (maxSteps <= 0x50) {
    const cnt1 = sm.u32((pMov1 + 0x04) >>> 0) | 0
    const cnt0 = sm.u32((pMov0 + 0x04) >>> 0) | 0
    const last1 = sm.u32((pMov1 + 0x20 + cnt1 * 4) >>> 0)
    const last0 = sm.u32((pMov0 + 0x20 + cnt0 * 4) >>> 0)
    const tx = sm.get(info, D2PathInfoStrc.targetX)
    const ty = sm.get(info, D2PathInfoStrc.targetY)
    const sx = sm.get(info, D2PathInfoStrc.startX)
    const sy = sm.get(info, D2PathInfoStrc.startY)

    const dx1 = (tx - (last1 & 0xffff)) | 0
    const dy1 = (ty - (last1 >>> 16)) | 0
    const d1 = (imul32(dx1, dx1) + imul32(dy1, dy1)) | 0

    const dx0 = (tx - (last0 & 0xffff)) | 0
    const dy0 = (ty - (last0 >>> 16)) | 0
    const d0 = (imul32(dx0, dx0) + imul32(dy0, dy0)) | 0

    const dxs = (tx - sx) | 0
    const dys = (ty - sy) | 0
    const ds = (imul32(dxs, dxs) + imul32(dys, dys)) | 0

    const bestMov = d0 <= d1 ? (ds < d0 ? 0 : pMov0) : ds < d1 ? 0 : pMov1
    if (bestMov !== 0) {
      const bestCnt = sm.u32((bestMov + 0x04) >>> 0) | 0
      const curIdx = sm.u32(pCur) | 0
      for (let i = 0; i < bestCnt; i++) {
        sm.setU32((ptsBuf + (curIdx + i) * 4) >>> 0, sm.u32((bestMov + 0x24 + i * 4) >>> 0))
      }
      const newTotal = (curIdx + bestCnt) | 0
      sm.setU32(pCur, newTotal >>> 0)
      sm.setU32(pTotal, newTotal >>> 0)
      sm.setU16((ptsBuf + newTotal * 4) >>> 0, 0)
      return sm.u32((ebx + 0x04) >>> 0) | 0
    }
    return 0
  }

  const curIdx = sm.u32(pCur) | 0
  sm.setU16((ptsBuf + curIdx * 4) >>> 0, 0)
  sm.setU32(pTotal, curIdx >>> 0)
  return 0
}

/**
 * `@va D2Common:0x6FD85E00` (`PATH_FindValidTargetPosition113c`, not exported;
 * custom LTCG `eax = pPathInfo`, plain `ret -> BOOL`).
 */
export function PATH_FindValidTargetPosition113c(
  m: Memory113c,
  pPathInfo: number,
): number {
  const info = pPathInfo >>> 0
  const pDynPath = m.get(info, D2PathInfoStrc.pDynamicPath)
  if ((m.get(pDynPath, D2DynamicPathStrc.dwFlags) & 0x40000) !== 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 0xc7)
  }

  const startX = m.get(info, D2PathInfoStrc.startX)
  const startY = m.get(info, D2PathInfoStrc.startY)
  const pStartRoom = m.get(info, D2PathInfoStrc.pStartRoom)
  const dwPattern = m.get(info, D2PathInfoStrc.dwCollisionPattern)
  const nMask = m.get(info, D2PathInfoStrc.nMoveTestCollisionMask)
  const pUnit = m.get(pDynPath, D2DynamicPathStrc.pUnit)
  const uType = pUnit === 0 ? 6 : m.get(pUnit, D2UnitStrc.dwUnitType)

  let x0 = m.get(info, D2PathInfoStrc.targetX)
  let y0 = m.get(info, D2PathInfoStrc.targetY)
  let x1 = x0
  let y1 = y0
  let x2 = x0
  let y2 = y0

  const qIdx = PATH_QuantizeDirectionIndex25_113c(
    m.u32((info + 0x04) >>> 0),
    m.u32(info),
  )
  let dir0 = PATH_VALID_TARGET_DIRS_6FDDC450[qIdx * 3]!
  const dir1 = PATH_VALID_TARGET_DIRS_6FDDC450[qIdx * 3 + 1]!
  const dir2 = PATH_VALID_TARGET_DIRS_6FDDC450[qIdx * 3 + 2]!

  while (x0 !== startX || y0 !== startY) {
    x0 = (x0 + PATH_DIR8_DX_6FDDC2E0[dir0]!) & 0xffff
    y0 = (y0 + PATH_DIR8_DY_6FDDC2E0[dir0]!) & 0xffff
    if (COLLISION_CheckMaskWithPattern2_113c(m, pStartRoom, x0, y0, dwPattern, nMask) === 0) {
      m.set(info, D2PathInfoStrc.targetX, x0)
      m.set(info, D2PathInfoStrc.targetY, y0)
      if (x0 === startX && y0 === startY) return 0
      if (uType === 0) PATH_NudgeTargetOutOfImmediateCollision113c(m, info)
      return 1
    }

    x1 = (x1 + PATH_DIR8_DX_6FDDC2E0[dir1]!) & 0xffff
    y1 = (y1 + PATH_DIR8_DY_6FDDC2E0[dir1]!) & 0xffff
    if (COLLISION_CheckMaskWithPattern2_113c(m, pStartRoom, x1, y1, dwPattern, nMask) === 0) {
      m.set(info, D2PathInfoStrc.targetX, x1)
      m.set(info, D2PathInfoStrc.targetY, y1)
      if (x1 === startX && y1 === startY) return 0
      if (uType === 0) PATH_NudgeTargetOutOfImmediateCollision113c(m, info)
      return 1
    }

    if (dir2 !== 0xff) {
      x2 = (x2 + PATH_DIR8_DX_6FDDC2E0[dir2]!) & 0xffff
      y2 = (y2 + PATH_DIR8_DY_6FDDC2E0[dir2]!) & 0xffff
      if (COLLISION_CheckMaskWithPattern2_113c(m, pStartRoom, x2, y2, dwPattern, nMask) === 0) {
        m.set(info, D2PathInfoStrc.targetX, x2)
        m.set(info, D2PathInfoStrc.targetY, y2)
        if (x2 === startX && y2 === startY) return 0
        if (uType === 0) PATH_NudgeTargetOutOfImmediateCollision113c(m, info)
        return 1
      }
    }

    const nq = PATH_QuantizeDirectionIndex25_113c(((y0 << 16) | x0) >>> 0, m.u32(info))
    dir0 = PATH_VALID_TARGET_DIRS_6FDDC450[nq * 3]!
  }

  return 0
}

/**
 * `@va D2Common:0x6FD86030` (`D2Common.#11003` `PATH_AllocDynamicPath113c`,
 * `__stdcall(pMemPool, pRoom, nX, nY, pUnit, bSetFlag10) -> int32`, `ret 0x18`).
 */
export function PATH_AllocDynamicPath113c(
  m: Memory113c,
  _pMemPool: number,
  pRoom: number,
  nX: number,
  nY: number,
  pUnit: number,
  bSetFlag10: number,
): number {
  const unit = pUnit >>> 0
  const room = pRoom >>> 0
  const uType = m.get(unit, D2UnitStrc.dwUnitType) | 0

  const pPath = m.alloc(0x200)
  if (pPath === 0) return 0
  m.fill(pPath, 0x200, 0)

  m.set(pPath, D2DynamicPathStrc.pUnit, unit)
  const sz = UNITS_GetUnitSizeX113c(m, unit)
  m.set(pPath, D2DynamicPathStrc.dwUnitSize, sz >>> 0)
  const pat = PATH_GetCollisionPatternForSize113c(m, unit, sz)
  m.set(pPath, D2DynamicPathStrc.dwCollisionPattern, pat >>> 0)
  m.set(pPath, D2DynamicPathStrc.pRoom, room)
  m.set(pPath, D2DynamicPathStrc.wPosX, nX & 0xffff)
  m.set(pPath, D2DynamicPathStrc.wOffsetX, 0x8000)
  m.set(pPath, D2DynamicPathStrc.wPosY, nY & 0xffff)
  m.set(pPath, D2DynamicPathStrc.wOffsetY, 0x8000)
  m.setU16((pPath + 0x1d8) >>> 0, nX & 0xffff)
  m.setU16((pPath + 0x1da) >>> 0, nY & 0xffff)
  m.set(pPath, D2DynamicPathStrc.dwVelocity, 0x800)
  m.set(pPath, D2DynamicPathStrc.nStepNum, 0)
  m.set(pPath, D2DynamicPathStrc.nSavedStepsCount, 1)
  m.set(unit, D2UnitStrc.pPath, pPath)

  const sm = withPathStackScratch113c(m)
  if (uType === 0) {
    m.set(pPath, D2DynamicPathStrc.nFootprintCollisionMask, 0x80)
    m.set(pPath, D2DynamicPathStrc.nMoveTestCollisionMask, 0x1c09)
    PATH_SetType113c(sm, pPath, 7)
    m.set(pPath, D2DynamicPathStrc.nDistMax, 0x49)
    m.set(pPath, D2DynamicPathStrc.nIDAStarInitFScore, 0x46)
  } else if (uType === 1) {
    m.set(pPath, D2DynamicPathStrc.nFootprintCollisionMask, 0x100)
    const pu = m.get(pPath, D2DynamicPathStrc.pUnit)
    if (pu !== 0 && m.get(pu, D2UnitStrc.dwUnitType) === 0) {
      throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 0x861)
    }
    const flagMask = sm.u32((PATH_TYPE_FLAGS_VA_6FDE4180 + 2 * 4) >>> 0)
    if ((flagMask & 0x2000) !== 0 && (m.get(pPath, D2DynamicPathStrc.dwFlags) & 0x4000) === 0) {
      m.set(pPath, D2DynamicPathStrc.dwPrevPathType, m.get(pPath, D2DynamicPathStrc.dwPathType))
    }
    if ((flagMask & 0x8000) !== 0 && (m.get(pPath, D2DynamicPathStrc.dwFlags) & 0x10000) === 0) {
      m.set(pPath, D2DynamicPathStrc.nPreviousVelocity, m.get(pPath, D2DynamicPathStrc.dwVelocity))
    }
    m.set(
      pPath,
      D2DynamicPathStrc.dwFlags,
      ((m.get(pPath, D2DynamicPathStrc.dwFlags) & 0xfff800ff) | flagMask) >>> 0,
    )
    m.set(pPath, D2DynamicPathStrc.dwPathType, 2)
    m.setU32((pPath + 0x98) >>> 0, sm.u32((PATH_TYPE_STEP_NUMS_VA_6FDE4138 + 2 * 4) >>> 0))
    const prevT = m.get(pPath, D2DynamicPathStrc.dwPrevPathType) | 0
    if (prevT === 0x0b) {
      throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 0x871)
    }
    if (prevT === 0x08) {
      throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 0x872)
    }

    let baseId = -1
    if (unit !== 0) {
      let cid = m.get(unit, D2UnitStrc.dwClassId) | 0
      if (cid >= 0) {
        const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
        const monCnt = m.u32((dt + DATATABLES_OFF_113C.nMonStatsTxtRecordCount) >>> 0) | 0
        if (cid < monCnt) {
          const monTbl = m.u32((dt + DATATABLES_OFF_113C.pMonStatsTxt) >>> 0)
          const rec = (monTbl + imul32(cid, D2MonStatsTxt_SIZE)) >>> 0
          if (rec !== 0) {
            cid = (m.u16((rec + 0x02) >>> 0) << 16) >> 16
          }
        }
        if (cid >= 0 && cid < monCnt) {
          baseId = cid
        }
      }
    }
    if (baseId === 0x26) {
      m.set(pPath, D2DynamicPathStrc.dwCollisionPattern, 5)
      m.set(pPath, D2DynamicPathStrc.nMoveTestCollisionMask, 0x804)
      m.set(pPath, D2DynamicPathStrc.nDistMax, 0x0e)
    } else {
      const mask = PATH_GetMonsterMoveTestMask113c(m, unit)
      m.set(pPath, D2DynamicPathStrc.nMoveTestCollisionMask, mask >>> 0)
      m.set(pPath, D2DynamicPathStrc.nDistMax, 0x0e)
    }
  } else if (uType === 3) {
    m.set(pPath, D2DynamicPathStrc.nFootprintCollisionMask, 0)
    m.set(pPath, D2DynamicPathStrc.nMoveTestCollisionMask, 0)
    PATH_SetType113c(sm, pPath, 4)
  }

  if (room !== 0) {
    PATH_AddUnitCollisionFootprint113c(m, unit)
    UNITROOM_AddUnitToRoom113c(m, unit, m.get(pPath, D2DynamicPathStrc.pRoom))
  }

  const py11 = m.u32((pPath + 0x04) >>> 0) >>> 11
  const px11 = m.u32(pPath) >>> 11
  m.set(pPath, D2DynamicPathStrc.dwClientCoordY, sar32((py11 + px11) | 0, 2) >>> 0)
  m.set(pPath, D2DynamicPathStrc.dwClientCoordX, sar32((px11 - py11) | 0, 1) >>> 0)
  if ((bSetFlag10 | 0) !== 0) {
    m.set(pPath, D2DynamicPathStrc.dwFlags, (m.get(pPath, D2DynamicPathStrc.dwFlags) | 0x10) >>> 0)
  }
  return bSetFlag10 >>> 0
}

/**
 * `@va D2Common:0x6FDB7390` (`PATH_ComputeKnockbackServer113c`, not exported;
 * `__fastcall(pPathInfo) -> int32`, plain `ret`).
 */
export function PATH_ComputeKnockbackServer113c(
  m: Memory113c,
  pPathInfo: number,
): number {
  const info = pPathInfo >>> 0
  const pDynPath = m.get(info, D2PathInfoStrc.pDynamicPath)
  const pTargetUnit = m.get(pDynPath, D2DynamicPathStrc.pTargetUnit)
  const dist = ((m.get(pDynPath, D2DynamicPathStrc.nDist) >>> 1) + 1) | 0

  const sm = withPathStackScratch113c(m)
  const pTargetScratch = PATH_STACK_F19_BASE
  if (pTargetUnit !== 0) {
    const tType1 = m.u32(pTargetUnit) | 0
    const ptp1 = m.u32((pTargetUnit + 0x2c) >>> 0)
    const tx =
      tType1 === 2 || (tType1 > 3 && tType1 <= 5)
        ? m.u32((ptp1 + 0x0c) >>> 0) | 0
        : ptp1 !== 0
          ? m.u16((ptp1 + 0x02) >>> 0)
          : 0

    const tType2 = m.u32(pTargetUnit) | 0
    const ptp2 = m.u32((pTargetUnit + 0x2c) >>> 0)
    const ty =
      tType2 === 2 || (tType2 > 3 && tType2 <= 5)
        ? m.u32((ptp2 + 0x10) >>> 0) | 0
        : ptp2 !== 0
          ? m.u16((ptp2 + 0x06) >>> 0)
          : 0

    const sx = m.get(info, D2PathInfoStrc.startX)
    const sy = m.get(info, D2PathInfoStrc.startY)
    const dx = (sx - tx) | 0
    const dy = (sy - ty) | 0
    const absDx = dx < 0 ? (-dx) | 0 : dx
    const absDy = dy < 0 ? (-dy) | 0 : dy
    const major = absDx > absDy ? absDx : absDy
    if (major > 0) {
      const kx = (sx + sdiv32(imul32(dx, dist), major)) & 0xffff
      const ky = (sy + sdiv32(imul32(dy, dist), major)) & 0xffff
      sm.setU16(pTargetScratch, kx)
      sm.setU16((pTargetScratch + 2) >>> 0, ky)
    } else {
      sm.setU32(pTargetScratch, m.u32(info))
    }
  } else {
    sm.setU32(pTargetScratch, m.u32((info + 0x04) >>> 0))
  }

  m.setU32((pDynPath + 0x9c) >>> 0, sm.u32(pTargetScratch))
  PATH_RaycastGridLineCollision113c(sm, pDynPath, m.u32(info), pTargetScratch)
  const resPt = sm.u32(pTargetScratch)
  if (pDynPath !== 0) {
    m.set(pDynPath, D2DynamicPathStrc.wTargetX, resPt & 0xffff)
    m.set(pDynPath, D2DynamicPathStrc.wTargetY, resPt >>> 16)
    m.set(pDynPath, D2DynamicPathStrc.pTargetUnit, 0)
  }
  if (resPt === m.u32(info)) {
    return 0
  }
  m.setU32((pDynPath + 0x9c) >>> 0, resPt)
  m.set(pDynPath, D2DynamicPathStrc.dwPathPoints, 1)
  return 1
}

/**
 * `@va D2Common:0x6FDB74C0` (`PATH_RebuildTurnCornersWithDirOffset113c`, not exported;
 * custom LTCG `ebx = pPathInfo`, plain `ret -> int32`).
 */
export function PATH_RebuildTurnCornersWithDirOffset113c(
  m: Memory113c,
  pPathInfo: number,
): number {
  const info = pPathInfo >>> 0
  const pDynPath = m.get(info, D2PathInfoStrc.pDynamicPath)
  const stepBudget = m.u32((info + 0x18) >>> 0) | 0
  let outCount = m.get(pDynPath, D2DynamicPathStrc.dwPathPoints) | 0
  let curPt = m.u32(info)
  const targetPt = m.u32((info + 0x04) >>> 0)
  const dirOff = m.u32((pDynPath + 0x98) >>> 0) | 0
  let prevDir = 0xff
  let bWroteAny = 0
  let brokeEarly = false

  const sm = withPathStackScratch113c(m)
  const pCand = (PATH_STACK_F19_BASE + 0x10) >>> 0
  const pOutDir = (PATH_STACK_F19_BASE + 0x20) >>> 0

  let steps = 0
  if (stepBudget > 0) {
    while (steps < stepBudget) {
      if ((curPt & 0xffff) === (targetPt & 0xffff) && (curPt >>> 16) === (targetPt >>> 16)) {
        break
      }
      bWroteAny = 0
      const qIdx = PATH_QuantizeDirectionIndex25_113c(curPt, targetPt)
      const base = qIdx * 3
      sm.setU32(pCand, ((PATH_CANDIDATE_DIRS_25X3_6FDDC320[base]! + dirOff) & 7) >>> 0)
      sm.setU32((pCand + 4) >>> 0, ((PATH_CANDIDATE_DIRS_25X3_6FDDC320[base + 1]! + dirOff) & 7) >>> 0)
      sm.setU32((pCand + 8) >>> 0, ((PATH_CANDIDATE_DIRS_25X3_6FDDC320[base + 2]! + dirOff) & 7) >>> 0)
      if (PATH_PickStepDirectionCandidate3_113c(sm, info, curPt, pCand, pOutDir) === 0) {
        brokeEarly = true
        break
      }
      const d = sm.u32(pOutDir) | 0
      if (((d - 4) & 7) === prevDir) {
        brokeEarly = true
        break
      }
      const nx = ((curPt & 0xffff) + PATH_DIR8_DX_6FDDC2E0[d]!) & 0xffff
      const ny = ((curPt >>> 16) + PATH_DIR8_DY_6FDDC2E0[d]!) & 0xffff
      const nextPt = (nx | (ny << 16)) >>> 0
      if (d !== prevDir) {
        m.setU32((pDynPath + 0x9c + outCount * 4) >>> 0, curPt)
        outCount = (outCount + 1) | 0
        bWroteAny = 1
      }
      curPt = nextPt
      prevDir = d
      steps = (steps + 1) | 0
    }
    if ((brokeEarly || bWroteAny === 0) && steps !== 0) {
      m.setU32((pDynPath + 0x9c + outCount * 4) >>> 0, curPt)
      outCount = (outCount + 1) | 0
    }
  }
  m.set(pDynPath, D2DynamicPathStrc.dwPathPoints, outCount >>> 0)
  return outCount
}

/**
 * `@va D2Common:0x6FDB7630` (`PATH_RaycastVelocityAndCollide113c`, not exported;
 * custom LTCG `eax = pDynamicPath`, `edi = pInOutTargetPoint`, plain `ret -> BOOL`).
 */
export function PATH_RaycastVelocityAndCollide113c(
  m: Memory113c,
  pDynamicPath: number,
  pInOutTargetPoint: number,
): number {
  const path = pDynamicPath >>> 0
  const pTargetPtr = pInOutTargetPoint >>> 0
  const pUnit = m.get(path, D2DynamicPathStrc.pUnit)
  if (pUnit === 0 || ((m.u32(pUnit) | 0) !== 0 && (m.u32(pUnit) | 0) !== 1)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\PathMisc.cpp', 0x144)
  }
  if ((m.get(path, D2DynamicPathStrc.dwPathType) | 0) === 4) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\PathMisc.cpp', 0x145)
  }
  if (m.u16(pTargetPtr) === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\PathMisc.cpp', 0x146)
  }
  if (m.u16((pTargetPtr + 2) >>> 0) === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\PathMisc.cpp', 0x147)
  }

  if (m.get(path, D2DynamicPathStrc.dwVelocity) === 0) {
    m.setU32(
      pTargetPtr,
      (m.get(path, D2DynamicPathStrc.wPosX) | (m.get(path, D2DynamicPathStrc.wPosY) << 16)) >>> 0,
    )
    return 0
  }

  PATH_ComputeVelocityToNextPoint113c(m, path, 1, 1)
  if (m.get(path, D2DynamicPathStrc.dwVelocity) === 0) {
    m.setU32(
      pTargetPtr,
      (m.get(path, D2DynamicPathStrc.wPosX) | (m.get(path, D2DynamicPathStrc.wPosY) << 16)) >>> 0,
    )
    return 0
  }

  const dwStart =
    (m.get(path, D2DynamicPathStrc.wPosX) | (m.get(path, D2DynamicPathStrc.wPosY) << 16)) >>> 0
  return PATH_RaycastGridLineCollision113c(m, path, dwStart, pTargetPtr)
}

/**
 * `@va D2Common:0x6FDC0BB0` (`PATH_IdaStar_ComputeInRoomBounds113c`, not exported;
 * custom LTCG `edx = pRoomBoundsRect`, stack `[esp+4] = pPathInfo`, `ret 4 -> int32`).
 */
export function PATH_IdaStar_ComputeInRoomBounds113c(
  m: Memory113c,
  pRoomBoundsRect: number,
  pPathInfo: number,
): number {
  const rect = pRoomBoundsRect >>> 0
  const info = pPathInfo >>> 0
  const sm = withPathStackScratch113c(m)
  const ctx = PATH_STACK_F07_BASE

  const w = m.u32((rect + 8) >>> 0) | 0
  const h = m.u32((rect + 0xc) >>> 0) | 0
  if (imul32(w, h) > 0xc350) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\PathIdaStar.cpp', 0x171)
  }

  const clearCount = imul32((w + 6) | 0, (h + 6) | 0)
  sm.fill((ctx + 0x6290) >>> 0, (clearCount * 4) >>> 0, 0)

  const rx16 = m.u16(rect)
  const ry16 = m.u16((rect + 4) >>> 0)
  const rw16 = m.u16((rect + 8) >>> 0)
  const rh16 = m.u16((rect + 0xc) >>> 0)
  sm.setU16((ctx + 0x6278) >>> 0, rx16)
  sm.setU16((ctx + 0x627a) >>> 0, ry16)
  sm.setU16((ctx + 0x6280) >>> 0, rw16)
  sm.setU16((ctx + 0x6282) >>> 0, rh16)
  sm.setU16((ctx + 0x627c) >>> 0, (rx16 + rw16) & 0xffff)
  sm.setU16((ctx + 0x627e) >>> 0, (ry16 + rh16) & 0xffff)
  sm.setU32((ctx + 0x6284) >>> 0, (rw16 + 6) >>> 0)
  sm.setU32((ctx + 0x6288) >>> 0, (3 - rx16) >>> 0)
  sm.setU32((ctx + 0x628c) >>> 0, (3 - ry16) >>> 0)

  const pathType = m.u32((info + 0x20) >>> 0) | 0
  if (pathType === 16) {
    sm.setU32((ctx + 0x36fd0) >>> 0, 1)
    const pDyn = m.u32((info + 0x30) >>> 0)
    const pUnit = m.u32((pDyn + 0x30) >>> 0)
    sm.setU32((ctx + 0x36fd4) >>> 0, (pUnit + 0x20) >>> 0)
  } else {
    sm.setU32((ctx + 0x36fd0) >>> 0, 0)
  }

  const dwStart = m.u32(info)
  const dwTarget = m.u32((info + 0x04) >>> 0)
  const adx = Math.abs(((dwStart & 0xffff) - (dwTarget & 0xffff)) | 0)
  const ady = Math.abs(((dwStart >>> 16) - (dwTarget >>> 16)) | 0)
  const h0 = (adx < ady ? adx + ady * 2 : ady + adx * 2) & 0xffff
  let ebx = (h0 << 16) >> 16
  const dir0 =
    PATH_CHARGED_BOLT_BASE_DIR_6FDDC320[PATH_QuantizeDirectionIndex25_113c(dwStart, dwTarget)]! & 7

  const root = (ctx + 0x04) >>> 0
  sm.setU32(ctx, root)
  sm.setU32((ctx + 0x6274) >>> 0, 1)

  let maxCutoff = ebx
  if (pathType === 0) {
    const initF = m.u8((info + 0x1c) >>> 0)
    maxCutoff = ((ebx <= initF ? initF : ebx) << 16) >> 16
  } else if (pathType === 16) {
    const half = (Math.trunc(ebx / 2) + h0) & 0xffff
    ebx = (half << 16) >> 16
    const initF = m.u8((info + 0x1c) >>> 0)
    maxCutoff = ((ebx <= initF ? initF : ebx) << 16) >> 16
  }

  let pResultNode = 0
  do {
    sm.set(root, D2IdaStarNodeStrc.wFScore, h0)
    sm.set(root, D2IdaStarNodeStrc.wHScore, h0)
    sm.set(root, D2IdaStarNodeStrc.wGScore, 0)
    sm.set(root, D2IdaStarNodeStrc.nVisitCount, 0xfffd)
    sm.setU32((root + 0x08) >>> 0, dwStart)
    sm.set(root, D2IdaStarNodeStrc.pBestDirection, PATH_IDASTAR_BEST_DIR_VA_6FDDB860)
    sm.set(root, D2IdaStarNodeStrc.nNextNeighborIndex, dir0 >>> 0)
    sm.set(root, D2IdaStarNodeStrc.pParent, 0)
    sm.set(root, D2IdaStarNodeStrc.pChild, 0)

    pResultNode = PATH_IdaStar_SearchLoop113c(sm, ctx, ebx, info)
    ebx = (ebx + 5) | 0
    if (pResultNode === 0 && sm.u32((ctx + 0x6274) >>> 0) === 0x384) {
      return 0
    }
    sm.setU32((ctx + 0x6274) >>> 0, 1)
    if (pResultNode !== 0) {
      break
    }
  } while (ebx < maxCutoff)

  if (pResultNode === 0) {
    return 0
  }
  const nPts = PATH_IdaStar_FlushNodeToDynamicPath113c(sm, info, pResultNode)
  return (nPts | 0) >= 0x4e ? 0 : nPts
}

/**
 * `@va D2Common:0x6FDCB630` (`PATH_AStar_ComputePath113c`, not exported;
 * `__fastcall(pPathInfo) -> int32`, plain `ret`).
 */
export function PATH_AStar_ComputePath113c(
  m: Memory113c,
  pPathInfo: number,
): number {
  const info = pPathInfo >>> 0
  if (PATH_AStar_IsTargetReachableOrHasNoTargetUnit113c(m, info) === 0) {
    return 0
  }

  const sm = withPathStackScratch113c(m)
  const ctx = PATH_STACK_F08_BASE
  sm.fill(ctx, 0x400, 0)

  const root = (ctx + 0x404) >>> 0
  sm.setU32((ctx + 0x400) >>> 0, 0)
  sm.setU32((ctx + 0x2fc4) >>> 0, 1)
  sm.fill(root, 0x38, 0)

  const dwStart = m.u32(info)
  const dwTarget = m.u32((info + 0x04) >>> 0)
  sm.setU32(root, dwStart)

  const sx = dwStart & 0xffff
  const sy = dwStart >>> 16
  const tx = dwTarget & 0xffff
  const ty = dwTarget >>> 16
  const adx = Math.abs((sx - tx) | 0)
  const ady = Math.abs((sy - ty) | 0)
  const h0 = adx >= ady ? (ady + adx * 2) | 0 : (adx + ady * 2) | 0
  sm.set(root, D2AStarNodeStrc.wGScore, 0)
  sm.set(root, D2AStarNodeStrc.wHScore, h0 & 0xffff)
  sm.set(root, D2AStarNodeStrc.wFScore, h0 & 0xffff)

  PATH_AStar_PushToOpenAndHash113c(sm, ctx, root)
  let cur = PATH_AStar_PopBestOpenToClosed113c(sm, ctx)
  let best = 0

  if (cur !== 0) {
    while (cur !== 0) {
      if (best === 0) {
        best = cur
      } else {
        const curH = (sm.get(cur, D2AStarNodeStrc.wHScore) << 16) >> 16
        const bestH = (sm.get(best, D2AStarNodeStrc.wHScore) << 16) >> 16
        if (curH < bestH) {
          best = cur
        } else if (curH === bestH) {
          const curG = (sm.get(cur, D2AStarNodeStrc.wGScore) << 16) >> 16
          const bestG = (sm.get(best, D2AStarNodeStrc.wGScore) << 16) >> 16
          if (curG > ((bestG + 5) | 0)) {
            best = cur
          }
        }
      }

      if (sm.get(cur, D2AStarNodeStrc.wHScore) === 0) {
        best = cur
        break
      }
      if (PATH_AStar_ExpandNodeNeighbors113c(sm, cur, info, ctx, dwTarget) === 0) {
        break
      }
      cur = PATH_AStar_PopBestOpenToClosed113c(sm, ctx)
    }

    if (best !== 0) {
      return PATH_AStar_FlushNodeToDynamicPath113c(sm, info, best)
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FD68C40` (`PATH_WallFollow_ComputePath113c`, not exported;
 * `__fastcall(pPathInfo) -> int32`, plain `ret`).
 */
export function PATH_WallFollow_ComputePath113c(
  m: Memory113c,
  pPathInfo: number,
): number {
  const info = pPathInfo >>> 0
  const pDynPath = m.get(info, D2PathInfoStrc.pDynamicPath)
  const pUnit = m.get(pDynPath, D2DynamicPathStrc.pUnit)
  if (pUnit === 0 || ((m.u32(pUnit) | 0) !== 0 && (m.u32(pUnit) | 0) !== 1)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\PathWF.cpp', 0x2ad)
  }

  let nMaxStepBudget = m.u8((pDynPath + 0x91) >>> 0)
  if (m.get(pDynPath, D2DynamicPathStrc.pTargetUnit) !== 0 && nMaxStepBudget < 0x28) {
    nMaxStepBudget = 0x28
  }

  const sm = withPathStackScratch113c(m)
  const pLineDir = PATH_STACK_F18_BASE
  const pnCurIdx = (PATH_STACK_F18_BASE + 4) >>> 0
  const pnTotalPts = (PATH_STACK_F18_BASE + 8) >>> 0
  const pPtsBuf = (PATH_STACK_F18_BASE + 0x10) >>> 0

  const total0 = PATH_BresenhamLine113c(
    sm,
    pPtsBuf,
    m.u32(info),
    m.u32((info + 0x04) >>> 0),
    nMaxStepBudget,
    pLineDir,
  )
  sm.setU32(pnTotalPts, total0 >>> 0)
  sm.setU32(pnCurIdx, 0)
  if ((total0 | 0) <= 2) {
    return 0
  }

  let prevPt = m.u32(info)
  while ((sm.u32(pnCurIdx) | 0) < (sm.u32(pnTotalPts) | 0)) {
    let curIdx = sm.u32(pnCurIdx) | 0
    const pt = sm.u32((pPtsBuf + curIdx * 4) >>> 0)
    const hit = COLLISION_CheckMaskWithPattern2_113c(
      sm,
      m.get(info, D2PathInfoStrc.pStartRoom),
      pt & 0xffff,
      pt >>> 16,
      m.get(info, D2PathInfoStrc.dwCollisionPattern),
      m.get(info, D2PathInfoStrc.nMoveTestCollisionMask),
    )
    if (hit !== 0) {
      const wfSteps = PATH_WallFollow_StepBidirectional113c(
        sm,
        info,
        prevPt,
        pPtsBuf,
        pnCurIdx,
        pnTotalPts,
        (nMaxStepBudget - curIdx) | 0,
        sm.u32(pLineDir) | 0,
      )
      if (wfSteps === 0) {
        const stopIdx = sm.u32(pnCurIdx) | 0
        return PATH_SimplifyToLines113c(sm, pPtsBuf, m.u32(info), (pDynPath + 0x9c) >>> 0, stopIdx)
      }
      curIdx = sm.u32(pnCurIdx) | 0
    }
    prevPt = sm.u32((pPtsBuf + curIdx * 4) >>> 0)
    sm.setU32(pnCurIdx, (curIdx + 1) >>> 0)
  }

  const finalTotal = sm.u32(pnTotalPts) | 0
  if (finalTotal === 0) {
    return 0
  }
  return PATH_SimplifyToLines113c(sm, pPtsBuf, m.u32(info), (pDynPath + 0x9c) >>> 0, finalTotal)
}

/**
 * `@va D2Common:0x6FDB77C0` (`PATH_ComputeStraightLineWalk113c`, not exported;
 * `__fastcall(pPathInfo) -> int32`, plain `ret`).
 */
export function PATH_ComputeStraightLineWalk113c(
  m: Memory113c,
  pPathInfo: number,
): number {
  const info = pPathInfo >>> 0
  const pDynPath = m.get(info, D2PathInfoStrc.pDynamicPath)
  m.set(pDynPath, D2DynamicPathStrc.dwCurrentPointIdx, 0)
  m.setU32((pDynPath + 0x9c) >>> 0, m.u32((info + 0x04) >>> 0))
  PATH_RaycastVelocityAndCollide113c(m, pDynPath, (pDynPath + 0x9c) >>> 0)
  return 1
}

/**
 * `@va D2Common:0x6FDB77F0` (`PATH_ComputeLeapOrKnockback113c`, not exported;
 * `__fastcall(pPathInfo) -> int32`, plain `ret`).
 */
export function PATH_ComputeLeapOrKnockback113c(
  m: Memory113c,
  pPathInfo: number,
): number {
  const info = pPathInfo >>> 0
  const pDynPath = m.get(info, D2PathInfoStrc.pDynamicPath)
  const dwTarget = m.u32((info + 0x04) >>> 0)
  m.set(pDynPath, D2DynamicPathStrc.dwCurrentPointIdx, 0)
  m.setU32((pDynPath + 0x9c) >>> 0, dwTarget)

  const sm = withPathStackScratch113c(m)
  const pTargetScratch = PATH_STACK_F19_BASE
  sm.setU32(pTargetScratch, dwTarget)
  PATH_RaycastVelocityAndCollide113c(sm, pDynPath, pTargetScratch)
  const newTarget = sm.u32(pTargetScratch)
  if ((newTarget & 0xffff) === m.get(info, D2PathInfoStrc.startX) && (newTarget >>> 16) === m.get(info, D2PathInfoStrc.startY)) {
    return 0
  }
  m.setU32((pDynPath + 0x9c) >>> 0, newTarget)
  m.set(pDynPath, D2DynamicPathStrc.dwPathPoints, 1)
  return 1
}

/**
 * `@va D2Common:0x6FDB7850` (`PATH_BuildTurnCornersWithFallbackOffset113c`, not exported;
 * `__fastcall(pPathInfo) -> int32`, plain `ret`).
 */
export function PATH_BuildTurnCornersWithFallbackOffset113c(
  m: Memory113c,
  pPathInfo: number,
): number {
  const info = pPathInfo >>> 0
  const pDynPath = m.get(info, D2PathInfoStrc.pDynamicPath)
  m.set(pDynPath, D2DynamicPathStrc.dwCurrentPointIdx, 0)
  m.setU32((pDynPath + 0x98) >>> 0, 0xfffffffc)
  const basePts = PATH_RebuildTurnCornersWithDirOffset113c(m, info) | 0
  if (basePts === 0) {
    return 0
  }
  m.set(pDynPath, D2DynamicPathStrc.dwPathPoints, basePts >>> 0)
  m.setU32((pDynPath + 0x98) >>> 0, 0xfffffffe)
  let totalPts = PATH_RebuildTurnCornersWithDirOffset113c(m, info) | 0
  if ((totalPts - basePts) === 0) {
    m.setU32((pDynPath + 0x98) >>> 0, 2)
    totalPts = PATH_RebuildTurnCornersWithDirOffset113c(m, info) | 0
  }
  m.setU32((pDynPath + 0x98) >>> 0, 0xfffffffc)
  return totalPts
}

/**
 * `@va D2Common:0x6FDB78B0` (`PATH_ComputeGuidedStepPath113c`, not exported;
 * `__fastcall(pPathInfo) -> int32`, plain `ret`).
 */
export function PATH_ComputeGuidedStepPath113c(
  m: Memory113c,
  pPathInfo: number,
): number {
  const info = pPathInfo >>> 0
  const pDynPath = m.get(info, D2PathInfoStrc.pDynamicPath)
  m.set(pDynPath, D2DynamicPathStrc.dwCurrentPointIdx, 0)
  m.set(pDynPath, D2DynamicPathStrc.dwPathPoints, 0)

  if ((m.u32((pDynPath + 0x98) >>> 0) | 0) !== 0) {
    return PATH_RebuildTurnCornersWithDirOffset113c(m, info)
  }

  const targetPt = m.u32((info + 0x04) >>> 0)
  const sm = withPathStackScratch113c(m)
  const pTargetScratch = PATH_STACK_F19_BASE
  sm.setU32(pTargetScratch, targetPt)
  m.setU32((pDynPath + 0x9c) >>> 0, targetPt)

  if (PATH_RaycastVelocityAndCollide113c(sm, pDynPath, pTargetScratch) !== 0) {
    const nPts = m.get(pDynPath, D2DynamicPathStrc.dwPathPoints) | 0
    m.setU32((pDynPath + 0x9c + nPts * 4) >>> 0, sm.u32(pTargetScratch))
    m.set(pDynPath, D2DynamicPathStrc.dwPathPoints, (nPts + 1) >>> 0)
    return (nPts + 1) | 0
  }

  const rayPt = sm.u32(pTargetScratch)
  if (PATH_OctileDistanceWithTable113c(rayPt, targetPt) <= m.u8((info + 0x14) >>> 0)) {
    const nPts = m.get(pDynPath, D2DynamicPathStrc.dwPathPoints) | 0
    m.setU32((pDynPath + 0x9c + nPts * 4) >>> 0, rayPt)
    m.set(pDynPath, D2DynamicPathStrc.dwPathPoints, (nPts + 1) >>> 0)
    return (nPts + 1) | 0
  }

  let curPt = m.u32(info)
  if ((curPt & 0xffff) !== (rayPt & 0xffff) || (curPt >>> 16) !== (rayPt >>> 16)) {
    const nPts = m.get(pDynPath, D2DynamicPathStrc.dwPathPoints) | 0
    m.setU32((pDynPath + 0x9c + nPts * 4) >>> 0, rayPt)
    m.set(pDynPath, D2DynamicPathStrc.dwPathPoints, (nPts + 1) >>> 0)
    curPt = rayPt
  }

  let outCount = m.get(pDynPath, D2DynamicPathStrc.dwPathPoints) | 0
  const stepBudget = m.u32((info + 0x18) >>> 0) | 0
  let prevDir = 0xff
  let bWroteAny = 0
  let steps = 0
  let brokeEarly = false
  const pOutDir = (PATH_STACK_F19_BASE + 8) >>> 0

  while (steps < stepBudget) {
    if ((curPt & 0xffff) === (targetPt & 0xffff) && (curPt >>> 16) === (targetPt >>> 16)) {
      break
    }
    bWroteAny = 0
    const qIdx = PATH_QuantizeDirectionIndex25_113c(curPt, targetPt)
    const pCand = (0x6fddc320 + qIdx * 12) >>> 0
    if (PATH_PickStepDirectionCandidate3_113c(sm, info, curPt, pCand, pOutDir) === 0) {
      brokeEarly = true
      break
    }
    const d = sm.u32(pOutDir) | 0
    if (((d - 4) & 7) === prevDir) {
      brokeEarly = true
      break
    }
    const nx = ((curPt & 0xffff) + PATH_DIR8_DX_6FDDC2E0[d]!) & 0xffff
    const ny = ((curPt >>> 16) + PATH_DIR8_DY_6FDDC2E0[d]!) & 0xffff
    const nextPt = (nx | (ny << 16)) >>> 0
    if (d !== prevDir) {
      if ((curPt & 0xffff) !== m.get(info, D2PathInfoStrc.startX) || (curPt >>> 16) !== m.get(info, D2PathInfoStrc.startY)) {
        m.setU32((pDynPath + 0x9c + outCount * 4) >>> 0, curPt)
        outCount = (outCount + 1) | 0
      }
      bWroteAny = 1
    }
    curPt = nextPt
    prevDir = d
    steps = (steps + 1) | 0
  }
  if ((brokeEarly || bWroteAny === 0) && steps !== 0) {
    m.setU32((pDynPath + 0x9c + outCount * 4) >>> 0, curPt)
    outCount = (outCount + 1) | 0
  }

  m.set(pDynPath, D2DynamicPathStrc.dwPathPoints, outCount >>> 0)
  return outCount
}

/**
 * `@va D2Common:0x6FDC0E40` (`PATH_IdaStar_ComputePathWithRooms113c`, not exported;
 * `__fastcall(pPathInfo) -> int32`, plain `ret`).
 */
export function PATH_IdaStar_ComputePathWithRooms113c(
  m: Memory113c,
  pPathInfo: number,
): number {
  const info = pPathInfo >>> 0
  const sm = withPathStackScratch113c(m)
  const pRect = PATH_STACK_F23_BASE
  const pCoords2 = (PATH_STACK_F23_BASE + 0x20) >>> 0

  m.setU8((info + 0x14) >>> 0, (m.u8((info + 0x14) >>> 0) << 1) & 0xff)
  const pStartRoom = m.get(info, D2PathInfoStrc.pStartRoom)
  DUNGEON_GetRoomCoordinates113c(sm, pStartRoom, pRect)
  let rx = sm.u32(pRect) | 0
  let ry = sm.u32((pRect + 4) >>> 0) | 0
  const origW = sm.u32((pRect + 8) >>> 0) | 0
  const origH = sm.u32((pRect + 12) >>> 0) | 0
  let rw = origW
  let rh = origH

  const pTargetRoom = m.get(info, D2PathInfoStrc.pTargetRoom)
  if (pTargetRoom !== 0 && pTargetRoom !== pStartRoom) {
    DUNGEON_GetRoomCoordinates113c(sm, pTargetRoom, pCoords2)
    const r2x = sm.u32(pCoords2) | 0
    const r2y = sm.u32((pCoords2 + 4) >>> 0) | 0
    const r2w = sm.u32((pCoords2 + 8) >>> 0) | 0
    const r2h = sm.u32((pCoords2 + 12) >>> 0) | 0
    if (r2x < rx) {
      rw = (origW - r2x + rx) | 0
      rx = r2x
    } else {
      rw = (r2w - rx + r2x) | 0
    }
    if (r2y < ry) {
      rh = (origH - r2y + ry) | 0
      ry = r2y
    } else {
      rh = (r2h - ry + r2y) | 0
    }
  }

  if (rw === origW) {
    rx = (rx - 10) | 0
    rw = (rw + 20) | 0
  }
  if (rh === origH) {
    ry = (ry - 10) | 0
    rh = (rh + 20) | 0
  }

  sm.setU32(pRect, rx >>> 0)
  sm.setU32((pRect + 4) >>> 0, ry >>> 0)
  sm.setU32((pRect + 8) >>> 0, rw >>> 0)
  sm.setU32((pRect + 12) >>> 0, rh >>> 0)

  return PATH_IdaStar_ComputeInRoomBounds113c(sm, pRect, info)
}

/**
 * `@va D2Common:0x6FDB7AD0` (`PATH_ComputeMonsterSeekPath113c`, not exported;
 * `__fastcall(pPathInfo) -> int32`, plain `ret`).
 */
export function PATH_ComputeMonsterSeekPath113c(
  m: Memory113c,
  pPathInfo: number,
): number {
  const info = pPathInfo >>> 0
  const pDynPath = m.get(info, D2PathInfoStrc.pDynamicPath)
  m.set(pDynPath, D2DynamicPathStrc.dwCurrentPointIdx, 0)
  m.set(pDynPath, D2DynamicPathStrc.dwPathPoints, 0)

  const pts = PATH_ComputeGuidedStepPath113c(m, info) | 0
  if (pts !== 0) {
    const lastPt = m.u32((pDynPath + 0x98 + pts * 4) >>> 0)
    const remDist = PATH_OctileDistanceWithTable113c(lastPt, m.u32((info + 0x04) >>> 0))
    if (remDist <= m.u8((info + 0x14) >>> 0) && lastPt !== m.u32(info)) {
      return pts
    }
  }

  const dx = Math.abs((m.get(info, D2PathInfoStrc.startX) - m.get(info, D2PathInfoStrc.targetX)) | 0)
  const dy = Math.abs((m.get(info, D2PathInfoStrc.startY) - m.get(info, D2PathInfoStrc.targetY)) | 0)
  if (((imul32(dx, dx) + imul32(dy, dy)) | 0) > 0x144) {
    return pts
  }

  const astarPts = PATH_AStar_ComputePath113c(m, info) | 0
  if (astarPts !== 0) {
    return astarPts
  }
  if (pts !== 0) {
    return PATH_ComputeGuidedStepPath113c(m, info)
  }
  return pts
}

/**
 * `@va D2Common:0x6FDB7B70` (`PATH_ComputeChargedBoltOrGuidedPath113c`, not exported;
 * `__fastcall(pPathInfo) -> int32`, plain `ret`).
 */
export function PATH_ComputeChargedBoltOrGuidedPath113c(
  m: Memory113c,
  pPathInfo: number,
): number {
  const info = pPathInfo >>> 0
  const pDynPath = m.get(info, D2PathInfoStrc.pDynamicPath)
  m.set(pDynPath, D2DynamicPathStrc.dwCurrentPointIdx, 0)
  return PATH_ComputeGuidedStepPath113c(m, info)
}

/**
 * `@va D2Common:0x6FD86230` (`D2Common.#10334` `PATH_Compute113c`,
 * `__stdcall(pDynamicPath, pUnit, bAllowInTown) -> int32`, `ret 0xC`).
 */
export function PATH_Compute113c(
  m: Memory113c,
  pDynamicPath: number,
  pUnit: number,
  bAllowInTown: number,
): number {
  const path = pDynamicPath >>> 0
  if (path === 0) {
    return 0
  }
  const unit = pUnit >>> 0
  if (m.get(path, D2DynamicPathStrc.pUnit) !== unit) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 0x2e8)
  }

  const flags0 = m.get(path, D2DynamicPathStrc.dwFlags)
  if ((flags0 & 0x40000) !== 0) {
    return PATH_ComputeSpecialFlag40000Path113c(m, path, unit)
  }

  const pTargetUnit0 = m.get(path, D2DynamicPathStrc.pTargetUnit)
  m.set(path, D2DynamicPathStrc.wCollidedWithMask, 0)
  if (pTargetUnit0 !== 0) {
    if (UNITS_GetX113c(m, pTargetUnit0) === 0 || UNITS_GetY113c(m, pTargetUnit0) === 0) {
      return 0
    }
  }

  const failCleanup = (): number => {
    m.set(path, D2DynamicPathStrc.dwCurrentPointIdx, 0)
    m.set(path, D2DynamicPathStrc.dwPathPoints, 0)
    m.set(path, D2DynamicPathStrc.dwFlags, (m.get(path, D2DynamicPathStrc.dwFlags) & ~0x20) >>> 0)
    return 0
  }

  const savedStartX = m.get(path, D2DynamicPathStrc.wPosX)
  const savedStartY = m.get(path, D2DynamicPathStrc.wPosY)
  if (savedStartX === 0 && savedStartY === 0) {
    return failCleanup()
  }

  const sm = withPathStackScratch113c(m)
  const info = PATH_STACK_F26_BASE
  sm.fill(info, 0x34, 0)
  sm.set(info, D2PathInfoStrc.startX, savedStartX)
  sm.set(info, D2PathInfoStrc.startY, savedStartY)
  sm.setU32((info + 0x10) >>> 0, m.get(path, D2DynamicPathStrc.dwUnitSize))
  sm.set(info, D2PathInfoStrc.dwCollisionPattern, m.get(path, D2DynamicPathStrc.dwCollisionPattern))
  sm.set(
    info,
    D2PathInfoStrc.nMoveTestCollisionMask,
    m.get(path, D2DynamicPathStrc.nMoveTestCollisionMask),
  )
  sm.set(info, D2PathInfoStrc.pDynamicPath, path)
  sm.setU32((info + 0x18) >>> 0, m.u8((path + 0x91) >>> 0))
  sm.setU8((info + 0x1c) >>> 0, m.u8((path + 0x92) >>> 0))

  const tgtStatus = PATH_ResolveTargetUnitPosition113c(sm, info) & 0xff
  sm.set(info, D2PathInfoStrc.nTargetTypeStatus, tgtStatus)

  const tx0 = m.get(path, D2DynamicPathStrc.wTargetX)
  const ty0 = m.get(path, D2DynamicPathStrc.wTargetY)
  if (tx0 === 0 && ty0 === 0) {
    return failCleanup()
  }

  sm.set(info, D2PathInfoStrc.targetX, tx0)
  sm.set(info, D2PathInfoStrc.targetY, ty0)
  if (savedStartX === tx0 && savedStartY === ty0) {
    return failCleanup()
  }

  const dx = (tx0 - savedStartX) | 0
  const dy = (ty0 - savedStartY) | 0
  if (dx > 0x64 || -dx > 0x64 || dy > 0x64 || -dy > 0x64) {
    return failCleanup()
  }

  const pStartRoom = m.get(path, D2DynamicPathStrc.pRoom)
  sm.set(info, D2PathInfoStrc.pStartRoom, pStartRoom)
  const pTargetRoom = DUNGEON_GetRoomAtPosition113c(sm, pStartRoom, tx0, ty0)
  sm.set(info, D2PathInfoStrc.pTargetRoom, pTargetRoom)
  if (pStartRoom === 0 || pTargetRoom === 0) {
    return failCleanup()
  }

  if (PATH_IsMonsterDestinationAllowed113c(sm, unit, info) === 0 && (bAllowInTown | 0) === 0) {
    return failCleanup()
  }

  const curPathType = m.get(path, D2DynamicPathStrc.dwPathType) | 0
  sm.setU32((info + 0x20) >>> 0, curPathType >>> 0)
  const pTargetUnit = m.get(path, D2DynamicPathStrc.pTargetUnit)
  PATH_RemoveUnitCollisionFootprint113c(sm, unit, 0)

  let bRemovedTarget = 0
  if (
    pTargetUnit !== 0 &&
    UNITS_GetUnitSizeX113c(sm, pTargetUnit) !== 0 &&
    (m.get(path, D2DynamicPathStrc.dwFlags) & 0x800) !== 0
  ) {
    bRemovedTarget = PATH_RemoveUnitCollisionFootprint113c(sm, pTargetUnit, 0)
  }

  let targetOk = 1
  if ((m.get(path, D2DynamicPathStrc.dwFlags) & 0x1000) !== 0) {
    if (
      COLLISION_CheckMaskWithPattern2_113c(
        sm,
        pStartRoom,
        sm.get(info, D2PathInfoStrc.targetX),
        sm.get(info, D2PathInfoStrc.targetY),
        m.get(path, D2DynamicPathStrc.dwCollisionPattern),
        m.get(path, D2DynamicPathStrc.nMoveTestCollisionMask),
      ) !== 0
    ) {
      targetOk = PATH_FindValidTargetPosition113c(sm, info)
    }
  }

  m.set(path, D2DynamicPathStrc.dwCurrentPointIdx, 0)
  m.set(path, D2DynamicPathStrc.wFinalTargetX, sm.get(info, D2PathInfoStrc.targetX))
  m.set(path, D2DynamicPathStrc.wFinalTargetY, sm.get(info, D2PathInfoStrc.targetY))
  m.set(path, D2DynamicPathStrc.dwPathPoints, 0)

  if (targetOk !== 0) {
    let nPts = 0
    switch (curPathType) {
      case 0:
      case 16:
        nPts = PATH_IdaStar_ComputePathWithRooms113c(sm, info)
        break
      case 1:
        nPts = PATH_AStar_ComputePath113c(sm, info)
        break
      case 2:
      case 5:
      case 6:
      case 13:
        nPts = PATH_ComputeGuidedStepPath113c(sm, info)
        break
      case 3:
        nPts = PATH_ComputeChargedBoltOrGuidedPath113c(sm, info)
        break
      case 7:
        nPts = PATH_ComputeMonsterSeekPath113c(sm, info)
        break
      case 8:
        nPts = PATH_ComputeKnockbackServer113c(sm, info)
        break
      case 9:
        nPts = PATH_ComputeLeapOrKnockback113c(sm, info)
        break
      case 11:
        nPts = PATH_ComputeStraightLineWalk113c(sm, info)
        break
      case 12:
        nPts = PATH_BuildTurnCornersWithFallbackOffset113c(sm, info)
        break
      case 15:
        nPts = PATH_WallFollow_ComputePath113c(sm, info)
        break
      default:
        throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 0x37e)
    }
    m.set(path, D2DynamicPathStrc.dwPathPoints, nPts >>> 0)
  } else {
    m.set(path, D2DynamicPathStrc.dwPathPoints, 0)
  }

  if (
    sm.get(info, D2PathInfoStrc.startX) !== savedStartX ||
    sm.get(info, D2PathInfoStrc.startY) !== savedStartY
  ) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 0x389)
  }

  if (bRemovedTarget !== 0) {
    PATH_AddUnitCollisionFootprint113c(sm, m.get(path, D2DynamicPathStrc.pTargetUnit))
  }
  PATH_AddUnitCollisionFootprint113c(sm, unit)

  if (m.get(path, D2DynamicPathStrc.dwPathPoints) === 0) {
    m.set(path, D2DynamicPathStrc.dwFlags, (m.get(path, D2DynamicPathStrc.dwFlags) & ~0x20) >>> 0)
    return 0
  }

  PATH_ComputeVelocityToNextPoint113c(sm, path, 1, 1)
  if ((m.get(path, D2DynamicPathStrc.dwCurrentPointIdx) | 0) >= (m.get(path, D2DynamicPathStrc.dwPathPoints) | 0)) {
    return failCleanup()
  }

  PATH_UpdateOutOfRoomFlag113c(sm, path)
  let flags = m.get(path, D2DynamicPathStrc.dwFlags)
  m.set(path, D2DynamicPathStrc.dwVelocityChangeCounter, 0)
  m.set(path, D2DynamicPathStrc.wPrevTargetX, m.get(path, D2DynamicPathStrc.wTargetX))
  m.set(path, D2DynamicPathStrc.wPrevTargetY, m.get(path, D2DynamicPathStrc.wTargetY))
  if ((flags & 0x10) === 0 && m.get(path, D2DynamicPathStrc.pTargetUnit) === 0) {
    const nPts = m.get(path, D2DynamicPathStrc.dwPathPoints) | 0
    m.set(path, D2DynamicPathStrc.wTargetX, m.u16((path + nPts * 4 + 0x98) >>> 0))
    m.set(path, D2DynamicPathStrc.wTargetY, m.u16((path + nPts * 4 + 0x9a) >>> 0))
  }

  const totalPts = m.get(path, D2DynamicPathStrc.dwPathPoints) | 0
  flags = totalPts !== 0 ? (flags | 0x20) >>> 0 : (flags & ~0x20) >>> 0
  m.set(path, D2DynamicPathStrc.dwFlags, flags)
  return totalPts
}

/**
 * `@va D2Common:0x6FD5D420` (`PATH_MoveOrTestSubtileStepCollision113c`, not exported;
 * custom LTCG `eax = pDynamicPath`, `[esp+4] = packedNewCoord`, `[esp+8] = packedOldCoord`, `ret 8`).
 */
export function PATH_MoveOrTestSubtileStepCollision113c(
  m: Memory113c,
  pDynamicPath: number,
  packedNewCoord: number,
  packedOldCoord: number,
): number {
  const path = pDynamicPath >>> 0
  const dwFlags = m.u32((path + 0x34) >>> 0) >>> 0
  const newX = packedNewCoord & 0xffff
  const newY = (packedNewCoord >>> 16) & 0xffff
  const oldX = packedOldCoord & 0xffff
  const oldY = (packedOldCoord >>> 16) & 0xffff

  if ((dwFlags & 0x04) !== 0) {
    const pUnit = m.u32((path + 0x30) >>> 0)
    if (pUnit === 0 || (m.u32(pUnit) !== 0 && m.u32(pUnit) !== 1)) {
      throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 0x209)
    }
    const wMask = m.u32((path + 0x4c) >>> 0)
    const nPattern = m.u32((path + 0x48) >>> 0)
    const pRoom1 = m.u32((path + 0x1c) >>> 0)
    if (pRoom1 !== 0) {
      COLLISION_ResetMaskWithPattern113c(m, pRoom1, oldX, oldY, nPattern, wMask)
      COLLISION_SetUnitCollisionMaskWithPattern113c(m, pRoom1, newX, newY, nPattern, wMask)
    }
    return 1
  }

  const bTestOnly = (dwFlags & 0x40000) >>> 0
  let wCheckMask = m.u32((path + 0x50) >>> 0) >>> 0
  if (wCheckMask === 0x3401) {
    wCheckMask = 0x3c01
  }
  const pRoom1 = m.u32((path + 0x1c) >>> 0)
  const wMoveMask = m.u32((path + 0x4c) >>> 0)
  let hitMask: number
  if (bTestOnly !== 0) {
    const nUnitSize = m.u32((path + 0x44) >>> 0)
    hitMask =
      UNITS_TestCollisionBetweenUnitsWithDoors113c(
        m,
        pRoom1,
        oldX,
        oldY,
        newX,
        newY,
        nUnitSize,
        wMoveMask,
        wCheckMask,
      ) & 0xffff
  } else {
    const nPattern = m.u32((path + 0x48) >>> 0)
    hitMask =
      COLLISION_MoveUnitCollisionMask113c(
        m,
        pRoom1,
        oldX,
        oldY,
        newX,
        newY,
        nPattern,
        wMoveMask,
        wCheckMask,
      ) & 0xffff
  }

  const wLast = (m.u16((path + 0x54) >>> 0) | hitMask) & 0xffff
  m.setU16((path + 0x54) >>> 0, wLast)
  if (wLast === 0) {
    return 1
  }
  if (bTestOnly === 0) {
    return 0
  }
  return (wLast & 0x05) !== 0 ? 0 : 1
}

/**
 * `@va D2Common:0x6FD5D820` (`D2Common.#10831` `PATH_RecomputeDynamicPath113c`,
 * `__stdcall(pUnit, bUsePrevTarget) -> int32`, `ret 8`).
 */
export function PATH_RecomputeDynamicPath113c(
  m: Memory113c,
  pUnit: number,
  bUsePrevTarget: number,
): number {
  const unit = pUnit >>> 0
  const path = m.u32((unit + 0x2c) >>> 0)
  if (path === 0) {
    return 0
  }
  if ((m.u8((path + 0x34) >>> 0) & 0x10) === 0) {
    if (m.u32(unit) === 1 && m.u8((path + 0x94) >>> 0) === 0) {
      return 0
    }
    UNITROOM_RefreshUnit113c(m, unit)
    m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x01) >>> 0)
    const diff = (m.u8((path + 0x94) >>> 0) - (m.u32((path + 0x24) >>> 0) | 0)) | 0
    if (diff < 0) {
      m.setU8((path + 0x94) >>> 0, 0)
    } else if (diff > 0xff) {
      m.setU8((path + 0x94) >>> 0, 0xff)
    } else {
      m.setU8((path + 0x94) >>> 0, diff & 0xff)
    }
  }

  const dwPathType = m.u32((path + 0x3c) >>> 0) | 0
  if (dwPathType === 2 || dwPathType === 13 || dwPathType === 15) {
    if ((bUsePrevTarget | 0) !== 0) {
      m.setU32((path + 0x3c) >>> 0, 13)
    } else {
      m.setU32((path + 0x10) >>> 0, m.u32((path + 0x18) >>> 0))
      m.setU32((path + 0x3c) >>> 0, 2)
    }
    const res = PATH_Compute113c(m, path, unit, 0) | 0
    if (res !== 0) {
      return res
    }
    m.setU32((path + 0x3c) >>> 0, 15)
  }
  return PATH_Compute113c(m, path, unit, 0) | 0
}

/**
 * `@va D2Common:0x6FD5DAB0` (`D2Common.#11121` `PATH_CopyPositionFromUnit113c`,
 * `__stdcall(pDstUnit, pSrcUnit) -> void`, `ret 8`).
 */
export function PATH_CopyPositionFromUnit113c(
  m: Memory113c,
  pDstUnit: number,
  pSrcUnit: number,
): void {
  const dstUnit = pDstUnit >>> 0
  const srcUnit = pSrcUnit >>> 0
  if (dstUnit === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 0x54e)
  }
  if (srcUnit === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 0x54f)
  }
  const srcPath = m.u32((srcUnit + 0x2c) >>> 0)
  const dstPath = m.u32((dstUnit + 0x2c) >>> 0)
  let flags = m.u32((dstPath + 0x34) >>> 0) >>> 0
  if (
    m.u16((dstPath + 0x02) >>> 0) === m.u16((srcPath + 0x02) >>> 0) &&
    m.u16((dstPath + 0x06) >>> 0) === m.u16((srcPath + 0x06) >>> 0)
  ) {
    flags = (flags & ~0x08) >>> 0
  } else {
    flags = (flags | 0x08) >>> 0
  }
  m.setU32((dstPath + 0x34) >>> 0, flags)
  if (m.u32((dstPath + 0x1c) >>> 0) !== m.u32((srcPath + 0x1c) >>> 0)) {
    m.setU32((dstPath + 0x34) >>> 0, (m.u32((dstPath + 0x34) >>> 0) | 0x01) >>> 0)
  }
  PATH_SetPrecisionPosAndRecacheRoom113c(
    m,
    dstPath,
    m.u32(srcPath),
    m.u32((srcPath + 0x04) >>> 0),
    m.u32((srcPath + 0x1c) >>> 0),
  )
}

/**
 * `@va D2Common:0x6FD5DB40` (`D2Common.#10770` `PATH_SnapToSubtileCenter113c`,
 * `__stdcall(pDynamicPath) -> void`, `ret 4`).
 */
export function PATH_SnapToSubtileCenter113c(m: Memory113c, pDynamicPath: number): void {
  const path = pDynamicPath >>> 0
  const newPrecY = ((m.u32((path + 0x04) >>> 0) & 0xffff0000) + 0x8000) >>> 0
  const newPrecX = ((m.u32(path) & 0xffff0000) + 0x8000) >>> 0
  PATH_SetPrecisionPosAndRecacheRoom113c(m, path, newPrecX, newPrecY, 0)
}

/**
 * `@va D2Common:0x6FD85640` (`D2Common.#11056` `PATH_SetCollisionMask113c`,
 * `__stdcall(pDynamicPath, nNewCollisionMask) -> void`, `ret 8`).
 */
export function PATH_SetCollisionMask113c(
  m: Memory113c,
  pDynamicPath: number,
  nNewCollisionMask: number,
): void {
  const path = pDynamicPath >>> 0
  const pRoom1 = m.u32((path + 0x1c) >>> 0)
  const wPosY = m.u16((path + 0x06) >>> 0)
  const wPosX = m.u16((path + 0x02) >>> 0)
  if (pRoom1 !== 0) {
    const pUnit = m.u32((path + 0x30) >>> 0)
    if (pUnit !== 0 && m.u32(pUnit) === 3) {
      COLLISION_ResetMaskWithPatternSimple113c(
        m,
        pRoom1,
        wPosX,
        wPosY,
        m.u32((path + 0x44) >>> 0),
        m.u32((path + 0x4c) >>> 0),
      )
    } else {
      COLLISION_ResetMaskWithPattern113c(
        m,
        pRoom1,
        wPosX,
        wPosY,
        m.u32((path + 0x48) >>> 0),
        m.u32((path + 0x4c) >>> 0),
      )
    }
  }
  const pRoom1After = m.u32((path + 0x1c) >>> 0)
  const newMask = nNewCollisionMask >>> 0
  m.setU32((path + 0x4c) >>> 0, newMask)
  if (pRoom1After !== 0) {
    const pUnit = m.u32((path + 0x30) >>> 0)
    if (pUnit !== 0 && m.u32(pUnit) === 3) {
      COLLISION_SetMaskWithPattern113c(
        m,
        pRoom1After,
        wPosX,
        wPosY,
        m.u32((path + 0x44) >>> 0),
        newMask,
      )
    } else {
      COLLISION_SetUnitCollisionMaskWithPattern113c(
        m,
        pRoom1After,
        wPosX,
        wPosY,
        m.u32((path + 0x48) >>> 0),
        newMask,
      )
    }
  }
}

/**
 * `@va D2Common:0x6FD85BA0` (`D2Common.#11009` `PATH_GetOrCheckLastCollisionMask113c`,
 * `__stdcall(pDynamicPath) -> uint16`, `ret 4`).
 */
export function PATH_GetOrCheckLastCollisionMask113c(m: Memory113c, pDynamicPath: number): number {
  const path = pDynamicPath >>> 0
  if (m.u32((path + 0x7c) >>> 0) === 0) {
    const mask =
      COLLISION_CheckMaskWithPattern1_113c(
        m,
        m.u32((path + 0x1c) >>> 0),
        m.u16((path + 0x02) >>> 0),
        m.u16((path + 0x06) >>> 0),
        m.u32((path + 0x44) >>> 0),
        0x7fff,
      ) & 0xffff
    m.setU16((path + 0x54) >>> 0, mask)
  }
  return m.u16((path + 0x54) >>> 0)
}

/**
 * `@va D2Common:0x6FD85CD0` (`D2Common.#10505` `PATH_RemoveUnitCollisionIfHasPath113c`,
 * `__stdcall(pUnit) -> void`, `ret 4`).
 */
export function PATH_RemoveUnitCollisionIfHasPath113c(m: Memory113c, pUnit: number): void {
  const unit = pUnit >>> 0
  if (m.u32((unit + 0x2c) >>> 0) !== 0) {
    PATH_RemoveUnitCollisionFootprint113c(m, unit, 1)
  }
}

/**
 * `@va D2Common:0x6FD85CF0` (`D2Common.#10704` `PATH_RefreshUnitCollisionPattern113c`,
 * `__stdcall(pUnit) -> void`, `ret 4`).
 */
export function PATH_RefreshUnitCollisionPattern113c(m: Memory113c, pUnit: number): void {
  const unit = pUnit >>> 0
  const pPath = m.u32((unit + 0x2c) >>> 0)
  if (pPath === 0) {
    return
  }
  if (UNITS_GetRoom113c(m, unit) !== 0) {
    PATH_RemoveUnitCollisionFootprint113c(m, unit, 1)
    const pat = PATH_GetCollisionPatternForSize113c(m, unit, m.u32((pPath + 0x44) >>> 0)) >>> 0
    m.setU32((m.u32((unit + 0x2c) >>> 0) + 0x48) >>> 0, pat)
    PATH_AddUnitCollisionFootprint113c(m, unit)
  } else {
    const pat = PATH_GetCollisionPatternForSize113c(m, unit, m.u32((pPath + 0x44) >>> 0)) >>> 0
    m.setU32((m.u32((unit + 0x2c) >>> 0) + 0x48) >>> 0, pat)
  }
}

/**
 * `@va D2Common:0x6FD5D580` (`PATH_RaymarchSubtileSteps113c`, not exported;
 * custom LTCG `esi = pDynamicPath`, `[esp+4] = dX`, `[esp+8] = dY`, `[esp+0xC] = pOutPos`, `[esp+0x10] = pOutSteps`, `ret 0x10`).
 */
export function PATH_RaymarchSubtileSteps113c(
  m: Memory113c,
  pDynamicPath: number,
  dX: number,
  dY: number,
  pOutPos: number,
  pOutSteps: number,
): number {
  const path = pDynamicPath >>> 0
  const outPos = pOutPos >>> 0
  const outSteps = pOutSteps >>> 0
  const sm = withPathStackScratch113c(m)
  const pVecX = PATH_STACK_I12C_F22_BASE
  const pVecY = (PATH_STACK_I12C_F22_BASE + 4) >>> 0

  m.setU32((path + 0x1d4) >>> 0, 0)
  sm.setU32(pVecX, dX >>> 0)
  sm.setU32(pVecY, dY >>> 0)
  PATH_NormalizePrecisionVector113c(sm, pVecX, pVecY)
  const stepVecX = sm.u32(pVecX) | 0
  const stepVecY = sm.u32(pVecY) | 0

  let curPrecX = m.u32(path) >>> 0
  let curPrecY = m.u32((path + 0x04) >>> 0) >>> 0
  const endPrecX = (curPrecX + (dX >>> 0)) >>> 0
  const endPrecY = (curPrecY + (dY >>> 0)) >>> 0
  let curTileX = (curPrecX >>> 16) & 0xffff
  let curTileY = (curPrecY >>> 16) & 0xffff
  const endTileX = (endPrecX >>> 16) & 0xffff
  const endTileY = (endPrecY >>> 16) & 0xffff
  const bSaveSteps = (m.u32((path + 0x34) >>> 0) & 0x20000) >>> 0

  while (curTileX !== endTileX || curTileY !== endTileY) {
    const nextPrecX = (curPrecX + (stepVecX >>> 0)) >>> 0
    const nextPrecY = (curPrecY + (stepVecY >>> 0)) >>> 0
    const nextTileX = (nextPrecX >>> 16) & 0xffff
    const nextTileY = (nextPrecY >>> 16) & 0xffff
    if (curTileX !== nextTileX || curTileY !== nextTileY) {
      const packedCur = ((curTileY << 16) | curTileX) >>> 0
      const packedNext = ((nextTileY << 16) | nextTileX) >>> 0
      const ok = PATH_MoveOrTestSubtileStepCollision113c(m, path, packedNext, packedCur)
      if (ok === 0) {
        m.setU32(outPos, ((curPrecX & 0xffff0000) + 0x8000) >>> 0)
        m.setU32((outPos + 0x04) >>> 0, ((curPrecY & 0xffff0000) + 0x8000) >>> 0)
        m.setU32(outSteps, m.u32((path + 0x1d4) >>> 0))
        return 1
      }
      if (bSaveSteps !== 0) {
        const idx = m.u32((path + 0x1d4) >>> 0) | 0
        m.setU32((path + 0x1d8 + idx * 4) >>> 0, packedNext)
      }
      const nSteps = ((m.u32((path + 0x1d4) >>> 0) | 0) + 1) | 0
      m.setU32((path + 0x1d4) >>> 0, nSteps >>> 0)
      if (nSteps >= 10) {
        break
      }
    }
    curPrecX = nextPrecX
    curPrecY = nextPrecY
    curTileX = nextTileX
    curTileY = nextTileY
  }

  if (m.u32((path + 0x1d4) >>> 0) !== 0) {
    m.setU32((path + 0x34) >>> 0, (m.u32((path + 0x34) >>> 0) | 0x08) >>> 0)
  }
  m.setU32(outPos, endPrecX)
  m.setU32((outPos + 0x04) >>> 0, endPrecY)
  m.setU32(outSteps, m.u32((path + 0x1d4) >>> 0))
  return 0
}

/**
 * `@va D2Common:0x6FD5DB70` (`PATH_CheckTargetMovedAndRecompute113c`, not exported;
 * custom LTCG `esi = pDynamicPath -> eax`, `ret`).
 */
export function PATH_CheckTargetMovedAndRecompute113c(m: Memory113c, pDynamicPath: number): number {
  const path = pDynamicPath >>> 0
  const dwPathType = m.u32((path + 0x3c) >>> 0) | 0
  if (
    dwPathType >= 5 &&
    dwPathType <= 6 &&
    (m.u32((path + 0x24) >>> 0) | 0) >= (m.u32((path + 0x28) >>> 0) | 0)
  ) {
    return 1
  }

  let pTargetUnit = m.u32((path + 0x58) >>> 0)
  const pUnit = m.u32((path + 0x30) >>> 0)
  if (pTargetUnit === 0) {
    if ((m.u32((path + 0x24) >>> 0) | 0) < (m.u32((path + 0x28) >>> 0) | 0)) {
      return 1
    }
    if (
      m.u16((path + 0x02) >>> 0) === m.u16((path + 0x18) >>> 0) &&
      m.u16((path + 0x06) >>> 0) === m.u16((path + 0x1a) >>> 0)
    ) {
      return 1
    }
    return PATH_RecomputeDynamicPath113c(m, pUnit, 0) | 0
  }

  const dist = UNITS_GetDistanceToOtherUnit113c(m, pTargetUnit, pUnit) | 0
  if (dist <= m.u8((path + 0x93) >>> 0)) {
    return 0
  }

  const curPosX = m.u16((path + 0x02) >>> 0)
  const curPosY = m.u16((path + 0x06) >>> 0)
  const sm = withPathStackScratch113c(m)
  const pOutCoords = PATH_STACK_I12C_F23_BASE
  sm.setU32(pOutCoords, 0)
  PATH_GetTargetUnitCoordsWithTrigOffset113c(sm, path, pOutCoords)

  pTargetUnit = m.u32((path + 0x58) >>> 0)
  if (pTargetUnit !== 0) {
    const targetType = m.u32(pTargetUnit) | 0
    if (targetType >= 0 && targetType <= 1) {
      let dx = ((m.u16((path + 0x14) >>> 0) - sm.u16(pOutCoords)) | 0)
      if (dx < 0) dx = (-dx) | 0
      if (dx > 5) {
        return PATH_RecomputeDynamicPath113c(m, pUnit, 1) | 0
      }
      let dy = ((m.u16((path + 0x16) >>> 0) - sm.u16((pOutCoords + 0x02) >>> 0)) | 0)
      if (dy < 0) dy = (-dy) | 0
      if (dy > 5) {
        return PATH_RecomputeDynamicPath113c(m, pUnit, 1) | 0
      }
    }
  }

  if (
    (m.u32((path + 0x24) >>> 0) | 0) >= (m.u32((path + 0x28) >>> 0) | 0) &&
    (m.u16((path + 0x18) >>> 0) !== curPosX || m.u16((path + 0x1a) >>> 0) !== curPosY)
  ) {
    return PATH_RecomputeDynamicPath113c(m, pUnit, 1) | 0
  }
  return 1
}

/**
 * `@va D2Common:0x6FD5D8E0` (`PATH_AdvancePrecisionStep113c`, not exported;
 * custom LTCG `eax = pDynamicPath`, `[esp+4] = pOutPos`, `[esp+8] = pOutSteps`, `ret 8`).
 */
export function PATH_AdvancePrecisionStep113c(
  m: Memory113c,
  pDynamicPath: number,
  pOutPos: number,
  pOutSteps: number,
): number {
  const path = pDynamicPath >>> 0
  const outPos = pOutPos >>> 0
  const outSteps = pOutSteps >>> 0
  const pUnit = m.u32((path + 0x30) >>> 0)
  m.setU16((path + 0x54) >>> 0, 0)
  m.setU32(outSteps, 0)

  const bGuidedMonster =
    pUnit !== 0 && m.u32(pUnit) === 1 && (m.u8((path + 0x34) >>> 0) & 0x10) !== 0 ? 1 : 0

  if (m.u32((path + 0x72) >>> 0) === 0 && m.u32((path + 0x76) >>> 0) === 0) {
    m.setU32((path + 0x28) >>> 0, 0)
    m.setU32((path + 0x24) >>> 0, 0)
    m.setU32(outPos, ((m.u32(path) & 0xffff0000) + 0x8000) >>> 0)
    m.setU32((outPos + 0x04) >>> 0, ((m.u32((path + 0x04) >>> 0) & 0xffff0000) + 0x8000) >>> 0)
    return 0
  }

  const sm = withPathStackScratch113c(m)
  const pStepVel = PATH_STACK_I12C_F24_BASE
  const bReachedWaypoint = PATH_CheckStepTargetDistance113c(sm, path, pStepVel)
  const dX = sm.u32(pStepVel) | 0
  const dY = sm.u32((pStepVel + 0x04) >>> 0) | 0
  const curPrecX = m.u32(path) >>> 0
  const curPrecY = m.u32((path + 0x04) >>> 0) >>> 0
  const endPrecX = (curPrecX + (dX >>> 0)) >>> 0
  const endPrecY = (curPrecY + (dY >>> 0)) >>> 0

  if ((curPrecX >>> 16) !== (endPrecX >>> 16) || (curPrecY >>> 16) !== (endPrecY >>> 16)) {
    const nDirChange = m.u8((path + 0x90) >>> 0)
    if (nDirChange !== 0) {
      const pt = m.u32((path + 0x3c) >>> 0)
      if (pt !== 8 && pt !== 11) {
        m.setU8((path + 0x90) >>> 0, (nDirChange - 1) & 0xff)
      }
    }
    const bBlocked = PATH_RaymarchSubtileSteps113c(m, path, dX, dY, outPos, outSteps)
    if (bBlocked !== 0) {
      if (bGuidedMonster !== 0) {
        const bHasTarget = m.u32((path + 0x58) >>> 0) !== 0 ? 1 : 0
        const recomp = PATH_RecomputeDynamicPath113c(m, pUnit, bHasTarget)
        return recomp !== 0 ? 0 : 1
      }
      m.setU32((path + 0x24) >>> 0, m.u32((path + 0x28) >>> 0))
      return 0
    }
  }

  m.setU32(outPos, endPrecX)
  m.setU32((outPos + 0x04) >>> 0, endPrecY)
  if (bReachedWaypoint === 0) {
    return 0
  }
  m.setU32((path + 0x24) >>> 0, (m.u32((path + 0x24) >>> 0) + 1) >>> 0)
  return 1
}

/**
 * `@va D2Common:0x6FD5E230` (`D2Common.#10342` `PATH_Step113c`,
 * `__stdcall(pUnit, nRate) -> BOOL`, `ret 8`).
 */
export function PATH_Step113c(m: Memory113c, pUnit: number, nRate: number): number {
  const unit = pUnit >>> 0
  const pPath = m.u32((unit + 0x2c) >>> 0)
  if (pPath === 0) {
    return 0
  }

  const dwFlags = (m.u32((pPath + 0x34) >>> 0) & ~0x08) >>> 0
  m.setU32((pPath + 0x34) >>> 0, dwFlags)
  if ((dwFlags & 0x40000) !== 0) {
    m.setU16((pPath + 0x54) >>> 0, 0)
  }

  if (
    (dwFlags & 0x20) === 0 ||
    (m.u32((pPath + 0x28) >>> 0) | 0) <= 0 ||
    m.u32((pPath + 0x7c) >>> 0) === 0
  ) {
    PATH_StopMovementAndSnapToTileCenter113c(m, pPath)
    return 0
  }

  if ((m.u32((pPath + 0x34) >>> 0) & 0x40000) === 0) {
    if (PATH_CheckTargetMovedAndRecompute113c(m, pPath) === 0) {
      PATH_StopMovementAndSnapToTileCenter113c(m, pPath)
      return 0
    }
  }

  if ((m.u32((pPath + 0x24) >>> 0) | 0) >= (m.u32((pPath + 0x28) >>> 0) | 0)) {
    PATH_StopMovementAndSnapToTileCenter113c(m, pPath)
    return 0
  }

  PATH_StepVelocity113c(m, pPath, nRate | 0)
  if (m.u32((pPath + 0x72) >>> 0) === 0 && m.u32((pPath + 0x76) >>> 0) === 0) {
    PATH_StopMovementAndSnapToTileCenter113c(m, pPath)
    return 0
  }

  const sm = withPathStackScratch113c(m)
  const pOutPos = PATH_STACK_I12C_F25_BASE
  const pOutSteps = (PATH_STACK_I12C_F25_BASE + 0x08) >>> 0
  PATH_AdvancePrecisionStep113c(sm, pPath, pOutPos, pOutSteps)
  PATH_SetPrecisionPosAndRecacheRoom113c(
    sm,
    pPath,
    sm.u32(pOutPos),
    sm.u32((pOutPos + 0x04) >>> 0),
    0,
  )

  if (
    m.u32((pPath + 0x3c) >>> 0) !== 4 &&
    (m.u32((pPath + 0x24) >>> 0) | 0) < (m.u32((pPath + 0x28) >>> 0) | 0)
  ) {
    PATH_ComputeVelocityToNextPoint113c(m, pPath, 1, 1)
  }

  if ((m.u32((pPath + 0x24) >>> 0) | 0) < (m.u32((pPath + 0x28) >>> 0) | 0)) {
    return 1
  }
  PATH_StopMovementAndSnapToTileCenter113c(m, pPath)
  return 0
}

/**
 * `@va D2Common:0x6FD865A0` (`D2Common.#10084` `PATH_MarkUnitDeadCollision113c`,
 * `__stdcall(pUnit, bIsCorpse) -> void`, `ret 8`).
 */
export function PATH_MarkUnitDeadCollision113c(
  m: Memory113c,
  pUnit: number,
  bIsCorpse: number,
): void {
  const unit = pUnit >>> 0
  const pPath = m.u32((unit + 0x2c) >>> 0)
  if ((bIsCorpse | 0) === 0 && m.u32(unit) === 1) {
    PATH_RemoveUnitCollisionFootprint113c(m, unit, 1)
    m.setU32((m.u32((unit + 0x2c) >>> 0) + 0x48) >>> 0, 5)
    PATH_SetCollisionMask113c(m, pPath, 0x8000)
    PATH_AddUnitCollisionFootprint113c(m, unit)
  } else {
    if (pPath !== 0) {
      PATH_RemoveUnitCollisionFootprint113c(m, unit, 1)
    }
    const sm = withPathStackScratch113c(m)
    const pBox = PATH_STACK_I12C_F26_BASE
    const x = m.u16((pPath + 0x02) >>> 0)
    const y = m.u16((pPath + 0x06) >>> 0)
    sm.setU32(pBox, ((x - 1) | 0) >>> 0)
    sm.setU32((pBox + 0x04) >>> 0, ((y - 1) | 0) >>> 0)
    sm.setU32((pBox + 0x08) >>> 0, ((x + 1) | 0) >>> 0)
    sm.setU32((pBox + 0x0c) >>> 0, ((y + 1) | 0) >>> 0)
    COLLISION_SetMaskForBoundingBoxRecursively113c(
      sm,
      m.u32((pPath + 0x1c) >>> 0),
      pBox,
      0x8000,
    )
  }
  PATH_SetPrecisionPosAndRecacheRoom113c(
    m,
    pPath,
    ((m.u32(pPath) & 0xffff0000) + 0x8000) >>> 0,
    ((m.u32((pPath + 0x04) >>> 0) & 0xffff0000) + 0x8000) >>> 0,
    0,
  )
}
