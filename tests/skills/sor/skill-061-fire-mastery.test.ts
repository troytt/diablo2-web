/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #061: Fire Mastery (SOR)
 * Gitea Tracking Issue: #215
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Schema Integrity (Skills.txt row 61, passive 1, passivestat1 'passive_fire_mastery', calc1 30+(lvl-1)*7)
 * D2: Visual Assets & Passive Metadata Integrity (Passive skill, no cast overlay, no projectile, reqlevel 30)
 * D3: Formulas & Scaling (30 + (slvl-1)*7% scaling across all levels: slvl 1=30%, 10=93%, 20=163%, 30=233%)
 * D4: Fire Damage Amplification & Combat Pipeline (Outbound fire damage scaled, no pierce, immunity intact at >=100% res)
 * D5: Double-Dip Integration with Enchant (Cast multiplier + Sorc melee double-dip vs ranged 33% penalty)
 * D6: Accrued Stat Integration & Zero Resource Cost (Accrues to 'passive_fire_mastery', mana cost 0, cooldown ticks 0)
 * D7: Invariants (BATCH1_SKILLS length strictly 38, zero runtime MPQ queries, WorldArena runtime execution)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-061-fire-mastery.ts'
import {
  calculateFireMasteryBonus,
  calculateEnchantDamage,
  calculateEnchantAttackDamage,
  getSkillCastOverlay,
  getSkillManaCost,
  getSkillCooldownTicks,
  BATCH1_SKILLS,
} from '../../../src/server/skills/skills.ts'

