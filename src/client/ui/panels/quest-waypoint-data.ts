import type { WorldPanelsHud } from '../world-panels.ts'
import { lookupTbl, type TblLang } from '../../i18n/lang.ts'
import { CANONICAL_LEVEL_LIGHTING } from '../../../common/world/levels-meta.ts'
import {
  CANONICAL_QUEST_TBL_STRINGS,
  CANONICAL_QUESTS_BY_ACT,
  CANONICAL_QUEST_STATE_TABLES,
  type CanonicalQuestItem,
  type CanonicalQuestStage,
} from '../../../common/data/canonical-quest-data.ts'
import { buildQuestLogPage } from '../../world/quest-log-state.ts'

export interface QuestEntry {
  readonly id: string
  readonly act: number
  readonly index: number
  readonly b1: number
  readonly iconKey: string
  readonly titleEn: string
  readonly titleZh: string
  readonly titleKey: string
  readonly status: 'completed' | 'active' | 'locked'
  readonly description: string
  readonly objectiveKey: string
  readonly objectiveEn: string
  readonly objectiveZh: string
  readonly completedKey: string
  readonly completedEn: string
  readonly completedZh: string
  readonly rewardSummaryEn: string
  readonly rewardSummaryZh: string
  readonly stages: readonly CanonicalQuestStage[]
}

export type QuestTblLookup = (key: string) => string | undefined

export interface QuestDisplayText {
  readonly title: string
  readonly titleKey: string
  readonly body: string
  readonly status: 'completed' | 'active' | 'locked'
  readonly statusTag: string
  readonly rewardText: string
}

export interface WaypointEntry {
  readonly act: number
  readonly index: number
  readonly waypointId: number
  readonly levelId: number
  readonly levelNameKey: string
  readonly slug: string
  readonly nameEn: string
  readonly nameZh: string
  readonly unlocked: boolean
}

/**
 * Static quest catalog entries start as `locked`; the live status comes exclusively from the server
 * quest-flag block (`0x29` GameQuestLog / `0x28` QuestInfo) via `WorldPanelsHud.applyServerQuestFlags()`.
 */
export function createQuestEntry(item: CanonicalQuestItem): QuestEntry {
  return {
    ...item,
    status: 'locked',
    description: `${item.objectiveZh} (目标: ${item.rewardSummaryZh})`,
  }
}

/**
 * First quest-flag word of each act inside the 1.13c 48-word (96-byte) quest record sent by `0x29`
 * (same layout as the `.d2s` "Woo!" quest block): word 0 = Act I intro, 1..6 = Act I quests,
 * 7/8 = Act II travel/intro, 9..14 = Act II, 15/16, 17..22 = Act III, 23/24, 25..27 = Act IV, 35..40 = Act V.
 */
const QUEST_FLAG_ACT_BASE: Readonly<Record<number, number>> = { 1: 1, 2: 9, 3: 17, 4: 25, 5: 35 }

/**
 * Quest-flag word index for a canonical quest. The internal quest number is the `qstsa<act>q<n>` string key
 * (e.g. "The Search for Cain" = `qstsa1q4` -> word 4, "Terror's End" = `qstsa4q2` -> word 26).
 */
export function questFlagWordIndex(quest: Pick<CanonicalQuestItem, 'act' | 'titleKey' | 'id'>): number {
  const m = /^qstsa(\d)q(\d)$/.exec(quest.titleKey)
  const base = QUEST_FLAG_ACT_BASE[quest.act]
  if (!m || base === undefined || Number(m[1]) !== quest.act) {
    throw new Error(`questFlagWordIndex: cannot map quest '${quest.id}' (titleKey '${quest.titleKey}')`)
  }
  return base + Number(m[2]) - 1
}

/** Bit 0 of a quest-flag word = quest completed (reward granted). */
export const QUEST_FLAG_COMPLETED = 0x0001

export const ACT_QUESTS: Readonly<Record<number, readonly QuestEntry[]>> = {
  1: CANONICAL_QUESTS_BY_ACT[1]!.map(createQuestEntry),
  2: CANONICAL_QUESTS_BY_ACT[2]!.map(createQuestEntry),
  3: CANONICAL_QUESTS_BY_ACT[3]!.map(createQuestEntry),
  4: CANONICAL_QUESTS_BY_ACT[4]!.map(createQuestEntry),
  5: CANONICAL_QUESTS_BY_ACT[5]!.map(createQuestEntry),
}

