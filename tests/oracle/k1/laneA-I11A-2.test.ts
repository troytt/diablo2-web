import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.js'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js'
import { COMPOSIT_GetUnitWeaponClassCode113c, COMPOSIT_IsUnitUsingBowOrCrossbow113c } from '../../../src/d2kern-113c/common/composit.js'
import { HIRELING_RollAndPopulateStatsEntry113c, ITEMS_AddChargedSkillStatToItemOrSocket113c, ITEMS_ApplyElemMasteryOrPierceMaxOnly113c, ITEMS_ApplyElemMasteryOrPierceMinToMax113c, ITEMS_RollAndApplySkillBonusStat113c } from '../../../src/d2kern-113c/common/statlist.js'
import { ANIMSEQ_GetPlayerSeqWeaponClassIdx113c, ANIMSEQ_GetUnitSeqFrameCountFp8_113c, ANIMSEQ_GetUnitSeqFrameDataField8_113c, ANIMSEQ_GetUnitSeqLookupEntry113c, ANIMSEQ_GetUnitSeqRecordPtr113c, UNITS_CanUnitMeleeAttackTarget113c, UNITS_GetAnimOrSeqEventAtFrame113c, UNITS_GetApproximateDistance113c, UNITS_GetEquippedWeaponAdder113c, UNITS_InitSkillAnimSequence113c } from '../../../src/d2kern-113c/common/unit.js'
import {
  ITEMS_ApplyElemMasteryOrPierceMaxOnly113c as LOGGING_MaxOnlyAlias,
  ITEMS_ApplyElemMasteryOrPierceMinToMax113c as LOGGING_MinToMaxAlias,
} from '../../../src/d2kern-113c/common/logging.js'

interface MemBlock {
  base: string
  hex: string
}

interface VectorRecord {
  va: string
  name: string
  caseIndex: number
  note: string
  inputs: {
    args: Array<string | number>
    memory: MemBlock[]
  }
  expectedAssert?: {
    line: number
  }
  outputs: {
    eax: string
    retMask: string
    memory: MemBlock[]
  }
}

function loadVectors(fixturePath: string): VectorRecord[] {
  const raw = readFileSync(fixturePath, 'utf8').trim()
  if (!raw) return []
  return raw.split('\n').map((line) => JSON.parse(line) as VectorRecord)
}

function parseArg(v: string | number): number {
  if (typeof v === 'number') return v | 0
  return Number.parseInt(v, 16) >>> 0
}

function createStrictMemory(
  preBlocks: MemBlock[],
  postBlocks: MemBlock[],
): {
  m: SparseMemory113c
  rogueReads: string[]
  rogueWrites: string[]
  dumpHex: (addr: number, len: number) => string
} {
  const m = new SparseMemory113c()
  const readSpans: Array<{ start: number; end: number }> = []
  const writeSpans: Array<{ start: number; end: number }> = []
  const writtenAddrs = new Set<number>()

  for (const blk of preBlocks) {
    const start = Number.parseInt(blk.base, 16) >>> 0
    const bytes = Buffer.from(blk.hex, 'hex')
    m.loadBlock(start, bytes)
    readSpans.push({ start, end: (start + bytes.length) >>> 0 })
  }
  for (const blk of postBlocks) {
    const start = Number.parseInt(blk.base, 16) >>> 0
    const len = blk.hex.length >>> 1
    writeSpans.push({ start, end: (start + len) >>> 0 })
  }

  const rawMem = m as unknown as {
    readByte: (a: number) => number
    writeByte: (a: number, v: number) => void
  }
  const origReadByte = rawMem.readByte.bind(m)
  const origWriteByte = rawMem.writeByte.bind(m)

  const rogueReads: string[] = []
  const rogueWrites: string[] = []

  rawMem.readByte = (a: number): number => {
    const u = a >>> 0
    const ok = readSpans.some((s) => u >= s.start && u < s.end) || writtenAddrs.has(u)
    if (!ok) {
      rogueReads.push(`0x${u.toString(16)}`)
    }
    return origReadByte(a)
  }

  rawMem.writeByte = (a: number, v: number): void => {
    const u = a >>> 0
    const ok = writeSpans.some((s) => u >= s.start && u < s.end)
    if (!ok) {
      rogueWrites.push(`0x${u.toString(16)}`)
    }
    writtenAddrs.add(u)
    origWriteByte(a, v)
  }

  const dumpHex = (addr: number, len: number): string => {
    let out = ''
    for (let i = 0; i < len; i++) {
      out += origReadByte((addr + i) >>> 0).toString(16).padStart(2, '0')
    }
    return out
  }

  return { m, rogueReads, rogueWrites, dumpHex }
}

const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i11a-2-vectors.ndjson')

