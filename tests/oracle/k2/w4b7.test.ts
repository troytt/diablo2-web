import { describe, expect, it } from 'vitest';
import { D2COMMON_GDWBITMASKS_IAT_VA_113C } from '../../../src/d2kern-113c/common/inline-helpers.ts';
import {
  D2COMMON_ITEMS_TXT_COUNT_VA_113C,
  D2COMMON_ITEMS_TXT_PTR_VA_113C,
  INVENTORY_AllocInventory113c,
  ITEMS_TXT_STRIDE_113C,
} from '../../../src/d2kern-113c/common/inventory.ts';
import { ITEMS_AllocItemData113c } from '../../../src/d2kern-113c/common/items.ts';
import {
  MISSILE_AllocMissileData113c,
  MISSILE_SetLevel113c,
  MISSILE_SetRemainingFrames113c,
  MISSILE_SetSkill113c,
  MISSILE_SetTotalFrames113c,
} from '../../../src/d2kern-113c/common/missile.ts';
import { PATH_SetTargetUnit113c } from '../../../src/d2kern-113c/common/path.ts';
import {
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts';
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts';
import {
  AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c,
  ARENA_UpdatePlayerArenaScore_6FCD2820_113c,
  ITEMMODS_ApplyAttackerTakesDamage_6FCCD6C0_113c,
  ITEMMODS_ApplyAttackerTakesFireDamage_6FCCD7B0_113c,
  ITEMMODS_ApplyAttackerTakesLightningDamage_6FCCD860_113c,
  ITEMMODS_ApplyCrushingBlow_6FCCCC30_113c,
  ITEMMODS_ApplyHealAfterDemonKill_6FCCCA70_113c,
  ITEMMODS_ApplyHealAfterKill_6FCCCB10_113c,
  ITEMMODS_ApplyKnockback_6FCCCE60_113c,
  ITEMMODS_ApplyManaAfterKill_6FCCCBA0_113c,
  ITEMMODS_ApplyMonsterFlee_6FCCD580_113c,
  ITEMMODS_ApplySlowTarget_6FCCD2A0_113c,
  ITEMS_SendInventoryItemCmdFlag4Updates3F_6FCCCF10_113c,
  ITEMS_SendUseScrollOrTomePacket3F_6FCCCFD0_113c,
  MISSILE_ConfigureSkillRangeAndFrames_6FCD32E0_113c,
  MISSILE_InitSpiderWebOrChargedBoltPath_6FCD31D0_113c,
  MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c,
  MONAI_CanMonsterTeleportOrUseSkillInMode_6FCD0B20_113c,
  MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c,
  MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c,
  MONAI_EvaluateTargetCandidateCallback_6FCD1660_113c,
  MONAI_FindNearestFriendlyMonsterCallback_6FCD14B0_113c,
  MONAI_ForEachPackMemberWithFilter_6FCD1320_113c,
  MONAI_ForEachUnitInAdjacentRooms_6FCD0720_113c,
  MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c,
  MONAI_ImpregnateChaseThink_6FCC7F60_113c,
  MONAI_IsHostileAttackableTargetFilter_6FCD1400_113c,
  MONAI_MeleeAndRangedSkillThink_6FCC6530_113c,
  MONAI_MeleeSkillOrApproachWithTimerThink_6FCC5D70_113c,
  MONAI_MinionSwitchToBaseAiThink_6FCC5C80_113c,
  MONAI_NestOrMeleeWanderThink_6FCC5B30_113c,
  MONAI_PutridDefilerThink_6FCC7290_113c,
  MONAI_TryCastLeftSkillOrRunTowardTarget_6FCC6AB0_113c,
  MONAI_UnburrowThink_6FCC59B0_113c,
  MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c,
  MONSTER_ClearUnitCollisionAndAttackableFlags_6FCD3120_113c,
  MONSTER_FindNextAnimEventInRemainingFrames_6FCD2E00_113c,
  MONSTER_HealPercentLifeAndUpdateFrameMetrics_6FCD3060_113c,
  MONSTER_InitChargeOrLeapSkillTargetParams_6FCD35A0_113c,
  MONSTER_InitSkillSequenceFrameFromCalc_6FCD2FC0_113c,
  MONSTER_LockTargetUnitIntoSkillParamsAndSetPathPos_6FCD36A0_113c,
  MONSTER_MorphMonsterClassId_6FCCFC50_113c,
  MONSTER_StartChargeSkillStateAndParam1_6FCD2ED0_113c,
  SKILLS_RemoveAuraStateAndEvent9OnSkillChange_6FCCD050_113c,
  SKILLS_RestartAuraEvent9AndTriggerOnSkillChange_6FCCDB30_113c,
} from '../../../src/d2kern-113c/game/k2-w4b7-113c.ts';
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts';
import { ensureD2CommonPathGlobals113c } from '../../../src/d2kern-113c/game/tables-bootstrap-113c.ts';
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts';
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2DrlgLevelStrc,
  D2DrlgLevelStrc_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2RoomCollisionGridStrc,
  D2RoomCollisionGridStrc_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
} from '../../../src/d2kern-113c/mem/layout.generated.ts';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

