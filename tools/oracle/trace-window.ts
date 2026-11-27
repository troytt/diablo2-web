/**
 * Divergence microscope for the oracle parity ratchet.
 *
 *   npx tsx tools/oracle/trace-window.ts <scenario> [--frame F] [--unit T:ID]... [--before N] [--after N]
 *
 * Replays one golden scenario on the replica and prints, around the first parity divergence (or
 * `--frame F`):
 *
 * 1. The FIRST SEED divergence over the whole run: the earliest frame where the game seed `gs` or
 *    any unit's `D2SeedStrc` differs between oracle and replica. The parity ratchet does not compare
 *    unit seeds, so an extra/missing RNG draw usually shows up here many frames before it changes a
 *    mode or a position.
 * 2. Per frame and per watched unit: oracle vs replica `mode`, position, HP and the number of LCG
 *    draws taken from the unit seed during that frame (recovered offline by stepping the 1.13c LCG
 *    from the previous frame's seed, so it also counts draws the original inlines).
 * 3. Every replica draw in the window with its kind (`R`/`L`/`P`/inline `i`), argument, result and
 *    the replica call site, so "oracle drew 1, replica drew 0" points straight at the code path.
 * 4. The replica `D2DynamicPathStrc` of each watched player/monster after every window frame.
 *
 * Diagnostics only: the hooks never change the simulation (the sink only reads seeds).
 */
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { setD2SeedTraceSink, type D2SeedStrc, type D2SeedTraceSink } from '../../src/common/rng/d2-rng.ts'
import type { GameInstanceHost } from '../../src/server/engine/game-instance/host.ts'
import { loadReplicaEnvironment, loadScenarioFile, runReplica } from './lib/replica.ts'
import { diffTraces, formatDivergence, parseTrace, type Trace, type UnitRow } from './lib/trace-diff.ts'
import { GOLDEN_DIR, PARITY_DIFF_OPTIONS, REPO, SCENARIO_DIR } from './parity-report.ts'

const LCG_MUL = 0x6ac690c5n
const MASK32 = 0xffffffffn
/** Upper bound for the per-frame draw search; anything above is reported as a re-seed. */
const MAX_DRAWS = 256

/** Number of 1.13c LCG steps from `prev` to `cur` (0..MAX_DRAWS), or -1 when `cur` is unreachable. */
export function countDraws(prev: readonly [number, number], cur: readonly [number, number]): number {
  let lo = BigInt(prev[0] >>> 0)
  let hi = BigInt(prev[1] >>> 0)
  const tLo = BigInt(cur[0] >>> 0)
  const tHi = BigInt(cur[1] >>> 0)
  for (let n = 0; n <= MAX_DRAWS; n++) {
    if (lo === tLo && hi === tHi) return n
    const v = lo * LCG_MUL + hi
    lo = v & MASK32
    hi = v >> 32n
  }
  return -1
}

interface Args {
  scenario: string
  frame: number | null
  units: { type: number; id: number }[]
  before: number
  after: number
}

function parseArgs(argv: readonly string[]): Args {
  const a: Args = { scenario: '', frame: null, units: [], before: 6, after: 2 }
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i]!
    const next = (): string => {
      const n = argv[++i]
      if (n === undefined) throw new Error(`${v} needs a value`)
      return n
    }
    if (v === '--frame') a.frame = Number(next())
    else if (v === '--before') a.before = Number(next())
    else if (v === '--after') a.after = Number(next())
    else if (v === '--unit') {
      const m = /^(\d+):(\d+)$/.exec(next())
      if (!m) throw new Error('--unit expects TYPE:ID, e.g. 1:9')
      a.units.push({ type: Number(m[1]), id: Number(m[2]) })
    } else if (!a.scenario) a.scenario = v
    else throw new Error(`unexpected argument ${v}`)
  }
  if (!a.scenario) throw new Error('usage: trace-window.ts <scenario> [--frame F] [--unit T:ID]... [--before N] [--after N]')
  return a
}

interface Cols {
  id: number
  mode: number
  x: number
  y: number
  seedLo: number
  seedHi: number
  hp: number
}

function cols(t: Trace): Cols {
  const f = t.header.unitFields
  const hpStat = t.header.statIds.indexOf(6)
  return {
    id: f.indexOf('id'),
    mode: f.indexOf('mode'),
    x: f.indexOf('x'),
    y: f.indexOf('y'),
    seedLo: f.indexOf('seedLo'),
    seedHi: f.indexOf('seedHi'),
    hp: hpStat < 0 ? -1 : f.length + hpStat,
  }
}

