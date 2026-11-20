import { describe, expect, it } from 'vitest'
import { STATLIST_AllocList113c } from '../../../src/d2kern-113c/common/statlist.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import * as w6b2Exports from '../../../src/d2kern-113c/game/k2-w6b2-113c.ts'
import {
  ACT1Q3_SpawnCairnStonePortalLightning_6FC85E90_113c,
  ACT2Intro_InitQuestData_6FCE5730_113c,
  ACT2Q0_InitQuestData_6FCE5690_113c,
  ACT2Q2_ActiveFilter_6FCE5440_113c,
  ACT2Q2_Callback00_NpcActivateCainHoradricDialog_6FCE5310_113c,
  ACT2Q2_Callback_UnitDropOrDestroyHoradricItem_6FCE23C0_113c,
  ACT2Q7_InitQuestData_6FCE5790_113c,
  ACT2Q8_InitQuestData_6FCE4880_113c,
  ACT4Q3_PropagateQuestCompletionToPartyCallback_6FCDA490_113c,
  AURAS_ApplyRadialDamageWithDefaultFilter_6FCC1240_113c,
  ITEMS_DispatchCommandFlagPacketsToClient_6FCBB630_113c,
  ITEMS_UseAntidoteOrThawingCurePotion_6FCCF370_113c,
  MONAI_BarricadeTauntAndAttackThink_6FCC80C0_113c,
  MONAI_CanShadowCastSkillInContext_6FCC44C0_113c,
  MONAI_DeathSentryTrapThink_6FCC7C20_113c,
  MONAI_InitShadowMasterClassSkills_6FCC4320_113c,
  MONAI_PutridDefilerImpregnateThink_6FCA5500_113c,
  MONAI_SkirmishApproachFleeAttackThink_6FCA51E0_113c,
  MONAI_StationaryMeleeWithin25ThinkA_6FCC8270_113c,
  MONAI_StationaryMeleeWithin25ThinkB_6FCC8350_113c,
  MONAI_StationarySentryTrapThink_6FCC7DC0_113c,
  NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c,
  NPCS_ResetVendorSlotInventory_6FCB02E0_113c,
  NPC_HealPlayerAndPetsOnInteract_6FCDD490_113c,
  NPC_RefreshHirelingVendorRosterIfExhausted_6FCDD160_113c,
  NPC_SendHirelingListPacketsToClient_6FCDD330_113c,
  OBJ_OperateWell_6FC8CEE0_113c,
  PETS_CleanupOrMarkDeadPetSlot_6FCB7420_113c,
  PETS_KillAllPetsInSlotAndClear_6FCB64B0_113c,
  PETS_RemovePetFromSlotByGuid_6FCB7920_113c,
  SKILLS_ApplyRadialAuraStatsAndBlindAiCallback_6FCB3850_113c,
  SKILLS_AuraDo_TickBladeShieldRadialDamage_6FCB35F0_113c,
  SKILLS_CanConvertMonsterAndRollChance_6FCB88B0_113c,
  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c,
  SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c,
  SKILLS_RollMonsterConversionChance_6FCB1610_113c,
  SKILLS_SrvDo_ApplyChargeScaledRadialSkillDamage_6FCB2CF0_113c,
  SKILLS_SrvDo_DragonClawDualStrike_6FCB3270_113c,
  SKILLS_SrvDo_DragonTailFireSplash_6FCB3110_113c,
  SKILLS_SrvDo_DualClawProgressiveChargeAttack_6FCB61A0_113c,
  SKILLS_SrvDo_ExecuteEventsAndTargetRadialDamage_6FCB3340_113c,
  SKILLS_SrvDo_MonsterOrFeralRageMeleeHit_6FCD41B0_113c,
  SKILLS_SrvDo_MonsterSmiteAndProgressiveCharge_6FCD6790_113c,
  SKILLS_SrvDo_SpawnChargeScaledScatteredProjectiles_6FCB4DC0_113c,
  SKILLS_SrvDo_SpawnChargedProjectileAtTarget_6FCB2230_113c,
} from '../../../src/d2kern-113c/game/k2-w6b2-113c.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function allocGame(m: SparseMemory113c): number {
  const pGame = m.alloc(0x2000) >>> 0
  EVENT_InitTimerQueue113c(m, pGame)
  return pGame
}

