import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'
import type { MapService } from '../../src/client/map/map-service.ts'
import { walledLevel } from './walled-level.ts'

const dropOnGround = (world: ClientWorld, id: number, code: string, x: number, y: number) =>
  world.apply({
    type: 'ItemEvent',
    action: 0,
    container: 'ground',
    item: { id, itemId: id, code, rawCode: `${code} `, container: 'ground', action: 0, flags: 0x00200010, rawFlags: 0x00200010, worldX: x, worldY: y, x, y, goldAmount: 100 },
  })

const createSetup = (enabled = true, level = 1, mapService?: MapService) => {
  const world = new ClientWorld()
  const [x, y] = mapService ? [100, 100] : [5000, 5000]
  if (mapService) world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 8 })
  world.apply({ type: 'UnitAssign', unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x, y }, isSelf: true })
  world.apply({ type: 'StatSet', stat: 12, value: level })
  const sent: ClientCommand[] = []
  const hudManager = new HudManager()
  const mapper = new CommandMapper({ world, hudManager, mapService, sendCommand: (cmd) => sent.push(cmd) })
  mapper.assists.autoGoldPickup = enabled
  const pickups = () => sent.flatMap((c) => (c.type === 'ItemPickup' ? [c.itemId] : []))
  return { world, mapper, hudManager, pickups, sent }
}

describe('auto gold pickup', () => {
  it('picks up the nearest gold within reach, one pile per tick', () => {
    const { world, mapper, pickups } = createSetup()
    dropOnGround(world, 11, 'gld', 5003, 5000)
    dropOnGround(world, 12, 'gld', 5001, 5001)
    mapper.assists.pickUpNearbyLoot(1000)
    mapper.assists.pickUpNearbyLoot(1040)
    expect(pickups()).toEqual([12, 11])
  })

  it('ignores gold beyond the radius and items that are not gold', () => {
    const { world, mapper, pickups } = createSetup()
    dropOnGround(world, 21, 'gld', 5030, 5000)
    dropOnGround(world, 22, 'rin', 5001, 5000)
    mapper.assists.pickUpNearbyLoot(1000)
    expect(pickups()).toEqual([])
  })

  it('walks over to gold a few tiles away when idle, but not while the player is busy', () => {
    const idle = createSetup()
    dropOnGround(idle.world, 61, 'gld', 5012, 5000)
    idle.mapper.assists.pickUpNearbyLoot(1000)
    expect(idle.sent.find((c) => c.type === 'MoveToUnit')).toMatchObject({ target: { id: 61 } })
    const busy = createSetup()
    dropOnGround(busy.world, 62, 'gld', 5012, 5000)
    busy.mapper.handlePointerDown(400, 300, 0, 900)
    busy.sent.length = 0
    busy.mapper.assists.pickUpNearbyLoot(1000)
    expect(busy.sent.some((c) => c.type === 'MoveToUnit' || c.type === 'ItemPickup')).toBe(false)
  })

  it('retries a pile that is still on the ground only after a second', () => {
    const { world, mapper, pickups } = createSetup()
    dropOnGround(world, 31, 'gld', 5001, 5000)
    ;[1000, 1040, 1500, 2001].forEach((t) => mapper.assists.pickUpNearbyLoot(t))
    expect(pickups()).toEqual([31, 31])
  })

  it('does nothing when disabled or while carrying the maximum gold', () => {
    const disabled = createSetup(false)
    dropOnGround(disabled.world, 41, 'gld', 5001, 5000)
    disabled.mapper.assists.pickUpNearbyLoot(1000)
    const full = createSetup()
    full.world.apply({ type: 'StatSet', stat: 14, value: 10_000 })
    dropOnGround(full.world, 42, 'gld', 5001, 5000)
    full.mapper.assists.pickUpNearbyLoot(1000)
    expect([...disabled.pickups(), ...full.pickups()]).toEqual([])
  })

  it('waits while the stash or a vendor is open, like a click would close it first', () => {
    const { world, mapper, hudManager, pickups } = createSetup()
    dropOnGround(world, 51, 'gld', 5001, 5000)
    hudManager.leftPanel = 'stash'
    mapper.assists.pickUpNearbyLoot(1000)
    hudManager.leftPanel = 'none'
    mapper.assists.pickUpNearbyLoot(1040)
    expect(pickups()).toEqual([51])
  })

  it('picks up potions while Auto-Potion is on and that kind is running low', () => {
    const { world, mapper, pickups } = createSetup(false)
    mapper.assists.autoPotionThresholds = { life: 65, rejuv: 35, mana: 20, merc: 40 }
    dropOnGround(world, 31, 'rvs', 5002, 5000)
    dropOnGround(world, 32, 'gld', 5001, 5000)
    mapper.assists.pickUpNearbyLoot(1000)
    expect(pickups()).toEqual([31])
  })
})

describe('auto gold pickup and walls', () => {
  const firstMove = (sent: readonly ClientCommand[]) => sent.find((c) => c.type !== 'ItemPickup')

  it('skips gold behind a wall for a farther pile it can walk to', () => {
    const { world, mapper, sent } = createSetup(true, 1, walledLevel())
    dropOnGround(world, 71, 'gld', 107, 100)
    dropOnGround(world, 72, 'gld', 92, 100)
    mapper.assists.pickUpNearbyLoot(1000)
    const move = firstMove(sent) as { readonly target?: { readonly id: number }; readonly to?: { readonly x: number } } | undefined
    expect(move?.target?.id === 72 || (move?.to?.x ?? 100) < 100).toBe(true)
  })

  it('walks toward the gap in the wall instead of straight into it', () => {
    const { world, mapper, sent } = createSetup(true, 1, walledLevel([106, 110]))
    dropOnGround(world, 81, 'gld', 108, 100)
    mapper.assists.pickUpNearbyLoot(1000)
    const move = firstMove(sent) as { readonly type: string; readonly to?: { readonly y: number } } | undefined
    expect(move?.type).toBe('Move')
    expect(move?.to?.y).toBeGreaterThan(104)
  })

  it('opens a closed door between you and the gold', () => {
    const { world, mapper, sent } = createSetup(true, 1, walledLevel([98, 102]))
    world.apply({ type: 'UnitAssign', unit: { unitType: 'object', id: 700, classId: 15, x: 104, y: 100, mode: 0 } } as never)
    dropOnGround(world, 91, 'gld', 110, 100)
    mapper.assists.pickUpNearbyLoot(1000)
    expect(sent.some((c) => JSON.stringify(c).includes('700'))).toBe(true)
  })
})
