/**
 * Diablo II v1.13c `D2Game.dll` Wave 6 Batch 7 (`w6b7`):
 * 11 functions in `0x6FCEDBB0..0x6FD142D0` (`D2Game.dll` image base `0x6FC20000`).
 *
 * Clean-room 1:1 binary translations operating on `D2KernMemory113c`.
 */

import { UNITS_GetPlayerData113c } from '../common/composit'
import { DUNGEON_GetLevelIdFromRoom113c } from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { DUNGEON_CheckRoomIsTownMemPort113c } from '../common/k0-d2common-memports'
import { STATES_CheckState113c, STATLIST_GetUnitStat113c } from '../common/statlist'
import { UNITS_GetRoom113c, UNITS_TestCollisionBetweenUnits113c } from '../common/unit'
import type { Memory113c as D2KernMemory113c } from '../mem/sparse-memory'
import {
  CLIENTS_ForEachInGameClient113c,
  NET_SendFixed40BytePacketToClient113c,
} from './boot-init-gap-a-113c'
import {
  D2GAME_PARTY_EnsurePlayerRelationNode113c,
  D2GAME_PARTY_GetPartyIdForUnit113c,
  D2GAME_PARTY_Send0x8BPartyRelationStatus113c,
  D2GAME_PARTY_SetPlayerRelationState113c,
} from './boot-init-gap-b-113c'
import {
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplyResistancesAndAbsorb113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
} from './combat-a1c-113c'
import {
  PARTY_GetPlayerRelationState113c,
  PARTY_TestPlayerRelationFlags113c,
} from './k2-sunit-spawn-w1-113c'
import {
  NET_SendPacket26_ChatMessage_6FCAB470_113c,
  PARTY_BroadcastPlayerPartyIdPacket8D_6FCACFB0_113c,
} from './k2-w4b4-113c'
import { NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c } from './k2-w4b5-113c'
import {
  PACKET_DeliverChatIfNotSquelched_6FCECA00_113c,
  PACKET_DeliverOverheadOrPartyChat_6FCED530_113c,
} from './k2-w5b6-113c'
import {
  NET_SendPacket5A_PartyRelationEvent_6FD10720_113c,
  PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c,
  PARTY_SyncMutualRelationState_6FD109E0_113c,
} from './k2-w5b9-113c'
import { OBJECTS_RollScaledByte19C_6FD14260_113c } from './k2-w5b10-113c'
import { SEED_RollLimitedFast113c } from './regpop-spawn-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

export type { D2KernMemory113c }

let k2W6B7StackPtr = 0x7efb0000

function stormStrCopy113c(
  m: D2KernMemory113c,
  dst: number,
  src: number,
  maxLen: number,
): number {
  const d = dst >>> 0
  const s = src >>> 0
  const limit = maxLen >>> 0
  if (d === 0 || s === 0 || limit === 0) return 0
  let i = 0
  const maxCopy = (limit - 1) >>> 0
  while (i < maxCopy) {
    const ch = m.u8((s + i) >>> 0)
    if (ch === 0) break
    m.setU8((d + i) >>> 0, ch)
    i = (i + 1) >>> 0
  }
  m.setU8((d + i) >>> 0, 0)
  return i
}

function stormStrLen113c(m: D2KernMemory113c, str: number): number {
  const s = str >>> 0
  if (s === 0) return 0
  let len = 0
  while (m.u8((s + len) >>> 0) !== 0) {
    len = (len + 1) >>> 0
  }
  return len
}

function stormStrChr113c(m: D2KernMemory113c, str: number, ch: number): number {
  const s = str >>> 0
  if (s === 0) return 0
  const target = ch & 0xff
  let cur = s
  let c = m.u8(cur)
  while (c !== 0) {
    if (c === target) return cur
    cur = (cur + 1) >>> 0
    c = m.u8(cur)
  }
  return 0
}

/**
 * [1/11] Processes C2S `0x15` normal/whisper chat messages: validates message length (`< 0x100`),
 * packet bounds (`msgLen + 4 < nPacketLen`), sender client (`Packet.cpp:0x9D9`), and rejects `0xFF`
 * color-code bytes (`SStrChr`), then broadcasts normal chat (`0x6FCED530`) or delivers whisper chat
 * (`0x6FCECA00`) with `0x5A` (`0x0D` squelched / `0x04` not-in-game) or `0x26` (`0x06` echo) reply.
 *
 * @va D2Game:0x6FCEDBB0
 */
