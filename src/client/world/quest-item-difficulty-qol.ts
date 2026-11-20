/**
 * Client-side Quest Item / Quest Object Rejection QoL Diagnostics (Issue #2027).
 *
 * In Diablo II 1.13c, when a quest object interaction or Horadric Cube quest recipe fails
 * `ITEMS_FindQuestItemByBaseCode` (`D2Game.dll` `0x6FC2E660`) or `D2Client.dll` weapon pre-gates
 * (`0x6FADACC9..0x6FADADBB`), the game only plays a character speech event (`0x13` `"I can't use
 * this yet"` or `0x27` on Cairn Stones) — or, for `CubeMain.txt` `op == 28`, silently does nothing.
 *
 * This module inspects the player's authoritative client-side containers and game difficulty
 * WITHOUT altering any wire packets or server/client rules, returning a concise localized reason
 * when an interaction or quest transmute is rejected.
 */

import {
  resolveQuestItemDifficulty113c,
  type GameDifficultyIndex113c,
} from '../../common/items/quest-item-difficulty.ts'
import type { ItemData } from '../../netproto/index.ts'
import { tQuestQol, toGameLang, type GameLang, type QuestQolI18nKey, type TblLang } from '../i18n/lang.ts'
import type { ClientItemContainers } from './inventory.ts'

export interface PendingQuestObjectInteract113c {
  readonly objectId: number
  readonly classId: number
  readonly mode: number
  readonly sentAtMs: number
}

/** Max RTT window (ms) between `C2S 0x13` and `S2C 0x2C` (`sound = 0x13 | 0x27`) on self player. */
export const QUEST_OBJECT_REJECT_WINDOW_MS = 2500

/** Cooldown (ms) suppressing duplicate identical red QoL hints on rapid clicks. */
export const QUEST_QOL_HINT_COOLDOWN_MS = 3000

const CAIRN_STONE_CLASS_IDS = new Set([17, 18, 19, 20, 21])

/**
 * `CubeMain.txt` `op == 28` (`0x1C`, `D2Game.dll` `0x6FC90EA0`) quest ingredient codes:
 * - Horadric Staff: `msf + vip -> hst`
 * - Khalim's Will: `qf1 + qey + qhr + qbr -> qf2`
 * - Secret Cow Level: `leg + tbk -> cow portal`
 */
const CUBE_OP28_QUEST_CODES = new Set(['msf', 'vip', 'qf1', 'qey', 'qhr', 'qbr', 'leg'])
const CUBE_OP28_AUX_CODES = new Set(['tbk'])

export function isTrackedQuestRejectObject113c(classId: number, mode = 0): boolean {
  if (classId === 152) return mode === 0 // Horadric Orifice
  if (classId === 376) return mode === 0 || mode === 2 // Hellforge (place Soulstone / strike with Hammer)
  if (CAIRN_STONE_CLASS_IDS.has(classId)) return mode === 0 // Cairn Stones
  return false
}

/**
 * Iterates all local-player item containers inspected by `ITEMS_FindQuestItemByBaseCode`
 * (`D2Game.dll` `0x6FC2E660`: cursor + `pPlayer->pInventory` nodes with `nInvPage != 1`,
 * covering inventory, equipment, belt, cube, stash, and self trade grid).
 */
export function collectOwnedPlayerItems113c(
  containers: Partial<ClientItemContainers> | null | undefined,
): ItemData[] {
  if (!containers) return []
  const out: ItemData[] = []
  const seen = new Set<number>()
  const push = (it: ItemData | null | undefined): void => {
    if (!it || typeof it !== 'object') return
    const id = Number(it.id ?? (it as { itemId?: number }).itemId ?? -1)
    if (id >= 0) {
      if (seen.has(id)) return
      seen.add(id)
    }
    out.push(it)
  }
  push(containers.cursor ?? null)
  for (const map of [
    containers.inventory,
    containers.equipment,
    containers.belt,
    containers.cube,
    containers.stash,
    containers.tradeSelf,
  ]) {
    if (!map) continue
    for (const it of map.values()) push(it)
  }
  return out
}

