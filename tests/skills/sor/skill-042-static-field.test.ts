/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #042: Static Field (SOR)
 * Gitea Tracking Issue: #196
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Ground Truth (Skills.txt row 42, srvdofunc 20, non-projectile)
 * D2: Visual Assets & Metadata Integrity (light_cast_1.png/json, lightning.png/json, Additive Blending)
 * D3: Instantaneous 360° AoE Geometry & Radius Scaling (4 + slvl yards, 40 px/yard, 200px at lvl 1 to 960px at lvl 20)
 * D4: 25% Current HP Cut, Resistance & Immunity Scaling (Cuts 25% of current HP, lightning resist reduces, immunity ignores)
 * D5: Line-of-Sight (LOS) Raycast Obstruction (Targets behind solid walls receive 0 damage)
 * D6: Difficulty Floor Clamps & Assembly Pre-Check Invariant (D2Game.dll 0x6FC62F13: Normal 1 HP, NM 33%, Hell 50%)
 * D7: WorldArena & Runtime Cast Integration (Cast action frame, 9 flat mana, 0 cooldown, cast & hit overlays)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-042-static-field.ts'
import {
  getSkillManaCost,
  getSkillCooldownTicks,
  getSkillCastOverlay,
  SORCERESS_SKILL_CAST_OVERLAYS,
  calculateStaticFieldDamage,
  calculateStaticFieldRadiusYards,
  calculateStaticFieldRadiusPx,
  hasLineOfSight,
  executeStaticField,
} from '../../../src/server/skills/skills.ts'
import {
  LIGHT_CAST_1_META,
  LIGHTNING_OVERLAY_META,
  OVERLAY_METAS,
} from '../../../src/client/render/overlays-meta.ts'