export function PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEDBB0)
  const sp = k2W6B7StackPtr
  k2W6B7StackPtr = (sp + 0x3b0) >>> 0
  const pPkt5A = (sp + 0x14) >>> 0
  const pChatDesc = (sp + 0x44) >>> 0
  const pRawPkt = (sp + 0x50) >>> 0
  const pChatMsg = (sp + 0x168) >>> 0
  const pEchoMsg = (sp + 0x288) >>> 0
  try {
    m.fill(sp, 0x3b0, 0)

    const pkt = pPacket >>> 0
    const pMsgSrc = (pkt + 0x03) >>> 0
    m.setU8(pRawPkt, m.u8(pkt))
    m.setU8((pRawPkt + 0x01) >>> 0, m.u8((pkt + 0x01) >>> 0))
    m.setU8((pRawPkt + 0x02) >>> 0, m.u8((pkt + 0x02) >>> 0))
    stormStrCopy113c(m, (pRawPkt + 0x03) >>> 0, pMsgSrc, 0x100)

    const msgLen = stormStrLen113c(m, pMsgSrc) | 0
    if (msgLen >= 0x100) return 2
    if (((msgLen + 4) | 0) >= (nPacketLen | 0)) return 2

    const pTargetNameSrc = (pMsgSrc + msgLen + 1) >>> 0
    stormStrCopy113c(m, (pRawPkt + 0x103) >>> 0, pTargetNameSrc, 0x10)
    stormStrLen113c(m, pTargetNameSrc)

    let pSenderClient = 0
    if (pPlayer !== 0 && (m.u32(pPlayer >>> 0) | 0) === 0) {
      const pPlrData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
      if (pPlrData !== 0) {
        pSenderClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
      }
    }
    if (pSenderClient === 0) {
      throw new D2CommonAssertError('Packet.cpp', 0x9d9)
    }

    const pSenderName = (pSenderClient + 0x0d) >>> 0
    if ((stormStrLen113c(m, pSenderName) >>> 0) > 0) {
      stormStrCopy113c(m, (pChatMsg + 0x0a) >>> 0, pSenderName, 0x7fffffff)
    } else {
      m.setU8((pChatMsg + 0x0a) >>> 0, 0)
    }

    const targetNameLen = stormStrLen113c(m, (pRawPkt + 0x103) >>> 0) | 0
    const bIsWhisper = targetNameLen > 0 && targetNameLen < 0x10 ? 1 : 0

    const senderLvl = STATLIST_GetUnitStat113c(m, pPlayer >>> 0, 0x0c, 0) & 0xff
    m.setU8((pChatMsg + 0x09) >>> 0, senderLvl)

    const bLastMsgByte = m.u8((pRawPkt + 0x102) >>> 0)
    m.setU8((pRawPkt + 0x112) >>> 0, 0)
    if (bLastMsgByte !== 0) return 0

    if (stormStrChr113c(m, (pRawPkt + 0x03) >>> 0, 0xff) !== 0) return 0

    const bChatColor = m.u8((pRawPkt + 0x02) >>> 0)
    for (let i = 0; i < 0x100; i += 4) {
      m.setU32((pChatMsg + 0x1a + i) >>> 0, m.u32((pRawPkt + 0x03 + i) >>> 0))
    }

    m.setU8((pChatMsg + 0x02) >>> 0, bChatColor)
    m.setU8((pChatMsg + 0x08) >>> 0, 0)
    m.setU8(pChatMsg, 0x26)
    m.setU32((pChatMsg + 0x04) >>> 0, 0)
    m.setU8((pChatMsg + 0x03) >>> 0, 2)

    let pfnDeliverVa = 0x6fced530
    if (bIsWhisper !== 0) {
      m.setU8((pChatMsg + 0x01) >>> 0, 2)
      pfnDeliverVa = 0x6fceca00
    } else {
      m.setU8((pChatMsg + 0x01) >>> 0, 1)
    }

    m.setU32(pChatDesc, pChatMsg)
    m.setU32((pChatDesc + 0x04) >>> 0, pRawPkt)
    m.setU32(0x6fd301e4, 0)
    m.setU32(0x6fd301e0, 0)
    m.setU32(
      (pChatDesc + 0x08) >>> 0,
      (m.u32(pPlayer >>> 0) | 0) === 0 ? m.u32((pPlayer + 0x0c) >>> 0) : 0xffffffff,
    )

    CLIENTS_ForEachInGameClient113c(m, pGame >>> 0, pfnDeliverVa, pChatDesc, (mem, pClient, pCtx) => {
      if (pfnDeliverVa === 0x6fceca00) {
        PACKET_DeliverChatIfNotSquelched_6FCECA00_113c(mem, pClient, pCtx)
      } else {
        PACKET_DeliverOverheadOrPartyChat_6FCED530_113c(mem, pClient, pCtx)
      }
    })

    if (m.u8((pChatMsg + 0x01) >>> 0) !== 2) return 0

    if (m.u32(0x6fd301e0) !== 0) {
      m.fill(pPkt5A, 0x28, 0)
      m.setU8(pPkt5A, 0x5a)
      m.setU8((pPkt5A + 0x02) >>> 0, 0)
      m.setU32((pPkt5A + 0x03) >>> 0, 0)
      stormStrCopy113c(m, (pPkt5A + 0x08) >>> 0, (pRawPkt + 0x103) >>> 0, 0x7fffffff)
      m.setU8((pPkt5A + 0x01) >>> 0, 0x0d)
      m.setU8((pPkt5A + 0x17) >>> 0, 0)

      let pReplyClient = 0
      if ((m.u32(pPlayer >>> 0) | 0) === 0) {
        const pPlrData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
        if (pPlrData !== 0) pReplyClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
      }
      NET_SendFixed40BytePacketToClient113c(m, pReplyClient, pPkt5A)
      return 0
    }

    if (m.u32(0x6fd301e4) === 0) {
      m.fill(pPkt5A, 0x28, 0)
      m.setU8(pPkt5A, 0x5a)
      m.setU8((pPkt5A + 0x02) >>> 0, 0)
      m.setU32((pPkt5A + 0x03) >>> 0, 0)
      stormStrCopy113c(m, (pPkt5A + 0x08) >>> 0, (pRawPkt + 0x103) >>> 0, 0x7fffffff)
      m.setU8((pPkt5A + 0x01) >>> 0, 0x04)
      m.setU8((pPkt5A + 0x17) >>> 0, 0)

      let pReplyClient = 0
      if ((m.u32(pPlayer >>> 0) | 0) === 0) {
        const pPlrData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
        if (pPlrData !== 0) pReplyClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
      }
      NET_SendFixed40BytePacketToClient113c(m, pReplyClient, pPkt5A)
      return 0
    }

    m.setU8((pEchoMsg + 0x03) >>> 0, 2)
    m.setU8(pEchoMsg, 0x26)
    m.setU8((pEchoMsg + 0x01) >>> 0, 0x06)
    m.setU32((pEchoMsg + 0x04) >>> 0, 0)
    m.setU8((pEchoMsg + 0x08) >>> 0, 0)
    stormStrCopy113c(m, (pEchoMsg + 0x0a) >>> 0, (pRawPkt + 0x103) >>> 0, 0x7fffffff)
    m.setU8((pEchoMsg + 0x19) >>> 0, 0)
    m.setU8((pEchoMsg + 0x02) >>> 0, 0)
    for (let i = 0; i < 0x100; i += 4) {
      m.setU32((pEchoMsg + 0x1a + i) >>> 0, m.u32((pRawPkt + 0x03 + i) >>> 0))
    }

    let pReplyClient = 0
    if ((m.u32(pPlayer >>> 0) | 0) === 0) {
      const pPlrData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
      if (pPlrData !== 0) pReplyClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
    }
    NET_SendPacket26_ChatMessage_6FCAB470_113c(m, pEchoMsg, pReplyClient)
    return 0
  } finally {
    k2W6B7StackPtr = sp
  }
}

