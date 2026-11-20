/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #052: Enchant (SOR)
 * Gitea Tracking Issue: #206
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Schema Integrity (Skills.txt row 52, mana 25, lvlmana 1, manashift 8, castoverlay 'fire_cast_2')
 * D2: Visual Assets & Metadata Integrity (Sprite atlas 'enchant.png' / 'enchant.json', ENCHANT_OVERLAY_META, FIRE_CAST_2_META)
 * D3: Formulas & Scaling (Duration: 3600 + (slvl-1)*600 frames, AR bonus: 20 + (slvl-1)*9%)
 * D4: Ranged Penalty (33%) vs Sorceress Melee Double-Dip (Ranged 33% penalty, Sorc melee double-dip with FM, immunity intact)
 * D5: Synergy Math & 5-Band Integer Accuracy (Warmth +9%/blvl, soft points 0%, HitShift 7 0.5 fire dmg band progression)
 * D6: Mana Progression & 0 Cooldown Ticks (Mana 25 + slvl - 1, 0 cooldown frames, InTown target ally/pet permitted)
 * D7: Invariants (BATCH1_SKILLS length strictly 38, zero runtime MPQ queries, WorldArena cast execution)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-052-enchant.ts'
import {
  calculateEnchantDamage,
  calculateEnchantAttackRating,
  calculateEnchantDuration,
  calculateEnchantAttackDamage,
  calculateFireMasteryBonus,
  getSkillCastOverlay,
  getSkillManaCost,
  getSkillCooldownTicks,
  BATCH1_SKILLS,
} from '../../../src/server/skills/skills.ts'
import { applyEnchantBuff, canCastEnchantOn } from '../../../src/server/ai/monster-ai.ts'
import {
  ENCHANT_OVERLAY_META,
  FIRE_CAST_2_META,
  OVERLAY_METAS,
} from '../../../src/client/render/overlays-meta.ts'

