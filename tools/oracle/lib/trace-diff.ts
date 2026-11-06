/**
 * Frame-level differential comparison of `d2oracle/1` traces
 * (docs/oracle/trace-schema.md): the original 1.13c game (oracle) versus
 * the TS server (replica).
 *
 * The comparison walks frames in ascending order and reports the FIRST
 * divergence (frame, unit type, unit id, field, both values) plus a short
 * window of preceding frames for the units involved. Later divergences are
 * usually consequences of the first one, so only the first is authoritative.
 */

export interface TraceHeader {
  schema: string
  source: string
  initSeed?: number
  dot?: boolean
  unitFields: string[]
  statIds: number[]
}

/** One unit row: unitFields values followed by stat values (t0/t1). */
export type UnitRow = (number | null)[]

/** One `SUNITDMG_ApplyDamage` (`0x6FCFC0B0`) event emitted in `dmg`. */
export interface TraceDmgEvent {
  att: [number, number]
  def: [number, number]
  hp: [number, number]
  ret: number
  raw: number[]
}

/** One `STATLIST_SetUnitStat` (`0x6FC9684A` / `0x6FC97D12`) `[type, id, hp0, hp1]` tick emitted in `dot`. */
export type TraceDotEvent = [number, number, number, number]

export interface TraceFrame {
  frame: number
  [unitKey: `t${number}`]: UnitRow[] | undefined
  gs?: [number, number]
  st?: number[][]
  dmg?: TraceDmgEvent[]
  dot?: TraceDotEvent[]
  in?: unknown[]
}

export interface Trace {
  header: TraceHeader
  frames: Map<number, TraceFrame>
}

export interface DiffOptions {
  /** Unit types to compare (default 0 players, 1 monsters, 3 missiles). */
  types?: number[]
  /** Unit fields to compare (default all except seeds, unless `compareSeeds` is true). */
  fields?: string[]
  /** Include `seedLo` and `seedHi` in the default field comparison (default false). */
  compareSeeds?: boolean
  /** Compare per-frame game seed `gs` when present on both sides (default true). */
  compareGameSeed?: boolean
  /** Compare per-frame active unit states `st` when present on both sides (default true). */
  compareStates?: boolean
  /** Compare per-frame `SUNITDMG_ApplyDamage` `dmg` events when present (default true). */
  compareDamage?: boolean
  /** Compare per-frame `stat 6` DoT / regen `dot` events when both headers advertise `dot: true` (default true). */
  compareDot?: boolean
  /** Stat ids to compare (default all stat ids present in both headers). */
  statIds?: number[]
  /** Absolute tolerance per field/stat name (default 0 = exact). */
  tolerance?: Record<string, number>
  /** Frames of context to include before the first divergence. */
  context?: number
  /** Only compare frames in [fromFrame, toFrame]. */
  fromFrame?: number
  toFrame?: number
}

export type DivergenceKind =
  | 'missing-frame'
  | 'missing-unit'
  | 'extra-unit'
  | 'field'
  | 'game-seed'
  | 'states'
  | 'damage'
  | 'dot'

export interface Divergence {
  frame: number
  kind: DivergenceKind
  type?: number
  unitId?: number
  field?: string
  oracle?: number | null | UnitRow | TraceDmgEvent | TraceDotEvent
  replica?: number | null | UnitRow | TraceDmgEvent | TraceDotEvent
  /** Rows of the involved unit in the preceding frames: [frame, oracleRow, replicaRow]. */
  context: [number, UnitRow | null, UnitRow | null][]
}

export interface DiffResult {
  /** Oracle columns the replica does not emit (not compared). */
  uncomparedFields: string[]
  comparedFrames: number
  firstDivergence: Divergence | null
  oracleFrames: number
  replicaFrames: number
}

const SEED_FIELDS = new Set(['seedLo', 'seedHi'])

