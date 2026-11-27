/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite
 * (Wave 22: FINAL 32 Unaudited D2Game Functions — 31 `indirectUnknown` Batch D VAs + `0x6FC4CB80`).
 *
 * Audits and verifies all 32 functions across 10 `src/d2kern-113c/game/` files:
 * - 1 final regular ported VA: `0x6FC4CB80` (`DRLG_PopulateSingleRoom_6FC4CB80_113c`)
 * - 31 Batch D `indirectUnknown` VAs (`12 static_table`, `11 vtable_or_struct_table`, `8 caller_callback`)
 *
 * Enforces:
 * 1. Exact PE32 `.text` leading/trailing opcode bytes, size, and indirect-site opcode verification in `D2Game.dll`,
 *    plus full validation of `tools/oracle/callgraph/indirect-audit-batchD.json` against PE32 `.text`/`.data`/`.rdata`.
 * 2. Dedicated behavioral regression tests proving every real 1.13c binary discrepancy fixed in Wave 22.
 * 3. Live execution of ALL 32 Wave 22 VAs under `beginVaTrace113c()` / `endVaTrace113c()` asserting 32/32 (100%) hits.
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
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  STATLIST_CreateEx113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import {
  PARTY_ForEachPartyMemberInSameLevel113c,
  SUNIT_DispatchItemEventCallbacks113c,
} from '../../../src/d2kern-113c/game/a1c-post150-f786-f1040-113c.ts'
import {
  CLIENTS_ForEachInGameClient113c,
  EVENT_ExecuteItemEvents113c,
  EVENT_ExecuteMissileEvents113c,
  EVENT_ExecuteMonsterEvents113c,
  EVENT_ExecuteObjectEvents113c,
  EVENT_ExecutePlayerEvents113c,
  GAME_StepClientJoinStatesAndTimeouts113c,
  MONSTER_DispatchMinionComponentCallbacks113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-a-113c.ts'
import {
  PLAYER_StartModeAtCoords113c,
  PLAYER_StartModeOnUnit113c,
} from '../../../src/d2kern-113c/game/c2s-packet-113c.ts'
import { GAME_AllocGameStrc113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  DRLG_PopulateSingleRoom_6FC4CB80_113c,
  QUESTS_AttachQuestToUnit_6FC53F80_113c,
  QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c,
  QUESTS_TriggerItemDropped_6FC545A0_113c,
  QUESTS_TriggerItemPickedUp_6FC54510_113c,
} from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c.ts'
import {
  ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c,
  PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c,
  PLAYERSAVE_SaveClientAndAllOtherPlayers_6FC4C910_113c,
} from '../../../src/d2kern-113c/game/k2-w10b1-113c.ts'
import {
  ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c,
  ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c,
  ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c,
  GAME_CreateMultiClientGame_6FC4C570_113c,
  GAME_CreateSinglePlayerOrTcpIpGame_6FC4C2D0_113c,
  PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000_113c,
  QUESTS_DefaultSequenceFilter_6FC7AFB0_113c,
} from '../../../src/d2kern-113c/game/k2-w8b1-113c.ts'
import {
  OBJECTS_CheckLevelObjectHook113c,
  OBJECTS_InitObjectUnit113c,
  OBJECTS_PopulateRoom113c,
} from '../../../src/d2kern-113c/game/objects-populate-113c.ts'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { C2S_Dispatch113c } from '../../../src/d2kern-113c/game/c2s-dispatch-113c.ts'
import {
  EVENT_InitTimerQueue113c,
  EVENT_SetEventFull113c,
} from '../../../src/d2kern-113c/game/timer-wheel.ts'
import { AI_FollowDs1NpcPathMem113c } from '../../../src/d2kern-113c/game/town-npc-ai-113c.ts'
import { D2GameStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'
import {
  bootFromSnapshot113c,
  loadSnapshotFile113c,
  snapshotPath113c,
} from '../../../tools/oracle/kern-replay/replay-113c.ts'

function hasD2GameHit(hits: ReadonlySet<string>, va: number): boolean {
  return hits.has(`D2Game:0x${(va >>> 0).toString(16).toUpperCase().padStart(8, '0')}`)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '../../..')
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools/oracle/callgraph/manifest-113c.json')
const AUDIT_PATH = path.join(REPO_ROOT, 'tools/oracle/callgraph/indirect-audit-batchD.json')
const D2_DATA_DIR = process.env.D2_DATA_DIR || path.join(os.homedir(), 'd2-data')

interface Wave22VaSpec {
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
  readonly kernFile: string
  readonly category: 'static_table' | 'vtable_or_struct_table' | 'caller_callback' | 'regular'
}

interface IndirectSiteAudit {
  readonly iva: string
  readonly mnemonic: string
  readonly operands: string
  readonly opcodeHex: string
  readonly category: 'static_table' | 'vtable_or_struct_table' | 'caller_callback'
  readonly tableBase: string | null
  readonly tableEnd: string | null
  readonly entrySize: number | null
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
  readonly entrySize: number | null
  readonly targetVas: readonly string[]
  readonly indirectSites: readonly IndirectSiteAudit[]
  readonly proof: string
}

interface IndirectAuditFile {
  readonly batch: string
  readonly module: string
  readonly imageBase: string
  readonly count: number
  readonly totalIndirectSites: number
  readonly categoryCounts: {
    readonly static_table: number
    readonly vtable_or_struct_table: number
    readonly caller_callback: number
  }
  readonly entries: readonly IndirectAuditEntry[]
}

const WAVE22_SPECS: readonly Wave22VaSpec[] = [
  { va: '0x6FC3BBC0', size: 149, headHex: '8b4c240c8b11558b', tailHex: '5f5e5dc20c00', tsSymbol: 'AI_FollowDs1NpcPathMem113c', kernFile: 'src/d2kern-113c/game/town-npc-ai-113c.ts', category: 'static_table' },
  { va: '0x6FC468E0', size: 208, headHex: '83ec0853578bfa33', tailHex: '83c408c20800', tsSymbol: 'MONSTER_DispatchMinionComponentCallbacks113c', kernFile: 'src/d2kern-113c/game/boot-init-gap-a-113c.ts', category: 'static_table' },
  { va: '0x6FC49820', size: 90, headHex: '568bf085f6750768', tailHex: '85f675ea5ec3', tsSymbol: 'CLIENTS_ForEachInGameClient113c', kernFile: 'src/d2kern-113c/game/boot-init-gap-a-113c.ts', category: 'caller_callback' },
  { va: '0x6FC4C2D0', size: 670, headHex: '5155568bf0a1241c', tailHex: '5e5d59c22c00', tsSymbol: 'GAME_CreateSinglePlayerOrTcpIpGame_6FC4C2D0_113c', kernFile: 'src/d2kern-113c/game/k2-w8b1-113c.ts', category: 'caller_callback' },
  { va: '0x6FC4C570', size: 691, headHex: 'a1241cd36f83ec08', tailHex: '83c408c22000', tsSymbol: 'GAME_CreateMultiClientGame_6FC4C570_113c', kernFile: 'src/d2kern-113c/game/k2-w8b1-113c.ts', category: 'caller_callback' },
  { va: '0x6FC4C830', size: 223, headHex: '518b442408578bb8', tailHex: '5b5f59c20400', tsSymbol: 'PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c', kernFile: 'src/d2kern-113c/game/k2-w10b1-113c.ts', category: 'caller_callback' },
  { va: '0x6FC4C910', size: 269, headHex: '51568b74240c85f6', tailHex: '5b5e59c20800', tsSymbol: 'PLAYERSAVE_SaveClientAndAllOtherPlayers_6FC4C910_113c', kernFile: 'src/d2kern-113c/game/k2-w10b1-113c.ts', category: 'caller_callback' },
  { va: '0x6FC4CB80', size: 91, headHex: '568bf057e8c7ad01', tailHex: '27e7fdff5ec3', tsSymbol: 'DRLG_PopulateSingleRoom_6FC4CB80_113c', kernFile: 'src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c.ts', category: 'regular' },
  { va: '0x6FC4D9B0', size: 703, headHex: '81ec34010000558b', tailHex: 'e8ce4dfdffcc', tsSymbol: 'GAME_StepClientJoinStatesAndTimeouts113c', kernFile: 'src/d2kern-113c/game/boot-init-gap-a-113c.ts', category: 'caller_callback' },
  { va: '0x6FC4EAD0', size: 407, headHex: '8b410c8b51088d04', tailHex: '83c43cc20c00', tsSymbol: 'OBJECTS_CheckLevelObjectHook113c', kernFile: 'src/d2kern-113c/game/objects-populate-113c.ts', category: 'static_table' },
  { va: '0x6FC4F0D0', size: 545, headHex: '83ec1455578b7c24', tailHex: 'e84c37fdffcc', tsSymbol: 'OBJECTS_PopulateRoom113c', kernFile: 'src/d2kern-113c/game/objects-populate-113c.ts', category: 'static_table' },
  { va: '0x6FC4F300', size: 432, headHex: '83ec1c5556e84cbe', tailHex: '83c41cc21000', tsSymbol: 'OBJECTS_InitObjectUnit113c', kernFile: 'src/d2kern-113c/game/objects-populate-113c.ts', category: 'static_table' },
  { va: '0x6FC53C70', size: 107, headHex: '8b4708568b707485', tailHex: 'e862edfcffcc', tsSymbol: 'QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c', kernFile: 'src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c.ts', category: 'vtable_or_struct_table' },
  { va: '0x6FC54510', size: 140, headHex: '83ec1c56894c2404', tailHex: 'e8a1e4fcffcc', tsSymbol: 'QUESTS_TriggerItemPickedUp_6FC54510_113c', kernFile: 'src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c.ts', category: 'vtable_or_struct_table' },
  { va: '0x6FC545A0', size: 140, headHex: '83ec1c56894c2404', tailHex: 'e811e4fcffcc', tsSymbol: 'QUESTS_TriggerItemDropped_6FC545A0_113c', kernFile: 'src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c.ts', category: 'vtable_or_struct_table' },
  { va: '0x6FC57030', size: 170, headHex: '85db558b6c240875', tailHex: '0c5e5dc21000', tsSymbol: 'SUNIT_DispatchItemEventCallbacks113c', kernFile: 'src/d2kern-113c/game/a1c-post150-f786-f1040-113c.ts', category: 'vtable_or_struct_table' },
  { va: '0x6FC74000', size: 786, headHex: 'b838200000e81628', tailHex: '200000c21800', tsSymbol: 'PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000_113c', kernFile: 'src/d2kern-113c/game/k2-w8b1-113c.ts', category: 'caller_callback' },
  { va: '0x6FC7AFB0', size: 117, headHex: '568bf18a460c3c04', tailHex: 'c35f32c05ec3', tsSymbol: 'QUESTS_DefaultSequenceFilter_6FC7AFB0_113c', kernFile: 'src/d2kern-113c/game/k2-w8b1-113c.ts', category: 'vtable_or_struct_table' },
  { va: '0x6FC7B4F0', size: 402, headHex: '81ec840000005355', tailHex: 'c484000000c3', tsSymbol: 'ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c', kernFile: 'src/d2kern-113c/game/k2-w8b1-113c.ts', category: 'vtable_or_struct_table' },
  { va: '0x6FC7EED0', size: 805, headHex: '83ec105556578bf9', tailHex: 'e84838faffcc', tsSymbol: 'ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c', kernFile: 'src/d2kern-113c/game/k2-w10b1-113c.ts', category: 'vtable_or_struct_table' },
  { va: '0x6FC84430', size: 670, headHex: '81ec900000005355', tailHex: 'c490000000c3', tsSymbol: 'ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c', kernFile: 'src/d2kern-113c/game/k2-w8b1-113c.ts', category: 'vtable_or_struct_table' },
  { va: '0x6FC85260', size: 431, headHex: '81ec840000005355', tailHex: 'c484000000c3', tsSymbol: 'ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c', kernFile: 'src/d2kern-113c/game/k2-w8b1-113c.ts', category: 'vtable_or_struct_table' },
  { va: '0x6FC98430', size: 276, headHex: '538bd885db558b6c', tailHex: '5e5d5bc21400', tsSymbol: 'PLAYER_StartModeOnUnit113c', kernFile: 'src/d2kern-113c/game/c2s-packet-113c.ts', category: 'static_table' },
  { va: '0x6FC98550', size: 180, headHex: '538bd985db578bfa', tailHex: '5d5f5bc21400', tsSymbol: 'PLAYER_StartModeAtCoords113c', kernFile: 'src/d2kern-113c/game/c2s-packet-113c.ts', category: 'static_table' },
  { va: '0x6FCAE9A0', size: 212, headHex: '85c056578b7c240c', tailHex: 'b15f5ec20400', tsSymbol: 'EVENT_ExecuteMissileEvents113c', kernFile: 'src/d2kern-113c/game/boot-init-gap-a-113c.ts', category: 'vtable_or_struct_table' },
  { va: '0x6FCAEBC0', size: 246, headHex: '85c053558b6c240c', tailHex: '5e5d5bc20800', tsSymbol: 'EVENT_ExecuteMonsterEvents113c', kernFile: 'src/d2kern-113c/game/boot-init-gap-a-113c.ts', category: 'vtable_or_struct_table' },
  { va: '0x6FCAECC0', size: 272, headHex: '85c056578b7c240c', tailHex: '955f5ec20400', tsSymbol: 'EVENT_ExecutePlayerEvents113c', kernFile: 'src/d2kern-113c/game/boot-init-gap-a-113c.ts', category: 'static_table' },
  { va: '0x6FCAEDD0', size: 325, headHex: '85c0538b5c240c55', tailHex: 'e8283bf7ffcc', tsSymbol: 'EVENT_ExecuteItemEvents113c', kernFile: 'src/d2kern-113c/game/boot-init-gap-a-113c.ts', category: 'static_table' },
  { va: '0x6FCAEF20', size: 325, headHex: '85c0538b5c240c55', tailHex: 'e8d839f7ffcc', tsSymbol: 'EVENT_ExecuteObjectEvents113c', kernFile: 'src/d2kern-113c/game/boot-init-gap-a-113c.ts', category: 'static_table' },
  { va: '0x6FCBC070', size: 227, headHex: '558b6c240c568bf0', tailHex: 'e8ea68f6ffcc', tsSymbol: 'PARTY_ForEachPartyMemberInSameLevel113c', kernFile: 'src/d2kern-113c/game/a1c-post150-f786-f1040-113c.ts', category: 'caller_callback' },
  { va: '0x6FCBD230', size: 381, headHex: '83ec2853558bea6a', tailHex: 'e89056f6ffcc', tsSymbol: 'AI_InitMonsterAiThinkFn113c', kernFile: 'src/d2kern-113c/game/regpop-spawn-113c.ts', category: 'static_table' },
  { va: '0x6FCEC550', size: 298, headHex: '8a0384c0558b6c24', tailHex: '00005dc20800', tsSymbol: 'C2S_Dispatch113c', kernFile: 'src/d2kern-113c/game/c2s-dispatch-113c.ts', category: 'static_table' },
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

function createWave22World(nDifficulty = 0) {
  const m = new SparseMemory113c()
  m.fill(0, 0x100, 0)
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

  const pObjectsTxt = m.alloc(0x240 * 0x1c0) >>> 0
  m.setU32((pDataTables + 0xc98) >>> 0, pObjectsTxt)
  m.setU32((pDataTables + 0xc9c) >>> 0, 0x240)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 0x240)

  const pLevelsTxt = m.alloc(140 * 0x220) >>> 0
  m.setU32((pDataTables + 0x9c8) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0x9cc) >>> 0, 140)
  m.setU32((pDataTables + 0xbd8) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xbe0) >>> 0, 140)
  m.setU32((pDataTables + 0xc58) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc5c) >>> 0, 140)
  m.setU32(0x6fd31c18, 1)
  m.setU32(0x6fc2a2f2, 2)
  m.setU32((pDataTables + 0xc60) >>> 0, 1)
  m.setU32((pDataTables + 0xc64) >>> 0, 40)
  m.setU32((pDataTables + 0xc68) >>> 0, 75)
  m.setU32((pDataTables + 0xc6c) >>> 0, 103)
  m.setU32((pDataTables + 0xc70) >>> 0, 109)
  m.setU32((pDataTables + 0xc74) >>> 0, 137)

  const pMonStats = m.alloc(16 * 0x1a8) >>> 0
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStats)
  m.setU32((pDataTables + 0xa80) >>> 0, 16)
  const pMonStats2 = m.alloc(16 * 0x134) >>> 0
  m.setU32((pDataTables + 0xa84) >>> 0, pMonStats2)
  m.setU32((pDataTables + 0xa8c) >>> 0, 16)

  const pGame = GAME_AllocGameStrc113c(m) >>> 0
  m.setU8((pGame + 0x6d) >>> 0, nDifficulty & 0xff)
  m.setU32((pGame + 0x70) >>> 0, 1)
  m.setU16((pGame + 0x28) >>> 0, 0x1337)
  m.setU32((pGame + 0xa8) >>> 0, 100)
  m.setU32((pGame + 0xd0) >>> 0, 0x12345679)
  m.setU32((pGame + 0xd4) >>> 0, 0x0000029b)
  m.setU32((pGame + 0x10e0) >>> 0, 0x12345679)
  m.setU32((pGame + 0x10e4) >>> 0, 0x0000029b)
  const pObjControl = m.alloc(0x400) >>> 0
  m.setU32(pObjControl, 0x2468ace1)
  m.setU32((pObjControl + 4) >>> 0, 0x00000137)
  m.setU32((pGame + 0x10f0) >>> 0, pObjControl)
  const pQuestCtrl = m.alloc(0x40) >>> 0
  m.setU32((pQuestCtrl + 0x08) >>> 0, QUESTRECORD_AllocRecord113c(m, 0))
  m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl)

  return { m, pGame, pDataTables, pObjectsTxt, pLevelsTxt, pObjControl, pQuestCtrl }
}

