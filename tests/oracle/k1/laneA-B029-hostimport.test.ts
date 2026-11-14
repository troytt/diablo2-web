import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { LOGGING_WriteFormattedEntry113c } from '../../../src/d2kern-113c/common/logging.ts'
import {
  DUNGEON_GetActLevelId113c,
  DUNGEON_GetRoomTileSubtypesPtr113c,
  ITEMS_SetItemCell113c,
  STATLIST_FreeModStats113c,
  STATLIST_FreeStatListImpl113c,
  STATLIST_GetUnitType113c,
  STATLIST_RollRandomItemGraphicStat113c,
  STATLIST_UnpackSkillStatParam113c,
  UNITS_ApplyRunWalkStatListInline113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import {
  CHAT_AllocHoverMsg113c,
  CHAT_FreeHoverMsg113c,
  TEXT_AddNodeToTextList113c,
  TEXT_AllocTextList113c,
  TEXT_BuildMessageList113c,
  TEXT_FreeTextList113c,
} from '../../../src/d2kern-113c/common/text.ts'
import {
  UNITFINDS_FindUnitInAdjacentRooms113c,
  UNITFINDS_FreeUnitFindData113c,
  UNITFINDS_GrowUnitsArray113c,
  UNITFINDS_InitUnitFindData113c,
} from '../../../src/d2kern-113c/common/unit-finds.ts'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'b029-vectors.ndjson')

interface MemBlock {
  addr: number
  hex: string
}

interface VectorRecord {
  va: string
  name: string
  caseId: string
  args: number[]
  retMask: number
  eax: number
  asserted?: number
  assertLine?: number
  pre: MemBlock[]
  post: MemBlock[]
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >>> 1)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0')
  }
  return out
}

function createGuardedMemory(pre: MemBlock[], post: MemBlock[]): {
  raw: SparseMemory113c
  mem: Memory113c
  rogueReads: number[]
  rogueWrites: number[]
} {
  const raw = new SparseMemory113c()
  const readSpans: Array<{ start: number; end: number }> = []
  const writeSpans: Array<{ start: number; end: number }> = []
  for (const blk of pre) {
    const start = blk.addr >>> 0
    const bytes = hexToBytes(blk.hex)
    raw.loadBlock(start, bytes)
    readSpans.push({ start, end: (start + bytes.length) >>> 0 })
    writeSpans.push({ start, end: (start + bytes.length) >>> 0 })
  }
  for (const blk of post) {
    const start = blk.addr >>> 0
    const len = blk.hex.length >>> 1
    writeSpans.push({ start, end: (start + len) >>> 0 })
  }
  const rogueReads: number[] = []
  const rogueWrites: number[] = []
  const checkSpan = (
    addr: number,
    width: number,
    spans: Array<{ start: number; end: number }>,
    target: number[],
  ): void => {
    for (let i = 0; i < width; i++) {
      const a = (addr + i) >>> 0
      if (!spans.some(s => a >= s.start && a < s.end)) {
        target.push(a)
      }
    }
  }
  const mem: Memory113c = {
    alloc: size => {
      const p = raw.alloc(size)
      readSpans.push({ start: p, end: (p + size) >>> 0 })
      writeSpans.push({ start: p, end: (p + size) >>> 0 })
      return p
    },
    u8: p => {
      checkSpan(p, 1, readSpans, rogueReads)
      return raw.u8(p)
    },
    u16: p => {
      checkSpan(p, 2, readSpans, rogueReads)
      return raw.u16(p)
    },
    u32: p => {
      checkSpan(p, 4, readSpans, rogueReads)
      return raw.u32(p)
    },
    setU8: (p, v) => {
      checkSpan(p, 1, writeSpans, rogueWrites)
      raw.setU8(p, v)
    },
    setU16: (p, v) => {
      checkSpan(p, 2, writeSpans, rogueWrites)
      raw.setU16(p, v)
    },
    setU32: (p, v) => {
      checkSpan(p, 4, writeSpans, rogueWrites)
      raw.setU32(p, v)
    },
    get: (base, f, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      checkSpan((base + f.off + idx * width) >>> 0, width, readSpans, rogueReads)
      return raw.get(base, f, idx)
    },
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      checkSpan((base + f.off + idx * width) >>> 0, width, writeSpans, rogueWrites)
      raw.set(base, f, v, idx)
    },
    fill: (p, len, v) => {
      checkSpan(p, len, writeSpans, rogueWrites)
      raw.fill(p, len, v)
    },
  }
  return { raw, mem, rogueReads, rogueWrites }
}

