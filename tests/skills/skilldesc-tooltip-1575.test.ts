import { describe, expect, it } from 'vitest'
import { SKILLS_BY_ID, SKILLS_CATALOG } from '../../src/common/data/skills-catalog.ts'
import { SKILL_DESC_BY_SKILL_ID } from '../../src/common/data/skilldesc-table.ts'
import {
  createInitialState,
  evaluateSkillDescLines,
  calculateManaCost,
  type SkillCalcState,
} from '../../src/common/skills/skill-calc-engine.ts'
import { formatSkillManaCost, formatSkillSeconds, formatSkillYards } from '../../src/common/skills/skilldesc-lines.ts'
import { buildSkillTooltipLines } from '../../src/common/skills/skill-tooltip-builder.ts'
import { getSkillMaxLevel } from '../../src/common/skills/skills-meta.ts'

const tblEn = (k: string) => ({ StrSkill15: ' second', StrSkill16: ' seconds', StrSkill26: ' yards', StrSkill36: ' yard' })[k]!

function stateWith(cls: SkillCalcState['classCode'], pts: Record<number, number>): SkillCalcState {
  const s = createInitialState(cls)
  return { ...s, hardPoints: { ...s.hardPoints, ...pts } }
}
function tooltip(id: number, hard: number, lang: 'en' | 'zh' = 'en', difficulty = 0) {
  const sk = SKILLS_BY_ID[id]!
  const st = stateWith(sk.classCode, hard ? { [id]: hard } : {})
  return buildSkillTooltipLines({
    state: st,
    skill: sk,
    baseLevel: hard,
    effectiveLevel: hard,
    maxLevel: getSkillMaxLevel(id),
    reqLevel: sk.reqlevel,
    lang,
    difficulty,
  })
}
const texts = (id: number, hard: number, difficulty = 0) => tooltip(id, hard, 'en', difficulty).map(l => l.text)

describe('SkillDesc line helpers (D2Client.dll 0x6FAE16C0 family)', () => {
  it('#1578 mana: 256ths with a truncated single decimal (0x6FAE14D0)', () => {
    const m = (id: number, lvl: number) => {
      const s = SKILLS_BY_ID[id]!
      return formatSkillManaCost({ lvl, mana: s.mana, lvlMana: s.lvlmana, minMana: s.minmana ?? 0, manaShift: s.manashift ?? 8 })
    }
    expect(m(7, 4)).toBe('3.3') // Fire Arrow L4: (24+3)<<5 = 864 -> 3.375 -> "3.3"
    expect(m(64, 2)).toBe('25') // Frozen Orb L2: 0x1980 > 0x1900 -> integer
    expect(m(41, 1)).toBe('0.5') // Inferno
    expect(m(133, 1)).toBe('1') // Double Swing L1: 8<<5 = 256 -> tenth 0 -> "%d" (0x6FADF7D0)
    expect(m(133, 2)).toBe('0.8')
    expect(calculateManaCost(SKILLS_BY_ID[7]!, 4)).toBe(3.3)
  })

  it('#1584 seconds: trunc to 0.1, singular " second" (0x6FADE060)', () => {
    expect(formatSkillSeconds(37, tblEn)).toBe('1.4 seconds')
    expect(formatSkillSeconds(25, tblEn)).toBe('1 second')
    expect(formatSkillSeconds(0, tblEn)).toBeNull()
  })

  it('#1588 yards: integer when no tenth, " yard" singular, clamp (0x6FADF430)', () => {
    expect(formatSkillYards(3, tblEn)).toBe('2 yards')
    expect(formatSkillYards(4, tblEn)).toBe('2.6 yards')
    expect(formatSkillYards(2, tblEn)).toBe('1.3 yard')
  })
})

