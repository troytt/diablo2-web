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
  seedOverride?: number
  dot?: boolean
  s2c?: boolean
  unitFields: string[]
  itemFields?: string[]
  statIds: number[]
}

/** One unit row: unitFields values followed by stat values (t0/t1), or itemFields + flat [statId, param, value] triples (t4). */
export type UnitRow = (number | null)[]

/** Canonical 30 scalar columns emitted by `d2oracle.c` `dump_items` before trailing `[statId, param, value]` triples. */
export const ORACLE_ITEM_FIELDS_113C = [
  'id',
  'class',
  'mode',
  'x',
  'y',
  'seedLo',
  'seedHi',
  'itemSeedLo',
  'itemSeedHi',
  'initSeed',
  'ownerId',
  'quality',
  'ilvl',
  'itemFlags',
  'cmdFlags',
  'fileIndex',
  'itemFormat',
  'rarePrefix',
  'rareSuffix',
  'autoPrefix',
  'magicPrefix0',
  'magicPrefix1',
  'magicPrefix2',
  'magicSuffix0',
  'magicSuffix1',
  'magicSuffix2',
  'bodyLoc',
  'itemPage',
  'earLevel',
  'invGfxIdx',
] as const

export interface ParsedItemStat {
  readonly statId: number
  readonly param: number
  readonly value: number
}

export interface ParsedItemRow {
  readonly fields: Record<string, number | null>
  readonly stats: ParsedItemStat[]
}

/** Parses one `t4` item tuple using `header.itemFields` + trailing `[statId, param, value]` stat triples. */
export function parseItemRow(row: readonly (number | null)[], itemFields: readonly string[]): ParsedItemRow {
  const fields: Record<string, number | null> = {}
  for (let i = 0; i < itemFields.length; i++) {
    fields[itemFields[i]!] = row[i] ?? null
  }
  const stats: ParsedItemStat[] = []
  for (let i = itemFields.length; i + 2 < row.length; i += 3) {
    stats.push({
      statId: Number(row[i] ?? 0),
      param: Number(row[i + 1] ?? 0),
      value: Number(row[i + 2] ?? 0),
    })
  }
  return { fields, stats }
}

export interface ItemOrS2cDiff {
  readonly key: 't4' | 's2c'
  readonly id: number | null
  readonly field: string
  readonly expected: unknown
  readonly actual: unknown
}

const ITEM_POS_FIELDS = new Set(['id', 'class', 'mode', 'x', 'y'])

/**
 * Pure frame-level `t4` item comparator reusable by `replay-113c` (`diffFrame113c`) and tests.
 * Compares item presence by `id`, scalar `itemFields`, and (under `'strict'`) trailing `[statId, param, value]` triples.
 */
export function diffItemFrameRows(
  goldenRows: readonly UnitRow[] | undefined,
  actualRows: readonly UnitRow[] | undefined,
  itemFields: readonly string[],
  policy: 'strict' | 'pos' = 'strict',
): ItemOrS2cDiff | null {
  if (goldenRows === undefined) return null
  if (actualRows === undefined) {
    return { key: 't4', id: null, field: 'list', expected: goldenRows.length, actual: null }
  }
  const idIdx = Math.max(0, itemFields.indexOf('id'))
  const actualById = new Map<number, UnitRow>()
  for (const row of actualRows) actualById.set(row[idIdx] as number, row)
  const goldIds = new Set<number>()
  for (const grow of goldenRows) {
    const id = grow[idIdx] as number
    goldIds.add(id)
    const arow = actualById.get(id)
    if (arow === undefined) {
      return { key: 't4', id, field: 'presence', expected: grow, actual: null }
    }
    for (let c = 0; c < itemFields.length; c++) {
      const name = itemFields[c]!
      if (policy === 'pos' && !ITEM_POS_FIELDS.has(name)) continue
      if (grow[c] !== arow[c]) {
        return { key: 't4', id, field: name, expected: grow[c], actual: arow[c] }
      }
    }
    if (policy === 'strict') {
      const gStats = parseItemRow(grow, itemFields).stats
      const aStats = parseItemRow(arow, itemFields).stats
      const maxStats = Math.max(gStats.length, aStats.length)
      for (let s = 0; s < maxStats; s++) {
        const gs = gStats[s] ?? null
        const as = aStats[s] ?? null
        if (!gs || !as || gs.statId !== as.statId || gs.param !== as.param || gs.value !== as.value) {
          const label = gs ? `stat(${gs.statId}:${gs.param})` : as ? `stat(${as.statId}:${as.param})` : `stat[${s}]`
          return { key: 't4', id, field: label, expected: gs, actual: as }
        }
      }
    }
  }
  for (const row of actualRows) {
    const id = row[idIdx] as number
    if (!goldIds.has(id)) {
      return { key: 't4', id, field: 'presence', expected: null, actual: row }
    }
  }
  return null
}