type B029Runner = (mem: Memory113c, args: number[]) => number

const B029_DISPATCH: Readonly<Record<string, B029Runner>> = {
  '0x6FD62000': (mem, [pUnitFindData]) => {
    UNITFINDS_FreeUnitFindData113c(mem, pUnitFindData!)
    return 0
  },
  '0x6FD62030': (mem, [pMemPool, pUnitFindData, pRoom, pUnit, pfnCallback, nFlags, nSize, nY]) => {
    UNITFINDS_InitUnitFindData113c(
      mem,
      pMemPool!,
      pUnitFindData!,
      pRoom!,
      pUnit!,
      pfnCallback!,
      nFlags!,
      nSize!,
      nY!,
    )
    return 0
  },
  '0x6FD620F0': (mem, [pUnitFindData]) => UNITFINDS_GrowUnitsArray113c(mem, pUnitFindData!),
  '0x6FD622B0': (mem, [pRoom, nUnitType, nClassId]) =>
    UNITFINDS_FindUnitInAdjacentRooms113c(mem, pRoom!, nUnitType!, nClassId!),
  '0x6FD62AF0': (mem, [nArg0, nArg1, nArg2, nArg3, szFile, nLine, szFormat, vaList]) => {
    LOGGING_WriteFormattedEntry113c(
      mem,
      nArg0!,
      nArg1!,
      nArg2!,
      nArg3!,
      szFile!,
      nLine!,
      szFormat!,
      vaList!,
    )
    return 0
  },
  '0x6FD68260': (mem, [pMemPool, pHoverText]) => {
    CHAT_FreeHoverMsg113c(mem, pMemPool!, pHoverText!)
    return 0
  },
  '0x6FD68280': (mem, [pMemPool, szText, nFrame]) =>
    CHAT_AllocHoverMsg113c(mem, pMemPool!, szText!, nFrame!),
  '0x6FD725F0': (mem, [pItem, nItemCell]) => {
    ITEMS_SetItemCell113c(mem, pItem!, nItemCell!)
    return 0
  },
  '0x6FD82E10': (mem, [nCharClassId, pUnit]) => {
    UNITS_ApplyRunWalkStatListInline113c(mem, nCharClassId!, pUnit!)
    return 0
  },
  '0x6FD87E20': (mem, [pUnit]) => {
    STATLIST_FreeModStats113c(mem, pUnit!)
    return 0
  },
  '0x6FD8A9F0': (mem, [pStatList]) => {
    STATLIST_FreeStatListImpl113c(mem, pStatList!)
    return 0
  },
  '0x6FD8B0A0': (mem, [pStatList]) => STATLIST_GetUnitType113c(mem, pStatList!),
  '0x6FD8B1A0': (mem, [pRoom]) => DUNGEON_GetRoomTileSubtypesPtr113c(mem, pRoom!),
  '0x6FD8B1E0': (mem, [nAct]) => DUNGEON_GetActLevelId113c(mem, nAct!),
  '0x6FD8D060': (mem, [pTextHeader, pMsgList]) => {
    TEXT_BuildMessageList113c(mem, pTextHeader!, pMsgList!)
    return 0
  },
  '0x6FD8D210': (mem, [pTextHeader, nStringId, nMenuIndex]) => {
    TEXT_AddNodeToTextList113c(mem, pTextHeader!, nStringId!, nMenuIndex!)
    return 0
  },
  '0x6FD8D280': (mem, [pMemPool]) => TEXT_AllocTextList113c(mem, pMemPool!),
  '0x6FD8D450': (mem, [pTextHeader]) => {
    TEXT_FreeTextList113c(mem, pTextHeader!)
    return 0
  },
  '0x6FD95780': (mem, [nParam, pOutDiv3, pOutRem3, pOutSkillIdx]) => {
    STATLIST_UnpackSkillStatParam113c(mem, nParam!, pOutDiv3!, pOutRem3!, pOutSkillIdx!)
    return 0
  },
  '0x6FD96920': (mem, [pItem]) => {
    STATLIST_RollRandomItemGraphicStat113c(mem, pItem!)
    return 0
  },
}

