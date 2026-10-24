import { afterEach, describe, expect, it } from 'vitest'
import {
  STAT_FASTERMOVEVELOCITY,
  STAT_VELOCITYPERCENT,
  computeAnimFrameIndex,
  computeFrwDiminishing113c,
  computeLocomotionStepSpeed256,
  computeMoveVelocityPercent113c,
  resolveArmorSpeed113c,
  resolveCharacterAnimSpeedParams,
  resolvePlayerLocomotionBaseSpeed256,
} from '../../src/common/units/char-anim-speed.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

/**
 * Issues #852/#869 regression: D2Common.dll UNITS_GetBaseAnimSpeed (1.13c 0x6FD7FB10)
 * HARDCODES player locomotion animation BASE speeds for all 7 classes — walk/town-walk
 * = 213, run = 101 — and IGNORES the per-COF AnimData.d2 speeds (256/288/168…). The run
 * bonus is a temporary STAT_VELOCITYPERCENT stat posted on run entry
 * (UNITS_CharacterStartRunningOrKnockback, Units.cpp:701: 100×Run/Walk−100 = +50% with the
 * effective 1.13c Patch_D2.mpq CharStats.txt WalkVelocity=6/RunVelocity=9), and the final
 * speed is trunc(base × max(25, EFRW + stat67) / 100) (UNITS_UpdateRunWalkAnimRateAndVelocity,
 * 0x6FD83331): naked walk 213 / naked run 151.
 *
 * The superseded classic d2data.mpq CharStats.txt (WalkVelocity=7/RunVelocity=11 → +57%
 * → 158) is overridden by Patch_D2.mpq at MPQ-load time and must never be used as the
 * runtime truth (#869 Diff 1).
 */
