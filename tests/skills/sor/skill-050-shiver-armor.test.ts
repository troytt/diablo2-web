/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #050: Shiver Armor (SOR)
 * Gitea Tracking Issue: #204
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Canonical Schema Integrity (Skills.txt row 50, Overlay.txt shiverarmor/shiverarmor_hit, States.txt group 1)
 * D2: Visual Assets & Metadata Integrity (FrozenArmor.png/json, AuraResistColdCast.png/json, OVERLAY_METAS, zero runtime MPQ)
 * D3: Kinematics & Proactive Melee Chill/Damage (Proactive trigger on attackedinmelee, deals cold damage + applies chill)
 * D4: Collision, Attack Filtering & Edge Cases (Proactive trigger before hit roll, ignores missiles, HitShift 7 / 2 scaling)
 * D5: Synergy Calculations (Defense % AC, duration 3000f+300f/lvl, cold damage 5-band +9%/syn, stepped chill length, blvl rule)
 * D6: Lifecycle, Mana, Timers & Group 1 Mutual Exclusion (Flat 11 mana, 0 cooldown, Group 1 mutual eviction with Frozen & Chilling Armor)
 * D7: Invariants & WorldArena Integration (BATCH1_SKILLS strictly 38, WorldArena runtime cast)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList, FIXED_ONE } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-050-shiver-armor.ts'
import {
  calculateShiverArmorDefense,
  calculateShiverArmorDuration,
  calculateShiverArmorDamage,
  calculateShiverArmorChillLength,
  calculateColdArmorDuration,
  calculateSkillDamage,
  getSkillManaCost,
  getSkillCooldownTicks,
  getSkillCastOverlay,
  BATCH1_SKILLS,
} from '../../../src/server/skills/skills.ts'
import {
  FROZEN_ARMOR_OVERLAY_META,
  FROZEN_ARMOR_HIT_OVERLAY_META,
  OVERLAY_METAS,
} from '../../../src/client/render/overlays-meta.ts'