function allocClient(m: SparseMemory113c, pGame: number): number {
  const pClient = m.alloc(0x600) >>> 0
  const pQueue = m.alloc(0x410) >>> 0
  m.setU32((pClient + 0x04) >>> 0, 4)
  m.setU32((pClient + 0x1a8) >>> 0, pGame >>> 0)
  m.setU32((pClient + 0x1bc) >>> 0, pQueue)
  return pClient
}

function setupDataTables(m: SparseMemory113c): {
  pDataTables: number
  pSkillsTxt: number
  pMonStatsTxt: number
  pItemsTxt: number
} {
  const pDataTables = m.alloc(0x1000) >>> 0
  const pDataTablesPtr = m.alloc(4) >>> 0
  m.setU32(0x6fd1829c, pDataTablesPtr)
  m.setU32(pDataTablesPtr, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)

  const pSkillsTxt = m.alloc(0x23c * 8) >>> 0
  const pMonStatsTxt = m.alloc(0x1a8 * 8) >>> 0
  const pItemsTxt = m.alloc(0x1a8 * 8) >>> 0
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 8)
  m.setU32(pDataTables + 0xbd4, 400)
  m.setU32(pDataTables + 0xc4, 200)
  m.setU32(pDataTables + 0xbe8, 128)
  m.setU32(pDataTables + 0xbf0, 5)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, 8)
  m.setU32(pDataTables + 0x150, m.alloc(0x40))
  m.setU32(pDataTables + 0x154, m.alloc(0x40))
  m.setU32(pDataTables + 0x00, pItemsTxt)
  m.setU32(pDataTables + 0x04, 8)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32(0x6fdefb94, 8)

  const pHirelingTxt = m.alloc(0x200) >>> 0
  m.setU32(0x6fdf0078, pHirelingTxt)
  m.setU32(0x6fdf007c, 1)
  m.setU16(pHirelingTxt + 0x00, 0)
  m.setU32(pHirelingTxt + 0x10, 1)
  m.setU32(pHirelingTxt + 0x14, 150)
  m.setU16(pHirelingTxt + 0x114, 10)
  m.setU16(pHirelingTxt + 0x116, 12)

  const pBitMasks = m.alloc(0x80) >>> 0
  for (let i = 0; i < 32; i++) {
    m.setU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(0x6fd18be0, pBitMasks)
  m.setU32(0x6fdd90b0, pBitMasks)
  return { pDataTables, pSkillsTxt, pMonStatsTxt, pItemsTxt }
}

