/**
 * Diablo II v1.13c: the Compelling Orb smashed with Khalim's Will (Issue #917). Ground truth in
 * kb/quests/a3-compelling-orb-smash-113c.md.
 *
 * Server (D2Game 1.13c): objects.txt 404 `compellingorb` OperateFn 53 (0x6fd0a140, table 0x6fd27bb8[53]) checks the
 * player's weapon code `qf2 ` (Khalim's Will), sets the quest flags, deletes the flail, kills the invisible quest
 * monster MonStats 366 `compellingorb` that the quest's object-init (0x6fd084c0..0x6fd08554) spawned on the orb,
 * creates the server missile 368 `orbmist` from that monster to objects.txt 386 (the Durance stairs, 0x6fd0ab60; if the
 * missile can't be created the stairs go to mode 1 at once), puts the orb in OBJMODE_OPERATING with an end-of-animation
 * event and sends S2C 0x89 SpecialQuestEvent 10 (`QUESTS_TriggerFX` 0x6fc55e90). Missiles.txt 368 has no ClientSend,
 * so the server missile is never shown; when it reaches the stairs (SrvHitFunc 35) the stairs open. Event 10 has no
 * D2Client handler (0x6fba2138[10] = NULL; 0x6fb023b0 only sets bit 10 of 0x6fbcc2dc).
 *
 * Client (D2Client 1.13c): the visible mist is client-only. After a monster mode change the client runs the MonUMod
 * event table 0x6fba9fe0 (5 events per umod; 0x6fad12f0 walks the 9 umod bytes at pMonsterData+0x1c). MonUMod 22
 * `questcomplete`, event 1 (0x6fafeb67, after the NPC mode update) is 0x6fad0fb0, a switch on the monster class with
 * `mode == 0`; class 0x16e (366) calls 0x6fb030d0:
 * 1. D2Common #10754(#10331(orb monster), UNIT_OBJECT, 0x182) looks for objects.txt 386 in the monster's room or its
 *    near rooms.
 * 2. Found: song override 0x6faf5570(0x124f = Sounds.txt 4687, 0x15e) (not ported: there is no song override system)
 *    and target = the stairs' position; not found: target = (monster.x - 15, monster.y - 15).
 * 3. 0x6fb630f0 {flags 0x420, owner = source = the orb monster, missile 0x170 = 368 `orbmist`, target, level 1}: flag 1
 *    clear, so the missile starts at the source unit's position; flag 0x20, so it heads for the target. When it is
 *    created and the stairs exist, D2Common #10637 stores the stairs' unit id at missile data +0x28.
 *
 * CltDoFunc 25 (0x6fb683d0, Missiles.txt 368) each tick, before the CltDoFunc 1 tail (0x6fb617c0):
 * `elapsed` = D2Common #10985 (range +0x0e - remaining +0x10); when `elapsed % max(1, CltParam3)` is 0 it draws four
 * RAND steps on the missile's unit seed (unit+0x20, 0x6fab1380 = seed % n):
 * dx = rand(2 * CltParam1 + 1) - CltParam1, dy = likewise, sx = rand(2 * CltParam2 + 1) - CltParam2 + x,
 * sy = likewise + y, and creates CltSubMissile1 (369 `orbmisttrail`) with flags 0x21 at (sx, sy) heading for
 * (sx + dx, sy + dy), owner = the mist's owner (0x6fb560d0).
 */

import { d2Rand, type D2Seed } from '../../common/drlg/light-grid.ts'
import { QUEST_FX_MISSILES_113C, type QuestFxMissileRow113c } from './quest-fx-data-113c.ts'

/** MonStats.txt 366 `compellingorb` (Code 9a; its art is empty): the quest monster on the orb (0x6fad10a3). */
export const COMPELLING_ORB_MONSTER_CLASS = 0x16e
/** objects.txt 404 `compellingorb` (Token 55): the orb object itself (OperateFn 53). */
export const COMPELLING_ORB_OBJECT_CLASS = 404
/** objects.txt 386 (Token sv, OperateFn 50, InitFn 53): the Durance of Hate stairs 0x6fb030d0 looks up (`push 0x182`). */
export const DURANCE_STAIRS_OBJECT_CLASS = 0x182
/** MonUMod.txt 22 `questcomplete`: the umod whose event-1 entry (0x6fba9fe0[22 * 5 + 1]) is 0x6fad0fb0. */
export const MONUMOD_QUESTCOMPLETE = 22
/** Target offset when the stairs are not found (0x6fb03192 / 0x6fb031bf: `lea reg, [eax - 0xf]`). */
export const ORB_MIST_FALLBACK_DX = -15
export const ORB_MIST_FALLBACK_DY = -15
/** Sounds.txt 4687, the song override 0x6fb030d0 starts when it finds the stairs (not ported, see report). */
export const ORB_MIST_SONG_SOUND = 0x124f

