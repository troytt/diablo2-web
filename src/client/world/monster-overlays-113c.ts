/**
 * Diablo II v1.13c Client Monster Overlays (`D2Client.dll` `0x6FAFD610`, `0x6FB570C0`, `0x6FAFE3DF`, `0x6FAFE847`).
 *
 * Ground truth (`kb/monsters/d2client-monster-overlays-mephisto-113c.md`):
 * 1. `0x6FAFD610` (`ClientMonster_SetupClassData`, called on monster init `0x6FAFE3D6` and `StateSetFunc[8]`
 *    `0x6FB235E0` for `States.txt` `#142` `changeclass`):
 *    - Frees all unit overlays (`0x6FB19700`),
 *    - Clears `UNITFLAG_DONOTDRAW` (`unit->dwFlagsEx &= ~0x40000` at `0x6FAFD82E`),
 *    - Attaches `0xE3` (`#227` `ice_cage`, `type = 5` static hold frame 0) for `classId == 527` (`drehyaiced`).
 * 2. `0x6FB570C0` (`ClientMonster_InitSpecial`, called at `0x6FB57A55` on client monster creation across `hcIdx 0..733`):
 *    - `242` (`mephisto`) & `704` (`ubermephisto`) @ `0x6FB57282`: `#122` (`0x7A` `mephisto`, `type = 3` LOOP),
 *    - `543` (`baalthrone`) @ `0x6FB5729B`: `#275` (`0x113` `baal_on_throne`, `type = 3` LOOP),
 *    - `351..353` (`hydra1..3`) @ `0x6FB57172`: `#172..174` (`hydra_start1..3`, `type = 4` LOOPEX -> `#175..177` `hydra_loop1..3`),
 *    - `333` (`diabloclone`) @ `0x6FB570F5`: `#186` (`0xBA` `light_cast_2`, `type = 2` ONCE),
 *    - `417..418` (`shadowwarrior`, `shadowmaster`) @ `0x6FB571CF`: `#270` (`0x10E` `shadowwarriorappear`, `type = 2` ONCE).
 * 3. `0x6FAFE3DF..0x6FAFE778` (`MONMODE_DEATH`, `mode = 0`):
 *    - `242` / `704` (`mephisto` / `ubermephisto`): default branch — `#122` `mephisto` keeps looping during `DT`,
 *    - `351..353` (`hydra1..3`, `0x6FAFE4DC`): `FreeAllUnitOverlays` (`0x6FB19610`) + `#178..180` (`hydra_end1..3`, `type = 2` ONCE),
 *    - `417..418` (`shadowwarrior`, `shadowmaster`, `0x6FAFE761`): `#271` (`0x10F` `shadowwarriordeath`, `type = 2` ONCE).
 * 4. `0x6FAFE79C..0x6FAFE850` (`MONMODE_DEAD`, `mode = 12`):
 *    - Calls `FreeAllUnitOverlays` (`0x6FB19610`) unless `classId` is Duriel (`211`/`708`), `catapult1` (`497`),
 *      or `shadowwarrior`/`shadowmaster` (`417`/`418`).
 */

import {
  MONSTATS2_FLAGINDEX,
  computeOverlayYOffset113c,
  hasMonStats2Flag,
} from '../../common/units/monstats2-flags.ts'
import { OVERLAY_TXT_ROWS } from '../render/overlay-txt-rows.ts'
import type { ClientUnit, ClientUnitOverlay, ClientUnitOverlayChainStep } from './client-unit.ts'

export const OVERLAY_MEPHISTO = 122
export const OVERLAY_HYDRA_START_BASE = 172
export const OVERLAY_HYDRA_LOOP_BASE = 175
export const OVERLAY_HYDRA_END_BASE = 178
export const OVERLAY_DIABLO_CLONE_CAST = 186
export const OVERLAY_ICE_CAGE = 227
export const OVERLAY_SHADOW_WARRIOR_APPEAR = 270
export const OVERLAY_SHADOW_WARRIOR_DEATH = 271
export const OVERLAY_BAAL_ON_THRONE = 275

export interface InnateLoopMonsterOverlaySpec {
  readonly overlayIndex: number
  readonly token: string
}

/**
 * Persistent looping (`type = 3`) or static (`type = 5`) monster overlays attached on creation in
 * `0x6FB570C0` / `0x6FAFD610`.
 */