function inspectOwnedQuestCode(
  ownedItems: readonly ItemData[],
  targetCode: string,
  gameDifficulty: GameDifficultyIndex113c,
): { readonly hasValid: boolean; readonly hasWrongDifficulty: boolean } {
  const norm = targetCode.trim().toLowerCase()
  let hasValid = false
  let hasWrongDifficulty = false
  for (const it of ownedItems) {
    if ((it.code ?? '').trim().toLowerCase() !== norm) continue
    const itemDiff = resolveQuestItemDifficulty113c(it)
    if (itemDiff !== undefined && itemDiff < gameDifficulty) {
      hasWrongDifficulty = true
    } else {
      hasValid = true
    }
  }
  return { hasValid, hasWrongDifficulty }
}

function resolveLang(lang?: GameLang | TblLang): GameLang {
  if (lang === 'en' || lang === 'zh') return lang
  if (lang === 'ENG' || lang === 'CHI') return toGameLang(lang)
  return 'zh'
}

/**
 * Resolves the localized QoL hint when a `C2S 0x13` quest-object interaction is rejected by D2GS
 * with `S2C 0x2C PlaySound(selfPlayer, soundId)` and no `0x58 OpenUi` / mode transition.
 */
export function resolveServerQuestObjectRejectHint113c(params: {
  readonly pending: PendingQuestObjectInteract113c
  readonly soundId: number
  readonly gameDifficulty: GameDifficultyIndex113c
  readonly containers: Partial<ClientItemContainers> | null | undefined
  readonly quests?: ArrayLike<number> | null | undefined
  readonly lang?: GameLang | TblLang | undefined
}): string | null {
  const { pending, soundId, gameDifficulty, containers, quests } = params
  const lang = resolveLang(params.lang)
  const owned = collectOwnedPlayerItems113c(containers)

  // 1. Horadric Orifice (`Objects.txt` 152, `mode === 0`, `D2Game.dll` `0x6FCE6240`):
  //    Server emits `soundId === 0x13` (19) when `ITEMS_FindQuestItemByBaseCode('hst ')` returns NULL.
  if (pending.classId === 152 && pending.mode === 0 && soundId === 0x13) {
    const hst = inspectOwnedQuestCode(owned, 'hst', gameDifficulty)
    if (hst.hasWrongDifficulty && !hst.hasValid) {
      return tQuestQol('quest.orifice.wrongDifficulty', lang)
    }
    const msf = inspectOwnedQuestCode(owned, 'msf', gameDifficulty)
    const vip = inspectOwnedQuestCode(owned, 'vip', gameDifficulty)
    if (msf.hasValid && vip.hasValid) {
      return tQuestQol('quest.orifice.uncombinedPieces', lang)
    }
    return tQuestQol('quest.orifice.missingStaff', lang)
  }

  // 2. Hellforge (`Objects.txt` 376, `D2Game.dll` `0x6FCDB8D0`):
  if (pending.classId === 376 && soundId === 0x13) {
    const a4q2Word = Number(quests?.[27] ?? 0)
    if ((a4q2Word & 0x0003) !== 0) {
      return tQuestQol('quest.hellforge.alreadyCompleted', lang)
    }
    if (pending.mode === 0) {
      const mss = inspectOwnedQuestCode(owned, 'mss', gameDifficulty)
      if (mss.hasWrongDifficulty && !mss.hasValid) {
        return tQuestQol('quest.hellforge.soulstoneWrongDifficulty', lang)
      }
      return tQuestQol('quest.hellforge.missingSoulstone', lang)
    }
    if (pending.mode === 2) {
      const hfh = inspectOwnedQuestCode(owned, 'hfh', gameDifficulty)
      if (hfh.hasWrongDifficulty && !hfh.hasValid) {
        return tQuestQol('quest.hellforge.hammerWrongDifficulty', lang)
      }
      if (hfh.hasValid) {
        return tQuestQol('quest.hellforge.equipHammerRequired', lang)
      }
      return tQuestQol('quest.hellforge.missingHammer', lang)
    }
  }

  // 3. Cairn Stones (`Objects.txt` 17..21, `mode === 0`, `D2Game.dll` `0x6FC864F0`):
  //    Server emits `soundId === 0x27` (39) when `ITEMS_FindQuestItemByBaseCode('bkd ')` returns NULL.
  if (CAIRN_STONE_CLASS_IDS.has(pending.classId) && pending.mode === 0 && soundId === 0x27) {
    const bkd = inspectOwnedQuestCode(owned, 'bkd', gameDifficulty)
    if (bkd.hasWrongDifficulty && !bkd.hasValid) {
      return tQuestQol('quest.cairnStones.wrongDifficulty', lang)
    }
    const bks = inspectOwnedQuestCode(owned, 'bks', gameDifficulty)
    if (bks.hasWrongDifficulty && !bks.hasValid) {
      return tQuestQol('quest.cairnStones.wrongDifficulty', lang)
    }
    if (bks.hasValid) {
      return tQuestQol('quest.cairnStones.undecipheredScroll', lang)
    }
    return tQuestQol('quest.cairnStones.missingScroll', lang)
  }

  return null
}

