import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  ITEMMODS_ApplyChargedSkillProperty113c,
  ITEMMODS_ApplyEnhancedDamageProperty113c,
  ITEMMODS_ApplyMaxDamagePercentProperty113c,
  ITEMMODS_ApplyMinDamagePercentProperty113c,
  ITEMS_CalcWeaponAttackSpeed113c,
  UNITS_GetAnimDataStringOrPath113c,
} from '../../../src/d2kern-113c/common/items.ts'
import {
  SKILLS_CalcUnitVelocityDivided113c,
  SKILLS_EvalCalcSkillFieldPair113c,
  SKILLS_EvalCalcUnitSkillFieldByCtx113c,
  SKILLS_EvalSkillSynergyOrMasteryCalc113c,
  SKILLS_GetSkillCalcFieldById113c,
  SKILLS_GetSkillElemMaxDamage113c,
  SKILLS_GetSkillElemMinDamage113c,
  SKILLS_GetSkillPeriodicDelayOrLength113c,
  SKILLS_GetSkillToHitBonus113c,
  SKILLS_SkillCalcVarCallback113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i12b-1-vectors.ndjson')

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
  '0x6FD93C30': (m, a) => {
    UNITS_GetAnimDataStringOrPath113c(
      m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!,
    )
    return 0
  },
  '0x6FD767F0': (m, a) => ITEMS_CalcWeaponAttackSpeed113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDA0CE0': (m, a) => SKILLS_CalcUnitVelocityDivided113c(m, a[0]!) >>> 0,
  '0x6FD98340': (m, a) =>
    ITEMMODS_ApplyChargedSkillProperty113c(
      m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!,
    ) >>> 0,
  '0x6FD98630': (m, a) =>
    ITEMMODS_ApplyMaxDamagePercentProperty113c(
      m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!,
    ) >>> 0,
  '0x6FD987C0': (m, a) =>
    ITEMMODS_ApplyMinDamagePercentProperty113c(
      m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!,
    ) >>> 0,
  '0x6FD997E0': (m, a) =>
    ITEMMODS_ApplyEnhancedDamageProperty113c(
      m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!,
    ) >>> 0,
  '0x6FD9E7A0': (m, a) =>
    SKILLS_EvalSkillSynergyOrMasteryCalc113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FD9E900': (m, a) =>
    SKILLS_GetSkillPeriodicDelayOrLength113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FD9EA50': (m, a) => SKILLS_GetSkillToHitBonus113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FDA0360': (m, a) =>
    SKILLS_GetSkillElemMaxDamage113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDA0460': (m, a) =>
    SKILLS_GetSkillElemMinDamage113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDA1070': (m, a) =>
    SKILLS_GetSkillCalcFieldById113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDA1AB0': (m, a) =>
    SKILLS_EvalCalcSkillFieldPair113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDA1AF0': (m, a) =>
    SKILLS_EvalCalcUnitSkillFieldByCtx113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDA1B60': (m, a) => SKILLS_SkillCalcVarCallback113c(m, a[0]!, a[1]!) >>> 0,
}

function stageAll(v: VectorRecord): StrictMem {
  const m = new StrictMem()
  for (const blk of v.pre) {
    m.stage(blk.addr >>> 0, blk.hex)
  }
  return m
}