/**
 * [2/11] Sub-party member callback sending S2C `0x5A` event `0x09` (`left party`) for `pLeavingPlayer`
 * to every other member `pMemberUnit`'s client (`0x6FD10720`).
 *
 * @va D2Game:0x6FD10820
 */
export function PARTY_SendLeftPartyEvent5AToMemberCallback_6FD10820_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pMemberUnit: number,
  pLeavingPlayer: number,
): void {
  hitD2GameVa113c(0x6FD10820)
  const edxMember = pMemberUnit >>> 0
  const eaxLeaving = pLeavingPlayer >>> 0
  if (edxMember === eaxLeaving) return

  const dwLeavingGuid = eaxLeaving !== 0 ? m.u32((eaxLeaving + 0x0c) >>> 0) >>> 0 : 0xffffffff

  let pClient = 0
  if (edxMember !== 0 && (m.u32(edxMember) | 0) === 0) {
    const pPlrData = UNITS_GetPlayerData113c(m, edxMember) >>> 0
    if (pPlrData !== 0) {
      pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
    }
  }

  NET_SendPacket5A_PartyRelationEvent_6FD10720_113c(m, dwLeavingGuid, pClient, 0x09)
}

/**
 * [3/11] Party invitation handler (`0x6FD1A3B0` action): ensures mutual relation nodes, sets
 * relation states (`4` on inviter, `2` on invitee) and sends `0x5A` event `0x05` when current
 * relation state is `0`, then sends bidirectional `0x8B` status updates (`0x6FD10130`).
 *
 * @va D2Game:0x6FD10870
 */
