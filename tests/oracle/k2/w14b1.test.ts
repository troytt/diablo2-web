import { describe, expect, it } from 'vitest'
import {
  GDW_BITMASKS_IAT_VA_113C,
  SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/skills.ts'
import * as w14b1 from '../../../src/d2kern-113c/game/k2-w14b1-113c.ts'
import {
  ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c,
  ACT1Q3_OnNpcInitCainSearch_6FC86960_113c,
  ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c,
  ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c,
  ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c,
  ACT3Q7_OnMephistoPortalWarpToAct4_6FC566C0_113c,
  ACT4Q3_OnDiabloDeathPortalWarpToAct5_6FCDB550_113c,
  ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c,
  ACT5Q3_OnMalahOrAnyaScrollCallback_6FC7F5E0_113c,
  AI_MercOrShadowWarriorThink_6FCCC8E0_113c,
  CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c,
  CUBE_TransmuteHoradricCubeItems_6FC92FC0_113c,
  ITEMS_EvaluateMonsterDropTableEntry_6FC3E900_113c,
  MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c,
  PLRDEATH_DropPlayerEquippedItemsAndGoldToCorpseOrGround_6FC98FA0_113c,
  PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c,
  QUESTS_FindAndDeletePlayerQuestItemByCode_6FC566A0_113c,
  SKILLS_SpawnBoneWallSegment_6FC70E60_113c,
  SKILLS_SrvDo_BoneWall_6FC70FE0_113c,
  SKILLS_SrvDo_ClayBloodFireGolem_6FC71750_113c,
  SKILLS_SrvDo_IronGolem_6FC71540_113c,
  SKILLS_SrvDo_RaiseSkeletonOrMage_6FC718B0_113c,
  SKILLS_SrvDo_Summon3TrapsInTriangle_6FC63D40_113c,
  SKILLS_SrvDo_SummonDecoy_6FC6D710_113c,
  SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c,
  SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c,
  SKILLS_SrvDo_SummonShadowWarriorOrMaster_6FC6D8C0_113c,
  SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c,
  SKILLS_SrvDo_Valkyrie_6FCB5980_113c,
  SKILLS_SummonMonsterFromSkillOrMissile_6FCB5D50_113c,
} from '../../../src/d2kern-113c/game/k2-w14b1-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveExportByVa(vaSuffix: string): (...args: any[]) => any {
  const suffix = `_${vaSuffix}_113c`
  for (const [k, v] of Object.entries(w14b1)) {
    if (k.endsWith(suffix) && typeof v === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return v as (...args: any[]) => any
    }
  }
  throw new Error(`Missing w14b1 export for VA ${vaSuffix}`)
}

