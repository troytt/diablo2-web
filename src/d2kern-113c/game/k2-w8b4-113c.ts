/**
 * D2Game.dll 1.13c — Milestone 33 [K2] Wave 8 Batch 4 (w8b4).
 *
 * Clean-room 1:1 binary-isomorphic port of 8 D2Game.dll v1.13c functions
 * (`0x6FD07640..0x6FD10FF0`).
 */

import { UNITS_GetPlayerData113c } from '../common/composit'
import { D2CommonAssertError } from '../common/inline-helpers'
import { DRLGWARP_TestRoomTileBit113c } from '../common/items'
import { DATATBLS_GetItemsTxtRecordMemPort113c } from '../common/k0-d2common-memports'
import { QUESTRECORD_SetQuestState113c } from '../common/quest-record'
import { STATLIST_GetUnitBaseStat113c } from '../common/statlist'
import { DATATBLS_GetObjectsTxtRecord113c } from '../common/unit'
import type { Memory113c as D2KernMemory113c } from '../mem/sparse-memory'
import { SUNIT_SetUnitEventSound113c } from './ai-fallen-113c'
import {
  D2GAME_PARTY_EnsurePlayerRelationNode113c,
  D2GAME_PARTY_GetPartyIdForUnit113c,
  D2GAME_PARTY_Send0x8BPartyRelationStatus113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c'
import {
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
  QUESTS_SetGlobalQuestState_6FC53920_113c,
} from './k2-laneJ-0x6fc4-w1-113c'
import {
  ACT3Q2_AddQuestDataCount1C_113c,
  PARTY_GetPlayerRelationState113c,
} from './k2-sunit-spawn-w1-113c'
import { QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c } from './k2-w2b1-113c'
import {
  ACT3Q5_Callback14_RemovePlayerGuid_6FD03390_113c,
  ACT3Q5_UpdatePlayerQuestState0E_6FD05CD0_113c,
  ACT3Q6_UpdatePlayerQuestState0E_6FD05B10_113c,
} from './k2-w2b8-113c'
import { ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c } from './k2-w4b3-113c'
import {
  PARTY_CreateAndLinkSubParty_6FCBBF70_113c,
  PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c,
} from './k2-w4b5-113c'
import { SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c } from './k2-w5b7-113c'
import {
  ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c,
  ACT3Q2_SendGidbinnQuestAlertCallback_6FD06130_113c,
  ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c,
  ACT3Q5_CountPlayersMissingFlailOrCubeCallback_6FD036A0_113c,
  ACT3Q5_NotifyPlayerTravincalState0DCallback_6FD03760_113c,
  ACT3Q5_PropagateCouncilCompletionToPartyCallback_6FD06980_113c,
  ACT3Q5_SendTravincalQuestAlertCallback_6FD05D20_113c,
  ACT3Q5_UpdateTravincalNearCouncilKillCallback_6FD05D80_113c,
  ACT3Q7_CompleteMephistoPlayerQuestAndAdvanceAct_6FD034D0_113c,
  ACT3Q7_NotifyPlayerMephistoState0DCallback_6FD03320_113c,
} from './k2-w5b8-113c'
import {
  NET_SendPacket5A_PartyRelationEvent_6FD10720_113c,
  PARTY_RefreshInviteRelationNodes_6FD103E0_113c,
  PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c,
} from './k2-w5b9-113c'
import { NET_BroadcastSystemChatMessage_6FCEBE70_113c } from './k2-w6b3-113c'
import {
  ACT3Q3_OnCainActivatedSendKhalimsWillAlert_6FD06D90_113c,
  ACT3Q7_CheckPlayerInDurance3AndAdvanceActCallback_6FD05C40_113c,
  ACT3Q7_SendMephistoQuestState4Timer_6FD068B0_113c,
} from './k2-w6b6-113c'
import { PARTY_SyncJoinedPartyRelationsCallback_6FD10B90_113c } from './k2-w6b7-113c'
import { QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c } from './k2-w7b1-113c'
import { PARTY_AddPlayerToSubParty_6FCBC4F0_113c } from './k2-w7b3-113c'
import {
  ACT3Q7_PropagateMephistoCompletionToPartyCallback_6FD06850_113c,
  PARTY_DeclareHostility_6FD10CD0_113c,
} from './k2-w7b4-113c'
import { UNITS_ChangeAnimMode113c } from './monster-events'
import { EVENT_SetEventFull113c } from './timer-wheel'
import { hitD2GameVa113c } from '../va-trace-113c'

let k2W8B4StackPtr = 0x7ff80000

function writeCString113c(m: D2KernMemory113c, ptr: number, text: string): void {
  const base = ptr >>> 0
  for (let i = 0; i < text.length; i++) {
    m.setU8((base + i) >>> 0, text.charCodeAt(i) & 0xff)
  }
  m.setU8((base + text.length) >>> 0, 0)
}

/**
 * [1/8] Act 3 Quest 1 (`0x14` Golden Bird) item pickup handler (`0x6FD07640`): checks quest flags `(0x14, 0..1)`,
 * handles Golden Bird (`'g34 '`) or Jade Figurine (`'j34 '`) pickup, broadcasts quest alerts, and sets flag `(0x14, 6)` + sound `0x48`.
 *
 * @dll D2Game.dll
 * @va 0x6FD07640
 * @ordinalOrName D2Game_6FD07640
 */
export function ACT3Q1_OnQuestItemPickedUp_6FD07640_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD07640)
  const esi = pQuest >>> 0
  const ebp = pQuestArg >>> 0
  const pPlayer = m.u32((ebp + 0x0c) >>> 0) >>> 0
  const pGame0 = m.u32(ebp) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame0 + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 0) | 0) !== 0) {
    return
  }
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 1) | 0) !== 0) {
    return
  }

  if (m.u32(0x6fd31c20) !== 0) {
    if (m.u8(0x6fd1aee4) === 0) {
      writeCString113c(m, 0x6fd1aee4, 'something acquired')
    }
    NET_BroadcastSystemChatMessage_6FCEBE70_113c(
      m,
      0x6fd1aee4,
      m.u32((esi + 0x04) >>> 0) >>> 0,
      4,
    )
  }

  const pItem = m.u32((ebp + 0x08) >>> 0) >>> 0
  const nItemId = pItem !== 0 ? m.u32((pItem + 0x04) >>> 0) | 0 : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  const dwCode = m.u32((pItemsTxt + 0x80) >>> 0) >>> 0

  if (dwCode === 0x20343367) {
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, esi, 3)
    m.setU8((esi + 0x0b) >>> 0, 3)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((esi + 0x04) >>> 0) >>> 0,
      ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c,
      0,
      0,
    )
    return
  }

  if (dwCode === 0x2034336a) {
    m.setU8((esi + 0x0b) >>> 0, 1)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((esi + 0x04) >>> 0) >>> 0,
      ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c,
      0,
      0,
    )
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, esi, 1)
    if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 6) | 0) === 0) {
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x14, 6)
      const pPlayerUnit = m.u32((ebp + 0x0c) >>> 0) >>> 0
      SUNIT_SetUnitEventSound113c(m, pPlayerUnit, 0x48, pPlayerUnit)
    }
  }
}