export function PARTY_InvitePlayerToParty_6FD10870_113c(
  m: D2KernMemory113c,
  pGame: number,
  pSourcePlayer: number,
  pTargetPlayer: number,
  _dwExtraArg = 0,
  _pOutError = 0,
): void {
  hitD2GameVa113c(0x6FD10870)
  const esiGame = pGame >>> 0
  const ebpSource = pSourcePlayer >>> 0
  const ebxTarget = pTargetPlayer >>> 0

  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, ebxTarget, ebpSource, esiGame)
  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, ebpSource, ebxTarget, esiGame)

  const wRel = PARTY_GetPlayerRelationState113c(m, ebpSource, ebxTarget) & 0xffff
  if (wRel === 0) {
    D2GAME_PARTY_SetPlayerRelationState113c(m, ebpSource, ebxTarget, 4)
    D2GAME_PARTY_SetPlayerRelationState113c(m, ebxTarget, ebpSource, 2)

    const dwSourceGuid = ebpSource !== 0 ? m.u32((ebpSource + 0x0c) >>> 0) >>> 0 : 0xffffffff
    let pTargetClient = 0
    if (ebxTarget !== 0 && (m.u32(ebxTarget) | 0) === 0) {
      const pPlrData = UNITS_GetPlayerData113c(m, ebxTarget) >>> 0
      if (pPlrData !== 0) {
        pTargetClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
      }
    }
    NET_SendPacket5A_PartyRelationEvent_6FD10720_113c(m, dwSourceGuid, pTargetClient, 5)
  }

  D2GAME_PARTY_Send0x8BPartyRelationStatus113c(m, ebxTarget, ebpSource)
  D2GAME_PARTY_Send0x8BPartyRelationStatus113c(m, ebpSource, ebxTarget)
}

/**
 * [4/11] Party invitation cancel handler (`0x6FD1A3B0` action): when `pSourcePlayer` has pending
 * invite state `4` toward `pTargetPlayer`, resets both players' relation states to `1` (if target/source
 * is in a party) or `0`, sends `0x5A` event `0x06`, and sends bidirectional `0x8B` updates.
 *
 * @va D2Game:0x6FD10900
 */
