import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLLISION_FindAdjacentUnitWithCallback113c } from '../../../src/d2kern-113c/common/collision.ts'
import { STATLIST_EnumerateCopyListStats113c } from '../../../src/d2kern-113c/common/drlg/preset.ts'
import { DUNGEON_AllocActiveRoom113c } from '../../../src/d2kern-113c/common/dungeon.ts'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { ITEMS_GetRepairAllCost113c } from '../../../src/d2kern-113c/common/items.ts'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetActiveWeaponMemPort113c,
  INVENTORY_GetCompositWeaponMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  INVENTORY_GetOrInitGridMemPort113c,
  INVENTORY_GetWeaponByHandSlotMemPort113c,
  ITEMS_CheckIfThrowItemMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  ITEMS_GetDexBonusMemPort113c,
  ITEMS_GetStrBonusMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_GetWeaponMasteryBonusMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_AddStatMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
  STATLIST_ExpireStateListsOnModeChangeMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../../../src/d2kern-113c/common/k0-d2common-memports.ts'
import { D2COMMON_LOG_ENABLED_VA_113C, D2COMMON_LOG_LOCK_VA_113C, LOGGING_WriteLockedEntry113c } from '../../../src/d2kern-113c/common/logging.ts'
import {
  SKILLS_GetThrowingWeaponMasteryBonus113c,
  STATLIST_GetStatsByIdFromList113c,
} from '../../../src/d2kern-113c/common/missile.ts'
import {
  STATLIST_NotifyIfStatModified113c,
  STATLIST_SetFullStatEntry113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import {
  UNITFINDS_FindNearestUnitInRange113c,
  UNITFINDS_MatchUnitCandidate113c,
} from '../../../src/d2kern-113c/common/unit-finds.ts'
import { type Memory113c, SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

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
    args: Array<number | string>
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

const ARENA_OUT = 0x03505c00
const ARENA_CB0 = 0x0350a000
const ARENA_CB1 = 0x0350a040
const ARENA_CB2 = 0x0350a080
const ARENA_CB3 = 0x0350a0c0
const ARENA_CB4 = 0x0350a100
const ARENA_CB5 = 0x0350a180
const ARENA_CB6 = 0x0350a1c0

function parseU32(v: number | string): number {
  if (typeof v === 'number') return v >>> 0
  return Number.parseInt(v, 16) >>> 0
}

function parseS32(v: number | string): number {
  if (typeof v === 'number') return v | 0
  return Number.parseInt(v, 16) | 0
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >>> 1)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i]!.toString(16).padStart(2, '0')
  }
  return s
}

function loadVectorFile(relPath: string): VectorRecord[] {
  const full = join(process.cwd(), relPath)
  return readFileSync(full, 'utf8')
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as VectorRecord)
}

function cb0Filter(m: Memory113c, cand: number, _u: number): number {
  return m.u32((cand + 4) >>> 0) !== 99 ? 1 : 0
}

function cb1Reject77(m: Memory113c, cand: number, _search: number): number {
  return m.u32((cand + 4) >>> 0) === 77 ? 1 : 0
}

function cb2RepairRecord(m: Memory113c, pContext: number, pItem: number, pUnit: number): void {
  const idx = m.u32(ARENA_OUT)
  const base = (ARENA_OUT + 4 + idx * 12) >>> 0
  m.setU32(base, pContext >>> 0)
  m.setU32((base + 4) >>> 0, pItem >>> 0)
  m.setU32((base + 8) >>> 0, pUnit >>> 0)
  m.setU32(ARENA_OUT, (idx + 1) >>> 0)
}

function cb3StatEnum(
  m: Memory113c,
  pUnit: number,
  nStatId: number,
  nVal: number,
  pArg: number,
): void {
  const idx = m.u32(pArg >>> 0)
  const base = (pArg + 4 + idx * 12) >>> 0
  m.setU32(base, pUnit >>> 0)
  m.setU32((base + 4) >>> 0, nStatId >>> 0)
  m.setU32((base + 8) >>> 0, nVal >>> 0)
  m.setU32(pArg >>> 0, (idx + 1) >>> 0)
}