describe('[Skill #042] Static Field (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #196)', () => {
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Ground Truth
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Ground Truth', () => {
    it('parses authentic Skills.txt row 42 (Static Field)', () => {
      const lines = skillsTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const idIdx = headers.indexOf('Id')
      const skillIdx = headers.indexOf('skill')
      const charClassIdx = headers.indexOf('charclass')
      const manaIdx = headers.indexOf('mana')
      const lvlManaIdx = headers.indexOf('lvlmana')
      const srvDoFuncIdx = headers.indexOf('srvdofunc')
      const losIdx = headers.indexOf('LineOfSight')
      const p1Idx = headers.indexOf('Param1')
      const p2Idx = headers.indexOf('Param2')
      const p4Idx = headers.indexOf('Param4')
      const rangeCalcIdx = headers.indexOf('aurarangecalc')
      const castOverlayIdx = headers.indexOf('castoverlay')
      const srvMissileAIdx = headers.indexOf('srvmissilea')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx] === '42')
      expect(row).toBeDefined()
      expect(row![skillIdx]).toBe('Static Field')
      expect(row![charClassIdx]).toBe('sor')
      expect(Number(row![manaIdx])).toBe(9)
      expect(Number(row![lvlManaIdx])).toBe(0)
      expect(Number(row![srvDoFuncIdx])).toBe(20) // SKILLS_SrvDo020_StaticField
      expect(Number(row![losIdx])).toBe(4) // Requires Line Of Sight
      expect(Number(row![p1Idx])).toBe(5) // Base radius: 5 yards
      expect(Number(row![p2Idx])).toBe(1) // Radius per level: 1 yard
      expect(Number(row![p4Idx])).toBe(25) // 25% current HP damage
      expect(row![rangeCalcIdx]).toBe('ln12')
      expect(row![castOverlayIdx]).toBe('light_cast_1')
      // Non-projectile: no missile entity spawned
      expect(row![srvMissileAIdx] ?? '').toBe('')
    })

    it('verifies canonical skill metadata registration for Skill 42', () => {
      expect(getSkillManaCost(42, 1)).toBe(9)
      expect(getSkillManaCost(42, 10)).toBe(9)
      expect(getSkillCooldownTicks(42)).toBe(0)
      expect(getSkillCastOverlay(42)).toBe('light_cast_1')
      expect(SORCERESS_SKILL_CAST_OVERLAYS[42]).toBe('light_cast_1')
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Integrity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Integrity', () => {
    it('verifies cast and hit overlay atlas sprite sheets exist with non-zero size', () => {
      const castPng = path.resolve(__dirname, '../../../public/overlays/light_cast_1.png')
      const castJson = path.resolve(__dirname, '../../../public/overlays/light_cast_1.json')
      const hitPng = path.resolve(__dirname, '../../../public/overlays/lightning.png')
      const hitJson = path.resolve(__dirname, '../../../public/overlays/lightning.json')

      expect(fs.existsSync(castPng)).toBe(true)
      expect(fs.statSync(castPng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(castJson)).toBe(true)
      expect(fs.existsSync(hitPng)).toBe(true)
      expect(fs.statSync(hitPng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(hitJson)).toBe(true)
    })

    it('verifies cast overlay mapping and LIGHT_CAST_1_META metadata', () => {
      expect(SORCERESS_SKILL_CAST_OVERLAYS[42]).toBe('light_cast_1')
      expect(getSkillCastOverlay(42)).toBe('light_cast_1')
      expect(LIGHT_CAST_1_META.name).toBe('light_cast_1')
      expect(OVERLAY_METAS['light_cast_1']).toBe(LIGHT_CAST_1_META)
    })

    it('verifies hit overlay LIGHTNING_OVERLAY_META metadata', () => {
      expect(LIGHTNING_OVERLAY_META.name).toBe('lightning')
      expect(LIGHTNING_OVERLAY_META.celFile).toBe('ShockHitSm')
      expect(LIGHTNING_OVERLAY_META.frames).toBe(20)
      expect(OVERLAY_METAS['lightning']).toBe(LIGHTNING_OVERLAY_META)
    })
  })

  // =========================================================================
  // Dimension 3: Instantaneous 360° AoE Geometry & Radius Scaling
  // =========================================================================
  describe('Dimension 3: Instantaneous 360° AoE Geometry & Radius Scaling', () => {
    it('calculates exact 1.13c radius in yards: (4 + slvl)', () => {
      expect(calculateStaticFieldRadiusYards(1)).toBe(5)
      expect(calculateStaticFieldRadiusYards(10)).toBe(14)
      expect(calculateStaticFieldRadiusYards(20)).toBe(24)
      expect(calculateStaticFieldRadiusYards(30)).toBe(34)
    })

    it('calculates exact radius in pixels: (4 + slvl) * 40 px', () => {
      expect(calculateStaticFieldRadiusPx(1)).toBe(200) // 5 * 40
      expect(calculateStaticFieldRadiusPx(10)).toBe(560) // 14 * 40
      expect(calculateStaticFieldRadiusPx(20)).toBe(960) // 24 * 40 (covers 800x600 screen)
      expect(calculateStaticFieldRadiusPx(30)).toBe(1360)
    })

    it('executeStaticField hits targets inside radius and excludes targets outside radius', () => {
      // slvl 1 radius is 200 px
      const targetInside = { id: 'm1', x: 150, y: 0, currentHp: 1000, maxHp: 1000 }
      const targetOutside = { id: 'm2', x: 250, y: 0, currentHp: 1000, maxHp: 1000 }

      const result = executeStaticField({
        casterX: 0,
        casterY: 0,
        slvl: 1,
        targets: [targetInside, targetOutside],
        difficulty: 'normal',
      })

      expect(result.radiusPx).toBe(200)
      // Only targetInside should be hit
      expect(result.hits.length).toBe(1)
      expect(result.hits[0]!.targetId).toBe('m1')
      expect(result.hits[0]!.damage).toBe(250) // 25% of 1000
      expect(result.hits[0]!.newHp).toBe(750)
    })
  })

  // =========================================================================
  // Dimension 4: 25% Current HP Cut, Resistance & Immunity Scaling
  // =========================================================================
  describe('Dimension 4: 25% Current HP Cut, Resistance & Immunity Scaling', () => {
    it('cuts 25% of current HP sequentially on repeated casts', () => {
      // Cast 1: 1000 HP -> cuts 250 -> 750 HP
      const r1 = calculateStaticFieldDamage(1000, 1000, 'normal', 0)
      expect(r1.damage).toBe(250)
      expect(r1.newHp).toBe(750)
      expect(r1.immune).toBe(false)
      expect(r1.blockedByFloor).toBe(false)

      // Cast 2: 750 HP -> cuts floor(750 * 0.25) = 187 -> 563 HP
      const r2 = calculateStaticFieldDamage(750, 1000, 'normal', 0)
      expect(r2.damage).toBe(187)
      expect(r2.newHp).toBe(563)

      // Cast 3: 563 HP -> cuts floor(563 * 0.25) = 140 -> 423 HP
      const r3 = calculateStaticFieldDamage(563, 1000, 'normal', 0)
      expect(r3.damage).toBe(140)
      expect(r3.newHp).toBe(423)
    })

    it('scales damage proportionally with lightning resistance', () => {
      // 50% lightning resist: 250 * (100 - 50) / 100 = 125 damage
      const r50 = calculateStaticFieldDamage(1000, 1000, 'normal', 50)
      expect(r50.damage).toBe(125)
      expect(r50.newHp).toBe(875)

      // 75% lightning resist: 250 * (100 - 75) / 100 = 62 damage
      const r75 = calculateStaticFieldDamage(1000, 1000, 'normal', 75)
      expect(r75.damage).toBe(62)
      expect(r75.newHp).toBe(938)
    })

    it('deals 0 damage to lightning-immune enemies (resistance >= 100)', () => {
      // 100% lightning resist (immune)
      const r100 = calculateStaticFieldDamage(1000, 1000, 'normal', 100)
      expect(r100.damage).toBe(0)
      expect(r100.newHp).toBe(1000)
      expect(r100.immune).toBe(true)

      // 120% lightning resist (over-capped immune)
      const r120 = calculateStaticFieldDamage(1000, 1000, 'normal', 120)
      expect(r120.damage).toBe(0)
      expect(r120.newHp).toBe(1000)
      expect(r120.immune).toBe(true)
    })

    it('enforces 1.13c zero synergy rule (Static Field receives 0% synergy from other skills)', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(42)!

      const statsBase = new UnitStatList()
      statsBase.setBaseSkillLevel(42, 20)
      statsBase.setBaseSkillLevel(48, 20) // Nova 20
      statsBase.setBaseSkillLevel(49, 20) // Lightning 20
      const withHardPoints = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsBase,
      })
      expect(withHardPoints.synergyBonusPct).toBe(0)

      const statsSoftOnly = new UnitStatList()
      statsSoftOnly.setBaseSkillLevel(42, 20)
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
  })

  // =========================================================================
  // Dimension 5: Line-of-Sight (LOS) Raycast Obstruction
  // =========================================================================
  describe('Dimension 5: Line-of-Sight (LOS) Raycast Obstruction', () => {
    it('hasLineOfSight correctly distinguishes clear vs obstructed paths', () => {
      // Wall between x=40 and x=60
      const isWallBlocked = (x: number) => x >= 40 && x <= 60

      // Path from (0, 0) to (100, 0) intersects wall -> false
      expect(hasLineOfSight(0, 0, 100, 0, isWallBlocked)).toBe(false)

      // Path from (0, 0) to (30, 0) stays in front of wall -> true
      expect(hasLineOfSight(0, 0, 30, 0, isWallBlocked)).toBe(true)

      // Path from (70, 0) to (100, 0) stays behind wall -> true
      expect(hasLineOfSight(70, 0, 100, 0, isWallBlocked)).toBe(true)
    })

    it('executeStaticField blocks damage to targets obstructed by solid walls', () => {
      const isWallBlocked = (x: number) => x >= 40 && x <= 60
      const targetBehindWall = { id: 'wall_target', x: 100, y: 0, currentHp: 1000, maxHp: 1000 }
      const targetInOpen = { id: 'open_target', x: 0, y: 100, currentHp: 1000, maxHp: 1000 }

      const result = executeStaticField({
        casterX: 0,
        casterY: 0,
        slvl: 5,
        targets: [targetBehindWall, targetInOpen],
        difficulty: 'normal',
        isBlocked: (x: number) => isWallBlocked(x),
      })

      const behindHit = result.hits.find(h => h.targetId === 'wall_target')
      expect(behindHit).toBeDefined()
      expect(behindHit!.blockedByLos).toBe(true)
      expect(behindHit!.damage).toBe(0)
      expect(behindHit!.newHp).toBe(1000)

      const openHit = result.hits.find(h => h.targetId === 'open_target')
      expect(openHit).toBeDefined()
      expect(openHit!.blockedByLos).toBe(false)
      expect(openHit!.damage).toBe(250)
      expect(openHit!.newHp).toBe(750)
    })
  })

  // =========================================================================
  // Dimension 6: Difficulty Floor Clamps & Assembly Pre-Check Invariant
  // =========================================================================
  describe('Dimension 6: Difficulty Floor Clamps & Assembly Pre-Check Invariant', () => {
    it('Normal difficulty: 1 HP floor (cannot reduce HP below 1, never kills)', () => {
      // Monster with 10 HP takes 2 damage -> 8 HP
      const r1 = calculateStaticFieldDamage(10, 100, 'normal', 0)
      expect(r1.damage).toBe(2)
      expect(r1.newHp).toBe(8)

      // Monster with 5 HP takes 1 damage (floor(5 * 0.25) = 1) -> 4 HP
      const r2 = calculateStaticFieldDamage(5, 100, 'normal', 0)
      expect(r2.damage).toBe(1)
      expect(r2.newHp).toBe(4)

      // Monster with 2 HP: floor(2 * 0.25) = 0 damage in 1.13c integer division
      const r3 = calculateStaticFieldDamage(2, 100, 'normal', 0)
      expect(r3.damage).toBe(0)
      expect(r3.newHp).toBe(2)

      // Monster with 1 HP: pre-check (currentHp <= 1) returns 0 damage immediately!
      const r4 = calculateStaticFieldDamage(1, 100, 'normal', 0)
      expect(r4.damage).toBe(0)
      expect(r4.newHp).toBe(1)
      expect(r4.blockedByFloor).toBe(true)
    })

    it('Nightmare difficulty: 33% max HP floor', () => {
      // Monster at 400 HP / 1000 max HP (40%): cuts 25% (100) -> 300 HP (< 330 floor, clamped)
      const r400 = calculateStaticFieldDamage(400, 1000, 'nightmare', 0)
      expect(r400.damage).toBe(100)
      expect(r400.newHp).toBe(300)

      // Monster at 330 HP / 1000 max HP (33%): exactly at floor -> returns 0 damage immediately!
      const r330 = calculateStaticFieldDamage(330, 1000, 'nightmare', 0)
      expect(r330.damage).toBe(0)
      expect(r330.newHp).toBe(330)
      expect(r330.blockedByFloor).toBe(true)

      // Monster at 200 HP / 1000 max HP (20%): below floor -> returns 0 damage immediately!
      const r200 = calculateStaticFieldDamage(200, 1000, 'nightmare', 0)
      expect(r200.damage).toBe(0)
      expect(r200.newHp).toBe(200)
      expect(r200.blockedByFloor).toBe(true)
    })

    it('Hell difficulty: 50% max HP floor with authentic assembly pre-check invariant', () => {
      // Reverse-engineered assembly ground truth scenario (Spec Miner analysis):
      // Target in Hell has 1000 max HP, starts at 520 current HP (52%)
      // Floor in Hell is 50% = 500 HP

      // Cast 1: 520 > 500. Cuts 25% of 520 = 130 damage. Target reduced to 390 HP (39%)
      const cast1 = calculateStaticFieldDamage(520, 1000, 'hell', 0)
      expect(cast1.damage).toBe(130)
      expect(cast1.newHp).toBe(390)
      expect(cast1.blockedByFloor).toBe(false)

      // Cast 2: Current HP is 390 <= 500. D2Game.dll 0x6FC62F13 pre-check triggers!
      // Returns 0 damage immediately without performing damage calculation!
      const cast2 = calculateStaticFieldDamage(cast1.newHp, 1000, 'hell', 0)
      expect(cast2.damage).toBe(0)
      expect(cast2.newHp).toBe(390)
      expect(cast2.blockedByFloor).toBe(true)

      // Target at exactly 500 HP (50%): returns 0 damage immediately
      const castAtFloor = calculateStaticFieldDamage(500, 1000, 'hell', 0)
      expect(castAtFloor.damage).toBe(0)
      expect(castAtFloor.newHp).toBe(500)
      expect(castAtFloor.blockedByFloor).toBe(true)
    })
  })

  // =========================================================================
  // Dimension 7: WorldArena & Runtime Cast Integration
  // =========================================================================
  describe('Dimension 7: WorldArena & Runtime Cast Integration', () => {
    it('evaluates exact 1.13c Skills.txt formulas in skillModule.evaluate', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(42)!
      expect(skillRec).toBeDefined()
      expect(skillModule.skillId).toBe(42)
      expect(skillModule.name).toBe("Static Field")
      expect(skillModule.charClass).toBe("sor")

      const stats1 = new UnitStatList()
      stats1.setBaseSkillLevel(42, 1)
      const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
      expect(r1.manaCost).toBe(9)
      expect(r1.manaCost256).toBe(2304)
      expect(r1.minPhysDmg).toBe(0)
      expect(r1.maxPhysDmg).toBe(0)
      expect(r1.minElemDmg256).toBe(0)
      expect(r1.maxElemDmg256).toBe(0)

      const stats10 = new UnitStatList()
      stats10.setBaseSkillLevel(42, 10)
      const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
      expect(r10.manaCost).toBe(9)
      expect(r10.manaCost256).toBe(2304)
      expect(r10.minPhysDmg).toBe(0)
      expect(r10.maxPhysDmg).toBe(0)
      expect(r10.minElemDmg256).toBe(0)
      expect(r10.maxElemDmg256).toBe(0)

      const stats20 = new UnitStatList()
      stats20.setBaseSkillLevel(42, 20)
      const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
      expect(r20.manaCost).toBe(9)
      expect(r20.manaCost256).toBe(2304)
      expect(r20.minPhysDmg).toBe(0)
      expect(r20.maxPhysDmg).toBe(0)
      expect(r20.minElemDmg256).toBe(0)
      expect(r20.maxElemDmg256).toBe(0)
      expect(r20.durationFrames).toBe(0)
      expect(r20.cooldownFrames).toBe(0)
    })

    it('executes runtime skill effect in WorldArena (castCount, action frame, and combat outcome)', async () => {
      const registry = await getSharedDataRegistry()
      const arena = new WorldArena({
        registry,
        classCode: "sor",
        skillId: 42,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(42)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })

    it('verifies getSkillManaCost and getSkillCooldownTicks', () => {
      expect(getSkillManaCost(42, 1)).toBe(9)
      expect(getSkillManaCost(42, 10)).toBe(9)
      expect(getSkillManaCost(42, 20)).toBe(9)
      expect(getSkillCooldownTicks(42)).toBe(0)
    })
  })
})