describe('player locomotion anim speed hardcode (#852/#869)', () => {
  afterEach(() => {
    // no per-test state; hook kept for future local fixtures
  })

  it('wl/tw resolve to 213 and rn to the raw 101 base regardless of AnimData speed', () => {
    expect(resolvePlayerLocomotionBaseSpeed256('wl', 256)).toBe(213)
    expect(resolvePlayerLocomotionBaseSpeed256('wl', 288)).toBe(213) // necromancer AnimData 288 ignored
    expect(resolvePlayerLocomotionBaseSpeed256('tw', 256)).toBe(213)
    expect(resolvePlayerLocomotionBaseSpeed256('rn', 256)).toBe(101) // base only; +50% via velocity percent
    expect(resolvePlayerLocomotionBaseSpeed256('rn', 216)).toBe(101) // paladin AnimData ignored
  })

  it('non-locomotion clips keep their AnimData speed', () => {
    expect(resolvePlayerLocomotionBaseSpeed256('nu', 128)).toBe(128)
    expect(resolvePlayerLocomotionBaseSpeed256('sc', 256)).toBe(256)
    expect(resolvePlayerLocomotionBaseSpeed256('a1', 256)).toBe(256)
  })

  it('naked locomotion: walk 213, town-walk 213, run 151 (trunc(101×150/100))', () => {
    // classId 1=sor, 2=nec (AnimData wl 288), 3=pal (AnimData wl 168)
    expect(resolveCharacterAnimSpeedParams(1, 'wl', {}).stepSpeed256).toBe(213)
    expect(resolveCharacterAnimSpeedParams(2, 'wl', {}).stepSpeed256).toBe(213)
    expect(resolveCharacterAnimSpeedParams(3, 'wl', {}).stepSpeed256).toBe(213)
    expect(resolveCharacterAnimSpeedParams(1, 'tw', {}).stepSpeed256).toBe(213)
    expect(resolveCharacterAnimSpeedParams(1, 'rn', {}).stepSpeed256).toBe(151)
    expect(resolveCharacterAnimSpeedParams(1, 'rn', {}).velocityPercent).toBe(150)
    expect(resolveCharacterAnimSpeedParams(1, 'wl', {}).velocityPercent).toBe(100)
    // non-locomotion untouched: nu stays 128, sc stays 256 (0 FCR)
    expect(resolveCharacterAnimSpeedParams(1, 'nu', {}).stepSpeed256).toBe(128)
    expect(resolveCharacterAnimSpeedParams(1, 'sc', {}).stepSpeed256).toBe(256)
  })

  it('item FRW scales locomotion with the 150-base diminishing returns (#869 Diff 2)', () => {
    // +30% FRW boots: EFRW = trunc(150×30/180) = 25
    const equipment = [{ stats: [{ statId: STAT_FASTERMOVEVELOCITY, value: 30 }] }]
    const rn = resolveCharacterAnimSpeedParams(1, 'rn', { equipment })
    expect(rn.velocityPercent).toBe(175) // 100 + 50 run + 25 EFRW
    expect(rn.stepSpeed256).toBe(176) // trunc(101×175/100)
    const wl = resolveCharacterAnimSpeedParams(1, 'wl', { equipment })
    expect(wl.velocityPercent).toBe(125) // 100 + 25 EFRW
    expect(wl.stepSpeed256).toBe(266) // trunc(213×125/100)
  })

  it('a complete server stat 67 is used as-is (no double run bonus)', () => {
    const viaExplicit = resolveCharacterAnimSpeedParams(1, 'rn', {
      stat67VelocityPercent: 175,
    })
    expect(viaExplicit.velocityPercent).toBe(175)
    expect(viaExplicit.stepSpeed256).toBe(176)
    const viaStatList = resolveCharacterAnimSpeedParams(1, 'rn', {
      unitStats: { get: (id: number) => (id === STAT_VELOCITYPERCENT ? 175 : 0) },
    })
    expect(viaStatList.velocityPercent).toBe(175)
    expect(viaStatList.stepSpeed256).toBe(176)
  })

  it('the 25 velocity-percent floor replaces the 32 step-speed floor (#869 Diff 4)', () => {
    // Heavy slow: stat 67 total 10 → floor 25 → run anim trunc(101×25/100) = 25, not 32
    const rn = resolveCharacterAnimSpeedParams(1, 'rn', { stat67VelocityPercent: 10 })
    expect(rn.velocityPercent).toBe(25)
    expect(rn.stepSpeed256).toBe(25)
    const wl = resolveCharacterAnimSpeedParams(1, 'wl', { stat67VelocityPercent: 10 })
    expect(wl.stepSpeed256).toBe(53) // trunc(213×25/100)
  })

  it('vanilla armor speed penalty applies to walk/run via the implicit item stat 67 (#869)', () => {
    // Heavy torso (Scale Mail 'scl' speed 10, medium 'rng' 5, light 'cap' 0)
    expect(resolveArmorSpeed113c('scl')).toBe(10)
    expect(resolveArmorSpeed113c('rng')).toBe(5)
    expect(resolveArmorSpeed113c('cap')).toBe(0)
    expect(resolveArmorSpeed113c('ssd')).toBe(0) // shield: no penalty in vanilla data
    expect(resolveArmorSpeed113c('gis')).toBe(0) // weapon code not in Armor.txt

    const heavy = [{ code: 'scl', equippedSlot: 3 }]
    const rn = resolveCharacterAnimSpeedParams(1, 'rn', { equipment: heavy })
    expect(rn.velocityPercent).toBe(140) // 100 + 50 run − 10 armor
    expect(rn.stepSpeed256).toBe(141) // trunc(101×140/100)
    const wl = resolveCharacterAnimSpeedParams(1, 'wl', { equipment: heavy })
    expect(wl.velocityPercent).toBe(90)
    expect(wl.stepSpeed256).toBe(191) // trunc(213×90/100)

    // FRW +30 boots on heavy armor run: 100 + 50 − 10 + 25(EFRW) = 165
    const mixed = [
      { code: 'scl', equippedSlot: 3 },
      { stats: [{ statId: STAT_FASTERMOVEVELOCITY, value: 30 }] },
    ]
    const rnMixed = resolveCharacterAnimSpeedParams(1, 'rn', { equipment: mixed })
    expect(rnMixed.velocityPercent).toBe(165)
    expect(rnMixed.stepSpeed256).toBe(166) // trunc(101×165/100)

    // A server-provided stat 67 already contains the item stats — no double subtraction.
    const rnServer = resolveCharacterAnimSpeedParams(1, 'rn', {
      equipment: heavy,
      stat67VelocityPercent: 140,
    })
    expect(rnServer.velocityPercent).toBe(140)
  })

  it('walk cycle takes ~0.38s and run ~0.54s at the engine speeds', () => {
    const wl = resolveCharacterAnimSpeedParams(1, 'wl', {})
    const rn = resolveCharacterAnimSpeedParams(1, 'rn', {})
    // 8 frames per direction at stepSpeed256/256 frames per 40ms tick
    expect(Math.round((8 * 40 * 256) / wl.stepSpeed256)).toBe(385) // 0.385s
    expect(Math.round((8 * 40 * 256) / rn.stepSpeed256)).toBe(543) // 0.543s
  })
})

