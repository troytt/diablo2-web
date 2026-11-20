import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.js'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.js'
import { STATLIST_CreateEx113c, STATLIST_GetUnitStat113c, STATLIST_SetUnitStat113c } from '../../../src/d2kern-113c/common/statlist.js'
import {
  ACT3Q0_InitDarkWandererPreset_6FD08290_113c,
  ACT3Q2_InitGidbinnBossActivePreset_6FD08560_113c,
  ACT3Q2_InitGidbinnBossDefaultPreset_6FD086A0_113c,
  ACT3Q3_InitCompellingOrbPreset_6FD084A0_113c,
  ACT3Q3_OpenSewerLeverObject_6FD09EA0_113c,
  ACT3Q4_StatusFilter_6FD06E00_113c,
  ACT3Q5_InitCouncilBossPreset_6FD08310_113c,
  ACT3Q5_InitStairsObject_6FD098E0_113c,
  ACT3Q5_OnStairsProximityTimer_6FD09960_113c,
  ACT3Q6_FireHellgateOpenerProjectile_6FD0AB60_113c,
  MONSTER_SpawnMinionPackAtCoords_6FD0F7D0_113c,
  MONSTER_SpawnMinionPackInRing_6FD0DE90_113c,
  MONSTER_SpawnRandomLevelMonAtCoords_6FD0F6B0_113c,
  MONSTER_SpawnSelfOwnedLeader_6FD0F8B0_113c,
  NET_SendPacket5A_PartyRelationEvent_6FD10720_113c,
  PARTY_BroadcastPacket8CRelationFlags_6FD105B0_113c,
  PARTY_DispatchRelationAction_6FD10A70_113c,
  PARTY_InitPlayerRelationOnJoinCallback_6FD10B10_113c,
  PARTY_RefreshInviteRelationNodes_6FD103E0_113c,
  PARTY_SendRosterUpdateCallback_6FD0B070_113c,
  PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c,
  PARTY_SyncMutualRelationState_6FD109E0_113c,
  PLAYERLIST_RemoveRelationNodeCallback_6FD10040_113c,
  PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c,
  PLAYERSAVE_WriteHirelingHeaderFields_6FD0C120_113c,
  PLAYERSAVE_WriteHirelingItemsSection_6FD0C1E0_113c,
  PLAYERSAVE_WriteIronGolemSection_6FD0C020_113c,
  PLAYERSAVE_WritePlayerItemsSection_6FD0C0E0_113c,
  PLAYERSAVE_WritePlrIntroSection_6FD0B610_113c,
  PLAYERSAVE_WriteQuestSection_6FD0B7B0_113c,
  PLAYERSAVE_WriteSkillSection_6FD0BC40_113c,
  PLAYERSAVE_WriteStatsSection_6FD0BE70_113c,
  PLAYERSAVE_WriteWaypointSection_6FD0B700_113c,
  PLAYERSTATS_AllocateEnergyPoints_6FD0AE20_113c,
  PLAYERSTATS_AllocateVitalityPoints_6FD0AD10_113c,
  QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c,
  QUESTS_SpawnProjectile12B_6FD0AB10_113c,
  SKILLS_CastTriggeredCoordSkillAndQueue9A_6FD11730_113c,
  SKILLS_ResolveTriggeredAttackerTarget_6FD11420_113c,
  SKILLS_ResolveTriggeredCorpseTarget_6FD11490_113c,
  SKILLS_RollRandomUnblockedTargetPos_6FD112C0_113c,
  SUBPARTY_ClearUnitBucketList_6FD0FD40_113c,
  SUBPARTY_CreatePlayerBucketHead_6FD0FED0_113c,
  SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c,
  SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b9-113c.js'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.js'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.js'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js'

function setupTables(m: SparseMemory113c): number {
  const pDataTables = m.alloc(0x1000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(0x6fdd90b0, m.u32(0x6fd18be0))
  const pPtrSlot = m.alloc(4)
  m.setU32(pPtrSlot, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pPtrSlot)
  const pCharStats = m.alloc(0xc4 * 7)
  m.setU32(pDataTables + 0xbc4, pCharStats)
  m.setU32(pDataTables + 0xbc8, 7)
  m.setU8(pCharStats + 0x46, 3) // nLifePerVitality
  m.setU8(pCharStats + 0x47, 1) // nStaminaPerVitality
  m.setU8(pCharStats + 0x48, 2) // nManaPerMagic
  const pIsc = m.alloc(0x144 * 16)
  m.setU32(pDataTables + 0xbcc, pIsc)
  m.setU32(pDataTables + 0xbd4, 16)
  m.setU32(pDataTables + 0xba8, 5) // nMaxClassSkills
  return pDataTables
}

describe('K2 Wave 5 Batch 9 (w5b9): 45 D2Game.dll functions (0x6FD06E00..0x6FD11730)', () => {
  it('ports [1/45]..[9/45] Act 3 quest status, preset spawns, and object timers', () => {
    const m = new SparseMemory113c()
    setupTables(m)

    // [1/45] 0x6FD06E00
    const pFlags = QUESTRECORD_AllocRecord113c(m, 0)
    const pOut = m.alloc(4)
    const pGame = m.alloc(0x1800)
    EVENT_InitTimerQueue113c(m, pGame)
    const pQuest = m.alloc(0x100)
    const pQState = m.alloc(0x40)
    const pPlr0 = m.alloc(0x100)
    m.setU32(pPlr0 + 0x14, m.alloc(0x100))
    m.setU32(pQuest + 0x04, pGame)
    m.setU32(pQuest + 0x18, pQState)
    expect(ACT3Q4_StatusFilter_6FD06E00_113c(m, pQuest, pPlr0, 0, pFlags, pOut)).toBe(1)
    expect(m.u8(pOut)).toBe(0)

    QUESTRECORD_SetQuestState113c(m, pFlags, 0x0f, 0)
    m.setU8(pQuest + 0x09, 1)
    m.setU8(pQuest + 0x0c, 2)
    m.setU8(pQState + 0x02, 1)
    m.setU8(pGame + 0x6a, 3)
    expect(ACT3Q4_StatusFilter_6FD06E00_113c(m, pQuest, pPlr0, 0, pFlags, pOut)).toBe(1)
    expect(m.u8(pOut)).toBe(8)

    QUESTRECORD_SetQuestState113c(m, pFlags, 0x11, 0)
    QUESTRECORD_SetQuestState113c(m, pFlags, 0x11, 0x0d)
    expect(ACT3Q4_StatusFilter_6FD06E00_113c(m, pQuest, pPlr0, 0, pFlags, pOut)).toBe(1)
    expect(m.u8(pOut)).toBe(0x0d)

    // [2/45] 0x6FD08290
    const pQuestCtrl = m.alloc(0x20)
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    m.setU32(pQuestCtrl + 0x08, 1)
    m.setU32(pQuestCtrl + 0x0c, pFlags)
    const pQuest1C = m.alloc(0x100)
    const pState1C = m.alloc(0x20)
    m.setU32(pQuest1C, 0x1c)
    m.setU32(pQuest1C + 0x18, pState1C)
    m.setU32(pQuestCtrl, pQuest1C)
    const pObjInit = m.alloc(0x30)
    m.setU32(pObjInit, pGame)
    ACT3Q0_InitDarkWandererPreset_6FD08290_113c(m, pObjInit)
    expect(m.u8(pState1C)).toBe(1)

    // [3/45] 0x6FD08310
    const pQuest14 = m.alloc(0x100)
    const pState14 = m.alloc(0x40)
    m.setU32(pQuest14, 0x14)
    m.setU32(pQuest14 + 0x18, pState14)
    m.setU32(pQuest1C + 0xf4, pQuest14)
    m.setU8(pState14 + 0x20, 1)
    m.setU32(pState14 + 0x2c, 0x15)
    const pBossMon = m.alloc(0x100)
    m.setU32(pBossMon + 0x04, 0x129)
    m.setU32(pBossMon + 0x0c, 0x15)
    m.setU32(pGame + 0x1320 + 0x15 * 4, pBossMon)
    ACT3Q5_InitCouncilBossPreset_6FD08310_113c(m, pObjInit)
    expect(m.u8(pState14 + 0x20)).toBe(1)

    // [4/45] 0x6FD084A0
    const pQuest13 = m.alloc(0x100)
    const pState13 = m.alloc(0x40)
    m.setU32(pQuest13, 0x13)
    m.setU32(pQuest13 + 0x18, pState13)
    m.setU32(pQuest14 + 0xf4, pQuest13)
    m.setU8(pState13 + 0x0c, 1)
    m.setU8(pState13 + 0x28, 1)
    const pOrbObj = m.alloc(0x100)
    m.setU32(pOrbObj, 2)
    m.setU32(pOrbObj + 0x0c, 0x42)
    m.setU32(pOrbObj + 0x2c, m.alloc(0x20))
    m.setU32(pObjInit + 0x04, pOrbObj)
    ACT3Q3_InitCompellingOrbPreset_6FD084A0_113c(m, pObjInit)
    expect(m.u32(pOrbObj + 0x10)).toBe(2)

    // [5/45] 0x6FD08560 & [6/45] 0x6FD086A0
    const pQuest0E = m.alloc(0x100)
    const pState0E = m.alloc(0x30)
    m.setU32(pQuest0E, 0x0e)
    m.setU32(pQuest0E + 0x18, pState0E)
    m.setU32(pQuest13 + 0xf4, pQuest0E)
    m.setU32(pObjInit + 0x14, 100)
    m.setU32(pObjInit + 0x18, 200)
    m.setU8(pState0E, 1)
    m.setU32(pState0E + 0x0c, 0x15)
    ACT3Q2_InitGidbinnBossDefaultPreset_6FD086A0_113c(m, pObjInit)
    QUESTRECORD_SetQuestState113c(m, pFlags, 0x10, 0x0d)
    ACT3Q2_InitGidbinnBossActivePreset_6FD08560_113c(m, pObjInit)
    expect(m.u8(pState0E + 0x02)).toBe(1)
    expect(m.u8(pState0E + 0x03)).toBe(1)

    // [7/45] 0x6FD098E0 & [8/45] 0x6FD09960
    m.setU32(pState14 + 0x10, 1)
    ACT3Q5_InitStairsObject_6FD098E0_113c(m, pObjInit)
    expect(m.u8(pState14 + 0x02)).toBe(1)
    expect(m.u32(pState14 + 0x08)).toBe(0x42)
    m.setU32(pQuest14 + 0x04, pGame)
    ACT3Q5_OnStairsProximityTimer_6FD09960_113c(m, pOrbObj, pQuest14)

    // [9/45] 0x6FD09EA0
    const pQuestSewer = m.alloc(0x100)
    const pStateSewer = m.alloc(0x20)
    m.setU32(pQuestSewer + 0x04, pGame)
    m.setU32(pQuestSewer + 0x18, pStateSewer)
    m.setU8(pStateSewer, 1)
    m.setU32(pStateSewer + 0x04, 0x7f)
    ACT3Q3_OpenSewerLeverObject_6FD09EA0_113c(m, pQuestSewer)
    expect(m.u32(pStateSewer + 0x08)).toBe(2)
  })

  it('ports [10/45]..[25/45] quest projectiles, stat allocation, and player save sections', () => {
    const m = new SparseMemory113c()
    const pDataTables = setupTables(m)
    const pGame = m.alloc(0x1800)
    EVENT_InitTimerQueue113c(m, pGame)

    // [10/45] 0x6FD0A730
    const pCenter = m.alloc(0x100)
    m.setU32(pCenter, 1)
    expect(() => QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c(m, pGame, pCenter, 5, 10, 0, 0)).toThrow(
      D2CommonAssertError,
    )
    expect(() => QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c(m, pGame, pCenter, 5, 10, 10, 0)).toThrow(
      D2CommonAssertError,
    )
    QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c(m, pGame, pCenter, 5, 2, 10, 1)

    // [11/45] 0x6FD0AB10 & [12/45] 0x6FD0AB60
    expect(QUESTS_SpawnProjectile12B_6FD0AB10_113c(m, 0, pGame)).toBe(0)
    expect(() => ACT3Q6_FireHellgateOpenerProjectile_6FD0AB60_113c(m, pCenter, pGame)).toThrow(
      D2CommonAssertError,
    )

    // [13/45] 0x6FD0AD10 & [14/45] 0x6FD0AE20
    const pPlayer = m.alloc(0x120)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x04, 0) // Amazon
    m.setU32(pPlayer + 0x0c, 0x101)
    const pPlayerData = m.alloc(0x100)
    m.setU32(pPlayer + 0x14, pPlayerData)
    const pStatList = STATLIST_CreateEx113c(m, pPlayer, 0, pGame)
    m.setU32(pPlayer + 0x5c, pStatList)
    STATLIST_SetUnitStat113c(m, pPlayer, 4, 10, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 3, 20, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 1, 15, 0)
    PLAYERSTATS_AllocateVitalityPoints_6FD0AD10_113c(m, 2, pPlayer)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 3, 0)).toBe(22)
    PLAYERSTATS_AllocateEnergyPoints_6FD0AE20_113c(m, 3, pPlayer)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 1, 0)).toBe(18)

    // [15/45] 0x6FD0B070
    const pOtherPlayer = m.alloc(0x120)
    m.setU32(pOtherPlayer, 0)
    m.setU32(pOtherPlayer + 0x14, m.alloc(0x100))
    expect(PARTY_SendRosterUpdateCallback_6FD0B070_113c(m, pGame, pOtherPlayer, pPlayer)).toBe(0)

    // [16/45] 0x6FD0B610
    const pSaveBuf = m.alloc(0x800)
    const ppCur = m.alloc(4)
    m.setU32(ppCur, pSaveBuf)
    expect(PLAYERSAVE_WritePlrIntroSection_6FD0B610_113c(m, pPlayer, ppCur, pSaveBuf + 0x10)).toBe(1)
    for (let d = 0; d < 3; d++) {
      const pIntro = m.alloc(0x10)
      const pQI = m.alloc(4)
      const pQIData = m.alloc(8)
      m.setU32(pQIData, 0x11111111 + d)
      m.setU32(pQI, pQIData)
      const pNI = m.alloc(4)
      const pNIData = m.alloc(8)
      m.setU32(pNIData, 0x22222222 + d)
      m.setU32(pNI, pNIData)
      m.setU32(pIntro, pQI)
      m.setU32(pIntro + 0x04, pNI)
      m.setU32(pPlayerData + 0x60 + d * 4, pIntro)
      m.setU32(pPlayerData + 0x1c + d * 4, m.alloc(0x20))
      m.setU32(pPlayerData + 0x10 + d * 4, QUESTRECORD_AllocRecord113c(m, 0))
    }
    expect(PLAYERSAVE_WritePlrIntroSection_6FD0B610_113c(m, pPlayer, ppCur, pSaveBuf + 0x800)).toBe(0)
    expect(m.u16(pSaveBuf)).toBe(0x7701)
    expect(m.u32(ppCur)).toBe(pSaveBuf + 0x34)

    // [17/45] 0x6FD0B700
    const wpPos = m.u32(ppCur)
    expect(PLAYERSAVE_WriteWaypointSection_6FD0B700_113c(m, pSaveBuf + 0x800, pPlayer, ppCur)).toBe(0)
    expect(m.u16(wpPos)).toBe(0x5357)
    expect(m.u32(ppCur)).toBe(wpPos + 0x50)

    // [18/45] 0x6FD0B7B0
    const qPos = m.u32(ppCur)
    expect(PLAYERSAVE_WriteQuestSection_6FD0B7B0_113c(m, pSaveBuf + 0x800, pPlayer, ppCur)).toBe(0)
    expect(m.u32(qPos)).toBe(0x216f6f57)
    expect(m.u32(ppCur)).toBe(qPos + 0x12a)

    // [19/45] 0x6FD0BC40
    const pClient = m.alloc(0x200)
    m.setU8(pClient + 0x08, 7) // invalid class >= 7 -> returns 2
    m.setU32(pPlayerData + 0x9c, pClient)
    expect(PLAYERSAVE_WriteSkillSection_6FD0BC40_113c(m, pPlayer, ppCur, pSaveBuf + 0x800)).toBe(2)

    // [20/45] 0x6FD0BD10
    expect(PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c(m, pPlayer, -1)).toBe(0)
    expect(PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c(m, pPlayer, 0x999)).toBe(0)

    // [21/45] 0x6FD0BE70
    const pIsc = m.u32(pDataTables + 0xbcc)
    m.setU8(pIsc + 3 * 0x144 + 0x0a, 10) // Vit CSV bits = 10
    const gfPos = m.u32(ppCur)
    expect(PLAYERSAVE_WriteStatsSection_6FD0BE70_113c(m, pPlayer, ppCur, pSaveBuf + 0x800)).toBe(0)
    expect(m.u16(gfPos)).toBe(0x6667)
    expect(m.u32(ppCur)).toBeGreaterThan(gfPos + 2)

    // [22/45] 0x6FD0C020, [23/45] 0x6FD0C0E0, [24/45] 0x6FD0C120, [25/45] 0x6FD0C1E0
    m.setU32(pGame + 0x70, 1) // Expansion
    const kfPos = m.u32(ppCur)
    expect(PLAYERSAVE_WriteIronGolemSection_6FD0C020_113c(m, pGame, pPlayer, ppCur, pSaveBuf + 0x800)).toBe(0)
    expect(m.u16(kfPos)).toBe(0x666b)
    expect(m.u8(kfPos + 2)).toBe(0)

    expect(
      PLAYERSAVE_WritePlayerItemsSection_6FD0C0E0_113c(m, pSaveBuf + 0x800, 0, 0, ppCur, pGame, pPlayer, 0),
    ).toBe(0)

    const pHeader = m.alloc(0x100)
    PLAYERSAVE_WriteHirelingHeaderFields_6FD0C120_113c(m, pGame, pPlayer, pHeader)

    const jfPos = m.u32(ppCur)
    expect(PLAYERSAVE_WriteHirelingItemsSection_6FD0C1E0_113c(m, pGame, pPlayer, ppCur, pSaveBuf + 0x800)).toBe(0)
    expect(m.u16(jfPos)).toBe(0x666a)
  })

  it('ports [26/45]..[45/45] minion spawns, subparty buckets, party relations, and triggered skills', () => {
    const m = new SparseMemory113c()
    const pDataTables = setupTables(m)
    const pGame = m.alloc(0x1800)
    EVENT_InitTimerQueue113c(m, pGame)

    // [26/45] 0x6FD0DE90, [27/45] 0x6FD0F6B0, [28/45] 0x6FD0F7D0, [29/45] 0x6FD0F8B0
    expect(MONSTER_SpawnMinionPackInRing_6FD0DE90_113c(m, 2, pGame, 0, 1, 10, 3, 0)).toBe(0)
    const pLeader = m.alloc(0x100)
    m.setU32(pLeader, 1)
    m.setU32(pLeader + 0x0c, 0x33)
    expect(MONSTER_SpawnMinionPackInRing_6FD0DE90_113c(m, 0, pGame, pLeader, 1, 10, 3, 0)).toBe(0)
    expect(MONSTER_SpawnMinionPackAtCoords_6FD0F7D0_113c(m, 0, pGame, pLeader, 50, 60, 10, 1, 3, 0)).toBe(0)
    expect(MONSTER_SpawnSelfOwnedLeader_6FD0F8B0_113c(m, -1, 1, 0, pGame, 50, 60, 3, 1, 0)).toBe(0)

    const pLevelsTxt = m.alloc(0x220 * 2)
    m.setU32(pDataTables + 0xc58, pLevelsTxt)
    m.setU32(pDataTables + 0xc5c, 2)
    m.setU8(pLevelsTxt + 0x220 + 0x33, 1) // level 1 bNumMon = 1
    m.setU16(pLevelsTxt + 0x220 + 0x36, 0xffff) // wMon[0] = -1
    const pRoomEx = m.alloc(0x80)
    const pLevel = m.alloc(0x200)
    m.setU32(pLevel + 0x1d0, 1)
    m.setU32(pRoomEx + 0x58, pLevel)
    const pRoom = m.alloc(0x100)
    m.setU32(pRoom + 0x10, pRoomEx)
    const pMonStats0 = m.alloc(0x1a8)
    m.setU8(pMonStats0 + 0x0c, 1)
    m.setU32(pDataTables + 0xa78, pMonStats0)
    m.setU32(pDataTables + 0xa80, 1)
    expect(() => MONSTER_SpawnRandomLevelMonAtCoords_6FD0F6B0_113c(m, pGame, pRoom, 10, 10)).toThrow()
    m.setU16(pLevelsTxt + 0x220 + 0x36, 0)
    expect(MONSTER_SpawnRandomLevelMonAtCoords_6FD0F6B0_113c(m, pGame, pRoom, 10, 10)).toBe(0)

    // [30/45]..[33/45] subparty buckets 0x6FD0FD40..0x6FD0FED0
    const pPlrA = m.alloc(0x120)
    const pPlrB = m.alloc(0x120)
    const pMonC = m.alloc(0x120)
    m.setU32(pPlrA, 0)
    m.setU32(pPlrB, 0)
    m.setU32(pMonC, 1)
    m.setU32(pPlrA + 0xd0, 0x0b)
    m.setU32(pPlrB + 0xd0, 0x0b)
    m.setU32(pMonC + 0xd0, 0x0b)

    SUBPARTY_CreatePlayerBucketHead_6FD0FED0_113c(m, pGame, pPlrA, 0xaa)
    expect(m.u32(pPlrA + 0xd0)).toBe(0)
    SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(m, pGame, pPlrB, 0, 0xbb)
    expect(m.u32(pPlrB + 0xd0)).toBe(0)
    SUBPARTY_ClearUnitBucketList_6FD0FD40_113c(m, pGame, pPlrA)
    expect(m.u32(pPlrA + 0xd0)).toBe(0x0b)
    expect(m.u32(pPlrB + 0xd0)).toBe(0x0b)

    SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c(m, pGame, 8, pMonC, 0xcc)
    expect(m.u32(pMonC + 0xd0)).toBe(8)
    SUBPARTY_ClearUnitBucketList_6FD0FD40_113c(m, pGame, pMonC)
    expect(m.u32(pMonC + 0xd0)).toBe(0x0b)

    // [34/45]..[41/45] party relation & packet routines
    const pDataA = m.alloc(0x100)
    const pDataB = m.alloc(0x100)
    m.setU32(pPlrA + 0x0c, 1)
    m.setU32(pPlrB + 0x0c, 2)
    m.setU32(pPlrA + 0x14, pDataA)
    m.setU32(pPlrB + 0x14, pDataB)
    m.setU32(pPlrA + 0x80, pGame)
    m.setU32(pPlrB + 0x80, pGame)
    const pRelAB = m.alloc(0x14)
    m.setU32(pRelAB, 2)
    m.setU32(pRelAB + 0x04, 0x01)
    m.setU32(pRelAB + 0x0c, 2)
    m.setU32(pDataA + 0x38, pRelAB)
    const pRelBA = m.alloc(0x14)
    m.setU32(pRelBA, 1)
    m.setU32(pRelBA + 0x0c, 4)
    m.setU32(pDataB + 0x38, pRelBA)
    m.setU32(pGame + 0x1120 + 2 * 4, pPlrB)

    PARTY_RefreshInviteRelationNodes_6FD103E0_113c(m, pGame, pPlrA)
    expect(m.u32(pRelAB + 0x0c)).toBe(0)

    PARTY_BroadcastPacket8CRelationFlags_6FD105B0_113c(m, pPlrB, pPlrA, pGame)
    PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c(m, 0x08, pPlrA, pPlrB, pGame, 1)
    expect(m.u32(pRelAB + 0x04)).toBe(0x09)

    const pClient = m.alloc(0x600)
    m.setU32(pClient + 0x1bc, m.alloc(0x800))
    expect(NET_SendPacket5A_PartyRelationEvent_6FD10720_113c(m, 0x1234, pClient, 3)).toBe(1)

    PARTY_SyncMutualRelationState_6FD109E0_113c(m, pPlrA, pPlrB)
    expect(m.u32(pRelAB + 0x0c)).toBe(2)

    m.setU32(0x6fd1a3b0 + 4, 0x6fd10f40)
    m.setU32(0x6fd18d14, 0)
    let dispatchedHandler = 0
    expect(
      PARTY_DispatchRelationAction_6FD10A70_113c(
        m,
        2,
        1,
        pGame,
        pPlrA,
        7,
        (_mem, fn) => {
          dispatchedHandler = fn
        },
      ),
    ).toBe(0)
    expect(dispatchedHandler).toBe(0x6fd10f40)

    PARTY_InitPlayerRelationOnJoinCallback_6FD10B10_113c(m, pGame, pPlrA, pPlrB)
    PLAYERLIST_RemoveRelationNodeCallback_6FD10040_113c(m, pGame, pPlrA, pPlrB)
    expect(m.u32(pDataA + 0x38)).toBe(0)

    // [42/45]..[45/45] triggered skill target & cast helpers
    expect(SKILLS_RollRandomUnblockedTargetPos_6FD112C0_113c(m, pPlrA)).toBe(0)
    m.setU32(pPlrA + 0x2c, m.alloc(0x200))
    const pOutType = m.alloc(4)
    const pOutGuid = m.alloc(4)
    expect(SKILLS_ResolveTriggeredAttackerTarget_6FD11420_113c(m, pGame, pPlrA, pOutType, pOutGuid)).toBe(1)
    expect(m.u32(pOutType)).toBe(6)
    expect(m.u32(pOutGuid)).toBe(0xffffffff)
    expect(SKILLS_ResolveTriggeredCorpseTarget_6FD11490_113c(m, pGame, pPlrA, pOutType, 0, 0, pOutGuid)).toBe(0)
    expect(SKILLS_CastTriggeredCoordSkillAndQueue9A_6FD11730_113c(m, 0, 20, 1, 1, 10, 0)).toBe(0)
  })
})
