/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 20: `indirectUnknown` Batch B, 11 VAs).
 *
 * Audits, classifies, and verifies all 11 Batch B `indirectUnknown` `D2Game.dll` (`0x6FC20000`) functions
 * across 6 disjoint TS modules:
 * - `0x6FC3BDF0` `AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c` (`k2-w5b1-113c.ts`)
 * - `0x6FC448A0` `MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c` (`k2-w4b1-113c.ts`)
 * - `0x6FC89E50` `OBJ_RollAndDispatchObjectEffectTable_6FC89E50_113c` (`k2-w3b7-113c.ts`)
 * - `0x6FC8A330` `OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c` (`k2-w3b7-113c.ts`)
 * - `0x6FC8DA00` `OBJ_OperateShrine_6FC8DA00_113c` (`k2-w3b7-113c.ts`)
 * - `0x6FC92220` `D2Game_6FC92220_113c` (`k2-w13b1-113c.ts`)
 * - `0x6FC96A50` `MONSTER_StartMode8CastA_6FC96A50_113c` (`k2-w3b7-113c.ts`)
 * - `0x6FC96B20` `MONSTER_StartMode8CastB_6FC96B20_113c` (`k2-w3b7-113c.ts`)
 * - `0x6FCBEDB0` `SKILLS_FindClosestUnitCallback_6FCBEDB0_113c` (`k2-w4b6-113c.ts`)
 * - `0x6FCBEEB0` `SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c` (`k2-w4b6-113c.ts`)
 * - `0x6FCDA5E0` `ACT4Q1_OnNpcMessage_6FCDA5E0_113c` (`k2-w8b2-113c.ts`)
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  D2CommonAssertError,
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { INVENTORY_AllocInventory113c } from '../../../src/d2kern-113c/common/inventory.ts'
import {
  ITEMS_GetCommandFlags113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetItemQuality113c,
} from '../../../src/d2kern-113c/common/items.ts'
import { QUESTRECORD_SetQuestState113c } from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import { D2Game_6FC92220_113c } from '../../../src/d2kern-113c/game/k2-w13b1-113c.ts'
import {
  MONSTER_StartMode8CastA_6FC96A50_113c,
  MONSTER_StartMode8CastB_6FC96B20_113c,
  OBJ_OperateShrine_6FC8DA00_113c,
  OBJ_RollAndDispatchObjectEffectTable_6FC89E50_113c,
  OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c,
} from '../../../src/d2kern-113c/game/k2-w3b7-113c.ts'
import { MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c } from '../../../src/d2kern-113c/game/k2-w4b1-113c.ts'
import {
  SKILLS_FindClosestUnitCallback_6FCBEDB0_113c,
  SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b6-113c.ts'
import { AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c } from '../../../src/d2kern-113c/game/k2-w5b1-113c.ts'
import { ACT4Q1_OnNpcMessage_6FCDA5E0_113c } from '../../../src/d2kern-113c/game/k2-w8b2-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2HoverTextStrc,
  D2ItemsTxt_SIZE,
  D2ItemTypesTxt_SIZE,
  D2LevelsTxt_SIZE,
  D2MonStats2Txt,
  D2MonStats2Txt_SIZE,
  D2MonStatsTxt,
  D2MonStatsTxt_SIZE,
  D2RoomExStrc,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  SGPT_INVENTORY_TXT_MAX_VA,
  SGPT_INVENTORY_TXT_PTR_VA,
  SGPT_ITEMS_LINKER_PTR_VA,
  SGPT_ITEMS_TXT_COUNT_VA,
  SGPT_ITEMS_TXT_PTR_VA,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'
import { SG_ITEM_DATATABLES_VA_113C } from '../../../src/d2kern-113c/tables/item-tbls-113c.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '../../..')
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools/oracle/callgraph/manifest-113c.json')
const AUDIT_PATH = path.join(REPO_ROOT, 'tools/oracle/callgraph/indirect-audit-batchB.json')
const D2_DATA_DIR = process.env.D2_DATA_DIR || path.join(os.homedir(), 'd2-data')
const D2GAME_DLL_PATH = path.join(D2_DATA_DIR, 'D2Game.dll')

interface ManifestFn {
  readonly module: string
  readonly va: string
  readonly name: string
  readonly size: number
  readonly status: string
  readonly tsSymbol?: string
  readonly kernFile?: string
  readonly indirectUnknown?: boolean
}

interface Manifest {
  readonly functions: readonly ManifestFn[]
}

interface IndirectSiteRecord {
  readonly iva: string
  readonly opcodeHex: string
  readonly mnemonic: string
  readonly operand: string
  readonly category: 'static_table' | 'vtable_or_struct_table' | 'caller_callback'
  readonly tableBase: string | null
  readonly tableEnd: string | null
  readonly tableStride: number | null
  readonly tableCount: number | null
  readonly targetVas: readonly string[]
  readonly proof: string
}

interface AuditEntry {
  readonly va: string
  readonly module: string
  readonly name: string
  readonly tsSymbol: string
  readonly kernFile: string
  readonly size: number
  readonly indirectSites: readonly IndirectSiteRecord[]
  readonly bugsFixed: readonly string[]
  readonly notes?: string
}

interface IndirectAuditBatchB {
  readonly version: string
  readonly batch: string
  readonly module: string
  readonly imageBase: string
  readonly summary: {
    readonly totalFunctions: number
    readonly totalIndirectSites: number
    readonly functionsByCategory: Record<string, number>
    readonly sitesByCategory: Record<string, number>
  }
  readonly functions: readonly AuditEntry[]
}

interface BatchBVaSpec {
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
  readonly kernFile: string
}

const BATCH_B_SPECS: readonly BatchBVaSpec[] = [
  {
    va: '0x6FC3BDF0',
    size: 360,
    headHex: '83ec1c55568bf033',
    tailHex: 'c20400',
    tsSymbol: 'AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c',
    kernFile: 'src/d2kern-113c/game/k2-w5b1-113c.ts',
  },
  {
    va: '0x6FC448A0',
    size: 167,
    headHex: '85c053555674128b',
    tailHex: 'c20c00',
    tsSymbol: 'MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c',
    kernFile: 'src/d2kern-113c/game/k2-w4b1-113c.ts',
  },
  {
    va: '0x6FC89E50',
    size: 142,
    headHex: 'a14c7ed26f0fb6c9',
    tailHex: 'c20400',
    tsSymbol: 'OBJ_RollAndDispatchObjectEffectTable_6FC89E50_113c',
    kernFile: 'src/d2kern-113c/game/k2-w3b7-113c.ts',
  },
  {
    va: '0x6FC8A330',
    size: 259,
    headHex: '83ec14c700010000',
    tailHex: 'f9ffcc',
    tsSymbol: 'OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c',
    kernFile: 'src/d2kern-113c/game/k2-w3b7-113c.ts',
  },
  {
    va: '0x6FC8DA00',
    size: 482,
    headHex: '83ec14568bf18b4e',
    tailHex: 'c414c3',
    tsSymbol: 'OBJ_OperateShrine_6FC8DA00_113c',
    kernFile: 'src/d2kern-113c/game/k2-w3b7-113c.ts',
  },
  {
    va: '0x6FC92220',
    size: 3451,
    headHex: '81ec1401000033c0',
    tailHex: 'c21000',
    tsSymbol: 'D2Game_6FC92220_113c',
    kernFile: 'src/d2kern-113c/game/k2-w13b1-113c.ts',
  },
  {
    va: '0x6FC96A50',
    size: 205,
    headHex: '83ec205356578bf2',
    tailHex: 'c420c3',
    tsSymbol: 'MONSTER_StartMode8CastA_6FC96A50_113c',
    kernFile: 'src/d2kern-113c/game/k2-w3b7-113c.ts',
  },
  {
    va: '0x6FC96B20',
    size: 205,
    headHex: '83ec205356578bf2',
    tailHex: 'c420c3',
    tsSymbol: 'MONSTER_StartMode8CastB_6FC96B20_113c',
    kernFile: 'src/d2kern-113c/game/k2-w3b7-113c.ts',
  },
  {
    va: '0x6FCBEDB0',
    size: 149,
    headHex: '56578b790c8b4710',
    tailHex: '005ec3',
    tsSymbol: 'SKILLS_FindClosestUnitCallback_6FCBEDB0_113c',
    kernFile: 'src/d2kern-113c/game/k2-w4b6-113c.ts',
  },
  {
    va: '0x6FCBEEB0',
    size: 296,
    headHex: '83ec6485f6750768',
    tailHex: 'c20400',
    tsSymbol: 'SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c',
    kernFile: 'src/d2kern-113c/game/k2-w4b6-113c.ts',
  },
  {
    va: '0x6FCDA5E0',
    size: 551,
    headHex: '81ec880000005355',
    tailHex: 'f4ffcc',
    tsSymbol: 'ACT4Q1_OnNpcMessage_6FCDA5E0_113c',
    kernFile: 'src/d2kern-113c/game/k2-w8b2-113c.ts',
  },
] as const

interface PeSection {
  readonly name: string
  readonly virtualAddress: number
  readonly virtualSize: number
  readonly rawPointer: number
  readonly rawSize: number
}

function loadPeSections(buf: Buffer): { imageBase: number; sections: readonly PeSection[] } {
  const peOff = buf.readUInt32LE(0x3c)
  const numSections = buf.readUInt16LE(peOff + 6)
  const optSize = buf.readUInt16LE(peOff + 20)
  const imageBase = buf.readUInt32LE(peOff + 24 + 28)
  const secStart = peOff + 24 + optSize
  const sections: PeSection[] = []
  for (let i = 0; i < numSections; i++) {
    const off = secStart + i * 40
    const name = buf
      .subarray(off, off + 8)
      .toString('latin1')
      .replace(/\0+$/, '')
    sections.push({
      name,
      virtualSize: buf.readUInt32LE(off + 8),
      virtualAddress: buf.readUInt32LE(off + 12),
      rawSize: buf.readUInt32LE(off + 16),
      rawPointer: buf.readUInt32LE(off + 20),
    })
  }
  return { imageBase, sections }
}

function vaToFileOffset(
  va: number,
  imageBase: number,
  sections: readonly PeSection[],
): number {
  const rva = (va - imageBase) >>> 0
  for (const s of sections) {
    const span = Math.max(s.virtualSize, s.rawSize)
    if (rva >= s.virtualAddress && rva < s.virtualAddress + span) {
      return s.rawPointer + (rva - s.virtualAddress)
    }
  }
  throw new Error(`VA 0x${va.toString(16)} outside PE sections`)
}

function readCStringFromMem(m: SparseMemory113c, addr: number, maxLen = 128): string {
  const bytes: number[] = []
  for (let i = 0; i < maxLen; i++) {
    const b = m.u8((addr + i) >>> 0)
    if (b === 0) break
    bytes.push(b)
  }
  return String.fromCharCode(...bytes)
}

function createWave20World() {
  const m = new SparseMemory113c()
  m.fill(0x6fd18000, 0x30000, 0)
  m.fill(0x6fdd6000, 0x28000, 0)
  m.fill(0x00f0_b000, 0x1000, 0)

  const pDataTables = m.alloc(0x2000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, D2COMMON_SGPT_DATATABLES_VA_113C)

  const pBitMasks = m.alloc(128)
  const pInvBitMasks = m.alloc(128)
  for (let i = 0; i < 32; i++) {
    const bit = (1 << i) >>> 0
    m.setU32((pBitMasks + i * 4) >>> 0, bit)
    m.setU32((pInvBitMasks + i * 4) >>> 0, (~bit) >>> 0)
  }
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pBitMasks)
  m.setU32(0x6fd18bac, pInvBitMasks)

  // LevelsTxt (160 levels)
  const pLevelsTxt = m.alloc(160 * D2LevelsTxt_SIZE)
  m.setU32((pDataTables + 0xc58) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc5c) >>> 0, 160)

  // MonStatsTxt & MonStats2Txt (600 rows)
  const pMonStatsTxt = m.alloc(600 * D2MonStatsTxt_SIZE)
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + 0xa80) >>> 0, 600)
  const pMonStats2Txt = m.alloc(600 * D2MonStats2Txt_SIZE)
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, 600)

  // SkillsTxt (400 rows * 0x23c) & PlayerClassSkillCount (7 classes)
  const pSkillsTxt = m.alloc(400 * 0x23c)
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xba0) >>> 0, 400)
  m.setU32((pDataTables + 0xba4) >>> 0, m.alloc(32))

  // ObjectsTxt (600 rows * 0x1c0)
  const pObjectsTxtBase = m.alloc(600 * 0x1c0)
  m.setU32((pDataTables + 0xc20) >>> 0, pObjectsTxtBase)
  m.setU32((pDataTables + 0xc24) >>> 0, 600)
  m.setU32(0x6fdf0b94, pObjectsTxtBase) // SGPT_OBJECTS_TXT_PTR_VA_113C
  m.setU32(0x6fdf0b98, 600) // SGPT_OBJECTS_TXT_COUNT_VA_113C

  // ItemStatCostTxt (360 rows * 0x144) so STATLIST_AddUnitStat propagates base -> full
  const pItemStatCostTxt = m.alloc(360 * 0x144)
  m.setU32((pDataTables + 0xbcc) >>> 0, pItemStatCostTxt)
  m.setU32((pDataTables + 0xbd4) >>> 0, 360)

  // ItemsTxt (64 rows) & ItemTypesTxt (32 rows) & InventoryTxt (32 rows * 0xf0, 3x4 grid)
  const pItemsTxt = m.alloc(64 * D2ItemsTxt_SIZE)
  m.setU32((pDataTables + 0xcd8) >>> 0, pItemsTxt)
  m.setU32((pDataTables + 0xce0) >>> 0, 64)
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, 64)
  m.setU32(SGPT_ITEMS_LINKER_PTR_VA, m.alloc(0x100))
  m.setU32(SG_ITEM_DATATABLES_VA_113C, 64)
  const pInvTxt = m.alloc(32 * 0xf0)
  for (let i = 0; i < 32; i++) {
    m.setU32((pInvTxt + i * 0xf0 + 0x10) >>> 0, (4 << 8) | 3) // 3x4 cube/inventory grid
  }
  m.setU32(SGPT_INVENTORY_TXT_PTR_VA, pInvTxt)
  m.setU32(SGPT_INVENTORY_TXT_MAX_VA, 31)
  const pItemTypesTxt = m.alloc(32 * D2ItemTypesTxt_SIZE)
  const pItemTypesEquiv = m.alloc(32 * 4)
  for (let i = 0; i < 32; i++) m.setU32((pItemTypesEquiv + i * 4) >>> 0, (1 << i) >>> 0)
  m.setU32((pDataTables + 0xbf8) >>> 0, pItemTypesTxt)
  m.setU32((pDataTables + 0xbfc) >>> 0, 32)
  m.setU32((pDataTables + 0xc00) >>> 0, 1) // nItemTypesEquivDwords
  m.setU32((pDataTables + 0xc04) >>> 0, pItemTypesEquiv)
  m.setU32((pDataTables + 0xcf8) >>> 0, pItemTypesTxt)
  m.setU32((pDataTables + 0xcfc) >>> 0, 32)

  // Zeroed state-mask buffers for sgptDataTables state-mask pointers (0xDC..0x160 including 0x150 corpse mask)
  const pZeroStateMask = m.alloc(0x40)
  for (let off = 0xdc; off <= 0x160; off += 4) {
    m.setU32((pDataTables + off) >>> 0, pZeroStateMask)
  }

  // ExperienceTxt (max level = 99)
  const pExpTxt = m.alloc(8 * 4)
  for (let i = 0; i < 8; i++) m.setU32((pExpTxt + i * 4) >>> 0, 99)
  m.setU32((pDataTables + 0xb4c) >>> 0, pExpTxt)
  m.setU32(0x6fdf0b50, pExpTxt) // G_EXPERIENCE_BIN_VA_113C

  // Game & Room & Act
  const pGame = m.alloc(0x2000)
  m.setU32((pGame + 0xd0) >>> 0, 0x13579bdf) // non-zero game RNG seed (+0xD0/+0xD4)
  m.setU32((pGame + 0xd4) >>> 0, 0x0000029a)
  m.setU32((pGame + 0x70) >>> 0, 1) // bExpansion = 1
  m.setU8((pGame + 0x6d) >>> 0, 0) // Normal difficulty
  m.setU32((pGame + 0xa8) >>> 0, 200) // dwGameFrame
  EVENT_InitTimerQueue113c(m, pGame)

  const pAct = m.alloc(0x100)
  const pDrlg = m.alloc(0x400)
  const pLevel = m.alloc(0x240)
  const pRoomEx = m.alloc(0x120)
  const pRoom = m.alloc(0x100)
  m.setU32((pGame + 0xbc) >>> 0, pAct)
  m.setU32((pAct + 0x0c) >>> 0, pDrlg)
  m.setU32((pAct + 0x10) >>> 0, 0)
  m.setU32((pLevel + 0x1d0) >>> 0, 2)
  m.setU32((pLevel + 0x00) >>> 0, pDrlg)
  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
  m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
  m.setU32((pRoom + 0x4c) >>> 0, 100)
  m.setU32((pRoom + 0x50) >>> 0, 100)
  m.setU32((pRoom + 0x54) >>> 0, 32)
  m.setU32((pRoom + 0x58) >>> 0, 32)
  // Non-zero RNG seed on pRoom
  m.setU32((pRoom + 0x6c) >>> 0, 0x12345678)
  m.setU32((pRoom + 0x70) >>> 0, 0x0000029a)
  // Self-listed in adjacent room list for UNITFINDS (D2ActiveRoomStrc: +0x00=ppRoomsNear, +0x24=nRoomsNear, +0x2C=pActUpdateFlag)
  const ppAdjRooms = m.alloc(8)
  const pActUpdateFlag = m.alloc(4)
  m.setU32(ppAdjRooms, pRoom)
  m.setU32((pRoom + 0x00) >>> 0, ppAdjRooms)
  m.setU32((pRoom + 0x24) >>> 0, 1)
  m.setU32((pRoom + 0x2c) >>> 0, pActUpdateFlag)

  const pQuestCtrl = m.alloc(0x40)
  const pGlobalQuestFlags = m.alloc(0x40)
  const pGlobalQuestBits = m.alloc(0x100)
  m.setU32(pGlobalQuestFlags, pGlobalQuestBits)
  m.setU32((pGlobalQuestFlags + 4) >>> 0, 0x60)
  m.setU32((pQuestCtrl + 0x08) >>> 0, 1)
  m.setU32((pQuestCtrl + 0x0c) >>> 0, pGlobalQuestFlags)
  m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl)

  return {
    m,
    pDataTables,
    pGame,
    pRoom,
    pRoomEx,
    pLevel,
    pMonStatsTxt,
    pMonStats2Txt,
    pSkillsTxt,
    pObjectsTxtBase,
    pItemsTxt,
    pItemTypesTxt,
    pQuestCtrl,
    pGlobalQuestFlags,
  }
}

