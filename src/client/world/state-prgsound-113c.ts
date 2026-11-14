/**
 * Skills.txt `prgsound` (+0x10E) played by the States.txt set / remove functions of `hurricane` (state 144, the
 * only 1.13c row with `setfunc = 7` / `remfunc = 4`).
 *
 * - StateSetFunc[7] `D2Client.dll` `0x6FB22C20`: `skill = stat 0x15E (350 modifierlist_skill)` of the state's
 *   statlist (`0x6FABC1C0` / `0x6FABC4B4`); when `0 <= skill < count` and `Skills[skill].prgsound > 0`,
 *   `PlaySound(unit, prgsound)` (`0x6FB38A70`; Sounds.txt `druid_hurricane` 2335 has `loop = 1`).
 * - StateRemFunc[4] `0x6FB22BB0`: the same lookup; when that sound is playing on the unit (`0x6FAD25D0`) it is
 *   stopped (`0x6FB38C20(sound, 1)`).
 * The set function runs for every complete S2C 0xA8 / 0xAA stat list (dispatch `0x6FB22530`).
 */

import { getSkillClientRow113c } from '../../common/skills/skill-client-113c.ts'
import type { WorldSoundRequest } from '../audio/d2gs-play-sound-113c.ts'
import type { ClientUnit } from './client-unit.ts'

/** States.txt rows with `setfunc = 7` / `remfunc = 4` (1.13c: `hurricane` only). */
export const STATE_PRGSOUND_LOOP_STATES_113C: ReadonlySet<number> = new Set([144])

const STAT_MODIFIERLIST_SKILL = 350

interface StateStatLike {
  readonly statId: number
  readonly value: number
  readonly param?: number | undefined
}

function prgSoundOf(stats: readonly StateStatLike[] | undefined): number {
  if (!stats) return 0
  const skill = stats.find(s => s.statId === STAT_MODIFIERLIST_SKILL && (s.param ?? 0) === 0)?.value
  if (skill === undefined || skill < 0) return 0
  return getSkillClientRow113c(skill)?.prgSound ?? 0
}

type UnitLike = Pick<ClientUnit, 'unitType' | 'id' | 'x' | 'y'>

/** StateSetFunc[7]: sound request for `state` set with `stats`, or null. */
export function statePrgSoundStartRequest113c(
  unit: UnitLike,
  state: number,
  stats: readonly StateStatLike[] | undefined,
): WorldSoundRequest | null {
  if (!STATE_PRGSOUND_LOOP_STATES_113C.has(state)) return null
  const soundId = prgSoundOf(stats)
  if (soundId <= 0) return null
  return { soundId, unit: { unitType: unit.unitType, id: unit.id, x: unit.x, y: unit.y } }
}

/** StateRemFunc[4]: stop request for `state` (read from the state's statlist before it is freed), or null. */
export function statePrgSoundStopRequest113c(
  unit: UnitLike,
  state: number,
  stats: readonly StateStatLike[] | undefined,
): WorldSoundRequest | null {
  if (!STATE_PRGSOUND_LOOP_STATES_113C.has(state)) return null
  const soundId = prgSoundOf(stats)
  if (soundId <= 0) return null
  return {
    kind: 'unit-sound-stop',
    soundId,
    unitId: unit.id,
    unit: { unitType: unit.unitType, id: unit.id, x: unit.x, y: unit.y },
  }
}
