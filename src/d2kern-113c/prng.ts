/**
 * Diablo II v1.13c 64-bit LCG PRNG (D2SeedStrc).
 *
 * Ground truth from D2Common.dll / D2Game.dll:
 *   SEED_Next(D2SeedStrc* pSeed) -> int32:
 *     uint64_t v = (uint64_t)pSeed->lo * 0x6AC690C5ULL + pSeed->hi;
 *     pSeed->lo = (uint32_t)v;
 *     pSeed->hi = (uint32_t)(v >> 32);
 *     return (int32_t)pSeed->lo;
 *
 *   SEED_Roll(D2SeedStrc* pSeed, uint32_t nMax) -> uint32_t:
 *     if (nMax == 0) return 0;
 *     uint32_t raw = (uint32_t)SEED_Next(pSeed);
 *     return raw % nMax;
 */

export interface D2SeedStrc {
  lo: number // uint32
  hi: number // uint32
}

const MULT = 0x6ac690c5n

export function seedInit(lo: number, hi: number = 0): D2SeedStrc {
  return {
    lo: lo >>> 0,
    hi: hi >>> 0,
  }
}

export function seedNext(seed: D2SeedStrc): number {
  const loBig = BigInt(seed.lo >>> 0)
  const hiBig = BigInt(seed.hi >>> 0)
  const prod = loBig * MULT + hiBig
  seed.lo = Number(prod & 0xffffffffn) >>> 0
  seed.hi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  return (seed.lo | 0) // signed 32-bit int
}

/**
 * `SEED_RollLimited` (`D2Game:0x6FC21180` / `D2Common.#10920 @ 0x6FD510B0`).
 * @va D2Game:0x6FC21180
 * @va D2Common:0x6FD510B0
 */
export function seedRoll(seed: D2SeedStrc, nMax: number): number {
  const max = nMax | 0
  if (max <= 0) return 0
  const raw = seedNext(seed) >>> 0
  return (raw % (max >>> 0)) >>> 0
}

export const seedRollLimited113c = seedRoll
