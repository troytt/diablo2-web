/**
 * 1.13c server-side quest flags (`.d2s` "Woo!" block / S2C 0x29 GameQuestLog).
 *
 * Each difficulty stores 48 little-endian words. The act bases and quest word indices
 * match `src/client/ui/panels/quest-waypoint-data.ts`: word 0 = Act I intro,
 * 1..6 = Act I quests, 9..14 = Act II, 17..22 = Act III, 25..27 = Act IV, 35..40 = Act V.
 */
import { CANONICAL_QUESTS_BY_ACT } from '../../common/data/canonical-quest-data.ts'

export interface QuestFlagInfo113c {
  readonly act: number
  readonly wordIndex: number
  readonly titleEn: string
}

const ACT_BASE: Readonly<Record<number, number>> = { 1: 1, 2: 9, 3: 17, 4: 25, 5: 35 }

export const QUEST_INFO_BY_ID_113C: ReadonlyMap<string, QuestFlagInfo113c> = (() => {
  const out = new Map<string, QuestFlagInfo113c>()
  for (const act of [1, 2, 3, 4, 5]) {
    const base = ACT_BASE[act]!
    for (const quest of CANONICAL_QUESTS_BY_ACT[act] ?? []) {
      const m = /^qstsa(\d)q(\d)$/.exec(quest.titleKey)
      if (!m || Number(m[1]) !== act) continue
      out.set(quest.id, {
        act,
        wordIndex: base + Number(m[2]) - 1,
        titleEn: quest.titleEn,
      })
    }
  }
  return out
})()

/** 1.13c D2BitBufferStrc quest bits. */
export const QUEST_FLAG_COMPLETED_113C = 0x0001 // reward granted
export const QUEST_FLAG_REWARD_PENDING_113C = 0x0002 // objective done, NPC reward pending
export const QUEST_FLAG_STARTED_113C = 0x0004 // quest accepted
export const QUEST_FLAG_PRIMARY_GOAL_DONE_113C = 0x1000
export const QUEST_FLAG_COMPLETED_NOW_113C = 0x2000 // QFLAG_COMPLETEDNOW (bit 13: reward consumed in session)

export function questWordIndex113c(questId: string): number | undefined {
  return QUEST_INFO_BY_ID_113C.get(questId)?.wordIndex
}

export function hasQuestFlag113c(
  quests: Uint16Array,
  questId: string,
  mask: number,
): boolean {
  const idx = questWordIndex113c(questId)
  return idx !== undefined && ((quests[idx] ?? 0) & mask) !== 0
}

export function setQuestFlag113c(
  quests: Uint16Array,
  questId: string,
  mask: number,
): boolean {
  const idx = questWordIndex113c(questId)
  if (idx === undefined) return false
  const next = (quests[idx] ?? 0) | mask
  if (next === quests[idx]) return false
  quests[idx] = next
  return true
}

/** Quest-gated areas with the exact 1.13c required bit (STARTED vs COMPLETED). */
export const QUEST_AREA_GATES_113C: Readonly<
  Record<number, { readonly quest: string; readonly mask: number }>
> = Object.freeze({
  38: { quest: 'a1q3', mask: QUEST_FLAG_STARTED_113C }, // Tristram red portal
  46: { quest: 'a2q5', mask: QUEST_FLAG_COMPLETED_113C }, // Canyon of the Magi: Summoner dead
  73: { quest: 'a2q2', mask: QUEST_FLAG_COMPLETED_113C }, // Tal Rasha's Chamber: staff used
  74: { quest: 'a2q3', mask: QUEST_FLAG_STARTED_113C }, // Arcane Sanctuary: after Tainted Sun
  100: { quest: 'a3q3', mask: QUEST_FLAG_COMPLETED_113C }, // Durance of Hate 1: Khalim's Will
  101: { quest: 'a3q3', mask: QUEST_FLAG_COMPLETED_113C }, // Durance of Hate 2
  102: { quest: 'a3q3', mask: QUEST_FLAG_COMPLETED_113C }, // Durance of Hate 3
  128: { quest: 'a5q5', mask: QUEST_FLAG_COMPLETED_113C }, // Worldstone Keep 1
  129: { quest: 'a5q5', mask: QUEST_FLAG_COMPLETED_113C }, // Worldstone Keep 2
  131: { quest: 'a5q5', mask: QUEST_FLAG_COMPLETED_113C }, // Throne of Destruction
})

/** Quest objects that advance a quest when operated (Objects.txt class id). */
export const QUEST_OBJECT_TO_QUEST_113C: Readonly<Record<number, string>> = Object.freeze({
  8: 'a1q3', // The Moldy Tome
  17: 'a1q3', // Cairn Stone
  18: 'a1q3',
  19: 'a1q3',
  20: 'a1q3',
  21: 'a1q3',
  26: 'a1q3', // Cain's Gibbet
  30: 'a1q3', // Inifuss
  108: 'a1q5', // Horadric Malus
  149: 'a2q3', // Tainted Sun Altar
  193: 'a3q4', // Lam Esen's Tome
  244: 'a3q1', // Rat's Nest (Jade Figurine)
  246: 'a3q1',
  251: 'a3q2', // Gidbinn Altar
  252: 'a3q2', // Gidbinn
  357: 'a2q4', // Horazon's Journal
  376: 'a4q2', // Hellforge
  392: 'a4q3', // Chaos Sanctuary Seal
  393: 'a4q3',
  394: 'a4q3',
  395: 'a4q3',
  396: 'a4q3',
  404: 'a3q3', // Compelling Orb
  546: 'a5q5', // Ancients' Altar
  473: 'a5q2', // Cage (rescue barbarians)
  558: 'a5q3', // Frozen Anya
})