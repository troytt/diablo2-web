/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 21: `indirectUnknown` Batch C — 14 VAs).
 *
 * Audits and verifies all 14 `indirectUnknown` `D2Game.dll` (`0x6FC20000`) functions across 3 disjoint shards:
 * - `src/d2kern-113c/game/k2-w4b4-113c.ts` (1 VA: `0x6FC89970` — `static_table`)
 * - `src/d2kern-113c/game/k2-w14b1-113c.ts` (6 VAs: `0x6FC6B7F0` — `caller_callback`; `0x6FC7C9E0`, `0x6FC86CE0`, `0x6FC87000`, `0x6FC88920`, `0x6FCDAA50` — `vtable_or_struct_table`)
 * - `src/d2kern-113c/game/k2-w15b1-113c.ts` (7 VAs: `0x6FC56890`, `0x6FCE8050`, `0x6FD089A0`, `0x6FD08B60`, `0x6FD08FE0`, `0x6FD09600`, `0x6FD0A140` — `vtable_or_struct_table`)
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading/trailing opcode, size, and indirect-site opcode verification in `D2Game.dll`,
 *    plus full validation of `tools/oracle/callgraph/indirect-audit-batchC.json` against raw PE32 `.text`/`.data` proofs.
 * 2. Dedicated behavioral differential regression tests proving every real 1.13c binary discrepancy fixed in Wave 21.
 * 3. Live execution of all 14 VAs (and their resolved indirect targets) under `beginVaTrace113c()` / `endVaTrace113c()`
 *    asserting 14/14 (100%) live trace coverage.
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  INVENTORY_PlaceItemInBodyLoc113c,
  INVENTORY_SIGNATURE_113C,
} from '../../../src/d2kern-113c/common/inventory.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  STATLIST_CreateEx113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { GAME_AllocGameStrc113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c,
  ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c,
  ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c,
  ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c,
  ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c,
  CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c,
} from '../../../src/d2kern-113c/game/k2-w14b1-113c.ts'
import {
  ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c,
  ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c,
  ACT3Q2_OnNpcSpeechComplete_6FD09600_113c,
  ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c,
  ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c,
  ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c,
  D2GAME_SCRATCH_W15B1_113C,
  QUESTS_OnBossActChangeOrBossKill_6FC56890_113c,
} from '../../../src/d2kern-113c/game/k2-w15b1-113c.ts'
import {
  OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c,
} from '../../../src/d2kern-113c/game/k2-w4b4-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '../../..')
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools/oracle/callgraph/manifest-113c.json')
const AUDIT_PATH = path.join(REPO_ROOT, 'tools/oracle/callgraph/indirect-audit-batchC.json')
const D2_DATA_DIR = process.env.D2_DATA_DIR || path.join(os.homedir(), 'd2-data')

interface Wave21VaSpec {
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
  readonly kernFile: string
  readonly category: 'static_table' | 'vtable_or_struct_table' | 'caller_callback'
}

interface IndirectSiteAudit {
  readonly iva: string
  readonly mnemonic: string
  readonly operands: string
  readonly opcodeHex: string
  readonly category: 'static_table' | 'vtable_or_struct_table' | 'caller_callback'
  readonly tableBase: string | null
  readonly tableEnd: string | null
  readonly targetVas: readonly string[]
  readonly proof: string
}

interface IndirectAuditEntry {
  readonly va: string
  readonly name: string
  readonly tsSymbol: string
  readonly kernFile: string
  readonly size: number
  readonly category: 'static_table' | 'vtable_or_struct_table' | 'caller_callback'
  readonly tableBase: string | null
  readonly tableEnd: string | null
  readonly targetVas: readonly string[]
  readonly indirectSites: readonly IndirectSiteAudit[]
  readonly proof: string
}

interface IndirectAuditFile {
  readonly batch: string
  readonly module: string
  readonly imageBase: string
  readonly count: number
  readonly categoryCounts: {
    readonly static_table: number
    readonly vtable_or_struct_table: number
    readonly caller_callback: number
  }
  readonly entries: readonly IndirectAuditEntry[]
}

const WAVE21_INDC_SPECS: readonly Wave21VaSpec[] = [
  {
    va: '0x6FC56890',
    size: 764,
    headHex: '83ec2453558b6c24',
    tailHex: '83c424c20400',
    tsSymbol: 'QUESTS_OnBossActChangeOrBossKill_6FC56890_113c',
    kernFile: 'src/d2kern-113c/game/k2-w15b1-113c.ts',
    category: 'vtable_or_struct_table',
  },
  {
    va: '0x6FC6B7F0',
    size: 1228,
    headHex: '83ec1c53558b6c24',
    tailHex: 'd0e9bffeffff',
    tsSymbol: 'CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c',
    kernFile: 'src/d2kern-113c/game/k2-w14b1-113c.ts',
    category: 'caller_callback',
  },
  {
    va: '0x6FC7C9E0',
    size: 591,
    headHex: '81ec8c0000005355',
    tailHex: 'c48c000000c3',
    tsSymbol: 'ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c',
    kernFile: 'src/d2kern-113c/game/k2-w14b1-113c.ts',
    category: 'vtable_or_struct_table',
  },
  {
    va: '0x6FC86CE0',
    size: 795,
    headHex: '81ec8c0000005355',
    tailHex: 'c48c000000c3',
    tsSymbol: 'ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c',
    kernFile: 'src/d2kern-113c/game/k2-w14b1-113c.ts',
    category: 'vtable_or_struct_table',
  },
  {
    va: '0x6FC87000',
    size: 515,
    headHex: '81ec880000005355',
    tailHex: 'c488000000c3',
    tsSymbol: 'ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c',
    kernFile: 'src/d2kern-113c/game/k2-w14b1-113c.ts',
    category: 'vtable_or_struct_table',
  },
  {
    va: '0x6FC88920',
    size: 390,
    headHex: '81ec840000005355',
    tailHex: 'c484000000c3',
    tsSymbol: 'ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c',
    kernFile: 'src/d2kern-113c/game/k2-w14b1-113c.ts',
    category: 'vtable_or_struct_table',
  },
  {
    va: '0x6FC89970',
    size: 266,
    headHex: '5356578bf2568bd9',
    tailHex: 'd26f5f5e5bc3',
    tsSymbol: 'OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c',
    kernFile: 'src/d2kern-113c/game/k2-w4b4-113c.ts',
    category: 'static_table',
  },
  {
    va: '0x6FCDAA50',
    size: 409,
    headHex: '81ec840000005355',
    tailHex: 'c484000000c3',
    tsSymbol: 'ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c',
    kernFile: 'src/d2kern-113c/game/k2-w14b1-113c.ts',
    category: 'vtable_or_struct_table',
  },
  {
    va: '0x6FCE8050',
    size: 1317,
    headHex: '81ecac0000005355',
    tailHex: 'c4ac000000c3',
    tsSymbol: 'ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c',
    kernFile: 'src/d2kern-113c/game/k2-w15b1-113c.ts',
    category: 'vtable_or_struct_table',
  },
  {
    va: '0x6FD089A0',
    size: 441,
    headHex: '51535556578bfa66',
    tailHex: '5f5e5d5b59c3',
    tsSymbol: 'ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c',
    kernFile: 'src/d2kern-113c/game/k2-w15b1-113c.ts',
    category: 'vtable_or_struct_table',
  },
  {
    va: '0x6FD08B60',
    size: 840,
    headHex: '83ec0c535556578b',
    tailHex: '5d5b83c40cc3',
    tsSymbol: 'ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c',
    kernFile: 'src/d2kern-113c/game/k2-w15b1-113c.ts',
    category: 'vtable_or_struct_table',
  },
  {
    va: '0x6FD08FE0',
    size: 540,
    headHex: '83ec10535556578b',
    tailHex: '5d5b83c410c3',
    tsSymbol: 'ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c',
    kernFile: 'src/d2kern-113c/game/k2-w15b1-113c.ts',
    category: 'vtable_or_struct_table',
  },
  {
    va: '0x6FD09600',
    size: 736,
    headHex: '83ec0853558bea66',
    tailHex: '5d5b83c408c3',
    tsSymbol: 'ACT3Q2_OnNpcSpeechComplete_6FD09600_113c',
    kernFile: 'src/d2kern-113c/game/k2-w15b1-113c.ts',
    category: 'vtable_or_struct_table',
  },
  {
    va: '0x6FD0A140',
    size: 577,
    headHex: '515355568bf18b46',
    tailHex: '5d33c05b59c3',
    tsSymbol: 'ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c',
    kernFile: 'src/d2kern-113c/game/k2-w15b1-113c.ts',
    category: 'vtable_or_struct_table',
  },
]