const DISPATCH: Record<string, (m: SparseMemory113c, args: number[]) => number | void> = {
  '0x6FD7CCC0': (m, a) => HIRELING_RollAndPopulateStatsEntry113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FD7E790': (m, a) => ANIMSEQ_GetPlayerSeqWeaponClassIdx113c(m, a[0]!),
  '0x6FD7E840': (m, a) => ANIMSEQ_GetUnitSeqLookupEntry113c(m, a[0]!),
  '0x6FD7E900': (m, a) => ANIMSEQ_GetUnitSeqFrameDataField8_113c(m, a[0]!),
  '0x6FD7E920': (m, a) => ANIMSEQ_GetUnitSeqFrameCountFp8_113c(m, a[0]!),
  '0x6FD7E940': (m, a) => ANIMSEQ_GetUnitSeqRecordPtr113c(m, a[0]!),
  '0x6FD825C0': (m, a) => UNITS_GetEquippedWeaponAdder113c(m, a[0]!),
  '0x6FD826C0': (m, a) => UNITS_CanUnitMeleeAttackTarget113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD82770': (m, a) => UNITS_GetAnimOrSeqEventAtFrame113c(m, a[0]!, a[1]!),
  '0x6FD82820': (m, a) => UNITS_InitSkillAnimSequence113c(m, a[0]!),
  '0x6FD941E0': (m, a) => COMPOSIT_GetUnitWeaponClassCode113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD94350': (m, a) => COMPOSIT_IsUnitUsingBowOrCrossbow113c(m, a[0]!),
  '0x6FD97120': (m, a) => ITEMS_AddChargedSkillStatToItemOrSocket113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD98B80': (m, a) => ITEMS_RollAndApplySkillBonusStat113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FD99140': (m, a) => ITEMS_ApplyElemMasteryOrPierceMinToMax113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FD99190': (m, a) => ITEMS_ApplyElemMasteryOrPierceMaxOnly113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FDCFBD0': (m, a) => UNITS_GetApproximateDistance113c(m, a[0]!, a[1]!),
}

describe('K1 Iteration 11 Lane A — I11A-2 animseq/composit/hireling/items/unit differential replay', () => {
  const vectors = loadVectors(FIXTURE_PATH)

  it('covers all 17 net-new VAs in i11a-2-vectors.ndjson with >= 2 non-degenerate vectors each', () => {
    const counts = new Map<string, number>()
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1)
    }
    expect(Object.keys(DISPATCH).length).toBe(17)
    for (const va of Object.keys(DISPATCH)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(2)
    }
  })

  for (const rec of vectors) {
    it(`${rec.va} ${rec.name} [#${rec.caseIndex}: ${rec.note}]`, () => {
      const fn = DISPATCH[rec.va]
      expect(fn, `missing dispatch for ${rec.va}`).toBeDefined()
      const { m, rogueReads, rogueWrites, dumpHex } = createStrictMemory(
        rec.inputs.memory,
        rec.outputs.memory,
      )
      const args = rec.inputs.args.map(parseArg)

      if (rec.expectedAssert !== undefined) {
        let caught: unknown
        try {
          fn!(m, args)
        } catch (err) {
          caught = err
        }
        expect(caught).toBeInstanceOf(D2CommonAssertError)
        expect((caught as D2CommonAssertError).line).toBe(rec.expectedAssert.line)
        expect(rogueReads, `rogue reads on ${rec.va} #${rec.caseIndex}`).toEqual([])
        return
      }

      const rawRet = fn!(m, args)
      const mask = Number.parseInt(rec.outputs.retMask, 16) >>> 0
      const expectedEax = Number.parseInt(rec.outputs.eax, 16) >>> 0
      if (mask !== 0) {
        const actual = (((rawRet ?? 0) >>> 0) & mask) >>> 0
        const expected = (expectedEax & mask) >>> 0
        expect(actual).toBe(expected)
      }

      expect(rogueReads, `rogue reads on ${rec.va} #${rec.caseIndex}`).toEqual([])
      expect(rogueWrites, `rogue writes on ${rec.va} #${rec.caseIndex}`).toEqual([])

      for (const post of rec.outputs.memory) {
        const base = Number.parseInt(post.base, 16) >>> 0
        const len = post.hex.length >>> 1
        expect(dumpHex(base, len), `memory mismatch at ${post.base}`).toBe(post.hex)
      }
    })
  }

  it('0x6FD99140 / 0x6FD99190 logging.ts re-exports match statlist.ts canonical implementations', () => {
    expect(LOGGING_MinToMaxAlias).toBe(ITEMS_ApplyElemMasteryOrPierceMinToMax113c)
    expect(LOGGING_MaxOnlyAlias).toBe(ITEMS_ApplyElemMasteryOrPierceMaxOnly113c)
  })

})
