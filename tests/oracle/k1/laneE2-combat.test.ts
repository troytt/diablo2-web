import { describe, expect, it } from 'vitest'
import {
  AI_DispatchTargetByAiFlag113c,
  AI_FindNearestPlayerOrAlly113c,
  AI_FindTargetScanRoomCallback113c,
  AI_FleeFrom113c,
  AI_GeneralFindTargetOrThrottle113c,
  AI_IdleWander113c,
  AI_RunMonsterAI113c,
  AI_Stall113c,
  AI_StartAttackMode113c,
  AIGENERAL_BroadcastCmdToMinions113c,
  AIGENERAL_CopyAiCommandParams113c,
  AIGENERAL_ExpireMinionListsInAct113c,
  AIGENERAL_InitBossGroup113c,
  AIGENERAL_LinkMinionToLeader113c,
  AIGENERAL_ReassignPackOnBossDeath113c,
  AiFallen113c,
  AiZombie113c,
  D2AiParamStrc113c,
  D2AiParamStrc_SIZE_113C,
  D2CombatStrc113c,
  ITEMS_ApplyItemDurabilityLoss113c,
  ITEMS_ApplySocketAndEtherealBonuses113c,
  ITEMS_CheckSetItemEligibility113c,
  ITEMS_ChooseTreasureClassItem113c,
  ITEMS_CreateItem113c,
  ITEMS_DropGoldPileAtUnit113c,
  ITEMS_DropMonsterTreasure113c,
  ITEMS_EvalTreasureClassFactor113c,
  ITEMS_ExpireGroundItemsInAct113c,
  ITEMS_FinalizeCreatedItem113c,
  ITEMS_GenerateMagicOrRareAffixes113c,
  ITEMS_GetDropItemLevel113c,
  ITEMS_GetQualityBonusDivisor113c,
  ITEMS_GetQualityMinValue113c,
  ITEMS_InitCreatedItemStats113c,
  ITEMS_InitScrollOrTomeStats113c,
  ITEMS_PickUniqueItem113c,
  ITEMS_RollEarOrClassItem113c,
  ITEMS_RollItemQuality113c,
  ITEMS_RollQualityThreshold113c,
  ITEMS_SpawnDroppedItemAtCoords113c,
  MONSTER_AdvanceAttackOrSkillStep113c,
  MONSTER_ApplyCritDamage113c,
  MONSTER_BroadcastEventSoundToClients113c,
  MONSTER_CheckSandLeaperMidAir113c,
  MONSTER_DropDeathItems113c,
  MONSTER_DropTreasureOnDeath113c,
  MONSTER_EndDeath113c,
  MONSTER_ExecuteEventsWrapper113c,
  MONSTER_ExecuteMeleeSwing113c,
  MONSTER_InitModeChangeStrc113c,
  MONSTER_SetDeathPathAndAnim113c,
  MONSTER_StartAttackOrCast113c,
  MONSTER_StartDeath113c,
  MONSTER_StartMode113c,
  OBJECTS_FindFreeDropCoordsAndSpawnItem113c,
  PLAYER_AdvanceSkillModeFrame113c,
  PLAYER_EndAttackOrBlockAnim113c,
  PLAYER_ScheduleAttackActionFrameEvents113c,
  PLAYER_ScheduleSkillActionFrameEvents113c,
  PLAYER_StartBlockMode113c,
  PLAYER_StartModeAttack113c,
  PLAYER_StartModeAttackWithTarget113c,
  PLAYER_StartModeCast113c,
  PLAYER_StartModeDispatch113c,
  PLAYER_StartModeSkill113c,
  ROOM_RecordMonsterDeath113c,
  SEED_RollLimitedRandomNumber113c,
  SUNIT_SetUnitEventSound113c,
  SUNITDMG_AddDemonDamageBonus113c,
  SUNITDMG_AddLeechedLifeToUnit113c,
  SUNITDMG_AddMonsterTypeDamageBonus113c,
  SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ApplyArmorDurabilityAndGetHit113c,
  SUNITDMG_ApplyArmorPenetrationAndFlatBonus113c,
  SUNITDMG_ApplyAttackerThornsToSelf113c,
  SUNITDMG_ApplyColdChilledEffect113c,
  SUNITDMG_ApplyColdOrFreezeState113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplyElementalAbsorb113c,
  SUNITDMG_ApplyFreezeEffect113c,
  SUNITDMG_ApplyLifeManaSteal113c,
  SUNITDMG_ApplyPoisonEffect113c,
  SUNITDMG_ApplyResistancesAndAbsorb113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
  SUNITDMG_ApplySingleChannelResistance113c,
  SUNITDMG_ApplyStunEffect113c,
  SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c,
  SUNITDMG_CalcMonsterExperience113c,
  SUNITDMG_CheckMonTypeFlag113c,
  SUNITDMG_CheckToHit113c,
  SUNITDMG_ClampManaBurnByMonsterSkill113c,
  SUNITDMG_ComputeExperienceGain113c,
  SUNITDMG_ComputeWeaponBaseDamage113c,
  SUNITDMG_ConsumeManaCost113c,
  SUNITDMG_ConsumeStaminaCost113c,
  SUNITDMG_DistributeExperience113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_ExecuteSingleHit113c,
  SUNITDMG_FillDamageValues113c,
  SUNITDMG_FindCombatDamageData113c,
  SUNITDMG_GetAttackerDamageData113c,
  SUNITDMG_GetColdEffectLengthBonus113c,
  SUNITDMG_GetEffectiveResistance113c,
  SUNITDMG_GetPlayerClientClassId113c,
  SUNITDMG_GetPvpOrPetDamageMultiplier113c,
  SUNITDMG_GetTotalSkillDamageBonus113c,
  SUNITDMG_PrependCombatNode113c,
  SUNITDMG_RemoveCombatNode113c,
  SUNITDMG_ResolveAttackerPlayer113c,
  SUNITDMG_RollDamageValue113c,
  SUNITDMG_RollDodgeAvoidEvadeBlock113c,
  SUNITDMG_RollElementalStatDamage113c,
  SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c,
  SUNITDMG_SelectDeathOverlayFlag113c,
  SUNITDMG_TriggerAttackerBlindOrFlee113c,
  SUNITDMG_TriggerBlockEvents113c,
  SUNITDMG_TriggerGetHitStateAndMode113c,
  SUNITDMG_TriggerPostCombatEvents113c,
} from '../../../src/d2kern-113c/game/combat-a1c-113c.ts'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2AiCmdStrc,
  D2AiGeneralStrc,
  D2AiGeneralStrc_SIZE,
  D2DamageStrc,
  D2DamageStrc_SIZE,
  D2DynamicPathStrc,
  D2DynamicPathStrc_SIZE,
  D2GameStrc,
  D2GameStrc_SIZE,
  D2MonsterDataStrc,
  D2MonsterDataStrc_SIZE,
  D2StatListExStrc_SIZE,
  D2TimerStrc_SIZE,
  D2UnitStrc,
  D2UnitStrc_SIZE,
  EVENT_AllocChunk113c,
  PATH_TYPE_FLAGS_6FDE4180,
  PATH_TYPE_STEP_NUMS_6FDE4138,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
  SparseMemory113c,
  UNIT_MONSTER,
  UNIT_PLAYER,
} from '../../../src/d2kern-113c/index.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'

