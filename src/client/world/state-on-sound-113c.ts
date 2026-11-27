/**
 * States.txt `onsound` playback on a state's inactive → active transition (Issue #993 item 12).
 *
 * D2Client.dll `0x6fb23760` (client state set): `if (!STATES_CheckState(pUnit, nState))` (0x6fabc1fc @ 0x6fb237d6)
 * and `StatesTxt[nState].wOnSound >= 0` (`word [edi+0x26]` @ 0x6fb237fc) → `PlaySound(wOnSound, pUnit, 0, 0, 0)`
 * (0x6fb38a70 @ 0x6fb2380f) before the state bit is toggled on. A state that is already active plays nothing, so a
 * client-side optimistic curse and the server's later StateSet for the same activation sound exactly once.
 */

import { getStateOffSound113c, getStateOnSound113c } from '../../common/audio/state-sounds-113c.ts'
import type { WorldSoundRequest } from '../audio/d2gs-play-sound-113c.ts'
import type { ClientUnit } from './client-unit.ts'

/**
 * Sound request for `stateId` turning on at `unit`, or null when the state was already active (`wasActive`) or has
 * no States.txt `onsound`.
 */
export function stateOnSoundRequest113c(
  unit: Pick<ClientUnit, 'unitType' | 'id' | 'x' | 'y'>,
  stateId: number,
  wasActive: boolean,
): WorldSoundRequest | null {
  if (wasActive) return null
  const soundId = getStateOnSound113c(stateId)
  if (soundId <= 0) return null
  return { soundId, unit: { unitType: unit.unitType, id: unit.id, x: unit.x, y: unit.y } }
}

/**
 * D2Client.dll `0x6fb227a0` (client state clear, called by S2C 0xA9 EndState @ `0x6fb5d790`):
 * When `stateId` was active (`wasActive === true`) and is cleared, reads `StatesTxt[nState].wOffSound` (`+0x28`)
 * and plays it on `unit` (`PlaySound(wOffSound, pUnit, 0, 0, 0)`). Returns null when the state was not active
 * or has no `offsound`.
 */
export function stateOffSoundRequest113c(
  unit: Pick<ClientUnit, 'unitType' | 'id' | 'x' | 'y'>,
  stateId: number,
  wasActive: boolean,
): WorldSoundRequest | null {
  if (!wasActive) return null
  const soundId = getStateOffSound113c(stateId)
  if (soundId <= 0) return null
  return { soundId, unit: { unitType: unit.unitType, id: unit.id, x: unit.x, y: unit.y } }
}
