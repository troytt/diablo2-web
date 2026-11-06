/**
 * 1.13c D2Client MissCltDoFunc[8] (0x6fb691c0) — the lightning trail of chainlightning, lightningbolt,
 * lightningstrike, monsterlight, bat lightning bolt, arcanelightningbolt, cairnstonesground, baal taunt lightning, …
 * (every Missiles.txt row with pCltDoFunc = 8) — and the sub-missile init callback 0x6fb60f40 it installs.
 *
 * ```
 * 0x6fb691f4  CltSubMissile1 (+0x1e) < 0                  -> 0x6fb61720 (remove the missile)
 * 0x6fb69207  elapsed = #10985(m); elapsed < InitSteps (+0x135) -> skip
 * 0x6fb6921f  #10203(path) == 0 (no new sub-tile this step) -> skip
 * 0x6fb69229  create { flags 1 (explicit start = path x/y), owner, missile = CltSubMissile1, level 0 (record
 *                      zeroed: lifetime = Range), loops (+0x34) = CltParam1 (+0x58) >= 1 ? CltParam1 : 1,
 *                      cb = 0x6fb60f40, cbArg = m }
 *             -> CltDo1 tail (0x6fb617c0)
 * 0x6fb60f40  (edi = new sub-missile, ebx = parent)
 *             z = CltParam2(sub, +0x5c) > 0 ? RAND(parent seed, P2) - P2 / 2 : 0   -> traj +0x0c = z << 11
 *             direction of the sub path = direction of the parent path (#10230 -> #10396)
 *             unit+0x44 = RAND(sub seed, AnimLen(sub, +0x178)) << 8           (random start frame)
 * ```
 * RAND = 0x6fab1330 / 0x6fab1380: returns 0 without stepping the seed when the range is <= 0.
 */
import { SEED_RollLimitedRandomNumber, type D2SeedStrc } from '../../common/rng/d2-rng.ts'
import { missileCltCols113c, type MissileCltColsRow113c } from '../../common/skills/missile-clt-cols-113c.ts'

/** D2Common #10203: the dynamic path entered a new sub-tile during the last step. */
export function pathEnteredNewSubtile(prevX: number, prevY: number, x: number, y: number): boolean {
  return Math.floor(prevX) !== Math.floor(x) || Math.floor(prevY) !== Math.floor(y)
}

export type CltDo8Decision =
  | { readonly kind: 'remove' }
  | { readonly kind: 'skip' }
  | { readonly kind: 'spawn'; readonly sub: MissileCltColsRow113c; readonly loops: number }

/** The branch of 0x6fb691c0 for one frame (`elapsed` = #10985 before the CltDo1 tail). */
export function cltDo8Decide(row: MissileCltColsRow113c, elapsed: number, enteredNewSubtile: boolean): CltDo8Decision {
  const subId = row.cltSubMissile[0]
  if (subId < 0) return { kind: 'remove' }
  if (elapsed < row.initSteps || !enteredNewSubtile) return { kind: 'skip' }
  const p1 = row.cltParam[0]
  return { kind: 'spawn', sub: missileCltCols113c(subId), loops: p1 >= 1 ? p1 : 1 }
}

/** 0x6fb60f40: height (pixels, traj z >> 11) and start frame of a CltDo8 trail segment. Parent seed first. */
export function cltDo8SubInit(
  sub: MissileCltColsRow113c,
  parentSeed: D2SeedStrc,
  subSeed: D2SeedStrc,
): { readonly altitude: number; readonly initialFrame: number } {
  const p2 = sub.cltParam[1]
  // `cdq; sub eax, edx; sar eax, 1`: P2 / 2 truncated toward zero.
  const altitude = p2 > 0 ? SEED_RollLimitedRandomNumber(parentSeed, p2) - Math.trunc(p2 / 2) : 0
  const initialFrame = SEED_RollLimitedRandomNumber(subSeed, sub.animLen)
  return { altitude, initialFrame }
}