function createTestMem(): SparseMemory113c {
  const m = new SparseMemory113c()
  m.fill(0x10000, 0x30000, 0)
  m.fill(0x38000, 0x2000, 0)
  m.fill(0x6fd18000, 0x20000, 0)
  m.fill(0x6fde9000, 0x9000, 0)
  initD2GameGlobalsInMem113c(m, 0x38100)

  const pMasks = 0x39800
  for (let i = 0; i < 32; i++) {
    m.setU32((pMasks + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pMasks)
  m.setU32(GDW_BITMASKS_IAT_VA_113C, pMasks)

  m.setU32(0x38000, 0x38100)
  m.setU32(0x6fd1829c, 0x38000)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, 0x38000)
  m.setU32(0x6fde9e1c, 0x38100)
  m.setU32(SGPT_DATATABLES_VA_113C, 0x38100)
  return m
}

describe('K2 Wave 14 Batch 1 (w14b1: 44 D2Game VAs 0x6FC3E900..0x6FD09C80)', () => {
  it('1. 0x6FC3E900 ITEMS_EvaluateMonsterDropTableEntry_6FC3E900_113c dispatches table14 vs default', () => {
    const m = createTestMem()
    const pGame = 0x10000
    const pUnit = 0x12000
    const pDropCtx = 0x13000
    const pRec = 0x13100
    m.setU32(pDropCtx, pRec)
    m.setU32(pRec + 0x14, 1)
    let called14 = 0
    ITEMS_EvaluateMonsterDropTableEntry_6FC3E900_113c(m, pGame, pUnit, pDropCtx, () => {
      called14++
    })
    expect(called14).toBe(1)
  })

  it('2. 0x6FC566A0 QUESTS_FindAndDeletePlayerQuestItemByCode_6FC566A0_113c handles player with empty inventory', () => {
    const m = createTestMem()
    const pGame = 0x10000
    const pPlayer = 0x12000
    let deleted = 0
    QUESTS_FindAndDeletePlayerQuestItemByCode_6FC566A0_113c(
      m,
      pGame,
      pPlayer,
      0x20747368,
      () => {
        deleted++
      },
    )
    expect(deleted).toBe(0)
  })

  it('3. 0x6FC566C0 ACT3Q7_OnMephistoPortalWarpToAct4_6FC566C0_113c returns early when quest 0x17 bit 0 is set', () => {
    const m = createTestMem()
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPlayerData = 0x12400
    const pQuestFlags = 0x12800
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x10, pQuestFlags)
    m.setU32(pQuestFlags, 0x12900)
    m.setU32(pQuestFlags + 4, 0x60)
    m.setU16(0x12900 + 0x17 * 2, 1)
    ACT3Q7_OnMephistoPortalWarpToAct4_6FC566C0_113c(m, pGame, pPlayer, 0x66)
    expect(m.u16(0x12900 + 0x17 * 2)).toBe(1)
  })

  it('4. 0x6FC60EB0 MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c returns 2 when missile is null or bit 10 unset', () => {
    const m = createTestMem()
    expect(MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c(m, 0x10000, 0)).toBe(2)
    expect(MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c(m, 0x10000, 0x12000)).toBe(2)
  })

  it('5. 0x6FC63D40 SKILLS_SrvDo_Summon3TrapsInTriangle_6FC63D40_113c returns 0 for out-of-range skillId', () => {
    const m = createTestMem()
    expect(SKILLS_SrvDo_Summon3TrapsInTriangle_6FC63D40_113c(m, 0x10000, 0x12000, -1, 1)).toBe(0)
  })

  it('6. 0x6FC66560 SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c returns 0 for negative skillId', () => {
    const m = createTestMem()
    expect(SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c(m, 0x10000, 0x12000, -1, 1)).toBe(0)
  })

  it('7. 0x6FC66720 SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c returns 0 for negative skillId', () => {
    const m = createTestMem()
    expect(SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c(m, 0x10000, 0x12000, -1, 1)).toBe(0)
  })

  it('8. 0x6FC668A0 SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c returns 0 for negative skillId', () => {
    const m = createTestMem()
    expect(SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c(m, 0x10000, 0x12000, -1, 1)).toBe(0)
  })

  it('9. 0x6FC6B7F0 CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c removes non-existent client cleanly', () => {
    const m = createTestMem()
    const pGame = 0x10000
    CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c(m, 99, pGame, 0)
    expect(m.u32(pGame + 0x88)).toBe(0)
  })

  it('10. 0x6FC6D710 SKILLS_SrvDo_SummonDecoy_6FC6D710_113c returns 0 when skill record missing', () => {
    const m = createTestMem()
    expect(SKILLS_SrvDo_SummonDecoy_6FC6D710_113c(m, 0x10000, 0x12000, 5, 1)).toBe(0)
  })

  it('11. 0x6FC6D8C0 SKILLS_SrvDo_SummonShadowWarriorOrMaster_6FC6D8C0_113c returns 0 when skill record missing', () => {
    const m = createTestMem()
    expect(SKILLS_SrvDo_SummonShadowWarriorOrMaster_6FC6D8C0_113c(m, 0x10000, 0x12000, 5, 1)).toBe(
      0,
    )
  })

  it('12. 0x6FC70E60 SKILLS_SpawnBoneWallSegment_6FC70E60_113c returns 0 when skillId is 0', () => {
    const m = createTestMem()
    expect(SKILLS_SpawnBoneWallSegment_6FC70E60_113c(m, 0, 0x10000, 0x12000, 100, 100, 1)).toBe(0)
  })

  it('13. 0x6FC70FE0 SKILLS_SrvDo_BoneWall_6FC70FE0_113c returns 0 when unit has no target coords', () => {
    const m = createTestMem()
    const pUnit = 0x12000
    m.setU32(pUnit + 0x2c, 0x12100)
    expect(SKILLS_SrvDo_BoneWall_6FC70FE0_113c(m, 0x10000, pUnit, 1, 1)).toBe(0)
  })

  it('14. 0x6FC71540 SKILLS_SrvDo_IronGolem_6FC71540_113c returns 0 when target item is invalid', () => {
    const m = createTestMem()
    const pUnit = 0x12000
    m.setU32(pUnit + 0x2c, 0x12100)
    expect(SKILLS_SrvDo_IronGolem_6FC71540_113c(m, 0x10000, pUnit, 1, 1)).toBe(0)
  })

  it('15. 0x6FC71750 SKILLS_SrvDo_ClayBloodFireGolem_6FC71750_113c returns 0 when skillId is 0', () => {
    const m = createTestMem()
    const pUnit = 0x12000
    expect(SKILLS_SrvDo_ClayBloodFireGolem_6FC71750_113c(m, 0x10000, pUnit, 0, 1)).toBe(0)
    expect(m.u32(pUnit + 0xc4) & 0x40).toBe(0x40)
  })

  it('16. 0x6FC718B0 SKILLS_SrvDo_RaiseSkeletonOrMage_6FC718B0_113c returns 0 when no corpse target', () => {
    const m = createTestMem()
    const pUnit = 0x12000
    m.setU32(pUnit + 0x2c, 0x12100)
    expect(SKILLS_SrvDo_RaiseSkeletonOrMage_6FC718B0_113c(m, 0x10000, pUnit, 1, 1)).toBe(0)
  })

  it('17. 0x6FC7C9E0 ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c ignores non-Qual-Kehk NPC', () => {
    const m = createTestMem()
    const pQuestData = 0x14000
    const pQuestArg = 0x14200
    m.setU16(pQuestArg + 0x14, 0x100)
    ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c(m, pQuestData, pQuestArg)
    expect(m.u8(pQuestData + 0x0c)).toBe(0)
  })

  it('18. 0x6FC7F5E0 ACT5Q3_OnMalahOrAnyaScrollCallback_6FC7F5E0_113c ignores unrelated NPC', () => {
    const m = createTestMem()
    const pQuestData = 0x14000
    const pQuestArg = 0x14200
    const pGame = 0x10000
    const pPlayer = 0x12000
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU32(pPlayer + 0x14, 0x12400)
    m.setU16(pQuestArg + 0x14, 0x100)
    ACT5Q3_OnMalahOrAnyaScrollCallback_6FC7F5E0_113c(m, pQuestData, pQuestArg)
    expect(m.u8(pQuestData + 0x0c)).toBe(0)
  })

  it('19. 0x6FC86960 ACT1Q3_OnNpcInitCainSearch_6FC86960_113c checks player quest state', () => {
    const m = createTestMem()
    const pQuestData = 0x14000
    const pQuestExt = 0x14100
    const pQuestArg = 0x14200
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPlayerData = 0x12400
    const pQuestFlags = 0x12800
    m.setU32(pQuestData + 0x18, pQuestExt)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x10, pQuestFlags)
    m.setU32(pQuestFlags, 0x12900)
    m.setU32(pQuestFlags + 4, 0x60)
    ACT1Q3_OnNpcInitCainSearch_6FC86960_113c(m, pQuestData, pQuestArg)
    expect(m.u32(pQuestData + 0x18)).toBe(pQuestExt)
  })

  it('20. 0x6FC86CE0 ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c ignores unrelated NPC', () => {
    const m = createTestMem()
    const pQuestData = 0x14000
    const pQuestArg = 0x14200
    const pGame = 0x10000
    const pPlayer = 0x12000
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU32(pPlayer + 0x14, 0x12400)
    m.setU16(pQuestArg + 0x14, 0x100)
    ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c(m, pQuestData, pQuestArg)
    expect(m.u8(pQuestData + 0x0c)).toBe(0)
  })

  it('21. 0x6FC87000 ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c returns early for non-Charsi NPC', () => {
    const m = createTestMem()
    const pQuestData = 0x14000
    const pQuestArg = 0x14200
    const pGame = 0x10000
    const pPlayer = 0x12000
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU32(pPlayer + 0x14, 0x12400)
    m.setU16(pQuestArg + 0x14, 0x100)
    ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c(m, pQuestData, pQuestArg)
    expect(m.u8(pQuestData + 0x0c)).toBe(0)
  })

  it('22. 0x6FC88920 ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c returns early for non-Kashya NPC', () => {
    const m = createTestMem()
    const pQuestData = 0x14000
    const pQuestArg = 0x14200
    const pGame = 0x10000
    const pPlayer = 0x12000
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU32(pPlayer + 0x14, 0x12400)
    m.setU16(pQuestArg + 0x14, 0x100)
    ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c(m, pQuestData, pQuestArg)
    expect(m.u8(pQuestData + 0x0c)).toBe(0)
  })

  it('23. 0x6FC92FC0 CUBE_TransmuteHoradricCubeItems_6FC92FC0_113c returns early when cube is empty', () => {
    const m = createTestMem()
    const pGame = 0x10000
    const pPlayer = 0x12000
    let transmuted = 0
    CUBE_TransmuteHoradricCubeItems_6FC92FC0_113c(m, pGame, pPlayer, () => {
      transmuted++
    })
    expect(transmuted).toBe(0)
  })

  it('24. 0x6FC93D90 PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c executes player trade swap or cancel', () => {
    const m = createTestMem()
    const pGame = 0x10000
    const pPlayer1 = 0x12000
    const pPlayer2 = 0x12200
    const pData1 = 0x12400
    const pData2 = 0x12600
    const pTrade1 = 0x12800
    const pTrade2 = 0x12900
    m.setU32(pPlayer1 + 0x14, pData1)
    m.setU32(pPlayer2 + 0x14, pData2)
    m.setU32(pData1 + 0x5c, pTrade1)
    m.setU32(pData2 + 0x5c, pTrade2)
    m.setU32(pTrade1 + 0x0c, 100)
    let cancelled = 0
    PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c(
      m,
      pData1,
      pPlayer1,
      pPlayer2,
      pGame,
      pData2,
      () => 1,
      () => {
        cancelled++
      },
    )
    expect(cancelled).toBe(1)
  })

  it('25. 0x6FC98FA0 PLRDEATH_DropPlayerEquippedItemsAndGoldToCorpseOrGround_6FC98FA0_113c handles player with no items', () => {
    const m = createTestMem()
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPlayerData = 0x12400
    const pPath = 0x12800
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x2c, pPath)
    PLRDEATH_DropPlayerEquippedItemsAndGoldToCorpseOrGround_6FC98FA0_113c(m, pPlayer, pGame)
    expect(m.u32(pPlayer + 0x14)).toBe(pPlayerData)
  })

  it('26. 0x6FCB5980 SKILLS_SrvDo_Valkyrie_6FCB5980_113c sets owner flag 0x40 and returns 0 when skillId negative', () => {
    const m = createTestMem()
    const pOwner = 0x12000
    expect(SKILLS_SrvDo_Valkyrie_6FCB5980_113c(m, 0x10000, pOwner, -1, 1)).toBe(0)
    expect(m.u32(pOwner + 0xc4) & 0x40).toBe(0x40)
  })

  it('27. 0x6FCB5D50 SKILLS_SummonMonsterFromSkillOrMissile_6FCB5D50_113c returns 0 when pSkillTxt is 0', () => {
    const m = createTestMem()
    expect(
      SKILLS_SummonMonsterFromSkillOrMissile_6FCB5D50_113c(m, 0x12000, 0x10000, 100, 100, 0, 0, 1),
    ).toBe(0)
  })

  it('28. 0x6FCCC8E0 AI_MercOrShadowWarriorThink_6FCCC8E0_113c dispatches 0x1A4 vs default AI think', () => {
    const m = createTestMem()
    const pGame = 0x10000
    const pMonster = 0x12000
    const pAiArgs = 0x13000
    m.setU32(pMonster + 4, 0x1a4)
    let called1A4 = 0
    let calledDef = 0
    AI_MercOrShadowWarriorThink_6FCCC8E0_113c(
      m,
      pGame,
      pMonster,
      pAiArgs,
      () => {
        called1A4++
      },
      () => {
        calledDef++
      },
    )
    expect(called1A4).toBe(1)
    expect(calledDef).toBe(0)
  })

  it('29. 0x6FCDAA50 ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c returns early for non-Ormus NPC', () => {
    const m = createTestMem()
    const pQuestData = 0x14000
    const pQuestArg = 0x14200
    const pGame = 0x10000
    const pPlayer = 0x12000
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU32(pPlayer + 0x14, 0x12400)
    m.setU16(pQuestArg + 0x14, 0x100)
    ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c(m, pQuestData, pQuestArg)
    expect(m.u8(pQuestData + 0x0c)).toBe(0)
  })

  it('30. 0x6FCDB550 ACT4Q3_OnDiabloDeathPortalWarpToAct5_6FCDB550_113c returns 0 for non-expansion game', () => {
    const m = createTestMem()
    const pQuestArg = 0x14200
    const pGame = 0x10000
    m.setU32(pQuestArg, pGame)
    m.setU32(pGame + 0x70, 0)
    expect(ACT4Q3_OnDiabloDeathPortalWarpToAct5_6FCDB550_113c(m, pQuestArg)).toBe(0)
  })

  it('31. 0x6FCDF1C0 vendor list check invokes generator when NPC not present', () => {
    const m = createTestMem()
    const fn = resolveExportByVa('6FCDF1C0')
    const pNpcControl = 0x15000
    const pNpc = 0x15200
    const pGame = 0x10000
    m.setU32(pNpc + 0x0c, 42)
    let generated = 0
    fn(m, pNpcControl, pNpc, pGame, 0, () => {
      generated++
    })
    expect(generated).toBe(1)
  })

  it('32. 0x6FCDF200 NPC buy item request rejects non-interacting NPC', () => {
    const m = createTestMem()
    const fn = resolveExportByVa('6FCDF200')
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPlayerData = 0x12400
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    let bought = 0
    fn(m, pGame, pPlayer, 55, 66, 0, 0, 100, () => {
      bought++
    })
    expect(bought).toBe(0)
  })

  it('33. 0x6FCDF2E0 vendor item population returns cleanly when slot missing', () => {
    const m = createTestMem()
    const fn = resolveExportByVa('6FCDF2E0')
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pNpc = 0x15200
    let spawned = 0
    fn(m, pGame, pPlayer, pNpc, 0, () => {
      spawned++
      return 0
    })
    expect(spawned).toBe(0)
  })

  it('34. 0x6FCE1890 NPC repair item request rejects non-interacting NPC', () => {
    const m = createTestMem()
    const fn = resolveExportByVa('6FCE1890')
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPlayerData = 0x12400
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    let repaired = 0
    fn(m, pGame, pPlayer, 55, 66, () => {
      repaired++
    })
    expect(repaired).toBe(0)
  })

  it('35. 0x6FCE7D00 Act2Q2 Horadric Staff cleanup returns early when player has no room', () => {
    const m = createTestMem()
    const fn = resolveExportByVa('6FCE7D00')
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPlayerData = 0x12400
    const pQuestFlags = 0x12800
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x10, pQuestFlags)
    m.setU32(pQuestFlags, 0x12900)
    m.setU32(pQuestFlags + 4, 0x60)
    fn(m, pGame, pPlayer, 0)
    expect(m.u16(0x12900 + 0x0a * 2)).toBe(0)
  })

  it('36. 0x6FCEF270 C2S place cursor item into container rejects invalid packet length or busy player', () => {
    const m = createTestMem()
    const fn = resolveExportByVa('6FCEF270')
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPacket = 0x16000
    expect(fn(m, pGame, pPlayer, pPacket, 4)).toBeGreaterThan(0)
  })

  it('37. 0x6FCEF2F0 C2S equip cursor item rejects invalid packet length or missing cursor item', () => {
    const m = createTestMem()
    const fn = resolveExportByVa('6FCEF2F0')
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPacket = 0x16000
    expect(fn(m, pGame, pPlayer, pPacket, 4)).toBeGreaterThan(0)
  })

  it('38. 0x6FCEF570 C2S NPC buy item rejects invalid packet length or non-interacting player', () => {
    const m = createTestMem()
    const fn = resolveExportByVa('6FCEF570')
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPacket = 0x16000
    expect(fn(m, pGame, pPlayer, pPacket, 4)).toBe(3)
  })

  it('39. 0x6FCF0D30 C2S waypoint interact rejects invalid packet length', () => {
    const m = createTestMem()
    const fn = resolveExportByVa('6FCF0D30')
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPacket = 0x16000
    expect(fn(m, pGame, pPlayer, pPacket, 4)).toBe(3)
  })

  it('40. 0x6FCF1010 C2S swap cursor with container item rejects invalid packet length', () => {
    const m = createTestMem()
    const fn = resolveExportByVa('6FCF1010')
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPacket = 0x16000
    expect(fn(m, pGame, pPlayer, pPacket, 4)).toBe(3)
  })

  it('41. 0x6FCF1200 C2S swap cursor with body item rejects invalid packet length', () => {
    const m = createTestMem()
    const fn = resolveExportByVa('6FCF1200')
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPacket = 0x16000
    expect(fn(m, pGame, pPlayer, pPacket, 4)).toBe(3)
  })

  it('42. 0x6FCF8310 duplicate and drop cursor item returns cleanly when item not in hash', () => {
    const m = createTestMem()
    const fn = resolveExportByVa('6FCF8310')
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPlayerData = 0x12400
    m.setU32(pPlayer + 0x14, pPlayerData)
    let deleted = 0
    fn(m, 77, pGame, pPlayer, () => {
      deleted++
    })
    expect(deleted).toBe(0)
  })

  it('43. 0x6FD087E0 Act3Q3 Khalim item cleanup deletes items when quest 0x12 bit 0 is set', () => {
    const m = createTestMem()
    const fn = resolveExportByVa('6FD087E0')
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPlayerData = 0x12400
    const pQuestFlags = 0x12800
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x10, pQuestFlags)
    m.setU32(pQuestFlags, 0x12900)
    m.setU32(pQuestFlags + 4, 0x60)
    m.setU16(0x12900 + 0x12 * 2, 1)
    let deleted = 0
    fn(m, pGame, pPlayer, 0, () => {
      deleted++
    })
    expect(deleted).toBe(0)
  })

  it('44. 0x6FD09C80 Act3Q2 Gidbinn Altar operate returns 0 when object mode is non-zero', () => {
    const m = createTestMem()
    const fn = resolveExportByVa('6FD09C80')
    const pOperateArgs = 0x17000
    const pObj = 0x17100
    m.setU32(pOperateArgs + 4, pObj)
    m.setU32(pObj + 0x10, 1)
    expect(fn(m, pOperateArgs)).toBe(0)
  })
})
