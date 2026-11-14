import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.js'
import {
  INVENTORY_FindEquippedSkillChargeItem113c,
  INVENTORY_FindReagentForTome113c,
  INVENTORY_FindStackableCompatItemInBelt113c,
  INVENTORY_FindStackableCompatItemInGrid0_113c,
  INVENTORY_UpdateQuiverComponentDisplay113c,
} from '../../../src/d2kern-113c/common/inventory.js'
import {
  ITEMMODS_ApplyAddDamageTripletPropStat113c,
  ITEMMODS_ApplyAddSingleSkillPropStat113c,
  ITEMMODS_ApplyAmazonSkillsPropStat113c,
  ITEMMODS_ApplyBaseStatOverridePropStat113c,
  ITEMMODS_ApplyCastSkillOnItemPropStat113c,
  ITEMMODS_ApplyCastSkillPropStat113c,
  ITEMMODS_ApplyClassSkillsPropStat113c,
  ITEMMODS_ApplyDmgToUndeadPropStat113c,
  ITEMMODS_ApplyPackedDamageRangePropStat113c,
  ITEMMODS_UpdateSetItemBonusStates113c,
  STATES_ApplyMonSkillIconToUnit113c,
  STATLIST_GetStatValue113c,
} from '../../../src/d2kern-113c/common/statlist.js'
import {
  UNITFINDS_FindNearestUnitInRange113c,
  UNITFINDS_MatchUnitCandidate113c,
} from '../../../src/d2kern-113c/common/unit-finds.js'
import {
  UNITS_FindUnitAnimDataRecord113c,
  UNITS_GetMonsterSplitSpawnParams113c,
  UNITS_GetVelocity113c,
  UNITS_IsUnitInObjRectRange113c,
} from '../../../src/d2kern-113c/common/unit.js'
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

const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i13a-1-vectors.ndjson')

