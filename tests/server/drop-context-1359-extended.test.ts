/**
 * Issue #1359 follow-up — set bonuses contribute to MF/GF.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'

describe('issue #1359 set-bonus magic find', () => {
  it('adds an equipped set item property to magic find', () => {
    const tables = getEmbeddedDropTables()
    const orb = tables.sets.items.byIndex.get("Milabrega's Orb")!
    expect(orb).toBeDefined()
    const game = new GameInstance({ seed: 1359, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'MF', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as {
      players: Map<number, { items: unknown[] }>
      sumPlayerItemStat: (player: unknown, statId: number) => number
    }).players.get(playerId)!
    player.items.push({
      unitId: 9701, code: orb.item, name: orb.index, quality: 5, level: orb.lvl,
      location: 'equipped', x: 0, y: 0, width: 1, height: 1, areaId: 1,
      ownerId: playerId, bodyLoc: 5, storePage: 0, cost: 0, gamble: false,
      identified: true, ethereal: false, socketed: false, totalSockets: 0,
      durability: 10, maxDurability: 10, quantity: 1, stats: new Map(),
      socketedItems: [], rawItemData: { setItemId: orb.id },
    })
    const mf = (game as unknown as {
      sumPlayerItemStat: (player: unknown, statId: number) => number
    }).sumPlayerItemStat(player, 80)
    // Milabrega's Orb carries a flat 20% magic-find property.
    expect(mf).toBeGreaterThanOrEqual(20)
  })
})