/** Missiles.txt ids of the show. */
export const ORB_MIST_MISSILE = 0x170
export const ORB_MIST_TRAIL_MISSILE = 0x171
export const ORB_MIST_FADE_MISSILE = 0x172

/** MonStats.txt 45 `corruptrogue3` (The Countess, 0x6fad1003 -> 0x6fb02860, Issue #1215). */
export const COUNTESS_MONSTER_CLASS = 0x2d
/** objects.txt 371 (`0x173`, `push 0x173` at 0x6fb02883): the quest chest object 0x6fb02860 looks up. */
export const TOWER_CHEST_OBJECT_CLASS = 0x173
export const TOWER_MIST_MISSILE = 0x123
export const TOWER_MIST_TRAIL_MISSILE = 0x124
export const TOWER_MIST_FADE_MISSILE = 0x14a
export const TOWER_CHEST_SPAWNER_MISSILE = 0x14c

/** Missiles.txt rows of the Compelling Orb show, checked once at import. */
export const ORB_MIST_MISSILE_ROWS = (() => {
  const row = (id: number, name: string): QuestFxMissileRow113c => {
    const r = QUEST_FX_MISSILES_113C[id]
    if (r === undefined || r.name !== name) {
      throw new Error(`quest-fx-compelling-orb: Missiles.txt row ${String(id)} is not '${name}'`)
    }
    return r
  }
  const mist = row(ORB_MIST_MISSILE, 'orbmist')
  if (mist.pCltDoFunc !== 25 || mist.cltSubMissile1 !== ORB_MIST_TRAIL_MISSILE) {
    throw new Error('quest-fx-compelling-orb: Missiles.txt 368 orbmist is not CltDoFunc 25 with CltSubMissile1 369')
  }
  return Object.freeze({
    mist,
    trail: row(ORB_MIST_TRAIL_MISSILE, 'orbmisttrail'),
    fade: row(ORB_MIST_FADE_MISSILE, 'orbmistfade'),
  })
})()

/** Missiles.txt rows of the Countess death show (0x6fb02860, Issue #1215). */
export const TOWER_MIST_MISSILE_ROWS = (() => {
  const row = (id: number, name: string): QuestFxMissileRow113c => {
    const r = QUEST_FX_MISSILES_113C[id]
    if (r === undefined || r.name !== name) {
      throw new Error(`quest-fx-compelling-orb: Missiles.txt row ${String(id)} is not '${name}'`)
    }
    return r
  }
  const mist = row(TOWER_MIST_MISSILE, 'towermist')
  if (mist.pCltDoFunc !== 25 || mist.cltSubMissile1 !== TOWER_MIST_TRAIL_MISSILE) {
    throw new Error('quest-fx-compelling-orb: Missiles.txt 291 towermist is not CltDoFunc 25 with CltSubMissile1 292')
  }
  const spawner = row(TOWER_CHEST_SPAWNER_MISSILE, 'towerchestspawner')
  if (spawner.pCltDoFunc !== 30 || spawner.cltSubMissile1 !== TOWER_MIST_TRAIL_MISSILE) {
    throw new Error('quest-fx-compelling-orb: Missiles.txt 332 towerchestspawner is not CltDoFunc 30 with CltSubMissile1 292')
  }
  return Object.freeze({
    mist,
    trail: row(TOWER_MIST_TRAIL_MISSILE, 'towermisttrail'),
    fade: row(TOWER_MIST_FADE_MISSILE, 'towermistfade'),
    spawner,
    chestSpawner: spawner,
  })
})()

/** Where 0x6fb030d0 sends the mist: the stairs' position, or the orb monster's position - (15, 15). */
export function orbMistTarget(
  orb: { readonly x: number; readonly y: number },
  stairs: { readonly x: number; readonly y: number } | null,
): { readonly x: number; readonly y: number } {
  if (stairs !== null) return { x: stairs.x, y: stairs.y }
  return { x: orb.x + ORB_MIST_FALLBACK_DX, y: orb.y + ORB_MIST_FALLBACK_DY }
}

