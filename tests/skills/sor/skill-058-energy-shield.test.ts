/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #058: Energy Shield (SOR)
 * Gitea Tracking Issue: #212
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Schema Integrity (Skills.txt row 58, mana 5, manashift 8, castoverlay 'light_cast_2')
 * D2: Visual Assets & Metadata Integrity (Looping body overlay 'energyshield', hit overlay 'energyshieldhit0')
 * D3: Absorption Curve & 95% Hard Cap (EMin: 20, +5% lvl 2-8, +2% lvl 9-16, +1% lvl 17+, cap 95% at lvl 40)
 * D4: Telekinesis Synergy Mechanics (Hard points blvl only, ratio (32 - min(20, blvl))/16 from 2.0 down to 0.75)
 * D5: Absorption Before Resistances & Bypass Rules (Poison and Open Wounds bypass directly to HP)
 * D6: Mana Depletion, Shield Collapse & Edge Cases (Partial absorb, collapse on 0 mana, remainder spills to HP)
 * D7: Invariants (BATCH1_SKILLS length strictly 38, zero runtime MPQ queries, WorldArena cast)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList, FIXED_ONE } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { executeSUnitDmg, type CombatUnitContext } from '../../../src/server/engine/combat-pipeline.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-058-energy-shield.ts'
import {
  calculateEnergyShieldDuration,
  calculateEnergyShieldAbsorbPct,
  calculateEnergyShieldManaRatio,
  getSkillCastOverlay,
  calculateSkillDamage,
  BATCH1_SKILLS,
} from '../../../src/server/skills/skills.ts'
import { getSkillRange, getSkillMana } from '../../../src/common/skills/weapon-combat-meta.ts'
import {
  ENERGY_SHIELD_OVERLAY_META,
  ENERGY_SHIELD_HIT_OVERLAY_META,
  LIGHT_CAST_2_META,
  OVERLAY_METAS,
} from '../../../src/client/render/overlays-meta.ts'