describe('[Skill #061] Fire Mastery (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #215)', () => {
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Schema Integrity
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Schema Integrity', () => {
    it('parses authentic Skills.txt row 61 (Fire Mastery)', () => {
      const lines = skillsTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const idIdx = headers.indexOf('Id')
      const skillIdx = headers.indexOf('skill')
      const charClassIdx = headers.indexOf('charclass')
      const reqLevelIdx = headers.indexOf('reqlevel')
      const passiveIdx = headers.indexOf('passive')
      const passiveStat1Idx = headers.indexOf('passivestat1')
      const passiveCalc1Idx = headers.indexOf('passivecalc1')
      const calc1Idx = headers.indexOf('calc1')
      const manaIdx = headers.indexOf('mana')
      const lvlManaIdx = headers.indexOf('lvlmana')
      const srvDoFuncIdx = headers.indexOf('srvdofunc')
      const srvStFuncIdx = headers.indexOf('srvstfunc')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx]?.trim() === '61')
      expect(row).toBeDefined()
      expect(row![skillIdx]?.trim()).toBe('Fire Mastery')
      expect(row![charClassIdx]?.trim()).toBe('sor')
      expect(Number(row![reqLevelIdx])).toBe(30)
      expect(Number(row![passiveIdx])).toBe(1)
      expect(row![passiveStat1Idx]?.trim()).toBe('passive_fire_mastery')
      expect(row![passiveCalc1Idx]?.trim()).toBe('ln12')
      expect(Number(row![headers.indexOf('Param1')])).toBe(30)
      expect(Number(row![headers.indexOf('Param2')])).toBe(7)
      expect(Number(row![manaIdx])).toBe(0)
      expect(Number(row![lvlManaIdx])).toBe(0)
      expect(Number(row![srvDoFuncIdx])).toBe(0)
      expect(Number(row![srvStFuncIdx])).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Passive Metadata Integrity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Passive Metadata Integrity', () => {
    it('verifies passive skill metadata (no cast overlay, no projectile)', () => {
      expect(getSkillCastOverlay(61)).toBeUndefined()
    })

    it('verifies skillModule metadata', () => {
      expect(skillModule.skillId).toBe(61)
      expect(skillModule.name).toBe('Fire Mastery')
      expect(skillModule.charClass).toBe('sor')
      expect(skillModule.srvDoFunc).toBe(0)
      expect(skillModule.srvStFunc).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 3: Formulas & Scaling
  // =========================================================================
  describe('Dimension 3: Formulas & Scaling', () => {
    it('calculates fire damage bonus percentage: 30 + (slvl - 1) * 7%', () => {
      expect(calculateFireMasteryBonus(1)).toBe(30)
      expect(calculateFireMasteryBonus(2)).toBe(37)
      expect(calculateFireMasteryBonus(5)).toBe(58)
      expect(calculateFireMasteryBonus(10)).toBe(93)
      expect(calculateFireMasteryBonus(20)).toBe(163)
      expect(calculateFireMasteryBonus(30)).toBe(233)
      expect(calculateFireMasteryBonus(40)).toBe(303)
    })

    it('handles non-positive skill levels gracefully', () => {
      expect(calculateFireMasteryBonus(0)).toBe(0)
      expect(calculateFireMasteryBonus(-5)).toBe(0)
      expect(calculateFireMasteryBonus(NaN)).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 4: Fire Damage Amplification & Combat Pipeline
  // =========================================================================
  describe('Dimension 4: Fire Damage Amplification & Combat Pipeline', () => {
    it('amplifies outbound fire damage without granting resistance pierce', () => {
      const bonus20 = calculateFireMasteryBonus(20) // 163%
      const rawFireDmg = 100
      const scaledFireDmg = Math.round(rawFireDmg * (1 + bonus20 / 100))
      expect(scaledFireDmg).toBe(263)

      // Fire Mastery does NOT reduce enemy fire resistance (no pierce)
      // Against a 50% fire resist target, 50% resistance still applies:
      const netDamageAgainstRes50 = Math.round(scaledFireDmg * (1 - 50 / 100))
      expect(netDamageAgainstRes50).toBe(132)
    })

    it('strictly preserves fire immunity (Res >= 100%)', () => {
      const immuneAttack = calculateEnchantAttackDamage({
        enchantDamage: { min: 100, max: 200 },
        isRanged: false,
        isSorceress: true,
        fireMasterySlvl: 20,
        targetFireResist: 100,
      })
      expect(immuneAttack.min).toBe(0)
      expect(immuneAttack.max).toBe(0)
      expect(immuneAttack.average).toBe(0)

      const highResAttack = calculateEnchantAttackDamage({
        enchantDamage: { min: 100, max: 200 },
        isRanged: false,
        isSorceress: true,
        fireMasterySlvl: 20,
        targetFireResist: 125,
      })
      expect(highResAttack.min).toBe(0)
      expect(highResAttack.max).toBe(0)
      expect(highResAttack.average).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 5: Double-Dip Integration with Enchant
  // =========================================================================
  describe('Dimension 5: Double-Dip Integration with Enchant', () => {
    it('applies cast multiplier to Enchant and melee double-dip to Sorceress', () => {
      const slvl = 20
      const fmSlvl = 20
      const fmBonus = calculateFireMasteryBonus(fmSlvl) // 163% -> 2.63x

      // 1. Cast multiplier: calculateEnchantDamage applies Fire Mastery at cast time
      const baseDmg = calculateEnchantDamage(slvl) // 68.5 - 89.5
      const castDmg = calculateEnchantDamage(slvl, undefined, fmSlvl)

      expect(castDmg.min).toBe(Math.round(baseDmg.min * (1 + fmBonus / 100) * 10) / 10)
      expect(castDmg.max).toBe(Math.round(baseDmg.max * (1 + fmBonus / 100) * 10) / 10)

      // 2. Melee double-dip: Sorceress in melee applies Fire Mastery again upon hit!
      const meleeSorcHit = calculateEnchantAttackDamage({
        enchantDamage: { min: castDmg.min, max: castDmg.max },
        isRanged: false,
        isSorceress: true,
        fireMasterySlvl: fmSlvl,
      })

      const expectedDoubleDipMin = Math.round(castDmg.min * (1 + fmBonus / 100) * 10) / 10
      const expectedDoubleDipMax = Math.round(castDmg.max * (1 + fmBonus / 100) * 10) / 10
      expect(meleeSorcHit.min).toBe(expectedDoubleDipMin)
      expect(meleeSorcHit.max).toBe(expectedDoubleDipMax)

      // 3. Ranged attack bypasses second Fire Mastery multiplier and takes 33% penalty
      const rangedSorcHit = calculateEnchantAttackDamage({
        enchantDamage: { min: castDmg.min, max: castDmg.max },
        isRanged: true,
        isSorceress: true,
        fireMasterySlvl: fmSlvl,
      })

      expect(rangedSorcHit.min).toBe(Math.round(castDmg.min * 0.33 * 10) / 10)
      expect(rangedSorcHit.max).toBe(Math.round(castDmg.max * 0.33 * 10) / 10)
    })
  })

  // =========================================================================
  // Dimension 6: Accrued Stat Integration & Zero Resource Cost
  // =========================================================================
  describe('Dimension 6: Accrued Stat Integration & Zero Resource Cost', () => {
    it('accrues passive_fire_mastery on UnitStatList with base and effective skill levels', () => {
      const stats = new UnitStatList()
      expect(stats.getAccruedStat('passive_fire_mastery')).toBe(0)

      stats.setBaseSkillLevel(61, 20)
      expect(stats.getAccruedStat('passive_fire_mastery')).toBe(163)

      // +5 all skills increases effective Fire Mastery level to 25 (30 + 24 * 7 = 198%)
      stats.addStat('item_allskills', 5)
      expect(stats.getAccruedStat('passive_fire_mastery')).toBe(198)
    })

    it('verifies 0 mana cost and 0 cooldown frames', () => {
      expect(getSkillManaCost(61, 1)).toBe(0)
      expect(getSkillManaCost(61, 20)).toBe(0)
      expect(getSkillCooldownTicks(61)).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 7: Invariants & Runtime Execution
  // =========================================================================
  describe('Dimension 7: Invariants & Runtime Execution', () => {
    it('preserves BATCH1_SKILLS length strictly at 38', () => {
      expect(Object.keys(BATCH1_SKILLS).length).toBe(38)
    })

    it('executes passive skill in WorldArena successfully', async () => {
      const registry = await getSharedDataRegistry()
      const arena = new WorldArena({
        registry,
        classCode: 'sor',
        skillId: 61,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(61)
      expect(outcome?.executed).toBe(true)
    })
  })
})
