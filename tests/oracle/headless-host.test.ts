import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { performance } from 'node:perf_hooks'
import { join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { isOracleToolchainAvailable113c } from '../../tools/oracle/fn-daemon.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../..')
const RUN_HEADLESS = join(REPO_ROOT, 'tools/oracle/run-headless-oracle.sh')
const MELEE_SCENARIO = join(REPO_ROOT, 'tests/fixtures/oracle/scenarios/a1-bloodmoor-melee.json')
const MELEE_GOLDEN = join(REPO_ROOT, 'tests/fixtures/oracle/golden/a1-bloodmoor-melee.oracle.ndjson.gz')
const FALLEN_SCENARIO = join(REPO_ROOT, 'tests/fixtures/oracle/scenarios/a1c-bloodmoor-fallen.json')
const FALLEN_GOLDEN = join(REPO_ROOT, 'tests/fixtures/oracle/golden/a1c-bloodmoor-fallen.oracle.ndjson.gz')
const DOT_SCENARIO = join(REPO_ROOT, 'tests/fixtures/oracle/scenarios/p52-dot-ticks.json')
const DOT_GOLDEN = join(REPO_ROOT, 'tests/fixtures/oracle/golden/p52-dot-ticks.oracle.ndjson.gz')

function sha256Hex(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex')
}