/**
 * [2/8] Act 3 Quest 2 (`0x13` Blade of the Old Religion) item pickup handler (`0x6FD07770`): checks `'g33 '` (The Gidbinn)
 * when `pQuest->bActive (+0x09)` is non-zero, sets quest state `4` and player flag `(0x13, 9)` + sound `0x41`, and syncs Gidbinn state.
 *
 * @dll D2Game.dll
 * @va 0x6FD07770
 * @ordinalOrName D2Game_6FD07770
 */
export function ACT3Q2_OnGidbinnPickedUp_6FD07770_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD07770)
  const ebp = pQuest >>> 0
  const esi = pQuestArg >>> 0

  if (m.u32(0x6fd31c20) !== 0) {
    if (m.u8(0x6fd1af34) === 0) {
      writeCString113c(m, 0x6fd1af34, 'ginbinn acquired')
    }
    NET_BroadcastSystemChatMessage_6FCEBE70_113c(
      m,
      0x6fd1af34,
      m.u32((ebp + 0x04) >>> 0) >>> 0,
      4,
    )
  }

  const pItem = m.u32((esi + 0x08) >>> 0) >>> 0
  const nItemId = pItem !== 0 ? m.u32((pItem + 0x04) >>> 0) | 0 : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0

  if (m.u8((ebp + 0x09) >>> 0) !== 0 && (m.u32((pItemsTxt + 0x80) >>> 0) >>> 0) === 0x20333367) {
    m.setU8((ebp + 0x14) >>> 0, 0)
    m.setU8((ebp + 0x0b) >>> 0, 4)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((ebp + 0x04) >>> 0) >>> 0,
      ACT3Q2_SendGidbinnQuestAlertCallback_6FD06130_113c,
      0,
      0,
    )

    const pPlayer = m.u32((esi + 0x0c) >>> 0) >>> 0
    const pGame0 = m.u32(esi) >>> 0
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
    const nDiff = m.u8((pGame0 + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

    if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 9) | 0) === 0) {
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x13, 9)
      const pSoundUnit = m.u32((esi + 0x0c) >>> 0) >>> 0
      SUNIT_SetUnitEventSound113c(m, pSoundUnit, 0x41, pSoundUnit)
    }

    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, ebp, 4)
    const pGame1 = m.u32((ebp + 0x04) >>> 0) >>> 0
    m.setU8((ebp + 0x14) >>> 0, 0)
    m.setU8((ebp + 0x0b) >>> 0, 3)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pGame1,
      ACT3Q2_SendGidbinnQuestAlertCallback_6FD06130_113c,
      0,
      0,
    )
  }

  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((ebp + 0x04) >>> 0) >>> 0,
    ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c,
    0,
    0,
  )
}

