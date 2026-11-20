import { describe, expect, it } from 'vitest'
import { INVENTORY_SIGNATURE_113C } from '../../../src/d2kern-113c/common/inventory.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import * as w6b5Exports from '../../../src/d2kern-113c/game/k2-w6b5-113c.ts'
import {
  ACT2Q1_OnAtmaTalkCallback_6FCE61C0_113c,
  ACT2Q1_TimerSendQuest9Alert_6FCE6010_113c,
  ACT2Q2_OperateHoradricCubeChest_6FCEA050_113c,
  ACT2Q2_OperateHoradricScrollChest_6FCEA290_113c,
  ACT2Q2_OperateStaffOfKingsChest_6FCEA170_113c,
  ACT2Q3_EndTaintedSunEclipse_6FCE5E90_113c,
  ACT2Q3_TimerSendQuest11Alert_6FCE5E30_113c,
  ACT2Q4_OnDrognanTalkCallback_6FCE5DB0_113c,
  ACT2Q4_OpenArcanePortalAndSyncQuest_6FCE5D10_113c,
  ACT2Q5_TimerSummonerTauntAndAlert_6FCE5BE0_113c,
  ACT2Q6_OnTyraelOrJerhynTalkCallback_6FCE5A60_113c,
  ACT2Q6_TimerSendQuest14Alert_6FCE58B0_113c,
  ACT4Q1_OnPlainsOfDespairEntered_6FCDA080_113c,
  ACT4Q1_OnTyraelTalkCallback_6FCDA100_113c,
  ACT4Q1_TimerSpawnIzualSpirit_6FCDA960_113c,
  ACT4Q2_InitHellforgeObject_6FCD9E80_113c,
  ACT4Q2_OnQuestTarget0F6Callback_6FCD9DE0_113c,
  ACT4Q3_KillAllChaosSanctuaryMonsters_6FCDB3B0_113c,
  ACT4Q3_OnTyraelTalkOpenHarrogathPortal_6FCDB1B0_113c,
  AIBAAL_ExecuteCommandAction_6FCD8070_113c,
  AITARGET_FindBestHostileTargetTether75_6FCD7090_113c,
  AITARGET_FindBestHostileTarget_6FCC4610_113c,
  C2S_HandlePacket5D_PartyRelationAction_6FCEC860_113c,
  C2S_HandlePacket5E_PartyRelationToggle_6FCEC8E0_113c,
  C2S_ValidateItemInteractionByAnimMode_6FCED6D0_113c,
  C2S_ValidatePacket5ByteItem_6FCED4F0_113c,
  ITEMEVENT_ReanimateCorpseAsReturned_6FCCE200_113c,
  ITEMEVENT_TriggerChanceToCastSkill_6FCCDBF0_113c,
  ITEMEVENT_TriggerMeleeChanceToCastSkill_6FCCDDC0_113c,
  ITEMS_SpellCastFireballAtCoords_6FCCDEE0_113c,
  ITEMS_SpellCastFireballAtTargetOrPath_6FCCDF20_113c,
  ITEMS_SpellIdentifyInventoryItem_6FCCDAC0_113c,
  MONREG_InitAllActMonsterRegions_6FCEAB30_113c,
  NPCS_CainIdentifyAllItems_6FCDDB10_113c,
  NPCS_IdentifyPendingItemForPlayer_6FCDDA90_113c,
  PARTY_ProcessPendingJoinRelationQueue_6FCBC6F0_113c,
  PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c,
  QUEST0D_InitTemplePortalObject_6FCE9ED0_113c,
  SKILLS_RespecPlayerClassSkills_6FCC1280_113c,
  SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0_113c,
  SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c,
  SKILLS_SrvDo_ExecuteMultiStrikeMelee_6FCB9D20_113c,
  SKILLS_SrvDo_FireChargedChannelMissile_6FCB5560_113c,
  SKILLS_SrvDo_SpawnChargedGuidedNova_6FCB4F50_113c,
  SKILLS_SrvDo_SpawnChargedSpiralNova_6FCB4E60_113c,
} from '../../../src/d2kern-113c/game/k2-w6b5-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  D2ItemsTxt_SIZE,
  D2LevelsTxt_SIZE,
  D2MonStatsTxt_SIZE,
  D2ObjectsTxt_SIZE,
  D2SkillsTxt_SIZE,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

