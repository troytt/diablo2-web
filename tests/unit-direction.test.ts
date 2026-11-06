/**
 * dir64 unit facing (`src/common/units/direction.ts`) against Diablo II 1.13c.
 *
 *  - `dir64FromPoints` ports D2Common.dll 0x6FD5CF40 (path direction from two points).
 *  - `dir64ToClipDirection` ports D2CMP.dll #10020 (dir64 → animation direction).
 *
 * The binary-parity block reads the 1.13c DLLs from `samples/d2` and is skipped without them.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  D2_TURN_TICK_MS,
  DIR64_COUNT,
  TURN_STEP_TABLE_113C,
  advanceUnitTurnByDtMs,
  advanceUnitTurnByTicks,
  assertDir64,
  computeTurnStepDir64,
  createUnitTurnState,
  dir64FromPoints,
  dir64ToClipDirection,
  setUnitTargetDirection,
  snapUnitTurnDirection,
  stepUnitTurnTick,
  targetUnitTurnTowardPoint,
} from '../src/common/units/direction.ts'

const D2COMMON_DLL = 'samples/d2/D2Common.dll'
const D2CMP_DLL = 'samples/d2/D2CMP.dll'
const hasDlls = existsSync(D2COMMON_DLL) && existsSync(D2CMP_DLL)

/** Every animation direction count D2CMP #10020 accepts. */
const CLIP_DIRECTION_COUNTS = [1, 2, 4, 8, 16, 32, 64] as const

/**
 * The 16 screen headings (0 = screen south, clockwise) as world angles: screen south is world
 * (+1, +1), i.e. 45°, and each screen step is 22.5° of world angle.
 */
function headingVector(k: number): readonly [number, number] {
  const radians = ((45 + k * 22.5) * Math.PI) / 180
  return [Math.cos(radians), Math.sin(radians)]
}

/** dir64 for the 16 screen headings, as the engine quantises them. */
const HEADING_DIR64 = [0, 4, 7, 11, 15, 20, 23, 27, 32, 36, 40, 43, 47, 52, 56, 59] as const

/** The world angle (atan2 degrees) an animation direction faces: dir64 0 is world 45°. */
function clipDegrees(direction: number, directions: number): number {
  return 45 + (direction * 360) / directions
}

function angularDistance(a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180)
}

function circularDir64Distance(a: number, b: number): number {
  const diff = (b - a) & 63
  return diff <= 32 ? diff : 64 - diff
}

/**
 * The largest shift of a path direction table boundary from the uniform 5.625° grid:
 * the table steps at tangent indices 13, 26, 39, 53, 68, 85 and 105, and
 * atan(26 / 127) − 11.25° ≈ 0.32° is the worst of them.
 */
const TABLE_BOUNDARY_SLACK_DEGREES = 0.5

/** Reads `count` little-endian int32 values at virtual address `va` of a PE32 image. */
function readPeInt32s(path: string, va: number, count: number): number[] {
  const bytes = readFileSync(path)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const peOffset = view.getUint32(0x3c, true)
  if (view.getUint32(peOffset, true) !== 0x00004550) throw new Error(`${path} is not a PE image`)
  const sectionCount = view.getUint16(peOffset + 6, true)
  const optionalHeaderSize = view.getUint16(peOffset + 20, true)
  const optionalHeader = peOffset + 24
  const imageBase = view.getUint32(optionalHeader + 28, true)
  const rva = va - imageBase
  for (let i = 0; i < sectionCount; i++) {
    const section = optionalHeader + optionalHeaderSize + i * 40
    const virtualSize = view.getUint32(section + 8, true)
    const virtualAddress = view.getUint32(section + 12, true)
    const rawSize = view.getUint32(section + 16, true)
    const rawOffset = view.getUint32(section + 20, true)
    const backed = Math.min(virtualSize, rawSize)
    if (rva >= virtualAddress && rva + count * 4 <= virtualAddress + backed) {
      const start = rawOffset + (rva - virtualAddress)
      return Array.from({ length: count }, (_, k) => view.getInt32(start + k * 4, true))
    }
  }
  throw new Error(`${path}: VA 0x${va.toString(16)} is not backed by file data`)
}