function cb4StatChanged(
  m: Memory113c,
  pGame: number,
  pOwner: number,
  pUnit: number,
  dwKey: number,
  oldVal: number,
  newVal: number,
): void {
  m.setU32(ARENA_OUT, 1)
  m.setU32((ARENA_OUT + 4) >>> 0, pGame >>> 0)
  m.setU32((ARENA_OUT + 8) >>> 0, pOwner >>> 0)
  m.setU32((ARENA_OUT + 12) >>> 0, pUnit >>> 0)
  m.setU32((ARENA_OUT + 16) >>> 0, dwKey >>> 0)
  m.setU32((ARENA_OUT + 20) >>> 0, oldVal >>> 0)
  m.setU32((ARENA_OUT + 24) >>> 0, newVal >>> 0)
}

function cb5RoomCreated(m: Memory113c, pRoom: number): void {
  m.setU32(ARENA_OUT, pRoom >>> 0)
  m.setU32((ARENA_OUT + 4) >>> 0, m.u32((pRoom + 0x6c) >>> 0))
}

function cb6AdjUnit(m: Memory113c, pUnit: number, pContext: number): number {
  m.setU32(ARENA_OUT, (m.u32(ARENA_OUT) + 1) >>> 0)
  return m.u32((pUnit + 0x0c) >>> 0) === pContext >>> 0 ? 1 : 0
}