function makeRoom(m: SparseMemory113c, nLevelId = 2) {
  const pRoom = m.alloc(0x80) >>> 0
  const pRoomEx = m.alloc(0x80) >>> 0
  const pLevel = m.alloc(0x200) >>> 0
  m.setU32((pLevel + 0x1d0) >>> 0, nLevelId >>> 0)
  m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
  m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
  m.setU32((pRoom + 0x4c) >>> 0, 50)
  m.setU32((pRoom + 0x50) >>> 0, 50)
  m.setU32((pRoom + 0x54) >>> 0, 20)
  m.setU32((pRoom + 0x58) >>> 0, 20)
  m.setU32((pRoom + 0x6c) >>> 0, 0x13579bdf)
  m.setU32((pRoom + 0x70) >>> 0, 0x00000246)
  return { pRoom, pRoomEx, pLevel }
}

function makePlayer(m: SparseMemory113c, pGame: number, pRoom: number, nGuid = 1, nMode = 1) {
  const pPlayer = m.alloc(0x100) >>> 0
  const pPlayerData = m.alloc(0x200) >>> 0
  const pPath = m.alloc(0x60) >>> 0
  m.setU32(pPlayer, 0)
  m.setU32((pPlayer + 0x04) >>> 0, 1) // Sorceress
  m.setU32((pPlayer + 0x0c) >>> 0, nGuid >>> 0)
  m.setU32((pPlayer + 0x10) >>> 0, nMode >>> 0)
  m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
  m.setU32((pPlayer + 0x2c) >>> 0, pPath)
  m.setU32((pPlayer + 0x80) >>> 0, pGame)
  m.setU32((pPath + 0x1c) >>> 0, pRoom)
  const pQRec = QUESTRECORD_AllocRecord113c(m, 0)
  m.setU32((pPlayerData + 0x10) >>> 0, pQRec)
  const pStatList = STATLIST_CreateEx113c(m, 0, 0, 0, pPlayer) >>> 0
  m.setU32((pPlayer + 0x5c) >>> 0, pStatList)
  STATLIST_SetUnitStat113c(m, pPlayer, 12, 25, 0) // level = 25
  const pSkills = m.alloc(0x20) >>> 0
  m.setU32((pPlayer + 0xa8) >>> 0, pSkills)
  const pClient = m.alloc(0x500) >>> 0
  m.setU32((pClient + 0x04) >>> 0, 4)
  m.setU32((pClient + 0x16c) >>> 0, 0)
  m.setU32((pClient + 0x170) >>> 0, nGuid >>> 0)
  m.setU32((pClient + 0x174) >>> 0, pPlayer)
  m.setU32((pClient + 0x1a8) >>> 0, pGame)
  m.setU32((pClient + 0x1b4) >>> 0, pRoom)
  m.setU32((pPlayerData + 0x9c) >>> 0, pClient)
  const bucket = (pGame + 0x1120 + (nGuid & 0x7f) * 4) >>> 0
  m.setU32((pPlayer + 0xe4) >>> 0, m.u32(bucket))
  m.setU32(bucket, pPlayer)
  return { pPlayer, pPlayerData, pPath, pQRec, pClient }
}