describe('dir64FromPoints (D2Common 1.13c 0x6FD5CF40)', () => {
  it('quantises the eight compass vectors to the engine dir64 values', () => {
    const compass: ReadonlyArray<readonly [string, number, number, number]> = [
      ['S', 1, 1, 0],
      ['SW', 0, 1, 7],
      ['W', -1, 1, 15],
      ['NW', -1, 0, 23],
      ['N', -1, -1, 32],
      ['NE', 0, -1, 40],
      ['E', 1, -1, 47],
      ['SE', 1, 0, 56],
    ]
    for (const [name, dx, dy, expected] of compass) {
      expect(dir64FromPoints(0, 0, dx, dy, 0), name).toBe(expected)
    }
  })

  it('quantises the 16 screen headings to the engine dir64 values', () => {
    const actual = Array.from({ length: 16 }, (_, k) => {
      const [dx, dy] = headingVector(k)
      return dir64FromPoints(0, 0, dx, dy, 0)
    })
    expect(actual).toEqual([...HEADING_DIR64])
  })

  it('depends only on the segment direction, not on its length or origin', () => {
    const origins: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [5000.5, 4999.25],
      [123, 65000],
    ]
    for (let dx = -12; dx <= 12; dx++) {
      for (let dy = -12; dy <= 12; dy++) {
        if (dx === 0 && dy === 0) continue
        const expected = dir64FromPoints(0, 0, dx, dy, 0)
        for (const scale of [2, 3, 17]) {
          for (const [ox, oy] of origins) {
            expect(dir64FromPoints(ox, oy, ox + scale * dx, oy + scale * dy, 63)).toBe(expected)
          }
        }
      }
    }
  })

  it('stays within one dir64 step of the true heading and reaches all 64 values', () => {
    const reached = new Set<number>()
    let worst = 0
    for (let dx = -40; dx <= 40; dx++) {
      for (let dy = -40; dy <= 40; dy++) {
        if (dx === 0 && dy === 0) continue
        const dir64 = dir64FromPoints(0, 0, dx, dy, 0)
        reached.add(dir64)
        const trueDegrees = (Math.atan2(dy, dx) * 180) / Math.PI
        worst = Math.max(worst, angularDistance(clipDegrees(dir64, DIR64_COUNT), trueDegrees))
      }
    }
    expect(reached.size).toBe(DIR64_COUNT)
    expect(worst).toBeLessThan(360 / DIR64_COUNT + TABLE_BOUNDARY_SLACK_DEGREES)
  })

  it('returns the fallback facing when the points coincide in 16.16 fixed point', () => {
    expect(dir64FromPoints(10, 20, 10, 20, 37)).toBe(37)
    expect(dir64FromPoints(10, 20, 10 + 1e-6, 20 - 1e-6, 5)).toBe(5)
    expect(dir64FromPoints(10, 20, 10 + 1 / 65536, 20, 5)).toBe(56)
  })

  it('throws on non-finite coordinates and invalid fallback facings', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => dir64FromPoints(bad, 0, 1, 1, 0)).toThrow(RangeError)
      expect(() => dir64FromPoints(0, bad, 1, 1, 0)).toThrow(RangeError)
      expect(() => dir64FromPoints(0, 0, bad, 1, 0)).toThrow(RangeError)
      expect(() => dir64FromPoints(0, 0, 1, bad, 0)).toThrow(RangeError)
    }
    for (const bad of [64, -1, 1.5, Number.NaN]) {
      expect(() => dir64FromPoints(0, 0, 1, 1, bad)).toThrow(RangeError)
      expect(() => assertDir64(bad, 'facing')).toThrow(RangeError)
    }
  })
})

describe('dir64ToClipDirection (D2CMP 1.13c #10020)', () => {
  it('draws screen heading k with direction k of a 16-direction clip and k / 2 of an 8-direction clip', () => {
    for (let k = 0; k < 16; k++) {
      expect(dir64ToClipDirection(HEADING_DIR64[k]!, 16), `heading ${k}`).toBe(k)
      if (k % 2 === 0) expect(dir64ToClipDirection(HEADING_DIR64[k]!, 8), `heading ${k}`).toBe(k / 2)
    }
  })

  it('keeps the drawn direction within half a clip sector of the true heading', () => {
    const worst = new Map<number, number>()
    for (let dx = -40; dx <= 40; dx++) {
      for (let dy = -40; dy <= 40; dy++) {
        if (dx === 0 && dy === 0) continue
        const dir64 = dir64FromPoints(0, 0, dx, dy, 0)
        const trueDegrees = (Math.atan2(dy, dx) * 180) / Math.PI
        for (const directions of [4, 8, 16]) {
          const drawn = clipDegrees(dir64ToClipDirection(dir64, directions), directions)
          const error = angularDistance(drawn, trueDegrees)
          worst.set(directions, Math.max(worst.get(directions) ?? 0, error))
        }
      }
    }
    for (const directions of [4, 8, 16]) {
      expect(worst.get(directions), `${directions} directions`).toBeLessThan(
        180 / directions + TABLE_BOUNDARY_SLACK_DEGREES,
      )
    }
  })

  it('maps 1- and 2-direction clips like the engine rows', () => {
    for (let dir64 = 0; dir64 < DIR64_COUNT; dir64++) {
      expect(dir64ToClipDirection(dir64, 1)).toBe(0)
      expect(dir64ToClipDirection(dir64, 2)).toBe(dir64 >= 16 && dir64 < 48 ? 1 : 0)
      expect(dir64ToClipDirection(dir64, 64)).toBe(dir64)
    }
  })

  it('throws for direction counts the engine does not support and for invalid facings', () => {
    for (const directions of [0, 3, 5, 12, 128, -8, 1.5, Number.NaN]) {
      expect(() => dir64ToClipDirection(0, directions)).toThrow(RangeError)
    }
    for (const dir64 of [64, -1, 1.5, Number.NaN]) {
      expect(() => dir64ToClipDirection(dir64, 16)).toThrow(RangeError)
    }
  })
})

