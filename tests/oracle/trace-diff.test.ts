import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  ORACLE_ITEM_FIELDS_113C,
  diffItemFrameRows,
  diffS2cFramePackets,
  diffTraces,
  formatDivergence,
  parseItemRow,
  parseTrace,
} from '../../tools/oracle/lib/trace-diff.ts'

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

  it('parses and diffs t4 items (itemFields + trailing stat triples) and preserves backward compatibility', () => {
    const itemHdr = {
      ...HDR,
      itemFields: [...ORACLE_ITEM_FIELDS_113C],
    }
    const groundItem = [
      9, 344, 3, 5664, 5797,
      694881265, 331052482, 2009214798, 669412953, 1604951332,
      -1, 2, 1, 0x80010, 0, 0,
      101, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 255, 0, 0,
      31, 0, 2,
      72, 0, 7,
      73, 0, 12,
    ]
    const parsed = parseItemRow(groundItem, ORACLE_ITEM_FIELDS_113C)
    expect(parsed.fields).toMatchObject({
      id: 9,
      class: 344,
      mode: 3,
      x: 5664,
      y: 5797,
      ownerId: -1,
      quality: 2,
      ilvl: 1,
      itemFlags: 0x80010,
      itemFormat: 101,
      itemPage: 255,
    })
    expect(parsed.stats).toEqual([
      { statId: 31, param: 0, value: 2 },
      { statId: 72, param: 0, value: 7 },
      { statId: 73, param: 0, value: 12 },
    ])

    const oFrames = {
      1: { ...structuredClone(base[1]), t4: [] },
      2: { ...structuredClone(base[2]), t4: [groundItem] },
    }
    const rFrames = structuredClone(oFrames)
    // Default ignores item seed columns unless compareSeeds: true
    rFrames[2].t4[0]![5] = 111
    rFrames[2].t4[0]![7] = 222
    rFrames[2].t4[0]![9] = 333
    expect(diffTraces(parseTrace(trace('oracle', oFrames, itemHdr)), parseTrace(trace('replica', rFrames, itemHdr))).firstDivergence).toBeNull()
    expect(
      diffTraces(parseTrace(trace('oracle', oFrames, itemHdr)), parseTrace(trace('replica', rFrames, itemHdr)), {
        compareSeeds: true,
      }).firstDivergence,
    ).toMatchObject({
      frame: 2,
      kind: 'field',
      type: 4,
      unitId: 9,
      field: 'seedLo',
      oracle: 694881265,
      replica: 111,
    })

    // Scalar item field mismatch (e.g. quality)
    const badQual = structuredClone(oFrames)
    badQual[2].t4[0]![11] = 4
    expect(diffTraces(parseTrace(trace('oracle', oFrames, itemHdr)), parseTrace(trace('replica', badQual, itemHdr))).firstDivergence).toMatchObject({
      frame: 2,
      kind: 'field',
      type: 4,
      unitId: 9,
      field: 'quality',
      oracle: 2,
      replica: 4,
    })

    // Trailing item stat triple mismatch (durability 7 -> 6)
    const badStat = structuredClone(oFrames)
    badStat[2].t4[0]![35] = 6
    expect(diffTraces(parseTrace(trace('oracle', oFrames, itemHdr)), parseTrace(trace('replica', badStat, itemHdr))).firstDivergence).toMatchObject({
      frame: 2,
      kind: 'item-stats',
      type: 4,
      unitId: 9,
      field: 'stat(72:0)',
      oracle: { statId: 72, param: 0, value: 7 },
      replica: { statId: 72, param: 0, value: 6 },
    })

    // Reusable frame-level helper diffItemFrameRows ('strict' vs 'pos')
    expect(diffItemFrameRows([groundItem], badStat[2].t4, ORACLE_ITEM_FIELDS_113C, 'strict')).toEqual({
      key: 't4',
      id: 9,
      field: 'stat(72:0)',
      expected: { statId: 72, param: 0, value: 7 },
      actual: { statId: 72, param: 0, value: 6 },
    })
    expect(diffItemFrameRows([groundItem], badStat[2].t4, ORACLE_ITEM_FIELDS_113C, 'pos')).toBeNull()

    // Backward compatibility: legacy header without itemFields skips t4 comparison
    expect(
      diffTraces(parseTrace(trace('oracle', oFrames, itemHdr)), parseTrace(trace('replica', { 1: base[1], 2: base[2] }, HDR))).firstDivergence,
    ).toBeNull()
  })

  it('parses and diffs s2c packet arrays in emission order and preserves backward compatibility', () => {
    const s2cHdr = { ...HDR, s2c: true }
    const oFrames = {
      1: { ...structuredClone(base[1]), s2c: [] },
      2: {
        ...structuredClone(base[2]),
        s2c: ['6d090000002016a31680', '9c001d100900000010208000650cc4a2d4824d8c0d040181010c07fe03'],
      },
    }
    const rFrames = structuredClone(oFrames)
    rFrames[2].s2c[0] = rFrames[2].s2c[0]!.toUpperCase()
    expect(diffTraces(parseTrace(trace('oracle', oFrames, s2cHdr)), parseTrace(trace('replica', rFrames, s2cHdr))).firstDivergence).toBeNull()

    const badPkt = structuredClone(oFrames)
    badPkt[2].s2c[1] = '9c001d100900000010208000650cc4a2d4824d8c0d040181010c07fe00'
    expect(diffTraces(parseTrace(trace('oracle', oFrames, s2cHdr)), parseTrace(trace('replica', badPkt, s2cHdr))).firstDivergence).toMatchObject({
      frame: 2,
      kind: 's2c',
      field: 's2c[1]',
      oracle: oFrames[2].s2c[1],
      replica: badPkt[2].s2c[1],
    })
    expect(diffS2cFramePackets(oFrames[2].s2c, badPkt[2].s2c)).toEqual({
      key: 's2c',
      id: null,
      field: 's2c[1]',
      expected: oFrames[2].s2c[1],
      actual: badPkt[2].s2c[1],
    })

    // Backward compatibility: legacy header without s2c:true skips s2c comparison
    expect(
      diffTraces(parseTrace(trace('oracle', oFrames, s2cHdr)), parseTrace(trace('replica', { 1: base[1], 2: base[2] }, HDR))).firstDivergence,
    ).toBeNull()
  })

  it('loads legacy K1 golden without t4/s2c and K2 goldens with real t4 ground drops and 0x9c s2c packets', () => {
    const goldenDir = join(import.meta.dirname, '../fixtures/oracle/golden')
    const loadGolden = (name: string) =>
      parseTrace(gunzipSync(readFileSync(join(goldenDir, `${name}.oracle.ndjson.gz`))).toString('utf8'))

    // Legacy K1 golden without t4/s2c parses cleanly with zero changes
    const k1 = loadGolden('a1-town-walk')
    expect(k1.header.itemFields).toBeUndefined()
    expect(k1.header.s2c).toBeUndefined()
    expect(k1.frames.get(2)?.t4).toBeUndefined()

    // K2 a1-bloodmoor-melee: ground drop item #9 + 0x9C S2C at frame 1106
    const melee = loadGolden('a1-bloodmoor-melee')
    expect(melee.header.itemFields).toEqual([...ORACLE_ITEM_FIELDS_113C])
    expect(melee.header.s2c).toBe(true)
    expect(melee.frames.size).toBe(1800)
    const f1106 = melee.frames.get(1106)!
    expect(f1106.s2c?.some((p) => p.startsWith('9c00'))).toBe(true)
    const drop9 = f1106.t4?.find((r) => r[0] === 9)
    expect(drop9).toBeDefined()
    expect(parseItemRow(drop9!, melee.header.itemFields!)).toMatchObject({
      fields: { id: 9, class: 344, mode: 3, x: 5664, y: 5797, quality: 2, ilvl: 1 },
    })

    // K2 p52-dot-ticks: ground drops #8 (f808) and #9 gold pile (f883)
    const dot = loadGolden('p52-dot-ticks')
    expect(dot.header.itemFields).toEqual([...ORACLE_ITEM_FIELDS_113C])
    expect(dot.header.s2c).toBe(true)
    expect(dot.frames.size).toBe(1200)
    expect(dot.frames.get(808)?.s2c?.some((p) => p.startsWith('9c00'))).toBe(true)
    expect(dot.frames.get(883)?.s2c?.some((p) => p.startsWith('9c00'))).toBe(true)

    // K2 p52-item-defense: 6 equipped unique/set items (fileIndex 76, 109, 242, 110, 236, 384) + 2 ground drops (#13 f781, #14 f1129)
    const itemDef = loadGolden('p52-item-defense')
    expect(itemDef.header.itemFields).toEqual([...ORACLE_ITEM_FIELDS_113C])
    expect(itemDef.header.s2c).toBe(true)
    expect(itemDef.frames.size).toBe(1600)
    const equipped = (itemDef.frames.get(2)?.t4 ?? [])
      .map((r) => parseItemRow(r, itemDef.header.itemFields!))
      .filter((it) => it.fields.mode === 1)
    expect(equipped.map((it) => it.fields.fileIndex)).toEqual([76, 109, 242, 110, 236, 384])
    expect(itemDef.frames.get(781)?.s2c?.some((p) => p.startsWith('9c00'))).toBe(true)
    expect(itemDef.frames.get(1129)?.s2c?.some((p) => p.startsWith('9c00'))).toBe(true)
  })
})