export const INNATE_LOOP_MONSTER_OVERLAY_BY_CLASS_113C: Readonly<
  Record<number, InnateLoopMonsterOverlaySpec>
> = Object.freeze({
  242: { overlayIndex: OVERLAY_MEPHISTO, token: 'mephisto' },
  527: { overlayIndex: OVERLAY_ICE_CAGE, token: 'ice_cage' },
  543: { overlayIndex: OVERLAY_BAAL_ON_THRONE, token: 'baal_on_throne' },
  704: { overlayIndex: OVERLAY_MEPHISTO, token: 'mephisto' },
})

function canAttachMonsterOverlay113c(unit: ClientUnit): boolean {
  if (unit.unitType !== 'monster') return false
  // D2Client 0x6FB1B363..0x6FB1B373: unit+0xC8 & 0x40000 (UNITFLAG_DONOTDRAW) blocks overlay creation.
  if (unit.clientNoDraw === true) return false
  // D2Client 0x6FB1B379..0x6FB1B38D: MonStats2 noOvly flag blocks overlay creation.
  if (hasMonStats2Flag(unit.classId, MONSTATS2_FLAGINDEX.NOOVLY)) return false
  return true
}

function createMonsterOverlayFromRow113c(
  unit: ClientUnit,
  overlayId: number,
  overlayIndex: number,
  loop: boolean,
  onExpire?: readonly ClientUnitOverlayChainStep[],
): ClientUnitOverlay | undefined {
  const row = OVERLAY_TXT_ROWS[overlayIndex]
  if (row === undefined) return undefined
  const token = row.name.trim().toLowerCase()
  const totalFrames = Math.max(1, row.frames)
  return {
    overlayId,
    token,
    frame: 0,
    totalFrames,
    animRate: row.animRate,
    loop,
    blendMode: row.trans,
    xOffset: row.xOffset,
    yOffset: computeOverlayYOffset113c(row, unit),
    preDraw: row.preDraw !== 0,
    startedAtMs: Date.now(),
    ageTicks: 0,
    maxTicks: row.animRate > 0 ? Math.ceil((totalFrames * 16) / row.animRate) : Number.POSITIVE_INFINITY,
    lightRadius: row.radius,
    lightColor: [row.red, row.green, row.blue] as const,
    ...(row.loopWaitTime > 0 ? { loopWaitTime: row.loopWaitTime } : {}),
    ...(onExpire !== undefined && onExpire.length > 0 ? { onExpire } : {}),
  }
}

function attachReplacedMonsterOverlay113c(
  unit: ClientUnit,
  nextOverlayId: () => number,
  overlayIndex: number,
  loop: boolean,
  onExpire?: readonly ClientUnitOverlayChainStep[],
): void {
  const entry = createMonsterOverlayFromRow113c(unit, nextOverlayId(), overlayIndex, loop, onExpire)
  if (!entry) return
  unit.overlays = [...unit.overlays.filter(o => o.token !== entry.token), entry]
}

/**
 * `D2Client.dll` `0x6FAFD610` + `0x6FB570C0` monster creation overlay hooks across all 734 `MonStats.txt` classes.
 */
export function applyClientMonsterInitOverlays113c(
  unit: ClientUnit,
  nextOverlayId: () => number,
): void {
  if (!canAttachMonsterOverlay113c(unit)) return
  if (unit.dead || unit.mode === 0 || unit.mode === 12 || unit.lifePct <= 0) return

  const classId = unit.classId
  const innateLoop = INNATE_LOOP_MONSTER_OVERLAY_BY_CLASS_113C[classId]
  if (innateLoop !== undefined) {
    if (!unit.overlays.some(o => o.token === innateLoop.token)) {
      attachReplacedMonsterOverlay113c(unit, nextOverlayId, innateLoop.overlayIndex, true)
    }
    return
  }

  if (classId >= 351 && classId <= 353) {
    // 0x6FB57172: hydra1..3 -> hydra_start1..3 (type=4 LOOPEX) -> hydra_loop1..3 (type=3 LOOP).
    const offset = classId - 351
    const startIdx = OVERLAY_HYDRA_START_BASE + offset
    const loopIdx = OVERLAY_HYDRA_LOOP_BASE + offset
    const startToken = `hydra_start${String(offset + 1)}`
    const loopToken = `hydra_loop${String(offset + 1)}`
    if (!unit.overlays.some(o => o.token === startToken || o.token === loopToken)) {
      attachReplacedMonsterOverlay113c(unit, nextOverlayId, startIdx, false, [
        { overlayIndex: loopIdx, loop: true },
      ])
    }
    return
  }

  if (classId === 333) {
    // 0x6FB570F5: diabloclone -> 0xBA (186 'light_cast_2', type=2 ONCE).
    if (!unit.overlays.some(o => o.token === 'light_cast_2')) {
      attachReplacedMonsterOverlay113c(unit, nextOverlayId, OVERLAY_DIABLO_CLONE_CAST, false)
    }
    return
  }

  if (classId === 417 || classId === 418) {
    // 0x6FB571CF: shadowwarrior / shadowmaster -> 0x10E (270 'shadowwarriorappear', type=2 ONCE).
    if (!unit.overlays.some(o => o.token === 'shadowwarriorappear')) {
      attachReplacedMonsterOverlay113c(unit, nextOverlayId, OVERLAY_SHADOW_WARRIOR_APPEAR, false)
    }
  }
}

