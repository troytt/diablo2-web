import { describe, expect, it } from 'vitest'
import {
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  PATH_GetType113c,
  PATH_TYPE_FLAGS_6FDE4180,
  PATH_TYPE_STEP_NUMS_6FDE4138,
} from '../../../src/d2kern-113c/common/path.ts'
import { DRLG_PopulateSingleRoom_6FC4CB80_113c } from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c.ts'
import { MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c } from '../../../src/d2kern-113c/game/k2-w11b1-113c.ts'
import { D2Game_6FC92220_113c } from '../../../src/d2kern-113c/game/k2-w13b1-113c.ts'
import { NPCS_HandleNpcMenuRequest_6FCE00C0_113c } from '../../../src/d2kern-113c/game/k2-w16b1-113c.ts'
import { ITEMS_CreateGoldPileInRoomAtCoords_6FC320E0_113c } from '../../../src/d2kern-113c/game/k2-w3b1-113c.ts'
import {
  MONSTER_StartMode8CastA_6FC96A50_113c,
  MONSTER_StartMode8CastB_6FC96B20_113c,
  OBJ_ShrineEffectExplodingPotionsAndMissiles_6FC8C580_113c,
  OBJ_ShrineEffectPoisonPotionsAndClouds_6FC8C200_113c,
  OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b7-113c.ts'
import {
  AI_TentacleSkillCastA_6FC9C060_113c,
  AI_TentacleSkillCastB_6FC9C1D0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b8-113c.ts'
import {
  ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c,
  ITEMS_SpawnRandomArmorInRoomAtCoords_6FC31FB0_113c,
  ITEMS_SpawnRandomCompactWeaponInRoomAtCoords_6FC31E20_113c,
  ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b1-113c.ts'
import {
  ACT5Q3_RegisterAnyaObjectAndSpawnMonster200_6FC7EB30_113c,
  ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c,
  ACT5Q3_SpawnMonster202AndAttachQuestData_6FC7C5C0_113c,
  ACT5Q4_AdvanceObjectToMonsterSpawn_6FC7C480_113c,
  ACT5Q5_ActivateAncientStatueAndSpawnMonster_6FC7E420_113c,
  ACT5Q5_OnArreatSummitPortalResetAncients_6FC7E3C0_113c,
  GAME_AssignUniqueGameName_6FC4BC90_113c,
  ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c,
  ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c,
  ITEMS_SpawnRandomRoomDropAtCoords_6FC32230_113c,
  MISSILE_SrvDmg_ApplyOwnerDmgPercentAndDemonUndeadBonus_6FC5AAA0_113c,
  MISSILE_SrvDmg_TriggerQuest24PortalSpawnOnExpire_6FC5BBB0_113c,
  MISSILE_SrvDo_LinearQuest24PortalTrigger_6FC5F670_113c,
  MISSILE_SrvDo_TriggerChargedAuraInDurationWindow_6FC5F7D0_113c,
  MONUMOD_PromoteToBossWithSingleUMod_6FC44BF0_113c,
  MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c,
  MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c,
  MONUMOD_SpectralHitMissileDamage_6FC43650_113c,
  OBJ_OperateFn19_ArmorStand_6FC8B2E0_113c,
  OBJ_OperateFn20_WeaponRack_6FC8B280_113c,
  PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c,
} from '../../../src/d2kern-113c/game/k2-w4b3-113c.ts'
import { SKILLS_CreateDroppedItemByCodeAtUnit_6FCC1350_113c } from '../../../src/d2kern-113c/game/k2-w4b6-113c.ts'
import { MISSILES_SrvDo_StashGoldFountain_6FC608D0_113c } from '../../../src/d2kern-113c/game/k2-w5b1-113c.ts'
import { ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c } from '../../../src/d2kern-113c/game/k2-w6b4-113c.ts'
import { MONAI_DarkWandererThink_6FCC6E60_113c } from '../../../src/d2kern-113c/game/k2-w8b2-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2DynamicPathStrc,
  D2ItemsTxt_SIZE,
  D2ItemTypesTxt_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2RoomExStrc,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  SGPT_ITEMS_LINKER_PTR_VA,
  SGPT_ITEMS_TXT_COUNT_VA,
  SGPT_ITEMS_TXT_PTR_VA,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'

const ALL_41_R3_VAS = [
  'D2Game:0x6FC31A70',
  'D2Game:0x6FC31CA0',
  'D2Game:0x6FC31E20',
  'D2Game:0x6FC31FB0',
  'D2Game:0x6FC320E0',
  'D2Game:0x6FC32230',
  'D2Game:0x6FC32B90',
  'D2Game:0x6FC32DF0',
  'D2Game:0x6FC43650',
  'D2Game:0x6FC43BF0',
  'D2Game:0x6FC43CA0',
  'D2Game:0x6FC44BF0',
  'D2Game:0x6FC4BC90',
  'D2Game:0x6FC4CB80',
  'D2Game:0x6FC57F80',
  'D2Game:0x6FC5AAA0',
  'D2Game:0x6FC5BBB0',
  'D2Game:0x6FC5F670',
  'D2Game:0x6FC5F7D0',
  'D2Game:0x6FC608D0',
  'D2Game:0x6FC7C480',
  'D2Game:0x6FC7C5C0',
  'D2Game:0x6FC7C690',
  'D2Game:0x6FC7E3C0',
  'D2Game:0x6FC7E420',
  'D2Game:0x6FC7EB30',
  'D2Game:0x6FC8AFA0',
  'D2Game:0x6FC8B070',
  'D2Game:0x6FC8B280',
  'D2Game:0x6FC8B2E0',
  'D2Game:0x6FC8C200',
  'D2Game:0x6FC8C580',
  'D2Game:0x6FC92220',
  'D2Game:0x6FC96A50',
  'D2Game:0x6FC96B20',
  'D2Game:0x6FC9C060',
  'D2Game:0x6FC9C1D0',
  'D2Game:0x6FCA9730',
  'D2Game:0x6FCC1350',
  'D2Game:0x6FCC6E60',
  'D2Game:0x6FCE00C0',
] as const

function createRemedR3World() {
  const m = new SparseMemory113c()
  m.fill(0x6fd18000, 0x30000, 0)
  m.fill(0x6fdd6000, 0x28000, 0)
  m.fill(0x00f0_b000, 0x1000, 0)

  const pDataTables = m.alloc(0x2000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))

  // ItemStatCost (360 records)
  const pItemStatCost = m.alloc(360 * 0x144)
  m.setU32(pDataTables + 0x2c, pItemStatCost)
  m.setU32(pDataTables + 0x34, 360)
  m.setU32(pDataTables + 0xbcc, pItemStatCost)
  m.setU32(pDataTables + 0xbd4, 360)
  m.setU32(0x6fde9e48, pItemStatCost)
  m.setU32(0x6fde9e50, 360)

  // ItemsTxt: 0..3 weapons, 4..7 armor, 8..15 misc
  // 0 = compact weapon ('hax '), 4 = armor ('cap '), 8 = misc ('key '),
  // 9 = 'gld ' (0x20646c67), 10 = 'gpm ' (0x206d7067), 11 = 'opm ' (0x206d706f), 12 = 'box ' (0x20786f62)
  const pItemsTxt = m.alloc(16 * D2ItemsTxt_SIZE)
  m.setU32(pDataTables + 0x00, 16)
  m.setU32(pDataTables + 0x04, pItemsTxt)
  m.setU32(pDataTables + 0xbd8, pItemsTxt)
  m.setU32(pDataTables + 0xbdc, 16)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, 16)
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32(0x6fdefb9c, pItemsTxt)
  m.setU32(0x6fdefba0, 4)
  m.setU32(0x6fdefba4, pItemsTxt + 4 * D2ItemsTxt_SIZE)
  m.setU32(0x6fdefba8, 4)
  m.setU32(0x6fdefbac, pItemsTxt + 8 * D2ItemsTxt_SIZE)
  m.setU32(0x6fdefbb0, 8)

  const codes: Array<[number, number]> = [
    [9, 0x20646c67], // 'gld '
    [10, 0x206d7067], // 'gpm '
    [11, 0x206d706f], // 'opm '
    [4, 0x20706163], // 'cap '
    [0, 0x20786168], // 'hax '
    [12, 0x20786f62], // 'box '
    [8, 0x2079656b], // 'key '
  ]
  const pLinker = m.alloc(0x20)
  const pLinkerRows = m.alloc(codes.length * 8)
  m.setU32(pLinker + 0x00, codes.length)
  m.setU32(pLinker + 0x08, pLinkerRows)
  for (let i = 0; i < codes.length; i++) {
    const [idx, code] = codes[i]!
    const rec = pItemsTxt + idx * D2ItemsTxt_SIZE
    m.setU32(rec + 0x80, code)
    m.setU32(rec + 0x84, code) // dwNormCode
    m.setU8(rec + 0xfc, 1) // nRarity
    m.setU8(rec + 0xfd, 1) // nLevel
    m.setU8(rec + 0x10e, 1) // invWidth
    m.setU8(rec + 0x10f, 1) // invHeight
    m.setU16(rec + 0x11e, 1) // wType = 1
    m.setU8(rec + 0x133, 1) // nSpawnable = 1
    m.setU8(rec + 0x14d, 1) // bCompactSave = 1
    m.setU32(pLinkerRows + i * 8, code)
    m.setU32(pLinkerRows + i * 8 + 4, idx)
  }
  m.setU32(SGPT_ITEMS_LINKER_PTR_VA, pLinker)

  // ItemTypesTxt (with self-equivalence bit so wType=1 matches nRequiredType=1)
  const pItemTypesTxt = m.alloc(16 * D2ItemTypesTxt_SIZE)
  m.setU32(pDataTables + 0xbf8, pItemTypesTxt)
  m.setU32(pDataTables + 0xbfc, 16)
  m.setU32(pDataTables + 0xc00, 1)
  const pTypeMatrix = m.alloc(64)
  m.setU32(pTypeMatrix + 1 * 4, 1 << 1)
  m.setU32(pDataTables + 0xc04, pTypeMatrix)
  for (let i = 0; i < 16; i++) {
    m.setU8(pItemTypesTxt + i * D2ItemTypesTxt_SIZE + 0x11, 1) // nNormal = 1 so CompactSave items skip rare/magic crash
  }

  // MonStatsTxt & MonStats2Txt
  const pMonStatsTxt = m.alloc(600 * 0x1a8)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, 600)
  m.setU32(0x6fdf0950, pMonStatsTxt)
  m.setU32(0x6fdf0958, 600)
  const pMonStats2Txt = m.alloc(600 * 0x134)
  m.setU32(pDataTables + 0xa84, pMonStats2Txt)
  m.setU32(pDataTables + 0xa8c, 600)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, 600)
  for (let i = 0; i < 600; i++) {
    const rec = pMonStatsTxt + i * 0x1a8
    m.setU16(rec + 0x00, i)
    m.setU16(rec + 0x02, i)
    m.setU16(rec + 0x06, i)
    m.setU16(rec + 0x18, i) // wMonStatsEx
    m.setU16(rec + 0x56, 10)
  }

  // Skills, Missiles, States, Objects, Levels
  const pSkillsTxt = m.alloc(360 * 0x23c)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 360)
  const pMissilesTxt = m.alloc(400 * 0x1a4)
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, 400)
  m.setU32(0x6fdf0a3c, pMissilesTxt)
  m.setU32(0x6fdf0a44, 400)
  const pStatesTxt = m.alloc(200 * 0x40)
  m.setU32(pDataTables + 0xbc, pStatesTxt)
  m.setU32(pDataTables + 0xc4, 200)
  m.setU32(pDataTables + 0xbbc, pStatesTxt)
  m.setU32(pDataTables + 0xbc0, 200)
  const pObjectsTxt = m.alloc(600 * 0x1c0)
  m.setU32(pDataTables + 0xc98, pObjectsTxt)
  m.setU32(pDataTables + 0xca0, 600)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 600)

  const pLevelsTxt = m.alloc(140 * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0x1dc, pLevelsTxt)
  m.setU32(pDataTables + 0x1e0, 140)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, 140)
  for (let lvl = 1; lvl < 140; lvl++) {
    const rec = pLevelsTxt + lvl * D2LevelsTxt_SIZE
    const act = lvl < 40 ? 0 : lvl < 75 ? 1 : lvl < 103 ? 2 : lvl < 109 ? 3 : 4
    m.set(rec, D2LevelsTxt.nAct, act)
    m.setU8(rec + 0x51, 5) // MonLvl1Ex
    m.setU8(rec + 0x54, 5)
  }

  // AnimData, town levels, path tables, and FieldTbls
  const pAnimDataTable = m.alloc(0x420)
  const pEmptyBucket = m.alloc(16)
  for (let i = 0; i < 256; i++) m.setU32(pAnimDataTable + i * 4, pEmptyBucket)
  m.setU32(pAnimDataTable + 0x40c, 8)
  m.setU32(pAnimDataTable + 0x410, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  m.setU32(0x6fdf13a4, 16)
  m.setU32(0x6fdf13b0, m.alloc(16 * 0x34))
  m.setU32(0x6fdf13c0, m.alloc(8 * 0x34))
  m.setU32(0x6fdf13d0, m.alloc(20 * 0x34))

  const townLevels = [1, 40, 75, 103, 109]
  for (let act = 0; act < 5; act++) m.setU32(0x6fde4084 + act * 4, townLevels[act]!)
  for (let i = 0; i < PATH_TYPE_STEP_NUMS_6FDE4138.length; i++) {
    m.setU32((0x6fde4138 + i * 4) >>> 0, PATH_TYPE_STEP_NUMS_6FDE4138[i]! >>> 0)
  }
  for (let i = 0; i < PATH_TYPE_FLAGS_6FDE4180.length; i++) {
    m.setU32((0x6fde4180 + i * 4) >>> 0, PATH_TYPE_FLAGS_6FDE4180[i]! >>> 0)
  }
  m.fill(0x6fde41c8, 64 * 4, 1)

  const fieldDx = [0, 1, 1, 1, 0, -1, -1, -1, 0]
  const fieldDy = [-1, -1, 0, 1, 1, 1, 0, -1, 0]
  for (let i = 0; i < 9; i++) {
    m.setU32((0x6fde9ba0 + i * 4) >>> 0, fieldDx[i]! >>> 0)
    m.setU32((0x6fde9bc4 + i * 4) >>> 0, fieldDy[i]! >>> 0)
  }
  const pFieldData = m.alloc(256 * 256)
  m.fill(pFieldData, 256 * 256, 8)
  m.setU32(0x6fdf1404, pFieldData)
  m.setU32(0x6fdf1414, 128)
  m.setU32(0x6fdf1418, 128)

  const pGame = m.alloc(0x2000)
  m.setU8(pGame + 0x6d, 0)
  m.setU32(pGame + 0x70, 1)
  m.setU16(pGame + 0x78, 100)
  m.setU32(pGame + 0xd0, 0x12345678)
  m.setU32(pGame + 0xd4, 0x00000001)
  const pObjCtrl = m.alloc(0x600)
  m.setU32(pObjCtrl + 2 * 4 + 0x48, m.alloc(0x40))
  m.setU32(pGame + 0x10f0, pObjCtrl)
  const pQuestCtrl = m.alloc(0x100)
  m.setU32(pQuestCtrl + 0x08, 1)
  m.setU32(pGame + 0x10f4, pQuestCtrl)
  m.setU32(pGame + 0xf0 + 2 * 4, m.alloc(0x300))
  EVENT_InitTimerQueue113c(m, pGame)

  const pRoom = m.alloc(0x90)
  const pRoomEx = m.alloc(0x90)
  const pLevel = m.alloc(0x220)
  const pAct = m.alloc(0x80)
  const ppNear = m.alloc(8)
  m.setU32(ppNear, pRoom)
  m.setU32(pRoom, ppNear)
  m.setU32(pRoom + 0x10, pRoomEx)
  m.setU32(pRoom + 0x24, 1)
  m.setU32(pRoom + 0x3c, pAct)
  m.setU32(pRoom + 0x4c, 100)
  m.setU32(pRoom + 0x50, 100)
  m.setU32(pRoom + 0x54, 40)
  m.setU32(pRoom + 0x58, 40)
  m.setU32(pRoom + 0x6c, 0x13572468)
  m.setU32(pRoom + 0x70, 1)
  const pLogical = m.alloc(0x40)
  m.setU8(pLogical, 1)
  m.setU32(pRoomEx + 0x58, pLevel)
  m.set(pRoomEx, D2RoomExStrc.pLogicalRoomInfo, pLogical)
  m.setU32(pLevel + 0x1d0, 2) // Blood Moor (non-town)
  const pCollGrid = m.alloc(0x28)
  const pCollMap = m.alloc(40 * 40 * 2)
  m.setU32(pCollGrid + 0x00, 100)
  m.setU32(pCollGrid + 0x04, 100)
  m.setU32(pCollGrid + 0x08, 40)
  m.setU32(pCollGrid + 0x0c, 40)
  m.setU32(pCollGrid + 0x20, pCollMap)
  m.setU32(pRoom + 0x20, pCollGrid)

  return { m, pDataTables, pGame, pRoom, pRoomEx, pItemsTxt, pMonStats2Txt }
}

