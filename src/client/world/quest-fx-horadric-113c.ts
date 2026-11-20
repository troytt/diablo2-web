/**
 * Diablo II v1.13c A2Q6 "staff in the orifice" client show (Issue #915).
 *
 * Server (D2Game 1.13c 0x6fce9d72..0x6fce9dcf, D2MOO `ACT2Q6_DeleteAllHoradricItemsAndOpenTomb` 0x6FCA60D0):
 * after C2S 0x44 StaffInOrifice it removes the staff, sets `pQuestControl+0x20 = 3` and sends S2C 0x89
 * SpecialQuestEvent 3 to every player (`QUESTS_TriggerFX` 0x6fcffcc0 / callback 0x6fc559c0), puts the orifice
 * (objects.txt 152) in OBJMODE_OPERATING and starts a quest timer of `(Missiles[338].Range - 75) / 20` units that
 * later spawns objects.txt 100 `Duriel's Lair` (the portal in the tomb wall) at (orifice.x - 13, orifice.y + 3).
 * Those object packets are ordinary S2C object / mode packets; this module covers the client-only show.
 *
 * Client, special quest event 3 handler `0x6fb03450` (jump table 0x6fba2138[3]):
 * 1. `gpPlayer` (0x6fbcbbfc) and its room (#10331) must exist, and D2Common #10754(room, UNIT_OBJECT, 0x98) must
 *    find the orifice in the room or its near rooms, else nothing happens.
 * 2. `0x6faf5570(0x1252, 0, 0x2d5, 0, 0, 0)`: song override `music_quest_horadric` (Sounds.txt 4690,
 *    act2\horadricaction.wav).
 * 3. `0x6fb5ff10(gpPlayer, 0x152, orifice.x, orifice.y, 0, 1)`: client missile 338 `horadricstaff`;
 *    `UNIT_Set3DPosition` 0x6fb77e30(z = 0x28), trajectory velocity (0, 0, 0x200), target (0, 0, 0x46) and flag
 *    0x20 (0x6fb034d8..0x6fb0351c): the staff floats up from 40 to 70 px.
 * 4. `0x6fb1b300(overlay 0xb5)` on the orifice: Overlay.txt 181 `light_jet`.
 * 5. `0x6fb1a0c0(MonStats 0xd3, 1)`: preloads Duriel's graphics (no visible effect; not ported).
 *
 * CltDoFunc 31 `0x6fb64b80` (Missiles.txt 338) each tick, `rem` = D2Common #10737 (remaining frames):
 * - `rem == 150`: screen shake (start = GetTickCount, ramp 0, sustain 4000 ms, ramp 0, amplitude 25;
 *   0x6fbbb9cc..0x6fbbb9d8 / 0x6fbcbefc).
 * - `rem == 325 - 25 k` (k = 0..6): missile 340 `horadriclight` at staff + (dx, dy) of the .rdata table 0x6fb836d0
 *   (12-byte records {dx, dy, dir}), `PATH_SetDirection` (#10706) to `dir`, range and remaining frames set to
 *   `rem` (#10558 / #10970) so every beam dies with the staff.
 * - `rem < 165`, `rem` even: missile 339 `horadriclightning` (spawn flags 0x21) from the staff to
 *   (staff.x - 13, staff.y + 3), 3D position (0, 0, 0x23000 = 70 px), velocity (0, 0, -0x800), `PATH_SetDirection`
 *   0x15 and #10520(path, 0) (no re-orientation while it flies).
 * - `rem < 150`: missile 150 `dust` (flags 0x21) at (staff.x - 13, staff.y + 3) towards
 *   (staff.x - 12 + seed % 5, staff.y - 2 + seed % 10) (two draws on the staff's unit seed), anim speed 0x40
 *   (#10441; Missiles.txt AnimSpeed 16 is 0x100).
 * - then the default CltDoFunc 1 (0x6fb617c0).
 */

import { d2Rand, type D2Seed } from '../../common/drlg/light-grid.ts'
import { QUEST_FX_MISSILES_113C } from './quest-fx-data-113c.ts'

/** objects.txt 152 `orifice` (Token HA): the class 0x6fb03450 looks up (`push 0x98`). */
export const HORADRIC_ORIFICE_OBJECT_CLASS = 0x98
/** objects.txt 100 `Duriel's Lair` (Token SJ): the portal object the server spawns in the wall. */
export const DURIELS_LAIR_PORTAL_OBJECT_CLASS = 100
/** Overlay.txt 181 `light_jet` (LIGHTJET), put on the orifice by 0x6fb03450 (`mov eax,0xb5`). */
export const HORADRIC_ORIFICE_OVERLAY = 0xb5
/** Sounds.txt 4690 `music_quest_horadric`: the song override 0x6faf5570 starts (not ported, see report). */
export const HORADRIC_QUEST_MUSIC_SOUND = 0x1252
/** Special quest event id of the staff show (D2Game `pQuestControl+0x20 = 3`). */
export const HORADRIC_STAFF_SPECIAL_EVENT = 3