describe('computeMoveVelocityPercent113c (#869)', () => {
  it('defaults: 100 standing/walking, 150 running (CharStats 9/6 → +50%)', () => {
    expect(computeMoveVelocityPercent113c()).toBe(100)
    expect(computeMoveVelocityPercent113c({ running: true })).toBe(150)
  })

  it('honors custom CharStats walk/run velocities (e.g. classic 7/11 → +57%)', () => {
    expect(computeMoveVelocityPercent113c({ running: true, walkVelocity: 7, runVelocity: 11 })).toBe(157)
  })

  it('applies FRW diminishing base 150 and floors the sum at 25', () => {
    expect(computeMoveVelocityPercent113c({ itemFrw: 30 })).toBe(125) // +25 EFRW
    expect(computeMoveVelocityPercent113c({ itemFrw: 150, running: true })).toBe(225) // +75 EFRW
    expect(computeMoveVelocityPercent113c({ stat67: -60, running: true })).toBe(25) // 100+50-60 → floor
    expect(computeMoveVelocityPercent113c({ stat67: 10 })).toBe(25)
  })

  it('FRW diminishing formula: 30→25, 150→75, negatives pass through', () => {
    expect(computeFrwDiminishing113c(30)).toBe(25)
    expect(computeFrwDiminishing113c(150)).toBe(75)
    expect(computeFrwDiminishing113c(0)).toBe(0)
    expect(computeFrwDiminishing113c(-10)).toBe(-10)
  })
})

describe('computeLocomotionStepSpeed256 & frame index floor (#869 Diff 4)', () => {
  it('truncates base×pct/100 and clamps to [0, 32767] with no 32 floor', () => {
    expect(computeLocomotionStepSpeed256(101, 150)).toBe(151) // trunc(151.5)
    expect(computeLocomotionStepSpeed256(213, 100)).toBe(213)
    expect(computeLocomotionStepSpeed256(101, 25)).toBe(25) // floored vp must not re-floor to 32
    expect(computeLocomotionStepSpeed256(213, 25)).toBe(53)
    expect(computeLocomotionStepSpeed256(256, 32767)).toBe(32767)
    expect(computeLocomotionStepSpeed256(256, 0)).toBe(0)
  })

  it('computeAnimFrameIndex honors minStepSpeed256=0 for locomotion, defaults to 32 otherwise', () => {
    // 25Hz: elapsed ticks × stepSpeed/256 frames. 40ms → 1 tick → 25/256 = 0 frames either way.
    const idx0 = computeAnimFrameIndex({
      frameCount: 8,
      stepSpeed256: 25,
      loop: true,
      nowMs: 40,
      minStepSpeed256: 0,
    })
    expect(idx0).toBe(0) // 1 tick × 25/256 → 0.097 → frame 0
    // With the default 32 floor, stepSpeed 25 becomes 32 — 8 ticks × 32/256 = exactly 1 frame.
    const idxDefault = computeAnimFrameIndex({
      frameCount: 8,
      stepSpeed256: 25,
      loop: true,
      nowMs: 320,
    })
    expect(idxDefault).toBe(1)
    // With min 0 the true floored run speed advances 8 ticks × 25/256 = 0.78 → still frame 0.
    const idxTrue = computeAnimFrameIndex({
      frameCount: 8,
      stepSpeed256: 25,
      loop: true,
      nowMs: 320,
      minStepSpeed256: 0,
    })
    expect(idxTrue).toBe(0)
    // 26 ticks × 25/256 = 2.53 → frame 2 at min 0 (the 32 floor would give 3).
    const idxLate = computeAnimFrameIndex({
      frameCount: 8,
      stepSpeed256: 25,
      loop: true,
      nowMs: 1040,
      minStepSpeed256: 0,
    })
    expect(idxLate).toBe(2)
  })
})

