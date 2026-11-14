import { describe, expect, test } from "vitest"
import { D2Rng, UnitSeed, D2_PRNG_MULTIPLIER } from "../src/common/rng/d2-rng.ts"

describe("1.13c Diablo II PRNG and Per-Unit Seed (D2Common!6FD510B0 / D2Game!6FC211D0)", () => {
  describe("64-bit LCG state recurrence and known seed vectors", () => {
    test("has the canonical 1.13c multiplier 0x6AC690C5 (1791398085)", () => {
      expect(D2_PRNG_MULTIPLIER).toBe(0x6ac690c5n)
      expect(Number(D2_PRNG_MULTIPLIER)).toBe(1791398085)
    })

    test("reproduces exact bitwise sequence for known vector lo = 1, hi = 0 across 10 steps", () => {
      const rng = new D2Rng({ lo: 1, hi: 0 })
      expect(rng.lo).toBe(1)
      expect(rng.hi).toBe(0)

      const expectedSteps = [
        { lo: 1791398085, hi: 0 },
        { lo: 1721382809, hi: 747178471 },
        { lo: 986833572, hi: 717975634 },
        { lo: 2963478662, hi: 411600752 },
        { lo: 930727566, hi: 1236044336 },
        { lo: 3622188406, hi: 388199365 },
        { lo: 4003526547, hi: 1510787143 },
        { lo: 3772775526, hi: 1669840372 },
        { lo: 3770833010, hi: 1573595882 },
        { lo: 1095064228, hi: 1572785674 },
      ]

      for (let i = 0; i < expectedSteps.length; i++) {
        rng.step()
        expect(rng.getSeed()).toEqual(expectedSteps[i])
      }

      // Re-running with a new instance yields exact same bitwise reproducibility
      const freshRng = new D2Rng(1, 0)
      for (let i = 0; i < expectedSteps.length; i++) {
        freshRng.step()
        expect(freshRng.lo).toBe(expectedSteps[i].lo)
        expect(freshRng.hi).toBe(expectedSteps[i].hi)
      }
    })

    test("matches 1.13c SEED_InitLowSeed / rollD2Random vector lo = 100, hi = 666", () => {
      const rng = new D2Rng({ lo: 100, hi: 666 })
      // 666 + 0x6AC690C5 * 100 = 179139809166
      // low 32 bits = 3046150030
      // high 32 bits = 41
      rng.step()
      expect(rng.lo).toBe(3046150030)
      expect(rng.hi).toBe(41)
    })
  })

  describe("Random generation rand(max)", () => {
    test("power-of-2 branch uses bitwise AND: (lo & (max - 1)) >>> 0", () => {
      const rng = new D2Rng(42, 0)

      // Test power of 2: 1024 (1024 & 1023 === 0)
      const roll = rng.rand(1024)
      const expected = (rng.lo & 1023) >>> 0
      expect(roll).toBe(expected)
      expect(roll).toBeGreaterThanOrEqual(0)
      expect(roll).toBeLessThan(1024)

      // Test power of 2: 16 (16 & 15 === 0)
      const roll16 = rng.rand(16)
      expect(roll16).toBe((rng.lo & 15) >>> 0)
      expect(roll16).toBeGreaterThanOrEqual(0)
      expect(roll16).toBeLessThan(16)

      // Test power of 2: 2 (2 & 1 === 0)
      const roll2 = rng.rand(2)
      expect(roll2).toBe((rng.lo & 1) >>> 0)
      expect(roll2 === 0 || roll2 === 1).toBe(true)

      // Test power of 2: 1 (1 & 0 === 0)
      const roll1 = rng.rand(1)
      expect(roll1).toBe(0)
    })

    test("non-power-of-2 branch uses modulo: (lo % max) >>> 0", () => {
      const rng = new D2Rng(42, 0)

      // Test non-power of 2: 1000 (1000 & 999 !== 0)
      const roll = rng.rand(1000)
      const expected = (rng.lo % 1000) >>> 0
      expect(roll).toBe(expected)
      expect(roll).toBeGreaterThanOrEqual(0)
      expect(roll).toBeLessThan(1000)

      // Test non-power of 2: 100
      const roll100 = rng.rand(100)
      expect(roll100).toBe((rng.lo % 100) >>> 0)
      expect(roll100).toBeGreaterThanOrEqual(0)
      expect(roll100).toBeLessThan(100)

      // Test non-power of 2: 7
      const roll7 = rng.rand(7)
      expect(roll7).toBe((rng.lo % 7) >>> 0)
      expect(roll7).toBeGreaterThanOrEqual(0)
      expect(roll7).toBeLessThan(7)
    })

    test("returns 0 and does not advance state when max <= 0", () => {
      const rng = new D2Rng(999, 123)
      const initialSeed = rng.getSeed()

      expect(rng.rand(0)).toBe(0)
      expect(rng.getSeed()).toEqual(initialSeed)

      expect(rng.rand(-1)).toBe(0)
      expect(rng.getSeed()).toEqual(initialSeed)

      expect(rng.rand(-100)).toBe(0)
      expect(rng.getSeed()).toEqual(initialSeed)
    })
  })

  describe("Range generation randRange(min, max)", () => {
    test("returns min without advancing state when min >= max", () => {
      const rng = new D2Rng(500, 100)
      const initialSeed = rng.getSeed()

      // min > max
      expect(rng.randRange(10, 5)).toBe(10)
      expect(rng.getSeed()).toEqual(initialSeed)

      // min === max
      expect(rng.randRange(7, 7)).toBe(7)
      expect(rng.getSeed()).toEqual(initialSeed)
    })

    test("generates values within [min, max] when min < max", () => {
      const rng = new D2Rng(12345, 678)

      for (let i = 0; i < 50; i++) {
        const loBefore = rng.lo
        const val = rng.randRange(1, 10)
        // State must have advanced
        expect(rng.lo).not.toBe(loBefore)
        // Range check
        expect(val).toBeGreaterThanOrEqual(1)
        expect(val).toBeLessThanOrEqual(10)
        // Check formula: span = 10, min + (lo % span)
        expect(val).toBe(1 + ((rng.lo % 10) >>> 0))
      }
    })

    test("handles negative ranges correctly", () => {
      const rng = new D2Rng(1, 0)
      for (let i = 0; i < 30; i++) {
        const val = rng.randRange(-10, -5)
        expect(val).toBeGreaterThanOrEqual(-10)
        expect(val).toBeLessThanOrEqual(-5)
        const span = -5 - (-10) + 1 // 6
        expect(val).toBe(-10 + ((rng.lo % span) >>> 0))
      }
    })

    test("simulates standard 6-sided dice roll randRange(1, 6)", () => {
      const rng = new D2Rng(888)
      const rolled = new Set<number>()

      for (let i = 0; i < 100; i++) {
        const roll = rng.randRange(1, 6)
        expect(roll).toBeGreaterThanOrEqual(1)
        expect(roll).toBeLessThanOrEqual(6)
        rolled.add(roll)
      }

      // Over 100 rolls, all sides 1-6 should appear
      for (let side = 1; side <= 6; side++) {
        expect(rolled.has(side)).toBe(true)
      }
    })
  })

  describe("Per-unit seed independence (UnitSeed)", () => {
    test("UnitSeed alias points to D2Rng", () => {
      expect(UnitSeed).toBe(D2Rng)
      const unit = new UnitSeed(123)
      expect(unit instanceof D2Rng).toBe(true)
    })

    test("separate unit seeds do not affect each other", () => {
      const unitA = new D2Rng(100, 0)
      const unitB = new D2Rng(200, 0)

      const initialB = unitB.getSeed()

      // Advance unitA 25 times
      for (let i = 0; i < 25; i++) {
        unitA.rand(100)
      }

      // unitB must remain completely untouched
      expect(unitB.getSeed()).toEqual(initialB)

      // Advance unitB once
      const valB1 = unitB.rand(100)

      // Now create a fresh unit with initialB seed
      const unitBClone = new D2Rng(200, 0)
      const expectedValB1 = unitBClone.rand(100)

      expect(valB1).toBe(expectedValB1)
      expect(unitB.getSeed()).toEqual(unitBClone.getSeed())
    })

    test("interleaved execution between units produces identical results to sequential execution", () => {
      // Sequential run
      const unit1Seq = new D2Rng(111, 222)
      const unit2Seq = new D2Rng(333, 444)

      const seq1Rolls = Array.from({ length: 10 }, () => unit1Seq.rand(50))
      const seq2Rolls = Array.from({ length: 10 }, () => unit2Seq.rand(50))

      // Interleaved run
      const unit1Interleaved = new D2Rng(111, 222)
      const unit2Interleaved = new D2Rng(333, 444)

      const inter1Rolls: number[] = []
      const inter2Rolls: number[] = []

      for (let i = 0; i < 10; i++) {
        inter1Rolls.push(unit1Interleaved.rand(50))
        inter2Rolls.push(unit2Interleaved.rand(50))
      }

      expect(inter1Rolls).toEqual(seq1Rolls)
      expect(inter2Rolls).toEqual(seq2Rolls)
      expect(unit1Interleaved.getSeed()).toEqual(unit1Seq.getSeed())
      expect(unit2Interleaved.getSeed()).toEqual(unit2Seq.getSeed())
    })
  })

  describe("Instance lifecycle, clone, and state mutation", () => {
    test("constructor accepts undefined, number, or { lo, hi }", () => {
      const empty = new D2Rng()
      expect(empty.getSeed()).toEqual({ lo: 0, hi: 0 })

      const fromNum = new D2Rng(12345)
      expect(fromNum.getSeed()).toEqual({ lo: 12345, hi: 0 })

      const fromNumAndHi = new D2Rng(12345, 678)
      expect(fromNumAndHi.getSeed()).toEqual({ lo: 12345, hi: 678 })

      const fromObj = new D2Rng({ lo: 555, hi: 999 })
      expect(fromObj.getSeed()).toEqual({ lo: 555, hi: 999 })
    })

    test("setSeed masks values to unsigned 32-bit integers", () => {
      const rng = new D2Rng()
      rng.setSeed(-1, -1)
      expect(rng.lo).toBe(0xffffffff)
      expect(rng.hi).toBe(0xffffffff)
      expect(rng.getSeed()).toEqual({ lo: 4294967295, hi: 4294967295 })
    })

    test("clone() creates an exact, independent copy", () => {
      const original = new D2Rng(777, 888)
      original.step()

      const cloned = original.clone()
      expect(cloned.getSeed()).toEqual(original.getSeed())

      // Stepping cloned does not affect original
      const clonedSeedBefore = cloned.getSeed()
      original.step()
      expect(cloned.getSeed()).toEqual(clonedSeedBefore)
      expect(original.getSeed()).not.toEqual(cloned.getSeed())

      // Next roll from clone produces expected value
      const cloneRoll = cloned.rand(100)
      const expectedOriginalClone = new D2Rng(clonedSeedBefore)
      expect(cloneRoll).toBe(expectedOriginalClone.rand(100))
    })

    test("getSeed() returns a new object preventing external mutation of internal state", () => {
      const rng = new D2Rng(100, 200)
      const seed = rng.getSeed()
      seed.lo = 9999
      seed.hi = 9999
      expect(rng.lo).toBe(100)
      expect(rng.hi).toBe(200)
    })

    test("nextUint32() advances state and returns low 32-bit register, while next() returns float in [0, 1)", () => {
      const rng = new D2Rng(1, 0)
      const val = rng.nextUint32()
      expect(val).toBe(1791398085)
      expect(rng.lo).toBe(1791398085)
      expect(rng.hi).toBe(0)

      const rngFloat = new D2Rng(1, 0)
      const f = rngFloat.next()
      expect(f).toBe(1791398085 / 4294967296)
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(1)
    })

    test("convenience methods (seed, low, high, int, range, pick, chance, fork) work deterministically", () => {
      const rng = new D2Rng(0x1234, 0x5678)
      expect(rng.seed).toBe(0x1234)
      expect(rng.low).toBe(0x1234)
      expect(rng.high).toBe(0x5678)

      for (let i = 0; i < 20; i++) {
        const v = rng.int(5, 10)
        expect(v).toBeGreaterThanOrEqual(5)
        expect(v).toBeLessThanOrEqual(10)
      }
      const loBeforeDegenerate = rng.lo
      const hiBeforeDegenerate = rng.hi
      expect(rng.int(7, 7)).toBe(7)
      expect(rng.lo).toBe(loBeforeDegenerate)
      expect(rng.hi).toBe(hiBeforeDegenerate)
      expect(rng.int(10, 5)).toBe(10)
      expect(rng.lo).toBe(loBeforeDegenerate)
      expect(rng.hi).toBe(hiBeforeDegenerate)

      const r = rng.range(10, 20)
      expect(r).toBeGreaterThanOrEqual(10)
      expect(r).toBeLessThan(20)

      expect(rng.pick([])).toBeUndefined()
      expect(["a", "b", "c"]).toContain(rng.pick(["a", "b", "c"]))

      expect(rng.chance(0)).toBe(false)
      expect(rng.chance(1)).toBe(true)

      const f1 = rng.fork("stream-a")
      const f2 = rng.fork("stream-a")
      const f3 = rng.fork("stream-b")
      expect(f1.getSeed()).toEqual(f2.getSeed())
      expect(f1.getSeed()).not.toEqual(f3.getSeed())
    })
  })
})
