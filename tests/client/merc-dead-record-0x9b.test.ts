import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { DEAD_MERC_NAME_ID_NONE } from '../../src/client/world/world-skill-state-tables.ts'
import { decode0x9BMercReviveCost } from '../../src/netproto/d2gs/s2c/merc.ts'
import { buildNpcMenuOptions } from '../../src/client/ui/panels/npc-dialog-menu.ts'
import { getTownNpcDescriptorByHcIdx } from '../../src/common/units/npc-table.ts'

/** Raw S2C 0x9B MercReviveCost (7B): [0x9B, u16 nameId, u16 cost, u16 unused]. */
function raw0x9B(nameId: number, cost: number): Uint8Array {
  return new Uint8Array([0x9b, nameId & 0xff, (nameId >> 8) & 0xff, cost & 0xff, (cost >> 8) & 0xff, 0, 0])
}

function makeWorldWithLiveMerc(mercId = 88): ClientWorld {
  const world = new ClientWorld()
  world.selfId = 1
  world.apply({
    type: 'UnitAssign',
    unit: { unitType: 'monster', id: mercId, classId: 271, x: 5100, y: 5100, mode: 1, lifePct: 128 },
  })
  world.apply({ type: 'Merc', kind: 'assign', ownerId: 1, mercId, classId: 271, nameId: 12 })
  return world
}

function resurrectOptionFor(world: ClientWorld, hcIdx: number): boolean {
  const descriptor = getTownNpcDescriptorByHcIdx(hcIdx)
  expect(descriptor).toBeDefined()
  const opts = buildNpcMenuOptions(descriptor!, {
    hasDeadMercenary: world.hasDeadMercenary,
    deadMercenaryReviveCost: world.deadMercReviveCost,
    playerLevel: 30,
  })
  return opts.some((o) => o.id === 'resurrect')
}

describe('1.13c dead-hireling record (S2C 0x9B, D2Client.dll 0x6fafa350 / NPC menu 0x6fafa603)', () => {
  it('starts with no dead hireling (word [0x6fba23e8] = 0xFFFF)', () => {
    const world = new ClientWorld()
    expect(world.deadMercNameId).toBe(DEAD_MERC_NAME_ID_NONE)
    expect(world.hasDeadMercenary).toBe(false)
    expect(world.deadMercReviveCost).toBe(0)
  })

  it('keeps NPC Resurrect after an in-game death even when stale life>0 packets for the merc follow 0x9B', () => {
    const world = makeWorldWithLiveMerc(88)
    // D2Game.dll 0x6fcb8120 sends 0x9B before the unit is flagged dying (|= 0x10000), so packets carrying the
    // pre-death life byte can still arrive afterwards.
    world.apply(decode0x9BMercReviveCost(raw0x9B(12, 15000)))
    expect(world.hasDeadMercenary).toBe(true)
    expect(world.deadMercReviveCost).toBe(15000)

    // 0x6D NPCStop / heal / 0x7F PartyMemberState / StatSet with life > 0 must not resurrect the record.
    world.apply({ type: 'Npc', kind: 'heal', npcId: 88, result: 100 })
    world.apply({ type: 'Party', kind: 'memberState', isPlayer: false, relation: 0, unitId: 88, lifePct: 80 })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 88, classId: 271, x: 5100, y: 5100, mode: 1, lifePct: 96 },
    })

    expect(world.merc?.isDead).toBe(true)
    expect(world.merc?.reviveCost).toBe(15000)
    expect(world.hasDeadMercenary).toBe(true)
    expect(world.deadMercReviveCost).toBe(15000)
    for (const hcIdx of [150, 198, 252, 367, 515]) {
      expect(resurrectOptionFor(world, hcIdx)).toBe(true)
    }
  })

  it('keeps NPC Resurrect when 0x81 AssignMerc(mercId = 0) drops the merc state after death', () => {
    const world = makeWorldWithLiveMerc(88)
    world.apply(decode0x9BMercReviveCost(raw0x9B(12, 15000)))
    world.apply({ type: 'Merc', kind: 'assign', ownerId: 1, mercId: 0 })
    expect(world.merc).toBeNull()
    expect(world.hasDeadMercenary).toBe(true)
    expect(resurrectOptionFor(world, 198)).toBe(true)
  })

  it('clears the record on 0x9B(0xFFFF, 0) after resurrect instead of marking the merc dead', () => {
    const world = makeWorldWithLiveMerc(88)
    world.apply(decode0x9BMercReviveCost(raw0x9B(12, 15000)))
    // Resurrect: server re-assigns the hireling (0x81) and clears the dead record (D2Game.dll 0x6fce0faa).
    world.apply({ type: 'Merc', kind: 'assign', ownerId: 1, mercId: 88, classId: 271, nameId: 12 })
    world.apply(decode0x9BMercReviveCost(raw0x9B(0xffff, 0)))

    expect(world.hasDeadMercenary).toBe(false)
    expect(world.deadMercReviveCost).toBe(0)
    expect(world.merc?.mercId).toBe(88)
    expect(world.merc?.isDead).toBe(false)
    expect(world.merc?.reviveCost).toBe(0)
    expect(resurrectOptionFor(world, 198)).toBe(false)

    // Life updates flow normally again once the record is cleared.
    world.apply({ type: 'Party', kind: 'memberState', isPlayer: false, relation: 0, unitId: 88, lifePct: 50 })
    expect(world.merc?.isDead).toBe(false)
  })

  it('handles join with a dead hireling (0x6fcb75a8) and drops the placeholder on 0x9B(0xFFFF)', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.apply(decode0x9BMercReviveCost(raw0x9B(12771, 37800)))
    expect(world.merc?.mercId).toBe(0)
    expect(world.merc?.isDead).toBe(true)
    expect(world.hasDeadMercenary).toBe(true)
    expect(world.deadMercReviveCost).toBe(37800)

    world.apply(decode0x9BMercReviveCost(raw0x9B(0xffff, 0)))
    expect(world.merc).toBeNull()
    expect(world.hasDeadMercenary).toBe(false)
  })

  it('resets the record on world reset (0x6faf6a20)', () => {
    const world = makeWorldWithLiveMerc(88)
    world.apply(decode0x9BMercReviveCost(raw0x9B(12, 15000)))
    world.reset()
    expect(world.hasDeadMercenary).toBe(false)
    expect(world.deadMercNameId).toBe(DEAD_MERC_NAME_ID_NONE)
  })
})