/**
 * [3/8] Act 3 Quest 3 (`0x12` Khalim's Will) NPC speech completion handler (`0x6FD07940`): when NPC is Deckard Cain (`0xF5`),
 * maps speech message IDs `543..548` (`0x21F..0x224`) to quest flags `(0x12, 2..7)` and installs callback `0x6FD06D90` on `543`.
 *
 * @dll D2Game.dll
 * @va 0x6FD07940
 * @ordinalOrName D2Game_6FD07940
 */
export function ACT3Q3_OnNpcSpeechComplete_6FD07940_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD07940)
  const esi = pQuest >>> 0
  const edx = pQuestArg >>> 0
  const pPlayer = m.u32((edx + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(edx) >>> 0
  const wMsgId = m.u16((edx + 0x18) >>> 0)
  const wNpcClassId = m.u16((edx + 0x14) >>> 0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if (wNpcClassId !== 0xf5) {
    return
  }

  const idx = ((wMsgId & 0xffff) - 0x21f) >>> 0
  if (idx > 5) {
    return
  }

  switch (idx) {
    case 0: {
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, esi, 2)
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x12, 2)
      const pExt = m.u32((esi + 0x18) >>> 0) >>> 0
      m.setU8((pExt + 0x01) >>> 0, 1)
      m.setU32((esi + 0xa8) >>> 0, 0x6fd06d90)
      void ACT3Q3_OnCainActivatedSendKhalimsWillAlert_6FD06D90_113c
      return
    }
    case 1:
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x12, 6)
      return
    case 2:
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x12, 3)
      return
    case 3:
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x12, 4)
      return
    case 4:
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x12, 5)
      return
    case 5:
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x12, 7)
      return
  }
}

/**
 * [4/8] Act 3 Quest 5 (`0x15` The Blackened Temple) monster death callback (`0x6FD07DB0`): marks unit flag `0x20000`
 * on monster class `0x16E`, drops Khalim's Flail (`'qf1 '`) or Horadric Cube (`'box '`), and completes Council kill when counter `+0x34` hits `0`.
 *
 * @dll D2Game.dll
 * @va 0x6FD07DB0
 * @ordinalOrName D2Game_6FD07DB0
 */
