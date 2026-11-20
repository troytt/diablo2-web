/**
 * Diablo II v1.13c `D2Common.dll` Final 3 Functions -> 100.00% `diff-verified` (`1,479 / 1,479`).
 *
 * Binary-grounded differential & exhaustive branch verification for:
 * 1. `0x6FD5CD10` — `DRLGPRESET_InitLevelPresetRooms` (`DRLGPRESET_InitLevelPresetRooms113c` in `src/d2kern-113c/common/drlg/preset.ts`)
 * 2. `0x6FD62720` — `UNITFINDS_FindAllMatchingUnitsInAdjacentRooms` (`UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c` in `src/d2kern-113c/common/unit-finds.ts`)
 * 3. `0x6FD66E10` — `DRLGOUTPLACE_PlaceActLevelsByList` (`DRLGOUTPLACE_PlaceActLevelsByList113c` in `src/d2kern-113c/common/drlg/out-place.ts`)
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ACT1_LINK_DEFS_VA,
  ACT2_LINK_DEFS_VA,
  DRLGOUTPLACE_PlaceActLevelsByList113c,
  GDW_ACT4_STEP_FLAG_VA,
  SGPT_LEVELDEF_BIN_VA,
} from '../../../src/d2kern-113c/common/drlg/out-place.ts'
import {
  DRLGPRESET_InitLevelPresetRooms113c,
  GP_CACHED_PRESET_FILE_LIST_HEAD_VA_6FDF147C,
} from '../../../src/d2kern-113c/common/drlg/preset.ts'
import { DRLGWARP_GetWarpDstAdjustData113c } from '../../../src/d2kern-113c/common/drlg/drlg-room.ts'
import {
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c,
  UNITFINDS_FreeUnitFindData113c,
  UNITFINDS_InitUnitFindData113c,
} from '../../../src/d2kern-113c/common/unit-finds.ts'
import {
  D2ActiveRoomStrc,
  D2DrlgLevelStrc,
  D2DrlgStrc,
  D2RoomExStrc,
  D2UnitFindDataStrc,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { type Memory113c, SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'
import type { Manifest } from '../../../tools/oracle/callgraph/status.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools', 'oracle', 'callgraph', 'manifest-113c.json')
const D2_DATA_DIR = process.env.D2_DATA_DIR || path.join(os.homedir(), 'd2-data')
const D2COMMON_DLL_PATH = path.join(D2_DATA_DIR, 'D2Common.dll')
const I14A1_FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'i14a-1-vectors.ndjson')
const I14A3_FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'i14a-3-vectors.ndjson')

const TARGET_VAS = ['0x6FD5CD10', '0x6FD62720', '0x6FD66E10'] as const

interface MemBlock {
  base: string
  hex: string
}

interface VectorRecord {
  va: string
  name: string
  caseIndex: number
  note: string
  inputs: {
    args: Array<string | number>
    memory: MemBlock[]
  }
  expectedAssert?: {
    line: number
  }
  outputs: {
    eax: string
    retMask: string
    memory: MemBlock[]
  }
}

function loadVectorsForVas(fixturePath: string, allowedVas: ReadonlySet<string>): VectorRecord[] {
  const raw = fs.readFileSync(fixturePath, 'utf8').trim()
  if (!raw) return []
  return raw
    .split('\n')
    .map((line) => JSON.parse(line) as VectorRecord)
    .filter((rec) => allowedVas.has(rec.va))
}

function parseArg(v: string | number): number {
  if (typeof v === 'number') return v | 0
  return Number.parseInt(v, 16) >>> 0
}

function createStrictMemory(
  preBlocks: MemBlock[],
  postBlocks: MemBlock[],
): {
  m: SparseMemory113c
  rogueReads: string[]
  rogueWrites: string[]
  dumpHex: (addr: number, len: number) => string
} {
  const m = new SparseMemory113c()
  const readSpans: Array<{ start: number; end: number }> = []
  const writeSpans: Array<{ start: number; end: number }> = []
  const writtenAddrs = new Set<number>()

  for (const blk of preBlocks) {
    const start = Number.parseInt(blk.base, 16) >>> 0
    const bytes = Buffer.from(blk.hex, 'hex')
    m.loadBlock(start, bytes)
    readSpans.push({ start, end: (start + bytes.length) >>> 0 })
  }
  for (const blk of postBlocks) {
    const start = Number.parseInt(blk.base, 16) >>> 0
    const len = blk.hex.length >>> 1
    writeSpans.push({ start, end: (start + len) >>> 0 })
  }

  const rawMem = m as unknown as {
    readByte: (a: number) => number
    writeByte: (a: number, v: number) => void
  }
  const origReadByte = rawMem.readByte.bind(m)
  const origWriteByte = rawMem.writeByte.bind(m)

  const rogueReads: string[] = []
  const rogueWrites: string[] = []

  rawMem.readByte = (a: number): number => {
    const u = a >>> 0
    const ok = readSpans.some((s) => u >= s.start && u < s.end) || writtenAddrs.has(u)
    if (!ok) {
      rogueReads.push(`0x${u.toString(16)}`)
    }
    return origReadByte(a)
  }

  rawMem.writeByte = (a: number, v: number): void => {
    const u = a >>> 0
    const ok = writeSpans.some((s) => u >= s.start && u < s.end)
    if (!ok) {
      rogueWrites.push(`0x${u.toString(16)}`)
    }
    writtenAddrs.add(u)
    origWriteByte(a, v)
  }

  const dumpHex = (addr: number, len: number): string => {
    let out = ''
    for (let i = 0; i < len; i++) {
      out += origReadByte((addr + i) >>> 0).toString(16).padStart(2, '0')
    }
    return out
  }

  return { m, rogueReads, rogueWrites, dumpHex }
}

function loadPeVaReader(dllPath: string): { buf: Buffer; vaToOff: (va: number) => number } {
  const buf = fs.readFileSync(dllPath)
  const eLfanew = buf.readUInt32LE(0x3c)
  const numSec = buf.readUInt16LE(eLfanew + 6)
  const optSize = buf.readUInt16LE(eLfanew + 20)
  const imageBase = buf.readUInt32LE(eLfanew + 24 + 28)
  expect(imageBase).toBe(0x6fd50000)

  const secTable = eLfanew + 24 + optSize
  const sections: Array<{ vaddr: number; vsize: number; rawPtr: number; rawSize: number }> = []
  for (let i = 0; i < numSec; i++) {
    const sh = secTable + i * 40
    sections.push({
      vsize: buf.readUInt32LE(sh + 8),
      vaddr: buf.readUInt32LE(sh + 12),
      rawSize: buf.readUInt32LE(sh + 16),
      rawPtr: buf.readUInt32LE(sh + 20),
    })
  }

  return {
    buf,
    vaToOff(va: number): number {
      const rva = (va >>> 0) - imageBase
      for (const s of sections) {
        if (rva >= s.vaddr && rva < s.vaddr + Math.max(s.vsize, s.rawSize)) {
          return s.rawPtr + (rva - s.vaddr)
        }
      }
      throw new Error(`VA 0x${(va >>> 0).toString(16)} out of range`)
    },
  }
}

function writeAsciiString(m: Memory113c, addr: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    m.setU8((addr + i) >>> 0, text.charCodeAt(i) & 0xff)
  }
  m.setU8((addr + text.length) >>> 0, 0)
}

describe('D2Common 100.00% diff-verified closure (0x6FD5CD10, 0x6FD62720, 0x6FD66E10)', () => {
  it('reaches 1,479 / 1,479 diff-verified (0 ported, 0 unported) for D2Common in manifest-113c.json', () => {
    const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    const d2cAll = manifest.functions.filter((f) => f.module === 'D2Common')
    const d2cDv = d2cAll.filter((f) => f.status === 'diff-verified')
    const d2cPorted = d2cAll.filter((f) => f.status === 'ported')
    const d2cUnported = d2cAll.filter((f) => f.status === 'unported')

    expect(d2cAll.length).toBe(1479)
    expect(d2cDv.length).toBe(1479)
    expect(d2cPorted.length).toBe(0)
    expect(d2cUnported.length).toBe(0)

    for (const va of TARGET_VAS) {
      const fn = d2cAll.find((f) => f.va === va)
      expect(fn, `Missing ${va} in D2Common manifest`).toBeDefined()
      expect(fn!.status).toBe('diff-verified')
      expect(fn!.diffEvidence).toContain('tests/oracle/k0/d2common-final3-diff-verified.test.ts')
    }
  })

  it('verifies exact 1.13c D2Common.dll machine-code signatures & all 9 .data D2DrlgLinkStrc tables', () => {
    if (!fs.existsSync(D2COMMON_DLL_PATH)) return
    const { buf, vaToOff } = loadPeVaReader(D2COMMON_DLL_PATH)

    // 1. 0x6FD5CD10 DRLGPRESET_InitLevelPresetRooms (378B, 0x6FD5CD10..0x6FD5CE89)
    // Prologue: push ebx; push ebp; push esi; push edi; mov edi, ecx (53 55 56 57 8B F9)
    const offPreset = vaToOff(0x6fd5cd10)
    expect([...buf.subarray(offPreset, offPreset + 6)]).toEqual([0x53, 0x55, 0x56, 0x57, 0x8b, 0xf9])
    // Town ID branches: cmp ecx, 0x28 / 0x67 / 0x6D
    expect([...buf.subarray(vaToOff(0x6fd5cd63), vaToOff(0x6fd5cd66))]).toEqual([0x83, 0xf9, 0x28])
    expect([...buf.subarray(vaToOff(0x6fd5cd6c), vaToOff(0x6fd5cd6f))]).toEqual([0x83, 0xf9, 0x67])
    expect([...buf.subarray(vaToOff(0x6fd5cd75), vaToOff(0x6fd5cd78))]).toEqual([0x83, 0xf9, 0x6d])
    // Call pfAutomap([esi+0x30]): call dword ptr [eax+0x454] (FF 90 54 04 00 00) at 0x6FD5CE37
    expect([...buf.subarray(vaToOff(0x6fd5ce37), vaToOff(0x6fd5ce3d))]).toEqual([
      0xff, 0x90, 0x54, 0x04, 0x00, 0x00,
    ])
    // Call pfTownAutomap: call ebp (FF D5) at 0x6FD5CE83, ret (C3) at 0x6FD5CE89
    expect([...buf.subarray(vaToOff(0x6fd5ce83), vaToOff(0x6fd5ce85))]).toEqual([0xff, 0xd5])
    expect(buf[vaToOff(0x6fd5ce89)]).toBe(0xc3)

    // 2. 0x6FD62720 UNITFINDS_FindAllMatchingUnitsInAdjacentRooms (367B, 0x6FD62720..0x6FD6288E)
    // Prologue: sub esp, 8; push ebx; mov ebx, [esp+0x10] (83 EC 08 53 8B 5C 24 10)
    const offUf = vaToOff(0x6fd62720)
    expect([...buf.subarray(offUf, offUf + 8)]).toEqual([0x83, 0xec, 0x08, 0x53, 0x8b, 0x5c, 0x24, 0x10])
    // Assert line 0x10A (push 0x10A) at 0x6FD6272F and line 0x13E (push 0x13E) at 0x6FD6286F
    expect(buf.readUInt32LE(vaToOff(0x6fd62730))).toBe(0x10a)
    expect(buf.readUInt32LE(vaToOff(0x6fd62870))).toBe(0x13e)
    // Town skip flag test: test ah, 0x20 (F6 C4 20) at 0x6FD627B3 -> dwFlags & 0x2000
    expect([...buf.subarray(vaToOff(0x6fd627b3), vaToOff(0x6fd627b6))]).toEqual([0xf6, 0xc4, 0x20])
    // stdcall epilogue: ret 4 (C2 04 00) at 0x6FD6286C
    expect([...buf.subarray(vaToOff(0x6fd6286c), vaToOff(0x6fd6286f))]).toEqual([0xc2, 0x04, 0x00])

    // 3. 0x6FD66E10 DRLGOUTPLACE_PlaceActLevelsByList (878B, 0x6FD66E10..0x6FD6717D)
    // Prologue: sub esp, 0x204 (81 EC 04 02 00 00) + mov ecx, 0x7D (B9 7D 00 00 00)
    const offOut = vaToOff(0x6fd66e10)
    expect([...buf.subarray(offOut, offOut + 6)]).toEqual([0x81, 0xec, 0x04, 0x02, 0x00, 0x00])
    expect([...buf.subarray(vaToOff(0x6fd66e19), vaToOff(0x6fd66e1e))]).toEqual([0xb9, 0x7d, 0x00, 0x00, 0x00])
    // Epilogue: add esp, 0x204; ret 0xC (C2 0C 00) at 0x6FD6717B
    expect([...buf.subarray(vaToOff(0x6fd6717b), vaToOff(0x6fd6717e))]).toEqual([0xc2, 0x0c, 0x00])

    // Verify all 9 .data D2DrlgLinkStrc tables only reference the 12 dispatched pfLinker VAs
    const expectedLinkers = new Set([
      0x6fd644c0, 0x6fd64b00, 0x6fd64d00, 0x6fd64e30, 0x6fd64f90, 0x6fd65250,
      0x6fd65480, 0x6fd65680, 0x6fd657d0, 0x6fd90e10, 0x6fd90f00, 0x6fd90fc0,
    ])
    const linkTables = [
      0x6fddcbe8, 0x6fddccd8, 0x6fddcdc8, 0x6fddceb8, 0x6fddcfa8,
      0x6fddd098, 0x6fddd188, 0x6fddd278, 0x6fddd368,
    ]
    const seenLinkers = new Set<number>()
    for (const tableVa of linkTables) {
      const baseOff = vaToOff(tableVa)
      for (let i = 0; i < 15; i++) {
        const pfLinker = buf.readUInt32LE(baseOff + i * 16)
        const nLevel = buf.readInt32LE(baseOff + i * 16 + 4)
        if (nLevel === 0) break
        expect(expectedLinkers.has(pfLinker), `Unexpected pfLinker 0x${pfLinker.toString(16)}`).toBe(true)
        seenLinkers.add(pfLinker)
      }
    }
    expect(seenLinkers.size).toBe(12)
  })

  describe('Real-DLL NDJSON differential vector replay + va-trace-113c verification', () => {
    const presetVectors = loadVectorsForVas(I14A1_FIXTURE, new Set(['0x6FD5CD10']))
    const ufAndOutVectors = loadVectorsForVas(I14A3_FIXTURE, new Set(['0x6FD62720', '0x6FD66E10']))

    it('replays all real-DLL vectors for 0x6FD5CD10, 0x6FD62720, and 0x6FD66E10 with zero rogue accesses and exact VA hits', () => {
      expect(presetVectors.length).toBeGreaterThanOrEqual(3)
      expect(ufAndOutVectors.filter((v) => v.va === '0x6FD62720').length).toBeGreaterThanOrEqual(3)
      expect(ufAndOutVectors.filter((v) => v.va === '0x6FD66E10').length).toBeGreaterThanOrEqual(3)

      for (const rec of [...presetVectors, ...ufAndOutVectors]) {
        const { m, rogueReads, rogueWrites, dumpHex } = createStrictMemory(
          rec.inputs.memory,
          rec.outputs.memory,
        )
        const args = rec.inputs.args.map(parseArg)

        let hits = new Set<string>()
        beginVaTrace113c()
        let rawRet: number | void
        try {
          if (rec.va === '0x6FD5CD10') {
            rawRet = DRLGPRESET_InitLevelPresetRooms113c(m, args[0]!)
          } else if (rec.va === '0x6FD62720') {
            const useCb = (args[1] ?? 0) !== 0
            rawRet = UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(
              m,
              args[0]!,
              useCb ? (mem, unit) => ((mem.u32((unit + 4) >>> 0) & 1) === 0 ? 1 : 0) : undefined,
            )
          } else {
            rawRet = DRLGOUTPLACE_PlaceActLevelsByList113c(m, args[0]!, args[1]!)
          }
        } finally {
          hits = endVaTrace113c()
        }
        expect(hits.has(`D2Common:${rec.va}`), `Missing VA hit for ${rec.va}`).toBe(true)

        const mask = Number.parseInt(rec.outputs.retMask, 16) >>> 0
        const expectedEax = Number.parseInt(rec.outputs.eax, 16) >>> 0
        if (mask !== 0) {
          const actual = (((rawRet ?? 0) >>> 0) & mask) >>> 0
          expect(actual).toBe((expectedEax & mask) >>> 0)
        }

        expect(rogueReads, `rogue reads on ${rec.va} #${rec.caseIndex}`).toEqual([])
        expect(rogueWrites, `rogue writes on ${rec.va} #${rec.caseIndex}`).toEqual([])
        for (const blk of rec.outputs.memory) {
          const start = Number.parseInt(blk.base, 16) >>> 0
          const len = blk.hex.length >>> 1
          expect(dumpHex(start, len), `post-mem ${blk.base} on ${rec.va} #${rec.caseIndex}`).toBe(blk.hex)
        }
      }
    })
  })

  describe('0x6FD5CD10 — DRLGPRESET_InitLevelPresetRooms113c branch & callback parity', () => {
    const baseVec = loadVectorsForVas(I14A1_FIXTURE, new Set(['0x6FD5CD10']))[2]!

    function clonePresetVecMemory(): { m: SparseMemory113c; lvl: number } {
      const m = new SparseMemory113c()
      for (const blk of baseVec.inputs.memory) {
        m.loadBlock(Number.parseInt(blk.base, 16) >>> 0, Buffer.from(blk.hex, 'hex'))
      }
      return { m, lvl: parseArg(baseVec.inputs.args[0]!) }
    }

    it('syncs nFileIdx == -1 from rolled pMap->nPickedFile vs overriding pMap->nPickedFile when nFileIdx != -1', () => {
      // Case A: pInfo->nDirection (+0x04) == -1 -> copies rolled nPickedFile back to pInfo + 0x04
      {
        const { m, lvl } = clonePresetVecMemory()
        const pInfo = m.get(lvl, D2DrlgLevelStrc.pOutdoors)
        const pLvlPrestBase = m.u32(0x6fdf0b3c)
        const nLevelId = m.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
        // Set dwFiles = 5 on the matching LvlPrest row so LCG roll picks a deterministic variant
        for (let row = 0; row < 16; row++) {
          const pRow = (pLvlPrestBase + row * 0x1b0) >>> 0
          if ((m.u32((pRow + 0x04) >>> 0) | 0) === nLevelId) {
            m.setU32((pRow + 0x40) >>> 0, 5)
          }
        }
        m.setU32((lvl + 0x1c4) >>> 0, 0x13579bdf)
        m.setU32((lvl + 0x1c8) >>> 0, 0x0000029a)
        m.setU32((pInfo + 0x04) >>> 0, 0xffffffff)

        DRLGPRESET_InitLevelPresetRooms113c(m, lvl)
        const pMap = m.u32(pInfo)
        expect(pMap).not.toBe(0)
        const picked = m.u32((pMap + 0x04) >>> 0)
        expect(picked).toBeLessThan(5)
        expect(m.u32((pInfo + 0x04) >>> 0)).toBe(picked)
        // Seed at lvl + 0x1c4 advanced
        expect(m.u32((lvl + 0x1c4) >>> 0)).not.toBe(0x13579bdf)
      }

      // Case B: pInfo->nDirection (+0x04) == 3 -> overrides pMap->nPickedFile with 3
      {
        const { m, lvl } = clonePresetVecMemory()
        const pInfo = m.get(lvl, D2DrlgLevelStrc.pOutdoors)
        m.setU32((pInfo + 0x04) >>> 0, 3)
        DRLGPRESET_InitLevelPresetRooms113c(m, lvl)
        const pMap = m.u32(pInfo)
        expect(m.u32((pMap + 0x04) >>> 0)).toBe(3)
        expect(m.u32((pInfo + 0x04) >>> 0)).toBe(3)
      }
    })

    it('invokes pfTownAutomap with C-truncating center coords for town preset levels 0x28, 0x67, and 0x6D', () => {
      for (const [townLevelId, posX, posY, width, height, expectedCx, expectedCy] of [
        [0x28, 100, 200, 41, 63, 120, 231], // 100 + 41/2 = 120, 200 + 63/2 = 231
        [0x67, -50, 80, -9, 15, -54, 87],   // sdiv32(-9, 2) = -4 (NOT -5 floor), -50 + -4 = -54
        [0x6d, 320, -40, 24, -7, 332, -43], // sdiv32(-7, 2) = -3, -40 + -3 = -43
      ] as const) {
        const { m, lvl } = clonePresetVecMemory()
        const pDrlg = m.get(lvl, D2DrlgLevelStrc.pDrlg)
        const pInfo = m.get(lvl, D2DrlgLevelStrc.pOutdoors)
        const pLvlPrestBase = m.u32(0x6fdf0b3c)
        const pRow = (pLvlPrestBase + 0x1b0) >>> 0
        m.setU32(pRow, 1) // dwDef = 1
        m.setU32((pRow + 0x04) >>> 0, townLevelId) // dwLevelId
        m.setU32((pRow + 0x28) >>> 0, 0) // use pBox width/height, keep 0 rooms when w=0? Wait: set bScan=0, nPops=0!
        m.setU32((pRow + 0x2c) >>> 0, 0)
        m.setU32((pRow + 0x30) >>> 0, 1) // dwAutoMap = 1
        m.setU32((pRow + 0x34) >>> 0, 0) // bScan = 0
        m.setU32((pRow + 0x38) >>> 0, 0) // nPops = 0

        m.set(lvl, D2DrlgLevelStrc.nLevelId, townLevelId)
        m.setU32((lvl + 0x1c) >>> 0, posX >>> 0)
        m.setU32((lvl + 0x20) >>> 0, posY >>> 0)
        // Negative width/height causes xEnd <= mapX0 or yEnd <= mapY0 in BuildPresetRoomsFromMap; for positive, rooms allocate cleanly
        m.setU32((lvl + 0x24) >>> 0, width >>> 0)
        m.setU32((lvl + 0x28) >>> 0, height >>> 0)
        m.setU32((pInfo + 0x04) >>> 0, 2) // nPickedFile = 2
        m.set(pDrlg, D2DrlgStrc.pfnErrorCallback, 0x6fab0000)
        m.set(pDrlg, D2DrlgStrc.pfnAutomapInit, 0x6fab0010)

        const townCalls: Array<[number, number, number, number]> = []
        const roomCalls: number[] = []
        DRLGPRESET_InitLevelPresetRooms113c(
          m,
          lvl,
          (_mem, pRoom) => roomCalls.push(pRoom),
          (_mem, lid, fileIdx, cx, cy) => townCalls.push([lid, fileIdx, cx, cy]),
        )
        expect(townCalls).toEqual([[townLevelId, 2, expectedCx, expectedCy]])
        expect(roomCalls).toEqual([])

        // Also verify dwAutoMap == 0 suppresses pfTownAutomap even when pfnErrorCallback != 0
        m.setU32((pRow + 0x30) >>> 0, 0)
        const suppressedCalls: number[] = []
        DRLGPRESET_InitLevelPresetRooms113c(
          m,
          lvl,
          undefined,
          (_mem, lid) => suppressedCalls.push(lid),
        )
        expect(suppressedCalls).toEqual([])
      }
    })

    it('activates non-town preset rooms end-to-end (pDstAdj neighbor init + LoadDt1Files + LoadPresetRoomMap + BuildRoomGridsAndTiles + pfAutomap)', () => {
      const { m, lvl } = clonePresetVecMemory()
      const pDrlg = m.get(lvl, D2DrlgLevelStrc.pDrlg)
      const pInfo = m.get(lvl, D2DrlgLevelStrc.pOutdoors)
      const nLevelId = m.get(lvl, D2DrlgLevelStrc.nLevelId) | 0

      // Configure matching LvlPrest record as an 8x8 preset with dwAutoMap = 1
      const pLvlPrestBase = m.u32(0x6fdf0b3c)
      let pPrestRow = 0
      for (let row = 0; row < 16; row++) {
        const cand = (pLvlPrestBase + row * 0x1b0) >>> 0
        if ((m.u32((cand + 0x04) >>> 0) | 0) === nLevelId) {
          pPrestRow = cand
          break
        }
      }
      expect(pPrestRow).not.toBe(0)
      const prestDef = m.u32(pPrestRow) | 0
      const pDefRow = (pLvlPrestBase + prestDef * 0x1b0) >>> 0
      m.setU32((pDefRow + 0x0c) >>> 0, 0) // bLogicals = 0
      m.setU32((pDefRow + 0x14) >>> 0, 0) // bOutdoors = 0
      m.setU32((pDefRow + 0x28) >>> 0, 8) // dwSizeX = 8
      m.setU32((pDefRow + 0x2c) >>> 0, 8) // dwSizeY = 8
      m.setU32((pDefRow + 0x30) >>> 0, 1) // dwAutoMap = 1
      m.setU32((pDefRow + 0x34) >>> 0, 0) // bScan = 0
      m.setU32((pDefRow + 0x38) >>> 0, 0) // nPops = 0
      m.setU32((pDefRow + 0x1ac) >>> 0, 0) // dwDt1Mask = 0 (loads only the 3 universal DT1s)
      writeAsciiString(m, (pDefRow + 0x44) >>> 0, 'Act1\\Outdoors\\test8x8.ds1')
      m.setU32((pInfo + 0x04) >>> 0, 0)

      // Pre-populate cached DS1 file node at 0x6FDF147C so LoadPresetRoomMap hits cache cleanly
      const pDrlgFile = m.alloc(0x60)
      m.fill(pDrlgFile, 0x60, 0)
      const pShadowCells = m.alloc(0x200)
      m.fill(pShadowCells, 0x200, 0)
      m.setU32((pDrlgFile + 0x0c) >>> 0, 8) // nWidth = 8
      m.setU32((pDrlgFile + 0x10) >>> 0, 8) // nHeight = 8
      m.setU32((pDrlgFile + 0x44) >>> 0, pShadowCells) // pShadowGrid cells (9x9 dwords)
      const pCacheNode = m.alloc(0x110)
      m.fill(pCacheNode, 0x110, 0)
      writeAsciiString(m, pCacheNode, 'Act1\\Outdoors\\test8x8.ds1')
      m.setU32((pCacheNode + 0x104) >>> 0, 1)
      m.setU32((pCacheNode + 0x108) >>> 0, pDrlgFile)
      m.setU32(GP_CACHED_PRESET_FILE_LIST_HEAD_VA_6FDF147C, pCacheNode)

      // Universal DT1 format strings for DRLGROOM_LoadDt1Files113c
      writeAsciiString(m, 0x6fddad5c, 'DATA\\GLOBAL')
      writeAsciiString(m, 0x6fddffb4, '%s\\TILES\\ACT1\\OUTDOORS\\BLANK.DT1')
      writeAsciiString(m, 0x6fddff90, '%s\\TILES\\ACT1\\OUTDOORS\\INVISWAL.DT1')
      writeAsciiString(m, 0x6fddff70, '%s\\TILES\\ACT1\\OUTDOORS\\WARP.DT1')
      const pLvlTypes = m.alloc(0x400)
      m.fill(pLvlTypes, 0x400, 0)
      m.setU32(0x6fdf141c, pLvlTypes)

      // Neighbor level in pDstAdj[0] that already has pFirstRoomEx != 0 (verifies skip) + pre-linked active room stub
      const pDstAdj = DRLGWARP_GetWarpDstAdjustData113c(m, pDrlg, nLevelId)
      const pNeighborLvl = m.alloc(0x230)
      m.fill(pNeighborLvl, 0x230, 0)
      m.set(pNeighborLvl, D2DrlgLevelStrc.nLevelId, 99)
      m.set(pNeighborLvl, D2DrlgLevelStrc.pDrlg, pDrlg)
      m.set(pNeighborLvl, D2DrlgLevelStrc.pFirstRoomEx, 0xdead0001)
      m.setU32((pNeighborLvl + 0x1ac) >>> 0, m.u32((pDrlg + 0x47c) >>> 0))
      m.setU32((pDrlg + 0x47c) >>> 0, pNeighborLvl)
      m.setU32(pDstAdj, 99)

      // Also attach a pre-activated roomEx (all 3 flags set, pRoom = 0xCAFE1234) so both activated and newly built rooms report to pfAutomap
      const pPreRoomEx = m.alloc(0xec)
      m.fill(pPreRoomEx, 0xec, 0)
      m.set(pPreRoomEx, D2RoomExStrc.dwFlags, 0x03100000)
      m.set(pPreRoomEx, D2RoomExStrc.pLevel, lvl)
      m.setU32((pPreRoomEx + 0x30) >>> 0, 0xcafe1234)
      m.set(lvl, D2DrlgLevelStrc.pFirstRoomEx, pPreRoomEx)

      m.set(pDrlg, D2DrlgStrc.pfnAutomapInit, 0x6fab1000)

      const automapRooms: number[] = []
      let hits = new Set<string>()
      beginVaTrace113c()
      try {
        DRLGPRESET_InitLevelPresetRooms113c(m, lvl, (_mem, pRoom) => {
          automapRooms.push(pRoom >>> 0)
        })
      } finally {
        hits = endVaTrace113c()
      }
      expect(hits.has('D2Common:0x6FD5CD10')).toBe(true)
      expect(hits.has('D2Common:0x6FD5BC60')).toBe(true)
      expect(hits.has('D2Common:0x6FD5C690')).toBe(true)
      expect(hits.has('D2Common:0x6FD94CE0')).toBe(true)
      expect(hits.has('D2Common:0x6FD7DD80')).toBe(true)
      expect(hits.has('D2Common:0x6FDB8400')).toBe(true)
      expect(hits.has('D2Common:0x6FD5BF70')).toBe(true)
      expect(hits.has('D2Common:0x6FDCC0E0')).toBe(true)

      // Newly built 8x8 roomEx + pre-existing roomEx both passed their pRoom (+0x30) to pfAutomap
      expect(automapRooms.length).toBe(2)
      expect(automapRooms).toContain(0xcafe1234)
      const pHeadRoomEx = m.get(lvl, D2DrlgLevelStrc.pFirstRoomEx)
      expect(pHeadRoomEx).not.toBe(pPreRoomEx)
      expect((m.get(pHeadRoomEx, D2RoomExStrc.dwFlags) & 0x03100000) >>> 0).toBe(0x03100000)
    })
  })

  describe('0x6FD62720 — UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c branch & array-growth parity', () => {
    function allocRoomWithLevel(
      m: SparseMemory113c,
      subX: number,
      subY: number,
      subW: number,
      subH: number,
      levelId: number,
    ): number {
      const pRoom = m.alloc(0x80)
      m.fill(pRoom, 0x80, 0)
      const pRoomEx = m.alloc(0x80)
      m.fill(pRoomEx, 0x80, 0)
      const pLevel = m.alloc(0x200)
      m.fill(pLevel, 0x200, 0)
      m.setU32((pLevel + 0x1d0) >>> 0, levelId >>> 0)
      m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
      m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
      m.setU32((pRoom + 0x4c) >>> 0, subX >>> 0)
      m.setU32((pRoom + 0x50) >>> 0, subY >>> 0)
      m.setU32((pRoom + 0x54) >>> 0, subW >>> 0)
      m.setU32((pRoom + 0x58) >>> 0, subH >>> 0)
      return pRoom
    }

    function allocMonsterInRoom(
      m: SparseMemory113c,
      pRoom: number,
      classId: number,
      x: number,
      y: number,
      animMode = 1,
    ): number {
      const pUnit = m.alloc(0xf4)
      m.fill(pUnit, 0xf4, 0)
      const pPath = m.alloc(0x40)
      m.fill(pPath, 0x40, 0)
      m.setU16((pPath + 0x02) >>> 0, x & 0xffff)
      m.setU16((pPath + 0x06) >>> 0, y & 0xffff)
      m.setU32((pPath + 0x1c) >>> 0, pRoom)
      m.set(pUnit, D2UnitStrc.dwUnitType, 1) // UNIT_MONSTER
      m.set(pUnit, D2UnitStrc.dwClassId, classId >>> 0)
      m.setU32((pUnit + 0x10) >>> 0, animMode >>> 0)
      m.set(pUnit, D2UnitStrc.pPath, pPath)
      m.set(pUnit, D2UnitStrc.pRoomUnitNext, m.get(pRoom, D2ActiveRoomStrc.pUnitFirst))
      m.set(pRoom, D2ActiveRoomStrc.pUnitFirst, pUnit)
      return pUnit
    }

    it('asserts line 0x10A on NULL pUnitFindData, zeroes dirty nIndex on NULL pRoom, and asserts line 0x13E on missing callback', () => {
      const m = new SparseMemory113c()

      // 1. NULL pUnitFindData -> line 0x10A (266)
      let errNull: unknown
      try {
        UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(m, 0)
      } catch (e) {
        errNull = e
      }
      expect(errNull).toBeInstanceOf(D2CommonAssertError)
      expect((errNull as D2CommonAssertError).line).toBe(0x10a)

      // 2. NULL pRoom -> zeroes dirty nIndex (+0x18) and returns 0
      const pData = m.alloc(0x30)
      m.fill(pData, 0x30, 0)
      m.set(pData, D2UnitFindDataStrc.nIndex, 42)
      expect(UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(m, pData)).toBe(0)
      expect(m.get(pData, D2UnitFindDataStrc.nIndex)).toBe(0)

      // 3. cbPtr != 0 without JS callback -> IsBadCodePtr assert line 0x13E (318)
      const pRoom = allocRoomWithLevel(m, 100, 100, 40, 40, 2)
      allocMonsterInRoom(m, pRoom, 10, 120, 120)
      UNITFINDS_InitUnitFindData113c(m, 0, pData, pRoom, 120, 120, 5, 0x6fc89c60, 0)
      let errCb: unknown
      try {
        UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(m, pData)
      } catch (e) {
        errCb = e
      }
      expect(errCb).toBeInstanceOf(D2CommonAssertError)
      expect((errCb as D2CommonAssertError).line).toBe(0x13e)
      UNITFINDS_FreeUnitFindData113c(m, pData)
    })

    it('distinguishes interior single-room fast path vs border-crossing adjacent-room scan, 0x2000 town skip, and >15 array growth', () => {
      const m = new SparseMemory113c()
      const rCenter = allocRoomWithLevel(m, 100, 100, 40, 40, 2) // Blood Moor (non-town)
      const rTown = allocRoomWithLevel(m, 60, 100, 40, 40, 1) // Rogue Encampment (town)
      const rEast = allocRoomWithLevel(m, 140, 100, 40, 40, 2) // Blood Moor (non-town)
      const rFar = allocRoomWithLevel(m, 300, 300, 40, 40, 2) // Out of range

      const ppNear = m.alloc(4 * 4)
      m.setU32(ppNear, rCenter)
      m.setU32((ppNear + 4) >>> 0, rTown)
      m.setU32((ppNear + 8) >>> 0, rEast)
      m.setU32((ppNear + 12) >>> 0, rFar)
      m.set(rCenter, D2ActiveRoomStrc.ppRoomsNear, ppNear)
      m.set(rCenter, D2ActiveRoomStrc.nRoomsNear, 4)

      // Populate 10 monsters in rCenter, 4 in rTown, 22 in rEast (total non-town = 32 -> grows 15 -> 30 -> 45!)
      for (let i = 0; i < 10; i++) allocMonsterInRoom(m, rCenter, 100 + i, 120, 120)
      for (let i = 0; i < 4; i++) allocMonsterInRoom(m, rTown, 200 + i, 98, 120)
      for (let i = 0; i < 22; i++) allocMonsterInRoom(m, rEast, 300 + i, 142, 120)
      allocMonsterInRoom(m, rFar, 999, 320, 320)

      const pData = m.alloc(0x30)
      const pSearch = m.alloc(0x28)
      m.fill(pSearch, 0x28, 0)
      // D2UnitFindArgStrc: flags = 0x02 (monsters) | 0x800 (secondary callback), center=(120,120), range=30
      m.setU32(pSearch, 0x802)
      m.setU32((pSearch + 0x0c) >>> 0, 120)
      m.setU32((pSearch + 0x10) >>> 0, 120)
      m.setU32((pSearch + 0x14) >>> 0, 30)
      m.setU32((pSearch + 0x24) >>> 0, 1)

      // A. Interior square: (120 +- 5) is strictly inside (100..140, 100..140) -> searches ONLY rCenter (10 units)
      UNITFINDS_InitUnitFindData113c(m, 0, pData, rCenter, 120, 120, 5, 0, pSearch)
      const nInterior = UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(m, pData, () => 0)
      expect(nInterior).toBe(10)
      expect(m.get(pData, D2UnitFindDataStrc.nMaxCount)).toBe(15)
      UNITFINDS_FreeUnitFindData113c(m, pData)

      // B. Border-crossing square (120 +- 25) WITH dwFlags = 0x2000 (skip town):
      // Skips rTown (levelId=1), skips rFar (outside bounds), collects 10 + 21 = 31 units
      // (growing nMaxCount 15 -> 30 -> 45 via 0x6FD620F0), and exercises 0x800 secondary callback rejecting classId 305!
      m.setU32((pSearch + 0x1c) >>> 0, 0)
      UNITFINDS_InitUnitFindData113c(m, 0, pData, rCenter, 120, 120, 25, 0, pSearch)
      m.set(pData, D2UnitFindDataStrc.dwFlags, 0x2000)

      let hits = new Set<string>()
      let nBorderNoTown = 0
      beginVaTrace113c()
      try {
        nBorderNoTown = UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(
          m,
          pData,
          (mem, cand) => ((mem.u32((cand + 4) >>> 0) | 0) === 305 ? 1 : 0),
        )
      } finally {
        hits = endVaTrace113c()
      }
      expect(hits.has('D2Common:0x6FD62720')).toBe(true)
      expect(hits.has('D2Common:0x6FD620F0')).toBe(true) // UNITFINDS_GrowUnitsArray
      expect(hits.has('D2Common:0x6FD624E0')).toBe(true) // UNITFINDS_MatchUnitCandidate
      expect(hits.has('D2Common:0x6FD7D320')).toBe(true) // DRLG_IsTownLevel

      // 10 (rCenter) + 21 (rEast, excluding classId 305) = 31 units -> nMaxCount grew 15 -> 30 -> 45!
      expect(nBorderNoTown).toBe(31)
      expect(m.get(pData, D2UnitFindDataStrc.nIndex)).toBe(31)
      expect(m.get(pData, D2UnitFindDataStrc.nMaxCount)).toBe(45)

      // C. Without 0x2000 flag, rTown's 4 monsters are ALSO matched -> 35 units
      m.setU32((pSearch + 0x1c) >>> 0, 0)
      UNITFINDS_FreeUnitFindData113c(m, pData)
      UNITFINDS_InitUnitFindData113c(m, 0, pData, rCenter, 120, 120, 25, 0, pSearch)
      const nWithTown = UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(
        m,
        pData,
        (mem, cand) => ((mem.u32((cand + 4) >>> 0) | 0) === 305 ? 1 : 0),
      )
      expect(nWithTown).toBe(35)
      UNITFINDS_FreeUnitFindData113c(m, pData)
    })

    it('pre-fetches pRoomUnitNext (+0xE8) before callback so unlinking current unit mid-scan is safe', () => {
      const m = new SparseMemory113c()
      const pRoom = allocRoomWithLevel(m, 0, 0, 50, 50, 2)
      const u1 = allocMonsterInRoom(m, pRoom, 1, 25, 25)
      const u2 = allocMonsterInRoom(m, pRoom, 2, 25, 25)
      const pData = m.alloc(0x30)
      UNITFINDS_InitUnitFindData113c(m, 0, pData, pRoom, 25, 25, 5, 0x6fc89c60, 0x1234)

      const visited: number[] = []
      const count = UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(m, pData, (mem, pUnit, pFilter) => {
        expect(pFilter).toBe(0x1234)
        visited.push(pUnit >>> 0)
        // Clobber pRoomUnitNext (+0xE8) inside callback to prove 0x6FD62805 pre-fetched edi = [esi+0xE8]
        mem.setU32((pUnit + 0xe8) >>> 0, 0)
        return 1
      })
      expect(count).toBe(2)
      expect(visited).toEqual([u2, u1])
      UNITFINDS_FreeUnitFindData113c(m, pData)
    })
  })

  describe('0x6FD66E10 — DRLGOUTPLACE_PlaceActLevelsByList113c difficulty, backtracking, Black Marsh RNG & warps', () => {
    function createDrlgEnv(nAct: number, nDiff: number, seedLo = 0x2468ace1, seedHi = 0x29a): {
      m: SparseMemory113c
      pDrlg: number
      lvlDefBase: number
    } {
      const m = new SparseMemory113c()
      // Reserve addr 0..0xff zeroed for out-of-bounds recBase === 0 reads
      const zeroGuard = m.alloc(0x100)
      m.fill(zeroGuard, 0x100, 0)

      const pDrlg = m.alloc(0x500)
      m.fill(pDrlg, 0x500, 0)
      m.setU32(pDrlg, seedLo >>> 0)
      m.setU32((pDrlg + 0x04) >>> 0, seedHi >>> 0)
      m.setU8((pDrlg + 0x450) >>> 0, nDiff & 0xff)
      m.setU8((pDrlg + 0x480) >>> 0, nAct & 0xff)

      const sgpt = m.alloc(0x1000)
      m.fill(sgpt, 0x1000, 0)
      m.setU32((sgpt + 0xc5c) >>> 0, 140) // lvlDefCount = 140
      m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, sgpt)

      const lvlDefBase = m.alloc(140 * 0x9c)
      m.fill(lvlDefBase, 140 * 0x9c, 0)
      m.setU32(SGPT_LEVELDEF_BIN_VA, lvlDefBase)

      // Levels.txt pointer/count for DRLG_AllocAndInitLevel113c fallback when allocating missing levels
      const levelsTxt = m.alloc(140 * 0x220)
      m.fill(levelsTxt, 140 * 0x220, 0)
      for (let id = 1; id < 140; id++) {
        const lrec = (levelsTxt + id * 0x220) >>> 0
        m.setU16(lrec, id)
        m.setU8((lrec + 0x05) >>> 0, id === 1 || id === 0x28 || id === 0x1b ? 2 : 1)
      }
      m.setU32((sgpt + 0xc54) >>> 0, levelsTxt)
      m.setU32((sgpt + 0xc58) >>> 0, 140)
      m.setU32(0x6fdf0b30, levelsTxt)
      m.setU32(0x6fdf0b34, 140)

      // LvlPrest table for preset level init (id 1, 0x1b, 0x28)
      const lvlPrest = m.alloc(16 * 0x1b0)
      m.fill(lvlPrest, 16 * 0x1b0, 0)
      m.setU32((lvlPrest + 1 * 0x1b0 + 0x04) >>> 0, 1)
      m.setU32((lvlPrest + 2 * 0x1b0 + 0x04) >>> 0, 0x1b)
      m.setU32((lvlPrest + 3 * 0x1b0 + 0x04) >>> 0, 0x28)
      m.setU32((sgpt + 0xc68) >>> 0, 16)
      m.setU32(0x6fdf0b3c, lvlPrest)

      return { m, pDrlg, lvlDefBase }
    }

    function setLevelDefSizes(
      m: SparseMemory113c,
      lvlDefBase: number,
      levelId: number,
      sizesByDiff: ReadonlyArray<[number, number]>,
      offX = 100,
      offY = 100,
    ): void {
      const rec = (lvlDefBase + levelId * 0x9c) >>> 0
      for (let d = 0; d < sizesByDiff.length; d++) {
        m.setU32((rec + 0x0c + d * 4) >>> 0, sizesByDiff[d]![0] >>> 0)
        m.setU32((rec + 0x18 + d * 4) >>> 0, sizesByDiff[d]![1] >>> 0)
      }
      m.setU32((rec + 0x24) >>> 0, offX >>> 0)
      m.setU32((rec + 0x28) >>> 0, offY >>> 0)
    }

    function findLevelOnDrlg(m: SparseMemory113c, pDrlg: number, levelId: number): number {
      let cur = m.u32((pDrlg + D2DrlgStrc.pLevel.off) >>> 0)
      while (cur !== 0) {
        if ((m.u32((cur + D2DrlgLevelStrc.nLevelId.off) >>> 0) | 0) === levelId) return cur
        cur = m.u32((cur + D2DrlgLevelStrc.pNextLevel.off) >>> 0)
      }
      return 0
    }

    it('uses nDifficulty (0..2) dwSizeX/dwSizeY, exercises stateVal == 1 & 3 Black Marsh -> Outer Cloister RNG, and links vis1/vis2 warps iff nAct != 4', () => {
      // Test both stateVal === 3 (rolls (~lo) & 1) on Nightmare (nDiff = 1) and Act != 4 bidirectional warps
      {
        const { m, pDrlg, lvlDefBase } = createDrlgEnv(0, 1, 0x00000002, 0x00000000)
        setLevelDefSizes(m, lvlDefBase, 6, [
          [40, 48],
          [56, 64],
          [72, 80],
        ])
        setLevelDefSizes(m, lvlDefBase, 7, [
          [32, 32],
          [44, 52],
          [60, 68],
        ])

        // Pre-allocate level 0x1B (Outer Cloister) with pPreset record at +0x14
        const pLvl1b = m.alloc(0x230)
        m.fill(pLvl1b, 0x230, 0)
        const pPreset1b = m.alloc(0x10)
        m.fill(pPreset1b, 0x10, 0)
        m.setU32(pLvl1b, 2)
        m.setU32((pLvl1b + 0x14) >>> 0, pPreset1b)
        m.set(pLvl1b, D2DrlgLevelStrc.pDrlg, pDrlg)
        m.set(pLvl1b, D2DrlgLevelStrc.nLevelId, 0x1b)
        m.setU32((pDrlg + D2DrlgStrc.pLevel.off) >>> 0, pLvl1b)

        // Custom 2-entry list: [0] = level 6 (vis1=-1, vis2=1), [1] = level 7 (vis1=0, vis2=-1)
        const pList = m.alloc(3 * 16)
        m.fill(pList, 3 * 16, 0)
        m.setU32((pList + 0x04) >>> 0, 6)
        m.setU32((pList + 0x08) >>> 0, 0xffffffff)
        m.setU32((pList + 0x0c) >>> 0, 1) // vis2 -> idx 1 (level 7)
        m.setU32((pList + 0x14) >>> 0, 7)
        m.setU32((pList + 0x18) >>> 0, 0) // vis1 -> idx 0 (level 6)
        m.setU32((pList + 0x1c) >>> 0, 0xffffffff)

        let validateAttempts = 0
        DRLGOUTPLACE_PlaceActLevelsByList113c(
          m,
          pDrlg,
          pList,
          (sm, frameBase, idx) => {
            // Set x, y and force nRand[0][0] = 3 (for Black Marsh stateVal === 3 branch!)
            sm.setU32((frameBase + 0x08 + idx * 16) >>> 0, (100 + idx * 60) >>> 0)
            sm.setU32((frameBase + 0x0c + idx * 16) >>> 0, 200)
            sm.setU32((frameBase + 0xfc + idx * 4) >>> 0, 3)
            return 1
          },
          (_sm, _frameBase, idx) => {
            if (idx === 1 && validateAttempts === 0) {
              validateAttempts++
              return 0 // force retry of idx 1 without backtracking
            }
            return 1
          },
        )
        expect(validateAttempts).toBe(1)

        const pLvl6 = findLevelOnDrlg(m, pDrlg, 6)
        const pLvl7 = findLevelOnDrlg(m, pDrlg, 7)
        expect(pLvl6).not.toBe(0)
        expect(pLvl7).not.toBe(0)
        // Nightmare (nDiff=1) dimensions selected!
        expect(m.get(pLvl6, D2DrlgLevelStrc.nWidth)).toBe(56)
        expect(m.get(pLvl6, D2DrlgLevelStrc.nHeight)).toBe(64)
        expect(m.get(pLvl7, D2DrlgLevelStrc.nWidth)).toBe(44)
        expect(m.get(pLvl7, D2DrlgLevelStrc.nHeight)).toBe(52)

        // Verify Black Marsh stateVal == 3 rolled pDrlg seed (2 * 0x6AC690C5 = 0xD58D218A, even -> (~lo)&1 == 1)
        expect(m.u32(pDrlg)).toBe(0xd58d218a)
        expect(m.u32((pPreset1b + 0x04) >>> 0)).toBe(1)

        // Verify bidirectional D2DrlgWarpStrc records allocated on pDrlg + 0x90 (pWarp) for both levels 6 and 7
        const pWarpHead = m.u32((pDrlg + 0x90) >>> 0)
        expect(pWarpHead).not.toBe(0)
        expect(m.u32((pWarpHead + 0x44) >>> 0)).not.toBe(0)
      }

      // Now verify nAct == 4 (Act 5) suppresses warp record allocation on pDrlg + 0x90 even when vis1 != -1
      {
        const { m, pDrlg, lvlDefBase } = createDrlgEnv(4, 0)
        setLevelDefSizes(m, lvlDefBase, 109, [[40, 40]], 200, 200)
        setLevelDefSizes(m, lvlDefBase, 110, [[40, 40]], 200, 160)

        const pList = m.alloc(3 * 16)
        m.fill(pList, 3 * 16, 0)
        m.setU32(pList, 0x6fd657d0)
        m.setU32((pList + 0x04) >>> 0, 109)
        m.setU32((pList + 0x08) >>> 0, 0xffffffff)
        m.setU32((pList + 0x0c) >>> 0, 0xffffffff)
        m.setU32((pList + 0x10) >>> 0, 0x6fd657d0)
        m.setU32((pList + 0x14) >>> 0, 110)
        m.setU32((pList + 0x18) >>> 0, 0)
        m.setU32((pList + 0x1c) >>> 0, 0xffffffff)

        DRLGOUTPLACE_PlaceActLevelsByList113c(m, pDrlg, pList, undefined, 0, 0)
        expect(m.u32((pDrlg + 0x90) >>> 0)).toBe(0)
      }
    })

    it('solves real Act 1 (0x6FDDCCD8), Act 2 (0x6FDDCDC8), and Act 4 (0x6FDDD098) .data link tables end-to-end', () => {
      // Act 1 Monastery->Marsh->Wood->Field (ACT2_LINK_DEFS_VA = 0x6FDDCCD8) + Act 2 (0x6FDDCDC8) + Act 4 (0x6FDDD098)
      const { m, pDrlg, lvlDefBase } = createDrlgEnv(0, 0, 0x13572468, 0x29a)
      for (const id of [1, 2, 3, 4, 5, 6, 7, 17, 26, 27, 39, 40, 41, 42, 43, 44, 45, 103, 104, 105, 106]) {
        setLevelDefSizes(m, lvlDefBase, id, [[32, 32]], 400 + id * 8, 400 + id * 8)
      }
      // Pre-allocate outdoor/preset sub-structs on levels that receive vertex flags or preset directions
      let head = 0
      for (const id of [1, 2, 3, 4, 5, 6, 7, 17, 26, 27, 39, 40, 41, 42, 43, 44, 45, 103, 104, 105, 106]) {
        const pLvl = m.alloc(0x230)
        m.fill(pLvl, 0x230, 0)
        const pSub = m.alloc(0x80)
        m.fill(pSub, 0x80, 0)
        m.setU32(pLvl, id === 1 || id === 27 || id === 40 || id === 103 ? 2 : 1)
        m.setU32((pLvl + 0x14) >>> 0, pSub)
        m.set(pLvl, D2DrlgLevelStrc.pDrlg, pDrlg)
        m.set(pLvl, D2DrlgLevelStrc.nLevelId, id)
        m.setU32((pLvl + 0x1ac) >>> 0, head)
        head = pLvl
      }
      m.setU32((pDrlg + D2DrlgStrc.pLevel.off) >>> 0, head)

      let hits = new Set<string>()
      beginVaTrace113c()
      try {
        DRLGOUTPLACE_PlaceActLevelsByList113c(m, pDrlg, ACT1_LINK_DEFS_VA, undefined, 0x6fd64a00, 0x6fd63fd0)
        DRLGOUTPLACE_PlaceActLevelsByList113c(m, pDrlg, ACT2_LINK_DEFS_VA, undefined, 0x6fd64900, 0x6fd63fd0)
        DRLGOUTPLACE_PlaceActLevelsByList113c(m, pDrlg, 0x6fddcdc8, undefined, 0x6fd64870, 0)
        m.setU32(GDW_ACT4_STEP_FLAG_VA, 0)
        DRLGOUTPLACE_PlaceActLevelsByList113c(m, pDrlg, 0x6fddd098, undefined, 0x6fd646c0, 0)
      } finally {
        hits = endVaTrace113c()
      }
      expect(hits.has('D2Common:0x6FD66E10')).toBe(true)
      expect(hits.has('D2Common:0x6FD64900')).toBe(true)
      expect(hits.has('D2Common:0x6FD64A00')).toBe(true)
      expect(hits.has('D2Common:0x6FD64B00')).toBe(true)
      expect(hits.has('D2Common:0x6FD64D00')).toBe(true)
      expect(hits.has('D2Common:0x6FD64E30')).toBe(true)
      expect(hits.has('D2Common:0x6FD65480')).toBe(true)

      // Lut Gholein (0x28 = 40, drlgType = 2) received nRand[0][idx + 1] (Spider Forest direction 1 or 2) at pPreset + 4!
      const pLvl40 = findLevelOnDrlg(m, pDrlg, 40)
      const lutDir = m.u32((m.u32((pLvl40 + 0x14) >>> 0) + 0x04) >>> 0)
      expect([1, 2]).toContain(lutDir)

      // Act 4 step flag (0x6FDF146C) set to 0x400000 or 0x800000 by 0x6FD64B00
      expect([0x400000, 0x800000]).toContain(m.u32(GDW_ACT4_STEP_FLAG_VA))
    })
  })
})