export function PARTY_CancelPartyInvitation_6FD10900_113c(
  m: D2KernMemory113c,
  pGame: number,
  pSourcePlayer: number,
  pTargetPlayer: number,
  _dwExtraArg = 0,
  _pOutError = 0,
): void {
  hitD2GameVa113c(0x6FD10900)
  const esiGame = pGame >>> 0
  const ebpSource = pSourcePlayer >>> 0
  const ebxTarget = pTargetPlayer >>> 0

  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, ebxTarget, ebpSource, esiGame)
  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, ebpSource, ebxTarget, esiGame)

  const wRel = PARTY_GetPlayerRelationState113c(m, ebpSource, ebxTarget) & 0xffff
  if (wRel === 4) {
    let dwTargetPartyState = 0
    if (ebxTarget !== 0) {
      const pTargetGame = m.u32((ebxTarget + 0x80) >>> 0) >>> 0
      if (pTargetGame !== 0 && (m.u32(ebxTarget) | 0) === 0) {
        if ((D2GAME_PARTY_GetPartyIdForUnit113c(m, ebxTarget, pTargetGame) & 0xffff) !== 0xffff) {
          dwTargetPartyState = 1
        }
      }
    }
    D2GAME_PARTY_SetPlayerRelationState113c(m, ebpSource, ebxTarget, dwTargetPartyState)

    let dwSourcePartyState = 0
    if (ebpSource !== 0) {
      const pSourceGame = m.u32((ebpSource + 0x80) >>> 0) >>> 0
      if (pSourceGame !== 0 && (m.u32(ebpSource) | 0) === 0) {
        if ((D2GAME_PARTY_GetPartyIdForUnit113c(m, ebpSource, pSourceGame) & 0xffff) !== 0xffff) {
          dwSourcePartyState = 1
        }
      }
    }
    D2GAME_PARTY_SetPlayerRelationState113c(m, ebxTarget, ebpSource, dwSourcePartyState)

    const dwSourceGuid = ebpSource !== 0 ? m.u32((ebpSource + 0x0c) >>> 0) >>> 0 : 0xffffffff
    let pTargetClient = 0
    if (ebxTarget !== 0 && (m.u32(ebxTarget) | 0) === 0) {
      const pPlrData = UNITS_GetPlayerData113c(m, ebxTarget) >>> 0
      if (pPlrData !== 0) {
        pTargetClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
      }
    }
    NET_SendPacket5A_PartyRelationEvent_6FD10720_113c(m, dwSourceGuid, pTargetClient, 6)
  }

  D2GAME_PARTY_Send0x8BPartyRelationStatus113c(m, ebxTarget, ebpSource)
  D2GAME_PARTY_Send0x8BPartyRelationStatus113c(m, ebpSource, ebxTarget)
}

/**
 * [5/11] Living-player callback on party join: ensures and synchronizes mutual relation states between
 * `pPlayer` and both `pJoinCtx->pUnit0` (`+0x00`) and `pJoinCtx->pJoiningUnit` (`+0x04`), sends `0x5A`
 * event `0x07` to same-party teammates (`wPartyId` at `+0x08`), sends `0x8B` updates, and broadcasts `0x8D`.
 *
 * @va D2Game:0x6FD10B90
 */
export function PARTY_SyncJoinedPartyRelationsCallback_6FD10B90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pJoinCtx: number,
): void {
  hitD2GameVa113c(0x6FD10B90)
  const ebpGame = pGame >>> 0
  const ebxPlayer = pPlayer >>> 0
  const esiCtx = pJoinCtx >>> 0

  let wPlayerPartyId = 0xffff
  if (ebxPlayer !== 0) {
    const pPlayerGame = m.u32((ebxPlayer + 0x80) >>> 0) >>> 0
    if (pPlayerGame !== 0 && (m.u32(ebxPlayer) | 0) === 0) {
      wPlayerPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, ebxPlayer, pPlayerGame) & 0xffff
    }
  }

  const pUnit0 = m.u32(esiCtx) >>> 0
  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, pUnit0, ebxPlayer, ebpGame)
  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, ebxPlayer, pUnit0, ebpGame)

  const pUnit4 = m.u32((esiCtx + 0x04) >>> 0) >>> 0
  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, pUnit4, ebxPlayer, ebpGame)
  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, ebxPlayer, pUnit4, ebpGame)

  PARTY_SyncMutualRelationState_6FD109E0_113c(m, ebxPlayer, m.u32(esiCtx) >>> 0)
  PARTY_SyncMutualRelationState_6FD109E0_113c(m, ebxPlayer, m.u32((esiCtx + 0x04) >>> 0) >>> 0)

  const wTargetPartyId = m.u16((esiCtx + 0x08) >>> 0)
  if (wPlayerPartyId === wTargetPartyId && wPlayerPartyId !== 0xffff) {
    const pJoining = m.u32((esiCtx + 0x04) >>> 0) >>> 0
    if (ebxPlayer !== pJoining) {
      const dwJoiningGuid = pJoining !== 0 ? m.u32((pJoining + 0x0c) >>> 0) >>> 0 : 0xffffffff
      let pClient = 0
      if (ebxPlayer !== 0 && (m.u32(ebxPlayer) | 0) === 0) {
        const pPlrData = UNITS_GetPlayerData113c(m, ebxPlayer) >>> 0
        if (pPlrData !== 0) {
          pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
        }
      }
      NET_SendPacket5A_PartyRelationEvent_6FD10720_113c(m, dwJoiningGuid, pClient, 7)
    }
  }

  D2GAME_PARTY_Send0x8BPartyRelationStatus113c(m, m.u32(esiCtx) >>> 0, ebxPlayer)
  D2GAME_PARTY_Send0x8BPartyRelationStatus113c(m, m.u32((esiCtx + 0x04) >>> 0) >>> 0, ebxPlayer)
  PARTY_BroadcastPlayerPartyIdPacket8D_6FCACFB0_113c(m, ebxPlayer, ebpGame)
}