export function getActQuests(act: number): readonly QuestEntry[] {
  const quests = ACT_QUESTS[act]
  if (!quests) {
    throw new Error(`Invalid quest act index: ${act} (expected 1..5)`)
  }
  return quests
}

/** Flat list of all 27 canonical Diablo II quests across Acts 1..5. */
export const ALL_QUESTS: readonly QuestEntry[] = [
  ...ACT_QUESTS[1]!,
  ...ACT_QUESTS[2]!,
  ...ACT_QUESTS[3]!,
  ...ACT_QUESTS[4]!,
  ...ACT_QUESTS[5]!,
]

/**
 * Canonical 1.13c Traditional Chinese `.tbl` level-name entries (`expansionstring.tbl` / `string.tbl`)
 * for the 10 waypoint `LevelName` keys not yet packed in `CANONICAL_CHI_TBL_DICT`.
 */
export const CANONICAL_WAYPOINT_CHI_TBL_SUPPLEMENT: Readonly<Record<string, string>> = {
  'Palace Cellar Level 1': '皇宮監牢第一層',
  Harrogath: '哈洛加斯',
  'Rigid Highlands': '冰凍高地',
  'Arreat Plateau': '亞瑞特高原',
  'Crystalized Cavern Level 1': '水晶通道',
  'Crystalized Cavern Level 2': '冰河路徑',
  "Halls of Death's Calling": '痛苦之廳',
  'Tundra Wastelands': '冰凍苔原',
  'Glacial Caves Level 1': '遠古之路',
  'The Worldstone Keep Level 2': '世界之石要塞第二層',
}

export const CANONICAL_WAYPOINT_ENG_TBL_SUPPLEMENT: Readonly<Record<string, string>> = {
  'Palace Cellar Level 1': 'Palace Cellar Level 1',
}

/**
 * D2Client.dll `0x6fb196d4` (`WAYPOINT_Draw`):
 * Resolves waypoint display name via `D2Common_10014(levelId)` (`Levels.txt` `LevelName` key) -> `D2Lang_10004` (`.tbl`).
 */
export function resolveWaypointName(levelId: number, lang: TblLang = 'ENG'): string {
  const meta = CANONICAL_LEVEL_LIGHTING[levelId]
  if (!meta || !meta.levelName) {
    throw new Error(`resolveWaypointName: missing Levels.txt LevelName for levelId=${levelId}`)
  }
  const key = meta.levelName
  if (lang === 'CHI') {
    const chi = lookupTbl(key, 'CHI') ?? CANONICAL_WAYPOINT_CHI_TBL_SUPPLEMENT[key]
    if (!chi) {
      throw new Error(`resolveWaypointName: missing CHI .tbl entry for LevelName '${key}' (levelId=${levelId})`)
    }
    return chi
  }
  const eng = lookupTbl(key, 'ENG') ?? CANONICAL_WAYPOINT_ENG_TBL_SUPPLEMENT[key]
  if (!eng) {
    throw new Error(`resolveWaypointName: missing ENG .tbl entry for LevelName '${key}' (levelId=${levelId})`)
  }
  return eng
}
export function createWaypointEntry(
  act: number,
  index: number,
  waypointId: number,
  levelId: number,
  slug: string,
): WaypointEntry {
  const meta = CANONICAL_LEVEL_LIGHTING[levelId]
  if (!meta || !meta.levelName) {
    throw new Error(`createWaypointEntry: missing Levels.txt LevelName for levelId=${levelId}`)
  }
  return {
    act,
    index,
    waypointId,
    levelId,
    levelNameKey: meta.levelName,
    slug,
    nameEn: resolveWaypointName(levelId, 'ENG'),
    nameZh: resolveWaypointName(levelId, 'CHI'),
    unlocked: false,
  }
}