/**
 * Pure frame-level `s2c` uncompressed packet list comparator reusable by `replay-113c` (`diffFrame113c`) and tests.
 */
function normalizeS2cUninitPadBytes(hex: string | null): string | null {
  if (hex === null) return null
  // D2Game.dll@0x6FCAD5F0..0x6FCAD661 (NET_SendPacket21_UpdateUnitSkill) writes only
  // bytes [0..10] of the 12-byte stack buffer before queueing 0x0C bytes via 0x6FCAA3E0;
  // byte [11] (chars 22..23) is an uninitialized MSVC stack-frame padding byte.
  if (hex.length === 24 && hex.startsWith('21')) {
    return `${hex.slice(0, 22)}00`
  }
  // D2Game.dll@0x6FCAD040..0x6FCAD10B (NET_SendPacket82_PortalOwnerInfo) writes bytes [5..N]
  // of the 16-byte owner name buffer via Storm#501 (SStrCopy) without zeroing trailing bytes
  // between the first NUL byte and offset 21 (`dwPortalGuid`).
  if (hex.length === 58 && hex.startsWith('82')) {
    let nulCharEnd = 42
    for (let pos = 10; pos < 42; pos += 2) {
      if (hex.slice(pos, pos + 2) === '00') {
        nulCharEnd = pos + 2
        break
      }
    }
    if (nulCharEnd < 42) {
      return `${hex.slice(0, nulCharEnd)}${'0'.repeat(42 - nulCharEnd)}${hex.slice(42)}`
    }
  }
  // D2Game.dll@0x6FC68CCC..0x6FC68D02, 0x6FC54BA0..0x6FC54BE4, and 0x6FC5594D..0x6FC5598F
  // (D2GSPacketSrv27, 40 bytes) write byte[0]=0x27, byte[1]=unitType, dword[2..5]=unitGuid,
  // byte[6]=nCount (0..8), leaving byte[7] (_pad7) uninitialized; for each 4-byte entry i=0..7
  // at offset 8+4*i, i < nCount writes byte[+0]=nType and word[+2..3]=wStringId leaving byte[+1]
  // (_pad1) uninitialized, and i >= nCount leaves all 4 bytes (+0..+3) uninitialized.
  if (hex.length === 80 && hex.startsWith('27')) {
    const nCount = Math.min(8, parseInt(hex.slice(12, 14), 16))
    let out = `${hex.slice(0, 14)}00`
    for (let i = 0; i < 8; i++) {
      const off = 16 + i * 8
      if (i < nCount) {
        out += `${hex.slice(off, off + 2)}00${hex.slice(off + 4, off + 8)}`
      } else {
        out += '00000000'
      }
    }
    return out
  }
  // D2Game.dll@0x6FC78A40..0x6FC78AD8 (ACT5Q3_SendPacket50_24) allocates 0x20 stack bytes,
  // writes byte[0]=0x50, word[1..2]=0x0024, word[3..4]=wQuestVal, and queues 0x0F bytes via
  // 0x6FCAA3E0, leaving bytes[5..14] (chars 10..29) as uninitialized MSVC stack bytes.
  if (hex.length === 30 && hex.startsWith('502400')) {
    return `${hex.slice(0, 10)}00000000000000000000`
  }
  // D2Game.dll@0x6FC9ACB0..0x6FC9AD85 -> 0x6FCAB470..0x6FCAB526 (SUNIT_SendHoverMsgOrClearPacketToClient,
  // S2C 0x26 nType=0x05 overhead message): writes byte[0]=0x26, byte[1]=0x05, byte[2]=bUsed,
  // byte[3]=bUnitType, dword[4..7]=dwUnitId, byte[10]=0x00 (empty szNick), and szMessage at byte[11..],
  // never initializing bytes[8..9] (wNameId, chars 16..19) on its 0x12c MSVC stack frame.
  if (hex.length >= 24 && hex.startsWith('2605')) {
    return `${hex.slice(0, 16)}0000${hex.slice(20)}`
  }
  return hex
}

