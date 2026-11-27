import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  INVENTORY_GetBeltItem113c,
  INVENTORY_GetEquippedShield113c,
  INVENTORY_GetItemBodyLocFromX113c,
  INVENTORY_GetItemDimensionsCallback113c,
  INVENTORY_GetItemGridXIfInInventory113c,
  INVENTORY_GetSecondaryWeapon113c,
  INVENTORY_RemoveItemFromGrid113c,
  ITEMS_AreStackablesCompatible113c,
} from '../../../src/d2kern-113c/common/inventory.js'
import {
  PATH_ResetDynamicPathRoomAndCoordsInline113c,
  STATES_UpdateGfxStateFlagsByMask113c,
  UNITROOM_SortUnitListByY113c,
  UNITROOM_UnlinkUnitFromUpdateList113c,
  UNITS_AreUnitsAligned113c,
  UNITS_GetDiminishingStatBonusInline113c,
  UNITS_GetSpawnedMonsterOrSkillSummonInfo113c,
  UNITS_SetUnitUpdateFlags113c,
  UNITS_TransferStateMaskToRemoved113c,
} from '../../../src/d2kern-113c/common/unit.js'
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
  '../../fixtures/oracle/k1/b045-vectors.ndjson',
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
    const u = a >>> 0
    const ok = readSpans.some((s) => u >= s.start && u < s.end)
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
    origWriteByte(a, v)
  }

  const dumpHex = (addr: number, len: number): string => {
    const out = Buffer.alloc(len)
    for (let i = 0; i < len; i++) {
      out[i] = origReadByte((addr + i) >>> 0) & 0xff
    }
    return out.toString('hex')
  }

  return { m, rogueReads, rogueWrites, dumpHex }
}

const DISPATCH: Record<
  string,
  (m: SparseMemory113c, args: number[]) => number
> = {
  '0x6FD6E5B0': (m, a) => INVENTORY_GetBeltItem113c(m, a[0]!, a[1]!),
  '0x6FD6E600': (m, a) =>
    INVENTORY_GetItemGridXIfInInventory113c(m, a[0]!, a[1]!),
  '0x6FD6E630': (m, a) => INVENTORY_GetItemBodyLocFromX113c(m, a[0]!, a[1]!),
  '0x6FD6F720': (m, a) => {
    INVENTORY_RemoveItemFromGrid113c(m, a[0]!, a[1]!, a[2]!)
    return 0
  },
  '0x6FD6FF40': (m, a) => INVENTORY_GetEquippedShield113c(m, a[0]!, a[1]!),
  '0x6FD70270': (m, a) => INVENTORY_GetSecondaryWeapon113c(m, a[0]!),
  '0x6FD72CD0': (m, a) => ITEMS_AreStackablesCompatible113c(m, a[0]!, a[1]!),
  '0x6FD731A0': (m, a) => {
    INVENTORY_GetItemDimensionsCallback113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
    )
    return 0
  },
  '0x6FD5D540': (m, a) => {
    PATH_ResetDynamicPathRoomAndCoordsInline113c(m, a[0]!)
    return 0
  },
  '0x6FD6A3D0': (m, a) =>
    UNITS_GetSpawnedMonsterOrSkillSummonInfo113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
      a[6]!,
    ),
  '0x6FD80DC0': (m, a) => {
    UNITS_SetUnitUpdateFlags113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD823E0': (m, a) =>
    UNITS_GetDiminishingStatBonusInline113c(m, a[0]!, a[1]!),
  '0x6FD84080': (m, a) => {
    UNITS_TransferStateMaskToRemoved113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD84150': (m, a) => {
    STATES_UpdateGfxStateFlagsByMask113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FDB6900': (m, a) => UNITROOM_SortUnitListByY113c(m, a[0]!, a[1]!),
  '0x6FDD4D30': (m, a) => UNITS_AreUnitsAligned113c(m, a[0]!, a[1]!),
}

describe('Lane A B045 real-DLL differential vectors (inventory + unit internalComposite)', () => {
  const vectors = loadVectors()

  it('has vectors for all 16 B045 VAs', () => {
    const seen = new Set(vectors.map((v) => v.va))
    for (const va of Object.keys(DISPATCH)) {
      expect(seen.has(va), `missing vectors for ${va}`).toBe(true)
    }
    expect(seen.size).toBe(16)
  })

  for (const vec of vectors) {
    it(`${vec.va} ${vec.name} [case ${vec.caseIndex}: ${vec.note}]`, () => {
      const fn = DISPATCH[vec.va]
      expect(fn).toBeDefined()
      const { m, rogueReads, rogueWrites, dumpHex } = createStrictMemory(
        vec.inputs.memory,
        vec.outputs.memory,
      )
      const args = vec.inputs.args.map(parseArg)
      if (vec.expectedAssert !== undefined) {
        let thrown: unknown
        try {
          fn!(m, args)
        } catch (e) {
          thrown = e
        }
        expect(thrown).toBeInstanceOf(D2CommonAssertError)
        expect((thrown as D2CommonAssertError).line).toBe(vec.expectedAssert.line)
        expect(rogueReads).toEqual([])
        return
      }
      const ret = fn!(m, args) >>> 0
      const mask = Number.parseInt(vec.outputs.retMask, 16) >>> 0
      const expectedEax = Number.parseInt(vec.outputs.eax, 16) >>> 0
      expect((ret & mask) >>> 0).toBe((expectedEax & mask) >>> 0)

      for (const blk of vec.outputs.memory) {
        const addr = Number.parseInt(blk.base, 16) >>> 0
        const len = blk.hex.length >>> 1
        expect(dumpHex(addr, len)).toBe(blk.hex.toLowerCase())
      }

      expect(rogueReads).toEqual([])
      expect(rogueWrites).toEqual([])
    })
  }

  it('covers UNITROOM_UnlinkUnitFromUpdateList113c null-room and non-null updateNext assert', () => {
    const m = new SparseMemory113c()
    const u = 0x03501000
    m.loadBlock(u, Buffer.alloc(0x100))
    UNITROOM_UnlinkUnitFromUpdateList113c(m, u)
    expect(m.u32(u + 0xe0)).toBe(0)

    // pRoom == 0 with pRoomUpdateNext (+0xe0) != 0 throws line 0x132
    m.setU32(u + 0xe0, 0x03501200)
    expect(() => UNITROOM_UnlinkUnitFromUpdateList113c(m, u)).toThrow(D2CommonAssertError)
  })
})