/** One `orbmisttrail` CltDoFunc 25 creates (flags 0x21: explicit position and target). */
export interface OrbMistTrailSpawn {
  readonly missile: typeof ORB_MIST_TRAIL_MISSILE
  readonly x: number
  readonly y: number
  readonly targetX: number
  readonly targetY: number
}

/**
 * CltDoFunc 25 (0x6fb683d0) before its CltDoFunc 1 tail: the trail the mist spawns at elapsed frame count `elapsed`
 * (#10985) when it stands on sub-tile (`x`, `y`) (0x6fab1630 / 0x6fab1660), or `null` on a tick it skips. `seed` is the
 * mist unit's seed (unit+0x20), advanced four times per trail.
 */
export function orbMistTick(
  elapsed: number,
  x: number,
  y: number,
  seed: D2Seed,
  row: Pick<QuestFxMissileRow113c, 'cltParam1' | 'cltParam2' | 'cltParam3'> = ORB_MIST_MISSILE_ROWS.mist,
): OrbMistTrailSpawn | null {
  const freq = row.cltParam3 < 1 ? 1 : row.cltParam3 // 0x6fb6841f..0x6fb6842c
  if (elapsed % freq !== 0) return null // 0x6fb68434..0x6fb68439 (cdq / idiv: C remainder)
  const destRadius = row.cltParam1 // missiles.bin +0x58, "dest radius"
  const initRadius = row.cltParam2 // missiles.bin +0x5c, "init radius"
  const dx = d2Rand(seed, 2 * destRadius + 1) - destRadius // 0x6fb6845c
  const dy = d2Rand(seed, 2 * destRadius + 1) - destRadius // 0x6fb68471
  const sx = d2Rand(seed, 2 * initRadius + 1) - initRadius + x // 0x6fb6848e..0x6fb684a2
  const sy = d2Rand(seed, 2 * initRadius + 1) - initRadius + y // 0x6fb684b2..0x6fb684c5
  return { missile: ORB_MIST_TRAIL_MISSILE, x: sx, y: sy, targetX: sx + dx, targetY: sy + dy }
}

/** One `towermisttrail` CltDoFunc 30 creates (flags 0x21: explicit position and target). */
export interface TowerChestSpawnerTrailSpawn {
  readonly missile: typeof TOWER_MIST_TRAIL_MISSILE
  readonly x: number
  readonly y: number
  readonly targetX: number
  readonly targetY: number
}

/**
 * CltDoFunc 30 (0x6fb679f0, Missiles.txt 332 `towerchestspawner`) before its CltDoFunc 1 tail:
 * - At `elapsed === row.cltParam1` (150), sets `TargetY = 1` (`D2Common #10019(ebx, 1)` at 0x6fb67a48).
 * - While `TargetY !== 0` and `elapsed % max(1, row.cltParam2) === 0` (every 2 frames), rolls two RAND steps
 *   `dx = d2Rand(seed, 2 * row.cltParam3 + 1) - row.cltParam3` and `dy = likewise` (`[-5, 5]`) and creates
 *   `CltSubMissile1` (`292 towermisttrail`) from `(x, y)` toward `(x + dx, y + dy)`.
 */
export function towerChestSpawnerTick(
  elapsed: number,
  active: number | boolean,
  x: number,
  y: number,
  seed: D2Seed,
  row: Pick<QuestFxMissileRow113c, 'cltParam1' | 'cltParam2' | 'cltParam3'> = TOWER_MIST_MISSILE_ROWS.spawner,
): { readonly active: number; readonly spawn: TowerChestSpawnerTrailSpawn | null } {
  const nextActive = Boolean(active) || elapsed === row.cltParam1
  if (!nextActive) return { active: 0, spawn: null }
  const freq = row.cltParam2 < 1 ? 1 : row.cltParam2
  if (elapsed % freq !== 0) return { active: 1, spawn: null }
  const radius = row.cltParam3
  const dx = d2Rand(seed, 2 * radius + 1) - radius
  const dy = d2Rand(seed, 2 * radius + 1) - radius
  return {
    active: 1,
    spawn: { missile: TOWER_MIST_TRAIL_MISSILE, x, y, targetX: x + dx, targetY: y + dy },
  }
}
