/**
 * Local Player Motion Kinematics & Velocity Predictor Tests (Issues #587, #600).
 *
 * Verifies Diablo II v1.13c ground truth:
 * - Base walk velocity = 6 yards/s (9.0 sub-tiles/s), run = 9 yards/s (13.5 sub-tiles/s)
 * - Running adds 50% (100 * RunVelocity / WalkVelocity - 100) when stamina is not exhausted
 * - Item FRW follows diminishing returns: floor(150 * frw / (150 + frw))
 * - Skill FRW (e.g. Burst of Speed, Vigor) adds linearly without diminishing returns
 * - Armor speed penalties (-5%, -10%) subtract directly from velocity percent
 * - Slow / chill subtracts directly from velocity percent
 * - Minimum speed floor is 25% of base walk velocity (Units.cpp:1678)
 * - Stamina exhaustion removes the 50% running bonus, forcing walk speed
 * - gateModeBase matches authentic PlrMode values: 1 (NU) -> 3, 3 (RN) -> 7, others -> 5
 */

import { describe, expect, it } from 'vitest'
import {
  D2_BASE_RUN_SUBTILES_PER_SEC,
  D2_BASE_WALK_SUBTILES_PER_SEC,
  LocalMovementPredictor,
} from '../../src/client/motion/predictor.ts'

describe('LocalMovementPredictor kinematics & FRW (Issue #587)', () => {
  it('predicts base walk and run velocity without stat bonuses', () => {
    const predictor = new LocalMovementPredictor()

    // Default running = true
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBe(D2_BASE_RUN_SUBTILES_PER_SEC) // 13.5

    // Walking
    predictor.setRunning(false)
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBe(D2_BASE_WALK_SUBTILES_PER_SEC) // 9.0
  })

  it('applies D2 diminishing returns formula to item FRW', () => {
    const predictor = new LocalMovementPredictor()
    predictor.setRunning(false)

    // With 30% item FRW: floor(150 * 30 / 180) = floor(4500 / 180) = 25%
    predictor.setFasterRunWalkPercent(30)
    // 9.0 * (100 + 25) / 100 = 11.25
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBe(11.25)

    // With 70% item FRW: floor(150 * 70 / 220) = floor(10500 / 220) = 47%
    predictor.setFasterRunWalkPercent(70)
    // 9.0 * (100 + 47) / 100 = 13.23
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBeCloseTo(13.23, 5)

    // When running with 30% item FRW:
    // Effective percent = 100 + 25 (item) + 50 (run) = 175%
    // 9.0 * 1.75 = 15.75
    predictor.setRunning(true)
    predictor.setFasterRunWalkPercent(30)
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBe(15.75)
  })

  it('adds skill FRW directly without diminishing returns', () => {
    const predictor = new LocalMovementPredictor()
    predictor.setRunning(false)

    // Burst of Speed level 5 (+35% skill FRW)
    predictor.setSkillVelocityPercent(35)
    // 9.0 * (100 + 35) / 100 = 12.15
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBe(12.15)

    // Combined 30% item FRW (eff 25%) + 35% skill FRW while running:
    // Total percent = 100 + 25 (item) + 50 (run) + 35 (skill) = 210%
    // 9.0 * 2.10 = 18.9
    predictor.setRunning(true)
    predictor.setFasterRunWalkPercent(30)
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBe(18.9)
  })

  it('subtracts armor speed penalties and chill / slow debuffs', () => {
    const predictor = new LocalMovementPredictor()
    predictor.setRunning(false)

    // Heavy armor (-10% penalty)
    predictor.setArmorSpeedPenaltyPercent(10)
    // 9.0 * (100 - 10) / 100 = 8.1
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBe(8.1)

    // Heavy armor + chilled (e.g. 50% slow)
    predictor.setSlowPercent(50)
    // 9.0 * (100 - 10 - 50) / 100 = 3.6
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBe(3.6)
  })

  it('enforces 25% minimum speed floor per 1.13c Units.cpp:1678', () => {
    const predictor = new LocalMovementPredictor()
    predictor.setRunning(false)

    // Severe slow (e.g. Clay Golem + Decrepify + Holy Freeze = 90% slow) with heavy armor (-10%)
    predictor.setArmorSpeedPenaltyPercent(10)
    predictor.setSlowPercent(90)

    // Total would be 100 - 10 - 90 = 0%, capped at 25% floor
    // 9.0 * 25 / 100 = 2.25
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBe(2.25)
  })

  it('disables running speed bonus when stamina is exhausted', () => {
    const predictor = new LocalMovementPredictor()
    predictor.setRunning(true)

    // Running with 30% item FRW (eff 25%)
    predictor.setFasterRunWalkPercent(30)
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBe(15.75) // 9.0 * (100 + 25 + 50) / 100

    // Stamina exhausted: player is forced to walk speed + item FRW
    predictor.setStaminaExhausted(true)
    expect(predictor.isStaminaExhausted()).toBe(true)
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBe(11.25) // 9.0 * (100 + 25 + 0) / 100

    // Recover stamina
    predictor.setStaminaExhausted(false)
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBe(15.75)
  })

  it('supports setVelocityModifiers batch update', () => {
    const predictor = new LocalMovementPredictor()
    predictor.setRunning(true)

    predictor.setVelocityModifiers({
      fasterRunWalkPercent: 30, // eff 25%
      skillVelocityPercent: 20, // +20%
      armorSpeedPenaltyPercent: 5, // -5%
      slowPercent: 10, // -10%
      staminaExhausted: false, // +50% run
    })

    // Total = 100 + 25 + 50 + 20 - 5 - 10 = 180%
    // 9.0 * 1.80 = 16.2
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBe(16.2)
  })
})

