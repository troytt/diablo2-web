import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  ITEMS_AddChargedSkillsCostContribution113c,
  ITEMS_AddSingleSkillStatsCostContribution113c,
  ITEMS_CanItemBeRepairedByNpc113c,
  ITEMS_CanItemBeSocketedByQuest113c,
  ITEMS_CraftModRollSockets113c,
  ITEMS_EvalItemPropertyList113c,
  ITEMS_GetMissileWeaponVelocity113c,
} from '../../../src/d2kern-113c/common/items.ts'
import {
  SKILLS_CanUnitAllocateSkillPoint113c,
  SKILLS_CheckSkillLevelAndPrereqs113c,
  SKILLS_EvalMissileParamCallback113c,
  SKILLS_GetWeaponMasteryPassiveStatId113c,
  SKILLS_RemoveAllCurseAndDebuffStatesFromUnit113c,
  SKILLS_ScaleValueByMasteryAndSkillParam1113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  DRLGOUTPLACE_ConnectOutdoorsRoomsAndPlaceWalls113c,
  DRLGOUTPLACE_SpawnAct5Barricade421Preset113c,
} from '../../../src/d2kern-113c/tables/anim-tbls-113c.ts'

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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i11b-2-vectors.ndjson')

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
  '0x6FD75810': (m, a) => ITEMS_AddChargedSkillsCostContribution113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD75970': (m, a) => {
    ITEMS_AddSingleSkillStatsCostContribution113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!)
    return 0
  },
  '0x6FD76AD0': (m, a) => ITEMS_CanItemBeSocketedByQuest113c(m, a[0]!) >>> 0,
  '0x6FD77090': (m, a) => ITEMS_CanItemBeRepairedByNpc113c(m, a[0]!) >>> 0,
  '0x6FD7A480': (m, a) => {
    ITEMS_GetMissileWeaponVelocity113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD91340': (m, a) => {
    DRLGOUTPLACE_ConnectOutdoorsRoomsAndPlaceWalls113c(m, a[0]!)
    return 0
  },
  '0x6FD91730': (m, a) => {
    DRLGOUTPLACE_SpawnAct5Barricade421Preset113c(m, a[0]!)
    return 0
  },
  '0x6FD95E50': (m, a) => ITEMS_EvalItemPropertyList113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD96830': (m, a) =>
    ITEMS_CraftModRollSockets113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!) >>> 0,
  '0x6FD9FA30': (m, a) => SKILLS_CanUnitAllocateSkillPoint113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD9FB30': (m, a) => SKILLS_CheckSkillLevelAndPrereqs113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD9FE80': (m, a) => SKILLS_ScaleValueByMasteryAndSkillParam1113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDA0C90': (m, a) => SKILLS_EvalMissileParamCallback113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDA0D40': (m, a) => SKILLS_GetWeaponMasteryPassiveStatId113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDA1ED0': (m, a) => SKILLS_RemoveAllCurseAndDebuffStatesFromUnit113c(m, a[0]!) >>> 0,
}

function stageAll(v: VectorRecord): StrictMem {
  const m = new StrictMem()
  for (const blk of v.pre) {
    m.stage(blk.addr >>> 0, blk.hex)
  }
  return m
}

