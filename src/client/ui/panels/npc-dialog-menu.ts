import type { WorldPanelsHud } from '../world-panels.ts'
import { D2FontRenderer } from '../font.ts'
import { lookupTbl, requireTbl, type TblLang } from '../../i18n/lang.ts'
import { type TownNpcServiceDescriptor, getTownNpcDescriptorByName, getLocalizedNpcName, getLocalizedNpcGreetings, getLocalizedNpcGossip, resolveNpcDialogueTblText } from '../../../common/units/npc-table.ts'
import { CANONICAL_NPC_MSG_ID_TO_TBL_KEY, isNpcIntroMessageId, resolveQuestTitleKeyForMsgId } from '../../../common/data/canonical-npc-dialog-table.ts'
import { CANONICAL_QUEST_TBL_STRINGS, CANONICAL_QUESTS_BY_ACT } from '../../../common/data/canonical-quest-data.ts'
import { NPC_MENU_HEADER_STEP_Y, NPC_MENU_OPTION_STEP_Y, NPC_MENU_PAD_W, NPC_MENU_PAD_H, NPC_MENU_VIEWPORT_MIN_X, NPC_MENU_VIEWPORT_MIN_Y, NPC_MENU_VIEWPORT_BOTTOM_BAR_H, NPC_MENU_HIT_PAD_X, NPC_MENU_HIT_TOP_OFFSET, NPC_MENU_HIT_BOTTOM_OFFSET, STONE_BOX_BG_FILL, NPC_SPEECH_BOX_W, NPC_SPEECH_BOX_H, NPC_SPEECH_MIN_X, NPC_SPEECH_MIN_Y, NPC_SPEECH_BOTTOM_PAD_Y, NPC_SPEECH_LEADING_BLANK_LINES, withNpcSpeechLeadLines, computeNpcMenuAnchor } from './panel-layout-constants.ts'
import {
  resolveNpcGossipStringId113c,
  resolveNpcGossipTblKey113c,
  resolveNpcGreetingSoundId113c,
  resolveNpcIntroStringId113c,
  resolveNpcIntroTblKey113c,
  resolveNpcSpeechSoundId113c,
} from '../../../common/audio/npc-speech-113c.ts'

export type NpcMenuActionId =
  | 'talk'
  | 'talk_intro'
  | 'introduction'
  | 'talk_gossip'
  | 'gossip'
  | 'talk_quest'
  | `talk_quest:${number}`
  | 'talk_back'
  | 'trade'
  | 'trade_repair'
  | 'gamble'
  | 'identify'
  | 'hire'
  | 'resurrect'
  | 'travel_east'
  | 'travel_west'
  | 'travel_harrogath'
  | 'imbue'
  | 'add_sockets'
  | 'personalize'
  | 'respec'
  | 'confirm_respec'
  | 'cancel'

export interface NpcMenuOption {
  readonly id: NpcMenuActionId
  readonly strIdx?: number
  readonly label: string
  readonly labelZh: string
  readonly labelEn: string
}

export interface NpcTalkQuestTopic {
  readonly stringId: number
  readonly menu?: number | undefined
  readonly label?: string | undefined
  readonly labelZh?: string | undefined
  readonly labelEn?: string | undefined
  readonly text?: string | undefined
  readonly textZh?: string | undefined
  readonly textEn?: string | undefined
}

export interface NpcMenuContext {
  readonly hasUnidentifiedItems?: boolean | undefined
  readonly unidentifiedItemCount?: number | undefined
  readonly hasMerc?: boolean | undefined
  readonly hasDeadMercenary?: boolean | undefined
  readonly deadMercenaryReviveCost?: number | undefined
  readonly deadMercenaryName?: string | undefined
  readonly includeQuestRewards?: boolean | undefined
  readonly legacyTradeId?: boolean | undefined
  readonly playerLevel?: number | undefined
  readonly playerClass?: number | undefined
  readonly act?: number | undefined
  readonly suppressGreeting?: boolean | undefined
  readonly returnGreeting?: boolean | undefined
  readonly questFlags?: ArrayLike<number> | undefined
  readonly questMessages?: readonly NpcTalkQuestTopic[] | undefined
  readonly introPlayed?: boolean | undefined
  readonly canGoToAct?: ((act: number) => boolean) | ReadonlySet<number> | ArrayLike<number | boolean> | undefined
  /** Expansion game (S2C 0x01 GameFlags; D2Client `0x6fbc9854`). Gates Tyrael's Travel to Harrogath. */
  readonly expansion?: boolean | undefined
  readonly respecAvailable?: boolean | undefined
  readonly npcScreenX?: number | undefined
  readonly npcScreenY?: number | undefined
  readonly onCancel?: (() => void) | undefined
}

/**
 * D2Client.dll `0x6FB1EC90` (`NPCMENU_OpenTalkSubmenu`):
 * Builds the 2-level `Talk` stone submenu options:
 * - `talk_intro` (`Introduction` / `介紹`, strIdx `3399` / `3386`)
 * - `talk_gossip` (`Gossip` / `閒聊`, strIdx `3395` / `3387`)
 * - Active dynamic quest dialogue topics from `S2C 0x27 NPCInfo` (`menu === 1 || menu === 2`)
 * - `cancel` (`cancel` / `取消`, strIdx `4142`, returns to the primary NPC menu)
 */
export function buildNpcTalkSubmenuOptions(
  descriptor: TownNpcServiceDescriptor,
  context?: NpcMenuContext,
): readonly NpcMenuOption[] {
  const opts: NpcMenuOption[] = []
  const introZh = lookupTbl('Introduction', 'CHI') ?? lookupTbl('introduction', 'CHI') ?? '介紹'
  const introEn = lookupTbl('Introduction', 'ENG') ?? lookupTbl('introduction', 'ENG') ?? 'Introduction'
  opts.push({
    id: 'talk_intro',
    strIdx: 3399,
    label: introEn,
    labelZh: introZh,
    labelEn: introEn,
  })

  const gossipZh = lookupTbl('Gossip', 'CHI') ?? lookupTbl('gossip', 'CHI') ?? '閒聊'
  const gossipEn = lookupTbl('Gossip', 'ENG') ?? lookupTbl('gossip', 'ENG') ?? 'Gossip'
  opts.push({
    id: 'talk_gossip',
    strIdx: 3395,
    label: gossipEn,
    labelZh: gossipZh,
    labelEn: gossipEn,
  })

  if (context?.questMessages && context.questMessages.length > 0) {
    const actQuests = CANONICAL_QUESTS_BY_ACT[descriptor.actIndex + 1] ?? []
    const seenStringIds = new Set<number>()
    for (const qm of context.questMessages) {
      if (!qm || !(qm.stringId > 0)) continue
      if (qm.menu !== undefined && qm.menu !== 0 && qm.menu !== 1 && qm.menu !== 2) continue
      if (isNpcIntroMessageId(qm.stringId)) continue
      if (seenStringIds.has(qm.stringId)) continue
      const titleKey = resolveQuestTitleKeyForMsgId(qm.stringId)
      if (qm.menu !== undefined && titleKey === undefined && !qm.label && !qm.labelZh && !qm.labelEn) continue
      seenStringIds.add(qm.stringId)
      const titleEntry = titleKey ? CANONICAL_QUEST_TBL_STRINGS[titleKey] : undefined
      const matchedQuest = titleKey
        ? actQuests.find((q) => q.titleKey === titleKey) ?? actQuests[0]
        : actQuests[qm.stringId >= 0 && qm.stringId < actQuests.length ? qm.stringId : 0]
      const labelZh =
        qm.labelZh ??
        qm.label ??
        (titleKey ? lookupTbl(titleKey, 'CHI') ?? titleEntry?.zh : undefined) ??
        lookupTbl(`string#${qm.stringId}`, 'CHI') ??
        matchedQuest?.titleZh ??
        `任務 #${qm.stringId}`
      const labelEn =
        qm.labelEn ??
        qm.label ??
        (titleKey ? lookupTbl(titleKey, 'ENG') ?? titleEntry?.en : undefined) ??
        lookupTbl(`string#${qm.stringId}`, 'ENG') ??
        matchedQuest?.titleEn ??
        `Quest #${qm.stringId}`
      opts.push({
        id: `talk_quest:${qm.stringId}`,
        strIdx: qm.stringId,
        label: labelEn,
        labelZh,
        labelEn,
      })
    }
  }

  opts.push({
    id: 'cancel',
    strIdx: 4142,
    label: requireTbl('lowercasecancel', 'ENG'),
    labelZh: requireTbl('lowercasecancel', 'CHI'),
    labelEn: requireTbl('lowercasecancel', 'ENG'),
  })
  return opts
}

/**
 * Tyrael (hcIdx 367) "Travel to Harrogath" gate, 1.13c D2Client.dll.
 *
 * The NPC-menu quest table at `0x6fba2330` (9 records of `{npc, questId, bit, wantSet, fn}`, count at
 * `0x6fba23e4`, walked by `0x6faf5cc0` from `0x6fafa5db`) holds `{367, 28, 0, 1, 0x6faf9000}`: the callback
 * runs only when D2Common #10174 `QUESTRECORD_GetQuestState(playerQuestRecord, 28, 0)` is set.
 * `0x6faf9000` then appends the item (string `0x58d2` "travel to harrogath") only when the client
 * expansion-game flag `0x6fbc9854` is non-zero.
 *
 * Quest 28 bit 0 is written by D2Game.dll `0x6fcdb5e0` only in an expansion game (`pGame+0x70`), with the
 * player in Act 4, after Terror's End (quest 26, bit 0 or bit 13) is done. Neither Hell's Forge (quest 27)
 * nor S2C 0x61 participates.
 */
