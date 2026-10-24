/**
 * 1.13c Diablo II Linear Congruential Generator (LCG) PRNG and Per-Unit Seed.
 *
 * Gold standard references:
 * - D2Common!6FD510B0 (SEED_RollRandomNumber / SEED_RollLimitedRandomNumber)
 * - D2Common!6FD51180 (SEED_InitLowSeed / SEED_InitSeed)
 * - D2Game!6FC211D0 (Unit seed operations / UNITS_RollRandom)
 *
 * In Diablo II 1.13c, PRNG state is maintained as a 64-bit value split into
 * two 32-bit registers (nLowSeed and nHighSeed). The recurrence relation is:
 *   state64 = (uint64_t)nLowSeed * 0x6AC690C5 + nHighSeed
 *   nLowSeed = (uint32_t)state64
 *   nHighSeed = (uint32_t)(state64 >> 32)
 *
 * Each unit (monsters, players, items, missiles) encapsulates its own seed state,
 * preventing cross-entity RNG stream contamination and ensuring lockstep determinism.
 */

/** Canonical 64-bit LCG multiplier in Diablo II 1.13c (0x6AC690C5 = 1791398085). */
export const D2_PRNG_MULTIPLIER = 0x6ac690c5n

/** Seed state representing the low and high 32-bit registers. */
export interface D2SeedState {
  lo: number
  hi: number
}

/**
 * 1.13c Diablo II PRNG implementation with per-unit seed encapsulation.
 */
export class D2Rng {
  private _lo = 0
  private _hi = 0

  /**
   * Initializes a new PRNG instance.
   *
   * @param seed - Optional initial 32-bit low seed or { lo, hi } state object.
   * @param hi - Optional initial 32-bit high seed (defaults to 0 if not provided).
   */
  constructor(seed?: number | D2SeedState, hi?: number) {
    if (seed !== undefined) {
      if (typeof seed === 'number') {
        this.setSeed(seed, (seed >>> 0) === 0 && hi === undefined ? 666 : hi)
      } else {
        this.setSeed(seed.lo, seed.hi ?? hi)
      }
    }
  }

  /** Current 32-bit low seed register. */
  get lo(): number {
    return this._lo
  }

  /** Current 32-bit high seed register. */
  get hi(): number {
    return this._hi
  }

  /** Current 32-bit low seed register (Rng alias). */
  get seed(): number {
    return this._lo >>> 0
  }

  /** Current 32-bit low seed register. */
  get low(): number {
    return this._lo >>> 0
  }

  /** Current 32-bit high seed register. */
  get high(): number {
    return this._hi >>> 0
  }

  /**
   * Updates the seed state registers.
   *
   * @param lo - Low 32-bit seed value.
   * @param hi - High 32-bit seed value (defaults to 0).
   */
  setSeed(lo: number, hi?: number): void {
    this._lo = lo >>> 0
    this._hi = (hi ?? 0) >>> 0
  }

  /**
   * Returns the current seed state as a { lo, hi } pair.
   */
  getSeed(): D2SeedState {
    return { lo: this._lo, hi: this._hi }
  }

  /**
   * Advances the 64-bit LCG state by one step:
   *   state64 = BigInt(lo) * 0x6AC690C5n + BigInt(hi)
   *   lo = Number(state64 & 0xFFFFFFFFn) >>> 0
   *   hi = Number((state64 >> 32n) & 0xFFFFFFFFn) >>> 0
   */
  step(): number {
    const state64 = BigInt(this._lo) * D2_PRNG_MULTIPLIER + BigInt(this._hi)
    this._lo = Number(state64 & 0xffffffffn) >>> 0
    this._hi = Number((state64 >> 32n) & 0xffffffffn) >>> 0
    return this._lo
  }

  /**
   * Rolls a pseudo-random integer in `[0, max - 1]`.
   *
   * If max <= 0, returns 0 without advancing state.
   * Otherwise advances state (`step()`).
   * If max is a power of 2 (i.e. `(max & (max - 1)) === 0`):
   *   returns `(lo & (max - 1)) >>> 0`
   * Else:
   *   returns `(lo % max) >>> 0`
   *
   * @param max - Exclusive upper bound.
   * @returns Generated random integer in `[0, max - 1]`, or 0 if max <= 0.
   */
  rand(max: number): number {
    if (max <= 0) {
      return 0
    }
    this.step()
    if ((max & (max - 1)) === 0) {
      return (this._lo & (max - 1)) >>> 0
    }
    return (this._lo % max) >>> 0
  }