interface Harness {
  m: SparseMemory113c
  pDataTables: number
  pGame: number
  pQuestControl: number
  pArena: number
  pLevelsTxt: number
  pSkillsTxt: number
  pItemsTxt: number
  pMonStatsTxt: number
  pObjectsTxt: number
}

function createHarness(nLevels = 8): Harness {
  const m = new SparseMemory113c()
  m.fill(0x6fd10000, 0x30000, 0)
  m.fill(0x6fdd6000, 0x20000, 0)
  m.fill(0x7e430000, 0x20000, 0)
  m.fill(0x7e630000, 0x20000, 0)
  m.fill(0x7ef80000, 0x20000, 0)

  const pDataTables = m.alloc(0x2000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)

  const pBitMasks = m.alloc(128)
  for (let i = 0; i < 32; i++) m.setU32(pBitMasks + i * 4, (1 << i) >>> 0)
  m.setU32(0x6fdd90b0, pBitMasks)

  const pLevelsTxt = m.alloc(nLevels * D2LevelsTxt_SIZE)
  for (let lvl = 0; lvl < nLevels; lvl++) {
    const row = pLevelsTxt + lvl * D2LevelsTxt_SIZE
    m.setU16(row + 0x00, lvl)
    m.setU8(row + 0x03, 0)
    m.setU16(row + 0x10, 5 + lvl)
    m.setU16(row + 0x16, 10 + lvl)
    m.setU32(row + 0x1c, 1000)
    m.setU8(row + 0x28, 1)
    m.setU8(row + 0x2b, 3)
  }
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, nLevels)
  m.setU32(0x6fdf0b38, m.alloc(nLevels * 0x9c))
  const actBounds = [1, 40, 75, 103, 109, 137]
  for (let i = 0; i < actBounds.length; i++) {
    m.setU32(pDataTables + 0xc60 + i * 4, actBounds[i]!)
  }

  const pMonLvl = m.alloc(10 * 0x90)
  m.setU32(pDataTables + 0xac4, pMonLvl)
  m.setU32(pDataTables + 0xac8, 10)

  const pMonStatsTxt = m.alloc(32 * D2MonStatsTxt_SIZE)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, 32)

  const pSkillsTxt = m.alloc(64 * D2SkillsTxt_SIZE)
  for (let i = 0; i < 64; i++) {
    m.setU16(pSkillsTxt + i * D2SkillsTxt_SIZE, i)
  }
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 64)
  m.setU32(pDataTables + 0xba4, m.alloc(7 * 4))

  const pItemsTxt = m.alloc(16 * D2ItemsTxt_SIZE)
  m.setU32(0x6fdefb94, 16)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32(pDataTables + 0xc28, 16)
  m.setU32(pDataTables + 0xc2c, pItemsTxt)

  const pObjectsTxt = m.alloc(128 * D2ObjectsTxt_SIZE)
  m.setU32(pDataTables + 0xc48, 128)
  m.setU32(pDataTables + 0xc4c, pObjectsTxt)

  const pIsc = m.alloc(360 * 0x144)
  m.setU32(pDataTables + 0xbcc, pIsc)
  m.setU32(pDataTables + 0xbd4, 360)

  const pGame = m.alloc(0x1df4)
  EVENT_InitTimerQueue113c(m, pGame)
  m.setU32(pGame + 0x1c, 0x12345678)
  m.setU32(pGame + 0x20, 0x0000029a)
  m.setU32(pGame + 0xa8, 100)
  const pQuestControl = m.alloc(0x40)
  m.setU32(pQuestControl + 0x0c, QUESTRECORD_AllocRecord113c(m, 0))
  m.setU32(pQuestControl + 0x18, 0x11112222)
  m.setU32(pQuestControl + 0x1c, 0x0000029a)
  m.setU32(pGame + 0x10f4, pQuestControl)

  const pArena = m.alloc(0x20)
  m.setU32(pGame + 0x1d28, pArena)
  for (let a = 0; a < 5; a++) {
    const pAct = m.alloc(0x60)
    const pActMisc = m.alloc(0x500)
    const pLvl = m.alloc(0x200)
    const pRx = m.alloc(0x80)
    m.setU32(pRx + 0x28, 0x3100000)
    m.setU32(pLvl + 0x08, 1)
    m.setU32(pLvl + 0x10, pRx)
    m.setU32(pLvl + 0x1d0, 1)
    m.setU32(pActMisc + 0x47c, pLvl)
    m.setU32(pAct + 0x04, pGame)
    m.setU32(pAct + 0x48, pActMisc)
    m.setU32(pGame + 0xbc + a * 4, pAct)
  }

  return {
    m,
    pDataTables,
    pGame,
    pQuestControl,
    pArena,
    pLevelsTxt,
    pSkillsTxt,
    pItemsTxt,
    pMonStatsTxt,
    pObjectsTxt,
  }
}

