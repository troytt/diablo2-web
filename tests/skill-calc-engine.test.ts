import { describe, it, expect, beforeEach } from 'vitest'
import {
  createInitialState,
  getEffectiveLevel,
  getTotalPointsSpent,
  getTabPointsSpent,
  getRequiredCharacterLevel,
  canAllocate,
  allocatePoint,
  canDeallocate,
  deallocatePoint,
  respec,
  evaluateSynergies,
  evaluateMasteries,
  calculateManaCost,
  calculateDetailedDamage,
  buildTooltipViewModel,
  serializeBuildToHash,
  deserializeBuildFromHash,
  type SkillCalcState,
} from '../src/common/skills/skill-calc-engine.ts'
import { SKILLS_BY_ID, SKILLS_BY_CLASS } from '../src/common/data/skills-catalog.ts'

describe('Diablo II Skill Calculator Engine (Issue #26)', () => {
  let state: SkillCalcState

  beforeEach(() => {
    state = createInitialState('sor')
  })

  describe('Point Allocation & Deallocation State Machine (Left Click / Right Click)', () => {
    it('allocates points to level 1 skill with 0 prerequisites', () => {
      // Fire Bolt (id 36): reqlevel 1, no prereqs
      expect(canAllocate(state, 36)).toBe(true)
      expect(allocatePoint(state, 36)).toBe(true)
      expect(state.hardPoints[36]).toBe(1)
      expect(getTotalPointsSpent(state)).toBe(1)
      expect(getTabPointsSpent(state, 0)).toBe(1) // Fire Spells is tab 0
    })

    it('rejects allocation when direct prerequisites are not met', () => {
      // Fire Ball (id 47): requires Fire Bolt (36)
      expect(canAllocate(state, 47)).toBe(false)
      expect(allocatePoint(state, 47)).toBe(false)
      expect(state.hardPoints[47]).toBeUndefined()

      // Now allocate Fire Bolt
      allocatePoint(state, 36)
      expect(canAllocate(state, 47)).toBe(true)
      expect(allocatePoint(state, 47)).toBe(true)
      expect(state.hardPoints[47]).toBe(1)
    })

    it('caps hard points at exactly 20 per skill', () => {
      allocatePoint(state, 36, 25)
      expect(state.hardPoints[36]).toBe(20)
      expect(canAllocate(state, 36)).toBe(false)
    })

    it('deallocates points correctly (right click)', () => {
      allocatePoint(state, 36, 5)
      expect(state.hardPoints[36]).toBe(5)

      expect(deallocatePoint(state, 36)).toBe(true)
      expect(state.hardPoints[36]).toBe(4)

      // Deallocate all remaining
      expect(deallocatePoint(state, 36, 4)).toBe(true)
      expect(state.hardPoints[36]).toBeUndefined()
      expect(getTotalPointsSpent(state)).toBe(0)
    })

    it('prevents deallocation when active dependent skills exist (orphan protection)', () => {
      // Fire Bolt (36) -> Fire Ball (47) -> Meteor (56)
      allocatePoint(state, 36, 1)
      allocatePoint(state, 47, 1)

      // Reducing Fire Bolt above 1 is allowed
      allocatePoint(state, 36, 4)
      expect(canDeallocate(state, 36)).toBe(true) // 5 -> 4
      deallocatePoint(state, 36, 4)
      expect(state.hardPoints[36]).toBe(1)

      // Reducing Fire Bolt from 1 to 0 while Fire Ball has 1 point MUST be rejected
      expect(canDeallocate(state, 36)).toBe(false)
      expect(deallocatePoint(state, 36)).toBe(false)
      expect(state.hardPoints[36]).toBe(1)

      // Deallocate Fire Ball first, then Fire Bolt can be removed
      expect(deallocatePoint(state, 47)).toBe(true)
      expect(canDeallocate(state, 36)).toBe(true)
      expect(deallocatePoint(state, 36)).toBe(true)
      expect(state.hardPoints[36]).toBeUndefined()
    })

    it('respec refunds all allocated points cleanly', () => {
      allocatePoint(state, 36, 20)
      allocatePoint(state, 47, 20)
      expect(getTotalPointsSpent(state)).toBe(40)

      const refunded = respec(state)
      expect(refunded).toBe(40)
      expect(getTotalPointsSpent(state)).toBe(0)
      expect(Object.keys(state.hardPoints)).toHaveLength(0)
    })
  })

  describe('Character Level Requirement Calculation', () => {
    it('calculates minimum level based on highest reqlevel and hard points', () => {
      // Level 1 skill with 1 point: min level = 1
      allocatePoint(state, 36, 1)
      expect(getRequiredCharacterLevel(state)).toBe(1)

      // Level 1 skill with 20 points: requires at least character level 20
      allocatePoint(state, 36, 19)
      expect(getRequiredCharacterLevel(state)).toBe(20)

      // Meteor (56): reqlevel 24. With 1 point: min level 24
      // Prereqs: Fire Bolt (36) -> Fire Ball (47) -> Meteor (56) and Inferno (41) -> Blaze (46) -> Fire Wall (51) -> Meteor
      allocatePoint(state, 47, 1)
      allocatePoint(state, 41, 1)
      allocatePoint(state, 46, 1)
      allocatePoint(state, 51, 1)
      allocatePoint(state, 56, 1)
      expect(getRequiredCharacterLevel(state)).toBe(24)

      // Meteor with 10 hard points: requires 24 + 9 = 33
      allocatePoint(state, 56, 9)
      expect(getRequiredCharacterLevel(state)).toBe(33)
    })
  })

  describe('1.13c Synergy Engine (blvl Invariant & Scaling)', () => {
    it('evaluates Fire Ball synergies strictly from hard points of Fire Bolt and Meteor', () => {
      const fb = SKILLS_BY_ID[47]! // Fire Ball
      expect(fb).toBeDefined()

      // Initial: 0 points in Fire Bolt and Meteor => synergy bonus = 0%
      let syn = evaluateSynergies(state, fb)
      expect(syn.totalPercent).toBe(0)
      expect(syn.multiplier).toBe(1.0)

      // Invest 10 points in Fire Bolt (14% per point)
      allocatePoint(state, 36, 10)
      syn = evaluateSynergies(state, fb)
      expect(syn.totalPercent).toBe(140)
      expect(syn.multiplier).toBe(2.4)

      // Invest 20 points in Meteor (14% per point)
      // Meteor requires Fire Ball (47) and Fire Wall (51)
      allocatePoint(state, 47, 1)
      allocatePoint(state, 41, 1)
      allocatePoint(state, 46, 1)
      allocatePoint(state, 51, 1)
      allocatePoint(state, 56, 20)
      syn = evaluateSynergies(state, fb)
      // 10 * 14 + 20 * 14 = 140 + 280 = 420%
      expect(syn.totalPercent).toBe(420)
      expect(syn.multiplier).toBe(5.2)

      // Soft points (+skills) MUST NOT increase synergy bonus!
      state.allSkillsSoftPoints = 10
      state.tabSoftPoints[0] = 5
      syn = evaluateSynergies(state, fb)
      expect(syn.totalPercent).toBe(420) // Unchanged!
      expect(syn.multiplier).toBe(5.2)
    })
  })

  describe('Mastery Calculation (Sorceress, Paladin, Assassin)', () => {
    it('calculates Sorceress Fire Mastery amplification', () => {
      const fb = SKILLS_BY_ID[47]!
      // Fire Mastery (61): level 1 = 30%, level 20 = 30 + 7*19 = 163%
      allocatePoint(state, 61, 20)
      const mastery = evaluateMasteries(state, fb)
      expect(mastery).not.toBeNull()
      expect(mastery?.active).toBe(true)
      expect(mastery?.bonusPercent).toBe(163)
      expect(mastery?.multiplier).toBe(2.63)

      // With +2 all skills: effective level becomes 22 => 30 + 7*21 = 177%
      state.allSkillsSoftPoints = 2
      const masteryWithSoft = evaluateMasteries(state, fb)
      expect(masteryWithSoft?.effectiveLevel).toBe(22)
      expect(masteryWithSoft?.bonusPercent).toBe(177)
    })

    it('calculates Paladin Concentration bonus to Blessed Hammer (at 50% effectiveness)', () => {
      const palState = createInitialState('pal')
      const hammer = SKILLS_BY_ID[112]!

      // Concentration (113): level 20 grants +60% + 15%*19 = 345%.
      // Blessed Hammer receives half: Math.floor(345 / 2) = 172%
      palState.hardPoints[113] = 20
      const mastery = evaluateMasteries(palState, hammer)
      expect(mastery).not.toBeNull()
      expect(mastery?.active).toBe(true)
      expect(mastery?.bonusPercent).toBe(172)
      expect(mastery?.multiplier).toBe(2.72)
    })
  })

  describe('Mana Cost Formula Evaluation', () => {
    it('evaluates Teleport mana cost clamping at minmana = 1', () => {
      const tp = SKILLS_BY_ID[54]! // Teleport: mana 24, lvlmana -1, minmana 1
      expect(calculateManaCost(tp, 1)).toBe(24)
      expect(calculateManaCost(tp, 10)).toBe(15)
      expect(calculateManaCost(tp, 24)).toBe(1)
      expect(calculateManaCost(tp, 30)).toBe(1) // Clamped at minmana 1
    })

    it('evaluates Magic Arrow mana cost scaling to 0', () => {
      const amaState = createInitialState('ama')
      const ma = SKILLS_BY_ID[6]! // Magic Arrow: mana 12, lvlmana -1, manashift 5 (shift factor 0.125)
      // Level 1: 12 * 0.125 = 1.5
      expect(calculateManaCost(ma, 1)).toBe(1.5)
      // Level 13: (12 - 12) * 0.125 = 0
      expect(calculateManaCost(ma, 13)).toBe(0)
    })
  })

  describe('Detailed Damage Calculation', () => {
    it('calculates Fire Ball damage with base, synergy, and mastery multipliers', () => {
      const fb = SKILLS_BY_ID[47]!

      // Level 1 Fire Ball with 0 synergies, 0 mastery
      // Base: EMin=12, EMax=28, HitShift=7 (shift factor 0.5)
      // baseMin = 12 * 0.5 = 6, baseMax = 28 * 0.5 = 14
      let dmg = calculateDetailedDamage(state, fb, 1)
      expect(dmg.hasDamage).toBe(true)
      expect(dmg.type).toBe('fire')
      expect(dmg.baseMin).toBe(6)
      expect(dmg.baseMax).toBe(14)
      expect(dmg.finalMin).toBe(6)
      expect(dmg.finalMax).toBe(14)

      // Add 20 points to Fire Bolt (synergy: +280%)
      allocatePoint(state, 36, 20)
      dmg = calculateDetailedDamage(state, fb, 1)
      // Multiplier = 1.0 + 2.80 = 3.80
      // withSynergyMin = floor(6 * 3.80) = 22
      // withSynergyMax = floor(14 * 3.80) = 53
      expect(dmg.synergyBonusPct).toBe(280)
      expect(dmg.withSynergyMin).toBe(22)
      expect(dmg.withSynergyMax).toBe(53)

      // Add 20 points to Fire Mastery (+163%)
      allocatePoint(state, 61, 20)
      dmg = calculateDetailedDamage(state, fb, 1)
      // Mastery multiplier = 2.63
      // finalMin = floor(22 * 2.63) = 57
      // finalMax = floor(53 * 2.63) = 139
      expect(dmg.masteryBonusPct).toBe(163)
      expect(dmg.finalMin).toBe(57)
      expect(dmg.finalMax).toBe(139)
    })
  })

  describe('Tooltip View Model Builder', () => {
    it('builds complete tooltip model with localized names, requirements, mana, and synergy status', () => {
      const vm = buildTooltipViewModel(state, 47, 99)
      expect(vm).not.toBeNull()
      expect(vm?.skill.name).toBe('Fire Ball')
      expect(vm?.skill.nameZh).toBe('火球')
      expect(vm?.reqlevel).toBe(12)
      expect(vm?.levelMet).toBe(true)
      expect(vm?.prereqs).toHaveLength(1) // Requires Fire Bolt
      expect(vm?.prereqs[0].name).toBe('Fire Bolt')
      expect(vm?.prereqs[0].met).toBe(false)
      expect(vm?.current.damage.hasDamage).toBe(true)
      // For slvl === 0 (unlearned), nextLevel must be null while main body previews Lv 1
      expect(vm?.isLearned).toBe(false)
      expect(vm?.current.level).toBe(1)
      expect(vm?.nextLevel).toBeNull()
    })

    it('previews nextLevel when learned (slvl >= 1) and hardPoints < 20', () => {
      allocatePoint(state, 36, 1) // Fire Bolt prerequisite
      allocatePoint(state, 47, 5) // Fire Ball lvl 5
      state.allSkillsSoftPoints = 2 // +2 from gear -> effLevel 7
      const vm = buildTooltipViewModel(state, 47, 99)
      expect(vm).not.toBeNull()
      expect(vm?.isLearned).toBe(true)
      expect(vm?.hardPoints).toBe(5)
      expect(vm?.effectiveLevel).toBe(7)
      expect(vm?.current.level).toBe(7)
      expect(vm?.nextLevel).not.toBeNull()
      expect(vm?.nextLevel?.level).toBe(8)
      expect(vm?.nextLevel?.damage.finalMin).toBeGreaterThan(vm!.current.damage.finalMin)
    })

    it('omits nextLevel preview when skill has reached maximum base allocation (hardPoints === 20)', () => {
      allocatePoint(state, 36, 1)
      allocatePoint(state, 47, 20) // Max 20 hard points
      state.allSkillsSoftPoints = 5 // +5 gear -> effLevel 25
      const vm = buildTooltipViewModel(state, 47, 99)
      expect(vm).not.toBeNull()
      expect(vm?.isLearned).toBe(true)
      expect(vm?.hardPoints).toBe(20)
      expect(vm?.effectiveLevel).toBe(25)
      expect(vm?.current.level).toBe(25)
      expect(vm?.nextLevel).toBeNull()
    })

    it('evaluates authentic 1.13c Attack Rating (ToHit) scaling for combat skills', () => {
      // Jab (10): ToHit = 10, LevToHit = 9 -> 10 + (lvl - 1) * 9
      const amaState = createInitialState('ama')
      amaState.hardPoints[10] = 1
      let vmLvl1 = buildTooltipViewModel(amaState, 10, 99)
      let arLine1 = vmLvl1?.current.effects.find(e => e.textZh.includes('準確率') || e.textZh.includes('准确率'))
      expect(arLine1?.textZh).toBe('準確率：+10%')

      amaState.hardPoints[10] = 10
      let vmLvl10 = buildTooltipViewModel(amaState, 10, 99)
      let arLine10 = vmLvl10?.current.effects.find(e => e.textZh.includes('準確率') || e.textZh.includes('准确率'))
      expect(arLine10?.textZh).toBe('準確率：+91%')

      amaState.hardPoints[10] = 20
      let vmLvl20 = buildTooltipViewModel(amaState, 10, 99)
      let arLine20 = vmLvl20?.current.effects.find(e => e.textZh.includes('準確率') || e.textZh.includes('准确率'))
      expect(arLine20?.textZh).toBe('準確率：+181%')

      // Zeal (106): ToHit = 10, LevToHit = 10 -> 10 + (lvl - 1) * 10 = +200%
      const palState = createInitialState('pal')
      palState.hardPoints[106] = 20
      const vmZeal = buildTooltipViewModel(palState, 106, 99)
      const zealAr = vmZeal?.current.effects.find(e => e.textZh.includes('攻擊加成') || e.textZh.includes('準確率'))
      expect(zealAr?.textZh).toBe('攻擊加成：+200%')

      // Sacrifice (96): ToHit = 20, LevToHit = 7 -> 20 + (lvl - 1) * 7 = +83%
      palState.hardPoints[96] = 10
      const vmSacrifice = buildTooltipViewModel(palState, 96, 99)
      const sacAr = vmSacrifice?.current.effects.find(e => e.textZh.includes('準確率'))
      expect(sacAr?.textZh).toBe('變動準確率：+83%')
    })

    it('evaluates authentic 1.13c Shout warcry duration using Param3/Param4 (ln34)', () => {
      const barState = createInitialState('bar')
      barState.hardPoints[138] = 1 // Shout Level 1: Param3 = 500 frames = 20 seconds
      let vmShout = buildTooltipViewModel(barState, 138, 99)
      let durLine = vmShout?.current.effects.find(e => e.lineType === 12)
      expect(durLine?.textZh).toBe('持續：20 秒')

      barState.hardPoints[138] = 20 // Shout Level 20: 500 + 19 * 250 = 5250 frames = 210 seconds
      vmShout = buildTooltipViewModel(barState, 138, 99)
      durLine = vmShout?.current.effects.find(e => e.lineType === 12)
      expect(durLine?.textZh).toBe('持續：210 秒')
    })

    it('strictly enforces that synergies ignore soft gear points (1.13c Marrowwalk fix)', () => {
      const sorState1 = createInitialState('sor')
      sorState1.hardPoints[36] = 20 // 20 hard points in Fire Bolt
      const vmHard = buildTooltipViewModel(sorState1, 47, 99)
      const synHard = vmHard?.synergiesReceived.find(s => s.providerId === 36)
      expect(synHard?.hardPoints).toBe(20)
      expect(synHard?.currentBonusPct).toBe(280) // 20 * 14% = 280%

      const sorState2 = createInitialState('sor')
      sorState2.hardPoints[36] = 0 // 0 hard points
      sorState2.allSkillsSoftPoints = 20 // +20 soft points from gear
      const vmSoft = buildTooltipViewModel(sorState2, 47, 99)
      const synSoft = vmSoft?.synergiesReceived.find(s => s.providerId === 36)
      expect(synSoft?.hardPoints).toBe(0)
      expect(synSoft?.currentBonusPct).toBe(0) // Soft points give 0% synergy
    })
  })

  describe('Authentic Diablo II Tooltip Display Rules (Issue #26 Fidelity)', () => {
    it('strictly hides direct attack damage for non-damage skills', () => {
      // Warmth (37), Amplify Damage (66), Raise Skeleton (70), Fanaticism (122), Battle Orders (149), Valkyrie (32)
      const nonDamageSkillIds = [37, 66, 70, 122, 149, 32, 75, 87, 138, 247]
      for (const id of nonDamageSkillIds) {
        const skill = SKILLS_BY_ID[id]!
        expect(skill.descdam).toBe('')
        const dmg = calculateDetailedDamage(state, skill, 20)
        expect(dmg.hasDamage).toBe(false)
        expect(dmg.baseMin).toBe(0)
        expect(dmg.baseMax).toBe(0)
        expect(dmg.finalMin).toBe(0)
        expect(dmg.finalMax).toBe(0)
      }
    })

    it('evaluates Warmth mana recovery rate effect without damage', () => {
      const warmth = SKILLS_BY_ID[37]!
      const sorState = createInitialState('sor')
      sorState.hardPoints[37] = 20
      const vm = buildTooltipViewModel(sorState, 37, 99)
      expect(vm).not.toBeNull()
      expect(vm?.current.damage.hasDamage).toBe(false)
      expect(vm?.current.effects.length).toBeGreaterThan(0)
      const effect = vm?.current.effects[0]
      expect(effect?.textZh).toBe('法力回復速度：+258%')
      expect(effect?.textEn).toBe('Mana Recovery Rate: +258%')
    })

    it('evaluates Raise Skeleton minion stats (count, life, defense, attack, damage)', () => {
      const necState = createInitialState('nec')
      necState.hardPoints[70] = 20 // Raise Skeleton 20
      necState.hardPoints[69] = 20 // Skeleton Mastery 20
      const vm = buildTooltipViewModel(necState, 70, 99)
      expect(vm).not.toBeNull()
      expect(vm?.current.damage.hasDamage).toBe(false)
      expect(vm?.current.effects.length).toBeGreaterThanOrEqual(5)

      // Find total skeletons line: (lvl < 4) ? lvl : (2 + lvl/3)
      const totalSkeletons = vm?.current.effects.find(e => e.lineType === 36)
      expect(totalSkeletons).toBeDefined()
      expect(totalSkeletons?.value).toBe(8) // (2 + 20/3) = 8 skeletons

      // Verify low-level ternary threshold: lvl 1 -> 1, lvl 2 -> 2, lvl 3 -> 3, lvl 4 -> 3
      for (const [lvl, expectedCount] of [
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 3],
      ] as const) {
        necState.hardPoints[70] = lvl
        const vmLow = buildTooltipViewModel(necState, 70, 99)
        expect(vmLow?.current.effects.find(e => e.lineType === 36)?.value).toBe(expectedCount)
      }
      necState.hardPoints[70] = 20

      // Find skeleton life line (minHP 21 + Mastery bonus + Raise bonus: (lvl < 4) ? 0 : (par2 * (lvl - 3)))
      const lifeLine = vm?.current.effects.find(e => e.lineType === 13)
      expect(lifeLine).toBeDefined()
      expect(lifeLine?.value).toBe(850) // par2(50) * (20 - 3) = 850%
      expect(lifeLine?.textZh).toMatch(/生命：\d+/)

      // Find skeleton damage line (lineType 34)
      const dmgLine = vm?.current.effects.find(e => e.lineType === 34)
      expect(dmgLine).toBeDefined()
      expect(dmgLine?.textZh).toMatch(/傷害：\d+ - \d+/)

      // Verify Raise Skeletal Mage (80) also evaluates (lvl < 4) ? lvl : (2 + lvl/3) = 8 at lvl 20
      necState.hardPoints[80] = 20
      const vmMage = buildTooltipViewModel(necState, 80, 99)
      expect(vmMage?.current.effects.find(e => e.lineType === 36)?.value).toBe(8)
    })

    it('evaluates Battle Orders buff effects (max mana, life, stamina % and duration)', () => {
      const barState = createInitialState('bar')
      barState.hardPoints[149] = 20
      const vm = buildTooltipViewModel(barState, 149, 99)
      expect(vm).not.toBeNull()
      expect(vm?.current.damage.hasDamage).toBe(false)

      // ln34 = par3 + (lvl - 1) * par4 = 35 + 19 * 3 = 92%
      const manaLine = vm?.current.effects.find(e => e.textZh.includes('法力最大值'))
      const lifeLine = vm?.current.effects.find(e => e.textZh.includes('生命最大值'))
      const staminaLine = vm?.current.effects.find(e => e.textZh.includes('耐力最大值'))
      const durationLine = vm?.current.effects.find(e => e.lineType === 12)

      expect(manaLine?.textZh).toBe('法力最大值：+92%')
      expect(lifeLine?.textZh).toBe('生命最大值：+92%')
      expect(staminaLine?.textZh).toBe('耐力最大值：+92%')
      expect(durationLine?.textZh).toBe('持續：220 秒')
    })

    it('evaluates Fanaticism aura effects (attack speed, attack rating, your damage, party damage, radius)', () => {
      const palState = createInitialState('pal')
      palState.hardPoints[122] = 20
      const vm = buildTooltipViewModel(palState, 122, 99)
      expect(vm).not.toBeNull()
      expect(vm?.current.damage.hasDamage).toBe(false)

      const arLine = vm?.current.effects.find(e => e.textZh.includes('準確率：'))
      const asLine = vm?.current.effects.find(e => e.textZh.includes('攻擊速度：'))
      const yourDmgLine = vm?.current.effects.find(e => e.textZh.includes('你的傷害:'))
      const partyDmgLine = vm?.current.effects.find(e => e.textZh.includes('團隊傷害:'))
      const radiusLine = vm?.current.effects.find(e => e.lineType === 19)

      expect(arLine?.textZh).toBe('準確率：+135%')
      expect(asLine?.textZh).toBe('攻擊速度：+35%')
      expect(yourDmgLine?.textZh).toBe('你的傷害:+373%')
      expect(partyDmgLine?.textZh).toBe('團隊傷害:+186%')
      expect(radiusLine?.textZh).toBe('半徑：20.0 碼')
    })

    it('evaluates Valkyrie minion stats (defense bonus, attack rating, damage %, life)', () => {
      const amaState = createInitialState('ama')
      amaState.hardPoints[32] = 20
      const vm = buildTooltipViewModel(amaState, 32, 99)
      expect(vm).not.toBeNull()
      expect(vm?.current.damage.hasDamage).toBe(false)

      const defLine = vm?.current.effects.find(e => e.textZh.includes('防禦加成：'))
      const atkLine = vm?.current.effects.find(e => e.textZh.includes('準確率：'))
      const dmgLine = vm?.current.effects.find(e => e.textZh.includes('傷害'))
      const lifeLine = vm?.current.effects.find(e => e.lineType === 13)

      expect(defLine).toBeDefined()
      expect(atkLine).toBeDefined()
      expect(dmgLine).toBeDefined()
      expect(lifeLine?.textZh).toMatch(/生命：\d+/)
    })
  })

  describe('URL Hash Build Serialization & Sharing', () => {
    it('serializes and deserializes a build accurately', () => {
      allocatePoint(state, 36, 20) // Fire Bolt
      allocatePoint(state, 47, 20) // Fire Ball
      state.allSkillsSoftPoints = 3
      state.tabSoftPoints[0] = 2

      const hash = serializeBuildToHash(state)
      expect(hash).toContain('c=sor')
      expect(hash).toContain('36:20')
      expect(hash).toContain('47:20')

      const restored = deserializeBuildFromHash(hash)
      expect(restored).not.toBeNull()
      expect(restored?.classCode).toBe('sor')
      expect(restored?.hardPoints[36]).toBe(20)
      expect(restored?.hardPoints[47]).toBe(20)
      expect(restored?.allSkillsSoftPoints).toBe(3)
      expect(restored?.tabSoftPoints[0]).toBe(2)
    })
  })

  describe('Paladin Holy Fire/Freeze/Shock & SkillDesc lineType 43/49/50/59/72/73', () => {
    it('formats Holy Fire (#102) lineType 43 by dividing 256ths edns/edxs instead of +27468', () => {
      const palState = createInitialState('pal')
      palState.hardPoints[98] = 1
      palState.hardPoints[102] = 20
      palState.hardPoints[100] = 20 // Resist Fire (+360%)
      palState.hardPoints[125] = 20 // Salvation (+120%)
      const vm = buildTooltipViewModel(palState, 102)
      expect(vm).not.toBeNull()
      const line43 = vm?.current.effects.find(e => e.lineType === 43)
      const line38 = vm?.current.effects.find(e => e.lineType === 38)
      expect(line43?.textZh).toBe('火焰傷害：107 - 118')
      expect(line43?.textEn).toBe('Fire Damage: 107-118')
      expect(line38?.textZh).toBe('火焰傷害：643 - 713對你的攻擊')
      expect(line38?.textEn).toBe('Fire Damage: 643-713 to your attack')
    })

    it('formats Holy Shield (#117 lt 49), Fist of the Heavens (#121 lt 50), Wake of Inferno (#272 lt 59), and Weapon Damage fractions (lt 72/73)', () => {
      const palState = createInitialState('pal')
      palState.hardPoints[117] = 20
      palState.hardPoints[101] = 20
      palState.hardPoints[121] = 20
      const hsVm = buildTooltipViewModel(palState, 117)
      expect(hsVm?.current.effects.find(e => e.lineType === 49)?.textZh).toBe('重擊傷害：+57 - 60')
      const fohVm = buildTooltipViewModel(palState, 121)
      expect(fohVm?.current.effects.find(e => e.lineType === 50)?.textZh).toBe('聖光彈的傷害：904 - 944')

      const assState = createInitialState('ass')
      assState.hardPoints[272] = 20
      const woiVm = buildTooltipViewModel(assState, 272)
      expect(woiVm?.current.effects.find(e => e.lineType === 59)?.textZh).toBe('每秒平均火焰傷害：214 - 249')
      expect(woiVm?.current.effects.find(e => e.lineType === 72 || e.lineType === 73)).toBeUndefined()

      assState.hardPoints[266] = 1
      const bfVm = buildTooltipViewModel(assState, 266)
      expect(bfVm?.current.effects.find(e => e.lineType === 72)?.textZh).toBe('3/4 武器傷害')

      const amaState = createInitialState('ama')
      amaState.hardPoints[12] = 1
      const msVm = buildTooltipViewModel(amaState, 12)
      expect(msVm?.current.effects.find(e => e.lineType === 73)?.textZh).toBe('3/4 武器傷害')
    })
  })
})