export function parseTrace(text: string): Trace {
  let header: TraceHeader | null = null
  const frames = new Map<number, TraceFrame>()
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    let obj: Record<string, unknown>
    try {
      obj = JSON.parse(line) as Record<string, unknown>
    } catch {
      // A killed oracle run can leave a truncated last line.
      continue
    }
    if (typeof obj.schema === 'string') {
      header = obj as unknown as TraceHeader
      continue
    }
    if (typeof obj.frame === 'number') frames.set(obj.frame, obj as unknown as TraceFrame)
  }
  if (!header) throw new Error('trace has no d2oracle header line')
  if (header.schema !== 'd2oracle/1') throw new Error(`unsupported trace schema ${header.schema}`)
  return { header, frames }
}

interface ColumnPlan {
  name: string
  oracleIdx: number
  replicaIdx: number
}

function planColumns(a: TraceHeader, b: TraceHeader, opts: DiffOptions, withStats: boolean): ColumnPlan[] {
  // Default: every non-seed column both sides model (or including seeds when `compareSeeds` is true).
  const fields =
    opts.fields ??
    a.unitFields.filter((f) => (opts.compareSeeds || !SEED_FIELDS.has(f)) && b.unitFields.includes(f))
  const cols: ColumnPlan[] = []
  for (const f of fields) {
    if (f === 'id') continue
    const ia = a.unitFields.indexOf(f)
    const ib = b.unitFields.indexOf(f)
    if (ia < 0 || ib < 0) throw new Error(`field ${f} missing from ${ia < 0 ? 'oracle' : 'replica'} header`)
    cols.push({ name: f, oracleIdx: ia, replicaIdx: ib })
  }
  if (withStats) {
    const ids = opts.statIds ?? a.statIds.filter((s) => b.statIds.includes(s))
    for (const s of ids) {
      const ia = a.statIds.indexOf(s)
      const ib = b.statIds.indexOf(s)
      if (ia < 0 || ib < 0) throw new Error(`stat ${s} missing from ${ia < 0 ? 'oracle' : 'replica'} header`)
      cols.push({ name: `stat${s}`, oracleIdx: a.unitFields.length + ia, replicaIdx: b.unitFields.length + ib })
    }
  }
  return cols
}

function byId(rows: UnitRow[] | undefined, idIdx: number): Map<number, UnitRow> {
  const m = new Map<number, UnitRow>()
  for (const r of rows ?? []) m.set(r[idIdx] as number, r)
  return m
}

function unitRowAt(t: Trace, frame: number, type: number, id: number): UnitRow | null {
  const f = t.frames.get(frame)
  if (!f) return null
  const idIdx = t.header.unitFields.indexOf('id')
  return (f[`t${type}`] ?? []).find((r) => r[idIdx] === id) ?? null
}

