/**
 * [K6-P14] Real-DLL D2Game.dll Parity Vector Suite (44 VAs).
 *
 * Replays every real-DLL vector emitted by tools/oracle/k6-p14/k6-p14-d2game-emitter.c
 * against the TypeScript v1.13c kernel in src/d2kern-113c/game/k2-real-s2c-combat-113c.ts,
 * verifying 100% bit-exact agreement on return values, Fog.#10024 assertion line numbers,
 * staged arena memory mutations, extra D2Game global ranges, heap allocations, and va-trace-113c hits.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import {
  AIGENERAL_CopyAiCommandParams113c,
  AI_GeneralFindTargetOrThrottle113c,
  AiFallen113c,
  AiZombie113c,
  MONSTER_EndDeath113c,
  MONSTER_EndToAiOrNeutral113c,
  MONSTER_StartDeath113c,
  MONSTER_StartMode113c,
  MONSTER_StartMove113c,
  MONSTER_StepPath113c,
  MONSTER_StepRun113c,
  MONSTER_StepWalk113c,
  PLAYER_StartModeDispatch113c,
  SUNITDMG_AddDemonDamageBonus113c,
  SUNITDMG_AddLeechedLifeToUnit113c,
  SUNITDMG_AddMonsterTypeDamageBonus113c,
  SUNITDMG_ApplyArmorPenetrationAndFlatBonus113c,
  SUNITDMG_ApplyAttackerThornsToSelf113c,
  SUNITDMG_ApplyBurnEffect_6FCFC940_113c,
  SUNITDMG_ApplyCannotBeFrozenAndShrineImmunities_6FCFA7B0_113c,
  SUNITDMG_ApplyColdChilledEffect113c,
  SUNITDMG_ApplyFreezeEffect113c,
  SUNITDMG_ApplyLifeManaSteal113c,
  SUNITDMG_ApplyPoisonEffect113c,
  SUNITDMG_ApplyResistancesAndAbsorb113c,
  SUNITDMG_ApplySingleChannelResistance113c,
  SUNITDMG_ApplyStunEffect113c,
  SUNITDMG_CheckMonTypeFlag113c,
  SUNITDMG_CheckToHit113c,
  SUNITDMG_ClampManaBurnByMonsterSkill113c,
  SUNITDMG_ComputeWeaponBaseDamage113c,
  SUNITDMG_ConsumeManaCost113c,
  SUNITDMG_ConsumeStaminaCost113c,
  SUNITDMG_DistributeExperience113c,
  SUNITDMG_FillDamageValues113c,
  SUNITDMG_GetPvpOrPetDamageMultiplier113c,
  SUNITDMG_GetTotalSkillDamageBonus113c,
  SUNITDMG_PrependCombatNode113c,
  SUNITDMG_RollDamageValue113c,
  SUNITDMG_RollElementalStatDamage113c,
  SUNITDMG_SelectDeathOverlayFlag113c,
  SUNITDMG_TriggerAttackerBlindOrFlee113c,
  SUNITDMG_TriggerBlockEvents113c,
  SUNITDMG_TriggerGetHitStateAndMode113c,
} from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c'
import { installK4QuestReplay113c } from '../../../src/d2kern-113c/game/k4-quest-replay-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: SparseMemory113c, a: readonly number[]) => unknown

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  // Group 1 (13)
  '0x6FC41290': (m, a) => AIGENERAL_CopyAiCommandParams113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC94F90': (m, a) => MONSTER_StartMove113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, undefined, true),
  '0x6FC95E10': (m, a) => MONSTER_StartMode113c(m, a[0]!, a[1]!, a[2]!, 0, 0, 0, 0, 1, true),
  '0x6FC96040': (m, a) => MONSTER_EndDeath113c(m, a[0]!, a[1]!, true),
  '0x6FC96270': (m, a) => MONSTER_StartDeath113c(m, a[0]!, a[1]!, 0, false, true),
  '0x6FC96BF0': (m, a) => MONSTER_EndToAiOrNeutral113c(m, a[0]!, a[1]!, true),
  '0x6FC96FE0': (m, a) => MONSTER_StepRun113c(m, a[0]!, a[1]!, true),
  '0x6FC97010': (m, a) => MONSTER_StepWalk113c(m, a[0]!, a[1]!, true),
  '0x6FC99170': (m, a) => PLAYER_StartModeDispatch113c(m, a[0]!, a[1]!, a[2]!, a[3]!, '1HS', undefined, true),
  '0x6FCA3130': (m, a) => AiFallen113c(m, a[0]!, a[1]!, a[2]!, false, true),
  '0x6FCA38B0': (m, a) => AiZombie113c(m, a[0]!, a[1]!, a[2]!, false, true),
  '0x6FD01930': (m, a) => MONSTER_StepPath113c(m, a[0]!, a[1]!, true),
  '0x6FD13220': (m, a) => AI_GeneralFindTargetOrThrottle113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, true),

  // Group 2 (16)
  '0x6FCEB950': (m, a) => SUNITDMG_TriggerBlockEvents113c(m, a[1]!, a[0]!, undefined, a[2]!, true),
  '0x6FCFA660': (m, a) => SUNITDMG_SelectDeathOverlayFlag113c(m, a[0]!, a[1]!, true),
  '0x6FCFA7B0': (m, a) => SUNITDMG_ApplyCannotBeFrozenAndShrineImmunities_6FCFA7B0_113c(m, a[0]!, 0, true),
  '0x6FCFA890': (m, a) => SUNITDMG_ApplyAttackerThornsToSelf113c(m, a[0]!, a[1]!, 0, true),
  '0x6FCFA8C0': (m, a) => SUNITDMG_AddDemonDamageBonus113c(m, a[0]!, a[1]!, a[2]!, true),
  '0x6FCFA930': (m, a) => SUNITDMG_ConsumeStaminaCost113c(m, a[0]!, a[1]!, true),
  '0x6FCFA970': (m, a) => SUNITDMG_ConsumeManaCost113c(m, a[0]!, a[1]!, true),
  '0x6FCFA9E0': (m, a) => SUNITDMG_CheckMonTypeFlag113c(m, a[0]!, a[1]!, true),
  '0x6FCFAB90': (m, a) => SUNITDMG_PrependCombatNode113c(m, a[2]!, 0, a[0]!, a[1]!, a[3]!, true),
  '0x6FCFAC10': (m, a) => SUNITDMG_GetPvpOrPetDamageMultiplier113c(m, a[0]!, 0, true),
  '0x6FCFAD70': (m, a) => SUNITDMG_AddMonsterTypeDamageBonus113c(m, a[0]!, a[1]!, a[2]!, true),
  '0x6FCFB1F0': (m, a) => SUNITDMG_ApplyArmorPenetrationAndFlatBonus113c(m, a[0]!, a[1]!, a[2]!, a[3]!, true),
  '0x6FCFB570': (m, a) => SUNITDMG_AddLeechedLifeToUnit113c(m, a[0]!, 6, 7, a[1]!, true),
  '0x6FCFB6B0': (m, a) => SUNITDMG_ClampManaBurnByMonsterSkill113c(m, a[0]!, a[1]!, a[2]!, a[3]!, true),
  '0x6FCFB910': (m, a) => SUNITDMG_TriggerGetHitStateAndMode113c(m, a[0]!, a[1]!, a[2]!, undefined, true),
  '0x6FCFBA40': (m, a) => SUNITDMG_ApplyLifeManaSteal113c(m, a[1]!, a[2]!, a[3]!, a[0]!, true),

  // Group 3 (15)
  '0x6FCFBD00': (m, a) => SUNITDMG_ApplySingleChannelResistance113c(m, a[0]!, a[1]!, a[2]!, 0, true),
  '0x6FCFBED0': (m, a) => SUNITDMG_RollDamageValue113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, 0, 0, true),
  '0x6FCFC030': (m, a) => SUNITDMG_GetTotalSkillDamageBonus113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, true),
  '0x6FCFC0B0': (m, a) => SUNITDMG_ApplyResistancesAndAbsorb113c(m, a[0]!, a[1]!, a[2]!, a[3]!, true),
  '0x6FCFC530': (m, a) => SUNITDMG_ComputeWeaponBaseDamage113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, undefined, a[6]!, a[7]!, true),
  '0x6FCFC780': (m, a) => SUNITDMG_ApplyColdChilledEffect113c(m, 0, a[0]!, a[1]!, a[2]!, true),
  '0x6FCFC940': (m, a) => SUNITDMG_ApplyBurnEffect_6FCFC940_113c(m, 0, a[0]!, a[1]!, a[2]!, a[3]!, true),
  '0x6FCFCAB0': (m, a) => SUNITDMG_ApplyPoisonEffect113c(m, 0, a[0]!, a[1]!, a[2]!, a[3]!, true),
  '0x6FCFCC20': (m, a) => SUNITDMG_ApplyStunEffect113c(m, 0, a[0]!, a[1]!, a[2]!, true),
  '0x6FCFCD80': (m, a) => SUNITDMG_RollElementalStatDamage113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, true),
  '0x6FCFCE70': (m, a) => SUNITDMG_TriggerAttackerBlindOrFlee113c(m, 0, a[0]!, a[1]!, 0, true),
  '0x6FCFD450': (m, a) => SUNITDMG_FillDamageValues113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, 0, true),
  '0x6FCFDAC0': (m, a) => SUNITDMG_ApplyFreezeEffect113c(m, 0, a[1]!, a[0]!, a[2]!, true),
  '0x6FCFDE90': (m, a) => SUNITDMG_CheckToHit113c(m, a[0]!, a[1]!, a[2]!, a[3]!, true),
  '0x6FCFEEE0': (m, a) => SUNITDMG_DistributeExperience113c(m, a[0]!, a[1]!, a[2]!, a[3]! !== 0, true),
}

interface MemRunRecord {
  addr: string
  hex: string
}

interface ExtraCapRecord {
  addr: string
  len: number
}

interface K6P14VectorRecord {
  va: string
  name: string
  caseIdx: number
  label: string
  tsArgs: number[]
  extraCaps: ExtraCapRecord[]
  retMask: string
  asserted: boolean
  assertLine: number
  ret: string
  setupTop: string
  preMem: MemRunRecord[]
  postMem: MemRunRecord[]
  heapTop: string
  heapHex: string
}

const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0x00009000
const STAGE_CS_GAME = 0x30010000
const STAGE_SETUP_BASE = 0x30020000
const HEAP_BASE = 0x40000000
const PAGE_BITS = 12
const PAGE_SIZE = 1 << PAGE_BITS

class CoWSparseMemory113c extends SparseMemory113c {
  private readonly basePages = new Map<number, Uint8Array>()
  private readonly baseKnown = new Map<number, Uint8Array>()
  private readonly overlayPages = new Map<number, Uint8Array>()
  private readonly overlayKnown = new Map<number, Uint8Array>()
  private heapCursor = HEAP_BASE

  commitOverlayToBase(): void {
    for (const [pg, data] of this.overlayPages.entries()) {
      this.basePages.set(pg, data)
      this.baseKnown.set(pg, this.overlayKnown.get(pg)!)
    }
    this.overlayPages.clear()
    this.overlayKnown.clear()
    this.heapCursor = HEAP_BASE
  }

  resetOverlay(): void {
    this.overlayPages.clear()
    this.overlayKnown.clear()
    this.heapCursor = HEAP_BASE
  }

  getHeapTop(): number {
    return this.heapCursor >>> 0
  }

  override alloc(size: number): number {
    const sz = size === 0 ? 4 : size
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    this.fill(p, sz, 0)
    this.heapCursor = (p + sz) >>> 0
    return p
  }

  override loadBlock(addr: number, data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.setU8((addr + i) >>> 0, data[i]!)
    }
  }

  override readBytes(addr: number, len: number): Uint8Array {
    const out = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      out[i] = this.u8((addr + i) >>> 0)
    }
    return out
  }

  override u8(p: number): number {
    const addr = p >>> 0
    const pg = addr >>> PAGE_BITS
    const off = addr & (PAGE_SIZE - 1)
    const ok = this.overlayKnown.get(pg)
    if (ok !== undefined && ok[off] !== 0) {
      return this.overlayPages.get(pg)![off]!
    }
    const bk = this.baseKnown.get(pg)
    if (bk !== undefined && bk[off] !== 0) {
      return this.basePages.get(pg)![off]!
    }
    throw new Error(`CoWSparseMemory113c: read of unloaded byte 0x${addr.toString(16)}`)
  }

  override u16(p: number): number {
    return this.u8(p) | (this.u8((p + 1) >>> 0) << 8)
  }

  override u32(p: number): number {
    return (this.u16(p) | (this.u16((p + 2) >>> 0) << 16)) >>> 0
  }

  override setU8(p: number, v: number): void {
    const addr = p >>> 0
    const pg = addr >>> PAGE_BITS
    const off = addr & (PAGE_SIZE - 1)
    let od = this.overlayPages.get(pg)
    let ok = this.overlayKnown.get(pg)
    if (od === undefined || ok === undefined) {
      const bd = this.basePages.get(pg)
      const bk = this.baseKnown.get(pg)
      od = bd !== undefined ? bd.slice() : new Uint8Array(PAGE_SIZE)
      ok = bk !== undefined ? bk.slice() : new Uint8Array(PAGE_SIZE)
      this.overlayPages.set(pg, od)
      this.overlayKnown.set(pg, ok)
    }
    od[off] = v & 0xff
    ok[off] = 1
  }

  override setU16(p: number, v: number): void {
    this.setU8(p, v & 0xff)
    this.setU8((p + 1) >>> 0, (v >>> 8) & 0xff)
  }

  override setU32(p: number, v: number): void {
    this.setU16(p, v & 0xffff)
    this.setU16((p + 2) >>> 0, (v >>> 16) & 0xffff)
  }

  override fill(p: number, len: number, v: number): void {
    const byte = v & 0xff
    for (let i = 0; i < len; i++) {
      this.setU8((p + i) >>> 0, byte)
    }
  }

  override get(base: number, f: FieldLayout113c, index = 0): number {
    if (base === 0) throw new Error('CoWSparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) {
      throw new Error(`CoWSparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    }
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = (base + f.off + index * width) >>> 0
    return width === 1 ? this.u8(p) : width === 2 ? this.u16(p) : this.u32(p)
  }

  override set(base: number, f: FieldLayout113c, v: number, index = 0): void {
    if (base === 0) throw new Error('CoWSparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) {
      throw new Error(`CoWSparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    }
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = (base + f.off + index * width) >>> 0
    if (width === 1) this.setU8(p, v)
    else if (width === 2) this.setU16(p, v)
    else this.setU32(p, v)
  }
}

const HEX_CHARS = '0123456789abcdef'

function hexToBytes(hex: string): Uint8Array {
  const n = hex.length >>> 1
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!
    out += HEX_CHARS[(b >>> 4) & 0x0f]! + HEX_CHARS[b & 0x0f]!
  }
  return out
}

function extractMemRunsRange(
  mem: CoWSparseMemory113c,
  startAddr: number,
  endAddr: number,
  out: MemRunRecord[],
): void {
  let a = startAddr >>> 0
  const end = endAddr >>> 0
  while (a < end) {
    const chunkEnd = a + 16 <= end ? a + 16 : end
    let nz = false
    for (let k = a; k < chunkEnd; k++) {
      if (mem.u8(k) !== 0) {
        nz = true
        break
      }
    }
    if (!nz) {
      a = chunkEnd
      continue
    }
    const runStart = a
    let runEnd = chunkEnd
    while (runEnd < end && runEnd - runStart < 512) {
      const nextEnd = runEnd + 16 <= end ? runEnd + 16 : end
      let nextNz = false
      for (let k = runEnd; k < nextEnd; k++) {
        if (mem.u8(k) !== 0) {
          nextNz = true
          break
        }
      }
      if (!nextNz) break
      runEnd = nextEnd
    }
    const addrHex = `0x${runStart.toString(16).toUpperCase().padStart(8, '0')}`
    const hex = bytesToHex(mem.readBytes(runStart, runEnd - runStart))
    out.push({ addr: addrHex, hex })
    a = runEnd
  }
}

function extractStageRuns(
  mem: CoWSparseMemory113c,
  setupTop: number,
  extraCaps: readonly ExtraCapRecord[],
): MemRunRecord[] {
  const out: MemRunRecord[] = []
  extractMemRunsRange(mem, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, out)
  extractMemRunsRange(mem, STAGE_CS_GAME, STAGE_CS_GAME + 0x1000, out)
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  for (const cap of extraCaps) {
    const start = Number.parseInt(cap.addr, 16) >>> 0
    extractMemRunsRange(mem, start, (start + cap.len) >>> 0, out)
  }
  return out
}

function loadVectors(): K6P14VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-p14/k6-p14-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6P14VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6P14VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6-P14] Real-DLL D2Game.dll Parity Vector Suite (44 VAs)', () => {
  let mem: CoWSparseMemory113c

  beforeAll(() => {
    const imgPath = resolve(
      import.meta.dirname,
      '../../fixtures/oracle/k1/d2game-datatbls-113c.img.gz',
    )
    const raw = gunzipSync(readFileSync(imgPath))
    const hdr = parseVectorHeader(raw)
    expect(hdr.kind).toBe('PAGEIMG')
    expect(hdr.recordSize).toBe(4100)

    mem = new CoWSparseMemory113c()
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    let off = 32
    for (let i = 0; i < hdr.recordCount; i++) {
      const va = view.getUint32(off, true) >>> 0
      mem.loadBlock(va, raw.subarray(off + 4, off + 4 + 4096))
      off += 4100
    }
    mem.fill(0x6fd30000, 0x2000, 0)
    bindK2KernelGlobals113c(mem)
    installK4QuestReplay113c()
    const nItems = mem.u32(0x6fdefb94) >>> 0
    const pItems = mem.u32(0x6fdefb98) >>> 0
    if (nItems > 0 && nItems < 4096 && pItems !== 0) {
      const nodes: Array<{ code: number; row: number }> = []
      for (let r = 0; r < nItems; r++) {
        const code = mem.u32((pItems + r * 0x1a8 + 0x80) >>> 0) >>> 0
        nodes.push({ code, row: r })
      }
      nodes.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.row - b.row))
      const hdrVa = 0x20fe0000
      const nodesVa = 0x20fe0010
      mem.setU32(hdrVa, nItems)
      mem.setU32((hdrVa + 4) >>> 0, 0)
      mem.setU32((hdrVa + 8) >>> 0, nodesVa)
      for (let i = 0; i < nodes.length; i++) {
        mem.setU32((nodesVa + i * 8) >>> 0, nodes[i]!.code)
        mem.setU32((nodesVa + i * 8 + 4) >>> 0, nodes[i]!.row >>> 0)
      }
      mem.setU32(0x6fdeff6c, hdrVa)
    }
    mem.fill(STAGE_BASE, STAGE_FIXED_SIZE, 0)
    mem.fill(STAGE_CS_GAME, 0x1000, 0)
    mem.fill(0x28000000, 0x10, 0)
    mem.setU32(0x28000004, 1)
    mem.fill(0x6fd18d10, 4, 0)
    mem.fill(0x6fd2d8bc, 4, 0)
    mem.fill(0x6fd301e0, 0x20, 0)
    mem.fill(0x6fd30398, 0x20, 0)
    mem.fill(0x6fd303b8, 0x800, 0)
    mem.fill(0x6fd30c04, 0x1008, 0)
    mem.fill(0x6fd31c0c, 0x40, 0)
    mem.fill(0x6fd31f7c, 0x24, 0)
    mem.fill(0x6fd39fa0, 8, 0)
    mem.fill(0x004000f0, 8, 0)
    mem.commitOverlayToBase()
  })

  it('covers all 44 target real-DLL D2Game.dll VAs (>= 3 cases each)', () => {
    expect(VECTORS_BY_VA.size).toBe(44)
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(VECTORS_BY_VA.size * 3)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      expect(cases.length).toBeGreaterThanOrEqual(3)
      expect(DISPATCH_BY_VA[va]).toBeTypeOf('function')
    }
  })

  for (const [va, cases] of VECTORS_BY_VA.entries()) {
    const fnName = cases[0]!.name
    it(`${va} ${fnName} (${cases.length} real-DLL cases)`, () => {
      const fn = DISPATCH_BY_VA[va]
      expect(fn).toBeDefined()

      for (const vec of cases) {
        mem.resetOverlay()
        const setupTop = Number.parseInt(vec.setupTop, 16) >>> 0
        if (setupTop > STAGE_SETUP_BASE) {
          mem.fill(STAGE_SETUP_BASE, setupTop - STAGE_SETUP_BASE, 0)
        }
        for (const cap of vec.extraCaps) {
          const capAddr = Number.parseInt(cap.addr, 16) >>> 0
          mem.fill(capAddr, cap.len, 0)
        }
        for (const blk of vec.preMem) {
          const addr = Number.parseInt(blk.addr, 16) >>> 0
          mem.loadBlock(addr, hexToBytes(blk.hex))
        }

        beginVaTrace113c()
        let retVal: unknown = 0
        let caughtErr: unknown = null
        try {
          retVal = fn!(mem, vec.tsArgs)
        } catch (err) {
          caughtErr = err
        }
        const hits = endVaTrace113c()
        expect(
          hits.has(`D2Game:${va}`),
          `${va} case ${vec.caseIdx} (${vec.label}) missing va-trace hit D2Game:${va}`,
        ).toBe(true)

        if (vec.asserted) {
          expect(
            caughtErr,
            `${va} case ${vec.caseIdx} (${vec.label}) expected D2CommonAssertError(${vec.assertLine})`,
          ).toBeInstanceOf(D2CommonAssertError)
          expect((caughtErr as D2CommonAssertError).line).toBe(vec.assertLine)
          continue
        }

        if (caughtErr !== null) {
          throw new Error(
            `${va} case ${vec.caseIdx} (${vec.label}) threw unexpected error: ${String(caughtErr)}`,
          )
        }

        const retMask = Number.parseInt(vec.retMask, 16) >>> 0
        if (retMask !== 0) {
          const actualMasked = ((Number(retVal) | 0) & retMask) >>> 0
          const expectedMasked = Number.parseInt(vec.ret, 16) >>> 0
          expect(
            actualMasked,
            `${va} case ${vec.caseIdx} (${vec.label}) return mismatch: got 0x${actualMasked.toString(16)} expected 0x${expectedMasked.toString(16)}`,
          ).toBe(expectedMasked)
        }

        const actualPostMem = extractStageRuns(mem, setupTop, vec.extraCaps)
        expect(
          actualPostMem,
          `${va} case ${vec.caseIdx} (${vec.label}) staged arena memory mismatch`,
        ).toEqual(vec.postMem)

        if (vec.heapHex.length > 0) {
          const expectedHeapTop = Number.parseInt(vec.heapTop, 16) >>> 0
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) heapTop mismatch`,
          ).toBe(expectedHeapTop)
          const actualHeapHex = bytesToHex(mem.readBytes(HEAP_BASE, expectedHeapTop - HEAP_BASE))
          expect(
            actualHeapHex,
            `${va} case ${vec.caseIdx} (${vec.label}) heap contents mismatch`,
          ).toBe(vec.heapHex)
        } else {
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) unexpected heap allocation (expected zero heap drift)`,
          ).toBe(HEAP_BASE)
        }
      }
    })
  }
})