export const ACT_WAYPOINTS: Readonly<Record<number, readonly WaypointEntry[]>> = {
  1: [
    createWaypointEntry(1, 0, 0, 1, 'rogue-encampment'),
    createWaypointEntry(1, 1, 1, 3, 'cold-plains'),
    createWaypointEntry(1, 2, 2, 4, 'stony-field'),
    createWaypointEntry(1, 3, 3, 5, 'dark-wood'),
    createWaypointEntry(1, 4, 4, 6, 'black-marsh'),
    createWaypointEntry(1, 5, 5, 27, 'outer-cloister'),
    createWaypointEntry(1, 6, 6, 29, 'jail-level-1'),
    createWaypointEntry(1, 7, 7, 32, 'inner-cloister'),
    createWaypointEntry(1, 8, 8, 35, 'catacombs-level-2'),
  ],
  2: [
    createWaypointEntry(2, 0, 9, 40, 'lut-gholein'),
    createWaypointEntry(2, 1, 10, 48, 'sewers-level-2'),
    createWaypointEntry(2, 2, 11, 42, 'dry-hills'),
    createWaypointEntry(2, 3, 12, 57, 'halls-of-the-dead-level-2'),
    createWaypointEntry(2, 4, 13, 43, 'far-oasis'),
    createWaypointEntry(2, 5, 14, 44, 'lost-city'),
    createWaypointEntry(2, 6, 15, 52, 'palace-cellar-level-1'),
    createWaypointEntry(2, 7, 16, 74, 'arcane-sanctuary'),
    createWaypointEntry(2, 8, 17, 46, 'canyon-of-the-magi'),
  ],
  3: [
    createWaypointEntry(3, 0, 18, 75, 'kurast-docks'),
    createWaypointEntry(3, 1, 19, 76, 'spider-forest'),
    createWaypointEntry(3, 2, 20, 77, 'great-marsh'),
    createWaypointEntry(3, 3, 21, 78, 'flayer-jungle'),
    createWaypointEntry(3, 4, 22, 79, 'lower-kurast'),
    createWaypointEntry(3, 5, 23, 80, 'kurast-bazaar'),
    createWaypointEntry(3, 6, 24, 81, 'upper-kurast'),
    createWaypointEntry(3, 7, 25, 83, 'travincal'),
    createWaypointEntry(3, 8, 26, 101, 'durance-of-hate-level-2'),
  ],
  4: [
    createWaypointEntry(4, 0, 27, 103, 'the-pandemonium-fortress'),
    createWaypointEntry(4, 1, 28, 106, 'city-of-the-damned'),
    createWaypointEntry(4, 2, 29, 107, 'river-of-flame'),
  ],
  5: [
    createWaypointEntry(5, 0, 30, 109, 'harrogath'),
    createWaypointEntry(5, 1, 31, 111, 'frigid-highlands'),
    createWaypointEntry(5, 2, 32, 112, 'arreat-plateau'),
    createWaypointEntry(5, 3, 33, 113, 'crystalline-passage'),
    createWaypointEntry(5, 4, 34, 115, 'glacial-trail'),
    createWaypointEntry(5, 5, 35, 123, 'halls-of-pain'),
    createWaypointEntry(5, 6, 36, 117, 'frozen-tundra'),
    createWaypointEntry(5, 7, 37, 118, 'the-ancients-way'),
    createWaypointEntry(5, 8, 38, 129, 'the-worldstone-keep-level-2'),
  ],
}

export function getActWaypoints(act: number): readonly WaypointEntry[] {
  const waypoints = ACT_WAYPOINTS[act]
  if (!waypoints) {
    throw new Error(`Invalid waypoint act index: ${act} (expected 1..5)`)
  }
  return waypoints
}

/** Authentic D2Client.dll 1.13c waypoint row Y offsets table at VA 0x6fb8e6d8. */
export const WAYPOINT_ROW_OFFSETS_Y: readonly number[] = [60, 96, 132, 168, 205, 241, 277, 313, 349] as const

/** Authentic D2Client.dll 1.13c waypoint text baseline Y offsets table at VA 0x6fb8e6fc. */
export const WAYPOINT_TEXT_OFFSETS_Y: readonly number[] = [84, 119, 154, 189, 224, 259, 294, 329, 364] as const

export function getWaypointRowOffsetY(index: number): number {
  const rowY = WAYPOINT_ROW_OFFSETS_Y[index]
  if (rowY === undefined) {
    throw new Error(`Invalid waypoint row index: ${index} (expected 0..${WAYPOINT_ROW_OFFSETS_Y.length - 1})`)
  }
  return rowY
}

