import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ClientCommand, ItemData } from '../../src/netproto/index.ts'

const dropOnGround = (world: ClientWorld, id: number, code: string, x: number, y: number) =>
  world.apply({
    type: 'ItemEvent',
    action: 0,
    container: 'ground',
    item: { id, itemId: id, code, rawCode: `${code} `, container: 'ground', action: 0, flags: 0x00200010, rawFlags: 0x00200010, worldX: x, worldY: y, x, y, goldAmount: 100 } as unknown as ItemData,
  })

const createSetup = (enabled = true, level = 1) => {
  const world = new ClientWorld()
  world.apply({ type: 'UnitAssign', unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 }, isSelf: true })
  world.apply({ type: 'StatSet', stat: 12, value: level })
  const sent: ClientCommand[] = []
  const hudManager = new HudManager()
  const mapper = new CommandMapper({ world, hudManager, sendCommand: (cmd) => sent.push(cmd) })
  mapper.autoGoldPickup = enabled
  const pickups = () => sent.flatMap((c) => (c.type === 'ItemPickup' ? [c.itemId] : []))
  return { world, mapper, hudManager, pickups, sent }
}

describe('auto gold pickup', () => {
  it('picks up the nearest gold within reach, one pile per tick', () => {
    const { world, mapper, pickups } = createSetup()
    dropOnGround(world, 11, 'gld', 5003, 5000)
    dropOnGround(world, 12, 'gld', 5001, 5001)
    mapper.pickUpNearbyGold(1000)
    mapper.pickUpNearbyGold(1040)
    expect(pickups()).toEqual([12, 11])
  })

  it('ignores gold beyond the radius and items that are not gold', () => {
    const { world, mapper, pickups } = createSetup()
    dropOnGround(world, 21, 'gld', 5030, 5000)
    dropOnGround(world, 22, 'rin', 5001, 5000)
    mapper.pickUpNearbyGold(1000)
    expect(pickups()).toEqual([])
  })

  it('walks over to gold a few tiles away when idle, but not while the player is busy', () => {
    const idle = createSetup()
    dropOnGround(idle.world, 61, 'gld', 5012, 5000)
    idle.mapper.pickUpNearbyGold(1000)
    expect(idle.sent.find((c) => c.type === 'MoveToUnit')).toMatchObject({ target: { id: 61 } })
    const busy = createSetup()
    dropOnGround(busy.world, 62, 'gld', 5012, 5000)
    busy.mapper.handlePointerDown(400, 300, 0, 900)
    busy.sent.length = 0
    busy.mapper.pickUpNearbyGold(1000)
    expect(busy.sent.some((c) => c.type === 'MoveToUnit' || c.type === 'ItemPickup')).toBe(false)
  })

  it('retries a pile that is still on the ground only after a second', () => {
    const { world, mapper, pickups } = createSetup()
    dropOnGround(world, 31, 'gld', 5001, 5000)
    ;[1000, 1040, 1500, 2001].forEach((t) => mapper.pickUpNearbyGold(t))
    expect(pickups()).toEqual([31, 31])
  })

  it('does nothing when disabled or while carrying the maximum gold', () => {
    const disabled = createSetup(false)
    dropOnGround(disabled.world, 41, 'gld', 5001, 5000)
    disabled.mapper.pickUpNearbyGold(1000)
    const full = createSetup()
    full.world.apply({ type: 'StatSet', stat: 14, value: 10_000 })
    dropOnGround(full.world, 42, 'gld', 5001, 5000)
    full.mapper.pickUpNearbyGold(1000)
    expect([...disabled.pickups(), ...full.pickups()]).toEqual([])
  })

  it('waits while the stash or a vendor is open, like a click would close it first', () => {
    const { world, mapper, hudManager, pickups } = createSetup()
    dropOnGround(world, 51, 'gld', 5001, 5000)
    hudManager.leftPanel = 'stash'
    mapper.pickUpNearbyGold(1000)
    hudManager.leftPanel = 'none'
    mapper.pickUpNearbyGold(1040)
    expect(pickups()).toEqual([51])
  })
})
