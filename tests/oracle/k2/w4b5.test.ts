import { describe, expect, it } from 'vitest'
import { STATLIST_AllocList113c } from '../../../src/d2kern-113c/common/statlist.ts'
import * as w4b5Exports from '../../../src/d2kern-113c/game/k2-w4b5-113c.ts'
import {
  AURAS_ApplyPulseBuffAndDamageCallback_6FCBA7C0_113c,
  AURAS_ApplyUndeadPulseBuffAndDamageCallback_6FCBA630_113c,
  AURAS_RedemptionCorpseCallback_6FCB8680_113c,
  INVENTORY_FreeAllItems_6FCAF470_113c,
  ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c,
  ITEMS_SendPacket9C_Cmd38Or39_6FCADDA0_113c,
  MISSILES_BuildRandomizedSpiralPath_6FCB1040_113c,
  MONSTER_ShouldSyncBossLifeBarDelta_6FCAD500_113c,
  NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c,
  NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c,
  NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c,
  NET_SendPacket82_PortalOwnerInfo_6FCAD040_113c,
  NET_SendPacketMonsterMoveCoord_6FCAD860_113c,
  NET_SendPacketMonsterTargetUnit_6FCAD990_113c,
  NPCS_CloneMercAndVendorStaticTables_6FCAF4E0_113c,
  NPCS_QueueOrFreeVendorItem_6FCB0260_113c,
  NPCS_RecordEvent4ForActiveNpcSlots_6FCAF720_113c,
  NPCS_UpdateTownVendorSlotsOnPlayerLeave_6FCB0560_113c,
  PARTY_CountSubPartyMembers_6FCBBF40_113c,
  PARTY_CreateAndLinkSubParty_6FCBBF70_113c,
  PARTY_DistributeGoldPickupAndReturnRemainder_6FCBC270_113c,
  PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c,
  PETS_FindPetArgByGuid_6FCB6570_113c,
  PETS_FindPetTypeByGuid_6FCB6600_113c,
  PETS_ForEachPlayerPetUnit_6FCB6AF0_113c,
  PETS_GetFirstPetUnitByType_6FCB6A40_113c,
  PETS_SendPacket7A_UnsummonPet_6FCB6810_113c,
  PETS_SendPetOrMercAssignPacket_6FCB66E0_113c,
  PETS_WarpPetUnitToRoomAndCoord_6FCB71F0_113c,
  SKILLS_AddProgressiveChargeStage_6FCB5370_113c,
  SKILLS_ApplyDelayedChargeAttackRatingBonus_6FCB1400_113c,
  SKILLS_ApplyDelayedChargeDamageMultiplier_6FCB1F10_113c,
  SKILLS_ApplyMonsterSkillBuffAndUMod_6FCB1660_113c,
  SKILLS_ApplyRadialDamageCallback_6FCB3040_113c,
  SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c,
  SKILLS_FindClosestTargetInRadius3_6FCB8E30_113c,
  SKILLS_RestoreConvertedMonsterAlignmentAndStats_6FCB14F0_113c,
  SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c,
  SKILLS_RollUnitWeaponBasePhysicalDamage256ths_6FCB87D0_113c,
  SKILLS_ScalePoisonAndCurseDurations_6FCB9B60_113c,
  SKILLS_SrvDo_ApplySacrificeSelfDamage_6FCB9290_113c,
  SKILLS_SrvDo_SpawnChargedMissileAtTargetUnit_6FCB93A0_113c,
  SKILLS_SrvDo_SpawnChargedNovaOnTarget_6FCB5040_113c,
  SKILLS_TryRedeemCorpseHealLifeAndMana_6FCB8490_113c,
  STATES_RemoveFreezeOrShatterStateCallback_6FCB85D0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b5-113c.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function allocClient(m: SparseMemory113c, pGame: number): number {
  const pClient = m.alloc(0x600) >>> 0
  const pQueue = m.alloc(0x410) >>> 0
  m.setU32((pClient + 0x04) >>> 0, 4)
  m.setU32((pClient + 0x1a8) >>> 0, pGame >>> 0)
  m.setU32((pClient + 0x1bc) >>> 0, pQueue)
  return pClient
}

function setupDataTables(m: SparseMemory113c): { pDataTables: number; pSkillsTxt: number } {
  const pDataTables = m.alloc(0x1000) >>> 0
  const pDataTablesPtr = m.alloc(4) >>> 0
  m.setU32(0x6fd1829c, pDataTablesPtr)
  m.setU32(pDataTablesPtr, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  const pSkillsTxt = m.alloc(0x23c * 4) >>> 0
  const pMonStatsTxt = m.alloc(0x1a8 * 4) >>> 0
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 4)
  m.setU32(pDataTables + 0xbd4, 400)
  m.setU32(pDataTables + 0xc4, 200)
  m.setU32(pDataTables + 0xbe8, 128)
  m.setU32(pDataTables + 0xbf0, 5)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, 4)
  m.setU32(pDataTables + 0x150, m.alloc(0x40))
  m.setU32(pDataTables + 0x154, m.alloc(0x40))
  const pBitMasks = m.alloc(0x80) >>> 0
  for (let i = 0; i < 32; i++) {
    m.setU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(0x6fd18be0, pBitMasks)
  return { pDataTables, pSkillsTxt }
}

describe('K2 Wave 4 Batch 5 (w4b5: 45 D2Game.dll 1.13c VAs 0x6FCAD040..0x6FCBC270)', () => {
  it('exports all 45 target functions', () => {
    const fnList = Object.values(w4b5Exports).filter((v) => typeof v === 'function')
    expect(fnList.length).toBe(45)
  })

  it('[1..5] S2C packet builders 0x82, 0x75, boss life bar sync, 0x22, 0x21', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x2000)
    const pClient = allocClient(m, pGame)

    const pPortal = m.alloc(0x100)
    const pField7C = m.alloc(0x20)
    m.setU32(pPortal + 0x00, 2)
    m.setU32(pPortal + 0x0c, 10)
    m.setU32(pPortal + 0x7c, pField7C)
    m.setU32(pField7C + 0x04, 77)
    m.setU32(pGame + 0x1520 + (10 & 0x7f) * 4, pPortal)

    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0xa8)
    m.setU8(pPlayerData, 0x41)
    m.setU32(pPlayer + 0x00, 0)
    m.setU32(pPlayer + 0x04, 2)
    m.setU32(pPlayer + 0x0c, 77)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x80, pGame)
    m.setU32(pPlayerData + 0x9c, pClient)
    m.setU32(pGame + 0x1120 + (77 & 0x7f) * 4, pPlayer)

    NET_SendPacket82_PortalOwnerInfo_6FCAD040_113c(m, pGame, 10, pClient, 30)
    // D2Game.dll@0x6FCAA3E0 returns queued byte count (`nPacketSize`) on success.
    expect(NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c(m, pPlayer, pPlayer)).toBe(13)

    const pBoss = m.alloc(0x100)
    const pMonData = m.alloc(0x60)
    m.setU32(pBoss + 0x00, 1)
    m.setU32(pBoss + 0x14, pMonData)
    expect(MONSTER_ShouldSyncBossLifeBarDelta_6FCAD500_113c(m, pBoss, 4096, pPlayer)).toBe(0)

    expect(NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(m, pClient, 0, 77, 12, 3)).toBe(12)
    NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c(m, pClient, pPlayer, 36, 5, 1)
  })

  it('[6..13] Monster move/target packets, 0x9C cmd38/39, inventory free, NPC vendor tables & queues', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x2000)
    const pClient = allocClient(m, pGame)
    const pMon = m.alloc(0x100)
    const pPath = m.alloc(0x100)
    m.setU32(pMon + 0x00, 1)
    m.setU32(pMon + 0x0c, 101)
    m.setU32(pMon + 0x2c, pPath)
    m.setU16(pPath + 0x02, 500)
    m.setU16(pPath + 0x06, 600)
    m.setU32(pGame + 0x1320 + (101 & 0x7f) * 4, pMon)
    NET_SendPacketMonsterMoveCoord_6FCAD860_113c(m, pClient, 0x67, 101, 1, 510, 610, 0, 0, 0)
    NET_SendPacketMonsterTargetUnit_6FCAD990_113c(m, pClient, 0x68, 101, 1, 0, 77, 0, 0, 0)

    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0xa8)
    m.setU32(pPlayer + 0x00, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x9c, pClient)
    const pItem = m.alloc(0x100)
    const pItemData = m.alloc(0x80)
    m.setU32(pItem + 0x00, 4)
    m.setU32(pItem + 0x14, pItemData)
    ITEMS_SendPacket9C_Cmd38Or39_6FCADDA0_113c(m, 0x00, pItem, pClient)
    expect(m.u32(pItemData + 0x18) & 0x38).toBe(0)

    const pInv = m.alloc(0x40)
    INVENTORY_FreeAllItems_6FCAF470_113c(m, pInv, pGame)

    const pSrc1 = m.alloc(12)
    const pSrc2 = m.alloc(4)
    m.setU32(0x6fd30200 + 0x08, pSrc1)
    m.setU32(0x6fd30200 + 0x0c, 1)
    m.setU32(0x6fd30200 + 0x10, pSrc2)
    m.setU32(0x6fd30200 + 0x14, 1)
    const pOutEntry = m.alloc(0x20)
    NPCS_CloneMercAndVendorStaticTables_6FCAF4E0_113c(m, 0, pGame, pOutEntry)
    expect(m.u32(pOutEntry)).toBeGreaterThan(0)
    expect(m.u32(pOutEntry + 0x08)).toBeGreaterThan(0)

    const pNpcCtrl = m.alloc(0x20)
    const pSlots = m.alloc(0x44 * 0x40)
    m.setU32(pGame + 0x1d24, pNpcCtrl)
    m.setU32(pNpcCtrl + 0x00, 1)
    m.setU32(pNpcCtrl + 0x04, pSlots)
    m.setU32(pSlots + 0x00, 0xffffffff)
    m.setU32(pSlots + 0x1c, 1)
    m.setU8(pSlots + 0x20, 1)
    m.setU8(pSlots + 0x23, 1)
    NPCS_RecordEvent4ForActiveNpcSlots_6FCAF720_113c(m, pGame, 555)
    expect(m.u32(pSlots + 0x14)).toBeGreaterThan(0)

    NPCS_QueueOrFreeVendorItem_6FCB0260_113c(m, pGame, 0, pItem, 3)
    NPCS_UpdateTownVendorSlotsOnPlayerLeave_6FCB0560_113c(m, pGame, pPlayer)
  })

  it('[14..20] Spiral missile path, charge stage calc, delayed charge AR/dmg, monster convert/buff, radial dmg', () => {
    const m = new SparseMemory113c()
    m.setU32(0x6fde4180 + 10 * 4, 0)
    m.setU32(0x6fde4138 + 10 * 4, 16)
    const pMissile = m.alloc(0x100)
    const pPath = m.alloc(0x200)
    m.setU32(pMissile + 0x00, 3)
    m.setU32(pMissile + 0x2c, pPath)
    MISSILES_BuildRandomizedSpiralPath_6FCB1040_113c(m, pMissile, 12345)

    const { pSkillsTxt } = setupDataTables(m)

    const pUnit = m.alloc(0x100)
    expect(SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c(m, pUnit, 1, 5)).toBe(0)

    const pStatList = STATLIST_AllocList113c(m, 0, 0, 1, 0, 0)
    const pDmg = m.alloc(0x70)
    SKILLS_ApplyDelayedChargeAttackRatingBonus_6FCB1400_113c(m, pUnit, pStatList, pDmg)
    SKILLS_ApplyDelayedChargeDamageMultiplier_6FCB1F10_113c(m, pUnit, pStatList, pDmg)

    const pGame = m.alloc(0x2000)
    const pMonster = m.alloc(0x100)
    m.setU32(pMonster + 0x00, 1)
    m.setU32(pMonster + 0x80, pGame)
    SKILLS_RestoreConvertedMonsterAlignmentAndStats_6FCB14F0_113c(m, pMonster, 20, 0)
    SKILLS_ApplyMonsterSkillBuffAndUMod_6FCB1660_113c(m, pSkillsTxt, pGame, pMonster, 1, 3)

    const pAuraCtx = m.alloc(0x20)
    const pSub = m.alloc(0x20)
    const pSrcDmg = m.alloc(0x70)
    m.setU32(pAuraCtx + 0x00, pGame)
    m.setU32(pAuraCtx + 0x04, pUnit)
    m.setU32(pAuraCtx + 0x0c, pSub)
    m.setU32(pSub + 0x00, pSrcDmg)
    m.setU16(pSub + 0x08, 1)
    expect(SKILLS_ApplyRadialDamageCallback_6FCB3040_113c(m, pAuraCtx, pMonster)).toBe(1)
  })

  it('[21..29] Charged nova/stage, PETS lookup/packets/iterators/warp', () => {
    const m = new SparseMemory113c()
    setupDataTables(m)
    const pGame = m.alloc(0x2000)
    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x100)
    const pPath = m.alloc(0x100)
    m.setU32(pPlayer + 0x00, 0)
    m.setU32(pPlayer + 0x0c, 7)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x2c, pPath)
    m.setU32(pPlayer + 0x80, pGame)

    expect(SKILLS_SrvDo_SpawnChargedNovaOnTarget_6FCB5040_113c(m, pGame, pPlayer, 1, 1)).toBe(0)
    expect(SKILLS_AddProgressiveChargeStage_6FCB5370_113c(m, pPlayer, pGame, -1, 1, 1, 1)).toBe(0)

    const pPlayerPets = m.alloc(8)
    const pListBase = m.alloc(0x40)
    const pPetEntry = m.alloc(0x40)
    m.setU32(pPlayerData + 0x44, pPlayerPets)
    m.setU32(pPlayerPets, pListBase)
    m.setU32(pListBase + 3 * 12, pPetEntry)
    m.setU32(pPetEntry + 0x00, 0)
    m.setU32(pPetEntry + 0x04, 999)
    m.setU32(pPetEntry + 0x08, 42)

    expect(PETS_FindPetArgByGuid_6FCB6570_113c(m, pPlayer, 999)).toBe((pPetEntry + 0x08) >>> 0)
    expect(PETS_FindPetTypeByGuid_6FCB6600_113c(m, pPlayer, 999)).toBe(3)

    const pClient = allocClient(m, pGame)
    m.setU32(pPlayerData + 0x9c, pClient)
    const pPetUnit = m.alloc(0x100)
    const pPetPath = m.alloc(0x100)
    m.setU32(pPetUnit + 0x00, 1)
    m.setU32(pPetUnit + 0x04, 150)
    m.setU32(pPetUnit + 0x0c, 999)
    m.setU32(pPetUnit + 0x2c, pPetPath)
    m.setU32(pPetUnit + 0x80, pGame)
    PETS_SendPetOrMercAssignPacket_6FCB66E0_113c(m, pPlayer, pPetEntry)
    // D2Game.dll@0x6FCAA3E0 returns queued byte count (13 for S2C 0x7A).
    expect(PETS_SendPacket7A_UnsummonPet_6FCB6810_113c(m, pPlayer, pPetEntry)).toBe(13)

    m.setU32(pGame + 0x1320 + (999 & 0x7f) * 4, pPetUnit)
    expect(PETS_GetFirstPetUnitByType_6FCB6A40_113c(m, pPlayer, 3, 0, pGame)).toBe(pPetUnit)

    let count = 0
    PETS_ForEachPlayerPetUnit_6FCB6AF0_113c(
      m,
      pGame,
      pPlayer,
      (_m, _g, _o, pUnit, arg) => {
        if (pUnit === pPetUnit && arg === 77) count++
      },
      77,
    )
    expect(count).toBe(1)

    PETS_WarpPetUnitToRoomAndCoord_6FCB71F0_113c(m, pPetUnit, 0, pGame, 0, 0)
  })

  it('[30..45] Redemption/states/mind blast/radius3/sacrifice/auras/items/party', () => {
    const m = new SparseMemory113c()
    setupDataTables(m)

    const pGame = m.alloc(0x2000)
    const pOwner = m.alloc(0x100)
    const pOwnerPath = m.alloc(0x100)
    m.setU32(pOwner + 0x2c, pOwnerPath)
    const pCorpse = m.alloc(0x100)
    m.setU32(pCorpse + 0x00, 1)
    m.setU32(pCorpse + 0x10, 1)
    m.setU32(pCorpse + 0x80, pGame)
    const pDummyItem = m.alloc(0x100)
    m.setU32(pDummyItem + 0x00, 4)
    const pAuraCtx = m.alloc(0x30)
    const pSub = m.alloc(0x60)
    m.setU32(pAuraCtx + 0x00, pGame)
    m.setU32(pAuraCtx + 0x04, pOwner)
    m.setU32(pAuraCtx + 0x08, 1)
    m.setU32(pAuraCtx + 0x0c, pSub)
    m.setU32(pSub + 0x00, 1)
    m.setU32(pSub + 0x04, 1)
    expect(SKILLS_TryRedeemCorpseHealLifeAndMana_6FCB8490_113c(m, pOwner, 1, pCorpse, 1, 0)).toBe(0)
    expect(AURAS_RedemptionCorpseCallback_6FCB8680_113c(m, pAuraCtx, pCorpse)).toBe(0)

    STATES_RemoveFreezeOrShatterStateCallback_6FCB85D0_113c(m, pDummyItem, -1, 0)
    expect(
      SKILLS_RollUnitWeaponBasePhysicalDamage256ths_6FCB87D0_113c(m, pOwner),
    ).toBeGreaterThanOrEqual(256)
    expect(() => SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c(m, 0, -1, 0)).toThrow()
    SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c(m, pCorpse, -1, 0)
    expect(SKILLS_FindClosestTargetInRadius3_6FCB8E30_113c(m, pGame, 0, pOwner)).toBe(0)
    expect(SKILLS_SrvDo_ApplySacrificeSelfDamage_6FCB9290_113c(m, pGame, pOwner, 1, 1)).toBe(0)
    expect(
      SKILLS_SrvDo_SpawnChargedMissileAtTargetUnit_6FCB93A0_113c(m, pGame, pOwner, 1, 1),
    ).toBe(0)

    expect(SKILLS_ScalePoisonAndCurseDurations_6FCB9B60_113c(m, 50, pGame, pOwner)).toBe(0)
    expect(AURAS_ApplyUndeadPulseBuffAndDamageCallback_6FCBA630_113c(m, pAuraCtx, pCorpse)).toBe(0)
    expect(AURAS_ApplyPulseBuffAndDamageCallback_6FCBA7C0_113c(m, pAuraCtx, pCorpse)).toBe(1)

    m.setU32(pOwner + 0xc8, 0x00400000)
    expect(ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(m, pOwner, pGame)).toBe(1)

    const pPartyCtrl = m.alloc(0x20)
    const pSubParty = m.alloc(0x10)
    const pMember1 = m.alloc(0x10)
    m.setU16(pPartyCtrl + 0x00, 5)
    m.setU32(pPartyCtrl + 0x04, pSubParty)
    m.setU16(pSubParty + 0x00, 3)
    m.setU32(pSubParty + 0x04, pMember1)
    m.setU32(pMember1 + 0x00, 10)
    m.setU32(pGame + 0x1d2c, pPartyCtrl)

    expect(PARTY_CountSubPartyMembers_6FCBBF40_113c(m, pGame, 3)).toBe(1)
    const newId = PARTY_CreateAndLinkSubParty_6FCBBF70_113c(m, pGame)
    expect(newId).toBe(5)

    m.setU32(pGame + 0x1120 + (10 & 0x7f) * 4, pOwner)
    m.setU32(pOwner + 0x00, 0)
    m.setU32(pOwner + 0x0c, 10)
    let visited = 0
    PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
      m,
      pGame,
      3,
      (_m, _g, pUnit) => {
        if (pUnit === pOwner) visited++
      },
      0,
    )
    expect(visited).toBe(1)

    expect(PARTY_DistributeGoldPickupAndReturnRemainder_6FCBC270_113c(m, pGame, pOwner, 0)).toBe(0)
  })
})