describe('skill tree tooltip (D2Client.dll 0x6FAE3550 / 0x6FAE3B50)', () => {
  it('#1569 dsc3 synergy block: green Sksyn header + "<skill>: +N% <textB>" lines', () => {
    const lines = tooltip(36, 1)
    const hdr = lines.find(l => l.text === 'Fire Bolt Receives Bonuses From:')!
    expect(hdr.color).toBe('green')
    expect(lines.map(l => l.text)).toContain('Fire Ball: +16% Fire Damage per Level')
    expect(lines.map(l => l.text)).toContain('Meteor: +16% Fire Damage per Level')
    // synergy block is the bottom of the tooltip
    expect(lines[lines.length - 1]!.text).toBe('Meteor: +16% Fire Damage per Level')
  })

  it('#1571 structure: green skill name, item/learned notices, no invented prerequisite lines', () => {
    const lines = tooltip(47, 0)
    expect(lines[0]!.text).toBe('You have not learned this skill yet')
    const name = lines.find(l => l.text === 'Fire Ball')!
    expect(name.color).toBe('green')
    expect(lines.some(l => /Required Skill|需要前置技能/.test(l.text))).toBe(false)
    expect(lines.map(l => l.text)).toContain('First Level')
  })

  it('#1573 required level uses skilldesc3 and reqlevel + base level', () => {
    expect(texts(47, 0)).toContain('Required Level : 12')
    expect(texts(47, 0).some(t => t.startsWith('Radius: ') && t.includes('Required'))).toBe(false)
  })

  it('#1575/#1576 mana is SkillDesc-driven: Fire Bolt dsc2 mana shows once, descline lines bottom-up', () => {
    const t = texts(36, 5)
    expect(t.filter(x => x.startsWith('Mana Cost: ')).length).toBe(1)
    const cur = t.indexOf('Current Skill Level: 5')
    const next = t.indexOf('Next Level')
    expect(next).toBeGreaterThanOrEqual(0)
    expect(cur).toBeLessThan(next) // Next Level block is appended first -> drawn below the current block
    // Double Swing has no type-1 line in SkillDesc -> no mana line at all
    expect(texts(133, 3).some(x => x.startsWith('Mana Cost'))).toBe(false)
    // Fire Ball: descline1 = mana -> last line of each level block
    const fb = texts(47, 3)
    const i = fb.indexOf('Current Skill Level: 3')
    expect(fb[i + 1]?.startsWith('Mana Cost: ') || fb.slice(i + 1).some(x => x.startsWith('Mana Cost: '))).toBe(true)
  })

  it('#1582 descline 8 "To Attack Rating: +N percent" comes from skill ToHit', () => {
    expect(texts(6, 1).some(x => /^To Attack Rating: \+\d+ percent$/.test(x))).toBe(true) // Magic Arrow
  })

  it('#1583 descline 11 only for cold/poison', () => {
    expect(texts(7, 3).some(x => x.startsWith('Duration'))).toBe(false) // Fire Arrow
    expect(texts(11, 3).some(x => x.startsWith('Cold Length: '))).toBe(true) // Cold Arrow
  })

  it('#1585 descline 31 divides by AiCurseDivisor of the difficulty', () => {
    const norm = texts(71, 1, 0).find(x => x.startsWith('Duration: '))!
    const hell = texts(71, 1, 2).find(x => x.startsWith('Duration: '))!
    expect(norm).not.toBe(hell)
  })

  it('#1586 descmissile-driven lines: Blizzard 4 seconds, Fire Ball radius 1 yard (Missiles+0x38 Param1, D2Common 0x6FDCCBEF), Fire Wall 3.6 seconds', () => {
    expect(texts(59, 1)).toContain('Duration: 4 seconds')
    expect(texts(47, 1)).toContain('Radius: 1 yard')
    expect(texts(51, 1).some(x => x.endsWith('3.6 seconds'))).toBe(true)
  })

  it('#1580/#1589 every SkillDesc record renders at levels 1/10/20 without placeholders', () => {
    for (const rec of Object.values(SKILL_DESC_BY_SKILL_ID)) {
      const sk = SKILLS_BY_ID[rec.skillId]
      if (!sk) continue
      for (const lvl of [1, 10, 20]) {
        for (const section of ['desc', 'dsc2', 'dsc3'] as const) {
          for (const l of evaluateSkillDescLines(stateWith(sk.classCode, { [sk.id]: lvl }), sk, lvl, section)) {
            expect(l.textEn, `${sk.id} ${section} ${l.lineType}`).not.toMatch(/undefined|NaN/)
            expect(l.textZh).not.toMatch(/undefined|NaN/)
          }
        }
      }
    }
    expect(SKILLS_CATALOG.length).toBeGreaterThan(200)
  })
})