export function ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD07DB0)
  const ebp = pQuest >>> 0
  const edi = pQuestArg >>> 0

  const prevSp = k2W8B4StackPtr
  const sp = (prevSp - 0x0c) >>> 0
  k2W8B4StackPtr = sp
  try {
    if (m.u32(0x6fd31c20) !== 0) {
      if (m.u8(0x6fd1af1c) === 0) {
        writeCString113c(m, 0x6fd1af1c, 'killed boss for quest')
      }
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        0x6fd1af1c,
        m.u32((ebp + 0x04) >>> 0) >>> 0,
        4,
      )
    }

    const pVictim = m.u32((edi + 0x08) >>> 0) >>> 0
    const esi = m.u32((ebp + 0x18) >>> 0) >>> 0
    if (pVictim !== 0 && (m.u32((pVictim + 0x04) >>> 0) | 0) === 0x16e) {
      m.setU32((pVictim + 0xc4) >>> 0, (m.u32((pVictim + 0xc4) >>> 0) | 0x20000) >>> 0)
      return
    }

    if (m.u8((esi + 0x0d) >>> 0) === 0 || m.u8((esi + 0x0e) >>> 0) === 0) {
      m.setU32((esi + 0x3c) >>> 0, 0)
      m.setU32((esi + 0x40) >>> 0, 0)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((ebp + 0x04) >>> 0) >>> 0,
        ACT3Q5_CountPlayersMissingFlailOrCubeCallback_6FD036A0_113c,
        0,
        0,
      )
    }

    if (m.u8((esi + 0x0d) >>> 0) === 0) {
      const pMonster = m.u32((edi + 0x08) >>> 0) >>> 0
      m.setU32((pMonster + 0xb8) >>> 0, 0x20316671)
      let droppedCount = 0
      let i = 0
      if ((m.u32((esi + 0x3c) >>> 0) | 0) > 0) {
        do {
          const pDropUnit = m.u32((edi + 0x08) >>> 0) >>> 0
          const pDropGame = m.u32((ebp + 0x04) >>> 0) >>> 0
          const pDropped =
            ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
              m,
              pDropGame,
              pDropUnit,
              7,
              (sp + 0x08) >>> 0,
              0,
              -1,
              0,
            ) >>> 0
          if (pDropped !== 0) {
            droppedCount = (droppedCount + 1) | 0
          }
          i = (i + 1) | 0
        } while (i < (m.u32((esi + 0x3c) >>> 0) | 0))
        if (droppedCount !== 0) {
          m.setU8((esi + 0x0d) >>> 0, 1)
          ACT3Q2_AddQuestDataCount1C_113c(m, m.u32((ebp + 0x04) >>> 0) >>> 0, droppedCount)
        }
      }
    } else if (m.u8((esi + 0x0e) >>> 0) === 0) {
      m.setU8((esi + 0x0e) >>> 0, 1)
      const pMonster = m.u32((edi + 0x08) >>> 0) >>> 0
      m.setU32((pMonster + 0xb8) >>> 0, 0x20786f62)
      let i = 0
      if ((m.u32((esi + 0x40) >>> 0) | 0) > 0) {
        do {
          const pDropUnit = m.u32((edi + 0x08) >>> 0) >>> 0
          const pDropGame = m.u32((ebp + 0x04) >>> 0) >>> 0
          ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
            m,
            pDropGame,
            pDropUnit,
            2,
            (sp + 0x08) >>> 0,
            0,
            -1,
            0,
          )
          i = (i + 1) | 0
        } while (i < (m.u32((esi + 0x40) >>> 0) | 0))
      }
    }

    if (m.u8((ebp + 0x09) >>> 0) === 0) {
      return
    }
    const nRemaining = m.u32((esi + 0x34) >>> 0) | 0
    if (nRemaining <= 0) {
      return
    }
    const nNext = (nRemaining - 1) | 0
    m.setU32((esi + 0x34) >>> 0, nNext >>> 0)
    if (nNext !== 0) {
      return
    }

    const pBoss = m.u32((edi + 0x08) >>> 0) >>> 0
    const dwBossGuid = pBoss !== 0 ? m.u32((pBoss + 0x0c) >>> 0) >>> 0 : 0xffffffff
    m.setU32(esi, dwBossGuid)
    m.setU8((ebp + 0x14) >>> 0, 0)

    if (m.u8((esi + 0x0c) >>> 0) !== 0) {
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, ebp, 7)
      m.setU8((ebp + 0x0b) >>> 0, 0x0d)
    } else {
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, ebp, 6)
      m.setU8((ebp + 0x0b) >>> 0, 4)
    }

    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((ebp + 0x04) >>> 0) >>> 0,
      ACT3Q5_SendTravincalQuestAlertCallback_6FD05D20_113c,
      0,
      0,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((ebp + 0x04) >>> 0) >>> 0,
      ACT3Q5_UpdateTravincalNearCouncilKillCallback_6FD05D80_113c,
      0,
      0,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(edi) >>> 0,
      ACT3Q5_PropagateCouncilCompletionToPartyCallback_6FD06980_113c,
      0,
      m.u32((edi + 0x08) >>> 0) >>> 0,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(edi) >>> 0,
      (mem, g, u, a) => ACT3Q5_UpdatePlayerQuestState0E_6FD05CD0_113c(mem, g, u, a),
      0,
      m.u32((edi + 0x08) >>> 0) >>> 0,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(edi) >>> 0,
      ACT3Q5_NotifyPlayerTravincalState0DCallback_6FD03760_113c,
      0,
      m.u32((edi + 0x08) >>> 0) >>> 0,
    )
    QUESTS_SetGlobalQuestState_6FC53920_113c(m, m.u32((ebp + 0x04) >>> 0) >>> 0, 0x15, 0x0d)
  } finally {
    k2W8B4StackPtr = prevSp
  }
}

