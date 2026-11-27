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
  /** Canonical 1.13c `D2QuestDataStrc.nQuest` protocol ID (`0x01..0x24`, `D2Client.dll` `0x6fba8188`). */
  readonly protocolId: number
  readonly titleEn: string
}

const ACT_BASE: Readonly<Record<number, number>> = { 1: 1, 2: 9, 3: 17, 4: 25, 5: 35 }
const ACT_PROTOCOL_BASE: Readonly<Record<number, number>> = {
  1: 0x01,
  2: 0x08,
  3: 0x0f,
  4: 0x16,
  5: 0x1f,
}

export const QUEST_INFO_BY_ID_113C: ReadonlyMap<string, QuestFlagInfo113c> = (() => {
  const out = new Map<string, QuestFlagInfo113c>()
  for (const act of [1, 2, 3, 4, 5]) {
    const base = ACT_BASE[act]!
    const protoBase = ACT_PROTOCOL_BASE[act]!
    for (const quest of CANONICAL_QUESTS_BY_ACT[act] ?? []) {
      const m = /^qstsa(\d)q(\d)$/.exec(quest.titleKey)
      if (!m || Number(m[1]) !== act) continue
      const slotOffset = Number(m[2]) - 1
      out.set(quest.id, {
        act,
        wordIndex: base + slotOffset,
        protocolId: protoBase + slotOffset,
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
export const QUEST_FLAG_CUSTOM_3_113C = 0x0008 // QFLAG_CUSTOM0 (bit 3): A2Q6 Tyrael spoken -> "Talk to Jerhyn"; A5Q3 entered Area 112..114 (0x6fc78180)
export const QUEST_FLAG_CUSTOM_4_113C = 0x0010 // QFLAG_CUSTOM1 (bit 4): A2Q6 Jerhyn spoken; A3Q1 Cain showed Golden Bird ('g34'); A5Q3 Frozen Anya (558/527) discovered in session (0x6fc781bd)
export const QUEST_FLAG_CUSTOM_5_113C = 0x0020 // QFLAG_CUSTOM2 (bit 5): A2Q1 ('ass') & A3Q1 ('xyz') consumable reward armed; A4Q1 Izual's Spirit (#406) spoken (0x6fcda768)
export const QUEST_FLAG_CUSTOM_6_113C = 0x0040 // QFLAG_CUSTOM3 (bit 6): A3Q1 Jade Figurine ('j34') picked up (0x6fd07734)
export const QUEST_FLAG_CUSTOM_7_113C = 0x0080 // QFLAG_CUSTOM4 (bit 7): A5Q3 ('tr2') Scroll of Resistance consumed (+10 all resist active)
export const QUEST_FLAG_CUSTOM_8_113C = 0x0100 // QFLAG_CUSTOM5 (bit 8): A5Q3 ('tr2') Scroll of Resistance granted by Malah
export const QUEST_FLAG_CUSTOM_9_113C = 0x0200 // QFLAG_CUSTOM6 (bit 9): NPC secondary reward granted (A1Q2 Kashya merc / A1Q3 Akara ring / A3Q2 Asheara merc / A5Q3 Town Anya rare item 0x6fc7f7cb)
export const QUEST_FLAG_CUSTOM_10_113C = 0x0400 // QFLAG_CUSTOM7 (bit 10): A5Q3 Anya class-specific Rare item granted (0x6fc7f9c7)
export const QUEST_FLAG_PRIMARY_GOAL_DONE_113C = 0x1000
export const QUEST_FLAG_COMPLETED_NOW_113C = 0x2000 // QFLAG_COMPLETEDNOW (bit 13: reward consumed in session)
export const QUEST_FLAG_LEAVE_BEFORE_113C = 0x8000 // QFLAG_LEAVINGGAME / QFLAG_COMPLETEDBEFORE (bit 15)

export function questWordIndex113c(questId: string): number | undefined {
  return QUEST_INFO_BY_ID_113C.get(questId)?.wordIndex
}

/**
 * Returns the 1.13c `D2QuestDataStrc.nQuest` protocol ID (`0x01..0x06`, `0x08..0x0d`,
 * `0x0f..0x14`, `0x16..0x18`, `0x1f..0x24`) encoded in `S2C 0x5D` (`QUESTS_StatusCallback`
 * @ `D2Game.dll` `0x6fc55579`) and matched by `D2Client.dll` `0x6facc890` (`questLogRowIndex`).
 */
export function questProtocolId113c(questId: string): number | undefined {
  return QUEST_INFO_BY_ID_113C.get(questId)?.protocolId
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

export function clearQuestFlag113c(
  quests: Uint16Array,
  questId: string,
  mask: number,
): boolean {
  const idx = questWordIndex113c(questId)
  if (idx === undefined) return false
  const prev = quests[idx] ?? 0
  const next = prev & ~mask
  if (next === prev) return false
  quests[idx] = next
  return true
}

/** Quest-gated areas with the exact 1.13c required bit (STARTED vs COMPLETED). */
export const QUEST_AREA_GATES_113C: Readonly<
  Record<number, { readonly quest: string; readonly mask: number }>
> = Object.freeze({
  38: { quest: 'a1q3', mask: QUEST_FLAG_STARTED_113C }, // Tristram red portal
  46: { quest: 'a2q5', mask: QUEST_FLAG_COMPLETED_113C }, // Canyon of the Magi: Summoner dead
  50: { quest: 'a2q4', mask: QUEST_FLAG_STARTED_113C }, // Harem Level 1: after Tainted Sun + Drognan/Jerhyn (#1961)
  73: { quest: 'a2q2', mask: QUEST_FLAG_COMPLETED_113C }, // Tal Rasha's Chamber: staff used
  74: { quest: 'a2q3', mask: QUEST_FLAG_STARTED_113C }, // Arcane Sanctuary: after Tainted Sun
  100: { quest: 'a3q3', mask: QUEST_FLAG_COMPLETED_113C }, // Durance of Hate 1: Khalim's Will
  101: { quest: 'a3q3', mask: QUEST_FLAG_COMPLETED_113C }, // Durance of Hate 2
  102: { quest: 'a3q3', mask: QUEST_FLAG_COMPLETED_113C }, // Durance of Hate 3
  128: { quest: 'a5q5', mask: QUEST_FLAG_COMPLETED_113C }, // Worldstone Keep 1
  129: { quest: 'a5q5', mask: QUEST_FLAG_COMPLETED_113C }, // Worldstone Keep 2
  130: { quest: 'a5q5', mask: QUEST_FLAG_COMPLETED_113C }, // Worldstone Keep 3
  131: { quest: 'a5q5', mask: QUEST_FLAG_COMPLETED_113C }, // Throne of Destruction
  132: { quest: 'a5q5', mask: QUEST_FLAG_COMPLETED_113C }, // The Worldstone Chamber
})

/** Quest objects that advance a quest when operated (Objects.txt class id). */
export const QUEST_OBJECT_TO_QUEST_113C: Readonly<Record<number, string>> = Object.freeze({
  8: 'a1q4', // The Moldy Tome (TowerTome, OperateFn 6 -> Forgotten Tower, D2Game 0x6fc861b0)
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

/**
 * `D2Game.dll` @ `0x6fd03ce0..0x6fd03df0` (`ACT3Q1_StatusFilter`, questId `0x12`, word 20):
 * resolves the `S2C 0x52` / `0x5D` quest status byte (`0..5, 11, 13`) for `a3q1` (The Golden Bird).
 */
export function computeA3Q1StatusByte113c(
  quests: ArrayLike<number>,
  hasJ34: boolean,
  hasG34: boolean,
): number {
  const idx = questWordIndex113c('a3q1') ?? 20
  const w = (quests[idx] ?? 0) & 0xffff
  if ((w & QUEST_FLAG_REWARD_PENDING_113C) !== 0) return 5
  if ((w & QUEST_FLAG_COMPLETED_113C) !== 0) {
    return (w & QUEST_FLAG_COMPLETED_NOW_113C) !== 0 ? 13 : 11
  }
  if (hasG34) {
    return (w & QUEST_FLAG_CUSTOM_4_113C) !== 0 ? 4 : 3
  }
  if (hasJ34) {
    return (w & QUEST_FLAG_STARTED_113C) !== 0 ? 2 : 1
  }
  if ((w & QUEST_FLAG_CUSTOM_4_113C) !== 0) return 4
  if ((w & QUEST_FLAG_STARTED_113C) !== 0) return 2
  if ((w & QUEST_FLAG_CUSTOM_6_113C) !== 0) return 1
  return 0
}

/**
 * `D2Game.dll` (`ACT2Q6_StatusFilter`, questId `0x0d`, word 14) + `D2Client.dll` `0x6faccf1d`:
 * resolves the `S2C 0x52` / `0x5D` quest status byte (`0..6, 11, 13`) for `a2q6` (The Seven Tombs).
 */
export function computeA2Q6StatusByte113c(
  quests: ArrayLike<number>,
  inDurielsLair = false,
): number {
  const idx = questWordIndex113c('a2q6') ?? 14
  const w = (quests[idx] ?? 0) & 0xffff
  if ((w & QUEST_FLAG_COMPLETED_113C) !== 0) {
    return (w & QUEST_FLAG_COMPLETED_NOW_113C) !== 0 ? 13 : 11
  }
  if ((w & QUEST_FLAG_CUSTOM_4_113C) !== 0) return 6
  if ((w & QUEST_FLAG_CUSTOM_3_113C) !== 0) return 5
  if ((w & QUEST_FLAG_PRIMARY_GOAL_DONE_113C) !== 0) return 3
  if ((w & QUEST_FLAG_STARTED_113C) !== 0) {
    return inDurielsLair ? 2 : 1
  }
  return 0
}

export interface QuestStatusFilterContext113c {
  readonly playerAreaId?: number | undefined
  readonly itemCodes?: ReadonlySet<string> | undefined
  readonly denRemaining?: number | undefined
  readonly barbsRemaining?: number | undefined
}

/**
 * Resolves the 1.13c `S2C 0x52` / `S2C 0x5D` quest status byte (`0..14`) for any of the 27
 * playable quests (`D2Game.dll` `0x6fc53a30` `QUESTS_DefaultStatusFilter` + per-quest
 * `pfnStatusFilter` callbacks invoked by `QUESTS_StatusCallback` `0x6fc554f0` and
 * `QUESTS_SendLogUpdate` `0x6fc55640`).
 */
export function computeQuestStatusByte113c(
  questId: string,
  quests: ArrayLike<number>,
  ctx: QuestStatusFilterContext113c = {},
): number {
  const idx = questWordIndex113c(questId)
  if (idx === undefined) return 0
  const hasCode = (code: string): boolean => ctx.itemCodes?.has(code) === true
  if (questId === 'a3q1') {
    return computeA3Q1StatusByte113c(quests, hasCode('j34'), hasCode('g34'))
  }
  if (questId === 'a2q6') {
    return computeA2Q6StatusByte113c(quests, ctx.playerAreaId === 73)
  }
  const w = (quests[idx] ?? 0) & 0xffff
  const completed = (w & QUEST_FLAG_COMPLETED_113C) !== 0
  const completedNow = (w & QUEST_FLAG_COMPLETED_NOW_113C) !== 0
  const rewardPending = (w & QUEST_FLAG_REWARD_PENDING_113C) !== 0
  const primaryDone = (w & QUEST_FLAG_PRIMARY_GOAL_DONE_113C) !== 0
  const started = (w & QUEST_FLAG_STARTED_113C) !== 0

  if (completed) {
    if (questId === 'a3q2') {
      return completedNow ? 14 : 12
    }
    return completedNow ? 13 : 11
  }

  switch (questId) {
    case 'a1q1': {
      if (rewardPending) return 5
      const den = ctx.denRemaining
      if (started && den !== undefined && den >= 1 && den <= 5) return 4
      if (started) return ctx.playerAreaId === 8 ? 2 : 1
      return 0
    }
    case 'a1q2':
      if (rewardPending) return 3
      return started ? (ctx.playerAreaId === 17 ? 2 : 1) : 0
    case 'a1q5':
      if (rewardPending) return 10
      if (hasCode('hdm')) return 2
      return started ? 1 : 0
    case 'a1q3':
      if (rewardPending) return 10
      if (hasCode('bkd')) return 3
      if (hasCode('bks')) return 2
      return started ? (ctx.playerAreaId === 38 ? 4 : 1) : 0
    case 'a1q4':
      if (started) {
        return ctx.playerAreaId !== undefined && ctx.playerAreaId >= 21 && ctx.playerAreaId <= 25
          ? 2
          : 1
      }
      return 0
    case 'a1q6':
      if (rewardPending || primaryDone) return 3
      return started ? (ctx.playerAreaId === 37 ? 2 : 1) : 0
    case 'a2q1':
      if (rewardPending) return 3
      return started ? (ctx.playerAreaId === 49 ? 2 : 1) : 0
    case 'a2q2':
      if (hasCode('hst')) return 5
      if (hasCode('box') && (hasCode('msf') || hasCode('vip'))) return 3
      return started || hasCode('box') || hasCode('msf') || hasCode('vip') ? 2 : 0
    case 'a2q3':
      if (rewardPending) return 3
      return started ? 2 : 0
    case 'a2q4':
      if (rewardPending) return 5
      return started ? (ctx.playerAreaId === 74 ? 4 : 2) : 0
    case 'a2q5':
      if (rewardPending) return 4
      return started ? 2 : 0
    case 'a3q4':
      if (rewardPending || hasCode('bbb')) return 2
      return started ? 1 : 0
    case 'a3q3':
      if (hasCode('qf2')) return 6
      if (hasCode('qey') && hasCode('qhr') && hasCode('qbr') && hasCode('qf1')) return 5
      return started || hasCode('qey') || hasCode('qhr') || hasCode('qbr') || hasCode('qf1') ? 1 : 0
    case 'a3q2':
      if (rewardPending || hasCode('g33')) return 4
      return started ? 2 : 0
    case 'a3q5':
      if (rewardPending) return 4
      return started ? 3 : 0
    case 'a3q6':
      if (rewardPending || primaryDone) return 4
      return started ? (ctx.playerAreaId === 102 ? 4 : 2) : 0
    case 'a4q1':
      if (rewardPending) {
        return (w & QUEST_FLAG_CUSTOM_5_113C) === 0 && ctx.playerAreaId === 105 ? 3 : 4
      }
      return started ? (ctx.playerAreaId === 105 ? 2 : 1) : 0
    case 'a4q3':
      if (primaryDone) return 2
      return started ? 1 : 0
    case 'a4q2':
      if (rewardPending) return 2
      return started || hasCode('mss') || hasCode('hfh') ? 1 : 0
    case 'a5q1':
      if (rewardPending) return 4
      return started ? 1 : 0
    case 'a5q2': {
      if (rewardPending) return 3
      const barbs = ctx.barbsRemaining
      if (barbs !== undefined && barbs > 0 && barbs < 15) return 2
      return started ? 1 : 0
    }
    case 'a5q3':
      if (rewardPending) {
        return (w & QUEST_FLAG_CUSTOM_8_113C) !== 0 ? 6 : 5
      }
      if (hasCode('ice')) return 4
      if ((w & QUEST_FLAG_CUSTOM_4_113C) !== 0) return 3
      if (started || (w & QUEST_FLAG_CUSTOM_3_113C) !== 0) {
        return ctx.playerAreaId === 114 ? 2 : 1
      }
      return 0
    case 'a5q4':
      if (rewardPending) return 5
      return started ? 1 : 0
    case 'a5q5':
      if (rewardPending) return 3
      return started ? 2 : 0
    case 'a5q6':
      if (rewardPending || primaryDone) return 4
      return started ? (ctx.playerAreaId === 132 ? 3 : 1) : 0
    default:
      return started || rewardPending || primaryDone ? 1 : 0
  }
}

/**
 * Builds the canonical 41-byte `S2C 0x52` (`QUESTS_SendLogUpdate` @ `D2Game.dll` `0x6fc5567c..0x6fc55730`)
 * quest status filter array (`statusBytes[0..40]`) indexed by `wordIndex` / `QUEST_LOG_DESCRIPTORS` row.
 */
export function computeQuestStatusBytes113c(
  quests: ArrayLike<number>,
  ctx: QuestStatusFilterContext113c = {},
): Uint8Array {
  const bytes = new Uint8Array(41)
  for (const [questId, info] of QUEST_INFO_BY_ID_113C.entries()) {
    if (info.wordIndex >= 0 && info.wordIndex < bytes.length) {
      bytes[info.wordIndex] = computeQuestStatusByte113c(questId, quests, ctx) & 0xff
    }
  }
  return bytes
}

/**
 * `D2Game.dll` `.rdata` `0x6FD2F15C..0x6FD2F3BF` & `0x6FC7F987..0x6FC7FA18` (`ACT5Q3` Anya Rare reward):
 * Tier 0 = Normal (`0x6FD2F1CC`), Tier 1 = Exceptional (`0x6FD2F194`, Nightmare `clvl > 45`),
 * Tier 2 = Elite (`0x6FD2F15C`, Hell `clvl > 65`), indexed by `[tier][classId]` (`0..6`: ama, sor, nec, pal, bar, dru, ass).
 */
export const ANYA_CLASS_REWARD_POOLS_113C: readonly (readonly (readonly string[])[])[] = Object.freeze([
  // Tier 0: Normal (0x6FD2F1CC)
  Object.freeze([
    Object.freeze(['am1', 'am2', 'am3', 'am4', 'am5']),
    Object.freeze(['ob1', 'ob2', 'ob3', 'ob4', 'ob5']),
    Object.freeze(['ne1', 'ne2', 'ne3', 'ne4', 'ne5']),
    Object.freeze(['pa1', 'pa2', 'pa3', 'pa4', 'pa5']),
    Object.freeze(['ba1', 'ba2', 'ba3', 'ba4', 'ba5']),
    Object.freeze(['dr1', 'dr2', 'dr3', 'dr4', 'dr5']),
    Object.freeze(['ktr', 'wrb', 'axf', 'ces', 'clw', 'btl', 'skr']),
  ]),
  // Tier 1: Exceptional (0x6FD2F194)
  Object.freeze([
    Object.freeze(['am6', 'am7', 'am8', 'am9', 'ama']),
    Object.freeze(['ob6', 'ob7', 'ob8', 'ob9', 'oba']),
    Object.freeze(['ne6', 'ne7', 'ne8', 'ne9', 'nea']),
    Object.freeze(['pa6', 'pa7', 'pa8', 'pa9', 'paa']),
    Object.freeze(['ba6', 'ba7', 'ba8', 'ba9', 'baa']),
    Object.freeze(['dr6', 'dr7', 'dr8', 'dr9', 'dra']),
    Object.freeze(['9ar', '9wb', '9xf', '9cs', '9lw', '9tw', '9qr']),
  ]),
  // Tier 2: Elite (0x6FD2F15C)
  Object.freeze([
    Object.freeze(['amb', 'amc', 'amd', 'ame', 'amf']),
    Object.freeze(['obb', 'obc', 'obd', 'obe', 'obf']),
    Object.freeze(['neb', 'nec', 'ned', 'nee', 'nef']),
    Object.freeze(['pab', 'pac', 'pad', 'pae', 'paf']),
    Object.freeze(['bab', 'bac', 'bad', 'bae', 'baf']),
    Object.freeze(['drb', 'drc', 'drd', 'dre', 'drf']),
    Object.freeze(['7ar', '7wb', '7xf', '7cs', '7lw', '7tw', '7qr']),
  ]),
])

/**
 * Town vendor `10%` quest discount (`nDiscount = 10`, #1958) unlocked upon completing the
 * corresponding Act town quest:
 * - Act 1 (`147` Gheed, `148` Akara, `154` Charsi): `a1q3` (Search for Cain)
 * - Act 2 (`176` Atma, `177` Drognan, `178` Fara, `199` Elzix, `202` Lysander): `a2q1` (Radament's Lair)
 * - Act 3 (`252` Asheara, `253` Hratli, `254` Alkor, `255` Ormus): `a3q1` / `a3q2` / `a3q4`
 * - Act 4 (`257` Halbu, `405` Jamella): `a4q1` (The Fallen Angel)
 * - Act 5 (`511` Larzuk, `512` Drehya/Anya, `513` Malah, `514` Nihlathak): `a5q3` (Prison of Ice)
 */
export function getVendorQuestDiscountPct113c(
  quests: ArrayLike<number>,
  npcHcIdx: number,
): number {
  const word = (questId: string): number => {
    const idx = questWordIndex113c(questId)
    return idx === undefined ? 0 : (quests[idx] ?? 0) & 0xffff
  }
  switch (npcHcIdx) {
    case 147:
    case 148:
    case 154:
      return (word('a1q3') & QUEST_FLAG_COMPLETED_113C) !== 0 ? 10 : 0
    case 176:
    case 177:
    case 178:
    case 199:
    case 202:
      return (word('a2q1') & (QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C)) !== 0
        ? 10
        : 0
    case 252:
    case 253:
    case 254:
    case 255:
      return ((word('a3q1') | word('a3q2') | word('a3q4')) & QUEST_FLAG_COMPLETED_113C) !== 0
        ? 10
        : 0
    case 257:
    case 405:
      return (word('a4q1') & QUEST_FLAG_COMPLETED_113C) !== 0 ? 10 : 0
    case 511:
    case 512:
    case 513:
    case 514:
      return (word('a5q3') & (QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C)) !== 0
        ? 10
        : 0
    default:
      return 0
  }
}