function createDynamicUnit(
  m: SparseMemory113c,
  pGame: number,
  unitType: number,
  classId: number,
  guid: number,
  x: number,
  y: number,
  pRoom = 0,
): number {
  const pUnit = m.alloc(0xf4)
  m.setU32(pUnit + 0x00, unitType)
  m.setU32(pUnit + 0x04, classId)
  m.setU32(pUnit + 0x0c, guid)
  m.setU32(pUnit + 0x10, 1)
  m.setU32(pUnit + 0x20, 0x12345678)
  m.setU32(pUnit + 0x24, 0x0000029a)
  m.setU32(pUnit + 0x80, pGame)
  const pPath = m.alloc(0x40)
  m.setU16(pPath + 0x02, x)
  m.setU16(pPath + 0x06, y)
  m.setU32(pPath + 0x1c, pRoom)
  m.setU32(pUnit + 0x2c, pPath)
  const pStatList = STATLIST_CreateEx113c(m, pUnit, 0, 0)
  m.setU32(pUnit + 0x5c, pStatList)
  m.setU32(pUnit + 0xa8, m.alloc(0x20))
  if (unitType === 0) {
    const pPlayerData = m.alloc(0xc0)
    const pClient = m.alloc(0x400)
    m.setU32(pPlayerData + 0x9c, pClient)
    m.setU32(pUnit + 0x14, pPlayerData)
  }
  return pUnit
}

function createStaticUnit(
  m: SparseMemory113c,
  pGame: number,
  unitType: number,
  classId: number,
  guid: number,
  x: number,
  y: number,
  pRoom = 0,
): number {
  const pUnit = m.alloc(0xf4)
  m.setU32(pUnit + 0x00, unitType)
  m.setU32(pUnit + 0x04, classId)
  m.setU32(pUnit + 0x0c, guid)
  m.setU32(pUnit + 0x80, pGame)
  const pPath = m.alloc(0x20)
  m.setU32(pPath + 0x00, pRoom)
  m.setU32(pPath + 0x0c, x)
  m.setU32(pPath + 0x10, y)
  m.setU32(pUnit + 0x2c, pPath)
  return pUnit
}

function createRoomWithAct(m: SparseMemory113c, pGame: number, nLevelId: number): number {
  const pAct = m.alloc(0x60)
  m.setU32(pAct + 0x04, pGame)
  const pRoom = m.alloc(0x80)
  const pRoomEx = m.alloc(0x80)
  const pLevel = m.alloc(0x200)
  m.setU32(pLevel + 0x1d0, nLevelId)
  m.setU32(pRoomEx + 0x58, pLevel)
  m.setU32(pRoom + 0x10, pRoomEx)
  m.setU32(pRoom + 0x5c, pAct)
  return pRoom
}

