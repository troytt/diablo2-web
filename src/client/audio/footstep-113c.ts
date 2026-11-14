/**
 * Diablo II v1.13c Footstep & Monster Neutral Sound Scheduler (`src/client/audio/footstep-113c.ts`).
 *
 * Implements:
 * - `0x6FAD3C00`: Per-frame unit footstep scheduler (`stepUnitFootstep113c`, `isMonsterFootstepMode113c`,
 *   `computeFootstepVolume113c`, `FsPrb` gating `FootstepLayer` only)
 * - `0x6FB395D0`: Circular frame distance helper (`footstepCircularDistance113c`, `isFootstepStepFrame113c`)
 * - `0x6FAD2FB0` & `0x6FAD26A0`: Terrain material (`SoundEnviron.txt` `Material1` / tile material `1..6`)
 *   and running (`+24`) footstep sound variant selector (`resolveFootstepSoundId113c`, `resolvePlayerFootstepSoundId113c`)
 * - `0x6FAD3905..0x6FAD3A20`: Per-frame monster Neutral sound eligibility & global/unit cooldown rules
 *   (`isMonsterNeutralSoundMode113c`)
 */

import { PLAYER_SOUND_TABLE_0x6FBA7694 } from './d2gs-play-sound-113c.ts'
import { resolveLevelSoundEnviron113c } from './sound-environ-113c.ts'

/**
 * D2Client.dll 0x6FAD3050 jump table (`material - 2`, `0..4` -> `material 2..6`):
 * - `1` (Dirt)          -> `+0`
 * - `2` (Indoor Stone)  -> `+4`
 * - `3` (Outdoor Stone) -> `+8`
 * - `4` (Sand)          -> `+12` (`0x0c`)
 * - `5` (Wood)          -> `+20` (`0x14`)
 * - `6` (Snow)          -> `+16` (`0x10`)
 */
export const FOOTSTEP_MATERIAL_OFFSET_113C: Readonly<Record<number, number>> = {
  1: 0,
  2: 4,
  3: 8,
  4: 12,
  5: 20,
  6: 16,
}

/** D2Client.dll 0x6FAD3045: running footstep variant offset (`+0x18` = `+24`). */
export const FOOTSTEP_RUN_OFFSET_113C = 24

/**
 * D2Client.dll 0x6FAD26A0: resolves the effective footstep material (`1..6`) for a unit.
 * Uses the tile material (`1..6`) if present on the current/adjacent floor tile; otherwise falls back
 * to `SoundEnviron.txt` `Material1` (`+0x1c`) of the unit's current `areaId`.
 */
export function resolveFootstepMaterial113c(areaId: number, tileMaterial?: number): number {
  if (tileMaterial !== undefined && Number.isInteger(tileMaterial) && tileMaterial >= 1 && tileMaterial <= 6) {
    return tileMaterial
  }
  const env = resolveLevelSoundEnviron113c(areaId)
  if (env.material1 >= 1 && env.material1 <= 6) {
    return env.material1
  }
  return 1
}

/**
 * D2Client.dll 0x6FAD2FB0: resolves the terrain-material and walk/run adjusted footstep `Sounds.txt` ID
 * from a base dirt-walk footstep ID (`2720` light, `2768` medium, `2816` heavy).
 */
export function resolveFootstepSoundId113c(
  baseSoundId: number,
  areaId: number,
  running: boolean,
  tileMaterial?: number,
): number {
  if (baseSoundId <= 0) return 0
  const mat = resolveFootstepMaterial113c(areaId, tileMaterial)
  const matOffset = FOOTSTEP_MATERIAL_OFFSET_113C[mat] ?? 0
  const runOffset = running ? FOOTSTEP_RUN_OFFSET_113C : 0
  return baseSoundId + matOffset + runOffset
}

/**
 * D2Client.dll 0x6FAD2FB0 (player branch): resolves a player's footstep sound ID from
 * `PLAYER_SOUND_TABLE_0x6FBA7694[classId].taunt1` (`+0x28`), terrain material, and mode (`3` = run).
 */
export function resolvePlayerFootstepSoundId113c(
  classId: number,
  mode: number,
  areaId: number,
  tileMaterial?: number,
): number {
  const clsIdx = classId >= 0 && classId <= 6 ? classId : 0
  const baseSoundId = PLAYER_SOUND_TABLE_0x6FBA7694[clsIdx]?.taunt1 ?? 2720
  return resolveFootstepSoundId113c(baseSoundId, areaId, mode === 3, tileMaterial)
}