function allocPlayerUnit(
  m: SparseMemory113c,
  pGame: number,
  pRoom: number,
  guid: number,
  x: number,
  y: number,
): { pPlayer: number; pPlayerData: number; pQuestRecord: number; pInv: number } {
  const pPlayer = m.alloc(0x100)
  const pPlayerData = m.alloc(0x100)
  const pQuestRecord = m.alloc(0x40)
  const pQuestBits = m.alloc(0x100)
  m.setU32(pQuestRecord, pQuestBits)
  m.setU32((pQuestRecord + 4) >>> 0, 0x60)
  const pPath = m.alloc(0x80)
  const pInv = INVENTORY_AllocInventory113c(m, 0, pPlayer) >>> 0
  m.setU32(pPlayer, 0) // UNIT_PLAYER
  m.setU32((pPlayer + 0x04) >>> 0, 0)
  m.setU32((pPlayer + 0x0c) >>> 0, guid)
  m.setU32((pPlayer + 0x10) >>> 0, 1)
  m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
  // Non-zero RNG seed
  m.setU32((pPlayer + 0x20) >>> 0, 0x2468ace1)
  m.setU32((pPlayer + 0x24) >>> 0, 0x0000029a)
  m.setU32((pPlayer + 0x2c) >>> 0, pPath)
  m.setU32((pPlayer + 0x60) >>> 0, pInv)
  m.setU32((pPlayer + 0x80) >>> 0, pGame)
  m.setU16((pPath + 0x02) >>> 0, x)
  m.setU16((pPath + 0x06) >>> 0, y)
  m.setU32((pPath + 0x1c) >>> 0, pRoom)
  const pClient = m.alloc(0x200)
  m.setU32((pClient + 0x1a8) >>> 0, pGame)
  m.setU32((pPlayerData + 0x10) >>> 0, pQuestRecord)
  m.setU32((pPlayerData + 0x14) >>> 0, pQuestRecord)
  m.setU32((pPlayerData + 0x18) >>> 0, pQuestRecord)
  m.setU32((pPlayerData + 0x9c) >>> 0, pClient)
  STATLIST_CreateEx113c(m, pPlayer, 0x80000000, pGame)
  SUNIT_InsertServerUnit113c(m, pGame, pPlayer)
  return { pPlayer, pPlayerData, pQuestRecord, pInv }
}