function createW4B7World() {
  const m = new SparseMemory113c();
  m.fill(0x6fd18000, 0x20000, 0);
  m.fill(0x6fdd6000, 0x20000, 0);

  const pDataTables = m.alloc(0x1000);
  initD2GameGlobalsInMem113c(m, pDataTables);
  ensureD2CommonPathGlobals113c(m);
  m.setU32(0x6fde9e1c, pDataTables);
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(0x6fd18be0));

  const missilesCount = 64;
  const pMissilesTxt = m.alloc(missilesCount * 0x1a4);
  m.setU32(pDataTables + 0xb64, pMissilesTxt);
  m.setU32(pDataTables + 0xb6c, missilesCount);
  for (let i = 0; i < missilesCount; i++) {
    const rec = pMissilesTxt + i * 0x1a4;
    m.setU16(rec, i);
    m.setU32(rec + 0x3c, 12);
    m.setU8(rec + 0x178, 16);
  }

  const skillsCount = 350;
  const pSkillsTxt = m.alloc(skillsCount * 0x23c);
  m.setU32(pDataTables + 0xb98, pSkillsTxt);
  m.setU32(pDataTables + 0xba0, skillsCount);
  for (let i = 0; i < skillsCount; i++) {
    m.setU16(pSkillsTxt + i * 0x23c, i);
  }

  const pSkillCode = m.alloc(0x400);
  m.setU32(pDataTables + 0x40, pSkillCode);
  m.setU32(pDataTables + 0x44, 0x400);

  const iscCount = 400;
  const pIscTxt = m.alloc(iscCount * 0x144);
  m.setU32(pDataTables + 0xbcc, pIscTxt);
  m.setU32(pDataTables + 0xbd4, iscCount);

  const statesCount = 200;
  const pStatesTxt = m.alloc(statesCount * 0x3c);
  m.setU32(pDataTables + 0xbc, pStatesTxt);
  m.setU32(pDataTables + 0xc4, statesCount);
  m.setU32(pDataTables + 0xbb8, pStatesTxt);
  m.setU32(pDataTables + 0xbc0, statesCount);

  const pStateMasks = m.alloc(64);
  m.setU32(pDataTables + 0xdc, pStateMasks);
  m.setU32(pDataTables + 0xf8, pStateMasks);
  m.setU32(pDataTables + 0xfc, pStateMasks);
  m.setU32(pDataTables + 0x104, pStateMasks);
  m.setU32(pDataTables + 0x144, pStateMasks);
  m.setU32(pDataTables + 0x150, pStateMasks);

  const pCharStatsTxt = m.alloc(8 * 0xc4);
  m.setU32(pDataTables + 0xbc4, pCharStatsTxt);
  m.setU32(pDataTables + 0xbc8, 8);

  const monStatsCount = 400;
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8);
  m.setU32(pDataTables + 0xa78, pMonStatsTxt);
  m.setU32(pDataTables + 0xa80, monStatsCount);
  for (let i = 0; i < monStatsCount; i++) {
    m.setU16(pMonStatsTxt + i * 0x1a8, i);
    m.setU16(pMonStatsTxt + i * 0x1a8 + 0x06, i);
    m.setU16(pMonStatsTxt + i * 0x1a8 + 0x18, i);
  }

  const monStats2Count = 400;
  const pMonStats2Txt = m.alloc(monStats2Count * 0x134);
  m.setU32(pDataTables + 0xa84, pMonStats2Txt);
  m.setU32(pDataTables + 0xa8c, monStats2Count);
  m.setU32(pDataTables + 0xa90, pMonStats2Txt);
  m.setU32(pDataTables + 0xa98, monStats2Count);

  const monLvlCount = 120;
  const pMonLvlTxt = m.alloc(monLvlCount * 0x78);
  m.setU32(pDataTables + 0xb70, pMonLvlTxt);
  m.setU32(pDataTables + 0xb74, monLvlCount);

  const pLevelsTxt = m.alloc(140 * D2LevelsTxt_SIZE);
  m.setU32(pDataTables + 0x1dc, pLevelsTxt);
  m.setU32(pDataTables + 0x1e0, 140);
  for (let lvl = 1; lvl < 140; lvl++) {
    m.set(pLevelsTxt + lvl * D2LevelsTxt_SIZE, D2LevelsTxt.nAct, 0);
  }

  const pItemsTxt = m.alloc(32 * ITEMS_TXT_STRIDE_113C);
  m.setU32(D2COMMON_ITEMS_TXT_PTR_VA_113C, pItemsTxt);
  m.setU32(D2COMMON_ITEMS_TXT_COUNT_VA_113C, 32);

  const pAnimDataTable = m.alloc(0x500);
  const pEmptyBucket = m.alloc(16);
  for (let i = 0; i < 256; i++) {
    m.setU32(pAnimDataTable + i * 4, pEmptyBucket);
  }
  m.setU32(pAnimDataTable + 0x40c, 8);
  m.setU32(pAnimDataTable + 0x410, 256);
  m.setU32(0x6fdf0b4c, pAnimDataTable);
  m.setU32(0x6fdf13a4, 20);
  m.setU32(0x6fdf13b0, m.alloc(20 * 0x34));
  m.setU32(0x6fdf13c4, 20);
  m.setU32(0x6fdf13c8, 1);
  m.setU32(0x6fdf13cc, m.alloc(20 * 0x34));
  m.setU32(0x6fdf13d0, m.alloc(20 * 0x34));

  const pGame = m.alloc(0x2000);
  m.setU32(pGame + 0xa8, 100);
  m.setU32(pGame + 0x1d28, m.alloc(0x20));
  EVENT_InitTimerQueue113c(m, pGame);

  return {
    m,
    pGame,
    pDataTables,
    pMissilesTxt,
    pSkillsTxt,
    pMonStatsTxt,
    pMonStats2Txt,
  };
}

