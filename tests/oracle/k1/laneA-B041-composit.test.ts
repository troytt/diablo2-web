import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  UNITS_GetField7C_113c,
  UNITS_GetObjectPortalFlags113c,
  UNITS_GetObjectShrineTxt113c,
  UNITS_GetObjectTxt113c,
  UNITS_GetPlayerActiveWeaponFlags113c,
  UNITS_GetPlayerData113c,
  UNITS_GetPlayerName113c,
  UNITS_SetField7C_113c,
  UNITS_SetObjectPortalFlags113c,
  UNITS_SetObjectShrineTxt113c,
  UNITS_SetPlayerActiveWeaponFlags113c,
  UNITS_SetPlayerName113c,
} from '../../../src/d2kern-113c/common/composit.js'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.js'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js'

interface VectorRecord {
  va: string
  name: string
  caseId: string
  args: number[]
  retMask: string
  pre: {
    mem: Record<string, string>
  }
  expectedAssert?: {
    line: number
  }
  post: {
    eax: number
    mem: Record<string, string>
  }
}

const FIXTURE_PATH = resolve(
  __dirname,
  '../../fixtures/oracle/k1/b041-vectors.ndjson',
)

function loadVectors(): VectorRecord[] {
  const raw = readFileSync(FIXTURE_PATH, 'utf8').trim()
  if (!raw) return []
  return raw.split('\n').map((line) => JSON.parse(line) as VectorRecord)
}

function createStrictMemory(
  preMem: Record<string, string> | undefined,
  postMem: Record<string, string> | undefined,
): {
  m: SparseMemory113c
  rogueReads: string[]
  rogueWrites: string[]
  dumpHex: (addr: number, len: number) => string
} {
  const m = new SparseMemory113c()
  const readSpans: Array<{ start: number; end: number }> = []
  const writeSpans: Array<{ start: number; end: number }> = []
  for (const [addrStr, hex] of Object.entries(preMem ?? {})) {
    const start = Number.parseInt(addrStr, 16) >>> 0
    const bytes = Buffer.from(hex, 'hex')
    m.loadBlock(start, bytes)
    readSpans.push({ start, end: (start + bytes.length) >>> 0 })
  }
  for (const [addrStr, hex] of Object.entries(postMem ?? {})) {
    const start = Number.parseInt(addrStr, 16) >>> 0
    const len = hex.length >>> 1
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
    const byteAddr = a >>> 0
    let allowed = false
    for (const s of readSpans) {
      if (byteAddr >= s.start && byteAddr < s.end) {
        allowed = true
        break
      }
    }
    if (!allowed) {
      rogueReads.push(`0x${byteAddr.toString(16).padStart(8, '0')}`)
    }
    return origReadByte(byteAddr)
  }

  rawMem.writeByte = (a: number, v: number): void => {
    const byteAddr = a >>> 0
    let allowed = false
    for (const s of writeSpans) {
      if (byteAddr >= s.start && byteAddr < s.end) {
        allowed = true
        break
      }
    }
    if (!allowed) {
      rogueWrites.push(`0x${byteAddr.toString(16).padStart(8, '0')}`)
    }
    origWriteByte(byteAddr, v)
  }

  const dumpHex = (addr: number, len: number): string => {
    const out = Buffer.alloc(len)
    for (let i = 0; i < len; i++) {
      out[i] = origReadByte((addr + i) >>> 0)
    }
    return out.toString('hex')
  }

  return { m, rogueReads, rogueWrites, dumpHex }
}

const DISPATCH_B041: Record<
  string,
  (m: SparseMemory113c, args: number[]) => number | void
> = {
  '0x6fd7e960': (m, a) => UNITS_GetField7C_113c(m, a[0]!),
  '0x6fd7e990': (m, a) => UNITS_SetField7C_113c(m, a[0]!, a[1]!),
  '0x6fd7ea30': (m, a) => UNITS_SetObjectPortalFlags113c(m, a[0]!, a[1]!),
  '0x6fd7ea70': (m, a) => UNITS_GetObjectPortalFlags113c(m, a[0]!),
  '0x6fd7eaf0': (m, a) => UNITS_GetPlayerActiveWeaponFlags113c(m, a[0]!),
  '0x6fd7eb30': (m, a) => UNITS_SetPlayerActiveWeaponFlags113c(m, a[0]!, a[1]!),
  '0x6fd7eb70': (m, a) => UNITS_GetPlayerData113c(m, a[0]!),
  '0x6fd7ebb0': (m, a) => UNITS_GetPlayerName113c(m, a[0]!),
  '0x6fd7ec00': (m, a) => UNITS_SetPlayerName113c(m, a[0]!, a[1]!),
  '0x6fd7ec60': (m, a) => UNITS_SetObjectShrineTxt113c(m, a[0]!, a[1]!),
  '0x6fd7ecb0': (m, a) => UNITS_GetObjectShrineTxt113c(m, a[0]!),
  '0x6fd7ecf0': (m, a) => UNITS_GetObjectTxt113c(m, a[0]!),
}

