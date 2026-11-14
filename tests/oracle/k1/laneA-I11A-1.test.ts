import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.js'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js'
import { COMPOSIT_GetWeaponClassCode113c } from '../../../src/d2kern-113c/common/composit.js'
import { INVENTORY_EmptyInventory113c, INVENTORY_FindGridPlacementMode0_113c, INVENTORY_FindGridPlacementMode1_113c, INVENTORY_FindGridPlacementMode2_113c, INVENTORY_FindGridPlacementMode3_113c, INVENTORY_GetItemEquipLocation113c, INVENTORY_RemoveItemFromInventory113c, INVENTORY_SetCursorItem113c } from '../../../src/d2kern-113c/common/inventory.js'
import { ITEMS_AddOrSetStatOnStatList113c, ITEMS_ApplyElemMasteryOrPierceStat113c, ITEMS_ApplySkillBonusStat113c } from '../../../src/d2kern-113c/common/statlist.js'
import { UNITS_FindFreeCoords113c, UNITS_SetTargetUnitForDynamicUnitEx113c, UNITS_TestCollisionBetweenUnitsWithDoors113c } from '../../../src/d2kern-113c/common/unit.js'
import {
  UNITS_GetDistanceToOtherUnit113c,
  UNITS_GetMeleeRange113c,
} from '../../../src/d2kern-113c/common/unit.js'

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

const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i11a-1-vectors.ndjson')

const DISPATCH: Record<string, (m: SparseMemory113c, args: number[]) => number | void> = {
  '0x6FD70520': (m, a) => INVENTORY_FindGridPlacementMode0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FD70560': (m, a) => INVENTORY_FindGridPlacementMode1_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FD705A0': (m, a) => INVENTORY_FindGridPlacementMode2_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FD705E0': (m, a) => INVENTORY_FindGridPlacementMode3_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FD71710': (m, a) => INVENTORY_EmptyInventory113c(m, a[0]!),
  '0x6FD71790': (m, a) => INVENTORY_SetCursorItem113c(m, a[0]!, a[1]!),
  '0x6FD71B00': (m, a) => INVENTORY_RemoveItemFromInventory113c(m, a[0]!, a[1]!),
  '0x6FD81260': (m, a) => INVENTORY_GetItemEquipLocation113c(m, a[0]!, a[1]!),
  '0x6FD815E0': (m, a) => UNITS_FindFreeCoords113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD818C0': (m, a) => UNITS_SetTargetUnitForDynamicUnitEx113c(m, a[0]!),
  '0x6FD93860': (m, a) => COMPOSIT_GetWeaponClassCode113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FD975E0': (m, a) => ITEMS_AddOrSetStatOnStatList113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FD97EF0': (m, a) => ITEMS_ApplySkillBonusStat113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FD97FA0': (m, a) => ITEMS_ApplyElemMasteryOrPierceStat113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FD9D760': (m, a) => UNITS_TestCollisionBetweenUnitsWithDoors113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
}

describe('K1 Iteration 11 Lane A — I11A-1 composit/inventory/statlist/unit differential replay', () => {
  const vectors = loadVectors(FIXTURE_PATH)

  it('covers all 15 net-new VAs in i11a-1-vectors.ndjson with >= 2 non-degenerate vectors each', () => {
    const counts = new Map<string, number>()
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1)
    }
    expect(Object.keys(DISPATCH).length).toBe(15)
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

  it('0x6FDCFCD0 UNITS_GetMeleeRange113c is a direct identity alias of UNITS_GetDistanceToOtherUnit113c', () => {
    expect(UNITS_GetMeleeRange113c).toBe(UNITS_GetDistanceToOtherUnit113c)
  })

})