export function diffS2cFramePackets(
  goldenPkts: readonly string[] | undefined,
  actualPkts: readonly string[] | undefined,
): ItemOrS2cDiff | null {
  if (goldenPkts === undefined) return null
  if (actualPkts === undefined) {
    return { key: 's2c', id: null, field: 'list', expected: goldenPkts.length, actual: null }
  }
  const maxLen = Math.max(goldenPkts.length, actualPkts.length)
  for (let i = 0; i < maxLen; i++) {
    const gp = normalizeS2cUninitPadBytes(goldenPkts[i]?.toLowerCase() ?? null)
    const ap = normalizeS2cUninitPadBytes(actualPkts[i]?.toLowerCase() ?? null)
    if (gp !== ap) {
      return { key: 's2c', id: null, field: `s2c[${i}]`, expected: goldenPkts[i] ?? null, actual: actualPkts[i] ?? null }
    }
  }
  return null
}

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
  t4?: UnitRow[]
  gs?: [number, number]
  st?: number[][]
  s2c?: string[]
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
  /** Compare per-frame `t4` item units (and trailing stat triples) when both headers advertise `itemFields` (default true). */
  compareItems?: boolean
  /** Item scalar fields to compare in `t4` (default all shared `itemFields` except item seed columns unless `compareSeeds` is true). */
  itemFields?: string[]
  /** Compare per-frame uncompressed `s2c` packets when both headers advertise `s2c: true` (default true). */
  compareS2c?: boolean
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
  | 'item-stats'
  | 'game-seed'
  | 'states'
  | 'damage'
  | 'dot'
  | 's2c'

export interface Divergence {
  frame: number
  kind: DivergenceKind
  type?: number
  unitId?: number
  field?: string
  oracle?: number | string | null | UnitRow | TraceDmgEvent | TraceDotEvent | ParsedItemStat
  replica?: number | string | null | UnitRow | TraceDmgEvent | TraceDotEvent | ParsedItemStat
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
const ITEM_SEED_FIELDS = new Set(['seedLo', 'seedHi', 'itemSeedLo', 'itemSeedHi', 'initSeed'])

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
  const cols = type === 4 && t.header.itemFields ? t.header.itemFields : t.header.unitFields
  const idIdx = cols.indexOf('id')
  return (f[`t${type}`] ?? []).find((r) => r[idIdx] === id) ?? null
}