describe('K1r9 Iteration 12 Lane B — I12B-1 differential verification (16 functions)', () => {
  it('loads all 16 I12B-1 function VAs from the real-DLL fixture', () => {
    const uniqueVas = new Set(VECTORS.map((v) => v.va))
    expect(uniqueVas.size).toBe(16)
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

  it('covers I12B-1 assertions and boundary branches', () => {
    const m = new SparseMemory113c()
    m.fill(0x6fde9e00, 0x2000, 0)
    m.fill(0x6fdf13a0, 0x40, 0)
    m.setU32(0x6fdf13c4, 1)
    m.setU32(0x6fdf13c8, 0)
    m.fill(0x1000, 0x400, 0)
    expect(() =>
      UNITS_GetAnimDataStringOrPath113c(m, 0x1000, 0, 0, 0, 0, 0, 0x1100, 0, 0),
    ).toThrowError(D2CommonAssertError)
    expect(() =>
      UNITS_GetAnimDataStringOrPath113c(m, 0x1000, 0, 0, 0, 0, 0x1100, 0, 0, 0),
    ).toThrowError(D2CommonAssertError)
    expect(() => ITEMS_CalcWeaponAttackSpeed113c(m, 0, 0x1000)).toThrowError(
      D2CommonAssertError,
    )
    expect(() => ITEMS_CalcWeaponAttackSpeed113c(m, 0x1000, 0)).toThrowError(
      D2CommonAssertError,
    )
    expect(() =>
      ITEMMODS_ApplyEnhancedDamageProperty113c(m, 0, 0, 0x1000, 0x1100, 0, 0, 0, 0, 0),
    ).toThrowError(D2CommonAssertError)
    expect(SKILLS_CalcUnitVelocityDivided113c(m, 0)).toBe(0)
    expect(SKILLS_SkillCalcVarCallback113c(m, 16, 0)).toBe(0)
    expect(SKILLS_EvalCalcUnitSkillFieldByCtx113c(m, 0, 16, 0, 0)).toBe(0)
    expect(SKILLS_EvalCalcSkillFieldPair113c(m, 0, 16, 0, 0)).toBe(0)
  })

  it('covers I12B-1 mutation boundary cases', () => {
    const getVec = (name: string, caseId: string): VectorRecord => {
      const v = VECTORS.find((x) => x.name === name && x.caseId === caseId)
      if (!v) throw new Error(`Missing vector ${name}:${caseId}`)
      return v
    }

    // n=2 & n=3: UNITS_GetAnimDataStringOrPath113c obj cls=1 and monster mode >= nMonModes
    {
      const v = getVec('UNITS_GetAnimDataStringOrPath113c', 'mon_mode7_path')
      const m = stageAll(v)
      m.stage(0x20, '58585820') // 'XXX ' at 0x20
      const pMonModes = m.u32(0x6fdf13b0)
      const nMonModes = m.u32(0x6fdf13a4)
      m.setU32(0x6fdf13a4, 1)
      const outPtr = v.args[5]!
      const outW = v.args[6]!
      UNITS_GetAnimDataStringOrPath113c(m, v.args[0]!, 0, 1, 1, 0, outPtr, outW, 0, 0)
      expect(String.fromCharCode(m.u8(outPtr), m.u8(outPtr + 1), m.u8(outPtr + 2), m.u8(outPtr + 3), m.u8(outPtr + 4))).toContain('XXX')
      // Object unit (type=2, cls=1) with nObj=2 and cls=1 != 0
      const pTypes = 0x20022000
      const pModes = 0x20022400
      m.setU32(0x6fdf13b4, 2)
      m.setU32(0x6fdf13bc, pTypes)
      m.setU32(0x6fdf13c0, pModes)
      m.setU32(pTypes + 1 * 0x34 + 0x20, 0x2031424f) // 'OB1 '
      m.setU32(pModes + 0 * 0x34 + 0x20, 0x2020554e) // 'NU  '
      const objUnit = 0x20030000
      m.setU32(objUnit, 2)
      m.setU32(objUnit + 4, 1)
      UNITS_GetAnimDataStringOrPath113c(m, objUnit, 1, 0, 2, 0, outPtr, outW, 0, 0)
      expect(String.fromCharCode(m.u8(outPtr), m.u8(outPtr + 1), m.u8(outPtr + 2))).toBe('OB1')
      expect(nMonModes).toBeGreaterThan(0)
      expect(pMonModes).toBeGreaterThan(0)
    }

    // n=11: SKILLS_CalcUnitVelocityDivided113c returns 0 when weapon attack speed denom <= 0
    {
      const v = getVec('SKILLS_CalcUnitVelocityDivided113c', 'flag8_equipped_axe')
      const m = stageAll(v)
      // Make matched AnimData records have framesPerDir=1, animSpeed=0x20000 so sdiv32(256, 0x20000) === 0
      const pTbl = m.u32(0x6fdf0b4c)
      for (let h = 0; h < 256; h++) {
        const b = m.u32(pTbl + 4 + h * 4)
        const cnt = m.u32(b)
        for (let j = 0; j < cnt; j++) {
          const rec = b + 4 + j * 0xa0
          m.setU32(rec + 0x08, 1)
          m.setU32(rec + 0x0c, 0x20000)
        }
      }
      expect(SKILLS_CalcUnitVelocityDivided113c(m, v.args[0]!)).toBe(0)
    }

    // n=15: ITEMMODS_ApplyChargedSkillProperty113c rejects skillId === nSkillsTxtRecordCount
    {
      const v = getVec('ITEMMODS_ApplyChargedSkillProperty113c', 'auto_lvl_ilvl30')
      const m = stageAll(v)
      const dt = m.u32(0x6fde9e1c)
      const count = m.u32(dt + 0xba0)
      m.setU32(v.args[2]! + 0x04, count)
      expect(
        ITEMMODS_ApplyChargedSkillProperty113c(
          m, v.args[0]!, v.args[1]!, v.args[2]!, v.args[3]!, v.args[4]!, v.args[5]!, v.args[6]!, v.args[7]!, v.args[8]!, v.args[9]!,
        ),
      ).toBe(0)
    }

    // n=19: ITEMMODS_ApplyMaxDamagePercentProperty113c does not clamp when baseThrowMax === 0
    {
      const v = getVec('ITEMMODS_ApplyMaxDamagePercentProperty113c', 'jav_throw_neg')
      const m = stageAll(v)
      // ItemsTxt[2]+0x101 (nMaxMisDam) = 0
      m.setU8(0x20009000 + 2 * 0x1a8 + 0x101, 0)
      const res = ITEMMODS_ApplyMaxDamagePercentProperty113c(
        m, v.args[0]!, v.args[1]!, v.args[2]!, v.args[3]!, v.args[4]!, v.args[5]!, -10, v.args[7]!, v.args[8]!, 0,
      )
      expect(res).toBe(-10)
      const nStats = m.u16(0x20030e00 + 0x28)
      let foundThrowMax = false
      for (let i = 0; i < nStats; i++) {
        if (m.u32(0x20030f00 + i * 8) === (0xa0 << 16)) {
          expect(m.u32(0x20030f00 + i * 8 + 4) | 0).toBe(-10)
          foundThrowMax = true
        }
      }
      expect(foundThrowMax).toBe(true)
    }

    // n=23: ITEMMODS_ApplyMinDamagePercentProperty113c does not clamp when base1HMin === 0 and base2HMin === 0
    {
      const v = getVec('ITEMMODS_ApplyMinDamagePercentProperty113c', 'axe_neg_clamp1')
      const m = stageAll(v)
      m.setU8(0x20009000 + 0xfe, 0)
      m.setU8(0x20009000 + 0x102, 0)
      const res = ITEMMODS_ApplyMinDamagePercentProperty113c(
        m, v.args[0]!, v.args[1]!, v.args[2]!, v.args[3]!, v.args[4]!, v.args[5]!, -10, v.args[7]!, v.args[8]!, 0,
      )
      expect(res).toBe(-10)
      const nStats = m.u16(0x20030e00 + 0x28)
      let foundMin = false
      for (let i = 0; i < nStats; i++) {
        if (m.u32(0x20030f00 + i * 8) === (0x15 << 16)) {
          expect(m.u32(0x20030f00 + i * 8 + 4) | 0).toBe(-10)
          foundMin = true
        }
      }
      expect(foundMin).toBe(true)
    }

    // n=24: ITEMMODS_ApplyEnhancedDamageProperty113c adds (bSetStat=0) to stat 0x18 on 2H maul when flat <= maxBase
    {
      const v = getVec('ITEMMODS_ApplyEnhancedDamageProperty113c', 'modern_small_flat1')
      const m = stageAll(v)
      const item = v.args[2]!
      m.setU32(item + 0x04, 1) // classId 1 = maul (nMaxDam=0, n2HandMaxDam=22)
      // Pre-seed stat 0x18 = 5 on ADDR_SLIST_ITEM & ADDR_SLIST_ITEM_STATS
      m.setU32(0x20030f00, 0x18 << 16)
      m.setU32(0x20030f04, 5)
      m.setU16(0x20030e00 + 0x28, 1)
      m.setU16(0x20030e00 + 0x4c, 1)
      ITEMMODS_ApplyEnhancedDamageProperty113c(
        m, v.args[0]!, v.args[1]!, item, v.args[3]!, v.args[4]!, v.args[5]!, v.args[6]!, v.args[7]!, v.args[8]!,
      )
      // Add +1 -> 6 (whereas bSetStat=1 overwrites 5 -> 1)
      expect(m.u32(0x20030f04) | 0).toBe(6)
    }

    // n=28 & n=31: SKILLS_EvalSkillSynergyOrMasteryCalc113c checks grp=1 (0x15a) and stops at i < 5
    {
      const v = getVec('SKILLS_EvalSkillSynergyOrMasteryCalc113c', 'grp0_imm25')
      const m = stageAll(v)
      const pSk0 = 0x20002000
      for (let i = 0; i < 5; i++) m.setU16(pSk0 + 0x98 + i * 2, 0xffff)
      // Slot 5 (outside 5-entry array) set to 0x156 with calc=0 (imm 25) -> grp 0 must return 0 (n=31)
      m.setU16(pSk0 + 0xa2, 0x156)
      m.setU32(pSk0 + 0xa4 + 5 * 4, 0)
      expect(SKILLS_EvalSkillSynergyOrMasteryCalc113c(m, v.args[0]!, 0, 1, 0)).toBe(0)
      // Slot 0 = 0x15a (aurastat1), calc0 = 0 (imm 25), grp = 1 -> returns 25 (n=28)
      m.setU16(pSk0 + 0x98, 0x15a)
      m.setU32(pSk0 + 0xa4, 0)
      expect(SKILLS_EvalSkillSynergyOrMasteryCalc113c(m, v.args[0]!, 0, 1, 1)).toBe(25)
    }

    // n=32: SKILLS_GetSkillPeriodicDelayOrLength113c applies pct === 1
    {
      const v = getVec('SKILLS_GetSkillPeriodicDelayOrLength113c', 'sk0_band1_lvl4')
      const m = stageAll(v)
      const pSk0 = 0x20002000
      m.setU32(pSk0 + 0x214, 100)
      m.setU32(pSk0 + 0x218, 0)
      m.setU32(pSk0 + 0x21c, 0)
      m.setU32(pSk0 + 0x220, 0)
      // Calc offset 0x00 -> set RPN at 0x20001200 to imm 1 (0x07, 1, 0)
      m.setU32(pSk0 + 0x224, 0)
      m.setU8(0x20001200, 7)
      m.setU8(0x20001201, 1)
      m.setU8(0x20001202, 0)
      expect(SKILLS_GetSkillPeriodicDelayOrLength113c(m, v.args[0]!, 0, 1, 1)).toBe(101)
    }

    // n=36: SKILLS_GetSkillToHitBonus113c returns 0 when pSkTxt === 0 (invalid skillId)
    {
      const v = getVec('SKILLS_GetSkillToHitBonus113c', 'sk0_linear_lvl5')
      const m = stageAll(v)
      expect(SKILLS_GetSkillToHitBonus113c(m, v.args[0]!, 99, 5)).toBe(0)
    }

    // n=40 & n=45: SKILLS_GetSkillElemMaxDamage113c / MinDamage113c with bApplyMastery=1 and stat 0x149=50
    {
      const vMax = getVec('SKILLS_GetSkillElemMaxDamage113c', 'sk0_with_owner_mast')
      const mMax = stageAll(vMax)
      const dt = mMax.u32(0x6fde9e1c)
      mMax.stage(0x2000d000 + 0x149 * 0x144, '00'.repeat(0x144))
      mMax.setU32(dt + 0xbd4, 0x150)
      mMax.setU8(0x20002000 + 0x1dc, 1) // EType 1 = Fire -> stat 0x149
      mMax.setU32(0x20030b00, 0x149 << 16)
      mMax.setU32(0x20030b04, 50)
      mMax.setU16(0x20030900 + 0x28, 1)
      mMax.setU16(0x20030900 + 0x4c, 1)
      const noMastMax = SKILLS_GetSkillElemMaxDamage113c(mMax, vMax.args[0]!, vMax.args[1]!, vMax.args[2]!, 0)
      const withMastMax = SKILLS_GetSkillElemMaxDamage113c(mMax, vMax.args[0]!, vMax.args[1]!, vMax.args[2]!, 1)
      expect(withMastMax).toBeGreaterThan(noMastMax)

      const vMin = getVec('SKILLS_GetSkillElemMinDamage113c', 'sk0_with_owner_mast')
      const mMin = stageAll(vMin)
      mMin.stage(0x2000d000 + 0x149 * 0x144, '00'.repeat(0x144))
      mMin.setU32(mMin.u32(0x6fde9e1c) + 0xbd4, 0x150)
      mMin.setU8(0x20002000 + 0x1dc, 1)
      mMin.setU32(0x20030b00, 0x149 << 16)
      mMin.setU32(0x20030b04, 50)
      mMin.setU16(0x20030900 + 0x28, 1)
      mMin.setU16(0x20030900 + 0x4c, 1)
      const noMastMin = SKILLS_GetSkillElemMinDamage113c(mMin, vMin.args[0]!, vMin.args[1]!, vMin.args[2]!, 0)
      const withMastMin = SKILLS_GetSkillElemMinDamage113c(mMin, vMin.args[0]!, vMin.args[1]!, vMin.args[2]!, 1)
      expect(withMastMin).toBeGreaterThan(noMastMin)
    }

    // n=48..51: SKILLS_GetSkillCalcFieldById113c cases 26/27/35 + lvl <= 0 + pSkDesc===0 + code & 0xff + nSkillId bounds
    {
      const v = getVec('SKILLS_GetSkillCalcFieldById113c', 'field_26')
      const m = stageAll(v)
      expect(SKILLS_GetSkillCalcFieldById113c(m, v.args[0]!, 29, 0, 0)).toBe(0)
      expect(SKILLS_GetSkillCalcFieldById113c(m, v.args[0]!, 32, 0, 0)).toBe(0)
      expect(SKILLS_GetSkillCalcFieldById113c(m, v.args[0]!, 0x110, 0, 8)).toBe(8)
      expect(SKILLS_GetSkillCalcFieldById113c(m, v.args[0]!, 16, -1, 8)).toBe(0)

      // n=49 & n=51: MissilesTxt[0] dwEMin (+0xe8) = 0x400, dwESymPerCalc (+0x118) = 0xffffffff
      m.setU32(0x20007000 + 0xe8, 0x400)
      m.setU32(0x20007000 + 0x118, 0xffffffff)
      expect(SKILLS_GetSkillCalcFieldById113c(m, v.args[0]!, 26, 0, 8)).toBe(4)
      expect(SKILLS_GetSkillCalcFieldById113c(m, v.args[0]!, 26, 0, 0)).toBe(0)

      // n=50: case 35 uses pSkDesc + code*2 - 0x0a (+0x3c), distinct from + 0x0a (+0x50)
      m.setU16(0x20005000 + 0x50, 1)
      m.setU16(0x20007000 + 0x1a4 + 0x96, 99)
      expect(SKILLS_GetSkillCalcFieldById113c(m, v.args[0]!, 35, 0, 8)).toBe(26)

      // n=48: case 27 with invalid skilldesc (-1 -> pSkDesc === 0) returns 0 safely
      m.setU16(0x20002000 + 0x194, 0xffff)
      expect(SKILLS_GetSkillCalcFieldById113c(m, v.args[0]!, 27, 0, 8)).toBe(0)
    }

    // n=60: SKILLS_SkillCalcVarCallback113c passes ctx+0x04 (nSkillId) distinct from ctx+0x08 (nLevel)
    {
      const v = getVec('SKILLS_SkillCalcVarCallback113c', 'var16_lvl10')
      const m = stageAll(v)
      const ctx = v.args[1]!
      m.setU32(ctx + 0x04, 0) // nSkillId = 0 (field_0 returns 25)
      m.setU32(ctx + 0x08, 10) // nLevel = 10 (OOB skillId -> 0 if misread)
      expect(SKILLS_SkillCalcVarCallback113c(m, 0, ctx)).toBe(29)
    }
  })
})