/**
 * Resolves the localized QoL hint when `D2Client.dll` `0x6FADACC9..0x6FADADBB` (`canOperateObject113c`)
 * blocks operating Compelling Orb (`404`, `mode === 0`) or Hellforge (`376`, `mode === 2`) locally
 * because the required quest weapon (`'qf2'` or `'hfh'`) is not wielded in the active hand.
 */
export function resolveClientWeaponGateRejectHint113c(params: {
  readonly classId: 404 | 376
  readonly gameDifficulty: GameDifficultyIndex113c
  readonly containers: Partial<ClientItemContainers> | null | undefined
  readonly lang?: GameLang | TblLang | undefined
}): string {
  const lang = resolveLang(params.lang)
  const owned = collectOwnedPlayerItems113c(params.containers)
  if (params.classId === 404) {
    const qf2 = inspectOwnedQuestCode(owned, 'qf2', params.gameDifficulty)
    const key: QuestQolI18nKey =
      qf2.hasWrongDifficulty && !qf2.hasValid
        ? 'quest.compellingOrb.wrongDifficulty'
        : qf2.hasValid
          ? 'quest.compellingOrb.equipRequired'
          : 'quest.compellingOrb.missingWill'
    return tQuestQol(key, lang)
  }
  const hfh = inspectOwnedQuestCode(owned, 'hfh', params.gameDifficulty)
  const key: QuestQolI18nKey =
    hfh.hasWrongDifficulty && !hfh.hasValid
      ? 'quest.hellforge.hammerWrongDifficulty'
      : hfh.hasValid
        ? 'quest.hellforge.equipHammerRequired'
        : 'quest.hellforge.missingHammer'
  return tQuestQol(key, lang)
}

/**
 * Inspects Horadric Cube contents when clicking Transmute (`0x4F ClickButton` `0x18`):
 * if the cube holds ingredients for a `CubeMain.txt` `op == 28` quest recipe (`msf + vip`,
 * `qf1 + qey + qhr + qbr`, or `leg + tbk`) and at least one quest ingredient is from an
 * earlier difficulty (`stat 356 < gameDifficulty`), returns the localized refusal hint.
 */
export function resolveCubeQuestDifficultyMismatchHint113c(params: {
  readonly cubeItems: Iterable<ItemData>
  readonly gameDifficulty: GameDifficultyIndex113c
  readonly lang?: GameLang | TblLang | undefined
}): string | null {
  if (params.gameDifficulty <= 0) return null
  const items = [...params.cubeItems]
  if (items.length === 0) return null

  let hasQuestRecipeIngredient = false
  let hasWrongDifficultyQuestItem = false
  for (const item of items) {
    const code = (item.code ?? '').trim().toLowerCase()
    if (CUBE_OP28_QUEST_CODES.has(code)) {
      hasQuestRecipeIngredient = true
      const itemDiff = resolveQuestItemDifficulty113c(item)
      if (itemDiff !== undefined && itemDiff < params.gameDifficulty) {
        hasWrongDifficultyQuestItem = true
      }
    } else if (!CUBE_OP28_AUX_CODES.has(code)) {
      return null
    }
  }

  if (!hasQuestRecipeIngredient || !hasWrongDifficultyQuestItem) return null
  return tQuestQol('quest.cube.wrongDifficulty', resolveLang(params.lang))
}
