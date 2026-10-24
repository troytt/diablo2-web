/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #060: Chilling Armor (SOR)
 * Gitea Tracking Issue: #214
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Canonical Schema Integrity (Skills.txt row 60, Missiles.txt row 264, Overlay.txt chillarmor, States.txt group 1)
 * D2: Visual Assets & Metadata Integrity (FrozenArmor.png/json, AuraResistColdCast.png/json, icebolt.png/json, MISSILE_METAS, zero runtime MPQ)
 * D3: Kinematics & Reactive Retaliation (Fires chillingarmorbolt on hitbymissile, vel 18, range 25, cold damage + chill)
 * D4: ReturnFire Filtering & Infinite Loop Protection (ReturnFire == 1 filter, chillingarmorbolt ReturnFire == 0, ignores melee)
 * D5: Synergy Calculations (Defense % AC, duration 3600f+150f/lvl, cold damage +7%/syn, chill length, blvl hard points rule)
 * D6: Lifecycle, Mana, Timers & Group 1 Mutual Exclusion (Flat 17 mana, 0 cooldown, Group 1 mutual eviction with Frozen & Shiver Armor)
 * D7: Invariants & WorldArena Integration (BATCH1_SKILLS strictly 38, WorldArena runtime cast)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList, FIXED_ONE } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-060-chilling-armor.ts'
