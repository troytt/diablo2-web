import { describe, expect, it } from 'vitest'
import {
  readSuperUniques,
  CANONICAL_SUPERUNIQUES_TABLE,
  CANONICAL_SUPER_UNIQUE_LANDMARKS,
  CANONICAL_SUPER_UNIQUES_BY_LEVEL,
  buildSuperUniqueLandmarkSpecs,
  monsterDisplayName,
} from '../src/common/units/monsters-data.ts'
import {
  RAW_SUPERUNIQUES,
} from '../src/common/data/canonical-drop-data.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { parseTable } from '../src/common/world/acts.ts'
import {
  CANONICAL_QUEST_DATA,
  CANONICAL_QUEST_BY_ID,
  CANONICAL_QUEST_STATE_TABLES,
  CANONICAL_QUEST_TBL_STRINGS,
} from '../src/common/data/canonical-quest-data.ts'
import {
  CANONICAL_NPC_MSG_ID_TO_TBL_KEY,
  resolveQuestTitleKeyForMsgId,
  resolveNpcIntroMsgIdByTblKey,
} from '../src/common/data/canonical-npc-dialog-table.ts'
import {
  getTownNpcDescriptorByName,
  getTownNpcDescriptorByHcIdx,
  resolveNpcDialogueTblText,
} from '../src/common/units/npc-table.ts'
import { CANONICAL_113C_OBJECTS } from '../src/common/world/objects-meta.ts'
import { OBJECTS_TXT_113C } from '../src/common/world/objects-txt-113c.ts'
import { CANONICAL_QUEST_ITEM_CODES } from '../src/common/items/ground-items.ts'
import { QuestLogState, buildQuestLogPage } from '../src/client/world/quest-log-state.ts'

