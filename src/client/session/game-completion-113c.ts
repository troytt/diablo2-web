/**
 * Diablo II 1.13c game completion (Baal's "Destruction's End" portal) — client side.
 *
 * Ground truth (see `kb/quests/a5q6-game-completion-113c.md`):
 *
 * - D2Game.dll `0x6fc7fd00` (LastPortal operate, objects.txt OperateFn 72): when the A5Q6 portal is open and
 *   the player has the A5Q6 completion bit, the server warps the player to Harrogath (level 109), saves the
 *   character, sets `pPlayerData->bBusy` and sends **S2C `0x61 07`**.
 * - D2Client.dll `0x6fb5f940` (S2C 0x61) → `0x6fb399a0(pkt[1])`. `pkt[1]` indexes the 8-entry cinematic table
 *   at `0x6fb91314` (count `0x6fb91370` = 8); an index `>= 8` is a FatalAssert (`0x6fb399b3`, error 0xef).
 *   After the Bink video, every index sends C2S `0x48` (`0x6fb39e38`). Index 7 (`D2X_OUT_%s.BIK`) then sets
 *   the "game completed" flag `0x6fbcc3b0 = 1` and calls `0x6faf2850`, which sends C2S `0x69` LeaveGame
 *   (`0x6fac4660`) and stops the game loop.
 * - After the game loop (`0x6faf52a2..0x6faf53a3`), with `0x6fbcc3b0` set the client rewrites the cached
 *   character progression (bits 8..12 of the packed save flags at char-info `+0x1eb`) to
 *   `difficulty * 4 + 5`, and shows the victory screen `0x6faf3a70` unless the old progression rules it out.
 */

import type { CharClassId } from '../../netproto/index.ts'

/** Number of entries in the D2Client cinematic table `0x6fb91314` (`0x6fb91370`). */
export const CINEMATIC_COUNT_113C = 8

/** S2C 0x61 payload that ends the game after Baal (`D2X_OUT_%s.BIK`). */
export const CINEMATIC_GAME_COMPLETE_113C = 7

/** Bink file names of the D2Client cinematic table `0x6fb91314` (12-byte records: name, flags). */
export const CINEMATIC_BINK_NAMES_113C: readonly string[] = [
  'd2_promo.bik',
  'd2intro%s.bik',
  'ACT02START%s.BIK',
  'ACT03START%s.BIK',
  'ACT04START%s.BIK',
  'ACT04END%s.BIK',
  'D2X_INTRO_%s.BIK',
  'D2X_OUT_%s.BIK',
]

/** Hardcoded English titles returned by D2Win.dll `0x6f8ebb50` (tiers 1..6, index 0 = tier 1). */
const EXPANSION_TITLES_MALE = ['Slayer ', 'Champion ', 'Patriarch ', 'Destroyer ', 'Conqueror ', 'Guardian ']
const EXPANSION_TITLES_FEMALE = ['Slayer ', 'Champion ', 'Matriarch ', 'Destroyer ', 'Conqueror ', 'Guardian ']
const CLASSIC_TITLES_MALE = ['Sir ', 'Lord ', 'Baron ', 'Count ', 'Duke ', 'King ']
const CLASSIC_TITLES_FEMALE = ['Dame ', 'Lady ', 'Baroness ', 'Countess ', 'Duchess ', 'Queen ']

/** D2Win.dll byte table `0x6f8ebc78` / `0x6f8ebcbc`: 0 = female title set, 1 = male; classes > 9 use male. */
const CLASS_TITLE_SET = [0, 0, 1, 1, 1, 1, 0, 1, 1, 0] as const

/**
 * D2Win.dll #10205 (`0x6f8ebd00`) `GetCharacterTitle(class, progression, hardcore, expansion)`.
 * Expansion tiers: `< 5` → none, `< 10` → 1, else `2 + (>= 15)`; classic: `< 4`, `< 8`, `2 + (>= 12)`.
 * Hardcore adds 3 to a non-zero tier. Returns `''` for tier 0 (`0x6f8ebc66`).
 */
export function characterTitle113c(
  charClass: number,
  progression: number,
  hardcore: boolean,
  expansion: boolean,
): string {
  let tier: number
  if (expansion) {
    tier = progression < 5 ? 0 : progression < 10 ? 1 : 2 + (progression >= 15 ? 1 : 0)
  } else {
    tier = progression < 4 ? 0 : progression < 8 ? 1 : 2 + (progression >= 12 ? 1 : 0)
  }
  if (hardcore && tier !== 0) tier += 3
  if (tier < 1 || tier > 6) return ''
  const male = charClass > 9 || CLASS_TITLE_SET[charClass] === 1
  const table = expansion
    ? male ? EXPANSION_TITLES_MALE : EXPANSION_TITLES_FEMALE
    : male ? CLASSIC_TITLES_MALE : CLASSIC_TITLES_FEMALE
  return table[tier - 1]!
}

/** Cached MCP character data the victory screen reads (D2Client char info `+0xb9` name, `+0x1eb` flags). */
export interface GameCompletionCharacter {
  readonly name: string
  readonly charClass: CharClassId
  readonly hardcore: boolean
  readonly expansion: boolean
  /** 5-bit progression (packed save flags bits 8..12) as cached from the realm character list. */
  readonly progression: number
}

/** What the client does after S2C `0x61 07` once the game is left. */
export interface GameCompletion113c {
  /** `0x6faf52e0`: false when the old progression already records this difficulty (see `computeGameCompletion113c`). */
  readonly showVictoryScreen: boolean
  /** Progression the client writes back into its cached char info (`0x6faf52fd`). */
  readonly newProgression: number
  /** Victory screen (`0x6faf3a70`) line drawn at y 187: the character name (`0x6faf2c70`). */
  readonly nameLine: string
  /** Victory screen line at y 357 (expansion): `GetCharacterTitle(...) + name` (`0x6faf2d04..0x6faf2e5a`). */
  readonly titleLine: string
}

/**
 * Port of D2Client `0x6faf52b3..0x6faf5308` (progression rewrite + victory-screen gate) and of the title
 * line built by `0x6faf2c70`.
 */
export function computeGameCompletion113c(
  difficulty: number,
  character: GameCompletionCharacter,
): GameCompletion113c {
  if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 2) {
    throw new Error(`computeGameCompletion113c: game difficulty ${difficulty} is not 0..2`)
  }
  const old = character.progression & 0x1f
  // 0x6faf52c8..0x6faf52e0: normal skips the screen when old is 8 or 12, nightmare when old is 12.
  let showVictoryScreen = true
  if (difficulty === 0 && (old === 8 || old === 12)) showVictoryScreen = false
  if (difficulty === 1 && old === 12) showVictoryScreen = false
  // 0x6faf52ed..0x6faf52fd: word[+0x1eb] = (word & 0xe0ff) | ((difficulty << 10) + 0x500).
  const newProgression = difficulty * 4 + 5

  // 0x6faf2d4b..0x6faf2db8: the title progression comes from the game difficulty, not the cached value.
  const exp = character.expansion ? 1 : 0
  const titleProgression = difficulty === 0 ? 4 + exp : difficulty === 1 ? 8 + 2 * exp : 12 + 3 * exp
  const title = characterTitle113c(
    character.charClass,
    titleProgression,
    character.hardcore,
    character.expansion,
  )
  return {
    showVictoryScreen,
    newProgression,
    nameLine: character.name,
    titleLine: `${title}${character.name}`,
  }
}
