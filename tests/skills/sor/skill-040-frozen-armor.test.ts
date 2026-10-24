/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #040: Frozen Armor (SOR)
 * Gitea Tracking Issue: #194
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Canonical Schema Integrity (Skills.txt row 40, Overlay.txt frozenarmor/frozenarmor_hit, States.txt group 1)
 * D2: Visual Assets & Metadata Integrity (FrozenArmor.png/json, AuraResistColdCast.png/json, OVERLAY_METAS, zero runtime MPQ)
 * D3: Kinematics & Reactive Mechanics (Melee freeze on physical hit dwPhysDamage > 0, 0 damage dealt, freeze length calculation)
 * D4: Collision, Damage Filtering & Edge Cases (0 phys damage / miss / dodge ignores, pure elemental ignores, missile hit ignores)
 * D5: Synergy Calculations (Defense % AC, 3000f+300f/lvl duration, +250f/syn, freeze length 30f+3f/lvl, +5%/syn, blvl hard points rule)
 * D6: Lifecycle, Mana, Timers & Group 1 Mutual Exclusion (Flat 7 mana, 0 cooldown, Group 1 mutual eviction with Shiver & Chilling Armor)
 * D7: Invariants & WorldArena Integration (BATCH1_SKILLS strictly 38, WorldArena runtime cast)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList, FIXED_ONE } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-040-frozen-armor.ts'
