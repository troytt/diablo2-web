/**
 * Object mode sounds (D2Client.dll 0x6fad37e0, object branch `unitType == 2`).
 *
 * 1.13c runs 0x6fad37e0 from every object update (0x6fad5b40 -> 0x6fad5b60) and from the mode setters
 * (ObjectSetMode 0x6fad5aff, DoorSetMode/DoorAnim 0x6fad4f8a / 0x6fad502a). It keeps the last handled mode on
 * the unit (`+0x70` has-mode flag, `+0x74` mode) and, when the current mode differs:
 *   1. 0x6fad387c..0x6fad38a1: looks up the mode-bound sound (0x6fad24f0) and starts it, or stops the unit's
 *      mode-bound sounds (0x6fad3070) when the new mode has none;
 *   2. 0x6fad38a6..0x6fad38e0: if the unit already had a mode (or is class 59, the town portal), plays the
 *      one-shot `modeSounds[newMode]` (0x6fad2570; wells skip it when the new mode < the previous one);
 *   3. 0x6fad38eb..0x6fad38ef: stores the new mode.
 *
 * Doors: DoorSetMode 0x6fad5040 turns packet mode 2 (open) on a closed door into mode 1 (opening animation)
 * when `FrameCnt1 != 1`, and packet mode 0 (close) on an open door into mode 3 (closing animation) when
 * `FrameCnt3 != 1`; DoorAnim then finishes 1 -> 2 / 3 -> 0. The port's door path does not keep those
 * intermediate modes, so a direct 0 -> 2 / 2 -> 0 transition emits the intermediate mode's sound now and the
 * final mode's sound once the animation would have ended.
 *
 * Mode-bound sounds that loop in Sounds.txt (torches, braziers, portals' idle hum, Cairn Stones, ...) emit
 * `unit-loop-start` (guarded by `0x6fad25d0` same-group check) and `unit-loop-stop` (`0x6fad3070` when the
 * new mode has no mode-bound sound or changes sound group; unit removal also stops via `0x6fad3120` / #998).
 */

import {
  CAIRN_STONE_CLASS_ID_113C,
  CAIRN_STONE_MODE_SOUNDS_113C,
  OBJECT_SOUNDS_113C,
  SHRINE_SOUNDS_113C,
} from '../../common/audio/object-sounds-113c.ts'
import { SOUNDS_113C } from '../../common/audio/sounds-113c.ts'
import { CANONICAL_113C_OBJECTS } from '../../common/world/objects-meta.ts'
import type { ObjectsTxtRecord113c } from '../../common/world/objects-txt-113c.ts'

/** Class 59 (`Portal`, town portal): 0x6fad38af `cmp eax, 0x3b` plays the one-shot even on first sight. */
export const TOWN_PORTAL_CLASS_ID_113C = 59

/** The unit fields the handler reads and writes. */
export interface ObjectSoundUnit113c {
  readonly classId: number
  readonly mode: number
  readonly interactType?: number | undefined
  readonly shrineType?: number | undefined
  readonly flags?: number | undefined
  /** Port of unit `+0x70` / `+0x74`: last mode the sound handler saw (`undefined` = none yet). */
  objectSoundMode?: number | undefined
  /** Port of unit `+0x78` active looping sound group: current looping mode-bound sound ID (`0` / `undefined` = none). */
  objectLoopSoundId?: number | undefined
}

/** One sound the handler emits for the object. */
export interface ObjectSoundEmit113c {
  readonly kind?: 'unit-loop-start' | 'unit-loop-stop' | undefined
  readonly soundId: number
  /** 25 Hz ticks to wait (door intermediate animation); omitted = now. */
  readonly delayTicks?: number
}

/** 0x6fad24f0: mode-bound sound of `classId` in `mode` (0 = none). */
export function objectModeBoundSound113c(classId: number, mode: number): number {
  const desc = OBJECT_SOUNDS_113C[classId]
  if (!desc) return 0
  if (classId === CAIRN_STONE_CLASS_ID_113C) return CAIRN_STONE_MODE_SOUNDS_113C[mode] ?? 0
  if (desc.loopSoundA === 0 && desc.loopSoundB === 0) return 0
  if (desc.loopModeA === mode || desc.loopModeA === 8) return desc.loopSoundA
  if (desc.loopModeB === mode || desc.loopModeB === 8) return desc.loopSoundB
  return 0
}

/** 0x6fad2570: one-shot sound of `classId` entering `mode` from `prevMode` (0 = none). */
export function objectModeOneShotSound113c(classId: number, mode: number, prevMode: number): number {
  const desc = OBJECT_SOUNDS_113C[classId]
  if (!desc) return 0
  if (desc.wellGuard && prevMode > mode) return 0
  return desc.modeSounds[mode] ?? 0
}

/** Door animation length in ticks (DoorAnim 0x6fad5400: `Start[mode]` .. `FrameCnt[mode] - 1` at `FrameDelta[mode]`). */
function doorAnimTicks(record: ObjectsTxtRecord113c, mode: number): number {
  const frames = (record.frameCnt[mode] ?? 1) - 1 - (record.start[mode] ?? 0)
  const delta = record.frameDelta[mode] ?? 256
  if (frames <= 0 || delta <= 0) return 0
  return Math.ceil((frames * 256) / delta)
}