/**
 * [6/11] Updates relation flag `wFlagMask` (`[esp+4]`, `u16`) on `pSourcePlayer` (`ecx`) toward
 * `pTargetPlayer` (`eax`) in `pGame` (`edx`) when `PARTY_TestPlayerRelationFlags` differs from
 * `dwEnable` (`[esp+8]`), then sends bidirectional `0x75` roster updates (`0x6FCAD120`).
 *
 * @va D2Game:0x6FD10C60
 */
export function PARTY_UpdateRelationFlagAndSyncRoster_6FD10C60_113c(
  m: D2KernMemory113c,
  pTargetPlayer: number,
  pSourcePlayer: number,
  pGame: number,
  wFlagMask: number,
  dwEnable: number,
): void {
  hitD2GameVa113c(0x6FD10C60)
  const esiTarget = pTargetPlayer >>> 0
  const ediSource = pSourcePlayer >>> 0
  const ebxGame = pGame >>> 0
  const ebpMask = wFlagMask & 0xffff

  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, esiTarget, ediSource, ebxGame)
  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, ediSource, esiTarget, ebxGame)

  const curMasked = PARTY_TestPlayerRelationFlags113c(m, ediSource, esiTarget, ebpMask) >>> 0
  if (curMasked !== (dwEnable >>> 0)) {
    PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c(
      m,
      ebpMask,
      ediSource,
      esiTarget,
      ebxGame,
      dwEnable >>> 0,
    )
  }

  NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c(m, esiTarget, ediSource)
  NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c(m, ediSource, esiTarget)
}

/**
 * [7/11] Party action handler (`0x6FD1A3B0`) updating squelch relation flag `0x04` on
 * `pSourcePlayer` (`edx`) toward `pTargetPlayer` (`[esp+4]`) in `pGame` (`ecx`) and sending
 * bidirectional `0x75` roster updates (`0x6FCAD120`).
 *
 * @va D2Game:0x6FD10E80
 */
export function PARTY_UpdateSquelchFlag04AndSyncRoster_6FD10E80_113c(
  m: D2KernMemory113c,
  pGame: number,
  pSourcePlayer: number,
  pTargetPlayer: number,
  dwEnable: number,
  _pOutError = 0,
): void {
  hitD2GameVa113c(0x6FD10E80)
  const ebxGame = pGame >>> 0
  const ediSource = pSourcePlayer >>> 0
  const esiTarget = pTargetPlayer >>> 0

  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, esiTarget, ediSource, ebxGame)
  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, ediSource, esiTarget, ebxGame)

  const curMasked = PARTY_TestPlayerRelationFlags113c(m, ediSource, esiTarget, 4) >>> 0
  if (curMasked !== (dwEnable >>> 0)) {
    PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c(
      m,
      4,
      ediSource,
      esiTarget,
      ebxGame,
      dwEnable >>> 0,
    )
  }

  NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c(m, esiTarget, ediSource)
  NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c(m, ediSource, esiTarget)
}