  /**
   * Rolls a pseudo-random integer in inclusive range `[min, max]`.
   *
   * If min >= max, returns min without advancing state.
   * Otherwise span = max - min + 1, advances state (`step()`),
   * and returns `min + ((lo % span) >>> 0)`.
   *
   * @param min - Lower bound (inclusive).
   * @param max - Upper bound (inclusive).
   * @returns Random integer in [min, max].
   */
  randRange(min: number, max: number): number {
    if (min >= max) {
      return min
    }
    const span = max - min + 1
    this.step()
    return min + ((this._lo % span) >>> 0)
  }

  /**
   * Creates an independent copy of this PRNG instance preserving the exact current seed state.
   */
  clone(): D2Rng {
    const copy = new D2Rng()
    copy.setSeed(this._lo, this._hi)
    return copy
  }

  /**
   * Advances state and returns the updated 32-bit low seed value (matching SEED_RollRandomNumber).
   */
  nextUint32(): number {
    this.step()
    return this._lo
  }

  /**
   * Advances state and returns a floating-point value in `[0, 1)`.
   */
  next(): number {
    return this.nextUint32() / 4294967296
  }

  /**
   * Draw an integer in an inclusive range `[min, max]`.
   */
  int(min: number, max: number): number {
    if (max <= min) return Math.floor(min)
    const lo = Math.ceil(min)
    const hi = Math.floor(max)
    const span = hi - lo + 1
    if (span <= 0) return lo
    return lo + this.rand(span)
  }

  /**
   * Draw a floating-point value in `[min, max)`.
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /**
   * Draw one element uniformly from `items`, or `undefined` when empty.
   */
  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined
    return items[this.int(0, items.length - 1)]
  }

  /**
   * Decide a yes/no with a probability in `[0, 1]`.
   */
  chance(probability: number): boolean {
    if (probability <= 0) return false
    if (probability >= 1) return true
    return this.next() < probability
  }

  /**
   * Derive an independent stream from a stable label.
   */
  fork(label = ''): D2Rng {
    const hash = hashString32(label)
    return new D2Rng((hash ^ this._lo) >>> 0, (Math.imul(hash, 0x9e3779b9) ^ this._hi) >>> 0)
  }
}

/**
 * A stable 32-bit FNV-1a hash of a string, for seeding streams from names.
 */
export function hashString32(text: string): number {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}

/** Alias for D2Rng to represent per-unit seed instances and unified Rng. */
export const UnitSeed = D2Rng
export type UnitSeed = D2Rng
export { D2Rng as Rng }

// ---------------------------------------------------------------------------
// D2Common D2SeedStrc API (D2MOO source/D2Common/include/D2Seed.h, commit 5596f5c).
//
// This is the API the DRLG port (src/game/drlg/) uses. It mirrors D2MOO line by line:
//   SEED_RollRandomNumber:        lSeed = nHighSeed + 0x6AC690C5 * nLowSeed (64-bit), stored back
//   SEED_RollLimitedRandomNumber: nMax <= 0 -> 0 without rolling; non power of two ->
//                                 (uint32)roll % nMax; power of two -> roll & (nMax - 1)
//   SEED_RollPercentage:          roll % 100 over the FULL 64-bit state
//   SEED_InitLowSeed:             low = n, high = 666
// The 64-bit product is computed exactly with 16-bit limbs (no BigInt).
// ---------------------------------------------------------------------------

/** D2SeedStrc: two uint32 registers. `label` is assigned by an active trace sink only. */
export interface D2SeedStrc {
  lo: number
  hi: number
  label?: string
}

/** Receives every seed initialisation and roll, in call order (see tools/d2moo-oracle/README.md). */
export interface D2SeedTraceSink {
  /** SEED_InitLowSeed / SEED_InitSeed ('I') and SEED_SetSeeds ('S'). */
  init(seed: D2SeedStrc, kind: 'I' | 'S'): void
  /** SEED_RollRandomNumber ('R', arg 0), SEED_RollLimitedRandomNumber ('L'), SEED_RollPercentage ('P'). */
  roll(seed: D2SeedStrc, kind: 'R' | 'L' | 'P', arg: number, result: number): void
  /** D2CMP_10088_GetTiles ('T'). */
  tile?(nType: number, nStyle: number, nSequence: number, n: number, nRaritySum: number): void
}

let seedTraceSink: D2SeedTraceSink | null = null

/** Installs (or removes, with null) the global seed trace sink. */
export function setD2SeedTraceSink(sink: D2SeedTraceSink | null): void {
  seedTraceSink = sink
}

/** Returns the currently active seed trace sink, if any. */
export function getD2SeedTraceSink(): D2SeedTraceSink | null {
  return seedTraceSink
}

