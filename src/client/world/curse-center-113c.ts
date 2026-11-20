/**
 * 1.13c Necromancer curse AoE particle shower (Issue #993 item 11).
 *
 * D2Client.dll ground truth (disassembled from samples/d2/D2Client.dll, image base 0x6fab0000):
 *
 * - `SKILLS_CltDo30_Curse` (0x6fb78b40): `nAuraRange = D2Common_10786(Skills.txt aurarangecalc)` (0x6fb78bcf),
 *   `nVisualRadius = max(nAuraRange - 3, 2)` (0x6fb78bd4..0x6fb78bde), spawns ONE `cursecenter` (#191 = 0xbf,
 *   0x6fb78c1c) at the target and stores `wCltMissileA` (0x6fabcc76) and `nVisualRadius` (0x6fabcc7c) on it.
 * - `MISSMODE_CltDo17_CurseCenter` (0x6fb6bb40): `nElapsed < Missiles.txt CltParam1` (`cmp eax,[ebp+0x58]`,
 *   7 for cursecenter) and `nElapsed % 3 == 0` (0x6fb6bbc0..0x6fb6bbc9) → waves on elapsed 0, 3, 6. Each wave calls
 *   0x6fb6b210(nVisualRadius, wCltMissileA, skill, slvl, nChance, nStep) with
 *   `nChance = R > 4 ? R / 2 : R` and `nStep = R > 4 ? 2 : 1` (0x6fb6bbcb..0x6fb6bbdf). There is NO per-wave radius
 *   growth: all three waves cover the same disk.
 * - 0x6fb6b210 → 0x6fb66d40 (filled-disk scatter): for `dy = -R..R step nStep` (outer) and `dx = -R..R step nStep`
 *   (inner), if `dx² + dy² <= R²` and (`nChance <= 0` or `RAND(missile seed, nChance) == 0`, 0x6fb66e43..0x6fb66e87)
 *   it creates `wCltMissileA` at `(x + dx, y + dy)` in sub-tiles (0x6fb66e8d..0x6fb66f13). The offsets are in the
 *   map's sub-tile grid, so on screen the disk is the 2:1 isometric ground ellipse.
 */

import { d2Rand, type D2Seed } from '../../common/drlg/light-grid.ts'
import type { ClientUnit } from './client-unit.ts'
import type { SpawnMissileOptions } from './world-skill-state-tables.ts'

type SpawnMissileFn = (
  missileKey: string,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  opts?: SpawnMissileOptions,
) => ClientUnit

/**
 * MISSMODE_CltDo17_CurseCenter (0x6fb6bb40) for one `cursecenter` tick. `elapsed` is the missile's frame count
 * before this step (0 on the first tick). Missing wCltMissileA / nVisualRadius is a wiring bug and throws.
 */
export function tickCurseCenter113c(
  spawnMissileByKey: SpawnMissileFn,
  unit: ClientUnit,
  elapsed: number,
): void {
  const cltParam1 =
    unit.missileKey === 'mindblast center'
      ? MINDBLAST_CENTER_CLT_PARAM1_113C
      : CURSECENTER_CLT_PARAM1_113C
  if (!isCurseCenterWaveTick113c(elapsed, cltParam1)) return
  const subKey = unit.curseSubMissileKey
  const radius = unit.curseVisualRadius
  if (subKey === undefined || radius === undefined) {
    throw new Error(`cursecenter missile ${String(unit.id)} has no wCltMissileA / nVisualRadius (SKILLS_CltDo30_Curse)`)
  }
  // The client missile's own seed drives the scatter RAND (unit +0x20). Its initial value is not modelled; derive a
  // deterministic per-missile seed once so the three waves continue one RAND stream like the original.
  if (unit.missileSeed === undefined) {
    unit.missileSeed = { lo: (Math.imul(unit.id + 1, 0x6ac690c5) ^ (unit.startedAtTick ?? 0)) >>> 0, hi: 666 }
  }
  const points = computeCurseScatterPoints113c(unit.x, unit.y, radius, unit.missileSeed)
  for (const p of points) {
    spawnMissileByKey(subKey, p.x, p.y, p.x, p.y, {
      ownerType: unit.ownerType,
      ownerId: unit.ownerId,
      sourceSkillId: unit.sourceSkillId,
      skillLevel: unit.skillLevel,
    })
  }
}

/** Missiles.txt `cursecenter` (#191) CltParam1: waves fire while `elapsed < 7`. */
export const CURSECENTER_CLT_PARAM1_113C = 7

/** Missiles.txt `cursecenter` (#191) Range: lifetime in frames. */
export const CURSECENTER_RANGE_113C = 20

/** Missiles.txt `mindblast center` (#576) CltParam1: waves fire while `elapsed < 10` (0, 3, 6, 9). */
export const MINDBLAST_CENTER_CLT_PARAM1_113C = 10

/** Missiles.txt `mindblast center` (#576) Range: lifetime in frames. */
export const MINDBLAST_CENTER_RANGE_113C = 10

/** Skills.txt #273 Mind Blast aurarangecalc = par7 = 4 sub-tiles (SkillCltDoFunc[8] 0x6FAF1290). */
export const MINDBLAST_VISUAL_RADIUS_113C = 4

/** 0x6fb78bd4..0x6fb78bde: `max(nAuraRange - 3, 2)`. */
export function curseVisualRadius113c(auraRangeSubtiles: number): number {
  if (!Number.isFinite(auraRangeSubtiles)) {
    throw new RangeError(`curse aura range ${String(auraRangeSubtiles)} is not finite`)
  }
  return Math.max(Math.trunc(auraRangeSubtiles) - 3, 2)
}

/** 0x6fb6bbb4..0x6fb6bbc9: wave on `elapsed < CltParam1 && elapsed % 3 == 0`. */
export function isCurseCenterWaveTick113c(
  elapsed: number,
  cltParam1: number = CURSECENTER_CLT_PARAM1_113C,
): boolean {
  return elapsed >= 0 && elapsed < cltParam1 && elapsed % 3 === 0
}

/** 0x6fb6bbcb..0x6fb6bbdf: per-wave scatter parameters derived from the visual radius. */
export function curseScatterParams113c(radius: number): { readonly chance: number; readonly step: number } {
  if (radius > 4) {
    return { chance: Math.trunc(radius / 2), step: 2 }
  }
  return { chance: radius, step: 1 }
}

/**
 * 0x6fb66d40 filled-disk scatter for one wave. Consumes the missile seed exactly like the original (one RAND per
 * in-disk grid point when `chance > 0`) and returns the sub-tile spawn points in creation order.
 */
export function computeCurseScatterPoints113c(
  centerX: number,
  centerY: number,
  radius: number,
  seed: D2Seed,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  if (!(radius > 0)) return out
  const { chance, step } = curseScatterParams113c(radius)
  const r2 = radius * radius
  for (let dy = -radius; dy <= radius; dy += step) {
    for (let dx = -radius; dx <= radius; dx += step) {
      if (dx * dx + dy * dy > r2) continue
      if (chance > 0 && d2Rand(seed, chance) !== 0) continue
      out.push({ x: centerX + dx, y: centerY + dy })
    }
  }
  return out
}