const DISPATCH: Record<string, (m: SparseMemory113c, args: number[]) => number | void> = {
  '0x6FD62330': (m, a) =>
    UNITFINDS_FindNearestUnitInRange113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      (a[4]! >>> 0) !== 0
        ? (mem, cand) => ((mem.u32((cand + 4) >>> 0) | 0) !== 99 ? 1 : 0)
        : 0,
    ),
  '0x6FD624E0': (m, a) =>
    UNITFINDS_MatchUnitCandidate113c(
      m,
      a[0]!,
      a[1]!,
      (mem, cand) => ((mem.u32((cand + 4) >>> 0) | 0) === 77 ? 1 : 0),
    ),
  '0x6FD6AA00': (m, a) =>
    UNITS_GetMonsterSplitSpawnParams113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
      (a[6]! >>> 0) !== 0
        ? (mem, u) => ((mem.u32((u + 4) >>> 0) + 10) | 0)
        : 0,
    ),
  '0x6FD70BC0': (m, a) => INVENTORY_FindReagentForTome113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD70E80': (m, a) => INVENTORY_UpdateQuiverComponentDisplay113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD70FD0': (m, a) => INVENTORY_FindStackableCompatItemInGrid0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD710B0': (m, a) => INVENTORY_FindStackableCompatItemInBelt113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD7C7C0': (m, a) => ITEMMODS_UpdateSetItemBonusStates113c(m, a[0]!, a[1]!),
  '0x6FD81000': (m, a) => UNITS_IsUnitInObjRectRange113c(m, a[0]!, a[1]!),
  '0x6FD82890': (m, a) => UNITS_GetVelocity113c(m, a[0]!),
  '0x6FD91F70': (m, a) => UNITS_FindUnitAnimDataRecord113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD96600': (m, a) => INVENTORY_FindEquippedSkillChargeItem113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD97420': (m, a) => ITEMMODS_ApplyCastSkillPropStat113c(m, a[1]!, a[2]!, a[3]!, a[5]!, a[8]!, a[9]!),
  '0x6FD97780': (m, a) => ITEMMODS_ApplyClassSkillsPropStat113c(m, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FD978F0': (m, a) => ITEMMODS_ApplyAmazonSkillsPropStat113c(m, a[1]!, a[2]!, a[3]!, a[5]!, a[6]!, a[7]!),
  '0x6FD97980': (m, a) => ITEMMODS_ApplyAddSingleSkillPropStat113c(m, a[1]!, a[2]!, a[3]!, a[5]!, a[6]!, a[7]!),
  '0x6FD97A10': (m, a) => ITEMMODS_ApplyAddDamageTripletPropStat113c(m, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FD97B20': (m, a) => ITEMMODS_ApplyPackedDamageRangePropStat113c(m, a[1]!, a[2]!, a[3]!, a[4]!, a[6]!, a[7]!),
  '0x6FD97C00': (m, a) => ITEMMODS_ApplyCastSkillOnItemPropStat113c(m, a[1]!, a[2]!, a[3]!, a[4]!, a[6]!, a[7]!),
  '0x6FD97E20': (m, a) => ITEMMODS_ApplyBaseStatOverridePropStat113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FD996F0': (m, a) => ITEMMODS_ApplyDmgToUndeadPropStat113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FDA2480': (m, a) => STATES_ApplyMonSkillIconToUnit113c(m, a[0]!, a[1]!),
}

describe('K1 Iteration 13 Lane A — I13A-1 differential replay', () => {
  const vectors = loadVectors(FIXTURE_PATH)

  it('covers all 22 net-new VAs in i13a-1-vectors.ndjson with >= 3 non-degenerate vectors each', () => {
    const counts = new Map<string, number>()
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1)
    }
    expect(Object.keys(DISPATCH).length).toBe(22)
    for (const va of Object.keys(DISPATCH)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(3)
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
})

describe('K1 Iteration 13 Lane A — I13A-1 unit edge-case coverage', () => {
  function makeTestMem1(): SparseMemory113c {
    const m = new SparseMemory113c()
    m.loadBlock(0x00000000, new Uint8Array(0x1000))
    m.loadBlock(0x03500000, new Uint8Array(0x60000))
    m.loadBlock(0x6fdd0000, new Uint8Array(0x28000))
    const sgpt = 0x03500000
    m.setU32(0x6fde9e1c, sgpt)
    m.setU32(0x6fdefb94, 16)
    m.setU32(0x6fdefb98, 0x03510000) // ItemsTxt
    m.setU32(0x6fdefa58, 20); m.setU32(0x6fdefa5c, 0x03512000) // InvTxt
    m.setU32(0x6fdeefe4, 7)
    m.setU32(0x6fdeff6c, 0x03517000) // ItemsCodeLink
    m.setU32(0x6fdef020, 7)
    m.setU32(0x6fdef028 + 0 * 8, 0x20687468); m.setU16(0x6fdef028 + 0 * 8 + 4, 0) // hth
    m.setU32(0x6fdef028 + 3 * 8, 0x20776f62); m.setU16(0x6fdef028 + 3 * 8 + 4, 1) // bow
    m.setU32(0x6fdef028 + 6 * 8, 0x20776278); m.setU16(0x6fdef028 + 6 * 8 + 4, 1) // xbw
    m.setU8(0x6fded378, 13); m.setU8(0x6fded379, 1) // GRID0_INFO
    m.setU32(0x6fddf088, 0); m.setU32(0x6fdd90b0, 0x0352c000); m.setU32(0x6fdf0b50, 0x0352c000); m.setU32(0x0352c000, 99)
    for (let b = 0; b < 32; b++) m.setU32(0x0352c000 + b * 4, (1 << b) >>> 0)
    m.setU32(0x6fdf0950, 0x03525000); m.setU32(0x6fdf0954, 0x03528000); m.setU32(0x6fdf0958, 600)
    m.setU32(0x6fdf13a4, 16); m.setU32(0x6fdf13b0, 0x03522000)
    m.setU32(0x6fdf13c4, 20); m.setU32(0x6fdf13c8, 1)
    m.setU32(0x6fdf13cc, 0x03523000); m.setU32(0x6fdf13d0, 0x03524000)
    m.setU32(sgpt + 0x0bc, 0x0352d000); m.setU32(sgpt + 0x0c4, 185)
    m.setU32(sgpt + 0xa78, 0x03525000); m.setU32(sgpt + 0xa80, 600)
    m.setU32(sgpt + 0xb98, 0x03530000); m.setU32(sgpt + 0xba0, 32)
    m.setU32(sgpt + 0xbc0, 100); m.setU32(sgpt + 0xbc4, 0x03534000); m.setU32(sgpt + 0xbc8, 7)
    m.setU32(sgpt + 0xbcc, 0x03535000); m.setU32(sgpt + 0xbd4, 359)
    m.setU32(sgpt + 0xbf8, 0x03514000); m.setU32(sgpt + 0xbfc, 96)
    m.setU32(sgpt + 0xc00, 3); m.setU32(sgpt + 0xc04, 0x03516000)
    m.setU32(sgpt + 0xc0c, 0x03519000); m.setU32(sgpt + 0xc18, 0x03519800); m.setU32(sgpt + 0xc1c, 10) // Sets/SetItems
    m.setU32(sgpt + 0xc6c, 6); m.setU32(sgpt + 0xc70, 0x3f)
    for (let iv = 0; iv < 20; iv++) {
      m.setU8(0x03512000 + iv * 0xf0 + 0x00, 10)
      m.setU8(0x03512000 + iv * 0xf0 + 0x01, 4)
      m.setU32(0x03512000 + iv * 0xf0 + 0x10, 10)
      m.setU32(0x03512000 + iv * 0xf0 + 0x14, 4)
    }
    // ItemType 0x12 (tome), 0x1b (bow), 0x2e (quiver), 0x33 (shield)
    m.setU8(0x03514000 + 0x1b * 0xe4 + 0x0a, 5); m.setU8(0x03514000 + 0x1b * 0xe4 + 0x0b, 4)
    m.setU8(0x03514000 + 0x2e * 0xe4 + 0x0a, 5); m.setU8(0x03514000 + 0x2e * 0xe4 + 0x0b, 4)
    m.setU8(0x03514000 + 0x33 * 0xe4 + 0x0a, 5)
    m.setU32(0x03516000 + 0x33 * 12 + 4, (1 << (0x32 - 32)) | (1 << (0x33 - 32)))
    // Item 0: tome, Item 1: xbw, Item 2: lit, Item 3: shield
    m.setU32(0x03510000 + 0 * 0x1a8 + 0xe8, 20); m.setU16(0x03510000 + 0 * 0x1a8 + 0x11e, 0x12); m.setU8(0x03510000 + 0 * 0x1a8 + 0x132, 1); m.setU8(0x03510000 + 0 * 0x1a8 + 0x13c, 20)
    m.setU32(0x03510000 + 1 * 0x1a8 + 0xc0, 0x20776278); m.setU32(0x03510000 + 1 * 0x1a8 + 0xc4, 0x20776278); m.setU32(0x03510000 + 1 * 0x1a8 + 0xc8, 0x20776278); m.setU16(0x03510000 + 1 * 0x1a8 + 0x11e, 0x1b); m.setU8(0x03510000 + 1 * 0x1a8 + 0x11c, 1); m.setU8(0x03510000 + 1 * 0x1a8 + 0x115, 6)
    m.setU32(0x03510000 + 2 * 0x1a8 + 0x80, 0x2074696c); m.setU32(0x03510000 + 2 * 0x1a8 + 0x90, 0x2074696c); m.setU16(0x03510000 + 2 * 0x1a8 + 0x11e, 0x2e); m.setU8(0x03510000 + 2 * 0x1a8 + 0x115, 5)
    m.setU32(0x03510000 + 3 * 0x1a8 + 0x80, 0x646c6873); m.setU32(0x03510000 + 3 * 0x1a8 + 0xd0, 20); m.setU16(0x03510000 + 3 * 0x1a8 + 0x11e, 0x33)
    m.setU32(0x03517000, 2); m.setU32(0x03517008, 0x03517010)
    m.setU32(0x03517010, 0x2074696c); m.setU32(0x03517014, 2) // 'lit '
    m.setU32(0x03517018, 0x646c6873); m.setU32(0x0351701c, 3) // 'shld'
    return m
  }

  it('UNITFINDS_MatchUnitCandidate113c flag 0x200 field step wall check & UNITS_GetMonsterSplitSpawnParams113c rawClass=0', () => {
    const m = makeTestMem1()
    const u = 0x03501000
    const path = 0x03501100
    const room = 0x03501200
    const search = 0x03501300
    const field = 0x03501400
    const coll = 0x03501500
    m.setU32(u, 1); m.setU32(u + 0x10, 1); m.setU32(u + 0x2c, path)
    m.setU16(path + 2, 20); m.setU16(path + 6, 20); m.setU32(path + 0x1c, room)
    m.setU32(room + 0x4c, 20); m.setU32(room + 0x50, 20); m.setU32(room + 0x54, 10); m.setU32(room + 0x58, 10)
    m.setU32(room + 0x20, coll)
    m.setU32(coll + 0x00, 20); m.setU32(coll + 0x04, 20); m.setU32(coll + 0x08, 10); m.setU32(coll + 0x0c, 10)
    m.setU32(coll + 0x10, 20); m.setU32(coll + 0x14, 20); m.setU32(coll + 0x18, 10); m.setU32(coll + 0x1c, 10)
    m.setU32(coll + 0x20, 0x03501600)
    // Put wall mask 4 at (21, 21) -> idx = 1 * 10 + 1 = 11
    m.setU16(0x03501600 + 11 * 2, 4)
    m.setU32(search, 0x202); m.setU32(search + 0x0c, 20); m.setU32(search + 0x10, 20); m.setU32(search + 0x14, 15)
    m.setU32(search + 0x20, field)
    // Setup field data & dir delta (dir 0 -> dx=1, dy=1) so (20,20) + (1,1) = (21,21) wall; dir 8 at (22,22) stops walk
    m.setU32(0x6fdf1404, 0x03501700); m.setU32(0x6fdf1414, 0); m.setU32(0x6fdf1418, 0)
    m.setU8(0x03501700 + (2 << 8) + 2, 8)
    m.setU32(0x6fde9ba0, 1); m.setU32(0x6fde9bc4, 1)
    m.setU32(field + 0x00, 20); m.setU32(field + 0x04, 20); m.setU32(field + 0x08, 22); m.setU32(field + 0x0c, 21)
    m.setU32(field + 0x10, 1); m.setU32(field + 0x14, 1)
    expect(UNITFINDS_MatchUnitCandidate113c(m, u, search)).toBe(0)

    // UNITS_GetMonsterSplitSpawnParams113c rawClass === 0 -> BaseId 0x20E (caseHi === 1)
    m.setU16(0x03525000 + 0 * 0x1a8 + 2, 0x20e)
    m.setU32(u, 1); m.setU32(u + 4, 0)
    UNITS_GetMonsterSplitSpawnParams113c(m, u, 0x03501800, 0x03501810, 0x03501820, 0x03501830, 1, () => 777)
    expect(m.u32(0x03501800)).toBe(777)
  })

  it('INVENTORY tome/quiver/grid0/belt edge cases', () => {
    const m = makeTestMem1()
    const owner = 0x03501000
    const inv = 0x03501100
    const grids = 0x03501200
    const cells0 = 0x03501300
    const tome0 = 0x03501400; const td0 = 0x03501480
    const tome1 = 0x03501500; const td1 = 0x03501580
    const tome2 = 0x03501600; const td2 = 0x03501680
    const sl1 = 0x03501700; const st1 = 0x03501780
    const sl2 = 0x03501800; const st2 = 0x03501880

    m.setU32(owner, 1); m.setU32(owner + 0x60, inv)
    m.setU32(inv, 0x01020304); m.setU32(inv + 0x08, owner); m.setU32(inv + 0x14, grids); m.setU32(inv + 0x18, 3); m.setU32(inv + 0x1c, 4)
    m.setU8(grids + 0x08, 13); m.setU8(grids + 0x09, 1); m.setU32(grids + 0x0c, cells0)
    m.setU8(grids + 0x28, 10); m.setU8(grids + 0x29, 4); m.setU32(grids + 0x2c, cells0)
    m.setU32(tome0, 4); m.setU32(tome0 + 4, 0); m.setU32(tome0 + 0x14, td0); m.setU32(td0, 2); m.setU16(td0 + 0x3e, 1)
    m.setU32(tome1, 4); m.setU32(tome1 + 4, 0); m.setU32(tome1 + 0x14, td1); m.setU32(td1, 2); m.setU16(td1 + 0x3e, 1); m.setU32(td1 + 0x5c, inv); m.setU32(td1 + 0x70, tome2)
    m.setU32(tome2, 4); m.setU32(tome2 + 4, 0); m.setU32(tome2 + 0x14, td2); m.setU32(td2, 2); m.setU16(td2 + 0x3e, 1); m.setU32(td2 + 0x5c, inv)
    m.setU32(tome1 + 0x5c, sl1); m.setU32(sl1 + 0x10, 0x80000000); m.setU32(sl1 + 0x48, st1); m.setU16(sl1 + 0x4c, 1); m.setU16(sl1 + 0x4e, 4)
    m.setU32(st1, 0x00460000); m.setU32(st1 + 4, 20) // full tome1
    m.setU32(tome2 + 0x5c, sl2); m.setU32(sl2 + 0x10, 0x80000000); m.setU32(sl2 + 0x48, st2); m.setU16(sl2 + 0x4c, 1); m.setU16(sl2 + 0x4e, 4)
    m.setU32(st2, 0x00460000); m.setU32(st2 + 4, 5) // partial tome2

    m.setU32(grids + 0x20, tome1)
    expect(INVENTORY_FindReagentForTome113c(m, inv, tome0, 0)).toBe(tome2)
    m.setU32(owner, 1) // restore monster owner for subsequent assertions
    m.setU32(st2 + 4, 20) // now full
    expect(INVENTORY_FindReagentForTome113c(m, inv, tome0, 0)).toBe(0)

    // Grid0 & Belt: startAfterItem = tome1, tome1->tome2->tome0_compat
    m.setU32(st2 + 4, 5)
    m.setU32(td2 + 0x70, tome0); m.setU32(td0 + 0x5c, inv)
    m.setU32(grids + 0x00, tome1)
    expect(INVENTORY_FindStackableCompatItemInGrid0_113c(m, inv, tome0, tome1)).toBe(tome2)
    m.setU32(st2 + 4, 20)
    expect(INVENTORY_FindStackableCompatItemInGrid0_113c(m, inv, tome0, tome2)).toBe(tome0)
    m.setU32(0x03500000 + 0xbd4, 0x46) // nIscCount === 0x46 -> qty=0 < 20
    expect(INVENTORY_FindStackableCompatItemInGrid0_113c(m, inv, tome0, tome2)).toBe(tome2)
    m.setU32(0x03500000 + 0xbd4, 359); m.setU32(st2 + 4, 5)
    expect(INVENTORY_FindStackableCompatItemInBelt113c(m, inv, tome0, tome1)).toBe(tome2)
    expect(INVENTORY_FindStackableCompatItemInBelt113c(m, inv, tome0, 0x03509999)).toBe(0) // missing startAfterItem
    m.setU32(inv + 0x18, 0) // nGridCount = 0 -> pGrid2 = 0
    expect(INVENTORY_FindStackableCompatItemInBelt113c(m, inv, tome0, 0)).toBe(0)
    m.setU32(inv + 0x18, 3)

    // QuiverDisplay: xbw in slot 4, lit in slot 5, bodyLoc=5
    m.setU32(owner, 0); m.setU32(owner + 0x10, 1)
    m.setU32(inv + 0x18, 3)
    const xbw = 0x03502000; const xd = 0x03502080
    const lit = 0x03502100; const ld = 0x03502180
    m.setU32(xbw, 4); m.setU32(xbw + 4, 1); m.setU32(xbw + 0x0c, 4); m.setU32(xbw + 0x14, xd); m.setU8(xd + 0x44, 4); m.setU32(xd + 0x5c, inv)
    m.setU32(lit, 4); m.setU32(lit + 4, 2); m.setU32(lit + 0x14, ld); m.setU8(ld + 0x44, 5); m.setU32(ld + 0x5c, inv)
    m.setU32(cells0 + 4 * 4, xbw); m.setU32(cells0 + 5 * 4, lit)
    m.setU32(0x6fdf1488, 1); m.setU32(0x6fdf0ba8, 0x20787878); m.setU32(0x6fdf0bb0, 0x2074696c) // gfx idx 1
    const a1 = 0x03502200; const a2 = 0x03502300
    INVENTORY_UpdateQuiverComponentDisplay113c(m, owner, lit, a1, a2)
    expect(m.u8(a1 + 6)).toBe(1)
    m.setU32(0x6fdf0bb0, 0) // gfx 0 -> 0xff
    INVENTORY_UpdateQuiverComponentDisplay113c(m, owner, lit, a1, a2)
    expect(m.u8(a1 + 6)).toBe(0xff)
    expect(m.u8(a2 + 6)).toBe(0xff)
  })

  it('UNITS_IsUnitInObjRectRange113c & UNITS_GetVelocity113c & INVENTORY_FindEquippedSkillChargeItem113c', () => {
    const m = makeTestMem1()
    const u = 0x03501000; const p0 = 0x03501100
    const obj = 0x03501200; const p1 = 0x03501300; const od = 0x03501400; const ot = 0x03501500
    m.setU32(u, 0); m.setU32(u + 0x2c, p0)
    m.setU32(obj, 2); m.setU32(obj + 0x14, od); m.setU32(obj + 0x2c, p1)
    m.setU32(od, ot); m.setU32(ot + 0xd0, 6); m.setU32(ot + 0xd4, 6)
    m.setU32(p1 + 0x0c, 50); m.setU32(p1 + 0x10, 50)
    m.setU16(p0 + 2, 50); m.setU16(p0 + 6, 55) // y === 47+6+2 === 55 -> inside!
    expect(UNITS_IsUnitInObjRectRange113c(m, u, obj)).toBe(1)
    m.setU32(ot + 0xd0, 0); m.setU32(ot + 0xd4, 0)
    m.setU32(u, 4); m.setU32(u + 0x2c, p1) // uType=4 (item, size=0) at (49,51) -> dist=1 != 0, hits L3308
    const pU = 0x03501600; m.setU32(u + 0x2c, pU); m.setU32(pU + 0x0c, 49); m.setU32(pU + 0x10, 51)
    expect(UNITS_IsUnitInObjRectRange113c(m, u, obj)).toBe(1)

    // UNITS_GetVelocity113c Holy Shield state 0x65 with uType = 3 (missile)
    const sl = 0x03502000; const st = 0x03502100; const sf = 0x03502200
    const sub = 0x03502300; const subSt = 0x03502400
    const inv = 0x03502500; const grids = 0x03502600; const cells = 0x03502700
    const sh = 0x03502800; const shd = 0x03502880
    m.setU32(0x03500000 + 0x40, 0x03538000); m.setU32(0x03500000 + 0x44, 16) // pSkillCode
    m.setU8(0x03538001, 7); m.setU8(0x03538002, 50); m.setU8(0x03538003, 0) // calcOff=1: push 50; ret
    m.setU32(0x03530000 + 2 * 0x23c + 0x138, 1) // calcOff = 1 -> 50%
    m.setU32(u, 3); m.setU32(u + 0x5c, sl); m.setU32(u + 0x60, inv)
    m.setU32(sl + 0x10, 0x80000000); m.setU32(sl + 0x48, st); m.setU16(sl + 0x4c, 1); m.setU16(sl + 0x4e, 4)
    m.setU32(sl + 0x58, sf); m.setU32(sl + 0x40, sub) // pMyStats = sub
    m.setU32(sf + (0x65 >> 5) * 4, 1 << (0x65 & 31))
    m.setU32(st, 0x001f0000); m.setU32(st + 4, 100)
    m.setU32(sub + 0x14, 0x65); m.setU32(sub + 0x24, subSt); m.setU16(sub + 0x28, 2); m.setU16(sub + 0x2a, 4)
    m.setU32(subSt, 0x015e0000); m.setU32(subSt + 4, 2)
    m.setU32(subSt + 8, 0x015f0000); m.setU32(subSt + 12, 3)
    m.setU32(inv, 0x01020304); m.setU32(inv + 0x14, grids); m.setU32(inv + 0x18, 1)
    m.setU8(grids + 0x08, 13); m.setU8(grids + 0x09, 1); m.setU32(grids + 0x0c, cells)
    m.setU32(cells + 5 * 4, sh); m.setU32(sh, 4); m.setU32(sh + 4, 3); m.setU32(sh + 0x14, shd); m.setU8(shd + 0x44, 5)
    expect(UNITS_GetVelocity113c(m, u)).toBe(150) // 100 * (100 + 50) / 100 = 150!
    m.setU32(u, 0) // uType = 0 (player) also uses Holy Shield velocity bonus
    expect(UNITS_GetVelocity113c(m, u)).toBe(150)

    // INVENTORY_FindEquippedSkillChargeItem113c socketed item + skId = -1 + skId = 32
    const itm = 0x03503000; const sock = 0x03503100; const sockD = 0x03503180; const sSl = 0x03503200; const sSub = 0x03503300; const sSt = 0x03503400
    m.setU32(itm, 4); m.setU32(itm + 0x60, inv); m.setU32(inv + 0x0c, sock)
    m.setU32(sock, 4); m.setU32(sock + 0x14, sockD); m.setU32(sockD + 0x5c, inv); m.setU32(sock + 0x5c, sSl)
    m.setU32(sSl + 0x10, 0x80000000); m.setU32(sSl + 0x3c, sSub)
    m.setU32(sSub + 0x10, 0x40); m.setU32(sSub + 0x24, sSt); m.setU16(sSub + 0x28, 2); m.setU16(sSub + 0x2a, 4)
    m.setU32(sSt, 0x00cc0083); m.setU32(sSt + 4, (7 << 8) | 3)
    m.setU32(sSt + 8, 0x00cc0803); m.setU32(sSt + 12, (7 << 8) | 3) // skId=32, lvl=3
    expect(INVENTORY_FindEquippedSkillChargeItem113c(m, itm, 2, 3, 0x03503500, 0x03503600)).toBe(1)
    expect(INVENTORY_FindEquippedSkillChargeItem113c(m, itm, -1, 3, 0, 0)).toBe(0)
    expect(INVENTORY_FindEquippedSkillChargeItem113c(m, itm, 32, 3, 0, 0)).toBe(0) // skId=32 >= 32 must return 0 even though stat exists

    // INVENTORY_FindReagentForTome113c pOwner === 0 -> else branch (mutating !== to === calls UNITS_GetInventoryRecordId113c(0) and throws)
    const invZero = 0x03503700
    m.setU32(invZero, 0x01020304); m.setU32(invZero + 0x08, 0)
    expect(INVENTORY_FindReagentForTome113c(m, invZero, itm)).toBe(0)
  })

  it('ITEMMODS_* & STATES_ApplyMonSkillIconToUnit113c edge cases', () => {
    const m = makeTestMem1()
    const item = 0x03501000; const sl = 0x03501100; const st = 0x03501200; const prop = 0x03501300
    const sub = 0x03501400; const subSt = 0x03501500; const sf = 0x03501600
    m.setU32(item, 4); m.setU32(item + 0x5c, sl)
    m.setU32(sl + 0x08, 4); m.setU32(sl + 0x10, 0x80000000); m.setU32(sl + 0x48, st); m.setU16(sl + 0x4e, 8); m.setU32(sl + 0x58, sf)
    m.setU32(sl + 0x3c, sub); m.setU32(sl + 0x40, sub)
    m.setU32(sub + 0x08, 4); m.setU32(sub + 0x10, 0x40); m.setU32(sub + 0x14, 0xa5)
    m.setU32(sub + 0x24, subSt); m.setU16(sub + 0x2a, 4); m.setU32(sub + 0x34, sl); m.setU32(sub + 0x38, item)

    // UpdateSetItemBonusStates subFlags without 0x2000 -> sets 0x2000
    const pd = 0x03501700
    m.setU32(item + 0x14, pd); m.setU32(pd, 5); m.setU32(pd + 0x34, 0)
    m.setU8(0x03519800 + 0x87, 2) // addFunc = 2
    ITEMMODS_UpdateSetItemBonusStates113c(m, item, 1)
    expect((m.u32(sub + 0x10) & 0x2000) !== 0).toBe(true)

    // CastSkillPropStat nSkillId === 32 boundary + chance === 1 clamped boundary
    m.setU16(0x03530000 + 32 * 0x23c, 32)
    m.setU32(prop + 4, 32); m.setU32(prop + 8, 20); m.setU32(prop + 12, 5)
    expect(ITEMMODS_ApplyCastSkillPropStat113c(m, 0, item, prop, 0xc3, 0, 0x40)).toBe(0)
    m.setU16(0x03530000 + 2 * 0x23c, 2)
    m.setU32(prop + 4, 2); m.setU32(prop + 8, 1); m.setU32(prop + 12, 5)
    expect(ITEMMODS_ApplyCastSkillPropStat113c(m, 0, item, prop, 0xc3, 0, 0x40)).toBe(1)

    // ClassSkills & AmazonSkills pStatList === 0 (alloc returns 0)
    const mNoAlloc = Object.assign(Object.create(Object.getPrototypeOf(m)), m, { alloc: () => 0 }) as SparseMemory113c
    m.setU32(item + 0x5c, 0)
    m.setU32(prop + 8, 2); m.setU32(prop + 12, 2)
    expect(() => ITEMMODS_ApplyClassSkillsPropStat113c(mNoAlloc, 0, item, prop, 0x55, 0, 0, 0x40)).toThrowError(D2CommonAssertError)
    expect(() => ITEMMODS_ApplyAmazonSkillsPropStat113c(mNoAlloc, 0, item, prop, 0, 0, 0x40)).toThrowError(D2CommonAssertError)

    // BaseStatOverridePropStat statId=0x20 (no reset) & statId=0x10 (reset)
    m.setU32(item + 0x5c, sl); m.setU32(prop + 4, 10)
    m.setU16(sl + 0x4c, 1); m.setU32(st, 0x00200000); m.setU32(st + 4, 50)
    ITEMMODS_ApplyBaseStatOverridePropStat113c(m, 0, 0, item, prop, 0x20, 0, 0, 0x40)
    expect(m.u32(st + 4)).toBe(60)
    m.setU32(st, 0x00100000); m.setU32(st + 4, 50)
    ITEMMODS_ApplyBaseStatOverridePropStat113c(m, 0, 0, item, prop, 0x10, 0, 0, 0x40)
    expect(m.u32(st + 4)).toBe(10)

    // STATES_ApplyMonSkillIconToUnit113c skId=0 & skId=2 with active skill
    const mon = 0x03502000; const mSl = 0x03502100; const mInfo = 0x03502200; const mSk = 0x03502300
    const mSub = 0x03502400; const mSubSt = 0x03502500
    const ps2 = 0x03530000 + 2 * 0x23c
    m.setU16(ps2, 2); m.setU16(ps2 + 0x94, 5); m.setU16(ps2 + 0x96, 5); m.setU16(ps2 + 0x98, 0x10); m.setU16(ps2 + 0x9a, 0x015d); m.setU16(ps2 + 0x9c, 0x8002)
    m.setU32(0x03500000 + 0x40, 0x03538000); m.setU32(0x03500000 + 0x44, 16)
    m.setU8(0x03538000, 7); m.setU8(0x03538001, 5); m.setU8(0x03538002, 0) // val=5
    m.setU32(mon, 1); m.setU32(mon + 0x5c, mSl); m.setU32(mon + 0xa8, mInfo)
    m.setU32(mSl + 0x08, 1); m.setU32(mSl + 0x10, 0x80000000); m.setU32(mSl + 0x3c, mSub)
    m.setU32(mSub + 0x08, 1); m.setU32(mSub + 0x10, 0x200040); m.setU32(mSub + 0x14, 5)
    m.setU32(mSub + 0x24, mSubSt); m.setU16(mSub + 0x2a, 8); m.setU32(mSub + 0x34, mSl); m.setU32(mSub + 0x38, mon)
    m.setU32(mInfo + 4, mSk); m.setU32(mSk, ps2); m.setU32(mSk + 0x28, 3)
    STATES_ApplyMonSkillIconToUnit113c(m, mon, 2)
    expect(m.u16(mSub + 0x28)).toBe(4) // 0x10 (layer=5), 0x15d, 0x15e, 0x15f; 0x8002 broke loop
    expect(m.u16(mSubSt + 10)).toBe(0x015d) // kills >> 16 -> >> 20
    expect(m.u16(mSubSt)).toBe(5) // layer=5 (not 0)
    const ps32 = 0x03530000 + 32 * 0x23c
    m.setU16(ps32 + 0x94, 5) // skId=32 === nSkillsTxtRecordCount -> must return early, not remove mSub
    STATES_ApplyMonSkillIconToUnit113c(m, mon, 32)
    expect(m.u32(mSl + 0x3c)).toBe(mSub)
    STATES_ApplyMonSkillIconToUnit113c(m, mon, 0)

    // Additional boundary & survivor assertions for I13A-1
    // BaseStatOverride: item classId=3 ('shld'), ItemsTxt[3].nMinAc=20 -> 0x10 resets 0x1f to 21, 0x0f does not!
    m.setU32(item + 4, 3)
    m.setU16(sl + 0x4c, 2); m.setU32(st, 0x000f0000); m.setU32(st + 4, 50); m.setU32(st + 8, 0x001f0000); m.setU32(st + 12, 10)
    ITEMMODS_ApplyBaseStatOverridePropStat113c(m, 0, 0, item, prop, 0x0f, 0, 0, 0x40)
    expect(m.u32(st + 4)).toBe(60); expect(m.u32(st + 12)).toBe(10) // 0x0f did NOT reset 0x1f
    m.setU32(st, 0x00100000); m.setU32(st + 4, 50); m.setU32(st + 8, 0x001f0000); m.setU32(st + 12, 10)
    ITEMMODS_ApplyBaseStatOverridePropStat113c(m, 0, 0, item, prop, 0x10, 0, 0, 0x40)
    expect(STATLIST_GetStatValue113c(m, sl, 0x1f, 0)).toBe(21)

    // bNegate=1 for AddDamageTriplet (0x15), ClassSkills (0x53), AmazonSkills (0x7e), DmgToUndead (0x7f)
    m.setU32(sl + 0x3c, sub); m.setU32(sl + 0x40, sub); m.setU32(sub + 0x10, 0x80000040); m.setU32(sub + 0x14, 0)
    const minOwner = 0x03501800; m.setU32(minOwner, 0); m.setU32(sub + 0x44, minOwner)
    m.setU16(sub + 0x28, 1); m.setU32(subSt, 0x00150000); m.setU32(subSt + 4, 10)
    m.setU32(prop + 4, 0); m.setU32(prop + 8, 5); m.setU32(prop + 12, 10)
    ITEMMODS_ApplyAddDamageTripletPropStat113c(m, 0, item, prop, 0x15, 1, 0, 0x40) // bNegate=1
    expect(m.u16(sub + 0x28)).toBe(0) // 10 + (-10) = 0 -> stat removed

    // ISC[0x53] (+0x690c), ISC[0x7e] (+0x9f78), ISC[0x7f] (+0xa0bc) with minVal=20 clamping
    m.setU8(0x03535000 + 0x690c + 5, 4); m.setU32(0x03535000 + 0x690c + 0x2c, 20)
    m.setU8(0x03535000 + 0x7e * 0x144 + 5, 4); m.setU32(0x03535000 + 0x7e * 0x144 + 0x2c, 20)
    m.setU8(0x03535000 + 0xa0bc + 5, 4); m.setU32(0x03535000 + 0xa0bc + 0x2c, 20)

    m.setU32(0x03500000 + 0xbd4, 359)
    m.setU16(sub + 0x28, 1); m.setU32(subSt, 0x00530000); m.setU32(subSt + 4, 5)
    ITEMMODS_ApplyClassSkillsPropStat113c(m, 0, item, prop, 0x53, 1, 0, 0x40)
    expect(m.u16(sub + 0x28)).toBe(1) // clamped base=20, negated 5 -> -15 (stays)
    expect(m.u32(subSt + 4)).toBe((-15) >>> 0)
    m.setU16(sub + 0x28, 1); m.setU32(0x03500000 + 0xbd4, 0x53); m.setU32(subSt + 4, 5)
    ITEMMODS_ApplyClassSkillsPropStat113c(m, 0, item, prop, 0x53, 1, 0, 0x40)
    expect(m.u16(sub + 0x28)).toBe(1); expect(m.u32(subSt + 4)).toBe(5) // nIscCount===0x53 -> rolled=0 -> stays 5

    m.setU32(0x03500000 + 0xbd4, 0x7e); m.setU32(subSt, 0x007e0001); m.setU32(subSt + 4, 5)
    ITEMMODS_ApplyAmazonSkillsPropStat113c(m, 0, item, prop, 1, 0, 0x40)
    expect(m.u16(sub + 0x28)).toBe(1); expect(m.u32(subSt + 4)).toBe(5) // nIscCount===0x7e -> rolled=0 -> stays 5

    m.setU32(0x03500000 + 0xbd4, 359); m.setU16(sub + 0x28, 1); m.setU32(subSt, 0x007f0000); m.setU32(subSt + 4, 5)
    ITEMMODS_ApplyDmgToUndeadPropStat113c(m, 0, 0, item, prop, 1, 1, 0, 0x40)
    expect(m.u16(sub + 0x28)).toBe(1) // clamped base=20, negated 5 -> -15 (stays)
    expect(m.u32(subSt + 4)).toBe((-15) >>> 0)
    m.setU16(sub + 0x28, 1); m.setU32(0x03500000 + 0xbd4, 0x7f); m.setU32(subSt + 4, 5)
    expect(ITEMMODS_ApplyDmgToUndeadPropStat113c(m, 0, 0, item, prop, 1, 1, 0, 0x40)).toBe(1)
    expect(m.u16(sub + 0x28)).toBe(1); expect(m.u32(subSt + 4)).toBe(5)

    m.setU32(0x03500000 + 0xbd4, 359)
    m.setU32(prop + 4, 3); m.setU32(prop + 8, 2); m.setU32(prop + 12, 5)
    m.setU16(sl + 0x4c, 0)
    ITEMMODS_ApplyPackedDamageRangePropStat113c(m, 0, item, prop, 0, 0, 0x40)
    expect(m.u16(sl + 0x4c)).toBeGreaterThan(0) // nVal=3 accepted
  })
})