function isLoopingSound(soundId: number): boolean {
  return SOUNDS_113C[soundId]?.loop === true
}

/** 0x6fad25d0: checks whether two sound IDs belong to the same `Sounds.txt` variant group (`groupBase`). */
function sameSoundGroup(a: number | undefined, b: number): boolean {
  if (!a || a <= 0 || b <= 0) return false
  if (a === b) return true
  const rowA = SOUNDS_113C[a]
  const rowB = SOUNDS_113C[b]
  return rowA !== undefined && rowB !== undefined && rowA.groupBase === rowB.groupBase
}

/**
 * Runs the 0x6fad37e0 object branch for one object: returns the sounds to emit (empty when the mode is the one
 * already handled) and records the current mode on the unit.
 */
export function updateObjectModeSound113c(
  unit: ObjectSoundUnit113c,
  record: ObjectsTxtRecord113c,
): ObjectSoundEmit113c[] {
  const mode = unit.mode
  const prevMode = unit.objectSoundMode
  if (prevMode === mode) return []
  unit.objectSoundMode = mode

  const out: ObjectSoundEmit113c[] = []

  // D2Client.dll 0x6fad5d0d -> 0x6fad4b90 -> 0x6fad4a70 (OperateFn = 2 shrine client handler):
  // When a shrine transitions from unactivated (mode 0) into operating/activated (mode 1 or 2),
  // look up SHRINE_SOUNDS_113C[shrineCode] (0x6fb82f60 + shrineCode * 0x14 + 0x10).
  if (prevMode === 0 && (mode === 1 || mode === 2)) {
    const objMeta = CANONICAL_113C_OBJECTS[unit.classId]
    const recAny = record as { readonly operateFn?: number; readonly isShrine?: boolean } | undefined
    const isShrine =
      objMeta?.isShrine === true ||
      recAny?.isShrine === true ||
      recAny?.operateFn === 2 ||
      (unit.shrineType !== undefined && unit.shrineType > 0)
    if (isShrine) {
      const explicitCode =
        unit.shrineType !== undefined && unit.shrineType > 0
          ? unit.shrineType
          : unit.interactType !== undefined && unit.interactType > 0
            ? unit.interactType
            : unit.flags !== undefined && unit.flags > 0
              ? unit.flags
              : 0
      const shrineCode =
        explicitCode > 0
          ? explicitCode
          : !OBJECT_SOUNDS_113C[unit.classId]
            ? objMeta?.parm0 === 1
              ? 2
              : objMeta?.parm0 === 2
                ? 3
                : 0
            : 0
      if (shrineCode >= 1 && shrineCode < SHRINE_SOUNDS_113C.length) {
        const shrineSoundId = SHRINE_SOUNDS_113C[shrineCode] ?? 0
        if (shrineSoundId > 0) {
          out.push({ soundId: shrineSoundId })
          if (explicitCode > 0 || !OBJECT_SOUNDS_113C[unit.classId]) {
            return out
          }
        }
      }
    }
  }

  if (!OBJECT_SOUNDS_113C[unit.classId]) return out
  const bound = objectModeBoundSound113c(unit.classId, mode)
  const prevLoop = unit.objectLoopSoundId ?? 0
  if (bound > 0) {
    if (isLoopingSound(bound)) {
      if (prevLoop > 0 && !sameSoundGroup(prevLoop, bound)) {
        out.push({ kind: 'unit-loop-stop', soundId: 0 })
      }
      if (!sameSoundGroup(prevLoop, bound)) {
        unit.objectLoopSoundId = bound
        out.push({ kind: 'unit-loop-start', soundId: bound })
      }
    } else {
      if (prevLoop > 0) {
        unit.objectLoopSoundId = 0
        out.push({ kind: 'unit-loop-stop', soundId: 0 })
      }
      out.push({ soundId: bound })
    }
  } else if (prevLoop > 0) {
    // 0x6fad389c -> 0x6fad3070: stop looping mode-bound sounds attached to this unit.
    unit.objectLoopSoundId = 0
    out.push({ kind: 'unit-loop-stop', soundId: 0 })
  }

  if (prevMode === undefined && unit.classId !== TOWN_PORTAL_CLASS_ID_113C) return out
  const from = prevMode ?? mode
  if (record.isDoor !== 0 && from === 0 && mode === 2 && record.frameCnt[1] !== 1) {
    pushOneShot(out, objectModeOneShotSound113c(unit.classId, 1, from), 0)
    pushOneShot(out, objectModeOneShotSound113c(unit.classId, 2, 1), doorAnimTicks(record, 1))
  } else if (record.isDoor !== 0 && from === 2 && mode === 0 && record.frameCnt[3] !== 1) {
    pushOneShot(out, objectModeOneShotSound113c(unit.classId, 3, from), 0)
    pushOneShot(out, objectModeOneShotSound113c(unit.classId, 0, 3), doorAnimTicks(record, 3))
  } else {
    pushOneShot(out, objectModeOneShotSound113c(unit.classId, mode, from), 0)
  }
  return out
}

function pushOneShot(out: ObjectSoundEmit113c[], soundId: number, delayTicks: number): void {
  if (soundId <= 0) return
  out.push(delayTicks > 0 ? { soundId, delayTicks } : { soundId })
}
