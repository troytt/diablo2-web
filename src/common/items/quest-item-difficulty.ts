/**
 * 1.13c Quest Item Difficulty (`STAT_QUESTITEMDIFFICULTY = 356` / `0x164`) metadata & resolution.
 *
 * Ground Truth:
 * - `D2Game.dll` `0x6FC2E660..0x6FC2E73C` (`ITEMS_FindQuestItemByBaseCode`): when an item's base
 *   record in `Weapons.txt` / `Misc.txt` has `quest != 0` (`+0x12A`) and `questdiffcheck != 0`
 *   (`+0x12B`), requires `STATLIST_GetUnitStat(pItem, 0x164, 0) >= pGame->nDifficulty`.
 * - `D2Game.dll` `0x6FC90EA0` (`CubeMain.txt` `op == 28` / `0x1C`): rejects transmuting any input
 *   item with `quest != 0 && questdiffcheck != 0` whose `stat 0x164 < pGame->nDifficulty`.
 * - `D2Common.dll` `0x6FD7C2D7` (compact item tail) & extended stat list serialization:
 *   compact quest items serialize a 2-bit `stat 356` value (`0 | 1 | 2`); extended quest items
 *   (`Weapons.txt` quest weapons) omit `0` (Normal) from the stat list and emit `stat 356 = 1 | 2`
 *   for Nightmare / Hell, so `STATLIST_GetUnitStat(pItem, 0x164, 0)` evaluates to `0` when absent.
 * - `box` (`Horadric Cube`) has `quest = 10, questdiffcheck = 0` and is valid across all difficulties.
 */

export type GameDifficultyIndex113c = 0 | 1 | 2

export const STAT_QUEST_ITEM_DIFFICULTY_113C = 356

/**
 * Complete set of 1.13c base item codes in `Weapons.txt` and `Misc.txt` with
 * both `quest != 0` (`+0x12A`) and `questdiffcheck != 0` (`+0x12B`).
 * (`box` Horadric Cube has `quest = 10, questdiffcheck = 0` and is intentionally excluded.)
 */
export const QUEST_DIFF_CHECK_ITEM_CODES_113C: ReadonlySet<string> = new Set([
  'leg', // Wirt's Leg (Secret Cow Level)
  'hdm', // Horadric Malus (A1Q5)
  'bks', // Scroll of Inifuss (A1Q3)
  'bkd', // Key to the Cairn Stones (A1Q3)
  'tr1', // Horadric Scroll (A2Q2)
  'msf', // Staff of Kings (A2Q2)
  'vip', // Amulet of the Viper (A2Q2)
  'hst', // Horadric Staff (A2Q2 / A2Q6)
  'ass', // Book of Skill (A2Q1)
  'bbb', // Lam Esen's Tome (A3Q4)
  'qey', // Khalim's Eye (A3Q3)
  'qhr', // Khalim's Heart (A3Q3)
  'qbr', // Khalim's Brain (A3Q3)
  'qf1', // Khalim's Flail (A3Q3)
  'qf2', // Khalim's Will (A3Q3)
  'd33', // Decoy Gidbinn (A3Q2)
  'g33', // The Gidbinn (A3Q2)
  'j34', // A Jade Figurine (A3Q1)
  'g34', // The Golden Bird (A3Q1)
  'xyz', // Potion of Life (A3Q1)
  'mss', // Mephisto's Soulstone (A4Q2)
  'hfh', // Hellforge Hammer (A4Q2)
  'ice', // Malah's Potion (A5Q3)
  'tr2', // Scroll of Resistance (A5Q3)
])

export function isQuestDiffCheckItemCode113c(code: string | null | undefined): boolean {
  if (!code) return false
  return QUEST_DIFF_CHECK_ITEM_CODES_113C.has(code.trim().toLowerCase())
}

function toValidDifficultyIndex(value: unknown): GameDifficultyIndex113c | undefined {
  if (value === 0 || value === 1 || value === 2) return value
  return undefined
}

/**
 * Resolves the authoritative 1.13c `STAT_QUESTITEMDIFFICULTY` (`statId = 356`) of a quest item
 * (`0` = Normal, `1` = Nightmare, `2` = Hell), or `undefined` when the item is not a
 * difficulty-checked quest item or is an unannotated synthetic test stub.
 */
export function resolveQuestItemDifficulty113c(
  item:
    | {
        readonly code?: string | null | undefined
        readonly questItemDifficulty?: unknown
        readonly stats?: unknown
        readonly opcode?: unknown
        readonly version?: unknown
        readonly rawFlags?: unknown
      }
    | null
    | undefined,
): GameDifficultyIndex113c | undefined {
  if (!item || typeof item !== 'object') return undefined
  const code = typeof item.code === 'string' ? item.code.trim().toLowerCase() : ''
  if (!QUEST_DIFF_CHECK_ITEM_CODES_113C.has(code)) return undefined

  const explicit = toValidDifficultyIndex(item.questItemDifficulty)
  if (explicit !== undefined) return explicit

  if (Array.isArray(item.stats)) {
    for (const entry of item.stats) {
      if (!entry || typeof entry !== 'object') continue
      const sid = Number((entry as { statId?: unknown; id?: unknown }).statId ?? (entry as { id?: unknown }).id ?? -1)
      if (sid === STAT_QUEST_ITEM_DIFFICULTY_113C) {
        const val = Math.trunc(Number((entry as { value?: unknown }).value ?? 0))
        return val <= 0 ? 0 : val === 1 ? 1 : 2
      }
    }
    // Extended 1.13c wire (`0x9C`/`0x9D`) and `.d2s` items omit `statId = 356` when its value is `0` (Normal).
    if (
      typeof item.opcode === 'number' ||
      typeof item.version === 'number' ||
      typeof item.rawFlags === 'number'
    ) {
      return 0
    }
  } else if (item.stats instanceof Map) {
    if (item.stats.has(STAT_QUEST_ITEM_DIFFICULTY_113C)) {
      const val = Math.trunc(Number(item.stats.get(STAT_QUEST_ITEM_DIFFICULTY_113C) ?? 0))
      return val <= 0 ? 0 : val === 1 ? 1 : 2
    }
  }

  return undefined
}