describe('K1r8 Iteration 11 Lane B — I11B-2 differential verification (15 functions)', () => {
  it('loads all 15 I11B-2 function VAs from the real-DLL fixture', () => {
    expect(VECTORS.length).toBe(35)
    const uniqueVas = new Set(VECTORS.map((v) => v.va))
    expect(uniqueVas.size).toBe(15)
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

  it('covers I11B-2 assertions and boundary branches', () => {
    // 0x6FD75810: skId === 0 boundary with non-zero costAdd
    const vC1 = VECTORS.find(
      (v) => v.va === '0x6FD75810' && v.caseId === 'depleted_charged_skill_cost',
    )!
    const mC1 = stageAll(vC1)
    const pSlC1 = mC1.u32(vC1.args[0]! + 0x5c)
    const pArrC1 = mC1.u32(pSlC1 + 0x48)
    const sgptC1 = mC1.u32(0x6fde9e1c)
    const pSk0 = mC1.u32(sgptC1 + 0xb98)
    mC1.setU32(pSk0 + 0x238, 100) // costAdd on skill 0
    mC1.setU16(pArrC1 + 0x00, 1) // wParam = 1 -> skId = 0, slvl = 1
    expect(ITEMS_AddChargedSkillsCostContribution113c(mC1, vC1.args[0]!, 10)).toBeGreaterThan(0)

    // 0x6FD75970: pStatListEx dwFlags === 0 and buyBase <= 0xffff with non-multiple-of-1024 negative prod
    const vC2 = VECTORS.find(
      (v) => v.va === '0x6FD75970' && v.caseId === 'class_item_single_skill_adds_costs',
    )!
    const mC2a = stageAll(vC2)
    const slC2a = mC2a.u32(vC2.args[0]! + 0x5c)
    mC2a.setU32(slC2a + 0x10, 0)
    mC2a.setU32(slC2a + 0x24, mC2a.u32(slC2a + 0x48))
    mC2a.setU16(slC2a + 0x28, mC2a.u16(slC2a + 0x4c))
    const oldBuy = mC2a.u32(vC2.args[1]!)
    ITEMS_AddSingleSkillStatsCostContribution113c(
      mC2a,
      vC2.args[0]!,
      vC2.args[1]!,
      vC2.args[2]!,
      vC2.args[3]!,
      vC2.args[4]!,
    )
    expect(mC2a.u32(vC2.args[1]!)).toBe(oldBuy)

    const mC2b = stageAll(vC2)
    const sgptC2 = mC2b.u32(0x6fde9e1c)
    const pSkC2 = mC2b.u32(sgptC2 + 0xb98) + 0x23c
    mC2b.setU32(pSkC2 + 0x234, (-1) >>> 0) // costMult = -1 -> pBuy = -1001
    mC2b.setU32(pSkC2 + 0x238, 500)
    mC2b.setU32(vC2.args[1]!, 1001)
    mC2b.setU32(vC2.args[2]!, 500)
    mC2b.setU32(vC2.args[3]!, 250)
    ITEMS_AddSingleSkillStatsCostContribution113c(
      mC2b,
      vC2.args[0]!,
      vC2.args[1]!,
      vC2.args[2]!,
      vC2.args[3]!,
      1,
    )
    expect(mC2b.u32(vC2.args[1]!)).toBe(2501)

    // 0x6FD76AD0: null assert + maxSocketsFromItemType === 0 returns 0
    const vSq = VECTORS.find(
      (v) => v.va === '0x6FD76AD0' && v.caseId === 'unsocketed_socketable_item_ret_1',
    )!
    const mSq = stageAll(vSq)
    expect(() => ITEMS_CanItemBeSocketedByQuest113c(mSq, 0)).toThrowError(D2CommonAssertError)
    const sgptSq = mSq.u32(0x6fde9e1c)
    const pTypesSq = mSq.u32(sgptSq + 0xbf8)
    mSq.setU8(pTypesSq + 0xe4 + 0x1b, 0)
    expect(ITEMS_CanItemBeSocketedByQuest113c(mSq, vSq.args[0]!)).toBe(0)

    // 0x6FD77090: pStatListEx === 0 and dwFlags === 0 with bRepair === 0 return 0 cleanly
    const vRep = VECTORS.find(
      (v) => v.va === '0x6FD77090' && v.caseId === 'depleted_charged_skill_ret_1',
    )!
    const mRep = stageAll(vRep)
    const sgptRep = mRep.u32(0x6fde9e1c)
    mRep.stage(mRep.u32(0x6fdefb98), '00'.repeat(0x1a8))
    mRep.stage(mRep.u32(sgptRep + 0xbf8), '00'.repeat(0xe4))
    mRep.setU32(vRep.args[0]! + 0x5c, 0)
    mRep.setU8(mRep.u32(sgptRep + 0xbf8) + 0x08, 0)
    expect(ITEMS_CanItemBeRepairedByNpc113c(mRep, vRep.args[0]!)).toBe(0)

    const mRep0 = stageAll(vRep)
    const sgptRep0 = mRep0.u32(0x6fde9e1c)
    mRep0.stage(mRep0.u32(0x6fdefb98), '00'.repeat(0x1a8))
    mRep0.stage(mRep0.u32(sgptRep0 + 0xbf8), '00'.repeat(0xe4))
    mRep0.setU8(mRep0.u32(sgptRep0 + 0xbf8) + 0x08, 0)
    const slRep0 = mRep0.u32(vRep.args[0]! + 0x5c)
    mRep0.setU32(slRep0 + 0x10, 0)
    mRep0.setU32(slRep0 + 0x24, mRep0.u32(slRep0 + 0x48))
    mRep0.setU16(slRep0 + 0x28, mRep0.u16(slRep0 + 0x4c))
    expect(ITEMS_CanItemBeRepairedByNpc113c(mRep0, vRep.args[0]!)).toBe(0)

    // 0x6FD7A480: area === 0 early return + 1x1 area === 1 sets 1 socket
    const vVel = VECTORS.find(
      (v) => v.va === '0x6FD7A480' && v.caseId === 'magic_quality_clamps_6_to_4',
    )!
    const mVel0 = stageAll(vVel)
    const pItemsVel = mVel0.u32(0x6fdefb98)
    mVel0.setU8(pItemsVel + 0x10f, 0)
    ITEMS_GetMissileWeaponVelocity113c(mVel0, vVel.args[0]!, 6)
    expect(mVel0.u16(mVel0.u32(vVel.args[0]! + 0x5c) + 0x28)).toBe(0)
    const mVel1 = stageAll(vVel)
    mVel1.setU8(pItemsVel + 0x10f, 1)
    mVel1.setU8(pItemsVel + 0x110, 1)
    ITEMS_GetMissileWeaponVelocity113c(mVel1, vVel.args[0]!, 6)
    expect(mVel1.u16(mVel1.u32(vVel.args[0]! + 0x5c) + 0x4c)).toBe(1)

    // 0x6FD95E50: assertions, classic wVersion<100, non-socketable prop 0xc2, include[1] + itype=0 break
    const vProp = VECTORS.find(
      (v) => v.va === '0x6FD95E50' && v.caseId === 'matches_include_type_ret_1',
    )!
    const mProp = stageAll(vProp)
    expect(() => ITEMS_EvalItemPropertyList113c(mProp, 0, vProp.args[1]!)).toThrowError(
      D2CommonAssertError,
    )
    const pItemP = vProp.args[0]!
    const pDataP = mProp.u32(pItemP + 0x14)
    const pAffixP = vProp.args[1]!
    const sgptP = mProp.u32(0x6fde9e1c)
    const pItemsP = mProp.u32(0x6fdefb98)
    mProp.setU16(pDataP + 0x30, 0)
    mProp.setU8(pItemsP + 0x132, 1)
    expect(ITEMS_EvalItemPropertyList113c(mProp, pItemP, pAffixP)).toBe(0)
    mProp.setU8(pItemsP + 0x132, 0)
    mProp.setU16(pDataP + 0x30, 100)
    mProp.setU8(pItemsP + 0x137, 0)
    mProp.stage(0x7000, '00'.repeat(0x100))
    mProp.setU32(sgptP + 0xa4, 0x7000)
    mProp.setU32(sgptP + 0xac, 2)
    mProp.setU32(pAffixP + 0x24, 0)
    mProp.setU16(0x7000 + 0x20, 0xc2)
    expect(ITEMS_EvalItemPropertyList113c(mProp, pItemP, pAffixP)).toBe(0)
    mProp.setU16(0x7000 + 0x20, 0x10)
    mProp.setU16(pAffixP + 0x6a, 3) // include[0] = 3 (no equiv match)
    mProp.setU16(pAffixP + 0x6c, 1) // include[1] = 1 (match!)
    expect(ITEMS_EvalItemPropertyList113c(mProp, pItemP, pAffixP)).toBe(1)
    mProp.setU16(pAffixP + 0x6a, 0) // include[0] = 0 -> MUST break before include[1] = 1!
    expect(ITEMS_EvalItemPropertyList113c(mProp, pItemP, pAffixP)).toBe(0)

    // 0x6FD96830: nOverrideSockets === 0 fallback to pModDef + 0x04
    const vRoll = VECTORS.find(
      (v) => v.va === '0x6FD96830' && v.caseId === 'rolled_2_sockets_applied_ret_2',
    )!
    const mRoll = stageAll(vRoll)
    mRoll.setU32(vRoll.args[1]! + 0x04, 3)
    mRoll.setU32(vRoll.args[1]! + 0x08, 0)
    mRoll.setU32(vRoll.args[1]! + 0x0c, 0)
    expect(ITEMS_CraftModRollSockets113c(mRoll, vRoll.args[0]!, vRoll.args[1]!)).toBe(3)

    // 0x6FD9FA30: insufficient Int (Energy) & Vit equality
    const vAlloc = VECTORS.find(
      (v) => v.va === '0x6FD9FA30' && v.caseId === 'all_reqs_satisfied_ret_1',
    )!
    const mAlloc = stageAll(vAlloc)
    const pSkA = mAlloc.u32(mAlloc.u32(0x6fde9e1c) + 0xb98) + 0x23c
    mAlloc.setU16(pSkA + 0x17a, 11) // wReqInt = 11 > 10 -> 0
    expect(SKILLS_CanUnitAllocateSkillPoint113c(mAlloc, vAlloc.args[0]!, 1)).toBe(0)
    mAlloc.setU16(pSkA + 0x17a, 10)
    mAlloc.setU16(pSkA + 0x17c, 21)
    expect(SKILLS_CanUnitAllocateSkillPoint113c(mAlloc, vAlloc.args[0]!, 1)).toBe(0)
    mAlloc.setU16(pSkA + 0x17c, 20)
    expect(SKILLS_CanUnitAllocateSkillPoint113c(mAlloc, vAlloc.args[0]!, 1)).toBe(1)

    // 0x6FD9FB30: reqSk[1] = 0 with reqSk[2] = 1 (so unaligned +0x181 reads 0x0100 = 256 oob!)
    const vPrq = VECTORS.find(
      (v) => v.va === '0x6FD9FB30' && v.caseId === 'prereq_skill0_learned_ret_1',
    )!
    const mPrq = stageAll(vPrq)
    const pSkBase = mPrq.u32(mPrq.u32(0x6fde9e1c) + 0xb98)
    const pSkP = pSkBase + 0x23c
    const pSkillsP = mPrq.u32(vPrq.args[0]! + 0xa8)
    const pSkillNode = mPrq.u32(pSkillsP + 0x04)
    mPrq.stage(0x7200, '00'.repeat(0x40))
    mPrq.setU32(0x7200, pSkP) // skill 1 node
    mPrq.setU32(0x7200 + 0x28, 1)
    mPrq.setU32(0x7200 + 0x34, 0xffffffff)
    mPrq.setU32(pSkillNode + 0x04, 0x7200)
    mPrq.setU16(pSkP + 0x17e, 0xffff)
    mPrq.setU16(pSkP + 0x180, 0)
    mPrq.setU16(pSkP + 0x182, 1)
    expect(SKILLS_CheckSkillLevelAndPrereqs113c(mPrq, vPrq.args[0]!, 1)).toBe(1)
    mPrq.setU16(pSkP + 0x182, 0xffff)
    mPrq.setU32(pSkillNode + 0x28, 0)
    expect(SKILLS_CheckSkillLevelAndPrereqs113c(mPrq, vPrq.args[0]!, 1)).toBe(0)
    mPrq.setU32(pSkillNode + 0x28, 1)
    mPrq.setU32(pSkillNode + 0x00, pSkP)
    expect(SKILLS_CheckSkillLevelAndPrereqs113c(mPrq, vPrq.args[0]!, 1)).toBe(0)

    // 0x6FD9FE80: skId === 0 with param1 != 0, plus prod = -1073741831
    const vSc = VECTORS.find(
      (v) => v.va === '0x6FD9FE80' && v.caseId === 'state42_active_scales_80_by_4_div8',
    )!
    const mSc = stageAll(vSc)
    const sgptSc = mSc.u32(0x6fde9e1c)
    mSc.setU32(mSc.u32(sgptSc + 0xb98) + 0x148, 1)
    const pSubSc = mSc.u32(mSc.u32(vSc.args[0]! + 0x5c) + 0x3c)
    const pArrSc = mSc.u32(pSubSc + 0x24)
    mSc.setU32(pArrSc + 4, (-1073741831) >>> 0)
    expect(SKILLS_ScaleValueByMasteryAndSkillParam1113c(mSc, vSc.args[0]!, 0)).toBe(-134217728)

    // 0x6FDA1ED0: count === 0 skips loop even if pArr === 0
    const vRem = VECTORS.find(
      (v) => v.va === '0x6FDA1ED0' && v.caseId === 'clears_active_curse_state9_ret_1',
    )!
    const mRem = stageAll(vRem)
    const sgptRem = mRem.u32(0x6fde9e1c)
    mRem.setU16(sgptRem + 0x180, 0)
    mRem.setU32(sgptRem + 0x17c, 0)
    expect(SKILLS_RemoveAllCurseAndDebuffStatesFromUnit113c(mRem, vRem.args[0]!)).toBe(1)

    // 0x6FDA0D40: player Bow (wClass=1), Crossbow (wClass=7), Sword (wClass=3)
    const mWeap = new SparseMemory113c()
    mWeap.fill(0x1000, 0x100, 0) // player
    mWeap.fill(0x2000, 0x100, 0) // statlistex
    mWeap.fill(0x2200, 0x40, 0) // stats
    mWeap.fill(0x3000, 0x100, 0) // inv
    mWeap.fill(0x3100, 0x40, 0) // grid
    mWeap.fill(0x3200, 0x40, 0) // ppItems
    mWeap.fill(0x4000, 0x100, 0) // weapon
    mWeap.fill(0x4100, 0x80, 0) // weapon data
    mWeap.fill(0x5000, 0xd00, 0) // sgpt
    mWeap.fill(0x6000, 0x200, 0) // items.txt
    mWeap.fill(0x6400, 0x600, 0) // itemtypes equiv
    mWeap.fill(0x10000, 220 * 0x144, 0) // isc
    mWeap.fill(0x6f00, 0x100, 0) // bitmasks
    for (let i = 0; i < 32; i++) mWeap.setU32(0x6f00 + i * 4, (1 << i) >>> 0)
    mWeap.fill(0x6fdd90b0, 8, 0)
    mWeap.setU32(0x6fdd90b0, 0x6f00)
    mWeap.fill(0x6fded378, 32, 0)
    mWeap.setU8(0x6fded378, 10)
    mWeap.setU8(0x6fded379, 1)
    mWeap.fill(0x6fdef020, 0x40, 0) // weapClass table
    mWeap.fill(0x6fdefb90, 0x20, 0)
    mWeap.setU32(0x6fde9e1c, 0x5000)
    mWeap.setU32(0x6fdefb94, 2)
    mWeap.setU32(0x6fdefb98, 0x6000)
    mWeap.setU32(0x5000 + 0xbfc, 68)
    mWeap.setU32(0x5000 + 0xc00, 3)
    mWeap.setU32(0x5000 + 0xc04, 0x6400)
    // wType0 = 0x2d -> equiv(0x2d, 0x2d): row 0x2d * 3 + 1 = 0x88, bit 0x2d & 31 = 13
    mWeap.setU32(0x6400 + (0x2d * 3 + 1) * 4, 1 << (0x2d & 31))
    mWeap.setU32(0x5000 + 0xbd4, 220)
    mWeap.setU32(0x5000 + 0xbcc, 0x10000)
    mWeap.setU32(0x6fdef020, 1) // weapClass count = 1
    mWeap.setU32(0x6fdef028, 0x626f7720) // 'bow '
    mWeap.setU16(0x6fdef02c, 1) // wClass = 1 (Bow)
    mWeap.setU32(0x1000, 0) // UNIT_PLAYER
    mWeap.setU32(0x105c, 0x2000)
    mWeap.setU32(0x1060, 0x3000)
    mWeap.setU32(0x2000 + 0x10, 0x80000000)
    mWeap.setU32(0x2000 + 0x48, 0x2200)
    mWeap.setU16(0x2000 + 0x4c, 1)
    mWeap.setU16(0x2202, 0x9d)
    mWeap.setU32(0x2204, 5)
    mWeap.setU32(0x3000, 0x01020304)
    mWeap.setU32(0x3014, 0x3100)
    mWeap.setU32(0x3018, 1)
    mWeap.setU8(0x3108, 10)
    mWeap.setU8(0x3109, 1)
    mWeap.setU32(0x310c, 0x3200)
    mWeap.setU32(0x3210, 0x4000)
    mWeap.setU32(0x4000, 4)
    mWeap.setU32(0x4004, 0)
    mWeap.setU32(0x4014, 0x4100)
    mWeap.setU32(0x4100 + 0x18, 0x10)
    mWeap.setU16(0x6000 + 0x11e, 0x2d) // weapon wType1 = 0x2d
    mWeap.setU32(0x6000 + 0xc0, 0x626f7720)
    const outBow = 0x7000
    mWeap.fill(outBow, 8, 0)
    expect(SKILLS_GetWeaponMasteryPassiveStatId113c(mWeap, 0x1000, outBow)).toBe(0x1b)
    expect(mWeap.u32(outBow)).toBe(5)
    mWeap.setU32(0x2204, 0)
    expect(SKILLS_GetWeaponMasteryPassiveStatId113c(mWeap, 0x1000, outBow)).toBe(0)
    mWeap.setU16(0x6fdef02c, 7) // Crossbow
    expect(SKILLS_GetWeaponMasteryPassiveStatId113c(mWeap, 0x1000, outBow)).toBe(0x1f)
    mWeap.setU16(0x6fdef02c, 3) // Sword
    expect(SKILLS_GetWeaponMasteryPassiveStatId113c(mWeap, 0x1000, outBow)).toBe(-1)

    // 0x6FD91730: non-square 10x4 grid with seed=1 & 4 valid cells so startRx (0x5c vs 0x60) decides which 3 spawn
    const vBar = VECTORS.find(
      (v) => v.va === '0x6FD91730' && v.caseId === 'act5_barricade_spawns_3_presets',
    )!
    const mBar = stageAll(vBar)
    mBar.setU32(vBar.args[0]! + 0x1c4, 1) // seedLo = 1, seedHi = 0 -> startX=6 (orig) vs startX=0 (0x60)
    mBar.setU32(vBar.args[0]! + 0x1c8, 0)
    const pOutBar = mBar.u32(vBar.args[0]! + 0x14)
    mBar.setU32(pOutBar + 0x5c, 10)
    mBar.setU32(pOutBar + 0x60, 4)
    const pRows0B = mBar.u32(pOutBar + 0x08)
    const pCells0B = mBar.u32(pOutBar + 0x04)
    const pRows2B = mBar.u32(pOutBar + 0x30)
    const pCells2B = mBar.u32(pOutBar + 0x2c)
    for (let y = 0; y < 4; y++) {
      mBar.setU32(pRows0B + y * 4, y * 10)
      mBar.setU32(pRows2B + y * 4, y * 10)
      for (let x = 0; x < 10; x++) {
        mBar.setU32(pCells0B + (y * 10 + x) * 4, 0)
        mBar.setU32(pCells2B + (y * 10 + x) * 4, 0)
      }
    }
    const pPrestBase = mBar.u32(0x6fdf0b3c)
    const prestAA = (pPrestBase + 0x3aa * 0x1b0) >>> 0
    mBar.stage(prestAA, '00'.repeat(0x1b0))
    mBar.setU32(prestAA, 0x3aa)
    mBar.setU32(prestAA + 0x28, 8)
    mBar.setU32(prestAA + 0x2c, 8)
    mBar.setU32(prestAA + 0x40, 2)
    mBar.setU32(pCells2B + (1 * 10 + 1) * 4, 0x200)
    mBar.setU32(pCells0B + (1 * 10 + 1) * 4, 0x393)
    mBar.setU32(pCells2B + (1 * 10 + 3) * 4, 0x200)
    mBar.setU32(pCells0B + (1 * 10 + 3) * 4, 0x393)
    mBar.setU32(pCells2B + (1 * 10 + 5) * 4, 0x200)
    mBar.setU32(pCells0B + (1 * 10 + 5) * 4, 0x393)
    mBar.setU32(pCells2B + (1 * 10 + 9) * 4, 0x200)
    mBar.setU32(pCells0B + (1 * 10 + 9) * 4, 0x39a)
    DRLGOUTPLACE_SpawnAct5Barricade421Preset113c(mBar, vBar.args[0]!)
    // startX=6 hits (9,1)->0x3aa, (1,1)->0x3a3, (3,1)->0x3a3; startX=0 would hit (1,1),(3,1),(5,1) and miss (9,1)
    expect(mBar.u32(pCells0B + (1 * 10 + 9) * 4)).toBe(0x3aa)
    expect(mBar.u32(pCells0B + (1 * 10 + 5) * 4)).toBe(0x393)
    mBar.setU32(pCells0B + (1 * 10 + 5) * 4, 0)
    expect(() => DRLGOUTPLACE_SpawnAct5Barricade421Preset113c(mBar, vBar.args[0]!)).toThrowError(
      D2CommonAssertError,
    )
    mBar.setU32(vBar.args[0]! + 0x14, 0)
    expect(() => DRLGOUTPLACE_SpawnAct5Barricade421Preset113c(mBar, vBar.args[0]!)).toThrowError(
      D2CommonAssertError,
    )
  })
})