function allocMonsterUnit(
  m: SparseMemory113c,
  pGame: number,
  pRoom: number,
  classId: number,
  guid: number,
  x: number,
  y: number,
): { pMon: number; pMonData: number; pAiGeneral: number; pPath: number } {
  const pMon = m.alloc(0x100)
  const pMonData = m.alloc(0x80)
  const pAiGeneral = m.alloc(0x60)
  const pPath = m.alloc(0x80)
  m.setU32(pMon, 1) // UNIT_MONSTER
  m.setU32((pMon + 0x04) >>> 0, classId)
  m.setU32((pMon + 0x0c) >>> 0, guid)
  m.setU32((pMon + 0x10) >>> 0, 1)
  m.setU32((pMon + 0x14) >>> 0, pMonData)
  // Non-zero RNG seed
  m.setU32((pMon + 0x20) >>> 0, 0x13579bdf)
  m.setU32((pMon + 0x24) >>> 0, 0x0000029a)
  m.setU32((pMon + 0x2c) >>> 0, pPath)
  m.setU32((pMon + 0x80) >>> 0, pGame)
  m.setU32((pMonData + 0x28) >>> 0, pAiGeneral)
  m.setU32((pAiGeneral + 0x28) >>> 0, pGame)
  m.setU32((pAiGeneral + 0x2c) >>> 0, 0xffffffff) // unowned dwOwnerGuid
  m.setU32((pAiGeneral + 0x30) >>> 0, 0xffffffff) // unowned dwOwnerType
  m.setU16((pPath + 0x02) >>> 0, x)
  m.setU16((pPath + 0x06) >>> 0, y)
  m.setU32((pPath + 0x1c) >>> 0, pRoom)
  STATLIST_CreateEx113c(m, pMon, 0x80000000, pGame)
  SUNIT_InsertServerUnit113c(m, pGame, pMon)
  return { pMon, pMonData, pAiGeneral, pPath }
}

