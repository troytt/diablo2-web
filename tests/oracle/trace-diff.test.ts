import { describe, expect, it } from 'vitest'
import { diffTraces, formatDivergence, parseTrace } from '../../tools/oracle/lib/trace-diff.ts'

const HDR = {
  schema: 'd2oracle/1',
  unitFields: ['id', 'class', 'mode', 'x', 'y', 'seedLo', 'seedHi'],
  statIds: [6, 7],
}

function trace(source: string, frames: Record<number, Record<string, unknown[]>>, hdr = HDR): string {
  const lines = [JSON.stringify({ ...hdr, source, initSeed: 12345 })]
  for (const [f, units] of Object.entries(frames)) lines.push(JSON.stringify({ frame: Number(f), ...units }))
  return lines.join('\n') + '\n'
}

const base = {
  1: { t0: [[1, 4, 5, 5653, 5918, 1, 666, 14080, 14080]], t1: [[2, 152, 1, 5697, 5952, 9, 9, 256, 256]], t3: [] },
  2: { t0: [[1, 4, 3, 5654, 5918, 1, 666, 14080, 14080]], t1: [[2, 152, 1, 5697, 5952, 9, 9, 256, 256]], t3: [] },
  3: { t0: [[1, 4, 3, 5655, 5918, 1, 666, 14080, 14080]], t1: [[2, 152, 2, 5698, 5952, 9, 9, 256, 256]], t3: [] },
}