function createA1cCombatFixture() {
  const m = new SparseMemory113c()
  const pDataTables = m.alloc(0x1000)
  const nMonStatsCount = 100
  const pMonStatsArr = m.alloc(nMonStatsCount * 0x1a8)
  const pMonStats2Arr = m.alloc(10 * 0x134)
  const pMonLvlArr = m.alloc(10 * 0xe4)
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsArr)
  m.setU32((pDataTables + 0xa80) >>> 0, nMonStatsCount)
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Arr)
  m.setU32((pDataTables + 0xa98) >>> 0, 10)
  m.setU32(0x6fdf0b54, pMonLvlArr)
  m.setU32(0x6fdf0b58, 10)
  initD2GameGlobalsInMem113c(m, pDataTables)

  // Hydrate D2Common PATH_SetType113c .rdata tables (0x6FDE4138 & 0x6FDE4180)
  for (let i = 0; i < PATH_TYPE_STEP_NUMS_6FDE4138.length; i++) {
    m.setU32((0x6fde4138 + i * 4) >>> 0, PATH_TYPE_STEP_NUMS_6FDE4138[i]! >>> 0)
  }
  for (let i = 0; i < PATH_TYPE_FLAGS_6FDE4180.length; i++) {
    m.setU32((0x6fde4180 + i * 4) >>> 0, PATH_TYPE_FLAGS_6FDE4180[i]! >>> 0)
  }

  // Configure MonStats[1] (zombie1) and MonStats[19] (fallen1: bCrit=5, demon flag=0x08 at +0x0D)
  const pZombieTxt = (pMonStatsArr + 1 * 0x1a8) >>> 0
  m.setU16((pZombieTxt + 0x02) >>> 0, 1)
  m.setU16((pZombieTxt + 0x18) >>> 0, 1)
  m.setU8((pZombieTxt + 0x0d) >>> 0, 0x02) // lUndead
  m.setU8((pZombieTxt + 0xa6) >>> 0, 5) // bCrit = 5%

  const pFallenTxt = (pMonStatsArr + 19 * 0x1a8) >>> 0
  m.setU16((pFallenTxt + 0x02) >>> 0, 19)
  m.setU16((pFallenTxt + 0x18) >>> 0, 2)
  m.setU8((pFallenTxt + 0x0d) >>> 0, 0x08) // demon
  m.setU8((pFallenTxt + 0xa6) >>> 0, 5) // bCrit = 5%
  for (let idx = 0; idx < 10; idx++) {
    const pStats2 = (pMonStats2Arr + idx * 0x134) >>> 0
    m.setU8((pStats2 + 0x08) >>> 0, 1) // nSizeX = 1
    m.setU8((pStats2 + 0x09) >>> 0, 1) // nSizeY = 1
  }

  const pGame = m.alloc(D2GameStrc_SIZE)
  const pTimer = m.alloc(D2TimerStrc_SIZE)
  m.set(pGame, D2GameStrc.pTimer, pTimer)
  m.set(pGame, D2GameStrc.bExpansion, 1)
  m.set(pGame, D2GameStrc.nDifficulty, 0)
  m.set(pGame, D2GameStrc.seedLo, 3728736013)
  m.set(pGame, D2GameStrc.seedHi, 367307274)
  m.set(pGame, D2GameStrc.dwLastUnitId, 9, 4) // 9 starting items (#1..#9)
  EVENT_AllocChunk113c(m, pGame)

  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE + 0x100)

  function allocUnit(
    unitType: number,
    classId: number,
    unitId: number,
    mode: number,
    x: number,
    y: number,
    seedLo: number,
    seedHi: number,
  ): number {
    const pUnit = m.alloc(D2UnitStrc_SIZE)
    const pPath = m.alloc(D2DynamicPathStrc_SIZE)
    const pStatList = m.alloc(D2StatListExStrc_SIZE)
    m.set(pUnit, D2UnitStrc.dwUnitType, unitType)
    m.set(pUnit, D2UnitStrc.dwClassId, classId)
    m.set(pUnit, D2UnitStrc.dwUnitId, unitId)
    m.set(pUnit, D2UnitStrc.dwAnimMode, mode)
    m.set(pUnit, D2UnitStrc.pPath, pPath)
    m.set(pUnit, D2UnitStrc.pStatListEx, pStatList)
    m.set(pUnit, D2UnitStrc.pGame, pGame)
    m.set(pUnit, D2UnitStrc.seedLo, seedLo >>> 0)
    m.set(pUnit, D2UnitStrc.seedHi, seedHi >>> 0)
    m.set(pUnit, D2UnitStrc.dwFlags, 0x07)

    m.set(pPath, D2DynamicPathStrc.pUnit, pUnit)
    m.set(pPath, D2DynamicPathStrc.pRoom, pRoom)
    m.set(pPath, D2DynamicPathStrc.wPosX, x)
    m.set(pPath, D2DynamicPathStrc.wPosY, y)
    m.set(pPath, D2DynamicPathStrc.dwClientCoordX, x)
    m.set(pPath, D2DynamicPathStrc.dwClientCoordY, y)

    m.setU32(pStatList + 0x10, 0x80000000)

    // Link into pGame->pUnitHash
    const hashOff = D2GameStrc.pUnitHash.off + ((unitType & 7) << 9) + ((unitId & 0x7f) << 2)
    m.set(pUnit, D2UnitStrc.pGameHashNext, m.u32(pGame + hashOff))
    m.setU32(pGame + hashOff, pUnit)

    // Link into pRoom->pUnitFirst
    m.set(pUnit, D2UnitStrc.pRoomUnitNext, m.get(pRoom, D2ActiveRoomStrc.pUnitFirst))
    m.set(pRoom, D2ActiveRoomStrc.pUnitFirst, pUnit)

    if (unitType === UNIT_MONSTER) {
      const pMonData = m.alloc(D2MonsterDataStrc_SIZE)
      const pAiGen = m.alloc(D2AiGeneralStrc_SIZE)
      m.set(pUnit, D2UnitStrc.pUnitData, pMonData)
      m.set(pMonData, D2MonsterDataStrc.pAiGeneral, pAiGen)
      m.set(pAiGen, D2AiGeneralStrc.pfnThink, classId === 1 ? 0x6fca38b0 : 0x6fca3130)
      m.setU16((pMonData + 0x16) >>> 0, classId === 19 ? 0x08 : 0x02)
    }

    return pUnit
  }

  // Barbarian #1 (classId = 4, level 1, Hand Axe 3..6 dmg, STR 30, DEX 20, AR 115, Block 50%)
  const pBarb = allocUnit(UNIT_PLAYER, 4, 1, 1, 5131, 5074, 3081094168, 666)
  STATLIST_SetUnitStat113c(m, pBarb, 0, 30, 0) // STR
  STATLIST_SetUnitStat113c(m, pBarb, 2, 20, 0) // DEX
  STATLIST_SetUnitStat113c(m, pBarb, 6, 14080, 0) // HP
  STATLIST_SetUnitStat113c(m, pBarb, 7, 14080, 0) // MAXHP
  STATLIST_SetUnitStat113c(m, pBarb, 12, 1, 0) // LEVEL
  STATLIST_SetUnitStat113c(m, pBarb, 13, 0, 0) // EXPERIENCE
  STATLIST_SetUnitStat113c(m, pBarb, 19, 68, 0) // TOHIT
  STATLIST_SetUnitStat113c(m, pBarb, 20, 50, 0) // TOBLOCK (30 base + 20 Buckler)
  STATLIST_SetUnitStat113c(m, pBarb, 21, 3, 0) // MINDAMAGE (Hand Axe)
  STATLIST_SetUnitStat113c(m, pBarb, 22, 6, 0) // MAXDAMAGE (Hand Axe)
  STATLIST_SetUnitStat113c(m, pBarb, 31, 6, 0) // ARMORCLASS (Buckler)

  // Zombie #11 (classId = 1)
  const pZombie11 = allocUnit(UNIT_MONSTER, 1, 11, 1, 5148, 5089, 608688602, 854502910)
  STATLIST_SetUnitStat113c(m, pZombie11, 6, 1792, 0)
  STATLIST_SetUnitStat113c(m, pZombie11, 7, 1792, 0)
  STATLIST_SetUnitStat113c(m, pZombie11, 12, 1, 0)

  // Fallen Pack #12 (boss), #13, #14, #15 (classId = 19)
  const pFallen12 = allocUnit(UNIT_MONSTER, 19, 12, 1, 5132, 5075, 3392294783, 1774089117)
  const pFallen13 = allocUnit(UNIT_MONSTER, 19, 13, 1, 5133, 5075, 112301048, 184778716)
  const pFallen14 = allocUnit(UNIT_MONSTER, 19, 14, 1, 5133, 5076, 3834260402, 336064441)
  const pFallen15 = allocUnit(UNIT_MONSTER, 19, 15, 1, 5134, 5076, 3901264897, 182635720)

  STATLIST_SetUnitStat113c(m, pFallen12, 6, 768, 0)
  STATLIST_SetUnitStat113c(m, pFallen12, 7, 768, 0)
  STATLIST_SetUnitStat113c(m, pFallen12, 12, 1, 0)

  for (const u of [pFallen13, pFallen14, pFallen15]) {
    STATLIST_SetUnitStat113c(m, u, 6, 1024, 0)
    STATLIST_SetUnitStat113c(m, u, 7, 1024, 0)
    STATLIST_SetUnitStat113c(m, u, 12, 1, 0)
  }

  // Link #12 -> #13 -> #14 -> #15 as a boss pack via AIGENERAL_InitBossGroup113c + AIGENERAL_LinkMinionToLeader113c
  AIGENERAL_InitBossGroup113c(m, pFallen12, 1, pGame, 12, 1, 1)
  AIGENERAL_InitBossGroup113c(m, pFallen13, 1, pGame, 12, 1, 0)
  AIGENERAL_InitBossGroup113c(m, pFallen14, 1, pGame, 12, 1, 0)
  AIGENERAL_InitBossGroup113c(m, pFallen15, 1, pGame, 12, 1, 0)
  AIGENERAL_LinkMinionToLeader113c(m, pFallen12, pFallen14, pGame)
  AIGENERAL_LinkMinionToLeader113c(m, pFallen12, pFallen15, pGame)
  AIGENERAL_LinkMinionToLeader113c(m, pFallen12, pFallen13, pGame)

  return {
    m,
    pGame,
    pRoom,
    pBarb,
    pZombie11,
    pFallen12,
    pFallen13,
    pFallen14,
    pFallen15,
  }
}

