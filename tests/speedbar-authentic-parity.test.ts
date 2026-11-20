import { describe, it, expect, beforeEach } from 'vitest'
import { SkillHotkeysHud, isLeftUsableSkill, isPassiveSkill, isAuraSkill, getSkillListRow, getSkillReqLevel, LEFT_SKILL_BOUNDS, RIGHT_SKILL_BOUNDS } from '../src/client/ui/hotkeys.ts'
import type { HotkeySkillEntry } from '../src/client/ui/hotkeys.ts'
import { SKILLS_CATALOG, SKILLS_BY_CLASS } from '../src/common/data/skills-catalog.ts'
import type { SkillCatalogEntry } from '../src/common/data/skills-catalog.ts'
import { CHARACTER_CLASS_CODES } from '../src/common/units/classes.ts'
import { DEMO_SORCERESS_SKILLS, DEMO_UNIVERSAL_SKILLS } from './fixtures/demo-profile-data.ts'

describe('Diablo II v1.13c Speedbar Authentic Parity (All 7 Classes)', () => {
  let hud: SkillHotkeysHud

  beforeEach(() => {
    hud = new SkillHotkeysHud()
  })

  // Helper to convert catalog entries into complete HotkeySkillEntry objects
  function createClassSkillEntries(entries: readonly SkillCatalogEntry[]): HotkeySkillEntry[] {
    return entries.map(s => ({
      skillId: s.id,
      name: s.name,
      nameZh: s.nameZh,
      level: 1,
      manaCost: s.mana,
      leftUsable: isLeftUsableSkill(s.id),
      rightUsable: !isPassiveSkill(s.id),
      isAura: isAuraSkill(s.id),
      isPassive: isPassiveSkill(s.id),
      tabIndex: s.tabIndex,
      reqlevel: s.reqlevel,
    }))
  }

  // =========================================================================
  // 1. Ground Truth Catalog Mapping: ListRow & ReqLevel
  // =========================================================================
  describe('1. Ground Truth Catalog Mapping', () => {
    it('maps all 210 class skills in SKILLS_CATALOG to ListRow = tabIndex + 1 with 100% parity', () => {
      expect(SKILLS_CATALOG.length).toBe(210)
      for (const s of SKILLS_CATALOG) {
        const entry: HotkeySkillEntry = {
          skillId: s.id,
          name: s.name,
          nameZh: s.nameZh,
          level: 1,
          manaCost: s.mana,
          leftUsable: isLeftUsableSkill(s.id),
          rightUsable: !isPassiveSkill(s.id),
          tabIndex: s.tabIndex,
        }
        const row = getSkillListRow(entry)
        expect(row).toBe(s.tabIndex + 1)
        expect(row).toBeGreaterThanOrEqual(1)
        expect(row).toBeLessThanOrEqual(3)
      }
    })

    it('maps universal / basic actions to ListRow = 0 and excludes ListRow = -1 (#1 Kick, #5 Left Hand Swing)', () => {
      const basicActions = [
        { skillId: 0, name: 'Attack', leftUsable: true, rightUsable: true },
        { skillId: 2, name: 'Throw', leftUsable: true, rightUsable: true },
        { skillId: 3, name: 'Unsummon', leftUsable: false, rightUsable: true },
        { skillId: 4, name: 'Left Hand Throw', leftUsable: true, rightUsable: true },
        { skillId: 350, name: 'Delerium Change', leftUsable: false, rightUsable: true },
      ]
      for (const action of basicActions) {
        const row = getSkillListRow({
          skillId: action.skillId,
          name: action.name,
          nameZh: action.name,
          level: 1,
          manaCost: 0,
          leftUsable: action.leftUsable,
          rightUsable: action.rightUsable,
        })
        expect(row).toBe(0)
      }
      expect(
        getSkillListRow({
          skillId: 5,
          name: 'Left Hand Swing',
          nameZh: 'Left Hand Swing',
          level: 1,
          manaCost: 0,
          leftUsable: true,
          rightUsable: true,
        }),
      ).toBe(-1)
    })

    it('maps item skills (Town Portal, Identify, Charges) to ListRow = 4', () => {
      const itemSkills = [
        { skillId: 217, name: 'Scroll of Identify' },
        { skillId: 218, name: 'Tome of Identify' },
        { skillId: 219, name: 'Scroll of Town Portal' },
        { skillId: 220, name: 'Tome of Town Portal' },
        { skillId: 999, name: 'Teleport Charge Item', isItemSkill: true },
      ]
      for (const item of itemSkills) {
        const row = getSkillListRow({
          skillId: item.skillId,
          name: item.name,
          nameZh: item.name,
          level: 1,
          manaCost: 0,
          leftUsable: false,
          rightUsable: true,
          isItemSkill: (item as any).isItemSkill,
        })
        expect(row).toBe(4)
      }
    })

    it('maps charged class skills (e.g. Teleport 54, Life Tap 82, Lower Resist 91) to ListRow = 4', () => {
      const chargedSkills: HotkeySkillEntry[] = [
        { skillId: 54, name: 'Teleport', nameZh: '传送', level: 1, manaCost: 24, charges: 20, maxCharges: 20, leftUsable: false, rightUsable: true },
        { skillId: 82, name: 'Life Tap', nameZh: '偷取生命', level: 1, manaCost: 9, charges: 15, maxCharges: 15, leftUsable: false, rightUsable: true },
        { skillId: 91, name: 'Lower Resist', nameZh: '降低抵抗', level: 1, manaCost: 22, charges: 10, maxCharges: 10, leftUsable: false, rightUsable: true },
      ]
      for (const skill of chargedSkills) {
        expect(getSkillListRow(skill)).toBe(4)
      }
    })

    it('retrieves accurate reqlevel from catalog for all skills', () => {
      for (const s of SKILLS_CATALOG) {
        const entry: HotkeySkillEntry = {
          skillId: s.id,
          name: s.name,
          nameZh: s.nameZh,
          level: 1,
          manaCost: s.mana,
          leftUsable: true,
          rightUsable: true,
        }
        expect(getSkillReqLevel(entry)).toBe(s.reqlevel)
      }
      // Basic actions default to reqlevel 1
      expect(getSkillReqLevel({ skillId: 0, name: 'Attack', nameZh: '攻击', level: 1, manaCost: 0, leftUsable: true, rightUsable: true })).toBe(1)
      expect(getSkillReqLevel({ skillId: 2, name: 'Throw', nameZh: '投掷', level: 1, manaCost: 0, leftUsable: true, rightUsable: true })).toBe(1)
      expect(getSkillReqLevel({ skillId: 3, name: 'Unsummon', nameZh: '取消召唤', level: 1, manaCost: 0, leftUsable: false, rightUsable: true })).toBe(1)
    })
  })

  // =========================================================================
  // 2. Usability Filters (Left vs Right) Across All 7 Classes
  // =========================================================================
  describe('2. Usability Filters (Left vs Right) Across All 7 Classes', () => {
    CHARACTER_CLASS_CODES.forEach(cls => {
      it(`enforces authentic 1.13c left and right filters for ${cls.toUpperCase()}`, () => {
        const classSkills = createClassSkillEntries(SKILLS_BY_CLASS[cls])
        const allSkills: HotkeySkillEntry[] = [...DEMO_UNIVERSAL_SKILLS, ...classSkills]
        hud.setAvailableSkills(allSkills)

        // --- Left Click Speedbar ---
        const leftCells = hud.getPopupCells('left')
        for (const cell of leftCells) {
          const id = cell.skill.skillId
          // 1. Passive skills strictly filtered out
          expect(isPassiveSkill(id)).toBe(false)
          expect(cell.skill.isPassive).toBeFalsy()
          // 2. Aura skills strictly filtered out
          expect(isAuraSkill(id)).toBe(false)
          expect(cell.skill.isAura).toBeFalsy()
          // 3. Must be an official 1.13c left skill
          expect(isLeftUsableSkill(id)).toBe(true)
          // 4. Unsummon (3) is right-only
          expect(id).not.toBe(3)
        }

        // --- Right Click Speedbar ---
        const rightCells = hud.getPopupCells('right')
        for (const cell of rightCells) {
          const id = cell.skill.skillId
          // 1. Passive skills strictly filtered out
          expect(isPassiveSkill(id)).toBe(false)
          expect(cell.skill.isPassive).toBeFalsy()
          // 2. Right click allows both active skills and auras
          expect(cell.skill.rightUsable !== false).toBe(true)
        }
      })
    })

    it('strictly excludes Meteor (56) and Blizzard (59) from Sorceress left speedbar', () => {
      hud.setAvailableSkills([...DEMO_SORCERESS_SKILLS])
      const leftCells = hud.getPopupCells('left')
      const leftIds = leftCells.map(c => c.skill.skillId)

      expect(leftIds).not.toContain(56) // Meteor
      expect(leftIds).not.toContain(59) // Blizzard
      expect(leftIds).toContain(47)     // Fire Ball
      expect(leftIds).toContain(55)     // Glacial Spike
      expect(leftIds).toContain(38)     // Charged Bolt
      expect(leftIds).toContain(0)      // Normal Attack

      const rightCells = hud.getPopupCells('right')
      const rightIds = rightCells.map(c => c.skill.skillId)
      expect(rightIds).toContain(56)    // Meteor present on right
      expect(rightIds).toContain(59)    // Blizzard present on right
    })

    it('strictly includes Maul (233) on Druid left speedbar', () => {
      const druidSkills = createClassSkillEntries(SKILLS_BY_CLASS.dru)
      hud.setAvailableSkills([...DEMO_UNIVERSAL_SKILLS, ...druidSkills])
      const leftIds = hud.getPopupCells('left').map(c => c.skill.skillId)
      expect(leftIds).toContain(233) // Maul
      expect(leftIds).not.toContain(228) // Cyclone Armor (buff, leftskill=0)
      expect(leftIds).not.toContain(226) // Oak Sage (summon, leftskill=0)
    })

    it('strictly excludes all Paladin auras and Holy Shield from left speedbar', () => {
      const paladinSkills = createClassSkillEntries(SKILLS_BY_CLASS.pal)
      hud.setAvailableSkills([...DEMO_UNIVERSAL_SKILLS, ...paladinSkills])
      const leftCells = hud.getPopupCells('left')
      const leftIds = leftCells.map(c => c.skill.skillId)

      // No aura allowed
      expect(leftIds).not.toContain(98)  // Might
      expect(leftIds).not.toContain(102) // Holy Fire
      expect(leftIds).not.toContain(113) // Holy Freeze
      expect(leftIds).not.toContain(118) // Holy Shock
      expect(leftIds).not.toContain(122) // Fanaticism
      expect(leftIds).not.toContain(125) // Salvation
      expect(leftIds).not.toContain(99)  // Prayer
      expect(leftIds).not.toContain(109) // Cleansing
      expect(leftIds).not.toContain(115) // Vigor
      expect(leftIds).not.toContain(124) // Redemption
      expect(leftIds).not.toContain(117) // Holy Shield (self-buff, leftskill=0)

      // Combat skills allowed
      expect(leftIds).toContain(96)  // Sacrifice
      expect(leftIds).toContain(97)  // Smite
      expect(leftIds).toContain(101) // Holy Bolt
      expect(leftIds).toContain(106) // Zeal
      expect(leftIds).toContain(107) // Charge
      expect(leftIds).toContain(111) // Vengeance
      expect(leftIds).toContain(112) // Blessed Hammer
      expect(leftIds).toContain(116) // Conversion
      expect(leftIds).toContain(121) // Fist of the Heavens

      // Right speedbar includes auras with yellow border marker
      const rightCells = hud.getPopupCells('right')
      const rightAuras = rightCells.filter(c => isAuraSkill(c.skill.skillId))
      expect(rightAuras.length).toBe(20) // All 20 Paladin auras
    })

    it('strictly excludes Barbarian combat mastery passives from both speedbars', () => {
      const barbarianSkills = createClassSkillEntries(SKILLS_BY_CLASS.bar)
      hud.setAvailableSkills([...DEMO_UNIVERSAL_SKILLS, ...barbarianSkills])
      const leftIds = hud.getPopupCells('left').map(c => c.skill.skillId)
      const rightIds = hud.getPopupCells('right').map(c => c.skill.skillId)

      const passives = [127, 128, 129, 134, 135, 136, 141, 145, 148, 153]
      for (const p of passives) {
        expect(leftIds).not.toContain(p)
        expect(rightIds).not.toContain(p)
      }
    })
  })

  // =========================================================================
  // 3. Multi-Row Grouping & Row Compaction
  // =========================================================================
  describe('3. Multi-Row Grouping & Row Compaction', () => {
    it('compacts Barbarian right-click speedbar from [0, 1, 3] into contiguous visualRows [0, 1, 2]', () => {
      const barbarianSkills = createClassSkillEntries(SKILLS_BY_CLASS.bar)
      hud.setAvailableSkills([...DEMO_UNIVERSAL_SKILLS, ...barbarianSkills])
      const rightCells = hud.getPopupCells('right')

      // Barbarian has:
      // ListRow 0: Attack (0), Throw (2), Unsummon (3)
      // ListRow 1: Combat Skills (10 active)
      // ListRow 2: Combat Masteries (10 PASSIVES -> 0 active)
      // ListRow 3: Warcries (10 active)
      const listRowsPresent = Array.from(new Set(rightCells.map(c => c.listRow))).sort((a, b) => a - b)
      expect(listRowsPresent).toEqual([0, 1, 3])

      const visualRowsPresent = Array.from(new Set(rightCells.map(c => c.visualRow))).sort((a, b) => a - b)
      expect(visualRowsPresent).toEqual([0, 1, 2])

      // Verify that every cell in ListRow 3 is compacted into visualRow 2
      const warcriesCells = rightCells.filter(c => c.listRow === 3)
      expect(warcriesCells.length).toBe(10)
      for (const cell of warcriesCells) {
        expect(cell.visualRow).toBe(2)
      }
    })

    it('compacts Paladin left-click speedbar to contiguous visualRows [0, 1]', () => {
      const paladinSkills = createClassSkillEntries(SKILLS_BY_CLASS.pal)
      hud.setAvailableSkills([...DEMO_UNIVERSAL_SKILLS, ...paladinSkills])
      const leftCells = hud.getPopupCells('left')

      // ListRow 0 (Universal), ListRow 1 (Combat skills). ListRow 2 and 3 are auras (filtered out).
      const listRowsPresent = Array.from(new Set(leftCells.map(c => c.listRow))).sort((a, b) => a - b)
      expect(listRowsPresent).toEqual([0, 1])

      const visualRowsPresent = Array.from(new Set(leftCells.map(c => c.visualRow))).sort((a, b) => a - b)
      expect(visualRowsPresent).toEqual([0, 1])
    })

    it('compacts single-tree character without gap rows', () => {
      // Character that only learned Lightning Spells (Tab 2 => ListRow 2)
      const lightSpells = createClassSkillEntries(SKILLS_BY_CLASS.sor.filter(s => s.tabIndex === 1 && !isPassiveSkill(s.id)))

      hud.setAvailableSkills([...DEMO_UNIVERSAL_SKILLS, ...lightSpells])
      const rightCells = hud.getPopupCells('right')

      // ListRow 0 (Universal) and ListRow 2 (Lightning)
      const listRowsPresent = Array.from(new Set(rightCells.map(c => c.listRow))).sort((a, b) => a - b)
      expect(listRowsPresent).toEqual([0, 2])

      // Compacted to visualRow 0 and 1
      const visualRowsPresent = Array.from(new Set(rightCells.map(c => c.visualRow))).sort((a, b) => a - b)
      expect(visualRowsPresent).toEqual([0, 1])

      const lightCells = rightCells.filter(c => c.listRow === 2)
      for (const cell of lightCells) {
        expect(cell.visualRow).toBe(1)
      }
    })

    it('maintains contiguous visualRow compaction with item skills across all 7 classes', () => {
      const itemSkills: HotkeySkillEntry[] = [
        { skillId: 219, name: 'Scroll of Town Portal', nameZh: '城镇传送卷轴', level: 1, manaCost: 0, isItemSkill: true, leftUsable: false, rightUsable: true },
        { skillId: 217, name: 'Scroll of Identify', nameZh: '辨识卷轴', level: 1, manaCost: 0, isItemSkill: true, leftUsable: false, rightUsable: true },
      ]
      for (const cls of CHARACTER_CLASS_CODES) {
        const classSkills = createClassSkillEntries(SKILLS_BY_CLASS[cls])
        hud.setAvailableSkills([...DEMO_UNIVERSAL_SKILLS, ...classSkills, ...itemSkills])
        const rightCells = hud.getPopupCells('right')
        const visualRows = Array.from(new Set(rightCells.map(c => c.visualRow))).sort((a, b) => a - b)
        for (let i = 0; i < visualRows.length; i++) {
          expect(visualRows[i]).toBe(i)
        }
        const itemCells = rightCells.filter(c => c.listRow === 4)
        const maxRow = Math.max(...visualRows)
        for (const cell of itemCells) {
          expect(cell.visualRow).toBe(maxRow)
        }
      }
    })

    it('correctly places charged skills in ListRow 4 on a non-native class (Barbarian with Teleport charges)', () => {
      const barbarianSkills = createClassSkillEntries(SKILLS_BY_CLASS.bar)
      const tpChargedItem: HotkeySkillEntry = {
        skillId: 54,
        name: 'Teleport',
        nameZh: '传送',
        level: 1,
        manaCost: 24,
        charges: 20,
        maxCharges: 20,
        leftUsable: false,
        rightUsable: true,
      }
      hud.setAvailableSkills([...DEMO_UNIVERSAL_SKILLS, ...barbarianSkills, tpChargedItem])
      const rightCells = hud.getPopupCells('right')
      const tpCell = rightCells.find(c => c.skill.skillId === 54)
      expect(tpCell).toBeDefined()
      expect(tpCell!.listRow).toBe(4)
      // Visual rows: 0 (Universal), 1 (Combat skills), 2 (Warcries), 3 (Item row with Teleport)
      expect(tpCell!.visualRow).toBe(3)
    })
  })

  // =========================================================================
  // 4. Intra-Row Ordering
  // =========================================================================
  describe('4. Intra-Row Ordering', () => {
    it('strictly sorts skills within each row by reqlevel ascending, then skillId ascending', () => {
      for (const cls of CHARACTER_CLASS_CODES) {
        const classSkills = createClassSkillEntries(SKILLS_BY_CLASS[cls])
        hud.setAvailableSkills([...DEMO_UNIVERSAL_SKILLS, ...classSkills])

        for (const side of ['left', 'right'] as const) {
          const cells = hud.getPopupCells(side)
          // Group cells by visualRow
          const rows = new Map<number, (typeof cells)[number][]>()
          for (const c of cells) {
            let list = rows.get(c.visualRow)
            if (!list) {
              list = []
              rows.set(c.visualRow, list)
            }
            list.push(c)
          }

          for (const rowCells of rows.values()) {
            for (let i = 0; i < rowCells.length - 1; i++) {
              const a = rowCells[i]
              const b = rowCells[i + 1]
              const reqA = getSkillReqLevel(a.skill)
              const reqB = getSkillReqLevel(b.skill)

              if (reqA === reqB) {
                expect(a.skill.skillId).toBeLessThan(b.skill.skillId)
              } else {
                expect(reqA).toBeLessThan(reqB)
              }
              // Verify column index is sequential 0, 1, 2...
              expect(a.col).toBe(i)
              expect(b.col).toBe(i + 1)
            }
          }
        }
      }
    })
  })

  // =========================================================================
  // 5. Adaptive Alignment & Canvas Bounds Clamping
  // =========================================================================
  describe('5. Adaptive Alignment & Canvas Bounds Clamping', () => {
    it('expands left speedbar rightward and right speedbar leftward', () => {
      hud.setAvailableSkills([...DEMO_SORCERESS_SKILLS])

      const leftCells = hud.getPopupCells('left')
      const rightCells = hud.getPopupCells('right')

      // In left popup, col 0 is at base.x (117), col 1 is at 117 + 48 = 165
      const leftRow0 = leftCells.filter(c => c.visualRow === 0)
      if (leftRow0.length >= 2) {
        expect(leftRow0[0].x).toBe(LEFT_SKILL_BOUNDS.x)
        expect(leftRow0[1].x).toBe(LEFT_SKILL_BOUNDS.x + 48)
      }

      // In right popup, col 0 is at base.x (635), col 1 is at 635 - 48 = 587
      const rightRow0 = rightCells.filter(c => c.visualRow === 0)
      if (rightRow0.length >= 2) {
        expect(rightRow0[0].x).toBe(RIGHT_SKILL_BOUNDS.x)
        expect(rightRow0[1].x).toBe(RIGHT_SKILL_BOUNDS.x - 48)
      }
    })

    it('strictly clamps all cells within [0, 800 - 48] and [0, 600 - 48]', () => {
      // Simulate extreme row with 25 skills
      const megaSkills: HotkeySkillEntry[] = []
      for (let i = 1; i <= 25; i++) {
        megaSkills.push({
          skillId: 1000 + i,
          name: `Custom Skill ${i}`,
          nameZh: `自定义技能 ${i}`,
          level: 1,
          manaCost: 10,
          leftUsable: true,
          rightUsable: true,
          tabIndex: 0,
          reqlevel: i,
        })
      }
      hud.setAvailableSkills(megaSkills)

      for (const side of ['left', 'right'] as const) {
        const cells = hud.getPopupCells(side)
        for (const cell of cells) {
          expect(cell.x).toBeGreaterThanOrEqual(0)
          expect(cell.x).toBeLessThanOrEqual(800 - 48)
          expect(cell.y).toBeGreaterThanOrEqual(0)
          expect(cell.y).toBeLessThanOrEqual(600 - 48)
        }
      }
    })
  })

  // =========================================================================
  // 6. Item Skills & Tooltips
  // =========================================================================
  describe('6. Item Skills & Tooltips', () => {
    it('positions item skills at the top row (ListRow = 4)', () => {
      const skillsWithItems: HotkeySkillEntry[] = [
        ...DEMO_SORCERESS_SKILLS,
        { skillId: 219, name: 'Scroll of Town Portal', nameZh: '城镇传送卷轴', level: 1, manaCost: 0, isItemSkill: true, leftUsable: false, rightUsable: true },
        { skillId: 217, name: 'Scroll of Identify', nameZh: '辨识卷轴', level: 1, manaCost: 0, isItemSkill: true, leftUsable: false, rightUsable: true },
      ]
      hud.setAvailableSkills(skillsWithItems)

      const rightCells = hud.getPopupCells('right')
      const itemCells = rightCells.filter(c => c.listRow === 4)
      expect(itemCells.length).toBe(2)

      const maxVisualRow = Math.max(...rightCells.map(c => c.visualRow))
      for (const cell of itemCells) {
        expect(cell.visualRow).toBe(maxVisualRow)
      }
    })

    it('formats tooltips correctly for Town Portal, Identify, and Left Hand Throw', () => {
      hud.setSkillCharges(219, 12, 20)
      const tpLines = hud.formatTooltipLines(219, 'right', true)
      expect(tpLines[0].text).toContain('傳送卷軸')
      expect(tpLines.some(l => l.text.includes('12'))).toBe(true)

      hud.setSkillCharges(218, 20, 20)
      const idLines = hud.formatTooltipLines(218, 'right', true)
      expect(idLines[0].text).toContain('辨視之書')
      expect(idLines.some(l => l.text.includes('20'))).toBe(true)

      const lhtLines = hud.formatTooltipLines(4, 'left', true)
      expect(lhtLines[0].text).toContain('左手投擲')
    })
  })

  // =========================================================================
  // 7. Interactive Assignments & Guardrails
  // =========================================================================
  describe('7. Interactive Assignments & Guardrails', () => {
    beforeEach(() => {
      hud.setAvailableSkills([...DEMO_SORCERESS_SKILLS])
    })

    it('rejects assigning Meteor (56) and Blizzard (59) to left slot', () => {
      expect(hud.assignSkill('left', 56)).toBe(false)
      expect(hud.assignSkill('left', 59)).toBe(false)
      expect(hud.leftSkillId).not.toBe(56)
      expect(hud.leftSkillId).not.toBe(59)

      // Right slot succeeds
      expect(hud.assignSkill('right', 56)).toBe(true)
      expect(hud.rightSkillId).toBe(56)
      expect(hud.assignSkill('right', 59)).toBe(true)
      expect(hud.rightSkillId).toBe(59)
    })

    it('rejects assigning auras to left slot', () => {
      expect(hud.assignSkill('left', 113)).toBe(false) // Holy Freeze
      expect(hud.leftSkillId).not.toBe(113)

      expect(hud.assignSkill('right', 113)).toBe(true)
      expect(hud.rightSkillId).toBe(113)
    })

    it('rejects assigning passive skills to any slot', () => {
      expect(hud.assignSkill('left', 61)).toBe(false)  // Fire Mastery
      expect(hud.assignSkill('right', 61)).toBe(false) // Fire Mastery
      expect(hud.assignSkill('left', 127)).toBe(false) // Sword Mastery
      expect(hud.assignSkill('right', 127)).toBe(false)
    })

    it('enforces left-usability on setDualSkill', () => {
      expect(hud.setDualSkill(0)).toBe(true) // Attack
      expect(hud.leftSkillId).toBe(0)
      expect(hud.rightSkillId).toBe(0)

      expect(hud.setDualSkill(56)).toBe(false) // Meteor
      expect(hud.setDualSkill(113)).toBe(false) // Holy Freeze
    })

    it('handles speedbar popup opening, cell click selection, and slot closing', () => {
      expect(hud.openPopup).toBeNull()

      // 1. Click Left Slot opens left popup
      const leftBounds = LEFT_SKILL_BOUNDS
      hud.handleClick(leftBounds.x + 10, leftBounds.y + 10)
      expect(hud.openPopup).toBe('left')

      // 2. Select a cell in left popup (e.g. Fire Ball 47)
      const leftCells = hud.getPopupCells('left')
      const fbCell = leftCells.find(c => c.skill.skillId === 47)!
      expect(fbCell).toBeDefined()

      hud.handleClick(fbCell.x + 5, fbCell.y + 5)
      expect(hud.leftSkillId).toBe(47)
      expect(hud.openPopup).toBeNull()

      // 3. Click Right Slot opens right popup
      const rightBounds = RIGHT_SKILL_BOUNDS
      hud.handleClick(rightBounds.x + 10, rightBounds.y + 10)
      expect(hud.openPopup).toBe('right')

      // 4. Select Blizzard (59) in right popup
      const rightCells = hud.getPopupCells('right')
      const blizCell = rightCells.find(c => c.skill.skillId === 59)!
      expect(blizCell).toBeDefined()

      hud.handleClick(blizCell.x + 5, blizCell.y + 5)
      expect(hud.rightSkillId).toBe(59)
      expect(hud.openPopup).toBeNull()
    })

    it('does not report false-positive [D2MissingArt] skill-icon errors while skill icons are still loading asynchronously (#1022)', async () => {
      const { clearMissingArtEntries, getMissingArtEntries } = await import('../src/client/scene/missing-art.ts')
      clearMissingArtEntries()

      const createdImages: Array<{ src: string; complete: boolean; naturalWidth: number }> = []
      const prevImage = (globalThis as any).Image
      ;(globalThis as any).Image = class MockImage {
        src = ''
        complete = false
        naturalWidth = 0
        constructor() {
          createdImages.push(this)
        }
      }

      try {
        const barbSkills = createClassSkillEntries(SKILLS_BY_CLASS.bar)
        hud.setAvailableSkills(barbSkills)
        hud.leftSkillId = 152 // Berserk
        hud.rightSkillId = 151 // Whirlwind
        hud.openPopup = 'left'

        const mockCtx = {
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          fillRect: () => {},
          strokeRect: () => {},
          drawImage: () => {},
        } as unknown as CanvasRenderingContext2D
        const mockFont = {
          drawText: () => {},
          measureText: () => 10,
        } as any

        // First render while all icons have complete === false (in-flight network load)
        hud.draw(mockCtx, null, mockFont, true, 1000)
        expect(getMissingArtEntries().filter(e => e.category === 'skill-icon')).toHaveLength(0)

        // Simulate a genuinely broken/404 icon (complete === true, naturalWidth === 0) for skillId 152
        const berserkImg = createdImages.find(img => img.src === '/skills/icon_152.png')
        expect(berserkImg).toBeDefined()
        berserkImg!.complete = true
        berserkImg!.naturalWidth = 0

        hud.draw(mockCtx, null, mockFont, true, 1016)
        const missing = getMissingArtEntries().filter(e => e.category === 'skill-icon')
        expect(missing.map(e => e.id)).toEqual(['icon_152'])
      } finally {
        if (prevImage === undefined) {
          delete (globalThis as any).Image
        } else {
          ;(globalThis as any).Image = prevImage
        }
        clearMissingArtEntries()
      }
    })

    it('preloads all 30 class skill icons, universal icons, and 3 skill tree backgrounds in lobby and shares cache between SkillTreePanel and SkillHotkeysHud (#1024)', async () => {
      const { HudManager } = await import('../src/client/ui/hud-manager.ts')
      const { getSharedClassLayerCompositor } = await import('../src/client/frontend/avatar-compositor.ts')
      const { PlayerPaperdollGpuCache } = await import('../src/client/scene/world-renderer.ts')

      const createdSrcs: string[] = []
      const prevImage = (globalThis as any).Image
      ;(globalThis as any).Image = class MockImage {
        private _src = ''
        complete = true
        naturalWidth = 48
        set src(v: string) {
          this._src = v
          createdSrcs.push(v)
        }
        get src(): string {
          return this._src
        }
      }

      try {
        const hudManager = new HudManager()
        const resolved = hudManager.preloadForCharacterClass('so')
        expect(resolved).toBe('sor')
        expect(hudManager.currentClass).toBe('sor')
        expect(hudManager.skillTree.characterClass).toBe('sor')

        // All 3 Sorceress skill tree tab backgrounds (bg_sor_0..2.png) are preloaded
        expect(hudManager.skillTree.hasTabBackground(0)).toBe(true)
        expect(hudManager.skillTree.hasTabBackground(1)).toBe(true)
        expect(hudManager.skillTree.hasTabBackground(2)).toBe(true)
        expect(createdSrcs).toContain('/skills/bg_sor_0.png')
        expect(createdSrcs).toContain('/skills/bg_sor_1.png')
        expect(createdSrcs).toContain('/skills/bg_sor_2.png')

        // All 30 Sorceress class skills (36..65) are preloaded and shared identically between skillTree and hotkeys
        for (let skillId = 36; skillId <= 65; skillId++) {
          expect(hudManager.skillTree.hasSkillIcon(skillId)).toBe(true)
          expect(hudManager.hotkeys.hasSkillIcon(skillId)).toBe(true)
          expect(hudManager.hotkeys.getSkillIcon(skillId)).toBe(
            hudManager.skillTree.getSkillIcon(skillId),
          )
          // Each class skill icon was allocated only once (shared cache)
          expect(createdSrcs.filter(s => s === `/skills/icon_${skillId}.png`)).toHaveLength(1)
        }

        // Universal skill icons (0, 2, 3, 4, 217, 218, 219, 220) and sword fallback are preloaded
        for (const universalId of [0, 2, 3, 4, 217, 218, 219, 220]) {
          expect(hudManager.hotkeys.hasSkillIcon(universalId)).toBe(true)
        }
        expect(hudManager.hotkeys.swordImage?.src).toBe('/skills/icon_0_sword.png')

        // PlayerPaperdollGpuCache reuses the shared class layer compositor from avatar-compositor.ts
        const mockRenderer = {
          addIndexedAtlas: () => ({ id: 1 }),
        } as any
        const gpuCache = new PlayerPaperdollGpuCache(mockRenderer, '')
        const sharedSo = getSharedClassLayerCompositor('so')
        const cacheSo = (gpuCache as any).getCompositor('so')
        expect(cacheSo).toBe(sharedSo)
      } finally {
        if (prevImage === undefined) {
          delete (globalThis as any).Image
        } else {
          ;(globalThis as any).Image = prevImage
        }
      }
    })
  })
})
