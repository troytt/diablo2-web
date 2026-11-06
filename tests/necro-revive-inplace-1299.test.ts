import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { buildSceneDrawables } from '../src/client/view/unit-drawables.ts'

describe('Issue #1299: Necromancer Revive (#95) In-Place Corpse Resurrection (0x6d / StateSet 96)', () => {
  it('resurrects a dead monster corpse in-place when S2C 0x6d (UnitMove stop) arrives with lifeByte=128', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      charClass: 2,
      name: 'Necro',
      x: 100,
      y: 100,
    } as any)

    // Spawn a monster that died and became a corpse (mode=12, dead=true, lifePct=0)
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 88,
        classId: 1,
        x: 106,
        y: 102,
        mode: 12,
        dead: true,
        lifePct: 0,
      },
    } as any)

    const mon = world.getUnit('monster', 88)!
    mon.dead = true
    mon.mode = 12
    mon.lifePct = 0
    mon.deathFxTriggered = true
    mon.states.add(104)
    mon.states.add(118)

    // S2C 0x81 (Merc / Pet registration for petType=6 Revive) arrives first while unit.lifePct is still 0
    world.apply({
      type: 'Merc',
      kind: 'assign',
      summonAction: 1,
      petType: 6,
      mercId: 88,
      classId: 1,
      ownerId: 1,
    } as any)

    // Pet in _pets must not be initialized with lifePct: 0
    expect(world.pets.get(88)?.lifePct).toBe(128)
    expect(world.pets.get(88)?.isDead).toBe(false)

    // S2C 0x6d (UnitMove stop with npc payload opcode 0x6d, lifeByte=128) arrives for the same unitId 88
    world.apply({
      type: 'UnitMove',
      unitType: 'monster',
      id: 88,
      mode: 'stop',
      to: { x: 106, y: 102 },
      npc: {
        opcode: 0x6d,
        cmd: 0x07,
        s: [106, 102, 128, 2, 0, 4, 0],
        driftCheckAt: { x: 106, y: 102 },
      },
    } as any)

    expect(mon.dead).toBe(false)
    expect(mon.mode).toBe(1)
    expect(mon.lifePct).toBe(128)
    expect(mon.deathFxTriggered).toBe(false)
    expect(mon.states.has(104)).toBe(false)
    expect(mon.states.has(118)).toBe(false)
    expect(buildSceneDrawables([mon]).unitDrawables.some((d) => d.id === 88)).toBe(true)

    // Subsequent walk UnitMove commands on the revived monster must move it normally
    world.apply({
      type: 'UnitMove',
      unitType: 'monster',
      id: 88,
      mode: 'walk',
      from: { x: 106, y: 102 },
      to: { x: 112, y: 102 },
    } as any)
    expect(mon.moving).toBe(true)
    expect(mon.mode).toBe(2)
  })

  it('resurrects a dead monster corpse in-place when StateSet (STATE_REVIVE = 96) arrives', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 89,
        classId: 5,
        x: 110,
        y: 110,
        mode: 12,
        dead: true,
        lifePct: 0,
      },
    } as any)

    const mon = world.getUnit('monster', 89)!
    mon.dead = true
    mon.mode = 12
    mon.lifePct = 0
    mon.deathFxTriggered = true
    mon.states.add(104)

    world.applyServerEvent({
      type: 'StateSet',
      unit: { unitType: 'monster', id: 89 },
      state: 96,
      origin: 0xa8,
      complete: true,
    } as any)

    expect(mon.states.has(96)).toBe(true)
    expect(mon.states.has(104)).toBe(false)
    expect(mon.dead).toBe(false)
    expect(mon.mode).toBe(1)
    expect(mon.lifePct).toBe(128)
    expect(mon.deathFxTriggered).toBe(false)
    expect((world as any).isFriendlyOrNonHostileMonster(mon)).toBe(true)
  })
})
