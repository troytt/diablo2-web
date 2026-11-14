/**
 * Deterministic headless replica runner (oracle differential testing, phase P2).
 *
 *   npx tsx tools/oracle/run-replica.ts <scenario.json> <out.ndjson>
 *
 * Runs the TS `GameInstance` on a fixed frame step (no wall clock) for `scenario.frames` frames and
 * writes a `d2oracle/1` trace with `source: "replica"` (docs/oracle/trace-schema.md).
 *
 * Data sources (no fallbacks): MPQs from `D2_DATA_DIR` (else `samples/d2`), packed DRLG bundle from
 * `D2_ACT_PACKS_DIR` (else `public/act-packs/tiles`). Scenario format: docs/oracle/scenario-schema.md.
 */

import { writeFileSync } from 'node:fs'
import { loadReplicaEnvironment, loadScenarioFile, runReplica } from './lib/replica.ts'

async function main(argv: readonly string[]): Promise<number> {
  if (argv.length !== 2) {
    process.stderr.write('usage: npx tsx tools/oracle/run-replica.ts <scenario.json> <out.ndjson>\n')
    return 2
  }
  const [scenarioPath, outPath] = argv as [string, string]
  const scenario = loadScenarioFile(scenarioPath)
  const env = await loadReplicaEnvironment()
  const result = runReplica(scenario, env)
  writeFileSync(outPath, result.lines.join('\n') + '\n')
  process.stderr.write(
    `replica: ${scenario.name} seed=${scenario.seed} frames=${scenario.frames} ` +
      `inputs=${scenario.inputs.length} player=${result.playerUnitId} -> ${outPath}\n`,
  )
  return 0
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`)
    process.exit(1)
  },
)