function dispatchVector(m: SparseMemory113c, rec: VectorRecord): number {
  const a = rec.inputs.args
  switch (rec.va.toUpperCase()) {
    case '0X6FD62330': {
      const cbPtr = parseU32(a[4]!)
      return (
        UNITFINDS_FindNearestUnitInRange113c(
          m,
          parseU32(a[0]!),
          parseS32(a[1]!),
          parseS32(a[2]!),
          parseS32(a[3]!),
          cbPtr,
          cbPtr === ARENA_CB0 ? cb0Filter : undefined,
        ) >>> 0
      )
    }
    case '0X6FD624E0': {
      const pSearch = parseU32(a[1]!)
      const cbPtr = pSearch !== 0 ? m.u32((pSearch + 0x24) >>> 0) : 0
      return (
        UNITFINDS_MatchUnitCandidate113c(
          m,
          parseU32(a[0]!),
          pSearch,
          cbPtr === ARENA_CB1 ? cb1Reject77 : undefined,
        ) >>> 0
      )
    }
    case '0X6FD62C00': {
      LOGGING_WriteLockedEntry113c(
        m,
        parseU32(a[0]!),
        parseU32(a[1]!),
        parseU32(a[2]!),
        parseU32(a[3]!),
        parseU32(a[4]!),
        parseS32(a[5]!),
        parseU32(a[6]!),
        ARENA_OUT,
      )
      return 0
    }
    case '0X6FD6E1B0':
      return (
        INVENTORY_GetOrInitGridMemPort113c(m, parseU32(a[0]!), parseS32(a[1]!), parseU32(a[2]!)) >>>
        0
      )
    case '0X6FD6E670':
      return INVENTORY_GetItemFromBodyLocMemPort113c(m, parseU32(a[0]!), parseS32(a[1]!)) >>> 0
    case '0X6FD70320':
      return INVENTORY_GetCompositWeaponMemPort113c(m, parseU32(a[0]!)) >>> 0
    case '0X6FD70700':
      return (
        INVENTORY_GetActiveWeaponMemPort113c(
          m,
          parseU32(a[0]!),
          parseU32(a[1]!),
          parseU32(a[2]!),
          parseU32(a[3]!),
        ) >>> 0
      )
    case '0X6FD70830':
      return INVENTORY_GetWeaponByHandSlotMemPort113c(m, parseU32(a[0]!), parseU32(a[1]!)) >>> 0
    case '0X6FD72970':
      return ITEMS_GetDexBonusMemPort113c(m, parseU32(a[0]!)) >>> 0
    case '0X6FD729A0':
      return ITEMS_GetStrBonusMemPort113c(m, parseU32(a[0]!)) >>> 0
    case '0X6FD74430':
      return ITEMS_CheckItemTypeIdMemPort113c(m, parseU32(a[0]!), parseS32(a[1]!)) >>> 0
    case '0X6FD74C30':
      return ITEMS_CheckIfThrowItemMemPort113c(m, parseU32(a[0]!)) >>> 0
    case '0X6FD7A210': {
      const cbPtr = parseU32(a[5]!)
      return (
        ITEMS_GetRepairAllCost113c(
          m,
          parseU32(a[0]!),
          parseU32(a[1]!),
          parseS32(a[2]!),
          parseS32(a[3]!),
          parseU32(a[4]!),
          cbPtr,
          cbPtr === ARENA_CB2 ? cb2RepairRecord : undefined,
        ) >>> 0
      )
    }
    case '0X6FD803A0':
      return SKILLS_GetUsedSkillMemPort113c(m, parseU32(a[0]!)) >>> 0
    case '0X6FD803E0':
      SKILLS_SetUsedSkillMemPort113c(m, parseU32(a[0]!), parseU32(a[1]!))
      return 0
    case '0X6FD882F0':
      return (
        STATLIST_GetStatsByIdFromList113c(
          m,
          parseU32(a[0]!),
          parseU32(a[1]!),
          parseS32(a[2]!),
          parseU32(a[3]!),
        ).length >>> 0
      )
    case '0X6FD88520':
      return STATLIST_GetStatListFromUnitAndStateMemPort113c(m, parseU32(a[0]!), parseS32(a[1]!)) >>> 0
    case '0X6FD88850': {
      const cbPtr = parseU32(a[2]!)
      STATLIST_EnumerateCopyListStats113c(
        m,
        parseU32(a[0]!),
        parseU32(a[1]!),
        cbPtr,
        cbPtr === ARENA_CB3 ? cb3StatEnum : undefined,
      )
      return 0
    }
    case '0X6FD888E0': {
      const cbPtr = parseU32(a[3]!)
      STATLIST_NotifyIfStatModified113c(
        m,
        parseU32(a[0]!),
        parseU32(a[1]!),
        parseU32(a[2]!),
        cbPtr,
        cbPtr === ARENA_CB3 ? cb3StatEnum : undefined,
      )
      return 0
    }
    case '0X6FD88940': {
      const pListEx = parseU32(a[0]!)
      const cbPtr = pListEx !== 0 ? m.u32((pListEx + 0x5c) >>> 0) : 0
      STATLIST_SetFullStatEntry113c(
        m,
        pListEx,
        parseU32(a[1]!),
        parseS32(a[2]!),
        parseU32(a[3]!),
        parseU32(a[4]!),
        cbPtr === ARENA_CB4 ? cb4StatChanged : undefined,
      )
      return 0
    }
    case '0X6FD8A330':
      STATLIST_AddStatMemPort113c(
        m,
        parseU32(a[0]!),
        parseS32(a[1]!),
        parseS32(a[2]!),
        parseU32(a[3]!),
      )
      return 0
    case '0X6FD8A710':
      STATLIST_AddUnitStatMemPort113c(
        m,
        parseU32(a[0]!),
        parseS32(a[1]!),
        parseS32(a[2]!),
        parseU32(a[3]!),
      )
      return 0
    case '0X6FD8AE60':
      STATLIST_ExpireStateListsOnModeChangeMemPort113c(m, parseU32(a[0]!))
      return 0
    case '0X6FD8C390':
      return DUNGEON_CheckRoomIsTownMemPort113c(m, parseU32(a[0]!)) >>> 0
    case '0X6FD8C720': {
      const pAct = parseU32(a[0]!)
      const cbPtr = pAct !== 0 ? m.u32((pAct + 0x4c) >>> 0) : 0
      return (
        DUNGEON_AllocActiveRoom113c(
          m,
          pAct,
          parseU32(a[1]!),
          parseU32(a[2]!),
          parseU32(a[3]!),
          parseU32(a[4]!),
          parseS32(a[5]!),
          cbPtr === ARENA_CB5 ? cb5RoomCreated : undefined,
        ) >>> 0
      )
    }
    case '0X6FD9F200':
      return (
        (SKILLS_GetThrowingWeaponMasteryBonus113c(
          m,
          parseU32(a[0]!),
          parseU32(a[1]!),
          parseU32(a[2]!),
          parseS32(a[3]!),
          parseU32(a[4]!),
        ) ?? 0) >>> 0
      )
    case '0X6FD9F640':
      return (
        SKILLS_GetWeaponMasteryBonusMemPort113c(
          m,
          parseU32(a[0]!),
          parseU32(a[1]!),
          parseU32(a[2]!),
          parseS32(a[3]!),
        ) >>> 0
      )
    case '0X6FDC19A0':
      return DATATBLS_GetItemsTxtRecordMemPort113c(m, parseS32(a[0]!)) >>> 0
    case '0X6FDCF6A0': {
      const cbPtr = parseU32(a[3]!)
      return (
        COLLISION_FindAdjacentUnitWithCallback113c(
          m,
          parseU32(a[0]!),
          parseS32(a[1]!),
          parseS32(a[2]!),
          cbPtr,
          parseU32(a[4]!),
          parseS32(a[5]!),
          cbPtr === ARENA_CB6 ? cb6AdjUnit : undefined,
        ) >>> 0
      )
    }
    default:
      throw new Error(`Unhandled VA ${rec.va}`)
  }
}