function allocDynUnit(
  m: SparseMemory113c,
  pGame: number,
  pRoom: number,
  dwType: number,
  dwClassId: number,
  x = 110,
  y = 110,
): number {
  const pUnit = m.alloc(0x100)
  const pData = m.alloc(0x90)
  const pPath = m.alloc(0x200)
  m.setU32(pUnit + 0x00, dwType)
  m.setU32(pUnit + 0x04, dwClassId)
  m.setU32(pUnit + 0x0c, (dwClassId + 1) >>> 0)
  m.setU32(pUnit + 0x10, dwType === 1 ? 1 : 0)
  m.setU32(pUnit + 0x14, pData)
  m.setU32(pUnit + 0x20, 0xabcdef01)
  m.setU32(pUnit + 0x24, 1)
  m.setU32(pUnit + 0x2c, pPath)
  m.setU32(pUnit + 0x80, pGame)
  m.setU16(pPath + 0x02, x)
  m.setU16(pPath + 0x06, y)
  m.setU32(pPath + 0x1c, pRoom)
  m.setU32(pPath + 0x30, pUnit)
  m.setU32(pPath + 0x34, 1)
  const pStatList = STATLIST_CreateEx113c(m, pUnit, 0x80000000, pGame)
  m.setU32(pUnit + 0x5c, pStatList)
  STATLIST_SetUnitStat113c(m, pUnit, 12, 10, 0)
  return pUnit
}