function isTyraelHarrogathTravelUnlocked(q: ArrayLike<number>, expansion: boolean | undefined): boolean {
  if (expansion === false) return false
  return ((q[28] ?? 0) & 1) !== 0
}

function checkCanGoToAct(
  canGoToAct: ((act: number) => boolean) | ReadonlySet<number> | ArrayLike<number | boolean> | undefined,
  targetAct: number,
): boolean {
  if (!canGoToAct) return false
  if (typeof canGoToAct === 'function') {
    return canGoToAct(targetAct) || canGoToAct(targetAct + 1)
  }
  if (canGoToAct instanceof Set || typeof (canGoToAct as any).has === 'function') {
    return (canGoToAct as Set<number>).has(targetAct) || (canGoToAct as Set<number>).has(targetAct + 1)
  }
  const arr = canGoToAct as ArrayLike<number | boolean>
  return Boolean(arr[targetAct] || arr[targetAct + 1])
}
export function buildNpcMenuOptions(
  descriptor: TownNpcServiceDescriptor,
  context?: NpcMenuContext,
): readonly NpcMenuOption[] {
  const opts: NpcMenuOption[] = []

  // D2Client.dll 0x6fba3ba0: Halbu (257) and Jamella (405) have no "talk" option in their static menu table.
  if (descriptor.canTalk !== false) {
    opts.push({
      id: 'talk',
      strIdx: 3381,
      label: requireTbl('TalkMenu', 'CHI'),
      labelZh: requireTbl('TalkMenu', 'CHI'),
      labelEn: requireTbl('TalkMenu', 'ENG'),
    })
  }

  const pushHireAndResurrect = (): void => {
    // Hire (static in g_NpcMenuTable per D2Client.dll 0x6FB1EC00, gated at 0x6faf8e83):
    if (descriptor.canHire) {
      let allowHire = true
      if (descriptor.hcIdx === 150 && context?.questFlags && context.questFlags.length > 0) {
        // D2Client.dll 0x6faf8e83: Kashya Hire/Resurrect requires A1Q2 completed/reward-pending ((q[2] & 3) !== 0),
        // playerLevel >= 8, or player already has a live/dead mercenary (`D2Client_GetMercUnitFromPlayer`).
        allowHire =
          ((context.questFlags[2] ?? 0) & 3) !== 0 ||
          (context.playerLevel !== undefined && context.playerLevel >= 8) ||
          Boolean(context.hasMerc || context.hasDeadMercenary)
      } else if (descriptor.hcIdx === 515 && context?.questFlags && context.questFlags.length > 0) {
        allowHire = ((context.questFlags[36] ?? 0) & 1) !== 0
      }
      if (allowHire) {
        opts.push({
          id: 'hire',
          strIdx: 3397,
          label: requireTbl('NPCMenuHire', 'CHI'),
          labelZh: requireTbl('NPCMenuHire', 'CHI'),
          labelEn: requireTbl('NPCMenuHire', 'ENG'),
        })
      }
    }

    // Resurrect:
    let allowResurrect = true
    if (descriptor.hcIdx === 150 && context?.questFlags && context.questFlags.length > 0) {
      allowResurrect =
        ((context.questFlags[2] ?? 0) & 3) !== 0 ||
        (context.playerLevel !== undefined && context.playerLevel >= 8) ||
        Boolean(context.hasMerc || context.hasDeadMercenary)
    } else if (descriptor.hcIdx === 515 && context?.questFlags && context.questFlags.length > 0) {
      allowResurrect = ((context.questFlags[36] ?? 0) & 1) !== 0
    }
    if (
      allowResurrect &&
      (descriptor.canHire ||
        descriptor.npcTxtKey === 'tyrael1' ||
        descriptor.npcTxtKey === 'qual-kehk' ||
        descriptor.hcIdx === 367 ||
        descriptor.hcIdx === 515 ||
        descriptor.hcIdx === 516) &&
      context?.hasDeadMercenary
    ) {
      const cost = context.deadMercenaryReviveCost ?? 0
      const name = context.deadMercenaryName
      const labelZh = name ? `復活 ${name}：${cost}` : `復活傭兵 (${cost})`
      const labelEn = name ? `Resurrect ${name}: ${cost}` : `Resurrect (${cost})`
      opts.push({
        id: 'resurrect',
        strIdx: 22696,
        label: labelZh,
        labelZh,
        labelEn,
      })
    }
  }

  // D2Client.dll 0x6fba3ba0 entry #12: Asheara (hcIdx = 252) orders ['talk', 'hire', 'trade', 'cancel'].
  if (descriptor.hireBeforeTrade) {
    pushHireAndResurrect()
  }

  if (descriptor.canTrade) {
    let allowTrade = true
    if (descriptor.hcIdx === 512 && context?.questFlags && context.questFlags.length > 0) {
      allowTrade = ((context.questFlags[37] ?? 0) & 1) !== 0
    }
    if (allowTrade) {
      if (descriptor.canRepair) {
        opts.push({
          id: context?.legacyTradeId ? 'trade' : 'trade_repair',
          strIdx: 3334,
          label: requireTbl('NPCMenuTradeRepair', 'CHI'),
          labelZh: requireTbl('NPCMenuTradeRepair', 'CHI'),
          labelEn: requireTbl('NPCMenuTradeRepair', 'ENG'),
        })
      } else {
        opts.push({
          id: 'trade',
          strIdx: 3396,
          label: requireTbl('NPCMenuTrade', 'CHI'),
          labelZh: requireTbl('NPCMenuTrade', 'CHI'),
          labelEn: requireTbl('NPCMenuTrade', 'ENG'),
        })
      }
    }
  }
  if (descriptor.canGamble) {
    let allowGamble = true
    if (descriptor.hcIdx === 512 && context?.questFlags && context.questFlags.length > 0) {
      allowGamble = ((context.questFlags[37] ?? 0) & 1) !== 0
    } else if (descriptor.hcIdx === 514 && context?.questFlags && context.questFlags.length > 0) {
      allowGamble = ((context.questFlags[37] ?? 0) & 1) === 0
    }
    if (allowGamble) {
      opts.push({
        id: 'gamble',
        strIdx: 3398,
        label: requireTbl('gamble', 'CHI'),
        labelZh: requireTbl('gamble', 'CHI'),
        labelEn: requireTbl('gamble', 'ENG'),
      })
    }
  }

  // Identify Items (D2Client.dll 0x6FB1EC00 + 0x6faf8e3a):
  // Static 'identify' option for Deckard Cain across all acts.
  // Gated on having unidentified items in inventory or cube per 1.13c Cain identify.
  // When A1Q3 (`questFlags[4]`) is neither completed (`bit 0`) nor reward-pending (`bit 1`),
  // Cain charges 100 gold per unidentified item (`NPCIdentify2`, strIdx = 3384).
  if (descriptor.canIdentify) {
    const hasUnid =
      context?.unidentifiedItemCount !== undefined
        ? context.unidentifiedItemCount > 0
        : context?.hasUnidentifiedItems !== false
    if (hasUnid) {
      const chargeFee =
        Boolean(context?.questFlags && context.questFlags.length > 0) &&
        ((context!.questFlags![4] ?? 0) & 3) === 0
      if (chargeFee) {
        const cost = 100
        const prefixZh = lookupTbl('NPCIdentify2', 'CHI') ?? '辨視物品：'
        const prefixEn = lookupTbl('NPCIdentify2', 'ENG') ?? 'Identify Items: '
        const labelZh = `${prefixZh}${cost}`
        const labelEn = `${prefixEn}${cost}`
        opts.push({
          id: 'identify',
          strIdx: 3384,
          label: labelZh,
          labelZh,
          labelEn,
        })
      } else {
        opts.push({
          id: 'identify',
          strIdx: 3385,
          label: requireTbl('NPCIdentify1', 'CHI'),
          labelZh: requireTbl('NPCIdentify1', 'CHI'),
          labelEn: requireTbl('NPCIdentify1', 'ENG'),
        })
      }
    }
  }

  if (!descriptor.hireBeforeTrade) {
    pushHireAndResurrect()
  }

  // Travel actions (static in g_NpcMenuTable per D2Client.dll 0x6FB1EC00, gated by quest / 0x61):
  for (const travelAct of descriptor.travelActions ?? []) {
    let allowTravel = true
    if (context?.questFlags !== undefined && context.questFlags.length > 0) {
      const q = context.questFlags
      if (travelAct === 'travel_east') {
        if (descriptor.hcIdx === 210 || descriptor.npcTxtKey === 'meshif1') {
          // Act 2 -> Act 3 (Meshif Sail East): requires A2Q6 completed (q[14] & 1) or canGoToAct(2)
          const qDone = ((q[14] ?? 0) & 1) !== 0
          const canGo = checkCanGoToAct(context.canGoToAct, 2)
          allowTravel = qDone || canGo
        } else {
          // Act 1 -> Act 2 (Warriv Go East): requires A1Q6 completed (q[6] & 1) or canGoToAct(1)
          const qDone = ((q[6] ?? 0) & 1) !== 0
          const canGo = checkCanGoToAct(context.canGoToAct, 1)
          allowTravel = qDone || canGo
        }
      } else if (travelAct === 'travel_harrogath') {
        allowTravel = isTyraelHarrogathTravelUnlocked(q, context.expansion)
      }
    } else if (context?.canGoToAct !== undefined) {
      if (travelAct === 'travel_east') {
        const targetAct = descriptor.hcIdx === 210 || descriptor.npcTxtKey === 'meshif1' ? 2 : 1
        allowTravel = checkCanGoToAct(context.canGoToAct, targetAct)
      } else if (travelAct === 'travel_harrogath') {
        // No quest record: the 1.13c gate reads only the player quest record (never S2C 0x61), so the
        // A5 unlock bit cannot be set and the option is absent.
        allowTravel = false
      }
    }

    if (!allowTravel) continue

    if (travelAct === 'travel_east') {
      if (descriptor.hcIdx === 210 || descriptor.npcTxtKey === 'meshif1') {
        const tblKey = 'MeshifMenuEast'
        opts.push({
          id: 'travel_east',
          strIdx: 3386,
          label: requireTbl(tblKey, 'CHI'),
          labelZh: requireTbl(tblKey, 'CHI'),
          labelEn: requireTbl(tblKey, 'ENG'),
        })
      } else {
        const tblKey = 'WarrivMenu1b'
        opts.push({
          id: 'travel_east',
          strIdx: 3386,
          label: requireTbl(tblKey, 'CHI'),
          labelZh: requireTbl(tblKey, 'CHI'),
          labelEn: requireTbl(tblKey, 'ENG'),
        })
      }
    } else if (travelAct === 'travel_west') {
      if (descriptor.hcIdx === 264 || descriptor.npcTxtKey === 'meshif2' || descriptor.hcIdx === 258) {
        const tblKey = 'MeshifMenuWest'
        opts.push({
          id: 'travel_west',
          strIdx: 3387,
          label: requireTbl(tblKey, 'CHI'),
          labelZh: requireTbl(tblKey, 'CHI'),
          labelEn: requireTbl(tblKey, 'ENG'),
        })
      } else {
        const tblKey = 'WarrivMenu1c'
        opts.push({
          id: 'travel_west',
          strIdx: 3387,
          label: requireTbl(tblKey, 'CHI'),
          labelZh: requireTbl(tblKey, 'CHI'),
          labelEn: requireTbl(tblKey, 'ENG'),
        })
      }
    } else if (travelAct === 'travel_harrogath') {
      const tblKey = 'Travel To Harrogath'
      opts.push({
        id: 'travel_harrogath',
        strIdx: 20013,
        label: requireTbl(tblKey, 'CHI'),
        labelZh: requireTbl(tblKey, 'CHI'),
        labelEn: requireTbl(tblKey, 'ENG'),
      })
    }
  }

  // Quest rewards (imbue, add_sockets, personalize):
  if (context?.includeQuestRewards !== false) {
    for (const rewardAct of descriptor.questRewardActions ?? []) {
      let allowReward = true
      if (context?.questFlags && context.questFlags.length > 0) {
        const q = context.questFlags
        if (rewardAct === 'imbue') {
          // D2Client.dll 0x6faf8b60: Charsi Imbue checks ONLY A1Q5 (`q[3]` bit 1 set, bit 0 clear, level >= 8).
          const allowLvl = context.playerLevel === undefined || context.playerLevel >= 8
          allowReward =
            allowLvl &&
            ((q[3] ?? 0) & 2) !== 0 &&
            ((q[3] ?? 0) & 1) === 0
        } else if (rewardAct === 'add_sockets') {
          allowReward = ((q[35] ?? 0) & 2) !== 0 && ((q[35] ?? 0) & 1) === 0
        } else if (rewardAct === 'personalize') {
          allowReward =
            (((q[37] ?? 0) & 2) !== 0 || ((q[38] ?? 0) & 2) !== 0) &&
            ((q[38] ?? 0) & 1) === 0
        }
      }
      if (allowReward) {
        if (rewardAct === 'imbue') {
          const tblKey = 'strImbue'
          opts.push({
            id: 'imbue',
            strIdx: 3389,
            label: requireTbl(tblKey, 'CHI'),
            labelZh: requireTbl(tblKey, 'CHI'),
            labelEn: requireTbl(tblKey, 'ENG'),
          })
        } else if (rewardAct === 'add_sockets') {
          const tblKey = 'ItemExpSocket'
          opts.push({
            id: 'add_sockets',
            strIdx: 20015,
            label: requireTbl(tblKey, 'CHI'),
            labelZh: requireTbl(tblKey, 'CHI'),
            labelEn: requireTbl(tblKey, 'ENG'),
          })
        } else if (rewardAct === 'personalize') {
          const tblKey = 'NpcPersonalize'
          opts.push({
            id: 'personalize',
            strIdx: 20014,
            label: requireTbl(tblKey, 'CHI'),
            labelZh: requireTbl(tblKey, 'CHI'),
            labelEn: requireTbl(tblKey, 'ENG'),
          })
        }
      }
    }
  }

  // Respec: Akara (tbl #11423)
  if (descriptor.npcTxtKey === 'akara' || descriptor.hcIdx === 148) {
    let allowRespec = true
    if (context?.respecAvailable !== undefined) {
      allowRespec = context.respecAvailable
    } else if (context?.questFlags && context.questFlags.length > 0) {
      const q = context.questFlags
      // D2Client.dll quest gate table 0x6fba2330: Akara = quest 1, bit 0, wantSet 1 (0x6fafa3a0).
      // D2Client.dll 0x6faf8f18..0x6faf8f67: Quest 41 (0x29) bit 0 (0x0001) hides the option once
      // respec is consumed; when Quest 41 is populated, bit 1 (0x0002) must be set.
      const q1 = q[1] ?? 0
      const q41 = q[41] ?? 0
      allowRespec = (q1 & 1) !== 0 && (q41 & 1) === 0 && (q41 === 0 || (q41 & 2) !== 0)
    }
    if (allowRespec) {
      const tblKey = 'ResetStatSkillPoints'
      opts.push({
        id: 'respec',
        strIdx: 11423,
        label: requireTbl(tblKey, 'CHI'),
        labelZh: requireTbl(tblKey, 'CHI'),
        labelEn: requireTbl(tblKey, 'ENG'),
      })
    }
  }

  opts.push({
    id: 'cancel',
    strIdx: 4142,
    label: requireTbl('lowercasecancel', 'CHI'),
    labelZh: requireTbl('lowercasecancel', 'CHI'),
    labelEn: requireTbl('lowercasecancel', 'ENG'),
  })
  return opts
}

