import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../../src/client/world/client-world.ts'
import { decode0xA5StateSkillEffect } from '../../../src/netproto/d2gs/s2c/misc.ts'

describe('Issue #1280: Paladin Charge (#107) dash displacement, state 18 (skill_move), and S2C 0xA5 termination', () => {
  it('1. isSelfMeleeSkill(107) returns false so Charge does not walk into melee range before dashing', () => {
    const world = new ClientWorld()
    expect(world.isSelfMeleeSkill(107)).toBe(false)
    expect(world.isSelfMeleeSkill(132)).toBe(false)
    expect(world.isSelfMeleeSkill(143)).toBe(false)
    expect(world.isSelfMeleeSkill(151)).toBe(false)
  })

  it('2. SkillOn with Charge (#107) on a distant monster immediately starts Charge dash (state 18, 1.125 sub-tiles/tick) and stops at target', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 3, name: 'Paladin', x: 5000, y: 5000 },
    })
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: { unitType: 1, id: 200, classId: 0, name: 'Skeleton', x: 5006, y: 5000 },
    })

    const pal = world.getUnit('player', 1)!
    world.self.leftSkill = 107
    world.noteOutgoingCommand(
      {
        type: 'SkillOn',
        hand: 'left',
        target: { unitType: 'monster', id: 200 },
        shift: false,
        hold: false,
      },
      1000,
    )

    expect(world.pendingMeleeAttack).toBeNull()
    expect(pal.castState?.skillId).toBe(107)
    expect(pal.states.has(18)).toBe(true)

    // 1.13c Charge step speed = 1.125 sub-tiles/tick
    // 2 ticks = 2.25 sub-tiles (5002.25)
    for (let t = 1; t <= 2; t++) {
      world.tick(40, 1000 + t * 40)
    }
    expect(pal.x).toBeCloseTo(5002.25, 5)
    expect(world.self.x).toBeCloseTo(5002.25, 5)
    expect(pal.states.has(18)).toBe(true)

    for (let t = 3; t <= 4; t++) {
      world.tick(40, 1000 + t * 40)
    }
    // At tick 4, reaches melee range of Skeleton -> terminates charge, triggers Attack1, and removes state 18
    expect(pal.castState).toBeUndefined()
    expect(pal.states.has(18)).toBe(false)
    expect(world.self.states.has(18)).toBe(false)
  })

  it('3. S2C 0xA5 (skillId=107) terminates Charge and removes state 18 without adding state 107 (shatter)', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 3, name: 'Paladin', x: 5000, y: 5000 },
    })
    const pal = world.getUnit('player', 1)!
    ;(world as any).applySkillCastToUnit(pal, 107, 5015, 5000, 1, true, 1000)
    expect(pal.states.has(18)).toBe(true)

    const pkt107 = new Uint8Array([0xa5, 0x00, 0x01, 0x00, 0x00, 0x00, 107, 0])
    world.apply(decode0xA5StateSkillEffect(pkt107))

    expect(pal.castState).toBeUndefined()
    expect(pal.states.has(18)).toBe(false)
    expect(pal.states.has(107)).toBe(false)
    expect(world.self.states.has(107)).toBe(false)
  })

  it('4. [Issue #1307] Charge (#107) on a target already in melee range attacks immediately in-place (mode 7) without dashing or state 18', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 3, name: 'Paladin', x: 5000, y: 5000 },
    })
    // Skeleton right in melee range (dx = 1 sub-tile <= 2)
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: { unitType: 1, id: 201, classId: 0, name: 'Skeleton', x: 5001, y: 5000 },
    })

    const pal = world.getUnit('player', 1)!
    world.self.leftSkill = 107
    world.noteOutgoingCommand(
      {
        type: 'SkillOn',
        hand: 'left',
        target: { unitType: 'monster', id: 201 },
        shift: false,
        hold: false,
      },
      2000,
    )

    // 1.13c CltSt25 (0x6FADBFD1) & SrvSt31 (0x6FCB96A7):
    // In-place Attack1 (mode 7), no state 18, no dash displacement
    expect(pal.mode).toBe(7)
    expect(pal.states.has(18)).toBe(false)
    expect(world.self.states.has(18)).toBe(false)
    expect(pal.castState?.chargeInPlaceAttack).toBe(true)

    // Advance 1 tick -> position remains 5000, 5000
    world.tick(40, 2040)
    expect(pal.x).toBe(5000)
    expect(pal.y).toBe(5000)
  })

  it('5. [Issue #1307] Obstacle collision terminates Charge (#107) dash and clears state 18', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 3, name: 'Paladin', x: 5000, y: 5000 },
    })
    // Block sub-tile (5002, 5000)
    world.setCollisionChecker((x, y) => Math.round(x) === 5002 && Math.round(y) === 5000)

    const pal = world.getUnit('player', 1)!
    ;(world as any).applySkillCastToUnit(pal, 107, 5010, 5000, 1, true, 3000)
    expect(pal.states.has(18)).toBe(true)

    // Tick 1: moves from 5000 -> 5001.125 (unblocked)
    world.tick(40, 3040)
    expect(pal.x).toBeCloseTo(5001.125, 5)
    expect(pal.states.has(18)).toBe(true)

    // Tick 2: next step would hit 5002.25 which is blocked -> charge terminates!
    world.tick(40, 3080)
    expect(pal.castState).toBeUndefined()
    expect(pal.states.has(18)).toBe(false)
    expect(world.self.states.has(18)).toBe(false)
    expect(pal.mode).toBe(1)
  })

  it('6. [Issue #1307] Server LifeMana packet during active Charge dash does not snap position backward', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 3, name: 'Paladin', x: 5000, y: 5000 },
    })

    const pal = world.getUnit('player', 1)!
    ;(world as any).applySkillCastToUnit(pal, 107, 5015, 5000, 1, true, 4000)
    expect(pal.states.has(18)).toBe(true)

    // Advance 2 ticks to x = 5002.25
    world.tick(40, 4040)
    world.tick(40, 4080)
    expect(pal.x).toBeCloseTo(5002.25, 5)

    // Server sends lagging LifeMana packet from origin (x: 5000, y: 5000) with potion vitals update
    world.apply({
      type: 'LifeMana',
      life: 500,
      mana: 200,
      stamina: 300,
      at: { x: 5000, y: 5000 },
    })

    // Vitals updated, but position was NOT snapped back to 5000!
    expect(world.self.life).toBe(500)
    expect(world.self.mana).toBe(200)
    expect(pal.x).toBeCloseTo(5002.25, 5)
    expect(world.self.x).toBeCloseTo(5002.25, 5)
  })
})
