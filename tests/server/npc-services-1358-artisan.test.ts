/**
 * Issue #1358 follow-up — artisan quest rewards.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function item(unitId: number, code = 'cap', quality = 2, level = 20) {
  return {
    unitId, code, name: code, quality, level, location: 'inventory',
    x: 0, y: 0, width: 1, height: 1, areaId: 1, ownerId: 1, bodyLoc: 0,
    storePage: 0, cost: 100, gamble: false, identified: true, ethereal: false,
    socketed: false, totalSockets: 0, durability: 10, maxDurability: 10,
    quantity: 1, stats: new Map(), socketedItems: [],
  }
}

function setup(seed: number, npcClass: number) {
  const game = new GameInstance({ seed, areaId: 1 })
  const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
  const player = (game as unknown as {
    players: Map<number, { questFlags: Uint16Array; activeNpcId: number | undefined; items: any[] }>
  }).players.get(playerId)!
  const npcId = game.spawnMonster({
    classId: npcClass, name: 'NPC', x: 11, y: 10, areaId: 1, isNpc: true,
  })
  player.activeNpcId = npcId
  return { game, playerId, player, npcId }
}

describe('issue #1358 artisan quest rewards', () => {
  it('requires and consumes a1q5 for Charsi imbue, and rolls rare affixes', () => {
    const { game, playerId, player, npcId } = setup(1358, 154)
    const target = item(9701)
    player.items.push(target)
    game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 0, complement: 9701 } as never)
    game.stepFrames(1)
    expect(player.items.find((i) => i.code === 'cap').quality).toBe(2)
    expect(player.questFlags[3]! & 1).toBe(0)

    player.questFlags[3] |= 1
    game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 0, complement: 9701 } as never)
    game.stepFrames(1)
    expect(String(player.items.find((i) => i.code === 'cap').quality)).toBe('rare')
    expect(player.questFlags[3]! & 1).toBe(1)
  })

  it('requires a5q1 and grants Larzuk ilvl-tier max sockets', () => {
    const { game, playerId, player, npcId } = setup(1359, 511)
    const target = item(9702, 'cap', 2, 50)
    player.items.push(target)
    game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 0, complement: 9702 } as never)
    game.stepFrames(1)
    expect(target.totalSockets).toBe(0)

    player.questFlags[35] |= 1
    game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 0, complement: 9702 } as never)
    game.stepFrames(1)
    expect(target.totalSockets).toBeGreaterThan(0)
    expect(target.totalSockets).toBeLessThanOrEqual(6)
    expect(player.questFlags[35]! & 1).toBe(1)
  })

  it('Cain identify updates rawItemData so vendor pricing sees the item as identified', () => {
    const { game, playerId, player, npcId } = setup(1360, 146)
    const target = { ...item(9703, 'cap', 4, 10), identified: false, rawItemData: { identified: false } }
    player.items.push(target as never)
    const internal = game as unknown as {
      handleNpcIdentifyAll: (player: unknown, npcId: number) => void
      players: Map<number, unknown>
    }
    internal.handleNpcIdentifyAll(internal.players.get(playerId), npcId)
    expect(target.identified).toBe(true)
    expect((target.rawItemData as { identified?: boolean }).identified).toBe(true)
    expect(((target.rawItemData as { rawFlags?: number }).rawFlags ?? 0) & 0x10).toBe(0x10)
  })

  it('enforces one-shot consumption on Charsi imbue, Larzuk sockets, and Anya personalize', () => {
    // 1. Charsi imbue: first succeeds + populates rare wire fields, second fails
    {
      const { game, playerId, player, npcId } = setup(1361, 154)
      const cap1 = item(9801, 'cap', 2, 20)
      const cap2 = item(9802, 'cap', 2, 20)
      player.items.push(cap1, cap2)
      player.questFlags[3] |= 1
      game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 0, complement: 9801 } as never)
      game.stepFrames(1)
      const imbued1 = player.items.find((i) => i.unitId === 9801)!
      expect(String(imbued1.quality)).toBe('rare')
      expect(imbued1.rawItemData?.quality).toBe(6)
      expect(imbued1.rawItemData?.rareName1).toBeGreaterThan(0)
      expect(imbued1.rawItemData?.rareName2).toBeGreaterThan(0)
      expect(Array.isArray(imbued1.rawItemData?.rareAffixes)).toBe(true)

      // Second imbue attempt without a new quest reward must be rejected
      game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 0, complement: 9802 } as never)
      game.stepFrames(1)
      expect(player.items.find((i) => i.unitId === 9802)!.quality).toBe(2)
    }

    // 2. Larzuk sockets: uses base.invWidth * base.invHeight (cap = 2 sockets), sets rawFlags 0x800, blocks second use
    {
      const { game, playerId, player, npcId } = setup(1362, 511)
      const cap1 = { ...item(9811, 'cap', 2, 50), quality: 'normal', rawItemData: { flags: 0x10, rawFlags: 0x10 } }
      const cap2 = item(9812, 'cap', 2, 50)
      player.items.push(cap1, cap2)
      player.questFlags[35] |= 2 // QFLAG_REWARDPENDING
      game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 0, complement: 9811 } as never)
      game.stepFrames(1)
      expect(cap1.totalSockets).toBe(2)
      expect((cap1.rawItemData.rawFlags ?? 0) & 0x800).toBe(0x800)

      // Second socket attempt must be rejected
      game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 0, complement: 9812 } as never)
      game.stepFrames(1)
      expect(cap2.totalSockets).toBe(0)
    }

    // 3. Anya personalize: sets 0x01000000 in rawFlags, blocks second use and non-personalizable items
    {
      const { game, playerId, player, npcId } = setup(1363, 512)
      const javelin = item(9820, 'jav', 2, 20) // stackable throwing weapon -> rejected without consuming reward
      const cap1 = item(9821, 'cap', 2, 20)
      const cap2 = item(9822, 'cap', 2, 20)
      player.items.push(javelin, cap1, cap2)
      player.questFlags[38] |= 2 // a5q4 word 38
      game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 0, complement: 9820 } as never)
      game.stepFrames(1)
      expect(javelin.name).toBe('jav')

      game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 0, complement: 9821 } as never)
      game.stepFrames(1)
      expect(cap1.name).toBe("Hero's cap")
      expect(((cap1 as { rawItemData?: { rawFlags?: number } }).rawItemData?.rawFlags ?? 0) & 0x01000000).toBe(
        0x01000000,
      )

      // Second personalize attempt must be rejected
      game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 0, complement: 9822 } as never)
      game.stepFrames(1)
      expect(cap2.name).toBe('cap')
    }
  })

  it('allows NpcIdentifyGamble at gamble vendors (e.g. Gheed) and rejects nonexistent npcId on repair/identify', () => {
    const { game, playerId, player } = setup(1364, 147) // Gheed (canGamble=true, canIdentify=false)
    const gambled = {
      ...item(9831, 'cap', 6, 20),
      identified: false,
      rawItemData: { identified: false, flags: 0, rawFlags: 0 },
    }
    player.items.push(gambled)
    game.enqueueCommand(playerId, { type: 'NpcIdentifyGamble', itemId: 9831 } as never)
    game.stepFrames(1)
    expect(gambled.identified).toBe(true)
    expect(gambled.rawItemData.rawFlags & 0x10).toBe(0x10)

    // Nonexistent NPC id when activeNpcId is undefined must not bypass NPC validation
    player.activeNpcId = undefined
    const damaged = { ...item(9832, 'cap', 2, 20), location: 'equipped', durability: 2, maxDurability: 10 }
    const unid = { ...item(9833, 'cap', 4, 20), identified: false }
    player.items.push(damaged, unid)
    game.enqueueCommand(playerId, { type: 'NpcRepairItem', npcId: 999999, itemId: 9832, itemMode: 1, durability: 2 } as never)
    game.enqueueCommand(playerId, { type: 'NpcIdentifyAll', npcId: 999999 } as never)
    game.stepFrames(1)
    expect(damaged.durability).toBe(2)
    expect(unid.identified).toBe(false)
  })
})
