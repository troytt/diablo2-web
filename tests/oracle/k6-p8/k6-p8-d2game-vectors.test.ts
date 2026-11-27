/**
 * [K6-P8] Real-DLL D2Game.dll (Mission 1 + 26 Band B/C) Parity Vector Suite (34 VAs).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import {
  PARTY_CountLivingPartyMembersInSameLevel113c,
  SKILLS_SetSkillDelayTimer113c,
} from '../../../src/d2kern-113c/game/a1c-post150-f786-f1040-113c'
import { ROOM_DeactivateRoomForClient113c } from '../../../src/d2kern-113c/game/act-rooms-113c'
import { MONSTER_ApplyCritDamage113c } from '../../../src/d2kern-113c/game/ai-fallen-113c'
import { AIGENERAL_FlushAllAiCommands113c } from '../../../src/d2kern-113c/game/boot-init-gap-a-113c'
import {
  D2GAME_ARENA_FindPlayerSlotByUnit113c,
  D2GAME_PARTY_GetPartyIdForUnit113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-b-113c'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import {
  AURA_CheckCircleIntersectsRoom113c,
  MONSTER_StartModeRun113c,
  PLAYER_Event0C_ExpireTimedStats113c,
} from '../../../src/d2kern-113c/game/k2-gap-itemdef-113c'
import { SKILLS_ResolveChargedSrvMissileId113c } from '../../../src/d2kern-113c/game/k2-gap-melee-dot-113c'
import {
  AI_DispatchTargetByAiFlag113c,
  MONSTER_BroadcastEventSoundToClients113c,
  MONSTER_CheckSandLeaperMidAir113c,
  PLAYER_ScheduleAttackActionFrameEvents113c,
} from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c'
import { NPCS_RepairPlayerItemOrAllItems_6FCDDE60_113c } from '../../../src/d2kern-113c/game/k2-w10b1-113c'
import { C2S_Packet35_NpcRepair_6FCEF0A0_113c } from '../../../src/d2kern-113c/game/k2-w11b1-113c'
import {
  ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c,
  ITEMS_SendCursorPutItemPacket04_6FCADF70_113c,
  ITEMS_SendDropToGroundPacket02_6FCAE030_113c,
} from '../../../src/d2kern-113c/game/k2-w2b4-113c'
import { ACT5Intro_ActiveFilter_6FC79680_113c } from '../../../src/d2kern-113c/game/k2-w3b5-113c'
import { ACT5Q3_ApplyScrollOfResistanceAcrossDifficulties_6FC7B0B0_113c } from '../../../src/d2kern-113c/game/k2-w4b2-113c'
import { ITEMS_SendPacket9C_Cmd38Or39_6FCADDA0_113c } from '../../../src/d2kern-113c/game/k2-w4b5-113c'
import {
  ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c,
  OBJECTS_ApplyLightningTrapDamageInRoom_6FC8AE60_113c,
} from '../../../src/d2kern-113c/game/k2-w7b2-113c'
import {
  ACT1Q4_OnPlayerEnterTristramWithCainUnrescued_6FC883C0_113c,
  OBJ_ThinkEventLightningSpire_6FC8E400_113c,
} from '../../../src/d2kern-113c/game/k2-w8b2-113c'
import { PETS_ClampAllPlayerPetTypesToDefaultMax_6FCB6F40_113c } from '../../../src/d2kern-113c/game/k2-w9b1-113c'
import { MONSTER_IsContinuousMode113c } from '../../../src/d2kern-113c/game/monster-events'
import { MONSTER_StartModeWalk113c } from '../../../src/d2kern-113c/game/replay-final11-113c'
import { PLAYER_UpdateStaminaRegen113c } from '../../../src/d2kern-113c/game/replay-kernel-113c'
import {
  EVENT_AllocNodeWithGrowth113c,
  EVENT_DeleteEventByArg14_113c,
} from '../../../src/d2kern-113c/game/timer-wheel'
import { AI_FindNearestPlayerTarget113c } from '../../../src/d2kern-113c/game/town-npc-ai-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: CoWSparseMemory113c, a: readonly number[]) => unknown

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  '0x6FC41420': (m, a) => AIGENERAL_FlushAllAiCommands113c(m, a[0]!, a[1]!),
  '0x6FC79680': (m, a) => ACT5Intro_ActiveFilter_6FC79680_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC7B0B0': (m, a) => ACT5Q3_ApplyScrollOfResistanceAcrossDifficulties_6FC7B0B0_113c(m, a[0]!, a[1]!),
  '0x6FC835B0': (m, a) => ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c(m, a[0]!),
  '0x6FC883C0': (m, a) => ACT1Q4_OnPlayerEnterTristramWithCainUnrescued_6FC883C0_113c(m, a[0]!, a[1]!),
  '0x6FC8AE60': (m, a) => OBJECTS_ApplyLightningTrapDamageInRoom_6FC8AE60_113c(m, a[0]!, a[1]!),
  '0x6FC8E400': (m, a) => OBJ_ThinkEventLightningSpire_6FC8E400_113c(m, a[0]!, a[1]!),
  '0x6FC94C30': (m, a) => MONSTER_StartModeRun113c(m, a[0]!, a[1]!),
  '0x6FC94C60': (m, a) => MONSTER_StartModeWalk113c(m, a[0]!, a[1]!),
  '0x6FC94F20': (m, a) => (MONSTER_IsContinuousMode113c(m, a[0]!, a[1]!) ? 1 : 0),
  '0x6FC970E0': (m, a) => MONSTER_ApplyCritDamage113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC971D0': (m, a) => MONSTER_CheckSandLeaperMidAir113c(m, a[0]!, a[1]!),
  '0x6FC97820': (m, a) => PLAYER_Event0C_ExpireTimedStats113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC97A50': (m, a) => PLAYER_UpdateStaminaRegen113c(m, a[0]!),
  '0x6FC98760': (m, a) => PLAYER_ScheduleAttackActionFrameEvents113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC9AC50': (m, a) => MONSTER_BroadcastEventSoundToClients113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCADDA0': (m, a) => ITEMS_SendPacket9C_Cmd38Or39_6FCADDA0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCADE50': (m, a) => ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCADF70': (m, a) => ITEMS_SendCursorPutItemPacket04_6FCADF70_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCAE030': (m, a) => ITEMS_SendDropToGroundPacket02_6FCAE030_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCAE540': (m, a) => EVENT_AllocNodeWithGrowth113c(m, a[0]!, a[1]!),
  '0x6FCAE900': (m, a) => EVENT_DeleteEventByArg14_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCAF5C0': (m, a) => D2GAME_ARENA_FindPlayerSlotByUnit113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCB1340': (m, a) => SKILLS_ResolveChargedSrvMissileId113c(m, a[0]!, a[1]!),
  '0x6FCB6F40': (m, a) => PETS_ClampAllPlayerPetTypesToDefaultMax_6FCB6F40_113c(m, a[0]!, a[1]!),
  '0x6FCBBEB0': (m, a) => D2GAME_PARTY_GetPartyIdForUnit113c(m, a[0]!, a[1]!),
  '0x6FCBC1F0': (m, a) => PARTY_CountLivingPartyMembersInSameLevel113c(m, a[0]!, a[1]!),
  '0x6FCBD160': (m, a) => AI_DispatchTargetByAiFlag113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBD980': (m, a) => ROOM_DeactivateRoomForClient113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBE610': (m, a) => AURA_CheckCircleIntersectsRoom113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCBF3B0': (m, a) => SKILLS_SetSkillDelayTimer113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCDDE60': (m, a) => NPCS_RepairPlayerItemOrAllItems_6FCDDE60_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCEF0A0': (m, a) => C2S_Packet35_NpcRepair_6FCEF0A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD130C0': (m, a) => AI_FindNearestPlayerTarget113c(m, a[0]!, a[1]!, a[2]!),
}

interface MemRunRecord {
  addr: string
  hex: string
}

interface ExtraCapRecord {
  addr: string
  len: number
}

interface K6P8VectorRecord {
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

const D2COM_PREF_BASE = 0x6fd50000
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
    const effSize = size === 0 ? 4 : size
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    if (p > this.heapCursor) {
      this.fill(this.heapCursor, p - this.heapCursor, 0)
    }
    this.fill(p, effSize, 0)
    this.heapCursor = (p + effSize) >>> 0
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
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  for (const cap of extraCaps) {
    const start = Number.parseInt(cap.addr, 16) >>> 0
    extractMemRunsRange(mem, start, (start + cap.len) >>> 0, out)
  }
  return out
}

function loadVectors(): K6P8VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-p8/k6-p8-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6P8VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6P8VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

const MISSION1_VAS = new Set([
  0x6fc41420, 0x6fc883c0, 0x6fc8ae60, 0x6fcbd160,
  0x6fcbd980, 0x6fcdde60, 0x6fcef0a0, 0x6fd130c0,
])

describe('[K6-P8] Real-DLL D2Game.dll Mission 1 + Band B/C Parity Vector Suite (34 VAs)', () => {
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
    mem.fill(0x6fd19f00, 0x3100, 0)
    mem.fill(0x6fd27000, 0xb000, 0)
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
    mem.fill(0x6fd18d10, 4, 0)
    mem.fill(0x6fd2d8bc, 4, 0)
    mem.fill(0x6fd30398, 0x20, 0)
    mem.fill(0x6fd303b8, 0x800, 0)
    mem.fill(0x6fd30c04, 0x1008, 0)
    mem.fill(0x6fd31c0c, 0x40, 0)
    mem.fill(0x6fd31f80, 0x20, 0)
    mem.commitOverlayToBase()
  })

  it('covers all 34 target real-DLL D2Game VAs (Mission 1 + Band B/C, >= 3 cases each)', () => {
    expect(VECTORS_BY_VA.size).toBe(34)
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(VECTORS_BY_VA.size * 3)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(
        (num >= 0x6fc70000 && num <= 0x6fcdffff) || MISSION1_VAS.has(num),
        `${va} outside Band B/C + Mission 1`,
      ).toBe(true)
      expect(cases.length).toBeGreaterThanOrEqual(3)
      expect(DISPATCH_BY_VA[va]).toBeTypeOf('function')
    }
  })

  for (const [va, cases] of VECTORS_BY_VA.entries()) {
    const fnName = cases[0]!.name
    const vaNum = Number.parseInt(va, 16) >>> 0
    const modPrefix = vaNum >= D2COM_PREF_BASE ? 'D2Common' : 'D2Game'

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
          hits.has(`${modPrefix}:${va}`),
          `${va} case ${vec.caseIdx} (${vec.label}) missing va-trace hit ${modPrefix}:${va}`,
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

        const normalizeRun = (run: MemRunRecord): MemRunRecord => {
          // D2Game.dll@0x6FCAAC90 leaves S2C 0x2A bytes [3..6] (0x30002607..0x3000260A) unwritten on stack.
          if (
            (va === '0x6FCDDE60' || va === '0x6FCEF0A0') &&
            run.addr === '0x30002600' &&
            run.hex.startsWith('0f0000002a') &&
            run.hex.length >= 22
          ) {
            return {
              addr: run.addr,
              hex: `${run.hex.slice(0, 14)}00000000${run.hex.slice(22)}`,
            }
          }
          return run
        }
        const actualPostMem = extractStageRuns(mem, setupTop, vec.extraCaps)
        const expectedPostMem = vec.postMem.map(normalizeRun)
        expect(
          actualPostMem,
          `${va} case ${vec.caseIdx} (${vec.label}) staged arena memory mismatch`,
        ).toEqual(expectedPostMem)

        if (vec.heapHex.length > 0) {
          const expectedHeapTop = Number.parseInt(vec.heapTop, 16) >>> 0
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) heapTop mismatch`,
          ).toBe(expectedHeapTop)
          const rawHeapBytes = mem.readBytes(HEAP_BASE, expectedHeapTop - HEAP_BASE)
          const actualHeapHex = bytesToHex(rawHeapBytes)
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