describe('K2 Wave 6 Batch 5 (w6b5): 45 D2Game.dll functions on SparseMemory113c', () => {
  it('exports exactly 45 functions', () => {
    const fnNames = Object.keys(w6b5Exports).filter(
      (k) => typeof (w6b5Exports as Record<string, unknown>)[k] === 'function',
    )
    expect(fnNames.length).toBe(45)
  })

  it('[1..5] Skills kick/nova/channel/multistrike handlers execute 1:1', () => {
    const { m, pGame, pSkillsTxt } = createHarness()
    const pRoom = createRoomWithAct(m, pGame, 1)
    const pAttacker = createDynamicUnit(m, pGame, 1, 1, 10, 100, 100, pRoom)
    const pDefender = createDynamicUnit(m, pGame, 0, 0, 20, 200, 200, pRoom)
    const pSkillList = m.alloc(0x20)
    const pSkill = m.alloc(0x40)
    m.setU32(pSkill + 0x00, pSkillsTxt + 5 * D2SkillsTxt_SIZE)
    m.setU32(pSkillList + 0x00, pSkill)
    m.setU32(pSkillList + 0x0c, pSkill)
    m.setU32(pAttacker + 0xa8, pSkillList)

    expect(
      SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0_113c(
        m,
        5,
        pGame,
        0,
        pDefender,
        pSkillsTxt,
        1,
        0,
      ),
    ).toBe(0)

    expect(SKILLS_SrvDo_SpawnChargedSpiralNova_6FCB4E60_113c(m, pGame, pAttacker, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo_SpawnChargedGuidedNova_6FCB4F50_113c(m, pGame, pAttacker, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo_FireChargedChannelMissile_6FCB5560_113c(m, pGame, pAttacker, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo_ExecuteMultiStrikeMelee_6FCB9D20_113c(m, pGame, pAttacker, 5, 1)).toBe(0)
  })

  it('[6..10] Party join queue, respec, portal link, slow anim events, and AI target finders', () => {
    const { m, pGame } = createHarness()
    const pPlayer = createDynamicUnit(m, pGame, 0, 0, 1, 50, 50)
    m.setU32(pGame + 0x1120 + ((1 & 0x7f) << 2), pPlayer)
    const pJoinQueue = m.alloc(0x10)
    const pNode = m.alloc(0x10)
    m.setU32(pNode + 0x00, 1)
    m.setU32(pJoinQueue + 0x04, pNode)
    PARTY_ProcessPendingJoinRelationQueue_6FCBC6F0_113c(m, pGame, pJoinQueue)
    expect(m.u32(pJoinQueue + 0x04)).toBe(pNode)

    SKILLS_RespecPlayerClassSkills_6FCC1280_113c(m, 0, pGame)
    SKILLS_RespecPlayerClassSkills_6FCC1280_113c(m, pPlayer, pGame)

    const pRoom = createRoomWithAct(m, pGame, 1)
    const pPortal = createStaticUnit(m, pGame, 2, 0x3b, 50, 100, 100, pRoom)
    m.fill(0, 0x100, 0)
    m.setU32(0x34, 3)
    expect(() =>
      PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c(m, pGame, pPortal, 1, 1),
    ).toThrow()
    m.fill(0, 0x100, 0)

    expect(() =>
      SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c(m, 0, 50),
    ).toThrow()
    SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c(m, pPlayer, 0)
    SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c(m, pPlayer, 50)

    const pBestScore = m.alloc(4)
    const pCandCount = m.alloc(4)
    const pTether = m.alloc(16)
    expect(() =>
      AITARGET_FindBestHostileTarget_6FCC4610_113c(
        m,
        pGame,
        pPlayer,
        pBestScore,
        pCandCount,
        pTether,
        0,
      ),
    ).toThrow()
    expect(
      AITARGET_FindBestHostileTarget_6FCC4610_113c(
        m,
        pGame,
        pPlayer,
        pBestScore,
        pCandCount,
        pTether,
        0x6fcc44f0,
      ),
    ).toBe(0)
    expect(() =>
      AITARGET_FindBestHostileTargetTether75_6FCD7090_113c(
        m,
        pGame,
        pPlayer,
        pBestScore,
        pCandCount,
        pTether,
        0,
      ),
    ).toThrow()
    expect(
      AITARGET_FindBestHostileTargetTether75_6FCD7090_113c(
        m,
        pGame,
        pPlayer,
        pBestScore,
        pCandCount,
        pTether,
        0x6fcc44f0,
      ),
    ).toBe(0)
  })

  it('[11..16] Item spell identify, chance-to-cast, fireball, and reanimate corpse', () => {
    const { m, pGame } = createHarness()
    const pPlayer = createDynamicUnit(m, pGame, 0, 0, 1, 50, 50)
    const pItem = createStaticUnit(m, pGame, 4, 1, 10, 50, 50)
    const pItemData = m.alloc(0x80)
    m.setU32(pItemData + 0x00, 4) // rare quality
    m.setU32(pItemData + 0x18, 0) // unidentified ( lacks 0x10 )
    m.setU32(pItem + 0x14, pItemData)
    const pInv = m.alloc(0x40)
    m.setU32(pInv + 0x00, INVENTORY_SIGNATURE_113C)
    m.setU32(pInv + 0x0c, pItem)
    m.setU32(pPlayer + 0x60, pInv)

    expect(ITEMS_SpellIdentifyInventoryItem_6FCCDAC0_113c(m, pGame, pPlayer, 0, 0)).toBe(0)
    expect(ITEMS_SpellIdentifyInventoryItem_6FCCDAC0_113c(m, pGame, pPlayer, 0, pItem)).toBe(1)

    expect(ITEMEVENT_TriggerChanceToCastSkill_6FCCDBF0_113c(m, 0, pPlayer, 0, 0)).toBe(0)
    expect(ITEMEVENT_TriggerMeleeChanceToCastSkill_6FCCDDC0_113c(m, pPlayer, pPlayer, 0, 0)).toBe(0)

    ITEMS_SpellCastFireballAtCoords_6FCCDEE0_113c(m, pGame, pPlayer, pItem, 0, 0, 0)
    ITEMS_SpellCastFireballAtTargetOrPath_6FCCDF20_113c(m, pGame, pPlayer, 0)
    ITEMEVENT_ReanimateCorpseAsReturned_6FCCE200_113c(m, pGame, 0, 0, 0, 1, 1)
  })

  it('[18..25] Baal command action and Act 4 Quest 1/2/3 callbacks & timers', () => {
    const { m, pGame } = createHarness()
    const pRoom = createRoomWithAct(m, pGame, 105)
    const pMonster = createDynamicUnit(m, pGame, 1, 544, 100, 200, 200, pRoom)
    const pTarget = createDynamicUnit(m, pGame, 0, 0, 1, 205, 205, pRoom)
    const pAiCtrl = m.alloc(0x40)
    const pCoords = m.alloc(0x10)
    AIBAAL_ExecuteCommandAction_6FCD8070_113c(m, pTarget, pMonster, 99, pGame, pAiCtrl, pCoords)

    const pQuest = m.alloc(0x100)
    const pState = m.alloc(0x80)
    m.setU32(pState + 0x20, pRoom)
    m.setU32(pQuest + 0x04, pGame)
    m.setU32(pQuest + 0x18, pState)
    const pQuestArg = m.alloc(0x30)
    m.setU32(pQuestArg + 0x00, pGame)
    m.setU32(pQuestArg + 0x04, pTarget)
    m.setU16(pQuestArg + 0x10, 0x0f6)
    ACT4Q2_OnQuestTarget0F6Callback_6FCD9DE0_113c(m, pQuest, pQuestArg)

    const pObjInit = m.alloc(0x30)
    m.setU32(pObjInit + 0x00, pGame)
    const pForgeObj = createStaticUnit(m, pGame, 2, 376, 55, 100, 100, pRoom)
    m.setU32(pObjInit + 0x04, pForgeObj)
    ACT4Q2_InitHellforgeObject_6FCD9E80_113c(m, pObjInit)
    expect(m.u32(pForgeObj + 0x10)).toBe(3)

    ACT4Q1_OnPlainsOfDespairEntered_6FCDA080_113c(m, pGame)
    ACT4Q1_OnTyraelTalkCallback_6FCDA100_113c(m, pQuest, pQuestArg)
    expect(ACT4Q1_TimerSpawnIzualSpirit_6FCDA960_113c(m, pGame, pQuest)).toBe(1)

    ACT4Q3_OnTyraelTalkOpenHarrogathPortal_6FCDB1B0_113c(m, pQuest, pQuestArg)
    ACT4Q3_KillAllChaosSanctuaryMonsters_6FCDB3B0_113c(m, pState, pGame)
  })

  it('[26..27] NPC identify pending item and Cain identify all items', () => {
    const { m, pGame } = createHarness()
    const pPlayer = createDynamicUnit(m, pGame, 0, 0, 1, 100, 100)
    NPCS_IdentifyPendingItemForPlayer_6FCDDA90_113c(m, pGame, 999, pPlayer)
    NPCS_CainIdentifyAllItems_6FCDDB10_113c(m, 999, pPlayer, pGame)
  })

  it('[28..40] Act 2 Quest 1..6 & Temple portal timers, talk callbacks, and chest operators', () => {
    const { m, pGame } = createHarness()
    const pQuest = m.alloc(0x100)
    const pState = m.alloc(0x100)
    m.setU32(pQuest + 0x04, pGame)
    m.setU32(pQuest + 0x18, pState)

    expect(ACT2Q6_TimerSendQuest14Alert_6FCE58B0_113c(m, pGame, pQuest)).toBe(1)
    const pQuestArg = m.alloc(0x30)
    m.setU32(pQuestArg + 0x00, pGame)
    m.setU16(pQuestArg + 0x10, 0)
    ACT2Q6_OnTyraelOrJerhynTalkCallback_6FCE5A60_113c(m, pQuest, pQuestArg)

    expect(ACT2Q5_TimerSummonerTauntAndAlert_6FCE5BE0_113c(m, pGame, pQuest)).toBe(0)
    ACT2Q4_OpenArcanePortalAndSyncQuest_6FCE5D10_113c(m, pState, pQuest)
    ACT2Q4_OnDrognanTalkCallback_6FCE5DB0_113c(m, pQuest, pQuestArg)
    expect(ACT2Q3_TimerSendQuest11Alert_6FCE5E30_113c(m, pGame, pQuest)).toBe(1)
    ACT2Q3_EndTaintedSunEclipse_6FCE5E90_113c(m, pGame, pQuest)
    expect(ACT2Q1_TimerSendQuest9Alert_6FCE6010_113c(m, pGame, pQuest)).toBe(1)
    ACT2Q1_OnAtmaTalkCallback_6FCE61C0_113c(m, pQuest, pQuestArg)

    const pObjInit = m.alloc(0x30)
    m.setU32(pObjInit + 0x00, pGame)
    QUEST0D_InitTemplePortalObject_6FCE9ED0_113c(m, pObjInit)

    const pOp = m.alloc(0x20)
    const pChest = createStaticUnit(m, pGame, 2, 1, 77, 100, 100)
    m.setU32(pChest + 0x10, 2) // already opened -> OBJECTS_OperateContainer returns 0
    m.setU32(pOp + 0x00, pGame)
    m.setU32(pOp + 0x04, pChest)
    expect(ACT2Q2_OperateHoradricCubeChest_6FCEA050_113c(m, pOp)).toBe(0)
    expect(ACT2Q2_OperateStaffOfKingsChest_6FCEA170_113c(m, pOp)).toBe(0)
    expect(ACT2Q2_OperateHoradricScrollChest_6FCEA290_113c(m, pOp)).toBe(0)
  })

  it('[41..45] MONREG_InitAllActMonsterRegions and C2S 0x5D/0x5E/5-byte/item-mode validators', () => {
    const { m, pGame, pArena } = createHarness(4)
    const ppRegionTable = m.alloc(8 * 4)
    const pSeed = m.alloc(8)
    MONREG_InitAllActMonsterRegions_6FCEAB30_113c(m, 0xCAFEBABE, 0, ppRegionTable, pSeed, 0, 1)
    expect(m.u32(pSeed)).toBe(0xcafebabe)
    const pReg1 = m.u32(ppRegionTable + 4)
    expect(pReg1).not.toBe(0)
    expect(m.u32(pReg1 + 0x2c0)).toBe(1)
    expect(m.u32(pReg1 + 0x2dc)).toBe(11)

    const pPlayer = createDynamicUnit(m, pGame, 0, 0, 1, 100, 100)
    const pPkt5D = m.alloc(8)
    m.setU8(pPkt5D + 0, 0x5d)
    m.setU8(pPkt5D + 1, 2)
    m.setU32(pPkt5D + 2, 99)
    expect(C2S_HandlePacket5D_PartyRelationAction_6FCEC860_113c(m, pGame, pPlayer, pPkt5D, 5)).toBe(
      3,
    )
    expect(C2S_HandlePacket5D_PartyRelationAction_6FCEC860_113c(m, pGame, pPlayer, pPkt5D, 6)).toBe(
      0,
    )
    m.setU8(pPkt5D + 1, 11)
    expect(C2S_HandlePacket5D_PartyRelationAction_6FCEC860_113c(m, pGame, pPlayer, pPkt5D, 6)).toBe(
      2,
    )

    const pPkt5E = m.alloc(8)
    m.setU8(pPkt5E + 0, 0x5e)
    m.setU8(pPkt5E + 1, 2)
    m.setU8(pPkt5E + 2, 1)
    m.setU32(pPkt5E + 3, 99)
    expect(C2S_HandlePacket5E_PartyRelationToggle_6FCEC8E0_113c(m, pGame, pPlayer, pPkt5E, 6)).toBe(
      3,
    )
    expect(C2S_HandlePacket5E_PartyRelationToggle_6FCEC8E0_113c(m, pGame, pPlayer, pPkt5E, 7)).toBe(
      0,
    )
    m.setU32(pArena + 0x08, 0x10000)
    expect(C2S_HandlePacket5E_PartyRelationToggle_6FCEC8E0_113c(m, pGame, pPlayer, pPkt5E, 7)).toBe(
      3,
    )

    const pPkt5 = m.alloc(8)
    m.setU32(pPkt5 + 1, 777)
    expect(C2S_ValidatePacket5ByteItem_6FCED4F0_113c(m, pGame, pPlayer, pPkt5, 4)).toBe(3)
    expect(C2S_ValidatePacket5ByteItem_6FCED4F0_113c(m, pGame, pPlayer, pPkt5, 5)).toBe(1)

    expect(C2S_ValidateItemInteractionByAnimMode_6FCED6D0_113c(m, pGame, 777, pPlayer)).toBe(1)
    const pRoom = createRoomWithAct(m, pGame, 1)
    m.setU32(m.u32(pPlayer + 0x2c) + 0x1c, pRoom)
    const pGroundItem = createStaticUnit(m, pGame, 4, 1, 777, 102, 102, pRoom)
    m.setU32(pGroundItem + 0x10, 3) // ITEMMODE_ONGROUND
    m.setU32(pGame + 0x1720 + ((777 & 0x7f) << 2), pGroundItem)
    expect(C2S_ValidateItemInteractionByAnimMode_6FCED6D0_113c(m, pGame, 777, pPlayer)).toBe(0)
  })
})
