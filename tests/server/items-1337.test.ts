/**
 * Issue #1337 — ethereal armor defense, stackable drop quantity, and NpcBuy rejection.
 */
import { describe, expect, it } from 'vitest'
import { createDroppedItem } from '../../src/common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { finalizeDroppedItem113c } from '../../src/server/items/server-item-data.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

describe('issue #1337 item drop details', () => {
  it('applies the 1.13c +50% ethereal armor defense bonus', () => {
    const tables = getEmbeddedDropTables()
    const base = tables.armor.all.find(b => b.kind === 'armor' && b.defense > 0)!
    const normal = finalizeDroppedItem113c(
      createDroppedItem(base, 'normal', { ilvl: 30, dwInitSeed: 12345 }),
    )
    const ethereal = finalizeDroppedItem113c(
      createDroppedItem(base, 'normal', { ilvl: 30, dwInitSeed: 12345, ethereal: true }),
    )
    expect(ethereal.defense).toBe(Math.max(1, Math.floor((normal.defense ?? 0) * 1.5)))
  })

  it('rolls a stack quantity inside the base min/max for stackable drops', () => {
    const tables = getEmbeddedDropTables()
    const base = tables.weapons.all.find(
      (b: { stackable?: boolean }) => b.stackable === true,
    )!
    const item = createDroppedItem(base, 'normal', { ilvl: 10, dwInitSeed: 777 })
    const maxStack = Number((base as { maxstack?: number }).maxstack ?? 1)
    expect(item.stack).toBeGreaterThanOrEqual(1)
    expect(item.stack).toBeLessThanOrEqual(maxStack)
    expect(item.stack).toBeGreaterThan(1)
  })

  it('rejects NpcBuy for an unknown item id instead of granting the old cap fallback', () => {
    const game = new GameInstance({ seed: 1337, areaId: 1 })
    const id = game.connectPlayer({ charClass: 'pal', name: 'Buyer', x: 100, y: 100, areaId: 1 })
    game.drainEvents(id)
    const before = game.getPlayerState(id)!
    const npcId = game.spawnMonster({
      classId: 154,
      x: 110,
      y: 100,
      areaId: 1,
      isNpc: true,
      isVendor: true,
      isKillable: false,
      aiDisabled: true,
    })
    game.enqueueCommand(id, { type: 'NpcBuy', npcId, itemId: 987654, cost: 0 })
    game.stepFrame()
    const after = game.getPlayerState(id)!
    expect(after.items).toHaveLength(before.items.length)
    expect(after.gold).toBe(before.gold)
  })
})