describe('unit turn step table & 25Hz state machine (D2Common 1.13c 0x6FDE41C8, #10425, #10739, #10603)', () => {
  it('converges monotonically in at most 8 ticks (320ms) for all 64x64 (dir64, targetDir64) pairs', () => {
    expect(TURN_STEP_TABLE_113C.length).toBe(64)
    for (let startDir = 0; startDir < DIR64_COUNT; startDir++) {
      for (let targetDir = 0; targetDir < DIR64_COUNT; targetDir++) {
        const expectedStep = TURN_STEP_TABLE_113C[(targetDir - startDir) & 63]!
        expect(computeTurnStepDir64(startDir, targetDir)).toBe(expectedStep)

        const state = createUnitTurnState(startDir)
        setUnitTargetDirection(state, targetDir, false)
        expect(state.targetDir64).toBe(targetDir)
        expect(state.stepDir).toBe(expectedStep)

        if (startDir === targetDir) {
          expect(state.dir64).toBe(targetDir)
          expect(state.stepDir).toBe(0)
          expect(stepUnitTurnTick(state)).toBe(targetDir)
          continue
        }

        // Mid-turn starts keep dir64 at startDir until the first 25Hz tick
        expect(state.dir64).toBe(startDir)

        let prevDist = circularDir64Distance(state.dir64, targetDir)
        let ticks = 0
        while (state.dir64 !== targetDir && ticks < 16) {
          // Repeatedly calling setUnitTargetDirection with the same targetDir64 mid-turn
          // must preserve stepDir without resetting turn velocity (#10739)
          const savedStepDir = state.stepDir
          setUnitTargetDirection(state, targetDir, false)
          expect(state.stepDir).toBe(savedStepDir)

          stepUnitTurnTick(state)
          ticks++
          const nextDist = circularDir64Distance(state.dir64, targetDir)
          expect(nextDist).toBeLessThan(prevDist)
          prevDist = nextDist
        }

        expect(state.dir64, `pair (${startDir} -> ${targetDir})`).toBe(targetDir)
        expect(state.stepDir, `pair (${startDir} -> ${targetDir})`).toBe(0)
        expect(ticks, `pair (${startDir} -> ${targetDir})`).toBeGreaterThanOrEqual(1)
        expect(ticks, `pair (${startDir} -> ${targetDir})`).toBeLessThanOrEqual(8)

        // Subsequent ticks once converged are no-ops
        expect(stepUnitTurnTick(state)).toBe(targetDir)
        expect(state.stepDir).toBe(0)
      }
    }
  })

  it('steps diff = 32 by -8 (0 -> 56 -> 48 -> 40 -> 32 in 4 ticks) and clamps non-multiple diffs cleanly (0 -> 8 -> 16 -> 20 in 3 ticks)', () => {
    const opposite = createUnitTurnState(0)
    setUnitTargetDirection(opposite, 32, false)
    expect(opposite.stepDir).toBe(-8)
    const oppositeSteps = [
      opposite.dir64,
      stepUnitTurnTick(opposite),
      stepUnitTurnTick(opposite),
      stepUnitTurnTick(opposite),
      stepUnitTurnTick(opposite),
    ]
    expect(oppositeSteps).toEqual([0, 56, 48, 40, 32])
    expect(opposite.stepDir).toBe(0)

    const nonMultiplePos = createUnitTurnState(0)
    setUnitTargetDirection(nonMultiplePos, 20, false)
    expect(nonMultiplePos.stepDir).toBe(8)
    const posSteps = [
      nonMultiplePos.dir64,
      stepUnitTurnTick(nonMultiplePos),
      stepUnitTurnTick(nonMultiplePos),
      stepUnitTurnTick(nonMultiplePos),
    ]
    expect(posSteps).toEqual([0, 8, 16, 20])
    expect(nonMultiplePos.stepDir).toBe(0)

    const nonMultipleNeg = createUnitTurnState(20)
    setUnitTargetDirection(nonMultipleNeg, 0, false)
    expect(nonMultipleNeg.stepDir).toBe(-8)
    const negSteps = [
      nonMultipleNeg.dir64,
      stepUnitTurnTick(nonMultipleNeg),
      stepUnitTurnTick(nonMultipleNeg),
      stepUnitTurnTick(nonMultipleNeg),
    ]
    expect(negSteps).toEqual([20, 12, 4, 0])
    expect(nonMultipleNeg.stepDir).toBe(0)
  })

  it('snaps immediately in 0 ticks when bInstant = 1 (snapUnitTurnDirection / setUnitTargetDirection(..., true))', () => {
    for (let startDir = 0; startDir < DIR64_COUNT; startDir += 7) {
      for (let targetDir = 0; targetDir < DIR64_COUNT; targetDir += 5) {
        const s1 = createUnitTurnState(startDir)
        setUnitTargetDirection(s1, (startDir + 16) & 63, false)
        snapUnitTurnDirection(s1, targetDir)
        expect(s1).toEqual({
          dir64: targetDir,
          targetDir64: targetDir,
          stepDir: 0,
          turnTickRemainderMs: 0,
        })

        const s2 = createUnitTurnState(startDir)
        setUnitTargetDirection(s2, targetDir, true)
        expect(s2).toEqual({
          dir64: targetDir,
          targetDir64: targetDir,
          stepDir: 0,
          turnTickRemainderMs: 0,
        })
      }
    }
  })

  it('accumulates sub-tick dtMs and steps once per 40ms (25Hz) in advanceUnitTurnByDtMs', () => {
    const state = createUnitTurnState(0)
    // Target opposite direction (32 = North): TURN_STEP_TABLE_113C[32] = -8, requires 4 ticks = 160ms
    setUnitTargetDirection(state, 32, false)
    expect(state.stepDir).toBe(-8)

    // 16ms + 16ms = 32ms (< 40ms): 0 ticks elapsed, dir64 still 0
    expect(advanceUnitTurnByDtMs(state, 16)).toBe(0)
    expect(advanceUnitTurnByDtMs(state, 16)).toBe(0)
    expect(state.turnTickRemainderMs).toBe(32)

    // +16ms = 48ms: 1 tick elapsed (dir64 = (0 - 8) & 63 = 56), remainder = 8ms
    expect(advanceUnitTurnByDtMs(state, 16)).toBe(56)
    expect(state.turnTickRemainderMs).toBe(8)

    // +112ms + 8ms remainder = 120ms = 3 ticks: reaches targetDir64 = 32 (56 -> 48 -> 40 -> 32)
    expect(advanceUnitTurnByDtMs(state, 3 * D2_TURN_TICK_MS - 8)).toBe(32)
    expect(state.dir64).toBe(32)
    expect(state.stepDir).toBe(0)

    // Cancelling a turn mid-subtick by retargeting back to state.dir64 clears turnTickRemainderMs
    setUnitTargetDirection(state, 0, false)
    expect(advanceUnitTurnByDtMs(state, 25)).toBe(32)
    expect(state.turnTickRemainderMs).toBe(25)
    setUnitTargetDirection(state, 32, false)
    expect(state.turnTickRemainderMs).toBe(0)
    setUnitTargetDirection(state, 48, false)
    expect(advanceUnitTurnByDtMs(state, 20)).toBe(32)
  })

  it('fails fast with RangeError on invalid directions, ticks, or dtMs', () => {
    for (const bad of [-1, 64, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createUnitTurnState(bad)).toThrow(RangeError)
      expect(() => computeTurnStepDir64(bad, 0)).toThrow(RangeError)
      expect(() => computeTurnStepDir64(0, bad)).toThrow(RangeError)
      const s = createUnitTurnState(0)
      expect(() => setUnitTargetDirection(s, bad)).toThrow(RangeError)
      expect(() => snapUnitTurnDirection(s, bad)).toThrow(RangeError)
      expect(() => stepUnitTurnTick({ dir64: bad, targetDir64: 0, stepDir: 0, turnTickRemainderMs: 0 })).toThrow(
        RangeError,
      )
      expect(() => stepUnitTurnTick({ dir64: 0, targetDir64: bad, stepDir: 0, turnTickRemainderMs: 0 })).toThrow(
        RangeError,
      )
    }
    for (const badStep of [2, 3, 5, 99, -2, -3, 1.5, Number.NaN]) {
      expect(() => stepUnitTurnTick({ dir64: 0, targetDir64: 16, stepDir: badStep, turnTickRemainderMs: 0 })).toThrow(
        RangeError,
      )
      const badState = createUnitTurnState(0)
      badState.stepDir = badStep
      expect(() => setUnitTargetDirection(badState, 16)).toThrow(RangeError)
    }

    for (const badRem of [-1, -0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => stepUnitTurnTick({ dir64: 0, targetDir64: 16, stepDir: 4, turnTickRemainderMs: badRem })).toThrow(
        RangeError,
      )
      expect(() => advanceUnitTurnByTicks({ dir64: 0, targetDir64: 16, stepDir: 4, turnTickRemainderMs: badRem }, 1)).toThrow(
        RangeError,
      )
    }

    const s = createUnitTurnState(0)
    for (const badDt of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => advanceUnitTurnByDtMs(s, badDt)).toThrow(RangeError)
      expect(() => targetUnitTurnTowardPoint(s, badDt, 0, 1, 1)).toThrow(RangeError)
    }
    for (const badTicks of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => advanceUnitTurnByTicks(s, badTicks)).toThrow(RangeError)
    }
  })
})