import {
  calculateChillingArmorDefense,
  calculateChillingArmorDuration,
  calculateChillingArmorDamage,
  calculateChillingArmorChillLength,
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
import {
  ICEBOLT_META,
  MISSILE_METAS,
} from '../../../src/client/render/missiles-meta.ts'

describe('[Skill #060] Chilling Armor (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #214)', () => {
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')
  const missilesTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/Missiles.txt')
  const missilesTxtContent = fs.readFileSync(missilesTxtPath, 'latin1')
  const overlayTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/Overlay.txt')
  const overlayTxtContent = fs.readFileSync(overlayTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Canonical Schema Integrity
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Canonical Schema Integrity', () => {
    it('parses authentic Skills.txt row 60 (Chilling Armor)', () => {
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

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx]?.trim() === '60')
      expect(row).toBeDefined()
      expect(row![skillIdx]?.trim()).toBe('Chilling Armor')
      expect(row![charClassIdx]?.trim()).toBe('sor')
      expect(Number(row![manaIdx])).toBe(17)
      expect(Number(row![lvlManaIdx])).toBe(0)
      expect(Number(row![manaShiftIdx])).toBe(8)
      expect(Number(row![srvDoFuncIdx])).toBe(18) // SKILLS_SrvDo018_DefensiveBuff
      expect(row![auraStateIdx]?.trim()).toBe('chillingarmor')
      expect(row![auraEvent1Idx]?.trim()).toBe('hitbymissile')
      expect(Number(row![auraEventFunc1Idx])).toBe(1) // SKILLS_EventFunc01_ChillingArmor
      expect(row![auraStat1Idx]?.trim()).toBe('skill_armor_percent')
      expect(row![auraStatCalc1Idx]?.trim()).toBe('ln12')
      expect(Number(row![param1Idx])).toBe(45) // Base 45% enhanced defense
      expect(Number(row![param2Idx])).toBe(5)  // +5% defense per level
      expect(Number(row![param3Idx])).toBe(3600) // Base duration frames (144s)
      expect(Number(row![param4Idx])).toBe(150)  // +150 frames per level (6s)
      expect(Number(row![param7Idx])).toBe(250)  // +250 frames duration per synergy point (10s)
      expect(Number(row![eMinIdx])).toBe(8)     // Base 8 EMin (divided by 2 -> 4)
      expect(Number(row![eMaxIdx])).toBe(12)    // Base 12 EMax (divided by 2 -> 6)
      expect(Number(row![hitShiftIdx])).toBe(7) // HitShift 7 -> divide by 2
      expect(Number(row![eLenIdx])).toBe(100)   // 100 frames base chill length (4.0s)
      expect(Number(row![eLevLen1Idx])).toBe(0) // 0 extra frames for lvl 1-8
      expect(Number(row![eLevLen2Idx])).toBe(25) // +25 frames for lvl 9-16
      expect(Number(row![eLevLen3Idx])).toBe(25) // +25 frames for lvl 17+
      expect(Number(row![param8Idx])).toBe(7)   // +7% damage per synergy point
      expect(row![auraLenCalcIdx]?.trim()).toContain('par7')
    })

    it('parses authentic Missiles.txt row for chillingarmorbolt (ID 264)', () => {
      const lines = missilesTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const missileIdx = headers.indexOf('Missile')
      const idIdx = headers.indexOf('Id')
      const velIdx = headers.indexOf('Vel')
      const rangeIdx = headers.indexOf('Range')
      const celFileIdx = headers.indexOf('CelFile')
      const returnFireIdx = headers.indexOf('ReturnFire')
      const collideKillIdx = headers.indexOf('CollideKill')
      const transIdx = headers.indexOf('Trans')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[missileIdx]?.trim() === 'chillingarmorbolt')
      expect(row).toBeDefined()
      expect(Number(row![idIdx])).toBe(264)
      expect(Number(row![velIdx])).toBe(18)
      expect(Number(row![rangeIdx])).toBe(25)
      expect(row![celFileIdx]?.trim()).toBe('IceBolt')
      expect(Number(row![returnFireIdx])).toBe(0) // Crucial: ReturnFire 0 prevents infinite loop ping-pong!
      expect(Number(row![collideKillIdx])).toBe(1)
      expect(Number(row![transIdx])).toBe(1)
    })

    it('parses authentic Overlay.txt for chillarmor (body) and chillarmor_hit (hit)', () => {
      const lines = overlayTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const overlayIdx = headers.indexOf('overlay') !== -1 ? headers.indexOf('overlay') : headers.indexOf('Overlay')
      const filenameIdx = headers.indexOf('Filename') !== -1 ? headers.indexOf('Filename') : headers.indexOf('filename')
      const framesIdx = headers.indexOf('Frames') !== -1 ? headers.indexOf('Frames') : headers.indexOf('frames')

      const bodyRow = lines.slice(1).map(l => l.split('\t')).find(r => r[overlayIdx]?.trim() === 'chillarmor')
      expect(bodyRow).toBeDefined()
      expect(bodyRow![filenameIdx]?.trim()).toBe('FrozenArmor')
      expect(Number(bodyRow![framesIdx])).toBe(24)

      const hitRow = lines.slice(1).map(l => l.split('\t')).find(r => r[overlayIdx]?.trim() === 'chillarmor_hit')
      expect(hitRow).toBeDefined()
      expect(hitRow![filenameIdx]?.trim()).toBe('AuraResistColdCast')
      expect(Number(hitRow![framesIdx])).toBe(11)
    })

    it('evaluates exact 1.13c formulas at slvl 1, 10, and 20 via skillModule', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(60)!
      expect(skillRec).toBeDefined()
      expect(skillModule.skillId).toBe(60)
      expect(skillModule.name).toBe('Chilling Armor')
      expect(skillModule.charClass).toBe('sor')

      const stats1 = new UnitStatList()
      stats1.setBaseSkillLevel(60, 1)
      const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
      expect(r1.manaCost).toBe(17)
      expect(r1.manaCost256).toBe(4352)
      expect(r1.minPhysDmg).toBe(0)
      expect(r1.maxPhysDmg).toBe(0)
      expect(r1.minElemDmg256).toBe(1024) // 4 * 256
      expect(r1.maxElemDmg256).toBe(1536) // 6 * 256

      const stats10 = new UnitStatList()
      stats10.setBaseSkillLevel(60, 10)
      const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
      expect(r10.manaCost).toBe(17)
      expect(r10.manaCost256).toBe(4352)
      expect(r10.minPhysDmg).toBe(0)
      expect(r10.maxPhysDmg).toBe(0)
      expect(r10.minElemDmg256).toBe(3840) // 15 * 256
      expect(r10.maxElemDmg256).toBe(5504) // 21.5 * 256

      const stats20 = new UnitStatList()
      stats20.setBaseSkillLevel(60, 20)
      const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
      expect(r20.manaCost).toBe(17)
      expect(r20.manaCost256).toBe(4352)
      expect(r20.minPhysDmg).toBe(0)
      expect(r20.maxPhysDmg).toBe(0)
      expect(r20.minElemDmg256).toBe(9984) // 39 * 256
      expect(r20.maxElemDmg256).toBe(12928) // 50.5 * 256
      expect(r20.durationFrames).toBe(6450)
      expect(r20.radiusSubtiles).toBe(140) // +140% defense bonus
      expect(r20.cooldownFrames).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Integrity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Integrity', () => {
    it('verifies baked overlay and missile atlas sprite sheet files exist on disk with valid size', () => {
      const bodyPng = path.resolve(__dirname, '../../../public/overlays/frozenarmor.png')
      const bodyJson = path.resolve(__dirname, '../../../public/overlays/frozenarmor.json')
      const hitPng = path.resolve(__dirname, '../../../public/overlays/auraresistcoldcast.png')
      const hitJson = path.resolve(__dirname, '../../../public/overlays/auraresistcoldcast.json')
      const boltPng = path.resolve(__dirname, '../../../public/missiles/icebolt.png')
      const boltJson = path.resolve(__dirname, '../../../public/missiles/icebolt.json')

      expect(fs.existsSync(bodyPng)).toBe(true)
      expect(fs.statSync(bodyPng).size).toBeGreaterThan(1000)
      expect(fs.existsSync(bodyJson)).toBe(true)

      expect(fs.existsSync(hitPng)).toBe(true)
      expect(fs.statSync(hitPng).size).toBeGreaterThan(1000)
      expect(fs.existsSync(hitJson)).toBe(true)

      expect(fs.existsSync(boltPng)).toBe(true)
      expect(fs.statSync(boltPng).size).toBeGreaterThan(1000)
      expect(fs.existsSync(boltJson)).toBe(true)
    })

    it('verifies overlay and missile metadata registrations', () => {
      expect(OVERLAY_METAS['chillingarmor']).toBeDefined()
      expect(OVERLAY_METAS['chillingarmor']).toBe(FROZEN_ARMOR_OVERLAY_META)
      expect(OVERLAY_METAS['chillingarmor'].frames).toBe(24)

      expect(OVERLAY_METAS['chillingarmor_hit']).toBeDefined()
      expect(OVERLAY_METAS['chillingarmor_hit']).toBe(FROZEN_ARMOR_HIT_OVERLAY_META)
      expect(OVERLAY_METAS['chillingarmor_hit'].frames).toBe(11)

      expect(MISSILE_METAS['chillingarmorbolt']).toBeDefined()
      expect(MISSILE_METAS['chillingarmorbolt']).toBe(ICEBOLT_META)

      expect(getSkillCastOverlay(60)).toBe('ice_cast_3')
    })
  })

  // =========================================================================
  // Dimension 3: Kinematics & Reactive Retaliation (Ice Bolt Return Fire)
  // =========================================================================
  describe('Dimension 3: Kinematics & Reactive Retaliation (Ice Bolt Return Fire)', () => {
    it('spawns chillingarmorbolt targeted at shooter when struck by a ranged missile', async () => {
      const registry = await getSharedDataRegistry()
      const defenderStats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })
      defenderStats.setBaseSkillLevel(40, 10) // 10 hard points in Frozen Armor
      defenderStats.setBaseSkillLevel(50, 10) // 10 hard points in Shiver Armor
      const attackerStats = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })

      const defenderBus = new StateBus(defenderStats, registry)
      const attackerBus = new StateBus(attackerStats, registry)

      defenderBus.applyState({
        stateNameOrId: 'chillingarmor',
        sourceSkillId: 60,
        slvl: 20,
      })

      // Struck by incoming ranged missile with returnFire: true
      const out = defenderBus.triggerReactiveEvents({
        event: 'hitbymissile',
        incomingPhys256: 150 * FIXED_ONE,
        returnFire: true,
        attackerStateBus: attackerBus,
      })

      expect(out.spawnedMissiles).toContain('chillingarmorbolt')

      // Damage and chill length calculations
      const dmg = calculateChillingArmorDamage(20, { frozenArmor: 10, shiverArmor: 10 })
      expect(dmg.min).toBe(93.6) // 39 * (1 + 20 * 0.07) = 39 * 2.4 = 93.6
      expect(dmg.max).toBe(121.2) // 50.5 * 2.4 = 121.2

      const chill = calculateChillingArmorChillLength(20, { frozenArmor: 10, shiverArmor: 10 })
      expect(chill).toBe(1200) // 400 * (1 + 20 * 0.10) = 400 * 3.0 = 1200
    })

    it('evaluates calculateSkillDamage matching calculateChillingArmorDamage', () => {
      const dmg1 = calculateSkillDamage(60, 1)
      expect(dmg1).toEqual({ min: 4, max: 6 })

      const dmg10 = calculateSkillDamage(60, 10)
      expect(dmg10).toEqual({ min: 15, max: 21.5 })

      const dmg20 = calculateSkillDamage(60, 20)
      expect(dmg20).toEqual({ min: 39, max: 50.5 })

      // Synergy: +7% per point in Frozen Armor & Shiver Armor (+40 points -> +280% = 3.8x)
      const dmg20Syn = calculateChillingArmorDamage(20, { frozenArmor: 20, shiverArmor: 20 })
      expect(dmg20Syn.min).toBe(148.2)
      expect(dmg20Syn.max).toBe(191.9)
    })
  })

  // =========================================================================
  // Dimension 4: ReturnFire Filtering & Infinite Loop Protection
  // =========================================================================
  describe('Dimension 4: ReturnFire Filtering & Infinite Loop Protection', () => {
    it('does NOT retaliate if incoming missile has returnFire: false', async () => {
      const registry = await getSharedDataRegistry()
      const defenderStats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })
      const attackerStats = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })

      const defenderBus = new StateBus(defenderStats, registry)
      const attackerBus = new StateBus(attackerStats, registry)

      defenderBus.applyState({
        stateNameOrId: 'chillingarmor',
        sourceSkillId: 60,
        slvl: 20,
      })

      // Struck by missile with returnFire: false (e.g. enemy chillingarmorbolt)
      const out = defenderBus.triggerReactiveEvents({
        event: 'hitbymissile',
        incomingPhys256: 150 * FIXED_ONE,
        returnFire: false,
        attackerStateBus: attackerBus,
      })

      expect(out.spawnedMissiles).not.toContain('chillingarmorbolt')
      expect(out.spawnedMissiles.length).toBe(0)
    })

    it('does NOT trigger on melee attacks (damagedinmelee or attackedinmelee)', async () => {
      const registry = await getSharedDataRegistry()
      const defenderStats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })
      const attackerStats = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })

      const defenderBus = new StateBus(defenderStats, registry)
      const attackerBus = new StateBus(attackerStats, registry)

      defenderBus.applyState({
        stateNameOrId: 'chillingarmor',
        sourceSkillId: 60,
        slvl: 20,
      })

      const outMeleeDamage = defenderBus.triggerReactiveEvents({
        event: 'damagedinmelee',
        incomingPhys256: 150 * FIXED_ONE,
        attackerStateBus: attackerBus,
      })
      expect(outMeleeDamage.spawnedMissiles).not.toContain('chillingarmorbolt')

      const outMeleeAttack = defenderBus.triggerReactiveEvents({
        event: 'attackedinmelee',
        incomingPhys256: 150 * FIXED_ONE,
        attackerStateBus: attackerBus,
      })
      expect(outMeleeAttack.spawnedMissiles).not.toContain('chillingarmorbolt')
    })
  })

  // =========================================================================
  // Dimension 5: Synergy Calculations (Damage, Duration, Chill Length, Defense)
  // =========================================================================
  describe('Dimension 5: Synergy Calculations (Damage, Duration, Chill Length, Defense)', () => {
    it('calculates % Enhanced Defense: 45 + (slvl - 1) * 5', () => {
      expect(calculateChillingArmorDefense(1)).toBe(45)
      expect(calculateChillingArmorDefense(2)).toBe(50)
      expect(calculateChillingArmorDefense(10)).toBe(90)
      expect(calculateChillingArmorDefense(20)).toBe(140)
      expect(calculateChillingArmorDefense(30)).toBe(190)
    })

    it('calculates duration in frames: 3600 + (slvl - 1) * 150 + synPoints * 250', () => {
      expect(calculateChillingArmorDuration(1)).toBe(3600)   // 144s
      expect(calculateChillingArmorDuration(10)).toBe(4950)  // 198s
      expect(calculateChillingArmorDuration(20)).toBe(6450)  // 258s

      // +40 synergy points (+10s per point)
      expect(calculateChillingArmorDuration(20, { frozenArmor: 20, shiverArmor: 20 })).toBe(16450) // 658s
      expect(calculateChillingArmorDuration(20, 40)).toBe(16450)
    })

    it('calculates stepped chill length: 100f (lvl 1-8), +25f/lvl (lvl 9-16), +25f/lvl (lvl 17+)', () => {
      expect(calculateChillingArmorChillLength(1)).toBe(100)  // 4.0s
      expect(calculateChillingArmorChillLength(8)).toBe(100)  // 4.0s
      expect(calculateChillingArmorChillLength(10)).toBe(150) // 6.0s (100 + 2 * 25)
      expect(calculateChillingArmorChillLength(16)).toBe(300) // 12.0s (100 + 8 * 25)
      expect(calculateChillingArmorChillLength(20)).toBe(400) // 16.0s (300 + 4 * 25)

      // Synergy: +10% chill length per synergy point
      expect(calculateChillingArmorChillLength(20, 10)).toBe(800) // 400 * 2.0 = 800
    })

    it('enforces 1.13c blvl synergy rule (hard points only; +skills and charges give 0 synergy)', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(60)!

      const statsBase = new UnitStatList()
      statsBase.setBaseSkillLevel(60, 20)
      statsBase.setBaseSkillLevel(40, 20) // 20 hard points in Frozen Armor
      const withHardPoints = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsBase,
      })
      expect(withHardPoints.synergyBonusPct).toBe(140) // 20 * 7% = 140%

      // Soft skills + item charges must NOT affect synergy
      const statsSoftOnly = new UnitStatList()
      statsSoftOnly.setBaseSkillLevel(60, 20)
      statsSoftOnly.addStat('item_allskills', 20)
      statsSoftOnly.setChargedSkillLevel(40, 33)
      statsSoftOnly.setChargedSkillLevel(50, 33)
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
    it('verifies constant mana cost 17 and 0 cooldown ticks', () => {
      expect(getSkillManaCost(60, 1)).toBe(17)
      expect(getSkillManaCost(60, 10)).toBe(17)
      expect(getSkillManaCost(60, 20)).toBe(17)
      expect(getSkillCooldownTicks(60)).toBe(0)
    })

    it('enforces State Group 1 mutual exclusion between Frozen, Shiver, and Chilling Armor', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })
      const bus = new StateBus(stats, registry)

      // 1. Cast Chilling Armor
      bus.applyState({ stateNameOrId: 'chillingarmor', sourceSkillId: 60, slvl: 20 })
      expect(bus.hasState('chillingarmor')).toBe(true)
      expect(bus.hasState('frozenarmor')).toBe(false)
      expect(bus.hasState('shiverarmor')).toBe(false)

      // 2. Cast Frozen Armor -> must evict Chilling Armor
      bus.applyState({ stateNameOrId: 'frozenarmor', sourceSkillId: 40, slvl: 20 })
      expect(bus.hasState('chillingarmor')).toBe(false)
      expect(bus.hasState('frozenarmor')).toBe(true)
      expect(bus.hasState('shiverarmor')).toBe(false)

      // 3. Cast Shiver Armor -> must evict Frozen Armor
      bus.applyState({ stateNameOrId: 'shiverarmor', sourceSkillId: 50, slvl: 20 })
      expect(bus.hasState('chillingarmor')).toBe(false)
      expect(bus.hasState('frozenarmor')).toBe(false)
      expect(bus.hasState('shiverarmor')).toBe(true)

      // 4. Cast Chilling Armor again -> must evict Shiver Armor
      bus.applyState({ stateNameOrId: 'chillingarmor', sourceSkillId: 60, slvl: 20 })
      expect(bus.hasState('chillingarmor')).toBe(true)
      expect(bus.hasState('frozenarmor')).toBe(false)
      expect(bus.hasState('shiverarmor')).toBe(false)
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
        skillId: 60,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(60)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })
  })
})