/**
 * [5/8] Act 3 Quest 1 (`0x14` Golden Bird) boss kill handler (`0x6FD08010`): drops Jade Figurine (`'j34 '`)
 * when killer has not completed the quest and `pQuestExt->bCanDrop (+0x02)` / `+0x0C` are armed, then updates quest state `1`.
 *
 * @dll D2Game.dll
 * @va 0x6FD08010
 * @ordinalOrName D2Game_6FD08010
 */
export function ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD08010)
  const esi = pQuest >>> 0
  const ebx = pQuestArg >>> 0

  const prevSp = k2W8B4StackPtr
  const sp = (prevSp - 0x08) >>> 0
  k2W8B4StackPtr = sp
  try {
    if (m.u32(0x6fd31c20) !== 0) {
      if (m.u8(0x6fd1af1c) === 0) {
        writeCString113c(m, 0x6fd1af1c, 'killed boss for quest')
      }
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        0x6fd1af1c,
        m.u32((esi + 0x04) >>> 0) >>> 0,
        4,
      )
    }

    const ebp = m.u32((esi + 0x18) >>> 0) >>> 0
    if (
      m.u8((esi + 0x09) >>> 0) === 0 ||
      m.u8((ebp + 0x02) >>> 0) === 0 ||
      m.u8((ebp + 0x0c) >>> 0) === 0
    ) {
      return
    }

    const pKiller = m.u32((ebx + 0x0c) >>> 0) >>> 0
    if (pKiller !== 0) {
      const pGame0 = m.u32((esi + 0x04) >>> 0) >>> 0
      const pPlayerData = UNITS_GetPlayerData113c(m, pKiller) >>> 0
      const nDiff = m.u8((pGame0 + 0x6d) >>> 0)
      const nQuestId = m.u32((esi + 0xe0) >>> 0) | 0
      const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
      if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 0) | 0) !== 0) {
        return
      }
    }

    const pMonster = m.u32((ebx + 0x08) >>> 0) >>> 0
    m.setU32((pMonster + 0xb8) >>> 0, 0x2034336a)
    const pDropUnit = m.u32((ebx + 0x08) >>> 0) >>> 0
    const pDropGame = m.u32((esi + 0x04) >>> 0) >>> 0
    const pDropped =
      ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
        m,
        pDropGame,
        pDropUnit,
        2,
        sp,
        0,
        -1,
        0,
      ) >>> 0

    if (pDropped === 0) {
      m.setU8((ebp + 0x01) >>> 0, 1)
      m.setU8((ebp + 0x02) >>> 0, 0)
      return
    }

    m.setU32((esi + 0xc0) >>> 0, 0)
    const nDrops = ((m.u32((ebp + 0x10) >>> 0) | 0) + 1) >>> 0
    m.setU8((ebp + 0x0c) >>> 0, 0)
    m.setU8((ebp + 0x14) >>> 0, 1)
    m.setU32((ebp + 0x10) >>> 0, nDrops)

    if (m.u8((esi + 0x0c) >>> 0) < 1) {
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, esi, 1)
    }

    if (m.u8((esi + 0x0b) >>> 0) === 0) {
      m.setU8((esi + 0x0b) >>> 0, 1)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((esi + 0x04) >>> 0) >>> 0,
        ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c,
        0,
        0,
      )
      m.setU8((ebp + 0x02) >>> 0, 0)
      return
    }

    m.setU8((ebp + 0x02) >>> 0, 0)
  } finally {
    k2W8B4StackPtr = prevSp
  }
}

/**
 * [6/8] Act 3 Quest 7 (`0x16` The Guardian) Mephisto death callback (`0x6FD09A10`): sets quest state `6`,
 * updates killer and party/Durance quest states, schedules timer `0x6FD068B0`, opens portal object, and drops Mephisto's Soulstone (`'mss '`).
 *
 * @dll D2Game.dll
 * @va 0x6FD09A10
 * @ordinalOrName D2Game_6FD09A10
 */