/**
 * [8/11] Party action handler (`0x6FD1A3B0`) updating mute relation flag `0x02` on
 * `pSourcePlayer` (`edx`) toward `pTargetPlayer` (`[esp+4]`) in `pGame` (`ecx`) and sending
 * bidirectional `0x75` roster updates (`0x6FCAD120`).
 *
 * @va D2Game:0x6FD10EE0
 */
export function PARTY_UpdateMuteFlag02AndSyncRoster_6FD10EE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pSourcePlayer: number,
  pTargetPlayer: number,
  dwEnable: number,
  _pOutError = 0,
): void {
  hitD2GameVa113c(0x6FD10EE0)
  const ebxGame = pGame >>> 0
  const ediSource = pSourcePlayer >>> 0
  const esiTarget = pTargetPlayer >>> 0

  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, esiTarget, ediSource, ebxGame)
  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, ediSource, esiTarget, ebxGame)

  const curMasked = PARTY_TestPlayerRelationFlags113c(m, ediSource, esiTarget, 2) >>> 0
  if (curMasked !== (dwEnable >>> 0)) {
    PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c(
      m,
      2,
      ediSource,
      esiTarget,
      ebxGame,
      dwEnable >>> 0,
    )
  }

  NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c(m, esiTarget, ediSource)
  NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c(m, ediSource, esiTarget)
}

/**
 * [9/11] Asserts `pOwnerPlayer` (`edi`) is a non-null `UNIT_PLAYER` (line `0x24`), ensures its
 * relation node for `pTargetPlayer` (`eax`) in `pGame` (`ebx`), and sets hostility flag `0x08`
 * with `0x8C` broadcast (`0x6FD10640`).
 *
 * @va D2Game:0x6FD141C0
 */
export function PARTY_EnableHostilityFlag08_6FD141C0_113c(
  m: D2KernMemory113c,
  pTargetPlayer: number,
  pGame: number,
  pOwnerPlayer: number,
): void {
  hitD2GameVa113c(0x6FD141C0)
  const esiTarget = pTargetPlayer >>> 0
  const ebxGame = pGame >>> 0
  const ediOwner = pOwnerPlayer >>> 0

  if (ediOwner === 0 || (m.u32(ediOwner) | 0) !== 0) {
    throw new D2CommonAssertError('', 0x24)
  }

  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, esiTarget, ediOwner, ebxGame)
  PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c(m, 8, ediOwner, esiTarget, ebxGame, 1)
}

/**
 * [10/11] Asserts `pOwnerPlayer` (`edi`) is a non-null `UNIT_PLAYER` (line `0x15`), ensures its
 * relation node for `pTargetPlayer` (`eax`) in `pGame` (`ebx`), clears hostility flag `0x08`
 * with `0x8C` broadcast (`0x6FD10640`), and returns `1`.
 *
 * @va D2Game:0x6FD14210
 */
export function PARTY_ClearHostilityFlag08_6FD14210_113c(
  m: D2KernMemory113c,
  pTargetPlayer: number,
  pGame: number,
  pOwnerPlayer: number,
): number {
  hitD2GameVa113c(0x6FD14210)
  const esiTarget = pTargetPlayer >>> 0
  const ebxGame = pGame >>> 0
  const ediOwner = pOwnerPlayer >>> 0

  if (ediOwner === 0 || (m.u32(ediOwner) | 0) !== 0) {
    throw new D2CommonAssertError('', 0x15)
  }

  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, esiTarget, ediOwner, ebxGame)
  PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c(m, 8, ediOwner, esiTarget, ebxGame, 0)
  return 1
}

/**
 * [11/11] Evaluates object trap melee/elemental hit against `pTargetUnit` outside town with clear
 * line-of-sight (`0x804`), rolling trap accuracy against target dexterity, level, and armor class,
 * scaling `[max(1, hp >> 5), max(min + 1, hp >> 3)]` via `0x6FD14260`, populating `D2DamageStrc`
 * by `nElemType` (`1`=fire, `2`=ltng, `3`=cold, else phys), and applying resistances, damage, and
 * side effects (`0x6FCFC0B0`, `0x6FCFE0C0`, `0x6FCFCF20`).
 *
 * @va D2Game:0x6FD142D0
 */
