/**
 * Oracle parity ratchet (P3/P4): every golden oracle trace (recorded from the
 * original 1.13c game, tests/fixtures/oracle/golden/) is replayed on the TS
 * server; the first divergent frame must not move earlier than the recorded
 * baseline. Improve parity, then refresh the baseline with
 * `npx tsx tools/oracle/parity-report.ts --write`.
 *
 * Needs the user-supplied MPQs and packed DRLG bundle (same as
 * tests/oracle/replica-determinism.test.ts); skipped without them. No Wine.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_NODE_MPQ_DIR } from '../../src/baker/mpq-archive-source.ts'
import { loadReplicaEnvironment, type ReplicaEnvironment } from '../../tools/oracle/lib/replica.ts'
import { goldenNames, parityForScenario, readBaseline } from '../../tools/oracle/parity-report.ts'

const PACKS_DIR = process.env.D2_ACT_PACKS_DIR ?? 'public/act-packs/tiles'
const hasMpq = existsSync(join(DEFAULT_NODE_MPQ_DIR, 'd2data.mpq'))
const hasPacks = existsSync(join(PACKS_DIR, 'drlg-bundle.json'))

describe.skipIf(!hasMpq || !hasPacks)('oracle golden parity ratchet', () => {
  let env: ReplicaEnvironment | undefined
  const baseline = readBaseline()

  it('has a baseline entry for every golden trace', () => {
    expect(Object.keys(baseline).sort()).toEqual(goldenNames())
  })

  for (const name of goldenNames()) {
    it(`${name}: first divergence does not regress`, async () => {
      env ??= await loadReplicaEnvironment({ packsDir: PACKS_DIR })
      const row = parityForScenario(name, env)
      expect(row.firstDivergenceFrame, row.summary).toBeGreaterThanOrEqual(baseline[name] ?? Infinity)
    }, 120_000)
  }
})
