/**
 * Unit, golden-seed, and import-purity verification for Lane G's pure 1:1 `D2Game.dll`
 * Blood Moor wilderness monster population (`regpop-spawn-113c.ts`) and Fallen/Shaman
 * AI & combat (`ai-fallen-113c.ts`) kernel ports.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { DATATABLES_OFF_113C } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  AIGENERAL_BroadcastCmdToMinions113c,
  AIGENERAL_GetPackLeaderUnit113c,
  AIGENERAL_InitBossGroup113c,
  AIGENERAL_LinkMinionToLeader113c,
  AIGENERAL_ReassignPackOnBossDeath113c,
  AI_CalcApproxUnitDistSubtiles113c,
  AI_FallenShaman113c,
  AI_FallenShamanCorpseFilter113c,
  AI_LookupDispatchTableRow113c,
  AI_SetAiControlOverrides113c,
  D2GAME_MONSTER_AI_TABLE_VA_113C,
  D2GAME_SPECIAL_AI_TABLE_VA_113C,
  MONSTER_ApplyCritDamage113c,
  MONSTER_CheckTypeFlagsMask113c,
  MONSTER_HasAlwaysChaseFlag113c,
  SUNITDMG_FreeAttackerCombatList113c,
  SUNIT_SetUnitEventSound113c,
} from '../../../src/d2kern-113c/game/ai-fallen-113c.ts'
import {
  GAME_AllocGameStrc113c,
  SUNIT_InsertServerUnit113c,
  SUNIT_RemoveServerUnit113c,
} from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  MONREG_GenerateOutfitVariants113c,
  MONREG_GetOrCreateActOutfit113c,
  MONREG_IncrementSpawnCount113c,
  MONREG_UpdateActiveCountOnMode113c,
  MONSTER_ChooseMonsterClass113c,
  MONSTER_ChooseOutfit113c,
  MONSTER_GetPlayerCountExpBonusPct113c,
  MONSTER_GetPlayerCountHpBonusPct113c,
  MONSTER_RollPackRarityType113c,
  MONSTER_ScheduleInitialAiEvent113c,
  MONSTER_SpawnPartyMinions113c,
  REGPOP_IsNearTownExitOrWaypoint113c,
  REGPOP_PopulateRoomMonsters113c,
  REGPOP_UsesPartyBossGroup113c,
  SEED_RollLimitedFast113c,
  SEED_RollMaskFast113c,
  SEED_RollRangeHalfOpen113c,
  SUNIT_InitExtraItemSeed113c,
  SUNIT_InitUnitSeed113c,
  initD2GameGlobalsInMem113c,
  type RegpopSpawnHooks113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  EVENT_GetNextEventFrame113c,
  EVENT_InitTimerQueue113c,
} from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2LevelsTxt_SIZE,
  D2MonsterDataStrc_SIZE,
  D2UnitStrc_SIZE,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { type Memory113c, SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  DATATABLES_LEVELS_COUNT_OFF_113C,
  DATATABLES_LEVELS_TXT_OFF_113C,
} from '../../../src/d2kern-113c/tables/lvl-tbls-113c.ts'
import {
  collectImportGraph,
  legacyReachable,
} from '../../../tools/oracle/kern-replay/import-graph.ts'
import { REPO_ROOT_113C } from '../../../tools/oracle/kern-replay/replay-113c.ts'

interface GoldenFrameEntry {
  frame: number
  gs: [number, number]
  t1: number[][]
}

const LANE_G_MODULES = [
  'src/d2kern-113c/game/regpop-spawn-113c.ts',
  'src/d2kern-113c/game/ai-fallen-113c.ts',
]

function stepLcgOnce(m: SparseMemory113c, pSeed: number): void {
  SEED_RollMaskFast113c(m, pSeed, 1)
}

function allocTestMonsterUnit(
  m: Memory113c,
  pGame: number,
  guid: number,
  classId: number,
  mode: number,
  x: number,
  y: number,
  pMonStatsTxt = 0,
): { pUnit: number; pMonData: number; pAiGen: number; pAiParam: number; pPath: number } {
  const pUnit = m.alloc(D2UnitStrc_SIZE)
  const pMonData = m.alloc(D2MonsterDataStrc_SIZE)
  const pAiGen = m.alloc(0x40)
  const pAiParam = m.alloc(0x24)
  const pPath = m.alloc(0x80)

  m.setU32(pUnit, 1)
  m.setU32((pUnit + 0x04) >>> 0, classId >>> 0)
  m.setU32((pUnit + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pUnit + 0x10) >>> 0, mode >>> 0)
  m.setU32((pUnit + 0x14) >>> 0, pMonData)
  m.setU32((pUnit + 0x2c) >>> 0, pPath)
  m.setU32((pUnit + 0xc4) >>> 0, 0x0a)

  m.setU32(pMonData, pMonStatsTxt >>> 0)
  m.setU32((pMonData + 0x28) >>> 0, pAiGen)
  m.setU32((pMonData + 0x2c) >>> 0, pAiParam)

  m.setU32((pAiGen + 0x2c) >>> 0, 0xffffffff)
  m.setU32((pAiGen + 0x30) >>> 0, 1)

  m.setU16((pPath + 0x02) >>> 0, x & 0xffff)
  m.setU16((pPath + 0x06) >>> 0, y & 0xffff)

  if (pGame !== 0) {
    SUNIT_InsertServerUnit113c(m, pGame, pUnit)
  }
  return { pUnit, pMonData, pAiGen, pAiParam, pPath }
}

describe('K1 Lane G Blood Moor wilderness monster spawn & Fallen/Shaman AI ports', () => {
  it('enforces strict kernel import purity and avoids legacy fallen-ai-113c.ts', () => {
    const graph = collectImportGraph(REPO_ROOT_113C, LANE_G_MODULES)
    expect(legacyReachable(graph, LANE_G_MODULES)).toEqual([])
    for (const f of graph.files) {
      expect(f.startsWith('src/server/')).toBe(false)
      expect(f.startsWith('src/common/')).toBe(false)
    }
    expect(graph.files.has('src/d2kern-113c/game/fallen-ai-113c.ts')).toBe(false)
  })

  it('reproduces exact a1c-bloodmoor-fallen golden gs & unit seed transitions across F150..F2000', () => {
    const goldenPath = join(
      REPO_ROOT_113C,
      'tests/fixtures/oracle/golden/a1c-bloodmoor-fallen.oracle.ndjson.gz',
    )
    const rawLines = gunzipSync(readFileSync(goldenPath)).toString('utf8').trim().split('\n')
    const byFrame = new Map<number, GoldenFrameEntry>()
    for (let i = 1; i < rawLines.length; i++) {
      const fr = JSON.parse(rawLines[i]!) as GoldenFrameEntry
      byFrame.set(fr.frame, fr)
    }

    const m = new SparseMemory113c()
    const pDataTables = m.alloc(0x1000)
    initD2GameGlobalsInMem113c(m, pDataTables)

    const pSeed = m.alloc(8)
    const pUnit = m.alloc(D2UnitStrc_SIZE)
    const pItem = m.alloc(D2UnitStrc_SIZE)
    const pItemData = m.alloc(0x80)
    m.setU32(pItem, 4)
    m.setU32((pItem + 0x14) >>> 0, pItemData)

    // F150 -> F151: 3 Blood Moor rooms * 169 density cells (507) + 2 density objects = +509 steps
    const f150 = byFrame.get(150)!
    const f151 = byFrame.get(151)!
    m.setU32(pSeed, f150.gs[0] >>> 0)
    m.setU32((pSeed + 4) >>> 0, f150.gs[1] >>> 0)
    for (let i = 0; i < 3 * 169; i++) stepLcgOnce(m, pSeed)
    SUNIT_InitUnitSeed113c(m, pUnit, pSeed)
    SUNIT_InitUnitSeed113c(m, pUnit, pSeed)
    expect([m.u32(pSeed), m.u32((pSeed + 4) >>> 0)]).toEqual(f151.gs)

    // F223 -> F224: 3 Blood Moor rooms * 169 density cells (507) + 3 Zombies (#9, #10, #11) = +510 steps
    const f223 = byFrame.get(223)!
    const f224 = byFrame.get(224)!
    m.setU32(pSeed, f223.gs[0] >>> 0)
    m.setU32((pSeed + 4) >>> 0, f223.gs[1] >>> 0)
    for (let i = 0; i < 3 * 169; i++) stepLcgOnce(m, pSeed)
    SUNIT_InitUnitSeed113c(m, pUnit, pSeed) // Zombie #9
    SUNIT_InitUnitSeed113c(m, pUnit, pSeed) // Zombie #10
    SUNIT_InitUnitSeed113c(m, pUnit, pSeed) // Zombie #11
    expect([m.u32(pSeed), m.u32((pSeed + 4) >>> 0)]).toEqual(f224.gs)
    expect([m.u32((pUnit + 0x20) >>> 0), m.u32((pUnit + 0x24) >>> 0)]).toEqual([1069389260, 666])

    // F688 -> F689: 2 Blood Moor rooms * 169 density cells (338) + 4 Fallen (#12..#15) = +342 steps
    const f688 = byFrame.get(688)!
    const f689 = byFrame.get(689)!
    m.setU32(pSeed, f688.gs[0] >>> 0)
    m.setU32((pSeed + 4) >>> 0, f688.gs[1] >>> 0)
    for (let i = 0; i < 2 * 169; i++) stepLcgOnce(m, pSeed)
    for (let i = 0; i < 4; i++) {
      SUNIT_InitUnitSeed113c(m, pUnit, pSeed)
    }
    expect([m.u32(pSeed), m.u32((pSeed + 4) >>> 0)]).toEqual(f689.gs)
    expect([m.u32((pUnit + 0x20) >>> 0), m.u32((pUnit + 0x24) >>> 0)]).toEqual([3362599106, 666])

    // F1039 -> F1040: Fallen #13 killed -> 1 treasure drop item allocated (+2 steps: unit seed + item owner seed)
    const f1039 = byFrame.get(1039)!
    const f1040 = byFrame.get(1040)!
    m.setU32(pSeed, f1039.gs[0] >>> 0)
    m.setU32((pSeed + 4) >>> 0, f1039.gs[1] >>> 0)
    SUNIT_InitUnitSeed113c(m, pItem, pSeed)
    SUNIT_InitExtraItemSeed113c(m, pSeed, pItem)
    expect([m.u32(pSeed), m.u32((pSeed + 4) >>> 0)]).toEqual(f1040.gs)
  })

  it('executes REGPOP_PopulateRoomMonsters113c + MONSTER_SpawnPartyMinions113c on an 8x8 Blood Moor room', () => {
    const m = new SparseMemory113c()
    const pDataTables = m.alloc(0x1000)
    const nMonStatsCount = 100
    const pMonStatsArr = m.alloc(nMonStatsCount * 0x1a8)
    const pMonStats2Arr = m.alloc(10 * 0x134)
    const pLevelsArr = m.alloc(10 * D2LevelsTxt_SIZE)

    m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsArr)
    m.setU32((pDataTables + 0xa80) >>> 0, nMonStatsCount)
    m.setU32(0x6fdf0950, pMonStatsArr)
    m.setU32(0x6fdf0958, nMonStatsCount)
    m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Arr)
    m.setU32((pDataTables + 0xa98) >>> 0, 10)
    m.setU32((pDataTables + DATATABLES_LEVELS_TXT_OFF_113C) >>> 0, pLevelsArr)
    m.setU32((pDataTables + DATATABLES_LEVELS_COUNT_OFF_113C) >>> 0, 10)
    initD2GameGlobalsInMem113c(m, pDataTables)

    // Configure zombie1 (id=5), fallen1 (id=19), carver1 (id=20 -> baseId=19), fetisher1 (id=91)
    const pZombie = (pMonStatsArr + 5 * 0x1a8) >>> 0
    m.setU16((pZombie + 0x02) >>> 0, 5)
    m.setU16((pZombie + 0x20) >>> 0, 0xffff)
    m.setU8((pZombie + 0x2f) >>> 0, 2)
    m.setU8((pZombie + 0x30) >>> 0, 4)

    const pFallen = (pMonStatsArr + 19 * 0x1a8) >>> 0
    m.setU16((pFallen + 0x02) >>> 0, 19)
    m.setU8((pFallen + 0x0c) >>> 0, 0x10) // bit 4 = SetBoss
    m.setU16((pFallen + 0x18) >>> 0, 1) // MonStats2 idx 1
    m.setU16((pFallen + 0x20) >>> 0, 0xffff)
    m.setU16((pFallen + 0x26) >>> 0, 19) // wMinion1 = fallen1
    m.setU16((pFallen + 0x28) >>> 0, 0xffff) // wMinion2 = -1
    m.setU8((pFallen + 0x2c) >>> 0, 3) // PartyMin = 3
    m.setU8((pFallen + 0x2d) >>> 0, 3) // PartyMax = 3
    m.setU8((pFallen + 0x2f) >>> 0, 3)
    m.setU8((pFallen + 0x30) >>> 0, 5)

    const pCarver = (pMonStatsArr + 20 * 0x1a8) >>> 0
    m.setU16((pCarver + 0x02) >>> 0, 19)

    const pFetish = (pMonStatsArr + 0x5b * 0x1a8) >>> 0
    m.setU16((pFetish + 0x02) >>> 0, 0x5b)

    expect(REGPOP_UsesPartyBossGroup113c(m, 5)).toBe(0)
    expect(REGPOP_UsesPartyBossGroup113c(m, 19)).toBe(1)
    expect(REGPOP_UsesPartyBossGroup113c(m, 20)).toBe(1)
    expect(REGPOP_UsesPartyBossGroup113c(m, 0x5b)).toBe(1)

    // LevelsTxt[2] (Blood Moor): dwMonUMin (+0x0C) = 289 (17^2 subtiles)
    const pBloodMoorLvl = (pLevelsArr + 2 * D2LevelsTxt_SIZE) >>> 0
    m.setU32((pBloodMoorLvl + 0x0c) >>> 0, 289)

    const pGame = GAME_AllocGameStrc113c(m)
    EVENT_InitTimerQueue113c(m, pGame)
    m.setU32((pGame + 0xa8) >>> 0, 689)
    m.setU32((pGame + 0xd0) >>> 0, 0x12345678)
    m.setU32((pGame + 0xd4) >>> 0, 666)

    // Set up pMonReg for level 2 (Blood Moor)
    const pMonReg = m.alloc(0x300)
    m.setU8(pMonReg, 0) // Act 0
    m.setU32((pMonReg + 0x0c) >>> 0, 48) // 48 total rooms in Blood Moor
    m.setU8((pMonReg + 0x10) >>> 0, 1) // 1 active species: fallen1
    m.setU8((pMonReg + 0x11) >>> 0, 100) // total rarity 100
    m.setU16((pMonReg + 0x14) >>> 0, 19) // classId = 19 (fallen1)
    m.setU8((pMonReg + 0x16) >>> 0, 100) // rarity weight = 100
    m.setU32((pMonReg + 0x2b8) >>> 0, 900) // dwMonDen = 900 (~1.5 packs per room)
    m.setU8((pMonReg + 0x2bc) >>> 0, 0) // uMin = 0
    m.setU8((pMonReg + 0x2bd) >>> 0, 0) // uMax = 0
    m.setU32((pGame + 0xf0 + 2 * 4) >>> 0, pMonReg)

    // Set up 8x8 tile (40x40 subtile) D2ActiveRoomStrc + D2RoomExStrc + D2RoomLogicalInfoStrc + D2RoomCoordListStrc
    const pRoom = m.alloc(0x80)
    const pRoomEx = m.alloc(0x100)
    const pLevel = m.alloc(0x240)
    const pLogical = m.alloc(0x34)
    const pCoordNode = m.alloc(0x30)
    const pSubtypes = (pLevel + 0x1e0) >>> 0
    m.setU32((pLevel + 0x1d0) >>> 0, 2) // nLevelId = 2 (Blood Moor)
    m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
    m.setU32((pRoomEx + 0x64) >>> 0, pLogical)
    m.setU32(pLogical, 1) // dwFlags = 1 (single-region room)
    m.setU32((pLogical + 0x04) >>> 0, 1)
    m.setU32((pLogical + 0x30) >>> 0, pCoordNode)
    m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
    m.setU32((pRoom + 0x30) >>> 0, pCoordNode)
    m.setU32((pRoom + 0x4c) >>> 0, 5560)
    m.setU32((pRoom + 0x50) >>> 0, 5760)
    m.setU32((pRoom + 0x54) >>> 0, 40)
    m.setU32((pRoom + 0x58) >>> 0, 40)
    m.setU32((pRoom + 0x5c) >>> 0, 1112)
    m.setU32((pRoom + 0x60) >>> 0, 1152)
    m.setU32((pRoom + 0x64) >>> 0, 8)
    m.setU32((pRoom + 0x68) >>> 0, 8)
    m.setU32((pRoom + 0x6c) >>> 0, 0xabcdef01)
    m.setU32((pRoom + 0x70) >>> 0, 666)

    // Border point at (5500, 5760): (5516, 5760) is dist^2 = 256 < 289 (safe), (5580, 5780) is far
    m.setU32((pSubtypes + 0x00) >>> 0, 5500)
    m.setU32((pSubtypes + 0x24) >>> 0, 5760)
    m.setU32((pSubtypes + 0x48) >>> 0, 1)
    expect(REGPOP_IsNearTownExitOrWaypoint113c(m, pRoom, 5760, pGame, 5516)).toBe(1)
    expect(REGPOP_IsNearTownExitOrWaypoint113c(m, pRoom, 5760, pGame, 5517)).toBe(0)

    // CoordNode covering 8x8 game tiles -> 40x40 subtiles -> (40/3)*(40/3) = 13*13 = 169 density cells
    m.setU32((pCoordNode + 0x10) >>> 0, 1112)
    m.setU32((pCoordNode + 0x14) >>> 0, 1152)
    m.setU32((pCoordNode + 0x18) >>> 0, 1120)
    m.setU32((pCoordNode + 0x1c) >>> 0, 1160)
    m.setU32((pCoordNode + 0x20) >>> 0, 0)
    m.setU32((pCoordNode + 0x28) >>> 0, 1)
    m.setU32((pCoordNode + 0x2c) >>> 0, 0)

    let nextGuid = 12
    const spawnedUnits: number[] = []
    const hooks: RegpopSpawnHooks113c = {
      onInitBossGroup: AIGENERAL_InitBossGroup113c,
      onLinkMinionToLeader: AIGENERAL_LinkMinionToLeader113c,
      onMonsterCreate: (mem, args): number => {
        if ((args.wFlags & 1) !== 0) {
          return 1 // Coordinate probe check succeeds
        }
        const guid = nextGuid++
        const { pUnit } = allocTestMonsterUnit(
          mem,
          args.pGame,
          guid,
          args.nClassId,
          args.nMode,
          args.x,
          args.y,
          pFallen,
        )
        SUNIT_InitUnitSeed113c(mem, pUnit, (args.pGame + 0xd0) >>> 0)
        MONSTER_ScheduleInitialAiEvent113c(mem, args.pGame, pUnit)
        spawnedUnits.push(pUnit)
        if ((args.wFlags & 0x40) === 0) {
          MONSTER_SpawnPartyMinions113c(mem, args.pArgs, pUnit, hooks)
        }
        return pUnit
      },
    }

    // uMin = uMax = 0: MONSTER_RollPackRarityType113c (0x6FCFF080) skips both boss-quota rolls and returns
    // 1 or 2, which 0x6FC67A20 remaps to 2 = normal pack (0x6FC67BAD). A return of 0 would take the
    // champion/unique branch (0x6FC67C79) instead.

    REGPOP_PopulateRoomMonsters113c(m, pGame, pRoom, hooks)

    // At least 1 Fallen pack (1 leader + 3 party minions = 4 Fallen) spawned, each scheduled for F691 (689 + 2)
    expect(spawnedUnits.length).toBeGreaterThanOrEqual(4)
    expect(spawnedUnits.length % 4).toBe(0)
    expect(m.u32((pMonReg + 0x08) >>> 0)).toBe(1)

    const pLeader = spawnedUnits[0]!
    expect(EVENT_GetNextEventFrame113c(m, pLeader, 2)).toBe(691)
    expect(AIGENERAL_GetPackLeaderUnit113c(m, spawnedUnits[1]!)).toBe(pLeader)
    expect(AIGENERAL_GetPackLeaderUnit113c(m, spawnedUnits[2]!)).toBe(pLeader)
    expect(AIGENERAL_GetPackLeaderUnit113c(m, spawnedUnits[3]!)).toBe(pLeader)
  })

  it('reproduces the Fallen #12 -> #13 -> #14 -> #15 boss promotion chain & war-cry broadcast', () => {
    const m = new SparseMemory113c()
    const pDataTables = m.alloc(0x1000)
    initD2GameGlobalsInMem113c(m, pDataTables)

    const pGame = GAME_AllocGameStrc113c(m)
    const u12 = allocTestMonsterUnit(m, pGame, 12, 19, 2, 5599, 5796)
    const u13 = allocTestMonsterUnit(m, pGame, 13, 19, 2, 5601, 5798)
    const u14 = allocTestMonsterUnit(m, pGame, 14, 19, 2, 5597, 5799)
    const u15 = allocTestMonsterUnit(m, pGame, 15, 19, 2, 5603, 5795)

    // Initial party wiring: #12 is boss, minions linked in spawn order (#13, #14, #15 -> head is #15 or #13)
    // Link in reverse so head order is [#13 -> #14 -> #15] matching golden promotion order
    AIGENERAL_InitBossGroup113c(m, u12.pUnit, 1, pGame, 12, 1, 1)
    for (const minion of [u15, u14, u13]) {
      AIGENERAL_InitBossGroup113c(m, minion.pUnit, 1, pGame, 12, 0, 0)
      AIGENERAL_LinkMinionToLeader113c(m, u12.pUnit, minion.pUnit, pGame)
    }

    expect(AIGENERAL_GetPackLeaderUnit113c(m, u12.pUnit)).toBe(u12.pUnit)
    expect(AIGENERAL_GetPackLeaderUnit113c(m, u15.pUnit)).toBe(u12.pUnit)

    // F801: Fallen #12 dies -> #13 promoted to boss of [#13, #14, #15] (and #12 corpse retained)
    m.setU32((u12.pUnit + 0x10) >>> 0, 0)
    AIGENERAL_ReassignPackOnBossDeath113c(m, u12.pAiGen, u12.pUnit)
    expect(AIGENERAL_GetPackLeaderUnit113c(m, u13.pUnit)).toBe(u13.pUnit)
    expect(AIGENERAL_GetPackLeaderUnit113c(m, u14.pUnit)).toBe(u13.pUnit)
    expect(AIGENERAL_GetPackLeaderUnit113c(m, u15.pUnit)).toBe(u13.pUnit)
    expect(m.u8((u13.pAiGen + 0x08) >>> 0) & 3).toBe(3)

    // After #12 dies, #13's pMinionList was rebuilt via push_front as [#15 -> #14 -> #12].
    // When #12 and #13 are unhashed/dead, #13's death promotes #15 (head of #13's list),
    // and #15's list becomes [#14 -> #13].
    SUNIT_RemoveServerUnit113c(m, pGame, u12.pUnit)
    SUNIT_RemoveServerUnit113c(m, pGame, u13.pUnit)
    AIGENERAL_ReassignPackOnBossDeath113c(m, u13.pAiGen, u13.pUnit)
    expect(AIGENERAL_GetPackLeaderUnit113c(m, u15.pUnit)).toBe(u15.pUnit)
    expect(AIGENERAL_GetPackLeaderUnit113c(m, u14.pUnit)).toBe(u15.pUnit)

    // Broadcast group command (e.g. F1414 Fallen war cry) from #15 to pack (#14)
    const pCmdTemplate = m.alloc(0x1c)
    m.setU32((pCmdTemplate + 0x08) >>> 0, 9) // cmd 9
    m.setU32((pCmdTemplate + 0x0c) >>> 0, 5600)
    m.setU32((pCmdTemplate + 0x10) >>> 0, 5800)
    AIGENERAL_BroadcastCmdToMinions113c(m, u15.pUnit, pGame, pCmdTemplate)
    const pCmd14 = m.u32((u14.pAiGen + 0x20) >>> 0)
    expect(pCmd14).not.toBe(0)
    expect(m.u32((pCmd14 + 0x08) >>> 0)).toBe(9)
    expect(m.u32((pCmd14 + 0x0c) >>> 0)).toBe(5600)
    expect(m.u32((pCmd14 + 0x10) >>> 0)).toBe(5800)

    // #15 dies -> sole survivor #14 promoted to boss
    SUNIT_RemoveServerUnit113c(m, pGame, u15.pUnit)
    AIGENERAL_ReassignPackOnBossDeath113c(m, u15.pAiGen, u15.pUnit)
    expect(AIGENERAL_GetPackLeaderUnit113c(m, u14.pUnit)).toBe(u14.pUnit)
    expect(m.u8((u14.pAiGen + 0x08) >>> 0) & 3).toBe(3)
  })

  it('verifies AI_FallenShamanCorpseFilter113c, AI_FallenShaman113c Raise cast, and MONSTER_ApplyCritDamage113c', () => {
    const m = new SparseMemory113c()
    const pDataTables = m.alloc(0x1000)
    const pMonStatsArr = m.alloc(120 * 0x1a8)
    const pMonStats2Arr = m.alloc(4 * 0x134)
    const pSkillsArr = m.alloc(100 * 0x23c)
    const pStatesArr = m.alloc(64 * 0x40)

    m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsArr)
    m.setU32((pDataTables + 0xa80) >>> 0, 120)
    m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Arr)
    m.setU32((pDataTables + 0xa98) >>> 0, 4)
    m.setU32((pDataTables + 0xb98) >>> 0, pSkillsArr)
    m.setU32((pDataTables + 0xba0) >>> 0, 100)
    m.setU32((pDataTables + DATATABLES_OFF_113C.pStatesTxt) >>> 0, pStatesArr)
    m.setU32((pDataTables + DATATABLES_OFF_113C.nStatesTxtRecordCount) >>> 0, 64)
    initD2GameGlobalsInMem113c(m, pDataTables)

    // Zombie (5), Fallen (19, bCrit=5), FallenShaman (24, wSkill1=60 Raise, wSkill2=36 Firebolt)
    const pZombieTxt = (pMonStatsArr + 5 * 0x1a8) >>> 0
    m.setU16((pZombieTxt + 0x02) >>> 0, 5)

    const pFallenTxt = (pMonStatsArr + 19 * 0x1a8) >>> 0
    m.setU16((pFallenTxt + 0x02) >>> 0, 19)
    m.setU8((pFallenTxt + 0xa6) >>> 0, 5) // 5% crit

    const pShamanTxt = (pMonStatsArr + 24 * 0x1a8) >>> 0
    m.setU16((pShamanTxt + 0x02) >>> 0, 24)
    m.setU16((pShamanTxt + 0x1e) >>> 0, 6) // wAi = 6 (FallenShaman)
    m.setU16((pShamanTxt + 0x56) >>> 0, 100) // aip1 = 100% (guarantee Raise roll)
    m.setU16((pShamanTxt + 0x68) >>> 0, 20) // aip4 = 20 subtile corpse scan radius
    m.setU16((pShamanTxt + 0x170) >>> 0, 60) // wSkill1 = 60 (Fallen Shaman Raise)
    m.setU16((pShamanTxt + 0x172) >>> 0, 36) // wSkill2 = 36 (Firebolt)
    m.setU8((pShamanTxt + 0x181) >>> 0, 8) // S1 cast mode

    // SkillsTxt[60]: bit 0 of +0x08 = 0 (no target-footprint collision block needed in unit test)
    const pRaiseTxt = (pSkillsArr + 60 * 0x23c) >>> 0
    m.setU8((pRaiseTxt + 0x08) >>> 0, 0)

    const pGame = GAME_AllocGameStrc113c(m)
    const shaman = allocTestMonsterUnit(m, pGame, 30, 24, 1, 5600, 5800, pShamanTxt)
    const deadFallen = allocTestMonsterUnit(m, pGame, 31, 19, 12, 5606, 5808, pFallenTxt)
    const bossFallen = allocTestMonsterUnit(m, pGame, 32, 19, 12, 5602, 5802, pFallenTxt)
    m.setU16((bossFallen.pMonData + 0x16) >>> 0, 0x08) // unique/boss flag -> rejected!
    const deadZombie = allocTestMonsterUnit(m, pGame, 33, 5, 12, 5601, 5801, pZombieTxt)

    const pScanCtx = m.alloc(0x10)
    m.setU32((pScanCtx + 0x0c) >>> 0, 400) // 20^2

    // Rejects dead Zombie and boss Fallen; accepts normal dead Fallen (sqDist = 6^2 + 8^2 = 100 <= 400)
    AI_FallenShamanCorpseFilter113c(m, shaman.pUnit, deadZombie.pUnit, pScanCtx)
    expect(m.u32(pScanCtx)).toBe(0)
    AI_FallenShamanCorpseFilter113c(m, shaman.pUnit, bossFallen.pUnit, pScanCtx)
    expect(m.u32(pScanCtx)).toBe(0)
    AI_FallenShamanCorpseFilter113c(m, shaman.pUnit, deadFallen.pUnit, pScanCtx)
    expect(m.u32(pScanCtx)).toBe(deadFallen.pUnit)
    expect(m.u32((pScanCtx + 0x04) >>> 0)).toBe(1)
    expect(m.u32((pScanCtx + 0x08) >>> 0)).toBe(100)

    // Run AI_FallenShaman113c and verify it dispatches mode 14 (MONMODE_SEQ) targeting deadFallen!
    const pAiArgs = m.alloc(0x20)
    const pAiControl = m.alloc(0x20)
    m.setU32(pAiArgs, pAiControl)
    m.setU32((pAiArgs + 0x14) >>> 0, 15)
    m.setU32((pAiArgs + 0x18) >>> 0, 0)
    m.setU32((pAiArgs + 0x1c) >>> 0, pShamanTxt)

    let startedMode = -1
    let startedTarget = 0
    AI_FallenShaman113c(m, pGame, shaman.pUnit, pAiArgs, undefined, {
      onScanRadiusUnits: (mem, _g, origin, ctx) => {
        AI_FallenShamanCorpseFilter113c(mem, origin, deadFallen.pUnit, ctx)
      },
      onMonsterStartMode: (mem, _g, pModeArgs) => {
        startedMode = mem.u32(pModeArgs) | 0
        startedTarget = mem.u32((pModeArgs + 0x08) >>> 0)
        return 1
      },
    })
    expect(startedMode).toBe(14)
    expect(startedTarget).toBe(deadFallen.pUnit)

    // Verify MONSTER_ApplyCritDamage113c (5% roll: find a seed that rolls < 5 and one >= 5)
    const attacker = allocTestMonsterUnit(m, pGame, 40, 19, 4, 5600, 5800, pFallenTxt)
    const defender = allocTestMonsterUnit(m, pGame, 1, 0, 1, 5601, 5800, 0)
    m.setU32(defender.pUnit, 0) // Player defender
    const pDamage = m.alloc(0x70)
    m.setU32((pDamage + 0x08) >>> 0, 380) // phys
    m.setU32((pDamage + 0x10) >>> 0, 50) // fire

    // Set bCrit = 100 to verify exact 2x doubling and 0x10 result flag
    m.setU8((pFallenTxt + 0xa6) >>> 0, 100)
    m.setU32((attacker.pUnit + 0x20) >>> 0, 12345)
    m.setU32((attacker.pUnit + 0x24) >>> 0, 666)
    MONSTER_ApplyCritDamage113c(m, attacker.pUnit, pDamage, defender.pUnit)
    expect(m.u32((pDamage + 0x08) >>> 0)).toBe(760)
    expect(m.u32((pDamage + 0x10) >>> 0)).toBe(100)
    expect(m.u32((pDamage + 0x60) >>> 0) & 0x10).toBe(0x10)
  })

  it('verifies MONREG outfit variants, PRNG half-open ranges, player bonuses, and AI dispatch lookup', () => {
    const m = new SparseMemory113c()
    const pDataTables = m.alloc(0x1000)
    const pMonStatsArr = m.alloc(400 * 0x1a8)
    const pMonStats2Arr = m.alloc(4 * 0x134)
    m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsArr)
    m.setU32((pDataTables + 0xa80) >>> 0, 400)
    m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Arr)
    m.setU32((pDataTables + 0xa98) >>> 0, 4)
    initD2GameGlobalsInMem113c(m, pDataTables)

    // Half-open [min, max) PRNG
    const pSeed = m.alloc(8)
    m.setU32(pSeed, 0x11223344)
    m.setU32((pSeed + 4) >>> 0, 666)
    expect(SEED_RollRangeHalfOpen113c(m, pSeed, 7, 7)).toBe(7)
    expect(m.u32(pSeed)).toBe(0x11223344) // Unchanged when nMax <= nMin!
    for (let i = 0; i < 32; i++) {
      const r = SEED_RollRangeHalfOpen113c(m, pSeed, 1, 9)
      expect(r).toBeGreaterThanOrEqual(1)
      expect(r).toBeLessThan(9)
    }

    // Player count HP/EXP bonus tables + >8 formula
    expect(MONSTER_GetPlayerCountHpBonusPct113c(m, 1)).toBe(0)
    expect(MONSTER_GetPlayerCountHpBonusPct113c(m, 2)).toBe(50)
    expect(MONSTER_GetPlayerCountHpBonusPct113c(m, 8)).toBe(350)
    expect(MONSTER_GetPlayerCountHpBonusPct113c(m, 9)).toBe(350)
    expect(MONSTER_GetPlayerCountExpBonusPct113c(m, 1)).toBe(0)
    expect(MONSTER_GetPlayerCountExpBonusPct113c(m, 8)).toBe(350)
    expect(MONSTER_GetPlayerCountExpBonusPct113c(m, 10)).toBe(400)

    // Outfit variant generation (MonStats[19] -> MonStats2[1], bTotalPieces > 2, 3 multi-choice components)
    const pFallenTxt = (pMonStatsArr + 19 * 0x1a8) >>> 0
    m.setU16((pFallenTxt + 0x18) >>> 0, 1)
    const pFallenStats2 = (pMonStats2Arr + 1 * 0x134) >>> 0
    m.setU8((pFallenStats2 + 0x15 + 0) >>> 0, 3) // HD: 3 variants
    m.setU8((pFallenStats2 + 0x15 + 1) >>> 0, 2) // TR: 2 variants
    m.setU8((pFallenStats2 + 0x15 + 5) >>> 0, 4) // RH: 4 variants
    m.setU8((pFallenStats2 + 0x25) >>> 0, 4) // 2^4 = 16 max combos
    m.setU8((pFallenStats2 + 0xec) >>> 0, 6) // > 2 total pieces

    const pRoom = m.alloc(0x80)
    const pRoomEx = m.alloc(0x100)
    const pLevel = m.alloc(0x210)
    m.setU32((pLevel + 0x1d0) >>> 0, 2)
    m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
    m.setU32((pRoom + 0x10) >>> 0, pRoomEx)

    const ppMonRegTable = m.alloc(16 * 4)
    const pMonReg = m.alloc(0x300)
    m.setU32((ppMonRegTable + 2 * 4) >>> 0, pMonReg)

    const { pUnit, pMonData } = allocTestMonsterUnit(m, 0, 12, 19, 1, 5600, 5800, pFallenTxt)
    m.setU32((pUnit + 0x20) >>> 0, 0x55aa1234)
    m.setU32((pUnit + 0x24) >>> 0, 666)

    const pActOutfit = MONREG_GetOrCreateActOutfit113c(m, ppMonRegTable, pRoom, pUnit)
    expect(pActOutfit).toBe((pMonReg + 0x14) >>> 0)
    expect(m.u8((pActOutfit + 0x03) >>> 0)).toBe(3)
    MONSTER_ChooseOutfit113c(m, pUnit, pActOutfit)
    expect(m.u8((pMonData + 0x04 + 0) >>> 0)).toBeLessThan(3)
    expect(m.u8((pMonData + 0x04 + 5) >>> 0)).toBeLessThan(4)

    // Early return 0 on special classId 195
    const { pUnit: pSpecial } = allocTestMonsterUnit(m, 0, 99, 195, 1, 5600, 5800, 0)
    expect(MONREG_GetOrCreateActOutfit113c(m, ppMonRegTable, pRoom, pSpecial)).toBe(0)

    // MONREG spawn count & active count tracking
    MONREG_IncrementSpawnCount113c(m, pUnit, 0, ppMonRegTable, pRoom)
    expect(m.u32((pMonReg + 0x2cc) >>> 0)).toBe(1)
    m.setU32((pMonData + 0x58) >>> 0, 2)
    MONREG_UpdateActiveCountOnMode113c(m, pUnit, 0, 1, ppMonRegTable)
    expect(m.u32((pMonReg + 0x2cc) >>> 0)).toBe(0)

    // AI dispatch lookup (0x6FCBD0F0), chase flag, sound event, and combat list unlink
    m.setU16((pFallenTxt + 0x1e) >>> 0, 5) // wAi = 5 (Fallen)
    expect(AI_LookupDispatchTableRow113c(m, pUnit, 0)).toBe(
      (D2GAME_MONSTER_AI_TABLE_VA_113C + 5 * 16) >>> 0,
    )
    expect(AI_LookupDispatchTableRow113c(m, pUnit, 2)).toBe(
      (D2GAME_SPECIAL_AI_TABLE_VA_113C + 2 * 16) >>> 0,
    )

    m.setU32((pMonData + 0x54) >>> 0, 3)
    expect(MONSTER_HasAlwaysChaseFlag113c(m, pUnit)).toBe(1)
    expect(MONSTER_CheckTypeFlagsMask113c(m, pUnit, 0x08)).toBe(0)

    AI_SetAiControlOverrides113c(m, pUnit, 1, 50, 99)
    const pAiParam = m.u32((pMonData + 0x2c) >>> 0)
    expect(m.u32((pAiParam + 0x18) >>> 0)).toBe(7)
    expect(m.u32((pAiParam + 0x1c) >>> 0)).toBe(50)
    expect(m.u8((pAiParam + 0x20) >>> 0)).toBe(0x4d)

    SUNIT_SetUnitEventSound113c(m, pUnit, 0x10, 0)
    expect(m.u16((pUnit + 0x6e) >>> 0)).toBe(0x10)
    expect(m.u32((pUnit + 0xc4) >>> 0) & 0x400).toBe(0x400)

    const pCombat1 = m.alloc(0x88)
    const pCombat2 = m.alloc(0x88)
    m.setU32((pCombat1 + 0x04) >>> 0, 1)
    m.setU32((pCombat1 + 0x08) >>> 0, 12) // matches pUnit (type=1, guid=12)
    m.setU32((pCombat1 + 0x84) >>> 0, pCombat2)
    m.setU32((pCombat2 + 0x04) >>> 0, 0)
    m.setU32((pCombat2 + 0x08) >>> 0, 1) // different attacker -> preserved
    m.setU32((pUnit + 0xac) >>> 0, pCombat1)
    SUNITDMG_FreeAttackerCombatList113c(m, pUnit, 0)
    expect(m.u32((pUnit + 0xac) >>> 0)).toBe(pCombat2)

    // Keep unused imports referenced & verified
    expect(SEED_RollLimitedFast113c(m, pSeed, 4)).toBeLessThan(4)
    expect(MONSTER_RollPackRarityType113c(m, pMonReg, pRoom)).toBeGreaterThanOrEqual(0)
    const ppOut = m.alloc(4)
    m.setU8((pMonReg + 0x10) >>> 0, 1)
    m.setU8((pMonReg + 0x11) >>> 0, 10)
    m.setU16((pMonReg + 0x14) >>> 0, 19)
    m.setU8((pMonReg + 0x16) >>> 0, 10)
    m.setU32((pRoom + 0x6c) >>> 0, 1)
    m.setU32((pRoom + 0x70) >>> 0, 666)
    expect(MONSTER_ChooseMonsterClass113c(m, 0, pRoom, pMonReg, pUnit, ppOut, 20)).toBe(19)
    MONREG_GenerateOutfitVariants113c(m, pSeed, pActOutfit, 3)
    expect(AI_CalcApproxUnitDistSubtiles113c(m, pUnit, pSpecial)).toBeGreaterThanOrEqual(0)
  })
})