export const BOXPIECES_FRAME_W = 14
export const BOXPIECES_FRAME_H = 15

export interface NpcDialogLayout {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
  readonly headerY: number
  readonly optionYs: readonly number[]
}

/**
 * D2Client.dll `0x6fb53580` (`DIALOG_Layout` in `dialog.cpp`):
 * - Uses `font16` (`D2Win_SetFont(1)`)
 * - Line 0 (NPC Name Header): `lineStepY = 21` (`0x15`), `selectable = false`
 * - Lines 1..N (Menu Options): `lineStepY = 15` (`0x0f`), `selectable = true`
 * - `width = maxLineWidth + 20` (`0x14`), `height = totalStepY + 15` (`0x0f`)
 * - `left = anchorX - trunc(width / 2)`, `top = anchorY - 21`
 * - Clamped to viewport (`left ∈ [10, viewportWidth - width]`, `top ∈ [10, viewportHeight - height - 48]`)
 */
export function computeNpcDialogLayout(
  npcName: string,
  options: readonly NpcMenuOption[],
  anchorX: number,
  anchorY: number,
  font: Pick<D2FontRenderer, 'measureText'> | null | undefined,
  lang: TblLang = 'CHI',
  viewportWidth = 800,
  viewportHeight = 600,
): NpcDialogLayout {
  if (!font || typeof font.measureText !== 'function') {
    throw new Error('computeNpcDialogLayout requires a valid D2FontRenderer instance (missing font)')
  }
  const measure = (text: string): number => font.measureText(text, 'font16')

  let maxLineWidth = measure(npcName)
  for (const opt of options) {
    const w = measure(lang === 'ENG' ? opt.labelEn : opt.labelZh)
    if (w > maxLineWidth) maxLineWidth = w
  }

  const headerStepY = NPC_MENU_HEADER_STEP_Y
  const optionStepY = NPC_MENU_OPTION_STEP_Y
  const totalStepY = headerStepY + options.length * optionStepY

  const width = maxLineWidth + NPC_MENU_PAD_W
  const height = totalStepY + NPC_MENU_PAD_H

  let left = Math.trunc(anchorX) - Math.trunc(width / 2)
  let top = Math.trunc(anchorY) - headerStepY

  if (left + width > viewportWidth - NPC_MENU_VIEWPORT_MIN_X) {
    left = viewportWidth - width
  }
  if (top + height > viewportHeight - (NPC_MENU_VIEWPORT_MIN_Y + NPC_MENU_VIEWPORT_BOTTOM_BAR_H)) {
    top = viewportHeight - height - NPC_MENU_VIEWPORT_BOTTOM_BAR_H
  }
  if (left < NPC_MENU_VIEWPORT_MIN_X) left = NPC_MENU_VIEWPORT_MIN_X
  if (top < NPC_MENU_VIEWPORT_MIN_Y) top = NPC_MENU_VIEWPORT_MIN_Y

  const headerY = top + headerStepY
  const optionYs = options.map((_, idx) => top + headerStepY + (idx + 1) * optionStepY)

  return {
    left,
    top,
    width,
    height,
    headerY,
    optionYs,
  }
}

/**
 * D2Client.dll `0x6fb534b0` (`DIALOG_GetLineAtPoint` in `dialog.cpp`):
 * Open-interval hit-testing for selectable options:
 * `mouseX > left + 15 && mouseX < left + width - 15 && mouseY > rowY - 11 && mouseY < rowY + 4`
 */
