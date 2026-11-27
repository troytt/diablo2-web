import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { D2GAME_PARTY_SetPlayerRelationState113c } from '../../../src/d2kern-113c/game/boot-init-gap-b-113c.ts'
import {
  PARTY_GetPlayerRelationState113c,
  PARTY_TestPlayerRelationFlags113c,
} from '../../../src/d2kern-113c/game/k2-sunit-spawn-w1-113c.ts'
import * as w6b7Exports from '../../../src/d2kern-113c/game/k2-w6b7-113c.ts'
import {
  OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c,
  PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c,
  PARTY_CancelPartyInvitation_6FD10900_113c,
  PARTY_ClearHostilityFlag08_6FD14210_113c,
  PARTY_EnableHostilityFlag08_6FD141C0_113c,
  PARTY_InvitePlayerToParty_6FD10870_113c,
  PARTY_SendLeftPartyEvent5AToMemberCallback_6FD10820_113c,
  PARTY_SyncJoinedPartyRelationsCallback_6FD10B90_113c,
  PARTY_UpdateMuteFlag02AndSyncRoster_6FD10EE0_113c,
  PARTY_UpdateRelationFlagAndSyncRoster_6FD10C60_113c,
  PARTY_UpdateSquelchFlag04AndSyncRoster_6FD10E80_113c,
} from '../../../src/d2kern-113c/game/k2-w6b7-113c.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function writeCString(m: SparseMemory113c, ptr: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    m.setU8((ptr + i) >>> 0, text.charCodeAt(i) & 0xff)
  }
  m.setU8((ptr + text.length) >>> 0, 0)
}

function allocClient(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  name: string,
  wClassId = 0,
): { pClient: number; pQueue: number } {
  const pClient = m.alloc(0x600) >>> 0
  const pQueue = m.alloc(0x800) >>> 0
  m.setU32((pClient + 0x04) >>> 0, 4)
  m.setU16((pClient + 0x0c) >>> 0, wClassId & 0xffff)
  writeCString(m, (pClient + 0x0d) >>> 0, name)
  m.setU32((pClient + 0x174) >>> 0, pUnit >>> 0)
  m.setU32((pClient + 0x1a8) >>> 0, pGame >>> 0)
  m.setU32((pClient + 0x1bc) >>> 0, pQueue)
  return { pClient, pQueue }
}

function allocPlayerUnit(
  m: SparseMemory113c,
  pGame: number,
  dwUnitId: number,
  name: string,
  wClassId = 0,
): { pPlayer: number; pPlrData: number; pClient: number; pQueue: number } {
  const pPlayer = m.alloc(0x100) >>> 0
  const pPlrData = m.alloc(0x100) >>> 0
  m.setU32(pPlayer, 0) // UNIT_PLAYER
  m.setU32((pPlayer + 0x04) >>> 0, wClassId >>> 0)
  m.setU32((pPlayer + 0x0c) >>> 0, dwUnitId >>> 0)
  m.setU32((pPlayer + 0x14) >>> 0, pPlrData)
  m.setU32((pPlayer + 0x80) >>> 0, pGame >>> 0)
  const bucketSlot = (pGame + 0x1120 + (dwUnitId & 0x7f) * 4) >>> 0
  m.setU32((pPlayer + 0xe4) >>> 0, m.u32(bucketSlot))
  m.setU32(bucketSlot, pPlayer)
  writeCString(m, pPlrData, name)
  STATLIST_CreateEx113c(m, pPlayer, 0, pGame)
  STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 15, 0) // STAT_LEVEL = 15
  const { pClient, pQueue } = allocClient(m, pGame, pPlayer, name, wClassId)
  m.setU32((pPlrData + 0x9c) >>> 0, pClient)
  return { pPlayer, pPlrData, pClient, pQueue }
}

function linkClients(m: SparseMemory113c, pGame: number, clients: number[]): void {
  for (let i = 0; i < clients.length; i++) {
    const next = i + 1 < clients.length ? clients[i + 1]! : 0
    m.setU32((clients[i]! + 0x4a8) >>> 0, next >>> 0)
  }
  m.setU32((pGame + 0x88) >>> 0, (clients.length > 0 ? clients[0]! : 0) >>> 0)
}

