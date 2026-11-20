import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  SKILLS_EvalParam12DimReturns113c,
  SKILLS_EvalParam34DimReturns113c,
  SKILLS_EvalParam56DimReturns113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_IsSelectableCorpse10501_113c,
  SKILLS_IsSelectableCorpse10678_113c,
  SKILLS_IsSelectableCorpse11157_113c,
  SKILLS_IsSelectableCorpseWithFlag12_113c,
  SKILLS_IsSelectableCorpseWithVelocity113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  ANIMDATA_FindRecordByCode113c,
  ANIMDATA_GetAnimDataInfo113c,
} from '../../../src/d2kern-113c/tables/anim-tbls-113c.ts'
import { PLAYER_SetPlayerData150ParamsExport113c } from '../../../src/d2kern-113c/tables/datatbls-113c.ts'
import {
  DRLGROOM_RefreshStatusFromCounts113c,
  DRLGROOM_RefreshStatusFromCountsA113c,
  DRLGROOM_RefreshStatusFromCountsB113c,
  DRLGROOM_RefreshStatusFromCountsEax113c,
  DRLGROOM_SetStatusLink0Fastcall113c,
} from '../../../src/d2kern-113c/tables/missile-tbls-113c.ts'

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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i9b-b-vectors.ndjson')

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
  '0x6FD91DD0': (m, a) => ANIMDATA_FindRecordByCode113c(m, a[0]!) >>> 0,
  '0x6FD91EF0': (m, a) => ANIMDATA_GetAnimDataInfo113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDCBC20': (m, a) => DRLGROOM_RefreshStatusFromCountsEax113c(m, a[0]!) >>> 0,
  '0x6FDCBE10': (m, a) => DRLGROOM_RefreshStatusFromCountsA113c(m, a[0]!) >>> 0,
  '0x6FDCBE50': (m, a) => DRLGROOM_RefreshStatusFromCountsB113c(m, a[0]!) >>> 0,
  '0x6FDCBE90': (m, a) => DRLGROOM_RefreshStatusFromCounts113c(m, a[0]!) >>> 0,
  '0x6FDCBED0': (m, a) => {
    DRLGROOM_SetStatusLink0Fastcall113c(m, a[0]!)
    return 0
  },
  '0x6FDCF670': (m, a) => {
    PLAYER_SetPlayerData150ParamsExport113c(m, a[0]!, a[1]!, a[2]!, a[3]!)
    return 0
  },
  '0x6FD9E5E0': (m, a) => SKILLS_EvalParam56DimReturns113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD9E630': (m, a) => SKILLS_EvalParam34DimReturns113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD9E680': (m, a) => SKILLS_EvalParam12DimReturns113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD9F070': (m, a) => SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD9FF80': (m, a) => SKILLS_IsSelectableCorpse10501_113c(m, a[0]!) >>> 0,
  '0x6FD9FFD0': (m, a) => SKILLS_IsSelectableCorpse11157_113c(m, a[0]!) >>> 0,
  '0x6FDA0090': (m, a) => SKILLS_IsSelectableCorpse10678_113c(m, a[0]!) >>> 0,
  '0x6FDA00E0': (m, a) => SKILLS_IsSelectableCorpseWithFlag12_113c(m, a[0]!) >>> 0,
  '0x6FDA0150': (m, a) => SKILLS_IsSelectableCorpseWithVelocity113c(m, a[0]!, a[1]!) >>> 0,
}

function stageAll(v: VectorRecord): StrictMem {
  const m = new StrictMem()
  for (const blk of v.pre) {
    m.stage(blk.addr >>> 0, blk.hex)
  }
  return m
}

describe('K1r3 Iteration 9 Lane B — I9B-B anim/RoomEx/player/skills differential verification (17 functions)', () => {
  it('loads all 17 I9B-B function VAs from the real-DLL fixture', () => {
    expect(VECTORS.length).toBeGreaterThanOrEqual(150)
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

  describe('fixture sensitivity (the replay must notice a wrong result)', () => {
    it('every function has at least one vector whose eax or memory changes are non-trivial', () => {
      for (const va of Object.keys(DISPATCH)) {
        const vs = VECTORS.filter((v) => v.va === va)
        const informative = vs.some(
          (v) => (v.retMask !== 0 && new Set(vs.map((x) => x.eax)).size > 1) || v.post.some((b, i) => b.hex !== v.pre[i]!.hex),
        )
        expect(informative, va).toBe(true)
      }
    })

    it('AnimData lookup upper-cases the code buffer in place exactly as the DLL does', () => {
      const v = VECTORS.find((x) => x.va === '0x6FD91DD0' && x.caseId === 'lowercase_match_rec0')!
      const strPre = v.pre.find((b) => b.addr === 0x20012000)!
      const strPost = v.post.find((b) => b.addr === 0x20012000)!
      expect(strPre.hex).not.toBe(strPost.hex)
      const m = stageAll(v)
      ANIMDATA_FindRecordByCode113c(m, 0x20012000)
      expect(toHex(m.readBytes(0x20012000, 16))).toBe(strPost.hex)
    })

    it('RoomEx refresh rewrites the status byte and relinks the list (post differs from pre)', () => {
      const v = VECTORS.find((x) => x.va === '0x6FDCBC20' && x.caseId === 's2_zero_moves_to_1')!
      expect(v.post[0]!.hex).not.toBe(v.pre[0]!.hex)
      const m = stageAll(v)
      DRLGROOM_RefreshStatusFromCountsEax113c(m, 0x20013000)
      expect(m.u8(0x20013044)).toBe(1)
    })
  })
})
