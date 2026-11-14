import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  ITEMS_CanUseCharmInInventory113c,
  ITEMS_CheckRequirements113c,
  ITEMS_CraftModAddSockets113c,
} from '../../../src/d2kern-113c/common/items.ts'
import {
  SKILLS_CheckSkillManaOrCharges113c,
  SKILLS_CheckUnitEquippedWeaponsMatchSkill113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetSkillBonusLevel113c,
  SKILLS_GetSkillLevelByIdWithBonus113c,
  SKILLS_GetUnitSkillBonusBySkillId113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  DRLGOUTROOM_SpawnAct5BarricadeWallStrip113c,
  DRLGOUTROOM_SpawnAct5EdgeTransitions113c,
  DRLGOUTROOM_SpawnFrigidHighlandsCorner113c,
  DRLGOUTROOM_SpawnHellAct5SpecialCorners113c,
  DRLGOUTROOM_TraceAndSpawnPlateauPerimeter113c,
  DRLGOUTROOM_TryUpgradeBorderPreset113c,
} from '../../../src/d2kern-113c/tables/anim-tbls-113c.ts'
import { DATATBLS_GetItemRatioTxtRecord113c } from '../../../src/d2kern-113c/tables/datatbls-113c.ts'
import { DRLGOUTWILD_SpawnRiverColumnAndBridge113c } from '../../../src/d2kern-113c/tables/field-tbls-113c.ts'

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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i10b-2-vectors.ndjson')

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
  '0x6FD76DB0': (m, a) =>
    ITEMS_CheckRequirements113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!) >>> 0,
  '0x6FD787D0': (m, a) => ITEMS_CanUseCharmInInventory113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD91070': (m, a) => {
    DRLGOUTROOM_SpawnAct5BarricadeWallStrip113c(m, a[0]!)
    return 0
  },
  '0x6FD91120': (m, a) => {
    DRLGOUTROOM_SpawnFrigidHighlandsCorner113c(m, a[0]!)
    return 0
  },
  '0x6FD911E0': (m, a) => DRLGOUTROOM_TryUpgradeBorderPreset113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD91230': (m, a) => {
    DRLGOUTROOM_TraceAndSpawnPlateauPerimeter113c(m, a[0]!)
    return 0
  },
  '0x6FD916B0': (m, a) => {
    DRLGOUTROOM_SpawnHellAct5SpecialCorners113c(m, a[0]!)
    return 0
  },
  '0x6FD91B50': (m, a) => {
    DRLGOUTROOM_SpawnAct5EdgeTransitions113c(m, a[0]!)
    return 0
  },
  '0x6FD97DC0': (m, a) =>
    ITEMS_CraftModAddSockets113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
      a[6]!,
    ) >>> 0,
  '0x6FD9FCB0': (m, a) => SKILLS_GetSkillBonusLevel113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDA0560': (m, a) => SKILLS_GetUnitSkillBonusBySkillId113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDA05C0': (m, a) => SKILLS_EvaluateSkillLevel113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FDA0AF0': (m, a) => SKILLS_CheckSkillManaOrCharges113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDA0EA0': (m, a) => SKILLS_GetSkillLevelByIdWithBonus113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDA0F00': (m, a) =>
    SKILLS_CheckUnitEquippedWeaponsMatchSkill113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDC4000': (m, a) => DATATBLS_GetItemRatioTxtRecord113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FDCECC0': (m, a) => {
    DRLGOUTWILD_SpawnRiverColumnAndBridge113c(m, a[0]!, a[1]!)
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

describe('K1r7 Iteration 10 Lane B — I10B-2 differential verification (17 functions)', () => {
  it('loads all 17 I10B-2 function VAs from the real-DLL fixture', () => {
    expect(VECTORS.length).toBe(47)
    const uniqueVas = new Set(VECTORS.map((v) => v.va))
    expect(uniqueVas.size).toBe(17)
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

  it('covers I10B-2 assertions and boundary branches', () => {
    // 0x6FD76DB0 unitLvl === reqLvl, class-specific item on player & Act 5 hireling
    const v1 = VECTORS.find((v) => v.va === '0x6FD76DB0' && v.caseId === 'all_reqs_met_ret_1')!
    const m1 = stageAll(v1)
    const [pItem1, pUnit1, bEquip1, pOutStr1, pOutDex1, pOutLvl1] = v1.args as [
      number,
      number,
      number,
      number,
      number,
      number,
    ]
    const sgpt1 = m1.u32(0x6fde9e1c)
    const pItemTypesTxt1 = m1.u32(sgpt1 + 0xbf8)
    const pItemsTxt1 = m1.u32(0x6fdefb98)
    const pList1 = m1.u32(pUnit1 + 0x5c)
    const pStats1 = m1.u32(pList1 + 0x48)
    m1.setU8(pItemsTxt1 + 0x13f, 10) // nLevelReq (+0x13f) = 10
    m1.setU32(pStats1 + 20, 10) // unitLvl = 10 === reqLvl (10)
    m1.setU8(pItemTypesTxt1 + 1 * 0xe4 + 0x21, 4) // type 1 nClass (+0x21) = 4 (Barbarian)
    // Amazon (clsId 0) cannot equip Barbarian item (itemClass 4) -> returns 0, but outLvl = 1
    expect(ITEMS_CheckRequirements113c(m1, pItem1, pUnit1, bEquip1, pOutStr1, pOutDex1, pOutLvl1)).toBe(0)
    expect(m1.u32(pOutLvl1)).toBe(1)
    // Barbarian player (clsId 4) -> returns 1
    m1.setU32(pUnit1 + 4, 4)
    expect(ITEMS_CheckRequirements113c(m1, pItem1, pUnit1, bEquip1, pOutStr1, pOutDex1, pOutLvl1)).toBe(1)
    // Act 5 hireling (uType = 1, clsId = 0x230, nMonStatsTxtRecordCount = 0x240) -> returns 1
    m1.setU32(sgpt1 + 0xa80, 0x240)
    m1.setU32(pUnit1, 1)
    m1.setU32(pUnit1 + 4, 0x230)
    expect(ITEMS_CheckRequirements113c(m1, pItem1, pUnit1, bEquip1, 0, 0, 0)).toBe(1)

    // 0x6FD787D0 pItem === 0
    expect(ITEMS_CanUseCharmInInventory113c(m1, 0, 0)).toBe(0)

    // 0x6FD91070 assertions (0x28a, 0x28d, 0x294) and +0x5b3b0 offset check
    const m2 = new SparseMemory113c()
    m2.fill(0x1000, 0x200, 0)
    m2.fill(0x2000, 0x100, 0)
    m2.fill(0x3000, 0x600, 0)
    m2.fill(0x5000, 0xd00, 0)
    m2.fill(0x10000 + 0x5b3b0, 0x2000, 0)
    expect(() => DRLGOUTROOM_SpawnAct5BarricadeWallStrip113c(m2, 0x1000)).toThrowError(
      D2CommonAssertError,
    )
    m2.setU32(0x1014, 0x2000) // pOutdoors
    m2.setU32(0x6fde9e1c, 0x5000)
    m2.setU32(0x5000 + 0xc68, 0x361) // count <= 0x361 -> throws 0x28d
    expect(() => DRLGOUTROOM_SpawnAct5BarricadeWallStrip113c(m2, 0x1000)).toThrowError(
      D2CommonAssertError,
    )
    m2.setU32(0x5000 + 0xc68, 0x400)
    m2.setU32(0x6fdf0b3c, 0x10000) // SGP_LVLPREST_TXT_VA_113C
    m2.setU32(0x10000 + 0x5b3b0 + 0x28, 16) // step = 2
    m2.setU32(0x2000 + 0x5c, 15) // width = 15 -> gx goes negative on i=7 -> throws 0x294
    m2.setU32(0x2000 + 0x04, 0x3000)
    m2.setU32(0x2000 + 0x08, 0x3100)
    m2.setU32(0x2000 + 0x18, 0x3200)
    m2.setU32(0x2000 + 0x1c, 0x3300)
    m2.setU32(0x2000 + 0x2c, 0x3400)
    m2.setU32(0x2000 + 0x30, 0x3500)
    expect(() => DRLGOUTROOM_SpawnAct5BarricadeWallStrip113c(m2, 0x1000)).toThrowError(
      D2CommonAssertError,
    )

    // 0x6FD91120 assertions (0x26f, 0x270, 0x273, 0x277) and distinct sx (+0x28) vs sy (+0x2c)
    const m3 = new SparseMemory113c()
    m3.fill(0x1000, 0x200, 0)
    m3.fill(0x2000, 0x100, 0)
    m3.fill(0x5000, 0xd00, 0)
    expect(() => DRLGOUTROOM_SpawnFrigidHighlandsCorner113c(m3, 0)).toThrowError(
      D2CommonAssertError,
    )
    m3.setU32(0x1000 + 0x1d0, 1) // nLevelId !== 0x6f
    expect(() => DRLGOUTROOM_SpawnFrigidHighlandsCorner113c(m3, 0x1000)).toThrowError(
      D2CommonAssertError,
    )
    m3.setU32(0x1000 + 0x1d0, 0x6f)
    expect(() => DRLGOUTROOM_SpawnFrigidHighlandsCorner113c(m3, 0x1000)).toThrowError(
      D2CommonAssertError,
    )
    m3.setU32(0x1014, 0x2000)
    m3.setU32(0x6fde9e1c, 0x5000)
    m3.setU32(0x5000 + 0xc68, 0x100) // count <= 0x370 -> pPrest880 = 0
    expect(() => DRLGOUTROOM_SpawnFrigidHighlandsCorner113c(m3, 0x1000)).toThrowError(
      D2CommonAssertError,
    )
    const v3b = VECTORS.find(
      (v) => v.va === '0x6FD91120' && v.caseId === 'frigid_corner_8x8_void',
    )!
    const m3b = stageAll(v3b)
    const pPrest880_3b = (m3b.u32(0x6fdf0b3c) + 0x370 * 0x1b0) >>> 0
    m3b.setU32(pPrest880_3b + 0x28, 24) // sx = 24 (sx/8 = 3 -> gx = 8 - 3 = 5), sy = 16 (gy = 6)
    DRLGOUTROOM_SpawnFrigidHighlandsCorner113c(m3b, v3b.args[0]!)
    const pOut3b = m3b.u32(v3b.args[0]! + 0x14)
    const row6Off3b = m3b.u32(m3b.u32(pOut3b + 0x08) + 6 * 4)
    expect(m3b.u32(m3b.u32(pOut3b + 0x04) + (row6Off3b + 5) * 4)).toBe(0x370)

    // 0x6FD911E0 boundary presetIds 0x392, 0x393, 0x39a, 0x39b
    const v4 = VECTORS.find(
      (v) => v.va === '0x6FD911E0' && v.caseId === 'upgrades_0x395_to_0x3a5_ret_1',
    )!
    const m4 = stageAll(v4)
    const [pLvl4, gx4, gy4] = v4.args as [number, number, number]
    const pOut4 = m4.u32(pLvl4 + 0x14)
    const pGrid0Cells4 = m4.u32(pOut4 + 0x04)
    const pGrid0Rows4 = m4.u32(pOut4 + 0x08)
    const pGrid2Cells4 = m4.u32(pOut4 + 0x2c)
    const pGrid2Rows4 = m4.u32(pOut4 + 0x30)
    const cell0Addr4 = pGrid0Cells4 + (m4.u32(pGrid0Rows4 + gy4 * 4) + gx4) * 4
    const cell2Addr4 = pGrid2Cells4 + (m4.u32(pGrid2Rows4 + gy4 * 4) + gx4) * 4
    const pPrestBase4 = m4.u32(0x6fdf0b3c)
    m4.stage(pPrestBase4 + 0x3a3 * 0x1b0, '00'.repeat(8 * 0x1b0))
    m4.setU32(pPrestBase4 + 0x3a3 * 0x1b0 + 0x40, 3)
    m4.setU32(pPrestBase4 + 0x3aa * 0x1b0 + 0x40, 3)
    m4.setU32(cell2Addr4, 0x200)
    m4.setU32(cell0Addr4, 0x392)
    expect(DRLGOUTROOM_TryUpgradeBorderPreset113c(m4, pLvl4, gx4, gy4)).toBe(0)
    m4.setU32(cell0Addr4, 0x39b)
    expect(DRLGOUTROOM_TryUpgradeBorderPreset113c(m4, pLvl4, gx4, gy4)).toBe(0)
    m4.setU32(cell0Addr4, 0x393)
    expect(DRLGOUTROOM_TryUpgradeBorderPreset113c(m4, pLvl4, gx4, gy4)).toBe(1)
    expect(m4.u32(cell0Addr4)).toBe(0x3a3)
    m4.setU32(cell2Addr4, 0x200)
    m4.setU32(cell0Addr4, 0x39a)
    expect(DRLGOUTROOM_TryUpgradeBorderPreset113c(m4, pLvl4, gx4, gy4)).toBe(1)
    expect(m4.u32(cell0Addr4)).toBe(0x3aa)

    // 0x6FD916B0 nLevelId = 0x75 with sizeX > sizeY
    const v5 = VECTORS.find(
      (v) => v.va === '0x6FD916B0' && v.caseId === 'lvl117_tall_spawns_0x3d7_0x3d9_void',
    )!
    const m5 = stageAll(v5)
    const pLvl5 = v5.args[0]!
    const pOut5 = m5.u32(pLvl5 + 0x14)
    const pGrid0Cells5 = m5.u32(pOut5 + 0x04)
    const pGrid0Rows5 = m5.u32(pOut5 + 0x08)
    m5.setU32(pLvl5 + 0x24, 40) // sizeX = 40
    m5.setU32(pLvl5 + 0x28, 20) // sizeY = 20 (sizeX > sizeY)
    DRLGOUTROOM_SpawnHellAct5SpecialCorners113c(m5, pLvl5)
    const row2Off5 = m5.u32(pGrid0Rows5 + 2 * 4)
    expect(m5.u32(pGrid0Cells5 + (row2Off5 + 6) * 4)).toBe(0x3d8)
    expect(m5.u32(pGrid0Cells5 + (row2Off5 + 0) * 4)).toBe(0x3da)

    // 0x6FD91B50 loop termination when no edge cells have bit 0x400 set and distinct w (+0x5c) vs h (+0x60)
    const m6 = new StrictMem()
    m6.stage(0x1000, '00'.repeat(0x200))
    m6.stage(0x2000, '00'.repeat(0x80))
    m6.stage(0x3500, '00'.repeat(16)) // exactly 4 row offsets staged (h = 4)
    m6.stage(0x3400, '00'.repeat(64)) // 4x4 cells staged
    m6.setU32(0x1014, 0x2000)
    m6.setU32(0x205c, 4) // w = 4
    m6.setU32(0x2060, 4) // h = 4
    m6.setU32(0x202c, 0x3400)
    m6.setU32(0x2030, 0x3500)
    for (let r = 0; r < 4; r++) m6.setU32(0x3500 + r * 4, r * 4)
    DRLGOUTROOM_SpawnAct5EdgeTransitions113c(m6, 0x1000)
    expect(m6.rogueWrites).toEqual([])
    const v6b = VECTORS.find(
      (v) => v.va === '0x6FD91B50' && v.caseId === 'lvl110_all_4_edges_pick1_void',
    )!
    const m6b = stageAll(v6b)
    const pOut6b = m6b.u32(v6b.args[0]! + 0x14)
    m6b.setU32(pOut6b + 0x60, 5) // h = 5 !== w = 6 (rightX = 6 - 2 = 4)
    DRLGOUTROOM_SpawnAct5EdgeTransitions113c(m6b, v6b.args[0]!)
    const row2Off6b = m6b.u32(m6b.u32(pOut6b + 0x08) + 2 * 4)
    expect(m6b.u32(m6b.u32(pOut6b + 0x04) + (row2Off6b + 4) * 4)).toBe(0x38b)

    // 0x6FD97DC0 assert on pModDef === 0, dwUnitType check, and edx + 4 offset
    const m7 = new SparseMemory113c()
    m7.fill(0x1000, 0x100, 0)
    m7.fill(0x2000, 0x100, 0)
    m7.fill(0x3000, 0x20, 0)
    expect(() => ITEMS_CraftModAddSockets113c(m7, 0x1000, 0)).toThrowError(D2CommonAssertError)
    m7.setU32(0x1000, 1) // dwUnitType = 1 (not 4)
    m7.setU32(0x1014, 0x2000)
    m7.setU32(0x3000, 0)
    m7.setU32(0x3004, 3) // pModDef + 4 = 3
    expect(ITEMS_CraftModAddSockets113c(m7, 0x1000, 0x3000)).toBe(1)
    expect(m7.u32(0x2000 + 0x18)).toBe(0) // not modified when dwUnitType !== 4

    // 0x6FD9FCB0 monster baseLvl === 0 vs > 0 for oskill cap
    const v8 = VECTORS.find(
      (v) => v.va === '0x6FD9FCB0' && v.caseId === 'same_class_oskill_capped_ret_10',
    )!
    const m8 = stageAll(v8)
    const [pSk8, pUnit8] = v8.args as [number, number]
    m8.setU32(pUnit8, 1) // monster (uType = 1)
    m8.setU32(pSk8 + 0x2c, 0) // dwBonusLevels = 0
    m8.setU32(pSk8 + 0x28, 0) // baseLvl = 0 -> oskill uncapped (5) + all(1) + elem(1) + single(2) = 9
    expect(SKILLS_GetSkillBonusLevel113c(m8, pSk8, pUnit8)).toBe(9)
    m8.setU32(pSk8 + 0x28, 1) // baseLvl = 1 -> oskill capped (3) + all(1) + elem(1) + single(2) = 7
    expect(SKILLS_GetSkillBonusLevel113c(m8, pSk8, pUnit8)).toBe(7)

    // 0x6FDA0560 pSkillList === 0
    const m9 = new SparseMemory113c()
    m9.fill(0x1000, 0x100, 0)
    m9.setU32(0x1000, 0)
    expect(SKILLS_GetUnitSkillBonusBySkillId113c(m9, 0x1000, 1)).toBe(0)

    // 0x6FDA0AF0 assertions (0x638, 0x6ef), pUnit === 0, Blood Mana (0x72), and +0x2e === 0x74
    const v10 = VECTORS.find(
      (v) => v.va === '0x6FDA0AF0' && v.caseId === 'noncharged_low_mana_ret_0',
    )!
    const m10 = stageAll(v10)
    const [pSk10, pUnit10] = v10.args as [number, number]
    const pSkTxt10 = m10.u32(pSk10)
    expect(() => SKILLS_CheckSkillManaOrCharges113c(m10, 0, 0)).toThrowError(D2CommonAssertError)
    expect(SKILLS_CheckSkillManaOrCharges113c(m10, pSk10, 0)).toBe(0)
    m10.setU16(pSkTxt10 + 0x2e, 0x74)
    m10.stage(0, '00'.repeat(0x100))
    m10.setU32(0xc8, 0x08) // even if 0+0xc8 has bit 3 set, pUnit === 0 returns 0
    expect(SKILLS_CheckSkillManaOrCharges113c(m10, pSk10, 0)).toBe(0)
    m10.setU32(pUnit10 + 0xc8, 0x08) // bit 3 set, bit 2 clear -> 1
    expect(SKILLS_CheckSkillManaOrCharges113c(m10, pSk10, pUnit10)).toBe(1)
    m10.setU32(pUnit10 + 0xc8, 0x04) // bit 2 set, bit 3 clear -> 0
    expect(SKILLS_CheckSkillManaOrCharges113c(m10, pSk10, pUnit10)).toBe(0)
    m10.setU32(pSk10, 0)
    expect(() => SKILLS_CheckSkillManaOrCharges113c(m10, pSk10, pUnit10)).toThrowError(
      D2CommonAssertError,
    )

    // 0x6FDA0F00 wETypeA1 <= 0 && wITypeA1 <= 0 early return
    const m11 = new SparseMemory113c()
    m11.fill(0x1000, 0x100, 0)
    m11.fill(0x2000, 0x100, 0)
    m11.fill(0x2f00, 0x400, 0)
    m11.setU32(0x2000, 0x3000)
    m11.setU16(0x3000 - 0x24, 5) // guard against pSkTxt - 0x24
    m11.setU16(0x3000 + 0x24, 0)
    m11.setU16(0x3000 + 0x18, 0)
    expect(SKILLS_CheckUnitEquippedWeaponsMatchSkill113c(m11, 0x2000, 0x1000)).toBe(1)

    // 0x6FDC4000 assert on invalid wVersion, count <= 0, and recVer >= bestVer tie-breaking
    const v12 = VECTORS.find(
      (v) => v.va === '0x6FDC4000' && v.caseId === 'normal_nonclass_v100_ret_rec1',
    )!
    const m12 = stageAll(v12)
    expect(() => DATATBLS_GetItemRatioTxtRecord113c(m12, 0, 0, 50)).toThrowError(
      D2CommonAssertError,
    )
    const ratioBase = m12.u32(0x6fdefd8c)
    m12.setU16(ratioBase + 0x40, 100) // rec 0 ver = 100
    m12.setU16(ratioBase + 0x44 + 0x40, 100) // rec 1 ver = 100 (tie -> picks rec 1)
    expect(DATATBLS_GetItemRatioTxtRecord113c(m12, 0, 0, 100)).toBe((ratioBase + 0x44) >>> 0)
    m12.setU32(0x6fdefd88, 0) // count = 0 -> returns 0
    expect(DATATBLS_GetItemRatioTxtRecord113c(m12, 0, 0, 100)).toBe(0)

    // 0x6FDCECC0 val2R & 0x100 vs 0x104
    const v13 = VECTORS.find(
      (v) => v.va === '0x6FDCECC0' && v.caseId === 'river_column_no_bridge_void',
    )!
    const m13 = stageAll(v13)
    const [gx13, pLvl13] = v13.args as [number, number]
    const pOut13 = m13.u32(pLvl13 + 0x14)
    const pGrid2Cells13 = m13.u32(pOut13 + 0x2c)
    const row0Off13 = m13.u32(m13.u32(pOut13 + 0x30))
    const cellRAddr13 = pGrid2Cells13 + (row0Off13 + gx13 + 1) * 4
    m13.setU32(cellRAddr13, 0x04) // bit 0x04 set, bit 0x100 clear -> pickR = 3
    DRLGOUTWILD_SpawnRiverColumnAndBridge113c(m13, gx13, pLvl13)
    expect((m13.u32(cellRAddr13) >>> 16) & 0x0f).toBe(3)
  })
})

