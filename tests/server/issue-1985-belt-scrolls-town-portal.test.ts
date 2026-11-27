import { describe, expect, it } from 'vitest'
import { castTownPortalImpl } from '../../src/client/ui-model/hud-command-actions.ts'
import { PlayAssists, type PlayAssistHost } from '../../src/client/input/play-assists.ts'
import type { ClientCommand } from '../../src/netproto/domain/client-command.ts'
import type { ServerEvent } from '../../src/netproto/domain/server-event.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import type { ServerItemEntry } from '../../src/server/engine/game-instance/types.ts'

function makeServerItem(
  overrides: Partial<ServerItemEntry> & Pick<ServerItemEntry, 'unitId' | 'code' | 'name' | 'location'>,
): ServerItemEntry {
  return {
    quality: 2,
    level: 1,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    areaId: 0,
    ownerId: 1,
    bodyLoc: 0,
    storePage: 0,
    cost: 40,
    gamble: false,
    identified: true,
    ethereal: false,
    socketed: false,
    totalSockets: 0,
    durability: 0,
    maxDurability: 0,
    quantity: 0,
    stats: new Map<number, number>(),
    socketedItems: [],
    ...overrides,
  }
}

describe('Issue #1985: 1.13c belt-carried Town Portal & Identify scrolls (tsc / isc)', () => {
  it('castTownPortalImpl and PlayAssists emit BeltUse when tsc is only in belt and ItemUse when tbk/tsc is in inventory', () => {
    const emitted: ClientCommand[] = []
    const beltMap = new Map<number, { id: number; code: string; gridX: number }>([
      [501, { id: 501, code: 'tsc', gridX: 2 }],
    ])
    const invMap = new Map<number, { id: number; code: string; quantity?: number }>()

    const mockModel = {
      world: {
        isDead: false,
        self: { x: 100, y: 120 },
        containers: {
          inventory: invMap,
          belt: beltMap,
          cursor: null,
        },
        addLocalSystemMessage: () => {},
      },
      emitCommand: (cmd: ClientCommand) => emitted.push(cmd),
      useBeltSlot: (slot: number, shift = false) => {
        emitted.push({ type: 'BeltUse', itemId: 501, shift })
        return slot >= 0
      },
      useItem: (itemId: number) => {
        emitted.push({ type: 'ItemUse', itemId, at: { x: 100, y: 120 } })
      },
    }

    // 1. Only belt has 'tsc' -> BeltUse
    castTownPortalImpl(mockModel)
    expect(emitted).toEqual([{ type: 'BeltUse', itemId: 501, shift: false }])

    // 2. PlayAssists.hasTownPortal() & castTownPortal() with belt-only 'tsc'
    emitted.length = 0
    const assists = new PlayAssists({
      world: mockModel.world,
      hudManager: { commandSink: null, lang: 'ENG', belt: { grid: [] } },
      hudModel: mockModel,
      isTownArea: () => false,
    } as unknown as PlayAssistHost)
    expect(assists.hasTownPortal()).toBe(true)
    assists.castTownPortal()
    expect(emitted).toEqual([{ type: 'BeltUse', itemId: 501, shift: false }])

    // 3. Inventory 'tbk' with charges takes priority -> ItemUse
    emitted.length = 0
    invMap.set(601, { id: 601, code: 'tbk', quantity: 5 })
    castTownPortalImpl(mockModel)
    expect(emitted).toEqual([{ type: 'ItemUse', itemId: 601, at: { x: 100, y: 120 } }])
  })

  it('server BeltUse on belt tsc opens Town Portal (59), emits action 0x0f (RemoveFromBelt), shifts upper belt row down, and ItemUse on tbk preserves belt tsc', () => {
    const game = new GameInstance({ seed: 198501, difficulty: 0, areaId: 3 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'BeltTpSorc', x: 30, y: 30, areaId: 3 })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          unitId: number
          areaId: number
          act: number
          x: number
          y: number
          items: ServerItemEntry[]
        }
      >
      objects: Map<number, { classId: number; areaId: number; portalOwnerId?: number }>
    }
    const player = internal.players.get(playerId)!
    player.areaId = 3
    player.act = 0
    player.items = [
      makeServerItem({
        unitId: 7001,
        code: 'tsc',
        name: 'Scroll of Town Portal',
        location: 'belt',
        x: 1, // col 1, row 0
        ownerId: playerId,
      }),
      makeServerItem({
        unitId: 7002,
        code: 'tsc',
        name: 'Scroll of Town Portal',
        location: 'belt',
        x: 5, // col 1, row 1 -> should shift down to x = 1 (row 0)
        ownerId: playerId,
      }),
      makeServerItem({
        unitId: 7003,
        code: 'tbk',
        name: 'Tome of Town Portal',
        location: 'inventory',
        height: 2,
        quantity: 3,
        ownerId: playerId,
      }),
    ]

    game.drainPlayerEvents(playerId)

    // First: ItemUse on inventory 'tbk' (7003) should decrement 'tbk' to 2 and NOT consume belt 'tsc' (7001)!
    game.enqueueCommand(playerId, { type: 'ItemUse', itemId: 7003, at: { x: 30, y: 30 } })
    game.stepFrame()
    expect(player.items.find((i) => i.unitId === 7003)?.quantity).toBe(2)
    expect(player.items.some((i) => i.unitId === 7001)).toBe(true)

    game.drainPlayerEvents(playerId)

    // Second: BeltUse on belt 'tsc' (7001) should consume 7001 with action 0x0f and shift 7002 down to x = 1!
    game.enqueueCommand(playerId, { type: 'BeltUse', itemId: 7001, shift: false })
    game.stepFrame()
    const events: readonly ServerEvent[] = game.drainPlayerEvents(playerId)

    expect(player.items.some((i) => i.unitId === 7001)).toBe(false)
    const shifted = player.items.find((i) => i.unitId === 7002)
    expect(shifted?.location).toBe('belt')
    expect(shifted?.x).toBe(1)

    const removeBeltEv = events.find(
      (ev) => ev.type === 'ItemEvent' && ev.itemId === 7001 && ev.action === 0x0f,
    )
    expect(removeBeltEv).toBeDefined()

    const portalsInField = [...internal.objects.values()].filter(
      (o) => o.classId === 59 && o.areaId === 3 && o.portalOwnerId === playerId,
    )
    expect(portalsInField).toHaveLength(1)
  })

  it('server BeltUse on belt isc emits 0x3F UseStackableItem without deleting isc, and IdentifyItem consumes belt isc with action 0x0f + column shift', () => {
    const game = new GameInstance({ seed: 198502, difficulty: 0, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'BeltIdSorc', x: 20, y: 20, areaId: 1 })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          unitId: number
          items: ServerItemEntry[]
        }
      >
    }
    const player = internal.players.get(playerId)!
    player.items = [
      makeServerItem({
        unitId: 8001,
        code: 'isc',
        name: 'Scroll of Identify',
        location: 'belt',
        x: 3, // col 3, row 0
        ownerId: playerId,
      }),
      makeServerItem({
        unitId: 8002,
        code: 'isc',
        name: 'Scroll of Identify',
        location: 'belt',
        x: 7, // col 3, row 1 -> shifts down to x = 3
        ownerId: playerId,
      }),
      makeServerItem({
        unitId: 8003,
        code: 'rin',
        name: 'Ring',
        quality: 4,
        identified: false,
        location: 'inventory',
        ownerId: playerId,
      }),
    ]

    game.drainPlayerEvents(playerId)

    // Step 1: BeltUse on 8001 ('isc') emits UseStackableItem (0x3F) and keeps 8001 in belt!
    game.enqueueCommand(playerId, { type: 'BeltUse', itemId: 8001, shift: false })
    game.stepFrame()
    const useEvents = game.drainPlayerEvents(playerId)
    expect(player.items.some((i) => i.unitId === 8001)).toBe(true)
    const stackableEv = useEvents.find(
      (ev) =>
        ev.type === 'ActiveSkill' &&
        (ev as { isUseStackableItem?: boolean }).isUseStackableItem === true &&
        ev.itemId === 8001,
    )
    expect(stackableEv).toBeDefined()

    // Step 2: IdentifyItem (0x27) on 8003 using 8001 identifies 8003, emits 0x0f for 8001, and shifts 8002 -> x = 3!
    game.enqueueCommand(playerId, { type: 'IdentifyItem', itemId: 8003, scrollId: 8001 })
    game.stepFrame()
    const idEvents = game.drainPlayerEvents(playerId)

    expect(player.items.find((i) => i.unitId === 8003)?.identified).toBe(true)
    expect(player.items.some((i) => i.unitId === 8001)).toBe(false)
    expect(player.items.find((i) => i.unitId === 8002)?.x).toBe(3)
    const removeBeltEv = idEvents.find(
      (ev) => ev.type === 'ItemEvent' && ev.itemId === 8001 && ev.action === 0x0f,
    )
    expect(removeBeltEv).toBeDefined()
  })
})