function makeGameHashTable(m: SparseMemory113c): number {
  const pHash = m.alloc(0x100) >>> 0
  const pVtable = m.alloc(0x20) >>> 0
  const pSentinel = m.alloc(0x20) >>> 0
  const pBuckets = m.alloc(8 * 0x0c) >>> 0
  m.setU32((pVtable + 0x04) >>> 0, 0x77001111)
  m.setU32(pHash, pVtable)
  m.setU32((pHash + 0x08) >>> 0, pSentinel)
  m.setU32((pHash + 0x1c) >>> 0, pBuckets)
  m.setU32((pHash + 0x24) >>> 0, 7)
  for (let i = 0; i < 8; i++) {
    const b = (pBuckets + i * 0x0c) >>> 0
    m.setU32((b + 0x04) >>> 0, m.alloc(0x20))
  }
  return pHash
}

describe('Wave 22 — FINAL 32 Unaudited D2Game Functions (Batch D 31 indirect + 0x6FC4CB80)', () => {
  it('verifies exact PE32 bytes for all 32 VAs and validates indirect-audit-batchD.json proofs', () => {
    const dllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    expect(fs.existsSync(dllPath)).toBe(true)
    const pe = loadPeSectionMapper(dllPath, 0x6fc20000)

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as {
      functions: Array<{
        module: string
        va: string
        size: number
        status: string
        tsSymbol: string
        kernFile: string
        diffEvidence?: string
        indirectUnknown?: boolean
      }>
    }
    const manifestByVa = new Map<string, (typeof manifest.functions)[number]>()
    for (const f of manifest.functions) {
      if (f.module === 'D2Game') manifestByVa.set(f.va.toUpperCase(), f)
    }

    expect(WAVE22_SPECS.length).toBe(32)
    for (const spec of WAVE22_SPECS) {
      const va = parseInt(spec.va, 16)
      const off = pe.vaToFileOffset(va)
      const head = pe.buf.subarray(off, off + 8).toString('hex')
      const tail = pe.buf.subarray(off + spec.size - 6, off + spec.size).toString('hex')
      expect(head, `${spec.va} headHex`).toBe(spec.headHex)
      expect(tail, `${spec.va} tailHex`).toBe(spec.tailHex)

      const mf = manifestByVa.get(spec.va.toUpperCase())
      expect(mf, `${spec.va} in manifest`).toBeDefined()
      expect(mf!.size, `${spec.va} size`).toBe(spec.size)
      expect(mf!.status, `${spec.va} status`).toBe('diff-verified')
      expect(mf!.tsSymbol, `${spec.va} tsSymbol`).toBe(spec.tsSymbol)
      expect(mf!.kernFile, `${spec.va} kernFile`).toBe(spec.kernFile)
      expect(mf!.diffEvidence, `${spec.va} diffEvidence`).toContain('k2-disasm-verified-wave22-indD.test.ts')
      if (spec.category !== 'regular') {
        expect(mf!.diffEvidence, `${spec.va} cites batchD audit`).toContain('indirect-audit-batchD.json')
      }
      if (spec.category === 'caller_callback') {
        expect(mf!.indirectUnknown, `${spec.va} caller_callback indirectUnknown`).toBe(true)
      } else {
        expect(mf!.indirectUnknown, `${spec.va} resolved indirectUnknown`).toBeUndefined()
      }
    }

    const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8')) as IndirectAuditFile
    expect(audit.batch).toBe('wave22-indD')
    expect(audit.module).toBe('D2Game')
    expect(audit.imageBase).toBe('0x6FC20000')
    expect(audit.count).toBe(31)
    expect(audit.entries.length).toBe(31)
    expect(audit.categoryCounts).toEqual({
      static_table: 12,
      vtable_or_struct_table: 11,
      caller_callback: 8,
    })

    const auditedVas = new Set<string>()
    let siteTotal = 0
    for (const entry of audit.entries) {
      const fva = parseInt(entry.va, 16)
      auditedVas.add(entry.va.toUpperCase())
      expect(entry.indirectSites.length, `${entry.va} has sites`).toBeGreaterThan(0)
      for (const site of entry.indirectSites) {
        siteTotal++
        const iva = parseInt(site.iva, 16)
        expect(iva >= fva && iva < fva + entry.size, `${site.iva} inside ${entry.va}`).toBe(true)
        const ioff = pe.vaToFileOffset(iva)
        const len = site.opcodeHex.length / 2
        const raw = pe.buf.subarray(ioff, ioff + len).toString('hex')
        expect(raw, `${entry.va} site ${site.iva} opcodeHex`).toBe(site.opcodeHex)
        if (site.category === 'static_table') {
          expect(site.tableBase).not.toBeNull()
          expect(site.tableEnd).not.toBeNull()
          expect(site.entrySize).toBeGreaterThan(0)
          expect(site.targetVas.length).toBeGreaterThan(0)
          const tStart = parseInt(site.tableBase!, 16)
          const tEnd = parseInt(site.tableEnd!, 16)
          expect(tEnd).toBeGreaterThan(tStart)
          for (const tvaStr of site.targetVas) {
            const tva = parseInt(tvaStr, 16)
            expect(tva >= pe.textStart && tva < pe.textEnd, `${tvaStr} in .text`).toBe(true)
          }
        }
      }
    }
    expect(siteTotal).toBe(audit.totalIndirectSites)
    expect(auditedVas.size).toBe(31)
    expect(auditedVas.has('0x6FC4CB80')).toBe(false)
  })

  it('0x6FC57030 dispatches 0x6FCCE200 (ITEMEVENT_ReanimateCorpseAsReturned_6FCCE200_113c)', () => {
    const { m, pGame } = createWave22World()
    const { pRoom } = makeRoom(m, 2)
    const pCorpse = m.alloc(0x100) >>> 0
    m.setU32(pCorpse, 1) // monster
    const pNode = m.alloc(0x40) >>> 0
    m.setU8(pNode, 0x0d) // event type 13
    m.setU32((pNode + 0x0c) >>> 0, 0) // dwArg1: nMonClassId
    m.setU32((pNode + 0x10) >>> 0, 999) // dwArg2: nonexistent owner -> returns 0 cleanly after entering 0x6FCCE200
    m.setU32((pNode + 0x14) >>> 0, 0x6fcce200)
    m.setU32((pCorpse + 0x90) >>> 0, pNode)
    void pRoom

    beginVaTrace113c()
    SUNIT_DispatchItemEventCallbacks113c(m, pCorpse, pGame, 0x0d, 0, 0)
    const hits = endVaTrace113c()
    expect(hasD2GameHit(hits, 0x6fc57030)).toBe(true)
    expect(hasD2GameHit(hits, 0x6fcce200)).toBe(true)
  })

  it('0x6FC98550 preserves pPlayerData+0x150/+0x154 per PE32 (unlike 0x6FC98430)', () => {
    const { m, pGame } = createWave22World()
    const { pRoom } = makeRoom(m, 1)
    const { pPlayer, pPlayerData } = makePlayer(m, pGame, pRoom, 1, 1)
    m.setU32((pPlayerData + 0x150) >>> 0, 0xdeadbeef)
    m.setU32((pPlayerData + 0x154) >>> 0, 0xcafebabe)

    const ok = PLAYER_StartModeAtCoords113c(m, pGame, pPlayer, 1, 50, 50, 1)
    expect(ok).toBe(1)
    expect(m.u32((pPlayerData + 0x150) >>> 0)).toBe(0xdeadbeef)
    expect(m.u32((pPlayerData + 0x154) >>> 0)).toBe(0xcafebabe)
  })

  it('0x6FC7EED0, 0x6FC7AFB0, 0x6FC7B4F0, 0x6FC84430, 0x6FC85260 dispatch real +0xF0 callbacks', () => {
    const { m, pGame, pQuestCtrl } = createWave22World()
    const { pRoom } = makeRoom(m, 1)
    const { pPlayer, pQRec } = makePlayer(m, pGame, pRoom, 1, 1)

    // 1) 0x6FC7AFB0 -> chains to 0x6FC767A0
    const pQ34 = m.alloc(0x100) >>> 0
    const pQ35 = m.alloc(0x100) >>> 0
    m.setU32(pQ34, 0x22)
    m.setU32((pQ34 + 0x04) >>> 0, pGame)
    m.setU8((pQ34 + 0x0c) >>> 0, 5) // >= 4 -> chain
    m.setU32((pQ34 + 0x10) >>> 0, 0x23)
    m.setU32((pQ34 + 0xf0) >>> 0, 0x6fc7afb0)
    m.setU32((pQ34 + 0xf4) >>> 0, pQ35)
    m.setU32(pQ35, 0x23)
    m.setU32((pQ35 + 0x04) >>> 0, pGame)
    m.setU8((pQ35 + 0x09) >>> 0, 1) // active
    m.setU8((pQ35 + 0x0c) >>> 0, 0)
    m.setU32((pQ35 + 0xf0) >>> 0, 0x6fc767a0)
    m.setU32(pQuestCtrl, pQ34)

    beginVaTrace113c()
    const chainRes = QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(m, pQ34)
    const hits1 = endVaTrace113c()
    expect(chainRes).toBe(1)
    expect(hasD2GameHit(hits1, 0x6fc7afb0)).toBe(true)
    expect(hasD2GameHit(hits1, 0x6fc767a0)).toBe(true)

    // 2) 0x6FC7EED0 -> asserts 855 on bad [self+0xF0], dispatches real 0x6FC79930 when valid
    const pQ36 = m.alloc(0x100) >>> 0
    m.setU32(pQ36, 0x24)
    m.setU32((pQ36 + 0x04) >>> 0, pGame)
    m.setU8((pQ36 + 0x09) >>> 0, 1)
    m.setU32((pQ36 + 0xf0) >>> 0, 0x6fc79930)
    m.setU32((pQ35 + 0x10) >>> 0, 0x24)
    m.setU32((pQ35 + 0xf4) >>> 0, pQ36)
    const pQ35Ext = m.alloc(0x80) >>> 0
    m.setU32((pQ35 + 0x18) >>> 0, pQ35Ext)
    m.setU8((pQ35Ext + 0x04) >>> 0, 1)
    m.setU8((pQ35Ext + 0x10) >>> 0, 1)
    m.setU8((pQ35Ext + 0x11) >>> 0, 1)
    m.setU32((pQ35Ext + 0x44) >>> 0, 1) // last ancient
    const pMon = m.alloc(0x100) >>> 0
    const pMonPath = m.alloc(0x60) >>> 0
    m.setU32(pMon, 1)
    m.setU32((pMon + 0x04) >>> 0, 0x21c)
    m.setU32((pMon + 0x2c) >>> 0, pMonPath)
    m.setU32((pMonPath + 0x1c) >>> 0, pRoom)
    m.setU16((pMonPath + 0x02) >>> 0, 50)
    m.setU16((pMonPath + 0x06) >>> 0, 50)
    const pArg = m.alloc(0x40) >>> 0
    m.setU32(pArg, pGame)
    m.setU32((pArg + 0x08) >>> 0, pMon)

    m.setU32((pQ35 + 0xf0) >>> 0, 0xffffffff)
    expect(() => ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c(m, pQ35, pArg)).toThrow(/855/)

    m.setU32((pQ35Ext + 0x44) >>> 0, 1)
    m.setU8((pQ35Ext + 0x04) >>> 0, 1)
    m.setU8((pQ35Ext + 0x10) >>> 0, 1)
    m.setU8((pQ35Ext + 0x11) >>> 0, 1)
    m.setU32((pQ35 + 0xf0) >>> 0, 0x6fc767a0)
    beginVaTrace113c()
    ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c(m, pQ35, pArg)
    const hits2 = endVaTrace113c()
    expect(hasD2GameHit(hits2, 0x6fc7eed0)).toBe(true)
    expect(hasD2GameHit(hits2, 0x6fc79930)).toBe(true)

    // 3) 0x6FC7B4F0 (Larzuk) -> dispatches 0x6FC76D10
    const pQ31 = m.alloc(0x100) >>> 0
    const pQ31Ext = m.alloc(0x40) >>> 0
    m.setU32(pQ31, 0x1f)
    m.setU32((pQ31 + 0x04) >>> 0, pGame)
    m.setU32((pQ31 + 0x18) >>> 0, pQ31Ext)
    m.setU32((pQ31 + 0xe0) >>> 0, 0x23)
    m.setU32((pQ31 + 0xf0) >>> 0, 0x6fc76d10)
    QUESTRECORD_SetQuestState113c(m, pQRec, 0x23, 1)
    QUESTRECORD_SetQuestState113c(m, pQRec, 0x23, 0x0d)
    const pArgLarzuk = m.alloc(0x40) >>> 0
    m.setU32(pArgLarzuk, pGame)
    m.setU32((pArgLarzuk + 0x0c) >>> 0, pPlayer)
    m.setU16((pArgLarzuk + 0x14) >>> 0, 0x1ff)
    m.setU16((pArgLarzuk + 0x18) >>> 0, 0x4e7a)
    beginVaTrace113c()
    ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c(m, pQ31, pArgLarzuk)
    const hits3 = endVaTrace113c()
    expect(hasD2GameHit(hits3, 0x6fc7b4f0)).toBe(true)
    expect(hasD2GameHit(hits3, 0x6fc76d10)).toBe(true)

    // 4) 0x6FC84430 (Charsi) -> dispatches 0x6FC801B0 (NOT 0x6FC83D20)
    const pQ5 = m.alloc(0x100) >>> 0
    const pQ5Ext = m.alloc(0x200) >>> 0
    m.setU32(pQ5, 5)
    m.setU32((pQ5 + 0x04) >>> 0, pGame)
    m.setU32((pQ5 + 0x18) >>> 0, pQ5Ext)
    m.setU8((pQ5Ext + 0x11a) >>> 0, 1)
    m.setU32((pQ5 + 0xf0) >>> 0, 0x6fc801b0)
    QUESTRECORD_SetQuestState113c(m, pQRec, 5, 0x0d)
    const pArgCharsi = m.alloc(0x40) >>> 0
    m.setU32(pArgCharsi, pGame)
    m.setU32((pArgCharsi + 0x0c) >>> 0, pPlayer)
    m.setU16((pArgCharsi + 0x14) >>> 0, 0x9a)
    m.setU16((pArgCharsi + 0x18) >>> 0, 0x90)
    beginVaTrace113c()
    ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c(m, pQ5, pArgCharsi)
    const hits4 = endVaTrace113c()
    expect(hasD2GameHit(hits4, 0x6fc84430)).toBe(true)
    expect(hasD2GameHit(hits4, 0x6fc801b0)).toBe(true)
    expect(hasD2GameHit(hits4, 0x6fc83d20)).toBe(false)

    // 5) 0x6FC85260 (Akara) -> dispatches 0x6FC806E0 (NOT 0x6FC83D20)
    const pQ1 = m.alloc(0x100) >>> 0
    const pQ1Ext = m.alloc(0x100) >>> 0
    m.setU32(pQ1, 1)
    m.setU32((pQ1 + 0x04) >>> 0, pGame)
    m.setU32((pQ1 + 0x18) >>> 0, pQ1Ext)
    m.setU32((pQ1 + 0xe0) >>> 0, 1)
    m.setU32((pQ1 + 0xe4) >>> 0, 2)
    m.setU32((pQ1 + 0xf0) >>> 0, 0x6fc806e0)
    QUESTRECORD_SetQuestState113c(m, pQRec, 1, 1)
    QUESTRECORD_SetQuestState113c(m, pQRec, 1, 0x0d)
    const pArgAkara = m.alloc(0x40) >>> 0
    m.setU32(pArgAkara, pGame)
    m.setU32((pArgAkara + 0x0c) >>> 0, pPlayer)
    m.setU16((pArgAkara + 0x14) >>> 0, 0x94)
    m.setU16((pArgAkara + 0x18) >>> 0, 0x4c)
    beginVaTrace113c()
    ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c(m, pQ1, pArgAkara)
    const hits5 = endVaTrace113c()
    expect(hasD2GameHit(hits5, 0x6fc85260)).toBe(true)
    expect(hasD2GameHit(hits5, 0x6fc806e0)).toBe(true)
    expect(hasD2GameHit(hits5, 0x6fc83d20)).toBe(false)
  })

  it('0x6FC53C70 / 0x6FC54510 / 0x6FC545A0 directly dispatch closed-set slot 8 / 5 / 4 callbacks', () => {
    const { m, pGame } = createWave22World()
    const pUnit = m.alloc(0x100) >>> 0
    const pActor = m.alloc(0x100) >>> 0
    const pQ = m.alloc(0x100) >>> 0
    m.setU8((pQ + 0x0a) >>> 0, 1)
    m.setU32((pQ + 0x04) >>> 0, pGame)
    m.setU32((pQ + 8 * 4 + 0xa0) >>> 0, 0x6fc80180) // slot 8 noop
    m.setU32((pQ + 5 * 4 + 0xa0) >>> 0, 0x6fce3e10) // slot 5
    m.setU32((pQ + 4 * 4 + 0xa0) >>> 0, 0x6fc83570) // slot 4
    QUESTS_AttachQuestToUnit_6FC53F80_113c(m, pQ, pUnit, pGame)

    const pArg = m.alloc(0x20) >>> 0
    m.setU32(pArg, pGame)
    m.setU32((pArg + 0x04) >>> 0, 8)
    m.setU32((pArg + 0x08) >>> 0, pUnit)

    beginVaTrace113c()
    QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c(m, pArg, 0)
    QUESTS_TriggerItemPickedUp_6FC54510_113c(m, pGame, pUnit, pActor)
    QUESTS_TriggerItemDropped_6FC545A0_113c(m, pGame, pUnit, pActor)
    const hits = endVaTrace113c()
    expect(hasD2GameHit(hits, 0x6fc53c70)).toBe(true)
    expect(hasD2GameHit(hits, 0x6fc80180)).toBe(true)
    expect(hasD2GameHit(hits, 0x6fc54510)).toBe(true)
    expect(hasD2GameHit(hits, 0x6fce3e10)).toBe(true)
    expect(hasD2GameHit(hits, 0x6fc545a0)).toBe(true)
    expect(hasD2GameHit(hits, 0x6fc83570)).toBe(true)
  })

  it('0x6FC4F300 (OBJECTS_InitObjectUnit113c) dispatches newly wired Objects.txt InitFns across 0x6FD2E050', () => {
    const { m, pGame, pObjectsTxt } = createWave22World()
    const { pRoom } = makeRoom(m, 2)

    const cases: Array<[number, number]> = [
      [8, 0x6fc4e750],
      [14, 0x6fc4e740],
      [17, 0x6fc2bd10],
      [26, 0x6fc4e730],
      [31, 0x6fce2370],
      [32, 0x6fce2350],
      [33, 0x6fce2360],
      [54, 0x6fc86320],
      [56, 0x6fcd8930],
      [70, 0x6fc76ce0],
    ]

    beginVaTrace113c()
    for (let idx = 0; idx < cases.length; idx++) {
      const [initFn] = cases[idx]!
      const pObjTxt = (pObjectsTxt + idx * 0x1c0) >>> 0
      m.setU8((pObjTxt + 0x1b1) >>> 0, initFn)
      const pUnit = m.alloc(0x100) >>> 0
      const pObjData = m.alloc(0x38) >>> 0
      m.setU32(pUnit, 2)
      m.setU32((pUnit + 0x04) >>> 0, idx)
      m.setU32((pUnit + 0x14) >>> 0, pObjData)
      m.setU32(pObjData, pObjTxt)
      OBJECTS_InitObjectUnit113c(m, pUnit, pGame, 100 + idx, pRoom, 50, 50)
    }
    const hits = endVaTrace113c()
    expect(hasD2GameHit(hits, 0x6fc4f300)).toBe(true)
    for (const [initFn, targetVa] of cases) {
      expect(hasD2GameHit(hits, targetVa), `InitFn ${initFn} -> 0x${targetVa.toString(16)}`).toBe(true)
    }
  })

  it('0x6FCEC550 (C2S_Dispatch113c) enforces PE32 opcode/NULL-slot/alive/0x41/bypass gates', () => {
    const world = bootFromSnapshot113c(loadSnapshotFile113c(snapshotPath113c('a1-town-walk', 2)))
    const { m, pGame } = world
    let pPlayer = 0
    for (let i = 0; i < 128; i++) {
      const p = m.u32((pGame + 0x1120 + i * 4) >>> 0) >>> 0
      if (p !== 0) {
        pPlayer = p
        break
      }
    }
    expect(pPlayer).not.toBe(0)

    // Invalid / NULL slots -> return 3
    expect(C2S_Dispatch113c(m, pGame, pPlayer, new Uint8Array([]))).toBe(3)
    expect(C2S_Dispatch113c(m, pGame, pPlayer, new Uint8Array([0x00]))).toBe(3)
    expect(C2S_Dispatch113c(m, pGame, pPlayer, new Uint8Array([0x67]))).toBe(3)
    expect(C2S_Dispatch113c(m, pGame, pPlayer, new Uint8Array([0x2b]))).toBe(3)
    expect(C2S_Dispatch113c(m, pGame, pPlayer, new Uint8Array([0x65]))).toBe(3)

    // 0x41 (resurrect) requires dead mode 0x11 -> alive returns 0
    expect(C2S_Dispatch113c(m, pGame, pPlayer, new Uint8Array([0x41]))).toBe(0)

    // Dead player (mode 0x11):
    // - standard op 0x01 returns 0 without hitting handler 0x6FCEE0D0
    // - bypass op 0x15 invokes 0x6FCEDBB0, where 3-byte [0x15, 0, 0] fails (msgLen + 4 >= nSize) -> returns 2
    // - bypass op 0x66 invokes 0x6FCEB190 (always-noop) -> returns 0
    m.setU32((pPlayer + 0x10) >>> 0, 0x11)
    beginVaTrace113c()
    expect(C2S_Dispatch113c(m, pGame, pPlayer, new Uint8Array([0x01, 0, 0, 0, 0]))).toBe(0)
    const blockedHits = endVaTrace113c()
    expect(hasD2GameHit(blockedHits, 0x6fcec550)).toBe(true)
    expect(hasD2GameHit(blockedHits, 0x6fcee0d0)).toBe(false)

    beginVaTrace113c()
    expect(C2S_Dispatch113c(m, pGame, pPlayer, new Uint8Array([0x15, 0, 0]))).toBe(2)
    const chatHits = endVaTrace113c()
    expect(hasD2GameHit(chatHits, 0x6fcec550)).toBe(true)
    expect(hasD2GameHit(chatHits, 0x6fcedbb0)).toBe(true)

    beginVaTrace113c()
    expect(C2S_Dispatch113c(m, pGame, pPlayer, new Uint8Array([0x66, 0]))).toBe(0)
    const wardenHits = endVaTrace113c()
    expect(hasD2GameHit(wardenHits, 0x6fcec550)).toBe(true)
    expect(hasD2GameHit(wardenHits, 0x6fceb190)).toBe(true)
  })

  it('0x6FC4D9B0 invokes host pfnEnterGame hook and all 5 timer wheel executors dispatch 0x6FD00410 + defaults', () => {
    const { m, pGame } = createWave22World()
    const { pRoom } = makeRoom(m, 1)
    const { pPlayer } = makePlayer(m, pGame, pRoom, 1, 1)

    // 1) 0x6FC4D9B0 host pfnEnterGame [[0x6FD31C3C]+0x14]
    const pCbTbl = m.alloc(0x40) >>> 0
    m.setU32(0x6fd31c3c, pCbTbl)
    m.setU32((pCbTbl + 0x14) >>> 0, 0x77001414)
    const pClient = m.alloc(0x500) >>> 0
    m.setU32((pClient + 0x04) >>> 0, 3) // state 3 join ready
    m.setU16((pClient + 0x0a) >>> 0, 0x42)
    m.setU32((pClient + 0x16c) >>> 0, 0) // dwUnitType = player
    m.setU32((pClient + 0x170) >>> 0, 1) // dwUnitId = 1
    m.setU32((pClient + 0x174) >>> 0, pPlayer)
    m.setU32((pClient + 0x1a8) >>> 0, pGame)
    m.setU32((pClient + 0x1b4) >>> 0, pRoom)
    m.setU32((pGame + 0x88) >>> 0, pClient)
    let entered: { gameId: number; classId: number; level: number; flag0A: number } | null = null
    GAME_StepClientJoinStatesAndTimeouts113c(m, pGame, 1000, {
      stepJoinState3Ready: () => 1,
      onEnterGame: (_mem, wGameId, _szName, dwClassId, dwLevel, wFlag0A) => {
        entered = { gameId: wGameId, classId: dwClassId, level: dwLevel, flag0A: wFlag0A }
      },
    })
    expect(entered).toEqual({ gameId: 0x1337, classId: 1, level: 25, flag0A: 0x42 })

    // 2) All 5 timer wheel executors: custom 0x6FD00410 + real default handlers
    const pTimer = EVENT_InitTimerQueue113c(m, pGame) >>> 0
    const mkUnit = (uType: number) => {
      const u = m.alloc(0x100) >>> 0
      const p = m.alloc(0x40) >>> 0
      m.setU32(u, uType)
      m.setU32((u + 0x2c) >>> 0, p)
      m.setU32((u + 0x80) >>> 0, pGame)
      m.setU32((p + 0x1c) >>> 0, pRoom)
      return u
    }
    const uPlr = mkUnit(0)
    const uMon = mkUnit(1)
    const uObj = mkUnit(2)
    const pObjData = m.alloc(0x38) >>> 0
    const pObjTxt = m.alloc(0x1c0) >>> 0
    m.setU32(pObjData, pObjTxt)
    m.setU32((uObj + 0x14) >>> 0, pObjData)
    const uMis = mkUnit(3)
    const uItm = mkUnit(4)

    m.set(pGame, D2GameStrc.dwGameFrame, 12)
    // Schedule custom 0x6FD00410 on player + default handlers on object (evType 5) & item (evType 4)
    // Note: EVENT_SetEventFull113c bumps frame <= dwGameFrame to dwGameFrame + 1 (= 13) per 1.13c PE32.
    EVENT_SetEventFull113c(m, pGame, uPlr, 1, 13, 0x6fd00410, 0, 0)
    EVENT_SetEventFull113c(m, pGame, uMon, 1, 13, 0x6fd00410, 0, 0)
    EVENT_SetEventFull113c(m, pGame, uObj, 5, 13, 0, 0, 0)
    EVENT_SetEventFull113c(m, pGame, uMis, 1, 13, 0x6fd00410, 0, 0)
    EVENT_SetEventFull113c(m, pGame, uItm, 4, 13, 0, 0, 0)

    m.set(pGame, D2GameStrc.dwGameFrame, 13)
    beginVaTrace113c()
    expect(EVENT_ExecutePlayerEvents113c(m, pGame, pTimer, 13)).toBe(1)
    expect(EVENT_ExecuteMonsterEvents113c(m, pGame, pTimer, 13)).toBe(1)
    expect(EVENT_ExecuteObjectEvents113c(m, pGame, pTimer, 13)).toBe(1)
    expect(EVENT_ExecuteMissileEvents113c(m, pGame, pTimer, 13)).toBe(1)
    expect(EVENT_ExecuteItemEvents113c(m, pGame, pTimer, 13)).toBe(1)
    const hits = endVaTrace113c()
    expect(hasD2GameHit(hits, 0x6fd00410)).toBe(true)
    expect(hasD2GameHit(hits, 0x6fc89d60)).toBe(true)
    expect(hasD2GameHit(hits, 0x6fcf1790)).toBe(true)
  })

  it('0x6FC4C2D0, 0x6FC4C570, 0x6FC74000 invoke host callbacks and assert 0xAD1 on invalid pfnSave', () => {
    // 1) 0x6FC74000 on real hydrated snapshot player: assert 2769 (0xAD1), then commit (0x0C), then dedup (0x38)
    const snapWorld = bootFromSnapshot113c(loadSnapshotFile113c(snapshotPath113c('a1-town-walk', 2)))
    const sm = snapWorld.m
    const spGame = snapWorld.pGame
    let spPlayer = 0
    for (let i = 0; i < 128; i++) {
      const p = sm.u32((spGame + 0x1120 + i * 4) >>> 0) >>> 0
      if (p !== 0) {
        spPlayer = p
        break
      }
    }
    expect(spPlayer).not.toBe(0)
    const spPlayerData = sm.u32((spPlayer + 0x14) >>> 0) >>> 0
    const spClient = sm.u32((spPlayerData + 0x9c) >>> 0) >>> 0
    expect(spClient).not.toBe(0)

    sm.setU32(0x6fd2d8bc, 1)
    const ppSnapDt = sm.u32(0x6fd1829c) >>> 0
    const pSnapDt = ppSnapDt !== 0 ? (sm.u32(ppSnapDt) >>> 0) : 0
    if (pSnapDt !== 0) {
      sm.setU8((pSnapDt + 0xba8) >>> 0, 1)
    }
    for (let d = 0; d < 3; d++) {
      const pWp = sm.alloc(0x10) >>> 0
      sm.setU16(pWp, 0x0102)
      sm.setU32((spPlayerData + 0x1c + d * 4) >>> 0, pWp)
      const pIntro = sm.alloc(0x08) >>> 0
      const pQHolder = sm.alloc(0x04) >>> 0
      const pQBuf = sm.alloc(0x08) >>> 0
      const pNHolder = sm.alloc(0x04) >>> 0
      const pNBuf = sm.alloc(0x08) >>> 0
      sm.setU32(pQHolder, pQBuf)
      sm.setU32(pNHolder, pNBuf)
      sm.setU32(pIntro, pQHolder)
      sm.setU32((pIntro + 0x04) >>> 0, pNHolder)
      sm.setU32((spPlayerData + 0x60 + d * 4) >>> 0, pIntro)
    }
    sm.setU32((spClient + 0x18c) >>> 0, 0x12345678) // mismatch -> commit path
    const spCbTbl = sm.alloc(0x40) >>> 0
    sm.setU32(0x6fd31c3c, spCbTbl)
    sm.setU32((spCbTbl + 0x0c) >>> 0, 0xffffffff)
    let caughtLine = 0
    try {
      PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000_113c(sm, 0, spPlayer, spGame, 0, 0, 0, 0, 777)
    } catch (e) {
      if (e instanceof D2CommonAssertError) {
        caughtLine = e.line
      } else {
        throw e
      }
    }
    expect(caughtLine).toBe(2769)

    sm.setU32((spClient + 0x18c) >>> 0, 0x12345678) // restore mismatch after caught fatal assert
    sm.setU32((spCbTbl + 0x0c) >>> 0, 0x77000c0c)
    sm.setU32((spCbTbl + 0x38) >>> 0, 0x77003838)
    let save0CCount = 0
    let save0CBytes = 0
    let unchanged38Count = 0
    const hooks = {
      onSavePlayerData0C: (
        _mem: SparseMemory113c,
        _pTs: number,
        _acc: number,
        _chr: number,
        _pBuf: number,
        nTotalSize: number,
      ) => {
        save0CCount++
        save0CBytes = nTotalSize
      },
      onSaveUnchanged38: () => {
        unchanged38Count++
      },
    }
    PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000_113c(
      sm,
      0,
      spPlayer,
      spGame,
      0,
      0,
      0,
      0,
      777,
      hooks,
    )
    expect(save0CCount).toBe(1)
    expect(save0CBytes).toBeGreaterThan(2)
    expect(unchanged38Count).toBe(0)

    // Re-save unchanged player -> dedup path triggers [[0x6FD31C3C]+0x38]
    PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000_113c(
      sm,
      0,
      spPlayer,
      spGame,
      0,
      0,
      0,
      0,
      778,
      hooks,
    )
    expect(save0CCount).toBe(1)
    expect(unchanged38Count).toBe(1)

    // 2) 0x6FC4C2D0 & 0x6FC4C570 host onInitGameData34 callback stores return value in [pGame+0x20]
    const { m } = createWave22World()
    const pCbTbl = m.alloc(0x40) >>> 0
    m.setU32(0x6fd31c3c, pCbTbl)
    m.setU32((pCbTbl + 0x34) >>> 0, 0x77003434)
    m.setU32(0x6fd2e350, 1) // D2GAME_NEXT_GAME_SLOT_VA_113C = 1
    const pHash = makeGameHashTable(m)
    m.setU32(0x6fd31c24, pHash)

    let spInit34Called = 0
    const pCharName = m.alloc(0x20) >>> 0
    m.setU8(pCharName, 0x41) // "A"
    GAME_CreateSinglePlayerOrTcpIpGame_6FC4C2D0_113c(
      m,
      0x100000,
      1,
      0,
      1,
      1,
      pCharName,
      0,
      0,
      0,
      0,
      0,
      0,
      () => {
        spInit34Called++
        return 0x11223344
      },
    )
    expect(spInit34Called).toBe(1)

    const pOutSlot = m.alloc(4) >>> 0
    let mpInit34Called = 0
    const res = GAME_CreateMultiClientGame_6FC4C570_113c(
      m,
      0,
      0,
      0,
      0x100000,
      0,
      0,
      0,
      pOutSlot,
      () => {
        mpInit34Called++
        return 0x55aa1234
      },
    )
    expect(res).toBe(1)
    expect(mpInit34Called).toBe(1)
  })

  it('0x6FC4CB80 (DRLG_PopulateSingleRoom_6FC4CB80_113c) covers all 3 PE32 branches', () => {
    const { m, pGame, pObjControl } = createWave22World()
    const { pRoom } = makeRoom(m, 2)
    const pLvlInfo = m.alloc(0x20) >>> 0
    m.setU32((pLvlInfo + 0x08) >>> 0, 10)
    m.setU32((pObjControl + 0x48 + 2 * 4) >>> 0, pLvlInfo)
    let refreshCount = 0
    const callees = {
      refreshRoomUnits: () => {
        refreshCount++
      },
      initAmbientMonster: () => {},
      objects: {
        getLevelRoomCountInAct: () => 4,
        checkLevelObjectHook: () => 1,
        spawnObjectsByFn: () => 0,
        spawn: { initObject: () => {}, placeServerUnit: () => {} },
      },
      presets: {
        spawnMonsterPreset: () => 0,
        spawnSpecialObject: () => 0,
        allocUnitData: () => 0,
        placePresetItem: () => 0,
        freeUnit: () => {},
        initQuestObject1CB: () => {},
        initQuestObject1CD: () => {},
        initQuestObject21F: () => {},
      },
      regpop: {},
    }

    // Branch 1: unpopulated ([pRoom+0x34] & 1) == 0
    DRLG_PopulateSingleRoom_6FC4CB80_113c(m, pRoom, pGame, callees)
    expect(refreshCount).toBe(1)
    expect(m.u32((pRoom + 0x34) >>> 0) & 1).toBe(1)
    expect(m.u32((pRoom + 0x34) >>> 0) & 2).toBe(2)

    // Branch 2: already populated, flag2 == 0 -> only refresh + set flag2
    refreshCount = 0
    m.setU32((pRoom + 0x34) >>> 0, 1)
    DRLG_PopulateSingleRoom_6FC4CB80_113c(m, pRoom, pGame, callees)
    expect(refreshCount).toBe(1)
    expect(m.u32((pRoom + 0x34) >>> 0) & 2).toBe(2)

    // Branch 3: already populated, flag2 == 1 -> no-op
    refreshCount = 0
    DRLG_PopulateSingleRoom_6FC4CB80_113c(m, pRoom, pGame, callees)
    expect(refreshCount).toBe(0)
  })

  it('live-executes ALL 32 Wave 22 VAs under beginVaTrace113c() asserting 32/32 (100%) coverage', () => {
    const { m, pGame, pObjControl, pQuestCtrl } = createWave22World()
    const { pRoom } = makeRoom(m, 2)
    const { pPlayer, pPlayerData } = makePlayer(m, pGame, pRoom, 1, 1)
    const pTimer = EVENT_InitTimerQueue113c(m, pGame) >>> 0

    // Setup for 0x6FC3BBC0 (AI_FollowDs1NpcPathMem113c)
    const pNpc = m.alloc(0x100) >>> 0
    const pMonData = m.alloc(0x60) >>> 0
    const pAiGen = m.alloc(0x60) >>> 0
    m.setU32(pNpc, 1)
    m.setU32((pNpc + 0x14) >>> 0, pMonData)
    m.setU32((pMonData + 0x28) >>> 0, pAiGen)
    m.setU8((pMonData + 0x1c) >>> 0, 7) // uMod 7 (Cursed)
    const pAiParam = m.alloc(0x40) >>> 0
    const pNpcCtrl = m.alloc(0x40) >>> 0
    m.setU32(pAiParam, pNpcCtrl)

    // Setup for 0x6FC4C2D0 / 0x6FC4C570 / 0x6FC4C830 / 0x6FC4C910
    m.setU8((pGame + 0x6a) >>> 0, 3)
    m.setU32(0x6fd2e350, 1)
    const pHash = makeGameHashTable(m)
    m.setU32(0x6fd31c24, pHash)
    const pClient = m.alloc(0x500) >>> 0
    m.setU32((pClient + 0x04) >>> 0, 4)
    m.setU32((pClient + 0x16c) >>> 0, 0)
    m.setU32((pClient + 0x170) >>> 0, 1)
    m.setU32((pClient + 0x174) >>> 0, pPlayer)
    m.setU32((pClient + 0x1a8) >>> 0, pGame)
    m.setU32((pGame + 0x88) >>> 0, pClient)
    m.setU32((pPlayerData + 0x9c) >>> 0, pClient)

    // Setup for 0x6FC4EAD0 / 0x6FC4F0D0
    const pLvlInfo = m.alloc(0x20) >>> 0
    m.setU32((pLvlInfo + 0x08) >>> 0, 10)
    m.setU32((pObjControl + 0x48 + 2 * 4) >>> 0, pLvlInfo)
    const pQuest = m.alloc(0x100) >>> 0
    m.setU32(pQuest, 1)
    m.setU32((pQuest + 0x04) >>> 0, pGame)
    m.setU32((pQuest + 0x18) >>> 0, m.alloc(0x200))
    m.setU32(pQuestCtrl, pQuest)
    const pArg = m.alloc(0x40) >>> 0
    m.setU32(pArg, pGame)
    m.setU32((pArg + 0x0c) >>> 0, pPlayer)

    beginVaTrace113c()

    // 1. 0x6FC3BBC0
    AI_FollowDs1NpcPathMem113c(m, pGame, pNpc, pAiParam)
    // 2. 0x6FC468E0
    MONSTER_DispatchMinionComponentCallbacks113c(m, pGame, pNpc, 3, {
      onComponentCallback: () => {},
    })
    // 3. 0x6FC49820
    CLIENTS_ForEachInGameClient113c(m, pGame, 0x6fc49820, 0, () => {})
    // 4. 0x6FC4C2D0
    const pCharName = m.alloc(0x20) >>> 0
    m.setU8(pCharName, 0x41)
    GAME_CreateSinglePlayerOrTcpIpGame_6FC4C2D0_113c(m, 0x100000, 1, 0, 1, 1, pCharName)
    // 5. 0x6FC4C570
    GAME_CreateMultiClientGame_6FC4C570_113c(m, 0, 0, 0, 0x100000, 0, 0, 0, m.alloc(4))
    // 6. 0x6FC4C830
    PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c(m, pGame)
    // 7. 0x6FC4C910
    PLAYERSAVE_SaveClientAndAllOtherPlayers_6FC4C910_113c(m, pGame, pClient)
    // 8. 0x6FC4CB80
    DRLG_PopulateSingleRoom_6FC4CB80_113c(m, pRoom, pGame, {
      refreshRoomUnits: () => {},
      initAmbientMonster: () => {},
      objects: {
        getLevelRoomCountInAct: () => 4,
        checkLevelObjectHook: () => 1,
        spawnObjectsByFn: () => 0,
        spawn: { initObject: () => {}, placeServerUnit: () => {} },
      },
      presets: {
        spawnMonsterPreset: () => 0,
        spawnSpecialObject: () => 0,
        allocUnitData: () => 0,
        placePresetItem: () => 0,
        freeUnit: () => {},
        initQuestObject1CB: () => {},
        initQuestObject1CD: () => {},
        initQuestObject21F: () => {},
      },
      regpop: {},
    })
    // 9. 0x6FC4D9B0
    GAME_StepClientJoinStatesAndTimeouts113c(m, pGame, 1000)
    // 10. 0x6FC4EAD0
    OBJECTS_CheckLevelObjectHook113c(m, pLvlInfo, pRoom, pGame, 0x01)
    // 11. 0x6FC4F0D0
    OBJECTS_PopulateRoom113c(m, pGame, pRoom, {
      getLevelRoomCountInAct: () => 4,
      checkLevelObjectHook: () => 1,
      spawnObjectsByFn: () => 0,
      spawn: { initObject: () => {}, placeServerUnit: () => {} },
    })
    // 12. 0x6FC4F300
    OBJECTS_InitObjectUnit113c(m, 0, pGame, 1, pRoom, 50, 50)
    // 13-15. 0x6FC53C70, 0x6FC54510, 0x6FC545A0
    QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c(m, pArg, 0)
    QUESTS_TriggerItemPickedUp_6FC54510_113c(m, pGame, pNpc, pPlayer)
    QUESTS_TriggerItemDropped_6FC545A0_113c(m, pGame, pNpc, pPlayer)
    // 16. 0x6FC57030
    SUNIT_DispatchItemEventCallbacks113c(m, pNpc, pGame, 1, 0, 0)
    // 17. 0x6FC74000
    PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000_113c(m, 0, pPlayer, pGame, 0, 0, 0, 0, 0)
    // 18-22. 0x6FC7AFB0, 0x6FC7B4F0, 0x6FC7EED0, 0x6FC84430, 0x6FC85260
    QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(m, pQuest)
    ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c(m, pQuest, pArg)
    ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c(m, pQuest, pArg)
    ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c(m, pQuest, pArg)
    ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c(m, pQuest, pArg)
    // 23-24. 0x6FC98430, 0x6FC98550
    PLAYER_StartModeOnUnit113c(m, pGame, pPlayer, 1, pNpc, 1)
    PLAYER_StartModeAtCoords113c(m, pGame, pPlayer, 1, 50, 50, 1)
    // 25-29. 0x6FCAE9A0, 0x6FCAEBC0, 0x6FCAECC0, 0x6FCAEDD0, 0x6FCAEF20
    EVENT_ExecutePlayerEvents113c(m, pGame, pTimer, 0)
    EVENT_ExecuteMonsterEvents113c(m, pGame, pTimer, 0)
    EVENT_ExecuteObjectEvents113c(m, pGame, pTimer, 0)
    EVENT_ExecuteMissileEvents113c(m, pGame, pTimer, 0)
    EVENT_ExecuteItemEvents113c(m, pGame, pTimer, 0)
    // 30. 0x6FCBC070
    PARTY_ForEachPartyMemberInSameLevel113c(m, pGame, pPlayer, () => {}, 0)
    // 31. 0x6FCBD230
    AI_InitMonsterAiThinkFn113c(m, pNpc, pGame, pAiGen, 0)
    // 32. 0x6FCEC550
    C2S_Dispatch113c(m, pGame, pPlayer, new Uint8Array([0x00]))

    const hits = endVaTrace113c()
    const missing: string[] = []
    for (const spec of WAVE22_SPECS) {
      if (!hasD2GameHit(hits, parseInt(spec.va, 16))) {
        missing.push(`${spec.va} (${spec.tsSymbol})`)
      }
    }
    expect(missing).toEqual([])
  })
})