describe('Headless 1.13c Server Host (d2host-113c.exe, Plan §3.6.1)', () => {
  it('requires rootless Wine + headless oracle toolchain (never silently skips)', () => {
    expect(isOracleToolchainAvailable113c()).toBe(true)
    expect(existsSync(RUN_HEADLESS)).toBe(true)
  })

  it(
    'runs Plan §3.6.1 deliverable a1-bloodmoor-melee (1,800 frames) with 0/1,801 frame divergences, verified golden/headless SHA-256, and >300x simulation speedup',
    () => {
      expect(isOracleToolchainAvailable113c()).toBe(true)
      const workDir = mkdtempSync(join(tmpdir(), 'd2host-melee-'))
      try {
        const outTrace = join(workDir, 'melee.ndjson')
        const t0 = performance.now()
        const stdout = execFileSync('bash', [RUN_HEADLESS, MELEE_SCENARIO, outTrace], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          timeout: 60_000,
        })
        const wallMs = performance.now() - t0

        const metricsMatch = stdout.match(
          /frames=(\d+)\s+seed=(\d+)\s+diff=(\d+)\s+init_ms=([\d.]+)\s+sim_ms=([\d.]+)\s+total_ms=([\d.]+)\s+effective_fps=([\d.]+)/,
        )
        expect(metricsMatch).not.toBeNull()
        const frames = Number(metricsMatch![1])
        const initMs = Number(metricsMatch![4])
        const simMs = Number(metricsMatch![5])
        const totalMs = Number(metricsMatch![6])
        const effectiveFps = Number(metricsMatch![7])
        const simSpeedupVs25Fps = effectiveFps / 25.0

        expect(frames).toBe(1800)
        expect(simMs).toBeGreaterThan(0)
        expect(effectiveFps).toBeGreaterThan(7500) // > 300x vs 25 fps real-time

        const goldenBytes = gunzipSync(readFileSync(MELEE_GOLDEN))
        const headlessBytes = readFileSync(outTrace)
        const goldenSha = sha256Hex(goldenBytes)
        const headlessSha = sha256Hex(headlessBytes)

        // Checked-in Game.exe golden was captured prior to `d2oracle.c` top-level `dot` instrumentation;
        // verify BOTH exact SHA-256 digests and prove 0/1,801 semantic frame divergences!
        expect(goldenSha).toBe('c80572bc15aab32cb2d88974df4d560bffc2d5ee41a5581bb08e2d9fc7b90c66')
        expect(headlessSha).toBe('395eea4595d5947f8e16560bd74f18b989da7605911cc6fb1c4e3b7e3b12f6f4')

        const goldenLines = goldenBytes
          .toString('utf8')
          .split('\n')
          .filter((l) => l.trim().length > 0)
        const headlessLines = headlessBytes
          .toString('utf8')
          .split('\n')
          .filter((l) => l.trim().length > 0)

        expect(headlessLines.length).toBe(1801)
        expect(goldenLines.length).toBe(1801)

        const dotDiffIndices: number[] = []
        for (let i = 0; i < goldenLines.length; i++) {
          if (headlessLines[i] !== goldenLines[i]) {
            dotDiffIndices.push(i)
            const gObj = JSON.parse(goldenLines[i]!) as Record<string, unknown>
            const hObj = JSON.parse(headlessLines[i]!) as Record<string, unknown>
            expect('dot' in hObj).toBe(true)
            expect('dot' in gObj).toBe(false)
            delete hObj.dot
            expect(hObj).toEqual(gObj)
          }
        }
        // Only header 0 + poison ticks 1087..1105 carry top-level `dot`; all other 1,781 lines are raw `===`
        expect(dotDiffIndices).toEqual([
          0, 1087, 1088, 1089, 1090, 1091, 1092, 1093, 1094, 1095,
          1096, 1097, 1098, 1099, 1100, 1101, 1102, 1103, 1104, 1105,
        ])

        console.log(
          `[headless-host] a1-bloodmoor-melee: init_ms=${initMs.toFixed(2)} sim_ms=${simMs.toFixed(2)} total_ms=${totalMs.toFixed(2)} wall_ms=${wallMs.toFixed(2)} effective_fps=${effectiveFps.toFixed(1)} (${simSpeedupVs25Fps.toFixed(1)}x vs 25fps) golden_sha=${goldenSha.slice(0, 12)} headless_sha=${headlessSha.slice(0, 12)}`,
        )
      } finally {
        rmSync(workDir, { recursive: true, force: true })
      }
    },
    60_000,
  )

  it(
    'reproduces all 2,001 lines (header + 2,000 frames) of a1c-bloodmoor-fallen byte-for-byte identically to the Game.exe golden trace',
    () => {
      expect(isOracleToolchainAvailable113c()).toBe(true)
      const workDir = mkdtempSync(join(tmpdir(), 'd2host-fallen-'))
      try {
        const outTrace = join(workDir, 'fallen.ndjson')
        const stdout = execFileSync('bash', [RUN_HEADLESS, FALLEN_SCENARIO, outTrace], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          timeout: 60_000,
        })
        expect(stdout).toContain('frames=2000')

        const goldenBytes = gunzipSync(readFileSync(FALLEN_GOLDEN))
        const headlessBytes = readFileSync(outTrace)
        expect(sha256Hex(headlessBytes)).toBe(sha256Hex(goldenBytes))

        const goldenLines = goldenBytes
          .toString('utf8')
          .split('\n')
          .filter((l) => l.trim().length > 0)
        const headlessLines = headlessBytes
          .toString('utf8')
          .split('\n')
          .filter((l) => l.trim().length > 0)

        expect(headlessLines.length).toBe(2001)
        for (let i = 0; i < goldenLines.length; i++) {
          expect(headlessLines[i]).toBe(goldenLines[i])
        }
      } finally {
        rmSync(workDir, { recursive: true, force: true })
      }
    },
    60_000,
  )

  it(
    'reproduces all 1,201 lines (header + 1,200 frames, including dot ticks) of p52-dot-ticks byte-for-byte identically to the Game.exe golden trace',
    () => {
      expect(isOracleToolchainAvailable113c()).toBe(true)
      const workDir = mkdtempSync(join(tmpdir(), 'd2host-dot-'))
      try {
        const outTrace = join(workDir, 'dot.ndjson')
        const stdout = execFileSync('bash', [RUN_HEADLESS, DOT_SCENARIO, outTrace], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          timeout: 60_000,
        })
        expect(stdout).toContain('frames=1200')

        const goldenBytes = gunzipSync(readFileSync(DOT_GOLDEN))
        const headlessBytes = readFileSync(outTrace)
        expect(sha256Hex(headlessBytes)).toBe(sha256Hex(goldenBytes))

        const goldenLines = goldenBytes
          .toString('utf8')
          .split('\n')
          .filter((l) => l.trim().length > 0)
        const headlessLines = headlessBytes
          .toString('utf8')
          .split('\n')
          .filter((l) => l.trim().length > 0)

        expect(headlessLines.length).toBe(1201)
        for (let i = 0; i < goldenLines.length; i++) {
          expect(headlessLines[i]).toBe(goldenLines[i])
        }
      } finally {
        rmSync(workDir, { recursive: true, force: true })
      }
    },
    60_000,
  )

  it(
    'supports oracleFnRec, oracleOrderLog, and oracleMemDump hooks in headless mode',
    () => {
      expect(isOracleToolchainAvailable113c()).toBe(true)
      const workDir = mkdtempSync(join(tmpdir(), 'd2host-hooks-'))
      try {
        const baseScenario = JSON.parse(readFileSync(FALLEN_SCENARIO, 'utf8')) as Record<string, unknown>
        const customScenario = {
          ...baseScenario,
          frames: 792,
          oracleFnRec: [['timers', 789, 791]],
          oracleOrderLog: [789, 791],
          oracleMemDump: [[790, 1, 9]],
        }
        const scnPath = join(workDir, 'hooks-scenario.json')
        const outTrace = join(workDir, 'hooks.ndjson')
        writeFileSync(scnPath, JSON.stringify(customScenario))

        execFileSync('bash', [RUN_HEADLESS, scnPath, outTrace], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          timeout: 60_000,
        })

        const lines = readFileSync(outTrace, 'utf8')
          .split('\n')
          .filter((l) => l.trim().length > 0)
        expect(lines.length).toBe(793)

        const f790 = JSON.parse(lines[790]!) as {
          frame: number
          ord?: unknown[]
          mem?: Array<{ type: number; id: number; blocks: unknown[] }>
        }
        expect(f790.frame).toBe(790)
        expect(Array.isArray(f790.ord)).toBe(true)
        expect(f790.ord!.length).toBeGreaterThan(0)
        expect(Array.isArray(f790.mem)).toBe(true)
        expect(f790.mem![0]?.blocks.length).toBeGreaterThan(0)

        const fnrecPath = join(`${outTrace}.d`, 'fnrec.ndjson')
        expect(existsSync(fnrecPath)).toBe(true)
        const fnrecLines = readFileSync(fnrecPath, 'utf8')
          .split('\n')
          .filter((l) => l.trim().length > 0)
        expect(fnrecLines.length).toBe(3)
      } finally {
        rmSync(workDir, { recursive: true, force: true })
      }
    },
    60_000,
  )
})