export function ACT3Q7_OnMephistoKilled_6FD09A10_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD09A10)
  const ebp = pQuest >>> 0
  const esi = pQuestArg >>> 0

  const prevSp = k2W8B4StackPtr
  const sp = (prevSp - 0x88) >>> 0
  k2W8B4StackPtr = sp
  try {
    if (m.u32(0x6fd31c20) !== 0) {
      if (m.u8(0x6fd1af1c) === 0) {
        writeCString113c(m, 0x6fd1af1c, 'killed boss for quest')
      }
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        0x6fd1af1c,
        m.u32((ebp + 0x04) >>> 0) >>> 0,
        4,
      )
    }

    m.setU8((ebp + 0x0c) >>> 0, 6)
    writeCString113c(m, (sp + 0x14) >>> 0, 'changing state to 6\n')
    if (m.u32(0x6fd31c20) !== 0) {
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        (sp + 0x14) >>> 0,
        m.u32((ebp + 0x04) >>> 0) >>> 0,
        4,
      )
    }

    const ebx = m.u32((ebp + 0x18) >>> 0) >>> 0
    m.setU32((ebp + 0xc8) >>> 0, 0x6fd03390)
    void ACT3Q5_Callback14_RemovePlayerGuid_6FD03390_113c

    if (m.u8((ebp + 0x09) >>> 0) !== 0) {
      const pKiller0 = m.u32((esi + 0x0c) >>> 0) >>> 0
      if (pKiller0 !== 0) {
        const pGame0 = m.u32((ebp + 0x04) >>> 0) >>> 0
        const pPlayerData0 = UNITS_GetPlayerData113c(m, pKiller0) >>> 0
        const nDiff0 = m.u8((pGame0 + 0x6d) >>> 0)
        const pQuestFlags0 = m.u32((pPlayerData0 + nDiff0 * 4 + 0x10) >>> 0) >>> 0
        if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags0, 0x16, 0) | 0) === 0) {
          const pKiller1 = m.u32((esi + 0x0c) >>> 0) >>> 0
          const pGame1 = m.u32((ebp + 0x04) >>> 0) >>> 0
          const pPlayerData1 = UNITS_GetPlayerData113c(m, pKiller1) >>> 0
          const nDiff1 = m.u8((pGame1 + 0x6d) >>> 0)
          const pQuestFlags1 = m.u32((pPlayerData1 + nDiff1 * 4 + 0x10) >>> 0) >>> 0
          if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags1, 0x16, 0x0b) | 0) === 0) {
            const pExt0 = m.u32((ebp + 0x18) >>> 0) >>> 0
            m.setU32((pExt0 + 0x1c) >>> 0, ((m.u32((pExt0 + 0x1c) >>> 0) | 0) + 1) >>> 0)
          }
          const pKiller2 = m.u32((esi + 0x0c) >>> 0) >>> 0
          const pGame2 = m.u32((ebp + 0x04) >>> 0) >>> 0
          const pPlayerData2 = UNITS_GetPlayerData113c(m, pKiller2) >>> 0
          const nDiff2 = m.u8((pGame2 + 0x6d) >>> 0)
          const pQuestFlags2 = m.u32((pPlayerData2 + nDiff2 * 4 + 0x10) >>> 0) >>> 0
          ACT3Q7_CompleteMephistoPlayerQuestAndAdvanceAct_6FD034D0_113c(
            m,
            pQuestFlags2,
            m.u32((esi + 0x0c) >>> 0) >>> 0,
            m.u32(esi) >>> 0,
          )
        }
      }

      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32(esi) >>> 0,
        ACT3Q7_CheckPlayerInDurance3AndAdvanceActCallback_6FD05C40_113c,
        0,
        m.u32((esi + 0x08) >>> 0) >>> 0,
      )
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32(esi) >>> 0,
        ACT3Q7_PropagateMephistoCompletionToPartyCallback_6FD06850_113c,
        0,
        m.u32((esi + 0x08) >>> 0) >>> 0,
      )
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32(esi) >>> 0,
        (mem, g, u, a) => ACT3Q6_UpdatePlayerQuestState0E_6FD05B10_113c(mem, g, u, a),
        0,
        m.u32((esi + 0x08) >>> 0) >>> 0,
      )
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32(esi) >>> 0,
        ACT3Q7_NotifyPlayerMephistoState0DCallback_6FD03320_113c,
        0,
        m.u32((esi + 0x08) >>> 0) >>> 0,
      )

      if (m.u8(ebx) === 0) {
        QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 0x0c, ebp, 0x6fd068b0)
        void ACT3Q7_SendMephistoQuestState4Timer_6FD068B0_113c
        m.setU8(ebx, 1)
      }
    }

    const pGameGlobal = m.u32(esi) >>> 0
    const pQuests = m.u32((pGameGlobal + 0x10f4) >>> 0) >>> 0
    if ((m.u32((pQuests + 0x08) >>> 0) >>> 0) === 0) {
      throw new D2CommonAssertError('', 0x820)
    }
    QUESTRECORD_SetQuestState113c(m, m.u32((pQuests + 0x0c) >>> 0) >>> 0, 0x16, 0x0d)

    if (m.u8((ebx + 0x01) >>> 0) !== 0) {
      const pGameObj = m.u32((ebp + 0x04) >>> 0) >>> 0
      const dwObjGuid = m.u32((ebx + 0x04) >>> 0) >>> 0
      if (pGameObj === 0) {
        throw new D2CommonAssertError('', 0x2d3)
      }
      let pObj = m.u32((pGameObj + 0x1520 + (dwObjGuid & 0x7f) * 4) >>> 0) >>> 0
      while (pObj !== 0) {
        if ((m.u32((pObj + 0x0c) >>> 0) >>> 0) === dwObjGuid) {
          UNITS_ChangeAnimMode113c(m, pObj, 1)
          const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pObj + 0x04) >>> 0) | 0) >>> 0
          const nFrameDelta = (m.u32((pObjTxt + 0xdc) >>> 0) >>> 8) >>> 0
          const pGameCur = m.u32((ebp + 0x04) >>> 0) >>> 0
          const nTargetFrame = ((m.u32((pGameCur + 0xa8) >>> 0) | 0) + (nFrameDelta | 0)) >>> 0
          EVENT_SetEventFull113c(m, pGameCur, pObj, 1, nTargetFrame, 0, 0, 0)
          break
        }
        pObj = m.u32((pObj + 0xe4) >>> 0) >>> 0
      }
    }

    m.setU32((ebx + 0x0c) >>> 0, 2)
    const pMonster = m.u32((esi + 0x08) >>> 0) >>> 0
    m.setU32((pMonster + 0xb8) >>> 0, 0x2073736d)
    let i = 0
    if ((m.u32((ebx + 0x1c) >>> 0) | 0) > 0) {
      do {
        const pDropUnit = m.u32((esi + 0x08) >>> 0) >>> 0
        const pDropGame = m.u32(esi) >>> 0
        const pDropped =
          ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
            m,
            pDropGame,
            pDropUnit,
            2,
            (sp + 0x0c) >>> 0,
            0,
            -1,
            0,
          ) >>> 0
        if (pDropped !== 0) {
          const nCount = ((m.u32((ebx + 0x14) >>> 0) | 0) + 1) >>> 0
          m.setU8((ebx + 0x18) >>> 0, 1)
          m.setU32((ebx + 0x14) >>> 0, nCount)
        }
        i = (i + 1) | 0
      } while (i < (m.u32((ebx + 0x1c) >>> 0) | 0))
    }

    const pGameEnd = m.u32((ebp + 0x04) >>> 0) >>> 0
    const pQuestsEnd = m.u32((pGameEnd + 0x10f4) >>> 0) >>> 0
    m.setU8((pQuestsEnd + 0x20) >>> 0, 0x0b)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pGameEnd,
      (mem, g, u, a) => QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c(mem, g, u, a),
      0,
      0,
    )
  } finally {
    k2W8B4StackPtr = prevSp
  }
}

