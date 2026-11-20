import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  ITEMS_AddSockets113c,
  ITEMS_CanItemBeAutoBeltOrStacked113c,
  ITEMS_CraftModMakeEthereal113c,
  ITEMS_EvaluateRequiredLevel113c,
  ITEMS_IsUberOrUltraArmorOrWeapon113c,
} from '../../../src/d2kern-113c/common/items.ts'
import {
  SKILLS_AssignItemChargedSkillStdcall113c,
  SKILLS_CanMonsterReviveInMode2_113c,
  SKILLS_CheckLineOfSight113c,
  SKILLS_CheckSkillStartMana113c,
  SKILLS_CheckSkillStateRestriction113c,
  SKILLS_CheckSkillWeaponAndQuantity113c,
  SKILLS_CheckWeaponPairMatchesSkill113c,
  SKILLS_EvalUnitRandFormulaHelper113c,
  SKILLS_EvalUnitStatFormulaHelper113c,
  SKILLS_GetShrineSkillBonus113c,
  SKILLS_GetUnitSkillRequiredOrMonLevel113c,
  SKILLS_IsUnitPosNotInTown113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { DRLGOUTWILD_PlaceRandomRiverBridge113c } from '../../../src/d2kern-113c/tables/field-tbls-113c.ts'

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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i10b-1-vectors.ndjson')

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
  '0x6FD74B20': (m, a) => ITEMS_CanItemBeAutoBeltOrStacked113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD74D00': (m, a) => ITEMS_IsUberOrUltraArmorOrWeapon113c(m, a[0]!) >>> 0,
  '0x6FD76190': (m, a) => ITEMS_EvaluateRequiredLevel113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD7A3D0': (m, a) => {
    ITEMS_AddSockets113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD81200': (m, a) => SKILLS_CanMonsterReviveInMode2_113c(m, a[0]!) >>> 0,
  '0x6FD97290': (m, a) =>
    ITEMS_CraftModMakeEthereal113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
      a[6]!,
      a[7]!,
      a[8]!,
    ) >>> 0,
  '0x6FD9E750': (m, a) =>
    SKILLS_CheckLineOfSight113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!) >>> 0,
  '0x6FD9EBA0': (m, a) => SKILLS_GetShrineSkillBonus113c(m, a[0]!) >>> 0,
  '0x6FD9EC50': (m, a) => SKILLS_GetUnitSkillRequiredOrMonLevel113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD9F120': (m, a) => SKILLS_IsUnitPosNotInTown113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD9F590': (m, a) => SKILLS_CheckSkillStateRestriction113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD9F610': (m, a) => {
    SKILLS_AssignItemChargedSkillStdcall113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!)
    return 0
  },
  '0x6FD9FDC0': (m, a) => SKILLS_CheckSkillStartMana113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDA0610': (m, a) =>
    SKILLS_CheckWeaponPairMatchesSkill113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDA0930': (m, a) => SKILLS_CheckSkillWeaponAndQuantity113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDA0C30': (m, a) => SKILLS_EvalUnitStatFormulaHelper113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDA0CB0': (m, a) => SKILLS_EvalUnitRandFormulaHelper113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDCEB40': (m, a) => {
    DRLGOUTWILD_PlaceRandomRiverBridge113c(m, a[0]!, a[1]!)
    return 0
  },
}

function stageAll(v: VectorRecord): StrictMem {
  const m = new StrictMem()
  for (const blk of v.pre) {
    m.stage(blk.addr >>> 0, blk.hex)
  }
  return m
}

