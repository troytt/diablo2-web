import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  SKILLS_AllocSkillList113c,
  SKILLS_EvaluateSkillManaCost113c,
  SKILLS_FreeSkillList113c,
  SKILLS_GetCharges113c,
  SKILLS_GetItemSkillInfo113c,
  SKILLS_GetOwnerItemGuid113c,
  SKILLS_GetParam1113c,
  SKILLS_GetParam2113c,
  SKILLS_GetParam3113c,
  SKILLS_GetParam4113c,
  SKILLS_HasSkillByTxtRecord113c,
  SKILLS_SetCharges113c,
  SKILLS_SetLeftSkill113c,
  SKILLS_SetParam0C113c,
  SKILLS_SetParam1113c,
  SKILLS_SetParam2113c,
  SKILLS_SetParam3113c,
  SKILLS_SetParam4113c,
  SKILLS_SetRightSkill113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { ANIMTBLS_CompareCode8113c } from '../../../src/d2kern-113c/tables/anim-tbls-113c.ts'
import {
  FIELD_AllocField113c,
  FIELD_FreeField113c,
  FIELD_StepFieldCoords113c,
} from '../../../src/d2kern-113c/tables/field-tbls-113c.ts'
import { DATATBLS_GetItemIdFromItemCode113c } from '../../../src/d2kern-113c/tables/item-tbls-113c.ts'

interface VectorRecord {
  va: string
  name: string
  caseId: string
  args: number[]
  retMask: number
  eax: number
  pre: { addr: number; hex: string }[]
  post: { addr: number; hex: string }[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b036-vectors.ndjson')

const VECTORS: VectorRecord[] = readFileSync(FIXTURE_PATH, 'utf8')
  .trim()
  .split('\n')
  .filter((line) => line.length > 0)
  .map((line) => JSON.parse(line) as VectorRecord)

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >>> 1)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function toHex(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i]!.toString(16).padStart(2, '0')
  }
  return s
}

class StrictMem extends SparseMemory113c {
  readonly allowed = new Set<number>()
  readonly rogueWrites: number[] = []

  stage(addr: number, hex: string): void {
    const bytes = fromHex(hex)
    const u = addr >>> 0
    for (let i = 0; i < bytes.length; i++) {
      this.allowed.add((u + i) >>> 0)
    }
    this.loadBlock(u, bytes)
  }

  private checkReadRange(p: number, width: number): void {
    const u = p >>> 0
    for (let i = 0; i < width; i++) {
      const a = (u + i) >>> 0
      if (!this.allowed.has(a)) {
        throw new Error(`Unstaged read at 0x${a.toString(16)}`)
      }
    }
  }

  private checkWriteRange(p: number, width: number): void {
    const u = p >>> 0
    for (let i = 0; i < width; i++) {
      const a = (u + i) >>> 0
      if (!this.allowed.has(a)) {
        this.rogueWrites.push(a)
      }
    }
  }

  override u8(p: number): number {
    this.checkReadRange(p, 1)
    return super.u8(p)
  }

  override u16(p: number): number {
    this.checkReadRange(p, 2)
    return super.u16(p)
  }

  override u32(p: number): number {
    this.checkReadRange(p, 4)
    return super.u32(p)
  }

  override setU8(p: number, v: number): void {
    this.checkWriteRange(p, 1)
    super.setU8(p, v)
  }

  override setU16(p: number, v: number): void {
    this.checkWriteRange(p, 2)
    super.setU16(p, v)
  }

  override setU32(p: number, v: number): void {
    this.checkWriteRange(p, 4)
    super.setU32(p, v)
  }

  override get(base: number, f: FieldLayout113c, index = 0): number {
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    this.checkReadRange((base + f.off + index * width) >>> 0, width)
    return super.get(base, f, index)
  }

  override set(base: number, f: FieldLayout113c, v: number, index = 0): void {
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    this.checkWriteRange((base + f.off + index * width) >>> 0, width)
    super.set(base, f, v, index)
  }
}