function sameIntArray(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function sameDmgEvent(a: TraceDmgEvent, b: TraceDmgEvent): boolean {
  return (
    a.att[0] === b.att[0] &&
    a.att[1] === b.att[1] &&
    a.def[0] === b.def[0] &&
    a.def[1] === b.def[1] &&
    a.hp[0] === b.hp[0] &&
    a.hp[1] === b.hp[1] &&
    a.ret === b.ret &&
    sameIntArray(a.raw, b.raw)
  )
}

function statesMap(rows: readonly number[][] | undefined, allowedTypes: ReadonlySet<number>): Map<string, number[]> {
  const out = new Map<string, number[]>()
  for (const row of rows ?? []) {
    if (row.length < 2) continue
    const type = row[0]!
    const id = row[1]!
    if (!allowedTypes.has(type)) continue
    out.set(`${type}:${id}`, row.slice(2))
  }
  return out
}

export function diffTraces(oracle: Trace, replica: Trace, opts: DiffOptions = {}): DiffResult {
  const types = opts.types ?? [0, 1, 3]
  const allowedTypeSet = new Set(types)
  const ctxN = opts.context ?? 5
  const tol = opts.tolerance ?? {}
  const idA = oracle.header.unitFields.indexOf('id')
  const idB = replica.header.unitFields.indexOf('id')
  if (idA < 0 || idB < 0) throw new Error('trace header lacks an id column')
  const plans = new Map<number, ColumnPlan[]>()
  for (const t of types) plans.set(t, planColumns(oracle.header, replica.header, opts, t === 0 || t === 1))

  const frameNos = [...oracle.frames.keys()]
    .filter((f) => (opts.fromFrame === undefined || f >= opts.fromFrame) && (opts.toFrame === undefined || f <= opts.toFrame))
    .sort((x, y) => x - y)

  const context = (frame: number, type: number, id: number): Divergence['context'] => {
    const out: Divergence['context'] = []
    for (let f = Math.max(1, frame - ctxN); f < frame; f++) {
      out.push([f, unitRowAt(oracle, f, type, id), unitRowAt(replica, f, type, id)])
    }
    return out
  }

  const uncomparedFields = oracle.header.unitFields.filter((f) => !replica.header.unitFields.includes(f))
  let compared = 0
  for (const frame of frameNos) {
    const fa = oracle.frames.get(frame)!
    const fb = replica.frames.get(frame)
    if (!fb) {
      return {
        uncomparedFields,
        comparedFrames: compared,
        oracleFrames: oracle.frames.size,
        replicaFrames: replica.frames.size,
        firstDivergence: { frame, kind: 'missing-frame', context: [] },
      }
    }
    compared++
    for (const type of types) {
      const ra = byId(fa[`t${type}`], idA)
      const rb = byId(fb[`t${type}`], idB)
      const ids = [...new Set([...ra.keys(), ...rb.keys()])].sort((x, y) => x - y)
      for (const id of ids) {
        const a = ra.get(id)
        const b = rb.get(id)
        if (!a || !b) {
          return {
            uncomparedFields,
            comparedFrames: compared,
            oracleFrames: oracle.frames.size,
            replicaFrames: replica.frames.size,
            firstDivergence: {
              frame,
              kind: a ? 'missing-unit' : 'extra-unit',
              type,
              unitId: id,
              ...(a ? { oracle: a } : {}),
              ...(b ? { replica: b } : {}),
              context: context(frame, type, id),
            },
          }
        }
        for (const col of plans.get(type)!) {
          const va = a[col.oracleIdx] ?? null
          const vb = b[col.replicaIdx] ?? null
          if (va === null || vb === null) {
            if (va === vb) continue
            // A null on one side means "not modelled"; that is a divergence
            // unless the column was explicitly excluded by the caller.
          } else if (Math.abs(va - vb) <= (tol[col.name] ?? 0)) {
            continue
          }
          return {
            uncomparedFields,
            comparedFrames: compared,
            oracleFrames: oracle.frames.size,
            replicaFrames: replica.frames.size,
            firstDivergence: {
              frame,
              kind: 'field',
              type,
              unitId: id,
              field: col.name,
              oracle: va,
              replica: vb,
              context: context(frame, type, id),
            },
          }
        }
      }
    }

    if (opts.compareGameSeed !== false && fa.gs !== undefined && fb.gs !== undefined) {
      if (fa.gs[0] !== fb.gs[0] || fa.gs[1] !== fb.gs[1]) {
        return {
          uncomparedFields,
          comparedFrames: compared,
          oracleFrames: oracle.frames.size,
          replicaFrames: replica.frames.size,
          firstDivergence: {
            frame,
            kind: 'game-seed',
            field: 'gs',
            oracle: fa.gs,
            replica: fb.gs,
            context: [],
          },
        }
      }
    }

    if (opts.compareStates !== false && fa.st !== undefined && fb.st !== undefined) {
      const sa = statesMap(fa.st, allowedTypeSet)
      const sb = statesMap(fb.st, allowedTypeSet)
      const stateKeys = [...new Set([...sa.keys(), ...sb.keys()])].sort((ka, kb) => {
        const [ta, ia] = ka.split(':').map(Number)
        const [tb, ib] = kb.split(':').map(Number)
        return ta! - tb! || ia! - ib!
      })
      for (const key of stateKeys) {
        const oa = sa.get(key) ?? []
        const rb = sb.get(key) ?? []
        if (!sameIntArray(oa, rb)) {
          const [tNum, uId] = key.split(':').map(Number)
          return {
            uncomparedFields,
            comparedFrames: compared,
            oracleFrames: oracle.frames.size,
            replicaFrames: replica.frames.size,
            firstDivergence: {
              frame,
              kind: 'states',
              type: tNum!,
              unitId: uId!,
              field: 'st',
              oracle: oa,
              replica: rb,
              context: context(frame, tNum!, uId!),
            },
          }
        }
      }
    }

    const shouldCompareDmg =
      opts.compareDamage === true ||
      (opts.compareDamage !== false &&
        (fa.dmg !== undefined || ((fa.gs !== undefined || fa.st !== undefined) && fb.dmg !== undefined)))
    if (shouldCompareDmg) {
      const da = fa.dmg ?? []
      const db = fb.dmg ?? []
      const maxLen = Math.max(da.length, db.length)
      for (let k = 0; k < maxLen; k++) {
        const ea = da[k]
        const eb = db[k]
        if (!ea || !eb || !sameDmgEvent(ea, eb)) {
          return {
            uncomparedFields,
            comparedFrames: compared,
            oracleFrames: oracle.frames.size,
            replicaFrames: replica.frames.size,
            firstDivergence: {
              frame,
              kind: 'damage',
              field: `dmg[${k}]`,
              oracle: ea ?? null,
              replica: eb ?? null,
              context: [],
            },
          }
        }
      }
    }

    if (opts.compareDot !== false && Boolean(oracle.header.dot && replica.header.dot)) {
      const da = fa.dot ?? []
      const db = fb.dot ?? []
      const maxLen = Math.max(da.length, db.length)
      for (let k = 0; k < maxLen; k++) {
        const ea = da[k]
        const eb = db[k]
        if (!ea || !eb || !sameIntArray(ea, eb)) {
          return {
            uncomparedFields,
            comparedFrames: compared,
            oracleFrames: oracle.frames.size,
            replicaFrames: replica.frames.size,
            firstDivergence: {
              frame,
              kind: 'dot',
              ...(ea ? { type: ea[0], unitId: ea[1] } : eb ? { type: eb[0], unitId: eb[1] } : {}),
              field: `dot[${k}]`,
              oracle: ea ?? null,
              replica: eb ?? null,
              context: ea ? context(frame, ea[0], ea[1]) : eb ? context(frame, eb[0], eb[1]) : [],
            },
          }
        }
      }
    }
  }
  return {
    uncomparedFields,
    comparedFrames: compared,
    oracleFrames: oracle.frames.size,
    replicaFrames: replica.frames.size,
    firstDivergence: null,
  }
}

const TYPE_NAMES: Record<number, string> = { 0: 'player', 1: 'monster', 2: 'object', 3: 'missile', 4: 'item' }

export function formatDivergence(d: Divergence | null, oracleHdr: TraceHeader, replicaHdr: TraceHeader): string {
  if (!d) return 'no divergence'
  const who = d.type === undefined ? '' : ` ${TYPE_NAMES[d.type] ?? `type${d.type}`} #${d.unitId}`
  const lines = [`FIRST DIVERGENCE at frame ${d.frame}: ${d.kind}${who}`]
  if (d.kind === 'field') lines.push(`  field ${d.field}: oracle=${String(d.oracle)} replica=${String(d.replica)}`)
  else if (d.oracle || d.replica) lines.push(`  oracle=${JSON.stringify(d.oracle ?? null)} replica=${JSON.stringify(d.replica ?? null)}`)
  if (d.context.length) {
    lines.push(`  context (oracle cols: ${oracleHdr.unitFields.join(',')}; replica cols: ${replicaHdr.unitFields.join(',')}):`)
    for (const [f, a, b] of d.context) lines.push(`    f${f} oracle=${JSON.stringify(a)} replica=${JSON.stringify(b)}`)
  }
  return lines.join('\n')
}