/**
 * [7/8] Party invite accept handler (`0x6FD10D50`): verifies invite state `2`, creates or joins `wPartyId`,
 * refreshes pending invite relation nodes, sends packet `0x5A` (`bAction = 8`), and syncs party relations across living players (`0x6FD10B90`).
 *
 * @dll D2Game.dll
 * @va 0x6FD10D50
 * @ordinalOrName D2Game_6FD10D50
 */
export function PARTY_AcceptInviteAndSyncParty_6FD10D50_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAccepterUnit: number,
  pInviterUnit: number,
  _dwUnused1: number = 0,
  _dwUnused2: number = 0,
): void {
  hitD2GameVa113c(0x6FD10D50)
  const edi = pGame >>> 0
  const ebp = pAccepterUnit >>> 0
  const esi = pInviterUnit >>> 0

  const prevSp = k2W8B4StackPtr
  const sp = (prevSp - 0x10) >>> 0
  k2W8B4StackPtr = sp
  try {
    let wPartyId = 0xffff
    if (esi !== 0) {
      const pInviterGame = m.u32((esi + 0x80) >>> 0) >>> 0
      if (pInviterGame !== 0 && (m.u32(esi) >>> 0) === 0) {
        wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, esi, pInviterGame) & 0xffff
      }
    }

    D2GAME_PARTY_EnsurePlayerRelationNode113c(m, esi, ebp, edi)
    D2GAME_PARTY_EnsurePlayerRelationNode113c(m, ebp, esi, edi)

    const wRelState = PARTY_GetPlayerRelationState113c(m, ebp, esi) & 0xffff
    if (wRelState !== 2) {
      D2GAME_PARTY_Send0x8BPartyRelationStatus113c(m, ebp, esi)
      D2GAME_PARTY_Send0x8BPartyRelationStatus113c(m, esi, ebp)
      return
    }

    if (wPartyId === 0xffff) {
      wPartyId = PARTY_CreateAndLinkSubParty_6FCBBF70_113c(m, edi) & 0xffff
      PARTY_AddPlayerToSubParty_6FCBC4F0_113c(m, edi, wPartyId, esi)
      PARTY_AddPlayerToSubParty_6FCBC4F0_113c(m, edi, wPartyId, ebp)
      PARTY_RefreshInviteRelationNodes_6FD103E0_113c(m, edi, esi)
    } else {
      PARTY_AddPlayerToSubParty_6FCBC4F0_113c(m, edi, wPartyId, ebp)
    }

    PARTY_RefreshInviteRelationNodes_6FD103E0_113c(m, edi, ebp)

    const dwInviterGuid = esi !== 0 ? m.u32((esi + 0x0c) >>> 0) >>> 0 : 0xffffffff
    let pClient = 0
    if (ebp !== 0 && (m.u32(ebp) >>> 0) === 0) {
      const pAccepterData = UNITS_GetPlayerData113c(m, ebp) >>> 0
      pClient = m.u32((pAccepterData + 0x9c) >>> 0) >>> 0
    }
    NET_SendPacket5A_PartyRelationEvent_6FD10720_113c(m, dwInviterGuid, pClient, 8)

    m.setU32((sp + 0x04) >>> 0, esi)
    m.setU32((sp + 0x08) >>> 0, ebp)
    m.setU32((sp + 0x0c) >>> 0, wPartyId & 0xffff)
    D2GAME_SUNIT_IterateAllLivingPlayers113c(
      m,
      edi,
      PARTY_SyncJoinedPartyRelationsCallback_6FD10B90_113c,
      (sp + 0x04) >>> 0,
    )
  } finally {
    k2W8B4StackPtr = prevSp
  }
}