describe('Lane A B041 — Composit Differential Vectors (12 functions)', () => {
  const vectors = loadVectors()

  it('loads all 12 B041 target VAs from b041-vectors.ndjson', () => {
    const vas = new Set(vectors.map((v) => v.va.toLowerCase()))
    expect(Object.keys(DISPATCH_B041).length).toBe(12)
    expect(vas.size).toBe(12)
    for (const targetVa of Object.keys(DISPATCH_B041)) {
      expect(vas.has(targetVa)).toBe(true)
    }
  })

  for (const rec of vectors) {
    it(`${rec.va} ${rec.name} [${rec.caseId}]`, () => {
      const fn = DISPATCH_B041[rec.va.toLowerCase()]
      expect(fn).toBeDefined()
      const { m, rogueReads, rogueWrites, dumpHex } = createStrictMemory(
        rec.pre.mem,
        rec.post.mem,
      )
      if (rec.expectedAssert !== undefined) {
        let caught: unknown = null
        try {
          fn!(m, rec.args)
        } catch (err) {
          caught = err
        }
        expect(caught).toBeInstanceOf(D2CommonAssertError)
        expect((caught as D2CommonAssertError).line).toBe(
          rec.expectedAssert.line,
        )
        expect(rogueReads).toEqual([])
        expect(rogueWrites).toEqual([])
        return
      }
      const rawRet = fn!(m, rec.args)
      const mask = Number.parseInt(rec.retMask, 16) >>> 0
      const eax = (((rawRet ?? 0) >>> 0) & mask) >>> 0
      expect(rogueReads).toEqual([])
      expect(rogueWrites).toEqual([])
      expect(eax).toBe(rec.post.eax >>> 0)
      for (const [addrStr, hex] of Object.entries(rec.post.mem ?? {})) {
        const start = Number.parseInt(addrStr, 16) >>> 0
        const len = hex.length >>> 1
        expect(dumpHex(start, len)).toBe(hex.toLowerCase())
      }
    })
  }

  it('StrictMem negative control rejects unstaged reads, rogue writes, and return/memory mutations', () => {
    const sample = vectors.find((v) => v.expectedAssert === undefined)!
    const { m, rogueReads, rogueWrites } = createStrictMemory(
      sample.pre.mem,
      sample.post.mem,
    )
    expect(() => m.u8(0xdeadbeef)).toThrow()
    expect(rogueReads.length).toBeGreaterThan(0)
    m.setU8(0xdeadbeef, 0x42)
    expect(rogueWrites.length).toBeGreaterThan(0)

    const nonAssertVectors = vectors.filter((v) => v.expectedAssert === undefined)
    let killed = 0
    for (const rec of nonAssertVectors) {
      const fn = DISPATCH_B041[rec.va.toLowerCase()]!
      const ctx = createStrictMemory(rec.pre.mem, rec.post.mem)
      const rawRet = fn(ctx.m, rec.args)
      const mask = Number.parseInt(rec.retMask, 16) >>> 0
      const actualEax = (((rawRet ?? 0) >>> 0) & mask) >>> 0
      const mutatedEax = (actualEax ^ 1) >>> 0
      const postEntries = Object.entries(rec.post.mem ?? {})
      const hasPostMemMutation =
        postEntries.length > 0 &&
        ctx.dumpHex(
          Number.parseInt(postEntries[0]![0], 16) >>> 0,
          postEntries[0]![1].length >>> 1,
        ) === postEntries[0]![1].toLowerCase()
      if (mutatedEax !== (rec.post.eax >>> 0) || hasPostMemMutation) {
        killed++
      }
    }
    expect(killed / nonAssertVectors.length).toBeGreaterThanOrEqual(0.9)
  })
})