function allocRoomWithCollision(
  m: SparseMemory113c,
  subtileX = 80,
  subtileY = 80,
  width = 60,
  height = 60,
  nLevelId = 2,
) {
  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE);
  const pRoomEx = m.alloc(D2RoomExStrc_SIZE);
  const pLevel = m.alloc(D2DrlgLevelStrc_SIZE);
  const pActFlag = m.alloc(16);
  const pGrid = m.alloc(D2RoomCollisionGridStrc_SIZE);
  const pCells = m.alloc(width * height * 2);

  m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx);
  m.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, pActFlag);
  m.set(pRoom, D2ActiveRoomStrc.pCollisionGrid, pGrid);
  m.set(pRoom, D2ActiveRoomStrc.nSubtileX, subtileX);
  m.set(pRoom, D2ActiveRoomStrc.nSubtileY, subtileY);
  m.set(pRoom, D2ActiveRoomStrc.nSubtileWidth, width);
  m.set(pRoom, D2ActiveRoomStrc.nSubtileHeight, height);

  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel);
  m.set(pLevel, D2DrlgLevelStrc.nLevelId, nLevelId);

  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileX, subtileX);
  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileY, subtileY);
  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileWidth, width);
  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileHeight, height);
  m.set(pGrid, D2RoomCollisionGridStrc.pMapStart, pCells);

  return { pRoom, pGrid, pCells };
}

