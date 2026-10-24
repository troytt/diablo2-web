import { describe, it, expect } from 'vitest'
import {
  HIRELING_RECORDS,
  resolveHirelingAct,
  resolveHirelingName,
  resolveHirelingDesc,
  resolveHirelingCandidate,
  resolveHirelingCandidates,
  formatHirelingCandidateLines,
} from '../../src/common/units/hireling-table.ts'

describe('hireling-table (authoritative Diablo II v1.13c Hireling.txt / D2Common parity)', () => {
  it('loads all 120 compiled hireling records with valid attributes', () => {
    expect(HIRELING_RECORDS).toHaveLength(120)
    for (const r of HIRELING_RECORDS) {
      expect([0, 100]).toContain(r.version)
      expect([271, 338, 359, 561]).toContain(r.classId)
      expect([1, 2, 3, 5]).toContain(r.act)
      expect([1, 2, 3]).toContain(r.difficulty)
      expect([150, 198, 252, 515]).toContain(r.seller)
      expect(r.level).toBeGreaterThan(0)
      expect(r.hireCost).toBeGreaterThan(0)
      expect(r.hp).toBeGreaterThan(0)
      expect(r.skills.length).toBeGreaterThan(0)
    }
  })

  it('resolves act index from mercenary name ID matching D2Common_10988 (0x6fd7c9e0)', () => {
    // Act 1 Rogue (merc01..merc34 / global 3411..3444) -> act 0
    expect(resolveHirelingAct(3411, true)).toBe(0)
    expect(resolveHirelingAct(3444, true)).toBe(0)

    // Act 2 Desert Mercenary (merca201..merca221 / global 1019..1039) -> act 1
    expect(resolveHirelingAct(1019, true)).toBe(1)
    expect(resolveHirelingAct(1039, true)).toBe(1)

    // Act 3 Iron Wolf (merca222..merca241 / global 1040..1059) -> act 2
    expect(resolveHirelingAct(1040, true)).toBe(2)
    expect(resolveHirelingAct(1059, true)).toBe(2)
    expect(resolveHirelingAct(11021, true)).toBe(2) // Jarulf
    expect(resolveHirelingAct(0x0421, true)).toBe(2) // 1057 Jarulf legacy

    // Act 5 Barbarian (MercX101..MercX167 / global 10835..10901) -> act 4
    expect(resolveHirelingAct(10835, true)).toBe(4)
    expect(resolveHirelingAct(10901, true)).toBe(4)
  })

  it('resolves localized mercenary names in English and Chinese per D2Client.dll 0x6faf9783', () => {
    // Act 1
    expect(resolveHirelingName(3411, 'ENG')).toBe('Aliza')
    expect(resolveHirelingName(3411, 'CHI')).toBe('阿里撒')
    expect(resolveHirelingName(3444, 'ENG')).toBe('Ryann')
    expect(resolveHirelingName(3444, 'CHI')).toBe('萊恩')

    // Act 2
    expect(resolveHirelingName(1019, 'ENG')).toBe('Hazade')
    expect(resolveHirelingName(1019, 'CHI')).toBe('哈撒迪')
    expect(resolveHirelingName(1039, 'ENG')).toBe('Vikhyat')
    expect(resolveHirelingName(1039, 'CHI')).toBe('維克懷特')

    // Act 3
    expect(resolveHirelingName(1040, 'ENG')).toBe('Jelani')
    expect(resolveHirelingName(1040, 'CHI')).toBe('喬安妮')
    expect(resolveHirelingName(11021, 'ENG')).toBe('Jarulf')
    expect(resolveHirelingName(0x0421, 'ENG')).toBe('Jarulf')

    // Act 5
    expect(resolveHirelingName(10835, 'ENG')).toBe('Varaya')
    expect(resolveHirelingName(10835, 'CHI')).toBe('伐德哈卡')
    expect(resolveHirelingName(10901, 'ENG')).toBe('Theodoric')
    expect(resolveHirelingName(10901, 'CHI')).toBe('狄奧多理')
  })

  it('resolves ability descriptions matching D2Common_10091 (0x6fd7c9c0) in ENG and CHI', () => {
    expect(resolveHirelingDesc(1, 'ENG')).toBe('Fire Arrow')
    expect(resolveHirelingDesc(1, 'CHI')).toBe('火箭')

    expect(resolveHirelingDesc(2, 'ENG')).toBe('Cold Arrow')
    expect(resolveHirelingDesc(2, 'CHI')).toBe('冰箭')

    expect(resolveHirelingDesc(3, 'ENG')).toBe('Combat')
    expect(resolveHirelingDesc(3, 'CHI')).toBe('戰鬥')

    expect(resolveHirelingDesc(4, 'ENG')).toBe('Defensive')
    expect(resolveHirelingDesc(4, 'CHI')).toBe('防禦')

    expect(resolveHirelingDesc(5, 'ENG')).toBe('Offensive')
    expect(resolveHirelingDesc(5, 'CHI')).toBe('進攻')

    expect(resolveHirelingDesc(6, 'ENG')).toBe('Fire')
    expect(resolveHirelingDesc(6, 'CHI')).toBe('火')

    expect(resolveHirelingDesc(7, 'ENG')).toBe('Cold')
    expect(resolveHirelingDesc(7, 'CHI')).toBe('冷')

    expect(resolveHirelingDesc(8, 'ENG')).toBe('Lightning')
    expect(resolveHirelingDesc(8, 'CHI')).toBe('閃電')

    expect(resolveHirelingDesc(0, 'ENG')).toBe('')
    expect(resolveHirelingDesc(0, 'CHI')).toBe('')
  })

  it('formats candidate lines per D2Client.dll 0x6faf9440', () => {
    const eng = formatHirelingCandidateLines('Aliza', 8, 90, 55, 175, 'Fire Arrow', 'ENG')
    expect(eng.line1).toBe('Aliza - Lvl: 8  Life: 90  Def: 55  Cost: 175')
    expect(eng.line2).toBe('  Fire Arrow')

    const chi = formatHirelingCandidateLines('阿里撒', 8, 90, 55, 175, '火箭', 'CHI')
    expect(chi.line1).toBe('阿里撒 - 等級: 8  生命: 90  防禦: 55  花費: 175')
    expect(chi.line2).toBe('  火箭')

    const blankSpecial = formatHirelingCandidateLines('Varaya', 30, 320, 200, 9200, '', 'ENG')
    expect(blankSpecial.line2).toBe('  ')
  })

  it('computes exact 64-bit LCG stats matching D2Common_10458 across difficulties', () => {
    // Act 1 Rogue (Normal, seed 0x1234, playerLevel 10)
    const c1 = resolveHirelingCandidate({ nameId: 3411, seed: 0x1234 }, 10, 0, 0, true, 'ENG')
    expect(c1.name).toBe('Aliza')
    expect(c1.actIndex).toBe(0)
    expect(c1.classId).toBe(271)
    expect(c1.level).toBe(8)
    expect(c1.hp).toBe(90)
    expect(c1.defense).toBe(55)
    expect(c1.strength).toBe(41)
    expect(c1.dexterity).toBe(55)
    expect(c1.cost).toBe(175)
    expect(c1.hireDesc).toBe('Fire Arrow')

    // Act 2 Desert Mercenary (Nightmare, seed 0x5678, playerLevel 50)
    const c2 = resolveHirelingCandidate({ nameId: 1019, seed: 0x5678 }, 50, 1, 1, true, 'ENG')
    expect(c2.name).toBe('Hazade')
    expect(c2.actIndex).toBe(1)
    expect(c2.classId).toBe(338)
    expect(c2.level).toBeGreaterThanOrEqual(45)
    expect(c2.cost).toBeGreaterThan(5000)
    expect(['Combat', 'Defensive', 'Offensive']).toContain(c2.hireDesc)

    // Act 5 Barbarian (Normal, seed 0x9abc, playerLevel 35)
    const c5 = resolveHirelingCandidate({ nameId: 10835, seed: 0x9abc }, 35, 0, 4, true, 'ENG')
    expect(c5.name).toBe('Varaya')
    expect(c5.actIndex).toBe(4)
    expect(c5.classId).toBe(561)
    expect(c5.level).toBeGreaterThanOrEqual(30)
    expect(c5.cost).toBeGreaterThanOrEqual(9000)
    expect(c5.hireDesc).toBe('')
  })

  it('resolveHirelingCandidates maps candidate list cleanly', () => {
    const raw = [
      { nameId: 3411, seed: 0x1111 },
      { nameId: 3412, seed: 0x2222 },
      { nameId: 3413, seed: 0x3333 },
    ]
    const res = resolveHirelingCandidates(raw, 12, 0, 0, true, 'CHI')
    expect(res).toHaveLength(3)
    expect(res[0]!.nameId).toBe(3411)
    expect(res[1]!.nameId).toBe(3412)
    expect(res[2]!.nameId).toBe(3413)
    expect(res[0]!.line1).toContain('等級:')
  })
})