/**
 * [8/8] Declares mutual hostility (`0x08`) between `pSourcePlayer` and `pTargetPlayer` (or `pTargetPlayer`'s entire sub-party via `0x6FD10CD0`
 * if in a party and `pSourcePlayer` level `>= 9`), broadcasts packet `0x8C`, and sends packet `0x5A` (`bAction = 3`).
 *
 * @dll D2Game.dll
 * @va 0x6FD10FF0
 * @ordinalOrName D2Game_6FD10FF0
 */
export function PARTY_DeclareHostilityBetweenPlayers_6FD10FF0_113c(
  m: D2KernMemory113c,
  pTargetPlayer: number,
  pSourcePlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FD10FF0)
  const ebx = pTargetPlayer >>> 0
  const ebp = pSourcePlayer >>> 0
  const edi = pGame >>> 0

  if (ebx !== 0) {
    const pTargetGame = m.u32((ebx + 0x80) >>> 0) >>> 0
    if (pTargetGame !== 0 && (m.u32(ebx) >>> 0) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, ebx, pTargetGame) & 0xffff
      if (wPartyId !== 0xffff) {
        if ((STATLIST_GetUnitBaseStat113c(m, ebp, 0x0c, 0) | 0) >= 9) {
          PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
            m,
            edi,
            wPartyId,
            PARTY_DeclareHostility_6FD10CD0_113c,
            ebp,
          )
        }
        return
      }
    }
  }

  if (ebp === 0 || (m.u32(ebp) >>> 0) !== 0) {
    throw new D2CommonAssertError('', 0x24)
  }
  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, ebx, ebp, edi)
  PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c(m, 8, ebp, ebx, edi, 1)

  if (ebx === 0 || (m.u32(ebx) >>> 0) !== 0) {
    throw new D2CommonAssertError('', 0x24)
  }
  D2GAME_PARTY_EnsurePlayerRelationNode113c(m, ebp, ebx, edi)
  PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c(m, 8, ebx, ebp, edi, 1)

  const dwSourceGuid = m.u32((ebp + 0x0c) >>> 0) >>> 0
  if ((m.u32(ebx) >>> 0) === 0) {
    const pTargetData = UNITS_GetPlayerData113c(m, ebx) >>> 0
    const pClient = m.u32((pTargetData + 0x9c) >>> 0) >>> 0
    NET_SendPacket5A_PartyRelationEvent_6FD10720_113c(m, dwSourceGuid, pClient, 3)
    return
  }
  NET_SendPacket5A_PartyRelationEvent_6FD10720_113c(m, dwSourceGuid, 0, 3)
}
