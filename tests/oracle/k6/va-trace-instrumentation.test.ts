/**
 * Enforces that all manifest-bound D2Common/D2Game kernel functions in `src/d2kern-113c/`
 * carry exact entry-point VA trace instrumentation (`instrument-va-trace.py --check`).
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO_ROOT_113C } from '../../../tools/oracle/kern-replay/replay-113c.ts'

describe('[K6] VA trace instrumentation integrity gate', () => {
  it('passes tools/oracle/callgraph/instrument-va-trace.py --check with zero drift', () => {
    const out = execFileSync(
      'python3',
      [join(REPO_ROOT_113C, 'tools/oracle/callgraph/instrument-va-trace.py'), '--check'],
      { cwd: REPO_ROOT_113C, encoding: 'utf8' },
    )
    expect(out).toContain('[instrument-va-trace] CHECK OK')
  })
})
