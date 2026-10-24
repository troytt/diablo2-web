import { describe, expect, it } from 'vitest'
import {
  monsterDisplayName,
  readSuperUniques,
  CANONICAL_SUPERUNIQUES_TABLE,
  CANONICAL_SUPER_UNIQUE_LANDMARKS,
  CANONICAL_SUPER_UNIQUES_BY_LEVEL,
  buildSuperUniqueLandmarkSpecs,
} from '../src/common/units/monsters-data.ts'
import { RAW_SUPERUNIQUES } from '../src/common/data/canonical-drop-data.ts'
import { parseTable } from '../src/common/world/acts.ts'
import {
  NPC_CANONICAL_INTRO_KEYS,
  NPC_CANONICAL_GOSSIP_KEYS,
  resolveNpcDialogueTblText,
} from '../src/common/units/npc-table.ts'
import {
  CANONICAL_QUEST_DATA,
  CANONICAL_QUEST_TBL_STRINGS,
  CANONICAL_QUEST_STATE_TABLES,
} from '../src/common/data/canonical-quest-data.ts'
import { CANONICAL_113C_OBJECTS } from '../src/common/world/objects-meta.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'

describe('Act 4 Quests (A4Q1..A4Q3) 1.13c Parity Audit & Fixes', () => {
  describe('Fix 1: Hephasto The Armorer vs Creeping Feature .tbl Display Name & TreasureClass Parity', () => {
    it('resolves Creeping Feature (Leatherarm) and Hephasto The Armorer (The Feature Creep) to authentic 1.13c .tbl strings', () => {
      expect(monsterDisplayName('Creeping Feature', 'ENG')).toBe('Creeping Feature')
      expect(monsterDisplayName('Creeping Feature', 'CHI')).toBe('爬行的容貌')

      expect(monsterDisplayName('Hephasto the Armorer', 'ENG')).toBe('Hephasto The Armorer')
      expect(monsterDisplayName('Hephasto the Armorer', 'CHI')).toBe('海法斯特盔甲製作者')
      expect(monsterDisplayName('Hephasto The Armorer', 'ENG')).toBe('Hephasto The Armorer')
      expect(monsterDisplayName('Hephasto The Armorer', 'CHI')).toBe('海法斯特盔甲製作者')
      expect(monsterDisplayName('The Feature Creep', 'ENG')).toBe('Hephasto The Armorer')
      expect(monsterDisplayName('The Feature Creep', 'CHI')).toBe('海法斯特盔甲製作者')
    })

    it('resolves Hephasto the Armorer TreasureClass to authentic 1.13c Haphesto / Haphesto (N) / Haphesto (H)', () => {
      const dropTables = getEmbeddedDropTables()
      const parsed = readSuperUniques(CANONICAL_SUPERUNIQUES_TABLE)
      const hephasto = parsed.find(su => su.id === 'Hephasto the Armorer')
      expect(hephasto).toBeDefined()
      expect(hephasto!.getTreasureClass?.('normal')).toBe('Haphesto')
      expect(hephasto!.getTreasureClass?.('nightmare')).toBe('Haphesto (N)')
      expect(hephasto!.getTreasureClass?.('hell')).toBe('Haphesto (H)')

      expect(dropTables.tcTable.get('Haphesto')).toBeDefined()
      expect(dropTables.tcTable.get('Haphesto (N)')).toBeDefined()
      expect(dropTables.tcTable.get('Haphesto (H)')).toBeDefined()
    })

    it('resolves Hephasto the Armorer landmark spec even when built from raw MPQ SuperUniques.txt (The Feature Creep)', () => {
      const rawTable = parseTable(new TextEncoder().encode(RAW_SUPERUNIQUES.trim()))
      const specsByLevel = buildSuperUniqueLandmarkSpecs(rawTable, 'normal')
      const lvl107Spec = specsByLevel[107]
      expect(lvl107Spec).toBeDefined()
      const spec = Array.isArray(lvl107Spec) ? lvl107Spec[0] : lvl107Spec
      expect(spec?.monsterId).toBe('hephasto')
      expect(spec?.minionMonsterId).toBe('hephasto')
    })
  })

  describe('Fix 2: Chaos Sanctuary (Level 108) Seal SuperUniques & Minion Asset Bundling', () => {
    it('registers Grand Vizier of Chaos, Lord De Seis, and Infector of Souls on Level 108 with authentic minion IDs', () => {
      const landmarkMap = new Map(CANONICAL_SUPER_UNIQUE_LANDMARKS.map(l => [l.id, l]))

      expect(landmarkMap.get('Grand Vizier of Chaos')).toEqual({
        id: 'Grand Vizier of Chaos',
        levelIds: [108],
        landmark: 'Act 4 - Diablo Wing W',
        minionMonsterId: 'fingermage3',
      })
      expect(landmarkMap.get('Lord De Seis')).toEqual({
        id: 'Lord De Seis',
        levelIds: [108],
        landmark: 'Act 4 - Diablo Wing N',
        minionMonsterId: 'doomknight1',
      })
      expect(landmarkMap.get('Infector of Souls')).toEqual({
        id: 'Infector of Souls',
        levelIds: [108],
        landmark: 'Act 4 - Diablo Wing E',
        minionMonsterId: 'megademon3',
      })

      const lvl108 = CANONICAL_SUPER_UNIQUES_BY_LEVEL[108]
      expect(Array.isArray(lvl108)).toBe(true)
      const specs = lvl108 as readonly any[]
      expect(specs.map(s => s.id)).toEqual([
        'Grand Vizier of Chaos',
        'Lord De Seis',
        'Infector of Souls',
      ])
      expect(specs.find(s => s.id === 'Lord De Seis')?.monsterId).toBe('doomknight3')
      expect(specs.find(s => s.id === 'Lord De Seis')?.minionMonsterId).toBe('doomknight1')
    })
  })

  describe('Fix 3: Tyrael (tyrael1 Act 2, tyrael2 Act 4, tyrael3 Act 5) Intro & Gossip .tbl Keys', () => {
    it('binds tyrael1 to Act 2 tomb gossip, tyrael2 to Act 4 Pandemonium Fortress gossip, and tyrael3 to Act 5 Worldstone speech', () => {
      expect(NPC_CANONICAL_INTRO_KEYS.tyrael1).toBe('TyraelGossip1')
      expect(NPC_CANONICAL_GOSSIP_KEYS.tyrael1).toEqual(['TyraelGossip1'])

      expect(NPC_CANONICAL_INTRO_KEYS.tyrael2).toBe('TyraelActIntroGossip1')
      expect(NPC_CANONICAL_GOSSIP_KEYS.tyrael2).toEqual(['TyraelAct4Gossip1'])

      expect(NPC_CANONICAL_INTRO_KEYS.tyrael3).toBe('A5Q6SuccessfulTyrael')
      expect(NPC_CANONICAL_GOSSIP_KEYS.tyrael3).toEqual(['A5Q6SuccessfulTyrael'])

      const act2Speech = resolveNpcDialogueTblText('tyrael1', 'intro', 'ENG')
      expect(act2Speech).toContain('I thank you, mortal, for my freedom.')
      expect(act2Speech).toContain('Kurast')

      const act4Intro = resolveNpcDialogueTblText('tyrael2', 'intro', 'ENG')
      expect(act4Intro).toContain('Pandemonium Fortress')

      const act4Gossip = resolveNpcDialogueTblText('tyrael2', 'gossip', 'ENG')
      expect(act4Gossip).toContain('Horadrim')
      expect(act4Gossip).toContain('Deckard Cain')

      const act5Speech = resolveNpcDialogueTblText('tyrael3', 'intro', 'ENG')
      expect(act5Speech).toContain('Worldstone')
    })
  })

  describe('Fix 4: Act 4 Canonical Quest Stage Strings & Speech Keys in CANONICAL_QUEST_TBL_STRINGS', () => {
    it('uses authentic 1.13c .tbl string A4Q3SuccessfulCain for a4q2 (HellForge) completedZh', () => {
      const a4q2 = CANONICAL_QUEST_DATA.find(q => q.id === 'a4q2')
      expect(a4q2).toBeDefined()
      expect(a4q2!.completedKey).toBe('A4Q3SuccessfulCain')
      expect(a4q2!.completedZh).toBe(
        '恭喜你，英雄！當然了...即使是暗黑破壞神本身，也可以感受到你打碎他兄弟的靈魂之石後，所釋放出來的怒氣。',
      )
    })

    it('includes all Act 4 quest stage keys and speech keys referenced by Act 4 quest rows (25..27)', () => {
      expect(CANONICAL_QUEST_TBL_STRINGS.qstsa4q23).toEqual({
        zh: '打破尚存的%d封印。',
        en: 'Break the remaining %d seals.',
      })
      expect(CANONICAL_QUEST_TBL_STRINGS.qstsa4q24).toEqual({
        zh: '打破最後一個封印。',
        en: 'Break the final seal.',
      })
      expect(CANONICAL_QUEST_TBL_STRINGS.qstsa4q34).toEqual({
        zh: '和凱恩請教一下。',
        en: 'Consult with Cain.',
      })

      for (const rowKey of ['25', '26', '27'] as const) {
        const table = CANONICAL_QUEST_STATE_TABLES[rowKey]
        expect(table).toBeDefined()
        for (const entry of table) {
          for (const key of [entry.speech, entry.text]) {
            if (key && key !== 'NONE' && key !== 'WarrivAct1IntroGossip1') {
              expect(
                CANONICAL_QUEST_TBL_STRINGS[key],
                `Row ${rowKey} key ${key} missing in CANONICAL_QUEST_TBL_STRINGS`,
              ).toBeDefined()
            }
          }
        }
      }
    })
  })

  describe('Fix 5: Act 4 Quest Objects (376 Hellforge, 377 Guild Portal, 380-381 TrappedSoul) Full 8-Mode Animation Arrays', () => {
    it('preserves all 5 active modes (NU, OP, ON, S1 smash, S2 post-smash) on Hellforge (376)', () => {
      const hellforge = CANONICAL_113C_OBJECTS[376]
      expect(hellforge).toBeDefined()
      expect(hellforge!.frameCnt).toEqual([22, 22, 22, 22, 22, 0, 0, 0])
      expect(hellforge!.frameDelta).toEqual([128, 128, 128, 128, 128, 128, 256, 256])
      expect(hellforge!.cycleAnim).toEqual([true, false, true, false, true, true, false, false])
    })

    it('preserves all 6 active modes on TrappedSoul (380, 381)', () => {
      for (const id of [380, 381]) {
        const soul = CANONICAL_113C_OBJECTS[id]
        expect(soul).toBeDefined()
        expect(soul!.frameCnt).toEqual([20, 8, 21, 7, 1, 8, 0, 0])
        expect(soul!.frameDelta).toEqual([140, 120, 140, 120, 1, 140, 0, 0])
        expect(soul!.cycleAnim).toEqual([true, false, true, false, false, false, false, false])
      }
    })
  })
})
