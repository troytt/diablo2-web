import { describe, expect, it } from 'vitest'
import { depositAllToStash, findFreeSlot, type StashDepositHost } from '../../src/client/ui-model/stash-deposit.ts'
import type { ClientWorld } from '../../src/client/world/client-world.ts'

interface FakeItem {
  id: number
  code: string
  gridX: number
  gridY: number
}

const createServer = (inventory: FakeItem[], options: { gold?: number; dropPlacements?: boolean } = {}) => {
  const containers = {
    inventory: new Map(inventory.map((item) => [item.id, item])),
    stash: new Map<number, FakeItem>(),
    cursor: null as FakeItem | null,
  }
  const self = { gold: options.gold ?? 0, stashGold: 0 }
  const sent: string[] = []
  const later = (fn: () => void) => setTimeout(fn, 5)
  const host: StashDepositHost = {
    world: { containers, self } as unknown as ClientWorld,
    pickupItemToCursor: (id) => {
      sent.push(`pick ${id}`)
      later(() => {
        containers.cursor = containers.inventory.get(id) ?? null
        containers.inventory.delete(id)
      })
    },
    placeCursorItem: (id, col, row, buffer) => {
      sent.push(`place ${id} ${col},${row} b${buffer}`)
      if (options.dropPlacements && buffer === 4) return
      later(() => {
        const item = { ...containers.cursor!, gridX: col, gridY: row }
        ;(buffer === 4 ? containers.stash : containers.inventory).set(id, item)
        containers.cursor = null
      })
    },
    depositGold: (amount) => void sent.push(`gold ${amount}`),
  }
  return { host, containers, sent }
}

describe('stash deposit all', () => {
  it('moves every inventory item into free stash slots one confirmed step at a time and banks the gold', async () => {
    const { host, containers, sent } = createServer(
      [
        { id: 1, code: 'hax', gridX: 0, gridY: 0 },
        { id: 2, code: 'cap', gridX: 1, gridY: 0 },
        { id: 3, code: 'rin', gridX: 3, gridY: 0 },
      ],
      { gold: 900 },
    )
    const result = await depositAllToStash(host, () => true)
    expect(result).toEqual({ moved: 3, left: 0, gold: 900 })
    expect(containers.inventory.size).toBe(0)
    expect(sent).toEqual(['pick 1', 'place 1 0,0 b4', 'pick 2', 'place 2 0,3 b4', 'pick 3', 'place 3 0,5 b4', 'gold 900'])
  })

  it('keeps charms, tomes and the cube in the inventory', async () => {
    const { host, containers } = createServer([
      { id: 1, code: 'cm1', gridX: 0, gridY: 0 },
      { id: 2, code: 'tbk', gridX: 1, gridY: 0 },
      { id: 3, code: 'box', gridX: 2, gridY: 0 },
      { id: 4, code: 'rin', gridX: 4, gridY: 0 },
    ])
    expect(await depositAllToStash(host, () => true)).toMatchObject({ moved: 1, left: 0 })
    expect([...containers.inventory.keys()]).toEqual([1, 2, 3])
  })

  it('puts the item back where it came from when the server never confirms the stash placement', async () => {
    const { host, sent } = createServer([{ id: 7, code: 'rin', gridX: 5, gridY: 2 }], { dropPlacements: true })
    const result = await depositAllToStash(host, () => true)
    expect(result.moved).toBe(0)
    expect(sent.at(-1)).toBe('place 7 5,2 b0')
  }, 10_000)

  it('stops as soon as the stash is closed', async () => {
    const { host, sent } = createServer([{ id: 1, code: 'rin', gridX: 0, gridY: 0 }], { gold: 50 })
    expect(await depositAllToStash(host, () => false)).toEqual({ moved: 0, left: 1, gold: 0 })
    expect(sent).toEqual([])
  })

  it('finds the first free slot column by column and reports a full stash', () => {
    expect(findFreeSlot([{ col: 0, row: 0, w: 2, h: 3 }], 1, 1)).toMatchObject({ col: 0, row: 3 })
    expect(findFreeSlot([{ col: 0, row: 0, w: 6, h: 8 }], 1, 1)).toBeNull()
  })
})