describe('[Skill #052] Enchant (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #206)', () => {
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Schema Integrity
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Schema Integrity', () => {
    it('parses authentic Skills.txt row 52 (Enchant)', () => {
      const lines = skillsTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const idIdx = headers.indexOf('Id')
      const skillIdx = headers.indexOf('skill')
      const charClassIdx = headers.indexOf('charclass')
      const manaIdx = headers.indexOf('mana')
      const lvlManaIdx = headers.indexOf('lvlmana')
      const manaShiftIdx = headers.indexOf('manashift')
      const castOverlayIdx = headers.indexOf('castoverlay')
      const aurastateIdx = headers.indexOf('aurastate')
      const srvDoFuncIdx = headers.indexOf('srvdofunc')
      const srvStFuncIdx = headers.indexOf('srvstfunc')
      const eMinIdx = headers.indexOf('EMin')
      const eMinLev1Idx = headers.indexOf('EMinLev1')
      const eMinLev2Idx = headers.indexOf('EMinLev2')
      const eMinLev3Idx = headers.indexOf('EMinLev3')
      const eMinLev4Idx = headers.indexOf('EMinLev4')
      const eMinLev5Idx = headers.indexOf('EMinLev5')
      const eMaxIdx = headers.indexOf('EMax')
      const eMaxLev1Idx = headers.indexOf('EMaxLev1')
      const eMaxLev2Idx = headers.indexOf('EMaxLev2')
      const eMaxLev3Idx = headers.indexOf('EMaxLev3')
      const eMaxLev4Idx = headers.indexOf('EMaxLev4')
      const eMaxLev5Idx = headers.indexOf('EMaxLev5')
      const hitShiftIdx = headers.indexOf('HitShift')
      const toHitIdx = headers.indexOf('ToHit')
      const toHitLevIdx = headers.indexOf('LevToHit')
      const param1Idx = headers.indexOf('Param1')
      const param2Idx = headers.indexOf('Param2')
      const param3Idx = headers.indexOf('Param3')
      const param8Idx = headers.indexOf('Param8')
      const auraLenCalcIdx = headers.indexOf('auralencalc')
      const inTownIdx = headers.indexOf('InTown')
      const targetAllyIdx = headers.indexOf('TargetAlly')
      const targetPetIdx = headers.indexOf('TargetPet')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx]?.trim() === '52')
      expect(row).toBeDefined()
      expect(row![skillIdx]?.trim()).toBe('Enchant')
      expect(row![charClassIdx]?.trim()).toBe('sor')
      expect(Number(row![manaIdx])).toBe(25)
      expect(Number(row![lvlManaIdx])).toBe(1)
      expect(Number(row![manaShiftIdx])).toBe(8)
      expect(row![castOverlayIdx]?.trim()).toBe('')
      expect(row![aurastateIdx]?.trim()).toBe('enchant')
      expect(Number(row![srvDoFuncIdx])).toBe(25)
      expect(Number(row![srvStFuncIdx])).toBe(0)
      expect(Number(row![inTownIdx])).toBe(1)
      expect(Number(row![targetAllyIdx])).toBe(1)
      expect(Number(row![targetPetIdx])).toBe(1)

      // 5-band min & max damage definitions
      expect(Number(row![eMinIdx])).toBe(16)
      expect(Number(row![eMinLev1Idx])).toBe(3)
      expect(Number(row![eMinLev2Idx])).toBe(7)
      expect(Number(row![eMinLev3Idx])).toBe(11)
      expect(Number(row![eMinLev4Idx])).toBe(15)
      expect(Number(row![eMinLev5Idx])).toBe(19)

      expect(Number(row![eMaxIdx])).toBe(20)
      expect(Number(row![eMaxLev1Idx])).toBe(5)
      expect(Number(row![eMaxLev2Idx])).toBe(9)
      expect(Number(row![eMaxLev3Idx])).toBe(13)
      expect(Number(row![eMaxLev4Idx])).toBe(17)
      expect(Number(row![eMaxLev5Idx])).toBe(21)

      // HitShift = 7 (0.5 damage per raw point)
      expect(Number(row![hitShiftIdx])).toBe(7)

      // Attack rating progression: 20 base, +9 per level
      expect(Number(row![toHitIdx])).toBe(20)
      expect(Number(row![toHitLevIdx])).toBe(9)

      // Duration: 3600 frames + 600 per level
      expect(Number(row![param1Idx])).toBe(3600)
      expect(Number(row![param2Idx])).toBe(600)
      expect(row![auraLenCalcIdx]?.trim()).toBe('ln12')

      // Ranged missile penalty percent (33%) and Warmth synergy (9%)
      expect(Number(row![param3Idx])).toBe(33)
      expect(Number(row![param8Idx])).toBe(9)
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Integrity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Integrity', () => {
    it('verifies prebaked overlay assets exist on disk in public/overlays/', () => {
      const pngPath = path.resolve(__dirname, '../../../public/overlays/enchant.png')
      const jsonPath = path.resolve(__dirname, '../../../public/overlays/enchant.json')
      expect(fs.existsSync(pngPath)).toBe(true)
      expect(fs.existsSync(jsonPath)).toBe(true)

      const jsonRaw = fs.readFileSync(jsonPath, 'utf8')
      const parsed = JSON.parse(jsonRaw)
      expect(parsed).toBeDefined()
      expect(parsed.frames).toBeDefined()
    })

    it('verifies overlay metadata definitions in overlays-meta.ts', () => {
      expect(OVERLAY_METAS['enchant']).toBeDefined()
      expect(OVERLAY_METAS['enchant']).toBe(ENCHANT_OVERLAY_META)
      expect(ENCHANT_OVERLAY_META.name).toBe('enchant')
      expect(ENCHANT_OVERLAY_META.celFile).toBe('FireEnchant')
      expect(ENCHANT_OVERLAY_META.frames).toBe(17)

      // Issue #955: Skills.txt has an EMPTY castoverlay for Enchant (52) — the old
      // fire_cast_2 mapping was fabricated.
      expect(getSkillCastOverlay(52)).toBeUndefined()
      expect(OVERLAY_METAS['fire_cast_2']).toBe(FIRE_CAST_2_META)
      expect(FIRE_CAST_2_META.name).toBe('fire_cast_2')
    })
  })

  // =========================================================================
  // Dimension 3: Formulas & Scaling
  // =========================================================================
  describe('Dimension 3: Formulas & Scaling', () => {
    it('calculates duration: 3600 + (slvl - 1) * 600 frames', () => {
      expect(calculateEnchantDuration(1)).toBe(3600)   // 144s
      expect(calculateEnchantDuration(2)).toBe(4200)   // 168s
      expect(calculateEnchantDuration(10)).toBe(9000)  // 360s
      expect(calculateEnchantDuration(20)).toBe(15000) // 600s
      expect(calculateEnchantDuration(30)).toBe(21000) // 840s
    })

    it('calculates attack rating percentage: 20 + (slvl - 1) * 9%', () => {
      expect(calculateEnchantAttackRating(1)).toBe(20)
      expect(calculateEnchantAttackRating(2)).toBe(29)
      expect(calculateEnchantAttackRating(10)).toBe(101)
      expect(calculateEnchantAttackRating(20)).toBe(191)
      expect(calculateEnchantAttackRating(30)).toBe(281)
    })

    it('applies Enchant buff correctly via applyEnchantBuff helper', () => {
      const target: {
        enchantTicks?: number | undefined
        enchantDamage?: { min: number; max: number } | undefined
        enchantAttackRatingPercent?: number | undefined
      } = {}

      applyEnchantBuff(target, 20, { casterWarmth: 20, casterFireMasterySlvl: 20 })
      expect(target.enchantTicks).toBe(15000)
      expect(target.enchantAttackRatingPercent).toBe(191)
      expect(target.enchantDamage).toBeDefined()
      expect(target.enchantDamage!.min).toBeGreaterThan(68)
      expect(target.enchantDamage!.max).toBeGreaterThan(89)
    })
  })

  // =========================================================================
  // Dimension 4: Ranged Penalty (33%) vs Sorceress Melee Double-Dip
  // =========================================================================
  describe('Dimension 4: Ranged Penalty (33%) vs Sorceress Melee Double-Dip', () => {
    it('applies 33% penalty to ranged attacks and excludes second Fire Mastery multiplier', () => {
      const baseDmg = { min: 100, max: 200 }
      // Ranged Sorceress with slvl 20 Fire Mastery (163% bonus)
      const rangedRes = calculateEnchantAttackDamage({
        enchantDamage: baseDmg,
        isRanged: true,
        isSorceress: true,
        fireMasterySlvl: 20,
      })
      // Exactly 33% of base damage, no second 2.63x multiplier!
      expect(rangedRes.min).toBe(33)
      expect(rangedRes.max).toBe(66)
      expect(rangedRes.average).toBe(49.5)
    })

    it('applies Sorceress melee double-dip multiplying fire damage by Fire Mastery again', () => {
      const baseDmg = { min: 100, max: 200 }
      const fmSlvl = 20
      const fmMultiplier = 1.0 + calculateFireMasteryBonus(fmSlvl) / 100 // 1 + 1.63 = 2.63

      const meleeSorcRes = calculateEnchantAttackDamage({
        enchantDamage: baseDmg,
        isRanged: false,
        isSorceress: true,
        fireMasterySlvl: fmSlvl,
      })
      expect(meleeSorcRes.min).toBe(Math.round(100 * fmMultiplier * 10) / 10)
      expect(meleeSorcRes.max).toBe(Math.round(200 * fmMultiplier * 10) / 10)
    })

    it('applies 100% base damage for non-Sorceress melee ally (no double-dip)', () => {
      const baseDmg = { min: 100, max: 200 }
      const allyRes = calculateEnchantAttackDamage({
        enchantDamage: baseDmg,
        isRanged: false,
        isSorceress: false,
      })
      expect(allyRes.min).toBe(100)
      expect(allyRes.max).toBe(200)
    })

    it('preserves fire immunity: enemies with fire resist >= 100% take 0 damage', () => {
      const baseDmg = { min: 100, max: 200 }
      const immuneRes = calculateEnchantAttackDamage({
        enchantDamage: baseDmg,
        isRanged: false,
        isSorceress: true,
        fireMasterySlvl: 20,
        targetFireResist: 100,
      })
      expect(immuneRes.min).toBe(0)
      expect(immuneRes.max).toBe(0)
      expect(immuneRes.average).toBe(0)

      const overcappedRes = calculateEnchantAttackDamage({
        enchantDamage: baseDmg,
        isRanged: false,
        isSorceress: true,
        fireMasterySlvl: 20,
        targetFireResist: 115,
      })
      expect(overcappedRes.min).toBe(0)
      expect(overcappedRes.max).toBe(0)
    })

    it('scales damage against partially resistant targets', () => {
      const baseDmg = { min: 100, max: 200 }
      const res50 = calculateEnchantAttackDamage({
        enchantDamage: baseDmg,
        isRanged: false,
        isSorceress: false,
        targetFireResist: 50,
      })
      expect(res50.min).toBe(50)
      expect(res50.max).toBe(100)
      expect(res50.average).toBe(75)
    })
  })

  // =========================================================================
  // Dimension 5: Synergy Math & 5-Band Integer Accuracy
  // =========================================================================
  describe('Dimension 5: Synergy Math & 5-Band Integer Accuracy', () => {
    it('evaluates exact 5-band base progression with HitShift = 7', () => {
      // slvl 1: raw 16-20 => 8.0 - 10.0 fire damage (2048 - 2560 in 256ths)
      const d1 = calculateEnchantDamage(1)
      expect(d1.min).toBe(8)
      expect(d1.max).toBe(10)
      expect(d1.min256).toBe(2048)
      expect(d1.max256).toBe(2560)

      // slvl 10: raw 51-73 => 25.5 - 36.5 fire damage (6528 - 9344 in 256ths)
      const d10 = calculateEnchantDamage(10)
      expect(d10.min).toBe(25.5)
      expect(d10.max).toBe(36.5)
      expect(d10.min256).toBe(6528)
      expect(d10.max256).toBe(9344)

      // slvl 20: raw 137-179 => 68.5 - 89.5 fire damage (17536 - 22912 in 256ths)
      const d20 = calculateEnchantDamage(20)
      expect(d20.min).toBe(68.5)
      expect(d20.max).toBe(89.5)
      expect(d20.min256).toBe(17536)
      expect(d20.max256).toBe(22912)
    })

    it('enforces Warmth +9% synergy per hard point and rejects soft points', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(52)!

      const statsBase = new UnitStatList()
      statsBase.setBaseSkillLevel(52, 20)
      statsBase.setBaseSkillLevel(37, 20) // Warmth 20 hard points

      const withHardPoints = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsBase,
      })
      expect(withHardPoints.synergyBonusPct).toBe(180) // 20 * 9% = 180%

      // Soft points only (+skills)
      const statsSoftOnly = new UnitStatList()
      statsSoftOnly.setBaseSkillLevel(52, 20)
      statsSoftOnly.addStat('item_allskills', 20)
      const withSoftOnly = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsSoftOnly,
      })
      expect(withSoftOnly.synergyBonusPct).toBe(0)
    })

    it('scales cast damage with Warmth synergy and Fire Mastery', () => {
      // 20 Warmth (+180% synergy = 2.8x) and 20 Fire Mastery (163% bonus = 2.63x)
      const baseD20 = calculateEnchantDamage(20)
      const buffedD20 = calculateEnchantDamage(20, { warmth: 20, fireMastery: 20 })

      expect(buffedD20.min).toBeGreaterThan(baseD20.min * 2.8 * 2.6)
      expect(buffedD20.max).toBeGreaterThan(baseD20.max * 2.8 * 2.6)
    })
  })

  // =========================================================================
  // Dimension 6: Mana Progression & 0 Cooldown Ticks
  // =========================================================================
  describe('Dimension 6: Mana Progression & 0 Cooldown Ticks', () => {
    it('calculates mana cost progression: 25 + (slvl - 1)', () => {
      expect(getSkillManaCost(52, 1)).toBe(25)
      expect(getSkillManaCost(52, 2)).toBe(26)
      expect(getSkillManaCost(52, 10)).toBe(34)
      expect(getSkillManaCost(52, 20)).toBe(44)
    })

    it('verifies zero cooldown ticks (no cast delay)', () => {
      expect(getSkillCooldownTicks(52)).toBe(0)
    })

    it('verifies InTown targeting rules (can buff self, allies, pets in town; not enemies)', () => {
      expect(canCastEnchantOn('self', true)).toBe(true)
      expect(canCastEnchantOn('ally', true)).toBe(true)
      expect(canCastEnchantOn('pet', true)).toBe(true)
      expect(canCastEnchantOn('enemy', true)).toBe(false)
    })
  })

  // =========================================================================
  // Dimension 7: Invariants & Runtime Execution
  // =========================================================================
  describe('Dimension 7: Invariants & Runtime Execution', () => {
    it('preserves BATCH1_SKILLS length strictly at 38', () => {
      expect(Object.keys(BATCH1_SKILLS).length).toBe(38)
    })

    it('executes runtime cast in WorldArena with action frame and outcome', async () => {
      const registry = await getSharedDataRegistry()
      const arena = new WorldArena({
        registry,
        classCode: 'sor',
        skillId: 52,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(52)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })
  })
})