export function getWaypointTextOffsetY(index: number): number {
  const textY = WAYPOINT_TEXT_OFFSETS_Y[index]
  if (textY === undefined) {
    throw new Error(`Invalid waypoint text row index: ${index} (expected 0..${WAYPOINT_TEXT_OFFSETS_Y.length - 1})`)
  }
  return textY
}
/**
 * Replace every quest status from the server quest-flag words (`ClientWorld.quests`):
 * bit 0 set = completed, any other bit set = active (started), 0 = locked (not started).
 */
export function applyServerQuestFlagsImpl(this: WorldPanelsHud, flags: ArrayLike<number>): void {
  this.hasServerQuestState = false
  this.serverQuestFlags = Array.from(flags)
  this.serverGameQuestFlags = []
  this.serverQuestStatusBytes = []
  this.questStatuses.clear()
  for (const quest of ALL_QUESTS) {
    const word = flags[questFlagWordIndex(quest)] ?? 0
    this.questStatuses.set(
      quest.id,
      (word & QUEST_FLAG_COMPLETED) !== 0 ? 'completed' : word !== 0 ? 'active' : 'locked',
    )
  }
}
/**
 * Apply full 1.13c server quest state (`0x28` player quest flags, `0x29` game quest flags,
 * `0x52` 41-byte quest history status bytes, and `0x50` / `0x5D` Den of Evil & Mount Arreat counters)
 * per `D2Client.dll` `0x6facce00..0x6facd6dc` and `0x6fba8188`.
 */
export function applyServerQuestStateImpl(this: WorldPanelsHud, state: {
  quests: ArrayLike<number>
  gameQuests?: ArrayLike<number>
  questStatusBytes?: ArrayLike<number>
  denMonstersRemaining?: number
  questBarbsRemaining?: number
  questSoldiersRemaining?: number
  tombOffset?: number | null | undefined
}): void {
  this.hasServerQuestState = true
  this.serverQuestFlags = Array.from(state.quests)
  this.serverGameQuestFlags = state.gameQuests ? Array.from(state.gameQuests) : []
  this.serverQuestStatusBytes = state.questStatusBytes ? Array.from(state.questStatusBytes) : []
  this.denMonstersRemaining = state.denMonstersRemaining ?? 0
  this.questBarbsRemaining = state.questBarbsRemaining ?? state.questSoldiersRemaining ?? 0
  if (state.tombOffset !== undefined) {
    this.tombOffset = state.tombOffset
  }
  this.questStatuses.clear()
  for (const quest of ALL_QUESTS) {
    const bitIdx = questFlagWordIndex(quest)
    const qFlags = this.serverQuestFlags[bitIdx] ?? 0
    const gFlags = this.serverGameQuestFlags[bitIdx] ?? 0
    const statusByte = this.serverQuestStatusBytes[bitIdx] ?? 0
    const stateTable = CANONICAL_QUEST_STATE_TABLES[bitIdx]
    const slotEntry = stateTable?.[statusByte]
    const page = buildQuestLogPage({
      row: bitIdx,
      playerWords: this.serverQuestFlags,
      gameWords: this.serverGameQuestFlags,
      status: statusByte,
      den: this.denMonstersRemaining,
      barbs: this.questBarbsRemaining,
    })
    let status: 'completed' | 'active' | 'locked' = 'locked'
    if (
      (qFlags & QUEST_FLAG_COMPLETED) !== 0 ||
      slotEntry?.text === 'qstsComplete' ||
      slotEntry?.text === 'qstsprevious'
    ) {
      status = 'completed'
    } else if (
      page !== null ||
      (statusByte >= 1 && statusByte <= 15 && slotEntry && slotEntry.text !== 'qstsnull') ||
      (qFlags & ~0x8000) !== 0 ||
      (gFlags & 0x2000) !== 0
    ) {
      status = 'active'
    }
    this.questStatuses.set(quest.id, status)
  }
}
export function lookupQuestStringImpl(this: WorldPanelsHud, key: string, lang: TblLang = this.lang): string | undefined {
  if (this.questTblLookup) {
    const val = this.questTblLookup(key)
    if (val !== undefined && val.trim().length > 0) return val.trim()
  }
  if (this.questStringTableChain) {
    const val = this.questStringTableChain.get(key)
    if (val !== undefined && val.trim().length > 0) return val.trim()
  }
  const fromTbl = lookupTbl(key, lang)
  if (fromTbl !== undefined && fromTbl.trim().length > 0) return fromTbl.trim()
  return undefined
}
export function resolveCanonicalQuestStateTextImpl(this: WorldPanelsHud, key: string, lang: TblLang = this.lang): string {
  const custom = this.lookupQuestString(key, lang)
  if (custom !== undefined) return custom
  const entry = CANONICAL_QUEST_TBL_STRINGS[key]
  if (entry) {
    const raw = lang === 'ENG' ? entry.en : (entry.zh || entry.en)
    return raw.replace(/^\d+\r?\n/, '').trim()
  }
  return key
}
/**
 * Look up the raw (untrimmed) TBL string for `appendCount` (`0x6facd2b6..0x6facd39a`:
 * e.g. `qstsa1q14` -> `"Monsters remaining: "` / `"剩下的怪物： "`, `qstsa1q13` -> `""`).
 */
