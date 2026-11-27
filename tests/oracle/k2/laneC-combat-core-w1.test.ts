import { describe, expect, it } from 'vitest'
import { SGPT_DATATABLES_VA_113C } from '../../../src/d2kern-113c/common/skills.ts'
import {
  AIINIT_SpawnerResetFrameTimers113c,
  AITHINK_Fn146_UberMephistoNoop113c,
  AI_FilterLivingGloamUnit113c,
  D2GAME_PLR_MODE_SYNC_TABLE_VA_113C,
  ITEMMODE_UnitTimerNoop113c,
  ITEMS_AreAffixesEqual113c,
  ITEMS_AreWeaponSlotTypesCompatible113c,
  ITEMS_BuildItemDropParamsFromItem113c,
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c,
  ITEMS_DoItemRecordsMatchCodePair113c,
  ITEMS_GetOppositeHandOrRingBodyLoc113c,
  ITEMS_HasSocketedSubItems113c,
  MONSTER_EndModeS3Noop113c,
  MONSTER_Event10_ClearMonsterFields34And38_113c,
  MONSTER_GetOrRollRegionSubVariant113c,
  NET_SendEventMessage5A_Type0E_113c,
  NET_SendReassignUnitPacket15_113c,
  NET_SendRemoveUnitPacket0A113c,
  NET_SendUnitMovePacket0F113c,
  PACKET_C2S2C_Reject3_113c,
  PACKET_C2S2D_Reject3_113c,
  PACKET_C2S2E_PlaySoundNoop113c,
  PACKET_C2S39_Reject3_113c,
  PACKET_C2S42_ClearCursorNoop113c,
  PACKET_C2S43_QuestInitNoop113c,
  PACKET_C2S45_Reject3_113c,
  PACKET_C2S4B_RequestUnitRefresh113c,
  PACKET_C2S52_Reject3_113c,
  PACKET_C2S58_MarkQuestIntroSeen113c,
  PACKET_C2S66_WardenResponseNoop113c,
  PACKET_CheckUnitsInDifferentActs113c,
  PACKET_IsInteractingWithDifferentPlayer113c,
  PLAYER_CanInterruptCurrentSkillOrEvent113c,
  PLAYER_SkillModeNoopHandler_00_17_113c,
  PLAYER_SkillModeNoopHandler_01_05_113c,
  PLAYER_SkillModeNoopHandler_04_09_113c,
  PLRTRADE_BroadcastClearMercUnitCallback113c,
  PLRTRADE_CanModifyBeltDuringTrade113c,
  PLRTRADE_CountCubePageItemsInInventory113c,
  PLRTRADE_HasAnyCubePageItemOnUnit113c,
  PLRTRADE_IsInteractingWithValidPlayer113c,
  PLRTRADE_SendTradeAcceptButtonAndSetState3_113c,
  PLRTRADE_SyncClonedItemEarOrPersonalizedData113c,
  PLRTRADE_TradeButtonNoopAction2_113c,
  PLRTRADE_TradeButtonNoopAction3_113c,
  SUNITDMG_GetDefenderColdEffect113c,
} from '../../../src/d2kern-113c/game/k2-combat-core-w1-113c.ts'
import { D2GAME_IAT_SGPT_DATATABLES_VA_113C } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  D2ActiveRoomStrc,
  D2DrlgLevelStrc,
  D2DynamicPathStrc,
  D2EventStrc,
  D2InventoryStrc,
  D2ItemDataStrc,
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2RoomExStrc,
  D2SkillStrc,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

const ITEMS_TXT_COUNT_VA_113C = 0x6fdefb94
const ITEMS_TXT_PTR_VA_113C = 0x6fdefb98
const INVENTORY_SIGNATURE_113C = 0x01020304

function allocClientWithQueue(m: SparseMemory113c, pClient: number, pQueue: number): void {
  m.fill(pClient >>> 0, 0x200, 0)
  m.fill(pQueue >>> 0, 0x410, 0)
  m.setU32((pClient + 0x1b8) >>> 0, pQueue >>> 0)
  m.setU32((pClient + 0x1bc) >>> 0, pQueue >>> 0)
  m.setU32(pQueue >>> 0, 0)
}

function readQueuedBytes(m: SparseMemory113c, pQueue: number): number[] {
  const out: number[] = []
  let walk = pQueue >>> 0
  let guard = 0
  while (walk !== 0 && guard++ < 16) {
    const used = m.u32(walk) >>> 0
    for (let i = 0; i < used; i++) {
      out.push(m.u8((walk + 0x04 + i) >>> 0))
    }
    walk = m.u32((walk + 0x204) >>> 0) >>> 0
  }
  return out
}

function writeCString(m: SparseMemory113c, addr: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    m.setU8((addr + i) >>> 0, text.charCodeAt(i) & 0xff)
  }
  m.setU8((addr + text.length) >>> 0, 0)
}

function readCString(m: SparseMemory113c, addr: number): string {
  let out = ''
  let p = addr >>> 0
  while (true) {
    const ch = m.u8(p)
    if (ch === 0) break
    out += String.fromCharCode(ch)
    p = (p + 1) >>> 0
  }
  return out
}

function setupPlayerWithClient(
  m: SparseMemory113c,
  pPlayer: number,
  pPlayerData: number,
  pClient: number,
  pQueue: number,
  dwUnitId = 1,
): void {
  m.fill(pPlayer >>> 0, 0x100, 0)
  m.fill(pPlayerData >>> 0, 0x100, 0)
  m.set(pPlayer, D2UnitStrc.dwUnitType, 0)
  m.set(pPlayer, D2UnitStrc.dwUnitId, dwUnitId >>> 0)
  m.set(pPlayer, D2UnitStrc.pUnitData, pPlayerData >>> 0)
  m.setU32((pPlayerData + 0x9c) >>> 0, pClient >>> 0)
  allocClientWithQueue(m, pClient, pQueue)
}

function setupItemUnit(
  m: SparseMemory113c,
  pItem: number,
  pItemData: number,
  dwClassId = 0,
  dwUnitId = 100,
): void {
  m.fill(pItem >>> 0, 0x100, 0)
  m.fill(pItemData >>> 0, 0x80, 0)
  m.set(pItem, D2UnitStrc.dwUnitType, 4)
  m.set(pItem, D2UnitStrc.dwClassId, dwClassId >>> 0)
  m.set(pItem, D2UnitStrc.dwUnitId, dwUnitId >>> 0)
  m.set(pItem, D2UnitStrc.pUnitData, pItemData >>> 0)
}

