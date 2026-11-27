/**
 * [K6] Fix 4 — Real-DLL D2Game.dll 100.00% Grand Slam Closer Suite (Final 34 VAs).
 *
 * Replays every real-DLL vector emitted by tools/oracle/k6-fix4/k6-fix4-d2game-emitter.c
 * against the fixed TypeScript v1.13c kernel in src/d2kern-113c/game/*, verifying 100%
 * bit-exact agreement on return values, Fog.#10024 assertion line numbers, staged arena
 * memory mutations, extra global captures, heap allocations, and va-trace-113c runtime hits.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import { AI_DespawnIfNoPlayerInteracting_6FC35BB0_113c } from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c'
import { CLIENT_NotifyAndDisconnectClient_6FC4D090_113c } from '../../../src/d2kern-113c/game/k2-w15b1-113c'
import {
  ACT5Q6_OnTyraelPortalEnteredTriggerEndgame_6FC7FD00_113c,
  CLIENTS_DisconnectAndSaveClientById_6FC4DC70_113c,
  CLIENTS_DisconnectFlag20OrFallbackClient_6FC4E160_113c,
  CLIENTS_SendNextSaveChunkPacketB3_6FC4D140_113c,
} from '../../../src/d2kern-113c/game/k2-w16b1-113c'
import { MONMODE_StepPathOrFinishToDeadMode12_6FC959F0_113c } from '../../../src/d2kern-113c/game/k2-w2b3-113c'
import {
  MISSILES_SpawnRadial8SubMissiles_6FC5CB00_113c,
  QUESTS_AllocAndInitGameQuests_6FC548A0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b3-113c'
import { ACT5Q3_ThawFrozenAnyaMonster_6FC7DD00_113c } from '../../../src/d2kern-113c/game/k2-w3b5-113c'
import {
  MONSTER_StartMode8CastA_6FC96A50_113c,
  MONSTER_StartMode8CastB_6FC96B20_113c,
  OBJ_ShrineEffectExplodingPotionsAndMissiles_6FC8C580_113c,
  OBJ_ShrineEffectFireNovaAndHpDamage_6FC8C900_113c,
  OBJ_ShrineEffectPoisonPotionsAndClouds_6FC8C200_113c,
  OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b7-113c'
import {
  AI_SubmergedOrStuckTransition_6FC9D550_113c,
  AI_TentacleSkillCastA_6FC9C060_113c,
  AI_TentacleSkillCastB_6FC9C1D0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b8-113c'
import { ITEMS_SpawnAndDropPlayerEar_6FC32AF0_113c } from '../../../src/d2kern-113c/game/k2-w4b1-113c'
import {
  OBJ_SpawnMonster326FromObject_6FC8B880_113c,
  OBJ_SpawnMonster329FromObject_6FC8B870_113c,
  OBJ_SpawnMonster330FromObject_6FC8B890_113c,
  OBJ_SpawnMonster369FromObject_6FC8B860_113c,
} from '../../../src/d2kern-113c/game/k2-w4b3-113c'
import {
  OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c,
  OBJ_OperateStashWithGoldAndPotions_6FC8DBF0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b4-113c'
import { SKILLS_AllocAndFindUnitsInRadius_6FCBE570_113c } from '../../../src/d2kern-113c/game/k2-w4b6-113c'
import { AI_ThinkSpecialAiState3_6FCBCC00_113c } from '../../../src/d2kern-113c/game/k2-w6b3-113c'
import { STORM_TSHashTableInsertOrCreateNode_6FC22090_113c } from '../../../src/d2kern-113c/game/k2-w7b1-113c'
import {
  GAME_CreateMultiClientGame_6FC4C570_113c,
  GAME_CreateSinglePlayerOrTcpIpGame_6FC4C2D0_113c,
  PLAYERSAVE_SerializeAndAppendClientSaveData_6FC73E50_113c,
  PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000_113c,
} from '../../../src/d2kern-113c/game/k2-w8b1-113c'
import { EVENT_AllocChunk113c } from '../../../src/d2kern-113c/game/timer-wheel'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: SparseMemory113c, a: readonly number[]) => unknown

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  // Group 1 — 7 VAs (MONSTER_StartMode / timer-wheel & counters)
  '0x6FC96A50': (m, a) => MONSTER_StartMode8CastA_6FC96A50_113c(m, a[0]!, a[1]!),
  '0x6FC96B20': (m, a) => MONSTER_StartMode8CastB_6FC96B20_113c(m, a[0]!, a[1]!),
  '0x6FC9C060': (m, a) => AI_TentacleSkillCastA_6FC9C060_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9C1D0': (m, a) => AI_TentacleSkillCastB_6FC9C1D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9D550': (m, a) => AI_SubmergedOrStuckTransition_6FC9D550_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBCC00': (m, a) => AI_ThinkSpecialAiState3_6FCBCC00_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC35BB0': (m, a) => AI_DespawnIfNoPlayerInteracting_6FC35BB0_113c(m, a[0]!, a[1]!),

  // Group 2 — 6 VAs (MONSTER_InitMonsterUnit +20B allocation fix)
  '0x6FC89970': (m, a) => OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c(m, a[0]!, a[1]!),
  '0x6FC8B7A0': (m, a) => OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC8B860': (m, a) => OBJ_SpawnMonster369FromObject_6FC8B860_113c(m, a[0]!, a[1]!),
  '0x6FC8B870': (m, a) => OBJ_SpawnMonster329FromObject_6FC8B870_113c(m, a[0]!, a[1]!),
  '0x6FC8B880': (m, a) => OBJ_SpawnMonster326FromObject_6FC8B880_113c(m, a[0]!, a[1]!),
  '0x6FC8B890': (m, a) => OBJ_SpawnMonster330FromObject_6FC8B890_113c(m, a[0]!, a[1]!),

  // Group 3 — 4 VAs (Moving missile pPath+0x38 parity)
  '0x6FC5CB00': (m, a) =>
    MISSILES_SpawnRadial8SubMissiles_6FC5CB00_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FC8C200': (m, a) => OBJ_ShrineEffectPoisonPotionsAndClouds_6FC8C200_113c(m, a[0]!, a[1]!),
  '0x6FC8C580': (m, a) => OBJ_ShrineEffectExplodingPotionsAndMissiles_6FC8C580_113c(m, a[0]!, a[1]!),
  '0x6FC8C900': (m, a) => OBJ_ShrineEffectFireNovaAndHpDamage_6FC8C900_113c(m, a[0]!, a[1]!),

  // Group 4 — 2 VAs (Mode 0x0C dead flags & pAnimData)
  '0x6FC7DD00': (m, a) => ACT5Q3_ThawFrozenAnyaMonster_6FC7DD00_113c(m, a[0]!, a[1]!),
  '0x6FC959F0': (m, a) => MONMODE_StepPathOrFinishToDeadMode12_6FC959F0_113c(m, a[0]!, a[1]!),

  // Group 5 — 7 Standalone Surgical Fixes
  '0x6FC32AF0': (m, a) => ITEMS_SpawnAndDropPlayerEar_6FC32AF0_113c(m, a[0]!, a[1]!),
  '0x6FCAE420': (m, a) => EVENT_AllocChunk113c(m, a[0]!),
  '0x6FC548A0': (m, a) => QUESTS_AllocAndInitGameQuests_6FC548A0_113c(m, a[0]!),
  '0x6FC7FD00': (m, a) => ACT5Q6_OnTyraelPortalEnteredTriggerEndgame_6FC7FD00_113c(m, a[0]!),
  '0x6FC8DBF0': (m, a) => OBJ_OperateStashWithGoldAndPotions_6FC8DBF0_113c(m, a[0]!),
  '0x6FC4D140': (m, a) => CLIENTS_SendNextSaveChunkPacketB3_6FC4D140_113c(m, a[0]!, a[1]!),
  '0x6FCBE570': (m, a) => SKILLS_AllocAndFindUnitsInRadius_6FCBE570_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),

  // Group 6 — 8 Storm / Game Create / Client Disconnect / Save Pipeline VAs
  '0x6FC22090': (m, a) => STORM_TSHashTableInsertOrCreateNode_6FC22090_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC4C2D0': (m, a) =>
    GAME_CreateSinglePlayerOrTcpIpGame_6FC4C2D0_113c(
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
      a[9]!,
      a[10]!,
      a[11]!,
    ),
  '0x6FC4C570': (m, a) =>
    GAME_CreateMultiClientGame_6FC4C570_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FC4D090': (m, a) => CLIENT_NotifyAndDisconnectClient_6FC4D090_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC4DC70': (m, a) =>
    CLIENTS_DisconnectAndSaveClientById_6FC4DC70_113c(
      m,
      a[0]!,
      a[1]!,
      () => (m.u32(0x6fd31c24) !== 0 ? 1 : 0),
    ),
  '0x6FC4E160': (m, a) =>
    CLIENTS_DisconnectFlag20OrFallbackClient_6FC4E160_113c(
      m,
      a[0]!,
      a[1]!,
      () => (m.u32(0x6fd31c24) !== 0 ? 1 : 0),
    ),
  '0x6FC73E50': (m, a) =>
    PLAYERSAVE_SerializeAndAppendClientSaveData_6FC73E50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC74000': (m, a) =>
    PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000_113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
      a[6]!,
      a[7]!,
    ),
}

interface MemRunRecord {
  addr: string
  hex: string
}

interface ExtraCapRecord {
  addr: string
  len: number
}

interface K6Fix4VectorRecord {
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
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    if (p > this.heapCursor) {
      this.fill(this.heapCursor, p - this.heapCursor, 0)
    }
    this.fill(p, size, 0)
    this.heapCursor = (p + size) >>> 0
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

function canonicalizeStackPtrsInHeap(bytes: Uint8Array): Uint8Array {
  const copy = bytes.slice()
  const dv = new DataView(copy.buffer, copy.byteOffset, copy.byteLength)
  for (let off = 0; off + 4 <= copy.length; off += 4) {
    const v = dv.getUint32(off, true) >>> 0
    if (v >= 0x7e000000 && v < 0x80000000) {
      dv.setUint32(off, 0x7e000000, true)
    }
  }
  return copy
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
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  for (const cap of extraCaps) {
    const start = Number.parseInt(cap.addr, 16) >>> 0
    extractMemRunsRange(mem, start, (start + cap.len) >>> 0, out)
  }
  return out
}

function loadVectors(): K6Fix4VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-fix4/k6-fix4-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6Fix4VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6Fix4VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6] Fix 4 real-DLL D2Game.dll 100.00% Grand Slam Closer (Final 34 VAs)', () => {
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
    bindK2KernelGlobals113c(mem)
    // Hydrate SGPT_ITEMS_LINKER_PTR_VA (0x6FDEFF6C) from loaded Items.txt rows
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
    mem.fill(STAGE_CS_GAME, 0x20, 0)
    mem.fill(0x28000000, 0x10, 0)
    mem.setU32(0x28000004, 1)
    // Initialize known-zero D2Game global regions referenced by Group 6
    mem.fill(0x6fd18d10, 4, 0)
    mem.fill(0x6fd2d8bc, 4, 0)
    mem.fill(0x6fd30398, 0x20, 0)
    mem.fill(0x6fd303b8, 0x800, 0)
    mem.fill(0x6fd30c04, 0x1008, 0)
    mem.fill(0x6fd31c0c, 0x40, 0)
    mem.fill(0x6fd31f84, 4, 0)
    mem.commitOverlayToBase()
  })

  it('covers all 34 final remaining real-DLL D2Game.dll VAs (>= 3 cases each)', () => {
    expect(VECTORS_BY_VA.size).toBe(34)
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(VECTORS_BY_VA.size * 3)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(num).toBeGreaterThanOrEqual(0x6fc20000)
      expect(num).toBeLessThanOrEqual(0x6fd1ffff)
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
          const capStart = Number.parseInt(cap.addr, 16) >>> 0
          mem.fill(capStart, cap.len, 0)
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
          const rawHeapBytes = mem.readBytes(HEAP_BASE, expectedHeapTop - HEAP_BASE)
          const actualHeapBytes =
            va === '0x6FCBE570' ? canonicalizeStackPtrsInHeap(rawHeapBytes) : rawHeapBytes
          const actualHeapHex = bytesToHex(actualHeapBytes)
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