/**
 * `D2Client.dll` `0x6FB235B0 -> 0x6FAFD610` (`StateSetFunc[8]` for `States.txt` `#142` `changeclass`):
 * Frees all overlays on the morphing monster (`0x6FB19700`, e.g. removing `baal_on_throne` when `baalthrone`
 * `#543` morphs to `baalcrabstairs` `#559`), clears `UNITFLAG_DONOTDRAW`, updates `classId`, and applies
 * `0x6FAFD610` class overlays (`#527` `drehyaiced` -> `ice_cage`).
 */
export function applyClientMonsterChangeClassOverlays113c(
  unit: ClientUnit,
  newClassId: number,
  nextOverlayId: () => number,
): void {
  if (unit.unitType !== 'monster') return
  unit.overlays = []
  unit.clientNoDraw = false
  unit.classId = newClassId
  if (newClassId === 527 && canAttachMonsterOverlay113c(unit)) {
    attachReplacedMonsterOverlay113c(unit, nextOverlayId, OVERLAY_ICE_CAGE, true)
  }
}

/**
 * `D2Client.dll` `0x6FAFE3DF..0x6FAFE778` (`MONMODE_DEATH`, `mode = 0`) overlay transitions:
 * - `351..353` (`hydra1..3`, `0x6FAFE4DC`): `FreeAllUnitOverlays` (`0x6FB19610`) + `hydra_end1..3` (`#178..180`).
 * - `417..418` (`shadowwarrior`, `shadowmaster`, `0x6FAFE761`): `shadowwarriordeath` (`#271`).
 * - `242` / `704` (`mephisto` / `ubermephisto`): default branch — `#122` `mephisto` stays active during `DT`.
 */
export function applyClientMonsterDeathModeOverlays113c(
  unit: ClientUnit,
  nextOverlayId: () => number,
): void {
  if (unit.unitType !== 'monster') return
  const classId = unit.classId
  if (classId >= 351 && classId <= 353) {
    unit.overlays = []
    if (canAttachMonsterOverlay113c(unit)) {
      const endIdx = OVERLAY_HYDRA_END_BASE + (classId - 351)
      attachReplacedMonsterOverlay113c(unit, nextOverlayId, endIdx, false)
    }
    return
  }
  if ((classId === 417 || classId === 418) && canAttachMonsterOverlay113c(unit)) {
    attachReplacedMonsterOverlay113c(unit, nextOverlayId, OVERLAY_SHADOW_WARRIOR_DEATH, false)
  }
}

/**
 * `D2Client.dll` `0x6FAFE824..0x6FAFE847` (`MONMODE_DEAD`, `mode = 12`):
 * Frees all overlays on the corpse (`0x6FB19610`) unless `classId` is Duriel (`211`/`708`),
 * `catapult1` (`497`), or `shadowwarrior`/`shadowmaster` (`417`/`418`).
 */
export function clearClientMonsterDeadModeOverlays113c(unit: ClientUnit): void {
  if (unit.unitType !== 'monster') return
  const classId = unit.classId
  if (
    classId === 211 ||
    classId === 708 ||
    classId === 497 ||
    classId === 417 ||
    classId === 418
  ) {
    return
  }
  if (unit.overlays.length > 0) {
    unit.overlays = []
  }
}
