import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { STATES_CheckState113c } from '../../../src/d2kern-113c/common/statlist.ts'
import * as w2b4Exports from '../../../src/d2kern-113c/game/k2-w2b4-113c.ts'
import {
  CLIENT_RemoveClientFromAdjacentRooms_6FCBD550_113c,
  D2GAME_ITEM_CLEAR_CMD_FLAGS_ARRAY_VA_113C,
  D2GAME_ITEM_CLEAR_CMD_FLAGS_COUNT_VA_113C,
  D2GAME_ITEM_CLEAR_FLAGS_ARRAY_VA_113C,
  D2GAME_ITEM_CLEAR_FLAGS_COUNT_VA_113C,
  D2GAME_SRVDOFUNC_TABLE_VA_113C,
  EVENT_DestroyTimerQueue_6FCAE4D0_113c,
  ITEMS_ClearAllDupeAndCommandFlags_6FCBB340_113c,
  ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c,
  ITEMS_SendCursorPutItemPacket04_6FCADF70_113c,
  ITEMS_SendDropToGroundPacket02_6FCAE030_113c,
  ITEMS_SendGroundItemPacket03_6FCADFD0_113c,
  ITEMS_SendRemoveContainerItemPacket0A_6FCADF10_113c,
  ITEMS_SendSwapContainerItemPacket0D_6FCADEB0_113c,
  ITEMS_ZeroStaticPosAndSendPickupPacket01_6FCAE090_113c,
  MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c,
  MONAI_NoOpStub_6FCBC990_113c,
  PARTY_AllocNextPartyId_6FCBBD40_113c,
  PARTY_AllocPartyControl_6FCBBE40_113c,
  PARTY_FindSubPartyById_6FCBBD00_113c,
  PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c,
  PARTY_SplitGoldPickupByCap_6FCBBC70_113c,
  S2C_QueueByteDwordPacket6_6FCAC3B0_113c,
  S2C_QueueLocationPacket11_6FCABF80_113c,
  S2C_QueueMonsterMovePacket12_6FCAC160_113c,
  S2C_QueueSingleBytePacket1_6FCAC490_113c,
  S2C_QueueUnitTargetMovePacket16_6FCAC230_113c,
  S2C_Send7BytePacketToPlayerUnit_6FCAC5F0_113c,
  S2C_Send10BytePacketToPlayerUnit_6FCAC530_113c,
  S2C_Send11BytePacketToPlayerUnit_6FCAC690_113c,
  SKILLS_CanMonsterReviveOrTeleportInMode_6FCBC9A0_113c,
  SKILLS_ComputeMercSkillDamageAndToHit_6FCBE330_113c,
  SKILLS_CorpseSearchFilterCallback_6FCBE2E0_113c,
  SKILLS_DispatchSrvDoFunc_6FCBE420_113c,
  SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c,
  SKILLS_FindFirstZeroByteOffsetInSeqRecord_6FCB83B0_113c,
  SKILLS_RefreshPassiveSkillsAndIconsOnUnit_6FCBE370_113c,
  SKILLS_SrvSt22_ValidateNonTownPlayerOrMonsterTarget_6FCB2060_113c,
  SKILLS_SrvSt23_ValidateMeleeTarget_6FCB2030_113c,
  SKILLS_SrvSt25_ValidateDistinctTarget_6FCB1B40_113c,
  SKILLS_SrvSt36_HasEquippedShield_6FCB8390_113c,
  SUMMON_GetFirstPetGuidForType_6FCB67B0_113c,
  SUMMON_GetPetTypeBucketPtr_6FCB6540_113c,
  SUNITPROXY_FindNpcSlotByUnit_6FCAF820_113c,
  SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c,
  SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c,
  STATES_ClearGfxStateFlagAndSetUpdate40_6FCB0F10_113c,
  STATES_ClearGfxStateFlagCallback_6FCB0F00_113c,
  VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c,
  VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c,
} from '../../../src/d2kern-113c/game/k2-w2b4-113c.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2DynamicPathStrc,
  D2DynamicPathStrc_SIZE,
  D2ItemDataStrc,
  D2ItemDataStrc_SIZE,
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2ItemTypesTxt_SIZE,
  D2MissileDataStrc,
  D2MissileDataStrc_SIZE,
  D2MonStats2Txt,
  D2MonStats2Txt_SIZE,
  D2MonStatsTxt,
  D2MonStatsTxt_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2SkillsTxt,
  D2SkillsTxt_SIZE,
  D2StatListExStrc,
  D2StatListExStrc_SIZE,
  D2StatListStrc,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function createKernelMem(): { m: SparseMemory113c; pDataTables: number } {
  const m = new SparseMemory113c()
  m.fill(0x6fd10000, 0x30000, 0)
  m.fill(0x6fdd6000, 0x20000, 0)
  const pDataTables = m.alloc(0x2000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)

  const pBitMasks = m.alloc(128)
  for (let i = 0; i < 32; i++) {
    m.setU32(pBitMasks + i * 4, (1 << i) >>> 0)
  }
  m.setU32(0x6fdd90b0, pBitMasks)

  const pItemsTxt = m.alloc(8 * D2ItemsTxt_SIZE)
  m.setU32(0x6fdefb94, 8)
  m.setU32(0x6fdefb98, pItemsTxt)
  const pItemTypesTxt = m.alloc(64 * D2ItemTypesTxt_SIZE)
  m.setU32(pDataTables + 0xbf8, pItemTypesTxt)
  m.setU32(pDataTables + 0xbfc, 64)
  const pItemTypesEquiv = m.alloc(64 * 2 * 4)
  m.setU32(pDataTables + 0xc00, 2)
  m.setU32(pDataTables + 0xc04, pItemTypesEquiv)

  const pMonStatsTxt = m.alloc(16 * D2MonStatsTxt_SIZE)
  const pMonStats2Txt = m.alloc(16 * D2MonStats2Txt_SIZE)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, 16)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, 16)

  const pSkillsTxt = m.alloc(16 * D2SkillsTxt_SIZE)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 16)
  m.setU32(pDataTables + 0xc4, 256)

  const pIsc = m.alloc(360 * 0x144)
  m.setU32(pDataTables + 0xbcc, pIsc)
  m.setU32(pDataTables + 0xbd4, 360)

  const pExpTxt = m.alloc(64)
  m.setU32(pExpTxt, 99)
  m.setU32(0x6fdf0b50, pExpTxt)

  const pCorpseMask = m.alloc(32)
  m.setU32(pDataTables + 0x150, pCorpseMask)

  return { m, pDataTables }
}