function allocDynamicUnitWithRoom(
  m: SparseMemory113c,
  pGame: number,
  unitType: number,
  classId: number,
  unitId: number,
  pRoom: number,
  x = 100,
  y = 100,
) {
  const pUnit = m.alloc(0x100);
  const pUnitData = m.alloc(0x180);
  const pPath = m.alloc(0x200);
  m.setU32(pUnit, unitType >>> 0);
  m.setU32(pUnit + 0x04, classId >>> 0);
  m.setU32(pUnit + 0x0c, unitId >>> 0);
  m.setU32(pUnit + 0x10, 1);
  m.setU32(pUnit + 0x14, pUnitData);
  if (unitType === 1) {
    const pDataTables = m.u32(0x6fde9e1c);
    const pMonStatsTxt = m.u32(pDataTables + 0xa78);
    const pAiCtrl = m.alloc(0x40);
    m.setU32(pUnitData, (pMonStatsTxt + classId * 0x1a8) >>> 0);
    m.setU32(pUnitData + 0x2c, pAiCtrl);
  } else if (unitType === 0) {
    const pClient = m.alloc(0x520);
    m.setU32(pUnitData + 0x9c, pClient);
    const pInv = INVENTORY_AllocInventory113c(m, 0, pUnit);
    m.setU32(pUnit + 0x60, pInv);
  }
  m.setU32(pUnit + 0x20, 0x12345678);
  m.setU32(pUnit + 0x24, 0x9abcdef0);
  m.setU32(pUnit + 0x2c, pPath);
  m.setU32(pUnit + 0x80, pGame);
  m.setU16(pPath + 0x02, x & 0xffff);
  m.setU16(pPath + 0x06, y & 0xffff);
  m.setU32(pPath + 0x1c, pRoom);
  m.setU32(pPath + 0x30, pUnit);
  const pStatListEx = STATLIST_CreateEx113c(m, pUnit, 0, 0);
  m.setU32(pUnit + 0x5c, pStatListEx);
  STATLIST_SetUnitStat113c(m, pUnit, 6, 100 << 8, 0);
  STATLIST_SetUnitStat113c(m, pUnit, 7, 100 << 8, 0);
  if (unitType === 0) {
    const pAlignList = STATLIST_AllocList113c(m, 0, 2, 0, 0, unitId);
    STATLIST_SetState113c(m, pAlignList, 0x69);
    STATLIST_SetStat113c(m, pAlignList, 0xac, 2, 0);
    STATLIST_MergeStatLists113c(m, pUnit, pAlignList, 1);
  }
  m.setU32(pUnit + 0xc4, 0x04);
  SUNIT_InsertServerUnit113c(m, pGame, pUnit);
  return { pUnit, pPath, pUnitData, pStatListEx };
}