describe('[K2-W1 Lane C] D2Game.dll combat-core / PlrTrade / Modes / Packet / Items (45 VAs)', () => {
  describe('Group A: PLAYER / PlrTrade (0x6FC90010..0x6FC90D60)', () => {
    it('0x6FC90010 PLRTRADE_SyncClonedItemEarOrPersonalizedData113c syncs ear data or personalized name', () => {
      const m = new SparseMemory113c()
      const pItemsTxt = 0x100000
      m.fill(pItemsTxt, 4 * D2ItemsTxt_SIZE, 0)
      m.setU32(ITEMS_TXT_COUNT_VA_113C, 4)
      m.setU32(ITEMS_TXT_PTR_VA_113C, pItemsTxt)
      // Class 0: ear (wType1 = 7), Class 1: armor (wType1 = 3)
      m.set(pItemsTxt + 0 * D2ItemsTxt_SIZE, D2ItemsTxt.wType1, 7)
      m.set(pItemsTxt + 1 * D2ItemsTxt_SIZE, D2ItemsTxt.wType1, 3)

      // Null guard
      PLRTRADE_SyncClonedItemEarOrPersonalizedData113c(m, 0, 0x2000, 1)

      // Case 1: Ear item (wType1 == 7) copies ear name, ear level, and sets/clears 0x8000
      const pSrcEar = 0x200000
      const pSrcEarData = 0x200200
      const pDstEar = 0x201000
      const pDstEarData = 0x201200
      setupItemUnit(m, pSrcEar, pSrcEarData, 0, 10)
      setupItemUnit(m, pDstEar, pDstEarData, 0, 11)
      writeCString(m, pSrcEarData + D2ItemDataStrc.szPlayerName.off, 'Horazon')
      m.set(pSrcEarData, D2ItemDataStrc.bEarLevel, 87)

      PLRTRADE_SyncClonedItemEarOrPersonalizedData113c(m, pDstEar, pSrcEar, 1)
      expect(readCString(m, pDstEarData + D2ItemDataStrc.szPlayerName.off)).toBe('Horazon')
      expect(m.get(pDstEarData, D2ItemDataStrc.bEarLevel)).toBe(87)
      expect(m.get(pDstEarData, D2ItemDataStrc.dwCommandFlags) & 0x8000).toBe(0x8000)

      PLRTRADE_SyncClonedItemEarOrPersonalizedData113c(m, pDstEar, pSrcEar, 0)
      expect(m.get(pDstEarData, D2ItemDataStrc.dwCommandFlags) & 0x8000).toBe(0)

      // Case 2: Non-ear item with command flag 0x01000000 copies personalized name only
      const pSrcArmor = 0x202000
      const pSrcArmorData = 0x202200
      const pDstArmor = 0x203000
      const pDstArmorData = 0x203200
      setupItemUnit(m, pSrcArmor, pSrcArmorData, 1, 12)
      setupItemUnit(m, pDstArmor, pDstArmorData, 1, 13)
      writeCString(m, pSrcArmorData + D2ItemDataStrc.szPlayerName.off, 'AnyaHero')
      m.set(pSrcArmorData, D2ItemDataStrc.bEarLevel, 99)
      m.set(pDstArmorData, D2ItemDataStrc.dwCommandFlags, 0x01000000)

      PLRTRADE_SyncClonedItemEarOrPersonalizedData113c(m, pDstArmor, pSrcArmor, 1)
      expect(readCString(m, pDstArmorData + D2ItemDataStrc.szPlayerName.off)).toBe('AnyaHero')
      expect(m.get(pDstArmorData, D2ItemDataStrc.bEarLevel)).toBe(0)
      expect(m.get(pDstArmorData, D2ItemDataStrc.dwCommandFlags)).toBe(0x01000000)
    })

    it('0x6FC90080 PLRTRADE_HasAnyCubePageItemOnUnit113c & 0x6FC90190 PLRTRADE_CountCubePageItemsInInventory113c detect cube page 3 items', () => {
      const m = new SparseMemory113c()
      const pUnit = 0x10000
      const pInv = 0x11000
      m.fill(pUnit, 0x100, 0)
      m.fill(pInv, 0x40, 0)
      m.set(pUnit, D2UnitStrc.pInventory, pInv)
      m.set(pInv, D2InventoryStrc.dwSignature, INVENTORY_SIGNATURE_113C)

      expect(PLRTRADE_HasAnyCubePageItemOnUnit113c(m, 0)).toBe(0)
      expect(PLRTRADE_HasAnyCubePageItemOnUnit113c(m, pUnit)).toBe(0)
      expect(PLRTRADE_CountCubePageItemsInInventory113c(m, pInv)).toBe(0)

      const pItem1 = 0x12000
      const pItemData1 = 0x12200
      const pItem2 = 0x13000
      const pItemData2 = 0x13200
      const pItem3 = 0x14000
      const pItemData3 = 0x14200
      setupItemUnit(m, pItem1, pItemData1, 0, 1)
      setupItemUnit(m, pItem2, pItemData2, 0, 2)
      setupItemUnit(m, pItem3, pItemData3, 0, 3)

      m.set(pItemData1, D2ItemDataStrc.nInvPage, 0)
      m.set(pItemData2, D2ItemDataStrc.nInvPage, 3)
      m.set(pItemData3, D2ItemDataStrc.nInvPage, 3)

      // Link pItem1 -> pItem2 -> pItem3 via pItemData + 0x5C + 0x08
      m.set(pInv, D2InventoryStrc.pFirstItem, pItem1)
      m.setU32((pItemData1 + 0x5c + 0x08) >>> 0, pItem2)
      m.setU32((pItemData2 + 0x5c + 0x08) >>> 0, pItem3)

      expect(PLRTRADE_HasAnyCubePageItemOnUnit113c(m, pUnit)).toBe(1)
      expect(PLRTRADE_CountCubePageItemsInInventory113c(m, pInv)).toBe(2)

      m.set(pItemData2, D2ItemDataStrc.nInvPage, 4)
      m.set(pItemData3, D2ItemDataStrc.nInvPage, 0)
      expect(PLRTRADE_HasAnyCubePageItemOnUnit113c(m, pUnit)).toBe(0)
      expect(PLRTRADE_CountCubePageItemsInInventory113c(m, pInv)).toBe(0)
    })

    it('0x6FC90170 PLRTRADE_TradeButtonNoopAction3_113c & 0x6FC90180 PLRTRADE_TradeButtonNoopAction2_113c return 0', () => {
      const m = new SparseMemory113c()
      expect(PLRTRADE_TradeButtonNoopAction3_113c(m, 0x1000, 0x2000)).toBe(0)
      expect(PLRTRADE_TradeButtonNoopAction2_113c(m, 0x1000, 0x2000)).toBe(0)
    })

    it('0x6FC901F0 PLRTRADE_CanModifyBeltDuringTrade113c blocks belt modification when trading with nodePosOther == 2', () => {
      const m = new SparseMemory113c()
      const pUnit = 0x20000
      const pInv = 0x21000
      const pItem = 0x22000
      const pItemData = 0x22200
      m.fill(pUnit, 0x100, 0)
      m.fill(pInv, 0x40, 0)
      setupItemUnit(m, pItem, pItemData, 0, 1)
      m.set(pUnit, D2UnitStrc.pInventory, pInv)
      m.set(pInv, D2InventoryStrc.dwSignature, INVENTORY_SIGNATURE_113C)
      m.set(pInv, D2InventoryStrc.pFirstItem, pItem)

      // Not interacting -> allowed (1)
      expect(PLRTRADE_CanModifyBeltDuringTrade113c(m, 0)).toBe(1)
      expect(PLRTRADE_CanModifyBeltDuringTrade113c(m, pUnit)).toBe(1)

      // Interacting with player (bInteracting = 1, dwInteractType = 0), nodePosOther = 1 -> allowed (1)
      m.setU8((pUnit + 0x6c) >>> 0, 1)
      m.setU32((pUnit + 0x68) >>> 0, 0)
      m.setU8((pItemData + 0x5c + 0x0d) >>> 0, 1)
      expect(PLRTRADE_CanModifyBeltDuringTrade113c(m, pUnit)).toBe(1)

      // nodePosOther = 2 during player trade -> blocked (0)
      m.setU8((pItemData + 0x5c + 0x0d) >>> 0, 2)
      expect(PLRTRADE_CanModifyBeltDuringTrade113c(m, pUnit)).toBe(0)

      // Interacting with NPC (dwInteractType = 1) -> allowed (1)
      m.setU32((pUnit + 0x68) >>> 0, 1)
      expect(PLRTRADE_CanModifyBeltDuringTrade113c(m, pUnit)).toBe(1)
    })

    it('0x6FC90B70 PLRTRADE_SendTradeAcceptButtonAndSetState3_113c queues S2C 0x77 (0x06) to both clients and sets trade state 3', () => {
      const m = new SparseMemory113c()
      const pPlayer1 = 0x30000
      const pData1 = 0x30200
      const pClient1 = 0x30400
      const pQueue1 = 0x30800
      const pPlayer2 = 0x31000
      const pData2 = 0x31200
      const pClient2 = 0x31400
      const pQueue2 = 0x31800
      setupPlayerWithClient(m, pPlayer1, pData1, pClient1, pQueue1, 1)
      setupPlayerWithClient(m, pPlayer2, pData2, pClient2, pQueue2, 2)

      const pTrade1 = 0x32000
      const pTrade2 = 0x33000
      m.fill(pTrade1, 0x60, 0)
      m.fill(pTrade2, 0x60, 0)
      const ret = PLRTRADE_SendTradeAcceptButtonAndSetState3_113c(
        m,
        pPlayer1,
        pPlayer2,
        pTrade1,
        pTrade2,
      )
      expect(ret).toBe(3)
      expect(readQueuedBytes(m, pQueue1)).toEqual([0x77, 0x06])
      expect(readQueuedBytes(m, pQueue2)).toEqual([0x77, 0x06])
      expect(m.u32((pTrade1 + 0x50) >>> 0)).toBe(3)
      expect(m.u32((pTrade2 + 0x50) >>> 0)).toBe(3)
    })

    it('0x6FC90C90 PLRTRADE_BroadcastClearMercUnitCallback113c skips self and queues S2C 0x92 to other players', () => {
      const m = new SparseMemory113c()
      const pTarget = 0x40000
      const pTargetData = 0x40200
      const pTargetClient = 0x40400
      const pTargetQueue = 0x40800
      setupPlayerWithClient(m, pTarget, pTargetData, pTargetClient, pTargetQueue, 10)

      const pSource = 0x41000
      m.fill(pSource, 0x100, 0)
      m.set(pSource, D2UnitStrc.dwUnitType, 0)
      m.set(pSource, D2UnitStrc.dwUnitId, 0x11223344)

      // Self -> no packet
      PLRTRADE_BroadcastClearMercUnitCallback113c(m, 0, pTarget, pTarget)
      expect(readQueuedBytes(m, pTargetQueue)).toEqual([])

      // Different source player -> queues { 0x92, 0x00, 0x44, 0x33, 0x22, 0x11 }
      PLRTRADE_BroadcastClearMercUnitCallback113c(m, 0, pTarget, pSource)
      expect(readQueuedBytes(m, pTargetQueue)).toEqual([0x92, 0x00, 0x44, 0x33, 0x22, 0x11])

      // Null source player -> dwOwnerGuid = 0xFFFFFFFF
      m.setU32(pTargetQueue >>> 0, 0)
      PLRTRADE_BroadcastClearMercUnitCallback113c(m, 0, pTarget, 0)
      expect(readQueuedBytes(m, pTargetQueue)).toEqual([0x92, 0x00, 0xff, 0xff, 0xff, 0xff])
    })

    it('0x6FC90D60 PLRTRADE_IsInteractingWithValidPlayer113c validates live trade partner in server unit hash', () => {
      const m = new SparseMemory113c()
      const pGame = 0x50000
      const pPlayer = 0x54000
      const pPartner = 0x55000
      m.fill(pGame, 0x1e00, 0)
      m.fill(pPlayer, 0x100, 0)
      m.fill(pPartner, 0x100, 0)
      const partnerGuid = 7
      m.set(pPartner, D2UnitStrc.dwUnitType, 0)
      m.set(pPartner, D2UnitStrc.dwUnitId, partnerGuid)

      m.setU32((pPlayer + 0x64) >>> 0, partnerGuid)
      m.setU32((pPlayer + 0x68) >>> 0, 0)
      m.setU8((pPlayer + 0x6c) >>> 0, 1)

      // Partner not in pGame player hash table yet -> 0
      expect(PLRTRADE_IsInteractingWithValidPlayer113c(m, pPlayer, pGame)).toBe(0)

      // Insert partner into pGame player hash bucket (+0x1120 + (7 & 0x7F) * 4)
      m.setU32((pGame + 0x1120 + (partnerGuid & 0x7f) * 4) >>> 0, pPartner)
      expect(PLRTRADE_IsInteractingWithValidPlayer113c(m, pPlayer, pGame)).toBe(1)

      // Non-player interact type -> 0
      m.setU32((pPlayer + 0x68) >>> 0, 1)
      expect(PLRTRADE_IsInteractingWithValidPlayer113c(m, pPlayer, pGame)).toBe(0)
    })
  })

  describe('Group B: MONSTER / PLAYER Modes & AI (0x6FC94890..0x6FC9BD00)', () => {
    it('0x6FC94890 MONSTER_EndModeS3Noop113c & 0x6FC94E40 MONSTER_Event10_ClearMonsterFields34And38_113c', () => {
      const m = new SparseMemory113c()
      expect(MONSTER_EndModeS3Noop113c(m, 0x1000, 0x2000)).toBeUndefined()

      const pMon = 0x60000
      const pMonData = 0x60200
      m.fill(pMon, 0x100, 0)
      m.fill(pMonData, 0x60, 0)
      m.set(pMon, D2UnitStrc.dwUnitType, 1)
      m.set(pMon, D2UnitStrc.pUnitData, pMonData)
      m.setU32((pMonData + 0x34) >>> 0, 0xdeadbeef)
      m.setU32((pMonData + 0x38) >>> 0, 0xcafebabe)

      // Non-monster unit leaves fields untouched
      m.set(pMon, D2UnitStrc.dwUnitType, 0)
      MONSTER_Event10_ClearMonsterFields34And38_113c(m, 0, pMon)
      expect(m.u32((pMonData + 0x34) >>> 0)).toBe(0xdeadbeef)

      // Monster unit clears both +0x34 and +0x38
      m.set(pMon, D2UnitStrc.dwUnitType, 1)
      MONSTER_Event10_ClearMonsterFields34And38_113c(m, 0, pMon)
      expect(m.u32((pMonData + 0x34) >>> 0)).toBe(0)
      expect(m.u32((pMonData + 0x38) >>> 0)).toBe(0)
    })

    it('0x6FC97920, 0x6FC97930, 0x6FC97940 player skill-mode handlers return 1', () => {
      const m = new SparseMemory113c()
      expect(PLAYER_SkillModeNoopHandler_04_09_113c(m, 1, 2, 3, 4)).toBe(1)
      expect(PLAYER_SkillModeNoopHandler_01_05_113c(m, 1, 2, 3, 4)).toBe(1)
      expect(PLAYER_SkillModeNoopHandler_00_17_113c(m, 1, 2, 3, 4)).toBe(1)
    })

    it('0x6FC98100 PLAYER_CanInterruptCurrentSkillOrEvent113c checks Skills.txt bInterrupt (+0x16) and 5-frame ENDANIM window', () => {
      const m = new SparseMemory113c()
      const pGame = 0x70000
      const pPlayer = 0x71000
      const pSkillList = 0x72000
      const pSkill = 0x72100
      const pSkillsTxt = 0x72200
      const pEvent = 0x73000
      m.fill(pGame, 0x100, 0)
      m.fill(pPlayer, 0x100, 0)
      m.fill(pSkillList, 0x40, 0)
      m.fill(pSkill, 0x40, 0)
      m.fill(pSkillsTxt, 0x40, 0)
      m.fill(pEvent, 0x40, 0)

      m.set(pPlayer, D2UnitStrc.pSkills, pSkillList)
      m.setU32((pSkillList + 0x10) >>> 0, pSkill)
      m.set(pSkill, D2SkillStrc.pSkillsTxt, pSkillsTxt)
      m.set(pPlayer, D2UnitStrc.pEventFirst, pEvent)
      m.set(pEvent, D2EventStrc.nType, 1)
      m.set(pEvent, D2EventStrc.dwFrame, 100)

      // Game frame 120 > 100 + 5, but bInterrupt (+0x16) == 1 -> returns 1
      m.setU32((pGame + 0xa8) >>> 0, 120)
      m.setU8((pSkillsTxt + 0x16) >>> 0, 1)
      expect(PLAYER_CanInterruptCurrentSkillOrEvent113c(m, pPlayer, pGame)).toBe(1)

      // bInterrupt == 0: frame 120 > 105 -> 0; frame 105 <= 105 -> 1
      m.setU8((pSkillsTxt + 0x16) >>> 0, 0)
      expect(PLAYER_CanInterruptCurrentSkillOrEvent113c(m, pPlayer, pGame)).toBe(0)
      m.setU32((pGame + 0xa8) >>> 0, 105)
      expect(PLAYER_CanInterruptCurrentSkillOrEvent113c(m, pPlayer, pGame)).toBe(1)
    })

    it('0x6FC9A540 NET_SendRemoveUnitPacket0A113c queues S2C 0x0A for non-missiles and skips missiles (type 3)', () => {
      const m = new SparseMemory113c()
      const pClient = 0x80000
      const pQueue = 0x80400
      allocClientWithQueue(m, pClient, pQueue)

      const pUnit = 0x81000
      m.fill(pUnit, 0x100, 0)
      m.set(pUnit, D2UnitStrc.dwUnitType, 3)
      m.set(pUnit, D2UnitStrc.dwUnitId, 0x01020304)

      NET_SendRemoveUnitPacket0A113c(m, pUnit, pClient)
      expect(readQueuedBytes(m, pQueue)).toEqual([])

      m.set(pUnit, D2UnitStrc.dwUnitType, 1)
      NET_SendRemoveUnitPacket0A113c(m, pUnit, pClient)
      expect(readQueuedBytes(m, pQueue)).toEqual([0x0a, 0x01, 0x04, 0x03, 0x02, 0x01])
    })

    it('0x6FC9B4E0 AITHINK_Fn146_UberMephistoNoop113c & 0x6FC9B4F0 AIINIT_SpawnerResetFrameTimers113c', () => {
      const m = new SparseMemory113c()
      expect(AITHINK_Fn146_UberMephistoNoop113c(m, 1, 2, 3)).toBeUndefined()

      const pGame = 0x90000
      const pAiParam = 0x91000
      const pAiGeneral = 0x92000
      m.fill(pGame, 0x100, 0)
      m.fill(pAiParam, 0x20, 0)
      m.fill(pAiGeneral, 0x30, 0)
      m.setU32((pGame + 0xa8) >>> 0, 777)
      m.setU32(pAiParam, pAiGeneral)
      m.setU32((pAiGeneral + 0x14) >>> 0, 11)
      m.setU32((pAiGeneral + 0x18) >>> 0, 99)

      AIINIT_SpawnerResetFrameTimers113c(m, pGame, 0, pAiParam)
      expect(m.u32((pAiGeneral + 0x14) >>> 0)).toBe(777)
      expect(m.u32((pAiGeneral + 0x18) >>> 0)).toBe(0)
    })

    it('0x6FC9B510 MONSTER_GetOrRollRegionSubVariant113c handles Act 1 (<40) vs Act 2+ (>=40) sub-variant rolls', () => {
      const m = new SparseMemory113c()
      const pGame = 0xa0000
      const pUnit = 0xa2000
      const pPath = 0xa2200
      const pRoom = 0xa2400
      const pRoomEx = 0xa2600
      const pLevel = 0xa2800
      const pMonRegAct1 = 0xa3000
      const pMonRegAct2 = 0xa4000
      m.fill(pGame, 0x500, 0)
      m.fill(pUnit, 0x100, 0)
      m.fill(pPath, 0x80, 0)
      m.fill(pRoom, 0x80, 0)
      m.fill(pRoomEx, 0x80, 0)
      m.fill(pLevel, 0x200, 0)
      m.fill(pMonRegAct1, 0x300, 0)
      m.fill(pMonRegAct2, 0x300, 0)

      m.set(pUnit, D2UnitStrc.dwUnitType, 1)
      m.set(pUnit, D2UnitStrc.pPath, pPath)
      m.set(pPath, D2DynamicPathStrc.pRoom, pRoom)
      m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
      m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
      m.setU32((pUnit + 0x20) >>> 0, 12345)
      m.setU32((pUnit + 0x24) >>> 0, 666)

      // Act 1 level 5 with nSubVariant = -1 -> sets 0
      m.set(pLevel, D2DrlgLevelStrc.nLevelId, 5)
      m.setU32((pGame + 0xf0 + 5 * 4) >>> 0, pMonRegAct1)
      m.setU32((pMonRegAct1 + 0x2d4) >>> 0, 0xffffffff)
      expect(MONSTER_GetOrRollRegionSubVariant113c(m, pUnit, pGame)).toBe(0)
      expect(m.u32((pMonRegAct1 + 0x2d4) >>> 0)).toBe(0)

      // Act 2 level 45 with nSubVariant = -1 -> rolls 0..2 and caches it
      m.set(pLevel, D2DrlgLevelStrc.nLevelId, 45)
      m.setU32((pGame + 0xf0 + 45 * 4) >>> 0, pMonRegAct2)
      m.setU32((pMonRegAct2 + 0x2d4) >>> 0, 0xffffffff)
      const rolled = MONSTER_GetOrRollRegionSubVariant113c(m, pUnit, pGame)
      expect(rolled).toBeGreaterThanOrEqual(0)
      expect(rolled).toBeLessThan(3)
      expect(m.u32((pMonRegAct2 + 0x2d4) >>> 0)).toBe(rolled)
      // Subsequent call returns cached value
      m.setU32((pMonRegAct2 + 0x2d4) >>> 0, 2)
      expect(MONSTER_GetOrRollRegionSubVariant113c(m, pUnit, pGame)).toBe(2)
    })

    it('0x6FC9BD00 AI_FilterLivingGloamUnit113c filters living monster units with wBaseId == 0x76', () => {
      const m = new SparseMemory113c()
      const pTables = 0xb0000
      const pMonStats = 0xb2000
      m.fill(pTables, 0xd00, 0)
      m.fill(pMonStats, 130 * 0x1a8, 0)
      m.setU32(SGPT_DATATABLES_VA_113C, pTables)
      m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, SGPT_DATATABLES_VA_113C)
      m.setU32((pTables + 0xa78) >>> 0, pMonStats)
      m.setU32((pTables + 0xa80) >>> 0, 200)

      // Class 120 has wBaseId (+0x02) = 0x76 (118, willowisp1)
      m.setU16((pMonStats + 120 * 0x1a8 + 0x02) >>> 0, 0x76)
      // Class 121 has wBaseId (+0x02) = 0x10
      m.setU16((pMonStats + 121 * 0x1a8 + 0x02) >>> 0, 0x10)

      const pUnit = 0xb8000
      m.fill(pUnit, 0x100, 0)
      m.set(pUnit, D2UnitStrc.dwUnitType, 1)
      m.set(pUnit, D2UnitStrc.dwClassId, 120)
      m.set(pUnit, D2UnitStrc.dwAnimMode, 1) // MONMODE_NEUTRAL (alive)
      expect(AI_FilterLivingGloamUnit113c(m, pUnit)).toBe(1)

      // Dead monster (mode 12 = MONMODE_DEAD) -> 0
      m.set(pUnit, D2UnitStrc.dwAnimMode, 12)
      expect(AI_FilterLivingGloamUnit113c(m, pUnit)).toBe(0)

      // Alive monster with different wBaseId -> 0
      m.set(pUnit, D2UnitStrc.dwAnimMode, 1)
      m.set(pUnit, D2UnitStrc.dwClassId, 121)
      expect(AI_FilterLivingGloamUnit113c(m, pUnit)).toBe(0)
    })
  })

  describe('Group C: PACKET C2S / S2C Handlers (0x6FCEB190..0x6FCECB10)', () => {
    it('C2S accept-0 no-op handlers (0x66, 0x43, 0x42, 0x2E) and reject-3 stubs (0x2C, 0x52, 0x45, 0x39, 0x2D)', () => {
      const m = new SparseMemory113c()
      expect(PACKET_C2S66_WardenResponseNoop113c(m, 1, 2, 3, 4)).toBe(0)
      expect(PACKET_C2S43_QuestInitNoop113c(m, 1, 2, 3, 4)).toBe(0)
      expect(PACKET_C2S42_ClearCursorNoop113c(m, 1, 2, 3, 4)).toBe(0)
      expect(PACKET_C2S2E_PlaySoundNoop113c(m, 1, 2, 3, 4)).toBe(0)

      expect(PACKET_C2S2C_Reject3_113c(m, 1, 2, 3, 4)).toBe(3)
      expect(PACKET_C2S52_Reject3_113c(m, 1, 2, 3, 4)).toBe(3)
      expect(PACKET_C2S45_Reject3_113c(m, 1, 2, 3, 4)).toBe(3)
      expect(PACKET_C2S39_Reject3_113c(m, 1, 2, 3, 4)).toBe(3)
      expect(PACKET_C2S2D_Reject3_113c(m, 1, 2, 3, 4)).toBe(3)
    })

    it('0x6FCEB370 PACKET_CheckUnitsInDifferentActs113c returns 0 for same Act and 2 for different Acts', () => {
      const m = new SparseMemory113c()
      const setupUnitAtLevel = (base: number, levelId: number): number => {
        m.fill(base, 0x600, 0)
        const pUnit = base
        const pPath = base + 0x100
        const pRoom = base + 0x200
        const pRoomEx = base + 0x300
        const pLevel = base + 0x400
        m.set(pUnit, D2UnitStrc.dwUnitType, 0)
        m.set(pUnit, D2UnitStrc.pPath, pPath)
        m.set(pPath, D2DynamicPathStrc.pRoom, pRoom)
        m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
        m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
        m.set(pLevel, D2DrlgLevelStrc.nLevelId, levelId)
        return pUnit
      }

      const uAct1A = setupUnitAtLevel(0xc0000, 1)
      const uAct1B = setupUnitAtLevel(0xc1000, 35)
      const uAct2 = setupUnitAtLevel(0xc2000, 40)

      expect(PACKET_CheckUnitsInDifferentActs113c(m, uAct1A, uAct1B)).toBe(0)
      expect(PACKET_CheckUnitsInDifferentActs113c(m, uAct1A, uAct2)).toBe(2)
    })

    it('0x6FCEB3D0 PACKET_C2S58_MarkQuestIntroSeen113c validates size/questId and sets state 0x0C', () => {
      const m = new SparseMemory113c()
      const pGame = 0xd0000
      const pPlayer = 0xd1000
      const pPlayerData = 0xd1200
      const pQuestData = 0xd1400
      const pQuestBuf = 0xd1500
      const pPacket = 0xd2000
      m.fill(pGame, 0x100, 0)
      m.fill(pPlayer, 0x100, 0)
      m.fill(pPlayerData, 0x100, 0)
      m.fill(pQuestData, 0x20, 0)
      m.fill(pQuestBuf, 0x60, 0)
      m.fill(pPacket, 0x20, 0)

      m.set(pPlayer, D2UnitStrc.dwUnitType, 0)
      m.set(pPlayer, D2UnitStrc.pUnitData, pPlayerData)
      m.setU8((pGame + 0x6d) >>> 0, 1) // Nightmare (difficulty 1)
      m.setU32((pPlayerData + 0x10 + 1 * 4) >>> 0, pQuestData)
      m.setU32(pQuestData, pQuestBuf)

      m.setU8(pPacket, 0x58)
      m.setU16((pPacket + 1) >>> 0, 5)

      // Size != 3 -> 3
      expect(PACKET_C2S58_MarkQuestIntroSeen113c(m, pGame, pPlayer, pPacket, 2)).toBe(3)
      // wQuestId >= 42 -> 2
      m.setU16((pPacket + 1) >>> 0, 42)
      expect(PACKET_C2S58_MarkQuestIntroSeen113c(m, pGame, pPlayer, pPacket, 3)).toBe(2)

      // Valid wQuestId = 5 -> sets state 12 (0x0C) and returns 0
      m.setU16((pPacket + 1) >>> 0, 5)
      expect(PACKET_C2S58_MarkQuestIntroSeen113c(m, pGame, pPlayer, pPacket, 3)).toBe(0)
      const bitIdx = (5 << 4) + 0x0c
      expect((m.u8((pQuestBuf + (bitIdx >> 3)) >>> 0) >>> (bitIdx & 7)) & 1).toBe(1)
    })

    it('0x6FCEBA20 NET_SendUnitMovePacket0F113c & 0x6FCEBB10 NET_SendReassignUnitPacket15_113c & 0x6FCEBED0 NET_SendEventMessage5A_Type0E_113c', () => {
      const m = new SparseMemory113c()
      const pPlayer = 0xe0000
      const pPlayerData = 0xe0200
      const pClient = 0xe0400
      const pQueue = 0xe0800
      const pPath = 0xe1000
      m.fill(pPath, 0x80, 0)
      setupPlayerWithClient(m, pPlayer, pPlayerData, pClient, pQueue, 0x12345678)

      m.set(pPlayer, D2UnitStrc.pPath, pPath)
      m.setU16((pPath + 0x02) >>> 0, 5100) // wPosX
      m.setU16((pPath + 0x06) >>> 0, 5200) // wPosY
      m.set(pPath, D2DynamicPathStrc.wTargetX, 5110)
      m.set(pPath, D2DynamicPathStrc.wTargetY, 5220)
      m.setU8((pPlayer + 0xb0) >>> 0, 0x40)

      // 1. NET_SendUnitMovePacket0F113c (nAnimMode = 3 -> subtype byte 23 = 0x17)
      NET_SendUnitMovePacket0F113c(m, 0, pPlayer, pClient, 3)
      const pkt0F = readQueuedBytes(m, pQueue)
      expect(pkt0F.length).toBe(16)
      expect(pkt0F[0]).toBe(0x0f)
      expect(pkt0F[1]).toBe(0x00)
      expect(pkt0F.slice(2, 6)).toEqual([0x78, 0x56, 0x34, 0x12])
      expect(pkt0F[6]).toBe(23)
      expect(pkt0F[7]! | (pkt0F[8]! << 8)).toBe(5110)
      expect(pkt0F[9]! | (pkt0F[10]! << 8)).toBe(5220)
      expect(pkt0F[11]).toBe(0x40)
      expect(pkt0F[12]! | (pkt0F[13]! << 8)).toBe(5100)
      expect(pkt0F[14]! | (pkt0F[15]! << 8)).toBe(5200)

      // Also verify hydrated D2GAME_PLR_MODE_SYNC_TABLE_VA_113C override
      m.setU32(pQueue >>> 0, 0)
      m.setU8((D2GAME_PLR_MODE_SYNC_TABLE_VA_113C + 4 + 2 * 12) >>> 0, 0x33)
      NET_SendUnitMovePacket0F113c(m, 0, pPlayer, pClient, 2)
      expect(readQueuedBytes(m, pQueue)[6]).toBe(0x33)

      // 2. NET_SendReassignUnitPacket15_113c (11 bytes)
      m.setU32(pQueue >>> 0, 0)
      NET_SendReassignUnitPacket15_113c(m, pPlayer, pClient, 1)
      const pkt15 = readQueuedBytes(m, pQueue)
      expect(pkt15).toEqual([
        0x15,
        0x00,
        0x78,
        0x56,
        0x34,
        0x12,
        5100 & 0xff,
        (5100 >> 8) & 0xff,
        5200 & 0xff,
        (5200 >> 8) & 0xff,
        0x01,
      ])

      // 3. NET_SendEventMessage5A_Type0E_113c (40 bytes; D2Game.dll@0x6FCAA3E0 returns nPacketSize)
      m.setU32(pQueue >>> 0, 0)
      expect(NET_SendEventMessage5A_Type0E_113c(m, pPlayer)).toBe(40)
      const pkt5A = readQueuedBytes(m, pQueue)
      expect(pkt5A.length).toBe(40)
      expect(pkt5A.slice(0, 4)).toEqual([0x5a, 0x0e, 0x01, 0x00])
    })

    it('0x6FCEC6E0 PACKET_C2S4B_RequestUnitRefresh113c validates packet, adjacency, and refreshes target unit', () => {
      const m = new SparseMemory113c()
      const pGame = 0xf0000
      const pPlayer = 0xf2000
      const pPlayerPath = 0xf2200
      const pTarget = 0xf3000
      const pTargetPath = 0xf3200
      const pRoom = 0xf4000
      const ppRoomsNear = 0xf4200
      const pActFlag = 0xf4300
      const pPacket = 0xf5000
      m.fill(pGame, 0x1e00, 0)
      m.fill(pPlayer, 0x100, 0)
      m.fill(pPlayerPath, 0x80, 0)
      m.fill(pTarget, 0x100, 0)
      m.fill(pTargetPath, 0x80, 0)
      m.fill(pRoom, 0x80, 0)
      m.fill(ppRoomsNear, 0x20, 0)
      m.fill(pActFlag, 0x10, 0)
      m.fill(pPacket, 0x20, 0)

      m.set(pPlayer, D2UnitStrc.dwUnitType, 0)
      m.set(pPlayer, D2UnitStrc.pPath, pPlayerPath)
      m.set(pPlayerPath, D2DynamicPathStrc.pRoom, pRoom)

      m.set(pTarget, D2UnitStrc.dwUnitType, 1)
      m.set(pTarget, D2UnitStrc.dwUnitId, 9)
      m.set(pTarget, D2UnitStrc.pPath, pTargetPath)
      m.set(pTargetPath, D2DynamicPathStrc.pRoom, pRoom)

      // Room near-list contains itself
      m.setU32(pRoom, ppRoomsNear)
      m.setU32((pRoom + 0x24) >>> 0, 1)
      m.setU32(ppRoomsNear, pRoom)
      m.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, pActFlag)

      // Insert monster 9 into pGame monster hash (+0x1320 + 9 * 4)
      m.setU32((pGame + 0x1320 + 9 * 4) >>> 0, pTarget)

      m.setU8(pPacket, 0x4b)
      m.setU32((pPacket + 1) >>> 0, 1) // UNIT_MONSTER
      m.setU32((pPacket + 5) >>> 0, 9) // dwUnitId = 9

      expect(PACKET_C2S4B_RequestUnitRefresh113c(m, pGame, pPlayer, pPacket, 8)).toBe(3)
      m.setU32((pPacket + 1) >>> 0, 6)
      expect(PACKET_C2S4B_RequestUnitRefresh113c(m, pGame, pPlayer, pPacket, 9)).toBe(2)
      m.setU32((pPacket + 1) >>> 0, 1)
      m.setU32((pPacket + 5) >>> 0, 99)
      expect(PACKET_C2S4B_RequestUnitRefresh113c(m, pGame, pPlayer, pPacket, 9)).toBe(1)

      m.setU32((pPacket + 5) >>> 0, 9)
      expect(PACKET_C2S4B_RequestUnitRefresh113c(m, pGame, pPlayer, pPacket, 9)).toBe(0)
      expect(m.u32((pTarget + 0xc8) >>> 0) & 0x10000).toBe(0x10000)
      expect(m.get(pRoom, D2ActiveRoomStrc.pUpdateList)).toBe(pTarget)
    })

    it('0x6FCECB10 PACKET_IsInteractingWithDifferentPlayer113c returns 1 only when interacting with a third player', () => {
      const m = new SparseMemory113c()
      const pGame = 0x110000
      const pPlayer = 0x112000
      const pOther = 0x113000
      const pThird = 0x114000
      m.fill(pGame, 0x1e00, 0)
      m.fill(pPlayer, 0x100, 0)
      m.fill(pOther, 0x100, 0)
      m.fill(pThird, 0x100, 0)

      m.set(pOther, D2UnitStrc.dwUnitType, 0)
      m.set(pOther, D2UnitStrc.dwUnitId, 2)
      m.set(pThird, D2UnitStrc.dwUnitType, 0)
      m.set(pThird, D2UnitStrc.dwUnitId, 3)

      m.setU32((pGame + 0x1120 + 2 * 4) >>> 0, pOther)
      m.setU32((pGame + 0x1120 + 3 * 4) >>> 0, pThird)

      m.setU32((pPlayer + 0x64) >>> 0, 2)
      m.setU32((pPlayer + 0x68) >>> 0, 0)
      m.setU8((pPlayer + 0x6c) >>> 0, 1)

      // Interacting with pOther -> 0
      expect(PACKET_IsInteractingWithDifferentPlayer113c(m, pPlayer, pGame, pOther)).toBe(0)
      // Interacting with pThird (!== pOther) -> 1
      m.setU32((pPlayer + 0x64) >>> 0, 3)
      expect(PACKET_IsInteractingWithDifferentPlayer113c(m, pPlayer, pGame, pOther)).toBe(1)
    })
  })

  describe('Group D: ITEMS / ItemMode & SUNITDMG (0x6FCF16B0..0x6FCFAE20)', () => {
    it('0x6FCF16B0 ITEMS_AreAffixesEqual113c compares magic prefixes [0..2], suffixes [0..2], and auto affix', () => {
      const m = new SparseMemory113c()
      const pItem1 = 0x120000
      const pData1 = 0x120200
      const pItem2 = 0x121000
      const pData2 = 0x121200
      setupItemUnit(m, pItem1, pData1, 0, 1)
      setupItemUnit(m, pItem2, pData2, 0, 2)

      for (const pData of [pData1, pData2]) {
        m.setU16((pData + D2ItemDataStrc.wMagicPrefix.off + 0) >>> 0, 101)
        m.setU16((pData + D2ItemDataStrc.wMagicPrefix.off + 2) >>> 0, 102)
        m.setU16((pData + D2ItemDataStrc.wMagicPrefix.off + 4) >>> 0, 103)
        m.setU16((pData + D2ItemDataStrc.wMagicSuffix.off + 0) >>> 0, 201)
        m.setU16((pData + D2ItemDataStrc.wMagicSuffix.off + 2) >>> 0, 202)
        m.setU16((pData + D2ItemDataStrc.wMagicSuffix.off + 4) >>> 0, 203)
        m.set(pData, D2ItemDataStrc.wAutoAffix, 301)
      }

      expect(ITEMS_AreAffixesEqual113c(m, pItem1, pItem2)).toBe(1)

      m.set(pData2, D2ItemDataStrc.wAutoAffix, 302)
      expect(ITEMS_AreAffixesEqual113c(m, pItem1, pItem2)).toBe(0)

      m.set(pData2, D2ItemDataStrc.wAutoAffix, 301)
      m.setU16((pData2 + D2ItemDataStrc.wMagicSuffix.off + 2) >>> 0, 999)
      expect(ITEMS_AreAffixesEqual113c(m, pItem1, pItem2)).toBe(0)
    })

    it('0x6FCF1720 ITEMS_GetOppositeHandOrRingBodyLoc113c & 0x6FCF1790 ITEMMODE_UnitTimerNoop113c', () => {
      const m = new SparseMemory113c()
      expect(ITEMMODE_UnitTimerNoop113c(m, 1, 2)).toBeUndefined()

      expect(ITEMS_GetOppositeHandOrRingBodyLoc113c(m, 4)).toBe(5)
      expect(ITEMS_GetOppositeHandOrRingBodyLoc113c(m, 5)).toBe(4)
      expect(ITEMS_GetOppositeHandOrRingBodyLoc113c(m, 6)).toBe(7)
      expect(ITEMS_GetOppositeHandOrRingBodyLoc113c(m, 7)).toBe(6)
      expect(ITEMS_GetOppositeHandOrRingBodyLoc113c(m, 11)).toBe(12)
      expect(ITEMS_GetOppositeHandOrRingBodyLoc113c(m, 12)).toBe(11)
      for (const other of [0, 1, 2, 3, 8, 9, 10, 13, -1]) {
        expect(ITEMS_GetOppositeHandOrRingBodyLoc113c(m, other)).toBe(0)
      }
    })

    it('0x6FCF1950 ITEMS_AreWeaponSlotTypesCompatible113c & 0x6FCF1A00 ITEMS_DoItemRecordsMatchCodePair113c', () => {
      const m = new SparseMemory113c()
      const a = 0x130000
      const b = 0x130100
      m.fill(a, 0x28, 0)
      m.fill(b, 0x28, 0)

      expect(ITEMS_AreWeaponSlotTypesCompatible113c(m, 0, b)).toBe(0)
      // Bow (+0x00) + Arrows (+0x08)
      m.setU32(a, 1)
      m.setU32((b + 0x08) >>> 0, 1)
      expect(ITEMS_AreWeaponSlotTypesCompatible113c(m, a, b)).toBe(1)
      expect(ITEMS_AreWeaponSlotTypesCompatible113c(m, b, a)).toBe(1)

      // 1H weapon (+0x14 = 1, +0x18 = 0) + Shield (+0x10 = 1)
      m.fill(a, 0x28, 0)
      m.fill(b, 0x28, 0)
      m.setU32((a + 0x14) >>> 0, 1)
      m.setU32((b + 0x10) >>> 0, 1)
      expect(ITEMS_AreWeaponSlotTypesCompatible113c(m, a, b)).toBe(1)
      // 2H weapon (+0x18 = 1) + Shield -> 0
      m.setU32((a + 0x18) >>> 0, 1)
      expect(ITEMS_AreWeaponSlotTypesCompatible113c(m, a, b)).toBe(0)

      // Dual-wield 1H weapons (+0x14 = 1, +0x18 = 0, +0x1C = 1 on both)
      m.setU32((a + 0x18) >>> 0, 0)
      m.setU32((a + 0x1c) >>> 0, 1)
      m.setU32((b + 0x10) >>> 0, 0)
      m.setU32((b + 0x14) >>> 0, 1)
      m.setU32((b + 0x1c) >>> 0, 1)
      expect(ITEMS_AreWeaponSlotTypesCompatible113c(m, a, b)).toBe(1)

      // Code pair matching at +0x80
      const recA = 0x131000
      const recB = 0x132000
      m.fill(recA, 0x100, 0)
      m.fill(recB, 0x100, 0)
      m.setU32((recA + 0x80) >>> 0, 0x20776f62) // 'bow '
      m.setU32((recB + 0x80) >>> 0, 0x20767161) // 'aqv '
      expect(ITEMS_DoItemRecordsMatchCodePair113c(m, recA, recB, 0x20776f62, 0x20767161)).toBe(1)
      expect(ITEMS_DoItemRecordsMatchCodePair113c(m, recA, recB, 0x20767161, 0x20776f62)).toBe(1)
      expect(ITEMS_DoItemRecordsMatchCodePair113c(m, recA, recB, 0x20776f62, 0x11111111)).toBe(0)
    })

    it('0x6FCF1BC0 ITEMS_HasSocketedSubItems113c & 0x6FCF1E10 ITEMS_BuildItemDropParamsFromItem113c', () => {
      const m = new SparseMemory113c()
      const pItemsTxt = 0x140000
      m.fill(pItemsTxt, 2 * D2ItemsTxt_SIZE, 0)
      m.setU32(ITEMS_TXT_COUNT_VA_113C, 2)
      m.setU32(ITEMS_TXT_PTR_VA_113C, pItemsTxt)
      m.set(pItemsTxt, D2ItemsTxt.nSubType, 1)

      const pItem = 0x141000
      const pItemData = 0x141200
      const pInv = 0x141400
      const pStaticPath = 0x141600
      m.fill(pInv, 0x40, 0)
      m.fill(pStaticPath, 0x40, 0)
      setupItemUnit(m, pItem, pItemData, 0, 55)
      m.set(pItem, D2UnitStrc.pInventory, pInv)
      m.set(pItem, D2UnitStrc.pPath, pStaticPath)
      m.setU32((pStaticPath + 0x0c) >>> 0, 6123)
      m.setU32((pStaticPath + 0x10) >>> 0, 6456)
      m.setU32((pItem + 0x28) >>> 0, 0xfeedface)
      m.set(pItemData, D2ItemDataStrc.dwItemLevel, 85)
      m.set(pItemData, D2ItemDataStrc.dwOwnerGuid, 42)

      m.set(pInv, D2InventoryStrc.dwSignature, INVENTORY_SIGNATURE_113C)
      m.set(pInv, D2InventoryStrc.dwItemCount, 0)
      expect(ITEMS_HasSocketedSubItems113c(m, pItem)).toBe(0)

      m.set(pInv, D2InventoryStrc.dwItemCount, 2)
      expect(ITEMS_HasSocketedSubItems113c(m, pItem)).toBe(1)

      // Build D2ItemDropStrc (0x84 bytes)
      const pGame = 0x142000
      const pOutDrop = 0x143000
      m.fill(pGame, 0x100, 0)
      m.fill(pOutDrop, 0x90, 0)
      m.setU16((pGame + 0x78) >>> 0, 101)
      m.setU32((pOutDrop + 0x80) >>> 0, 0xffffffff)

      ITEMS_BuildItemDropParamsFromItem113c(m, pOutDrop, pItem, pGame, 123)
      expect(m.u32((pOutDrop + 0x04) >>> 0)).toBe((pItem + 0x20) >>> 0)
      expect(m.u32((pOutDrop + 0x08) >>> 0)).toBe(pGame)
      expect(m.u32((pOutDrop + 0x0c) >>> 0)).toBe(85)
      expect(m.u32((pOutDrop + 0x14) >>> 0)).toBe(123)
      expect(m.u32((pOutDrop + 0x18) >>> 0)).toBe(4)
      expect(m.u32((pOutDrop + 0x1c) >>> 0)).toBe(6123)
      expect(m.u32((pOutDrop + 0x20) >>> 0)).toBe(6456)
      expect(m.u16((pOutDrop + 0x28) >>> 0)).toBe(1)
      expect(m.u16((pOutDrop + 0x2a) >>> 0)).toBe(101)
      expect(m.u32((pOutDrop + 0x30) >>> 0)).toBe(2)
      expect(m.u32((pOutDrop + 0x40) >>> 0)).toBe(2)
      expect(m.u32((pOutDrop + 0x48) >>> 0)).toBe(0xfeedface)
      expect(m.u32((pOutDrop + 0x4c) >>> 0)).toBe(42)
      expect(m.u32((pOutDrop + 0x80) >>> 0)).toBe(0)
    })

    it('0x6FCF29F0 ITEMS_ClearInventoryCmdFlag4AndSync3F113c clears bit 0x04 and queues S2C 0x3F for player units', () => {
      const m = new SparseMemory113c()
      const pPlayer = 0x150000
      const pPlayerData = 0x150200
      const pClient = 0x150400
      const pQueue = 0x150800
      const pInv = 0x151000
      m.fill(pInv, 0x40, 0)
      setupPlayerWithClient(m, pPlayer, pPlayerData, pClient, pQueue, 1)
      m.set(pPlayer, D2UnitStrc.pInventory, pInv)
      m.set(pInv, D2InventoryStrc.dwSignature, INVENTORY_SIGNATURE_113C)

      const pItem1 = 0x152000
      const pData1 = 0x152200
      const pItem2 = 0x153000
      const pData2 = 0x153200
      setupItemUnit(m, pItem1, pData1, 0, 0x11223344)
      setupItemUnit(m, pItem2, pData2, 0, 0x55667788)
      m.set(pData1, D2ItemDataStrc.dwCommandFlags, 0x14) // bit 0x04 set
      m.set(pData2, D2ItemDataStrc.dwCommandFlags, 0x10) // bit 0x04 clear

      m.set(pInv, D2InventoryStrc.pFirstItem, pItem1)
      m.setU32((pData1 + 0x5c + 0x08) >>> 0, pItem2)

      ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pPlayer)
      expect(m.get(pData1, D2ItemDataStrc.dwCommandFlags)).toBe(0x10)
      expect(m.get(pData2, D2ItemDataStrc.dwCommandFlags)).toBe(0x10)
      expect(readQueuedBytes(m, pQueue)).toEqual([0x3f, 0xff, 0x44, 0x33, 0x22, 0x11, 0xff, 0xff])
    })

    it('0x6FCFAE20 SUNITDMG_GetDefenderColdEffect113c reads signed MonStats.txt coldEffect[difficulty] or returns -50', () => {
      const m = new SparseMemory113c()
      const pTables = 0x160000
      const pMonStats = 0x161000
      m.fill(pTables, 0xd00, 0)
      m.fill(pMonStats, 10 * 0x1a8, 0)
      m.setU32(SGPT_DATATABLES_VA_113C, pTables)
      m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, SGPT_DATATABLES_VA_113C)
      m.setU32((pTables + 0xa78) >>> 0, pMonStats)
      m.setU32((pTables + 0xa80) >>> 0, 10)

      // Class 3: coldEffect = [-50, -33, 0] at +0x168..+0x16A
      const pRow3 = (pMonStats + 3 * 0x1a8) >>> 0
      m.setU8((pRow3 + 0x168) >>> 0, (-50) & 0xff)
      m.setU8((pRow3 + 0x169) >>> 0, (-33) & 0xff)
      m.setU8((pRow3 + 0x16a) >>> 0, 0)

      const pGame = 0x165000
      const pMonster = 0x166000
      m.fill(pGame, 0x100, 0)
      m.fill(pMonster, 0x100, 0)
      m.set(pMonster, D2UnitStrc.dwUnitType, 1)
      m.set(pMonster, D2UnitStrc.dwClassId, 3)

      m.setU8((pGame + 0x6d) >>> 0, 0)
      expect(SUNITDMG_GetDefenderColdEffect113c(m, pMonster, pGame)).toBe(-50)
      m.setU8((pGame + 0x6d) >>> 0, 1)
      expect(SUNITDMG_GetDefenderColdEffect113c(m, pMonster, pGame)).toBe(-33)
      m.setU8((pGame + 0x6d) >>> 0, 2)
      expect(SUNITDMG_GetDefenderColdEffect113c(m, pMonster, pGame)).toBe(0)

      // Player or out-of-range monster -> -50
      m.set(pMonster, D2UnitStrc.dwUnitType, 0)
      expect(SUNITDMG_GetDefenderColdEffect113c(m, pMonster, pGame)).toBe(-50)
      expect(SUNITDMG_GetDefenderColdEffect113c(m, 0, pGame)).toBe(-50)
    })
  })
})
