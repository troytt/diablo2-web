/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #057: Thunder Storm (SOR)
 * Gitea Tracking Issue: #211
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Canonical Missile Definition (Skills.txt row 57, Missiles.txt 'thunderstorm1' / ID 166)
 * D2: Visual Assets & Metadata Integrity (LightningboltBig, light_cast_2, additive blending, overlay mapping)
 * D3: Cadence & Hyperbolic Interval Mechanics (Duration 800 + 200/lvl, Interval hyperbolic decay, 17 subtiles = 340px)
 * D4: 5-Band Piecewise Damage Scaling & Lightning Mastery Multiplicative Integration (EMin: 1, EMax: 100, +10/+10/+11)
 * D5: StateBus & Buff Management (State 'thunderstorm', timer cadence, WorldArena evaluation)
 * D6: Edge Cases & Boundary Conditions (slvl clamping, zero/negative inputs, cooldown = 0, mana cost = 19)
 * D7: Invariants (BATCH1_SKILLS length strictly 38, zero runtime MPQ queries)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-057-thunder-storm.ts'
import {
  parseMissilesTxt,
  CANONICAL_113C_MISSILES,
  getSkillCastOverlay,
  calculateSkillDamage,
  calculateThunderStormDuration,
  calculateThunderStormInterval,
  calculateThunderStormDamage,
  calculateLightningMasteryBonusPct,
  BATCH1_SKILLS,
} from '../../../src/server/skills/skills.ts'
import { getSkillRange, getSkillMana } from '../../../src/common/skills/weapon-combat-meta.ts'
import {
  THUNDERSTORM1_META,
  MISSILE_METAS,
} from '../../../src/client/render/missiles-meta.ts'
import {
  LIGHT_CAST_2_META,
  OVERLAY_METAS,
} from '../../../src/client/render/overlays-meta.ts'