describe('shapeshifted player locomotion anim speed (#869 Diff 5)', () => {
  it('Werewolf (430) & Werebear (431) use MonStats WalkAnimSpeed/RunAnimSpeed scaled by velocityPercent', () => {
    // MonStats: wolf (430) walkAnimSpeed=128, runAnimSpeed=104; bear (431) walkAnimSpeed=168, runAnimSpeed=120
    const wolfWl = resolveCharacterAnimSpeedParams(5, 'wl', { morphMonsterClassId: 430 })
    expect(wolfWl.baseSpeed).toBe(128)
    expect(wolfWl.velocityPercent).toBe(100)
    expect(wolfWl.stepSpeed256).toBe(128)

    const wolfRn = resolveCharacterAnimSpeedParams(5, 'rn', { morphMonsterClassId: 430 })
    expect(wolfRn.baseSpeed).toBe(104)
    expect(wolfRn.velocityPercent).toBe(150) // +50% run bonus still applies (Units.cpp:751-754)
    expect(wolfRn.stepSpeed256).toBe(156) // trunc(104 × 150 / 100) = 156 (NOT human 151)

    // +30% FRW boots (+25 EFRW) on Werewolf run: velocityPercent = 175 -> trunc(104 × 175 / 100) = 182
    const wolfRnFrw = resolveCharacterAnimSpeedParams(5, 'rn', {
      morphMonsterClassId: 430,
      equipment: [{ stats: [{ statId: STAT_FASTERMOVEVELOCITY, value: 30 }] }],
    })
    expect(wolfRnFrw.velocityPercent).toBe(175)
    expect(wolfRnFrw.stepSpeed256).toBe(182)

    const bearWl = resolveCharacterAnimSpeedParams(5, 'wl', { morphMonsterClassId: 431 })
    expect(bearWl.baseSpeed).toBe(168)
    expect(bearWl.stepSpeed256).toBe(168)

    const bearRn = resolveCharacterAnimSpeedParams(5, 'rn', { morphMonsterClassId: 431 })
    expect(bearRn.baseSpeed).toBe(120)
    expect(bearRn.velocityPercent).toBe(150)
    expect(bearRn.stepSpeed256).toBe(180) // trunc(120 × 150 / 100) = 180
  })

  it('ClientWorld resolves unit.animStepSpeed256 using wolf/bear bases when states 139/140 are active', () => {
    const world = new ClientWorld()
    world.apply(
      {
        type: 'UnitAssign',
        isSelf: true,
        unit: {
          unitType: 'player',
          id: 1,
          classId: 5, // Druid
          name: 'Druid',
          x: 5000,
          y: 5000,
          mode: 1,
          lifePct: 128,
        },
      },
      1000,
    )

    // Human run -> 151
    world.apply({ type: 'UnitMode', unitType: 'player', id: 1, mode: 3 }, 1040)
    expect(world.getUnit('player', 1)!.animStepSpeed256).toBe(151)

    // Shapeshift into Werewolf (state 139) while running -> refreshes immediately to 156
    world.apply({ type: 'StateSet', unit: { unitType: 'player', id: 1 }, state: 139 }, 1080)
    expect(world.getUnit('player', 1)!.animStepSpeed256).toBe(156)

    // Switch to walk (mode 2) while in Werewolf -> 128 (NOT human 213)
    world.apply({ type: 'UnitMode', unitType: 'player', id: 1, mode: 2 }, 1120)
    expect(world.getUnit('player', 1)!.animStepSpeed256).toBe(128)

    // Unmorph (StateEnd 139) while walking -> reverts to human 213
    world.apply({ type: 'StateEnd', unit: { unitType: 'player', id: 1 }, state: 139 }, 1160)
    expect(world.getUnit('player', 1)!.animStepSpeed256).toBe(213)

    // Shapeshift into Werebear (state 140) and run (mode 3) -> 180
    world.apply({ type: 'StateSet', unit: { unitType: 'player', id: 1 }, state: 140 }, 1200)
    world.apply({ type: 'UnitMode', unitType: 'player', id: 1, mode: 3 }, 1240)
    expect(world.getUnit('player', 1)!.animStepSpeed256).toBe(180)

    // UnitMove walk while in Werebear (state 140) -> 168
    world.apply(
      {
        type: 'UnitMove',
        unitType: 'player',
        id: 1,
        mode: 'walk',
        from: { x: 5000, y: 5000 },
        to: { x: 5010, y: 5010 },
      },
      1280,
    )
    expect(world.getUnit('player', 1)!.animStepSpeed256).toBe(168)
  })
})
