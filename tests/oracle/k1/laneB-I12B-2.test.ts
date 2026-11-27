import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  ITEMMODS_ApplyDmgMaxProperty113c,
  ITEMMODS_ApplyDmgMinProperty113c,
  ITEMMODS_ApplyEnhancedDamagePercentProperty113c,
  ITEMMODS_ApplyStatMaxProperty113c,
  ITEMMODS_ApplyStatMinProperty113c,
  ITEMMODS_ApplyStatRolledProperty113c,
} from '../../../src/d2kern-113c/common/items.ts'
import {
  MISSILE_EvalCalcOwnerSkillFieldByCtx113c,
  SKILLS_CalcKickBootDamage113c,
  SKILLS_EvalCalcByOffset113c,
  SKILLS_GetSkillNumTargetsOrShots113c,
  SKILLS_GetSkillPhysMaxDamage113c,
  SKILLS_GetSkillPhysMinDamage113c,
  SKILLS_GetSkillUseFailReason113c,
  SKILLS_IsSkillBlockedByState113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { STATLIST_GetUnitStat113c } from '../../../src/d2kern-113c/common/statlist.ts'

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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i12b-2-vectors.ndjson')

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
  private inAlloc = false

  stage(addr: number, hex: string): void {
    const bytes = fromHex(hex)
    const u = addr >>> 0
    for (let i = 0; i < bytes.length; i++) {
      this.allowed.add((u + i) >>> 0)
    }
    this.loadBlock(u, bytes)
  }

  override alloc(size: number): number {
    this.inAlloc = true
    const p = super.alloc(size)
    this.inAlloc = false
    for (let i = 0; i < size; i++) {
      this.allowed.add((p + i) >>> 0)
    }
    return p
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

  override fill(p: number, len: number, v: number): void {
    if (!this.inAlloc) this.checkWriteRange(p, len)
    super.fill(p, len, v)
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
  '0x6FD98E70': (m, a) =>
    ITEMMODS_ApplyDmgMaxProperty113c(
      m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!,
    ) >>> 0,
  '0x6FD98FC0': (m, a) =>
    ITEMMODS_ApplyDmgMinProperty113c(
      m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!,
    ) >>> 0,
  '0x6FD991C0': (m, a) =>
    ITEMMODS_ApplyStatRolledProperty113c(
      m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!,
    ) >>> 0,
  '0x6FD99260': (m, a) =>
    ITEMMODS_ApplyStatMaxProperty113c(
      m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!,
    ) >>> 0,
  '0x6FD992D0': (m, a) =>
    ITEMMODS_ApplyStatMinProperty113c(
      m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!,
    ) >>> 0,
  '0x6FD99340': (m, a) =>
    ITEMMODS_ApplyEnhancedDamagePercentProperty113c(
      m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!,
    ) >>> 0,
  '0x6FDA1000': (m, a) => SKILLS_GetSkillNumTargetsOrShots113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDA1C60': (m, a) => {
    SKILLS_CalcKickBootDamage113c(m, a[0]!, a[1]!, a[2]!, a[3]!)
    return 0
  },
  '0x6FDBB430': (m, a) =>
    MISSILE_EvalCalcOwnerSkillFieldByCtx113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDA1BF0': (m, a) =>
    SKILLS_EvalCalcByOffset113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDA1FF0': (m, a) =>
    SKILLS_GetSkillPhysMaxDamage113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDA2100': (m, a) =>
    SKILLS_GetSkillPhysMinDamage113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDA2210': (m, a) => SKILLS_IsSkillBlockedByState113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDA2340': (m, a) => SKILLS_GetSkillUseFailReason113c(m, a[0]!, a[1]!) >>> 0,
}

function stageAll(v: VectorRecord): StrictMem {
  const m = new StrictMem()
  for (const blk of v.pre) {
    m.stage(blk.addr >>> 0, blk.hex)
  }
  return m
}

describe('K1r9 Iteration 12 Lane B — I12B-2 differential verification (14 functions)', () => {
  it('loads all 14 I12B-2 function VAs from the real-DLL fixture', () => {
    const uniqueVas = new Set(VECTORS.map((v) => v.va))
    expect(uniqueVas.size).toBe(14)
    expect(new Set(Object.keys(DISPATCH))).toEqual(uniqueVas)
  })

  for (const v of VECTORS) {
    it(`${v.va} ${v.name} [${v.caseId}]`, () => {
      const m = stageAll(v)
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

  it('covers I12B-2 assertions and boundary branches', () => {
    const m = new SparseMemory113c()
    m.fill(0x6fde9e00, 0x2000, 0)
    m.fill(0x6fdefb90, 0x20, 0)
    m.fill(0x6fdd90b0, 0x10, 0)
    m.fill(0x6000, 0x80, 0)
    m.setU32(0x6fdd90b0, 0x6000)
    m.fill(0x5000, 0xd00, 0)
    m.setU32(0x6fde9e1c, 0x5000)
    m.fill(0x1000, 0x400, 0)
    expect(() =>
      ITEMMODS_ApplyDmgMaxProperty113c(m, 0, 0, 0x1000, 0, 0, 0, 0, 0, 0),
    ).toThrowError(D2CommonAssertError)
    expect(() =>
      ITEMMODS_ApplyDmgMinProperty113c(m, 0, 0, 0x1000, 0, 0, 0, 0, 0, 0),
    ).toThrowError(D2CommonAssertError)
    expect(
      ITEMMODS_ApplyEnhancedDamagePercentProperty113c(
        m, 0, 0, 0, 0, 0x11, 0, 0, 0, 0, 0,
      ),
    ).toBe(0)
    expect(SKILLS_GetSkillUseFailReason113c(m, 0, 0x1000)).toBe(3)
    expect(() => SKILLS_GetSkillUseFailReason113c(m, 0x1000, 0)).toThrowError(
      D2CommonAssertError,
    )
    expect(SKILLS_EvalCalcByOffset113c(m, 0x1000, 0x123, 0, 1)).toBe(0)
    expect(MISSILE_EvalCalcOwnerSkillFieldByCtx113c(m, 0, 0, 0, 0)).toBe(0)
    expect(SKILLS_IsSkillBlockedByState113c(m, 0, 0x1000)).toBe(1)
  })

  it('covers I12B-2 mutation boundary cases', () => {
    const getVec = (name: string, caseId: string): VectorRecord => {
      const v = VECTORS.find((x) => x.name === name && x.caseId === caseId)
      if (!v) throw new Error(`Missing vector ${name}:${caseId}`)
      return v
    }

    // n=68: ITEMMODS_ApplyDmgMinProperty113c skips 0x17 when pAltTxt nMinDam === 1 and n2HandMinDam === 0
    {
      const v = getVec('ITEMMODS_ApplyDmgMinProperty113c', 'maul_2h_only')
      const m = stageAll(v)
      m.setU8(0x20009000 + 1 * 0x1a8 + 0xfe, 1)
      m.setU8(0x20009000 + 1 * 0x1a8 + 0x102, 0)
      ITEMMODS_ApplyDmgMinProperty113c(
        m, v.args[0]!, v.args[1]!, v.args[2]!, v.args[3]!, v.args[4]!, v.args[5]!, v.args[6]!, v.args[7]!, v.args[8]!,
      )
      expect(STATLIST_GetUnitStat113c(m, v.args[1]!, 0x17, 0)).toBe(0)
    }

    // n=89 & n=90: SKILLS_GetSkillNumTargetsOrShots113c returns 2 (not 1) for monster (dwUnitType=1) using bow even with state mask active
    {
      const v = getVec('SKILLS_GetSkillNumTargetsOrShots113c', 'elem3_bow_statemask_1')
      const m = stageAll(v)
      m.setU32(0x20030000, 1) // dwUnitType = 1 (monster)
      m.setU32(0x20030004, 0) // classId = 0
      m.setU32(0x20030010, 1) // mode = 1
      m.setU32(0x2001d000 + 0x10, 0x20776f62) // MonStats2Txt[0] wclass = 'bow ' -> nShots = 2
      expect(SKILLS_GetSkillNumTargetsOrShots113c(m, v.args[0]!, v.args[1]!)).toBe(2)
    }

    // n=92: SKILLS_CalcKickBootDamage113c reads kickPct even when pStatListEx === 1
    {
      const v = getVec('SKILLS_CalcKickBootDamage113c', 'no_inv_kickpct')
      const m = stageAll(v)
      m.stage(0x1, '00'.repeat(0x60))
      const unit = v.args[0]!
      m.setU32(unit + 0x5c, 1)
      m.setU32(1 + 0x10, 0x80000000)
      m.setU32(1 + 0x44, unit)
      m.setU32(1 + 0x48, 0x20030b00)
      m.setU16(1 + 0x4c, 1)
      m.setU32(0x20030b00, 0x89 << 16)
      m.setU32(0x20030b04, 7)
      m.setU32(v.args[1]!, 0)
      m.setU32(v.args[2]!, 0)
      m.setU32(v.args[3]!, 0)
      SKILLS_CalcKickBootDamage113c(m, unit, v.args[1]!, v.args[2]!, v.args[3]!)
      expect(m.u32(v.args[1]!)).toBe(7)
    }

    // n=113: SKILLS_IsSkillBlockedByState113c adds (not subtracts) SKILLS_GetSkillBonusLevel113c
    {
      const v = getVec('SKILLS_IsSkillBlockedByState113c', 'state79_calc_pos_0')
      const m = stageAll(v)
      const dt = m.u32(0x6fde9e1c)
      m.stage(0x2000d000 + 0x7f * 0x144, '00'.repeat(0x144))
      m.setU32(dt + 0xbd4, 0x100)
      const sk = v.args[1]!
      m.setU32(sk + 0x00, 0x20002000)
      m.setU32(sk + 0x28, 0)
      m.setU32(sk + 0x34, 0xffffffff)
      m.setU32(0x20002000 + 0x190, 0x04) // lvl * 2
      m.setU32(0x20030b00, 0x7f << 16)
      m.setU32(0x20030b04, 2)
      m.setU16(0x20030900 + 0x28, 1)
      m.setU16(0x20030900 + 0x4c, 1)
      expect(SKILLS_IsSkillBlockedByState113c(m, v.args[0]!, sk)).toBe(0)
    }

    // n=115: SKILLS_GetSkillUseFailReason113c returns 4 when state-restricted
    {
      const v = getVec('SKILLS_GetSkillUseFailReason113c', 'all_ok_ret_0')
      const m = stageAll(v)
      m.setU8(m.u32(v.args[1]!) + 0x228, 0)
      m.setU32(m.u32(0x6fde9e1c) + 0x110, 0x20022800)
      m.setU32(0x20022800, 1)
      m.setU32(0x20031500, 1)
      expect(SKILLS_GetSkillUseFailReason113c(m, v.args[0]!, v.args[1]!)).toBe(4)
    }
  })
})