function loadPeSectionMapper(dllPath: string, expectedBase: number) {
  const buf = fs.readFileSync(dllPath)
  const e_lfanew = buf.readUInt32LE(0x3c)
  const numSec = buf.readUInt16LE(e_lfanew + 6)
  const optSize = buf.readUInt16LE(e_lfanew + 20)
  const imageBase = buf.readUInt32LE(e_lfanew + 24 + 28)
  expect(imageBase).toBe(expectedBase)
  const secTable = e_lfanew + 24 + optSize
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
  const textSec = sections[0]!
  return {
    buf,
    textStart: imageBase + textSec.vaddr,
    textEnd: imageBase + textSec.vaddr + textSec.vsize,
    vaToFileOffset(va: number): number {
      const rva = va - imageBase
      for (const s of sections) {
        const span = Math.max(s.vsize, s.rawSize)
        if (rva >= s.vaddr && rva < s.vaddr + span) {
          return s.rawPtr + (rva - s.vaddr)
        }
      }
      throw new Error(`VA 0x${va.toString(16)} outside PE sections`)
    },
  }
}

function createWave21World(nDifficulty = 0) {
  const m = new SparseMemory113c()
  m.fill(0, 0x100, 0)
  m.fill(D2GAME_SCRATCH_W15B1_113C, 0x2000, 0)
  m.fill(0x6fd18000, 0x24000, 0)
  m.fill(0x6fdd6000, 0x24000, 0)

  const pDataTables = m.alloc(0x2000) >>> 0
  initD2GameGlobalsInMem113c(m, pDataTables)

  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  for (let i = 0; i < 32; i++) {
    m.setU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)

  const pDataTablesSlot = m.alloc(4) >>> 0
  m.setU32(pDataTablesSlot, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pDataTablesSlot)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)

  // ItemsTxt (16 records * 0x1A8)
  const pItemsTxt = m.alloc(16 * 0x1b0) >>> 0
  m.setU8((pItemsTxt + 0x10f) >>> 0, 1)
  m.setU8((pItemsTxt + 0x110) >>> 0, 1)
  m.setU32((pDataTables + 0xa78) >>> 0, pItemsTxt)
  m.setU32((pDataTables + 0xa80) >>> 0, pItemsTxt)
  m.setU32((pDataTables + 0xa84) >>> 0, 16)
  m.setU32(0x6fdefb94, 16)
  m.setU32(0x6fdefb98, pItemsTxt)

  // ObjectsTxt (16 records * 0x1C0)
  const pObjectsTxt = m.alloc(16 * 0x1c0) >>> 0
  m.setU32((pDataTables + 0xc98) >>> 0, pObjectsTxt)
  m.setU32((pDataTables + 0xc9c) >>> 0, 16)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 16)

  // LevelsTxt (140 records * 0x220)
  const pLevelsTxt = m.alloc(140 * 0x220) >>> 0
  m.setU32((pDataTables + 0x9c8) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0x9cc) >>> 0, 140)
  m.setU32((pDataTables + 0xbd8) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xbe0) >>> 0, 140)
  m.setU32((pDataTables + 0xc60) >>> 0, 1)
  m.setU32((pDataTables + 0xc64) >>> 0, 40)
  m.setU32((pDataTables + 0xc68) >>> 0, 75)
  m.setU32((pDataTables + 0xc6c) >>> 0, 103)
  m.setU32((pDataTables + 0xc70) >>> 0, 109)
  m.setU32((pDataTables + 0xc74) >>> 0, 137)

  // Body-location grid0 dimensions & ItemTypes equivalence table (type 45 = weapon)
  m.setU8(0x6fded378, 13)
  m.setU8(0x6fded379, 1)
  const pTypeEquiv = m.alloc(64 * 2 * 4) >>> 0
  m.setU32((pDataTables + 0xbfc) >>> 0, 64)
  m.setU32((pDataTables + 0xc00) >>> 0, 2)
  m.setU32((pDataTables + 0xc04) >>> 0, pTypeEquiv)
  m.setU32((pTypeEquiv + (2 * 45 + 1) * 4) >>> 0, 1 << (45 & 31))

  const pGame = GAME_AllocGameStrc113c(m) >>> 0
  m.setU8((pGame + 0x6d) >>> 0, nDifficulty & 0xff)
  m.setU32((pGame + 0x70) >>> 0, 1) // expansion flag
  m.setU16((pGame + 0x28) >>> 0, 0x1337) // wGameId
  // Always initialize non-zero RNG seeds (lo, hi) on game & objControl!
  m.setU32((pGame + 0x10e0) >>> 0, 0x12345679)
  m.setU32((pGame + 0x10e4) >>> 0, 0x0000029b)
  const pObjControl = m.alloc(0x40) >>> 0
  m.setU32(pObjControl, 0x2468ace1)
  m.setU32((pObjControl + 4) >>> 0, 0x00000137)
  m.setU32((pGame + 0x10f0) >>> 0, pObjControl)

  const pQuestCtrl = m.alloc(0x80) >>> 0
  m.setU32((pQuestCtrl + 0x08) >>> 0, 1)
  const pGlobalQuestFlags = QUESTRECORD_AllocRecord113c(m, 0) >>> 0
  m.setU32((pQuestCtrl + 0x0c) >>> 0, pGlobalQuestFlags)
  m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl)

  const pPlayer = m.alloc(0x100) >>> 0
  m.setU32(pPlayer, 0) // UNIT_PLAYER
  m.setU32((pPlayer + 0x04) >>> 0, 1) // Sorceress (non-0xFFFF)
  m.setU32((pPlayer + 0x0c) >>> 0, 101) // dwUnitId
  m.setU32((pPlayer + 0x20) >>> 0, 0x13579bdf) // non-zero unit seed lo
  m.setU32((pPlayer + 0x24) >>> 0, 0x0000029a) // non-zero unit seed hi
  m.setU32((pPlayer + 0x80) >>> 0, pGame)
  STATLIST_CreateEx113c(m, pPlayer, 1, pGame)

  const pPlayerData = m.alloc(0xc0) >>> 0
  m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0) >>> 0
  m.setU32((pPlayerData + 0x10 + (nDifficulty << 2)) >>> 0, pQuestFlags)

  const pIntro = m.alloc(0x10) >>> 0
  const pIntroBits = QUESTRECORD_AllocRecord113c(m, 0) >>> 0
  m.setU32((pIntro + 0x04) >>> 0, pIntroBits)
  m.setU32((pPlayerData + 0x60) >>> 0, pIntro)

  const pClient = m.alloc(0x520) >>> 0
  m.setU32(pClient, 1)
  m.setU32((pClient + 0x1a8) >>> 0, pGame)
  m.setU32((pClient + 0x1bc) >>> 0, m.alloc(0x410) >>> 0)
  m.setU32((pPlayerData + 0x9c) >>> 0, pClient)

  const pInv = m.alloc(0x60) >>> 0
  m.setU32(pInv, INVENTORY_SIGNATURE_113C)
  m.setU32((pInv + 0x08) >>> 0, pPlayer)
  m.setU32((pInv + 0x1c) >>> 0, 0xffffffff)
  m.setU32((pPlayer + 0x60) >>> 0, pInv)

  // Place player into a room so UNITS_GetRoom works
  const pRoom = m.alloc(0x80) >>> 0
  const pRoomEx = m.alloc(0x80) >>> 0
  const pLevel = m.alloc(0x200) >>> 0
  const pDrlg = m.alloc(0x500) >>> 0
  m.setU32((pLevel + 0x1d0) >>> 0, 40) // Act 2 Town (Lut Gholein)
  m.setU32((pLevel + 0x1b4) >>> 0, pDrlg) // pDrlg
  m.setU32((pDrlg + 0x47c) >>> 0, pLevel) // pLevel head
  m.setU32(pRoomEx, pLevel)
  m.setU32((pRoomEx + 0x10) >>> 0, pLevel)
  m.setU32((pRoomEx + 0x58) >>> 0, pLevel) // D2RoomExStrc.pLevel (+0x58)
  m.setU32(pRoom, pRoomEx)
  m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
  const pPath = m.alloc(0x80) >>> 0
  m.setU16((pPath + 0x02) >>> 0, 100)
  m.setU16((pPath + 0x06) >>> 0, 100)
  m.setU32((pPath + 0x1c) >>> 0, pRoom)
  m.setU32((pPlayer + 0x2c) >>> 0, pPath)
  m.setU32((pGame + 0x1d2c) >>> 0, m.alloc(0x20) >>> 0) // pPartyControl
  // Link pPlayer into pGame unit hash bucket 0 (UNIT_PLAYER, guid=101)
  m.setU32((pGame + 0x1120 + ((101 & 0x7f) << 2)) >>> 0, pPlayer)

  return {
    m,
    pDataTables,
    pItemsTxt,
    pObjectsTxt,
    pLevelsTxt,
    pGame,
    pQuestCtrl,
    pGlobalQuestFlags,
    pPlayer,
    pPlayerData,
    pQuestFlags,
    pClient,
    pInv,
    pRoom,
    pRoomEx,
    pLevel,
    pPath,
  }
}

