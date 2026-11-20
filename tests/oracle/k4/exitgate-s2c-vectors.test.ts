import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'
import {
  parseS2CVectors,
  S2C_RECORD_SIZE,
  verifyS2CVectors,
} from '../../../tools/oracle/vectors/s2c-vector.ts'
import { D2TV_MAGIC } from '../../../tools/oracle/vectors/vector-format.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')
const FIXTURE_GZ_PATH = resolve(REPO_ROOT, 'tests/fixtures/oracle/k4/s2c-113c.d2tv.gz')
const PINNED_RAW_SHA256 = '330ed2d430ae232a3b204c17dd83e0890abfafcf8d03d69cbc76104c8a31ebb2'

const K4_S2C_PROMOTED_DIFF_VERIFIED_VAS: readonly string[] = [
  'D2Game:0x6FCAADE0',
  'D2Game:0x6FCAB0F0',
  'D2Game:0x6FCAB750',
  'D2Game:0x6FCAB7F0',
  'D2Game:0x6FCAB8C0',
  'D2Game:0x6FCABA90',
  'D2Game:0x6FCABC20',
  'D2Game:0x6FCABDA0',
  'D2Game:0x6FCABE10',
  'D2Game:0x6FCAD570',
  'D2Game:0x6FCAD5F0',
  'D2Game:0x6FCAD860',
  'D2Game:0x6FCAD990',
  'D2Game:0x6FCEBA20',
  'D2Game:0x6FCEBB10',
]

describe('[K4] Exit-Gate S2C D2TV binary vector suite (v1.13c D2Game + D2Net + Fog DLL parity)', () => {
  const gzBytes = readFileSync(FIXTURE_GZ_PATH)
  const rawBytes = gunzipSync(gzBytes)

  it('validates D2TV header, pinned SHA-256 digest, >= 1,200 record count, and full S2C opcode & framing diversity', () => {
    expect(statSync(FIXTURE_GZ_PATH).size).toBeLessThan(200 * 1024)

    const sha = createHash('sha256').update(rawBytes).digest('hex')
    expect(sha).toBe(PINNED_RAW_SHA256)

    const { header, records } = parseS2CVectors(rawBytes)
    expect(header.magic).toBe(D2TV_MAGIC)
    expect(header.version).toBe(1)
    expect(header.kind).toBe('S2C')
    expect(header.recordSize).toBe(S2C_RECORD_SIZE)
    expect(header.recordCount).toBeGreaterThanOrEqual(1200)
    expect(records.length).toBe(1440)

    const opKinds = new Set(records.map(r => r.opKind))
    expect(opKinds.size).toBe(23)

    const opcodes = new Set(records.map(r => r.firstOpcode))
    const requiredOpcodes = [
      0x0f, 0x15, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
      0x21, 0x22, 0x23, 0x3e, 0x67, 0x68, 0x6d, 0x7d, 0x95, 0x96,
      0x9c, 0x9d, 0x9e, 0x9f, 0xa0, 0xa1, 0xa2, 0xa3, 0xa7, 0xa8,
      0xa9, 0xaa, 0xab, 0xaf,
    ]
    for (const opc of requiredOpcodes) {
      expect(opcodes.has(opc), `missing S2C opcode 0x${opc.toString(16)}`).toBe(true)
    }

    const oneByteHeaderFrames = records.filter(
      r => (r.flags & 3) === 1 && r.wireHdr0 < 0xf0 && r.wireHdr0 === r.framedLen,
    ).length
    expect(oneByteHeaderFrames).toBeGreaterThan(1300)

    const twoByteHeaderFrames = records.filter(
      r =>
        (r.flags & 3) === 1 &&
        r.wireHdr0 >= 0xf0 &&
        (((r.wireHdr0 & 0x0f) << 8) | r.wireHdr1) === r.framedLen,
    ).length
    expect(twoByteHeaderFrames).toBeGreaterThanOrEqual(8)

    const coalescedFrames = records.filter(r => r.pktCount >= 2).length
    expect(coalescedFrames).toBeGreaterThan(50)

    const q0AfBypass = records.filter(
      r => (r.flags & 3) === 0 && r.firstOpcode === 0xaf && r.framedLen === r.rawLen,
    ).length
    expect(q0AfBypass).toBeGreaterThanOrEqual(4)

    const q2RawBypass = records.filter(
      r => (r.flags & 3) === 2 && r.framedLen === r.rawLen,
    ).length
    expect(q2RawBypass).toBeGreaterThanOrEqual(4)
  })

  it('achieves 100% bit-exact S2C payload, Fog.#10223/#10224 Huffman codec, and D2Net.#10002/#10033 framing parity (0 mismatches across 1,440 records)', () => {
    beginVaTrace113c()
    let s2cExecutedVas = new Set<string>()
    let result: ReturnType<typeof verifyS2CVectors>
    try {
      result = verifyS2CVectors(rawBytes)
    } finally {
      s2cExecutedVas = new Set([...endVaTrace113c()].map(v => v.toUpperCase()))
    }
    if (result.mismatches.length > 0) {
      const preview = result.mismatches
        .slice(0, 12)
        .map(
          m =>
            `rec#${m.index} (opKind=${m.record.opKind} flags=0x${m.record.flags.toString(16)} opc=0x${m.record.firstOpcode.toString(16)} u16A=${m.record.u16A} u32A=0x${m.record.u32A.toString(16)}) ${m.field}: expected=${m.expected} actual=${m.actual}`,
        )
        .join('\n')
      expect.fail(`S2C mismatches (${result.mismatches.length}):\n${preview}`)
    }
    expect(result.mismatches.length).toBe(0)
    expect(result.totalRecords).toBeGreaterThanOrEqual(1200)
    expect(K4_S2C_PROMOTED_DIFF_VERIFIED_VAS.length).toBe(15)
    const missing = K4_S2C_PROMOTED_DIFF_VERIFIED_VAS.filter(va => !s2cExecutedVas.has(va.toUpperCase()))
    expect(missing).toEqual([])
  })
})