function planItemColumns(aFields: readonly string[], bFields: readonly string[], opts: DiffOptions): ColumnPlan[] {
  const fields =
    opts.itemFields ??
    aFields.filter((f) => (opts.compareSeeds || !ITEM_SEED_FIELDS.has(f)) && bFields.includes(f))
  const cols: ColumnPlan[] = []
  for (const f of fields) {
    if (f === 'id') continue
    const ia = aFields.indexOf(f)
    const ib = bFields.indexOf(f)
    if (ia < 0 || ib < 0) throw new Error(`item field ${f} missing from ${ia < 0 ? 'oracle' : 'replica'} header`)
    cols.push({ name: f, oracleIdx: ia, replicaIdx: ib })
  }
  return cols
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
  const hasItemSchema = Boolean(oracle.header.itemFields && replica.header.itemFields)
  const rawTypes = opts.types ?? [0, 1, 3]
  const types = hasItemSchema ? rawTypes.filter((t) => t !== 4) : rawTypes
  const shouldCompareItems =
    hasItemSchema && (opts.compareItems === true || (opts.compareItems !== false && (opts.types === undefined || rawTypes.includes(4))))
  const allowedTypeSet = new Set(rawTypes)
  const ctxN = opts.context ?? 5
  const tol = opts.tolerance ?? {}
  const idA = oracle.header.unitFields.indexOf('id')
  const idB = replica.header.unitFields.indexOf('id')
  if (idA < 0 || idB < 0) throw new Error('trace header lacks an id column')
  const plans = new Map<number, ColumnPlan[]>()
  for (const t of types) plans.set(t, planColumns(oracle.header, replica.header, opts, t === 0 || t === 1))
  const itemPlan = shouldCompareItems ? planItemColumns(oracle.header.itemFields!, replica.header.itemFields!, opts) : null
  const itemIdA = shouldCompareItems ? oracle.header.itemFields!.indexOf('id') : -1
  const itemIdB = shouldCompareItems ? replica.header.itemFields!.indexOf('id') : -1
  if (shouldCompareItems && (itemIdA < 0 || itemIdB < 0)) throw new Error('trace itemFields lacks an id column')

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

    if (shouldCompareItems && itemPlan) {
      const ra = byId(fa.t4, itemIdA)
      const rb = byId(fb.t4, itemIdB)
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
              type: 4,
              unitId: id,
              ...(a ? { oracle: a } : {}),
              ...(b ? { replica: b } : {}),
              context: context(frame, 4, id),
            },
          }
        }
        for (const col of itemPlan) {
          const va = a[col.oracleIdx] ?? null
          const vb = b[col.replicaIdx] ?? null
          if (va === null || vb === null) {
            if (va === vb) continue
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
              type: 4,
              unitId: id,
              field: col.name,
              oracle: va,
              replica: vb,
              context: context(frame, 4, id),
            },
          }
        }
        const sa = parseItemRow(a, oracle.header.itemFields!).stats
        const sb = parseItemRow(b, replica.header.itemFields!).stats
        const maxStats = Math.max(sa.length, sb.length)
        for (let k = 0; k < maxStats; k++) {
          const ea = sa[k] ?? null
          const eb = sb[k] ?? null
          const statTol = ea ? (tol[`itemStat${ea.statId}`] ?? 0) : 0
          if (ea && eb && ea.statId === eb.statId && ea.param === eb.param && Math.abs(ea.value - eb.value) <= statTol) {
            continue
          }
          const label = ea ? `stat(${ea.statId}:${ea.param})` : eb ? `stat(${eb.statId}:${eb.param})` : `stat[${k}]`
          return {
            uncomparedFields,
            comparedFrames: compared,
            oracleFrames: oracle.frames.size,
            replicaFrames: replica.frames.size,
            firstDivergence: {
              frame,
              kind: 'item-stats',
              type: 4,
              unitId: id,
              field: label,
              oracle: ea,
              replica: eb,
              context: context(frame, 4, id),
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

    if (opts.compareS2c !== false && Boolean(oracle.header.s2c && replica.header.s2c)) {
      const s2cDiff = diffS2cFramePackets(fa.s2c ?? [], fb.s2c ?? [])
      if (s2cDiff) {
        return {
          uncomparedFields,
          comparedFrames: compared,
          oracleFrames: oracle.frames.size,
          replicaFrames: replica.frames.size,
          firstDivergence: {
            frame,
            kind: 's2c',
            field: s2cDiff.field,
            oracle: (s2cDiff.expected as string | null) ?? null,
            replica: (s2cDiff.actual as string | null) ?? null,
            context: [],
          },
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