describe('K1R14-LaneE2: a1c-bloodmoor-fallen Combat, Zombie/Fallen AI, Boss Promotion & Loot Drop (F226..F2000)', () => {
  it('verifies F801 Barbarian kill on Fallen #12, +18 XP, #13 boss promotion, room death ring, NoDrop TC, and F821 DD', () => {
    const { m, pGame, pRoom, pBarb, pFallen12, pFallen13, pFallen14, pFallen15 } =
      createA1cCombatFixture()

    m.set(pGame, D2GameStrc.dwGameFrame, 795)
    PLAYER_StartModeAttackWithTarget113c(m, pGame, pBarb, 7, pFallen12, '1HS')
    expect(m.get(pBarb, D2UnitStrc.dwAnimMode)).toBe(7)
    expect(m.get(pBarb, D2UnitStrc.wActionFrame)).toBe(1)

    // F801 action frame: Barbarian strikes Fallen #12
    m.set(pGame, D2GameStrc.dwGameFrame, 801)
    PLAYER_AdvanceSkillModeFrame113c(m, pGame, pBarb, pFallen12)

    // Verify Fallen #12 HP -> 0, mode -> 0 (DT), XP -> 18, and Barbarian seed after 4 steps
    expect(STATLIST_GetUnitStat113c(m, pFallen12, 6, 0)).toBe(0)
    expect(m.get(pFallen12, D2UnitStrc.dwAnimMode)).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pBarb, 13, 0)).toBe(18)
    expect([m.get(pBarb, D2UnitStrc.seedLo) >>> 0, m.get(pBarb, D2UnitStrc.seedHi) >>> 0]).toEqual([
      917021595, 1313538866,
    ])

    // Verify #13 promoted to boss (dwLeaderId = 13 on #13, #14, #15)
    for (const u of [pFallen13, pFallen14, pFallen15]) {
      const pAiGen = m.get(m.get(u, D2UnitStrc.pUnitData), D2MonsterDataStrc.pAiGeneral)
      expect(m.get(pAiGen, D2AiGeneralStrc.dwLeaderId)).toBe(13)
    }

    // Verify room death ring recorded (#12 death at (5132, 5075)) and morale counter incremented
    expect(m.get(pRoom, D2ActiveRoomStrc.bDeathRingIdx)).toBe(1)
    expect(m.u32(pRoom + 0xec)).toBe(1)

    // Verify #12 TreasureClass roll was NoDrop (1634144344 % 160 - 100 = -76 < 0) and gs stayed unchanged
    expect([
      m.get(pFallen12, D2UnitStrc.seedLo) >>> 0,
      m.get(pFallen12, D2UnitStrc.seedHi) >>> 0,
    ]).toEqual([1634144344, 1414900268])
    expect([m.get(pGame, D2GameStrc.seedLo) >>> 0, m.get(pGame, D2GameStrc.seedHi) >>> 0]).toEqual([
      3728736013, 367307274,
    ])

    // F802: Fallen #13 sees pRoom + 0xec > 0 and triggers morale flee (dwCmdType = 1)
    m.set(pGame, D2GameStrc.dwGameFrame, 802)
    AI_RunMonsterAI113c(m, pGame, pFallen13)
    const pAiGen13 = m.get(m.get(pFallen13, D2UnitStrc.pUnitData), D2MonsterDataStrc.pAiGeneral)
    const pCmd13 = m.get(pAiGen13, D2AiGeneralStrc.pCommandHead)
    expect(pCmd13).not.toBe(0)
    expect(m.get(pCmd13, D2AiCmdStrc.dwCmdType)).toBe(1)

    // F821 (20 frames after F801): MONSTER_EndDeath113c transitions #12 from mode 0 (DT) -> 12 (DD)
    m.set(pGame, D2GameStrc.dwGameFrame, 821)
    MONSTER_EndDeath113c(m, pGame, pFallen12)
    expect(m.get(pFallen12, D2UnitStrc.dwAnimMode)).toBe(12)
  })

  it('verifies F1040 Barbarian kill on Fallen #13, +18 XP -> 36, #14 boss promotion, TC gold drop (+2 gs steps), and F1060 DD', () => {
    const { m, pGame, pBarb, pFallen12, pFallen13, pFallen14, pFallen15 } = createA1cCombatFixture()

    // Fast-forward state to F1039 pre-hit (after #12 died at F801)
    m.set(pBarb, D2UnitStrc.seedLo, 2750377395)
    m.set(pBarb, D2UnitStrc.seedHi, 973854149)
    STATLIST_SetUnitStat113c(m, pBarb, 13, 18, 0)
    m.set(pFallen12, D2UnitStrc.dwAnimMode, 12)
    const pAiGen12 = m.get(m.get(pFallen12, D2UnitStrc.pUnitData), D2MonsterDataStrc.pAiGeneral)
    AIGENERAL_ReassignPackOnBossDeath113c(m, pAiGen12, pFallen12)

    m.set(pGame, D2GameStrc.dwGameFrame, 1040)
    PLAYER_AdvanceSkillModeFrame113c(m, pGame, pBarb, pFallen13)

    // Verify Fallen #13 HP -> 0, XP -> 36, Barbarian seed -> [832922946, 320401068]
    expect(STATLIST_GetUnitStat113c(m, pFallen13, 6, 0)).toBe(0)
    expect(m.get(pFallen13, D2UnitStrc.dwAnimMode)).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pBarb, 13, 0)).toBe(36)
    expect([m.get(pBarb, D2UnitStrc.seedLo) >>> 0, m.get(pBarb, D2UnitStrc.seedHi) >>> 0]).toEqual([
      832922946, 320401068,
    ])

    // Verify #14 promoted to boss (dwLeaderId = 14 on #14 and #15)
    for (const u of [pFallen14, pFallen15]) {
      const pAiGen = m.get(m.get(u, D2UnitStrc.pUnitData), D2MonsterDataStrc.pAiGeneral)
      expect(m.get(pAiGen, D2AiGeneralStrc.dwLeaderId)).toBe(14)
    }

    // Verify #13 TC roll (917888436 % 160 - 100 = 16 -> 'gld ') stepped #13 seed once and gs twice!
    expect([
      m.get(pFallen13, D2UnitStrc.seedLo) >>> 0,
      m.get(pFallen13, D2UnitStrc.seedHi) >>> 0,
    ]).toEqual([917888436, 46839910])
    expect([m.get(pGame, D2GameStrc.seedLo) >>> 0, m.get(pGame, D2GameStrc.seedHi) >>> 0]).toEqual([
      2900923968, 1362170134,
    ])
    expect(m.get(pGame, D2GameStrc.dwLastUnitId, 4)).toBe(10)

    // F1060: #13 transitions mode 0 -> 12 (DD)
    m.set(pGame, D2GameStrc.dwGameFrame, 1060)
    MONSTER_EndDeath113c(m, pGame, pFallen13)
    expect(m.get(pFallen13, D2UnitStrc.dwAnimMode)).toBe(12)
  })

  it('verifies F1206..F1323 Zombie #11 idle wander (AiZombie113c + AI_IdleWander113c)', () => {
    const { m, pGame, pZombie11 } = createA1cCombatFixture()

    m.set(pGame, D2GameStrc.dwGameFrame, 1206)
    // Pre-step Zombie #11 seed to F1206 wander roll state where AI_IdleWander113c rolls dx=+4, dy=+1
    m.set(pZombie11, D2UnitStrc.seedLo, 1264579264)
    m.set(pZombie11, D2UnitStrc.seedHi, 253879371)
    AI_IdleWander113c(m, pGame, pZombie11)
    expect([
      m.get(pZombie11, D2UnitStrc.seedLo) >>> 0,
      m.get(pZombie11, D2UnitStrc.seedHi) >>> 0,
    ]).toEqual([2783994832, 510929374])

    // Verify AiZombie113c dispatch with unengaged D2AiParamStrc
    const pAiParam = m.alloc(D2AiParamStrc_SIZE_113C)
    m.setU32(pAiParam + D2AiParamStrc113c.bEngaged, 0)
    AiZombie113c(m, pGame, pZombie11, pAiParam)
    expect(m.get(pZombie11, D2UnitStrc.dwAnimMode)).toBe(2)
  })

  it('verifies F1402 Barbarian kill on Fallen #14 (+18 XP -> 54, #15 promoted) and F1414..F1438 sole-survivor war cry S2', () => {
    const { m, pGame, pBarb, pFallen12, pFallen13, pFallen14, pFallen15 } = createA1cCombatFixture()

    m.set(pBarb, D2UnitStrc.seedLo, 3277680655)
    m.set(pBarb, D2UnitStrc.seedHi, 469941728)
    STATLIST_SetUnitStat113c(m, pBarb, 13, 36, 0)
    m.set(pGame, D2GameStrc.seedLo, 2900923968)
    m.set(pGame, D2GameStrc.seedHi, 1362170134)

    m.set(pFallen12, D2UnitStrc.dwAnimMode, 12)
    const pAiGen12 = m.get(m.get(pFallen12, D2UnitStrc.pUnitData), D2MonsterDataStrc.pAiGeneral)
    AIGENERAL_ReassignPackOnBossDeath113c(m, pAiGen12, pFallen12)
    m.set(pFallen13, D2UnitStrc.dwAnimMode, 12)
    const pAiGen13 = m.get(m.get(pFallen13, D2UnitStrc.pUnitData), D2MonsterDataStrc.pAiGeneral)
    AIGENERAL_ReassignPackOnBossDeath113c(m, pAiGen13, pFallen13)

    // F1402: Barbarian kills Fallen #14
    m.set(pGame, D2GameStrc.dwGameFrame, 1402)
    PLAYER_AdvanceSkillModeFrame113c(m, pGame, pBarb, pFallen14)

    expect(STATLIST_GetUnitStat113c(m, pFallen14, 6, 0)).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pBarb, 13, 0)).toBe(54)
    expect([m.get(pBarb, D2UnitStrc.seedLo) >>> 0, m.get(pBarb, D2UnitStrc.seedHi) >>> 0]).toEqual([
      139838046, 1218968970,
    ])

    // #15 promoted to sole-survivor boss (dwLeaderId = 15)
    const pAiGen15 = m.get(m.get(pFallen15, D2UnitStrc.pUnitData), D2MonsterDataStrc.pAiGeneral)
    expect(m.get(pAiGen15, D2AiGeneralStrc.dwLeaderId)).toBe(15)

    // #14 TC roll was NoDrop (714846131 % 160 - 100 = -49 < 0); gs stays at [2900923968, 1362170134]
    expect([
      m.get(pFallen14, D2UnitStrc.seedLo) >>> 0,
      m.get(pFallen14, D2UnitStrc.seedHi) >>> 0,
    ]).toEqual([714846131, 1599240755])
    expect([m.get(pGame, D2GameStrc.seedLo) >>> 0, m.get(pGame, D2GameStrc.seedHi) >>> 0]).toEqual([
      2900923968, 1362170134,
    ])

    // F1414: Sole-survivor Fallen #15 war cry S2 (mode 2 -> 9, 24 frames -> F1438)
    m.set(pGame, D2GameStrc.dwGameFrame, 1414)
    const pCmdArgs = m.alloc(0x1c)
    m.setU32(pCmdArgs + 0x08, 0x16)
    m.setU32(pCmdArgs + 0x0c, 1)
    AIGENERAL_BroadcastCmdToMinions113c(m, pFallen15, pGame, pCmdArgs)
    MONSTER_StartMode113c(m, pGame, pFallen15, 9, pBarb, 0, 0)
    expect(m.get(pFallen15, D2UnitStrc.dwAnimMode)).toBe(9)
    expect(m.get(pFallen15, D2UnitStrc.dwFrameCountPrecise)).toBe(18 << 8)
  })

  it('verifies F1542 block (mode=9), F1568 hit (-380 HP: 14080 -> 13700), F1603 block (mode=9), and F1681 kill on Fallen #15 (+18 XP -> 72)', () => {
    const { m, pGame, pBarb, pFallen15 } = createA1cCombatFixture()

    m.set(pGame, D2GameStrc.seedLo, 2900923968)
    m.set(pGame, D2GameStrc.seedHi, 1362170134)
    STATLIST_SetUnitStat113c(m, pBarb, 13, 54, 0)

    // 1. F1542: Fallen #15 melee swing blocked by Barbarian #1 (4076989647 % 100 = 47 < 50)
    m.set(pGame, D2GameStrc.dwGameFrame, 1542)
    m.set(pFallen15, D2UnitStrc.seedLo, 657912508)
    m.set(pFallen15, D2UnitStrc.seedHi, 883577789)
    m.set(pBarb, D2UnitStrc.seedLo, 583277079)
    m.set(pBarb, D2UnitStrc.seedHi, 799205660)

    SUNITDMG_ExecuteSingleHit113c(m, pGame, pFallen15, pBarb, 0, 128)
    expect(STATLIST_GetUnitStat113c(m, pBarb, 6, 0)).toBe(14080)
    expect(m.get(pBarb, D2UnitStrc.dwAnimMode)).toBe(9) // PLRMODE_BLOCK (BL)
    expect([m.get(pBarb, D2UnitStrc.seedLo) >>> 0, m.get(pBarb, D2UnitStrc.seedHi) >>> 0]).toEqual([
      4076989647, 243280418,
    ])
    // F1548: block animation ends -> mode 1
    m.set(pGame, D2GameStrc.dwGameFrame, 1548)
    PLAYER_EndAttackOrBlockAnim113c(m, pGame, pBarb)
    expect(m.get(pBarb, D2UnitStrc.dwAnimMode)).toBe(1)

    // 2. F1568: Fallen #15 melee swing lands 380 fixed-point damage (14080 -> 13700)
    m.set(pGame, D2GameStrc.dwGameFrame, 1568)
    m.set(pFallen15, D2UnitStrc.seedLo, 1243874271)
    m.set(pFallen15, D2UnitStrc.seedHi, 1062204343)

    SUNITDMG_ExecuteSingleHit113c(m, pGame, pFallen15, pBarb, 0, 128)
    expect(STATLIST_GetUnitStat113c(m, pBarb, 6, 0)).toBe(13700)
    expect([m.get(pBarb, D2UnitStrc.seedLo) >>> 0, m.get(pBarb, D2UnitStrc.seedHi) >>> 0]).toEqual([
      1068947080, 187772234,
    ])

    // 3. F1603: Fallen #15 melee swing blocked by Barbarian #1 (683721714 % 100 = 14 < 50)
    m.set(pGame, D2GameStrc.dwGameFrame, 1603)
    m.set(pFallen15, D2UnitStrc.seedLo, 3217215936)
    m.set(pFallen15, D2UnitStrc.seedHi, 166877114)

    SUNITDMG_ExecuteSingleHit113c(m, pGame, pFallen15, pBarb, 0, 128)
    expect(STATLIST_GetUnitStat113c(m, pBarb, 6, 0)).toBe(13700)
    expect(m.get(pBarb, D2UnitStrc.dwAnimMode)).toBe(9)
    expect([m.get(pBarb, D2UnitStrc.seedLo) >>> 0, m.get(pBarb, D2UnitStrc.seedHi) >>> 0]).toEqual([
      683721714, 445849670,
    ])
    m.set(pGame, D2GameStrc.dwGameFrame, 1609)
    PLAYER_EndAttackOrBlockAnim113c(m, pGame, pBarb)
    expect(m.get(pBarb, D2UnitStrc.dwAnimMode)).toBe(1)

    // 4. F1681: Barbarian #1 kills Fallen #15 (dmg = 1524, XP 54 -> 72, NoDrop TC)
    m.set(pGame, D2GameStrc.dwGameFrame, 1681)
    m.set(pBarb, D2UnitStrc.seedLo, 4235157999)
    m.set(pBarb, D2UnitStrc.seedHi, 513581972)
    m.set(pFallen15, D2UnitStrc.seedLo, 3901264897)
    m.set(pFallen15, D2UnitStrc.seedHi, 182635720)

    PLAYER_AdvanceSkillModeFrame113c(m, pGame, pBarb, pFallen15)
    expect(STATLIST_GetUnitStat113c(m, pFallen15, 6, 0)).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pBarb, 13, 0)).toBe(72)
    expect([m.get(pBarb, D2UnitStrc.seedLo) >>> 0, m.get(pBarb, D2UnitStrc.seedHi) >>> 0]).toEqual([
      2105748114, 1635108393,
    ])
    expect([
      m.get(pFallen15, D2UnitStrc.seedLo) >>> 0,
      m.get(pFallen15, D2UnitStrc.seedHi) >>> 0,
    ]).toEqual([2986557837, 1627187818])
    expect([m.get(pGame, D2GameStrc.seedLo) >>> 0, m.get(pGame, D2GameStrc.seedHi) >>> 0]).toEqual([
      2900923968, 1362170134,
    ])

    // F1701: #15 transitions mode 0 -> 12 (DD)
    m.set(pGame, D2GameStrc.dwGameFrame, 1701)
    MONSTER_EndDeath113c(m, pGame, pFallen15)
    expect(m.get(pFallen15, D2UnitStrc.dwAnimMode)).toBe(12)
  })

  it('exercises all 92 bound D2Game combat/AI/loot VAs in combat-a1c-113c.ts on Memory113c', () => {
    const { m, pGame, pRoom, pBarb, pZombie11, pFallen12 } = createA1cCombatFixture()

    expect(ITEMS_GetDropItemLevel113c(m, pGame, pFallen12, 0)).toBe(1)
    const pRatioRow = m.alloc(0x34)
    m.setU32(pRatioRow + 0x04, 10)
    m.setU32(pRatioRow + 0x08, 64)
    expect(ITEMS_GetQualityBonusDivisor113c(m, 7, pRatioRow)).toBe(10)
    expect(ITEMS_GetQualityMinValue113c(m, 7, pRatioRow)).toBe(64)
    expect(ITEMS_EvalTreasureClassFactor113c(m, 7, pRatioRow)).toBe(0)
    expect(
      ITEMS_RollQualityThreshold113c(
        m,
        pFallen12 + D2UnitStrc.seedLo.off,
        400,
        10,
        64,
        0,
        0,
        0,
      ),
    ).toBeGreaterThanOrEqual(0)

    const pGold = ITEMS_DropGoldPileAtUnit113c(m, pGame, pFallen12, 256, true)
    expect(pGold).toBeGreaterThan(0)
    ITEMS_ApplySocketAndEtherealBonuses113c(m, pGame, pGold, 0)
    ITEMS_InitScrollOrTomeStats113c(m, pGold, 1)
    ITEMS_ExpireGroundItemsInAct113c(m, pGame, 0)
    expect(ITEMS_RollItemQuality113c(m, pGame, pFallen12, pFallen12 + D2UnitStrc.seedLo.off, 523, 1)).toBe(2)
    expect(ITEMS_RollEarOrClassItem113c(m, pGame, pGold)).toBe(1)
    expect(ITEMS_PickUniqueItem113c(m, pGame, pGold)).toBe(0)
    expect(ITEMS_CheckSetItemEligibility113c(m, pGame, 523, 1)).toBe(0)
    expect(ITEMS_GenerateMagicOrRareAffixes113c(m, pGame, pGold)).toBe(1)
    expect(ITEMS_InitCreatedItemStats113c(m, pGame, pGold, 1)).toBe(1)
    expect(ITEMS_FinalizeCreatedItem113c(m, pGame, pGold)).toBe(1)
    expect(ITEMS_SpawnDroppedItemAtCoords113c(m, pGame, pRoom, pGold, 5132, 5075)).toBe(pGold)
    expect(OBJECTS_FindFreeDropCoordsAndSpawnItem113c(m, pGame, pFallen12, pGold)).toBe(pGold)

    STATLIST_SetUnitStat113c(m, pGold, 72, 10, 0)
    STATLIST_SetUnitStat113c(m, pGold, 73, 10, 0)
    expect(ITEMS_ApplyItemDurabilityLoss113c(m, pGame, pBarb, pGold, 0)).toBeGreaterThanOrEqual(0)

    expect(ITEMS_ChooseTreasureClassItem113c(m, pGame, pFallen12, pBarb, -1, false)).toBeGreaterThanOrEqual(0)
    expect(ITEMS_DropMonsterTreasure113c(m, pGame, pFallen12, pBarb, false)).toBeGreaterThanOrEqual(0)
    expect(MONSTER_DropTreasureOnDeath113c(m, pGame, pFallen12, pBarb, false)).toBeGreaterThanOrEqual(0)
    expect(MONSTER_DropDeathItems113c(m, pGame, pFallen12, pBarb, false)).toBeGreaterThanOrEqual(0)
    expect(ITEMS_CreateItem113c(m, pGame, 523, 1, 2, false)).toBeGreaterThan(0)

    AIGENERAL_ExpireMinionListsInAct113c(m, pGame, 0)
    expect(AIGENERAL_CopyAiCommandParams113c(m, pFallen12, 1, 2, 0, 0, 0)).toBeGreaterThan(0)
    expect(MONSTER_CheckSandLeaperMidAir113c(m, pFallen12)).toBe(0)
    MONSTER_BroadcastEventSoundToClients113c(m, pFallen12, 5)
    SUNIT_SetUnitEventSound113c(m, pFallen12, 5, 0)

    const scanState = { pBestUnit: 0, bestDist: 999 }
    expect(AI_FindTargetScanRoomCallback113c(m, pFallen12, pBarb, 35, scanState)).toBe(1)
    expect(AI_FindNearestPlayerOrAlly113c(m, pGame, pFallen12).pTarget).toBe(pBarb)
    AI_GeneralFindTargetOrThrottle113c(m, pGame, pZombie11, 0)
    AI_DispatchTargetByAiFlag113c(m, pGame, pZombie11)
    AI_Stall113c(m, pGame, pZombie11, 10)
    AI_FleeFrom113c(m, pGame, pFallen12, pBarb, 10, 0)

    PLAYER_ScheduleAttackActionFrameEvents113c(m, pGame, pBarb, 6, 15)
    PLAYER_ScheduleSkillActionFrameEvents113c(m, pGame, pBarb, 5, 10)
    expect(PLAYER_StartModeAttack113c(m, pGame, pBarb, 7, pFallen12, '1HS')).toBe(1)
    expect(PLAYER_StartModeCast113c(m, pGame, pBarb, pFallen12, '1HS')).toBe(1)
    expect(PLAYER_StartModeSkill113c(m, pGame, pBarb, 11, pFallen12, '1HS')).toBe(1)
    expect(PLAYER_StartModeDispatch113c(m, pGame, pBarb, 9, 0, '1HS')).toBe(1)
    expect(PLAYER_StartBlockMode113c(m, pGame, pBarb, '1HS')).toBe(1)

    const pDmg = m.alloc(D2DamageStrc_SIZE)
    expect(SUNITDMG_GetPlayerClientClassId113c(m, pBarb)).toBe(4)
    expect(SUNITDMG_ResolveAttackerPlayer113c(m, pGame, pBarb)).toBe(pBarb)
    expect(SUNITDMG_CheckToHit113c(m, pBarb, pZombie11, pDmg, 0)).toBeGreaterThanOrEqual(0)
    expect(SUNITDMG_RollDamageValue113c(m, pBarb, 256, 512, 90, 0, 0)).toBeGreaterThanOrEqual(256)
    expect(SUNITDMG_CheckMonTypeFlag113c(m, pFallen12, 0x08)).toBe(1)
    expect(SUNITDMG_AddDemonDamageBonus113c(m, pBarb, pFallen12)).toBe(0)
    expect(SUNITDMG_AddMonsterTypeDamageBonus113c(m, pBarb, pFallen12)).toBe(0)
    expect(SUNITDMG_GetTotalSkillDamageBonus113c(m, pBarb, 10)).toBe(10)
    expect(SUNITDMG_ComputeWeaponBaseDamage113c(m, pBarb, pZombie11, pDmg)).toBeGreaterThan(0)
    SUNITDMG_RollElementalStatDamage113c(m, pBarb, pDmg)
    SUNITDMG_ApplyArmorPenetrationAndFlatBonus113c(m, pBarb, pZombie11, pDmg, 128)
    SUNITDMG_ClampManaBurnByMonsterSkill113c(m, pBarb, pDmg)
    expect(SUNITDMG_GetPvpOrPetDamageMultiplier113c(m, pBarb, pZombie11)).toBe(100)
    expect(SUNITDMG_GetEffectiveResistance113c(m, pZombie11, 36)).toBe(0)
    expect(SUNITDMG_ApplySingleChannelResistance113c(m, pZombie11, 512, 36)).toBe(512)
    expect(SUNITDMG_ApplyElementalAbsorb113c(m, pZombie11, 512, 142, 143, pDmg)).toBe(512)
    expect(SUNITDMG_GetColdEffectLengthBonus113c(m, pBarb, pZombie11)).toBe(0)
    expect(SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c(m, pZombie11)).toBe(0)
    expect(SUNITDMG_RollDodgeAvoidEvadeBlock113c(m, pBarb, pZombie11, pDmg)).toBe(0)
    expect(SUNITDMG_ApplyResistancesAndAbsorb113c(m, pBarb, pZombie11, pDmg)).toBeGreaterThan(0)

    const pCombat = SUNITDMG_AllocCombat113c(m, pGame, pBarb, pZombie11, pDmg, 128)
    expect(pCombat).toBeGreaterThan(0)
    expect(SUNITDMG_FindCombatDamageData113c(m, pBarb, pZombie11)).toBe(pCombat + D2CombatStrc113c.tDamage)
    expect(SUNITDMG_GetAttackerDamageData113c(m, pBarb, pZombie11)).toBe(pCombat + D2CombatStrc113c.tDamage)
    SUNITDMG_PrependCombatNode113c(m, pBarb, pCombat)
    expect(SUNITDMG_RemoveCombatNode113c(m, pBarb, pZombie11)).toBe(1)

    SUNITDMG_AddLeechedLifeToUnit113c(m, pBarb, 6, 7, 256)
    SUNITDMG_ApplyLifeManaSteal113c(m, pBarb, pZombie11, pDmg)
    SUNITDMG_ApplyColdChilledEffect113c(m, pGame, pBarb, pZombie11, 25)
    SUNITDMG_ApplyFreezeEffect113c(m, pGame, pBarb, pZombie11, 25)
    SUNITDMG_ApplyColdOrFreezeState113c(m, pGame, pBarb, pZombie11, pDmg)
    SUNITDMG_ApplyPoisonEffect113c(m, pGame, pBarb, pZombie11, 256, 25)
    SUNITDMG_ApplyStunEffect113c(m, pGame, pBarb, pZombie11, 25)
    SUNITDMG_TriggerAttackerBlindOrFlee113c(m, pGame, pBarb, pZombie11, pDmg)
    SUNITDMG_SelectDeathOverlayFlag113c(m, pZombie11, pDmg)
    SUNITDMG_ApplyAttackerThornsToSelf113c(m, pGame, pBarb, pZombie11)
    SUNITDMG_ConsumeStaminaCost113c(m, pBarb, 0)
    SUNITDMG_ConsumeManaCost113c(m, pBarb, 0)
    SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c(m, pGame, pBarb, pZombie11, 0)
    SUNITDMG_TriggerGetHitStateAndMode113c(m, pGame, pZombie11, pDmg)
    SUNITDMG_ApplyArmorDurabilityAndGetHit113c(m, pGame, pZombie11, pBarb, pDmg)
    SUNITDMG_TriggerBlockEvents113c(m, pGame, pBarb)
    expect(SUNITDMG_ApplySideEffectsAndKill113c(m, pGame, pBarb, pZombie11, pDmg)).toBeGreaterThanOrEqual(0)
    m.set(pDmg, D2DamageStrc.wResultFlags, 1)
    expect(SUNITDMG_ApplyDamage113c(m, pGame, pBarb, pZombie11, pDmg)).toBeGreaterThanOrEqual(0)
    expect(SUNITDMG_CalcMonsterExperience113c(m, pGame, pFallen12).exp).toBe(18)
    expect(SUNITDMG_ComputeExperienceGain113c(m, pGame, pBarb, 1, 18)).toBe(18)
    expect(SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c(m, pGame, pBarb, 18)).toBeGreaterThan(0)
    expect(SUNITDMG_DistributeExperience113c(m, pGame, pBarb, pFallen12)).toBe(18)
    SUNITDMG_TriggerPostCombatEvents113c(m, pGame, pBarb, pZombie11, pDmg)
    expect(SUNITDMG_ExecuteEvents113c(m, pGame, pBarb, pZombie11, 1, pDmg)).toBe(1)
    expect(MONSTER_ExecuteEventsWrapper113c(m, pGame, pBarb, pZombie11, pDmg)).toBe(1)
    expect(MONSTER_SetDeathPathAndAnim113c(m, pGame, pZombie11, pBarb)).toBe(1)
    expect(MONSTER_StartDeath113c(m, pGame, pZombie11, pBarb, false)).toBe(1)

    const pModeArgs = m.alloc(0x24)
    MONSTER_InitModeChangeStrc113c(m, pFallen12, pModeArgs, 4)
    expect(MONSTER_StartAttackOrCast113c(m, pGame, pModeArgs)).toBe(1)
    expect(
      AI_StartAttackMode113c(m, 4, pFallen12, pGame, pBarb, undefined, {
        onMonsterStartMode: (mem, g, sp) =>
          MONSTER_StartMode113c(
            mem,
            g,
            mem.u32((sp + 4) >>> 0),
            mem.u32(sp),
            mem.u32((sp + 8) >>> 0),
            0,
            0,
          ),
      }),
    ).toBe(1)
    expect(MONSTER_AdvanceAttackOrSkillStep113c(m, pGame, pFallen12)).toBe(1)
    MONSTER_ExecuteMeleeSwing113c(m, pFallen12, pGame)
    MONSTER_ApplyCritDamage113c(m, pFallen12, pDmg, pBarb)
    expect(SEED_RollLimitedRandomNumber113c(m, pFallen12 + D2UnitStrc.seedLo.off, 100)).toBeGreaterThanOrEqual(0)
    expect(SUNITDMG_FillDamageValues113c(m, pGame, pBarb, pFallen12, pDmg, 0, 128)).toBeGreaterThanOrEqual(0)
  })
})