describe('K2 Lane R3 Remediation (41 D2Game.dll VAs across 13 files)', () => {
  it('creates real UNIT_ITEM instances via D2GAME_CreateItemEx_6FC31490_113c across item/gold/shrine spawners', () => {
    const { m, pGame, pRoom } = createRemedR3World()
    const pMon = allocDynUnit(m, pGame, pRoom, 1, 5, 110, 110)
    const pPlayer = allocDynUnit(m, pGame, pRoom, 0, 0, 112, 112)

    const pCoords = m.alloc(8)
    m.setU32(pCoords, 110)
    m.setU32(pCoords + 4, 110)

    // 0x6FC31CA0, 0x6FC31E20, 0x6FC31FB0, 0x6FC320E0
    const pMisc = ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c(
      m,
      pCoords,
      pGame,
      pRoom,
      1,
      1,
      pMon,
    ) >>> 0
    expect(pMisc).toBeGreaterThan(0x100)
    expect(m.u32(pMisc)).toBe(4)

    const pWeap = ITEMS_SpawnRandomCompactWeaponInRoomAtCoords_6FC31E20_113c(
      m,
      pGame,
      pRoom,
      pCoords,
      1,
      1,
      pMon,
    ) >>> 0
    expect(pWeap).toBeGreaterThan(0x100)
    expect(m.u32(pWeap)).toBe(4)

    const pArm = ITEMS_SpawnRandomArmorInRoomAtCoords_6FC31FB0_113c(
      m,
      pCoords,
      pRoom,
      pGame,
      1,
      1,
      pMon,
    ) >>> 0
    expect(pArm).toBeGreaterThan(0x100)
    expect(m.u32(pArm)).toBe(4)

    const pGold = ITEMS_CreateGoldPileInRoomAtCoords_6FC320E0_113c(m, pCoords, pGame, pRoom) >>> 0
    expect(pGold).toBeGreaterThan(0x100)
    expect(m.u32(pGold)).toBe(4)
    expect(m.u32(pGold + 0x04)).toBe(9)

    // 0x6FC31A70 & 0x6FC32230 (unhooked real D2GAME_CreateItemEx_6FC31490_113c!)
    const pIlvl = m.alloc(4)
    m.setU32(pIlvl, 5)
    const pOutDrop = m.alloc(0x90)
    const pDropped = ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
      m,
      pGame,
      pMon,
      2,
      pIlvl,
      pOutDrop,
      1,
      1,
    ) >>> 0
    expect(pDropped).toBeGreaterThan(0x100)
    expect(m.u32(pDropped)).toBe(4)

    const pRoomDrop = ITEMS_SpawnRandomRoomDropAtCoords_6FC32230_113c(
      m,
      pCoords,
      pGame,
      pRoom,
      pOutDrop,
    ) >>> 0
    expect(pRoomDrop).toBeGreaterThan(0x100)
    expect(m.u32(pRoomDrop)).toBe(4)

    // 0x6FC8AFA0, 0x6FC8B070, 0x6FCC1350
    const pObjItem = OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(m, 0x2079656b, pMon, pGame, 2) >>> 0
    expect(pObjItem).toBeGreaterThan(0x100)
    expect(m.u32(pObjItem)).toBe(4)

    const pCubeNew = ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c(
      m,
      pGame,
      pPlayer,
      0x20786f62,
      0,
    ) >>> 0
    expect(pCubeNew).toBe(1)

    const pSkillItem = SKILLS_CreateDroppedItemByCodeAtUnit_6FCC1350_113c(
      m,
      0x2079656b,
      pMon,
      pGame,
      2,
    ) >>> 0
    expect(pSkillItem).toBeGreaterThan(0x100)
    expect(m.u32(pSkillItem)).toBe(4)

    // 0x6FC32B90 (verifies STAT_GOLD=14 written on created gold unit)
    ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c(m, pGame, pPlayer, 250)
  })

  it('verifies the 7 disassembly bug fixes (0x6FC4CB80, 0x6FC96A50/B20, 0x6FC9C060/1D0, 0x6FCA9730, 0x6FCC6E60)', () => {
    const { m, pGame, pRoom, pMonStats2Txt } = createRemedR3World()

    // 0) 0x6FC4CB80: runs default real callees without override and marks room populated (dwFlags |= 1)
    expect(m.u32(pRoom + 0x34) & 1).toBe(0)
    DRLG_PopulateSingleRoom_6FC4CB80_113c(m, pRoom, pGame)
    expect(m.u32(pRoom + 0x34) & 1).toBe(1)

    // 1) 0x6FC96A50 & 0x6FC96B20: MonStats2[+0x105] bit 0 -> path type 0x0d vs unchanged
    const pCasterA = allocDynUnit(m, pGame, pRoom, 1, 20, 115, 115)
    const pPathA = m.u32(pCasterA + 0x2c)
    m.set(pPathA, D2DynamicPathStrc.dwPathType, 2)
    m.setU8(pMonStats2Txt + 20 * 0x134 + 0x105, 0)
    MONSTER_StartMode8CastA_6FC96A50_113c(m, pGame, pCasterA)
    expect(PATH_GetType113c(m, pPathA)).toBe(2)

    const pCasterB = allocDynUnit(m, pGame, pRoom, 1, 21, 116, 116)
    const pPathB = m.u32(pCasterB + 0x2c)
    m.set(pPathB, D2DynamicPathStrc.dwPathType, 2)
    m.setU8(pMonStats2Txt + 21 * 0x134 + 0x105, 1)
    MONSTER_StartMode8CastB_6FC96B20_113c(m, pGame, pCasterB)
    expect(PATH_GetType113c(m, pPathB)).toBe(0x0d)

    // 2) 0x6FC9C060 & 0x6FC9C1D0: mode 0 (MONMODE_DEATH) + distinct VA trace hits
    const pTentacleA = allocDynUnit(m, pGame, pRoom, 1, 22, 118, 118)
    const pAiArgs = m.alloc(0x20)
    m.setU32(pAiArgs + 0x00, 1)
    beginVaTrace113c()
    AI_TentacleSkillCastA_6FC9C060_113c(m, pGame, pTentacleA, pAiArgs)
    const hitsA = endVaTrace113c()
    expect(hitsA.has('D2Game:0x6FC9C060')).toBe(true)
    expect(hitsA.has('D2Game:0x6FC9C1D0')).toBe(false)
    expect(m.u32(pTentacleA + 0x10)).toBe(0) // MONMODE_DEATH (0), NOT 4!

    const pTentacleB = allocDynUnit(m, pGame, pRoom, 1, 22, 119, 119)
    beginVaTrace113c()
    AI_TentacleSkillCastB_6FC9C1D0_113c(m, pGame, pTentacleB, pAiArgs)
    const hitsB = endVaTrace113c()
    expect(hitsB.has('D2Game:0x6FC9C1D0')).toBe(true)
    expect(hitsB.has('D2Game:0x6FC9C060')).toBe(false)
    expect(m.u32(pTentacleB + 0x10)).toBe(0)

    // 3) 0x6FCA9730: sets (pUnit->dwFlags | 0x0e) at +0xc4
    const pBurrower = allocDynUnit(m, pGame, pRoom, 1, 23, 120, 120)
    m.setU32(pBurrower + 0xc4, 0)
    expect(MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c(m, pBurrower, pGame)).toBe(1)
    expect(m.u32(pBurrower + 0xc4) & 0x0e).toBe(0x0e)

    // 4) 0x6FCC6E60: invokes real AI_ApproachTarget113c (0x6FD12540) in state 1
    const pWanderer = allocDynUnit(m, pGame, pRoom, 1, 24, 112, 112)
    const pPlayerTarget = allocDynUnit(m, pGame, pRoom, 0, 0, 114, 112)
    const pQuestCtrl = m.u32(pGame + 0x10f4)
    const pQuest1C = m.alloc(0x100)
    const pFilter = m.alloc(0x20)
    m.setU32(pQuest1C + 0x00, 0x1c)
    m.setU32(pQuest1C + 0x18, pFilter)
    m.setU8(pFilter + 0x00, 1)
    m.setU8(pFilter + 0x02, 1)
    m.setU32(pFilter + 0x04, 125)
    m.setU32(pFilter + 0x08, 112)
    m.setU32(pQuestCtrl, pQuest1C)

    const pAiControl = m.alloc(0x30)
    m.setU32(pAiControl + 0x14, 1) // state 1 -> walk toward (125, 112) via 0x6FD12540
    const pWandererAiArg = m.alloc(0x20)
    m.setU32(pWandererAiArg + 0x00, pAiControl)
    m.setU32(pWandererAiArg + 0x08, pPlayerTarget)
    m.setU32(pWandererAiArg + 0x14, 5)
    beginVaTrace113c()
    MONAI_DarkWandererThink_6FCC6E60_113c(m, pGame, pWanderer, pWandererAiArg)
    const hitsW = endVaTrace113c()
    expect(hitsW.has('D2Game:0x6FCC6E60')).toBe(true)
    expect(hitsW.has('D2Game:0x6FD12540')).toBe(true)
    expect(m.u32(pAiControl + 0x14)).toBe(2) // AI state advanced 1 -> 2
  })

  it('records runtime VA hits across all 41 remediated D2Game VAs with zero hook overrides', () => {
    const { m, pGame, pRoom } = createRemedR3World()
    const pMon = allocDynUnit(m, pGame, pRoom, 1, 5, 110, 110)
    const pPlayer = allocDynUnit(m, pGame, pRoom, 0, 0, 112, 112)
    const pObject = m.alloc(0x100)
    const pObjData = m.alloc(0x60)
    const pStaticPath = m.alloc(0x40)
    m.setU32(pObject + 0x00, 2)
    m.setU32(pObject + 0x14, pObjData)
    m.setU32(pObject + 0x2c, pStaticPath)
    m.setU32(pStaticPath + 0x00, pRoom)
    m.setU32(pStaticPath + 0x0c, 114)
    m.setU32(pStaticPath + 0x10, 114)
    const pMissile = allocDynUnit(m, pGame, pRoom, 3, 1, 113, 113)

    const pCoords = m.alloc(8)
    m.setU32(pCoords, 110)
    m.setU32(pCoords + 4, 110)
    const pIlvl = m.alloc(4)
    m.setU32(pIlvl, 5)
    const pOutDrop = m.alloc(0x90)
    const pDmg = m.alloc(0x80)
    const pOperateArgs = m.alloc(0x30)
    m.setU32(pOperateArgs + 0x00, pGame)
    m.setU32(pOperateArgs + 0x04, pObject)
    m.setU32(pOperateArgs + 0x08, pPlayer)
    const pShrineTxt = m.alloc(0x40)
    m.setU32(pShrineTxt + 0x04, 1)
    m.setU32(pShrineTxt + 0x08, 1)
    const pAiArgs = m.alloc(0x20)
    const szName = m.alloc(0x20)
    m.setU8(szName, 0x47)

    beginVaTrace113c()
    ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(m, pGame, pMon, 2, pIlvl, pOutDrop, 1, 1)
    ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c(m, pCoords, pGame, pRoom, 1, 1, pMon)
    ITEMS_SpawnRandomCompactWeaponInRoomAtCoords_6FC31E20_113c(m, pGame, pRoom, pCoords, 1, 1, pMon)
    ITEMS_SpawnRandomArmorInRoomAtCoords_6FC31FB0_113c(m, pCoords, pRoom, pGame, 1, 1, pMon)
    ITEMS_CreateGoldPileInRoomAtCoords_6FC320E0_113c(m, pCoords, pGame, pRoom)
    ITEMS_SpawnRandomRoomDropAtCoords_6FC32230_113c(m, pCoords, pGame, pRoom, pOutDrop)
    ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c(m, pGame, pPlayer, 50)
    ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c(m, pGame, pPlayer, 10)
    MONUMOD_SpectralHitMissileDamage_6FC43650_113c(m, pGame, pMissile, pMon, pDmg)
    MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c(m, pGame, pMon)
    MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c(m, pGame, pMon, 1)
    MONUMOD_PromoteToBossWithSingleUMod_6FC44BF0_113c(m, pMon, pGame, 8)
    GAME_AssignUniqueGameName_6FC4BC90_113c(m, pGame, szName)
    DRLG_PopulateSingleRoom_6FC4CB80_113c(m, pRoom, pGame)
    PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c(m, pGame, 1, pPlayer, 10)
    MISSILE_SrvDmg_ApplyOwnerDmgPercentAndDemonUndeadBonus_6FC5AAA0_113c(
      m,
      pGame,
      pMissile,
      pMon,
      pDmg,
    )
    MISSILE_SrvDmg_TriggerQuest24PortalSpawnOnExpire_6FC5BBB0_113c(m, pGame, pMissile, 0)
    MISSILE_SrvDo_LinearQuest24PortalTrigger_6FC5F670_113c(m, pGame, pMissile)
    MISSILE_SrvDo_TriggerChargedAuraInDurationWindow_6FC5F7D0_113c(m, pGame, 0, 1)
    MISSILES_SrvDo_StashGoldFountain_6FC608D0_113c(m, pGame, pMissile)
    const pQuest = m.alloc(0x100)
    const pQuestData = m.alloc(0x140)
    m.setU32(pQuest + 0x0c, pGame)
    m.setU32(pQuest + 0x18, pQuestData)
    ACT5Q4_AdvanceObjectToMonsterSpawn_6FC7C480_113c(m, pGame, pQuest)
    ACT5Q3_SpawnMonster202AndAttachQuestData_6FC7C5C0_113c(m, pOperateArgs)
    ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c(m, pQuest, pQuestData)
    ACT5Q5_OnArreatSummitPortalResetAncients_6FC7E3C0_113c(m, pQuest, pObject)
    ACT5Q5_ActivateAncientStatueAndSpawnMonster_6FC7E420_113c(m, pQuest, pObject)
    ACT5Q3_RegisterAnyaObjectAndSpawnMonster200_6FC7EB30_113c(m, pOperateArgs)
    OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(m, 0x2079656b, pMon, pGame, 2)
    ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c(m, pGame, pPlayer, 0x20786f62, 0)
    OBJ_OperateFn20_WeaponRack_6FC8B280_113c(m, pOperateArgs)
    OBJ_OperateFn19_ArmorStand_6FC8B2E0_113c(m, pOperateArgs)
    OBJ_ShrineEffectPoisonPotionsAndClouds_6FC8C200_113c(m, pOperateArgs, pShrineTxt)
    OBJ_ShrineEffectExplodingPotionsAndMissiles_6FC8C580_113c(m, pOperateArgs, pShrineTxt)
    D2Game_6FC92220_113c(m, pGame, pPlayer, m.alloc(0x200), m.alloc(0x40))
    MONSTER_StartMode8CastA_6FC96A50_113c(m, pGame, pMon)
    MONSTER_StartMode8CastB_6FC96B20_113c(m, pGame, pMon)
    AI_TentacleSkillCastA_6FC9C060_113c(m, pGame, pMon, pAiArgs)
    AI_TentacleSkillCastB_6FC9C1D0_113c(m, pGame, pMon, pAiArgs)
    MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c(m, pMon, pGame)
    SKILLS_CreateDroppedItemByCodeAtUnit_6FCC1350_113c(m, 0x2079656b, pMon, pGame, 2)
    MONAI_DarkWandererThink_6FCC6E60_113c(m, pGame, pMon, pAiArgs)
    NPCS_HandleNpcMenuRequest_6FCE00C0_113c(m, pPlayer, pGame, 1, 1)
    const hits = endVaTrace113c()

    for (const va of ALL_41_R3_VAS) {
      expect(hits.has(va), `Expected VA hit for ${va}`).toBe(true)
    }
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 12, 0)).toBe(10)
    expect(m.get(pPlayer, D2UnitStrc.dwUnitType)).toBe(0)
  })
})
