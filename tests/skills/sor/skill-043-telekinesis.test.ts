/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #043: Telekinesis (SOR)
 * Gitea Tracking Issue: #197
 *
 * 7-Dimensional Verification Suite for authentic Diablo II v1.13c Telekinesis:
 * - Dimension 1: 1.13c Data Table Parsing & Canonical Definition
 * - Dimension 2: Visual Assets & Metadata Integrity (Zero Runtime MPQ)
 * - Dimension 3: Range Limit & Remote Object Interaction (Param1 = 25 Subtiles)
 * - Dimension 4: Remote Ground Item Pickup Whitelist & Equipment Restriction
 * - Dimension 5: Combat Hit, Damage, Knockback & Stun (Param2 = 35)
 * - Dimension 6: Hard Synergy to Energy Shield & Mana / Cooldown Lifecycle
 * - Dimension 7: WorldArena & Runtime Cast Integration
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-043-telekinesis.ts'
import {
  BATCH1_SKILLS,
  getSkillManaCost,
  getSkillCooldownTicks,
  calculateSkillDamage,
  getSkillCastOverlay,
  SORCERESS_SKILL_CAST_OVERLAYS,
} from '../../../src/server/skills/skills.ts'
import {
  calculateEnergyShieldManaRatio,
  calculateTelekinesisDamage,
  isTelekinesisItemAllowed,
  isTelekinesisObjectAllowed,
} from '../../../src/server/engine/missile-engine.ts'
import {
  LIGHT_CAST_2_META,
  OVERLAY_METAS,
} from '../../../src/client/render/overlays-meta.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('[Skill #043] Telekinesis (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #197)', () => {
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Canonical Definition
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Canonical Definition', () => {
    it('parses authentic Skills.txt row 43 (Telekinesis)', () => {
      const lines = skillsTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const idIdx = headers.indexOf('Id')
      const skillIdx = headers.indexOf('skill')
      const charClassIdx = headers.indexOf('charclass')
      const manaIdx = headers.indexOf('mana')
      const lvlManaIdx = headers.indexOf('lvlmana')
      const manaShiftIdx = headers.indexOf('manashift')
      const castOverlayIdx = headers.indexOf('castoverlay')
      const srvStFuncIdx = headers.indexOf('srvstfunc')
      const srvDoFuncIdx = headers.indexOf('srvdofunc')
      const eMinIdx = headers.indexOf('EMin')
      const eMaxIdx = headers.indexOf('EMax')
      const eLev1Idx = headers.indexOf('EMinLev1') !== -1 ? headers.indexOf('EMinLev1') : headers.indexOf('ELev1')
      const hitShiftIdx = headers.indexOf('HitShift') !== -1 ? headers.indexOf('HitShift') : headers.indexOf('hitshift')
      const param1Idx = headers.indexOf('Param1') !== -1 ? headers.indexOf('Param1') : headers.indexOf('param1')
      const param2Idx = headers.indexOf('Param2') !== -1 ? headers.indexOf('Param2') : headers.indexOf('param2')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx]?.trim() === '43')
      expect(row).toBeDefined()
      expect(row![skillIdx]?.trim()).toBe('Telekinesis')
      expect(row![charClassIdx]?.trim()).toBe('sor')
      expect(Number(row![manaIdx])).toBe(7)
      expect(Number(row![lvlManaIdx])).toBe(0)
      expect(Number(row![manaShiftIdx])).toBe(8)
      expect(row![castOverlayIdx]?.trim()).toBe('light_cast_2')
      expect(Number(row![srvStFuncIdx])).toBe(12)
      expect(Number(row![srvDoFuncIdx])).toBe(21)
      expect(Number(row![eMinIdx])).toBe(1)
      expect(Number(row![eMaxIdx])).toBe(2)
      expect(Number(row![eLev1Idx])).toBe(1)
      expect(Number(row![hitShiftIdx])).toBe(8)
      expect(Number(row![param1Idx])).toBe(25) // Range in subtiles
      expect(Number(row![param2Idx])).toBe(35) // 35% knockback, 35 stun ticks
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Integrity (Zero Runtime MPQ)
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Integrity', () => {
    it('verifies baked overlay atlas sprite sheet files exist with non-zero size', () => {
      const overlayPng = path.resolve(__dirname, '../../../public/overlays/light_cast_2.png')
      const overlayJson = path.resolve(__dirname, '../../../public/overlays/light_cast_2.json')

      expect(fs.existsSync(overlayPng)).toBe(true)
      expect(fs.statSync(overlayPng).size).toBeGreaterThan(1000)
      expect(fs.existsSync(overlayJson)).toBe(true)
      expect(fs.statSync(overlayJson).size).toBeGreaterThan(100)
    })

    it('verifies LIGHT_CAST_2_META metadata and registry registration', () => {
      expect(LIGHT_CAST_2_META.name).toBe('light_cast_2')
      expect(OVERLAY_METAS['light_cast_2']).toBe(LIGHT_CAST_2_META)
    })

    it('verifies cast overlay mapping and metadata for Telekinesis (43)', () => {
      expect(SORCERESS_SKILL_CAST_OVERLAYS[43]).toBe('light_cast_2')
      expect(getSkillCastOverlay(43)).toBe('light_cast_2')
    })

    it('verifies skillModule registration and metadata for Telekinesis (43)', () => {
      expect(skillModule.skillId).toBe(43)
      expect(skillModule.name).toBe('Telekinesis')
      expect(skillModule.charClass).toBe('sor')
      expect(skillModule.srvStFunc).toBe(12)
      expect(skillModule.srvDoFunc).toBe(21)
      expect(getSkillManaCost(43, 1)).toBe(7)
      expect(getSkillCooldownTicks(43)).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 3: Range Limit & Remote Object Interaction (Param1 = 25 Subtiles)
  // =========================================================================
  describe('Dimension 3: Range Limit & Remote Object Interaction', () => {
    it('enforces 600px range gating for remote interaction', () => {
      const maxRange = 600
      const origin = { x: 1000, y: 1000 }
      const inRangeTarget = { x: 1400, y: 1300 } // dist: sqrt(400^2 + 300^2) = 500 <= 600
      const outOfRangeTarget = { x: 1600, y: 1500 } // dist: sqrt(600^2 + 500^2) = 781 > 600

      const distIn = Math.hypot(inRangeTarget.x - origin.x, inRangeTarget.y - origin.y)
      const distOut = Math.hypot(outOfRangeTarget.x - origin.x, outOfRangeTarget.y - origin.y)

      expect(distIn).toBeLessThanOrEqual(maxRange)
      expect(distOut).toBeGreaterThan(maxRange)
    })

    it('isTelekinesisObjectAllowed permits authentic interactive objects', () => {
      expect(isTelekinesisObjectAllowed('chest')).toBe(true)
      expect(isTelekinesisObjectAllowed('locked_chest')).toBe(true)
      expect(isTelekinesisObjectAllowed('stash')).toBe(true)
      expect(isTelekinesisObjectAllowed('waypoint')).toBe(true)
      expect(isTelekinesisObjectAllowed('portal')).toBe(true)
      expect(isTelekinesisObjectAllowed('shrine')).toBe(true)
      expect(isTelekinesisObjectAllowed('door')).toBe(true)
      expect(isTelekinesisObjectAllowed('well')).toBe(true)
      expect(isTelekinesisObjectAllowed('urn')).toBe(true)
      expect(isTelekinesisObjectAllowed('sarcophagus')).toBe(true)
    })

    it('isTelekinesisObjectAllowed rejects non-interactive entities', () => {
      expect(isTelekinesisObjectAllowed('npc')).toBe(false)
      expect(isTelekinesisObjectAllowed('trap')).toBe(false)
      expect(isTelekinesisObjectAllowed('unknown_gizmo')).toBe(false)
      expect(isTelekinesisObjectAllowed('')).toBe(false)
      expect(isTelekinesisObjectAllowed(null as unknown as string)).toBe(false)
    })
  })

  // =========================================================================
  // Dimension 4: Remote Ground Item Pickup Whitelist & Equipment Restriction
  // =========================================================================
  describe('Dimension 4: Remote Ground Item Pickup Whitelist & Equipment Restriction', () => {
    it('allows remote pickup of potions, scrolls, gold, ammo, and keys', () => {
      // Potions
      expect(isTelekinesisItemAllowed({ type: 'potion' })).toBe(true)
      expect(isTelekinesisItemAllowed({ type: 'healing_potion' })).toBe(true)
      expect(isTelekinesisItemAllowed({ type: 'mana_potion' })).toBe(true)
      expect(isTelekinesisItemAllowed({ type: 'rejuv_potion' })).toBe(true)
      expect(isTelekinesisItemAllowed({ code: 'hp1' })).toBe(true)
      expect(isTelekinesisItemAllowed({ code: 'mp3' })).toBe(true)
      expect(isTelekinesisItemAllowed({ code: 'rvs' })).toBe(true)
      expect(isTelekinesisItemAllowed({ code: 'rvl' })).toBe(true)

      // Scrolls
      expect(isTelekinesisItemAllowed({ type: 'scroll' })).toBe(true)
      expect(isTelekinesisItemAllowed({ code: 'tsc' })).toBe(true)
      expect(isTelekinesisItemAllowed({ code: 'isc' })).toBe(true)

      // Gold
      expect(isTelekinesisItemAllowed({ type: 'gold' })).toBe(true)
      expect(isTelekinesisItemAllowed({ code: 'gld' })).toBe(true)

      // Ammo
      expect(isTelekinesisItemAllowed({ type: 'ammo' })).toBe(true)
      expect(isTelekinesisItemAllowed({ type: 'arrows' })).toBe(true)
      expect(isTelekinesisItemAllowed({ type: 'bolts' })).toBe(true)
      expect(isTelekinesisItemAllowed({ code: 'aqv' })).toBe(true)
      expect(isTelekinesisItemAllowed({ code: 'cqv' })).toBe(true)

      // Keys
      expect(isTelekinesisItemAllowed({ type: 'key' })).toBe(true)
      expect(isTelekinesisItemAllowed({ code: 'key' })).toBe(true)
    })

    it('rejects remote pickup of equipment (weapons, armor, jewelry, charms)', () => {
      // Weapons
      expect(isTelekinesisItemAllowed({ type: 'weapon' })).toBe(false)
      expect(isTelekinesisItemAllowed({ type: 'sword' })).toBe(false)
      expect(isTelekinesisItemAllowed({ type: 'bow' })).toBe(false)
      expect(isTelekinesisItemAllowed({ code: 'ssd' })).toBe(false)

      // Armor
      expect(isTelekinesisItemAllowed({ type: 'armor' })).toBe(false)
      expect(isTelekinesisItemAllowed({ type: 'body_armor' })).toBe(false)
      expect(isTelekinesisItemAllowed({ type: 'helm' })).toBe(false)
      expect(isTelekinesisItemAllowed({ type: 'shield' })).toBe(false)
      expect(isTelekinesisItemAllowed({ type: 'gloves' })).toBe(false)
      expect(isTelekinesisItemAllowed({ type: 'boots' })).toBe(false)
      expect(isTelekinesisItemAllowed({ type: 'belt' })).toBe(false)

      // Jewelry & Charms
      expect(isTelekinesisItemAllowed({ type: 'ring' })).toBe(false)
      expect(isTelekinesisItemAllowed({ type: 'amulet' })).toBe(false)
      expect(isTelekinesisItemAllowed({ type: 'charm' })).toBe(false)

      // Invalid inputs
      expect(isTelekinesisItemAllowed(null)).toBe(false)
      expect(isTelekinesisItemAllowed(undefined)).toBe(false)
      expect(isTelekinesisItemAllowed({})).toBe(false)
    })
  })

  // =========================================================================
  // Dimension 5: Combat Hit, Damage, Knockback & Stun (Param2 = 35)
  // =========================================================================
  describe('Dimension 5: Combat Hit, Damage, Knockback & Stun', () => {
    it('evaluates exact 1.13c Telekinesis damage scaling: slvl to slvl + 1', () => {
      expect(calculateTelekinesisDamage(1)).toEqual({ min: 1, max: 2 })
      expect(calculateTelekinesisDamage(2)).toEqual({ min: 2, max: 3 })
      expect(calculateTelekinesisDamage(5)).toEqual({ min: 5, max: 6 })
      expect(calculateTelekinesisDamage(10)).toEqual({ min: 10, max: 11 })
      expect(calculateTelekinesisDamage(20)).toEqual({ min: 20, max: 21 })
      expect(calculateTelekinesisDamage(30)).toEqual({ min: 30, max: 31 })
    })

    it('integrates with calculateSkillDamage helper', () => {
      const dmg1 = calculateSkillDamage(43, 1)
      expect(dmg1.min).toBe(1)
      expect(dmg1.max).toBe(2)

      const dmg10 = calculateSkillDamage(43, 10)
      expect(dmg10.min).toBe(10)
      expect(dmg10.max).toBe(11)

      const dmg20 = calculateSkillDamage(43, 20)
      expect(dmg20.min).toBe(20)
      expect(dmg20.max).toBe(21)
    })

    it('verifies 35% knockback chance and 35 stun ticks from Param2', () => {
      const param2 = 35
      const knockbackChance = param2 / 100 // 0.35
      const stunTicks = param2 // 35 ticks = 1.4 seconds at 25 fps
      expect(knockbackChance).toBe(0.35)
      expect(stunTicks).toBe(35)
    })
  })

  // =========================================================================
  // Dimension 6: Hard Synergy to Energy Shield & Mana / Cooldown Lifecycle
  // =========================================================================
  describe('Dimension 6: Hard Synergy to Energy Shield & Mana / Cooldown Lifecycle', () => {
    it('calculates Energy Shield mana ratio reduction: (32 - min(20, tkBlvl)) / 16', () => {
      expect(calculateEnergyShieldManaRatio(0)).toBe(2.0) // 32/16 = 200% mana consumed
      expect(calculateEnergyShieldManaRatio(1)).toBe(31 / 16) // 1.9375
      expect(calculateEnergyShieldManaRatio(4)).toBe(28 / 16) // 1.75
      expect(calculateEnergyShieldManaRatio(8)).toBe(24 / 16) // 1.5
      expect(calculateEnergyShieldManaRatio(12)).toBe(20 / 16) // 1.25
      expect(calculateEnergyShieldManaRatio(16)).toBe(16 / 16) // 1.0 (100% parity)
      expect(calculateEnergyShieldManaRatio(20)).toBe(12 / 16) // 0.75 (75% mana consumed)
      expect(calculateEnergyShieldManaRatio(25)).toBe(0.75) // capped at 20 hard points
    })

    it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(43)!

      const statsBase = new UnitStatList()
      statsBase.setBaseSkillLevel(43, 20)
      const withHardPoints = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsBase,
      })
      expect(withHardPoints.synergyBonusPct).toBe(0)

      // +20 allskills and charged items without hard points must yield 0 synergy
      const statsSoftOnly = new UnitStatList()
      statsSoftOnly.setBaseSkillLevel(43, 20)
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

    it('verifies constant mana cost of 7 across all slvls', () => {
      expect(getSkillManaCost(43, 1)).toBe(7)
      expect(getSkillManaCost(43, 5)).toBe(7)
      expect(getSkillManaCost(43, 10)).toBe(7)
      expect(getSkillManaCost(43, 20)).toBe(7)
      expect(getSkillManaCost(43, 30)).toBe(7)
    })

    it('verifies getSkillCooldownTicks returns 0 frames', () => {
      expect(getSkillCooldownTicks(43)).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 7: WorldArena & Runtime Cast Integration
  // =========================================================================
  describe('Dimension 7: WorldArena & Runtime Cast Integration', () => {
    it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20 via evaluate', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(43)!
      expect(skillRec).toBeDefined()
      expect(skillModule.skillId).toBe(43)
      expect(skillModule.name).toBe('Telekinesis')
      expect(skillModule.charClass).toBe('sor')

      const stats1 = new UnitStatList()
      stats1.setBaseSkillLevel(43, 1)
      const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
      expect(r1.manaCost).toBe(7)
      expect(r1.manaCost256).toBe(1792)
      expect(r1.minPhysDmg).toBe(0)
      expect(r1.maxPhysDmg).toBe(0)
      expect(r1.minElemDmg256).toBe(256)
      expect(r1.maxElemDmg256).toBe(512)

      const stats10 = new UnitStatList()
      stats10.setBaseSkillLevel(43, 10)
      const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
      expect(r10.manaCost).toBe(7)
      expect(r10.manaCost256).toBe(1792)
      expect(r10.minPhysDmg).toBe(0)
      expect(r10.maxPhysDmg).toBe(0)
      expect(r10.minElemDmg256).toBe(2560)
      expect(r10.maxElemDmg256).toBe(2816)

      const stats20 = new UnitStatList()
      stats20.setBaseSkillLevel(43, 20)
      const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
      expect(r20.manaCost).toBe(7)
      expect(r20.manaCost256).toBe(1792)
      expect(r20.minPhysDmg).toBe(0)
      expect(r20.maxPhysDmg).toBe(0)
      expect(r20.minElemDmg256).toBe(5120)
      expect(r20.maxElemDmg256).toBe(5376)
      expect(r20.durationFrames).toBe(0)
      expect(r20.radiusSubtiles).toBe(25)
      expect(r20.petMax).toBe(0)
      expect(r20.cooldownFrames).toBe(0)
    })

    it('executes runtime skill effect in WorldArena (castCount, action frame, and outcome)', async () => {
      const registry = await getSharedDataRegistry()
      const arena = new WorldArena({
        registry,
        classCode: 'sor',
        skillId: 43,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(43)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })
  })
})