export function OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pObjectUnit: number,
  pTargetUnit: number,
  nElemType: number,
): void {
  hitD2GameVa113c(0x6FD142D0)
  const ebpTarget = pTargetUnit >>> 0
  const pRoom = UNITS_GetRoom113c(m, ebpTarget) >>> 0
  DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  if ((DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) | 0) !== 0) return

  const esiObj = pObjectUnit >>> 0
  if ((UNITS_TestCollisionBetweenUnits113c(m, ebpTarget, esiObj, 0x804) | 0) !== 0) return

  const pObjSeed = (esiObj + 0x20) >>> 0
  if (ebpTarget === 0) {
    throw new D2CommonAssertError('', 0x3f)
  }

  const curHp = STATLIST_GetUnitStat113c(m, ebpTarget, 6, 0) | 0
  let minDmg = curHp >> 5
  if (minDmg <= 1) {
    minDmg = 1
  }
  const minPlus1 = (minDmg + 1) | 0
  let maxDmg = curHp >> 3
  if (maxDmg <= minPlus1) {
    maxDmg = minPlus1
  }

  const targetLvl = STATLIST_GetUnitStat113c(m, ebpTarget, 0x0c, 0) | 0
  const lvlRoll = SEED_RollLimitedFast113c(m, pObjSeed, targetLvl >> 2) | 0
  const lowByteSum = ((lvlRoll & 0xff) + (targetLvl & 0xff)) & 0xff

  const targetDex = STATLIST_GetUnitStat113c(m, ebpTarget, 2, 0) | 0
  const dexTerm = Math.imul(targetDex >> 1, 5)
  let toHit = (((lowByteSum - dexTerm - targetLvl) | 0) << 1) | 0
  const targetAc = STATLIST_GetUnitStat113c(m, ebpTarget, 0x1f, 0) | 0
  toHit = (toHit - targetAc + 0x7d) | 0
  if (toHit < 0x41) {
    toHit = 0x41
  }

  const seedLo = m.u32(pObjSeed) >>> 0
  const seedHi = m.u32((pObjSeed + 0x04) >>> 0) >>> 0
  const prod = BigInt(seedLo) * 0x6ac690c5n + BigInt(seedHi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pObjSeed + 0x04) >>> 0, newHi)
  m.setU32(pObjSeed, newLo)
  const hitRoll = (newLo % 0x64) >>> 0
  if ((hitRoll | 0) >= toHit) return

  const rolledDmg = OBJECTS_RollScaledByte19C_6FD14260_113c(m, maxDmg, minDmg, esiObj) | 0
  if (rolledDmg === 0) return

  const sp = k2W6B7StackPtr
  k2W6B7StackPtr = (sp + 0x70) >>> 0
  const pDmg = sp
  try {
    m.fill(pDmg, 0x70, 0)

    const elem = nElemType | 0
    if (elem === 1) {
      m.setU32((pDmg + 0x10) >>> 0, rolledDmg >>> 0)
      m.setU32((pDmg + 0x60) >>> 0, 0x20)
    } else if (elem === 2) {
      m.setU32((pDmg + 0x1c) >>> 0, rolledDmg >>> 0)
      m.setU32((pDmg + 0x60) >>> 0, 0x40)
    } else if (elem === 3) {
      m.setU32((pDmg + 0x24) >>> 0, rolledDmg >>> 0)
      m.setU32((pDmg + 0x60) >>> 0, 0x30)
    } else {
      m.setU32((pDmg + 0x08) >>> 0, rolledDmg >>> 0)
    }

    m.setU16((pDmg + 0x04) >>> 0, 1)
    if ((STATES_CheckState113c(m, ebpTarget, 0x36) | 0) === 0) {
      m.setU8((pDmg + 0x04) >>> 0, (m.u8((pDmg + 0x04) >>> 0) | 4) & 0xff)
    }

    const ediGame = pGame >>> 0
    SUNITDMG_ApplyResistancesAndAbsorb113c(m, esiObj, ebpTarget, pDmg)
    SUNITDMG_ApplyDamage113c(m, ediGame, esiObj, ebpTarget, pDmg, 0, undefined, 1)
    SUNITDMG_ApplySideEffectsAndKill113c(m, ediGame, esiObj, ebpTarget, pDmg)
  } finally {
    k2W6B7StackPtr = sp
  }
}