function verifyVector(rec: VectorRecord, overrideRet?: number): void {
  const runner = B029_DISPATCH[rec.va]
  if (!runner) throw new Error(`Missing B029 runner for ${rec.va}`)
  const { raw, mem, rogueReads, rogueWrites } = createGuardedMemory(rec.pre, rec.post)
  if (rec.asserted === 1) {
    let caught: unknown = undefined
    try {
      runner(mem, rec.args)
    } catch (err) {
      caught = err
    }
    if (!(caught instanceof D2CommonAssertError)) {
      throw new Error(
        `${rec.va} ${rec.name} [${rec.caseId}] expected D2CommonAssertError(line=${rec.assertLine}), got ${String(caught)}`,
      )
    }
    expect(caught.line).toBe(rec.assertLine)
    if (rogueReads.length > 0) {
      throw new Error(
        `${rec.va} ${rec.name} [${rec.caseId}] read outside pre.mem at 0x${rogueReads[0]!.toString(16)}`,
      )
    }
    if (rogueWrites.length > 0) {
      throw new Error(
        `${rec.va} ${rec.name} [${rec.caseId}] wrote outside allowed memory at 0x${rogueWrites[0]!.toString(16)}`,
      )
    }
    return
  }

  const actualRet = overrideRet !== undefined ? overrideRet : runner(mem, rec.args)
  if (rogueReads.length > 0) {
    throw new Error(
      `${rec.va} ${rec.name} [${rec.caseId}] read outside pre.mem at 0x${rogueReads[0]!.toString(16)}`,
    )
  }
  if (rogueWrites.length > 0) {
    throw new Error(
      `${rec.va} ${rec.name} [${rec.caseId}] wrote outside allowed memory at 0x${rogueWrites[0]!.toString(16)}`,
    )
  }
  const mask = rec.retMask >>> 0
  if (mask !== 0) {
    const got = ((actualRet >>> 0) & mask) >>> 0
    const exp = ((rec.eax >>> 0) & mask) >>> 0
    if (got !== exp) {
      throw new Error(
        `${rec.va} ${rec.name} [${rec.caseId}] eax mismatch: got 0x${got.toString(16)}, expected 0x${exp.toString(16)}`,
      )
    }
  }
  for (const blk of rec.post) {
    const start = blk.addr >>> 0
    const len = blk.hex.length >>> 1
    const actualHex = bytesToHex(raw.readBytes(start, len))
    if (actualHex !== blk.hex) {
      throw new Error(
        `${rec.va} ${rec.name} [${rec.caseId}] post-memory mismatch at 0x${start.toString(16)}: got ${actualHex}, expected ${blk.hex}`,
      )
    }
  }
}

describe('Lane A B029 — Real D2Common.dll Differential Replay & Negative Controls (20 hostImport functions)', () => {
  const lines = fs
    .readFileSync(FIXTURE_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
  const vectors: VectorRecord[] = lines.map(l => JSON.parse(l) as VectorRecord)

  it('loads all 20 B029 function VAs with real-DLL vectors (65 vectors total)', () => {
    expect(vectors.length).toBe(65)
    const expectedVas = Object.keys(B029_DISPATCH)
    expect(expectedVas.length).toBe(20)
    for (const va of expectedVas) {
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(2)
    }
  })

  for (const [va, runner] of Object.entries(B029_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte for ${va}`, () => {
      expect(runner).toBeTypeOf('function')
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length).toBeGreaterThanOrEqual(2)
      for (const rec of fnVectors) {
        verifyVector(rec)
      }
    })
  }

  it('negative control: mutating return value or accessing unmapped memory is caught for B029 functions', () => {
    for (const va of Object.keys(B029_DISPATCH)) {
      const rec = vectors.find(v => v.va === va && v.asserted !== 1)!
      expect(rec).toBeDefined()
      if ((rec.retMask >>> 0) !== 0) {
        expect(() => verifyVector(rec, (rec.eax ^ 1) >>> 0)).toThrow(/eax mismatch/)
      }
    }
    const sample = vectors.find(v => v.pre.length > 0)!
    const { mem, rogueReads, rogueWrites } = createGuardedMemory(sample.pre, sample.post)
    expect(() => mem.u8(0x0badf00d)).toThrow(/read of unloaded byte/)
    expect(rogueReads.length).toBe(1)
    mem.setU8(0x0badf00e, 1)
    expect(rogueWrites.length).toBe(1)
  })
})