function row(t: Trace, c: Cols, frame: number, type: number, id: number): UnitRow | null {
  return (t.frames.get(frame)?.[`t${type}`] ?? []).find((r) => r[c.id] === id) ?? null
}

function seedOf(r: UnitRow | null, c: Cols): [number, number] | null {
  if (!r) return null
  const lo = r[c.seedLo]
  const hi = r[c.seedHi]
  return typeof lo === 'number' && typeof hi === 'number' ? [lo, hi] : null
}

function draws(prev: [number, number] | null | undefined, cur: [number, number] | null | undefined): string {
  if (!prev || !cur) return '-'
  const n = countDraws(prev, cur)
  return n < 0 ? 'reseed' : String(n)
}

/** Earliest frame where `gs` or any common unit seed differs (types 0, 1, 3). */
function firstSeedDivergence(o: Trace, r: Trace, fromFrame: number): string | null {
  const co = cols(o)
  const cr = cols(r)
  const frames = [...o.frames.keys()].filter((f) => f >= fromFrame).sort((a, b) => a - b)
  for (const f of frames) {
    const fo = o.frames.get(f)!
    const fr = r.frames.get(f)
    if (!fr) return `F=${f}: replica has no frame`
    if (fo.gs && fr.gs && (fo.gs[0] !== fr.gs[0] || fo.gs[1] !== fr.gs[1])) {
      const po = o.frames.get(f - 1)?.gs
      const pr = r.frames.get(f - 1)?.gs
      return `F=${f}: gs oracle=[${fo.gs.join(',')}] (draws ${draws(po, fo.gs)}) replica=[${fr.gs.join(',')}] (draws ${draws(pr, fr.gs)})`
    }
    for (const type of [0, 1, 3]) {
      for (const ro of fo[`t${type}`] ?? []) {
        const id = ro[co.id] as number
        const rr = row(r, cr, f, type, id)
        const so = seedOf(ro, co)
        const sr = seedOf(rr, cr)
        if (!so || !sr || (so[0] === sr[0] && so[1] === sr[1])) continue
        const po = seedOf(row(o, co, f - 1, type, id), co)
        const pr = seedOf(row(r, cr, f - 1, type, id), cr)
        return (
          `F=${f}: unit ${type}:${id} seed oracle=[${so.join(',')}] (draws ${draws(po, so)}) ` +
          `replica=[${sr.join(',')}] (draws ${draws(pr, sr)})`
        )
      }
    }
  }
  return null
}

interface RollRecord {
  owner: string
  kind: string
  arg: number
  result: number
  site: string
}

const SKIP_FRAMES = ['d2-rng.ts', 'trace-window.ts', 'node:internal', 'unit-seeds-113c.ts:13']

