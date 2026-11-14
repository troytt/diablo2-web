/**
 * Issue #1354 follow-up — potions go to the belt and stacks merge.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function entry(id: number, code: string) {
  return {
    unitId: id, code, name: code, quality: 2, level: 1, location: 'vendor',
    x: 0, y: 0, width: 1, height: 1, areaId: 1, ownerId: 0, bodyLoc: 0,
    storePage: 1, cost: 50, gamble: false, identified: true, ethereal: false,
    socketed: false, totalSockets: 0, durability: 0, maxDurability: 0,
    quantity: 1, stats: new Map(), socketedItems: [], permStore: true,
  }
}

function setup(seed: number) {
  const game = new GameInstance({ seed, areaId: 1 })
  const playerId = game.connectPlayer({ charClass: 'pal', name: 'Buyer', x: 10, y: 10, areaId: 1 })
  const player = (game as unknown as {
    players: Map<number, {
      gold: number
      activeNpcId: number | undefined
      activeVendorMode: 'trade' | 'gamble' | null
      items: any[]
      vendorPools: Map<number, any[]>
    }>
  }).players.get(playerId)!
  const npcId = game.spawnMonster({
    classId: 154, name: 'Charsi', x: 11, y: 10, areaId: 1, isNpc: true, isVendor: true,
  })
  player.gold = 1000
  player.activeNpcId = npcId
  player.activeVendorMode = 'trade'
  player.items = []
  return { game, playerId, player, npcId }
}

describe('issue #1354 purchase placement', () => {
  it('puts a potion into a free belt slot', () => {
    const { game, playerId, player, npcId } = setup(1354)
    player.vendorPools.set(npcId, [entry(9901, 'hp1')])
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9901, cost: 0 } as never)
    game.stepFrames(1)
    expect(player.items.some((it) => it.code === 'hp1' && it.location === 'belt')).toBe(true)
  })

  it('keeps potions as independent items instead of stacking them', () => {
    const { game, playerId, player, npcId } = setup(1355)
    const pile = { ...entry(9902, 'hp1'), unitId: 9903, location: 'inventory', quantity: 1 }
    player.items.push(pile)
    player.vendorPools.set(npcId, [entry(9902, 'hp1')])
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9902, cost: 0 } as never)
    game.stepFrames(1)
    expect(pile.quantity).toBe(1)
    expect(player.items.filter((it) => it.code === 'hp1')).toHaveLength(2)
  })

  it('merges a purchased scroll into an unfilled tome instead of stacking scrolls', () => {
    const { game, playerId, player, npcId } = setup(13541)
    const tome = {
      ...entry(9911, 'tbk'),
      unitId: 9912,
      location: 'inventory',
      permStore: false,
      quantity: 7,
      rawItemData: { quantity: 7 } as any,
    }
    player.items.push(tome)
    player.vendorPools.set(npcId, [entry(9911, 'tsc')])
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9911, cost: 0 } as never)
    game.stepFrames(1)
    expect(tome.quantity).toBe(8)
    expect(tome.rawItemData.quantity).toBe(8)
    expect(player.items.filter((it) => it.code === 'tsc')).toHaveLength(0)
    expect(player.items.filter((it) => it.code === 'tbk')).toHaveLength(1)
    const events = game.drainEvents(playerId)
    expect(
      events.some(
        (e) => e.type === 'UnitStatUpdate' && (e as any).statId === 14 && (e as any).value === 950,
      ),
    ).toBe(true)
  })

  it('uses 1.13c two-pass belt placement by equipped belt rows and emits container: belt', () => {
    const { game, playerId, player, npcId } = setup(13542)
    // Equip a Sash (lbl -> 2 rows = 8 slots)
    player.items.push({
      ...entry(9800, 'lbl'),
      location: 'equipped',
      bodyLoc: 8,
      permStore: false,
    })
    // Base row col 0 has mp1, col 1 has hp1; cols 2..3 are empty.
    player.items.push(
      { ...entry(9801, 'mp1'), location: 'belt', x: 0, y: 0 },
      { ...entry(9802, 'hp1'), location: 'belt', x: 1, y: 0 },
    )
    player.vendorPools.set(npcId, [entry(9921, 'hp2'), entry(9922, 'vps')])
    game.drainEvents(playerId)

    // Buying hp2 (same hp family as col 1 base hp1) must stack into (x=1, y=1) before empty row-0 cols 2..3!
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9921, cost: 0 } as never)
    game.stepFrames(1)
    const boughtHp2 = player.items.find((it) => it.code === 'hp2')
    expect(boughtHp2).toMatchObject({ location: 'belt', x: 1, y: 1 })
    const hp2Events = game.drainEvents(playerId)
    expect(
      hp2Events.some(
        (e) => e.type === 'ItemEvent' && (e as any).action === 'buy' && (e as any).container === 'belt',
      ),
    ).toBe(true)

    // Buying another hp2 now that col 1 (2 rows on Sash) is full must go to first empty base slot (x=2, y=0),
    // never into row 2 (since Sash has only 2 rows) and never into (x=0, y=1) above mp1!
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9921, cost: 0 } as never)
    game.stepFrames(1)
    const allHp2 = player.items.filter((it) => it.code === 'hp2')
    expect(allHp2).toHaveLength(2)
    expect(allHp2[1]).toMatchObject({ location: 'belt', x: 2, y: 0 })

    // Buying stamina potion (vps) goes into remaining empty base slot (x=3, y=0)
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9922, cost: 0 } as never)
    game.stepFrames(1)
    expect(player.items.find((it) => it.code === 'vps')).toMatchObject({ location: 'belt', x: 3, y: 0 })
  })

  it('caps key merges at 12, never stacks tomes together, and emits NpcTransaction on failure / stat 15 on bank spend', () => {
    const { game, playerId, player, npcId } = setup(13543)
    ;(player as any).gold = 20
    ;(player as any).goldBank = 100
    const keyStack = {
      ...entry(9850, 'key'),
      location: 'inventory',
      x: 0,
      y: 0,
      quantity: 11,
      rawItemData: { quantity: 11 } as any,
    }
    const existingTome = {
      ...entry(9851, 'tbk'),
      location: 'inventory',
      x: 1,
      y: 0,
      width: 1,
      height: 2,
      quantity: 5,
    }
    player.items.push(keyStack, existingTome)
    player.vendorPools.set(npcId, [entry(9931, 'key'), entry(9932, 'tbk')])
    game.drainEvents(playerId)

    // 1st key buy: merges 11 -> 12 and deducts 20 inventory gold + 30 bank gold (emitting stat 14 and stat 15)
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9931, cost: 0 } as never)
    game.stepFrames(1)
    expect(keyStack.quantity).toBe(12)
    expect(keyStack.rawItemData.quantity).toBe(12)
    expect(player.gold).toBe(0)
    expect((player as any).goldBank).toBe(70)
    const ev1 = game.drainEvents(playerId)
    expect(ev1.some((e) => e.type === 'UnitStatUpdate' && (e as any).statId === 14 && (e as any).value === 0)).toBe(true)
    expect(ev1.some((e) => e.type === 'UnitStatUpdate' && (e as any).statId === 15 && (e as any).value === 70)).toBe(true)

    // 2nd key buy: stack is at 12, so a new key item is created in inventory
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9931, cost: 0 } as never)
    game.stepFrames(1)
    expect(player.items.filter((it) => it.code === 'key')).toHaveLength(2)

    // Buying a tome (tbk) with only 20 bank gold left (< 50 cost) fails with NpcTransaction 0x0c (Not enough gold)
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9932, cost: 0 } as never)
    game.stepFrames(1)
    const evFail = game.drainEvents(playerId)
    expect(evFail.some((e) => e.type === 'NpcTransaction' && (e as any).result === 0x0c)).toBe(true)

    // Give enough gold and buy tbk: creates a 2nd independent tome, never stacking onto existingTome
    player.gold = 200
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9932, cost: 0 } as never)
    game.stepFrames(1)
    expect(existingTome.quantity).toBe(5)
    expect(player.items.filter((it) => it.code === 'tbk')).toHaveLength(2)
  })
})