/** Missiles.txt ids used by the show. */
export const HORADRIC_STAFF_MISSILE = 0x152
export const HORADRIC_LIGHTNING_MISSILE = 0x153
export const HORADRIC_LIGHT_MISSILE = 0x154
export const HORADRIC_DUST_MISSILE = 0x96

/** 3D trajectory fixed point (`shl 0xb` / `sar 0xb` in 0x6fb77xxx). */
export const TRAJ_FIXED_SHIFT = 11

/**
 * The z axis of the D2Client unit 3D trajectory record (gfx+0x30, 0x4c bytes, allocated zeroed by 0x6fb77b00):
 * +0x0c z, +0x18 vz, +0x24 az, +0x30 target z, flag 0x20 "rising" and flag 0x1 "stopped". x / y offsets,
 * velocities and targets stay 0 for every horadric missile, so the step reduces to z.
 */
export interface Traj3dZ {
  /** +0x0c, fixed point (<< 11) */
  z: number
  /** +0x18 */
  vz: number
  /** +0x24 */
  az: number
  /** +0x30, pixels (compared with `z >> 11`) */
  targetZ: number
  /** flag 0x20 */
  rising: boolean
  /** flag 0x1 */
  stopped: boolean
}

/**
 * `UNIT_Step3DTrajectory` 0x6fb77fb0 for a record without flags 0x2 / 0x4 / 0x10 and zero x / y terms:
 * position += velocity, velocity += acceleration (0x6fb77fe0..0x6fb7801a), then the target test of
 * 0x6fb78169..0x6fb781e5 (flag 0x20 clear: stop once `z >> 11 <= target`; set: once `z >> 11 >= target`),
 * which snaps z to the target and sets flag 0x1. Returns the drawn height `z >> 11` (+0x3c = -(z >> 11)).
 */
export function stepTraj3dZ(t: Traj3dZ): number {
  if (!t.stopped) {
    t.z = (t.z + t.vz) | 0
    t.vz = (t.vz + t.az) | 0
    const zPx = t.z >> TRAJ_FIXED_SHIFT
    if (t.rising ? zPx >= t.targetZ : zPx <= t.targetZ) {
      t.z = t.targetZ << TRAJ_FIXED_SHIFT
      t.stopped = true
    }
  }
  return t.z >> TRAJ_FIXED_SHIFT
}

/** 0x6fb034cb..0x6fb0351c: the staff's trajectory after 0x6fb5ff10. */
export function staffTraj3d(): Traj3dZ {
  return { z: 0x28 << TRAJ_FIXED_SHIFT, vz: 0x200, az: 0, targetZ: 0x46, rising: true, stopped: false }
}

/** 0x6fb64e3d..0x6fb64e6e: a horadriclightning's trajectory (target record left zero by 0x6fb77b00). */
export function lightningTraj3d(): Traj3dZ {
  return { z: 0x23000, vz: -0x800, az: 0, targetZ: 0, rising: false, stopped: false }
}

/** One record of the .rdata table 0x6fb836d0 (stride 12) walked by 0x6fb64bd9..0x6fb64d12. */
export interface HoradricLightBeam113c {
  /** `rem` at which the beam is spawned: 0x145 - 25 k */
  readonly rem: number
  readonly dx: number
  readonly dy: number
  /** dir64 given to PATH_SetDirection (#10706), low byte of the third dword */
  readonly dir: number
}

/** D2Client.dll .rdata 0x6fb836d0..0x6fb8372c, read byte for byte from the 1.13c binary. */
export const HORADRIC_LIGHT_BEAMS_113C: readonly HoradricLightBeam113c[] = Object.freeze([
  { rem: 325, dx: 3, dy: -2, dir: 4 },
  { rem: 300, dx: 1, dy: -3, dir: 58 },
  { rem: 275, dx: 3, dy: 1, dir: 13 },
  { rem: 250, dx: -2, dy: -3, dir: 49 },
  { rem: 225, dx: 1, dy: 3, dir: 22 },
  { rem: 200, dx: -3, dy: 0, dir: 40 },
  { rem: 175, dx: -2, dy: 2, dir: 31 },
])