describe('Act 5 Quests Completeness & 1.13c Ground Truth Audit (A5Q1 - A5Q6)', () => {
  it('1. A5Q1..A5Q6 SuperUnique bosses match 1.13c SuperUniques.txt & MonStats.txt and all TCs exist in TreasureClassEx.txt', () => {
    const dt = getEmbeddedDropTables()
    const landmarkMap = new Map(CANONICAL_SUPER_UNIQUE_LANDMARKS.map(l => [l.id, l]))

    // A5Q1: Shenk the Overseer (Siege Boss) & Dac Farren on Level 110 (Bloody Foothills)
    expect(landmarkMap.get('Shenk the Overseer')).toEqual({
      id: 'Shenk the Overseer',
      levelIds: [110],
      landmark: 'Act 5 - Barricade Building',
      minionMonsterId: 'minion1',
    })
    expect(landmarkMap.get('Dac Farren')).toEqual({
      id: 'Dac Farren',
      levelIds: [110],
      landmark: 'Act 5 - Barricade Prison 1',
      minionMonsterId: 'imp3',
    })

    // A5Q2: Frigid Highlands (111) & Arreat Plateau (112)
    expect(landmarkMap.get('Eldritch the Rectifier')?.minionMonsterId).toBe('minion1')
    expect(landmarkMap.get('Sharptooth Slayer')?.minionMonsterId).toBe('minion3')
    expect(landmarkMap.get('Eyeback the Unleashed')?.minionMonsterId).toBe('deathmauler1')
    expect(landmarkMap.get('Thresh Socket')?.minionMonsterId).toBe('imp3')

    // A5Q3: Frozen River (114), Glacial Trail (115), Icy Cellar (119)
    expect(landmarkMap.get('Frozenstein')?.minionMonsterId).toBe('snowyeti4')
    expect(landmarkMap.get('Bonesaw Breaker')?.minionMonsterId).toBe('reanimatedhorde2')
    expect(landmarkMap.get('Snapchip Shatter')?.minionMonsterId).toBe('frozenhorror1')

    // A5Q4: Nihlathak's Temple (121) & Halls of Vaught (124)
    expect(landmarkMap.get('Pindleskin')?.minionMonsterId).toBe('reanimatedhorde5')
    expect(landmarkMap.get('Nihlathak')?.minionMonsterId).toBe('minion6')

    // A5Q5: Arreat Summit (120) Ancients
    expect(landmarkMap.get('Talic')?.minionMonsterId).toBe('ancientbarb1')
    expect(landmarkMap.get('Madawc')?.minionMonsterId).toBe('ancientbarb2')
    expect(landmarkMap.get('Korlic')?.minionMonsterId).toBe('ancientbarb3')

    // A5Q6: Throne of Destruction (131) Baal Waves 1..5
    expect(landmarkMap.get('Colenzo the Annihilator')?.minionMonsterId).toBe('fallen5')
    expect(landmarkMap.get('Achmel the Cursed')?.minionMonsterId).toBe('unraveler5')
    expect(landmarkMap.get('Bartuc the Bloody')?.minionMonsterId).toBe('baalhighpriest')
    expect(landmarkMap.get('Ventar the Unholy')?.minionMonsterId).toBe('venomlord')
    expect(landmarkMap.get('Lister the Tormentor')?.minionMonsterId).toBe('baalminion1')

    for (const diff of ['normal', 'nightmare', 'hell'] as const) {
      const parsed = readSuperUniques(CANONICAL_SUPERUNIQUES_TABLE, diff)
      const map = new Map(parsed.map(p => [p.id, p]))

      const shenk = map.get('Shenk the Overseer')!
      expect(shenk.monsterId).toBe('overseer1')
      expect(shenk.modifiers).toEqual([5])
      expect(shenk.minMinions).toBe(0)
      expect(shenk.maxMinions).toBe(0)
      expect(shenk.treasureClass).toBe(
        diff === 'normal' ? 'Act 5 Super A' : diff === 'nightmare' ? 'Act 5 (N) Super A' : 'Act 5 (H) Super A',
      )
      expect(dt.tcTable.get(shenk.treasureClass)).toBeDefined()

      const eyeback = map.get('Eyeback the Unleashed')!
      expect(eyeback.monsterId).toBe('deathmauler1')
      expect(eyeback.modifiers).toEqual([5, 6])
      expect(eyeback.minMinions).toBe(2)
      expect(eyeback.maxMinions).toBe(2)
      expect(dt.tcTable.get(eyeback.treasureClass)).toBeDefined()

      const thresh = map.get('Thresh Socket')!
      expect(thresh.monsterId).toBe('siegebeast3')
      expect(thresh.modifiers).toEqual([7])
      expect(thresh.minMinions).toBe(0)
      expect(thresh.maxMinions).toBe(0)
      expect(thresh.treasureClass).toBe(
        diff === 'normal' ? 'Act 5 Super Cx' : diff === 'nightmare' ? 'Act 5 (N) Super Cx' : 'Act 5 (H) Super Cx',
      )
      expect(dt.tcTable.get(thresh.treasureClass)).toBeDefined()

      const frozenstein = map.get('Frozenstein')!
      expect(frozenstein.monsterId).toBe('snowyeti4')
      expect(frozenstein.minMinions).toBe(5)
      expect(frozenstein.maxMinions).toBe(6)
      expect(frozenstein.treasureClass).toBe(
        diff === 'normal' ? 'Act 5 Super C' : diff === 'nightmare' ? 'Act 5 (N) Super C' : 'Act 5 (H) Super C',
      )
      expect(dt.tcTable.get(frozenstein.treasureClass)).toBeDefined()

      const pindleskin = map.get('Pindleskin')!
      expect(pindleskin.monsterId).toBe('reanimatedhorde5')
      expect(pindleskin.minMinions).toBe(6)
      expect(pindleskin.maxMinions).toBe(6)
      expect(dt.tcTable.get(pindleskin.treasureClass)).toBeDefined()

      const nihlathak = map.get('Nihlathak')!
      expect(nihlathak.monsterId).toBe('nihlathakboss')
      expect(dt.tcTable.get(nihlathak.treasureClass)).toBeDefined()

      const lister = map.get('Lister the Tormentor')!
      expect(lister.monsterId).toBe('baalminion1')
      expect(lister.minMinions).toBe(5)
      expect(lister.maxMinions).toBe(5)
      expect(dt.tcTable.get(lister.treasureClass)).toBeDefined()
    }

    // Verify raw SuperUniques.txt alias resolution (Siege Boss, Megaflow Rectifier, Sharp Tooth Sayer, Threash Socket, Ancient Barbarian 1..3, Baal Subject 1..5)
    const rawTable = parseTable(new TextEncoder().encode(RAW_SUPERUNIQUES.trim()))
    const rawByLevel = buildSuperUniqueLandmarkSpecs(rawTable, 'normal')
    const lvl110 = rawByLevel[110] as readonly { id: string; monsterId: string }[]
    expect(Array.isArray(lvl110)).toBe(true)
    expect(lvl110.map(s => s.monsterId)).toEqual(['imp3', 'overseer1'])
    const lvl120 = rawByLevel[120] as readonly { id: string; monsterId: string }[]
    expect(lvl120.map(s => s.monsterId)).toEqual(['ancientbarb1', 'ancientbarb2', 'ancientbarb3'])
    const lvl131 = rawByLevel[131] as readonly { id: string; monsterId: string }[]
    expect(lvl131.map(s => s.monsterId)).toEqual([
      'fallenshaman5',
      'unraveler5',
      'baalhighpriest',
      'venomlord',
      'baalminion1',
    ])
    expect(CANONICAL_SUPER_UNIQUES_BY_LEVEL[120]).toBeDefined()
    expect(CANONICAL_SUPER_UNIQUES_BY_LEVEL[131]).toBeDefined()
  })

  it('2. Act 5 SuperUnique display names resolve in both ENG and CHI via .tbl and SUPERUNIQUE_TBL_ALIASES', () => {
    expect(monsterDisplayName('Shenk the Overseer', 'ENG')).toBe('Shenk the Overseer')
    expect(monsterDisplayName('Shenk the Overseer', 'CHI')).toMatch(/督[軍军]山克/)
    expect(monsterDisplayName('Eldritch the Rectifier', 'ENG')).toBe('Eldritch the Rectifier')
    expect(monsterDisplayName('Sharptooth Slayer', 'ENG')).toBe('Sharptooth Slayer')
    expect(monsterDisplayName('Thresh Socket', 'ENG')).toBe('Thresh Socket')
    expect(monsterDisplayName('Talic', 'CHI')).toBe('塔力克')
    expect(monsterDisplayName('Madawc', 'CHI')).toBe('马道克')
    expect(monsterDisplayName('Korlic', 'CHI')).toBe('科力克')
    expect(monsterDisplayName('Colenzo the Annihilator', 'ENG')).toBe('Colenzo the Annihilator')
    expect(monsterDisplayName('Lister the Tormentor', 'ENG')).toBe('Lister the Tormentor')
  })

  it('3. CANONICAL_QUEST_DATA, CANONICAL_QUEST_STATE_TABLES (35..40), and CANONICAL_QUEST_TBL_STRINGS have complete Act 5 stages and 105 speech keys', () => {
    const act5Quests = CANONICAL_QUEST_DATA.filter(q => q.act === 5)
    expect(act5Quests.map(q => q.id)).toEqual(['a5q1', 'a5q2', 'a5q3', 'a5q4', 'a5q5', 'a5q6'])

    for (const q of act5Quests) {
      expect(CANONICAL_QUEST_BY_ID[q.id]).toBe(q)
      expect(q.titleEn.length).toBeGreaterThan(0)
      expect(q.titleZh.length).toBeGreaterThan(0)
      expect(q.completedEn.length).toBeGreaterThan(0)
      expect(q.completedZh.length).toBeGreaterThan(0)
      expect(CANONICAL_QUEST_TBL_STRINGS[q.completedKey]).toBeDefined()

      for (const stage of q.stages) {
        expect(stage.textEn.length, `${q.id} stage ${stage.key} textEn`).toBeGreaterThan(0)
        expect(stage.textZh.length, `${q.id} stage ${stage.key} textZh`).toBeGreaterThan(0)
        const tblEntry = CANONICAL_QUEST_TBL_STRINGS[stage.key]
        expect(tblEntry, `Missing ${stage.key} in CANONICAL_QUEST_TBL_STRINGS`).toBeDefined()
        expect(tblEntry!.en.length).toBeGreaterThan(0)
        expect(tblEntry!.zh.length).toBeGreaterThan(0)
      }
    }

    // Verify Ral, Ort, Tal rune names for A5Q2 stage qstsa5q24
    expect(CANONICAL_QUEST_TBL_STRINGS.Ral).toEqual({ zh: '拉爾', en: 'Ral' })
    expect(CANONICAL_QUEST_TBL_STRINGS.Ort).toEqual({ zh: '歐特', en: 'Ort' })
    expect(CANONICAL_QUEST_TBL_STRINGS.Tal).toEqual({ zh: '塔爾', en: 'Tal' })
    expect(CANONICAL_QUEST_TBL_STRINGS.qstsa5q61?.zh).toBe('向遠古野蠻人請教。')
    expect(CANONICAL_QUEST_TBL_STRINGS.qstsa5q62a?.zh).toBe('在巴爾腐化世界之石大殿之前殺死他。')

    // Verify all 105 Act 5 quest speech keys exist in CANONICAL_QUEST_TBL_STRINGS
    for (let msgId = 20077; msgId <= 20180; msgId++) {
      const key = CANONICAL_NPC_MSG_ID_TO_TBL_KEY[msgId]!
      expect(key).toBeTruthy()
      expect(resolveQuestTitleKeyForMsgId(msgId)).toMatch(/^qstsa5q[1-6]$/)
      const entry = CANONICAL_QUEST_TBL_STRINGS[key]
      expect(entry, `Missing Act 5 speech key ${key} (msgId=${msgId})`).toBeDefined()
      expect(entry!.en.length).toBeGreaterThan(0)
      expect(entry!.zh.length).toBeGreaterThan(0)
    }

    // Verify state tables 35..40 resolve completed speechKey when quest is completed (0x2001)
    const expectedCompletedSpeech: Record<number, string> = {
      35: 'A5Q1SuccessfulLarzuk',
      36: 'A5Q2SuccessfulQualKehk',
      37: 'A5Q3SuccessfulAnya',
      38: 'A5Q4SuccessfulAnya',
      39: 'A5Q5SuccessfulQualKehk',
      40: 'A5Q6SuccessfulTyrael',
    }
    for (const [rowStr, expectedKey] of Object.entries(expectedCompletedSpeech)) {
      const row = Number(rowStr)
      const table = CANONICAL_QUEST_STATE_TABLES[row]!
      expect(table[0]?.text).toBe(expectedKey)

      const playerWords = new Uint16Array(48)
      playerWords[row] = 0x2001
      const page = buildQuestLogPage({
        row,
        playerWords,
        gameWords: new Uint16Array(48),
        status: 0,
        den: 0,
        barbs: 0,
      })
      expect(page?.speechKey).toBe(expectedKey)
    }
  })

  it('4. Act 5 NPCs, quest reward actions, intro class-variant normalization (Ass/Dru), and A5Q2 barbs counter work end-to-end', () => {
    const malah = getTownNpcDescriptorByName('malah')!
    expect(malah.hcIdx).toBe(513)
    expect(malah.canHeal).toBe(true)

    const larzuk = getTownNpcDescriptorByName('larzuk')!
    expect(larzuk.hcIdx).toBe(511)
    expect(larzuk.questRewardActions).toEqual(['add_sockets'])

    const anya = getTownNpcDescriptorByName('drehya')!
    expect(anya.hcIdx).toBe(512)
    expect(anya.questRewardActions).toEqual(['personalize'])

    const qualkehk = getTownNpcDescriptorByName('qual-kehk')!
    expect(qualkehk.hcIdx).toBe(515)
    expect(qualkehk.canHire).toBe(true)

    expect(getTownNpcDescriptorByHcIdx(527)?.npcTxtKey).toBe('drehyaiced')
    expect(getTownNpcDescriptorByHcIdx(521)?.npcTxtKey).toBe('tyrael3')
    expect(getTownNpcDescriptorByHcIdx(537)?.npcTxtKey).toBe('ancientstatue1')
    expect(getTownNpcDescriptorByHcIdx(538)?.npcTxtKey).toBe('ancientstatue2')
    expect(getTownNpcDescriptorByHcIdx(539)?.npcTxtKey).toBe('ancientstatue3')

    // Assassin & Druid intro normalization
    expect(resolveNpcIntroMsgIdByTblKey('NihlathakAct5IntroGossip1')).toBe(20053)
    expect(resolveNpcIntroMsgIdByTblKey('QualKehkAct5IntroGossip1')).toBe(20065)
    expect(resolveNpcDialogueTblText('A5Q4AfterInitAnya', { lang: 'ENG' })).toContain('Nihlathak')

    // Quest items ice (Malah's Potion) & tr2 (Scroll of Resistance)
    expect(CANONICAL_QUEST_ITEM_CODES.has('ice')).toBe(true)
    expect(CANONICAL_QUEST_ITEM_CODES.has('tr2')).toBe(true)

    // A5Q2 barbs counter in QuestLogState & buildQuestLogPage
    const qlog = new QuestLogState()
    qlog.apply5D(0x20, 0x20, 2, 10, { denQuestWord: 0, playerDeadOrDying: false })
    expect(qlog.barbs).toBe(10)
    const page = buildQuestLogPage({
      row: 36,
      playerWords: new Uint16Array(48),
      gameWords: new Uint16Array(48),
      status: 2,
      den: 0,
      barbs: 10,
    })
    expect(page?.text).toEqual({ kind: 'printfCount', key: 'qstsa5q22', count: 10 })
  })

  it('5. Act 5 quest, waypoint, and portal objects (473..569) have full 8-mode 1.13c animation metadata in CANONICAL_113C_OBJECTS', () => {
    const act5ObjectIds = [473, 474, 475, 476, 494, 496, 511, 539, 546, 547, 558, 563, 564, 565, 566, 569]
    for (const id of act5ObjectIds) {
      const obj = CANONICAL_113C_OBJECTS[id]
      const txt = OBJECTS_TXT_113C[id]
      expect(obj, `Object ${id} missing from CANONICAL_113C_OBJECTS`).toBeDefined()
      expect(txt, `Object ${id} missing from OBJECTS_TXT_113C`).toBeDefined()
      expect(obj!.frameCnt).toEqual(txt!.frameCnt)
      expect(obj!.frameDelta).toEqual(txt!.frameDelta)
      expect(obj!.cycleAnim).toEqual(txt!.cycleAnim.map(Boolean))
      expect(obj!.start).toEqual(txt!.start)
    }
  })
})