export function hitTestNpcDialogOption(
  layout: NpcDialogLayout,
  logicalX: number,
  logicalY: number,
): number | null {
  if (
    logicalX <= layout.left + NPC_MENU_HIT_PAD_X ||
    logicalX >= layout.left + layout.width - NPC_MENU_HIT_PAD_X
  ) {
    return null
  }
  for (let i = 0; i < layout.optionYs.length; i++) {
    const rowY = layout.optionYs[i]!
    if (logicalY > rowY - NPC_MENU_HIT_TOP_OFFSET && logicalY < rowY + NPC_MENU_HIT_BOTTOM_OFFSET) {
      return i
    }
  }
  return null
}

/**
 * D2Client.dll `0x6fb53840` (`DIALOG_Draw`) + `0x6fb6e4c0` (`DATA\GLOBAL\UI\menu\boxpieces.dc6`):
 * - Draws translucent black background fill at `(left + 1, top, width - 2, height - 2)`
 * - Tiles the 22 `14x15` carved stone pieces from `boxpieces.dc6`:
 *   - Top edge: frames `2..7` (`(esi % 6) + 2`) at `x = left + 12 .. right - 14` step `12`, `y = top + 12`
 *   - Bottom edge: frames `16..21` (`(esi % 6) + 16`) at `x = left + 13 .. right - 14` step `12`, `y = bottom + 10`
 *   - Left edge: frames `10..12` (`(esi % 3) + 10`) at `x = left - 4`, `y = top + 22 .. bottom - 2` step `12`
 *   - Right edge: frames `13..15` (`(esi % 3) + 13`) at `x = right - 7`, `y = top + 24 .. bottom - 2` step `12`
 *   - Corners: frame `0` `(left, top + 12)`, frame `1` `(right - 12, top + 12)`,
 *     frame `8` `(left, bottom + 1)`, frame `9` `(right - 12, bottom + 1)`
 * - Each `14x15` DC6 cell passed `(nXpos, nYpos)` to `D2GFX_DrawCellContext` is blitted with top-left `(nXpos, nYpos - 15)`.
 */
export function drawStoneBoxFrame(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  boxPiecesImg: HTMLImageElement | null | undefined,
  fillBg = true,
): void {
  if (!boxPiecesImg) {
    throw new Error('Missing required baked UI asset boxpieces.png (DATA\\GLOBAL\\UI\\menu\\boxpieces.dc6)')
  }

  if (fillBg) {
    ctx.fillStyle = STONE_BOX_BG_FILL
    ctx.fillRect(left + 1, top, Math.max(0, width - 2), Math.max(0, height - 2))
  }

  const right = left + width
  const bottom = top + height
  const drawPiece = (frameIdx: number, x: number, y: number): void => {
    ctx.drawImage(
      boxPiecesImg,
      frameIdx * BOXPIECES_FRAME_W,
      0,
      BOXPIECES_FRAME_W,
      BOXPIECES_FRAME_H,
      x,
      y - BOXPIECES_FRAME_H,
      BOXPIECES_FRAME_W,
      BOXPIECES_FRAME_H,
    )
  }

  let esi = 0
  for (let x = left + 12; x < right - 13; x += 12) {
    esi++
    drawPiece((esi % 6) + 2, x, top + 12)
  }
  for (let x = left + 13; x < right - 13; x += 12) {
    esi++
    drawPiece((esi % 6) + 16, x, bottom + 10)
  }
  for (let y = top + 22; y < bottom - 1; y += 12) {
    esi++
    drawPiece((esi % 3) + 10, left - 4, y)
  }
  for (let y = top + 24; y < bottom - 1; y += 12) {
    esi++
    drawPiece((esi % 3) + 13, right - 7, y)
  }
  drawPiece(0, left, top + 12)
  drawPiece(1, right - 12, top + 12)
  drawPiece(8, left, bottom + 1)
  drawPiece(9, right - 12, bottom + 1)
}
/**
 * Wraps multi-paragraph speech text for NpcTextBox rendering without line truncation.
 */
export function wrapSpeechText(
  font: Pick<D2FontRenderer, 'measureText'> | null | undefined,
  text: string,
  maxW: number,
  fontName: 'fontformal12' | 'font8' = 'fontformal12',
): string[] {
  const trimmedText = text.replace(/(?:\r?\n)+$/, '')
  const cleanedText = /\p{Script=Han}/u.test(trimmedText) ? trimmedText : trimmedText.replace(/([^\r\n])\r?\n(?=[^\r\n])/g, '$1 ')
  const paragraphs = cleanedText.split(/\r?\n/)
  const allLines: string[] = []

  const measure = (str: string): number => {
    if (!font) return str.length * (fontName === 'fontformal12' ? 7 : 6)
    return font.measureText(str, fontName)
  }

  for (const p of paragraphs) {
    if (!p.trim()) {
      allLines.push('')
      continue
    }
    const rawTokens = p.match(/\s*[\x21-\xff]+|\s*[^\s\x21-\xff]/g) ?? []
    let line = ''
    for (const rawToken of rawTokens) {
      const trimmed = rawToken.trimStart()
      const candidate = line ? `${line}${rawToken.startsWith(' ') ? ' ' : ''}${trimmed}` : trimmed
      if (line && measure(candidate) > maxW) {
        allLines.push(line)
        line = trimmed
      } else {
        line = candidate
      }
      while (line && measure(line) > maxW && line.length > 1) {
        let splitIdx = 1
        while (splitIdx < line.length && measure(line.slice(0, splitIdx + 1)) <= maxW) {
          splitIdx++
        }
        allLines.push(line.slice(0, splitIdx))
        line = line.slice(splitIdx)
      }
    }
    if (line) {
      allLines.push(line)
    }
  }
  return allLines
}

export interface NpcMenuState {
  /** Server unit id of the NPC (from `NpcInit`); `null` for menus opened without a server unit. */
  npcId: number | null
  npcUnitId?: number | undefined
  npcName: string
  x: number
  y: number
  dialogLines: readonly string[]
  talking: boolean
  // 'respec': Akara confirm submenu (D2Client.dll 0x6fafa2a0 -> 0x6faf9c80), kept across per-frame menu sync.
  submenu?: 'main' | 'talk' | 'respec' | undefined
  primaryOptions?: readonly NpcMenuOption[] | undefined
  questMessages?: readonly NpcTalkQuestTopic[] | undefined
  returnToSubmenu?: 'main' | 'talk' | 'respec' | undefined
  descriptor?: TownNpcServiceDescriptor | undefined
  options?: readonly NpcMenuOption[] | undefined
  hoveredOptionIdx?: number | null | undefined
  context?: NpcMenuContext | undefined
}