describe('K2 Wave 6 Batch 7 (w6b7: 0x6FCEDBB0..0x6FD142D0)', () => {
  it('exports all 11 D2Game functions', () => {
    const fnExports = Object.values(w6b7Exports).filter((v) => typeof v === 'function')
    expect(fnExports.length).toBe(11)
  })

  it('PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c validates bounds, rejects 0xFF, and delivers chat/whisper packets', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x2000) >>> 0
    const sender = allocPlayerUnit(m, pGame, 101, 'BarbSender')
    const target = allocPlayerUnit(m, pGame, 202, 'SorcTarget')
    linkClients(m, pGame, [sender.pClient, target.pClient])

    const pShortPkt = m.alloc(0x20) >>> 0
    m.setU8(pShortPkt, 0x15)
    m.setU8((pShortPkt + 1) >>> 0, 1)
    writeCString(m, (pShortPkt + 3) >>> 0, 'hello')
    expect(
      PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c(m, pGame, sender.pPlayer, pShortPkt, 9),
    ).toBe(2)

    const pNoClientPlayer = m.alloc(0x100) >>> 0
    expect(() =>
      PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c(
        m,
        pGame,
        pNoClientPlayer,
        pShortPkt,
        0x20,
      ),
    ).toThrow(D2CommonAssertError)

    const pColorHackPkt = m.alloc(0x40) >>> 0
    m.setU8(pColorHackPkt, 0x15)
    m.setU8((pColorHackPkt + 3) >>> 0, 0x41)
    m.setU8((pColorHackPkt + 4) >>> 0, 0xff)
    m.setU8((pColorHackPkt + 5) >>> 0, 0)
    expect(
      PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c(
        m,
        pGame,
        sender.pPlayer,
        pColorHackPkt,
        0x20,
      ),
    ).toBe(0)
    expect(m.u32(sender.pQueue)).toBe(0)

    const pWhisperPkt = m.alloc(0x40) >>> 0
    m.setU8(pWhisperPkt, 0x15)
    m.setU8((pWhisperPkt + 1) >>> 0, 2)
    writeCString(m, (pWhisperPkt + 3) >>> 0, 'hi there')
    writeCString(m, (pWhisperPkt + 3 + 9) >>> 0, 'SorcTarget')
    expect(
      PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c(
        m,
        pGame,
        sender.pPlayer,
        pWhisperPkt,
        0x30,
      ),
    ).toBe(0)
    expect(m.u32(target.pQueue)).toBeGreaterThan(0)
    expect(m.u8((target.pQueue + 0x04) >>> 0)).toBe(0x26)
    expect(m.u8((target.pQueue + 0x05) >>> 0)).toBe(0x02)
    expect(m.u32(sender.pQueue)).toBeGreaterThan(0)
    expect(m.u8((sender.pQueue + 0x04) >>> 0)).toBe(0x26)
    expect(m.u8((sender.pQueue + 0x05) >>> 0)).toBe(0x06)

    m.setU32(sender.pQueue, 0)
    const pMissingWhisperPkt = m.alloc(0x40) >>> 0
    m.setU8(pMissingWhisperPkt, 0x15)
    m.setU8((pMissingWhisperPkt + 1) >>> 0, 2)
    writeCString(m, (pMissingWhisperPkt + 3) >>> 0, 'ping')
    writeCString(m, (pMissingWhisperPkt + 3 + 5) >>> 0, 'GhostUser')
    expect(
      PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c(
        m,
        pGame,
        sender.pPlayer,
        pMissingWhisperPkt,
        0x30,
      ),
    ).toBe(0)
    expect(m.u32(sender.pQueue)).toBe(0x28)
    expect(m.u8((sender.pQueue + 0x04) >>> 0)).toBe(0x5a)
    expect(m.u8((sender.pQueue + 0x05) >>> 0)).toBe(0x04)
  })

  it('PARTY_SendLeftPartyEvent5AToMemberCallback_6FD10820_113c sends 0x5A event 0x09 to other party members only', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x2000) >>> 0
    const member = allocPlayerUnit(m, pGame, 11, 'MemberA')
    const leaving = allocPlayerUnit(m, pGame, 22, 'LeaverB')

    PARTY_SendLeftPartyEvent5AToMemberCallback_6FD10820_113c(
      m,
      pGame,
      leaving.pPlayer,
      leaving.pPlayer,
    )
    expect(m.u32(leaving.pQueue)).toBe(0)

    PARTY_SendLeftPartyEvent5AToMemberCallback_6FD10820_113c(
      m,
      pGame,
      member.pPlayer,
      leaving.pPlayer,
    )
    expect(m.u32(member.pQueue)).toBe(0x28)
    expect(m.u8((member.pQueue + 0x04) >>> 0)).toBe(0x5a)
    expect(m.u8((member.pQueue + 0x05) >>> 0)).toBe(0x07)
    expect(m.u8((member.pQueue + 0x06) >>> 0)).toBe(0x09)
    expect(m.u32((member.pQueue + 0x07) >>> 0)).toBe(22)
    expect(m.u8((member.pQueue + 0x0b) >>> 0)).toBe(0x09)
  })

  it('PARTY_InvitePlayerToParty_6FD10870_113c and PARTY_CancelPartyInvitation_6FD10900_113c transition relation states and send 0x5A / 0x8B', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x2000) >>> 0
    const source = allocPlayerUnit(m, pGame, 301, 'Inviter', 0xffff)
    const target = allocPlayerUnit(m, pGame, 302, 'Invitee', 0xffff)

    PARTY_InvitePlayerToParty_6FD10870_113c(m, pGame, source.pPlayer, target.pPlayer)
    expect(PARTY_GetPlayerRelationState113c(m, source.pPlayer, target.pPlayer)).toBe(4)
    expect(PARTY_GetPlayerRelationState113c(m, target.pPlayer, source.pPlayer)).toBe(2)
    expect(m.u8((target.pQueue + 0x0b) >>> 0)).toBe(0x05)
    expect(m.u32(target.pQueue)).toBe(0x2e)
    expect(m.u8((target.pQueue + 0x2c) >>> 0)).toBe(0x8b)
    expect(m.u32(source.pQueue)).toBe(0x06)
    expect(m.u8((source.pQueue + 0x04) >>> 0)).toBe(0x8b)

    m.setU32(source.pQueue, 0)
    m.setU32((source.pQueue + 0x04) >>> 0, 0)
    m.setU32(target.pQueue, 0)
    m.setU32((target.pQueue + 0x04) >>> 0, 0)
    m.setU32((source.pPlayer + 0x80) >>> 0, 0)
    m.setU32((target.pPlayer + 0x80) >>> 0, 0)

    PARTY_CancelPartyInvitation_6FD10900_113c(m, pGame, source.pPlayer, target.pPlayer)
    expect(PARTY_GetPlayerRelationState113c(m, source.pPlayer, target.pPlayer)).toBe(0)
    expect(PARTY_GetPlayerRelationState113c(m, target.pPlayer, source.pPlayer)).toBe(0)
    expect(m.u8((target.pQueue + 0x0b) >>> 0)).toBe(0x06)
    expect(m.u32(target.pQueue)).toBe(0x2e)
    expect(m.u8((target.pQueue + 0x2c) >>> 0)).toBe(0x8b)
    expect(m.u32(source.pQueue)).toBe(0x06)
    expect(m.u8((source.pQueue + 0x04) >>> 0)).toBe(0x8b)
  })

  it('PARTY_SyncJoinedPartyRelationsCallback_6FD10B90_113c syncs mutual relations and sends 0x5A(7), 0x8B, and 0x8D', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x2000) >>> 0
    const player = allocPlayerUnit(m, pGame, 401, 'Leader')
    const joining = allocPlayerUnit(m, pGame, 402, 'Joiner')
    linkClients(m, pGame, [player.pClient, joining.pClient])

    const pPartyCtrl = m.alloc(0x20) >>> 0
    const pSubParty = m.alloc(0x20) >>> 0
    const pMemberNode1 = m.alloc(0x10) >>> 0
    const pMemberNode2 = m.alloc(0x10) >>> 0
    m.setU32((pGame + 0x1d2c) >>> 0, pPartyCtrl)
    m.setU32((pPartyCtrl + 0x04) >>> 0, pSubParty)
    m.setU16(pSubParty, 3) // partyId = 3
    m.setU32((pSubParty + 0x04) >>> 0, pMemberNode1)
    m.setU32(pMemberNode1, 401)
    m.setU32((pMemberNode1 + 0x04) >>> 0, pMemberNode2)
    m.setU32(pMemberNode2, 402)

    D2GAME_PARTY_SetPlayerRelationState113c(m, player.pPlayer, joining.pPlayer, 1)
    const pJoinCtx = m.alloc(0x10) >>> 0
    m.setU32(pJoinCtx, player.pPlayer)
    m.setU32((pJoinCtx + 0x04) >>> 0, joining.pPlayer)
    m.setU16((pJoinCtx + 0x08) >>> 0, 3)

    PARTY_SyncJoinedPartyRelationsCallback_6FD10B90_113c(m, pGame, player.pPlayer, pJoinCtx)
    expect(m.u8((player.pQueue + 0x0b) >>> 0)).toBe(0x07)
    expect(m.u16((player.pQueue + 0x07) >>> 0)).toBe(402)
    // D2Game.dll@0x6FD10720 (0x6fd10776..0x6fd107d7) writes bColor at packet offset +0x02 (`pQueue + 0x06`), not +0x06 (`pQueue + 0x0a`).
    expect(m.u8((player.pQueue + 0x06) >>> 0)).toBe(2)
    expect(m.u8((player.pQueue + 0x2c) >>> 0)).toBe(0x8b)
    expect(m.u32(joining.pQueue)).toBeGreaterThan(0)
  })

  it('PARTY_UpdateRelationFlagAndSyncRoster_6FD10C60_113c, SquelchFlag04 (0x6FD10E80), and MuteFlag02 (0x6FD10EE0) toggle flags and queue 0x75 roster packets', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x2000) >>> 0
    const source = allocPlayerUnit(m, pGame, 501, 'SourcePlr')
    const target = allocPlayerUnit(m, pGame, 502, 'TargetPlr')
    linkClients(m, pGame, [source.pClient, target.pClient])

    PARTY_UpdateRelationFlagAndSyncRoster_6FD10C60_113c(
      m,
      target.pPlayer,
      source.pPlayer,
      pGame,
      1,
      1,
    )
    expect(PARTY_TestPlayerRelationFlags113c(m, source.pPlayer, target.pPlayer, 1)).toBe(1)
    expect(m.u32(source.pQueue)).toBeGreaterThanOrEqual(0x0d)
    expect(m.u32(target.pQueue)).toBeGreaterThanOrEqual(0x0d)

    PARTY_UpdateSquelchFlag04AndSyncRoster_6FD10E80_113c(
      m,
      pGame,
      source.pPlayer,
      target.pPlayer,
      1,
    )
    expect(PARTY_TestPlayerRelationFlags113c(m, source.pPlayer, target.pPlayer, 4)).toBe(4)
    PARTY_UpdateSquelchFlag04AndSyncRoster_6FD10E80_113c(
      m,
      pGame,
      source.pPlayer,
      target.pPlayer,
      0,
    )
    expect(PARTY_TestPlayerRelationFlags113c(m, source.pPlayer, target.pPlayer, 4)).toBe(0)

    PARTY_UpdateMuteFlag02AndSyncRoster_6FD10EE0_113c(
      m,
      pGame,
      source.pPlayer,
      target.pPlayer,
      1,
    )
    expect(PARTY_TestPlayerRelationFlags113c(m, source.pPlayer, target.pPlayer, 2)).toBe(2)
    PARTY_UpdateMuteFlag02AndSyncRoster_6FD10EE0_113c(
      m,
      pGame,
      source.pPlayer,
      target.pPlayer,
      0,
    )
    expect(PARTY_TestPlayerRelationFlags113c(m, source.pPlayer, target.pPlayer, 2)).toBe(0)
  })

  it('PARTY_EnableHostilityFlag08_6FD141C0_113c and PARTY_ClearHostilityFlag08_6FD14210_113c assert UNIT_PLAYER and toggle flag 0x08', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x2000) >>> 0
    const owner = allocPlayerUnit(m, pGame, 601, 'HostileOwner')
    const target = allocPlayerUnit(m, pGame, 602, 'HostileTarget')
    linkClients(m, pGame, [owner.pClient, target.pClient])

    expect(() => PARTY_EnableHostilityFlag08_6FD141C0_113c(m, target.pPlayer, pGame, 0)).toThrow(
      D2CommonAssertError,
    )
    expect(() => PARTY_ClearHostilityFlag08_6FD14210_113c(m, target.pPlayer, pGame, 0)).toThrow(
      D2CommonAssertError,
    )

    PARTY_EnableHostilityFlag08_6FD141C0_113c(m, target.pPlayer, pGame, owner.pPlayer)
    expect(PARTY_TestPlayerRelationFlags113c(m, owner.pPlayer, target.pPlayer, 8)).toBe(8)

    const cleared = PARTY_ClearHostilityFlag08_6FD14210_113c(
      m,
      target.pPlayer,
      pGame,
      owner.pPlayer,
    )
    expect(cleared).toBe(1)
    expect(PARTY_TestPlayerRelationFlags113c(m, owner.pPlayer, target.pPlayer, 8)).toBe(0)
  })

  it('OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c skips town rooms, asserts non-null target, and applies scaled trap damage', () => {
    const m = new SparseMemory113c()
    const pBitMasks = m.alloc(128) >>> 0
    for (let i = 0; i < 32; i++) {
      m.setU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0)
    }
    m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)
    const pDataTables = m.alloc(0x1000) >>> 0
    m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
    m.setU32((pDataTables + 0xbc) >>> 0, m.alloc(185 * 0x40) >>> 0)
    m.setU32((pDataTables + 0xc4) >>> 0, 185)
    m.setU32((pDataTables + 0xbcc) >>> 0, m.alloc(359 * 0x144) >>> 0)
    m.setU32((pDataTables + 0xbd4) >>> 0, 359)
    const pGame = m.alloc(0x2000) >>> 0
    EVENT_InitTimerQueue113c(m, pGame)
    const target = allocPlayerUnit(m, pGame, 701, 'TrapVictim')
    m.setU32((target.pPlayer + 0x10) >>> 0, 1) // PLRMODE_NEUTRAL (alive)
    STATLIST_SetUnitStat113c(m, target.pPlayer, 6, 200 << 8, 0) // STAT_HITPOINTS
    STATLIST_SetUnitStat113c(m, target.pPlayer, 7, 200 << 8, 0) // STAT_MAXHP
    STATLIST_SetUnitStat113c(m, target.pPlayer, 2, 10, 0) // STAT_DEXTERITY
    STATLIST_SetUnitStat113c(m, target.pPlayer, 0x1f, 5, 0) // STAT_ARMORCLASS

    const pPath = m.alloc(0x40) >>> 0
    const pRoom = m.alloc(0x80) >>> 0
    const pRoomEx = m.alloc(0x80) >>> 0
    const pLevel = m.alloc(0x200) >>> 0
    m.setU32((target.pPlayer + 0x2c) >>> 0, pPath)
    m.setU32((pPath + 0x1c) >>> 0, pRoom)
    m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
    m.setU32((pRoomEx + 0x58) >>> 0, pLevel)

    const pObjRecord = m.alloc(0x1c0) >>> 0
    m.setU8((pObjRecord + 0x19c) >>> 0, 100) // 100% trap damage multiplier
    m.setU32(0x6fdf0b98, 1) // sgptDataTables.nObjectsTxtRecordCount
    m.setU32(0x6fdf0b94, pObjRecord) // sgptDataTables.pObjectsTxt

    const pObject = m.alloc(0x100) >>> 0
    const pObjData = m.alloc(0x40) >>> 0
    const pObjPath = m.alloc(0x20) >>> 0
    m.setU32(pObject, 2) // UNIT_OBJECT
    m.setU32((pObject + 0x04) >>> 0, 0) // classId = 0
    m.setU32((pObject + 0x14) >>> 0, pObjData)
    m.setU32(pObjData, pObjRecord)
    m.setU32((pObject + 0x20) >>> 0, 1) // seedLo = 1
    m.setU32((pObject + 0x24) >>> 0, 1) // seedHi = 1
    m.setU32((pObject + 0x2c) >>> 0, pObjPath)
    m.setU32(pObjPath, pRoom)

    // Town level (levelId = 1 -> Rogue Encampment): no-op
    m.setU32((pLevel + 0x1ac) >>> 0, 1)
    OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c(m, pGame, pObject, target.pPlayer, 1)
    expect(STATLIST_GetUnitStat113c(m, target.pPlayer, 6, 0)).toBe(200 << 8)

    // Null target asserts at line 0x3f
    expect(() => OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c(m, pGame, pObject, 0, 0)).toThrow(
      D2CommonAssertError,
    )

    // Non-town level (levelId = 2 -> Blood Moor): applies trap fire damage
    m.setU32((pLevel + 0x1ac) >>> 0, 2)
    OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c(m, pGame, pObject, target.pPlayer, 1)
    const hpAfterFire = STATLIST_GetUnitStat113c(m, target.pPlayer, 6, 0)
    expect(hpAfterFire).toBeLessThan(200 << 8)
  })
})