describe('LocalMovementPredictor gateModeBase (Issue #600)', () => {
  it('maps authentic PlrMode values: 1 (NU) -> 3, 3 (RN) -> 7, others -> 5', () => {
    const predictor = new LocalMovementPredictor()

    // Mode 1: Neutral / standing
    expect(predictor.gateModeBase(1)).toBe(3)

    // Mode 3: Running
    expect(predictor.gateModeBase(3)).toBe(7)

    // Other modes: Walking (2), Get Hit (4), Town Neutral (5), Town Walk (6), Attack 1 (7), Cast (8), etc.
    expect(predictor.gateModeBase(0)).toBe(5) // Death
    expect(predictor.gateModeBase(2)).toBe(5) // Walk
    expect(predictor.gateModeBase(4)).toBe(5) // Get Hit
    expect(predictor.gateModeBase(5)).toBe(5) // Town Neutral
    expect(predictor.gateModeBase(6)).toBe(5) // Town Walk
    expect(predictor.gateModeBase(7)).toBe(5) // Attack 1
    expect(predictor.gateModeBase(8)).toBe(5) // Attack 2
    expect(predictor.gateModeBase(9)).toBe(5) // Cast
  })

  it('uses active PlrMode from predictor or ServerPositionCheck when available', () => {
    const predictor = new LocalMovementPredictor({ initialX: 5000, initialY: 5000 })

    // Check with explicit plrMode in ServerPositionCheck
    const verdictNu = predictor.verifyServerPosition({
      x: 5003,
      y: 5000,
      source: { kind: 'life-mana', vx: 0, vy: 0 },
      rttMs: 0,
      inTown: false,
      plrMode: 1, // NU -> base 3
    })
    expect(verdictNu.threshold).toBe(3)
    expect(verdictNu.action).toBe('none')

    const verdictRn = predictor.verifyServerPosition({
      x: 5007,
      y: 5000,
      source: { kind: 'life-mana', vx: 0, vy: 0 },
      rttMs: 0,
      inTown: false,
      plrMode: 3, // RN -> base 7
    })
    expect(verdictRn.threshold).toBe(7)
    expect(verdictRn.action).toBe('none')

    // Setting mode on predictor
    predictor.setPlayerMode(4) // Get Hit -> base 5
    const verdictGh = predictor.verifyServerPosition({
      x: 5005,
      y: 5000,
      source: { kind: 'life-mana', vx: 0, vy: 0 },
      rttMs: 0,
      inTown: false,
    })
    expect(verdictGh.threshold).toBe(5)
    expect(verdictGh.action).toBe('none')
  })

  it('preserves fallback behavior when plrMode is not provided', () => {
    const predictor = new LocalMovementPredictor({ initialX: 5000, initialY: 5000 })

    // Idle outside town: base 3
    expect(predictor.gateModeBase(false)).toBe(3)

    // Idle inside town: base 5
    expect(predictor.gateModeBase(true)).toBe(5)

    // Moving running: base 7
    predictor.setPath([{ x: 5010, y: 5010 }], true)
    expect(predictor.gateModeBase(false)).toBe(7)

    // Moving walking: base 5
    predictor.setPath([{ x: 5010, y: 5010 }], false)
    expect(predictor.gateModeBase(false)).toBe(5)
  })
})
