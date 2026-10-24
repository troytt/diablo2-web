/**
 * Diablo II v1.13c Necromancer poison & bone client missile helpers (D2Client.dll, ImageBase 0x6FAB0000).
 *
 * - SKILLS_CltDo17 (`0x6FAC5DA0`, Teeth #67 / Multiple Shot #12) perpendicular fan aim points.
 * - SKILLS_CltDo33 (`0x6FB78C90` → `0x6FB78710`, Poison Explosion #83) 16-point ring spawner `0x6FB66BC0`.
 * - MISSMODE_CltDo04 (`0x6FB6BE00` → `0x6FB69470`, poisonexplosioncloud #217) CltSubMissile1 emission.
 * - MISSMODE_CltDo07 (`0x6FB62EB0`, guidedarrow #86 / bonespirit #193 / monbonespirit #329) homing re-path.
 */
import { SEED_RollLimitedRandomNumber, type D2SeedStrc } from '../../common/rng/d2-rng.ts'

export interface SubTilePoint {
  readonly x: number
  readonly y: number
}

/**
 * 1.13c Missiles.txt (Patch_D2.mpq) parameters these client functions read (verified against the MPQ by
 * tests/nec-poison-bone-993.test.ts): poisonexplosioncloud #217 Param1=2 (ring drift speed, fourths),
 * CltParam1=24 (spawn rate), CltParam2=1 (number), CltParam3=6 (radius), CltSubMissile1=poisonpuff #141;
 * bonespirit #193 / monbonespirit #329 CltParam1=5 (retarget frame).
 */
export const POISONEXPLOSIONCLOUD_113C = Object.freeze({
  param1: 2,
  cltParam1: 24,
  cltParam2: 1,
  cltParam3: 6,
  cltSubMissile1: 'poisonpuff',
})
export const BONESPIRIT_CLT_PARAM1_113C = 5
/** Missiles.txt bonespirit / monbonespirit `Size = 1` (UNITS_GetUnitSizeX for missiles). */
export const BONESPIRIT_SIZE_113C = 1

/**
 * CltDo17 fan: `d = target - caster`; `0x6FB50800` scales `d` up (×4 when |d|² < 4, then ×2 when |d|² < 16);
 * `0x6FB507C0` turns it into the perpendicular step `P = (dY, -dX)` halved (truncating) until |P|² <= 3;
 * the first aim point is `target - trunc(count * P / 2)` and each next one adds `P` — tooth `floor(count/2)`
 * aims exactly at the target point.
 */
export function computeCltDo17FanAimPoints113c(
  casterX: number,
  casterY: number,
  targetX: number,
  targetY: number,
  count: number,
): SubTilePoint[] {
  const cx = Math.floor(casterX)
  const cy = Math.floor(casterY)
  const tx = Math.floor(targetX)
  const ty = Math.floor(targetY)
  let dX = tx - cx
  let dY = ty - cy
  let len2 = dX * dX + dY * dY
  if (len2 < 4) {
    dX *= 4
    dY *= 4
    len2 = dX * dX + dY * dY
  }
  if (len2 < 16) {
    dX *= 2
    dY *= 2
  }
  let a = -dX
  let b = dY
  while (a * a + b * b > 3) {
    b = Math.trunc(b / 2)
    a = Math.trunc(a / 2)
  }
  const px = b
  const py = a
  let x = tx - Math.trunc((count * px) / 2)
  let y = ty - Math.trunc((count * py) / 2)
  const points: SubTilePoint[] = []
  for (let i = 0; i < count; i++) {
    points.push({ x, y })
    x += px
    y += py
  }
  return points
}

/**
 * `0x6FB66BC0` ring tables: X offsets (params +0x1c) at `0x6FB83DB0`, Y offsets (params +0x20) at `0x6FB83D70`.
 */
export const CLT_RING16_DX_113C: readonly number[] = Object.freeze([0, 1, 2, 2, 2, 2, 2, 1, 0, -1, -2, -2, -2, -2, -2, -1])
export const CLT_RING16_DY_113C: readonly number[] = Object.freeze([2, 2, 2, 1, 0, -1, -2, -2, -2, -2, -2, -1, 0, 1, 2, 2])

/** CltDo33 calls the ring spawner with main step 2 (`push 2`): the 8 even entries of the 16-point ring. */
export function poisonExplosionCloudOffsets113c(): SubTilePoint[] {
  const out: SubTilePoint[] = []
  for (let i = 0; i < 16; i += 2) out.push({ x: CLT_RING16_DX_113C[i]!, y: CLT_RING16_DY_113C[i]! })
  return out
}

/**
 * Ring missile speed: params velocity `Param1 << 7` with flags 0x17 (bit 0x10: raw, no `<< 8`), then the
 * create-missile `* 75 / 100` (`0x6FB632A7`); sub-tiles per tick = 16 * dwVelocity / 65536 (as the client
 * missile spawn converts `Vel`).
 */
export function ringMissileSpeedSubTilesPerTick113c(param1: number): number {
  const dwVelocity = Math.floor(((param1 << 7) * 75) / 100)
  return (16 * dwVelocity) / 65536
}

/**
 * CltDo04 `0x6FB69470` one tick: spawns when the missile is on its last frame (`#10737` remaining == 0) or
 * `SEED_RollLimitedRandomNumber(seed, CltParam1) == 0`; then `CltParam2` sub-missiles, each aimed at
 * `pos + (d + sign(d) * r)` with `d = roll(2r) - r` per axis (`r = CltParam3`).
 */
export function rollPoisonCloudPuffTargets113c(
  seed: D2SeedStrc,
  remainingFrames: number,
  posX: number,
  posY: number,
  cltParam1: number,
  cltParam2: number,
  cltParam3: number,
): SubTilePoint[] {
  if (remainingFrames !== 0 && SEED_RollLimitedRandomNumber(seed, cltParam1) > 0) return []
  const out: SubTilePoint[] = []
  const r = cltParam3
  for (let n = cltParam2; n > 0; n--) {
    let dx = SEED_RollLimitedRandomNumber(seed, 2 * r) - r
    let dy = SEED_RollLimitedRandomNumber(seed, 2 * r) - r
    dx += dx < 0 ? -r : r
    dy += dy < 0 ? -r : r
    out.push({ x: Math.floor(posX) + dx, y: Math.floor(posY) + dy })
  }
  return out
}

/**
 * D2Common #10522 unit distance: per-axis |delta| minus both half sizes (truncating), clamped at 0, then
 * `(2 * max + min) / 2` (truncating).
 */
export function unitDistance113c(
  ax: number,
  ay: number,
  aSize: number,
  bx: number,
  by: number,
  bSize: number,
): number {
  const shrink = Math.trunc(aSize / 2) + Math.trunc(bSize / 2)
  const dx = Math.max(0, Math.abs(Math.floor(ax) - Math.floor(bx)) - shrink)
  const dy = Math.max(0, Math.abs(Math.floor(ay) - Math.floor(by)) - shrink)
  const big = Math.max(dx, dy)
  const small = Math.min(dx, dy)
  return Math.trunc((2 * big + small) / 2)
}

/**
 * CltDo07 re-path test: every `CltParam1` elapsed frames (5 when <= 0) toward the locked target when
 * `3 < distance < 25` (`0x6FB62F6C..0x6FB62F7D`).
 */
export function shouldCltDo07Repath113c(elapsedFrames: number, cltParam1: number, distance: number): boolean {
  const rate = cltParam1 > 0 ? cltParam1 : 5
  if (elapsedFrames % rate !== 0) return false
  return distance > 3 && distance < 25
}