export function resolveRawQuestStatePrefixImpl(this: WorldPanelsHud, key: string, lang: TblLang = this.lang): string {
  if (this.questTblLookup) {
    const val = this.questTblLookup(key)
    if (val !== undefined) return val
  }
  if (this.questStringTableChain) {
    const val = this.questStringTableChain.get(key)
    if (val !== undefined) return val
  }
  const fromTbl = lookupTbl(key, lang)
  if (fromTbl !== undefined) return fromTbl
  const entry = CANONICAL_QUEST_TBL_STRINGS[key]
  if (entry) {
    return lang === 'ENG' ? entry.en : (entry.zh ?? entry.en)
  }
  return key
}
/**
 * Resolve the NPC speech string key (`wSpeechStr`, `[esi+0x25f]`) for the currently selected quest
 * per `D2Client.dll` `0x6facce00..0x6facd6dc` and `0x6fba8188`.
 */
export function getQuestSpeechKeyImpl(this: WorldPanelsHud, quest: QuestEntry): string | null {
  const status = this.getQuestStatus(quest)
  if (status === 'locked') return null
  const bitIdx = questFlagWordIndex(quest)
  if (this.hasServerQuestState) {
    const page = buildQuestLogPage({
      row: bitIdx,
      playerWords: this.serverQuestFlags,
      gameWords: this.serverGameQuestFlags,
      status: this.serverQuestStatusBytes[bitIdx] ?? 0,
      den: this.denMonstersRemaining,
      barbs: this.questBarbsRemaining,
    })
    return page?.speechKey ?? null
  }
  const stateTable = CANONICAL_QUEST_STATE_TABLES[bitIdx]
  const statusByte = this.serverQuestStatusBytes[bitIdx] ?? 0
  if (status === 'completed') {
    const s0Text = stateTable?.[0]?.text
    if (s0Text && s0Text !== 'qstsnull' && s0Text !== 'NONE') return s0Text
    const s11Speech = stateTable?.[11]?.speech
    if (s11Speech && s11Speech !== 'qstsnull' && s11Speech !== 'NONE') return s11Speech
    return quest.completedKey || null
  }
  if (statusByte >= 1 && statusByte <= 14 && stateTable) {
    const nextSpeech = stateTable[statusByte + 1]?.speech
    if (nextSpeech && nextSpeech !== 'qstsnull' && nextSpeech !== 'NONE') {
      return nextSpeech
    }
    const curSpeech = stateTable[statusByte]?.speech
    if (curSpeech && curSpeech !== 'qstsnull' && curSpeech !== 'NONE') {
      return curSpeech
    }
  }
  return null
}
export function getQuestDisplayTextImpl(this: WorldPanelsHud, quest: QuestEntry, lang: TblLang = this.lang): QuestDisplayText {
  const status = this.getQuestStatus(quest)
  const isEn = lang === 'ENG'
  const statusTag = isEn
    ? status === 'completed'
      ? '[Completed]'
      : status === 'active'
        ? '[Active]'
        : '[Locked]'
    : status === 'completed'
      ? '[已完成]'
      : status === 'active'
        ? '[进行中]'
        : '[未开启]'

  const title = isEn
    ? quest.titleEn || this.lookupQuestString(quest.titleKey, lang) || quest.titleZh
    : this.lookupQuestString(quest.titleKey, lang) ?? quest.titleZh ?? quest.titleEn
  let body = ''
  const rewardText = isEn
    ? quest.rewardSummaryEn || quest.rewardSummaryZh
    : quest.rewardSummaryZh || quest.rewardSummaryEn

  if (this.hasServerQuestState) {
    const bitIdx = questFlagWordIndex(quest)
    const page = buildQuestLogPage({
      row: bitIdx,
      playerWords: this.serverQuestFlags,
      gameWords: this.serverGameQuestFlags,
      status: this.serverQuestStatusBytes[bitIdx] ?? 0,
      den: this.denMonstersRemaining,
      barbs: this.questBarbsRemaining,
    })
    if (!page) {
      body = ''
    } else if (page.text.kind === 'appendCount') {
      const prefix = page.text.key ? this.resolveRawQuestStatePrefix(page.text.key, lang) : ''
      body = `${prefix}${page.text.count}`
    } else if (page.text.kind === 'printfCount') {
      body = this.resolveCanonicalQuestStateText(page.text.key, lang).replace('%d', String(page.text.count))
    } else {
      body = this.resolveCanonicalQuestStateText(page.text.key, lang)
    }

    return {
      title,
      titleKey: quest.titleKey,
      body,
      status,
      statusTag,
      rewardText,
    }
  }

  if (status === 'completed') {
    const tblCompleted = this.lookupQuestString(quest.completedKey, lang)
    body = isEn
      ? quest.completedEn || tblCompleted || quest.completedZh || quest.description
      : tblCompleted || quest.completedZh || quest.completedEn || quest.description
  } else if (status === 'active') {
    let stageText: string | undefined
    if (this.serverQuestFlags.length > 0) {
      const word = this.serverQuestFlags[questFlagWordIndex(quest)] ?? 0
      if (quest.stages && quest.stages.length > 0) {
        for (let i = quest.stages.length - 1; i >= 0; i--) {
          const st = quest.stages[i]!
          if ((word & (1 << st.stage)) !== 0) {
            const tblStage = this.lookupQuestString(st.key, lang)
            stageText = isEn ? (tblStage || st.textEn) : (tblStage || st.textZh || st.textEn)
            break
          }
        }
      }
    }
    if (!stageText) {
      const tblObjective = this.lookupQuestString(quest.objectiveKey, lang)
      stageText = isEn
        ? quest.objectiveEn || tblObjective || quest.objectiveZh || quest.description
        : tblObjective || quest.objectiveZh || quest.objectiveEn || quest.description
    }
    body = stageText
  } else {
    body = isEn
      ? 'This quest has not begun yet. Speak to townsfolk or explore the wilderness to begin.'
      : '此任务尚未开启。与城镇居民对话或探索荒野以开启任务。'
  }

  return {
    title,
    titleKey: quest.titleKey,
    body,
    status,
    statusTag,
    rewardText,
  }
}
export function isWaypointUnlockedImpl(this: WorldPanelsHud, wpOrId: WaypointEntry | number): boolean {
  const wpId = typeof wpOrId === 'number' ? wpOrId : wpOrId.waypointId
  const override = this.waypointUnlockedOverrides.get(wpId)
  if (override !== undefined) return override
  if (typeof wpOrId === 'object' && wpOrId !== null) return wpOrId.unlocked
  for (const list of Object.values(ACT_WAYPOINTS)) {
    const found = list.find(w => w.waypointId === wpId)
    if (found) return found.unlocked
  }
  return false
}
export function setUnlockedWaypointsImpl(this: WorldPanelsHud, unlockedWaypointIds: Iterable<number>): void {
  this.waypointUnlockedOverrides.clear()
  const set = new Set(unlockedWaypointIds)
  for (const list of Object.values(ACT_WAYPOINTS)) {
    for (const wp of list) {
      this.waypointUnlockedOverrides.set(wp.waypointId, set.has(wp.waypointId))
    }
  }
}
