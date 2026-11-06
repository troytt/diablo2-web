/**
 * Oracle P2: the headless replica runner (`tools/oracle/run-replica.ts`) is deterministic.
 *
 * Needs the user-supplied 1.13c MPQs (`D2_DATA_DIR` or `samples/d2`) and the packed DRLG bundle
 * (`D2_ACT_PACKS_DIR` or `public/act-packs/tiles`, built by `npm run pack`); skipped without them.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_NODE_MPQ_DIR } from '../../src/baker/mpq-archive-source.ts'
import {
  loadReplicaEnvironment,
  parseScenario,
  runReplica,
  type ReplicaEnvironment,
  type ReplicaScenario,
} from '../../tools/oracle/lib/replica.ts'

const PACKS_DIR = process.env.D2_ACT_PACKS_DIR ?? 'public/act-packs/tiles'
const hasMpq = existsSync(join(DEFAULT_NODE_MPQ_DIR, 'd2data.mpq'))
const hasPacks = existsSync(join(PACKS_DIR, 'drlg-bundle.json'))

const SCENARIO: ReplicaScenario = parseScenario({
  name: 'determinism-run-100',
  seed: 12345,
  save: 'tests/fixtures/oracle/saves/a1-barbarian-l1.d2s',
  difficulty: 0,
  frames: 100,
  inputs: [
    // 0x03 RunToLocation (5660, 5930), 0x01 WalkToLocation (5653, 5918)
    { frame: 10, c2s: '031c162a17' },
    { frame: 60, c2s: '0115161e17' },
  ],
})

describe('oracle replica scenario parsing', () => {
  it('rejects malformed scenarios instead of defaulting', () => {
    expect(() => parseScenario({ ...SCENARIO, seed: 0 })).toThrow(/seed/)
    expect(() => parseScenario({ ...SCENARIO, extra: 1 })).toThrow(/unknown key/)
    expect(() => parseScenario({ ...SCENARIO, inputs: [{ frame: 3, c2s: '0x01' }] })).toThrow(/hex/)
    expect(() =>
      parseScenario({
        ...SCENARIO,
        inputs: [
          { frame: 5, c2s: '01' },
          { frame: 4, c2s: '01' },
        ],
      }),
    ).toThrow(/ascending/)
  })
})

describe.skipIf(!hasMpq || !hasPacks)(
  `oracle replica determinism (needs MPQs in ${DEFAULT_NODE_MPQ_DIR} and packed tiles in ${PACKS_DIR})`,
  () => {
    let env: ReplicaEnvironment | undefined
    const getEnv = async (): Promise<ReplicaEnvironment> => {
      env ??= await loadReplicaEnvironment({ packsDir: PACKS_DIR })
      return env
    }

    it('produces byte-identical traces for the same scenario run twice in-process', async () => {
      const e = await getEnv()
      const a = runReplica(SCENARIO, e)
      const b = runReplica(SCENARIO, e)
      expect(a.lines).toHaveLength(SCENARIO.frames + 1)
      expect(b.lines.join('\n')).toBe(a.lines.join('\n'))
      expect(b.lockstepHash).toBe(a.lockstepHash)

      const header = JSON.parse(a.lines[0]!)
      expect(header).toMatchObject({ schema: 'd2oracle/1', source: 'replica', initSeed: 12345 })
      // Inputs are delivered at the start of their frame and logged on that frame's line.
      expect(JSON.parse(a.lines[10]!).in).toEqual([[a.playerUnitId, '031c162a17']])
      // The run input actually moved the player (0x03 decoded through the D2GS server path).
      const p9 = JSON.parse(a.lines[9]!).t0[0]
      const p40 = JSON.parse(a.lines[40]!).t0[0]
      expect([p40[3], p40[4]]).not.toEqual([p9[3], p9[4]])
    }, 60_000)

    it('sampling the trace does not perturb the simulation', async () => {
      const e = await getEnv()
      const observed = runReplica(SCENARIO, e)
      const blind = runReplica(SCENARIO, e, { observe: false })
      expect(blind.lines).toHaveLength(1)
      expect(blind.lockstepHash).toBe(observed.lockstepHash)
    }, 60_000)
  },
)
