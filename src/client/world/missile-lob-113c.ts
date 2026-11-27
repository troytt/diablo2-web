/**
 * 1.13c D2Client lobbed missiles (thrown potions: SkillCltDoFunc[2] `0x6fb52f60` calls `0x6fb69a80` for item type 0x26;
 * Baal's monster spawn): create flags `0x521` with record `+0x24` = lob height (0x1e when the caller passes 0).
 *
 * ```
 * create 0x6fb630f0, flag 0x400 (0x6fb6359c): d = #10080(path, target) (0 -> 1);
 *        frames = (d << 16) / (dwVelocity << 4)  -> #10970 / #10558 (remaining = range = frames)
 * create, flag 0x100 (0x6fb635dc): 0x6fb77c80(m, N = frames, height = rec+0x24): trajectory flag 2, +0x48 = max(1, N),
 *        z = height << 11, az = -0x1000 when unset, vz = (-z - (N * N * az) / 2) / N   (C truncating division)
 * ```
 */
import type { Traj3dZ } from './quest-fx-horadric-113c.ts'

/** `0x6fb69b0a`: lob height when the caller passes 0. */
export const LOB_DEFAULT_HEIGHT = 0x1e
/** `0x6fb77cc5`: default z acceleration of a lob trajectory. */
export const LOB_DEFAULT_AZ = -0x1000

/** Flight frames of a lobbed missile (create flag 0x400) for a distance in sub-tiles and dwVelocity (Vel*256*75/100). */
export function lobFrames(distSubTiles: number, dwVelocity: number): number {
  const d = Math.max(1, Math.trunc(distSubTiles))
  if (dwVelocity <= 0) throw new RangeError('lobFrames: a lobbed missile needs a velocity')
  return Math.max(1, Math.trunc((d << 16) / (dwVelocity << 4)))
}

/** `0x6fb77c80`: the z part of the lob trajectory. */
export function lobTraj3d(frames: number, height = LOB_DEFAULT_HEIGHT): Traj3dZ {
  const n = Math.max(1, frames)
  const z = height << 11
  const az = LOB_DEFAULT_AZ
  const half = Math.trunc((n * n * az) / 2)
  const vz = Math.trunc((-z - half) / n)
  return { z, vz, az, targetZ: 0, rising: false, stopped: false }
}