const DISPATCH: Record<string, (m: StrictMem, args: number[]) => number> = {
  '0x6FD91D00': (m, a) => ANIMTBLS_CompareCode8113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD9DD30': (m, a) => {
    SKILLS_SetCharges113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD9DD70': (m, a) => SKILLS_GetCharges113c(m, a[0]!) >>> 0,
  '0x6FD9DE60': (m, a) => {
    SKILLS_SetParam0C113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD9DEA0': (m, a) => {
    SKILLS_SetParam4113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD9DEE0': (m, a) => {
    SKILLS_SetParam3113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD9DF20': (m, a) => {
    SKILLS_SetParam2113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD9DF60': (m, a) => {
    SKILLS_SetParam1113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD9DFA0': (m, a) => SKILLS_GetParam4113c(m, a[0]!) >>> 0,
  '0x6FD9DFD0': (m, a) => SKILLS_GetParam3113c(m, a[0]!) >>> 0,
  '0x6FD9E000': (m, a) => SKILLS_GetParam2113c(m, a[0]!) >>> 0,
  '0x6FD9E030': (m, a) => SKILLS_GetParam1113c(m, a[0]!) >>> 0,
  '0x6FD9E240': (m, a) => SKILLS_GetItemSkillInfo113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) >>> 0,
  '0x6FD9E2B0': (m, a) => SKILLS_GetOwnerItemGuid113c(m, a[0]!) >>> 0,
  '0x6FD9E3F0': (m, a) => SKILLS_AllocSkillList113c(m, a[0]!) >>> 0,
  '0x6FD9E6D0': (m, a) => SKILLS_EvaluateSkillManaCost113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD9EB40': (m, a) => SKILLS_HasSkillByTxtRecord113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD9ECC0': (m, a) => {
    SKILLS_SetRightSkill113c(m, a[0]!, a[1]!, a[2]!)
    return 0
  },
  '0x6FD9ED60': (m, a) => {
    SKILLS_SetLeftSkill113c(m, a[0]!, a[1]!, a[2]!)
    return 0
  },
  '0x6FD9F000': (m, a) => {
    SKILLS_FreeSkillList113c(m, a[0]!)
    return 0
  },
  '0x6FDC1940': (m, a) => DATATBLS_GetItemIdFromItemCode113c(m, a[0]!) >>> 0,
  '0x6FDCE290': (m, a) => FIELD_StepFieldCoords113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FDCE3D0': (m, a) => {
    FIELD_FreeField113c(m, a[0]!)
    return 0
  },
  '0x6FDCE410': (m) => FIELD_AllocField113c(m) >>> 0,
}

describe('K1r2 Iteration 7 Lane B — B036 skills, anim, field, item table differential verification (24 functions)', () => {
  it('loads all 24 net-new B036 function VAs and >= 72 real-DLL vectors', () => {
    expect(VECTORS.length).toBeGreaterThanOrEqual(72)
    const uniqueVas = new Set(VECTORS.map((v) => v.va))
    expect(uniqueVas.size).toBe(24)
    for (const va of Object.keys(DISPATCH)) {
      expect(uniqueVas.has(va)).toBe(true)
    }
  })

  for (const v of VECTORS) {
    it(`${v.va} ${v.name} [${v.caseId}]`, () => {
      const m = new StrictMem()
      for (const blk of v.pre) {
        m.stage(blk.addr >>> 0, blk.hex)
      }
      const fn = DISPATCH[v.va]
      expect(fn).toBeDefined()
      const eax = fn!(m, v.args) >>> 0
      const mask = v.retMask >>> 0
      if (mask !== 0) {
        expect((eax & mask) >>> 0).toBe((v.eax & mask) >>> 0)
      }
      expect(m.rogueWrites).toEqual([])
      for (const blk of v.post) {
        const actual = m.readBytes(blk.addr >>> 0, blk.hex.length >>> 1)
        expect(toHex(actual)).toBe(blk.hex)
      }
    })
  }

  describe('Fog.#10023 assert paths and negative-control mutation sensitivity', () => {
    it('throws D2CommonAssertError with exact file and line numbers on Fog.#10023 paths', () => {
      const m = new StrictMem()
      expect(() => SKILLS_GetItemSkillInfo113c(m, 0, 0, 0, 0, 0)).toThrowError(
        new D2CommonAssertError('Skills.cpp', 0x642),
      )
      expect(() => SKILLS_GetOwnerItemGuid113c(m, 0)).toThrowError(
        new D2CommonAssertError('Skills.cpp', 0x638),
      )
      expect(() => FIELD_StepFieldCoords113c(m, 0, 1, 2)).toThrowError(
        new D2CommonAssertError('FieldTbls.cpp', 0xbf),
      )
      expect(() => FIELD_FreeField113c(m, 0)).toThrowError(
        new D2CommonAssertError('FieldTbls.cpp', 0x93),
      )
    })

    it('detects mutated return values or output memory across all 24 B036 functions', () => {
      for (const va of Object.keys(DISPATCH)) {
        const sample = VECTORS.find(
          (v) => v.va === va && v.post.length > 0 && (v.retMask !== 0 || v.caseId.includes('match') || v.caseId.includes('free')),
        ) ?? VECTORS.find((v) => v.va === va)!
        const m = new StrictMem()
        for (const blk of sample.pre) {
          m.stage(blk.addr >>> 0, blk.hex)
        }
        const eax = DISPATCH[va]!(m, sample.args) >>> 0
        const mask = sample.retMask >>> 0
        if (mask !== 0) {
          const mutated = ((eax ^ 1) & mask) >>> 0
          expect(mutated).not.toBe((sample.eax & mask) >>> 0)
        } else {
          const outBlk = sample.post.find((b, i) => b.hex !== sample.pre[i]?.hex) ?? sample.post[0]!
          const actual = m.readBytes(outBlk.addr >>> 0, outBlk.hex.length >>> 1)
          actual[0] ^= 0xff
          expect(toHex(actual)).not.toBe(outBlk.hex)
        }
      }
    })
  })
})