describe('oracle trace diff', () => {
  it('reports no divergence for identical traces and ignores seeds by default', () => {
    const replicaFrames = structuredClone(base)
    for (const f of Object.values(replicaFrames)) {
      for (const row of [...f.t0, ...f.t1]) {
        row[5] = null as unknown as number
        row[6] = null as unknown as number
      }
    }
    const res = diffTraces(parseTrace(trace('oracle', base)), parseTrace(trace('replica', replicaFrames)))
    expect(res.firstDivergence).toBeNull()
    expect(res.comparedFrames).toBe(3)
  })

  it('pinpoints the first differing frame, unit and field with context', () => {
    const rep = structuredClone(base)
    rep[3].t0[0]![3] = 5656 // player x off by one at frame 3
    rep[3].t1[0]![2] = 1 // later column in same frame must not mask the player diff
    const o = parseTrace(trace('oracle', base))
    const r = parseTrace(trace('replica', rep))
    const res = diffTraces(o, r, { context: 2 })
    expect(res.firstDivergence).toMatchObject({ frame: 3, kind: 'field', type: 0, unitId: 1, field: 'x', oracle: 5655, replica: 5656 })
    expect(res.firstDivergence!.context.map((c) => c[0])).toEqual([1, 2])
    expect(formatDivergence(res.firstDivergence, o.header, r.header)).toContain('frame 3')
  })

  it('compares stats by id even when the stat column order differs', () => {
    const rep = structuredClone(base)
    for (const f of Object.values(rep)) {
      for (const row of [...f.t0, ...f.t1]) {
        const [hp, maxHp] = [row[7], row[8]]
        row[7] = maxHp!
        row[8] = hp!
      }
    }
    rep[2].t0[0]![8] = 13824 // stat 6 (hp) is now the second stat column
    const res = diffTraces(parseTrace(trace('oracle', base)), parseTrace(trace('replica', rep, { ...HDR, statIds: [7, 6] })))
    expect(res.firstDivergence).toMatchObject({ frame: 2, field: 'stat6', oracle: 14080, replica: 13824 })
  })

  it('honours per-field tolerance', () => {
    const rep = structuredClone(base)
    rep[2].t0[0]![7] = 14080 - 100
    const res = diffTraces(parseTrace(trace('oracle', base)), parseTrace(trace('replica', rep)), { tolerance: { stat6: 128 } })
    expect(res.firstDivergence).toBeNull()
  })

  it('reports missing and extra units and missing frames', () => {
    const missing = structuredClone(base)
    missing[2].t1 = []
    expect(diffTraces(parseTrace(trace('oracle', base)), parseTrace(trace('replica', missing))).firstDivergence).toMatchObject({
      frame: 2,
      kind: 'missing-unit',
      type: 1,
      unitId: 2,
    })
    const extra = structuredClone(base) as Record<number, Record<string, unknown[]>>
    extra[1].t3 = [[7, 1, 0, 1, 1, null, null]]
    expect(diffTraces(parseTrace(trace('oracle', base)), parseTrace(trace('replica', extra))).firstDivergence).toMatchObject({
      frame: 1,
      kind: 'extra-unit',
      type: 3,
      unitId: 7,
    })
    const short = { 1: base[1] }
    expect(diffTraces(parseTrace(trace('oracle', base)), parseTrace(trace('replica', short))).firstDivergence).toMatchObject({
      frame: 2,
      kind: 'missing-frame',
    })
  })

  it('treats a null (unmodelled) value against a real value as a divergence when the column is compared', () => {
    const rep = structuredClone(base)
    rep[1].t0[0]![2] = null as unknown as number
    const res = diffTraces(parseTrace(trace('oracle', base)), parseTrace(trace('replica', rep)))
    expect(res.firstDivergence).toMatchObject({ frame: 1, field: 'mode', oracle: 5, replica: null })
  })

  it('tolerates a truncated final line and rejects traces without a header', () => {
    const t = trace('oracle', base) + '{"frame":4,"t0":[[1,4'
    expect(parseTrace(t).frames.size).toBe(3)
    expect(() => parseTrace('{"frame":1}\n')).toThrow(/header/)
  })

  it('compares per-unit seeds when compareSeeds is enabled, and compares gs, st, and dmg keys', () => {
    const oFrames = {
      1: {
        ...structuredClone(base[1]),
        gs: [2189963941, 588192779],
        st: [[0, 1, 64, 105], [1, 2, 105]],
        dmg: [{ att: [0, 1], def: [1, 2], hp: [256, 256], ret: 128, raw: [34, 5, 128, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }],
      },
    }
    const rFrames = structuredClone(oFrames)
    expect(diffTraces(parseTrace(trace('oracle', oFrames)), parseTrace(trace('replica', rFrames)), { compareSeeds: true }).firstDivergence).toBeNull()

    const badGs = structuredClone(oFrames)
    badGs[1].gs = [111, 222]
    expect(diffTraces(parseTrace(trace('oracle', oFrames)), parseTrace(trace('replica', badGs))).firstDivergence).toMatchObject({
      frame: 1,
      kind: 'game-seed',
      field: 'gs',
    })

    const badSt = structuredClone(oFrames)
    badSt[1].st = [[0, 1, 105], [1, 2, 105]]
    expect(diffTraces(parseTrace(trace('oracle', oFrames)), parseTrace(trace('replica', badSt))).firstDivergence).toMatchObject({
      frame: 1,
      kind: 'states',
      type: 0,
      unitId: 1,
      field: 'st',
    })

    const badDmg = structuredClone(oFrames)
    badDmg[1].dmg[0]!.ret = 64
    expect(diffTraces(parseTrace(trace('oracle', oFrames)), parseTrace(trace('replica', badDmg))).firstDivergence).toMatchObject({
      frame: 1,
      kind: 'damage',
      field: 'dmg[0]',
    })
  })

  it('compares dot events when both headers advertise dot:true, reports mismatches, and skips when either header lacks dot', () => {
    const dotHdr = { ...HDR, dot: true }
    const oFrames = {
      1: {
        ...structuredClone(base[1]),
        dot: [
          [0, 1, 13800, 13810],
          [1, 2, 256, 156],
        ],
      },
      2: { ...structuredClone(base[2]) },
      3: {
        ...structuredClone(base[3]),
        dot: [[1, 2, 156, 0]],
      },
    }
    const rFrames = structuredClone(oFrames)
    expect(
      diffTraces(parseTrace(trace('oracle', oFrames, dotHdr)), parseTrace(trace('replica', rFrames, dotHdr))).firstDivergence,
    ).toBeNull()

    // Value mismatch in dot[1] on frame 1
    const badVal = structuredClone(oFrames)
    badVal[1].dot![1] = [1, 2, 256, 155]
    const divVal = diffTraces(
      parseTrace(trace('oracle', oFrames, dotHdr)),
      parseTrace(trace('replica', badVal, dotHdr)),
    ).firstDivergence
    expect(divVal).toMatchObject({
      frame: 1,
      kind: 'dot',
      type: 1,
      unitId: 2,
      field: 'dot[1]',
      oracle: [1, 2, 256, 156],
      replica: [1, 2, 256, 155],
    })

    // Missing dot event on frame 3 when both headers have dot:true
    const missingDot = structuredClone(oFrames)
    delete (missingDot[3] as { dot?: unknown }).dot
    expect(
      diffTraces(
        parseTrace(trace('oracle', oFrames, dotHdr)),
        parseTrace(trace('replica', missingDot, dotHdr)),
        { context: 2 },
      ).firstDivergence,
    ).toMatchObject({
      frame: 3,
      kind: 'dot',
      type: 1,
      unitId: 2,
      field: 'dot[0]',
      oracle: [1, 2, 156, 0],
      replica: null,
    })

    // Backward compatibility: legacy oracle header without dot:true ignores replica dot events
    expect(
      diffTraces(
        parseTrace(trace('oracle', base, HDR)),
        parseTrace(trace('replica', rFrames, dotHdr)),
      ).firstDivergence,
    ).toBeNull()

    // Symmetry: oracle header with dot:true against a trace without dot:true also skips dot comparison
    expect(
      diffTraces(
        parseTrace(trace('oracle', oFrames, dotHdr)),
        parseTrace(trace('replica', base, HDR)),
      ).firstDivergence,
    ).toBeNull()

    // Explicit opt-out via compareDot: false
    expect(
      diffTraces(
        parseTrace(trace('oracle', oFrames, dotHdr)),
        parseTrace(trace('replica', badVal, dotHdr)),
        { compareDot: false },
      ).firstDivergence,
    ).toBeNull()
  })
})
