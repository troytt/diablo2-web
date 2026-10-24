/**
 * Issue #1358 — NPC services: healer-only heal, repair (#10071), identify,
 * mercenary hire and resurrect.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

interface Entry {
  unitId: number
  code: string
  location: string
  durability: number
  maxDurability: number
  cost: number
  identified: boolean
  quality?: number
  stats: Map<number, number>
  socketedItems: never[]
  width: number
  height: number
  x: number
  y: number
  quantity: number
}
interface PlayerRecord {
  gold: number
  hp: number
  hpFixed: number
  mana: number
  states: Set<number>
  activeNpcId: number | undefined
  items: Entry[]
  questFlags: Uint16Array
}
interface Merc {
  unitId: number
  ownerPlayerId: number
  level: number
  hp: number
  maxHp: number
  alive: boolean
  state: string
  areaId: number
  subType: number
}

function setup(seed: number): { game: GameInstance; playerId: number; record: PlayerRecord } {
  const game = new GameInstance({ seed, areaId: 1 })
  const playerId = game.connectPlayer({ charClass: 'pal', name: 'Client', x: 10, y: 10, areaId: 1 })
  const record = (game as unknown as { players: Map<number, PlayerRecord> }).players.get(playerId)!
  record.gold = 1_000_000
  return { game, playerId, record }
}

function npc(game: GameInstance, classId: number, x = 11, y = 10): number {
  return game.spawnMonster({ classId, x, y, areaId: 1, isNpc: true, isVendor: true })
}

function item(unitId: number, durability = 0, maxDurability = 10, identified = false): Entry {
  return {
    unitId,
    code: 'cap',
    location: 'equipped',
    durability,
    maxDurability,
    cost: 100,
    identified,
    stats: new Map(),
    socketedItems: [],
    width: 1,
    height: 1,
    x: 0,
    y: 0,
    quantity: 1,
  }
}

describe('issue #1358 NPC services', () => {
  it('only healer NPCs restore life/mana and remove negative states', () => {
    const { game, playerId, record } = setup(1358)
    const charsi = npc(game, 154) // not a healer
    record.hp = 1
    record.hpFixed = 256
    record.states.add(2) // poison
    record.states.add(126) // positive buff
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: charsi } } as never)
    game.stepFrames(1)
    expect(record.hp).toBe(1)
    expect(record.states.has(2)).toBe(true)

    const akara = npc(game, 148) // healer
    record.activeNpcId = undefined
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: akara } } as never)
    game.stepFrames(1)
    expect(record.hp).toBeGreaterThan(1)
    expect(record.states.has(2)).toBe(false)
    expect(record.states.has(126)).toBe(true)
  })

  it('repairs a damaged item and deducts the #10071 cost', () => {
    const { game, playerId, record } = setup(1359)
    const charsi = npc(game, 154)
    const armor = item(9001, 0, 10)
    record.items.push(armor)
    record.activeNpcId = charsi
    game.enqueueCommand(playerId, { type: 'NpcRepairItem', npcId: charsi, itemId: 9001, itemMode: 1, durability: 0 } as never)
    game.stepFrames(1)
    expect(armor.durability).toBe(10)
    expect(record.gold).toBeLessThan(1_000_000)
  })

  it('identifies carried items', () => {
    const { game, playerId, record } = setup(1360)
    const cain = npc(game, 146)
    const a = item(9101, 10, 10, false)
    const b = item(9102, 10, 10, false)
    record.items.push(a, b)
    record.activeNpcId = cain
    game.enqueueCommand(playerId, { type: 'NpcIdentifyAll', npcId: cain } as never)
    game.stepFrames(1)
    expect(a.identified).toBe(true)
    expect(b.identified).toBe(true)
    game.enqueueCommand(playerId, { type: 'NpcIdentifyGamble', itemId: 9102 } as never)
    game.stepFrames(1)
    expect(b.identified).toBe(true)
  })

  it('hires and resurrects a mercenary with gold cost', () => {
    const { game, playerId, record } = setup(1361)
    const kashya = npc(game, 150)
    record.activeNpcId = kashya
    game.enqueueCommand(playerId, { type: 'MercHire', npcId: kashya, mercId: 0 } as never)
    game.stepFrames(1)
    const mercs = (game as unknown as { mercenaries: Map<number, Merc> }).mercenaries
    const merc = [...mercs.values()].find((m) => m.ownerPlayerId === playerId)!
    expect(merc).toBeDefined()
    expect(record.gold).toBeLessThan(1_000_000)

    merc.alive = false
    merc.hp = 0
    merc.state = 'dead'
    const before = record.gold
    game.enqueueCommand(playerId, { type: 'MercResurrect', npcId: kashya } as never)
    game.stepFrames(1)
    expect(merc.alive).toBe(true)
    expect(merc.hp).toBe(merc.maxHp)
    expect(record.gold).toBeLessThan(before)
  })

  it('applies Charsi imbue through NpcEntityAction', () => {
    const { game, playerId, record } = setup(1362)
    const charsi = npc(game, 154)
    const armor = item(9401, 10, 10, false)
    armor.location = 'inventory'
    armor.quality = 2
    armor.identified = true
    record.items.push(armor)
    record.activeNpcId = charsi
    record.questFlags[3] |= 1
    game.enqueueCommand(playerId, {
      type: 'NpcEntityAction',
      npcId: charsi,
      action: 0,
      complement: 9401,
    } as never)
    game.stepFrames(1)
    const imbued = (record.items as (Entry & { quality?: number })[]).find(
      (entry) => entry.unitId === 9401,
    )!
    expect(imbued.quality).toBe('rare')
    expect(imbued.identified).toBe(true)
  })

  it('applies Charsi imbue when item is picked up to cursor (ItemToCursor) even if itemId is 1', () => {
    const { game, playerId, record } = setup(1363)
    const charsi = npc(game, 154)
    const armor = item(1, 10, 10, false)
    armor.location = 'inventory'
    armor.quality = 2
    armor.identified = true
    record.items.push(armor)
    record.activeNpcId = charsi
    record.questFlags[3] |= 2
    game.enqueueCommand(playerId, {
      type: 'ItemToCursor',
      itemId: 1,
    } as never)
    game.enqueueCommand(playerId, {
      type: 'NpcEntityAction',
      npcId: charsi,
      action: 0,
      complement: 1,
    } as never)
    game.stepFrames(1)
    const imbued = (record.items as (Entry & { quality?: number; location?: string })[]).find(
      (entry) => entry.unitId === 1,
    )!
    expect(imbued.quality).toBe('rare')
    expect(imbued.identified).toBe(true)
    expect(imbued.location).toBe('inventory')
  })
})