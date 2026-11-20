/**
 * d2oracle trace diff CLI.
 *
 *   npx tsx tools/oracle/diff.ts <oracle.ndjson> <replica.ndjson>
 *       [--types 0,1,3] [--fields x,y,mode] [--stats 6,7] [--tol x=1,stat6=256]
 *       [--from N] [--to N] [--context 5] [--json]
 *
 * Exit code 0 = identical over the compared range, 1 = divergence, 2 = usage.
 */
import { readFileSync } from 'node:fs'
import { diffTraces, formatDivergence, parseTrace, type DiffOptions } from './lib/trace-diff.ts'

function nums(v: string): number[] {
  return v.split(',').filter(Boolean).map((s) => {
    const n = Number(s)
    if (!Number.isInteger(n)) throw new Error(`not an integer: ${s}`)
    return n
  })
}

function main(argv: string[]): number {
  const pos: string[] = []
  const opts: DiffOptions = {}
  let json = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    const next = (): string => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`${a} needs a value`)
      return v
    }
    if (a === '--types') opts.types = nums(next())
    else if (a === '--fields') opts.fields = next().split(',').filter(Boolean)
    else if (a === '--seeds') opts.compareSeeds = true
    else if (a === '--no-gs') opts.compareGameSeed = false
    else if (a === '--no-states') opts.compareStates = false
    else if (a === '--no-dmg') opts.compareDamage = false
    else if (a === '--no-dot') opts.compareDot = false
    else if (a === '--stats') opts.statIds = nums(next())
    else if (a === '--from') opts.fromFrame = Number(next())
    else if (a === '--to') opts.toFrame = Number(next())
    else if (a === '--context') opts.context = Number(next())
    else if (a === '--tol') {
      const tol: Record<string, number> = {}
      for (const kv of next().split(',')) {
        const [k, v] = kv.split('=')
        if (!k || v === undefined) throw new Error(`bad --tol entry ${kv}`)
        tol[k] = Number(v)
      }
      opts.tolerance = tol
    } else if (a === '--json') json = true
    else if (a.startsWith('--')) throw new Error(`unknown flag ${a}`)
    else pos.push(a)
  }
  if (pos.length !== 2) {
    process.stderr.write('usage: diff.ts <oracle.ndjson> <replica.ndjson> [flags]\n')
    return 2
  }
  const oracle = parseTrace(readFileSync(pos[0]!, 'utf8'))
  const replica = parseTrace(readFileSync(pos[1]!, 'utf8'))
  const res = diffTraces(oracle, replica, opts)
  if (json) process.stdout.write(JSON.stringify(res, null, 2) + '\n')
  else {
    process.stdout.write(
      `compared ${res.comparedFrames} frames (oracle ${res.oracleFrames}, replica ${res.replicaFrames})\n` +
        (res.uncomparedFields.length ? `not modelled by replica (skipped): ${res.uncomparedFields.join(',')}\n` : '') +
        formatDivergence(res.firstDivergence, oracle.header, replica.header) +
        '\n',
    )
  }
  return res.firstDivergence ? 1 : 0
}

process.exitCode = main(process.argv.slice(2))