describe('K1r7 Iteration 10 Lane B — I10B-1 differential verification (18 functions)', () => {
  it('loads all 18 I10B-1 function VAs from the real-DLL fixture', () => {
    expect(VECTORS.length).toBe(68)
    const uniqueVas = new Set(VECTORS.map((v) => v.va))
    expect(uniqueVas.size).toBe(18)
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

  it('covers I10B-1 assertions and boundary branches', () => {
    // 0x6FD74B20 assertions (lines 0x9a7, 0x9a8, 0x9aa)
    const m1 = new SparseMemory113c()
    m1.fill(0x1000, 0x100, 0)
    m1.fill(0x6fdefb90, 0x20, 0)
    expect(() => ITEMS_CanItemBeAutoBeltOrStacked113c(m1, 0, 0)).toThrowError(/2471/)
    m1.setU32(0x1000, 1) // dwUnitType = 1 (not 4)
    expect(() => ITEMS_CanItemBeAutoBeltOrStacked113c(m1, 0, 0x1000)).toThrowError(/2472/)
    m1.setU32(0x1000, 4)
    m1.setU32(0x1004, 10)
    m1.setU32(0x6fdefb94, 5) // ITEMS_TXT_COUNT_VA_113C = 5
    expect(() => ITEMS_CanItemBeAutoBeltOrStacked113c(m1, 0, 0x1000)).toThrowError(
      D2CommonAssertError,
    )

    // 0x6FD74D00 boundary id === count (does not assert even if base === 0)
    const m2 = new SparseMemory113c()
    m2.fill(0x5000, 0xd00, 0)
    m2.setU32(0x6fde9e1c, 0x5000)
    m2.setU32(0x6fdefb94, 2) // ITEMS_TXT_COUNT_VA_113C = 2
    m2.setU32(0x6fdefb98, 0) // ITEMS_TXT_PTR_VA_113C = 0
    expect(ITEMS_IsUberOrUltraArmorOrWeapon113c(m2, 2)).toBe(0)
    expect(() => ITEMS_IsUberOrUltraArmorOrWeapon113c(m2, 1)).toThrowError(D2CommonAssertError)

    // 0x6FD76190 crafted suffix (0x3e), base === 0 assert, and non-negative statlist flags
    const m3 = new StrictMem()
    m3.stage(0x1000, '00'.repeat(0x100))
    m3.stage(0x2000, '00'.repeat(0x100))
    m3.stage(0x3000, '00'.repeat(0x200))
    m3.stage(0x4000, '00'.repeat(0x40)) // statList without +0x48 staged
    m3.stage(0x6fde9e1c, '00'.repeat(4))
    m3.stage(0x5000, '00'.repeat(0xd00))
    m3.stage(0x6fdefb94, '00'.repeat(8))
    m3.stage(0x6fdefbb8, '00'.repeat(8))
    m3.stage(0x6fdf0b50, '00'.repeat(4))
    m3.stage(0x6000, '00'.repeat(8))
    m3.setU32(0x6fde9e1c, 0x5000)
    m3.setU32(0x6fdefbbc, 0x3000) // SGPT_MAGICAFFIX_TXT_PTR_VA
    m3.setU32(0x6fdefbb8, 2) // SGPT_MAGICAFFIX_TXT_COUNT_VA = 2
    m3.setU8(0x3000 + 0x90 + 0x65, 25) // affix 1 wLevelReq = 25
    m3.setU8(0x3000 + 0x90 + 0x67, 0xff)
    m3.setU32(0x6fdf0b50, 0x6000)
    m3.setU32(0x6000, 99) // maxLvl = 99
    m3.setU32(0x1000, 4) // UNIT_ITEM
    m3.setU32(0x1004, 5) // clsId = 5 >= count (0)
    m3.setU32(0x1014, 0x2000) // pUnitData
    m3.setU32(0x2000, 8) // crafted quality = 8
    m3.setU16(0x2000 + 0x3e, 2) // id=2 -> index 1
    m3.setU32(0x105c, 0x4000) // pStatListEx
    m3.setU32(0x4000 + 0x10, 0) // dwFlags = 0 (not < 0)
    expect(ITEMS_EvaluateRequiredLevel113c(m3, 0x1000, 0)).toBe(38)
    // ITEMS_AddSockets113c when pRec === 0 (area === 0) does not set 0x800 on pUnitData
    ITEMS_AddSockets113c(m3, 0x1000, 3)
    expect(m3.u32(0x2000 + 0x18)).toBe(0)

    // 0x6FD81200 boundary id === count on a revivable record
    const v4 = VECTORS.find((v) => v.va === '0x6FD81200' && v.caseId === 'revivable_ret_1')!
    const m4 = stageAll(v4)
    const sgpt4 = m4.u32(0x6fde9e1c)
    m4.setU32(sgpt4 + 0xa80, v4.args[0]!) // count === id (3) -> returns 0
    expect(SKILLS_CanMonsterReviveInMode2_113c(m4, v4.args[0]!)).toBe(0)

    // 0x6FD97290 dwCommandFlags bit 0x400000 vs 0x000004
    const v5 = VECTORS.find(
      (v) => v.va === '0x6FD97290' && v.caseId === 'valid_armor_ethereal_ret_1',
    )!
    const m5 = stageAll(v5)
    const pData5 = m5.u32(v5.args[0]! + 0x14)
    m5.setU32(pData5 + 0x18, 0x000004) // bit 2 set, bit 0x400000 clear -> still returns 1!
    expect(ITEMS_CraftModMakeEthereal113c(m5, v5.args[0]!, 1)).toBe(1)

    // 0x6FD9EBA0 uType === 1 and uType === 3 with active shrine state
    const v6 = VECTORS.find((v) => v.va === '0x6FD9EBA0' && v.caseId === 'shrine_active_ret_2')!
    const m6 = stageAll(v6)
    m6.setU32(v6.args[0]!, 1) // uType = 1 (monster) -> returns 2
    expect(SKILLS_GetShrineSkillBonus113c(m6, v6.args[0]!)).toBe(2)
    m6.setU32(v6.args[0]!, 3) // uType = 3 (missile) -> returns 2
    expect(SKILLS_GetShrineSkillBonus113c(m6, v6.args[0]!)).toBe(2)

    // 0x6FD9EC50 pSkill === 0 and i < 8 boundary
    const m7 = new SparseMemory113c()
    m7.fill(0x1000, 0x100, 0)
    m7.fill(0x2000, 0x100, 0)
    m7.fill(0x3000, 0x300, 0)
    m7.fill(0x5000, 0xd00, 0)
    m7.fill(0x6000, 0x200, 0)
    m7.setU32(0x1000, 1) // monster
    m7.setU32(0x1004, 0) // clsId = 0
    expect(SKILLS_GetUnitSkillRequiredOrMonLevel113c(m7, 0x1000, 0)).toBe(0)
    m7.setU32(0x6fde9e1c, 0x5000)
    m7.setU32(0x5000 + 0xa80, 1)
    m7.setU32(0x5000 + 0xa78, 0x6000)
    m7.setU32(0x2000, 0x3000) // pSkill -> pSkTxt
    m7.setU16(0x3000, 42) // skId = 42
    for (let i = 0; i < 8; i++) m7.setU16(0x6000 + 0x170 + i * 2, 0xffff)
    m7.setU16(0x6000 + 0x170 + 8 * 2, 42) // slot 8 (out of bounds) = 42
    m7.setU16(0x6000 + 0x188 + 8 * 2, 77)
    expect(SKILLS_GetUnitSkillRequiredOrMonLevel113c(m7, 0x1000, 0x2000)).toBe(0)

    // 0x6FD9F590 st === 0 vs st < 0
    const v8 = VECTORS.find(
      (v) => v.va === '0x6FD9F590' && v.caseId === 'restrict2_matched_state5_ret_1',
    )!
    const m8 = stageAll(v8)
    const pSkTxt8 = m8.u32(v8.args[0]!)
    const pListEx8 = m8.u32(v8.args[1]! + 0x5c)
    const pStateFlags8 = m8.u32(pListEx8 + 0x58)
    const sgpt8 = m8.u32(0x6fde9e1c)
    const pMask8 = m8.u32(sgpt8 + 0x110)
    m8.setU32(pStateFlags8, 1) // state 0 active
    m8.setU32(pMask8, 1) // state 0 in fStateMasks
    m8.setU16(pSkTxt8 + 0x22a, 0) // wState[0] = 0
    expect(SKILLS_CheckSkillStateRestriction113c(m8, v8.args[0]!, v8.args[1]!)).toBe(1)

    // 0x6FD9FDC0 pUnit === 0 vs uType !== 0
    const m9 = new SparseMemory113c()
    m9.fill(0x1000, 0x100, 0)
    expect(SKILLS_CheckSkillStartMana113c(m9, 0, 0)).toBe(1)
    m9.setU32(0x1000, 1) // uType = 1 (monster)
    expect(SKILLS_CheckSkillStartMana113c(m9, 0x1000, 0)).toBe(1)

    // 0x6FDA0610 k < 2 boundary on wETypeA and pData === 0
    const v10 = VECTORS.find(
      (v) => v.va === '0x6FDA0610' && v.caseId === 'bow_with_quiver_qty5_ret_1',
    )!
    const m10 = stageAll(v10)
    const [, pPri10, pSec10, pSkTxt10] = v10.args as [number, number, number, number]
    m10.setU32(pPri10 + 0x14, 0) // pPrimaryItem pData = 0 (not broken)
    m10.setU16(pSkTxt10 + 0x24, 1) // wETypeA1 = 1 (not matching type 2)
    m10.setU16(pSkTxt10 + 0x26, 1) // wETypeA2 = 1 (not matching type 2)
    m10.setU16(pSkTxt10 + 0x28, 0x2d) // wETypeB1 = 0x2d (would match if k <= 2!)
    m10.setU16(pSkTxt10 + 0x18, 0x2d) // wITypeA1 = 0x2d (matches!)
    expect(SKILLS_CheckWeaponPairMatchesSkill113c(m10, 0, pPri10, pSec10, pSkTxt10)).toBe(1)

    // 0x6FDA0930 non-scroll skill with sk+0x30 === 0 and skId === 5 on non-dual-wield unit
    const m11 = new SparseMemory113c()
    m11.fill(0x1000, 0x100, 0)
    m11.fill(0x2000, 0x100, 0)
    m11.fill(0x3000, 0x300, 0)
    m11.fill(0x8000, 0x100, 0)
    m11.setU32(0x6fdd90b0, 0x8000) // gdwBitMasks
    m11.setU8(0x8000 + 0x10, 0x01)
    m11.setU32(0x1000, 0) // player clsId 0 (not barbarian)
    m11.setU32(0x1060, 0x9000) // pInv !== 0
    m11.setU32(0x2000, 0x3000) // pSkill -> pSkTxt
    m11.setU8(0x3000 + 0x08, 0) // bScroll bit clear
    m11.setU16(0x3000, 10) // skId = 10 -> returns 1
    expect(SKILLS_CheckSkillWeaponAndQuantity113c(m11, 0x2000, 0x1000)).toBe(1)
    m11.setU16(0x3000, 5) // skId = 5 (Left Hand Swing) on Amazon -> 0
    expect(SKILLS_CheckSkillWeaponAndQuantity113c(m11, 0x2000, 0x1000)).toBe(0)

    // 0x6FDA0C30 pUnit === 0 and statId === count
    const m12 = new SparseMemory113c()
    m12.fill(0x1000, 0x10, 0)
    m12.fill(0x5000, 0xd00, 0)
    m12.setU32(0x1000, 0) // *ppUnit = 0
    expect(SKILLS_EvalUnitStatFormulaHelper113c(m12, 0, 0, 0, 0x1000)).toBe(0)
    m12.setU32(0x1000, 0x2000)
    m12.setU32(0x6fde9e1c, 0x5000)
    m12.setU32(0x5000 + 0xbd4, 10) // nItemStatCostTxtRecordCount = 10
    expect(SKILLS_EvalUnitStatFormulaHelper113c(m12, 10, 0, 0, 0x1000)).toBe(0)

    // 0x6FDCEB40 i < span loop termination when all rows fail
    const m13 = new StrictMem()
    m13.stage(0x1000, '00'.repeat(0x200))
    m13.stage(0x2000, '00'.repeat(0x80))
    m13.stage(0x3000, '00'.repeat(12)) // only rows 0, 1, 2 staged (row 3 unstaged!)
    m13.stage(0x4000, '00'.repeat(0x40))
    m13.setU32(0x1014, 0x2000) // pOutdoors
    m13.setU32(0x2060, 4) // height = 4 -> span = 2
    m13.setU32(0x2030, 0x3000) // pGrid2Rows
    m13.setU32(0x202c, 0x4000) // pGrid2Cells
    m13.setU32(0x3004, 0) // row 1 offset = 0
    m13.setU32(0x3008, 4) // row 2 offset = 4
    m13.setU32(0x4000, 1) // row 1 gx-1 has bit 1 set -> continue
    m13.setU32(0x4010, 1) // row 2 gx-1 has bit 1 set -> continue
    DRLGOUTWILD_PlaceRandomRiverBridge113c(m13, 1, 0x1000)
    expect(m13.rogueWrites).toEqual([])
  })
})