function allocClientWithQueue(m: SparseMemory113c): { pClient: number; pQueue: number } {
  const pClient = m.alloc(0x240)
  const pQueue = m.alloc(0x410)
  m.setU32(pClient + 0x1bc, pQueue)
  return { pClient, pQueue }
}

function allocPlayerWithClient(m: SparseMemory113c): {
  pPlayer: number
  pPlayerData: number
  pClient: number
  pQueue: number
} {
  const { pClient, pQueue } = allocClientWithQueue(m)
  const pPlayer = m.alloc(0x100)
  const pPlayerData = m.alloc(0x100)
  m.setU32(pPlayer + D2UnitStrc.dwUnitType.off, 0)
  m.setU32(pPlayer + D2UnitStrc.pUnitData.off, pPlayerData)
  m.setU32(pPlayerData + 0x9c, pClient)
  return { pPlayer, pPlayerData, pClient, pQueue }
}

function allocBasicItemForPacket9C(m: SparseMemory113c): number {
  const pItem = m.alloc(0x100)
  const pItemData = m.alloc(D2ItemDataStrc_SIZE)
  const pStaticPath = m.alloc(0x40)
  m.setU32(pItem + D2UnitStrc.dwUnitType.off, 4)
  m.setU32(pItem + D2UnitStrc.dwClassId.off, 0)
  m.setU32(pItem + D2UnitStrc.dwUnitId.off, 0x77)
  m.setU32(pItem + D2UnitStrc.pUnitData.off, pItemData)
  m.setU32(pItem + D2UnitStrc.pPath.off, pStaticPath)
  m.setU32(pItemData + D2ItemDataStrc.dwQuality.off, 2)
  m.setU32(pItemData + D2ItemDataStrc.dwItemFlags.off, 0x10)
  const pItemsTxt = m.u32(0x6fdefb98)
  m.setU32(pItemsTxt + D2ItemsTxt.dwCode.off, 0x20706163) // 'cap '
  m.setU8(pItemsTxt + 0x137, 1) // nCompactSave
  return pItem
}

