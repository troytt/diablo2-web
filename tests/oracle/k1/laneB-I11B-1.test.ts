import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  ITEMS_CanItemBeDroppedOrSold113c,
  ITEMS_EnsureThrowableOrStackableQuantity113c,
  ITEMS_HasUsedCharges113c,
  ITEMS_RemoveFromSocketedOwner113c,
} from '../../../src/d2kern-113c/common/items.ts'
import {
  MISSILE_EvalMissCalcParamCallback113c,
  MISSILE_EvaluateElementalMaxDamage113c,
  MISSILE_EvaluateElementalMinDamage113c,
  MISSILE_EvaluateMissCalcFormula113c,
  MISSILE_EvaluatePhysMaxDamage113c,
  MISSILE_EvaluatePhysMinDamage113c,
  MISSILE_ResolveSkillIdByCodeOrRef113c,
  SKILLS_GetOrCreateSkillStatList113c,
  SKILLS_TestLineOfSightFromUnitToTarget113c,
  STATES_UpdateOrClearState98Transform113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { DRLGOUTWILD_SpawnAllRiversAndBridges113c } from '../../../src/d2kern-113c/tables/field-tbls-113c.ts'

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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i11b-1-vectors.ndjson')

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
  readonly freed: number[] = []
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

  free(p: number): void {
    if ((p >>> 0) !== 0) this.freed.push(p >>> 0)
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
  '0x6FD740D0': (m, a) => ITEMS_CanItemBeDroppedOrSold113c(m, a[0]!) >>> 0,
  '0x6FD74FF0': (m, a) => ITEMS_HasUsedCharges113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD7A170': (m, a) => ITEMS_EnsureThrowableOrStackableQuantity113c(m, a[0]!) >>> 0,
  '0x6FD7A5C0': (m, a) => {
    ITEMS_RemoveFromSocketedOwner113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD83020': (m, a) => {
    STATES_UpdateOrClearState98Transform113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD9F160': (m, a) =>
    SKILLS_TestLineOfSightFromUnitToTarget113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDA22C0': (m, a) => SKILLS_GetOrCreateSkillStatList113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FDBA3E0': (m, a) =>
    MISSILE_EvaluateElementalMaxDamage113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDBA4B0': (m, a) =>
    MISSILE_EvaluatePhysMaxDamage113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDBA580': (m, a) =>
    MISSILE_EvaluatePhysMinDamage113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDBA790': (m, a) =>
    MISSILE_EvaluateMissCalcFormula113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) >>> 0,
  '0x6FDBB160': (m, a) => MISSILE_EvalMissCalcParamCallback113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDBB2B0': (m, a) =>
    MISSILE_ResolveSkillIdByCodeOrRef113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) >>> 0,
  '0x6FDBB360': (m, a) =>
    MISSILE_EvaluateElementalMinDamage113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDCEF60': (m, a) => {
    DRLGOUTWILD_SpawnAllRiversAndBridges113c(m, a[0]!)
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

describe('K1r8 Iteration 11 Lane B — I11B-1 differential verification (15 functions)', () => {
  it('loads all 15 I11B-1 function VAs from the real-DLL fixture', () => {
    expect(VECTORS.length).toBe(58)
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

  it('covers I11B-1 assertions and boundary branches', () => {
    // 0x6FD740D0: null pItem asserts (0x67e), tome wType1 === 4 returns 0
    const m1 = new SparseMemory113c()
    m1.fill(0x1000, 0x100, 0)
    m1.fill(0x2000, 0x200, 0)
    m1.fill(0x5000, 0xd00, 0)
    m1.fill(0x6fdefb90, 0x20, 0)
    expect(() => ITEMS_CanItemBeDroppedOrSold113c(m1, 0)).toThrowError(D2CommonAssertError)
    m1.setU32(0x6fde9e1c, 0x5000)
    m1.setU32(0x6fdefb94, 2)
    m1.setU32(0x6fdefb98, 0x2000)
    m1.setU32(0x1000, 4)
    m1.setU32(0x1004, 0)
    m1.setU16(0x2000 + 0x11e, 4) // wType1 === 4 -> 0
    expect(ITEMS_CanItemBeDroppedOrSold113c(m1, 0x1000)).toBe(0)

    // 0x6FD7A170: throwable stat (0x7d) !== 0 sets quantity (0x46) = 0 and returns 1
    const vQty = VECTORS.find(
      (v) => v.va === '0x6FD7A170' && v.caseId === 'positive_quantity_ret_1',
    )!
    const mQty = stageAll(vQty)
    const pSlQty = mQty.u32(vQty.args[0]! + 0x5c)
    const pArrQty = mQty.u32(pSlQty + 0x48)
    mQty.setU16(pArrQty + 0x02, 0x7d)
    mQty.setU32(pArrQty + 0x04, 1)
    expect(ITEMS_EnsureThrowableOrStackableQuantity113c(mQty, vQty.args[0]!)).toBe(1)
    expect(mQty.u16(pSlQty + 0x4c)).toBe(1)

    // 0x6FD7A5C0: pUnitData === 0 does not call free, pUnitData !== 0 calls free
    const vRm = VECTORS.find(
      (v) => v.va === '0x6FD7A5C0' && v.caseId === 'cursor_item_unlinked_from_inv',
    )!
    const mRm1 = stageAll(vRm)
    ITEMS_RemoveFromSocketedOwner113c(mRm1, 0, vRm.args[1]!)
    expect(mRm1.freed.length).toBe(1)
    const mRm2 = stageAll(vRm)
    mRm2.setU32(vRm.args[1]! + 0x14, 0)
    ITEMS_RemoveFromSocketedOwner113c(mRm2, 0, vRm.args[1]!)
    expect(mRm2.freed.length).toBe(0)

    // 0x6FD83020: nStates === 0x62 boundary skips state toggle
    const vSt = VECTORS.find(
      (v) => v.va === '0x6FD83020' && v.caseId === 'null_owner_clears_state98_and_sublist',
    )!
    const mSt = stageAll(vSt)
    const sgptSt = mSt.u32(0x6fde9e1c)
    mSt.setU32(sgptSt + 0xc4, 0x62)
    STATES_UpdateOrClearState98Transform113c(mSt, vSt.args[0]!, 0)
    expect(mSt.u32(vSt.args[0]! + 0x94)).toBe(0)

    // 0x6FD9F160: uType === 3 (missile) uses dynamic path (+0x02/+0x06), not static (+0x0c/+0x10)
    const vLos = VECTORS.find(
      (v) => v.va === '0x6FD9F160' && v.caseId === 'dynamic_unit_clear_ray_ret_1',
    )!
    const mLos = stageAll(vLos)
    const pUnitLos = vLos.args[2]!
    mLos.setU32(pUnitLos, 3)
    expect(
      SKILLS_TestLineOfSightFromUnitToTarget113c(mLos, vLos.args[0]!, vLos.args[1]!, pUnitLos, 1),
    ).toBe(1)

    // 0x6FDA22C0: pListEx with dwFlags === 0 returns 0 when bCreate === 0
    const vSl = VECTORS.find(
      (v) => v.va === '0x6FDA22C0' && v.caseId === 'existing_sublist_bcreate0_removes_ret_0',
    )!
    const mSl = stageAll(vSl)
    const pListExSl = mSl.u32(vSl.args[0]! + 0x5c)
    mSl.setU32(pListExSl + 0x10, 0)
    expect(SKILLS_GetOrCreateSkillStatList113c(mSl, vSl.args[0]!, vSl.args[1]!, 0)).toBe(0)

    // 0x6FDBA580: pMissile !== 0 + pOwner !== 0 with symCalc and nMissileId = -1
    const vPhys = VECTORS.find(
      (v) => v.va === '0x6FDBA580' && v.caseId === 'lvl2_phys_min_with_100pct_symcalc',
    )!
    const mPhys = stageAll(vPhys)
    mPhys.stage(0x7000, '00'.repeat(0x100))
    mPhys.stage(0x7100, '00'.repeat(0x40))
    mPhys.setU32(0x7000, 3)
    mPhys.setU32(0x7004, 0)
    mPhys.setU32(0x7014, 0x7100)
    mPhys.setU16(0x710c, 2)
    expect(MISSILE_EvaluatePhysMinDamage113c(mPhys, 0x7000, 0x8000, -1, 0)).toBe(5632)

    // 0x6FDBA790: boundary nParamId === 0x2b -> 0 vs 0x2a -> linear, and nParamId === 31 (odd)
    const vMc = VECTORS.find((v) => v.va === '0x6FDBA790' && v.caseId === 'case29_param12_linear')!
    const mMc = stageAll(vMc)
    expect(MISSILE_EvaluateMissCalcFormula113c(mMc, 0, 0, 0x2b, 0, 4)).toBe(0)
    expect(MISSILE_EvaluateMissCalcFormula113c(mMc, 0, 0, 0x2a, 0, 4)).toBe(0)
    expect(MISSILE_EvaluateMissCalcFormula113c(mMc, 0, 0, 31, 0, 4)).toBe(0)

    // 0x6FDBB2B0: pMissile !== 0 with nLevel === 0 keeps 0 (does not read pData + 0x0c)
    const vRpn = VECTORS.find(
      (v) => v.va === '0x6FDBB2B0' && v.caseId === 'rpn_level_mul10_plus_param1',
    )!
    const mRpn = stageAll(vRpn)
    mRpn.stage(0x7000, '00'.repeat(0x100))
    mRpn.stage(0x7100, '00'.repeat(0x40))
    mRpn.setU32(0x7000, 3)
    mRpn.setU32(0x7004, 0)
    mRpn.setU32(0x7014, 0x7100)
    mRpn.setU16(0x710c, 9)
    expect(
      MISSILE_ResolveSkillIdByCodeOrRef113c(mRpn, 0x7000, 0, vRpn.args[2]!, 0, 0),
    ).toBe(7)

    // 0x6FDBB2B0: stat(7,2), stat(7,0), stat(7,1), and case 40 Memory113c minaccr & boundary checks
    const vStat2 = VECTORS.find(
      (v) => v.va === '0x6FDBB2B0' && v.caseId === 'rpn_fn_skill_calc1_stat_mode2_minaccr',
    )!
    const mStat2 = stageAll(vStat2)
    expect(
      MISSILE_ResolveSkillIdByCodeOrRef113c(mStat2, 0, vStat2.args[1]!, vStat2.args[2]!, 0, 3),
    ).toBe(50)
    // Flip Direct bit off -> un-clamped stat 7 = 10; flip pOwner = 0 -> 0
    const sgptStat = mStat2.u32(0x6fde9e1c)
    const iscBase = mStat2.u32(sgptStat + 0xbcc)
    mStat2.setU8(iscBase + 7 * 0x144 + 0x05, 0)
    expect(
      MISSILE_ResolveSkillIdByCodeOrRef113c(mStat2, 0, vStat2.args[1]!, vStat2.args[2]!, 0, 3),
    ).toBe(10)
    expect(MISSILE_ResolveSkillIdByCodeOrRef113c(mStat2, 0, 0, vStat2.args[2]!, 0, 3)).toBe(0)

    const vCase40 = VECTORS.find(
      (v) => v.va === '0x6FDBB2B0' && v.caseId === 'rpn_fn_skill_case40_stat12_minaccr',
    )!
    const mCase40 = stageAll(vCase40)
    expect(
      MISSILE_ResolveSkillIdByCodeOrRef113c(mCase40, 0, vCase40.args[1]!, vCase40.args[2]!, 0, 3),
    ).toBe(15)
    expect(MISSILE_ResolveSkillIdByCodeOrRef113c(mCase40, 0, 0, vCase40.args[2]!, 0, 3)).toBe(0)

    // 0x6FDCEF60: flags & 0x20 with h0 === 0 throws D2CommonAssertError (0x194)
    const vRiv = VECTORS.find(
      (v) => v.va === '0x6FDCEF60' && v.caseId === 'flag20_even_seed_spawns_preset24',
    )!
    const mRiv = stageAll(vRiv)
    const pOutRiv = mRiv.u32(vRiv.args[0]! + 0x14)
    mRiv.setU32(pOutRiv + 0x60, 0)
    expect(() => DRLGOUTWILD_SpawnAllRiversAndBridges113c(mRiv, vRiv.args[0]!)).toThrowError(
      D2CommonAssertError,
    )
  })
})