function allocQuestItemUnit(
  m: SparseMemory113c,
  pItemsTxt: number,
  classId: number,
  dwBaseCode: number,
  guid: number,
): number {
  m.setU32((pItemsTxt + classId * 0x1a8 + 0x80) >>> 0, dwBaseCode >>> 0)
  const pItem = m.alloc(0x100) >>> 0
  m.setU32(pItem, 4) // UNIT_ITEM
  m.setU32((pItem + 0x04) >>> 0, classId >>> 0)
  m.setU32((pItem + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pItem + 0x20) >>> 0, 0x76543211)
  m.setU32((pItem + 0x24) >>> 0, 0x00000123)
  const pItemData = m.alloc(0x80) >>> 0
  m.setU32((pItem + 0x14) >>> 0, pItemData)
  const pItemPath = m.alloc(0x20) >>> 0
  m.setU32((pItem + 0x2c) >>> 0, pItemPath)
  return pItem
}

function linkQuestItemInInventory(m: SparseMemory113c, pInv: number, pItem: number): void {
  const prevFirst = m.u32((pInv + 0x0c) >>> 0) >>> 0
  const pItemData = m.u32((pItem + 0x14) >>> 0) >>> 0
  m.setU32((pItemData + 0x64) >>> 0, prevFirst)
  m.setU32((pInv + 0x0c) >>> 0, pItem)
  if (m.u32((pInv + 0x10) >>> 0) === 0) {
    m.setU32((pInv + 0x10) >>> 0, pItem)
  }
}

function readCString(m: SparseMemory113c, addr: number, maxLen = 64): string {
  let out = ''
  for (let i = 0; i < maxLen; i++) {
    const ch = m.u8((addr + i) >>> 0)
    if (ch === 0) break
    out += String.fromCharCode(ch)
  }
  return out
}