/** First two stack frames outside the RNG helpers, as `file:line fn`. */
function callSite(): string {
  const stack = (new Error().stack ?? '').split('\n').slice(1)
  const out: string[] = []
  for (const line of stack) {
    if (SKIP_FRAMES.some((s) => line.includes(s))) continue
    const m = /at (?:(\S+) \()?(?:file:\/\/)?([^()]+):(\d+):\d+\)?$/.exec(line.trim())
    if (!m) continue
    out.push(`${relative(REPO, m[2]!)}:${m[3]} ${m[1] ?? '<anon>'}`)
    if (out.length === 2) break
  }
  return out.join(' <- ')
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const scenario = loadScenarioFile(join(SCENARIO_DIR, `${args.scenario}.json`))
  const oracle = parseTrace(
    gunzipSync(readFileSync(join(GOLDEN_DIR, `${args.scenario}.oracle.ndjson.gz`))).toString('utf8'),
  )
  const env = await loadReplicaEnvironment({ packsDir: process.env.D2_ACT_PACKS_DIR ?? 'public/act-packs/tiles' })

  // Pass 1: plain replica run to locate the divergence (unless --frame is given).
  let focus = args.frame
  let units = [...args.units]
  let replica = parseTrace(runReplica(scenario, env, { repoRoot: REPO }).lines.join('\n'))
  const diff = diffTraces(oracle, replica, PARITY_DIFF_OPTIONS)
  const d = diff.firstDivergence
  process.stdout.write(`== ${args.scenario}: first parity divergence ==\n`)
  process.stdout.write(`${formatDivergence(d, oracle.header, replica.header).split('\n').slice(0, 2).join('\n')}\n`)
  process.stdout.write(`== first seed divergence ==\n${firstSeedDivergence(oracle, replica, PARITY_DIFF_OPTIONS.fromFrame ?? 2) ?? 'none'}\n`)
  if (focus === null) {
    if (!d) {
      process.stdout.write('full match, nothing to inspect (pass --frame)\n')
      return
    }
    focus = d.frame
  }
  if (units.length === 0 && d?.type !== undefined && d.unitId !== undefined) units = [{ type: d.type, id: d.unitId }]
  const from = Math.max(2, focus - args.before)
  const to = focus + args.after

  // Pass 2: same run with the roll sink and path probes active inside the window.
  const rolls = new Map<number, RollRecord[]>()
  const paths = new Map<number, Map<string, unknown>>()
  let curFrame = 0
  let host: GameInstanceHost | null = null
  const ownerOf = (seed: D2SeedStrc): string => {
    if (!host) return '?'
    if (seed === host.gameSeed) return 'gs'
    for (const [k, v] of host.unitSeeds) if (v === seed) return k
    return seed.label ?? 'anon'
  }
  const record = (seed: D2SeedStrc, kind: string, arg: number, result: number): void => {
    if (curFrame < from || curFrame > to) return
    const list = rolls.get(curFrame) ?? []
    list.push({ owner: ownerOf(seed), kind, arg, result, site: callSite() })
    rolls.set(curFrame, list)
  }
  const sink: D2SeedTraceSink = {
    init: () => {},
    roll: (seed, kind, arg, result) => record(seed, kind, arg, result),
    inline: (seed) => record(seed, 'i', 0, seed.lo >>> 0),
  }
  setD2SeedTraceSink(sink)
  try {
    replica = parseTrace(
      runReplica(scenario, env, {
        repoRoot: REPO,
        beforeFrame: (f, game) => {
          curFrame = f
          host = game as unknown as GameInstanceHost
        },
        afterFrame: (f, game) => {
          if (f < from || f > to) return
          const h = game as unknown as GameInstanceHost
          const m = new Map<string, unknown>()
          for (const u of units) m.set(`${u.type}:${u.id}`, h.areaPathWorld.describeUnitPath113c(u.type, u.id))
          paths.set(f, m)
        },
      }).lines.join('\n'),
    )
  } finally {
    setD2SeedTraceSink(null)
  }

  const co = cols(oracle)
  const cr = cols(replica)
  const watched = new Set(units.map((u) => `${u.type}:${u.id}`))
  process.stdout.write(`== window F=${from}..${to} (focus ${focus}), units ${[...watched].join(' ') || '(none)'} ==\n`)
  for (let f = from; f <= to; f++) {
    const fo = oracle.frames.get(f)
    const fr = replica.frames.get(f)
    const gsO = draws(oracle.frames.get(f - 1)?.gs, fo?.gs)
    const gsR = draws(replica.frames.get(f - 1)?.gs, fr?.gs)
    process.stdout.write(`F=${f}${f === focus ? '  <== focus' : ''}\n`)
    process.stdout.write(`  gs     draws O=${gsO} R=${gsR}${gsO !== gsR ? '   <-- DIFF' : ''}\n`)
    for (const u of units) {
      const ro = row(oracle, co, f, u.type, u.id)
      const rr = row(replica, cr, f, u.type, u.id)
      const fmt = (r: UnitRow | null, c: Cols): string =>
        r ? `m=${r[c.mode]} (${r[c.x]},${r[c.y]})${c.hp >= 0 ? ` hp=${r[c.hp]}` : ''}` : 'absent'
      const dO = draws(seedOf(row(oracle, co, f - 1, u.type, u.id), co), seedOf(ro, co))
      const dR = draws(seedOf(row(replica, cr, f - 1, u.type, u.id), cr), seedOf(rr, cr))
      const same = fmt(ro, co) === fmt(rr, cr) && dO === dR
      process.stdout.write(
        `  ${`${u.type}:${u.id}`.padEnd(6)} O ${fmt(ro, co)} draws=${dO} | R ${fmt(rr, cr)} draws=${dR}${same ? '' : '   <-- DIFF'}\n`,
      )
      const p = paths.get(f)?.get(`${u.type}:${u.id}`)
      if (p) process.stdout.write(`         R path ${JSON.stringify(p)}\n`)
    }
    for (const r of rolls.get(f) ?? []) {
      // Outside the focus frame only the watched units' and the game seed's draws are listed.
      if (f !== focus && watched.size > 0 && r.owner !== 'gs' && !watched.has(r.owner)) continue
      process.stdout.write(`    R roll ${r.owner.padEnd(6)} ${r.kind}(${r.arg})=${r.result}  @ ${r.site}\n`)
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