describe('K2 Wave 4 Batch 7 (w4b7): D2Game.dll 0x6FCC59B0..0x6FCD36A0', () => {
  it('executes monster AI think routines [1/45..8/45]', () => {
    const { m, pGame, pMonStatsTxt, pMonStats2Txt } = createW4B7World();
    const { pRoom } = allocRoomWithCollision(m);
    const { pUnit, pUnitData } = allocDynamicUnitWithRoom(m, pGame, 1, 1, 101, pRoom, 100, 100);
    const { pUnit: pTarget } = allocDynamicUnitWithRoom(m, pGame, 0, 0, 1, pRoom, 105, 105);

    const pAiCtrl = m.u32(pUnitData + 0x2c);
    const pAiTick = m.alloc(0x40);
    const pMonRecord = pMonStatsTxt + 1 * 0x1a8;
    const pMonStats2Record = pMonStats2Txt + 1 * 0x134;

    m.setU32(pAiTick + 0x00, pAiCtrl);
    m.setU32(pAiTick + 0x04, 0);
    m.setU32(pAiTick + 0x08, pTarget);
    m.setU32(pAiTick + 0x0c, 1);
    m.setU32(pAiTick + 0x10, 0);
    m.setU32(pAiTick + 0x14, 5);
    m.setU32(pAiTick + 0x18, 1);
    m.setU32(pAiTick + 0x1c, pMonRecord);
    m.setU32(pAiTick + 0x20, pMonStats2Record);

    MONAI_UnburrowThink_6FCC59B0_113c(m, pGame, pUnit, pAiTick);
    MONAI_NestOrMeleeWanderThink_6FCC5B30_113c(m, pGame, pUnit, pAiTick);
    MONAI_MinionSwitchToBaseAiThink_6FCC5C80_113c(m, pGame, pUnit, pAiTick);
    MONAI_MeleeSkillOrApproachWithTimerThink_6FCC5D70_113c(m, pGame, pUnit, pAiTick);
    MONAI_MeleeAndRangedSkillThink_6FCC6530_113c(m, pGame, pUnit, pAiTick);
    const r6 = MONAI_TryCastLeftSkillOrRunTowardTarget_6FCC6AB0_113c(
      m,
      0,
      pTarget,
      pUnit,
      1,
      pGame,
      0,
      105,
      105,
    );
    expect(typeof r6).toBe('number');
    MONAI_PutridDefilerThink_6FCC7290_113c(m, pGame, pUnit, pAiTick);
    MONAI_ImpregnateChaseThink_6FCC7F60_113c(m, pGame, pUnit, pAiTick);
  });

  it('evaluates MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c [9/45]', () => {
    const m = new SparseMemory113c();
    const pSlopes = m.alloc(20);
    m.setU32(pSlopes + 0x00, 10);
    m.setU32(pSlopes + 0x04, 20);
    m.setU32(pSlopes + 0x08, 30);
    m.setU32(pSlopes + 0x0c, 40);
    m.setU32(pSlopes + 0x10, 50);

    expect(MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c(m, 0, 15)).toBe(0);
    expect(MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c(m, pSlopes, 1)).toBe(0);
    expect(MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c(m, pSlopes, 15)).toBe(140);
    expect(MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c(m, pSlopes, 30)).toBe(440);
    expect(MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c(m, pSlopes, 45)).toBe(890);
    expect(MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c(m, pSlopes, 60)).toBe(1490);
    expect(MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c(m, pSlopes, 75)).toBe(2240);
  });

  it('executes ITEMMODS and ITEMS packet/aura helpers [10/45..23/45]', () => {
    const { m, pGame } = createW4B7World();
    const { pRoom } = allocRoomWithCollision(m);
    const { pUnit: pAttacker } = allocDynamicUnitWithRoom(m, pGame, 0, 0, 1, pRoom, 100, 100);
    const { pUnit: pDefender } = allocDynamicUnitWithRoom(m, pGame, 1, 1, 2, pRoom, 102, 102);

    const pItem = m.alloc(0x100);
    m.setU32(pItem, 4);
    m.setU32(pItem + 0x0c, 99);
    ITEMS_AllocItemData113c(m, 0, pItem);

    const pDmg = m.alloc(0x80);

    expect(ITEMMODS_ApplyHealAfterDemonKill_6FCCCA70_113c(m, pAttacker, pDefender, pDmg, 0)).toBe(0);
    expect(ITEMMODS_ApplyHealAfterKill_6FCCCB10_113c(m, pAttacker, pDefender, pDmg, 0)).toBe(0);
    expect(ITEMMODS_ApplyManaAfterKill_6FCCCBA0_113c(m, pAttacker, pDefender, pDmg, 0)).toBe(0);
    expect(ITEMMODS_ApplyCrushingBlow_6FCCCC30_113c(m, 0, pAttacker, pDefender, pDmg, 0)).toBe(0);
    expect(ITEMMODS_ApplyKnockback_6FCCCE60_113c(m, pAttacker, pDefender, pDmg, 0)).toBe(0);

    ITEMS_SendInventoryItemCmdFlag4Updates3F_6FCCCF10_113c(m, pAttacker, 0);
    expect(ITEMS_SendUseScrollOrTomePacket3F_6FCCCFD0_113c(m, 220, pAttacker, pItem)).toBe(1);
    SKILLS_RemoveAuraStateAndEvent9OnSkillChange_6FCCD050_113c(m, pAttacker, 1, pGame, 1);
    expect(ITEMMODS_ApplySlowTarget_6FCCD2A0_113c(m, pAttacker, pDefender, pDmg, 0)).toBe(0);
    expect(ITEMMODS_ApplyMonsterFlee_6FCCD580_113c(m, pGame, 0, pAttacker, pDefender, pDmg, 0)).toBe(0);
    expect(ITEMMODS_ApplyAttackerTakesDamage_6FCCD6C0_113c(m, pGame, pDefender, pAttacker, pDmg, 0)).toBe(0);
    expect(ITEMMODS_ApplyAttackerTakesFireDamage_6FCCD7B0_113c(m, pGame, pDefender, pAttacker, pDmg, 0)).toBe(0);
    expect(ITEMMODS_ApplyAttackerTakesLightningDamage_6FCCD860_113c(m, pGame, pDefender, pAttacker, pDmg, 0)).toBe(0);
    SKILLS_RestartAuraEvent9AndTriggerOnSkillChange_6FCCDB30_113c(m, pAttacker, pGame, 1, 1, 1);
  });

  it('executes monster morph, room/pack iterators, target filters, and arena/skill/missile helpers [24/45..45/45]', () => {
    const { m, pGame, pSkillsTxt } = createW4B7World();
    const { pRoom } = allocRoomWithCollision(m);
    const { pUnit, pPath } = allocDynamicUnitWithRoom(m, pGame, 1, 1, 10, pRoom, 100, 100);
    const { pUnit: pTarget } = allocDynamicUnitWithRoom(m, pGame, 0, 0, 20, pRoom, 110, 115);
    const pCtx = m.alloc(0x80);

    m.setU32(pUnit + 0xc4, 0x0f);
    m.setU32(pPath + 0x58, pTarget);

    expect(MONSTER_MorphMonsterClassId_6FCCFC50_113c(m, pUnit, pGame, 1, 1)).toBe(0);
    expect(MONAI_ForEachUnitInAdjacentRooms_6FCD0720_113c(m, pUnit, 0, pGame, pCtx)).toBe(0);
    const dist = AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c(m, pUnit, 90, 90);
    expect(dist).toBeGreaterThanOrEqual(0);
    expect(MONAI_CanMonsterTeleportOrUseSkillInMode_6FCD0B20_113c(m, pUnit, 1)).toBe(0);
    expect(MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c(m, pUnit, 0, pGame, pCtx)).toBe(0);
    expect(typeof MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c(m, pUnit, pTarget)).toBe('number');
    expect(MONAI_ForEachPackMemberWithFilter_6FCD1320_113c(m, pUnit, pGame, 0, 0)).toBe(0);
    expect(MONAI_IsHostileAttackableTargetFilter_6FCD1400_113c(m, pUnit, pTarget, 1)).toBe(1);
    expect(MONAI_IsHostileAttackableTargetFilter_6FCD1400_113c(m, pUnit, pUnit, 1)).toBe(0);
    expect(MONAI_FindNearestFriendlyMonsterCallback_6FCD14B0_113c(m, pGame, pUnit, pUnit, pCtx)).toBe(0);
    expect(MONAI_EvaluateTargetCandidateCallback_6FCD1660_113c(m, 1, pUnit, 0, pCtx)).toBe(0);

    m.setU32(pCtx, 0);
    expect(MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c(m, pUnit, pCtx, pCtx + 4, 1, 1)).toBe(1);
    MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c(m, pTarget, pGame, pUnit, 50);
    const pTargetData = m.u32(pTarget + 0x14);
    const pArenaUnit = m.alloc(0x10);
    m.setU32(pTargetData + 0x34, pArenaUnit);
    const pArenaTxt = m.alloc(0x1c);
    m.setU32(pArenaTxt, 25);
    m.setU32(0x6fdf1400, pArenaTxt);
    ARENA_UpdatePlayerArenaScore_6FCD2820_113c(m, pTarget, 0, pGame, pTarget);
    expect(m.u32(pArenaUnit)).toBe(25);
    expect(MONSTER_FindNextAnimEventInRemainingFrames_6FCD2E00_113c(m, pUnit)).toBe(0);

    const pSkillList = m.alloc(0x40);
    const pSkill = m.alloc(0x40);
    m.setU32(pUnit + 0xa8, pSkillList);
    m.setU32(pSkillList + 0x0c, pSkill);
    m.setU32(pSkillList + 0x10, pSkill);
    m.setU32(pSkill, pSkillsTxt + 1 * 0x23c);

    expect(MONSTER_StartChargeSkillStateAndParam1_6FCD2ED0_113c(m, pGame, pUnit, 1, 1)).toBe(1);
    expect(MONSTER_InitSkillSequenceFrameFromCalc_6FCD2FC0_113c(m, pUnit, 1, 1)).toBe(1);
    expect(MONSTER_HealPercentLifeAndUpdateFrameMetrics_6FCD3060_113c(m, pUnit, 1, 1)).toBe(1);
    expect(MONSTER_ClearUnitCollisionAndAttackableFlags_6FCD3120_113c(m, pUnit)).toBe(1);
    expect(m.u32(pUnit + 0xc4) & 0x0e).toBe(0);

    const { pUnit: pMissile } = allocDynamicUnitWithRoom(m, pGame, 3, 1, 30, pRoom, 100, 100);
    m.setU32(pMissile + 0x10, 0);
    m.setU32(pMissile + 0x14, 0);
    MISSILE_AllocMissileData113c(m, pMissile);
    MISSILE_SetSkill113c(m, pMissile, 1);
    MISSILE_SetLevel113c(m, pMissile, 3);
    MISSILE_SetTotalFrames113c(m, pMissile, 20);
    MISSILE_SetRemainingFrames113c(m, pMissile, 10);
    MISSILE_InitSpiderWebOrChargedBoltPath_6FCD31D0_113c(m, pMissile, 7);
    expect(MISSILE_ConfigureSkillRangeAndFrames_6FCD32E0_113c(m, 1, pMissile, pUnit, 3)).toBe(1);

    PATH_SetTargetUnit113c(m, pPath, pTarget);
    expect(MONSTER_InitChargeOrLeapSkillTargetParams_6FCD35A0_113c(m, pGame, pUnit, 1, 1)).toBe(1);
    expect(MONSTER_LockTargetUnitIntoSkillParamsAndSetPathPos_6FCD36A0_113c(m, pGame, pUnit)).toBe(1);
    expect(MONSTER_LockTargetUnitIntoSkillParamsAndSetPathPos_6FCD36A0_113c(m, pGame, pUnit)).toBe(0);
  });
});