describe.skipIf(!hasDlls)('binary parity with the 1.13c DLLs (samples/d2)', () => {
  it('follows the angle column of the D2Common path direction table at 0x6FDDD470', () => {
    // 128 entries of { int32 x, int32 y, int32 angle }, indexed by trunc(127 · minor / major).
    const table = readPeInt32s(D2COMMON_DLL, 0x6fddd470, 128 * 3)
    for (let index = 0; index < 128; index++) {
      const angle = table[index * 3 + 2]!
      // Vector (index, 127) reads entry `index`; |dx| <= |dy| and start <= target on both axes,
      // so the routine returns (7 − angle). Its mirror (127, index) swaps the axes: 56 + angle.
      expect(dir64FromPoints(0, 0, index, 127, 0), `entry ${index}`).toBe(7 - angle)
      if (index < 127) expect(dir64FromPoints(0, 0, 127, index, 0), `entry ${index}`).toBe(56 + angle)
    }
  })

  it('equals the D2Common 64-entry (256-byte) turn step table at VA 0x6FDE41C8 (file offset 0x925C8 / .rdata 0x941C8)', () => {
    const dllTable = readPeInt32s(D2COMMON_DLL, 0x6fde41c8, DIR64_COUNT)
    expect(dllTable.length * 4).toBe(256)
    expect([...TURN_STEP_TABLE_113C]).toEqual(dllTable)
  })

  it('equals the D2CMP direction rows at 0x6FE2F4D8 + (bsf(directions) + 1) · 256', () => {
    for (const directions of CLIP_DIRECTION_COUNTS) {
      const row = readPeInt32s(D2CMP_DLL, 0x6fe2f4d8 + (Math.log2(directions) + 1) * 256, DIR64_COUNT)
      const ported = Array.from({ length: DIR64_COUNT }, (_, dir64) =>
        dir64ToClipDirection(dir64, directions),
      )
      expect(ported, `${directions} directions`).toEqual(row)
    }
  })
})

const ASSET_DIRS = ['public/entities'] as const
const hasBakedArt = ASSET_DIRS.every(dir => existsSync(dir))

describe.skipIf(!hasBakedArt)('baked unit art direction counts', () => {
  it('only uses direction counts dir64ToClipDirection supports', () => {
    const supported = new Set<number>(CLIP_DIRECTION_COUNTS)
    const unsupported: string[] = []
    let checked = 0
    const visit = (value: unknown, file: string): void => {
      if (Array.isArray(value)) {
        for (const item of value) visit(item, file)
        return
      }
      if (value === null || typeof value !== 'object') return
      for (const [key, child] of Object.entries(value)) {
        if (key === 'directions' && typeof child === 'number') {
          checked++
          if (!supported.has(child)) unsupported.push(`${file}: directions ${String(child)}`)
        } else {
          visit(child, file)
        }
      }
    }
    for (const dir of ASSET_DIRS) {
      for (const name of readdirSync(dir)) {
        if (!name.endsWith('.json')) continue
        visit(JSON.parse(readFileSync(`${dir}/${name}`, 'utf8')) as unknown, `${dir}/${name}`)
      }
    }
    expect(checked).toBeGreaterThan(0)
    expect(unsupported).toEqual([])
  })
})