describe('K2 Wave 20 (indirectUnknown Batch B): 11 D2Game.dll v1.13c PE32 verification', () => {
  it('1. verifies exact PE32 head/tail opcodes, sizes, rdata strings, and indirect-audit-batchB.json proofs', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest
    const manifestByVa = new Map<string, ManifestFn>()
    for (const fn of manifest.functions) {
      if (fn.module === 'D2Game') {
        manifestByVa.set(fn.va.toUpperCase(), fn)
      }
    }

    const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8')) as IndirectAuditBatchB
    expect(audit.version).toBe('1.13c')
    expect(audit.batch).toBe('wave20-indB')
    expect(audit.module).toBe('D2Game')
    expect(audit.summary.totalFunctions).toBe(11)
    expect(audit.summary.totalIndirectSites).toBe(13)
    expect(audit.functions).toHaveLength(11)

    const auditByVa = new Map<string, AuditEntry>()
    for (const entry of audit.functions) {
      auditByVa.set(entry.va.toUpperCase(), entry)
    }

    const dllExists = fs.existsSync(D2GAME_DLL_PATH)
    expect(dllExists).toBe(true)
    const dllBuf = fs.readFileSync(D2GAME_DLL_PATH)
    const { imageBase, sections } = loadPeSections(dllBuf)
    expect(imageBase).toBe(0x6fc20000)

    // Verify exact .rdata format strings used by 0x6FC8DA00 & 0x6FCDA5E0
    const offFmtD = vaToFileOffset(0x6fd1bdb4, imageBase, sections)
    expect(dllBuf.subarray(offFmtD, offFmtD + 3).toString('latin1')).toBe('%d\0')
    const offFmtQuest = vaToFileOffset(0x6fd1cc2c, imageBase, sections)
    expect(dllBuf.subarray(offFmtQuest, offFmtQuest + 22).toString('latin1')).toBe(
      'changing state to %d\n\0',
    )

    const validCategories = new Set(['static_table', 'vtable_or_struct_table', 'caller_callback'])

    for (const spec of BATCH_B_SPECS) {
      const mfn = manifestByVa.get(spec.va.toUpperCase())
      expect(mfn, `manifest entry for ${spec.va}`).toBeDefined()
      expect(mfn!.size).toBe(spec.size)
      expect(mfn!.tsSymbol).toBe(spec.tsSymbol)
      expect(mfn!.kernFile).toBe(spec.kernFile)

      const fva = Number.parseInt(spec.va, 16)
      const foff = vaToFileOffset(fva, imageBase, sections)
      const actualHead = dllBuf.subarray(foff, foff + 8).toString('hex')
      const actualTail = dllBuf.subarray(foff + spec.size - 3, foff + spec.size).toString('hex')
      expect(actualHead, `headHex for ${spec.va}`).toBe(spec.headHex)
      expect(actualTail, `tailHex for ${spec.va}`).toBe(spec.tailHex)

      const aEntry = auditByVa.get(spec.va.toUpperCase())
      expect(aEntry, `audit entry for ${spec.va}`).toBeDefined()
      expect(aEntry!.size).toBe(spec.size)
      expect(aEntry!.tsSymbol).toBe(spec.tsSymbol)
      expect(aEntry!.kernFile).toBe(spec.kernFile)
      expect(aEntry!.indirectSites.length).toBeGreaterThanOrEqual(1)

      for (const site of aEntry!.indirectSites) {
        expect(validCategories.has(site.category)).toBe(true)
        expect(site.proof.length).toBeGreaterThan(20)
        expect(site.targetVas.length).toBeGreaterThanOrEqual(1)

        // Verify indirect call instruction bytes at exact iva in D2Game.dll
        const iva = Number.parseInt(site.iva, 16)
        expect(iva).toBeGreaterThanOrEqual(fva)
        expect(iva).toBeLessThan(fva + spec.size)
        const ioff = vaToFileOffset(iva, imageBase, sections)
        const insLen = site.opcodeHex.length / 2
        expect(dllBuf.subarray(ioff, ioff + insLen).toString('hex')).toBe(site.opcodeHex)

        // Every declared targetVa must be a real manifest D2Game function
        for (const tva of site.targetVas) {
          expect(manifestByVa.has(tva.toUpperCase()), `target ${tva} for ${spec.va}`).toBe(true)
        }

        // For memory-backed static tables, cross-check table bytes in PE32 against targetVas
        if (site.tableBase !== null && site.tableEnd !== null) {
          const tBase = Number.parseInt(site.tableBase, 16)
          const tEnd = Number.parseInt(site.tableEnd, 16)
          const stride = site.tableStride!
          const count = site.tableCount!
          expect(tBase + stride * count).toBe(tEnd)
          const foundTargets = new Set<string>()
          for (let idx = 0; idx < count; idx++) {
            const slotOff = vaToFileOffset(tBase + idx * stride, imageBase, sections)
            const ptr = dllBuf.readUInt32LE(slotOff)
            if (ptr !== 0) {
              foundTargets.add(`0x${ptr.toString(16).toUpperCase().padStart(8, '0')}`)
            }
          }
          expect([...foundTargets].sort()).toEqual([...site.targetVas].sort())
        }
      }
    }
  })

  it('2. 0x6FC3BDF0 regression: preserves mode 12 (DEAD) after AI_Stall113c and dispatches Anya vs Cain targets', () => {
    const { m, pGame, pRoom } = createWave20World()
    const { pMon: pAnya } = allocMonsterUnit(m, pGame, pRoom, 0x20f, 101, 110, 112)
    STATLIST_SetUnitStat113c(m, pAnya, 6, 500, 0)

    // Pre-mark Anya quest position unrecorded so ACT5Q3_RecordAnyaPosition returns 0 -> triggers spawn & mode 12
    beginVaTrace113c()
    const res = AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c(m, pAnya, pGame)
    const hits = endVaTrace113c()

    expect(res).toBe(1)
    expect(hits.has('D2Game:0x6FC3BDF0')).toBe(true)
    expect(hits.has('D2Game:0x6FC76A00')).toBe(true)
    expect(hits.has('D2Game:0x6FC7CC30')).toBe(true)
    expect(hits.has('D2Game:0x6FD121E0')).toBe(true)
    expect(hits.has('D2Game:0x6FD122C0')).toBe(true)
    // HP zeroed and mode 12 NOT clobbered back to mode 1 by AI_Stall113c
    expect(STATLIST_GetUnitStat113c(m, pAnya, 6, 0)).toBe(0)
    expect(m.u32((pAnya + 0x10) >>> 0)).toBe(12)

    // Non-Anya (Cain) branch dispatches 0x6FC80400 + 0x6FC863A0
    const { pMon: pCain } = allocMonsterUnit(m, pGame, pRoom, 0x109, 102, 115, 118)
    STATLIST_SetUnitStat113c(m, pCain, 6, 500, 0)
    beginVaTrace113c()
    const resCain = AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c(m, pCain, pGame)
    const hitsCain = endVaTrace113c()
    expect(resCain).toBe(1)
    expect(hitsCain.has('D2Game:0x6FC80400')).toBe(true)
    expect(hitsCain.has('D2Game:0x6FC863A0')).toBe(true)
    expect(m.u32((pCain + 0x10) >>> 0)).toBe(12)
  })

  it('3. 0x6FC448A0 regression: dispatches all 19 UMod table entries to boss & minions and skips NULL slots cleanly', () => {
    const { m, pGame, pRoom } = createWave20World()
    const { pMon: pBoss, pMonData: pBossData, pAiGeneral: pBossAi } = allocMonsterUnit(
      m,
      pGame,
      pRoom,
      10,
      201,
      110,
      110,
    )
    const { pMon: pMinion } = allocMonsterUnit(m, pGame, pRoom, 10, 202, 111, 110)

    // Link minion to boss pack list at pBossAi + 0x34 (D2MinionListStrc: +0x00=dwMinionGuid, +0x04=pNext)
    const pMinionNode = m.alloc(0x10)
    m.setU32(pMinionNode, 202)
    m.setU32((pMinionNode + 4) >>> 0, 0)
    m.setU32((pBossAi + 0x28) >>> 0, pGame)
    m.setU32((pBossAi + 0x2c) >>> 0, 201) // leaderGuid = pBoss guid
    m.setU32((pBossAi + 0x30) >>> 0, 1) // leaderType = UNIT_MONSTER
    m.setU32((pBossAi + 0x34) >>> 0, 0) // start boss-only

    // Populate base UMod IDs at 0x6FD1CE7C = [1, 2, 3, 4] and real D2Game UMod table at 0x6FD2E550
    m.setU32(0x6fd1ce7c, 1)
    m.setU32(0x6fd1ce80, 2)
    m.setU32(0x6fd1ce84, 3)
    m.setU32(0x6fd1ce88, 4)
    m.setU32(0x6fd2e550 + 1 * 4, 0x6fc43020) // RollBossOrMinionNameSeed
    m.setU32(0x6fd2e550 + 2 * 4, 0x6fc42fa0) // ApplyExtraHealthBonus
    m.setU32(0x6fd2e550 + 3 * 4, 0) // NULL slot -> must NOT invoke 0x6FC41840 on boss
    m.setU32(0x6fd2e550 + 4 * 4, 0x6fc41e80) // ApplyBossLevelAndExpBonus
    m.setU32(0x6fd2e550 + 6 * 4, 0x6fc42880) // ApplyExtraFastVelocity
    m.setU32(0x6fd2e550 + 41 * 4, 0x6fc469f0) // InitUMod41ScheduleEvent7

    // Assign custom UMods [6, 41, 0] to pBoss->pMonsterData->nMonUMod (+0x1C)
    m.setU8((pBossData + 0x1c) >>> 0, 6)
    m.setU8((pBossData + 0x1d) >>> 0, 41)
    m.setU8((pBossData + 0x1e) >>> 0, 0)

    STATLIST_SetUnitStat113c(m, pBoss, 7, 1000, 0)
    STATLIST_SetUnitStat113c(m, pBoss, 6, 1000, 0)
    STATLIST_SetUnitStat113c(m, pMinion, 7, 1000, 0)
    STATLIST_SetUnitStat113c(m, pMinion, 6, 1000, 0)

    // First verify boss-only (no minions) with NULL slot 3 does NOT fire 0x6FC41840
    m.setU32((pBossAi + 0x34) >>> 0, 0)
    beginVaTrace113c()
    MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c(m, 0, pRoom, pGame, pBoss, 0)
    const bossOnlyHits = endVaTrace113c()
    expect(bossOnlyHits.has('D2Game:0x6FC448A0')).toBe(true)
    expect(bossOnlyHits.has('D2Game:0x6FC43020')).toBe(true)
    expect(bossOnlyHits.has('D2Game:0x6FC42FA0')).toBe(true)
    expect(bossOnlyHits.has('D2Game:0x6FC41E80')).toBe(true)
    expect(bossOnlyHits.has('D2Game:0x6FC42880')).toBe(true)
    expect(bossOnlyHits.has('D2Game:0x6FC469F0')).toBe(true)
    expect(bossOnlyHits.has('D2Game:0x6FC41840')).toBe(false)
    // UMod 41 scheduled event 7 on pBoss (pBoss->pEvents at +0xdc non-zero)
    expect(m.u32((pBoss + 0xdc) >>> 0)).not.toBe(0)

    // Now re-attach minion and verify minion receives UMod 41 (event 7) via 0x6FC41840 + onMonUMod
    m.setU32((pBossAi + 0x34) >>> 0, pMinionNode)
    beginVaTrace113c()
    MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c(m, 0, pRoom, pGame, pBoss, 0)
    const packHits = endVaTrace113c()
    expect(packHits.has('D2Game:0x6FC41840')).toBe(true)
    expect(m.u32((pMinion + 0xdc) >>> 0)).not.toBe(0)
  })

  it('4. 0x6FC89E50 regression: dispatches real static effect handlers from 0x6FD27D50 without callback override', () => {
    const { m, pGame, pRoom } = createWave20World()
    const { pPlayer } = allocPlayerUnit(m, pGame, pRoom, 301, 110, 110)

    // Populate table count [0x6FD27E4C] = 21 and entry [18] = { 0x6FC89650, chance=100, param=2 }
    m.setU32(0x6fd27e4c, 21)
    const entry18 = (0x6fd27d50 + 18 * 12) >>> 0
    m.setU32(entry18, 0x6fc89650) // OBJECTS_GrantUnitSkillPoints_6FC89650
    m.setU32((entry18 + 4) >>> 0, 100)
    m.setU32((entry18 + 8) >>> 0, 2)

    const beforePts = STATLIST_GetUnitStat113c(m, pPlayer, 5, 0)
    beginVaTrace113c()
    const ret = OBJ_RollAndDispatchObjectEffectTable_6FC89E50_113c(m, 18, pPlayer, pGame)
    const hits = endVaTrace113c()

    expect(ret).toBe(1) // real 0x6FC89650 return value (1), NOT fake dwArg (2)
    expect(hits.has('D2Game:0x6FC89E50')).toBe(true)
    expect(hits.has('D2Game:0x6FC89650')).toBe(true)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 5, 0)).toBe(beforePts + 2)

    // Verify IsBadCodePtr assert 0x10F5 on NULL handler
    const entry19 = (0x6fd27d50 + 19 * 12) >>> 0
    m.setU32(entry19, 0)
    m.setU32((entry19 + 4) >>> 0, 100)
    expect(() => OBJ_RollAndDispatchObjectEffectTable_6FC89E50_113c(m, 19, pPlayer, pGame)).toThrow(
      D2CommonAssertError,
    )
  })

  it('5. 0x6FC8A330 regression: dispatches real OperateFn handlers from 0x6FD27BB8 without callback override', () => {
    const { m, pGame, pRoom, pObjectsTxtBase } = createWave20World()
    const { pPlayer } = allocPlayerUnit(m, pGame, pRoom, 401, 110, 110)

    const pObj = m.alloc(0x100)
    const pObjData = m.alloc(0x40)
    const pObjPath = m.alloc(0x40)
    const pObjTxt = (pObjectsTxtBase + 10 * 0x1c0) >>> 0
    m.setU8((pObjTxt + 0x1b3) >>> 0, 29) // OperateFn 29 -> 0x6FC8DE00
    m.setU32(pObj, 2) // UNIT_OBJECT
    m.setU32((pObj + 0x04) >>> 0, 10)
    m.setU32((pObj + 0x0c) >>> 0, 402)
    m.setU32((pObj + 0x10) >>> 0, 0) // mode 0
    m.setU32((pObj + 0x14) >>> 0, pObjData)
    m.setU32((pObj + 0x2c) >>> 0, pObjPath)
    m.setU32((pObj + 0x80) >>> 0, pGame)
    m.setU32(pObjData, pObjTxt)
    m.setU32((pObjPath + 0x1c) >>> 0, pRoom)
    SUNIT_InsertServerUnit113c(m, pGame, pObj)

    m.setU32(0x6fd27bb8 + 29 * 4, 0x6fc8de00) // OBJ_OperateGenericMode0To1_6FC8DE00

    const pOutFlag = m.alloc(4)
    beginVaTrace113c()
    const ret = OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c(m, pOutFlag, 402, pGame, pPlayer, 2)
    const hits = endVaTrace113c()

    expect(m.u32(pOutFlag)).toBe(1)
    expect(ret).toBe(1) // real return value of 0x6FC8DE00, NOT raw VA 0x6FC8DE00
    expect(hits.has('D2Game:0x6FC8A330')).toBe(true)
    expect(hits.has('D2Game:0x6FC8DE00')).toBe(true)
    expect(m.u32((pObj + 0x10) >>> 0)).toBe(1) // mode transitioned 0 -> 1

    // bOperateFn >= 0x65 must throw Fog assert 0xCF8
    m.setU8((pObjTxt + 0x1b3) >>> 0, 0x65)
    expect(() =>
      OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c(m, pOutFlag, 402, pGame, pPlayer, 2),
    ).toThrow(D2CommonAssertError)
  })

  it('6. 0x6FC8DA00 regression: formats decimal "%d" hover text, enforces [0x6FD27D4C], and dispatches real shrine effects', () => {
    const { m, pGame, pRoom, pObjectsTxtBase } = createWave20World()
    const { pPlayer } = allocPlayerUnit(m, pGame, pRoom, 501, 110, 110)
    STATLIST_SetUnitStat113c(m, pPlayer, 7, 100 << 8, 0) // maxhp = 100
    STATLIST_SetUnitStat113c(m, pPlayer, 6, 20 << 8, 0) // hp = 20

    const pObj = m.alloc(0x100)
    const pObjData = m.alloc(0x40)
    const pObjPath = m.alloc(0x40)
    const pShrineTxt = m.alloc(0x40)
    const pObjTxt = (pObjectsTxtBase + 20 * 0x1c0) >>> 0
    m.setU32(pObj, 2)
    m.setU32((pObj + 0x04) >>> 0, 20)
    m.setU32((pObj + 0x0c) >>> 0, 502)
    m.setU32((pObj + 0x10) >>> 0, 0)
    m.setU32((pObj + 0x14) >>> 0, pObjData)
    m.setU32((pObj + 0x2c) >>> 0, pObjPath)
    m.setU32((pObj + 0x80) >>> 0, pGame)
    m.setU32(pObjData, pObjTxt)
    m.setU8((pObjData + 0x04) >>> 0, 5) // bShrineIdx = 5 -> 5 + 0xE63 = 3688 ("3688", NOT "0xe68")
    m.setU32((pObjData + 0x08) >>> 0, pShrineTxt)
    m.setU32((pObjPath + 0x1c) >>> 0, pRoom)

    // Shrine code 2 -> 0x6FC898A0 SHRINES_ApplyHealthRechargeEffect
    m.setU8(pShrineTxt, 2)
    m.setU8((pShrineTxt + 0x10) >>> 0, 3) // 3 min reset
    m.setU32(0x6fd27d4c, 24)
    m.setU32(0x6fd1a5f8 + 2 * 12, 0x6fc898a0)

    const pOpArgs = m.alloc(0x20)
    m.setU32(pOpArgs, pGame)
    m.setU32((pOpArgs + 0x04) >>> 0, pObj)
    m.setU32((pOpArgs + 0x08) >>> 0, pPlayer)
    m.setU32((pOpArgs + 0x10) >>> 0, 20)

    beginVaTrace113c()
    const ret = OBJ_OperateShrine_6FC8DA00_113c(m, pOpArgs)
    const hits = endVaTrace113c()

    expect(ret).toBe(1)
    expect(hits.has('D2Game:0x6FC8DA00')).toBe(true)
    expect(hits.has('D2Game:0x6FC898A0')).toBe(true)
    // Hover message must be decimal "3688", NOT hex "0xe68"
    const pHover = m.u32((pObj + 0xa4) >>> 0)
    expect(pHover).not.toBe(0)
    expect(readCStringFromMem(m, (pHover + D2HoverTextStrc.szMsg.off) >>> 0)).toBe('3688')
    // Health recharge shrine restored player life to maxhp
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 6, 0)).toBe(100 << 8)

    // Verify [0x6FD27D4C] == 0 falls back to 0x6FC89C00 (no fabricated < 23 override)
    m.setU32((pObjData + 0x0c) >>> 0, 0)
    m.setU32((pObj + 0x10) >>> 0, 0)
    m.setU32(0x6fd27d4c, 0)
    beginVaTrace113c()
    OBJ_OperateShrine_6FC8DA00_113c(m, pOpArgs)
    const fallbackHits = endVaTrace113c()
    expect(fallbackHits.has('D2Game:0x6FC89C00')).toBe(true)
    expect(fallbackHits.has('D2Game:0x6FC898A0')).toBe(false)
  })

  it('7. 0x6FC92220 regression: dispatches 0x6FD1A5E8 cube ops, unsigned mod roll, and fixed +0x14/+0x18 item flags', () => {
    const { m, pGame, pRoom, pItemsTxt, pItemTypesTxt } = createWave20World()
    const { pPlayer } = allocPlayerUnit(m, pGame, pRoom, 601, 110, 110)

    // (a) Special cube op table at 0x6FD1A5E8: [1] = 0x6FC92210, [2] = 0x6FC90180
    m.setU32(0x6fd1a5e8 + 1 * 4, 0x6fc92210)
    m.setU32(0x6fd1a5e8 + 2 * 4, 0x6fc90180)
    m.setU32(0x6fd1a5e8 + 3 * 4, 0x6fc90170)

    const pCubeTxt = m.alloc(0x200)
    const pOutputArgs = m.alloc(0x40)
    m.setU8((pCubeTxt + 0x4c + 8) >>> 0, 1) // slot 0 bOutputType = 1 (Cow Portal)
    m.setU8((pCubeTxt + 0x4c + 0x54 + 8) >>> 0, 2) // slot 1 bOutputType = 2 (NoopAction2)
    m.setU8((pCubeTxt + 0x4c + 0xa8 + 8) >>> 0, 3) // slot 2 bOutputType = 3 (NoopAction3)

    beginVaTrace113c()
    D2Game_6FC92220_113c(m, pGame, pPlayer, pCubeTxt, pOutputArgs)
    const opHits = endVaTrace113c()
    expect(opHits.has('D2Game:0x6FC92220')).toBe(true)
    expect(opHits.has('D2Game:0x6FC92210')).toBe(true)
    expect(opHits.has('D2Game:0x6FC90180')).toBe(true)
    expect(opHits.has('D2Game:0x6FC90170')).toBe(true)

    // (b) Fixed dwCommandFlags (+0x18) vs dwItemFlags (+0x14) + unsigned mod chance roll
    // Configure item row 1: socketable (wType1=1), maxSockets=4, nInvWidth=1 (+0x10F), nInvHeight=1 (+0x110)
    const pItemTxt1 = (pItemsTxt + 1 * D2ItemsTxt_SIZE) >>> 0
    m.setU8((pItemTxt1 + 0x10f) >>> 0, 1) // nInvWidth = 1
    m.setU8((pItemTxt1 + 0x110) >>> 0, 1) // nInvHeight = 1
    m.setU16((pItemTxt1 + 0x11e) >>> 0, 1) // wType1 = 1
    m.setU8((pItemTxt1 + 0x138) >>> 0, 4) // bGemSockets = 4 (D2ItemsTxt.bBelt)
    const pType1 = (pItemTypesTxt + 1 * D2ItemTypesTxt_SIZE) >>> 0
    m.setU8((pType1 + 0x1a) >>> 0, 4) // nMaxSock1
    m.setU8((pType1 + 0x1b) >>> 0, 4) // nMaxSock25
    m.setU8((pType1 + 0x1c) >>> 0, 4) // nMaxSock40
    m.setU8((pType1 + 0x1f) >>> 0, 0xff) // nStaffMods = none

    const pSrcItem = m.alloc(0x100)
    const pSrcItemData = m.alloc(0x80)
    const pSrcPath = m.alloc(0x20)
    m.setU32(pSrcPath, pRoom)
    m.setU32(pSrcItem, 4) // UNIT_ITEM
    m.setU32((pSrcItem + 0x04) >>> 0, 1)
    m.setU32((pSrcItem + 0x0c) >>> 0, 605)
    m.setU32((pSrcItem + 0x10) >>> 0, 0)
    m.setU32((pSrcItem + 0x14) >>> 0, pSrcItemData)
    m.setU32((pSrcItem + 0x2c) >>> 0, pSrcPath)
    m.setU32((pSrcItem + 0x80) >>> 0, pGame)
    // Pick seed (lo=2, hi=0): nextLow = 2 * 0x6ac690c5 = 0xd58d218a (bit31=1 -> negative signed!)
    // Unsigned: 0xd58d218a % 100 = 3582796170 % 100 = 70 > chance(50) => MUST NOT apply property!
    // Old buggy signed: (-712171126) % 100 = -26 <= 50 => erroneously applied property!
    m.setU32((pSrcItem + 0x20) >>> 0, 2)
    m.setU32((pSrcItem + 0x24) >>> 0, 0)
    ITEMS_SetItemQuality113c(m, pSrcItem, 2) // NORMAL quality
    ITEMS_SetInvPage113c(m, pSrcItem, 3)
    STATLIST_CreateEx113c(m, pSrcItem, 0x80000000, pGame)
    SUNIT_InsertServerUnit113c(m, pGame, pSrcItem)

    // Use bOutputType=0xFC (create item id=1), wFlags=0x02 (add sockets), bOutQual=2 (NORMAL), bParam/qty=3 sockets,
    // and mod[0] = { propId=0, param=0, min=5, max=5, chance=50 }
    const pCubeSock = m.alloc(0x200)
    const pOutDef0 = (pCubeSock + 0x4c) >>> 0
    m.setU16(pOutDef0, 0x02) // bit 1 = add sockets
    m.setU16((pOutDef0 + 2) >>> 0, 1) // wItemId = 1
    m.setU8((pOutDef0 + 6) >>> 0, 2) // bOutQual = NORMAL (2)
    m.setU8((pOutDef0 + 7) >>> 0, 3) // 3 sockets
    m.setU8((pOutDef0 + 8) >>> 0, 0xfc) // create item by item id
    m.setU32((pOutDef0 + 0x18) >>> 0, 0xffffffff)
    for (let mIdx = 1; mIdx < 5; mIdx++) {
      m.setU32((pOutDef0 + 0x18 + mIdx * 12) >>> 0, 0xffffffff)
    }

    const pOutArgs2 = m.alloc(0x40)
    m.setU32(pOutArgs2, pSrcItem)
    m.setU32((pOutArgs2 + 4) >>> 0, 1)
    m.setU32((pOutArgs2 + 8) >>> 0, 10)

    const pCreated = D2Game_6FC92220_113c(m, pGame, pPlayer, pCubeSock, pOutArgs2) >>> 0
    expect(pCreated).not.toBe(0)
    const pCreatedData = m.u32((pCreated + 0x14) >>> 0) >>> 0
    // Verify 0x800 (SOCKETED) & 0x10 (IDENTIFIED) landed in dwCommandFlags (+0x18),
    // and bit 2 landed in dwItemFlags (+0x14), NOT vice versa!
    expect(ITEMS_GetCommandFlags113c(m, pCreated) & 0x800).toBe(0x800)
    expect(ITEMS_GetCommandFlags113c(m, pCreated) & 0x10).toBe(0x10)
    expect(m.u32((pCreatedData + 0x14) >>> 0) & 2).toBe(2)
    expect(m.u32((pCreatedData + 0x14) >>> 0) & 0x800).toBe(0)

    // (c) Unsigned mod chance roll: with chance = 1, any roll with bit 31 set (signed < 0)
    // and unsigned % 100 > 1 MUST skip ITEMS_ApplySinglePropAndEthereal113c (D2Common:0x6FD97730).
    // Old buggy signed `(nextLow | 0) % 100 <= 1` erroneously applied the mod on every bit-31 roll!
    m.setU16(pOutDef0, 0) // no sockets needed for mod roll test
    m.setU32((pOutDef0 + 0x18) >>> 0, 0) // mod[0] propId = 0
    m.setU8((pOutDef0 + 0x22) >>> 0, 1) // chance = 1%
    let checkedBit31Skip = false
    for (let seedLo = 1; seedLo <= 24; seedLo++) {
      m.setU32((pGame + 0xd0) >>> 0, seedLo)
      m.setU32((pGame + 0xd4) >>> 0, 0x0000029a)
      beginVaTrace113c()
      const pModItem = D2Game_6FC92220_113c(m, pGame, pPlayer, pCubeSock, pOutArgs2) >>> 0
      const modHits = endVaTrace113c()
      expect(pModItem).not.toBe(0)
      const rolledLow = m.u32((pModItem + 0x20) >>> 0) >>> 0
      if ((rolledLow | 0) < 0 && (rolledLow % 100) > 1) {
        expect(modHits.has('D2Common:0x6FD97730')).toBe(false)
        checkedBit31Skip = true
        break
      }
    }
    expect(checkedBit31Skip).toBe(true)
  })

  it('8. 0x6FC96A50 & 0x6FC96B20 regression: dispatch AI_RunMonsterAI (0x6FCBD3B0) via [0x6FD1BC1C]', () => {
    const { m, pGame, pRoom } = createWave20World()
    const { pMon: pMonA } = allocMonsterUnit(m, pGame, pRoom, 15, 701, 112, 112)
    const { pMon: pMonB } = allocMonsterUnit(m, pGame, pRoom, 15, 702, 114, 112)

    // With [0x6FD1BC1C] == 0, AI_RunMonsterAI is skipped
    m.setU32(0x6fd1bc1c, 0)
    beginVaTrace113c()
    MONSTER_StartMode8CastA_6FC96A50_113c(m, pGame, pMonA)
    const hitsZero = endVaTrace113c()
    expect(hitsZero.has('D2Game:0x6FC96A50')).toBe(true)
    expect(hitsZero.has('D2Game:0x6FCBD3B0')).toBe(false)

    // With [0x6FD1BC1C] == 0x6FCBD3B0 (exact .rdata value), both A and B dispatch AI_RunMonsterAI113c
    m.setU32(0x6fd1bc1c, 0x6fcbd3b0)
    beginVaTrace113c()
    MONSTER_StartMode8CastA_6FC96A50_113c(m, pGame, pMonA)
    MONSTER_StartMode8CastB_6FC96B20_113c(m, pGame, pMonB)
    const hitsLive = endVaTrace113c()
    expect(hitsLive.has('D2Game:0x6FC96A50')).toBe(true)
    expect(hitsLive.has('D2Game:0x6FC96B20')).toBe(true)
    expect(hitsLive.has('D2Game:0x6FCBD3B0')).toBe(true)
  })

  it('9. 0x6FCBEDB0 regression: dispatches caller filter 0x6FC47130 instead of permissive fallback', () => {
    const { m, pGame, pRoom, pMonStatsTxt, pMonStats2Txt } = createWave20World()
    const { pPlayer } = allocPlayerUnit(m, pGame, pRoom, 801, 110, 110)
    const { pMon } = allocMonsterUnit(m, pGame, pRoom, 25, 802, 113, 114)
    // Configure MonStats[25] + MonStats2[25] so 0x6FC47130 accepts living unowned monster in mode 12
    const pMonRow = (pMonStatsTxt + 25 * D2MonStatsTxt_SIZE) >>> 0
    m.set(pMonRow, D2MonStatsTxt.wMonStatsEx, 25)
    m.setU8((pMonRow + 0x0e) >>> 0, 1) // revivable/skill-eligible flag bit 0
    m.setU32((pMonStats2Txt + 25 * D2MonStats2Txt_SIZE + D2MonStats2Txt.dwModeFlags.off) >>> 0, (1 << 2) | (1 << 0x0c))
    m.setU32((pMon + 0xc4) >>> 0, 0x04) // UNITFLAG_ISVALIDTARGET

    const pFindArg = m.alloc(0x20)
    const pClosestCtx = m.alloc(0x20)
    m.setU32(pFindArg, pGame)
    m.setU32((pFindArg + 0x0c) >>> 0, pClosestCtx)
    m.setU32((pClosestCtx + 0x04) >>> 0, 0x7fffffff)
    m.setU32((pClosestCtx + 0x08) >>> 0, 110)
    m.setU32((pClosestCtx + 0x0c) >>> 0, 110)
    m.setU32((pClosestCtx + 0x10) >>> 0, 0x6fc47130) // SKILLS_CanUnownedMonsterUseSkillInMode12

    // Player candidate MUST be rejected by 0x6FC47130 (old permissive ': 1' bug accepted it!)
    beginVaTrace113c()
    const rejectRet = SKILLS_FindClosestUnitCallback_6FCBEDB0_113c(m, pFindArg, pPlayer)
    const rejectHits = endVaTrace113c()
    expect(rejectRet).toBe(0)
    expect(rejectHits.has('D2Game:0x6FCBEDB0')).toBe(true)
    expect(rejectHits.has('D2Game:0x6FC47130')).toBe(true)
    expect(m.u32(pClosestCtx)).toBe(0)

    // Eligible unowned monster candidate MUST be accepted and update pBestUnit / distSq=25
    beginVaTrace113c()
    const acceptRet = SKILLS_FindClosestUnitCallback_6FCBEDB0_113c(m, pFindArg, pMon)
    const acceptHits = endVaTrace113c()
    expect(acceptRet).toBe(1)
    expect(acceptHits.has('D2Game:0x6FC47130')).toBe(true)
    expect(m.u32(pClosestCtx)).toBe(pMon)
    expect(m.u32((pClosestCtx + 0x04) >>> 0)).toBe(25)
  })

  it('10. 0x6FCBEEB0 regression: dispatches real caller callbacks (0x6FC2C8D0 / 0x6FC59910 / 0x6FC59930) without hooks', () => {
    const { m, pGame, pRoom } = createWave20World()
    const { pPlayer } = allocPlayerUnit(m, pGame, pRoom, 901, 110, 110)
    const { pMon: pCorpse } = allocMonsterUnit(m, pGame, pRoom, 30, 902, 112, 112)
    m.setU32((pCorpse + 0x10) >>> 0, 12) // dead corpse
    // Link pCorpse into room unit list (pRoom + 0x74) via unit.pRoomUnitNext (+0xE8)
    m.setU32((pRoom + 0x74) >>> 0, pCorpse)
    m.setU32((pCorpse + 0xe8) >>> 0, 0)

    const pSearchSpec = m.alloc(0x28)
    m.setU32(pSearchSpec, 0x1002) // find monster corpses (0x0002 | 0x1000)
    m.setU32((pSearchSpec + 0x04) >>> 0, pPlayer)
    m.setU32((pSearchSpec + 0x08) >>> 0, 0x7c) // Redemption
    m.setU32((pSearchSpec + 0x0c) >>> 0, 110)
    m.setU32((pSearchSpec + 0x10) >>> 0, 110)
    m.setU32((pSearchSpec + 0x14) >>> 0, 10) // radius 10
    m.setU32((pSearchSpec + 0x18) >>> 0, 1) // slvl 1
    m.setU32((pSearchSpec + 0x1c) >>> 0, 0)

    for (const cbVa of [0x6fc2c8d0, 0x6fc59910, 0x6fc59930]) {
      m.setU32((pSearchSpec + 0x20) >>> 0, cbVa)
      beginVaTrace113c()
      SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c(m, pSearchSpec, pGame)
      const hits = endVaTrace113c()
      expect(hits.has('D2Game:0x6FCBEEB0')).toBe(true)
      expect(
        hits.has(`D2Game:0x${cbVa.toString(16).toUpperCase()}`),
        `Expected direct dispatch to 0x${cbVa.toString(16)}`,
      ).toBe(true)
    }
  })

  it('11. 0x6FCDA5E0 regression: formats "changing state to 2\\n" and dispatches [pQuestData+0xF0] = 0x6FCD8A70', () => {
    const { m, pGame, pRoom } = createWave20World()
    const { pPlayer, pQuestRecord } = allocPlayerUnit(m, pGame, pRoom, 1001, 110, 110)
    const { pMon: pTyrael } = allocMonsterUnit(m, pGame, pRoom, 0x16f, 1002, 112, 110)

    const pQuestData = m.alloc(0x100)
    const pQuestExt = m.alloc(0x40)
    const pQuestArg = m.alloc(0x20)
    m.setU32((pQuestData + 0x04) >>> 0, pGame)
    m.setU8((pQuestData + 0x0c) >>> 0, 1)
    m.setU32((pQuestData + 0x10) >>> 0, 0x18) // linked Act4Q2 seqId
    m.setU32((pQuestData + 0x18) >>> 0, pQuestExt)
    m.setU32((pQuestData + 0xe0) >>> 0, 0x19) // Act4Q1 quest id 25
    m.setU32((pQuestData + 0xf0) >>> 0, 0x6fcd8a70) // ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback

    m.setU32(pQuestArg, pGame)
    m.setU32((pQuestArg + 0x08) >>> 0, pTyrael)
    m.setU32((pQuestArg + 0x0c) >>> 0, pPlayer)

    // (a) Scroll 0x29E with debug chat enabled ([0x6FD31C20] = 1) -> exact "changing state to 2\n"
    m.setU32(0x6fd31c20, 1)
    m.setU16((pQuestArg + 0x14) >>> 0, 0x16f)
    m.setU16((pQuestArg + 0x18) >>> 0, 0x29e)
    ACT4Q1_OnNpcMessage_6FCDA5E0_113c(m, pQuestData, pQuestArg)
    expect(m.u8((pQuestData + 0x0c) >>> 0)).toBe(2)
    expect(readCStringFromMem(m, (0x7fff0000 - 0x660) >>> 0)).toBe('changing state to 2\n')

    // (b) Scroll 0x2A4 (Izual reward completion) -> invokes [pQuestData+0xF0] = 0x6FCD8A70 and grants +2 skill pts
    QUESTRECORD_SetQuestState113c(m, pQuestRecord, 0x19, 1)
    QUESTRECORD_SetQuestState113c(m, pQuestRecord, 0x19, 0x0d)
    const beforeSkillPts = STATLIST_GetUnitStat113c(m, pPlayer, 5, 0)
    m.setU16((pQuestArg + 0x18) >>> 0, 0x2a4)

    beginVaTrace113c()
    ACT4Q1_OnNpcMessage_6FCDA5E0_113c(m, pQuestData, pQuestArg)
    const hits = endVaTrace113c()

    expect(hits.has('D2Game:0x6FCDA5E0')).toBe(true)
    expect(hits.has('D2Game:0x6FCD8A70')).toBe(true)
    expect(m.u8((pQuestData + 0x0c) >>> 0)).toBe(5)
    expect(m.u8((pQuestData + 0x0b) >>> 0)).toBe(0x0d)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 5, 0)).toBe(beforeSkillPts + 2)
  })

  it('12. asserts 11/11 live va-trace coverage across all Wave 20 Batch B functions', () => {
    const { m, pGame, pRoom, pObjectsTxtBase } = createWave20World()
    const { pPlayer } = allocPlayerUnit(m, pGame, pRoom, 1101, 110, 110)
    const { pMon } = allocMonsterUnit(m, pGame, pRoom, 0x20f, 1102, 111, 111)

    const pObj = m.alloc(0x100)
    const pObjData = m.alloc(0x40)
    const pObjPath = m.alloc(0x40)
    const pObjTxt = (pObjectsTxtBase + 5 * 0x1c0) >>> 0
    m.setU32(pObj, 2)
    m.setU32((pObj + 0x04) >>> 0, 5)
    m.setU32((pObj + 0x0c) >>> 0, 1103)
    m.setU32((pObj + 0x10) >>> 0, 1)
    m.setU32((pObj + 0x14) >>> 0, pObjData)
    m.setU32((pObj + 0x2c) >>> 0, pObjPath)
    m.setU32((pObj + 0x80) >>> 0, pGame)
    m.setU32(pObjData, pObjTxt)
    SUNIT_InsertServerUnit113c(m, pGame, pObj)

    const pOpArgs = m.alloc(0x20)
    m.setU32(pOpArgs, pGame)
    m.setU32((pOpArgs + 0x04) >>> 0, pObj)
    m.setU32((pOpArgs + 0x08) >>> 0, pPlayer)

    const pFindArg = m.alloc(0x20)
    const pClosestCtx = m.alloc(0x20)
    m.setU32(pFindArg, pGame)
    m.setU32((pFindArg + 0x0c) >>> 0, pClosestCtx)
    m.setU32((pClosestCtx + 0x04) >>> 0, 0x7fffffff)

    const pSearchSpec = m.alloc(0x28)
    m.setU32((pSearchSpec + 0x04) >>> 0, pPlayer)
    m.setU32((pSearchSpec + 0x0c) >>> 0, 110)
    m.setU32((pSearchSpec + 0x10) >>> 0, 110)
    m.setU32((pSearchSpec + 0x14) >>> 0, 5)
    m.setU32((pSearchSpec + 0x20) >>> 0, 0x6fc2c8d0)

    const pQuestData = m.alloc(0x100)
    const pQuestArg = m.alloc(0x20)
    m.setU32((pQuestData + 0x04) >>> 0, pGame)
    m.setU32((pQuestArg + 0x0c) >>> 0, pPlayer)

    beginVaTrace113c()
    AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c(m, pMon, pGame)
    MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c(m, 0, pRoom, pGame, pMon, 0)
    OBJ_RollAndDispatchObjectEffectTable_6FC89E50_113c(m, 0, pPlayer, pGame)
    OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c(m, m.alloc(4), 1103, pGame, pPlayer, 2)
    OBJ_OperateShrine_6FC8DA00_113c(m, pOpArgs)
    D2Game_6FC92220_113c(m, pGame, pPlayer, m.alloc(0x200), m.alloc(0x40))
    MONSTER_StartMode8CastA_6FC96A50_113c(m, pGame, pMon)
    MONSTER_StartMode8CastB_6FC96B20_113c(m, pGame, pMon)
    SKILLS_FindClosestUnitCallback_6FCBEDB0_113c(m, pFindArg, pMon)
    SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c(m, pSearchSpec, pGame)
    ACT4Q1_OnNpcMessage_6FCDA5E0_113c(m, pQuestData, pQuestArg)
    const hits = endVaTrace113c()

    for (const spec of BATCH_B_SPECS) {
      expect(hits.has(`D2Game:${spec.va}`), `Expected live va-trace hit for ${spec.va}`).toBe(true)
    }
  })
})