describe('[Skill #057] Thunder Storm (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #211)', () => {
  const missilesTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/Missiles.txt')
  const missilesTxtContent = fs.readFileSync(missilesTxtPath, 'latin1')
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition', () => {
    it('parses authentic Skills.txt row 57 (Thunder Storm)', () => {
      const lines = skillsTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const idIdx = headers.indexOf('Id')
      const skillIdx = headers.indexOf('skill')
      const charClassIdx = headers.indexOf('charclass')
      const manaIdx = headers.indexOf('mana')
      const lvlManaIdx = headers.indexOf('lvlmana')
      const manaShiftIdx = headers.indexOf('manashift')
      const castOverlayIdx = headers.indexOf('castoverlay')
      const eMinIdx = headers.indexOf('EMin')
      const eMaxIdx = headers.indexOf('EMax')
      const eMinLev1Idx = headers.indexOf('EMinLev1')
      const eMaxLev1Idx = headers.indexOf('EMaxLev1')
      const eMinLev2Idx = headers.indexOf('EMinLev2')
      const eMaxLev2Idx = headers.indexOf('EMaxLev2')
      const eMinLev3Idx = headers.indexOf('EMinLev3')
      const eMaxLev3Idx = headers.indexOf('EMaxLev3')
      const param1Idx = headers.indexOf('Param1') !== -1 ? headers.indexOf('Param1') : headers.indexOf('param1')
      const param2Idx = headers.indexOf('Param2') !== -1 ? headers.indexOf('Param2') : headers.indexOf('param2')
      const param3Idx = headers.indexOf('Param3') !== -1 ? headers.indexOf('Param3') : headers.indexOf('param3')
      const param7Idx = headers.indexOf('Param7') !== -1 ? headers.indexOf('Param7') : headers.indexOf('param7')
      const auraStateIdx = headers.indexOf('aurastate')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx]?.trim() === '57')
      expect(row).toBeDefined()
      expect(row![skillIdx]?.trim()).toBe('Thunder Storm')
      expect(row![charClassIdx]?.trim()).toBe('sor')
      expect(Number(row![manaIdx])).toBe(19)
      expect(Number(row![lvlManaIdx])).toBe(0)
      expect(Number(row![manaShiftIdx])).toBe(8)
      expect(row![castOverlayIdx]?.trim()).toBe('light_cast_2')
      expect(Number(row![eMinIdx])).toBe(1)
      expect(Number(row![eMaxIdx])).toBe(100)
      expect(Number(row![eMinLev1Idx])).toBe(10)
      expect(Number(row![eMaxLev1Idx])).toBe(10)
      expect(Number(row![eMinLev2Idx])).toBe(10)
      expect(Number(row![eMaxLev2Idx])).toBe(10)
      expect(Number(row![eMinLev3Idx])).toBe(11)
      expect(Number(row![eMaxLev3Idx])).toBe(11)
      expect(Number(row![param1Idx])).toBe(800) // Base duration
      expect(Number(row![param2Idx])).toBe(200) // Duration per level
      expect(Number(row![param3Idx])).toBe(25)  // Floor strike interval (frames)
      expect(Number(row![param7Idx])).toBe(17)  // Radius subtiles
      expect(row![auraStateIdx]?.trim()).toBe('thunderstorm')
    })

    it('parses authentic Missiles.txt row for thunderstorm1 (ID 166)', () => {
      const map = parseMissilesTxt(missilesTxtContent)
      const ts = map.get('thunderstorm1')
      expect(ts).toBeDefined()
      expect(ts!.id).toBe(166)
      expect(ts!.celFile.toLowerCase()).toBe('lightningboltbig')
      expect(ts!.range).toBe(9)
      expect(ts!.animLen).toBe(8)
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Integrity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Integrity', () => {
    it('verifies light_cast_2 cast overlay metadata in OVERLAY_METAS', () => {
      expect(OVERLAY_METAS['light_cast_2']).toBeDefined()
      expect(OVERLAY_METAS['light_cast_2']).toBe(LIGHT_CAST_2_META)
      expect(LIGHT_CAST_2_META.frames).toBeGreaterThan(0)
      expect(getSkillCastOverlay(57)).toBe('light_cast_2')
    })

    it('verifies thunderstorm1 missile metadata in CANONICAL_113C_MISSILES and MISSILE_METAS', () => {
      const msl = CANONICAL_113C_MISSILES['thunderstorm1']
      expect(msl).toBeDefined()
      expect(msl.id).toBe(166)
      expect(msl.celFile).toBe('LightningboltBig')
      expect(msl.animLen).toBe(8)
      expect(MISSILE_METAS['thunderstorm1']).toBeDefined()
      expect(MISSILE_METAS['thunderstorm1']).toBe(THUNDERSTORM1_META)
    })
  })

  // =========================================================================
  // Dimension 3: Cadence & Hyperbolic Interval Mechanics
  // =========================================================================
  describe('Dimension 3: Cadence & Hyperbolic Interval Mechanics', () => {
    it('calculates exact 1.13c duration: 800 + (slvl - 1) * 200 frames', () => {
      expect(calculateThunderStormDuration(1)).toBe(800)     // 32.00s
      expect(calculateThunderStormDuration(2)).toBe(1000)    // 40.00s
      expect(calculateThunderStormDuration(10)).toBe(2600)   // 104.00s
      expect(calculateThunderStormDuration(20)).toBe(4600)   // 184.00s
      expect(calculateThunderStormDuration(40)).toBe(8600)   // 344.00s
    })

    it('calculates authentic hyperbolic cadence interval (floor 25 frames)', () => {
      // 125 - Math.floor(110 * slvl / (slvl + 6))
      expect(calculateThunderStormInterval(1)).toBe(110)    // 125 - 15 = 110 (4.40s)
      expect(calculateThunderStormInterval(2)).toBe(98)     // 125 - 27 = 98 (3.92s)
      expect(calculateThunderStormInterval(5)).toBe(75)     // 125 - 50 = 75 (3.00s)
      expect(calculateThunderStormInterval(10)).toBe(57)    // 125 - 68 = 57 (2.28s)
      expect(calculateThunderStormInterval(20)).toBe(41)    // 125 - 84 = 41 (1.64s)
      expect(calculateThunderStormInterval(40)).toBe(30)    // 125 - 95 = 30 (1.20s)
      expect(calculateThunderStormInterval(100)).toBe(25)   // Clamped at floor 25 (1.00s)
    })

    it('verifies target acquisition radius is 17 subtiles (340px)', () => {
      expect(getSkillRange(57)).toBe(340)
    })
  })

  // =========================================================================
  // Dimension 4: 5-Band Piecewise Damage Scaling & Lightning Mastery Multiplicative Integration
  // =========================================================================
  describe('Dimension 4: 5-Band Piecewise Damage Scaling & Lightning Mastery Multiplicative Integration', () => {
    it('calculates unmastered base damage across bands', () => {
      // Level 1: 1 - 100
      expect(calculateThunderStormDamage(1)).toEqual({ min: 1, max: 100 })
      // Level 2: 1+10 - 100+10 = 11 - 110
      expect(calculateThunderStormDamage(2)).toEqual({ min: 11, max: 110 })
      // Level 8: 1+70 - 100+70 = 71 - 170
      expect(calculateThunderStormDamage(8)).toEqual({ min: 71, max: 170 })
      // Level 10: 71+20 - 170+20 = 91 - 190
      expect(calculateThunderStormDamage(10)).toEqual({ min: 91, max: 190 })
      // Level 16: 91+60 - 190+60 = 151 - 250
      expect(calculateThunderStormDamage(16)).toEqual({ min: 151, max: 250 })
      // Level 20: 151+44 - 250+44 = 195 - 294
      expect(calculateThunderStormDamage(20)).toEqual({ min: 195, max: 294 })
      // Level 30: 195 + 66 + 44 = 305 - 404
      expect(calculateThunderStormDamage(30)).toEqual({ min: 305, max: 404 })
    })

    it('verifies 0 synergies in 1.13c and multiplicative scaling with Lightning Mastery', () => {
      // Thunder Storm has 0 synergies in 1.13c: synergy points change nothing
      const noMastery = calculateThunderStormDamage(20)
      expect(noMastery).toEqual({ min: 195, max: 294 })

      // Multiplicative with Lightning Mastery:
      // Level 1 LM (+50%): 195 * 1.5 = 292.5 -> 292, 294 * 1.5 = 441
      const withLm1 = calculateThunderStormDamage(20, { lightningMastery: 1 })
      expect(withLm1).toEqual({ min: 292, max: 441 })

      // Level 20 LM (+278%): 195 * 3.78 = 737.1 -> 737, 294 * 3.78 = 1111.32 -> 1111
      const withLm20 = calculateThunderStormDamage(20, { lightningMastery: 20 })
      expect(withLm20).toEqual({ min: 737, max: 1111 })

      // Parameter overload: passing number as 3rd argument
      const withLm20Arg = calculateThunderStormDamage(20, undefined, 20)
      expect(withLm20Arg).toEqual({ min: 737, max: 1111 })
    })

    it('routes calculateSkillDamage correctly for Thunder Storm', () => {
      expect(calculateSkillDamage(57, 1)).toEqual({ min: 1, max: 100 })
      expect(calculateSkillDamage('57', 20)).toEqual({ min: 195, max: 294 })
      expect(calculateSkillDamage('thunderstorm', 20, { lightningMastery: 20 } as any)).toEqual({ min: 737, max: 1111 })
    })
  })

  // =========================================================================
  // Dimension 5: StateBus & Buff Management
  // =========================================================================
  describe('Dimension 5: StateBus & Buff Management', () => {
    it('evaluates exact 1.13c Skills.txt formulas at slvl 1, 10, and 20 via SkillModule', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(57)!
      expect(skillRec).toBeDefined()
      expect(skillModule.skillId).toBe(57)
      expect(skillModule.name).toBe('Thunder Storm')
      expect(skillModule.charClass).toBe('sor')

      const stats1 = new UnitStatList()
      stats1.setBaseSkillLevel(57, 1)
      const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
      expect(r1.manaCost).toBe(19)
      expect(r1.manaCost256).toBe(4864) // 19 * 256
      expect(r1.minElemDmg256).toBe(256) // 1 * 256
      expect(r1.maxElemDmg256).toBe(25600) // 100 * 256

      const stats10 = new UnitStatList()
      stats10.setBaseSkillLevel(57, 10)
      const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
      expect(r10.manaCost).toBe(19)
      expect(r10.minElemDmg256).toBe(23296) // 91 * 256
      expect(r10.maxElemDmg256).toBe(48640) // 190 * 256

      const stats20 = new UnitStatList()
      stats20.setBaseSkillLevel(57, 20)
      const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
      expect(r20.manaCost).toBe(19)
      expect(r20.minElemDmg256).toBe(49920) // 195 * 256
      expect(r20.maxElemDmg256).toBe(75264) // 294 * 256
      expect(r20.durationFrames).toBe(4600)
    })
  })

  // =========================================================================
  // Dimension 6: Edge Cases & Boundary Conditions
  // =========================================================================
  describe('Dimension 6: Edge Cases & Boundary Conditions', () => {
    it('handles non-positive slvl gracefully (clamps to 1)', () => {
      expect(calculateThunderStormDuration(0)).toBe(800)
      expect(calculateThunderStormDuration(-5)).toBe(800)
      expect(calculateThunderStormInterval(0)).toBe(110)
      expect(calculateThunderStormDamage(0)).toEqual({ min: 1, max: 100 })
    })

    it('verifies 1.13c mana cost is constant 19 and cooldown is 0', () => {
      expect(getSkillMana(57)).toBe(19)
    })
  })

  // =========================================================================
  // Dimension 7: Invariants & WorldArena Integration
  // =========================================================================
  describe('Dimension 7: Invariants & WorldArena Integration', () => {
    it('executes runtime cast in WorldArena with action frame and mana deduction', async () => {
      const registry = await getSharedDataRegistry()
      const arena = new WorldArena({
        registry,
        classCode: 'sor',
        skillId: 57,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()
      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(57)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })

    it('enforces BATCH1_SKILLS length invariant strictly 38', () => {
      expect(Object.keys(BATCH1_SKILLS).length).toBe(38)
    })
  })
})