export function newD2Seed(): D2SeedStrc {
  return { lo: 0, hi: 0 }
}

const TWO_POW_32 = 4294967296

/** lSeed = nHighSeed + 0x6AC690C5 * nLowSeed evaluated exactly in 64 bits, stored back. */
function advanceD2Seed(seed: D2SeedStrc): void {
  const lo = seed.lo
  const a0 = lo & 0xffff
  const a1 = lo >>> 16
  const t0 = 0x90c5 * a0 // < 2^32
  const t1 = 0x6ac6 * a0 + 0x90c5 * a1 // < 2^33
  const t2 = 0x6ac6 * a1 // < 2^31
  const low = t0 + (t1 % 65536) * 65536 + seed.hi // < 3 * 2^32, exact in a double
  seed.lo = low % TWO_POW_32
  // The product is < 2^63, so the high word cannot wrap.
  seed.hi = t2 + Math.floor(t1 / 65536) + Math.floor(low / TWO_POW_32)
}

/**
 * The LCG step some D2MOO functions inline (`pSeed.lSeed = nHighSeed + 1791398085i64 * nLowSeed`)
 * instead of calling SEED_RollRandomNumber, e.g. sub_6FD823C0. Not reported to the trace sink,
 * exactly like the native oracle.
 */
export function D2SEED_AdvanceInline(seed: D2SeedStrc): void {
  advanceD2Seed(seed)
}

//D2Common.0x6FDAEAB0 (#10912)
export function SEED_InitSeed(seed: D2SeedStrc): void {
  seed.lo = 1
  seed.hi = 666
  if (seedTraceSink) seedTraceSink.init(seed, 'I')
}

//D2Common.0x6FDAEAC0 (#10913)
export function SEED_InitLowSeed(seed: D2SeedStrc, nLowSeed: number): void {
  seed.lo = nLowSeed >>> 0
  seed.hi = 666
  if (seedTraceSink) seedTraceSink.init(seed, 'I')
}

//D2Common.0x6FDAEAE0 (#10921)
export function SEED_SetSeeds(seed: D2SeedStrc, nLowSeed: number, nHighSeed: number): void {
  seed.lo = nLowSeed >>> 0
  seed.hi = nHighSeed >>> 0
  if (seedTraceSink) seedTraceSink.init(seed, 'S')
}

/**
 * D2Common.0x6FD78E30 SEED_RollRandomNumber. Returns the low 32 bits of the new state as an
 * unsigned number; callers that use the full 64-bit value read `seed.hi` or use
 * {@link SEED_RollRandomNumberMod64}.
 */
export function SEED_RollRandomNumber(seed: D2SeedStrc): number {
  advanceD2Seed(seed)
  if (seedTraceSink) seedTraceSink.roll(seed, 'R', 0, seed.lo)
  return seed.lo
}

/**
 * `SEED_RollRandomNumber(pSeed) % n` where the C++ operand is the uncast uint64 state
 * (D2MOO does this in a few places, e.g. SEED_RollPercentage). One traced 'R' roll.
 */
export function SEED_RollRandomNumberMod64(seed: D2SeedStrc, n: number): number {
  if (!Number.isInteger(n) || n <= 0 || n > 0x3ffffff) {
    throw new RangeError(`SEED_RollRandomNumberMod64: modulus ${n} outside 1..2^26-1`)
  }
  advanceD2Seed(seed)
  if (seedTraceSink) seedTraceSink.roll(seed, 'R', 0, seed.lo)
  return ((seed.hi % n) * (TWO_POW_32 % n) + (seed.lo % n)) % n
}

//D2Common.0x6FD7D3E0 SEED_RollLimitedRandomNumber
export function SEED_RollLimitedRandomNumber(seed: D2SeedStrc, nMax: number): number {
  let nResult = 0
  if (nMax > 0) {
    advanceD2Seed(seed)
    if ((nMax - 1) & nMax) {
      nResult = seed.lo % nMax
    } else {
      nResult = (seed.lo & (nMax - 1)) >>> 0
    }
  }
  if (seedTraceSink) seedTraceSink.roll(seed, 'L', nMax, nResult)
  return nResult
}

/** SEED_RollPercentage: `SEED_RollRandomNumber(pSeed) % 100` over the full 64-bit state. */
export function SEED_RollPercentage(seed: D2SeedStrc): number {
  advanceD2Seed(seed)
  const nResult = ((seed.hi % 100) * (TWO_POW_32 % 100) + (seed.lo % 100)) % 100
  if (seedTraceSink) seedTraceSink.roll(seed, 'P', 100, nResult)
  return nResult
}
