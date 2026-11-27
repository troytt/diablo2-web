import { describe, expect, it } from 'vitest'
import { SELF_BUFF_SKILL_STATES } from '../../../src/client/world/world-skill-state-tables.ts'
import { ClientWorld } from '../../../src/client/world/client-world.ts'
import { decode0xA5StateSkillEffect } from '../../../src/netproto/d2gs/s2c/misc.ts'

describe('Issue #1272: Barbarian Whirlwind (#151) displacement, state 174/18 cleanup, and S2C 0xA5 termination', () => {
  it('1. SELF_BUFF_SKILL_STATES does not permanently bind 151 -> 174', () => {
    expect(SELF_BUFF_SKILL_STATES[151]).toBeUndefined()
  })

  it('2. Whirlwind (#151) scales durationMs by travel distance (0.5 sub-tiles/tick), steps caster & self.x/y, and clears castState + states 18/174 immediately upon reaching target', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 4, name: 'Barb', x: 5000, y: 5000 },
    })
    const barb = world.getUnit('player', 1)!

    // Target 4 sub-tiles east -> 8 ticks at 0.5 sub-tiles/tick -> durationMs >= 8*40 + 80 = 400ms
    ;(world as any).applySkillCastToUnit(barb, 151, 5004, 5000, 1, true, 1000)
    expect(barb.castState).toBeDefined()
    expect(barb.castState!.durationMs).toBeGreaterThanOrEqual(400)
    expect(barb.states.has(18)).toBe(true)
    expect(barb.states.has(174)).toBe(true)
    expect(world.self.states.has(174)).toBe(true)

    // Step 4 ticks (2 sub-tiles): still spinning toward target
    for (let t = 1; t <= 4; t++) {
      world.tick(40, 1000 + t * 40)
    }
    expect(barb.x).toBeCloseTo(5002, 5)
    expect(world.self.x).toBeCloseTo(5002, 5)
    expect(barb.castState).toBeDefined()
    expect(barb.states.has(174)).toBe(true)

    // Step remaining 4 ticks to arrive at 5004: stops spinning immediately and removes states 18 & 174
    for (let t = 5; t <= 8; t++) {
      world.tick(40, 1000 + t * 40)
    }
    expect(barb.x).toBeCloseTo(5004, 5)
    expect(world.self.x).toBeCloseTo(5004, 5)
    expect(barb.castState).toBeUndefined()
    expect(barb.states.has(18)).toBe(false)
    expect(barb.states.has(174)).toBe(false)
    expect(world.self.states.has(18)).toBe(false)
    expect(world.self.states.has(174)).toBe(false)
  })

  it('3. S2C 0xA5 (skillId=151) terminates Whirlwind and removes states 18/174 without adding state 151 (cyclonearmor)', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 4, name: 'Barb', x: 5000, y: 5000 },
    })
    const barb = world.getUnit('player', 1)!
    ;(world as any).applySkillCastToUnit(barb, 151, 5020, 5000, 1, true, 1000)
    expect(barb.states.has(174)).toBe(true)

    const pkt151 = new Uint8Array([0xa5, 0x00, 0x01, 0x00, 0x00, 0x00, 151, 0])
    world.apply(decode0xA5StateSkillEffect(pkt151))

    expect(barb.castState).toBeUndefined()
    expect(barb.states.has(18)).toBe(false)
    expect(barb.states.has(174)).toBe(false)
    expect(barb.states.has(151)).toBe(false)
    expect(world.self.states.has(151)).toBe(false)
  })
})