export interface NpcSpeechState {
  npcId: number
  descriptor?: TownNpcServiceDescriptor | undefined
  title: string
  npcName: string
  text: string
  lines: readonly string[]
  topic: 'intro' | 'gossip' | 'quest'
  stringId?: number | undefined
  gossipIndex?: number | undefined
  scrollY?: number | undefined
  maxScrollY?: number | undefined
  lastScrollTimeMs?: number | undefined
  autoScroll?: boolean | undefined
  onClose?: (() => void) | undefined
}
export function setLanguageImpl(this: WorldPanelsHud, lang: 'en' | 'zh' | 'ENG' | 'CHI'): void {
  if (lang === 'en' || lang === 'ENG') {
    this.language = 'en'
    this.lang = 'ENG'
  } else {
    this.language = 'zh'
    this.lang = 'CHI'
  }
  if (this._npcSpeech && this._npcSpeech.descriptor) {
    const desc = this._npcSpeech.descriptor
    const msgIdTblKey =
      this._npcSpeech.stringId !== undefined && this._npcSpeech.stringId > 0
        ? CANONICAL_NPC_MSG_ID_TO_TBL_KEY[this._npcSpeech.stringId]
        : undefined
    const questText =
      this._npcSpeech.topic === 'quest' && this._npcSpeech.stringId && this._npcSpeech.stringId > 0
        ? resolveNpcDialogueTblText(desc, {
            topic: 'quest',
            questStringId: this._npcSpeech.stringId,
            lang: this.lang,
          })
        : msgIdTblKey
          ? resolveNpcDialogueTblText(msgIdTblKey, { lang: this.lang })
          : undefined
    const lines = questText
      ? questText.split('\n')
      : this._npcSpeech.topic === 'gossip'
        ? getLocalizedNpcGossip(desc, this.lang, this._npcSpeech.gossipIndex ?? 0)
        : getLocalizedNpcGreetings(desc, this.lang)
    const title = getLocalizedNpcName(desc, this.lang)
    this._npcSpeech.title = title
    this._npcSpeech.npcName = title
    this._npcSpeech.lines = withNpcSpeechLeadLines(lines)
    this._npcSpeech.text = lines.join('\n')
    this._npcSpeech.scrollY = 0
    this._npcSpeech.lastScrollTimeMs = undefined
  }
  if (this.npcMenu?.descriptor) {
    this.npcMenu.npcName = getLocalizedNpcName(this.npcMenu.descriptor, this.lang)
    this.npcMenu.dialogLines = getLocalizedNpcGreetings(this.npcMenu.descriptor, this.lang)
  }
}
export function openNpcSpeechImpl(
  this: WorldPanelsHud,
  descriptor: TownNpcServiceDescriptor,
  textOverride?: string,
  topic: 'intro' | 'gossip' | 'quest' = 'intro',
  stringId?: number,
  onClose?: () => void,
): void {
  this._speechOpenedDuringAction = true
  const effectiveAct = this._npcMenu?.context?.act ?? descriptor.actIndex
  const effectivePlayerClass = this._npcMenu?.context?.playerClass
  const gossipIndex = topic === 'gossip' ? (this._npcGossipCursor.get(descriptor.hcIdx) ?? 0) : undefined
  const effectiveStringId =
    stringId ??
    (topic === 'intro'
      ? resolveNpcIntroStringId113c(descriptor.hcIdx, effectiveAct, effectivePlayerClass)
      : topic === 'gossip'
        ? resolveNpcGossipStringId113c(descriptor.hcIdx, {
            act: effectiveAct,
            playerClass: effectivePlayerClass,
            gossipIndex,
          })
        : undefined)
  const introTblKey =
    topic === 'intro'
      ? stringId !== undefined &&
        stringId > 0 &&
        !(stringId === 1 && descriptor.hcIdx === 155 && effectivePlayerClass !== 3)
        ? CANONICAL_NPC_MSG_ID_TO_TBL_KEY[stringId]
        : resolveNpcIntroTblKey113c(
            descriptor.hcIdx,
            effectiveAct,
            effectivePlayerClass,
            descriptor.npcTxtKey,
          )
      : undefined
  const gossipTblKey =
    topic === 'gossip'
      ? resolveNpcGossipTblKey113c(descriptor.hcIdx, {
          act: effectiveAct,
          playerClass: effectivePlayerClass,
          gossipIndex,
          fallbackNpcTxtKey: descriptor.npcTxtKey,
        })
      : undefined
  const resolvedOverride =
    textOverride ??
    (topic === 'quest' && stringId !== undefined && stringId > 0
      ? resolveNpcDialogueTblText(descriptor, { topic: 'quest', questStringId: stringId, lang: this.lang })
      : topic === 'intro' && introTblKey
        ? resolveNpcDialogueTblText(introTblKey, { lang: this.lang })
        : topic === 'gossip' && gossipTblKey
          ? resolveNpcDialogueTblText(gossipTblKey, { lang: this.lang })
          : undefined)
  const bodyLines = resolvedOverride
    ? resolvedOverride.split('\n')
    : topic === 'gossip'
      ? getLocalizedNpcGossip(descriptor, this.lang, gossipIndex ?? 0)
      : getLocalizedNpcGreetings(descriptor, this.lang)
  // Leading blank lines give the auto-scroll headroom so line 0 is not pushed past the
  // top clip edge moments after the speech opens; `text` stays the pure body text.
  const lines = withNpcSpeechLeadLines(bodyLines)
  const text = resolvedOverride ?? bodyLines.join('\n')
  const title = getLocalizedNpcName(descriptor, this.lang)
  const npcId =
    this._npcMenu?.npcUnitId ??
    this._npcMenu?.npcId ??
    (this as any).activeNpcId ??
    0
  const maxScrollY = Math.max(0, lines.length * 16 - (NPC_SPEECH_BOX_H - 60))
  this._npcSpeech = {
    npcId,
    descriptor,
    title,
    npcName: title,
    text,
    lines,
    topic,
    stringId: effectiveStringId,
    gossipIndex,
    scrollY: 0,
    maxScrollY,
    lastScrollTimeMs: undefined,
    autoScroll: true,
    onClose,
  }
  if (this._npcMenu) {
    this._npcMenu.talking = true
  }
  const speechSoundId = resolveNpcSpeechSoundId113c({
    stringId: effectiveStringId,
    hcIdx: descriptor.hcIdx,
    npcTxtKey: descriptor.npcTxtKey,
    topic,
    act: effectiveAct,
    playerClass: effectivePlayerClass,
    gossipIndex,
  })
  if (speechSoundId > 0) {
    this.onPlayNpcSpeech?.(speechSoundId)
  }
}
export function openStandaloneSpeechImpl(
  this: WorldPanelsHud,
  title: string,
  bodyText: string,
  options?: { stringId?: number; tblKey?: string; onClose?: () => void },
): void {
  this._speechOpenedDuringAction = true
  const cleanText = bodyText.replace(/^\d+\r?\n/, '').trim()
  const lines = cleanText.split(/\r?\n/)
  const maxScrollY = Math.max(0, lines.length * 16 - (NPC_SPEECH_BOX_H - 60))
  this._npcSpeech = {
    npcId: 0,
    title,
    npcName: title,
    text: cleanText,
    lines,
    topic: 'quest',
    stringId: options?.stringId,
    scrollY: 0,
    maxScrollY,
    lastScrollTimeMs: undefined,
    autoScroll: true,
    onClose: options?.onClose,
  }
  if (this._npcMenu) {
    this._npcMenu.talking = true
  }
  if (options?.stringId !== undefined || options?.tblKey !== undefined) {
    const speechSoundId = resolveNpcSpeechSoundId113c({
      stringId: options?.stringId,
      tblKey: options?.tblKey,
      topic: 'quest',
    })
    if (speechSoundId > 0) {
      this.onPlayNpcSpeech?.(speechSoundId)
    }
  }
}
export function closeNpcSpeechImpl(this: WorldPanelsHud): void {
  const onClose = this._npcSpeech?.onClose
  this._npcSpeech = null
  if (this._npcMenu) {
    this._npcMenu.talking = false
    if (this._npcMenu.descriptor) {
      const effectiveCtx =
        this._npcMenu.context ?? {
          questFlags: this.serverQuestFlags.length > 0 ? this.serverQuestFlags : undefined,
          canGoToAct: (this as any).canGoToAct,
        }
      this._npcMenu.primaryOptions = this.buildNpcMenuOptions(
        this._npcMenu.descriptor,
        effectiveCtx,
      )
    }
    if (this._npcMenu.returnToSubmenu === 'talk' && this._npcMenu.descriptor) {
      this._npcMenu.submenu = 'talk'
      this._npcMenu.options = this.buildNpcTalkSubmenuOptions(this._npcMenu.descriptor, {
        questMessages: this._npcMenu.questMessages,
      })
    } else if (this._npcMenu.primaryOptions) {
      this._npcMenu.options = this._npcMenu.primaryOptions
    }
  }
  this.onCloseNpcSpeech?.()
  onClose?.()
}
export function handleNpcSpeechWheelImpl(this: WorldPanelsHud, deltaY: number): boolean {
  if ((!this.npcMenu?.talking && (this.npcMenu !== null || !this._npcSpeech)) || !this._npcSpeech) return false
  const scrollStep = 24
  const dir = deltaY > 0 ? 1 : -1
  this._npcSpeech.autoScroll = false
  const current = this._npcSpeech.scrollY ?? 0
  const maxScroll =
    this._npcSpeech.maxScrollY ||
    Math.max(0, (this._npcSpeech.lines.length ?? 0) * 16 - (NPC_SPEECH_BOX_H - 62))
  this._npcSpeech.scrollY = Math.max(0, Math.min(maxScroll, current + dir * scrollStep))
  return true
}
export function handleNpcSpeechKeyDownImpl(this: WorldPanelsHud, key: string): boolean {
  if ((!this.npcMenu?.talking && (this.npcMenu !== null || !this._npcSpeech)) || !this._npcSpeech) return false
  if (key === 'ArrowDown' || key === 'Down') {
    this._npcSpeech.autoScroll = false
    const current = this._npcSpeech.scrollY ?? 0
    const maxScroll =
      this._npcSpeech.maxScrollY ||
      Math.max(0, (this._npcSpeech.lines.length ?? 0) * 16 - (NPC_SPEECH_BOX_H - 62))
    this._npcSpeech.scrollY = Math.max(0, Math.min(maxScroll, current + 24))
    return true
  }
  if (key === 'ArrowUp' || key === 'Up') {
    this._npcSpeech.autoScroll = false
    const current = this._npcSpeech.scrollY ?? 0
    this._npcSpeech.scrollY = Math.max(0, current - 24)
    return true
  }
  if (
    key === 'Escape' ||
    key === 'Esc' ||
    key === ' ' ||
    key === 'Space' ||
    key === 'Spacebar' ||
    key === 'Enter'
  ) {
    this.closeNpcSpeech()
    return true
  }
  return false
}
export function openNpcMenuImpl(
  this: WorldPanelsHud,
  arg0: number | TownNpcServiceDescriptor,
  arg1?: TownNpcServiceDescriptor | number,
  arg2?: number | NpcMenuContext | readonly NpcTalkQuestTopic[],
  arg3?: number | null,
  arg4?: NpcMenuContext | readonly NpcTalkQuestTopic[],
): void {
  let descriptor: TownNpcServiceDescriptor
  let screenX = 400
  let screenY = 220
  let hasExplicitCoords = false
  let npcId: number | null = null
  let context: NpcMenuContext | undefined

  const normalizeCtx = (
    val: NpcMenuContext | readonly NpcTalkQuestTopic[] | undefined,
  ): NpcMenuContext | undefined => {
    if (!val) return undefined
    if (Array.isArray(val)) return { questMessages: val }
    return val as NpcMenuContext
  }

  if (typeof arg0 === 'number') {
    npcId = arg0
    descriptor = arg1 as TownNpcServiceDescriptor
    if (typeof arg2 === 'number') {
      screenX = arg2
      hasExplicitCoords = true
      if (typeof arg3 === 'number') {
        screenY = arg3
      }
      context = normalizeCtx(arg4)
    } else if (arg2 && typeof arg2 === 'object') {
      context = normalizeCtx(arg2)
    }
  } else {
    descriptor = arg0
    if (typeof arg1 === 'number') {
      screenX = arg1
      hasExplicitCoords = true
    }
    if (typeof arg2 === 'number') {
      screenY = arg2
      hasExplicitCoords = true
    }
    if (typeof arg3 === 'number' || arg3 === null) npcId = arg3
    context = normalizeCtx(arg4)
  }

  let resolvedPos: { x: number; y: number } | null | undefined = null
  if (context?.npcScreenX !== undefined && context?.npcScreenY !== undefined) {
    const anchor = computeNpcMenuAnchor(context.npcScreenX, context.npcScreenY)
    screenX = anchor.x
    screenY = anchor.y
    hasExplicitCoords = true
  } else if (!hasExplicitCoords && npcId !== null) {
    resolvedPos = this.resolveNpcScreenPosition?.(npcId) ?? this.npcScreenPositions.get(npcId) ?? null
    if (resolvedPos) {
      const anchor = computeNpcMenuAnchor(resolvedPos.x, resolvedPos.y)
      screenX = anchor.x
      screenY = anchor.y
    }
  }

  const effectiveContext: NpcMenuContext = {
    hasUnidentifiedItems:
      context?.hasUnidentifiedItems ??
      (context?.unidentifiedItemCount !== undefined ? context.unidentifiedItemCount > 0 : undefined),
    unidentifiedItemCount: context?.unidentifiedItemCount,
    hasDeadMercenary: context?.hasDeadMercenary ?? this.hasDeadMercenary ?? (this.merc ? !this.merc.alive : false),
    deadMercenaryReviveCost:
      context?.deadMercenaryReviveCost ?? this.deadMercenaryReviveCost ?? this.merc?.reviveCost ?? 0,
    deadMercenaryName: context?.deadMercenaryName,
    includeQuestRewards: context?.includeQuestRewards,
    legacyTradeId: context?.legacyTradeId,
    playerLevel: context?.playerLevel,
    playerClass: context?.playerClass,
    act: context?.act ?? descriptor.actIndex,
    suppressGreeting: context?.suppressGreeting,
    returnGreeting: context?.returnGreeting,
    questFlags: context?.questFlags ?? (this.serverQuestFlags.length > 0 ? this.serverQuestFlags : undefined),
    questMessages: context?.questMessages,
    introPlayed: context?.introPlayed,
    canGoToAct: context?.canGoToAct ?? (this as any).canGoToAct,
    expansion: context?.expansion,
  }
  const primaryOptions = this.buildNpcMenuOptions(descriptor, effectiveContext)
  const resolvedUnitId = npcId ?? 0
  const existing = this._npcMenu
  const isSameNpcSession = Boolean(
    existing &&
      existing.npcId === npcId &&
      (npcId !== null || existing.descriptor?.hcIdx === descriptor.hcIdx),
  )
  const isSameOpenMenu = Boolean(isSameNpcSession && !existing?.talking)
  const options = primaryOptions
  const preservedHoverIdx = isSameOpenMenu && existing?.submenu !== 'talk'
    ? Math.min(Math.max(0, existing!.hoveredOptionIdx ?? 0), Math.max(0, options.length - 1))
    : 0
  const finalX = isSameOpenMenu && !hasExplicitCoords && !resolvedPos ? existing!.x : Math.round(screenX)
  const finalY = isSameOpenMenu && !hasExplicitCoords && !resolvedPos ? existing!.y : Math.round(screenY)

  // D2Client.dll 0x6fb53829 -> 0x6fb53370: first selectable line (option index 0) is selected on open,
  // while in-place re-sync of an already-open NPC menu preserves the player's hovered option index (#665).
  this.npcMenu = {
    npcId,
    npcUnitId: resolvedUnitId,
    npcName: getLocalizedNpcName(descriptor, this.lang),
    x: finalX,
    y: finalY,
    dialogLines: getLocalizedNpcGreetings(descriptor, this.lang),
    talking: this._npcSpeech !== null,
    submenu: 'main',
    primaryOptions,
    questMessages: effectiveContext.questMessages ?? existing?.questMessages,
    descriptor,
    options,
    hoveredOptionIdx: preservedHoverIdx,
    context: effectiveContext,
  }

  // D2Client.dll 0x6fb4cce0 (`NPC_PlayGreetingSound` via `0x6fb4cad0`):
  // Play short NPC greeting sound when opening a new NPC stone menu session (unless suppressed by auto-pop speech).
  if (!isSameNpcSession && !this._npcSpeech && !effectiveContext.suppressGreeting) {
    const greetingSoundId = resolveNpcGreetingSoundId113c(descriptor.hcIdx, {
      mode: effectiveContext.returnGreeting ? 2 : 0,
    })
    if (greetingSoundId > 0) {
      this.onPlayNpcSpeech?.(greetingSoundId)
    }
  }
}
export function openNpcMenuByNameImpl(this: WorldPanelsHud, name: string, screenX = 400, screenY = 220): boolean {
  const desc = getTownNpcDescriptorByName(name)
  if (!desc) return false
  this.openNpcMenu(desc, screenX, screenY, null, {
    includeQuestRewards: false,
    legacyTradeId: true,
  })
  return true
}
export function clickNpcMenuOptionImpl(this: WorldPanelsHud, optionId: string, context?: NpcMenuContext): boolean {
  const menu = this._npcMenu
  if (!menu || !menu.descriptor) return false
  const desc = menu.descriptor
  const npcUnitId = menu.npcUnitId ?? menu.npcId ?? this.activeNpcId ?? 0
  if (npcUnitId > 0) this.activeNpcId = npcUnitId

  if (
    optionId === 'talk_intro' ||
    optionId === 'introduction' ||
    optionId === 'talk_gossip' ||
    optionId === 'gossip' ||
    optionId === 'talk_quest' ||
    optionId.startsWith('talk_quest:')
  ) {
    const isIntro = optionId === 'talk_intro' || optionId === 'introduction'
    const isGossip = optionId === 'talk_gossip' || optionId === 'gossip'
    const topic: 'intro' | 'gossip' | 'quest' = isIntro ? 'intro' : isGossip ? 'gossip' : 'quest'
    const questStringId = optionId.startsWith('talk_quest:')
      ? Number.parseInt(optionId.slice('talk_quest:'.length), 10) || 0
      : 2
    let overrideText: string | undefined
    if (topic === 'quest') {
      const qMsg = (context?.questMessages ?? menu.questMessages)?.find((m) => m.stringId === questStringId)
      if (qMsg) {
        overrideText = this.lang === 'ENG' ? (qMsg.textEn ?? qMsg.text) : (qMsg.textZh ?? qMsg.text)
      }
      if (!overrideText && questStringId > 0) {
        overrideText = resolveNpcDialogueTblText(desc, {
          topic: 'quest',
          questStringId,
          lang: this.lang,
        })
      }
      if (!overrideText && qMsg) {
        overrideText = this.lang === 'ENG' ? qMsg.labelEn : qMsg.labelZh
      }
      if (!overrideText && desc.questLines) {
        const firstQuestLine = Object.values(desc.questLines)[0]
        if (firstQuestLine) {
          overrideText = resolveNpcDialogueTblText(firstQuestLine, { lang: this.lang }) ?? firstQuestLine
        }
      }
    }
    const hadOnNpcMenuAction = Boolean(this.onNpcMenuAction)
    menu.returnToSubmenu = menu.submenu ?? 'talk'
    this.openNpcSpeech(desc, overrideText, topic, topic === 'quest' ? questStringId : undefined)
    if (isGossip) {
      this._npcGossipCursor.set(desc.hcIdx, (this._npcGossipCursor.get(desc.hcIdx) ?? 0) + 1)
    }
    this.onNpcMenuAction?.(optionId as NpcMenuActionId, npcUnitId, desc)
    if (!hadOnNpcMenuAction) {
      if (isIntro || isGossip) {
        if (this.onPlayNpcMessage) {
          this.onPlayNpcMessage(desc.hcIdx, npcUnitId)
        } else {
          this.onQuestMessage?.(npcUnitId, isIntro ? 0 : 1)
        }
      } else {
        this.onQuestMessage?.(npcUnitId, questStringId)
      }
    }
    return true
  }

  if (optionId === 'talk_back') {
    this.closeNpcSpeech()
    this.onNpcMenuAction?.('talk_back', npcUnitId, desc)
    return true
  }

  if (
    optionId === 'cancel' &&
    (menu.submenu === 'talk' || menu.submenu === 'respec') &&
    !menu.talking
  ) {
    const effectiveCtx =
      context ??
      menu.context ?? {
        questFlags: this.serverQuestFlags.length > 0 ? this.serverQuestFlags : undefined,
        canGoToAct: (this as any).canGoToAct,
      }
    const primaryOpts = this.buildNpcMenuOptions(desc, effectiveCtx)
    menu.primaryOptions = primaryOpts
    menu.submenu = 'main'
    menu.returnToSubmenu = undefined
    menu.options = primaryOpts
    menu.hoveredOptionIdx = 0
    return true
  }

  const hasMenuFilterContext = Boolean(
    context &&
      (context.hasUnidentifiedItems !== undefined ||
        context.unidentifiedItemCount !== undefined ||
        context.hasDeadMercenary !== undefined ||
        context.includeQuestRewards !== undefined ||
        context.questFlags !== undefined ||
        context.questMessages !== undefined),
  )
  const opts =
    menu.submenu === 'respec'
      ? (menu.options ?? [])
      : hasMenuFilterContext
        ? menu.submenu === 'talk'
          ? this.buildNpcTalkSubmenuOptions(desc, context)
          : this.buildNpcMenuOptions(desc, context)
        : (menu.options ?? [])
  const opt = opts.find(
    o =>
      o.id === optionId ||
      (optionId === 'trade' && o.id === 'trade_repair') ||
      (optionId === 'trade_repair' && o.id === 'trade') ||
      (optionId === 'resurrect_merc' && o.id === 'resurrect'),
  )
  if (!opt) return false

  if (opt.id === 'talk') {
    const talkCtx: NpcMenuContext = {
      ...context,
      questMessages: context?.questMessages ?? menu.questMessages,
    }
    const talkOptions = this.buildNpcTalkSubmenuOptions(desc, talkCtx)
    menu.primaryOptions = menu.primaryOptions ?? menu.options
    menu.questMessages = talkCtx.questMessages
    menu.submenu = 'talk'
    menu.options = talkOptions
    menu.hoveredOptionIdx = 0
    menu.talking = false

    const firstQuestMsg = talkCtx.questMessages?.find(
      (m) => m.stringId > 0 && m.menu !== 3 && !isNpcIntroMessageId(m.stringId),
    )
    const questSpeechText = firstQuestMsg
      ? resolveNpcDialogueTblText(desc, {
          topic: 'quest',
          questStringId: firstQuestMsg.stringId,
          lang: this.lang,
        })
      : undefined
    const lines = questSpeechText ? questSpeechText.split('\n') : getLocalizedNpcGreetings(desc, this.lang)
    const title = getLocalizedNpcName(desc, this.lang)
    this._npcSpeech = {
      npcId: npcUnitId,
      descriptor: desc,
      title,
      npcName: title,
      text: lines.join('\n'),
      lines: withNpcSpeechLeadLines(lines),
      topic: firstQuestMsg ? 'quest' : 'intro',
      ...(firstQuestMsg ? { stringId: firstQuestMsg.stringId } : {}),
      scrollY: 0,
      maxScrollY: Math.max(
        0,
        (lines.length + NPC_SPEECH_LEADING_BLANK_LINES) * 16 - (NPC_SPEECH_BOX_H - 60),
      ),
      lastScrollTimeMs: undefined,
      autoScroll: true,
    }

    const hadOnNpcMenuAction = Boolean(this.onNpcMenuAction)
    this.onNpcMenuAction?.('talk', npcUnitId, desc)
    if (!hadOnNpcMenuAction) {
      this.onQuestMessage?.(npcUnitId, 0)
    }
    return true
  }

  this._speechOpenedDuringAction = false
  const hadOnNpcMenuAction = Boolean(this.onNpcMenuAction)
  this.onNpcMenuAction?.(opt.id, npcUnitId, desc)

  if (opt.id === 'cancel') {
    this._npcMenu = null
    this._npcSpeech = null
    context?.onCancel?.()
    return true
  }

  if (opt.id === 'hire') {
    this._hireOriginNpc = {
      descriptor: desc,
      x: menu.x,
      y: menu.y,
      npcId: npcUnitId,
    }
    this._npcMenu = null
    this._activePanel = 'hire'
    this.hireSelectedIndex = -1
    this.hireHoveredIndex = null
    this.hireScrollOffset = 0
    this.replaceMercConfirmOpen = false
    this.pendingHireCandidate = null
    if (!hadOnNpcMenuAction) {
      this.onNpcEntityAction?.(3, npcUnitId, 0)
    }
    return true
  }

  if (opt.id === 'resurrect') {
    this._npcMenu = null
    if (!hadOnNpcMenuAction) {
      this.onResurrectMerc?.(npcUnitId)
      this.onNpcCancel?.(npcUnitId)
    }
    return true
  }

  if (opt.id === 'travel_east' || opt.id === 'travel_west' || opt.id === 'travel_harrogath') {
    this._npcMenu = null
    if (!hadOnNpcMenuAction) {
      const destArea =
        opt.id === 'travel_harrogath'
          ? 109
          : opt.id === 'travel_east'
            ? (desc.actIndex === 0 || desc.hcIdx === 155 ? 40 : 75)
            : (desc.actIndex === 1 || desc.hcIdx === 175 ? 1 : 40)
      // D2Client.dll 0x6faf8150 -> 0x6faf7b20: send NpcCancel (0x30) before EntityAction (0x38)
      this.onNpcCancel?.(npcUnitId)
      this.onNpcEntityAction?.(0, npcUnitId, destArea)
    }
    return true
  }

  if (opt.id === 'imbue' || opt.id === 'add_sockets' || opt.id === 'personalize') {
    this._npcMenu = null
    this._activePanel = opt.id
    return true
  }

  if (opt.id === 'identify') {
    this._npcMenu = null
    this.onIdentifyAll?.(npcUnitId, desc)
    return true
  }

  if (opt.id === 'respec') {
    this._npcMenu = {
      ...menu,
      submenu: 'respec',
      options: [
        {
          id: 'confirm_respec',
          strIdx: 11168,
          label: requireTbl('ResetStatSkillPoints', this.lang),
          labelZh: requireTbl('ResetStatSkillPoints', 'CHI'),
          labelEn: requireTbl('ResetStatSkillPoints', 'ENG'),
        },
        {
          id: 'cancel',
          strIdx: 4142,
          label: requireTbl('lowercasecancel', this.lang),
          labelZh: requireTbl('lowercasecancel', 'CHI'),
          labelEn: requireTbl('lowercasecancel', 'ENG'),
        },
      ],
      hoveredOptionIdx: -1,
    }
    return true
  }

  if (opt.id === 'confirm_respec') {
    this._npcMenu = null
    if (!hadOnNpcMenuAction) {
      // D2Client.dll 0x6faf90d0: C2S 0x30 NpcCancel (0x6faf8150) first, then C2S 0x38 action 0 / complement 0.
      this.onNpcCancel?.(npcUnitId)
      this.onNpcEntityAction?.(0, npcUnitId, 0)
    }
    return true
  }

  if (opt.id === 'trade' || opt.id === 'trade_repair' || opt.id === 'gamble') {
    this._npcMenu = null
    this._activePanel = 'vendor'
    return true
  }

  return true
}
export function getNpcMenuLayoutImpl(
  this: WorldPanelsHud,
  font?: Pick<D2FontRenderer, 'measureText'> | null,
  viewportWidth: number = this.viewportWidth,
  viewportHeight: number = this.viewportHeight,
): NpcDialogLayout | null {
  if (!this.npcMenu) return null
  const opts = this.npcMenu.options ?? [
    { id: 'talk', strIdx: 3381, label: '交談', labelZh: '交談', labelEn: 'talk' },
    { id: 'cancel', strIdx: 4142, label: '取消', labelZh: '取消', labelEn: 'cancel' },
  ]
  const headerName = this.npcMenu.descriptor
    ? getLocalizedNpcName(this.npcMenu.descriptor, this.lang)
    : getLocalizedNpcName(this.npcMenu.npcName, this.lang)
  const resolvedFont = font === undefined ? this.defaultFont : font
  return computeNpcDialogLayout(
    headerName,
    opts,
    this.npcMenu.x,
    this.npcMenu.y,
    resolvedFont,
    this.lang,
    viewportWidth,
    viewportHeight,
  )
}
export function isPointInNpcMenuImpl(
  this: WorldPanelsHud,
  logicalX: number,
  logicalY: number,
  font?: Pick<D2FontRenderer, 'measureText'> | null,
  viewportWidth: number = this.viewportWidth,
  viewportHeight: number = this.viewportHeight,
): boolean {
  if (!this.npcMenu && !this._npcSpeech) return false
  if (this.npcMenu?.talking || (!this.npcMenu && this._npcSpeech !== null)) {
    const anchorX = this.npcMenu?.x ?? Math.round(viewportWidth / 2)
    const anchorY = this.npcMenu?.y ?? Math.round(viewportHeight / 2) - 80
    const boxW = NPC_SPEECH_BOX_W
    const boxH = NPC_SPEECH_BOX_H
    const bx = Math.max(
      NPC_SPEECH_MIN_X,
      Math.min(viewportWidth - boxW - NPC_SPEECH_MIN_X, Math.round(anchorX - boxW / 2)),
    )
    const by = Math.max(
      NPC_SPEECH_MIN_Y,
      Math.min(viewportHeight - NPC_SPEECH_BOTTOM_PAD_Y - boxH, Math.round(anchorY - boxH / 2)),
    )
    return logicalX >= bx && logicalX <= bx + boxW && logicalY >= by && logicalY <= by + boxH
  }
  if (!this.npcMenu) return false
  const layout = this.getNpcMenuLayout(font, viewportWidth, viewportHeight)
  if (!layout) return false
  return (
    logicalX >= layout.left &&
    logicalX <= layout.left + layout.width &&
    logicalY >= layout.top &&
    logicalY <= layout.top + layout.height
  )
}
export function handleNpcMenuMoveImpl(
  this: WorldPanelsHud,
  logicalX: number,
  logicalY: number,
  font?: Pick<D2FontRenderer, 'measureText'> | null,
  viewportWidth: number = this.viewportWidth,
  viewportHeight: number = this.viewportHeight,
): void {
  if (!this.npcMenu || this.npcMenu.talking) return
  const layout = this.getNpcMenuLayout(font, viewportWidth, viewportHeight)
  if (!layout) return
  // D2Client.dll 0x6fb533c0 -> 0x6fb534b0: update selected option when cursor hits a selectable line;
  // when cursor is outside selectable lines (0x6fb533de: je 0x6fb53402), keep existing selection.
  const hitIdx = hitTestNpcDialogOption(layout, logicalX, logicalY)
  if (hitIdx !== null) {
    this.npcMenu.hoveredOptionIdx = hitIdx
  }
}
export function handleNpcMenuClickImpl(
  this: WorldPanelsHud,
  logicalX: number,
  logicalY: number,
  callbacks: {
    onOpenVendor: (descriptor: TownNpcServiceDescriptor, mode: 'trade' | 'gamble') => void
    onIdentifyAll: (descriptor: TownNpcServiceDescriptor) => void
    /** Menu dismissed (`cancel` option or click outside): the caller sends `NpcCancel` (0x30). */
    onCancel: () => void
  },
  font?: Pick<D2FontRenderer, 'measureText'> | null,
  viewportWidth: number = this.viewportWidth,
  viewportHeight: number = this.viewportHeight,
): boolean {
  if (!this.npcMenu && !this._npcSpeech) return false
  if (this.npcMenu?.talking || (!this.npcMenu && this._npcSpeech !== null)) {
    this.closeNpcSpeech()
    return true
  }
  if (!this.npcMenu) return false

  const opts = this.npcMenu.options ?? [
    { id: 'talk', strIdx: 3381, label: '交談', labelZh: '交談', labelEn: 'talk' },
    { id: 'cancel', strIdx: 4142, label: '取消', labelZh: '取消', labelEn: 'cancel' },
  ]
  const headerName = this.npcMenu.descriptor
    ? getLocalizedNpcName(this.npcMenu.descriptor, this.lang)
    : getLocalizedNpcName(this.npcMenu.npcName, this.lang)
  const resolvedFont = font === undefined ? this.defaultFont : font
  const layout = computeNpcDialogLayout(
    headerName,
    opts,
    this.npcMenu.x,
    this.npcMenu.y,
    resolvedFont,
    this.lang,
    viewportWidth,
    viewportHeight,
  )

  if (
    logicalX < layout.left ||
    logicalX > layout.left + layout.width ||
    logicalY < layout.top ||
    logicalY > layout.top + layout.height
  ) {
    this.npcMenu = null
    this._npcSpeech = null
    this.onCloseNpcSpeech?.()
    callbacks.onCancel()
    return true
  }

  const hitIdx = hitTestNpcDialogOption(layout, logicalX, logicalY)
  if (hitIdx !== null) {
    this.npcMenu.hoveredOptionIdx = hitIdx
    const opt = opts[hitIdx]!
    const desc = this.npcMenu.descriptor
    if (opt.id === 'talk') {
      this.clickNpcMenuOption('talk')
    } else if ((opt.id === 'trade' || opt.id === 'trade_repair') && desc) {
      this.npcMenu = null
      callbacks.onOpenVendor(desc, 'trade')
    } else if (opt.id === 'gamble' && desc) {
      this.npcMenu = null
      callbacks.onOpenVendor(desc, 'gamble')
    } else if (opt.id === 'identify' && desc) {
      this.npcMenu = null
      callbacks.onIdentifyAll(desc)
    } else if (opt.id === 'cancel') {
      if (this.npcMenu.submenu === 'talk' || this.npcMenu.submenu === 'respec') {
        this.clickNpcMenuOption('cancel')
      } else {
        this.npcMenu = null
        this._npcSpeech = null
        this.onCloseNpcSpeech?.()
        callbacks.onCancel()
      }
    } else {
      this.clickNpcMenuOption(opt.id)
    }
    return true
  }
  return true
}
/**
 * Draw Town NPC Stone Interaction Menu (`dialog.cpp` `0x6fb53840` + `npcmenu.cpp` `0x6faf8c50` + `boxpieces.dc6` `0x6fb6e4c0`).
 */
