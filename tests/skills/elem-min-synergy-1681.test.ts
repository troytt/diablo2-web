/**
 * Issue #1681 — D2Common #10121 skill elemental min damage (0x6FDA0460) applies EDmgSymPerCalc only when
 * `min256 > 256 || EMinLev1 != 0` (0x6FDA04C7..0x6FDA04D3). The max side (#11091 0x6FDA0360) and the missile
 * path (0x6FDBB3F4) always apply it. Class sweep: the 13 Skills.txt rows with a flat minimum
 * (Power Strike, Lightning Bolt, Charged Strike, Lightning Strike, Lightning Fury, Lightning, Chain Lightning,
 * Holy Shock, Shock Field, Charged Bolt Sentry, Claws of Thunder, Lightning Sentry, Death Sentry).
 */
import { describe, expect, it } from 'vitest'
import { evaluateCalc, skillMinSynergyApplies113c } from '../../src/common/data/calc-ast.ts'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { SKILLS_BY_ID } from '../../src/common/data/skills-catalog.ts'
import { calculatePowerStrikeStats } from '../../src/common/skills/amazon-javelin-spear.ts'
import { calculateHolyShockStats } from '../../src/common/skills/paladin-auras.ts'
import {
  allocatePoint,
  calculateDetailedDamage,
  createInitialState,
} from '../../src/common/skills/skill-calc-engine.ts'
import { UnitStatList } from '../../src/server/engine/stat-list.ts'
import { calculateChainLightningDamage, calculateLightningDamage } from '../../src/server/engine/missile-engine.ts'
import { calcDeathSentry113c, calcLightningSentry113c, calcShockWeb113c } from '../../src/server/skills/assassin-traps.ts'
import { evaluateSkillCore113c } from '../../src/server/skills/registry.ts'

const FLAT_MIN_SKILLS = [14, 20, 24, 34, 35, 49, 53, 118, 256, 261, 269, 271, 276]

describe('issue #1681: flat elemental minimum is not synergised (D2Common 0x6FDA04C7)', () => {
  it('gate helper matches the binary comparison', () => {
    expect(skillMinSynergyApplies113c(256, 0)).toBe(false)
    expect(skillMinSynergyApplies113c(257, 0)).toBe(true)
    expect(skillMinSynergyApplies113c(256, 1)).toBe(true)
  })

  it('the Skills.txt class is exactly the 13 flat-minimum skills', async () => {
    const registry = await getSharedDataRegistry()
    const gated: number[] = []
    for (const s of [...registry.skillsById.values()].sort((a, b) => a.id - b.id)) {
      if (!s.eDmgSymPerCalc || !s.eMin) continue
      if (!skillMinSynergyApplies113c(s.eMin << s.hitShift, s.eMinLev1)) gated.push(s.id)
    }
    expect(gated).toEqual(FLAT_MIN_SKILLS)
  })

  it('server evaluateSkillCore113c keeps min256 = 256 for every flat-minimum skill with maxed synergies', async () => {
    const registry = await getSharedDataRegistry()
    for (const id of FLAT_MIN_SKILLS) {
      const skill = registry.getSkillById(id)!
      const statList = new UnitStatList()
      statList.setBaseSkillLevel(id, 20)
      // Max out every skill so any synergy formula is non-zero.
      for (const other of registry.skillsById.values()) if (other.id !== id && other.id < 281) statList.setBaseSkillLevel(other.id, 20)
      const r = evaluateSkillCore113c({ registry, skill, slvl: 20, blvl: 20, statList })
      expect({ id, min: r.minElemDmg256 }).toEqual({ id, min: skill.eMin << skill.hitShift })
      expect(r.maxElemDmg256).toBeGreaterThan(0)
      // calc-ast enms/enma follow the same gate
      const ctx = {
        registry,
        activeSkill: skill,
        slvl: 20,
        blvl: 20,
        getBaseSkillLevel: (sid: number) => statList.getBaseSkillLevel(sid),
        getEffectiveSkillLevel: (sid: number) => statList.getEffectiveSkillLevel(sid),
      }
      expect(evaluateCalc('enms', ctx)).toBe(skill.eMin << skill.hitShift)
    }
  })

  it('tooltip (calculateDetailedDamage): Lightning lvl 1 + 20 Charged Bolt shows min 1', () => {
    const state = createInitialState('sor')
    allocatePoint(state, 38, 20)
    allocatePoint(state, 49, 1)
    const d = calculateDetailedDamage(state, SKILLS_BY_ID[49]!, 1)
    expect(d.finalMin).toBe(1)
    expect(d.finalMax).toBeGreaterThan(40)
  })

  it('hand-written calculators keep the flat minimum', () => {
    expect(calculateLightningDamage(1, { chargedBolt: 20, chargedBoltPoints: 20 }).min).toBe(1)
    expect(calculateChainLightningDamage(1, { lightning: 20, lightningPoints: 20 }).min).toBe(1)
    expect(calculatePowerStrikeStats(1, { lightningStrike: 20, lightningBolt: 20, chargedStrike: 20, lightningFury: 20 }).minDamage).toBe(1)
    expect(calculateHolyShockStats(1, { resistLightning: 20, salvation: 20 }).pulseMin).toBe(1)
    expect(calcShockWeb113c(1, { chargedBoltSentryBlvl: 20, lightningSentryBlvl: 20, deathSentryBlvl: 20 }).minDmg).toBe(1)
    expect(calcLightningSentry113c(1, { shockWebBlvl: 20, chargedBoltSentryBlvl: 20, deathSentryBlvl: 20 }).minDmg).toBe(1)
    expect(calcDeathSentry113c(1, { lightningSentryBlvl: 20 }).minDmg).toBe(1)
  })
})