describe('K2 Wave 6 Batch 2 (w6b2: 45 D2Game.dll 1.13c VAs 0x6FC85E90..0x6FCE5790)', () => {
  it('exports all 45 target functions', () => {
    const fnList = Object.values(w6b2Exports).filter((v) => typeof v === 'function')
    expect(fnList.length).toBe(45)
  })

  it('[1..6] Cairn Stones, Well operate, Skirmish/Putrid AI, Packet 0x7F, Vendor slot reset', () => {
    const m = new SparseMemory113c()
    const { pMonStatsTxt } = setupDataTables(m)
    const pGame = allocGame(m)
    const pClient = allocClient(m, pGame)

    const pQuestData = m.alloc(0x100)
    const pQuestState = m.alloc(0x140)
    m.setU32(pQuestData + 0x04, pGame)
    ACT1Q3_SpawnCairnStonePortalLightning_6FC85E90_113c(m, pQuestData, pQuestState)

    const pOp = m.alloc(0x40)
    const pObj = m.alloc(0x100)
    const pObjData = m.alloc(0x40)
    const pObjTxt = m.alloc(0x200)
    const pPlr = m.alloc(0x100)
    const pPlrData = m.alloc(0xa8)
    m.setU32(pPlr + 0x00, 0)
    m.setU32(pPlr + 0x0c, 5)
    m.setU32(pPlr + 0x14, pPlrData)
    m.setU32(pObj + 0x00, 2)
    m.setU32(pObj + 0x10, 2)
    m.setU32(pObj + 0x14, pObjData)
    m.setU32(pObjData + 0x00, pObjTxt)
    m.setU32(pOp + 0x00, pGame)
    m.setU32(pOp + 0x04, pObj)
    m.setU32(pOp + 0x08, pPlr)
    expect(OBJ_OperateWell_6FC8CEE0_113c(m, pOp)).toBe(0)

    const pMon = m.alloc(0x100)
    const pMonData = m.alloc(0x60)
    const pAiCtrl = m.alloc(0x40)
    const pAiParam = m.alloc(0x30)
    m.setU32(pMon + 0x00, 1)
    m.setU32(pMon + 0x14, pMonData)
    m.setU32(pMonData + 0x2c, pAiCtrl)
    m.setU32(pAiParam + 0x00, pAiCtrl)
    m.setU32(pAiParam + 0x1c, pMonStatsTxt)
    MONAI_SkirmishApproachFleeAttackThink_6FCA51E0_113c(m, pGame, pMon, pAiParam)
    MONAI_PutridDefilerImpregnateThink_6FCA5500_113c(m, pGame, pMon, pAiParam)

    m.setU8(pClient + 0x3d4, 1)
    m.setU32(pClient + 0x174, pPlr)
    NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c(m, pClient, pPlr)

    const pNpcSlot = m.alloc(0x30)
    const pNpcUnit = m.alloc(0x100)
    NPCS_ResetVendorSlotInventory_6FCB02E0_113c(m, pGame, pNpcSlot, pNpcUnit)
    expect(m.u32(pNpcSlot + 0x04)).toBeGreaterThan(0)
    expect(m.u32(pNpcUnit + 0x60)).toBe(m.u32(pNpcSlot + 0x04))
  })

  it('[7..16] Conversion, Assassin charge-ups, Blade Shield, Cloak of Shadows, Dual Claw', () => {
    const m = new SparseMemory113c()
    setupDataTables(m)
    const pGame = allocGame(m)
    const pAttacker = m.alloc(0x100)
    const pTarget = m.alloc(0x100)
    const pPath = m.alloc(0x200)
    m.setU32(pAttacker + 0x2c, pPath)
    m.setU32(pTarget + 0x00, 1)

    expect(SKILLS_RollMonsterConversionChance_6FCB1610_113c(m, pAttacker, pAttacker, 50)).toBe(0)
    expect(SKILLS_SrvDo_SpawnChargedProjectileAtTarget_6FCB2230_113c(m, pGame, pAttacker, 1, 0)).toBe(0)
    expect(
      SKILLS_SrvDo_ApplyChargeScaledRadialSkillDamage_6FCB2CF0_113c(m, pGame, pAttacker, 1, 1),
    ).toBe(1)
    expect(SKILLS_SrvDo_DragonTailFireSplash_6FCB3110_113c(m, pGame, pAttacker, 1, 1)).toBe(0)
    expect(SKILLS_SrvDo_DragonClawDualStrike_6FCB3270_113c(m, pGame, pAttacker, 1, 1)).toBe(0)
    expect(
      SKILLS_SrvDo_ExecuteEventsAndTargetRadialDamage_6FCB3340_113c(m, pGame, pAttacker, 1, 1),
    ).toBe(0)
    expect(SKILLS_AuraDo_TickBladeShieldRadialDamage_6FCB35F0_113c(m, pGame, pAttacker, 1, 1)).toBe(0)

    const pAuraCtx = m.alloc(0x20)
    const pDesc = m.alloc(0x40)
    m.setU32(pAuraCtx + 0x0c, pDesc)
    expect(SKILLS_ApplyRadialAuraStatsAndBlindAiCallback_6FCB3850_113c(m, pAuraCtx, 0)).toBe(0)
    expect(
      SKILLS_SrvDo_SpawnChargeScaledScatteredProjectiles_6FCB4DC0_113c(m, pGame, pAttacker, 1, 1),
    ).toBe(0)
    expect(SKILLS_SrvDo_DualClawProgressiveChargeAttack_6FCB61A0_113c(m, pGame, pAttacker, 1, 1)).toBe(1)
  })

  it('[17..26] Pet slot cleanup/remove, conversion roll, item command packets, radial damage, Shadow AI', () => {
    const m = new SparseMemory113c()
    setupDataTables(m)
    const pGame = allocGame(m)
    const pClient = allocClient(m, pGame)
    const pPlayer = m.alloc(0x100)
    const pPath = m.alloc(0x200)
    m.setU32(pPlayer + 0x2c, pPath)
    const pPetSlot = m.alloc(0x20)

    PETS_KillAllPetsInSlotAndClear_6FCB64B0_113c(m, pGame, pPetSlot)
    expect(m.u32(pPetSlot)).toBe(0)

    PETS_CleanupOrMarkDeadPetSlot_6FCB7420_113c(m, pGame, pPlayer, pPetSlot, 1, 0)
    PETS_RemovePetFromSlotByGuid_6FCB7920_113c(m, pGame, 99, pPetSlot, 1)

    const pMon = m.alloc(0x100)
    m.setU32(pMon + 0x00, 1)
    expect(SKILLS_CanConvertMonsterAndRollChance_6FCB88B0_113c(m, -1, pMon, pPlayer, 1, 0)).toBe(0)

    const pItem = m.alloc(0x100)
    m.setU32(pItem + 0x00, 4)
    m.setU8(pClient + 0x3d4, 1)
    m.setU32(pClient + 0x174, pPlayer)
    expect(ITEMS_DispatchCommandFlagPacketsToClient_6FCBB630_113c(m, pItem, pPlayer, pClient)).toBe(0)

    const pDmg = m.alloc(0x70)
    expect(
      AURAS_ApplyRadialDamageWithDefaultFilter_6FCC1240_113c(m, 0, 0, pDmg, pGame, 10, 10, 5),
    ).toBe(1)
    expect(
      SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c(
        m,
        0,
        pPlayer,
        pGame,
        -1,
        1,
        1,
        0,
        0,
        0,
        0,
      ),
    ).toBe(0)
    expect(
      SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
        m,
        pGame,
        -1,
        pPlayer,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
      ),
    ).toBe(0)

    const pAiCtrl = m.alloc(0x40)
    const pAiParam = m.alloc(0x30)
    m.setU32(pAiParam + 0x00, pAiCtrl)
    MONAI_InitShadowMasterClassSkills_6FCC4320_113c(m, pGame, pMon, pAiParam)
    expect(m.u32(pAiCtrl + 0x1c)).toBe(1)
    expect(MONAI_CanShadowCastSkillInContext_6FCC44C0_113c(m, pGame, pMon, -1, pPlayer, 0)).toBe(0)
  })

  it('[27..35] Sentry/Barricade/Turret AI, Cure potion, Monster melee/Smite SrvDo, Act4Q3 party', () => {
    const m = new SparseMemory113c()
    const { pMonStatsTxt } = setupDataTables(m)
    const pGame = allocGame(m)
    const pMon = m.alloc(0x100)
    const pMonData = m.alloc(0x60)
    const pAiCtrl = m.alloc(0x40)
    const pAiParam = m.alloc(0x30)
    m.setU32(pMon + 0x00, 1)
    m.setU32(pMon + 0x14, pMonData)
    m.setU32(pMonData + 0x2c, pAiCtrl)
    m.setU32(pAiParam + 0x00, pAiCtrl)
    m.setU32(pAiParam + 0x1c, pMonStatsTxt)

    MONAI_DeathSentryTrapThink_6FCC7C20_113c(m, pGame, pMon, pAiParam)
    MONAI_StationarySentryTrapThink_6FCC7DC0_113c(m, pGame, pMon, pAiParam)
    MONAI_BarricadeTauntAndAttackThink_6FCC80C0_113c(m, pGame, pMon, pAiParam)
    MONAI_StationaryMeleeWithin25ThinkA_6FCC8270_113c(m, pGame, pMon, pAiParam)
    MONAI_StationaryMeleeWithin25ThinkB_6FCC8350_113c(m, pGame, pMon, pAiParam)

    expect(
      ITEMS_UseAntidoteOrThawingCurePotion_6FCCF370_113c(m, pGame, pMon, 0, 0, 0, 0, 0),
    ).toBe(0)
    expect(SKILLS_SrvDo_MonsterOrFeralRageMeleeHit_6FCD41B0_113c(m, pGame, pMon, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo_MonsterSmiteAndProgressiveCharge_6FCD6790_113c(m, pGame, pMon, 1, 1)).toBe(0)

    const pPlayer = m.alloc(0x100)
    const pPlrData = m.alloc(0xa8)
    const pQuestHist = m.alloc(0x80)
    m.setU32(pQuestHist, m.alloc(0x80))
    m.setU32(pPlayer + 0x00, 0)
    m.setU32(pPlayer + 0x14, pPlrData)
    m.setU32(pPlrData + 0x10, pQuestHist)
    expect(ACT4Q3_PropagateQuestCompletionToPartyCallback_6FCDA490_113c(m, pGame, pPlayer, 0)).toBe(0)
  })

  it('[36..45] Hireling roster refresh/send, NPC heal on interact, and Act 2 quest callbacks/initializers', () => {
    const m = new SparseMemory113c()
    setupDataTables(m)
    const pGame = allocGame(m)
    const pClient = allocClient(m, pGame)
    const pNpcSlot = m.alloc(0x30)
    const pRoster = m.alloc(0x200)
    m.setU32(pNpcSlot + 0x10, pRoster)
    m.setU32(pRoster + 0x0c, 1)
    m.setU32(pRoster + 0x08, 0)

    NPC_RefreshHirelingVendorRosterIfExhausted_6FCDD160_113c(m, pGame, pNpcSlot, 150)
    expect(m.u32(pNpcSlot + 0x10)).toBe(pRoster)

    const pNpc = m.alloc(0x100)
    m.setU32(pNpc + 0x00, 1)
    m.setU32(pNpc + 0x04, 100)
    NPC_SendHirelingListPacketsToClient_6FCDD330_113c(m, pNpc, pGame, pClient)

    const pPlayer = m.alloc(0x100)
    const pPlrData = m.alloc(0xa8)
    const pQuestFlags = m.alloc(0x80)
    m.setU32(pQuestFlags, m.alloc(0x80))
    m.setU32(pPlayer + 0x00, 0)
    m.setU32(pPlayer + 0x14, pPlrData)
    m.setU32(pPlrData + 0x10, pQuestFlags)
    const pStatList = STATLIST_AllocList113c(m, 0, 0x40, 0, pPlayer, 0)
    m.setU32(pPlayer + 0x5c, pStatList)
    NPC_HealPlayerAndPetsOnInteract_6FCDD490_113c(m, pPlayer, pGame, pNpc)

    const pQuestData = m.alloc(0x100)
    const pQuestState = m.alloc(0x40)
    const pQuestArg = m.alloc(0x30)
    const pHoradricItem = m.alloc(0x100)
    m.setU32(pHoradricItem + 0x00, 4)
    m.setU32(pHoradricItem + 0x04, 0)
    m.setU32(pQuestArg + 0x00, pGame)
    m.setU32(pQuestArg + 0x04, pPlayer)
    m.setU32(pQuestArg + 0x08, pHoradricItem)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU32(pQuestData + 0x04, pGame)
    m.setU32(pQuestData + 0x18, pQuestState)
    m.setU8(pQuestState + 0x2b, 1)
    ACT2Q2_Callback_UnitDropOrDestroyHoradricItem_6FCE23C0_113c(m, pQuestData, pQuestArg)

    const pQ8 = m.alloc(0x100)
    m.setU32(pQ8 + 0x04, pGame)
    ACT2Q8_InitQuestData_6FCE4880_113c(m, pQ8)
    expect(m.u32(pQ8 + 0xe0)).toBe(0x1f)

    ACT2Q2_Callback00_NpcActivateCainHoradricDialog_6FCE5310_113c(m, pQuestData, pQuestArg)
    expect(ACT2Q2_ActiveFilter_6FCE5440_113c(m, pQuestData, 100, pPlayer, pQuestFlags, 0)).toBe(0)

    const pQ0 = m.alloc(0x100)
    m.setU32(pQ0 + 0x04, pGame)
    ACT2Q0_InitQuestData_6FCE5690_113c(m, pQ0)
    expect(m.u32(pQ0 + 0xe0)).toBe(0x08)

    const pQIntro = m.alloc(0x100)
    m.setU32(pQIntro + 0x04, pGame)
    ACT2Intro_InitQuestData_6FCE5730_113c(m, pQIntro)
    expect(m.u32(pQIntro + 0xe0)).toBe(0x2a)

    const pQ7 = m.alloc(0x100)
    m.setU32(pQ7 + 0x04, pGame)
    ACT2Q7_InitQuestData_6FCE5790_113c(m, pQ7)
    expect(m.u32(pQ7 + 0xe0)).toBe(0x1e)
  })
})