export function drawNpcMenuImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  font: D2FontRenderer,
  assets?: {
    boxPiecesImg?: HTMLImageElement | null
    focus16Img?: HTMLImageElement | null
  },
  viewportWidth: number = this.viewportWidth,
  viewportHeight: number = this.viewportHeight,
): void {
  if (!this.npcMenu && !this._npcSpeech) return
  const boxPiecesImg = this.assertValidUiImage(
    assets && 'boxPiecesImg' in assets ? assets.boxPiecesImg : this.getBoxPiecesImage(),
    'boxPiecesImg',
  )
  if (this.npcMenu?.talking || (!this.npcMenu && this._npcSpeech !== null)) {
    const talkHeaderName = this.npcMenu
      ? this.npcMenu.descriptor
        ? getLocalizedNpcName(this.npcMenu.descriptor, this.lang)
        : getLocalizedNpcName(this.npcMenu.npcName, this.lang)
      : (this._npcSpeech?.title ?? '')
    const anchorX = this.npcMenu?.x ?? Math.round(viewportWidth / 2)
    const anchorY = this.npcMenu?.y ?? Math.round(viewportHeight / 2) - 80
    const boxW = NPC_SPEECH_BOX_W
    const boxH = NPC_SPEECH_BOX_H
    const bx = Math.max(
      NPC_SPEECH_MIN_X,
      Math.min(viewportWidth - boxW - NPC_SPEECH_MIN_X, Math.round(anchorX - boxW / 2)),
    )
    const by = Math.max(
      NPC_SPEECH_MIN_Y,
      Math.min(viewportHeight - NPC_SPEECH_BOTTOM_PAD_Y - boxH, Math.round(anchorY - boxH / 2)),
    )

    drawStoneBoxFrame(ctx, bx, by, boxW, boxH, boxPiecesImg)

    if (talkHeaderName) {
      font.drawText(ctx, talkHeaderName, bx + Math.trunc(boxW / 2), by + 24, {
        font: 'font16',
        color: 'gold',
        align: 'center',
      })
    }

    const dialogLines = this._npcSpeech?.lines
      ? this._npcSpeech.lines
      : this.npcMenu?.descriptor
        ? getLocalizedNpcGreetings(this.npcMenu.descriptor, this.lang)
        : (this.npcMenu?.dialogLines ?? [])
    const bodyText = dialogLines.join('\n')
    // D2Client.dll 0x6fb2bcbd: left/right text margin is 0x10 (16px) inside 0x145 (325px) box.
    const textW = boxW - 32
    const textH = boxH - 64
    const textX = bx + 16
    const textY = by + 44
    const lineH = 16
    // D2FontRenderer.drawText treats y as the alphabetic baseline (glyph ascent = 12px, descent = 2px).
    // Offset baseline by 13px from lineTop so Line 0 renders at [textY + 1, textY + 15] inside clip rect.
    const baselineOffset = 13

    const wrappedLines = wrapSpeechText(font, bodyText, textW, 'fontformal12')
    const totalTextH = wrappedLines.length * lineH
    const maxScrollY = Math.max(0, totalTextH - textH)

    if (this._npcSpeech) {
      this._npcSpeech.maxScrollY = maxScrollY
      if (this._npcSpeech.scrollY === undefined) {
        this._npcSpeech.scrollY = 0
        this._npcSpeech.autoScroll = true
      }

      // D2Client.dll 0x6fb2bb86: initialize tick timestamp on the first rendered frame (dt = 0).
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      if (this._npcSpeech.lastScrollTimeMs === undefined) {
        this._npcSpeech.lastScrollTimeMs = now
      } else {
        const dt = Math.max(0, (now - this._npcSpeech.lastScrollTimeMs) / 1000)
        this._npcSpeech.lastScrollTimeMs = now

        if (this._npcSpeech.autoScroll && this._npcSpeech.scrollY < maxScrollY) {
          this._npcSpeech.scrollY = Math.min(maxScrollY, this._npcSpeech.scrollY + dt * 16)
        }
      }
    }

    const scrollY = this._npcSpeech?.scrollY ?? 0

    ctx.save()
    ctx.beginPath()
    ctx.rect(textX, textY, textW, textH)
    ctx.clip()

    for (let i = 0; i < wrappedLines.length; i++) {
      const lineTop = textY + i * lineH - scrollY
      // Only draw lines whose glyphs fit inside the inner box without being sliced at top/bottom borders
      if (lineTop >= textY - 3 && lineTop + lineH <= textY + textH + 2) {
        font.drawText(ctx, wrappedLines[i]!, textX, lineTop + baselineOffset, {
          font: 'fontformal12',
          color: 'white',
        })
      }
    }
    ctx.restore()
    return
  }
  if (!this.npcMenu) return

  const headerName = this.npcMenu.descriptor
    ? getLocalizedNpcName(this.npcMenu.descriptor, this.lang)
    : getLocalizedNpcName(this.npcMenu.npcName, this.lang)
  const opts = this.npcMenu.options ?? [
    { id: 'talk', strIdx: 3381, label: '交談', labelZh: '交談', labelEn: 'talk' },
    { id: 'cancel', strIdx: 4142, label: '取消', labelZh: '取消', labelEn: 'cancel' },
  ]
  const layout = computeNpcDialogLayout(
    headerName,
    opts,
    this.npcMenu.x,
    this.npcMenu.y,
    font,
    this.lang,
    viewportWidth,
    viewportHeight,
  )

  // 1. D2Client.dll 0x6fb53890 + 0x6fb6e4c0: dark translucent fill + carved stone boxpieces.dc6 border
  drawStoneBoxFrame(ctx, layout.left, layout.top, layout.width, layout.height, boxPiecesImg)

  const centerX = layout.left + Math.trunc(layout.width / 2)

  // 2. D2Client.dll 0x6faf8c67 + 0x6fb53912: Line 0 NPC Name Header in Font16 Gold (color = 4, step = 21)
  font.drawText(ctx, headerName, centerX, layout.headerY, {
    font: 'font16',
    color: 'gold',
    align: 'center',
  })

  // 3. D2Client.dll 0x6faf8f81 + 0x6fb53988..0x6fb53a05: Options in Font16, Blue ('blue', 3) when selected else White ('white', 0)
  const selectedIdx = this.npcMenu.hoveredOptionIdx ?? 0
  for (let i = 0; i < opts.length; i++) {
    const opt = opts[i]!
    const rowY = layout.optionYs[i]!
    const selected = selectedIdx === i
    font.drawText(ctx, this.lang === 'ENG' ? opt.labelEn : opt.labelZh, centerX, rowY, {
      font: 'font16',
      color: selected ? 'blue' : 'white',
      align: 'center',
    })
  }
}