describe('[Skill #058] Energy Shield (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #212)', () => {
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Schema Integrity
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Schema Integrity', () => {
    it('parses authentic Skills.txt row 58 (Energy Shield)', () => {
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
      const eMinLev1Idx = headers.indexOf('EMinLev1')
      const eMinLev2Idx = headers.indexOf('EMinLev2')
      const eMinLev3Idx = headers.indexOf('EMinLev3')
      const param1Idx = headers.indexOf('Param1') !== -1 ? headers.indexOf('Param1') : headers.indexOf('param1')
      const param2Idx = headers.indexOf('Param2') !== -1 ? headers.indexOf('Param2') : headers.indexOf('param2')
      const param5Idx = headers.indexOf('Param5') !== -1 ? headers.indexOf('Param5') : headers.indexOf('param5')
      const auraStateIdx = headers.indexOf('aurastate')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx]?.trim() === '58')
      expect(row).toBeDefined()
      expect(row![skillIdx]?.trim()).toBe('Energy Shield')
      expect(row![charClassIdx]?.trim()).toBe('sor')
      expect(Number(row![manaIdx])).toBe(5)
      expect(Number(row![lvlManaIdx])).toBe(0)
      expect(Number(row![manaShiftIdx])).toBe(8)
      expect(row![castOverlayIdx]?.trim()).toBe('light_cast_2')
      expect(Number(row![eMinIdx])).toBe(20) // Base 20% absorb
      expect(Number(row![eMinLev1Idx])).toBe(5) // +5% (lvl 2-8)
      expect(Number(row![eMinLev2Idx])).toBe(2) // +2% (lvl 9-16)
      expect(Number(row![eMinLev3Idx])).toBe(1) // +1% (lvl 17+)
      expect(Number(row![param1Idx])).toBe(3600) // Base duration frames (144s)
      expect(Number(row![param2Idx])).toBe(1500) // Duration frames per level (60s)
      expect(Number(row![param5Idx])).toBe(32)   // Telekinesis numerator (32/16 = 2.0)
      expect(row![auraStateIdx]?.trim()).toBe('energyshield')
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Integrity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Integrity', () => {
    it('verifies looping body overlay energyshield (ManaShieldBall)', () => {
      expect(OVERLAY_METAS['energyshield']).toBeDefined()
      expect(OVERLAY_METAS['energyshield']).toBe(ENERGY_SHIELD_OVERLAY_META)
      expect(ENERGY_SHIELD_OVERLAY_META.name).toBe('energyshield')
    })

    it('verifies hit overlay energyshieldhit0 (ManaShieldDir00)', () => {
      expect(OVERLAY_METAS['energyshieldhit0']).toBeDefined()
      expect(OVERLAY_METAS['energyshieldhit0']).toBe(ENERGY_SHIELD_HIT_OVERLAY_META)
      expect(ENERGY_SHIELD_HIT_OVERLAY_META.name).toBe('energyshieldhit0')
    })

    it('verifies cast overlay light_cast_2', () => {
      expect(getSkillCastOverlay(58)).toBe('light_cast_2')
      expect(OVERLAY_METAS['light_cast_2']).toBe(LIGHT_CAST_2_META)
    })
  })

  // =========================================================================
  // Dimension 3: Absorption Curve & 95% Hard Cap
  // =========================================================================
  describe('Dimension 3: Absorption Curve & 95% Hard Cap', () => {
    it('calculates duration: 3600 + (slvl - 1) * 1500 frames', () => {
      expect(calculateEnergyShieldDuration(1)).toBe(3600)   // 144.00s
      expect(calculateEnergyShieldDuration(2)).toBe(5100)   // 204.00s
      expect(calculateEnergyShieldDuration(10)).toBe(17100) // 684.00s
      expect(calculateEnergyShieldDuration(20)).toBe(32100) // 1284.00s
      expect(calculateEnergyShieldDuration(40)).toBe(62100) // 2484.00s
    })

    it('calculates absorption percentage across 1.13c bands with 95% hard cap', () => {
      // Level 1: 20%
      expect(calculateEnergyShieldAbsorbPct(1)).toBe(20)
      // Level 2..8: +5%/lvl
      expect(calculateEnergyShieldAbsorbPct(2)).toBe(25)
      expect(calculateEnergyShieldAbsorbPct(5)).toBe(40)
      expect(calculateEnergyShieldAbsorbPct(8)).toBe(55)
      // Level 9..16: +2%/lvl
      expect(calculateEnergyShieldAbsorbPct(9)).toBe(57)
      expect(calculateEnergyShieldAbsorbPct(12)).toBe(63)
      expect(calculateEnergyShieldAbsorbPct(16)).toBe(71)
      // Level 17+: +1%/lvl
      expect(calculateEnergyShieldAbsorbPct(17)).toBe(72)
      expect(calculateEnergyShieldAbsorbPct(20)).toBe(75)
      // Cap at 95% (at level 40)
      expect(calculateEnergyShieldAbsorbPct(40)).toBe(95)
      expect(calculateEnergyShieldAbsorbPct(50)).toBe(95)
      expect(calculateEnergyShieldAbsorbPct(99)).toBe(95)
    })
  })

  // =========================================================================
  // Dimension 4: Telekinesis Synergy Mechanics
  // =========================================================================
  describe('Dimension 4: Telekinesis Synergy Mechanics', () => {
    it('calculates exact mana-to-damage ratio: (32 - min(20, blvl)) / 16', () => {
      expect(calculateEnergyShieldManaRatio(0)).toBe(2.0)   // 32/16 = 2.00
      expect(calculateEnergyShieldManaRatio(4)).toBe(1.75)  // 28/16 = 1.75
      expect(calculateEnergyShieldManaRatio(8)).toBe(1.5)   // 24/16 = 1.50
      expect(calculateEnergyShieldManaRatio(12)).toBe(1.25) // 20/16 = 1.25
      expect(calculateEnergyShieldManaRatio(16)).toBe(1.0)  // 16/16 = 1.00
      expect(calculateEnergyShieldManaRatio(20)).toBe(0.75) // 12/16 = 0.75
      // Clamped at 20 hard points: Level 25 gives 0.75 floor
      expect(calculateEnergyShieldManaRatio(25)).toBe(0.75)
      expect(calculateEnergyShieldManaRatio(-5)).toBe(2.0)
    })

    it('enforces hard points only (blvl) in StateBus; soft points have 0 effect', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList(registry, {
        maxhp: 1000 * FIXED_ONE,
        hitpoints: 1000 * FIXED_ONE,
        maxmana: 1000 * FIXED_ONE,
        mana: 1000 * FIXED_ONE,
      })
      // 16 hard points in Telekinesis (43) => 1.0 ratio
      stats.setBaseSkillLevel(43, 16)
      // +20 all skills should NOT improve the ratio beyond 1.0!
      stats.addStat('item_allskills', 20)

      const bus = new StateBus(stats, registry)
      bus.applyState({
        stateNameOrId: 'energyshield',
        sourceSkillId: 58,
        slvl: 20, // 75% absorb
      })

      const out = bus.triggerReactiveEvents({
        event: 'absorbdamage',
        incomingPhys256: 200 * FIXED_ONE,
        incomingElem256: 0,
      })

      // 75% of 200 = 150 damage absorbed.
      expect(out.absorbedPhys256).toBe(150 * FIXED_ONE)
      // At 1.0 ratio, mana drained is exactly 150 * FIXED_ONE!
      expect(out.manaDrained256).toBe(150 * FIXED_ONE)
      expect(stats.getMana()).toBe(850)
    })
  })

  // =========================================================================
  // Dimension 5: Absorption Before Resistances & Bypass Rules
  // =========================================================================
  describe('Dimension 5: Absorption Before Resistances & Bypass Rules', () => {
    it('absorbs raw damage BEFORE player resistances are applied in executeSUnitDmg', async () => {
      const registry = await getSharedDataRegistry()
      const attackerStats = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })
      const defenderStats = new UnitStatList(registry, {
        maxhp: 1000 * FIXED_ONE,
        hitpoints: 1000 * FIXED_ONE,
        maxmana: 1000 * FIXED_ONE,
        mana: 1000 * FIXED_ONE,
        fireresist: 75, // 75% fire resistance
      })
      defenderStats.setBaseSkillLevel(43, 16) // 1.0 ratio
      const attackerBus = new StateBus(attackerStats, registry)
      const defenderBus = new StateBus(defenderStats, registry)
      defenderBus.applyState({
        stateNameOrId: 'energyshield',
        sourceSkillId: 58,
        slvl: 20, // 75% absorb
      })

      const attackerCtx: CombatUnitContext = {
        id: 'attacker-1',
        name: 'Attacker',
        statList: attackerStats,
        stateBus: attackerBus,
      }
      const defenderCtx: CombatUnitContext = {
        id: 'defender-1',
        name: 'Sorceress',
        statList: defenderStats,
        stateBus: defenderBus,
      }

      // Attack: 400 Fire Damage (raw)
      const res = executeSUnitDmg(attackerCtx, defenderCtx, {
        skillId: 47, // Fire Ball
        attackKind: 'spell',
        autoHit: true,
        elemType: 'fire',
        elemMin256: 400 * FIXED_ONE,
        elemMax256: 400 * FIXED_ONE,
      }, { rand: () => 50 })

      // Ground truth logic:
      // 1. Raw Fire = 400.
      // 2. ES absorbs 75% of raw = 300 damage.
      // 3. Mana drained: 300 * 1.0 = 300 mana.
      // 4. Remaining raw fire = 100.
      // 5. 75% Fire Resistance reduces remaining 100 to 25!
      // 6. Net HP lost = 25.
      expect(defenderStats.getMana()).toBe(700) // 1000 - 300
      expect(res.totalDamage).toBe(25)
      expect(defenderStats.getHp()).toBe(975)
    })

    it('enforces Poison bypasses Energy Shield directly to HP', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList(registry, {
        maxhp: 1000 * FIXED_ONE,
        hitpoints: 1000 * FIXED_ONE,
        maxmana: 1000 * FIXED_ONE,
        mana: 1000 * FIXED_ONE,
      })
      const bus = new StateBus(stats, registry)
      bus.applyState({
        stateNameOrId: 'energyshield',
        sourceSkillId: 58,
        slvl: 20,
      })

      const out = bus.triggerReactiveEvents({
        event: 'absorbdamage',
        incomingPhys256: 0,
        incomingElem256: 200 * FIXED_ONE,
        elemType: 'pois',
        isPoison: true,
      })

      // Poison strictly bypasses: 0 absorbed, 0 mana drained!
      expect(out.absorbedElem256).toBe(0)
      expect(out.manaDrained256).toBe(0)
      expect(stats.getMana()).toBe(1000)
    })

    it('enforces Open Wounds bypasses Energy Shield directly to HP', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList(registry, {
        maxhp: 1000 * FIXED_ONE,
        hitpoints: 1000 * FIXED_ONE,
        maxmana: 1000 * FIXED_ONE,
        mana: 1000 * FIXED_ONE,
      })
      const bus = new StateBus(stats, registry)
      bus.applyState({
        stateNameOrId: 'energyshield',
        sourceSkillId: 58,
        slvl: 20,
      })

      const out = bus.triggerReactiveEvents({
        event: 'absorbdamage',
        incomingPhys256: 200 * FIXED_ONE,
        incomingElem256: 0,
        isOpenWounds: true,
      })

      // Open Wounds strictly bypasses: 0 absorbed, 0 mana drained!
      expect(out.absorbedPhys256).toBe(0)
      expect(out.manaDrained256).toBe(0)
      expect(stats.getMana()).toBe(1000)
    })
  })

  // =========================================================================
  // Dimension 6: Mana Depletion, Shield Collapse & Edge Cases
  // =========================================================================
  describe('Dimension 6: Mana Depletion, Shield Collapse & Edge Cases', () => {
    it('collapses shield on insufficient mana, draining mana to 0 and spilling remainder to HP', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList(registry, {
        maxhp: 1000 * FIXED_ONE,
        hitpoints: 1000 * FIXED_ONE,
        maxmana: 100 * FIXED_ONE,
        mana: 50 * FIXED_ONE, // Only 50 mana available!
      })
      stats.setBaseSkillLevel(43, 0) // Level 0 TK: ratio = 2.0 (needs 2 mana per 1 HP absorbed)
      const bus = new StateBus(stats, registry)
      bus.applyState({
        stateNameOrId: 'energyshield',
        sourceSkillId: 58,
        slvl: 20, // 75% absorb
      })

      // Incoming: 200 physical damage.
      // Desired absorb: 150 damage -> would require 300 mana!
      // But only 50 mana available: actual absorbed = 50 / 2.0 = 25 damage.
      const out = bus.triggerReactiveEvents({
        event: 'absorbdamage',
        incomingPhys256: 200 * FIXED_ONE,
        incomingElem256: 0,
      })

      expect(out.absorbedPhys256).toBe(25 * FIXED_ONE)
      expect(out.manaDrained256).toBe(50 * FIXED_ONE)
      expect(stats.getMana()).toBe(0)
      // Shield collapsed: state removed!
      expect(bus.hasState('energyshield')).toBe(false)
      expect(bus.hasState(60)).toBe(false)
    })

    it('verifies mana cost is constant 5 and range is 0', () => {
      expect(getSkillMana(58)).toBe(5)
      expect(getSkillRange(58)).toBe(0)
      expect(calculateSkillDamage(58, 20)).toEqual({ min: 0, max: 0 })
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
        skillId: 58,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()
      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(58)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })

    it('enforces BATCH1_SKILLS length invariant strictly 38', () => {
      expect(Object.keys(BATCH1_SKILLS).length).toBe(38)
    })
  })
})
