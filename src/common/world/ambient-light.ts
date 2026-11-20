/**
 * Diablo II v1.13c room ambient light — D2Client.dll `CLIENT_GetAmbientLight` (0x6fb59a20).
 *
 * 0x6fb59a20 resolves the ambient light of one room in priority order (the light grid fill
 * 0x6fb59c90 calls it with the step 1–3 flag set):
 *
 * 1. Den of Evil (level 8): quest light from 0x6fb024d0;
 * 2. levels 107/108: red 255,64,48 at intensity 160 while `[0x6fbcc2e4]` is set and `[0x6fba2130]`
 *    is -1 (black otherwise);
 * 3. every other level: the global fade override `[0x6fbc9610..0x6fbc9616]`;
 * 4. Levels.txt Intensity / Red / Green / Blue (D2Common #10636, 0x6fd8c6a0) when any of R, G, B
 *    is non-zero;
 * 5. otherwise the act clock: colour #10189 (0x6fd87520) and intensity #10731 (0x6fd874e0).
 *
 * Steps 1–3 fall through to step 4 whenever their colour is black, which is the normal state of
 * the game. They read client quest state (S2C 0x5E / 0x89, state packets) and live in
 * `src/client/world/quest-fx-light.ts` (`resolveRoomAmbient`, #826). This module is steps 4–5.
 */

import type { Environment } from './environment.ts'
import { getLevelLighting } from './levels-meta.ts'

export interface AmbientLight {
  readonly intensity: number
  readonly red: number
  readonly green: number
  readonly blue: number
  /**
   * `den`: Den of Evil quest light (step 1); `act4`: Act 4 red light (step 2); `fade`: global fade
   * (step 3); `levels`: fixed Levels.txt light (step 4); `environment`: act clock (step 5).
   */
  readonly source: 'den' | 'act4' | 'fade' | 'levels' | 'environment'
}

/**
 * Ambient light of a room in level `levelId` (0x6fb59a20 steps 4–5).
 *
 * @throws when Levels.txt has no row for `levelId`.
 */
export function resolveLevelAmbient(
  levelId: number,
  env: Pick<Environment, 'intensity' | 'red' | 'green' | 'blue'>,
): AmbientLight {
  const def = getLevelLighting(levelId)
  if (def === undefined) {
    throw new Error(`resolveLevelAmbient: Levels.txt has no row for level ${String(levelId)}`)
  }
  if ((def.red | def.green | def.blue) !== 0) {
    return { intensity: def.intensity, red: def.red, green: def.green, blue: def.blue, source: 'levels' }
  }
  return { intensity: env.intensity, red: env.red, green: env.green, blue: env.blue, source: 'environment' }
}