describe('K1 R13 Lane D: All 29 Remaining Ported D2Common Functions -> Diff-Verified', () => {
  const records = loadVectorFile('tests/fixtures/oracle/vectors/k1r13-i14d-1.ndjson')

  it('contains >= 3 vectors for all 29 target D2Common VAs', () => {
    const counts = new Map<string, number>()
    for (const r of records) {
      counts.set(r.va.toUpperCase(), (counts.get(r.va.toUpperCase()) ?? 0) + 1)
    }
    expect(counts.size).toBe(29)
    for (const [va, n] of counts) {
      expect(n, `VA ${va} vector count`).toBeGreaterThanOrEqual(3)
    }
  })

  for (const rec of records) {
    it(`${rec.va} ${rec.name} [${rec.caseIndex}] ${rec.note}`, () => {
      const m = new SparseMemory113c()
      const origAlloc = m.alloc.bind(m)
      m.alloc = (size: number): number => ((size >>> 0) === 0 ? 0 : origAlloc(size))
      for (const blk of rec.inputs.memory) {
        m.loadBlock(parseU32(blk.base), hexToBytes(blk.hex))
      }

      if (rec.expectedAssert !== undefined) {
        let caught: unknown = null
        try {
          dispatchVector(m, rec)
        } catch (err) {
          caught = err
        }
        expect(caught).toBeInstanceOf(D2CommonAssertError)
        expect((caught as D2CommonAssertError).line).toBe(rec.expectedAssert.line)
        return
      }

      const ret = dispatchVector(m, rec)
      const retMask = parseU32(rec.outputs.retMask)
      const expEax = parseU32(rec.outputs.eax)
      if (retMask !== 0) {
        expect((ret & retMask) >>> 0).toBe((expEax & retMask) >>> 0)
      }

      for (const blk of rec.outputs.memory) {
        const base = parseU32(blk.base)
        const expLen = blk.hex.length >>> 1
        const actualHex = bytesToHex(m.readBytes(base, expLen))
        expect(actualHex, `Memory mismatch at ${blk.base}`).toBe(blk.hex)
      }
    })
  }

  it('exercises boundary & edge conditions across all 29 functions', () => {
    // 1. LOGGING_WriteLockedEntry113c (0x6FD62C00): lock gate, default pVaList=0, and format vs vaList order
    {
      const m = new SparseMemory113c()
      const u32Reads: number[] = []
      const origU32 = m.u32.bind(m)
      m.u32 = (addr: number): number => {
        u32Reads.push(addr >>> 0)
        return origU32(addr)
      }
      // Lock == 0 -> does not read D2COMMON_LOG_ENABLED_VA_113C
      m.setU32(D2COMMON_LOG_LOCK_VA_113C, 0)
      m.setU32(D2COMMON_LOG_ENABLED_VA_113C, 1)
      LOGGING_WriteLockedEntry113c(m, 1, 2, 3, 4, 0x1000, 10, 0x2000, 0x3000)
      expect(u32Reads).toEqual([D2COMMON_LOG_LOCK_VA_113C])

      // Lock != 0, default pVaList=0 with "%d" -> reads enabled, does NOT read u32(1) or u32(0x2000)
      u32Reads.length = 0
      m.setU32(D2COMMON_LOG_LOCK_VA_113C, 1)
      m.loadBlock(0x1000, new Uint8Array([0x61, 0x00]))
      m.loadBlock(0x2000, new Uint8Array([0x25, 0x64, 0x00])) // "%d\0"
      m.setU32(0x3000, 0xdeadbeef)
      LOGGING_WriteLockedEntry113c(m, 1, 2, 3, 4, 0x1000, 10, 0x2000)
      expect(u32Reads).not.toContain(1)
      expect(u32Reads).not.toContain(0x2000)

      // Lock != 0, explicit pVaList=0x3000 -> reads u32(0x3000), not u32(0x2000)
      u32Reads.length = 0
      LOGGING_WriteLockedEntry113c(m, 1, 2, 3, 4, 0x1000, 10, 0x2000, 0x3000)
      expect(u32Reads).toContain(0x3000)
      expect(u32Reads).not.toContain(0x2000)
    }

    // 2. UNITFINDS_MatchUnitCandidate113c (0x6FD624E0): exact distance == range^2 (3^2+4^2 == 5^2)
    {
      const baseRec = records.find((r) => r.va.toUpperCase() === '0X6FD624E0' && r.caseIndex === 2)!
      const m = new SparseMemory113c()
      for (const blk of baseRec.inputs.memory) m.loadBlock(parseU32(blk.base), hexToBytes(blk.hex))
      const pCand = parseU32(baseRec.inputs.args[0]!)
      const pSearch = parseU32(baseRec.inputs.args[1]!)
      const pPath = m.u32((pCand + 0x2c) >>> 0)
      m.setU16((pPath + 0x02) >>> 0, 23) // dx = 3 (23 - 20)
      m.setU16((pPath + 0x06) >>> 0, 24) // dy = 4 (24 - 20)
      m.setU32((pSearch + 0x14) >>> 0, 5) // range = 5 -> 9 + 16 == 25
      expect(UNITFINDS_MatchUnitCandidate113c(m, pCand, pSearch)).toBe(1)
    }

    // 3. INVENTORY_GetItemFromBodyLocMemPort113c (bodyLoc == 0), INVENTORY_GetCompositWeaponMemPort113c, INVENTORY_GetWeaponByHandSlotMemPort113c
    {
      const baseRec = records.find((r) => r.va.toUpperCase() === '0X6FD70830' && r.caseIndex === 1)!
      const m = new SparseMemory113c()
      for (const blk of baseRec.inputs.memory) m.loadBlock(parseU32(blk.base), hexToBytes(blk.hex))
      const pInv = parseU32(baseRec.inputs.args[0]!)
      const pGrid0 = m.u32((pInv + 0x14) >>> 0)
      const ppItems = m.u32((pGrid0 + 0x0c) >>> 0)
      const pRight = m.u32((ppItems + 0x10) >>> 0)
      const pLeft = m.u32((ppItems + 0x14) >>> 0)
      // bodyLoc == 0
      m.setU32(ppItems, pRight)
      expect(INVENTORY_GetItemFromBodyLocMemPort113c(m, pInv, 0)).toBe(pRight)
      m.setU32(ppItems, 0)
      // CompositWeapon: inv+0x1c vs inv+0x20
      m.setU32((pInv + 0x20) >>> 0, 0xffffffff)
      expect(INVENTORY_GetCompositWeaponMemPort113c(m, pInv)).toBe(pLeft)
      // WeaponByHandSlot: item at off=0x2c (slot 11) must be ignored
      m.setU32((ppItems + 0x10) >>> 0, 0)
      m.setU32((ppItems + 0x14) >>> 0, 0)
      m.setU32((ppItems + 0x2c) >>> 0, pRight)
      expect(INVENTORY_GetWeaponByHandSlotMemPort113c(m, pInv, 5)).toBe(0)
    }

    // 4. ITEMS_CheckItemTypeIdMemPort113c (nItemType == 0) & ITEMS_CheckIfThrowItemMemPort113c (nType == count)
    {
      const baseRec = records.find((r) => r.va.toUpperCase() === '0X6FD74430' && r.caseIndex === 3)!
      const m = new SparseMemory113c()
      for (const blk of baseRec.inputs.memory) m.loadBlock(parseU32(blk.base), hexToBytes(blk.hex))
      const pItem = parseU32(baseRec.inputs.args[0]!)
      const sgpt = m.u32(0x6fde9e1c)
      const pEquiv = m.u32((sgpt + 0xc04) >>> 0)
      m.setU32((pEquiv + 30 * 12) >>> 0, 1) // type 30 (0x1E) matches type 0 (bit 0)
      expect(ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0)).toBe(1)

      // ITEMS_CheckIfThrowItemMemPort113c: nType == count (boundary)
      const recThrowItem = records.find((r) => r.va.toUpperCase() === '0X6FD74C30' && r.caseIndex === 5)!
      const mThrow = new SparseMemory113c()
      for (const blk of recThrowItem.inputs.memory) mThrow.loadBlock(parseU32(blk.base), hexToBytes(blk.hex))
      const pThrowItem = parseU32(recThrowItem.inputs.args[0]!)
      const sgptThrow = mThrow.u32(0x6fde9e1c)
      mThrow.setU32((sgptThrow + 0xbfc) >>> 0, 44) // count == 44 == nType
      expect(ITEMS_CheckIfThrowItemMemPort113c(mThrow, pThrowItem)).toBe(0)
    }

    // 5. ITEMS_GetRepairAllCost113c (0x6FD7A210): slotOff == 0x34 boundary & ethereal item (CanBeRepaired==0 && CanLoseDurability==1)
    {
      const baseRec = records.find((r) => r.va.toUpperCase() === '0X6FD7A210' && r.caseIndex === 3)!
      const m = new SparseMemory113c()
      for (const blk of baseRec.inputs.memory) m.loadBlock(parseU32(blk.base), hexToBytes(blk.hex))
      const pGame = parseU32(baseRec.inputs.args[0]!)
      const pUnit = parseU32(baseRec.inputs.args[1]!)
      const pQuestRec = parseU32(baseRec.inputs.args[4]!)
      const pInv = m.u32((pUnit + 0x60) >>> 0)
      const pGrid0 = m.u32((pInv + 0x14) >>> 0)
      const ppItems = m.u32((pGrid0 + 0x0c) >>> 0)
      const pItem = m.u32((ppItems + 0x10) >>> 0)
      m.setU32((ppItems + 0x0c) >>> 0, 0) // clear slot 3 so only pItem is tested
      // Move item to slotOff = 0x34 (out of bounds of 0..0x30) -> cost must be 0
      m.setU32((ppItems + 0x10) >>> 0, 0)
      m.setU32((ppItems + 0x34) >>> 0, pItem)
      expect(ITEMS_GetRepairAllCost113c(m, pGame, pUnit, 148, 0, pQuestRec, 0)).toBe(0)
      // Put back at 0x10, mark ethereal (0x00400000 at pItemData+0x18) -> CanBeRepaired==0, cost must be 0
      m.setU32((ppItems + 0x34) >>> 0, 0)
      m.setU32((ppItems + 0x10) >>> 0, pItem)
      const pItemData = m.u32((pItem + 0x14) >>> 0)
      m.setU32((pItemData + 0x18) >>> 0, 0x00400010)
      expect(ITEMS_GetRepairAllCost113c(m, pGame, pUnit, 148, 0, pQuestRec, 0)).toBe(0)
    }

    // 6. STATLIST_EnumerateCopyListStats113c (default memory recorder), STATLIST_NotifyIfStatModified113c (pfnCb==0), STATLIST_SetFullStatEntry113c (pfOnValue==0)
    {
      const baseRec = records.find((r) => r.va.toUpperCase() === '0X6FD88850' && r.caseIndex === 3)!
      const m = new SparseMemory113c()
      for (const blk of baseRec.inputs.memory) m.loadBlock(parseU32(blk.base), hexToBytes(blk.hex))
      const pUnit = parseU32(baseRec.inputs.args[0]!)
      const pArg = parseU32(baseRec.inputs.args[1]!)
      STATLIST_EnumerateCopyListStats113c(m, pUnit, pArg, 1) // no cb -> uses internal memory writer
      expect(m.u32(pArg)).toBe(2)
      expect(m.u32((pArg + 4 + 8) >>> 0)).toBe(42)

      let called = false
      const pListEx = m.u32((pUnit + 0x5c) >>> 0)
      STATLIST_NotifyIfStatModified113c(m, pListEx, pUnit, 0, 0, () => {
        called = true
      })
      expect(called).toBe(false)

      const rec8940 = records.find((r) => r.va.toUpperCase() === '0X6FD88940' && r.caseIndex === 0)!
      const m2 = new SparseMemory113c()
      for (const blk of rec8940.inputs.memory) m2.loadBlock(parseU32(blk.base), hexToBytes(blk.hex))
      const pList2 = parseU32(rec8940.inputs.args[0]!)
      const pIsc2 = parseU32(rec8940.inputs.args[3]!)
      const pOwner2 = parseU32(rec8940.inputs.args[4]!)
      m2.setU32((pList2 + 0x5c) >>> 0, 0) // pfOnValue == 0
      let cb4Called = false
      STATLIST_SetFullStatEntry113c(m2, pList2, 0x00000000, 123, pIsc2, pOwner2, () => {
        cb4Called = true
      })
      expect(cb4Called).toBe(false)
    }

    // 7. STATLIST_AddUnitStatMemPort113c, STATLIST_ExpireStateListsOnModeChangeMemPort113c, DUNGEON_AllocActiveRoom113c, SKILLS_GetThrowingWeaponMasteryBonus113c
    {
      const m = new SparseMemory113c()
      m.setU32(0x5c, 0x2000) // if u===0 check is mutated to u===1, reads m.u32(0x5c)
      m.setU32(0x2000 + 0x24, 0x3000)
      m.setU16(0x2000 + 0x28, 0)
      m.setU16(0x2000 + 0x2a, 4)
      expect(STATLIST_AddUnitStatMemPort113c(m, 0, 0, 10, 0)).toBe(0)
      expect(m.u16(0x2000 + 0x28)).toBe(0)

      // ExpireStateListsOnModeChange: preserves bit 0x01 when clearing 0x02, and does not expire when 0x02 is unset
      const recExp = records.find((r) => r.va.toUpperCase() === '0X6FD8AE60' && r.caseIndex === 2)!
      const mExp = new SparseMemory113c()
      for (const blk of recExp.inputs.memory) mExp.loadBlock(parseU32(blk.base), hexToBytes(blk.hex))
      const pUnitExp = parseU32(recExp.inputs.args[0]!)
      const pListEx = mExp.u32((pUnitExp + 0x5c) >>> 0)
      mExp.setU32((pListEx + 0x10) >>> 0, 0x80000000) // 0x02 unset -> must not expire sublist
      STATLIST_ExpireStateListsOnModeChangeMemPort113c(mExp, pUnitExp)
      expect(mExp.u32((pListEx + 0x3c) >>> 0)).not.toBe(0)
      mExp.setU32((pListEx + 0x10) >>> 0, 0x80000003) // 0x01 | 0x02 -> must leave 0x80000001
      STATLIST_ExpireStateListsOnModeChangeMemPort113c(mExp, pUnitExp)
      expect(mExp.u32((pListEx + 0x10) >>> 0)).toBe(0x80000001)

      // DUNGEON_AllocActiveRoom113c: pRoomEx == 0 throws line 281
      expect(() => DUNGEON_AllocActiveRoom113c(m, 0x1000, 0, 0, 0, 0, 0)).toThrowError(
        D2CommonAssertError,
      )

      // SKILLS_GetThrowingWeaponMasteryBonus113c: default pbThrowing=0 does not write to addr 1, and nType == count returns null
      const recThrow = records.find((r) => r.va.toUpperCase() === '0X6FD9F200' && r.caseIndex === 3)!
      const mTh = new SparseMemory113c()
      for (const blk of recThrow.inputs.memory) mTh.loadBlock(parseU32(blk.base), hexToBytes(blk.hex))
      mTh.setU32(1, 0x11223344)
      expect(
        SKILLS_GetThrowingWeaponMasteryBonus113c(
          mTh,
          parseU32(recThrow.inputs.args[0]!),
          parseU32(recThrow.inputs.args[1]!),
          parseU32(recThrow.inputs.args[2]!),
          0,
        ),
      ).toBe(25)
      expect(mTh.u32(1)).toBe(0x11223344)
      const sgptTh = mTh.u32(0x6fde9e1c)
      mTh.setU32((sgptTh + 0xbfc) >>> 0, 44) // count == 44 == nType
      expect(
        SKILLS_GetThrowingWeaponMasteryBonus113c(
          mTh,
          parseU32(recThrow.inputs.args[0]!),
          parseU32(recThrow.inputs.args[1]!),
          parseU32(recThrow.inputs.args[2]!),
          0,
        ),
      ).toBe(null)
    }
  })
})