/** `rem` of the screen shake (0x6fb64ba2) and its parameters (0x6fb64bae..0x6fb64bcf). */
export const HORADRIC_SHAKE_REM = 0x96
export const HORADRIC_SHAKE_SUSTAIN_MS = 0xfa0
export const HORADRIC_SHAKE_AMPLITUDE = 0x19
/** Lightning while `rem < 0xa5` and `rem` is even (0x6fb64d18..0x6fb64d33). */
export const HORADRIC_LIGHTNING_BEFORE_REM = 0xa5
/** Dust while `rem < 0x96` (0x6fb64e87). */
export const HORADRIC_DUST_BEFORE_REM = 0x96
/** Wall point the lightning flies to and the dust rises from: staff + (-13, +3) (0x6fb64ddc / 0x6fb64e0d). */
export const HORADRIC_WALL_DX = -13
export const HORADRIC_WALL_DY = 3
/** `PATH_SetDirection(path, 0x15)` of every horadriclightning (0x6fb64e78). */
export const HORADRIC_LIGHTNING_DIR = 0x15
/** #10441(dust, 0x40): wAnimSpeed 0x40, i.e. Missiles.txt AnimSpeed units of 4 (16 = 0x100). */
export const HORADRIC_DUST_ANIM_SPEED = 0x40 >> 4

/** One client missile CltDoFunc 31 creates this tick. */
export type HoradricStaffSpawn =
  | {
      readonly kind: 'light'
      readonly missile: typeof HORADRIC_LIGHT_MISSILE
      readonly x: number
      readonly y: number
      readonly dir: number
      /** range and remaining frames (#10558 / #10970) */
      readonly frames: number
    }
  | {
      readonly kind: 'lightning'
      readonly missile: typeof HORADRIC_LIGHTNING_MISSILE
      readonly x: number
      readonly y: number
      readonly targetX: number
      readonly targetY: number
      readonly dir: number
    }
  | {
      readonly kind: 'dust'
      readonly missile: typeof HORADRIC_DUST_MISSILE
      readonly x: number
      readonly y: number
      readonly targetX: number
      readonly targetY: number
      readonly animSpeed: number
    }

export interface HoradricStaffTick {
  readonly shake: boolean
  readonly spawns: readonly HoradricStaffSpawn[]
}

/**
 * CltDoFunc 31 (0x6fb64b80) before its tail call to CltDoFunc 1: what the staff spawns at remaining-frame count
 * `rem` when it stands on sub-tile (`x`, `y`) (#10867 / #10750). `seed` is the staff unit's seed (unit+0x20/+0x24),
 * advanced twice per dust.
 */
export function horadricStaffTick(rem: number, x: number, y: number, seed: D2Seed): HoradricStaffTick {
  const spawns: HoradricStaffSpawn[] = []
  for (const beam of HORADRIC_LIGHT_BEAMS_113C) {
    if (rem > beam.rem) break // 0x6fb64bf2
    if (rem !== beam.rem) continue // 0x6fb64bf8
    spawns.push({ kind: 'light', missile: HORADRIC_LIGHT_MISSILE, x: x + beam.dx, y: y + beam.dy, dir: beam.dir, frames: rem })
  }
  const wallX = x + HORADRIC_WALL_DX
  const wallY = y + HORADRIC_WALL_DY
  if (rem < HORADRIC_LIGHTNING_BEFORE_REM && rem % 2 === 0) {
    spawns.push({
      kind: 'lightning',
      missile: HORADRIC_LIGHTNING_MISSILE,
      x,
      y,
      targetX: wallX,
      targetY: wallY,
      dir: HORADRIC_LIGHTNING_DIR,
    })
  }
  if (rem < HORADRIC_DUST_BEFORE_REM) {
    // 0x6fb64f06..0x6fb64f66: two inline RAND steps on the staff seed, `lo % 5` then `lo % 10`.
    const tx = wallX + 1 + d2Rand(seed, 5)
    const ty = wallY - 5 + d2Rand(seed, 10)
    spawns.push({
      kind: 'dust',
      missile: HORADRIC_DUST_MISSILE,
      x: wallX,
      y: wallY,
      targetX: tx,
      targetY: ty,
      animSpeed: HORADRIC_DUST_ANIM_SPEED,
    })
  }
  return { shake: rem === HORADRIC_SHAKE_REM, spawns }
}

/** Missiles.txt rows of the show, checked once at import (fail fast on a regenerated table that lost a row). */
export const HORADRIC_MISSILE_ROWS = (() => {
  const row = (id: number, name: string) => {
    const r = QUEST_FX_MISSILES_113C[id]
    if (r === undefined || r.name !== name) {
      throw new Error(`quest-fx-horadric: Missiles.txt row ${String(id)} is not '${name}'`)
    }
    return r
  }
  return Object.freeze({
    staff: row(HORADRIC_STAFF_MISSILE, 'horadricstaff'),
    lightning: row(HORADRIC_LIGHTNING_MISSILE, 'horadriclightning'),
    light: row(HORADRIC_LIGHT_MISSILE, 'horadriclight'),
    dust: row(HORADRIC_DUST_MISSILE, 'dust'),
  })
})()