describe('Wave 21 (indirectUnknown Batch C — 14 D2Game VAs): 1:1 PE32 audit & differential suite', () => {
  it('1. verifies PE32 opcode/size, indirect-site bytes, and tools/oracle/callgraph/indirect-audit-batchC.json proofs for all 14 VAs', () => {
    const dllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    const pe = loadPeSectionMapper(dllPath, 0x6fc20000)
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as {
      functions: Array<{
        module: string
        va: string
        size: number
        tsSymbol?: string
        kernFile?: string
      }>
    }
    const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8')) as IndirectAuditFile

    expect(audit.batch).toBe('wave21-indC')
    expect(audit.module).toBe('D2Game')
    expect(audit.imageBase).toBe('0x6FC20000')
    expect(audit.count).toBe(14)
    expect(audit.entries.length).toBe(14)
    expect(audit.categoryCounts).toEqual({
      static_table: 1,
      vtable_or_struct_table: 12,
      caller_callback: 1,
    })

    const byVa = new Map<string, (typeof manifest.functions)[number]>()
    for (const fn of manifest.functions) {
      if (fn.module === 'D2Game') {
        byVa.set(fn.va.toUpperCase(), fn)
      }
    }
    const auditByVa = new Map<string, IndirectAuditEntry>()
    for (const entry of audit.entries) {
      auditByVa.set(entry.va.toUpperCase(), entry)
    }

    for (const spec of WAVE21_INDC_SPECS) {
      const vaNum = Number.parseInt(spec.va, 16) >>> 0
      const fileOff = pe.vaToFileOffset(vaNum)
      const head = pe.buf.subarray(fileOff, fileOff + 8).toString('hex')
      const tail = pe.buf.subarray(fileOff + spec.size - 6, fileOff + spec.size).toString('hex')
      expect(head, `${spec.va} headHex`).toBe(spec.headHex)
      expect(tail, `${spec.va} tailHex`).toBe(spec.tailHex)

      const mfn = byVa.get(spec.va.toUpperCase())
      expect(mfn, `${spec.va} in manifest`).toBeDefined()
      expect(mfn!.size).toBe(spec.size)
      expect(mfn!.tsSymbol).toBe(spec.tsSymbol)
      expect(mfn!.kernFile).toBe(spec.kernFile)

      const ae = auditByVa.get(spec.va.toUpperCase())
      expect(ae, `${spec.va} in indirect-audit-batchC.json`).toBeDefined()
      expect(ae!.category).toBe(spec.category)
      expect(ae!.tsSymbol).toBe(spec.tsSymbol)
      expect(ae!.kernFile).toBe(spec.kernFile)
      expect(ae!.size).toBe(spec.size)
      expect(ae!.proof.length).toBeGreaterThan(20)
      expect(ae!.indirectSites.length).toBeGreaterThanOrEqual(1)

      for (const site of ae!.indirectSites) {
        const ivaNum = Number.parseInt(site.iva, 16) >>> 0
        expect(ivaNum).toBeGreaterThanOrEqual(vaNum)
        expect(ivaNum).toBeLessThan(vaNum + spec.size)
        const siteOff = pe.vaToFileOffset(ivaNum)
        const opLen = site.opcodeHex.length / 2
        const actualOp = pe.buf.subarray(siteOff, siteOff + opLen).toString('hex')
        expect(actualOp, `${spec.va} indirect site ${site.iva} opcodeHex`).toBe(site.opcodeHex)
        expect(site.proof.length).toBeGreaterThan(20)

        for (const tvaStr of site.targetVas) {
          const tva = Number.parseInt(tvaStr, 16) >>> 0
          expect(tva).toBeGreaterThanOrEqual(pe.textStart)
          expect(tva).toBeLessThan(pe.textEnd)
          expect(byVa.has(tvaStr.toUpperCase()), `target ${tvaStr} in manifest`).toBe(true)
        }
      }
    }

    // Verify 0x6FC89970 static_table 0x6FD27B8C..0x6FD27BB4 directly from D2Game.dll .data
    const trapAudit = auditByVa.get('0X6FC89970')!
    expect(trapAudit.tableBase).toBe('0x6FD27B8C')
    expect(trapAudit.tableEnd).toBe('0x6FD27BB4')
    const countVal = pe.buf.readUInt32LE(pe.vaToFileOffset(0x6fd27bb4))
    expect(countVal).toBe(10)
    const tableTargets = new Set<string>()
    for (let i = 0; i < countVal; i++) {
      const slotVal = pe.buf.readUInt32LE(pe.vaToFileOffset(0x6fd27b8c + i * 4)) >>> 0
      if (slotVal !== 0) {
        tableTargets.add(`0x${slotVal.toString(16).toUpperCase()}`)
      }
    }
    expect(Array.from(tableTargets).sort()).toEqual(Array.from(trapAudit.targetVas).sort())

    // Verify 0x6FC6B7F0 caller_callback proof: D2Game.#10048 @ 0x6FC4A33A = mov [0x6fd31c3c], eax (a3 3c 1c d3 6f)
    const writerOff = pe.vaToFileOffset(0x6fc4a33a)
    expect(pe.buf.subarray(writerOff, writerOff + 5).toString('hex')).toBe('a33c1cd36f')

    // Verify Quest Init Table at 0x6FD2DBF0 count [0x6FD2DF68] = 37 and key +0xAC/+0xF0 initializer immediates
    expect(pe.buf.readUInt32LE(pe.vaToFileOffset(0x6fd2df68))).toBe(37)
    // 0x6FC88087: mov dword ptr [esi+0xac], 0x6fc83dd0 (c7 86 ac 00 00 00 d0 3d c8 6f)
    expect(pe.buf.subarray(pe.vaToFileOffset(0x6fc88087), pe.vaToFileOffset(0x6fc88087) + 10).toString('hex')).toBe(
      'c786ac000000d03dc86f',
    )
    // 0x6FCE7519: mov dword ptr [esi+0xf0], 0x6fce21e0 (c7 86 f0 00 00 00 e0 21 ce 6f)
    expect(pe.buf.subarray(pe.vaToFileOffset(0x6fce7519), pe.vaToFileOffset(0x6fce7519) + 10).toString('hex')).toBe(
      'c786f0000000e021ce6f',
    )
    // 0x6FD0926D: mov dword ptr [esi+0xf0], 0x6fd02a40 (c7 86 f0 00 00 00 40 2a d0 6f)
    expect(pe.buf.subarray(pe.vaToFileOffset(0x6fd0926d), pe.vaToFileOffset(0x6fd0926d) + 10).toString('hex')).toBe(
      'c786f0000000402ad06f',
    )
  })

  it('2. 0x6FC56890 dispatches [pQuest6 + 0xAC] = 0x6FC83DD0 (real ACT1Q6_InitQuestData target) on Warriv (0x9B)', () => {
    const { m, pGame, pQuestCtrl, pPlayer, pQuestFlags } = createWave21World()
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 6, 0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 6, 0x0d)

    const pQuest4 = m.alloc(0x100) >>> 0
    const pQuest4Ext = m.alloc(0x80) >>> 0
    m.setU32(pQuest4, 4)
    m.setU32((pQuest4 + 0x04) >>> 0, pGame)
    m.setU8((pQuest4 + 0x0c) >>> 0, 6) // already past Cain-unrescued guard
    m.setU32((pQuest4 + 0x18) >>> 0, pQuest4Ext)
    m.setU32((pQuest4 + 0xe0) >>> 0, 4)

    const pQuest6 = m.alloc(0x100) >>> 0
    m.setU32(pQuest6, 6)
    m.setU32((pQuest6 + 0x04) >>> 0, pGame)
    m.setU8((pQuest6 + 0x09) >>> 0, 1) // bActive
    m.setU32((pQuest6 + 0x18) >>> 0, m.alloc(0x40) >>> 0)
    m.setU32((pQuest6 + 0xac) >>> 0, 0x6fc83dd0)
    m.setU32((pQuest6 + 0xf4) >>> 0, pQuest4)
    m.setU32(pQuestCtrl, pQuest6)

    const pWarriv = m.alloc(0x100) >>> 0
    m.setU32(pWarriv, 1)
    m.setU32((pWarriv + 0x04) >>> 0, 0x9b)

    beginVaTrace113c()
    QUESTS_OnBossActChangeOrBossKill_6FC56890_113c(m, pWarriv, pPlayer, pGame)
    const hits = endVaTrace113c()

    expect(hits.has('D2Game:0x6FC56890')).toBe(true)
    expect(hits.has('D2Game:0x6FC83DD0')).toBe(true)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 7, 0)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 7, 0x0d)).toBe(1)
  })

  it('3. 0x6FC6B7F0 uses STATLIST_GetUnitBaseStat (0x6FD88C20), preserves room-sync order, and enforces [[0x6FD31C3C]+4] asserts & callback', () => {
    const { m, pGame, pPlayer, pClient } = createWave21World()
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 42, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0d, 987654, 0)

    // Link client into pGame + 0x88 and link player into client + 0x16c/0x170/0x174
    m.setU32(pClient, 77) // dwClientId
    m.setU16((pClient + 0x0a) >>> 0, 0x0045)
    m.setU32((pClient + 0x60) >>> 0, 0x11223344)
    m.setU32((pClient + 0x16c) >>> 0, 0) // UNIT_PLAYER
    m.setU32((pClient + 0x170) >>> 0, 101) // dwPlayerUnitId
    m.setU32((pClient + 0x174) >>> 0, pPlayer)
    m.setU32((pClient + 0x178) >>> 0, 0x55667788)
    m.setU32((pGame + 0x88) >>> 0, pClient)
    m.setU32((pGame + 0x8c) >>> 0, 1)

    // Host callback table at 0x6FD31C3C with valid pfnLeaveGame
    const pCbTbl = m.alloc(0x20) >>> 0
    m.setU32((pCbTbl + 0x04) >>> 0, 0x00401234)
    m.setU32(0x6fd31c3c, pCbTbl)

    const leaveArgs: number[] = []
    beginVaTrace113c()
    CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c(
      m,
      77,
      pGame,
      0,
      () => {},
      (_mem, pfn, _p68, wGameId, dwClassId, dwBaseLvl, dwBaseExpLo) => {
        leaveArgs.push(pfn, wGameId, dwClassId, dwBaseLvl, dwBaseExpLo)
      },
    )
    const hits = endVaTrace113c()

    expect(hits.has('D2Game:0x6FC6B7F0')).toBe(true)
    expect(hits.has('D2Common:0x6FD88C20')).toBe(true) // STATLIST_GetUnitBaseStat
    expect(hits.has('D2Common:0x6FD8CC40')).toBe(true) // DUNGEON_SyncActiveRoomStatusChange
    expect(hits.has('D2Common:0x6FD8C810')).toBe(true) // DUNGEON_UpdateRoomLevelChange
    expect(leaveArgs).toEqual([0x00401234, 0x1337, 1, 42, 987654])
    expect(m.u32((pGame + 0x8c) >>> 0)).toBe(0)

    // Verify pPlayer === 0 path clears [pClient + 0x6c] = 0 and asserts 0x5ba when [[0x6FD31C3C]+4] === 0
    const pClient2 = m.alloc(0x520) >>> 0
    m.setU32(pClient2, 88)
    m.setU8((pClient2 + 0x6c) >>> 0, 0x41)
    m.setU32((pClient2 + 0x1a8) >>> 0, pGame)
    m.setU32((pGame + 0x88) >>> 0, pClient2)
    m.setU32((pGame + 0x8c) >>> 0, 1)
    m.setU32((pCbTbl + 0x04) >>> 0, 0)
    expect(() => CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c(m, 88, pGame, 0)).toThrow(
      D2CommonAssertError,
    )
    expect(m.u8((pClient2 + 0x6c) >>> 0)).toBe(0)
  })

  it('4. k2-w14b1 quest scroll callbacks (0x6FC7C9E0, 0x6FC86CE0, 0x6FC87000, 0x6FC88920, 0x6FCDAA50) fix swapped 6FC55EB0 args, debug string, and dispatch +0xF0', () => {
    const { m, pItemsTxt, pGame, pQuestCtrl, pPlayer, pQuestFlags, pInv } = createWave21World()

    // 4a. 0x6FC7C9E0 ACT5Q2 Qual-Kehk: 0x4E8E sets pQuest+0x0c=5 (not low mem 0x11) and calls 0x6FC76BD0
    const pQ52 = m.alloc(0x100) >>> 0
    m.setU32(pQ52, 0x20)
    m.setU32((pQ52 + 0x04) >>> 0, pGame)
    m.setU8((pQ52 + 0x0c) >>> 0, 2)
    m.setU32((pQ52 + 0x18) >>> 0, m.alloc(0xa0) >>> 0)
    m.setU32((pQ52 + 0xe0) >>> 0, 0x24)
    m.setU32((pQ52 + 0xf0) >>> 0, 0x6fc76bd0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 0x0d)
    const pArg52 = m.alloc(0x20) >>> 0
    m.setU32(pArg52, pGame)
    m.setU32((pArg52 + 0x0c) >>> 0, pPlayer)
    m.setU16((pArg52 + 0x14) >>> 0, 0x203)
    m.setU16((pArg52 + 0x18) >>> 0, 0x4e8e)
    const grantedRunes: number[] = []
    beginVaTrace113c()
    ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c(m, pQ52, pArg52, (_mem, _g, _p, code) => {
      grantedRunes.push(code)
      return 0x999001
    })
    const hits52 = endVaTrace113c()
    expect(hits52.has('D2Game:0x6FC7C9E0')).toBe(true)
    expect(hits52.has('D2Game:0x6FC76BD0')).toBe(true)
    expect(m.u8((pQ52 + 0x0c) >>> 0)).toBe(5)
    expect(m.u8(0x11)).toBe(0) // low memory untouched!
    expect(grantedRunes).toEqual([0x20373072, 0x20383072, 0x20393072])
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x24, 0)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x24, 1)).toBe(0)

    // 4b. 0x6FC86CE0 ACT1Q3 Akara 0x76 sets pQuest+0x0c=6 and dispatches 0x6FC846D0
    const pQ13 = m.alloc(0x100) >>> 0
    m.setU32(pQ13, 4)
    m.setU32((pQ13 + 0x04) >>> 0, pGame)
    m.setU8((pQ13 + 0x0c) >>> 0, 3)
    m.setU32((pQ13 + 0x18) >>> 0, m.alloc(0x160) >>> 0)
    m.setU32((pQ13 + 0xf0) >>> 0, 0x6fc846d0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 4, 1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 4, 0x0d)
    const pArg13 = m.alloc(0x20) >>> 0
    m.setU32(pArg13, pGame)
    m.setU32((pArg13 + 0x0c) >>> 0, pPlayer)
    m.setU16((pArg13 + 0x14) >>> 0, 0x94)
    m.setU16((pArg13 + 0x18) >>> 0, 0x76)
    beginVaTrace113c()
    ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c(m, pQ13, pArg13, undefined, () => 0x999002)
    const hits13 = endVaTrace113c()
    expect(hits13.has('D2Game:0x6FC86CE0')).toBe(true)
    expect(hits13.has('D2Game:0x6FC846D0')).toBe(true)
    expect(m.u8((pQ13 + 0x0c) >>> 0)).toBe(6)

    // 4c. 0x6FC87000 ACT1Q5 Charsi 0xA3: both path 1 (state==4 -> 0x6FC84AA0) and path 2 (chained qno=6 -> 0x6FC85410)
    const pHdm = allocQuestItemUnit(m, pItemsTxt, 1, 0x206d6468, 701)
    linkQuestItemInInventory(m, pInv, pHdm)
    const pQ15 = m.alloc(0x100) >>> 0
    const pQ15Ext = m.alloc(0xc0) >>> 0
    m.setU32(pQ15, 3)
    m.setU32((pQ15 + 0x04) >>> 0, pGame)
    m.setU8((pQ15 + 0x09) >>> 0, 1)
    m.setU8((pQ15 + 0x0c) >>> 0, 4)
    m.setU32((pQ15 + 0x10) >>> 0, 6)
    m.setU32((pQ15 + 0x18) >>> 0, pQ15Ext)
    m.setU32((pQ15 + 0xf0) >>> 0, 0x6fc84aa0)
    const pQ6 = m.alloc(0x100) >>> 0
    m.setU32(pQ6, 6)
    m.setU32((pQ6 + 0x04) >>> 0, pGame)
    m.setU32((pQ6 + 0xf0) >>> 0, 0x6fc85410)
    m.setU32(pQuestCtrl, pQ6)
    const pArg15 = m.alloc(0x20) >>> 0
    m.setU32(pArg15, pGame)
    m.setU32((pArg15 + 0x0c) >>> 0, pPlayer)
    m.setU16((pArg15 + 0x14) >>> 0, 0x9a)
    m.setU16((pArg15 + 0x18) >>> 0, 0xa3)
    beginVaTrace113c()
    ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c(m, pQ15, pArg15, () => {})
    const hits15a = endVaTrace113c()
    expect(hits15a.has('D2Game:0x6FC87000')).toBe(true)
    expect(hits15a.has('D2Game:0x6FC84AA0')).toBe(true)
    expect(m.u8((pQ15 + 0x0c) >>> 0)).toBe(5)

    // Path 2: state != 4 && pExt+0xa1 != 0 -> dispatches chained pQuest6+0xF0 = 0x6FC85410
    m.setU8((pQ15Ext + 0xa1) >>> 0, 1)
    beginVaTrace113c()
    ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c(m, pQ15, pArg15, () => {})
    const hits15b = endVaTrace113c()
    expect(hits15b.has('D2Game:0x6FC85410')).toBe(true)

    // 4d. 0x6FC88920 ACT1Q2 Kashya 0x5C sets pQuest+0x0c=5 and dispatches 0x6FC84E10
    const pQ12 = m.alloc(0x100) >>> 0
    m.setU32(pQ12, 2)
    m.setU32((pQ12 + 0x04) >>> 0, pGame)
    m.setU8((pQ12 + 0x0c) >>> 0, 3)
    m.setU32((pQ12 + 0x18) >>> 0, m.alloc(0x40) >>> 0)
    m.setU32((pQ12 + 0xe0) >>> 0, 2)
    m.setU32((pQ12 + 0xf0) >>> 0, 0x6fc84e10)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 2, 1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 2, 0x0d)
    const pArg12 = m.alloc(0x20) >>> 0
    m.setU32(pArg12, pGame)
    m.setU32((pArg12 + 0x0c) >>> 0, pPlayer)
    m.setU16((pArg12 + 0x14) >>> 0, 0x96)
    m.setU16((pArg12 + 0x18) >>> 0, 0x5c)
    beginVaTrace113c()
    ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c(m, pQ12, pArg12, () => {})
    const hits12 = endVaTrace113c()
    expect(hits12.has('D2Game:0x6FC88920')).toBe(true)
    expect(hits12.has('D2Game:0x6FC84E10')).toBe(true)
    expect(m.u8((pQ12 + 0x0c) >>> 0)).toBe(5)

    // 4e. 0x6FCDAA50 ACT4Q2 Cain 0x2A7 sets pQuest+0x0c=2; 0x2A8 sets pQuest+0x0c=5 and dispatches 0x6FCDA270
    const pQ42 = m.alloc(0x100) >>> 0
    m.setU32(pQ42, 0x18)
    m.setU32((pQ42 + 0x04) >>> 0, pGame)
    m.setU8((pQ42 + 0x0c) >>> 0, 1)
    m.setU32((pQ42 + 0x18) >>> 0, m.alloc(0x40) >>> 0)
    m.setU32((pQ42 + 0xe0) >>> 0, 0x1b)
    m.setU32((pQ42 + 0xf0) >>> 0, 0x6fcda270)
    const pArg42 = m.alloc(0x20) >>> 0
    m.setU32(pArg42, pGame)
    m.setU32((pArg42 + 0x0c) >>> 0, pPlayer)
    m.setU16((pArg42 + 0x14) >>> 0, 0xf6)
    m.setU16((pArg42 + 0x18) >>> 0, 0x2a7)
    ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c(m, pQ42, pArg42, () => 0x999003)
    expect(m.u8((pQ42 + 0x0c) >>> 0)).toBe(2)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1b, 1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1b, 0x0d)
    m.setU16((pArg42 + 0x18) >>> 0, 0x2a8)
    beginVaTrace113c()
    ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c(m, pQ42, pArg42)
    const hits42 = endVaTrace113c()
    expect(hits42.has('D2Game:0x6FCDAA50')).toBe(true)
    expect(hits42.has('D2Game:0x6FCDA270')).toBe(true)
    expect(m.u8((pQ42 + 0x0c) >>> 0)).toBe(5)
  })

  it('5. 0x6FC89970 static_table dispatches level-overrides to [0x6FD27B94]=0x6FC8B880 and direct slots from 0x6FD27B8C', () => {
    const { m, pGame, pRoom, pLevel } = createWave21World()
    const pObj = m.alloc(0x100) >>> 0
    const pObjData = m.alloc(0x40) >>> 0
    const pObjPath = m.alloc(0x40) >>> 0
    m.setU32(pObj, 2) // UNIT_OBJECT (uses D2StaticPathStrc: pRoom at +0x00)
    m.setU32((pObj + 0x14) >>> 0, pObjData)
    m.setU32((pObj + 0x2c) >>> 0, pObjPath)
    m.setU32(pObjPath, pRoom)

    let hit326 = 0
    let hitRand = 0

    // idx=8, level >= 0x4b (75) -> overrides to [0x6FD27B94] = 0x6FC8B880
    m.setU32((pLevel + 0x1d0) >>> 0, 75)
    m.setU8((pObjData + 0x04) >>> 0, 0x88) // & 0x7f = 8
    OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c(m, pGame, pObj, {
      onSpawnMonster326FromObject_6FC8B880: () => {
        hit326++
        return 1
      },
      onSpawnRandomMonsterTrapFromObject_6FC8A4E0: () => {
        hitRand++
      },
    })
    expect(hit326).toBe(1)
    expect(hitRand).toBe(0)

    // idx=8, level < 0x4b (40) -> direct slot [8] = 0x6FC8A4E0
    m.setU32((pLevel + 0x1d0) >>> 0, 40)
    OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c(m, pGame, pObj, {
      onSpawnMonster326FromObject_6FC8B880: () => {
        hit326++
        return 1
      },
      onSpawnRandomMonsterTrapFromObject_6FC8A4E0: () => {
        hitRand++
      },
    })
    expect(hitRand).toBe(1)

    // idx=3, level < 0x28 && != 0x19 (10) -> overrides to 0x6FC8B880
    m.setU32((pLevel + 0x1d0) >>> 0, 10)
    m.setU8((pObjData + 0x04) >>> 0, 3)
    OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c(m, pGame, pObj, {
      onSpawnMonster326FromObject_6FC8B880: () => {
        hit326++
        return 1
      },
    })
    expect(hit326).toBe(2)

    // idx=0 -> NULL slot asserts line 0x17b
    m.setU8((pObjData + 0x04) >>> 0, 0)
    expect(() => OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c(m, pGame, pObj)).toThrow(
      D2CommonAssertError,
    )

    // idx=10 (>= limit 10) -> no-op
    m.setU8((pObjData + 0x04) >>> 0, 10)
    expect(() => OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c(m, pGame, pObj)).not.toThrow()
  })

  it('6. 0x6FCE8050 matches PE32 switch table 0x6FCE8578, Jerhyn 0x1AE -> [pQuest0A+0xF0]=0x6FCE21E0, Jerhyn 0x1BA, and Meshif 0x1C2 bit-4 gate', () => {
    const { m, pGame, pQuestCtrl, pPlayer, pQuestFlags } = createWave21World()
    const pQuest = m.alloc(0x100) >>> 0
    const pState = m.alloc(0x80) >>> 0
    m.setU32(pQuest, 0x0d)
    m.setU32((pQuest + 0x04) >>> 0, pGame)
    m.setU32((pQuest + 0x18) >>> 0, pState)
    m.setU32((pQuest + 0xf0) >>> 0, 0x6fce6390)

    const pQuest0A = m.alloc(0x100) >>> 0
    m.setU32(pQuest0A, 0x0a)
    m.setU32((pQuest0A + 0x04) >>> 0, pGame)
    m.setU32((pQuest0A + 0xf0) >>> 0, 0x6fce21e0)
    m.setU32((pQuest + 0xf4) >>> 0, pQuest0A)
    m.setU32(pQuestCtrl, pQuest)

    const pArg = m.alloc(0x20) >>> 0
    m.setU32(pArg, pGame)
    m.setU32((pArg + 0x0c) >>> 0, pPlayer)

    // 6a. Exact switch jump table 0x6FCE8578 (town NPC 0x100)
    m.setU16((pArg + 0x14) >>> 0, 0x100)
    const expectedBits: ReadonlyArray<readonly [number, number | null]> = [
      [0x1bc, 9],
      [0x1bd, 6],
      [0x1be, 7],
      [0x1bf, 0x0b],
      [0x1c0, null],
      [0x1c1, 8],
      [0x1c4, 0x0a],
    ]
    for (const [msgId, bit] of expectedBits) {
      const pFreshFlags = QUESTRECORD_AllocRecord113c(m, 0) >>> 0
      const pPlayerData = m.u32((pPlayer + 0x14) >>> 0) >>> 0
      m.setU32((pPlayerData + 0x10) >>> 0, pFreshFlags)
      m.setU16((pArg + 0x18) >>> 0, msgId)
      ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c(m, pQuest, pArg)
      if (bit !== null) {
        expect(DRLGWARP_TestRoomTileBit113c(m, pFreshFlags, 0x0e, bit), `msg 0x${msgId.toString(16)} -> bit ${bit}`).toBe(1)
      } else {
        for (let b = 0; b < 16; b++) {
          expect(DRLGWARP_TestRoomTileBit113c(m, pFreshFlags, 0x0e, b)).toBe(0)
        }
      }
    }
    // Restore original pQuestFlags
    m.setU32((m.u32((pPlayer + 0x14) >>> 0) + 0x10) >>> 0, pQuestFlags)

    // 6b. Jerhyn (0xC9, 0x1AE): sets pQuest+0x0c=2, pState+8=1, pQuest+0xa8=0x6fce5a60, dispatches [pQuest0A+0xf0]=0x6FCE21E0
    m.setU32(0x6fd31c20, 1) // verify debug string format
    m.setU16((pArg + 0x14) >>> 0, 0xc9)
    m.setU16((pArg + 0x18) >>> 0, 0x1ae)
    beginVaTrace113c()
    ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c(m, pQuest, pArg)
    const hitsJerhyn = endVaTrace113c()
    expect(hitsJerhyn.has('D2Game:0x6FCE8050')).toBe(true)
    expect(hitsJerhyn.has('D2Game:0x6FCE21E0')).toBe(true)
    expect(m.u8((pQuest + 0x0c) >>> 0)).toBe(2)
    expect(m.u8((pState + 0x08) >>> 0)).toBe(1)
    expect(m.u32((pQuest + 0xa8) >>> 0)).toBe(0x6fce5a60)
    expect(readCString(m, D2GAME_SCRATCH_W15B1_113C)).toBe('changing state to 2\n')
    m.setU32(0x6fd31c20, 0)

    // 6c. Jerhyn (0xC9, 0x1BA): requires bit 3 -> sets bit 4 and clears bit 3
    m.setU16((pArg + 0x18) >>> 0, 0x1ba)
    ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c(m, pQuest, pArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 4)).toBe(0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0e, 3)
    ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c(m, pQuest, pArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 4)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 3)).toBe(0)

    // 6d. Meshif (0xD2, 0x1C2): requires bit 4 -> sets bit 0, clears bit 4
    m.setU16((pArg + 0x14) >>> 0, 0xd2)
    m.setU16((pArg + 0x18) >>> 0, 0x1c2)
    ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c(m, pQuest, pArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 4)).toBe(0)
  })

  it('7. Act 3 quest callbacks (0x6FD089A0, 0x6FD08B60, 0x6FD08FE0, 0x6FD09600, 0x6FD0A140) match 1.13c PE32 state machines and dispatch +0xF0', () => {
    const { m, pItemsTxt, pGame, pQuestCtrl, pGlobalQuestFlags, pPlayer, pQuestFlags, pInv } =
      createWave21World()

    // 7a. 0x6FD089A0 ACT3Q5 Cain (0xF5, 0x272) gates on bit 4 (not bit 1), sets state=7, dispatches 0x6FD02A40
    const pQ35 = m.alloc(0x100) >>> 0
    const pQ35State = m.alloc(0x60) >>> 0
    m.setU32(pQ35, 0x13)
    m.setU32((pQ35 + 0x04) >>> 0, pGame)
    m.setU32((pQ35 + 0x18) >>> 0, pQ35State)
    m.setU32((pQ35 + 0xf0) >>> 0, 0x6fd02a40)
    m.setU32(pQuestCtrl, pQ35)

    // Ormus (0xFF, 0x252): global 0x11 bit 0x0d == 1 -> state 2
    QUESTRECORD_SetQuestState113c(m, pGlobalQuestFlags, 0x11, 0x0d)
    const pArg35 = m.alloc(0x20) >>> 0
    m.setU32(pArg35, pGame)
    m.setU32((pArg35 + 0x0c) >>> 0, pPlayer)
    m.setU16((pArg35 + 0x14) >>> 0, 0xff)
    m.setU16((pArg35 + 0x18) >>> 0, 0x252)
    ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c(m, pQ35, pArg35)
    expect(m.u8((pQ35 + 0x0c) >>> 0)).toBe(2)
    expect(m.u8((pQ35State + 0x04) >>> 0)).toBe(1)

    // Cain (0xF5, 0x272): bit 4 + bit 0x0d -> state 7, dispatches 0x6FD02A40, sets bit 0, clears bit 4
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x15, 4)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x15, 0x0d)
    m.setU16((pArg35 + 0x14) >>> 0, 0xf5)
    m.setU16((pArg35 + 0x18) >>> 0, 0x272)
    beginVaTrace113c()
    ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c(m, pQ35, pArg35)
    const hits35 = endVaTrace113c()
    expect(hits35.has('D2Game:0x6FD089A0')).toBe(true)
    expect(hits35.has('D2Game:0x6FD02A40')).toBe(true)
    expect(m.u8((pQ35 + 0x0c) >>> 0)).toBe(7)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 4)).toBe(0)

    // 7b. 0x6FD08B60 ACT3Q1 Alkor (0xFE, 0x21A): clears bit 1, sets bits 0/0x0d/5, dispatches 0x6FD02B70
    const pQ31 = m.alloc(0x100) >>> 0
    m.setU32(pQ31, 0x12)
    m.setU32((pQ31 + 0x04) >>> 0, pGame)
    m.setU8((pQ31 + 0x09) >>> 0, 1)
    m.setU32((pQ31 + 0x18) >>> 0, m.alloc(0x40) >>> 0)
    m.setU32((pQ31 + 0xe0) >>> 0, 0x14)
    m.setU32((pQ31 + 0xf0) >>> 0, 0x6fd02b70)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x14, 1)
    const pArg31 = m.alloc(0x20) >>> 0
    m.setU32(pArg31, pGame)
    m.setU32((pArg31 + 0x0c) >>> 0, pPlayer)
    m.setU16((pArg31 + 0x14) >>> 0, 0xfe)
    m.setU16((pArg31 + 0x18) >>> 0, 0x21a)
    beginVaTrace113c()
    ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c(m, pQ31, pArg31, {
      createQuestRewardItem: () => 0x999004,
    })
    const hits31 = endVaTrace113c()
    expect(hits31.has('D2Game:0x6FD08B60')).toBe(true)
    expect(hits31.has('D2Game:0x6FD02B70')).toBe(true)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 0)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 5)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 1)).toBe(0)
    expect(m.u8((pQ31 + 0x0c) >>> 0)).toBe(5)

    // 7c. 0x6FD08FE0 ACT3Q4 Alkor (0xFE, 0x234): sets pQuest+0x0c=5 and dispatches 0x6FD02F00
    const pQ34 = m.alloc(0x100) >>> 0
    const pQ34State = m.alloc(0x40) >>> 0
    m.setU32(pQ34, 0x0f)
    m.setU32((pQ34 + 0x04) >>> 0, pGame)
    m.setU8((pQ34 + 0x09) >>> 0, 1)
    m.setU8((pQ34 + 0x0c) >>> 0, 3)
    m.setU32((pQ34 + 0x18) >>> 0, pQ34State)
    m.setU32((pQ34 + 0xf0) >>> 0, 0x6fd02f00)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x11, 0x0d)
    const pArg34 = m.alloc(0x20) >>> 0
    m.setU32(pArg34, pGame)
    m.setU32((pArg34 + 0x0c) >>> 0, pPlayer)
    m.setU16((pArg34 + 0x14) >>> 0, 0xfe)
    m.setU16((pArg34 + 0x18) >>> 0, 0x234)
    beginVaTrace113c()
    ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c(m, pQ34, pArg34)
    const hits34 = endVaTrace113c()
    expect(hits34.has('D2Game:0x6FD08FE0')).toBe(true)
    expect(hits34.has('D2Game:0x6FD02F00')).toBe(true)
    expect(m.u8((pQ34 + 0x0c) >>> 0)).toBe(5)
    expect(m.u8((pQ34 + 0x0b) >>> 0)).toBe(0x0d)

    // 7d. 0x6FD09600 ACT3Q2 Ormus (0xFF, 0x24B -> 0x6FD02D40), Ormus (0xFF, 0x251 -> bit 8), Asheara (0xFC, 0x24D -> bit 7 + complete)
    const pQ32 = m.alloc(0x100) >>> 0
    const pQ32State = m.alloc(0x40) >>> 0
    m.setU32(pQ32, 0x11)
    m.setU32((pQ32 + 0x04) >>> 0, pGame)
    m.setU8((pQ32 + 0x09) >>> 0, 1)
    m.setU8((pQ32 + 0x0c) >>> 0, 3)
    m.setU32((pQ32 + 0x18) >>> 0, pQ32State)
    m.setU32((pQ32 + 0xf0) >>> 0, 0x6fd02d40)
    const pG33 = allocQuestItemUnit(m, pItemsTxt, 2, 0x20333367, 702)
    linkQuestItemInInventory(m, pInv, pG33)
    m.setU32((pQ32State + 0x1c) >>> 0, 1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x13, 5)
    const pArg32 = m.alloc(0x20) >>> 0
    m.setU32(pArg32, pGame)
    m.setU32((pArg32 + 0x0c) >>> 0, pPlayer)
    m.setU16((pArg32 + 0x14) >>> 0, 0xff)
    m.setU16((pArg32 + 0x18) >>> 0, 0x24b)
    beginVaTrace113c()
    ACT3Q2_OnNpcSpeechComplete_6FD09600_113c(m, pQ32, pArg32, {
      deletePlayerQuestItem: () => {},
    })
    const hits32 = endVaTrace113c()
    expect(hits32.has('D2Game:0x6FD09600')).toBe(true)
    expect(hits32.has('D2Game:0x6FD02D40')).toBe(true)
    expect(m.u32((pQ32State + 0x1c) >>> 0)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 6)).toBe(1)
    expect(m.u8((pQ32 + 0x0c) >>> 0)).toBe(5)

    // Ormus 0x251 -> sets bit 8, grants rare ring
    let grantedRingIlvl = -1
    m.setU16((pArg32 + 0x18) >>> 0, 0x251)
    ACT3Q2_OnNpcSpeechComplete_6FD09600_113c(m, pQ32, pArg32, {
      createQuestRewardItem: (_mem, _g, _p, _code, ilvl) => {
        grantedRingIlvl = ilvl
        return 0x999005
      },
    })
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 8)).toBe(1)
    expect(grantedRingIlvl).toBe(0x15)

    // Asheara 0xFC, 0x24D -> sets bit 7 and since bit 8 is set, completes quest (bits 0x0d and 0)
    m.setU16((pArg32 + 0x14) >>> 0, 0xfc)
    m.setU16((pArg32 + 0x18) >>> 0, 0x24d)
    ACT3Q2_OnNpcSpeechComplete_6FD09600_113c(m, pQ32, pArg32, {
      hireAct3FreeMercenary: () => {},
    })
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 7)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0x0d)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0)).toBe(1)

    // 7e. 0x6FD0A140 ACT3Q5 Compelling Orb: propagates quest 0x15 bit 4 -> bit 0, dispatches [pQuest+0xF0]=0x6FD02A40, leaves pState+0x28 untouched
    const wOrb = createWave21World()
    const pOrbQuest = wOrb.m.alloc(0x100) >>> 0
    const pOrbState = wOrb.m.alloc(0x60) >>> 0
    wOrb.m.setU32(pOrbQuest, 0x13)
    wOrb.m.setU32((pOrbQuest + 0x04) >>> 0, wOrb.pGame)
    wOrb.m.setU32((pOrbQuest + 0x18) >>> 0, pOrbState)
    wOrb.m.setU32((pOrbQuest + 0xf0) >>> 0, 0x6fd02a40)
    wOrb.m.setU32((pOrbState + 0x28) >>> 0, 77)
    wOrb.m.setU32(wOrb.pQuestCtrl, pOrbQuest)
    QUESTRECORD_SetQuestState113c(wOrb.m, wOrb.pQuestFlags, 0x15, 4)

    wOrb.m.setU32((wOrb.pItemsTxt + 0x80) >>> 0, 0x20326671) // 'qf2 '
    wOrb.m.setU16((wOrb.pItemsTxt + 0x11e) >>> 0, 45)
    const pFlail = allocQuestItemUnit(wOrb.m, wOrb.pItemsTxt, 0, 0x20326671, 888)
    INVENTORY_PlaceItemInBodyLoc113c(wOrb.m, wOrb.pInv, pFlail, 4)
    wOrb.m.setU32((wOrb.pInv + 0x1c) >>> 0, 888)

    const pOrb = wOrb.m.alloc(0x100) >>> 0
    wOrb.m.setU32(pOrb, 2)
    wOrb.m.setU32((pOrb + 0x2c) >>> 0, wOrb.m.alloc(0x20) >>> 0)
    const pOpArg = wOrb.m.alloc(0x20) >>> 0
    wOrb.m.setU32(pOpArg, wOrb.pGame)
    wOrb.m.setU32((pOpArg + 0x04) >>> 0, pOrb)
    wOrb.m.setU32((pOpArg + 0x08) >>> 0, wOrb.pPlayer)

    ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c(wOrb.m, pOpArg, {
      deleteAllPlayerQuestItems: () => 1,
    })
    expect(wOrb.m.u32((pOrbState + 0x38) >>> 0)).toBe(1)

    beginVaTrace113c()
    ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c(wOrb.m, pOpArg, {
      deleteAllPlayerQuestItems: () => 1,
    })
    const hitsOrb = endVaTrace113c()
    expect(hitsOrb.has('D2Game:0x6FD0A140')).toBe(true)
    expect(hitsOrb.has('D2Game:0x6FD02A40')).toBe(true)
    expect(wOrb.m.u32((pOrbState + 0x28) >>> 0)).toBe(77) // untouched in 1.13c
    expect(DRLGWARP_TestRoomTileBit113c(wOrb.m, wOrb.pQuestFlags, 0x12, 0)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(wOrb.m, wOrb.pQuestFlags, 0x15, 0)).toBe(1)
  })

  it('8. live VA trace coverage hits 14 / 14 Wave 21 indirectUnknown Batch C VAs', () => {
    const w = createWave21World()
    const { m, pGame, pQuestCtrl, pPlayer, pQuestFlags, pRoom, pLevel } = w

    const pQuest = m.alloc(0x100) >>> 0
    const pState = m.alloc(0x160) >>> 0
    m.setU32(pQuest, 0x13)
    m.setU32((pQuest + 0x04) >>> 0, pGame)
    m.setU32((pQuest + 0x18) >>> 0, pState)
    m.setU32((pQuest + 0xf0) >>> 0, 0x6fd02a40)
    m.setU32(pQuestCtrl, pQuest)

    const pArg = m.alloc(0x20) >>> 0
    m.setU32(pArg, pGame)
    m.setU32((pArg + 0x0c) >>> 0, pPlayer)

    const pObj = m.alloc(0x100) >>> 0
    const pObjData = m.alloc(0x40) >>> 0
    const pObjPath = m.alloc(0x40) >>> 0
    m.setU32(pObj, 2)
    m.setU32((pObj + 0x14) >>> 0, pObjData)
    m.setU32((pObj + 0x2c) >>> 0, pObjPath)
    m.setU32((pObjPath + 0x1c) >>> 0, pRoom)
    m.setU32((pLevel + 0x1d0) >>> 0, 40)
    m.setU8((pObjData + 0x04) >>> 0, 8)

    const pOpArg = m.alloc(0x20) >>> 0
    m.setU32(pOpArg, pGame)
    m.setU32((pOpArg + 0x04) >>> 0, pObj)
    m.setU32((pOpArg + 0x08) >>> 0, pPlayer)

    beginVaTrace113c()
    QUESTS_OnBossActChangeOrBossKill_6FC56890_113c(m, 0, pPlayer, pGame)
    CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c(m, 999, pGame, 0)
    ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c(m, pQuest, pArg)
    ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c(m, pQuest, pArg)
    ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c(m, pQuest, pArg)
    ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c(m, pQuest, pArg)
    OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c(m, pGame, pObj, {
      onSpawnRandomMonsterTrapFromObject_6FC8A4E0: () => {},
    })
    ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c(m, pQuest, pArg)
    ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c(m, pQuest, pArg)
    ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c(m, pQuest, pArg)
    ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c(m, pQuest, pArg)
    ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c(m, pQuest, pArg)
    ACT3Q2_OnNpcSpeechComplete_6FD09600_113c(m, pQuest, pArg)
    ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c(m, pOpArg)
    const hits = endVaTrace113c()

    expect(pQuestFlags).toBeGreaterThan(0)
    const covered = WAVE21_INDC_SPECS.filter((s) => hits.has(`D2Game:${s.va}`))
    expect(covered.length).toBe(14)
    for (const spec of WAVE21_INDC_SPECS) {
      expect(hits.has(`D2Game:${spec.va}`), `live VA trace missing D2Game:${spec.va}`).toBe(true)
    }
  })
})