describe('[Skill #050] Shiver Armor (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #204)', () => {
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')
  const overlayTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/Overlay.txt')
  const overlayTxtContent = fs.readFileSync(overlayTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Canonical Schema Integrity
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Canonical Schema Integrity', () => {
    it('parses authentic Skills.txt row 50 (Shiver Armor)', () => {
      const lines = skillsTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const idIdx = headers.indexOf('Id')
      const skillIdx = headers.indexOf('skill')
      const charClassIdx = headers.indexOf('charclass')
      const manaIdx = headers.indexOf('mana')
      const lvlManaIdx = headers.indexOf('lvlmana')
      const manaShiftIdx = headers.indexOf('manashift')
      const srvDoFuncIdx = headers.indexOf('srvdofunc')
      const auraStateIdx = headers.indexOf('aurastate')
      const auraEvent1Idx = headers.indexOf('auraevent1')
      const auraEventFunc1Idx = headers.indexOf('auraeventfunc1')
      const auraStat1Idx = headers.indexOf('aurastat1')
      const auraStatCalc1Idx = headers.indexOf('aurastatcalc1')
      const auraLenCalcIdx = headers.indexOf('auralencalc')
      const eMinIdx = headers.indexOf('EMin')
      const eMaxIdx = headers.indexOf('EMax')
      const hitShiftIdx = headers.indexOf('HitShift')
      const eLenIdx = headers.indexOf('ELen')
      const eLevLen1Idx = headers.indexOf('ELevLen1')
      const eLevLen2Idx = headers.indexOf('ELevLen2')
      const eLevLen3Idx = headers.indexOf('ELevLen3')
      const param1Idx = headers.indexOf('Param1') !== -1 ? headers.indexOf('Param1') : headers.indexOf('param1')
      const param2Idx = headers.indexOf('Param2') !== -1 ? headers.indexOf('Param2') : headers.indexOf('param2')
      const param3Idx = headers.indexOf('Param3') !== -1 ? headers.indexOf('Param3') : headers.indexOf('param3')
      const param4Idx = headers.indexOf('Param4') !== -1 ? headers.indexOf('Param4') : headers.indexOf('param4')
      const param7Idx = headers.indexOf('Param7') !== -1 ? headers.indexOf('Param7') : headers.indexOf('param7')
      const param8Idx = headers.indexOf('Param8') !== -1 ? headers.indexOf('Param8') : headers.indexOf('param8')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx]?.trim() === '50')
      expect(row).toBeDefined()
      expect(row![skillIdx]?.trim()).toBe('Shiver Armor')
      expect(row![charClassIdx]?.trim()).toBe('sor')
      expect(Number(row![manaIdx])).toBe(11)
      expect(Number(row![lvlManaIdx])).toBe(0)
      expect(Number(row![manaShiftIdx])).toBe(8)
      expect(Number(row![srvDoFuncIdx])).toBe(18) // SKILLS_SrvDo018_DefensiveBuff
      expect(row![auraStateIdx]?.trim()).toBe('shiverarmor')
      expect(row![auraEvent1Idx]?.trim()).toBe('attackedinmelee')
      expect(Number(row![auraEventFunc1Idx])).toBe(3) // SKILLS_EventFunc03_ShiverArmor
      expect(row![auraStat1Idx]?.trim()).toBe('skill_armor_percent')
      expect(row![auraStatCalc1Idx]?.trim()).toBe('ln12')
      expect(Number(row![param1Idx])).toBe(45) // Base 45% enhanced defense
      expect(Number(row![param2Idx])).toBe(6)  // +6% defense per level
      expect(Number(row![param3Idx])).toBe(3000) // Base duration frames (120s)
      expect(Number(row![param4Idx])).toBe(300)  // +300 frames per level (12s)
      expect(Number(row![param7Idx])).toBe(250)  // +250 frames duration per synergy point (10s)
      expect(Number(row![eMinIdx])).toBe(12)    // Base 12 EMin (divided by 2 -> 6)
      expect(Number(row![eMaxIdx])).toBe(16)    // Base 16 EMax (divided by 2 -> 8)
      expect(Number(row![hitShiftIdx])).toBe(7) // HitShift 7 -> divide by 2
      expect(Number(row![eLenIdx])).toBe(100)   // 100 frames base chill length (4.0s)
      expect(Number(row![eLevLen1Idx])).toBe(0) // 0 extra frames for lvl 1-8
      expect(Number(row![eLevLen2Idx])).toBe(25) // +25 frames for lvl 9-16
      expect(Number(row![eLevLen3Idx])).toBe(50) // +50 frames for lvl 17+
      expect(Number(row![param8Idx])).toBe(9)   // +9% damage per synergy point
      expect(row![auraLenCalcIdx]?.trim()).toContain('par7')
    })

    it('parses authentic Overlay.txt for shiverarmor (body) and shiverarmor_hit (hit)', () => {
      const lines = overlayTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const overlayIdx = headers.indexOf('overlay') !== -1 ? headers.indexOf('overlay') : headers.indexOf('Overlay')
      const filenameIdx = headers.indexOf('Filename') !== -1 ? headers.indexOf('Filename') : headers.indexOf('filename')
      const framesIdx = headers.indexOf('Frames') !== -1 ? headers.indexOf('Frames') : headers.indexOf('frames')

      const bodyRow = lines.slice(1).map(l => l.split('\t')).find(r => r[overlayIdx]?.trim() === 'shiverarmor')
      expect(bodyRow).toBeDefined()
      expect(bodyRow![filenameIdx]?.trim()).toBe('FrozenArmor')
      expect(Number(bodyRow![framesIdx])).toBe(24)

      const hitRow = lines.slice(1).map(l => l.split('\t')).find(r => r[overlayIdx]?.trim() === 'shiverarmor_hit')
      expect(hitRow).toBeDefined()
      expect(hitRow![filenameIdx]?.trim()).toBe('AuraResistColdCast')
      expect(Number(hitRow![framesIdx])).toBe(11)
    })

    it('evaluates exact 1.13c formulas at slvl 1, 10, and 20 via skillModule', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(50)!
      expect(skillRec).toBeDefined()
      expect(skillModule.skillId).toBe(50)
      expect(skillModule.name).toBe('Shiver Armor')
      expect(skillModule.charClass).toBe('sor')

      const stats1 = new UnitStatList()
      stats1.setBaseSkillLevel(50, 1)
      const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
      expect(r1.manaCost).toBe(11)
      expect(r1.manaCost256).toBe(2816)
      expect(r1.minPhysDmg).toBe(0)
      expect(r1.maxPhysDmg).toBe(0)
      expect(r1.minElemDmg256).toBe(1536) // 6 * 256
      expect(r1.maxElemDmg256).toBe(2048) // 8 * 256

      const stats10 = new UnitStatList()
      stats10.setBaseSkillLevel(50, 10)
      const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
      expect(r10.manaCost).toBe(11)
      expect(r10.manaCost256).toBe(2816)
      expect(r10.minPhysDmg).toBe(0)
      expect(r10.maxPhysDmg).toBe(0)
      expect(r10.minElemDmg256).toBe(6656) // 26 * 256
      expect(r10.maxElemDmg256).toBe(8320) // 32.5 * 256

      const stats20 = new UnitStatList()
      stats20.setBaseSkillLevel(50, 20)
      const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
      expect(r20.manaCost).toBe(11)
      expect(r20.manaCost256).toBe(2816)
      expect(r20.minPhysDmg).toBe(0)
      expect(r20.maxPhysDmg).toBe(0)
      expect(r20.minElemDmg256).toBe(15360) // 60 * 256
      expect(r20.maxElemDmg256).toBe(18304) // 71.5 * 256
      expect(r20.durationFrames).toBe(8700)
      expect(r20.radiusSubtiles).toBe(159) // +159% defense bonus
      expect(r20.cooldownFrames).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Integrity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Integrity', () => {
    it('verifies baked overlay atlas sprite sheet files exist on disk with valid size', () => {
      const bodyPng = path.resolve(__dirname, '../../../public/overlays/frozenarmor.png')
      const bodyJson = path.resolve(__dirname, '../../../public/overlays/frozenarmor.json')
      const hitPng = path.resolve(__dirname, '../../../public/overlays/auraresistcoldcast.png')
      const hitJson = path.resolve(__dirname, '../../../public/overlays/auraresistcoldcast.json')

      expect(fs.existsSync(bodyPng)).toBe(true)
      expect(fs.statSync(bodyPng).size).toBeGreaterThan(1000)
      expect(fs.existsSync(bodyJson)).toBe(true)

      expect(fs.existsSync(hitPng)).toBe(true)
      expect(fs.statSync(hitPng).size).toBeGreaterThan(1000)
      expect(fs.existsSync(hitJson)).toBe(true)
    })

    it('verifies overlay metadata registrations in OVERLAY_METAS', () => {
      expect(OVERLAY_METAS['shiverarmor']).toBeDefined()
      expect(OVERLAY_METAS['shiverarmor']).toBe(FROZEN_ARMOR_OVERLAY_META)
      expect(OVERLAY_METAS['shiverarmor'].frames).toBe(24)

      expect(OVERLAY_METAS['shiverarmor_hit']).toBeDefined()
      expect(OVERLAY_METAS['shiverarmor_hit']).toBe(FROZEN_ARMOR_HIT_OVERLAY_META)
      expect(OVERLAY_METAS['shiverarmor_hit'].frames).toBe(11)

      expect(getSkillCastOverlay(50)).toBe('ice_cast_2')
    })
  })

  // =========================================================================
  // Dimension 3: Kinematics & Proactive Melee Chill/Damage
  // =========================================================================
  describe('Dimension 3: Kinematics & Proactive Melee Chill/Damage', () => {
    it('proactively damages and chills attacking melee enemy on attack initiation frame', async () => {
      const registry = await getSharedDataRegistry()
      const defenderStats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })
      defenderStats.setBaseSkillLevel(40, 10) // 10 hard points in Frozen Armor
      defenderStats.setBaseSkillLevel(60, 10) // 10 hard points in Chilling Armor
      const attackerStats = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })

      const defenderBus = new StateBus(defenderStats, registry)
      const attackerBus = new StateBus(attackerStats, registry)

      defenderBus.applyState({
        stateNameOrId: 'shiverarmor',
        sourceSkillId: 50,
        slvl: 20,
      })

      // Attacker initiates a melee attack swing (attackedinmelee)
      const out = defenderBus.triggerReactiveEvents({
        event: 'attackedinmelee',
        incomingPhys256: 150 * FIXED_ONE,
        incomingElem256: 0,
        attackerStateBus: attackerBus,
      })

      expect(out.attackerStatesApplied).toContain('cold')
      expect(attackerBus.hasState('cold')).toBe(true)
      expect(out.attackerColdDamage256).toBeGreaterThan(0)

      // Expected chill length at slvl 20: 500 frames (20s) base + synergy (20 syn points * +7% = +140% -> 1200 frames)
      const expectedChill = calculateShiverArmorChillLength(20, { frozenArmor: 10, chillingArmor: 10 })
      expect(expectedChill).toBe(1200)
      const coldState = attackerBus.getState('cold')
      expect(coldState).toBeDefined()
      expect(coldState!.durationFrames).toBe(1200)
    })

    it('evaluates calculateSkillDamage matching calculateShiverArmorDamage', () => {
      const dmg1 = calculateSkillDamage(50, 1)
      expect(dmg1).toEqual({ min: 6, max: 8 })

      const dmg10 = calculateSkillDamage(50, 10)
      expect(dmg10).toEqual({ min: 26, max: 32.5 })

      const dmg20 = calculateSkillDamage(50, 20)
      expect(dmg20).toEqual({ min: 60, max: 71.5 })

      // Synergy: +9% per point in Frozen Armor & Chilling Armor (+40 points -> +360% = 4.6x)
      const dmg20Syn = calculateShiverArmorDamage(20, { frozenArmor: 20, chillingArmor: 20 })
      expect(dmg20Syn.min).toBe(276)
      expect(dmg20Syn.max).toBe(328.9)
    })
  })

  // =========================================================================
  // Dimension 4: Collision, Attack Filtering & Edge Cases
  // =========================================================================
  describe('Dimension 4: Collision, Attack Filtering & Edge Cases', () => {
    it('proactively triggers on attackedinmelee even if attack misses (incomingPhys256 = 0)', async () => {
      const registry = await getSharedDataRegistry()
      const defenderStats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })
      const attackerStats = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })

      const defenderBus = new StateBus(defenderStats, registry)
      const attackerBus = new StateBus(attackerStats, registry)

      defenderBus.applyState({
        stateNameOrId: 'shiverarmor',
        sourceSkillId: 50,
        slvl: 20,
      })

      // Proactive event fires regardless of attack outcome
      const out = defenderBus.triggerReactiveEvents({
        event: 'attackedinmelee',
        incomingPhys256: 0,
        attackerStateBus: attackerBus,
      })

      expect(out.attackerStatesApplied).toContain('cold')
      expect(attackerBus.hasState('cold')).toBe(true)
      expect(out.attackerColdDamage256).toBeGreaterThan(0)
    })

    it('does NOT trigger on ranged missile hits (hitbymissile)', async () => {
      const registry = await getSharedDataRegistry()
      const defenderStats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })
      const attackerStats = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })

      const defenderBus = new StateBus(defenderStats, registry)
      const attackerBus = new StateBus(attackerStats, registry)

      defenderBus.applyState({
        stateNameOrId: 'shiverarmor',
        sourceSkillId: 50,
        slvl: 20,
      })

      const out = defenderBus.triggerReactiveEvents({
        event: 'hitbymissile',
        incomingPhys256: 150 * FIXED_ONE,
        attackerStateBus: attackerBus,
      })

      expect(out.attackerStatesApplied).not.toContain('cold')
      expect(attackerBus.hasState('cold')).toBe(false)
      expect(out.attackerColdDamage256).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 5: Synergy Calculations (Damage, Duration, Chill Length, Defense)
  // =========================================================================
  describe('Dimension 5: Synergy Calculations (Damage, Duration, Chill Length, Defense)', () => {
    it('calculates % Enhanced Defense: 45 + (slvl - 1) * 6', () => {
      expect(calculateShiverArmorDefense(1)).toBe(45)
      expect(calculateShiverArmorDefense(2)).toBe(51)
      expect(calculateShiverArmorDefense(10)).toBe(99)
      expect(calculateShiverArmorDefense(20)).toBe(159)
      expect(calculateShiverArmorDefense(30)).toBe(219)
    })

    it('calculates duration in frames: 3000 + (slvl - 1) * 300 + synPoints * 250', () => {
      expect(calculateShiverArmorDuration(1)).toBe(3000)   // 120s
      expect(calculateShiverArmorDuration(10)).toBe(5700)  // 228s
      expect(calculateShiverArmorDuration(20)).toBe(8700)  // 348s

      // +40 synergy points (+10s per point)
      expect(calculateShiverArmorDuration(20, { frozenArmor: 20, chillingArmor: 20 })).toBe(18700) // 748s
      expect(calculateShiverArmorDuration(20, 40)).toBe(18700)
    })

    it('calculates stepped chill length: 100f (lvl 1-8), +25f/lvl (lvl 9-16), +50f/lvl (lvl 17+)', () => {
      expect(calculateShiverArmorChillLength(1)).toBe(100)  // 4.0s
      expect(calculateShiverArmorChillLength(8)).toBe(100)  // 4.0s (no increase in first band)
      expect(calculateShiverArmorChillLength(10)).toBe(150) // 6.0s (100 + 2 * 25)
      expect(calculateShiverArmorChillLength(16)).toBe(300) // 12.0s (100 + 8 * 25)
      expect(calculateShiverArmorChillLength(20)).toBe(500) // 20.0s (300 + 4 * 50)

      // Synergy: +7% chill length per synergy point
      expect(calculateShiverArmorChillLength(20, 10)).toBe(850) // 500 * 1.70 = 850
    })

    it('enforces 1.13c blvl synergy rule (hard points only; +skills and charges give 0 synergy)', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(50)!

      const statsBase = new UnitStatList()
      statsBase.setBaseSkillLevel(50, 20)
      statsBase.setBaseSkillLevel(40, 20) // 20 hard points in Frozen Armor
      const withHardPoints = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsBase,
      })
      expect(withHardPoints.synergyBonusPct).toBe(180) // 20 * 9% = 180%

      // Soft skills + item charges must NOT affect synergy
      const statsSoftOnly = new UnitStatList()
      statsSoftOnly.setBaseSkillLevel(50, 20)
      statsSoftOnly.addStat('item_allskills', 20)
      statsSoftOnly.setChargedSkillLevel(40, 33)
      statsSoftOnly.setChargedSkillLevel(60, 33)
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
  // Dimension 6: Lifecycle, Mana, Timers & Group 1 Mutual Exclusion
  // =========================================================================
  describe('Dimension 6: Lifecycle, Mana, Timers & Group 1 Mutual Exclusion', () => {
    it('verifies constant mana cost 11 and 0 cooldown ticks', () => {
      expect(getSkillManaCost(50, 1)).toBe(11)
      expect(getSkillManaCost(50, 10)).toBe(11)
      expect(getSkillManaCost(50, 20)).toBe(11)
      expect(getSkillCooldownTicks(50)).toBe(0)
    })

    it('enforces State Group 1 mutual exclusion between Frozen, Shiver, and Chilling Armor', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })
      const bus = new StateBus(stats, registry)

      // 1. Cast Shiver Armor
      bus.applyState({ stateNameOrId: 'shiverarmor', sourceSkillId: 50, slvl: 20 })
      expect(bus.hasState('shiverarmor')).toBe(true)
      expect(bus.hasState('frozenarmor')).toBe(false)
      expect(bus.hasState('chillingarmor')).toBe(false)

      // 2. Cast Frozen Armor -> must evict Shiver Armor
      bus.applyState({ stateNameOrId: 'frozenarmor', sourceSkillId: 40, slvl: 20 })
      expect(bus.hasState('shiverarmor')).toBe(false)
      expect(bus.hasState('frozenarmor')).toBe(true)
      expect(bus.hasState('chillingarmor')).toBe(false)

      // 3. Cast Shiver Armor again -> must evict Frozen Armor
      bus.applyState({ stateNameOrId: 'shiverarmor', sourceSkillId: 50, slvl: 20 })
      expect(bus.hasState('shiverarmor')).toBe(true)
      expect(bus.hasState('frozenarmor')).toBe(false)
      expect(bus.hasState('chillingarmor')).toBe(false)

      // 4. Cast Chilling Armor -> must evict Shiver Armor
      bus.applyState({ stateNameOrId: 'chillingarmor', sourceSkillId: 60, slvl: 20 })
      expect(bus.hasState('shiverarmor')).toBe(false)
      expect(bus.hasState('frozenarmor')).toBe(false)
      expect(bus.hasState('chillingarmor')).toBe(true)
    })
  })

  // =========================================================================
  // Dimension 7: Invariants & WorldArena Integration
  // =========================================================================
  describe('Dimension 7: Invariants & WorldArena Integration', () => {
    it('enforces BATCH1_SKILLS length invariant strictly 38', () => {
      expect(Object.keys(BATCH1_SKILLS).length).toBe(38)
    })

    it('executes runtime cast in WorldArena with action frame and state application', async () => {
      const registry = await getSharedDataRegistry()
      const arena = new WorldArena({
        registry,
        classCode: 'sor',
        skillId: 50,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(50)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })
  })
})
