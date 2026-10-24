/**
 * Deterministic 64-bit SplitMix64 PRNG adapter (`src/common/rng/splitmix64.ts`).
 *
 * Mixes a 64-bit BigInt (or number) seed via Sebastiano Vigna's SplitMix64 bijection
 * (`0x9e3779b97f4a7c15`, `0xbf58476d1ce4e5b9`, `0x94d049bb133111eb`) and initializes a
 * `D2Rng` instance with the resulting 64-bit state (`lo`, `hi` registers).
 */

import { D2Rng } from './d2-rng.ts'

const MASK_64 = 0xffffffffffffffffn
const GOLDEN_GAMMA = 0x9e3779b97f4a7c15n
const MIX_C1 = 0xbf58476d1ce4e5b9n
const MIX_C2 = 0x94d049bb133111ebn

export function splitMix64Mix(z0: bigint): bigint {
  let z = z0 & MASK_64
  z = ((z ^ (z >> 30n)) * MIX_C1) & MASK_64
  z = ((z ^ (z >> 27n)) * MIX_C2) & MASK_64
  return (z ^ (z >> 31n)) & MASK_64
}

export class SplitMix64Rng extends D2Rng {
  private _state64: bigint

  constructor(seed: bigint | number = 0x113cbeefn) {
    const raw = typeof seed === 'bigint' ? seed & MASK_64 : BigInt(Math.trunc(seed) >>> 0)
    const mixed = splitMix64Mix((raw + GOLDEN_GAMMA) & MASK_64)
    const lo = Number(mixed & 0xffffffffn) >>> 0
    const hi = Number((mixed >> 32n) & 0xffffffffn) >>> 0
    super(lo, hi === 0 ? 666 : hi)
    this._state64 = (raw + GOLDEN_GAMMA) & MASK_64
  }

  nextUint64(): bigint {
    this._state64 = (this._state64 + GOLDEN_GAMMA) & MASK_64
    return splitMix64Mix(this._state64)
  }
}

export function createSplitMix64(seed: bigint | number = 0x113cbeefn): SplitMix64Rng {
  return new SplitMix64Rng(seed)
}
