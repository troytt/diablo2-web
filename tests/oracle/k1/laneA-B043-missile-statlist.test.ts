import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ITEMS_GetItemTypeFromItemMem113c,
  MISSILE_AddStatsToDamage113c,
  MISSILE_RollCriticalStrike113c,
  SKILLS_GetThrowingWeaponMasteryBonus113c,
  UNITS_GetMonsterActiveWeapon113c,
} from '../../../src/d2kern-113c/common/missile.js'
import {
  DATATBLS_CalculateMonsterStatsByLevel113c,
  MISSILE_CalculateMasteryBonus113c,
  STATLIST_ClearBaseStats113c,
  STATLIST_GetBaseStatFromListInline113c,
  STATLIST_GetMaxDurabilityFromUnit113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetMaxStaminaFromUnit113c,
  STATLIST_GetStatBonusFromListInline113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetTotalStatValueLayer0_113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_RemoveItemDurabilityStatsModHandler113c,
  STATLIST_SetBaseStatEx113c,
  STATLIST_UnlinkUnitStatList113c,
  STATLIST_UpdateUnitStateSetFlag113c,
} from '../../../src/d2kern-113c/common/statlist.js'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.js'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js'

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
  /** Present when the real DLL hit its Fog assert (0x6FD5921C, captured line) instead of returning. */
  expectedAssert?: {
    line: number
  }
  outputs: {
    eax: string
    retMask: string
    memory: MemBlock[]
  }
}

const FIXTURE_PATH = resolve(
  __dirname,
  '../../fixtures/oracle/k1/b043-vectors.ndjson',
)

function loadVectors(): VectorRecord[] {
  const raw = readFileSync(FIXTURE_PATH, 'utf8').trim()
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

const DISPATCH_B043: Record<
  string,
  (m: SparseMemory113c, args: number[]) => number | void
> = {
  '0x6fd81b40': (m, a) => UNITS_GetMonsterActiveWeapon113c(m, a[0]!),
  '0x6fd88ff0': (m, a) => STATLIST_GetMaxDurabilityFromUnit113c(m, a[0]!),
  '0x6fd89050': (m, a) => STATLIST_GetMaxStaminaFromUnit113c(m, a[0]!),
  '0x6fd890a0': (m, a) => STATLIST_GetMaxManaFromUnit113c(m, a[0]!),
  '0x6fd890f0': (m, a) => STATLIST_GetMaxLifeFromUnit113c(m, a[0]!),
  '0x6fd89140': (m, a) => STATLIST_GetStatValue113c(m, a[0]!, a[1]!, a[2]!),
  '0x6fd891a0': (m, a) => STATLIST_GetTotalStatValueLayer0_113c(m, a[0]!, a[1]!),
  '0x6fd89380': (m, a) =>
    STATLIST_GetStatBonusFromListInline113c(m, a[0]!, a[1]!, a[2]!),
  '0x6fd89430': (m, a) =>
    STATLIST_GetUnitStatWithLayer113c(m, a[0]!, a[1]!, a[2]!),
  '0x6fd894e0': (m, a) =>
    STATLIST_GetBaseStatFromListInline113c(m, a[0]!, a[1]!, a[2]!),
  '0x6fd8a1d0': (m, a) =>
    STATLIST_SetBaseStatEx113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6fd8a5d0': (m, a) => STATLIST_UnlinkUnitStatList113c(m, a[0]!, a[1]!),
  '0x6fd8a650': (m, a) => STATLIST_ClearBaseStats113c(m, a[0]!),
  '0x6fd8aab0': (m, a) =>
    STATLIST_UpdateUnitStateSetFlag113c(m, a[0]!, a[1]!, a[2]!),
  '0x6fd96d50': (m, a) =>
    STATLIST_RemoveItemDurabilityStatsModHandler113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
      a[6]!,
    ),
  '0x6fda4a00': (m, a) =>
    DATATBLS_CalculateMonsterStatsByLevel113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
    ),
  '0x6fdbab20': (m, a) =>
    MISSILE_CalculateMasteryBonus113c(m, a[0]!, a[1]!, a[2]!),
  '0x6fdbabe0': (m, a) =>
    MISSILE_AddStatsToDamage113c(m, a[0]!, a[1]!, a[2]!),
  '0x6fdbb180': (m, a) =>
    MISSILE_RollCriticalStrike113c(m, a[0]!, a[1]!),
}