describe('[K2] Wave 2 Batch 4 (w2b4: 0x6FCABF80..0x6FCBE490)', () => {
  it('exports all 45 target functions', () => {
    const fnCount = Object.values(w2b4Exports).filter((v) => typeof v === 'function').length
    expect(fnCount).toBe(45)
  })

  it('S2C packet queue helpers (0x6FCABF80..0x6FCAC690) serialize and queue exact bytes', () => {
    const { m } = createKernelMem()

    // 1. S2C_QueueLocationPacket11_6FCABF80_113c (11 bytes)
    const c1 = allocClientWithQueue(m)
    // D2Game.dll@0x6FCAA3E0 returns queued byte count (`nPacketSize`) on success.
    expect(
      S2C_QueueLocationPacket11_6FCABF80_113c(
        m,
        0x15,
        0x01,
        0x11223344,
        c1.pClient,
        0x1234,
        0x5678,
        0x09,
      ),
    ).toBe(11)
    expect(m.u32(c1.pQueue + 0x00)).toBe(11)
    expect(m.u8(c1.pQueue + 0x04)).toBe(0x15)
    expect(m.u8(c1.pQueue + 0x05)).toBe(0x01)
    expect(m.u32(c1.pQueue + 0x06)).toBe(0x11223344)
    expect(m.u16(c1.pQueue + 0x0a)).toBe(0x1234)
    expect(m.u16(c1.pQueue + 0x0c)).toBe(0x5678)
    expect(m.u8(c1.pQueue + 0x0e)).toBe(0x09)

    // 2. S2C_QueueMonsterMovePacket12_6FCAC160_113c (12 bytes)
    const c2 = allocClientWithQueue(m)
    expect(
      S2C_QueueMonsterMovePacket12_6FCAC160_113c(
        m,
        0x67,
        0xdeadbeef,
        c2.pClient,
        0xaa,
        0xbb,
        0x01020304,
        0xcc,
      ),
    ).toBe(12)
    expect(m.u32(c2.pQueue + 0x00)).toBe(12)
    expect(m.u8(c2.pQueue + 0x04)).toBe(0x67)
    expect(m.u32(c2.pQueue + 0x05)).toBe(0xdeadbeef)
    expect(m.u8(c2.pQueue + 0x09)).toBe(0xaa)
    expect(m.u8(c2.pQueue + 0x0a)).toBe(0xbb)
    expect(m.u32(c2.pQueue + 0x0b)).toBe(0x01020304)
    expect(m.u8(c2.pQueue + 0x0f)).toBe(0xcc)

    // 3. S2C_QueueUnitTargetMovePacket16_6FCAC230_113c (16 bytes)
    const c3 = allocClientWithQueue(m)
    expect(
      S2C_QueueUnitTargetMovePacket16_6FCAC230_113c(
        m,
        0x68,
        0x01,
        0x100,
        c3.pClient,
        0x02,
        0x00,
        0x200,
        0x1111,
        0x2222,
      ),
    ).toBe(16)
    expect(m.u32(c3.pQueue + 0x00)).toBe(16)
    expect(m.u8(c3.pQueue + 0x04)).toBe(0x68)
    expect(m.u8(c3.pQueue + 0x05)).toBe(0x01)
    expect(m.u32(c3.pQueue + 0x06)).toBe(0x100)
    expect(m.u8(c3.pQueue + 0x0a)).toBe(0x02)
    expect(m.u8(c3.pQueue + 0x0b)).toBe(0x00)
    expect(m.u32(c3.pQueue + 0x0c)).toBe(0x200)
    expect(m.u16(c3.pQueue + 0x10)).toBe(0x1111)
    expect(m.u16(c3.pQueue + 0x12)).toBe(0x2222)

    // 4. S2C_QueueByteDwordPacket6_6FCAC3B0_113c (6 bytes)
    const c4 = allocClientWithQueue(m)
    expect(S2C_QueueByteDwordPacket6_6FCAC3B0_113c(m, 0x20, 0x03, 0x89abcdef, c4.pClient)).toBe(6)
    expect(m.u32(c4.pQueue + 0x00)).toBe(6)
    expect(m.u8(c4.pQueue + 0x04)).toBe(0x20)
    expect(m.u8(c4.pQueue + 0x05)).toBe(0x03)
    expect(m.u32(c4.pQueue + 0x06)).toBe(0x89abcdef)

    // 5. S2C_QueueSingleBytePacket1_6FCAC490_113c (1 byte)
    const c5 = allocClientWithQueue(m)
    expect(S2C_QueueSingleBytePacket1_6FCAC490_113c(m, 0x97, c5.pClient)).toBe(1)
    expect(m.u32(c5.pQueue + 0x00)).toBe(1)
    expect(m.u8(c5.pQueue + 0x04)).toBe(0x97)

    // 6-8. S2C_Send10/7/11BytePacketToPlayerUnit
    const pBuf = m.alloc(16)
    for (let i = 0; i < 12; i++) {
      m.setU8(pBuf + i, 0x30 + i)
    }
    const p6 = allocPlayerWithClient(m)
    expect(S2C_Send10BytePacketToPlayerUnit_6FCAC530_113c(m, p6.pPlayer, pBuf)).toBe(10)
    expect(m.u32(p6.pQueue + 0x00)).toBe(10)
    expect(S2C_Send10BytePacketToPlayerUnit_6FCAC530_113c(m, 0, pBuf)).toBe(0)

    const p7 = allocPlayerWithClient(m)
    expect(S2C_Send7BytePacketToPlayerUnit_6FCAC5F0_113c(m, p7.pPlayer, pBuf)).toBe(7)
    expect(m.u32(p7.pQueue + 0x00)).toBe(7)

    const p8 = allocPlayerWithClient(m)
    expect(S2C_Send11BytePacketToPlayerUnit_6FCAC690_113c(m, p8.pPlayer, pBuf)).toBe(11)
    expect(m.u32(p8.pQueue + 0x00)).toBe(11)
  })

  it('ITEMS_Send*Packet0E..01 (0x6FCADE50..0x6FCAE090) assert client match and emit 0x9C actions', () => {
    const { m } = createKernelMem()
    const { pPlayer, pClient, pQueue } = allocPlayerWithClient(m)
    const pItem = allocBasicItemForPacket9C(m)
    const pStaticPath = m.u32(pItem + D2UnitStrc.pPath.off)
    m.setU32(pStaticPath + 0x0c, 123)
    m.setU32(pStaticPath + 0x10, 456)

    // Mismatched client throws D2CommonAssertError on each wrapper
    expect(() =>
      ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c(m, pPlayer, pClient + 4, pItem, 0),
    ).toThrow(D2CommonAssertError)
    expect(() =>
      ITEMS_SendSwapContainerItemPacket0D_6FCADEB0_113c(m, pPlayer, pClient + 4, pItem, 0),
    ).toThrow(D2CommonAssertError)
    expect(() =>
      ITEMS_SendRemoveContainerItemPacket0A_6FCADF10_113c(m, pPlayer, pClient + 4, pItem, 0),
    ).toThrow(D2CommonAssertError)
    expect(() =>
      ITEMS_SendCursorPutItemPacket04_6FCADF70_113c(m, pPlayer, pClient + 4, pItem, 0),
    ).toThrow(D2CommonAssertError)
    expect(() =>
      ITEMS_SendGroundItemPacket03_6FCADFD0_113c(m, pPlayer, pClient + 4, pItem, 0),
    ).toThrow(D2CommonAssertError)
    expect(() =>
      ITEMS_SendDropToGroundPacket02_6FCAE030_113c(m, pPlayer, pClient + 4, pItem, 0),
    ).toThrow(D2CommonAssertError)
    expect(() =>
      ITEMS_ZeroStaticPosAndSendPickupPacket01_6FCAE090_113c(m, pPlayer, pItem, pClient + 4, 0),
    ).toThrow(D2CommonAssertError)

    // Matching client sends 0x9C with each action code
    const checkAction = (fn: () => void, expectedAction: number) => {
      m.setU32(pQueue, 0)
      m.setU32(pClient + 0x1b8, pQueue)
      m.setU32(pClient + 0x1bc, pQueue)
      fn()
      expect(m.u32(pQueue)).toBeGreaterThan(2)
      expect(m.u8(pQueue + 0x04)).toBe(0x9c)
      expect(m.u8(pQueue + 0x05)).toBe(expectedAction)
    }

    checkAction(() => ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c(m, pPlayer, pClient, pItem, 0), 0x0e)
    checkAction(() => ITEMS_SendSwapContainerItemPacket0D_6FCADEB0_113c(m, pPlayer, pClient, pItem, 0), 0x0d)
    checkAction(() => ITEMS_SendRemoveContainerItemPacket0A_6FCADF10_113c(m, pPlayer, pClient, pItem, 0), 0x0a)
    checkAction(() => ITEMS_SendCursorPutItemPacket04_6FCADF70_113c(m, pPlayer, pClient, pItem, 0), 0x04)
    checkAction(() => ITEMS_SendGroundItemPacket03_6FCADFD0_113c(m, pPlayer, pClient, pItem, 0), 0x03)
    checkAction(() => ITEMS_SendDropToGroundPacket02_6FCAE030_113c(m, pPlayer, pClient, pItem, 0), 0x02)
    checkAction(
      () => ITEMS_ZeroStaticPosAndSendPickupPacket01_6FCAE090_113c(m, pPlayer, pItem, pClient, 0),
      0x01,
    )
    expect(m.u32(pStaticPath + 0x0c)).toBe(0)
    expect(m.u32(pStaticPath + 0x10)).toBe(0)
  })

  it('EVENT_DestroyTimerQueue_6FCAE4D0_113c frees slab chain and clears pGame->pTimerQueue (+0xB8)', () => {
    const { m } = createKernelMem()
    const pGame = m.alloc(0x100)
    m.setU32(pGame + 0x1c, 0x9999)

    // Null timer queue is a safe no-op
    EVENT_DestroyTimerQueue_6FCAE4D0_113c(m, pGame)

    const pTimerQueue = m.alloc(0xb00)
    const pChunk1 = m.alloc(0x7090)
    const pChunk2 = m.alloc(0x7090)
    m.setU32(pChunk1 + 0x7084, pChunk2)
    m.setU32(pChunk2 + 0x7084, 0)
    m.setU32(pTimerQueue + 0xa1c, pChunk1)
    m.setU32(pGame + 0xb8, pTimerQueue)

    const freed: Array<{ pool: number; ptr: number; line: number }> = []
    EVENT_DestroyTimerQueue_6FCAE4D0_113c(m, pGame, {
      freePoolMemory: (_m, pool, ptr, _file, line) => {
        freed.push({ pool, ptr, line })
      },
    })
    expect(freed).toEqual([
      { pool: 0x9999, ptr: pChunk1, line: 0x314 },
      { pool: 0x9999, ptr: pChunk2, line: 0x314 },
      { pool: 0x9999, ptr: pTimerQueue, line: 0x317 },
    ])
    expect(m.u32(pGame + 0xb8)).toBe(0)
  })

  it('SUNITPROXY functions (0x6FCAF6C0, 0x6FCAF820, 0x6FCAFAA0) manage NPC proxy slots and lists', () => {
    const { m } = createKernelMem()
    const pGame = m.alloc(0x1e00)
    const pSlot = m.alloc(0x44)
    const pTarget = m.alloc(0x40)
    m.setU32(pTarget + 0x0c, 0x4242)

    // Allocate new node in pSlot->pList18
    const pNode1 = SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c(m, pTarget, pSlot, pGame)
    expect(pNode1).toBeGreaterThan(0)
    expect(m.u32(pNode1)).toBe(0x4242)
    expect(m.u32(pSlot + 0x18)).toBe(pNode1)

    // Finding existing node returns same pointer
    expect(SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c(m, pTarget, pSlot, pGame)).toBe(pNode1)

    // Null pTargetUnit uses 0xFFFFFFFF GUID
    const pNodeNull = SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c(m, 0, pSlot, pGame)
    expect(m.u32(pNodeNull)).toBe(0xffffffff)
    expect(m.u32(pNodeNull + 0x08)).toBe(pNode1)

    // Setup arena/NPC proxy table at pGame + 0x1D24
    const pArena = m.alloc(0x20)
    const pTable = m.alloc(0x40 * 0x44)
    m.setU32(pGame + 0x1d24, pArena)
    m.setU32(pArena + 0x04, pTable)
    const pSlot3 = pTable + 3 * 0x44
    m.setU32(pSlot3, 150) // classId 150 (Kashya)

    const pNpc = m.alloc(0x40)
    m.setU32(pNpc + 0x04, 150)
    const pOutIdx = m.alloc(4)
    expect(SUNITPROXY_FindNpcSlotByUnit_6FCAF820_113c(m, pNpc, pGame, pOutIdx)).toBe(pSlot3)
    expect(m.u32(pOutIdx)).toBe(3)

    // SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c
    const pPlayer = m.alloc(0x40)
    m.setU32(pPlayer + 0x0c, 0x777)
    expect(SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c(m, pNpc, pGame, pPlayer)).toBe(0)

    const pPlayerNode = m.alloc(12)
    m.setU32(pPlayerNode, 0xabcdef01)
    m.setU32(pPlayerNode + 0x04, 0x777)
    m.setU32(pSlot3 + 0x08, pPlayerNode)
    m.setU32(pSlot3 + 0x0c, 1)
    expect(SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c(m, pNpc, pGame, pPlayer)).toBe(
      0xabcdef01,
    )
  })

  it('MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c caps frames at 0x4D, seeds PRNG, and configures path', () => {
    const { m } = createKernelMem()
    MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c(m, 0, 123)

    const pMissile = m.alloc(0x100)
    const pMisData = m.alloc(D2MissileDataStrc_SIZE)
    const pPath = m.alloc(D2DynamicPathStrc_SIZE)
    m.setU32(pMissile + D2UnitStrc.dwUnitType.off, 3)
    m.setU32(pMissile + D2UnitStrc.pUnitData.off, pMisData)
    m.setU32(pMissile + D2UnitStrc.pPath.off, pPath)
    m.setU32(pPath + D2DynamicPathStrc.pUnit.off, pMissile)
    m.setU16(pMisData + D2MissileDataStrc.nTotalFrames.off, 100)

    MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c(m, pMissile, 0x13572468)
    expect(m.u16(pMisData + D2MissileDataStrc.nTotalFrames.off)).toBe(0x4d)
    expect(m.u16(pMisData + D2MissileDataStrc.nRemainingFrames.off)).toBe(0x4d)
    expect(m.u32(pMissile + 0x20)).toBe(0x13572468)
    expect(m.u32(pPath + D2DynamicPathStrc.dwPathType.off)).toBe(0x0a)
  })

  it('STATES_ClearGfxStateFlagCallback (0x6FCB0F00) and SetUpdate40 (0x6FCB0F10) clear state and set 0x40', () => {
    const { m } = createKernelMem()
    const pUnit = m.alloc(0x100)
    const pListEx = m.alloc(D2StatListExStrc_SIZE)
    const pStateFlags = m.alloc(64)
    m.setU32(pUnit + D2UnitStrc.pStatListEx.off, pListEx)
    m.setU32(pListEx + D2StatListStrc.dwFlags.off, 0x80000000)
    m.setU32(pListEx + D2StatListExStrc.pStateFlags.off, pStateFlags)

    m.setU32(pStateFlags, 1 << 5)
    expect(STATES_CheckState113c(m, pUnit, 5)).toBeGreaterThan(0)
    STATES_ClearGfxStateFlagCallback_6FCB0F00_113c(m, pUnit, 5)
    expect(STATES_CheckState113c(m, pUnit, 5)).toBe(0)
    expect(m.u32(pUnit + 0xc4) & 0x40).toBe(0)

    m.setU32(pStateFlags, 1 << 6)
    STATES_ClearGfxStateFlagAndSetUpdate40_6FCB0F10_113c(m, pUnit, 6)
    expect(STATES_CheckState113c(m, pUnit, 6)).toBe(0)
    expect(m.u32(pUnit + 0xc4) & 0x40).toBe(0x40)
  })

  it('SKILLS_SrvSt25/23/22 target validators (0x6FCB1B40, 0x6FCB2030, 0x6FCB2060) validate path targets', () => {
    const { m } = createKernelMem()
    const pGame = m.alloc(0x2000)
    const pUnit = m.alloc(0x100)
    const pPath = m.alloc(D2DynamicPathStrc_SIZE)
    m.setU32(pUnit + D2UnitStrc.pPath.off, pPath)

    // No target -> 0
    expect(SKILLS_SrvSt25_ValidateDistinctTarget_6FCB1B40_113c(m, pGame, pUnit)).toBe(0)

    // Register pTarget in pGame server unit list (type 1 = monster, id = 5 -> bucket 5 at pGame + 0x1320 + 5*4)
    const pTarget = m.alloc(0x100)
    const pTargetPath = m.alloc(D2DynamicPathStrc_SIZE)
    m.setU32(pTarget + D2UnitStrc.dwUnitType.off, 1)
    m.setU32(pTarget + D2UnitStrc.dwUnitId.off, 5)
    m.setU32(pTarget + D2UnitStrc.pPath.off, pTargetPath)
    m.setU32(pGame + 0x1320 + 5 * 4, pTarget)

    m.setU32(pPath + D2DynamicPathStrc.pTargetUnit.off, pTarget)
    m.setU32(pPath + 0x5c, 1)
    m.setU32(pPath + 0x60, 5)
    expect(SKILLS_SrvSt25_ValidateDistinctTarget_6FCB1B40_113c(m, pGame, pUnit)).toBe(1)

    // SrvSt23: melee range check (both at pos 0,0 -> dist 0 -> returns 1)
    expect(SKILLS_SrvSt23_ValidateMeleeTarget_6FCB2030_113c(m, pGame, pUnit)).toBe(1)

    // SrvSt22: non-town room + target type 0 or 1
    const pRoomWild = m.alloc(D2ActiveRoomStrc_SIZE)
    const pRoomExWild = m.alloc(D2RoomExStrc_SIZE)
    const pLevelWild = m.alloc(0x200)
    m.setU32(pLevelWild + 0x1d0, 2) // Blood Moor (not town)
    m.setU32(pRoomExWild + D2RoomExStrc.pLevel.off, pLevelWild)
    m.setU32(pRoomWild + D2ActiveRoomStrc.pRoomEx.off, pRoomExWild)
    m.setU32(pPath + D2DynamicPathStrc.pRoom.off, pRoomWild)
    m.setU32(pTargetPath + D2DynamicPathStrc.pRoom.off, pRoomWild)
    expect(
      SKILLS_SrvSt22_ValidateNonTownPlayerOrMonsterTarget_6FCB2060_113c(m, pGame, pUnit),
    ).toBe(1)

    // In town (level 1 = Rogue Encampment) -> returns 0
    m.setU32(pLevelWild + 0x1d0, 1)
    expect(
      SKILLS_SrvSt22_ValidateNonTownPlayerOrMonsterTarget_6FCB2060_113c(m, pGame, pUnit),
    ).toBe(0)
  })

  it('SUMMON_GetPetTypeBucketPtr (0x6FCB6540) and SUMMON_GetFirstPetGuidForType (0x6FCB67B0) lookup pet buckets', () => {
    const { m, pDataTables } = createKernelMem()
    m.setU32(pDataTables + 0xbf0, 8) // 8 pet types
    const pPlayerPets = m.alloc(8)
    const pBuckets = m.alloc(8 * 12)
    m.setU32(pPlayerPets, pBuckets)

    expect(SUMMON_GetPetTypeBucketPtr_6FCB6540_113c(m, -1, pPlayerPets)).toBe(0)
    expect(SUMMON_GetPetTypeBucketPtr_6FCB6540_113c(m, 8, pPlayerPets)).toBe(0)
    expect(SUMMON_GetPetTypeBucketPtr_6FCB6540_113c(m, 3, pPlayerPets)).toBe(pBuckets + 36)

    const { pPlayer, pPlayerData } = allocPlayerWithClient(m)
    m.setU32(pPlayerData + 0x44, pPlayerPets)
    expect(SUMMON_GetFirstPetGuidForType_6FCB67B0_113c(m, pPlayer, 3)).toBe(-1)

    const pPetNode = m.alloc(16)
    m.setU32(pPetNode + 0x04, 0x55aa)
    m.setU32(pBuckets + 36, pPetNode)
    expect(SUMMON_GetFirstPetGuidForType_6FCB67B0_113c(m, pPlayer, 3)).toBe(0x55aa)

    // Non-player unit asserts ptPlayerData
    const pMonster = m.alloc(0x100)
    m.setU32(pMonster, 1)
    expect(() => SUMMON_GetFirstPetGuidForType_6FCB67B0_113c(m, pMonster, 3)).toThrow(
      D2CommonAssertError,
    )
  })

  it('SKILLS_SrvSt36_HasEquippedShield_6FCB8390_113c and SKILLS_FindFirstZeroByteOffsetInSeqRecord_6FCB83B0_113c', () => {
    const { m, pDataTables } = createKernelMem()
    const pUnit = m.alloc(0x100)
    expect(SKILLS_SrvSt36_HasEquippedShield_6FCB8390_113c(m, pUnit)).toBe(0)

    // Setup monster sequence record for SKILLS_FindFirstZeroByteOffsetInSeqRecord_6FCB83B0_113c
    m.setU32(pUnit + D2UnitStrc.dwUnitType.off, 1)
    m.setU32(pUnit + D2UnitStrc.dwClassId.off, 0)
    const pSkillList = m.alloc(0x20)
    const pSkill = m.alloc(0x40)
    const pSkTxt = m.u32(pDataTables + 0xb98)
    m.setU16(pSkTxt, 10)
    m.setU32(pSkill, pSkTxt)
    m.setU32(pSkillList + 0x10, pSkill)
    m.setU32(pUnit + D2UnitStrc.pSkills.off, pSkillList)

    const pMonTxt = m.u32(pDataTables + 0xa78)
    m.setU16(pMonTxt + 0x170, 10) // skill 0 = 10
    m.setU16(pMonTxt + 0x188, 1) // seqId = 1

    const pMonSeqTable = m.alloc(4 * 12)
    const pSeqRec = m.alloc(16)
    m.setU32(0x6fdf0a5c, pMonSeqTable)
    m.setU32(0x6fdf0a60, 4)
    m.setU32(pMonSeqTable + 12, pSeqRec) // seqId 1 -> pSeqRec
    m.setU32(pMonSeqTable + 12 + 0x08, 4) // nFrames = 4

    m.setU8(pSeqRec + 0x05, 0)
    expect(SKILLS_FindFirstZeroByteOffsetInSeqRecord_6FCB83B0_113c(m, pUnit)).toBe(-1)

    m.setU8(pSeqRec + 0x05, 1)
    expect(SKILLS_FindFirstZeroByteOffsetInSeqRecord_6FCB83B0_113c(m, pUnit)).toBe(7)
  })

  it('ITEMS_ClearAllDupeAndCommandFlags_6FCBB340_113c clears dwFlagEx 0x14, command flags, and item flags', () => {
    const { m } = createKernelMem()
    const pItem = allocBasicItemForPacket9C(m)
    const pItemData = m.u32(pItem + D2UnitStrc.pUnitData.off)
    m.setU32(pItem + 0xc8, 0x3f)
    m.setU32(pItemData + D2ItemDataStrc.dwItemFlags.off, 0x03)
    m.setU32(pItemData + D2ItemDataStrc.dwCommandFlags.off, 0x2012)

    m.setU32(D2GAME_ITEM_CLEAR_FLAGS_COUNT_VA_113C, 1)
    m.setU32(D2GAME_ITEM_CLEAR_FLAGS_ARRAY_VA_113C, 0x01)
    m.setU32(D2GAME_ITEM_CLEAR_CMD_FLAGS_COUNT_VA_113C, 1)
    m.setU32(D2GAME_ITEM_CLEAR_CMD_FLAGS_ARRAY_VA_113C, 0x02)

    ITEMS_ClearAllDupeAndCommandFlags_6FCBB340_113c(m, pItem)
    expect(m.u32(pItem + 0xc8)).toBe(0x3f & ~0x14)
    expect(m.u32(pItemData + D2ItemDataStrc.dwItemFlags.off)).toBe(0x02)
    expect(m.u32(pItemData + D2ItemDataStrc.dwCommandFlags.off)).toBe(0x2010)
  })

  it('PARTY functions (0x6FCBBC70..0x6FCBBE40) split gold and manage party control & sub-party nodes', () => {
    const { m } = createKernelMem()
    const pGame = m.alloc(0x1e00)

    expect(() => PARTY_AllocPartyControl_6FCBBE40_113c(m, 0)).toThrow(D2CommonAssertError)
    PARTY_AllocPartyControl_6FCBBE40_113c(m, pGame)
    const pPartyControl = m.u32(pGame + 0x1d2c)
    expect(pPartyControl).toBeGreaterThan(0)
    expect(m.u16(pPartyControl)).toBe(3)
    expect(() => PARTY_AllocPartyControl_6FCBBE40_113c(m, pGame)).toThrow(D2CommonAssertError)

    // PARTY_AllocNextPartyId_6FCBBD40_113c skips colliding node IDs
    const pNode3 = m.alloc(12)
    m.setU16(pNode3, 3)
    m.setU32(pPartyControl + 0x04, pNode3)
    expect(PARTY_AllocNextPartyId_6FCBBD40_113c(m, pGame)).toBe(4)
    expect(m.u16(pPartyControl)).toBe(5)

    // PARTY_FindSubPartyById_6FCBBD00_113c
    expect(PARTY_FindSubPartyById_6FCBBD00_113c(m, pGame, 3)).toBe(pNode3)
    expect(PARTY_FindSubPartyById_6FCBBD00_113c(m, pGame, 99)).toBe(0)

    // PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c
    expect(() => PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c(m, 0, 10)).toThrow(D2CommonAssertError)
    const pMember = m.alloc(8)
    m.setU32(pMember, 0x44)
    m.setU32(pNode3 + 0x04, pMember)
    expect(PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c(m, pNode3, 0x44)).toBe(1)
    expect(PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c(m, pNode3, 0x45)).toBe(0)

    // PARTY_SplitGoldPickupByCap_6FCBBC70_113c (unit with 0 gold limit -> all goes to remainder)
    const pPlayer = m.alloc(0x100)
    const pOutAdd = m.alloc(4)
    const pOutRem = m.alloc(4)
    PARTY_SplitGoldPickupByCap_6FCBBC70_113c(m, 250, pPlayer, pOutAdd, pOutRem)
    expect(m.u32(pOutAdd)).toBe(0)
    expect(m.u32(pOutRem)).toBe(250)
  })

  it('MONAI_NoOpStub (0x6FCBC990), SKILLS_CanMonsterReviveOrTeleportInMode (0x6FCBC9A0), and ClosestSameBaseMonster (0x6FCBCA00)', () => {
    const { m, pDataTables } = createKernelMem()
    expect(MONAI_NoOpStub_6FCBC990_113c(m, 123)).toBe(0)

    // Mode != 10,11,12 returns 1 immediately
    expect(SKILLS_CanMonsterReviveOrTeleportInMode_6FCBC9A0_113c(m, 0, 2, 1)).toBe(1)

    // Boss flag bit 0x02 blocks in mode 12 when bCheckBossFlag != 0
    const pMonster = m.alloc(0x100)
    const pMonData = m.alloc(0x40)
    m.setU32(pMonster, 1)
    m.setU32(pMonster + 0x04, 1)
    m.setU32(pMonster + 0x14, pMonData)
    m.setU8(pMonData + 0x16, 0x02)
    expect(SKILLS_CanMonsterReviveOrTeleportInMode_6FCBC9A0_113c(m, pMonster, 12, 1)).toBe(0)

    // SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c
    const pMonStatsTxt = m.u32(pDataTables + 0xa78)
    m.setU16(pMonStatsTxt + 1 * D2MonStatsTxt_SIZE + D2MonStatsTxt.wBaseId.off, 1)

    const pSrc = m.alloc(0x100)
    const pSrcPath = m.alloc(D2DynamicPathStrc_SIZE)
    m.setU32(pSrc, 1)
    m.setU32(pSrc + 0x04, 1)
    m.setU32(pSrc + D2UnitStrc.pPath.off, pSrcPath)
    m.setU16(pSrcPath + 0x02, 10)
    m.setU16(pSrcPath + 0x06, 10)

    const pCand = m.alloc(0x100)
    const pCandPath = m.alloc(D2DynamicPathStrc_SIZE)
    m.setU32(pCand, 1)
    m.setU32(pCand + 0x04, 1)
    m.setU32(pCand + D2UnitStrc.dwAnimMode.off, 1) // alive
    m.setU32(pCand + D2UnitStrc.pPath.off, pCandPath)
    m.setU16(pCandPath + 0x02, 13)
    m.setU16(pCandPath + 0x06, 14) // dx=3, dy=4 -> distSq=25

    const pBestCtx = m.alloc(8)
    m.setU32(pBestCtx + 0x04, 100)
    expect(SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c(m, pSrc, pCand, pBestCtx)).toBe(0)
    expect(m.u32(pBestCtx)).toBe(pCand)
    expect(m.u32(pBestCtx + 0x04)).toBe(25)
  })

  it('CLIENT_RemoveClientFromAdjacentRooms_6FCBD550_113c removes client from all adjacent rooms', () => {
    const { m } = createKernelMem()
    expect(() => CLIENT_RemoveClientFromAdjacentRooms_6FCBD550_113c(m, 0, 0x100)).toThrow(
      D2CommonAssertError,
    )

    const pClient = m.alloc(0x40)
    const pAdjRoom = m.alloc(D2ActiveRoomStrc_SIZE)
    const pClientList = m.alloc(16)
    m.setU32(pClientList, pClient)
    m.setU32(pAdjRoom + 0x48, pClientList)
    m.setU32(pAdjRoom + 0x78, 1)

    const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
    const ppRooms = m.alloc(8)
    m.setU32(ppRooms, pAdjRoom)
    m.setU32(pRoom, ppRooms)
    m.setU32(pRoom + 0x24, 1)

    CLIENT_RemoveClientFromAdjacentRooms_6FCBD550_113c(m, pRoom, pClient)
    expect(m.u32(pAdjRoom + 0x78)).toBe(0)
  })

  it('SKILLS_CorpseSearchFilterCallback (0x6FCBE2E0), ComputeMercSkillDamageAndToHit (0x6FCBE330), RefreshPassiveSkills (0x6FCBE370), DispatchSrvDoFunc (0x6FCBE420)', () => {
    const { m, pDataTables } = createKernelMem()

    // 1. CorpseSearchFilterCallback: non-corpse returns 0; valid corpse delegates to UNITFINDS_MatchUnitCandidate
    const pCorpse = m.alloc(0x100)
    const pCorpsePath = m.alloc(D2DynamicPathStrc_SIZE)
    m.setU32(pCorpse, 1) // monster
    m.setU32(pCorpse + D2UnitStrc.dwClassId.off, 0)
    m.setU32(pCorpse + D2UnitStrc.dwAnimMode.off, 0x0c) // dead
    m.setU32(pCorpse + D2UnitStrc.pPath.off, pCorpsePath)
    expect(SKILLS_CorpseSearchFilterCallback_6FCBE2E0_113c(m, pCorpse, 0)).toBe(0)

    const pMonTxt = m.u32(pDataTables + 0xa78)
    const pMonStats2Txt = m.u32(pDataTables + 0xa90)
    m.setU16(pMonTxt + D2MonStatsTxt.wMonStatsEx.off, 0)
    m.setU8(pMonStats2Txt + D2MonStats2Txt.dwFlags.off, 0x80) // bit 7 = corpseSel
    const pSearch = m.alloc(0x40)
    m.setU32(pSearch, 0x1002) // monster + dead allowed
    m.setU32(pSearch + 0x14, 10) // range 10
    expect(SKILLS_CorpseSearchFilterCallback_6FCBE2E0_113c(m, pCorpse, pSearch)).toBe(1)

    // 2. SKILLS_ComputeMercSkillDamageAndToHit_6FCBE330_113c
    const pMerc = m.alloc(0x100)
    const pSkillList = m.alloc(0x20)
    const pSkill = m.alloc(0x40)
    const pSkillsTxt = m.u32(pDataTables + 0xb98)
    const pSk1 = pSkillsTxt + 1 * D2SkillsTxt_SIZE
    m.setU16(pSk1 + D2SkillsTxt.wSkillId.off, 1)
    m.setU32(pSk1 + 0x198, 45) // dwToHit
    m.setU32(pSk1 + 0x19c, 10) // dwLevToHit
    m.setU32(pSk1 + 0x1a0, 0xffffffff) // no calc override
    m.setU8(pSk1 + 0x1a4, 8) // nHitShift
    m.setU32(pSk1 + 0x1a8, 10) // dwMinDam
    m.setU32(pSk1 + 0x1ac, 20) // dwMaxDam
    m.setU32(pSk1 + 0x1d8, 0xffffffff) // no dmg calc override

    m.setU32(pSkill, pSk1)
    m.setU32(pSkill + 0x28, 3) // level 3
    m.setU32(pSkillList + 0x04, pSkill)
    m.setU32(pMerc + D2UnitStrc.pSkills.off, pSkillList)

    const pOut3 = m.alloc(12)
    const toHit = SKILLS_ComputeMercSkillDamageAndToHit_6FCBE330_113c(m, 1, pMerc, pOut3)
    expect(toHit).toBe(65) // 45 + (3 - 1) * 10
    expect(m.u32(pOut3)).toBe(10)
    expect(m.u32(pOut3 + 0x04)).toBe(20)
    expect(m.u32(pOut3 + 0x08)).toBe(65)

    // 3. SKILLS_RefreshPassiveSkillsAndIconsOnUnit_6FCBE370_113c
    const pListEx = m.alloc(D2StatListExStrc_SIZE)
    const pStateFlags = m.alloc(64)
    m.setU32(pMerc + D2UnitStrc.pStatListEx.off, pListEx)
    m.setU32(pListEx + D2StatListStrc.dwFlags.off, 0x80000000)
    m.setU32(pListEx + D2StatListExStrc.pStateFlags.off, pStateFlags)
    m.setU16(pSk1 + D2SkillsTxt.wPassiveState.off, 12)
    SKILLS_RefreshPassiveSkillsAndIconsOnUnit_6FCBE370_113c(m, pMerc)
    expect(STATES_CheckState113c(m, pMerc, 12)).toBeGreaterThan(0)

    // 4. SKILLS_DispatchSrvDoFunc_6FCBE420_113c
    expect(SKILLS_DispatchSrvDoFunc_6FCBE420_113c(m, -1, 0, 0, 0, 0)).toBe(-1)
    expect(SKILLS_DispatchSrvDoFunc_6FCBE420_113c(m, 0xbf, 0, 0, 0, 0)).toBe(0xbf)
    expect(SKILLS_DispatchSrvDoFunc_6FCBE420_113c(m, 5, 0, 0, 0, 0)).toBe(0)
    m.setU32(D2GAME_SRVDOFUNC_TABLE_VA_113C + 5 * 4, 0x6fcb1234)
    expect(
      SKILLS_DispatchSrvDoFunc_6FCBE420_113c(m, 5, 0x100, 0x200, 3, 4, {
        onSrvDoFunc: (_m, pfn, g, u, sk, lvl) => pfn + g + u + sk + lvl,
      }),
    ).toBe((0x6fcb1234 + 0x100 + 0x200 + 3 + 4) | 0)
  })

  it('VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c and VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c', () => {
    const { m } = createKernelMem()
    const pX = m.alloc(4)
    const pY = m.alloc(4)

    // Rotate (8, 4) -> newX = 4, newY = -8 -> divides by 2 toward zero until x^2 + y^2 <= 3 -> (0, -1)
    m.setU32(pX, 8)
    m.setU32(pY, 4)
    VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c(m, pX, pY)
    expect(m.u32(pX) | 0).toBe(0)
    expect(m.u32(pY) | 0).toBe(-1)

    // Scale up (1, 0): sq = 1 < 4 -> *4 -> (4, 0), sq = 16 (not < 16) -> stays (4, 0)
    m.setU32(pX, 1)
    m.setU32(pY, 0)
    VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c(m, pX, pY)
    expect(m.u32(pX) | 0).toBe(4)
    expect(m.u32(pY) | 0).toBe(0)

    // Scale up (2, 1): sq = 5 (>= 4, < 16) -> *2 -> (4, 2)
    m.setU32(pX, 2)
    m.setU32(pY, 1)
    VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c(m, pX, pY)
    expect(m.u32(pX) | 0).toBe(4)
    expect(m.u32(pY) | 0).toBe(2)
  })
})
