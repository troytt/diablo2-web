import { describe, expect, it } from 'vitest'
import { SKILL_DESC_BY_SKILL_ID, SKILL_DESC_FIXED_TBL } from '../src/common/data/skilldesc-table.ts'
import { SKILLS_BY_ID } from '../src/common/data/skills-catalog.ts'
import {
  createInitialState,
  evaluateSkillDescDam,
  evaluateSkillDescLines,
} from '../src/common/skills/skill-calc-engine.ts'
import { formatSkillDescLine, type SkillDescLineEnv } from '../src/common/skills/skilldesc-lines.ts'

describe('D2Client.dll SkillDesc parity (#1587, #1589, #1592)', () => {
  it('#1587: descline 13 (0x6FADEFD0 + D2Common.#11089) computes summon HP with difficulty scaling', () => {
    // Raise Skeleton (#70): MonStats.txt necroskeleton noRatio=1, Normal=21, Nightmare=30, Hell=42
    const necState = createInitialState('nec')
    necState.hardPoints[70] = 1
    const skel = SKILLS_BY_ID[70]!

    const normL1 = evaluateSkillDescLines(necState, skel, 1, 'desc', 0)
    const nmL1 = evaluateSkillDescLines(necState, skel, 1, 'desc', 1)
    const hellL1 = evaluateSkillDescLines(necState, skel, 1, 'desc', 2)
    expect(normL1.find(l => l.lineType === 13)?.textEn).toBe('Life: 21')
    expect(nmL1.find(l => l.lineType === 13)?.textEn).toBe('Life: 30')
    expect(hellL1.find(l => l.lineType === 13)?.textEn).toBe('Life: 42')

    // Clay Golem (#75): MonStats.txt ClayGolem Normal=100, Nightmare=175, Hell=275
    necState.hardPoints[75] = 1
    const clay = SKILLS_BY_ID[75]!
    expect(evaluateSkillDescLines(necState, clay, 1, 'desc', 0).find(l => l.lineType === 13)?.textEn).toBe('Life: 100')
    expect(evaluateSkillDescLines(necState, clay, 1, 'desc', 1).find(l => l.lineType === 13)?.textEn).toBe('Life: 175')
    expect(evaluateSkillDescLines(necState, clay, 1, 'desc', 2).find(l => l.lineType === 13)?.textEn).toBe('Life: 275')

    // Summon Grizzly (#247): MonStats.txt druidbear (550+750)/2 = 650 (in dsc2 slot 8)
    const druState = createInitialState('dru')
    druState.hardPoints[247] = 1
    const grizzly = SKILLS_BY_ID[247]!
    expect(evaluateSkillDescLines(druState, grizzly, 1, 'dsc2', 0).find(l => l.lineType === 13)?.textEn).toBe('Life: 650')
  })

  it('#1589: descline 17, 35, 37, 42, 43, 47, 48, 51, 57, 62, 74, 75 match 0x6FAE16C0 switch cases', () => {
    // descline 43 (0x6FADDE00 scale=10) & 38: Holy Fire (#102)
    const palState = createInitialState('pal')
    palState.hardPoints[102] = 1
    const holyFire = SKILLS_BY_ID[102]!
    const hfDesc = evaluateSkillDescLines(palState, holyFire, 1, 'desc', 0)
    expect(hfDesc.find(l => l.lineType === 43)?.textEn).toBe('Fire Damage: 1-3')
    expect(hfDesc.find(l => l.lineType === 38)?.textEn).toBe('Fire Damage: 6-18 to your attack')
    expect(hfDesc.find(l => l.lineType === 19)?.textEn).toBe('Radius: 4 yards')

    // descline 48 (0x6FAE0270): Blessed Hammer (#112) un-aura-boosted magic damage
    palState.hardPoints[112] = 1
    palState.hardPoints[113] = 20 // Concentration should NOT boost descline 48 in skill tree tooltip
    const hammer = SKILLS_BY_ID[112]!
    const bhDesc = evaluateSkillDescLines(palState, hammer, 1, 'desc', 0)
    expect(bhDesc.find(l => l.lineType === 48)?.textEn).toBe('Magic Damage: 12-16')

    // descline 51 (0x6FADDD50) with macr token: Sword Mastery (#127)
    const barState = createInitialState('bar')
    barState.hardPoints[127] = 1
    const swordMastery = SKILLS_BY_ID[127]!
    const smDesc = evaluateSkillDescLines(barState, swordMastery, 1, 'desc', 0)
    expect(smDesc.find(l => l.lineType === 51)?.textEn).toContain('Critical Strike')

    // descline 47 (0x6FADF520): Holy Bolt (#101)
    palState.hardPoints[101] = 1
    const holyBolt = SKILLS_BY_ID[101]!
    const hbDesc = evaluateSkillDescLines(palState, holyBolt, 1, 'desc', 0)
    expect(hbDesc.find(l => l.lineType === 47)?.textEn).toBe('Heals: 1-6')

    // descline 17 (Fists of Fire #259) & descline 62 (Claws of Thunder #269) & descline 42 (Wake of Inferno #272)
    const assState = createInitialState('ass')
    assState.hardPoints[259] = 1
    assState.hardPoints[269] = 1
    assState.hardPoints[272] = 1
    const fofDesc = evaluateSkillDescLines(assState, SKILLS_BY_ID[259]!, 1, 'desc', 0)
    const cotDesc = evaluateSkillDescLines(assState, SKILLS_BY_ID[269]!, 1, 'desc', 0)
    const woiSyn = evaluateSkillDescLines(assState, SKILLS_BY_ID[272]!, 1, 'dsc3', 0)
    expect(fofDesc.some(l => l.lineType === 17)).toBe(true)
    expect(cotDesc.some(l => l.lineType === 62)).toBe(true)
    expect(woiSyn.some(l => l.lineType === 42)).toBe(true)

    // Direct switch cases 35, 37, 57, 74, 75 in formatSkillDescLine
    const dummyEnv: SkillDescLineEnv = {
      lvl: 1,
      calcA: 6,
      calcB: 10,
      eType: 'fire',
      elemLengthFrames: 50,
      toHitPercent: 0,
      aiCurseDivisor: 1,
      mana: 0,
      lvlMana: 0,
      minMana: 0,
      manaShift: 8,
      bookQty: 12,
      tbl: (key: string) => SKILL_DESC_FIXED_TBL[key]?.en ?? key,
    }
    expect(
      formatSkillDescLine(
        { slot: 0, func: 35, textA: { key: 'a', en: 'Prefix', zh: '' }, textB: { key: 'b', en: 'Suffix', zh: '' } },
        dummyEnv,
        'en',
      )?.text,
    ).toBe('Prefix: 6-10')
    expect(
      formatSkillDescLine(
        { slot: 0, func: 37, textA: { key: 'StrSkill18', en: 'Radius: ', zh: '' } },
        { ...dummyEnv, calcA: 3 },
        'en',
      )?.text,
    ).toBe('Radius: 1 yard')
    expect(
      formatSkillDescLine(
        { slot: 0, func: 57, textA: { key: 'a', en: 'Duration: ', zh: '' } },
        { ...dummyEnv, calcA: 50 },
        'en',
      )?.text,
    ).toBe('Duration: +2 seconds')
    expect(
      formatSkillDescLine(
        { slot: 0, func: 74, textA: { key: 'a', en: 'Bonus: %+d%%', zh: '' } },
        dummyEnv,
        'en',
      )?.text,
    ).toBe('Bonus: +6%')
    expect(
      formatSkillDescLine(
        { slot: 0, func: 75, textA: { key: 'a', en: 'Damage: %d-%d', zh: '' } },
        dummyEnv,
        'en',
      )?.text,
    ).toBe('Damage: 6-10')
  })

  it('#1592: evaluateSkillDescDam evaluates descdam 1..24, ddamCalc1/2 (incl. clc1..4), and pdm[0..2]', () => {
    // Bash (#126): descdam=7, ddamCalc1="clc1" (ln12 + Stun.blvl * par8), ddamCalc2="ln34"
    const barState = createInitialState('bar')
    barState.hardPoints[126] = 5
    barState.hardPoints[139] = 4 // Stun
    const bash = SKILLS_BY_ID[126]!
    const bashDam = evaluateSkillDescDam(barState, bash, 5)
    expect(bashDam.descdam).toBe(7)
    expect(bashDam.ddamCalc1).toBe(50 + 4 * 5 + 4 * 5) // 90% ED
    expect(bashDam.ddamCalc2).toBe(1 + 4 * 1) // +5 flat damage

    // Fists of Fire (#259): descdam=20, pdm[0..2] with enma/exma and m1eo/m1ey
    const assState = createInitialState('ass')
    assState.hardPoints[259] = 1
    const fof = SKILLS_BY_ID[259]!
    const fofDam1 = evaluateSkillDescDam(assState, fof, 1, 1)
    const fofDam3 = evaluateSkillDescDam(assState, fof, 1, 3)
    expect(fofDam1.descdam).toBe(20)
    expect(fofDam1.pdm.length).toBe(3)
    expect(fofDam1.activeChargeElem).toEqual({ elem: 'fire', min: 6, max: 10 })
    expect(fofDam3.activeChargeElem?.min).toBeGreaterThan(fofDam1.activeChargeElem!.min)

    // Phoenix Strike (#280): descdam=18, pdm[0]=fire (m1en/m1ex), pdm[1]=ltng (m2en/m2ex), pdm[2]=cold (m3en/m3ex)
    assState.hardPoints[280] = 1
    const ps = SKILLS_BY_ID[280]!
    expect(evaluateSkillDescDam(assState, ps, 1, 1).activeChargeElem?.elem).toBe('fire')
    expect(evaluateSkillDescDam(assState, ps, 1, 2).activeChargeElem?.elem).toBe('ltng')
    expect(evaluateSkillDescDam(assState, ps, 1, 3).activeChargeElem?.elem).toBe('cold')

    // Every skill with descdam in SKILL_DESC_BY_SKILL_ID evaluates without error
    for (const rec of Object.values(SKILL_DESC_BY_SKILL_ID)) {
      if (!rec.descdam) continue
      const sk = SKILLS_BY_ID[rec.skillId]
      if (!sk) continue
      const st = createInitialState(sk.classCode ?? 'ama')
      st.hardPoints[sk.id] = 1
      const res = evaluateSkillDescDam(st, sk, 1)
      expect(res.descdam).toBe(rec.descdam)
    }
  })
})