describe('Lane A B043 — Missile & StatList Differential Vectors (19 functions)', () => {
  const vectors = loadVectors()

  it('loads all 19 B043 target VAs from b043-vectors.ndjson', () => {
    const vas = new Set(vectors.map((v) => v.va.toLowerCase()))
    expect(Object.keys(DISPATCH_B043).length).toBe(19)
    expect(vas.size).toBe(19)
    for (const targetVa of Object.keys(DISPATCH_B043)) {
      expect(vas.has(targetVa)).toBe(true)
    }
  })

  for (const rec of vectors) {
    it(`${rec.va} ${rec.name} [case ${rec.caseIndex}: ${rec.note}]`, () => {
      const fn = DISPATCH_B043[rec.va.toLowerCase()]
      expect(fn).toBeDefined()
      const { m, rogueReads, rogueWrites, dumpHex } = createStrictMemory(
        rec.inputs.memory,
        rec.outputs.memory,
      )
      const args = rec.inputs.args.map(parseArg)
      if (rec.expectedAssert !== undefined) {
        let thrown: unknown
        try {
          fn!(m, args)
        } catch (e) {
          thrown = e
        }
        expect(thrown).toBeInstanceOf(D2CommonAssertError)
        expect((thrown as D2CommonAssertError).line).toBe(rec.expectedAssert.line)
        expect(rogueReads).toEqual([])
        return
      }
      const rawRet = fn!(m, args)
      const mask = Number.parseInt(rec.outputs.retMask, 16) >>> 0
      const eax = (((rawRet ?? 0) >>> 0) & mask) >>> 0
      const expectedEax =
        (Number.parseInt(rec.outputs.eax, 16) >>> 0) & mask
      expect(rogueReads).toEqual([])
      expect(rogueWrites).toEqual([])
      expect(eax).toBe(expectedEax >>> 0)
      for (const blk of rec.outputs.memory) {
        const start = Number.parseInt(blk.base, 16) >>> 0
        const len = blk.hex.length >>> 1
        expect(dumpHex(start, len)).toBe(blk.hex.toLowerCase())
      }
    })
  }

  it('StrictMem negative control rejects unstaged reads, rogue writes, and return/memory mutations', () => {
    const sample = vectors[0]!
    const { m, rogueReads, rogueWrites } = createStrictMemory(
      sample.inputs.memory,
      sample.outputs.memory,
    )
    expect(() => m.u8(0xdeadbeef)).toThrow()
    expect(rogueReads.length).toBeGreaterThan(0)
    m.setU8(0xdeadbeef, 0x42)
    expect(rogueWrites.length).toBeGreaterThan(0)

    let killed = 0
    // Assert vectors carry no return value or post-memory to mutate; the control covers returning vectors.
    const returningVectors = vectors.filter((v) => v.expectedAssert === undefined)
    for (const rec of returningVectors) {
      const fn = DISPATCH_B043[rec.va.toLowerCase()]!
      const ctx = createStrictMemory(rec.inputs.memory, rec.outputs.memory)
      const args = rec.inputs.args.map(parseArg)
      const rawRet = fn(ctx.m, args)
      const mask = Number.parseInt(rec.outputs.retMask, 16) >>> 0
      const actualEax = (((rawRet ?? 0) >>> 0) & mask) >>> 0
      const expectedEax =
        ((Number.parseInt(rec.outputs.eax, 16) >>> 0) & mask) >>> 0
      const mutatedEax = ((actualEax ^ 1) & mask) >>> 0
      const hasPostMem = rec.outputs.memory.length > 0
      if (mutatedEax !== expectedEax || hasPostMem) {
        killed++
      }
    }
    expect(killed / returningVectors.length).toBeGreaterThanOrEqual(0.9)
  })

  it('covers B043 helper non-item, negative item type, and null ISC record guards', () => {
    const m = new SparseMemory113c()
    const u = 0x03501000
    const itm = 0x03501400
    const skill = 0x03503900
    const skillsTxt = 0x03504200
    const itemsTxt = 0x03530000
    const itemTypes = 0x03506000
    const maskBuf = 0x03507000
    const bitMasksBuf = 0x03507400
    const sgpt = 0x03500000
    const sl = 0x03502400
    m.loadBlock(u, new Uint8Array(0x100))
    m.loadBlock(itm, new Uint8Array(0x100))
    m.loadBlock(skill, new Uint8Array(0x40))
    m.loadBlock(skillsTxt, new Uint8Array(0x240))
    m.loadBlock(itemsTxt, new Uint8Array(0x200))
    m.loadBlock(itemTypes, new Uint8Array(0x3000))
    m.loadBlock(maskBuf, new Uint8Array(0x400))
    m.loadBlock(bitMasksBuf, new Uint8Array(0x80))
    m.loadBlock(sgpt, new Uint8Array(0xd00))
    m.loadBlock(sl, new Uint8Array(0x80))
    m.loadBlock(0x6fdefb94, new Uint8Array(8))
    m.loadBlock(0x6fde9e1c, new Uint8Array(4))
    m.loadBlock(0x6fdd90b0, new Uint8Array(4))

    m.setU32(u, 1) // non-item (UNIT_MONSTER)
    expect(ITEMS_GetItemTypeFromItemMem113c(m, u)).toBe(0)
    expect(() => ITEMS_GetItemTypeFromItemMem113c(m, 0)).toThrow(D2CommonAssertError)

    // SKILLS_GetThrowingWeaponMasteryBonus113c boundary cases: nType = -1, nType = 0, nType = dwItemTypesTxtRecs
    m.setU32(0x6fdefb94, 4)
    m.setU32(0x6fdefb98, itemsTxt)
    m.setU32(0x6fde9e1c, sgpt)
    m.setU32(0x6fdd90b0, bitMasksBuf)
    m.setU32(sgpt + 0xbf8, itemTypes)
    m.setU32(sgpt + 0xbfc, 0x31)
    m.setU32(sgpt + 0xc00, 2)
    m.setU32(sgpt + 0xc04, maskBuf)
    m.setU32(maskBuf + ((0x30 * 2 + 1) << 2), 0xffffffff)
    m.setU32(bitMasksBuf + ((0x30 & 0x1f) << 2), 0xffffffff)
    m.setU8(itemTypes + 0x10, 1)
    m.setU8(itemTypes + 0x31 * 0xe4 + 0x10, 1)
    m.setU32(skill, skillsTxt)
    m.setU16(skillsTxt + 0x18, 0x30)
    m.setU8(skillsTxt + 0x14, 2)
    m.setU32(itm, 4)
    m.setU32(itm + 4, 0)

    m.setU16(itemsTxt + 0x11e, 0xffff) // wType[0] = -1 -> null
    expect(SKILLS_GetThrowingWeaponMasteryBonus113c(m, u, itm, skill, 2)).toBe(null)
    m.setU16(itemsTxt + 0x11e, 0) // wType[0] = 0 -> valid, returns 0
    expect(SKILLS_GetThrowingWeaponMasteryBonus113c(m, u, itm, skill, 2)).toBe(0)
    m.setU16(itemsTxt + 0x11e, 0x31) // wType[0] = 0x31 === dwItemTypesTxtRecs -> null
    expect(SKILLS_GetThrowingWeaponMasteryBonus113c(m, u, itm, skill, 2)).toBe(null)

    // Null pIscRec guard when sgpt->pItemStatCostTxt wraps to 0 at target offset
    m.setU32(sgpt + 0xbd4, 359)
    m.setU32(u + 0x5c, sl)
    m.setU32(sl + 0x24, sl + 0x60)
    m.setU16(sl + 0x28, 1)
    m.setU32(sl + 0x64, 50)
    m.setU32(sgpt + 0xbcc, (-0x5c64) >>> 0)
    expect(STATLIST_GetMaxDurabilityFromUnit113c(m, u)).toBe(0)
    m.setU32(sgpt + 0xbcc, (-0x8dc) >>> 0)
    expect(STATLIST_GetMaxLifeFromUnit113c(m, u)).toBe(0)
    m.setU32(sgpt + 0xbcc, 0)
    expect(STATLIST_GetUnitStatWithLayer113c(m, u, 0, 0)).toBe(0)
  })
})
