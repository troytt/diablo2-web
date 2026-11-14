import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  ITEMS_CheckIfSocketFiller113c,
  ITEMS_GetActiveWeaponForAttack113c,
  ITEMS_GetMissileType113c,
} from '../../../src/d2kern-113c/common/items.ts'
import {
  SKILLS_ApplyElementalMasteryBonus113c,
  SKILLS_CheckItemChargedSkillHasCharges113c,
  SKILLS_GetBasePhysDamageMinOrMax113c,
  SKILLS_GetWeaponFromArmSlot113c,
  STATES_CheckUnitAnyActiveStateMask113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  ITEMS_GetQuiverType113c,
  ITEMS_GetWeaponClassCode113c,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'

interface VectorRecord {
  va: string
  name: string
  caseId: string
  args: number[]
  retMask: number
  eax: number
  pre: { addr: number; hex: string }[]
  /** Present when the real DLL hit its Fog assert (0x6FD5921C, captured line) instead of returning. */
  expectedAssert?: { line: number }
  post: { addr: number; hex: string }[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b039-vectors.ndjson')

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
  '0x6FD72F20': (m, a) => ITEMS_GetQuiverType113c(m, a[0]!) >>> 0,
  '0x6FD72F50': (m, a) => ITEMS_GetMissileType113c(m, a[0]!) >>> 0,
  '0x6FD73330': (m, a) => ITEMS_GetWeaponClassCode113c(m, a[0]!) >>> 0,
  '0x6FD745C0': (m, a) => ITEMS_CheckIfSocketFiller113c(m, a[0]!) >>> 0,
  '0x6FD81B90': (m, a) => ITEMS_GetActiveWeaponForAttack113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD83F40': (m, a) => STATES_CheckUnitAnyActiveStateMask113c(m, a[0]!) >>> 0,
  '0x6FD9EBF0': (m, a) => SKILLS_GetWeaponFromArmSlot113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD9F870': (m, a) => SKILLS_ApplyElementalMasteryBonus113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD9F930': (m, a) => SKILLS_GetBasePhysDamageMinOrMax113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDA0870': (m, a) => SKILLS_CheckItemChargedSkillHasCharges113c(m, a[0]!, a[1]!) >>> 0,
}

describe('K1r2 Iteration 8 Lane B — B039 items, skills, datatbls internalComposite differential verification (10 functions)', () => {
  it('loads all 10 B039 function VAs and >= 50 real-DLL vectors', () => {
    expect(VECTORS.length).toBeGreaterThanOrEqual(50)
    const uniqueVas = new Set(VECTORS.map((v) => v.va))
    expect(uniqueVas.size).toBe(10)
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
      if (v.expectedAssert !== undefined) {
        let thrown: unknown
        try {
          fn!(m, v.args)
        } catch (e) {
          thrown = e
        }
        expect(thrown).toBeInstanceOf(D2CommonAssertError)
        expect((thrown as D2CommonAssertError).line).toBe(v.expectedAssert.line)
        return
      }
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
})