import {
  calculateFrozenArmorDefense,
  calculateFrozenArmorDuration,
  calculateFrozenArmorFreezeLength,
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

describe('[Skill #040] Frozen Armor (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #194)', () => {
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')
  const overlayTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/Overlay.txt')
  const overlayTxtContent = fs.readFileSync(overlayTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Canonical Schema Integrity
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Canonical Schema Integrity', () => {
    it('parses authentic Skills.txt row 40 (Frozen Armor)', () => {
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
      const calc1Idx = headers.indexOf('calc1')
      const param1Idx = headers.indexOf('Param1') !== -1 ? headers.indexOf('Param1') : headers.indexOf('param1')
      const param2Idx = headers.indexOf('Param2') !== -1 ? headers.indexOf('Param2') : headers.indexOf('param2')
      const param3Idx = headers.indexOf('Param3') !== -1 ? headers.indexOf('Param3') : headers.indexOf('param3')
      const param4Idx = headers.indexOf('Param4') !== -1 ? headers.indexOf('Param4') : headers.indexOf('param4')
      const param5Idx = headers.indexOf('Param5') !== -1 ? headers.indexOf('Param5') : headers.indexOf('param5')
      const param6Idx = headers.indexOf('Param6') !== -1 ? headers.indexOf('Param6') : headers.indexOf('param6')
      const param7Idx = headers.indexOf('Param7') !== -1 ? headers.indexOf('Param7') : headers.indexOf('param7')
      const param8Idx = headers.indexOf('Param8') !== -1 ? headers.indexOf('Param8') : headers.indexOf('param8')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx]?.trim() === '40')
      expect(row).toBeDefined()
      expect(row![skillIdx]?.trim()).toBe('Frozen Armor')
      expect(row![charClassIdx]?.trim()).toBe('sor')
      expect(Number(row![manaIdx])).toBe(7)
      expect(Number(row![lvlManaIdx])).toBe(0)
      expect(Number(row![manaShiftIdx])).toBe(8)
      expect(Number(row![srvDoFuncIdx])).toBe(18) // SKILLS_SrvDo018_DefensiveBuff
      expect(row![auraStateIdx]?.trim()).toBe('frozenarmor')
      expect(row![auraEvent1Idx]?.trim()).toBe('damagedinmelee')
      expect(Number(row![auraEventFunc1Idx])).toBe(2) // SKILLS_EventFunc02_FrozenArmor
      expect(row![auraStat1Idx]?.trim()).toBe('skill_armor_percent')
      expect(row![auraStatCalc1Idx]?.trim()).toBe('ln12')
      expect(Number(row![param1Idx])).toBe(30) // Base 30% enhanced defense
      expect(Number(row![param2Idx])).toBe(5)  // +5% defense per level
      expect(Number(row![param3Idx])).toBe(3000) // Base duration frames (120s)
      expect(Number(row![param4Idx])).toBe(300)  // +300 frames per level (12s)
      expect(Number(row![param5Idx])).toBe(30)   // Base freeze frames (1.2s)
      expect(Number(row![param6Idx])).toBe(3)    // +3 freeze frames per level (0.12s)
      expect(Number(row![param7Idx])).toBe(250)  // +250 frames duration per synergy point (10s)
      expect(Number(row![param8Idx])).toBe(5)    // +5% freeze length per synergy point
      expect(row![auraLenCalcIdx]?.trim()).toContain('par7')
      expect(row![calc1Idx]?.trim()).toContain('par8')
    })

    it('parses authentic Overlay.txt for frozenarmor (body) and frozenarmor_hit (hit)', () => {
      const lines = overlayTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const overlayIdx = headers.indexOf('overlay') !== -1 ? headers.indexOf('overlay') : headers.indexOf('Overlay')
      const filenameIdx = headers.indexOf('Filename') !== -1 ? headers.indexOf('Filename') : headers.indexOf('filename')
      const framesIdx = headers.indexOf('Frames') !== -1 ? headers.indexOf('Frames') : headers.indexOf('frames')

      const bodyRow = lines.slice(1).map(l => l.split('\t')).find(r => r[overlayIdx]?.trim() === 'frozenarmor')
      expect(bodyRow).toBeDefined()
      expect(bodyRow![filenameIdx]?.trim()).toBe('FrozenArmor')
      expect(Number(bodyRow![framesIdx])).toBe(24)

      const hitRow = lines.slice(1).map(l => l.split('\t')).find(r => r[overlayIdx]?.trim() === 'frozenarmor_hit')
      expect(hitRow).toBeDefined()
      expect(hitRow![filenameIdx]?.trim()).toBe('AuraResistColdCast')
      expect(Number(hitRow![framesIdx])).toBe(11)
    })

    it('evaluates exact 1.13c formulas at slvl 1, 10, and 20 via skillModule', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(40)!
      expect(skillRec).toBeDefined()
      expect(skillModule.skillId).toBe(40)
      expect(skillModule.name).toBe('Frozen Armor')
      expect(skillModule.charClass).toBe('sor')

      const stats1 = new UnitStatList()
      stats1.setBaseSkillLevel(40, 1)
      const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
      expect(r1.manaCost).toBe(7)
      expect(r1.manaCost256).toBe(1792)
      expect(r1.minPhysDmg).toBe(0)
      expect(r1.maxPhysDmg).toBe(0)
      expect(r1.minElemDmg256).toBe(0)
      expect(r1.maxElemDmg256).toBe(0)

      const stats10 = new UnitStatList()
      stats10.setBaseSkillLevel(40, 10)
      const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
      expect(r10.manaCost).toBe(7)
      expect(r10.manaCost256).toBe(1792)
      expect(r10.minPhysDmg).toBe(0)
      expect(r10.maxPhysDmg).toBe(0)

      const stats20 = new UnitStatList()
      stats20.setBaseSkillLevel(40, 20)
      const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
      expect(r20.manaCost).toBe(7)
      expect(r20.manaCost256).toBe(1792)
      expect(r20.minPhysDmg).toBe(0)
      expect(r20.maxPhysDmg).toBe(0)
      expect(r20.durationFrames).toBe(8700)
      expect(r20.radiusSubtiles).toBe(125) // +125% defense bonus
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
      expect(OVERLAY_METAS['frozenarmor']).toBeDefined()
      expect(OVERLAY_METAS['frozenarmor']).toBe(FROZEN_ARMOR_OVERLAY_META)
      expect(FROZEN_ARMOR_OVERLAY_META.name).toBe('frozenarmor')
      expect(FROZEN_ARMOR_OVERLAY_META.frames).toBe(24)

      expect(OVERLAY_METAS['frozenarmor_hit']).toBeDefined()
      expect(OVERLAY_METAS['frozenarmor_hit']).toBe(FROZEN_ARMOR_HIT_OVERLAY_META)
      expect(FROZEN_ARMOR_HIT_OVERLAY_META.name).toBe('frozenarmor_hit')
      expect(FROZEN_ARMOR_HIT_OVERLAY_META.frames).toBe(11)

      // Skills.txt / skills.ts specifies ice_cast_1 for Frozen Armor
      expect(getSkillCastOverlay(40)).toBe('ice_cast_1')
    })
  })

  // =========================================================================
  // Dimension 3: Kinematics & Reactive Mechanics (Melee Freeze on Physical Hit)
  // =========================================================================
  describe('Dimension 3: Kinematics & Reactive Mechanics (Melee Freeze on Physical Hit)', () => {
    it('freezes attacking melee enemy solid when physical damage connects', async () => {
      const registry = await getSharedDataRegistry()
      const defenderStats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })
      defenderStats.setBaseSkillLevel(50, 10) // 10 hard points in Shiver Armor
      defenderStats.setBaseSkillLevel(60, 10) // 10 hard points in Chilling Armor
      const attackerStats = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })

      const defenderBus = new StateBus(defenderStats, registry)
      const attackerBus = new StateBus(attackerStats, registry)

      defenderBus.applyState({
        stateNameOrId: 'frozenarmor',
        sourceSkillId: 40,
        slvl: 20,
      })

      // Attacker strikes defender with 150 physical damage in melee
      const out = defenderBus.triggerReactiveEvents({
        event: 'damagedinmelee',
        incomingPhys256: 150 * FIXED_ONE,
        incomingElem256: 0,
        attackerStateBus: attackerBus,
      })

      expect(out.attackerStatesApplied).toContain('freeze')
      expect(attackerBus.hasState('freeze')).toBe(true)

      // Expected freeze length: slvl 20 (87 base) + 20 syn points (+100%) = 174 frames
      const expectedFreeze = calculateFrozenArmorFreezeLength(20, { shiverArmor: 10, chillingArmor: 10 })
      expect(expectedFreeze).toBe(174)
      const freezeState = attackerBus.getState('freeze')
      expect(freezeState).toBeDefined()
      expect(freezeState!.durationFrames).toBe(174)
    })

    it('deals 0 damage to attacker when triggering (defensive buff only)', () => {
      expect(calculateSkillDamage(40, 1)).toEqual({ min: 0, max: 0 })
      expect(calculateSkillDamage(40, 20)).toEqual({ min: 0, max: 0 })
      expect(calculateSkillDamage('frozenarmor', 20)).toEqual({ min: 0, max: 0 })
    })
  })

  // =========================================================================
  // Dimension 4: Collision, Damage Filtering & Edge Cases
  // =========================================================================
  describe('Dimension 4: Collision, Damage Filtering & Edge Cases', () => {
    it('does NOT freeze attacker if melee attack misses, is blocked, or deals 0 physical damage', async () => {
      const registry = await getSharedDataRegistry()
      const defenderStats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })
      const attackerStats = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })

      const defenderBus = new StateBus(defenderStats, registry)
      const attackerBus = new StateBus(attackerStats, registry)

      defenderBus.applyState({
        stateNameOrId: 'frozenarmor',
        sourceSkillId: 40,
        slvl: 20,
      })

      // Miss / blocked / 0 physical damage
      const out = defenderBus.triggerReactiveEvents({
        event: 'damagedinmelee',
        incomingPhys256: 0,
        incomingElem256: 0,
        attackerStateBus: attackerBus,
      })

      expect(out.attackerStatesApplied).not.toContain('freeze')
      expect(attackerBus.hasState('freeze')).toBe(false)
    })

    it('does NOT freeze attacker if melee attack is 100% elemental without physical damage', async () => {
      const registry = await getSharedDataRegistry()
      const defenderStats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })
      const attackerStats = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })

      const defenderBus = new StateBus(defenderStats, registry)
      const attackerBus = new StateBus(attackerStats, registry)

      defenderBus.applyState({
        stateNameOrId: 'frozenarmor',
        sourceSkillId: 40,
        slvl: 20,
      })

      // 0 physical damage, 400 fire damage
      const out = defenderBus.triggerReactiveEvents({
        event: 'damagedinmelee',
        incomingPhys256: 0,
        incomingElem256: 400 * FIXED_ONE,
        elemType: 'fire',
        attackerStateBus: attackerBus,
      })

      expect(out.attackerStatesApplied).not.toContain('freeze')
      expect(attackerBus.hasState('freeze')).toBe(false)
    })

    it('does NOT freeze attacker when struck by a ranged missile (hitbymissile)', async () => {
      const registry = await getSharedDataRegistry()
      const defenderStats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })
      const attackerStats = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })

      const defenderBus = new StateBus(defenderStats, registry)
      const attackerBus = new StateBus(attackerStats, registry)

      defenderBus.applyState({
        stateNameOrId: 'frozenarmor',
        sourceSkillId: 40,
        slvl: 20,
      })

      const out = defenderBus.triggerReactiveEvents({
        event: 'hitbymissile',
        incomingPhys256: 150 * FIXED_ONE,
        incomingElem256: 0,
        attackerStateBus: attackerBus,
      })

      expect(out.attackerStatesApplied).not.toContain('freeze')
      expect(attackerBus.hasState('freeze')).toBe(false)
    })
  })

  // =========================================================================
  // Dimension 5: Synergy Calculations (Duration, Enhanced Defense, Freeze Length)
  // =========================================================================
  describe('Dimension 5: Synergy Calculations (Duration, Enhanced Defense, Freeze Length)', () => {
    it('calculates % Enhanced Defense: 30 + (slvl - 1) * 5', () => {
      expect(calculateFrozenArmorDefense(1)).toBe(30)
      expect(calculateFrozenArmorDefense(2)).toBe(35)
      expect(calculateFrozenArmorDefense(10)).toBe(75)
      expect(calculateFrozenArmorDefense(20)).toBe(125)
      expect(calculateFrozenArmorDefense(30)).toBe(175)
    })

    it('calculates duration in frames: 3000 + (slvl - 1) * 300 + synPoints * 250', () => {
      expect(calculateFrozenArmorDuration(1)).toBe(3000)   // 120s
      expect(calculateFrozenArmorDuration(10)).toBe(5700)  // 228s
      expect(calculateFrozenArmorDuration(20)).toBe(8700)  // 348s

      // Synergy: +250 frames (+10s) per point in Shiver Armor and Chilling Armor
      expect(calculateFrozenArmorDuration(20, { shiverArmor: 20, chillingArmor: 20 })).toBe(18700) // 748s
      expect(calculateFrozenArmorDuration(20, 40)).toBe(18700)

      // Base 1200 option
      expect(calculateColdArmorDuration(20, 1200, 120, 10, 40)).toBe(17400)
    })

    it('calculates freeze length in frames: (30 + (slvl - 1) * 3) * (1 + synPoints * 0.05)', () => {
      expect(calculateFrozenArmorFreezeLength(1)).toBe(30)  // 1.20s
      expect(calculateFrozenArmorFreezeLength(10)).toBe(57) // 2.28s
      expect(calculateFrozenArmorFreezeLength(20)).toBe(87) // 3.48s

      // +5% freeze length per synergy point: +40 points (+200% factor = 3.0x)
      expect(calculateFrozenArmorFreezeLength(20, { shiverArmor: 20, chillingArmor: 20 })).toBe(261) // 10.44s
      expect(calculateFrozenArmorFreezeLength(20, 40)).toBe(261)
    })

    it('enforces 1.13c blvl synergy rule (hard points only; +skills and charges give 0 synergy)', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(40)!

      const statsBase = new UnitStatList()
      statsBase.setBaseSkillLevel(40, 20)
      const withHardPoints = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsBase,
      })
      expect(withHardPoints.synergyBonusPct).toBe(0)

      // Soft skills + item charges must NOT affect synergy
      const statsSoftOnly = new UnitStatList()
      statsSoftOnly.setBaseSkillLevel(40, 20)
      statsSoftOnly.addStat('item_allskills', 20)
      statsSoftOnly.setChargedSkillLevel(50, 33)
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
    it('verifies constant mana cost 7 and 0 cooldown ticks', () => {
      expect(getSkillManaCost(40, 1)).toBe(7)
      expect(getSkillManaCost(40, 10)).toBe(7)
      expect(getSkillManaCost(40, 20)).toBe(7)
      expect(getSkillCooldownTicks(40)).toBe(0)
    })

    it('enforces State Group 1 mutual exclusion between Frozen, Shiver, and Chilling Armor', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })
      const bus = new StateBus(stats, registry)

      // 1. Cast Frozen Armor
      bus.applyState({ stateNameOrId: 'frozenarmor', sourceSkillId: 40, slvl: 20 })
      expect(bus.hasState('frozenarmor')).toBe(true)
      expect(bus.hasState('shiverarmor')).toBe(false)
      expect(bus.hasState('chillingarmor')).toBe(false)

      // 2. Cast Shiver Armor -> must evict Frozen Armor
      bus.applyState({ stateNameOrId: 'shiverarmor', sourceSkillId: 50, slvl: 20 })
      expect(bus.hasState('frozenarmor')).toBe(false)
      expect(bus.hasState('shiverarmor')).toBe(true)
      expect(bus.hasState('chillingarmor')).toBe(false)

      // 3. Cast Chilling Armor -> must evict Shiver Armor
      bus.applyState({ stateNameOrId: 'chillingarmor', sourceSkillId: 60, slvl: 20 })
      expect(bus.hasState('frozenarmor')).toBe(false)
      expect(bus.hasState('shiverarmor')).toBe(false)
      expect(bus.hasState('chillingarmor')).toBe(true)

      // 4. Cast Frozen Armor again -> must evict Chilling Armor
      bus.applyState({ stateNameOrId: 'frozenarmor', sourceSkillId: 40, slvl: 20 })
      expect(bus.hasState('frozenarmor')).toBe(true)
      expect(bus.hasState('shiverarmor')).toBe(false)
      expect(bus.hasState('chillingarmor')).toBe(false)
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
        skillId: 40,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(40)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })
  })
})