/**
 * D2Client.dll 0x6FAD3C1D..0x6FAD3C74: monster modes that run the footstep scheduler:
 * - `2` (`MONMODE_WALK`) and `15` (`MONMODE_RUN`) for all monsters
 * - `1` (`MONMODE_NEUTRAL`) for `classId === 15` (`foulcrow1`)
 * - `8` (`MONMODE_SKILL1`) for `classId === 110` (`vulture1`)
 */
export function isMonsterFootstepMode113c(classId: number, mode: number): boolean {
  if (mode === 2 || mode === 15) return true
  if (classId === 15 && mode === 1) return true
  if (classId === 110 && mode === 8) return true
  return false
}

/**
 * D2Client.dll 0x6FACC150 -> 0x6FAD3C00: player modes that run the footstep scheduler
 * (`2` = `PLRMODE_WALK`, `3` = `PLRMODE_RUN`, `6` = `PLRMODE_TWALK`).
 */
export function isPlayerFootstepMode113c(mode: number): boolean {
  return mode === 2 || mode === 3 || mode === 6
}

/**
 * D2Client.dll 0x6FB395D0: circular distance between `frame` and `offset` modulo `stepLen`.
 */
export function footstepCircularDistance113c(frame: number, offset: number, stepLen: number): number {
  if (stepLen <= 0) return 0
  const remA = Math.trunc(frame) % stepLen
  const remB = Math.trunc(offset) % stepLen
  const diff = remB - remA
  const d1 = Math.abs(diff)
  const d2 = Math.abs(diff - stepLen)
  const d3 = Math.abs(-diff - stepLen)
  return Math.min(d1, d2, d3)
}

/**
 * D2Client.dll 0x6FAD3D26..0x6FAD3D62: returns `true` when `frame` is a strict local minimum
 * of circular distance to `fsOff` (mod `stepLen`) compared to `frame + speed` and `frame - speed`.
 */
export function isFootstepStepFrame113c(
  frame: number,
  speed: number,
  fsOff: number,
  stepLen: number,
): boolean {
  if (speed === 0 || stepLen <= 0) return false
  const d0 = footstepCircularDistance113c(frame, fsOff, stepLen)
  const dNext = footstepCircularDistance113c(frame + speed, fsOff, stepLen)
  if (d0 >= dNext) return false
  const dPrev = footstepCircularDistance113c(frame - speed, fsOff, stepLen)
  return d0 < dPrev
}

/**
 * D2Client.dll 0x6FAD3DA1..0x6FAD3DDD:
 * - Base volume is `255` (`0xff`) for the local player (`unit == [0x6fbcbbfc]`), `200` (`0xc8`) for all other units.
 * - When `elapsedTicks > floor(1.5 * stepTicks)`, attenuates volume by `trunc((vol * 160) / 255)`
 *   (first step after a pause is softer: `160` for local player, `125` for other units).
 */
export function computeFootstepVolume113c(
  isLocalPlayer: boolean,
  elapsedTicks: number,
  stepTicks: number,
): number {
  const baseVol = isLocalPlayer ? 255 : 200
  const halfThreeStepTicks = (Math.max(0, Math.trunc(stepTicks)) * 3) >>> 1
  if (elapsedTicks > halfThreeStepTicks) {
    return Math.trunc((baseVol * 160) / 255)
  }
  return baseVol
}

/**
 * D2Client.dll 0x6FAD3925..0x6FAD3953: monster modes eligible to emit `MonSounds.txt` `Neutral`:
 * - `1` (`MONMODE_NEUTRAL`), `2` (`MONMODE_WALK`), `15` (`MONMODE_RUN`)
 * - `8` (`MONMODE_SKILL1`) when `classId === 110` (`vulture1`)
 * - `11` (`MONMODE_SKILL4`) when `classId === 136` (`batdemon1`)
 */
export function isMonsterNeutralSoundMode113c(classId: number, mode: number): boolean {
  if (mode === 1 || mode === 2 || mode === 15) return true
  if (classId === 110 && mode === 8) return true
  if (classId === 136 && mode === 11) return true
  return false
}
